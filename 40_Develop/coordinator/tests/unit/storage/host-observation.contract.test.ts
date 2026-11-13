/**
 * 終了済みTaskからHost不存在観測へ進める条件を検証する。
 * @packageDocumentation
 * @responsibility 保存codecの検査からHost側の純粋な実行条件を分離する。
 * @trace PRL-UT-006
 * @level UT
 * @scope メモリ内の固定操作・資源・Owner状態。
 * @boundary 実Host処置・Filesystem・Docker・AIは使用しない。
 */
import assert from "node:assert/strict";

import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import type { ExecutionOperationRecord } from "../../../../execution-model/src/index.ts";
import { createResourceOperationFixture } from "../../../../execution-model/tests/support/resource-operation.ts";
import { coordinatorReleasedTaskCanObserveHostAbsence } from "../../../src/execution/validation.ts";

/**
 * 元の解放済み操作と拒否例を同じHost条件へ渡す。
 * @trace PRL-UT-006
 * @precondition Domainの正規codecが認める合成Identityを使用する。
 * @stimulus Owner・Lease・未解決再起動・資源相関を個別に破る。
 * @observation Host不存在観測へ進めるかを取得する。
 * @oracle 正規の解放済み状態だけtrueとなる。
 * @cleanup N/A: 局所値だけ。
 * @boundary Host条件の判定。実回収成立は示さない。
 */
test("解放済みTaskのHost観測条件はOwner・資源・再起動相関を保つ", () => {
  const { operation: initialOperation, identity } =
    createResourceOperationFixture();
  const releasedOperation: ExecutionOperationRecord = {
    ...initialOperation,
    lease: "released",
    execution: {
      ...initialOperation.execution,
      ownerEffect: "disabled",
      workspaceReusable: false,
    },
    resources: {
      snapshot: {
        resources: [
          {
            key: "resource",
            request: "issued",
            identity: {
              kind: "container",
              name: "crdd-fixture",
              dockerId: "d".repeat(64),
              ownershipLabel: identity.ownershipLabel,
            },
            configuration: {
              image: null,
              command: null,
              environmentNames: null,
              mounts: null,
              networks: null,
              internal: null,
            },
          },
        ],
      },
      checkpoints: [
        {
          key: "resource",
          submission: "intent_saved",
          receiptSource: "docker_create_result",
          observation: "absent",
          absenceEvidenceSha256: "e".repeat(64),
        },
      ],
      cleanup: {
        cleanupOrder: ["resource"],
        setupTimeoutMs: 10000,
        unreceiptedAbsence: "retain",
        verifyLabelAbsence: false,
      },
    },
  };

  assert.equal(
    coordinatorReleasedTaskCanObserveHostAbsence(releasedOperation),
    true,
  );
  // 型で禁止される入力も、実行時の拒否条件を個別に反証する。
  assert.equal(
    coordinatorReleasedTaskCanObserveHostAbsence({
      ...releasedOperation,
      execution: { ...releasedOperation.execution, workspaceReusable: true },
    } as unknown as ExecutionOperationRecord),
    false,
  );
  for (const effectOutcomeUnknown of [false, true]) {
    const dockerRestart = {
      requestId: "a".repeat(64),
      scopeSha256: "b".repeat(64),
      request: "confirmed" as const,
      cleanup: "pending" as const,
      result: {
        status: "blocked" as const,
        reason: "docker_restart_unsettled",
        request: "confirmed" as const,
        effectOutcomeUnknown,
      },
    };
    assert.equal(
      coordinatorReleasedTaskCanObserveHostAbsence({
        ...releasedOperation,
        dockerRestart,
      }),
      false,
    );
  }
  const book = releasedOperation.resources;
  assert.ok(book);
  for (const invalid of [
    { ...releasedOperation, lease: "held" as const },
    {
      ...releasedOperation,
      execution: {
        ...releasedOperation.execution,
        ownerEffect: "active" as const,
      },
    },
    {
      ...releasedOperation,
      execution: {
        ...releasedOperation.execution,
        ownerEffect: "unknown" as const,
      },
    },
    {
      ...releasedOperation,
      host: { ...releasedOperation.host, pendingTransitionJson: "pending" },
    },
    {
      ...releasedOperation,
      resources: { ...book, checkpoints: book.checkpoints.slice(1) },
    },
    {
      ...releasedOperation,
      resources: {
        ...book,
        checkpoints: book.checkpoints.map((item) => ({
          ...item,
          receiptSource: null,
        })),
        snapshot: {
          resources: book.snapshot.resources.map((item) => ({
            ...item,
            request: "unknown" as const,
            identity: { ...item.identity, dockerId: null },
          })),
        },
      },
    },
    {
      ...releasedOperation,
      resources: {
        ...book,
        checkpoints: book.checkpoints.map((item) => ({
          ...item,
          observation: "unknown" as const,
          absenceEvidenceSha256: null,
        })),
      },
    },
  ])
    assert.equal(coordinatorReleasedTaskCanObserveHostAbsence(invalid), false);
  const normalOld = initialOperation;
  const recoveryId = initialOperation.recoveryId;
  const lifecycleSource = fs.readFileSync(
    new URL("../../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const completeStart = lifecycleSource.indexOf(
    "function completeProductionRecovery(",
  );
  const checkpointStart = lifecycleSource.indexOf(
    "const saved = saveOperationCheckpoint(",
    completeStart,
  );
  const checkpointEnd = lifecycleSource.indexOf("\n  if (", checkpointStart);
  assert.ok(
    completeStart > 0 &&
      checkpointStart > completeStart &&
      checkpointEnd > checkpointStart,
  );
  const checkpoint = lifecycleSource.slice(checkpointStart, checkpointEnd);
  const disabled =
    'execution: { ...operation.execution, ownerEffect: "disabled" }';
  assert.equal(checkpoint.split(disabled).length, 2);
  const checkpointContext = {
    managementCapability: {},
    record: { recoveryId },
    operation: {
      ...normalOld,
      execution: { ...normalOld.execution, ownerEffect: "active" },
    },
    saveOperationCheckpoint: (
      owner: unknown,
      recoveryId: unknown,
      request: { kind: string; value: unknown },
    ) => {
      if (request.kind === "lifecycle")
        return ((_owner: unknown, _id: unknown, value: unknown) => value)(
          owner,
          recoveryId,
          request.value,
        );
      throw new Error("unexpected_checkpoint_kind");
    },
  };
  const checkpointValue = runInNewContext(
    `(() => { ${checkpoint}; return saved; })()`,
    checkpointContext,
  );
  assert.equal(checkpointValue.lease, "released");
  assert.equal(checkpointValue.execution.ownerEffect, "disabled");
  assert.throws(
    () => {
      const changed = checkpoint.replace(
        disabled,
        "execution: operation.execution",
      );
      assert.equal(
        runInNewContext(
          `(() => { ${changed}; return saved; })()`,
          checkpointContext,
        ).execution.ownerEffect,
        "disabled",
      );
    },
    { code: "ERR_ASSERTION" },
  );
});
