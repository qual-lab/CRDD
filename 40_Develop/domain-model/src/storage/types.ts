/**
 * Topic／Meetingの共通保存・操作が受け渡す型契約。
 *
 * @responsibility 一覧、改訂付きCRUD、Relation、昇格およびOutcome処置の共有値を定義する。
 * @trace ARCH-000006
 */
import type { TopicRecord } from "../topic/types.ts";
import type {
  MeetingRecord,
  MeetingOutcomeDisposition,
} from "../meeting/types.ts";

/**
 * 同じ認可済みRepositoryに対する二つの種別固定操作を束ねる型。
 *
 * @responsibility 利用側の構成がTopicとMeetingの公開操作を保持できる形を定義する。
 * @trace ARCH-000006
 * @shape topicとmeetingの専用Applicationを持つ不変組。
 * @invariant 一つの共通CRUD実装を利用し、組自体は操作・保存・認可を追加しない。
 * @boundary Domain Model公開操作と利用側Compositionの型境界。
 * @security Repository選定・認可は構成側が確認し、型からAuthorityを推定しない。
 * @compatibility 専用操作の結果契約を保持し、旧汎用操作への互換Aliasを提供しない。
 */
export type TopicMeetingApplications = Readonly<{
  topic: import("../topic/types.ts").TopicApplication;
  meeting: import("../meeting/types.ts").MeetingApplication;
}>;

/**
 * 一つの成果物種別に固定したTopic／Meetingの共通CRUD境界。
 *
 * @responsibility 種別の選択を生成時に固定し、呼出し側が別種別の書込みを選択できない操作形を定義する。
 * @trace ARCH-000006
 * @shape 一覧、取得、Relation、登録、改訂付き編集、削除評価および削除の固定種別操作。
 * @invariant 種別を受け取る引数は公開せず、期待改訂と削除確認の契約を保持する。
 * @boundary TopicまたはMeetingの公開入口と利用側の型境界。
 * @security 任意PathやRepository Rootを公開結果へ含めない。
 * @compatibility 共通Applicationの既存結果型を維持し、種別の指定だけを公開面から除く。
 */
export type TopicMeetingScopedApplication = Readonly<{
  list(
    input: Omit<Parameters<TopicMeetingApplication["list"]>[0], "kind">,
  ): TopicMeetingPage;
  get(id: string): ProjectOperationRecord | null;
  getDocument(id: string): TopicMeetingDocument | null;
  relations(id: string): readonly TopicMeetingRelation[];
  hasRelationTarget: TopicMeetingApplication["hasRelationTarget"];
  create(markdown: string): TopicMeetingWriteResult;
  update(
    input: Omit<Parameters<TopicMeetingApplication["update"]>[0], "kind">,
  ): TopicMeetingWriteResult;
  inspectDeletion(
    id: string,
  ): ReturnType<TopicMeetingRepository["inspectDeletion"]>;
  delete(
    input: Omit<Parameters<TopicMeetingRepository["delete"]>[0], "kind">,
  ): TopicMeetingWriteResult;
}>;

/**
 * Meeting Outcomeの追跡先種別と参照を定義する。
 *
 * @responsibility Topic、CHG、責任主体および追跡不要を型で区別する。
 * @trace ARCH-000006
 * @shape kindと文字列referenceを持つ判別Union。
 * @invariant 処置状態との許可組合せはApplicationが検証する。
 * @boundary Workbench／MCP入力とProject Operation Applicationの境界。
 * @security 非開示Repositoryや別Projectの存在を補完しない。
 * @compatibility kind追加時は全入口とRelation検証を同時更新する。
 */
export type MeetingOutcomeTarget = Readonly<
  | { kind: "topic"; reference: string }
  | { kind: "change"; reference: string }
  | { kind: "owner"; reference: string }
  | { kind: "none"; reference: string }
>;

/**
 * Meeting Outcome処置の公開結果を定義する。
 *
 * @responsibility 完了とEffect 0拒否を理由、現在RecordおよびEffect件数と相関させる。
 * @trace ARCH-000006
 * @shape status、reason、record、filesystemEffectCountを持つ閉じた結果。
 * @invariant blocked結果のFilesystem Effect件数は0である。
 * @boundary Project Operation ApplicationとWorkbench／MCPの結果境界。
 * @security Filesystem Pathや非開示Relation内容を含めない。
 * @compatibility reason追加時は表示入口と契約試験を再評価する。
 */
export type MeetingOutcomeCommandResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "meeting_outcome_treated"
    | "record_not_found"
    | "record_revision_conflict"
    | "meeting_outcome_target_invalid"
    | "meeting_outcome_target_not_found"
    | "meeting_outcome_target_project_mismatch"
    | "meeting_outcome_invalid";
  record: ProjectOperationRecord | null;
  filesystemEffectCount: 0 | 1;
}>;

/**
 * Topic昇格接続の公開結果を定義する。
 *
 * @responsibility 完了とEffect 0拒否を理由、現在RecordおよびEffect件数と相関させる。
 * @trace ARCH-000006
 * @shape status、reason、record、filesystemEffectCountを持つ閉じた結果。
 * @invariant blocked結果のFilesystem Effect件数は0である。
 * @boundary Project Operation ApplicationとWorkbench／MCPの結果境界。
 * @security CHG本文やFilesystem Pathを含めない。
 * @compatibility reason追加時は全入口と契約試験を再評価する。
 */
export type TopicPromotionCommandResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "topic_promoted"
    | "record_not_found"
    | "record_revision_conflict"
    | "topic_promotion_target_not_found"
    | "topic_promotion_invalid";
  record: ProjectOperationRecord | null;
  filesystemEffectCount: 0 | 1;
}>;

/**
 * Topic／Meetingの検索・更新Application境界で使用するTopicMeetingPageの構造を固定する。
 *
 * @responsibility Topic／Meetingの検索・更新Application境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type TopicMeetingPage = Readonly<{
  status: "available" | "not_configured";
  records: readonly ProjectOperationRecord[];
  nextCursor: string | null;
}>;

/**
 * Topic／Meeting本文から解決した安定ID Relationを定義する。
 *
 * @responsibility Relationの識別子、種別および現在Repository内の解決状態を一つの値へ閉じる。
 * @trace ARCH-000006
 * @shape id、kind、stateを持つ不変値。
 * @invariant availableは同じRepository内のCanonical RecordまたはCHG正本が現在存在する場合だけである。
 * @boundary Project Operation Canonical MarkdownとWorkbench／MCP Navigationの型境界。
 * @security 任意Pathや非開示RepositoryをRelationへ変換しない。
 * @compatibility 新しいRelation種別はOwner正本と安全な解決契約が確定した後だけ追加する。
 */
export type TopicMeetingRelation = Readonly<{
  id: string;
  kind: "topic" | "meeting" | "change";
  state: "available" | "not_found" | "unavailable" | "conflicting";
  ownerRepositoryId?: string;
}>;

/**
 * Topic／Meeting一覧の検索・絞込み・並び順を定義する。
 *
 * @responsibility Collection UIとMCPが共有する検索、状態、Owner、Relation、期間、未処置およびSortの語彙を固定する。
 * @trace ARCH-000006
 * @shape 全Record共通条件とMeeting限定条件を表す。
 * @invariant 未指定条件を暗黙Filterへ変換しない。
 * @boundary Workbench／MCP入力とProject Operation Applicationの型境界。
 * @security Relationは安定IDだけを受け、任意Pathまたは正規表現を実行しない。
 * @compatibility 条件追加時はCursor署名と全Consumerを同時更新する。
 */
export type TopicMeetingListQuery = Readonly<{
  query?: string;
  states?: readonly string[];
  owner?: string;
  relation?: string;
  occurredFrom?: string;
  occurredTo?: string;
  pendingOnly?: boolean;
  sort?: "id_asc" | "title_asc" | "state_asc" | "occurred_desc";
}>;

/**
 * Topic／Meetingの検索・更新Application境界で使用するTopicMeetingApplicationの構造を固定する。
 *
 * @responsibility Topic／Meetingの検索・更新Application境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type TopicMeetingApplication = Readonly<{
  list(input: {
    kind: ProjectOperationRecordKind;
    cursor?: string;
    limit?: number;
    query?: TopicMeetingListQuery;
  }): TopicMeetingPage;
  get(
    kind: ProjectOperationRecordKind,
    id: string,
  ): ProjectOperationRecord | null;
  getDocument: TopicMeetingRepository["getDocument"];
  relations(
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[];
  hasRelationTarget(kind: TopicMeetingRelation["kind"], id: string): boolean;
  create(
    kind: ProjectOperationRecordKind,
    markdown: string,
  ): ReturnType<TopicMeetingRepository["create"]>;
  update(input: {
    kind: ProjectOperationRecordKind;
    id: string;
    expectedRevision: number;
    markdown: string;
  }): ReturnType<TopicMeetingRepository["update"]>;
  inspectDeletion(
    kind: ProjectOperationRecordKind,
    id: string,
  ): ReturnType<TopicMeetingRepository["inspectDeletion"]>;
  delete(
    input: Parameters<TopicMeetingRepository["delete"]>[0],
  ): ReturnType<TopicMeetingRepository["delete"]>;
  promoteTopic(input: {
    topicId: string;
    expectedRevision: number;
    changeId: string;
    reason: string;
    remainingResponsibility: string;
  }): TopicPromotionCommandResult;
  treatMeetingOutcome(input: {
    meetingId: string;
    expectedRevision: number;
    outcomeId: string;
    disposition: MeetingOutcomeDisposition;
    owner: string;
    reviewTrigger: string;
    target: MeetingOutcomeTarget;
    treatment: string;
    completionCondition: string;
    result: string;
    closeMeeting: boolean;
  }): MeetingOutcomeCommandResult;
}>;

/**
 * Topic／Meeting Markdown正本のRepository境界で使用するProjectOperationRecordKindの構造を固定する。
 *
 * @responsibility Topic／Meeting Markdown正本のRepository境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProjectOperationRecordKind = "topic" | "meeting";

/**
 * Topic／Meeting Markdown正本のRepository境界で使用するProjectOperationRecordの構造を固定する。
 *
 * @responsibility Topic／Meeting Markdown正本のRepository境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */
export type ProjectOperationRecord = TopicRecord | MeetingRecord;

/**
 * Topic／Meeting Markdown正本のRepository境界で使用するTopicMeetingDocumentの構造を固定する。
 *
 * @responsibility Topic／Meeting Markdown正本のRepository境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */
export type TopicMeetingDocument = Readonly<{
  record: ProjectOperationRecord;
  markdown: string;
}>;

/**
 * Topic／Meeting Markdown正本のRepository境界で使用するTopicMeetingListResultの構造を固定する。
 *
 * @responsibility Topic／Meeting Markdown正本のRepository境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type TopicMeetingListResult = Readonly<
  | {
      status: "available";
      records: readonly ProjectOperationRecord[];
    }
  | { status: "not_configured"; records: readonly ProjectOperationRecord[] }
>;

/**
 * Topic／Meeting Markdown正本のRepository境界で使用するTopicMeetingWriteResultの構造を固定する。
 *
 * @responsibility Topic／Meeting Markdown正本のRepository境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type TopicMeetingWriteResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "record_created"
    | "record_updated"
    | "record_deleted"
    | "record_already_exists"
    | "record_not_found"
    | "record_revision_conflict"
    | "record_identity_changed"
    | "record_delete_confirmation_required"
    | "record_delete_reason_invalid"
    | "record_relations_require_resolution";
  record: ProjectOperationRecord | null;
  relationPaths: readonly string[];
  filesystemEffectCount: 0 | 1;
}>;

/**
 * Topic／Meeting Markdown正本のRepository境界で使用するTopicMeetingRepositoryの構造を固定する。
 *
 * @responsibility Topic／Meeting Markdown正本のRepository境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000006
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type TopicMeetingRepository = Readonly<{
  get(
    kind: ProjectOperationRecordKind,
    id: string,
  ): ProjectOperationRecord | null;
  getDocument(
    kind: ProjectOperationRecordKind,
    id: string,
  ): TopicMeetingDocument | null;
  list(kind: ProjectOperationRecordKind): TopicMeetingListResult;
  hasChange(id: string): boolean;
  create(
    kind: ProjectOperationRecordKind,
    markdown: string,
  ): TopicMeetingWriteResult;
  update(
    kind: ProjectOperationRecordKind,
    id: string,
    expectedRevision: number,
    markdown: string,
  ): TopicMeetingWriteResult;
  inspectDeletion(
    kind: ProjectOperationRecordKind,
    id: string,
  ): Readonly<{
    record: ProjectOperationRecord | null;
    relationPaths: readonly string[];
  }>;
  delete(input: {
    kind: ProjectOperationRecordKind;
    id: string;
    expectedRevision: number;
    confirmed: boolean;
    reason: "mistaken_registration";
  }): TopicMeetingWriteResult;
}>;
/**
 * temporary-operation-storeで使用するTemporary Operation Capabilityの値契約を定義する。
 *
 * @responsibility Temporary Operation CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationCapabilityの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryOperationCapability = Readonly<{
  contract: "crdd/runtime-data/temporary-operation-capability/v1";
}>;

/**
 * temporary-operation-storeで使用するTemporary Evidence Promotion Receiptの値契約を定義する。
 *
 * @responsibility Temporary Evidence Promotion ReceiptのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryEvidencePromotionReceiptが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryEvidencePromotionReceiptで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryEvidencePromotionReceiptの宣言は外部境界を開かない。
 * @security N/A: TemporaryEvidencePromotionReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryEvidencePromotionReceiptの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryEvidencePromotionReceipt = Readonly<{
  contract: "crdd/runtime-data/temporary-evidence-promotion-receipt/v1";
}>;

/**
 * temporary-operation-storeで使用するTemporary Operation 回復 Referenceの値契約を定義する。
 *
 * @responsibility Temporary Operation 回復 ReferenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationRecoveryReferenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationRecoveryReferenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationRecoveryReferenceの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationRecoveryReferenceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationRecoveryReferenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryOperationRecoveryReference = Readonly<{
  operationId: string;
  owner: string;
  storage?: "signature";
  identity: string;
  generation: number;
}>;
