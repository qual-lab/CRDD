export type DockerCleanupHandoffCandidate = Readonly<{
  state: string;
  recoveryId: string;
  capability: object;
}>;

export type DockerCleanupFinalizationCandidate = Readonly<{
  recoveryId: string;
  capability: object;
}>;

export type RawDockerRecoveryProjection = Readonly<{
  singularPresent: boolean;
  singular: unknown;
  pluralPresent: boolean;
  plural: unknown;
}>;

const MAX_RECOVERY_IDS = 128;
const MAX_RECOVERY_ID_LENGTH = 512;

function recoveryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_RECOVERY_ID_LENGTH
  );
}

function exactDenseStringArray(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > MAX_RECOVERY_IDS
  )
    return null;
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_value, index) => String(index)),
  ]);
  if (
    ownKeys.length !== expectedKeys.size ||
    ownKeys.some((key) => !expectedKeys.has(key))
  )
    return null;
  const resultItems: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !recoveryId(descriptor.value)
    )
      return null;
    resultItems.push(descriptor.value);
  }
  if (new Set(resultItems).size !== resultItems.length) return null;
  return Object.freeze(resultItems);
}

function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  )
    return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  )
    return null;
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      return null;
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function exactPlainRecordArray(
  value: unknown,
  expectedRecordKeys: readonly string[],
) {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > MAX_RECOVERY_IDS
  )
    return null;
  const keys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_value, index) => String(index)),
  ]);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => !expectedKeys.has(key))
  )
    return null;
  const snapshotItems: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) return null;
    const record = exactPlainRecord(descriptor.value, expectedRecordKeys);
    if (!record) return null;
    snapshotItems.push(record);
  }
  return Object.freeze(snapshotItems);
}

function snapshotInput(value: unknown) {
  const input = exactPlainRecord(value, ["raw", "handoffs", "finalizations"]);
  if (!input) return null;
  const raw = exactPlainRecord(input.raw, [
    "singularPresent",
    "singular",
    "pluralPresent",
    "plural",
  ]);
  const handoffs = exactPlainRecordArray(input.handoffs, [
    "state",
    "recoveryId",
    "capability",
  ]);
  const finalizations = exactPlainRecordArray(input.finalizations, [
    "recoveryId",
    "capability",
  ]);
  return raw && handoffs && finalizations
    ? Object.freeze({ raw, handoffs, finalizations })
    : null;
}

function canonicalRawIds(raw: RawDockerRecoveryProjection) {
  if (!raw.singularPresent || !raw.pluralPresent) return null;
  const singular =
    raw.singular === null
      ? null
      : recoveryId(raw.singular)
        ? raw.singular
        : undefined;
  if (singular === undefined) return null;
  const pluralItems = exactDenseStringArray(raw.plural);
  if (!pluralItems) return null;
  if (pluralItems.length === 0 && singular !== null) return null;
  if (pluralItems.length === 1 && singular !== pluralItems[0]) return null;
  if (pluralItems.length > 1 && singular !== null) return null;
  return Object.freeze(pluralItems);
}

function evaluate(inputValue: unknown) {
  const input = snapshotInput(inputValue);
  if (!input) return Object.freeze({ eligible: false, reason: "raw_invalid" });
  const rawIds = canonicalRawIds(input.raw as RawDockerRecoveryProjection);
  if (!rawIds) return Object.freeze({ eligible: false, reason: "raw_invalid" });
  const pendingItems = input.handoffs.filter(
    (handoff) => handoff.state !== "finalized",
  );
  const pendingIds = new Set<string>();
  const pendingCapabilities = new Set<object>();
  for (const handoff of pendingItems) {
    if (
      handoff.state !== "finalizable" ||
      !recoveryId(handoff.recoveryId) ||
      typeof handoff.capability !== "object" ||
      handoff.capability === null ||
      pendingIds.has(handoff.recoveryId) ||
      pendingCapabilities.has(handoff.capability)
    )
      return Object.freeze({ eligible: false, reason: "handoff_invalid" });
    const exactItems = input.finalizations.filter(
      (candidate) =>
        candidate.recoveryId === handoff.recoveryId &&
        candidate.capability === handoff.capability,
    );
    const isConflicting = input.finalizations.some(
      (candidate) =>
        (candidate.recoveryId === handoff.recoveryId ||
          candidate.capability === handoff.capability) &&
        (candidate.recoveryId !== handoff.recoveryId ||
          candidate.capability !== handoff.capability),
    );
    if (exactItems.length !== 1 || isConflicting)
      return Object.freeze({
        eligible: false,
        reason: "finalization_mismatch",
      });
    pendingIds.add(handoff.recoveryId);
    pendingCapabilities.add(handoff.capability);
  }
  if (
    input.finalizations.length !== pendingItems.length ||
    rawIds.length !== pendingIds.size ||
    rawIds.some((id) => !pendingIds.has(id))
  )
    return Object.freeze({ eligible: false, reason: "set_mismatch" });
  return Object.freeze({ eligible: true, reason: "exact_match" });
}

export function evaluateManagedDockerCleanupEligibility(input: unknown) {
  try {
    return evaluate(input);
  } catch {
    return Object.freeze({ eligible: false, reason: "raw_invalid" });
  }
}
import { types as utilTypes } from "node:util";
