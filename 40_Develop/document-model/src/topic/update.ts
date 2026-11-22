/**
 * Topic昇格で更新するMarkdownを構成する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import {
  assertSafeCell,
  tableCells,
  tableRange,
} from "../artifact/activity-table.ts";
import type { TopicPromotion } from "./types.ts";
import { parseTopicMarkdown } from "./parse.ts";

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
