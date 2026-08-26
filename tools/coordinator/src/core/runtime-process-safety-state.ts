export const RUNTIME_PROCESS_SAFETY_STATE_CONTRACT =
  "crdd-coordinator/runtime-process-safety-state";

export function createIsolatedRuntimeProcessSafetyStateCandidate() {
  let isPoisoned = false;
  const poisonCleanupUnknown = () => {
    isPoisoned = true;
  };
  return Object.freeze({
    poisonCleanupUnknown,
    poisonInteractiveCleanup: poisonCleanupUnknown,
    isPoisoned: () => isPoisoned,
  });
}

const productionState = createIsolatedRuntimeProcessSafetyStateCandidate();

export function poisonRuntimeProcessAfterCleanupUnknown() {
  productionState.poisonCleanupUnknown();
}

export function poisonRuntimeProcessAfterInteractiveCleanupUnknown() {
  poisonRuntimeProcessAfterCleanupUnknown();
}

export function isRuntimeProcessPoisoned() {
  return productionState.isPoisoned();
}

export function describeRuntimeProcessSafetyStateContract() {
  return Object.freeze({
    contract: RUNTIME_PROCESS_SAFETY_STATE_CONTRACT,
    stateScope: "single_runtime_process_nonserialized",
    poisonTransition:
      "synchronous_irreversible_on_cleanup_unknown_observation_before_return_or_next_non_cleanup_await",
    poisonOrigins: Object.freeze([
      "interactive_console_cleanup_unknown",
      "host_operation_supervisor_cleanup_unknown",
    ]),
    guardedEntrypoints: Object.freeze([
      "verified_package_issue_before_manifest_or_filesystem_observation",
      "coordinator_task_before_capability_consume_and_all_effects",
      "external_send_grant_before_authority_verification_or_console_effect",
    ]),
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
}
