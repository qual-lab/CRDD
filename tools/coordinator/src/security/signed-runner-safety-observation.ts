import { types as utilTypes } from "node:util";

import { snapshotPlainArray } from "./plain-data-snapshot.ts";

export type SignedRunnerSafetySchema = Readonly<{
  booleanFields: readonly string[];
  nullableRecoveryFields: readonly string[];
  recoveryPairs: readonly Readonly<{
    singularField: string;
    pluralField: string;
  }>[];
  effectUnknownField?: string;
}>;

export type SignedRunnerSafetyObservation = Readonly<{
  status: "exact" | "unknown";
  booleans: Readonly<Record<string, boolean>> | null;
  recoveryIds: readonly string[];
}>;

const MAXIMUM_RECOVERY_IDS = 128;
const MAXIMUM_RECOVERY_ID_LENGTH = 1024;

function recoveryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_RECOVERY_ID_LENGTH
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
      const observed = ownDataValue(value, field);
      if (
        observed.status !== "exact" ||
        (observed.value !== null && !recoveryId(observed.value))
      )
        throw new Error("safety_observation_recovery_unknown");
      if (typeof observed.value === "string") ids.push(observed.value);
    }
    for (const pair of schema.recoveryPairs) {
      const singular = ownDataValue(value, pair.singularField);
      const pluralObserved = ownDataValue(value, pair.pluralField);
      if (
        singular.status !== "exact" ||
        (singular.value !== null && !recoveryId(singular.value)) ||
        pluralObserved.status !== "exact"
      )
        throw new Error("safety_observation_recovery_unknown");
      const plural = snapshotPlainArray<unknown>(
        pluralObserved.value,
        MAXIMUM_RECOVERY_IDS,
      );
      if (
        plural.status !== "ok" ||
        plural.value.some((item) => !recoveryId(item)) ||
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
