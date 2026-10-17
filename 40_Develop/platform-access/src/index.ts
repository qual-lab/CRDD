/**
 * Platform AccessのNode公開境界。
 *
 * @packageDocumentation
 * @responsibility Native Artifact同一性、固定Windows Directory観測と用途固定の共通子Process環境を公開する。
 * @trace ARCH-000004 ARCH-000008 ARCH-000011 ARCH-000014
 * @boundary Filesystem読取り、固定Native Processと用途固定の環境導出。権限・raw I/O・任意環境builder・内部実体は公開しない。
 */
export {
  PLATFORM_ACCESS_TARGET,
  PLATFORM_ACCESS_RUST_TOOLCHAIN,
  PLATFORM_ACCESS_PROTOCOL_REVISION,
  PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  beginPlatformAccessArtifactObservation,
  beginPlatformAccessBootstrapObservation,
  verifyPlatformAccessArtifactObservation,
  observePlatformAccessArtifactCandidate,
} from "./artifact/identity-observation.ts";
export { observeSystemWindowsDirectory } from "./windows/system-directory.ts";
export { observeWindowsLocalAppDataDirectory } from "./windows/local-app-data.ts";
export {
  observeWindowsFilesystemEntry,
  type WindowsEntryObservation,
} from "./windows/entry-observation.ts";
export {
  startWindowsChildTreeTermination,
  type ChildTreeTerminationHandle,
  type ChildTreeTerminationResult,
} from "./windows/child-tree-termination.ts";
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
} from "./windows/child-environment.ts";
