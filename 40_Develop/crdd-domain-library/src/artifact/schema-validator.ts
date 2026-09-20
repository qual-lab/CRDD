import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import type { ArtifactModel } from "./artifact-model.ts";

export type ArtifactSchema = Readonly<{
  id: string;
  matches: (artifact: ArtifactModel) => boolean;
  requiredProperties?: readonly (keyof Pick<
    ArtifactModel,
    "artifactType" | "canonicalId" | "status"
  >)[];
  requiredSections?: readonly string[];
  allowedStatuses?: readonly string[];
}>;

export type ArtifactSchemaValidationResult = DomainOutcome<ArtifactModel>;

function schemaIssue(
  artifact: ArtifactModel,
  schemaId: string,
  kind: string,
  reason: string,
  details: DomainIssue["details"],
): DomainIssue {
  return {
    kind,
    targetIdentity: artifact.canonicalId ?? artifact.sourceLocation.path,
    location: artifact.sourceLocation,
    reason,
    details: { schemaId, ...details },
  };
}

export function validateArtifactSchema(
  artifact: ArtifactModel,
  schema: ArtifactSchema,
): ArtifactSchemaValidationResult {
  const issues: DomainIssue[] = [];
  for (const property of schema.requiredProperties ?? [])
    if (!artifact[property])
      issues.push(
        schemaIssue(
          artifact,
          schema.id,
          "artifact.schema.property-missing",
          "required_property_missing",
          { property },
        ),
      );
  const sectionTitles = new Set(artifact.sections.map(({ title }) => title));
  for (const section of schema.requiredSections ?? [])
    if (!sectionTitles.has(section))
      issues.push(
        schemaIssue(
          artifact,
          schema.id,
          "artifact.schema.section-missing",
          "required_section_missing",
          { section },
        ),
      );
  if (
    schema.allowedStatuses &&
    artifact.status &&
    !schema.allowedStatuses.includes(artifact.status)
  )
    issues.push(
      schemaIssue(
        artifact,
        schema.id,
        "artifact.schema.status-invalid",
        "status_outside_declared_schema",
        { status: artifact.status },
      ),
    );
  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result: issues.length === 0 ? artifact : null,
    issues,
  };
}
