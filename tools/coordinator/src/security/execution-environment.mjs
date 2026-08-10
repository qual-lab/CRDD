import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CODEX_API_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GIT_ASKPASS",
  "OPENAI_API_KEY",
  "SSH_AUTH_SOCK"
]);

const WINDOWS_RUNTIME_ENV = Object.freeze(["COMSPEC", "PATHEXT", "SYSTEMDRIVE", "SYSTEMROOT", "WINDIR"]);
const POSIX_RUNTIME_ENV = Object.freeze(["LANG", "LC_ALL", "LC_CTYPE", "SHELL"]);
const OWNED_PREFIX = "crdd-coordinator-doctor-";

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
  try {
    return {
      parent,
      root: realRoot,
      directories: createOperationDirectories(realRoot)
    };
  } catch (error) {
    fs.rmSync(realRoot, { recursive: true, force: true });
    throw error;
  }
}

export function cleanupOwnedOperationDirectories(owned) {
  if (!owned || typeof owned.root !== "string" || typeof owned.parent !== "string") {
    throw new Error("owned_operation_directory_identity_required");
  }
  if (!fs.existsSync(owned.root)) return;
  const metadata = fs.lstatSync(owned.root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("owned_operation_directory_replaced");
  }
  const realRoot = fs.realpathSync(owned.root);
  const realParent = fs.realpathSync(owned.parent);
  if (
    realRoot !== owned.root ||
    path.dirname(realRoot) !== realParent ||
    !path.basename(realRoot).startsWith(OWNED_PREFIX)
  ) {
    throw new Error("owned_operation_directory_boundary_failed");
  }
  fs.rmSync(realRoot, { recursive: true, force: true });
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
