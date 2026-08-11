import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const RUNTIME_ROOT_CONTRACT = "crdd-coordinator/runtime-root-profile";
export const RUNTIME_ROOT_CONTRACT_REVISION = 1;
export const DEFAULT_REPOSITORY_RUNTIME_DIRECTORY = ".crdd-runtime";

const INPUT_KEYS = new Set([
  "repositoryRoot",
  "cliOverride",
  "environmentOverride",
  "activationIntent"
]);
const EXPLICIT_ENABLE = "explicit_enable_request";

function response(status, reason, selection = null) {
  return Object.freeze({
    status,
    reason,
    selection,
    activationState: status === "candidate" ? "enable_requested" : "disabled",
    runtimeCapabilityIssued: false
  });
}

function pathCandidate(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    path.isAbsolute(value);
}

export function selectRuntimeRootCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !pathCandidate(input.repositoryRoot)) {
      return response("blocked", "runtime_root_input_invalid");
    }
    for (const value of [input.cliOverride, input.environmentOverride]) {
      if (value !== null && !pathCandidate(value)) {
        return response("blocked", "runtime_root_override_invalid");
      }
    }
    if (input.activationIntent !== null && input.activationIntent !== EXPLICIT_ENABLE) {
      return response("blocked", "runtime_activation_intent_invalid");
    }

    const source = input.cliOverride !== null
      ? "cli_override"
      : input.environmentOverride !== null
        ? "environment_override"
        : "repository_default";
    const selection = Object.freeze({
      source,
      repositoryRelativeDefault: source === "repository_default"
        ? DEFAULT_REPOSITORY_RUNTIME_DIRECTORY
        : null,
      customRootSelected: source !== "repository_default",
      absolutePathReported: false
    });

    if (input.activationIntent !== EXPLICIT_ENABLE) {
      return response("blocked", "runtime_feature_not_enabled", selection);
    }
    return response(
      "candidate",
      "runtime_root_path_protection_and_activation_record_required",
      selection
    );
  } catch {
    return response("blocked", "runtime_root_input_invalid");
  }
}

export function describeRuntimeRootContract() {
  return Object.freeze({
    contract: RUNTIME_ROOT_CONTRACT,
    contractRevision: RUNTIME_ROOT_CONTRACT_REVISION,
    defaultRepositoryDirectory: DEFAULT_REPOSITORY_RUNTIME_DIRECTORY,
    overridePrecedence: Object.freeze(["cli", "environment", "repository_default"]),
    cliOverrideIntegration: "implemented_candidate",
    environmentOverrideIntegration: "implemented_candidate",
    diagnosticRequestIntegration: "implemented_candidate",
    featureDefault: "disabled",
    explicitEnableRequired: true,
    directoryExistenceActivates: false,
    overrideActivates: false,
    gitIgnoreIsSecurityBoundary: false,
    candidateRevisionIncludesRuntimeRoot: false,
    operationInputIncludesRuntimeRoot: false,
    providerMountAllowed: false,
    disableSemantics: "stop_new_operations_and_safely_cancel_in_flight",
    disableImplementation: "not_implemented",
    disableDeletesStoredData: false,
    runtimeDataDeletion: "not_implemented",
    runtimePathAdapter: "not_implemented",
    runtimePathObjectIdentityCore: "implemented_candidate",
    activationRecordCore: "implemented_candidate",
    activationRecordPersistence: "not_implemented",
    runtimeCapabilityIssued: false
  });
}
