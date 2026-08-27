import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT =
  "crdd-coordinator/windows-child-environment";
export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION = 5;
export const WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE =
  "loaded_kernel32_os_observed_windows_directory_and_os_user_info_validated_profile_path_with_other_ambient_names_fixed_neutral_parent_environment_not_authority";

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

export function createWindowsHostOperationSupervisorEnvironment() {
  return createInteractiveConsoleReaderEnvironment("win32");
}

export function createWindowsNativeHelperEnvironment() {
  if (process.platform !== "win32") return null;
  const userProfile = observedWindowsUserProfileFromOs();
  if (!userProfile) return null;
  return fixedWindowsEnvironment(Object.freeze({ USERPROFILE: userProfile }));
}

export function createWindowsDockerDesktopRepairHelperEnvironment() {
  return createWindowsNativeHelperEnvironment();
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
    provenance: WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
    ambientNames: "fixed_neutral_values",
    callerEnvironmentAccepted: false,
    parentEnvironmentAuthority: false,
    nativeHelperUserProfile: "os_user_info_validated_profile_path",
    nativeHelperConsumers: Object.freeze([
      "provider_home_observation",
      "candidate_store_observation",
      "candidate_store_initialization",
      "runtime_state_observation",
      "runtime_state_initialization",
      "docker_desktop_runtime_repair_native_helper",
    ]),
    nodeChildConsumers: Object.freeze([
      "interactive_console_reader",
      "host_operation_lock_supervisor",
    ]),
    dockerCliConsumers: Object.freeze([
      "docker_effect_runtime",
      "docker_recovery_runtime",
      "docker_desktop_runtime_repair",
    ]),
    dockerDesktopLauncherConsumers: Object.freeze([]),
    dockerDesktopLauncherEnvironment:
      "native_helper_known_folder_and_loaded_os_directory_minimal_unicode_block",
    userProfileEnvironmentAuthority: false,
    userProfileInitializationAuthority: false,
    actualChildObservationRequired: true,
  });
}
