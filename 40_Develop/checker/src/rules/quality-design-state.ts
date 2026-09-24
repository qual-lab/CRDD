/**
 * quality-design-stateに属する責務をまとめる。
 *
 * @responsibility normalizedStateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
import type { CheckerRule } from "./rule-registry.ts";

/**
 * 状態を固定Schemaへ正規化する。
 *
 * @responsibility 状態の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000001
 * @input state: string
 * @returns stringを返す。
 * @precondition 「state: string」がnormalizedStateの入力契約を満たす。
 * @postcondition normalizedStateの責務を完了した結果だけを返す。
 * @effect N/A: normalizedStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedStateは独自の失敗分岐を所有しない。
 * @invariant normalizedStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedStateはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizedStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizedStateは共有非同期状態を持たない同期処理である。
 */
function normalizedState(state: string): string {
  return state
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
}

/**
 * quality Design Canonical 状態 Ruleを決定する。
 *
 * @responsibility quality Design Canonical 状態 Ruleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000001
 * @input readiness: "Quality Design Ready" | "Quality Ready"
 * @returns CheckerRuleを返す。
 * @precondition 「readiness: "Quality Design Ready" | "Quality Ready"」がqualityDesignCanonicalStateRuleの入力契約を満たす。
 * @postcondition qualityDesignCanonicalStateRuleの責務を完了した結果だけを返す。
 * @effect N/A: qualityDesignCanonicalStateRuleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: qualityDesignCanonicalStateRuleは独自の失敗分岐を所有しない。
 * @invariant qualityDesignCanonicalStateRuleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: qualityDesignCanonicalStateRuleはProcess内の同一Subsystemで完結する。
 * @security N/A: qualityDesignCanonicalStateRuleはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: qualityDesignCanonicalStateRuleは共有非同期状態を持たない同期処理である。
 */
export function qualityDesignCanonicalStateRule(
  readiness: "Quality Design Ready" | "Quality Ready",
): CheckerRule {
  return {
    id: "quality.design-artifact-canonical-state",
    stage: "special-rules",
    run: ({ artifacts, add }) => {
      for (const artifact of artifacts)
        if (normalizedState(artifact.status ?? "") !== "Canonical")
          add({
            severity: "error",
            code: "quality-design-artifact-state-invalid",
            path: artifact.sourceLocation.path,
            rule: "quality.design-artifact-canonical-state",
            message: `${readiness} requires every Quality design root, Analysis, and Definition artifact to declare Canonical state.`,
          });
    },
  };
}
