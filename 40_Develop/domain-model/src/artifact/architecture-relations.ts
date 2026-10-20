/**
 * Architecture登録表と分析・定義・Componentの関係を検査する。
 * @responsibility 出現重複、入力網羅性、三者の関係閉包を所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
/**
 * Architecture登録表の定義・関係と出現列を表す。
 * @responsibility Architecture登録表の定義・関係と出現列を表す。
 * @trace ARCH-000008
 * @shape definitions、definitionEntries、relations、relationEntries。
 * @invariant 集合と出現配列を区別し、重複を失わない。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
export type ArchitectureRegistryModel = Readonly<{
  definitions: ReadonlySet<string>;
  definitionEntries: readonly string[];
  relations: ReadonlySet<string>;
  relationEntries: readonly string[];
}>;
/**
 * Architecture分析の網羅性検査入力を表す。
 * @responsibility Architecture分析の網羅性検査入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、analysisPath、analyzedUi、analyzedSpec、uiIds、specIds、actualAnalysisIds。
 * @invariant UI／SPEC分析の件数照合とDirectoryの完全集合照合を区別する。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
export type ArchitectureAnalysisCoverageRequest = Readonly<{
  sourcePath: string;
  analysisPath: string;
  analyzedUi: ReadonlySet<string>;
  analyzedSpec: ReadonlySet<string>;
  uiIds: ReadonlySet<string>;
  specIds: ReadonlySet<string>;
  actualAnalysisIds: ReadonlySet<string>;
}>;
/**
 * Architecture分析・定義・登録表の閉包検査入力を表す。
 * @responsibility Architecture分析・定義・登録表の閉包検査入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、analysisRelations、definitionRelations、definitionRelationEntries、registryRelations、registryRelationEntries。
 * @invariant 集合と出現配列を区別し、重複を失わない。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
export type ArchitectureRelationsRequest = Readonly<{
  sourcePath: string;
  analysisRelations: ReadonlySet<string>;
  definitionRelations: ReadonlySet<string>;
  definitionRelationEntries: readonly string[];
  registryRelations: ReadonlySet<string>;
  registryRelationEntries: readonly string[];
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
 * Architecture分析の件数とDirectory完全被覆を検査する。
 * @responsibility Architecture分析の件数とDirectory完全被覆を検査する。
 * @trace ARCH-000008
 * @input request: 取得済みUI／SPEC分析集合と二つの診断位置。
 * @returns 件数不一致、Directory被覆不一致の順の中立Issue。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 件数照合をexact集合へ強めず、Directoryだけ双方向一致を要求する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureAnalysisCoverage(
  request: ArchitectureAnalysisCoverageRequest,
): DomainIssue[] {
  const {
    sourcePath,
    analysisPath,
    analyzedUi,
    analyzedSpec,
    uiIds,
    specIds,
    actualAnalysisIds,
  } = request;
  const issues: DomainIssue[] = [];
  if (analyzedUi.size !== uiIds.size || analyzedSpec.size !== specIds.size)
    issues.push({
      kind: "artifact.architecture.analysis-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "analysis-coverage-mismatch",
      details: {},
    });
  const expectedAnalysisIds = new Set([...uiIds, ...specIds]);
  if (
    actualAnalysisIds.size !== expectedAnalysisIds.size ||
    [...actualAnalysisIds].some((id) => !expectedAnalysisIds.has(id)) ||
    [...expectedAnalysisIds].some((id) => !actualAnalysisIds.has(id))
  )
    issues.push({
      kind: "artifact.architecture.analysis-directory-coverage-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "analysis-directory-coverage-mismatch",
      details: {},
    });

  return issues;
}
/**
 * Architecture登録表の定義と入力関係を解析する。
 * @responsibility Architecture登録表の定義と入力関係を解析する。
 * @trace ARCH-000008
 * @input source: 可視登録本文。
 * @returns 集合と出現配列を保持する登録モデル。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 各行の最初の定義Linkに、その行の全UI／SPEC出現を対応付ける。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseArchitectureRegistry(
  source: string,
): ArchitectureRegistryModel {
  const registrySection = sectionBody(source, "## Architecture定義台帳");
  const registryDefinitions = new Set<string>();
  const registryDefinitionEntries: string[] = [];
  const registryRelationEntries: string[] = [];
  for (const line of registrySection.split(/\r?\n/u)) {
    const definition = line.match(
      /\]\(Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/u,
    )?.[1];
    if (!definition) continue;
    registryDefinitionEntries.push(definition);
    registryDefinitions.add(definition);
    for (const input of line.matchAll(/(?:UI|SPEC)-[0-9]{6}/gu))
      registryRelationEntries.push(`${input[0]}|${definition}`);
  }
  const registryRelations = new Set(registryRelationEntries);

  return {
    definitions: registryDefinitions,
    definitionEntries: registryDefinitionEntries,
    relations: registryRelations,
    relationEntries: registryRelationEntries,
  };
}
/**
 * Architecture登録表と実定義の完全被覆を検査する。
 * @responsibility Architecture登録表と実定義の完全被覆を検査する。
 * @trace ARCH-000008
 * @input sourcePath: 診断位置。registry: 解析済み登録表。actualDefinitions: 実定義集合。
 * @returns 登録表の重複・被覆不整合の中立Issue。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 出現重複と両方向の集合差を検査する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureRegistryCoverage(
  sourcePath: string,
  registry: ArchitectureRegistryModel,
  actualDefinitions: ReadonlySet<string>,
): DomainIssue[] {
  const {
    definitionEntries: registryDefinitionEntries,
    definitions: registryDefinitions,
  } = registry;
  const issues: DomainIssue[] = [];
  if (
    registryDefinitionEntries.length !== registryDefinitions.size ||
    registryDefinitions.size !== actualDefinitions.size ||
    [...registryDefinitions].some((id) => !actualDefinitions.has(id)) ||
    [...actualDefinitions].some((id) => !registryDefinitions.has(id))
  )
    issues.push({
      kind: "artifact.architecture.definition-index-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-index-coverage-mismatch",
      details: {},
    });

  return issues;
}
/**
 * Component責務表とArchitecture定義の完全被覆を検査する。
 * @responsibility Component責務表とArchitecture定義の完全被覆を検査する。
 * @trace ARCH-000008
 * @input artifact: 再読取り済み可視Component本文。actualDefinitions: 実定義集合。
 * @returns Component表の重複・被覆不整合の中立Issue。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 専用Section内の全Definition Link出現を重複も含めて照合する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureComponentCoverage(
  artifact: ArtifactSource,
  actualDefinitions: ReadonlySet<string>,
): DomainIssue[] {
  const componentSource = artifact.content,
    sourcePath = artifact.path;
  const issues: DomainIssue[] = [];
  const componentSection = sectionBody(
    componentSource,
    "## 3. Component責務表",
  );
  const componentDefinitionEntries = [
    ...componentSection.matchAll(
      /\]\(Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
    ),
  ].map((match) => match[1] as string);
  const componentDefinitions = new Set(componentDefinitionEntries);
  if (
    componentDefinitionEntries.length !== componentDefinitions.size ||
    componentDefinitions.size !== actualDefinitions.size ||
    [...componentDefinitions].some((id) => !actualDefinitions.has(id)) ||
    [...actualDefinitions].some((id) => !componentDefinitions.has(id))
  )
    issues.push({
      kind: "artifact.architecture.component-definition-coverage-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "component-definition-coverage-mismatch",
      details: {},
    });

  return issues;
}
/**
 * 分析・定義・登録表の重複と関係閉包を検査する。
 * @responsibility 分析・定義・登録表の重複と関係閉包を検査する。
 * @trace ARCH-000008
 * @input request: 三者の関係集合、出現列と診断位置。
 * @returns 重複、分析定義閉包、登録閉包の順の中立Issue。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 重複を集合化で消さず、両方向の関係差を保持する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureRelations(
  request: ArchitectureRelationsRequest,
): DomainIssue[] {
  const {
    sourcePath,
    analysisRelations,
    definitionRelations,
    definitionRelationEntries,
    registryRelations,
    registryRelationEntries,
  } = request;
  const issues: DomainIssue[] = [];
  if (
    registryRelationEntries.length !== registryRelations.size ||
    definitionRelationEntries.length !== definitionRelations.size
  )
    issues.push({
      kind: "artifact.architecture.relation-duplicate",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "relation-duplicate",
      details: {},
    });
  if (
    analysisRelations.size !== definitionRelations.size ||
    [...analysisRelations].some(
      (relation) => !definitionRelations.has(relation),
    ) ||
    [...definitionRelations].some(
      (relation) => !analysisRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.architecture.analysis-definition-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "analysis-definition-closure-mismatch",
      details: {},
    });
  if (
    registryRelations.size !== analysisRelations.size ||
    [...registryRelations].some(
      (relation) => !analysisRelations.has(relation),
    ) ||
    [...analysisRelations].some((relation) => !registryRelations.has(relation))
  )
    issues.push({
      kind: "artifact.architecture.registry-relation-closure-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "registry-relation-closure-mismatch",
      details: {},
    });
  return issues;
}
