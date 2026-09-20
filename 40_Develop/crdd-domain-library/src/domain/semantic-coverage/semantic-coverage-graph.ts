import type { LoadedRealitySymbolManifest } from "../reality-traceability/symbol-manifest-model.ts";
import type { SemanticIrMeaning, SemanticIr } from "./semantic-ir-compiler.ts";
import { semanticDomainIssue } from "./semantic-ir-compiler.ts";
import type { QualitySemanticRelation } from "./quality-semantic-relation.ts";
import type { DomainIssue, DomainOutcome } from "../result/index.ts";

export type SemanticCoverageGraph = Readonly<{
  meaningsByKey: ReadonlyMap<string, SemanticIrMeaning>;
  implementationIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
  qualityLocalIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
  testSymbolIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
}>;

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
    testSymbolIds: readonly string[];
    testObservation: "observed" | "unobserved";
  }>[];
}>;

export type SemanticCoverageBundle = Readonly<{
  contract: "crdd/semantic-coverage-pilot-bundle";
  contractRevision: 0;
  stability: "pilot";
  semanticIrs: readonly SemanticIr[];
  coverage: SemanticCoverageProjection;
}>;

export type SemanticBundleContent = string;

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

function sortMapValues(map: Map<string, string[]>): void {
  for (const [key, values] of map) map.set(key, [...new Set(values)].sort());
}

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
        return {
          semanticKey: meaning.semanticKey,
          archIds: meaning.archIds,
          implementationSymbolIds,
          implementationObservation:
            implementationSymbolIds.length > 0 ? "observed" : "unobserved",
          qualityLocalIds:
            graph.qualityLocalIdsByMeaningKey.get(meaning.semanticKey) ?? [],
          testSymbolIds,
          testObservation: testSymbolIds.length > 0 ? "observed" : "unobserved",
        };
      }),
  };
}

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
  sortMapValues(testSymbolIdsByMeaningKey);

  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result:
      issues.length === 0
        ? {
            meaningsByKey,
            implementationIdsByMeaningKey,
            qualityLocalIdsByMeaningKey,
            testSymbolIdsByMeaningKey,
          }
        : null,
    issues,
  };
}
