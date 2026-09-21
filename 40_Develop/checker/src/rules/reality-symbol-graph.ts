import {
  createRealitySymbolGraph,
  discoverRealitySymbolManifests,
} from "../adapters/reality-traceability.ts";
import { readRegisteredRealityTests } from "../adapters/reality-test-catalog.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";
import type { CheckerRule } from "./rule-registry.ts";

/**
 * realitySymbolGraphRuleの処理を実行する。
 *
 * @responsibility realitySymbolGraphRuleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000001
 * @input repositoryRoot: string
 * @returns CheckerRuleを返す。
 * @precondition 「repositoryRoot: string」がrealitySymbolGraphRuleの入力契約を満たす。
 * @postcondition realitySymbolGraphRuleの責務を完了した結果だけを返す。
 * @effect N/A: realitySymbolGraphRuleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: realitySymbolGraphRuleは独自の失敗分岐を所有しない。
 * @invariant realitySymbolGraphRuleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: realitySymbolGraphRuleはProcess内の同一Subsystemで完結する。
 * @security N/A: realitySymbolGraphRuleはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: realitySymbolGraphRuleは共有非同期状態を持たない同期処理である。
 */
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
