import assert from "node:assert/strict";
import test from "node:test";

import { evaluateManagedDockerCleanupEligibility } from "../src/core/docker-cleanup-eligibility.ts";

function exactAt<T>(values: readonly T[], index: number) {
  const value = values[index];
  if (value === undefined) throw new Error("fixture_index_missing");
  return value;
}

function candidate(
  ids: readonly string[],
  state: "finalizable" | "active" | "abandoned" = "finalizable",
) {
  const capabilities = ids.map(() => Object.freeze({}));
  return Object.freeze({
    capabilities,
    handoffs: Object.freeze(
      ids.map((recoveryId, index) =>
        Object.freeze({
          recoveryId,
          capability: exactAt(capabilities, index),
          state,
        }),
      ),
    ),
    finalizations: Object.freeze(
      ids.map((recoveryId, index) =>
        Object.freeze({ recoveryId, capability: exactAt(capabilities, index) }),
      ),
    ),
  });
}

function raw(ids: readonly string[]) {
  return Object.freeze({
    singularPresent: true,
    singular: ids.length === 1 ? ids[0] : null,
    pluralPresent: true,
    plural: Object.freeze([...ids]),
  });
}

test("Docker cleanup eligibilityは0/1/N exact finalizable集合だけを受理する", () => {
  for (const ids of [[], ["r1"], ["r1", "r2"]] as const) {
    const state = candidate(ids);
    assert.deepEqual(
      evaluateManagedDockerCleanupEligibility({ raw: raw(ids), ...state }),
      { eligible: true, reason: "exact_match" },
    );
  }
});

test("raw recovery projectionの不正shapeは認証済みhandoffがあっても拒否する", () => {
  const state = candidate(["r1"]);
  const sparse = new Array(1);
  const withExtra = ["r1"];
  Object.defineProperty(withExtra, "extra", { value: "r2", enumerable: true });
  const withOutOfRangeNumericKey = new Proxy([], {
    ownKeys: () => ["length", "2"],
    getOwnPropertyDescriptor: (target, key) =>
      key === "2"
        ? {
            configurable: true,
            enumerable: true,
            writable: true,
            value: "r1",
          }
        : Reflect.getOwnPropertyDescriptor(target, key),
  });
  const nonPlain = ["r1"];
  Object.setPrototypeOf(nonPlain, Object.create(Array.prototype));
  const invalid = [
    {
      singularPresent: true,
      singular: undefined,
      pluralPresent: true,
      plural: [],
    },
    {
      singularPresent: true,
      singular: "",
      pluralPresent: true,
      plural: ["r1"],
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: "r1",
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: ["r1", 1],
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: ["r1", ""],
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: ["r1", "r1"],
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: sparse,
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: withExtra,
    },
    {
      singularPresent: true,
      singular: null,
      pluralPresent: true,
      plural: withOutOfRangeNumericKey,
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: nonPlain,
    },
    {
      singularPresent: true,
      singular: null,
      pluralPresent: true,
      plural: ["r1"],
    },
    {
      singularPresent: true,
      singular: "r2",
      pluralPresent: true,
      plural: ["r1"],
    },
    { singularPresent: true, singular: "r1", pluralPresent: true, plural: [] },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: ["r1", "r2"],
    },
  ];
  for (const projection of invalid)
    assert.equal(
      evaluateManagedDockerCleanupEligibility({
        raw: projection,
        ...state,
      }).eligible,
      false,
    );
});

test("raw field欠落は正式0件表現としてだけ受理する", () => {
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: {
        singularPresent: false,
        singular: undefined,
        pluralPresent: false,
        plural: undefined,
      },
      ...candidate([]),
    }).eligible,
    true,
  );
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: {
        singularPresent: false,
        singular: undefined,
        pluralPresent: false,
        plural: undefined,
      },
      ...candidate(["r1"]),
    }).eligible,
    true,
  );
});

test("handoff/finalizationのstate・重複・交差不一致・余剰を拒否する", () => {
  const base = candidate(["r1", "r2"]);
  const cases = [
    { ...base, handoffs: candidate(["r1"], "active").handoffs },
    { ...base, handoffs: candidate(["r1"], "abandoned").handoffs },
    {
      ...base,
      handoffs: [exactAt(base.handoffs, 0), exactAt(base.handoffs, 0)],
    },
    {
      ...base,
      finalizations: [
        exactAt(base.finalizations, 0),
        exactAt(base.finalizations, 0),
      ],
    },
    {
      ...base,
      finalizations: [
        { recoveryId: "r1", capability: exactAt(base.capabilities, 1) },
        { recoveryId: "r2", capability: exactAt(base.capabilities, 0) },
      ],
    },
    { ...base, finalizations: [exactAt(base.finalizations, 0)] },
    {
      ...base,
      finalizations: [
        ...base.finalizations,
        { recoveryId: "r3", capability: {} },
      ],
    },
  ];
  for (const value of cases)
    assert.equal(
      evaluateManagedDockerCleanupEligibility({
        raw: raw(["r1", "r2"]),
        ...value,
      }).eligible,
      false,
    );
});

test("unmanaged raw IDとmanaged/raw混在を拒否する", () => {
  const state = candidate(["r1"]);
  assert.equal(
    evaluateManagedDockerCleanupEligibility({ raw: raw(["other"]), ...state })
      .eligible,
    false,
  );
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: raw(["r1", "other"]),
      ...state,
    }).eligible,
    false,
  );
});
