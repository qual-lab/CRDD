import type { ArtifactModel } from "./artifact-model.ts";
import type { DomainIssue, DomainOutcome } from "../outcome.ts";

export type ArtifactGraph = Readonly<{
  artifactsById: ReadonlyMap<string, ArtifactModel>;
  incoming: ReadonlyMap<string, readonly ArtifactModel[]>;
}>;

export type BuildArtifactGraphRequest = Readonly<{
  artifacts: readonly ArtifactModel[];
}>;

export type ArtifactGraphResult = DomainOutcome<ArtifactGraph>;

export function buildArtifactGraph(
  request: BuildArtifactGraphRequest,
): ArtifactGraphResult {
  const issues: DomainIssue[] = [];
  const artifactsById = new Map<string, ArtifactModel>();
  const incoming = new Map<string, ArtifactModel[]>();
  for (const artifact of request.artifacts) {
    if (!artifact.canonicalId) continue;
    if (artifactsById.has(artifact.canonicalId))
      issues.push({
        kind: "artifact.relation.canonical-id-duplicate",
        targetIdentity: artifact.canonicalId,
        location: artifact.sourceLocation,
        reason: "canonical_identity_not_unique",
        details: { canonicalId: artifact.canonicalId },
      });
    else artifactsById.set(artifact.canonicalId, artifact);
  }
  for (const artifact of request.artifacts)
    for (const relation of artifact.relations) {
      if (!artifactsById.has(relation.target)) continue;
      const sources = incoming.get(relation.target) ?? [];
      sources.push(artifact);
      incoming.set(relation.target, sources);
    }
  return {
    status: issues.length === 0 ? "complete" : "partial",
    result: { artifactsById, incoming },
    issues,
  };
}
