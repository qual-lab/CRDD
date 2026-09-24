/**
 * coordinator:integration:docker-restart-executionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-restart-executionが所有する検証責務を実行する。
 * @trace ERB-IT-014
 * @level IT
 * @scope docker、restart、execution
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type DockerRestartPorts,
  executeDockerRestart,
} from "../../src/core/docker-restart-execution.ts";

/**
 * restart driver waits for pending stop before cleanup after cancellationを検証する。
 *
 * @responsibility restart driver waits for pending stop before cleanup after cancellationの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart driver waits for pending stop before cleanup after cancellationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("restart driver waits for pending stop before cleanup after cancellation", async () => {
  const f = fixture();
  let releaseStop: (() => void) | undefined;
  let notifyStop: (() => void) | undefined;
  const enteredStop = new Promise<void>((resolve) => {
    notifyStop = resolve;
  });
  const pendingStop = new Promise<void>((resolve) => {
    releaseStop = resolve;
  });
  const pendingResult = executeDockerRestart(
    f.context,
    {
      ...f.ports,
      stop: async (context) => {
        notifyStop?.();
        await pendingStop;
        return f.ports.stop(context);
      },
    },
    f.controller.signal,
  );
  await enteredStop;
  f.controller.abort();
  assert.equal(f.calls.includes("cleanup"), false);
  releaseStop?.();
  const result = await pendingResult;
  assert.equal(result.reason, "docker_restart_cancelled");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(f.calls.includes("start"), false);
});

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
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
function fixture() {
  const context = Object.freeze({});
  const controller = new AbortController();
  const calls: string[] = [];
  const ports: DockerRestartPorts = {
    verifyBoundary: async (value) => {
      assert.equal(value, context);
      calls.push("boundary");
      return true;
    },
    persist: async (value, phase) => {
      assert.equal(value, context);
      calls.push(phase);
      return true;
    },
    stop: async () => {
      calls.push("stop");
      return {
        stopCompleted: true,
        managedProcessesAbsent: true,
        engineStopped: true,
        effectOutcomeUnknown: false,
      };
    },
    start: async () => {
      calls.push("start");
      return {
        startCompleted: true,
        engineReady: true,
        effectOutcomeUnknown: false,
      };
    },
    cleanup: async () => {
      calls.push("cleanup");
      return true;
    },
  };
  return { context, controller, calls, ports };
}

for (const phase of [
  "stop_intent",
  "stopped",
  "start_intent",
  "ready",
] as const) {
  /**
   * restart resume from ${phase} uses observation without replaying completed effectsを検証する。
   *
   * @responsibility restart resume from ${phase} uses observation without replaying completed effectsの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart resume from ${phase} uses observation without replaying completed effectsの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`restart resume from ${phase} uses observation without replaying completed effects`, async () => {
    const f = fixture();
    const result = await executeDockerRestart(
      f.context,
      {
        ...f.ports,
        observeStopped: async () => {
          f.calls.push("observeStopped");
          return true;
        },
        observeReady: async () => {
          f.calls.push("observeReady");
          return true;
        },
      },
      f.controller.signal,
      phase,
    );
    assert.equal(result.status, "completed");
    assert.equal(result.phase, "settled");
    assert.equal(result.effectOutcomeUnknown, false);
    assert.equal(result.taskRecoveryCompleted, false);
    const expectedCalls =
      phase === "stop_intent"
        ? [
            "observeStopped",
            "stopped",
            "start_intent",
            "start",
            "ready",
            "cleanup",
            "settled",
          ]
        : phase === "stopped"
          ? [
              "observeStopped",
              "start_intent",
              "start",
              "ready",
              "cleanup",
              "settled",
            ]
          : phase === "start_intent"
            ? ["observeReady", "ready", "cleanup", "settled"]
            : ["observeReady", "cleanup", "settled"];
    assert.deepEqual(
      f.calls.filter((value) => value !== "boundary"),
      expectedCalls,
    );
  });

  for (const failure of ["false", "throw", "missing", "cancel"] as const) {
    /**
     * restart resume ${phase} observation ${failure} never issues next effectを検証する。
     *
     * @responsibility restart resume ${phase} observation ${failure} never issues next effectの合否判定を所有する。
     * @trace ERB-IT-014
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus restart resume ${phase} observation ${failure} never issues next effectの対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
     */
    test(`restart resume ${phase} observation ${failure} never issues next effect`, async () => {
      const f = fixture();
      /**
       * observeのTest準備責務を実行する。
       *
       * @responsibility observeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
       * @trace ERB-IT-014
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus observeを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
       */
      const observe = async () => {
        f.calls.push("observe");
        if (failure === "throw") throw new Error("observation failed");
        if (failure === "cancel") f.controller.abort();
        return failure === "cancel";
      };
      const result = await executeDockerRestart(
        f.context,
        {
          ...f.ports,
          ...(failure === "missing"
            ? {}
            : { observeStopped: observe, observeReady: observe }),
        },
        f.controller.signal,
        phase,
      );
      assert.equal(result.status, "blocked");
      assert.equal(result.recoveryRequired, true);
      assert.equal(result.restartCompleted, false);
      assert.equal(result.effectOutcomeUnknown, true);
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(f.calls.includes("stop"), false);
      assert.equal(f.calls.includes("start"), false);
      assert.equal(f.calls.includes("start_intent"), false);
      assert.equal(f.calls.includes("settled"), false);
      assert.equal(f.calls.filter((value) => value === "cleanup").length, 1);
      if (failure === "cancel")
        assert.equal(result.reason, "docker_restart_cancelled");
    });
  }

  /**
   * restart resume ${phase} rejects cancellation before observationを検証する。
   *
   * @responsibility restart resume ${phase} rejects cancellation before observationの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart resume ${phase} rejects cancellation before observationの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`restart resume ${phase} rejects cancellation before observation`, async () => {
    const f = fixture();
    f.controller.abort();
    const result = await executeDockerRestart(
      f.context,
      {
        ...f.ports,
        observeStopped: async () => {
          throw new Error("must not observe");
        },
        observeReady: async () => {
          throw new Error("must not observe");
        },
      },
      f.controller.signal,
      phase,
    );
    assert.equal(result.reason, "docker_restart_cancelled");
    assert.equal(result.recoveryRequired, true);
    assert.equal(result.effectOutcomeUnknown, true);
    assert.deepEqual(f.calls, ["cleanup"]);
  });
}

for (const phase of ["settled"] as const) {
  /**
   * restart resume ${phase} refuses replay and retains obligationを検証する。
   *
   * @responsibility restart resume ${phase} refuses replay and retains obligationの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart resume ${phase} refuses replay and retains obligationの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`restart resume ${phase} refuses replay and retains obligation`, async () => {
    const f = fixture();
    const result = await executeDockerRestart(
      f.context,
      f.ports,
      f.controller.signal,
      phase,
    );
    assert.equal(result.reason, "docker_restart_resume_requires_observation");
    assert.equal(result.status, "blocked");
    assert.equal(result.recoveryRequired, true);
    assert.equal(result.restartCompleted, false);
    assert.equal(result.phase, phase);
    assert.equal(result.effectOutcomeUnknown, true);
    assert.deepEqual(f.calls, ["boundary", "cleanup"]);
  });
}

/**
 * restart resume rejects unknown or prepared persisted phases without effectsを検証する。
 *
 * @responsibility restart resume rejects unknown or prepared persisted phases without effectsの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart resume rejects unknown or prepared persisted phases without effectsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("restart resume rejects unknown or prepared persisted phases without effects", async () => {
  for (const phase of ["prepared", "unknown", null, {}, 0]) {
    const f = fixture();
    const result = await executeDockerRestart(
      f.context,
      f.ports,
      f.controller.signal,
      phase as Parameters<typeof executeDockerRestart>[3],
    );
    assert.equal(result.reason, "docker_restart_resume_phase_invalid");
    assert.equal(result.status, "blocked");
    assert.equal(result.recoveryRequired, true);
    assert.equal(result.effectOutcomeUnknown, true);
    assert.deepEqual(f.calls, ["cleanup"]);
  }
});

/**
 * restart driver settles restart only, persists intents and cleans before settlementを検証する。
 *
 * @responsibility restart driver settles restart only, persists intents and cleans before settlementの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart driver settles restart only, persists intents and cleans before settlementの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("restart driver settles restart only, persists intents and cleans before settlement", async () => {
  const f = fixture();
  const result = await executeDockerRestart(
    f.context,
    f.ports,
    f.controller.signal,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.taskRecoveryCompleted, false);
  assert.deepEqual(
    f.calls.filter((value) => value !== "boundary"),
    [
      "stop_intent",
      "stop",
      "stopped",
      "start_intent",
      "start",
      "ready",
      "cleanup",
      "settled",
    ],
  );
  assert.equal(
    (await executeDockerRestart(f.context, f.ports, f.controller.signal))
      .reason,
    "docker_restart_context_consumed",
  );
  assert.equal(f.calls.filter((value) => value === "stop").length, 1);
});

for (const phase of [
  "stop_intent",
  "stopped",
  "start_intent",
  "ready",
  "settled",
] as const) {
  for (const failure of ["false", "throw", "cancel"] as const) {
    /**
     * restart driver retains obligation after ${phase} persistence ${failure}を検証する。
     *
     * @responsibility restart driver retains obligation after ${phase} persistence ${failure}の合否判定を所有する。
     * @trace ERB-IT-014
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus restart driver retains obligation after ${phase} persistence ${failure}の対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
     */
    test(`restart driver retains obligation after ${phase} persistence ${failure}`, async () => {
      const f = fixture();
      const result = await executeDockerRestart(
        f.context,
        {
          ...f.ports,
          persist: async (context, current) => {
            await f.ports.persist(context, current);
            if (current !== phase) return true;
            if (failure === "throw") throw new Error("storage failed");
            if (failure === "cancel") f.controller.abort();
            return failure === "cancel";
          },
        },
        f.controller.signal,
      );
      assert.equal(result.status, "blocked");
      assert.equal(result.recoveryRequired, true);
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(f.calls.filter((value) => value === "cleanup").length, 1);
      if (phase === "stop_intent")
        assert.equal(f.calls.includes("stop"), false);
      if (phase === "start_intent" || phase === "stopped")
        assert.equal(f.calls.includes("start"), false);
    });
  }
}

for (const operation of ["stop", "start"] as const) {
  for (const failure of ["throw", "cancel", "unknown", "incomplete"] as const) {
    /**
     * restart driver does not replay ${operation} after ${failure}を検証する。
     *
     * @responsibility restart driver does not replay ${operation} after ${failure}の合否判定を所有する。
     * @trace ERB-IT-014
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus restart driver does not replay ${operation} after ${failure}の対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
     */
    test(`restart driver does not replay ${operation} after ${failure}`, async () => {
      const f = fixture();
      const ports: DockerRestartPorts = {
        ...f.ports,
        [operation]: async () => {
          const result = await f.ports[operation](f.context);
          if (failure === "throw") throw new Error("lost response");
          if (failure === "cancel") f.controller.abort();
          return {
            ...result,
            effectOutcomeUnknown: failure === "unknown",
            ...(failure === "incomplete"
              ? { stopCompleted: false, startCompleted: false }
              : {}),
          };
        },
      };
      const result = await executeDockerRestart(
        f.context,
        ports,
        f.controller.signal,
      );
      assert.equal(result.status, "blocked");
      assert.equal(result.recoveryRequired, true);
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(f.calls.filter((value) => value === operation).length, 1);
      if (operation === "stop") assert.equal(f.calls.includes("start"), false);
      if (failure === "throw" || failure === "unknown")
        assert.equal(result.effectOutcomeUnknown, true);
    });
  }
}

for (const field of [
  "managedProcessesAbsent",
  "engineStopped",
  "engineReady",
] as const) {
  /**
   * restart driver requires independent ${field} observationを検証する。
   *
   * @responsibility restart driver requires independent ${field} observationの合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart driver requires independent ${field} observationの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`restart driver requires independent ${field} observation`, async () => {
    const f = fixture();
    const result = await executeDockerRestart(
      f.context,
      {
        ...f.ports,
        stop: async (context) => ({
          ...(await f.ports.stop(context)),
          ...(field !== "engineReady" ? { [field]: false } : {}),
        }),
        start: async (context) => ({
          ...(await f.ports.start(context)),
          ...(field === "engineReady" ? { [field]: false } : {}),
        }),
      },
      f.controller.signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
  });
}

for (const failure of ["false", "throw", "cancel"] as const) {
  /**
   * restart driver never succeeds with cleanup ${failure}を検証する。
   *
   * @responsibility restart driver never succeeds with cleanup ${failure}の合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart driver never succeeds with cleanup ${failure}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
  test(`restart driver never succeeds with cleanup ${failure}`, async () => {
    const f = fixture();
    const result = await executeDockerRestart(
      f.context,
      {
        ...f.ports,
        cleanup: async () => {
          f.calls.push("cleanup");
          if (failure === "throw") throw new Error("cleanup lost");
          if (failure === "cancel") f.controller.abort();
          return failure === "cancel";
        },
      },
      f.controller.signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(f.calls.includes("settled"), false);
  });
}

/**
 * restart driver rechecks boundary after await and cleans on initial rejectionを検証する。
 *
 * @responsibility restart driver rechecks boundary after await and cleans on initial rejectionの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart driver rechecks boundary after await and cleans on initial rejectionの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("restart driver rechecks boundary after await and cleans on initial rejection", async () => {
  const f = fixture();
  let observations = 0;
  const result = await executeDockerRestart(
    f.context,
    { ...f.ports, verifyBoundary: async () => ++observations < 2 },
    f.controller.signal,
  );
  assert.equal(result.reason, "docker_restart_boundary_unconfirmed");
  assert.equal(result.recoveryRequired, true);
  assert.equal(f.calls.includes("stop"), false);
  assert.equal(result.cleanupConfirmed, true);
});

/**
 * restart resume from start_intent blocks when boundary changes after ready observationを検証する。
 *
 * @responsibility restart resume from start_intent blocks when boundary changes after ready observationの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart resume from start_intent blocks when boundary changes after ready observationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("restart resume from start_intent blocks when boundary changes after ready observation", async () => {
  const f = fixture();
  let boundaryChecks = 0;
  const result = await executeDockerRestart(
    f.context,
    {
      ...f.ports,
      verifyBoundary: async () => {
        f.calls.push("boundary");
        boundaryChecks += 1;
        return boundaryChecks < 2;
      },
      observeReady: async () => {
        f.calls.push("observeReady");
        return true;
      },
    },
    f.controller.signal,
    "start_intent",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_boundary_unconfirmed");
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.restartCompleted, false);
  assert.equal(result.effectOutcomeUnknown, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(f.calls.includes("stop"), false);
  assert.equal(f.calls.includes("start"), false);
  assert.equal(f.calls.includes("ready"), false);
  assert.equal(f.calls.includes("settled"), false);
  assert.equal(f.calls.filter((value) => value === "cleanup").length, 1);
});
