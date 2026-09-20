import {
  type ArtifactModel,
  type ArtifactSchema,
  type ArtifactSource,
  parseMarkdownArtifact,
  validateArtifactSchema,
} from "../../../../40_Develop/crdd-domain-library/src/domain/artifact/index.ts";
import {
  type ArtifactGraph,
  buildArtifactGraph,
} from "../../../../40_Develop/crdd-domain-library/src/domain/relation/index.ts";
import { mapArtifactDomainIssueToCheckerFinding } from "../../../../40_Develop/checker/src/internal/adapters/artifact-relation.ts";
import {
  createFindingCollector,
  type CheckerFinding,
} from "./finding-model.ts";
import { RuleRegistry } from "./rule-registry.ts";

export type CheckerPipelineResult = Readonly<{
  artifacts: readonly ArtifactModel[];
  graph: ArtifactGraph;
  findings: readonly CheckerFinding[];
}>;

export function runCheckerPipeline(
  input: Readonly<{
    sources: readonly ArtifactSource[];
    schemas?: readonly ArtifactSchema[];
    registry?: RuleRegistry;
  }>,
): CheckerPipelineResult {
  const collector = createFindingCollector();
  const artifacts = input.sources.map(parseMarkdownArtifact);
  for (const artifact of artifacts)
    for (const schema of input.schemas ?? [])
      if (schema.matches(artifact))
        for (const issue of validateArtifactSchema(artifact, schema).issues)
          collector.add(mapArtifactDomainIssueToCheckerFinding(issue));
  const graphOutcome = buildArtifactGraph({ artifacts });
  for (const issue of graphOutcome.issues)
    collector.add(mapArtifactDomainIssueToCheckerFinding(issue));
  const graph = graphOutcome.result;
  if (!graph) throw new Error("artifact_graph_result_missing");
  const registry = input.registry ?? new RuleRegistry();
  const context = { artifacts, graph, add: collector.add };
  registry.executeStage("cross-artifact-validation", context);
  registry.executeStage("special-rules", context);
  return { artifacts, graph, findings: collector.findings };
}
