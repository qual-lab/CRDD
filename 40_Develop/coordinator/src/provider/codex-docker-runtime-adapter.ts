/**
 * codex-docker-runtime-adapterに属する責務をまとめる。
 *
 * @responsibility OperationBindingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import {
  buildProviderDockerCommandPlan,
  createProviderDockerMount,
} from "../docker-runtime/provider-docker-command-plan.ts";
import type { ProviderDockerCommand as Command } from "../docker-runtime/types.ts";
import {
  createProviderDockerRandomHex,
  createProviderDockerResourceNames,
} from "../docker-runtime/provider-docker-resource-plan.ts";
import {
  prepareProviderDockerCandidate,
  createIsolatedProviderDockerPreparationAdapter,
} from "../docker-runtime/provider-docker-preparation.ts";
import { randomBytes } from "node:crypto";
import {
  cancelProviderDockerPreparation,
  consumeProviderDockerPreparation,
  PROVIDER_PREPARATION_LIFETIME_MS,
} from "../docker-runtime/provider-preparation-lifecycle.ts";
import {
  normalizeProviderExactModelId,
  prepareProviderFixedEnvironment,
} from "../../../ai-adapter/src/index.ts";
import { performance } from "node:perf_hooks";

import { codexAdviceProviderInitRequired } from "../../../ai-adapter/src/codex/index.ts";
import {
  planCodexIsolatedTask,
  planCodexReadOnlyProbe,
  describeCodexSubscriptionAuthenticationCli,
} from "../../../ai-adapter/src/codex/index.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "./codex-executor-seccomp.ts";
import { consumeRuntimeOwnedDelegationSelectionGrant } from "./delegation-selection-grant-runtime.ts";
import { describeEgressProxyTopology } from "../external-send/egress-proxy-policy.ts";
import {
  type OwnedMountPaths,
  verifyOwnedOperationManagementMountBinding,
} from "../host-runtime/execution-environment.ts";
import {
  issueRuntimeOwnedProviderAuthority,
  revokeRuntimeOwnedProviderAuthority,
} from "./provider-authority-runtime.ts";
import {
  activateRuntimeOwnedProviderHomeMount,
  borrowRuntimeOwnedActiveProviderHomeMountSource,
  completeRuntimeOwnedProviderHomeMount,
} from "./provider-home-mount-grant-runtime.ts";
import { selectProviderModelCandidate } from "./provider-model-selection-runtime.ts";
import { consumeRuntimeOwnedProviderTaskPacket } from "./provider-task-packet-runtime.ts";
import {
  consumeRuntimeOwnedWorkbenchAiAdvicePacket,
  type WorkbenchAiAdviceRuntimePacket,
} from "../workbench-ai/workbench-ai-advice-runtime-packet.ts";

export const CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/codex-docker-runtime-adapter";
export const CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION = 8;

const PROVIDER_HOME_DESTINATION = "/provider-home";
const TMP_DESTINATION = "/tmp";
const WORKSPACE_DESTINATION = "/work";
const authenticationCli = describeCodexSubscriptionAuthenticationCli();

/**
 * codex-docker-runtime-adapterで使用するOperation Bindingの値契約を定義する。
 *
 * @responsibility Operation BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape OperationBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationBindingの宣言は外部境界を開かない。
 * @security OperationBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationBinding = Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OwnedMountPaths;
}>;

/**
 * codex-docker-runtime-adapterで使用するPrepared Planの値契約を定義する。
 *
 * @responsibility Prepared PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape PreparedPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparedPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparedPlanの宣言は外部境界を開かない。
 * @security PreparedPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PreparedPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PreparedPlan = Readonly<{
  provider: "codex";
  operationId: string;
  recoveryCorrelationId: string | null;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  authorityControlCapability: object;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  preparedWallClockMs: number;
  preparedMonotonicMs: number;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  subscriptionOffering: "chatgpt_subscription_oauth";
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  selectionNotice: string;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  taskRole: "executor" | "reviewer" | null;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  advicePacketRef: string | null;
  advicePacketHash: string | null;
  adviceCommandHash: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;

/**
 * codex-docker-runtime-adapterで使用するConsumed Task Packetの値契約を定義する。
 *
 * @responsibility Consumed Task PacketのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ConsumedTaskPacketが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConsumedTaskPacketで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConsumedTaskPacketの宣言は外部境界を開かない。
 * @security ConsumedTaskPacketはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConsumedTaskPacketの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ConsumedTaskPacket = Readonly<{
  operationId: string;
  taskPacketRef: string;
  taskRole: "executor" | "reviewer";
  taskPacketHash: string;
  prompt: string;
  promptTransport: "provider_stdin_only";
}>;

/**
 * codex-docker-runtime-adapterで使用するConsumed Model Selectionの値契約を定義する。
 *
 * @responsibility Consumed Model SelectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ConsumedModelSelectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConsumedModelSelectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConsumedModelSelectionの宣言は外部境界を開かない。
 * @security ConsumedModelSelectionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConsumedModelSelectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ConsumedModelSelection = Readonly<{
  selectionRecordId: string;
  operationId: string;
  frontProvider: "codex" | "claude";
  executorProvider: "codex" | "claude";
  route: string;
  profileId: string;
  model: string;
  basis: unknown;
  effort: "low" | "medium" | "high";
  modelTier: string;
  speedMode: "normal";
  selectionNotice: string;
  delegationDepth: number;
}>;

/**
 * codex-docker-runtime-adapterで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  prepared: WeakMap<object, PreparedPlan>;
  managementCapabilities: WeakMap<object, object>;
  verifyOperationMount: (
    managementCapability: unknown,
    mountCapability: unknown,
  ) => OperationBinding;
  activateMount: (
    mountAuthorizationCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    status: string;
    grant: Readonly<{
      grantRef: string;
      provider: string;
      profileId: string;
      operationId: string;
      providerHomeIdentityHash: string;
      providerHomeProtectionHash: string;
      localUserBindingHash: string;
      stableLogicalHomeBindingHash: string;
    }> | null;
    activeMountCapability: object | null;
  }>;
  borrowMountSource: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => string | null;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
  verifyExecutorSeccompProfile?: (
    expectedSha256: string,
    expectedBytes: number,
  ) => string | null;
  consumeModelSelection: (
    useCapability: unknown,
    managementCapability: unknown,
  ) => ConsumedModelSelection | null;
  consumeTaskPacket?: (
    useCapability: unknown,
    managementCapability: unknown,
  ) => ConsumedTaskPacket | null;
  consumeAdvicePacket?: (
    useCapability: unknown,
    ownerCapability: unknown,
  ) => WorkbenchAiAdviceRuntimePacket | null;
  issueProviderAuthority: (
    managementCapability: unknown,
    activeMountCapability: unknown,
  ) => Readonly<{
    status: string;
    useCapability: object | null;
    controlCapability: object | null;
    operationId: string | null;
    provider: string | null;
    profileId: string | null;
    providerHomeMountGrantRef: string | null;
    runtimeAuthorityIssued: boolean;
  }>;
  revokeProviderAuthority: (
    controlCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
}>;

/**
 * Runtime 状態を構築する。
 *
 * @responsibility Runtime 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">」がcreateRuntimeStateの入力契約を満たす。
 * @postcondition createRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant createRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function createRuntimeState(
  dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">,
): RuntimeState {
  return Object.freeze({
    prepared: new WeakMap(),
    managementCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperationMount: verifyOwnedOperationManagementMountBinding,
  activateMount: activateRuntimeOwnedProviderHomeMount,
  borrowMountSource: borrowRuntimeOwnedActiveProviderHomeMountSource,
  completeMount: completeRuntimeOwnedProviderHomeMount,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
  verifyExecutorSeccompProfile: resolveFixedCodexExecutorSeccompProfile,
  consumeModelSelection: consumeRuntimeOwnedDelegationSelectionGrant,
  consumeTaskPacket: consumeRuntimeOwnedProviderTaskPacket,
  consumeAdvicePacket: consumeRuntimeOwnedWorkbenchAiAdvicePacket,
  issueProviderAuthority: issueRuntimeOwnedProviderAuthority,
  revokeProviderAuthority: revokeRuntimeOwnedProviderAuthority,
});

/**
 * Blocked 結果を構築する。
 *
 * @responsibility Blocked 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input reason: string
 * @returns createBlockedResultの計算結果を返す。
 * @precondition 「reason: string」がcreateBlockedResultの入力契約を満たす。
 * @postcondition createBlockedResultの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedResultは独自の失敗分岐を所有しない。
 * @invariant createBlockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createBlockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedResultは共有非同期状態を持たない同期処理である。
 */
function createBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    preparedCapability: null,
    operationId: null,
    grantRef: null,
    selectionRecordId: null,
    selectedModel: null,
    selectedEffort: null,
    selectedModelTier: null,
    selectionNotice: null,
    providerHomeMountLeaseActive: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * Safelyを安全に実行する。
 *
 * @responsibility Safelyの実行条件、Effect範囲、失敗時の終了境界を所有する。
 * @trace ARCH-000015
 * @input reason: string、action: () => T
 * @returns performSafelyの計算結果を返す。
 * @precondition 「reason: string、action: () => T」がperformSafelyの入力契約を満たす。
 * @postcondition performSafelyの責務を完了した結果だけを返す。
 * @effect N/A: performSafelyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure performSafelyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant performSafelyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security performSafelyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: performSafelyは共有非同期状態を持たない同期処理である。
 */
function performSafely<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return createBlockedResult(reason);
  }
}

/**
 * Planを構築する。
 *
 * @responsibility Planの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、binding: OperationBinding、activation: Readonly<{ grant: Readonly<{ grantRef: string; provider: string; profileId: string; operationId: string; providerHomeIdentityHash: string; providerHomeProtectionHash: string; localUserBindingHash: string; stableLogicalHomeBindingHash: string; }>; activeMountCapability: object; }>、consumedModelSelection: ConsumedModelSelection、providerHomeSourcePath: string、preparedWallClockMs: number、preparedMonotonicMs: number、taskPacket: ConsumedTaskPacket | null、recoveryCorrelationId: string | null
 * @returns buildPlanの計算結果を返す。
 * @precondition 「state: RuntimeState、binding: OperationBinding、activation: Readonly<{ grant: Readonly<{ grantRef: string; provider: string; profileId: string; operationId: string; providerHomeIdentityHash: string; providerHomeProtectionHash: string; localUserBindingHash: string; stableLogicalHomeBindingHash: string; }>; activeMountCapability: object; }>、consumedModelSelection: ConsumedModelSelection、providerHomeSourcePath: string、preparedWallClockMs: number、preparedMonotonicMs: number、taskPacket: ConsumedTaskPacket | null、recoveryCorrelationId: string | null」がbuildPlanの入力契約を満たす。
 * @postcondition buildPlanの責務を完了した結果だけを返す。
 * @effect N/A: buildPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildPlanは独自の失敗分岐を所有しない。
 * @invariant buildPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security buildPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: buildPlanは共有非同期状態を持たない同期処理である。
 */
function buildPlan(
  state: RuntimeState,
  binding: OperationBinding,
  activation: Readonly<{
    grant: Readonly<{
      grantRef: string;
      provider: string;
      profileId: string;
      operationId: string;
      providerHomeIdentityHash: string;
      providerHomeProtectionHash: string;
      localUserBindingHash: string;
      stableLogicalHomeBindingHash: string;
    }>;
    activeMountCapability: object;
  }>,
  consumedModelSelection: ConsumedModelSelection,
  providerHomeSourcePath: string,
  preparedWallClockMs: number,
  preparedMonotonicMs: number,
  taskPacket: ConsumedTaskPacket | null,
  advicePacket: WorkbenchAiAdviceRuntimePacket | null,
  recoveryCorrelationId: string | null,
): Omit<
  PreparedPlan,
  "authorityUseCapability" | "authorityControlCapability"
> | null {
  const codex = taskPacket
    ? planCodexIsolatedTask({
        provider: "codex",
        mode: "isolated_task",
        effort: consumedModelSelection.effort,
        taskRole: taskPacket.taskRole,
      })
    : planCodexReadOnlyProbe({
        provider: "codex",
        mode: "read_only_probe",
        effort: consumedModelSelection.effort,
      });
  const egress = describeEgressProxyTopology("codex");
  const selection = selectProviderModelCandidate(consumedModelSelection.basis);
  if (
    selection.status !== "candidate" ||
    selection.provider !== "codex" ||
    selection.speedMode !== "normal" ||
    !selection.selectionNotice ||
    consumedModelSelection.executorProvider !== "codex" ||
    consumedModelSelection.operationId !== binding.operationId ||
    consumedModelSelection.profileId !== activation.grant.profileId ||
    consumedModelSelection.effort !== selection.effort ||
    consumedModelSelection.modelTier !== selection.modelTier ||
    consumedModelSelection.speedMode !== selection.speedMode ||
    consumedModelSelection.selectionNotice.length === 0 ||
    !/^MODELSEL-[A-Z0-9-]{8,80}$/.test(
      consumedModelSelection.selectionRecordId,
    ) ||
    codex.status !== "candidate" ||
    !normalizeProviderExactModelId(consumedModelSelection.model) ||
    consumedModelSelection.model !==
      (advicePacket?.providerCommand.exactModelId ?? codex.exactModel) ||
    codex.provider !== "codex" ||
    (taskPacket !== null && advicePacket !== null) ||
    (taskPacket !== null &&
      (taskPacket.operationId !== binding.operationId ||
        taskPacket.promptTransport !== "provider_stdin_only")) ||
    (advicePacket !== null &&
      (advicePacket.operationId !== binding.operationId ||
        advicePacket.profileId !== activation.grant.profileId ||
        advicePacket.provider !== "codex" ||
        advicePacket.providerCommand.provider !== "codex" ||
        advicePacket.providerCommand.reasoningEffort !==
          consumedModelSelection.effort ||
        advicePacket.repositoryMounted !== false ||
        advicePacket.workspaceMounted !== false ||
        advicePacket.toolsAllowed !== false ||
        advicePacket.sessionPersistenceAllowed !== false)) ||
    codex.distributionBinding.fixedDigestImageRequired !== true ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    egress.proxyNetworks.length !== 2
  ) {
    return null;
  }
  const fixedEnvironmentEntries =
    prepareProviderFixedEnvironment(
      "codex",
      advicePacket?.providerCommand.environment ?? codex.environment,
    )?.flatMap(([name, value]) => ["--env", `${name}=${value}`]) ?? null;
  const executorSeccompProfile =
    taskPacket?.taskRole === "executor"
      ? (
          state.verifyExecutorSeccompProfile ??
          resolveFixedCodexExecutorSeccompProfile
        )(
          codex.distributionBinding.identity.executorSeccompProfileSha256,
          codex.distributionBinding.identity.executorSeccompProfileBytes,
        )
      : null;
  const providerHomeMount = createProviderDockerMount(
    providerHomeSourcePath,
    PROVIDER_HOME_DESTINATION,
  );
  const tmpMount = createProviderDockerMount(
    binding.mounts.tmp,
    TMP_DESTINATION,
  );
  const workspaceMount = taskPacket
    ? createProviderDockerMount(binding.mounts.workspace, WORKSPACE_DESTINATION)
    : null;
  const suffix = createProviderDockerRandomHex(state, 8);
  const proxyToken = createProviderDockerRandomHex(state, 32);
  if (
    !fixedEnvironmentEntries ||
    (taskPacket?.taskRole === "executor" && !executorSeccompProfile) ||
    !providerHomeMount ||
    !tmpMount ||
    (taskPacket !== null && !workspaceMount) ||
    !suffix ||
    !proxyToken
  ) {
    return null;
  }
  const resourceNames = createProviderDockerResourceNames(
    "codex",
    activation.grant.providerHomeIdentityHash,
    suffix,
  );
  if (!resourceNames) return null;
  const {
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    authContainerName,
    providerContainerName,
    ownershipLabel,
  } = resourceNames;
  const providerImageDigest =
    advicePacket?.providerCommand.fixedImageDigest ??
    codex.distributionBinding.fixedImageDigest;
  const proxyImageDigest = egress.verificationAdapter.imageDigest;
  const proxyUrl = `http://crdd:${proxyToken}@proxy:${egress.containerPort}`;
  const providerEnvironmentEntries = [
    "--env",
    `HOME=${PROVIDER_HOME_DESTINATION}`,
    "--env",
    `TMPDIR=${TMP_DESTINATION}`,
    "--env",
    `HTTPS_PROXY=${proxyUrl}`,
    "--env",
    `HTTP_PROXY=${proxyUrl}`,
    "--env",
    `ALL_PROXY=${proxyUrl}`,
    "--env",
    "NO_PROXY=",
    ...fixedEnvironmentEntries,
  ];
  const commands = buildProviderDockerCommandPlan({
    provider: "codex",
    authContainerName,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    providerHomeMount,
    tmpMount,
    workspaceMount,
    proxyToken,
    providerEnvironmentEntries,
    authenticationEnvironmentArguments: [
      "--env",
      `${authenticationCli.homeEnvironmentVariable}=${PROVIDER_HOME_DESTINATION}`,
    ],
    authenticationArgv: authenticationCli.statusArgv,
    providerArgv: advicePacket?.providerCommand.argv ?? codex.argv,
    interactive: Boolean(taskPacket || advicePacket),
    taskRole: taskPacket?.taskRole ?? null,
    initRequired: codexAdviceProviderInitRequired(
      advicePacket ? "workbench_advice" : "isolated_task",
      providerImageDigest,
    ),
    executorSeccompProfile,
  });
  return Object.freeze({
    provider: "codex" as const,
    operationId: binding.operationId,
    recoveryCorrelationId,
    grantRef: activation.grant.grantRef,
    profileId: activation.grant.profileId,
    activeMountCapability: activation.activeMountCapability,
    providerHomeSourcePath,
    providerHomeIdentityHash: activation.grant.providerHomeIdentityHash,
    providerHomeProtectionHash: activation.grant.providerHomeProtectionHash,
    localUserBindingHash: activation.grant.localUserBindingHash,
    stableLogicalHomeBindingHash: activation.grant.stableLogicalHomeBindingHash,
    preparedWallClockMs,
    preparedMonotonicMs,
    authContainerName,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    selectionRecordId: consumedModelSelection.selectionRecordId,
    subscriptionOffering: "chatgpt_subscription_oauth",
    selectedModel: consumedModelSelection.model,
    selectedEffort: selection.effort,
    selectedModelTier: selection.modelTier,
    selectionNotice: consumedModelSelection.selectionNotice,
    operationMode: taskPacket
      ? "isolated_task"
      : advicePacket
        ? "workbench_advice"
        : "boolean_probe",
    taskRole: taskPacket?.taskRole ?? null,
    taskPacketRef: taskPacket?.taskPacketRef ?? null,
    taskPacketHash: taskPacket?.taskPacketHash ?? null,
    advicePacketRef: advicePacket?.packetRef ?? null,
    advicePacketHash: advicePacket?.packetHash ?? null,
    adviceCommandHash: advicePacket?.commandHash ?? null,
    providerInput: taskPacket?.prompt ?? advicePacket?.providerPrompt ?? null,
    workspaceSourcePath: taskPacket ? binding.mounts.workspace : null,
    workspaceMountMode: taskPacket
      ? taskPacket.taskRole === "executor"
        ? "read_write"
        : "read_only"
      : null,
    commands,
  });
}

/**
 * 照合済み候補のProvider別公開prepared結果を生成する。
 *
 * @responsibility 既存fieldの有無と値を維持し、内部Planをそのまま公開しない。
 * @trace ARCH-000015
 * @input plan: 保存済み計画。preparedCapability: 不透明候補参照。bindingとactivation: 照合済み操作・Grant。
 * @returns 既存Provider別prepared結果。
 * @precondition 共通準備OwnerがAuthority照合と二Store保存を完了している。
 * @postcondition 公開結果にHost Path、Proxy秘密や内部commandを含めない。
 * @effect N/A: 結果値の生成だけで追加Authorityを発行しない。
 * @failure N/A: 受理・回収判断は共通準備Ownerが所有する。
 * @invariant Candidateを実Provider実行成功と表示しない。
 * @boundary 内部準備Planと既存利用側結果の間。
 * @security 不透明参照以外の内部Authorityを公開しない。
 * @concurrency N/A: 同期の値生成でStoreを変更しない。
 */
function createPreparedResult(
  plan: PreparedPlan,
  preparedCapability: object,
  binding: OperationBinding,
  activation: Readonly<{ grant: Readonly<{ grantRef: string }> }>,
) {
  return Object.freeze({
    ...createBlockedResult("codex_docker_runtime_prepared"),
    status: "prepared" as const,
    reason: "codex_docker_runtime_prepared",
    preparedCapability,
    operationId: binding.operationId,
    grantRef: activation.grant.grantRef,
    selectionRecordId: plan.selectionRecordId,
    selectedModel: plan.selectedModel,
    selectedEffort: plan.selectedEffort,
    selectedModelTier: plan.selectedModelTier,
    selectionNotice: plan.selectionNotice,
    providerHomeMountLeaseActive: true,
  });
}

/**
 * codex-docker-runtime-adapterを実行前候補として準備する。
 *
 * @responsibility codex-docker-runtime-adapterの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown
 * @returns Provider別の準備済み候補または既存の拒否結果。
 * @precondition stateは同じProviderのMount・Packet・Authorityと候補Storeを所有する。
 * @postcondition 検査済み候補だけを同じ管理参照へ保存して返す。
 * @effect 共通準備処理を通じてMount有効化、Packet消費、Authority発行・失効、lease解放と候補保存を行う。
 * @failure 入力・Mount・Packet・計画・Authorityの拒否を区別し、例外は失効・lease解放後に搬送する。
 * @invariant Docker要求を発行せず、Provider別計画と結果を共通準備の固定順序へ接続する。
 * @boundary Coordinator内のProvider別計画と共通準備Lifecycleの接続境界。
 * @security Authority照合前に準備済み候補を公開しない。
 * @concurrency 同期処理で既存候補Storeと管理対応を連続更新する。
 */
function prepare(
  state: RuntimeState,
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  taskPacketUseCapability: unknown = null,
  recoveryCorrelationId: unknown = null,
  advicePacketUseCapability: unknown = null,
  advicePacketOwnerCapability: unknown = null,
) {
  return prepareProviderDockerCandidate(
    state,
    "codex",
    {
      blockedResult: createBlockedResult,
      buildPlan: (...args) => buildPlan(state, ...args),
      preparedResult: createPreparedResult,
    },
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    taskPacketUseCapability,
    recoveryCorrelationId,
    advicePacketUseCapability,
    advicePacketOwnerCapability,
  );
}

/**
 * Runtime 所有 Codex Docker 候補を実行前候補として準備する。
 *
 * @responsibility Runtime 所有 Codex Docker 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown
 * @returns prepareRuntimeOwnedCodexDockerCandidateの計算結果を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown」がprepareRuntimeOwnedCodexDockerCandidateの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedCodexDockerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedCodexDockerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareRuntimeOwnedCodexDockerCandidateは独自の失敗分岐を所有しない。
 * @invariant prepareRuntimeOwnedCodexDockerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareRuntimeOwnedCodexDockerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedCodexDockerCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedCodexDockerCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
) {
  return performSafely("codex_docker_runtime_preparation_failed_closed", () =>
    prepare(
      productionState,
      managementCapability,
      mountCapability,
      mountAuthorizationCapability,
      selectionUseCapability,
    ),
  );
}

/**
 * Runtime 所有 Codex Docker Task 候補を実行前候補として準備する。
 *
 * @responsibility Runtime 所有 Codex Docker Task 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown
 * @returns prepareRuntimeOwnedCodexDockerTaskCandidateの計算結果を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown」がprepareRuntimeOwnedCodexDockerTaskCandidateの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedCodexDockerTaskCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedCodexDockerTaskCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareRuntimeOwnedCodexDockerTaskCandidateは独自の失敗分岐を所有しない。
 * @invariant prepareRuntimeOwnedCodexDockerTaskCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareRuntimeOwnedCodexDockerTaskCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedCodexDockerTaskCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedCodexDockerTaskCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  taskPacketUseCapability: unknown,
  recoveryCorrelationId: unknown = null,
) {
  return performSafely(
    "codex_docker_runtime_task_preparation_failed_closed",
    () =>
      prepare(
        productionState,
        managementCapability,
        mountCapability,
        mountAuthorizationCapability,
        selectionUseCapability,
        taskPacketUseCapability,
        recoveryCorrelationId,
      ),
  );
}

/**
 * Runtime所有のWorkbench読取り助言候補を実行前に準備する。
 *
 * @responsibility 一回消費PacketをRepository非共有のCodex実行Planへ結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 管理、Mount、Model Selection、Advice Packetの各Capability。
 * @returns 準備済み候補またはEffect 0のblocked結果。
 * @precondition Advice Packetは同じOperation、ProfileおよびProviderへ固定されている。
 * @postcondition preparedの場合だけworkbench_advice Planを一回消費できる。
 * @effect Provider Effectは発行せず、Provider Home Leaseと短期Authorityだけを準備する。
 * @failure Capability、IdentityまたはCommand不一致をEffect前に拒否する。
 * @invariant Repository／WorkspaceをMountしない。
 * @boundary Workbench助言Packetと署名Codex Docker Runtimeの間。
 * @security Packet所有Capabilityと利用Capabilityの両方を要求する。
 * @concurrency 準備結果は一回消費Capabilityで直列化する。
 */
export function prepareRuntimeOwnedCodexDockerAdviceCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  advicePacketUseCapability: unknown,
  advicePacketOwnerCapability: unknown,
) {
  return performSafely(
    "codex_docker_runtime_advice_preparation_failed_closed",
    () =>
      prepare(
        productionState,
        managementCapability,
        mountCapability,
        mountAuthorizationCapability,
        selectionUseCapability,
        null,
        null,
        advicePacketUseCapability,
        advicePacketOwnerCapability,
      ),
  );
}

/**
 * Runtime 所有 Codex Docker 候補を取り消す。
 *
 * @responsibility Runtime 所有 Codex Docker 候補の取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000015
 * @input preparedCapability: unknown、managementCapability: unknown
 * @returns cancelRuntimeOwnedCodexDockerCandidateの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown」がcancelRuntimeOwnedCodexDockerCandidateの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedCodexDockerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedCodexDockerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedCodexDockerCandidateは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedCodexDockerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelRuntimeOwnedCodexDockerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedCodexDockerCandidateは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedCodexDockerCandidate(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  return performSafely("codex_docker_runtime_cancellation_failed_closed", () =>
    cancelProviderDockerPreparation(
      productionState,
      "codex",
      createBlockedResult,
      preparedCapability,
      managementCapability,
    ),
  );
}

/**
 * Runtime 所有 Codex Docker Plan For Process Controllerを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Codex Docker Plan For Process Controllerの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input preparedCapability: unknown、managementCapability: unknown
 * @returns consumeRuntimeOwnedCodexDockerPlanForProcessControllerの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown」がconsumeRuntimeOwnedCodexDockerPlanForProcessControllerの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedCodexDockerPlanForProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedCodexDockerPlanForProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeRuntimeOwnedCodexDockerPlanForProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeRuntimeOwnedCodexDockerPlanForProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security consumeRuntimeOwnedCodexDockerPlanForProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedCodexDockerPlanForProcessControllerは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedCodexDockerPlanForProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumeProviderDockerPreparation(
      productionState,
      preparedCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

/**
 * Isolated Codex Docker Runtime Adapter 候補を構築する。
 *
 * @responsibility Isolated Codex Docker Runtime Adapter 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">
 * @returns createIsolatedCodexDockerRuntimeAdapterCandidateの計算結果を返す。
 * @precondition 「dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">」がcreateIsolatedCodexDockerRuntimeAdapterCandidateの入力契約を満たす。
 * @postcondition createIsolatedCodexDockerRuntimeAdapterCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCodexDockerRuntimeAdapterCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedCodexDockerRuntimeAdapterCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedCodexDockerRuntimeAdapterCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createIsolatedCodexDockerRuntimeAdapterCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCodexDockerRuntimeAdapterCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCodexDockerRuntimeAdapterCandidate(
  dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">,
) {
  const state = createRuntimeState(dependencies);
  return createIsolatedProviderDockerPreparationAdapter("codex", {
    prepare: (
      management,
      mount,
      authorization,
      selection,
      task = null,
      recovery = null,
      advice = null,
      owner = null,
    ) =>
      prepare(
        state,
        management,
        mount,
        authorization,
        selection,
        task,
        recovery,
        advice,
        owner,
      ),
    blocked: createBlockedResult,
    cancel: (prepared, management) =>
      cancelProviderDockerPreparation(
        state,
        "codex",
        createBlockedResult,
        prepared,
        management,
      ),
    consume: (prepared, management) =>
      consumeProviderDockerPreparation(state, prepared, management),
  });
}
/**
 * Codex Docker Runtime Adapter 契約の公開契約を記述する。
 *
 * @responsibility Codex Docker Runtime Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCodexDockerRuntimeAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCodexDockerRuntimeAdapterContractの入力契約を満たす。
 * @postcondition describeCodexDockerRuntimeAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCodexDockerRuntimeAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCodexDockerRuntimeAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeCodexDockerRuntimeAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeCodexDockerRuntimeAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCodexDockerRuntimeAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeCodexDockerRuntimeAdapterContract() {
  return Object.freeze({
    contract: CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT,
    contractRevision: CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION,
    provider: "codex",
    subscriptionOffering: "chatgpt_subscription_oauth",
    modelSelection:
      "runtime_owned_selection_grant_consumer_connected_with_preflight_deferred_eligibility",
    coordinatorPrelaunchModelSelectionAllowed: true,
    providerAutomaticModelSwitchingAllowed: false,
    midExecutionModelSwitchingAllowed: false,
    speedMode: "normal_only",
    highCostSelection: "decisive_reason_required",
    fallbackModelArgumentAllowed: false,
    operationBinding:
      "same_runtime_owned_management_and_mount_capability_generation",
    providerHomeBinding:
      "consumed_mount_authorization_and_native_known_folder_source_hash",
    providerAuthority:
      "runtime_owned_short_lived_use_capability_required_in_prepared_plan",
    preparedLifetimeMs: PROVIDER_PREPARATION_LIFETIME_MS,
    providerImage: "fixed_digest_only_pull_never",
    proxyImage: "fixed_digest_only_pull_never",
    parentEnvironmentInherited: false,
    apiKeyEnvironmentAllowed: false,
    providerNetwork: "internal_only",
    providerDirectEgress: false,
    providerProxyEnvironment: Object.freeze([
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "ALL_PROXY",
      "NO_PROXY_EMPTY",
    ]),
    proxyNetworks: Object.freeze(["internal", "egress"]),
    proxyAuthentication: "runtime_random_256_bit_operation_local",
    proxyHostnameAllowlist: Object.freeze(["auth.openai.com", "chatgpt.com"]),
    rootFilesystem: "read_only",
    linuxUser: "65534:65534",
    capabilities: "all_dropped",
    noNewPrivileges: true,
    processLimit: 64,
    providerHomeMount: "read_write_rprivate_dedicated_home",
    providerHomeCrossProcessLease:
      "docker_global_provider_home_identity_container_name_fail_closed",
    subscriptionAuthentication:
      "network_none_read_only_provider_home_probe_before_provider_request",
    operationTmpMount: "read_write_rprivate_owned_operation_tmp",
    repositoryMounted: false,
    isolatedWorkspace:
      "runtime_owned_exact_commit_executor_read_write_reviewer_read_only",
    taskPacket: "opaque_single_use_prompt_to_provider_stdin_only",
    workbenchAdvice:
      "opaque_single_use_packet_provider_stdin_only_without_repository_or_workspace_mount",
    shellInvocation: false,
    pathLookup: false,
    commandPlanReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued:
      "runtime_owned_short_lived_provider_authority_connected",
    operationCapabilityIssued: false,
    processController:
      "production_runtime_owned_controller_and_fixed_docker_effect_connected",
  });
}
