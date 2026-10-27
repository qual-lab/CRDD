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
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  type CoordinatorStateTaskOperation,
  decodeRuntimeDomainSnapshot as decodeCoordinatorStateSnapshot,
  decodeDockerRestartCheckpoint,
  prepareCoordinatorStateOperationSnapshot,
} from "../../../../domain-model/src/index.ts";
import { coordinatorReleasedTaskCanObserveHostAbsence } from "../../../src/execution/validation.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";

const binding = "a".repeat(64);
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
  const nonce = "b".repeat(64);
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token =
    "host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc." +
    hostHash;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v2",
    operationNonce: nonce,
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: executionSelection("executor", {
      provider: "claude",
      model: "opus",
      effort: "low",
    }),
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const identityJson = `${JSON.stringify(identity)}\n`;

  const prepared = prepareCoordinatorStateOperationSnapshot(
    null,
    identityJson,
    binding,
  );
  assert.ok(prepared);
  const preparedState = decodeCoordinatorStateSnapshot(prepared, binding);
  assert.ok(preparedState);
  const initialOperation = preparedState.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task",
  );
  assert.ok(initialOperation);
  const releasedOperation: CoordinatorStateTaskOperation = {
    ...initialOperation,
    lease: "released",
    execution: {
      ...initialOperation.execution,
      ownerEffect: "disabled",
      workspaceReusable: false,
    },
    resources: initialOperation.resources.map((item) => ({
      ...item,
      request: "identified",
      dockerId: "d".repeat(64),
      receiptSource: "docker_create_result",
      observation: "absent",
    })),
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
    } as unknown as CoordinatorStateTaskOperation),
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
    assert.ok(decodeDockerRestartCheckpoint(dockerRestart));
    assert.equal(
      coordinatorReleasedTaskCanObserveHostAbsence({
        ...releasedOperation,
        dockerRestart,
      }),
      false,
    );
  }
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
    { ...releasedOperation, resources: releasedOperation.resources.slice(1) },
    {
      ...releasedOperation,
      resources: releasedOperation.resources.map((item, i) =>
        i === 0 ? { ...item, request: "unknown" as const } : item,
      ),
    },
    {
      ...releasedOperation,
      resources: releasedOperation.resources.map((item, i) =>
        i === 0 ? { ...item, observation: "unknown" as const } : item,
      ),
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
    "const saved = checkpointRuntimeOwnedCoordinatorLifecycle(",
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
    checkpointRuntimeOwnedCoordinatorLifecycle: (
      _owner: unknown,
      _id: unknown,
      value: unknown,
    ) => value,
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
