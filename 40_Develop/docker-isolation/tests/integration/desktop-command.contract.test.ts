/**
 * 公式CLI単発処理の実本文を有限Process・Lock代役へ接続する。
 * @responsibility argv、期限、発行、close、取消、排他解放を区別する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Docker・実Native・外部AI・実Filesystem変更なし。
 * @boundary DIのCLI操作本文→既存Process Owner／wx取得の有限代役。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { getEventListeners } from "node:events";
import test from "node:test";
import { parseDesktopStatus } from "../../src/docker-desktop/command.ts";
import type { acquireDesktopOperations } from "../../src/docker-desktop/command.ts";
import type { OwnedCommandHandle } from "../../src/process/start.ts";

function fixture(fault = "") {
  const controller = new AbortController();
  let releases = 0,
    stops = 0,
    closed = false;
  const calls: { argv: readonly string[]; timeout: number | null }[] = [];
  const releaseArguments: (boolean | undefined)[] = [];
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/docker-desktop/command.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace(/^export /gmu, "");
  const acquire = runInNewContext(source + "\nacquireDesktopOperations", {
    path,
    process: { platform: "win32" },
    observeTrustedDesktopCli: () => ({
      executablePath:
        "C:\\Program Files\\Docker\\Docker\\resources\\cli-plugins\\docker-desktop.exe",
    }),
    verifyTrustedDesktopCliSnapshot: () => {},
    fs: {
      lstatSync: () => ({
        isFile: () => true,
        isSymbolicLink: () => false,
        ino: 1n,
        dev: 2n,
        birthtimeNs: 3n,
        size: 4n,
        mtimeNs: 5n,
      }),
      realpathSync: { native: (value: string) => value },
    },
    acquireLock(request: {
      directory: string;
      name: string;
      identity: string;
    }) {
      assert.equal(request.directory, "C:\\configured-local");
      assert.equal(request.name, "docker-isolation.desktop.lock");
      assert.equal(request.identity, "docker-desktop:shared");
      if (fault === "lock" || fault === "lock-cleanup")
        return {
          status: "blocked",
          cleanupConfirmed: fault !== "lock-cleanup",
          descriptorClosed: true,
        };
      return {
        status: "acquired",
        lock: {
          assertLive: () => fault !== "lost",
          release(retainFile?: boolean) {
            releases++;
            releaseArguments.push(retainFile);
            return fault !== "release";
          },
        },
      };
    },
    createDesktopCommandEnvironment: () => ({
      fixed: "environment",
    }),
    startOwnedWindowsProcess(
      executable: string,
      argv: readonly string[],
      environment: object,
      stdin: unknown,
      options: object,
    ) {
      assert.equal(
        executable,
        "C:\\Program Files\\Docker\\Docker\\resources\\cli-plugins\\docker-desktop.exe",
      );
      assert.deepEqual(Object.keys(environment), ["fixed"]);
      assert.equal(stdin, null);
      assert.equal(
        (options as { stdoutLimitBytes: number }).stdoutLimitBytes,
        16384,
      );
      const entry = { argv: Array.from(argv), timeout: null as number | null };
      calls.push(entry);
      const handle: OwnedCommandHandle = {
        started: async () => true,
        closed: () => closed,
        terminateAndWait: async () => {
          stops++;
          closed = fault !== "close";
          return closed;
        },
        wait: async (timeout) => {
          entry.timeout = timeout;
          if (fault === "cancel") return new Promise(() => {});
          closed = fault !== "close";
          return {
            status: fault === "exit" ? 1 : 0,
            signal: null,
            stdout: fault === "status" ? "{}" : '{"Status":"stopped"}',
            stderr: "",
            outputExceeded: fault === "output",
          };
        },
      };
      return handle;
    },
    finishOwnedProcess: async (
      handle: OwnedCommandHandle,
      result: unknown,
    ) => ({
      result,
      closed: handle.closed() || (await handle.terminateAndWait(5000)),
    }),
  }) as typeof acquireDesktopOperations;
  const acquired = acquire(
    {
      windowsDirectory: "C:\\Windows",
      userHomeDirectory: "C:\\user",
      desktop: { userDataDirectory: "C:\\configured-local" },
    },
    controller.signal,
  );
  return {
    acquired,
    controller,
    calls,
    releases: () => releases,
    releaseArguments,
    stops: () => stops,
  };
}

test("statusは既知の二状態だけを受理し、曖昧値をstoppedにしない", () => {
  assert.equal(parseDesktopStatus('{"Status":"stopped"}'), "stopped");
  assert.equal(parseDesktopStatus('{"status":"running"}'), "running");
  for (const output of [
    "",
    "stopped",
    "{}",
    "null",
    "[]",
    '{"Status":"unknown"}',
    '{"Status":"stopped","extra":1}',
  ])
    assert.equal(parseDesktopStatus(output), "unknown");
});
test("固定CLIの同期stop/status/startと有界出力・closeを保持する", async () => {
  const f = fixture();
  const operations = f.acquired.operations;
  assert.ok(operations);
  assert.equal((await operations.command("stop")).completed, true);
  assert.equal((await operations.command("status")).status, "stopped");
  assert.equal((await operations.command("start")).completed, true);
  assert.deepEqual(
    f.calls.map((v) => v.argv),
    [
      ["desktop", "stop", "--timeout", "30"],
      ["desktop", "status", "--format", "json"],
      ["desktop", "start", "--detach"],
    ],
  );
  assert.deepEqual(
    f.calls.map((v) => v.timeout),
    [35000, 5000, 35000],
  );
  assert.equal(await operations.close(), true);
  assert.equal(await operations.close(), true);
  assert.equal(f.releases(), 1);
  assert.deepEqual(f.releaseArguments, [undefined]);
  assert.equal(getEventListeners(f.controller.signal, "abort").length, 0);
});
for (const fault of ["exit", "output", "close", "lost", "release", "status"]) {
  test("CLI・出力・close・排他の不明を成功へ変えない: " + fault, async () => {
    const f = fixture(fault);
    const operations = f.acquired.operations;
    assert.ok(operations);
    const result = await operations.command("status");
    if (fault !== "release" && fault !== "status")
      assert.equal(result.completed, false);
    if (fault === "status") assert.equal(result.status, "unknown");
    const cleanup = await operations.close();
    if (fault === "close" || fault === "release") assert.equal(cleanup, false);
    if (fault === "close") assert.equal(f.releases(), 1);
    assert.deepEqual(f.releaseArguments, [
      fault === "close" ? true : undefined,
    ]);
    assert.equal(getEventListeners(f.controller.signal, "abort").length, 0);
  });
}
test("取消は元CLIだけを停止・close確認し、後続要求を発行しない", async () => {
  const f = fixture("cancel");
  const operations = f.acquired.operations;
  assert.ok(operations);
  const running = operations.command("stop");
  f.controller.abort();
  assert.equal((await running).completed, false);
  assert.equal(await operations.close(), true);
  assert.equal((await operations.command("start")).issued, false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.stops(), 1);
});
test("Lock残存と取得途中清掃不明を区別する", () => {
  const existing = fixture("lock");
  assert.equal(existing.acquired.operations, null);
  assert.equal(existing.acquired.cleanupConfirmed, true);
  const unknown = fixture("lock-cleanup");
  assert.equal(unknown.acquired.operations, null);
  assert.equal(unknown.acquired.cleanupConfirmed, false);
});
