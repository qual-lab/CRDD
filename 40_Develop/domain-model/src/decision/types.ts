/**
 * 判断・受入・回復参照の非秘密な記録値を定義する。
 * @packageDocumentation
 * @responsibility 対象と世代・根拠・記録状態を所有し、現在Authorityと実行結果を生成しない。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @boundary Domain値。技術Capabilityは含まない。
 */
import type { COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT } from "./validation.ts";

/**
 * Coordinatorの受入判断対象を定義する。
 *
 * @responsibility Objective判断とMilestone判断を混同しない対象区分を所有する。
 * @trace ARCH-000005
 * @shape `objective`または`milestone`のいずれか一つを表す。
 * @invariant Task、ProjectionまたはProviderを受入判断対象へ昇格しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: 型宣言はAuthorityや秘密値を保持しない。
 * @compatibility 利用側は宣言済みの二つの対象区分だけへ依存する。
 */
export type CoordinatorAcceptanceTarget = "objective" | "milestone";

/**
 * Coordinatorの明示的な受入判断を定義する。
 *
 * @responsibility 受入、差戻し、判断待ちを別の判断値として所有する。
 * @trace ARCH-000005
 * @shape `accept`、`return`、`wait`のいずれか一つを表す。
 * @invariant Task完了または下位状態から判断値を推定しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: 型宣言はAuthorityや秘密値を保持しない。
 * @compatibility 利用側は宣言済みの三つの判断値だけへ依存する。
 */
export type CoordinatorAcceptanceDecision = "accept" | "return" | "wait";

/**
 * Coordinator受入判断の状態遷移入力を定義する。
 *
 * @responsibility exactな対象、判断および判断根拠の組を型境界として所有する。
 * @trace ARCH-000005
 * @shape 対象区分、対象ID、判断および根拠ID列を表す。
 * @invariant ObjectiveとMilestoneの対象IDを同じ入力で兼用しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority検証はApplication境界が所有し、本型は秘密値を保持しない。
 * @compatibility 利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorAcceptanceDecisionInput = Readonly<{
  target: CoordinatorAcceptanceTarget;
  targetId: string;
  decision: CoordinatorAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
}>;

/**
 * 一回のObjective／Milestone受入判断記録を定義する。
 *
 * @responsibility 判断Identity、対象、根拠、状態適用前後および記録Dispositionを耐久境界として所有する。
 * @trace ARCH-000005
 * @shape 一つの明示判断とその適用状態を表す。
 * @invariant Capability秘密値、Task作成情報またはProvider Effect情報を保持しない。
 * @boundary Coordinator Coreと受入判断Storeの境界。
 * @security Authority秘密値を保存せず、検証済みPrincipalとBindingだけを保持する。
 * @compatibility `prepared`から`finalized`への一方向遷移を維持する。
 */
export type CoordinatorAcceptanceDecisionRecord = Readonly<{
  recordId: string;
  decisionId: string;
  sourceSpecId: "SPEC-000002";
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: CoordinatorAcceptanceTarget;
  targetId: string;
  decision: CoordinatorAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
  principalId: string;
  disposition: "prepared" | "finalized";
  newGeneration: number | null;
}>;

/**
 * decision-portで使用するCoordinator Decision 記録の値契約を定義する。
 *
 * @responsibility Coordinator Decision 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRecordの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRecord = Readonly<{
  recordId: string;
  decisionId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  principalId: string;
  allowedOptions: readonly ("resume" | "cancel")[];
  capabilityHash: string;
  expiresAtEpochMs: number;
  disposition:
    | "pending"
    | "prepared"
    | "finalized"
    | "invalidated"
    | "expired"
    | "recovery_required";
  applicationId: string | null;
  selectedOption: "resume" | "cancel" | null;
  newGeneration: number | null;
  replacementRequestId: string | null;
}>;

/**
 * decision-portで使用するCoordinator Decision 回復 Intentの値契約を定義する。
 *
 * @responsibility Coordinator Decision 回復 IntentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRecoveryIntentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRecoveryIntentで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRecoveryIntentの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRecoveryIntentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRecoveryIntent = Readonly<{
  recoveryId: string;
  recordId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  applicationId: string | null;
  expectedGeneration: number;
  newGeneration: number | null;
  observedDisposition: CoordinatorDecisionRecord["disposition"] | "unknown";
  unknownBoundary: string;
  disposition: "required" | "settled";
}>;

/**
 * Acceptance Decision Recordの耐久世代Envelopeを定義する。
 *
 * @responsibility Binding、Record Identity、世代、前世代HashおよびRecord本体を一つの耐久契約へ閉じる。
 * @trace ARCH-000005
 * @shape generation 1のprepared Recordまたはgeneration 2のfinalized Recordと、その前世代参照を表す。
 * @invariant generation 1はpreviousHashを持たず、generation 2はgeneration 1のHashを持つ。
 * @boundary Coordinator Acceptance Decision StoreとRepository-local JSONの型境界。
 * @security 秘密値、CapabilityまたはHost絶対Pathを保持しない。
 * @compatibility contract値とgeneration意味を変更せず、利用側は宣言済みPropertyだけへ依存する。
 */
export type CoordinatorAcceptanceDecisionEnvelope = Readonly<{
  contract: typeof COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT;
  repositoryBindingId: string;
  recordId: string;
  generation: 1 | 2;
  previousHash: string | null;
  record: CoordinatorAcceptanceDecisionRecord;
}>;
