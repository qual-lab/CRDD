import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { renderDockerRecoveryDoctorReport } from "../src/core/docker-recovery-command-report.ts";
import {
  closeWindowsDockerDesktopRepairUsingDependencies,
  describeDockerDesktopRuntimeRepairContract,
  repairWindowsDockerDesktopRuntimeUsingDependencies,
  type PreparedBoundary,
  type RepairDependencies,
} from "../src/security/docker-desktop-runtime-repair.ts";
import type {
  DockerDesktopRepairLedgerSnapshot,
  DockerDesktopRepairOperation,
} from "../src/security/docker-desktop-repair-record-store.ts";

const runIdentity = Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" });
const policy = Object.freeze({
  policySha256: "5".repeat(64),
  dockerDesktopVersion: "4.41.2",
  engineVersion: "28.1.1",
  artifacts: new Map(),
});
const boundary: PreparedBoundary = Object.freeze({
  runtimeStateRoot: "C:\\runtime-state",
  runtimeStateIdentityHash: "1".repeat(64),
  runtimeStateProtectionHash: "2".repeat(64),
  localUserBindingHash: "3".repeat(64),
  runtimeStateBindingHash: "4".repeat(64),
  dockerPolicySha256: policy.policySha256,
  localAppData: "C:\\local",
  runDirectory: "C:\\local\\Docker\\run",
  socketPath: "C:\\local\\Docker\\run\\dockerInference",
  platformAccessArtifact: Object.freeze({ sha256: "6".repeat(64) }),
  policy,
});

function session(
  options: {
    release?: "released" | "cleanup_unknown";
    processes?: "absent" | "verified" | "unknown";
    terminate?: "absent" | "terminated" | "partial_or_unknown" | "unknown";
    live?: boolean;
  } = {},
) {
  return Object.freeze({
    assertLive: () => options.live ?? true,
    onFailureDetected: () => () => undefined,
    failureDetected: new Promise<void>(() => undefined),
    verifyArtifacts: async () => "verified" as const,
    inspectProcesses: async () => options.processes ?? ("verified" as const),
    terminateProcesses: async () =>
      options.terminate ?? ("terminated" as const),
    release: async () => options.release ?? ("released" as const),
  });
}

function fixture(overrides: Partial<RepairDependencies> = {}) {
  const calls: string[] = [];
  let operation: DockerDesktopRepairOperation | null = null;
  let renamed = false;
  let restarted = false;
  let terminated = false;
  let engineObservations = 0;
  const helper = Object.freeze({
    ...session(),
    inspectProcesses: async () =>
      restarted || !terminated ? ("verified" as const) : ("absent" as const),
    terminateProcesses: async () => {
      terminated = true;
      return "terminated" as const;
    },
  });
  const dependencies: RepairDependencies = {
    prepareBoundary: () => {
      calls.push("prepare");
      return boundary;
    },
    acquireHelper: async () => {
      calls.push("helper");
      return Object.freeze({ status: "acquired" as const, session: helper });
    },
    inventory: () =>
      Object.freeze({
        status: "verified" as const,
        operations: Object.freeze(operation ? [operation] : []),
      }),
    observeEngine: () => {
      engineObservations += 1;
      calls.push(`engine:${engineObservations}`);
      return restarted ? "ready" : "known_unavailable";
    },
    observeKnownSocketFailure: () => {
      calls.push("socket");
      return runIdentity;
    },
    persistStage: (_boundary, current, stage, ledger) => {
      calls.push(`persist:${stage}`);
      operation = Object.freeze({
        ...current,
        stage,
        sequence: current.sequence + 1,
        previousRecordSha256: String(current.sequence + 1).padStart(64, "0"),
        ledger: Object.freeze({ ...ledger }),
      });
      return operation;
    },
    officialShutdown: () => {
      calls.push("shutdown");
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    terminateDockerWsl: () => {
      calls.push("wsl");
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    renameRunDirectory: () => {
      calls.push("rename");
      renamed = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    startDesktop: () => {
      calls.push("start");
      restarted = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    awaitEngine: async () => {
      calls.push("await-engine");
      return "ready" as const;
    },
    identityAt: (target) => {
      if (target === boundary.runDirectory)
        return renamed && !restarted ? null : runIdentity;
      if (target.includes("run.crdd-stale-"))
        return renamed ? runIdentity : null;
      return null;
    },
    ...overrides,
  };
  return Object.freeze({
    calls,
    dependencies,
    setOperation: (value: DockerDesktopRepairOperation) => {
      operation = value;
      renamed = [
        "renamed",
        "recovered_pending_disposition",
        "closed_retained",
      ].includes(value.stage);
      restarted = ["recovered_pending_disposition", "closed_retained"].includes(
        value.stage,
      );
    },
  });
}

test("既知障害だけを順序付きで処置し明示closeを要求する", async () => {
  const state = fixture();
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.filesystemEffectIssued, true);
  assert.equal(result.engineReady, true);
  assert.equal(result.staleRuntimeDirectory, "retained");
  assert.equal(result.deletionPerformed, false);
  assert.deepEqual(state.calls, [
    "prepare",
    "helper",
    "engine:1",
    "socket",
    "engine:2",
    "persist:prepared",
    "engine:3",
    "shutdown",
    "wsl",
    "persist:processes_stopped",
    "rename",
    "persist:renamed",
    "start",
    "await-engine",
    "persist:recovered_pending_disposition",
  ]);

  const close = await closeWindowsDockerDesktopRepairUsingDependencies(
    result.repairId,
    state.dependencies,
  );
  assert.equal(close.status, "closed_retained");
  assert.equal(close.newRepairPermitted, true);
  assert.equal(close.disposition, "retained_by_human_decision");
  assert.equal(close.deletionPerformed, false);
});

test("Engine ready・unknown・socket根拠なしではDocker Host Effectを発行しない", async () => {
  for (const scenario of [
    {
      observeEngine: () => "ready" as const,
      reason: "docker_desktop_engine_already_available",
    },
    {
      observeEngine: () => "unknown" as const,
      reason: "docker_desktop_engine_state_unknown",
    },
    {
      observeKnownSocketFailure: () => null,
      reason: "docker_desktop_known_socket_failure_unconfirmed",
    },
  ]) {
    const state = fixture(scenario);
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.equal(result.reason, scenario.reason);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.nativeHelperCleanupConfirmed, true);
  }
});

test("境界・lock不成立とhelper cleanup不明を区別する", async () => {
  const boundaryResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      fixture({ prepareBoundary: () => null }).dependencies,
    );
  assert.equal(
    boundaryResult.reason,
    "docker_desktop_repair_boundary_unavailable",
  );
  assert.equal(boundaryResult.manualRecoveryRequired, false);
  assert.equal(boundaryResult.effectStateUnknown, false);

  const lockResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      acquireHelper: async () =>
        Object.freeze({ status: "unavailable" as const, session: null }),
    }).dependencies,
  );
  assert.equal(lockResult.reason, "docker_desktop_repair_lock_unavailable");
  assert.equal(lockResult.manualRecoveryRequired, false);

  const cleanupResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      fixture({
        acquireHelper: async () =>
          Object.freeze({ status: "cleanup_unknown" as const, session: null }),
      }).dependencies,
    );
  assert.equal(cleanupResult.manualRecoveryRequired, true);
  assert.equal(cleanupResult.effectStateUnknown, true);
});

test("記録・process inventory・rename・restartの不明を成功へ昇格しない", async () => {
  const scenarios: readonly [Partial<RepairDependencies>, string][] = [
    [{ persistStage: () => null }, "docker_desktop_repair_record_unavailable"],
    [
      {
        acquireHelper: async () =>
          Object.freeze({
            status: "acquired" as const,
            session: session({ processes: "unknown" }),
          }),
      },
      "docker_desktop_process_inventory_unknown",
    ],
    [
      {
        acquireHelper: async () =>
          Object.freeze({
            status: "acquired" as const,
            session: session({
              processes: "verified",
              terminate: "terminated",
            }),
          }),
      },
      "docker_desktop_process_quiescence_unconfirmed",
    ],
    [
      {
        renameRunDirectory: () =>
          Object.freeze({
            issued: null,
            confirmation: "unknown" as const,
            staleState: "unknown" as const,
          }),
      },
      "docker_desktop_runtime_rename_unconfirmed",
    ],
    [
      {
        startDesktop: () =>
          Object.freeze({ issued: false, confirmation: "unknown" as const }),
      },
      "docker_desktop_restart_unconfirmed",
    ],
  ];
  for (const [overrides, reason] of scenarios) {
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      fixture(overrides).dependencies,
    );
    assert.equal(result.status, "blocked", reason);
    assert.equal(result.reason, reason);
    assert.equal(result.manualRecoveryRequired, true);
  }
});

test("helper解放不明は回復後も成功へ昇格しない", async () => {
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      acquireHelper: async () =>
        Object.freeze({
          status: "acquired" as const,
          session: session({ release: "cleanup_unknown" }),
        }),
    }).dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_desktop_repair_lock_cleanup_unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.nativeHelperCleanupConfirmed, false);
});

test("prepared再開は過去Process EffectをEffect 0へ誤投影しない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffectIssued: false,
    filesystemEffectIssued: true,
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    nativeHelperCleanupConfirmed: true,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "a".repeat(32),
    repairId: `docker-desktop-repair.${"a".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-a",
    staleName: `run.crdd-stale-${"a".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"a".repeat(32)}`,
    runIdentity,
    stage: "prepared",
    sequence: 0,
    previousRecordSha256: "9".repeat(64),
    ledger,
  });
  const state = fixture({ observeEngine: () => "ready" as const });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "closed_no_stale");
  assert.equal(result.processEffectIssued, null);
  assert.equal(result.newRepairPermitted, true);
});

test("Contractは自動fallback・全WSL停止・削除・PID killを許可しない", () => {
  const contract = describeDockerDesktopRuntimeRepairContract();
  assert.equal(contract.platform, "windows");
  assert.equal(contract.invocation, "explicit_doctor_only");
  assert.equal(contract.automaticFallback, false);
  assert.equal(contract.wslTermination, "docker_desktop_distribution_only");
  assert.equal(contract.staleDirectoryDeletion, false);
  assert.equal(contract.providerEffectIssued, false);
  const sources = [
    "../src/security/docker-desktop-runtime-repair.ts",
    "../../platform-access/src/docker_repair.rs",
  ].map((relative) =>
    fs.readFileSync(new URL(relative, import.meta.url), "utf8"),
  );
  assert.equal(
    sources.some((source) => source.includes('"--shutdown"')),
    false,
  );
  assert.equal(
    sources.some((source) => source.includes("taskkill")),
    false,
  );
  assert.equal(
    sources.some((source) => source.includes("rmSync(")),
    false,
  );
  assert.equal(
    sources.some((source) => source.includes("unlinkSync(")),
    false,
  );
});

test("人間表示はtri-stateと明示closeを示しPathを報告しない", () => {
  const repairId = `docker-desktop-repair.${"a".repeat(32)}`;
  const rendered = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "recovered_pending_close",
      reason: "docker_desktop_runtime_recovered_pending_close",
      repairId,
      manualRecoveryRequired: false,
      engineReady: true,
      processEffectIssued: true,
      filesystemEffectIssued: true,
      staleRuntimeDirectory: "retained",
      nativeHelperCleanupConfirmed: true,
    }),
    false,
  );
  assert.equal(rendered.exitCode, 2);
  assert.match(rendered.stdout, /Docker Engine ready: yes/u);
  assert.match(rendered.stdout, /stale runtime evidence: retained/u);
  assert.match(
    rendered.stdout,
    new RegExp(`--close-docker-desktop-runtime-repair ${repairId}`, "u"),
  );
  assert.doesNotMatch(rendered.stdout, /C:\\/u);
});
