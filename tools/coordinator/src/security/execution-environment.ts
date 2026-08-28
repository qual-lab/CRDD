import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "./host-recovery-record.ts";
import {
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
} from "./candidate-store-kernel-lock.ts";
import {
  beginRuntimeProcessEffectDrain,
  endRuntimeProcessEffectDrain,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import { reduceHostGenerationLossTransition } from "../core/host-generation-loss-transition.ts";

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GIT_ASKPASS",
  "OPENAI_API_KEY",
  "SSH_AUTH_SOCK",
]);

const WINDOWS_RUNTIME_ENV = Object.freeze([
  "COMSPEC",
  "PATHEXT",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "WINDIR",
]);
const POSIX_RUNTIME_ENV = Object.freeze([
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SHELL",
]);
const OWNED_PREFIX = "crdd-coordinator-doctor-";
const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;
type DirectorySnapshot = Readonly<{
  parent: string;
  root: string;
  name: string;
  filesystem: FilesystemIdentity;
}>;
export type OperationDirectories = Readonly<{
  root: string;
  providerHome: string;
  workspace: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;
type ChildSnapshots = Readonly<{
  workspace: DirectorySnapshot;
  providerHome: DirectorySnapshot;
  tmp: DirectorySnapshot;
  events: DirectorySnapshot;
  projection: DirectorySnapshot;
  management: DirectorySnapshot;
}>;
type RecoveryState =
  | "initializing"
  | "host_only"
  | "docker_submission_started"
  | "docker_absent_confirmed";
type HostRecoveryState = Readonly<{
  directory: string;
  directoryIdentity: FilesystemIdentity;
  record: string;
  recordIdentity: FilesystemIdentity | null;
  nonce: string;
  state: RecoveryState;
  recordHash: string | null;
}>;
type OwnedIdentity = Readonly<{
  operationId: string;
  parent: string;
  root: string;
  prefix: string;
  filesystem: FilesystemIdentity;
  createdAt: string;
  hostRecovery: HostRecoveryState;
  children?: ChildSnapshots;
  mounts?: Readonly<{
    workspace: DirectorySnapshot;
    providerHome: DirectorySnapshot;
    tmp: DirectorySnapshot;
  }>;
}>;
export type OwnedOperationDirectories = {
  parent: string;
  root: string;
  directories: OperationDirectories | null;
  hostRecoveryId: string | null;
};
export type OwnedMountPaths = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;
type HostRecordChild = SerializableIdentity & Readonly<{ pathName: string }>;
type HostRecoveryRecord = Readonly<{
  schema: "crdd-coordinator-host-recovery/v1";
  state: RecoveryState;
  rootName: string;
  rootIdentity: SerializableIdentity | null;
  childIdentities: Readonly<Record<string, HostRecordChild>>;
  createdAt: string;
}>;

const ownedIdentities = new WeakMap<object, OwnedIdentity>();
type OwnedOperationDirectoryCreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;
const ownedOperationDirectoryCreationFailures = new WeakMap<
  object,
  OwnedOperationDirectoryCreationFailure
>();
type HostRecoveryInitializationFailure = Readonly<{
  cleanupConfirmed: boolean;
  hostRecoveryId: string | null;
}>;
const hostRecoveryInitializationFailures = new WeakMap<
  object,
  HostRecoveryInitializationFailure
>();

function throwHostRecoveryInitializationFailure(
  cause: unknown,
  details: HostRecoveryInitializationFailure,
): never {
  const error = new Error("host_recovery_initialization_failed", { cause });
  hostRecoveryInitializationFailures.set(error, Object.freeze(details));
  throw error;
}

function hostRecoveryInitializationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (hostRecoveryInitializationFailures.get(error) ?? null)
    : null;
}

function throwOwnedOperationDirectoryCreationFailure(
  cause: unknown,
  details: OwnedOperationDirectoryCreationFailure,
): never {
  const error = new Error("owned_operation_directory_creation_failed", {
    cause,
  });
  ownedOperationDirectoryCreationFailures.set(error, Object.freeze(details));
  throw error;
}

export function classifyOwnedOperationDirectoryCreationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (ownedOperationDirectoryCreationFailures.get(error) ?? null)
    : null;
}
type MountCapabilityIdentity = Readonly<{
  owned: object;
  children: ChildSnapshots;
}>;
const mountCapabilities = new WeakMap<object, MountCapabilityIdentity>();
type OperationContextIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;
export type OwnedOperationContext = Readonly<{
  operationId: string;
  createdAt: string;
}>;
const operationContextCapabilities = new WeakMap<
  object,
  OperationContextIdentity
>();
const operationContextAliases = new WeakMap<object, Set<object>>();
type OperationManagementIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;
export type OwnedOperationManagementBinding = Readonly<{
  operationId: string;
  createdAt: string;
  managementScopeBound: true;
}>;
const operationManagementCapabilities = new WeakMap<
  object,
  OperationManagementIdentity
>();
type OperationGenerationState = {
  owned: object;
  root: string;
  nonce: string;
  currentRecordHash: string;
  retired: boolean;
  lossOutcome: "cleanup_confirmed_failure" | "cleanup_unknown" | null;
  generationLock: NonNullable<
    Awaited<
      ReturnType<typeof acquireRuntimeOwnedHostOperationSupervisorLock>
    >["lock"]
  > | null;
};
const operationGenerationsByKey = new Map<string, OperationGenerationState>();
const operationGenerationByRoot = new Map<string, OperationGenerationState>();
type HostCleanupCapabilityIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
  root: string;
  nonce: string;
  recordHash: string;
  subject: object;
}>;
const hostCleanupCapabilities = new WeakMap<
  object,
  HostCleanupCapabilityIdentity
>();

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function createOperationId(): string {
  const decimal = BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString(10);
  return `OP-${decimal.padStart(6, "0")}`;
}

function revokeOwnedOperationContextCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (aliases) {
    for (const alias of aliases) {
      operationContextCapabilities.delete(alias);
      mountCapabilities.delete(alias);
      operationManagementCapabilities.delete(alias);
    }
    operationContextAliases.delete(owned);
  }
}

function revokeOwnedOperationEffectCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (!aliases) return;
  for (const alias of aliases) {
    operationContextCapabilities.delete(alias);
    mountCapabilities.delete(alias);
  }
}

function operationGenerationKey(root: string, nonce: string): string {
  return `${root}\0${nonce}`;
}

function registerOwnedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
): void {
  const recordHash = identity.hostRecovery.recordHash;
  if (!recordHash) throw new Error("owned_operation_generation_conflict");
  const key = operationGenerationKey(
    identity.root,
    identity.hostRecovery.nonce,
  );
  if (
    operationGenerationsByKey.has(key) ||
    operationGenerationByRoot.has(identity.root)
  )
    throw new Error("owned_operation_generation_conflict");
  const state: OperationGenerationState = {
    owned,
    root: identity.root,
    nonce: identity.hostRecovery.nonce,
    currentRecordHash: recordHash,
    retired: false,
    lossOutcome: null,
    generationLock: null,
  };
  operationGenerationsByKey.set(key, state);
  operationGenerationByRoot.set(identity.root, state);
}

function revokeOwnedOperationGeneration(root: string, nonce: string) {
  const key = operationGenerationKey(root, nonce);
  const state = operationGenerationsByKey.get(key);
  if (!state) return true;
  if (state.generationLock) return false;
  revokeOwnedOperationContextCapabilities(state.owned);
  ownedIdentities.delete(state.owned);
  operationGenerationsByKey.delete(key);
  if (operationGenerationByRoot.get(root) === state)
    operationGenerationByRoot.delete(root);
  return true;
}

async function revokeOwnedOperationGenerationAsync(
  root: string,
  nonce: string,
) {
  const key = operationGenerationKey(root, nonce);
  const state = operationGenerationsByKey.get(key);
  if (!state) return "released" as const;
  revokeOwnedOperationContextCapabilities(state.owned);
  let generationRelease:
    | "released"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown" = "released";
  if (state.generationLock) {
    try {
      generationRelease = await state.generationLock.release();
    } catch {
      generationRelease = "cleanup_unknown";
    }
    if (generationRelease !== "cleanup_unknown") state.generationLock = null;
  }
  if (generationRelease !== "cleanup_unknown") {
    ownedIdentities.delete(state.owned);
    operationGenerationsByKey.delete(key);
    if (operationGenerationByRoot.get(root) === state)
      operationGenerationByRoot.delete(root);
  } else {
    state.retired = true;
    poisonRuntimeProcessAfterCleanupUnknown();
  }
  return generationRelease;
}

type HostOperationRecoveryGeneration = Readonly<{
  root: string;
  nonce: string;
  lock: NonNullable<
    ReturnType<typeof acquireRuntimeOwnedHostOperationKernelLock>
  >;
}>;
const hostOperationRecoveryGenerations = new WeakMap<
  object,
  HostOperationRecoveryGeneration
>();

export function acquireHostOperationRecoveryGeneration(token: unknown) {
  try {
    const loaded = loadHostRecoveryRecordByToken(token);
    const root = path.join(loaded.parent, loaded.parsed.rootName);
    return acquireHostOperationRecoveryGenerationByIdentity(
      root,
      loaded.parsed.nonce,
    );
  } catch {
    return null;
  }
}

export function acquireHostOperationRecoveryGenerationByIdentity(
  root: unknown,
  nonce: unknown,
) {
  try {
    if (
      typeof root !== "string" ||
      !path.isAbsolute(root) ||
      path.dirname(root) !== fs.realpathSync(path.dirname(root)) ||
      typeof nonce !== "string"
    )
      return null;
    const lock = acquireRuntimeOwnedHostOperationKernelLock(
      path.basename(root),
      nonce,
    );
    if (!lock) return null;
    const capability = Object.freeze({});
    hostOperationRecoveryGenerations.set(
      capability,
      Object.freeze({ root, nonce, lock }),
    );
    return capability;
  } catch {
    return null;
  }
}

export function releaseHostOperationRecoveryGeneration(capability: unknown) {
  if (!isObject(capability)) return false;
  const generation = hostOperationRecoveryGenerations.get(capability);
  if (!generation) return false;
  hostOperationRecoveryGenerations.delete(capability);
  try {
    return generation.lock.release();
  } catch {
    return false;
  }
}

function verifyHostOperationRecoveryGeneration(
  capability: unknown,
  root: string,
  nonce: string,
) {
  const generation = isObject(capability)
    ? (hostOperationRecoveryGenerations.get(capability) ?? null)
    : null;
  if (!generation || generation.root !== root || generation.nonce !== nonce)
    throw new Error("host_recovery_generation_active");
}

function retireOwnedOperationGeneration(root: string, nonce: string): void {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(root, nonce),
  );
  if (!state) return;
  state.retired = true;
  revokeOwnedOperationContextCapabilities(state.owned);
}

function ownedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): OperationGenerationState {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(identity.root, identity.hostRecovery.nonce),
  );
  if (
    !state ||
    state.owned !== owned ||
    operationGenerationByRoot.get(identity.root) !== state ||
    state.currentRecordHash !== identity.hostRecovery.recordHash ||
    (!shouldAllowRetired && state.retired)
  )
    throw new Error("owned_operation_identity_replaced");
  if (
    !shouldAllowRetired &&
    state.generationLock &&
    !state.generationLock.assertLive()
  ) {
    state.retired = true;
    revokeOwnedOperationEffectCapabilities(state.owned);
    throw new Error("owned_operation_generation_liveness_lost");
  }
  return state;
}

function operationIdentityReplacement(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    errorCode(error) === "ENOENT" ||
    message === "owned_operation_identity_replaced" ||
    message === "owned_operation_mount_replaced"
  );
}

function validateOwnedOperationIdentity(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): ChildSnapshots {
  try {
    ownedOperationGeneration(owned, identity, shouldAllowRetired);
    if (
      !identity.children ||
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent ||
      fs.realpathSync(identity.root) !== identity.root ||
      fs.realpathSync(identity.parent) !== identity.parent ||
      path.dirname(identity.root) !== identity.parent ||
      !path.basename(identity.root).startsWith(identity.prefix) ||
      !sameFilesystemIdentity(
        readFilesystemIdentity(identity.root),
        identity.filesystem,
      )
    ) {
      throw new Error("owned_operation_identity_replaced");
    }
    for (const snapshot of Object.values(identity.children))
      validateDirectorySnapshot(snapshot);
    return identity.children;
  } catch (error) {
    if (operationIdentityReplacement(error)) {
      retireOwnedOperationGeneration(
        identity.root,
        identity.hostRecovery.nonce,
      );
      throw new Error("owned_operation_identity_replaced");
    }
    throw new Error("owned_operation_identity_observation_blocked");
  }
}

function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.get ||
    descriptor.set
  )
    return undefined;
  return descriptor.value;
}

function ownString(value: unknown, key: string): string | null {
  if (!isObject(value)) return null;
  const candidate = ownValue(value, key);
  return typeof candidate === "string" ? candidate : null;
}

function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

function observeFilesystemEntry(
  target: string,
): "present" | "confirmed_absent" | "unknown" {
  try {
    fs.lstatSync(target);
    return "present";
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "confirmed_absent" : "unknown";
  }
}

function requireConfirmedAbsent(target: string, reason: string): void {
  if (observeFilesystemEntry(target) !== "confirmed_absent")
    throw new Error(reason);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeSerializableIdentity(value: unknown): SerializableIdentity {
  if (!isPlainRecord(value)) throw new Error("host_recovery_record_mismatch");
  const dev = ownString(value, "dev");
  const ino = ownString(value, "ino");
  const birthtimeNs = ownString(value, "birthtimeNs");
  if (!dev || !ino || !birthtimeNs)
    throw new Error("host_recovery_record_mismatch");
  return Object.freeze({ dev, ino, birthtimeNs });
}

function normalizeRecoveryState(value: unknown): RecoveryState {
  if (
    value !== "initializing" &&
    value !== "host_only" &&
    value !== "docker_submission_started" &&
    value !== "docker_absent_confirmed"
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  return value;
}

function normalizeHostRecoveryRecord(value: unknown): HostRecoveryRecord {
  if (!isPlainRecord(value)) throw new Error("host_recovery_record_mismatch");
  const schema = ownString(value, "schema");
  const rootName = ownString(value, "rootName");
  const createdAt = ownString(value, "createdAt");
  const childValues = ownValue(value, "childIdentities");
  if (
    schema !== "crdd-coordinator-host-recovery/v1" ||
    !rootName ||
    !createdAt ||
    !isPlainRecord(childValues)
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  const childIdentities: Record<string, HostRecordChild> = {};
  for (const [name, childValue] of Object.entries(childValues)) {
    if (!isPlainRecord(childValue))
      throw new Error("host_recovery_record_mismatch");
    const pathName = ownString(childValue, "pathName");
    if (!pathName) throw new Error("host_recovery_record_mismatch");
    childIdentities[name] = Object.freeze({
      pathName,
      ...normalizeSerializableIdentity(childValue),
    });
  }
  const state = normalizeRecoveryState(ownValue(value, "state"));
  const rootIdentityValue = ownValue(value, "rootIdentity");
  const rootIdentity =
    rootIdentityValue === null
      ? null
      : normalizeSerializableIdentity(rootIdentityValue);
  if (
    (state === "initializing" && rootIdentity !== null) ||
    (state !== "initializing" && rootIdentity === null) ||
    (state === "initializing" && Object.keys(childIdentities).length !== 0)
  )
    throw new Error("host_recovery_record_mismatch");
  return Object.freeze({
    schema,
    state,
    rootName,
    rootIdentity,
    childIdentities: Object.freeze(childIdentities),
    createdAt,
  });
}

function ownedIdentity(value: unknown): OwnedIdentity | null {
  return isObject(value) ? (ownedIdentities.get(value) ?? null) : null;
}

function requireOwnedIdentity(value: object): OwnedIdentity {
  const identity = ownedIdentities.get(value);
  if (!identity) throw new Error("owned_operation_directory_identity_required");
  return identity;
}

function readFilesystemIdentity(root: string): FilesystemIdentity {
  const metadata = fs.lstatSync(root, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("owned_operation_directory_identity_unavailable");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

function readFileIdentity(target: string): FilesystemIdentity {
  const metadata = fs.lstatSync(target, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("owned_operation_file_identity_unavailable");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

function readOpenFileIdentity(handle: number): FilesystemIdentity {
  const metadata = fs.fstatSync(handle, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("owned_operation_file_identity_unavailable");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

function exactHostRecoveryTokenFromMarker(
  target: string,
  expectedRootName: string,
  nonce: string,
  allowed: readonly Readonly<{
    identity: FilesystemIdentity;
    serialized: string;
  }>[],
): string | null {
  try {
    if (observeFilesystemEntry(target) !== "present") return null;
    const firstIdentity = readFileIdentity(target);
    const firstSerialized = fs.readFileSync(target, "utf8");
    if (
      !allowed.some(
        (candidate) =>
          sameFilesystemIdentity(firstIdentity, candidate.identity) &&
          firstSerialized === candidate.serialized,
      )
    )
      return null;
    const record = normalizeHostRecoveryRecord(JSON.parse(firstSerialized));
    if (record.rootName !== expectedRootName) return null;
    const secondIdentity = readFileIdentity(target);
    const secondSerialized = fs.readFileSync(target, "utf8");
    if (
      !sameFilesystemIdentity(firstIdentity, secondIdentity) ||
      firstSerialized !== secondSerialized
    )
      return null;
    const recordHash = createHash("sha256")
      .update(firstSerialized)
      .digest("hex");
    return `host.${expectedRootName}.${nonce}.${recordHash}`;
  } catch {
    return null;
  }
}

function sameFilesystemIdentity(
  left: FilesystemIdentity,
  right: FilesystemIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function directorySnapshot(
  directory: string,
  parent: string,
  name: string,
): DirectorySnapshot {
  const realParent = fs.realpathSync(parent);
  const realDirectory = fs.realpathSync(directory);
  if (
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== name
  ) {
    throw new Error("owned_operation_mount_boundary_failed");
  }
  return Object.freeze({
    parent: realParent,
    root: realDirectory,
    name,
    filesystem: readFilesystemIdentity(realDirectory),
  });
}

function validateDirectorySnapshot(snapshot: DirectorySnapshot): string {
  const realParent = fs.realpathSync(snapshot.parent);
  const realDirectory = fs.realpathSync(snapshot.root);
  const filesystem = readFilesystemIdentity(snapshot.root);
  if (
    realParent !== snapshot.parent ||
    realDirectory !== snapshot.root ||
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== snapshot.name ||
    !sameFilesystemIdentity(filesystem, snapshot.filesystem)
  ) {
    throw new Error("owned_operation_mount_replaced");
  }
  return snapshot.root;
}

function copyIfPresent(
  target: Record<string, string>,
  source: unknown,
  name: string,
): void {
  const candidate = ownString(source, name);
  if (candidate !== null) target[name] = candidate;
}

function serializableIdentity(target: string): SerializableIdentity {
  const identity = readFilesystemIdentity(target);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
): boolean {
  try {
    const identity = readFilesystemIdentity(target);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

function ensureHostRecoveryDirectory(
  parent: string,
): Readonly<{ directory: string; identity: FilesystemIdentity }> {
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  const before = observeFilesystemEntry(directory);
  if (before === "unknown")
    throwHostRecoveryInitializationFailure(
      new Error("host_recovery_directory_observation_unknown"),
      { cleanupConfirmed: false, hostRecoveryId: null },
    );
  let creationAttempted = false;
  let created = false;
  let identity: FilesystemIdentity | null = null;
  try {
    if (before === "confirmed_absent") {
      creationAttempted = true;
      fs.mkdirSync(directory, { mode: 0o700 });
      created = true;
    }
    const real = fs.realpathSync(directory);
    const metadata = fs.lstatSync(real);
    identity = readFilesystemIdentity(real);
    if (
      real !== directory ||
      path.dirname(real) !== parent ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink()
    ) {
      throw new Error("host_recovery_directory_untrusted");
    }
    return { directory: real, identity };
  } catch (error) {
    let cleanupConfirmed = !creationAttempted;
    if (created && identity) {
      try {
        if (
          !sameFilesystemIdentity(
            readFilesystemIdentity(directory),
            identity,
          ) ||
          fs.readdirSync(directory).length !== 0
        )
          throw new Error("host_recovery_directory_replaced");
        fs.rmdirSync(directory);
        requireConfirmedAbsent(
          directory,
          "host_recovery_directory_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (!cleanupConfirmed)
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: null,
      });
    throw error;
  }
}

function hostRecordContent(
  identity: OwnedIdentity,
  state: RecoveryState,
): HostRecoveryRecord {
  return {
    schema: "crdd-coordinator-host-recovery/v1",
    state,
    rootName: path.basename(identity.root),
    rootIdentity: serializableIdentity(identity.root),
    childIdentities: Object.fromEntries(
      Object.entries(identity.children ?? {}).map(([name, snapshot]) => [
        name,
        {
          pathName: snapshot.name,
          ...serializableIdentity(snapshot.root),
        },
      ]),
    ),
    createdAt: identity.createdAt,
  };
}

function writeInitializingHostRecoveryRecord(
  target: string,
  rootName: string,
  nonce: string,
  createdAt: string,
): Readonly<{
  recordHash: string;
  recordIdentity: FilesystemIdentity;
  serialized: string;
  token: string;
}> {
  const record: HostRecoveryRecord = Object.freeze({
    schema: "crdd-coordinator-host-recovery/v1",
    state: "initializing",
    rootName,
    rootIdentity: null,
    childIdentities: Object.freeze({}),
    createdAt,
  });
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const token = `host.${rootName}.${nonce}.${recordHash}`;
  let handle: number | null = null;
  let recordIdentity: FilesystemIdentity | null = null;
  let entryCreated = false;
  try {
    handle = fs.openSync(target, "wx", 0o600);
    entryCreated = true;
    recordIdentity = readOpenFileIdentity(handle);
    fs.writeFileSync(handle, serialized, "utf8");
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    if (
      !sameFilesystemIdentity(readFileIdentity(target), recordIdentity) ||
      fs.readFileSync(target, "utf8") !== serialized
    )
      throw new Error("host_recovery_record_replaced");
  } catch (error) {
    let cleanupConfirmed = !entryCreated;
    let handleSettled = handle === null;
    if (handle !== null) {
      try {
        fs.closeSync(handle);
        handle = null;
        handleSettled = true;
      } catch {
        handleSettled = false;
      }
    }
    if (recordIdentity && handleSettled) {
      try {
        const observation = observeFilesystemEntry(target);
        if (observation === "present") {
          if (!sameFilesystemIdentity(readFileIdentity(target), recordIdentity))
            throw new Error("host_recovery_record_replaced");
          fs.rmSync(target);
        } else if (observation === "unknown") {
          throw new Error("host_recovery_record_observation_unknown");
        }
        requireConfirmedAbsent(
          target,
          "host_recovery_record_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (!cleanupConfirmed || !handleSettled)
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: exactHostRecoveryTokenFromMarker(
          target,
          rootName,
          nonce,
          recordIdentity
            ? [Object.freeze({ identity: recordIdentity, serialized })]
            : [],
        ),
      });
    throw error;
  }
  if (!recordIdentity)
    throw new Error("host_recovery_record_identity_unavailable");
  return Object.freeze({
    recordHash,
    recordIdentity,
    serialized,
    token,
  });
}

function writeHostRecoveryRecord(
  owned: object,
  identity: OwnedIdentity,
  state: RecoveryState,
): string {
  const previous = readCurrentOwnedHostRecord(identity);
  if (
    !identity.hostRecovery.recordIdentity ||
    createHash("sha256").update(previous.serialized).digest("hex") !==
      identity.hostRecovery.recordHash ||
    previous.record.state !== identity.hostRecovery.state
  )
    throw new Error("host_recovery_record_mismatch");
  const record = hostRecordContent(identity, state);
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const target = identity.hostRecovery.record;
  const temporary = `${target}.${randomUUID()}.tmp`;
  let temporaryHandle: number | null = null;
  let temporaryIdentity: FilesystemIdentity | null = null;
  let temporaryCreated = false;
  let renamed = false;
  try {
    temporaryHandle = fs.openSync(temporary, "wx", 0o600);
    temporaryCreated = true;
    temporaryIdentity = readOpenFileIdentity(temporaryHandle);
    fs.writeFileSync(temporaryHandle, serialized, "utf8");
    fs.fsyncSync(temporaryHandle);
    fs.closeSync(temporaryHandle);
    temporaryHandle = null;
    fs.renameSync(temporary, target);
    renamed = true;
    if (
      !temporaryIdentity ||
      !sameFilesystemIdentity(readFileIdentity(target), temporaryIdentity)
    )
      throw new Error("host_recovery_record_replaced");
    if (fs.readFileSync(target, "utf8") !== serialized)
      throw new Error("host_recovery_record_replaced");
  } catch (error) {
    let cleanupConfirmed = !temporaryCreated;
    let handleSettled = temporaryHandle === null;
    if (temporaryHandle !== null) {
      try {
        fs.closeSync(temporaryHandle);
        temporaryHandle = null;
        handleSettled = true;
      } catch {
        handleSettled = false;
      }
    }
    const cleanupTarget = renamed ? target : temporary;
    if (temporaryIdentity && handleSettled) {
      try {
        const observation = observeFilesystemEntry(cleanupTarget);
        if (observation === "present") {
          if (
            !sameFilesystemIdentity(
              readFileIdentity(cleanupTarget),
              temporaryIdentity,
            )
          )
            throw new Error("host_recovery_record_replaced");
          fs.rmSync(cleanupTarget);
        } else if (observation === "unknown") {
          throw new Error("host_recovery_record_observation_unknown");
        }
        requireConfirmedAbsent(
          cleanupTarget,
          "host_recovery_record_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    const retainedRecoveryId = exactHostRecoveryTokenFromMarker(
      target,
      path.basename(identity.root),
      identity.hostRecovery.nonce,
      [
        Object.freeze({
          identity: identity.hostRecovery.recordIdentity,
          serialized: previous.serialized,
        }),
        ...(temporaryIdentity
          ? [Object.freeze({ identity: temporaryIdentity, serialized })]
          : []),
      ],
    );
    const originalRecoveryId = expectedHostRecoveryToken(identity);
    if (
      !cleanupConfirmed ||
      !handleSettled ||
      retainedRecoveryId !== originalRecoveryId
    )
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: retainedRecoveryId,
      });
    throw error;
  }
  const updated = Object.freeze({
    ...identity,
    hostRecovery: Object.freeze({
      ...identity.hostRecovery,
      state,
      recordHash,
      recordIdentity: readFileIdentity(target),
    }),
  });
  ownedIdentities.set(owned, updated);
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${recordHash}`;
}

export function createOperationDirectories(
  rootDirectory: string,
): OperationDirectories {
  const directories = {
    root: rootDirectory,
    providerHome: path.join(rootDirectory, "provider-home"),
    workspace: path.join(rootDirectory, "workspace"),
    tmp: path.join(rootDirectory, "tmp"),
    events: path.join(rootDirectory, "events"),
    projection: path.join(rootDirectory, "projection"),
    management: path.join(rootDirectory, "management"),
  };
  for (const directory of Object.values(directories))
    fs.mkdirSync(directory, { recursive: true });
  return directories;
}

export function createOwnedOperationDirectories(
  temporaryParent?: string,
): OwnedOperationDirectories & { directories: OperationDirectories };
export function createOwnedOperationDirectories(
  temporaryParent: string = os.tmpdir(),
): OwnedOperationDirectories {
  let parent: string | null = null;
  let createdRoot: string | null = null;
  let createdRootIdentity: FilesystemIdentity | null = null;
  let realRoot: string | null = null;
  let owned: OwnedOperationDirectories | null = null;
  let initializingRecord: Readonly<{
    path: string;
    identity: FilesystemIdentity;
    serialized: string;
    token: string;
  }> | null = null;
  try {
    parent = fs.realpathSync(temporaryParent);
    const parentMetadata = fs.lstatSync(parent);
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw new Error("temporary_parent_must_be_real_directory");
    }
    const recovery = ensureHostRecoveryDirectory(parent);
    const nonce = randomUUID();
    const rootName = `${OWNED_PREFIX}${nonce}`;
    const createdAt = new Date().toISOString();
    const recoveryRecord = path.join(
      recovery.directory,
      `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
    );
    const initializing = writeInitializingHostRecoveryRecord(
      recoveryRecord,
      rootName,
      nonce,
      createdAt,
    );
    initializingRecord = Object.freeze({
      path: recoveryRecord,
      identity: initializing.recordIdentity,
      serialized: initializing.serialized,
      token: initializing.token,
    });
    const candidateRoot = path.join(parent, rootName);
    fs.mkdirSync(candidateRoot);
    createdRoot = candidateRoot;
    createdRootIdentity = readFilesystemIdentity(createdRoot);
    realRoot = fs.realpathSync(createdRoot);
    if (
      path.dirname(realRoot) !== parent ||
      !path.basename(realRoot).startsWith(OWNED_PREFIX)
    ) {
      throw new Error("owned_operation_directory_boundary_failed");
    }
    owned = {
      parent,
      root: realRoot,
      directories: null,
      hostRecoveryId: null,
    };
    ownedIdentities.set(
      owned,
      Object.freeze({
        operationId: createOperationId(),
        parent,
        root: realRoot,
        prefix: OWNED_PREFIX,
        filesystem: readFilesystemIdentity(realRoot),
        createdAt,
        hostRecovery: Object.freeze({
          directory: recovery.directory,
          directoryIdentity: recovery.identity,
          record: recoveryRecord,
          recordIdentity: initializing.recordIdentity,
          nonce,
          state: "initializing",
          recordHash: initializing.recordHash,
        }),
      }),
    );
    owned.directories = createOperationDirectories(realRoot);
    const identity = requireOwnedIdentity(owned);
    if (!owned.directories)
      throw new Error("owned_operation_directory_identity_required");
    const children = Object.freeze({
      workspace: directorySnapshot(
        owned.directories.workspace,
        realRoot,
        "workspace",
      ),
      providerHome: directorySnapshot(
        owned.directories.providerHome,
        realRoot,
        "provider-home",
      ),
      tmp: directorySnapshot(owned.directories.tmp, realRoot, "tmp"),
      events: directorySnapshot(owned.directories.events, realRoot, "events"),
      projection: directorySnapshot(
        owned.directories.projection,
        realRoot,
        "projection",
      ),
      management: directorySnapshot(
        owned.directories.management,
        realRoot,
        "management",
      ),
    });
    ownedIdentities.set(
      owned,
      Object.freeze({
        ...identity,
        children,
        mounts: Object.freeze({
          workspace: children.workspace,
          providerHome: children.providerHome,
          tmp: children.tmp,
        }),
      }),
    );
    owned.hostRecoveryId = writeHostRecoveryRecord(
      owned,
      requireOwnedIdentity(owned),
      "host_only",
    );
    registerOwnedOperationGeneration(owned, requireOwnedIdentity(owned));
    return owned;
  } catch (error) {
    const nestedFailure = hostRecoveryInitializationFailure(error);
    let cleanupConfirmed = nestedFailure?.cleanupConfirmed ?? true;
    let rootCleanupConfirmed = createdRoot === null;
    let markerCleanupConfirmed = initializingRecord === null;
    if (cleanupConfirmed) {
      try {
        if (realRoot !== null && owned && ownedIdentity(owned)) {
          rollbackInitializingOperationDirectories(owned);
          rootCleanupConfirmed = true;
          markerCleanupConfirmed = true;
        } else if (
          createdRoot !== null &&
          createdRootIdentity !== null &&
          parent !== null
        ) {
          const metadata = fs.lstatSync(createdRoot);
          if (
            metadata.isSymbolicLink() ||
            !metadata.isDirectory() ||
            fs.realpathSync(createdRoot) !== createdRoot ||
            path.dirname(createdRoot) !== parent ||
            !path.basename(createdRoot).startsWith(OWNED_PREFIX) ||
            !sameFilesystemIdentity(
              readFilesystemIdentity(createdRoot),
              createdRootIdentity,
            )
          )
            throw new Error("owned_operation_directory_boundary_failed");
          fs.rmSync(createdRoot, { recursive: true, force: false });
          requireConfirmedAbsent(
            createdRoot,
            "owned_operation_directory_cleanup_incomplete",
          );
          rootCleanupConfirmed = true;
        }
      } catch {
        rootCleanupConfirmed = false;
      }
      if (rootCleanupConfirmed && !owned && initializingRecord) {
        try {
          const observation = observeFilesystemEntry(initializingRecord.path);
          if (observation === "present") {
            if (
              !sameFilesystemIdentity(
                readFileIdentity(initializingRecord.path),
                initializingRecord.identity,
              )
            )
              throw new Error("host_recovery_record_replaced");
            fs.rmSync(initializingRecord.path);
          } else if (observation === "unknown") {
            throw new Error("host_recovery_record_observation_unknown");
          }
          requireConfirmedAbsent(
            initializingRecord.path,
            "host_recovery_record_cleanup_unconfirmed",
          );
          markerCleanupConfirmed = true;
        } catch {
          markerCleanupConfirmed = false;
        }
      }
    }
    cleanupConfirmed =
      cleanupConfirmed && rootCleanupConfirmed && markerCleanupConfirmed;
    let retainedRecoveryId = nestedFailure?.hostRecoveryId ?? null;
    if (!nestedFailure && initializingRecord) {
      try {
        const parsed = parseHostRecoveryToken(initializingRecord.token);
        retainedRecoveryId = sameFilesystemIdentity(
          readFileIdentity(initializingRecord.path),
          initializingRecord.identity,
        )
          ? exactHostRecoveryTokenFromMarker(
              initializingRecord.path,
              parsed.rootName,
              parsed.nonce,
              [
                Object.freeze({
                  identity: initializingRecord.identity,
                  serialized: initializingRecord.serialized,
                }),
              ],
            )
          : null;
      } catch {
        retainedRecoveryId = null;
      }
    }
    throwOwnedOperationDirectoryCreationFailure(error, {
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId: !cleanupConfirmed ? retainedRecoveryId : null,
    });
  }
}

export function getOwnedHostRecoveryId(owned: unknown): string {
  const identity = ownedIdentity(owned);
  if (!identity?.hostRecovery?.recordHash)
    throw new Error("owned_operation_directory_identity_required");
  validatePrivateHostRecoveryRecord(identity, "host_only");
  return expectedHostRecoveryToken(identity);
}

function activeOwnedTransitionInputs(
  mountCapability: unknown,
  currentToken: unknown,
  expectedState: "host_only" | "docker_submission_started",
): Readonly<{
  loaded: ReturnType<typeof loadHostRecoveryRecord>;
  state: OperationGenerationState;
  identity: OwnedIdentity;
}> {
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  return activeOwnedTransitionInputsForOwned(
    mount.owned,
    currentToken,
    expectedState,
    "owned_operation_mount_capability_required",
  );
}

function activeOwnedTransitionInputsForOwned(
  owned: object,
  currentToken: unknown,
  expectedState: "host_only" | "docker_submission_started",
  bindingError = "owned_operation_management_binding_required",
): Readonly<{
  loaded: ReturnType<typeof loadHostRecoveryRecord>;
  state: OperationGenerationState;
  identity: OwnedIdentity;
}> {
  const loaded = loadHostRecoveryRecord(currentToken);
  if (loaded.record.state !== expectedState)
    throw new Error("host_recovery_state_invalid");
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  const state = operationGenerationByRoot.get(root);
  if (!state || state.owned !== owned || state.retired)
    throw new Error(bindingError);
  const identity = ownedIdentities.get(state.owned);
  if (!identity) throw new Error(bindingError);
  validateOwnedOperationIdentity(state.owned, identity);
  if (
    loaded.parsed.nonce !== state.nonce ||
    loaded.parsed.recordHash !== state.currentRecordHash ||
    loaded.marker !== identity.hostRecovery.record ||
    identity.hostRecovery.state !== expectedState
  )
    throw new Error("host_recovery_generation_mismatch");
  return Object.freeze({ loaded, state, identity });
}

function replaceHostRecoveryRecordState(
  loaded: ReturnType<typeof loadHostRecoveryRecord>,
  nextState: RecoveryState,
): Readonly<{
  recordHash: string;
  recordIdentity: FilesystemIdentity;
  token: string;
}> {
  const updatedRecord = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updatedRecord)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  const temporaryHandle = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(temporaryHandle, serialized, "utf8");
    fs.fsyncSync(temporaryHandle);
  } finally {
    fs.closeSync(temporaryHandle);
  }
  fs.renameSync(temporary, loaded.marker);
  if (fs.readFileSync(loaded.marker, "utf8") !== serialized)
    throw new Error("host_recovery_record_replaced");
  return Object.freeze({
    recordHash,
    recordIdentity: readFileIdentity(loaded.marker),
    token: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${recordHash}`,
  });
}

export function transitionOwnedDockerSubmissionState(
  mountCapability: unknown,
  currentToken: unknown,
  action: unknown,
): string {
  const expectedState =
    action === "begin" ? "host_only" : "docker_submission_started";
  const nextState =
    action === "begin" ? "docker_submission_started" : "host_only";
  if (action !== "begin" && action !== "cancel")
    throw new Error("host_recovery_state_invalid");
  const { loaded, state, identity } = activeOwnedTransitionInputs(
    mountCapability,
    currentToken,
    expectedState,
  );
  const updated = replaceHostRecoveryRecordState(loaded, nextState);
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: nextState,
        recordHash: updated.recordHash,
        recordIdentity: updated.recordIdentity,
      }),
    }),
  );
  state.currentRecordHash = updated.recordHash;
  return updated.token;
}

function ownedOperationFromManagementCapability(managementCapability: unknown) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({ binding, identity });
}

export async function activateOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const state = ownedOperationGeneration(binding.owned, identity);
  if (state.generationLock)
    throw new Error("owned_operation_generation_lock_already_active");
  const outcome = await acquireRuntimeOwnedHostOperationSupervisorLock(
    path.basename(identity.root),
    identity.hostRecovery.nonce,
  );
  if (outcome.status === "acquired" && outcome.lock) {
    state.generationLock = outcome.lock;
    return "activated" as const;
  }
  if (outcome.status === "cleanup_unknown") {
    if (outcome.lock) state.generationLock = outcome.lock;
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    poisonRuntimeProcessAfterCleanupUnknown();
    return "cleanup_unknown" as const;
  }
  return outcome.status;
}

export async function confirmOwnedHostOperationGenerationLockReadiness(
  managementCapability: unknown,
) {
  try {
    const before = ownedOperationFromManagementCapability(managementCapability);
    const generation = ownedOperationGeneration(
      before.binding.owned,
      before.identity,
    );
    const lock = generation.generationLock;
    if (!lock) return "cleanup_confirmed_failure" as const;
    const readiness = await lock.confirmReady();
    if (readiness !== "ready") {
      if (readiness === "cleanup_unknown") {
        generation.retired = true;
        revokeOwnedOperationContextCapabilities(generation.owned);
        poisonRuntimeProcessAfterCleanupUnknown();
      } else generation.generationLock = null;
      return readiness;
    }
    const after = ownedOperationFromManagementCapability(managementCapability);
    const current = ownedOperationGeneration(
      after.binding.owned,
      after.identity,
    );
    const isCurrent =
      before.binding.owned === after.binding.owned &&
      current === generation &&
      current.generationLock === lock &&
      current.retired === false;
    if (!isCurrent)
      throw new Error("owned_operation_generation_readiness_replaced");
    validatePrivateHostRecoveryRecord(
      after.identity,
      after.identity.hostRecovery.state,
    );
    return "ready" as const;
  } catch {
    try {
      const { binding, identity } =
        ownedOperationFromManagementCapabilityForCleanup(managementCapability);
      const generation = ownedOperationGeneration(
        binding.owned,
        identity,
        true,
      );
      generation.retired = true;
      revokeOwnedOperationContextCapabilities(generation.owned);
      const lock = generation.generationLock;
      if (!lock) return "cleanup_confirmed_failure" as const;
      const released = await lock.release();
      if (released === "cleanup_unknown") {
        poisonRuntimeProcessAfterCleanupUnknown();
        return "cleanup_unknown" as const;
      }
      generation.generationLock = null;
      return "cleanup_confirmed_failure" as const;
    } catch {
      poisonRuntimeProcessAfterCleanupUnknown();
      return "cleanup_unknown" as const;
    }
  }
}

function ownedOperationFromManagementCapabilityForCleanup(
  managementCapability: unknown,
) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  return Object.freeze({ binding, identity });
}

export function observeOwnedHostOperationGenerationLoss(
  managementCapability: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const generation = ownedOperationGeneration(binding.owned, identity);
  const lock = generation.generationLock;
  if (!lock) throw new Error("owned_operation_generation_lock_required");
  let drainToken: object | null = null;
  let resolveDetected!: () => void;
  const detected = new Promise<void>((resolve) => {
    resolveDetected = resolve;
  });
  lock.onFailureDetected(() => {
    const transition = reduceHostGenerationLossTransition("failure_detected");
    generation.retired = transition.retired;
    if (transition.revokeEffectCapabilities)
      revokeOwnedOperationEffectCapabilities(generation.owned);
    if (transition.beginEffectDrain)
      drainToken ??= beginRuntimeProcessEffectDrain();
    resolveDetected();
  });
  return Object.freeze({
    detected,
    outcome: lock.loss.then((outcome) => {
      const transition = reduceHostGenerationLossTransition(outcome);
      generation.retired = transition.retired;
      generation.lossOutcome = outcome;
      if (transition.revokeEffectCapabilities)
        revokeOwnedOperationEffectCapabilities(generation.owned);
      if (transition.poisonProcess) poisonRuntimeProcessAfterCleanupUnknown();
      return outcome;
    }),
    releaseDrain: () => {
      if (!drainToken) return false;
      const token = drainToken;
      drainToken = null;
      return endRuntimeProcessEffectDrain(token);
    },
  });
}

export async function abandonOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  try {
    const { binding, identity } =
      ownedOperationFromManagementCapability(managementCapability);
    const state = ownedOperationGeneration(binding.owned, identity, true);
    if (!state.generationLock) return true;
    const released = await state.generationLock.release();
    if (released === "released") {
      state.generationLock = null;
      return true;
    }
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    if (released === "cleanup_unknown")
      poisonRuntimeProcessAfterCleanupUnknown();
    return false;
  } catch {
    return false;
  }
}

function transitionOwnedDockerSubmissionByManagement(
  managementCapability: unknown,
  currentToken: unknown,
  action: "begin" | "cancel",
) {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const expectedState =
    action === "begin" ? "host_only" : "docker_submission_started";
  const nextState =
    action === "begin" ? "docker_submission_started" : "host_only";
  const { loaded, state, identity } = activeOwnedTransitionInputsForOwned(
    binding.owned,
    currentToken,
    expectedState,
  );
  const updated = replaceHostRecoveryRecordState(loaded, nextState);
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: nextState,
        recordHash: updated.recordHash,
        recordIdentity: updated.recordIdentity,
      }),
    }),
  );
  state.currentRecordHash = updated.recordHash;
  return updated.token;
}

export function beginOwnedDockerSubmissionRecovery(
  managementCapability: unknown,
  operationId: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  if (operationId !== binding.operationId)
    throw new Error("owned_operation_management_binding_required");
  return transitionOwnedDockerSubmissionByManagement(
    managementCapability,
    expectedHostRecoveryToken(identity),
    "begin",
  );
}

export function getOwnedHostRecoveryIdByManagementCapability(
  managementCapability: unknown,
) {
  const { identity } =
    ownedOperationFromManagementCapability(managementCapability);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return expectedHostRecoveryToken(identity);
}

/** @internal Runtime-only, per-Docker-finalization cleanup authority. */
export function issueOwnedHostCleanupCapability(
  managementCapability: unknown,
  subject: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  if (!isObject(subject))
    throw new Error("owned_host_cleanup_subject_required");
  const generation = ownedOperationGeneration(binding.owned, identity);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  const capability = Object.freeze({});
  hostCleanupCapabilities.set(
    capability,
    Object.freeze({
      owned: binding.owned,
      operationId: binding.operationId,
      createdAt: binding.createdAt,
      root: identity.root,
      nonce: identity.hostRecovery.nonce,
      recordHash: generation.currentRecordHash,
      subject,
    }),
  );
  return capability;
}

/** @internal Consumed only by the Docker host-cleanup intent adapter. */
export function consumeOwnedHostRecoveryIdForCleanup(
  cleanupCapability: unknown,
  subject: unknown,
) {
  const capability = isObject(cleanupCapability) ? cleanupCapability : null;
  const binding = capability
    ? (hostCleanupCapabilities.get(capability) ?? null)
    : null;
  if (!capability || !binding || binding.subject !== subject)
    throw new Error("owned_host_cleanup_capability_required");
  hostCleanupCapabilities.delete(capability);
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt ||
    identity.root !== binding.root ||
    identity.hostRecovery.nonce !== binding.nonce
  )
    throw new Error("owned_host_cleanup_identity_changed");
  const generation = ownedOperationGeneration(binding.owned, identity, true);
  if (
    generation.currentRecordHash !== binding.recordHash ||
    (generation.retired &&
      generation.lossOutcome !== "cleanup_confirmed_failure")
  )
    throw new Error("owned_host_cleanup_generation_unavailable");
  validateOwnedOperationIdentity(binding.owned, identity, true);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return expectedHostRecoveryToken(identity);
}

export function completeOwnedDockerSubmissionRecovery(
  managementCapability: unknown,
  recoveryToken: unknown,
) {
  return transitionOwnedDockerSubmissionByManagement(
    managementCapability,
    recoveryToken,
    "cancel",
  );
}

export function confirmOwnedDockerAbsenceForRecovery(
  token: unknown,
  recoveryGenerationCapability: unknown = null,
) {
  const loaded = loadHostRecoveryRecord(token);
  if (loaded.record.state !== "docker_submission_started")
    throw new Error("host_recovery_state_invalid");
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  verifyHostOperationRecoveryGeneration(
    recoveryGenerationCapability,
    root,
    loaded.parsed.nonce,
  );
  if (operationGenerationByRoot.has(root))
    throw new Error("host_recovery_generation_active");
  if (
    observeFilesystemEntry(root) !== "present" ||
    fs.realpathSync(root) !== root ||
    path.dirname(root) !== loaded.parent ||
    !loaded.record.rootIdentity ||
    !identityMatchesRecord(root, loaded.record.rootIdentity)
  )
    throw new Error("host_recovery_root_replaced");
  const updated = replaceHostRecoveryRecordState(
    loaded,
    "docker_absent_confirmed",
  );
  return updated.token;
}

export function adoptOwnedHostRecoveryRecordTransition(
  mountCapability: unknown,
  previousToken: unknown,
  nextToken: unknown,
): void {
  const previous = parseHostRecoveryToken(previousToken);
  const loaded = loadHostRecoveryRecord(nextToken);
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  const state = operationGenerationByRoot.get(root);
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!state || !mount || mount.owned !== state.owned || state.retired)
    throw new Error("owned_operation_mount_capability_required");
  const identity = ownedIdentities.get(state.owned);
  if (!identity) throw new Error("owned_operation_mount_capability_required");
  validateOwnedOperationIdentity(state.owned, identity);
  const expectedSerialized = `${JSON.stringify(
    hostRecordContent(identity, "docker_absent_confirmed"),
  )}\n`;
  const expectedRecordHash = createHash("sha256")
    .update(expectedSerialized)
    .digest("hex");
  if (
    previous.rootName !== loaded.parsed.rootName ||
    previous.nonce !== loaded.parsed.nonce ||
    previous.nonce !== state.nonce ||
    previous.recordHash !== state.currentRecordHash ||
    loaded.parsed.recordHash === previous.recordHash ||
    loaded.parsed.recordHash !== expectedRecordHash ||
    loaded.marker !== identity.hostRecovery.record ||
    identity.hostRecovery.state !== "docker_submission_started" ||
    loaded.record.state !== "docker_absent_confirmed"
  )
    throw new Error("host_recovery_generation_mismatch");
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: "docker_absent_confirmed",
        recordHash: loaded.parsed.recordHash,
        recordIdentity: readFileIdentity(loaded.marker),
      }),
    }),
  );
  state.currentRecordHash = loaded.parsed.recordHash;
}

function readCurrentOwnedHostRecord(
  identity: OwnedIdentity,
): Readonly<{ record: HostRecoveryRecord; serialized: string }> {
  const metadata = fs.lstatSync(identity.hostRecovery.record);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    !identity.hostRecovery.recordIdentity ||
    !sameFilesystemIdentity(
      readFileIdentity(identity.hostRecovery.record),
      identity.hostRecovery.recordIdentity,
    )
  )
    throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(identity.hostRecovery.record, "utf8");
  const record: unknown = JSON.parse(serialized);
  const normalized = normalizeHostRecoveryRecord(record);
  if (normalized.rootName !== path.basename(identity.root))
    throw new Error("host_recovery_record_mismatch");
  return { record: normalized, serialized };
}

function expectedHostRecoveryToken(identity: OwnedIdentity): string {
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${identity.hostRecovery.recordHash}`;
}

function validatePrivateHostRecoveryRecord(
  identity: OwnedIdentity,
  expectedState: RecoveryState,
): HostRecoveryRecord {
  const { record, serialized } = readCurrentOwnedHostRecord(identity);
  const actualHash = createHash("sha256").update(serialized).digest("hex");
  if (
    actualHash !== identity.hostRecovery.recordHash ||
    record.state !== expectedState ||
    identity.hostRecovery.state !== expectedState ||
    record.rootName !== path.basename(identity.root)
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  if (
    !record.rootIdentity ||
    !identityMatchesRecord(identity.root, record.rootIdentity)
  )
    throw new Error("host_recovery_record_mismatch");
  for (const [name, snapshot] of Object.entries(identity.children ?? {})) {
    const recorded = record.childIdentities?.[name];
    if (!recorded || recorded.pathName !== snapshot.name)
      throw new Error("host_recovery_record_mismatch");
    if (
      BigInt(recorded.dev) !== snapshot.filesystem.dev ||
      BigInt(recorded.ino) !== snapshot.filesystem.ino ||
      BigInt(recorded.birthtimeNs) !== snapshot.filesystem.birthtimeNs
    )
      throw new Error("host_recovery_record_mismatch");
  }
  return record;
}

function rollbackInitializingOperationDirectories(owned: unknown): void {
  const identity = ownedIdentity(owned);
  if (identity?.hostRecovery.state !== "initializing") {
    cleanupOwnedOperationDirectories(owned);
    return;
  }
  const realRoot = fs.realpathSync(identity.root);
  if (
    realRoot !== identity.root ||
    fs.realpathSync(identity.parent) !== identity.parent ||
    path.dirname(realRoot) !== identity.parent ||
    !path.basename(realRoot).startsWith(identity.prefix) ||
    !sameFilesystemIdentity(
      readFilesystemIdentity(realRoot),
      identity.filesystem,
    )
  )
    throw new Error("owned_operation_directory_replaced");
  const allowed = new Set([
    "workspace",
    "provider-home",
    "tmp",
    "events",
    "projection",
    "management",
  ]);
  for (const entry of fs.readdirSync(realRoot, { withFileTypes: true })) {
    if (
      !allowed.has(entry.name) ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    ) {
      throw new Error("owned_operation_unknown_child");
    }
  }
  fs.rmSync(realRoot, { recursive: true, force: false });
  requireConfirmedAbsent(
    realRoot,
    "owned_operation_directory_cleanup_incomplete",
  );
  if (isObject(owned)) {
    revokeOwnedOperationContextCapabilities(owned);
    ownedIdentities.delete(owned);
  }
  if (
    !revokeOwnedOperationGeneration(identity.root, identity.hostRecovery.nonce)
  )
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
}

export function createOwnedMountCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_mounts" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_mount_identity_required");
  }
  const children = validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_mounts" });
  mountCapabilities.set(capability, Object.freeze({ owned, children }));
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

export function verifyOwnedMountCapability(
  capability: unknown,
): OwnedMountPaths {
  const mount = isObject(capability)
    ? (mountCapabilities.get(capability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  const identity = ownedIdentities.get(mount.owned);
  if (!identity) throw new Error("owned_operation_mount_capability_required");
  const children = validateOwnedOperationIdentity(mount.owned, identity);
  if (children !== mount.children)
    throw new Error("owned_operation_mount_capability_required");
  return Object.freeze({
    workspace: validateDirectorySnapshot(children.workspace),
    providerHome: validateDirectorySnapshot(children.providerHome),
    tmp: validateDirectorySnapshot(children.tmp),
    events: validateDirectorySnapshot(children.events),
    projection: validateDirectorySnapshot(children.projection),
    management: validateDirectorySnapshot(children.management),
  });
}

export function createOwnedOperationContextCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_context" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_context_identity_required");
  }
  validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_context" });
  operationContextCapabilities.set(
    capability,
    Object.freeze({
      owned,
      operationId: identity.operationId,
      createdAt: identity.createdAt,
    }),
  );
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

export function verifyOwnedOperationContextCapability(
  capability: unknown,
): OwnedOperationContext {
  const capabilityObject = isObject(capability) ? capability : null;
  const context = capabilityObject
    ? (operationContextCapabilities.get(capabilityObject) ?? null)
    : null;
  if (!context) throw new Error("owned_operation_context_capability_required");
  const identity = ownedIdentities.get(context.owned);
  if (
    !identity?.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    if (capabilityObject) operationContextCapabilities.delete(capabilityObject);
    throw new Error("owned_operation_context_capability_revoked");
  }
  validateOwnedOperationIdentity(context.owned, identity);
  return Object.freeze({
    operationId: context.operationId,
    createdAt: context.createdAt,
  });
}

export function createOwnedOperationManagementCapability(
  operationContextCapability: unknown,
  mountCapability: unknown,
): Readonly<{ kind: "owned_operation_management_binding" }> {
  const context = isObject(operationContextCapability)
    ? (operationContextCapabilities.get(operationContextCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!context || !mount || context.owned !== mount.owned)
    throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(context.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(context.owned, identity);
  if (
    children !== mount.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateDirectorySnapshot(children.management);
  const capability = Object.freeze({
    kind: "owned_operation_management_binding" as const,
  });
  operationManagementCapabilities.set(
    capability,
    Object.freeze({
      owned: context.owned,
      operationId: context.operationId,
      createdAt: context.createdAt,
    }),
  );
  const aliases =
    operationContextAliases.get(context.owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(context.owned, aliases);
  return capability;
}

export function verifyOwnedOperationManagementCapability(
  capability: unknown,
): OwnedOperationManagementBinding {
  const binding = isObject(capability)
    ? (operationManagementCapabilities.get(capability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    operationId: binding.operationId,
    createdAt: binding.createdAt,
    managementScopeBound: true as const,
  });
}

export function verifyOwnedOperationManagementMountBinding(
  managementCapability: unknown,
  mountCapability: unknown,
): Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OwnedMountPaths;
}> {
  const management = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!management || !mount || management.owned !== mount.owned) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const identity = ownedIdentities.get(management.owned);
  if (
    !identity ||
    identity.operationId !== management.operationId ||
    identity.createdAt !== management.createdAt
  ) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const children = validateOwnedOperationIdentity(management.owned, identity);
  if (children !== mount.children) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  return Object.freeze({
    operationId: management.operationId,
    createdAt: management.createdAt,
    mounts: Object.freeze({
      workspace: validateDirectorySnapshot(children.workspace),
      providerHome: validateDirectorySnapshot(children.providerHome),
      tmp: validateDirectorySnapshot(children.tmp),
      events: validateDirectorySnapshot(children.events),
      projection: validateDirectorySnapshot(children.projection),
      management: validateDirectorySnapshot(children.management),
    }),
  });
}

export function borrowOwnedDockerExecutionPaths(
  managementCapability: unknown,
): Readonly<{ tmp: string; management: string }> {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const identity = ownedIdentities.get(binding.owned);
  if (!identity?.children)
    throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    tmp: validateDirectorySnapshot(children.tmp),
    management: validateDirectorySnapshot(children.management),
  });
}

function validateOwnedChildSet(root: string, children: ChildSnapshots): void {
  const known = new Set(
    Object.values(children).map((snapshot) => snapshot.name),
  );
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!known.has(entry.name))
      throw new Error("owned_operation_unknown_child");
  }
  for (const snapshot of Object.values(children)) {
    try {
      const metadata = fs.lstatSync(snapshot.root);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("owned_operation_child_replaced");
      validateDirectorySnapshot(snapshot);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      const message = errorMessage(error);
      if (
        message &&
        [
          "owned_operation_child_replaced",
          "owned_operation_mount_replaced",
        ].includes(message)
      )
        throw new Error("owned_operation_child_replaced");
      throw error;
    }
  }
}

function removeOwnedOperationRootForCleanup(owned: unknown) {
  const identity = ownedIdentity(owned);
  if (!identity) {
    throw new Error("owned_operation_directory_identity_required");
  }
  try {
    if (!isObject(owned)) throw new Error("owned_operation_directory_replaced");
    ownedOperationGeneration(owned, identity, true);
    if (
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent
    ) {
      throw new Error("owned_operation_directory_replaced");
    }
    const realRoot = fs.realpathSync(identity.root);
    const realParent = fs.realpathSync(identity.parent);
    const currentFilesystem = readFilesystemIdentity(identity.root);
    if (
      realRoot !== identity.root ||
      realParent !== identity.parent ||
      path.dirname(realRoot) !== realParent ||
      !path.basename(realRoot).startsWith(identity.prefix) ||
      !sameFilesystemIdentity(currentFilesystem, identity.filesystem)
    ) {
      throw new Error("owned_operation_directory_replaced");
    }
    if (identity.children)
      validateOwnedChildSet(identity.root, identity.children);
  } catch (error) {
    const message = errorMessage(error);
    if (
      isObject(owned) &&
      message &&
      [
        "owned_operation_directory_replaced",
        "owned_operation_child_replaced",
      ].includes(message)
    ) {
      retireOwnedOperationGeneration(
        identity.root,
        identity.hostRecovery.nonce,
      );
    }
    if (
      message &&
      [
        "owned_operation_directory_replaced",
        "owned_operation_child_replaced",
        "owned_operation_unknown_child",
      ].includes(message)
    )
      throw error;
    throw new Error("owned_operation_directory_replaced");
  }
  validatePrivateHostRecoveryRecord(identity, "host_only");
  fs.rmSync(identity.root, { recursive: true, force: false });
  requireConfirmedAbsent(
    identity.root,
    "owned_operation_directory_cleanup_incomplete",
  );
  return identity;
}

function removeOwnedOperationRecoveryRecord(identity: OwnedIdentity) {
  try {
    const recoveryDirectory = fs.realpathSync(identity.hostRecovery.directory);
    if (
      !sameFilesystemIdentity(
        readFilesystemIdentity(recoveryDirectory),
        identity.hostRecovery.directoryIdentity,
      )
    )
      throw new Error("host_recovery_directory_replaced");
    const marker = fs.lstatSync(identity.hostRecovery.record);
    if (
      !marker.isFile() ||
      marker.isSymbolicLink() ||
      !identity.hostRecovery.recordIdentity ||
      !sameFilesystemIdentity(
        readFileIdentity(identity.hostRecovery.record),
        identity.hostRecovery.recordIdentity,
      )
    )
      throw new Error("host_recovery_record_replaced");
    fs.rmSync(identity.hostRecovery.record);
    requireConfirmedAbsent(
      identity.hostRecovery.record,
      "host_recovery_record_observation_unknown",
    );
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

export function cleanupOwnedOperationDirectories(owned: unknown): void {
  const currentIdentity = ownedIdentity(owned);
  if (!isObject(owned) || !currentIdentity)
    throw new Error("owned_operation_directory_identity_required");
  if (
    ownedOperationGeneration(owned, currentIdentity, true).generationLock !==
    null
  )
    throw new Error("owned_operation_async_cleanup_required");
  const identity = removeOwnedOperationRootForCleanup(owned);
  if (
    !revokeOwnedOperationGeneration(identity.root, identity.hostRecovery.nonce)
  )
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
}

export async function cleanupOwnedOperationDirectoriesAsync(owned: unknown) {
  const identity = removeOwnedOperationRootForCleanup(owned);
  const release = await revokeOwnedOperationGenerationAsync(
    identity.root,
    identity.hostRecovery.nonce,
  );
  if (release === "cleanup_unknown")
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
  if (release === "cleanup_confirmed_failure")
    return createOwnedOperationCleanupOutcome(
      "protocol_failure_cleanup_confirmed",
    );
  return createOwnedOperationCleanupOutcome("completed");
}

type OwnedOperationCleanupStatus =
  | "completed"
  | "protocol_failure_cleanup_confirmed";
const ownedOperationCleanupOutcomes = new WeakMap<
  object,
  OwnedOperationCleanupStatus
>();

function createOwnedOperationCleanupOutcome(
  status: OwnedOperationCleanupStatus,
) {
  const outcome = Object.freeze({ kind: "owned_operation_cleanup_outcome" });
  ownedOperationCleanupOutcomes.set(outcome, status);
  return outcome;
}

export function verifyOwnedOperationCleanupOutcome(
  outcome: unknown,
): OwnedOperationCleanupStatus | null {
  return isObject(outcome)
    ? (ownedOperationCleanupOutcomes.get(outcome) ?? null)
    : null;
}

function loadHostRecoveryRecord(token: unknown): Readonly<{
  parsed: Readonly<{ rootName: string; nonce: string; recordHash: string }>;
  parent: string;
  recovery: Readonly<{ directory: string }>;
  marker: string;
  record: HostRecoveryRecord;
}> {
  const loaded = loadHostRecoveryRecordByToken(token);
  return {
    parsed: loaded.parsed,
    parent: loaded.parent,
    recovery: { directory: loaded.directory },
    marker: loaded.marker,
    record: normalizeHostRecoveryRecord(loaded.record),
  };
}

export function recoverOwnedOperationDirectories(
  token: unknown,
  suppliedRecoveryGenerationCapability: unknown = null,
): Readonly<{
  status: "recovered" | "blocked";
  reason: string;
  recoveryId: string | null;
}> {
  let recoveryGeneration: Readonly<{ root: string; nonce: string }> | null =
    null;
  let verifiedRecoveryId: string | null = null;
  let markerPendingAfterRelease: string | null = null;
  const ownedRecoveryGenerationCapability = suppliedRecoveryGenerationCapability
    ? null
    : acquireHostOperationRecoveryGeneration(token);
  const recoveryGenerationCapability =
    suppliedRecoveryGenerationCapability ?? ownedRecoveryGenerationCapability;
  const result = (() => {
    try {
      const { parsed, parent, marker, record } = loadHostRecoveryRecord(token);
      verifiedRecoveryId = typeof token === "string" ? token : null;
      if (record.state === "docker_submission_started")
        throw new Error("host_recovery_requires_docker_absence");
      if (
        !["initializing", "host_only", "docker_absent_confirmed"].includes(
          record.state,
        )
      )
        throw new Error("host_recovery_state_invalid");
      const root = path.join(parent, parsed.rootName);
      recoveryGeneration = Object.freeze({ root, nonce: parsed.nonce });
      verifyHostOperationRecoveryGeneration(
        recoveryGenerationCapability,
        root,
        parsed.nonce,
      );
      const activeGeneration = operationGenerationByRoot.get(root);
      if (
        activeGeneration &&
        (activeGeneration.nonce !== parsed.nonce ||
          activeGeneration.currentRecordHash !== parsed.recordHash)
      )
        throw new Error("host_recovery_generation_mismatch");
      let reason = "host_root_already_absent";
      const rootObservation = observeFilesystemEntry(root);
      if (rootObservation === "unknown")
        throw new Error("host_recovery_root_observation_unknown");
      if (record.state === "initializing" && rootObservation === "present")
        throw new Error("host_recovery_initialization_root_identity_unknown");
      if (rootObservation === "present") {
        if (
          fs.realpathSync(root) !== root ||
          path.dirname(root) !== parent ||
          !record.rootIdentity ||
          !identityMatchesRecord(root, record.rootIdentity)
        )
          throw new Error("host_recovery_root_replaced");
        const known = new Set(
          Object.values(record.childIdentities).map((child) => child.pathName),
        );
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!known.has(entry.name))
            throw new Error("host_recovery_unknown_child");
        }
        for (const child of Object.values(record.childIdentities)) {
          const target = path.join(root, child.pathName);
          try {
            const metadata = fs.lstatSync(target);
            if (
              !metadata.isDirectory() ||
              metadata.isSymbolicLink() ||
              fs.realpathSync(target) !== target ||
              path.dirname(target) !== root ||
              !identityMatchesRecord(target, child)
            )
              throw new Error("host_recovery_child_replaced");
          } catch (error) {
            if (errorCode(error) === "ENOENT") continue;
            throw error;
          }
        }
        const managementName = record.childIdentities.management?.pathName;
        if (managementName) {
          const activeDockerBinding = path.join(
            root,
            managementName,
            "active-docker-task-v1.json",
          );
          for (const candidate of [
            activeDockerBinding,
            `${activeDockerBinding}.crdd-commit.json`,
          ]) {
            const observation = observeFilesystemEntry(candidate);
            if (observation === "unknown")
              throw new Error("host_recovery_root_observation_unknown");
            if (observation === "present")
              throw new Error("host_recovery_requires_docker_absence");
          }
        }
        fs.rmSync(root, { recursive: true, force: false });
        requireConfirmedAbsent(root, "host_recovery_cleanup_incomplete");
        reason = "host_cleanup_recovered";
      }
      if (!revokeOwnedOperationGeneration(root, parsed.nonce))
        throw new Error("host_recovery_generation_release_unconfirmed");
      if (ownedRecoveryGenerationCapability) markerPendingAfterRelease = marker;
      else fs.rmSync(marker);
      return { status: "recovered" as const, reason, recoveryId: null };
    } catch (error) {
      const allowed = new Set([
        "host_recovery_token_invalid",
        "host_recovery_record_replaced",
        "host_recovery_record_mismatch",
        "host_recovery_requires_docker_absence",
        "host_recovery_state_invalid",
        "host_recovery_root_replaced",
        "host_recovery_child_replaced",
        "host_recovery_unknown_child",
        "host_recovery_cleanup_incomplete",
        "host_recovery_root_observation_unknown",
        "host_recovery_initialization_root_identity_unknown",
        "host_recovery_generation_mismatch",
        "host_recovery_generation_active",
        "host_recovery_generation_release_unconfirmed",
      ]);
      const message = errorMessage(error);
      if (
        recoveryGeneration &&
        message &&
        [
          "host_recovery_root_replaced",
          "host_recovery_child_replaced",
        ].includes(message)
      ) {
        const { root, nonce } = recoveryGeneration;
        retireOwnedOperationGeneration(root, nonce);
      }
      return {
        status: "blocked" as const,
        reason:
          message && allowed.has(message) ? message : "host_recovery_failed",
        recoveryId: verifiedRecoveryId,
      };
    }
  })();
  if (
    ownedRecoveryGenerationCapability &&
    !releaseHostOperationRecoveryGeneration(ownedRecoveryGenerationCapability)
  )
    return {
      status: "blocked",
      reason: "host_recovery_generation_release_unconfirmed",
      recoveryId: verifiedRecoveryId,
    };
  if (result.status === "recovered" && markerPendingAfterRelease) {
    try {
      const markerObservation = observeFilesystemEntry(
        markerPendingAfterRelease,
      );
      if (markerObservation === "unknown")
        throw new Error("host_recovery_record_observation_unknown");
      if (markerObservation === "present") {
        const loaded = loadHostRecoveryRecord(token);
        if (loaded.marker !== markerPendingAfterRelease)
          throw new Error("host_recovery_record_replaced");
        fs.rmSync(markerPendingAfterRelease);
        requireConfirmedAbsent(
          markerPendingAfterRelease,
          "host_recovery_record_observation_unknown",
        );
      }
    } catch {
      return {
        status: "blocked",
        reason: "host_recovery_record_replaced",
        recoveryId: verifiedRecoveryId,
      };
    }
  }
  return result;
}

export function createProviderEnvironment(
  baseEnvironment: unknown,
  directories: OperationDirectories,
): Record<string, string> {
  const environment: Record<string, string> = {};
  copyIfPresent(environment, baseEnvironment, "PATH");
  copyIfPresent(environment, baseEnvironment, "Path");
  for (const name of WINDOWS_RUNTIME_ENV)
    copyIfPresent(environment, baseEnvironment, name);
  for (const name of POSIX_RUNTIME_ENV)
    copyIfPresent(environment, baseEnvironment, name);
  environment.HOME = directories.providerHome;
  environment.USERPROFILE = directories.providerHome;
  environment.TEMP = directories.tmp;
  environment.TMP = directories.tmp;
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

export function describeFilesystemPolicy(directories: OperationDirectories) {
  return {
    coordinatorRuntime: {
      write: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    repositoryAdapter: { write: [directories.workspace] },
    providerProcess: {
      write: [directories.workspace, directories.providerHome, directories.tmp],
      deny: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    credentialBroker: {
      credentialStoreAccess: "read-minimum",
      exposeCredentialStorePathToProvider: false,
    },
  };
}

export function credentialEnvironmentNamesPresent(
  environment: unknown,
): readonly string[] {
  return CREDENTIAL_ENV_NAMES.filter((name) => {
    const value = ownString(environment, name);
    return value !== null && value.length > 0;
  });
}
