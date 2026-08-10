import fs from "node:fs";
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
const OWNED_IDENTITIES = new WeakMap();

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

function copyIfPresent(target, source, name) {
  if (typeof source[name] === "string") target[name] = source[name];
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
  const owned = { parent, root: realRoot, directories: null };
  OWNED_IDENTITIES.set(owned, Object.freeze({
    parent,
    root: realRoot,
    prefix: OWNED_PREFIX,
    filesystem: readFilesystemIdentity(realRoot)
  }));
  try {
    owned.directories = createOperationDirectories(realRoot);
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
  } catch (error) {
    OWNED_IDENTITIES.delete(owned);
    if (error?.message === "owned_operation_directory_replaced") throw error;
    throw new Error("owned_operation_directory_replaced");
  }
  OWNED_IDENTITIES.delete(owned);
  fs.rmSync(identity.root, { recursive: true, force: true });
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
