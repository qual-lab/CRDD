import type { ArtifactModel, ArtifactSource } from "./artifact-model.ts";
import {
  createFindingCollector,
  type CheckerFinding,
} from "./finding-model.ts";
import { parseMarkdownArtifact } from "./markdown-artifact-parser.ts";
import { buildArtifactGraph, type ArtifactGraph } from "./relation-engine.ts";
import { RuleRegistry } from "./rule-registry.ts";
import {
  type ArtifactSchema,
  validateArtifactSchema,
} from "./schema-validator.ts";

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
        validateArtifactSchema(artifact, schema, collector.add);
  const graph = buildArtifactGraph(artifacts, collector.add);
  const registry = input.registry ?? new RuleRegistry();
  const context = { artifacts, graph, add: collector.add };
  registry.executeStage("cross-artifact-validation", context);
  registry.executeStage("special-rules", context);
  return { artifacts, graph, findings: collector.findings };
}
