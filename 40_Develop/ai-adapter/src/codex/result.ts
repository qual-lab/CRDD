/**
 * Codexのboolean Probe結果を限定条件で解析する。
 *
 * @responsibility Codexのboolean Probe出力を単一JSON・容量・exact status条件で解析し、確認と拒否を区別する。
 * @trace ARCH-000015
 */
import { parseUnambiguousJsonDocument } from "../provider/json.ts";

export const CODEX_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/codex-structured-result";
export const CODEX_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

/**
 * Codex Probe解析の拒否値を生成する。
 *
 * @responsibility 確認不能と確認成功の区別を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定理由付きblocked。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 拒否値を構築する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked() {
  return Object.freeze({
    status: "blocked" as const,
    normalizedResult: null,
    rawOutputReported: false,
  });
}

/**
 * Codexのboolean Probe結果を正規化する。
 *
 * @responsibility 16KiB以内の単一JSONとstatus=trueの照合を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns confirmedの最小結果又はblocked。
 * @precondition rawを未信頼値として文字列・容量・JSON形を本処理で検査する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: normalizeCodexStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 非文字列、容量超過、曖昧JSON、余剰field、falseを拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security normalizeCodexStructuredResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeCodexStructuredResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeCodexStructuredResult(raw: unknown) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 16_384) {
    return blocked();
  }
  const value = parseUnambiguousJsonDocument(raw);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== 1 ||
    !Object.hasOwn(value, "status") ||
    (value as { status?: unknown }).status !== true
  ) {
    return blocked();
  }
  return Object.freeze({
    status: "confirmed" as const,
    normalizedResult: Object.freeze({ status: true as const }),
    rawOutputReported: false,
  });
}

/**
 * Codex Probe結果の受理条件を記述する。
 *
 * @responsibility 容量と単一JSONの診断契約を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定のProbe結果契約。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: describeCodexStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 固定宣言を返す。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security describeCodexStructuredResultContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCodexStructuredResultContractは共有非同期状態を持たない同期処理である。
 */
export function describeCodexStructuredResultContract() {
  return Object.freeze({
    contract: CODEX_STRUCTURED_RESULT_CONTRACT,
    contractRevision: CODEX_STRUCTURED_RESULT_CONTRACT_REVISION,
    envelope: "single_unambiguous_json_document",
    duplicateKeysAllowed: false,
    normalizedResult: Object.freeze({ status: true as const }),
    maximumBytes: 16_384,
    rawOutputReported: false,
  });
}
