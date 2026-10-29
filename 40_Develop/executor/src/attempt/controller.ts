/**
 * 一回のProvider試行の開始・取消・終了待ちと元証拠を所有する。
 * @packageDocumentation
 * @responsibility Taskの順序・保存を持たず、単段の資源終端と結果を相関する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import {
  convertProviderError,
  evaluateProviderAuthentication,
  normalizeClaudeStructuredResult,
  normalizeCodexStructuredResult,
  projectCodexExecutionBoundary,
} from "../../../ai-adapter/src/index.ts";
import {
  type CommandObservation as CommandExecution,
  type DockerExecutionHooks,
  type DockerIsolationCommand,
  type DockerResourceCleanupObservation,
  classifyDockerCommandException,
  type classifyDockerCommandExecution,
  type classifyDockerProcessExit,
  describeDockerCommandSessionContract,
  dockerIsolationResourceIdentityIsValid,
  parseDockerTaskRecoveryId,
  projectDockerExecutionBoundary,
  STDERR_LIMIT_BYTES,
  STDOUT_LIMIT_BYTES,
  startDockerCommandSessionCandidate,
} from "../../../docker-isolation/src/index.ts";
import { inspectExecutionSelection } from "../../../domain-model/src/index.ts";
import {
  PURPOSES,
  SETUP_COMMAND_FAILURE_REASONS,
  inspectRecoveryStartFailureDiagnostic,
  isDockerProcessControllerPublicCompletionReason,
  isDockerSetupCommandPurpose,
  ownDataValue,
  publicDockerRecoveryStartReason,
  publicVerifiedDockerRecoveryId,
} from "../result/validation.ts";
import type {
  DockerProcessControllerFinalReason,
  PrimaryFailureDiagnostic,
  RecoveryStartFailureDiagnostic,
} from "../result/types.ts";
import { normalizeProviderTaskStructuredResult } from "../result/task.ts";
import { normalizeProviderAdviceOutput } from "../result/advice.ts";
import {
  createProviderObservationOwner,
  type ProviderAttemptDiagnosticNotice as ProviderBoundaryDiagnosticNotice,
  type ProviderProcessStartedNotice,
} from "./observation.ts";
import type { Command, ProviderAttemptPlan as PreparedPlan } from "./types.ts";

const DOCKER_PROCESS_CONTROLLER_CONTRACT =
  "crdd-coordinator/docker-process-controller";

const DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION = 31;

const {
  setupTimeoutMs: SETUP_TIMEOUT_MS,
  providerTimeoutMs: PROVIDER_TIMEOUT_MS,
  cancellationGraceMs: CANCELLATION_GRACE_MS,
} = describeDockerCommandSessionContract();

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
  resourceObservations?: readonly DockerResourceCleanupObservation[] | null;
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
export type RuntimeDependencies = Readonly<{
  effectExecutorAvailable: boolean;
  verifyRevision: (managementCapability: unknown) => unknown;
  consumePreparedPlan: (
    preparedCapability: unknown,
    managementCapability: unknown,
  ) => PreparedPlan | null;
  beginRecovery: (
    plan: PreparedPlan,
    managementCapability: unknown,
    observeFailure?: (diagnostic: RecoveryStartFailureDiagnostic) => void,
  ) => Recovery | BlockedRecovery | null;
  abandonRecovery?: (recoveryCapability: object) => boolean;
  bindInitializationFailure?: (
    capability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    homeHash: unknown,
    reason: unknown,
    result: object | null,
  ) => boolean;
  verifyRecoveryBinding: (
    recoveryCapability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    stableLogicalHomeBindingHash: unknown,
  ) => boolean;
  startCommand?: (
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => CommandHandle;
  startExecution?: (
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionHooks,
  ) => Pick<
    ReturnType<typeof startDockerCommandSessionCandidate>,
    "cancel" | "completion"
  >;
  cleanupOwnedResources: (
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<CleanupObservation>;
  verifyCleanupOutcome?: (
    result: unknown,
    plan: PreparedPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) => CleanupObservation["resourceObservations"];
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeRecovery: (
    recoveryCapability: object,
    managementCapability: unknown,
    completion: Readonly<{
      plan: PreparedPlan;
      cleanupOutcome: CleanupObservation;
      mountCompletion: Readonly<{ status: string }>;
    }>,
  ) => Readonly<{
    status: string;
    recoveryFinalizationCapability?: object;
  }>;
  verifyHomeLeaseRelease?: (
    recoveryCapability: unknown,
    managementCapability: unknown,
    operationId: unknown,
    recoveryId: unknown,
  ) => boolean;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordProviderSubmission?: (
    recoveryCapability: object,
    notice: object,
  ) => boolean;
  recordResourceNotIssued?: (
    recoveryCapability: object,
    purpose: string,
    notice: object,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
  ) => boolean;
  recordDockerAbsence?: (
    recoveryCapability: object,
    observations: CleanupObservation["resourceObservations"],
  ) => boolean;
  recordMountCompletion?: (
    recoveryCapability: object,
    mountCompletion: Readonly<{ status: string }>,
  ) => boolean;
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
  observeProviderStarted:
    | ((notice: ProviderProcessStartedNotice) => boolean | Promise<boolean>)
    | null;
  cancellationRequested: boolean;
  cancelExecution:
    | (() => Promise<
        Readonly<{
          cancellationRequested: true;
          processTerminationObserved: boolean;
        }>
      >)
    | null;
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
  observations: Pick<
    ReturnType<typeof createProviderObservationOwner>,
    "registerTerminal" | "registerSubmission" | "revokeSubmission"
  >;
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
  state: Readonly<{
    dependencies: Pick<RuntimeDependencies, "reportProviderBoundaryDiagnostic">;
  }>,
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
  if (utilTypes.isProxy(value)) return null;
  let hasOwner = false;
  try {
    const keys = Object.keys(value).sort().join("\0");
    hasOwner =
      keys ===
      [
        "reason",
        "recoveryId",
        "status",
        "recoveryCapability",
        "manualRecoveryRequired",
      ]
        .sort()
        .join("\0");
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      (keys !== ["reason", "recoveryId", "status"].sort().join("\0") &&
        !hasOwner)
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
  const capability = ownDataValue(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      utilTypes.isProxy(capability) ||
      ownDataValue(value, "manualRecoveryRequired") !== true)
  )
    return null;
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({
        status,
        reason,
        recoveryId,
        recoveryCapability: capability ?? null,
      })
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
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    (plan.consumer === "coordinator_cli" ||
      plan.consumer === "workbench" ||
      plan.consumer === "orchestrator") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    (plan.recoveryCorrelationId == null ||
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(plan.recoveryCorrelationId)) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    inspectExecutionSelection(plan.executionSelection)?.provider ===
      plan.provider &&
    (plan.taskAttempt === 0 || plan.taskAttempt === 1) &&
    /^MODELSEL-[A-Z0-9-]{8,80}$/u.test(plan.selectionRecordId) &&
    plan.subscriptionOffering ===
      (plan.provider === "codex"
        ? "chatgpt_subscription_oauth"
        : "claude_max") &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    plan.authorityUseCapability !== null &&
    typeof plan.authorityUseCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan || isAdvicePlan) &&
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
      : isAdvicePlan
        ? plan.taskRole === null &&
          plan.taskPacketRef === null &&
          plan.taskPacketHash === null &&
          /^ADVICEPKT-[A-F0-9]{32}$/u.test(plan.advicePacketRef ?? "") &&
          /^[a-f0-9]{64}$/u.test(plan.advicePacketHash ?? "") &&
          /^[a-f0-9]{64}$/u.test(plan.adviceCommandHash ?? "") &&
          typeof plan.providerInput === "string" &&
          plan.providerInput.length > 0 &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null
        : plan.taskRole === null &&
          plan.taskPacketRef === null &&
          plan.taskPacketHash === null &&
          (plan.advicePacketRef ?? null) === null &&
          (plan.advicePacketHash ?? null) === null &&
          (plan.adviceCommandHash ?? null) === null &&
          plan.providerInput === null &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null) &&
    dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) &&
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
 * 下位の技術分類を公開用途別の理由へ投影する。
 *
 * @responsibility Docker Isolationの分類を再計算せず、Providerと用途の意味へ接続する。
 * @trace ARCH-000008
 * @input execution: 元の観測、purpose: 用途、provider: Provider、classified: 下位の技術分類。
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
  classified: ReturnType<typeof classifyDockerCommandExecution>,
) {
  const isProvider = purpose === "start_provider_attached";
  if (classified.category === "deadline_exceeded")
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? "provider_deadline_exceeded"
        : "docker_setup_deadline_exceeded",
    });
  if (classified.category === "output_limit_exceeded")
    return Object.freeze({
      ok: false,
      reason: "provider_output_limit_exceeded",
    });
  if (classified.category === "signalled")
    return Object.freeze({ ok: false, reason: "provider_process_signalled" });
  if (classified.category === "nonzero_exit") {
    if (execution === null)
      throw new Error("docker_command_classification_inconsistent");
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? convertProviderError(provider, execution).reason
        : isDockerSetupCommandPurpose(purpose)
          ? SETUP_COMMAND_FAILURE_REASONS[purpose]
          : "docker_setup_command_failed",
    });
  }
  return Object.freeze({
    ok: true,
    reason: "command_completed",
    stdoutBytes: classified.stdoutBytes,
  });
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
  let providerExitStatusClass: ReturnType<typeof classifyDockerProcessExit> =
    "not_observed";
  let diagnosticPurpose: string | null = null;
  let diagnosticStage: PrimaryFailureDiagnostic["stage"] = "submission_record";
  let hasCommandHandle = false;
  let hasResponseObservation = false;
  let receiptRecorded = false;
  let commandObservation: PrimaryFailureDiagnostic["commandObservation"] = null;
  let authenticationStatus: PrimaryFailureDiagnostic["authenticationStatus"];
  let turnCountDiagnostic: PrimaryFailureDiagnostic["turnCountDiagnostic"];
  let primaryFailure: PrimaryFailureDiagnostic | null = null;
  let startConfirmation: Promise<void> | null = null;
  let lastStdoutBytes = 0;
  let cleanup: CleanupObservation = Object.freeze({
    confirmed: false,
    processTreeTerminated: false,
    containersAbsent: false,
    networksAbsent: false,
  });
  let verifiedResourceObservations: CleanupObservation["resourceObservations"] =
    null;
  let processTreeTerminationConfirmed = false;
  let sessionStarted = false;

  /**
   * 最初の上位失敗を元段階で固定する。
   * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
   * @trace ARCH-000008
   * @input next: 固定公開理由。
   * @returns N/A: 私有状態だけを更新する。
   * @precondition 同じ操作の検証済み計画とOwnerを使用する。
   * @postcondition raw HandleやOS手順を所有しない。
   * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
   * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
   * @invariant 新Authority・Store・回復管理を作らない。
   * @boundary 上位の意味と下位の技術実行。
   * @security 生出力・秘密値を公開通知へ複製しない。
   * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
   */
  function reject(next: DockerProcessControllerFinalReason) {
    if (requestedStatus !== "blocked") {
      requestedStatus = "blocked";
      reason = next;
    }
    primaryFailure ??= Object.freeze({
      purpose: diagnosticPurpose,
      stage: diagnosticStage,
      reason: next,
      exceptionCode: null,
      commandHandleObtained: hasCommandHandle,
      responseObserved: hasResponseObservation,
      receiptRecorded,
      commandObservation,
      ...(authenticationStatus === undefined ? {} : { authenticationStatus }),
      ...(turnCountDiagnostic === undefined ? {} : { turnCountDiagnostic }),
    });
    return false;
  }

  const hooks: DockerExecutionHooks = {
    /**
     * 実行制約だけを確認する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    allowCommand: (purpose) => {
      diagnosticPurpose = purpose;
      diagnosticStage = "command_restriction";
      hasCommandHandle = false;
      hasResponseObservation = false;
      receiptRecorded = false;
      commandObservation = null;
      authenticationStatus = undefined;
      turnCountDiagnostic = undefined;
      return (
        commandRestrictionAllows(record.commandRestriction, purpose) ||
        reject("docker_process_controller_execution_restricted")
      );
    },
    /**
     * CREATE要求前の予定を保存する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordSubmission: (purpose) => {
      diagnosticStage = "submission_record";
      return (
        !state.dependencies.markResourceSubmission ||
        state.dependencies.markResourceSubmission(
          recovery.recoveryCapability,
          purpose,
        ) === true ||
        reject("docker_resource_submission_record_unavailable")
      );
    },
    /**
     * 予定保存後の未発行取消を記録する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordNotIssued: (purpose) => {
      if (
        !state.dependencies.markResourceSubmission ||
        !state.dependencies.recordResourceNotIssued
      )
        return true;
      const notice = Object.freeze({});
      state.observations.registerSubmission(
        notice,
        Object.freeze({
          managementCapability: record.managementCapability,
          recoveryCapability: recovery.recoveryCapability,
          operationId: plan.operationId,
          recoveryId: recovery.recoveryId,
          purpose,
          kind: "resource_not_issued",
        }),
      );
      let accepted = false;
      try {
        accepted =
          state.dependencies.recordResourceNotIssued(
            recovery.recoveryCapability,
            purpose,
            notice,
          ) === true;
      } finally {
        state.observations.revokeSubmission(notice);
      }
      return (
        accepted || reject("docker_resource_submission_record_unavailable")
      );
    },
    /**
     * AI本体の要求予定を元通知へ結合して保存する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input N/A: 元計画を使用する。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordExecutionSubmission: () => {
      diagnosticStage = "submission_record";
      if (!state.dependencies.recordProviderSubmission) return true;
      const notice = Object.freeze({});
      state.observations.registerSubmission(
        notice,
        Object.freeze({
          managementCapability: record.managementCapability,
          recoveryCapability: recovery.recoveryCapability,
          operationId: plan.operationId,
          recoveryId: recovery.recoveryId,
          purpose: "start_provider_attached",
          kind: "provider_submission",
        }),
      );
      let accepted = false;
      try {
        accepted =
          state.dependencies.recordProviderSubmission(
            recovery.recoveryCapability,
            notice,
          ) === true;
      } finally {
        state.observations.revokeSubmission(notice);
      }
      return (
        accepted || reject("docker_resource_submission_record_unavailable")
      );
    },
    /**
     * CREATEの元Receiptを上位Ownerへ保存する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。stdout: 下位の元応答。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordReceipt: (purpose, stdout) => {
      diagnosticStage = "resource_receipt_record";
      const accepted =
        !state.dependencies.recordResourceReceipt ||
        state.dependencies.recordResourceReceipt(
          recovery.recoveryCapability,
          purpose,
          stdout,
        ) === true;
      receiptRecorded =
        accepted && state.dependencies.recordResourceReceipt !== undefined;
      return accepted || reject("docker_resource_receipt_unavailable");
    },
    /**
     * 技術完了を既存の公開失敗分類へ接続する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose、execution、classification: 同じ下位観測。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    acceptCommandResult: (purpose, execution, classification) => {
      diagnosticStage = "execution_classification";
      hasCommandHandle = true;
      hasResponseObservation = execution !== null;
      commandObservation =
        execution === null
          ? null
          : Object.freeze({
              exitCode: execution.status,
              stdoutBytes: Buffer.byteLength(execution.stdout, "utf8"),
              stderrBytes: Buffer.byteLength(execution.stderr, "utf8"),
            });
      if (
        purpose === "start_subscription_auth_probe_attached" &&
        execution !== null &&
        execution.status !== null &&
        (classification.category === "completed" ||
          classification.category === "nonzero_exit")
      )
        authenticationStatus = evaluateProviderAuthentication(
          plan.provider,
          plan.subscriptionOffering,
          execution.stdout,
          execution.stderr,
        ).status;
      const classified = classifyExecution(
        execution,
        purpose,
        plan.provider,
        classification,
      );
      lastStdoutBytes =
        "stdoutBytes" in classification ? classification.stdoutBytes : 0;
      return classified.ok || reject(classified.reason);
    },
    /**
     * 認証とAI結果の意味を上位で受理する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。execution: 元の完了観測。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    acceptOutput: (purpose, execution) => {
      if (purpose === "start_subscription_auth_probe_attached") {
        diagnosticStage = "subscription_auth_verification";
        if (
          evaluateProviderAuthentication(
            plan.provider,
            plan.subscriptionOffering,
            execution.stdout,
            execution.stderr,
          ).status !== "confirmed"
        )
          return reject("provider_subscription_auth_not_confirmed");
        isSubscriptionAuthConfirmed = true;
      }
      if (purpose === "start_provider_attached") {
        diagnosticStage = "provider_result_normalization";
        const providerResult =
          plan.operationMode === "isolated_task"
            ? normalizeProviderTaskStructuredResult(
                plan.provider,
                plan.taskRole,
                plan.selectedEffort,
                execution.stdout,
                plan.taskWorkload,
              )
            : plan.operationMode === "workbench_advice"
              ? normalizeProviderAdviceOutput(plan.provider, execution.stdout)
              : plan.provider === "codex"
                ? normalizeCodexStructuredResult(execution.stdout)
                : normalizeClaudeStructuredResult(execution.stdout);
        if (providerResult.status !== "confirmed") {
          if ("turnCountDiagnostic" in providerResult)
            turnCountDiagnostic = providerResult.turnCountDiagnostic;
          return reject(
            "reason" in providerResult &&
              isDockerProcessControllerPublicCompletionReason(
                providerResult.reason,
              )
              ? providerResult.reason
              : "provider_result_invalid",
          );
        }
        normalizedResult = providerResult.normalizedResult;
        resultBytes = lastStdoutBytes;
        resultSha256 = createHash("sha256")
          .update(execution.stdout, "utf8")
          .digest("hex");
      }
      return true;
    },
    /**
     * 下位の開始factから上位確認を開始する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input N/A: 元操作の開始fact。
     * @returns N/A: Promiseを下位へ返さない。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    onExecutionStarted: () => {
      providerRequestStarted = true;
      hasCommandHandle = true;
      const notice: ProviderProcessStartedNotice = Object.freeze({
        event: "coordinator_provider_process_started",
        taskRole: plan.taskRole,
        provider: plan.provider,
        operationId: plan.operationId,
      });
      startConfirmation = (async () => {
        let accepted = true;
        try {
          accepted =
            !state.dependencies.reportProviderProcessStarted ||
            (await state.dependencies.reportProviderProcessStarted(notice)) ===
              true;
          if (accepted && record.observeProviderStarted)
            accepted = (await record.observeProviderStarted(notice)) === true;
        } catch {
          accepted = false;
        }
        if (!accepted) {
          if (primaryFailure === null) {
            primaryFailure = Object.freeze({
              purpose: "start_provider_attached",
              stage: "provider_start_observation",
              reason:
                "docker_process_controller_provider_start_observation_failed",
              exceptionCode: null,
              commandHandleObtained: true,
              responseObserved: false,
              receiptRecorded: false,
              commandObservation: null,
            });
          }
          if (requestedStatus !== "blocked") {
            requestedStatus = "blocked";
            reason =
              "docker_process_controller_provider_start_observation_failed";
          }
          record.cancellationRequested = true;
          await record.cancelExecution?.();
        }
      })();
    },
    /**
     * 下位の一次停止点を清掃前に受け取る。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input failure: 元の固定技術停止点。
     * @returns N/A: 同期の値保存だけ。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    onFailure: (failure) => {
      if (primaryFailure !== null) return;
      diagnosticPurpose = failure.purpose;
      if (failure.stage !== "gate") diagnosticStage = failure.stage;
      hasCommandHandle = failure.commandHandleObtained;
      hasResponseObservation = failure.responseObserved;
      const next =
        failure.kind === "start_unconfirmed"
          ? "docker_process_controller_provider_start_failed"
          : failure.gate === "onExecutionStarted"
            ? "docker_process_controller_provider_start_observation_failed"
            : "docker_process_controller_execution_failed_closed";
      reject(next);
      const latched = primaryFailure as PrimaryFailureDiagnostic | null;
      if (latched)
        primaryFailure = Object.freeze({
          ...latched,
          exceptionCode: failure.exceptionCode,
        });
    },
  };

  reportPassiveBoundaryDiagnostic(state, providerBoundaryConfiguration(plan));
  try {
    if (!state.dependencies.startExecution)
      throw new Error("docker_process_controller_execution_unavailable");
    const session = state.dependencies.startExecution(
      plan,
      recovery.recoveryCapability,
      record.managementCapability,
      hooks,
    );
    sessionStarted = true;
    record.cancelExecution = session.cancel;
    if (record.cancellationRequested) void session.cancel();
    const outcome = await session.completion;
    providerRequestStarted = outcome.executionStarted;
    wasProviderContainerCreationObserved = outcome.executionContainerCreated;
    wasProviderProcessCompletionObserved = outcome.executionCompleted;
    providerExitStatusClass = outcome.executionExit;
    cleanup = outcome.cleanup;
    verifiedResourceObservations = outcome.resourceObservations;
    processTreeTerminationConfirmed = outcome.processTreeTerminationConfirmed;
    if (outcome.failure && primaryFailure === null)
      hooks.onFailure(outcome.failure);
  } catch (error) {
    if (primaryFailure === null) {
      reject("docker_process_controller_execution_failed_closed");
      const latched = primaryFailure as PrimaryFailureDiagnostic | null;
      if (latched)
        primaryFailure = Object.freeze({
          ...latched,
          exceptionCode: classifyDockerCommandException(error),
        });
    }
    if (!sessionStarted) {
      try {
        cleanup = await state.dependencies.cleanupOwnedResources(
          plan,
          recovery.recoveryCapability,
          record.managementCapability,
        );
      } catch {}
      try {
        verifiedResourceObservations = state.dependencies.verifyCleanupOutcome
          ? state.dependencies.verifyCleanupOutcome(
              cleanup,
              plan,
              recovery.recoveryCapability,
              record.managementCapability,
            )
          : cleanup.resourceObservations;
      } catch {
        verifiedResourceObservations = null;
      }
      processTreeTerminationConfirmed =
        cleanup.confirmed &&
        cleanup.processTreeTerminated &&
        (!state.dependencies.verifyCleanupOutcome ||
          verifiedResourceObservations != null);
    }
  }
  // Docker資源はここまでで終端済み。上位保存待ちは技術清掃を止めない。
  await startConfirmation;
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
        state.dependencies.recordDockerAbsence(
          recovery.recoveryCapability,
          verifiedResourceObservations,
        );
      if (!dockerAbsenceRecorded)
        throw new Error("docker_absence_record_failed");
      const mountCompletion = state.dependencies.completeMount(
        plan.activeMountCapability,
        record.managementCapability,
      );
      mountLeaseReleased = mountCompletion.status === "completed";
      if (mountLeaseReleased) {
        const mountCompletionRecorded =
          !state.dependencies.recordMountCompletion ||
          state.dependencies.recordMountCompletion(
            recovery.recoveryCapability,
            mountCompletion,
          );
        if (!mountCompletionRecorded)
          throw new Error("mount_completion_record_failed");
        const completion = state.dependencies.completeRecovery(
          recovery.recoveryCapability,
          record.managementCapability,
          Object.freeze({ plan, cleanupOutcome: cleanup, mountCompletion }),
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
      primaryFailure,
      taskAttempt: plan.taskAttempt,
      recoveryCorrelationId: plan.recoveryCorrelationId ?? null,
      recoveryId: recovery.recoveryId,
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
  const finalResult = createFinalResult(
    requestedStatus,
    reason,
    plan,
    recovery.recoveryId,
    {
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
    },
  );
  let homeLeaseReleased = false;
  try {
    homeLeaseReleased =
      state.dependencies.verifyHomeLeaseRelease?.(
        recovery.recoveryCapability,
        record.managementCapability,
        plan.operationId,
        recovery.recoveryId,
      ) === true;
  } catch {
    homeLeaseReleased = false;
  }
  if (verifiedResourceObservations != null) {
    state.observations.registerTerminal(
      finalResult,
      Object.freeze({
        managementCapability: record.managementCapability,
        operationId: plan.operationId,
        recoveryId: recovery.recoveryId,
        resources: verifiedResourceObservations,
        primaryFailure,
        mountLeaseReleased,
        recoveryCompleted,
        homeLeaseReleased,
      }),
    );
  }
  return finalResult;
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
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
) {
  if (
    !state.dependencies.effectExecutorAvailable ||
    (observeProviderStarted !== undefined &&
      typeof observeProviderStarted !== "function") ||
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
  let recoveryStartFailure: RecoveryStartFailureDiagnostic | null = null;
  let failureObserved = false;
  const recovery = state.dependencies.beginRecovery(
    Object.freeze({
      ...plan,
      recoveryCorrelationId: plan.recoveryCorrelationId ?? null,
    }),
    managementCapability,
    (raw) => {
      if (failureObserved) return;
      failureObserved = true;
      const value = inspectRecoveryStartFailureDiagnostic(raw);
      recoveryStartFailure =
        value &&
        (value.recoveryId === null ||
          parseDockerTaskRecoveryId(value.recoveryId)
            ?.stableLogicalHomeBindingHash ===
            plan.stableLogicalHomeBindingHash)
          ? value
          : Object.freeze({ stage: "unknown", recoveryId: null });
    },
  );
  const readyRecovery = snapshotReadyRecovery(recovery);
  if (!readyRecovery) {
    if (failureObserved && recoveryStartFailure) {
      const diagnostic = recoveryStartFailure as RecoveryStartFailureDiagnostic;
      const returnedId = publicVerifiedDockerRecoveryId(
        ownDataValue(recovery, "recoveryId"),
      );
      reportPassiveBoundaryDiagnostic(
        state,
        Object.freeze({
          event: "coordinator_provider_recovery_start_failed",
          taskRole: plan.taskRole,
          provider: plan.provider,
          operationId: plan.operationId,
          taskAttempt: plan.taskAttempt,
          recoveryCorrelationId: plan.recoveryCorrelationId ?? null,
          diagnostic:
            diagnostic.recoveryId === null ||
            diagnostic.recoveryId === returnedId
              ? diagnostic
              : Object.freeze({ stage: "unknown", recoveryId: null }),
        }),
      );
    }
    const malformedCapability = ownDataValue(recovery, "recoveryCapability");
    const malformedRecoveryId = publicVerifiedDockerRecoveryId(
      ownDataValue(recovery, "recoveryId"),
    );
    const exactBlocked = snapshotBlockedRecoveryWithExactId(
      recovery,
      plan.stableLogicalHomeBindingHash,
    );
    if (exactBlocked?.recoveryCapability) {
      const stopped = createBlockedStart(
        publicDockerRecoveryStartReason(exactBlocked.reason),
        false,
        exactBlocked.recoveryId,
        true,
      );
      let isVerified = false;
      try {
        isVerified =
          state.dependencies.bindInitializationFailure?.(
            exactBlocked.recoveryCapability,
            exactBlocked.recoveryId,
            managementCapability,
            plan.stableLogicalHomeBindingHash,
            exactBlocked.reason,
            stopped,
          ) === true;
      } catch {}
      if (isVerified) {
        try {
          state.dependencies.abandonRecovery?.(exactBlocked.recoveryCapability);
        } catch {}
        try {
          state.dependencies.completeMount(
            plan.activeMountCapability,
            managementCapability,
          );
        } catch {}
        return stopped;
      }
    }
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
    observeProviderStarted: observeProviderStarted ?? null,
    cancellationRequested: false,
    cancelExecution: null,
    completion: null,
  };
  state.controls.set(controlCapability, record);
  const completion = executePlan(state, record, plan, readyRecovery).finally(
    () => {
      record.observeProviderStarted = null;
      record.cancelExecution = null;
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
  const terminated = record.cancelExecution
    ? (await record.cancelExecution()).processTerminationObserved
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

/**
 * 一試行のControlと元証拠を同じ閉包へ構成する。
 *
 * @responsibility 同一Runtimeの開始・取消・照合を生成し、二重の証拠Ownerを作らない。
 * @trace ARCH-000008
 * @input dependencies: 有限実行操作、productionAuthority: 固定本番構成か試験候補か。
 * @returns 同じcontrols・観測二Mapへ結合した有限操作。
 * @precondition 本番では固定Factoryだけがtrueを渡す。
 * @postcondition 別RuntimeのControl・通知・結果を照合できない。
 * @effect 構築時は私有Mapを生成し、外部操作は明示start後に限る。
 * @failure 開始の同期例外は既存のclosed結果へ返す。
 * @invariant 通知登録・同期利用・失効と元結果登録は同じOwnerで行う。
 * @boundary 内部Factoryと本番固定構成／分離試験候補。
 * @security このFactoryと生依存型はPackage Rootへ公開しない。
 * @concurrency 各Controlは取消とcompletionを共有し、Task順序は上位が決める。
 */
export function createProviderAttemptRuntime(
  dependencies: RuntimeDependencies,
  productionAuthority: boolean = false,
) {
  const startExecution: NonNullable<RuntimeDependencies["startExecution"]> =
    dependencies.startExecution ??
    ((plan, recoveryCapability, managementCapability, hooks) =>
      startDockerCommandSessionCandidate(
        plan.commands.map(
          (command) => command.purpose as DockerIsolationCommand["purpose"],
        ),
        {
          startCommand: (purpose) => {
            const command = plan.commands.find(
              (candidate) => candidate.purpose === purpose,
            );
            if (!command || !dependencies.startCommand)
              throw new Error("docker_effect_command_not_owned");
            return dependencies.startCommand(
              command,
              plan,
              managementCapability,
            );
          },
          cleanup: () =>
            dependencies.cleanupOwnedResources(
              plan,
              recoveryCapability,
              managementCapability,
            ),
          ...(dependencies.verifyCleanupOutcome
            ? {
                verifyCleanup: (result: CleanupObservation) =>
                  dependencies.verifyCleanupOutcome?.(
                    result,
                    plan,
                    recoveryCapability,
                    managementCapability,
                  ),
              }
            : {}),
        },
        hooks,
      ));
  const state = Object.freeze({
    dependencies: Object.freeze({ ...dependencies, startExecution }),
    controls: new WeakMap(),
    observations: createProviderObservationOwner(),
  }) satisfies RuntimeState;
  return Object.freeze({
    productionAuthority,
    verifyProviderSubmissionNotice: (
      notice: unknown,
      recoveryCapability: unknown,
      managementCapability: unknown,
      operationId: unknown,
      recoveryId: unknown,
    ) =>
      state.observations.verifyUnissuedNotice(
        notice,
        recoveryCapability,
        managementCapability,
        "start_provider_attached",
        operationId,
        recoveryId,
        "provider_submission",
      ),
    verifyUnissuedNotice: (
      notice: unknown,
      recoveryCapability: unknown,
      managementCapability: unknown,
      purpose: unknown,
      operationId: unknown,
      recoveryId: unknown,
    ) =>
      state.observations.verifyUnissuedNotice(
        notice,
        recoveryCapability,
        managementCapability,
        purpose,
        operationId,
        recoveryId,
      ),
    start: (
      preparedCapability: unknown,
      managementCapability: unknown,
      registerRecoveryHandoff: unknown = productionAuthority
        ? undefined
        : () => true,
      commandRestriction?: unknown,
      observeProviderStarted?: (
        notice: ProviderProcessStartedNotice,
      ) => boolean | Promise<boolean>,
    ) => {
      try {
        return start(
          state,
          preparedCapability,
          managementCapability,
          registerRecoveryHandoff,
          commandRestriction,
          observeProviderStarted,
        );
      } catch {
        return createBlockedStart(
          "docker_process_controller_start_failed_closed",
        );
      }
    },
    cancel: (controlCapability: unknown, managementCapability: unknown) =>
      cancel(state, controlCapability, managementCapability),
    borrowTerminalObservations: (
      result: unknown,
      managementCapability: unknown,
      operationId: unknown,
      recoveryId: unknown,
    ) =>
      state.observations.borrowTerminalObservations(
        result,
        managementCapability,
        operationId,
        recoveryId,
      ),
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
      "exact_provider_boolean_role_task_or_workbench_advice_result_published_after_cleanup_only",
    providerFailureClassification:
      "known_operational_nonzero_output_mapped_to_closed_public_reason_unknown_output_kept_generic",
    providerBoundaryDiagnostics:
      "configured_approval_sandbox_container_workspace_and_observed_process_cleanup_stages_without_raw_command_output_or_paths",
    providerTextPublication: "validated_then_discarded_not_reported",
    credentialAbsenceVerification: "not_claimed",
    taskPrompt: "runtime_owned_stdin_only_not_reported",
    workbenchAdvice:
      "provider_envelope_removed_and_advice_json_published_after_cleanup_only",
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
