import { snapshotPlainRecord } from "../internal/plain-data-snapshot.ts";

export const PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/project-runtime-human-decision/v1" as const;

export type ProjectRuntimeDecisionRequest = Readonly<{
  decisionId: string;
  projectId: string;
  milestoneId: string;
  generation: number;
  repositoryRevision: string;
  selectedOption: "resume" | "cancel";
  continuationCapability: string;
  comment?: string;
}>;

const requiredDecisionKeys = new Set([
  "decisionId",
  "projectId",
  "milestoneId",
  "generation",
  "repositoryRevision",
  "selectedOption",
  "continuationCapability",
] as const);
const decisionKeysWithComment = new Set([
  ...requiredDecisionKeys,
  "comment",
] as const);

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

function validCapability(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

function validComment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new TextEncoder().encode(value).byteLength <= 1_024 &&
    !/[\r\n\u0000-\u001f\u007f]/u.test(value)
  );
}

export function inspectProjectRuntimeDecisionRequest(
  value: unknown,
): ProjectRuntimeDecisionRequest | null {
  const request =
    snapshotPlainRecord(value, decisionKeysWithComment) ??
    snapshotPlainRecord(value, requiredDecisionKeys);
  const comment = (request as Readonly<Record<string, unknown>> | null)
    ?.comment;
  if (
    !request ||
    !validId(request.decisionId) ||
    !validId(request.projectId) ||
    !validId(request.milestoneId) ||
    !Number.isSafeInteger(request.generation) ||
    Number(request.generation) < 1 ||
    !validRevision(request.repositoryRevision) ||
    (request.selectedOption !== "resume" &&
      request.selectedOption !== "cancel") ||
    !validCapability(request.continuationCapability) ||
    (comment !== undefined && !validComment(comment))
  )
    return null;
  return Object.freeze({ ...request }) as ProjectRuntimeDecisionRequest;
}
