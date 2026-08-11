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
    !value.includes("\0") &&
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
    cliOverrideIntegration: "not_implemented",
    environmentOverrideIntegration: "not_implemented",
    featureDefault: "disabled",
    explicitEnableRequired: true,
    directoryExistenceActivates: false,
    overrideActivates: false,
    gitIgnoreIsSecurityBoundary: false,
    candidateRevisionIncludesRuntimeRoot: false,
    operationInputIncludesRuntimeRoot: false,
    providerMountAllowed: false,
    disableSemantics: "stop_new_operations",
    disableImplementation: "not_implemented",
    disableDeletesStoredData: false,
    runtimeDataDeletion: "not_implemented",
    runtimePathAdapter: "not_implemented",
    activationRecordPersistence: "not_implemented",
    runtimeCapabilityIssued: false
  });
}
