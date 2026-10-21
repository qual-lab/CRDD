/**
 * docker-recovery-journalの保存状態判定を検証する。
 * @packageDocumentation
 * @responsibility 現在の保存Ownerが持つ純粋判定を全組合せと反例で確認する。
 * @trace PRL-UT-006
 * @level UT
 * @scope Coordinator保存状態の局所判定。
 * @boundary Process内の純粋判定。実保存・資源回収の証明ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCleanupDirectoryState,
  classifyCommittedPairDeleteState,
  classifyCommittedPairMoveState,
} from "../../../src/storage/docker-recovery-journal.ts";

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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const present of [false, true]) {
      assert.equal(
        classifyCleanupDirectoryState(present, false, false, count),
        "third_state",
      );
    }
  }
  assert.equal(
    classifyCleanupDirectoryState(false, true, false, 0),
    "third_state",
  );
  assert.equal(
    classifyCleanupDirectoryState(false, false, true, 0),
    "third_state",
  );
});
