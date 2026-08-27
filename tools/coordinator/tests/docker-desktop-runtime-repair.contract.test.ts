import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
import {
  createDockerDesktopRepairOperation,
  inventoryDockerDesktopRepairOperations,
  persistDockerDesktopRepairStage,
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
  crddManifestHash: "7".repeat(64),
  crddReleaseSequence: 1,
  crddTree: "8".repeat(40),
  packageContentRootSha256: "9".repeat(64),
  localAppData: "C:\\local",
  runDirectory: "C:\\local\\Docker\\run",
  socketPath: "C:\\local\\Docker\\run\\dockerInference",
  platformAccessArtifact: Object.freeze({ sha256: "6".repeat(64) }),
  policy,
});

function session(
  options: {
    release?: "released" | "protocol_failed" | "cleanup_unknown";
    processes?: "absent" | "verified" | "unknown";
    terminate?:
      | "absent"
      | "not_issued_unknown"
      | "terminated"
      | "partial_or_unknown"
      | "unknown";
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
    launchDesktop: async () => "started" as const,
    abort: async () =>
      Object.freeze({
        cleanup: "confirmed" as const,
        protocol: "not_applicable" as const,
      }),
    release: async () =>
      options.release === "cleanup_unknown"
        ? Object.freeze({
            cleanup: "unknown" as const,
            protocol: "failed" as const,
          })
        : options.release === "protocol_failed"
          ? Object.freeze({
              cleanup: "confirmed" as const,
              protocol: "failed" as const,
            })
          : Object.freeze({
              cleanup: "confirmed" as const,
              protocol: "completed" as const,
            }),
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
    launchDesktop: async () => {
      calls.push("start");
      restarted = true;
      return "started" as const;
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
    observePath: (target) => {
      if (overrides.identityAt) {
        const observed = overrides.identityAt(target);
        return observed
          ? Object.freeze({ state: "present" as const, identity: observed })
          : Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            });
      }
      if (target === boundary.runDirectory)
        return renamed && !restarted
          ? Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            })
          : Object.freeze({ state: "present" as const, identity: runIdentity });
      if (target.includes("run.crdd-stale-"))
        return renamed
          ? Object.freeze({ state: "present" as const, identity: runIdentity })
          : Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            });
      return Object.freeze({ state: "unknown" as const, identity: null });
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
      if (
        value.stage === "no_stale_known_effect_recovery_pending" ||
        value.stage === "closed_no_stale_known_effect_retained" ||
        value.stage === "no_stale_historical_effect_unknown_pending" ||
        value.stage === "closed_historical_effect_unknown_retained"
      )
        restarted = true;
    },
  });
}

function operationFixture(
  stage: DockerDesktopRepairOperation["stage"],
  ledgerOverrides: Partial<DockerDesktopRepairLedgerSnapshot> = {},
): DockerDesktopRepairOperation {
  const id = "f".repeat(32);
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "observed_runtime_directory_rename",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
      Object.freeze({
        sequence: 1,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
    ...ledgerOverrides,
  });
  return Object.freeze({
    operationId: id,
    repairId: `docker-desktop-repair.${id}`,
    operationDirectory: `C:\\runtime-state\\docker-desktop-repair-${id}`,
    staleName: `run.crdd-stale-${id}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${id}`,
    runIdentity,
    stage,
    sequence: 1,
    previousRecordSha256: "f".repeat(64),
    ledger,
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
  assert.deepEqual(
    state.calls.filter((call) =>
      [
        "shutdown",
        "wsl",
        "rename",
        "start",
        "persist:prepared",
        "persist:processes_stopped",
        "persist:renamed",
        "persist:recovered_pending_disposition",
      ].includes(call),
    ),
    [
      "persist:prepared",
      "persist:prepared",
      "shutdown",
      "persist:prepared",
      "persist:prepared",
      "persist:prepared",
      "persist:prepared",
      "wsl",
      "persist:prepared",
      "persist:processes_stopped",
      "persist:processes_stopped",
      "rename",
      "persist:processes_stopped",
      "persist:renamed",
      "persist:renamed",
      "start",
      "persist:renamed",
      "persist:recovered_pending_disposition",
    ],
  );

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

test("intent耐久化後のEngine回復・不明はHost関数を呼ばずsettlementへ閉じる", async () => {
  for (const afterIntent of ["ready", "unknown"] as const) {
    let observations = 0;
    const state = fixture({
      observeEngine: () => {
        observations += 1;
        return observations <= 2 ? "known_unavailable" : afterIntent;
      },
    });
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.equal(state.calls.includes("shutdown"), false);
    assert.equal(result.processEffectIssued, false);
    if (afterIntent === "ready") {
      assert.equal(result.status, "recovered_pending_close");
      assert.equal(
        result.operationState,
        "no_stale_known_effect_recovery_pending",
      );
    } else {
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        "docker_desktop_repair_pre_effect_state_unknown",
      );
    }
  }
});

test("Effect別fresh行列はWSL／rename直前のProcess再出現をEffect 0へ閉じる", async () => {
  let inspections = 0;
  let wslCalls = 0;
  const wslState = fixture({
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session({ processes: "absent", terminate: "absent" }),
        inspectProcesses: async () => {
          inspections += 1;
          return inspections >= 3 ? ("verified" as const) : ("absent" as const);
        },
      }),
    }),
    terminateDockerWsl: () => {
      wslCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
  });
  const wslResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    wslState.dependencies,
  );
  assert.equal(wslResult.status, "blocked");
  assert.equal(wslCalls, 0);

  const stopped = operationFixture("processes_stopped", {
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
      Object.freeze({
        sequence: 1,
        action: "wsl_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    evidenceState: "preserved",
  });
  let renameCalls = 0;
  const renameState = fixture({
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "verified" }),
    }),
    renameRunDirectory: () => {
      renameCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
  });
  renameState.setOperation(stopped);
  const renameResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    renameState.dependencies,
  );
  assert.equal(renameResult.status, "blocked");
  assert.equal(renameCalls, 0);
});

test("64 retained operationでは新規operation directory／recordを作らない", async () => {
  const retained = operationFixture("closed_retained", {
    engineReady: true,
    disposition: "retained_by_human_decision",
    liveRunIdentity: runIdentity,
  });
  let persisted = 0;
  const state = fixture({
    inventory: () =>
      Object.freeze({
        status: "verified" as const,
        operations: Object.freeze(Array.from({ length: 64 }, () => retained)),
      }),
    persistStage: (..._args) => {
      persisted += 1;
      return null;
    },
    observePath: (target) =>
      target.includes("run.crdd-stale-")
        ? Object.freeze({ state: "present" as const, identity: runIdentity })
        : Object.freeze({ state: "present" as const, identity: runIdentity }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.reason,
    "docker_desktop_repair_operation_capacity_unavailable",
  );
  assert.equal(persisted, 0);
  assert.equal(state.calls.includes("shutdown"), false);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.operatorActionRequired, true);
  const rendered = renderDockerRecoveryDoctorReport(result, false);
  assert.match(rendered.stdout, /do not retry, delete, or compact/u);
});

test("残容量不足では次のHost Effectを発行しない", async () => {
  let terminationCalls = 0;
  const prepared = Object.freeze({
    ...operationFixture("prepared", {
      processEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "official_shutdown",
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ]),
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "record_write",
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ]),
      staleState: "absent",
    }),
    sequence: 13,
  });
  const state = fixture({
    acquireHelper: async () =>
      Object.freeze({
        status: "acquired" as const,
        session: Object.freeze({
          ...session({ processes: "verified" }),
          terminateProcesses: async () => {
            terminationCalls += 1;
            return "terminated" as const;
          },
        }),
      }),
  });
  state.setOperation(prepared);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(terminationCalls, 0);
  assert.equal(state.calls.includes("wsl"), false);
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
      "docker_desktop_repair_pre_effect_state_unknown",
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
      "docker_desktop_repair_pre_effect_state_unknown",
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
        acquireHelper: async () =>
          Object.freeze({
            status: "acquired" as const,
            session: Object.freeze({
              ...session(),
              inspectProcesses: async () => "absent" as const,
              launchDesktop: async () => "unknown" as const,
            }),
          }),
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

test("K/Nとrun path unknownは後続WSL／launcher Effectを発行しない", async () => {
  const unknownTermination = fixture({
    acquireHelper: async () =>
      Object.freeze({
        status: "acquired" as const,
        session: session({
          processes: "verified",
          terminate: "not_issued_unknown",
        }),
      }),
  });
  const terminationResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      unknownTermination.dependencies,
    );
  assert.equal(
    terminationResult.reason,
    "docker_desktop_process_state_unknown_without_effect",
  );
  assert.equal(unknownTermination.calls.includes("wsl"), false);

  const renamedOperation = operationFixture("renamed");
  const unknownPath = fixture({
    observePath: (target) =>
      target.includes("run.crdd-stale-")
        ? Object.freeze({ state: "present" as const, identity: runIdentity })
        : Object.freeze({ state: "unknown" as const, identity: null }),
  });
  unknownPath.setOperation(renamedOperation);
  const pathResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    unknownPath.dependencies,
  );
  assert.equal(pathResult.status, "blocked");
  assert.equal(unknownPath.calls.includes("start"), false);
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

test("repairはhelper解放後のpackage世代変更をpending成功へ投影しない", async () => {
  let released = false;
  let launched = false;
  let terminated = false;
  let renamed = false;
  const changedBoundary = Object.freeze({
    ...boundary,
    packageContentRootSha256: "b".repeat(64),
  });
  const helper = Object.freeze({
    ...session(),
    inspectProcesses: async () =>
      launched || !terminated ? ("verified" as const) : ("absent" as const),
    terminateProcesses: async () => {
      terminated = true;
      return "terminated" as const;
    },
    release: async () => {
      released = true;
      return Object.freeze({
        cleanup: "confirmed" as const,
        protocol: "completed" as const,
      });
    },
    launchDesktop: async () => {
      launched = true;
      return "started" as const;
    },
  });
  const state = fixture({
    prepareBoundary: () => (released ? changedBoundary : boundary),
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: helper,
    }),
    renameRunDirectory: () => {
      renamed = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    observePath: (target) => {
      if (target === boundary.runDirectory)
        return renamed && !launched
          ? Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            })
          : Object.freeze({ state: "present" as const, identity: runIdentity });
      if (target.includes("run.crdd-stale-"))
        return renamed
          ? Object.freeze({ state: "present" as const, identity: runIdentity })
          : Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            });
      return Object.freeze({ state: "unknown" as const, identity: null });
    },
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_terminal_boundary_changed",
  );
});

test("helper解放後のboundary例外は取得済みrepair Evidenceを保持して正規化する", async () => {
  let released = false;
  let helperLaunched = false;
  let helperRenamed = false;
  const state = fixture({
    prepareBoundary: () => {
      if (released) throw new Error("C:\\secret\\boundary");
      return boundary;
    },
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session({ processes: "absent", terminate: "absent" }),
        inspectProcesses: async () =>
          helperLaunched ? ("verified" as const) : ("absent" as const),
        launchDesktop: async () => {
          helperLaunched = true;
          return "started" as const;
        },
        release: async () => {
          released = true;
          return Object.freeze({
            cleanup: "confirmed" as const,
            protocol: "completed" as const,
          });
        },
      }),
    }),
    renameRunDirectory: () => {
      helperRenamed = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    observePath: (target) =>
      target === boundary.runDirectory
        ? helperLaunched
          ? Object.freeze({ state: "present" as const, identity: runIdentity })
          : helperRenamed
            ? Object.freeze({
                state: "confirmed_absent" as const,
                identity: null,
              })
            : Object.freeze({
                state: "present" as const,
                identity: runIdentity,
              })
        : target.includes("run.crdd-stale-")
          ? helperRenamed
            ? Object.freeze({
                state: "present" as const,
                identity: runIdentity,
              })
            : Object.freeze({
                state: "confirmed_absent" as const,
                identity: null,
              })
          : Object.freeze({ state: "unknown" as const, identity: null }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_terminal_boundary_changed",
  );
  assert.match(result.repairId ?? "", /^docker-desktop-repair\.[a-f0-9]{32}$/u);
  assert.equal(result.nativeHelperCleanupConfirmed, true);
  assert.equal(result.newRepairPermitted, false);
});

test("prepared再開は過去Process EffectをEffect 0へ誤投影しない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
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
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, null);
  assert.equal(result.newRepairPermitted, false);
});

test("preparedはsettlement済みshutdown／K／WSLを再発行せず次の状態へ進む", async () => {
  for (const actions of [
    ["official_shutdown"],
    ["official_shutdown", "native_termination"],
    ["official_shutdown", "wsl_termination"],
  ] as const) {
    const processEffects = Object.freeze(
      actions.map((action, sequence) =>
        Object.freeze({
          sequence,
          action,
          phase: "settled" as const,
          issued: true,
          confirmation: "confirmed" as const,
        }),
      ),
    );
    const operation = operationFixture("prepared", {
      processEffects,
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "record_write",
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ]),
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "confirmed",
      staleState: "absent",
    });
    const state = fixture({
      acquireHelper: async () =>
        Object.freeze({
          status: "acquired" as const,
          session: session({ processes: "absent" }),
        }),
    });
    state.setOperation(operation);
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.notEqual(
      result.reason,
      "docker_desktop_repair_authority_changed_after_intent",
    );
    assert.equal(state.calls.includes("shutdown"), false);
    if ((actions as readonly string[]).includes("wsl_termination"))
      assert.equal(state.calls.includes("wsl"), false);
  }
});

test("renamed再開でEngineが既に回復済みならlauncherを二重起動しない", async () => {
  const recoveredRunIdentity = Object.freeze({
    dev: "7",
    ino: "8",
    birthtimeNs: "9",
  });
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "b".repeat(32),
    repairId: `docker-desktop-repair.${"b".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-b",
    staleName: `run.crdd-stale-${"b".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"b".repeat(32)}`,
    runIdentity,
    stage: "renamed",
    sequence: 2,
    previousRecordSha256: "8".repeat(64),
    ledger,
  });
  const state = fixture({
    observeEngine: () => "ready" as const,
    identityAt: (target) =>
      target === boundary.runDirectory
        ? recoveredRunIdentity
        : target.includes("run.crdd-stale-")
          ? runIdentity
          : null,
  });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(state.calls.includes("start"), false);
  assert.equal(
    state.calls.includes("persist:recovered_pending_disposition"),
    true,
  );
});

test("processes_stopped再開は既知issuedを保持してno-stale pendingへ進む", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "d".repeat(32),
    repairId: `docker-desktop-repair.${"d".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-d",
    staleName: `run.crdd-stale-${"d".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"d".repeat(32)}`,
    runIdentity,
    stage: "processes_stopped",
    sequence: 1,
    previousRecordSha256: "6".repeat(64),
    ledger,
  });
  const state = fixture({ observeEngine: () => "ready" as const });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.processEffectConfirmation, "confirmed");
  assert.equal(result.effectStateUnknown, false);
});

test("processes_stopped再開はProcess不明または置換runをpendingへ昇格しない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "1".repeat(32),
    repairId: `docker-desktop-repair.${"1".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-1",
    staleName: `run.crdd-stale-${"1".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"1".repeat(32)}`,
    runIdentity,
    stage: "processes_stopped",
    sequence: 1,
    previousRecordSha256: "6".repeat(64),
    ledger,
  });
  const unknown = fixture({
    observeEngine: () => "ready" as const,
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "unknown" }),
    }),
  });
  unknown.setOperation(operation);
  const unknownResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      unknown.dependencies,
    );
  assert.equal(unknownResult.status, "blocked");
  assert.equal(
    unknown.calls.includes(
      "persist:no_stale_historical_effect_unknown_pending",
    ),
    false,
  );

  const foreignIdentity = Object.freeze({
    dev: "9",
    ino: "9",
    birthtimeNs: "9",
  });
  const replaced = fixture({
    observeEngine: () => "ready" as const,
    identityAt: (target) =>
      target === boundary.runDirectory ? foreignIdentity : null,
  });
  replaced.setOperation(operation);
  const replacedResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      replaced.dependencies,
    );
  assert.equal(replacedResult.status, "blocked");
});

test("rename Effect後settlement前の再開はexact staleをadoptし再renameしない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "runtime_directory_rename",
        phase: "intent_recorded",
        issued: null,
        confirmation: "unknown",
      }),
    ]),
    filesystemEffectIssued: null,
    filesystemEffectConfirmation: "unknown",
    engineReady: false,
    staleState: "unknown",
    hostSafety: "unknown",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "2".repeat(32),
    repairId: `docker-desktop-repair.${"2".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-2",
    staleName: `run.crdd-stale-${"2".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"2".repeat(32)}`,
    runIdentity,
    stage: "processes_stopped",
    sequence: 3,
    previousRecordSha256: "7".repeat(64),
    ledger,
  });
  const state = fixture({
    observeEngine: () => "known_unavailable" as const,
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "absent" }),
    }),
    identityAt: (target) =>
      target.includes("run.crdd-stale-") ? runIdentity : null,
  });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(state.calls.includes("rename"), false);
  assert.equal(state.calls.includes("persist:renamed"), true);
});

test("processes_stopped再開は実rev4 Storeでも単調にpersistできる", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repair-resume-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  const runDirectory = path.join(localAppData, "Docker", "run");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(runDirectory, { recursive: true });
  const metadata = fs.lstatSync(runDirectory, { bigint: true });
  const actualRunIdentity = Object.freeze({
    dev: String(metadata.dev),
    ino: String(metadata.ino),
    birthtimeNs: String(metadata.birthtimeNs),
  });
  const actualBoundary: PreparedBoundary = Object.freeze({
    ...boundary,
    runtimeStateRoot,
    localAppData,
    runDirectory,
    socketPath: path.join(runDirectory, "dockerInference"),
  });
  const baseLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const created = createDockerDesktopRepairOperation(
    actualBoundary,
    actualRunIdentity,
    baseLedger,
  );
  const writeRecord = (
    current: DockerDesktopRepairOperation,
    stage: DockerDesktopRepairOperation["stage"],
    nextLedger: DockerDesktopRepairLedgerSnapshot,
  ) => {
    const lastWrite = nextLedger.filesystemEffects.findLastIndex(
      (entry) => entry.action === "record_write",
    );
    const filesystemEffects = nextLedger.filesystemEffects.map(
      (entry, index) =>
        index === lastWrite && entry.confirmation === "unknown"
          ? Object.freeze({ ...entry, confirmation: "confirmed" as const })
          : entry,
    );
    filesystemEffects.push(
      Object.freeze({
        sequence: filesystemEffects.length,
        action: "record_write" as const,
        phase: "settled" as const,
        issued: true,
        confirmation: "unknown" as const,
      }),
    );
    return persistDockerDesktopRepairStage(
      actualBoundary,
      current,
      stage,
      Object.freeze({
        ...nextLedger,
        evidenceState:
          lastWrite >= 0 ? ("preserved" as const) : nextLedger.evidenceState,
        filesystemEffects: Object.freeze(filesystemEffects),
        filesystemEffectIssued: true,
        filesystemEffectConfirmation: "unknown",
      }),
    );
  };
  const prepared = writeRecord(created, "prepared", baseLedger);
  assert.ok(prepared);
  const addProcessEffect = (
    current: DockerDesktopRepairOperation,
    action: "official_shutdown" | "native_termination" | "wsl_termination",
    issued = true,
  ) => {
    const intentEntries = Object.freeze([
      ...current.ledger.processEffects,
      Object.freeze({
        sequence: current.ledger.processEffects.length,
        action,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]);
    const intent = writeRecord(
      current,
      current.stage,
      Object.freeze({
        ...current.ledger,
        processEffects: intentEntries,
        processEffectIssued: current.ledger.processEffectIssued ? true : null,
        processEffectConfirmation: "unknown",
      }),
    );
    assert.ok(intent);
    const settledEntries = Object.freeze(
      intent.ledger.processEffects.map((entry) =>
        entry.action === action
          ? Object.freeze({
              ...entry,
              phase: "settled" as const,
              issued,
              confirmation: issued
                ? ("confirmed" as const)
                : ("not_issued" as const),
            })
          : entry,
      ),
    );
    const settled = writeRecord(
      intent,
      intent.stage,
      Object.freeze({
        ...intent.ledger,
        processEffects: settledEntries,
        processEffectIssued: true,
        processEffectConfirmation: "confirmed",
      }),
    );
    assert.ok(settled);
    return settled;
  };
  const shutdown = addProcessEffect(prepared, "official_shutdown");
  const nativeAbsent = addProcessEffect(shutdown, "native_termination", false);
  const wsl = addProcessEffect(nativeAbsent, "wsl_termination");
  const stopped = writeRecord(wsl, "processes_stopped", wsl.ledger);
  assert.ok(stopped);
  const actualIdentityAt = (target: string) => {
    try {
      const value = fs.lstatSync(target, { bigint: true });
      return Object.freeze({
        dev: String(value.dev),
        ino: String(value.ino),
        birthtimeNs: String(value.birthtimeNs),
      });
    } catch {
      return null;
    }
  };
  const state = fixture({
    prepareBoundary: () => actualBoundary,
    inventory: inventoryDockerDesktopRepairOperations,
    persistStage: persistDockerDesktopRepairStage,
    observeEngine: () => "ready",
    identityAt: actualIdentityAt,
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.processEffectConfirmation, "confirmed");
  const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(inventory.status, "verified");
  assert.equal(
    inventory.operations[0]?.stage,
    "no_stale_known_effect_recovery_pending",
  );
  const replay = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(replay.status, "recovered_pending_close");
  assert.equal(replay.filesystemEffectConfirmation, "confirmed");
  assert.equal(replay.effectStateUnknown, false);
  const closed = await closeWindowsDockerDesktopRepairUsingDependencies(
    replay.repairId,
    state.dependencies,
  );
  assert.equal(closed.status, "closed_retained");
  assert.equal(closed.newRepairPermitted, true);
  const closedInventory =
    inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(closedInventory.status, "verified");
  assert.equal(
    closedInventory.operations[0]?.stage,
    "closed_no_stale_known_effect_retained",
  );
});

test("全5 Host Effectのintent／settlement crashを実rev4 Storeからat-most-once再開する", async (t) => {
  const actions = [
    "official_shutdown",
    "native_termination",
    "wsl_termination",
    "runtime_directory_rename",
    "desktop_launch",
  ] as const;
  for (const action of actions) {
    for (const crashPhase of [
      "intent_recorded",
      "host_before_settlement",
      "settled",
    ] as const) {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), `crdd-repair-crash-${action}-`),
      );
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const runtimeStateRoot = path.join(root, "RuntimeState");
      const localAppData = path.join(root, "LocalAppData");
      const runDirectory = path.join(localAppData, "Docker", "run");
      fs.mkdirSync(runtimeStateRoot);
      fs.mkdirSync(runDirectory, { recursive: true });
      const identityAt = (target: string) => {
        try {
          const value = fs.lstatSync(target, { bigint: true });
          return Object.freeze({
            dev: String(value.dev),
            ino: String(value.ino),
            birthtimeNs: String(value.birthtimeNs),
          });
        } catch {
          return null;
        }
      };
      const initialIdentity = identityAt(runDirectory);
      assert.ok(initialIdentity);
      const actualBoundary: PreparedBoundary = Object.freeze({
        ...boundary,
        runtimeStateRoot,
        localAppData,
        runDirectory,
        socketPath: path.join(runDirectory, "dockerInference"),
      });
      let engineReady = false;
      let processes: "verified" | "absent" = "verified";
      let injected = false;
      const unexpectedPersistFailures: string[] = [];
      const calls = new Map<string, number>();
      const count = (name: string) =>
        calls.set(name, (calls.get(name) ?? 0) + 1);
      const dependencies: RepairDependencies = {
        ...fixture().dependencies,
        prepareBoundary: () => actualBoundary,
        inventory: inventoryDockerDesktopRepairOperations,
        persistStage: (currentBoundary, current, stage, nextLedger) => {
          const entries = [
            ...nextLedger.processEffects,
            ...nextLedger.filesystemEffects,
          ];
          const previousEntries = [
            ...current.ledger.processEffects,
            ...current.ledger.filesystemEffects,
          ];
          const next = entries.find((entry) => entry.action === action);
          const previous = previousEntries.find(
            (entry) => entry.action === action,
          );
          if (
            !injected &&
            crashPhase === "host_before_settlement" &&
            next?.phase === "settled" &&
            previous?.phase === "intent_recorded"
          ) {
            injected = true;
            return null;
          }
          const persisted = persistDockerDesktopRepairStage(
            currentBoundary,
            current,
            stage,
            nextLedger,
          );
          if (!persisted)
            unexpectedPersistFailures.push(
              `${current.stage}->${stage}:prev=${current.ledger.filesystemEffects.map((entry) => `${entry.action}/${entry.phase}`).join(",")}:next=${nextLedger.processEffects.map((entry) => `${entry.action}/${entry.phase}`).join(",")}:${nextLedger.filesystemEffects.map((entry) => `${entry.action}/${entry.phase}`).join(",")}`,
            );
          if (
            persisted &&
            !injected &&
            crashPhase !== "host_before_settlement" &&
            next?.phase === crashPhase &&
            previous?.phase !== crashPhase
          ) {
            injected = true;
            return null;
          }
          return persisted;
        },
        observeEngine: () => (engineReady ? "ready" : "known_unavailable"),
        observeKnownSocketFailure: () => initialIdentity,
        identityAt,
        observePath: (target) => {
          const identity = identityAt(target);
          return identity
            ? Object.freeze({ state: "present" as const, identity })
            : Object.freeze({
                state: "confirmed_absent" as const,
                identity: null,
              });
        },
        acquireHelper: async () => ({
          status: "acquired" as const,
          session: Object.freeze({
            ...session(),
            inspectProcesses: async () => processes,
            terminateProcesses: async () => {
              count("native_termination");
              processes = "absent";
              return "terminated" as const;
            },
            launchDesktop: async () => {
              count("desktop_launch");
              fs.mkdirSync(runDirectory);
              processes = "verified";
              engineReady = true;
              return "started" as const;
            },
          }),
        }),
        officialShutdown: () => {
          count("official_shutdown");
          return Object.freeze({
            issued: true,
            confirmation: "confirmed" as const,
          });
        },
        terminateDockerWsl: () => {
          count("wsl_termination");
          return Object.freeze({
            issued: true,
            confirmation: "confirmed" as const,
          });
        },
        renameRunDirectory: (_currentBoundary, operation) => {
          count("runtime_directory_rename");
          fs.renameSync(runDirectory, operation.staleDirectory);
          return Object.freeze({
            issued: true,
            confirmation: "confirmed" as const,
            staleState: "retained" as const,
          });
        },
        awaitEngine: async () => (engineReady ? "ready" : "known_unavailable"),
      };
      const first =
        await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
      assert.equal(injected, true, `${action}/${crashPhase}`);
      assert.equal(first.status, "blocked", `${action}/${crashPhase}`);
      const second =
        await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
      const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
      assert.equal(inventory.status, "verified", `${action}/${crashPhase}`);
      if (crashPhase === "intent_recorded") {
        assert.equal(calls.get(action) ?? 0, 0, action);
        assert.equal(second.status, "blocked", action);
      } else if (
        crashPhase === "host_before_settlement" &&
        action !== "runtime_directory_rename"
      ) {
        assert.equal(calls.get(action), 1, action);
        assert.equal(second.status, "blocked", action);
      } else {
        assert.equal(calls.get(action), 1, action);
        assert.equal(
          second.status,
          "recovered_pending_close",
          `${action}: ${JSON.stringify(second)} persist=${JSON.stringify(unexpectedPersistFailures)}`,
        );
        assert.deepEqual(unexpectedPersistFailures, [], action);
      }
      for (const countValue of calls.values()) assert.ok(countValue <= 1);
    }
  }
});

test("preparedからの自然復旧は実rev4 Storeへ観測Recordとstage Recordを分離する", async (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-repair-natural-recovery-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  const runDirectory = path.join(localAppData, "Docker", "run");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(runDirectory, { recursive: true });
  const identityAt = (target: string) => {
    try {
      const value = fs.lstatSync(target, { bigint: true });
      return Object.freeze({
        dev: String(value.dev),
        ino: String(value.ino),
        birthtimeNs: String(value.birthtimeNs),
      });
    } catch {
      return null;
    }
  };
  const actualRunIdentity = identityAt(runDirectory);
  assert.ok(actualRunIdentity);
  const actualBoundary: PreparedBoundary = Object.freeze({
    ...boundary,
    runtimeStateRoot,
    localAppData,
    runDirectory,
    socketPath: path.join(runDirectory, "dockerInference"),
  });
  const baseLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const created = createDockerDesktopRepairOperation(
    actualBoundary,
    actualRunIdentity,
    baseLedger,
  );
  const preparedLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    ...baseLedger,
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write" as const,
        phase: "settled" as const,
        issued: true,
        confirmation: "unknown" as const,
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "unknown",
  });
  const prepared = persistDockerDesktopRepairStage(
    actualBoundary,
    created,
    "prepared",
    preparedLedger,
  );
  assert.ok(prepared);
  const state = fixture({
    prepareBoundary: () => actualBoundary,
    inventory: inventoryDockerDesktopRepairOperations,
    persistStage: persistDockerDesktopRepairStage,
    observeEngine: () => "ready",
    identityAt,
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(inventory.status, "verified");
  const recovered = inventory.operations[0];
  assert.equal(recovered?.stage, "no_stale_historical_effect_unknown_pending");
  assert.equal(recovered?.sequence, 2);
  assert.equal(
    recovered?.ledger.processEffects[0]?.action,
    "historical_process_reconciliation",
  );
  assert.equal(recovered?.ledger.processEffects[0]?.issued, null);
  assert.equal(recovered?.ledger.processEffects[0]?.confirmation, "unknown");
  assert.equal(recovered?.ledger.engineReady, true);
  assert.equal(recovered?.ledger.staleState, "absent");
  assert.equal(recovered?.ledger.evidenceState, "preserved");
});

test("過去Effect不明かつstaleなしは専用close後も履歴不明を保持する", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "historical_process_reconciliation",
        phase: "settled",
        issued: null,
        confirmation: "unknown",
      }),
    ]),
    processEffectIssued: null,
    processEffectConfirmation: "unknown",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: true,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "historical_effect_unknown_pending_human_decision",
    liveRunIdentity: runIdentity,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "c".repeat(32),
    repairId: `docker-desktop-repair.${"c".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-c",
    staleName: `run.crdd-stale-${"c".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"c".repeat(32)}`,
    runIdentity,
    stage: "no_stale_historical_effect_unknown_pending",
    sequence: 1,
    previousRecordSha256: "7".repeat(64),
    ledger,
  });
  const state = fixture();
  state.setOperation(operation);
  const result = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    state.dependencies,
  );
  assert.equal(
    result.status,
    "closed_historical_effect_unknown_retained",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, null);
  assert.equal(
    result.disposition,
    "historical_effect_unknown_retained_by_human_decision",
  );
  assert.equal(result.newRepairPermitted, true);
});

test("非同期境界中の取消後はsettlement Evidence以外の新Host Effectを発行しない", async () => {
  let cancel: () => void = () => undefined;
  let terminationCalls = 0;
  let inspectionCalls = 0;
  const cancellingSession = Object.freeze({
    ...session(),
    inspectProcesses: async () => {
      inspectionCalls += 1;
      cancel();
      return await new Promise<"verified">(() => undefined);
    },
    terminateProcesses: async () => {
      terminationCalls += 1;
      return "terminated" as const;
    },
  });
  const state = fixture({
    registerCancellation: (listener) => {
      cancel = listener;
      return () => undefined;
    },
    acquireHelper: async () =>
      Object.freeze({
        status: "acquired" as const,
        session: cancellingSession,
      }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_cancelled_after_process_effect",
  );
  assert.equal(inspectionCalls, 1);
  assert.equal(terminationCalls, 0);
  assert.equal(state.calls.includes("wsl"), false);
  assert.deepEqual(
    state.calls.filter((call) => call.startsWith("persist:")),
    ["persist:prepared", "persist:prepared", "persist:prepared"],
  );
});

test("helper喪失をawait中に検出した後はprocess terminationへ進まない", async () => {
  let helperFailure: () => void = () => undefined;
  let terminationCalls = 0;
  const losingSession = Object.freeze({
    ...session(),
    onFailureDetected: (listener: () => void) => {
      helperFailure = listener;
      return () => undefined;
    },
    inspectProcesses: async () => {
      helperFailure();
      return await new Promise<"verified">(() => undefined);
    },
    terminateProcesses: async () => {
      terminationCalls += 1;
      return "terminated" as const;
    },
  });
  const state = fixture({
    acquireHelper: async () =>
      Object.freeze({ status: "acquired" as const, session: losingSession }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_desktop_repair_native_helper_lost");
  assert.equal(terminationCalls, 0);
  assert.equal(state.calls.includes("wsl"), false);
});

test("package tupleがawait中に変化した場合は直後Effectを発行しない", async () => {
  let packageChanged = false;
  let verificationCalls = 0;
  const changingSession = Object.freeze({
    ...session(),
    verifyArtifacts: async () => {
      verificationCalls += 1;
      if (verificationCalls >= 3) packageChanged = true;
      return "verified" as const;
    },
  });
  const changedBoundary = Object.freeze({
    ...boundary,
    crddManifestHash: "a".repeat(64),
  });
  const state = fixture({
    prepareBoundary: () => (packageChanged ? changedBoundary : boundary),
    acquireHelper: async () =>
      Object.freeze({ status: "acquired" as const, session: changingSession }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(state.calls.includes("shutdown"), false);
});

test("後続Process Effect不明を以前のconfirmedで隠さない", async () => {
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      officialShutdown: () =>
        Object.freeze({ issued: true, confirmation: "unknown" as const }),
    }).dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.processEffectConfirmation, "unknown");
  assert.equal(result.effectStateUnknown, true);
});

test("WSL未確認とEngine再起動失敗は成功へ昇格しない", async () => {
  const wsl = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      terminateDockerWsl: () =>
        Object.freeze({ issued: true, confirmation: "unknown" as const }),
    }).dependencies,
  );
  assert.equal(wsl.status, "blocked");
  assert.equal(wsl.reason, "docker_desktop_wsl_termination_unconfirmed");
  assert.equal(wsl.processEffectConfirmation, "unknown");

  const engine = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({ awaitEngine: async () => "known_unavailable" as const })
      .dependencies,
  );
  assert.equal(engine.status, "blocked");
  assert.equal(engine.reason, "docker_desktop_engine_restart_unconfirmed");
  assert.equal(engine.manualRecoveryRequired, true);
});

test("terminal再表示はstale exact identityと解放後package世代を再確認する", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "runtime_directory_rename",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
      Object.freeze({
        sequence: 1,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: true,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "retained_by_human_decision",
    liveRunIdentity: runIdentity,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "e".repeat(32),
    repairId: `docker-desktop-repair.${"e".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-e",
    staleName: `run.crdd-stale-${"e".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"e".repeat(32)}`,
    runIdentity,
    stage: "closed_retained",
    sequence: 4,
    previousRecordSha256: "5".repeat(64),
    ledger,
  });
  const replacement = Object.freeze({ dev: "9", ino: "9", birthtimeNs: "9" });
  const replaced = fixture({
    identityAt: (target) =>
      target.includes("run.crdd-stale-") ? replacement : runIdentity,
  });
  replaced.setOperation(operation);
  const replacedResult = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    replaced.dependencies,
  );
  assert.equal(replacedResult.status, "blocked");

  const replacedLiveRun = fixture({
    identityAt: (target) =>
      target.includes("run.crdd-stale-") ? runIdentity : replacement,
  });
  replacedLiveRun.setOperation(operation);
  const replacedLiveRunResult =
    await closeWindowsDockerDesktopRepairUsingDependencies(
      operation.repairId,
      replacedLiveRun.dependencies,
    );
  assert.equal(replacedLiveRunResult.status, "blocked");

  let observations = 0;
  const changedBoundary = Object.freeze({
    ...boundary,
    packageContentRootSha256: "a".repeat(64),
  });
  const changed = fixture({
    prepareBoundary: () => {
      observations += 1;
      return observations >= 3 ? changedBoundary : boundary;
    },
  });
  changed.setOperation(operation);
  const changedResult = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    changed.dependencies,
  );
  assert.equal(changedResult.status, "blocked");
  assert.equal(changedResult.newRepairPermitted, false);
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
  const historical = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "closed_historical_effect_unknown_retained",
      reason: "docker_desktop_repair_evidence_retention_closed",
      repairId,
      manualRecoveryRequired: false,
      engineReady: true,
      processEffectIssued: true,
      processEffectConfirmation: "unknown",
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "confirmed",
      staleRuntimeDirectory: "absent",
      nativeHelperCleanupConfirmed: true,
      effectStateUnknown: true,
      newRepairPermitted: true,
    }),
    false,
  );
  assert.equal(historical.exitCode, 0);
  assert.match(historical.stdout, /no stale runtime directory was observed/u);
  assert.doesNotMatch(historical.stdout, /C:\\/u);
  const knownNoStale = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "closed_retained",
      reason: "docker_desktop_repair_evidence_retention_closed",
      repairId,
      manualRecoveryRequired: false,
      engineReady: true,
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "confirmed",
      staleRuntimeDirectory: "absent",
      nativeHelperCleanupConfirmed: true,
      effectStateUnknown: false,
      newRepairPermitted: true,
    }),
    false,
  );
  assert.equal(knownNoStale.exitCode, 0);
  assert.match(knownNoStale.stdout, /no stale runtime directory remains/u);
  assert.match(knownNoStale.stdout, /known Host Effect history/u);
  assert.doesNotMatch(knownNoStale.stdout, /stale runtime evidence remains/u);
});
