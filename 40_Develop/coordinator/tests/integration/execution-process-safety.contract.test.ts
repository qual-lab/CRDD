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
import test from "node:test";

import {
  createExecutionProcessRecoveryIdentity,
  getExecutionProcessInstanceIdentity,
  inspectExecutionProcessRecoveryIdentity,
  poisonExecutionProcessAfterCleanupUnknown,
} from "../../src/lifecycle/host.ts";
import { startCoordinatorTask } from "../../src/lifecycle/execution.ts";

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
  const url = new URL("../../src/lifecycle/host.ts", import.meta.url).href;
  const observe = (body: string) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `import {isExecutionProcessPoisoned,poisonExecutionProcessAfterCleanupUnknown} from ${JSON.stringify(url)}; ${body}`,
        ],
        { encoding: "utf8", windowsHide: true },
      ),
    );
  assert.deepEqual(
    observe(`
      const initial = isExecutionProcessPoisoned();
      poisonExecutionProcessAfterCleanupUnknown();
      const stopped = isExecutionProcessPoisoned();
      poisonExecutionProcessAfterCleanupUnknown();
      process.stdout.write(JSON.stringify([initial, stopped, isExecutionProcessPoisoned()]));
    `),
    [false, true, true],
  );
  assert.equal(
    observe(
      "process.stdout.write(JSON.stringify(isExecutionProcessPoisoned()));",
    ),
    false,
  );
});

/**
 * execution_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別するを検証する。
 *
 * @responsibility execution_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus execution_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("execution_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別する", () => {
  const attemptId = "attempt-a";
  const operationId = "operation-a";
  const current = createExecutionProcessRecoveryIdentity(
    attemptId,
    operationId,
  );
  assert.equal(
    inspectExecutionProcessRecoveryIdentity(current, attemptId, operationId)
      ?.processIdentity,
    getExecutionProcessInstanceIdentity(),
  );
  assert.equal(
    inspectExecutionProcessRecoveryIdentity(current, "attempt-b", operationId),
    null,
  );
  assert.equal(
    inspectExecutionProcessRecoveryIdentity(
      current.replace(/.$/u, current.endsWith("0") ? "1" : "0"),
      attemptId,
      operationId,
    ),
    null,
  );
  const moduleUrl = new URL("../../src/lifecycle/host.ts", import.meta.url)
    .href;
  const fresh = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import {createExecutionProcessRecoveryIdentity} from ${JSON.stringify(moduleUrl)}; process.stdout.write(createExecutionProcessRecoveryIdentity(${JSON.stringify(attemptId)}, ${JSON.stringify(operationId)}));`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const inspectedFresh = inspectExecutionProcessRecoveryIdentity(
    fresh,
    attemptId,
    operationId,
  );
  assert.ok(inspectedFresh);
  assert.notEqual(
    inspectedFresh.processIdentity,
    getExecutionProcessInstanceIdentity(),
  );
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
  poisonExecutionProcessAfterCleanupUnknown();
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
    () => startCoordinatorTask(taskInput, "C:\\repository"),
    /coordinator_task_process_restart_required/u,
  );
  assert.equal(taskReads, 0);
  assert.throws(
    () => startCoordinatorTask(Object.freeze({}), "C:\\repository"),
    /coordinator_task_process_restart_required/u,
  );
});
