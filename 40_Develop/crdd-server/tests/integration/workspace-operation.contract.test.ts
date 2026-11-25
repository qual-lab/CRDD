/**
 * coordinator:integration:repository-workspace-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:repository-workspace-runtimeが所有する検証責務を実行する。
 * @trace RFD-IT-013
 * @trace PRL-IT-013
 * @level IT
 * @scope repository、workspace、runtime
 * @boundary RFD-IT-013=Direct Boundary: Host所有→借用Tree→Git固定・Reviewer投影
 */

import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { deflateSync } from "node:zlib";
import type {
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
} from "@qual-lab/crdd-execution-model";
import {
  createWorktree,
  getRepository,
  getWorktree,
  type Repository,
  readRepositoryEntries,
  readFile,
} from "@qual-lab/crdd-version-control";
import {
  closeVerificationWorkspace,
  prepareVerificationWorkspace,
  readVerificationWorkspaceOutput,
} from "../../../coordinator/tests/support/workspace-task-fixture.ts";
import { runTestSingleTaskAttempt } from "../../../coordinator/tests/support/task-requests.ts";
import {
  bindRepositoryOperation,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  inspectBorrowedExecutionTarget,
  isExecutionRelativePath,
  bindExecutionWorkspace as materializeReceivedTarget,
  projectBorrowedExecutionResult,
  prepareReviewerWorkspace,
  readBorrowedExecutionBinding,
  readExecutionFile,
  readOwnedReviewerWorkspace,
  verifyOwnedOperationManagementMountBinding,
} from "../../../coordinator/src/lifecycle/host.ts";
import { verifyProviderOperationMount } from "../../../coordinator/src/lifecycle/selection.ts";
import {
  freezeWorkspaceCandidate,
  mergeWorkspaceCandidate,
  removeWorkspaceCandidate,
  workspaceWorktreeResult,
  workspaceWorktreeTarget,
} from "../../src/service/workspace.ts";

const CANDIDATE_TESTS_ROOT = path.resolve(
  import.meta.dirname,
  "../../../../.crdd/tests",
);
const CANDIDATE_GIT_EMPTY = process.platform === "win32" ? "NUL" : os.devNull;
type CandidateGitFixture = {
  root: string;
  base: string;
  capability: Repository;
  target: (id: string) => string;
};

/**
 * 検証Toolが作成・成果確認・終了を所有し、Coordinatorへ管理を渡さない。
 * @responsibility 実Gitの借用対象と自己生成物の回収条件を照合する。
 * @trace RFD-IT-013
 * @precondition Repository-localの合成Gitと固定Base。
 * @stimulus Toolの正式関数で作成・編集・実Byte観測・未確認終了拒否・確認後終了。
 * @observation Git登録、実File、本文Hash、所有Rootのdirty。
 * @oracle Task回収不明では保持し、確認後に専用WorktreeとBranchだけを除去する。
 * @cleanup このCaseが作成したRepository-local Rootだけを回収する。
 * @boundary 実Git／Filesystem。Provider・Docker・認証は使用しない。
 */
test("検証ToolのWorktreeは実Byteを読み取消終了不明では保持し確定後だけ閉じる", (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "verification-worktree-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), parent);
    fs.rmSync(root, { recursive: true, force: true });
  });
  /**
   * 自己生成Workspace試験だけへ中立環境のGit要求を発行する。
   * @responsibility 自己生成Workspace試験だけへ中立環境のGit要求を発行する。
   * @trace RFD-IT-013
   * @precondition 検証済みfixture Rootと固定argv。
   * @stimulus hooks・署名・親GIT環境を無効にして有限時間でGitを呼ぶ。
   * @observation 終了値とstdout、実HEAD・Index。
   * @oracle 正常終了だけ返し本体Gitへ要求を配送しない。
   * @cleanup Caseのfinallyで借用Treeと自己生成Rootを確認後に回収する。
   * @boundary 通信なし実Git。ProviderやDockerは使用しない。
   */
  const git = (args: string[]) =>
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        `core.hooksPath=${os.devNull}`,
        "-c",
        "commit.gpgSign=false",
        ...args,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([k]) => !/^GIT_/iu.test(k)),
          ),
          GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull,
          GIT_CONFIG_SYSTEM: process.platform === "win32" ? "NUL" : os.devNull,
        },
      },
    ).trim();
  // 一覧は親Repository内のscopeも読めるが、操作Rootはexact検証を要求する。
  assert.equal(getRepository(root).status, "blocked");
  git(["init", "--initial-branch=main", "--template="]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\nignored/\n");
  fs.mkdirSync(path.join(root, "ignored"));
  fs.writeFileSync(path.join(root, "ignored", "tracked.txt"), "tracked\n");
  fs.writeFileSync(path.join(root, "ignored", "untracked.txt"), "private\n");
  fs.writeFileSync(path.join(root, "deleted.txt"), "deleted\n");
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  git(["add", "source.txt", ".gitignore", "deleted.txt"]);
  git(["add", "-f", "ignored/tracked.txt"]);
  git([
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "base",
  ]);
  const base = git(["rev-parse", "HEAD"]);
  // Gitの列挙対象だけを読み、無視された内部状態には触れない。
  const index = fs.readFileSync(path.join(root, ".git", "index"));
  fs.mkdirSync(path.join(root, ".crdd"));
  fs.writeFileSync(path.join(root, ".crdd", "state.json"), "private");
  fs.writeFileSync(path.join(root, "source.txt"), "dirty\n");
  fs.writeFileSync(path.join(root, "untracked.txt"), "new\n");
  fs.unlinkSync(path.join(root, "deleted.txt"));
  const firstObservation = readRepositoryEntries(root);
  assert.equal(firstObservation.status, "completed");
  const first = firstObservation.entries;
  const rootCapability = getRepository(root);
  assert.equal(rootCapability.status, "completed");
  assert.ok(rootCapability.capability);
  const deleted = readFile(rootCapability.capability, { path: "deleted.txt" });
  assert.equal(deleted.content, null);
  assert.deepEqual(deleted.selection, {
    path: "deleted.txt",
    blobId: null,
    mode: null,
  });
  assert.ok(
    first.some((entry) => entry.relativePath === "ignored/tracked.txt"),
  );
  assert.equal(
    first.some((entry) => entry.relativePath === "ignored/untracked.txt"),
    false,
  );
  assert.equal(
    first.some((entry) => entry.relativePath === "deleted.txt"),
    true,
  );
  assert.equal(
    first.some((entry) => entry.relativePath.startsWith(".git/")),
    false,
  );
  assert.equal(
    first.some((entry) => entry.relativePath.startsWith(".crdd/")),
    false,
  );
  assert.ok(first.some((entry) => entry.relativePath === "untracked.txt"));
  const read = readExecutionFile(path.join(root, "source.txt"));
  assert.equal(read.content.toString(), "dirty\n");
  assert.equal(read.byteLength, 6);
  fs.rmSync(path.join(root, "untracked.txt"));
  assert.equal(
    readRepositoryEntries(root).entries.some(
      (entry) => entry.relativePath === "untracked.txt",
    ),
    false,
  );
  assert.equal(isExecutionRelativePath("../outside"), false);
  assert.equal(isExecutionRelativePath(".git/index"), false);
  assert.equal(git(["rev-parse", "HEAD"]), base);
  assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), index);
  fs.unlinkSync(path.join(root, ".crdd", "state.json"));
  fs.rmdirSync(path.join(root, ".crdd"));
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");

  fs.writeFileSync(path.join(root, "source.txt"), "human dirty\n");
  const prepared = prepareVerificationWorkspace(root, base);
  assert.equal(prepared.prepared, true);
  const target = prepared.target;
  assert.equal(
    fs.readFileSync(path.join(target.executionTree, "source.txt"), "utf8"),
    "base\n",
  );
  const bytes = Buffer.from("result\n");
  fs.writeFileSync(path.join(target.executionTree, "source.txt"), bytes);
  const result = {
    status: "completed",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    canonicalRepositoryChanged: false,
    processRestartRequired: false,
    hostRecoveryId: null,
    dockerRecoveryId: null,
    dockerRecoveryIds: [],
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
    workspaceResult: {
      workspaceId: target.workspaceId,
      changedPaths: ["source.txt"],
      workspaceDeletionIssued: false,
      canonicalRepositoryChanged: false,
    },
  };
  const observed = readVerificationWorkspaceOutput(
    target,
    "source.txt",
    result,
  );
  assert.equal(observed.workspaceId, target.workspaceId);
  assert.equal(
    observed.sha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  assert.equal(observed.byteLength, bytes.length);
  assert.deepEqual(Buffer.from(observed.contentBase64, "base64"), bytes);
  assert.deepEqual(
    closeVerificationWorkspace(target, { ...result, cleanupConfirmed: false }),
    { status: "retained", cleanupConfirmed: false },
  );
  for (const invalid of [
    { ...result, status: "running" },
    { ...result, processTerminationObserved: false },
    { ...result, canonicalRepositoryChanged: true },
    { ...result, processRestartRequired: true },
    { ...result, manualRecoveryRequired: true },
    { ...result, hostRecoveryId: "host.pending" },
    { ...result, dockerRecoveryId: "docker.pending" },
    { ...result, dockerRecoveryIds: ["docker.pending"] },
    { ...result, candidateRecoveryId: "candidate.pending" },
    { ...result, candidateStoreRecoveryId: "store.pending" },
    { ...result, workspaceResult: null },
    {
      ...result,
      workspaceResult: { ...result.workspaceResult, workspaceId: randomUUID() },
    },
    {
      ...result,
      workspaceResult: {
        ...result.workspaceResult,
        workspaceDeletionIssued: true,
      },
    },
  ]) {
    assert.deepEqual(closeVerificationWorkspace(target, invalid), {
      status: "retained",
      cleanupConfirmed: false,
    });
    assert.equal(fs.existsSync(target.executionTree), true);
    assert.equal(
      git(["worktree", "list", "--porcelain"])
        .split("\n")
        .filter((l) => l.startsWith("worktree ")).length,
      2,
    );
  }
  assert.equal(fs.existsSync(target.executionTree), true);
  assert.deepEqual(closeVerificationWorkspace(target, result), {
    status: "discarded",
    cleanupConfirmed: true,
  });
  assert.equal(fs.existsSync(target.executionTree), false);
  assert.equal(
    git(["worktree", "list", "--porcelain"])
      .split("\n")
      .filter((l) => l.startsWith("worktree ")).length,
    1,
  );
  assert.equal(git(["branch", "--list", "crdd/workspace/*"]), "");
  assert.equal(
    fs.readFileSync(path.join(root, "source.txt"), "utf8"),
    "human dirty\n",
  );
  assert.equal(git(["rev-parse", "HEAD"]), base);
});

/**
 * DirectとIsolatedの実Treeを複製せず借用する。
 * @responsibility dirty基準、保護領域除外、清掃と寿命分離を確認する。
 * @trace RFD-IT-013
 * @trace PRL-IT-013
 * @precondition Repository-localの自己生成Gitと元Operation。
 * @stimulus 二Taskで同Treeの一つの追跡ファイルを編集し、capture／verify後に一時物だけ回収する。
 * @observation 変更Path、開始基準、元Tree・Git・内部状態。
 * @oracle 既存dirtyは今回変更でなく、Tree／Branchを保持する。
 * @cleanup 自己生成Repositoryと既存Operationを回収する。
 * @boundary 実Git／FS。Provider・Docker・Bundle保存は使わない。
 */
test("借用Workspaceは開始時dirtyを保持し二Task後も同Treeを残す", async (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  const root = fs.mkdtempSync(path.join(parent, "borrowed-workspace-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  /**
   * 自己生成Workspace試験だけへ中立環境のGit要求を発行する。
   * @responsibility 自己生成Workspace試験だけへ中立環境のGit要求を発行する。
   * @trace RFD-IT-013
   * @trace PRL-IT-013
   * @precondition 検証済みfixture Rootと固定argv。
   * @stimulus hooks・署名・親GIT環境を無効にして有限時間でGitを呼ぶ。
   * @observation 終了値とstdout、実HEAD・Index。
   * @oracle 正常終了だけ返し本体Gitへ要求を配送しない。
   * @cleanup Caseのfinallyで借用Treeと自己生成Rootを確認後に回収する。
   * @boundary 通信なし実Git。ProviderやDockerは使用しない。
   */
  const git = (args: string[]) =>
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        `core.hooksPath=${os.devNull}`,
        "-c",
        "commit.gpgSign=false",
        ...args,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
          ),
          GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull,
          GIT_CONFIG_SYSTEM: process.platform === "win32" ? "NUL" : os.devNull,
        },
      },
    ).trim();
  git(["init", "--initial-branch=main", "--template="]);
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "");
  git(["config", "user.name", "Borrowed Test"]);
  git(["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n.env\n");
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  git(["add", "."]);
  git(["commit", "-m", "base"]);
  const base = git(["rev-parse", "HEAD"]);
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const uuid = randomUUID();
  assert.equal(
    createWorktree(verified.capability, {
      ...workspaceWorktreeTarget(uuid),
      baseCommit: base,
    }).status,
    "completed",
  );
  fs.writeFileSync(path.join(root, "source.txt"), "shared dirty\n");
  for (const workspaceId of [null, uuid]) {
    const tree = workspaceId
      ? path.join(root, ".crdd", "workspaces", uuid, "worktree")
      : root;
    if (workspaceId)
      fs.writeFileSync(path.join(tree, "source.txt"), "prior task\n");
    const target = {
      workspaceId,
      ownerRepositoryRoot: root,
      executionTree: tree,
      baseCommit: workspaceId ? base : null,
      head: workspaceId ? base : null,
    };
    assert.ok(inspectBorrowedExecutionTarget(root, target));
    assert.ok(
      inspectBorrowedExecutionTarget(root, {
        ...target,
        workspaceId: "upper-correlation-only",
      }),
    );
    assert.equal(
      inspectBorrowedExecutionTarget(root, { ...target, head: "f".repeat(40) }),
      null,
    );
    assert.equal(
      inspectBorrowedExecutionTarget(root, {
        ...target,
        ownerRepositoryRoot: `${tree}-other`,
      }),
      null,
    );
    if (workspaceId) {
      assert.equal(
        inspectBorrowedExecutionTarget(root, { ...target, head: null }),
        null,
      );
      const ownerRef = path.join(root, ".git", "refs", "heads", "main");
      const ownerHead = fs.readFileSync(ownerRef);
      fs.unlinkSync(ownerRef);
      try {
        assert.ok(inspectBorrowedExecutionTarget(root, target));
        // 実行先は指定フォルダとして扱い、HEADのCommit実在を条件にしない。
        assert.ok(
          inspectBorrowedExecutionTarget(root, {
            ...target,
            workspaceId: null,
            executionTree: root,
            baseCommit: null,
            head: null,
          }),
        );
      } finally {
        fs.writeFileSync(ownerRef, ownerHead);
      }
    }
    let receivedTarget: unknown;
    const adapted = await runTestSingleTaskAttempt(
      {
        startTask: (_request, owner, _id, _observer, _consumer, selected) => {
          assert.equal(owner, root);
          receivedTarget = selected;
          return {
            status: "started",
            controlCapability: {},
            completion: Promise.resolve({
              status: "completed",
              reason: "coordinator_task_workspace_review_completed",
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              candidateId: null,
              hostRecoveryId: null,
              candidateRecoveryId: null,
              candidateStoreRecoveryId: null,
              dockerRecoveryIds: [],
              canonicalRepositoryChanged: workspaceId === null ? null : false,
              workspaceResult: {
                workspaceId,
                changedPaths: null,
                canonicalRepositoryChanged: workspaceId === null ? null : false,
                changeAttribution: "unattributed",
                workspaceDeletionIssued: false,
              },
            }),
          };
        },
        cancelTask: () => ({}),
      },
      {
        attemptId: "attempt-workspace",
        operationId: "operation-workspace",
        authorityBindingId: "authority-workspace",
        repositoryRevision: base,
        taskRequest: {},
        repositoryRoot: root,
        workspaceTarget: target,
        cancellationSignal: new AbortController().signal,
      },
    );
    assert.equal(adapted.status, "completed");
    assert.deepEqual(receivedTarget, target);
    assert.notEqual(receivedTarget, target);
    assert.ok(Object.isFrozen(receivedTarget));
    const internal = path.join(tree, ".crdd");
    fs.mkdirSync(internal, { recursive: true });
    fs.writeFileSync(path.join(internal, "state.json"), "not an input\n");
    fs.writeFileSync(path.join(tree, ".env"), "synthetic-development-value\n");
    const gitFile = workspaceId
      ? path.join(tree, ".git")
      : path.join(tree, ".git", "HEAD");
    const beforeGit = fs.readFileSync(gitFile);
    for (let turn = 0; turn < 2; turn++) {
      const current = operation(root, false);
      try {
        const borrowed = bindExecutionSnapshot(
          current.bound.repositoryBindingCapability,
          current.managementCapability,
          current.mountCapability,
          ["source.txt"],
          target,
        );
        assert.ok(borrowed?.status === "materialized");
        if (borrowed?.status !== "materialized") return;
        const deliver = async (
          observation: ReturnType<typeof projectBorrowedExecutionResult>,
          failed = false,
        ) => {
          const delivered = await runTestSingleTaskAttempt(
            {
              startTask: () => ({
                status: "started",
                controlCapability: {},
                completion: Promise.resolve({
                  status: failed ? "blocked" : "completed",
                  reason: failed
                    ? "coordinator_task_candidate_verification_failed"
                    : "coordinator_task_workspace_review_completed",
                  cleanupConfirmed: !failed,
                  manualRecoveryRequired: failed,
                  processRestartRequired: failed,
                  candidateId: null,
                  hostRecoveryId: null,
                  candidateRecoveryId: null,
                  candidateStoreRecoveryId: null,
                  dockerRecoveryIds: failed
                    ? [
                        "docker-task." +
                          "1".repeat(64) +
                          "." +
                          "2".repeat(64) +
                          "." +
                          "3".repeat(64),
                      ]
                    : [],
                  canonicalRepositoryChanged:
                    observation.canonicalRepositoryChanged,
                  workspaceResult: observation,
                }),
              }),
              cancelTask: () => ({}),
            },
            {
              attemptId: "attempt-observation",
              operationId: "operation-observation",
              authorityBindingId: "authority-observation",
              repositoryRevision: base,
              taskRequest: {},
              repositoryRoot: root,
              workspaceTarget: target,
              cancellationSignal: new AbortController().signal,
            },
          );
          assert.equal(delivered.status, failed ? "blocked" : "completed");
          if (failed) {
            assert.equal(
              delivered.reason,
              "coordinator_task_candidate_verification_failed",
            );
            assert.equal(delivered.cleanupConfirmed, false);
            assert.equal(delivered.manualRecoveryRequired, true);
            assert.equal(delivered.processRestartRequired, true);
            assert.deepEqual(delivered.recoveryIds, [
              "docker-task." +
                "1".repeat(64) +
                "." +
                "2".repeat(64) +
                "." +
                "3".repeat(64),
            ]);
          }
          assert.deepEqual(delivered.workspaceResult, observation);
          return observation;
        };
        assert.equal(
          (await deliver(projectBorrowedExecutionResult(target))).changedPaths,
          null,
        );
        assert.equal(
          readBorrowedExecutionBinding(current.managementCapability)?.target
            .executionTree,
          tree,
        );
        const providerBinding = verifyProviderOperationMount(
          current.managementCapability,
          current.mountCapability,
        );
        assert.equal(providerBinding.mounts.workspace, tree);
        assert.ok("workspaceProtection" in providerBinding);
        fs.writeFileSync(path.join(tree, "source.txt"), `turn-${turn}\n`);
        fs.writeFileSync(path.join(internal, "state.json"), `state-${turn}\n`);
        const observation = projectBorrowedExecutionResult(target);
        const delivered = await deliver(observation);
        assert.equal(delivered.changedPaths, null);
        assert.equal(
          delivered.canonicalRepositoryChanged,
          workspaceId === null ? null : false,
        );
        if (workspaceId === null && turn === 0)
          assert.equal((await deliver(observation, true)).changedPaths, null);
      } finally {
        cleanupOwnedOperationDirectories(current.owned);
      }
      assert.equal(
        fs.readFileSync(path.join(tree, "source.txt"), "utf8"),
        `turn-${turn}\n`,
      );
      assert.deepEqual(fs.readFileSync(gitFile), beforeGit);
    }
    if (workspaceId)
      assert.equal(
        git(["rev-parse", `refs/heads/crdd/workspace/${uuid}`]),
        base,
      );
  }
});

/**
 * writeObjectのTest準備責務を実行する。
 *
 * @responsibility writeObjectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus writeObjectを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function writeObject(
  commonDirectory: string,
  objectType: string,
  bytes: Buffer,
) {
  const framed = Buffer.concat([
    Buffer.from(`${objectType} ${bytes.byteLength}\0`),
    bytes,
  ]);
  const objectId = createHash("sha1").update(framed).digest("hex");
  const target = path.join(
    commonDirectory,
    "objects",
    objectId.slice(0, 2),
    objectId.slice(2),
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, deflateSync(framed));
  return objectId;
}

/**
 * treeEntryのTest準備責務を実行する。
 *
 * @responsibility treeEntryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus treeEntryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function treeEntry(mode: string, name: string, objectId: string) {
  return Buffer.concat([
    Buffer.from(`${mode} ${name}\0`),
    Buffer.from(objectId, "hex"),
  ]);
}

/**
 * repositoryのTest準備責務を実行する。
 *
 * @responsibility repositoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus repositoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function repository(t: TestContext) {
  const root = fs.mkdtempSync(
    path.resolve(
      import.meta.dirname,
      "../../../../.crdd/tests/crdd-workspace-repository-",
    ),
  );
  const cleanupOperations: Array<() => void> = [];
  const rootIdentity = fs.lstatSync(root, { bigint: true });
  const commonDirectory = path.join(root, ".git");
  fs.mkdirSync(path.join(commonDirectory, "info"), { recursive: true });
  fs.writeFileSync(path.join(commonDirectory, "info", "exclude"), ".crdd/\n");
  fs.mkdirSync(path.join(commonDirectory, "refs", "heads"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(commonDirectory, "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(commonDirectory, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n",
  );
  const readmeId = writeObject(commonDirectory, "blob", Buffer.from("base\n"));
  const sourceId = writeObject(
    commonDirectory,
    "blob",
    Buffer.from("export const value = 1;\n"),
  );
  const sourceTreeId = writeObject(
    commonDirectory,
    "tree",
    treeEntry("100644", "index.ts", sourceId),
  );
  const rootTreeId = writeObject(
    commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "README.md", readmeId),
      treeEntry("40000", "src", sourceTreeId),
    ]),
  );
  const commitId = writeObject(
    commonDirectory,
    "commit",
    Buffer.from(
      `tree ${rootTreeId}\nauthor Fixture <fixture@example.invalid> 0 +0000\ncommitter Fixture <fixture@example.invalid> 0 +0000\n\nfixture\n`,
    ),
  );
  fs.writeFileSync(
    path.join(commonDirectory, "refs", "heads", "main"),
    `${commitId}\n`,
  );
  t.after(() => {
    const failures: unknown[] = [];
    for (const cleanup of [...cleanupOperations].reverse()) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "fixture_host_cleanup_unconfirmed");
    const currentIdentity = fs.lstatSync(root, { bigint: true });
    assert.equal(currentIdentity.isDirectory(), true);
    assert.equal(currentIdentity.isSymbolicLink(), false);
    assert.equal(currentIdentity.dev, rootIdentity.dev);
    assert.equal(currentIdentity.ino, rootIdentity.ino);
    assert.equal(currentIdentity.birthtimeNs, rootIdentity.birthtimeNs);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return Object.freeze({ root, commonDirectory, commitId, cleanupOperations });
}

/**
 * snapshotRepositoryFilesのTest準備責務を実行する。
 *
 * @responsibility snapshotRepositoryFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus snapshotRepositoryFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function snapshotRepositoryFiles(root: string) {
  return fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .sort()
    .filter(
      (relativePath) =>
        relativePath !== ".crdd" &&
        !relativePath.startsWith(`.crdd${path.sep}`) &&
        !relativePath.startsWith(path.join(".git", "objects") + path.sep) &&
        !relativePath.startsWith(
          path.join(".git", "refs", "heads", "crdd", "operation") + path.sep,
        ) &&
        !relativePath.startsWith(
          path.join(".git", "logs", "refs", "heads", "crdd", "operation") +
            path.sep,
        ) &&
        fs.lstatSync(path.join(root, relativePath)).isFile(),
    )
    .map((relativePath) => ({
      relativePath,
      sha256: createHash("sha256")
        .update(fs.readFileSync(path.join(root, relativePath)))
        .digest("hex"),
    }));
}

/** 借用済みTreeのReviewer準備にはGit一覧を要求しない。 @trace RFD-IT-013 */
test("Reviewerの準備はGitを起動せず借用済みWorkspaceだけを使う", (t) => {
  const runtime = operation(repository(t));
  const binding = runtime.bound.repositoryBindingCapability;
  assert.equal(
    bindExecutionSnapshot(
      binding,
      runtime.managementCapability,
      runtime.mountCapability,
    )?.status,
    "materialized",
  );
  const original = childProcess.spawnSync;
  const calls: string[] = [];
  const git = t.mock.method(
    childProcess,
    "spawnSync",
    (...args: Parameters<typeof original>) => {
      if (/^git(?:\.exe)?$/iu.test(path.basename(String(args[0]))))
        calls.push(String(args[0]));
      return original(...args);
    },
  );
  syncBuiltinESMExports();
  try {
    const prepared = prepareReviewerWorkspace(
      binding,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(prepared?.workspaceReview, true);
    assert.deepEqual(calls, []);
  } finally {
    git.mock.restore();
    syncBuiltinESMExports();
  }
});

const fixtureTargets = new WeakMap<
  object,
  NonNullable<ReturnType<typeof inspectBorrowedExecutionTarget>>
>();

/**
 * 上位役の試験fixtureが解決した対象を実行境界へ渡す。
 * @responsibility 旧複製を復活させず、読取り範囲・拒否例を同じ実Treeで検査する。
 * @trace RFD-IT-013
 * @precondition 自己生成の実Git Worktreeをfixtureが所有する。
 * @stimulus 対象と読取りPathを本番の借用入口へ渡す。
 * @observation 借用結果又は拒否。
 * @oracle 呼出し元が変更範囲・安全境界を照合する。
 * @cleanup Worktreeを含む自己生成Rootを試験終了時に回収する。
 * @boundary 上位fixtureとCoordinator。製品にWorkspace解決を追加しない。
 */
function bindExecutionSnapshot(
  binding: unknown,
  management: unknown,
  mount: unknown,
  readPaths?: unknown,
  target?: unknown,
) {
  return materializeReceivedTarget(
    binding,
    management,
    mount,
    readPaths,
    target ??
      (binding && typeof binding === "object"
        ? fixtureTargets.get(binding)
        : undefined),
  );
}

/**
 * operationのTest準備責務を実行する。
 *
 * @responsibility operationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus operationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function operation(
  fixture: string | ReturnType<typeof repository>,
  automaticCleanup = true,
) {
  const repositoryRoot = typeof fixture === "string" ? fixture : fixture.root;
  const verified = getRepository(repositoryRoot);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  const owned = createOwnedOperationDirectories({
    root: verified.capability,
    purpose: "task",
    recordingCurrent: () => true,
  });
  if (automaticCleanup) {
    assert.notEqual(typeof fixture, "string");
    if (typeof fixture !== "string")
      fixture.cleanupOperations.push(() => {
        cleanupOwnedOperationDirectories(owned);
        assert.throws(() => fs.lstatSync(owned.root), { code: "ENOENT" });
      });
  }
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const bound = bindRepositoryOperation(managementCapability, repositoryRoot);
  assert.ok(bound);
  let workspace = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  ).mounts.workspace;
  if (automaticCleanup) {
    const root = getRepository(repositoryRoot);
    assert.equal(root.status, "completed");
    if (root.status !== "completed") throw new Error("fixture_root_missing");
    const workspaceId = randomUUID();
    const base = fs
      .readFileSync(path.join(repositoryRoot, ".git/refs/heads/main"), "utf8")
      .trim();
    const created = createWorktree(root.capability, {
      ...workspaceWorktreeTarget(workspaceId),
      baseCommit: base,
    });
    assert.equal(created.status, "completed", JSON.stringify(created));
    workspace = path.join(
      repositoryRoot,
      ".crdd/workspaces",
      workspaceId,
      "worktree",
    );
    fixtureTargets.set(bound.repositoryBindingCapability, {
      workspaceId,
      ownerRepositoryRoot: repositoryRoot,
      executionTree: workspace,
      baseCommit: base,
      head: base,
    });
  }
  return Object.freeze({
    owned,
    mountCapability,
    managementCapability,
    bound,
    workspace,
  });
}

/** 大きいファイルがある借用Treeを本文コピーなしで引き渡す。 @trace RFD-IT-013 */
test("1MiB超のFileも本文を複製せず借用済みWorkspaceでレビューする", (t) => {
  const source = repository(t);
  const runtime = operation(source);
  const beforeFiles = snapshotRepositoryFiles(source.root);
  const materialized = bindExecutionSnapshot(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(materialized?.status, "materialized");
  const relative = "src/large.txt";
  const content = "a".repeat(1024 * 1024 + 1);
  fs.writeFileSync(path.join(runtime.workspace, relative), content);
  const { projection: projectionDirectory } =
    verifyOwnedOperationManagementMountBinding(
      runtime.managementCapability,
      runtime.mountCapability,
    ).mounts;
  const projectionBefore = fs.readdirSync(projectionDirectory).sort();
  const projection = prepareReviewerWorkspace(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.ok(projection?.workspaceReview);
  assert.deepEqual(projection.files, []);
  assert.equal(projection.totalBytes, 0);
  assert.deepEqual(
    fs.readdirSync(projectionDirectory).sort(),
    projectionBefore,
  );
  const owned = readOwnedReviewerWorkspace(
    runtime.managementCapability,
    projection.candidateSnapshotId,
  );
  assert.equal(owned?.directory, runtime.workspace);
  assert.equal(
    fs.readFileSync(path.join(runtime.workspace, relative), "utf8"),
    content,
  );
  assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
});

/** 実行の個別入力にない通常ファイルも選択済みTree内のレビュー対象になる。 @trace RFD-IT-013 */
test("Reviewerの対象は実行の個別入力ではなく選択済みWorkspace全体", (t) => {
  const source = repository(t);
  const runtime = operation(source);
  const binding = runtime.bound.repositoryBindingCapability;
  const before = snapshotRepositoryFiles(source.root);
  assert.equal(
    bindExecutionSnapshot(
      binding,
      runtime.managementCapability,
      runtime.mountCapability,
      ["src/"],
    )?.status,
    "materialized",
  );
  fs.writeFileSync(path.join(runtime.workspace, "notes.txt"), "review context");
  fs.writeFileSync(path.join(runtime.workspace, "src", "index.ts"), "inside");
  const projection = prepareReviewerWorkspace(
    binding,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.ok(projection?.workspaceReview);
  const owned = readOwnedReviewerWorkspace(
    runtime.managementCapability,
    projection.candidateSnapshotId,
  );
  assert.ok(owned);
  assert.equal(owned.directory, runtime.workspace);
  assert.equal(
    fs.readFileSync(path.join(owned.directory, "notes.txt"), "utf8"),
    "review context",
  );
  assert.ok(
    !owned.masks.some(({ relativePath }) => relativePath === "notes.txt"),
  );
  assert.deepEqual(snapshotRepositoryFiles(source.root), before);
});

for (const [scenario, label] of [
  ["depth", "70段・全Path長1024byte超"],
  ["file_size", "単一File64MiB超"],
  ["junction", "junction entry"],
] as const) {
  /**
   * 大きい正常値は候補化し、junctionは拒否して元Repositoryを保持する。
   *
   * @responsibility 容量・深さとLink境界を混同せず、借用対象を変更・清掃しない。
   * @trace RFD-IT-013
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 深い長Path、旧64MiB超の実File、junctionを個別に構築する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`実行後workspaceの${label}は構造条件だけで判定し元Repositoryを保持する`, (t) => {
    if (scenario === "junction" && process.platform !== "win32") {
      t.skip("Windows junction boundary only");
      return;
    }
    const source = repository(t);
    const runtime = operation(source);
    const beforeFiles = snapshotRepositoryFiles(source.root);
    const materialized = bindExecutionSnapshot(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    const workspaceIdentity = fs.lstatSync(runtime.workspace, { bigint: true });
    const linkPath = path.join(runtime.workspace, "src", "linked");
    let linkCreated = false;
    try {
      if (scenario === "depth") {
        let directory = runtime.workspace;
        for (let depth = 0; depth < 70; depth += 1) {
          directory = path.join(
            directory,
            `depth-${String(depth).padStart(3, "0")}-segment`,
          );
          fs.mkdirSync(directory);
        }
        const relativePath = path
          .relative(runtime.workspace, path.join(directory, "deep.txt"))
          .split(path.sep)
          .join("/");
        assert.ok(Buffer.byteLength(relativePath) > 1024);
        assert.equal(isExecutionRelativePath(relativePath), true);
        fs.writeFileSync(path.join(directory, "deep.txt"), "deep\n");
      } else if (scenario === "file_size") {
        const oversizedFile = path.join(runtime.workspace, "src", "large.bin");
        const descriptor = fs.openSync(oversizedFile, "wx");
        try {
          fs.ftruncateSync(descriptor, 64 * 1024 * 1024 + 1);
        } finally {
          fs.closeSync(descriptor);
        }
        assert.equal(fs.statSync(oversizedFile).size, 64 * 1024 * 1024 + 1);
        const read = readExecutionFile(oversizedFile);
        assert.equal(read.content.length, 64 * 1024 * 1024 + 1);
        assert.equal(
          read.sha256,
          createHash("sha256").update(read.content).digest("hex"),
        );
      } else {
        const target = path.join(runtime.workspace, "src");
        fs.symlinkSync(target, linkPath, "junction");
        linkCreated = true;
        assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
      }
      const captured = prepareReviewerWorkspace(
        runtime.bound.repositoryBindingCapability,
        runtime.managementCapability,
        runtime.mountCapability,
      );
      assert.equal(
        captured?.status ?? null,
        scenario === "junction" ? null : "projected",
      );
      assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
      const currentIdentity = fs.lstatSync(runtime.workspace, { bigint: true });
      assert.equal(currentIdentity.dev, workspaceIdentity.dev);
      assert.equal(currentIdentity.ino, workspaceIdentity.ino);
      assert.equal(currentIdentity.birthtimeNs, workspaceIdentity.birthtimeNs);
    } finally {
      if (linkCreated) {
        assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
        fs.unlinkSync(linkPath);
      }
    }
  });
}

/**
 * 偽Capabilityと動的allowed pathをFilesystem Effectへ昇格しないを検証する。
 *
 * @responsibility 偽Capabilityと動的allowed pathをFilesystem Effectへ昇格しないの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 偽Capabilityと動的allowed pathをFilesystem Effectへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("偽Capabilityと動的allowed pathをFilesystem Effectへ昇格しない", (t) => {
  const source = repository(t);
  const runtime = operation(source);
  const ownedWorkspace = verifyOwnedOperationManagementMountBinding(
    runtime.managementCapability,
    runtime.mountCapability,
  ).mounts.workspace;
  const before = fs.readdirSync(ownedWorkspace);
  for (const target of [undefined, {}]) {
    assert.equal(
      materializeReceivedTarget(
        runtime.bound.repositoryBindingCapability,
        runtime.managementCapability,
        runtime.mountCapability,
        undefined,
        target,
      ),
      null,
    );
    assert.deepEqual(fs.readdirSync(ownedWorkspace), before);
  }
  assert.equal(
    bindExecutionSnapshot(
      {},
      runtime.managementCapability,
      runtime.mountCapability,
    ),
    null,
  );
  const materialized = bindExecutionSnapshot(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  if (materialized?.status !== "materialized") {
    assert.fail("workspace must materialize");
  }
  const dynamicAllowedPaths = new Proxy([], {
    getOwnPropertyDescriptor() {
      throw new Error("must not execute");
    },
  });
  assert.equal(
    bindExecutionSnapshot(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      dynamicAllowedPaths,
    ),
    null,
  );
});

/** 借用Treeの機密はコピーせずパスを遮蔽し、機密を含む名前は拒否する。 @trace RFD-IT-013 */
test("Reviewerは機密ファイル・ディレクトリを覆い、機密値を含む名前は拒否する", (t) => {
  for (const scenario of [
    "path",
    "directory",
    "secret-name",
    "content",
  ] as const) {
    const source = repository(t);
    const runtime = operation(source);
    const materialized = bindExecutionSnapshot(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    const relativePath =
      scenario === "path"
        ? ".env"
        : scenario === "directory"
          ? "src/.env.local"
          : scenario === "secret-name"
            ? "src/session_token=abcdefghijklmnopqrstuvwx"
            : "src/index.ts";
    const target = path.join(runtime.workspace, relativePath);
    if (scenario === "directory") {
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "private.txt"), "ordinary\n");
    } else {
      fs.writeFileSync(
        target,
        scenario === "content"
          ? "OPENAI_API_KEY=synthetic-fixture-value\n"
          : "ordinary\n",
      );
    }
    const projection = prepareReviewerWorkspace(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    if (scenario === "secret-name") {
      assert.equal(projection, null);
    } else {
      assert.ok(projection?.workspaceReview);
      assert.deepEqual(projection.files, []);
      assert.equal(
        projection.withheldFileCount,
        scenario === "content" ? 1 : 0,
      );
      const owned = readOwnedReviewerWorkspace(
        runtime.managementCapability,
        projection.candidateSnapshotId,
      );
      assert.ok(owned);
      assert.ok(
        owned.masks.some(
          (mask) =>
            mask.relativePath === relativePath &&
            mask.kind === (scenario === "directory" ? "directory" : "file"),
        ),
      );
    }
    assert.ok(fs.existsSync(target));
  }
});

/** 遮蔽と作業ツリーの相関を確認し、再準備後に旧根拠で開かない。 @trace RFD-IT-013 */
test("ReviewerのWorkspaceは候補に結び付き再準備後に旧候補では開けない", (t) => {
  const source = repository(t);
  const runtime = operation(source);
  const materialized = bindExecutionSnapshot(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
    ["README.md"],
  );
  assert.equal(materialized?.status, "materialized");
  const target = path.join(runtime.workspace, "README.md");
  fs.writeFileSync(target, "candidate\n");
  const prepare = () =>
    prepareReviewerWorkspace(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
  const projected = prepare();
  assert.ok(projected?.workspaceReview);
  const owned = readOwnedReviewerWorkspace(
    runtime.managementCapability,
    projected.candidateSnapshotId,
  );
  assert.equal(owned?.directory, runtime.workspace);
  assert.equal(
    readOwnedReviewerWorkspace({}, projected.candidateSnapshotId),
    null,
  );
  fs.writeFileSync(target, "replaced\n");
  const next = prepare();
  assert.ok(next?.workspaceReview);
  assert.notEqual(next.candidateSnapshotId, projected.candidateSnapshotId);
  assert.deepEqual(next.files, []);
  assert.equal(fs.readFileSync(target, "utf8"), "replaced\n");
  assert.equal(
    readOwnedReviewerWorkspace(
      runtime.managementCapability,
      projected.candidateSnapshotId,
    ),
    null,
  );
});

/**
 * 親削除後の読取り失敗を存在確認済みへ補完しない。
 * @responsibility 技術回収成立と上位親Directoryの観測不明を分離する。
 * @trace RFD-IT-013
 * @precondition 今回作成した空のWorkspace親。
 * @stimulus 実rmdir後の親lstatだけEIO。
 * @observation 回収段階・保存投影・実体不存在。
 * @oracle WorktreeとBranchの成立を維持し親だけnull、全体blocked。
 * @cleanup 差替え解除後、今回Rootだけ回収する。
 * @boundary 非AIの局所Filesystem試験。
 */
test("Workspace親の削除後観測不明は未確認のまま保存へ返す", (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  const root = fs.mkdtempSync(
    path.join(parent, "workspace-parent-observation-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  candidateGit(root, ["init"]);
  const id = randomUUID();
  const target = workspaceWorktreeTarget(id);
  const directory = path.join(root, ".crdd", "workspaces", id);
  fs.mkdirSync(directory, { recursive: true });
  const original = fs.lstatSync;
  Reflect.set(fs, "lstatSync", ((file, ...args) => {
    if (String(file) === directory && !fs.existsSync(directory))
      throw Object.assign(new Error("synthetic"), { code: "EIO" });
    return Reflect.apply(original, fs, [file, ...args]);
  }) as typeof fs.lstatSync);
  let result: RepositoryWorktreeResult;
  try {
    result = workspaceWorktreeResult(
      root,
      id,
      {
        status: "completed",
        reason: "worktree_operation_completed",
        relativePath: target.relativePath,
        branch: target.branch,
        expectedCommit: "a".repeat(40),
        effectIssued: true,
        worktreeRemoved: true,
        branchRemoved: true,
        parentDirectoryRetained: true,
        observation: {
          registered: false,
          directoryPresent: false,
          branchHead: null,
          head: null,
          locked: false,
          prunable: false,
          dirty: null,
        },
      },
      true,
    );
  } finally {
    Reflect.set(fs, "lstatSync", original);
  }
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "worktree_parent_cleanup_unconfirmed");
  assert.equal(result.workspaceDirectoryRetained, null);
  assert.equal(result.worktreeRemoved, true);
  assert.equal(result.branchRemoved, true);
  assert.throws(() => fs.lstatSync(directory), { code: "ENOENT" });
});

/**
 * 自己生成fixtureへ準備用Gitを発行する。
 * @responsibility 実験の対照とCommit操作を製品入口から区別する。
 * @trace RFD-IT-029
 * @precondition rootは本試験所有領域。
 * @stimulus 明示したGit引数。
 * @observation stdoutと終了値。
 * @oracle 正常終了だけを返す。
 * @cleanup fixture終了時にまとめて回収。
 * @boundary 実Git、外部通信なし。
 */
function candidateGit(root: string, args: string[], hooks = false) {
  return execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "commit.gpgSign=false",
      ...(!hooks ? ["-c", `core.hooksPath=${CANDIDATE_GIT_EMPTY}`] : []),
      ...args,
    ],
    {
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
        ),
        GIT_CONFIG_GLOBAL: CANDIDATE_GIT_EMPTY,
        GIT_CONFIG_SYSTEM: CANDIDATE_GIT_EMPTY,
        GIT_TERMINAL_PROMPT: "0",
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    },
  ).trim();
}

/**
 * 固定Root内に合成Repositoryと回収hookを用意する。
 * @responsibility 全生成物をRepository-localへ閉じる。
 * @trace RFD-IT-029
 * @precondition CANDIDATE_TESTS_ROOTは実Directoryである。
 * @stimulus 最小Commitとignoreを生成。
 * @observation Base Commitと検証済みRoot。
 * @oracle 検証成功、試験終了後Root不存在。
 * @cleanup 自己生成Rootのみをafterで削除。
 * @boundary 本体Git・認証・Dockerには触れない。
 */
function candidateFixture(t: TestContext): CandidateGitFixture {
  assert.equal(fs.lstatSync(CANDIDATE_TESTS_ROOT).isSymbolicLink(), false);
  assert.equal(
    fs.realpathSync.native(CANDIDATE_TESTS_ROOT),
    CANDIDATE_TESTS_ROOT,
  );
  const root = fs.mkdtempSync(
    path.join(CANDIDATE_TESTS_ROOT, "worktree-management-"),
  );
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  candidateGit(root, ["init", "--initial-branch=main", "--template="]);
  candidateGit(root, ["config", "user.name", "Synthetic Test"]);
  candidateGit(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(
    path.join(root, ".gitignore"),
    ".crdd/\nignored.txt\n.env\n",
  );
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  candidateGit(root, ["add", "."]);
  candidateGit(root, ["commit", "-m", "base"]);
  const base = candidateGit(root, ["rev-parse", "HEAD"]);
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture_root_invalid");
  /**
   * 所有Worktreeの固定相対配置を試験Rootへ結合する。
   * @responsibility 所有Worktreeの固定相対配置を試験Rootへ結合する。
   * @trace RFD-IT-029
   * @precondition fixtureのRepo Rootと試験UUID。
   * @stimulus 固定workspaces配置へidを結合する。
   * @observation 期待するWorktree絶対Path。
   * @oracle 作成・観測・削除の結果を同じ対象Pathへ照合する。
   * @cleanup 実WorktreeとRefは呼出し元が正式処理で回収する。
   * @boundary 試験の期待Path計算のみ。資源は生成しない。
   */
  const target = (id: string) =>
    path.join(root, ".crdd", "workspaces", id, "worktree");
  return { root, base, capability: verified.capability, target };
}

/**
 * 確認したraw bytesをGit Blob IDと明示選択へ結合する。
 * @responsibility Stageではなく現在file全体を確認する。
 * @trace RFD-IT-029
 * @precondition 作成済み自己生成Worktree。
 * @stimulus hash-objectの読取り。
 * @observation Base、Workspace HEAD、選択Blob。
 * @oracle 呼出し前の内容だけを固定入力にする。
 * @cleanup fixtureのafter。
 * @boundary 実Git、外部通信なし。
 */
function candidateInput(
  f: CandidateGitFixture,
  id: string,
): WorkspaceCandidateRequest {
  return {
    workspaceId: id,
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedWorkspaceHead: candidateGit(f.target(id), ["rev-parse", "HEAD"]),
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: candidateGit(f.target(id), [
          "hash-object",
          "--no-filters",
          "source.txt",
        ]),
      },
    ],
    workspaceName: "継続作業",
    candidateName: "選択した改善",
    relatedChangeIds: ["CHG-000082"],
  };
}

/**
 * Object発行後の故障と未完了Mergeの正規再入場を反証する。
 * @responsibility 要求Effect計数と元Commit再利用、Tree未一致拒否。
 * @trace RFD-IT-029
 * @precondition 新品Workspaceと削除又は通常候補。
 * @stimulus Ref作成拒否、Commit拒否、偽二親Tree。
 * @observation 元OID、MERGE_HEAD、親／Tree、通常index。
 * @oracle 再Merge・別候補生成0、不一致は停止。
 * @cleanup spawn差替えを戻しfixtureを回収。
 * @boundary 実Git、故障通知だけ有限代役。
 */
test("CandidateのObject後故障・未完了Merge・偽二親Treeを同対象で判別する", (t) => {
  const f = candidateFixture(t);
  const id = randomUUID();
  createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  const source = candidateInput(f, id);
  fs.unlinkSync(path.join(f.target(id), "source.txt"));
  const input = {
    ...source,
    selection: [{ path: "source.txt", mode: null, blobId: null }],
  };
  const spawn = childProcess.spawnSync;
  let failRef = true;
  let commitRequests = 0;
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const command = args[1];
    if (Array.isArray(command) && command.includes("commit-tree"))
      commitRequests++;
    if (failRef && Array.isArray(command) && command.includes("update-ref"))
      return {
        pid: 0,
        output: [null, "", ""],
        stdout: "",
        stderr: "synthetic",
        status: 1,
        signal: null,
      };
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  let failed: WorkspaceCandidateResult;
  try {
    failed = freezeWorkspaceCandidate(f.capability, input);
  } finally {
    childProcess.spawnSync = spawn;
    syncBuiltinESMExports();
  }
  assert.equal(failed.status, "blocked");
  assert.equal(failed.effectIssued, true);
  assert.ok(failed.candidateCommit);
  assert.equal(commitRequests, 1);
  failRef = false;
  const fixed = freezeWorkspaceCandidate(
    f.capability,
    input,
    failed.candidateCommit,
  );
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  assert.equal(fixed.candidateCommit, failed.candidateCommit);
  const candidateCommit = fixed.candidateCommit;
  assert.ok(candidateCommit);
  const target = {
    candidateCommit,
    targetBranch: "main",
    expectedTargetHead: f.base,
  };
  for (const failure of ["unknown", "symbolic"]) {
    let mergeRequests = 0;
    childProcess.spawnSync = ((
      ...args: Parameters<typeof childProcess.spawnSync>
    ) => {
      const command = args[1];
      if (Array.isArray(command) && command.includes("merge")) mergeRequests++;
      if (
        Array.isArray(command) &&
        command.includes(fixed.candidateRef as string) &&
        command.includes(failure === "symbolic" ? "symbolic-ref" : "rev-parse")
      )
        return {
          pid: 0,
          output: [null, "", ""],
          stdout: failure === "symbolic" ? "refs/heads/main\n" : "",
          stderr: "synthetic",
          status: failure === "symbolic" ? 0 : 2,
          signal: null,
        };
      return Reflect.apply(spawn, childProcess, args);
    }) as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    try {
      const rejected = mergeWorkspaceCandidate(f.capability, input, target);
      assert.equal(
        rejected.reason,
        failure === "symbolic"
          ? "candidate_ref_not_direct"
          : "candidate_ref_unavailable",
      );
      assert.equal(rejected.effectIssued, false);
      assert.equal(mergeRequests, 0);
    } finally {
      childProcess.spawnSync = spawn;
      syncBuiltinESMExports();
    }
  }
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    if (Array.isArray(args[1]) && args[1].includes("commit"))
      return {
        pid: 0,
        output: [null, "", ""],
        stdout: "",
        stderr: "synthetic",
        status: 1,
        signal: null,
      };
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  let interrupted: WorkspaceCandidateResult;
  try {
    interrupted = mergeWorkspaceCandidate(f.capability, input, target);
  } finally {
    childProcess.spawnSync = spawn;
    syncBuiltinESMExports();
  }
  assert.equal(interrupted.reason, "commit_merge_commit_failed");
  assert.equal(interrupted.effectIssued, true);
  assert.equal(
    candidateGit(f.root, ["rev-parse", "MERGE_HEAD"]),
    candidateCommit,
  );
  const mergeHeadFile = path.join(f.root, ".git", "MERGE_HEAD");
  fs.writeFileSync(mergeHeadFile, `${candidateCommit}\n${f.base}\n`);
  assert.equal(
    mergeWorkspaceCandidate(f.capability, input, target).reason,
    "commit_merge_in_progress",
  );
  assert.equal(candidateGit(f.root, ["rev-parse", "HEAD"]), f.base);
  fs.writeFileSync(mergeHeadFile, `${candidateCommit}\n`);
  const resumed = mergeWorkspaceCandidate(f.capability, input, target);
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.ok(resumed.mergeCommit);
  const fake = candidateGit(f.root, [
    "commit-tree",
    `${f.base}^{tree}`,
    "-p",
    f.base,
    "-p",
    candidateCommit,
    "-m",
    "wrong content",
  ]);
  candidateGit(f.root, [
    "update-ref",
    "refs/heads/main",
    fake,
    resumed.mergeCommit,
  ]);
  const denied = mergeWorkspaceCandidate(f.capability, input, target);
  assert.equal(denied.reason, "commit_merge_tree_mismatch");
  assert.equal(candidateGit(f.root, ["rev-parse", "HEAD"]), fake);
});

/**
 * 一時index回収の失敗を同じ参照で再入場する。
 * @responsibility Ref既存を一時物清掃成功へ代用しない。
 * @trace RFD-IT-029
 * @precondition 新品Workspaceと選択済みfile。
 * @stimulus 自己生成indexの削除だけを拒否する。
 * @observation 元Commit・一時実体・兄弟fileと清掃後不存在。
 * @oracle 失敗中は同参照を保持し回復時に同OIDで完了。
 * @cleanup 差替え復元後にfixtureだけを回収。
 * @boundary 実Git、清掃失敗だけ有限代役。
 */
test("Candidate一時indexの回収失敗は同参照を保持し既存Refでも再確認する", (t) => {
  const f = candidateFixture(t);
  const id = randomUUID();
  createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "selected\n");
  const input = candidateInput(f, id);
  const sibling = path.join(path.dirname(f.target(id)), "unrelated.txt");
  fs.writeFileSync(sibling, "untouched");
  const remove = fs.rmSync;
  Reflect.set(fs, "rmSync", ((target, options) => {
    if (String(target).includes("candidate-index-"))
      throw new Error("synthetic");
    return remove(target, options);
  }) as typeof fs.rmSync);
  let first: WorkspaceCandidateResult;
  try {
    first = freezeWorkspaceCandidate(f.capability, input);
    assert.equal(first.status, "blocked");
    assert.equal(first.cleanupConfirmed, false);
    assert.ok(first.temporary);
    const retry = freezeWorkspaceCandidate(
      f.capability,
      input,
      first.candidateCommit,
      first.temporary,
    );
    assert.equal(retry.status, "blocked");
    assert.equal(retry.cleanupConfirmed, false);
    assert.deepEqual(retry.temporary, first.temporary);
  } finally {
    Reflect.set(fs, "rmSync", remove);
  }
  const recovered = freezeWorkspaceCandidate(
    f.capability,
    input,
    first.candidateCommit,
    first.temporary,
  );
  assert.equal(recovered.status, "completed", JSON.stringify(recovered));
  assert.equal(recovered.candidateCommit, first.candidateCommit);
  assert.equal(recovered.temporary, null);
  assert.equal(
    fs.existsSync(path.join(f.root, first.temporary.relativePath)),
    false,
  );
  assert.equal(fs.readFileSync(sibling, "utf8"), "untouched");
});

/**
 * 一時領域作成直後の実体欠測も清掃済みにしない。
 * @responsibility 作成成功と観測成功を区別する。
 * @trace RFD-IT-029
 * @precondition 新品Workspaceと確認済み選択。
 * @stimulus mkdtemp実成功後のlstatだけ拒否。
 * @observation 元Path・identity不明・通常indexと兄弟内容。
 * @oracle 未確認参照を保持し再入場も自動削除しない。
 * @cleanup 差替えを戻し自己生成fixtureだけを回収。
 * @boundary 実GitとFilesystem、観測故障だけ有限代役。
 */
test("Candidate一時領域の作成直後欠測はPathと清掃未確認を保持する", (t) => {
  const f = candidateFixture(t);
  const id = randomUUID();
  createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "candidate\n");
  const input = candidateInput(f, id);
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  const inspect = fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", {
    value: ((...args: Parameters<typeof fs.lstatSync>) => {
      if (path.basename(String(args[0])).startsWith("candidate-index-"))
        throw Object.assign(new Error("synthetic"), { code: "EACCES" });
      return Reflect.apply(inspect, fs, args);
    }) as typeof fs.lstatSync,
  });
  let failed: WorkspaceCandidateResult;
  try {
    failed = freezeWorkspaceCandidate(f.capability, input);
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: inspect });
  }
  assert.equal(failed.status, "blocked");
  assert.equal(failed.cleanupConfirmed, false);
  assert.ok(failed.temporary);
  assert.equal(failed.temporary.identity, null);
  assert.equal(
    fs.existsSync(path.join(f.root, failed.temporary.relativePath)),
    true,
  );
  const retry = freezeWorkspaceCandidate(
    f.capability,
    input,
    null,
    failed.temporary,
  );
  assert.equal(retry.status, "blocked");
  assert.equal(retry.cleanupConfirmed, false);
  assert.deepEqual(retry.temporary, failed.temporary);
  assert.deepEqual(fs.readFileSync(path.join(f.root, ".git", "index")), index);
});

/**
 * 候補固定が過去Commit・通常index・未選択変更を混入させない。
 * @responsibility Base単一親・選択Tree・同操作再入場を反証する。
 * @trace RFD-IT-029
 * @precondition 未選択の過去CommitとStageを持つWorkspace。
 * @stimulus 一fileだけの明示固定と同要求再送。
 * @observation 両HEAD、index bytes、固定TreeとRef。
 * @oracle 選択内容だけで固定し元OIDを再利用する。
 * @cleanup fixtureのafter。
 * @boundary 実Git、合成データのみ。
 */
test("Candidateは明示Baseから選択だけを固定し通常indexと過去Commitを混入しない", (t) => {
  const f = candidateFixture(t);
  const id = randomUUID();
  assert.equal(
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    }).status,
    "completed",
  );
  fs.writeFileSync(path.join(f.target(id), "past.txt"), "unselected history\n");
  candidateGit(f.target(id), ["add", "past.txt"]);
  candidateGit(f.target(id), ["commit", "-m", "not selected"]);
  fs.writeFileSync(path.join(f.target(id), "stage.txt"), "unselected staged\n");
  candidateGit(f.target(id), ["add", "stage.txt"]);
  fs.writeFileSync(
    path.join(f.target(id), "source.txt"),
    Buffer.from([0, 255, 13, 10, 1]),
  );
  const request = candidateInput(f, id);
  const index = candidateGit(f.target(id), [
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "index",
  ]);
  const bytes = fs.readFileSync(index);
  const fixed = freezeWorkspaceCandidate(f.capability, request);
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  assert.ok(fixed.candidateCommit);
  assert.equal(
    candidateGit(f.root, [
      "rev-list",
      "--parents",
      "-n",
      "1",
      fixed.candidateCommit,
    ]),
    `${fixed.candidateCommit} ${f.base}`,
  );
  assert.deepEqual(fixed.changedPaths, ["source.txt"]);
  assert.equal(
    candidateGit(f.root, [
      "ls-tree",
      "--name-only",
      fixed.candidateCommit,
    ]).includes("past.txt"),
    false,
  );
  assert.deepEqual(fs.readFileSync(index), bytes);
  assert.equal(
    candidateGit(f.target(id), ["rev-parse", "HEAD"]),
    request.expectedWorkspaceHead,
  );
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "later task\n");
  assert.equal(
    freezeWorkspaceCandidate(f.capability, request).candidateCommit,
    fixed.candidateCommit,
  );
  assert.equal(
    removeWorkspaceCandidate(f.capability, request, fixed.candidateCommit)
      .status,
    "completed",
  );
  assert.equal(
    removeWorkspaceCandidate(f.capability, request, fixed.candidateCommit)
      .reason,
    "candidate_ref_absent",
  );
  assert.equal(
    getWorktree(f.capability, workspaceWorktreeTarget(id)).status,
    "completed",
  );
});

/**
 * 固定前の内容変更・不正選択・明示削除を確認する。
 * @responsibility 誤った候補Refを作らない。
 * @trace RFD-IT-029
 * @precondition 同BaseのWorkspace。
 * @stimulus 不一致内容、管理Path、改行名、明示不存在。
 * @observation 理由、Ref集合、固定Tree。
 * @oracle 不正は拒否、明示削除だけがTreeへ入る。
 * @cleanup fixtureのafter。
 * @boundary 実Git。
 */
test("固定は内容変更・管理Path・不正名を拒否し削除は明示入力に限定する", (t) => {
  const f = candidateFixture(t);
  const id = randomUUID();
  createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  const input = candidateInput(f, id);
  fs.writeFileSync(
    path.join(f.target(id), "source.txt"),
    "changed after confirmation\n",
  );
  assert.equal(
    freezeWorkspaceCandidate(f.capability, input).reason,
    "commit_create_content_changed",
  );
  const command = {
    operation: "freeze",
    projectId: "project",
    queueId: "queue",
    workspaceId: input.workspaceId,
    expectedGeneration: 1,
    operationId: input.operationId,
    baseCommit: input.baseCommit,
    expectedHead: input.expectedWorkspaceHead,
    selection: input.selection,
    candidateName: input.candidateName,
    relatedChangeIds: input.relatedChangeIds,
  };
  assert.equal(
    inspectWorkspaceCommand({ ...command, candidateName: "line\nbreak" }),
    null,
  );
  assert.equal(
    inspectWorkspaceCommand({
      ...command,
      selection: [{ path: ".git/config", blobId: null, mode: null }],
    }),
    null,
  );
  fs.unlinkSync(path.join(f.target(id), "source.txt"));
  const deleted = freezeWorkspaceCandidate(f.capability, {
    ...input,
    selection: [{ path: "source.txt", blobId: null, mode: null }],
  });
  assert.equal(deleted.status, "completed", JSON.stringify(deleted));
  assert.ok(deleted.candidateCommit);
  assert.equal(
    candidateGit(f.root, [
      "ls-tree",
      "--name-only",
      deleted.candidateCommit,
    ]).includes("source.txt"),
    false,
  );
  assert.deepEqual(fs.readdirSync(path.dirname(f.target(id))), ["worktree"]);
});

import { inspectWorkspaceCommand } from "../../src/service/workspace.ts";

/**
 * FF可能時も二親Mergeを残し、再入場と独立Ref回収を確認する。
 * @responsibility 名前snapshot・非衝突dirty保全・二重Merge拒否。
 * @trace RFD-IT-029
 * @precondition Base先端と固定候補、別fileの人間dirty。
 * @stimulus 明示Merge、同操作再入場、候補Ref回収。
 * @observation 親順序、Message、元dirty、他Branch。
 * @oracle 二親完全一致、名前保持、新Merge追加0。
 * @cleanup fixtureのafter。
 * @boundary 実Git、採否は試験側で明示。
 */
test("FF可能でも二親Mergeし名前を記録、dirty保全して二重取込しない", (t) => {
  const f = candidateFixture(t);
  const id = randomUUID();
  createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "selected\n");
  const input = candidateInput(f, id);
  const fixed = freezeWorkspaceCandidate(f.capability, input);
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  assert.ok(fixed.candidateCommit);
  fs.appendFileSync(path.join(f.root, ".gitignore"), "human-dirty\n");
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  const target = {
    candidateCommit: fixed.candidateCommit,
    targetBranch: "main",
    expectedTargetHead: f.base,
  };
  const merged = mergeWorkspaceCandidate(f.capability, input, target);
  assert.equal(merged.status, "completed", JSON.stringify(merged));
  assert.ok(merged.mergeCommit);
  assert.equal(
    candidateGit(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
    `${merged.mergeCommit} ${f.base} ${fixed.candidateCommit}`,
  );
  const message = candidateGit(f.root, ["log", "-1", "--format=%B"]);
  assert.ok(message.includes("Merge Candidate: 選択した改善"));
  assert.ok(message.includes("Workspace: 継続作業"));
  assert.ok(message.includes(`Workspace-ID: ${id}`));
  assert.ok(
    fs
      .readFileSync(path.join(f.root, ".gitignore"), "utf8")
      .endsWith("human-dirty\n"),
  );
  assert.equal(
    mergeWorkspaceCandidate(f.capability, input, target).reason,
    "commit_merge_existing_confirmed",
  );
  assert.equal(
    mergeWorkspaceCandidate(f.capability, input, {
      ...target,
      expectedTargetHead: merged.mergeCommit,
    }).reason,
    "commit_merge_already_integrated",
  );
  assert.notDeepEqual(
    fs.readFileSync(path.join(f.root, ".git", "index")),
    index,
  );
  assert.equal(
    removeWorkspaceCandidate(f.capability, input, fixed.candidateCommit).status,
    "completed",
  );
  assert.equal(fs.existsSync(f.target(id)), true);
  assert.equal(candidateGit(f.root, ["rev-parse", "HEAD"]), merged.mergeCommit);
});

/**
 * 分岐Mergeと競合拒否、Ref改変時の削除0を確認する。
 * @responsibility 非正常条件を通常成功へ畳まない。
 * @trace RFD-IT-029
 * @precondition それぞれ新品の分岐fixture。
 * @stimulus 独立変更又は同file衝突、Ref差替え。
 * @observation Merge結果、元HEAD／index、候補Ref。
 * @oracle 分岐正常は二親、衝突は共有Tree不変、Ref差は削除0。
 * @cleanup fixtureのafter。
 * @boundary 実Gitのみ。
 */
test("分岐の通常MergeとConflict停止、Ref変更拒否を確認する", (t) => {
  for (const conflict of [false, true]) {
    const f = candidateFixture(t);
    const id = randomUUID();
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    });
    fs.writeFileSync(path.join(f.target(id), "source.txt"), "candidate\n");
    const input = candidateInput(f, id);
    const fixed = freezeWorkspaceCandidate(f.capability, input);
    assert.ok(fixed.candidateCommit, JSON.stringify(fixed));
    assert.ok(fixed.candidateRef);
    fs.writeFileSync(
      path.join(f.root, conflict ? "source.txt" : "human.txt"),
      "target\n",
    );
    candidateGit(f.root, ["add", conflict ? "source.txt" : "human.txt"]);
    candidateGit(f.root, ["commit", "-m", "target branch"]);
    const head = candidateGit(f.root, ["rev-parse", "HEAD"]);
    const beforeIndex = fs.readFileSync(path.join(f.root, ".git", "index"));
    const merged = mergeWorkspaceCandidate(f.capability, input, {
      candidateCommit: fixed.candidateCommit,
      targetBranch: "main",
      expectedTargetHead: head,
    });
    if (conflict) {
      assert.equal(merged.reason, "commit_merge_conflict");
      assert.equal(candidateGit(f.root, ["rev-parse", "HEAD"]), head);
      assert.deepEqual(
        fs.readFileSync(path.join(f.root, ".git", "index")),
        beforeIndex,
      );
    } else {
      assert.equal(merged.status, "completed", JSON.stringify(merged));
      assert.equal(
        candidateGit(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
        `${merged.mergeCommit} ${head} ${fixed.candidateCommit}`,
      );
    }
    candidateGit(f.root, ["update-ref", fixed.candidateRef, head]);
    assert.equal(
      removeWorkspaceCandidate(f.capability, input, fixed.candidateCommit)
        .reason,
      "candidate_ref_mismatch",
    );
    assert.equal(candidateGit(f.root, ["rev-parse", fixed.candidateRef]), head);
  }
});
