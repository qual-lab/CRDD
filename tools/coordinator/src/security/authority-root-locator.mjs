import { createHash } from "node:crypto";
import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { isRuntimeActivationIdCandidate } from "./runtime-activation-identity.mjs";

export const AUTHORITY_ROOT_LOCATOR_CONTRACT = "crdd-coordinator/authority-root-locator";
export const AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION = 1;
export const AUTHORITY_ROOT_LOCATOR_FILE = ".crdd-runtime/authority-root-locator.json";
export const AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS = Object.freeze({
  rawBytes: 8_192,
  absolutePathBytes: 4_096
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
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
).get;

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

function canonicalJson(value) {
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function positiveRevision(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function hash(value) {
  return typeof value === "string" && HASH.test(value);
}

function canonicalAbsolutePath(value) {
  if (typeof value !== "string" || value.length === 0 ||
      Buffer.byteLength(value, "utf8") > AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.absolutePathBytes ||
      /[\u0000-\u001f\u007f]/u.test(value)) return false;
  if (process.platform === "win32") {
    if (!/^[A-Za-z]:\\/u.test(value) || path.win32.normalize(value) !== value) return false;
    const root = path.win32.parse(value).root;
    return value === root || !value.endsWith("\\");
  }
  if (!path.posix.isAbsolute(value) || path.posix.normalize(value) !== value) return false;
  return value === "/" || !value.endsWith("/");
}

function normalize(rawLocator) {
  const locator = snapshotPlainRecord(rawLocator, LOCATOR_KEYS);
  if (!locator ||
      locator.contract !== AUTHORITY_ROOT_LOCATOR_CONTRACT ||
      locator.contractRevision !== AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION ||
      locator.locatorRevision !== 1 ||
      !hash(locator.repositoryIdentityHash) ||
      !hash(locator.runtimeRootIdentityHash) ||
      !canonicalAbsolutePath(locator.authorityRootAbsolutePath) ||
      !hash(locator.authorityRootIdentityHash) ||
      !hash(locator.provisioningRecordHash) ||
      !isRuntimeActivationIdCandidate(locator.activationId) ||
      !positiveRevision(locator.activationRevision) ||
      !hash(locator.activationRecordHash)) return null;
  return Object.freeze(Object.fromEntries([...LOCATOR_KEYS].map((key) => [key, locator[key]])));
}

function compileInternal(rawLocator) {
  const locator = normalize(rawLocator);
  if (!locator) return null;
  const canonical = canonicalJson(locator);
  if (Buffer.byteLength(canonical, "utf8") > AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes) return null;
  return Object.freeze({ locator, canonical });
}

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

export function compileAuthorityRootLocatorCandidate(rawLocator) {
  try {
    const compiled = compileInternal(rawLocator);
    return compiled ? candidate(compiled.canonical) : blocked("authority_root_locator_invalid");
  } catch {
    return blocked("authority_root_locator_invalid");
  }
}

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
    activeActivationBinding: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
}
