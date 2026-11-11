/**
 * Platform AccessのNode公開境界。
 *
 * @packageDocumentation
 * @responsibility 固定Artifact同一性、Windows所在観測と残存するOS／Profile子Process環境を公開する。
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
export {
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  createChildProcessEnvironment,
  deriveWindowsSystemDrive,
} from "./process/environment.ts";
