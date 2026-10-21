/**
 * provider-task-structured-resultに属する責務をまとめる。
 *
 * @responsibility isRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import { createHash } from "node:crypto";
import {
  CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS,
  evaluateProviderTaskScope,
  parseProviderResult,
  parseUnambiguousJsonDocument,
} from "../../../ai-adapter/src/index.ts";
import type { CoordinatorAiResultItem } from "./types.ts";
export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/provider-task-structured-result";
export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION = 19;

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

/**
 * 記録かを判定する。
 *
 * @responsibility 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security isRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: Record<string, unknown>、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => actualKeys.includes(key))
  );
}

/**
 * Stringが有効か判定する。
 *
 * @responsibility Stringの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown、maximumBytes: number
 * @returns validStringの計算結果を返す。
 * @precondition 「value: unknown、maximumBytes: number」がvalidStringの入力契約を満たす。
 * @postcondition validStringの責務を完了した結果だけを返す。
 * @effect N/A: validStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validStringは独自の失敗分岐を所有しない。
 * @invariant validStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validStringはProcess内の同一Subsystemで完結する。
 * @security validStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validStringは共有非同期状態を持たない同期処理である。
 */
function validString(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}

/**
 * Pathが有効か判定する。
 *
 * @responsibility Pathの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns validPathの計算結果を返す。
 * @precondition 「value: unknown」がvalidPathの入力契約を満たす。
 * @postcondition validPathの責務を完了した結果だけを返す。
 * @effect N/A: validPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validPathは独自の失敗分岐を所有しない。
 * @invariant validPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPathはProcess内の同一Subsystemで完結する。
 * @security validPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validPathは共有非同期状態を持たない同期処理である。
 */
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

/**
 * provider-task-structured-resultで使用する結果 Mismatch Reasonの値契約を定義する。
 *
 * @responsibility 結果 Mismatch ReasonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ResultMismatchReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ResultMismatchReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: ResultMismatchReasonの宣言は外部境界を開かない。
 * @security ResultMismatchReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ResultMismatchReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
  | "provider_task_reviewer_keys_invalid"
  | "provider_task_reviewer_decision_invalid"
  | "provider_task_reviewer_summary_invalid"
  | "provider_task_reviewer_findings_invalid"
  | "provider_task_reviewer_finding_invalid"
  | "provider_task_reviewer_decision_inconsistent";

/**
 * rejectedを決定する。
 *
 * @responsibility rejectedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input reason: ResultMismatchReason
 * @returns rejectedの計算結果を返す。
 * @precondition 「reason: ResultMismatchReason」がrejectedの入力契約を満たす。
 * @postcondition rejectedの責務を完了した結果だけを返す。
 * @effect N/A: rejectedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedは独自の失敗分岐を所有しない。
 * @invariant rejectedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: rejectedはProcess内の同一Subsystemで完結する。
 * @security rejectedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedは共有非同期状態を持たない同期処理である。
 */
function rejected(reason: ResultMismatchReason) {
  return Object.freeze({ normalizedResult: null, reason });
}

/**
 * executor 結果を決定する。
 *
 * @responsibility executor 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>
 * @returns executorResultの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がexecutorResultの入力契約を満たす。
 * @postcondition executorResultの責務を完了した結果だけを返す。
 * @effect N/A: executorResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executorResultは独自の失敗分岐を所有しない。
 * @invariant executorResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executorResultはProcess内の同一Subsystemで完結する。
 * @security executorResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: executorResultは共有非同期状態を持たない同期処理である。
 */
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

/**
 * reviewer 結果を決定する。
 *
 * @responsibility reviewer 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>
 * @returns reviewerResultの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がreviewerResultの入力契約を満たす。
 * @postcondition reviewerResultの責務を完了した結果だけを返す。
 * @effect N/A: reviewerResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reviewerResultは独自の失敗分岐を所有しない。
 * @invariant reviewerResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reviewerResultはProcess内の同一Subsystemで完結する。
 * @security reviewerResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reviewerResultは共有非同期状態を持たない同期処理である。
 */
function reviewerResult(value: Record<string, unknown>) {
  if (!exactKeys(value, ["decision", "summary", "findings"]))
    return rejected("provider_task_reviewer_keys_invalid");
  if (value.decision !== "approved" && value.decision !== "changes_requested")
    return rejected("provider_task_reviewer_decision_invalid");
  if (!validString(value.summary, MAXIMUM_SUMMARY_BYTES))
    return rejected("provider_task_reviewer_summary_invalid");
  if (
    !Array.isArray(value.findings) ||
    value.findings.length > MAXIMUM_FINDINGS
  )
    return rejected("provider_task_reviewer_findings_invalid");
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

/**
 * Provider Task Remediationを一回限りで消費する。
 *
 * @responsibility Provider Task Remediationの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input remediationCapability: unknown
 * @returns consumeProviderTaskRemediationの計算結果を返す。
 * @precondition 「remediationCapability: unknown」がconsumeProviderTaskRemediationの入力契約を満たす。
 * @postcondition consumeProviderTaskRemediationの責務を完了した結果だけを返す。
 * @effect N/A: consumeProviderTaskRemediationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeProviderTaskRemediationは独自の失敗分岐を所有しない。
 * @invariant consumeProviderTaskRemediationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeProviderTaskRemediationはProcess内の同一Subsystemで完結する。
 * @security consumeProviderTaskRemediationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeProviderTaskRemediationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Provider Task Structured 結果を固定Schemaへ正規化する。
 *
 * @responsibility Provider Task Structured 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input provider: unknown、taskRole: unknown、selectedEffort: unknown、raw: unknown、taskWorkload: unknown
 * @returns normalizeProviderTaskStructuredResultの計算結果を返す。
 * @precondition 「provider: unknown、taskRole: unknown、selectedEffort: unknown、raw: unknown、taskWorkload: unknown」がnormalizeProviderTaskStructuredResultの入力契約を満たす。
 * @postcondition normalizeProviderTaskStructuredResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeProviderTaskStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeProviderTaskStructuredResultは独自の失敗分岐を所有しない。
 * @invariant normalizeProviderTaskStructuredResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeProviderTaskStructuredResultはProcess内の同一Subsystemで完結する。
 * @security normalizeProviderTaskStructuredResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeProviderTaskStructuredResultは共有非同期状態を持たない同期処理である。
 */
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
      ? evaluateProviderTaskScope("claude", taskRole, taskWorkload)
      : null;
  if (provider === "claude" && turnBudget?.status !== "candidate") {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const extracted = parseProviderResult({
    provider,
    purpose: "task",
    taskRole,
    resultAcceptanceMaximumTurns:
      turnBudget?.status === "candidate" ? turnBudget.hardMaximumTurns : 0,
    raw,
  });
  if (extracted.status !== "confirmed" || extracted.value === null) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        extracted.error?.reason ??
        ("provider_task_result_json_invalid" as const),
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

/**
 * Provider Task Structured 結果 契約の公開契約を記述する。
 *
 * @responsibility Provider Task Structured 結果 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderTaskStructuredResultContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderTaskStructuredResultContractの入力契約を満たす。
 * @postcondition describeProviderTaskStructuredResultContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderTaskStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderTaskStructuredResultContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderTaskStructuredResultContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderTaskStructuredResultContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderTaskStructuredResultContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderTaskStructuredResultContractは共有非同期状態を持たない同期処理である。
 */
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
      "fixed_structural_reason_identifier_only_without_raw_provider_output",
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

export const PROVIDER_ADVICE_RESULT_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-result";
export const PROVIDER_ADVICE_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_TEXT_BYTES = 8_192;
const MAXIMUM_REFERENCE_BYTES = 512;
const MAXIMUM_ITEMS_PER_SECTION = 64;
const MAXIMUM_REFERENCES_PER_ITEM = 16;
const resultKeys = [
  "contract",
  "contractRevision",
  "status",
  "facts",
  "sharedAnalysis",
  "additionalInferences",
  "nextOptions",
] as const;
const itemKeys = ["text", "references"] as const;

/**
 * 読取り助言結果の閉じたSchema検証境界で使用するAdviceResultの構造を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceResult = Readonly<{
  status: "completed";
  reason: null;
  facts: readonly CoordinatorAiResultItem[];
  sharedAnalysis: readonly CoordinatorAiResultItem[];
  additionalInferences: readonly CoordinatorAiResultItem[];
  nextOptions: readonly CoordinatorAiResultItem[];
}>;

/**
 * 生Provider出力を読取り助言結果へ正規化する。
 *
 * @responsibility 曖昧でない単一JSONと許可済み参照集合だけを受理する。
 * @trace ARCH-000015
 * @input raw: 生Provider出力、allowedReferences: 読取り投影が許可したexact参照集合。
 * @returns confirmed時だけ正規化結果を返し、不正時は理由付きadviceResultRejectedを返す。
 * @precondition allowedReferencesはProviderへ渡した読取り投影から生成する。
 * @postcondition 全項目は本文と一件以上の許可済み参照を持つ。
 * @effect N/A: 入力検証と値の複製だけを行う。
 * @failure JSON、Schema、文字数または参照が不正なら生出力を含めずadviceResultRejectedにする。
 * @invariant 四つの結果区分と本文・参照の対応を変えない。
 * @boundary 生Provider出力とCoordinator読取り助言結果の境界。
 * @security 許可集合外参照、重複Key、余分なKeyおよび過大出力を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function normalizeAdviceResult(
  raw: unknown,
  allowedReferences: readonly string[],
) {
  const allowed = inspectAllowedReferences(allowedReferences);
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES ||
    allowed === null
  )
    return adviceResultRejected("workbench_ai_advice_result_input_invalid");

  const value = parseUnambiguousJsonDocument(raw);
  if (!isExactRecord(value, resultKeys))
    return adviceResultRejected("workbench_ai_advice_result_schema_invalid");
  if (
    value.contract !== PROVIDER_ADVICE_RESULT_CONTRACT ||
    value.contractRevision !== PROVIDER_ADVICE_RESULT_CONTRACT_REVISION ||
    value.status !== "completed"
  )
    return adviceResultRejected("workbench_ai_advice_result_identity_invalid");

  const facts = inspectItems(value.facts, allowed);
  const sharedAnalysis = inspectItems(value.sharedAnalysis, allowed);
  const additionalInferences = inspectItems(
    value.additionalInferences,
    allowed,
  );
  const nextOptions = inspectItems(value.nextOptions, allowed);
  if (
    facts === null ||
    sharedAnalysis === null ||
    additionalInferences === null ||
    nextOptions === null ||
    facts.length +
      sharedAnalysis.length +
      additionalInferences.length +
      nextOptions.length ===
      0
  )
    return adviceResultRejected("workbench_ai_advice_result_items_invalid");

  return Object.freeze({
    status: "confirmed" as const,
    reason: null,
    normalizedResult: Object.freeze({
      status: "completed" as const,
      reason: null,
      facts,
      sharedAnalysis,
      additionalInferences,
      nextOptions,
    }) satisfies AdviceResult,
    rawOutputReported: false as const,
  });
}

/**
 * 公開結果契約を返す。
 *
 * @responsibility Provider Adapterが固定すべきContract Identity、上限および非公開条件を宣言する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 読取り助言結果の固定契約。
 * @precondition N/A: 定数だけを参照する。
 * @postcondition 実装と試験が同じ上限を参照できる。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant 生Provider出力を公開しない。
 * @boundary N/A: 契約説明で外部境界を開かない。
 * @security rawOutputReportedは常にfalseである。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function describeAdviceResultContract() {
  return Object.freeze({
    contract: PROVIDER_ADVICE_RESULT_CONTRACT,
    contractRevision: PROVIDER_ADVICE_RESULT_CONTRACT_REVISION,
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    maximumItemsPerSection: MAXIMUM_ITEMS_PER_SECTION,
    maximumReferencesPerItem: MAXIMUM_REFERENCES_PER_ITEM,
    duplicateKeysAllowed: false,
    outOfProjectionReferencesAllowed: false,
    rawOutputReported: false,
  });
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるinspectAllowedReferencesの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function inspectAllowedReferences(
  values: readonly string[],
): ReadonlySet<string> | null {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > 1_024 ||
    values.some(
      (reference) => !validString(reference, MAXIMUM_REFERENCE_BYTES),
    ) ||
    new Set(values).size !== values.length
  )
    return null;
  return new Set(values);
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるinspectItemsの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function inspectItems(
  value: unknown,
  allowedReferences: ReadonlySet<string>,
): readonly CoordinatorAiResultItem[] | null {
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS_PER_SECTION)
    return null;
  const items: CoordinatorAiResultItem[] = [];
  for (const item of value) {
    if (
      !isExactRecord(item, itemKeys) ||
      !validString(item.text, MAXIMUM_TEXT_BYTES) ||
      !Array.isArray(item.references) ||
      item.references.length === 0 ||
      item.references.length > MAXIMUM_REFERENCES_PER_ITEM ||
      item.references.some(
        (reference) =>
          !validString(reference, MAXIMUM_REFERENCE_BYTES) ||
          !allowedReferences.has(reference),
      ) ||
      new Set(item.references).size !== item.references.length
    )
      return null;
    items.push(
      Object.freeze({
        text: item.text,
        references: Object.freeze([...item.references] as string[]),
      }),
    );
  }
  return Object.freeze(items);
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるadviceResultRejectedの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function adviceResultRejected(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    normalizedResult: null,
    rawOutputReported: false as const,
  });
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるisExactRecordの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function isExactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => key in value);
}

const adviceResultSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({
    contract: Object.freeze({
      const: "crdd-coordinator/workbench-ai-advice-result",
    }),
    contractRevision: Object.freeze({ const: 1 }),
    status: Object.freeze({ const: "completed" }),
    facts: itemArraySchema(),
    sharedAnalysis: itemArraySchema(),
    additionalInferences: itemArraySchema(),
    nextOptions: itemArraySchema(),
  }),
  required: Object.freeze([
    "contract",
    "contractRevision",
    "status",
    "facts",
    "sharedAnalysis",
    "additionalInferences",
    "nextOptions",
  ]),
  additionalProperties: false,
});

/**
 * Providerの出力制約へ渡す共通助言結果Schemaを公開する。
 *
 * @responsibility 四区分の結果意味と項目制約をCoordinatorで所有し、ProviderのCLI計画には中立な値として渡す。
 * @trace ARCH-000015
 * @input N/A: 現行の固定結果契約を投影する。
 * @returns 不変な助言結果JSON Schema。
 * @precondition N/A: Authorityや外部入力を要求しない。
 * @postcondition 共通Normalizerと同じ結果契約・改訂・四区分を保持する。
 * @effect N/A: 固定Objectを返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Provider差によって結果の意味を変更しない。
 * @boundary Coordinatorの意味契約とAI AdapterのCLI出力制約の間。
 * @security 許可参照集合の最終確認はCoordinatorに残す。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeAdviceResultSchema() {
  return adviceResultSchema;
}

/**
 * 助言項目配列のJSON Schemaを生成する。
 *
 * @responsibility 四区分で共通利用する本文と根拠参照の閉じたSchemaを一か所で所有する。
 * @trace ARCH-000015
 * @input N/A: 固定Schemaだけを生成する。
 * @returns 助言項目配列のJSON Schema。
 * @precondition N/A: 呼出し条件を持たない。
 * @postcondition 余分Property、空参照および過大配列を許可しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Result Normalizerより強い意味主張を追加しない。
 * @boundary ProviderのSchema制約とCoordinatorの最終検証の間。
 * @security 参照の許可集合確認はProviderでなくCoordinatorが所有する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function itemArraySchema() {
  return Object.freeze({
    type: "array",
    maxItems: 64,
    items: Object.freeze({
      type: "object",
      properties: Object.freeze({
        text: Object.freeze({ type: "string", minLength: 1, maxLength: 8192 }),
        references: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: 16,
          uniqueItems: true,
          items: Object.freeze({
            type: "string",
            minLength: 1,
            maxLength: 512,
          }),
        }),
      }),
      required: Object.freeze(["text", "references"]),
      additionalProperties: false,
    }),
  });
}
