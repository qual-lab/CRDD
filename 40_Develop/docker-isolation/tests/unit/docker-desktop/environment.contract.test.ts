/**
 * 環境APIの薄い接続と観測の意味を有限代役で確認する。
 * @responsibility 要求・通知・取消・元結果の同一性と診断の非操作性を反証する。
 * @trace ERB-IT-014
 * @level UT
 * @scope Docker Isolationをメモリ代役へ置換し、実Docker・AI・保存領域へ接続しない。
 * @boundary この試験は実Desktopの成立根拠ではない。
 */
import assert from "node:assert/strict";
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

/**
 * 診断と再起動を同じ有限下位代役で区別する。
 * @responsibility 診断からの再起動0と再起動の無変換委譲を確認する。
 * @trace ERB-IT-014
 * @precondition 実APIをimportする前にDIを代役へ置換する。
 * @stimulus 全観測分類、cleanup不明、正常・取消・保存失敗の要求。
 * @observation 呼出し順、元入力・Promise・結果、例外の参照。
 * @oracle unknown・delivery・Signal・通知を補完・再構築しない。
 * @cleanup module mockを解除する。外部資源は作らない。
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
    ownerBindingSha256: null,
    scopeSha256: null,
  });
  const repaired = Promise.resolve(repairResult);
  let repairSupplied: RepairInput | null = null;
  const failure = new Error("synthetic_save_refused");
  let reject = false;
  const isolation = [
    mock.module("../../../src/docker-desktop/backend.ts", {
      namedExports: {
        observeDockerRuntimeBackendState: () => {
          calls.push("backend");
          return backend;
        },
      },
    }),
    mock.module("../../../src/docker-desktop/engine.ts", {
      namedExports: {
        observeDockerRuntimeEngine: () => {
          calls.push("engine");
          return engine;
        },
      },
    }),
    mock.module("../../../src/docker-desktop/restart.ts", {
      namedExports: {
        restartDockerRuntime: (input: RestartInput) => {
          calls.push("restart");
          supplied = input;
          return reject ? Promise.reject(failure) : pending;
        },
      },
    }),
    mock.module("../../../src/docker-desktop/repair-session.ts", {
      namedExports: {
        runDockerRuntimeRepairSession: (input: RepairInput) => {
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
          const observedResult = api.inspectDockerEnvironment();
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
        () => api.restartDockerEnvironment(invalid as never),
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
      api.restartDockerEnvironment({ mode: "restart", input: request }),
      pending,
    );
    assert.equal(supplied, request);
    assert.equal(await pending, result);
    controller.abort();
    assert.equal(
      api.restartDockerEnvironment({ mode: "restart", input: request }),
      pending,
    );
    assert.equal(supplied, request);
    assert.equal(request.signal.aborted, true);
    reject = true;
    await assert.rejects(
      api.restartDockerEnvironment({ mode: "restart", input: request }),
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
      api.restartDockerEnvironment({ mode: "repair", input: repair }),
      repaired,
    );
    assert.equal(repairSupplied, repair);
    assert.equal(repair.signal.aborted, true);
    assert.equal(await repaired, repairResult);
    assert.deepEqual(calls.slice(beforeRepair), ["repair"]);
    reject = true;
    await assert.rejects(
      api.restartDockerEnvironment({ mode: "repair", input: repair }),
      (error) => error === failure,
    );
    assert.equal(repairSupplied, repair);
  } finally {
    for (const lower of isolation) lower.restore();
  }
});
