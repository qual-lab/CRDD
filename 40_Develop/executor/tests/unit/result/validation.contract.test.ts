/**
 * 回復応答の閉形式検査と元Home相関を反証する。
 * @responsibility 検査移管で欠測・余分・accessor・Proxyを許可へ変えない。
 * @trace ERB-IT-004
 * @level UT
 * @scope 合成値だけ。保存・回復処置は行わない。
 * @boundary Host応答とExecutorの受入。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTEMPT_COMPLETION_REASONS,
  PURPOSES,
  SETUP_COMMAND_FAILURE_REASONS,
  RECOVERY_START_FAILURE_STAGES,
} from "../../../src/result/constants.ts";
import {
  isAttemptFailureReason,
  isPrimaryFailureDiagnostic,
  snapshotReadyRecovery,
  snapshotBlockedRecoveryWithExactId,
} from "../../../src/result/validation.ts";
import { dockerProcessControllerPublicCompletionReasons } from "../../../../domain-model/src/index.ts";

/**
 * 発行する技術理由と保存受理する理由の集合をexact照合する。
 * @responsibility 片側追加・欠落・未知値を黙って受理しない。
 * @trace ERB-IT-004
 * @precondition 固定の二集合だけを使用する。
 * @stimulus 全要素と未知・大文字・欠測相当を検査する。
 * @observation 配列の一致と拒否結果。
 * @oracle 同じ順序・一意集合で、未知理由を正規化しない。
 * @cleanup N/A: 局所値だけ。
 * @boundary Executor発行とDomain保存受理。保存処理は呼ばない。
 */
/**
 * ターン数の不正報告診断をProvider側の現行条件へ照合する。
 * @responsibility 上限2を再導入せず、正常な報告を不正診断として受け付けない。
 * @trace ERB-IT-004
 * @precondition 非秘密の合成診断だけ。
 * @stimulus safe integer境界、小数、零、非canonical数値文字列。
 * @observation 診断の受理可否。
 * @oracle 不正報告の数値条件はsafe integerかつ1以上の否定と一致する。
 * @cleanup N/A: 外部資源なし。
 */
test("ターン不正診断は上限比較ではなく報告値の形式条件に一致する", () => {
  const diagnostic = {
    purpose: "start_provider_attached",
    stage: "provider_result_normalization",
    reason: "workbench_ai_claude_turn_count_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
    commandObservation: { exitCode: 0, stdoutBytes: 1, stderrBytes: 0 },
  };
  for (const [numberText, expected] of [
    ["1", false],
    ["3", false],
    ["100", false],
    ["1.5", true],
    ["0", true],
    ["-1", true],
    ["9007199254740992", true],
    ["01", false],
    ["1.0", false],
    ["NaN", false],
    ["Infinity", false],
  ] as const)
    assert.equal(
      isPrimaryFailureDiagnostic({
        ...diagnostic,
        turnCountDiagnostic: { valueType: "number", numberText },
      }),
      expected,
      numberText,
    );
});

test("技術理由は保存受理集合と一致し未知・欠測・余剰を拒否する", () => {
  for (const value of [
    ATTEMPT_COMPLETION_REASONS,
    PURPOSES,
    SETUP_COMMAND_FAILURE_REASONS,
    RECOVERY_START_FAILURE_STAGES,
  ])
    assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(
    Object.keys(SETUP_COMMAND_FAILURE_REASONS),
    PURPOSES.filter((purpose) => purpose !== "start_provider_attached"),
  );
  for (const reason of Object.values(SETUP_COMMAND_FAILURE_REASONS))
    assert.equal(isAttemptFailureReason(reason), true);
  assert.deepEqual(
    ATTEMPT_COMPLETION_REASONS,
    dockerProcessControllerPublicCompletionReasons,
  );
  assert.equal(
    new Set(ATTEMPT_COMPLETION_REASONS).size,
    ATTEMPT_COMPLETION_REASONS.length,
  );
  for (const reason of ATTEMPT_COMPLETION_REASONS)
    assert.equal(isAttemptFailureReason(reason), true);
  for (const reason of [
    null,
    undefined,
    "",
    "unknown",
    ...ATTEMPT_COMPLETION_REASONS.map((r) => r.toUpperCase()),
  ])
    assert.equal(isAttemptFailureReason(reason), false);
});

/**
 * 正常応答と不正な回復値を照合する。
 * @responsibility 原Capabilityとexact参照の結合を維持する。
 * @trace ERB-IT-004
 * @precondition 合成のHome hash・回復参照・不透明Capability。
 * @stimulus Owner有無、別Home、Proxy、accessor、余分・欠測を渡す。
 * @observation 所有Snapshot又はnull、getter未実行。
 * @oracle 同じ条件だけを受理し、観測不能を正常にしない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-IT-004=Direct Boundary: 回復応答検査。
 */
test("回復Snapshotは閉形式と元Homeを維持し不正な値を受理しない", () => {
  const home = "d".repeat(64);
  const id = `docker-task.${home}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const capability = {};
  const ready = {
    status: "ready",
    recoveryId: id,
    recoveryCapability: capability,
  };
  assert.equal(snapshotReadyRecovery(ready)?.recoveryCapability, capability);
  let getterCalls = 0;
  const accessor = {
    ...ready,
    get recoveryId() {
      getterCalls++;
      return id;
    },
  };
  for (const value of [
    null,
    [],
    { ...ready, extra: true },
    { ...ready, recoveryCapability: null },
    accessor,
  ])
    assert.equal(snapshotReadyRecovery(value), null);
  assert.equal(getterCalls, 0);
  const blocked = { status: "blocked", reason: "synthetic", recoveryId: id };
  assert.equal(
    snapshotBlockedRecoveryWithExactId(blocked, home)?.recoveryCapability,
    null,
  );
  const owned = {
    ...blocked,
    recoveryCapability: capability,
    manualRecoveryRequired: true,
  };
  assert.equal(
    snapshotBlockedRecoveryWithExactId(owned, home)?.recoveryCapability,
    capability,
  );
  assert.equal(snapshotBlockedRecoveryWithExactId(owned, "a".repeat(64)), null);
  for (const value of [
    new Proxy(blocked, {}),
    { ...blocked, extra: true },
    { ...blocked, recoveryId: "bad" },
    { ...owned, manualRecoveryRequired: false },
    { ...owned, recoveryCapability: new Proxy({}, {}) },
    { status: "blocked", recoveryId: id },
    {
      ...blocked,
      get reason() {
        getterCalls++;
        return "synthetic";
      },
    },
  ])
    assert.equal(snapshotBlockedRecoveryWithExactId(value, home), null);
  assert.equal(getterCalls, 0);
});
