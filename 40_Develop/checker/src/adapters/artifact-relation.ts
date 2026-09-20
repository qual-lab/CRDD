import type { DomainIssue } from "../../../crdd-domain-library/src/index.ts";
import type { CheckerFinding } from "../findings/finding-model.ts";

function stringDetail(issue: DomainIssue, name: string): string {
  const value = issue.details[name];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(
      `invalid_artifact_domain_issue_detail:${issue.kind}:${name}`,
    );
  return value;
}

export function mapArtifactDomainIssueToCheckerFinding(
  issue: DomainIssue,
): CheckerFinding {
  let code: string;
  let rule: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.schema.property-missing":
      code = "artifact-schema-property-missing";
      rule = stringDetail(issue, "schemaId");
      message = `Required artifact property is missing: ${stringDetail(issue, "property")}.`;
      break;
    case "artifact.schema.section-missing":
      code = "artifact-schema-section-missing";
      rule = stringDetail(issue, "schemaId");
      message = `Required artifact section is missing: ${stringDetail(issue, "section")}.`;
      break;
    case "artifact.schema.status-invalid":
      code = "artifact-schema-status-invalid";
      rule = stringDetail(issue, "schemaId");
      message = `Artifact status is outside the declared schema: ${stringDetail(issue, "status")}.`;
      break;
    case "artifact.relation.canonical-id-duplicate":
      code = "artifact-canonical-id-duplicate";
      rule = "relation.canonical-id-uniqueness";
      message = `Canonical ID is declared by more than one artifact: ${stringDetail(issue, "canonicalId")}.`;
      break;
    default:
      throw new Error(`unknown_artifact_domain_issue:${issue.kind}`);
  }
  return {
    severity: "error",
    code,
    path: issue.location.path,
    rule,
    message,
  };
}
