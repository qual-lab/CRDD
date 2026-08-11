import { createHash } from "node:crypto";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { describeRootProtectionPolicyContract } from "./root-protection-policy.mjs";

export const RUNTIME_ACTIVATION_CONTRACT = "crdd-coordinator/runtime-activation-record";
export const RUNTIME_ACTIVATION_CONTRACT_REVISION = 1;
export const RUNTIME_ACTIVATION_FILE = "activation.json";
export const RUNTIME_ACTIVATION_INPUT_LIMITS = Object.freeze({
  rawBytes: 8_192,
  identifierLength: 128,
  canonicalUtcLength: 24
});

const HASH = /^[a-f0-9]{64}$/u;
const ACTIVATION_ID = /^ACTIVATION-[0-9]{6,}$/u;
const BUNDLE_ID = /^AUTHBUNDLE-[0-9]{6,}$/u;
const POLICY_ID = /^AUTHPOL-[0-9]{6,}$/u;
const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const RECORD_KEYS = new Set([
  "contract",
  "contractRevision",
  "activationId",
  "activationRevision",
  "status",
  "previousActivationHash",
  "repositoryIdentityHash",
  "runtimeRootIdentityHash",
  "bundleId",
  "bundleRevision",
  "authorityBundleHash",
  "policyId",
  "policyRevision",
  "trustPolicyHash",
  "registryId",
  "registryRevision",
  "registryHash",
  "activatedAt",
  "disabledAt"
]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
).get;

function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    record: null,
    recordHash: null,
    canonicalBytes: null,
    runtimeCapabilityIssued: false
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalUtc(value) {
  if (typeof value !== "string" || value.length !== RUNTIME_ACTIVATION_INPUT_LIMITS.canonicalUtcLength) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(Date.prototype.getTime.call(parsed)) && parsed.toISOString() === value;
}

function positiveRevision(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function identifier(value, pattern) {
  return typeof value === "string" && value.length <= RUNTIME_ACTIVATION_INPUT_LIMITS.identifierLength &&
    pattern.test(value);
}

function normalizeRecord(rawRecord) {
  const record = snapshotPlainRecord(rawRecord, RECORD_KEYS);
  if (!record ||
      record.contract !== RUNTIME_ACTIVATION_CONTRACT ||
      record.contractRevision !== RUNTIME_ACTIVATION_CONTRACT_REVISION ||
      !identifier(record.activationId, ACTIVATION_ID) ||
      !positiveRevision(record.activationRevision) ||
      !["active", "disabled"].includes(record.status) ||
      (record.activationRevision === 1
        ? record.previousActivationHash !== null
        : typeof record.previousActivationHash !== "string" || !HASH.test(record.previousActivationHash)) ||
      typeof record.repositoryIdentityHash !== "string" || !HASH.test(record.repositoryIdentityHash) ||
      typeof record.runtimeRootIdentityHash !== "string" || !HASH.test(record.runtimeRootIdentityHash) ||
      !identifier(record.bundleId, BUNDLE_ID) || !positiveRevision(record.bundleRevision) ||
      typeof record.authorityBundleHash !== "string" || !HASH.test(record.authorityBundleHash) ||
      !identifier(record.policyId, POLICY_ID) || !positiveRevision(record.policyRevision) ||
      typeof record.trustPolicyHash !== "string" || !HASH.test(record.trustPolicyHash) ||
      !identifier(record.registryId, REGISTRY_ID) || !positiveRevision(record.registryRevision) ||
      typeof record.registryHash !== "string" || !HASH.test(record.registryHash) ||
      !canonicalUtc(record.activatedAt) ||
      (record.status === "active"
        ? record.disabledAt !== null
        : !canonicalUtc(record.disabledAt) || record.disabledAt < record.activatedAt)) return null;

  return Object.freeze(Object.fromEntries([...RECORD_KEYS].map((key) => [key, record[key]])));
}

function candidate(record, canonical) {
  return Object.freeze({
    status: "candidate",
    reason: "runtime_activation_path_acl_atomic_persistence_required",
    record,
    recordHash: createHash("sha256").update(canonical).digest("hex"),
    canonicalBytes: Buffer.from(canonical, "utf8"),
    runtimeCapabilityIssued: false
  });
}

export function compileRuntimeActivationRecordCandidate(rawRecord) {
  try {
    const record = normalizeRecord(rawRecord);
    if (!record) return blocked("runtime_activation_record_invalid");
    const canonical = canonicalJson(record);
    if (Buffer.byteLength(canonical, "utf8") > RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes) {
      return blocked("runtime_activation_record_bytes_exceeded");
    }
    return candidate(record, canonical);
  } catch {
    return blocked("runtime_activation_record_invalid");
  }
}

export function decodeRuntimeActivationRecordCandidate(input) {
  try {
    if (!Buffer.isBuffer(input)) return blocked("runtime_activation_record_bytes_required");
    const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (inputLength > RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes) {
      return blocked("runtime_activation_record_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    if (inputLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return blocked("runtime_activation_record_bytes_invalid");
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = JSON.parse(source);
    const result = compileRuntimeActivationRecordCandidate(parsed);
    if (result.status !== "candidate") return blocked(result.reason);
    if (!Buffer.prototype.equals.call(bytes, result.canonicalBytes)) {
      return blocked("runtime_activation_record_bytes_noncanonical");
    }
    return result;
  } catch {
    return blocked("runtime_activation_record_bytes_invalid");
  }
}

export function describeRuntimeActivationContract() {
  return Object.freeze({
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: RUNTIME_ACTIVATION_CONTRACT_REVISION,
    fixedRuntimeRootFile: RUNTIME_ACTIVATION_FILE,
    persistence: "repository_scoped_persistent",
    activationCommand: "dedicated_activate_required",
    activationCommandGrammar: "implemented_candidate",
    activationEffect: "not_implemented",
    localOnboardingContract: "implemented_candidate_contract_only",
    disabledRepositoryExperience: "no_runtime_specific_effect",
    firstPlatformSetup:
      "verify_signed_platform_provisioner_and_provision_shared_authority_root_target",
    authorityProvisioningScope: "shared_platform_scope_reusable_across_repositories_target",
    repositoryActivationEntry: "single_coordinator_activate_command_target",
    runtimeRootProvisioningEffectOwner: "dedicated_platform_provisioner_target",
    runtimeRootProvisioningScope: "per_repository_during_activation_or_precondition_target",
    normalRunAdministratorElevation:
      "not_required_after_verified_provision_and_activation_target",
    normalRunPathInput: "not_required_after_verified_provision_and_activation_target",
    normalRunManualAclConfiguration:
      "not_required_after_verified_provision_and_activation_target",
    restartPrompt: "not_required_when_protection_identity_and_activation_are_valid_target",
    protectionChangeBehavior: "fail_closed_and_direct_to_reverification_or_reprovision",
    reverificationTriggers: Object.freeze([
      "platform_provisioner_or_signature_or_trust_change",
      "runtime_or_provisioner_principal_change",
      "root_identity_or_protection_metadata_change"
    ]),
    reprovisionTriggers: Object.freeze([
      "required_root_missing_or_replaced",
      "required_writer_or_runtime_read_only_protection_mismatch",
      "authority_root_identity_changed"
    ]),
    platformProvisionerVerification: "not_implemented",
    platformProvisionerEffect: "not_implemented",
    provisionReceiptVerification: "not_implemented",
    authorityRootResolutionFromProvisioningRecord: "not_implemented",
    authorityRootExplicitPathContractPreserved: true,
    runtimeRootProvisioningEffect: "not_implemented",
    authorityRootProvisioningEffect: "not_implemented",
    disableCommandGrammar: "implemented_candidate",
    disableEffect: "not_implemented",
    doctorEnableIsActivation: false,
    bundleIdentityChangeRequiresReactivation: true,
    disableSemantics: "stop_new_operations_and_safely_cancel_in_flight",
    deleteIsSeparateOperation: true,
    deleteImplementation: "not_implemented",
    canonicalRecordCore: "implemented_candidate",
    crossRecordTransitionCore: "implemented_candidate",
    initialTransitionCore: "initial_null_to_active_candidate",
    disableTransitionCore: "active_to_disabled_candidate",
    reactivationTransitionPolicy: "not_implemented",
    disabledOriginTransitionPolicy: "not_implemented",
    canonicalUtcLength: RUNTIME_ACTIVATION_INPUT_LIMITS.canonicalUtcLength,
    rootProtectionPolicy: describeRootProtectionPolicyContract(),
    atomicPersistence: "not_implemented",
    pathIdentityBinding: "not_implemented",
    ownerAclVerification: "not_implemented",
    runScopedCapability: "not_implemented",
    runtimeCapabilityIssued: false
  });
}
