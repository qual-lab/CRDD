import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GIT_ASKPASS",
  "OPENAI_API_KEY",
  "SSH_AUTH_SOCK"
]);

const WINDOWS_RUNTIME_ENV = Object.freeze(["COMSPEC", "PATHEXT", "SYSTEMDRIVE", "SYSTEMROOT", "WINDIR"]);
const POSIX_RUNTIME_ENV = Object.freeze(["LANG", "LC_ALL", "LC_CTYPE", "SHELL"]);
const OWNED_PREFIX = "crdd-coordinator-doctor-";
const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";
const OWNED_IDENTITIES = new WeakMap();
const MOUNT_CAPABILITIES = new WeakMap();

function readFilesystemIdentity(root) {
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
    birthtimeNs: metadata.birthtimeNs
  });
}

function sameFilesystemIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.birthtimeNs === right.birthtimeNs;
}

function directorySnapshot(directory, parent, name) {
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
    filesystem: readFilesystemIdentity(realDirectory)
  });
}

function validateDirectorySnapshot(snapshot) {
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

function copyIfPresent(target, source, name) {
  if (typeof source[name] === "string") target[name] = source[name];
}

function serializableIdentity(target) {
  const identity = readFilesystemIdentity(target);
  return { dev: identity.dev.toString(), ino: identity.ino.toString(), birthtimeNs: identity.birthtimeNs.toString() };
}

function identityMatchesRecord(target, record) {
  try {
    const identity = readFilesystemIdentity(target);
    return identity.dev === BigInt(record.dev) && identity.ino === BigInt(record.ino) && identity.birthtimeNs === BigInt(record.birthtimeNs);
  } catch { return false; }
}

function ensureHostRecoveryDirectory(parent) {
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const real = fs.realpathSync(directory);
  const metadata = fs.lstatSync(real);
  if (real !== directory || path.dirname(real) !== parent || !metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("host_recovery_directory_untrusted");
  }
  return { directory: real, identity: readFilesystemIdentity(real) };
}

function hostRecordContent(identity, state) {
  return {
    schema: "crdd-coordinator-host-recovery/v1",
    state,
    rootName: path.basename(identity.root),
    rootIdentity: serializableIdentity(identity.root),
    childIdentities: Object.fromEntries(Object.entries(identity.mounts).map(([name, snapshot]) => [name, {
      pathName: snapshot.name,
      ...serializableIdentity(snapshot.root)
    }])),
    createdAt: identity.createdAt
  };
}

function writeHostRecoveryRecord(owned, identity, state) {
  const record = hostRecordContent(identity, state);
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const target = identity.hostRecovery.record;
  const temporary = `${target}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, target);
  const updated = Object.freeze({ ...identity, hostRecovery: Object.freeze({ ...identity.hostRecovery, state, recordHash }) });
  OWNED_IDENTITIES.set(owned, updated);
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${recordHash}`;
}

export function createOperationDirectories(rootDirectory) {
  const directories = {
    root: rootDirectory,
    providerHome: path.join(rootDirectory, "provider-home"),
    workspace: path.join(rootDirectory, "workspace"),
    tmp: path.join(rootDirectory, "tmp"),
    events: path.join(rootDirectory, "events"),
    projection: path.join(rootDirectory, "projection"),
    management: path.join(rootDirectory, "management")
  };
  for (const directory of Object.values(directories)) fs.mkdirSync(directory, { recursive: true });
  return directories;
}

export function createOwnedOperationDirectories(temporaryParent = os.tmpdir()) {
  const parent = fs.realpathSync(temporaryParent);
  const parentMetadata = fs.lstatSync(parent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
    throw new Error("temporary_parent_must_be_real_directory");
  }
  const root = fs.mkdtempSync(path.join(parent, OWNED_PREFIX));
  const realRoot = fs.realpathSync(root);
  if (path.dirname(realRoot) !== parent || !path.basename(realRoot).startsWith(OWNED_PREFIX)) {
    throw new Error("owned_operation_directory_boundary_failed");
  }
  const recovery = ensureHostRecoveryDirectory(parent);
  const nonce = randomUUID();
  const owned = { parent, root: realRoot, directories: null, hostRecoveryId: null };
  OWNED_IDENTITIES.set(owned, Object.freeze({
    parent,
    root: realRoot,
    prefix: OWNED_PREFIX,
    filesystem: readFilesystemIdentity(realRoot),
    createdAt: new Date().toISOString(),
    hostRecovery: Object.freeze({
      directory: recovery.directory,
      directoryIdentity: recovery.identity,
      record: path.join(recovery.directory, `host-${createHash("sha256").update(nonce).digest("hex")}.json`),
      nonce,
      state: "initializing",
      recordHash: null
    })
  }));
  try {
    owned.directories = createOperationDirectories(realRoot);
    const identity = OWNED_IDENTITIES.get(owned);
    OWNED_IDENTITIES.set(owned, Object.freeze({
      ...identity,
      mounts: Object.freeze({
        workspace: directorySnapshot(owned.directories.workspace, realRoot, "workspace"),
        providerHome: directorySnapshot(owned.directories.providerHome, realRoot, "provider-home"),
        tmp: directorySnapshot(owned.directories.tmp, realRoot, "tmp"),
        management: directorySnapshot(owned.directories.management, realRoot, "management")
      })
    }));
    owned.hostRecoveryId = writeHostRecoveryRecord(owned, OWNED_IDENTITIES.get(owned), "host_only");
    return owned;
  } catch (error) {
    try {
      cleanupOwnedOperationDirectories(owned);
    } catch {
      throw new Error("owned_operation_directory_initialization_cleanup_blocked", { cause: error });
    }
    throw error;
  }
}

export function setOwnedDockerRecoveryState(owned, state) {
  if (!["docker_submission_started", "docker_absent_confirmed"].includes(state)) throw new Error("host_recovery_state_invalid");
  const identity = OWNED_IDENTITIES.get(owned);
  if (!identity) throw new Error("owned_operation_directory_identity_required");
  owned.hostRecoveryId = writeHostRecoveryRecord(owned, identity, state);
  return owned.hostRecoveryId;
}

export function getOwnedHostRecoveryId(owned) {
  const identity = owned && typeof owned === "object" ? OWNED_IDENTITIES.get(owned) : null;
  if (!identity?.hostRecovery?.recordHash) throw new Error("owned_operation_directory_identity_required");
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${identity.hostRecovery.recordHash}`;
}

export function createOwnedMountCapability(owned) {
  const identity = owned && typeof owned === "object" ? OWNED_IDENTITIES.get(owned) : null;
  if (!identity?.mounts || owned.root !== identity.root || owned.parent !== identity.parent) {
    throw new Error("owned_operation_mount_identity_required");
  }
  for (const snapshot of Object.values(identity.mounts)) validateDirectorySnapshot(snapshot);
  const capability = Object.freeze({ kind: "owned_operation_mounts" });
  MOUNT_CAPABILITIES.set(capability, identity.mounts);
  return capability;
}

export function verifyOwnedMountCapability(capability) {
  const mounts = capability && typeof capability === "object" ? MOUNT_CAPABILITIES.get(capability) : null;
  if (!mounts) throw new Error("owned_operation_mount_capability_required");
  return Object.freeze({
    workspace: validateDirectorySnapshot(mounts.workspace),
    providerHome: validateDirectorySnapshot(mounts.providerHome),
    tmp: validateDirectorySnapshot(mounts.tmp),
    management: validateDirectorySnapshot(mounts.management)
  });
}

export function cleanupOwnedOperationDirectories(owned) {
  const identity = owned && typeof owned === "object" ? OWNED_IDENTITIES.get(owned) : null;
  if (!identity) {
    throw new Error("owned_operation_directory_identity_required");
  }
  try {
    if (owned.root !== identity.root || owned.parent !== identity.parent) {
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
    if (identity.mounts) {
      for (const snapshot of Object.values(identity.mounts)) validateDirectorySnapshot(snapshot);
    }
  } catch (error) {
    if (error?.message === "owned_operation_directory_replaced") throw error;
    throw new Error("owned_operation_directory_replaced");
  }
  if (identity.hostRecovery.state === "docker_submission_started") {
    throw new Error("host_cleanup_requires_container_absence");
  }
  fs.rmSync(identity.root, { recursive: true, force: false });
  if (fs.existsSync(identity.root)) throw new Error("owned_operation_directory_cleanup_incomplete");
  OWNED_IDENTITIES.delete(owned);
  try {
    const recoveryDirectory = fs.realpathSync(identity.hostRecovery.directory);
    if (!sameFilesystemIdentity(readFilesystemIdentity(recoveryDirectory), identity.hostRecovery.directoryIdentity)) throw new Error("host_recovery_directory_replaced");
    const marker = fs.lstatSync(identity.hostRecovery.record);
    if (!marker.isFile() || marker.isSymbolicLink()) throw new Error("host_recovery_record_replaced");
    fs.rmSync(identity.hostRecovery.record);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function parseHostRecoveryToken(token) {
  const match = /^host\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(token ?? "");
  if (!match) throw new Error("host_recovery_token_invalid");
  return { rootName: match[1], nonce: match[2], recordHash: match[3] };
}

function loadHostRecoveryRecord(token) {
  const parsed = parseHostRecoveryToken(token);
  const parent = fs.realpathSync(os.tmpdir());
  const recovery = ensureHostRecoveryDirectory(parent);
  const marker = path.join(recovery.directory, `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`);
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink()) throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash) throw new Error("host_recovery_record_mismatch");
  const record = JSON.parse(serialized);
  if (record.schema !== "crdd-coordinator-host-recovery/v1" || record.rootName !== parsed.rootName) throw new Error("host_recovery_record_mismatch");
  return { parsed, parent, recovery, marker, record };
}

export function confirmHostRecoveryDockerAbsence(token) {
  try {
    const loaded = loadHostRecoveryRecord(token);
    if (loaded.record.state !== "docker_submission_started") throw new Error("host_recovery_state_invalid");
    const updated = { ...loaded.record, state: "docker_absent_confirmed" };
    const serialized = `${JSON.stringify(updated)}\n`;
    const recordHash = createHash("sha256").update(serialized).digest("hex");
    const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, loaded.marker);
    return { status: "confirmed", recoveryId: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${recordHash}` };
  } catch (error) {
    const allowed = new Set(["host_recovery_token_invalid", "host_recovery_record_replaced", "host_recovery_record_mismatch", "host_recovery_state_invalid"]);
    return { status: "blocked", reason: allowed.has(error?.message) ? error.message : "host_recovery_failed" };
  }
}

export function recoverOwnedOperationDirectories(token) {
  try {
    const { parsed, parent, marker, record } = loadHostRecoveryRecord(token);
    if (record.state === "docker_submission_started") throw new Error("host_recovery_requires_docker_absence");
    if (!["host_only", "docker_absent_confirmed"].includes(record.state)) throw new Error("host_recovery_state_invalid");
    const root = path.join(parent, parsed.rootName);
    if (!fs.existsSync(root)) {
      fs.rmSync(marker);
      return { status: "recovered", reason: "host_root_already_absent" };
    }
    if (fs.realpathSync(root) !== root || path.dirname(root) !== parent || !identityMatchesRecord(root, record.rootIdentity)) throw new Error("host_recovery_root_replaced");
    for (const child of Object.values(record.childIdentities)) {
      const target = path.join(root, child.pathName);
      if (!fs.existsSync(target)) continue;
      if (fs.realpathSync(target) !== target || path.dirname(target) !== root || !identityMatchesRecord(target, child)) throw new Error("host_recovery_child_replaced");
    }
    fs.rmSync(root, { recursive: true, force: false });
    if (fs.existsSync(root)) throw new Error("host_recovery_cleanup_incomplete");
    fs.rmSync(marker);
    return { status: "recovered", reason: "host_cleanup_recovered" };
  } catch (error) {
    const allowed = new Set(["host_recovery_token_invalid", "host_recovery_record_replaced", "host_recovery_record_mismatch", "host_recovery_requires_docker_absence", "host_recovery_state_invalid", "host_recovery_root_replaced", "host_recovery_child_replaced", "host_recovery_cleanup_incomplete"]);
    return { status: "blocked", reason: allowed.has(error?.message) ? error.message : "host_recovery_failed" };
  }
}

export function createProviderEnvironment(baseEnvironment, directories) {
  const environment = {};
  copyIfPresent(environment, baseEnvironment, "PATH");
  copyIfPresent(environment, baseEnvironment, "Path");
  for (const name of WINDOWS_RUNTIME_ENV) copyIfPresent(environment, baseEnvironment, name);
  for (const name of POSIX_RUNTIME_ENV) copyIfPresent(environment, baseEnvironment, name);
  environment.HOME = directories.providerHome;
  environment.USERPROFILE = directories.providerHome;
  environment.TEMP = directories.tmp;
  environment.TMP = directories.tmp;
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

export function describeFilesystemPolicy(directories) {
  return {
    coordinatorRuntime: { write: [directories.events, directories.projection, directories.management] },
    repositoryAdapter: { write: [directories.workspace] },
    providerProcess: {
      write: [directories.workspace, directories.providerHome, directories.tmp],
      deny: [directories.events, directories.projection, directories.management]
    },
    credentialBroker: {
      credentialStoreAccess: "read-minimum",
      exposeCredentialStorePathToProvider: false
    }
  };
}

export function credentialEnvironmentNamesPresent(environment) {
  return CREDENTIAL_ENV_NAMES.filter((name) => typeof environment[name] === "string" && environment[name].length > 0);
}
