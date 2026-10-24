/**
 * coordinator:integration:repository-workspace-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:repository-workspace-runtimeが所有する検証責務を実行する。
 * @trace RFD-IT-013
 * @trace PRL-IT-013
 * @level IT
 * @scope repository、workspace、runtime
 * @boundary RFD-IT-013=Direct Boundary: Session Grant→Workspace→Repository Exposure
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { deflateSync } from "node:zlib";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  verifyOwnedOperationManagementMountBinding,
} from "../../src/execution/operation.ts";
import { bindRuntimeOwnedRepositoryOperation } from "../../src/execution/operation.ts";
import {
  captureExecutionChangeSnapshot,
  describeExecutionChangeSnapshotContract,
  bindRuntimeOwnedExecutionSnapshot as materializeReceivedTarget,
  projectReviewerReadContent,
  verifyExecutionChangeSnapshot,
  observeBorrowedExecutionChanges,
  projectBorrowedExecutionResult,
} from "../../src/execution/operation.ts";
import {
  inspectBorrowedExecutionTarget,
  readBorrowedExecutionBinding,
} from "../../src/execution/operation.ts";
import {
  createRepositoryWorktree,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { createProviderDockerRuntimeDependencies } from "../../src/execution/preparation.ts";
import { runCoordinatorSingleTaskAttempt } from "../../src/execution/controller.ts";
import {
  prepareVerificationWorkspace,
  readVerificationWorkspaceOutput,
  closeVerificationWorkspace,
} from "../../scripts/workspace-task-fixture.ts";

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
  git(["init", "--initial-branch=main", "--template="]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n");
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  git(["add", "source.txt", ".gitignore"]);
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
 * @stimulus 二Taskで同Treeを編集し、capture／verify後に一時物だけ回収する。
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
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const uuid = randomUUID();
  assert.equal(
    createRepositoryWorktree(verified.capability, {
      workspaceId: uuid,
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
    }
    let receivedTarget: unknown;
    const adapted = await runCoordinatorSingleTaskAttempt(
      {
        startTask: (_request, owner, _id, _observer, selected) => {
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
        workspaceId,
        ownerRepositoryRoot: root,
        executionTree: tree,
        workspaceBaseCommit: target.baseCommit,
        workspaceHead: target.head,
        cancellationSignal: new AbortController().signal,
      },
    );
    assert.equal(adapted.status, "completed");
    assert.deepEqual(receivedTarget, target);
    const internal = path.join(tree, ".crdd");
    fs.mkdirSync(internal, { recursive: true });
    fs.writeFileSync(path.join(internal, "state.json"), "not an input\n");
    fs.writeFileSync(path.join(tree, ".env"), "synthetic-development-value\n");
    const gitFile = workspaceId
      ? path.join(tree, ".git")
      : path.join(tree, ".git", "HEAD");
    const beforeGit = fs.readFileSync(gitFile);
    for (let turn = 0; turn < 2; turn++) {
      const current = operation(t, root, false);
      try {
        const borrowed = bindRuntimeOwnedExecutionSnapshot(
          current.bound.repositoryBindingCapability,
          current.managementCapability,
          current.mountCapability,
          ["source.txt"],
          target,
        );
        assert.ok(borrowed?.status === "materialized");
        if (borrowed?.status !== "materialized") return;
        assert.deepEqual(
          observeBorrowedExecutionChanges(borrowed.workspaceCapability),
          [],
        );
        const deliver = async (
          capability: object | undefined,
          failed = false,
        ) => {
          const observation = projectBorrowedExecutionResult(
            capability,
            target,
          );
          const delivered = await runCoordinatorSingleTaskAttempt(
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
              workspaceId,
              ownerRepositoryRoot: root,
              executionTree: tree,
              workspaceBaseCommit: target.baseCommit,
              workspaceHead: target.head,
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
        assert.deepEqual(
          (await deliver(borrowed.workspaceCapability)).changedPaths,
          [],
        );
        assert.equal((await deliver(undefined)).changedPaths, null);
        assert.equal(
          readBorrowedExecutionBinding(current.managementCapability)?.target
            .executionTree,
          tree,
        );
        const providerBinding =
          createProviderDockerRuntimeDependencies().verifyOperationMount(
            current.managementCapability,
            current.mountCapability,
          );
        assert.equal(providerBinding.mounts.workspace, tree);
        assert.ok("workspaceProtection" in providerBinding);
        fs.writeFileSync(path.join(tree, "source.txt"), `turn-${turn}\n`);
        fs.writeFileSync(path.join(internal, "state.json"), `state-${turn}\n`);
        const captured = captureExecutionChangeSnapshot(
          borrowed.workspaceCapability,
          current.bound.repositoryBindingCapability,
          current.managementCapability,
          current.mountCapability,
          ["source.txt"],
        );
        assert.ok(captured?.status === "candidate");
        if (captured?.status !== "candidate") return;
        assert.deepEqual(captured.changedPaths, ["source.txt"]);
        const delivered = await deliver(borrowed.workspaceCapability);
        assert.deepEqual(delivered.changedPaths, ["source.txt"]);
        assert.equal(
          delivered.canonicalRepositoryChanged,
          workspaceId === null,
        );
        assert.equal(
          verifyExecutionChangeSnapshot(
            captured.candidateCapability,
            current.bound.repositoryBindingCapability,
            current.managementCapability,
            current.mountCapability,
          )?.status,
          "verified",
        );
        if (workspaceId === null && turn === 0) {
          for (let index = 0; index < 999; index++)
            fs.writeFileSync(
              path.join(tree, `limit-${index}.txt`),
              "synthetic",
            );
          assert.equal(
            (await deliver(borrowed.workspaceCapability)).changedPaths?.length,
            1000,
          );
          fs.writeFileSync(path.join(tree, "limit-999.txt"), "synthetic");
          assert.equal(
            (await deliver(borrowed.workspaceCapability, true)).changedPaths,
            null,
          );
          for (let index = 0; index < 1000; index++)
            fs.unlinkSync(path.join(tree, `limit-${index}.txt`));
        }
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
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
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
    Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
  );
  fs.writeFileSync(
    path.join(commonDirectory, "refs", "heads", "main"),
    `${commitId}\n`,
  );
  t.after(() => {
    const currentIdentity = fs.lstatSync(root, { bigint: true });
    assert.equal(currentIdentity.isDirectory(), true);
    assert.equal(currentIdentity.isSymbolicLink(), false);
    assert.equal(currentIdentity.dev, rootIdentity.dev);
    assert.equal(currentIdentity.ino, rootIdentity.ino);
    assert.equal(currentIdentity.birthtimeNs, rootIdentity.birthtimeNs);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return Object.freeze({ root, commonDirectory, commitId });
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
        fs.lstatSync(path.join(root, relativePath)).isFile(),
    )
    .map((relativePath) => ({
      relativePath,
      sha256: createHash("sha256")
        .update(fs.readFileSync(path.join(root, relativePath)))
        .digest("hex"),
    }));
}

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
function bindRuntimeOwnedExecutionSnapshot(
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
  t: TestContext,
  repositoryRoot: string,
  automaticCleanup = true,
) {
  const owned = createOwnedOperationDirectories();
  if (automaticCleanup) t.after(() => cleanupOwnedOperationDirectories(owned));
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const bound = bindRuntimeOwnedRepositoryOperation(
    managementCapability,
    repositoryRoot,
  );
  assert.ok(bound);
  let workspace = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  ).mounts.workspace;
  if (automaticCleanup) {
    const root = verifyRepositoryRoot(repositoryRoot);
    assert.equal(root.status, "completed");
    if (root.status !== "completed") throw new Error("fixture_root_missing");
    const workspaceId = randomUUID();
    const base = fs
      .readFileSync(path.join(repositoryRoot, ".git/refs/heads/main"), "utf8")
      .trim();
    const created = createRepositoryWorktree(root.capability, {
      workspaceId,
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

// Only inventory observations inside this owned workspace are virtualized.
// Real descriptors retain bounded ownership; bytes, size and identity agree.
/**
 * virtualInventoryのTest準備責務を実行する。
 *
 * @responsibility virtualInventoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus virtualInventoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function virtualInventory(
  t: TestContext,
  workspace: string,
  fileSizes: readonly number[],
) {
  const backingPath = path.join(workspace, "inventory-backing.bin");
  fs.writeFileSync(backingPath, "a");
  const originals = {
    readdir: fs.readdirSync,
    lstat: fs.lstatSync,
    open: fs.openSync,
    fstat: fs.fstatSync,
    read: fs.readSync,
    close: fs.closeSync,
  };
  const dirent = originals
    .readdir(workspace, { withFileTypes: true })
    .find((entry) => entry.name === "inventory-backing.bin");
  assert.ok(dirent);
  const metadata = originals.lstat(backingPath, { bigint: true });
  const virtualFiles = new Map(
    fileSizes.map((byteLength, index) => [
      path.join(workspace, `file-${index}.bin`),
      { byteLength, index },
    ]),
  );
  const descriptors = new Map<number, { byteLength: number; index: number }>();
  const openedIndices: number[] = [];
  let readByteCount = 0;
  /**
   * fileMetadataのTest準備責務を実行する。
   *
   * @responsibility fileMetadataがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RFD-IT-013
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus fileMetadataを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  const fileMetadata = (file: { byteLength: number; index: number }) =>
    Object.assign(Object.create(Object.getPrototypeOf(metadata)), metadata, {
      size: BigInt(file.byteLength),
      ino: metadata.ino + BigInt(file.index + 1),
    });
  t.mock.method(fs, "readdirSync", ((target, options) => {
    if (target === workspace) {
      assert.deepEqual(options, { withFileTypes: true });
      return fileSizes.map((_byteLength, index) =>
        Object.assign(Object.create(Object.getPrototypeOf(dirent)), dirent, {
          name: `file-${index}.bin`,
        }),
      );
    }
    return Reflect.apply(originals.readdir, fs, [target, options]);
  }) as typeof fs.readdirSync);
  t.mock.method(fs, "lstatSync", ((target, options) => {
    const file =
      typeof target === "string" ? virtualFiles.get(target) : undefined;
    if (!file) return originals.lstat(target, options);
    const value = fileMetadata(file);
    if (
      !options ||
      typeof options !== "object" ||
      !("bigint" in options) ||
      !options.bigint
    )
      value.nlink = 1;
    return value;
  }) as typeof fs.lstatSync);
  t.mock.method(fs, "openSync", ((target, flags, mode) => {
    const file =
      typeof target === "string" ? virtualFiles.get(target) : undefined;
    if (!file) return originals.open(target, flags, mode);
    assert.equal(flags, "r");
    const descriptor = originals.open(backingPath, flags, mode);
    descriptors.set(descriptor, file);
    openedIndices.push(file.index);
    return descriptor;
  }) as typeof fs.openSync);
  t.mock.method(fs, "fstatSync", ((descriptor, options) => {
    const file = descriptors.get(descriptor);
    return file ? fileMetadata(file) : originals.fstat(descriptor, options);
  }) as typeof fs.fstatSync);
  t.mock.method(fs, "readSync", ((
    descriptor,
    buffer,
    offset,
    length,
    position,
  ) => {
    const file = descriptors.get(descriptor);
    if (!file)
      return originals.read(descriptor, buffer, offset, length, position);
    assert.equal(typeof position, "number");
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(typeof offset, "number");
    assert.equal(typeof length, "number");
    const count = Math.min(length, file.byteLength - Number(position));
    buffer.fill(0x61, offset, offset + count);
    readByteCount += count;
    return count;
  }) as typeof fs.readSync);
  t.mock.method(fs, "closeSync", (descriptor: number) => {
    descriptors.delete(descriptor);
    originals.close(descriptor);
  });
  return {
    openedIndices,
    descriptors,
    readByteCount: () => readByteCount,
  };
}

/**
 * 変更path上限1000件を受理し1001件は候補を発行しないを検証する。
 *
 * @responsibility 変更path上限1000件を受理し1001件は候補を発行しないの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 変更path上限1000件を受理し1001件は候補を発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("変更path上限1000件を受理し1001件は候補を発行しない", (t) => {
  const source = repository(t);
  const runtime = operation(t, source.root);
  const beforeFiles = snapshotRepositoryFiles(source.root);
  const materialized = bindRuntimeOwnedExecutionSnapshot(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(materialized?.status, "materialized");
  for (let index = 0; index < 1000; index += 1) {
    fs.writeFileSync(
      path.join(runtime.workspace, "src", `added-${index}.txt`),
      "a",
    );
  }
  /**
   * captureのTest準備責務を実行する。
   *
   * @responsibility captureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RFD-IT-013
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus captureを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  const capture = () =>
    captureExecutionChangeSnapshot(
      materialized?.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      ["src/"],
    );
  const boundary = capture();
  assert.equal(boundary?.status, "candidate");
  assert.equal(
    boundary?.status === "candidate" ? boundary.changedPaths.length : null,
    1000,
  );
  fs.writeFileSync(path.join(runtime.workspace, "src", "overflow.txt"), "a");
  assert.equal(capture(), null);
  assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
});

for (const scenario of ["file_count", "total_bytes"] as const) {
  /**
   * workspace ${scenario}の境界到達と超過停止を後段guardから区別するを検証する。
   *
   * @responsibility workspace ${scenario}の境界到達と超過停止を後段guardから区別するの合否判定を所有する。
   * @trace RFD-IT-013
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus workspace ${scenario}の境界到達と超過停止を後段guardから区別するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`workspace ${scenario}の境界到達と超過停止を後段guardから区別する`, (t) => {
    const source = repository(t);
    const runtime = operation(t, source.root);
    const beforeFiles = snapshotRepositoryFiles(source.root);
    const materialized = bindRuntimeOwnedExecutionSnapshot(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    for (const isOverflow of [false, true]) {
      const fileSizes =
        scenario === "file_count"
          ? Array.from({ length: isOverflow ? 20_002 : 20_000 }, () => 1)
          : [
              64 * 1024 * 1024,
              64 * 1024 * 1024,
              64 * 1024 * 1024,
              64 * 1024 * 1024,
              isOverflow ? 1 : 0,
              0,
            ];
      const observed = virtualInventory(t, runtime.workspace, fileSizes);
      try {
        const candidate = captureExecutionChangeSnapshot(
          materialized?.workspaceCapability,
          runtime.bound.repositoryBindingCapability,
          runtime.managementCapability,
          runtime.mountCapability,
          ["src/"],
        );
        // Boundary control completes inventory, then fails changed-path count
        // or allowed-path scope. Overflow must stop before its final sentinel.
        if (scenario === "file_count" || isOverflow)
          assert.equal(candidate, null);
        else assert.equal(candidate?.status, "candidate");
        const expectedCount =
          scenario === "file_count"
            ? isOverflow
              ? 20_001
              : 20_000
            : isOverflow
              ? 5
              : 6;
        assert.deepEqual(
          observed.openedIndices,
          Array.from({ length: expectedCount }, (_value, index) => index),
        );
        assert.equal(observed.descriptors.size, 0);
        assert.equal(
          observed.readByteCount(),
          scenario === "file_count"
            ? expectedCount
            : 256 * 1024 * 1024 + (isOverflow ? 1 : 0),
        );
      } finally {
        t.mock.restoreAll();
      }
    }
    assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
  });
}

/**
 * HEAD Treeから隔離workspaceを作り許可pathだけをCandidate Revisionへ固定するを検証する。
 *
 * @responsibility HEAD Treeから隔離workspaceを作り許可pathだけをCandidate Revisionへ固定するの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HEAD Treeから隔離workspaceを作り許可pathだけをCandidate Revisionへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("HEAD Treeから隔離workspaceを作り許可pathだけをCandidate Revisionへ固定する", (t) => {
  const source = repository(t);
  const runtime = operation(t, source.root);
  const materialized = bindRuntimeOwnedExecutionSnapshot(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(materialized?.status, "materialized");
  assert.equal(materialized?.baseCommit, source.commitId);
  assert.equal(materialized?.fileCount, 2);
  assert.equal(
    fs.lstatSync(path.join(runtime.workspace, ".git")).isFile(),
    true,
  );

  fs.writeFileSync(
    path.join(runtime.workspace, "src", "index.ts"),
    "export const value = 2;\n",
  );
  const candidate = captureExecutionChangeSnapshot(
    materialized?.workspaceCapability,
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
    ["src/"],
  );
  assert.equal(candidate?.status, "candidate");
  assert.deepEqual(candidate?.changedPaths, ["src/index.ts"]);
  assert.equal(candidate?.baseCommit, source.commitId);
  assert.equal(candidate?.canonicalRepositoryChanged, false);
  assert.equal(fs.existsSync(path.join(source.root, "src", "index.ts")), false);
  const verified = verifyExecutionChangeSnapshot(
    candidate?.candidateCapability,
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(verified?.status, "verified");
  assert.equal(verified?.patchHash, candidate?.patchHash);
});

/**
 * 許可外変更、重複allowed path、Revision変化とCandidate後差替えを拒否するを検証する。
 *
 * @responsibility 許可外変更、重複allowed path、Revision変化とCandidate後差替えを拒否するの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 許可外変更、重複allowed path、Revision変化とCandidate後差替えを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("対象外変更を観測し、重複allowed path・Revision変化・内容差替えを拒否する", (t) => {
  const source = repository(t);
  const first = operation(t, source.root);
  const firstWorkspace = bindRuntimeOwnedExecutionSnapshot(
    first.bound.repositoryBindingCapability,
    first.managementCapability,
    first.mountCapability,
  );
  if (firstWorkspace?.status !== "materialized") {
    assert.fail("first workspace must materialize");
  }
  fs.writeFileSync(path.join(first.workspace, "README.md"), "changed\n");
  const outside = captureExecutionChangeSnapshot(
    firstWorkspace.workspaceCapability,
    first.bound.repositoryBindingCapability,
    first.managementCapability,
    first.mountCapability,
    ["src/"],
  );
  assert.equal(outside?.status, "candidate");
  assert.deepEqual(
    outside?.status === "candidate" ? outside.changedPaths : null,
    ["README.md"],
  );
  assert.equal(
    captureExecutionChangeSnapshot(
      firstWorkspace.workspaceCapability,
      first.bound.repositoryBindingCapability,
      first.managementCapability,
      first.mountCapability,
      ["README.md", "README.md"],
    ),
    null,
  );

  const secondSource = repository(t);
  const second = operation(t, secondSource.root);
  const secondWorkspace = bindRuntimeOwnedExecutionSnapshot(
    second.bound.repositoryBindingCapability,
    second.managementCapability,
    second.mountCapability,
  );
  if (secondWorkspace?.status !== "materialized") {
    assert.fail("second workspace must materialize");
  }
  fs.writeFileSync(path.join(second.workspace, "README.md"), "changed\n");
  fs.writeFileSync(
    path.join(secondSource.commonDirectory, "refs", "heads", "main"),
    `${"f".repeat(40)}\n`,
  );
  assert.equal(
    captureExecutionChangeSnapshot(
      secondWorkspace.workspaceCapability,
      second.bound.repositoryBindingCapability,
      second.managementCapability,
      second.mountCapability,
      ["README.md"],
    ),
    null,
  );

  const thirdSource = repository(t);
  const third = operation(t, thirdSource.root);
  const thirdWorkspace = bindRuntimeOwnedExecutionSnapshot(
    third.bound.repositoryBindingCapability,
    third.managementCapability,
    third.mountCapability,
  );
  if (thirdWorkspace?.status !== "materialized") {
    assert.fail("third workspace must materialize");
  }
  fs.writeFileSync(path.join(third.workspace, "README.md"), "changed\n");
  const candidate = captureExecutionChangeSnapshot(
    thirdWorkspace.workspaceCapability,
    third.bound.repositoryBindingCapability,
    third.managementCapability,
    third.mountCapability,
    ["README.md"],
  );
  if (candidate?.status !== "candidate") {
    assert.fail("candidate must be captured");
  }
  fs.writeFileSync(path.join(third.workspace, "README.md"), "replaced\n");
  assert.equal(
    verifyExecutionChangeSnapshot(
      candidate.candidateCapability,
      third.bound.repositoryBindingCapability,
      third.managementCapability,
      third.mountCapability,
    ),
    null,
  );
});

for (const [scenario, label] of [
  ["depth", "深さ上限超過"],
  ["file_size", "単一file容量超過"],
  ["junction", "junction entry"],
] as const) {
  /**
   * 実行後workspaceの${label}をCandidateへ昇格せず元Repositoryを保持するを検証する。
   *
   * @responsibility 実行後workspaceの${label}をCandidateへ昇格せず元Repositoryを保持するの合否判定を所有する。
   * @trace RFD-IT-013
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 実行後workspaceの${label}をCandidateへ昇格せず元Repositoryを保持するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`実行後workspaceの${label}をCandidateへ昇格せず元Repositoryを保持する`, (t) => {
    if (scenario === "junction" && process.platform !== "win32") {
      t.skip("Windows junction boundary only");
      return;
    }
    const source = repository(t);
    const runtime = operation(t, source.root);
    const beforeFiles = snapshotRepositoryFiles(source.root);
    const materialized = bindRuntimeOwnedExecutionSnapshot(
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
        for (let depth = 0; depth < 65; depth += 1) {
          directory = path.join(directory, "d");
          fs.mkdirSync(directory);
        }
      } else if (scenario === "file_size") {
        const oversizedFile = path.join(runtime.workspace, "src", "large.bin");
        const descriptor = fs.openSync(oversizedFile, "wx");
        try {
          fs.ftruncateSync(descriptor, 64 * 1024 * 1024 + 1);
        } finally {
          fs.closeSync(descriptor);
        }
        assert.equal(fs.statSync(oversizedFile).size, 64 * 1024 * 1024 + 1);
      } else {
        const target = path.join(runtime.workspace, "src");
        fs.symlinkSync(target, linkPath, "junction");
        linkCreated = true;
        assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
      }
      assert.equal(
        captureExecutionChangeSnapshot(
          materialized?.workspaceCapability,
          runtime.bound.repositoryBindingCapability,
          runtime.managementCapability,
          runtime.mountCapability,
          ["src/", "d/"],
        ),
        null,
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
  const runtime = operation(t, source.root);
  assert.equal(
    bindRuntimeOwnedExecutionSnapshot(
      {},
      runtime.managementCapability,
      runtime.mountCapability,
    ),
    null,
  );
  const materialized = bindRuntimeOwnedExecutionSnapshot(
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
    captureExecutionChangeSnapshot(
      materialized.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      dynamicAllowedPaths,
    ),
    null,
  );
});

/**
 * Executorが生成した認識済みSecretをCandidate Capabilityへ昇格しないを検証する。
 *
 * @responsibility Executorが生成した認識済みSecretをCandidate Capabilityへ昇格しないの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Executorが生成した認識済みSecretをCandidate Capabilityへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("開発用情報を借用Treeで許容しReviewerへの認識済みSecret投影は拒否する", (t) => {
  for (const scenario of ["path", "nested-path", "content"] as const) {
    const source = repository(t);
    const runtime = operation(t, source.root);
    const materialized = bindRuntimeOwnedExecutionSnapshot(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    if (scenario === "path") {
      fs.writeFileSync(path.join(runtime.workspace, ".env"), "ordinary\n");
    } else if (scenario === "nested-path") {
      fs.writeFileSync(
        path.join(
          runtime.workspace,
          "src",
          "session_token=abcdefghijklmnopqrstuvwx",
        ),
        "ordinary\n",
      );
    } else {
      fs.writeFileSync(
        path.join(runtime.workspace, "src", "index.ts"),
        `const token = "sk-${"A".repeat(24)}";\n`,
      );
    }
    const captured = captureExecutionChangeSnapshot(
      materialized?.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      [
        scenario === "path"
          ? ".env"
          : scenario === "nested-path"
            ? "src/session_token=abcdefghijklmnopqrstuvwx"
            : "src/index.ts",
      ],
    );
    assert.equal(captured?.status, "candidate");
    if (captured?.status !== "candidate")
      throw new Error("fixture_capture_failed");
    const projection = projectReviewerReadContent(
      materialized?.workspaceCapability,
      captured.candidateCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      [
        scenario === "path"
          ? ".env"
          : scenario === "nested-path"
            ? "src/session_token=abcdefghijklmnopqrstuvwx"
            : "src/index.ts",
      ],
    );
    assert.equal(projection?.status, "blocked");
    assert.equal(
      projection?.status === "blocked" ? projection.reason : null,
      "candidate_read_projection_recognized_secret_rejected",
    );
  }
});

/**
 * 公開契約は隔離workspaceと5要素Candidate Revisionを固定するを検証する。
 *
 * @responsibility 公開契約は隔離workspaceと5要素Candidate Revisionを固定するの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は隔離workspaceと5要素Candidate Revisionを固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約は隔離workspaceと5要素Candidate Revisionを固定する", () => {
  const contract = describeExecutionChangeSnapshotContract();
  assert.equal(contract.contractRevision, 7);
  assert.equal(contract.providerGitMetadataVisible, false);
  assert.equal(contract.workspaceWrite, "caller_resolved_execution_tree");
  assert.deepEqual(contract.candidateRevision, [
    "base_commit",
    "base_tree",
    "patch_hash",
    "content_manifest_hash",
    "allowed_paths_hash",
  ]);
  assert.equal(contract.canonicalRepositoryWriteAllowed, true);
  assert.equal(
    contract.allowedPathGuard,
    "post_execution_scope_observation_not_write_acl",
  );
  assert.match(contract.recognizedSecretMaterial, /rejected/u);
  assert.equal(contract.completeSecretAbsenceVerified, false);
});

/**
 * Reviewer向け内容投影をCandidate Identityへ結合し差替えを拒否するを検証する。
 *
 * @responsibility Reviewer向け内容投影をCandidate Identityへ結合し差替えを拒否するの合否判定を所有する。
 * @trace RFD-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewer向け内容投影をCandidate Identityへ結合し差替えを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Reviewer向け内容投影をCandidate Identityへ結合し差替えを拒否する", (t) => {
  const source = repository(t);
  const runtime = operation(t, source.root);
  const materialized = bindRuntimeOwnedExecutionSnapshot(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
    ["README.md"],
  );
  assert.equal(materialized?.status, "materialized");
  fs.writeFileSync(path.join(runtime.workspace, "README.md"), "candidate\n");
  const candidate = captureExecutionChangeSnapshot(
    materialized?.workspaceCapability,
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
    ["README.md"],
  );
  assert.equal(candidate?.status, "candidate");
  assert.ok(candidate?.status === "candidate");
  const projected = projectReviewerReadContent(
    materialized?.workspaceCapability,
    candidate.candidateCapability,
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
    ["README.md"],
  );
  assert.equal(projected?.status, "projected");
  assert.deepEqual(projected?.files, [
    {
      path: "README.md",
      state: "present",
      byteLength: 10,
      sha256: createHash("sha256").update("candidate\n").digest("hex"),
      encoding: "utf-8",
      content: "candidate\n",
    },
  ]);
  fs.writeFileSync(path.join(runtime.workspace, "README.md"), "replaced\n");
  assert.equal(
    projectReviewerReadContent(
      materialized?.workspaceCapability,
      candidate.candidateCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      ["README.md"],
    )?.status,
    "blocked",
  );
});
