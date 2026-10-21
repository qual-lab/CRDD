/**
 * verification-safetyに属する責務をまとめる。
 *
 * @responsibility 検証結果の閉じた安全投影と、検証Scriptで使用するRelease Identityの値文法を所有する。
 * @trace ARCH-000014
 */
import { types as utilTypes } from "node:util";

import { snapshotPlainArray } from "../../domain-model/src/index.ts";

/**
 * verification-safetyで使用する検証結果 Safety Schemaの値契約を定義する。
 *
 * @responsibility 検証結果 Safety SchemaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape VerificationSafetySchemaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerificationSafetySchemaで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerificationSafetySchemaの宣言は外部境界を開かない。
 * @security VerificationSafetySchemaはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerificationSafetySchemaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerificationSafetySchema = Readonly<{
  booleanFields: readonly string[];
  nullableRecoveryFields: readonly Readonly<{
    field: string;
    kind: VerificationRecoveryKind;
  }>[];
  recoveryPairs: readonly Readonly<{
    singularField: string;
    pluralField: string;
    kind: VerificationRecoveryKind;
  }>[];
  effectUnknownField?: string;
}>;

/**
 * verification-safetyで使用する検証結果 回復 Kindの値契約を定義する。
 *
 * @responsibility 検証結果 回復 KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape VerificationRecoveryKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerificationRecoveryKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerificationRecoveryKindの宣言は外部境界を開かない。
 * @security VerificationRecoveryKindはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerificationRecoveryKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerificationRecoveryKind =
  | "host"
  | "docker"
  | "candidate"
  | "candidate_store";

/**
 * verification-safetyで使用する検証結果 Safety Observationの値契約を定義する。
 *
 * @responsibility 検証結果 Safety ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape VerificationSafetyObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerificationSafetyObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerificationSafetyObservationの宣言は外部境界を開かない。
 * @security VerificationSafetyObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerificationSafetyObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerificationSafetyObservation = Readonly<{
  status: "exact" | "unknown";
  booleans: Readonly<Record<string, boolean>> | null;
  recoveryIds: readonly string[];
}>;

const MAXIMUM_RECOVERY_IDS = 128;
const MAXIMUM_RECOVERY_ID_LENGTH = 1024;
const RECOVERY_ID_PATTERNS: Readonly<Record<VerificationRecoveryKind, RegExp>> =
  Object.freeze({
    host: /^host\.[A-Za-z0-9_-]{1,128}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/u,
    docker: /^docker-task\.[0-9a-f]{64}\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
    candidate: /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
    candidate_store: /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  });

/**
 * Canonical 検証結果 回復 Idかを判定する。
 *
 * @responsibility Canonical 検証結果 回復 Idの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、kind: VerificationRecoveryKind
 * @returns value is stringを返す。
 * @precondition 「value: unknown、kind: VerificationRecoveryKind」がisCanonicalVerificationRecoveryIdの入力契約を満たす。
 * @postcondition isCanonicalVerificationRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: isCanonicalVerificationRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCanonicalVerificationRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant isCanonicalVerificationRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCanonicalVerificationRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security isCanonicalVerificationRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isCanonicalVerificationRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function isCanonicalVerificationRecoveryId(
  value: unknown,
  kind: VerificationRecoveryKind,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_RECOVERY_ID_LENGTH &&
    RECOVERY_ID_PATTERNS[kind].test(value)
  );
}

/**
 * own Data Valueを決定する。
 *
 * @responsibility own Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input record: object、field: string
 * @returns ownDataValueの計算結果を返す。
 * @precondition 「record: object、field: string」がownDataValueの入力契約を満たす。
 * @postcondition ownDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataValueは独自の失敗分岐を所有しない。
 * @invariant ownDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownDataValueはProcess内の同一Subsystemで完結する。
 * @security ownDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataValueは共有非同期状態を持たない同期処理である。
 */
function ownDataValue(record: object, field: string) {
  const descriptor = Object.getOwnPropertyDescriptor(record, field);
  return descriptor &&
    Object.hasOwn(descriptor, "value") &&
    descriptor.get === undefined &&
    descriptor.set === undefined &&
    descriptor.enumerable === true
    ? Object.freeze({ status: "exact" as const, value: descriptor.value })
    : Object.freeze({ status: "unknown" as const, value: null });
}

/**
 * salvage 検証結果 Nullable 回復を決定する。
 *
 * @responsibility salvage 検証結果 Nullable 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、field: string、kind: VerificationRecoveryKind
 * @returns salvageVerificationNullableRecoveryの計算結果を返す。
 * @precondition 「value: unknown、field: string、kind: VerificationRecoveryKind」がsalvageVerificationNullableRecoveryの入力契約を満たす。
 * @postcondition salvageVerificationNullableRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: salvageVerificationNullableRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure salvageVerificationNullableRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant salvageVerificationNullableRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: salvageVerificationNullableRecoveryはProcess内の同一Subsystemで完結する。
 * @security salvageVerificationNullableRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: salvageVerificationNullableRecoveryは共有非同期状態を持たない同期処理である。
 */
export function salvageVerificationNullableRecovery(
  value: unknown,
  field: string,
  kind: VerificationRecoveryKind,
) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      throw new Error("recovery_record_invalid");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("recovery_record_invalid");
    const observed = ownDataValue(value, field);
    if (observed.status !== "exact")
      return Object.freeze({ id: null, ambiguous: true });
    if (observed.value === null)
      return Object.freeze({ id: null, ambiguous: false });
    if (isCanonicalVerificationRecoveryId(observed.value, kind))
      return Object.freeze({ id: observed.value, ambiguous: false });
    return Object.freeze({ id: null, ambiguous: true });
  } catch {
    return Object.freeze({ id: null, ambiguous: true });
  }
}

/**
 * salvage 検証結果 回復 Pairを決定する。
 *
 * @responsibility salvage 検証結果 回復 Pairの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、pair: Readonly<{ singularField: string; pluralField: string; kind: VerificationRecoveryKind; }>
 * @returns salvageVerificationRecoveryPairの計算結果を返す。
 * @precondition 「value: unknown、pair: Readonly<{ singularField: string; pluralField: string; kind: VerificationRecoveryKind; }>」がsalvageVerificationRecoveryPairの入力契約を満たす。
 * @postcondition salvageVerificationRecoveryPairの責務を完了した結果だけを返す。
 * @effect N/A: salvageVerificationRecoveryPairは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure salvageVerificationRecoveryPairは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant salvageVerificationRecoveryPairは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: salvageVerificationRecoveryPairはProcess内の同一Subsystemで完結する。
 * @security salvageVerificationRecoveryPairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: salvageVerificationRecoveryPairは共有非同期状態を持たない同期処理である。
 */
export function salvageVerificationRecoveryPair(
  value: unknown,
  pair: Readonly<{
    singularField: string;
    pluralField: string;
    kind: VerificationRecoveryKind;
  }>,
) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      throw new Error("recovery_record_invalid");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("recovery_record_invalid");
    const singular = ownDataValue(value, pair.singularField);
    const pluralObserved = ownDataValue(value, pair.pluralField);
    let isAmbiguous =
      singular.status !== "exact" || pluralObserved.status !== "exact";
    const ids: string[] = [];
    if (singular.status === "exact") {
      if (isCanonicalVerificationRecoveryId(singular.value, pair.kind))
        ids.push(singular.value);
      else if (singular.value !== null) isAmbiguous = true;
    }
    if (pluralObserved.status === "exact") {
      const plural = snapshotPlainArray<unknown>(
        pluralObserved.value,
        MAXIMUM_RECOVERY_IDS,
      );
      if (plural.status !== "ok") isAmbiguous = true;
      else {
        for (const item of plural.value) {
          if (isCanonicalVerificationRecoveryId(item, pair.kind))
            ids.push(item);
          else isAmbiguous = true;
        }
        if (new Set(plural.value).size !== plural.value.length)
          isAmbiguous = true;
      }
    }
    const uniqueItems = [...new Set(ids)];
    if (uniqueItems.length > MAXIMUM_RECOVERY_IDS) isAmbiguous = true;
    const boundedItems = Object.freeze(
      uniqueItems.slice(0, MAXIMUM_RECOVERY_IDS),
    );
    if (
      singular.status === "exact" &&
      pluralObserved.status === "exact" &&
      ((boundedItems.length === 0 && singular.value !== null) ||
        (boundedItems.length === 1 && singular.value !== boundedItems[0]) ||
        (boundedItems.length > 1 && singular.value !== null))
    )
      isAmbiguous = true;
    return Object.freeze({
      singular: boundedItems.length === 1 ? (boundedItems[0] ?? null) : null,
      plural: boundedItems,
      ambiguous: isAmbiguous,
    });
  } catch {
    return Object.freeze({
      singular: null,
      plural: Object.freeze([]) as readonly string[],
      ambiguous: true,
    });
  }
}

/**
 * 検証結果 Safety Observationを評価する。
 *
 * @responsibility 検証結果 Safety Observationの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、schema: VerificationSafetySchema
 * @returns VerificationSafetyObservationを返す。
 * @precondition 「value: unknown、schema: VerificationSafetySchema」がevaluateVerificationSafetyObservationの入力契約を満たす。
 * @postcondition evaluateVerificationSafetyObservationの責務を完了した結果だけを返す。
 * @effect N/A: evaluateVerificationSafetyObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateVerificationSafetyObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateVerificationSafetyObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateVerificationSafetyObservationはProcess内の同一Subsystemで完結する。
 * @security evaluateVerificationSafetyObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateVerificationSafetyObservationは共有非同期状態を持たない同期処理である。
 */
export function evaluateVerificationSafetyObservation(
  value: unknown,
  schema: VerificationSafetySchema,
): VerificationSafetyObservation {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      throw new Error("safety_observation_record_invalid");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("safety_observation_record_invalid");

    const booleans: Record<string, boolean> = Object.create(null);
    for (const field of schema.booleanFields) {
      const observed = ownDataValue(value, field);
      if (observed.status !== "exact" || typeof observed.value !== "boolean")
        throw new Error("safety_observation_boolean_unknown");
      booleans[field] = observed.value;
    }

    const ids: string[] = [];
    for (const field of schema.nullableRecoveryFields) {
      const observed = ownDataValue(value, field.field);
      if (
        observed.status !== "exact" ||
        (observed.value !== null &&
          !isCanonicalVerificationRecoveryId(observed.value, field.kind))
      )
        throw new Error("safety_observation_recovery_unknown");
      if (typeof observed.value === "string") ids.push(observed.value);
    }
    for (const pair of schema.recoveryPairs) {
      const singular = ownDataValue(value, pair.singularField);
      const pluralObserved = ownDataValue(value, pair.pluralField);
      if (
        singular.status !== "exact" ||
        (singular.value !== null &&
          !isCanonicalVerificationRecoveryId(singular.value, pair.kind)) ||
        pluralObserved.status !== "exact"
      )
        throw new Error("safety_observation_recovery_unknown");
      const plural = snapshotPlainArray<unknown>(
        pluralObserved.value,
        MAXIMUM_RECOVERY_IDS,
      );
      if (
        plural.status !== "ok" ||
        plural.value.some(
          (item) => !isCanonicalVerificationRecoveryId(item, pair.kind),
        ) ||
        new Set(plural.value).size !== plural.value.length
      )
        throw new Error("safety_observation_recovery_unknown");
      if (
        (plural.value.length === 0 && singular.value !== null) ||
        (plural.value.length === 1 && singular.value !== plural.value[0]) ||
        (plural.value.length > 1 && singular.value !== null)
      )
        throw new Error("safety_observation_recovery_pair_noncanonical");
      if (typeof singular.value === "string") ids.push(singular.value);
      ids.push(...(plural.value as readonly string[]));
    }
    const uniqueIds = Object.freeze([...new Set(ids)]);
    if (
      booleans.cleanupConfirmed === false &&
      booleans.manualRecoveryRequired === false
    )
      throw new Error("safety_observation_cleanup_without_action");
    if (booleans.manualRecoveryRequired === false && uniqueIds.length > 0)
      throw new Error("safety_observation_recovery_without_action");
    if (
      schema.effectUnknownField &&
      booleans[schema.effectUnknownField] === true
    )
      throw new Error("safety_observation_effect_unknown");
    return Object.freeze({
      status: "exact" as const,
      booleans: Object.freeze(booleans),
      recoveryIds: uniqueIds,
    });
  } catch {
    return Object.freeze({
      status: "unknown" as const,
      booleans: null,
      recoveryIds: Object.freeze([]),
    });
  }
}

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
