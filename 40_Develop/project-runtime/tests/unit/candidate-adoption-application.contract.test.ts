/**
 * project-runtime:unit:candidate-adoption-applicationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 既存候補の明示Authority、Lease、Revision／Scope再確認、Receiptおよび失敗後条件を検証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope project-runtime、candidate-adoption、application
 * @boundary PRL-UT-006=N/A: Fake Portを使うApplication内契約試験である。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  adoptProjectRuntimeExistingCandidate,
  type ProjectRuntimeCandidateAdoptionDependencies,
} from "../../src/index.ts";

const revision = "a".repeat(40);
const candidateId = `candidate.${"b".repeat(64)}.${"c".repeat(64)}`;
const candidateHash = "d".repeat(64);

/**
 * 採用Applicationの決定論的Fake依存を構築する。
 *
 * @responsibility Testごとの観測回数とPort結果を閉じたFixtureとして提供する。
 * @trace PRL-UT-006
 * @input options: dirty、receiptInvalid、releaseBlockedの任意Fault指定。
 * @returns 依存Portと呼出し回数観測を返す。
 * @precondition N/A: options省略時は正常系とする。
 * @postcondition 外部FilesystemまたはProcessへEffectを発行しない。
 * @effect N/A: Test局所Objectだけを構築する。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant 各Fixtureの回数Counterを他Testと共有しない。
 * @boundary TestとProject Runtime PortのFake境界。
 * @security 秘密値や実Repositoryを扱わない。
 * @concurrency N/A: Testごとに独立した同期Fixtureである。
 */
function fixture(
  options: Readonly<{
    dirty?: boolean;
    receiptInvalid?: boolean;
    releaseBlocked?: boolean;
  }> = {},
) {
  const calls = { reconcile: 0, acquire: 0, adopt: 0, record: 0, release: 0 };
  const completed = <T>(reason: string, value: T) =>
    Object.freeze({ status: "completed" as const, reason, value });
  const blocked = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      value: null,
      manualRecoveryRequired: true,
      recoveryId: "recovery-1",
    });
  const dependencies: ProjectRuntimeCandidateAdoptionDependencies =
    Object.freeze({
      candidate: Object.freeze({
        observeLeaseOwner: () => Object.freeze({ status: "not_running" }),
        observeCanonicalRepository: () =>
          Object.freeze({
            status: "observed",
            repositoryRevision: revision,
            dirty: options.dirty ?? false,
            observedPaths: Object.freeze(options.dirty ? ["result.txt"] : []),
          }),
        adoptCandidate: async () => {
          calls.adopt += 1;
          return options.receiptInvalid
            ? Object.freeze({ status: "completed" })
            : Object.freeze({
                status: "completed",
                receiptId: "adoption-receipt-1",
                beforeRevision: revision,
                afterRevision: revision,
                changedPaths: Object.freeze(["result.txt"]),
                cleanupConfirmed: true,
              });
        },
      }),
      lease: Object.freeze({
        reconcileAdoptionOwnerLoss: () => {
          calls.reconcile += 1;
          return completed("reconciled", Object.freeze({ recoveryId: null }));
        },
        acquire: () => {
          calls.acquire += 1;
          return completed(
            "acquired",
            Object.freeze({
              kind: "canonical-adoption" as const,
              ownerGeneration: "owner-1",
              release: () => {
                calls.release += 1;
                return options.releaseBlocked
                  ? blocked("release_unknown")
                  : completed("released", Object.freeze({ released: true }));
              },
            }),
          );
        },
        inspectAcquisitionOwner: () =>
          completed("observed", Object.freeze({ acquisition: null })),
        reconcileOperationOwnerLoss: () => blocked("operation_not_used"),
      }),
      records: Object.freeze({
        write: () => {
          calls.record += 1;
          return completed(
            "recorded",
            Object.freeze({ written: true as const }),
          );
        },
      }),
    });
  return Object.freeze({ dependencies, calls });
}

const input = Object.freeze({
  projectId: "project-a",
  candidate: Object.freeze({
    candidateId,
    candidateHash,
    baseRevision: revision,
    changedPaths: Object.freeze(["result.txt"]),
  }),
  allowedPaths: Object.freeze(["result.txt"]),
  adoptionAuthorized: true,
});

/**
 * 明示Authorityなしでは全外部Effect前に停止することを検証する。
 *
 * @responsibility 候補Identityまたは生成時確認が採用Authorityへ昇格しない合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition 正常候補を与え、adoptionAuthorizedだけをfalseにする。
 * @stimulus 既存候補採用Applicationを実行する。
 * @observation 結果理由と全Port呼出し回数を観測する。
 * @oracle authorization_requiredで停止し、Lease・採用・記録を呼ばない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PRL-UT-006=N/A: Fake Port内で完結する。
 */
test("明示Authorityなしでは全外部Effect前に停止する", async () => {
  const current = fixture();
  const result = await adoptProjectRuntimeExistingCandidate(
    current.dependencies,
    Object.freeze({ ...input, adoptionAuthorized: false }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "project_runtime_candidate_adoption_authorization_required",
  );
  assert.deepEqual(current.calls, {
    reconcile: 0,
    acquire: 0,
    adopt: 0,
    record: 0,
    release: 0,
  });
  assert.equal(result.effectIssued, false);
});

/**
 * 採用成功時はLease・再観測・Receipt記録・解放を完結することを検証する。
 *
 * @responsibility 正常な候補採用Lifecycleの全段階を観測する。
 * @trace PRL-UT-006
 * @precondition RevisionとScopeが一致する正常Fake Portを与える。
 * @stimulus 明示Authority付きで既存候補採用Applicationを実行する。
 * @observation 結果、Receiptおよび各Port呼出し回数を観測する。
 * @oracle completed、settled Effect、耐久記録一回、Lease解放一回となる。
 * @cleanup Fake Leaseのrelease呼出しを確認する。
 * @boundary PRL-UT-006=N/A: Fake Port内で完結する。
 */
test("採用成功時はLeaseとReceiptを完結する", async () => {
  const current = fixture();
  const result = await adoptProjectRuntimeExistingCandidate(
    current.dependencies,
    input,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "project_runtime_candidate_adopted");
  assert.equal(result.receiptId, "adoption-receipt-1");
  assert.equal(result.effectIssued, true);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(current.calls, {
    reconcile: 1,
    acquire: 1,
    adopt: 1,
    record: 1,
    release: 1,
  });
});

/**
 * 現在Scopeがdirtyなら採用Effect前で停止してLeaseを解放することを検証する。
 *
 * @responsibility 基準Revision一致だけでdirty変更対象を上書きしない合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition 対象Pathをdirtyとして返す観測Portを与える。
 * @stimulus 明示Authority付きで既存候補採用Applicationを実行する。
 * @observation 採用呼出し回数、Effect状態およびLease解放を観測する。
 * @oracle revision_or_scope_mismatch、Effect 0、採用0回、解放1回となる。
 * @cleanup Fake Leaseのrelease呼出しを確認する。
 * @boundary PRL-UT-006=N/A: Fake Port内で完結する。
 */
test("現在Scopeがdirtyなら採用Effect前で停止する", async () => {
  const current = fixture({ dirty: true });
  const result = await adoptProjectRuntimeExistingCandidate(
    current.dependencies,
    input,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "project_runtime_adoption_revision_or_scope_mismatch",
  );
  assert.equal(result.effectIssued, false);
  assert.equal(current.calls.adopt, 0);
  assert.equal(current.calls.release, 1);
});

/**
 * 採用後のReceipt不正はEffect不明と手動回復へ閉じることを検証する。
 *
 * @responsibility Effect発行後の観測不全を未発行または成功へ畳まない合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition 採用Portが契約外Receiptを返す。
 * @stimulus 明示Authority付きで既存候補採用Applicationを実行する。
 * @observation Effect状態、cleanup、回復要否およびLease解放を観測する。
 * @oracle effectStateUnknownかつmanualRecoveryRequiredとなり、記録せずLeaseを解放する。
 * @cleanup Fake Leaseのrelease呼出しを確認する。
 * @boundary PRL-UT-006=N/A: Fake Port内で完結する。
 */
test("採用後のReceipt不正はEffect不明として返す", async () => {
  const current = fixture({ receiptInvalid: true });
  const result = await adoptProjectRuntimeExistingCandidate(
    current.dependencies,
    input,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.effectIssued, true);
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(current.calls.record, 0);
  assert.equal(current.calls.release, 1);
});

/**
 * Lease解放不明は先行結果にかかわらず手動回復へ閉じることを検証する。
 *
 * @responsibility 排他資源の残存可能性を成功表示へ畳まない合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition 採用と記録は成功し、Lease releaseだけがblockedを返す。
 * @stimulus 明示Authority付きで既存候補採用Applicationを実行する。
 * @observation 最終状態、Effect、cleanupおよび回復要否を観測する。
 * @oracle lease_release_unknown、effectStateUnknown、manualRecoveryRequiredとなる。
 * @cleanup N/A: 解放不明をそのまま観測するFault試験である。
 * @boundary PRL-UT-006=N/A: Fake Port内で完結する。
 */
test("Lease解放不明は手動回復へ閉じる", async () => {
  const current = fixture({ releaseBlocked: true });
  const result = await adoptProjectRuntimeExistingCandidate(
    current.dependencies,
    input,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "project_runtime_adoption_lease_release_unknown");
  assert.equal(result.effectIssued, true);
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
});
