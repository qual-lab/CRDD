import type { ArtifactModel } from "./artifact-model.ts";
import type { FindingSink } from "./finding-model.ts";

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

export function validateArtifactSchema(
  artifact: ArtifactModel,
  schema: ArtifactSchema,
  add: FindingSink,
): void {
  for (const property of schema.requiredProperties ?? [])
    if (!artifact[property])
      add({
        severity: "error",
        code: "artifact-schema-property-missing",
        path: artifact.sourceLocation.path,
        rule: schema.id,
        message: `Required artifact property is missing: ${property}.`,
      });
  const sectionTitles = new Set(artifact.sections.map(({ title }) => title));
  for (const section of schema.requiredSections ?? [])
    if (!sectionTitles.has(section))
      add({
        severity: "error",
        code: "artifact-schema-section-missing",
        path: artifact.sourceLocation.path,
        rule: schema.id,
        message: `Required artifact section is missing: ${section}.`,
      });
  if (
    schema.allowedStatuses &&
    artifact.status &&
    !schema.allowedStatuses.includes(artifact.status)
  )
    add({
      severity: "error",
      code: "artifact-schema-status-invalid",
      path: artifact.sourceLocation.path,
      rule: schema.id,
      message: `Artifact status is outside the declared schema: ${artifact.status}.`,
    });
}
