/**
 * 受入判断の耐久値と世代相関を検査する。
 *
 * @responsibility RecordとEnvelopeの意味検査を所有し、保存先やFilesystem操作を所有しない。
 * @trace ARCH-000005
 */
import type { ProjectRuntimeAcceptanceDecisionRecord } from "../ports/acceptance-decision-port.ts";

export const PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT =
  "crdd-coordinator/project-runtime-acceptance-decision-store/v1" as const;

/**
 * Acceptance Decision Recordの耐久世代Envelopeを定義する。
 *
 * @responsibility Binding、Record Identity、世代、前世代HashおよびRecord本体を一つの耐久契約へ閉じる。
 * @trace ARCH-000005
 * @shape generation 1のprepared Recordまたはgeneration 2のfinalized Recordと、その前世代参照を表す。
 * @invariant generation 1はpreviousHashを持たず、generation 2はgeneration 1のHashを持つ。
 * @boundary Project Runtime Acceptance Decision StoreとRepository-local JSONの型境界。
 * @security 秘密値、CapabilityまたはHost絶対Pathを保持しない。
 * @compatibility contract値とgeneration意味を変更せず、利用側は宣言済みPropertyだけへ依存する。
 */
type Envelope = Readonly<{
  contract: typeof PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT;
  repositoryBindingId: string;
  recordId: string;
  generation: 1 | 2;
  previousHash: string | null;
  record: ProjectRuntimeAcceptanceDecisionRecord;
}>;

export {
  type Envelope as ProjectRuntimeAcceptanceDecisionEnvelope,
  validRecord as validProjectRuntimeAcceptanceDecisionRecord,
  validEnvelope as validProjectRuntimeAcceptanceDecisionEnvelope,
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;

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
 * @boundary Filesystem JSONとProject Runtime Port型の境界。
 * @security Capabilityや秘密値Propertyを許可しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
function validRecord(
  value: unknown,
): value is ProjectRuntimeAcceptanceDecisionRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Partial<ProjectRuntimeAcceptanceDecisionRecord>;
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
    envelope.contract === PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT &&
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
