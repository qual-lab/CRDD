import assert from "node:assert/strict";
import test from "node:test";
import {
  type DockerRestartPorts,
  executeDockerRestart,
} from "../../src/core/docker-restart-execution.ts";

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
    test(`restart resume ${phase} observation ${failure} never issues next effect`, async () => {
      const f = fixture();
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
