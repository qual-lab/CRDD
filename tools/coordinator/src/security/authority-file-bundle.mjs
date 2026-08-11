import { createHash } from "node:crypto";

import {
  decodeCanonicalAuthorityTrustPolicyBytes,
  loadAuthorityRegistryTrustCandidate
} from "./authority-trust-loader.mjs";
import { PROVIDER_INPUT_LIMITS } from "./provider-isolation-profile.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { ROOT_PROTECTION_POLICY_CONTRACT } from "./root-protection-policy.mjs";

export const AUTHORITY_FILE_BUNDLE_CONTRACT = "crdd-coordinator/authority-file-bundle";
export const AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION = 1;
export const AUTHORITY_FILE_BUNDLE_INPUT_LIMITS = Object.freeze({ manifestBytes: 4_096 });
export const AUTHORITY_FILE_BUNDLE_FILES = Object.freeze({
  manifest: "bundle.json",
  trustPolicy: "trust-policy.json",
  registry: "authority-registry.json"
});

const BUNDLE_ID = /^AUTHBUNDLE-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MANIFEST_KEYS = new Set([
  "contract",
  "contractRevision",
  "bundleId",
  "bundleRevision",
  "status",
  "previousBundleHash",
  "trustPolicyHash",
  "registryHash"
]);
const BUNDLE_INPUT_KEYS = new Set(["manifestBytes", "trustPolicyBytes", "registryBytes"]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
).get;

function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    manifest: null,
    bundleHash: null,
    registry: null,
    registryHash: null,
    trustPolicy: null,
    trustPolicyHash: null,
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

function decodeManifest(input) {
  if (!Buffer.isBuffer(input)) return null;
  const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
  if (inputLength > AUTHORITY_FILE_BUNDLE_INPUT_LIMITS.manifestBytes) return null;
  const bytes = Buffer.allocUnsafe(inputLength);
  Uint8Array.prototype.set.call(bytes, input);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (source.charCodeAt(0) === 0xfeff) return null;
  const parsed = JSON.parse(source);
  const snapshot = snapshotPlainRecord(parsed, MANIFEST_KEYS);
  if (!snapshot) return null;
  if (
    snapshot.contract !== AUTHORITY_FILE_BUNDLE_CONTRACT ||
    snapshot.contractRevision !== AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION ||
    typeof snapshot.bundleId !== "string" ||
    snapshot.bundleId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !BUNDLE_ID.test(snapshot.bundleId) ||
    !Number.isSafeInteger(snapshot.bundleRevision) || snapshot.bundleRevision < 1 ||
    !["active", "revoked", "replaced"].includes(snapshot.status) ||
    typeof snapshot.trustPolicyHash !== "string" || !HASH.test(snapshot.trustPolicyHash) ||
    typeof snapshot.registryHash !== "string" || !HASH.test(snapshot.registryHash) ||
    (snapshot.bundleRevision === 1
      ? snapshot.previousBundleHash !== null
      : typeof snapshot.previousBundleHash !== "string" || !HASH.test(snapshot.previousBundleHash))
  ) return null;
  const manifest = Object.freeze({
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION,
    bundleId: snapshot.bundleId,
    bundleRevision: snapshot.bundleRevision,
    status: snapshot.status,
    previousBundleHash: snapshot.previousBundleHash,
    trustPolicyHash: snapshot.trustPolicyHash,
    registryHash: snapshot.registryHash
  });
  const canonical = canonicalJson(manifest);
  if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8"))) return null;
  return Object.freeze({
    manifest,
    bundleHash: createHash("sha256").update(canonical).digest("hex")
  });
}

export function loadAuthorityFileBundleCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, BUNDLE_INPUT_KEYS);
    if (!input) return blocked("authority_file_bundle_input_invalid");
    const decodedManifest = decodeManifest(input.manifestBytes);
    if (!decodedManifest) return blocked("authority_file_bundle_manifest_invalid");
    if (decodedManifest.manifest.status !== "active") {
      return blocked("authority_file_bundle_inactive");
    }
    const decodedPolicy = decodeCanonicalAuthorityTrustPolicyBytes(input.trustPolicyBytes);
    if (decodedPolicy.status !== "candidate") {
      return blocked("authority_file_bundle_trust_policy_invalid");
    }
    if (decodedPolicy.trustPolicy.status !== "active") {
      return blocked("authority_file_bundle_trust_policy_inactive");
    }
    const trust = loadAuthorityRegistryTrustCandidate(input.registryBytes, decodedPolicy.trustPolicy);
    if (trust.status !== "candidate") return blocked("authority_file_bundle_registry_invalid");
    if (
      decodedManifest.manifest.trustPolicyHash !== decodedPolicy.trustPolicyHash ||
      decodedManifest.manifest.registryHash !== trust.registryHash
    ) return blocked("authority_file_bundle_hash_mismatch");

    return Object.freeze({
      status: "candidate",
      reason: "runtime_file_bundle_path_acl_and_activation_required",
      manifest: decodedManifest.manifest,
      bundleHash: decodedManifest.bundleHash,
      registry: trust.registry,
      registryHash: trust.registryHash,
      trustPolicy: trust.trustPolicy,
      trustPolicyHash: trust.trustPolicyHash,
      runtimeCapabilityIssued: false
    });
  } catch {
    return blocked("authority_file_bundle_input_invalid");
  }
}

export function describeAuthorityFileBundleContract() {
  return Object.freeze({
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION,
    fixedFiles: AUTHORITY_FILE_BUNDLE_FILES,
    canonicalBundleCore: "implemented_candidate",
    runtimeManagedPath: "not_implemented",
    rootProtectionPolicyContract: ROOT_PROTECTION_POLICY_CONTRACT,
    rootProtectionPolicyCore: "implemented_candidate_claim_only",
    ownerAclVerification: "not_implemented",
    atomicReplacement: "not_implemented",
    monotonicActivation: "not_implemented",
    runtimeCapabilityIssued: false,
    ipcOrNetworkTransportSupported: false
  });
}
