/**
 * Topicの状態と昇格・読取り契約を定義する。
 *
 * @packageDocumentation
 * @responsibility Topicの不変値とLifecycle状態だけを保持する。
 * @trace ARCH-000006
 * @boundary Topic／MeetingのCanonical Markdownと型付き意味処理の境界。
 * @effect N/A: 入力文字列または型宣言だけを扱う。
 * @security 記載されていない状態、RelationまたはAuthorityを補完しない。
 */
/**
 * Topicの固定状態を定義する。
 *
 * @responsibility Topic Lifecycleの四状態を型境界で固定する。
 * @trace ARCH-000006
 * @shape open、waiting、promoted、closedの閉集合を表す。
 * @invariant 情報不足をclosedへ変換しない。
 * @boundary Topic ReaderとConsumerの状態境界。
 * @security N/A: 状態値だけを表す。
 * @compatibility 状態追加時はLifecycleと全Consumerを再評価する。
 */
export type TopicState = "open" | "waiting" | "promoted" | "closed";

/**
 * Topicを実在CHGへ昇格接続する入力契約を定義する。
 *
 * @responsibility 昇格先、採用理由およびTopicに残る責務を一つの次版へ反映する値として閉じる。
 * @trace ARCH-000006
 * @shape changeId、reason、remainingResponsibilityを持つ不変値。
 * @invariant CHGの作成・採用Authorityは含まず、Applicationで確認済みの既存CHGだけを対象にする。
 * @boundary Project Operation ApplicationとTopic Markdown変換の境界。
 * @security 任意PathまたはCHG本文を入力として受けない。
 * @compatibility Field変更時はWorkbench、MCPおよびQualityを同時更新する。
 */
export type TopicPromotion = Readonly<{
  changeId: string;
  reason: string;
  remainingResponsibility: string;
}>;

/**
 * Topicの一覧・詳細入口で共有するRead Modelを定義する。
 *
 * @responsibility Topic Identity、Project、状態、改訂、Owner、名称および現在要約を一つの結果へ閉じる。
 * @trace ARCH-000006
 * @shape Topic Metadataと表示用要約を表す。
 * @invariant Topic IDは本文の値をそのまま保持する。
 * @boundary Topic MarkdownとWorkbench／MCPの結果境界。
 * @security Relation先の内容を推測して追加しない。
 * @compatibility 詳細本文の追加を一覧契約の破壊変更にしない。
 */
export type TopicRecord = Readonly<{
  topicId: string;
  projectId: string;
  state: TopicState;
  revision: number;
  owner: string;
  title: string;
  summary: string;
}>;
/**
 * Topicだけを編集する公開操作の型契約。
 *
 * @responsibility 固定種別CRUDとTopic昇格を公開し、別成果物の専用操作を公開しない。
 * @trace ARCH-000006
 * @shape 種別固定CRUDとpromoteTopicを持つ不変操作集合。
 * @invariant 呼出し側は別種別への書込みを選択できない。
 * @boundary Topic公開入口とWorkbench／MCPの型境界。
 * @security 保存結果へ秘密値や任意Pathを追加しない。
 * @compatibility 既存CRUD結果と改訂競合・削除確認を保持する。
 */
export type TopicApplication =
  import("../storage/types.ts").TopicMeetingScopedApplication &
    Pick<import("../storage/types.ts").TopicMeetingApplication, "promoteTopic">;
