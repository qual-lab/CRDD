import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { loadHostRecoveryRecordByToken } from "./host-recovery-record.ts";

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
  nonce: string;
  state: RecoveryState;
  recordHash: string | null;
}>;
type OwnedIdentity = Readonly<{
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
  rootIdentity: SerializableIdentity;
  childIdentities: Readonly<Record<string, HostRecordChild>>;
  createdAt: string;
}>;

const OWNED_IDENTITIES = new WeakMap<object, OwnedIdentity>();
const MOUNT_CAPABILITIES = new WeakMap<object, ChildSnapshots>();

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
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
  return Object.freeze({
    schema,
    state: normalizeRecoveryState(ownValue(value, "state")),
    rootName,
    rootIdentity: normalizeSerializableIdentity(
      ownValue(value, "rootIdentity"),
    ),
    childIdentities: Object.freeze(childIdentities),
    createdAt,
  });
}

function ownedIdentity(value: unknown): OwnedIdentity | null {
  return isObject(value) ? (OWNED_IDENTITIES.get(value) ?? null) : null;
}

function requireOwnedIdentity(value: object): OwnedIdentity {
  const identity = OWNED_IDENTITIES.get(value);
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
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const real = fs.realpathSync(directory);
  const metadata = fs.lstatSync(real);
  if (
    real !== directory ||
    path.dirname(real) !== parent ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink()
  ) {
    throw new Error("host_recovery_directory_untrusted");
  }
  return { directory: real, identity: readFilesystemIdentity(real) };
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

function writeHostRecoveryRecord(
  owned: object,
  identity: OwnedIdentity,
  state: RecoveryState,
): string {
  const record = hostRecordContent(identity, state);
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const target = identity.hostRecovery.record;
  const temporary = `${target}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, target);
  const updated = Object.freeze({
    ...identity,
    hostRecovery: Object.freeze({
      ...identity.hostRecovery,
      state,
      recordHash,
    }),
  });
  OWNED_IDENTITIES.set(owned, updated);
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
  const parent = fs.realpathSync(temporaryParent);
  const parentMetadata = fs.lstatSync(parent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
    throw new Error("temporary_parent_must_be_real_directory");
  }
  const root = fs.mkdtempSync(path.join(parent, OWNED_PREFIX));
  const realRoot = fs.realpathSync(root);
  if (
    path.dirname(realRoot) !== parent ||
    !path.basename(realRoot).startsWith(OWNED_PREFIX)
  ) {
    throw new Error("owned_operation_directory_boundary_failed");
  }
  const recovery = ensureHostRecoveryDirectory(parent);
  const nonce = randomUUID();
  const owned: OwnedOperationDirectories = {
    parent,
    root: realRoot,
    directories: null,
    hostRecoveryId: null,
  };
  OWNED_IDENTITIES.set(
    owned,
    Object.freeze({
      parent,
      root: realRoot,
      prefix: OWNED_PREFIX,
      filesystem: readFilesystemIdentity(realRoot),
      createdAt: new Date().toISOString(),
      hostRecovery: Object.freeze({
        directory: recovery.directory,
        directoryIdentity: recovery.identity,
        record: path.join(
          recovery.directory,
          `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
        ),
        nonce,
        state: "initializing",
        recordHash: null,
      }),
    }),
  );
  try {
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
    OWNED_IDENTITIES.set(
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
    return owned;
  } catch (error) {
    try {
      rollbackInitializingOperationDirectories(owned);
    } catch {
      throw new Error(
        "owned_operation_directory_initialization_cleanup_blocked",
        { cause: error },
      );
    }
    throw error;
  }
}

export function getOwnedHostRecoveryId(owned: unknown): string {
  const identity = ownedIdentity(owned);
  if (!identity?.hostRecovery?.recordHash)
    throw new Error("owned_operation_directory_identity_required");
  validatePrivateHostRecoveryRecord(identity, "host_only");
  return expectedHostRecoveryToken(identity);
}

function readCurrentOwnedHostRecord(
  identity: OwnedIdentity,
): Readonly<{ record: HostRecoveryRecord; serialized: string }> {
  const metadata = fs.lstatSync(identity.hostRecovery.record);
  if (!metadata.isFile() || metadata.isSymbolicLink())
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
  if (!identityMatchesRecord(identity.root, record.rootIdentity))
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
  if (!identity || identity.hostRecovery.state !== "initializing") {
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
  if (fs.existsSync(realRoot))
    throw new Error("owned_operation_directory_cleanup_incomplete");
  if (isObject(owned)) OWNED_IDENTITIES.delete(owned);
}

export function createOwnedMountCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_mounts" }> {
  const identity = ownedIdentity(owned);
  if (
    !identity?.children ||
    ownString(owned, "root") !== identity.root ||
    ownString(owned, "parent") !== identity.parent
  ) {
    throw new Error("owned_operation_mount_identity_required");
  }
  for (const snapshot of Object.values(identity.children))
    validateDirectorySnapshot(snapshot);
  const capability = Object.freeze({ kind: "owned_operation_mounts" });
  MOUNT_CAPABILITIES.set(capability, identity.children);
  return capability;
}

export function verifyOwnedMountCapability(
  capability: unknown,
): OwnedMountPaths {
  const children = isObject(capability)
    ? (MOUNT_CAPABILITIES.get(capability) ?? null)
    : null;
  if (!children) throw new Error("owned_operation_mount_capability_required");
  return Object.freeze({
    workspace: validateDirectorySnapshot(children.workspace),
    providerHome: validateDirectorySnapshot(children.providerHome),
    tmp: validateDirectorySnapshot(children.tmp),
    events: validateDirectorySnapshot(children.events),
    projection: validateDirectorySnapshot(children.projection),
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

export function cleanupOwnedOperationDirectories(owned: unknown): void {
  const identity = ownedIdentity(owned);
  if (!identity) {
    throw new Error("owned_operation_directory_identity_required");
  }
  try {
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
  if (fs.existsSync(identity.root))
    throw new Error("owned_operation_directory_cleanup_incomplete");
  if (isObject(owned)) OWNED_IDENTITIES.delete(owned);
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
    if (!marker.isFile() || marker.isSymbolicLink())
      throw new Error("host_recovery_record_replaced");
    fs.rmSync(identity.hostRecovery.record);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
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
): Readonly<{ status: "recovered" | "blocked"; reason: string }> {
  try {
    const { parsed, parent, marker, record } = loadHostRecoveryRecord(token);
    if (record.state === "docker_submission_started")
      throw new Error("host_recovery_requires_docker_absence");
    if (!["host_only", "docker_absent_confirmed"].includes(record.state))
      throw new Error("host_recovery_state_invalid");
    const root = path.join(parent, parsed.rootName);
    if (!fs.existsSync(root)) {
      fs.rmSync(marker);
      return { status: "recovered", reason: "host_root_already_absent" };
    }
    if (
      fs.realpathSync(root) !== root ||
      path.dirname(root) !== parent ||
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
    fs.rmSync(root, { recursive: true, force: false });
    if (fs.existsSync(root))
      throw new Error("host_recovery_cleanup_incomplete");
    fs.rmSync(marker);
    return { status: "recovered", reason: "host_cleanup_recovered" };
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
    ]);
    const message = errorMessage(error);
    return {
      status: "blocked",
      reason:
        message && allowed.has(message) ? message : "host_recovery_failed",
    };
  }
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
