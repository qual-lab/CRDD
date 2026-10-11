/**
 * 初回Host設定の四状態と新規開始条件を検証する。
 *
 * @packageDocumentation
 * @responsibility 観測分類の全組合せと不正値を公開Rootで確認し、物理観測の成立を主張しない。
 * @trace RFD-UT-023
 * @level UT
 * @scope access-management、初回状態、明示開始、次の処置
 * @boundary N/A: I/Oを持たない純粋判定だけを呼ぶ。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHostInitializationState } from "../../../src/index.ts";

/**
 * 管理観測四種・試行観測三種・明示開始二種の全24組を確認する。
 * @responsibility 開始候補、途中再観測、既存拒否、観測不能停止の相関を固定Oracleで検証する。
 * @trace RFD-UT-023
 * @precondition 観測分類を値として用意する。実File不在やLock取得の証明には使用しない。
 * @stimulus 公開Rootの判定へ全24組を渡す。
 * @observation state、canStart、nextActionの組合せを取得する。
 * @oracle 双方未初期化かつ明示開始だけ開始候補。同元試行の途中は再観測、既存は拒否、矛盾・不明は停止。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary N/A: 物理保存・Host・鍵発行へ接続しない。
 */
test("初回状態と明示開始の全24組合せ", () => {
  const rows = [
    ["uninitialized", "absent", "uninitialized"],
    ["uninitialized", "confirmed", "in_progress"],
    ["uninitialized", "unknown", "unknown"],
    ["same_attempt", "absent", "unknown"],
    ["same_attempt", "confirmed", "in_progress"],
    ["same_attempt", "unknown", "unknown"],
    ["existing", "absent", "existing"],
    ["existing", "confirmed", "unknown"],
    ["existing", "unknown", "unknown"],
    ["unknown", "absent", "unknown"],
    ["unknown", "confirmed", "unknown"],
    ["unknown", "unknown", "unknown"],
  ] as const;
  for (const [management, attempt, state] of rows) {
    for (const isStartRequested of [false, true]) {
      const canStart = state === "uninitialized" && isStartRequested;
      const nextAction =
        state === "uninitialized"
          ? canStart
            ? "start"
            : "await_explicit_start"
          : state === "in_progress"
            ? "observe_attempt"
            : state === "existing"
              ? "reject_initialization"
              : "stop";
      assert.deepEqual(
        evaluateHostInitializationState(management, attempt, isStartRequested),
        { state, canStart, nextAction },
      );
    }
  }
});

/**
 * 欠測・未知文字列・不正型を未初期化や明示開始へ変換しないことを確認する。
 * @responsibility 単一観測欠落やtruthy値による開始を拒否する。
 * @trace RFD-UT-023
 * @precondition 各引数の不正値を独立に用意する。
 * @stimulus 正常な他引数を保ち、各位置へ不正値を渡す。
 * @observation unknown・canStart false・stopの返却を確認する。
 * @oracle 不正値の位置やtruthy／falsyによらず新規開始を認めない。
 * @cleanup N/A: 入力値だけを使用する。
 * @boundary N/A: 外部状態を観測しない。
 */
test("欠測と未知値を開始条件へ丸めない", () => {
  const invalidValues = [
    undefined,
    null,
    "",
    "missing",
    "completed",
    0,
    1,
    {},
    [],
  ];
  const stopped = { state: "unknown", canStart: false, nextAction: "stop" };
  for (const value of invalidValues) {
    assert.deepEqual(
      evaluateHostInitializationState(value, "absent", true),
      stopped,
    );
    assert.deepEqual(
      evaluateHostInitializationState("uninitialized", value, true),
      stopped,
    );
    assert.deepEqual(
      evaluateHostInitializationState("uninitialized", "absent", value),
      stopped,
    );
  }
});

/**
 * 入力objectの変換を呼ばず、返却値を共有しないことを確認する。
 * @responsibility 任意callbackの発火と前回返却値による次判定への干渉を防ぐ。
 * @trace RFD-UT-023
 * @precondition 変換callbackの計数と二回の同じ正常判定を用意する。
 * @stimulus 不正objectを三引数へ別々に渡し、同じ正常値を再評価する。
 * @observation callback件数、二つの返却値の同一性と内容を確認する。
 * @oracle 変換callbackは0、不正値は停止、正常返却は同じ内容で別object。
 * @cleanup N/A: Test内の値以外に状態を保持しない。
 * @boundary N/A: Process・Filesystem・UUID・資格操作なし。
 */
test("入力の暗黙変換なし・返却値の非共有", () => {
  let calls = 0;
  const input = {
    [Symbol.toPrimitive]() {
      calls++;
      return "uninitialized";
    },
  };
  assert.equal(
    evaluateHostInitializationState(input, "absent", true).canStart,
    false,
  );
  assert.equal(
    evaluateHostInitializationState("uninitialized", input, true).canStart,
    false,
  );
  assert.equal(
    evaluateHostInitializationState("uninitialized", "absent", input).canStart,
    false,
  );
  assert.equal(calls, 0);
  const first = evaluateHostInitializationState(
    "uninitialized",
    "absent",
    true,
  );
  const second = evaluateHostInitializationState(
    "uninitialized",
    "absent",
    true,
  );
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
});
