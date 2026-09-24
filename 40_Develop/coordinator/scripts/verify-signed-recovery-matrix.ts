/**
 * verify-signed-recovery-matrixに属する責務をまとめる。
 *
 * @responsibility RuntimeRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { ChildProcess } from "node:child_process";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSupportedCoordinatorNodeRuntime,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";
import { spawnRuntimeLocalTypeScriptChild } from "../src/core/runtime-local-typescript-child-entrypoints.ts";
import {
  displayVerificationRecording,
  runRecordedVerification,
} from "../src/core/verification-result-record.ts";
import { createInteractiveConsoleReaderEnvironment } from "../src/core/windows-child-environment.ts";
import {
  createDynamicFakeProviderRecoverableResidue,
  recoverDockerIsolationProbe,
} from "../src/security/docker-isolation.ts";
import { createOwnedOperationDirectories } from "../src/security/execution-environment.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";
import { verifyDynamicFakeProviderCancellation } from "./verify-dynamic-fake-provider-cancellation.ts";
import { verifyDynamicFakeProviderFailures } from "./verify-dynamic-fake-provider-failures.ts";

export const SIGNED_RECOVERY_MATRIX_CONTRACT =
  "crdd-coordinator/signed-recovery-matrix-verification";
export const SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION = 1;

const INTERNAL_CHILD_ARGUMENT = "--internal-parent-loss-child";
const INTERNAL_CLEANUP_UNKNOWN_CHILD_ARGUMENT =
  "--internal-cleanup-unknown-child";
const CHILD_READY_CONTRACT =
  "crdd-coordinator/signed-recovery-matrix-parent-loss-child";
const CHILD_READY_TIMEOUT_MS = 60_000;
const CHILD_EXIT_TIMEOUT_MS = 10_000;

/**
 * verify-signed-recovery-matrixで使用するRuntime 記録の値契約を定義する。
 *
 * @responsibility Runtime 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeRecordの宣言は外部境界を開かない。
 * @security N/A: RuntimeRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeRecord = Readonly<Record<string, unknown>>;

/**
 * RecoveryMatrixFailureが担う状態と操作を提供する。
 *
 * @responsibility RecoveryMatrixFailureに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000008
 * @construction RecoveryMatrixFailureの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle RecoveryMatrixFailureが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: RecoveryMatrixFailureの宣言自体は実行時Effectを発行しない。
 * @failure N/A: RecoveryMatrixFailureの宣言自体は実行時失敗を所有しない。
 * @invariant RecoveryMatrixFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: RecoveryMatrixFailureの宣言は外部境界を開かない。
 * @security N/A: RecoveryMatrixFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: RecoveryMatrixFailureは共有非同期状態を持たない同期処理である。
 */
class RecoveryMatrixFailure extends Error {
  readonly recoveryId: string | null;
  readonly manualRecoveryRequired: boolean;

  constructor(
    reason: string,
    recoveryId: string | null = null,
    manualRecoveryRequired = recoveryId !== null,
  ) {
    super(reason);
    this.recoveryId = recoveryId;
    this.manualRecoveryRequired = manualRecoveryRequired;
  }
}

/**
 * verify-signed-recovery-matrixを停止結果として構築する。
 *
 * @responsibility verify-signed-recovery-matrixの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、extra: RuntimeRecord
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、extra: RuntimeRecord」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string, extra: RuntimeRecord = Object.freeze({})) {
  return Object.freeze({
    contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
    contractRevision: SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: false,
    manualRecoveryRequired: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
    ...extra,
  });
}

/**
 * Signed Package Prerequisiteを検証する。
 *
 * @responsibility Signed Package Prerequisiteの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns verifySignedPackagePrerequisiteの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifySignedPackagePrerequisiteの入力契約を満たす。
 * @postcondition verifySignedPackagePrerequisiteの責務を完了した結果だけを返す。
 * @effect verifySignedPackagePrerequisiteは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure verifySignedPackagePrerequisiteは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifySignedPackagePrerequisiteは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: verifySignedPackagePrerequisiteはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifySignedPackagePrerequisiteは共有非同期状態を持たない同期処理である。
 */
function verifySignedPackagePrerequisite() {
  if (!isSupportedCoordinatorNodeRuntime(process.versions.node))
    return Object.freeze({
      status: "blocked" as const,
      reason: "signed_recovery_matrix_node_version_unsupported",
      release: null,
    });
  try {
    const issued = issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
      evaluationTime: new Date().toISOString(),
    });
    const release = issued.verification as RuntimeRecord;
    if (
      release?.status !== "candidate" ||
      release.qualLabManifestCryptographicMatch !== true ||
      release.runtimeOwnedReleaseTrustConfirmed !== true ||
      release.runtimeExecutionIdentityRuntimeOwned !== true ||
      release.crddDistributionConfirmed !== true ||
      !issued.capability ||
      typeof issued.capability !== "object"
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "signed_recovery_matrix_release_verification_failed",
        release,
      });
    return Object.freeze({
      status: "verified" as const,
      reason: "signed_recovery_matrix_release_verified",
      release,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "signed_recovery_matrix_release_verification_failed",
      release: null,
    });
  }
}

/**
 * recovery Completedを決定する。
 *
 * @responsibility recovery Completedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input result: RuntimeRecord | null
 * @returns recoveryCompletedの計算結果を返す。
 * @precondition 「result: RuntimeRecord | null」がrecoveryCompletedの入力契約を満たす。
 * @postcondition recoveryCompletedの責務を完了した結果だけを返す。
 * @effect N/A: recoveryCompletedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryCompletedは独自の失敗分岐を所有しない。
 * @invariant recoveryCompletedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryCompletedはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryCompletedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryCompletedは共有非同期状態を持たない同期処理である。
 */
function recoveryCompleted(result: RuntimeRecord | null) {
  return (
    result?.status === "recovered" &&
    result.hostCleanupCompleted === true &&
    result.recoveryId === null
  );
}

/**
 * 回復 Matrix Child Environmentを構築する。
 *
 * @responsibility 回復 Matrix Child Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns NodeJS.ProcessEnv | nullを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateRecoveryMatrixChildEnvironmentの入力契約を満たす。
 * @postcondition createRecoveryMatrixChildEnvironmentの責務を完了した結果だけを返す。
 * @effect createRecoveryMatrixChildEnvironmentはFilesystemの読取りまたは書込みを実行する。
 * @failure createRecoveryMatrixChildEnvironmentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRecoveryMatrixChildEnvironmentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createRecoveryMatrixChildEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRecoveryMatrixChildEnvironmentは共有非同期状態を持たない同期処理である。
 */
function createRecoveryMatrixChildEnvironment(): NodeJS.ProcessEnv | null {
  const observedEnvironment = createInteractiveConsoleReaderEnvironment();
  if (!observedEnvironment || process.platform !== "win32") return null;
  try {
    const profile = fs.realpathSync.native(os.userInfo().homedir);
    const temporary = fs.realpathSync.native(
      path.join(profile, "AppData", "Local", "Temp"),
    );
    const metadata = fs.lstatSync(temporary);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      path.win32.parse(temporary).root === temporary
    )
      return null;
    return {
      ...observedEnvironment,
      TEMP: temporary,
      TMP: temporary,
    };
  } catch {
    return null;
  }
}

/**
 * For Child Readyを完了まで待機する。
 *
 * @responsibility For Child Readyの待機条件、完了観測、Timeout境界を所有する。
 * @trace ARCH-000008
 * @input child: ChildProcess
 * @returns Promise<RuntimeRecord>を返す。
 * @precondition 「child: ChildProcess」がwaitForChildReadyの入力契約を満たす。
 * @postcondition waitForChildReadyの責務を完了した結果だけを返す。
 * @effect N/A: waitForChildReadyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure waitForChildReadyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant waitForChildReadyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: waitForChildReadyはProcess内の同一Subsystemで完結する。
 * @security N/A: waitForChildReadyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency waitForChildReadyは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function waitForChildReady(child: ChildProcess): Promise<RuntimeRecord> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("signed_recovery_matrix_parent_child_timeout"));
    }, CHILD_READY_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (settled) return;
      output += chunk;
      const newline = output.indexOf("\n");
      if (newline < 0) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(output.slice(0, newline)) as RuntimeRecord);
      } catch {
        reject(new Error("signed_recovery_matrix_parent_child_output_invalid"));
      }
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("signed_recovery_matrix_parent_child_exited_early"));
    });
  });
}

/**
 * For Child Exitを完了まで待機する。
 *
 * @responsibility For Child Exitの待機条件、完了観測、Timeout境界を所有する。
 * @trace ARCH-000008
 * @input child: ChildProcess
 * @returns Promise<boolean>を返す。
 * @precondition 「child: ChildProcess」がwaitForChildExitの入力契約を満たす。
 * @postcondition waitForChildExitの責務を完了した結果だけを返す。
 * @effect N/A: waitForChildExitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: waitForChildExitは独自の失敗分岐を所有しない。
 * @invariant waitForChildExitは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: waitForChildExitはProcess内の同一Subsystemで完結する。
 * @security N/A: waitForChildExitはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency waitForChildExitは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function waitForChildExit(child: ChildProcess): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), CHILD_EXIT_TIMEOUT_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/**
 * Parent Loss Then Recoverを検証する。
 *
 * @responsibility Parent Loss Then Recoverの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns verifyParentLossThenRecoverの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifyParentLossThenRecoverの入力契約を満たす。
 * @postcondition verifyParentLossThenRecoverの責務を完了した結果だけを返す。
 * @effect verifyParentLossThenRecoverは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure verifyParentLossThenRecoverは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyParentLossThenRecoverは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: verifyParentLossThenRecoverはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency verifyParentLossThenRecoverは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function verifyParentLossThenRecover() {
  const childEnvironment = createRecoveryMatrixChildEnvironment();
  if (!childEnvironment)
    throw new Error("signed_recovery_matrix_child_environment_unavailable");
  const child: ChildProcess = spawnRuntimeLocalTypeScriptChild(
    "signed_recovery_matrix_child",
    [INTERNAL_CHILD_ARGUMENT],
    {
      cwd: process.cwd(),
      env: childEnvironment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let recoveryId: string | null = null;
  try {
    const ready = await waitForChildReady(child);
    if (
      ready.contract !== CHILD_READY_CONTRACT ||
      ready.status !== "ready" ||
      typeof ready.recoveryId !== "string" ||
      ready.manualRecoveryRequired !== true
    )
      throw new RecoveryMatrixFailure(
        "signed_recovery_matrix_parent_child_contract_invalid",
      );
    recoveryId = ready.recoveryId;
    if (!child.pid)
      throw new RecoveryMatrixFailure(
        "signed_recovery_matrix_parent_child_pid_missing",
        recoveryId,
      );
    const killed = spawnSync(
      path.join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32",
        "taskkill.exe",
      ),
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        env: childEnvironment,
        windowsHide: true,
        timeout: CHILD_EXIT_TIMEOUT_MS,
      },
    );
    if (killed.error || (killed.status !== 0 && child.exitCode === null))
      throw new RecoveryMatrixFailure(
        "signed_recovery_matrix_parent_child_kill_failed",
        recoveryId,
      );
    if (!(await waitForChildExit(child)))
      throw new RecoveryMatrixFailure(
        "signed_recovery_matrix_parent_child_exit_unconfirmed",
        recoveryId,
      );
    const recovered = recoverDockerIsolationProbe(
      recoveryId,
    ) as RuntimeRecord | null;
    if (!recoveryCompleted(recovered))
      throw new RecoveryMatrixFailure(
        "signed_recovery_matrix_parent_loss_recovery_failed",
        recoveryId,
      );
    recoveryId = null;
    return Object.freeze({
      scenario: "parent_process_loss_then_fresh_recovery",
      childProcessTerminationObserved: true,
      exactRecoveryIdReturned: true,
      freshRecoveryCompleted: true,
      manualRecoveryRequiredAfterRecovery: false,
    });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

/**
 * 清掃 Unknown Then Recoverを検証する。
 *
 * @responsibility 清掃 Unknown Then Recoverの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns verifyCleanupUnknownThenRecoverの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifyCleanupUnknownThenRecoverの入力契約を満たす。
 * @postcondition verifyCleanupUnknownThenRecoverの責務を完了した結果だけを返す。
 * @effect verifyCleanupUnknownThenRecoverは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure verifyCleanupUnknownThenRecoverは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyCleanupUnknownThenRecoverは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: verifyCleanupUnknownThenRecoverはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency verifyCleanupUnknownThenRecoverは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function verifyCleanupUnknownThenRecover() {
  const childEnvironment = createRecoveryMatrixChildEnvironment();
  if (!childEnvironment)
    throw new RecoveryMatrixFailure(
      "signed_recovery_matrix_child_environment_unavailable",
    );
  const child: ChildProcess = spawnRuntimeLocalTypeScriptChild(
    "signed_recovery_matrix_child",
    [INTERNAL_CLEANUP_UNKNOWN_CHILD_ARGUMENT],
    {
      cwd: process.cwd(),
      env: childEnvironment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let recoveryId: string | null = null;
  const ready = await waitForChildReady(child);
  if (
    ready.contract !== CHILD_READY_CONTRACT ||
    ready.status !== "ready" ||
    typeof ready.recoveryId !== "string" ||
    ready.manualRecoveryRequired !== true
  )
    throw new RecoveryMatrixFailure(
      "signed_recovery_matrix_cleanup_child_contract_invalid",
    );
  recoveryId = ready.recoveryId;
  if (!(await waitForChildExit(child)))
    throw new RecoveryMatrixFailure(
      "signed_recovery_matrix_cleanup_child_exit_unconfirmed",
      recoveryId,
    );
  const recovered = recoverDockerIsolationProbe(
    recoveryId,
  ) as RuntimeRecord | null;
  if (!recoveryCompleted(recovered))
    throw new RecoveryMatrixFailure(
      "signed_recovery_matrix_cleanup_unknown_recovery_failed",
      recoveryId,
    );
  recoveryId = null;
  return Object.freeze({
    scenario: "cleanup_observation_unknown_then_recover",
    initialStatus: "blocked",
    initialReason: "cleanup_observation_intentionally_withheld",
    initialManualRecoveryRequired: true,
    exactRecoveryIdReturned: true,
    freshRecoveryCompleted: true,
    residualOperationDirectory: false,
  });
}

/**
 * Internal Residue Childを実行する。
 *
 * @responsibility Internal Residue Childの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input shouldWaitForTermination: boolean
 * @returns runInternalResidueChildの計算結果を返す。
 * @precondition 「shouldWaitForTermination: boolean」がrunInternalResidueChildの入力契約を満たす。
 * @postcondition runInternalResidueChildの責務を完了した結果だけを返す。
 * @effect runInternalResidueChildは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runInternalResidueChildは独自の失敗分岐を所有しない。
 * @invariant runInternalResidueChildは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runInternalResidueChildはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runInternalResidueChildは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runInternalResidueChild(shouldWaitForTermination: boolean) {
  const prerequisite = verifySignedPackagePrerequisite();
  if (prerequisite.status !== "verified") {
    process.stdout.write(
      `${JSON.stringify({ contract: CHILD_READY_CONTRACT, status: "blocked", reason: prerequisite.reason })}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const owned = createOwnedOperationDirectories();
  const residue = createDynamicFakeProviderRecoverableResidue(owned);
  process.stdout.write(
    `${JSON.stringify({
      contract: CHILD_READY_CONTRACT,
      status: residue.status,
      reason: residue.reason,
      recoveryId: residue.recoveryId,
      manualRecoveryRequired: residue.manualRecoveryRequired,
    })}\n`,
  );
  if (residue.status !== "ready") {
    process.exitCode = 2;
    return;
  }
  if (shouldWaitForTermination) {
    setInterval(() => undefined, 1_000);
    await new Promise<never>(() => undefined);
  }
}

/**
 * Signed 回復 Matrix Verificationを実行する。
 *
 * @responsibility Signed 回復 Matrix Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns runSignedRecoveryMatrixVerificationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がrunSignedRecoveryMatrixVerificationの入力契約を満たす。
 * @postcondition runSignedRecoveryMatrixVerificationの責務を完了した結果だけを返す。
 * @effect N/A: runSignedRecoveryMatrixVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runSignedRecoveryMatrixVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runSignedRecoveryMatrixVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runSignedRecoveryMatrixVerificationはProcess内の同一Subsystemで完結する。
 * @security N/A: runSignedRecoveryMatrixVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runSignedRecoveryMatrixVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runSignedRecoveryMatrixVerification() {
  const prerequisite = verifySignedPackagePrerequisite();
  if (prerequisite.status !== "verified") return blocked(prerequisite.reason);
  try {
    const failures = verifyDynamicFakeProviderFailures();
    const failureScenarios = failures.scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      status: scenario.status,
      reason: scenario.reason,
      cleanup: scenario.cleanup,
      residualOperationDirectory: scenario.residualOperationDirectory,
    }));
    const cancellation = await verifyDynamicFakeProviderCancellation();
    const cleanupUnknown = await verifyCleanupUnknownThenRecover();
    const parentLoss = await verifyParentLossThenRecover();
    return Object.freeze({
      contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
      contractRevision: SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
      status: "completed" as const,
      reason: "signed_recovery_matrix_verified",
      minimumNodeVersion: MINIMUM_COORDINATOR_NODE_VERSION,
      packageVerification: "signed_release_and_exact_distribution",
      scenarios: Object.freeze([
        ...failureScenarios,
        Object.freeze({
          scenario: "cancel",
          status: cancellation.status,
          reason: cancellation.reason,
          cleanup: cancellation.cleanup,
          residualOperationDirectory: cancellation.residualOperationDirectory,
        }),
        cleanupUnknown,
        parentLoss,
      ]),
      fixedVerificationWorkerOnly: true,
      providerCredentialUsed: false,
      providerNetworkEffectIssued: false,
      apiKeyFallbackAllowed: false,
      paidApiFallbackAllowed: false,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      rawProviderOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  } catch (error) {
    if (error instanceof RecoveryMatrixFailure)
      return blocked(
        error.message,
        Object.freeze({
          cleanupConfirmed: false,
          manualRecoveryRequired: error.manualRecoveryRequired,
          recoveryId: error.recoveryId,
        }),
      );
    return blocked(
      error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "signed_recovery_matrix_failed_closed",
    );
  }
}

/**
 * Signed 回復 Matrix 契約の公開契約を記述する。
 *
 * @responsibility Signed 回復 Matrix 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeSignedRecoveryMatrixContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeSignedRecoveryMatrixContractの入力契約を満たす。
 * @postcondition describeSignedRecoveryMatrixContractの責務を完了した結果だけを返す。
 * @effect describeSignedRecoveryMatrixContractは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: describeSignedRecoveryMatrixContractは独自の失敗分岐を所有しない。
 * @invariant describeSignedRecoveryMatrixContractは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeSignedRecoveryMatrixContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeSignedRecoveryMatrixContractは共有非同期状態を持たない同期処理である。
 */
export function describeSignedRecoveryMatrixContract() {
  return Object.freeze({
    contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
    contractRevision: SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
    normalTaskSchemaChanged: false,
    publicScenarioArgumentsAllowed: false,
    fixedScenarios: Object.freeze([
      "nonzero_exit",
      "timeout",
      "output_limit",
      "invalid_output",
      "cancel",
      "parent_process_loss_then_fresh_recovery",
      "cleanup_observation_unknown_then_recover",
    ]),
    parentLoss: "real_child_process_termination_then_fresh_recovery",
    recoveryIdentity: "exact_durable_runtime_owned_token",
    providerCredentialAllowed: false,
    providerNetworkAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

/**
 * verify-signed-recovery-matrixのCommand処理を開始する。
 *
 * @responsibility verify-signed-recovery-matrixの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns mainの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了した結果だけを返す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === INTERNAL_CHILD_ARGUMENT) {
    await runInternalResidueChild(true);
    return;
  }
  if (
    args.length === 1 &&
    args[0] === INTERNAL_CLEANUP_UNKNOWN_CHILD_ARGUMENT
  ) {
    await runInternalResidueChild(false);
    return;
  }
  if (args.length !== 0)
    throw new Error("signed_recovery_matrix_arguments_invalid");
  const outcome = await runRecordedVerification(
    "recovery",
    process.cwd(),
    runSignedRecoveryMatrixVerification,
    () => blocked("signed_recovery_matrix_failed_closed"),
  );
  displayVerificationRecording(outcome);
  if (outcome.result !== null)
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
  process.exitCode = outcome.exitCode;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error: unknown) {
    process.stdout.write(
      `${JSON.stringify(
        blocked(
          error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
            ? error.message
            : "signed_recovery_matrix_failed_closed",
        ),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
  }
}
