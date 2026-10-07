/**
 * Host残存保守候補の条件と権限非発行を検証する。
 *
 * @packageDocumentation
 * @responsibility 候補判定が未確認を拒否し、清掃完了へ昇格しないことを確認する。
 * @trace PRL-UT-006
 * @level UT
 * @scope Host Recoveryの内部Authority判定。公開入口・実清掃は対象外。
 * @boundary N/A: 外部資源を取得しない純粋Policyの試験。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateHostOrphanRecoveryPlan,
  type HostOrphanRecoveryEvidence,
} from "../../src/host-runtime/host-orphan-recovery-policy.ts";

const confirmed: HostOrphanRecoveryEvidence = Object.freeze({
  resourceClass: "empty_host_only_v1",
  snapshotSha256: "a".repeat(64),
  approval: "fresh_exact",
  ownerScope: "confirmed",
  identity: "exact",
  recordState: "host_only",
  children: "six_empty_exact",
  dockerBinding: "absent",
  nonUse: "confirmed",
  initializationFence: "confirmed",
  legacyFence: "confirmed",
  kernelLock: "held",
  durableIntent: "exact_non_authority_checkpoint",
});

/**
 * 全条件充足でも候補判定だけを返すことを検証する。
 *
 * @responsibility 条件充足をAuthority・実行・清掃完了へ読み替えない。
 * @trace PRL-UT-006
 * @precondition 全条件確認済みの局所fixture。
 * @stimulus fixtureを判定し、返却値を確認する。
 * @observation 状態、非発行field、入力・出力の不変性。
 * @oracle candidate_readyでもAuthority非発行・清掃未確認・本番未接続。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: 純粋な候補判定。
 */
test("Host保守候補の条件充足は権限や清掃完了ではない", () => {
  const result = evaluateHostOrphanRecoveryPlan(confirmed);
  assert.deepEqual(result, {
    status: "candidate_ready",
    reason: "host_orphan_candidate_conditions_satisfied",
    snapshotSha256: "a".repeat(64),
    authorityConferred: false,
    cleanupConfirmed: false,
    productionConnected: false,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(confirmed.approval, "fresh_exact");
  assert.equal(
    evaluateHostOrphanRecoveryPlan({ ...confirmed, legacyFence: "not_needed" })
      .status,
    "candidate_ready",
  );
});

/**
 * 必須根拠を一件ずつ未確認・不成立へ変えて拒否を確認する。
 *
 * @responsibility Lock単独、空領域単独または承認単独での実行可能判定を防ぐ。
 * @trace PRL-UT-006
 * @precondition 全条件fixtureから一条件だけを変えた入力。
 * @stimulus 全十一条件をunknown、不成立、欠落へそれぞれ変える。
 * @observation 各条件の拒否理由と非発行field。
 * @oracle 全入力がblockedとなり、Effect・清掃・本番接続を主張しない。
 * @cleanup N/A: 入力値だけを扱う。
 * @boundary N/A: 実観測・Lockは使用しない。
 */
test("Host保守候補は各必須条件のunknown・不成立・欠落を拒否する", () => {
  const failures = {
    approval: "denied",
    ownerScope: "mismatch",
    identity: "mismatch",
    recordState: "other",
    children: "different",
    dockerBinding: "present",
    nonUse: "in_use",
    initializationFence: "missing",
    legacyFence: "missing",
    kernelLock: "busy",
    durableIntent: "mismatch",
  };
  for (const [gate, failure] of Object.entries(failures)) {
    for (const value of ["unknown", failure, "", false, null, 42]) {
      const result = evaluateHostOrphanRecoveryPlan({
        ...confirmed,
        [gate]: value,
      });
      assert.equal(result.status, "blocked", gate);
      assert.equal(result.reason, `host_orphan_${gate}_unconfirmed`);
      assert.equal(result.authorityConferred, false);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.productionConnected, false);
    }
    const missing: Record<string, unknown> = { ...confirmed };
    delete missing[gate];
    assert.equal(evaluateHostOrphanRecoveryPlan(missing).status, "blocked");
  }
});

/**
 * 不正構造と未知の資源クラスを安全に拒否する。
 *
 * @responsibility 入力GetterやProxyを実行せず、未知の清掃範囲を受理しない。
 * @trace PRL-UT-006
 * @precondition 不正値、継承値、Accessor、Proxy、未知fieldを持つ入力。
 * @stimulus 全入力を判定する。
 * @observation blockedとGetter／Proxy trap未実行。
 * @oracle 不正値から実行可能候補を生成しない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: input検査だけを実行する。
 */
test("Host保守候補は不正入力を権限へ変換しない", () => {
  let accessorHits = 0;
  const accessor = { ...confirmed };
  Object.defineProperty(accessor, "approval", {
    get: () => {
      accessorHits += 1;
      throw new Error("must_not_run");
    },
    enumerable: true,
  });
  const proxy = new Proxy(confirmed, {
    ownKeys: () => {
      accessorHits += 1;
      throw new Error("must_not_run");
    },
  });
  for (const input of [
    null,
    undefined,
    "approved",
    [],
    Object.create(confirmed),
    accessor,
    proxy,
    { ...confirmed, extra: true },
    { ...confirmed, [Symbol("authority")]: true },
    { ...confirmed, snapshotSha256: "invalid" },
    { ...confirmed, resourceClass: "any_directory" },
  ]) {
    assert.equal(evaluateHostOrphanRecoveryPlan(input).status, "blocked");
  }
  assert.equal(
    evaluateHostOrphanRecoveryPlan(
      Object.assign(Object.create(null), confirmed),
    ).status,
    "candidate_ready",
  );
  assert.equal(accessorHits, 0);
});
