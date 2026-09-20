import {
  createRealitySymbolGraph,
  discoverRealitySymbolManifests,
} from "../adapters/reality-traceability.ts";
import { readRegisteredRealityTests } from "../adapters/reality-test-catalog.ts";
import { verifyRepositoryRoot } from "../../../../version-control/src/index.ts";
import type { CheckerRule } from "../rule-registry.ts";

export function realitySymbolGraphRule(repositoryRoot: string): CheckerRule {
  return {
    id: "current-profile.reality-symbol-graph",
    stage: "special-rules",
    run: ({ add }) => {
      const verified = verifyRepositoryRoot(repositoryRoot);
      if (verified.status !== "completed") {
        add({
          severity: "error",
          code: "reality-symbol-repository-root-unverified",
          path: ".",
          rule: "current-profile.reality-symbol-graph",
          message: verified.reason,
        });
        return;
      }
      const discovery = discoverRealitySymbolManifests(verified.capability);
      const testCatalog =
        discovery.manifests.length > 0
          ? readRegisteredRealityTests(verified.capability)
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
