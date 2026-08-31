import assert from "node:assert/strict";
import test from "node:test";

import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../src/security/plain-data-snapshot.ts";
import { assertPresent } from "./test-support.ts";

test("record snapshotはdata descriptorだけを一度固定する", () => {
  const raw = { left: "before", right: 1 };
  const snapshot = snapshotPlainRecord(raw, new Set(["left", "right"]));
  assertPresent(snapshot);
  raw.left = "after";
  assert.equal(snapshot.left, "before");
  assert.equal(Object.isFrozen(snapshot), true);
  const nullPrototype = Object.assign(Object.create(null), {
    left: "value",
    right: 2,
  });
  const nullSnapshot = snapshotPlainRecord(
    nullPrototype,
    new Set(["left", "right"]),
  );
  assertPresent(nullSnapshot);
  assert.equal(nullSnapshot.left, "value");
  const frozenSnapshot = snapshotPlainRecord(
    Object.freeze({ left: "frozen", right: 3 }),
    new Set(["left", "right"]),
  );
  assertPresent(frozenSnapshot);
  assert.equal(frozenSnapshot.left, "frozen");
});

test("record snapshotはaccessor、symbol、extra、custom prototypeを拒否しgetterを呼ばない", () => {
  let calls = 0;
  const accessor = { right: 1 };
  Object.defineProperty(accessor, "left", {
    enumerable: true,
    get() {
      calls += 1;
      return calls === 1 ? "valid" : "malicious";
    },
  });
  assert.equal(snapshotPlainRecord(accessor, new Set(["left", "right"])), null);
  assert.equal(calls, 0);
  const symbol = { left: "value", right: 1, [Symbol("extra")]: true };
  assert.equal(snapshotPlainRecord(symbol, new Set(["left", "right"])), null);
  assert.equal(
    snapshotPlainRecord(
      { left: "value", right: 1, extra: true },
      new Set(["left", "right"]),
    ),
    null,
  );
  assert.equal(
    snapshotPlainRecord(
      Object.assign(Object.create({ inherited: true }), {
        left: "value",
        right: 1,
      }),
      new Set(["left", "right"]),
    ),
    null,
  );
});

test("array snapshotはhole、accessor、extra、symbolを拒否し元配列の変更を受けない", () => {
  const rawValues = ["before", "stable"];
  const result = snapshotPlainArray(rawValues, 2);
  rawValues[0] = "after";
  assert.equal(result.status, "ok");
  assert.deepEqual(result.value, ["before", "stable"]);
  assert.equal(Object.isFrozen(result.value), true);
  const sparseValues = new Array(2);
  sparseValues[0] = "value";
  assert.equal(snapshotPlainArray(sparseValues, 2).status, "blocked");
  let calls = 0;
  const accessorValues = ["placeholder"];
  Object.defineProperty(accessorValues, "0", {
    enumerable: true,
    configurable: true,
    get() {
      calls += 1;
      return calls === 1 ? "valid" : "malicious";
    },
  });
  assert.equal(snapshotPlainArray(accessorValues, 1).status, "blocked");
  assert.equal(calls, 0);
  const extraValues = Object.assign(["value"], { named: true });
  assert.equal(snapshotPlainArray(extraValues, 1).status, "blocked");
  const symbolValues = Object.assign(["value"], {
    [Symbol("extra")]: true,
  });
  assert.equal(snapshotPlainArray(symbolValues, 1).status, "blocked");
  assert.equal(snapshotPlainArray(Object.freeze(["frozen"]), 1).status, "ok");
  const customValues = ["value"];
  Object.setPrototypeOf(customValues, Object.create(Array.prototype));
  assert.equal(snapshotPlainArray(customValues, 1).status, "blocked");
});

test("Proxyはreflection trapを実行する前に拒否する", () => {
  const calls = { ownKeys: 0, descriptor: 0, prototype: 0 };
  const proxy = new Proxy(
    { left: "value", right: 1 },
    {
      ownKeys(target) {
        calls.ownKeys += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        calls.descriptor += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      getPrototypeOf(target) {
        calls.prototype += 1;
        return Reflect.getPrototypeOf(target);
      },
    },
  );
  assert.equal(snapshotPlainRecord(proxy, new Set(["left", "right"])), null);
  assert.deepEqual(calls, { ownKeys: 0, descriptor: 0, prototype: 0 });
  const proxiedArrayItems = new Proxy(["value"], {
    ownKeys(targetItems) {
      calls.ownKeys += 1;
      return Reflect.ownKeys(targetItems);
    },
    getOwnPropertyDescriptor(targetItems, key) {
      calls.descriptor += 1;
      return Reflect.getOwnPropertyDescriptor(targetItems, key);
    },
    getPrototypeOf(targetItems) {
      calls.prototype += 1;
      return Reflect.getPrototypeOf(targetItems);
    },
  });
  assert.equal(snapshotPlainArray(proxiedArrayItems, 1).status, "blocked");
  assert.deepEqual(calls, { ownKeys: 0, descriptor: 0, prototype: 0 });
});

test("reflection APIの失敗はrecordとarrayの固定reasonへ閉じる", () => {
  const original = Object.getOwnPropertyDescriptors;
  const record = { left: "value", right: 1 };
  const values = ["value"];
  try {
    Object.getOwnPropertyDescriptors = ((target: object) => {
      if (target === record || target === values) throw new Error("fixture");
      return original(target);
    }) as typeof Object.getOwnPropertyDescriptors;
    assert.equal(snapshotPlainRecord(record, new Set(["left", "right"])), null);
    assert.equal(snapshotPlainArray(values, 1).reason, "array_input_invalid");
  } finally {
    Object.getOwnPropertyDescriptors = original;
  }
});

test("array lengthの欠落と上限超過を固定reasonで拒否する", () => {
  const original = Object.getOwnPropertyDescriptor;
  const values = ["value"];
  try {
    Object.getOwnPropertyDescriptor = ((target: object, key: PropertyKey) => {
      if (target === values && key === "length") return undefined;
      return original(target, key);
    }) as typeof Object.getOwnPropertyDescriptor;
    assert.equal(snapshotPlainArray(values, 1).reason, "array_length_invalid");
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }
  assert.equal(
    snapshotPlainArray(["one", "two"], 1).reason,
    "array_length_exceeded",
  );
});
