/**
 * coordinator:integration:development-execution-timingの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:development-execution-timingが所有する検証責務を実行する。
 * @trace PPR-IT-010
 * @level IT
 * @scope development、execution、timing
 * @boundary PPR-IT-010=Related 2 Blocks: Clock Source→実行記録→Projector
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  createDevelopmentExecutionTiming,
  writeDevelopmentMeasurementProgress,
} from "../../src/execution/diagnostics.ts";

/**
 * 契約外の非同期writerを表示成功へ昇格しないことを確認する。
 * @responsibility 即時・後着拒否を捕捉し、同期Boolean判定と表示失敗後の停止を維持する。
 * @trace PPR-IT-010
 * @precondition Process内の合成時計・writerだけを使用する。
 * @stimulus Promise成功、即時拒否、後着拒否、pendingを返す。
 * @observation 表示回数、計測区間、結果確定後のsnapshot。
 * @oracle Promiseは表示成功にならず、後着でも再表示・結果変更しない。
 * @cleanup N/A: 外部Effect・Timer・Listenerを生成しない。
 * @boundary 同期writer契約への不正な実装注入。
 */
test("非同期の進行表示は成功にせずRejectだけを捕捉する", async () => {
  for (const mode of ["resolve", "reject", "late_reject", "pending"] as const) {
    let calls = 0,
      time = 0;
    let rejectLate: ((error: Error) => void) | undefined;
    const invalidWriter = () => {
      calls++;
      if (mode === "resolve") return Promise.resolve(true);
      if (mode === "reject")
        return Promise.reject(Error("synthetic_progress_failure"));
      return new Promise<boolean>((_resolve, reject) => {
        if (mode === "late_reject") rejectLate = reject;
      });
    };
    const timing = createDevelopmentExecutionTiming(
      () => time++,
      // @ts-expect-error 同期Boolean契約に違反するwriterの負例。
      invalidWriter,
    );
    timing.observeLifecycleState("STATE-ADMISSION");
    timing.observeLifecycleState("STATE-TASK-AUTHORIZED");
    timing.finish();
    const result = timing.snapshot();
    assert.equal(calls, 1);
    assert.equal(result.progressOutputConfirmed, false);
    assert.equal(result.measurementComplete, true);
    rejectLate?.(Error("synthetic_late_progress_failure"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(timing.snapshot(), result);
    assert.equal(calls, 1);
  }
});

/**
 * 状態区間は非重複で、初期予約と最終候補処置も時間へ含めるを検証する。
 *
 * @responsibility 状態区間は非重複で、初期予約と最終候補処置も時間へ含めるの合否判定を所有する。
 * @trace PPR-IT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態区間は非重複で、初期予約と最終候補処置も時間へ含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-010=Direct Boundary: coordinator Test Source→対象契約
 */
test("状態区間は非重複で、初期予約と最終候補処置も時間へ含める", () => {
  let time = 0;
  const lines: string[] = [];
  const timing = createDevelopmentExecutionTiming(
    () => time,
    (line) => {
      lines.push(line);
      return true;
    },
  );
  time = 2;
  timing.observeLifecycleState("STATE-ADMISSION");
  time = 5;
  timing.observeLifecycleState("STATE-TASK-AUTHORIZED");
  time = 8;
  assert.equal(
    timing.measureIdentity(() => {
      time = 10;
      return "unchanged";
    }),
    "unchanged",
  );
  time = 15;
  timing.observeLifecycleState("STATE-RESULT-PUBLISHED");
  time = 20;
  timing.finish();
  const result = timing.snapshot();
  assert.deepEqual(
    result.intervals.map((row) => row.elapsedMs),
    [3, 10, 5],
  );
  assert.equal(result.initialUnattributedMs, 2);
  assert.equal(result.totalElapsedMs, 20);
  assert.equal(result.identityObservation.elapsedMs, 2);
  assert.equal(result.identityObservation.callCount, 1);
  assert.equal(lines.length, 3);
  timing.observeLifecycleState("STATE-RECOVERY-REQUIRED");
  timing.measureIdentity(() => null);
  timing.finish();
  assert.deepEqual(timing.snapshot(), result);
  assert.ok(Object.isFrozen(result.intervals));
  assert.ok(result.intervals.every(Object.isFrozen));
});

for (const fault of ["throw", "nan", "backward"] as const) {
  /**
   * 時計${fault}でも元observerの値・例外・呼出し回数を変えないを検証する。
   *
   * @responsibility 時計${fault}でも元observerの値・例外・呼出し回数を変えないの合否判定を所有する。
   * @trace PPR-IT-010
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 時計${fault}でも元observerの値・例外・呼出し回数を変えないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PPR-IT-010=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`時計${fault}でも元observerの値・例外・呼出し回数を変えない`, () => {
    let calls = 0;
    const timing = createDevelopmentExecutionTiming(() => {
      calls += 1;
      if (calls === 1) return 10;
      if (fault === "throw") throw new Error("secret_clock");
      return fault === "nan" ? NaN : 9;
    });
    let observationCount = 0;
    assert.equal(
      timing.measureIdentity(() => {
        observationCount++;
        return null;
      }),
      null,
    );
    const original = new Error("secret_observer");
    assert.throws(
      () =>
        timing.measureIdentity(() => {
          observationCount++;
          throw original;
        }),
      (error) => error === original,
    );
    timing.observeLifecycleState("STATE-ADMISSION");
    timing.finish();
    assert.equal(observationCount, 2);
    assert.equal(timing.snapshot().measurementComplete, false);
    assert.equal(timing.snapshot().identityObservation.elapsedMs, null);
    assert.equal(JSON.stringify(timing.snapshot()).includes("secret"), false);
  });
}

for (const mode of ["throw", "partial"] as const) {
  /**
   * 表示${mode}では再試行せず計測と状態遷移を継続するを検証する。
   *
   * @responsibility 表示${mode}では再試行せず計測と状態遷移を継続するの合否判定を所有する。
   * @trace PPR-IT-010
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 表示${mode}では再試行せず計測と状態遷移を継続するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PPR-IT-010=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`表示${mode}では再試行せず計測と状態遷移を継続する`, () => {
    let calls = 0;
    let time = 0;
    const timing = createDevelopmentExecutionTiming(
      () => time++,
      () => {
        calls++;
        if (mode === "throw") throw new Error("secret_output");
        return false;
      },
    );
    timing.observeLifecycleState("STATE-ADMISSION");
    timing.observeLifecycleState("STATE-ADMISSION");
    timing.observeLifecycleState("STATE-TASK-AUTHORIZED");
    timing.observeLifecycleState("STATE-BLOCKED-CLEAN");
    timing.finish();
    assert.equal(calls, 1);
    assert.equal(timing.snapshot().progressOutputConfirmed, false);
    assert.equal(timing.snapshot().measurementComplete, true);
    assert.equal(timing.snapshot().intervals.length, 3);
  });
}

/**
 * 未知状態・大量通知・任意文字列を公開しないを検証する。
 *
 * @responsibility 未知状態・大量通知・任意文字列を公開しないの合否判定を所有する。
 * @trace PPR-IT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未知状態・大量通知・任意文字列を公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-010=Direct Boundary: coordinator Test Source→対象契約
 */
test("未知状態・大量通知・任意文字列を公開しない", () => {
  const lines: string[] = [];
  const timing = createDevelopmentExecutionTiming(
    () => 1,
    (line) => {
      lines.push(line);
      return true;
    },
  );
  timing.observeLifecycleState("secret_path_token");
  for (let index = 0; index < 100; index++) {
    timing.observeLifecycleState(
      index % 2 ? "STATE-ADMISSION" : "STATE-TASK-AUTHORIZED",
    );
  }
  timing.finish();
  assert.equal(timing.snapshot().measurementComplete, false);
  assert.ok(timing.snapshot().intervals.length <= 32);
  assert.ok(lines.length <= 32);
  assert.ok(lines.every((line) => Buffer.byteLength(line) <= 256));
  assert.equal(lines.join("").includes("secret"), false);
  assert.equal(writeDevelopmentMeasurementProgress("secret_path_token"), false);
});

/**
 * 実子ProcessのUTF-8表示を同期結果へ投影するを検証する。
 *
 * @responsibility 実子ProcessのUTF-8表示を同期結果へ投影するの合否判定を所有する。
 * @trace PPR-IT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実子ProcessのUTF-8表示を同期結果へ投影するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-010=Direct Boundary: coordinator Test Source→対象契約
 */
test("実子ProcessのUTF-8表示を同期結果へ投影する", () => {
  const moduleUrl = new URL(
    "../../src/execution/diagnostics.ts",
    import.meta.url,
  ).href;
  const text = "[進行状況] 受付・実行条件の確認\n";
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {writeDevelopmentMeasurementProgress} from ${JSON.stringify(moduleUrl)}; const result = writeDevelopmentMeasurementProgress(${JSON.stringify(text)}); process.stdout.write(JSON.stringify(result));`,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(child.status, 0);
  assert.equal(child.stdout, "true");
  assert.equal(child.stderr, text);
});
