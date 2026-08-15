// @ts-check

import { types as utilTypes } from "node:util";

/**
 * @param {PropertyDescriptor | undefined} descriptor
 * @param {boolean} [enumerable]
 * @returns {descriptor is PropertyDescriptor & {value: unknown}}
 */
function dataDescriptor(descriptor, enumerable = true) {
  return Boolean(descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value") &&
    descriptor.get === undefined && descriptor.set === undefined &&
    (!enumerable || descriptor.enumerable === true));
}

/** @param {unknown} value @param {ReadonlySet<string>} allowedKeys */
export function snapshotPlainRecord(value, allowedKeys) {
  try {
    if (!value || typeof value !== "object" || utilTypes.isProxy(value) || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== allowedKeys.size || keys.some((key) =>
      typeof key !== "string" || !allowedKeys.has(key))) return null;
    const snapshot = /** @type {Record<string, any>} */ (Object.create(null));
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

/** @param {unknown} value @param {number} maximumLength */
export function snapshotPlainArray(value, maximumLength) {
  try {
    if (!value || typeof value !== "object" || utilTypes.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return Object.freeze({ status: "blocked", reason: "not_plain_array", value: null });
    }
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !dataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) || initialLength.value < 0
    ) return Object.freeze({ status: "blocked", reason: "array_length_invalid", value: null });
    if (initialLength.value > maximumLength) {
      return Object.freeze({ status: "blocked", reason: "array_length_exceeded", value: null });
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = /** @type {PropertyDescriptor | undefined} */ (descriptors["length"]);
    if (keys.length !== initialLength.value + 1 || !dataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value) {
      return Object.freeze({ status: "blocked", reason: "array_shape_invalid", value: null });
    }
    /** @type {any[]} */
    const snapshot = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!dataDescriptor(descriptor)) {
        return Object.freeze({ status: "blocked", reason: "array_shape_invalid", value: null });
      }
      snapshot.push(descriptor.value);
    }
    const allowed = new Set(["length", ...snapshot.map((_, index) => String(index))]);
    if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) {
      return Object.freeze({ status: "blocked", reason: "array_shape_invalid", value: null });
    }
    return Object.freeze({ status: "ok", reason: null, value: Object.freeze(snapshot) });
  } catch {
    return Object.freeze({ status: "blocked", reason: "array_input_invalid", value: null });
  }
}
