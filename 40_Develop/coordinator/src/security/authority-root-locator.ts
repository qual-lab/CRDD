import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
  isSupportedAuthorityRootAbsolutePath,
} from "./authority-root-path-lexical.ts";
import { RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS } from "./runtime-activation-locator-binding-contract.ts";
import { isRuntimeActivationIdCandidate } from "./runtime-activation-identity.ts";
import {
  PROVISIONING_RECORD_STORAGE_DIRECTORY,
  verifyCurrentProvisioningRecordLocatorBindingCandidate,
} from "./provisioning-record-store.ts";
import { verifyCurrentProvisioningRecordWithPersistedTrustCandidate } from "./provisioning-trust-artifact-store.ts";

export const AUTHORITY_ROOT_LOCATOR_CONTRACT =
  "crdd-coordinator/authority-root-locator";
export const AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION = 1;
export const AUTHORITY_ROOT_LOCATOR_FILE =
  ".crdd-runtime/authority-root-locator.json";
export const AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS = Object.freeze({
  rawBytes: 8_192,
  absolutePathBytes: AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES,
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
  "activationRecordHash",
]);
const activationBindingKeys = new Set(
  RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS,
);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;
const LOCATOR_PENDING_SUFFIX = ".pending";

/** @param {string} reason */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    locatorHash: null,
    summary: null,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function canonicalJson(value: unknown): string | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const members: string[] = [];
  for (const key of Object.keys(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      return null;
    }
    const member = canonicalJson(descriptor.value);
    if (member === null) return null;
    members.push(`${JSON.stringify(key)}:${member}`);
  }
  return `{${members.join(",")}}`;
}

/** @param {unknown} value */
function positiveRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** @param {unknown} value @returns {value is string} */
function hash(value: unknown): value is string {
  return typeof value === "string" && HASH.test(value);
}

/** @param {unknown} rawLocator */
function normalize(rawLocator: unknown) {
  const locator = snapshotPlainRecord(rawLocator, LOCATOR_KEYS);
  if (
    !locator ||
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
    !hash(locator.activationRecordHash)
  )
    return null;
  return Object.freeze(
    Object.fromEntries([...LOCATOR_KEYS].map((key) => [key, locator[key]])),
  );
}

/** @param {unknown} rawLocator */
function compileInternal(rawLocator: unknown) {
  const locator = normalize(rawLocator);
  if (!locator) return null;
  const canonical = canonicalJson(locator);
  if (
    canonical === null ||
    Buffer.byteLength(canonical, "utf8") >
      AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes
  ) {
    return null;
  }
  return Object.freeze({ locator, canonical });
}

/** @param {string} canonical */
function candidate(canonical: string) {
  return Object.freeze({
    status: "candidate",
    reason: "authority_root_locator_untrusted_verification_required",
    locatorHash: createHash("sha256").update(canonical).digest("hex"),
    summary: Object.freeze({
      contract: AUTHORITY_ROOT_LOCATOR_CONTRACT,
      contractRevision: AUTHORITY_ROOT_LOCATOR_CONTRACT_REVISION,
      locatorRevision: 1,
      absolutePathReported: false,
      containsCredentials: false,
    }),
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/** @param {string} status @param {string} reason @param {boolean} [isPairContentMatched] */
function bindingResponse(
  status: string,
  reason: string,
  isPairContentMatched = false,
) {
  return Object.freeze({
    status,
    reason,
    pairContentMatched: isPairContentMatched,
    provisioningRecordVerification: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/** @param {unknown} rawLocator */
export function compileAuthorityRootLocatorCandidate(rawLocator: unknown) {
  try {
    const compiled = compileInternal(rawLocator);
    return compiled
      ? candidate(compiled.canonical)
      : blocked("authority_root_locator_invalid");
  } catch {
    return blocked("authority_root_locator_invalid");
  }
}

/** @param {unknown} input */
export function decodeAuthorityRootLocatorCandidate(input: unknown) {
  try {
    if (!Buffer.isBuffer(input))
      return blocked("authority_root_locator_bytes_required");
    if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") {
      return blocked("authority_root_locator_bytes_invalid");
    }
    const rawInputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (
      typeof rawInputLength !== "number" ||
      !Number.isSafeInteger(rawInputLength) ||
      rawInputLength < 0
    ) {
      return blocked("authority_root_locator_bytes_invalid");
    }
    const inputLength = rawInputLength;
    if (inputLength > AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes) {
      return blocked("authority_root_locator_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    if (
      inputLength >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
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
export function evaluateAuthorityRootLocatorActivationBindingCandidate(
  rawLocator: unknown,
  rawExpected: unknown,
) {
  try {
    const expected = snapshotPlainRecord(rawExpected, activationBindingKeys);
    if (
      !expected ||
      !hash(expected.repositoryIdentityHash) ||
      !hash(expected.runtimeRootIdentityHash) ||
      !isRuntimeActivationIdCandidate(expected.activationId) ||
      !positiveRevision(expected.activationRevision) ||
      !hash(expected.activationRecordHash)
    ) {
      return bindingResponse(
        "blocked",
        "authority_root_locator_activation_binding_input_invalid",
      );
    }
    const compiled = compileInternal(rawLocator);
    if (!compiled) {
      return bindingResponse("blocked", "authority_root_locator_invalid");
    }
    const locator = compiled.locator;
    if (
      RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS.some(
        (key) => locator[key] !== expected[key],
      )
    ) {
      return bindingResponse(
        "blocked",
        "authority_root_locator_activation_binding_mismatch",
      );
    }
    return bindingResponse(
      "candidate",
      "authority_root_locator_activation_binding_candidate",
      true,
    );
  } catch {
    return bindingResponse(
      "blocked",
      "authority_root_locator_activation_binding_input_invalid",
    );
  }
}

function locatorStoreBlocked(reason: string, isRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    locatorHash: null,
    persistenceCompleted: false,
    recoveryRequired: isRecoveryRequired,
    authorityRootObjectObserved: false,
    absolutePathReported: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function directoryIdentity(target: string) {
  const metadata = fs.lstatSync(target, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    return null;
  }
  const identity = Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
  const realPath = fs.realpathSync.native(target);
  const resolved = fs.lstatSync(realPath, { bigint: true });
  const after = fs.lstatSync(target, { bigint: true });
  return realPath === target &&
    resolved.isDirectory() &&
    !resolved.isSymbolicLink() &&
    after.isDirectory() &&
    !after.isSymbolicLink() &&
    resolved.dev === identity.dev &&
    resolved.ino === identity.ino &&
    resolved.birthtimeNs === identity.birthtimeNs &&
    after.dev === identity.dev &&
    after.ino === identity.ino &&
    after.birthtimeNs === identity.birthtimeNs
    ? Object.freeze({ ...identity, realPath })
    : null;
}

function sameDirectoryIdentity(
  left: NonNullable<ReturnType<typeof directoryIdentity>>,
  right: NonNullable<ReturnType<typeof directoryIdentity>>,
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

type RootRelationSession = Readonly<{
  repositoryRoot: string;
  authorityRoot: string;
  repositoryIdentity: NonNullable<ReturnType<typeof directoryIdentity>>;
  authorityIdentity: NonNullable<ReturnType<typeof directoryIdentity>>;
}>;

function isStrictlyInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative !== "" &&
    relative !== "." &&
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`)
  );
}

function isDisjoint(left: string, right: string) {
  return (
    path.relative(left, right) !== "" &&
    !isStrictlyInside(left, right) &&
    !isStrictlyInside(right, left)
  );
}

function createRootRelationSession(
  repositoryRoot: string,
  authorityRoot: string,
): RootRelationSession | null {
  const repositoryIdentity = directoryIdentity(repositoryRoot);
  const authorityIdentity = directoryIdentity(authorityRoot);
  if (
    !repositoryIdentity ||
    !authorityIdentity ||
    !isDisjoint(repositoryRoot, authorityRoot) ||
    !isDisjoint(repositoryIdentity.realPath, authorityIdentity.realPath)
  ) {
    return null;
  }
  return Object.freeze({
    repositoryRoot,
    authorityRoot,
    repositoryIdentity,
    authorityIdentity,
  });
}

function verifyRootRelationSession(session: RootRelationSession) {
  const repositoryIdentity = directoryIdentity(session.repositoryRoot);
  const authorityIdentity = directoryIdentity(session.authorityRoot);
  return Boolean(
    repositoryIdentity &&
      authorityIdentity &&
      sameDirectoryIdentity(session.repositoryIdentity, repositoryIdentity) &&
      sameDirectoryIdentity(session.authorityIdentity, authorityIdentity) &&
      repositoryIdentity.realPath === session.repositoryIdentity.realPath &&
      authorityIdentity.realPath === session.authorityIdentity.realPath &&
      isDisjoint(session.repositoryRoot, session.authorityRoot) &&
      isDisjoint(repositoryIdentity.realPath, authorityIdentity.realPath),
  );
}

function locatorStorePaths(repositoryRoot: unknown) {
  if (
    typeof repositoryRoot !== "string" ||
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  ) {
    return null;
  }
  const repositoryIdentity = directoryIdentity(repositoryRoot);
  const runtimeDirectory = path.join(repositoryRoot, ".crdd-runtime");
  const runtimeIdentity = directoryIdentity(runtimeDirectory);
  if (!repositoryIdentity || !runtimeIdentity) return null;
  const target = path.join(repositoryRoot, AUTHORITY_ROOT_LOCATOR_FILE);
  return Object.freeze({
    repositoryRoot,
    runtimeDirectory,
    repositoryIdentity,
    runtimeIdentity,
    target,
    pending: `${target}${LOCATOR_PENDING_SUFFIX}`,
  });
}

function verifyLocatorStorePaths(
  paths: NonNullable<ReturnType<typeof locatorStorePaths>>,
) {
  const repositoryIdentity = directoryIdentity(paths.repositoryRoot);
  const runtimeIdentity = directoryIdentity(paths.runtimeDirectory);
  return Boolean(
    repositoryIdentity &&
      runtimeIdentity &&
      sameDirectoryIdentity(paths.repositoryIdentity, repositoryIdentity) &&
      sameDirectoryIdentity(paths.runtimeIdentity, runtimeIdentity),
  );
}

function readStableLocatorBytes(target: string) {
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const handle = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(handle);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size < 1 ||
      opened.size > AUTHORITY_ROOT_LOCATOR_INPUT_LIMITS.rawBytes
    ) {
      return null;
    }
    const bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        handle,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count < 1) return null;
      offset += count;
    }
    const after = fs.fstatSync(handle);
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.size === opened.size
      ? bytes
      : null;
  } finally {
    fs.closeSync(handle);
  }
}

function decodeStoredLocator(bytes: Buffer) {
  const decoded = decodeAuthorityRootLocatorCandidate(bytes);
  if (decoded.status !== "candidate") return null;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const compiled = compileInternal(JSON.parse(source));
    return compiled &&
      decoded.locatorHash ===
        createHash("sha256").update(compiled.canonical).digest("hex")
      ? Object.freeze({
          locator: compiled.locator,
          locatorHash: decoded.locatorHash,
          canonicalBytes: Buffer.from(compiled.canonical, "utf8"),
        })
      : null;
  } catch {
    return null;
  }
}

function loadStoredLocator(
  paths: NonNullable<ReturnType<typeof locatorStorePaths>>,
  target: string,
) {
  const bytes = readStableLocatorBytes(target);
  const stored = bytes ? decodeStoredLocator(bytes) : null;
  return stored && verifyLocatorStorePaths(paths) ? stored : null;
}

function syncLocatorDirectory(directory: string) {
  try {
    const handle = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(handle);
      return true;
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if (
      process.platform === "win32" &&
      error instanceof Error &&
      "code" in error &&
      ["EBADF", "EINVAL", "EPERM"].includes(String(error.code))
    ) {
      return false;
    }
    throw error;
  }
}

function locatorStoreCandidate(
  locatorHash: string,
  reason: string,
  isFilesystemEffectIssued: boolean,
  isParentDirectorySyncCompleted: boolean | null,
) {
  return Object.freeze({
    status: "candidate" as const,
    reason,
    locatorHash,
    persistenceCompleted: true,
    recoveryRequired: false,
    authorityRootObjectObserved: false,
    absolutePathReported: false,
    filesystemEffectIssued: isFilesystemEffectIssued,
    parentDirectorySyncCompleted: isParentDirectorySyncCompleted,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export function persistAuthorityRootLocatorForEffect(
  repositoryRoot: unknown,
  rawLocator: unknown,
) {
  try {
    const paths = locatorStorePaths(repositoryRoot);
    const compiled = compileInternal(rawLocator);
    if (!paths || !compiled) {
      return locatorStoreBlocked("authority_root_locator_store_input_invalid");
    }
    if (fs.existsSync(paths.pending)) {
      return locatorStoreBlocked(
        "authority_root_locator_store_recovery_required",
        true,
      );
    }
    const canonicalBytes = Buffer.from(compiled.canonical, "utf8");
    const locatorHash = createHash("sha256")
      .update(canonicalBytes)
      .digest("hex");
    if (fs.existsSync(paths.target)) {
      const current = loadStoredLocator(paths, paths.target);
      if (
        current &&
        Buffer.prototype.equals.call(current.canonicalBytes, canonicalBytes)
      ) {
        return locatorStoreCandidate(
          locatorHash,
          "authority_root_locator_already_persisted",
          false,
          null,
        );
      }
      return locatorStoreBlocked(
        "authority_root_locator_store_transition_not_implemented",
      );
    }
    const handle = fs.openSync(paths.pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, canonicalBytes);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    if (!verifyLocatorStorePaths(paths)) {
      return locatorStoreBlocked(
        "authority_root_locator_store_identity_changed",
        true,
      );
    }
    fs.renameSync(paths.pending, paths.target);
    const isDirectorySynced = syncLocatorDirectory(paths.runtimeDirectory);
    const confirmed = loadStoredLocator(paths, paths.target);
    if (
      !confirmed ||
      !Buffer.prototype.equals.call(confirmed.canonicalBytes, canonicalBytes)
    ) {
      return locatorStoreBlocked(
        "authority_root_locator_store_persistence_failed",
      );
    }
    return locatorStoreCandidate(
      locatorHash,
      "authority_root_locator_persisted_and_reread",
      true,
      isDirectorySynced,
    );
  } catch {
    return locatorStoreBlocked(
      "authority_root_locator_store_persistence_failed",
    );
  }
}

export function loadAuthorityRootLocatorCandidate(repositoryRoot: unknown) {
  try {
    const paths = locatorStorePaths(repositoryRoot);
    if (!paths)
      return locatorStoreBlocked("authority_root_locator_store_root_invalid");
    if (fs.existsSync(paths.pending)) {
      return locatorStoreBlocked(
        "authority_root_locator_store_recovery_required",
        true,
      );
    }
    const stored = fs.existsSync(paths.target)
      ? loadStoredLocator(paths, paths.target)
      : null;
    return stored
      ? locatorStoreCandidate(
          stored.locatorHash,
          "authority_root_locator_loaded_candidate",
          false,
          null,
        )
      : locatorStoreBlocked("authority_root_locator_store_current_unavailable");
  } catch {
    return locatorStoreBlocked("authority_root_locator_store_read_failed");
  }
}

export function resolveAuthorityRootFromStoredLocatorCandidate(
  repositoryRoot: unknown,
) {
  try {
    const paths = locatorStorePaths(repositoryRoot);
    if (
      !paths ||
      fs.existsSync(paths.pending) ||
      !fs.existsSync(paths.target)
    ) {
      return locatorStoreBlocked("authority_root_locator_resolver_unavailable");
    }
    const stored = loadStoredLocator(paths, paths.target);
    if (!stored) {
      return locatorStoreBlocked("authority_root_locator_resolver_unavailable");
    }
    const authorityRootPath = stored.locator.authorityRootAbsolutePath;
    if (typeof authorityRootPath !== "string") {
      return locatorStoreBlocked("authority_root_locator_resolver_invalid");
    }
    const rootRelation = createRootRelationSession(
      paths.repositoryRoot,
      authorityRootPath,
    );
    if (!rootRelation) {
      return locatorStoreBlocked(
        "authority_root_locator_repository_containment_rejected",
      );
    }
    const identity = directoryIdentity(authorityRootPath);
    if (!identity) {
      return locatorStoreBlocked("authority_root_locator_root_object_invalid");
    }
    if (!verifyRootRelationSession(rootRelation)) {
      return locatorStoreBlocked(
        "authority_root_locator_root_relation_changed",
      );
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "authority_root_locator_root_object_resolved_candidate",
      locatorHash: stored.locatorHash,
      persistenceCompleted: true,
      recoveryRequired: false,
      authorityRootObjectObserved: true,
      authorityRootIdentityVerification: "required",
      authorityRootProtectionVerification: "required",
      absolutePathReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return locatorStoreBlocked("authority_root_locator_resolver_failed");
  }
}

export function verifyStoredAuthorityRootLocatorRecordCandidate(
  repositoryRoot: unknown,
) {
  try {
    const paths = locatorStorePaths(repositoryRoot);
    if (
      !paths ||
      fs.existsSync(paths.pending) ||
      !fs.existsSync(paths.target)
    ) {
      return locatorStoreBlocked("authority_root_locator_record_unavailable");
    }
    const stored = loadStoredLocator(paths, paths.target);
    if (!stored) {
      return locatorStoreBlocked("authority_root_locator_record_unavailable");
    }
    const locator = stored.locator;
    if (
      typeof locator.authorityRootAbsolutePath !== "string" ||
      typeof locator.authorityRootIdentityHash !== "string" ||
      typeof locator.provisioningRecordHash !== "string"
    ) {
      return locatorStoreBlocked("authority_root_locator_record_invalid");
    }
    const rootRelation = createRootRelationSession(
      paths.repositoryRoot,
      locator.authorityRootAbsolutePath,
    );
    if (!rootRelation) {
      return locatorStoreBlocked(
        "authority_root_locator_repository_containment_rejected",
      );
    }
    const authorityRootIdentity = directoryIdentity(
      locator.authorityRootAbsolutePath,
    );
    if (!authorityRootIdentity) {
      return locatorStoreBlocked("authority_root_locator_root_object_invalid");
    }
    const storageRoot = path.join(
      locator.authorityRootAbsolutePath,
      PROVISIONING_RECORD_STORAGE_DIRECTORY,
    );
    const aggregate =
      verifyCurrentProvisioningRecordWithPersistedTrustCandidate(storageRoot);
    if (
      aggregate.status !== "candidate" ||
      !("recordHash" in aggregate) ||
      aggregate.recordHash !== locator.provisioningRecordHash
    ) {
      return locatorStoreBlocked(
        "authority_root_locator_provisioning_record_mismatch",
      );
    }
    if (!verifyRootRelationSession(rootRelation)) {
      return locatorStoreBlocked(
        "authority_root_locator_root_relation_changed",
      );
    }
    const binding = verifyCurrentProvisioningRecordLocatorBindingCandidate(
      storageRoot,
      locator.authorityRootAbsolutePath,
      locator.authorityRootIdentityHash,
    );
    if (
      binding.status !== "candidate" ||
      binding.locatorBindingMatch !== true ||
      binding.recordHash !== locator.provisioningRecordHash
    ) {
      return locatorStoreBlocked(
        "authority_root_locator_provisioning_record_binding_mismatch",
      );
    }
    if (
      !verifyLocatorStorePaths(paths) ||
      !verifyRootRelationSession(rootRelation)
    ) {
      return locatorStoreBlocked(
        "authority_root_locator_store_identity_changed",
      );
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "stored_locator_persisted_trust_current_record_binding_candidate",
      locatorHash: stored.locatorHash,
      recordHash: aggregate.recordHash,
      persistenceCompleted: true,
      recoveryRequired: false,
      authorityRootObjectObserved: true,
      locatorRecordTrustBindingMatch: true,
      authorityRootIdentityVerification: "required",
      authorityRootProtectionVerification: "required",
      absolutePathReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return locatorStoreBlocked(
      "authority_root_locator_record_verification_failed",
    );
  }
}

export function verifyStoredAuthorityRootLocatorObservedRecordCandidate(
  repositoryRoot: unknown,
) {
  void repositoryRoot;
  return locatorStoreBlocked(
    "authority_root_effective_access_observation_not_implemented",
  );
}

export function recoverAuthorityRootLocatorForEffect(repositoryRoot: unknown) {
  try {
    const paths = locatorStorePaths(repositoryRoot);
    if (!paths || !fs.existsSync(paths.pending)) {
      return locatorStoreBlocked("authority_root_locator_recovery_unavailable");
    }
    const pending = loadStoredLocator(paths, paths.pending);
    if (!pending) {
      return locatorStoreBlocked(
        "authority_root_locator_pending_invalid",
        true,
      );
    }
    if (!fs.existsSync(paths.target)) {
      fs.renameSync(paths.pending, paths.target);
      const isDirectorySynced = syncLocatorDirectory(paths.runtimeDirectory);
      const confirmed = loadStoredLocator(paths, paths.target);
      return confirmed && confirmed.locatorHash === pending.locatorHash
        ? locatorStoreCandidate(
            pending.locatorHash,
            "authority_root_locator_pending_applied",
            true,
            isDirectorySynced,
          )
        : locatorStoreBlocked("authority_root_locator_recovery_failed", true);
    }
    const current = loadStoredLocator(paths, paths.target);
    if (!current || current.locatorHash !== pending.locatorHash) {
      return locatorStoreBlocked(
        "authority_root_locator_recovery_conflict",
        true,
      );
    }
    fs.unlinkSync(paths.pending);
    const isDirectorySynced = syncLocatorDirectory(paths.runtimeDirectory);
    return locatorStoreCandidate(
      current.locatorHash,
      "authority_root_locator_matching_pending_removed",
      true,
      isDirectorySynced,
    );
  } catch {
    return locatorStoreBlocked("authority_root_locator_recovery_failed", true);
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
    filesystemRead: "implemented_candidate",
    filesystemWrite: "implemented_candidate_initial_only",
    atomicPersistence: "implemented_candidate_explicit_recovery",
    resolver: "implemented_candidate_root_object_only",
    provisioningRecordVerification:
      "implemented_candidate_persisted_trust_and_binding",
    authorityRootIdentityVerification:
      "not_implemented_windows_effective_access_observation_required",
    observedProvisioningRecordBinding:
      "not_implemented_windows_effective_access_observation_required",
    activationBindingComparisonCore: "implemented_candidate",
    activeActivationBinding: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
