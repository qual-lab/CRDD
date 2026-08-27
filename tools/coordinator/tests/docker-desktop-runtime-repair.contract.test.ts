import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { renderDockerRecoveryDoctorReport } from "../src/core/docker-recovery-command-report.ts";
import {
  describeDockerDesktopRuntimeRepairContract,
  repairWindowsDockerDesktopRuntimeUsingDependencies,
} from "../src/security/docker-desktop-runtime-repair.ts";

const boundary = Object.freeze({
  runtimeStateRoot: "C:\\runtime-state",
  runtimeStateIdentityHash: "1".repeat(64),
  runtimeStateProtectionHash: "2".repeat(64),
  localUserBindingHash: "3".repeat(64),
  runtimeStateBindingHash: "4".repeat(64),
  runDirectory: "C:\\local\\Docker\\run",
  socketPath: "C:\\local\\Docker\\run\\dockerInference",
  staleDirectory: "C:\\local\\Docker\\run.crdd-stale-a",
  staleName: "run.crdd-stale-a",
  operationDirectory: "C:\\runtime-state\\docker-desktop-repair-a",
  operationId: "a".repeat(32),
});

function lock(
  release:
    | "released"
    | "cleanup_unknown"
    | "cleanup_confirmed_failure" = "released",
) {
  return Object.freeze({
    assertLive: () => true,
    onFailureDetected: () => () => undefined,
    failureDetected: new Promise<void>(() => undefined),
    loss: new Promise<"cleanup_unknown" | "cleanup_confirmed_failure">(
      () => undefined,
    ),
    confirmReady: async () => "ready" as const,
    release: async () => release,
  });
}

function dependencies(
  overrides: Record<string, unknown> = {},
  calls: string[] = [],
) {
  let processObservations = 0;
  const value = {
    prepareBoundary: () => {
      calls.push("prepare");
      return boundary;
    },
    acquireLock: async () => {
      calls.push("lock");
      return Object.freeze({ status: "acquired" as const, lock: lock() });
    },
    engineAvailable: () => {
      calls.push("engine-before");
      return false;
    },
    knownSocketFailure: () => {
      calls.push("socket");
      return true;
    },
    persistState: (_boundary: unknown, state: string) => {
      calls.push(`persist:${state}`);
      return true;
    },
    stopDesktop: () => {
      calls.push("stop");
      return true;
    },
    processesAbsent: () => {
      processObservations += 1;
      calls.push(`processes:${processObservations}`);
      return true;
    },
    forceStopVerifiedProcesses: () => {
      calls.push("force-stop");
      return true;
    },
    terminateDockerWsl: () => {
      calls.push("wsl");
      return true;
    },
    renameRunDirectory: () => {
      calls.push("rename");
      return true;
    },
    startDesktop: () => {
      calls.push("start");
      return true;
    },
    awaitEngine: async () => {
      calls.push("engine-after");
      return true;
    },
    ...overrides,
  };
  return value;
}

test("Windows Docker Desktop最終復旧は既知障害だけを順序付きで処置する", async () => {
  const calls: string[] = [];
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    dependencies({}, calls),
  );
  assert.equal(result.status, "recovered");
  assert.equal(result.reason, "docker_desktop_runtime_repaired");
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.filesystemEffectIssued, true);
  assert.equal(result.engineReady, true);
  assert.equal(result.staleRuntimeDirectoryRetained, true);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(result.pathReported, false);
  assert.equal(result.credentialReported, false);
  assert.equal(result.providerEffectIssued, false);
  assert.deepEqual(calls, [
    "prepare",
    "lock",
    "engine-before",
    "socket",
    "engine-before",
    "persist:prepared",
    "stop",
    "processes:1",
    "wsl",
    "persist:processes_stopped",
    "rename",
    "persist:renamed",
    "start",
    "engine-after",
    "persist:recovered",
  ]);
});

test("Engine稼働中または既知socket障害不成立ではHost Effectを発行しない", async () => {
  const availableCalls: string[] = [];
  const available = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    dependencies(
      {
        engineAvailable: () => {
          availableCalls.push("engine-before");
          return true;
        },
      },
      availableCalls,
    ),
  );
  assert.equal(available.reason, "docker_desktop_engine_already_available");
  assert.equal(available.engineReady, true);
  assert.equal(available.processEffectIssued, false);
  assert.equal(available.filesystemEffectIssued, false);
  assert.deepEqual(availableCalls, ["prepare", "lock", "engine-before"]);

  const unknownCalls: string[] = [];
  const unknown = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    dependencies(
      {
        knownSocketFailure: () => {
          unknownCalls.push("socket");
          return false;
        },
      },
      unknownCalls,
    ),
  );
  assert.equal(
    unknown.reason,
    "docker_desktop_known_socket_failure_unconfirmed",
  );
  assert.equal(unknown.processEffectIssued, false);
  assert.equal(unknown.filesystemEffectIssued, false);
  assert.deepEqual(unknownCalls, [
    "prepare",
    "lock",
    "engine-before",
    "socket",
  ]);

  let engineObservations = 0;
  const recoveredDuringConfirmationCalls: string[] = [];
  const recoveredDuringConfirmation =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      dependencies(
        {
          engineAvailable: () => {
            engineObservations += 1;
            recoveredDuringConfirmationCalls.push(
              `engine:${engineObservations}`,
            );
            return engineObservations === 2;
          },
        },
        recoveredDuringConfirmationCalls,
      ),
    );
  assert.equal(
    recoveredDuringConfirmation.reason,
    "docker_desktop_engine_recovered_before_effect",
  );
  assert.equal(recoveredDuringConfirmation.engineReady, true);
  assert.equal(recoveredDuringConfirmation.processEffectIssued, false);
  assert.equal(recoveredDuringConfirmation.filesystemEffectIssued, false);
  assert.deepEqual(recoveredDuringConfirmationCalls, [
    "prepare",
    "lock",
    "engine:1",
    "socket",
    "engine:2",
  ]);
});

test("境界または専用lock不成立では診断先を広げない", async () => {
  const boundaryCalls: string[] = [];
  const unavailableBoundary =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      dependencies(
        {
          prepareBoundary: () => {
            boundaryCalls.push("prepare");
            return null;
          },
        },
        boundaryCalls,
      ),
    );
  assert.equal(
    unavailableBoundary.reason,
    "docker_desktop_repair_boundary_unavailable",
  );
  assert.deepEqual(boundaryCalls, ["prepare"]);

  for (const scenario of [
    {
      status: "unavailable" as const,
      reason: "docker_desktop_repair_lock_unavailable",
      manual: false,
    },
    {
      status: "cleanup_unknown" as const,
      reason: "docker_desktop_repair_lock_cleanup_unknown",
      manual: true,
    },
  ]) {
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      dependencies({
        acquireLock: async () =>
          Object.freeze({ status: scenario.status, lock: null }),
      }),
    );
    assert.equal(result.reason, scenario.reason);
    assert.equal(result.manualRecoveryRequired, scenario.manual);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
  }
});

test("最初の耐久記録不成立と依存例外を成功またはEffect 0へ誤投影しない", async () => {
  const recordFailure =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      dependencies({ persistState: () => false }),
    );
  assert.equal(
    recordFailure.reason,
    "docker_desktop_repair_record_unavailable",
  );
  assert.equal(recordFailure.filesystemEffectIssued, true);
  assert.equal(recordFailure.manualRecoveryRequired, true);

  const exception = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    dependencies({ stopDesktop: () => assert.fail("injected failure") }),
  );
  assert.equal(exception.reason, "docker_desktop_repair_failed_closed");
  assert.equal(exception.effectStateUnknown, true);
  assert.equal(exception.manualRecoveryRequired, true);
});

test("通常shutdown後に残るProcessは検証済み強制終了を一度だけ使う", async () => {
  const calls: string[] = [];
  let observed = 0;
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    dependencies(
      {
        processesAbsent: () => {
          observed += 1;
          calls.push(`processes:${observed}`);
          return observed > 1;
        },
      },
      calls,
    ),
  );
  assert.equal(result.status, "recovered");
  assert.deepEqual(calls.slice(6, 11), [
    "stop",
    "processes:1",
    "force-stop",
    "processes:2",
    "wsl",
  ]);
});

test("Process identity、WSL停止またはrenameが不明なら退避前にFail Closedにする", async () => {
  for (const scenario of [
    {
      reason: "docker_desktop_process_identity_unconfirmed",
      overrides: {
        processesAbsent: () => false,
        forceStopVerifiedProcesses: () => false,
      },
    },
    {
      reason: "docker_desktop_wsl_termination_unconfirmed",
      overrides: { terminateDockerWsl: () => false },
    },
    {
      reason: "docker_desktop_process_termination_unconfirmed",
      overrides: {
        processesAbsent: () => false,
        forceStopVerifiedProcesses: () => true,
      },
    },
    {
      reason: "docker_desktop_runtime_rename_failed",
      overrides: { renameRunDirectory: () => false },
    },
  ]) {
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      dependencies(scenario.overrides),
    );
    assert.equal(result.status, "blocked", scenario.reason);
    assert.equal(result.reason, scenario.reason);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.filesystemEffectIssued, true);
    assert.equal(result.staleRuntimeDirectoryRetained, false);
  }
});

test("rename後のrestartまたはEngine確認失敗は退避物を保持して手動回復へ返す", async () => {
  for (const scenario of [
    {
      reason: "docker_desktop_restart_failed",
      overrides: { startDesktop: () => false },
    },
    {
      reason: "docker_desktop_engine_restart_unconfirmed",
      overrides: { awaitEngine: async () => false },
    },
    {
      reason: "docker_desktop_repair_record_update_failed",
      overrides: {
        persistState: (_boundary: unknown, state: string) =>
          state !== "recovered",
      },
    },
  ]) {
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      dependencies(scenario.overrides),
    );
    assert.equal(result.status, "blocked", scenario.reason);
    assert.equal(result.reason, scenario.reason);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.filesystemEffectIssued, true);
    assert.equal(result.staleRuntimeDirectoryRetained, true);
  }
});

test("lock解放不明はEngine回復後でも成功へ昇格しない", async () => {
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    dependencies({
      acquireLock: async () =>
        Object.freeze({
          status: "acquired" as const,
          lock: lock("cleanup_unknown"),
        }),
    }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_desktop_repair_lock_cleanup_unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.engineReady, true);
  assert.equal(result.staleRuntimeDirectoryRetained, true);
});

test("最終復旧Contractは通常fallback、削除および広域WSL停止を許可しない", () => {
  const contract = describeDockerDesktopRuntimeRepairContract();
  assert.equal(contract.platform, "windows");
  assert.equal(contract.invocation, "explicit_doctor_only");
  assert.equal(contract.automaticFallback, false);
  assert.equal(contract.wslTermination, "docker_desktop_distribution_only");
  assert.equal(
    contract.filesystemEffect,
    "same_parent_run_directory_rename_without_deletion",
  );
  assert.equal(
    contract.staleDirectoryRetention,
    "retained_for_explicit_later_disposition",
  );
  assert.equal(contract.protectedRootsModified, false);
  assert.equal(contract.providerEffectIssued, false);

  const source = fs.readFileSync(
    new URL(
      "../src/security/docker-desktop-runtime-repair.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(source.includes('"/T"'), false);
  assert.equal(source.includes('"--shutdown"'), false);
  assert.equal(source.includes("rmSync("), false);
  assert.equal(source.includes("unlinkSync("), false);
});

test("最終復旧の人間表示はPathを出さずEngineと退避状態を示す", () => {
  const rendered = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "blocked",
      reason: "docker_desktop_engine_restart_unconfirmed",
      manualRecoveryRequired: true,
      engineReady: false,
      staleRuntimeDirectoryRetained: true,
      effectStateUnknown: false,
    }),
    false,
  );
  assert.equal(rendered.exitCode, 2);
  assert.match(rendered.stdout, /Docker Engine ready: no/u);
  assert.match(
    rendered.stdout,
    /stale Docker runtime directory retained: yes/u,
  );
  assert.match(rendered.stdout, /effect state unknown: no/u);
  assert.doesNotMatch(rendered.stdout, /C:\\/u);
});
