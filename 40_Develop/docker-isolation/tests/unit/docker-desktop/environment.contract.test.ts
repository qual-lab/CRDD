/**
 * 環境APIの薄い接続と観測の意味を有限代役で確認する。
 * @responsibility 要求・通知・取消・元結果の同一性と診断の非操作性を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope Docker Isolationをメモリ代役へ置換し、実Docker・AI・保存領域へ接続しない。
 * @boundary この試験は実Desktopの成立根拠ではない。
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  captureIsolationSettings,
  type IsolationSettings,
} from "../../../src/docker-cli/environment.ts";
import test, { mock } from "node:test";
import type { BackendState } from "../../../src/docker-desktop/backend.ts";
import type { EngineObservation } from "../../../src/docker-desktop/engine.ts";

import type {
  RepairInput,
  RepairResult,
} from "../../../src/docker-desktop/repair-session.ts";
import type {
  RestartInput,
  RestartResult,
} from "../../../src/docker-desktop/restart.ts";
const ISOLATION_SETTINGS = Object.freeze({
  windowsDirectory: "C:\\Windows",
  userHomeDirectory: "C:\\Users\\test",
  desktop: Object.freeze({
    userDataDirectory: "C:\\Users\\test\\AppData\\Local",
  }),
});

/**
 * Desktopを選ばない共通設定から、修復の外部Effectが始まらないことを確認する。
 * @trace ERB-UT-023
 * @precondition 実Sourceの入口だけをメモリ内へ取り出す。
 * @stimulus Desktop設定なしの修復要求。
 * @observation 既存内部Runnerへの到達数と拒否理由。
 * @oracle 拒否はRunner・Artifact・Native取得より前。
 * @cleanup メモリだけ。実Process・Filesystem書込みなし。
 */
test("Desktop未設定の修復は内部取得前に拒否する", async () => {
  const source = readFileSync(
    new URL("../../../src/docker-desktop/repair-session.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf("export async function runRepairSession(");
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin > 0 && end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end)).replace(
    "export async function",
    "async function",
  );
  let effects = 0;
  const run = runInNewContext(`${body};runRepairSession`, {
    captureIsolationSettings,
    runRepairSessionWithDependencies: () => {
      effects++;
      throw Error("must not acquire");
    },
  }) as (input: unknown, settings: IsolationSettings) => Promise<unknown>;
  await assert.rejects(
    run(
      {},
      {
        windowsDirectory: "C:\\Windows",
        userHomeDirectory: "C:\\Users\\test",
      },
    ),
    /docker_desktop_settings_unavailable/u,
  );
  assert.equal(effects, 0);
});

/**
 * @trace ERB-UT-023
 * @precondition 公開資源入口の実本文をメモリで実行する。
 * @stimulus Directory観測・回収に同じ設定を渡す。
 * @observation 下位へ届く入力と設定の参照。
 * @oracle 再入場にも設定が無変換で届く。実I/Oなし。
 * @cleanup メモリだけ。
 */
test("Directoryの公開資源入口は明示Desktop設定を再入場へ搬送する", () => {
  for (const [file, name, lower] of [
    ["cleanup/resources.ts", "inspectIsolation", "observeRepairDirectories"],
    ["execution/operations.ts", "cleanupIsolation", "cleanupRepairDirectory"],
  ] as const) {
    const source = readFileSync(
      new URL(`../../../src/${file}`, import.meta.url),
      "utf8",
    );
    const begin = source.indexOf(`export function ${name}(`);
    const next = source.indexOf("\n/**", begin);
    assert.ok(begin >= 0);
    const body = stripTypeScriptTypes(
      source.slice(begin, next < 0 ? undefined : next),
    ).replaceAll("export function", "function");
    const input = {};
    const result = {};
    let calls = 0;
    const run = runInNewContext(`${body};${name}`, {
      types: { isProxy: () => false },
      [lower]: (received: unknown, settings: unknown) => {
        calls++;
        assert.equal(received, input);
        assert.equal(settings, ISOLATION_SETTINGS);
        return result;
      },
    }) as (request: unknown, settings: IsolationSettings) => unknown;
    assert.equal(
      run({ kind: "docker_runtime_directory", input }, ISOLATION_SETTINGS),
      result,
    );
    assert.equal(calls, 1);
  }
});

/**
 * @responsibility Desktop待機中に元設定を変更しても、受付時の共通所在・Desktop所在が固定されることを反証する。
 * @trace ERB-UT-023
 * @precondition 下位入口はメモリ代役。Native・Dockerを起動しない。
 * @stimulus 受付後・Machine構築前に元設定を変更する。
 * @observation Machineへ渡ったコピーとPromiseの元結果。
 * @oracle 共通所在・Desktop所在と凍結状態は受付時のまま。実Desktop操作の成立を主張しない。
 * @cleanup メモリだけ。
 */
test("Desktop操作は非同期待機前に共通所在とDesktop所在を固定する", async () => {
  const source = readFileSync(
    new URL("../../../src/docker-desktop/restart.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf("export function restartDesktop(");
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin > 0 && end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end))
    .replace("export function", "function")
    .replaceAll("import.meta.url", JSON.stringify(import.meta.url));
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received: IsolationSettings | null = null;
  const result = Object.freeze({ marker: "synthetic" });
  const restart = runInNewContext(`${body};restartDesktop`, {
    process: { platform: "win32" },
    captureIsolationSettings,
    createDockerRestartMachine: (settings: IsolationSettings) => {
      received = settings;
      return {};
    },
    restartDesktopForVerification: async (
      _input: unknown,
      dependencies: { createMachine: (...args: unknown[]) => unknown },
    ) => {
      await gate;
      dependencies.createMachine({}, () => true, new AbortController().signal);
      return result;
    },
  }) as (input: unknown, settings: IsolationSettings) => Promise<unknown>;
  const settings = {
    windowsDirectory: "C:\\Windows",
    userHomeDirectory: "C:\\Users\\test",
    desktop: { userDataDirectory: "C:\\Users\\test\\AppData\\Local" },
  };
  const pending = restart({}, settings);
  settings.windowsDirectory = "Z:\\changed";
  settings.userHomeDirectory = "Z:\\changed-home";
  settings.desktop.userDataDirectory = "Z:\\changed-data";
  release();
  assert.equal(await pending, result);
  assert.deepEqual(received, ISOLATION_SETTINGS);
  assert.ok(Object.isFrozen(received));
  assert.notEqual(received, settings);
  assert.ok(Object.isFrozen((received as IsolationSettings | null)?.desktop));
  assert.throws(
    () =>
      restart(
        {},
        {
          windowsDirectory: "C:\\Windows",
          userHomeDirectory: "C:\\Users\\test",
        },
      ),
    /docker_desktop_settings_unavailable/u,
  );
});

/**
 * 診断と再起動を同じ有限下位代役で区別する。
 * @responsibility 診断からの再起動0と再起動の無変換委譲を確認する。
 * @trace ERB-UT-023
 * @precondition 実APIをimportする前にDIを代役へ置換する。
 * @stimulus 全観測分類、cleanup不明、正常・取消・保存失敗の要求。
 * @observation 呼出し順、元入力・Promise・結果、例外の参照。
 * @oracle unknown・delivery・Signal・通知を補完・再構築しない。
 * @cleanup module mockを解除する。外部資源は作らない。
 * @boundary この試験は実Desktopの成立根拠ではない。
 */
test("環境診断は読取りのみ、再起動は元要求と元Promiseをそのまま委譲する", async () => {
  const calls: string[] = [];
  let backend: BackendState = "unknown";
  let engine: EngineObservation = {
    state: "unknown",
    cleanup: "unknown",
  };
  let supplied: RestartInput | null = null;
  const result: RestartResult = Object.freeze({
    requestId: "synthetic-request",
    status: "blocked",
    reason: "synthetic_unknown",
    request: "unknown",
    primaryFailure: "synthetic_unknown",
    stopFailure: null,
    startFailure: null,
    cleanupFailure: "docker_restart_cleanup_unconfirmed",
    cleanupConfirmed: false,
    restartCompleted: false,
    effectOutcomeUnknown: true,
    startupElapsedMs: null,
    delivery: "unknown",
  });
  const pending = Promise.resolve(result);
  const repairResult: RepairResult = Object.freeze({
    preparation: "boundary_unavailable",
    machine: null,
    lifecycle: null,
    checkpoint: null,
    finalCheckpointConfirmed: false,
  });
  const repaired = Promise.resolve(repairResult);
  let repairSupplied: RepairInput | null = null;
  const failure = new Error("synthetic_save_refused");
  let reject = false;
  const isolation = [
    mock.module("../../../src/docker-desktop/backend.ts", {
      namedExports: {
        observeBackendState: () => {
          calls.push("backend");
          return backend;
        },
      },
    }),
    mock.module("../../../src/docker-desktop/engine.ts", {
      namedExports: {
        observeDockerEngine: () => {
          calls.push("engine");
          return engine;
        },
      },
    }),
    mock.module("../../../src/docker-desktop/restart.ts", {
      namedExports: {
        restartDesktop: (input: RestartInput) => {
          calls.push("restart");
          supplied = input;
          return reject ? Promise.reject(failure) : pending;
        },
      },
    }),
    mock.module("../../../src/docker-desktop/repair-session.ts", {
      namedExports: {
        runRepairSession: (input: RepairInput) => {
          calls.push("repair");
          repairSupplied = input;
          return reject ? Promise.reject(failure) : repaired;
        },
      },
    }),
  ];
  try {
    const api = await import("../../../src/docker-desktop/operations.ts");
    for (const state of ["running", "stopped", "unknown"] as const) {
      backend = state;
      for (const observed of [
        "ready",
        "known_unavailable",
        "unknown",
      ] as const) {
        for (const cleanup of ["confirmed", "unknown"] as const) {
          calls.length = 0;
          engine = Object.freeze({ state: observed, cleanup });
          const observedResult =
            api.inspectDockerEnvironment(ISOLATION_SETTINGS);
          assert.equal(observedResult.backend, backend);
          assert.equal(observedResult.engine, engine);
          assert.ok(Object.isFrozen(observedResult));
          assert.deepEqual(calls, ["backend", "engine"]);
        }
      }
    }
    const before = calls.length;
    for (const invalid of [
      undefined,
      null,
      1,
      "restart",
      new Proxy(
        {},
        {
          get: () => {
            throw Error("unexpected_proxy_read");
          },
        },
      ),
      {},
      { mode: "other", input: {} },
      { mode: "repair" },
      { mode: "restart", input: {}, extra: true },
      {
        get mode() {
          throw Error("getter");
        },
        input: {},
      },
    ]) {
      assert.throws(
        () =>
          api.restartDockerEnvironment(invalid as never, ISOLATION_SETTINGS),
        /docker_environment_mode_invalid/,
      );
    }
    assert.equal(calls.length, before);
    const controller = new AbortController();
    const request: RestartInput = Object.freeze({
      requestId: result.requestId,
      signal: controller.signal,
      verifyBoundary: () => false,
      onRequesting: () => {
        throw failure;
      },
      onEvent: () => undefined,
    });
    assert.equal(
      api.restartDockerEnvironment(
        { mode: "restart", input: request },
        ISOLATION_SETTINGS,
      ),
      pending,
    );
    assert.equal(supplied, request);
    assert.equal(await pending, result);
    controller.abort();
    assert.equal(
      api.restartDockerEnvironment(
        { mode: "restart", input: request },
        ISOLATION_SETTINGS,
      ),
      pending,
    );
    assert.equal(supplied, request);
    assert.equal(request.signal.aborted, true);
    reject = true;
    await assert.rejects(
      api.restartDockerEnvironment(
        { mode: "restart", input: request },
        ISOLATION_SETTINGS,
      ),
      (error) => error === failure,
    );
    assert.equal(supplied, request);
    reject = false;
    const repair: RepairInput = Object.freeze({
      operationNonce: "a".repeat(64),
      signal: controller.signal,
      resume: null,
      canIssueEffect: () => false,
      onPrepared: () => undefined,
      onCheckpoint: () => undefined,
    });
    const beforeRepair = calls.length;
    assert.equal(
      api.restartDockerEnvironment(
        { mode: "repair", input: repair },
        ISOLATION_SETTINGS,
      ),
      repaired,
    );
    assert.equal(repairSupplied, repair);
    assert.equal(repair.signal.aborted, true);
    assert.equal(await repaired, repairResult);
    assert.deepEqual(calls.slice(beforeRepair), ["repair"]);
    reject = true;
    await assert.rejects(
      api.restartDockerEnvironment(
        { mode: "repair", input: repair },
        ISOLATION_SETTINGS,
      ),
      (error) => error === failure,
    );
    assert.equal(repairSupplied, repair);
  } finally {
    for (const lower of isolation) lower.restore();
  }
});
