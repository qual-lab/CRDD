/**
 * coordinator:unit:docker-recovery-state-machineの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-recovery-state-machineが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、recovery、state、machine
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCleanupDirectoryState,
  classifyCommittedPairDeleteState,
  classifyCommittedPairMoveState,
  describeDockerRecoveryStateMachineContract,
  releaseRecoverySynchronizations,
} from "../../src/security/docker-recovery-state-machine.ts";

/**
 * delete state machineは到達可能3状態だけを回復するを検証する。
 *
 * @responsibility delete state machineは到達可能3状態だけを回復するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus delete state machineは到達可能3状態だけを回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("delete state machineは到達可能3状態だけを回復する", () => {
  assert.equal(classifyCommittedPairDeleteState(true, true), "remove_content");
  assert.equal(classifyCommittedPairDeleteState(false, true), "remove_commit");
  assert.equal(classifyCommittedPairDeleteState(false, false), "complete");
  assert.equal(classifyCommittedPairDeleteState(true, false), "third_state");
});

/**
 * move state machineは16組合せ中3状態だけを回復するを検証する。
 *
 * @responsibility move state machineは16組合せ中3状態だけを回復するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus move state machineは16組合せ中3状態だけを回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("move state machineは16組合せ中3状態だけを回復する", () => {
  const known = new Map([
    ["1100", "move_content"],
    ["0110", "move_commit"],
    ["0011", "complete"],
  ]);
  for (let bits = 0; bits < 16; bits += 1) {
    const values = [3, 2, 1, 0].map((shift) => Boolean(bits & (1 << shift)));
    const key = values.map(Number).join("");
    assert.equal(
      classifyCommittedPairMoveState(
        values[0] ?? false,
        values[1] ?? false,
        values[2] ?? false,
        values[3] ?? false,
      ),
      known.get(key) ?? "third_state",
      key,
    );
  }
});

/**
 * cleanup state machineは安全な完全削除とEvidence保持を分離するを検証する。
 *
 * @responsibility cleanup state machineは安全な完全削除とEvidence保持を分離するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup state machineは安全な完全削除とEvidence保持を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("cleanup state machineは安全な完全削除とEvidence保持を分離する", () => {
  assert.equal(
    classifyCleanupDirectoryState(true, false, false, 2),
    "remove_expected_entries",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, false, false, 0),
    "remove_directory",
  );
  assert.equal(
    classifyCleanupDirectoryState(false, false, false, 0),
    "complete",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, true, false, 2),
    "third_state",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, false, true, 2),
    "third_state",
  );
  assert.deepEqual(describeDockerRecoveryStateMachineContract(), {
    deleteKnownStates: ["remove_content", "remove_commit", "complete"],
    moveKnownStates: ["move_content", "move_commit", "complete"],
    cleanupSuccessResidue: 0,
    thirdStateTreatment: "preserve_evidence_and_fail_closed",
    lockReleaseTreatment: "attempt_all_and_report_first_failure",
  });
});

/**
 * lock release state machineは失敗後も全同期境界の解放を試すを検証する。
 *
 * @responsibility lock release state machineは失敗後も全同期境界の解放を試すの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus lock release state machineは失敗後も全同期境界の解放を試すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("lock release state machineは失敗後も全同期境界の解放を試す", () => {
  const attempts: string[] = [];
  assert.equal(
    releaseRecoverySynchronizations([
      {
        release: () => {
          attempts.push("runtime");
          throw new Error("fixture");
        },
        reason: "runtime_release_failed",
      },
      {
        release: () => {
          attempts.push("home");
          return false;
        },
        reason: "home_release_failed",
      },
      {
        release: () => {
          attempts.push("host");
          return true;
        },
        reason: "host_release_failed",
      },
    ]),
    "runtime_release_failed",
  );
  assert.deepEqual(attempts, ["runtime", "home", "host"]);
  assert.equal(releaseRecoverySynchronizations([]), null);
});
