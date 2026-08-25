import fs from "node:fs";
import path from "node:path";

export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT =
  "crdd-coordinator/windows-child-environment";
export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION = 1;

// Windows may populate these names even when Node receives an empty env map.
// Keep the names present with fixed neutral values so the child cannot observe
// ambient user, path, proxy, credential-helper, or Node injection state.
const NEUTRAL_NAMES = Object.freeze([
  "ALL_PROXY",
  "APPDATA",
  "COMSPEC",
  "GIT_ASKPASS",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LOCALAPPDATA",
  "LOGONSERVER",
  "NODE_EXTRA_CA_CERTS",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NO_PROXY",
  "PATH",
  "PATHEXT",
  "SSH_AGENT_PID",
  "SSH_AUTH_SOCK",
  "SYSTEMDRIVE",
  "TEMP",
  "TMP",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
] as const);

function observedWindowsDirectory() {
  if (process.platform !== "win32") return null;
  const systemRoot = process.env.SystemRoot;
  const windir = process.env.WINDIR;
  if (
    typeof systemRoot !== "string" ||
    typeof windir !== "string" ||
    systemRoot.length === 0 ||
    systemRoot.includes("\0") ||
    windir.includes("\0") ||
    !path.win32.isAbsolute(systemRoot) ||
    systemRoot.toLocaleLowerCase("en-US") !== windir.toLocaleLowerCase("en-US")
  ) {
    return null;
  }
  try {
    const resolved = path.win32.normalize(systemRoot);
    const metadata = fs.lstatSync(resolved);
    const system32 = fs.lstatSync(path.join(resolved, "System32"));
    const kernel32 = fs.lstatSync(
      path.join(resolved, "System32", "kernel32.dll"),
    );
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      !system32.isDirectory() ||
      system32.isSymbolicLink() ||
      !kernel32.isFile() ||
      kernel32.isSymbolicLink() ||
      fs.realpathSync.native(resolved).toLocaleLowerCase("en-US") !==
        resolved.toLocaleLowerCase("en-US")
    ) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

function fixedWindowsEnvironment(additions: Readonly<Record<string, string>>) {
  const windowsDirectory = observedWindowsDirectory();
  if (!windowsDirectory) return null;
  const environment: Record<string, string> = Object.create(null);
  for (const name of NEUTRAL_NAMES) environment[name] = "";
  environment.SystemRoot = windowsDirectory;
  environment.WINDIR = windowsDirectory;
  for (const [name, value] of Object.entries(additions)) {
    const matchingName = Object.keys(environment).find(
      (existing) =>
        existing.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"),
    );
    if (
      name.length === 0 ||
      name.includes("=") ||
      name.includes("\0") ||
      value.includes("\0") ||
      (matchingName !== undefined && environment[matchingName] !== "")
    ) {
      return null;
    }
    if (matchingName && matchingName !== name) delete environment[matchingName];
    environment[name] = value;
  }
  return Object.freeze(environment);
}

export function createWindowsNodeConsoleReaderEnvironment() {
  return fixedWindowsEnvironment(Object.freeze({}));
}

export function createWindowsNativeHelperEnvironment() {
  return fixedWindowsEnvironment(Object.freeze({}));
}

export function createWindowsDockerCliEnvironment(
  options: Readonly<{
    dockerConfig: string | null;
    dockerHome: string | null;
  }>,
) {
  const { dockerConfig, dockerHome } = options;
  if (
    (dockerConfig === null) !== (dockerHome === null) ||
    (dockerConfig !== null && !path.win32.isAbsolute(dockerConfig)) ||
    (dockerHome !== null && !path.win32.isAbsolute(dockerHome))
  ) {
    return null;
  }
  return fixedWindowsEnvironment(
    dockerConfig === null || dockerHome === null
      ? Object.freeze({ DOCKER_CLI_HINTS: "false" })
      : Object.freeze({
          DOCKER_CLI_HINTS: "false",
          DOCKER_CONFIG: dockerConfig,
          HOME: dockerHome,
          USERPROFILE: dockerHome,
        }),
  );
}

export function describeWindowsChildEnvironmentContract() {
  return Object.freeze({
    contract: WINDOWS_CHILD_ENVIRONMENT_CONTRACT,
    contractRevision: WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION,
    provenance: "validated_windows_directory_plus_fixed_runtime_values_only",
    ambientNames: "fixed_neutral_values",
    callerEnvironmentAccepted: false,
    actualChildObservationRequired: true,
  });
}
