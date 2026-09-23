/**
 * docker-process-controllerに属する責務をまとめる。
 *
 * @responsibility Commandを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import type { Writable } from "node:stream";
import { types as utilTypes } from "node:util";

import { consumeRuntimeOwnedClaudeDockerPlanForProcessController } from "./claude-docker-runtime-adapter.ts";
import {
  normalizeClaudeStructuredResult,
  parseUnambiguousJsonDocument,
} from "./claude-structured-result.ts";
import { consumeRuntimeOwnedCodexDockerPlanForProcessController } from "./codex-docker-runtime-adapter.ts";
import { normalizeCodexStructuredResult } from "./codex-structured-result.ts";
import {
  cleanupRuntimeOwnedDockerResources,
  startRuntimeOwnedDockerCommand,
} from "./docker-effect-runtime.ts";
import { parseDockerTaskRecoveryId } from "./docker-recovery-identity.ts";
import {
  publicDockerRecoveryStartReason,
  publicVerifiedDockerRecoveryId,
} from "./docker-recovery-public-projection.ts";
import {
  DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS,
  type DockerProcessControllerPublicCompletionReason,
} from "./docker-process-controller-result-reasons.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  completeRuntimeOwnedDockerRecovery,
  markRuntimeOwnedDockerResourceSubmission,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedDockerResourceReceipt,
  recordRuntimeOwnedNormalMountCompletion,
  verifyRuntimeOwnedDockerRecoveryBinding,
} from "./docker-recovery-runtime.ts";
import { consumeRuntimeOwnedProviderAuthority } from "./provider-authority-runtime.ts";
import { completeRuntimeOwnedProviderHomeMount } from "./provider-home-mount-grant-runtime.ts";
import { normalizeProviderTaskStructuredResult } from "./provider-task-structured-result.ts";
import { verifyRuntimeOwnedRepositoryOperation } from "./repository-operation-runtime.ts";

export const DOCKER_PROCESS_CONTROLLER_CONTRACT =
  "crdd-coordinator/docker-process-controller";
export const DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION = 29;

const SETUP_TIMEOUT_MS = 10_000;
const PROVIDER_TIMEOUT_MS = 300_000;
const CANCELLATION_GRACE_MS = 5_000;
const STDOUT_LIMIT_BYTES = 1_048_576;
const STDERR_LIMIT_BYTES = 262_144;
const PURPOSES = Object.freeze([
  "create_subscription_auth_probe",
  "start_subscription_auth_probe_attached",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_egress",
  "create_provider",
  "start_proxy",
  "start_provider_attached",
] as const);
/**
 * Docker Process Controllerが実行する固定Command用途を表す。
 *
 * @responsibility Command Planで許可する用途の型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定Purpose配列の要素だけからなる文字列unionである。
 * @invariant 任意Command用途を追加しない。
 * @boundary Runtime PlanからDocker Command実行への用途境界。
 * @security 固定用途以外のCommand発行を型境界へ昇格させない。
 * @compatibility 利用側は固定Purpose配列の要素だけへ依存する。
 */
type DockerCommandPurpose = (typeof PURPOSES)[number];
/**
 * Provider本体起動を除くDocker準備Command用途を表す。
 *
 * @responsibility 段階別Setup診断へ対応する用途集合を所有する。
 * @trace ARCH-000008
 * @shape DockerCommandPurposeからProvider起動用途を除外した文字列unionである。
 * @invariant Setup用途とProvider本体起動用途を混同しない。
 * @boundary Docker SetupとProvider実行の診断境界。
 * @security 固定Setup用途以外を診断理由へ変換しない。
 * @compatibility 利用側は固定Setup理由Registryと一対一対応する用途だけへ依存する。
 */
type DockerSetupCommandPurpose = Exclude<
  DockerCommandPurpose,
  "start_provider_attached"
>;
const SETUP_COMMAND_FAILURE_REASONS = Object.freeze({
  create_subscription_auth_probe:
    "docker_setup_create_subscription_auth_probe_failed",
  start_subscription_auth_probe_attached:
    "docker_setup_start_subscription_auth_probe_attached_failed",
  create_internal_network: "docker_setup_create_internal_network_failed",
  create_egress_network: "docker_setup_create_egress_network_failed",
  create_proxy: "docker_setup_create_proxy_failed",
  connect_proxy_egress: "docker_setup_connect_proxy_egress_failed",
  create_provider: "docker_setup_create_provider_failed",
  start_proxy: "docker_setup_start_proxy_failed",
} satisfies Readonly<
  Record<
    DockerSetupCommandPurpose,
    DockerProcessControllerPublicCompletionReason
  >
>);

/**
 * 値がDocker Process Controllerの固定Setup用途か判定する。
 *
 * @responsibility 任意文字列を固定Purpose集合とexact照合し、段階別診断へ安全に接続する。
 * @trace ARCH-000008
 * @input value: string
 * @returns 固定Purposeにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の文字列を受け取る。
 * @postcondition trueの場合、値をDockerSetupCommandPurposeとして扱える。
 * @effect N/A: 不変Purpose集合を参照するだけである。
 * @failure N/A: 未知値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で用途を許可しない。
 * @boundary Docker Command Planから公開診断理由への分類境界。
 * @security Command引数や出力を返さず、固定Purposeだけを識別する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function isDockerSetupCommandPurpose(
  value: string,
): value is DockerSetupCommandPurpose {
  return (
    value !== "start_provider_attached" &&
    (PURPOSES as readonly string[]).includes(value)
  );
}
const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);
const blockedCompletionReasons = new Set<string>(
  DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS,
);
/**
 * Docker Process Controllerの最終理由を表す。
 *
 * @responsibility 公開失敗理由と完了・取消理由の閉じた型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定公開理由へ完了と取消の二状態を加えた文字列unionである。
 * @invariant 未知理由またはProvider生出力を含まない。
 * @boundary Docker Process Controller内部結果から最終公開結果への境界。
 * @security 固定理由だけを公開する。
 * @compatibility 利用側は宣言済みの最終理由だけへ依存する。
 */
type DockerProcessControllerFinalReason =
  | DockerProcessControllerPublicCompletionReason
  | "provider_operation_completed"
  | "provider_operation_cancelled";

/**
 * 値がDocker Process Controllerの公開完了理由か判定する。
 *
 * @responsibility 下位結果の未知文字列をOwner Registry由来の固定理由から分離する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns 固定Registryにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の観測値を受け取る。
 * @postcondition trueの場合、値をDockerProcessControllerPublicCompletionReasonとして扱える。
 * @effect N/A: 不変Registryを参照するだけである。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で理由を許可しない。
 * @boundary 下位Provider結果からDocker Process Controller公開結果への診断境界。
 * @security 生出力または自由文を公開理由へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function isDockerProcessControllerPublicCompletionReason(
  value: unknown,
): value is DockerProcessControllerPublicCompletionReason {
  return typeof value === "string" && blockedCompletionReasons.has(value);
}
const SAFE_IDENTIFIER =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;

/**
 * docker-process-controllerで使用するCommandの値契約を定義する。
 *
 * @responsibility CommandのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Commandが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commandで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commandの宣言は外部境界を開かない。
 * @security CommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Commandの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Command = Readonly<{ purpose: string; argv: readonly string[] }>;
/**
 * docker-process-controllerで使用するPrepared Planの値契約を定義する。
 *
 * @responsibility Prepared PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PreparedPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparedPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparedPlanの宣言は外部境界を開かない。
 * @security PreparedPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PreparedPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PreparedPlan = Readonly<{
  provider: "codex" | "claude";
  operationId: string;
  recoveryCorrelationId?: string | null;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  operationMode: "boolean_probe" | "isolated_task";
  taskRole: "executor" | "reviewer" | null;
  taskWorkload?: unknown;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;
/**
 * docker-process-controllerで使用するCommand Executionの値契約を定義する。
 *
 * @responsibility Command ExecutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CommandExecutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandExecutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandExecutionの宣言は外部境界を開かない。
 * @security CommandExecutionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandExecutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CommandExecution = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;
/**
 * docker-process-controllerで使用するCommand Handleの値契約を定義する。
 *
 * @responsibility Command HandleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandHandleの宣言は外部境界を開かない。
 * @security CommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CommandHandle = Readonly<{
  started: (timeoutMs: number) => Promise<boolean>;
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;
/**
 * docker-process-controllerで使用する回復の値契約を定義する。
 *
 * @responsibility 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Recoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Recoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: Recoveryの宣言は外部境界を開かない。
 * @security RecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Recoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Recovery = Readonly<{
  status: "ready";
  recoveryId: string;
  recoveryCapability: object;
}>;
/**
 * docker-process-controllerで使用するBlocked 回復の値契約を定義する。
 *
 * @responsibility Blocked 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape BlockedRecoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BlockedRecoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: BlockedRecoveryの宣言は外部境界を開かない。
 * @security BlockedRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility BlockedRecoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type BlockedRecovery = Readonly<{
  status: "blocked";
  reason?: string;
  recoveryId: string | null;
  manualRecoveryRequired?: boolean;
}>;
/**
 * docker-process-controllerで使用する清掃 Observationの値契約を定義する。
 *
 * @responsibility 清掃 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CleanupObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CleanupObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CleanupObservationの宣言は外部境界を開かない。
 * @security CleanupObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CleanupObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CleanupObservation = Readonly<{
  confirmed: boolean;
  processTreeTerminated: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
}>;
/**
 * docker-process-controllerで使用するProvider Process Started Noticeの値契約を定義する。
 *
 * @responsibility Provider Process Started NoticeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProviderProcessStartedNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderProcessStartedNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderProcessStartedNoticeの宣言は外部境界を開かない。
 * @security ProviderProcessStartedNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderProcessStartedNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProviderProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;
/**
 * docker-process-controllerで使用するProvider Boundary Diagnostic Noticeの値契約を定義する。
 *
 * @responsibility Provider Boundary Diagnostic NoticeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProviderBoundaryDiagnosticNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderBoundaryDiagnosticNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderBoundaryDiagnosticNoticeの宣言は外部境界を開かない。
 * @security ProviderBoundaryDiagnosticNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderBoundaryDiagnosticNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProviderBoundaryDiagnosticNotice =
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
      rootFilesystemReadOnlyConfigured: boolean;
      nonRootUserConfigured: boolean;
      workdirConfigured: boolean;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_settled";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
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
    }>;
/**
 * docker-process-controllerで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  effectExecutorAvailable: boolean;
  verifyRevision: (managementCapability: unknown) => unknown;
  consumePreparedPlan: (
    preparedCapability: unknown,
    managementCapability: unknown,
  ) => PreparedPlan | null;
  beginRecovery: (
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => Recovery | BlockedRecovery | null;
  abandonRecovery?: (recoveryCapability: object) => boolean;
  verifyRecoveryBinding: (
    recoveryCapability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    stableLogicalHomeBindingHash: unknown,
  ) => boolean;
  startCommand: (
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => CommandHandle;
  cleanupOwnedResources: (
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<CleanupObservation>;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeRecovery: (
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Readonly<{
    status: string;
    recoveryFinalizationCapability?: object;
  }>;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
  ) => boolean;
  recordDockerAbsence?: (recoveryCapability: object) => boolean;
  recordMountCompletion?: (recoveryCapability: object) => boolean;
  reportProviderProcessStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => Promise<boolean>;
  reportProviderBoundaryDiagnostic?: (
    notice: ProviderBoundaryDiagnosticNotice,
  ) => Promise<boolean>;
  consumeProviderAuthority: (
    useCapability: unknown,
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    operationId: string;
    provider: string;
    profileId: string;
    providerHomeMountGrantRef: string;
    runtimeAuthorityIssued: true;
    providerEffectAllowed: true;
  }> | null;
}>;

/**
 * docker-process-controllerで使用するExecution 記録の値契約を定義する。
 *
 * @responsibility Execution 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionRecordの宣言は外部境界を開かない。
 * @security ExecutionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionRecord = {
  managementCapability: object;
  commandRestriction: unknown;
  cancellationRequested: boolean;
  activeHandle: CommandHandle | null;
  completion: Promise<ExecutionResult> | null;
};
/**
 * docker-process-controllerで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ExecutionRecord>;
}>;
/**
 * docker-process-controllerで使用するExecution 結果の値契約を定義する。
 *
 * @responsibility Execution 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionResultの宣言は外部境界を開かない。
 * @security ExecutionResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionResult = ReturnType<typeof createFinalResult>;

/**
 * Runtime 所有 Lifecycle Notice Reporterを構築する。
 *
 * @responsibility Runtime 所有 Lifecycle Notice Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input stream: Writable
 * @returns createRuntimeOwnedLifecycleNoticeReporterの計算結果を返す。
 * @precondition 「stream: Writable」がcreateRuntimeOwnedLifecycleNoticeReporterの入力契約を満たす。
 * @postcondition createRuntimeOwnedLifecycleNoticeReporterの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeOwnedLifecycleNoticeReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeOwnedLifecycleNoticeReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeOwnedLifecycleNoticeReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createRuntimeOwnedLifecycleNoticeReporterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createRuntimeOwnedLifecycleNoticeReporterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createRuntimeOwnedLifecycleNoticeReporter(stream: Writable) {
  return (
    notice: ProviderProcessStartedNotice | ProviderBoundaryDiagnosticNotice,
  ): Promise<boolean> => {
    if (!stream.writable || stream.destroyed) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => settle(false), CANCELLATION_GRACE_MS);
      const settle = (isValue: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stream.off("error", onFailure);
        stream.off("close", onFailure);
        resolve(isValue);
      };
      const onFailure = () => settle(false);
      stream.once("error", onFailure);
      stream.once("close", onFailure);
      try {
        stream.write(
          `[Coordinator lifecycle] ${JSON.stringify(notice)}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle(true);
          },
        );
      } catch {
        settle(false);
      }
    });
  };
}

/**
 * argument Afterを決定する。
 *
 * @responsibility argument Afterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input argv: readonly string[]、key: string
 * @returns argumentAfterの計算結果を返す。
 * @precondition 「argv: readonly string[]、key: string」がargumentAfterの入力契約を満たす。
 * @postcondition argumentAfterの責務を完了した結果だけを返す。
 * @effect N/A: argumentAfterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: argumentAfterは独自の失敗分岐を所有しない。
 * @invariant argumentAfterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security argumentAfterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: argumentAfterは共有非同期状態を持たない同期処理である。
 */
function argumentAfter(argv: readonly string[], key: string) {
  const index = argv.indexOf(key);
  return index >= 0 ? argv[index + 1] : undefined;
}

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
function providerBoundaryConfiguration(
  plan: PreparedPlan,
): Extract<
  ProviderBoundaryDiagnosticNotice,
  { event: "coordinator_provider_boundary_configured" }
> {
  const createProvider = plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  const argv = createProvider?.argv ?? [];
  const approvalModeConfigured =
    plan.provider !== "codex"
      ? "not_applicable"
      : argv.includes("--approve-for-me")
        ? "approve_for_me"
        : argv.some((value) => value === 'approval_policy="never"')
          ? "never"
          : "other";
  const sandbox = argumentAfter(argv, "--sandbox");
  const sandboxModeConfigured =
    plan.provider !== "codex"
      ? "not_applicable"
      : sandbox === "read-only"
        ? "read_only"
        : sandbox === undefined
          ? "implicit"
          : "other";
  return Object.freeze({
    event: "coordinator_provider_boundary_configured" as const,
    taskRole: plan.taskRole,
    provider: plan.provider,
    operationId: plan.operationId,
    approvalModeConfigured,
    sandboxModeConfigured,
    workspaceMountModeConfigured: plan.workspaceMountMode,
    rootFilesystemReadOnlyConfigured: argv.includes("--read-only"),
    nonRootUserConfigured:
      argumentAfter(argv, "--user") === "65534:65534" ||
      argv.includes("--user=65534:65534"),
    workdirConfigured:
      argumentAfter(argv, "--workdir") === "/work" ||
      argv.includes("--workdir=/work"),
  });
}

/**
 * provider Process Exit Status Classを決定する。
 *
 * @responsibility provider Process Exit Status Classの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input execution: CommandExecution | null
 * @returns providerProcessExitStatusClassの計算結果を返す。
 * @precondition 「execution: CommandExecution | null」がproviderProcessExitStatusClassの入力契約を満たす。
 * @postcondition providerProcessExitStatusClassの責務を完了した結果だけを返す。
 * @effect N/A: providerProcessExitStatusClassは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerProcessExitStatusClassは独自の失敗分岐を所有しない。
 * @invariant providerProcessExitStatusClassは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security providerProcessExitStatusClassはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerProcessExitStatusClassは共有非同期状態を持たない同期処理である。
 */
function providerProcessExitStatusClass(execution: CommandExecution | null) {
  if (!execution) return "not_observed" as const;
  if (execution.signal !== null) return "signal" as const;
  if (execution.status === 0) return "zero" as const;
  if (execution.status === 1) return "one" as const;
  if (execution.status === 126) return "one_two_six" as const;
  if (execution.status === 127) return "one_two_seven" as const;
  return execution.status === null
    ? ("not_observed" as const)
    : ("other_nonzero" as const);
}

/**
 * Passive Boundary Diagnosticを診断結果として報告する。
 *
 * @responsibility Passive Boundary Diagnosticの公開field、相関Identity、機密を含めない結果境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、notice: ProviderBoundaryDiagnosticNotice
 * @returns N/A: reportPassiveBoundaryDiagnosticは戻り値を返さない。
 * @precondition 「state: RuntimeState、notice: ProviderBoundaryDiagnosticNotice」がreportPassiveBoundaryDiagnosticの入力契約を満たす。
 * @postcondition reportPassiveBoundaryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: reportPassiveBoundaryDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure reportPassiveBoundaryDiagnosticは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reportPassiveBoundaryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security reportPassiveBoundaryDiagnosticはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reportPassiveBoundaryDiagnosticは共有非同期状態を持たない同期処理である。
 */
function reportPassiveBoundaryDiagnostic(
  state: RuntimeState,
  notice: ProviderBoundaryDiagnosticNotice,
) {
  try {
    const pending =
      state.dependencies.reportProviderBoundaryDiagnostic?.(notice);
    if (pending) void pending.catch(() => {});
  } catch {
    // Diagnostics cannot grant authority or change the operation result.
  }
}

const BLOCKED_START_KEYS = Object.freeze([
  "cleanupConfirmed",
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "normalizedResult",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);
const STARTED_KEYS = Object.freeze([
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "normalizedResult",
  "normalizedResultReportedAfterCleanupOnly",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);
const COMPLETION_KEYS = Object.freeze([
  "cancellationRequested",
  "cleanupConfirmed",
  "containersAbsent",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "mountLeaseReleased",
  "networksAbsent",
  "normalizedResult",
  "operationId",
  "processTreeTerminationConfirmed",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryCompleted",
  "recoveryFinalizationCapability",
  "recoveryId",
  "resultBytes",
  "resultSha256",
  "selectionRecordId",
  "status",
  "subscriptionAuthConfirmed",
  "untrustedProviderTextReported",
]);

/**
 * own Data Valueを決定する。
 *
 * @responsibility own Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns unknownを返す。
 * @precondition 「value: unknown、key: string」がownDataValueの入力契約を満たす。
 * @postcondition ownDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataValueは共有非同期状態を持たない同期処理である。
 */
function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Plain 記録が完全一致するか判定する。
 *
 * @responsibility Plain 記録の比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedKeys: readonly string[]
 * @returns exactPlainRecordの計算結果を返す。
 * @precondition 「value: unknown、expectedKeys: readonly string[]」がexactPlainRecordの入力契約を満たす。
 * @postcondition exactPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure exactPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security exactPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactPlainRecordは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecord(value: unknown, expectedKeys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  )
    return null;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== "string") ||
      (keys as string[]).sort().join("\0") !==
        [...expectedKeys].sort().join("\0")
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries: [string, unknown][] = [];
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      )
        return null;
      entries.push([key, descriptor.value]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } catch {
    return null;
  }
}

/**
 * Producer-owned exact projection for the controller's synchronous result.
 *
 * @responsibility Docker Process Controller Start 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown」がprojectDockerProcessControllerStartResultの入力契約を満たす。
 * @postcondition projectDockerProcessControllerStartResultの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerProcessControllerStartResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerProcessControllerStartResultは独自の失敗分岐を所有しない。
 * @invariant projectDockerProcessControllerStartResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectDockerProcessControllerStartResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency projectDockerProcessControllerStartResultは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function projectDockerProcessControllerStartResult(
  value: unknown,
  handedOffRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const blockedRecord = exactPlainRecord(value, BLOCKED_START_KEYS);
  if (blockedRecord && ownDataValue(blockedRecord, "status") === "blocked") {
    const record = blockedRecord;
    const rawRecoveryId = ownDataValue(record, "recoveryId");
    const recoveryId =
      rawRecoveryId === null
        ? null
        : publicVerifiedDockerRecoveryId(rawRecoveryId);
    const cleanupConfirmed = ownDataValue(record, "cleanupConfirmed");
    const manualRecoveryRequired = ownDataValue(
      record,
      "manualRecoveryRequired",
    );
    return record &&
      typeof ownDataValue(record, "reason") === "string" &&
      ownDataValue(record, "controlCapability") === null &&
      ownDataValue(record, "completion") === null &&
      ownDataValue(record, "operationId") === null &&
      typeof cleanupConfirmed === "boolean" &&
      typeof manualRecoveryRequired === "boolean" &&
      (cleanupConfirmed === true || manualRecoveryRequired === true) &&
      (recoveryId === null || manualRecoveryRequired === true) &&
      ownDataValue(record, "dockerEffectStarted") === false &&
      ownDataValue(record, "providerRequestStarted") === false &&
      ownDataValue(record, "normalizedResult") === null &&
      ownDataValue(record, "rawOutputReported") === false &&
      ownDataValue(record, "untrustedProviderTextReported") === false &&
      ownDataValue(record, "credentialAbsenceVerified") === false &&
      ownDataValue(record, "hostPathReported") === false &&
      ownDataValue(record, "proxyCredentialReported") === false &&
      recoveryId === rawRecoveryId
      ? Object.freeze({ ...record, recoveryId })
      : null;
  }
  const record = exactPlainRecord(value, STARTED_KEYS);
  const status = ownDataValue(record, "status");
  const recoveryId = publicVerifiedDockerRecoveryId(
    ownDataValue(record, "recoveryId"),
  );
  return record &&
    status === "started" &&
    typeof ownDataValue(record, "reason") === "string" &&
    typeof ownDataValue(record, "operationId") === "string" &&
    (expectedOperationId === undefined ||
      ownDataValue(record, "operationId") === expectedOperationId) &&
    ownDataValue(record, "controlCapability") !== null &&
    typeof ownDataValue(record, "controlCapability") === "object" &&
    ownDataValue(record, "completion") instanceof Promise &&
    ownDataValue(record, "dockerEffectStarted") === true &&
    ownDataValue(record, "providerRequestStarted") === false &&
    ownDataValue(record, "normalizedResult") === null &&
    ownDataValue(record, "normalizedResultReportedAfterCleanupOnly") === true &&
    ownDataValue(record, "rawOutputReported") === false &&
    ownDataValue(record, "untrustedProviderTextReported") === false &&
    ownDataValue(record, "credentialAbsenceVerified") === false &&
    ownDataValue(record, "hostPathReported") === false &&
    ownDataValue(record, "proxyCredentialReported") === false &&
    recoveryId !== null &&
    recoveryId === handedOffRecoveryId
    ? Object.freeze({ ...record, recoveryId })
    : null;
}

/**
 * Producer-owned exact projection for the controller's asynchronous result.
 *
 * @responsibility Docker Process Controller Completion 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown」がprojectDockerProcessControllerCompletionResultの入力契約を満たす。
 * @postcondition projectDockerProcessControllerCompletionResultの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerProcessControllerCompletionResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerProcessControllerCompletionResultは独自の失敗分岐を所有しない。
 * @invariant projectDockerProcessControllerCompletionResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectDockerProcessControllerCompletionResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDockerProcessControllerCompletionResultは共有非同期状態を持たない同期処理である。
 */
export function projectDockerProcessControllerCompletionResult(
  value: unknown,
  expectedRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const record = exactPlainRecord(value, COMPLETION_KEYS);
  if (!record) return null;
  const status = ownDataValue(record, "status");
  const cleanupConfirmed = ownDataValue(record, "cleanupConfirmed");
  const manualRecoveryRequired = ownDataValue(record, "manualRecoveryRequired");
  const rawRecoveryId = ownDataValue(record, "recoveryId");
  const recoveryId =
    rawRecoveryId === null
      ? null
      : publicVerifiedDockerRecoveryId(rawRecoveryId);
  const expected = publicVerifiedDockerRecoveryId(expectedRecoveryId);
  const processTreeTerminated = ownDataValue(
    record,
    "processTreeTerminationConfirmed",
  );
  const containersAbsent = ownDataValue(record, "containersAbsent");
  const networksAbsent = ownDataValue(record, "networksAbsent");
  const mountLeaseReleased = ownDataValue(record, "mountLeaseReleased");
  const recoveryCompleted = ownDataValue(record, "recoveryCompleted");
  const isCleanupFromResources =
    processTreeTerminated === true &&
    containersAbsent === true &&
    networksAbsent === true &&
    mountLeaseReleased === true &&
    recoveryCompleted === true;
  const providerRequestStarted = ownDataValue(record, "providerRequestStarted");
  const cancellationRequested = ownDataValue(record, "cancellationRequested");
  const normalizedResult = ownDataValue(record, "normalizedResult");
  const resultSha256 = ownDataValue(record, "resultSha256");
  const resultBytes = ownDataValue(record, "resultBytes");
  const subscriptionAuthConfirmed = ownDataValue(
    record,
    "subscriptionAuthConfirmed",
  );
  const recoveryFinalizationCapability = ownDataValue(
    record,
    "recoveryFinalizationCapability",
  );
  const reason = ownDataValue(record, "reason");
  if (
    (status !== "completed" &&
      status !== "blocked" &&
      status !== "cancelled") ||
    typeof reason !== "string" ||
    typeof cleanupConfirmed !== "boolean" ||
    typeof manualRecoveryRequired !== "boolean" ||
    typeof ownDataValue(record, "operationId") !== "string" ||
    (expectedOperationId !== undefined &&
      ownDataValue(record, "operationId") !== expectedOperationId) ||
    typeof ownDataValue(record, "selectionRecordId") !== "string" ||
    ownDataValue(record, "dockerEffectStarted") !== true ||
    typeof providerRequestStarted !== "boolean" ||
    typeof cancellationRequested !== "boolean" ||
    typeof processTreeTerminated !== "boolean" ||
    typeof containersAbsent !== "boolean" ||
    typeof networksAbsent !== "boolean" ||
    typeof mountLeaseReleased !== "boolean" ||
    typeof recoveryCompleted !== "boolean" ||
    cleanupConfirmed !== isCleanupFromResources ||
    !Number.isSafeInteger(resultBytes) ||
    (resultBytes as number) < 0 ||
    (resultSha256 !== null &&
      (typeof resultSha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(resultSha256))) ||
    (recoveryFinalizationCapability !== null &&
      typeof recoveryFinalizationCapability !== "object") ||
    typeof subscriptionAuthConfirmed !== "boolean" ||
    ownDataValue(record, "rawOutputReported") !== false ||
    ownDataValue(record, "untrustedProviderTextReported") !== false ||
    ownDataValue(record, "credentialAbsenceVerified") !== false ||
    ownDataValue(record, "hostPathReported") !== false ||
    ownDataValue(record, "proxyCredentialReported") !== false ||
    !expected ||
    (cleanupConfirmed === true
      ? recoveryId !== null || manualRecoveryRequired !== false
      : recoveryId !== expected ||
        manualRecoveryRequired !== true ||
        status !== "blocked" ||
        reason !== "docker_process_controller_cleanup_unconfirmed" ||
        normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0 ||
        recoveryFinalizationCapability !== null) ||
    (cleanupConfirmed === true &&
      (recoveryFinalizationCapability === null ||
        typeof recoveryFinalizationCapability !== "object")) ||
    (status === "completed"
      ? reason !== "provider_operation_completed" ||
        providerRequestStarted !== true ||
        cancellationRequested !== false ||
        subscriptionAuthConfirmed !== true ||
        normalizedResult === null ||
        typeof normalizedResult !== "object" ||
        typeof resultSha256 !== "string" ||
        resultBytes === 0
      : normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0) ||
    (status === "cancelled" &&
      (reason !== "provider_operation_cancelled" ||
        cancellationRequested !== true)) ||
    (status === "blocked" &&
      cleanupConfirmed === true &&
      !blockedCompletionReasons.has(reason))
  )
    return null;
  return Object.freeze({ ...record, recoveryId });
}

/**
 * Ready 回復を所有Snapshotへ変換する。
 *
 * @responsibility Ready 回復の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns Recovery | nullを返す。
 * @precondition 「value: unknown」がsnapshotReadyRecoveryの入力契約を満たす。
 * @postcondition snapshotReadyRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: snapshotReadyRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotReadyRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotReadyRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotReadyRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotReadyRecoveryは共有非同期状態を持たない同期処理である。
 */
function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

/**
 * Blocked 回復 With Exact Idを所有Snapshotへ変換する。
 *
 * @responsibility Blocked 回復 With Exact Idの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedStableLogicalHomeBindingHash: string
 * @returns snapshotBlockedRecoveryWithExactIdの計算結果を返す。
 * @precondition 「value: unknown、expectedStableLogicalHomeBindingHash: string」がsnapshotBlockedRecoveryWithExactIdの入力契約を満たす。
 * @postcondition snapshotBlockedRecoveryWithExactIdの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBlockedRecoveryWithExactIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBlockedRecoveryWithExactIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBlockedRecoveryWithExactIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotBlockedRecoveryWithExactIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBlockedRecoveryWithExactIdは共有非同期状態を持たない同期処理である。
 */
function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["reason", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = publicVerifiedDockerRecoveryId(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({ status, reason, recoveryId })
    : null;
}

/**
 * Blocked Startを構築する。
 *
 * @responsibility Blocked Startの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、preEffectCleanupConfirmed、recoveryId: string | null、lowerManualRecoveryRequired
 * @returns createBlockedStartの計算結果を返す。
 * @precondition 「reason: string、preEffectCleanupConfirmed、recoveryId: string | null、lowerManualRecoveryRequired」がcreateBlockedStartの入力契約を満たす。
 * @postcondition createBlockedStartの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedStartは独自の失敗分岐を所有しない。
 * @invariant createBlockedStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createBlockedStartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedStartは共有非同期状態を持たない同期処理である。
 */
function createBlockedStart(
  reason: string,
  preEffectCleanupConfirmed = false,
  recoveryId: string | null = null,
  lowerManualRecoveryRequired = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId,
    cleanupConfirmed: preEffectCleanupConfirmed,
    manualRecoveryRequired:
      lowerManualRecoveryRequired ||
      !preEffectCleanupConfirmed ||
      recoveryId !== null,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * Invalid 回復 Startを終端状態へ確定する。
 *
 * @responsibility Invalid 回復 Startの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、plan: PreparedPlan、managementCapability: object、recoveryCapability: unknown、recoveryId: string | null、reason: string
 * @returns settleInvalidRecoveryStartの計算結果を返す。
 * @precondition 「state: RuntimeState、plan: PreparedPlan、managementCapability: object、recoveryCapability: unknown、recoveryId: string | null、reason: string」がsettleInvalidRecoveryStartの入力契約を満たす。
 * @postcondition settleInvalidRecoveryStartの責務を完了した結果だけを返す。
 * @effect N/A: settleInvalidRecoveryStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure settleInvalidRecoveryStartは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleInvalidRecoveryStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security settleInvalidRecoveryStartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleInvalidRecoveryStartは共有非同期状態を持たない同期処理である。
 */
function settleInvalidRecoveryStart(
  state: RuntimeState,
  plan: PreparedPlan,
  managementCapability: object,
  recoveryCapability: unknown,
  recoveryId: string | null,
  reason: string,
) {
  if (recoveryCapability && typeof recoveryCapability === "object") {
    try {
      state.dependencies.abandonRecovery?.(recoveryCapability);
    } catch {}
  }
  try {
    state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
  } catch {}
  return createBlockedStart(reason, false, recoveryId, true);
}

/**
 * Final 結果を構築する。
 *
 * @responsibility Final 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input status: "completed" | "blocked" | "cancelled"、reason: DockerProcessControllerFinalReason、plan: PreparedPlan、recoveryId: string、details: Readonly<{ providerRequestStarted: boolean; cancellationRequested: boolean; processTreeTerminationConfirmed: boolean; containersAbsent: boolean; networksAbsent: boolean; mountLeaseReleased: boolean; recoveryCompleted: boolean; resultSha256: string | null; resultBytes: number; normalizedResult: unknown | null; subscriptionAuthConfirmed: boolean; recoveryFinalizationCapability: object | null; }>
 * @returns createFinalResultの計算結果を返す。
 * @precondition 「status: "completed" | "blocked" | "cancelled"、reason: DockerProcessControllerFinalReason、plan: PreparedPlan、recoveryId: string、details: Readonly<{ providerRequestStarted: boolean; cancellationRequested: boolean; processTreeTerminationConfirmed: boolean; containersAbsent: boolean; networksAbsent: boolean; mountLeaseReleased: boolean; recoveryCompleted: boolean; resultSha256: string | null; resultBytes: number; normalizedResult: unknown | null; subscriptionAuthConfirmed: boolean; recoveryFinalizationCapability: object | null; }>」がcreateFinalResultの入力契約を満たす。
 * @postcondition createFinalResultの責務を完了した結果だけを返す。
 * @effect N/A: createFinalResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFinalResultは独自の失敗分岐を所有しない。
 * @invariant createFinalResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createFinalResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFinalResultは共有非同期状態を持たない同期処理である。
 */
function createFinalResult(
  status: "completed" | "blocked" | "cancelled",
  reason: DockerProcessControllerFinalReason,
  plan: PreparedPlan,
  recoveryId: string,
  details: Readonly<{
    providerRequestStarted: boolean;
    cancellationRequested: boolean;
    processTreeTerminationConfirmed: boolean;
    containersAbsent: boolean;
    networksAbsent: boolean;
    mountLeaseReleased: boolean;
    recoveryCompleted: boolean;
    resultSha256: string | null;
    resultBytes: number;
    normalizedResult: unknown | null;
    subscriptionAuthConfirmed: boolean;
    recoveryFinalizationCapability: object | null;
  }>,
) {
  const cleanupConfirmed =
    details.processTreeTerminationConfirmed &&
    details.containersAbsent &&
    details.networksAbsent &&
    details.mountLeaseReleased &&
    details.recoveryCompleted;
  return Object.freeze({
    status: cleanupConfirmed ? status : ("blocked" as const),
    reason: cleanupConfirmed
      ? reason
      : "docker_process_controller_cleanup_unconfirmed",
    operationId: plan.operationId,
    selectionRecordId: plan.selectionRecordId,
    recoveryId: cleanupConfirmed ? null : recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    dockerEffectStarted: true,
    providerRequestStarted: details.providerRequestStarted,
    cancellationRequested: details.cancellationRequested,
    processTreeTerminationConfirmed: details.processTreeTerminationConfirmed,
    containersAbsent: details.containersAbsent,
    networksAbsent: details.networksAbsent,
    mountLeaseReleased: details.mountLeaseReleased,
    recoveryCompleted: details.recoveryCompleted,
    cleanupConfirmed,
    resultSha256:
      cleanupConfirmed && status === "completed" ? details.resultSha256 : null,
    resultBytes:
      cleanupConfirmed && status === "completed" ? details.resultBytes : 0,
    normalizedResult:
      cleanupConfirmed && status === "completed"
        ? details.normalizedResult
        : null,
    subscriptionAuthConfirmed: details.subscriptionAuthConfirmed,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    recoveryFinalizationCapability: cleanupConfirmed
      ? details.recoveryFinalizationCapability
      : null,
  });
}

/**
 * Plan Validかを判定する。
 *
 * @responsibility Plan Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan
 * @returns isPlanValidの計算結果を返す。
 * @precondition 「plan: PreparedPlan」がisPlanValidの入力契約を満たす。
 * @postcondition isPlanValidの責務を完了した結果だけを返す。
 * @effect N/A: isPlanValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlanValidは独自の失敗分岐を所有しない。
 * @invariant isPlanValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlanValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlanValidは共有非同期状態を持たない同期処理である。
 */
function isPlanValid(plan: PreparedPlan) {
  const isTaskPlan = plan.operationMode === "isolated_task";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    (plan.recoveryCorrelationId == null ||
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(plan.recoveryCorrelationId)) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
    /^MODELSEL-[A-Z0-9-]{8,80}$/u.test(plan.selectionRecordId) &&
    plan.subscriptionOffering ===
      (plan.provider === "codex"
        ? "chatgpt_subscription_oauth"
        : "claude_max") &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    plan.authorityUseCapability !== null &&
    typeof plan.authorityUseCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan) &&
    (isTaskPlan
      ? (plan.taskRole === "executor" || plan.taskRole === "reviewer") &&
        /^TASKPKT-[A-F0-9]{32}$/u.test(plan.taskPacketRef ?? "") &&
        /^[a-f0-9]{64}$/u.test(plan.taskPacketHash ?? "") &&
        typeof plan.providerInput === "string" &&
        plan.providerInput.length > 0 &&
        typeof plan.workspaceSourcePath === "string" &&
        plan.workspaceSourcePath.length > 0 &&
        plan.workspaceMountMode ===
          (plan.taskRole === "executor" ? "read_write" : "read_only")
      : plan.taskRole === null &&
        plan.taskPacketRef === null &&
        plan.taskPacketHash === null &&
        plan.providerInput === null &&
        plan.workspaceSourcePath === null &&
        plan.workspaceMountMode === null) &&
    [
      plan.providerContainerName,
      plan.authContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].every((value) => SAFE_IDENTIFIER.test(value)) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(plan.ownershipLabel) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === PURPOSES[index] &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(
          (value: unknown) =>
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\0"),
        ),
    )
  );
}

/**
 * subscription Auth Confirmedを決定する。
 *
 * @responsibility subscription Auth Confirmedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input provider: "codex" | "claude"、expectedOffering: "chatgpt_subscription_oauth" | "claude_max"、stdout: string、stderr: string
 * @returns subscriptionAuthConfirmedの計算結果を返す。
 * @precondition 「provider: "codex" | "claude"、expectedOffering: "chatgpt_subscription_oauth" | "claude_max"、stdout: string、stderr: string」がsubscriptionAuthConfirmedの入力契約を満たす。
 * @postcondition subscriptionAuthConfirmedの責務を完了した結果だけを返す。
 * @effect N/A: subscriptionAuthConfirmedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: subscriptionAuthConfirmedは独自の失敗分岐を所有しない。
 * @invariant subscriptionAuthConfirmedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security subscriptionAuthConfirmedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: subscriptionAuthConfirmedは共有非同期状態を持たない同期処理である。
 */
function subscriptionAuthConfirmed(
  provider: "codex" | "claude",
  expectedOffering: "chatgpt_subscription_oauth" | "claude_max",
  stdout: string,
  stderr: string,
) {
  if (provider === "codex") {
    if (expectedOffering !== "chatgpt_subscription_oauth") return false;
    const normalize = (value: string) => {
      if (value.includes("\0")) return null;
      const normalized = value.replaceAll("\r\n", "\n");
      if (normalized.includes("\r")) return null;
      return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
    };
    const normalizedStdout = normalize(stdout);
    const normalizedStderr = normalize(stderr);
    if (normalizedStdout === null || normalizedStderr === null) return false;
    const status = "Logged in using ChatGPT";
    const readOnlyAliasWarning =
      "WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)";
    return (
      (normalizedStdout === status && normalizedStderr === "") ||
      (normalizedStdout === "" && normalizedStderr === status) ||
      (normalizedStdout === status &&
        normalizedStderr === readOnlyAliasWarning) ||
      (normalizedStdout === "" &&
        normalizedStderr === `${readOnlyAliasWarning}\n${status}`)
    );
  }
  if (expectedOffering !== "claude_max") return false;
  const parsed = parseUnambiguousJsonDocument(stdout);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return false;
  const status = parsed as Record<string, unknown>;
  return (
    status.loggedIn === true &&
    status.authMethod === "claude.ai" &&
    status.apiProvider === "firstParty" &&
    status.forcedLoginMethod === "claudeai" &&
    status.subscriptionType === "max"
  );
}

/**
 * Executionを分類する。
 *
 * @responsibility Executionの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input execution: CommandExecution | null、purpose: string、provider: "codex" | "claude"
 * @returns classifyExecutionの計算結果を返す。
 * @precondition 「execution: CommandExecution | null、purpose: string、provider: "codex" | "claude"」がclassifyExecutionの入力契約を満たす。
 * @postcondition classifyExecutionの責務を完了した結果だけを返す。
 * @effect N/A: classifyExecutionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyExecutionは独自の失敗分岐を所有しない。
 * @invariant classifyExecutionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security classifyExecutionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyExecutionは共有非同期状態を持たない同期処理である。
 */
function classifyExecution(
  execution: CommandExecution | null,
  purpose: string,
  provider: "codex" | "claude",
) {
  const isProvider = purpose === "start_provider_attached";
  if (execution === null)
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? "provider_deadline_exceeded"
        : "docker_setup_deadline_exceeded",
    });
  const stdoutBytes = Buffer.byteLength(execution.stdout, "utf8");
  const stderrBytes = Buffer.byteLength(execution.stderr, "utf8");
  if (
    execution.outputExceeded ||
    stdoutBytes > STDOUT_LIMIT_BYTES ||
    stderrBytes > STDERR_LIMIT_BYTES
  ) {
    return Object.freeze({
      ok: false,
      reason: "provider_output_limit_exceeded",
    });
  }
  if (execution.signal !== null)
    return Object.freeze({ ok: false, reason: "provider_process_signalled" });
  if (execution.status !== 0)
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? classifyProviderNonzeroExit(provider, execution)
        : isDockerSetupCommandPurpose(purpose)
          ? SETUP_COMMAND_FAILURE_REASONS[purpose]
          : "docker_setup_command_failed",
    });
  return Object.freeze({
    ok: true,
    reason: "command_completed",
    stdoutBytes,
  });
}

/**
 * Provider Nonzero Exitを分類する。
 *
 * @responsibility Provider Nonzero Exitの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input provider: "codex" | "claude"、execution: CommandExecution
 * @returns classifyProviderNonzeroExitの計算結果を返す。
 * @precondition 「provider: "codex" | "claude"、execution: CommandExecution」がclassifyProviderNonzeroExitの入力契約を満たす。
 * @postcondition classifyProviderNonzeroExitの責務を完了した結果だけを返す。
 * @effect N/A: classifyProviderNonzeroExitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyProviderNonzeroExitは独自の失敗分岐を所有しない。
 * @invariant classifyProviderNonzeroExitは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security classifyProviderNonzeroExitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyProviderNonzeroExitは共有非同期状態を持たない同期処理である。
 */
function classifyProviderNonzeroExit(
  provider: "codex" | "claude",
  execution: CommandExecution,
) {
  if (provider === "claude") {
    const envelope = parseUnambiguousJsonDocument(execution.stdout);
    if (
      envelope &&
      typeof envelope === "object" &&
      !Array.isArray(envelope) &&
      (envelope as Record<string, unknown>).type === "result"
    ) {
      const subtype = (envelope as Record<string, unknown>).subtype;
      if (subtype === "error_max_budget_usd")
        return "provider_operation_budget_exceeded";
      if (subtype === "error_max_turns") return "provider_turn_limit_exceeded";
      if (subtype === "error_max_structured_output_retries")
        return "provider_structured_output_retry_exhausted";
    }
  }
  if (
    execution.stderr.includes("\0") ||
    Buffer.byteLength(execution.stderr, "utf8") > 8_192
  )
    return "provider_process_exit_nonzero";
  const diagnostic = execution.stderr
    .replaceAll("\r\n", "\n")
    .trim()
    .toLowerCase();
  if (
    /(?:usage|rate) limit|quota (?:exceeded|exhausted)|credit balance (?:is )?too low|hit your (?:current )?limit/u.test(
      diagnostic,
    )
  )
    return "provider_subscription_quota_exhausted";
  if (
    /authentication (?:failed|required)|oauth (?:token )?expired|not logged in|please (?:run )?(?:\/login|login)|invalid api key/u.test(
      diagnostic,
    )
  )
    return "provider_authentication_expired";
  if (
    /unknown (?:argument|option)|invalid (?:argument|option)|json schema (?:is )?invalid|unsupported model|model (?:is )?not found/u.test(
      diagnostic,
    )
  )
    return "provider_invocation_rejected";
  if (
    /econn(?:refused|reset)|etimedout|enotfound|network error|connection (?:refused|reset|timed out)|proxy (?:connection )?(?:failed|error)/u.test(
      diagnostic,
    )
  )
    return "provider_network_unavailable";
  if (
    /service unavailable|internal server error|overloaded|temporarily unavailable|(?:http |status (?:code )?)5\d\d/u.test(
      diagnostic,
    )
  )
    return "provider_service_unavailable";
  return "provider_process_exit_nonzero";
}

// This is an additional veto, never an authority source. Do not pass plans,
// credentials or capabilities to it, or use it on the existing cleanup path.
/**
 * command Restriction Allowsを決定する。
 *
 * @responsibility command Restriction Allowsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input restriction: unknown、purpose: string
 * @returns commandRestrictionAllowsの計算結果を返す。
 * @precondition 「restriction: unknown、purpose: string」がcommandRestrictionAllowsの入力契約を満たす。
 * @postcondition commandRestrictionAllowsの責務を完了した結果だけを返す。
 * @effect N/A: commandRestrictionAllowsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure commandRestrictionAllowsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant commandRestrictionAllowsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security commandRestrictionAllowsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency commandRestrictionAllowsは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function commandRestrictionAllows(restriction: unknown, purpose: string) {
  if (restriction === undefined) return true;
  if (
    typeof restriction !== "function" ||
    utilTypes.isProxy(restriction) ||
    utilTypes.isAsyncFunction(restriction)
  )
    return false;
  try {
    const result: unknown = restriction(purpose);
    if (utilTypes.isPromise(result)) {
      // A mistakenly returned native Promise cannot authorize a synchronous
      // launch. Observe rejection without awaiting or invoking a custom then.
      void Promise.prototype.then.call(
        result,
        () => {},
        () => {},
      );
      return false;
    }
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Planを実行する。
 *
 * @responsibility Planの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、record: ExecutionRecord、plan: PreparedPlan、recovery: Recovery
 * @returns executePlanの計算結果を返す。
 * @precondition 「state: RuntimeState、record: ExecutionRecord、plan: PreparedPlan、recovery: Recovery」がexecutePlanの入力契約を満たす。
 * @postcondition executePlanの責務を完了した結果だけを返す。
 * @effect N/A: executePlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executePlanは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executePlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executePlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executePlanは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executePlan(
  state: RuntimeState,
  record: ExecutionRecord,
  plan: PreparedPlan,
  recovery: Recovery,
) {
  let reason: DockerProcessControllerFinalReason =
    "provider_operation_completed";
  let requestedStatus: "completed" | "blocked" | "cancelled" = "completed";
  let providerRequestStarted = false;
  let resultSha256: string | null = null;
  let resultBytes = 0;
  let normalizedResult: unknown | null = null;
  let isSubscriptionAuthConfirmed = false;
  let recoveryFinalizationCapability: object | null = null;
  let wasProviderContainerCreationObserved = false;
  let wasProviderProcessCompletionObserved = false;
  let providerExitStatusClass: ReturnType<
    typeof providerProcessExitStatusClass
  > = "not_observed";

  reportPassiveBoundaryDiagnostic(state, providerBoundaryConfiguration(plan));

  try {
    for (const command of plan.commands) {
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const isProvider = command.purpose === "start_provider_attached";
      if (
        CREATE_PURPOSES.has(command.purpose) &&
        state.dependencies.markResourceSubmission &&
        !state.dependencies.markResourceSubmission(
          recovery.recoveryCapability,
          command.purpose,
        )
      ) {
        requestedStatus = "blocked";
        reason = "docker_resource_submission_record_unavailable";
        break;
      }
      if (
        !commandRestrictionAllows(record.commandRestriction, command.purpose)
      ) {
        requestedStatus = "blocked";
        reason = "docker_process_controller_execution_restricted";
        break;
      }
      // A synchronous restriction can also cause the owner to request cancel.
      // Neither that re-entrancy nor a preceding await may open a new command.
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const handle = state.dependencies.startCommand(
        command,
        plan,
        record.managementCapability,
      );
      record.activeHandle = handle;
      if (isProvider) {
        const processStarted = await handle.started(CANCELLATION_GRACE_MS);
        if (!processStarted) {
          await handle.terminateAndWait(CANCELLATION_GRACE_MS);
          record.activeHandle = null;
          requestedStatus = "blocked";
          reason = "docker_process_controller_provider_start_failed";
          break;
        }
        providerRequestStarted = true;
        let isStartObserved = true;
        try {
          isStartObserved =
            !state.dependencies.reportProviderProcessStarted ||
            (await state.dependencies.reportProviderProcessStarted(
              Object.freeze({
                event: "coordinator_provider_process_started",
                taskRole: plan.taskRole,
                provider: plan.provider,
                operationId: plan.operationId,
              }),
            )) === true;
        } catch {
          isStartObserved = false;
        }
        if (!isStartObserved) {
          record.cancellationRequested = true;
          await handle.terminateAndWait(CANCELLATION_GRACE_MS);
          record.activeHandle = null;
          requestedStatus = "blocked";
          reason =
            "docker_process_controller_provider_start_observation_failed";
          break;
        }
      }
      const execution = await handle.wait(
        isProvider ? PROVIDER_TIMEOUT_MS : SETUP_TIMEOUT_MS,
      );
      record.activeHandle = null;
      // A submitted CREATE can have completed while cancellation was requested.
      // Preserve its validated receipt before stopping; otherwise cleanup loses
      // the exact resource ID. Non-CREATE cancellation keeps its prior ordering.
      if (
        record.cancellationRequested &&
        !CREATE_PURPOSES.has(command.purpose)
      ) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      const classified = classifyExecution(
        execution,
        command.purpose,
        plan.provider,
      );
      if (command.purpose === "create_provider" && classified.ok)
        wasProviderContainerCreationObserved = true;
      if (isProvider) {
        wasProviderProcessCompletionObserved = execution !== null;
        providerExitStatusClass = providerProcessExitStatusClass(execution);
      }
      if (!classified.ok) {
        requestedStatus = "blocked";
        reason = classified.reason;
        if (execution === null)
          await handle.terminateAndWait(CANCELLATION_GRACE_MS);
        break;
      }
      if (
        CREATE_PURPOSES.has(command.purpose) &&
        state.dependencies.recordResourceReceipt &&
        (!execution ||
          !state.dependencies.recordResourceReceipt(
            recovery.recoveryCapability,
            command.purpose,
            execution.stdout,
          ))
      ) {
        requestedStatus = "blocked";
        reason = "docker_resource_receipt_unavailable";
        break;
      }
      if (record.cancellationRequested) {
        requestedStatus = "cancelled";
        reason = "provider_operation_cancelled";
        break;
      }
      if (
        command.purpose === "start_subscription_auth_probe_attached" &&
        execution
      ) {
        if (
          !subscriptionAuthConfirmed(
            plan.provider,
            plan.subscriptionOffering,
            execution.stdout,
            execution.stderr,
          )
        ) {
          requestedStatus = "blocked";
          reason = "provider_subscription_auth_not_confirmed";
          break;
        }
        isSubscriptionAuthConfirmed = true;
      }
      if (isProvider && execution) {
        const providerResult =
          plan.operationMode === "isolated_task"
            ? normalizeProviderTaskStructuredResult(
                plan.provider,
                plan.taskRole,
                plan.selectedEffort,
                execution.stdout,
                plan.taskWorkload,
              )
            : plan.provider === "codex"
              ? normalizeCodexStructuredResult(execution.stdout)
              : normalizeClaudeStructuredResult(execution.stdout);
        if (providerResult.status !== "confirmed") {
          requestedStatus = "blocked";
          reason =
            "reason" in providerResult &&
            isDockerProcessControllerPublicCompletionReason(
              providerResult.reason,
            )
              ? providerResult.reason
              : "provider_result_invalid";
          break;
        }
        normalizedResult = providerResult.normalizedResult;
        resultBytes = classified.stdoutBytes ?? 0;
        resultSha256 = createHash("sha256")
          .update(execution.stdout, "utf8")
          .digest("hex");
      }
    }
  } catch {
    requestedStatus = "blocked";
    reason = "docker_process_controller_execution_failed_closed";
  }

  let cleanup: CleanupObservation = Object.freeze({
    confirmed: false,
    processTreeTerminated: false,
    containersAbsent: false,
    networksAbsent: false,
  });
  try {
    cleanup = await state.dependencies.cleanupOwnedResources(
      plan,
      recovery.recoveryCapability,
      record.managementCapability,
    );
  } catch {
    cleanup = Object.freeze({
      confirmed: false,
      processTreeTerminated: false,
      containersAbsent: false,
      networksAbsent: false,
    });
  }
  const processTreeTerminationConfirmed =
    cleanup.confirmed && cleanup.processTreeTerminated;
  let mountLeaseReleased = false;
  let recoveryCompleted = false;
  if (
    processTreeTerminationConfirmed &&
    cleanup.containersAbsent &&
    cleanup.networksAbsent
  ) {
    try {
      const dockerAbsenceRecorded =
        !state.dependencies.recordDockerAbsence ||
        state.dependencies.recordDockerAbsence(recovery.recoveryCapability);
      if (!dockerAbsenceRecorded)
        throw new Error("docker_absence_record_failed");
      mountLeaseReleased =
        state.dependencies.completeMount(
          plan.activeMountCapability,
          record.managementCapability,
        ).status === "completed";
      if (mountLeaseReleased) {
        const mountCompletionRecorded =
          !state.dependencies.recordMountCompletion ||
          state.dependencies.recordMountCompletion(recovery.recoveryCapability);
        if (!mountCompletionRecorded)
          throw new Error("mount_completion_record_failed");
        const completion = state.dependencies.completeRecovery(
          recovery.recoveryCapability,
          record.managementCapability,
        );
        recoveryFinalizationCapability =
          completion.status === "completed" &&
          completion.recoveryFinalizationCapability &&
          typeof completion.recoveryFinalizationCapability === "object"
            ? completion.recoveryFinalizationCapability
            : null;
        recoveryCompleted = recoveryFinalizationCapability !== null;
      }
    } catch {
      mountLeaseReleased = false;
      recoveryCompleted = false;
    }
  }
  if (requestedStatus === "completed") {
    try {
      if (!state.dependencies.verifyRevision(record.managementCapability)) {
        requestedStatus = "blocked";
        reason = "repository_revision_changed";
        resultSha256 = null;
        resultBytes = 0;
        normalizedResult = null;
      }
    } catch {
      requestedStatus = "blocked";
      reason = "repository_revision_changed";
      resultSha256 = null;
      resultBytes = 0;
      normalizedResult = null;
    }
  }
  // Cancellation remains live through cleanup. Re-settle after the final await
  // so a request received during cleanup cannot be published as completed.
  // A failure that already settled as blocked keeps the more specific failure;
  // cancellationRequested remains observable without erasing that diagnosis.
  if (record.cancellationRequested && requestedStatus === "completed") {
    requestedStatus = "cancelled";
    reason = "provider_operation_cancelled";
    resultSha256 = null;
    resultBytes = 0;
    normalizedResult = null;
  }
  reportPassiveBoundaryDiagnostic(
    state,
    Object.freeze({
      event: "coordinator_provider_boundary_settled" as const,
      taskRole: plan.taskRole,
      provider: plan.provider,
      operationId: plan.operationId,
      providerContainerCreatedObserved: wasProviderContainerCreationObserved,
      providerProcessStartedObserved: providerRequestStarted,
      providerProcessCompletionObserved: wasProviderProcessCompletionObserved,
      providerProcessExitStatusClass: providerExitStatusClass,
      processTreeTerminationObserved: processTreeTerminationConfirmed,
      containersAbsentObserved: cleanup.containersAbsent,
      networksAbsentObserved: cleanup.networksAbsent,
      cleanupConfirmed:
        processTreeTerminationConfirmed &&
        cleanup.containersAbsent &&
        cleanup.networksAbsent &&
        mountLeaseReleased &&
        recoveryCompleted,
    }),
  );
  return createFinalResult(requestedStatus, reason, plan, recovery.recoveryId, {
    providerRequestStarted,
    cancellationRequested: record.cancellationRequested,
    processTreeTerminationConfirmed,
    containersAbsent: cleanup.containersAbsent,
    networksAbsent: cleanup.networksAbsent,
    mountLeaseReleased,
    recoveryCompleted,
    resultSha256,
    resultBytes,
    normalizedResult,
    subscriptionAuthConfirmed: isSubscriptionAuthConfirmed,
    recoveryFinalizationCapability,
  });
}

/**
 * docker-process-controllerを開始する。
 *
 * @responsibility docker-process-controllerの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown
 * @returns startの計算結果を返す。
 * @precondition 「state: RuntimeState、preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown」がstartの入力契約を満たす。
 * @postcondition startの責務を完了した結果だけを返す。
 * @effect N/A: startは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startは独自の失敗分岐を所有しない。
 * @invariant startは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startは共有非同期状態を持たない同期処理である。
 */
function start(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff: unknown,
  commandRestriction: unknown,
) {
  if (
    !state.dependencies.effectExecutorAvailable ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return createBlockedStart("docker_process_controller_effect_unavailable");
  }
  const plan = state.dependencies.consumePreparedPlan(
    preparedCapability,
    managementCapability,
  );
  if (!plan || !isPlanValid(plan))
    return createBlockedStart("docker_process_controller_plan_invalid");
  if (!state.dependencies.verifyRevision(managementCapability)) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_revision_invalid",
      completed.status === "completed",
    );
  }
  const authority = state.dependencies.consumeProviderAuthority(
    plan.authorityUseCapability,
    plan.activeMountCapability,
    managementCapability,
  );
  if (
    !authority ||
    authority.operationId !== plan.operationId ||
    authority.provider !== plan.provider ||
    authority.profileId !== plan.profileId ||
    authority.providerHomeMountGrantRef !== plan.grantRef ||
    authority.runtimeAuthorityIssued !== true ||
    authority.providerEffectAllowed !== true
  ) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_authority_invalid",
      completed.status === "completed",
    );
  }
  const recovery = state.dependencies.beginRecovery(
    Object.freeze({
      ...plan,
      recoveryCorrelationId: plan.recoveryCorrelationId ?? null,
    }),
    managementCapability,
  );
  const readyRecovery = snapshotReadyRecovery(recovery);
  if (!readyRecovery) {
    const malformedCapability = ownDataValue(recovery, "recoveryCapability");
    const malformedRecoveryId = publicVerifiedDockerRecoveryId(
      ownDataValue(recovery, "recoveryId"),
    );
    const exactBlocked = snapshotBlockedRecoveryWithExactId(
      recovery,
      plan.stableLogicalHomeBindingHash,
    );
    if (!malformedCapability && exactBlocked) {
      const completed = state.dependencies.completeMount(
        plan.activeMountCapability,
        managementCapability,
      );
      return createBlockedStart(
        publicDockerRecoveryStartReason(exactBlocked.reason),
        completed.status === "completed",
        exactBlocked.recoveryId,
        true,
      );
    }
    if (malformedCapability || malformedRecoveryId)
      return settleInvalidRecoveryStart(
        state,
        plan,
        managementCapability,
        malformedCapability,
        malformedRecoveryId,
        "docker_process_controller_recovery_identity_invalid",
      );
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      publicDockerRecoveryStartReason(ownDataValue(recovery, "reason")),
      completed.status === "completed",
      malformedRecoveryId,
      ownDataValue(recovery, "manualRecoveryRequired") === true,
    );
  }
  const parsedRecoveryId = parseDockerTaskRecoveryId(readyRecovery.recoveryId);
  if (
    !parsedRecoveryId ||
    parsedRecoveryId.stableLogicalHomeBindingHash !==
      plan.stableLogicalHomeBindingHash ||
    state.dependencies.verifyRecoveryBinding(
      readyRecovery.recoveryCapability,
      parsedRecoveryId?.token ?? readyRecovery.recoveryId,
      managementCapability,
      plan.stableLogicalHomeBindingHash,
    ) !== true
  ) {
    return settleInvalidRecoveryStart(
      state,
      plan,
      managementCapability,
      readyRecovery.recoveryCapability,
      parsedRecoveryId?.token ?? null,
      "docker_process_controller_recovery_identity_invalid",
    );
  }
  if (
    typeof registerRecoveryHandoff !== "function" ||
    registerRecoveryHandoff(
      readyRecovery.recoveryCapability,
      parsedRecoveryId.token,
    ) !== true
  ) {
    return settleInvalidRecoveryStart(
      state,
      plan,
      managementCapability,
      readyRecovery.recoveryCapability,
      parsedRecoveryId.token,
      "docker_process_controller_recovery_handoff_unavailable",
    );
  }
  const controlCapability = Object.freeze({});
  const record: ExecutionRecord = {
    managementCapability,
    commandRestriction,
    cancellationRequested: false,
    activeHandle: null,
    completion: null,
  };
  state.controls.set(controlCapability, record);
  const completion = executePlan(state, record, plan, readyRecovery).finally(
    () => {
      state.controls.delete(controlCapability);
    },
  );
  record.completion = completion;
  return Object.freeze({
    status: "started" as const,
    reason: "docker_process_controller_started",
    controlCapability,
    completion,
    operationId: plan.operationId,
    recoveryId: parsedRecoveryId.token,
    dockerEffectStarted: true,
    providerRequestStarted: false,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    normalizedResult: null,
    normalizedResultReportedAfterCleanupOnly: true,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * docker-process-controllerを取り消す。
 *
 * @responsibility docker-process-controllerの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown
 * @returns cancelの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown」がcancelの入力契約を満たす。
 * @postcondition cancelの責務を完了した結果だけを返す。
 * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelは独自の失敗分岐を所有しない。
 * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cancelは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function cancel(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  if (!controlCapability || typeof controlCapability !== "object")
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  const record = state.controls.get(controlCapability);
  if (!record || record.managementCapability !== managementCapability)
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  if (record.cancellationRequested)
    return Object.freeze({ status: "blocked" as const, reason: "duplicate" });
  record.cancellationRequested = true;
  const terminated = record.activeHandle
    ? await record.activeHandle.terminateAndWait(CANCELLATION_GRACE_MS)
    : true;
  return Object.freeze({
    status: "requested" as const,
    reason: terminated
      ? "provider_cancellation_requested"
      : "provider_cancellation_grace_exceeded",
    cancellationRequested: true,
    processTerminationObserved: terminated,
  });
}

const productionState: RuntimeState = Object.freeze({
  dependencies: Object.freeze({
    effectExecutorAvailable: true,
    verifyRevision: verifyRuntimeOwnedRepositoryOperation,
    consumePreparedPlan: (
      preparedCapability: unknown,
      managementCapability: unknown,
    ) =>
      consumeRuntimeOwnedClaudeDockerPlanForProcessController(
        preparedCapability,
        managementCapability,
      ) ??
      consumeRuntimeOwnedCodexDockerPlanForProcessController(
        preparedCapability,
        managementCapability,
      ),
    beginRecovery: beginRuntimeOwnedDockerRecovery,
    abandonRecovery: abandonRuntimeOwnedDockerRecovery,
    verifyRecoveryBinding: verifyRuntimeOwnedDockerRecoveryBinding,
    startCommand: startRuntimeOwnedDockerCommand,
    cleanupOwnedResources: cleanupRuntimeOwnedDockerResources,
    completeMount: completeRuntimeOwnedProviderHomeMount,
    completeRecovery: completeRuntimeOwnedDockerRecovery,
    markResourceSubmission: markRuntimeOwnedDockerResourceSubmission,
    recordResourceReceipt: recordRuntimeOwnedDockerResourceReceipt,
    recordDockerAbsence: recordRuntimeOwnedDockerAbsence,
    recordMountCompletion: recordRuntimeOwnedNormalMountCompletion,
    reportProviderProcessStarted: createRuntimeOwnedLifecycleNoticeReporter(
      process.stderr,
    ),
    reportProviderBoundaryDiagnostic: createRuntimeOwnedLifecycleNoticeReporter(
      process.stderr,
    ),
    consumeProviderAuthority: consumeRuntimeOwnedProviderAuthority,
  }),
  controls: new WeakMap(),
});

/**
 * Runtime 所有 Docker Process Controllerを開始する。
 *
 * @responsibility Runtime 所有 Docker Process Controllerの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown
 * @returns startRuntimeOwnedDockerProcessControllerの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown」がstartRuntimeOwnedDockerProcessControllerの入力契約を満たす。
 * @postcondition startRuntimeOwnedDockerProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDockerProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startRuntimeOwnedDockerProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startRuntimeOwnedDockerProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startRuntimeOwnedDockerProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDockerProcessControllerは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDockerProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff?: unknown,
  commandRestriction?: unknown,
) {
  try {
    return start(
      productionState,
      preparedCapability,
      managementCapability,
      registerRecoveryHandoff,
      commandRestriction,
    );
  } catch {
    return createBlockedStart("docker_process_controller_start_failed_closed");
  }
}

/**
 * Runtime 所有 Docker Process Controllerを取り消す。
 *
 * @responsibility Runtime 所有 Docker Process Controllerの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input controlCapability: unknown、managementCapability: unknown
 * @returns cancelRuntimeOwnedDockerProcessControllerの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown」がcancelRuntimeOwnedDockerProcessControllerの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDockerProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDockerProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure cancelRuntimeOwnedDockerProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cancelRuntimeOwnedDockerProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelRuntimeOwnedDockerProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cancelRuntimeOwnedDockerProcessControllerは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function cancelRuntimeOwnedDockerProcessController(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return await cancel(
      productionState,
      controlCapability,
      managementCapability,
    );
  } catch {
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  }
}

/**
 * Isolated Docker Process Controller 候補を構築する。
 *
 * @responsibility Isolated Docker Process Controller 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedDockerProcessControllerCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedDockerProcessControllerCandidateの入力契約を満たす。
 * @postcondition createIsolatedDockerProcessControllerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDockerProcessControllerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedDockerProcessControllerCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedDockerProcessControllerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createIsolatedDockerProcessControllerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDockerProcessControllerCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDockerProcessControllerCandidate(
  dependencies: RuntimeDependencies,
) {
  const state: RuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    productionAuthority: false as const,
    start: (
      preparedCapability: unknown,
      managementCapability: unknown,
      registerRecoveryHandoff: unknown = () => true,
      commandRestriction?: unknown,
    ) => {
      try {
        return start(
          state,
          preparedCapability,
          managementCapability,
          registerRecoveryHandoff,
          commandRestriction,
        );
      } catch {
        return createBlockedStart(
          "docker_process_controller_start_failed_closed",
        );
      }
    },
    cancel: (controlCapability: unknown, managementCapability: unknown) =>
      cancel(state, controlCapability, managementCapability),
  });
}

/**
 * Docker Process Controller 契約の公開契約を記述する。
 *
 * @responsibility Docker Process Controller 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerProcessControllerContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerProcessControllerContractの入力契約を満たす。
 * @postcondition describeDockerProcessControllerContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerProcessControllerContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerProcessControllerContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerProcessControllerContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeDockerProcessControllerContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerProcessControllerContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerProcessControllerContract() {
  return Object.freeze({
    contract: DOCKER_PROCESS_CONTROLLER_CONTRACT,
    contractRevision: DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION,
    setupTimeoutMs: SETUP_TIMEOUT_MS,
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    cancellationGraceMs: CANCELLATION_GRACE_MS,
    stdoutLimitBytes: STDOUT_LIMIT_BYTES,
    stderrLimitBytes: STDERR_LIMIT_BYTES,
    preparedPlan: "opaque_single_use_adapter_capability_only",
    recoveryBeforeDockerEffect: true,
    resourceJournal:
      "durable_submission_before_each_create_and_exact_id_receipt_after_success",
    providerAuthority:
      "opaque_single_use_reverified_and_consumed_before_recovery_or_docker_effect",
    additionalCommandRestriction:
      "optional_synchronous_exact_true_veto_before_each_command_never_authority_or_cleanup_gate",
    subscriptionAuthentication:
      "network_none_read_only_provider_home_probe_with_exact_provider_stdout_stderr_shape_required_before_provider_request",
    subscriptionOffering:
      "chatgpt_subscription_oauth_or_claude_max_exact_match_required",
    cancellation: "opaque_control_capability_exactly_once",
    cleanup:
      "owned_containers_and_networks_absent_then_mount_release_then_recovery_complete",
    cleanupFailure: "manual_recovery_required_fail_closed",
    structuredResult:
      "exact_provider_boolean_or_role_task_result_published_after_cleanup_only",
    providerFailureClassification:
      "known_operational_nonzero_output_mapped_to_closed_public_reason_unknown_output_kept_generic",
    providerBoundaryDiagnostics:
      "configured_approval_sandbox_container_workspace_and_observed_process_cleanup_stages_without_raw_command_output_or_paths",
    providerTextPublication: "validated_then_discarded_not_reported",
    credentialAbsenceVerification: "not_claimed",
    taskPrompt: "runtime_owned_stdin_only_not_reported",
    rawOutputReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    productionPreparedPlan: "runtime_owned_adapter_connected",
    productionRecovery:
      "runtime_state_docker_task_recovery_and_deferred_host_finalization_connected",
    productionMountCompletion: "runtime_owned_mount_lease_connected",
    productionRevisionBinding: "runtime_owned_repository_revision_connected",
    productionEffectExecutor: "fixed_docker_cli_connected",
  });
}
