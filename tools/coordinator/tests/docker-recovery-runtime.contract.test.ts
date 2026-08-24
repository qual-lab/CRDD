import assert from "node:assert/strict";
import test from "node:test";

import {
  beginRuntimeOwnedDockerRecovery,
  completeRuntimeOwnedDockerRecovery,
  createIsolatedDockerRecoveryRuntimeCandidate,
  describeDockerRecoveryRuntimeContract,
} from "../src/security/docker-recovery-runtime.ts";

const FIRST_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function createIsolatedFixture() {
  const managementCapability = Object.freeze({});
  const otherManagementCapability = Object.freeze({});
  let beginCount = 0;
  let completeCount = 0;
  const runtime = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: (capability) => {
      if (capability !== managementCapability)
        throw new Error("management_invalid");
      return Object.freeze({ operationId: "OP-123456" });
    },
    beginDurableRecovery: (capability, operationId) => {
      assert.equal(capability, managementCapability);
      assert.equal(operationId, "OP-123456");
      beginCount += 1;
      return FIRST_RECOVERY;
    },
    completeDurableRecovery: (capability, recoveryId) => {
      assert.equal(capability, managementCapability);
      assert.equal(recoveryId, FIRST_RECOVERY);
      completeCount += 1;
      return SECOND_RECOVERY;
    },
  });
  return {
    runtime,
    managementCapability,
    otherManagementCapability,
    counts: () => ({ beginCount, completeCount }),
  };
}

test("Docker RecoveryはOperation bindingを確認してからdurable stateを開始する", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-999999" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.counts().beginCount, 0);
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.equal(begun.recoveryId, FIRST_RECOVERY);
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 0 });
});

test("Docker Recovery capabilityは同一管理権限で一度だけ完了できる", () => {
  const fixture = createIsolatedFixture();
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.otherManagementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "completed" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 1 });
});

test("Docker Recoveryは不正入力と依存例外をfail closedする", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "invalid" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.otherManagementCapability,
    ),
    null,
  );
  assert.deepEqual(fixture.runtime.complete(Object.freeze({}), null), {
    status: "blocked",
  });
  assert.deepEqual(fixture.runtime.complete(null, null), {
    status: "blocked",
  });

  let verificationCount = 0;
  const operationChanges = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => {
      verificationCount += 1;
      return Object.freeze({
        operationId: verificationCount === 1 ? "OP-123456" : "OP-654321",
      });
    },
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => SECOND_RECOVERY,
  });
  const begun = operationChanges.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    operationChanges.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const unchanged = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => FIRST_RECOVERY,
  });
  const unchangedBegun = unchanged.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(unchangedBegun);
  assert.deepEqual(
    unchanged.complete(
      unchangedBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const dependencyFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => {
      throw new Error("begin_failed");
    },
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  assert.equal(
    dependencyFailure.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.managementCapability,
    ),
    null,
  );

  const completeFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  const completeFailureBegun = completeFailure.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(completeFailureBegun);
  assert.deepEqual(
    completeFailure.complete(
      completeFailureBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
  assert.deepEqual(
    completeRuntimeOwnedDockerRecovery(Object.freeze({}), Object.freeze({})),
    { status: "blocked" },
  );
});

test("Production Docker Recoveryは不完全なTask planをEffect前に拒否する", () => {
  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
});

test("Docker Recovery contractはEffect前記録とcleanup後完了を固定する", () => {
  assert.deepEqual(describeDockerRecoveryRuntimeContract(), {
    contract: "crdd-coordinator/docker-recovery-runtime",
    contractRevision: 2,
    durableStateBeforeDockerEffect: "docker_submission_started",
    durableStateAfterCleanup: "host_only",
    capability: "opaque_process_local_single_completion",
    crashRecovery: "durable_recovery_id_returned_for_manual_recovery",
    runtimeStateRoot:
      "selected_user_runtime_owned_fixed_known_folder_protected_root",
    logicalHomeLease:
      "stable_sid_provider_namespace_kernel_lock_and_durable_active_pointer",
    resourceJournal:
      "submission_marker_before_create_then_exact_docker_id_receipt",
    offlineRecovery:
      "exact_id_and_configuration_only_unknown_create_outcome_never_adopted",
    hostFinalization:
      "operation_record_retained_until_host_cleanup_then_exact_removal",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
});
