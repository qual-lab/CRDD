/**
 * 固定tree終端補助の合成Process境界。
 * @packageDocumentation
 * @responsibility OS環境とspawnを差し替えて実終了要求0で失敗点を確認する。
 * @trace ERB-IT-002
 * @level IT
 * @scope 固定引数・最小環境、開始、結果、close、期限。
 * @boundary 合成ChildProcess。実tree成立の根拠には使用しない。
 */
import assert from "node:assert/strict";
import { ChildProcess, spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { mock } from "node:test";

const scenario = process.argv[2];
assert.ok(
  [
    "normal",
    "nonzero",
    "signal",
    "error",
    "pending",
    "output",
    "closed",
    "environment",
    "late_closed",
  ].includes(String(scenario)),
);
const original = new ChildProcess();
Object.defineProperty(original, "pid", { value: 612345 });
const helper = new ChildProcess();
Object.defineProperty(helper, "pid", { value: 700001 });
helper.stdout = new PassThrough();
helper.stderr = new PassThrough();
let kills = 0;
helper.kill = () => {
  kills += 1;
  return true;
};
let requests = 0;
const environment = Object.freeze({
  SystemRoot: "C:\\Windows",
  PATH: "",
  NODE_OPTIONS: "",
});
const commonEnvironment = await import("../../src/process/environment.ts");
await mock.module(
  new URL("../../src/process/environment.ts", import.meta.url).href,
  {
    namedExports: {
      ...commonEnvironment,
      createInteractiveConsoleReaderEnvironment: () => {
        if (scenario === "late_closed")
          Object.defineProperty(original, "exitCode", { value: 0 });
        return scenario === "environment" ? null : environment;
      },
    },
  },
);
await mock.module("node:child_process", {
  namedExports: {
    ChildProcess,
    spawnSync,
    spawn: (
      executable: string,
      argv: string[],
      options: Record<string, unknown>,
    ) => {
      requests += 1;
      assert.equal(executable, "C:\\Windows\\System32\\taskkill.exe");
      assert.deepEqual(argv, ["/PID", "612345", "/T", "/F"]);
      assert.deepEqual(options, {
        shell: false,
        windowsHide: true,
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      queueMicrotask(() => {
        if (scenario === "error") {
          helper.emit("error", new Error("fixture"));
          return;
        }
        helper.emit("spawn");
        if (scenario === "pending") return;
        if (scenario === "output")
          helper.stdout?.emit("data", Buffer.alloc(65_537));
        helper.emit(
          "close",
          scenario === "nonzero" ? 1 : 0,
          scenario === "signal" ? "SIGTERM" : null,
        );
      });
      return helper;
    },
  },
});
const { startWindowsChildTreeTermination } = await import("../../src/index.ts");
if (scenario === "closed")
  Object.defineProperty(original, "exitCode", { value: 0 });
const handle = startWindowsChildTreeTermination(original);
if (["closed", "environment", "late_closed"].includes(String(scenario))) {
  assert.equal(handle, null);
  assert.equal(requests, 0);
} else {
  assert.ok(handle);
  assert.equal(requests, 1);
  assert.equal(await handle.started(100), scenario !== "error");
  const result = await handle.wait(scenario === "pending" ? 5 : 100);
  if (scenario === "pending") {
    assert.equal(result, null);
    assert.equal(handle.closed(), false);
    assert.equal(await handle.terminateAndWait(5), false);
    assert.equal(await handle.terminateAndWait(5), false);
    assert.equal(kills, 1);
    helper.emit("close", null, "SIGTERM");
    assert.equal(await handle.terminateAndWait(100), true);
  } else {
    assert.ok(result);
    assert.equal(
      result.status,
      scenario === "error" ? null : scenario === "nonzero" ? 1 : 0,
    );
    assert.equal(result.signal, scenario === "signal" ? "SIGTERM" : null);
    assert.equal(result.outputExceeded, scenario === "output");
    if (scenario === "output") {
      assert.equal(kills, 1);
      assert.ok(Buffer.byteLength(result.stdout) <= 64 * 1024);
      assert.ok(Buffer.byteLength(result.stderr) <= 64 * 1024);
      assert.equal(await handle.terminateAndWait(100), true);
      assert.equal(kills, 1);
    }
    assert.equal(handle.closed(), scenario !== "error");
    if (scenario === "error") {
      assert.equal(await handle.terminateAndWait(5), false);
      helper.emit("close", null, null);
      assert.equal(await handle.terminateAndWait(100), true);
    }
  }
  assert.equal(original.exitCode, null);
  assert.equal(original.signalCode, null);
  assert.equal(handle.closed(), true);
}
helper.stdout?.destroy();
helper.stderr?.destroy();
assert.equal(
  startWindowsChildTreeTermination({ pid: 612345 } as ChildProcess),
  null,
);
for (const pid of [0, Number.NaN]) {
  const invalid = new ChildProcess();
  Object.defineProperty(invalid, "pid", { value: pid });
  const requestsBefore: number = requests;
  assert.equal(startWindowsChildTreeTermination(invalid), null);
  assert.equal(requests, requestsBefore);
}
process.stdout.write(
  JSON.stringify({ scenario, requests, realTerminationIssued: false }),
);
