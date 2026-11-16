/**
 * 基本図処置表の共通構文を解析する内部エンジン。
 * @responsibility 工程名・固定Path・期待図名を所有せず、与えられた有限条件を評価する。
 * @trace ARCH-000008
 */

import { captureDocumentTableRows } from "./markdown.ts";
import { parseMarkdownArtifact } from "./parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentIssue,
  ParseResult,
  DocumentTableRow,
  DocumentText,
} from "./types.ts";

const diagramDispositions = [
  "\x60作成\x60",
  "\x60既存参照\x60",
  "\x60非該当\x60",
  "\x60作成不能\x60",
] as const;

/**
 * 基本図処置表の各行の出現を保持する。
 * @responsibility 後勝ち選択で消える行も原文・位置付きで残す。
 * @trace ARCH-000008
 */
type PhaseDiagramEntry = Readonly<{
  name: string;
  cells: readonly string[];
  source: DocumentText;
}>;

/**
 * 基本図処置ひな型の内容と有限契約の適用範囲を保持する。
 * @responsibility 原文・選択節・全行出現と後勝ち選択・不足を区別する。
 * @trace ARCH-000008
 * @invariant 期待図名の適用判断は工程Ownerが行い、図の実在・品質成立を推測しない。
 */
export type DiagramDisposition = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  expectedDiagrams: readonly string[];
  section: DocumentText | null;
  header: DocumentTableRow | null;
  entries: readonly PhaseDiagramEntry[];
  effectiveRows: ReadonlyMap<string, PhaseDiagramEntry>;
  missingItems: readonly string[];
}>;

/**
 * 取得済み基本図表を工程側の期待条件と照合する。
 * @responsibility raw・節／行境界・後勝ちと既存Issueの構築だけを所有する。
 * @trace ARCH-000008
 * @input source: 原文と相対Path。expectedDiagrams: 工程側の期待図名。initialMissingItems: 工程固有の先行不足理由。
 * @returns 内容モデルと、既存順序の不足項目を持つIssue。
 * @precondition 対象Path・工程・適用条件は利用側が選択している。
 * @postcondition 入力・期待列を変更せず、新しいFile観測を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 不足時も部分内容を返し、解析例外は伝播する。
 * @invariant Header後の一行飛ばし、非Pipe停止、後勝ち、先頭節からEOFを維持する。
 * @boundary 工程の固定条件と共通Markdown表構文。
 * @security 空Issueは図の実在・品質成立を意味しない。
 * @concurrency N/A: 固定定義・別受付と返却配列を共有しない。
 */
export function parseDiagramDisposition(
  source: ArtifactSource,
  expectedDiagrams: readonly string[],
  initialMissingItems: readonly string[] = [],
): ParseResult<DiagramDisposition> & { result: DiagramDisposition } {
  const expectedHeaders = [
    "基本図",
    "対象",
    "目的",
    "処置",
    "現行図／一意な参照／理由",
    "投影元改訂版",
    "現在状態",
    "未確認範囲",
    "次の処置・再評価契機",
  ];
  const allowedDispositions = new Set([
    "",
    "作成",
    "既存参照",
    "非該当",
    "作成不能",
  ]);
  const cells = (line: string): string[] =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/gu, ""));

  const issues: DocumentIssue[] = [];
  const captured = { path: source.path, content: source.content };
  const relativePath = captured.path;
  const content = captured.content;
  const diagrams = [...expectedDiagrams];
  const missingItems = [...initialMissingItems];
  let section: DocumentText | null = null;
  let header: DocumentTableRow | null = null;
  const entries: PhaseDiagramEntry[] = [];
  const effectiveRows = new Map<string, PhaseDiagramEntry>();
  const sectionHeading = /^## (?:[0-9]+\.\s+)?基本図の処置$/mu.exec(content);
  const sectionStart = sectionHeading?.index ?? -1;
  if (sectionStart < 0) missingItems.push("section");
  for (const disposition of diagramDispositions)
    if (!content.includes(disposition)) missingItems.push(disposition);
  const sectionContent = sectionStart < 0 ? "" : content.slice(sectionStart);
  const firstLine = content
    .slice(0, Math.max(sectionStart, 0))
    .split("\n").length;
  if (sectionStart >= 0)
    section = {
      text: sectionContent,
      location: { path: relativePath, line: firstLine },
    };
  const lines = sectionContent.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => line.startsWith("| 基本図 |"));
  const headerCells = headerIndex < 0 ? [] : cells(lines[headerIndex] ?? "");
  if (headerIndex >= 0)
    header = {
      cells: headerCells,
      location: { path: relativePath, line: firstLine + headerIndex },
    };
  if (
    headerCells.length !== expectedHeaders.length ||
    headerCells.some((value, index) => value !== expectedHeaders[index])
  )
    missingItems.push("header");
  if (headerIndex >= 0) {
    for (const [index, line] of lines.slice(headerIndex + 2).entries()) {
      if (!line.startsWith("|")) break;
      const rowCells = cells(line);
      const entry = {
        name: rowCells[0] ?? "",
        cells: rowCells,
        source: {
          text: line,
          location: {
            path: relativePath,
            line: firstLine + headerIndex + 2 + index,
          },
        },
      };
      entries.push(entry);
      if (entry.name) effectiveRows.set(entry.name, entry);
    }
  }
  for (const diagram of diagrams) {
    const rowCells = effectiveRows.get(diagram)?.cells;
    if (!rowCells) {
      missingItems.push(diagram);
      continue;
    }
    if (rowCells.length !== expectedHeaders.length)
      missingItems.push(`${diagram}:columns`);
    const disposition = rowCells[3] ?? "";
    if (!allowedDispositions.has(disposition))
      missingItems.push(`${diagram}:disposition=${disposition}`);
  }
  if (missingItems.length > 0)
    issues.push({
      kind: "artifact.phase-diagram.contract-invalid",
      targetIdentity: relativePath,
      location: { path: relativePath },
      reason: "contract_incomplete",
      details: { missingItems: missingItems.join(", ") },
    });

  return {
    status: issues.length ? "partial" : "complete",
    result: {
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      tableRows: captureDocumentTableRows(captured),
      expectedDiagrams: diagrams,
      section,
      header,
      entries,
      effectiveRows,
      missingItems,
    },
    issues,
  };
}
