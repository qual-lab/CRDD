/**
 * Topic／Meeting正本の固定Markdown Reader。
 *
 * @packageDocumentation
 * @responsibility Topicの現在状態とMeetingの時点記録を別の型として読取り、Identity・状態・要約を共通Consumerへ渡す。
 * @trace ARCH-000006
 * @boundary Topic／Meeting MarkdownとProject Operation公開Read Modelの境界。
 * @effect N/A: 入力文字列だけを解析する。
 * @security 本文にないRelation、Authorityまたは現在状態を補完しない。
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
 * 固定Metadata行から値を取得する。
 *
 * @responsibility 必須Metadataの欠落と空値を同じ失敗として拒否する。
 * @trace ARCH-000006
 * @input linesに正規化済みMarkdown行、labelに固定表示名を受け取る。
 * @returns Backtickと補足括弧を除いた値を返す。
 * @precondition labelはTopic／Meeting契約の固定Metadata名である。
 * @postcondition 空でない値を返す。
 * @effect N/A: 入力配列を変更しない。
 * @failure 欠落または空値をproject_operation_record_metadata_invalidで拒否する。
 * @invariant 推測値や既定値を生成しない。
 * @boundary Markdown Metadataと型付きRecordの境界。
 * @security 値をPathまたはCodeとして評価しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
function readMetadata(lines: readonly string[], label: string): string {
  const prefix = `${label}:`;
  const line = lines.find((candidate) => candidate.startsWith(prefix));
  const value = line
    ?.slice(prefix.length)
    .replaceAll("`", "")
    .replace(/（.*$/u, "")
    .trim();
  if (!value) throw new Error("project_operation_record_metadata_invalid");
  return value;
}

/**
 * 固定節の先行要約を取得する。
 *
 * @responsibility `### 結論`直後の最初の本文段落だけを一覧要約として返す。
 * @trace ARCH-000006
 * @input linesに正規化済みMarkdown行を受け取る。
 * @returns 空でない先行要約を返す。
 * @precondition 正本に`### 結論`が存在する。
 * @postcondition 表や後続節を要約として取り込まない。
 * @effect N/A: 入力配列を変更しない。
 * @failure 結論欠落または空値をproject_operation_record_summary_invalidで拒否する。
 * @invariant AI要約や推測を生成しない。
 * @boundary 正本本文と一覧表示要約の境界。
 * @security MarkdownをHTMLとして実行しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
function readSummary(lines: readonly string[]): string {
  const heading = lines.indexOf("### 結論");
  const value =
    heading < 0
      ? undefined
      : lines.slice(heading + 1).find((line) => line.trim());
  if (!value) throw new Error("project_operation_record_summary_invalid");
  return value.trim();
}

/**
 * Topic Markdownを公開Read Modelへ変換する。
 *
 * @responsibility Topic Identity、Lifecycle状態と現在要約を決定論的に解析する。
 * @trace ARCH-000006
 * @input markdownにtopic.mdのUTF-8本文を受け取る。
 * @returns TopicRecordを返す。
 * @precondition 現行Topic Templateの固定Metadataと現在の論点節が存在する。
 * @postcondition 入力本文のIdentityと状態をそのまま保持する。
 * @effect N/A: Markdownを変更しない。
 * @failure ID、状態、改訂または要約不正をErrorで拒否する。
 * @invariant waiting、promoted、closedをopenへ畳まない。
 * @boundary Topic MarkdownとProject Operation公開Readerの直接境界。
 * @security Relation先を取得・推測しない。
 * @concurrency N/A: 一つの不変Snapshotを同期解析する。
 */
export function parseTopicMarkdown(markdown: string): TopicRecord {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const title = lines[0]?.replace(/^#\s+/u, "").trim() ?? "";
  const topicId = readMetadata(lines, "Topic ID");
  const projectId = readMetadata(lines, "Project ID");
  const state = readMetadata(lines, "状態");
  const revision = Number(readMetadata(lines, "改訂"));
  const owner = readMetadata(lines, "維持責任者");
  if (
    !/^TOPIC-\d{6}$/u.test(topicId) ||
    !title ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new Error("topic_record_identity_invalid");
  if (
    !(["open", "waiting", "promoted", "closed"] as const).includes(
      state as TopicState,
    )
  )
    throw new Error("topic_record_state_invalid");
  return Object.freeze({
    topicId,
    projectId,
    state: state as TopicState,
    revision,
    owner,
    title,
    summary: readSummary(lines),
  });
}

/**
 * Meeting Outcome表のpending件数を数える。
 *
 * @responsibility Outcome表の状態列だけを読み、未処置件数を決定論的に算出する。
 * @trace ARCH-000006
 * @input linesに正規化済みMeeting Markdown行を受け取る。
 * @returns 状態がpendingのOutcome件数を返す。
 * @precondition `## 4. Outcome`に固定表が存在する。
 * @postcondition 他節のpending文字列を数えない。
 * @effect N/A: 入力配列を変更しない。
 * @failure Outcome表または状態列欠落をproject_operation_meeting_outcome_invalidで拒否する。
 * @invariant 空欄をcompletedへ変換しない。
 * @boundary Meeting Outcome表とClose判定の境界。
 * @security CellをCodeとして評価しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
function countPendingOutcomes(lines: readonly string[]): number {
  const section = lines.indexOf("## 4. Outcome");
  const header = lines.findIndex(
    (line, index) => index > section && line.startsWith("| Local ID |"),
  );
  if (section < 0 || header < 0)
    throw new Error("project_operation_meeting_outcome_invalid");
  const columns = (lines[header] ?? "")
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  const stateIndex = columns.indexOf("状態");
  if (stateIndex < 0)
    throw new Error("project_operation_meeting_outcome_invalid");
  let count = 0;
  for (const line of lines.slice(header + 2)) {
    if (!line.trim().startsWith("|")) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.replaceAll("`", "").trim());
    if (cells.length !== columns.length)
      throw new Error("project_operation_meeting_outcome_invalid");
    if (cells[stateIndex] === "pending") count += 1;
  }
  return count;
}

/**
 * Meeting Markdownを公開Read Modelへ変換する。
 *
 * @responsibility Meeting Identity、時点、Lifecycle状態、要約および未処置Outcome件数を解析する。
 * @trace ARCH-000006
 * @input markdownにmeeting.mdのUTF-8本文を受け取る。
 * @returns MeetingRecordを返す。
 * @precondition 現行Meeting Templateの固定Metadata、要約およびOutcome表が存在する。
 * @postcondition closedではpending Outcomeが0件である。
 * @effect N/A: Markdownを変更しない。
 * @failure ID、状態、改訂、要約、OutcomeまたはClose不変条件不正をErrorで拒否する。
 * @invariant 後から判明したTopic現在状態をMeetingへ補完しない。
 * @boundary Meeting MarkdownとProject Operation公開Readerの直接境界。
 * @security Source参照を取得せず、生Transcriptを結果へ追加しない。
 * @concurrency N/A: 一つの不変Snapshotを同期解析する。
 */
export function parseMeetingMarkdown(markdown: string): MeetingRecord {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const title = lines[0]?.replace(/^#\s+/u, "").trim() ?? "";
  const meetingId = readMetadata(lines, "Meeting ID");
  const projectId = readMetadata(lines, "Project ID");
  const state = readMetadata(lines, "状態");
  const occurredAt = readMetadata(lines, "開催日時");
  const revision = Number(readMetadata(lines, "改訂"));
  const owner = readMetadata(lines, "維持責任者");
  const pendingOutcomeCount = countPendingOutcomes(lines);
  if (
    !/^MTG-\d{6}$/u.test(meetingId) ||
    !title ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new Error("meeting_record_identity_invalid");
  if (
    !(["recorded", "closed", "corrected"] as const).includes(
      state as MeetingState,
    )
  )
    throw new Error("meeting_record_state_invalid");
  if (state === "closed" && pendingOutcomeCount > 0)
    throw new Error("meeting_record_pending_outcome");
  return Object.freeze({
    meetingId,
    projectId,
    state: state as MeetingState,
    occurredAt,
    revision,
    owner,
    title,
    summary: readSummary(lines),
    pendingOutcomeCount,
  });
}
