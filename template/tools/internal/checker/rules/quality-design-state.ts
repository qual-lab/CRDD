import type { CheckerRule } from "../rule-registry.ts";

function normalizedState(state: string): string {
  return state
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
}

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
