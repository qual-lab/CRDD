/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { ProjectResultAcceptance } from "../task/types.ts";
import type { COORDINATOR_STATE_CONTRACT } from "./validation.ts";
import type { TaskExecutionSelections } from "../ai-selection/types.ts";
import type { ProjectMilestoneRecord } from "../objective/types.ts";
import type { ProjectObjectiveRecord } from "../objective/types.ts";
import type { ProjectTaskRecord } from "../task/types.ts";
import type { COORDINATOR_STATE_SCHEMA } from "./validation.ts";
import type { CoordinatorStateOperation } from "../attempt/types.ts";
import type { ProjectTaskRecoveryObligation } from "../task/types.ts";
import type { CoordinatorWorkspace } from "../workspace/types.ts";
import type { ProjectQueueEntry } from "../task/types.ts";
import type { CoordinatorResultRecord } from "../workspace/types.ts";
import type { COORDINATOR_PROJECT_SNAPSHOT_SCHEMA } from "./validation.ts";
import type { CoordinatorAcceptanceDecisionEnvelope } from "../decision/types.ts";
import type { CoordinatorDecisionRecoveryIntent } from "../decision/types.ts";
import type { COORDINATOR_DURABLE_FOUNDATION_CONTRACT } from "./validation.ts";

/**
 * Taskと技術操作を同じ改訂で保存する閉集合を定義する。
 * @responsibility 改訂・元Hash・物理結合を一組にし、受領本文を一度だけ保持する。
 * @trace ARCH-000004、ARCH-000008
 * @shape 平坦な現在区画。Task未初期化時は業務結合と受付世代がともにnull。
 * @invariant 二つの旧Snapshotや二重の受領Hashを内包しない。
 * @boundary 単一Writerへ接続する値モデル。
 * @security Schema成立を実資源観測や保存成功へ昇格しない。
 * @compatibility 最新形式だけを定義し、旧形式の変換は行わない。
 */
export type CoordinatorUnifiedSnapshot = Omit<
  CoordinatorExecutionStateSnapshot,
  "schema" | "pendingDeliveries"
> &
  Omit<
    CoordinatorSnapshot,
    | "schema"
    | "schemaRevision"
    | "repositoryRootHash"
    | "snapshotRevision"
    | "repositoryBindingId"
    | "intakeEpoch"
    | "projects"
  > &
  Readonly<{
    schema: "crdd-coordinator/current-state/v5";
    repositoryBindingId: string | null;
    intakeEpoch: string | null;
    projects: readonly (Omit<CoordinatorState, "tasks"> &
      Readonly<{
        tasks: readonly CoordinatorStoredTask[];
      }>)[];
    resultReceipts: readonly ProjectResultAcceptance[];
    pendingDeliveries: CoordinatorExecutionStateSnapshot["pendingDeliveries"];
  }>;

/**
 * stateで使用するCoordinator 状態の値契約を定義する。
 *
 * @responsibility Coordinator 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStateの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorState = Readonly<{
  contract: typeof COORDINATOR_STATE_CONTRACT;
  taskExecutionSelections: TaskExecutionSelections;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  generation: number;
  ownerGeneration: string;
  decisionApplicationId: string | null;
  maximumConcurrency: number;
  milestone: ProjectMilestoneRecord;
  objectives: readonly ProjectObjectiveRecord[];
  tasks: readonly ProjectTaskRecord[];
}>;

/**
 * Repository一つの未終了集合を保持する。
 * @responsibility 単調改訂、元内容Hash、操作参照と未受理結果を型として分離する。
 * @trace ARCH-000008
 * @shape 固定schema、改訂相関、Repository結合と三つの現在集合。
 * @invariant 履歴や候補本体を現在集合へ蓄積しない。
 * @boundary 保存Ownerと状態利用側。
 * @security JSONは実資源観測やAuthorityの代わりではない。
 * @compatibility 最新schemaのみ。移行はフロントAIが所有する。
 */
export type CoordinatorExecutionStateSnapshot = Readonly<{
  schema: typeof COORDINATOR_STATE_SCHEMA;
  revision: number;
  previous: Readonly<{ revision: number; payloadSha256: string }> | null;
  repositoryBinding: string;
  operations: readonly CoordinatorStateOperation[];
  unresolvedRecoveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    reason: string;
    obligations: readonly (
      | "docker_resources"
      | "host_cleanup"
      | "lease_release"
      | "result_delivery"
    )[];
  }>[];
  pendingDeliveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    resultId: string;
    consumer: "orchestrator";
  }>[];
}>;

/**
 * 単一保存内のTaskを、技術状態の複製を持たない値として定義する。
 * @responsibility 終端元事実と受領参照を保存し、公開Taskの導出値を分離する。
 * @trace ARCH-000004、ARCH-000008
 * @shape 既存Taskの業務値、settlement、受領IDと回復参照。
 * @invariant 受領本文と技術cleanupの正本をTaskへ複製しない。
 * @boundary 保存codec内部。公開Task DTOは既存契約を維持する。
 * @security 値から実行Authorityを復元しない。
 * @compatibility 本番切替前の純粋モデルであり、旧保存Readerではない。
 */
export type CoordinatorStoredTask = Omit<
  ProjectTaskRecord,
  | "cleanupConfirmed"
  | "recoveryUnresolved"
  | "resultAcceptances"
  | "recoveryObligations"
> &
  Readonly<{
    settlement: CoordinatorTaskSettlementFact;
    resultAcceptanceIds: readonly string[];
    recoveryObligations: readonly (
      | Readonly<{ kind: "docker"; recoveryId: string }>
      | Readonly<{
          kind: Exclude<ProjectTaskRecoveryObligation["kind"], "docker">;
          recoveryId: string;
          phase: Exclude<
            ProjectTaskRecoveryObligation["phase"],
            "acknowledged"
          >;
        }>
    )[];
  }>;

/**
 * 一体保存する現在状態の閉じた値契約を定義する。
 * @responsibility 既存値と受付世代、途中Lease、履歴未確定搬送を保持する。
 * @trace ARCH-000004
 * @shape 保存情報、受付結合、Project、Queue、Lease、結果、未搬送終了要約。
 * @invariant 保護DecisionとOS handleを保存しない。保存と受付の世代を分離する。
 * @boundary Repository-localの現在状態。
 * @security Hashや状態名をAuthorityへ昇格しない。
 * @compatibility 既存Portの値を維持し、実データ切替は別処置とする。
 */
export type CoordinatorSnapshot = Readonly<{
  workspaces: readonly CoordinatorWorkspace[];
  repositoryRootHash: string;
  repositoryBindingId: string;
  snapshotRevision: number;
  intakeEpoch: string;
  intakeBindings: readonly Readonly<{ queueId: string; epoch: string }>[];
  projects: readonly CoordinatorState[];
  queueEntries: readonly ProjectQueueEntry[];
  leaseEvidence: readonly LeaseEvidenceEnvelope[];
  leaseIntents: readonly Readonly<{
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    ownerGeneration: string;
    ownerProcessId: number;
    recoveryId: string;
    phase:
      | "acquisition_pending"
      | "acquisition_reserved"
      | "lock_owned"
      | "release_pending"
      | "recovery_pending";
    physicalIdentity?: string | null;
  }>[];
  results: readonly CoordinatorResultRecord[];
  historyPending: readonly HistoryRow[];
}> &
  Readonly<{
    schema: typeof COORDINATOR_PROJECT_SNAPSHOT_SCHEMA;
    schemaRevision: 5;
    acceptanceDecisions: readonly CoordinatorAcceptanceDecisionEnvelope[];
    decisionRecoveries: readonly Readonly<{
      generation: number;
      value: CoordinatorDecisionRecoveryIntent;
    }>[];
  }>;

export type CoordinatorStateSnapshot = CoordinatorUnifiedSnapshot;

/**
 * Taskが所有する終端観測と技術Operation参照を区別する。
 * @responsibility 技術状態のコピーではなく、Task境界固有の元事実を表す。
 * @trace ARCH-000004、ARCH-000008
 * @shape 未終端、未発行、技術保存を持たないExecutor結果、又はexact Operation参照。
 * @invariant 空のOperation集合から未発行又は回収完了を生成しない。
 * @boundary 単一保存codec内部のTask投影。Package公開APIではない。
 * @security 値を実行・削除・回復のAuthorityにしない。
 * @compatibility 既存公開Taskの真偽値は投影結果として維持する。
 */
export type CoordinatorTaskSettlementFact =
  | Readonly<{ kind: "pending" }>
  | Readonly<{ kind: "unissued" }>
  | Readonly<{
      kind: "executor_result";
      cleanupConfirmed: boolean;
      recoveryUnresolved: boolean;
    }>
  | Readonly<{
      kind: "operations";
      recoveryIds: readonly string[];
      resultUnresolved: boolean;
    }>;

/**
 * durable-foundationで使用するLease Evidence Envelopeの値契約を定義する。
 *
 * @responsibility Lease Evidence EnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceEnvelopeの宣言は外部境界を開かない。
 * @security LeaseEvidenceEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseEvidenceEnvelope = Envelope &
  Readonly<{ recordKind: "lease-evidence"; content: LeaseEvidenceContent }>;

/**
 * durable-foundationで使用するEnvelopeの値契約を定義する。
 *
 * @responsibility EnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Envelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Envelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Envelopeの宣言は外部境界を開かない。
 * @security EnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Envelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type Envelope = Readonly<{
  schema: typeof COORDINATOR_DURABLE_FOUNDATION_CONTRACT;
  schemaRevision: 1;
  recordKind: "project-state" | "queue-entry" | "lease-evidence";
  repositoryBindingId: string;
  projectId: string;
  createdGeneration: number;
  updatedGeneration: number;
  contentHash: string;
  content: unknown;
}>;

/**
 * durable-foundationで使用するLease Evidence Contentの値契約を定義する。
 *
 * @responsibility Lease Evidence ContentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceContentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceContentで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceContentの宣言は外部境界を開かない。
 * @security LeaseEvidenceContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceContentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseEvidenceContent = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  disposition:
    | "acquired"
    | "released"
    | "recovered_after_owner_loss"
    | "acquisition_unknown_closed";
}>;

/**
 * 終了要約の固定値を定義する。
 *
 * @responsibility 自由記述を持たない履歴の値契約を所有する。
 * @trace ARCH-000004
 * @shape id、occurredAt、outcome、primaryFailure、cleanup。
 * @invariant 制御状態やAuthorityを含まない。
 * @boundary 履歴保存境界。
 * @security Prompt、秘密値、Pathを許可しない。
 * @compatibility 試行契約であり現在のPortを置換しない。
 */
export type HistoryRow = Readonly<{
  id: string;
  occurredAt: string;
  outcome: "completed" | "failed" | "cancelled";
  primaryFailure:
    | null
    | "execution"
    | "storage"
    | "delivery"
    | "cleanup"
    | "cancel";
  cleanup: "confirmed" | "unknown" | "not_required";
}>;

/**
 * durable-foundationで使用するLease Kindの値契約を定義する。
 *
 * @responsibility Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseKindの宣言は外部境界を開かない。
 * @security LeaseKindはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseKind = CoordinatorLeaseKind;

/**
 * lease-portで使用するCoordinator Lease Kindの値契約を定義する。
 *
 * @responsibility Coordinator Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseKindの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeaseKind = "project-operation" | "canonical-adoption";

/**
 * plain-data-snapshotで使用するArray Snapshotの値契約を定義する。
 *
 * @responsibility Array SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ArraySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArraySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArraySnapshotの宣言は外部境界を開かない。
 * @security N/A: ArraySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArraySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArraySnapshot<T> =
  | Readonly<{ status: "ok"; value: readonly T[] }>
  | Readonly<{ status: "blocked"; value: null }>;
