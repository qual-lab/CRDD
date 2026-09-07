import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartMachineForVerification,
  isDockerRestartEngineReady,
} from "../../src/security/docker-restart-machine.ts";

function fixture(change: string = "") {
  const events: string[] = [];
  let boundaryLive = true;
  const controller = new AbortController();
  let wsl: "running" | "stopped" | "unknown" = "running";
  let processes: "verified" | "absent" = "verified";
  const session = {
    assertLive: () => change !== "dead",
    verifyArtifacts: async () =>
      change === "artifact" ? ("unknown" as const) : ("verified" as const),
    inspectClientProcesses: async () =>
      change === "client" ? ("verified" as const) : ("absent" as const),
    inspectProcesses: async () => processes,
    terminateProcesses: async () => {
      events.push("K");
      processes = "absent";
      return "terminated" as const;
    },
    launchDesktop: async () => {
      events.push("L");
      wsl = "running";
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
    boundary: () => boundaryLive,
    signal: controller.signal,
    observeWsl: () => (change === "wsl" ? "unknown" : wsl),
    terminateWsl: () => {
      events.push("W");
      if (change !== "residual") wsl = "stopped";
      return change !== "terminate";
    },
    engineReady: () => change !== "engine",
    containersAbsent: () => change !== "containers",
    now: () => 0,
    wait: async () => {},
  });
  return {
    machine,
    events,
    session,
    loseBoundary: () => {
      boundaryLive = false;
    },
    controller,
  };
}

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
        const original = f.session.terminateProcesses;
        f.session.terminateProcesses = async () => {
          const value = await original();
          lose();
          return value;
        };
        assert.equal(await f.machine.stop(), "unknown");
        assert.deepEqual(f.events, ["K"]);
      } else {
        assert.equal(await f.machine.stop(), "stopped");
        const original = f.session.inspectProcesses;
        f.session.inspectProcesses = async () => {
          const value = await original();
          lose();
          return value;
        };
        assert.equal(await f.machine.start(), "unknown");
        assert.deepEqual(f.events, ["K", "W"]);
      }
      assert.deepEqual(await f.machine.release(), {
        cleanup: "confirmed",
        protocol: "completed",
      });
    });
  }
}

test("restart machine stops both boundaries before launch and joins release", async () => {
  const { machine, events } = fixture();
  assert.equal(await machine.stop(), "stopped");
  assert.equal(await machine.start(), "ready");
  assert.deepEqual(await machine.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
  assert.deepEqual(events, ["K", "W", "L", "Q"]);
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
