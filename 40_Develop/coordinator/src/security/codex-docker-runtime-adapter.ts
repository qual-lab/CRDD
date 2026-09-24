/**
 * codex-docker-runtime-adapterに属する責務をまとめる。
 *
 * @responsibility OperationBindingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  planCodexIsolatedTask,
  planCodexReadOnlyProbe,
} from "./codex-execution-plan.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "./codex-executor-seccomp.ts";
import { consumeRuntimeOwnedDelegationSelectionGrant } from "./delegation-selection-grant-runtime.ts";
import { describeEgressProxyTopology } from "./egress-proxy-policy.ts";
import {
  type OwnedMountPaths,
  verifyOwnedOperationManagementMountBinding,
} from "./execution-environment.ts";
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

export const CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/codex-docker-runtime-adapter";
export const CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION = 7;

const PREPARED_LIFETIME_MS = 30_000;
const PROVIDER_HOME_DESTINATION = "/provider-home";
const TMP_DESTINATION = "/tmp";
const WORKSPACE_DESTINATION = "/work";
const MAXIMUM_IDENTIFIER_LENGTH = 63;
const FORBIDDEN_ENVIRONMENT_NAMES = new Set([
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
]);

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
 * codex-docker-runtime-adapterで使用するCommandの値契約を定義する。
 *
 * @responsibility CommandのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape Commandが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commandで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commandの宣言は外部境界を開かない。
 * @security CommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Commandの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Command = Readonly<{
  purpose: string;
  argv: readonly string[];
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
  operationMode: "boolean_probe" | "isolated_task";
  taskRole: "executor" | "reviewer" | null;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
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
 * Random Hexを構築する。
 *
 * @responsibility Random Hexの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、bytes: number
 * @returns createRandomHexの計算結果を返す。
 * @precondition 「state: RuntimeState、bytes: number」がcreateRandomHexの入力契約を満たす。
 * @postcondition createRandomHexの責務を完了した結果だけを返す。
 * @effect N/A: createRandomHexは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRandomHexは独自の失敗分岐を所有しない。
 * @invariant createRandomHexは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createRandomHexはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRandomHexは共有非同期状態を持たない同期処理である。
 */
function createRandomHex(state: RuntimeState, bytes: number) {
  const value = state.randomBytes(bytes);
  return Buffer.isBuffer(value) && value.byteLength === bytes
    ? value.toString("hex")
    : null;
}

/**
 * Safe Mountを構築する。
 *
 * @responsibility Safe Mountの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input source: string、destination: string
 * @returns createSafeMountの計算結果を返す。
 * @precondition 「source: string、destination: string」がcreateSafeMountの入力契約を満たす。
 * @postcondition createSafeMountの責務を完了した結果だけを返す。
 * @effect N/A: createSafeMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSafeMountは独自の失敗分岐を所有しない。
 * @invariant createSafeMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createSafeMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSafeMountは共有非同期状態を持たない同期処理である。
 */
function createSafeMount(source: string, destination: string) {
  if (
    source.length === 0 ||
    source.includes(",") ||
    source.includes("\0") ||
    source.includes("\r") ||
    source.includes("\n")
  ) {
    return null;
  }
  return `type=bind,src=${source},dst=${destination},bind-propagation=rprivate`;
}

/**
 * Commandを構築する。
 *
 * @responsibility Commandの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input purpose: string、argv: readonly string[]
 * @returns Commandを返す。
 * @precondition 「purpose: string、argv: readonly string[]」がcreateCommandの入力契約を満たす。
 * @postcondition createCommandの責務を完了した結果だけを返す。
 * @effect N/A: createCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCommandは独自の失敗分岐を所有しない。
 * @invariant createCommandは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCommandは共有非同期状態を持たない同期処理である。
 */
function createCommand(purpose: string, argv: readonly string[]): Command {
  return Object.freeze({ purpose, argv: Object.freeze([...argv]) });
}

/**
 * Exact Fixed Environmentを構築する。
 *
 * @responsibility Exact Fixed Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input environment: Readonly<Record<string, string>>
 * @returns buildExactFixedEnvironmentの計算結果を返す。
 * @precondition 「environment: Readonly<Record<string, string>>」がbuildExactFixedEnvironmentの入力契約を満たす。
 * @postcondition buildExactFixedEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: buildExactFixedEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildExactFixedEnvironmentは独自の失敗分岐を所有しない。
 * @invariant buildExactFixedEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security buildExactFixedEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: buildExactFixedEnvironmentは共有非同期状態を持たない同期処理である。
 */
function buildExactFixedEnvironment(
  environment: Readonly<Record<string, string>>,
) {
  const entries = Object.entries(environment);
  if (
    entries.some(
      ([name, value]) =>
        FORBIDDEN_ENVIRONMENT_NAMES.has(name) ||
        typeof value !== "string" ||
        value.includes("\0"),
    )
  ) {
    return null;
  }
  return entries.flatMap(([name, value]) => ["--env", `${name}=${value}`]);
}

/**
 * Exact Model Idを固定Schemaへ正規化する。
 *
 * @responsibility Exact Model Idの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input model: string
 * @returns normalizeExactModelIdの計算結果を返す。
 * @precondition 「model: string」がnormalizeExactModelIdの入力契約を満たす。
 * @postcondition normalizeExactModelIdの責務を完了した結果だけを返す。
 * @effect N/A: normalizeExactModelIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeExactModelIdは独自の失敗分岐を所有しない。
 * @invariant normalizeExactModelIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security normalizeExactModelIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeExactModelIdは共有非同期状態を持たない同期処理である。
 */
function normalizeExactModelId(model: string) {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/.test(model) ? model : null;
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
  recoveryCorrelationId: string | null,
) {
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
    !normalizeExactModelId(consumedModelSelection.model) ||
    consumedModelSelection.model !== codex.exactModel ||
    codex.provider !== "codex" ||
    (taskPacket !== null &&
      (taskPacket.operationId !== binding.operationId ||
        taskPacket.promptTransport !== "provider_stdin_only")) ||
    codex.distributionBinding.fixedDigestImageRequired !== true ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    egress.proxyNetworks.length !== 2
  ) {
    return null;
  }
  const fixedEnvironmentEntries = buildExactFixedEnvironment(codex.environment);
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
  const providerHomeMount = createSafeMount(
    providerHomeSourcePath,
    PROVIDER_HOME_DESTINATION,
  );
  const tmpMount = createSafeMount(binding.mounts.tmp, TMP_DESTINATION);
  const workspaceMount = taskPacket
    ? createSafeMount(binding.mounts.workspace, WORKSPACE_DESTINATION)
    : null;
  const suffix = createRandomHex(state, 8);
  const proxyToken = createRandomHex(state, 32);
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
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const authContainerName = `crdd-auth-${suffix}`;
  if (!/^[a-f0-9]{64}$/u.test(activation.grant.providerHomeIdentityHash))
    return null;
  const providerContainerName = `crdd-codex-${activation.grant.providerHomeIdentityHash.slice(0, 16)}`;
  if (
    [
      internalNetworkName,
      egressNetworkName,
      proxyContainerName,
      authContainerName,
      providerContainerName,
    ].some((value) => value.length > MAXIMUM_IDENTIFIER_LENGTH)
  ) {
    return null;
  }
  const ownershipLabel = `crdd.coordinator.runtime=${suffix}`;
  const providerImageDigest = codex.distributionBinding.fixedImageDigest;
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
  const commands = Object.freeze([
    createCommand("create_subscription_auth_probe", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      authContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      `HOME=${PROVIDER_HOME_DESTINATION}`,
      "--env",
      `CODEX_HOME=${PROVIDER_HOME_DESTINATION}`,
      "--mount",
      `${providerHomeMount},readonly`,
      providerImageDigest,
      "login",
      "status",
    ]),
    createCommand("start_subscription_auth_probe_attached", [
      "start",
      "--attach",
      authContainerName,
    ]),
    createCommand("create_internal_network", [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      ownershipLabel,
      internalNetworkName,
    ]),
    createCommand("create_egress_network", [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      ownershipLabel,
      egressNetworkName,
    ]),
    createCommand("create_proxy", [
      "create",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--network-alias",
      "proxy",
      "--read-only",
      "--name",
      proxyContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      `CRDD_PROXY_AUTH=${proxyToken}`,
      "--env",
      "CRDD_PROXY_PROFILE=codex",
      proxyImageDigest,
    ]),
    createCommand("connect_proxy_egress", [
      "network",
      "connect",
      egressNetworkName,
      proxyContainerName,
    ]),
    createCommand("create_provider", [
      "create",
      ...(taskPacket ? ["--interactive"] : []),
      "--pull=never",
      "--network",
      internalNetworkName,
      "--read-only",
      "--name",
      providerContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      ...(executorSeccompProfile
        ? [`--security-opt=seccomp=${executorSeccompProfile}`]
        : []),
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...providerEnvironmentEntries,
      "--mount",
      providerHomeMount,
      "--mount",
      tmpMount,
      ...(taskPacket && workspaceMount
        ? [
            "--mount",
            taskPacket.taskRole === "reviewer"
              ? `${workspaceMount},readonly`
              : workspaceMount,
          ]
        : []),
      providerImageDigest,
      ...codex.argv,
    ]),
    createCommand("start_proxy", ["start", proxyContainerName]),
    createCommand("start_provider_attached", [
      "start",
      "--attach",
      ...(taskPacket ? ["--interactive"] : []),
      providerContainerName,
    ]),
  ]);
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
    operationMode: taskPacket ? "isolated_task" : "boolean_probe",
    taskRole: taskPacket?.taskRole ?? null,
    taskPacketRef: taskPacket?.taskPacketRef ?? null,
    taskPacketHash: taskPacket?.taskPacketHash ?? null,
    providerInput: taskPacket?.prompt ?? null,
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
 * codex-docker-runtime-adapterを実行前候補として準備する。
 *
 * @responsibility codex-docker-runtime-adapterの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown
 * @returns prepareの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown」がprepareの入力契約を満たす。
 * @postcondition prepareの責務を完了した結果だけを返す。
 * @effect N/A: prepareは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure prepareは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant prepareは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareは共有非同期状態を持たない同期処理である。
 */
function prepare(
  state: RuntimeState,
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  taskPacketUseCapability: unknown = null,
  recoveryCorrelationId: unknown = null,
) {
  if (
    recoveryCorrelationId !== null &&
    (typeof recoveryCorrelationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(recoveryCorrelationId))
  )
    return createBlockedResult(
      "codex_docker_runtime_recovery_correlation_invalid",
    );
  const binding = state.verifyOperationMount(
    managementCapability,
    mountCapability,
  );
  const activation = state.activateMount(
    mountAuthorizationCapability,
    managementCapability,
  );
  if (
    activation.status !== "activated" ||
    !activation.grant ||
    !activation.activeMountCapability
  ) {
    return createBlockedResult(
      "codex_docker_runtime_mount_authorization_invalid",
    );
  }
  const activeMountCapability = activation.activeMountCapability;
  let issuedAuthorityControlCapability: object | null = null;
  const activatedMount = Object.freeze({
    grant: activation.grant,
    activeMountCapability,
  });
  if (
    activation.grant.provider !== "codex" ||
    activation.grant.operationId !== binding.operationId
  ) {
    state.completeMount(activeMountCapability, managementCapability);
    return createBlockedResult(
      "codex_docker_runtime_mount_authorization_invalid",
    );
  }
  try {
    const consumedModelSelection = state.consumeModelSelection(
      selectionUseCapability,
      managementCapability,
    );
    if (!consumedModelSelection) {
      state.completeMount(activeMountCapability, managementCapability);
      return createBlockedResult(
        "codex_docker_runtime_model_selection_invalid",
      );
    }
    const taskPacket =
      taskPacketUseCapability === null
        ? null
        : (state.consumeTaskPacket?.(
            taskPacketUseCapability,
            managementCapability,
          ) ?? null);
    if (taskPacketUseCapability !== null && !taskPacket) {
      state.completeMount(activeMountCapability, managementCapability);
      return createBlockedResult("codex_docker_runtime_task_packet_invalid");
    }
    const providerHomeSourcePath = state.borrowMountSource(
      activeMountCapability,
      managementCapability,
    );
    const preparedWallClockMs = state.wallNow();
    const preparedMonotonicMs = state.monotonicNow();
    const planCandidate =
      typeof providerHomeSourcePath === "string" &&
      Number.isFinite(preparedWallClockMs) &&
      Number.isFinite(preparedMonotonicMs) &&
      preparedWallClockMs >= 0 &&
      preparedMonotonicMs >= 0
        ? buildPlan(
            state,
            binding,
            activatedMount,
            consumedModelSelection,
            providerHomeSourcePath,
            preparedWallClockMs,
            preparedMonotonicMs,
            taskPacket,
            recoveryCorrelationId,
          )
        : null;
    if (!planCandidate) {
      state.completeMount(activeMountCapability, managementCapability);
      return createBlockedResult("codex_docker_runtime_plan_invalid");
    }
    const authority = state.issueProviderAuthority(
      managementCapability,
      activeMountCapability,
    );
    if (authority.status === "issued" && authority.controlCapability) {
      issuedAuthorityControlCapability = authority.controlCapability;
    }
    if (
      authority.status !== "issued" ||
      !authority.useCapability ||
      !authority.controlCapability ||
      authority.operationId !== binding.operationId ||
      authority.provider !== "codex" ||
      authority.profileId !== activation.grant.profileId ||
      authority.providerHomeMountGrantRef !== activation.grant.grantRef ||
      authority.runtimeAuthorityIssued !== true
    ) {
      if (issuedAuthorityControlCapability) {
        state.revokeProviderAuthority(
          issuedAuthorityControlCapability,
          managementCapability,
        );
        issuedAuthorityControlCapability = null;
      }
      state.completeMount(activeMountCapability, managementCapability);
      return createBlockedResult("codex_docker_runtime_authority_invalid");
    }
    const plan = Object.freeze({
      ...planCandidate,
      authorityUseCapability: authority.useCapability,
      authorityControlCapability: authority.controlCapability,
    });
    const preparedCapability = Object.freeze({});
    state.prepared.set(preparedCapability, plan);
    state.managementCapabilities.set(
      preparedCapability,
      managementCapability as object,
    );
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
  } catch (error) {
    if (issuedAuthorityControlCapability) {
      state.revokeProviderAuthority(
        issuedAuthorityControlCapability,
        managementCapability,
      );
    }
    state.completeMount(activeMountCapability, managementCapability);
    throw error;
  }
}

/**
 * Stored Planを検索する。
 *
 * @responsibility Stored Planの検索範囲、一致条件、未検出結果の境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、preparedCapability: unknown、managementCapability: unknown
 * @returns findStoredPlanの計算結果を返す。
 * @precondition 「state: RuntimeState、preparedCapability: unknown、managementCapability: unknown」がfindStoredPlanの入力契約を満たす。
 * @postcondition findStoredPlanの責務を完了した結果だけを返す。
 * @effect N/A: findStoredPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: findStoredPlanは独自の失敗分岐を所有しない。
 * @invariant findStoredPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security findStoredPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: findStoredPlanは共有非同期状態を持たない同期処理である。
 */
function findStoredPlan(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  if (!preparedCapability || typeof preparedCapability !== "object")
    return null;
  const plan = state.prepared.get(preparedCapability);
  const management = state.managementCapabilities.get(preparedCapability);
  if (!plan || management !== managementCapability) return null;
  return plan;
}

/**
 * Plan Freshかを判定する。
 *
 * @responsibility Plan Freshの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、plan: PreparedPlan
 * @returns isPlanFreshの計算結果を返す。
 * @precondition 「state: RuntimeState、plan: PreparedPlan」がisPlanFreshの入力契約を満たす。
 * @postcondition isPlanFreshの責務を完了した結果だけを返す。
 * @effect N/A: isPlanFreshは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlanFreshは独自の失敗分岐を所有しない。
 * @invariant isPlanFreshは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlanFreshはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlanFreshは共有非同期状態を持たない同期処理である。
 */
function isPlanFresh(state: RuntimeState, plan: PreparedPlan) {
  const wallAge = state.wallNow() - plan.preparedWallClockMs;
  const monotonicAge = state.monotonicNow() - plan.preparedMonotonicMs;
  return !(
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge >= PREPARED_LIFETIME_MS ||
    monotonicAge >= PREPARED_LIFETIME_MS
  );
}

/**
 * Preparedを除去する。
 *
 * @responsibility Preparedの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、preparedCapability: object
 * @returns N/A: removePreparedは戻り値を返さない。
 * @precondition 「state: RuntimeState、preparedCapability: object」がremovePreparedの入力契約を満たす。
 * @postcondition removePreparedの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: removePreparedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removePreparedは独自の失敗分岐を所有しない。
 * @invariant removePreparedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security removePreparedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removePreparedは共有非同期状態を持たない同期処理である。
 */
function removePrepared(state: RuntimeState, preparedCapability: object) {
  state.prepared.delete(preparedCapability);
  state.managementCapabilities.delete(preparedCapability);
}

/**
 * codex-docker-runtime-adapterを取り消す。
 *
 * @responsibility codex-docker-runtime-adapterの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、preparedCapability: unknown、managementCapability: unknown
 * @returns cancelの計算結果を返す。
 * @precondition 「state: RuntimeState、preparedCapability: unknown、managementCapability: unknown」がcancelの入力契約を満たす。
 * @postcondition cancelの責務を完了した結果だけを返す。
 * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelは独自の失敗分岐を所有しない。
 * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelは共有非同期状態を持たない同期処理である。
 */
function cancel(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  const plan = findStoredPlan(state, preparedCapability, managementCapability);
  if (!plan || !preparedCapability || typeof preparedCapability !== "object") {
    return createBlockedResult(
      "codex_docker_runtime_prepared_capability_invalid",
    );
  }
  const revoked = state.revokeProviderAuthority(
    plan.authorityControlCapability,
    managementCapability,
  );
  const completed = state.completeMount(
    plan.activeMountCapability,
    managementCapability,
  );
  if (completed.status !== "completed") {
    return createBlockedResult(
      "codex_docker_runtime_mount_release_unconfirmed",
    );
  }
  removePrepared(state, preparedCapability);
  if (revoked.status !== "revoked") {
    return createBlockedResult("codex_docker_runtime_authority_revoke_invalid");
  }
  const isExpired = !isPlanFresh(state, plan);
  return Object.freeze({
    ...createBlockedResult(
      isExpired
        ? "codex_docker_runtime_preparation_expired"
        : "codex_docker_runtime_preparation_cancelled",
    ),
    status: isExpired ? ("expired" as const) : ("cancelled" as const),
    reason: isExpired
      ? "codex_docker_runtime_preparation_expired"
      : "codex_docker_runtime_preparation_cancelled",
    operationId: plan.operationId,
    grantRef: plan.grantRef,
  });
}

/**
 * Prepared Planを一回限りで消費する。
 *
 * @responsibility Prepared Planの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、preparedCapability: unknown、managementCapability: unknown
 * @returns consumePreparedPlanの計算結果を返す。
 * @precondition 「state: RuntimeState、preparedCapability: unknown、managementCapability: unknown」がconsumePreparedPlanの入力契約を満たす。
 * @postcondition consumePreparedPlanの責務を完了した結果だけを返す。
 * @effect N/A: consumePreparedPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumePreparedPlanは独自の失敗分岐を所有しない。
 * @invariant consumePreparedPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security consumePreparedPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumePreparedPlanは共有非同期状態を持たない同期処理である。
 */
function consumePreparedPlan(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  const plan = findStoredPlan(state, preparedCapability, managementCapability);
  if (!plan || !preparedCapability || typeof preparedCapability !== "object") {
    return null;
  }
  if (!isPlanFresh(state, plan)) {
    state.revokeProviderAuthority(
      plan.authorityControlCapability,
      managementCapability,
    );
    const completed = state.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    if (completed.status === "completed") {
      removePrepared(state, preparedCapability);
    }
    return null;
  }
  removePrepared(state, preparedCapability);
  return plan;
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
    cancel(productionState, preparedCapability, managementCapability),
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
    return consumePreparedPlan(
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
  return Object.freeze({
    productionAuthority: false as const,
    prepare: (
      managementCapability: unknown,
      mountCapability: unknown,
      mountAuthorizationCapability: unknown,
      selectionUseCapability: unknown,
    ) =>
      performSafely("codex_docker_runtime_preparation_failed_closed", () =>
        prepare(
          state,
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
        ),
      ),
    prepareTask: (
      managementCapability: unknown,
      mountCapability: unknown,
      mountAuthorizationCapability: unknown,
      selectionUseCapability: unknown,
      taskPacketUseCapability: unknown,
    ) =>
      performSafely("codex_docker_runtime_task_preparation_failed_closed", () =>
        prepare(
          state,
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
        ),
      ),
    cancel: (preparedCapability: unknown, managementCapability: unknown) =>
      performSafely("codex_docker_runtime_cancellation_failed_closed", () =>
        cancel(state, preparedCapability, managementCapability),
      ),
    consumeForProcessController: (
      preparedCapability: unknown,
      managementCapability: unknown,
    ) => {
      try {
        return consumePreparedPlan(
          state,
          preparedCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
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
    preparedLifetimeMs: PREPARED_LIFETIME_MS,
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
