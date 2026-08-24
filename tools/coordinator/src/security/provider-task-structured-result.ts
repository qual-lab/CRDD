import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/provider-task-structured-result";
export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_RAW_BYTES = 65_536;
const MAXIMUM_SUMMARY_BYTES = 8_192;
const MAXIMUM_PATHS = 1_000;
const MAXIMUM_FINDINGS = 64;
const MAXIMUM_FINDING_MESSAGE_BYTES = 4_096;
const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function validString(value: unknown, maximumBytes: number) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}

function validPath(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1_024 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}

function executorResult(value: Record<string, unknown>) {
  if (
    !exactKeys(value, ["status", "summary", "changedPaths", "verification"]) ||
    value.status !== "completed" ||
    !validString(value.summary, MAXIMUM_SUMMARY_BYTES) ||
    !Array.isArray(value.changedPaths) ||
    value.changedPaths.length > MAXIMUM_PATHS ||
    !value.changedPaths.every(validPath) ||
    new Set(value.changedPaths.map((item) => item.toUpperCase())).size !==
      value.changedPaths.length ||
    !Array.isArray(value.verification) ||
    value.verification.length > 32 ||
    !value.verification.every((item) => validString(item, 1_024))
  ) {
    return null;
  }
  return Object.freeze({
    status: "completed" as const,
    summary: value.summary as string,
    changedPaths: Object.freeze([...(value.changedPaths as string[])]),
    verification: Object.freeze([...(value.verification as string[])]),
  });
}

function reviewerResult(value: Record<string, unknown>) {
  if (
    !exactKeys(value, ["decision", "summary", "findings"]) ||
    (value.decision !== "approved" && value.decision !== "changes_requested") ||
    !validString(value.summary, MAXIMUM_SUMMARY_BYTES) ||
    !Array.isArray(value.findings) ||
    value.findings.length > MAXIMUM_FINDINGS
  ) {
    return null;
  }
  const findings = value.findings.map((finding) => {
    if (
      !isRecord(finding) ||
      !exactKeys(finding, ["severity", "path", "message"]) ||
      typeof finding.severity !== "string" ||
      !SEVERITIES.has(finding.severity) ||
      !validPath(finding.path) ||
      !validString(finding.message, MAXIMUM_FINDING_MESSAGE_BYTES)
    ) {
      return null;
    }
    return Object.freeze({
      severity: finding.severity as
        | "critical"
        | "high"
        | "medium"
        | "low"
        | "info",
      path: finding.path as string,
      message: finding.message as string,
    });
  });
  if (findings.some((finding) => finding === null)) return null;
  if (value.decision === "approved" && findings.length > 0) return null;
  if (value.decision === "changes_requested" && findings.length === 0)
    return null;
  return Object.freeze({
    decision: value.decision as "approved" | "changes_requested",
    summary: value.summary as string,
    findings: Object.freeze(findings as Exclude<(typeof findings)[number], null>[]),
  });
}

function structuredValue(provider: "codex" | "claude", raw: string) {
  const parsed = parseUnambiguousJsonDocument(raw);
  if (provider === "codex") return parsed;
  if (!isRecord(parsed)) return null;
  const numberOfTurns = parsed.num_turns;
  const cost = parsed.total_cost_usd;
  if (
    parsed.type !== "result" ||
    parsed.subtype !== "success" ||
    parsed.is_error !== false ||
    typeof numberOfTurns !== "number" ||
    !Number.isInteger(numberOfTurns) ||
    numberOfTurns < 1 ||
    numberOfTurns > 8 ||
    typeof cost !== "number" ||
    !Number.isFinite(cost) ||
    cost < 0 ||
    cost > 0.5
  ) {
    return null;
  }
  return parsed.structured_output;
}

export function normalizeProviderTaskStructuredResult(
  provider: unknown,
  taskRole: unknown,
  raw: unknown,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES
  ) {
    return Object.freeze({ status: "blocked" as const, normalizedResult: null });
  }
  const value = structuredValue(provider, raw);
  const normalizedResult = isRecord(value)
    ? taskRole === "executor"
      ? executorResult(value)
      : reviewerResult(value)
    : null;
  return normalizedResult
    ? Object.freeze({
        status: "confirmed" as const,
        provider,
        taskRole,
        normalizedResult,
        rawOutputReported: false,
      })
    : Object.freeze({
        status: "blocked" as const,
        normalizedResult: null,
        rawOutputReported: false,
      });
}

export function describeProviderTaskStructuredResultContract() {
  return Object.freeze({
    contract: PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT,
    contractRevision: PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"]),
    roles: Object.freeze(["executor", "reviewer"]),
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    claudeMaximumTurns: 8,
    claudeMaximumApiEquivalentCostUsd: 0.5,
    duplicateKeysAllowed: false,
    rawOutputReported: false,
  });
}
