/**
 * coordinator:unit:docker-cleanup-eligibilityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-cleanup-eligibilityが所有する検証責務を実行する。
 * @trace RDL-UT-005
 * @level UT
 * @scope docker、cleanup、eligibility
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { evaluateManagedDockerCleanupEligibility } from "../../src/core/docker-cleanup-eligibility.ts";

/**
 * exactAtのTest準備責務を実行する。
 *
 * @responsibility exactAtがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exactAtを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
function exactAt<T>(values: readonly T[], index: number) {
  const value = values[index];
  if (value === undefined) throw new Error("fixture_index_missing");
  return value;
}

/**
 * candidateのTest準備責務を実行する。
 *
 * @responsibility candidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus candidateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
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

/**
 * rawのTest準備責務を実行する。
 *
 * @responsibility rawがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus rawを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
function raw(ids: readonly string[]) {
  return Object.freeze({
    singularPresent: true,
    singular: ids.length === 1 ? ids[0] : null,
    pluralPresent: true,
    plural: Object.freeze([...ids]),
  });
}

/**
 * cleanupStateのTest準備責務を実行する。
 *
 * @responsibility cleanupStateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus cleanupStateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
function cleanupState(value: ReturnType<typeof candidate>): Readonly<{
  handoffs: ReturnType<typeof candidate>["handoffs"];
  finalizations: ReturnType<typeof candidate>["finalizations"];
}> {
  return Object.freeze({
    handoffs: value.handoffs,
    finalizations: value.finalizations,
  });
}

/**
 * Docker cleanup eligibilityは0/1/N exact finalizable集合だけを受理するを検証する。
 *
 * @responsibility Docker cleanup eligibilityは0/1/N exact finalizable集合だけを受理するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker cleanup eligibilityは0/1/N exact finalizable集合だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Docker cleanup eligibilityは0/1/N exact finalizable集合だけを受理する", () => {
  for (const ids of [[], ["r1"], ["r1", "r2"]] as const) {
    const state = candidate(ids);
    assert.deepEqual(
      evaluateManagedDockerCleanupEligibility({
        raw: raw(ids),
        ...cleanupState(state),
      }),
      { eligible: true, reason: "exact_match" },
    );
  }
});

/**
 * raw recovery projectionの不正shapeは認証済みhandoffがあっても拒否するを検証する。
 *
 * @responsibility raw recovery projectionの不正shapeは認証済みhandoffがあっても拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus raw recovery projectionの不正shapeは認証済みhandoffがあっても拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("raw recovery projectionの不正shapeは認証済みhandoffがあっても拒否する", () => {
  const state = candidate(["r1"]);
  const sparseItems = new Array(1);
  const withExtraItems = ["r1"];
  Object.defineProperty(withExtraItems, "extra", {
    value: "r2",
    enumerable: true,
  });
  const withOutOfRangeNumericKeyItems = new Proxy([], {
    ownKeys: () => ["length", "2"],
    getOwnPropertyDescriptor: (targetItems, key) =>
      key === "2"
        ? {
            configurable: true,
            enumerable: true,
            writable: true,
            value: "r1",
          }
        : Reflect.getOwnPropertyDescriptor(targetItems, key),
  });
  const nonPlainItems = ["r1"];
  Object.setPrototypeOf(nonPlainItems, Object.create(Array.prototype));
  const invalidItems = [
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
      plural: sparseItems,
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: withExtraItems,
    },
    {
      singularPresent: true,
      singular: null,
      pluralPresent: true,
      plural: withOutOfRangeNumericKeyItems,
    },
    {
      singularPresent: true,
      singular: "r1",
      pluralPresent: true,
      plural: nonPlainItems,
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
  for (const projection of invalidItems)
    assert.equal(
      evaluateManagedDockerCleanupEligibility({
        raw: projection,
        ...cleanupState(state),
      }).eligible,
      false,
    );
});

/**
 * raw field欠落はpending件数にかかわらず拒否するを検証する。
 *
 * @responsibility raw field欠落はpending件数にかかわらず拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus raw field欠落はpending件数にかかわらず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("raw field欠落はpending件数にかかわらず拒否する", () => {
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: {
        singularPresent: false,
        singular: undefined,
        pluralPresent: false,
        plural: undefined,
      },
      ...cleanupState(candidate([])),
    }).eligible,
    false,
  );
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: {
        singularPresent: false,
        singular: undefined,
        pluralPresent: false,
        plural: undefined,
      },
      ...cleanupState(candidate(["r1"])),
    }).eligible,
    false,
  );
});

/**
 * raw集合がpending集合の空または部分集合なら拒否するを検証する。
 *
 * @responsibility raw集合がpending集合の空または部分集合なら拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus raw集合がpending集合の空または部分集合なら拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("raw集合がpending集合の空または部分集合なら拒否する", () => {
  for (const [rawIds, pendingIds] of [
    [[], ["r1"]],
    [[], ["r1", "r2"]],
    [["r1"], ["r1", "r2"]],
  ] as const) {
    assert.equal(
      evaluateManagedDockerCleanupEligibility({
        raw: raw(rawIds),
        ...cleanupState(candidate(pendingIds)),
      }).eligible,
      false,
    );
  }
});

/**
 * handoff/finalizationのstate・重複・交差不一致・余剰を拒否するを検証する。
 *
 * @responsibility handoff/finalizationのstate・重複・交差不一致・余剰を拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus handoff/finalizationのstate・重複・交差不一致・余剰を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("handoff/finalizationのstate・重複・交差不一致・余剰を拒否する", () => {
  const base = candidate(["r1", "r2"]);
  const baseState = cleanupState(base);
  const cases = [
    { ...baseState, handoffs: candidate(["r1"], "active").handoffs },
    { ...baseState, handoffs: candidate(["r1"], "abandoned").handoffs },
    {
      ...baseState,
      handoffs: [exactAt(base.handoffs, 0), exactAt(base.handoffs, 0)],
    },
    {
      ...baseState,
      finalizations: [
        exactAt(base.finalizations, 0),
        exactAt(base.finalizations, 0),
      ],
    },
    {
      ...baseState,
      finalizations: [
        { recoveryId: "r1", capability: exactAt(base.capabilities, 1) },
        { recoveryId: "r2", capability: exactAt(base.capabilities, 0) },
      ],
    },
    { ...baseState, finalizations: [exactAt(base.finalizations, 0)] },
    {
      ...baseState,
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

/**
 * unmanaged raw IDとmanaged/raw混在を拒否するを検証する。
 *
 * @responsibility unmanaged raw IDとmanaged/raw混在を拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus unmanaged raw IDとmanaged/raw混在を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("unmanaged raw IDとmanaged/raw混在を拒否する", () => {
  const state = candidate(["r1"]);
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: raw(["other"]),
      ...cleanupState(state),
    }).eligible,
    false,
  );
  assert.equal(
    evaluateManagedDockerCleanupEligibility({
      raw: raw(["r1", "other"]),
      ...cleanupState(state),
    }).eligible,
    false,
  );
});

/**
 * pure Coreは全入力構造のtransparent Proxyをtrap前に拒否するを検証する。
 *
 * @responsibility pure Coreは全入力構造のtransparent Proxyをtrap前に拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus pure Coreは全入力構造のtransparent Proxyをtrap前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("pure Coreは全入力構造のtransparent Proxyをtrap前に拒否する", () => {
  const base = candidate(["r1"]);
  const baseRaw = raw(["r1"]);
  let trapCount = 0;
  const handler: ProxyHandler<object> = {
    get: (target, key, receiver) => {
      trapCount += 1;
      return Reflect.get(target, key, receiver);
    },
    getPrototypeOf: (target) => {
      trapCount += 1;
      return Reflect.getPrototypeOf(target);
    },
    has: (target, key) => {
      trapCount += 1;
      return Reflect.has(target, key);
    },
    ownKeys: (target) => {
      trapCount += 1;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor: (target, key) => {
      trapCount += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  };
  const proxy = <T extends object>(value: T) => new Proxy(value, handler);
  const exactInput = Object.freeze({
    raw: baseRaw,
    handoffs: base.handoffs,
    finalizations: base.finalizations,
  });
  const cases = [
    proxy(exactInput),
    Object.freeze({ ...exactInput, raw: proxy(baseRaw) }),
    Object.freeze({
      ...exactInput,
      raw: Object.freeze({ ...baseRaw, plural: proxy(["r1"]) }),
    }),
    Object.freeze({ ...exactInput, handoffs: proxy([...base.handoffs]) }),
    Object.freeze({
      ...exactInput,
      finalizations: proxy([...base.finalizations]),
    }),
    Object.freeze({
      ...exactInput,
      handoffs: Object.freeze([proxy(exactAt(base.handoffs, 0))]),
    }),
    Object.freeze({
      ...exactInput,
      finalizations: Object.freeze([proxy(exactAt(base.finalizations, 0))]),
    }),
  ];
  for (const value of cases) {
    trapCount = 0;
    assert.equal(
      evaluateManagedDockerCleanupEligibility(value).eligible,
      false,
    );
    assert.equal(trapCount, 0);
  }
});
