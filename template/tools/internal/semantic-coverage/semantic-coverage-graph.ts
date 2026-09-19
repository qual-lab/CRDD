import type {
  LoadedRealitySymbolManifest,
  RealitySymbolFinding,
} from "../reality-traceability/symbol-manifest-model.ts";
import type {
  SemanticIrMeaning,
  SemanticIrPilot,
} from "./semantic-ir-compiler.ts";
import type { QualitySemanticRelation } from "./quality-semantic-relation.ts";

export type SemanticCoverageGraph = Readonly<{
  meaningsByKey: ReadonlyMap<string, SemanticIrMeaning>;
  implementationIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
  qualityLocalIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
  testSymbolIdsByMeaningKey: ReadonlyMap<string, readonly string[]>;
}>;

export type SemanticCoveragePilotProjection = Readonly<{
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

export type SemanticCoveragePilotBundle = Readonly<{
  contract: "crdd/semantic-coverage-pilot-bundle";
  contractRevision: 0;
  stability: "pilot";
  semanticIrs: readonly SemanticIrPilot[];
  coverage: SemanticCoveragePilotProjection;
}>;

export function createSemanticCoveragePilotBundle(
  semanticIrs: readonly SemanticIrPilot[],
  coverage: SemanticCoveragePilotProjection,
): SemanticCoveragePilotBundle {
  return {
    contract: "crdd/semantic-coverage-pilot-bundle",
    contractRevision: 0,
    stability: "pilot",
    semanticIrs: [...semanticIrs].sort((left, right) =>
      left.subsystem.localeCompare(right.subsystem),
    ),
    coverage,
  };
}

function sortMapValues(map: Map<string, string[]>): void {
  for (const [key, values] of map) map.set(key, [...new Set(values)].sort());
}

export function projectSemanticCoveragePilot(
  graph: SemanticCoverageGraph,
): SemanticCoveragePilotProjection {
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

export function createSemanticCoveragePilotGraph(
  semanticIrs: readonly SemanticIrPilot[],
  manifests: readonly LoadedRealitySymbolManifest[],
  qualityRelations: readonly QualitySemanticRelation[],
  prerequisiteFindings: readonly RealitySymbolFinding[],
): Readonly<{
  graph: SemanticCoverageGraph | null;
  findings: readonly RealitySymbolFinding[];
}> {
  if (prerequisiteFindings.length > 0)
    return { graph: null, findings: prerequisiteFindings };

  const findings: RealitySymbolFinding[] = [];
  const meaningsByKey = new Map<string, SemanticIrMeaning>();
  const implementationIdsByMeaningKey = new Map<string, string[]>();
  const qualityLocalIdsByMeaningKey = new Map<string, string[]>();
  const testSymbolIdsByMeaningKey = new Map<string, string[]>();
  for (const ir of semanticIrs)
    for (const meaning of ir.meanings) {
      if (meaningsByKey.has(meaning.semanticKey))
        findings.push({
          code: "semantic-coverage-key-duplicate",
          path: ir.sourceDocument,
          message: `Duplicate Semantic Key: ${meaning.semanticKey}.`,
        });
      else meaningsByKey.set(meaning.semanticKey, meaning);
    }

  for (const loadedManifest of manifests)
    for (const symbol of loadedManifest.manifest.symbols) {
      if (symbol.kind === "test-suite" || symbol.kind === "test-case") continue;
      for (const semanticKey of symbol.implements ?? []) {
        if (!meaningsByKey.has(semanticKey)) {
          findings.push({
            code: "semantic-coverage-key-unknown",
            path: loadedManifest.manifestPath,
            message: `${symbol.symbolId} implements unknown Semantic Key ${semanticKey}.`,
          });
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
      findings.push({
        code: "semantic-coverage-quality-key-unknown",
        path: relation.sourceDocument,
        message: `${relation.qaId}/${relation.localId} verifies unknown Semantic Key ${relation.semanticKey}.`,
      });
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
      findings.push({
        code: "semantic-coverage-quality-relation-missing",
        path: "07_Quality/Definitions",
        message: `${meaning.semanticKey} has no Quality Local Item relation.`,
      });

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
          findings.push({
            code: "semantic-coverage-test-quality-pair-ambiguous",
            path: loadedManifest.manifestPath,
            message: `${symbol.symbolId} cannot uniquely resolve ${localId}; candidates: ${matchingQualifiedLocalIds.join(", ")}.`,
          });
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
    graph:
      findings.length === 0
        ? {
            meaningsByKey,
            implementationIdsByMeaningKey,
            qualityLocalIdsByMeaningKey,
            testSymbolIdsByMeaningKey,
          }
        : null,
    findings,
  };
}
