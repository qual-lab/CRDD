/**
 * Version Controlの技術契約とDomain Modelとの依存方向を確認する。
 * @responsibility 逆依存の再発と入力検査の意図しない変更を検出する。
 * @trace RCM-IT-004 RFD-IT-029
 * @level IT
 * @scope 公開契約、技術入力検査、Source依存方向。
 * @boundary 同一Processの純粋値とRepository Source。Git変更・外部通信なし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  isWorkspaceCommitId,
  validWorkspaceCandidateRequest,
  validWorkspaceDisplayName,
  type WorkspaceCandidateRequest,
} from "../../src/index.ts";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "../../src");
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
 * 全本番Sourceの静的・動的参照から上位Packageへの逆依存を拒否する。
 * @trace RCM-IT-004
 * @precondition 公式srcを読む。
 * @stimulus 全本番Sourceを読み、上位Packageへの参照を走査する。
 * @observation Domain Modelを指す参照の不存在。
 * @oracle 型だけの逆依存や再公開も存在しない。
 * @cleanup N/A: 読取りのみ。
 */
test("Version Controlは型・再公開を含めDomain Modelへ依存しない", () => {
  for (const entry of fs.readdirSync(SOURCE_ROOT, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const file = path.join(entry.parentPath, entry.name);
    // Module参照に加え、上位Package名の実装への埋込みも拒否する。
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /domain-model/u, file);
  }
});

/**
 * 移管前の正常・境界・不正・欠測を技術正本で確認する。
 * @trace RFD-IT-029
 * @precondition 既存の技術要求を使用する。
 * @stimulus 欠測、追加キー、別形式、管理Path、重複選択を入力する。
 * @observation 正常とSHA-256は受理、不正は拒否。
 * @oracle 値検査の受理・拒否条件が保持される。
 * @cleanup N/A: 純粋値のみ。
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
