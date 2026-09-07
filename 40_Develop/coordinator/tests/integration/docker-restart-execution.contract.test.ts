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
