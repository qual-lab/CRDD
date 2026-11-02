/**
 * 合成Providerの取消・意図的残存を確認する検証専用処理。
 * @packageDocumentation
 * @responsibility 固定試験の作成・取消・回収と保存順序を保ち、製品APIから分離する。
 * @trace ERB-IT-004
 * @boundary scripts/tests専用。通常doctor・Task・Recoveryから呼び出さない。
 * @security 実行は各検証Toolの明示許可境界に従い、importだけで資源を操作しない。
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { cleanupDockerContainer } from "../../docker-isolation/src/index.ts";
import {
  createDockerProbeRuntimeBinding,
  observeDockerProbeEngine,
  createDockerProbeContainer,
  describeDockerProbeConfiguration,
  runDockerProbeCancellation,
  startDockerProbeResidue,
  type DockerProbeProfile,
} from "../../docker-isolation/tests/support/probe.ts";
import type { DockerContainerBinding as ProbeBinding } from "../../docker-isolation/src/cleanup/container.ts";
import {
  createOwnedMountCapability,
  verifyOwnedMountCapability,
  getOwnedHostRecoveryId,
  transitionHostRecoveryState,
  cleanupOwnedOperationDirectories,
  recoverOwnedOperationDirectories,
} from "../src/execution/operation.ts";
import {
  writeDockerProbeRecoveryRecord,
  type DockerMounts,
} from "../src/state/probe-record.ts";

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
  cli: object;
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

const containerIdentities = new WeakMap<object, ContainerIdentity>();
const absenceCapabilities = new WeakMap<object, AbsenceObservation>();
const dynamicLifecycleAbsences = new WeakMap<
  object,
  DynamicFakeProviderAbsence
>();

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
function isolationProbeIsObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
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
function isolationProbeOwnValue(value: object, key: string): unknown {
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
  const candidate = isolationProbeIsObject(value)
    ? isolationProbeOwnValue(value, key)
    : undefined;
  return typeof candidate === "string" ? candidate : null;
}

function isolationProbeErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
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
  const message = isolationProbeErrorMessage(error);
  return message && known.has(message)
    ? message
    : "dynamic_fake_provider_cancellation_verification_failed";
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
    cli: object;
    root: string;
  }>,
): Readonly<{
  hostRecoveryId: string;
  lifecycleAbsenceCapability: object;
}> {
  const observation = isolationProbeIsObject(capability)
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
  if (isolationProbeIsObject(capability))
    absenceCapabilities.delete(capability);
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
  const message = isolationProbeErrorMessage(error);
  return message && known.has(message) ? message : fallback;
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
  const cleanup = cleanupDockerContainer(
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
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    cli = createDockerProbeRuntimeBinding(mounts.management, {
      workspace: mounts.workspace,
      providerHome: mounts.providerHome,
      tmp: mounts.tmp,
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
    const executionMounts = verifyOwnedMountCapability(mountCapability);
    const facts = await runDockerProbeCancellation(
      executionCli,
      { id: containerIdentity.id, probeId },
      {
        workspace: executionMounts.workspace,
        providerHome: executionMounts.providerHome,
        tmp: executionMounts.tmp,
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
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    const cli = createDockerProbeRuntimeBinding(mounts.management, {
      workspace: mounts.workspace,
      providerHome: mounts.providerHome,
      tmp: mounts.tmp,
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
    const current = verifyOwnedMountCapability(mountCapability);
    startDockerProbeResidue(
      cli,
      { id: identity.id, probeId },
      {
        workspace: current.workspace,
        providerHome: current.providerHome,
        tmp: current.tmp,
      },
    );
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
