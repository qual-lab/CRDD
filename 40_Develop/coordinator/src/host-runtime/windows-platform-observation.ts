/**
 * WindowsのHost観測と子Process環境導出を提供する。
 *
 * @responsibility OS観測を上位の保証選択から分離し、観測不能を不存在へ変換しない。
 * @trace ARCH-000004
 */
import {
  createWindowsDockerCliEnvironment,
  createWindowsDockerDesktopRepairHelperEnvironment,
  createWindowsHostOperationSupervisorEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../host-runtime/windows-child-environment.ts";

export const PROJECT_RUNTIME_WINDOWS_PLATFORM_FAMILY = "windows" as const;

const CHILD_ENVIRONMENT_PROFILES = new Set([
  "native_helper",
  "docker_desktop_repair_helper",
  "host_operation_supervisor",
  "docker_cli",
]);

/**
 * project-runtime-windows-platform-adapterで使用するProject Runtime Windows Child Environment 結果の値契約を定義する。
 *
 * @responsibility Project Runtime Windows Child Environment 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeWindowsChildEnvironmentResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeWindowsChildEnvironmentResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeWindowsChildEnvironmentResultの宣言は外部境界を開かない。
 * @security ProjectRuntimeWindowsChildEnvironmentResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeWindowsChildEnvironmentResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeWindowsChildEnvironmentResult =
  | Readonly<{
      status: "derived";
      profile: string;
      environment: Readonly<Record<string, string>>;
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * project-runtime-windows-platform-adapterで使用するProject Runtime Windows Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Project Runtime Windows Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeWindowsLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeWindowsLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeWindowsLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security ProjectRuntimeWindowsLeaseOwnerObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeWindowsLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeWindowsLeaseOwnerObservation = Readonly<{
  status: "alive" | "absent" | "unknown";
  ownerProcessId: number;
  ownerGeneration: string;
}>;

/**
 * Lease 所有者を観測する。
 *
 * @responsibility Lease 所有者の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawOwner: unknown
 * @returns ProjectRuntimeWindowsLeaseOwnerObservationを返す。
 * @precondition 「rawOwner: unknown」がobserveLeaseOwnerの入力契約を満たす。
 * @postcondition observeLeaseOwnerの責務を完了した結果だけを返す。
 * @effect observeLeaseOwnerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeLeaseOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLeaseOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeLeaseOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLeaseOwnerは共有非同期状態を持たない同期処理である。
 */
export function observeLeaseOwner(
  rawOwner: unknown,
): ProjectRuntimeWindowsLeaseOwnerObservation {
  const invalid = Object.freeze({
    status: "unknown" as const,
    ownerProcessId: 0,
    ownerGeneration: "invalid",
  });
  if (
    !rawOwner ||
    typeof rawOwner !== "object" ||
    Array.isArray(rawOwner) ||
    Object.getPrototypeOf(rawOwner) !== Object.prototype
  )
    return invalid;
  const owner = rawOwner as Readonly<Record<string, unknown>>;
  if (
    Object.keys(owner).sort().join("\0") !==
      ["ownerGeneration", "ownerProcessId"].sort().join("\0") ||
    !Number.isSafeInteger(owner.ownerProcessId) ||
    Number(owner.ownerProcessId) < 1 ||
    typeof owner.ownerGeneration !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(owner.ownerGeneration)
  )
    return invalid;
  const ownerProcessId = Number(owner.ownerProcessId);
  const ownerGeneration = owner.ownerGeneration;
  try {
    // Signal 0 performs existence/permission observation only.  EPERM is not
    // absence; it is deliberately kept unknown.  A PID reused by another
    // process is reported alive, preserving the non-time-only takeover rule.
    process.kill(ownerProcessId, 0);
    return Object.freeze({
      status: "alive" as const,
      ownerProcessId,
      ownerGeneration,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    return Object.freeze({
      status: code === "ESRCH" ? ("absent" as const) : ("unknown" as const),
      ownerProcessId,
      ownerGeneration,
    });
  }
}

/**
 * Observe the current process platform family without exporting the raw OS
 *
 * @responsibility Project Runtime Platform Familyの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns | Readonly<{ status: "observed"; platformFamily: string }> | Readonly<{ status: "blocked"; reason: "platform_identity_unknown" }>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveProjectRuntimePlatformFamilyの入力契約を満たす。
 * @postcondition observeProjectRuntimePlatformFamilyの責務を完了した結果だけを返す。
 * @effect observeProjectRuntimePlatformFamilyは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: observeProjectRuntimePlatformFamilyは独自の失敗分岐を所有しない。
 * @invariant observeProjectRuntimePlatformFamilyは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeProjectRuntimePlatformFamilyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeProjectRuntimePlatformFamilyは共有非同期状態を持たない同期処理である。
 */
export function observeProjectRuntimePlatformFamily():
  | Readonly<{ status: "observed"; platformFamily: string }>
  | Readonly<{ status: "blocked"; reason: "platform_identity_unknown" }> {
  if (process.platform === "win32")
    return Object.freeze({
      status: "observed" as const,
      platformFamily: PROJECT_RUNTIME_WINDOWS_PLATFORM_FAMILY,
    });
  return Object.freeze({
    status: "blocked" as const,
    reason: "platform_identity_unknown" as const,
  });
}

/**
 * derive Child Environmentを決定する。
 *
 * @responsibility derive Child Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns ProjectRuntimeWindowsChildEnvironmentResultを返す。
 * @precondition 「rawRequest: unknown」がderiveChildEnvironmentの入力契約を満たす。
 * @postcondition deriveChildEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: deriveChildEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: deriveChildEnvironmentは独自の失敗分岐を所有しない。
 * @invariant deriveChildEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security deriveChildEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: deriveChildEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function deriveChildEnvironment(
  rawRequest: unknown,
): ProjectRuntimeWindowsChildEnvironmentResult {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (
    !rawRequest ||
    typeof rawRequest !== "object" ||
    Array.isArray(rawRequest)
  )
    return blocked("windows_child_environment_request_invalid");
  const request = rawRequest as Readonly<Record<string, unknown>>;
  const profile = request.profile;
  if (typeof profile !== "string" || !CHILD_ENVIRONMENT_PROFILES.has(profile))
    return blocked("windows_child_environment_request_invalid");
  let environment: Readonly<Record<string, string>> | null = null;
  if (profile === "native_helper") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsNativeHelperEnvironment();
  } else if (profile === "docker_desktop_repair_helper") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsDockerDesktopRepairHelperEnvironment();
  } else if (profile === "host_operation_supervisor") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsHostOperationSupervisorEnvironment();
  } else {
    const dockerConfig = request.dockerConfig;
    const dockerHome = request.dockerHome;
    if (
      Object.keys(request).length !== 3 ||
      (dockerConfig !== null && typeof dockerConfig !== "string") ||
      (dockerHome !== null && typeof dockerHome !== "string") ||
      (dockerConfig === null) !== (dockerHome === null)
    )
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsDockerCliEnvironment({
      dockerConfig,
      dockerHome,
    });
  }
  if (environment === null)
    return blocked("windows_child_environment_unavailable");
  return Object.freeze({
    status: "derived" as const,
    profile,
    environment,
  });
}
