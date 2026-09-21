/**
 * windows-child-environmentに属する責務をまとめる。
 *
 * @responsibility fixedWindowsEnvironmentを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { observeSystemWindowsDirectory } from "../security/windows-directory-bootstrap.ts";

export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT =
  "crdd-coordinator/windows-child-environment";
export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION = 10;
export const WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE =
  "native_system_windows_directory_and_os_user_info_validated_profile_path_with_other_ambient_names_fixed_neutral_parent_environment_not_authority";

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
  "NODE_V8_COVERAGE",
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

/**
 * fixed Windows Environmentを決定する。
 *
 * @responsibility fixed Windows Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input additions: Readonly<Record<string, string>>
 * @returns fixedWindowsEnvironmentの計算結果を返す。
 * @precondition 「additions: Readonly<Record<string, string>>」がfixedWindowsEnvironmentの入力契約を満たす。
 * @postcondition fixedWindowsEnvironmentの責務を完了した結果だけを返す。
 * @effect fixedWindowsEnvironmentは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: fixedWindowsEnvironmentは独自の失敗分岐を所有しない。
 * @invariant fixedWindowsEnvironmentは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: fixedWindowsEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: fixedWindowsEnvironmentは共有非同期状態を持たない同期処理である。
 */
function fixedWindowsEnvironment(additions: Readonly<Record<string, string>>) {
  if (process.platform !== "win32") return null;
  const windowsDirectory = observedWindowsDirectoryFromNative();
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

/**
 * observed Windows Directory From Nativeを決定する。
 *
 * @responsibility observed Windows Directory From Nativeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns observedWindowsDirectoryFromNativeの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobservedWindowsDirectoryFromNativeの入力契約を満たす。
 * @postcondition observedWindowsDirectoryFromNativeの責務を完了した結果だけを返す。
 * @effect observedWindowsDirectoryFromNativeはFilesystemの読取りまたは書込みを実行する。
 * @failure observedWindowsDirectoryFromNativeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observedWindowsDirectoryFromNativeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observedWindowsDirectoryFromNativeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observedWindowsDirectoryFromNativeは共有非同期状態を持たない同期処理である。
 */
function observedWindowsDirectoryFromNative() {
  try {
    const directory = observeSystemWindowsDirectory();
    if (!directory) return null;
    const kernel32 = path.win32.join(directory, "System32", "kernel32.dll");
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

/**
 * observed Windows User Profile From Osを決定する。
 *
 * @responsibility observed Windows User Profile From Osの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns observedWindowsUserProfileFromOsの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobservedWindowsUserProfileFromOsの入力契約を満たす。
 * @postcondition observedWindowsUserProfileFromOsの責務を完了した結果だけを返す。
 * @effect observedWindowsUserProfileFromOsはFilesystemの読取りまたは書込みを実行する。
 * @failure observedWindowsUserProfileFromOsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observedWindowsUserProfileFromOsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observedWindowsUserProfileFromOsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observedWindowsUserProfileFromOsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Interactive Console Reader Environmentを構築する。
 *
 * @responsibility Interactive Console Reader Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform
 * @returns createInteractiveConsoleReaderEnvironmentの計算結果を返す。
 * @precondition 「platform: NodeJS.Platform」がcreateInteractiveConsoleReaderEnvironmentの入力契約を満たす。
 * @postcondition createInteractiveConsoleReaderEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createInteractiveConsoleReaderEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createInteractiveConsoleReaderEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createInteractiveConsoleReaderEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createInteractiveConsoleReaderEnvironmentはProcess内の同一Subsystemで完結する。
 * @security N/A: createInteractiveConsoleReaderEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createInteractiveConsoleReaderEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createInteractiveConsoleReaderEnvironment(
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "win32") return fixedWindowsEnvironment(Object.freeze({}));
  return Object.freeze({});
}

/**
 * Windows Node Console Reader Environmentを構築する。
 *
 * @responsibility Windows Node Console Reader Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createWindowsNodeConsoleReaderEnvironmentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateWindowsNodeConsoleReaderEnvironmentの入力契約を満たす。
 * @postcondition createWindowsNodeConsoleReaderEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createWindowsNodeConsoleReaderEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createWindowsNodeConsoleReaderEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createWindowsNodeConsoleReaderEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createWindowsNodeConsoleReaderEnvironmentはProcess内の同一Subsystemで完結する。
 * @security N/A: createWindowsNodeConsoleReaderEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createWindowsNodeConsoleReaderEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createWindowsNodeConsoleReaderEnvironment() {
  return createInteractiveConsoleReaderEnvironment("win32");
}

/**
 * Windows Host Operation Supervisor Environmentを構築する。
 *
 * @responsibility Windows Host Operation Supervisor Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createWindowsHostOperationSupervisorEnvironmentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateWindowsHostOperationSupervisorEnvironmentの入力契約を満たす。
 * @postcondition createWindowsHostOperationSupervisorEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createWindowsHostOperationSupervisorEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createWindowsHostOperationSupervisorEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createWindowsHostOperationSupervisorEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createWindowsHostOperationSupervisorEnvironmentはProcess内の同一Subsystemで完結する。
 * @security N/A: createWindowsHostOperationSupervisorEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createWindowsHostOperationSupervisorEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createWindowsHostOperationSupervisorEnvironment() {
  return createInteractiveConsoleReaderEnvironment("win32");
}

/**
 * Windows Native Helper Environmentを構築する。
 *
 * @responsibility Windows Native Helper Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createWindowsNativeHelperEnvironmentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateWindowsNativeHelperEnvironmentの入力契約を満たす。
 * @postcondition createWindowsNativeHelperEnvironmentの責務を完了した結果だけを返す。
 * @effect createWindowsNativeHelperEnvironmentは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: createWindowsNativeHelperEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createWindowsNativeHelperEnvironmentは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: createWindowsNativeHelperEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createWindowsNativeHelperEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createWindowsNativeHelperEnvironment() {
  if (process.platform !== "win32") return null;
  const userProfile = observedWindowsUserProfileFromOs();
  if (!userProfile) return null;
  return fixedWindowsEnvironment(Object.freeze({ USERPROFILE: userProfile }));
}

/**
 * Windows Docker Desktop Repair Helper Environmentを構築する。
 *
 * @responsibility Windows Docker Desktop Repair Helper Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns Readonly< Record<string, string> > | nullを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateWindowsDockerDesktopRepairHelperEnvironmentの入力契約を満たす。
 * @postcondition createWindowsDockerDesktopRepairHelperEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createWindowsDockerDesktopRepairHelperEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createWindowsDockerDesktopRepairHelperEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createWindowsDockerDesktopRepairHelperEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createWindowsDockerDesktopRepairHelperEnvironmentはProcess内の同一Subsystemで完結する。
 * @security N/A: createWindowsDockerDesktopRepairHelperEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createWindowsDockerDesktopRepairHelperEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createWindowsDockerDesktopRepairHelperEnvironment(): Readonly<
  Record<string, string>
> | null {
  const environment = createWindowsNativeHelperEnvironment();
  if (!environment) return null;
  const systemDrive = deriveWindowsSystemDrive(environment.SystemRoot);
  if (!systemDrive) return null;
  return Object.freeze({ ...environment, SYSTEMDRIVE: systemDrive });
}

/**
 * Windows Power Shell Authenticode Environmentを構築する。
 *
 * @responsibility Windows Power Shell Authenticode Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns Readonly< Record<string, string> > | nullを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateWindowsPowerShellAuthenticodeEnvironmentの入力契約を満たす。
 * @postcondition createWindowsPowerShellAuthenticodeEnvironmentの責務を完了した結果だけを返す。
 * @effect createWindowsPowerShellAuthenticodeEnvironmentは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: createWindowsPowerShellAuthenticodeEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createWindowsPowerShellAuthenticodeEnvironmentは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: createWindowsPowerShellAuthenticodeEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createWindowsPowerShellAuthenticodeEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createWindowsPowerShellAuthenticodeEnvironment(): Readonly<
  Record<string, string>
> | null {
  if (process.platform !== "win32") return null;
  const windowsDirectory = observedWindowsDirectoryFromNative();
  const userProfile = observedWindowsUserProfileFromOs();
  if (!windowsDirectory || !userProfile) return null;
  const system32 = path.win32.join(windowsDirectory, "System32");
  const powerShellDirectory = path.win32.join(
    system32,
    "WindowsPowerShell",
    "v1.0",
  );
  return Object.freeze({
    SystemRoot: windowsDirectory,
    WINDIR: windowsDirectory,
    USERPROFILE: userProfile,
    PATH: [system32, windowsDirectory, powerShellDirectory].join(";"),
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
  });
}

// Pure path validation; callers must obtain the directory from the OS observer.
// This does not turn a caller-supplied path into an execution capability.
/**
 * derive Windows System Driveを決定する。
 *
 * @responsibility derive Windows System Driveの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input windowsDirectory: unknown
 * @returns deriveWindowsSystemDriveの計算結果を返す。
 * @precondition 「windowsDirectory: unknown」がderiveWindowsSystemDriveの入力契約を満たす。
 * @postcondition deriveWindowsSystemDriveの責務を完了した結果だけを返す。
 * @effect N/A: deriveWindowsSystemDriveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: deriveWindowsSystemDriveは独自の失敗分岐を所有しない。
 * @invariant deriveWindowsSystemDriveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: deriveWindowsSystemDriveはProcess内の同一Subsystemで完結する。
 * @security N/A: deriveWindowsSystemDriveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: deriveWindowsSystemDriveは共有非同期状態を持たない同期処理である。
 */
export function deriveWindowsSystemDrive(windowsDirectory: unknown) {
  if (
    typeof windowsDirectory !== "string" ||
    !/^[A-Za-z]:\\[^\\]/u.test(windowsDirectory) ||
    windowsDirectory.includes("\0") ||
    path.win32.normalize(windowsDirectory) !== windowsDirectory
  )
    return null;
  return windowsDirectory.slice(0, 2);
}

/**
 * Windows Docker Cli Environmentを構築する。
 *
 * @responsibility Windows Docker Cli Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input options: Readonly<{ dockerConfig: string | null; dockerHome: string | null; }>
 * @returns createWindowsDockerCliEnvironmentの計算結果を返す。
 * @precondition 「options: Readonly<{ dockerConfig: string | null; dockerHome: string | null; }>」がcreateWindowsDockerCliEnvironmentの入力契約を満たす。
 * @postcondition createWindowsDockerCliEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createWindowsDockerCliEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createWindowsDockerCliEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createWindowsDockerCliEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createWindowsDockerCliEnvironmentはProcess内の同一Subsystemで完結する。
 * @security N/A: createWindowsDockerCliEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createWindowsDockerCliEnvironmentは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Windows Child Environment 契約の公開契約を記述する。
 *
 * @responsibility Windows Child Environment 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeWindowsChildEnvironmentContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeWindowsChildEnvironmentContractの入力契約を満たす。
 * @postcondition describeWindowsChildEnvironmentContractの責務を完了した結果だけを返す。
 * @effect N/A: describeWindowsChildEnvironmentContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeWindowsChildEnvironmentContractは独自の失敗分岐を所有しない。
 * @invariant describeWindowsChildEnvironmentContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeWindowsChildEnvironmentContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeWindowsChildEnvironmentContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeWindowsChildEnvironmentContractは共有非同期状態を持たない同期処理である。
 */
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
    powerShellAuthenticodeConsumers: Object.freeze([
      "docker_cli_authenticode_inspection",
    ]),
    powerShellAuthenticodeEnvironment:
      "native_os_directory_and_validated_user_profile_minimal_powershell_initialization_block",
    dockerDesktopLauncherConsumers: Object.freeze([]),
    dockerRepairHelperSystemDrive:
      "native_system_windows_directory_local_drive",
    dockerDesktopLauncherEnvironment:
      "native_helper_known_folder_and_loaded_os_directory_minimal_unicode_block",
    userProfileEnvironmentAuthority: false,
    userProfileInitializationAuthority: false,
    actualChildObservationRequired: true,
  });
}
