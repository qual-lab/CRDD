/**
 * Domainの保存値がVersion Controlの技術契約を利用することを確認する。
 * @responsibility 技術型の再定義なしで保存側の相関条件を維持する。
 * @trace RCM-UT-014 RFD-IT-029
 * @level UT
 * @scope 候補保存値とPackage依存方向。
 * @boundary 同一Processの値検査。Git・保存Effectなし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceCandidateRequest } from "../../../version-control/src/index.ts";
import { validCandidateRecord } from "../../src/workspace/validation.ts";

/**
 * 上位の保存相関と下位の技術入力検査を同じ値へ適用する。
 * @trace RCM-UT-014
 * @precondition VC公開型で構築した要求。
 * @stimulus 正常・別Workspace・不正要求を保存検査へ渡す。
 * @observation 同対象の正常だけtrue。
 * @oracle 型移管後も既存保存相関が保たれる。
 * @cleanup N/A: 純粋値のみ。
 */
test("候補保存値はVC技術契約とWorkspace相関の双方を検査する", () => {
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
