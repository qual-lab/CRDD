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
 * 固定Markdown表の一つの行をCellへ分解する。
 *
 * @responsibility 外側Delimiterを除き、各Cellの前後空白を正規化する。
 * @trace ARCH-000006
 * @input lineに固定Markdown表の一行を受け取る。
 * @returns 正規化したCell配列を返す。
 * @precondition 入力はPipe区切りの表行である。
 * @postcondition 外側の空Cellを結果へ含めない。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure N/A: 構造妥当性は呼出し側が期待列数で判定する。
 * @invariant Cell内容を解釈または補完しない。
 * @boundary Meeting Markdown表と局所変換処理の境界。
 * @security CellをCodeまたはHTMLとして実行しない。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function tableCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/**
 * Markdown表Cellへ安全に埋め込める値かを検証する。
 *
 * @responsibility 空値、改行およびPipeによる表構造破壊をEffect前に拒否する。
 * @trace ARCH-000006
 * @input valueに候補Cell、reasonに失敗理由を受け取る。
 * @returns N/A: 妥当時は値を返さず処理を継続する。
 * @precondition reasonは利用側が識別できる固定失敗理由である。
 * @postcondition 成功時はvalueを変更しない。
 * @effect N/A: 入力検証だけを行う。
 * @failure 不正値では指定reasonを持つErrorを送出する。
 * @invariant Markdown構造を曖昧にする値を受理しない。
 * @boundary 利用側入力とCanonical Markdown表の境界。
 * @security Markup注入に利用できる構造Delimiterを拒否する。
 * @concurrency N/A: 同期的な純粋検証である。
 */
function assertSafeCell(value: string, reason: string): void {
  if (!value.trim() || /[|\r\n]/u.test(value)) throw new Error(reason);
}

/**
 * 固定節に属する表のHeaderとData範囲を取得する。
 *
 * @responsibility 別節の類似表を誤更新せず対象表範囲を一意に決める。
 * @trace ARCH-000006
 * @input linesにMarkdown行、headingとheaderPrefixに固定識別子を受け取る。
 * @returns Header、Data開始およびData終了Indexを返す。
 * @precondition headingとheaderPrefixは現行Meeting Templateの固定値である。
 * @postcondition endは最初の非表行または文末を指す。
 * @effect N/A: 入力配列を変更しない。
 * @failure 節またはHeader欠落をMeeting Outcome不正として拒否する。
 * @invariant 別節へ探索範囲を拡大しない。
 * @boundary Meeting節構造と表変換の境界。
 * @security 入力行をPathまたはCodeとして評価しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
function tableRange(
  lines: readonly string[],
  heading: string,
  headerPrefix: string,
): Readonly<{ header: number; start: number; end: number }> {
  const section = lines.indexOf(heading);
  const header = lines.findIndex(
    (line, index) => index > section && line.startsWith(headerPrefix),
  );
  if (section < 0 || header < 0)
    throw new Error("project_operation_meeting_outcome_invalid");
  let end = header + 2;
  while (end < lines.length && lines[end]?.trim().startsWith("|")) end += 1;
  return Object.freeze({ header, start: header + 2, end });
}

/**
 * Topicを実在CHGへ昇格接続したCanonical次版へ変換する。
 *
 * @responsibility Topic状態、改訂、Relationおよび終了・昇格表を一つの整合した次版へ変換する。
 * @trace ARCH-000006
 * @input markdownに現在Topic、promotionにApplicationで検証済みの昇格情報を受け取る。
 * @returns 完全検証済みの次Revision Topic Markdownを返す。
 * @precondition promotion.changeIdのCHG正本が同じRepository内に存在し、現在Topicはopenまたはwaitingである。
 * @postcondition stateはpromotedとなり、昇格先CHGをRelationと終了・昇格表の両方から追跡できる。
 * @effect N/A: 文字列を生成するだけでFilesystemへ書き込まない。
 * @failure 状態、固定表、CHG IDまたはCell不正をErrorで拒否する。
 * @invariant Topic Identity、Project、Owner、過去の根拠および経緯を変更しない。
 * @boundary 検証済みTopic Promotion CommandとTopic Markdown次版の境界。
 * @security CHG本文を複製せず、固定安定ID Relationだけを追加する。
 * @concurrency Revision直列化はRepository PortがEffect直前に再確認する。
 */
export function applyTopicPromotion(
  markdown: string,
  promotion: TopicPromotion,
): string {
  if (!/^CHG-\d{6}$/u.test(promotion.changeId))
    throw new Error("project_operation_topic_promotion_target_invalid");
  assertSafeCell(
    promotion.reason,
    "project_operation_topic_promotion_reason_invalid",
  );
  assertSafeCell(
    promotion.remainingResponsibility,
    "project_operation_topic_promotion_remaining_invalid",
  );
  const current = parseTopicMarkdown(markdown);
  if (!(["open", "waiting"] as const).includes(current.state as never))
    throw new Error("project_operation_topic_promotion_state_invalid");
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const stateIndex = lines.findIndex((line) => line.startsWith("状態:"));
  const revisionIndex = lines.findIndex((line) => line.startsWith("改訂:"));
  if (stateIndex < 0 || revisionIndex < 0)
    throw new Error("project_operation_record_metadata_invalid");

  const relation = tableRange(lines, "## 3. 関係", "| 関係種別 |");
  const relationExists = lines
    .slice(relation.start, relation.end)
    .some((line) => tableCells(line)[1]?.includes(promotion.changeId));
  if (!relationExists)
    lines.splice(
      relation.end,
      0,
      `| promoted-to | \`${promotion.changeId}\` | ${promotion.reason} |`,
    );

  lines[stateIndex] = "状態: `promoted`";
  lines[revisionIndex] = `改訂: \`${current.revision + 1}\``;
  const disposition = tableRange(lines, "## 5. 終了・昇格", "| 項目 |");
  for (let index = disposition.start; index < disposition.end; index += 1) {
    const cells = tableCells(lines[index] ?? "");
    if (cells.length !== 2) continue;
    if (cells[0] === "処置") cells[1] = "`promoted`";
    if (cells[0] === "昇格先") cells[1] = `\`${promotion.changeId}\``;
    if (cells[0] === "終了理由") cells[1] = promotion.reason;
    if (cells[0] === "残る影響") cells[1] = promotion.remainingResponsibility;
    lines[index] = `| ${cells.join(" | ")} |`;
  }
  const next = `${lines.join("\n").replace(/\n*$/u, "")}\n`;
  parseTopicMarkdown(next);
  return next;
}

/**
 * Meetingの一つのOutcome処置をCanonical本文へ反映する。
 *
 * @responsibility Outcome表、Action表、Close判定、未処置一覧、状態および改訂を一つの次版へ変換する。
 * @trace ARCH-000006
 * @input markdownに現在Meeting、treatmentに検証候補の処置を受け取る。
 * @returns 完全検証済みの次Revision Markdownを返す。
 * @precondition 対象追跡先の存在とProject境界はApplicationが確認済みである。
 * @postcondition 二つの表は同じOutcome処置を表し、closedではpendingが0件である。
 * @effect N/A: 文字列を生成するだけでFilesystemへ書き込まない。
 * @failure 対象不存在、表不正、安全でないCellまたは未処理CloseをErrorで拒否する。
 * @invariant Meeting Identity、Project、開催日時および当時の確認内容を変更しない。
 * @boundary 検証済みOutcome CommandとMeeting Markdown次版の境界。
 * @security 追跡先を取得・実行せず、Cell構造を壊す入力を拒否する。
 * @concurrency Revision直列化はRepository PortがEffect直前に再確認する。
 */
export function applyMeetingOutcomeTreatment(
  markdown: string,
  treatment: MeetingOutcomeTreatment,
): string {
  if (!/^OUT-\d{3,}$/u.test(treatment.outcomeId))
    throw new Error("project_operation_meeting_outcome_id_invalid");
  for (const [value, reason] of [
    [treatment.owner, "project_operation_meeting_outcome_owner_invalid"],
    [
      treatment.reviewTrigger,
      "project_operation_meeting_outcome_trigger_invalid",
    ],
    [
      treatment.targetReference,
      "project_operation_meeting_outcome_target_invalid",
    ],
    [treatment.treatment, "project_operation_meeting_outcome_action_invalid"],
    [
      treatment.completionCondition,
      "project_operation_meeting_outcome_completion_invalid",
    ],
    [treatment.result, "project_operation_meeting_outcome_result_invalid"],
  ] as const)
    assertSafeCell(value, reason);

  const current = parseMeetingMarkdown(markdown);
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const outcome = tableRange(lines, "## 4. Outcome", "| Local ID |");
  let isOutcomeFound = false;
  for (let index = outcome.start; index < outcome.end; index += 1) {
    const cells = tableCells(lines[index] ?? "");
    if (cells[0]?.replaceAll("`", "") !== treatment.outcomeId) continue;
    if (cells.length !== 7)
      throw new Error("project_operation_meeting_outcome_invalid");
    cells[3] = `\`${treatment.disposition}\``;
    cells[4] = treatment.owner;
    cells[5] = treatment.reviewTrigger;
    cells[6] = `\`${treatment.targetReference}\``;
    lines[index] = `| ${cells.join(" | ")} |`;
    isOutcomeFound = true;
  }
  if (!isOutcomeFound)
    throw new Error("project_operation_meeting_outcome_not_found");

  const action = tableRange(lines, "## 5. Actionと移管", "| Outcome |");
  let isActionFound = false;
  for (let index = action.start; index < action.end; index += 1) {
    const cells = tableCells(lines[index] ?? "");
    if (cells[0]?.replaceAll("`", "") !== treatment.outcomeId) continue;
    if (cells.length !== 5)
      throw new Error("project_operation_meeting_action_invalid");
    cells[1] = treatment.treatment;
    cells[2] = `\`${treatment.targetReference}\``;
    cells[3] = treatment.completionCondition;
    cells[4] = treatment.result;
    lines[index] = `| ${cells.join(" | ")} |`;
    isActionFound = true;
  }
  if (!isActionFound)
    throw new Error("project_operation_meeting_action_not_found");

  const nextPending = countPendingOutcomes(lines);
  if (treatment.closeMeeting && nextPending > 0)
    throw new Error("project_operation_meeting_close_pending_outcome");

  const stateIndex = lines.findIndex((line) => line.startsWith("状態:"));
  const revisionIndex = lines.findIndex((line) => line.startsWith("改訂:"));
  if (stateIndex < 0 || revisionIndex < 0)
    throw new Error("project_operation_record_metadata_invalid");
  if (treatment.closeMeeting) lines[stateIndex] = "状態: `closed`";
  lines[revisionIndex] = `改訂: \`${current.revision + 1}\``;

  const closeRange = tableRange(lines, "## 6. Close・訂正", "| 項目 |");
  for (let index = closeRange.start; index < closeRange.end; index += 1) {
    const cells = tableCells(lines[index] ?? "");
    if (cells.length !== 2) continue;
    if (cells[0] === "Close判定")
      cells[1] = treatment.closeMeeting
        ? "`closed: Outcome全件処置済み`"
        : nextPending === 0
          ? "`ready: Outcome全件処置済み`"
          : "`OPEN: Outcome処置後に評価する`";
    if (cells[0] === "未処置Outcome")
      cells[1] =
        nextPending === 0
          ? "`N/A: pending Outcomeなし`"
          : lines
              .slice(outcome.start, outcome.end)
              .map(tableCells)
              .filter((outcomeCells) => outcomeCells[3]?.includes("`pending`"))
              .map((outcomeCells) => outcomeCells[0])
              .join("、");
    lines[index] = `| ${cells.join(" | ")} |`;
  }

  const next = `${lines.join("\n").replace(/\n*$/u, "")}\n`;
  parseMeetingMarkdown(next);
  return next;
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
