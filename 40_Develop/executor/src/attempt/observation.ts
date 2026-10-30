/**
 * 同じ試行の非秘密診断を固定callbackへ通知する。
 * @packageDocumentation
 * @responsibility 診断の投影と受動的な通知を扱い、通知証拠Mapを持たない。
 * @trace ARCH-000008
 */
import { projectDockerExecutionBoundary } from "../../../docker-isolation/src/index.ts";
import { projectCodexExecutionBoundary } from "../../../ai-adapter/src/index.ts";
import type {
  RuntimeDependencies,
  ProviderAttemptPlan as PreparedPlan,
} from "./types.ts";
import type {
  PrimaryFailureDiagnostic,
  RecoveryStartFailureDiagnostic,
} from "../result/types.ts";

/**
 * 一試行の非秘密診断を表す。
 * @responsibility 構成・回復開始失敗・終了観測を相関した閉じた通知へ限定する。
 * @trace ARCH-000008
 * @shape eventを判別子とするProvider・操作・試行と固定診断値。
 * @invariant 一次故障と清掃・終了観測を別fieldで保持する。
 * @boundary Executorから上位の診断Consumer。
 * @security 生出力・Command本文・認証値を含めない。
 * @compatibility 元の通知名・相関field・三値の意味を維持する。
 */
export type AttemptDiagnosticNotice =
  | Readonly<{
      event: "coordinator_provider_recovery_start_failed";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      diagnostic: RecoveryStartFailureDiagnostic;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_configured";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      approvalModeConfigured:
        | "approve_for_me"
        | "never"
        | "not_applicable"
        | "other";
      sandboxModeConfigured:
        | "read_only"
        | "implicit"
        | "not_applicable"
        | "other";
      workspaceMountModeConfigured: "read_write" | "read_only" | null;
      networkPolicyHash: string | null;
      rootFilesystemReadOnlyConfigured: boolean;
      nonRootUserConfigured: boolean;
      workdirConfigured: boolean;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_settled";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      recoveryId: string;
      providerContainerCreatedObserved: boolean;
      providerProcessStartedObserved: boolean;
      providerProcessCompletionObserved: boolean;
      providerProcessExitStatusClass:
        | "zero"
        | "one"
        | "one_two_six"
        | "one_two_seven"
        | "other_nonzero"
        | "signal"
        | "not_observed";
      processTreeTerminationObserved: boolean;
      containersAbsentObserved: boolean;
      networksAbsentObserved: boolean;
      cleanupConfirmed: boolean;
      primaryFailure: PrimaryFailureDiagnostic | null;
    }>;

/**
 * docker-process-controllerで使用するProvider Process Started Noticeの値契約を定義する。
 *
 * @responsibility Provider Process Started NoticeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProcessStartedNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProcessStartedNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProcessStartedNoticeの宣言は外部境界を開かない。
 * @security ProcessStartedNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProcessStartedNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;

/**
 * provider Boundary Configurationを決定する。
 *
 * @responsibility provider Boundary Configurationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan
 * @returns Extract< ProviderBoundaryDiagnosticNotice, { event: "coordinator_provider_boundary_configured" } >を返す。
 * @precondition 「plan: PreparedPlan」がproviderBoundaryConfigurationの入力契約を満たす。
 * @postcondition providerBoundaryConfigurationの責務を完了した結果だけを返す。
 * @effect N/A: providerBoundaryConfigurationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerBoundaryConfigurationは独自の失敗分岐を所有しない。
 * @invariant providerBoundaryConfigurationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security providerBoundaryConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerBoundaryConfigurationは共有非同期状態を持たない同期処理である。
 */
export function providerBoundaryConfiguration(
  plan: PreparedPlan,
): Extract<
  AttemptDiagnosticNotice,
  { event: "coordinator_provider_boundary_configured" }
> {
  const docker = projectDockerExecutionBoundary(
    plan.commands,
    plan.providerImageDigest,
  );
  const codex =
    plan.provider === "codex"
      ? projectCodexExecutionBoundary(docker?.payloadArgv ?? [])
      : null;
  return Object.freeze({
    event: "coordinator_provider_boundary_configured" as const,
    taskRole: plan.taskRole,
    provider: plan.provider,
    operationId: plan.operationId,
    approvalModeConfigured: codex?.approvalModeConfigured ?? "not_applicable",
    sandboxModeConfigured: codex?.sandboxModeConfigured ?? "not_applicable",
    workspaceMountModeConfigured: plan.workspaceMountMode,
    networkPolicyHash: plan.networkPolicy?.policyHash ?? null,
    rootFilesystemReadOnlyConfigured:
      docker?.rootFilesystemReadOnlyConfigured ?? false,
    nonRootUserConfigured: docker?.nonRootUserConfigured ?? false,
    workdirConfigured: docker?.workdirConfigured ?? false,
  });
}

/**
 * Passive Boundary Diagnosticを診断結果として報告する。
 *
 * @responsibility Passive Boundary Diagnosticの公開field、相関Identity、機密を含めない結果境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: 既存の受動Reporterだけを持つ元依存、notice: 非秘密の元通知。
 * @returns N/A: reportPassiveBoundaryDiagnosticは戻り値を返さない。
 * @precondition 通知の発行時点と操作の相関はControllerが確定する。
 * @postcondition reportPassiveBoundaryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect 既存Reporterを元の依存objectへの束縛で呼ぶ。状態・Authority・資源は変更しない。
 * @failure 同期例外・Promise拒否を診断だけに閉じ、実行結果へ伝播しない。
 * @invariant reportPassiveBoundaryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security reportPassiveBoundaryDiagnosticはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reportPassiveBoundaryDiagnosticは共有非同期状態を持たない同期処理である。
 */
export function reportPassiveBoundaryDiagnostic(
  dependencies: Pick<RuntimeDependencies, "reportProviderBoundaryDiagnostic">,
  notice: AttemptDiagnosticNotice,
) {
  try {
    const pending = dependencies.reportProviderBoundaryDiagnostic?.(notice);
    if (pending) void pending.catch(() => {});
  } catch {
    // Diagnostics cannot grant authority or change the operation result.
  }
}
