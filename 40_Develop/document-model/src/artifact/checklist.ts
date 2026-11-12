/**
 * 評価済み成果物とひな型の可視Checklist構造を検査する。
 *
 * @responsibility 項目完全一致・末尾配置・結果記法の既存判定を所有する。
 * @trace ARCH-000008
 * @boundary N/A: 本文と期待項目だけを受け、Filesystem・CLI・Checkerへ依存しない。
 * @effect N/A: 外部I/O・共有状態変更を行わない。
 * @security 評価済みは全項目Passを意味せず、OPEN・FAIL・N/Aも形式が正しければ受理する。
 */
import { omitMarkdownCommentsAndFencedCode } from "./markdown.ts";
import type { ChecklistFailure } from "./types.ts";

/**
 * 評価済みの結果行から項目名を得る。
 *
 * @responsibility 評価結果行から比較対象の項目名だけを抽出する。
 * @trace ARCH-000008
 * @input line: 評価結果行。
 * @returns 抽出した項目名、または形式不一致のnull。
 * @precondition 行のtrimは呼出し元が所有する。
 * @postcondition 既存の結果記法だけを解析する。
 * @effect N/A: 外部I/O・共有状態の変更を行わない。
 * @failure 形式不一致をnullで返す。
 * @invariant parseChecklistItemTextは入力と局所値だけを扱う。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security 解析成功は項目全体の妥当性を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
function parseChecklistItemText(line: string): string | null {
  const checked = /^- \[x\] (?<text>\S.*)$/u.exec(line);
  if (checked?.groups?.text) return checked.groups.text;
  const result = /^- (?:N\/A|OPEN|FAIL): \S.*? — (?<text>\S.*)$/u.exec(line);
  return result?.groups?.text ?? null;
}

/**
 * 評価結果の記載があるChecklistを検査する。
 *
 * @responsibility 可視Checklistの構造・項目順・既存の最初の失敗理由を検査する。
 * @trace ARCH-000008
 * @input markdown: 本文。expectedItems: 期待する項目列。
 * @returns 最初のChecklistFailure、または構造条件に違反がない場合はnull。
 * @precondition 期待項目・対象の選択は呼出し元が所有する。
 * @postcondition 既存の判定順を維持し、入力を変更しない。
 * @effect N/A: 外部I/O・共有状態の変更を行わない。
 * @failure 不正構造を既存の理由値で返す。
 * @invariant inspectEvaluatedChecklistは入力と局所値だけを扱う。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security nullは構造検査だけの成立であり、品質Pass・採用・認可を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
export function inspectEvaluatedChecklist(
  markdown: string,
  expectedItems: readonly string[],
): ChecklistFailure | null {
  const visible = omitMarkdownCommentsAndFencedCode(markdown);
  const sections = [...visible.matchAll(/^## Checklist\s*$/gmu)];
  if (sections.length !== 1) return "missing_or_duplicate";
  const start = sections[0]?.index ?? -1;
  const body = visible.slice(start).replace(/^## Checklist\s*$\r?\n?/mu, "");
  const bodyLines = body.split(/\r?\n/u).map((line) => line.trim());
  if (bodyLines.some((line) => line.length > 0 && !line.startsWith("- ")))
    return "content_after_or_between_items";
  const lines = bodyLines.filter((line) => line.startsWith("- "));
  if (lines.length === 0) return "empty";
  if (lines.some((line) => /^- \[ \]/u.test(line))) return "unevaluated";
  if (
    lines.some(
      (line) =>
        !/^- \[x\] \S/u.test(line) && !/^- (?:N\/A|OPEN|FAIL): \S/u.test(line),
    )
  )
    return "invalid_result";
  const actualItems = lines.map(parseChecklistItemText);
  if (
    actualItems.some((item) => item === null) ||
    actualItems.length !== expectedItems.length ||
    actualItems.some((item, index) => item !== expectedItems[index])
  )
    return "item_set_mismatch";
  return null;
}

/**
 * 未評価項目と結果記法の案内を持つひな型Checklistを検査する。
 *
 * @responsibility 可視Checklistの構造・項目順・既存の最初の失敗理由を検査する。
 * @trace ARCH-000008
 * @input markdown: 本文。expectedItems: 期待する項目列。
 * @returns 最初のChecklistFailure、または構造条件に違反がない場合はnull。
 * @precondition 期待項目・対象の選択は呼出し元が所有する。
 * @postcondition 既存の判定順を維持し、入力を変更しない。
 * @effect N/A: 外部I/O・共有状態の変更を行わない。
 * @failure 不正構造を既存の理由値で返す。
 * @invariant inspectTemplateChecklistは入力と局所値だけを扱う。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security nullは構造検査だけの成立であり、品質Pass・採用・認可を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
export function inspectTemplateChecklist(
  markdown: string,
  expectedItems: readonly string[],
): ChecklistFailure | null {
  const visible = omitMarkdownCommentsAndFencedCode(markdown);
  const sections = [...visible.matchAll(/^## Checklist\s*$/gmu)];
  if (sections.length !== 1) return "missing_or_duplicate";
  const start = sections[0]?.index ?? -1;
  const body = visible.slice(start).replace(/^## Checklist\s*$\r?\n?/mu, "");
  if (!/^- \[ \] \S/mu.test(body)) return "unevaluated_item_missing";
  for (const token of ["[x]", "[ ]", "OPEN", "FAIL", "N/A"]) {
    if (!body.includes(token)) return "result_guidance_missing";
  }
  const bodyLines = body.split(/\r?\n/u).map((line) => line.trim());
  const firstItemIndex = bodyLines.findIndex((line) =>
    line.startsWith("- [ ] "),
  );
  if (
    bodyLines
      .slice(0, firstItemIndex)
      .some(
        (line) => /^#{1,6}(?:\s|$)/u.test(line) || /^(?:=+|-+)\s*$/u.test(line),
      )
  )
    return "nested_or_following_heading";
  if (
    bodyLines
      .slice(firstItemIndex)
      .some((line) => line.length > 0 && !line.startsWith("- [ ] "))
  )
    return "content_after_or_between_items";
  const actualItems = bodyLines
    .filter((line) => line.startsWith("- [ ] "))
    .map((line) => line.slice("- [ ] ".length));
  if (
    actualItems.length !== expectedItems.length ||
    actualItems.some((item, index) => item !== expectedItems[index])
  )
    return "item_set_mismatch";
  if (!body.includes("理由")) return "result_guidance_missing";
  return null;
}
