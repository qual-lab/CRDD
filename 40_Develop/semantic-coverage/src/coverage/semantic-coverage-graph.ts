/**
 * semantic-coverage-graphに属する責務をまとめる。
 *
 * @responsibility SemanticCoverageGraphを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { LoadedRealitySymbolManifest } from "../../../crdd-domain-library/src/reality-traceability/index.ts";
import type {
  SemanticIr,
  SemanticIrMeaning,
} from "../compilation/semantic-ir-compiler.ts";
import { semanticDomainIssue } from "../compilation/semantic-ir-compiler.ts";
import type { QualitySemanticRelation } from "../compilation/quality-semantic-relation.ts";
import type {
  DomainIssue,
  DomainOutcome,
} from "../../../crdd-domain-library/src/index.ts";

/**
 * Meaningを実装、Quality Local ItemおよびTest Symbolへ接続したGraphを表す。
 *
 * @responsibility Relation Ownerから得た正方向EdgeをMeaning Key単位で保持する。
 * @trace ARCH-000008
 * @shape SemanticCoverageGraphが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticCoverageGraphで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticCoverageGraphの宣言は外部境界を開かない。
 * @security N/A: SemanticCoverageGraphはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticCoverageGraphの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticCoverageGraph = Readonly<{
  meaningsByKey: ReadonlyMap<string, SemanticIrMeaning>;
  implementationIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
  qualityLocalIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
  verificationModesByMeaningKey: ReadonlyMap<
    string,
    readonly ("automated" | "manual")[]
  >;
  testSymbolIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
}>;

/**
 * Semantic Coverage Graphの機械可読な公開Projectionを表す。
 *
 * @responsibility 観測済みと未観測を区別し、逆方向Relationを派生表示する。
 * @trace ARCH-000008
 * @shape SemanticCoverageProjectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticCoverageProjectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticCoverageProjectionの宣言は外部境界を開かない。
 * @security N/A: SemanticCoverageProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticCoverageProjectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticCoverageProjection = Readonly<{
  contract: "crdd/semantic-coverage-pilot";
  contractRevision: 0;
  stability: "pilot";
  meanings: readonly Readonly<{
    semanticKey: string;
    archIds: readonly string[];
    implementationSymbolIds: readonly string[];
    implementationObservation: "observed" | "unobserved";
    qualityLocalIds: readonly string[];
    verificationMode: "automated" | "manual";
    testSymbolIds: readonly string[];
    testObservation: "observed" | "unobserved" | "manual_pending";
  }>[];
}>;

/**
 * Semantic IRとCoverage Projectionを同じ公開単位へ束ねる。
 *
 * @responsibility 同一実行で生成した意味入力とCoverage結果を分離せず搬送する。
 * @trace ARCH-000008
 * @shape SemanticCoverageBundleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticCoverageBundleで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticCoverageBundleの宣言は外部境界を開かない。
 * @security N/A: SemanticCoverageBundleはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticCoverageBundleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticCoverageBundle = Readonly<{
  contract: "crdd/semantic-coverage-pilot-bundle";
  contractRevision: 0;
  stability: "pilot";
  semanticIrs: readonly SemanticIr[];
  coverage: SemanticCoverageProjection;
}>;

/**
 * 原子的公開境界へ渡す直列化済みBundle本文を表す。
 *
 * @responsibility 未直列化Domain値と公開予定byte列を型上で区別する。
 * @trace ARCH-000008
 * @shape SemanticBundleContentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticBundleContentで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticBundleContentの宣言は外部境界を開かない。
 * @security N/A: SemanticBundleContentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticBundleContentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticBundleContent = string;

/**
 * Semantic IR群とCoverage Graphから公開Bundleを生成する。
 *
 * @responsibility Subsystem順を固定し、同じGraphのProjectionを一つのBundleへ格納する。
 * @trace ARCH-000008
 * @input semanticIrs: readonly SemanticIr[]、graph: SemanticCoverageGraph
 * @returns SemanticCoverageBundleを返す。
 * @precondition semanticIrs: readonly SemanticIr[]、graph: SemanticCoverageGraphがcreateSemanticBundleの入力契約を満たす。
 * @postcondition createSemanticBundleの責務を完了した結果だけを返す。
 * @effect N/A: createSemanticBundleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSemanticBundleは独自の失敗分岐を所有しない。
 * @invariant createSemanticBundleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSemanticBundleはProcess内の同一Subsystemで完結する。
 * @security N/A: createSemanticBundleはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createSemanticBundleは共有非同期状態を持たない同期処理である。
 */
export function createSemanticBundle(
  semanticIrs: readonly SemanticIr[],
  graph: SemanticCoverageGraph,
): SemanticCoverageBundle {
  return {
    contract: "crdd/semantic-coverage-pilot-bundle",
    contractRevision: 0,
    stability: "pilot",
    semanticIrs: [...semanticIrs].sort((left, right) =>
      left.subsystem.localeCompare(right.subsystem),
    ),
    coverage: projectSemanticCoverage(graph),
  };
}

/**
 * Relation Mapの各値集合を重複除去した安定順へ正規化する。
 *
 * @responsibility 同じRelation入力から同じProjection順序を得られるようにする。
 * @trace ARCH-000008
 * @input map: Map<string, string[]>
 * @returns N/A: sortMapValuesは戻り値を返さない。
 * @precondition map: Map<string, string[]>がsortMapValuesの入力契約を満たす。
 * @postcondition sortMapValuesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: sortMapValuesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sortMapValuesは独自の失敗分岐を所有しない。
 * @invariant 正規化後の各値集合は重複を持たず昇順である。
 * @boundary N/A: sortMapValuesはProcess内の同一Subsystemで完結する。
 * @security N/A: sortMapValuesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sortMapValuesは共有非同期状態を持たない同期処理である。
 */
function sortMapValues(map: Map<string, string[]>): void {
  for (const [key, values] of map) map.set(key, [...new Set(values)].sort());
}

/**
 * 内部Graphを公開可能なCoverage Projectionへ変換する。
 *
 * @responsibility Meaningごとの実装・Quality・Test観測を欠落状態込みで公開する。
 * @trace ARCH-000008
 * @input graph: SemanticCoverageGraph
 * @returns SemanticCoverageProjectionを返す。
 * @precondition graph: SemanticCoverageGraphがprojectSemanticCoverageの入力契約を満たす。
 * @postcondition projectSemanticCoverageの責務を完了した結果だけを返す。
 * @effect N/A: projectSemanticCoverageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectSemanticCoverageは独自の失敗分岐を所有しない。
 * @invariant projectSemanticCoverageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectSemanticCoverageはProcess内の同一Subsystemで完結する。
 * @security N/A: projectSemanticCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectSemanticCoverageは共有非同期状態を持たない同期処理である。
 */
function projectSemanticCoverage(
  graph: SemanticCoverageGraph,
): SemanticCoverageProjection {
  return {
    contract: "crdd/semantic-coverage-pilot",
    contractRevision: 0,
    stability: "pilot",
    meanings: [...graph.meaningsByKey.values()]
      .sort((left, right) => left.semanticKey.localeCompare(right.semanticKey))
      .map((meaning) => {
        const testSymbolIds =
          graph.testSymbolIdsByMeaningKey.get(meaning.semanticKey) ?? [];
        const implementationSymbolIds =
          graph.implementationIdsByMeaningKey.get(meaning.semanticKey) ?? [];
        const verificationModes =
          graph.verificationModesByMeaningKey.get(meaning.semanticKey) ?? [];
        const verificationMode = verificationModes.includes("automated")
          ? "automated"
          : "manual";
        return {
          semanticKey: meaning.semanticKey,
          archIds: meaning.archIds,
          implementationSymbolIds,
          implementationObservation:
            implementationSymbolIds.length > 0 ? "observed" : "unobserved",
          qualityLocalIds:
            graph.qualityLocalIdsByMeaningKey.get(meaning.semanticKey) ?? [],
          verificationMode,
          testSymbolIds,
          testObservation:
            testSymbolIds.length > 0
              ? "observed"
              : verificationMode === "manual"
                ? "manual_pending"
                : "unobserved",
        };
      }),
  };
}

/**
 * Semantic IR、Symbol ManifestおよびQuality Relationを一つのCoverage Graphへ接続する。
 *
 * @responsibility 未解決、重複、曖昧Relationを検出し完全なGraphだけを返す。
 * @trace ARCH-000008
 * @input semanticIrs: readonly SemanticIr[]、manifests: readonly LoadedRealitySymbolManifest[]、qualityRelations: readonly QualitySemanticRelation[]、prerequisiteIssues: readonly DomainIssue[]
 * @returns DomainOutcome<SemanticCoverageGraph>を返す。
 * @precondition semanticIrs: readonly SemanticIr[]、manifests: readonly LoadedRealitySymbolManifest[]、qualityRelations: readonly QualitySemanticRelation[]、prerequisiteIssues: readonly DomainIssue[]がcreateSemanticCoverageGraphの入力契約を満たす。
 * @postcondition createSemanticCoverageGraphの責務を完了した結果だけを返す。
 * @effect N/A: createSemanticCoverageGraphは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 前提IssueまたはRelation不整合を部分Coverageへ畳まない。
 * @invariant 成功Graphの全Edgeは既知Meaningへ解決する。
 * @boundary N/A: createSemanticCoverageGraphはProcess内の同一Subsystemで完結する。
 * @security N/A: createSemanticCoverageGraphはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createSemanticCoverageGraphは共有非同期状態を持たない同期処理である。
 */
export function createSemanticCoverageGraph(
  semanticIrs: readonly SemanticIr[],
  manifests: readonly LoadedRealitySymbolManifest[],
  qualityRelations: readonly QualitySemanticRelation[],
  prerequisiteIssues: readonly DomainIssue[],
): DomainOutcome<SemanticCoverageGraph> {
  if (prerequisiteIssues.length > 0)
    return { status: "invalid", result: null, issues: prerequisiteIssues };

  const issues: DomainIssue[] = [];
  const meaningsByKey = new Map<string, SemanticIrMeaning>();
  const implementationIdsByMeaningKey = new Map<string, string[]>();
  const qualityLocalIdsByMeaningKey = new Map<string, string[]>();
  const verificationModesByMeaningKey = new Map<
    string,
    ("automated" | "manual")[]
  >();
  const testSymbolIdsByMeaningKey = new Map<string, string[]>();
  for (const ir of semanticIrs)
    for (const meaning of ir.meanings) {
      if (meaningsByKey.has(meaning.semanticKey))
        issues.push(
          semanticDomainIssue(
            "coverage.meaning.key-duplicate",
            ir.sourceDocument,
            "meaning_key_not_unique",
            { semanticKey: meaning.semanticKey },
            meaning.semanticKey,
          ),
        );
      else meaningsByKey.set(meaning.semanticKey, meaning);
    }

  for (const loadedManifest of manifests)
    for (const symbol of loadedManifest.manifest.symbols) {
      if (symbol.kind === "test-suite" || symbol.kind === "test-case") continue;
      for (const semanticKey of symbol.implements ?? []) {
        if (!meaningsByKey.has(semanticKey)) {
          issues.push(
            semanticDomainIssue(
              "coverage.implementation.semantic-key-unresolved",
              loadedManifest.manifestPath,
              "implementation_semantic_key_unresolved",
              { symbolId: symbol.symbolId, semanticKey },
              semanticKey,
            ),
          );
          continue;
        }
        const implementationIds =
          implementationIdsByMeaningKey.get(semanticKey) ?? [];
        implementationIds.push(symbol.symbolId);
        implementationIdsByMeaningKey.set(semanticKey, implementationIds);
      }
    }

  const meaningKeysByQualifiedLocalId = new Map<string, string[]>();
  for (const relation of qualityRelations) {
    if (!meaningsByKey.has(relation.semanticKey)) {
      issues.push(
        semanticDomainIssue(
          "coverage.quality.semantic-key-unresolved",
          relation.sourceDocument,
          "quality_semantic_key_unresolved",
          {
            qaId: relation.qaId,
            localId: relation.localId,
            semanticKey: relation.semanticKey,
          },
          relation.semanticKey,
        ),
      );
      continue;
    }
    const qualifiedLocalId = `${relation.qaId}/${relation.localId}`;
    const qualityIds =
      qualityLocalIdsByMeaningKey.get(relation.semanticKey) ?? [];
    qualityIds.push(qualifiedLocalId);
    qualityLocalIdsByMeaningKey.set(relation.semanticKey, qualityIds);
    const verificationModes =
      verificationModesByMeaningKey.get(relation.semanticKey) ?? [];
    verificationModes.push(relation.executionMode);
    verificationModesByMeaningKey.set(relation.semanticKey, verificationModes);
    const meaningKeys =
      meaningKeysByQualifiedLocalId.get(qualifiedLocalId) ?? [];
    meaningKeys.push(relation.semanticKey);
    meaningKeysByQualifiedLocalId.set(qualifiedLocalId, meaningKeys);
  }

  for (const meaning of meaningsByKey.values())
    if (
      meaning.verification === "required" &&
      !qualityLocalIdsByMeaningKey.has(meaning.semanticKey)
    )
      issues.push(
        semanticDomainIssue(
          "coverage.quality.required-relation-missing",
          "07_Quality/Definitions",
          "required_semantic_key_has_no_quality_relation",
          { semanticKey: meaning.semanticKey },
          meaning.semanticKey,
        ),
      );

  for (const loadedManifest of manifests)
    for (const symbol of loadedManifest.manifest.symbols) {
      if (symbol.kind !== "test-suite" && symbol.kind !== "test-case") continue;
      const verifiedImplementationMeanings = new Set(
        symbol.verifies.flatMap((implementationId) =>
          [...implementationIdsByMeaningKey.entries()]
            .filter(([, ids]) => ids.includes(implementationId))
            .map(([semanticKey]) => semanticKey),
        ),
      );
      for (const localId of symbol.localTestIds) {
        const matchingQualifiedLocalIds = symbol.qaIds
          .map((qaId) => `${qaId}/${localId}`)
          .filter((qualifiedLocalId) =>
            meaningKeysByQualifiedLocalId.has(qualifiedLocalId),
          );
        if (matchingQualifiedLocalIds.length > 1) {
          issues.push(
            semanticDomainIssue(
              "coverage.test.quality-pair-ambiguous",
              loadedManifest.manifestPath,
              "test_quality_pair_not_unique",
              {
                symbolId: symbol.symbolId,
                localId,
                candidates: matchingQualifiedLocalIds.join(", "),
              },
              symbol.symbolId,
            ),
          );
          continue;
        }
        const [qualifiedLocalId] = matchingQualifiedLocalIds;
        if (!qualifiedLocalId) continue;
        for (const semanticKey of meaningKeysByQualifiedLocalId.get(
          qualifiedLocalId,
        ) ?? []) {
          if (!verifiedImplementationMeanings.has(semanticKey)) continue;
          const testIds = testSymbolIdsByMeaningKey.get(semanticKey) ?? [];
          testIds.push(symbol.symbolId);
          testSymbolIdsByMeaningKey.set(semanticKey, testIds);
        }
      }
    }

  sortMapValues(implementationIdsByMeaningKey);
  sortMapValues(qualityLocalIdsByMeaningKey);
  for (const [key, values] of verificationModesByMeaningKey)
    verificationModesByMeaningKey.set(key, [...new Set(values)].sort());
  sortMapValues(testSymbolIdsByMeaningKey);

  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result:
      issues.length === 0
        ? {
            meaningsByKey,
            implementationIdsByMeaningKey,
            qualityLocalIdsByMeaningKey,
            verificationModesByMeaningKey,
            testSymbolIdsByMeaningKey,
          }
        : null,
    issues,
  };
}
