/**
 * release-identity-grammarに属する責務をまとめる。
 *
 * @responsibility isCanonicalCrddGitObjectIdを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
export const RELEASE_IDENTITY_GRAMMAR_CONTRACT =
  "crdd-coordinator/release-identity-grammar";
export const RELEASE_IDENTITY_GRAMMAR_CONTRACT_REVISION = 1;

const CRDD_GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_RUNTIME_GIT_OBJECT_ID = /^[0-9a-f]{40}$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const CRDD_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/**
 * Canonical Crdd Git Object Idかを判定する。
 *
 * @responsibility Canonical Crdd Git Object Idの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisCanonicalCrddGitObjectIdの入力契約を満たす。
 * @postcondition isCanonicalCrddGitObjectIdの責務を完了した結果だけを返す。
 * @effect N/A: isCanonicalCrddGitObjectIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCanonicalCrddGitObjectIdは独自の失敗分岐を所有しない。
 * @invariant isCanonicalCrddGitObjectIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCanonicalCrddGitObjectIdはProcess内の同一Subsystemで完結する。
 * @security isCanonicalCrddGitObjectIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isCanonicalCrddGitObjectIdは共有非同期状態を持たない同期処理である。
 */
export function isCanonicalCrddGitObjectId(value: unknown): value is string {
  return typeof value === "string" && CRDD_GIT_OBJECT_ID.test(value);
}

/**
 * Supported Crdd Runtime Git Object Idかを判定する。
 *
 * @responsibility Supported Crdd Runtime Git Object Idの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedCrddRuntimeGitObjectIdの入力契約を満たす。
 * @postcondition isSupportedCrddRuntimeGitObjectIdの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedCrddRuntimeGitObjectIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedCrddRuntimeGitObjectIdは独自の失敗分岐を所有しない。
 * @invariant isSupportedCrddRuntimeGitObjectIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedCrddRuntimeGitObjectIdはProcess内の同一Subsystemで完結する。
 * @security isSupportedCrddRuntimeGitObjectIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedCrddRuntimeGitObjectIdは共有非同期状態を持たない同期処理である。
 */
export function isSupportedCrddRuntimeGitObjectId(
  value: unknown,
): value is string {
  return typeof value === "string" && CRDD_RUNTIME_GIT_OBJECT_ID.test(value);
}

/**
 * Canonical Crdd Versionかを判定する。
 *
 * @responsibility Canonical Crdd Versionの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisCanonicalCrddVersionの入力契約を満たす。
 * @postcondition isCanonicalCrddVersionの責務を完了した結果だけを返す。
 * @effect N/A: isCanonicalCrddVersionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCanonicalCrddVersionは独自の失敗分岐を所有しない。
 * @invariant isCanonicalCrddVersionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCanonicalCrddVersionはProcess内の同一Subsystemで完結する。
 * @security isCanonicalCrddVersionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isCanonicalCrddVersionは共有非同期状態を持たない同期処理である。
 */
export function isCanonicalCrddVersion(value: unknown): value is string {
  return typeof value === "string" && CRDD_VERSION.test(value);
}

/**
 * Canonical Crdd Utc Timestampかを判定する。
 *
 * @responsibility Canonical Crdd Utc Timestampの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisCanonicalCrddUtcTimestampの入力契約を満たす。
 * @postcondition isCanonicalCrddUtcTimestampの責務を完了した結果だけを返す。
 * @effect N/A: isCanonicalCrddUtcTimestampは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCanonicalCrddUtcTimestampは独自の失敗分岐を所有しない。
 * @invariant isCanonicalCrddUtcTimestampは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCanonicalCrddUtcTimestampはProcess内の同一Subsystemで完結する。
 * @security isCanonicalCrddUtcTimestampはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isCanonicalCrddUtcTimestampは共有非同期状態を持たない同期処理である。
 */
export function isCanonicalCrddUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    CRDD_UTC_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

/**
 * Release Identity Grammar 契約の公開契約を記述する。
 *
 * @responsibility Release Identity Grammar 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeReleaseIdentityGrammarContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeReleaseIdentityGrammarContractの入力契約を満たす。
 * @postcondition describeReleaseIdentityGrammarContractの責務を完了した結果だけを返す。
 * @effect N/A: describeReleaseIdentityGrammarContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeReleaseIdentityGrammarContractは独自の失敗分岐を所有しない。
 * @invariant describeReleaseIdentityGrammarContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeReleaseIdentityGrammarContractはProcess内の同一Subsystemで完結する。
 * @security describeReleaseIdentityGrammarContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeReleaseIdentityGrammarContractは共有非同期状態を持たない同期処理である。
 */
export function describeReleaseIdentityGrammarContract() {
  return Object.freeze({
    contract: RELEASE_IDENTITY_GRAMMAR_CONTRACT,
    contractRevision: RELEASE_IDENTITY_GRAMMAR_CONTRACT_REVISION,
    gitObjectIdHexLengths: Object.freeze([40, 64]),
    runtimeSupportedGitObjectIdHexLengths: Object.freeze([40]),
    unsupportedRuntimeObjectFormatResult:
      "fail_closed_before_secret_input_or_effect",
    prereleaseVersionAllowed: true,
    utcTimestampMillisecondsRequired: true,
    callerExtensionAllowed: false,
  });
}
