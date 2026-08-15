// @ts-check

import { createHash } from "node:crypto";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import {
  AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
  isSupportedAuthorityRootAbsolutePath
} from "./authority-root-path-lexical.ts";
import { RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS } from
  "./runtime-activation-locator-binding-contract.mjs";
import { isRuntimeActivationIdCandidate } from "./runtime-activation-identity.ts";

export const AUTHORITY_ROOT_LOCATOR_CONTRACT = "crdd-coordinator/authority-root-locator";
export const AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION = 1;
export const AUTHORITY_ROOT_LOCATOR_FILE = ".crdd-runtime/authority-root-locator.json";
export const AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS = Object.freeze({
  rawBytes: 8_192,
  absolutePathBytes: AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES
});

const HASH = /^[a-f0-9]{64}$/u;
const LOCATOR_KEYS = new Set([
  "contract",
  "contractRevision",
  "locatorRevision",
  "repositoryIdentityHash",
  "runtimeRootIdentityHash",
  "authorityRootAbsolutePath",
  "authorityRootIdentityHash",
  "provisioningRecordHash",
  "activationId",
  "activationRevision",
  "activationRecordHash"
]);
const ACTIVATION_BINDING_KEYS = new Set(RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS);
const TYPED_ARRAY_BYTE_LENGTH = /** @type {() => number} */ (Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
)?.get);

/** @param {string} reason */
function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    locatorHash: null,
    summary: null,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}

/** @param {unknown} value @returns {string} */
function canonicalJson(value) {
  if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** @param {unknown} value */
function positiveRevision(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** @param {unknown} value @returns {value is string} */
function hash(value) {
  return typeof value === "string" && HASH.test(value);
}

/** @param {unknown} rawLocator */
function normalize(rawLocator) {
  const locator = snapshotPlainRecord(rawLocator, LOCATOR_KEYS);
  if (!locator ||
      locator.contract !== AUTHORITY_ROOT_LOCATOR_CONTRACT ||
      locator.contractRevision !== AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION ||
      locator.locatorRevision !== 1 ||
      !hash(locator.repositoryIdentityHash) ||
      !hash(locator.runtimeRootIdentityHash) ||
      !isSupportedAuthorityRootAbsolutePath(locator.authorityRootAbsolutePath) ||
      !hash(locator.authorityRootIdentityHash) ||
      !hash(locator.provisioningRecordHash) ||
      !isRuntimeActivationIdCandidate(locator.activationId) ||
      !positiveRevision(locator.activationRevision) ||
      !hash(locator.activationRecordHash)) return null;
  return Object.freeze(Object.fromEntries([...LOCATOR_KEYS].map((key) => [key, locator[key]])));
}

/** @param {unknown} rawLocator */
function compileInternal(rawLocator) {
  const locator = normalize(rawLocator);
  if (!locator) return null;
  const canonical = canonicalJson(locator);
  if (Buffer.byteLength(canonical, "utf8") > AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes) return null;
  return Object.freeze({ locator, canonical });
}

/** @param {string} canonical */
function candidate(canonical) {
  return Object.freeze({
    status: "candidate",
    reason: "authority_root_locator_untrusted_verification_required",
    locatorHash: createHash("sha256").update(canonical).digest("hex"),
    summary: Object.freeze({
      contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
      contractRevision: AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION,
      locatorRevision: 1,
      absolutePathReported: false,
      containsCredentials: false
    }),
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}

/** @param {string} status @param {string} reason @param {boolean} [pairContentMatched] */
function bindingResponse(status, reason, pairContentMatched = false) {
  return Object.freeze({
    status,
    reason,
    pairContentMatched,
    provisioningRecordVerification: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}

/** @param {unknown} rawLocator */
export function compileAuthorityRootLocatorCandidate(rawLocator) {
  try {
    const compiled = compileInternal(rawLocator);
    return compiled ? candidate(compiled.canonical) : blocked("authority_root_locator_invalid");
  } catch {
    return blocked("authority_root_locator_invalid");
  }
}

/** @param {unknown} input */
export function decodeAuthorityRootLocatorCandidate(input) {
  try {
    if (!Buffer.isBuffer(input)) return blocked("authority_root_locator_bytes_required");
    const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (inputLength > AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes) {
      return blocked("authority_root_locator_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    if (inputLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return blocked("authority_root_locator_bytes_invalid");
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const compiled = compileInternal(JSON.parse(source));
    if (!compiled) return blocked("authority_root_locator_invalid");
    const canonicalBytes = Buffer.from(compiled.canonical, "utf8");
    if (!Buffer.prototype.equals.call(bytes, canonicalBytes)) {
      return blocked("authority_root_locator_bytes_noncanonical");
    }
    return candidate(compiled.canonical);
  } catch {
    return blocked("authority_root_locator_bytes_invalid");
  }
}

/** @param {unknown} rawLocator @param {unknown} rawExpected */
export function evaluateAuthorityRootLocatorActivationBindingCandidate(rawLocator, rawExpected) {
  try {
    const expected = snapshotPlainRecord(rawExpected, ACTIVATION_BINDING_KEYS);
    if (!expected ||
        !hash(expected.repositoryIdentityHash) ||
        !hash(expected.runtimeRootIdentityHash) ||
        !isRuntimeActivationIdCandidate(expected.activationId) ||
        !positiveRevision(expected.activationRevision) ||
        !hash(expected.activationRecordHash)) {
      return bindingResponse("blocked", "authority_root_locator_activation_binding_input_invalid");
    }
    const compiled = compileInternal(rawLocator);
    if (!compiled) {
      return bindingResponse("blocked", "authority_root_locator_invalid");
    }
    const locator = compiled.locator;
    if (RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS.some(
      (key) => locator[key] !== expected[key])) {
      return bindingResponse("blocked", "authority_root_locator_activation_binding_mismatch");
    }
    return bindingResponse("candidate",
      "authority_root_locator_activation_binding_candidate", true);
  } catch {
    return bindingResponse("blocked", "authority_root_locator_activation_binding_input_invalid");
  }
}

export function describeAuthorityRootLocatorContract() {
  return Object.freeze({
    contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
    contractRevision: AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION,
    fixedRepositoryRelativeFile: AUTHORITY_ROOT_LOCATOR_FILE,
    runtimeRootOverrideChangesLocatorLocation: false,
    locatorCore: "implemented_candidate",
    trustLevel: "untrusted_discovery_hint",
    containsAbsolutePath: true,
    containsCredentials: false,
    canonicalBytesExposed: false,
    filesystemRead: "not_implemented",
    filesystemWrite: "not_implemented",
    atomicPersistence: "not_implemented",
    resolver: "not_implemented",
    provisioningRecordVerification: "not_implemented",
    authorityRootIdentityVerification: "not_implemented",
    activationBindingComparisonCore: "implemented_candidate",
    activeActivationBinding: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}
