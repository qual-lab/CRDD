import type {
  LoadedRealitySymbolManifest,
  RealitySymbol,
  RealitySymbolFinding,
} from "./symbol-manifest-model.ts";

export type RealitySymbolNode = Readonly<{
  subsystem: string;
  subsystemRoot: string;
  manifestPath: string;
  symbol: RealitySymbol;
}>;

export type RealitySymbolGraph = Readonly<{
  symbolsById: ReadonlyMap<string, RealitySymbolNode>;
  symbolsByArchId: ReadonlyMap<string, readonly RealitySymbolNode[]>;
  symbolsByQaId: ReadonlyMap<string, readonly RealitySymbolNode[]>;
  testsByImplementationId: ReadonlyMap<string, readonly RealitySymbolNode[]>;
}>;

function appendToIndex(
  index: Map<string, RealitySymbolNode[]>,
  key: string,
  value: RealitySymbolNode,
): void {
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
}

function buildValidatedRealitySymbolGraph(
  loadedManifests: readonly LoadedRealitySymbolManifest[],
  knownArchIds: ReadonlySet<string>,
  knownQaIds: ReadonlySet<string>,
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>,
  registeredTestsByPath: ReadonlyMap<
    string,
    Readonly<{ owner: string; testId: string }>
  >,
): Readonly<{
  graph: RealitySymbolGraph | null;
  findings: readonly RealitySymbolFinding[];
}> {
  const findings: RealitySymbolFinding[] = [];
  const symbolsById = new Map<string, RealitySymbolNode>();
  const symbolsByArchId = new Map<string, RealitySymbolNode[]>();
  const symbolsByQaId = new Map<string, RealitySymbolNode[]>();
  const testsByImplementationId = new Map<string, RealitySymbolNode[]>();
  for (const loadedManifest of loadedManifests)
    for (const symbol of loadedManifest.manifest.symbols) {
      const node = {
        subsystem: loadedManifest.manifest.subsystem,
        subsystemRoot: loadedManifest.subsystemRoot,
        manifestPath: loadedManifest.manifestPath,
        symbol,
      };
      if (symbolsById.has(symbol.symbolId))
        findings.push({
          code: "reality-symbol-id-duplicate",
          path: loadedManifest.manifestPath,
          message: `Duplicate symbolId: ${symbol.symbolId}.`,
        });
      else symbolsById.set(symbol.symbolId, node);
      for (const archId of symbol.archIds) {
        appendToIndex(symbolsByArchId, archId, node);
        if (!knownArchIds.has(archId))
          findings.push({
            code: "reality-symbol-architecture-id-unknown",
            path: loadedManifest.manifestPath,
            message: `Unknown Architecture identity: ${archId}.`,
          });
      }
      for (const qaId of symbol.qaIds) {
        appendToIndex(symbolsByQaId, qaId, node);
        if (!knownQaIds.has(qaId))
          findings.push({
            code: "reality-symbol-quality-id-unknown",
            path: loadedManifest.manifestPath,
            message: `Unknown Quality identity: ${qaId}.`,
          });
      }
      const knownQaIdsForSymbols = symbol.qaIds.filter((qaId) =>
        knownQaIds.has(qaId),
      );
      if (symbol.kind === "test-suite" || symbol.kind === "test-case") {
        const testPath = `40_Develop/${loadedManifest.manifest.subsystem}/${symbol.path}`;
        const registeredTest = registeredTestsByPath.get(testPath);
        if (!registeredTest)
          findings.push({
            code: "reality-symbol-test-catalog-registration-missing",
            path: loadedManifest.manifestPath,
            message: `${symbol.symbolId} is not registered by exact path in the Test Catalog.`,
          });
        else if (registeredTest.owner !== loadedManifest.manifest.subsystem)
          findings.push({
            code: "reality-symbol-test-catalog-owner-mismatch",
            path: loadedManifest.manifestPath,
            message: `${symbol.symbolId} is owned by ${registeredTest.owner} in the Test Catalog, not ${loadedManifest.manifest.subsystem}.`,
          });
      }
      for (const localTestId of symbol.localTestIds) {
        const owners = knownQaIdsForSymbols.filter((qaId) =>
          knownLocalTestIdsByQaId.get(qaId)?.has(localTestId),
        );
        if (knownQaIdsForSymbols.length > 0 && owners.length === 0)
          findings.push({
            code: "reality-symbol-local-test-id-unknown",
            path: loadedManifest.manifestPath,
            message: `${localTestId} is not defined by any Quality identity on ${symbol.symbolId}.`,
          });
      }
    }
  for (const node of symbolsById.values())
    for (const targetId of node.symbol.verifies) {
      const target = symbolsById.get(targetId);
      if (!target) {
        findings.push({
          code: "reality-symbol-verifies-target-missing",
          path: node.manifestPath,
          message: `${node.symbol.symbolId} verifies missing symbol ${targetId}.`,
        });
        continue;
      }
      if (
        target.symbol.kind === "test-suite" ||
        target.symbol.kind === "test-case"
      ) {
        findings.push({
          code: "reality-symbol-verifies-target-invalid",
          path: node.manifestPath,
          message: `${node.symbol.symbolId} must verify an implementation symbol.`,
        });
        continue;
      }
      appendToIndex(testsByImplementationId, targetId, node);
    }
  return {
    graph:
      findings.length === 0
        ? {
            symbolsById,
            symbolsByArchId,
            symbolsByQaId,
            testsByImplementationId,
          }
        : null,
    findings,
  };
}

export function createRealitySymbolGraph(
  loadedManifests: readonly LoadedRealitySymbolManifest[],
  knownArchIds: ReadonlySet<string>,
  knownQaIds: ReadonlySet<string>,
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>,
  registeredTestsByPath: ReadonlyMap<
    string,
    Readonly<{ owner: string; testId: string }>
  > | null,
  prerequisiteFindings: readonly RealitySymbolFinding[],
): Readonly<{
  graph: RealitySymbolGraph | null;
  findings: readonly RealitySymbolFinding[];
}> {
  if (prerequisiteFindings.length > 0 || registeredTestsByPath === null)
    return {
      graph: null,
      findings:
        prerequisiteFindings.length > 0
          ? prerequisiteFindings
          : [
              {
                code: "reality-symbol-graph-input-invalid",
                path: "07_Quality/Registry/test-catalog.json",
                message:
                  "Global Symbol Graph requires one valid Test Catalog snapshot.",
              },
            ],
    };
  return buildValidatedRealitySymbolGraph(
    loadedManifests,
    knownArchIds,
    knownQaIds,
    knownLocalTestIdsByQaId,
    registeredTestsByPath,
  );
}
