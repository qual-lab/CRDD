/**
 * Discoveryの三文書を完成モデルと局所診断へ解析する。
 * @responsibility 原文・内容・出典を捕捉し、文書別検査へ一回接続する。
 * @trace ARCH-000008
 */
import {
  captureDocumentSections,
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import { parseDiagramDisposition } from "../artifact/phase-diagrams.ts";
import type { ArtifactSource, ParseResult } from "../artifact/types.ts";
import type {
  DiscoveryAnalysis,
  DiscoveryChecklistRequest,
  DiscoveryDefinition,
  DiscoveryDocument,
  DiscoveryIndex,
} from "./types.ts";
import {
  inspectDiscoveryChecklist,
  validateDiscoveryAnalysis,
  validateDiscoveryDefinition,
  validateDiscoveryIndex,
} from "./validation.ts";

/**
 * Discovery文書の内容とChecklist検査を一つの受付で完了する。
 * @responsibility 原文・出典・可視Checklistを捕捉し、固有条件を共通構文へ接続する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。request: 明示する種別と方式。
 * @returns 部分内容も保持した文書モデルと元のChecklist失敗理由。
 * @precondition File観測・適用判断は呼出し元が所有する。
 * @postcondition 同じ捕捉本文を評価し、追加read・診断・保存を行わない。
 * @effect N/A: 同期的な局所値処理のみ。
 * @failure 未知kind／modeを拒否し、解析例外は伝播する。
 * @invariant 旧期待列で共通構文エンジンを一回だけ呼び、元の理由を保持する。
 * @boundary 取得済み原文とDiscovery内容モデルの境界。
 * @security 構造成立を要求採用・品質Pass・認可へ読み替えない。
 * @concurrency N/A: 入力・別受付を変更しない。
 */
function captureDiscoveryDocument(
  source: ArtifactSource,
  request: DiscoveryChecklistRequest,
): DiscoveryDocument {
  const captured = { path: source.path, content: source.content };
  const checklistContract = inspectDiscoveryChecklist(
    captured.content,
    request,
  );
  return {
    diagramContract:
      request.mode === "template" && request.kind === "index"
        ? parseDiagramDisposition(
            captured,
            [
              "課題・根拠・機会の関係",
              "業務範囲／入出力（SIPOC）",
              "担い手別の仕事の流れ（Swimlane）",
              "価値が届くまでの流れ",
              "現状／変更後",
              "項目間全体像",
            ],
            [
              "## 人間理解の確認",
              "| 発火判定と理由 |",
              "| 人間の確認または修正 |",
            ].every((text) => captured.content.includes(text))
              ? []
              : ["human-understanding-confirmation"],
          )
        : null,
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    checklist: captureDocumentSections(
      {
        path: captured.path,
        content: omitMarkdownCommentsAndFencedCode(captured.content),
      },
      "Checklist",
    ),
    checklistContract,
  };
}

/**
 * Discovery要求定義の構造とChecklistを検査する。
 * @responsibility 生本文の限定条件を構造・Checklistの順序付き中立Issueへ変換する。
 * @trace ARCH-000008
 * @input source: 取得済み本文と位置。requirementId: 列挙元の期待REQ ID。options.mode: 通常／ひな型。
 * @returns 原文・内容・出典のモデルと、構造・Checklist順の局所診断。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 構造不正でもChecklist検査を継続する。
 * @effect N/A: 既読本文と局所配列だけを扱う同期検査。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 最初のEXP参照・生本文・既存見出しと受理条件を維持する。
 * @boundary N/A: 同一Process内の本文検査。
 * @security EXP実在・状態・参照一意性・意味重複や品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseDiscoveryDefinition(
  source: ArtifactSource,
  requirementId: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<DiscoveryDefinition> &
  Readonly<{ result: DiscoveryDefinition }> {
  const captured = { path: source.path, content: source.content };
  const definition = captured.content;
  const originReferences = [
    ...definition.matchAll(
      /元の探索記録: \[(EXP-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/(EXP-[0-9]{6})\/exploration\.md\)/gu,
    ),
  ].map((match) => ({
    identity: match[1] as string,
    pathIdentity: match[2] as string,
    source: {
      text: match[0],
      location: {
        path: captured.path,
        line: definition.slice(0, match.index).split("\n").length,
      },
    },
  }));
  const result: DiscoveryDefinition = {
    ...captureDiscoveryDocument(captured, {
      kind: "definition",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    expectedIdentity: requirementId,
    requirement: captureDocumentSections(captured, "要求"),
    context: captureDocumentSections(captured, "対象と利用状況"),
    change: captureDocumentSections(captured, "解く問題と望ましい変化"),
    rationale: captureDocumentSections(captured, "採用理由と比較"),
    conditions: captureDocumentSections(captured, "成立条件"),
    risks: [
      ...captureDocumentSections(captured, "失敗・リスク・制約"),
      ...captureDocumentSections(captured, "制約"),
    ].sort((a, b) => a.heading.location.line - b.heading.location.line),
    outOfScope: captureDocumentSections(captured, "対象外"),
    unknown: captureDocumentSections(captured, "未確認事項と戻り条件"),
    verification: captureDocumentSections(captured, "検証意図"),
    handoff: [
      ...captureDocumentSections(captured, "UXへの引き渡し"),
      ...captureDocumentSections(captured, "工程引渡し"),
    ].sort((a, b) => a.heading.location.line - b.heading.location.line),
    relations: captureDocumentSections(captured, "関係"),
    supplement: captureDocumentSections(captured, "補足分析（必要な場合）"),
    checklist: captureDocumentSections(captured, "Checklist"),
    originReferences,
  };
  const issues = validateDiscoveryDefinition(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * Discovery探索分析の構造とChecklistを検査する。
 * @responsibility 成果物種別・期待EXP IDと評価済みChecklistを順序付きIssueへ変換する。
 * @trace ARCH-000008
 * @input source: 既読本文と位置。explorationId: 列挙元の期待EXP ID。options.mode: 通常／ひな型。
 * @returns 原文・内容・出典のモデルと、構造・Checklist順の局所診断。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 構造不正でもChecklistを検査する。
 * @effect N/A: 既読本文と局所配列だけを扱う同期検査。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 構造の生本文判定と可視Checklistの受理条件を維持する。
 * @boundary N/A: 同一Process内の本文検査。
 * @security 参照実在・採用・品質全体の成立を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseDiscoveryAnalysis(
  source: ArtifactSource,
  explorationId: string,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<DiscoveryAnalysis> & Readonly<{ result: DiscoveryAnalysis }> {
  const captured = { path: source.path, content: source.content };
  const result: DiscoveryAnalysis = {
    ...captureDiscoveryDocument(captured, {
      kind: "analysis",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    expectedIdentity: explorationId,
    understanding: captureDocumentSections(
      captured,
      "事前入力の理解確認（発火した場合）",
    ),
    trigger: captureDocumentSections(captured, "きっかけ"),
    problem: captureDocumentSections(captured, "本当の問題は何だったか"),
    hypothesis: captureDocumentSections(captured, "こうすれば解けると考えた"),
    choices: captureDocumentSections(captured, "選んだこと、選ばなかったこと"),
    learning: captureDocumentSections(captured, "後から分かったこと"),
    adoptedRequirements: captureDocumentSections(captured, "採用した要求"),
    handoff: captureDocumentSections(captured, "現在地と次への引き渡し"),
    supplement: captureDocumentSections(captured, "補足分析（必要な場合）"),
    checklist: captureDocumentSections(captured, "Checklist"),
  };
  const issues = validateDiscoveryAnalysis(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * Discovery入口の採用要求行からID集合を解析する。
 * @responsibility 生本文の行条件と最初のREQ IDのSet化を所有する。
 * @trace ARCH-000008
 * @input source: 呼出し元が取得した入口の生本文と相対Path。options.mode: 通常／ひな型。
 * @returns 原文・出典・登録出現・採用要求ID集合と局所診断を分離した結果。
 * @precondition 呼出し元が従来の観測位置で本文を取得している。
 * @postcondition コメント・Fenceを新たに除去せず重複IDをSetへ畳む。
 * @effect N/A: 局所文字列と集合だけを扱う同期解析。
 * @failure 文字列操作の例外を伝播する。
 * @invariant 行頭のREQ形式・要求採用セル・最初のIDだけを認識する。
 * @boundary N/A: 既読本文の解析。
 * @security 要求の採用判断そのものを行わず、実在・品質成立を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseDiscoveryIndex(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" | "evaluated" }> = {},
): ParseResult<DiscoveryIndex> & Readonly<{ result: DiscoveryIndex }> {
  const captured = { path: source.path, content: source.content };
  const entries = captured.content.split(/\r?\n/u).flatMap((text, index) => {
    if (!/^\| (?:`|\[)REQ-[0-9]{6}/u.test(text)) return [];
    const identity = text.match(/REQ-[0-9]{6}/u)?.[0];
    return identity
      ? [
          {
            identity,
            adopted: text.includes("| 要求採用 |"),
            source: {
              text,
              location: { path: captured.path, line: index + 1 },
            },
          },
        ]
      : [];
  });
  const result: DiscoveryIndex = {
    ...captureDiscoveryDocument(captured, {
      kind: "index",
      mode: options.mode === undefined ? "evaluated" : options.mode,
    }),
    entries,
    adoptedRequirementIds: new Set(
      entries.filter((entry) => entry.adopted).map((entry) => entry.identity),
    ),
  };
  const issues = validateDiscoveryIndex(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}
