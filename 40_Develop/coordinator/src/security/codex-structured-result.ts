import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const CODEX_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/codex-structured-result";
export const CODEX_STRUCTURED_RESULT_CONTRACT_REVISION = 1;

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns blockedの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
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
 * normalizeCodexStructuredResultの処理を実行する。
 *
 * @responsibility normalizeCodexStructuredResultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns normalizeCodexStructuredResultの計算結果を返す。
 * @precondition 「raw: unknown」がnormalizeCodexStructuredResultの入力契約を満たす。
 * @postcondition normalizeCodexStructuredResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeCodexStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeCodexStructuredResultは独自の失敗分岐を所有しない。
 * @invariant normalizeCodexStructuredResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeCodexStructuredResultはProcess内の同一Subsystemで完結する。
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
 * describeCodexStructuredResultContractの処理を実行する。
 *
 * @responsibility describeCodexStructuredResultContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCodexStructuredResultContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCodexStructuredResultContractの入力契約を満たす。
 * @postcondition describeCodexStructuredResultContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCodexStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCodexStructuredResultContractは独自の失敗分岐を所有しない。
 * @invariant describeCodexStructuredResultContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCodexStructuredResultContractはProcess内の同一Subsystemで完結する。
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
