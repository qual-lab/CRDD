import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  createIsolatedRuntimeProcessSafetyStateCandidate,
  describeRuntimeProcessSafetyStateContract,
} from "../src/core/runtime-process-safety-state.ts";

test("対話cleanup不明は同一Process stateを不可逆にpoisonする", () => {
  const firstProcess = createIsolatedRuntimeProcessSafetyStateCandidate();
  const restartedProcess = createIsolatedRuntimeProcessSafetyStateCandidate();
  assert.equal(firstProcess.isPoisoned(), false);
  firstProcess.poisonInteractiveCleanup();
  assert.equal(firstProcess.isPoisoned(), true);
  firstProcess.poisonInteractiveCleanup();
  assert.equal(firstProcess.isPoisoned(), true);
  assert.equal(restartedProcess.isPoisoned(), false);
});

test("Process poison契約は同期不可逆Gateとfresh Process境界を固定する", () => {
  assert.deepEqual(describeRuntimeProcessSafetyStateContract(), {
    contract: "crdd-coordinator/runtime-process-safety-state",
    stateScope: "single_runtime_process_nonserialized",
    poisonTransition:
      "synchronous_irreversible_on_cleanup_unknown_observation_before_return_or_next_non_cleanup_await",
    poisonOrigins: [
      "interactive_console_cleanup_unknown",
      "host_operation_supervisor_cleanup_unknown",
    ],
    guardedEntrypoints: [
      "verified_package_issue_before_manifest_or_filesystem_observation",
      "coordinator_task_before_capability_consume_and_all_effects",
      "external_send_grant_before_authority_verification_or_console_effect",
    ],
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
});

test("全cleanup起点のproduction process poisonは保留cleanup中から全入口を停止する", () => {
  const fixture = path.join(
    import.meta.dirname,
    "fixtures",
    "runtime-process-poison-boundary.ts",
  );
  for (const mode of [
    "descriptor_close",
    "writer_cleanup",
    "reader_cleanup",
    "lock_acquire_cleanup",
    "lock_release_cleanup",
    "sync_convenience_cleanup",
    "async_convenience_cleanup",
    "reader_convenience_cleanup",
    "sync_outcome_cleanup",
    "async_outcome_cleanup",
  ]) {
    const result = spawnSync(process.execPath, [fixture, mode], {
      shell: false,
      windowsHide: true,
      env: {},
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      mode,
      initialPoisonState: false,
      originStatus: mode.endsWith("convenience_cleanup")
        ? "null"
        : mode.endsWith("outcome_cleanup")
          ? "cleanup_unknown:null"
          : "cleanup_unknown",
      originPendingAtGate:
        mode === "writer_cleanup" || mode === "reader_cleanup",
      poisonedAtOriginBoundary: true,
      finalPoisonState: true,
      packageReason: "platform_provisioner_process_restart_required",
      packageCapabilityIsNull: true,
      packageInputReadCount: 0,
      taskReason: "coordinator_task_process_restart_required",
      grantStatus: "blocked",
      grantReason:
        "external_send_confirmation_cleanup_unknown_process_restart_required",
      grantManualRecoveryRequired: true,
      grantCapabilityPresent: false,
      grantRecoveryFieldCount: 0,
      grantRawContentReported: false,
      grantHostPathReported: false,
      grantInputReadCount: 0,
      runnerStatus: "blocked",
      runnerReason: "signed_general_task_process_restart_required",
      runnerManualRecoveryRequired: true,
      runnerHostRecoveryId: null,
    });
  }
});
