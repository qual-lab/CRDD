/**
 * Engine状態分類とpipe観測の境界を確認する。
 * @packageDocumentation
 * @responsibility 旧三Caseの判定内容を維持してDocker技術Ownerへ接続する。
 * @trace ERB-IT-001
 * @trace ERB-IT-014
 * @level IT
 * @scope 固定Process結果とpipe故障差替え。実Docker・Provider操作0。
 * @boundary 固定結果分類と差替えpipeの局所境界。実環境成立を主張しない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  awaitDockerRepairEngine,
  type DockerRepairEngineObservation,
  DOCKER_ENGINE_STARTUP_WAIT_MS,
} from "../../src/index.ts";
import { awaitDockerRepairEngineUsing } from "../../src/desktop/engine-state.ts";
import {
  isDockerEngineReady,
  observeDockerEnginePipe,
  classifyDockerEngineResult,
} from "../../src/desktop/engine-state.ts";

/**
 * 再起動・構成付き修復・Desktop修復の固定観測を確認する。
 * @responsibility 三用途の差と停止条件を各固定入口から反証する。
 * @trace ERB-IT-001
 * @trace ERB-IT-014
 * @precondition 別Nodeで実Process・Publisher・pipe境界を差し替える。
 * @stimulus 三用途へ正常・不存在・close故障・Timeout・Signal・構成不能・出所変化・未対応を与える。
 * @observation 固定argv・環境・容量・期限・要求件数と共通結果。
 * @oracle 開始前拒否は要求0、出所後変化はready禁止、明示不存在だけ既知未起動、close故障はcleanup unknown。
 * @cleanup 同期fixture子の終了を確認。実Docker・Provider・Host pipeは使用しない。
 * @boundary 公開Rootと合成外部境界。実環境の成立とは区別する。
 */
test("Engine固定三用途は設定差と出所変化・回収不明を保持する", () => {
  for (const purpose of ["runtime", "repair", "desktop_repair"])
    for (const scenario of [
      "ready",
      "absent",
      "present",
      "pipe-fault",
      "close-fault",
      "timeout",
      "signal",
      "environment",
      "publisher-before",
      "publisher-after",
      "unsupported",
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          fileURLToPath(
            new URL("../fixtures/engine-state.ts", import.meta.url),
          ),
          purpose,
          scenario,
        ],
        {
          shell: false,
          windowsHide: true,
          encoding: "utf8",
          timeout: 5_000,
          maxBuffer: 64 * 1024,
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).realDockerIssued, false);
    }
  for (const purpose of ["runtime", "repair", "desktop_repair"])
    for (const scenario of ["present", "close-fault"]) {
      const rejected = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          fileURLToPath(
            new URL("../fixtures/engine-state.ts", import.meta.url),
          ),
          purpose,
          scenario,
          "wrong-close",
        ],
        {
          shell: false,
          windowsHide: true,
          encoding: "utf8",
          timeout: 5_000,
          maxBuffer: 64 * 1024,
        },
      );
      assert.equal(rejected.error, undefined);
      assert.equal(rejected.signal, null);
      assert.equal(rejected.status, 1);
      assert.match(rejected.stderr, /engine_close_handle_oracle_rejected/u);
    }
});

/**
 * Engine reply requires a successful Linux server result, not arbitrary JSONを検証する。
 *
 * @responsibility Engine reply requires a successful Linux server result, not arbitrary JSONの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Engine reply requires a successful Linux server result, not arbitrary JSONの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: docker-isolation Engine観測→固定結果／pipe故障差替え
 */
test("Engine reply requires a successful Linux server result, not arbitrary JSON", () => {
  const result = {
    status: 0,
    signal: null,
    stderr: "",
    stdout: JSON.stringify({
      Os: "linux",
      Arch: "amd64",
      Version: "29.1.0",
      ApiVersion: "1.52",
    }),
  };
  assert.equal(isDockerEngineReady(result), true);
  for (const stdout of [
    "{}",
    "null",
    JSON.stringify({
      Os: "windows",
      Arch: "amd64",
      Version: "29.1.0",
      ApiVersion: "1.52",
    }),
    JSON.stringify({
      Os: "linux",
      Arch: "amd64",
      Version: "anything",
      ApiVersion: "1.52",
    }),
  ])
    assert.equal(isDockerEngineReady({ ...result, stdout }), false);
  assert.equal(isDockerEngineReady({ ...result, status: 1 }), false);
  assert.equal(isDockerEngineReady({ ...result, stderr: "warning" }), false);
});

/**
 * Engine observation distinguishes known unavailability from unknown failureを検証する。
 *
 * @responsibility Engine observation distinguishes known unavailability from unknown failureの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Engine observation distinguishes known unavailability from unknown failureの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: docker-isolation Engine観測→固定結果／pipe故障差替え
 */
test("Engine observation distinguishes known unavailability from unknown failure", () => {
  const unavailable = {
    pid: 1,
    status: 1,
    signal: null,
    stderr: "connection failed",
    stdout: "",
  };
  assert.equal(
    classifyDockerEngineResult(unavailable, () => ({
      state: "absent",
      cleanup: "confirmed",
    })).state,
    "known_unavailable",
  );
  for (const stdout of ["null", "null\n", "null\r\n"]) {
    assert.equal(
      classifyDockerEngineResult({ ...unavailable, stdout }, () => ({
        state: "absent",
        cleanup: "confirmed",
      })).state,
      "known_unavailable",
    );
  }
  assert.equal(
    classifyDockerEngineResult({ ...unavailable, stdout: "{}" }, () => ({
      state: "absent",
      cleanup: "confirmed",
    })).state,
    "unknown",
  );
  assert.equal(
    classifyDockerEngineResult(unavailable, () => ({
      state: "present",
      cleanup: "confirmed",
    })).state,
    "unknown",
  );
  assert.equal(
    classifyDockerEngineResult(unavailable, () => ({
      state: "unknown",
      cleanup: "confirmed",
    })).state,
    "unknown",
  );
  assert.equal(
    classifyDockerEngineResult(
      { ...unavailable, error: new Error("timeout") },
      () => ({ state: "absent", cleanup: "confirmed" }),
    ).state,
    "unknown",
  );
});

/**
 * Docker初回起動中のCLI TimeoutはHost操作を再発行せず期限内で再観測するを検証する。
 *
 * @responsibility Docker初回起動中の一時Timeout、期限超過、取消の待機契約を検証する。
 * @trace ERB-IT-014
 * @precondition 決定論的な時計、待機、Engine観測を使用する。
 * @stimulus awaitDockerRepairEngineUsingを実行する。
 * @observation 観測回数、待機時間および最終状態を取得する。
 * @oracle 一時Timeoutは再観測され、全体期限超過と取消は別の状態へ収束する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-IT-014=Direct Boundary: Docker Isolation Test Source→対象契約
 */
test("Docker初回起動中のCLI TimeoutはHost操作を再発行せず期限内で再観測する", async () => {
  const rootInputIsObservation: ReturnType<
    Parameters<typeof awaitDockerRepairEngine>[0]
  > extends DockerRepairEngineObservation["state"]
    ? true
    : false = true;
  const internalInputIsObservation: ReturnType<
    Parameters<typeof awaitDockerRepairEngineUsing>[0]
  > extends DockerRepairEngineObservation["state"]
    ? true
    : false = true;
  assert.equal(rootInputIsObservation, true);
  assert.equal(internalInputIsObservation, true);
  let now = 0;
  let observations = 0;
  const neverStops = new Promise<void>(() => undefined);
  const ready = await awaitDockerRepairEngineUsing(
    () => {
      observations += 1;
      return observations < 3 ? "transient_unavailable" : "ready";
    },
    () => false,
    neverStops,
    {
      now: () => now,
      sleep: async (milliseconds) => {
        now += milliseconds;
      },
      timeoutMs: 180_000,
      pollIntervalMs: 1_000,
    },
  );
  assert.equal(ready, "ready");
  assert.equal(observations, 3);
  assert.equal(now, 2_000);

  now = 0;
  observations = 0;
  const timedOut = await awaitDockerRepairEngineUsing(
    () => {
      observations += 1;
      return "transient_unavailable";
    },
    () => false,
    neverStops,
    {
      now: () => now,
      sleep: async (milliseconds) => {
        now += milliseconds;
      },
      timeoutMs: 3_000,
      pollIntervalMs: 1_000,
    },
  );
  assert.equal(timedOut, "startup_timeout");
  assert.equal(observations, 4);

  let isStopped = false;
  observations = 0;
  const cancelled = await awaitDockerRepairEngineUsing(
    () => {
      observations++;
      return "known_unavailable";
    },
    () => isStopped,
    neverStops,
    {
      now: () => 0,
      sleep: async () => {
        isStopped = true;
      },
      timeoutMs: 180_000,
    },
  );
  assert.equal(cancelled, "unknown");
  assert.equal(observations, 1);
  observations = 0;
  assert.equal(
    await awaitDockerRepairEngineUsing(
      () => {
        observations++;
        return "ready";
      },
      () => true,
      neverStops,
    ),
    "unknown",
  );
  assert.equal(observations, 0);
  assert.equal(
    await awaitDockerRepairEngine(
      () => "unknown",
      () => false,
      neverStops,
    ),
    "unknown",
  );
  assert.equal(
    await awaitDockerRepairEngine(
      () => "ready",
      () => false,
      neverStops,
    ),
    "ready",
  );
  assert.equal(DOCKER_ENGINE_STARTUP_WAIT_MS, 180_000);
});

/**
 * Engine pipe observation treats only explicit absence as absentを検証する。
 *
 * @responsibility Engine pipe observation treats only explicit absence as absentの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Engine pipe observation treats only explicit absence as absentの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: docker-isolation Engine観測→固定結果／pipe故障差替え
 */
test("Engine pipe observation treats only explicit absence as absent", () => {
  /**
   * failureのTest準備責務を実行する。
   *
   * @responsibility failureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-014
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus failureを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Direct Boundary: docker-isolation Engine観測→固定結果／pipe故障差替え
   */
  const failure = (code?: string) => {
    const error = new Error(code ?? "generic failure") as NodeJS.ErrnoException;
    error.code = code;
    return error;
  };
  assert.equal(
    observeDockerEnginePipe(() => {
      throw failure("ENOENT");
    }).state,
    "absent",
  );
  for (const code of ["EACCES", "EPERM", "EMFILE", "ENFILE", undefined])
    assert.equal(
      observeDockerEnginePipe(() => {
        throw failure(code);
      }).state,
      "unknown",
      code ?? "generic",
    );
  assert.equal(
    observeDockerEnginePipe(
      () => 1,
      () => {},
    ).state,
    "present",
  );
  assert.equal(
    observeDockerEnginePipe(
      () => 1,
      () => {
        throw failure("EIO");
      },
    ).state,
    "unknown",
  );
  assert.equal(
    observeDockerEnginePipe(
      () => 1,
      () => {
        throw failure("EIO");
      },
    ).cleanup,
    "unknown",
  );
});
