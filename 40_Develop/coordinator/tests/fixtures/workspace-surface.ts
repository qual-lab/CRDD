/**
 * 公開Workspace試験の自己生成Repository・Queueと実保存観測を用意する。
 * @responsibility 実Git・Writer・既存排他と終了時清掃を一意に用意し、架空Storeを使わない。
 * @trace CPR-IT-001
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @trace RFD-IT-029
 * @level IT
 * @scope 呼出し側が生成・清掃する試験Rootのみ。
 * @boundary 外部AI・Docker・通信なし。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { devNull } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import {
  initializeExecutionStore,
  readState,
  saveProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createCoordinatorState } from "../../src/state/create.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../../src/state/transaction.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/validation.ts";
import {
  type CoordinatorWorkspaceRequest,
  manageCoordinatorWorkspace,
} from "../../src/workspace/operations.ts";
import { taskExecutionSelections } from "./ai-selection.ts";

/**
 * 既存Projectと二Queueを実保存する。
 * @responsibility 公開操作の所属・選択の前提を作る。
 * @trace CPR-IT-001
 * @precondition 自己生成Rootと固定Git Commit。
 * @stimulus 初期化、Project保存、二Queue受付。
 * @observation 各Writerの完了。
 * @oracle 保存拒否を前提成立と扱わない。
 * @cleanup 呼出し側がexact Rootを回収する。
 * @boundary 実Snapshot・Native排他。
 */
export function prepareWorkspaceSurface(
  root: string,
  projectId: string,
  base: string,
) {
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const repository = verifyRuntimePersistenceRepository(root);
  const initialized = initializeExecutionStore(repository, binding);
  assert.equal(initialized.status, "completed");
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId,
    milestoneId: "milestone-a",
    repositoryRevision: base,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["done"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["source.txt"],
        conflictKeys: ["source"],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  assert.equal(
    saveProjectExecutionState(repository, binding, created.state, 0).status,
    "completed",
  );
  const ports = createCoordinatorSnapshotPersistencePorts(
    root,
    binding,
    initialized.value,
  );
  for (const queueId of ["queue-a", "queue-b"]) {
    const result = ports.state.enqueueOperation({
      queueId,
      projectId,
      milestoneId: "milestone-a",
      requestHash: queueId === "queue-a" ? "a".repeat(64) : "c".repeat(64),
      originLane: "interactive",
      repositoryRevision: base,
      scopeHash: "b".repeat(64),
    });
    assert.equal(result.status, "completed", JSON.stringify(result));
  }
  return binding;
}

/**
 * 試験Rootの全区画を正式な回復Readerと純粋投影で観測する。
 * @responsibility 私有Readerを借用せず実保存結果を照合する。
 * @trace PRL-IT-013
 * @precondition 現在Caseの初期化済み合成Repositoryだけを渡す。
 * @stimulus 真正Rootから有限Readerを呼び同じ検証済み値を投影する。
 * @observation 世代・対象Binding・全区画の期待値。
 * @oracle 読取り拒否・Binding差を成功へ補完しない。
 * @cleanup 既存fixtureの終了hookがRootを回収する。
 * @boundary 試験の観測。保存・Lock・Authorityは発行しない。
 */
export function readFixtureSnapshot(root: string, binding: string) {
  const read = readState(verifyRuntimePersistenceRepository(root), {
    scope: "recovery",
  });
  if (read.status !== "completed" || !read.value)
    return { ...read, value: null };
  assert.ok(
    read.value.snapshot.repositoryBindingId !== null &&
      read.value.snapshot.intakeEpoch !== null,
  );
  const projected = {
    schema: "crdd-execution-model/project-snapshot/v7" as const,
    schemaRevision: 7 as const,
    repositoryRootHash: read.value.snapshot.repositoryBinding,
    repositoryBindingId: read.value.snapshot.repositoryBindingId,
    intakeEpoch: read.value.snapshot.intakeEpoch,
    snapshotRevision: read.value.snapshot.revision,
    projects: read.value.projects,
    intakeBindings: read.value.snapshot.intakeBindings,
    queueEntries: read.value.snapshot.queueEntries,
    workspaces: read.value.snapshot.workspaces,
    leaseEvidence: read.value.snapshot.leaseEvidence,
    leaseIntents: read.value.snapshot.leaseIntents,
    results: read.value.snapshot.results,
    historyPending: read.value.snapshot.historyPending,
    decisions: read.value.snapshot.decisions,
    blockers: read.value.snapshot.blockers,
  };
  assert.ok(projected);
  assert.equal(projected.repositoryBindingId, binding);
  return { ...read, value: projected };
}

const testsRoot = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
const empty = process.platform === "win32" ? "NUL" : devNull;

/**
 * 試験所有Repositoryへ固定Git操作を発行する。
 * @responsibility 本体のGitと実資格へ触れない準備。
 * @trace PRL-IT-013
 * @precondition 自己生成Root。
 * @stimulus 固定引数。
 * @observation 正常stdout。
 * @oracle 非0は試験失敗。
 * @cleanup fixtureのafter。
 * @boundary 通信なしの実Git。
 */
export function git(root: string, args: string[]) {
  return execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      `core.hooksPath=${empty}`,
      "-c",
      "commit.gpgSign=false",
      ...args,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
        ),
        GIT_CONFIG_GLOBAL: empty,
        GIT_CONFIG_SYSTEM: empty,
      },
    },
  ).trim();
}

/**
 * 実StoreにProjectとQueueを受付し、試験単位で回収する。
 * @responsibility 架空の保存Portを使わず本番Writerへ接続する。
 * @trace PRL-IT-013
 * @trace RFD-IT-029
 * @precondition Repository-local tests領域が実Directory。
 * @stimulus 新品Snapshot初期化と二Task計画。
 * @observation 世代・Queue・受付と固定Commit。
 * @oracle 全保存を読戻せる。
 * @cleanup 自己生成Rootだけを削除し不存在確認。
 * @boundary 実Git・Filesystem・既存共通排他。
 */
export function fixture(t: TestContext, independent = false) {
  assert.equal(fs.realpathSync.native(testsRoot), testsRoot);
  const root = fs.mkdtempSync(path.join(testsRoot, "orchestrator-workspace-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  git(root, ["init", "--initial-branch=main", "--template="]);
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "");
  git(root, ["config", "user.name", "Workspace Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n.env\n");
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  if (independent)
    for (const name of ["task-a.txt", "task-b.txt"])
      fs.writeFileSync(path.join(root, name), "base\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const initialized = initializeExecutionStore(
    verifyRuntimePersistenceRepository(root),
    binding,
  );
  assert.equal(initialized.status, "completed", JSON.stringify(initialized));
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: base,
    maximumConcurrency: independent ? 3 : 1,
    milestoneAcceptanceCriteria: ["done"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: ["task-a", "task-b"].map((id, index) => ({
      id,
      objectiveId: "objective-a",
      dependencies: !independent && index ? ["task-a"] : [],
      allowedPaths: [independent ? `${id}.txt` : "source.txt"],
      conflictKeys: independent ? [id] : ["same-file"],
    })),
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      binding,
      created.state,
      0,
    ).status,
    "completed",
  );
  const ports = createCoordinatorSnapshotPersistencePorts(
    root,
    binding,
    initialized.value,
  );
  const queued = ports.state.enqueueOperation({
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "a".repeat(64),
    originLane: "interactive",
    repositoryRevision: base,
    scopeHash: "b".repeat(64),
  });
  assert.equal(queued.status, "completed", JSON.stringify(queued));
  const workspaceId = randomUUID();
  const common = {
    ownerRepositoryRoot: root,
    repositoryBindingId: binding,
    projectId: "project-a",
    queueId: "queue-a",
    workspaceId,
  };
  const operate = (
    operation: Omit<CoordinatorWorkspaceRequest, keyof typeof common> &
      Record<string, unknown>,
  ) =>
    manageCoordinatorWorkspace({
      ...common,
      ...operation,
    } as CoordinatorWorkspaceRequest);
  /**
   * 同じWorkspace fixtureの保存Snapshotを実Readerから取得する。
   * @responsibility 同じWorkspace fixtureの保存Snapshotを実Readerから取得する。
   * @trace PRL-IT-013
   * @precondition 実Writerで初期化したRootとbinding。
   * @stimulus readSnapshotを呼びcompleted/valueを検査する。
   * @observation 世代、Queue、Workspaceと保存結果。
   * @oracle 読取り拒否やvalue欠測は即時試験失敗とする。
   * @cleanup 自己生成Rootはfixtureのafterで回収する。
   * @boundary 既存Snapshot読取りと実Filesystem。別台帳なし。
   */
  const snapshot = () => {
    const read = readFixtureSnapshot(root, binding);
    assert.equal(read.status, "completed", JSON.stringify(read));
    if (read.status !== "completed" || !read.value)
      throw new Error("fixture_read_failed");
    return read.value;
  };
  return {
    root,
    binding,
    base,
    ports,
    common,
    operate,
    snapshot,
    tree: path.join(root, ".crdd", "workspaces", workspaceId, "worktree"),
  };
}
