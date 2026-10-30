/**
 * Claudeのboolean Probe結果を限定条件で解析する。
 *
 * @responsibility 共通JSON解析を利用し、Claude固有Envelopeの成立条件と結果分類を所有する。
 * @trace ARCH-000015
 */
import { parseUnambiguousJsonDocument } from "../provider/json.ts";

export const CLAUDE_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/claude-structured-result";
export const CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION = 2;

const MAXIMUM_API_EQUIVALENT_COST_USD = 0.1;

/**
 * JSON値のObject形を確認する。
 *
 * @responsibility 非null・非配列Objectの判定を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns Record候補かの真偽値。
 * @precondition valueは任意のJSON解析結果である。Object形だけを判定する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不一致をfalseとする。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security isRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * JSON解析済み値から自身のPropertyを取得する。
 *
 * @responsibility 厳密JSON parserが生成した値から、自身に属するfieldだけを取得する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>、key: string
 * @returns 所有データ値又はundefined。
 * @precondition valueはparseUnambiguousJsonDocumentで生成した値であり、Proxy／accessorを含まない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 未所有Propertyをundefinedとして返す。任意ObjectのGetter回避は所有しない。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: Record<string, unknown>, key: string) {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

/**
 * Claude Probe解析の拒否値を生成する。
 *
 * @responsibility 確認不能と確認成功の区別を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定理由付きblocked。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: createBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 拒否値を構築する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
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
 * Claudeのboolean Probe結果を正規化する。
 *
 * @responsibility 単一JSON成功Envelope、Turn metadata・費用相当上限、status=trueの照合を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns confirmedの最小結果又はblocked。
 * @precondition rawを未信頼値として文字列とJSON Envelopeを本処理で検査する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: normalizeClaudeStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 曖昧JSON、不正Envelope、上限超過、falseを拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
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
    !Number.isSafeInteger(numberOfTurns) ||
    typeof numberOfTurns !== "number" ||
    numberOfTurns < 1 ||
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
 * Claude Probe結果の受理条件を記述する。
 *
 * @responsibility 単一JSONとTurn metadata・費用相当上限の診断契約を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定のProbe結果契約。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: describeClaudeStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 固定宣言を返す。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
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
      "num_turns=positive_safe_integer_metadata",
      "total_cost_usd=finite_0_to_0.10",
      "structured_output=exact_status_true",
    ]),
    normalizedResult: Object.freeze({ status: true }),
    rawOutputReported: false,
  });
}
