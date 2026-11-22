/**
 * 合成Providerの取消・意図的残存を同じEM Host記録で検証する。
 * @packageDocumentation
 * @responsibility 作成前Intent・Receipt・実行・資源終結・Host清掃を順序付ける。
 * @trace ERB-IT-004
 * @boundary scripts/tests専用。DIは技術通知だけを返し、EMへ依存しない。
 * @security importだけで実行しない。実境界試験には別途実行許可を要する。
 */
import { randomUUID } from "node:crypto";
import {
  applyResourceEvent,
  applyResourceCleanup,
} from "../../../execution-model/src/index.ts";
import type { ResourceTarget } from "../../../executor/src/index.ts";
import { cleanupDockerContainer } from "../../../docker-isolation/src/cleanup/container.ts";
import {
  createDockerProbeContainer,
  createDockerProbeRuntimeBinding,
  describeDockerProbeConfiguration,
  observeDockerProbeEngine,
  runDockerProbeCancellation,
  startDockerProbeResidue,
} from "../../../docker-isolation/tests/support/probe.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  readOwnedHostOperation,
  recordOwnedHostResources,
  verifyOwnedMountCapability,
} from "../../src/lifecycle/host.ts";

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

/** 例外から文字列messageだけを取り出し、取得できなければnullを返す。 */
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
 * 元のDI通知だけを同じHostへ記録する。
 * @responsibility 作成要求前と作成Receiptの同期保存拒否を後続Effect停止へ接続する。
 * @trace ERB-IT-004
 * @effect 同じEM HostのCheckpointだけ。新しい記録やCapability連鎖を作らない。
 */
function createProbeRecording(owned: unknown) {
  const mount = createOwnedMountCapability(owned);
  const context = createOwnedOperationContextCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mount);
  const mounts = verifyOwnedMountCapability(mount);
  let submitted = false;
  const save = (
    event: "submission" | "receipt",
    target: ResourceTarget<"snapshot">,
  ) => {
    const currentMounts = verifyOwnedMountCapability(mount);
    if (
      target.managementDirectory !== currentMounts.management ||
      target.unreceiptedAbsence !== "retain"
    )
      throw Error("docker_probe_recovery_boundary_failed");
    const {
      managementDirectory: _directory,
      resources: snapshot,
      previouslyAbsent: _absent,
      ...cleanup
    } = target;
    const current = readOwnedHostOperation(management);
    const book = applyResourceEvent(current.record.resources, {
      event,
      key: "probe",
      snapshot,
      cleanup,
    });
    if (!book) throw Error("docker_probe_checkpoint_unconfirmed");
    recordOwnedHostResources(management, book);
  };
  return {
    management,
    mounts,
    current: () => verifyOwnedMountCapability(mount),
    submitted: () => submitted,
    notifications: {
      managementDirectory: mounts.management,
      onSubmitting: (target: ResourceTarget<"snapshot">) => {
        save("submission", target);
        submitted = true;
      },
      onCreated: (id: string, target: ResourceTarget<"snapshot">) => {
        if (
          target.resources.resources.find((r) => r.key === "probe")?.identity
            .dockerId !== id
        )
          throw Error("docker_probe_receipt_mismatch");
        save("receipt", target);
      },
    },
  };
}

/** 実ID回収確認後だけ不存在を同じHostへ保存する。 @trace ERB-IT-004 */
function saveProbeAbsence(management: unknown, id: string, recoveryId: string) {
  const current = readOwnedHostOperation(management);
  const resources = current.record.resources;
  if (
    !resources ||
    resources.snapshot.resources.find((r) => r.key === "probe")?.identity
      .dockerId !== id
  )
    throw Error("docker_probe_receipt_mismatch");
  const next = applyResourceCleanup(
    resources,
    resources.snapshot,
    [{ key: "probe", observation: "absent" }],
    { recoveryId, previousPayloadSha256: current.payloadSha256 },
  );
  if (!next) throw Error("docker_probe_checkpoint_unconfirmed");
  recordOwnedHostResources(management, next);
}

/**
 * 固定取消試験のready・一回取消・attach終了・資源不存在を観測する。
 * @responsibility 保存を跨いでstartせず、Process終了不明ではHostを回収しない。
 * @trace ERB-IT-004
 * @effect 明示的な試験実行時だけDocker・EM・自己所有Hostへ作用する。
 */
export async function runDynamicFakeProviderCancellationVerification(
  owned: unknown,
): Promise<DynamicFakeProviderCancellationResult> {
  const probeId = randomUUID(),
    recoveryId = getOwnedHostRecoveryId(owned);
  const recording = createProbeRecording(owned);
  let base = {
    ...cancellationBlocked(
      "dynamic_fake_provider_cancellation_verification_failed",
    ),
    retainOperationDirectories: true,
    recoveryId,
    manualRecoveryRequired: true,
  } as DynamicFakeProviderCancellationResult;
  let creationAttempted = false;
  try {
    const mounts = recording.current();
    const cli = createDockerProbeRuntimeBinding(mounts.management, mounts);
    if (!observeDockerProbeEngine(cli))
      throw Error("docker_backend_platform_unsupported");
    const created = createDockerProbeContainer(
      cli,
      "cancellation",
      probeId,
      mounts,
      recording.notifications,
    );
    creationAttempted = recording.submitted();
    if (created.status !== "confirmed")
      throw Error("docker_container_identity_unknown");
    const facts = await runDockerProbeCancellation(
      cli,
      { id: created.id, probeId },
      recording.current(),
    );
    base = {
      ...base,
      ...facts.observation,
      status: facts.status,
      reason: facts.reason,
      attachProcessTerminationObserved: facts.attachProcessTerminationObserved,
      attachProcessTerminationRequestCount:
        facts.attachProcessTerminationRequestCount,
    };
    if (!facts.attachProcessTerminationObserved)
      throw Error("dynamic_fake_provider_attach_termination_unconfirmed");
    const currentMounts = recording.current();
    const cleanup = cleanupDockerContainer(
      cli,
      describeDockerProbeConfiguration(
        "cancellation",
        { id: created.id, probeId },
        currentMounts,
      ),
    );
    if (
      !cleanup.confirmed ||
      cleanup.reason !== "docker_probe_absence_confirmed"
    )
      throw Error("docker_probe_cleanup_failed");
    saveProbeAbsence(recording.management, created.id, recoveryId);
    cleanupOwnedOperationDirectories(owned);
    const verified =
      facts.status === "candidate" &&
      facts.postRunMountVerified &&
      facts.attachProcessTerminationObserved;
    base = {
      ...base,
      status: verified ? "verified" : "blocked",
      reason: verified
        ? "dynamic_fake_provider_cancellation_verified"
        : facts.reason,
      containerAbsenceVerified: true,
      hostCleanupVerified: true,
      retainOperationDirectories: false,
      recoveryId: null,
      manualRecoveryRequired: false,
      cleanup: "confirmed",
    };
  } catch (error) {
    base = {
      ...base,
      status: "blocked",
      reason: normalizeCancellationFailure(error),
    };
    if (!recording.submitted()) {
      try {
        cleanupOwnedOperationDirectories(owned);
        base = {
          ...base,
          hostCleanupVerified: true,
          retainOperationDirectories: false,
          recoveryId: null,
          manualRecoveryRequired: false,
          cleanup: "confirmed",
        };
      } catch {
        /* 元参照を保持する。 */
      }
    }
  }
  return Object.freeze({
    ...base,
    diagnosticDockerContainerEffectIssued:
      creationAttempted || recording.submitted(),
    diagnosticFilesystemEffectIssued: true,
  });
}

/**
 * 保存済み実IDの固定Probeを回復試験用に残す。
 * @responsibility 回復参照は元Host IDだけとし、専用記録やHash Tokenを生成しない。
 * @trace ERB-IT-004
 * @effect 明示的な試験実行時だけ固定Containerを作成・開始する。自動回収しない。
 */
export function createDynamicFakeProviderRecoverableResidue(
  owned: unknown,
): DynamicFakeProviderRecoverableResidueResult {
  const probeId = randomUUID(),
    recoveryId = getOwnedHostRecoveryId(owned);
  const recording = createProbeRecording(owned);
  try {
    const mounts = recording.current();
    const cli = createDockerProbeRuntimeBinding(mounts.management, mounts);
    if (!observeDockerProbeEngine(cli))
      throw Error("docker_backend_platform_unsupported");
    const created = createDockerProbeContainer(
      cli,
      "cancellation",
      probeId,
      mounts,
      recording.notifications,
    );
    if (created.status !== "confirmed")
      throw Error("docker_container_identity_unknown");
    startDockerProbeResidue(
      cli,
      { id: created.id, probeId },
      recording.current(),
    );
    return Object.freeze({
      status: "ready",
      reason: "dynamic_fake_provider_recoverable_residue_ready",
      recoveryId,
      manualRecoveryRequired: true,
      containerRunning: true,
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
      realProviderReadiness: false,
    });
  } catch (error) {
    let retained = true;
    if (!recording.submitted()) {
      try {
        cleanupOwnedOperationDirectories(owned);
        retained = false;
      } catch {
        /* 元参照を保持する。 */
      }
    }
    return Object.freeze({
      status: "blocked",
      reason: normalizeFailure(
        error,
        "dynamic_fake_provider_recoverable_residue_failed",
      ),
      recoveryId: retained ? recoveryId : null,
      manualRecoveryRequired: retained,
      containerRunning: false,
      diagnosticDockerContainerEffectIssued: recording.submitted(),
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
      realProviderReadiness: false,
    });
  }
}
