import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { ROOT_PROTECTION_POLICY_CONTRACT } from "./root-protection-policy.mjs";

export const AUTHORITY_ROOT_CONTRACT =
  "crdd-coordinator/authority-root-profile";
export const AUTHORITY_ROOT_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "cliOverride",
  "environmentOverride",
  "activationIntent",
]);
const EXPLICIT_ACTIVATE = "explicit_activate_request";

function result<T>(status: string, reason: string, selection: T | null = null) {
  return Object.freeze({
    status,
    reason,
    selection,
    runtimeCapabilityIssued: false,
  });
}

function absolutePathCandidate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4_096 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    path.isAbsolute(value)
  );
}

export function selectAuthorityRootCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) return result("blocked", "authority_root_input_invalid");
    for (const value of [input.cliOverride, input.environmentOverride]) {
      if (value !== null && !absolutePathCandidate(value)) {
        return result("blocked", "authority_root_override_invalid");
      }
    }
    if (input.activationIntent !== EXPLICIT_ACTIVATE) {
      return result("blocked", "authority_activation_intent_invalid");
    }
    const source =
      input.cliOverride !== null
        ? "cli_override"
        : input.environmentOverride !== null
          ? "environment_override"
          : null;
    if (source === null)
      return result("blocked", "authority_root_explicit_path_required");
    return result(
      "candidate",
      "authority_root_path_acl_verification_required",
      Object.freeze({
        source,
        sharedAcrossRepositories: true,
        absolutePathReported: false,
      }),
    );
  } catch {
    return result("blocked", "authority_root_input_invalid");
  }
}

export function describeAuthorityRootContract() {
  return Object.freeze({
    contract: AUTHORITY_ROOT_CONTRACT,
    contractRevision: AUTHORITY_ROOT_CONTRACT_REVISION,
    defaultPath: null,
    explicitAbsolutePathRequired: true,
    overridePrecedence: Object.freeze(["cli", "environment"]),
    osImplicitDefaultAllowed: false,
    sharedAcrossRepositories: true,
    runtimeRootMayContainAuthorityBundle: false,
    providerMountAllowed: false,
    rootProtectionPolicyContract: ROOT_PROTECTION_POLICY_CONTRACT,
    rootProtectionPolicyCore: "implemented_candidate_claim_only",
    runtimePathAdapter: "not_implemented",
    ownerAclVerification: "not_implemented",
    runtimeCapabilityIssued: false,
  });
}
