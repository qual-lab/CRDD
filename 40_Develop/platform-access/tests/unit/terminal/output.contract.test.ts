/**
 * Windows端末出力の低層反証を所有する。
 * @packageDocumentation
 * @responsibility 既存System義務の端末技術部分をUnitで支援する。
 * @trace EST-UT-016
 * @level UT
 * @scope TTY出力、callback、stream error、Timeout、遅延通知。
 * @boundary EST-UT-016=Supporting Unit: 完全な同意・外部送信・System成立は確認しない。
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import test from "node:test";
import { writeWindowsTerminalTextOutcomeUsingStream } from "../../../src/terminal/output.ts";
/**
 * Outcomeを旧Boolean試験Oracleへ変換する。
 * @responsibility 試験本文の既存assertionを支援する。
 * @trace EST-UT-016
 * @precondition 同Packageのwriterへ固定streamを渡す。
 * @stimulus writerの完了を待つ。
 * @observation completedだけtrue。
 * @oracle 元の二Caseと同じBooleanを返す。
 * @cleanup writerが所有するlistenerとtimerの契約に従う。
 * @boundary EST-UT-016=Supporting Unit: 端末出力だけの補助確認。
 */
async function writeWindowsTerminalTextUsingStream(
  value: string,
  stream: Parameters<typeof writeWindowsTerminalTextOutcomeUsingStream>[1],
) {
  return (
    (await writeWindowsTerminalTextOutcomeUsingStream(value, stream)).status ===
    "completed"
  );
}

/**
 * Windows writerはwrite失敗とlistener cleanup不明を分離するを検証する。
 *
 * @responsibility Windows writerはwrite失敗とlistener cleanup不明を分離するの合否判定を所有する。
 * @trace EST-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows writerはwrite失敗とlistener cleanup不明を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Direct Boundary: PA Unit→writer（System義務の補助）
 */
test("Windows writerはwrite失敗とlistener cleanup不明を分離する", async (t) => {
  const keeper = setInterval(() => {}, 10_000);
  t.after(() => clearInterval(keeper));
  const outcome = await writeWindowsTerminalTextOutcomeUsingStream("value", {
    isTTY: true,
    destroyed: false,
    writable: true,
    once: () => undefined,
    removeListener: () => {
      throw new Error("fixture_listener_cleanup_failed");
    },
    write: (_value: string, callback: (error?: Error | null) => void) => {
      callback(null);
      return true;
    },
  });
  assert.deepEqual(outcome, { status: "cleanup_unknown" });

  let lateCallback: ((error?: Error | null) => void) | null = null;
  const lateEvents = new EventEmitter();
  const timedOut = await writeWindowsTerminalTextOutcomeUsingStream("value", {
    isTTY: true,
    destroyed: false,
    writable: true,
    once: (event, listener) => lateEvents.once(event, listener),
    removeListener: (event, listener) =>
      lateEvents.removeListener(event, listener),
    write: (_value: string, callback: (error?: Error | null) => void) => {
      lateCallback = callback;
      return true;
    },
  });
  assert.deepEqual(timedOut, { status: "cleanup_unknown" });
  assert.equal(lateEvents.listenerCount("error"), 1);
  assert.equal(typeof lateCallback, "function");
  (lateCallback as unknown as (error?: Error | null) => void)(null);
  assert.equal(lateEvents.listenerCount("error"), 1);
  lateEvents.emit("error", new Error("fixture_late_error"));
  assert.equal(lateEvents.listenerCount("error"), 0);
});

/**
 * Windows TTY writeのcallback・stream error・backpressureを一度だけ完了させるを検証する。
 *
 * @responsibility Windows TTY writeのcallback・stream error・backpressureを一度だけ完了させるの合否判定を所有する。
 * @trace EST-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows TTY writeのcallback・stream error・backpressureを一度だけ完了させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Direct Boundary: PA Unit→writer（System義務の補助）
 */
test("Windows TTY writeのcallback・stream error・backpressureを一度だけ完了させる", async () => {
  /**
   * streamScenarioのTest準備責務を実行する。
   *
   * @responsibility streamScenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace EST-UT-016
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus streamScenarioを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary EST-UT-016=Direct Boundary: PA Unit→writer（System義務の補助）
   */
  function streamScenario(
    outcome: "success" | "callback_error" | "stream_error" | "throw",
    isTTY = true,
  ) {
    let errorListener: (() => void) | null = null;
    let removeCount = 0;
    const values: string[] = [];
    const stream = Object.freeze({
      isTTY,
      destroyed: false,
      writable: true,
      once: (_event: "error", listener: () => void) => {
        errorListener = listener;
      },
      removeListener: (_event: "error", listener: () => void) => {
        if (errorListener === listener) errorListener = null;
        removeCount += 1;
      },
      write: (value: string, callback: (error?: Error | null) => void) => {
        values.push(value);
        if (outcome === "throw") throw new Error("write failed");
        setImmediate(() => {
          if (outcome === "stream_error") errorListener?.();
          else {
            callback(
              outcome === "callback_error"
                ? new Error("callback failed")
                : null,
            );
            if (outcome === "callback_error") {
              queueMicrotask(() => errorListener?.());
            }
          }
        });
        return false;
      },
    });
    return {
      stream,
      values,
      removeCount: () => removeCount,
      errorListener: () => errorListener,
    };
  }

  for (const [outcome, isExpected] of [
    ["success", true],
    ["callback_error", false],
    ["stream_error", false],
    ["throw", false],
  ] as const) {
    const scenario = streamScenario(outcome);
    assert.equal(
      await writeWindowsTerminalTextUsingStream(
        "外部送信を確認",
        scenario.stream,
      ),
      isExpected,
      outcome,
    );
    assert.deepEqual(scenario.values, ["外部送信を確認"]);
    assert.equal(scenario.removeCount(), 1);
    assert.equal(scenario.errorListener(), null);
  }

  const cleanupFailure = Object.freeze({
    isTTY: true,
    destroyed: false,
    writable: true,
    once: () => undefined,
    removeListener: () => {
      throw new Error("remove failed");
    },
    write: (_value: string, callback: (error?: Error | null) => void) => {
      setImmediate(() => callback(null));
      return true;
    },
  });
  assert.equal(
    await writeWindowsTerminalTextUsingStream("外部送信を確認", cleanupFailure),
    false,
  );

  const redirected = streamScenario("success", false);
  assert.equal(
    await writeWindowsTerminalTextUsingStream(
      "外部送信を確認",
      redirected.stream,
    ),
    false,
  );
  assert.deepEqual(redirected.values, []);

  const actualWritable = new Writable({
    write: (_chunk, _encoding, callback) => {
      callback(new Error("actual writable failure"));
    },
  });
  Object.defineProperty(actualWritable, "isTTY", { value: true });
  assert.equal(
    await writeWindowsTerminalTextUsingStream(
      "外部送信を確認",
      actualWritable as unknown as Parameters<
        typeof writeWindowsTerminalTextUsingStream
      >[1],
    ),
    false,
  );
  assert.equal(actualWritable.listenerCount("error"), 0);
});
