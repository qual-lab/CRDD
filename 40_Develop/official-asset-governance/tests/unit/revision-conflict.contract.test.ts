/**
 * 公式素材のRevision競合規則を単位境界で検証する。
 *
 * @packageDocumentation
 * @responsibility 一致Revisionだけが判断を進め、古い判断が共有状態を上書きしないことを検証する。
 * @trace OAG-UT-008
 * @level UT
 * @scope official-asset-governance、revision、conflict、effect-zero
 * @boundary N/A: 純粋なDomain判断だけを検証する。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOfficialAssetDecision,
  type OfficialAssetDecisionInput,
  type OfficialAssetRecord,
} from "../../src/index.ts";

/**
 * Revision試験用の候補Recordを構築する。
 *
 * @responsibility 競合以外の条件を固定した候補状態をTest Caseへ渡す。
 * @trace OAG-UT-008
 * @precondition N/A: 固定値だけを使用する。
 * @stimulus assetId、素材版およびRecord Revisionを固定する。
 * @observation 有効な候補Recordを返す。
 * @oracle candidateかつrecordRevision 4のRecordになる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary N/A: Process内fixtureだけを構築する。
 */
function candidate(): OfficialAssetRecord {
  return Object.freeze({
    assetId: "asset-a",
    assetRevision: "asset-revision-a",
    sourceStatement: "created by the repository owner",
    rightsBasis: null,
    allowedPurposes: Object.freeze([]),
    decisionAuthorityId: null,
    decidedAt: null,
    targetRelease: null,
    state: "candidate",
    recordRevision: 4,
  });
}

/**
 * Revision試験用の採用判断を構築する。
 *
 * @responsibility 期待Revisionだけを変更できる完全な判断入力をTest Caseへ渡す。
 * @trace OAG-UT-008
 * @precondition expectedRecordRevisionは非負の整数である。
 * @stimulus 固定素材へ採用判断を作成する。
 * @observation 判断入力を返す。
 * @oracle 権利根拠、用途、判断者および対象版がすべて埋まる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary N/A: Process内fixtureだけを構築する。
 */
function decision(expectedRecordRevision: number): OfficialAssetDecisionInput {
  return Object.freeze({
    assetId: "asset-a",
    assetRevision: "asset-revision-a",
    expectedRecordRevision,
    decision: "approve",
    rightsBasis: "owner-approved redistribution",
    allowedPurposes: Object.freeze(["documentation"]),
    decisionAuthorityId: "asset-owner-a",
    decidedAt: "2026-09-22T12:00:00.000Z",
    targetRelease: "v0.21.0",
  });
}

/**
 * 古いRevisionの判断が勝者状態を上書きしないことを検証する。
 *
 * @responsibility 同じ期待Revisionを持つ二判断の後着側をEffect 0で拒否する。
 * @trace OAG-UT-008
 * @precondition 二判断は同じ候補Record Revision 4を観測している。
 * @stimulus 第一判断を適用後、その更新結果へ同じ期待Revisionの第二判断を適用する。
 * @observation 勝者Revision、敗者理由およびStore Effect許可を観測する。
 * @oracle 第一判断だけがRevision 5へ進み、第二判断はrevision_conflictかつEffect 0となる。
 * @cleanup N/A: 純粋値だけを使用する。
 * @boundary N/A: Domain単位境界から外部Effectを発行しない。
 */
test("古いRevisionの判断は勝者状態を上書きしない", () => {
  const first = applyOfficialAssetDecision(candidate(), decision(4));
  assert.equal(first.status, "completed");
  if (first.status !== "completed") return;

  const second = applyOfficialAssetDecision(first.record, decision(4));
  assert.deepEqual(second, {
    status: "blocked",
    reason: "official_asset_decision_revision_conflict",
    currentRecordRevision: 5,
    storeEffectIssued: false,
  });
  assert.equal(first.record.state, "approved");
});
