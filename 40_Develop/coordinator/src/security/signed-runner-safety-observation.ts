import { types as utilTypes } from "node:util";

import { snapshotPlainArray } from "./plain-data-snapshot.ts";

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

export type SignedRunnerRecoveryKind =
  | "host"
  | "docker"
  | "candidate"
  | "candidate_store";

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
