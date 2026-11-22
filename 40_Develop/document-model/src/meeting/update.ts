/**
 * MeetingのOutcome処置で更新するMarkdownを構成する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import {
  assertSafeCell,
  tableCells,
  tableRange,
} from "../artifact/activity-table.ts";
import type { MeetingOutcomeTreatment } from "./types.ts";
import { countPendingOutcomes, parseMeetingMarkdown } from "./parse.ts";

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
