import assert from "node:assert/strict";

export type MutableRecord = Record<PropertyKey, unknown>;

export function assertPresent<T>(
  value: T,
  message = "expected a present value",
): asserts value is NonNullable<T> {
  assert.notEqual(value, null, message);
  assert.notEqual(value, undefined, message);
}

export function assertRecord(
  value: unknown,
  message = "expected a record",
): asserts value is MutableRecord {
  assert.equal(value !== null && typeof value === "object", true, message);
  assert.equal(Array.isArray(value), false, message);
}

export function assertCanonicalCandidate(
  value: unknown,
): asserts value is Readonly<{
  status: "candidate";
  reason: string;
  canonicalBytes: Buffer;
  canonicalHash: string;
}> {
  assertRecord(value);
  assert.equal(Reflect.get(value, "status"), "candidate");
  assert.equal(typeof Reflect.get(value, "reason"), "string");
  assert.equal(Buffer.isBuffer(Reflect.get(value, "canonicalBytes")), true);
  assert.match(String(Reflect.get(value, "canonicalHash")), /^[a-f0-9]{64}$/u);
}

export function assertDomainMessageCandidate(
  value: unknown,
): asserts value is Readonly<{
  status: "candidate";
  reason: string;
  message: Buffer;
}> {
  assertRecord(value);
  assert.equal(Reflect.get(value, "status"), "candidate");
  assert.equal(Buffer.isBuffer(Reflect.get(value, "message")), true);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(Reflect.get(value, key))}`,
      )
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("fixture value is not JSON serializable");
  }
  return encoded;
}

export function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
}
