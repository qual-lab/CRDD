/**
 * 上位回復結果の受領と下位終了Writerの接続を確認する。
 * @packageDocumentation
 * @responsibility 固定Repository、保存済みACK、閉じた公開結果と拒否条件を検証する。
 * @trace ERB-IT-003
 * @level IT
 * @scope Orchestratorの回復結果受領・終了接続。Filesystemと下位Writerは別試験で検証する。
 * @boundary ERB-IT-003=Orchestrator現在状態Reader→Coordinator終了限定Writer。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

/**
 * 最新形式だけを下位へ接続し、固定境界・保存・排他の不足を拒否する。
 * @responsibility 上位接続の正常・境界・異常と結果fieldの相関を検証する。
 * @trace ERB-IT-003
 * @precondition 下位実Filesystemの試験とは分離した接続試験である。
 * @stimulus 正規受理、旧ACK、別Root、世代・Attempt不一致、getter・Proxy、読取り途中変更を与える。
 * @observation Root・上位・下位の呼出し数、Writer条件と公開結果fieldを取得する。
 * @oracle 未確認・入力不正はblocked、固定結合と全下位条件成立時だけ閉じたcompleted。
 * @cleanup module mockを解除する。必要時の自己試験子Processはjoinし、Docker・Providerは使用しない。
 * @boundary 上位保存Readerと下位Reader・終了Writer。
 */
test("回復結果の受領・終了は固定Repositoryと保存済みACKだけへ接続する", async (t) => {
  if (!process.execArgv.includes("--experimental-test-module-mocks")) {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const output = execFileSync(
      process.execPath,
      ["--experimental-test-module-mocks", "--test", import.meta.filename],
      { timeout: 60_000, maxBuffer: 1024 * 1024, env, encoding: "utf8" },
    );
    assert.match(output, /pass 1/u);
    assert.match(output, /fail 0/u);
    return;
  }
  const fixed = {
    workingDirectory: "C:/fixture/repository",
    repositoryRoot: "C:/fixture/repository",
    repositoryBindingId: "binding-a",
  };
  const settlement = {
    workingDirectory: fixed.workingDirectory,
    repositoryBindingId: fixed.repositoryBindingId,
    projectId: "project-a",
    milestoneId: "milestone-a",
    stateGeneration: 7,
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    kind: "docker" as const,
    recoveryId: "recovery-a",
  };
  const acknowledgement = {
    repositoryBindingId: settlement.repositoryBindingId,
    projectId: settlement.projectId,
    milestoneId: settlement.milestoneId,
    taskId: settlement.taskId,
    attemptId: settlement.attemptId,
    operationId: settlement.operationId,
    recoveryId: settlement.recoveryId,
    settlementGeneration: 6,
    repositoryBinding: "a".repeat(64),
    resultId: "b".repeat(64),
    consumer: "orchestrator" as const,
  };
  const obligation = {
    kind: "docker",
    recoveryId: settlement.recoveryId,
    phase: "settled",
    acknowledgement: { ...acknowledgement },
  };
  const task = {
    definition: { id: settlement.taskId },
    attemptId: settlement.attemptId,
    operationId: settlement.operationId,
    state: "recovery_required",
    resultAcceptances: [],
    recoveryObligations: [obligation],
  };
  const state = {
    projectId: settlement.projectId,
    milestoneId: settlement.milestoneId,
    generation: settlement.stateGeneration,
    tasks: [task],
  };
  const capability = Object.freeze({});
  let upperReads = 0;
  let rootReads = 0;
  let lowerReads = 0;
  let writes = 0;
  let isRootVerified = true;
  let lockReleased = true;
  let resultOperation = settlement.operationId;
  let writerConfirmed = true;
  let isReaderChanged = false;
  let targetRemoved = false;
  let isAbsenceObserved = false;
  let mutateInput: typeof settlement | null = null;
  t.mock.module("../../../version-control/src/index.ts", {
    namedExports: {
      ...(await import("../../../version-control/src/index.ts")),
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => {
        rootReads += 1;
        return fixed.repositoryRoot;
      },
      verifyRepositoryRoot: () => ({
        status: isRootVerified ? "completed" : "blocked",
        capability: isRootVerified ? capability : null,
      }),
    },
  });
  t.mock.module("../../src/storage/current-state.ts", {
    namedExports: {
      readCurrentOrchestratorState: () => {
        upperReads += 1;
        return { status: "completed", value: state };
      },
    },
  });
  t.mock.module("../../../coordinator/src/state-storage/settlement-store.ts", {
    namedExports: {
      readRuntimeOwnedCoordinatorRecoveryResult: (
        root: unknown,
        id: unknown,
      ) => {
        assert.equal(root, capability);
        assert.equal(id, settlement.recoveryId);
        lowerReads += 1;
        if (mutateInput) mutateInput.operationId = "changed-during-read";
        return {
          status: "completed",
          reason: "observed",
          lockReleased,
          value: {
            repositoryBinding: acknowledgement.repositoryBinding,
            operationId: resultOperation,
            recoveryId: id,
            resultId: acknowledgement.resultId,
            consumer: "orchestrator",
          },
        };
      },
      prepareRuntimeOwnedCoordinatorRecoveredSettlement: (
        root: unknown,
        id: unknown,
        reader: () => unknown,
      ) => {
        assert.equal(root, capability);
        assert.equal(id, settlement.recoveryId);
        if (isReaderChanged) obligation.phase = "settled";
        const saved = reader();
        return saved && !targetRemoved ? { reader } : null;
      },
      completeRuntimeOwnedCoordinatorRecoveredSettlement: () => {
        writes += 1;
        return {
          status: "completed",
          reason: "completed",
          snapshotConfirmed: writerConfirmed,
          lockReleased,
          filesystemEffectIssued: true,
        };
      },
      observeRuntimeOwnedCoordinatorCompletedDelivery: (
        root: unknown,
        id: unknown,
        reader: () => unknown,
      ) => {
        assert.equal(root, capability);
        assert.equal(id, settlement.recoveryId);
        const saved = reader();
        return {
          status: saved ? "completed" : "blocked",
          reason: "remaining_observation",
          deliveryAbsentObserved: isAbsenceObserved && saved !== null,
          lockReleased,
        };
      },
    },
  });
  const {
    consumeDockerRecoveryReceiptAfterProjectSettlement: consume,
    collectDockerRecoveryAcknowledgementAfterProjectRecord: collect,
  } = await import("../../src/task/settle-docker-recovery.ts");
  let getterCalls = 0;
  const getterInput = { ...settlement };
  Object.defineProperty(getterInput, "workingDirectory", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("input getter must not run");
    },
  });
  for (const invalid of [null, getterInput, new Proxy(settlement, {})])
    assert.equal(
      consume(invalid as unknown as typeof settlement, fixed).status,
      "blocked",
    );
  assert.equal(getterCalls, 0);
  assert.equal(rootReads, 0);
  assert.equal(upperReads, 0);
  assert.equal(lowerReads, 0);
  assert.equal(consume(settlement).status, "blocked");
  assert.equal(upperReads, 0);
  assert.equal(
    consume({ ...settlement, workingDirectory: "C:/other" }, fixed).status,
    "blocked",
  );
  assert.equal(
    consume({ ...settlement, repositoryBindingId: "other" }, fixed).status,
    "blocked",
  );
  assert.equal(upperReads, 0);
  isRootVerified = false;
  assert.equal(consume(settlement, fixed).status, "blocked");
  isRootVerified = true;
  for (const changed of [
    { stateGeneration: 8 },
    { attemptId: "other" },
    { operationId: "other" },
  ])
    assert.equal(
      consume({ ...settlement, ...changed }, fixed).status,
      "blocked",
    );
  assert.equal(lowerReads, 0);
  const accepted = consume(settlement, fixed);
  assert.equal(accepted.status, "completed");
  assert.deepEqual(Object.keys(accepted).sort(), [
    "acknowledgement",
    "reason",
    "status",
  ]);
  lockReleased = false;
  assert.equal(consume(settlement, fixed).status, "blocked");
  lockReleased = true;
  resultOperation = "other";
  assert.equal(consume(settlement, fixed).status, "blocked");
  resultOperation = settlement.operationId;
  mutateInput = { ...settlement };
  assert.equal(consume(mutateInput, fixed).status, "completed");
  assert.equal(mutateInput.operationId, "changed-during-read");
  mutateInput = null;
  const input = { ...settlement, acknowledgement };
  assert.equal(collect(input, fixed).status, "blocked");
  obligation.phase = "acknowledged";
  assert.equal(
    collect(
      { ...input, acknowledgement: { receiptContentHash: "b".repeat(64) } },
      fixed,
    ).status,
    "blocked",
  );
  assert.equal(
    collect(
      {
        ...input,
        acknowledgement: { ...acknowledgement, resultId: "c".repeat(64) },
      },
      fixed,
    ).status,
    "blocked",
  );
  assert.equal(
    collect({ ...input, stateGeneration: 8 }, fixed).status,
    "blocked",
  );
  assert.equal(writes, 0);
  isReaderChanged = true;
  assert.equal(collect(input, fixed).status, "blocked");
  assert.equal(writes, 0);
  isReaderChanged = false;
  obligation.phase = "acknowledged";
  writerConfirmed = false;
  assert.equal(collect(input, fixed).status, "blocked");
  writerConfirmed = true;
  lockReleased = false;
  assert.equal(collect(input, fixed).status, "blocked");
  lockReleased = true;
  const reordered = Object.fromEntries(
    Object.entries(acknowledgement).reverse(),
  );
  const completed = collect({ ...input, acknowledgement: reordered }, fixed);
  assert.equal(completed.status, "completed");
  assert.deepEqual(Object.keys(completed).sort(), ["reason", "status"]);
  assert.equal(writes, 3);
  targetRemoved = true;
  assert.equal(collect(input, fixed).status, "blocked");
  isAbsenceObserved = true;
  lockReleased = false;
  assert.equal(collect(input, fixed).status, "blocked");
  lockReleased = true;
  const absentCompletion = collect(input, fixed);
  assert.equal(absentCompletion.status, "completed");
  assert.deepEqual(Object.keys(absentCompletion).sort(), ["reason", "status"]);
  assert.equal(writes, 3);
  isReaderChanged = true;
  assert.equal(collect(input, fixed).status, "blocked");
  assert.equal(writes, 3);
});
