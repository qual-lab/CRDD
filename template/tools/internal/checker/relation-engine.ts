import type { ArtifactModel } from "./artifact-model.ts";
import type { FindingSink } from "./finding-model.ts";

export type ArtifactGraph = Readonly<{
  artifactsById: ReadonlyMap<string, ArtifactModel>;
  incoming: ReadonlyMap<string, readonly ArtifactModel[]>;
}>;

export function buildArtifactGraph(
  artifacts: readonly ArtifactModel[],
  add: FindingSink,
): ArtifactGraph {
  const artifactsById = new Map<string, ArtifactModel>();
  const incoming = new Map<string, ArtifactModel[]>();
  for (const artifact of artifacts) {
    if (!artifact.canonicalId) continue;
    if (artifactsById.has(artifact.canonicalId))
      add({
        severity: "error",
        code: "artifact-canonical-id-duplicate",
        path: artifact.sourceLocation.path,
        rule: "relation.canonical-id-uniqueness",
        message: `Canonical ID is declared by more than one artifact: ${artifact.canonicalId}.`,
      });
    else artifactsById.set(artifact.canonicalId, artifact);
  }
  for (const artifact of artifacts)
    for (const relation of artifact.relations) {
      if (!artifactsById.has(relation.target)) continue;
      const sources = incoming.get(relation.target) ?? [];
      sources.push(artifact);
      incoming.set(relation.target, sources);
    }
  return { artifactsById, incoming };
}
