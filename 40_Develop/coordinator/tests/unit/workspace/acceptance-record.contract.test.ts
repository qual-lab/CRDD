/**
 * 既存採用記録から品質受入への相関条件を有限Snapshotで反証する。
 * @packageDocumentation
 * @scope 保存読取り代役と本番相関判定。Git変更・Providerなし。
 * @responsibility Hash形式、対象、欠測と過去失敗の区別。
 * @trace CPR-UT-009
 * @trace RFD-UT-030
 * @level UT
 * @boundary 保存読取りだけを代役にし、本番判定本文を実行する。Git／Providerなし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import type { Repository } from "../../../../version-control/src/index.ts";
import { readWorkspaceCandidatePatch } from "../../../src/workspace/git.ts";

/** 上位の選択外拒否と、VCへ進んだ技術理由を混同しない。 */
test("選択外PathはCoordinatorの拒否、選択内はVCの技術結果を保つ", () => {
  const repository = {} as Repository;
  const request = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    operationId: "22222222-2222-4222-8222-222222222222",
    baseCommit: "a".repeat(40),
    expectedWorkspaceHead: "a".repeat(40),
    workspaceName: null,
    candidateName: null,
    relatedChangeIds: [],
    selection: [
      { path: "selected.txt", mode: "100644" as const, blobId: "b".repeat(40) },
    ],
  };
  assert.throws(
    () =>
      readWorkspaceCandidatePatch(
        repository,
        request,
        "c".repeat(40),
        "other.txt",
      ),
    /candidate_path_invalid/u,
  );
  assert.throws(
    () =>
      readWorkspaceCandidatePatch(
        repository,
        request,
        "c".repeat(40),
        "selected.txt",
      ),
    /worktree_repository_invalid/u,
  );
});

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
  const verifiedRoot = Object.freeze({});
  const ready = new Function(
    "readState",
    "verifyRuntimePersistenceRepository",
    `${code}; return workspacePlanReadyForAcceptance;`,
  )(
    (root: unknown, binding: unknown) => {
      assert.equal(root, verifiedRoot);
      assert.equal(binding, "binding");
      return { status: "completed", value: snapshot };
    },
    (root: unknown) => {
      assert.equal(root, "root");
      return verifiedRoot;
    },
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

/**
 * @trace RFD-UT-030
 * @responsibility 入力の閉形式とユーザー型変換の非実行を検査する。
 * @precondition 純粋なコマンド入力だけを使用する。
 * @stimulus 不正Path・mode・重複選択・改行名を渡す。
 * @observation 拒否結果と型変換の呼出し回数。
 * @oracle 不正入力は拒否しユーザーのtoStringを実行しない。
 * @cleanup 外部資源なし。
 * @boundary Coordinator入力検査。Git操作なし。
 */
test("Workspace入力は型変換せずPathと選択と名前を拒否する", () => {
  const command = {
    operation: "freeze",
    projectId: "project",
    queueId: "queue",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    expectedGeneration: 1,
    operationId: "22222222-2222-4222-8222-222222222222",
    baseCommit: "a".repeat(40),
    expectedHead: "a".repeat(40),
    candidateName: null,
    relatedChangeIds: [],
    selection: [
      { path: "src/file.ts", blobId: "b".repeat(40), mode: "100644" },
    ],
  };
  assert.ok(inspectWorkspaceCommand(command));
  let conversions = 0;
  for (const mode of [
    100644,
    {
      toString() {
        conversions++;
        return "100644";
      },
    },
  ])
    assert.equal(
      inspectWorkspaceCommand({
        ...command,
        selection: [{ ...command.selection[0], mode }],
      }),
      null,
    );
  assert.equal(conversions, 0);
  for (const path of [
    "../file",
    ".git/config",
    ".crdd/state",
    "a//b",
    "a/../b",
    "a\\b",
    "a*",
    "/a",
  ])
    assert.equal(
      inspectWorkspaceCommand({
        ...command,
        selection: [{ ...command.selection[0], path }],
      }),
      null,
    );
  assert.equal(
    inspectWorkspaceCommand({
      ...command,
      selection: [
        ...command.selection,
        { ...command.selection[0], path: "SRC/FILE.ts" },
      ],
    }),
    null,
  );
  assert.equal(
    inspectWorkspaceCommand({ ...command, candidateName: "line\nbreak" }),
    null,
  );
  assert.equal(
    inspectWorkspaceCommand({ ...command, operationId: "../escape" }),
    null,
  );
  assert.equal(
    inspectWorkspaceCommand({ ...command, expectedHead: "a".repeat(64) }),
    null,
  );
});

/**
 * 要求量では拒否せず固定候補の全件を保持する。
 * @responsibility 選択と関連変更の旧容量制限を復活させない。
 * @trace RFD-UT-030
 * @precondition 純粋なコマンド入力。
 * @stimulus 1001選択と101関連変更。
 * @observation 返却件数。
 * @oracle 内容の切捨てなし。
 * @cleanup 外部資源なし。
 * @boundary 値検査。
 */
test("固定候補操作は旧件数を超える入力を保持する", () => {
  const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
  const COMMIT = "a".repeat(40);
  const many = {
    relatedChangeIds: Array.from(
      { length: 101 },
      (_, i) => "CHG-" + String(i).padStart(6, "0"),
    ),
    selection: Array.from({ length: 1001 }, (_, i) => ({
      path: "src/" + i + ".txt",
      blobId: COMMIT,
      mode: "100644",
    })),
  };
  const frozen = inspectWorkspaceCommand({
    operation: "freeze",
    projectId: "project-1",
    queueId: "queue-1",
    workspaceId: WORKSPACE_ID,
    expectedGeneration: 1,
    operationId: WORKSPACE_ID,
    baseCommit: COMMIT,
    expectedHead: COMMIT,
    candidateName: null,
    relatedChangeIds: many.relatedChangeIds,
    selection: many.selection,
  });
  assert.equal(frozen?.operation, "freeze");
  if (frozen?.operation === "freeze") {
    assert.equal(frozen.selection.length, 1001);
    assert.equal(frozen.relatedChangeIds.length, 101);
  }
});

import { inspectWorkspaceCommand } from "../../../src/workspace/commands.ts";
import { inspectCoordinatorWorkspaceResults } from "../../../src/workspace/record.ts";

/**
 * Task別Workspace観測の旧1024件上限を超える集合を検査する。
 * @responsibility 観測量では拒否せず対象相関・一意性・不明状態を維持する。
 * @trace CPR-UT-009
 * @precondition 一つのWorkspaceに属する1025件の合成観測を用意する。
 * @stimulus 正常集合、重複Operation、別対象と欠測を渡す。
 * @observation 返却件数と不正集合のnull。
 * @oracle 旧上限超過だけは受理し、不正観測を空集合や正常へ補完しない。
 * @cleanup N/A: 値検査だけ。
 * @boundary 公開結果の純粋検査。Gitや削除を発行しない。
 */
test("Task別Workspace観測は旧1024件を超えても対象相関を検査する", () => {
  const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
  const values = Array.from({ length: 1025 }, (_, index) => ({
    taskId: `task-${index}`,
    attemptId: `attempt-${index}`,
    operationId: `operation-${index}`,
    result: {
      workspaceId: WORKSPACE_ID,
      changedPaths: [],
      canonicalRepositoryChanged: false,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    },
  }));
  assert.equal(
    inspectCoordinatorWorkspaceResults(values, WORKSPACE_ID)?.length,
    1025,
  );
  assert.equal(
    inspectCoordinatorWorkspaceResults([...values, values[0]], WORKSPACE_ID),
    null,
  );
  assert.equal(
    inspectCoordinatorWorkspaceResults(
      values,
      "00000000-0000-0000-0000-000000000002",
    ),
    null,
  );
  assert.equal(
    inspectCoordinatorWorkspaceResults(
      values.map(({ result, ...entry }) => entry),
      WORKSPACE_ID,
    ),
    null,
  );
});
