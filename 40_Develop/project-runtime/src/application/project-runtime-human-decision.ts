/**
 * project-runtime-human-decisionに属する責務をまとめる。
 *
 * @responsibility Commonを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000005
 */
import { applyProjectRuntimeHumanDecision } from "../core/project-runtime-state.ts";
import {
  isProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionRecoveryIntent,
  type ProjectRuntimeDecisionRecoveryStore,
  type ProjectRuntimeDecisionStore,
} from "../ports/decision-port.ts";
import type { ProjectRuntimeDecisionCapabilityPort } from "../ports/decision-capability-port.ts";
import type { ProjectRuntimePersistencePorts } from "../ports/state-port.ts";
import { PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT } from "../public-contract/decision-request.ts";

/**
 * project-runtime-human-decisionで使用するCommonの値契約を定義する。
 *
 * @responsibility CommonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000005
 * @shape Commonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commonで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commonの宣言は外部境界を開かない。
 * @security N/A: CommonはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Commonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Common = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  principalId: string;
  store: ProjectRuntimeDecisionStore;
  recoveryStore?: ProjectRuntimeDecisionRecoveryStore;
  capability: ProjectRuntimeDecisionCapabilityPort;
  persistence: ProjectRuntimePersistencePorts;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * Runtime Decision 記録 Idを公開結果へ投影する。
 *
 * @responsibility Runtime Decision 記録 Idの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000005
 * @input capability: ProjectRuntimeDecisionCapabilityPort、projectId: string、milestoneId: string、decisionId: string
 * @returns projectRuntimeDecisionRecordIdの計算結果を返す。
 * @precondition 「capability: ProjectRuntimeDecisionCapabilityPort、projectId: string、milestoneId: string、decisionId: string」がprojectRuntimeDecisionRecordIdの入力契約を満たす。
 * @postcondition projectRuntimeDecisionRecordIdの責務を完了した結果だけを返す。
 * @effect N/A: projectRuntimeDecisionRecordIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectRuntimeDecisionRecordIdは独自の失敗分岐を所有しない。
 * @invariant projectRuntimeDecisionRecordIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectRuntimeDecisionRecordIdはProcess内の同一Subsystemで完結する。
 * @security projectRuntimeDecisionRecordIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectRuntimeDecisionRecordIdは共有非同期状態を持たない同期処理である。
 */
export function projectRuntimeDecisionRecordId(
  capability: ProjectRuntimeDecisionCapabilityPort,
  projectId: string,
  milestoneId: string,
  decisionId: string,
) {
  return `decision-${capability
    .hash([projectId, milestoneId, decisionId].join("\0"))
    .slice(0, 40)}`;
}
/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000005
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}
/**
 * storedを決定する。
 *
 * @responsibility storedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input raw: unknown、expected: ProjectRuntimeDecisionRecord
 * @returns storedの計算結果を返す。
 * @precondition 「raw: unknown、expected: ProjectRuntimeDecisionRecord」がstoredの入力契約を満たす。
 * @postcondition storedの責務を完了した結果だけを返す。
 * @effect N/A: storedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: storedは独自の失敗分岐を所有しない。
 * @invariant storedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: storedはProcess内の同一Subsystemで完結する。
 * @security N/A: storedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: storedは共有非同期状態を持たない同期処理である。
 */
function stored(raw: unknown, expected?: ProjectRuntimeDecisionRecord) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return (
    value.status === "completed" &&
    isProjectRuntimeDecisionRecord(value.value) &&
    (!expected || JSON.stringify(value.value) === JSON.stringify(expected))
  );
}
/**
 * project-runtime-human-decisionを停止結果として構築する。
 *
 * @responsibility project-runtime-human-decisionの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000005
 * @input reason: string、isRecovery
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、isRecovery」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string, isRecovery = false) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !isRecovery,
    manualRecoveryRequired: isRecovery,
    effectState: isRecovery ? ("unknown" as const) : ("no_effect" as const),
  });
}

/**
 * recovery Identityを決定する。
 *
 * @responsibility recovery Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input capability: ProjectRuntimeDecisionCapabilityPort、record: ProjectRuntimeDecisionRecord
 * @returns recoveryIdentityの計算結果を返す。
 * @precondition 「capability: ProjectRuntimeDecisionCapabilityPort、record: ProjectRuntimeDecisionRecord」がrecoveryIdentityの入力契約を満たす。
 * @postcondition recoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: recoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant recoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryIdentityはProcess内の同一Subsystemで完結する。
 * @security recoveryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryIdentityは共有非同期状態を持たない同期処理である。
 */
function recoveryIdentity(
  capability: ProjectRuntimeDecisionCapabilityPort,
  record: ProjectRuntimeDecisionRecord,
) {
  return `decision-recovery-${capability
    .hash(
      [
        record.recordId,
        record.applicationId ?? "none",
        String(record.expectedGeneration),
        String(record.newGeneration ?? "none"),
      ].join("\0"),
    )
    .slice(0, 40)}`;
}

/**
 * recovery Storedを決定する。
 *
 * @responsibility recovery Storedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input raw: unknown、expected: ProjectRuntimeDecisionRecoveryIntent
 * @returns recoveryStoredの計算結果を返す。
 * @precondition 「raw: unknown、expected: ProjectRuntimeDecisionRecoveryIntent」がrecoveryStoredの入力契約を満たす。
 * @postcondition recoveryStoredの責務を完了した結果だけを返す。
 * @effect N/A: recoveryStoredは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryStoredは独自の失敗分岐を所有しない。
 * @invariant recoveryStoredは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryStoredはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryStoredはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryStoredは共有非同期状態を持たない同期処理である。
 */
function recoveryStored(
  raw: unknown,
  expected?: ProjectRuntimeDecisionRecoveryIntent,
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = (raw as Record<string, unknown>).value;
  return (
    (raw as Record<string, unknown>).status === "completed" &&
    Boolean(value) &&
    (!expected || JSON.stringify(value) === JSON.stringify(expected))
  );
}

/**
 * 回復 Intentを耐久保存する。
 *
 * @responsibility 回復 Intentの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、record: ProjectRuntimeDecisionRecord、unknownBoundary: string
 * @returns persistRecoveryIntentの計算結果を返す。
 * @precondition 「commonFields: Common、record: ProjectRuntimeDecisionRecord、unknownBoundary: string」がpersistRecoveryIntentの入力契約を満たす。
 * @postcondition persistRecoveryIntentの責務を完了した結果だけを返す。
 * @effect N/A: persistRecoveryIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistRecoveryIntentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistRecoveryIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistRecoveryIntentはProcess内の同一Subsystemで完結する。
 * @security N/A: persistRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: persistRecoveryIntentは共有非同期状態を持たない同期処理である。
 */
function persistRecoveryIntent(
  commonFields: Common,
  record: ProjectRuntimeDecisionRecord,
  unknownBoundary: string,
) {
  const recoveryId = recoveryIdentity(commonFields.capability, record);
  if (!commonFields.recoveryStore) return null;
  const intent: ProjectRuntimeDecisionRecoveryIntent = Object.freeze({
    recoveryId,
    recordId: record.recordId,
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    queueId: record.queueId,
    applicationId: record.applicationId,
    expectedGeneration: record.expectedGeneration,
    newGeneration: record.newGeneration,
    observedDisposition: record.disposition,
    unknownBoundary,
    disposition: "required",
  });
  try {
    const observed = commonFields.recoveryStore.read(recoveryId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecoveryIntent | null;
    }> | null;
    if (
      observed?.status === "completed" &&
      observed.value?.disposition === "required"
    )
      return observed.value;
    return recoveryStored(commonFields.recoveryStore.create(intent), intent)
      ? intent
      : null;
  } catch {
    return null;
  }
}

/**
 * recovery Blockedを決定する。
 *
 * @responsibility recovery Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、record: ProjectRuntimeDecisionRecord、unknownBoundary: string
 * @returns recoveryBlockedの計算結果を返す。
 * @precondition 「commonFields: Common、record: ProjectRuntimeDecisionRecord、unknownBoundary: string」がrecoveryBlockedの入力契約を満たす。
 * @postcondition recoveryBlockedの責務を完了した結果だけを返す。
 * @effect N/A: recoveryBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryBlockedは独自の失敗分岐を所有しない。
 * @invariant recoveryBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryBlockedは共有非同期状態を持たない同期処理である。
 */
function recoveryBlocked(
  commonFields: Common,
  record: ProjectRuntimeDecisionRecord,
  unknownBoundary: string,
) {
  const intent = persistRecoveryIntent(commonFields, record, unknownBoundary);
  return Object.freeze({
    ...blocked("project_runtime_decision_recovery_required", true),
    processRestartRequired: true,
    recoveryId: intent?.recoveryId ?? null,
  });
}

/**
 * 回復 Intentを終端状態へ確定する。
 *
 * @responsibility 回復 Intentの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、record: ProjectRuntimeDecisionRecord
 * @returns settleRecoveryIntentの計算結果を返す。
 * @precondition 「commonFields: Common、record: ProjectRuntimeDecisionRecord」がsettleRecoveryIntentの入力契約を満たす。
 * @postcondition settleRecoveryIntentの責務を完了した結果だけを返す。
 * @effect N/A: settleRecoveryIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure settleRecoveryIntentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleRecoveryIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleRecoveryIntentはProcess内の同一Subsystemで完結する。
 * @security N/A: settleRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: settleRecoveryIntentは共有非同期状態を持たない同期処理である。
 */
function settleRecoveryIntent(
  commonFields: Common,
  record: ProjectRuntimeDecisionRecord,
) {
  if (!commonFields.recoveryStore) return true;
  const recoveryId = recoveryIdentity(commonFields.capability, record);
  try {
    const observed = commonFields.recoveryStore.read(recoveryId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecoveryIntent | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value) return true;
    if (observed.value.disposition === "settled") return true;
    const settled = Object.freeze({
      ...observed.value,
      disposition: "settled" as const,
    });
    return recoveryStored(
      commonFields.recoveryStore.compareAndSet(observed.value, settled),
      settled,
    );
  } catch {
    return false;
  }
}

/**
 * Issue a one-time continuation capability. Only its hash enters the protected store.
 *
 * @responsibility Project Runtime Human Decisionの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ decisionId: string; repositoryRevision: string; expectedGeneration: number; allowedOptions: readonly ("resume" | "cancel")[]; lifetimeMs: number; nowEpochMs?: number; }>
 * @returns issueProjectRuntimeHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ decisionId: string; repositoryRevision: string; expectedGeneration: number; allowedOptions: readonly ("resume" | "cancel")[]; lifetimeMs: number; nowEpochMs?: number; }>」がissueProjectRuntimeHumanDecisionの入力契約を満たす。
 * @postcondition issueProjectRuntimeHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: issueProjectRuntimeHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure issueProjectRuntimeHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant issueProjectRuntimeHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueProjectRuntimeHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: issueProjectRuntimeHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: issueProjectRuntimeHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function issueProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{
    decisionId: string;
    repositoryRevision: string;
    expectedGeneration: number;
    allowedOptions: readonly ("resume" | "cancel")[];
    lifetimeMs: number;
    nowEpochMs?: number;
  }>,
) {
  if (
    ![
      commonFields.projectId,
      commonFields.milestoneId,
      commonFields.queueId,
      commonFields.principalId,
      input.decisionId,
    ].every(validId) ||
    !REVISION.test(input.repositoryRevision) ||
    !Number.isSafeInteger(input.expectedGeneration) ||
    input.expectedGeneration < 1 ||
    input.allowedOptions.length === 0 ||
    new Set(input.allowedOptions).size !== input.allowedOptions.length ||
    !input.allowedOptions.every(
      (option) => option === "resume" || option === "cancel",
    ) ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1_000 ||
    input.lifetimeMs > 86_400_000
  )
    return blocked("project_runtime_decision_request_invalid");
  const now = input.nowEpochMs ?? Date.now();
  const capability = commonFields.capability.issue();
  const recordId = projectRuntimeDecisionRecordId(
    commonFields.capability,
    commonFields.projectId,
    commonFields.milestoneId,
    input.decisionId,
  );
  const record: ProjectRuntimeDecisionRecord = Object.freeze({
    recordId,
    decisionId: input.decisionId,
    projectId: commonFields.projectId,
    milestoneId: commonFields.milestoneId,
    queueId: commonFields.queueId,
    repositoryRevision: input.repositoryRevision,
    expectedGeneration: input.expectedGeneration,
    principalId: commonFields.principalId,
    allowedOptions: Object.freeze([...input.allowedOptions]),
    capabilityHash: capability.hash,
    expiresAtEpochMs: now + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  });
  try {
    if (!stored(commonFields.store.create(record), record))
      return recoveryBlocked(commonFields, record, "continuation_issue");
  } catch {
    return recoveryBlocked(commonFields, record, "continuation_issue");
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_human_decision_issued",
    decisionId: input.decisionId,
    recordId,
    continuationCapability: capability.secret,
    allowedOptions: record.allowedOptions,
    expiresAtEpochMs: record.expiresAtEpochMs,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Apply a decision by protected-store prepare -> repository generation -> protected-store finalize.
 *
 * @responsibility project-runtime-human-decisionの入力からsubmit Project Runtime Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ decisionId: string; recordId: string; repositoryRevision: string; generation: number; selectedOption: "resume" | "cancel"; continuationCapability: string; nowEpochMs?: number; }>
 * @returns submitProjectRuntimeHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ decisionId: string; recordId: string; repositoryRevision: string; generation: number; selectedOption: "resume" | "cancel"; continuationCapability: string; nowEpochMs?: number; }>」がsubmitProjectRuntimeHumanDecisionの入力契約を満たす。
 * @postcondition submitProjectRuntimeHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: submitProjectRuntimeHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure submitProjectRuntimeHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant submitProjectRuntimeHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: submitProjectRuntimeHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: submitProjectRuntimeHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: submitProjectRuntimeHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function submitProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{
    decisionId: string;
    recordId: string;
    repositoryRevision: string;
    generation: number;
    selectedOption: "resume" | "cancel";
    continuationCapability: string;
    nowEpochMs?: number;
  }>,
) {
  if (
    ![
      commonFields.projectId,
      commonFields.milestoneId,
      commonFields.queueId,
      commonFields.principalId,
      input.decisionId,
      input.recordId,
    ].every(validId) ||
    !REVISION.test(input.repositoryRevision) ||
    !Number.isSafeInteger(input.generation) ||
    input.generation < 1 ||
    (input.selectedOption !== "resume" && input.selectedOption !== "cancel") ||
    typeof input.continuationCapability !== "string" ||
    input.continuationCapability.length > 512
  )
    return blocked("project_runtime_decision_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId);
    if (
      !observed ||
      typeof observed !== "object" ||
      !isProjectRuntimeDecisionRecord(
        (observed as Record<string, unknown>).value,
      )
    )
      return blocked("project_runtime_decision_not_observed");
    record = (observed as { value: ProjectRuntimeDecisionRecord }).value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  const now = input.nowEpochMs ?? Date.now();
  if (record.disposition === "finalized")
    return blocked("project_runtime_decision_already_consumed");
  if (record.disposition === "pending" && record.expiresAtEpochMs < now) {
    const expired = Object.freeze({
      ...record,
      disposition: "expired" as const,
    });
    try {
      if (!stored(commonFields.store.compareAndSet(record, expired), expired))
        return recoveryBlocked(commonFields, record, "continuation_expiry");
    } catch {
      return recoveryBlocked(commonFields, record, "continuation_expiry");
    }
    return blocked("project_runtime_decision_expired");
  }
  if (
    record.disposition !== "pending" ||
    record.decisionId !== input.decisionId ||
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.repositoryRevision !== input.repositoryRevision ||
    record.expectedGeneration !== input.generation ||
    record.principalId !== commonFields.principalId ||
    !record.allowedOptions.includes(input.selectedOption) ||
    record.capabilityHash !==
      commonFields.capability.hash(input.continuationCapability)
  )
    return blocked("project_runtime_decision_binding_mismatch_or_expired");
  const stateRead = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  const queueRead = commonFields.persistence.state.readQueue(
    commonFields.queueId,
  );
  if (
    stateRead.status !== "completed" ||
    !stateRead.value ||
    queueRead.status !== "completed"
  )
    return blocked(
      "project_runtime_decision_repository_observation_unknown",
      true,
    );
  if (
    stateRead.value.milestoneId !== commonFields.milestoneId ||
    stateRead.value.repositoryRevision !== input.repositoryRevision ||
    stateRead.value.generation !== input.generation ||
    queueRead.value.state !== "human_decision_required" ||
    queueRead.value.ownerGeneration !== null
  )
    return blocked("project_runtime_decision_stale");
  const applicationId = `decision-application-${commonFields.capability
    .hash(
      [record.recordId, String(input.generation), input.selectedOption].join(
        "\0",
      ),
    )
    .slice(0, 40)}`;
  const prepared = Object.freeze({
    ...record,
    disposition: "prepared" as const,
    applicationId,
    selectedOption: input.selectedOption,
    newGeneration: input.generation + 1,
  });
  try {
    if (!stored(commonFields.store.compareAndSet(record, prepared), prepared))
      return recoveryBlocked(commonFields, record, "continuation_prepare");
  } catch {
    return recoveryBlocked(commonFields, record, "continuation_prepare");
  }
  const transition = applyProjectRuntimeHumanDecision(
    stateRead.value,
    input.generation,
    input.selectedOption,
    applicationId,
  );
  if (transition.status !== "completed" || !transition.state)
    return recoveryBlocked(commonFields, prepared, "project_transition");
  const written = commonFields.persistence.state.writeState(
    transition.state,
    input.generation,
  );
  if (written.status !== "completed")
    return recoveryBlocked(commonFields, prepared, "project_write");
  const readback = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  if (
    readback.status !== "completed" ||
    !readback.value ||
    readback.value.generation !== input.generation + 1 ||
    readback.value.decisionApplicationId !== applicationId ||
    readback.value.milestone.state !==
      (input.selectedOption === "resume" ? "executing" : "cancelled")
  )
    return recoveryBlocked(commonFields, prepared, "project_readback");
  const finalized = Object.freeze({
    ...prepared,
    disposition: "finalized" as const,
  });
  try {
    if (
      !stored(commonFields.store.compareAndSet(prepared, finalized), finalized)
    )
      return recoveryBlocked(commonFields, prepared, "continuation_finalize");
  } catch {
    return recoveryBlocked(commonFields, prepared, "continuation_finalize");
  }
  const queueUpdate = commonFields.persistence.state.updateQueue(
    commonFields.queueId,
    queueRead.value.generation,
    {
      state:
        input.selectedOption === "resume" ? "replan_required" : "cancelled",
      lease: null,
      resumeCondition:
        input.selectedOption === "resume" ? "human_decision_applied" : null,
      resultReference: record.recordId,
    },
  );
  if (queueUpdate.status !== "completed")
    return recoveryBlocked(commonFields, finalized, "queue_update");
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason:
      input.selectedOption === "resume"
        ? "project_runtime_decision_applied_resume_pending"
        : "project_runtime_decision_applied_cancelled",
    decisionId: record.decisionId,
    applicationId,
    generation: input.generation + 1,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Replace a capability only after the former hash is durably invalidated.
 *
 * @responsibility project-runtime-human-decisionの入力からreplace Project Runtime Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ recordId: string; replacementRequestId: string; lifetimeMs: number; nowEpochMs?: number; }>
 * @returns replaceProjectRuntimeHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ recordId: string; replacementRequestId: string; lifetimeMs: number; nowEpochMs?: number; }>」がreplaceProjectRuntimeHumanDecisionの入力契約を満たす。
 * @postcondition replaceProjectRuntimeHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: replaceProjectRuntimeHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure replaceProjectRuntimeHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant replaceProjectRuntimeHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: replaceProjectRuntimeHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: replaceProjectRuntimeHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: replaceProjectRuntimeHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function replaceProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{
    recordId: string;
    replacementRequestId: string;
    lifetimeMs: number;
    nowEpochMs?: number;
  }>,
) {
  if (
    !validId(input.recordId) ||
    !validId(input.replacementRequestId) ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1_000 ||
    input.lifetimeMs > 86_400_000
  )
    return blocked("project_runtime_decision_replacement_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecord | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value)
      return blocked("project_runtime_decision_not_observed");
    record = observed.value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  if (
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.principalId !== commonFields.principalId
  )
    return blocked("project_runtime_decision_replacement_binding_mismatch");
  if (
    record.disposition === "pending" &&
    record.replacementRequestId === input.replacementRequestId
  )
    return blocked("project_runtime_decision_replacement_already_issued");
  if (record.disposition !== "pending")
    return blocked("project_runtime_decision_replacement_not_applicable");
  const invalidated = Object.freeze({
    ...record,
    disposition: "invalidated" as const,
    replacementRequestId: input.replacementRequestId,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(record, invalidated),
        invalidated,
      )
    )
      return recoveryBlocked(commonFields, record, "replacement_invalidation");
  } catch {
    return recoveryBlocked(commonFields, record, "replacement_invalidation");
  }
  const capability = commonFields.capability.issue();
  const replacement: ProjectRuntimeDecisionRecord = Object.freeze({
    ...invalidated,
    capabilityHash: capability.hash,
    expiresAtEpochMs: (input.nowEpochMs ?? Date.now()) + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(invalidated, replacement),
        replacement,
      )
    )
      return recoveryBlocked(commonFields, invalidated, "replacement_issue");
  } catch {
    return recoveryBlocked(commonFields, invalidated, "replacement_issue");
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_human_decision_replaced",
    decisionId: replacement.decisionId,
    recordId: replacement.recordId,
    replacementRequestId: input.replacementRequestId,
    continuationCapability: capability.secret,
    allowedOptions: replacement.allowedOptions,
    expiresAtEpochMs: replacement.expiresAtEpochMs,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Invalidate an unused capability after a fresh parent lifecycle observation.
 *
 * @responsibility project-runtime-human-decisionの入力からinvalidate Project Runtime Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ recordId: string; reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled"; }>
 * @returns invalidateProjectRuntimeHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ recordId: string; reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled"; }>」がinvalidateProjectRuntimeHumanDecisionの入力契約を満たす。
 * @postcondition invalidateProjectRuntimeHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: invalidateProjectRuntimeHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure invalidateProjectRuntimeHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant invalidateProjectRuntimeHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidateProjectRuntimeHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: invalidateProjectRuntimeHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: invalidateProjectRuntimeHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function invalidateProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{
    recordId: string;
    reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled";
  }>,
) {
  if (!validId(input.recordId))
    return blocked("project_runtime_decision_invalidation_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecord | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value)
      return blocked("project_runtime_decision_not_observed");
    record = observed.value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  if (record.disposition === "prepared")
    return recoverProjectRuntimeHumanDecision(commonFields, {
      recordId: input.recordId,
    });
  if (["invalidated", "expired", "finalized"].includes(record.disposition))
    return Object.freeze({
      contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
      status: "completed" as const,
      reason: "project_runtime_decision_already_settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled" as const,
    });
  if (record.disposition !== "pending")
    return blocked("project_runtime_decision_invalidation_not_applicable");
  const state = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return recoveryBlocked(
      commonFields,
      record,
      "invalidation_project_observation",
    );
  const isParentProvesInvalidation =
    state.value.generation !== record.expectedGeneration ||
    (input.reason === "milestone_accepted" &&
      state.value.milestone.state === "accepted") ||
    (input.reason === "milestone_cancelled" &&
      state.value.milestone.state === "cancelled");
  if (!isParentProvesInvalidation)
    return blocked("project_runtime_decision_invalidation_not_proven");
  const invalidated = Object.freeze({
    ...record,
    disposition: "invalidated" as const,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(record, invalidated),
        invalidated,
      )
    )
      return recoveryBlocked(commonFields, record, "invalidation_update");
  } catch {
    return recoveryBlocked(commonFields, record, "invalidation_update");
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_decision_invalidated",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Reconcile a prepared decision after process loss without replaying its authority.
 *
 * @responsibility project-runtime-human-decisionの入力からrecover Project Runtime Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ recordId: string }>
 * @returns recoverProjectRuntimeHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ recordId: string }>」がrecoverProjectRuntimeHumanDecisionの入力契約を満たす。
 * @postcondition recoverProjectRuntimeHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: recoverProjectRuntimeHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoverProjectRuntimeHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverProjectRuntimeHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverProjectRuntimeHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: recoverProjectRuntimeHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoverProjectRuntimeHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function recoverProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{ recordId: string }>,
) {
  if (!validId(input.recordId))
    return blocked("project_runtime_decision_recovery_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId);
    if (
      !observed ||
      typeof observed !== "object" ||
      !isProjectRuntimeDecisionRecord(
        (observed as Record<string, unknown>).value,
      )
    )
      return blocked("project_runtime_decision_not_observed");
    record = (observed as { value: ProjectRuntimeDecisionRecord }).value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  if (record.disposition === "finalized")
    return Object.freeze({
      contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
      status: "completed" as const,
      reason: "project_runtime_decision_recovery_already_finalized",
      decisionId: record.decisionId,
      applicationId: record.applicationId,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled" as const,
    });
  if (
    record.disposition !== "prepared" ||
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.principalId !== commonFields.principalId ||
    record.applicationId === null ||
    record.selectedOption === null ||
    record.newGeneration !== record.expectedGeneration + 1
  )
    return blocked("project_runtime_decision_recovery_not_applicable");
  const state = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return recoveryBlocked(
      commonFields,
      record,
      "recovery_project_observation",
    );
  let next: ProjectRuntimeDecisionRecord;
  if (
    state.value.generation === record.newGeneration &&
    state.value.decisionApplicationId === record.applicationId &&
    state.value.milestone.state ===
      (record.selectedOption === "resume" ? "executing" : "cancelled")
  ) {
    next = Object.freeze({ ...record, disposition: "finalized" as const });
  } else if (
    state.value.generation === record.expectedGeneration &&
    state.value.decisionApplicationId === null &&
    state.value.milestone.state === "human_decision_required"
  ) {
    next = Object.freeze({ ...record, disposition: "invalidated" as const });
  } else {
    return recoveryBlocked(commonFields, record, "recovery_identity_mismatch");
  }
  try {
    if (!stored(commonFields.store.compareAndSet(record, next), next))
      return recoveryBlocked(
        commonFields,
        record,
        "recovery_continuation_update",
      );
  } catch {
    return recoveryBlocked(
      commonFields,
      record,
      "recovery_continuation_update",
    );
  }
  if (next.disposition === "invalidated")
    return blocked("project_runtime_decision_recovery_invalidated");
  const queueRead = commonFields.persistence.state.readQueue(
    commonFields.queueId,
  );
  if (queueRead.status !== "completed")
    return recoveryBlocked(commonFields, next, "recovery_queue_observation");
  if (queueRead.value.state === "human_decision_required") {
    const queueUpdate = commonFields.persistence.state.updateQueue(
      commonFields.queueId,
      queueRead.value.generation,
      {
        state:
          record.selectedOption === "resume" ? "replan_required" : "cancelled",
        lease: null,
        resumeCondition:
          record.selectedOption === "resume" ? "human_decision_applied" : null,
        resultReference: record.recordId,
      },
    );
    if (queueUpdate.status !== "completed")
      return recoveryBlocked(commonFields, next, "recovery_queue_update");
  }
  if (!settleRecoveryIntent(commonFields, next))
    return recoveryBlocked(commonFields, next, "recovery_intent_settlement");
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_decision_recovery_finalized",
    decisionId: record.decisionId,
    applicationId: record.applicationId,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}
