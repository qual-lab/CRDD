/**
 * 固定選定の短命Grantを検証する。
 * @packageDocumentation
 * @responsibility Operation・完全選定・試行の相関と一回消費を確認する。
 * @trace PRL-UT-006
 * @level UT
 * @scope selection、grant、operation
 * @boundary PRL-UT-006=N/A: 合成値だけ。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedDelegationSelectionGrantRuntimeCandidate,
  describeDelegationSelectionGrantRuntimeContract,
  issueRuntimeOwnedDelegationSelectionGrant,
  consumeRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
  supersedeRuntimeOwnedDelegationSelectionGrant,
} from "../../../src/execution/authority.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { hashExecutionSelection } from "../../../../domain-model/src/index.ts";
/**
 * 三項目の固定要求を合成する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
function request(overrides: Record<string, unknown> = {}) {
  return {
    operationId: "OP-123456",
    executionSelection: executionSelection(),
    taskAttempt: 0,
    ...overrides,
  };
}
/**
 * 既存の時計・操作検査・観測を代役にする。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
function fixture(
  overrides: Partial<
    Parameters<typeof createIsolatedDelegationSelectionGrantRuntimeCandidate>[0]
  > = {},
) {
  const owner = Object.freeze({});
  let wall = 1000,
    mono = 2000,
    random = 0;
  const runtime = createIsolatedDelegationSelectionGrantRuntimeCandidate({
    verifyOperation: (c) => {
      assert.equal(c, owner);
      return {
        operationId: "OP-123456",
        createdAt: "2026-10-24T00:00:00.000Z",
      };
    },
    observeProviderEligibility: () => [
      { provider: "codex", status: "eligible", reason: "ready" },
      { provider: "claude", status: "eligible", reason: "ready" },
    ],
    wallNow: () => wall,
    monotonicNow: () => mono,
    randomBytes: (size) => Buffer.alloc(size, ++random),
    ...overrides,
  });
  return {
    runtime,
    owner,
    expire: () => {
      wall += 30000;
      mono += 30000;
    },
    rollback: () => {
      wall--;
    },
  };
}

/**
 * 固定選定を一回消費する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("固定選定を一回消費する", () => {
  const h = fixture();
  const r = h.runtime.issue(h.owner, request());
  assert.equal(r.status, "issued");
  assert.equal(r.providerEffectAllowed, false);
  assert.equal(r.providerAuthorityIssued, false);
  assert.deepEqual(r.executionSelection, executionSelection());
  assert.equal(r.selectionHash, hashExecutionSelection(executionSelection()));
  assert.deepEqual(
    h.runtime.consume(r.useCapability, h.owner)?.executionSelection,
    executionSelection(),
  );
  assert.equal(h.runtime.consume(r.useCapability, h.owner), null);
});

/**
 * 明示選定を完全に保持する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("明示選定を完全に保持する", () => {
  const h = fixture();
  const fixed = executionSelection("executor", {
    provider: "claude",
    model: "opus",
    effort: "high",
  });
  const r = h.runtime.issue(h.owner, request({ executionSelection: fixed }));
  assert.equal(r.status, "issued");
  assert.deepEqual(r.executionSelection, fixed);
  assert.deepEqual(
    h.runtime.consume(r.useCapability, h.owner)?.executionSelection,
    fixed,
  );
});

/**
 * control失効で全aliasを失効する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("control失効で全aliasを失効する", () => {
  const h = fixture();
  const r = h.runtime.issue(h.owner, request());
  assert.equal(
    h.runtime.revoke(r.controlCapability, h.owner).status,
    "revoked",
  );
  assert.equal(h.runtime.consume(r.useCapability, h.owner), null);
  assert.equal(
    h.runtime.revoke(r.controlCapability, h.owner).status,
    "blocked",
  );
});

/**
 * 旧Profile・route・Tier入力を拒否する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("旧Profile・route・Tier入力を拒否する", () => {
  for (const key of [
    "frontProvider",
    "requestedProfileId",
    "modelTier",
    "route",
    "selectionNotice",
  ]) {
    const h = fixture();
    const r = h.runtime.issue(h.owner, request({ [key]: "legacy" }));
    assert.equal(r.status, "blocked");
    assert.equal(r.selectionCapabilityIssued, false);
  }
});

/**
 * 後続変更と実行可能Propertyを遮断する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("後続変更と実行可能Propertyを遮断する", () => {
  const h = fixture();
  const fixed = { ...executionSelection() };
  const r = h.runtime.issue(h.owner, request({ executionSelection: fixed }));
  fixed.modelIdentifier = "mutated";
  assert.notEqual(
    h.runtime.consume(r.useCapability, h.owner)?.executionSelection
      .modelIdentifier,
    "mutated",
  );
  let reads = 0;
  const raw = Object.defineProperty(request(), "executionSelection", {
    get() {
      reads++;
      return executionSelection();
    },
  });
  assert.equal(h.runtime.issue(h.owner, raw).status, "blocked");
  assert.equal(
    h.runtime.issue(
      h.owner,
      new Proxy(request(), {
        ownKeys() {
          reads++;
          throw Error();
        },
      }),
    ).status,
    "blocked",
  );
  assert.equal(reads, 0);
});

/**
 * 同じ選定と試行の更新だけを受理する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("同じ選定と試行の更新だけを受理する", () => {
  const h = fixture();
  const r = h.runtime.issue(h.owner, request());
  const next = h.runtime.supersede(r.controlCapability, h.owner, request());
  assert.equal(next.status, "issued");
  assert.equal(h.runtime.consume(r.useCapability, h.owner), null);
  assert.ok(h.runtime.consume(next.useCapability, h.owner));
});

/**
 * 差替えの更新拒否で元Grantを維持する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("差替えの更新拒否で元Grantを維持する", () => {
  for (const replacement of [
    request({ taskAttempt: 1 }),
    request({
      executionSelection: executionSelection("executor", {
        provider: "claude",
        model: "opus",
        effort: "high",
      }),
    }),
  ]) {
    const h = fixture();
    const r = h.runtime.issue(h.owner, request());
    assert.equal(
      h.runtime.supersede(r.controlCapability, h.owner, replacement).status,
      "blocked",
    );
    assert.ok(h.runtime.consume(r.useCapability, h.owner));
  }
});

/**
 * 別操作・技術不対応・利用不能を拒否する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("別操作・技術不対応・利用不能を拒否する", () => {
  const h = fixture();
  for (const raw of [
    request({ operationId: "OP-999999" }),
    request({ taskAttempt: 2 }),
    request({
      executionSelection: {
        ...executionSelection(),
        modelIdentifier: "retired-model",
      },
    }),
  ])
    assert.equal(h.runtime.issue(h.owner, raw).status, "blocked");
  const unavailable = fixture({
    observeProviderEligibility: () => [
      { provider: "codex", status: "ineligible", reason: "unknown" },
      { provider: "claude", status: "eligible", reason: "ready" },
    ],
  });
  assert.equal(
    unavailable.runtime.issue(unavailable.owner, request()).status,
    "blocked",
  );
  const r = h.runtime.issue(h.owner, request());
  assert.equal(h.runtime.consume(r.useCapability, {}), null);
  assert.ok(h.runtime.consume(r.useCapability, h.owner));
});

/**
 * 期限・巻戻し・乱数衝突を拒否する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("期限・巻戻し・乱数衝突を拒否する", () => {
  for (const action of ["expire", "rollback"] as const) {
    const h = fixture();
    const r = h.runtime.issue(h.owner, request());
    h[action]();
    assert.equal(h.runtime.consume(r.useCapability, h.owner), null);
  }
  const h = fixture({ randomBytes: (size) => Buffer.alloc(size, 1) });
  assert.equal(h.runtime.issue(h.owner, request()).status, "issued");
  assert.equal(h.runtime.issue(h.owner, request()).status, "blocked");
});

/**
 * 本番入口で偽造操作を拒否する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("本番入口で偽造操作を拒否する", () => {
  assert.equal(
    issueRuntimeOwnedDelegationSelectionGrant({}, request()).status,
    "blocked",
  );
  assert.equal(consumeRuntimeOwnedDelegationSelectionGrant({}, {}), null);
  assert.equal(
    revokeRuntimeOwnedDelegationSelectionGrant({}, {}).status,
    "blocked",
  );
  assert.equal(
    supersedeRuntimeOwnedDelegationSelectionGrant({}, {}, request()).status,
    "blocked",
  );
});

/**
 * 公開記述を固定する。
 * @responsibility 完全選定の相関・拒否・消費を確認する。
 * @trace PRL-UT-006
 * @precondition 合成操作と選定を使う。
 * @stimulus 発行・消費・失効を行う。
 * @observation 固定値と拒否結果を確認する。
 * @oracle 本文assertionを満たす。
 * @cleanup N/A: 外部資源なし。
 * @boundary PRL-UT-006=N/A: Process内の合成値だけ。
 */
test("公開記述を固定する", () => {
  const c = describeDelegationSelectionGrantRuntimeContract();
  assert.equal(c.contractRevision, 5);
  assert.equal(c.maximumUses, 1);
  assert.equal(c.selectionLifetimeMs, 30000);
  assert.equal(c.providerEffectAllowed, false);
  assert.equal(c.reselection, "same_fixed_selection_and_attempt_only");
});
