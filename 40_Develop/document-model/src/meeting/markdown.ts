/**
 * Meeting Markdownの読取りとOutcome処置次版を構築する。
 *
 * @packageDocumentation
 * @responsibility 開催時点とIdentityを保持し、未処置Outcomeが残るCloseを拒否する。
 * @trace ARCH-000006
 * @boundary Topic／MeetingのCanonical Markdownと型付き意味処理の境界。
 * @effect N/A: 入力文字列または型宣言だけを扱う。
 * @security 記載されていない状態、RelationまたはAuthorityを補完しない。
 */
import type {
  MeetingState,
  MeetingOutcomeTreatment,
  MeetingRecord,
} from "./types.ts";
import {
  readMetadata,
  readSummary,
  assertSafeCell,
  tableCells,
  tableRange,
} from "../artifact/activity-table.ts";

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
