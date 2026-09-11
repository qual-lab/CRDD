import { createHash } from "node:crypto";

import {
  CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS,
  planClaudeTaskTurnBudget,
} from "./claude-execution-plan.ts";
import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/provider-task-structured-result";
export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION = 18;

const MAXIMUM_RAW_BYTES = 65_536;
const MAXIMUM_SUMMARY_BYTES = 8_192;
const MAXIMUM_PATHS = 1_000;
const MAXIMUM_FINDINGS = 64;
const MAXIMUM_FINDING_MESSAGE_BYTES = 4_096;
const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);
const FINDING_CATEGORIES = new Set([
  "acceptance_criterion_not_met",
  "implementation_defect",
  "verification_defect",
  "security_or_authority_defect",
]);
const remediationRecords = new WeakMap<
  object,
  readonly Readonly<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    path: string;
    category:
      | "acceptance_criterion_not_met"
      | "implementation_defect"
      | "verification_defect"
      | "security_or_authority_defect";
    criterionNumber: number;
    message: string;
    messageSha256: string;
  }>[]
>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => actualKeys.includes(key))
  );
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
    value
      .split("/")
      .every(
        (segment) => segment.length > 0 && segment !== "." && segment !== "..",
      )
  );
}

type ResultMismatchReason =
  | "provider_task_result_input_invalid"
  | "provider_task_result_json_invalid"
  | "provider_task_result_envelope_status_invalid"
  | "provider_task_result_turn_count_invalid"
  | "provider_task_result_cost_metadata_invalid"
  | "provider_task_reviewer_result_transport_invalid"
  | "provider_turn_limit_exceeded"
  | "provider_task_result_turn_limit_mismatch"
  | "provider_structured_output_retry_exhausted"
  | "provider_task_executor_shape_invalid"
  | "provider_task_reviewer_shape_invalid"
  | "provider_task_reviewer_finding_invalid"
  | "provider_task_reviewer_decision_inconsistent";

function rejected(reason: ResultMismatchReason) {
  return Object.freeze({ normalizedResult: null, reason });
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
    return rejected("provider_task_executor_shape_invalid");
  }
  return Object.freeze({
    normalizedResult: Object.freeze({
      status: "completed" as const,
      changedPaths: Object.freeze([...(value.changedPaths as string[])]),
      verificationCount: value.verification.length,
    }),
    reason: null,
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
    return rejected("provider_task_reviewer_shape_invalid");
  }
  const findings = value.findings.map((finding) => {
    if (
      !isRecord(finding) ||
      !exactKeys(finding, [
        "severity",
        "path",
        "category",
        "criterionNumber",
        "message",
      ]) ||
      typeof finding.severity !== "string" ||
      !SEVERITIES.has(finding.severity) ||
      !validPath(finding.path) ||
      typeof finding.category !== "string" ||
      !FINDING_CATEGORIES.has(finding.category) ||
      typeof finding.criterionNumber !== "number" ||
      !Number.isInteger(finding.criterionNumber) ||
      finding.criterionNumber < 1 ||
      finding.criterionNumber > 16 ||
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
      category: finding.category as
        | "acceptance_criterion_not_met"
        | "implementation_defect"
        | "verification_defect"
        | "security_or_authority_defect",
      criterionNumber: finding.criterionNumber as number,
      message: finding.message as string,
      messageSha256: createHash("sha256")
        .update("crdd-review-finding-message-v1\0")
        .update(finding.message as string, "utf8")
        .digest("hex"),
    });
  });
  if (findings.some((finding) => finding === null))
    return rejected("provider_task_reviewer_finding_invalid");
  if (value.decision === "approved" && findings.length > 0)
    return rejected("provider_task_reviewer_decision_inconsistent");
  if (value.decision === "changes_requested" && findings.length === 0)
    return rejected("provider_task_reviewer_decision_inconsistent");
  const remediationCapability =
    value.decision === "changes_requested" ? Object.freeze({}) : null;
  if (remediationCapability) {
    remediationRecords.set(
      remediationCapability,
      Object.freeze([
        ...(findings as NonNullable<(typeof findings)[number]>[]),
      ]),
    );
  }
  return Object.freeze({
    normalizedResult: Object.freeze({
      decision: value.decision as "approved" | "changes_requested",
      findingCount: findings.length,
      findingDiagnostics: Object.freeze(
        (findings as NonNullable<(typeof findings)[number]>[]).map(
          ({ severity, path, category, criterionNumber, messageSha256 }) =>
            Object.freeze({
              severity,
              path,
              category,
              criterionNumber,
              messageSha256,
            }),
        ),
      ),
      ...(remediationCapability ? { remediationCapability } : {}),
    }),
    reason: null,
  });
}

export function consumeProviderTaskRemediation(remediationCapability: unknown) {
  if (!remediationCapability || typeof remediationCapability !== "object")
    return null;
  const findings = remediationRecords.get(remediationCapability);
  if (!findings) return null;
  remediationRecords.delete(remediationCapability);
  return Object.freeze({
    status: "consumed" as const,
    findings,
    findingCount: findings.length,
    untrustedProviderTextReported: false,
  });
}

function structuredValue(
  provider: "codex" | "claude",
  taskRole: "executor" | "reviewer",
  resultAcceptanceMaximumTurns: number,
  raw: string,
) {
  let parsed = parseUnambiguousJsonDocument(raw);
  let codexExecutionObservation: Readonly<Record<string, unknown>> | null =
    null;
  if (provider === "codex" && parsed === null) {
    const events = raw
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => parseUnambiguousJsonDocument(line));
    if (
      events.length === 0 ||
      events.length > 4_096 ||
      events.some((event) => !isRecord(event))
    )
      return Object.freeze({
        value: null,
        reason: "provider_task_result_json_invalid" as const,
      });
    const records = events as Record<string, unknown>[];
    const itemEvents = records.filter(
      (event) =>
        (event.type === "item.started" || event.type === "item.completed") &&
        isRecord(event.item),
    );
    const finalMessages = itemEvents.filter(
      (event) =>
        event.type === "item.completed" &&
        (event.item as Record<string, unknown>).type === "agent_message" &&
        typeof (event.item as Record<string, unknown>).text === "string",
    );
    const turnCompletedCount = records.filter(
      (event) => event.type === "turn.completed",
    ).length;
    const turnFailedCount = records.filter(
      (event) => event.type === "turn.failed" || event.type === "error",
    ).length;
    const finalText = (
      finalMessages.at(-1)?.item as Record<string, unknown> | undefined
    )?.text;
    if (
      turnCompletedCount !== 1 ||
      turnFailedCount !== 0 ||
      typeof finalText !== "string"
    )
      return Object.freeze({
        value: null,
        reason: "provider_task_result_json_invalid" as const,
      });
    parsed = parseUnambiguousJsonDocument(finalText);
    const countItems = (itemType: string, status?: string) =>
      itemEvents.filter((event) => {
        const item = event.item as Record<string, unknown>;
        return (
          item.type === itemType &&
          event.type === (status ? "item.completed" : "item.started") &&
          (status === undefined || item.status === status)
        );
      }).length;
    const completedCommandExecutions = itemEvents
      .filter(
        (event) =>
          event.type === "item.completed" &&
          (event.item as Record<string, unknown>).type === "command_execution",
      )
      .map((event) => event.item as Record<string, unknown>);
    const countCommandExitCode = (exitCode: number) =>
      completedCommandExecutions.filter((item) => item.exit_code === exitCode)
        .length;
    const commandExecutionOtherNonzeroExitCodeCount =
      completedCommandExecutions.filter(
        (item) =>
          Number.isSafeInteger(item.exit_code) &&
          (item.exit_code as number) !== 0 &&
          (item.exit_code as number) !== 1 &&
          (item.exit_code as number) !== 126 &&
          (item.exit_code as number) !== 127,
      ).length;
    const commandExecutionMissingExitCodeCount =
      completedCommandExecutions.filter(
        (item) => !Number.isSafeInteger(item.exit_code),
      ).length;
    const commandText = (item: Record<string, unknown>) =>
      typeof item.command === "string" ? item.command.toLowerCase() : "";
    const commandOutputText = (item: Record<string, unknown>) =>
      typeof item.aggregated_output === "string"
        ? item.aggregated_output.toLowerCase()
        : typeof item.output === "string"
          ? item.output.toLowerCase()
          : "";
    const countCommandFamily = (pattern: RegExp) =>
      completedCommandExecutions.filter((item) =>
        pattern.test(commandText(item)),
      ).length;
    const failedCommandExecutions = completedCommandExecutions.filter(
      (item) => item.status === "failed",
    );
    const countFailureClass = (pattern: RegExp) =>
      failedCommandExecutions.filter((item) =>
        pattern.test(commandOutputText(item)),
      ).length;
    const classifiedFailures = new Set(
      failedCommandExecutions.filter((item) =>
        /permission denied|operation not permitted|read-only file system|no such file or directory|not found|syntax error|sandbox|bwrap|landlock/.test(
          commandOutputText(item),
        ),
      ),
    );
    codexExecutionObservation = Object.freeze({
      transport: "fixed_cli_jsonl_v0_149_1",
      turnCompleted: true,
      commandExecutionStartedCount: countItems("command_execution"),
      commandExecutionCompletedCount: countItems(
        "command_execution",
        "completed",
      ),
      commandExecutionFailedCount: countItems("command_execution", "failed"),
      commandExecutionDeclinedCount: countItems(
        "command_execution",
        "declined",
      ),
      commandExecutionExitCode0Count: countCommandExitCode(0),
      commandExecutionExitCode1Count: countCommandExitCode(1),
      commandExecutionExitCode126Count: countCommandExitCode(126),
      commandExecutionExitCode127Count: countCommandExitCode(127),
      commandExecutionOtherNonzeroExitCodeCount,
      commandExecutionMissingExitCodeCount,
      commandFamilyPythonCount: countCommandFamily(
        /(^|[\s;&|])python(?:3)?(?:[\s;&|]|$)/,
      ),
      commandFamilyPosixTextCount: countCommandFamily(
        /(^|[\s;&|])(cat|sed|grep|perl|awk)(?:[\s;&|]|$)/,
      ),
      commandFamilyGitCount: countCommandFamily(/(^|[\s;&|])git(?:[\s;&|]|$)/),
      commandFamilyApplyPatchCount: countCommandFamily(
        /(^|[\s;&|])apply_patch(?:[\s;&|]|$)/,
      ),
      commandFailurePermissionCount: countFailureClass(
        /permission denied|operation not permitted/,
      ),
      commandFailureReadOnlyFilesystemCount: countFailureClass(
        /read-only file system/,
      ),
      commandFailureMissingPathCount: countFailureClass(
        /no such file or directory/,
      ),
      commandFailureCommandNotFoundCount: countFailureClass(
        /command not found|: not found/,
      ),
      commandFailureSyntaxCount: countFailureClass(/syntax error/),
      commandFailureSandboxCount: countFailureClass(/sandbox|bwrap|landlock/),
      commandFailureUnclassifiedCount: failedCommandExecutions.filter(
        (item) => !classifiedFailures.has(item),
      ).length,
      fileChangeStartedCount: countItems("file_change"),
      fileChangeCompletedCount: countItems("file_change", "completed"),
      fileChangeFailedCount: countItems("file_change", "failed"),
      fileChangeDeclinedCount: countItems("file_change", "declined"),
      rawEventReported: false,
      commandReported: false,
      pathReported: false,
      providerTextReported: false,
    });
  }
  if (provider === "codex")
    return Object.freeze({
      value: parsed,
      reason: null,
      providerReportedTurns: null,
      codexExecutionObservation,
    });
  if (!isRecord(parsed))
    return Object.freeze({
      value: null,
      reason: "provider_task_result_json_invalid" as const,
    });
  if (parsed.type === "result" && parsed.subtype === "error_max_turns")
    return Object.freeze({
      value: null,
      reason: "provider_turn_limit_exceeded" as const,
    });
  if (
    parsed.type === "result" &&
    parsed.subtype === "error_max_structured_output_retries"
  )
    return Object.freeze({
      value: null,
      reason: "provider_structured_output_retry_exhausted" as const,
    });
  const numberOfTurns = parsed.num_turns;
  const cost = parsed.total_cost_usd;
  if (
    parsed.type !== "result" ||
    parsed.subtype !== "success" ||
    parsed.is_error !== false
  ) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_envelope_status_invalid" as const,
    });
  }
  if (
    typeof numberOfTurns !== "number" ||
    !Number.isInteger(numberOfTurns) ||
    numberOfTurns < 1
  ) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_turn_count_invalid" as const,
    });
  }
  if (numberOfTurns > resultAcceptanceMaximumTurns) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_turn_limit_mismatch" as const,
    });
  }
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_cost_metadata_invalid" as const,
    });
  }
  if (taskRole === "executor")
    return Object.freeze({
      value: parsed.structured_output,
      reason: null,
      providerReportedTurns: numberOfTurns,
    });
  if (
    typeof parsed.result !== "string" ||
    Buffer.byteLength(parsed.result, "utf8") > MAXIMUM_RAW_BYTES
  )
    return Object.freeze({
      value: null,
      reason: "provider_task_reviewer_result_transport_invalid" as const,
    });
  const reviewerValue = parseUnambiguousJsonDocument(parsed.result);
  return Object.freeze({
    value: reviewerValue,
    providerReportedTurns: numberOfTurns,
    reason:
      reviewerValue === null
        ? ("provider_task_result_json_invalid" as const)
        : null,
  });
}

export function normalizeProviderTaskStructuredResult(
  provider: unknown,
  taskRole: unknown,
  selectedEffort: unknown,
  raw: unknown,
  taskWorkload?: unknown,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    (selectedEffort !== "low" &&
      selectedEffort !== "medium" &&
      selectedEffort !== "high") ||
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const turnBudget =
    provider === "claude"
      ? planClaudeTaskTurnBudget(taskRole, taskWorkload)
      : null;
  if (provider === "claude" && turnBudget?.status !== "candidate") {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const extracted = structuredValue(
    provider,
    taskRole,
    turnBudget?.status === "candidate" ? turnBudget.hardMaximumTurns : 0,
    raw,
  );
  if (extracted.reason !== null || extracted.value === null) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        extracted.reason ?? ("provider_task_result_json_invalid" as const),
      normalizedResult: null,
      rawOutputReported: false,
      untrustedProviderTextReported: false,
      credentialAbsenceVerified: false,
    });
  }
  const value = extracted.value;
  const result = isRecord(value)
    ? taskRole === "executor"
      ? executorResult(value)
      : reviewerResult(value)
    : rejected(
        taskRole === "executor"
          ? "provider_task_executor_shape_invalid"
          : "provider_task_reviewer_shape_invalid",
      );
  return result.normalizedResult
    ? Object.freeze({
        status: "confirmed" as const,
        provider,
        taskRole,
        normalizedResult: Object.freeze({
          ...result.normalizedResult,
          ...(provider === "codex" &&
          "codexExecutionObservation" in extracted &&
          extracted.codexExecutionObservation
            ? {
                providerExecutionObservation:
                  extracted.codexExecutionObservation,
              }
            : {}),
          ...(provider === "claude" &&
          turnBudget?.status === "candidate" &&
          typeof extracted.providerReportedTurns === "number"
            ? {
                providerTurnObservation: Object.freeze({
                  provider: "claude" as const,
                  taskRole,
                  requestedMaximumTurns: turnBudget.maximumTurns,
                  providerReportedTurns: extracted.providerReportedTurns,
                  resultAcceptanceMaximumTurns: turnBudget.hardMaximumTurns,
                  requestedTurnTargetExceeded:
                    extracted.providerReportedTurns > turnBudget.maximumTurns,
                }),
              }
            : {}),
        }),
        rawOutputReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      })
    : Object.freeze({
        status: "blocked" as const,
        reason: result.reason,
        normalizedResult: null,
        rawOutputReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      });
}

export function describeProviderTaskStructuredResultContract() {
  return Object.freeze({
    contract: PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT,
    contractRevision: PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"]),
    roles: Object.freeze(["executor", "reviewer"]),
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    claudeResultAcceptanceMaximumTurns: CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS,
    claudeResultAcceptanceMaximumTurnsBasis:
      "runtime_guard_independent_of_provider_requested_turn_target",
    acceptedClaudeTurnObservation:
      "requested_target_reported_turns_absolute_acceptance_maximum_and_target_exceeded_after_validation",
    claudeMaximumApiEquivalentCostUsdByEffort: null,
    claudeApiEquivalentCostDisposition:
      "validated_nonnegative_finite_usage_metadata_not_billing_authority",
    duplicateKeysAllowed: false,
    mismatchDiagnostics:
      "fixed_reason_identifier_only_without_raw_provider_output",
    claudeResultTransport: Object.freeze({
      executor: "provider_structured_output_then_crdd_validation",
      reviewer: "provider_json_envelope_result_then_crdd_validation",
    }),
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    boundedRemediationCapability:
      "opaque_single_use_path_severity_category_criterion_secret_screened_message_claim_and_message_hash_projection",
    reviewerMessageForwardedToExecutor:
      "bounded_untrusted_defect_claim_after_secret_screening",
    credentialAbsenceVerified: false,
  });
}
