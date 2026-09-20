import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import {
  createRealityDomainIssue,
  invalidDomainLocationIssue,
  isSafeDomainLocation,
} from "./domain-issue.ts";
import type {
  LoadedRealitySymbolManifest,
  RealitySymbol,
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

export function createRealitySymbolGraph(
  loadedManifests: readonly LoadedRealitySymbolManifest[],
  knownArchIds: ReadonlySet<string>,
  knownQaIds: ReadonlySet<string>,
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>,
  registeredTestsByPath: ReadonlyMap<
    string,
    Readonly<{ owner: string; testId: string }>
  > | null,
  prerequisiteIssues: readonly DomainIssue[],
): DomainOutcome<RealitySymbolGraph> {
  if (
    loadedManifests.some(
      (loadedManifest) => !isSafeDomainLocation(loadedManifest.manifestPath),
    )
  )
    return {
      status: "invalid",
      result: null,
      issues: [invalidDomainLocationIssue()],
    };
  if (prerequisiteIssues.length > 0)
    return {
      status: "invalid",
      result: null,
      issues: prerequisiteIssues,
    };
  if (registeredTestsByPath === null)
    return {
      status: "invalid",
      result: null,
      issues: [
        createRealityDomainIssue(
          "graph.input.snapshot-unavailable",
          "07_Quality/Registry/test-catalog.json",
          "test-catalog",
          "test_catalog_snapshot_required",
          {},
        ),
      ],
    };

  const issues: DomainIssue[] = [];
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
        issues.push(
          createRealityDomainIssue(
            "graph.symbol.identity-duplicate",
            loadedManifest.manifestPath,
            symbol.symbolId,
            "symbol_identity_not_unique",
            { symbolId: symbol.symbolId },
          ),
        );
      else symbolsById.set(symbol.symbolId, node);

      for (const archId of symbol.archIds) {
        appendToIndex(symbolsByArchId, archId, node);
        if (!knownArchIds.has(archId))
          issues.push(
            createRealityDomainIssue(
              "graph.architecture.identity-unresolved",
              loadedManifest.manifestPath,
              archId,
              "architecture_identity_unresolved",
              { identity: archId },
            ),
          );
      }
      for (const qaId of symbol.qaIds) {
        appendToIndex(symbolsByQaId, qaId, node);
        if (!knownQaIds.has(qaId))
          issues.push(
            createRealityDomainIssue(
              "graph.quality.identity-unresolved",
              loadedManifest.manifestPath,
              qaId,
              "quality_identity_unresolved",
              { identity: qaId },
            ),
          );
      }

      const knownQaIdsForSymbols = symbol.qaIds.filter((qaId) =>
        knownQaIds.has(qaId),
      );
      if (symbol.kind === "test-suite" || symbol.kind === "test-case") {
        const testPath = `40_Develop/${loadedManifest.manifest.subsystem}/${symbol.path}`;
        const registeredTest = registeredTestsByPath.get(testPath);
        if (!registeredTest)
          issues.push(
            createRealityDomainIssue(
              "graph.test.catalog-registration-missing",
              loadedManifest.manifestPath,
              symbol.symbolId,
              "test_catalog_registration_missing",
              { symbolId: symbol.symbolId },
            ),
          );
        else if (registeredTest.owner !== loadedManifest.manifest.subsystem)
          issues.push(
            createRealityDomainIssue(
              "graph.test.catalog-owner-mismatch",
              loadedManifest.manifestPath,
              symbol.symbolId,
              "test_catalog_owner_mismatch",
              {
                symbolId: symbol.symbolId,
                actualOwner: registeredTest.owner,
                expectedOwner: loadedManifest.manifest.subsystem,
              },
            ),
          );
      }
      for (const localTestId of symbol.localTestIds) {
        const owners = knownQaIdsForSymbols.filter((qaId) =>
          knownLocalTestIdsByQaId.get(qaId)?.has(localTestId),
        );
        if (knownQaIdsForSymbols.length > 0 && owners.length === 0)
          issues.push(
            createRealityDomainIssue(
              "graph.quality.local-test-identity-unresolved",
              loadedManifest.manifestPath,
              localTestId,
              "local_test_identity_unresolved",
              { localTestId, symbolId: symbol.symbolId },
            ),
          );
      }
    }

  for (const node of symbolsById.values())
    for (const targetId of node.symbol.verifies) {
      const target = symbolsById.get(targetId);
      if (!target) {
        issues.push(
          createRealityDomainIssue(
            "graph.verification.target-unresolved",
            node.manifestPath,
            node.symbol.symbolId,
            "verification_target_unresolved",
            { symbolId: node.symbol.symbolId, targetId },
          ),
        );
        continue;
      }
      if (
        target.symbol.kind === "test-suite" ||
        target.symbol.kind === "test-case"
      ) {
        issues.push(
          createRealityDomainIssue(
            "graph.verification.target-domain-invalid",
            node.manifestPath,
            node.symbol.symbolId,
            "verification_target_must_be_implementation",
            { symbolId: node.symbol.symbolId },
          ),
        );
        continue;
      }
      appendToIndex(testsByImplementationId, targetId, node);
    }

  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result:
      issues.length === 0
        ? {
            symbolsById,
            symbolsByArchId,
            symbolsByQaId,
            testsByImplementationId,
          }
        : null,
    issues,
  };
}
