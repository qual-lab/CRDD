/**
 * crdd-domain-library:system:quality-change-controlの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Package公開入口から変更全体の品質Gateと是正後再入場を検証する。
 * @trace CQS-ST-005
 * @trace CQS-ST-008
 * @trace CQS-ST-009
 * @level ST
 * @scope quality-center、release-gate、audit-set、remediation
 * @boundary Package公開入口→品質状態統合→Release候補表示
 */
import assert from "node:assert/strict";
import test from "node:test";
import { qualityChangeControl } from "../../src/index.ts";

/**
 * 必須確認が揃わない候補をRelease可能と表示しないことを検証する。
 *
 * @responsibility 異なる確認状態を含む変更全体から現在Gateを生成する。
 * @trace CQS-ST-005
 * @precondition Pass、未実施、確認不能を含む固定候補を用意する。
 * @stimulus Package公開入口から品質Gateを統合する。
 * @observation state、missingCheckIds、blockedCheckIdsを観測する。
 * @oracle 必須確認が揃わない限りunder_reviewとなり不足を保持する。
 * @cleanup N/A: Process、FilesystemまたはRelease Effectを発行しない。
 * @boundary System/E2E: Package公開入口から変更全体の現在Gateまでを通す。
 */
test("必須確認が揃わない候補をRelease可能と表示しない", () => {
  const candidate = qualityChangeControl.fixQualityCandidate("revision-3", [
    "document-audit",
    "gap-audit",
    "signed-e2e",
  ]);
  const gate = qualityChangeControl.integrateQualityGate(candidate, [
    { checkId: "document-audit", revision: "revision-3", status: "pass" },
    {
      checkId: "signed-e2e",
      revision: "revision-3",
      status: "blocked",
      reason: "signature not issued",
    },
  ]);
  assert.equal(gate.state, "under_review");
  assert.deepEqual(gate.missingCheckIds, ["gap-audit"]);
  assert.deepEqual(gate.blockedCheckIds, ["signed-e2e"]);
});

/**
 * 全必須監査が同じ固定改訂版に属する場合だけGateを閉じることを検証する。
 *
 * @responsibility 監査集合の欠落、途中縮小、別改訂版混入をRelease Gateから排除する。
 * @trace CQS-ST-008
 * @precondition 固定した三監査と同一改訂版の結果を用意する。
 * @stimulus 完全集合、欠落集合、別改訂版結果をPackage公開入口へ渡す。
 * @observation verified、under_review、revision mismatchを観測する。
 * @oracle 完全集合だけverifiedとなり反例はRelease可能にならない。
 * @cleanup N/A: Release Effectを発行しない。
 * @boundary System/E2E: 変更全体→全必須監査→現在Gate。
 */
test("全必須監査が同じ固定改訂版に属する場合だけGateを閉じる", () => {
  const requiredCheckIds = ["document", "conformance", "gap"];
  const candidate = qualityChangeControl.fixQualityCandidate(
    "revision-3",
    requiredCheckIds,
  );
  requiredCheckIds.pop();
  const complete = qualityChangeControl.integrateQualityGate(candidate, [
    { checkId: "document", revision: "revision-3", status: "pass" },
    { checkId: "conformance", revision: "revision-3", status: "pass" },
    { checkId: "gap", revision: "revision-3", status: "pass" },
  ]);
  assert.equal(complete.state, "verified");

  const incomplete = qualityChangeControl.integrateQualityGate(candidate, [
    { checkId: "document", revision: "revision-3", status: "pass" },
    { checkId: "conformance", revision: "revision-3", status: "pass" },
  ]);
  assert.equal(incomplete.state, "under_review");
  assert.deepEqual(incomplete.missingCheckIds, ["gap"]);
  assert.throws(
    () =>
      qualityChangeControl.integrateQualityGate(candidate, [
        { checkId: "document", revision: "revision-2", status: "pass" },
      ]),
    /check_result_revision_mismatch/u,
  );
});

/**
 * 是正後の新固定改訂版では全必須確認を再実行することを検証する。
 *
 * @responsibility 旧Passを隔離し新改訂版だけで現在Gateを再構築する。
 * @trace CQS-ST-009
 * @precondition 旧候補、旧Pass、是正後の新改訂版を用意する。
 * @stimulus Package公開入口から再入場し、新候補を結果なしで統合する。
 * @observation revision、state、missingCheckIdsを観測する。
 * @oracle 新改訂版はunder_reviewへ戻り旧結果を一件も継承しない。
 * @cleanup N/A: Release Effectを発行しない。
 * @boundary System/E2E: 指摘→是正→新固定改訂版→現在Gate再構築。
 */
test("是正後の新固定改訂版では全必須確認を再実行する", () => {
  const previous = qualityChangeControl.fixQualityCandidate("revision-2", [
    "document-audit",
    "gap-audit",
  ]);
  assert.equal(
    qualityChangeControl.integrateQualityGate(previous, [
      { checkId: "document-audit", revision: "revision-2", status: "pass" },
      { checkId: "gap-audit", revision: "revision-2", status: "pass" },
    ]).state,
    "verified",
  );
  const remediated = qualityChangeControl.reenterQualityReview(
    previous,
    "revision-3",
  );
  const current = qualityChangeControl.integrateQualityGate(remediated, []);
  assert.equal(current.state, "under_review");
  assert.equal(current.revision, "revision-3");
  assert.deepEqual(current.missingCheckIds, ["document-audit", "gap-audit"]);
});
