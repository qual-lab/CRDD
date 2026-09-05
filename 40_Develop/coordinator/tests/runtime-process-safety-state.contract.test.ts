import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  beginRuntimeProcessEffectDrain,
  createRuntimeProcessRecoveryIdentity,
  createIsolatedRuntimeProcessSafetyStateCandidate,
  describeRuntimeProcessSafetyStateContract,
  endRuntimeProcessEffectDrain,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
} from "../src/core/runtime-process-safety-state.ts";
import { startRuntimeOwnedCoordinatorTask } from "../src/security/coordinator-task-runtime.ts";
import { requestRuntimeOwnedExternalSendGrant } from "../src/security/external-send-grant-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";

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

test("runtime_process回復Identityはattemptとoperationへ結合されfresh Processだけを識別する", () => {
  const attemptId = "attempt-a";
  const operationId = "operation-a";
  const current = createRuntimeProcessRecoveryIdentity(attemptId, operationId);
  assert.equal(
    inspectRuntimeProcessRecoveryIdentity(current, attemptId, operationId)
      ?.processIdentity,
    getRuntimeProcessInstanceIdentity(),
  );
  assert.equal(
    inspectRuntimeProcessRecoveryIdentity(current, "attempt-b", operationId),
    null,
  );
  assert.equal(
    inspectRuntimeProcessRecoveryIdentity(
      current.replace(/.$/u, current.endsWith("0") ? "1" : "0"),
      attemptId,
      operationId,
    ),
    null,
  );
  const moduleUrl = pathToFileURL(
    path.join(
      import.meta.dirname,
      "..",
      "src",
      "core",
      "runtime-process-safety-state.ts",
    ),
  ).href;
  const fresh = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import {createRuntimeProcessRecoveryIdentity} from ${JSON.stringify(moduleUrl)}; process.stdout.write(createRuntimeProcessRecoveryIdentity(${JSON.stringify(attemptId)}, ${JSON.stringify(operationId)}));`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const inspectedFresh = inspectRuntimeProcessRecoveryIdentity(
    fresh,
    attemptId,
    operationId,
  );
  assert.ok(inspectedFresh);
  assert.notEqual(
    inspectedFresh.processIdentity,
    getRuntimeProcessInstanceIdentity(),
  );
});

test("Host failure drainは所有tokenだけで解除でき既存poisonを消さない", () => {
  const state = createIsolatedRuntimeProcessSafetyStateCandidate();
  const drain = state.beginDrain();
  assert.equal(state.isDraining(), true);
  assert.equal(state.isEffectBlocked(), true);
  assert.equal(state.endDrain(Object.freeze({})), false);
  assert.equal(state.isDraining(), true);
  assert.equal(state.endDrain(drain), true);
  assert.equal(state.isEffectBlocked(), false);
  state.poisonCleanupUnknown();
  const laterDrain = state.beginDrain();
  assert.equal(state.endDrain(laterDrain), true);
  assert.equal(state.isPoisoned(), true);
  assert.equal(state.isEffectBlocked(), true);
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
      "signed_general_task_started_result_or_completion_unknown",
      "signed_route_matrix_started_or_outer_execution_unknown",
    ],
    guardedEntrypoints: [
      "verified_package_issue_before_manifest_or_filesystem_observation",
      "coordinator_task_before_capability_consume_and_all_effects",
      "external_send_grant_before_authority_verification_or_console_effect",
    ],
    transientDrainTransition:
      "synchronous_on_host_supervisor_failure_detection_until_all_cleanup_outcomes_are_confirmed_or_unknown_is_promoted_to_irreversible_poison",
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
});

test("Host failure drain中はTask／Package／External SendをEffect前に一時拒否し解除後はrestart要求しない", async () => {
  const drain = beginRuntimeProcessEffectDrain();
  const packageOutcome = issueRuntimeOwnedVerifiedCoordinatorPackageCapability(
    Object.freeze({}),
  );
  assert.equal(
    packageOutcome.verification.reason,
    "platform_provisioner_runtime_cleanup_in_progress",
  );
  assert.throws(
    () =>
      startRuntimeOwnedCoordinatorTask(
        Object.freeze({}),
        "C:\\repository",
        Object.freeze({}),
      ),
    /coordinator_task_runtime_cleanup_in_progress/u,
  );
  const grant = await requestRuntimeOwnedExternalSendGrant(
    Object.freeze({}),
    Object.freeze({}),
    Object.freeze({}),
    Object.freeze({}),
    Object.freeze([]),
    new AbortController().signal,
  );
  assert.ok(grant && "reason" in grant && "manualRecoveryRequired" in grant);
  assert.equal(
    grant.reason,
    "external_send_confirmation_runtime_cleanup_in_progress",
  );
  assert.equal(grant.manualRecoveryRequired, false);
  assert.equal(endRuntimeProcessEffectDrain(drain), true);
  assert.throws(
    () =>
      startRuntimeOwnedCoordinatorTask(
        Object.freeze({}),
        "C:\\repository",
        Object.freeze({}),
      ),
    /coordinator_task_release_verification_required/u,
  );
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
