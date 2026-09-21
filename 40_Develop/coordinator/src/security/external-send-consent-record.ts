/**
 * external-send-consent-recordに属する責務をまとめる。
 *
 * @responsibility exactKeysを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
export const EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX =
  "external-send-consent-active-v2-";
export const EXTERNAL_SEND_CONSENT_SCHEMA =
  "crdd-coordinator/external-send-consent/v2";
export const EXTERNAL_SEND_RUNTIME_SEMANTICS_ID =
  "bounded-reviewer-defect-claim-transfer-v1";
export const EXTERNAL_SEND_CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000;

const HEX64 = /^[a-f0-9]{64}$/u;
const GENERATION = /^[a-f0-9]{16}$/u;
const ACTIVE_ENTRY =
  /^external-send-consent-active-v2-([a-f0-9]{64})-([a-f0-9]{16})\.json(\.crdd-commit\.json)?$/u;
const RECORD_KEYS = Object.freeze([
  "schema",
  "consentBoundaryHash",
  "policyId",
  "sourceFileHash",
  "runtimeExternalSendSemanticsId",
  "informationClassification",
  "providerBoundaries",
  "localUserBindingHash",
  "runtimeStateIdentityHash",
  "runtimeStateProtectionHash",
  "runtimeStateBindingHash",
  "apiKeyFallbackAllowed",
  "additionalPurchaseAllowed",
  "generation",
  "confirmedAtEpochMs",
  "expiresAtEpochMs",
]);

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: unknown、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

/**
 * External Send Consent Active Entry Nameを構造化値へ解析する。
 *
 * @responsibility External Send Consent Active Entry Nameの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns parseExternalSendConsentActiveEntryNameの計算結果を返す。
 * @precondition 「value: unknown」がparseExternalSendConsentActiveEntryNameの入力契約を満たす。
 * @postcondition parseExternalSendConsentActiveEntryNameの責務を完了した結果だけを返す。
 * @effect N/A: parseExternalSendConsentActiveEntryNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseExternalSendConsentActiveEntryNameは独自の失敗分岐を所有しない。
 * @invariant parseExternalSendConsentActiveEntryNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseExternalSendConsentActiveEntryNameはProcess内の同一Subsystemで完結する。
 * @security parseExternalSendConsentActiveEntryNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseExternalSendConsentActiveEntryNameは共有非同期状態を持たない同期処理である。
 */
export function parseExternalSendConsentActiveEntryName(value: unknown) {
  if (typeof value !== "string") return null;
  const match = ACTIVE_ENTRY.exec(value);
  if (!match?.[1] || !match[2]) return null;
  const recordName = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${match[1]}-${match[2]}.json`;
  return Object.freeze({
    recordName,
    boundaryHash: match[1],
    generation: match[2],
    entryKind: match[3] ? ("commit" as const) : ("record" as const),
  });
}

/**
 * external Send Consent Active 記録 Nameを決定する。
 *
 * @responsibility external Send Consent Active 記録 Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input boundaryHash: unknown、generation: unknown
 * @returns externalSendConsentActiveRecordNameの計算結果を返す。
 * @precondition 「boundaryHash: unknown、generation: unknown」がexternalSendConsentActiveRecordNameの入力契約を満たす。
 * @postcondition externalSendConsentActiveRecordNameの責務を完了した結果だけを返す。
 * @effect N/A: externalSendConsentActiveRecordNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: externalSendConsentActiveRecordNameは独自の失敗分岐を所有しない。
 * @invariant externalSendConsentActiveRecordNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: externalSendConsentActiveRecordNameはProcess内の同一Subsystemで完結する。
 * @security externalSendConsentActiveRecordNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: externalSendConsentActiveRecordNameは共有非同期状態を持たない同期処理である。
 */
export function externalSendConsentActiveRecordName(
  boundaryHash: unknown,
  generation: unknown,
) {
  return typeof boundaryHash === "string" &&
    HEX64.test(boundaryHash) &&
    typeof generation === "string" &&
    GENERATION.test(generation)
    ? `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${boundaryHash}-${generation}.json`
    : null;
}

/**
 * External Send Consent 記録 Shapeかを判定する。
 *
 * @responsibility External Send Consent 記録 Shapeの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns isExternalSendConsentRecordShapeの計算結果を返す。
 * @precondition 「value: unknown」がisExternalSendConsentRecordShapeの入力契約を満たす。
 * @postcondition isExternalSendConsentRecordShapeの責務を完了した結果だけを返す。
 * @effect N/A: isExternalSendConsentRecordShapeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExternalSendConsentRecordShapeは独自の失敗分岐を所有しない。
 * @invariant isExternalSendConsentRecordShapeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExternalSendConsentRecordShapeはProcess内の同一Subsystemで完結する。
 * @security isExternalSendConsentRecordShapeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isExternalSendConsentRecordShapeは共有非同期状態を持たない同期処理である。
 */
export function isExternalSendConsentRecordShape(value: unknown) {
  if (!exactKeys(value, RECORD_KEYS)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.schema === EXTERNAL_SEND_CONSENT_SCHEMA &&
    typeof record.consentBoundaryHash === "string" &&
    HEX64.test(record.consentBoundaryHash) &&
    typeof record.policyId === "string" &&
    record.policyId.length > 0 &&
    typeof record.sourceFileHash === "string" &&
    HEX64.test(record.sourceFileHash) &&
    record.runtimeExternalSendSemanticsId ===
      EXTERNAL_SEND_RUNTIME_SEMANTICS_ID &&
    typeof record.informationClassification === "string" &&
    Array.isArray(record.providerBoundaries) &&
    typeof record.localUserBindingHash === "string" &&
    HEX64.test(record.localUserBindingHash) &&
    typeof record.runtimeStateIdentityHash === "string" &&
    HEX64.test(record.runtimeStateIdentityHash) &&
    typeof record.runtimeStateProtectionHash === "string" &&
    HEX64.test(record.runtimeStateProtectionHash) &&
    typeof record.runtimeStateBindingHash === "string" &&
    HEX64.test(record.runtimeStateBindingHash) &&
    record.apiKeyFallbackAllowed === false &&
    record.additionalPurchaseAllowed === false &&
    typeof record.generation === "string" &&
    GENERATION.test(record.generation) &&
    typeof record.confirmedAtEpochMs === "number" &&
    Number.isSafeInteger(record.confirmedAtEpochMs) &&
    typeof record.expiresAtEpochMs === "number" &&
    Number.isSafeInteger(record.expiresAtEpochMs) &&
    record.expiresAtEpochMs ===
      record.confirmedAtEpochMs + EXTERNAL_SEND_CONSENT_LIFETIME_MS
  );
}
