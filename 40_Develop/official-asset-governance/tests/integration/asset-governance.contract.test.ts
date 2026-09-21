/**
 * 公式素材の判断、競合および収載照合をDomain境界間で検証する。
 *
 * @packageDocumentation
 * @responsibility 完全な判断だけが一回成立し、収載先から判断根拠へ戻れ、不完全・競合入力がEffect 0となることを検証する。
 * @trace OAG-IT-005
 * @trace OAG-IT-006
 * @trace OAG-IT-007
 * @level IT
 * @scope official-asset-governance、decision、revision、inclusion、traceability
 * @boundary OAG-IT-005=Related 2 Blocks、OAG-IT-006／OAG-IT-007=Direct Boundary。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyOfficialAssetDecision,
  createFileOfficialAssetStore,
  executeOfficialAssetDecision,
  type OfficialAssetDecisionInput,
  type OfficialAssetRecord,
  verifyOfficialAssetInclusion,
} from "../../src/index.ts";

/**
 * 統合試験用の候補素材を構築する。
 *
 * @responsibility 判断と収載照合が共有する素材Identity、版および初期Revisionを固定する。
 * @trace OAG-IT-005
 * @trace OAG-IT-006
 * @trace OAG-IT-007
 * @precondition N/A: 固定値だけを使用する。
 * @stimulus 候補素材Recordを作成する。
 * @observation candidate状態のRecordを返す。
 * @oracle 権利、用途および判断者は未確定のまま保持される。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary OAG-IT-005=Related 2 Blocks、OAG-IT-006／OAG-IT-007=Direct Boundary。
 */
function candidate(): OfficialAssetRecord {
  return Object.freeze({
    assetId: "asset-brand-a",
    assetRevision: "sha256:asset-a",
    sourceStatement: "submitted by the asset owner",
    rightsBasis: null,
    allowedPurposes: Object.freeze([]),
    decisionAuthorityId: null,
    decidedAt: null,
    targetRelease: null,
    state: "candidate",
    recordRevision: 1,
  });
}

/**
 * 統合試験用の判断入力を構築する。
 *
 * @responsibility 素材版、期待Revision、権利根拠、用途、判断者および対象Releaseを同じ入力へ固定する。
 * @trace OAG-IT-006
 * @trace OAG-IT-007
 * @precondition overridesは固定契約内のfieldだけを置換する。
 * @stimulus 完全な採用判断へ指定差分を適用する。
 * @observation 不変の判断入力を返す。
 * @oracle 置換しないfieldは完全な採用条件を満たす。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary OAG-IT-006／OAG-IT-007=Direct Boundary。
 */
function decision(
  overrides: Partial<OfficialAssetDecisionInput> = {},
): OfficialAssetDecisionInput {
  return Object.freeze({
    assetId: "asset-brand-a",
    assetRevision: "sha256:asset-a",
    expectedRecordRevision: 1,
    decision: "approve",
    rightsBasis: "owner grant for documentation",
    allowedPurposes: Object.freeze(["documentation"]),
    decisionAuthorityId: "asset-owner-a",
    decidedAt: "2026-09-22T12:00:00.000Z",
    targetRelease: "v0.21.0",
    ...overrides,
  });
}

/**
 * 完全な判断の収載先から根拠へ戻れることを検証する。
 *
 * @responsibility 収載照合境界を同じ素材Identity、版、Record Revisionおよび用途で接続する。
 * @trace OAG-IT-005
 * @precondition 候補素材と完全な採用判断を用意する。
 * @stimulus 判断を適用し、その結果へ一致する収載Relationを照合する。
 * @observation 更新状態、Revision、用途、判断者および照合結果を観測する。
 * @oracle approved Revision 2となり、同じ用途・版・Releaseの収載だけがverifiedとなる。
 * @cleanup N/A: 外部公開、再配布およびFilesystem Effectを発行しない。
 * @boundary OAG-IT-005=Related 2 Blocks: Asset Record→Inclusion Relation→Official Repository。
 */
test("完全な判断の収載先から根拠へ戻れる", () => {
  const applied = applyOfficialAssetDecision(candidate(), decision());
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") return;
  assert.equal(applied.record.state, "approved");
  assert.equal(applied.record.recordRevision, 2);
  assert.equal(applied.record.decisionAuthorityId, "asset-owner-a");

  const inclusion = verifyOfficialAssetInclusion(applied.record, {
    inclusionId: "official-logo-a",
    assetId: "asset-brand-a",
    assetRevision: "sha256:asset-a",
    decisionRecordRevision: 2,
    allowedPurpose: "documentation",
    targetRelease: "v0.21.0",
  });
  assert.deepEqual(inclusion, {
    status: "verified",
    reason: "official_asset_inclusion_verified",
  });
});

/**
 * 完全な判断だけが素材状態へ一回適用されることを検証する。
 *
 * @responsibility 判断主体、用途、対象Revisionおよび権利根拠が揃う場合だけ公式素材Store更新を許可する。
 * @trace OAG-IT-007
 * @precondition 候補素材と完全な採用判断を用意する。
 * @stimulus 判断Recordを公式素材Domain境界へ適用する。
 * @observation 更新状態、Record Revision、判断者およびStore Effect許可を観測する。
 * @oracle approved Revision 2となり、一回のStore Effectだけが許可される。
 * @cleanup N/A: Domain結果だけを観測しFilesystem Effectを発行しない。
 * @boundary OAG-IT-007=Direct Boundary: Decision Record→Official Asset Store。
 */
test("完全な判断だけが素材状態へ一回適用される", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createFileOfficialAssetStore(
    path.join(root, "asset.json"),
    candidate(),
  );
  const applied = executeOfficialAssetDecision(
    store,
    { verify: (input) => input.decisionAuthorityId === "asset-owner-a" },
    decision(),
  );
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") return;
  assert.equal(applied.record.state, "approved");
  assert.equal(applied.record.recordRevision, 2);
  assert.equal(applied.record.decisionAuthorityId, "asset-owner-a");
  assert.equal(applied.storeEffectIssued, true);
  assert.equal(store.read().recordRevision, 2);
});

/**
 * 不完全な判断を収載Effect前で拒否することを検証する。
 *
 * @responsibility 判断者、用途、根拠または対象版が不足する入力から公式収載可能状態を作らない。
 * @trace OAG-IT-007
 * @precondition 有効な候補素材を用意する。
 * @stimulus 空の権利根拠および用途を持つ採用判断を適用する。
 * @observation 理由code、現行RevisionおよびStore Effect許可を観測する。
 * @oracle input_invalid、Revision 1、Store Effect 0となる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary OAG-IT-007=Direct Boundary: Decision Record→Official Asset Store。
 */
test("不完全な判断を収載Effect前で拒否する", () => {
  const result = applyOfficialAssetDecision(
    candidate(),
    decision({ rightsBasis: "", allowedPurposes: Object.freeze([]) }),
  );
  assert.deepEqual(result, {
    status: "blocked",
    reason: "official_asset_decision_input_invalid",
    currentRecordRevision: 1,
    storeEffectIssued: false,
  });
});

/**
 * 競合する同一Revision判断の後着側を上書きせず拒否することを検証する。
 *
 * @responsibility 共有最終状態、勝者Revision、敗者理由および要求別Effectを相関する。
 * @trace OAG-IT-006
 * @precondition 同じ候補Revisionを観測した採用判断と制限判断を用意する。
 * @stimulus 採用判断の更新結果へ古いRevisionの制限判断を適用する。
 * @observation 勝者状態、勝者Revision、敗者理由およびStore Effectを観測する。
 * @oracle 勝者approved Revision 2を保持し、敗者はrevision_conflictかつEffect 0となる。
 * @cleanup N/A: 純粋値だけを使用する。
 * @boundary OAG-IT-006=Direct Boundary: Concurrent Decision→Official Asset Store。
 */
test("競合する同一Revision判断の後着側を上書きせず拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-conflict-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createFileOfficialAssetStore(
    path.join(root, "asset.json"),
    candidate(),
  );
  const authority = { verify: () => true };
  const first = executeOfficialAssetDecision(store, authority, decision());
  assert.equal(first.status, "completed");
  if (first.status !== "completed") return;

  const second = executeOfficialAssetDecision(
    store,
    authority,
    decision({
      decision: "restrict",
      allowedPurposes: Object.freeze(["internal-review"]),
    }),
  );
  assert.equal(first.record.state, "approved");
  assert.equal(first.record.recordRevision, 2);
  assert.equal(store.read().state, "approved");
  assert.deepEqual(second, {
    status: "blocked",
    reason: "official_asset_decision_revision_conflict",
    currentRecordRevision: 2,
    storeEffectIssued: false,
  });
});

/**
 * 判断Relationが異なる素材版、用途またはRevisionを収載済みと扱わないことを検証する。
 *
 * @responsibility 素材Recordと公式収載先の欠落・不一致を一意な拒否へ閉じる。
 * @trace OAG-IT-005
 * @precondition 完全な採用判断を適用済みである。
 * @stimulus 別用途の収載Relationを照合する。
 * @observation 照合状態と理由codeを観測する。
 * @oracle mismatchとなり、外部公開・再配布Effectは発行されない。
 * @cleanup N/A: 読取り済み値だけを比較する。
 * @boundary OAG-IT-005=Related 2 Blocks: Asset Record→Inclusion Relation→Official Repository。
 */
test("判断Relationが異なる用途を収載済みと扱わない", () => {
  const applied = applyOfficialAssetDecision(candidate(), decision());
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") return;

  assert.deepEqual(
    verifyOfficialAssetInclusion(applied.record, {
      inclusionId: "official-logo-a",
      assetId: "asset-brand-a",
      assetRevision: "sha256:asset-a",
      decisionRecordRevision: 2,
      allowedPurpose: "advertising",
      targetRelease: "v0.21.0",
    }),
    {
      status: "blocked",
      reason: "official_asset_inclusion_mismatch",
    },
  );
});
