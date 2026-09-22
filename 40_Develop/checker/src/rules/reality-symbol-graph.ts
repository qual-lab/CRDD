/**
 * reality-symbol-graphに属する責務をまとめる。
 *
 * @responsibility realitySymbolGraphRuleを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
import fs from "node:fs";
import path from "node:path";

import {
  createRealitySymbolGraph,
  discoverRealitySymbolManifests,
} from "../adapters/reality-traceability.ts";
import { readRegisteredRealityTests } from "../adapters/reality-test-catalog.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";
import type { CheckerRule } from "./rule-registry.ts";

/**
 * Test SourceがskipされたPlaceholderを含むか判定する。
 *
 * @responsibility Local Item Relationを実行されないTestへ接続する偽陽性を検出する。
 * @trace ARCH-000001
 * @input source: Test Source本文。
 * @returns test.skip、it.skipまたはdescribe.skipがあればtrue。
 * @precondition sourceは対象Test Fileから読み取った文字列である。
 * @postcondition Sourceを変更せず決定論的な真偽値を返す。
 * @effect N/A: 文字列を検査するだけである。
 * @failure N/A: 任意文字列をfalseまたはtrueへ分類する。
 * @invariant skipされないTest名やCommentだけを実行Evidenceと誤認しない。
 * @boundary N/A: Process内の文字列検査で完結する。
 * @security N/A: Authorityや秘密値を扱わない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function hasSkippedTestDeclaration(source: string): boolean {
  return /\b(?:test|it|describe)\.skip\s*\(/u.test(source);
}

/**
 * reality Symbol Graph Ruleを決定する。
 *
 * @responsibility reality Symbol Graph Ruleの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
      for (const loaded of discovery.manifests)
        for (const symbol of loaded.manifest.symbols) {
          if (
            symbol.localTestIds.length === 0 ||
            (symbol.kind !== "test-suite" && symbol.kind !== "test-case")
          )
            continue;
          const testPath = path.join(loaded.subsystemRoot, symbol.path);
          if (!fs.existsSync(testPath)) continue;
          const source = fs.readFileSync(testPath, "utf8");
          if (hasSkippedTestDeclaration(source))
            add({
              severity: "error",
              code: "reality-symbol-skipped-test-evidence-forbidden",
              path: path
                .relative(repositoryRoot, testPath)
                .replaceAll("\\", "/"),
              rule: "current-profile.reality-symbol-graph",
              message:
                "A skipped test placeholder cannot own Local Item relations or count as observed verification evidence.",
            });
        }
    },
  };
}
