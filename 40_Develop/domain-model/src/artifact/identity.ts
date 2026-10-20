/**
 * 安定IDの定義と所有リンクを解析する。
 * @responsibility 取得済み本文のIdentity条件と位置を中立モデルへ変換する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { parseMarkdownFences } from "./markdown.ts";
import { omitMarkdownFencedCode } from "./anchors.ts";
/**
 * 生本文の安定ID出現を出現順・重複付きで解析する。
 * @responsibility 全出現の観測を明示定義の所有と区別する。
 * @trace ARCH-000008
 * @input content: 取得済み生本文。
 * @returns REQ／UX／IA／UI／SPECの安定ID出現列。
 * @precondition contentは文字列である。
 * @postcondition Fenceや重複を除外しない。
 * @effect N/A: 文字列解析だけを行う。
 * @failure 解析例外を伝播する。
 * @invariant 出現を定義・所有確認済みと扱わない。
 * @boundary N/A: 同期的な値処理。
 * @security 実在・認可・所有を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseStableIdentityOccurrences(content: string): string[] {
  return Array.from(
    content.matchAll(/\b(?:REQ|UX|IA|UI|SPEC)-\d{6}\b/gu),
    (match) => match[0],
  );
}

/**
 * 安定IDの明示定義が一箇所だけに属することを検査する。
 * @responsibility 全出現ではなく明示定義の所有位置の重複を検出する。
 * @trace ARCH-000008
 * @input definitionsById: IDごとの定義位置の出現列。
 * @returns 所有重複のIssueをMapの入力順で返す。
 * @precondition 各文書の定義解析と位置の集約が完了している。
 * @postcondition 重複を集合化せず、元の位置列を保持する。
 * @effect N/A: 入力の読取りと局所Issue構築のみ。
 * @failure 二件以上の所有位置をIssueで返す。
 * @invariant 入力Map・配列を変更しない。
 * @boundary N/A: 同期的な値処理。
 * @security 文書の取得不能を不存在へ補完しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function inspectStableIdentityOwnership(
  definitionsById: ReadonlyMap<string, readonly string[]>,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  for (const [stableId, definitions] of definitionsById) {
    if (definitions.length > 1)
      issues.push({
        kind: "artifact.document-identity.duplicate-stable-id-definition",
        targetIdentity: stableId,
        location: { path: definitions.join(", ") },
        reason: "duplicate-stable-id-definition",
        details: { stableId },
      });
  }
  return issues;
}
/**
 * 可視のREQリンクがEXP分析を定義所有者として扱わないことを検査する。
 * @responsibility 可視のREQリンクがEXP分析を定義所有者として扱わないことを検査する。
 * @trace ARCH-000008
 * @input artifact: 取得済み生本文と診断位置。
 * @returns 可視REQリンクがEXP分析へ向く所有不一致のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectDiscoveryIdentityLinks(artifact: ArtifactSource) {
  const issues: DomainIssue[] = [];
  const file = artifact.path;
  const markdown = parseMarkdownFences(
    artifact.content.replace(/^\uFEFF/u, "").split(/\r?\n/u),
  );
  for (const entry of markdown.entries) {
    if (!entry.outside) continue;
    for (const match of entry.text.matchAll(
      /\[`?(REQ-[0-9]{6})`?\]\(([^)]+)\)/gu,
    )) {
      const target = (match[2] as string).replaceAll("\\", "/");
      if (!target.includes("01_Discovery/Analysis/EXP-")) continue;
      issues.push({
        kind: "artifact.document-identity.discovery-identity-link-owner-mismatch",
        targetIdentity: file,
        location: { path: file },
        reason: "discovery-identity-link-owner-mismatch",
        details: { value0: String(match[1]) },
      });
    }
  }
  return { issues };
}
/**
 * 生本文から手動改訂と明示定義を解析し、出現位置を保持する。
 * @responsibility 生本文から手動改訂と明示定義を解析し、出現位置を保持する。
 * @trace ARCH-000008
 * @input artifact: 取得済み生本文と位置。isUxIndex: UX入口の表形式定義も解析するか。
 * @returns IDごとの明示定義位置Mapと手動改訂のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正な改訂表記をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectStableIdentityDefinitions(
  artifact: ArtifactSource,
  isUxIndex: boolean,
) {
  const issues: DomainIssue[] = [];
  const text = artifact.content,
    file = artifact.path;
  const stableIdDefinitions = new Map<string, string[]>();
  const manualStableIdRevisionPattern = /\b(?:REQ|UX|IA|UI|SPEC)-\d{6}@\d+\b/gu;
  const meaningfulText = omitMarkdownFencedCode(text);
  for (const match of meaningfulText.matchAll(manualStableIdRevisionPattern)) {
    issues.push({
      kind: "artifact.document-identity.stable-id-manual-revision",
      targetIdentity: file,
      location: { path: file },
      reason: "stable-id-manual-revision",
      details: { value0: String(match[0]) },
    });
  }
  const definitionLines = meaningfulText.split(/\r?\n/u);
  for (let lineIndex = 0; lineIndex < definitionLines.length; lineIndex += 1) {
    const line = definitionLines[lineIndex] as string;
    const match =
      line.match(
        /^\s*(?:id|context_id):\s*((?:REQ|UX|IA|UI|SPEC)-\d{6})\s*$/u,
      ) ?? line.match(/^#{1,6}\s+((?:REQ|UX|IA|UI|SPEC)-\d{6})(?:\s|$)/u);
    if (!match) continue;
    const definitions = stableIdDefinitions.get(match[1] as string) ?? [];
    definitions.push(`${file}:${lineIndex + 1}`);
    stableIdDefinitions.set(match[1] as string, definitions);
  }
  if (isUxIndex) {
    for (
      let lineIndex = 0;
      lineIndex < definitionLines.length;
      lineIndex += 1
    ) {
      const match = (definitionLines[lineIndex] as string).match(
        /^\| `(UX-[0-9]{6})`\s+[^|]+\|/u,
      );
      if (!match) continue;
      const definitions = stableIdDefinitions.get(match[1] as string) ?? [];
      definitions.push(`${file}:${lineIndex + 1}`);
      stableIdDefinitions.set(match[1] as string, definitions);
    }
  }

  return { stableIdDefinitions, issues };
}
