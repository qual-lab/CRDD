import { types as utilTypes } from "node:util";

type ArraySnapshot<T> =
  | Readonly<{ status: "ok"; value: readonly T[] }>
  | Readonly<{ status: "blocked"; value: null }>;

function isPlainRecord(value: unknown): value is object {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(
    descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  expectedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== expectedKeys.size ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

export function snapshotPlainArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): ArraySnapshot<T> {
  try {
    if (
      !Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      !Number.isSafeInteger(maximumLength) ||
      maximumLength < 0
    )
      return Object.freeze({ status: "blocked", value: null });
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !isDataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0 ||
      initialLength.value > maximumLength
    )
      return Object.freeze({ status: "blocked", value: null });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !isDataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    )
      return Object.freeze({ status: "blocked", value: null });
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor))
        return Object.freeze({ status: "blocked", value: null });
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({
      status: "ok" as const,
      value: Object.freeze(snapshotItems),
    });
  } catch {
    return Object.freeze({ status: "blocked", value: null });
  }
}
