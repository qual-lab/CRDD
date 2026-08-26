export const RUNTIME_PROCESS_SAFETY_STATE_CONTRACT =
  "crdd-coordinator/runtime-process-safety-state";

export function createIsolatedRuntimeProcessSafetyStateCandidate() {
  let isPoisoned = false;
  const drains = new WeakSet<object>();
  let drainCount = 0;
  const poisonCleanupUnknown = () => {
    isPoisoned = true;
  };
  const beginDrain = () => {
    const token = Object.freeze({});
    drains.add(token);
    drainCount += 1;
    return token;
  };
  const endDrain = (token: unknown) => {
    if (!token || typeof token !== "object" || !drains.delete(token))
      return false;
    drainCount -= 1;
    return true;
  };
  return Object.freeze({
    poisonCleanupUnknown,
    poisonInteractiveCleanup: poisonCleanupUnknown,
    beginDrain,
    endDrain,
    isPoisoned: () => isPoisoned,
    isEffectBlocked: () => isPoisoned || drainCount > 0,
    isDraining: () => drainCount > 0,
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

export function beginRuntimeProcessEffectDrain() {
  return productionState.beginDrain();
}

export function endRuntimeProcessEffectDrain(token: unknown) {
  return productionState.endDrain(token);
}

export function isRuntimeProcessEffectBlocked() {
  return productionState.isEffectBlocked();
}

export function isRuntimeProcessEffectDraining() {
  return productionState.isDraining();
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
    transientDrainTransition:
      "synchronous_on_host_supervisor_failure_detection_until_all_cleanup_outcomes_are_confirmed_or_unknown_is_promoted_to_irreversible_poison",
    sameProcessResetAllowed: false,
    alreadyActiveOperationRetroactiveCancellationGuaranteed: false,
    recoveryBoundary: "fresh_process_only",
  });
}
