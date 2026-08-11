import assert from "node:assert/strict";
import test from "node:test";

import { snapshotPlainArray, snapshotPlainRecord } from "../src/security/plain-data-snapshot.mjs";

test("record snapshotはdata descriptorだけを一度固定する", () => {
  const raw = { left: "before", right: 1 };
  const snapshot = snapshotPlainRecord(raw, new Set(["left", "right"]));
  raw.left = "after";
  assert.equal(snapshot.left, "before");
  assert.equal(Object.isFrozen(snapshot), true);
  const nullPrototype = Object.assign(Object.create(null), { left: "value", right: 2 });
  assert.equal(snapshotPlainRecord(nullPrototype, new Set(["left", "right"])).left, "value");
  assert.equal(snapshotPlainRecord(Object.freeze({ left: "frozen", right: 3 }),
    new Set(["left", "right"])).left, "frozen");
});

test("record snapshotはaccessor、symbol、extra、custom prototypeを拒否しgetterを呼ばない", () => {
  let calls = 0;
  const accessor = { right: 1 };
  Object.defineProperty(accessor, "left", {
    enumerable: true,
    get() { calls += 1; return calls === 1 ? "valid" : "malicious"; }
  });
  assert.equal(snapshotPlainRecord(accessor, new Set(["left", "right"])), null);
  assert.equal(calls, 0);
  const symbol = { left: "value", right: 1, [Symbol("extra")]: true };
  assert.equal(snapshotPlainRecord(symbol, new Set(["left", "right"])), null);
  assert.equal(snapshotPlainRecord({ left: "value", right: 1, extra: true },
    new Set(["left", "right"])), null);
  assert.equal(snapshotPlainRecord(Object.assign(Object.create({ inherited: true }), {
    left: "value", right: 1
  }), new Set(["left", "right"])), null);
});

test("array snapshotはhole、accessor、extra、symbolを拒否し元配列の変更を受けない", () => {
  const raw = ["before", "stable"];
  const result = snapshotPlainArray(raw, 2);
  raw[0] = "after";
  assert.equal(result.status, "ok");
  assert.deepEqual(result.value, ["before", "stable"]);
  assert.equal(Object.isFrozen(result.value), true);
  const hole = new Array(2);
  hole[0] = "value";
  assert.equal(snapshotPlainArray(hole, 2).status, "blocked");
  let calls = 0;
  const accessor = ["placeholder"];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    configurable: true,
    get() { calls += 1; return calls === 1 ? "valid" : "malicious"; }
  });
  assert.equal(snapshotPlainArray(accessor, 1).status, "blocked");
  assert.equal(calls, 0);
  const extra = ["value"];
  extra.named = true;
  assert.equal(snapshotPlainArray(extra, 1).status, "blocked");
  const symbol = ["value"];
  symbol[Symbol("extra")] = true;
  assert.equal(snapshotPlainArray(symbol, 1).status, "blocked");
  assert.equal(snapshotPlainArray(Object.freeze(["frozen"]), 1).status, "ok");
  const custom = ["value"];
  Object.setPrototypeOf(custom, Object.create(Array.prototype));
  assert.equal(snapshotPlainArray(custom, 1).status, "blocked");
});

test("Proxyはreflection trapを実行する前に拒否する", () => {
  const calls = { ownKeys: 0, descriptor: 0, prototype: 0 };
  const proxy = new Proxy({ left: "value", right: 1 }, {
    ownKeys(target) { calls.ownKeys += 1; return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) {
      calls.descriptor += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    getPrototypeOf(target) { calls.prototype += 1; return Reflect.getPrototypeOf(target); }
  });
  assert.equal(snapshotPlainRecord(proxy, new Set(["left", "right"])), null);
  assert.deepEqual(calls, { ownKeys: 0, descriptor: 0, prototype: 0 });
  const arrayProxy = new Proxy(["value"], {
    ownKeys(target) { calls.ownKeys += 1; return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) {
      calls.descriptor += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    getPrototypeOf(target) { calls.prototype += 1; return Reflect.getPrototypeOf(target); }
  });
  assert.equal(snapshotPlainArray(arrayProxy, 1).status, "blocked");
  assert.deepEqual(calls, { ownKeys: 0, descriptor: 0, prototype: 0 });
});
