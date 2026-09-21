/**
 * coordinator:integration:docker-restart-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-restart-runtimeが所有する検証責務を実行する。
 * @trace ERB-IT-014
 * @level IT
 * @scope docker、restart、runtime
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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

/**
 * composeのTest準備責務を実行する。
 *
 * @responsibility composeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus composeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
async function compose(
  change:
    | "handoff"
    | "handoff_failed"
    | "resume"
    | "resume_start_intent"
    | "engine_cleanup_unknown"
    | "handoff_live",
) {
  const calls: string[] = [];
  const context = Object.freeze({});
  const controller = new AbortController();
  const isResume =
    change === "resume" ||
    change === "resume_start_intent" ||
    change === "engine_cleanup_unknown";
  let processes: "verified" | "absent" =
    change === "handoff_live" ? "verified" : "absent";
  let wsl: "running" | "stopped" =
    change === "handoff_live" ||
    change === "resume_start_intent" ||
    change === "engine_cleanup_unknown"
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
          change === "resume_start_intent" ||
          change === "engine_cleanup_unknown"
            ? "start_intent"
            : "stop_intent",
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
          observeEngine: () => {
            const state = wsl === "running" ? "ready" : "known_unavailable";
            return change === "engine_cleanup_unknown"
              ? { state, cleanup: "unknown" as const }
              : state;
          },
          containersAbsent: () => true,
          now: () => 0,
          wait: async () => {},
        });
      },
    },
  ) as typeof restartRuntimeOwnedDockerForRecovery;
  return { result: await runComposition("fixture", controller.signal), calls };
}

/**
 * production composition preserves inherited stop intent without native S replayを検証する。
 *
 * @responsibility production composition preserves inherited stop intent without native S replayの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production composition preserves inherited stop intent without native S replayの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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

/**
 * production composition failed handoff cannot issue stop start or phase publicationを検証する。
 *
 * @responsibility production composition failed handoff cannot issue stop start or phase publicationの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production composition failed handoff cannot issue stop start or phase publicationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("production composition failed handoff cannot issue stop start or phase publication", async () => {
  const { result, calls } = await compose("handoff_failed");
  assert.equal(result.status, "blocked");
  assert.equal(result.restartCompleted, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(calls, ["handoff", "helper_release", "lock_release"]);
});

/**
 * inherited stop intent with live Desktop remains blocked without replayを検証する。
 *
 * @responsibility inherited stop intent with live Desktop remains blocked without replayの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus inherited stop intent with live Desktop remains blocked without replayの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("inherited stop intent with live Desktop remains blocked without replay", async () => {
  const { result, calls } = await compose("handoff_live");
  assert.equal(result.status, "blocked");
  assert.equal(result.restartCompleted, false);
  assert.equal(calls.includes("S"), false);
  assert.equal(calls.includes("L"), false);
  assert.equal(calls.includes("settled"), false);
});

/**
 * production composition resumes current stop intent by observation without native Sを検証する。
 *
 * @responsibility production composition resumes current stop intent by observation without native Sの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production composition resumes current stop intent by observation without native Sの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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

/**
 * production composition resumes current start intent by ready observation without native effect replayを検証する。
 *
 * @responsibility production composition resumes current start intent by ready observation without native effect replayの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production composition resumes current start intent by ready observation without native effect replayの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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

/**
 * production composition preserves Engine observation cleanup uncertainty through finallyを検証する。
 *
 * @responsibility production composition preserves Engine observation cleanup uncertainty through finallyの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production composition preserves Engine observation cleanup uncertainty through finallyの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("production composition preserves Engine observation cleanup uncertainty through finally", async () => {
  const { result, calls } = await compose("engine_cleanup_unknown");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_cleanup_unconfirmed");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.restartCompleted, false);
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
  assert.equal(calls.includes("settled"), false);
  assert.deepEqual(calls, ["ready", "helper_release", "lock_release"]);
});

/**
 * signed restart entry rejects cancellation before preparationを検証する。
 *
 * @responsibility signed restart entry rejects cancellation before preparationの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus signed restart entry rejects cancellation before preparationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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

/**
 * signed restart entry rejects invalid recovery identity before native acquisitionを検証する。
 *
 * @responsibility signed restart entry rejects invalid recovery identity before native acquisitionの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus signed restart entry rejects invalid recovery identity before native acquisitionの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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
