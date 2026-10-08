/**
 * Meetingの状態とOutcome・読取り契約を定義する。
 *
 * @packageDocumentation
 * @responsibility Meetingの時点記録、未処置Outcomeと処置入力の不変値だけを保持する。
 * @trace ARCH-000006
 * @boundary Topic／MeetingのCanonical Markdownと型付き意味処理の境界。
 * @effect N/A: 入力文字列または型宣言だけを扱う。
 * @security 記載されていない状態、RelationまたはAuthorityを補完しない。
 */
/**
 * Meetingの固定状態を定義する。
 *
 * @responsibility 記録済み、終了、訂正を型境界で固定する。
 * @trace ARCH-000006
 * @shape recorded、closed、correctedの閉集合を表す。
 * @invariant pending Outcomeを持つMeetingをclosedとして受理しない。
 * @boundary Meeting ReaderとConsumerの状態境界。
 * @security N/A: 状態値だけを表す。
 * @compatibility 状態追加時はOutcome処置と全Consumerを再評価する。
 */
export type MeetingState = "recorded" | "closed" | "corrected";

/**
 * Meeting Outcomeに許可する処置状態を定義する。
 *
 * @responsibility pending以外の四つの終端処置を閉集合として所有する。
 * @trace ARCH-000006
 * @shape completed、transferred、promoted、rejectedの文字列Union。
 * @invariant pendingを処置済み結果として受理しない。
 * @boundary Meeting Outcome変換と利用側Commandの型境界。
 * @security N/A: 公開可否やAuthorityを表さない状態型である。
 * @compatibility 値追加時はTemplate、MCP、WorkbenchおよびQualityを再評価する。
 */
export type MeetingOutcomeDisposition =
  | "completed"
  | "transferred"
  | "promoted"
  | "rejected";

/**
 * 一つのMeeting Outcomeを処置する入力契約を定義する。
 *
 * @responsibility Outcome表、Action表およびClose判定へ同時反映する値を一つに閉じる。
 * @trace ARCH-000006
 * @shape Outcome Local ID、処置状態、Owner、再評価契機、追跡先、完了条件、結果およびClose要求。
 * @invariant 一つの入力が一つのOutcomeだけを対象にする。
 * @boundary Project Operation ApplicationとMeeting Markdown変換の境界。
 * @security Authorityを生成せず、検証済みApplication入力だけを受ける。
 * @compatibility Field変更時はMCP／Workbench入力契約を同時更新する。
 */
export type MeetingOutcomeTreatment = Readonly<{
  outcomeId: string;
  disposition: MeetingOutcomeDisposition;
  owner: string;
  reviewTrigger: string;
  targetReference: string;
  treatment: string;
  completionCondition: string;
  result: string;
  closeMeeting: boolean;
}>;

/**
 * Meetingの一覧・詳細入口で共有するRead Modelを定義する。
 *
 * @responsibility Meeting Identity、Project、状態、開催日時、改訂、Owner、名称、要約および未処置Outcome数を閉じる。
 * @trace ARCH-000006
 * @shape Meeting MetadataとOutcome処置状態を表す。
 * @invariant closedのpendingOutcomeCountは0である。
 * @boundary Meeting MarkdownとWorkbench／MCPの結果境界。
 * @security 生Transcriptまたは非開示Sourceを結果へ追加しない。
 * @compatibility Outcome詳細の追加を一覧契約の破壊変更にしない。
 */
export type MeetingRecord = Readonly<{
  meetingId: string;
  projectId: string;
  state: MeetingState;
  occurredAt: string;
  revision: number;
  owner: string;
  title: string;
  summary: string;
  pendingOutcomeCount: number;
}>;
/**
 * Meetingだけを編集する公開操作の型契約。
 *
 * @responsibility 固定種別CRUDとMeeting Outcome処置を公開し、別成果物の専用操作を公開しない。
 * @trace ARCH-000006
 * @shape 種別固定CRUDとtreatMeetingOutcomeを持つ不変操作集合。
 * @invariant 呼出し側は別種別への書込みを選択できない。
 * @boundary Meeting公開入口とWorkbench／MCPの型境界。
 * @security 保存結果へ秘密値や任意Pathを追加しない。
 * @compatibility 既存CRUD結果と改訂競合・削除確認を保持する。
 */
export type MeetingOperations =
  import("../activity/types.ts").ScopedTopicMeetingOperations &
    Pick<
      import("../activity/types.ts").TopicMeetingOperations,
      "treatMeetingOutcome"
    >;
