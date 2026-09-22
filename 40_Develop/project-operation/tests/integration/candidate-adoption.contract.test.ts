/**
 * Project Operation候補の採否と所有正本Effect境界を検証する。
 *
 * @packageDocumentation
 * @responsibility Authority・出所・Owner不足をEffect 0で拒否し、明示採用とRevision競合を分離することを検証する。
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @level IT
 * @scope project-operation、candidate、authority、owner、revision-conflict
 * @boundary CPR-IT-004／CPR-IT-006=Direct Boundary: Candidate Store→Authority Gate→Owner Writer。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyProjectOperationCandidateDecision,
  createFileProjectOperationCandidateStore,
  createFileProjectOperationOwnerWriter,
  executeFileProjectOperationCandidateDecision,
  type ProjectOperationCandidate,
  type ProjectOperationCandidateDecision,
} from "../../src/index.ts";
import { createFilesystemStoreRoot } from "../../../crdd-domain-library/src/filesystem-store-root/index.ts";

/**
 * 候補採否試験用の候補を構築する。
 *
 * @responsibility Authority以外の成立条件を固定した候補SnapshotをTest Caseへ渡す。
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @precondition overridesは候補契約内のfieldだけを置換する。
 * @stimulus 有効な候補へ指定差分を適用する。
 * @observation 不変の候補Snapshotを返す。
 * @oracle 置換しないfieldはcreatedかつOwner Revision 4の成立条件を満たす。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary CPR-IT-004／CPR-IT-006=Direct Boundary: Candidate Store→Authority Gate。
 */
function candidate(
  overrides: Partial<ProjectOperationCandidate> = {},
): ProjectOperationCandidate {
  return Object.freeze({
    candidateId: "candidate-001",
    sourceId: "meeting-042",
    sourceRevision: "sha256:source",
    targetOwner: "22_Topics/TOPIC-001",
    expectedOwnerRevision: 4,
    mediumLabel: "Teams",
    state: "created",
    ...overrides,
  });
}

/**
 * 候補採否試験用の判断入力を構築する。
 *
 * @responsibility 有効な採用判断を固定し、Authority、Revisionまたは判断種別だけを変更可能にする。
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @precondition overridesは判断契約内のfieldだけを置換する。
 * @stimulus Authority確認済みの採用判断へ指定差分を適用する。
 * @observation 不変の判断入力を返す。
 * @oracle 置換しないfieldはOwner Revision 4への採用条件を満たす。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary CPR-IT-004／CPR-IT-006=Direct Boundary: Authority Gate→Owner Writer。
 */
function decision(
  overrides: Partial<ProjectOperationCandidateDecision> = {},
): ProjectOperationCandidateDecision {
  return Object.freeze({
    decision: "adopt",
    principalId: "project-owner",
    authorityVerified: true,
    observedOwnerRevision: 4,
    ...overrides,
  });
}

/**
 * Authorityまたは候補の必須Relationが不足すると正本Effectを発行しないことを検証する。
 *
 * @responsibility 候補の出所・Ownerと人間Authorityを採用前の独立した必須条件として検証する。
 * @trace CPR-IT-004
 * @precondition Authority不足、Source不足およびOwner不足の候補判断を用意する。
 * @stimulus 各判断を候補採否境界へ適用する。
 * @observation 状態、理由およびOwner Effect有無を観測する。
 * @oracle すべてblockedとなり、理由を区別し、Owner Effectは0となる。
 * @cleanup N/A: Domain結果だけを観測し外部Effectを発行しない。
 * @boundary CPR-IT-004=Direct Boundary: Candidate Store→Authority Gate→Owner Writer。
 */
test("Authorityまたは候補Relation不足をEffect前で拒否する", () => {
  const unauthorized = applyProjectOperationCandidateDecision(
    candidate(),
    decision({ authorityVerified: false }),
  );
  const sourceMissing = applyProjectOperationCandidateDecision(
    candidate({ sourceId: "" }),
    decision(),
  );
  const ownerMissing = applyProjectOperationCandidateDecision(
    candidate({ targetOwner: "" }),
    decision(),
  );

  assert.equal(
    unauthorized.reason,
    "project_operation_candidate_authority_invalid",
  );
  assert.equal(sourceMissing.reason, "project_operation_candidate_invalid");
  assert.equal(ownerMissing.reason, "project_operation_candidate_invalid");
  assert.equal(unauthorized.ownerEffectIssued, false);
  assert.equal(sourceMissing.ownerEffectIssued, false);
  assert.equal(ownerMissing.ownerEffectIssued, false);
});

/**
 * 明示採用だけが一回の正本Effectとなり、競合や非採用判断はEffect 0となることを検証する。
 *
 * @responsibility 判断種別、Revisionおよび媒体表示を採否結果と相関し、媒体名から意味を推定しない。
 * @trace CPR-IT-006
 * @precondition 同じ候補Snapshotへ採用、拒否、保留、競合および同一媒体名の別候補を用意する。
 * @stimulus 各判断を候補採否境界へ適用する。
 * @observation Candidate状態、次Revision、拒否理由およびOwner Effect有無を観測する。
 * @oracle 明示adoptだけがRevision 5とEffect 1になり、その他はEffect 0で、同じ媒体名も別Identityのまま扱う。
 * @cleanup N/A: 純粋値だけを使用する。
 * @boundary CPR-IT-006=Direct Boundary: Candidate Store→Authority Gate→Owner Writer。
 */
test("明示採用だけを正本Effectへ変換し競合と媒体名推定を拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-op-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  const candidateStore = createFileProjectOperationCandidateStore(
    storeRoot,
    "candidate.json",
    candidate(),
  );
  const owner = createFileProjectOperationOwnerWriter(
    storeRoot,
    "owner.json",
    4,
  );
  const adopted = executeFileProjectOperationCandidateDecision(
    storeRoot,
    "candidate.json",
    "owner.json",
    "operations/candidate-001.json",
    { verify: (_candidate, input) => input.principalId === "project-owner" },
    decision(),
  );
  const rejected = applyProjectOperationCandidateDecision(
    candidate(),
    decision({ decision: "reject" }),
  );
  const held = applyProjectOperationCandidateDecision(
    candidate(),
    decision({ decision: "hold" }),
  );
  const conflicted = applyProjectOperationCandidateDecision(
    candidate(),
    decision({ observedOwnerRevision: 3 }),
  );
  const sameMediumDifferentIdentity = applyProjectOperationCandidateDecision(
    candidate({
      candidateId: "candidate-002",
      sourceId: "chat-099",
      mediumLabel: "Teams",
    }),
    decision({ decision: "hold" }),
  );

  assert.deepEqual(adopted, {
    status: "completed",
    reason: "project_operation_candidate_adopted",
    candidateState: "adopted",
    ownerEffectIssued: true,
    nextOwnerRevision: 5,
  });
  assert.equal(candidateStore.read().state, "adopted");
  assert.equal(owner.revision(), 5);
  assert.equal(rejected.ownerEffectIssued, false);
  assert.equal(held.ownerEffectIssued, false);
  assert.equal(
    conflicted.reason,
    "project_operation_candidate_revision_conflict",
  );
  assert.equal(conflicted.ownerEffectIssued, false);
  assert.equal(sameMediumDifferentIdentity.candidateState, "held");
  assert.equal(sameMediumDifferentIdentity.ownerEffectIssued, false);
});

/**
 * Owner Effect後の未完了Journalを同じIdentityで回復することを検証する。
 * @responsibility 部分成功をEffect 0へ畳まず、再入場でOwnerを二重更新せずCandidateだけを確定する。
 * @trace CPR-IT-006
 * @precondition Owner Revision 5とowner_applied Journal、created Candidateを用意する。
 * @stimulus 同じCandidate判断をFile Operation入口へ再入場する。
 * @observation 結果、Owner Revision、Candidate状態およびJournal不存在を観測する。
 * @oracle Effect済みを保持してadoptedへ収束し、Owner Revisionは5のままとなる。
 * @cleanup 一時Store Rootを削除する。
 * @boundary CPR-IT-006=Direct Boundary: Journal→Owner→Candidate Recovery。
 */
test("Owner Effect後の未完了判断を二重更新せず回復する", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-op-recovery-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  fs.mkdirSync(path.join(root, "operations"));
  fs.writeFileSync(
    path.join(root, "candidate.json"),
    JSON.stringify(candidate()),
  );
  fs.writeFileSync(
    path.join(root, "owner.json"),
    JSON.stringify({ revision: 5, adoptedCandidateId: "candidate-001" }),
  );
  fs.writeFileSync(
    path.join(root, "operations", "candidate-001.json"),
    JSON.stringify({
      candidateId: "candidate-001",
      expectedOwnerRevision: 4,
      principalId: "project-owner",
      decision: "adopt",
      phase: "owner_applied",
    }),
  );
  const recovered = executeFileProjectOperationCandidateDecision(
    storeRoot,
    "candidate.json",
    "owner.json",
    "operations/candidate-001.json",
    { verify: () => true },
    decision(),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.ownerEffectIssued, true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "owner.json"), "utf8")).revision,
    5,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "candidate.json"), "utf8"))
      .state,
    "adopted",
  );
  assert.equal(
    fs.existsSync(path.join(root, "operations", "candidate-001.json")),
    false,
  );
});

/**
 * Owner Effect前の準備Journalを同じIdentityで再開することを検証する。
 * @responsibility 準備済み判断をAuthority再確認後に一度だけOwnerへ適用し、Candidate確定まで収束させる。
 * @trace CPR-IT-006
 * @precondition Owner Revision 4、prepared Journalおよびcreated Candidateを用意する。
 * @stimulus 同じPrincipalと採用判断でFile Operation入口へ再入場する。
 * @observation 結果、Owner Revision、Candidate状態およびJournal不存在を観測する。
 * @oracle Ownerを一度だけRevision 5へ進め、Candidateをadoptedへ確定する。
 * @cleanup 一時Store Rootを削除する。
 * @boundary CPR-IT-006=Direct Boundary: Prepared Journal→Authority→Owner→Candidate Settlement。
 */
test("Owner Effect前の準備済み判断を一度だけ再開する", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-op-prepared-recovery-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  fs.mkdirSync(path.join(root, "operations"));
  fs.writeFileSync(
    path.join(root, "candidate.json"),
    JSON.stringify(candidate()),
  );
  fs.writeFileSync(
    path.join(root, "owner.json"),
    JSON.stringify({ revision: 4, adoptedCandidateId: null }),
  );
  fs.writeFileSync(
    path.join(root, "operations", "candidate-001.json"),
    JSON.stringify({
      candidateId: "candidate-001",
      expectedOwnerRevision: 4,
      principalId: "project-owner",
      decision: "adopt",
      phase: "prepared",
    }),
  );
  const recovered = executeFileProjectOperationCandidateDecision(
    storeRoot,
    "candidate.json",
    "owner.json",
    "operations/candidate-001.json",
    { verify: (_candidate, input) => input.principalId === "project-owner" },
    decision(),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.ownerEffectIssued, true);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(root, "owner.json"), "utf8")),
    { revision: 5, adoptedCandidateId: "candidate-001" },
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "candidate.json"), "utf8"))
      .state,
    "adopted",
  );
  assert.equal(
    fs.existsSync(path.join(root, "operations", "candidate-001.json")),
    false,
  );
});
