/**
 * coordinator:integration:runtime-process-safety-stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:runtime-process-safety-stateが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope runtime、process、safety、state
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  createRuntimeProcessRecoveryIdentity,
  createIsolatedRuntimeProcessSafetyStateCandidate,
  describeRuntimeProcessSafetyStateContract,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../../src/execution/process-safety-state.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/execution/controller.ts";

/**
 * 対話cleanup不明は同一Process stateを不可逆にpoisonするを検証する。
 *
 * @responsibility 対話cleanup不明は同一Process stateを不可逆にpoisonするの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 対話cleanup不明は同一Process stateを不可逆にpoisonするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("対話cleanup不明は同一Process stateを不可逆にpoisonする", () => {
  const firstProcess = createIsolatedRuntimeProcessSafetyStateCandidate();
  const restartedProcess = createIsolatedRuntimeProcessSafetyStateCandidate();
  assert.equal(firstProcess.isPoisoned(), false);
  firstProcess.poisonCleanupUnknown();
  assert.equal(firstProcess.isPoisoned(), true);
  firstProcess.poisonCleanupUnknown();
  assert.equal(firstProcess.isPoisoned(), true);
  assert.equal(restartedProcess.isPoisoned(), false);
});

/**
 * runtime_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別するを検証する。
 *
 * @responsibility runtime_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus runtime_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("runtime_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別する", () => {
  const attemptId = "attempt-a";
  const operationId = "operation-a";
  const current = createRuntimeProcessRecoveryIdentity(attemptId, operationId);
  assert.equal(
    inspectRuntimeProcessRecoveryIdentity(current, attemptId, operationId)
      ?.processIdentity,
    getRuntimeProcessInstanceIdentity(),
  );
  assert.equal(
    inspectRuntimeProcessRecoveryIdentity(current, "attempt-b", operationId),
    null,
  );
  assert.equal(
    inspectRuntimeProcessRecoveryIdentity(
      current.replace(/.$/u, current.endsWith("0") ? "1" : "0"),
      attemptId,
      operationId,
    ),
    null,
  );
  const moduleUrl = pathToFileURL(
    path.join(
      import.meta.dirname,
      "..",
      "..",
      "src",
      "execution",
      "process-safety-state.ts",
    ),
  ).href;
  const fresh = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import {createRuntimeProcessRecoveryIdentity} from ${JSON.stringify(moduleUrl)}; process.stdout.write(createRuntimeProcessRecoveryIdentity(${JSON.stringify(attemptId)}, ${JSON.stringify(operationId)}));`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const inspectedFresh = inspectRuntimeProcessRecoveryIdentity(
    fresh,
    attemptId,
    operationId,
  );
  assert.ok(inspectedFresh);
  assert.notEqual(
    inspectedFresh.processIdentity,
    getRuntimeProcessInstanceIdentity(),
  );
});

/**
 * Process poison契約は同期不可逆Gateとfresh Process境界を固定するを検証する。
 *
 * @responsibility Process poison契約は同期不可逆Gateとfresh Process境界を固定するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Process poison契約は同期不可逆Gateとfresh Process境界を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Process poison契約は同期不可逆Gateとfresh Process境界を固定する", () => {
  assert.deepEqual(describeRuntimeProcessSafetyStateContract(), {
    contract: "crdd-coordinator/runtime-process-safety-state",
    stateScope: "single_runtime_process_nonserialized",
    poisonTransition:
      "synchronous_irreversible_on_cleanup_unknown_observation_before_return_or_next_non_cleanup_await",
    poisonOrigins: [
      "interactive_console_cleanup_unknown",
      "host_operation_supervisor_cleanup_unknown",
      "signed_general_task_started_result_or_completion_unknown",
      "signed_route_matrix_started_or_outer_execution_unknown",
    ],
    guardedEntrypoints: ["coordinator_task_before_all_effects"],
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
});

/**
 * 回収不明のProcessはTask入力を読む前に再起動要求で拒否するを検証する。
 *
 * @responsibility 回収不明のProcessでTask入力読取り前の拒否が不可逆に維持されることを確認する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Cleanup不明の観測後にTaskの現在入口を繰り返し実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("回収不明のProcessはTask入力を読む前に再起動要求で拒否する", async () => {
  poisonRuntimeProcessAfterCleanupUnknown();
  let taskReads = 0;
  const taskInput = new Proxy(
    {},
    {
      get() {
        taskReads += 1;
        throw new Error("must_not_read");
      },
      ownKeys() {
        taskReads += 1;
        throw new Error("must_not_enumerate");
      },
      getOwnPropertyDescriptor() {
        taskReads += 1;
        throw new Error("must_not_inspect");
      },
    },
  );
  assert.throws(
    () => startRuntimeOwnedCoordinatorTask(taskInput, "C:\\repository"),
    /coordinator_task_process_restart_required/u,
  );
  assert.equal(taskReads, 0);
  assert.throws(
    () => startRuntimeOwnedCoordinatorTask(Object.freeze({}), "C:\\repository"),
    /coordinator_task_process_restart_required/u,
  );
});
