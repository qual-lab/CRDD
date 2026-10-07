/**
 * claude-structured-resultに属する責務をまとめる。
 *
 * @responsibility 共通JSON解析を利用し、Claude固有Envelopeの成立条件と結果分類を所有する。
 * @trace ARCH-000015
 */
import { parseUnambiguousJsonDocument } from "../output/index.ts";

export const CLAUDE_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/claude-structured-result";
export const CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_TURNS = 2;
const MAXIMUM_API_EQUIVALENT_COST_USD = 0.1;

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
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>、key: string
 * @returns ownValueの計算結果を返す。
 * @precondition 「value: Record<string, unknown>、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: Record<string, unknown>, key: string) {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

/**
 * Blocked 結果を構築する。
 *
 * @responsibility Blocked 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns createBlockedResultの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateBlockedResultの入力契約を満たす。
 * @postcondition createBlockedResultの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedResultは独自の失敗分岐を所有しない。
 * @invariant createBlockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedResultはProcess内の同一Subsystemで完結する。
 * @security createBlockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedResultは共有非同期状態を持たない同期処理である。
 */
function createBlockedResult() {
  return Object.freeze({
    status: "blocked" as const,
    reason: "claude_structured_result_invalid",
    normalizedResult: null,
    numberOfTurns: null,
    providerReportedApiEquivalentCostUsd: null,
  });
}

/**
 * Claude Structured 結果を固定Schemaへ正規化する。
 *
 * @responsibility Claude Structured 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns normalizeClaudeStructuredResultの計算結果を返す。
 * @precondition 「raw: unknown」がnormalizeClaudeStructuredResultの入力契約を満たす。
 * @postcondition normalizeClaudeStructuredResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeClaudeStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeClaudeStructuredResultは独自の失敗分岐を所有しない。
 * @invariant normalizeClaudeStructuredResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeClaudeStructuredResultはProcess内の同一Subsystemで完結する。
 * @security normalizeClaudeStructuredResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeClaudeStructuredResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeClaudeStructuredResult(raw: unknown) {
  if (typeof raw !== "string") return createBlockedResult();
  const envelope = parseUnambiguousJsonDocument(raw);
  if (!isRecord(envelope)) return createBlockedResult();
  const numberOfTurns = ownValue(envelope, "num_turns");
  const providerReportedApiEquivalentCostUsd = ownValue(
    envelope,
    "total_cost_usd",
  );
  const structuredOutput = ownValue(envelope, "structured_output");
  if (
    ownValue(envelope, "type") !== "result" ||
    ownValue(envelope, "subtype") !== "success" ||
    ownValue(envelope, "is_error") !== false ||
    !Number.isInteger(numberOfTurns) ||
    typeof numberOfTurns !== "number" ||
    numberOfTurns < 1 ||
    numberOfTurns > MAXIMUM_TURNS ||
    typeof providerReportedApiEquivalentCostUsd !== "number" ||
    !Number.isFinite(providerReportedApiEquivalentCostUsd) ||
    providerReportedApiEquivalentCostUsd < 0 ||
    providerReportedApiEquivalentCostUsd > MAXIMUM_API_EQUIVALENT_COST_USD ||
    !isRecord(structuredOutput) ||
    Object.keys(structuredOutput).length !== 1 ||
    ownValue(structuredOutput, "status") !== true
  ) {
    return createBlockedResult();
  }
  return Object.freeze({
    status: "confirmed" as const,
    reason: "claude_structured_result_confirmed",
    normalizedResult: Object.freeze({ status: true as const }),
    numberOfTurns,
    providerReportedApiEquivalentCostUsd,
  });
}

/**
 * Claude Structured 結果 契約の公開契約を記述する。
 *
 * @responsibility Claude Structured 結果 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeClaudeStructuredResultContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeClaudeStructuredResultContractの入力契約を満たす。
 * @postcondition describeClaudeStructuredResultContractの責務を完了した結果だけを返す。
 * @effect N/A: describeClaudeStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeClaudeStructuredResultContractは独自の失敗分岐を所有しない。
 * @invariant describeClaudeStructuredResultContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeClaudeStructuredResultContractはProcess内の同一Subsystemで完結する。
 * @security describeClaudeStructuredResultContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeClaudeStructuredResultContractは共有非同期状態を持たない同期処理である。
 */
export function describeClaudeStructuredResultContract() {
  return Object.freeze({
    contract: CLAUDE_STRUCTURED_RESULT_CONTRACT,
    contractRevision: CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION,
    envelope: "single_unambiguous_json_document",
    duplicateKeysAllowed: false,
    requiredEnvelopeFields: Object.freeze([
      "type=result",
      "subtype=success",
      "is_error=false",
      "num_turns=integer_1_to_2",
      "total_cost_usd=finite_0_to_0.10",
      "structured_output=exact_status_true",
    ]),
    normalizedResult: Object.freeze({ status: true }),
    rawOutputReported: false,
  });
}
