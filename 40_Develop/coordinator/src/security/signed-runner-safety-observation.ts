/**
 * signed-runner-safety-observationに属する責務をまとめる。
 *
 * @responsibility SignedRunnerSafetySchemaを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { types as utilTypes } from "node:util";

import { snapshotPlainArray } from "./plain-data-snapshot.ts";

/**
 * signed-runner-safety-observationで使用するSigned Runner Safety Schemaの値契約を定義する。
 *
 * @responsibility Signed Runner Safety SchemaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape SignedRunnerSafetySchemaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SignedRunnerSafetySchemaで宣言した値と責務の対応を維持する。
 * @boundary N/A: SignedRunnerSafetySchemaの宣言は外部境界を開かない。
 * @security SignedRunnerSafetySchemaはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SignedRunnerSafetySchemaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SignedRunnerSafetySchema = Readonly<{
  booleanFields: readonly string[];
  nullableRecoveryFields: readonly Readonly<{
    field: string;
    kind: SignedRunnerRecoveryKind;
  }>[];
  recoveryPairs: readonly Readonly<{
    singularField: string;
    pluralField: string;
    kind: SignedRunnerRecoveryKind;
  }>[];
  effectUnknownField?: string;
}>;

/**
 * signed-runner-safety-observationで使用するSigned Runner 回復 Kindの値契約を定義する。
 *
 * @responsibility Signed Runner 回復 KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape SignedRunnerRecoveryKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SignedRunnerRecoveryKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: SignedRunnerRecoveryKindの宣言は外部境界を開かない。
 * @security SignedRunnerRecoveryKindはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SignedRunnerRecoveryKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SignedRunnerRecoveryKind =
  | "host"
  | "docker"
  | "candidate"
  | "candidate_store";

/**
 * signed-runner-safety-observationで使用するSigned Runner Safety Observationの値契約を定義する。
 *
 * @responsibility Signed Runner Safety ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape SignedRunnerSafetyObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SignedRunnerSafetyObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: SignedRunnerSafetyObservationの宣言は外部境界を開かない。
 * @security SignedRunnerSafetyObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SignedRunnerSafetyObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SignedRunnerSafetyObservation = Readonly<{
  status: "exact" | "unknown";
  booleans: Readonly<Record<string, boolean>> | null;
  recoveryIds: readonly string[];
}>;

const MAXIMUM_RECOVERY_IDS = 128;
const MAXIMUM_RECOVERY_ID_LENGTH = 1024;
const RECOVERY_ID_PATTERNS: Readonly<Record<SignedRunnerRecoveryKind, RegExp>> =
  Object.freeze({
    host: /^host\.[A-Za-z0-9_-]{1,128}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/u,
    docker: /^docker-task\.[0-9a-f]{64}\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
    candidate: /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
    candidate_store: /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  });

/**
 * Canonical Signed Runner 回復 Idかを判定する。
 *
 * @responsibility Canonical Signed Runner 回復 Idの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、kind: SignedRunnerRecoveryKind
 * @returns value is stringを返す。
 * @precondition 「value: unknown、kind: SignedRunnerRecoveryKind」がisCanonicalSignedRunnerRecoveryIdの入力契約を満たす。
 * @postcondition isCanonicalSignedRunnerRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: isCanonicalSignedRunnerRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCanonicalSignedRunnerRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant isCanonicalSignedRunnerRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCanonicalSignedRunnerRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security isCanonicalSignedRunnerRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isCanonicalSignedRunnerRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function isCanonicalSignedRunnerRecoveryId(
  value: unknown,
  kind: SignedRunnerRecoveryKind,
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
 * salvage Signed Runner Nullable 回復を決定する。
 *
 * @responsibility salvage Signed Runner Nullable 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、field: string、kind: SignedRunnerRecoveryKind
 * @returns salvageSignedRunnerNullableRecoveryの計算結果を返す。
 * @precondition 「value: unknown、field: string、kind: SignedRunnerRecoveryKind」がsalvageSignedRunnerNullableRecoveryの入力契約を満たす。
 * @postcondition salvageSignedRunnerNullableRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: salvageSignedRunnerNullableRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure salvageSignedRunnerNullableRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant salvageSignedRunnerNullableRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: salvageSignedRunnerNullableRecoveryはProcess内の同一Subsystemで完結する。
 * @security salvageSignedRunnerNullableRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: salvageSignedRunnerNullableRecoveryは共有非同期状態を持たない同期処理である。
 */
export function salvageSignedRunnerNullableRecovery(
  value: unknown,
  field: string,
  kind: SignedRunnerRecoveryKind,
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
    if (isCanonicalSignedRunnerRecoveryId(observed.value, kind))
      return Object.freeze({ id: observed.value, ambiguous: false });
    return Object.freeze({ id: null, ambiguous: true });
  } catch {
    return Object.freeze({ id: null, ambiguous: true });
  }
}

/**
 * salvage Signed Runner 回復 Pairを決定する。
 *
 * @responsibility salvage Signed Runner 回復 Pairの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、pair: Readonly<{ singularField: string; pluralField: string; kind: SignedRunnerRecoveryKind; }>
 * @returns salvageSignedRunnerRecoveryPairの計算結果を返す。
 * @precondition 「value: unknown、pair: Readonly<{ singularField: string; pluralField: string; kind: SignedRunnerRecoveryKind; }>」がsalvageSignedRunnerRecoveryPairの入力契約を満たす。
 * @postcondition salvageSignedRunnerRecoveryPairの責務を完了した結果だけを返す。
 * @effect N/A: salvageSignedRunnerRecoveryPairは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure salvageSignedRunnerRecoveryPairは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant salvageSignedRunnerRecoveryPairは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: salvageSignedRunnerRecoveryPairはProcess内の同一Subsystemで完結する。
 * @security salvageSignedRunnerRecoveryPairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: salvageSignedRunnerRecoveryPairは共有非同期状態を持たない同期処理である。
 */
export function salvageSignedRunnerRecoveryPair(
  value: unknown,
  pair: Readonly<{
    singularField: string;
    pluralField: string;
    kind: SignedRunnerRecoveryKind;
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
      if (isCanonicalSignedRunnerRecoveryId(singular.value, pair.kind))
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
          if (isCanonicalSignedRunnerRecoveryId(item, pair.kind))
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
 * Signed Runner Safety Observationを評価する。
 *
 * @responsibility Signed Runner Safety Observationの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、schema: SignedRunnerSafetySchema
 * @returns SignedRunnerSafetyObservationを返す。
 * @precondition 「value: unknown、schema: SignedRunnerSafetySchema」がevaluateSignedRunnerSafetyObservationの入力契約を満たす。
 * @postcondition evaluateSignedRunnerSafetyObservationの責務を完了した結果だけを返す。
 * @effect N/A: evaluateSignedRunnerSafetyObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateSignedRunnerSafetyObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateSignedRunnerSafetyObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateSignedRunnerSafetyObservationはProcess内の同一Subsystemで完結する。
 * @security evaluateSignedRunnerSafetyObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateSignedRunnerSafetyObservationは共有非同期状態を持たない同期処理である。
 */
export function evaluateSignedRunnerSafetyObservation(
  value: unknown,
  schema: SignedRunnerSafetySchema,
): SignedRunnerSafetyObservation {
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
          !isCanonicalSignedRunnerRecoveryId(observed.value, field.kind))
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
          !isCanonicalSignedRunnerRecoveryId(singular.value, pair.kind)) ||
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
          (item) => !isCanonicalSignedRunnerRecoveryId(item, pair.kind),
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
