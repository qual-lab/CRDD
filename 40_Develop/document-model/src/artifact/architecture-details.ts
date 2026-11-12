/**
 * Architecture詳細設計の本文・関係・閉包を検査する。
 * @responsibility 詳細領域の適用判断・Concern・構造・引渡しと多対多関係の意味を所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource, ChecklistFailure } from "./types.ts";
/**
 * 詳細設計Mapの領域と二種類の関係を表す。
 * @responsibility 詳細設計Mapの領域と二種類の関係を表す。
 * @trace ARCH-000008
 * @shape areas、relations、closureRelations、issues。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
export type ArchitectureDetailMapModel = Readonly<{
  areas: ReadonlySet<string>;
  relations: ReadonlySet<string>;
  closureRelations: ReadonlySet<string>;
  issues: readonly DomainIssue[];
}>;
/**
 * 詳細設計本文から得た関係とCovered定義を表す。
 * @responsibility 詳細設計本文から得た関係とCovered定義を表す。
 * @trace ARCH-000008
 * @shape relations、coveredDefinitions、issues。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
export type ArchitectureDetailModel = Readonly<{
  relations: ReadonlySet<string>;
  coveredDefinitions: ReadonlySet<string>;
  issues: readonly DomainIssue[];
}>;
/**
 * 詳細Map・実領域・本文から観測した閉包入力を表す。
 * @responsibility 詳細Map・実領域・本文から観測した閉包入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、registeredDetailAreas、actualDetailAreas、detailMapRelations、detailDocumentRelations、detailMapClosureRelations、actualDefinitions、detailCoveredDefinitions、isArchitectureReady。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
export type ArchitectureDetailCoverageRequest = Readonly<{
  sourcePath: string;
  registeredDetailAreas: ReadonlySet<string>;
  actualDetailAreas: ReadonlySet<string>;
  detailMapRelations: ReadonlySet<string>;
  detailDocumentRelations: ReadonlySet<string>;
  detailMapClosureRelations: ReadonlySet<string>;
  actualDefinitions: ReadonlySet<string>;
  detailCoveredDefinitions: ReadonlySet<string>;
  isArchitectureReady: boolean;
}>;
/**
 * Architectureの指定Sectionを解析する。
 * @responsibility Architectureの指定Sectionを解析する。
 * @trace ARCH-000008
 * @input source: 可視本文。heading: 対象見出し。
 * @returns 最初の一致から次の第二階層見出しまでの本文。
 * @precondition 呼出し元が対象の可視本文を取得している。
 * @postcondition 最初の見出し区画だけを返し、一致しなければ空文字を返す。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 最初の一致と既存見出し境界を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const sectionBody = (source: string, heading: string): string => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    source.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    )?.[1] ?? ""
  );
};
/**
 * 詳細設計Mapの登録表と定義閉包を検査する。
 * @responsibility 領域関係と閉包関係を別々に抽出する。
 * @trace ARCH-000008
 * @input artifact: 可視本文と位置。actualDefinitions: 実在定義集合。
 * @returns 領域・関係の集合と中立Issue。
 * @precondition 呼出し元が既存位置で可視Map本文と実在Architecture定義集合を取得している。
 * @postcondition 入力を変更せず、抽出可能な部分関係と中立Issueを返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、欠落を正常へ補完しない。
 * @invariant 単純なpipe分割・最初の一致・既存の集合化を維持する。
 * @boundary N/A: 取得済みArchitecture文書の意味検査。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureDetailMap(
  artifact: ArtifactSource,
  actualDefinitions: ReadonlySet<string>,
): ArchitectureDetailMapModel {
  const source = artifact.content;
  const registeredDetailAreas = new Set<string>();
  const detailMapRelations = new Set<string>();
  const detailMapClosureRelations = new Set<string>();
  const issues: DomainIssue[] = [];
  const areaSection = sectionBody(source, "## 2. 詳細設計領域");
  const closureSection = sectionBody(source, "## 3. Architecture定義の閉包");
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
  if (
    !areaSection.includes(
      "| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |",
    ) ||
    !closureSection.includes(
      "| Architecture定義 | 基本設計 | 接続する詳細設計領域 |",
    ) ||
    closureIds.size !== actualDefinitions.size ||
    [...actualDefinitions].some((id) => !closureIds.has(id))
  )
    issues.push({
      kind: "artifact.architecture.detail-map-contract-invalid",
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason: "detail-map-contract-invalid",
      details: {},
    });

  return {
    areas: registeredDetailAreas,
    relations: detailMapRelations,
    closureRelations: detailMapClosureRelations,
    issues,
  };
}
/**
 * 詳細設計本文の適用判断・Concern・引渡しを検査する。
 * @responsibility 不正本文でも関係とCovered定義を後続へ渡す。
 * @trace ARCH-000008
 * @input artifact: 一回目の可視本文と位置。area: Directory由来の領域名。isArchitectureReady: 観測済みReady。checklistError: 二回目readから得た既存Checklist理由。
 * @returns 関係・Covered定義と中立Issue。
 * @precondition 呼出し元が既存の順序で本文・集合・Checklist理由を取得している。
 * @postcondition 入力を変更せず、抽出可能な部分関係と中立Issueを返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、欠落を正常へ補完しない。
 * @invariant 先頭表行の省略、行数・判定語彙・Ready時の追加条件を維持する。
 * @boundary N/A: 取得済みArchitecture文書の意味検査。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureDetail(
  artifact: ArtifactSource,
  area: string,
  isArchitectureReady: boolean,
  checklistError: ChecklistFailure | null,
): ArchitectureDetailModel {
  const source = artifact.content;
  const detailDocumentRelations = new Set<string>();
  const detailCoveredDefinitions = new Set<string>();
  const issues: DomainIssue[] = [];
  const relationSection = sectionBody(source, "## 基本設計との関係");
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
  const applicability = sectionBody(source, "## 詳細成果物の適用判断");
  const concerns = sectionBody(source, "## Engineering Concern評価");
  const qualityHandoff = sectionBody(source, "## Qualityへの引渡し");
  const implementationStructure =
    source.match(
      /^## (?:[0-9]+\.\s*)?Implementation Structure\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    )?.[1] ?? "";
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
  const checklistBody = sectionBody(source, "## Checklist");
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
    isArchitectureReady &&
    (relationSection.includes("| Missing |") ||
      concernRows.slice(1).some((line) => /\| (?:OPEN|FAIL) \|/u.test(line)) ||
      hasBlockingChecklistResult);
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
    hasUnresolvedWhenReady ||
    checklistError
  )
    issues.push({
      kind: "artifact.architecture.detail-contract-invalid",
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason: "detail-contract-invalid",
      details: { checklistFailure: checklistError },
    });

  return {
    relations: detailDocumentRelations,
    coveredDefinitions: detailCoveredDefinitions,
    issues,
  };
}
/**
 * 詳細設計の領域・関係・Covered所有者の閉包を検査する。
 * @responsibility 三つの既存集合不整合を順番に返す。
 * @trace ARCH-000008
 * @input request: 観測済みのMap・領域・本文関係集合、Ready状態と診断位置。
 * @returns 領域網羅性、関係閉包、Covered所有者の順の中立Issue。
 * @precondition 呼出し元が領域列挙後の関係集合・Ready状態・診断位置を確定している。
 * @postcondition 入力を変更せず、三種類の集合不整合だけを返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、欠落を正常へ補完しない。
 * @invariant ReadyだけでCovered所有者を要求し、他二条件は全状態で検査する。
 * @boundary N/A: 取得済みArchitecture文書の意味検査。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureDetailCoverage(
  request: ArchitectureDetailCoverageRequest,
): DomainIssue[] {
  const {
    sourcePath,
    registeredDetailAreas,
    actualDetailAreas,
    detailMapRelations,
    detailDocumentRelations,
    detailMapClosureRelations,
    actualDefinitions,
    detailCoveredDefinitions,
    isArchitectureReady,
  } = request;
  const issues: DomainIssue[] = [];
  if (
    registeredDetailAreas.size !== actualDetailAreas.size ||
    [...registeredDetailAreas].some((area) => !actualDetailAreas.has(area)) ||
    [...actualDetailAreas].some((area) => !registeredDetailAreas.has(area))
  )
    issues.push({
      kind: "artifact.architecture.detail-area-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "detail-area-coverage-mismatch",
      details: {},
    });
  if (
    detailMapRelations.size !== detailDocumentRelations.size ||
    [...detailMapRelations].some(
      (relation) => !detailDocumentRelations.has(relation),
    ) ||
    [...detailDocumentRelations].some(
      (relation) => !detailMapRelations.has(relation),
    ) ||
    detailMapRelations.size !== detailMapClosureRelations.size ||
    [...detailMapRelations].some(
      (relation) => !detailMapClosureRelations.has(relation),
    ) ||
    [...detailMapClosureRelations].some(
      (relation) => !detailMapRelations.has(relation),
    ) ||
    [...actualDefinitions].some(
      (id) =>
        ![...detailMapRelations].some((relation) =>
          relation.endsWith(`|${id}`),
        ),
    )
  )
    issues.push({
      kind: "artifact.architecture.detail-relation-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "detail-relation-closure-mismatch",
      details: {},
    });
  if (
    isArchitectureReady &&
    [...actualDefinitions].some((id) => !detailCoveredDefinitions.has(id))
  )
    issues.push({
      kind: "artifact.architecture.detail-covered-owner-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "detail-covered-owner-missing",
      details: {},
    });

  return issues;
}
