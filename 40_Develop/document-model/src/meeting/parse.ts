/**
 * Meeting正本を取得済みMarkdownから構造化する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import { readMetadata, readSummary } from "../artifact/activity-table.ts";
import type { MeetingRecord, MeetingState } from "./types.ts";

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
export function countPendingOutcomes(lines: readonly string[]): number {
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
