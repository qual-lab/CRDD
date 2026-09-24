/**
 * crdd-domain-library:integration:quality-change-controlの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 固定改訂版と必須確認集合による品質Gate統合と是正後再入場を検証する。
 * @trace CQS-IT-002
 * @trace CQS-IT-003
 * @trace CQS-IT-004
 * @trace CQS-IT-008
 * @trace CQS-IT-009
 * @level IT
 * @scope quality-gate、audit-set、revision、remediation
 * @boundary Quality確認結果→Domain統合→現在Gate
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  fixQualityCandidate,
  integrateQualityGate,
  reenterQualityReview,
} from "../../src/quality-change-control/index.ts";

/**
 * 同じ固定改訂版の全必須確認だけをverifiedへ統合することを検証する。
 *
 * @responsibility 必須確認集合、同一改訂版および全件Passの統合条件を検証する。
 * @trace CQS-IT-008
 * @precondition 固定改訂版と全必須確認のPass結果を用意する。
 * @stimulus integrateQualityGateへ全結果を渡す。
 * @observation state、missing、finding、blockedを観測する。
 * @oracle 同じ改訂版の全必須確認だけがverifiedとなる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary Related 2 Blocks: 固定候補と独立確認結果から現在Gateを統合する。
 */
test("同じ固定改訂版の全必須確認だけをverifiedへ統合する", () => {
  const candidate = fixQualityCandidate("revision-2", [
    "document-audit",
    "gap-audit",
  ]);
  const gate = integrateQualityGate(candidate, [
    { checkId: "document-audit", revision: "revision-2", status: "pass" },
    { checkId: "gap-audit", revision: "revision-2", status: "pass" },
  ]);
  assert.equal(gate.state, "verified");
  assert.deepEqual(gate.missingCheckIds, []);
  assert.deepEqual(gate.findingCheckIds, []);
  assert.deepEqual(gate.blockedCheckIds, []);
});

/**
 * 欠落した必須確認を全体Passへ畳まないことを検証する。
 *
 * @responsibility 部分Passと必須確認集合縮小の拒否条件を検証する。
 * @trace CQS-IT-003
 * @precondition 二件の必須確認に対して一件だけ結果を用意する。
 * @stimulus integrateQualityGateへ部分結果を渡す。
 * @observation stateとmissingCheckIdsを観測する。
 * @oracle under_reviewとなり元の必須確認集合と欠落Identityを保持する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary Quality確認集合と全体Gateの統合境界。
 */
test("欠落した必須確認を全体Passへ畳まない", () => {
  const sourceCheckIds = ["document-audit", "gap-audit"];
  const candidate = fixQualityCandidate("revision-2", sourceCheckIds);
  sourceCheckIds.pop();
  const gate = integrateQualityGate(candidate, [
    { checkId: "document-audit", revision: "revision-2", status: "pass" },
  ]);
  assert.equal(gate.state, "under_review");
  assert.deepEqual(gate.requiredCheckIds, ["document-audit", "gap-audit"]);
  assert.deepEqual(gate.missingCheckIds, ["gap-audit"]);
  assert.equal(Object.isFrozen(candidate.requiredCheckIds), true);
});

/**
 * 別改訂版の古いPassを現在Gateへ混入させないことを検証する。
 *
 * @responsibility 改訂版Freshnessと旧結果隔離を検証する。
 * @trace CQS-IT-002
 * @precondition 現行候補と旧改訂版のPass結果を用意する。
 * @stimulus integrateQualityGateへ旧結果を渡す。
 * @observation 送出するreason codeを観測する。
 * @oracle check_result_revision_mismatchとして拒否する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary 改訂版別確認結果と現在Gateの境界。
 */
test("別改訂版の古いPassを現在Gateへ混入させない", () => {
  const candidate = fixQualityCandidate("revision-2", ["document-audit"]);
  assert.throws(
    () =>
      integrateQualityGate(candidate, [
        {
          checkId: "document-audit",
          revision: "revision-1",
          status: "pass",
        },
      ]),
    /check_result_revision_mismatch/u,
  );
});

/**
 * 指摘と確認不能を合格から分離することを検証する。
 *
 * @responsibility findingとblockedを異なる未完了状態として保持する。
 * @trace CQS-IT-004
 * @precondition 同じ改訂版のfindingとblocked結果を用意する。
 * @stimulus 各結果集合をintegrateQualityGateへ渡す。
 * @observation state、findingCheckIds、blockedCheckIdsを観測する。
 * @oracle findingはchanges_required、blockedはunder_reviewとなる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary 独立確認状態と現在Gate状態の変換境界。
 */
test("指摘と確認不能を合格から分離する", () => {
  const candidate = fixQualityCandidate("revision-2", ["document-audit"]);
  const finding = integrateQualityGate(candidate, [
    {
      checkId: "document-audit",
      revision: "revision-2",
      status: "finding",
    },
  ]);
  assert.equal(finding.state, "changes_required");
  assert.deepEqual(finding.findingCheckIds, ["document-audit"]);

  const blocked = integrateQualityGate(candidate, [
    {
      checkId: "document-audit",
      revision: "revision-2",
      status: "blocked",
      reason: "reviewer unavailable",
    },
  ]);
  assert.equal(blocked.state, "under_review");
  assert.deepEqual(blocked.blockedCheckIds, ["document-audit"]);
});

/**
 * 是正後は必須確認集合を維持して旧結果を流用しないことを検証する。
 *
 * @responsibility 新固定改訂版への再入場と全必須確認の再実行条件を検証する。
 * @trace CQS-IT-009
 * @precondition 指摘のある旧候補と異なる新改訂版を用意する。
 * @stimulus reenterQualityReviewで新候補を作り、結果なしでGateを統合する。
 * @observation revision、requiredCheckIds、missingCheckIds、stateを観測する。
 * @oracle 旧Passを持たず全必須確認がmissingのunder_reviewへ戻る。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary 是正後の新固定候補と再レビュー開始の境界。
 */
test("是正後は必須確認集合を維持して旧結果を流用しない", () => {
  const previous = fixQualityCandidate("revision-1", [
    "document-audit",
    "gap-audit",
  ]);
  const current = reenterQualityReview(previous, "revision-2");
  const gate = integrateQualityGate(current, []);
  assert.equal(gate.revision, "revision-2");
  assert.equal(gate.state, "under_review");
  assert.deepEqual(gate.missingCheckIds, ["document-audit", "gap-audit"]);
  assert.throws(
    () => reenterQualityReview(current, "revision-2"),
    /new_revision_required/u,
  );
});
