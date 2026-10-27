/**
 * 上位回復結果と技術状態Readerの接続を確認する。
 * @packageDocumentation
 * @responsibility 固定Repository、同じTask・回復参照、閉じた公開結果と拒否条件を検証する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @level IT
 * @scope Coordinatorの回復結果読取り接続。Filesystemと原子受領Writerは別試験で検証する。
 * @boundary ERB-IT-003=Coordinator現在状態Reader→技術結果Reader。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import { execFileSync } from "node:child_process";
import test from "node:test";

/**
 * 最新形式だけを下位へ接続し、固定境界・保存・排他の不足を拒否する。
 * @responsibility 上位接続の正常・境界・異常と結果fieldの相関を検証する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @precondition 下位実Filesystemの試験とは分離した接続試験である。
 * @stimulus 正規結果、別Root、世代・Attempt不一致、getter・Proxy、読取り途中変更を与える。
 * @observation Root・上位・下位の呼出し数と公開結果fieldを取得する。
 * @oracle 未確認・入力不正はblocked、固定結合と全下位条件成立時だけ閉じたcompleted。
 * @cleanup module mockを解除する。必要時の自己試験子Processはjoinし、Docker・Providerは使用しない。
 * @boundary 上位保存Readerと下位技術結果Reader。
 */
test("回復結果読取りは固定Repositoryと同じTaskの回復参照へ接続する", async () => {
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
  let isRootVerified = true;
  let lockReleased = true;
  let resultOperation = settlement.operationId;
  let mutateInput: typeof settlement | null = null;
  const versionControl = {
    namedExports: {
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => {
        rootReads += 1;
        return fixed.repositoryRoot;
      },
      verifyRepositoryRoot: () => ({
        status: isRootVerified ? "completed" : "blocked",
        capability: isRootVerified ? capability : null,
      }),
    },
  };
  const currentState = {
    namedExports: {
      readCurrentCoordinatorState: () => {
        upperReads += 1;
        return { status: "completed", value: state };
      },
    },
  };
  const results = {
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
    },
  };
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const body = [
    "verifyRecoverySettlementRepository",
    "consumeProjectSettledDockerRecoveryWithRuntimeBoundary",
    "consumeDockerRecoveryReceiptAfterProjectSettlement",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const consume = runInNewContext(
    `(()=>{${body};return consumeDockerRecoveryReceiptAfterProjectSettlement;})()`,
    {
      ...versionControl.namedExports,
      ...results.namedExports,
      readCoordinatorState:
        currentState.namedExports.readCurrentCoordinatorState,
      snapshotPlainRecord,
    },
  );
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
  assert.equal(
    "collectDockerRecoveryAcknowledgementAfterProjectRecord" in
      (await import("../../src/execution/recovery.ts")),
    false,
  );
});
