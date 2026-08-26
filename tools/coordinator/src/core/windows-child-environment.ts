import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT =
  "crdd-coordinator/windows-child-environment";
export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION = 2;

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

function fixedWindowsEnvironment(additions: Readonly<Record<string, string>>) {
  if (process.platform !== "win32") return null;
  const windowsDirectory = observedWindowsDirectoryFromLoadedSystemModule();
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

function observedWindowsDirectoryFromLoadedSystemModule() {
  try {
    const report = process.report.getReport() as Readonly<{
      sharedObjects?: unknown;
    }>;
    const sharedObjects = report.sharedObjects;
    if (!Array.isArray(sharedObjects)) return null;
    const candidates = sharedObjects.filter(
      (candidate): candidate is string =>
        typeof candidate === "string" &&
        path.win32.basename(candidate).toLocaleLowerCase("en-US") ===
          "kernel32.dll" &&
        path.win32
          .basename(path.win32.dirname(candidate))
          .toLocaleLowerCase("en-US") === "system32",
    );
    if (candidates.length !== 1) return null;
    const candidate = candidates[0];
    if (!candidate) return null;
    const kernel32 = path.win32.normalize(candidate);
    const system32 = path.win32.dirname(kernel32);
    const windowsDirectory = path.win32.dirname(system32);
    const rootMetadata = fs.lstatSync(windowsDirectory);
    const system32Metadata = fs.lstatSync(system32);
    const kernelMetadata = fs.lstatSync(kernel32);
    if (
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      !system32Metadata.isDirectory() ||
      system32Metadata.isSymbolicLink() ||
      !kernelMetadata.isFile() ||
      kernelMetadata.isSymbolicLink() ||
      fs.realpathSync.native(windowsDirectory).toLocaleLowerCase("en-US") !==
        windowsDirectory.toLocaleLowerCase("en-US") ||
      fs.realpathSync.native(kernel32).toLocaleLowerCase("en-US") !==
        kernel32.toLocaleLowerCase("en-US")
    ) {
      return null;
    }
    return windowsDirectory;
  } catch {
    return null;
  }
}

function observedWindowsUserProfileFromOs() {
  try {
    const candidate = path.win32.normalize(os.userInfo().homedir);
    if (
      !path.win32.isAbsolute(candidate) ||
      candidate.includes("\0") ||
      path.win32.parse(candidate).root === candidate
    ) {
      return null;
    }
    const metadata = fs.lstatSync(candidate);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(candidate).toLocaleLowerCase("en-US") !==
        candidate.toLocaleLowerCase("en-US")
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function createInteractiveConsoleReaderEnvironment(
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "win32") return fixedWindowsEnvironment(Object.freeze({}));
  return Object.freeze({});
}

export function createWindowsNodeConsoleReaderEnvironment() {
  return createInteractiveConsoleReaderEnvironment("win32");
}

export function createWindowsNativeHelperEnvironment() {
  if (process.platform !== "win32") return null;
  const userProfile = observedWindowsUserProfileFromOs();
  if (!userProfile) return null;
  return fixedWindowsEnvironment(Object.freeze({ USERPROFILE: userProfile }));
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
    provenance:
      "loaded_kernel32_and_os_user_profile_observation_plus_fixed_neutral_values_no_parent_environment_authority",
    ambientNames: "fixed_neutral_values",
    callerEnvironmentAccepted: false,
    actualChildObservationRequired: true,
  });
}
