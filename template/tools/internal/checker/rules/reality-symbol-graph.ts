import { discoverRealitySymbolManifests } from "../../reality-traceability/symbol-discovery.ts";
import { createRealitySymbolGraph } from "../../reality-traceability/symbol-graph.ts";
import type { CheckerRule } from "../rule-registry.ts";
import { readRegisteredRealityTests } from "./reality-test-catalog-adapter.ts";

export function realitySymbolGraphRule(repositoryRoot: string): CheckerRule {
  return {
    id: "current-profile.reality-symbol-graph",
    stage: "special-rules",
    run: ({ add }) => {
      const discovery = discoverRealitySymbolManifests(repositoryRoot);
      const testCatalog =
        discovery.manifests.length > 0
          ? readRegisteredRealityTests(repositoryRoot)
          : { testsByPath: new Map(), findings: [] };
      const built = createRealitySymbolGraph(
        discovery.manifests,
        discovery.knownArchIds,
        discovery.knownQaIds,
        discovery.knownLocalTestIdsByQaId,
        testCatalog.testsByPath,
        [...discovery.findings, ...testCatalog.findings],
      );
      for (const finding of [...built.findings])
        add({
          severity: "error",
          code: finding.code,
          path: finding.path,
          rule: "current-profile.reality-symbol-graph",
          message: finding.message,
        });
    },
  };
}
