/**
 * 隔離診断とFake Provider検証の上位状態・公開結果を調整する。
 *
 * @responsibility Host二保存・同対象の私有相関・公開診断を所有し、技術実行と資源観測はDocker Isolationへ委譲する。
 * @trace ARCH-000008
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createDockerProbeContainer,
  observeDockerProbeEngine,
  type classifyDockerProbeExecution,
  runDockerProbeToCompletion,
  runDockerProbeCancellation,
  startDockerProbeResidue,
  describeDockerProbeConfiguration,
  type DockerProbeProfile,
  inspectDockerProbeContainer,
  observeDockerProbeContainerAbsence,
  cleanupDockerProbeContainer,
} from "../../../docker-isolation/src/index.ts";
import {
  createDockerProbeRuntimeBinding,
  describeDockerProbeResource,
} from "../../../docker-isolation/src/index.ts";

import {
  acquireHostOperationRecoveryGenerationByIdentity,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  transitionHostRecoveryState,
  verifyOwnedMountCapability,
} from "../execution/operation.ts";
import {
  parseHostRecoveryToken,
  type DockerMounts,
  writeDockerProbeRecoveryRecord,
  loadDockerProbeRecoveryRecord,
  parseDockerProbeRecoveryToken,
  requireDockerProbeRecoveryMounts,
} from "../storage/recovery-record.ts";

/**
 * 下位が所有する同操作のProbe技術構成を参照する。
 *
 * @responsibility CLIと環境を上位で再構成せず、DIの返却契約だけへ依存する。
 * @trace ARCH-000008
 * @shape ProbeBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProbeBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProbeBindingの宣言は外部境界を開かない。
 * @security ProbeBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProbeBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProbeBinding = ReturnType<typeof createDockerProbeRuntimeBinding>;
/**
 * docker-isolationで使用するContainer Identityの値契約を定義する。
 *
 * @responsibility Container IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ContainerIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ContainerIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ContainerIdentityの宣言は外部境界を開かない。
 * @security ContainerIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ContainerIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ContainerIdentity = Readonly<{
  id: string;
  probeId: string;
  profile: DockerProbeProfile | "legacy_recovery";
}>;

/**
 * docker-isolationで使用するAbsence Observationの値契約を定義する。
 *
 * @responsibility Absence ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape AbsenceObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AbsenceObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: AbsenceObservationの宣言は外部境界を開かない。
 * @security AbsenceObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AbsenceObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AbsenceObservation = Readonly<{
  probeId: string;
  containerId: string;
  hostRecoveryId: string;
  rootName: string;
  cli: ProbeBinding;
}>;
/**
 * docker-isolationで使用するDocker Probe 失敗 状態の値契約を定義する。
 *
 * @responsibility Docker Probe 失敗 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeFailureStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeFailureStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeFailureStateの宣言は外部境界を開かない。
 * @security DockerProbeFailureStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeFailureStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeFailureState = Readonly<{
  submissionStarted: boolean;
  recoveryId: string | null;
  hostRecoveryId: string;
  rollbackFailed: boolean;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Recoverable Residue 結果の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Recoverable Residue 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderRecoverableResidueResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderRecoverableResidueResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderRecoverableResidueResultの宣言は外部境界を開かない。
 * @security DynamicFakeProviderRecoverableResidueResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderRecoverableResidueResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderRecoverableResidueResult = Readonly<{
  status: "ready" | "blocked";
  reason: string;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  containerRunning: boolean;
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

const containerIdentities = new WeakMap<object, ContainerIdentity>();

const absenceCapabilities = new WeakMap<object, AbsenceObservation>();
/**
 * docker-isolationで使用するPending Dynamic Fake Provider Lifecycleの値契約を定義する。
 *
 * @responsibility Pending Dynamic Fake Provider LifecycleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PendingDynamicFakeProviderLifecycleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PendingDynamicFakeProviderLifecycleで宣言した値と責務の対応を維持する。
 * @boundary N/A: PendingDynamicFakeProviderLifecycleの宣言は外部境界を開かない。
 * @security PendingDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PendingDynamicFakeProviderLifecycleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PendingDynamicFakeProviderLifecycle = Readonly<{
  observation: DynamicFakeProviderLifecycleObservation;
  probeId: string;
  containerId: string;
  mountCapability: object;
  hostRecoveryId: string;
}>;
/**
 * docker-isolationで使用するDynamic Fake Provider Finalizationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider FinalizationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFinalizationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFinalizationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFinalizationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFinalizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFinalizationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderFinalization = Readonly<{
  pendingCapability: object;
  probeId: string;
  containerId: string;
  mountCapability: object;
  absenceCapability: object;
  hostCleanupCapability: object;
}>;
/**
 * docker-isolationで使用するDynamic Fake Provider Absenceの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider AbsenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderAbsenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderAbsenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderAbsenceの宣言は外部境界を開かない。
 * @security DynamicFakeProviderAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderAbsenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderAbsence = Readonly<{
  probeId: string;
  containerId: string;
  initialHostRecoveryId: string;
  confirmedHostRecoveryId: string;
  root: string;
}>;
/**
 * docker-isolationで使用するDynamic Fake Provider Host 清掃の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Host 清掃のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderHostCleanupが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderHostCleanupで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderHostCleanupの宣言は外部境界を開かない。
 * @security DynamicFakeProviderHostCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderHostCleanupの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderHostCleanup = Readonly<{
  probeId: string;
  confirmedHostRecoveryId: string;
  absenceCapability: object;
}>;
const pendingDynamicLifecycleObservations = new WeakMap<
  object,
  PendingDynamicFakeProviderLifecycle
>();
const dynamicLifecycleFinalizations = new WeakMap<
  object,
  DynamicFakeProviderFinalization
>();
const dynamicLifecycleAbsences = new WeakMap<
  object,
  DynamicFakeProviderAbsence
>();
const dynamicLifecycleHostCleanups = new WeakMap<
  object,
  DynamicFakeProviderHostCleanup
>();

/**
 * docker-isolationで使用するDocker Probe 結果の値契約を定義する。
 *
 * @responsibility Docker Probe 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeResultの宣言は外部境界を開かない。
 * @security DockerProbeResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeResult = Readonly<{
  status: "confirmed" | "blocked" | "recovered";
  reason: string;
  probeId: string | null;
  retainOperationDirectories: boolean;
  hostCleanupCompleted: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  fakeProviderLifecycle: DynamicFakeProviderLifecycleObservation;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Lifecycle Observationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderLifecycleObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderLifecycleObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderLifecycleObservationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderLifecycleObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderLifecycleObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderLifecycleObservation = Readonly<{
  status: "verified" | "candidate" | "blocked" | "not_evaluated";
  reason: string;
  provenance:
    | "repository_owned_docker_fake_provider"
    | "untrusted_execution_fixture";
  fakeProviderStartAttempted: boolean;
  fakeProviderExecuted: boolean;
  resultNormalizationVerified: boolean;
  containerAbsenceVerified: boolean;
  processTreeAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  elapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancellationRequested: false;
  cancellationObservation: "not_implemented";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Cancellation 結果の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Cancellation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderCancellationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderCancellationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderCancellationResultの宣言は外部境界を開かない。
 * @security DynamicFakeProviderCancellationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderCancellationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderCancellationResult = Readonly<{
  status: "verified" | "candidate" | "blocked";
  reason: string;
  cancellationRequested: boolean;
  cancellationSignalRequested: "SIGTERM" | null;
  readyObserved: boolean;
  cancellationAcknowledged: boolean;
  processTerminationObserved: boolean;
  attachProcessTerminationObserved: boolean;
  attachProcessTerminationRequestCount: number;
  containerAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  graceElapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  retainOperationDirectories: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  const candidate = isObject(value) ? ownValue(value, key) : undefined;
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security errorMessageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

/**
 * 診断Fake Providerで選択できる固定の故障条件を示す。
 * @responsibility 上位の故障検証入口が受理する四条件を固定する。
 * @trace ARCH-000008
 * @invariant 値・順序をDIの既存profileと一致させ、任意commandを追加しない。
 * @boundary N/A: 固定値の宣言だけで外部要求は発行しない。
 * @security この一覧は実行許可や回復Authorityを発行しない。
 * @compatibility 既存の故障条件文字列と順序を維持する。
 */
export const DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS = Object.freeze([
  "timeout",
  "output_limit",
  "invalid_output",
  "nonzero_exit",
] as const);
/**
 * docker-isolationで使用するDynamic Fake Provider 失敗 Scenarioの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider 失敗 ScenarioのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFailureScenarioが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFailureScenarioで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFailureScenarioの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFailureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFailureScenarioの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderFailureScenario =
  (typeof DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS)[number];

const FAILURE_SCENARIO_SPECS = Object.freeze({
  timeout: Object.freeze({
    expectedReason: "docker_isolation_probe_timeout",
  }),
  output_limit: Object.freeze({
    expectedReason: "docker_isolation_probe_output_too_large",
  }),
  invalid_output: Object.freeze({
    expectedReason: "docker_isolation_probe_invalid_output",
  }),
  nonzero_exit: Object.freeze({
    expectedReason: "docker_isolation_probe_failed",
  }),
} satisfies Readonly<
  Record<
    DynamicFakeProviderFailureScenario,
    Readonly<{ expectedReason: string }>
  >
>);

/**
 * dynamic Fake Lifecycle Blockedを決定する。
 *
 * @responsibility dynamic Fake Lifecycle Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「reason: string」がdynamicFakeLifecycleBlockedの入力契約を満たす。
 * @postcondition dynamicFakeLifecycleBlockedの責務を完了した結果だけを返す。
 * @effect N/A: dynamicFakeLifecycleBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dynamicFakeLifecycleBlockedは独自の失敗分岐を所有しない。
 * @invariant dynamicFakeLifecycleBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dynamicFakeLifecycleBlockedはProcess内の同一Subsystemで完結する。
 * @security dynamicFakeLifecycleBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dynamicFakeLifecycleBlockedは共有非同期状態を持たない同期処理である。
 */
function dynamicFakeLifecycleBlocked(
  reason: string,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    status: "blocked",
    reason,
    provenance: "repository_owned_docker_fake_provider",
    fakeProviderStartAttempted: false,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    containerAbsenceVerified: false,
    processTreeAbsenceVerified: false,
    hostCleanupVerified: false,
    elapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    cancellationRequested: false,
    cancellationObservation: "not_implemented",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * DIの閉じた実行事実を既存lifecycle表示へ投影する。
 * @responsibility 技術分類を再解釈せず上位の公開fieldへ対応付ける。
 * @trace ARCH-000008
 * @input facts: DIの同じ要求から返された実行事実。
 * @returns 未確定の既存lifecycle観測。
 * @precondition 回収やHost清掃の成立は別途確認する。
 * @postcondition 候補をverifiedへ昇格しない。
 * @effect N/A: 局所値の投影だけ。
 * @failure 下位のblocked理由を維持する。
 * @invariant 生出力やProcess Handleを受け取らない。
 * @boundary DI技術事実とCoordinatorの公開意味。
 * @security この投影からAuthorityを発行しない。
 * @concurrency 同期投影だけ。
 */
function projectProbeExecutionFacts(
  facts: ReturnType<typeof classifyDockerProbeExecution>,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    ...dynamicFakeLifecycleBlocked(facts.lifecycleReason),
    status: facts.lifecycleStatus,
    provenance: "untrusted_execution_fixture",
    fakeProviderStartAttempted: true,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    elapsedMs: facts.elapsedMs,
    stdoutBytes: facts.stdoutBytes,
    stderrBytes: facts.stderrBytes,
    exitCode: facts.exitCode,
    signal: facts.signal,
    timedOut: facts.timedOut,
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
  });
}

/**
 * cancellation Blockedを決定する。
 *
 * @responsibility cancellation Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderCancellationResultを返す。
 * @precondition 「reason: string」がcancellationBlockedの入力契約を満たす。
 * @postcondition cancellationBlockedの責務を完了した結果だけを返す。
 * @effect N/A: cancellationBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancellationBlockedは独自の失敗分岐を所有しない。
 * @invariant cancellationBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancellationBlockedはProcess内の同一Subsystemで完結する。
 * @security cancellationBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancellationBlockedは共有非同期状態を持たない同期処理である。
 */
function cancellationBlocked(
  reason: string,
): DynamicFakeProviderCancellationResult {
  return Object.freeze({
    status: "blocked",
    reason,
    cancellationRequested: false,
    cancellationSignalRequested: null,
    readyObserved: false,
    cancellationAcknowledged: false,
    processTerminationObserved: false,
    attachProcessTerminationObserved: false,
    attachProcessTerminationRequestCount: 0,
    containerAbsenceVerified: false,
    hostCleanupVerified: false,
    graceElapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    retainOperationDirectories: false,
    recoveryId: null,
    manualRecoveryRequired: false,
    cleanup: "not_required_or_confirmed",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * Cancellation 失敗を固定Schemaへ正規化する。
 *
 * @responsibility Cancellation 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns stringを返す。
 * @precondition 「error: unknown」がnormalizeCancellationFailureの入力契約を満たす。
 * @postcondition normalizeCancellationFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeCancellationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeCancellationFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeCancellationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeCancellationFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeCancellationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeCancellationFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeCancellationFailure(error: unknown): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_container_identity_unknown",
    "docker_container_security_profile_mismatch",
    "dynamic_fake_provider_cancellation_ready_unconfirmed",
    "dynamic_fake_provider_cancellation_not_requested",
    "dynamic_fake_provider_cancellation_grace_exceeded",
    "dynamic_fake_provider_cancellation_acknowledgement_invalid",
    "dynamic_fake_provider_cancellation_termination_invalid",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = errorMessage(error);
  return message && known.has(message)
    ? message
    : "dynamic_fake_provider_cancellation_verification_failed";
}

/**
 * Dynamic Fake Provider Lifecycle Capabilityを構築する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input facts: DIの閉じた実行事実、context: 同じProbe・Container・mount・Host相関。
 * @returns Readonly<{ kind: "dynamic_fake_provider_lifecycle" }>を返す。
 * @precondition factsとcontextは同じ保存後実行から得られている。
 * @postcondition 返却した私有参照から同じ候補登録だけを後続が取得できる。
 * @effect 同じ閉factsとcontextの私有pending登録を一回行う。Docker・Filesystem要求は発行しない。
 * @failure N/A: createDynamicFakeProviderLifecycleCapabilityは独自の失敗分岐を所有しない。
 * @invariant 生出力・別Probe・別Hostへ相関を拡張しない。
 * @boundary DIの閉factsとCoordinatorの私有lifecycle参照。
 * @security createDynamicFakeProviderLifecycleCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 新しい参照ごとに独立登録し、既存の後続消費規則を維持する。
 */
function createDynamicFakeProviderLifecycleCapability(
  facts: ReturnType<typeof classifyDockerProbeExecution>,
  context: Readonly<{
    probeId: string;
    containerId: string;
    mountCapability: object;
    hostRecoveryId: string;
  }>,
): Readonly<{ kind: "dynamic_fake_provider_lifecycle" }> {
  const normalized = projectProbeExecutionFacts(facts);
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_lifecycle" as const,
  });
  pendingDynamicLifecycleObservations.set(
    capability,
    Object.freeze({
      observation: Object.freeze({
        ...normalized,
        provenance: "repository_owned_docker_fake_provider",
        fakeProviderExecuted: false,
        resultNormalizationVerified: false,
        diagnosticDockerContainerEffectIssued: true,
        diagnosticFilesystemEffectIssued: true,
      }),
      ...context,
    }),
  );
  return capability;
}

/**
 * docker-isolationで使用するDynamic Fake Provider Finalization Eligibilityの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Finalization EligibilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFinalizationEligibilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFinalizationEligibilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFinalizationEligibilityの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFinalizationEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFinalizationEligibilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderFinalizationEligibility = Readonly<{
  hasRepositoryOwnedProvenance: boolean;
  hasExactResult: boolean;
  hasValidElapsed: boolean;
  hasPostRunMountIdentity: boolean;
  hasContainerAbsence: boolean;
  hasHostCleanup: boolean;
  hasMatchingRunIdentity: boolean;
}>;

/**
 * Dynamic Fake Provider Finalizationを評価する。
 *
 * @responsibility Dynamic Fake Provider Finalizationの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input input: DynamicFakeProviderFinalizationEligibility
 * @returns evaluateDynamicFakeProviderFinalizationの計算結果を返す。
 * @precondition 「input: DynamicFakeProviderFinalizationEligibility」がevaluateDynamicFakeProviderFinalizationの入力契約を満たす。
 * @postcondition evaluateDynamicFakeProviderFinalizationの責務を完了した結果だけを返す。
 * @effect N/A: evaluateDynamicFakeProviderFinalizationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateDynamicFakeProviderFinalizationは独自の失敗分岐を所有しない。
 * @invariant evaluateDynamicFakeProviderFinalizationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateDynamicFakeProviderFinalizationはProcess内の同一Subsystemで完結する。
 * @security evaluateDynamicFakeProviderFinalizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateDynamicFakeProviderFinalizationは共有非同期状態を持たない同期処理である。
 */
function evaluateDynamicFakeProviderFinalization(
  input: DynamicFakeProviderFinalizationEligibility,
) {
  const isEligible =
    input.hasRepositoryOwnedProvenance &&
    input.hasExactResult &&
    input.hasValidElapsed &&
    input.hasPostRunMountIdentity &&
    input.hasContainerAbsence &&
    input.hasHostCleanup &&
    input.hasMatchingRunIdentity;
  return Object.freeze({
    status: isEligible ? ("candidate" as const) : ("blocked" as const),
    reason: isEligible
      ? "dynamic_fake_provider_finalization_candidate"
      : "dynamic_fake_provider_finalization_incomplete",
    observationAuthority: false,
  });
}

/**
 * Dynamic Fake Provider Finalization Capabilityを構築する。
 *
 * @responsibility Dynamic Fake Provider Finalization Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input pendingCapability: object、context: Omit<DynamicFakeProviderFinalization, "pendingCapability">
 * @returns Readonly<{ kind: "dynamic_fake_provider_finalization" }>を返す。
 * @precondition 「pendingCapability: object、context: Omit<DynamicFakeProviderFinalization, "pendingCapability">」がcreateDynamicFakeProviderFinalizationCapabilityの入力契約を満たす。
 * @postcondition createDynamicFakeProviderFinalizationCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createDynamicFakeProviderFinalizationCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDynamicFakeProviderFinalizationCapabilityは独自の失敗分岐を所有しない。
 * @invariant createDynamicFakeProviderFinalizationCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDynamicFakeProviderFinalizationCapabilityはProcess内の同一Subsystemで完結する。
 * @security createDynamicFakeProviderFinalizationCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderFinalizationCapabilityは共有非同期状態を持たない同期処理である。
 */
function createDynamicFakeProviderFinalizationCapability(
  pendingCapability: object,
  context: Omit<DynamicFakeProviderFinalization, "pendingCapability">,
): Readonly<{ kind: "dynamic_fake_provider_finalization" }> {
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_finalization" as const,
  });
  dynamicLifecycleFinalizations.set(
    capability,
    Object.freeze({ pendingCapability, ...context }),
  );
  return capability;
}

/**
 * invalidate Dynamic Fake Provider Lifecycleを決定する。
 *
 * @responsibility invalidate Dynamic Fake Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input capability: object | null
 * @returns N/A: invalidateDynamicFakeProviderLifecycleは戻り値を返さない。
 * @precondition 「capability: object | null」がinvalidateDynamicFakeProviderLifecycleの入力契約を満たす。
 * @postcondition invalidateDynamicFakeProviderLifecycleの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: invalidateDynamicFakeProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidateDynamicFakeProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant invalidateDynamicFakeProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidateDynamicFakeProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security invalidateDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: invalidateDynamicFakeProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
function invalidateDynamicFakeProviderLifecycle(capability: object | null) {
  if (capability) pendingDynamicLifecycleObservations.delete(capability);
}

/**
 * finalize Dynamic Fake Provider Lifecycleを決定する。
 *
 * @responsibility finalize Dynamic Fake Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input pendingCapability: object、finalizationCapability: object
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「pendingCapability: object、finalizationCapability: object」がfinalizeDynamicFakeProviderLifecycleの入力契約を満たす。
 * @postcondition finalizeDynamicFakeProviderLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: finalizeDynamicFakeProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finalizeDynamicFakeProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant finalizeDynamicFakeProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalizeDynamicFakeProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security finalizeDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalizeDynamicFakeProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
function finalizeDynamicFakeProviderLifecycle(
  pendingCapability: object,
  finalizationCapability: object,
): DynamicFakeProviderLifecycleObservation {
  const pending = pendingDynamicLifecycleObservations.get(pendingCapability);
  const finalization = dynamicLifecycleFinalizations.get(
    finalizationCapability,
  );
  pendingDynamicLifecycleObservations.delete(pendingCapability);
  dynamicLifecycleFinalizations.delete(finalizationCapability);
  const absence = finalization
    ? dynamicLifecycleAbsences.get(finalization.absenceCapability)
    : null;
  const hostCleanup = finalization
    ? dynamicLifecycleHostCleanups.get(finalization.hostCleanupCapability)
    : null;
  if (finalization) {
    dynamicLifecycleAbsences.delete(finalization.absenceCapability);
    dynamicLifecycleHostCleanups.delete(finalization.hostCleanupCapability);
  }
  if (!pending || !finalization || !absence || !hostCleanup)
    return dynamicFakeLifecycleBlocked(
      "dynamic_fake_provider_provenance_unverified",
    );
  const eligibility = evaluateDynamicFakeProviderFinalization({
    hasRepositoryOwnedProvenance:
      pending.observation.provenance ===
      "repository_owned_docker_fake_provider",
    hasExactResult: pending.observation.status === "candidate",
    hasValidElapsed:
      typeof pending.observation.elapsedMs === "number" &&
      Number.isSafeInteger(pending.observation.elapsedMs) &&
      pending.observation.elapsedMs >= 0 &&
      pending.observation.elapsedMs <= 30_000,
    hasPostRunMountIdentity:
      pending.mountCapability === finalization.mountCapability,
    hasContainerAbsence:
      absence.probeId === pending.probeId &&
      absence.containerId === pending.containerId &&
      absence.initialHostRecoveryId === pending.hostRecoveryId &&
      absence.confirmedHostRecoveryId !== absence.initialHostRecoveryId,
    hasHostCleanup:
      hostCleanup.probeId === pending.probeId &&
      hostCleanup.confirmedHostRecoveryId === absence.confirmedHostRecoveryId &&
      hostCleanup.absenceCapability === finalization.absenceCapability,
    hasMatchingRunIdentity:
      finalization.pendingCapability === pendingCapability &&
      pending.probeId === finalization.probeId &&
      pending.containerId === finalization.containerId,
  });
  if (eligibility.status !== "candidate")
    return Object.freeze({
      ...pending.observation,
      status: "blocked",
      reason: eligibility.reason,
    });
  return Object.freeze({
    ...pending.observation,
    status: "verified",
    fakeProviderExecuted: true,
    resultNormalizationVerified: true,
    containerAbsenceVerified: true,
    processTreeAbsenceVerified: true,
    hostCleanupVerified: true,
  });
}

/**
 * Docker Submissionを開始する。
 *
 * @responsibility Docker Submissionの開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown」がbeginDockerSubmissionの入力契約を満たす。
 * @postcondition beginDockerSubmissionの責務を完了した結果だけを返す。
 * @effect N/A: beginDockerSubmissionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginDockerSubmissionは独自の失敗分岐を所有しない。
 * @invariant beginDockerSubmissionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginDockerSubmissionはProcess内の同一Subsystemで完結する。
 * @security beginDockerSubmissionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginDockerSubmissionは共有非同期状態を持たない同期処理である。
 */
function beginDockerSubmission(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "host_only",
    "docker_submission_started",
    mountCapability,
  );
}

/**
 * Docker Submission Before Createを取り消す。
 *
 * @responsibility Docker Submission Before Createの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown」がcancelDockerSubmissionBeforeCreateの入力契約を満たす。
 * @postcondition cancelDockerSubmissionBeforeCreateの責務を完了した結果だけを返す。
 * @effect N/A: cancelDockerSubmissionBeforeCreateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelDockerSubmissionBeforeCreateは独自の失敗分岐を所有しない。
 * @invariant cancelDockerSubmissionBeforeCreateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelDockerSubmissionBeforeCreateはProcess内の同一Subsystemで完結する。
 * @security cancelDockerSubmissionBeforeCreateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelDockerSubmissionBeforeCreateは共有非同期状態を持たない同期処理である。
 */
function cancelDockerSubmissionBeforeCreate(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "host_only",
    mountCapability,
  );
}

/**
 * Docker Absenceを確認する。
 *
 * @responsibility Docker Absenceの確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown、capability: unknown、expected: Readonly<{ probeId: string; id: string; rootName: string; cli: ProbeBinding; }>
 * @returns Readonly<{ hostRecoveryId: string; lifecycleAbsenceCapability: object; }>を返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown、capability: unknown、expected: Readonly<{ probeId: string; id: string; rootName: string; cli: ProbeBinding; }>」がconfirmDockerAbsenceの入力契約を満たす。
 * @postcondition confirmDockerAbsenceの責務を完了した結果だけを返す。
 * @effect N/A: confirmDockerAbsenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmDockerAbsenceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmDockerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmDockerAbsenceはProcess内の同一Subsystemで完結する。
 * @security confirmDockerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmDockerAbsenceは共有非同期状態を持たない同期処理である。
 */
function confirmDockerAbsence(
  hostRecoveryId: string,
  mountCapability: unknown,
  capability: unknown,
  expected: Readonly<{
    probeId: string;
    id: string;
    rootName: string;
    cli: ProbeBinding;
    root: string;
  }>,
): Readonly<{
  hostRecoveryId: string;
  lifecycleAbsenceCapability: object;
}> {
  const observation = isObject(capability)
    ? (absenceCapabilities.get(capability) ?? null)
    : null;
  if (
    !observation ||
    observation.hostRecoveryId !== hostRecoveryId ||
    observation.probeId !== expected.probeId ||
    observation.containerId !== expected.id ||
    observation.rootName !== expected.rootName ||
    observation.cli !== expected.cli
  )
    throw new Error("docker_absence_capability_required");
  const updated = transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "docker_absent_confirmed",
    mountCapability,
    expected.root,
  );
  if (isObject(capability)) absenceCapabilities.delete(capability);
  const lifecycleAbsenceCapability = Object.freeze({
    kind: "dynamic_fake_provider_absence",
  });
  dynamicLifecycleAbsences.set(
    lifecycleAbsenceCapability,
    Object.freeze({
      probeId: expected.probeId,
      containerId: expected.id,
      initialHostRecoveryId: hostRecoveryId,
      confirmedHostRecoveryId: updated,
      root: expected.root,
    }),
  );
  return Object.freeze({
    hostRecoveryId: updated,
    lifecycleAbsenceCapability,
  });
}

/**
 * 失敗を固定Schemaへ正規化する。
 *
 * @responsibility 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、fallback
 * @returns stringを返す。
 * @precondition 「error: unknown、fallback」がnormalizeFailureの入力契約を満たす。
 * @postcondition normalizeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeFailure(
  error: unknown,
  fallback = "docker_isolation_probe_failed",
): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_mount_path_unsupported",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = errorMessage(error);
  return message && known.has(message) ? message : fallback;
}

/**
 * 所有 Containerを観測する。
 *
 * @responsibility 所有 Containerの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: ProbeBinding、capability: object、mounts: DockerMounts
 * @returns 構成一致時のRunning肯定事実、またはnullを返す。
 * @precondition 「cli: ProbeBinding、capability: object、mounts: DockerMounts」がinspectOwnedContainerの入力契約を満たす。
 * @postcondition inspectOwnedContainerの責務を完了した結果だけを返す。
 * @effect 下位へ固定inspectとmount実体観測を委譲する。
 * @failure 私有参照欠測・構成差・観測不能はnull。下位例外は呼出し元へ伝播する。
 * @invariant inspectOwnedContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Coordinatorの私有参照とDIのDocker／Filesystem観測。
 * @security inspectOwnedContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectOwnedContainerは共有非同期状態を持たない同期処理である。
 */
function inspectOwnedContainer(
  cli: ProbeBinding,
  capability: object,
  mounts: DockerMounts,
): Readonly<{ runningConfirmed: boolean }> | null {
  const identity = containerIdentities.get(capability);
  if (!identity) return null;
  return inspectDockerProbeContainer(
    cli,
    describeDockerProbeConfiguration(
      identity.profile,
      { id: identity.id, probeId: identity.probeId },
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    ),
  );
}

/**
 * Container Absenceを観測する。
 *
 * @responsibility Container Absenceの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: ProbeBinding、identity: ContainerIdentity、hostRecoveryId: string、rootName: string
 * @returns Readonly<{ kind: "docker_absence" }> | nullを返す。
 * @precondition 「cli: ProbeBinding、identity: ContainerIdentity、hostRecoveryId: string、rootName: string」がobserveContainerAbsenceの入力契約を満たす。
 * @postcondition observeContainerAbsenceの責務を完了した結果だけを返す。
 * @effect 下位の三軸一覧観測と、共同成功時だけの私有参照登録を行う。
 * @failure 三軸の共同成功でなければnull。下位例外は伝播し、参照を登録しない。
 * @invariant observeContainerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary DIの不存在観測とCoordinatorの私有相関登録。
 * @security observeContainerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeContainerAbsenceは共有非同期状態を持たない同期処理である。
 */
function observeContainerAbsence(
  cli: ProbeBinding,
  identity: ContainerIdentity,
  hostRecoveryId: string,
  rootName: string,
): Readonly<{ kind: "docker_absence" }> | null {
  const observed = observeDockerProbeContainerAbsence(cli, {
    id: identity.id,
    probeId: identity.probeId,
  });
  if (
    observed.status !== "confirmed" ||
    observed.reason !== "docker_probe_absence_confirmed"
  )
    return null;
  const capability = Object.freeze({ kind: "docker_absence" });
  absenceCapabilities.set(
    capability,
    Object.freeze({
      probeId: identity.probeId,
      containerId: identity.id,
      hostRecoveryId,
      rootName,
      cli,
    }),
  );
  return capability;
}

/**
 * 所有 Containerを清掃する。
 *
 * @responsibility 所有 Containerの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input cli: ProbeBinding、capability: object、mounts: DockerMounts、hostRecoveryId: string
 * @returns cleanupOwnedContainerの計算結果を返す。
 * @precondition 「cli: ProbeBinding、capability: object、mounts: DockerMounts、hostRecoveryId: string」がcleanupOwnedContainerの入力契約を満たす。
 * @postcondition cleanupOwnedContainerの責務を完了した結果だけを返す。
 * @effect 下位のfresh inspect・実ID限定削除・三軸不存在確認を委譲し、成功時だけ私有参照を登録する。
 * @failure 私有参照欠測・構成差・回収不成立を区別する。下位例外は伝播する。
 * @invariant cleanupOwnedContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary DIの限定回収とCoordinatorの私有参照登録・消費。
 * @security cleanupOwnedContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupOwnedContainerは共有非同期状態を持たない同期処理である。
 */
function cleanupOwnedContainer(
  cli: ProbeBinding,
  capability: object,
  mounts: DockerMounts,
  hostRecoveryId: string,
) {
  const identity = containerIdentities.get(capability);
  if (!identity)
    return { confirmed: false, reason: "docker_container_identity_unknown" };
  const cleanup = cleanupDockerProbeContainer(
    cli,
    describeDockerProbeConfiguration(
      identity.profile,
      { id: identity.id, probeId: identity.probeId },
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    ),
  );
  if (
    cleanup.confirmed !== true ||
    cleanup.reason !== "docker_probe_absence_confirmed"
  )
    return {
      confirmed: false,
      reason:
        cleanup.confirmed === false &&
        cleanup.reason === "docker_container_identity_mismatch"
          ? cleanup.reason
          : "docker_probe_cleanup_failed",
    };
  const absenceCapability = Object.freeze({ kind: "docker_absence" });
  absenceCapabilities.set(
    absenceCapability,
    Object.freeze({
      probeId: identity.probeId,
      containerId: identity.id,
      hostRecoveryId,
      rootName: path.basename(path.dirname(mounts.management)),
      cli,
    }),
  );
  containerIdentities.delete(capability);
  return {
    confirmed: true,
    reason: "docker_probe_absence_confirmed",
    absenceCapability,
  };
}

/**
 * docker-isolationを停止結果として構築する。
 *
 * @responsibility docker-isolationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired
 * @returns DockerProbeResultを返す。
 * @precondition 「reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  reason: string,
  probeId: string | null = null,
  shouldRetainOperationDirectories = false,
  recoveryId: string | null = null,
  isManualRecoveryRequired = false,
): DockerProbeResult {
  return {
    status: "blocked",
    reason,
    probeId,
    retainOperationDirectories: shouldRetainOperationDirectories,
    hostCleanupCompleted: false,
    recoveryId,
    manualRecoveryRequired: isManualRecoveryRequired,
    cleanup: shouldRetainOperationDirectories
      ? "unconfirmed"
      : "not_required_or_confirmed",
    fakeProviderLifecycle: dynamicFakeLifecycleBlocked(reason),
  };
}

/**
 * Docker Probe 失敗を固定Schemaへ正規化する。
 *
 * @responsibility Docker Probe 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、probeId: string、state: DockerProbeFailureState
 * @returns DockerProbeResultを返す。
 * @precondition 「error: unknown、probeId: string、state: DockerProbeFailureState」がnormalizeDockerProbeFailureの入力契約を満たす。
 * @postcondition normalizeDockerProbeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDockerProbeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDockerProbeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeDockerProbeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDockerProbeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeDockerProbeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDockerProbeFailureは共有非同期状態を持たない同期処理である。
 */
export function normalizeDockerProbeFailure(
  error: unknown,
  probeId: string,
  state: DockerProbeFailureState,
): DockerProbeResult {
  if (state.rollbackFailed === true) {
    return blocked(
      "docker_submission_rollback_failed",
      probeId,
      true,
      null,
      true,
    );
  }
  return blocked(
    normalizeFailure(error),
    probeId,
    state.submissionStarted,
    state.submissionStarted ? state.recoveryId : state.hostRecoveryId,
  );
}

/**
 * Host 回復を終了状態へ収束させる。
 *
 * @responsibility Host 回復の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string、lifecycleAbsenceCapability: object
 * @returns Readonly<{ result: DockerProbeResult; lifecycleHostCleanupCapability: object | null; }>を返す。
 * @precondition 「hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string、lifecycleAbsenceCapability: object」がfinishHostRecoveryの入力契約を満たす。
 * @postcondition finishHostRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: finishHostRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finishHostRecoveryは独自の失敗分岐を所有しない。
 * @invariant finishHostRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishHostRecoveryはProcess内の同一Subsystemで完結する。
 * @security finishHostRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishHostRecoveryは共有非同期状態を持たない同期処理である。
 */
function finishHostRecovery(
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
  lifecycleAbsenceCapability: object,
): Readonly<{
  result: DockerProbeResult;
  lifecycleHostCleanupCapability: object | null;
}> {
  const absence = dynamicLifecycleAbsences.get(lifecycleAbsenceCapability);
  if (
    !absence ||
    absence.probeId !== probeId ||
    absence.confirmedHostRecoveryId !== hostRecoveryId
  )
    throw new Error("docker_absence_capability_required");
  const recovered = recoverOwnedOperationDirectories(
    hostRecoveryId,
    null,
    absence.root,
  );
  const result = normalizeHostCleanupResult(
    recovered,
    hostRecoveryId,
    baseResult,
    probeId,
  );
  if (!result.hostCleanupCompleted)
    return Object.freeze({ result, lifecycleHostCleanupCapability: null });
  const lifecycleHostCleanupCapability = Object.freeze({
    kind: "dynamic_fake_provider_host_cleanup",
  });
  dynamicLifecycleHostCleanups.set(
    lifecycleHostCleanupCapability,
    Object.freeze({
      probeId,
      confirmedHostRecoveryId: hostRecoveryId,
      absenceCapability: lifecycleAbsenceCapability,
    }),
  );
  return Object.freeze({ result, lifecycleHostCleanupCapability });
}

/**
 * Host 清掃 結果を固定Schemaへ正規化する。
 *
 * @responsibility Host 清掃 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recovered: Readonly<{ status: string; reason: string }>、hostRecoveryId: string、baseResult: Partial<DockerProbeResult>、probeId: string | null
 * @returns DockerProbeResultを返す。
 * @precondition 「recovered: Readonly<{ status: string; reason: string }>、hostRecoveryId: string、baseResult: Partial<DockerProbeResult>、probeId: string | null」がnormalizeHostCleanupResultの入力契約を満たす。
 * @postcondition normalizeHostCleanupResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeHostCleanupResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeHostCleanupResultは独自の失敗分岐を所有しない。
 * @invariant normalizeHostCleanupResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeHostCleanupResultはProcess内の同一Subsystemで完結する。
 * @security normalizeHostCleanupResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeHostCleanupResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeHostCleanupResult(
  recovered: Readonly<{ status: string; reason: string }>,
  hostRecoveryId: string,
  baseResult: Partial<DockerProbeResult> = {},
  probeId: string | null = null,
): DockerProbeResult {
  return recovered?.status === "recovered"
    ? {
        ...blocked(
          typeof baseResult.reason === "string"
            ? baseResult.reason
            : "host_cleanup_recovered",
          typeof baseResult.probeId === "string" ? baseResult.probeId : probeId,
        ),
        ...baseResult,
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      }
    : blocked(
        recovered?.reason ?? "host_recovery_failed",
        probeId,
        true,
        hostRecoveryId,
      );
}

/**
 * Pre Submission 清掃を終了状態へ収束させる。
 *
 * @responsibility Pre Submission 清掃の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string」がfinishPreSubmissionCleanupの入力契約を満たす。
 * @postcondition finishPreSubmissionCleanupの責務を完了した結果だけを返す。
 * @effect N/A: finishPreSubmissionCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure finishPreSubmissionCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant finishPreSubmissionCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishPreSubmissionCleanupはProcess内の同一Subsystemで完結する。
 * @security finishPreSubmissionCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishPreSubmissionCleanupは共有非同期状態を持たない同期処理である。
 */
function finishPreSubmissionCleanup(
  owned: unknown,
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
): DockerProbeResult {
  try {
    cleanupOwnedOperationDirectories(owned);
    return {
      ...baseResult,
      hostCleanupCompleted: true,
      retainOperationDirectories: false,
      recoveryId: null,
      cleanup: "confirmed",
    };
  } catch {
    return {
      ...blocked(
        "host_operation_cleanup_failed",
        probeId,
        true,
        hostRecoveryId,
      ),
    };
  }
}

/**
 * Docker Isolation Scenarioを実行する。
 *
 * @responsibility Docker Isolation Scenarioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、scenario: DynamicFakeProviderFailureScenario | null
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、scenario: DynamicFakeProviderFailureScenario | null」がrunDockerIsolationScenarioの入力契約を満たす。
 * @postcondition runDockerIsolationScenarioの責務を完了した結果だけを返す。
 * @effect N/A: runDockerIsolationScenarioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runDockerIsolationScenarioは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runDockerIsolationScenarioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDockerIsolationScenarioはProcess内の同一Subsystemで完結する。
 * @security runDockerIsolationScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDockerIsolationScenarioは共有非同期状態を持たない同期処理である。
 */
function runDockerIsolationScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario | null,
): DockerProbeResult {
  const probeId = randomUUID();
  let cli: ProbeBinding | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasRollbackFailed = false;
  const recoveryNonce = randomUUID();
  let result: DockerProbeResult = blocked("docker_isolation_probe_failed");
  let dynamicLifecycleCapability: Readonly<{
    kind: "dynamic_fake_provider_lifecycle";
  }> | null = null;
  try {
    cli = createDockerProbeRuntimeBinding(() => {
      mountCapability = createOwnedMountCapability(owned);
      mounts = verifyOwnedMountCapability(mountCapability);
      return mounts.management;
    });
    if (!mountCapability)
      throw new Error("owned_operation_mount_capability_required");
    if (!observeDockerProbeEngine(cli)) {
      result = blocked("local_docker_desktop_linux_engine_required", probeId);
    } else {
      mounts = verifyOwnedMountCapability(mountCapability);
      hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
      hasSubmissionStarted = true;
      try {
        recoveryId = writeDockerProbeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          null,
        );
      } catch (error) {
        try {
          hostRecoveryId = cancelDockerSubmissionBeforeCreate(
            hostRecoveryId,
            mountCapability,
          );
          hasSubmissionStarted = false;
        } catch {
          hasRollbackFailed = true;
        }
        throw error;
      }
      hasContainerCreateAttempted = true;
      const creationCli = cli;
      const normalizedCreation = createDockerProbeContainer(
        creationCli,
        scenario ?? "normal",
        probeId,
        {
          workspace: mounts.workspace,
          providerHome: mounts.providerHome,
          tmp: mounts.tmp,
        },
      );
      if (normalizedCreation.status !== "confirmed") {
        result = blocked(
          "docker_container_identity_unknown",
          probeId,
          true,
          recoveryId,
        );
      } else {
        const identity = Object.freeze({
          id: normalizedCreation.id,
          probeId,
          profile: scenario ?? "normal",
        });
        containerIdentity = identity;
        containerCapability = Object.freeze({ kind: "owned_docker_probe" });
        containerIdentities.set(containerCapability, identity);
        recoveryId = writeDockerProbeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          identity.id,
        );
        mounts = verifyOwnedMountCapability(mountCapability);
        if (!inspectOwnedContainer(cli, containerCapability, mounts)) {
          result = blocked(
            "docker_container_security_profile_mismatch",
            probeId,
            true,
            recoveryId,
          );
        } else {
          mounts = verifyOwnedMountCapability(mountCapability);
          const executionCli = cli;
          const facts = runDockerProbeToCompletion(
            executionCli,
            scenario ?? "normal",
            identity.id,
          );
          const normalized = facts.isolation;
          result = {
            ...blocked(normalized.reason, probeId),
            status: normalized.status === "confirmed" ? "confirmed" : "blocked",
            fakeProviderLifecycle: dynamicFakeLifecycleBlocked(
              "dynamic_fake_provider_absence_unconfirmed",
            ),
          };
          mounts = verifyOwnedMountCapability(mountCapability);
          dynamicLifecycleCapability =
            createDynamicFakeProviderLifecycleCapability(facts, {
              probeId,
              containerId: identity.id,
              mountCapability,
              hostRecoveryId,
            });
        }
      }
    }
  } catch (error) {
    result = normalizeDockerProbeFailure(error, probeId, {
      submissionStarted: hasSubmissionStarted,
      recoveryId,
      hostRecoveryId,
      rollbackFailed: hasRollbackFailed,
    });
  } finally {
    if (containerCapability && cli && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed) {
          invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
          result = blocked(cleanup.reason, probeId, true, recoveryId);
        } else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity?.id ?? "",
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
              root: path.dirname(mounts.management),
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const hostCleanup = finishHostRecovery(
            hostRecoveryId,
            result,
            probeId,
            absence.lifecycleAbsenceCapability,
          );
          result = hostCleanup.result;
          if (
            dynamicLifecycleCapability &&
            mountCapability &&
            containerIdentity &&
            result.status === "confirmed" &&
            result.hostCleanupCompleted &&
            hostCleanup.lifecycleHostCleanupCapability
          ) {
            const finalizationCapability =
              createDynamicFakeProviderFinalizationCapability(
                dynamicLifecycleCapability,
                {
                  probeId,
                  containerId: containerIdentity.id,
                  mountCapability,
                  absenceCapability: absence.lifecycleAbsenceCapability,
                  hostCleanupCapability:
                    hostCleanup.lifecycleHostCleanupCapability,
                },
              );
            const lifecycle = finalizeDynamicFakeProviderLifecycle(
              dynamicLifecycleCapability,
              finalizationCapability,
            );
            result = {
              ...result,
              status:
                lifecycle.status === "verified" ? result.status : "blocked",
              reason:
                lifecycle.status === "verified"
                  ? result.reason
                  : lifecycle.reason,
              fakeProviderLifecycle: lifecycle,
            };
          } else {
            invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
            const failureReason =
              result.status === "blocked"
                ? result.reason
                : "dynamic_fake_provider_finalization_incomplete";
            result = {
              ...result,
              status: "blocked",
              reason: failureReason,
              fakeProviderLifecycle: dynamicFakeLifecycleBlocked(failureReason),
            };
          }
        }
      } catch {
        invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
        result = blocked(
          "docker_probe_cleanup_failed",
          probeId,
          true,
          recoveryId,
        );
      }
    } else if (!hasSubmissionStarted) {
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
      result = finishPreSubmissionCleanup(
        owned,
        hostRecoveryId,
        result,
        probeId,
      );
    }
    if (hasSubmissionStarted && !containerCapability)
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
  }
  return {
    ...result,
    fakeProviderLifecycle: Object.freeze({
      ...result.fakeProviderLifecycle,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
    }),
  };
}

/**
 * Docker Isolation Probeを実行する。
 *
 * @responsibility Docker Isolation Probeの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown」がrunDockerIsolationProbeの入力契約を満たす。
 * @postcondition runDockerIsolationProbeの責務を完了した結果だけを返す。
 * @effect N/A: runDockerIsolationProbeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runDockerIsolationProbeは独自の失敗分岐を所有しない。
 * @invariant runDockerIsolationProbeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDockerIsolationProbeはProcess内の同一Subsystemで完結する。
 * @security runDockerIsolationProbeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDockerIsolationProbeは共有非同期状態を持たない同期処理である。
 */
export function runDockerIsolationProbe(owned: unknown): DockerProbeResult {
  return runDockerIsolationScenario(owned, null);
}

/**
 * Dynamic Fake Provider 失敗 Scenarioを実行する。
 *
 * @responsibility Dynamic Fake Provider 失敗 Scenarioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、scenario: DynamicFakeProviderFailureScenario
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、scenario: DynamicFakeProviderFailureScenario」がrunDynamicFakeProviderFailureScenarioの入力契約を満たす。
 * @postcondition runDynamicFakeProviderFailureScenarioの責務を完了した結果だけを返す。
 * @effect N/A: runDynamicFakeProviderFailureScenarioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runDynamicFakeProviderFailureScenarioは独自の失敗分岐を所有しない。
 * @invariant runDynamicFakeProviderFailureScenarioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDynamicFakeProviderFailureScenarioはProcess内の同一Subsystemで完結する。
 * @security runDynamicFakeProviderFailureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDynamicFakeProviderFailureScenarioは共有非同期状態を持たない同期処理である。
 */
export function runDynamicFakeProviderFailureScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario,
): DockerProbeResult {
  return runDockerIsolationScenario(owned, scenario);
}

/**
 * Dynamic Fake Provider Cancellation Verificationを実行する。
 *
 * @responsibility Dynamic Fake Provider Cancellation Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Promise<DynamicFakeProviderCancellationResult>を返す。
 * @precondition 「owned: unknown」がrunDynamicFakeProviderCancellationVerificationの入力契約を満たす。
 * @postcondition runDynamicFakeProviderCancellationVerificationの責務を完了した結果だけを返す。
 * @effect 上位二保存とHost遷移・清掃を行い、固定Docker技術処置をDIへ委譲する。
 * @failure runDynamicFakeProviderCancellationVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 同じ実ID・回復参照を保持し、下位候補だけで公開verifiedにしない。
 * @boundary 上位保存・Host所有とDI取消事実の受渡し。
 * @security runDynamicFakeProviderCancellationVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runDynamicFakeProviderCancellationVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runDynamicFakeProviderCancellationVerification(
  owned: unknown,
): Promise<DynamicFakeProviderCancellationResult> {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let cli: ProbeBinding | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let recoveryId: string | null = null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasPostRunMountVerified = false;
  let hasAttachProcessTerminationObserved = false;
  let attachProcessTerminationRequestCount = 0;
  let base = cancellationBlocked(
    "dynamic_fake_provider_cancellation_verification_failed",
  );
  try {
    cli = createDockerProbeRuntimeBinding(() => {
      mountCapability = createOwnedMountCapability(owned);
      mounts = verifyOwnedMountCapability(mountCapability);
      return mounts.management;
    });
    if (!observeDockerProbeEngine(cli))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
    hasSubmissionStarted = true;
    try {
      recoveryId = writeDockerProbeRecoveryRecord(
        mounts,
        probeId,
        recoveryNonce,
        hostRecoveryId,
        null,
      );
    } catch (error) {
      try {
        hostRecoveryId = cancelDockerSubmissionBeforeCreate(
          hostRecoveryId,
          mountCapability,
        );
        hasSubmissionStarted = false;
      } catch {
        hasSubmissionStarted = true;
      }
      throw error;
    }
    hasContainerCreateAttempted = true;
    const creationCli = cli;
    const normalizedCreation = createDockerProbeContainer(
      creationCli,
      "cancellation",
      probeId,
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    );
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    containerIdentity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      profile: "cancellation",
    });
    containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, containerIdentity);
    recoveryId = writeDockerProbeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      containerIdentity.id,
    );
    const executionCli = cli;
    const executionMountCapability = mountCapability;
    const facts = await runDockerProbeCancellation(
      executionCli,
      { id: containerIdentity.id, probeId },
      () => {
        mounts = verifyOwnedMountCapability(executionMountCapability);
        return {
          workspace: mounts.workspace,
          providerHome: mounts.providerHome,
          tmp: mounts.tmp,
        };
      },
    );
    base = Object.freeze({
      ...base,
      ...facts.observation,
      status: facts.status,
      reason: facts.reason,
    });
    hasPostRunMountVerified = facts.postRunMountVerified;
    hasAttachProcessTerminationObserved =
      facts.attachProcessTerminationObserved;
    attachProcessTerminationRequestCount =
      facts.attachProcessTerminationRequestCount;
  } catch (error) {
    base = Object.freeze({
      ...base,
      status: "blocked",
      reason: normalizeCancellationFailure(error),
    });
  } finally {
    if (containerCapability && containerIdentity && cli && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed)
          base = Object.freeze({
            ...base,
            status: "blocked",
            reason: cleanup.reason,
            retainOperationDirectories: true,
            recoveryId,
            manualRecoveryRequired: true,
            cleanup: "unconfirmed",
          });
        else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity.id,
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
              root: path.dirname(mounts.management),
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const recovered = recoverOwnedOperationDirectories(
            hostRecoveryId,
            null,
            path.dirname(mounts.management),
          );
          const isHostCleanupVerified = recovered.status === "recovered";
          const isVerified =
            base.status === "candidate" &&
            hasPostRunMountVerified &&
            hasAttachProcessTerminationObserved &&
            isHostCleanupVerified;
          base = Object.freeze({
            ...base,
            status: isVerified ? "verified" : "blocked",
            reason: isVerified
              ? "dynamic_fake_provider_cancellation_verified"
              : isHostCleanupVerified
                ? base.reason
                : recovered.reason,
            containerAbsenceVerified: true,
            attachProcessTerminationObserved:
              hasAttachProcessTerminationObserved,
            hostCleanupVerified: isHostCleanupVerified,
            retainOperationDirectories: !isHostCleanupVerified,
            recoveryId: isHostCleanupVerified ? null : hostRecoveryId,
            manualRecoveryRequired: !isHostCleanupVerified,
            cleanup: isHostCleanupVerified ? "confirmed" : "unconfirmed",
          });
        }
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "docker_probe_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
        base = Object.freeze({
          ...base,
          hostCleanupVerified: true,
          cleanup: "confirmed",
        });
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "host_operation_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId: hostRecoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else {
      base = Object.freeze({
        ...base,
        status: "blocked",
        retainOperationDirectories: true,
        recoveryId,
        manualRecoveryRequired: true,
        cleanup: "unconfirmed",
      });
    }
  }
  return Object.freeze({
    ...base,
    attachProcessTerminationObserved: hasAttachProcessTerminationObserved,
    attachProcessTerminationRequestCount,
    diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
    diagnosticFilesystemEffectIssued: true,
  });
}

/**
 * 回復E2E用に同じ実IDへ結合した稼働残存を一件作成する。
 *
 * @responsibility Dynamic Fake Provider Recoverable Residueの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns DynamicFakeProviderRecoverableResidueResultを返す。
 * @precondition 「owned: unknown」がcreateDynamicFakeProviderRecoverableResidueの入力契約を満たす。
 * @postcondition createDynamicFakeProviderRecoverableResidueの責務を完了した結果だけを返す。
 * @effect 二保存・Host遷移を行い、固定作成・稼働確認をDIへ委譲する。成功時は意図的に回収しない。
 * @failure createDynamicFakeProviderRecoverableResidueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 作成不明・保存失敗・稼働不明をreadyへ昇格しない。
 * @boundary 上位保存・Host所有とDIの固定稼働残存。
 * @security createDynamicFakeProviderRecoverableResidueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderRecoverableResidueは共有非同期状態を持たない同期処理である。
 */
export function createDynamicFakeProviderRecoverableResidue(
  owned: unknown,
): DynamicFakeProviderRecoverableResidueResult {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  try {
    let mounts: DockerMounts;
    const cli = createDockerProbeRuntimeBinding(() => {
      mountCapability = createOwnedMountCapability(owned);
      mounts = verifyOwnedMountCapability(mountCapability);
      return mounts.management;
    });
    if (!observeDockerProbeEngine(cli))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
    hasSubmissionStarted = true;
    recoveryId = writeDockerProbeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      null,
    );
    hasContainerCreateAttempted = true;
    const normalizedCreation = createDockerProbeContainer(
      cli,
      "cancellation",
      probeId,
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    );
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    const identity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      profile: "cancellation",
    });
    const containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, identity);
    recoveryId = writeDockerProbeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      identity.id,
    );
    startDockerProbeResidue(cli, { id: identity.id, probeId }, () => {
      const current = verifyOwnedMountCapability(mountCapability);
      return {
        workspace: current.workspace,
        providerHome: current.providerHome,
        tmp: current.tmp,
      };
    });
    return Object.freeze({
      status: "ready" as const,
      reason: "dynamic_fake_provider_recoverable_residue_ready",
      recoveryId,
      manualRecoveryRequired: true,
      containerRunning: true,
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false as const,
      runtimeAuthorityIssued: false as const,
      operationCapabilityIssued: false as const,
      realProviderReadiness: false as const,
    });
  } catch (error) {
    if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        // The blocked result remains recovery-authoritative.
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: normalizeFailure(
        error,
        "dynamic_fake_provider_recoverable_residue_failed",
      ),
      recoveryId,
      manualRecoveryRequired: recoveryId !== null || hasSubmissionStarted,
      containerRunning: false,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false as const,
      runtimeAuthorityIssued: false as const,
      operationCapabilityIssued: false as const,
      realProviderReadiness: false as const,
    });
  }
}

/**
 * expected Dynamic Fake Provider 失敗 Reasonを決定する。
 *
 * @responsibility expected Dynamic Fake Provider 失敗 Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input scenario: DynamicFakeProviderFailureScenario
 * @returns stringを返す。
 * @precondition 「scenario: DynamicFakeProviderFailureScenario」がexpectedDynamicFakeProviderFailureReasonの入力契約を満たす。
 * @postcondition expectedDynamicFakeProviderFailureReasonの責務を完了した結果だけを返す。
 * @effect N/A: expectedDynamicFakeProviderFailureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedDynamicFakeProviderFailureReasonは独自の失敗分岐を所有しない。
 * @invariant expectedDynamicFakeProviderFailureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedDynamicFakeProviderFailureReasonはProcess内の同一Subsystemで完結する。
 * @security expectedDynamicFakeProviderFailureReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedDynamicFakeProviderFailureReasonは共有非同期状態を持たない同期処理である。
 */
export function expectedDynamicFakeProviderFailureReason(
  scenario: DynamicFakeProviderFailureScenario,
): string {
  return FAILURE_SCENARIO_SPECS[scenario].expectedReason;
}

/**
 * Docker診断の回復を同じHost世代の排他内で処置する。
 *
 * @responsibility 対象を読む前の世代排他、回復記録の現在確認、Docker資源確認、Host清掃と解放を順序付ける。
 * @trace ARCH-000008
 * @input 元のexactなDocker診断回復Token。
 * @returns recoveredまたはblocked。未解決時は現在のexact参照を保持する。
 * @precondition 元Tokenを提示し、既存生成入口のUUID由来Rootと同じ世代へ結合する。Schema・Hash・対象実体は取得後に確認する。
 * @postcondition 成功はHost清掃と取得した排他の解放がともに成立した場合だけ返す。
 * @effect 回復記録の読取り、既存Host排他の取得・解放、必要なDocker回収とHost清掃。
 * @failure 不正なRoot世代、未取得、Host結合差、下位失敗、解放未確認では停止し、成功へ畳まない。
 * @invariant Root由来Host nonceをProbe nonceと混同せず、取得後の記録と照合した同じ排他をHost清掃へ渡す。
 * @boundary 公開診断回復から既存Host世代・Docker・Filesystemへの境界。
 * @security Tokenを新設せず、元Task再実行、Provider依頼、Docker再起動を行わない。
 * @concurrency 既存Host／Docker Task回復と同じ対象排他をRoot初回読取り前から清掃終了まで保持する。
 */
export function recoverDockerIsolationProbe(
  token: unknown,
  expectedRoot: unknown,
) {
  let activeRecoveryId = token;
  let generation: object | null = null;
  const result = (() => {
    try {
      const selected = parseDockerProbeRecoveryToken(token);
      const hostNonce = selected.rootName.slice(
        "crdd-coordinator-doctor-".length,
      );
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          hostNonce,
        )
      )
        throw new Error("docker_recovery_host_generation_mismatch");
      if (
        typeof expectedRoot !== "string" ||
        !path.isAbsolute(expectedRoot) ||
        path.resolve(expectedRoot) !== expectedRoot ||
        path.basename(expectedRoot) !== selected.rootName
      )
        throw new Error("docker_recovery_boundary_failed");
      const parent = path.dirname(expectedRoot);
      if (fs.realpathSync(parent) !== parent)
        throw new Error("docker_recovery_boundary_failed");
      generation = acquireHostOperationRecoveryGenerationByIdentity(
        path.join(parent, selected.rootName),
        hostNonce,
      );
      if (!generation)
        return {
          status: "blocked",
          reason: "docker_recovery_host_generation_active_or_unknown",
          recoveryId: activeRecoveryId,
          hostCleanupCompleted: false,
        };
      const recovery = loadDockerProbeRecoveryRecord(token, expectedRoot);
      const host = parseHostRecoveryToken(recovery.record.hostRecoveryId);
      if (
        host.rootName !== selected.rootName ||
        host.rootName !== recovery.parsed.rootName ||
        host.nonce !== hostNonce
      )
        throw new Error("docker_recovery_host_generation_mismatch");
      const cli = createDockerProbeRuntimeBinding(
        () => recovery.children.management,
      );
      const containerId = recovery.record.container.id;
      if (!containerId) {
        return {
          status: "blocked",
          reason: "docker_recovery_container_identity_unknown",
          recoveryId: token,
        };
      }
      const identity: ContainerIdentity = {
        id: containerId,
        probeId: recovery.record.probeId,
        profile: "legacy_recovery",
      };
      let absenceCapability = null;
      if (identity.id) {
        absenceCapability = observeContainerAbsence(
          cli,
          identity,
          recovery.record.hostRecoveryId,
          recovery.record.rootName,
        );
        if (!absenceCapability) {
          const mounts = requireDockerProbeRecoveryMounts(recovery);
          const capability = Object.freeze({ kind: "recovered_docker_probe" });
          containerIdentities.set(capability, Object.freeze(identity));
          const inspect = inspectOwnedContainer(cli, capability, mounts);
          if (!inspect)
            return {
              status: "blocked",
              reason: "docker_recovery_container_mismatch",
              recoveryId: token,
            };
          const cleanup = cleanupOwnedContainer(
            cli,
            capability,
            mounts,
            recovery.record.hostRecoveryId,
          );
          if (!cleanup.confirmed)
            return {
              status: "blocked",
              reason: cleanup.reason,
              recoveryId: token,
            };
          absenceCapability = cleanup.absenceCapability;
        }
      }
      const absence = confirmDockerAbsence(
        recovery.record.hostRecoveryId,
        null,
        absenceCapability,
        {
          probeId: identity.probeId,
          id: identity.id,
          rootName: recovery.record.rootName,
          cli,
          root: recovery.root,
        },
      );
      activeRecoveryId = absence.hostRecoveryId;
      const recovered = recoverOwnedOperationDirectories(
        absence.hostRecoveryId,
        generation,
      );
      const normalized = normalizeHostCleanupResult(
        recovered,
        absence.hostRecoveryId,
        {
          status: "recovered",
          reason: "docker_probe_recovery_completed",
        },
      );
      return normalized.hostCleanupCompleted
        ? normalized
        : { ...normalized, status: "blocked" };
    } catch (error) {
      return {
        status: "blocked",
        reason: normalizeFailure(error, "docker_probe_recovery_failed"),
        recoveryId: activeRecoveryId,
        hostCleanupCompleted: false,
      };
    }
  })();
  if (generation && !releaseHostOperationRecoveryGeneration(generation))
    return {
      ...result,
      status: "blocked",
      reason: "docker_recovery_host_generation_release_unconfirmed",
      recoveryId: activeRecoveryId,
      hostCleanupCompleted: false,
      cleanup: "unconfirmed",
      retainOperationDirectories: true,
      manualRecoveryRequired: true,
    };
  return result;
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  ...describeDockerProbeResource("profile").runtimeProfile,
  dynamicFakeProviderProcessImplemented: true,
  realProviderProcessesExecuted: false,
});
