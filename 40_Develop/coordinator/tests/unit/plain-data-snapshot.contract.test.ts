/**
 * coordinator:unit:plain-data-snapshotの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:plain-data-snapshotが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @level UT
 * @scope plain、data、snapshot
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";

import {
  snapshotJsonValue,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../../src/input/snapshot.ts";
import { assertPresent } from "../support/contract-assertions.ts";

/**
 * 入力捕捉後の値比較を保存用JSONの生成から独立させる。
 * @responsibility キー順・prototype・負のゼロの同値と配列順・欠測の差を維持する。
 * @trace PPR-UT-006
 * @precondition 既存のown-data捕捉が不正値を拒否する。
 * @stimulus 挿入順・非列挙field・共有参照・配列形式と単独不正を渡す。
 * @observation 捕捉後のNode.js標準比較と未知コード実行数。
 * @oracle 同じJSON値だけ同値となり、不正値は比較前に拒否する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 値比較のみ。保存・Hash・実資源の同一性は証明しない。
 */
test("捕捉済みJSON値は保存用文字列なしで同じ条件で比較できる", () => {
  const hidden = Object.create(null);
  Object.defineProperty(hidden, "v", { value: -0, enumerable: false });
  const shared = { v: 1 };
  for (const [a, b] of [
    [hidden, { v: 0 }],
    [
      { z: 1, a: [true, null] },
      { a: [true, null], z: 1 },
    ],
    [
      { a: shared, b: shared },
      { b: { v: 1 }, a: { v: 1 } },
    ],
    [new (class extends Array<number> {})(1, 2), [1, 2]],
    [runInNewContext("[1,2]"), [1, 2]],
  ])
    assert.equal(
      isDeepStrictEqual(snapshotJsonValue(a), snapshotJsonValue(b)),
      true,
    );
  for (const [a, b] of [
    [
      [1, 2],
      [2, 1],
    ],
    [{ v: 1 }, { v: "1" }],
    [{}, { v: null }],
    [{ v: 1 }, { v: 1, extra: true }],
  ])
    assert.equal(
      isDeepStrictEqual(snapshotJsonValue(a), snapshotJsonValue(b)),
      false,
    );
  let traps = 0;
  const getter = Object.defineProperty({}, "v", {
    get() {
      traps++;
      return 1;
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        traps++;
        return [];
      },
    },
  );
  const cyclic: { v?: unknown } = {};
  cyclic.v = cyclic;
  let deep: unknown = null;
  for (let i = 0; i < 34; i++) deep = { v: deep };
  const extraArray = [1];
  Object.defineProperty(extraArray, "extra", { value: true });
  for (const invalid of [
    getter,
    proxy,
    cyclic,
    deep,
    { [Symbol("v")]: 1 },
    {
      toJSON() {
        traps++;
        return {};
      },
    },
    new Array(1),
    extraArray,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() =>
      isDeepStrictEqual(snapshotJsonValue(invalid), snapshotJsonValue({})),
    );
    assert.throws(() =>
      isDeepStrictEqual(snapshotJsonValue({}), snapshotJsonValue(invalid)),
    );
  }
  assert.equal(traps, 0);
});

/**
 * 入力捕捉の値意味を保存用codecから独立して固定する。
 * @responsibility 機密や保存Hashを扱わず、own-dataの独立コピーと未知実行の拒否を確認する。
 * @trace PPR-UT-006
 * @precondition 純粋なJSON値と明示的な不正値だけを作る。
 * @stimulus 特殊key・descriptor・参照共有・realm・深度・数値・未知実行を渡す。
 * @observation 捕捉値、参照同一性、例外とGetter／Proxy／toJSON到達数。
 * @oracle 値を保持し参照を切り離し、不正入力を未知コード実行なしで拒否する。
 * @cleanup 外部資源なし。
 * @boundary 同一Process内の入力検査。保存成功や認可を示さない。
 */
test("JSON入力捕捉はown-dataの値と独立性を保持し未知実行を拒否する", () => {
  const shared = { value: "before" };
  const raw = Object.create(null);
  Object.defineProperties(raw, {
    hidden: { value: "kept", enumerable: false },
    constructor: { value: "ordinary", enumerable: true },
    "10": { value: "ten", enumerable: true },
    "2": { value: "two", enumerable: true },
    z: { value: shared, enumerable: true },
    a: { value: shared, enumerable: true },
  });
  Object.defineProperty(raw, "__proto__", {
    value: "own-data",
    enumerable: true,
  });
  const copied = snapshotJsonValue(raw) as Record<string, unknown>;
  assert.deepEqual(Object.keys(copied), [
    "2",
    "10",
    "__proto__",
    "a",
    "constructor",
    "hidden",
    "z",
  ]);
  assert.equal(Object.getPrototypeOf(copied), Object.prototype);
  assert.equal(Object.hasOwn(copied, "__proto__"), true);
  assert.equal(
    Object.getOwnPropertyDescriptor(copied, "__proto__")?.value,
    "own-data",
  );
  assert.equal(copied.constructor, "ordinary");
  assert.equal(copied.hidden, "kept");
  assert.notEqual(copied.a, copied.z);
  assert.notEqual(copied.a, shared);
  shared.value = "after";
  assert.deepEqual(copied.a, { value: "before" });
  assert.equal(Object.is(snapshotJsonValue(-0), -0), false);
  assert.equal(
    snapshotJsonValue(Number.MAX_SAFE_INTEGER),
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(
    snapshotJsonValue(Number.MIN_SAFE_INTEGER),
    Number.MIN_SAFE_INTEGER,
  );
  class Items extends Array<number> {}
  assert.deepEqual(snapshotJsonValue(new Items(1, 2)), [1, 2]);
  assert.deepEqual(snapshotJsonValue(runInNewContext("[1, [2, 3]]")), [
    1,
    [2, 3],
  ]);
  let nested: unknown = "leaf";
  for (let depth = 0; depth < 32; depth++) nested = [nested];
  assert.deepEqual(snapshotJsonValue(nested), nested);
  assert.throws(() => snapshotJsonValue([nested]));
  const cycle: unknown[] = [];
  cycle.push(cycle);
  let traps = 0;
  const accessor = Object.defineProperty({}, "x", {
    get() {
      traps++;
      return "secret";
    },
  });
  const toJSON = {
    toJSON() {
      traps++;
      return {};
    },
  };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        traps++;
        return [];
      },
      getPrototypeOf() {
        traps++;
        return null;
      },
    },
  );
  const array = [1];
  Object.defineProperty(array, "extra", { value: 2 });
  const symbolKey = { [Symbol("unsupported")]: 1 };
  const sparse: unknown[] = [];
  sparse.length = 2;
  sparse[1] = 1;
  for (const value of [
    undefined,
    NaN,
    Infinity,
    -Infinity,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    1n,
    Symbol("value"),
    () => {},
    new Date(),
    new Map(),
    new Set(),
    new Uint8Array(1),
    accessor,
    toJSON,
    proxy,
    array,
    symbolKey,
    sparse,
    cycle,
  ]) {
    assert.throws(() => snapshotJsonValue(value));
  }
  assert.equal(traps, 0);
});

/**
 * record snapshotはdata descriptorだけを一度固定するを検証する。
 *
 * @responsibility record snapshotはdata descriptorだけを一度固定するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus record snapshotはdata descriptorだけを一度固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * record snapshotはaccessor、symbol、extra、custom prototypeを拒否しgetterを呼ばないを検証する。
 *
 * @responsibility record snapshotはaccessor、symbol、extra、custom prototypeを拒否しgetterを呼ばないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus record snapshotはaccessor、symbol、extra、custom prototypeを拒否しgetterを呼ばないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * array snapshotはhole、accessor、extra、symbolを拒否し元配列の変更を受けないを検証する。
 *
 * @responsibility array snapshotはhole、accessor、extra、symbolを拒否し元配列の変更を受けないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus array snapshotはhole、accessor、extra、symbolを拒否し元配列の変更を受けないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * Proxyはreflection trapを実行する前に拒否するを検証する。
 *
 * @responsibility Proxyはreflection trapを実行する前に拒否するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Proxyはreflection trapを実行する前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * reflection APIの失敗はrecordとarrayの固定reasonへ閉じるを検証する。
 *
 * @responsibility reflection APIの失敗はrecordとarrayの固定reasonへ閉じるの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus reflection APIの失敗はrecordとarrayの固定reasonへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * array lengthの欠落と上限超過を固定reasonで拒否するを検証する。
 *
 * @responsibility array lengthの欠落と上限超過を固定reasonで拒否するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus array lengthの欠落と上限超過を固定reasonで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
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
