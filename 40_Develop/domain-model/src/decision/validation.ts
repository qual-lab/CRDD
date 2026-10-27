/**
 * 判断記録の閉形式と保存世代の相関を検査する。
 * @packageDocumentation
 * @responsibility 記録値の検査だけを所有し、認可・Capability発行・保存・状態適用を行わない。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @boundary Domain内の値検査。Coordinator・Provider・OSへの依存なし。
 */
import type {
  CoordinatorAcceptanceDecisionRecord,
  CoordinatorDecisionRecord,
  CoordinatorDecisionRecoveryIntent,
  CoordinatorAcceptanceDecisionEnvelope as Envelope,
} from "./types.ts";

const COORDINATOR_DECISION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const COORDINATOR_DECISION_REVISION = /^[0-9a-f]{40,64}$/u;

const COORDINATOR_DECISION_HASH = /^[0-9a-f]{64}$/u;

const decisionRecordKeys = [
  "allowedOptions",
  "applicationId",
  "capabilityHash",
  "decisionId",
  "disposition",
  "expectedGeneration",
  "expiresAtEpochMs",
  "milestoneId",
  "newGeneration",
  "principalId",
  "projectId",
  "queueId",
  "recordId",
  "replacementRequestId",
  "repositoryRevision",
  "selectedOption",
].sort();

/**
 * Decision Idかを判定する。
 *
 * @responsibility Decision Idの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisDecisionIdの入力契約を満たす。
 * @postcondition isDecisionIdの責務を完了した結果だけを返す。
 * @effect N/A: isDecisionIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDecisionIdは独自の失敗分岐を所有しない。
 * @invariant isDecisionIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDecisionIdはProcess内の同一Subsystemで完結する。
 * @security N/A: isDecisionIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDecisionIdは共有非同期状態を持たない同期処理である。
 */
function isDecisionId(value: unknown): value is string {
  return typeof value === "string" && COORDINATOR_DECISION_ID.test(value);
}

/**
 * Validate the canonical record before a persistence adapter accepts it.
 *
 * @responsibility Coordinator Decision 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns raw is CoordinatorDecisionRecordを返す。
 * @precondition 「raw: unknown」がisCoordinatorDecisionRecordの入力契約を満たす。
 * @postcondition isCoordinatorDecisionRecordの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorDecisionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isCoordinatorDecisionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isCoordinatorDecisionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorDecisionRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorDecisionRecordは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorDecisionRecord(
  raw: unknown,
): raw is CoordinatorDecisionRecord {
  try {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.getPrototypeOf(raw) !== Object.prototype ||
      Object.getOwnPropertySymbols(raw).length !== 0 ||
      Object.getOwnPropertyNames(raw).sort().join("\0") !==
        decisionRecordKeys.join("\0") ||
      Object.values(Object.getOwnPropertyDescriptors(raw)).some(
        (descriptor) => descriptor.get || descriptor.set,
      )
    )
      return false;
    const value = raw as CoordinatorDecisionRecord;
    return (
      isDecisionId(value.recordId) &&
      isDecisionId(value.decisionId) &&
      isDecisionId(value.projectId) &&
      isDecisionId(value.milestoneId) &&
      isDecisionId(value.queueId) &&
      COORDINATOR_DECISION_REVISION.test(value.repositoryRevision) &&
      Number.isSafeInteger(value.expectedGeneration) &&
      value.expectedGeneration >= 1 &&
      isDecisionId(value.principalId) &&
      Array.isArray(value.allowedOptions) &&
      value.allowedOptions.length > 0 &&
      value.allowedOptions.every(
        (option) => option === "resume" || option === "cancel",
      ) &&
      COORDINATOR_DECISION_HASH.test(value.capabilityHash) &&
      Number.isSafeInteger(value.expiresAtEpochMs) &&
      [
        "pending",
        "prepared",
        "finalized",
        "invalidated",
        "expired",
        "recovery_required",
      ].includes(value.disposition) &&
      (value.applicationId === null || isDecisionId(value.applicationId)) &&
      (value.selectedOption === null ||
        value.selectedOption === "resume" ||
        value.selectedOption === "cancel") &&
      (value.newGeneration === null ||
        (Number.isSafeInteger(value.newGeneration) &&
          value.newGeneration >= 2)) &&
      (value.replacementRequestId === null ||
        isDecisionId(value.replacementRequestId))
    );
  } catch {
    return false;
  }
}

export const COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT =
  "crdd-coordinator/orchestrator-acceptance-decision-store/v1" as const;

/**
 * Acceptance Decision Recordの構造を検査する。
 *
 * @responsibility 耐久化可能な固定Property、Identity、Source、判断およびDispositionを検証する。
 * @trace ARCH-000005
 * @input value: 未信頼の読取り値。
 * @returns 正しいRecordならtrue。
 * @precondition valueはJSON由来を含むunknownである。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検査する。
 * @failure 不正値は例外でなくfalseへ閉じる。
 * @invariant SPEC-000002以外を受入判断Sourceとして許可しない。
 * @boundary Filesystem JSONとCoordinator Port型の境界。
 * @security Capabilityや秘密値Propertyを許可しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function validRecord(
  value: unknown,
): value is CoordinatorAcceptanceDecisionRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Partial<CoordinatorAcceptanceDecisionRecord>;
  return (
    [
      record.recordId,
      record.decisionId,
      record.projectId,
      record.milestoneId,
      record.targetId,
      record.principalId,
    ].every((item) => typeof item === "string" && ID.test(item)) &&
    record.sourceSpecId === "SPEC-000002" &&
    typeof record.repositoryRevision === "string" &&
    /^[0-9a-f]{40,64}$/u.test(record.repositoryRevision) &&
    Number.isSafeInteger(record.expectedGeneration) &&
    Number(record.expectedGeneration) >= 1 &&
    (record.target === "objective" || record.target === "milestone") &&
    (record.decision === "accept" ||
      record.decision === "return" ||
      record.decision === "wait") &&
    Array.isArray(record.criterionEvidenceIds) &&
    record.criterionEvidenceIds.every(
      (item) => typeof item === "string" && ID.test(item),
    ) &&
    new Set(record.criterionEvidenceIds).size ===
      record.criterionEvidenceIds.length &&
    (record.disposition === "prepared" || record.disposition === "finalized") &&
    (record.newGeneration === null ||
      (Number.isSafeInteger(record.newGeneration) &&
        Number(record.newGeneration) >= 1))
  );
}

/**
 * Envelopeを検査する。
 *
 * @responsibility Store世代、Binding、前世代HashおよびRecordの相関不変条件を検証する。
 * @trace ARCH-000005
 * @input value: 未信頼のJSON値、repositoryBindingId: 期待Binding、recordId: 期待Record。
 * @returns 正しいEnvelopeならtrue。
 * @precondition 期待Identityは呼出し側で検証済みである。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検査する。
 * @failure 不正値はfalseへ閉じる。
 * @invariant generation 1はprepared、generation 2はfinalizedである。
 * @boundary Filesystem JSONとStore内部Envelopeの境界。
 * @security Host Pathまたは秘密値を返さない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function validEnvelope(
  value: unknown,
  repositoryBindingId: string,
  recordId: string,
): value is Envelope {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const envelope = value as Partial<Envelope>;
  return (
    envelope.contract === COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT &&
    envelope.repositoryBindingId === repositoryBindingId &&
    envelope.recordId === recordId &&
    (envelope.generation === 1 || envelope.generation === 2) &&
    (envelope.previousHash === null ||
      (typeof envelope.previousHash === "string" &&
        HASH.test(envelope.previousHash))) &&
    validRecord(envelope.record) &&
    envelope.record.recordId === recordId &&
    ((envelope.generation === 1 &&
      envelope.previousHash === null &&
      envelope.record.disposition === "prepared") ||
      (envelope.generation === 2 &&
        envelope.previousHash !== null &&
        envelope.record.disposition === "finalized"))
  );
}

export {
  validRecord as validCoordinatorAcceptanceDecisionRecord,
  validEnvelope as validCoordinatorAcceptanceDecisionEnvelope,
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const HASH = /^[0-9a-f]{64}$/u;

const recoveryRecordID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * Intentが有効か判定する。
 *
 * @responsibility Intentの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is CoordinatorDecisionRecoveryIntentを返す。
 * @precondition 「value: unknown」がvalidIntentの入力契約を満たす。
 * @postcondition validIntentの責務を完了した結果だけを返す。
 * @effect N/A: validIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIntentは独自の失敗分岐を所有しない。
 * @invariant validIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIntentは共有非同期状態を持たない同期処理である。
 */
function validIntent(
  value: unknown,
): value is CoordinatorDecisionRecoveryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as CoordinatorDecisionRecoveryIntent;
  return (
    [
      candidate.recoveryId,
      candidate.recordId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.queueId,
    ].every(
      (entry) => typeof entry === "string" && recoveryRecordID.test(entry),
    ) &&
    (candidate.applicationId === null ||
      recoveryRecordID.test(candidate.applicationId)) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    candidate.expectedGeneration >= 1 &&
    (candidate.newGeneration === null ||
      (Number.isSafeInteger(candidate.newGeneration) &&
        candidate.newGeneration >= 2)) &&
    [
      "pending",
      "prepared",
      "finalized",
      "invalidated",
      "expired",
      "recovery_required",
      "unknown",
    ].includes(candidate.observedDisposition) &&
    typeof candidate.unknownBoundary === "string" &&
    recoveryRecordID.test(candidate.unknownBoundary) &&
    (candidate.disposition === "required" ||
      candidate.disposition === "settled")
  );
}

export { validIntent as validCoordinatorDecisionRecoveryIntent };
