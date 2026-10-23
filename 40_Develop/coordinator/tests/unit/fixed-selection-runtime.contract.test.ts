/**
 * coordinator:unit:fixed-selection-grantの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:fixed-selection-grantが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope provider、model、fixed-selection
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { executionSelection } from "../fixtures/ai-selection.ts";
import { createIsolatedDelegationSelectionGrantRuntimeCandidate } from "../../src/execution/authority.ts";

/**
 * 技術Catalogの固定選定を一回の操作へ結合する。
 * @responsibility Provider・Model・種別・役割を差し替えず旧Profile要求を拒否する。
 * @trace PRL-UT-014
 * @precondition 二Providerの採用済み技術値を合成する。
 * @stimulus 正常・旧形・技術不対応を発行して一回消費する。
 * @observation 固定選定、非発行フラグと重複消費拒否。
 * @oracle 正常だけが元の完全選定を一回返し、拒否はEffect 0。
 * @cleanup N/A: Process内だけ。
 * @boundary PRL-UT-014=N/A: 合成Capabilityと技術Catalog。
 */
test("技術Catalogの固定選定を一回の操作へ結合する", () => {
  for (const provider of ["codex", "claude"] as const) {
    const owner = Object.freeze({});
    let random = 0;
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
      wallNow: () => 1000,
      monotonicNow: () => 2000,
      randomBytes: (n) => Buffer.alloc(n, ++random),
    });
    const selected = executionSelection("executor", {
      provider,
      model: provider === "codex" ? "gpt-5.5" : "opus",
      effort: "low",
    });
    for (const request of [
      {
        operationId: "OP-123456",
        taskAttempt: 0,
        executionSelection: { ...selected, modelIdentifier: "retired-model" },
      },
      {
        operationId: "OP-123456",
        requestedProfileId: "PROFILE-100001",
        taskAttempt: 0,
        executionSelection: selected,
      },
    ]) {
      const r = runtime.issue(owner, request);
      assert.equal(r.status, "blocked");
      assert.equal(r.providerAuthorityIssued, false);
      assert.equal(r.providerEffectAllowed, false);
    }
    const r = runtime.issue(owner, {
      operationId: "OP-123456",
      taskAttempt: 0,
      executionSelection: selected,
    });
    assert.equal(r.status, "issued");
    assert.deepEqual(r.executionSelection, selected);
    assert.deepEqual(
      runtime.consume(r.useCapability, owner)?.executionSelection,
      selected,
    );
    assert.equal(runtime.consume(r.useCapability, owner), null);
  }
});
