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
    poisonTransition: "synchronous_irreversible_before_cleanup_unknown_return",
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

test("production process poisonはPackage・Task・External Grantを全Effect前に停止する", () => {
  const fixture = path.join(
    import.meta.dirname,
    "fixtures",
    "runtime-process-poison-boundary.ts",
  );
  for (let index = 0; index < 2; index += 1) {
    const result = spawnSync(process.execPath, [fixture], {
      shell: false,
      windowsHide: true,
      env: {},
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      initialPoisonState: false,
      preflightStatus: "cleanup_unknown",
      finalPoisonState: true,
      packageReason: "platform_provisioner_process_restart_required",
      packageCapabilityIsNull: true,
      packageInputReadCount: 0,
      taskReason: "coordinator_task_process_restart_required",
      grantIsNull: true,
      runnerStatus: "blocked",
      runnerReason: "signed_general_task_process_restart_required",
      runnerManualRecoveryRequired: true,
      runnerHostRecoveryId: null,
    });
  }
});
