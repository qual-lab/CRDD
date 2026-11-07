/**
 * Platform AccessのNode公開境界。
 *
 * @packageDocumentation
 * @responsibility 固定Native、Provider Home／Namespaceの技術搬送とOS／Profile差分の子Process環境を公開する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000011
 * @trace ARCH-000014
 * @trace ARCH-000015
 * @boundary Filesystem読取り、固定Native Processと用途固定の環境導出。権限・任意PathのI/O・任意環境builder・内部実体は公開しない。
 */
export {
  PLATFORM_ACCESS_TARGET,
  PLATFORM_ACCESS_RUST_TOOLCHAIN,
  PLATFORM_ACCESS_PROTOCOL_REVISION,
  PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  observeNativeArtifact,
  observePlatformAccessArtifactCandidate,
} from "./artifact/identity.ts";
export { observeSystemWindowsDirectory } from "./filesystem/system-directory.ts";
export { observeWindowsLocalAppDataDirectory } from "./filesystem/local-app-data.ts";
export {
  observeWindowsFilesystemEntry,
  type WindowsEntryObservation,
} from "./filesystem/entry.ts";
export {
  startWindowsChildTreeTermination,
  type ChildTreeTerminationHandle,
  type ChildTreeTerminationResult,
} from "./process/termination.ts";
export {
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  createChildProcessEnvironment,
  createWindowsHostTerminalHelperEnvironment,
  createWindowsPowerShellAuthenticodeEnvironment,
  deriveWindowsSystemDrive,
} from "./process/environment.ts";
export {
  observeWindowsRuntimeState,
  observeWindowsProviderHome,
  type DevelopmentNativeSource,
  type DevelopmentNativeSourceReader,
} from "./filesystem/root.ts";
export {
  describeProviderHomeObservationContract,
  type ProviderHomeObservationProvider,
} from "./filesystem/protection.ts";
export { initializeWindowsHostRecordNamespace } from "./host-record/namespace.ts";
export {
  startDockerDesktopRepairHelper,
  startDockerDesktopRestartHelper,
  type DockerDesktopRepairNativeHelperOutcome,
  type DockerDesktopRepairNativeHelperSession,
  type DockerDesktopRepairHelperReleaseOutcome,
  type DockerDesktopRestartNativeHelperOutcome,
} from "./docker-desktop/native-process.ts";
