export const RUNTIME_PROCESS_SAFETY_STATE_CONTRACT =
  "crdd-coordinator/runtime-process-safety-state";

export function createIsolatedRuntimeProcessSafetyStateCandidate() {
  let isPoisoned = false;
  return Object.freeze({
    poisonInteractiveCleanup: () => {
      isPoisoned = true;
    },
    isPoisoned: () => isPoisoned,
  });
}

const productionState = createIsolatedRuntimeProcessSafetyStateCandidate();

export function poisonRuntimeProcessAfterInteractiveCleanupUnknown() {
  productionState.poisonInteractiveCleanup();
}

export function isRuntimeProcessPoisoned() {
  return productionState.isPoisoned();
}
