/**
 * Change文書種別の完成受付を提供する。
 * @responsibility raw内容・出典を捕捉して単体診断を返し、Filesystemを観測しない。
 * @trace ARCH-000008
 */
import {
  captureDocumentSections,
  captureDocumentTableRows,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactSource,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import type { ChangeDocument, ChangeIndex } from "./types.ts";
import { validateChangeDocument, validateChangeIndex } from "./validation.ts";

/**
 * raw本文の一致出現を位置付きで捕捉する。
 * @responsibility 同じ文字列の重複と行位置を保持する。
 * @trace ARCH-000008
 */
function captureMatches(
  source: ArtifactSource,
  pattern: RegExp,
): DocumentText[] {
  return Array.from(source.content.matchAll(pattern), (match) => ({
    text: match[0],
    location: {
      path: source.path,
      line: source.content.slice(0, match.index).split("\n").length,
    },
  }));
}

/**
 * Change本文またはそのひな型を解析し、文書単体の問題を返す。
 * @responsibility 内容・Header・影響区画・収束表を一度捕捉し局所検査へ渡す。
 * @trace ARCH-000008
 * @input source: 取得済みraw本文。options: 明示した方式と列挙元の期待Identity。
 * @returns 不正本文も保持するモデルと既存順の問題。
 * @precondition ファイル取得・配置・適用判断は利用側が所有する。
 * @postcondition 先頭40行のHeaderと全本文の構造を区別する。
 * @effect N/A: 取得済み値だけを扱う。
 * @failure 未知modeと解析例外を拒否し、内容を補完しない。
 * @invariant Canonicalの番号条件は期待Identityを優先し、Template条件と混ぜない。
 * @boundary 文書単体の解析と外部集合の比較。
 * @security Headerや空Issueを配置・所有・採用の証明にしない。
 * @concurrency N/A: 共有状態なし。
 */
export function parseChangeDocument(
  source: ArtifactSource,
  options: Readonly<{
    mode: "canonical" | "template";
    expectedIdentity?: string;
  }>,
): ParseResult<ChangeDocument> & Readonly<{ result: ChangeDocument }> {
  if (options.mode !== "canonical" && options.mode !== "template")
    throw new Error("unknown_change_document_mode");
  const captured = { path: source.path, content: source.content };
  const header = captured.content.split(/\r?\n/u).slice(0, 40).join("\n");
  const lines = captured.content.split(/\r?\n/u).map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
  }));
  const impactMatch = captured.content.match(
    /^### 影響ファイル\r?\n\r?\n<details>\r?\n<summary>全ファイルを表示<\/summary>\r?\n([\s\S]*?)\r?\n<\/details>$/mu,
  );
  const impactBody = impactMatch?.[1];
  const impactStart =
    impactMatch && impactBody !== undefined
      ? (impactMatch.index ?? 0) +
        impactMatch[0].indexOf("\n", impactMatch[0].indexOf("</summary>")) +
        1
      : 0;
  const impactLine = captured.content.slice(0, impactStart).split("\n").length;
  const convergenceMatch = captured.content.match(
    /^## 固定前の収束確認\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  );
  const convergenceBody = convergenceMatch?.[1] ?? "";
  const convergenceStart = convergenceMatch
    ? (convergenceMatch.index ?? 0) +
      convergenceMatch[0].length -
      convergenceBody.length
    : 0;
  const convergenceLine = captured.content
    .slice(0, convergenceStart)
    .split("\n").length;
  const result: ChangeDocument = {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    mode: options.mode,
    expectedIdentity: options.expectedIdentity ?? null,
    changeId:
      header.match(
        /^(?:Change ID|変更(?:トレース)?ID|change_id)\s*[:：]\s*`?(CHG-[A-Za-z0-9-]+)/imu,
      )?.[1] || null,
    hasStandardHeading:
      /^#\s*(?:Change Trace(?=$|[:：(（])|変更トレース(?=$|[:：(（]))/imu.test(
        header,
      ),
    lines,
    tableRows: captureDocumentTableRows(captured),
    trigger: captureDocumentSections(captured, "契機 / 起点"),
    intent: captureDocumentSections(captured, "主な変更意図"),
    currentState: captureDocumentSections(captured, "現在状態"),
    structuralChange: captureDocumentSections(captured, "現在状態と構造変更"),
    impacts: captureDocumentSections(captured, "想定する影響"),
    exclusions: captureDocumentSections(
      captured,
      "対象外 / 変更してはならないこと",
    ),
    decisions: captureDocumentSections(captured, "判断 / 承認の参照"),
    verification: captureDocumentSections(captured, "検証"),
    plan: captureDocumentSections(captured, "変更経路の計画"),
    phases: captureDocumentSections(captured, "Phase／Gateと途中拡張"),
    convergence: captureDocumentSections(captured, "固定前の収束確認"),
    impactHeadings: captureMatches(captured, /^### 影響ファイル$/gmu),
    impactBlock:
      impactBody === undefined
        ? null
        : {
            text: impactBody,
            location: { path: captured.path, line: impactLine },
          },
    impactLines: (impactBody ?? "")
      .split(/\r?\n/u)
      .map((text, index) => ({
        text,
        location: { path: captured.path, line: impactLine + index },
      }))
      .filter((entry) => entry.text.trim().length > 0),
    legacyImpactHeadings: captureMatches(captured, /^### 主な反映ファイル$/gmu),
    convergenceRows: convergenceBody
      .split(/\r?\n/u)
      .map((text, index) => ({ text, line: convergenceLine + index }))
      .filter((entry) => /^\| [^|-]/u.test(entry.text))
      .slice(1)
      .map((entry) => ({
        cells: entry.text
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
        location: { path: captured.path, line: entry.line },
      })),
  };
  const issues = validateChangeDocument(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * 変更案内の指定区画を解析し単体の重複を返す。
 * @responsibility 全区画の出現を保持し、最初の区画だけを正式なリンク列へ投影する。
 * @trace ARCH-000008
 * @input source: 取得済みraw案内本文。
 * @returns 出現順と出典を持つモデルと局所重複の問題。
 * @effect N/A: 取得済み値のみ。
 * @failure 解析例外を伝播する。
 * @invariant 区画欠測を空期待集合の不適合に変更せず、外部集合比較を行わない。
 */
export function parseChangeIndex(
  source: ArtifactSource,
): ParseResult<ChangeIndex> & Readonly<{ result: ChangeIndex }> {
  const captured = { path: source.path, content: source.content };
  const matches = [
    ...captured.content.matchAll(
      /<!-- crdd-change-aggregate-index:start -->([\s\S]*?)<!-- crdd-change-aggregate-index:end -->/gu,
    ),
  ];
  const sections = matches.map((match) => ({
    text: match[1] ?? "",
    location: {
      path: captured.path,
      line: captured.content
        .slice(
          0,
          (match.index ?? 0) +
            "<!-- crdd-change-aggregate-index:start -->".length,
        )
        .split("\n").length,
    },
  }));
  const selectedSection = sections[0] ?? null;
  const entries = Array.from(
    (selectedSection?.text ?? "").matchAll(
      /\.\/Changes\/(CHG-[0-9]{6})\/change\.md/gu,
    ),
    (match) => ({
      identity: match[1] as string,
      source: {
        text: match[0],
        location: {
          path: captured.path,
          line:
            (selectedSection?.location.line ?? 1) +
            (selectedSection?.text ?? "").slice(0, match.index).split("\n")
              .length -
            1,
        },
      },
    }),
  );
  const result: ChangeIndex = {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    sections,
    selectedSection,
    entries,
  };
  const issues = validateChangeIndex(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
