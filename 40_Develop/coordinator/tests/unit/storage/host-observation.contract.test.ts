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
import type { ExecutionOperationRecord } from "@qual-lab/crdd-execution-model";
import { createResourceOperationFixture } from "../../../../execution-model/tests/support/resource-operation.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";

/**
 * 現在の回収入口で同版の操作と試行の終端条件を照合する。
 * @trace PRL-UT-006
 * @precondition 同版の操作投影を入力し、実行モデルのReaderと物理Hostは呼ばない。
 * @stimulus 参照、資源・再起動確定、状態、Ownerを個別に破る。
 * @observation Host清掃の前提成立と途中保存へ渡す解放記録。
 * @oracle 不明・別参照は拒否し、確認済みの試行だけを受理する。
 * @cleanup 局所値だけ。
 * @boundary 回収入口が使用する同版の操作投影と元試行の照合。
 */
test("解放済みTaskのHost観測条件はOwner・資源・再起動相関を保つ", () => {
  const { operation: initialOperation } = createResourceOperationFixture();
  const releasedOperation: ExecutionOperationRecord = {
    ...initialOperation,
    phase: "settling",
    lease: "released",
    execution: {
      ...initialOperation.execution,
      ownerEffect: "disabled",
      workspaceReusable: false,
    },
  };
  const production = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(
    production,
    "canPrepareDockerHostCleanup",
  );
  const capability = {},
    management = {};
  const record = {
    completedPlan: {},
    homeLeaseReleased: true,
    managementCapability: management,
    recoveryId: releasedOperation.recoveryId,
    operationId: "op",
  };
  const state = {
    kind: "docker_task",
    operation: releasedOperation,
    resourcesSettled: true,
    restartSettled: true,
  } as const;
  const prepare = runInNewContext(
    `${declaration}; canPrepareDockerHostCleanup`,
    {
      durableRecord: (value: unknown) => (value === capability ? record : null),
    },
  );
  assert.equal(prepare({}, state), false);
  for (const fixture of [
    { changed: state, result: true },
    { changed: undefined },
    {
      changed: {
        ...state,
        operation: { ...releasedOperation, recoveryId: "other" },
      },
    },
    { changed: { ...state, resourcesSettled: false } },
    { changed: { ...state, restartSettled: false } },
    {
      changed: {
        ...state,
        operation: { ...releasedOperation, phase: "executing" },
      },
    },
    {
      changed: { ...state, operation: { ...releasedOperation, lease: "held" } },
    },
    ...["active", "unknown"].map((ownerEffect) => ({
      changed: {
        ...state,
        operation: {
          ...releasedOperation,
          execution: { ...releasedOperation.execution, ownerEffect },
        },
      },
    })),
  ]) {
    assert.equal(
      prepare(capability, fixture.changed),
      "result" in fixture ? fixture.result : false,
    );
  }
  const normalOld = initialOperation;
  const recoveryId = initialOperation.recoveryId;
  const lifecycleSource = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const completeStart = lifecycleSource.indexOf(
    "function completeDockerRecovery(",
  );
  const checkpointStart = lifecycleSource.indexOf(
    "const saved = saveOperationCheckpoint(",
    completeStart,
  );
  const checkpointEnd = lifecycleSource.indexOf("\n    if (", checkpointStart);
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
    operationStateInput: (owner: unknown) => owner,
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
