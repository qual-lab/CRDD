/**
 * Platform AccessのNode公開境界。
 *
 * @packageDocumentation
 * @responsibility 固定Native・OS生存観測、保護Root／Homeの技術搬送と用途固定の共通子Process環境を公開する。
 * @trace ARCH-000004 ARCH-000008 ARCH-000010 ARCH-000011 ARCH-000014 ARCH-000015
 * @boundary Filesystem読取り、固定Native Process、用途固定の環境導出と固定OS端末。権限・任意PathのI/O・任意環境builder・内部実体は公開しない。
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
  withTerminalOutcome,
  withTerminalAsyncOutcome,
  type TerminalHandles,
  type TerminalOperationOutcome,
} from "./terminal/console.ts";
export {
  writeWindowsTerminalTextOutcome,
  WINDOWS_TERMINAL_WRITE_TIMEOUT_MS,
  type InteractiveConsoleTextWriteOutcome,
} from "./terminal/output.ts";
export {
  observeProcessLiveness,
  observePlatformFamily,
} from "./process/observation.ts";
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
  WINDOWS_CHILD_ENVIRONMENT_CONTRACT,
  WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  createInteractiveConsoleReaderEnvironment,
  createWindowsNodeConsoleReaderEnvironment,
  createWindowsHostOperationSupervisorEnvironment,
  createWindowsNativeHelperEnvironment,
  createWindowsHostTerminalHelperEnvironment,
  createWindowsPowerShellAuthenticodeEnvironment,
  deriveWindowsSystemDrive,
  describeWindowsChildEnvironmentContract,
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
  requestDockerDesktopOfficialShutdown,
  type DockerDesktopRepairNativeHelperOutcome,
  type DockerDesktopRepairNativeHelperSession,
  type DockerDesktopRepairHelperReleaseOutcome,
  type DockerDesktopRestartNativeHelperOutcome,
} from "./docker-desktop/native-process.ts";
export {
  createHostTerminalCurrentObservationRequest,
  createHostTerminalReadRequest,
  createHostTerminalSaveRequest,
  createKnownFileHostTerminalCurrentObservationRequest,
  createKnownFileHostTerminalReadRequest,
  createKnownFileHostTerminalSaveRequest,
  observeHostTerminalWindowsCandidate,
  observeKnownFileHostTerminalWindowsCandidate,
  readHostTerminalWindowsRecord,
  readKnownFileHostTerminalWindowsRecord,
  saveHostTerminalWindowsRecord,
  saveKnownFileHostTerminalWindowsRecord,
  type HostTerminalWindowsIdentity,
} from "./host-record/record.ts";

export { readConfirmationCodeOutcome } from "./terminal/input.ts";
export { INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS } from "./terminal/confirmation-reader.ts";
export {
  acquireNamedPipeKernelLock,
  acquireNamedPipeKernelLockOutcome,
  acquireNamedPipeSupervisorLock,
} from "./lock/pipe.ts";
export type {
  HostOperationLockSupervisor,
  HostOperationSupervisorLockOutcome,
  InteractiveConsoleKernelLockOutcome,
} from "./lock/lifecycle.ts";
