/**
 * DomainがWorkspace保存契約を所有し、Git技術要求と区別することを確認する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・業務ID・表示名・CHG相関を維持する。
 * @trace RFD-UT-030
 * @trace CPR-UT-009
 * @level UT
 * @scope 候補保存値とPackage依存方向。
 * @boundary 同一Processの値検査。Git・保存Effectなし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorkspaceCommitId,
  validWorkspaceCandidateRequest,
  validWorkspaceDisplayName,
  type WorkspaceCandidateRequest,
} from "../../src/index.ts";
import {
  validCandidateRecord,
  validCoordinatorWorkspace,
} from "../../src/workspace/validation.ts";

/**
 * 上位の保存相関と下位の技術入力検査を同じ値へ適用する。
 * @responsibility 候補保存値の閉形式と保存対象Workspaceへの相関を反証する。
 * @trace RFD-UT-030
 * @precondition Domainの要求型で構築した合成値。
 * @stimulus 正常・別Workspace・不正要求を保存検査へ渡す。
 * @observation 同対象の正常だけtrue。
 * @oracle 型移管後も既存保存相関が保たれる。
 * @cleanup N/A: 純粋値のみ。
 * @boundary RFD-UT-030=N/A: Domainの値検査のみ。Git・保存Effectなし。
 */
test("候補保存値はDomainの要求形式とWorkspace相関の双方を検査する", () => {
  const workspaceId = "00000000-0000-0000-0000-000000000001";
  const commit = "a".repeat(40);
  const request: WorkspaceCandidateRequest = {
    workspaceId,
    operationId: workspaceId,
    baseCommit: commit,
    expectedWorkspaceHead: commit,
    workspaceName: null,
    candidateName: null,
    relatedChangeIds: [],
    selection: [{ path: "source.txt", blobId: commit, mode: "100644" }],
  };
  const record = {
    request,
    phase: "freezing",
    candidateCommit: null,
    target: null,
    mergeCommit: null,
    disposition: null,
    lastResult: null,
    primaryFailure: null,
    cleanupFailure: null,
  };
  assert.equal(validCandidateRecord(record, workspaceId), true);
  assert.equal(
    validCandidateRecord(record, "00000000-0000-0000-0000-000000000002"),
    false,
  );
  assert.equal(
    validCandidateRecord({ ...record, request: {} }, workspaceId),
    false,
  );
});

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
const COMMIT = "a".repeat(40);
const REQUEST: WorkspaceCandidateRequest = {
  workspaceId: WORKSPACE_ID,
  operationId: WORKSPACE_ID,
  baseCommit: COMMIT,
  expectedWorkspaceHead: COMMIT,
  workspaceName: null,
  candidateName: "候補",
  relatedChangeIds: ["CHG-000082"],
  selection: [{ path: "source.txt", blobId: COMMIT, mode: "100644" }],
};

/**
 * 移管前の正常・境界・不正・欠測を技術正本で確認する。
 * @responsibility 要求・Commit形式・選択Path・表示名・関連CHGの受理境界を固定する。
 * @trace RFD-UT-030
 * @precondition 既存の技術要求を使用する。
 * @stimulus 欠測、追加キー、別形式、管理Path、重複選択を入力する。
 * @observation 正常とSHA-256は受理、不正は拒否。
 * @oracle 値検査の受理・拒否条件が保持される。
 * @cleanup N/A: 純粋値のみ。
 * @boundary RFD-UT-030=N/A: 値の受理／拒否だけを検査し実Gitを呼ばない。
 */
test("技術入力の閉形式と境界条件を維持する", () => {
  assert.equal(validWorkspaceCandidateRequest(REQUEST), true);
  const sha256 = "b".repeat(64);
  assert.equal(
    validWorkspaceCandidateRequest({
      ...REQUEST,
      baseCommit: sha256,
      expectedWorkspaceHead: sha256,
      selection: [{ path: "source.txt", blobId: sha256, mode: "100755" }],
    }),
    true,
  );
  for (const request of [
    null,
    {},
    { ...REQUEST, extra: true },
    { ...REQUEST, workspaceId: "unknown" },
    { ...REQUEST, expectedWorkspaceHead: sha256 },
    { ...REQUEST, selection: [] },
    {
      ...REQUEST,
      selection: [{ path: "../source.txt", blobId: null, mode: null }],
    },
    {
      ...REQUEST,
      selection: [{ path: ".git/config", blobId: null, mode: null }],
    },
    { ...REQUEST, selection: [...REQUEST.selection, ...REQUEST.selection] },
    { ...REQUEST, relatedChangeIds: ["CHG-000082", "CHG-000082"] },
    { ...REQUEST, candidateName: "改行\n" },
  ])
    assert.equal(validWorkspaceCandidateRequest(request), false);
  assert.equal(
    validWorkspaceCandidateRequest({
      ...REQUEST,
      selection: [{ path: "source.txt", blobId: null, mode: null }],
    }),
    true,
  );
  assert.equal(validWorkspaceDisplayName(null), true);
  assert.equal(validWorkspaceDisplayName("あ".repeat(120)), true);
  assert.equal(validWorkspaceDisplayName("あ".repeat(121)), false);
  assert.equal(isWorkspaceCommitId(COMMIT), true);
  assert.equal(isWorkspaceCommitId(sha256), true);
  assert.equal(isWorkspaceCommitId("a".repeat(39)), false);
});

/**
 * VCの新技術理由を保存契約へ接続し、旧成功理由と対象外系列を拒否する。
 * @responsibility 成功・一次失敗・回収失敗と既統合の相関を保持する。
 * @trace CPR-UT-009
 * @precondition 合成値だけを既存の純粋保存検査へ渡す。
 * @stimulus 固定・Mergeの新旧成功理由、失敗系列、既統合時のnull Merge ID。
 * @observation boolean。
 * @oracle 新理由だけ成功として受理し、未知操作や成功相関不一致を拒否する。
 * @cleanup N/A: 保存・Git・Process・過去保持物を使用しない。
 * @boundary CPR-UT-009=N/A: Domain自身の保存値検査。Git・保存Effectなし。
 */
test("VC技術理由の保存は新成功と一次・回収失敗を区別する", () => {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const operationId = "22222222-2222-4222-8222-222222222222";
  const base = "a".repeat(40),
    commit = "b".repeat(40);
  const result = {
    status: "completed",
    reason: "commit_create_completed",
    candidateRef: `refs/heads/crdd/candidate/${workspaceId}/${operationId}`,
    candidateCommit: commit,
    mergeCommit: null,
    effectIssued: true,
    cleanupConfirmed: true,
    temporary: null,
    changedPaths: ["source.txt"],
  };
  const candidate = {
    request: {
      workspaceId,
      operationId,
      baseCommit: base,
      expectedWorkspaceHead: base,
      workspaceName: null,
      candidateName: null,
      relatedChangeIds: [],
      selection: [{ path: "source.txt", mode: "100644", blobId: commit }],
    },
    phase: "fixed",
    candidateCommit: commit,
    target: null,
    mergeCommit: null,
    disposition: null,
    lastResult: result,
    primaryFailure: null,
    cleanupFailure: null,
  };
  const workspace = {
    workspaceId,
    name: null,
    generation: 1,
    baseCommit: base,
    head: base,
    phase: "ready",
    pending: null,
    holdUntil: null,
    lastResult: null,
    primaryFailure: null,
    candidate,
  };
  for (const reason of [
    "commit_create_completed",
    "commit_create_existing_confirmed",
    "candidate_fixed",
    "candidate_fixed_existing",
  ]) {
    assert.equal(
      validCoordinatorWorkspace({
        ...workspace,
        candidate: {
          ...candidate,
          lastResult: { ...result, reason },
        },
      }),
      reason.startsWith("commit_create_"),
      reason,
    );
  }
  const merged = {
    ...candidate,
    phase: "merged",
    disposition: "adopted",
    target: { targetBranch: "main", expectedTargetHead: base },
    mergeCommit: null,
  };
  for (const reason of [
    "commit_merge_completed",
    "commit_merge_existing_confirmed",
    "commit_merge_already_integrated",
    "candidate_merged",
    "candidate_merge_existing",
    "candidate_already_integrated",
  ]) {
    for (const mergeCommit of [null, "c".repeat(40)]) {
      assert.equal(
        validCoordinatorWorkspace({
          ...workspace,
          candidate: {
            ...merged,
            mergeCommit,
            lastResult: { ...result, reason, mergeCommit },
          },
        }),
        reason.startsWith("commit_merge_") &&
          (mergeCommit !== null ||
            reason === "commit_merge_already_integrated"),
        `${reason}:${mergeCommit}`,
      );
    }
  }
  for (const reason of [
    "commit_create_content_changed",
    "commit_merge_conflict",
    "commit_temporary_cleanup_unconfirmed",
  ]) {
    const failed = {
      ...candidate,
      phase: "freezing",
      primaryFailure: reason,
      lastResult: { ...result, status: "blocked", reason },
    };
    assert.equal(
      validCoordinatorWorkspace({ ...workspace, candidate: failed }),
      true,
      reason,
    );
  }
  for (const cleanupFailure of [
    "commit_create_content_mismatch",
    "commit_temporary_cleanup_unconfirmed",
    "commit_copy_failed",
    "commit_diff_input_invalid",
  ]) {
    assert.equal(
      validCoordinatorWorkspace({
        ...workspace,
        candidate: {
          ...candidate,
          cleanupFailure,
        },
      }),
      cleanupFailure.startsWith("commit_create_") ||
        cleanupFailure.startsWith("commit_temporary_"),
      cleanupFailure,
    );
  }
  for (const reason of [
    "commit_copy_failed",
    "commit_diff_input_invalid",
    "commit_push_failed",
  ]) {
    assert.equal(
      validCoordinatorWorkspace({
        ...workspace,
        candidate: {
          ...candidate,
          phase: "freezing",
          primaryFailure: reason,
          lastResult: { ...result, status: "blocked", reason },
        },
      }),
      false,
      reason,
    );
  }
});
