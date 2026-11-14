/**
 * 統合実行State・Lease・一回保存相関の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */
import type { Repository } from "../../../version-control/src/index.ts";
import type { OperationRecord } from "../attempt/types.ts";
import type { Blocker, Decision } from "../decision/types.ts";
import type { HistoryRow } from "../history/types.ts";
import type {
  ObjectivePlan,
  ProjectMilestoneRecord,
  ProjectObjectiveDefinition,
  ProjectObjectiveRecord,
} from "../objective/types.ts";
import type {
  ProjectQueueEntry,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryObligation,
  TaskExecutionSelections,
} from "../task/types.ts";
import type { ResultRecord, WorkspaceRecord } from "../workspace/types.ts";
/** モデルの値契約。型と利用側の投影は同じ定義を使用する。 */
export const PROJECT_STATE_CONTRACT =
  "crdd-execution-model/project-state/v3" as const;

/**
 * plain-data-snapshotで使用するData Descriptorの値契約を定義する。
 *
 * @responsibility Data DescriptorのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape DataDescriptorが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DataDescriptorで宣言した値と責務の対応を維持する。
 * @boundary N/A: DataDescriptorの宣言は外部境界を開かない。
 * @security DataDescriptorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DataDescriptorの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DataDescriptor = PropertyDescriptor & { value: unknown };

/**
 * plain-data-snapshotで使用するPlain Array Snapshotの値契約を定義する。
 *
 * @responsibility Plain Array SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape PlainArraySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PlainArraySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: PlainArraySnapshotの宣言は外部境界を開かない。
 * @security PlainArraySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PlainArraySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PlainArraySnapshot<T> =
  | Readonly<{ status: "ok"; reason: null; value: readonly T[] }>
  | Readonly<{
      status: "blocked";
      reason:
        | "not_plain_array"
        | "array_length_invalid"
        | "array_length_exceeded"
        | "array_shape_invalid"
        | "array_input_invalid";
      value: null;
    }>;

/**
 * 同じ短期保存Ownerで利用する現在観測の契約。
 * @responsibility 保存と状態判断の間で固定値と同期観測だけを受け渡す。
 * @trace ARCH-000004
 * @shape 固定Schema、Process ID、実Lease不存在と履歴確定の同期観測。
 * @invariant 観測不能を不存在にせず、元の判定順で呼ぶ。
 * @boundary Package内部のWriterと区画遷移検査。
 * @security この型や観測値から実行・保存Authorityを発行しない。
 * @compatibility 保存形式・公開Root APIは変更しない。
 */
export type SnapshotObservations = Readonly<{
  schema: string;
  processId: number;
  leaseResourcesAbsent: (identity: string) => boolean;
  historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
  decisionHistorySettlement: (decision: Decision) => "recorded" | null;
}>;

/**
 * Taskと技術操作を同じ改訂で保存する閉集合を定義する。
 * @responsibility 改訂・元Hash・物理結合を一組にし、モデルと技術終端を同じ保存単位で保持する。
 * @trace ARCH-000004、ARCH-000008
 * @shape 平坦な現在区画。Task未初期化時は業務結合と受付世代がともにnull。
 * @invariant 二つの旧Snapshotや独立した配送・受領記録を内包しない。
 * @boundary 単一Writerへ接続する値モデル。
 * @security Schema成立を実資源観測や保存成功へ昇格しない。
 * @compatibility 最新形式だけを定義し、旧形式の変換は行わない。
 */
export type ExecutionStateSnapshot = Readonly<{
  schema: "crdd-execution-model/state/v4";
  revision: number;
  previous: Readonly<{ revision: number; payloadSha256: string }> | null;
  repositoryBinding: string;
  repositoryBindingId: string | null;
  intakeEpoch: string | null;
  projects: readonly ProjectDefinition[];
  managedExecutions: readonly ManagedExecution[];
  operations: readonly OperationRecord[];
  unresolvedRecoveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    reason: string;
    obligations: readonly (
      | "docker_resources"
      | "host_cleanup"
      | "lease_release"
    )[];
  }>[];
  workspaces: readonly WorkspaceRecord[];
  intakeBindings: readonly Readonly<{ queueId: string; epoch: string }>[];
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
  results: readonly ResultRecord[];
  historyPending: readonly HistoryRow[];
  decisions: readonly Decision[];
  blockers: readonly Blocker[];
}>;

/**
 * Project定義と管理実行を結合した投影の値契約を定義する。
 *
 * @responsibility Projectの実行状態、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectExecutionStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectExecutionStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectExecutionStateの宣言は外部境界を開かない。
 * @security N/A: ProjectExecutionStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectExecutionStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectExecutionState = Readonly<{
  contract: typeof PROJECT_STATE_CONTRACT;
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
 * 保存正本からRepository一つの未終了集合を投影する。
 * @responsibility 単調改訂、元内容Hash、操作参照と未受理結果を型として分離する。
 * @trace ARCH-000008
 * @shape 固定schema、改訂相関、Repository結合と三つの現在集合。
 * @invariant 履歴や候補本体を現在集合へ蓄積しない。
 * @boundary 保存Ownerと状態利用側。
 * @security JSONは実資源観測やAuthorityの代わりではない。
 * @compatibility 保存正本と同じschemaであり、独立File・別Writerを定義しない。
 */
export type ExecutionOverview = Pick<
  ExecutionStateSnapshot,
  | "schema"
  | "revision"
  | "previous"
  | "repositoryBinding"
  | "operations"
  | "unresolvedRecoveries"
>;

/**
 * 単一保存内のTaskを、技術状態の複製を持たない値として定義する。
 * @responsibility 終端元事実とOperation相関を保存し、公開Taskの導出値を分離する。
 * @trace ARCH-000004、ARCH-000008
 * @shape 既存Taskの業務値、settlementと回復参照。
 * @invariant 技術cleanupの正本をTaskへ複製しない。
 * @boundary 保存codec内部。公開Task DTOは既存契約を維持する。
 * @security 値から実行Authorityを復元しない。
 * @compatibility 本番切替前の純粋モデルであり、旧保存Readerではない。
 */
export type StoredTask = Omit<
  ProjectTaskRecord,
  "cleanupConfirmed" | "recoveryUnresolved" | "recoveryObligations"
> &
  Readonly<{
    settlement: TaskSettlementFact;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
  }>;

/**
 * 保存正本からProject・Queue・Workspaceを同版で導出する内部投影を定義する。
 * @responsibility 同じStateの値と受付世代、途中Lease、履歴未確定搬送を組み合わせる。
 * @trace ARCH-000004
 * @shape 保存情報、受付結合、Project、Queue、Lease、結果、未搬送終了要約。
 * @invariant 投影を別Fileや旧Schemaの互換Readerとして扱わず、OS handleを含めない。
 * @boundary 単一保存正本とモデル別のメモリ内操作。
 * @security Hashや状態名をAuthorityへ昇格しない。
 * @compatibility project-snapshot/v7は投影の識別であり、物理保存はstate/v4のまま。
 */
export type Snapshot = Pick<
  ExecutionStateSnapshot,
  | "workspaces"
  | "intakeBindings"
  | "queueEntries"
  | "leaseEvidence"
  | "leaseIntents"
  | "results"
  | "historyPending"
  | "decisions"
  | "blockers"
> &
  Readonly<{
    schema: typeof PROJECT_SNAPSHOT_SCHEMA;
    schemaRevision: 7;
    repositoryRootHash: string;
    repositoryBindingId: string;
    snapshotRevision: number;
    intakeEpoch: string;
    projects: readonly ProjectExecutionState[];
  }>;

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
export type TaskSettlementFact =
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
 * durable-foundationで使用するLease Evidence ExecutionStateEnvelopeの値契約を定義する。
 *
 * @responsibility Lease Evidence ExecutionStateEnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceEnvelopeの宣言は外部境界を開かない。
 * @security LeaseEvidenceEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseEvidenceEnvelope = ExecutionStateEnvelope &
  Readonly<{ recordKind: "lease-evidence"; content: LeaseEvidenceContent }>;

/**
 * durable-foundationで使用するExecutionStateEnvelopeの値契約を定義する。
 *
 * @responsibility ExecutionStateEnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ExecutionStateEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionStateEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionStateEnvelopeの宣言は外部境界を開かない。
 * @security ExecutionStateEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionStateEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionStateEnvelope = Readonly<{
  schema: typeof STORAGE_CONTRACT;
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

/**
 * lease-portで使用するCoordinator Lease Kindの値契約を定義する。
 *
 * @responsibility Coordinator Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseKindの宣言は外部境界を開かない。
 * @security N/A: LeaseKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LeaseKind = "project-operation" | "canonical-adoption";

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

/**
 * 実行設定を必須にしない計画定義と局所判断の正本。
 * @responsibility Task定義を一度だけ保持し、技術試行fieldを含めない。
 * @trace ARCH-000004
 * @shape 既存対象ID・改訂・世代・Milestone／Objective記録とTask定義。
 * @invariant Selection・Owner・AttemptをCore初期化のために生成しない。
 * @boundary 共通Domainの定義と管理実行の分離。
 * @security 定義保存は実行・受入・文書更新の許可ではない。
 * @compatibility 新形式だけ。旧Fileの変換はフロントAIが所有する。
 */
export type ProjectDefinition = Omit<
  ProjectExecutionState,
  | "contract"
  | "taskExecutionSelections"
  | "ownerGeneration"
  | "maximumConcurrency"
  | "tasks"
> &
  Readonly<{
    contract: "crdd-domain/project-state/v1";
    tasks: readonly ProjectTaskDefinition[];
  }>;

/**
 * 同じSnapshotの定義Hashへ結合した管理実行記録。
 * @responsibility 固定選定・実行Owner・試行値を定義の複製なしに保持する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @shape 対象ID・定義Hash・固定選定・Owner世代・同時数とTask ID別の技術値。
 * @invariant definitionはprojectsだけに置き、Task行は同じ定義のIDを参照する。
 * @boundary 共通保存と任意の実行調停。
 * @security 記録値を現在の実行資格として使用しない。
 * @compatibility 欠測を未実行へ補完しない。
 */
export type ManagedExecution = Pick<
  ProjectExecutionState,
  | "projectId"
  | "milestoneId"
  | "taskExecutionSelections"
  | "ownerGeneration"
  | "maximumConcurrency"
> &
  Readonly<{
    definitionHash: string;
    tasks: readonly (Omit<StoredTask, "definition"> &
      Readonly<{ taskId: string }>)[];
  }>;

/**
 * 管理実行の保存行へCore定義を結合した、codec内部だけの導出値。
 * @responsibility 終端・技術相関の検査に必要なTask定義をメモリ上で結合する。
 * @trace ARCH-000004、ARCH-000008
 * @shape 既存管理Projectと元事実Task行。
 * @invariant この値を物理Snapshotへ保存せず、Core-only対象へ生成しない。
 * @boundary 新Schemaの正本と管理Taskの投影。
 * @security 値は現在の実行資格ではない。
 * @compatibility 旧Schemaの入力や互換読取りを提供しない。
 */
export type ExecutionStoredManagedProject = Omit<
  ProjectExecutionState,
  "tasks"
> &
  Readonly<{ tasks: readonly StoredTask[] }>;

/**
 * 共通状態の物理改訂と元本文Hashを表す。
 * @responsibility 業務世代・受付世代とは別の比較交換値を固定する。
 * @trace ARCH-000008
 * @shape revision、payloadSha256。
 * @invariant 二値を同じ確定本文から導く。
 * @boundary 読取り結果と明示保存要求。
 * @security 改訂値は認可ではない。
 * @compatibility 新Schemaの物理改訂だけ。
 */
export type StateVersion = Readonly<{
  revision: number;
  payloadSha256: string;
}>;

/**
 * 一般定義の認証済みHost接続を表す。
 * @responsibility 元Rootと認証主体、既存内容権限の同期再照合を結合する。
 * @trace ARCH-000008
 * @shape root、principalId、固定用途を受けるrevalidate。
 * @invariant HTTP入力や保存JSONから復元しない。
 * @boundary 信頼したHost構成とDomainの一般CRUD。
 * @security Root確認を操作認可の代用品にしない。
 * @compatibility 新Role・Grant・Authority発行を追加しない。
 */
export type ExecutionModelAccess = Readonly<{
  root: Repository;
  principalId: string;
  revalidate: (
    operation:
      | "definition.read"
      | "definition.write"
      | "decision.read"
      | "decision.record"
      | "queue.read"
      | "queue.enqueue"
      | "runtime.read",
    target: Readonly<{ projectId: string; milestoneId: string }>,
  ) => boolean;
}>;

/**
 * 一般CRUDの固定された保存結果を返す。
 * @responsibility 出版と解放を区別し不明時の元回復参照を保持する。
 * @trace ARCH-000008
 * @shape saved、conflict、blocked又はunknown。
 * @invariant unknownを再試行許可や成功へ変換しない。
 * @boundary Domainの保存APIと利用側。
 * @security 生Error・Path・秘密値を返さない。
 * @compatibility 保存確認は通常保存・読戻し・排他解放まで。
 */
export type ExecutionModelSaveResult<T> =
  | Readonly<{ status: "saved"; value: T; version: StateVersion }>
  | Readonly<{
      status: "conflict";
      value: null;
      reason: "state_changed" | "definition_changed";
    }>
  | Readonly<{
      status: "blocked";
      value: null;
      reason:
        | "input_invalid"
        | "not_authorized"
        | "target_referenced"
        | "target_missing"
        | "target_exists"
        | "state_unavailable"
        | "lock_unavailable"
        | "lock_initialization_failed"
        | "lock_descriptor_close_unconfirmed";
    }>
  | Readonly<{
      status: "unknown";
      value: null;
      reason:
        | "publication_unconfirmed"
        | "lock_release_unconfirmed"
        | "lock_initialization_failed"
        | "lock_descriptor_close_unconfirmed";
      publication: "not_published" | "unconfirmed" | "confirmed";
      recoveryReferences: readonly string[];
    }>;

/**
 * 一般Queryの値・明示不存在・拒否・観測不能を返す。
 * @responsibility 対象の不存在と読取り不能を混同しない。
 * @trace ARCH-000008
 * @shape available、absent、blocked又はunknown。
 * @invariant 拒否時は対象存在も値も返さない。
 * @boundary Domainの一般Query。
 * @security 現在の認可を返却前に再確認する。
 * @compatibility 新しいCache・ページングは追加しない。
 */
export type ExecutionModelReadResult<T> =
  | Readonly<{ status: "available"; value: T; version: StateVersion }>
  | Readonly<{ status: "absent"; value: null; version: StateVersion | null }>
  | Readonly<{
      status: "blocked" | "unknown";
      value: null;
      reason:
        | "input_invalid"
        | "not_authorized"
        | "state_unavailable"
        | "lock_unavailable"
        | "lock_release_unconfirmed"
        | "lock_initialization_failed"
        | "lock_descriptor_close_unconfirmed";
      recoveryReferences?: readonly string[];
    }>;

/**
 * Rootだけを渡す用途固定の観測入力。保存OwnerやSnapshotは渡さない。
 * @responsibility Lease観測に必要な検証済みRootだけを元の呼出し位置へ渡す。
 * @trace ARCH-000008
 * @shape 元の固定入力と、Rootを先頭に受ける観測関数。
 * @invariant RuntimeのFactory・dispatcher・任意Snapshot契約に使用しない。
 * @boundary 保存Module内の有限な関数署名。
 * @security Rootは観測対象であり実行Authorityではない。
 * @compatibility 元の引数と観測回数を維持する。
 */
export type RootObservedInput<T extends readonly unknown[]> = T extends [
  unknown,
  ...infer Rest,
]
  ? Rest extends [...infer Prefix, infer Observations]
    ? [
        ...Prefix,
        {
          [K in keyof Observations]: K extends "resourcesAbsent" | "observeRoot"
            ? Observations[K] extends (...args: infer A) => infer R
              ? (repositoryRoot: string, ...args: A) => R
              : never
            : Observations[K];
        },
      ]
    : never
  : never;

/** 保存候補の全照合後、同じ短期Owner内で一度だけ呼ぶCoordinatorの同期回収操作。 */
export type LeaseRecoveryInput = [
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: Snapshot["leaseIntents"],
  pending: Snapshot["leaseIntents"][number],
  first: Snapshot["leaseIntents"][number],
  recoveryId: string,
  operations: Readonly<{
    observeRoot: (repositoryRoot: string) => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
    recoverResources: (repositoryRoot: string) => boolean;
    resourcesAbsent: (repositoryRoot: string) => boolean;
  }>,
];

/**
 * 固定CRUD用途に対応する成功値を定義する。
 * @responsibility 操作名ごとに利用側が扱う定義型を固定する。
 * @trace ARCH-000008
 * @shape 計画、Objective、Taskと削除ID。
 * @invariant 種別をCallerの自由文字列へ広げない。
 * @boundary 一般CRUDの型付き返却値。
 * @security 型を操作認可にしない。
 * @compatibility 固定された既存属性だけを返す。
 */
export type ExecutionDefinitionValues = {
  "plan.save": Readonly<{
    definition: ObjectivePlan;
    definitionHash: string;
  }>;
  "objective.create": Readonly<{
    definition: ProjectObjectiveDefinition;
    definitionHash: string;
  }>;
  "objective.update": Readonly<{
    definition: ProjectObjectiveDefinition;
    definitionHash: string;
  }>;
  "objective.delete": Readonly<{ id: string }>;
  "task.create": Readonly<{
    definition: ProjectTaskDefinition;
    definitionHash: string;
  }>;
  "task.update": Readonly<{
    definition: ProjectTaskDefinition;
    definitionHash: string;
  }>;
  "task.delete": Readonly<{ id: string }>;
};

/**
 * 固定Query用途に対応する成功値を定義する。
 * @responsibility 生Snapshotではなく用途別の値型を公開関数へ対応付ける。
 * @trace ARCH-000008
 * @shape 計画・Objective・Task・Queueの通常Query値。
 * @invariant 任意field投影を公開しない。
 * @boundary 一般Queryの型付き返却値。
 * @security Host Pathや実行Authorityを返さない。
 * @compatibility 新しい保存正本を作らない。
 */
export type ExecutionContentViews = {
  plan: ExecutionDefinitionValues["plan.save"];
  objectives: readonly ExecutionDefinitionValues["objective.create"][];
  tasks: readonly Readonly<
    ExecutionDefinitionValues["task.create"] & {
      execution: ManagedExecution["tasks"][number] | null;
    }
  >[];
  queue: Snapshot["queueEntries"];
};

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseReadRequest = Readonly<
  | {
      kind: "acquisition";
      input: Parameters<
        typeof import("./crud.ts").projectLeaseAcquisitionOwner
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "owner_loss";
      input: RootObservedInput<
        Parameters<typeof import("./crud.ts").projectLeaseOwnerLossState>
      >;
    }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseRecoveryRequest = Readonly<
  | {
      kind: "reconcile";
      input: RootObservedInput<
        Parameters<
          typeof import("./crud.ts").prepareReleasedLeaseReconciliation
        >
      >;
    }
  | {
      kind: "intent";
      input: RootObservedInput<
        Parameters<typeof import("./crud.ts").prepareLeaseRecoveryReservation>
      >;
    }
  | { kind: "observed"; input: LeaseRecoveryInput }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseReleaseRequest = Readonly<
  | {
      kind: "intent";
      input: Parameters<
        typeof import("./crud.ts").prepareLeaseReleaseIntent
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "observed";
      input: Parameters<
        typeof import("./crud.ts").prepareLeaseReleaseSettlement
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type LeaseAcquisitionRequest = Readonly<
  | {
      kind: "intent";
      input: [
        projectId: string,
        queueId: string,
        kind: LeaseKind,
        owner: Pick<
          Snapshot["leaseIntents"][number],
          "ownerGeneration" | "ownerProcessId"
        >,
        observations: Readonly<{
          resourcesAbsent: (
            repositoryRoot: string,
            identity: string,
          ) => boolean;
          observeRoot: (
            repositoryRoot: string,
          ) => Readonly<{ repositoryRoot: string; rootIdentity: string }>;
          markIntentSaveRequested: (recoveryId: string) => void;
        }>,
      ];
    }
  | {
      kind: "observed";
      input: Parameters<
        typeof import("./crud.ts").prepareLeaseAcquisitionConfirmation
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
>;

export const PROJECT_SNAPSHOT_SCHEMA =
  "crdd-execution-model/project-snapshot/v7";

export const STORAGE_CONTRACT =
  "crdd-coordinator/orchestrator-durable-foundation/v1" as const;
