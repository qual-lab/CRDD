import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { evaluateAuthorityRootLocatorActivationBindingCandidate } from "./authority-root-locator.mjs";
import { evaluateRuntimeActivationTransitionCandidate } from "./runtime-activation-transition.mjs";

export { describeRuntimeActivationLocatorBindingContract } from "./runtime-activation-locator-binding-contract.ts";

const INPUT_KEYS = new Set([
  "previousActivationCanonicalBytes",
  "nextActivationRecord",
  "authorityRootLocator",
]);

function response(status: string, reason: string, pairContentMatched = false) {
  return Object.freeze({
    status,
    reason,
    transitionKind: status === "candidate" ? "initial_null_to_active" : null,
    pairContentMatched,
    provisioningRecordVerification: "not_implemented",
    atomicPersistenceIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export function evaluateInitialActivationLocatorBindingCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) {
      return response(
        "blocked",
        "runtime_activation_locator_binding_input_invalid",
      );
    }
    const transition = evaluateRuntimeActivationTransitionCandidate({
      previousCanonicalBytes: input.previousActivationCanonicalBytes,
      nextRecord: input.nextActivationRecord,
    });
    if (transition.status !== "candidate" || !transition.record) {
      return response(
        "blocked",
        "runtime_activation_locator_transition_invalid",
      );
    }
    if (transition.transitionKind !== "initial_null_to_active") {
      return response(
        "blocked",
        "runtime_activation_locator_transition_not_supported",
      );
    }
    const binding = evaluateAuthorityRootLocatorActivationBindingCandidate(
      input.authorityRootLocator,
      {
        repositoryIdentityHash: transition.record.repositoryIdentityHash,
        runtimeRootIdentityHash: transition.record.runtimeRootIdentityHash,
        activationId: transition.record.activationId,
        activationRevision: transition.record.activationRevision,
        activationRecordHash: transition.recordHash,
      },
    );
    if (binding.status !== "candidate") {
      return response("blocked", binding.reason);
    }
    return response(
      "candidate",
      "runtime_initial_activation_locator_binding_candidate",
      true,
    );
  } catch {
    return response(
      "blocked",
      "runtime_activation_locator_binding_input_invalid",
    );
  }
}
