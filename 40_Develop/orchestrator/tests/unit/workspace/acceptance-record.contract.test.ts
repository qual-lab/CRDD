/**
 * 既存採用記録から品質受入への相関条件を有限Snapshotで反証する。
 * @packageDocumentation
 * @scope 保存読取り代役と本番相関判定。Git変更・Providerなし。
 * @responsibility Hash形式、対象、欠測と過去失敗の区別。
 * @trace CPR-UT-009
 * @level UT
 * @boundary 保存読取りだけを代役にし、本番判定本文を実行する。Git／Providerなし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { validWorkspaceCandidateRequest } from "../../../../version-control/src/index.ts";

/**
 * 本番判定を有限の既存保存結果へ接続する。
 * @trace CPR-UT-009
 * @precondition 判定関数の境界をSourceから一意に抽出できる。
 * @stimulus 正常採用と不正長・対象差・欠測。
 * @observation boolean。保存や外部Effectは発行しない。
 * @oracle 40／64桁だけを許容し、不明・不一致は拒否する。
 * @cleanup N/A: Process内の合成値だけ。
 * @responsibility 本番判定を有限の既存保存結果へ接続する。
 * @boundary 本番判定本文と保存読取り代役。Git・Provider処置は発行しない。
 */
test("採用記録はexactなCommit長と計画相関を要求し過去失敗を消さない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/workspace/operations.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function workspacePlanReadyForAcceptance(",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  const code = stripTypeScriptTypes(
    source.slice(start, end).replace("export ", ""),
  );
  let snapshot: unknown;
  const ready = new Function(
    "readOrchestratorSnapshot",
    "validWorkspaceCandidateRequest",
    `${code}; return workspacePlanReadyForAcceptance;`,
  )(
    () => ({ status: "completed", value: snapshot }),
    validWorkspaceCandidateRequest,
  ) as (...args: string[]) => boolean;
  const base = "a".repeat(40),
    head = "b".repeat(40);
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const operationId = "22222222-2222-4222-8222-222222222222";
  const original = {
    projects: [
      {
        projectId: "project",
        milestoneId: "milestone",
        repositoryRevision: base,
      },
    ],
    queueEntries: [
      {
        queueId: "queue",
        projectId: "project",
        milestoneId: "milestone",
        state: "integration_pending",
        ownerGeneration: null,
        workspaceId,
      },
    ],
    results: [
      {
        kind: "adoption",
        repositoryBindingId: "binding",
        projectId: "project",
        milestoneId: "milestone",
        queueId: "queue",
        identity: `workspace-candidate-${operationId}`,
        value: {
          recordKind: "workspace-candidate",
          disposition: "adopted",
          candidateCommit: "c".repeat(40),
          mergeCommit: head,
          primaryFailure: "previous_failure",
          request: {
            workspaceId,
            operationId,
            baseCommit: base,
            expectedWorkspaceHead: base,
            workspaceName: null,
            candidateName: null,
            relatedChangeIds: [],
            selection: [
              { path: "source.txt", mode: "100644", blobId: "d".repeat(40) },
            ],
          },
          target: { targetBranch: "main", expectedTargetHead: base },
        },
      },
    ],
  };
  for (const field of ["candidateCommit", "expectedTargetHead"] as const) {
    for (const length of [40, 41, 63, 64]) {
      const value = structuredClone(original);
      const entry = value.results[0];
      assert.ok(entry);
      if (field === "candidateCommit")
        entry.value.candidateCommit = "c".repeat(length);
      else entry.value.target.expectedTargetHead = "a".repeat(length);
      snapshot = value;
      assert.equal(
        ready("root", "binding", "project", "milestone", base, head),
        length === 40 || length === 64,
        `${field}:${length}`,
      );
    }
  }
  snapshot = original;
  assert.equal(
    ready("root", "binding", "project", "milestone", base, base),
    false,
  );
  assert.equal(
    ready("root", "binding", "other", "milestone", base, head),
    false,
  );
  snapshot = { ...original, results: [] };
  assert.equal(
    ready("root", "binding", "project", "milestone", base, head),
    false,
  );
  snapshot = {
    ...original,
    results: original.results.map((entry) => ({ ...entry, queueId: "other" })),
  };
  assert.equal(
    ready("root", "binding", "project", "milestone", base, head),
    false,
  );
});
