/**
 * Architecture詳細設計の本文・関係・閉包を検査する。
 * @responsibility 詳細領域の適用判断・Concern・構造・引渡しと多対多関係の意味を所有する。
 * @trace ARCH-000008
 */

import {
  captureDocumentSections,
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentIssue,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "../artifact/types.ts";
import {
  type ArchitectureDetailAssignment,
  type ArchitectureDetailTemplate,
  type ArchitectureDocument,
  captureArchitectureDetailAssignment,
  captureArchitectureDetailTemplate,
  captureArchitectureDocument,
} from "./validation.ts";
/**
 * 詳細設計Mapの領域と二種類の関係を表す。
 * @responsibility 詳細設計Mapの領域と二種類の関係を表す。
 * @trace ARCH-000008
 * @shape 原文・出典・台帳節、現行areas、明示登録したretiredAreas、現行の二種類の関係。
 * @invariant 不正・重複・現行との衝突・Map不成立を退役の除外根拠にしない。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行関係を保持し、退役の除外根拠は一意に成立したMapへ限定する。
 */
export type ArchitectureDetailMapModel = Readonly<{
  trace: ArchitectureDetailTrace;
  closureIds: ReadonlySet<string>;
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  areaSections: readonly DocumentSection[];
  closureSections: readonly DocumentSection[];
  areas: ReadonlySet<string>;
  retiredAreas: ReadonlySet<string>;
  relations: ReadonlySet<string>;
  closureRelations: ReadonlySet<string>;
}>;
/**
 * 詳細設計本文から得た関係とCovered定義を表す。
 * @responsibility 詳細設計本文から得た関係とCovered定義を表す。
 * @trace ARCH-000008
 * @shape 原文・出典・適用判断・Concern・構造・引渡しとrelations、coveredDefinitions。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
export type ArchitectureDetailModel = Readonly<{
  assignment: ArchitectureDetailAssignment<"area">;
  checklistSource: ArtifactSource;
  checklistContract: ArchitectureDocument["checklistContract"];
  hasUnresolvedResults: boolean;
  templateContract: ArchitectureDetailTemplate | null;

  artifact: ArtifactModel;
  source: ArtifactSource;
  area: string;
  tableRows: readonly DocumentTableRow[];
  relationSections: readonly DocumentSection[];
  applicabilitySections: readonly DocumentSection[];
  concernSections: readonly DocumentSection[];
  qualityHandoffSections: readonly DocumentSection[];
  qualityHandoff: Readonly<{
    sections: readonly DocumentText[];
    rows: readonly DocumentTableRow[];
    units: ReadonlySet<string>;
    levels: ReadonlyMap<string, ReadonlySet<string>>;
    boundaryStages: ReadonlyMap<string, string>;
  }>;
  checklistSections: readonly DocumentSection[];
  implementationStructure: DocumentText | null;
  semantic: Readonly<{
    heading: DocumentText | null;
    header: DocumentTableRow | null;
    separator: DocumentTableRow | null;
    rows: readonly DocumentTableRow[];
    sourceLines: readonly DocumentText[];
  }>;
  relations: ReadonlySet<string>;
  coveredDefinitions: ReadonlySet<string>;
}>;

/**
 * 詳細設計Mapの登録表と定義閉包を検査する。
 * @responsibility 領域関係と閉包関係を別々に抽出する。
 * @trace ARCH-000008
 * @input artifact: 取得済み原文と位置。
 * @returns 現行／非現行の登録領域・定義参照・担当追跡と診断。実在集合との照合は横断比較が所有する。
 * @precondition File取得と外部集合・Ready宣言の適用判断は呼出し元が所有する。
 * @postcondition 入力を変更せず、抽出可能な部分関係と中立Issueを返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、欠落を正常へ補完しない。
 * @invariant 単純なpipe分割・最初の一致・既存の集合化を維持する。
 * @boundary N/A: 取得済みArchitecture文書の意味検査。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseArchitectureDetailMap(
  artifact: ArtifactSource,
): ParseResult<ArchitectureDetailMapModel> &
  Readonly<{ result: ArchitectureDetailMapModel }> {
  const captured = { path: artifact.path, content: artifact.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const areaSections = captureDocumentSections(visible, "2. 詳細設計領域");
  const closureSections = captureDocumentSections(
    visible,
    "3. Architecture定義の閉包",
  );
  const registeredDetailAreas = new Set<string>();
  const retiredAreaEntries: string[] = [];
  let hasInvalidRetiredArea = false;
  const retiredSections = captureDocumentSections(
    visible,
    "5. 非現行の設計資料",
  );
  for (const line of (retiredSections[0]?.body.text ?? "").split(/\r?\n/u)) {
    const area = line.match(
      /\]\(Details\/([a-z0-9-]+)\/01_Architecture\.md\)/u,
    )?.[1];
    if (!area) continue;
    const cells = parseMarkdownTableRow(line);
    retiredAreaEntries.push(area);
    if (
      cells?.length !== 4 ||
      cells[0] !== `[${area}](Details/${area}/01_Architecture.md)` ||
      !cells[1] ||
      !["Retired", "Historical Comparison"].includes(cells[2] ?? "") ||
      !cells[3]
    )
      hasInvalidRetiredArea = true;
  }
  const detailMapRelations = new Set<string>();
  const detailMapClosureRelations = new Set<string>();
  const issues: DocumentIssue[] = [];
  const areaSection = areaSections[0]?.body.text ?? "";
  const closureSection = closureSections[0]?.body.text ?? "";
  for (const line of areaSection.split(/\r?\n/u)) {
    const area = line.match(
      /\]\(Details\/([a-z0-9-]+)\/01_Architecture\.md\)/u,
    )?.[1];
    if (!area) continue;
    registeredDetailAreas.add(area);
    for (const id of line.matchAll(/ARCH-[0-9]{6}/gu))
      detailMapRelations.add(`${area}|${id[0]}`);
  }
  const closureIds = new Set(
    [...closureSection.matchAll(/\| (ARCH-[0-9]{6}) \|/gu)].map(
      (match) => match[1] as string,
    ),
  );
  for (const line of closureSection.split(/\r?\n/u)) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const id = cells[0]?.match(/^ARCH-[0-9]{6}$/u)?.[0];
    if (!id || !cells[2]) continue;
    for (const area of cells[2].split("、").map((item) => item.trim()))
      if (/^[a-z0-9-]+$/u.test(area))
        detailMapClosureRelations.add(`${area}|${id}`);
  }
  const retiredAreas = new Set(retiredAreaEntries);
  if (
    retiredSections.length > 1 ||
    (retiredAreaEntries.length > 0 &&
      !(retiredSections[0]?.body.text ?? "").includes(
        "| 資料領域 | 現在Owner | 区分 | 理由 |",
      )) ||
    retiredAreas.size !== retiredAreaEntries.length ||
    [...retiredAreas].some((area) => registeredDetailAreas.has(area))
  )
    hasInvalidRetiredArea = true;
  if (hasInvalidRetiredArea) retiredAreas.clear();
  if (
    hasInvalidRetiredArea ||
    areaSections.length !== 1 ||
    closureSections.length !== 1 ||
    !areaSection.includes(
      "| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |",
    ) ||
    !closureSection.includes(
      "| Architecture定義 | 基本設計 | 接続する詳細設計領域 |",
    )
  )
    issues.push({
      kind: "artifact.architecture.detail-map-contract-invalid",
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason: "detail-map-contract-invalid",
      details: {},
    });

  if (issues.length) retiredAreas.clear();
  return {
    status: issues.length ? "partial" : "complete",
    result: {
      trace: captureArchitectureDetailTrace(captured),
      closureIds,
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      tableRows: captureDocumentTableRows(visible),
      areaSections,
      closureSections,
      areas: registeredDetailAreas,
      retiredAreas,
      relations: detailMapRelations,
      closureRelations: detailMapClosureRelations,
    },
    issues,
  };
}
/**
 * 詳細設計本文の適用判断・Concern・引渡しを検査する。
 * @responsibility 不正本文でも関係とCovered定義を後続へ渡す。
 * @trace ARCH-000008
 * @input artifact: 初回の原文と位置。area: 列挙元領域名。options: 方式と別取得のChecklist原文。
 * @returns 領域本文・担当宣言・引渡しと局所診断。Ready比較はSemanticが所有する。
 * @precondition File取得と外部集合・Ready宣言の適用判断は呼出し元が所有する。
 * @postcondition 入力を変更せず、抽出可能な部分関係と中立Issueを返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、欠落を正常へ補完しない。
 * @invariant 先頭表行の省略、行数・判定語彙・Ready時の追加条件を維持する。
 * @boundary N/A: 取得済みArchitecture文書の意味検査。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseArchitectureDetail(
  artifact: ArtifactSource,
  area: string,
  options: Readonly<{
    mode?: "template" | "evaluated";
    checklistSource?: ArtifactSource;
  }> = {},
): ParseResult<ArchitectureDetailModel> &
  Readonly<{ result: ArchitectureDetailModel }> {
  const captured = { path: artifact.path, content: artifact.content };
  const mode = options.mode === undefined ? "evaluated" : options.mode;
  const checklistDocument = captureArchitectureDocument(
    options.checklistSource === undefined ? captured : options.checklistSource,
    { kind: mode === "template" ? "detail_template" : "detail", mode },
  );
  const checklistError = checklistDocument.checklistContract.failure;
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const source = visible.content;
  const semanticLines = captured.content.split(/\r?\n/u).map((text, index) => ({
    text,
    location: { path: captured.path, line: index + 1 },
    cells: text
      .trim()
      .replace(/^\|/u, "")
      .replace(/\|$/u, "")
      .split("|")
      .map((cell) => cell.trim()),
  }));
  const semanticHeading = semanticLines.findIndex((line) =>
    /^#{2,3}\s+.*機械生成する意味要素\s*$/u.test(line.text),
  );
  const semanticTableStart =
    semanticHeading < 0
      ? -1
      : semanticLines.findIndex(
          (line, index) =>
            index > semanticHeading && line.text.trim().startsWith("|"),
        );
  const semanticRows: DocumentTableRow[] = [];
  if (semanticTableStart >= 0)
    for (const line of semanticLines.slice(semanticTableStart + 2)) {
      if (!line.text.trim().startsWith("|")) break;
      semanticRows.push({ cells: line.cells, location: line.location });
    }
  const semantic = {
    heading:
      semanticHeading < 0 ? null : (semanticLines[semanticHeading] ?? null),
    header:
      semanticTableStart < 0
        ? null
        : (semanticLines[semanticTableStart] ?? null),
    separator:
      semanticTableStart < 0
        ? null
        : (semanticLines[semanticTableStart + 1] ?? null),
    rows: semanticRows,
    sourceLines: semanticLines,
  };
  const relationSections = captureDocumentSections(visible, "基本設計との関係");
  const applicabilitySections = captureDocumentSections(
    visible,
    "詳細成果物の適用判断",
  );
  const concernSections = captureDocumentSections(
    visible,
    "Engineering Concern評価",
  );
  const qualityHandoffSections = captureDocumentSections(
    visible,
    "Qualityへの引渡し",
  );
  const checklistSections = captureDocumentSections(visible, "Checklist");
  const detailDocumentRelations = new Set<string>();
  const detailCoveredDefinitions = new Set<string>();
  const issues: DocumentIssue[] = [];
  const relationSection = relationSections[0]?.body.text ?? "";
  let areaRelationCount = 0;
  let hasInvalidRelation = false;
  const areaRelationIds = new Set<string>();
  for (const match of relationSection.matchAll(
    /\]\(\.\.\/\.\.\/Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
  )) {
    detailDocumentRelations.add(`${area}|${match[1] as string}`);
    areaRelationCount += 1;
    if (areaRelationIds.has(match[1] as string)) hasInvalidRelation = true;
    areaRelationIds.add(match[1] as string);
  }
  for (const line of relationSection.split(/\r?\n/u)) {
    if (!/^\| \[ARCH-[0-9]{6}\]/u.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (
      cells.length !== 3 ||
      !cells[1] ||
      !["Covered", "Partial", "Missing"].includes(cells[2] ?? "")
    )
      hasInvalidRelation = true;
    const relationId = cells[0]?.match(/ARCH-[0-9]{6}/u)?.[0];
    if (relationId && cells[2] === "Covered")
      detailCoveredDefinitions.add(relationId);
  }
  const applicability = applicabilitySections[0]?.body.text ?? "";
  const concerns = concernSections[0]?.body.text ?? "";
  const qualityHandoff = qualityHandoffSections[0]?.body.text ?? "";
  const implementationMatch = source.match(
    /^## (?:[0-9]+\.\s*)?Implementation Structure\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  );
  const implementationContent: DocumentText | null = implementationMatch
    ? {
        text: implementationMatch[1] ?? "",
        location: {
          path: captured.path,
          line: source
            .slice(
              0,
              (implementationMatch.index ?? 0) +
                implementationMatch[0].length -
                (implementationMatch[1]?.length ?? 0),
            )
            .split("\n").length,
        },
      }
    : null;
  const implementationStructure = implementationContent?.text ?? "";
  const applicabilityRows = applicability
    .split(/\r?\n/u)
    .filter((line) => /^\| [^|-]/u.test(line));
  const concernRows = concerns
    .split(/\r?\n/u)
    .filter((line) => /^\| [^|-]/u.test(line));
  const expectedApplicability = new Set([
    "Component Model",
    "Interface Model",
    "Data Flow",
    "State Model",
    "Sequence",
    "Failure／Recovery",
    "Deployment",
    "Observability",
    "Security Boundary",
    "Implementation Structure",
  ]);
  const expectedConcerns = new Set([
    "Concurrency",
    "Timing",
    "Resource Lifecycle",
    "External Boundary",
    "State／Consistency",
    "Failure／Recovery",
    "Observability",
    "Security／Trust",
  ]);
  const applicabilityNames = applicabilityRows
    .slice(1)
    .map((line) => line.split("|").slice(1, -1)[0]?.trim() ?? "");
  const concernNames = concernRows
    .slice(1)
    .map((line) => line.split("|").slice(1, -1)[0]?.trim() ?? "");
  const implementationStructureRows = implementationStructure
    .split(/\r?\n/u)
    .filter((line) => /^\| [^|-]/u.test(line));
  const expectedImplementationStructure = new Set([
    "Variation",
    "Common Contract",
    "Creation／Selection",
    "State-dependent Behavior",
    "Composition／Recursion",
    "Lifecycle Ownership",
    "External Boundary",
  ]);
  const implementationStructureNames = implementationStructureRows
    .slice(1)
    .map((line) => line.split("|").slice(1, -1)[0]?.trim() ?? "");
  const hasInvalidApplicability = applicabilityRows.slice(1).some((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    return (
      cells.length !== 4 ||
      !["Required", "N/A"].includes(cells[1] ?? "") ||
      !cells[2] ||
      !cells[3] ||
      (cells[1] === "Required" && !/\]\([^)]*(?:\.md)?#[^)]+\)/u.test(cells[3]))
    );
  });
  const hasInvalidConcern = concernRows.slice(1).some((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    return (
      cells.length !== 4 ||
      !["PASS", "N/A", "OPEN", "FAIL"].includes(cells[1] ?? "") ||
      !cells[2] ||
      !cells[3] ||
      !/\[[^\]]+\]\([^)]*(?:\.md)?#[^)]+\)/u.test(cells[3])
    );
  });
  const hasInvalidImplementationStructure =
    !implementationStructure.includes(
      "| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |",
    ) ||
    implementationStructureRows.slice(1).some((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return (
        cells.length !== 7 ||
        !["Required", "N/A", "OPEN"].includes(cells[1] ?? "") ||
        cells.slice(2).some((cell) => !cell)
      );
    });
  const hasResultSemantics = [
    "`PASS`: 詳細設計上",
    "`N/A`: Architecture上、そのConcern自体が存在しない",
    "`OPEN`: 未解決の設計事項",
    "`FAIL`: 必須設計と矛盾",
  ].every((meaning) => concerns.includes(meaning));
  const checklistBody = checklistSections[0]?.body.text ?? "";
  const hasBlockingChecklistResult = /^- (?:OPEN|FAIL): /mu.test(checklistBody);
  const expectedHandoffHeader =
    "| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |";
  const expectedHandoffCellCount = 10;
  const hasInvalidQualityHandoff =
    !qualityHandoff.includes(expectedHandoffHeader) ||
    !qualityHandoff
      .split(/\r?\n/u)
      .filter((line) => /^\| [^|-]/u.test(line))
      .slice(1)
      .some((line) => {
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        return (
          cells.length === expectedHandoffCellCount && cells.every(Boolean)
        );
      });
  const hasIncompleteApplicability =
    applicabilityNames.length !== expectedApplicability.size ||
    new Set(applicabilityNames).size !== expectedApplicability.size ||
    [...expectedApplicability].some(
      (name) => !applicabilityNames.includes(name),
    );
  const hasIncompleteConcerns =
    concernNames.length !== expectedConcerns.size ||
    new Set(concernNames).size !== expectedConcerns.size ||
    [...expectedConcerns].some((name) => !concernNames.includes(name));
  const hasIncompleteImplementationStructure =
    implementationStructureNames.length !==
      expectedImplementationStructure.size ||
    new Set(implementationStructureNames).size !==
      expectedImplementationStructure.size ||
    [...expectedImplementationStructure].some(
      (name) => !implementationStructureNames.includes(name),
    );
  const hasUnresolvedWhenReady =
    relationSection.includes("| Missing |") ||
    concernRows.slice(1).some((line) => /\| (?:OPEN|FAIL) \|/u.test(line)) ||
    hasBlockingChecklistResult;
  if (
    !source.includes("成果物種別: Architecture詳細設計") ||
    !source.includes(`詳細設計領域: ${area}`) ||
    !source.includes("## Qualityへの引渡し") ||
    !source.includes("## 現行実装との照合") ||
    !applicability.includes("| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |") ||
    !concerns.includes(
      "| Concern | Result | Rationale | Evidence／Related ID |",
    ) ||
    areaRelationCount === 0 ||
    hasInvalidRelation ||
    hasIncompleteApplicability ||
    hasIncompleteConcerns ||
    hasIncompleteImplementationStructure ||
    hasInvalidApplicability ||
    hasInvalidConcern ||
    hasInvalidImplementationStructure ||
    !hasResultSemantics ||
    hasInvalidQualityHandoff ||
    checklistError
  )
    issues.push({
      kind: "artifact.architecture.detail-contract-invalid",
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason: "detail-contract-invalid",
      details: { checklistFailure: checklistError },
    });

  const templateContract =
    mode === "template"
      ? captureArchitectureDetailTemplate(captured, "area")
      : null;
  const finalIssues =
    mode === "template"
      ? [
          ...(templateContract?.issues ?? []),
          ...(checklistError
            ? [
                {
                  kind: "artifact.architecture.detail-contract-invalid",
                  targetIdentity: artifact.path,
                  location: { path: artifact.path },
                  reason: "detail-contract-invalid",
                  details: { checklistFailure: checklistError },
                },
              ]
            : []),
        ]
      : issues;
  return {
    status: finalIssues.length ? "partial" : "complete",
    result: {
      assignment: captureArchitectureDetailAssignment(captured, area, "area"),
      templateContract: templateContract?.result ?? null,
      checklistSource: checklistDocument.source,
      checklistContract: checklistDocument.checklistContract,
      hasUnresolvedResults: hasUnresolvedWhenReady,
      artifact: parseMarkdownArtifact(captured),
      source: captured,
      area,
      tableRows: captureDocumentTableRows(visible),
      relationSections,
      applicabilitySections,
      concernSections,
      qualityHandoffSections,
      qualityHandoff: captureArchitectureQualityHandoff(captured, area),
      checklistSections,
      implementationStructure: implementationContent,
      semantic,
      relations: detailDocumentRelations,
      coveredDefinitions: detailCoveredDefinitions,
    },
    issues: finalIssues,
  };
}

/**
 * Architecture中央対応表の担当・発行済みIDを保持する。
 * @responsibility 全可視本文のIDと、採用行数・重複・後勝ちの対応を分ける。
 * @trace ARCH-000008
 * @shape artifact、source、tableRows、relations、relationRows、ID集合、重複。
 * @invariant 原文・出典・出現を保持し、担当宣言を実在・認可・品質成立にしない。
 */
export type ArchitectureDetailTrace = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  screens: ReadonlySet<string>;
  parts: ReadonlySet<string>;
  behaviors: ReadonlySet<string>;
  relationRows: number;
  hasDuplicateRelations: boolean;
  relations: ReadonlyMap<
    string,
    Readonly<{
      bhv: string;
      owners: ReadonlySet<string>;
      mode: string;
      areas: ReadonlySet<string>;
    }>
  >;
}>;
/**
 * Architecture中央対応表を出典付きモデルへ構築する。
 * @responsibility 可視本文の既存文法と部分情報を原文・出典へ結合する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。期待Identityや種別は列挙元が確定する。
 * @returns 担当内容のモデル。入力を変更せず欠測を補完しない。
 * @effect N/A: 同一Processの純粋な値構築。Reader・診断・保存を追加しない。
 */
function captureArchitectureDetailTrace(
  source: ArtifactSource,
): ArchitectureDetailTrace {
  const captured = { path: source.path, content: source.content };
  const content = omitMarkdownCommentsAndFencedCode(captured.content);
  const artifact = parseMarkdownArtifact(captured);
  const tableRows = captureDocumentTableRows({ path: captured.path, content });
  const screens = new Set(
    [...content.matchAll(/SCR-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const parts = new Set(
    [...content.matchAll(/PRT-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const behaviors = new Set(
    [...content.matchAll(/BHV-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const architectureCentralRelations = new Map<
    string,
    Readonly<{
      bhv: string;
      owners: Set<string>;
      mode: string;
      areas: Set<string>;
    }>
  >();
  let architectureCentralRelationRows = 0;
  let hasDuplicateCentralRelation = false;
  for (const line of content.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    const relationKey = cells?.[0]?.match(/PRT-[0-9]{6}\.spec-[0-9]{6}/u)?.[0];
    const bhv = cells?.[1]?.match(/BHV-[0-9]{6}/u)?.[0];
    if (!cells || !relationKey || !bhv || cells.length !== 6) continue;
    architectureCentralRelationRows += 1;
    const ownerRows = [...(cells[2] as string).matchAll(/ARCH-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    const areaRows = (cells[4] as string)
      .split("、")
      .map((item) => item.trim());
    if (
      architectureCentralRelations.has(relationKey) ||
      ownerRows.length !== new Set(ownerRows).size ||
      areaRows.length !== new Set(areaRows).size
    )
      hasDuplicateCentralRelation = true;
    architectureCentralRelations.set(relationKey, {
      bhv,
      owners: new Set(ownerRows),
      mode: cells[3] as string,
      areas: new Set(areaRows),
    });
  }
  return {
    artifact,
    source: captured,
    tableRows,
    screens,
    parts,
    behaviors,
    relations: architectureCentralRelations,
    relationRows: architectureCentralRelationRows,
    hasDuplicateRelations: hasDuplicateCentralRelation,
  };
}

/**
 * Architecture DetailのQuality引渡しの明示内容・出典と検証単位・段階・境界を捕捉する。
 * @responsibility Architecture DetailのQuality引渡しの明示内容・出典と検証単位・段階・境界を捕捉する。
 * @trace ARCH-000008
 * @input source: 取得済みArchitecture Detail原文とPath。detailSlug: 領域名。
 * @returns 検証単位集合と段階・境界の後勝ちMap。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。Issueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function captureArchitectureQualityHandoff(
  source: ArtifactSource,
  detailSlug: string,
): ArchitectureDetailModel["qualityHandoff"] {
  const content = source.content;
  const sections = [
    ...content.matchAll(
      /(?=(^## Qualityへの引(?:渡し|き渡し)\s*$([\s\S]*?)(?=^##\s)))/gmu,
    ),
  ].map((match) => {
    const text = match[2] ?? "";
    const offset = (match.index ?? 0) + (match[1]?.length ?? 0) - text.length;
    return {
      text,
      location: {
        path: source.path,
        line: content.slice(0, offset).split("\n").length,
      },
    };
  });
  const rows: DocumentTableRow[] = [];
  const physicalDetailUnits = new Set<string>();
  const physicalDetailUnitLevels = new Map<string, Set<string>>();
  const physicalDetailUnitBoundaryStages = new Map<string, string>();
  const handoffSection = sections[0];
  for (const [index, line] of (handoffSection?.text ?? "")
    .split(/\r?\n/u)
    .entries()) {
    if (!/^\|/u.test(line)) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    rows.push({
      cells,
      location: {
        path: source.path,
        line: (handoffSection?.location.line ?? 1) + index,
      },
    });
    const unit = cells[0];
    if (
      !unit ||
      unit === "検証単位" ||
      unit === "導出キー" ||
      /^---/u.test(unit)
    )
      continue;
    const unitKey = `${detailSlug}|${unit}`;
    physicalDetailUnits.add(unitKey);
    physicalDetailUnitLevels.set(
      unitKey,
      new Set(
        Array.from(
          cells[5]?.matchAll(/UT|IT|ST|UAT/gu) ?? [],
          (match) => match[0],
        ),
      ),
    );
    const declaredBoundaryCell = cells[6] ?? "";
    const declaredBoundaryStages = [
      "N/A",
      "Direct Boundary",
      "Adjacent 1 Block",
      "Related 2 Blocks",
      "System/E2E",
      "User Acceptance",
    ].filter((stage) => declaredBoundaryCell.includes(stage));
    physicalDetailUnitBoundaryStages.set(
      unitKey,
      declaredBoundaryStages.at(-1) ?? "",
    );
  }

  return {
    sections,
    rows,
    units: physicalDetailUnits,
    levels: physicalDetailUnitLevels,
    boundaryStages: physicalDetailUnitBoundaryStages,
  };
}
