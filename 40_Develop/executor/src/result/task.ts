/**
 * Provider解析とDomainのTask内容検査を単段結果へ接続する。
 * @packageDocumentation
 * @responsibility Envelope・内容・実行観測の結果を結合し、是正許可を発行しない。
 * @trace ARCH-000015
 * @boundary Provider結果と呼出し元の受入の間。
 */
import type { NormalizedProviderResult } from "./types.ts";
import { inspectTaskResultContent } from "../../../domain-model/src/index.ts";
import {
  evaluateProviderTaskScope,
  parseProviderResult,
} from "../../../ai-adapter/src/index.ts";
import { PROVIDER_RESULT_MAXIMUM_RAW_BYTES as MAXIMUM_RAW_BYTES } from "./validation.ts";

export const TASK_RESULT_CONTRACT =
  "crdd-coordinator/provider-task-structured-result";

export const TASK_RESULT_CONTRACT_REVISION = 20;

/**
 * Provider Task Structured 結果を固定Schemaへ正規化する。
 *
 * @responsibility Provider Task Structured 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input provider: unknown、taskRole: unknown、selectedEffort: unknown、raw: unknown、taskWorkload: unknown
 * @returns confirmed時のRole別結果又は固定理由付きblocked。拒否では内容を返さない。
 * @precondition 未信頼値を受け取り、Provider・Role・推論設定・容量・作業量を検査する。
 * @postcondition Envelope・Role別内容が成立した場合だけ正規形を返す。
 * @effect N/A: 解析結果の値を結合するのみ。
 * @failure 不正入力・Envelope・形・所見・Path・容量を固定理由で拒否する。
 * @invariant 是正許可は固定Hostを通じCoordinatorが所有する。
 * @boundary 未信頼Provider出力から上位で扱う型付き結果への境界。
 * @security normalizeTaskResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeTaskResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeTaskResult(
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
  const result = inspectTaskResultContent(value, taskRole);
  return (
    result.normalizedResult
      ? Object.freeze({
          status: "confirmed" as const,
          provider,
          taskRole,
          reviewFindings:
            "reviewFindings" in result ? result.reviewFindings : null,
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
        })
  ) satisfies NormalizedProviderResult<unknown>;
}

/**
 * Provider Task Structured 結果 契約の公開契約を記述する。
 *
 * @responsibility Provider Task Structured 結果 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeTaskResultContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeTaskResultContractの入力契約を満たす。
 * @postcondition describeTaskResultContractの責務を完了した結果だけを返す。
 * @effect N/A: describeTaskResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeTaskResultContractは独自の失敗分岐を所有しない。
 * @invariant describeTaskResultContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeTaskResultContractはProcess内の同一Subsystemで完結する。
 * @security describeTaskResultContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeTaskResultContractは共有非同期状態を持たない同期処理である。
 */
export function describeTaskResultContract() {
  return Object.freeze({
    contract: TASK_RESULT_CONTRACT,
    contractRevision: TASK_RESULT_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"]),
    roles: Object.freeze(["executor", "reviewer"]),
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    acceptedClaudeTurnObservation:
      "requested_cli_limit_and_reported_metadata_without_comparison",
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
      "issued_by_coordinator_host_after_cleanup_not_by_content_normalizer",
    reviewerMessageForwardedToExecutor:
      "bounded_untrusted_defect_claim_after_secret_screening",
    credentialAbsenceVerified: false,
  });
}
