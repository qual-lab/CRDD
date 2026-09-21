import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createWindowsDockerDesktopRepairHelperEnvironment } from "../core/windows-child-environment.ts";
import {
  describeDockerDesktopCurrentArtifactTrustContract,
  dockerDesktopCurrentArtifactTrustPolicySha256,
} from "./docker-desktop-current-artifact-trust.ts";
import { createDockerDesktopRepairNativeHelperLifecycle } from "./docker-desktop-repair-native-process-lifecycle.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";

/**
 * DockerDesktopRepairHelperReleaseOutcomeが扱う値の構造を表す。
 *
 * @responsibility DockerDesktopRepairHelperReleaseOutcomeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairHelperReleaseOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairHelperReleaseOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairHelperReleaseOutcomeの宣言は外部境界を開かない。
 * @security DockerDesktopRepairHelperReleaseOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairHelperReleaseOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairHelperReleaseOutcome = Readonly<{
  cleanup: "confirmed" | "unknown";
  protocol: "completed" | "failed" | "not_applicable";
}>;
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const executablePath = path.join(
  bundledDistributionRoot,
  ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
);

/**
 * PlatformArtifactが扱う値の構造を表す。
 *
 * @responsibility PlatformArtifactに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape PlatformArtifactが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PlatformArtifactで宣言した値と責務の対応を維持する。
 * @boundary N/A: PlatformArtifactの宣言は外部境界を開かない。
 * @security PlatformArtifactはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PlatformArtifactの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PlatformArtifact = Readonly<{
  relativePath: string;
  target: string;
  protocolRevision: number;
  rustToolchain: string;
  byteLength: number;
  sha256: string;
}>;

/**
 * DockerDesktopRepairNativeHelperSessionが扱う値の構造を表す。
 *
 * @responsibility DockerDesktopRepairNativeHelperSessionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairNativeHelperSessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairNativeHelperSessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairNativeHelperSessionの宣言は外部境界を開かない。
 * @security DockerDesktopRepairNativeHelperSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairNativeHelperSessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairNativeHelperSession = Readonly<{
  assertLive: () => boolean;
  onFailureDetected: (listener: () => void) => () => void;
  failureDetected: Promise<void>;
  verifyArtifacts: () => Promise<"verified" | "unknown">;
  inspectProcesses: () => Promise<"absent" | "verified" | "unknown">;
  terminateProcesses: () => Promise<
    | "absent"
    | "not_issued_unknown"
    | "terminated"
    | "partial_or_unknown"
    | "unknown"
  >;
  launchDesktop: () => Promise<
    "not_started" | "started" | "partial_or_unknown" | "unknown"
  >;
  abort: () => Promise<DockerDesktopRepairHelperReleaseOutcome>;
  release: () => Promise<DockerDesktopRepairHelperReleaseOutcome>;
}>;

/**
 * DockerDesktopRepairNativeHelperOutcomeが扱う値の構造を表す。
 *
 * @responsibility DockerDesktopRepairNativeHelperOutcomeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairNativeHelperOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairNativeHelperOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairNativeHelperOutcomeの宣言は外部境界を開かない。
 * @security DockerDesktopRepairNativeHelperOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairNativeHelperOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairNativeHelperOutcome = Readonly<{
  status: "acquired" | "unavailable" | "protocol_failed" | "cleanup_unknown";
  session: DockerDesktopRepairNativeHelperSession | null;
}>;

/**
 * DockerDesktopRestartNativeHelperOutcomeが扱う値の構造を表す。
 *
 * @responsibility DockerDesktopRestartNativeHelperOutcomeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerDesktopRestartNativeHelperOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRestartNativeHelperOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRestartNativeHelperOutcomeの宣言は外部境界を開かない。
 * @security DockerDesktopRestartNativeHelperOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRestartNativeHelperOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRestartNativeHelperOutcome = Readonly<{
  status: DockerDesktopRepairNativeHelperOutcome["status"];
  session:
    | (DockerDesktopRepairNativeHelperSession &
        Readonly<{
          stopDesktop: () => Promise<
            "not_issued" | "command_completed" | "outcome_unknown"
          >;
          inspectClientProcesses: () => Promise<
            "absent" | "verified" | "unknown"
          >;
        }>)
    | null;
}>;

/**
 * NativeChildが扱う値の構造を表す。
 *
 * @responsibility NativeChildに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape NativeChildが表すProperty、識別子およびRelationを型として固定する。
 * @invariant NativeChildで宣言した値と責務の対応を維持する。
 * @boundary N/A: NativeChildの宣言は外部境界を開かない。
 * @security NativeChildはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility NativeChildの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type NativeChild = ChildProcessWithoutNullStreams;

/**
 * sameArtifactの処理を実行する。
 *
 * @responsibility sameArtifactに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input left: unknown、right: unknown
 * @returns sameArtifactの計算結果を返す。
 * @precondition 「left: unknown、right: unknown」がsameArtifactの入力契約を満たす。
 * @postcondition sameArtifactの責務を完了した結果だけを返す。
 * @effect N/A: sameArtifactは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameArtifactは独自の失敗分岐を所有しない。
 * @invariant sameArtifactは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security sameArtifactはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameArtifactは共有非同期状態を持たない同期処理である。
 */
function sameArtifact(left: unknown, right: unknown) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const first = left as Partial<PlatformArtifact>;
  const second = right as Partial<PlatformArtifact>;
  return (
    first.relativePath === second.relativePath &&
    first.target === second.target &&
    first.protocolRevision === second.protocolRevision &&
    first.rustToolchain === second.rustToolchain &&
    first.byteLength === second.byteLength &&
    first.sha256 === second.sha256
  );
}

/**
 * acquireRuntimeOwnedDockerDesktopRepairNativeHelperの処理を実行する。
 *
 * @responsibility acquireRuntimeOwnedDockerDesktopRepairNativeHelperに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input expectedPlatformArtifact: unknown
 * @returns Promise<DockerDesktopRepairNativeHelperOutcome>を返す。
 * @precondition 「expectedPlatformArtifact: unknown」がacquireRuntimeOwnedDockerDesktopRepairNativeHelperの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedDockerDesktopRepairNativeHelperの責務を完了した結果だけを返す。
 * @effect N/A: acquireRuntimeOwnedDockerDesktopRepairNativeHelperは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: acquireRuntimeOwnedDockerDesktopRepairNativeHelperは独自の失敗分岐を所有しない。
 * @invariant acquireRuntimeOwnedDockerDesktopRepairNativeHelperは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security acquireRuntimeOwnedDockerDesktopRepairNativeHelperはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency acquireRuntimeOwnedDockerDesktopRepairNativeHelperは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function acquireRuntimeOwnedDockerDesktopRepairNativeHelper(
  expectedPlatformArtifact: unknown,
): Promise<DockerDesktopRepairNativeHelperOutcome> {
  return acquireRuntimeOwnedDockerDesktopNativeHelper(
    expectedPlatformArtifact,
    "repair",
  );
}

/**
 * acquireRuntimeOwnedDockerDesktopRestartNativeHelperの処理を実行する。
 *
 * @responsibility acquireRuntimeOwnedDockerDesktopRestartNativeHelperに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input expectedPlatformArtifact: unknown
 * @returns Promise<DockerDesktopRestartNativeHelperOutcome>を返す。
 * @precondition 「expectedPlatformArtifact: unknown」がacquireRuntimeOwnedDockerDesktopRestartNativeHelperの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedDockerDesktopRestartNativeHelperの責務を完了した結果だけを返す。
 * @effect N/A: acquireRuntimeOwnedDockerDesktopRestartNativeHelperは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: acquireRuntimeOwnedDockerDesktopRestartNativeHelperは独自の失敗分岐を所有しない。
 * @invariant acquireRuntimeOwnedDockerDesktopRestartNativeHelperは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security acquireRuntimeOwnedDockerDesktopRestartNativeHelperはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency acquireRuntimeOwnedDockerDesktopRestartNativeHelperは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function acquireRuntimeOwnedDockerDesktopRestartNativeHelper(
  expectedPlatformArtifact: unknown,
): Promise<DockerDesktopRestartNativeHelperOutcome> {
  return acquireRuntimeOwnedDockerDesktopNativeHelper(
    expectedPlatformArtifact,
    "restart",
  );
}

/**
 * acquireRuntimeOwnedDockerDesktopNativeHelperの処理を実行する。
 *
 * @responsibility acquireRuntimeOwnedDockerDesktopNativeHelperに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input expectedPlatformArtifact: unknown、protocol: "repair" | "restart"
 * @returns Promise<DockerDesktopRestartNativeHelperOutcome>を返す。
 * @precondition 「expectedPlatformArtifact: unknown、protocol: "repair" | "restart"」がacquireRuntimeOwnedDockerDesktopNativeHelperの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedDockerDesktopNativeHelperの責務を完了した結果だけを返す。
 * @effect acquireRuntimeOwnedDockerDesktopNativeHelperは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure acquireRuntimeOwnedDockerDesktopNativeHelperは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireRuntimeOwnedDockerDesktopNativeHelperは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security acquireRuntimeOwnedDockerDesktopNativeHelperはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency acquireRuntimeOwnedDockerDesktopNativeHelperは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function acquireRuntimeOwnedDockerDesktopNativeHelper(
  expectedPlatformArtifact: unknown,
  protocol: "repair" | "restart",
): Promise<DockerDesktopRestartNativeHelperOutcome> {
  if (process.platform !== "win32")
    return Object.freeze({ status: "unavailable", session: null });
  const policy = Object.freeze({
    policySha256: dockerDesktopCurrentArtifactTrustPolicySha256,
  });
  const artifactBefore = observePlatformAccessReleaseArtifactCandidate(
    bundledDistributionRoot,
  );
  const signingObservation = beginPlatformAccessArtifactSigningObservation(
    bundledDistributionRoot,
  );
  const environment = createWindowsDockerDesktopRepairHelperEnvironment();
  if (
    !policy ||
    artifactBefore.status !== "candidate" ||
    !signingObservation ||
    !environment ||
    !sameArtifact(expectedPlatformArtifact, artifactBefore.artifact) ||
    !sameArtifact(artifactBefore.artifact, signingObservation.artifact)
  )
    return Object.freeze({ status: "unavailable", session: null });
  let child: NativeChild;
  const helperMode =
    protocol === "repair"
      ? "--docker-desktop-repair-helper"
      : "--docker-desktop-restart-helper";
  try {
    child = spawn(executablePath, [helperMode], {
      cwd: bundledDistributionRoot,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }) as NativeChild;
  } catch {
    return Object.freeze({ status: "cleanup_unknown", session: null });
  }
  const created = createDockerDesktopRepairNativeHelperLifecycle(
    child,
    policy.policySha256,
    protocol,
  );
  const initial = await created.waitForInitial();
  const artifactAfter = observePlatformAccessReleaseArtifactCandidate(
    bundledDistributionRoot,
  );
  if (
    initial !== "R" ||
    !verifyPlatformAccessArtifactSigningObservation(signingObservation.token) ||
    artifactAfter.status !== "candidate" ||
    !sameArtifact(artifactBefore.artifact, artifactAfter.artifact)
  ) {
    if (initial === "L" || initial === "U") {
      const unavailableConfirmed = await created.waitForUnavailableExit();
      return Object.freeze({
        status: unavailableConfirmed
          ? ("unavailable" as const)
          : ("cleanup_unknown" as const),
        session: null,
      });
    }
    const released =
      initial === "R"
        ? await created.session.release()
        : await created.failProtocol();
    return Object.freeze({
      status:
        released.cleanup === "unknown"
          ? ("cleanup_unknown" as const)
          : released.protocol === "failed"
            ? ("protocol_failed" as const)
            : ("unavailable" as const),
      session: null,
    });
  }
  return Object.freeze({ status: "acquired", session: created.session });
}

/**
 * describeDockerDesktopRepairNativeHelperContractの処理を実行する。
 *
 * @responsibility describeDockerDesktopRepairNativeHelperContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerDesktopRepairNativeHelperContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerDesktopRepairNativeHelperContractの入力契約を満たす。
 * @postcondition describeDockerDesktopRepairNativeHelperContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerDesktopRepairNativeHelperContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerDesktopRepairNativeHelperContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerDesktopRepairNativeHelperContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeDockerDesktopRepairNativeHelperContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerDesktopRepairNativeHelperContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerDesktopRepairNativeHelperContract() {
  return Object.freeze({
    implementation: "signed_platform_access_native_helper",
    protocolRevision: 5,
    lockIdentity: "global_selected_user_docker_desktop_repair_domain",
    policy:
      "shared_current_artifact_trust_policy_embedded_in_native_and_runtime",
    currentRepairAndRestartTrustBoundary:
      "official_fixed_paths_valid_docker_inc_publisher_same_operation_identity_hash",
    legacyVersionPolicyUsedForCurrentAuthority: false,
    currentArtifactTrust: describeDockerDesktopCurrentArtifactTrustContract(),
    packageUpdateExclusion: "read_handles_deny_write_and_delete_until_release",
    processTermination:
      "same_verified_kernel_process_handle_query_terminate_wait_close",
    desktopLaunch:
      "create_process_w_exact_locked_launcher_handle_identity_then_close",
    desktopLaunchEnvironment:
      "os_known_folder_and_windows_directory_minimal_unicode_block",
    pidAsTerminationAuthority: false,
    processTreeTermination: false,
    parentLoss: "stdin_eof_releases_mutex_artifact_and_process_handles",
    cancellationCleanup:
      "close_stdin_and_join_exit_child_close_and_all_stdio_within_bound",
    rawPathReported: false,
    rawProcessIdReported: false,
  });
}
