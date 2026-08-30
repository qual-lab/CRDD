import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  createDevelopmentExecutionTiming,
  writeDevelopmentMeasurementProgress,
} from "../src/core/development-execution-timing.ts";

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

test("実子ProcessのUTF-8表示を同期結果へ投影する", () => {
  const moduleUrl = new URL(
    "../src/core/development-execution-timing.ts",
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
