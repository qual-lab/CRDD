/**
 * coordinator:integration:docker-restart-machineの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-restart-machineが所有する検証責務を実行する。
 * @trace ERB-IT-014
 * @level IT
 * @scope docker、restart、machine
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartMachineForVerification,
  isDockerRestartEngineReady,
  observeDockerRestartEnginePipe,
  observeDockerRestartEngineResult,
} from "../../src/security/docker-restart-machine.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
function fixture(change: string = "") {
  const events: string[] = [];
  let isBoundaryLive = true;
  const controller = new AbortController();
  let wsl: "running" | "stopped" | "unknown" =
    change === "idle" ? "stopped" : "running";
  let engine: "ready" | "known_unavailable" | "unknown" =
    change === "engine-observation" || change === "engine-cleanup"
      ? "unknown"
      : "ready";
  let processes: "verified" | "absent" = "verified";
  const session = {
    assertLive: () => change !== "dead",
    verifyArtifacts: async () =>
      change === "artifact" ? ("unknown" as const) : ("verified" as const),
    inspectClientProcesses: async () =>
      change === "client" ? ("verified" as const) : ("absent" as const),
    inspectProcesses: async () => processes,
    stopDesktop: async () => {
      events.push("S");
      if (change === "unissued") return "not_issued" as const;
      if (change === "terminate") return "outcome_unknown" as const;
      if (change !== "residual" && !change.startsWith("delayed")) {
        processes = "absent";
        wsl = "stopped";
        if (change !== "engine-still-ready") engine = "known_unavailable";
      }
      return "command_completed" as const;
    },
    terminateProcesses: async () => {
      events.push("K");
      processes = "absent";
      return "terminated" as const;
    },
    launchDesktop: async () => {
      events.push("L");
      if (change !== "non-wsl") wsl = "running";
      engine = change === "engine" ? "unknown" : "ready";
      return "started" as const;
    },
    release: async () => {
      events.push("Q");
      return { cleanup: "confirmed" as const, protocol: "completed" as const };
    },
    abort: async () => ({
      cleanup: "confirmed" as const,
      protocol: "not_applicable" as const,
    }),
    failureDetected: new Promise<void>(() => {}),
    onFailureDetected: () => () => {},
  };
  const machine = createDockerRestartMachineForVerification({
    session,
    boundary: () => isBoundaryLive,
    signal: controller.signal,
    observeWsl: () => (change === "wsl" ? "unknown" : wsl),
    observeEngine: () =>
      change === "engine-cleanup"
        ? { state: engine, cleanup: "unknown" as const }
        : engine,
    containersAbsent: () => change !== "containers",
    now: () => 0,
    wait: async () => {
      if (!change.startsWith("delayed")) return;
      events.push("wait");
      if (change === "delayed-cancel") controller.abort();
      if (change === "delayed-lock") isBoundaryLive = false;
      if (change === "delayed-exit") {
        processes = "absent";
        wsl = "stopped";
        engine = "known_unavailable";
      }
    },
  });
  return {
    machine,
    events,
    session,
    loseBoundary: () => {
      isBoundaryLive = false;
    },
    controller,
  };
}

/**
 * official stop waits for delayed process exit without reissuing stopを検証する。
 *
 * @responsibility official stop waits for delayed process exit without reissuing stopの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus official stop waits for delayed process exit without reissuing stopの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("official stop waits for delayed process exit without reissuing stop", async () => {
  const f = fixture("delayed-exit");
  assert.equal(await f.machine.stop(), "stopped");
  assert.deepEqual(f.events, ["S", "wait"]);
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  await f.machine.release();
});

for (const reason of ["delayed-timeout", "delayed-cancel", "delayed-lock"]) {
  /**
   * post-stop observation ${reason} remains bounded and unknownを検証する。
   *
   * @responsibility post-stop observation ${reason} remains bounded and unknownの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus post-stop observation ${reason} remains bounded and unknownの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`post-stop observation ${reason} remains bounded and unknown`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.events.filter((event) => event === "S").length, 1);
    assert.equal(
      f.events.filter((event) => event === "wait").length,
      reason === "delayed-timeout" ? 29 : 1,
    );
    assert.equal(f.machine.getEffectOutcomeUnknown(), true);
    await f.machine.release();
  });
}

for (const reason of [
  "dead",
  "artifact",
  "client",
  "wsl",
  "engine-observation",
  "containers",
  "unissued",
]) {
  /**
   * pre-effect refusal ${reason} does not claim unknown issued effectを検証する。
   *
   * @responsibility pre-effect refusal ${reason} does not claim unknown issued effectの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus pre-effect refusal ${reason} does not claim unknown issued effectの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`pre-effect refusal ${reason} does not claim unknown issued effect`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getEffectOutcomeUnknown(), false);
    await f.machine.release();
  });
}

for (const reason of ["terminate", "residual"]) {
  /**
   * issued stop ${reason} preserves unknown effectを検証する。
   *
   * @responsibility issued stop ${reason} preserves unknown effectの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus issued stop ${reason} preserves unknown effectの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`issued stop ${reason} preserves unknown effect`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getEffectOutcomeUnknown(), true);
    await f.machine.release();
  });
}

/**
 * start precondition refusal is unissued but failed readiness remains unknownを検証する。
 *
 * @responsibility start precondition refusal is unissued but failed readiness remains unknownの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus start precondition refusal is unissued but failed readiness remains unknownの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("start precondition refusal is unissued but failed readiness remains unknown", async () => {
  const f = fixture("engine");
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  assert.equal(await f.machine.stop(), "stopped");
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getEffectOutcomeUnknown(), true);
  await f.machine.release();
});

for (const stage of ["before-kill", "before-wsl", "before-launch"] as const) {
  for (const mode of ["lock-loss", "cancel"] as const) {
    /**
     * machine observes ${mode} after await at ${stage} before next effectを検証する。
     *
     * @responsibility machine observes ${mode} after await at ${stage} before next effectの合否判定を所有する。
     * @trace ERB-IT-014
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus machine observes ${mode} after await at ${stage} before next effectの対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
     */
    test(`machine observes ${mode} after await at ${stage} before next effect`, async () => {
      const f = fixture();
      /**
       * loseのTest準備責務を実行する。
       *
       * @responsibility loseがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
       * @trace ERB-IT-014
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus loseを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
       */
      const lose = () =>
        mode === "cancel" ? f.controller.abort() : f.loseBoundary();
      if (stage === "before-kill") {
        const original = f.session.inspectProcesses;
        f.session.inspectProcesses = async () => {
          const value = await original();
          lose();
          return value;
        };
        assert.equal(await f.machine.stop(), "unknown");
        assert.deepEqual(f.events, []);
      } else if (stage === "before-wsl") {
        const original = f.session.stopDesktop;
        f.session.stopDesktop = async () => {
          const value = await original();
          lose();
          return value;
        };
        assert.equal(await f.machine.stop(), "unknown");
        assert.deepEqual(f.events, ["S"]);
      } else {
        assert.equal(await f.machine.stop(), "stopped");
        const original = f.session.inspectProcesses;
        f.session.inspectProcesses = async () => {
          const value = await original();
          lose();
          return value;
        };
        assert.equal(await f.machine.start(), "unknown");
        assert.deepEqual(f.events, ["S"]);
      }
      assert.deepEqual(await f.machine.release(), {
        cleanup: "confirmed",
        protocol: mode === "cancel" ? "not_applicable" : "completed",
      });
    });
  }
}

/**
 * cancellation joins Native abort once and preserves unknown cleanupを検証する。
 *
 * @responsibility cancellation joins Native abort once and preserves unknown cleanupの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cancellation joins Native abort once and preserves unknown cleanupの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("cancellation joins Native abort once and preserves unknown cleanup", async () => {
  const f = fixture();
  let calls = 0;
  f.session.abort = async () => {
    calls += 1;
    throw new Error("unobserved native exit");
  };
  f.controller.abort();
  assert.equal(await f.machine.stop(), "unknown");
  const first = f.machine.release();
  assert.equal(first, f.machine.release());
  assert.deepEqual(await first, { cleanup: "unknown", protocol: "failed" });
  assert.equal(calls, 1);
  assert.deepEqual(f.events, []);
});

/**
 * restart machine stops both boundaries before launch and joins releaseを検証する。
 *
 * @responsibility restart machine stops both boundaries before launch and joins releaseの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart machine stops both boundaries before launch and joins releaseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("restart machine stops both boundaries before launch and joins release", async () => {
  const { machine, events } = fixture();
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "ready");
  assert.deepEqual(await machine.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
  assert.deepEqual(events, ["S", "L", "Q"]);
});

/**
 * idle WSL with Desktop present uses official stop, not forced terminationを検証する。
 *
 * @responsibility idle WSL with Desktop present uses official stop, not forced terminationの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus idle WSL with Desktop present uses official stop, not forced terminationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("idle WSL with Desktop present uses official stop, not forced termination", async () => {
  const { machine, events } = fixture("idle");
  assert.equal(await machine.stop(), "stopped");
  assert.deepEqual(events, ["S"]);
  await machine.release();
});

/**
 * ready Linux Engine does not depend on the optional WSL backend stateを検証する。
 *
 * @responsibility ready Linux Engine does not depend on the optional WSL backend stateの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus ready Linux Engine does not depend on the optional WSL backend stateの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("ready Linux Engine does not depend on the optional WSL backend state", async () => {
  const { machine, events } = fixture("non-wsl");
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "ready");
  assert.deepEqual(events, ["S", "L"]);
  await machine.release();
});

/**
 * stopped state requires the Engine to be known unavailableを検証する。
 *
 * @responsibility stopped state requires the Engine to be known unavailableの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus stopped state requires the Engine to be known unavailableの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("stopped state requires the Engine to be known unavailable", async () => {
  const { machine, events } = fixture("engine-still-ready");
  assert.equal(await machine.stop(), "unknown");
  assert.deepEqual(events, ["S"]);
  assert.equal(machine.getEffectOutcomeUnknown(), true);
  await machine.release();
});

for (const failure of [
  "dead",
  "artifact",
  "client",
  "wsl",
  "residual",
  "terminate",
  "containers",
]) {
  /**
   * restart machine refuses unknown/unsafe state: ${failure}を検証する。
   *
   * @responsibility restart machine refuses unknown/unsafe state: ${failure}の合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart machine refuses unknown/unsafe state: ${failure}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`restart machine refuses unknown/unsafe state: ${failure}`, async () => {
    const { machine, events } = fixture(failure);
    assert.equal(await machine.stop(), "unknown");
    assert.equal(await machine.start(), "unknown");
    assert.equal(events.includes("L"), false);
    if (["dead", "artifact", "client"].includes(failure))
      assert.deepEqual(events, []);
  });
}

/**
 * Engine unready has bounded attempts without a progressing test clockを検証する。
 *
 * @responsibility Engine unready has bounded attempts without a progressing test clockの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Engine unready has bounded attempts without a progressing test clockの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("Engine unready has bounded attempts without a progressing test clock", async () => {
  const { machine } = fixture("engine");
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "unknown");
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
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
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
  assert.equal(isDockerRestartEngineReady(result), true);
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
    assert.equal(isDockerRestartEngineReady({ ...result, stdout }), false);
  assert.equal(isDockerRestartEngineReady({ ...result, status: 1 }), false);
  assert.equal(
    isDockerRestartEngineReady({ ...result, stderr: "warning" }),
    false,
  );
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
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
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
    observeDockerRestartEngineResult(unavailable, () => ({
      state: "absent",
      cleanup: "confirmed",
    })).state,
    "known_unavailable",
  );
  for (const stdout of ["null", "null\n", "null\r\n"]) {
    assert.equal(
      observeDockerRestartEngineResult({ ...unavailable, stdout }, () => ({
        state: "absent",
        cleanup: "confirmed",
      })).state,
      "known_unavailable",
    );
  }
  assert.equal(
    observeDockerRestartEngineResult({ ...unavailable, stdout: "{}" }, () => ({
      state: "absent",
      cleanup: "confirmed",
    })).state,
    "unknown",
  );
  assert.equal(
    observeDockerRestartEngineResult(unavailable, () => ({
      state: "present",
      cleanup: "confirmed",
    })).state,
    "unknown",
  );
  assert.equal(
    observeDockerRestartEngineResult(unavailable, () => ({
      state: "unknown",
      cleanup: "confirmed",
    })).state,
    "unknown",
  );
  assert.equal(
    observeDockerRestartEngineResult(
      { ...unavailable, error: new Error("timeout") },
      () => ({ state: "absent", cleanup: "confirmed" }),
    ).state,
    "unknown",
  );
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
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
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
   * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  const failure = (code?: string) => {
    const error = new Error(code ?? "generic failure") as NodeJS.ErrnoException;
    error.code = code;
    return error;
  };
  assert.equal(
    observeDockerRestartEnginePipe(() => {
      throw failure("ENOENT");
    }).state,
    "absent",
  );
  for (const code of ["EACCES", "EPERM", "EMFILE", "ENFILE", undefined])
    assert.equal(
      observeDockerRestartEnginePipe(() => {
        throw failure(code);
      }).state,
      "unknown",
      code ?? "generic",
    );
  assert.equal(
    observeDockerRestartEnginePipe(
      () => 1,
      () => {},
    ).state,
    "present",
  );
  assert.equal(
    observeDockerRestartEnginePipe(
      () => 1,
      () => {
        throw failure("EIO");
      },
    ).state,
    "unknown",
  );
  assert.equal(
    observeDockerRestartEnginePipe(
      () => 1,
      () => {
        throw failure("EIO");
      },
    ).cleanup,
    "unknown",
  );
});

/**
 * Engine pipe cleanup uncertainty is sticky through machine releaseを検証する。
 *
 * @responsibility Engine pipe cleanup uncertainty is sticky through machine releaseの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Engine pipe cleanup uncertainty is sticky through machine releaseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("Engine pipe cleanup uncertainty is sticky through machine release", async () => {
  const f = fixture("engine-cleanup");
  assert.equal(await f.machine.observeReady(), false);
  assert.deepEqual(await f.machine.release(), {
    cleanup: "unknown",
    protocol: "completed",
  });
});
