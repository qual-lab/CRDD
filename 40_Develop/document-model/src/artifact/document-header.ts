/**
 * 文書Headerの意味を検査する。
 * @responsibility 取得済み本文を解析し、中立Issueと観測件数を返す。
 * @trace ARCH-000008
 */
import type { ArtifactSource, DocumentIssue } from "./types.ts";

/**
 * 共通の責任者・決定権限宣言を検査する。
 * @responsibility 取得済みひな型の明示宣言だけを照合する。
 * @trace ARCH-000008
 * @effect N/A: 値比較のみ。
 */
export function inspectAuthorityTemplate(
  source: ArtifactSource,
): readonly DocumentIssue[] {
  return !/^維持責任者: \S+/mu.test(source.content) ||
    !/^基本決定権限: \S+/mu.test(source.content) ||
    !/^項目別例外Authority: \S+/mu.test(source.content) ||
    /項目の決定権限: 必要に応じて/mu.test(source.content)
    ? [
        {
          kind: "artifact.template.authority-invalid",
          targetIdentity: source.path,
          location: { path: source.path },
          reason: "authority-invalid",
          details: {},
        },
      ]
    : [];
}

/**
 * 明示した適用条件と曖昧な任意化を照合する。
 * @responsibility 工程Ownerが固定した必須文言と共通の任意化禁止を検査する。
 * @trace ARCH-000008
 * @effect N/A: 値比較のみ。
 */
export function inspectTemplateApplicability(
  source: ArtifactSource,
  requiredFragments: readonly string[],
  rejectedFragments: readonly string[],
): readonly DocumentIssue[] {
  return requiredFragments.some(
    (fragment) => !source.content.includes(fragment),
  ) || rejectedFragments.some((fragment) => source.content.includes(fragment))
    ? [
        {
          kind: "artifact.template.applicability-invalid",
          targetIdentity: source.path,
          location: { path: source.path },
          reason: "applicability-invalid",
          details: {},
        },
      ]
    : [];
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
  const issues: DocumentIssue[] = [];
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
