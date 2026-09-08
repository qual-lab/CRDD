import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartMachineForVerification,
  isDockerRestartEngineReady,
  observeDockerRestartEngineResult,
} from "../../src/security/docker-restart-machine.ts";

function fixture(change: string = "") {
  const events: string[] = [];
  let isBoundaryLive = true;
  const controller = new AbortController();
  let wsl: "running" | "stopped" | "unknown" =
    change === "idle" ? "stopped" : "running";
  let engine: "ready" | "known_unavailable" | "unknown" =
    change === "engine-observation" ? "unknown" : "ready";
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
    observeEngine: () => engine,
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

test("official stop waits for delayed process exit without reissuing stop", async () => {
  const f = fixture("delayed-exit");
  assert.equal(await f.machine.stop(), "stopped");
  assert.deepEqual(f.events, ["S", "wait"]);
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  await f.machine.release();
});

for (const reason of ["delayed-timeout", "delayed-cancel", "delayed-lock"]) {
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
  test(`pre-effect refusal ${reason} does not claim unknown issued effect`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getEffectOutcomeUnknown(), false);
    await f.machine.release();
  });
}

for (const reason of ["terminate", "residual"]) {
  test(`issued stop ${reason} preserves unknown effect`, async () => {
    const f = fixture(reason);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(f.machine.getEffectOutcomeUnknown(), true);
    await f.machine.release();
  });
}

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
    test(`machine observes ${mode} after await at ${stage} before next effect`, async () => {
      const f = fixture();
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

test("idle WSL with Desktop present uses official stop, not forced termination", async () => {
  const { machine, events } = fixture("idle");
  assert.equal(await machine.stop(), "stopped");
  assert.deepEqual(events, ["S"]);
  await machine.release();
});

test("ready Linux Engine does not depend on the optional WSL backend state", async () => {
  const { machine, events } = fixture("non-wsl");
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "ready");
  assert.deepEqual(events, ["S", "L"]);
  await machine.release();
});

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
  test(`restart machine refuses unknown/unsafe state: ${failure}`, async () => {
    const { machine, events } = fixture(failure);
    assert.equal(await machine.stop(), "unknown");
    assert.equal(await machine.start(), "unknown");
    assert.equal(events.includes("L"), false);
    if (["dead", "artifact", "client"].includes(failure))
      assert.deepEqual(events, []);
  });
}

test("Engine unready has bounded attempts without a progressing test clock", async () => {
  const { machine } = fixture("engine");
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "unknown");
});

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

test("Engine observation distinguishes known unavailability from unknown failure", () => {
  const unavailable = {
    pid: 1,
    status: 1,
    signal: null,
    stderr: "connection failed",
    stdout: "",
  };
  assert.equal(
    observeDockerRestartEngineResult(unavailable, () => {
      throw new Error("pipe absent");
    }),
    "known_unavailable",
  );
  assert.equal(
    observeDockerRestartEngineResult(unavailable, () => {}),
    "unknown",
  );
  assert.equal(
    observeDockerRestartEngineResult(
      { ...unavailable, error: new Error("timeout") },
      () => {
        throw new Error("pipe absent");
      },
    ),
    "unknown",
  );
});
