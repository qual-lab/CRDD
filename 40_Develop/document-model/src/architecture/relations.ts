/**
 * 取得済みArchitectureモデルと観測済み集合の整合を評価する。
 * @responsibility 定義・入力参照の全出現を保持し、観測済み集合との被覆・閉包・Ready条件を比較する。
 * @trace ARCH-000008
 */

import type { DocumentIssue, ParseResult } from "../artifact/types.ts";
import type {
  ArchitectureRegistryModel,
  ArchitectureDetailMapModel,
  ArchitectureDetailModel,
  ArchitectureAnalysis,
  ArchitectureCrossModel,
  ArchitectureDefinition,
  ArchitectureIndex,
} from "./types.ts";
/**
 * Architecture自身のモデル・登録・取得済み集合を比較する入力。
 * @responsibility 観測済み値の被覆・閉包とReady条件を一つの完成契約として受け付ける。
 * @trace ARCH-000008
 * @invariant 件数・出現・Identity集合の比較を区別し、入力を変更しない。
 * @boundary 同一Process内の取得済みArchitectureモデル。実在の再観測は行わない。
 * @security 認可・Repository全体の完成を保証しない。
 */
export type ArchitectureConsistencyRequest =
  | Readonly<{
      kind: "architecture_cross_model";
      document: ParseResult<ArchitectureCrossModel> &
        Readonly<{ result: ArchitectureCrossModel }>;
      index: ArchitectureIndex;
    }>
  | Readonly<{
      kind: "architecture_detail_map_coverage";
      document: ParseResult<ArchitectureDetailMapModel> &
        Readonly<{ result: ArchitectureDetailMapModel }>;
      actualDefinitions: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "architecture_readiness";
      documentType: "analysis" | "definition" | "detail";
      document: ParseResult<
        ArchitectureAnalysis | ArchitectureDefinition | ArchitectureDetailModel
      > &
        Readonly<{
          result:
            | ArchitectureAnalysis
            | ArchitectureDefinition
            | ArchitectureDetailModel;
        }>;
      isReady: boolean;
    }>
  | Readonly<{
      kind: "architecture_registry_coverage";
      sourcePath: string;
      registry: ArchitectureRegistryModel;
      actualDefinitions: ReadonlySet<string>;
    }>
  | Readonly<{
      kind: "architecture_component_coverage";
      model: ArchitectureCrossModel;
      actualDefinitions: ReadonlySet<string>;
    }>
  | (ArchitectureRelationsRequest &
      Readonly<{ kind: "architecture_relations" }>)
  | (ArchitectureDetailCoverageRequest &
      Readonly<{ kind: "architecture_detail_coverage" }>)
  | Readonly<{
      kind: "architecture_inputs";
      sourcePath: string;
      analysisPath: string;
      analyses: readonly ArchitectureAnalysis[];
      uiIds: ReadonlySet<string>;
      specIds: ReadonlySet<string>;
      actualAnalysisIds: ReadonlySet<string>;
    }>;

/**
 * Architecture内の登録・被覆・閉包・Ready条件を比較する。
 * @responsibility 解析済みIssueと追加の関係Issueを既存の順序で返す。
 * @trace ARCH-000008
 * @input request: 呼出し元が同じ取得位置で確定したモデル・集合・Ready状態。
 * @returns 局所Issueの引継ぎと関係の不整合。実在・品質全体の成立は表さない。
 * @precondition 読取り・取得範囲は呼出し元が所有する。
 * @postcondition 入力を変更せず、追加の読取りを行わない。
 * @effect N/A: 同期的な値比較。
 * @failure 未対応種別は拒否し、入力例外は伝播する。
 * @invariant 件数比較とDirectory Identity比較、重複抑止と短絡順を維持する。
 * @boundary 取得済みArchitectureモデルの意味検査。
 * @security 認可・実在・工程全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function inspectArchitectureConsistency(
  request: ArchitectureConsistencyRequest,
): readonly DocumentIssue[] {
  switch (request.kind) {
    case "architecture_cross_model": {
      const { document, index } = request;
      const issues = [...document.issues];
      if (
        !(index.sections[0]?.text ?? "").includes(
          `](${document.result.file})`,
        ) &&
        !issues.some(
          (issue) =>
            issue.kind === "artifact.architecture.cross-model-contract-invalid",
        )
      )
        issues.push({
          kind: "artifact.architecture.cross-model-contract-invalid",
          targetIdentity: document.result.file,
          location: { path: document.result.source.path },
          reason: "cross-model-contract-invalid",
          details: {},
        });
      return issues;
    }
    case "architecture_detail_map_coverage": {
      const { document, actualDefinitions } = request;
      const ids = document.result.closureIds;
      const issues = [...document.issues];
      if (
        (ids.size !== actualDefinitions.size ||
          [...actualDefinitions].some((id) => !ids.has(id))) &&
        !issues.some(
          (issue) =>
            issue.kind === "artifact.architecture.detail-map-contract-invalid",
        )
      )
        issues.push({
          kind: "artifact.architecture.detail-map-contract-invalid",
          targetIdentity: document.result.source.path,
          location: { path: document.result.source.path },
          reason: "detail-map-contract-invalid",
          details: {},
        });
      return issues;
    }
    case "architecture_readiness": {
      const { document, documentType, isReady } = request;
      const model = document.result;
      const reason = `${documentType}-contract-invalid`;
      const kind = `artifact.architecture.${reason}`;
      const issues = [...document.issues];
      if (
        isReady &&
        model.hasUnresolvedResults &&
        !issues.some((issue) => issue.kind === kind)
      )
        issues.push({
          kind,
          targetIdentity:
            "expectedIdentity" in model
              ? model.expectedIdentity
              : model.source.path,
          location: { path: model.source.path },
          reason,
          details: { checklistFailure: model.checklistContract.failure },
        });
      return issues;
    }
    case "architecture_registry_coverage":
      return inspectArchitectureRegistryCoverage(
        request.sourcePath,
        request.registry,
        request.actualDefinitions,
      );
    case "architecture_component_coverage":
      return inspectArchitectureComponentCoverage(
        request.model,
        request.actualDefinitions,
      );
    case "architecture_relations":
      return inspectArchitectureRelations(request);
    case "architecture_detail_coverage":
      return inspectArchitectureDetailCoverage(request);
    case "architecture_inputs": {
      const {
        sourcePath,
        analysisPath,
        analyses,
        uiIds,
        specIds,
        actualAnalysisIds,
      } = request;
      const analyzedUi = new Set(
        analyses
          .filter((model) => model.view === "UI")
          .map((model) => model.expectedIdentity),
      );
      const analyzedSpec = new Set(
        analyses
          .filter((model) => model.view === "SPEC")
          .map((model) => model.expectedIdentity),
      );
      const issues: DocumentIssue[] = [];
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
    default:
      throw new TypeError("architecture_consistency_kind_invalid");
  }
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
function inspectArchitectureRegistryCoverage(
  sourcePath: string,
  registry: ArchitectureRegistryModel,
  actualDefinitions: ReadonlySet<string>,
): DocumentIssue[] {
  const {
    definitionEntries: registryDefinitionEntries,
    definitions: registryDefinitions,
  } = registry;
  const issues: DocumentIssue[] = [];
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
 * @input model: Component文書の完成モデル。actualDefinitions: 実在定義集合。
 * @returns 捕捉済み参照の出現重複と被覆の不一致を返し、本文を再解析しない。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 専用Section内の全Definition Link出現を重複も含めて照合する。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function inspectArchitectureComponentCoverage(
  model: ArchitectureCrossModel,
  actualDefinitions: ReadonlySet<string>,
): DocumentIssue[] {
  const sourcePath = model.source.path;
  const issues: DocumentIssue[] = [];
  const componentDefinitionEntries = model.componentDefinitionEntries;
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
 * @input request: 分析・定義・登録表のモデルと診断位置。関係集合と出現列は内部で導出する。
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
function inspectArchitectureRelations(
  request: ArchitectureRelationsRequest,
): DocumentIssue[] {
  const { sourcePath, analyses, definitions, registry } = request;
  const analysisRelations = new Set(
    analyses.flatMap((model) => model.relations),
  );
  const definitionRelationEntries = definitions.flatMap(
    (model) => model.relations,
  );
  const definitionRelations = new Set(definitionRelationEntries);
  const {
    relations: registryRelations,
    relationEntries: registryRelationEntries,
  } = registry;
  const issues: DocumentIssue[] = [];
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

/**
 * 詳細設計の領域・関係・Covered所有者の閉包を検査する。
 * @responsibility 三つの既存集合不整合を順番に返す。
 * @trace ARCH-000008
 * @input request: 詳細Map・本文モデル、実在領域・定義集合、Ready状態と診断位置。
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
function inspectArchitectureDetailCoverage(
  request: ArchitectureDetailCoverageRequest,
): DocumentIssue[] {
  const {
    sourcePath,
    map,
    details,
    actualDetailAreas,
    actualDefinitions,
    isArchitectureReady,
  } = request;
  const registeredDetailAreas = new Set([
    ...(map?.areas ?? []),
    ...(map?.retiredAreas ?? []),
  ]);
  const detailMapRelations = map?.relations ?? new Set<string>();
  const detailMapClosureRelations = map?.closureRelations ?? new Set<string>();
  const detailDocumentRelations = new Set(
    details.flatMap((model) => [...model.relations]),
  );
  const detailCoveredDefinitions = new Set(
    details.flatMap((model) => [...model.coveredDefinitions]),
  );
  const issues: DocumentIssue[] = [];
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

/**
 * Architecture分析・定義・登録表の閉包検査入力を表す。
 * @responsibility Architecture分析・定義・登録表の閉包検査入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、analyses、definitions、registry。
 * @invariant 集合と出現配列を区別し、重複を失わない。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
type ArchitectureRelationsRequest = Readonly<{
  sourcePath: string;
  analyses: readonly ArchitectureAnalysis[];
  definitions: readonly ArchitectureDefinition[];
  registry: ArchitectureRegistryModel;
}>;
/**
 * 詳細Map・実領域・本文から観測した閉包入力を表す。
 * @responsibility 詳細Map・実領域・本文から観測した閉包入力を表す。
 * @trace ARCH-000008
 * @shape sourcePath、map、details、actualDetailAreas、actualDefinitions、isArchitectureReady。
 * @invariant 重複に対する既存の集合化と部分関係を保持する。
 * @boundary N/A: 取得済み値の結果モデル。
 * @security Fileの実在・認可・品質成立を保証しない。
 * @compatibility 現行の本文受理条件を維持する。
 */
type ArchitectureDetailCoverageRequest = Readonly<{
  sourcePath: string;
  map: ArchitectureDetailMapModel | null;
  details: readonly ArchitectureDetailModel[];
  actualDetailAreas: ReadonlySet<string>;
  actualDefinitions: ReadonlySet<string>;
  isArchitectureReady: boolean;
}>;
