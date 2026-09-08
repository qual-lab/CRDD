import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { executeDockerRestart } from "../../src/core/docker-restart-execution.ts";
import { createDockerRestartMachineForVerification } from "../../src/security/docker-restart-machine.ts";
import { restartRuntimeOwnedDockerForRecovery } from "../../src/security/docker-restart-runtime.ts";

// Run the source-owned composition with only external host/native boundaries
// replaced. The production driver and machine are exercised together.
const runtimeSource = fs.readFileSync(
  new URL("../../src/security/docker-restart-runtime.ts", import.meta.url),
  "utf8",
);
const functionStart = runtimeSource.indexOf(
  "export async function restartRuntimeOwnedDockerForRecovery(",
);
assert.ok(functionStart >= 0);
const compositionBody = stripTypeScriptTypes(
  runtimeSource
    .slice(functionStart)
    .replace("export async function", "async function"),
);

async function compose(
  change:
    | "handoff"
    | "handoff_failed"
    | "resume"
    | "resume_start_intent"
    | "handoff_live",
) {
  const calls: string[] = [];
  const context = Object.freeze({});
  const controller = new AbortController();
  const isResume = change === "resume" || change === "resume_start_intent";
  let processes: "verified" | "absent" =
    change === "handoff_live" ? "verified" : "absent";
  let wsl: "running" | "stopped" =
    change === "handoff_live" || change === "resume_start_intent"
      ? "running"
      : "stopped";
  const session = {
    assertLive: () => true,
    verifyArtifacts: async () => "verified" as const,
    inspectClientProcesses: async () => "absent" as const,
    inspectProcesses: async () => processes,
    stopDesktop: async () => {
      calls.push("S");
      processes = "absent";
      wsl = "stopped";
      return "command_completed" as const;
    },
    terminateProcesses: async () => {
      throw new Error("legacy K forbidden");
    },
    launchDesktop: async () => {
      calls.push("L");
      wsl = "running";
      return "started" as const;
    },
    release: async () => {
      calls.push("helper_release");
      return { cleanup: "confirmed" as const, protocol: "completed" as const };
    },
    abort: async () => ({
      cleanup: "confirmed" as const,
      protocol: "not_applicable" as const,
    }),
    failureDetected: new Promise<void>(() => {}),
    onFailureDetected: () => () => {},
  };
  const runComposition = runInNewContext(
    `${compositionBody}\nrestartRuntimeOwnedDockerForRecovery`,
    {
      Error,
      executeDockerRestart,
      prepareRuntimeOwnedDockerRestart: () => ({
        status: "prepared",
        capability: context,
        platformAccessArtifact: {},
        recoveryId: "fixture",
        handoffPending: !isResume,
        currentPhase:
          change === "resume_start_intent" ? "start_intent" : "stop_intent",
        continuationSeedRequired: !isResume,
      }),
      acquireRuntimeOwnedDockerDesktopRestartNativeHelper: async () => ({
        status: "acquired",
        session,
      }),
      verifyRuntimeOwnedDockerRestartPreparation: (value: object) => {
        assert.equal(value, context);
        return true;
      },
      commitRuntimeOwnedDockerRestartHandoff: () => {
        calls.push("handoff");
        return change !== "handoff_failed";
      },
      persistRuntimeOwnedDockerRestartPhase: (
        _value: object,
        phase: string,
      ) => {
        calls.push(phase);
        return true;
      },
      releaseRuntimeOwnedDockerRestartPreparation: () => {
        calls.push("lock_release");
        return true;
      },
      createDockerRestartMachine: (
        currentSession: typeof session,
        boundary: () => boolean,
        signal: AbortSignal,
      ) => {
        assert.equal(currentSession, session);
        return createDockerRestartMachineForVerification({
          session,
          boundary,
          signal,
          observeWsl: () => wsl,
          observeEngine: () =>
            wsl === "running" ? "ready" : "known_unavailable",
          containersAbsent: () => true,
          now: () => 0,
          wait: async () => {},
        });
      },
    },
  ) as typeof restartRuntimeOwnedDockerForRecovery;
  return { result: await runComposition("fixture", controller.signal), calls };
}

test("production composition preserves inherited stop intent without native S replay", async () => {
  const { result, calls } = await compose("handoff");
  assert.equal(result.status, "completed");
  assert.equal(result.restartCompleted, true);
  assert.equal(result.taskRecoveryCompleted, false);
  assert.deepEqual(calls, [
    "handoff",
    "stop_intent",
    "stopped",
    "start_intent",
    "L",
    "ready",
    "helper_release",
    "settled",
    "lock_release",
  ]);
});

test("production composition failed handoff cannot issue stop start or phase publication", async () => {
  const { result, calls } = await compose("handoff_failed");
  assert.equal(result.status, "blocked");
  assert.equal(result.restartCompleted, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(calls, ["handoff", "helper_release", "lock_release"]);
});

test("inherited stop intent with live Desktop remains blocked without replay", async () => {
  const { result, calls } = await compose("handoff_live");
  assert.equal(result.status, "blocked");
  assert.equal(result.restartCompleted, false);
  assert.equal(calls.includes("S"), false);
  assert.equal(calls.includes("L"), false);
  assert.equal(calls.includes("settled"), false);
});

test("production composition resumes current stop intent by observation without native S", async () => {
  const { result, calls } = await compose("resume");
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, [
    "stopped",
    "start_intent",
    "L",
    "ready",
    "helper_release",
    "settled",
    "lock_release",
  ]);
});

test("production composition resumes current start intent by ready observation without native effect replay", async () => {
  const { result, calls } = await compose("resume_start_intent");
  assert.equal(result.status, "completed");
  assert.equal(result.restartCompleted, true);
  assert.deepEqual(calls, [
    "ready",
    "helper_release",
    "settled",
    "lock_release",
  ]);
  assert.equal(calls.includes("S"), false);
  assert.equal(calls.includes("L"), false);
});

test("signed restart entry rejects cancellation before preparation", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await restartRuntimeOwnedDockerForRecovery(
    "not-a-recovery-id",
    controller.signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_cancelled");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.restartCompleted, false);
  assert.equal(result.taskRecoveryCompleted, false);
});

test("signed restart entry rejects invalid recovery identity before native acquisition", async () => {
  const result = await restartRuntimeOwnedDockerForRecovery(
    "not-a-recovery-id",
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_id_invalid");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.restartCompleted, false);
  assert.equal(result.taskRecoveryCompleted, false);
});
