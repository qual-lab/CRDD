/**
 * 単段実行の計画・準備に必要な技術値を定義する。
 * @packageDocumentation
 * @responsibility Task進行・保存を持たず、元Capabilityの消費と技術構成だけを扱う。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import type {
  AiModelSelection,
  AiProvider,
} from "../../../ai-adapter/src/index.ts";
import type {
  DockerIsolationCommand,
  DockerNetworkPolicy,
  AdviceCommand,
} from "../../../docker-isolation/src/index.ts";
import type {
  AttemptTerminalObservation,
  CompletionResult,
  PrimaryFailureDiagnostic,
} from "../result/types.ts";

/**
 * 単発実行で観測した事実を上位へ通知する。
 * @responsibility 保存・権限判断を要求せず、同じ試行の処理段階と結果だけを渡す。
 * @trace ARCH-000008
 * @invariant 必要な通知は完了を待ち、失敗時は次のEffectを発行しない。
 */
export interface ExecutorCallbacks {
  onCommandSubmitting?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onCommandNotIssued?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onProviderSubmitting?(): void | Promise<void>;
  onResourceCreated?(
    purpose: DockerIsolationCommand["purpose"],
    dockerId: string,
  ): void | Promise<void>;
  onStarted?(notice: ProcessStartedNotice): void | Promise<void>;
  onResourcesClosed?(
    observation: AttemptTerminalObservation,
  ): void | Promise<void>;
  onCleanupCompleted?(
    observation: AttemptTerminalObservation,
  ): void | Promise<void>;
  onCompleted?(
    result: CompletionResult,
    observation: AttemptTerminalObservation,
  ): void | Promise<void>;
  onDiagnostic?(notice: AttemptDiagnosticNotice): void | Promise<void>;
}

/**
 * 上位の保存Ownerが確定した参照を単発実行へ借用する内部契約。
 * @responsibility 記録の作成・回復許可を所有せず、結果と技術資源へ同じ参照を搬送する。
 * @trace ARCH-000008
 */
export type AttemptReference = Readonly<{
  recoveryId: string;
  recoveryCapability: object;
}>;

/**
 * 上位が照合した単発実行の対象・選定・内容をまとめる。
 * @responsibility 技術Path・Home同一性と用途別本文を受け、GrantやTaskを管理しない。
 * @trace ARCH-000015
 */
export type AttemptRequest = Readonly<{
  selection: AiModelSelection;
  target: Readonly<{
    operationId: string;
    grantRef: string;
    provider: string;
    workspaceSourcePath: string;
    temporarySourcePath: string;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    activeMountCapability: object;
  }>;
}> &
  (
    | Readonly<{ purpose: "probe" }>
    | Readonly<{
        purpose: "task";
        input: string;
        taskRole: "executor" | "reviewer";
        taskWorkload?: unknown;
        networkPolicy: DockerNetworkPolicy;
      }>
    | Readonly<{
        purpose: "advice";
        input: string;
        commandHash: string;
        command: AdviceCommand;
        allowedReferences: readonly string[];
      }>
  );

/**
 * 開始前の耐久記録に必要な隔離資源の投影。
 * @responsibility 資源名・Image・Modeだけを共有し、実行手順や本文を公開しない。
 * @trace ARCH-000008
 * @invariant コピーから実行を開始できず、記録の確定とAuthorityは上位が所有する。
 */
export type AttemptRecordProjection = Readonly<{
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
}>;

/**
 * Factory内部だけが保持する一試行の技術構成。
 * @responsibility AI Adapterの実行指定とDocker Commandを結合し、上位へ往復させない。
 * @trace ARCH-000008
 * @invariant 業務Authorityと記録保存は上位が所有する。
 */
export type AttemptPlan = AttemptRecordProjection &
  Readonly<{
    networkPolicy: DockerNetworkPolicy | null;
    provider: AiProvider;
    operationId: string;
    grantRef: string;
    executionSelection: AiModelSelection;
    activeMountCapability: object;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    taskRole: "executor" | "reviewer" | null;
    taskWorkload?: unknown;
    adviceCommandHash?: string | null;
    adviceAllowedReferences?: readonly string[] | null;
    providerInput: string | null;
    workspaceSourcePath: string | null;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    commands: readonly DockerIsolationCommand[];
  }>;

/**
 * 一試行の非秘密診断を表す。
 * @responsibility 構成・技術終了観測を相関した閉じた通知へ限定する。
 * @trace ARCH-000008
 * @shape eventを判別子とするProvider・操作・試行と固定診断値。
 * @invariant 一次故障と清掃・終了観測を別fieldで保持する。
 * @boundary Executorから上位の診断Consumer。
 * @security 生出力・Command本文・認証値を含めない。
 * @compatibility 元の通知名・相関field・三値の意味を維持する。
 */
export type AttemptDiagnosticNotice =
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
