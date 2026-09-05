import { types as utilTypes } from "node:util";

type DataDescriptor = PropertyDescriptor & { value: unknown };

type PlainArraySnapshot<T> =
  | Readonly<{ status: "ok"; reason: null; value: readonly T[] }>
  | Readonly<{
      status: "blocked";
      reason:
        | "not_plain_array"
        | "array_length_invalid"
        | "array_length_exceeded"
        | "array_shape_invalid"
        | "array_input_invalid";
      value: null;
    }>;

function dataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is DataDescriptor {
  return Boolean(
    descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
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
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (!dataDescriptor(descriptor)) return null;
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
): PlainArraySnapshot<T> {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return Object.freeze({
        status: "blocked",
        reason: "not_plain_array",
        value: null,
      });
    }
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !dataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0
    )
      return Object.freeze({
        status: "blocked",
        reason: "array_length_invalid",
        value: null,
      });
    if (initialLength.value > maximumLength)
      return Object.freeze({
        status: "blocked",
        reason: "array_length_exceeded",
        value: null,
      });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !dataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    )
      return Object.freeze({
        status: "blocked",
        reason: "array_shape_invalid",
        value: null,
      });
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!dataDescriptor(descriptor))
        return Object.freeze({
          status: "blocked",
          reason: "array_shape_invalid",
          value: null,
        });
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({
      status: "ok",
      reason: null,
      value: Object.freeze(snapshotItems),
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "array_input_invalid",
      value: null,
    });
  }
}
