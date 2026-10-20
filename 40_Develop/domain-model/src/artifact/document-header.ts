/**
 * 文書Headerの意味を検査する。
 * @responsibility 取得済み本文を解析し、中立Issueと観測件数を返す。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { readCanonicalDocumentHeader } from "./markdown.ts";

/**
 * 正本文書Headerの版・状態・Released Baselineを解析する。
 * @responsibility 既存のHeader境界と三fieldの限定文法を保持する。
 * @trace ARCH-000008
 * @input content: 取得済み本文。
 * @returns version、status、releasedBaseline。欠落はnull。
 * @precondition contentは文字列である。
 * @postcondition 最初に一致する値だけを返す。
 * @effect N/A: 入力文字列の解析だけを行う。
 * @failure 解析例外を伝播し、欠落を推測しない。
 * @invariant 状態だけtrimし、版とBaselineの文法は変更しない。
 * @boundary N/A: 同期的な値処理。
 * @security 解析は正本の実在・品質・公開許可を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseCanonicalReleaseHeader(content: string) {
  const header = readCanonicalDocumentHeader(content);
  return {
    version: header.match(/^Version:\s*(v[0-9]\S*)\s*$/m)?.[1] ?? null,
    status: header.match(/^Status:\s*(\S.*)\s*$/m)?.[1]?.trim() ?? null,
    releasedBaseline:
      header.match(/^Released Baseline:\s*(v[0-9]\S*)\s*$/m)?.[1] ?? null,
  };
}
/**
 * Related見出し直後の標準文書番号順を検査する。
 * @responsibility Related見出し直後の標準文書番号順を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と診断位置。
 * @returns Related節の存在Booleanと標準番号順の不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 順序不一致をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectRelatedOrder(artifact: ArtifactSource) {
  const issues: DomainIssue[] = [];
  const sourcePath = artifact.path;
  const hasRelated = true;
  const lines = artifact.content.split(/\r?\n/u);
  const related = lines.indexOf("Related:");
  if (related < 0) return { hasRelated: false, issues };

  const numbers = [];
  for (const line of lines.slice(related + 1)) {
    if (!line.startsWith("- ")) break;
    const match = line.match(
      /^-\s+\[[^\]]+\]\((\d{2})_[^)]+\.md(?:#[^)]+)?\)\s*$/u,
    );
    if (match) numbers.push(Number(match[1]));
  }
  const sortedNumbers = [...numbers].sort((a, b) => a - b);
  if (numbers.some((value, index) => value !== sortedNumbers[index])) {
    issues.push({
      kind: "artifact.document-rule.related-order",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "related-order",
      details: { value0: String(JSON.stringify(numbers)) },
    });
  }

  return { hasRelated, issues };
}
