import type { ArtifactModel } from "../../../../40_Develop/crdd-domain-library/src/domain/artifact/index.ts";
import type { ArtifactGraph } from "../../../../40_Develop/crdd-domain-library/src/domain/relation/index.ts";
import type { FindingSink } from "./finding-model.ts";

export const checkerStages = [
  "repository-discovery",
  "markdown-parse",
  "artifact-model",
  "schema-validation",
  "relation-resolution",
  "cross-artifact-validation",
  "special-rules",
  "finding-report",
] as const;

export type CheckerStage = (typeof checkerStages)[number];
export type CheckerRuleContext = Readonly<{
  artifacts: readonly ArtifactModel[];
  graph: ArtifactGraph;
  add: FindingSink;
}>;
export type CheckerRule = Readonly<{
  id: string;
  stage: "cross-artifact-validation" | "special-rules";
  run: (context: CheckerRuleContext) => void;
}>;

export class RuleRegistry {
  readonly #rules = new Map<string, CheckerRule>();

  register(rule: CheckerRule): void {
    if (this.#rules.has(rule.id))
      throw new Error(`Duplicate checker rule: ${rule.id}`);
    this.#rules.set(rule.id, rule);
  }

  executeStage(stage: CheckerRule["stage"], context: CheckerRuleContext): void {
    for (const rule of [...this.#rules.values()]
      .filter((candidate) => candidate.stage === stage)
      .sort((left, right) => left.id.localeCompare(right.id, "en")))
      rule.run(context);
  }
}
