/**
 * Docker Isolationの再起動Machineの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 停止・開始・待機・取消と回収の技術Oracleを新Ownerで実行する。
 * @trace ERB-IT-014
 * @level IT
 * @scope docker、restart、machine
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createDockerRestartMachineForVerification } from "../../src/desktop/restart-machine.ts";

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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(change: string = "") {
  const events: string[] = [];
  let isBoundaryLive = true;
  const controller = new AbortController();
  let wsl: "running" | "stopped" | "unknown" =
    change === "idle" || change === "no-desktop" ? "stopped" : "running";
  let engine: "ready" | "known_unavailable" | "unknown" =
    change === "engine-observation" || change === "engine-cleanup"
      ? "unknown"
      : "ready";
  let processes: "verified" | "absent" | "unknown" =
    change === "desktop-observation"
      ? "unknown"
      : change === "no-desktop"
        ? "absent"
        : "verified";
  let artifactChecks = 0;
  const session = {
    assertLive: () => change !== "dead",
    verifyArtifacts: async () => {
      artifactChecks++;
      return change === "artifact" ||
        (change === "request-artifact" && artifactChecks === 2)
        ? ("unknown" as const)
        : ("verified" as const);
    },
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
    launchDesktop: async (): Promise<"started" | "not_started"> => {
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
  const ports = {
    session,
    boundary: () => isBoundaryLive,
    signal: controller.signal,
    observeBackend: (): "running" | "stopped" | "unknown" =>
      change === "wsl" ? "unknown" : wsl,
    observeEngine: ():
      | "ready"
      | "known_unavailable"
      | "unknown"
      | {
          state: "ready" | "known_unavailable" | "unknown";
          cleanup: "unknown";
        } =>
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
  };
  const machine = createDockerRestartMachineForVerification(ports);
  return {
    machine,
    events,
    session,
    ports,
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("official stop waits for delayed process exit without reissuing stop", async () => {
  const f = fixture("delayed-exit");
  assert.equal(await f.machine.stop(), "stopped");
  assert.deepEqual(f.events, ["S", "wait"]);
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  assert.equal(f.machine.getStopFailure(), null);
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
   * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
    assert.equal(
      f.machine.getStopFailure(),
      reason === "delayed-timeout"
        ? "stop_wait_unconfirmed"
        : "boundary_unconfirmed",
    );
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
   * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`pre-effect refusal ${reason} does not claim unknown issued effect`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getEffectOutcomeUnknown(), false);
    const expected = {
      dead: "initial_trust_unconfirmed",
      artifact: "initial_trust_unconfirmed",
      client: "client_processes_unconfirmed",
      wsl: "backend_unconfirmed",
      "engine-observation": "engine_unconfirmed",
      containers: "containers_absence_unconfirmed",
      unissued: "stop_request_unconfirmed",
    };
    assert.equal(
      f.machine.getStopFailure(),
      expected[reason as keyof typeof expected],
    );
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
   * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`issued stop ${reason} preserves unknown effect`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getEffectOutcomeUnknown(), true);
    assert.equal(
      f.machine.getStopFailure(),
      reason === "terminate"
        ? "stop_request_unconfirmed"
        : "stop_wait_unconfirmed",
    );
    await f.machine.release();
  });
}

/**
 * 診断は各stopで初期化し、他の観測・startでは前stopの結果を変えない。
 * @responsibility 診断の持越しと追加観測による偽の失敗詳細を検出する。
 * @trace ERB-IT-014
 * @precondition 同じ実Machineと変更可能なSessionを使う。
 * @stimulus Client拒否、非停止観測、その後の正常stop、例外を順に与える。
 * @observation getterと実停止回数。
 * @oracle 前回失敗は次stop成功でnull、例外は生本文を返さない固定値。
 * @cleanup 最後に同じSessionを解放する。
 * @boundary 合成Sessionだけで実Docker要求は発行しない。
 */
test("停止診断は観測で汚染されず次回stopで初期化される", async () => {
  const f = fixture();
  assert.equal(f.machine.getStopFailure(), null);
  const inspect = f.session.inspectClientProcesses;
  f.session.inspectClientProcesses = async () => "verified";
  assert.equal(await f.machine.stop(), "unknown");
  assert.equal(f.machine.getStopFailure(), "client_processes_unconfirmed");
  await f.machine.observeStopped();
  await f.machine.observeReady();
  assert.equal(f.machine.getStopFailure(), "client_processes_unconfirmed");
  f.session.inspectClientProcesses = inspect;
  assert.equal(await f.machine.stop(), "stopped");
  assert.equal(f.machine.getStopFailure(), null);
  f.session.inspectClientProcesses = async () => {
    throw new Error("private fixture text");
  };
  assert.equal(await f.machine.stop(), "unknown");
  assert.equal(f.machine.getStopFailure(), "exception");
  assert.equal(f.events.filter((x) => x === "S").length, 1);
  await f.machine.release();
});

for (const [fault, expected] of [
  ["desktop-observation", "desktop_processes_unconfirmed"],
  ["request-artifact", "request_trust_unconfirmed"],
  ["no-desktop", "stopped_state_unconfirmed"],
] as const) {
  /**
   * 停止要求前の個別観測と最終停止判定を区別する。
   * @responsibility 実要求がない拒否を同じunknownへ潰さず分類する。
   * @trace ERB-IT-014
   * @precondition 実Machineと単一故障の合成依存を使用する。
   * @stimulus Desktop不明、要求直前信頼喪失、Engineだけreadyを与える。
   * @observation stop返値、固定診断、処置列とEffect不明状態。
   * @oracle 各固定理由を返し、停止要求0・Effect不明false。
   * @cleanup Sessionを解放する。
   * @boundary 実OS・Dockerには要求しない。
   */
  test(`停止前拒否 ${fault} の診断と処置0を保持する`, async () => {
    const f = fixture(fault);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getStopFailure(), expected);
    assert.equal(f.machine.getEffectOutcomeUnknown(), false);
    assert.deepEqual(f.events, []);
    await f.machine.release();
  });
}

/**
 * 停止後観測の途中で失効した境界を待機期限と区別する。
 * @responsibility 実際に得た境界失効を待機失敗へ誤分類しない。
 * @trace ERB-IT-014
 * @precondition 初回観測と停止要求は成功する。
 * @stimulus 停止後のProcess不存在を返す時点で境界を失効させる。
 * @observation 固定診断、停止要求・wait回数、Effect不明。
 * @oracle stop1・wait0・unknown trueとboundary診断。
 * @cleanup 同じSessionを解放する。
 * @boundary 実Machineと合成Sessionのみ。
 */
test("停止後の観測中に失効した境界を待機期限へ丸めない", async () => {
  const f = fixture();
  const inspect = f.session.inspectProcesses;
  f.session.inspectProcesses = async () => {
    const result = await inspect();
    if (result === "absent") f.loseBoundary();
    return result;
  };
  assert.equal(await f.machine.stop(), "unknown");
  assert.equal(f.machine.getStopFailure(), "boundary_unconfirmed");
  assert.equal(f.machine.getEffectOutcomeUnknown(), true);
  assert.deepEqual(f.events, ["S"]);
  await f.machine.release();
});

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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("start precondition refusal is unissued but failed readiness remains unknown", async () => {
  const f = fixture("engine");
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  assert.equal(f.machine.getStartFailure(), "stop_not_confirmed");
  assert.equal(await f.machine.stop(), "stopped");
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getEffectOutcomeUnknown(), true);
  assert.equal(f.machine.getStartFailure(), "readiness_timeout");
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
     * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
       * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
   * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Engine unready has bounded attempts without a progressing test clock", async () => {
  const { machine } = fixture("engine");
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "unknown");
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
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Engine pipe cleanup uncertainty is sticky through machine release", async () => {
  const f = fixture("engine-cleanup");
  assert.equal(await f.machine.observeReady(), false);
  assert.deepEqual(await f.machine.release(), {
    cleanup: "unknown",
    protocol: "completed",
  });
});

for (const failure of [
  "initial_trust_unconfirmed",
  "client_processes_unconfirmed",
  "desktop_processes_unconfirmed",
  "engine_unconfirmed",
  "backend_unconfirmed",
  "final_trust_unconfirmed",
] as const) {
  for (const throws of [false, true]) {
    /**
     * 起動前確認の順序・短絡と診断を照合する。
     * @responsibility 最初の拒否・例外より後の観測と起動要求がないことを検証する。
     * @trace ERB-IT-014
     * @precondition 合成境界で停止確認済み。
     * @stimulus 六確認の一地点だけを拒否または例外にする。
     * @observation 確認列、診断、起動列、Effect不明状態。
     * @oracle 順序と回数が固定され、起動要求0、既知の未発行を維持する。
     * @cleanup 合成Sessionを解放する。
     * @boundary ERB-IT-014=実Machineから合成Native境界。
     */
    test(`start診断 ${failure} throws=${throws} は短絡を維持する`, async () => {
      const f = fixture();
      assert.equal(await f.machine.stop(), "stopped");
      const observed: string[] = [];
      const order = [
        "initial_trust_unconfirmed",
        "client_processes_unconfirmed",
        "desktop_processes_unconfirmed",
        "engine_unconfirmed",
        "backend_unconfirmed",
        "final_trust_unconfirmed",
      ] as const;
      const fails = (stage: string) => {
        observed.push(stage);
        if (stage !== failure) return false;
        if (throws) throw new Error("private detail must not escape");
        return true;
      };
      let trustCalls = 0;
      f.session.verifyArtifacts = async () =>
        fails(++trustCalls === 1 ? order[0] : order[5])
          ? "unknown"
          : "verified";
      f.session.inspectClientProcesses = async () =>
        fails(order[1]) ? "verified" : "absent";
      f.session.inspectProcesses = async () =>
        fails(order[2]) ? "verified" : "absent";
      f.ports.observeEngine = () =>
        fails(order[3]) ? "ready" : "known_unavailable";
      f.ports.observeBackend = () => (fails(order[4]) ? "running" : "stopped");
      assert.equal(await f.machine.start(), "unknown");
      assert.equal(f.machine.getStartFailure(), throws ? "exception" : failure);
      assert.deepEqual(observed, order.slice(0, order.indexOf(failure) + 1));
      assert.deepEqual(f.events, ["S"]);
      assert.equal(f.machine.getEffectOutcomeUnknown(), false);
      assert.equal(f.machine.getStopFailure(), null);
      await f.machine.release();
    });
  }
}

/**
 * 起動診断は呼出しごとに更新し、要求後例外を未発行へ丸めない。
 * @responsibility 停止未確認・要求後例外・次呼出し成功の区別を検証する。
 * @trace ERB-IT-014
 * @precondition 合成Sessionを使用する。
 * @stimulus 停止前start、launch例外、正常startを順に行う。
 * @observation 診断、Effect不明、要求列。
 * @oracle 古い診断が成功へ残らず、要求後例外はEffect不明を維持する。
 * @cleanup 合成Sessionを解放する。
 * @boundary ERB-IT-014=実Machineから合成Native境界。
 */
test("start診断は各呼出しで初期化し要求後例外を保持する", async () => {
  const f = fixture();
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getStartFailure(), "stop_not_confirmed");
  assert.equal(await f.machine.stop(), "stopped");
  const launch = f.session.launchDesktop;
  f.session.launchDesktop = async () => {
    throw new Error("private launch error");
  };
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getStartFailure(), "exception");
  assert.equal(f.machine.getEffectOutcomeUnknown(), true);
  f.session.launchDesktop = launch;
  assert.equal(await f.machine.start(), "ready");
  assert.equal(f.machine.getStartFailure(), null);
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  await f.machine.release();
});

for (const failure of [
  "boundary_false",
  "boundary_throw",
  "launch_refused",
  "readiness_trust",
] as const) {
  /**
   * 停止再確認後の起動境界を固定診断へ結合する。
   * @responsibility 要求前後の診断とEffect不明を区別する。
   * @trace ERB-IT-014
   * @precondition 合成境界で停止確認済み。
   * @stimulus 最終境界false／例外、launch拒否、起動後trust拒否を注入する。
   * @observation 呼出し数、要求列、診断、Effect不明。
   * @oracle 要求前はlaunch0、要求後は不明true、固定カテゴリと元stop診断を維持する。
   * @cleanup 合成Sessionを解放する。
   * @boundary ERB-IT-014=実Machineから合成Native境界。
   */
  test(`start診断は ${failure} を区別する`, async () => {
    const f = fixture();
    assert.equal(await f.machine.stop(), "stopped");
    let boundaryCalls = 0;
    let trustCalls = 0;
    const originalLaunch = f.session.launchDesktop;
    if (failure.startsWith("boundary")) {
      f.ports.boundary = () => {
        boundaryCalls++;
        if (boundaryCalls !== 5) return true;
        if (failure === "boundary_throw") throw new Error("private boundary");
        return false;
      };
    }
    if (failure === "launch_refused") {
      f.session.launchDesktop = async () => {
        f.events.push("L");
        return "not_started";
      };
    }
    if (failure === "readiness_trust") {
      f.session.verifyArtifacts = async () =>
        ++trustCalls > 2 ? "unknown" : "verified";
    }
    assert.equal(await f.machine.start(), "unknown");
    const requested = !failure.startsWith("boundary");
    assert.deepEqual(f.events, requested ? ["S", "L"] : ["S"]);
    assert.equal(f.machine.getEffectOutcomeUnknown(), requested);
    assert.equal(
      f.machine.getStartFailure(),
      {
        boundary_false: "boundary_unconfirmed",
        boundary_throw: "exception",
        launch_refused: "launch_request_unconfirmed",
        readiness_trust: "readiness_trust_unconfirmed",
      }[failure],
    );
    assert.equal(f.machine.getStopFailure(), null);
    if (!requested) assert.equal(boundaryCalls, 5);
    if (failure === "readiness_trust") assert.equal(trustCalls, 3);
    f.session.launchDesktop = originalLaunch;
    await f.machine.release();
  });
}
