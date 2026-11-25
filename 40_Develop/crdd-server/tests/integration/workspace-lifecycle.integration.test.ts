/**
 * Workspace操作を実Git・実Snapshot・既存Leaseで結合検証する。
 * @packageDocumentation
 * @responsibility 複数Task継続、Root分離、明示破棄と再入場。
 * @trace PRL-IT-011
 * @trace PRL-IT-013
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @trace PRL-IT-012
 * @trace RFD-IT-029
 * @level IT
 * @scope CoordinatorとVersion Control。AIは合成作業のみ。
 * @boundary 実Filesystem／Git／既存操作Lease。Provider・Dockerなし。
 */

import assert from "node:assert/strict";
import { getRepository } from "../../../version-control/src/index.ts";
import { prepareFixtureRecovery } from "../../../coordinator/tests/support/recovery-repository.ts";
import childProcess, { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { readStoredExecutionFixture } from "../../../execution-model/tests/fixtures/stored-execution.ts";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test, { mock, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  beginWorkspaceOperation,
  createQueue,
  readState,
  readWorkspaceState,
  saveProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import { acceptResult } from "../../../coordinator/src/lifecycle/decision.ts";
import { runTestSingleTaskAttempt } from "../../../coordinator/tests/support/task-requests.ts";
import { acquireCoordinatorSnapshotLease } from "../../../coordinator/src/lifecycle/host.ts";
import { resolveExecutionStorageDirectory } from "../../../coordinator/src/lifecycle/host.ts";
import {
  executeWorkspace,
  manageWorkspace,
  prepareWorkspaceExecutionTarget,
  type WorkspaceManagementRequest,
  type WorkspaceView,
} from "../../src/service/workspace.ts";
import { queryState } from "../../../coordinator/src/index.ts";
import { runTestCoordinatorOperation } from "../../../coordinator/tests/fixtures/task-persistence-fixture.ts";
import {
  confirmPreparedWorkspaceTarget,
  workspacePlanReadyForAcceptance,
} from "../../../coordinator/src/lifecycle/workspace.ts";
import {
  fixture as prepareFixture,
  git,
  readFixtureSnapshot,
} from "../../../coordinator/tests/fixtures/workspace-surface.ts";
import { canonicalJson } from "../../../coordinator/tests/support/contract-assertions.ts";

/** 共有FixtureにServer所有の操作だけを接続する。 @trace CPR-IT-001 */
function fixture(t: TestContext, independent = false) {
  const prepared = prepareFixture(t, independent);
  return {
    ...prepared,
    operate: (
      operation: Omit<
        WorkspaceManagementRequest,
        keyof typeof prepared.common
      > &
        Record<string, unknown>,
    ) =>
      manageWorkspace({
        ...prepared.common,
        ...(operation.operation === "create" ? { baseBranch: "main" } : {}),
        ...operation,
      } as WorkspaceManagementRequest),
  };
}

/** 選択Branchの固定、未コミット除外の確認と作成Effectの境界を実Gitで検証する。 @trace CPR-IT-001 */
test("Workspace作成は選択ブランチのHEADを照合し未コミット変更を持ち込まない", (t) => {
  const f = fixture(t);
  const alias = "views/selected";
  const branch = `refs/heads/${alias}`;
  const selected = git(f.root, [
    "commit-tree",
    "HEAD^{tree}",
    "-p",
    f.base,
    "-m",
    "selected",
  ]);
  git(f.root, ["update-ref", branch, selected]);
  const original = path.join(f.root, "source.txt");
  fs.writeFileSync(original, "staged\n");
  git(f.root, ["add", "source.txt"]);
  fs.writeFileSync(original, "unstaged\n");
  fs.writeFileSync(path.join(f.root, "new.txt"), "untracked\n");
  const index = path.join(f.root, ".git", "index");
  const bytes = fs.readFileSync(index);
  const create = {
    operation: "create" as const,
    baseBranch: alias,
    baseCommit: selected,
  };
  const confirmed = { ...create, acceptUncommittedChangesExcluded: true };
  const commands: string[][] = [];
  const spawn = childProcess.spawnSync;
  let warnStatus = false;
  const probe = t.mock.method(childProcess, "spawnSync", ((
    ...args: Parameters<typeof spawn>
  ) => {
    if (args[0] === "git" && Array.isArray(args[1]))
      commands.push([...args[1]]);
    const result = Reflect.apply(spawn, childProcess, args);
    if (
      warnStatus &&
      Array.isArray(args[1]) &&
      args[1].includes("--untracked-files=normal")
    )
      return {
        ...result,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from("warning: unavailable fixture directory\n"),
      };
    return result;
  }) as typeof spawn);
  const open = fs.openSync;
  const snapshotLock = path.join(
    f.root,
    ".crdd",
    "lock",
    "execution-model.state.lock",
  );
  let snapshotLockAcquisitions = 0;
  let operationLeaseAcquisitions = 0;
  const countSnapshotLock = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (args[1] === "wx+" && typeof args[0] === "string") {
        if (args[0] === snapshotLock) snapshotLockAcquisitions++;
        if (
          path.dirname(args[0]) === path.dirname(snapshotLock) &&
          path.basename(args[0]).startsWith("coordinator.lease.")
        )
          operationLeaseAcquisitions++;
      }
      return open(...args);
    },
  );
  syncBuiltinESMExports();
  try {
    const stateFile = path.join(
      f.root,
      ".crdd",
      "execution-model",
      "state.json",
    );
    const state = fs.readFileSync(stateFile);
    try {
      fs.writeFileSync(stateFile, "{");
      const previous = readWorkspaceState(
        { directory: f.root },
        f.common.repositoryBindingId,
      );
      assert.equal(previous.status, "blocked");
      const beforeInvalid = snapshotLockAcquisitions;
      const invalid = f.operate(confirmed);
      assert.equal(snapshotLockAcquisitions - beforeInvalid, 1);
      assert.equal(operationLeaseAcquisitions, 0);
      assert.equal(invalid.status, "blocked");
      assert.equal(invalid.reason, previous.reason);
      assert.equal(
        invalid.manualRecoveryRequired,
        previous.manualRecoveryRequired,
      );
      assert.equal(invalid.recoveryId, null);
      assert.equal(invalid.gitResult, null);
      assert.equal(commands.length, 0);
      assert.equal(fs.existsSync(f.tree), false);
      assert.equal(fs.readFileSync(stateFile, "utf8"), "{");
    } finally {
      fs.writeFileSync(stateFile, state);
    }

    const wrongGeneration = f.operate({ ...confirmed, expectedGeneration: 1 });
    assert.equal(
      wrongGeneration.reason,
      "coordinator_workspace_generation_conflict",
    );
    assert.equal(wrongGeneration.leaseReleased, true);
    assert.equal(wrongGeneration.gitResult, null);
    assert.equal(commands.length, 0);
    assert.equal(fs.existsSync(f.tree), false);

    const warning = f.operate(create);
    const warningCount = commands.length;
    assert.equal(warningCount, 3);
    assert.equal(warning.reason, "workspace_creation_confirmation_required");
    assert.equal(warning.workspace, null);
    assert.equal(warning.gitResult, null);
    assert.equal(fs.existsSync(f.tree), false);
    assert.equal(
      commands.some(
        (args) => args.includes("add") || args.includes("update-ref"),
      ),
      false,
    );
    git(f.root, ["update-ref", branch, f.base]);
    commands.length = 0;
    const stale = f.operate(confirmed);
    const staleCount = commands.length;
    assert.equal(staleCount, 3);
    assert.equal(stale.reason, "workspace_creation_branch_head_changed");
    assert.equal(stale.gitResult, null);
    assert.equal(fs.existsSync(f.tree), false);
    git(f.root, ["update-ref", branch, selected]);
    git(f.root, ["update-ref", "refs/heads/actual", selected]);
    git(f.root, ["symbolic-ref", branch, "refs/heads/actual"]);
    const symbolic = f.operate(confirmed);
    assert.equal(symbolic.reason, "workspace_creation_branch_head_changed");
    assert.equal(symbolic.gitResult, null);
    assert.equal(fs.existsSync(f.tree), false);
    git(f.root, ["update-ref", "--no-deref", branch, selected]);
    warnStatus = true;
    const unavailable = f.operate(confirmed);
    warnStatus = false;
    assert.equal(unavailable.reason, "working_tree_status_unavailable");
    assert.equal(unavailable.gitResult, null);
    assert.equal(fs.existsSync(f.tree), false);
    git(f.root, ["config", "filter.fixture.smudge", "unused-fixture-filter"]);
    commands.length = 0;
    const filtered = f.operate(confirmed);
    assert.equal(filtered.reason, "working_tree_status_unavailable");
    assert.equal(filtered.gitResult, null);
    assert.equal(commands.length, 1);
    assert.equal(fs.existsSync(f.tree), false);
    git(f.root, ["config", "--unset", "filter.fixture.smudge"]);
    commands.length = 0;
    const beforeCreateLocks = snapshotLockAcquisitions;
    const beforeCreateLeases = operationLeaseAcquisitions;
    const created = f.operate(confirmed);
    assert.equal(snapshotLockAcquisitions - beforeCreateLocks, 3);
    assert.equal(operationLeaseAcquisitions - beforeCreateLeases, 1);
    assert.equal(commands.length, 9);
    assert.equal(
      commands.filter((args) => args.includes("--get-regexp")).length,
      1,
    );
    assert.ok(
      commands.findIndex((args) => args.includes("check-ignore")) <
        commands.findIndex((args) => args.includes("show-ref")),
    );
    assert.equal(
      commands.filter(
        (args) =>
          args.includes("for-each-ref") &&
          args.some((arg) => arg.includes("%(objecttype)")),
      ).length,
      1,
    );
    assert.equal(
      commands.some(
        (args) =>
          args.includes("rev-parse") && args.includes(`${selected}^{commit}`),
      ),
      false,
    );
    assert.equal(
      commands.filter(
        (args) => args.includes("ls-tree") && args.includes(selected),
      ).length,
      0,
    );
    assert.equal(
      commands.filter((args) => args.includes("check-ignore")).length,
      1,
    );
    assert.equal(
      commands.filter(
        (args) => args.includes("show-ref") && args.includes("--exists"),
      ).length,
      1,
    );
    assert.equal(
      commands.filter(
        (args) => args.includes("worktree") && args.includes("list"),
      ).length,
      2,
    );
    assert.equal(
      commands.filter((args) => args.includes("for-each-ref")).length,
      1,
    );
    t.diagnostic(
      `Git起動回数: 作成確認=${warningCount}、HEAD不一致=${staleCount}、了承後作成=${commands.length}`,
    );
    assert.equal(
      commands.filter(
        (args) =>
          args.includes("status") && args.includes("--untracked-files=normal"),
      ).length,
      1,
    );
    assert.equal(created.status, "completed", JSON.stringify(created));
    assert.equal(created.workspace?.head, selected);
    assert.equal(created.workspace?.phase, "ready");
    assert.equal(created.gitResult?.observation?.dirty, null);
  } finally {
    countSnapshotLock.mock.restore();
    probe.mock.restore();
    syncBuiltinESMExports();
  }
  assert.deepEqual(fs.readFileSync(index), bytes);
  assert.equal(fs.readFileSync(original, "utf8"), "unstaged\n");
  assert.equal(git(f.root, ["show", ":source.txt"]), "staged");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.equal(git(f.root, ["-C", f.tree, "rev-parse", "HEAD"]), selected);
  assert.equal(
    fs.readFileSync(path.join(f.tree, "source.txt"), "utf8").trim(),
    "base",
  );
  assert.equal(fs.existsSync(path.join(f.tree, "new.txt")), false);
});

/** 保留と廃棄が短期排他と操作Lockを用途別に取得することを実測する。 @trace PRL-IT-013 */
test("Workspaceの保留は短期Lock一回で廃棄は物理Lockと短期Lock四回を使う", (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  const previousEvidence = f.snapshot().leaseEvidence;
  const open = fs.openSync;
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  const counts = { state: 0, operation: 0 };
  const probe = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (
        args[1] === "wx+" &&
        typeof args[0] === "string" &&
        path.dirname(args[0]) === lockDirectory
      ) {
        const name = path.basename(args[0]);
        if (name === "execution-model.state.lock") counts.state++;
        if (name.startsWith("coordinator.lease.")) counts.operation++;
      }
      return open(...args);
    },
  );
  syncBuiltinESMExports();
  try {
    for (const until of ["2099-01-01T00:00:00Z", null]) {
      const start = counts.state;
      const held = f.operate({ operation: "hold", until });
      assert.equal(held.status, "completed", held.reason);
      assert.equal(held.workspace?.holdUntil, until);
      assert.equal(held.leaseReleased, null);
      assert.equal(held.gitResult, null);
      assert.equal(counts.state - start, 1);
      assert.equal(counts.operation, 0);
    }
    const start = counts.state;
    const discarded = f.operate({
      operation: "discard",
      expectedHead: f.base,
      discardChanges: true,
    });
    assert.equal(discarded.status, "completed", discarded.reason);
    assert.equal(counts.state - start, 4);
    assert.equal(counts.operation, 1);
  } finally {
    probe.mock.restore();
    syncBuiltinESMExports();
  }
  const after = f.snapshot();
  assert.equal(after.workspaces.length, 0);
  assert.equal(after.leaseIntents.length, 0);
  assert.deepEqual(after.leaseEvidence, previousEvidence);
  assert.equal(fs.existsSync(f.tree), false);
});

/** 選択による所属の保存と同じQueueの再観測を分ける。 @trace PRL-IT-013 */
test("Workspaceの再観測はQueueを割り当てず選択だけが割り当てる", (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  const queueId = "queue-b";
  assert.equal(
    createQueue({ directory: f.root }, f.binding, {
      kind: "scheduled",
      input: [
        {
          queueId,
          projectId: f.common.projectId,
          milestoneId: "milestone-a",
          requestHash: "c".repeat(64),
          originLane: "interactive",
          repositoryRevision: f.base,
          scopeHash: "b".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const before = f.snapshot();
  assert.equal(
    f.operate({ operation: "observe", queueId }).reason,
    "coordinator_workspace_target_mismatch",
  );
  assert.deepEqual(f.snapshot(), before);

  const selectWorkspace = () =>
    executeWorkspace(
      f.root,
      f.common.projectId,
      {
        operation: "select",
        projectId: f.common.projectId,
        queueId,
        workspaceId: f.common.workspaceId,
        expectedGeneration: before.workspaces[0]?.generation,
      },
      () => true,
    );
  git(f.root, ["worktree", "lock", f.tree]);
  try {
    const rejected = selectWorkspace();
    assert.equal((rejected.data as { status: string }).status, "blocked");
    assert.deepEqual(f.snapshot(), before);
  } finally {
    git(f.root, ["worktree", "unlock", f.tree]);
  }

  const open = fs.openSync;
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  let stateLocks = 0;
  let operationLocks = 0;
  const count = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (
        args[1] === "wx+" &&
        typeof args[0] === "string" &&
        path.dirname(args[0]) === lockDirectory
      ) {
        const name = path.basename(args[0]);
        if (name === "execution-model.state.lock") stateLocks++;
        if (name.startsWith("coordinator.lease.")) operationLocks++;
      }
      return open(...args);
    },
  );
  syncBuiltinESMExports();
  try {
    const select = selectWorkspace();
    assert.equal(
      (select.data as { status: string }).status,
      "completed",
      JSON.stringify(select),
    );
    assert.equal(stateLocks, 3); // 認可済み入口の読取り1＋管理処理2
    assert.equal(operationLocks, 1);
    stateLocks = 0;
    operationLocks = 0;
    assert.equal(
      f.operate({ operation: "observe", queueId }).status,
      "completed",
    );
    assert.equal(stateLocks, 2);
    assert.equal(operationLocks, 1);
  } finally {
    count.mock.restore();
    syncBuiltinESMExports();
  }
  const after = f.snapshot();
  assert.equal(
    after.queueEntries.find((entry) => entry.queueId === queueId)?.workspaceId,
    f.common.workspaceId,
  );
  assert.deepEqual(after.leaseIntents, before.leaseIntents);
  assert.deepEqual(after.leaseEvidence, before.leaseEvidence);
});

/** 候補の固定・採否記録・Ref回収を実Lockの取得数と同時に確認する。 @trace CPR-IT-006 */
test("Workspace候補固定と終了は操作Lockを一回ずつ取得しLease証拠を残さない", (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  const before = f.snapshot();
  fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
  const blobId = git(f.tree, ["hash-object", "--no-filters", "source.txt"]);
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  const open = fs.openSync;
  const counts = { state: 0, operation: 0 };
  const track = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (
        args[1] === "wx+" &&
        typeof args[0] === "string" &&
        path.dirname(args[0]) === lockDirectory
      ) {
        const name = path.basename(args[0]);
        if (name === "execution-model.state.lock") counts.state++;
        if (name.startsWith("coordinator.lease.")) counts.operation++;
      }
      return open(...args);
    },
  );
  syncBuiltinESMExports();
  try {
    const fixed = f.operate({
      operation: "freeze",
      operationId: randomUUID(),
      baseCommit: f.base,
      expectedHead: f.base,
      selection: [{ path: "source.txt", mode: "100644", blobId }],
      candidateName: null,
      relatedChangeIds: [],
      authorize: () => true,
    });
    assert.equal(fixed.status, "completed", fixed.reason);
    assert.ok(fixed.candidateResult?.candidateCommit);
    assert.deepEqual(counts, { state: 3, operation: 1 });
    const closed = f.operate({
      operation: "close-candidate",
      expectedCommit: fixed.candidateResult.candidateCommit,
      disposition: "rejected",
      referencesReleased: true,
      authorize: () => true,
    });
    assert.equal(closed.status, "completed", closed.reason);
    assert.deepEqual(counts, { state: 8, operation: 2 });
  } finally {
    track.mock.restore();
    syncBuiltinESMExports();
  }
  const after = f.snapshot();
  assert.equal(after.workspaces[0]?.candidate, null);
  assert.equal(after.results.length, 2);
  assert.deepEqual(after.leaseIntents, before.leaseIntents);
  assert.deepEqual(after.leaseEvidence, before.leaseEvidence);
});

/** Taskと新規Workspace作成は同じ操作Lockを使い、予約と物理取得の順序にかかわらず競合を拒否する。 @trace CPR-IT-001 */
test("Workspace作成の操作LockはTaskのLeaseと双方向に競合する", (t) => {
  const f = fixture(t);
  const acquireTask = () =>
    acquireCoordinatorSnapshotLease(
      f.root,
      f.binding,
      f.common.projectId,
      f.common.queueId,
      "project-operation",
    );
  const task = acquireTask();
  assert.equal(task.status, "completed", task.reason);
  assert.ok(task.value);
  try {
    const rejected = f.operate({ operation: "create", baseCommit: f.base });
    assert.equal(rejected.reason, "coordinator_lease_unavailable");
    assert.equal(rejected.gitResult, null);
    assert.equal(fs.existsSync(f.tree), false);
  } finally {
    assert.equal(task.value.release().status, "completed");
  }
  const previousEvidence = f.snapshot().leaseEvidence;
  let observedTaskConflict = false;
  const created = f.operate({
    operation: "create",
    baseCommit: f.base,
    authorize() {
      if (!observedTaskConflict) {
        observedTaskConflict = true;
        const competing = acquireTask();
        assert.equal(competing.status, "blocked", competing.reason);
        assert.equal(
          competing.reason,
          "coordinator_lease_preexisting_resource",
        );
      }
      return true;
    },
  });
  assert.equal(created.status, "completed", created.reason);
  assert.equal(observedTaskConflict, true);
  assert.equal(f.snapshot().leaseIntents.length, 0);
  assert.deepEqual(f.snapshot().leaseEvidence, previousEvidence);
});

/** 作成意図の保存後に操作Lockを失った場合はGitの作成へ進まない。 @trace PRL-IT-013 */
test("Workspace作成はGit直前に操作Lockを失うと作成しない", (t) => {
  const f = fixture(t);
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  let lost = false;
  const result = f.operate({
    operation: "create",
    baseCommit: f.base,
    authorize() {
      if (!lost && f.snapshot().workspaces[0]?.phase === "creating") {
        const lock = fs
          .readdirSync(lockDirectory)
          .find((name) => name.startsWith("coordinator.lease."));
        assert.ok(lock);
        fs.rmSync(path.join(lockDirectory, lock));
        lost = true;
      }
      return true;
    },
  });
  assert.equal(lost, true);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workspace_operation_lock_requires_manual_review",
  );
  assert.equal(result.gitResult, null);
  assert.equal(fs.existsSync(f.tree), false);
  const snapshot = f.snapshot();
  assert.equal(snapshot.workspaces[0]?.phase, "creating");
  assert.equal(snapshot.leaseIntents.length, 0);
});

/** 短期排他の解放不明では操作Lockを解放し、Gitへ進まない。 @trace CPR-IT-001 */
test("Workspace作成の受付で短期Lock解放不明なら作成しない", (t) => {
  const f = fixture(t);
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  const stateLock = path.join(lockDirectory, "execution-model.state.lock");
  const remove = fs.rmSync;
  const spawn = childProcess.spawnSync;
  let releaseFailures = 0;
  let gitStarts = 0;
  const release = t.mock.method(
    fs,
    "rmSync",
    (...args: Parameters<typeof remove>) => {
      if (args[0] === stateLock) {
        releaseFailures++;
        throw new Error("fixture_state_lock_release_unconfirmed");
      }
      return remove(...args);
    },
  );
  const commands = t.mock.method(childProcess, "spawnSync", ((
    ...args: Parameters<typeof spawn>
  ) => {
    if (args[0] === "git") gitStarts++;
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof spawn);
  syncBuiltinESMExports();
  const result = (() => {
    try {
      return f.operate({
        operation: "create",
        baseCommit: f.base,
        acceptUncommittedChangesExcluded: true,
      });
    } finally {
      release.mock.restore();
      commands.mock.restore();
      syncBuiltinESMExports();
    }
  })();
  assert.equal(releaseFailures, 1);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_snapshot_lock_release_unconfirmed");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.recoveryId, null);
  assert.equal(result.gitResult, null);
  assert.equal(gitStarts, 0);
  assert.equal(fs.existsSync(f.tree), false);
  assert.deepEqual(fs.readdirSync(lockDirectory), [
    "execution-model.state.lock",
  ]);
  // 解放故障を注入した試験所有のLockだけを片付け、予約を作っていないことを観測する。
  remove(stateLock);
  const snapshot = f.snapshot();
  assert.equal(snapshot.leaseIntents.length, 0);
  assert.equal(snapshot.workspaces.length, 0);
});

/** Gitと結果保存が成功した後、操作Lock解放だけが失敗した状態を確認する。 @trace PRL-IT-013 */
test("Workspace作成の結果保存後に操作Lock解放が失敗してもreadyを維持する", (t) => {
  const f = fixture(t);
  const spawn = childProcess.spawnSync;
  const remove = fs.rmSync;
  let worktreesCreated = 0;
  let releaseFailures = 0;
  const gitProbe = t.mock.method(childProcess, "spawnSync", ((
    ...args: Parameters<typeof spawn>
  ) => {
    const outcome = Reflect.apply(spawn, childProcess, args);
    if (
      args[0] === "git" &&
      Array.isArray(args[1]) &&
      args[1].includes("worktree") &&
      args[1].includes("add") &&
      outcome.status === 0
    )
      worktreesCreated++;
    return outcome;
  }) as typeof spawn);
  const fault = t.mock.method(
    fs,
    "rmSync",
    (...args: Parameters<typeof remove>) => {
      if (
        worktreesCreated > 0 &&
        typeof args[0] === "string" &&
        path.basename(args[0]).startsWith("coordinator.lease.")
      ) {
        releaseFailures++;
        throw Object.assign(new Error("fixture_workspace_lock_release"), {
          code: "EACCES",
        });
      }
      return remove(...args);
    },
  );
  syncBuiltinESMExports();
  let result: ReturnType<typeof f.operate>;
  try {
    result = f.operate({ operation: "create", baseCommit: f.base });
  } finally {
    fault.mock.restore();
    gitProbe.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(worktreesCreated, 1);
  assert.equal(releaseFailures, 1);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workspace_operation_lock_requires_manual_review",
  );
  assert.equal(result.gitResult?.status, "completed");
  assert.equal(result.workspace?.phase, "ready");
  assert.equal(result.leaseReleased, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.releaseRecoveryId, null);
  assert.equal(result.recoveryId, null);
  const snapshot = f.snapshot();
  assert.equal(snapshot.workspaces[0]?.phase, "ready");
  assert.equal(snapshot.workspaces[0]?.pending, null);
  assert.equal(snapshot.leaseIntents.length, 0);
  assert.equal(snapshot.leaseEvidence.length, 0);
  assert.equal(
    fs
      .readdirSync(path.join(f.root, ".crdd", "lock"))
      .filter((name) => name.startsWith("coordinator.lease.")).length,
    1,
  );
  assert.equal(fs.existsSync(f.tree), true);
});

/**
 * 独立Taskも同じTreeでは順番に実行し、明示Git採用と品質受入を分離する。
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @precondition 自己生成Gitと実Writer。Provider／Dockerは使わない。
 * @stimulus Direct／Isolated、最大並行数3、依存なし二Task、取消と失敗。
 * @observation 稼働最大数、後続の前変更読取り、HEAD／index、品質判断。
 * @oracle 一件終端後だけ次開始、自動Commit0、Isolatedは採用前拒否・Ref終了後も別Process受入。
 * @cleanup fixtureのexact Rootだけ回収する。
 * @responsibility 同Workspaceの逐次Taskと別採用後の明示品質受入を結合する。
 * @boundary 実Git・実Writer・有限Task代役。実Provider成功や公開E2Eは主張しない。
 */
test("計画の独立二Taskは同じWorkspaceで直列実行し明示採用後だけ品質受入する", async (t) => {
  for (const isolated of [false, true]) {
    for (const stop of ["none", "cancel", "failure"]) {
      const f = fixture(t, true);
      if (isolated)
        assert.equal(
          f.operate({ operation: "create", baseCommit: f.base }).status,
          "completed",
        );
      const tree = isolated ? f.tree : f.root;
      const indexBefore = fs.readFileSync(path.join(f.root, ".git", "index"));
      const controller = new AbortController();
      let calls = 0,
        active = 0,
        maximum = 0;
      const result = await runTestCoordinatorOperation(
        {
          persistence: f.ports,
          ...(isolated
            ? {
                workspaceTarget: prepareWorkspaceExecutionTarget(
                  f.root,
                  "project-a",
                  f.common.workspaceId,
                ),
              }
            : {}),
          runSingleTaskAttempt: async (input) => {
            const call = ++calls;
            active++;
            maximum = Math.max(maximum, active);
            assert.equal(input.workspaceTarget?.executionTree, tree);
            assert.equal(await input.observeStarted?.(), undefined);
            await Promise.resolve();
            if (call === 2)
              assert.equal(
                fs.readFileSync(path.join(tree, "task-a.txt"), "utf8"),
                "first\n",
              );
            fs.writeFileSync(
              path.join(tree, call === 1 ? "task-a.txt" : "task-b.txt"),
              call === 1 ? "first\n" : "second\n",
            );
            if (stop === "cancel") controller.abort();
            active--;
            return {
              contract: "crdd-coordinator/single-task-adapter",
              attemptId: input.attemptId,
              operationId: input.operationId,
              authorityBindingId: input.authorityBindingId,
              repositoryRevision: input.repositoryRevision,
              status: stop === "failure" ? "blocked" : "completed",
              reason:
                stop === "failure" ? "synthetic_failure" : "task_completed",
              effectState: "settled",
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              candidateId: null,
              recoveryIds: [],
              workspaceResult: {
                workspaceId: input.workspaceTarget?.workspaceId ?? null,
                changedPaths: [call === 1 ? "task-a.txt" : "task-b.txt"],
                canonicalRepositoryChanged: !isolated,
                changeAttribution: "unattributed",
                workspaceDeletionIssued: false,
              },
            };
          },
        },
        {
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          cancellationSignal: controller.signal,
          taskExecutions: ["task-a", "task-b"].map((taskId) => ({
            taskId,
            authorityBindingId: `authority-${taskId}`,
            taskRequest: {},
            repositoryRoot: f.root,
          })),
        },
      );
      assert.equal(maximum, 1);
      assert.equal(calls, stop === "none" ? 2 : 1);
      assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
      assert.deepEqual(
        fs.readFileSync(path.join(f.root, ".git", "index")),
        indexBefore,
      );
      if (stop !== "none") {
        assert.notEqual(result.status, "completed");
        continue;
      }
      assert.equal(result.status, "completed", JSON.stringify(result));
      /**
       * 保存済み対象へ明示品質受入を同Processか別Processで届ける。
       * @responsibility 保存済み対象へ明示品質受入を同Processか別Processで届ける。
       * @trace CPR-IT-001
       * @trace CPR-IT-004
       * @trace CPR-IT-006
       * @precondition 同じ計画Revisionと現在Workspace採用記録。
       * @stimulus 最新保存状態から受入入力を作り公開処理へ渡す。
       * @observation 未採用時拒否、採用後受入と元Revision。
       * @oracle Task完了だけでは受け入れず同じ採用証拠へ相関する。
       * @cleanup 所有子の終了後にfixtureを正式終了・回収する。
       * @boundary 実Snapshotと公開受入。Task代役を実AIとみなさない。
       */
      const decide = async (separate = false) => {
        const plan = f.snapshot().projects[0];
        assert.ok(plan);
        const input = {
          contract: "crdd-coordinator/acceptance-decision/v1",
          decisionId: "quality-objective",
          blockerId: "blocker-quality-objective",
          sourceSpecId: "SPEC-000002",
          projectId: "project-a",
          milestoneId: "milestone-a",
          repositoryRevision: f.base,
          expectedGeneration: plan.generation,
          target: "objective",
          targetId: "objective-a",
          decision: "accept",
          criterionEvidenceIds: ["evidence-synthetic"],
          principalId: "principal-a",
        };
        if (!separate)
          return acceptResult(input, f.root, {
            principalId: "principal-a",
          });
        const entry = pathToFileURL(
          path.resolve(
            import.meta.dirname,
            "../../../coordinator/src/lifecycle/decision.ts",
          ),
        ).href;
        return JSON.parse(
          (
            await promisify(childProcess.execFile)(
              process.execPath,
              [
                "-e",
                `import {acceptResult} from ${JSON.stringify(entry)}; console.log(JSON.stringify(acceptResult(${JSON.stringify(input)},${JSON.stringify(f.root)},{principalId:'principal-a'})));`,
              ],
              { encoding: "utf8", windowsHide: true, timeout: 30_000 },
            )
          ).stdout,
        );
      };
      if (isolated) {
        assert.equal((await decide()).status, "blocked");
        assert.equal(
          workspacePlanReadyForAcceptance(
            f.root,
            f.binding,
            "project-a",
            "milestone-a",
            f.base,
            f.base,
          ),
          false,
        );
        const selections = ["task-a.txt", "task-b.txt"].map(
          (file) =>
            (
              executeWorkspace(
                f.root,
                "project-a",
                {
                  projectId: "project-a",
                  queueId: "queue-a",
                  workspaceId: f.common.workspaceId,
                  operation: "inspect",
                  path: file,
                },
                () => true,
              ).data as { selection: unknown }
            ).selection,
        );
        const fixed = f.operate({
          operation: "freeze",
          operationId: randomUUID(),
          baseCommit: f.base,
          expectedHead: f.base,
          selection: selections,
          candidateName: "計画候補",
          relatedChangeIds: [],
          authorize: () => true,
        });
        assert.equal(fixed.status, "completed", JSON.stringify(fixed));
        const commit = fixed.workspace?.candidate?.candidateCommit;
        assert.ok(commit);
        const adoption = {
          operation: "adopt" as const,
          candidateCommit: commit,
          targetBranch: "main",
          expectedTargetHead: f.base,
          authorize: () => true,
        };
        const spawn = childProcess.spawnSync;
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
        try {
          assert.equal(f.operate(adoption).status, "blocked");
        } finally {
          childProcess.spawnSync = spawn;
          syncBuiltinESMExports();
        }
        const primary = f.snapshot().workspaces[0]?.candidate?.primaryFailure;
        assert.ok(primary);
        const adopted = f.operate(adoption);
        assert.equal(adopted.status, "completed", JSON.stringify(adopted));
        assert.equal(
          f.snapshot().workspaces[0]?.candidate?.primaryFailure,
          primary,
        );
        assert.equal(
          workspacePlanReadyForAcceptance(
            f.root,
            f.binding,
            "project-a",
            "milestone-a",
            f.base,
            git(f.root, ["rev-parse", "HEAD"]),
          ),
          true,
        );
        assert.equal(
          f.operate({
            operation: "close-candidate",
            expectedCommit: commit,
            disposition: "adopted",
            referencesReleased: true,
            authorize: () => true,
          }).status,
          "completed",
        );
        assert.equal(f.snapshot().workspaces[0]?.candidate, null);
        assert.equal(
          workspacePlanReadyForAcceptance(
            f.root,
            f.binding,
            "project-a",
            "milestone-a",
            f.base,
            f.base,
          ),
          false,
        );
        assert.equal(
          workspacePlanReadyForAcceptance(
            f.root,
            f.binding,
            "other",
            "milestone-a",
            f.base,
            git(f.root, ["rev-parse", "HEAD"]),
          ),
          false,
        );
      }
      assert.equal(
        workspacePlanReadyForAcceptance(
          f.root,
          f.binding,
          "project-a",
          "milestone-a",
          f.base,
          git(f.root, ["rev-parse", "HEAD"]),
        ),
        true,
        JSON.stringify(f.snapshot().results),
      );
      const accepted = await decide(isolated);
      assert.equal(accepted.status, "completed", JSON.stringify(accepted));
      const query = queryState(
        {
          requestId: "query-after-adoption",
          projectId: "project-a",
          repositoryRevision: f.base,
        },
        f.root,
        { principalId: "principal-a" },
      );
      assert.equal(query.status, "completed", JSON.stringify(query));
      assert.equal(f.snapshot().projects[0]?.repositoryRevision, f.base);
      assert.equal(f.snapshot().projects[0]?.objectives[0]?.state, "accepted");
      assert.equal(
        f.snapshot().projects[0]?.milestone.state === "accepted",
        false,
      );
    }
  }
});

/**
 * 公開入力から本番Writer・実Gitの固定／統合／回収まで照合する。
 * @responsibility 世代、固定差分と失敗非上書きを公開投影から確認する。
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @precondition 自己生成Git、Project、Queue。
 * @stimulus 閉入力、古い世代、取消、固定、現在file変更、統合と終了。
 * @observation 実Ref、親Commit、固定patch、Snapshotと非開示投影。
 * @oracle 明示選択だけ統合し、現在file変更を固定差分へ混ぜない。
 * @cleanup fixtureのafterでexact Rootの不存在確認。
 * @boundary 外部Providerを使わない実Git結合。
 */
test("公開Workspace操作は閉入力と世代を保ち固定候補だけを統合する", (t) => {
  const f = fixture(t);
  const common = {
    projectId: "project-a",
    queueId: "queue-a",
    workspaceId: f.common.workspaceId,
  };
  /**
   * 固定ProjectのWorkspace commandを現在認可付きで実行する。
   * @responsibility 固定ProjectのWorkspace commandを現在認可付きで実行する。
   * @trace CPR-IT-001
   * @trace CPR-IT-004
   * @trace CPR-IT-006
   * @precondition 同じroot・project・common binding。
   * @stimulus executeWorkspaceへcommandを渡す。
   * @observation 閉入力拒否と操作結果、観測回数。
   * @oracle hostile値は処置前拒否し正常対象だけ配送する。
   * @cleanup fixtureが所有Workspace・Ref・Rootを回収する。
   * @boundary 実Owner入口。認可callbackのみ固定しAM実認可の証明にしない。
   */
  const call = (command: Record<string, unknown>) =>
    executeWorkspace(f.root, "project-a", { ...common, ...command }, () => true)
      .data as {
      workspace: WorkspaceView | null;
      status: string;
      reason: string;
    };
  let touched = false;
  const badItem = {
    path: "source.txt",
    get blobId() {
      touched = true;
      return f.base;
    },
    mode: "100644",
  };
  assert.equal(
    inspectWorkspaceCommand({
      ...common,
      operation: "freeze",
      expectedGeneration: 0,
      operationId: randomUUID(),
      baseCommit: f.base,
      expectedHead: f.base,
      selection: [badItem],
      candidateName: null,
      relatedChangeIds: [],
    }),
    null,
  );
  assert.equal(touched, false);
  assert.equal(
    inspectWorkspaceCommand({ ...common, operation: "get", ownerRoot: f.root }),
    null,
  );
  assert.throws(
    () =>
      executeWorkspace(
        f.root,
        "project-a",
        {
          ...common,
          operation: "create",
          expectedGeneration: 0,
          baseBranch: "main",
          baseCommit: f.base,
          name: null,
        },
        () => false,
      ),
    /workspace_access_unavailable/u,
  );
  const cancelled = new AbortController();
  cancelled.abort();
  assert.throws(
    () =>
      executeWorkspace(
        f.root,
        "project-a",
        { ...common, operation: "get" },
        () => true,
        cancelled.signal,
      ),
    /workspace_access_unavailable/u,
  );
  let current = call({
    operation: "create",
    expectedGeneration: 0,
    baseBranch: "main",
    baseCommit: f.base,
    name: "作業",
  }).workspace;
  assert.ok(current);
  const stale = call({
    operation: "rename",
    expectedGeneration: 0,
    name: "古い",
  });
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "coordinator_workspace_generation_conflict");
  fs.writeFileSync(path.join(f.tree, "source.txt"), "selected\n");
  const preview = executeWorkspace(
    f.root,
    "project-a",
    { ...common, operation: "inspect", path: "source.txt" },
    () => true,
  ).data as { selection: unknown };
  const fixed = call({
    operation: "freeze",
    expectedGeneration: current.generation,
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedHead: current.head,
    selection: [preview.selection],
    candidateName: "候補",
    relatedChangeIds: [],
  });
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  current = fixed.workspace;
  assert.ok(current?.candidate?.candidateCommit);
  fs.writeFileSync(path.join(f.tree, "source.txt"), "later-not-selected\n");
  const patch = executeWorkspace(
    f.root,
    "project-a",
    { ...common, operation: "candidate-diff", path: "source.txt" },
    () => true,
  ).data as { patch: string };
  assert.match(patch.patch, /selected/u);
  assert.doesNotMatch(patch.patch, /later-not-selected/u);
  const adopted = call({
    operation: "adopt",
    expectedGeneration: current.generation,
    candidateCommit: current.candidate.candidateCommit,
    targetBranch: "main",
    expectedTargetHead: f.base,
  });
  assert.equal(adopted.status, "completed", JSON.stringify(adopted));
  current = adopted.workspace;
  assert.ok(current);
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "selected\n",
  );
  assert.equal(
    git(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]).split(" ").length,
    3,
  );
  const closed = call({
    operation: "close-candidate",
    expectedGeneration: current.generation,
    expectedCommit: current.candidate?.candidateCommit,
    disposition: "adopted",
  });
  assert.equal(closed.status, "completed", JSON.stringify(closed));
  current = closed.workspace;
  assert.ok(current);
  assert.equal(current.candidate, null);
  const disposed = call({
    operation: "discard",
    expectedGeneration: current.generation,
    expectedHead: current.head,
    discardChanges: true,
  });
  assert.equal(disposed.status, "completed", JSON.stringify(disposed));
  assert.equal(disposed.workspace, null);
  assert.equal(fs.existsSync(f.tree), false);
  assert.doesNotMatch(
    JSON.stringify(disposed),
    /candidate-index|ownerRepositoryRoot|repositoryBindingId/u,
  );
});

/**
 * 未固定の拒否意図を正式終了又は同操作再入場で閉じる。
 * @responsibility 誤入力でWorkspaceを永久停止させない。
 * @trace CPR-IT-001
 * @trace CPR-IT-006
 * @precondition 新品Workspaceと確認済みfile内容。
 * @stimulus 不正Path／重複、内容変更、改名、明示不採用。
 * @observation Ref不存在、固定時名、一次失敗と新固定。
 * @oracle 誤入力は意図0、未固定はRef不存在確認後だけ解除。
 * @cleanup fixtureのafter。
 * @boundary 実Git／本番Writer。
 */
test("未固定の拒否は正式不採用で閉じ、改名後も同操作の元表示名を保つ", (t) => {
  for (const retry of [false, true]) {
    const f = fixture(t);
    f.operate({ operation: "create", baseCommit: f.base });
    fs.writeFileSync(path.join(f.tree, "source.txt"), "desired\n");
    const item = {
      path: "source.txt",
      mode: "100644",
      blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
    };
    const input = {
      operation: "freeze" as const,
      operationId: randomUUID(),
      baseCommit: f.base,
      expectedHead: f.base,
      selection: [item],
      candidateName: null,
      relatedChangeIds: [],
      authorize: () => true,
    };
    for (const selection of [
      [{ path: ".git/config", mode: null, blobId: null }],
      [item, item],
    ]) {
      assert.equal(
        f.operate({ ...input, selection }).reason,
        "coordinator_candidate_input_invalid",
      );
      assert.equal(f.snapshot().workspaces[0]?.candidate, null);
    }
    fs.writeFileSync(
      path.join(f.tree, "source.txt"),
      "changed after confirmation\n",
    );
    const failed = f.operate(input);
    assert.equal(failed.reason, "commit_create_content_changed");
    assert.equal(f.snapshot().workspaces[0]?.candidate?.candidateCommit, null);
    assert.equal(
      f.operate({ operation: "rename", name: "後の表示名" }).status,
      "completed",
    );
    if (retry) {
      fs.writeFileSync(path.join(f.tree, "source.txt"), "desired\n");
      const fixed = f.operate(input);
      assert.equal(fixed.status, "completed", JSON.stringify(fixed));
      assert.equal(fixed.workspace?.candidate?.request.workspaceName, null);
      assert.equal(
        fixed.workspace?.candidate?.primaryFailure,
        "commit_create_content_changed",
      );
      const commit = fixed.candidateResult?.candidateCommit;
      assert.ok(commit);
      assert.equal(
        f.operate({
          operation: "close-candidate",
          expectedCommit: commit,
          disposition: "rejected",
          referencesReleased: true,
          authorize: () => true,
        }).status,
        "completed",
      );
    } else {
      const closed = f.operate({
        operation: "close-candidate",
        expectedCommit: null,
        disposition: "rejected",
        referencesReleased: true,
        authorize: () => true,
      });
      assert.equal(closed.status, "completed", JSON.stringify(closed));
      assert.equal(f.snapshot().workspaces[0]?.candidate, null);
      assert.equal(f.snapshot().results.length, 2);
      const next = f.operate({
        ...input,
        operationId: randomUUID(),
        selection: [
          {
            ...item,
            blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
          },
        ],
      });
      assert.equal(next.status, "completed", JSON.stringify(next));
    }
  }
});

/**
 * 未完了MergeのCommitだけを別Processで継続する。
 * @responsibility 応答喪失・Commit拒否後も二重Mergeを発行しない。
 * @trace CPR-IT-006
 * @precondition 明示固定済みCandidate。
 * @stimulus no-commit後のCommit応答を拒否又は不明にし再入場。
 * @observation MERGE_HEAD、index、親順序、一次失敗。
 * @oracle 同Candidateの未完了Commitだけを確定する。
 * @cleanup spawn差替え復元とfixture回収。
 * @boundary 実Git／実Store、故障通知だけ代役。
 */
test("未完了Mergeは拒否・応答喪失後も同操作でCommitだけを継続する", (t) => {
  for (const unknown of [false, true]) {
    const f = fixture(t);
    f.operate({ operation: "create", baseCommit: f.base });
    fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
    const fixed = f.operate({
      operation: "freeze",
      operationId: randomUUID(),
      baseCommit: f.base,
      expectedHead: f.base,
      selection: [
        {
          path: "source.txt",
          mode: "100644",
          blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
        },
      ],
      candidateName: null,
      relatedChangeIds: [],
      authorize: () => true,
    });
    const candidateCommit = fixed.candidateResult?.candidateCommit;
    assert.ok(candidateCommit, JSON.stringify(fixed));
    const spawn = childProcess.spawnSync;
    childProcess.spawnSync = ((
      ...args: Parameters<typeof childProcess.spawnSync>
    ) => {
      if (Array.isArray(args[1]) && args[1].includes("commit"))
        return {
          pid: 0,
          output: [null, "", ""],
          stdout: "",
          stderr: "synthetic",
          status: unknown ? null : 1,
          signal: null,
          ...(unknown
            ? {
                error: Object.assign(new Error("synthetic timeout"), {
                  code: "ETIMEDOUT",
                }),
              }
            : {}),
        };
      return Reflect.apply(spawn, childProcess, args);
    }) as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    const request = {
      operation: "adopt" as const,
      candidateCommit,
      targetBranch: "main",
      expectedTargetHead: f.base,
      authorize: () => true,
    };
    let failed: ReturnType<typeof f.operate>;
    try {
      failed = f.operate(request);
    } finally {
      childProcess.spawnSync = spawn;
      syncBuiltinESMExports();
    }
    assert.equal(failed.status, "blocked");
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
    assert.equal(git(f.root, ["rev-parse", "MERGE_HEAD"]), candidateCommit);
    const primary = failed.candidateResult?.reason;
    assert.ok(primary);
    const module = pathToFileURL(
      path.resolve(import.meta.dirname, "../../src/service/workspace.ts"),
    ).href;
    const script = `import(${JSON.stringify(module)}).then(({manageWorkspace})=>process.stdout.write(JSON.stringify(manageWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
    const resumed = JSON.parse(
      execFileSync(
        process.execPath,
        ["-e", script, JSON.stringify({ ...f.common, ...request })],
        { encoding: "utf8", timeout: 60_000, windowsHide: true },
      ),
    );
    assert.equal(resumed.status, "completed", JSON.stringify(resumed));
    assert.equal(resumed.workspace.candidate.primaryFailure, primary);
    assert.equal(
      git(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
      `${resumed.candidateResult.mergeCommit} ${f.base} ${candidateCommit}`,
    );
  }
});

/**
 * 採否確定後の回収失敗を元記録を変えずに再入場する。
 * @responsibility 採用と不採用の両方で後発清掃失敗を分離する。
 * @trace CPR-IT-004
 * @precondition 実Storeと固定済みCandidate。
 * @stimulus update-ref -dだけ一度拒否し別Processで再開。
 * @observation 元採否本文、回収失敗、Ref不存在と現在候補解除。
 * @oracle 採否不変、同候補終端確定、他Ref保全。
 * @cleanup 差替え復元後に自己生成fixtureを回収。
 * @boundary 実Git／実Snapshot、削除拒否だけ有限代役。
 */
test("採否後のRef回収失敗は不変記録を保ち別Processで同候補を閉じる", (t) => {
  for (const disposition of ["adopted", "rejected"] as const) {
    const f = fixture(t);
    f.operate({ operation: "create", baseCommit: f.base });
    fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
    const fixed = f.operate({
      operation: "freeze",
      operationId: randomUUID(),
      baseCommit: f.base,
      expectedHead: f.base,
      selection: [
        {
          path: "source.txt",
          mode: "100644",
          blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
        },
      ],
      candidateName: null,
      relatedChangeIds: [],
      authorize: () => true,
    });
    const candidateCommit = fixed.candidateResult?.candidateCommit;
    assert.ok(candidateCommit, JSON.stringify(fixed));
    if (disposition === "adopted")
      assert.equal(
        f.operate({
          operation: "adopt",
          candidateCommit,
          targetBranch: "main",
          expectedTargetHead: f.base,
          authorize: () => true,
        }).status,
        "completed",
      );
    git(f.root, ["update-ref", "refs/heads/untouched", f.base]);
    const request = {
      operation: "close-candidate" as const,
      expectedCommit: candidateCommit,
      disposition,
      referencesReleased: true,
      authorize: () => true,
    };
    const spawn = childProcess.spawnSync;
    childProcess.spawnSync = ((
      ...args: Parameters<typeof childProcess.spawnSync>
    ) => {
      if (
        Array.isArray(args[1]) &&
        args[1].includes("update-ref") &&
        args[1].includes("-d")
      )
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
    let failed: ReturnType<typeof f.operate>;
    try {
      failed = f.operate(request);
    } finally {
      childProcess.spawnSync = spawn;
      syncBuiltinESMExports();
    }
    assert.equal(failed.reason, "candidate_ref_removal_unconfirmed");
    const before = f.snapshot();
    assert.equal(before.workspaces[0]?.candidate?.primaryFailure, null);
    assert.equal(
      before.workspaces[0]?.candidate?.cleanupFailure,
      failed.reason,
    );
    const original = JSON.stringify(before.results);
    const module = pathToFileURL(
      path.resolve(import.meta.dirname, "../../src/service/workspace.ts"),
    ).href;
    const script = `import(${JSON.stringify(module)}).then(({manageWorkspace})=>process.stdout.write(JSON.stringify(manageWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
    const resumed = JSON.parse(
      execFileSync(
        process.execPath,
        ["-e", script, JSON.stringify({ ...f.common, ...request })],
        { encoding: "utf8", timeout: 60_000, windowsHide: true },
      ),
    );
    assert.equal(resumed.status, "completed", JSON.stringify(resumed));
    const after = f.snapshot();
    assert.equal(after.workspaces[0]?.candidate, null);
    assert.equal(after.results.length, 2);
    assert.equal(JSON.stringify(after.results.slice(0, 1)), original);
    assert.ok(JSON.stringify(after.results[1]).includes(failed.reason));
    assert.equal(git(f.root, ["rev-parse", "refs/heads/untouched"]), f.base);
    assert.throws(() =>
      git(f.root, [
        "rev-parse",
        "--verify",
        fixed.candidateResult?.candidateRef as string,
      ]),
    );
  }
});

/**
 * 回収終端保存後の現在解除失敗と後発欠測を分離する。
 * @responsibility 確定済み終端本文を後発失敗で変更しない。
 * @trace CPR-IT-006
 * @precondition 実Storeと固定Candidate。
 * @stimulus close結果保存後だけ現在解除保存を拒否し再入場でRef照会拒否。
 * @observation 採否・終端Hash、後発失敗、最後の候補解除。
 * @oracle 終端本文不変、欠測時候補保持、fresh観測後だけ終了。
 * @cleanup 差替え復元と自己生成fixture回収。
 * @boundary 実Git／実Snapshotと別Process。
 */
test("回収終端保存後の解除失敗と後発欠測でも固定本文を再利用する", (t) => {
  const f = fixture(t);
  f.operate({ operation: "create", baseCommit: f.base });
  fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
  const fixed = f.operate({
    operation: "freeze",
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedHead: f.base,
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
      },
    ],
    candidateName: null,
    relatedChangeIds: [],
    authorize: () => true,
  });
  const commit = fixed.candidateResult?.candidateCommit;
  const ref = fixed.candidateResult?.candidateRef;
  assert.ok(commit && ref);
  const request = {
    operation: "close-candidate" as const,
    expectedCommit: commit,
    disposition: "rejected" as const,
    referencesReleased: true,
    authorize: () => true,
  };
  const spawn = childProcess.spawnSync;
  const open = fs.openSync;
  let deleted = false;
  let writes = 0;
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const response = Reflect.apply(spawn, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("update-ref") &&
      args[1].includes("-d") &&
      response.status === 0
    )
      deleted = true;
    return response;
  }) as typeof childProcess.spawnSync;
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (
      deleted &&
      String(args[0]).endsWith("state.pending.json") &&
      String(args[1]).includes("w") &&
      ++writes === 2
    )
      throw Object.assign(new Error("synthetic current save failure"), {
        code: "EACCES",
      });
    return Reflect.apply(open, fs, args);
  }) as typeof fs.openSync;
  syncBuiltinESMExports();
  let failed: ReturnType<typeof f.operate>;
  try {
    failed = f.operate(request);
  } finally {
    childProcess.spawnSync = spawn;
    fs.openSync = open;
    syncBuiltinESMExports();
  }
  assert.equal(failed.status, "blocked", JSON.stringify(failed));
  assert.equal(writes >= 2, true);
  const saved = f.snapshot();
  assert.equal(saved.results.length, 2);
  assert.equal(saved.workspaces[0]?.candidate?.phase, "removing");
  const original = JSON.stringify(saved.results);
  const module = pathToFileURL(
    path.resolve(import.meta.dirname, "../../src/service/workspace.ts"),
  ).href;
  const diagnostic = `Promise.all([import(${JSON.stringify(module)}),import('node:child_process'),import('node:module')]).then(([m,cp,modules])=>{const original=cp.default.spawnSync;cp.default.spawnSync=(...args)=>Array.isArray(args[1])&&args[1].includes('rev-parse')&&args[1].includes(${JSON.stringify(ref)})?{pid:0,status:1,signal:null,stdout:'synthetic',stderr:'',output:[null,'synthetic','']}:Reflect.apply(original,cp.default,args);modules.syncBuiltinESMExports();process.stdout.write(JSON.stringify(m.manageWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true})));});`;
  /**
   * 保存済みCandidateのcloseを別Node Processから再入場する。
   * @responsibility 保存済みCandidateのcloseを別Node Processから再入場する。
   * @trace CPR-IT-006
   * @precondition 同じRoot・Candidate・close操作IDを保持している。
   * @stimulus 固定scriptをNode -eで実行しJSON結果を読む。
   * @observation 終了値、close結果とRef・元採否本文。
   * @oracle 応答喪失や一回のRef欠測でも元結果を不変再利用する。
   * @cleanup 子を終了待機し最後に同じfixture Rootを回収する。
   * @boundary 別Processと実Git・Writer。外部AIなし。
   */
  const run = (script: string) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ["-e", script, JSON.stringify({ ...f.common, ...request })],
        { encoding: "utf8", windowsHide: true, timeout: 60_000 },
      ),
    );
  const missed = run(diagnostic);
  assert.equal(missed.status, "blocked");
  assert.equal(
    f.snapshot().workspaces[0]?.candidate?.cleanupFailure,
    "candidate_ref_unavailable",
  );
  assert.equal(JSON.stringify(f.snapshot().results), original);
  const script = `import(${JSON.stringify(module)}).then(({manageWorkspace})=>process.stdout.write(JSON.stringify(manageWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
  const resumed = run(script);
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.equal(f.snapshot().workspaces[0]?.candidate, null);
  assert.equal(JSON.stringify(f.snapshot().results), original);
});

/**
 * 名前付き固定・別採用・既存結果保存・Ref回収を実入口で確認する。
 * @responsibility Workspace継続とCandidate寿命を分離する。
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @precondition 新品Snapshot、実Git、未実行Queue。
 * @stimulus 固定、Workspace改名、採用、Ref終了、Workspace破棄。
 * @observation 親関係、Message、結果記録と元Tree。
 * @oracle 固定名が履歴へ残り、別承認なしMerge0、対象Refだけ回収。
 * @cleanup fixtureのafter。
 * @boundary 本番Coordinator／VC／保存。Providerなし。
 */
test("名前付きCandidateを明示固定・採用し結果を保存してRefだけ回収する", (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base, name: "元の作業名" })
      .status,
    "completed",
  );
  fs.writeFileSync(path.join(f.tree, "source.txt"), "selected candidate\n");
  const fixed = f.operate({
    operation: "freeze",
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedHead: f.base,
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
      },
    ],
    candidateName: "固定成果",
    relatedChangeIds: [],
    authorize: () => true,
  });
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  const commit = fixed.candidateResult?.candidateCommit;
  assert.ok(commit);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.equal(
    f.operate({ operation: "rename", name: "次の作業名" }).status,
    "completed",
  );
  const adoption = {
    operation: "adopt" as const,
    candidateCommit: commit,
    targetBranch: "main",
    expectedTargetHead: f.base,
    authorize: () => true,
  };
  const linkedOwner = f.operate({ ...adoption, ownerRepositoryRoot: f.tree });
  assert.equal(linkedOwner.status, "blocked");
  assert.equal(linkedOwner.candidateResult, null);
  assert.equal(
    f.operate({ ...adoption, authorize: () => false }).reason,
    "coordinator_candidate_not_authorized",
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  const beforeAdoption = f.snapshot();
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  let stateLocks = 0;
  let workspaceLocks = 0;
  let canonicalLocks = 0;
  let worktreeLists = 0;
  const open = fs.openSync;
  const probe = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (
        args[1] === "wx+" &&
        typeof args[0] === "string" &&
        path.dirname(args[0]) === lockDirectory
      ) {
        const name = path.basename(args[0]);
        if (name === "execution-model.state.lock") stateLocks++;
        if (name.startsWith("coordinator.lease.project-operation-"))
          workspaceLocks++;
        if (name.startsWith("coordinator.lease.canonical-adoption-"))
          canonicalLocks++;
      }
      return open(...args);
    },
  );
  const spawn = childProcess.spawnSync;
  const gitProbe = t.mock.method(
    childProcess,
    "spawnSync",
    (...args: Parameters<typeof spawn>) => {
      if (
        args[0] === "git" &&
        Array.isArray(args[1]) &&
        args[1].includes("worktree") &&
        args[1].includes("list")
      )
        worktreeLists++;
      return Reflect.apply(spawn, childProcess, args);
    },
  );
  syncBuiltinESMExports();
  let merged: ReturnType<typeof f.operate>;
  try {
    merged = f.operate(adoption);
  } finally {
    probe.mock.restore();
    gitProbe.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(merged.status, "completed", JSON.stringify(merged));
  assert.equal(worktreeLists, 1);
  assert.deepEqual(
    { stateLocks, workspaceLocks, canonicalLocks },
    {
      stateLocks: 4,
      workspaceLocks: 1,
      canonicalLocks: 0,
    },
  );
  const afterAdoption = f.snapshot();
  assert.deepEqual(afterAdoption.leaseIntents, beforeAdoption.leaseIntents);
  assert.deepEqual(afterAdoption.leaseEvidence, beforeAdoption.leaseEvidence);
  const head = git(f.root, ["rev-parse", "HEAD"]);
  assert.equal(
    git(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
    `${head} ${f.base} ${commit}`,
  );
  assert.ok(
    git(f.root, ["log", "-1", "--format=%B"]).includes("Workspace: 元の作業名"),
  );
  assert.equal(f.snapshot().workspaces[0]?.name, "次の作業名");
  const repeatedAdoption = f.operate(adoption);
  assert.equal(
    repeatedAdoption.status,
    "completed",
    JSON.stringify(repeatedAdoption),
  );
  assert.equal(
    repeatedAdoption.candidateResult?.reason,
    "commit_merge_existing_confirmed",
  );
  assert.equal(
    f
      .snapshot()
      .results.filter(
        (r) =>
          r.identity ===
          `workspace-candidate-${fixed.workspace?.candidate?.request.operationId}`,
      ).length,
    1,
  );
  const close = {
    operation: "close-candidate" as const,
    expectedCommit: commit,
    disposition: "adopted" as const,
    referencesReleased: true,
    authorize: () => true,
  };
  assert.equal(
    f.operate({ ...close, referencesReleased: false }).status,
    "blocked",
  );
  assert.equal(
    f.operate({
      operation: "discard",
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "coordinator_candidate_still_referenced",
  );
  assert.equal(f.operate(close).status, "completed");
  assert.equal(f.snapshot().workspaces[0]?.candidate, null);
  assert.equal(f.snapshot().results.length, 2);
  assert.equal(fs.existsSync(f.tree), true);
  assert.equal(
    f.operate({
      operation: "discard",
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
});

/** 採用意図の保存後に操作Lockを失った場合、Mergeを開始しない。 @trace CPR-IT-006 */
test("正本採用はMerge直前に操作Lockを失うとGitを変更しない", (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
  const fixed = f.operate({
    operation: "freeze",
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedHead: f.base,
    candidateName: null,
    relatedChangeIds: [],
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
      },
    ],
    authorize: () => true,
  });
  assert.ok(fixed.candidateResult?.candidateCommit);
  const candidateCommit = fixed.candidateResult.candidateCommit;
  const before = f.snapshot();
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  let lost = false;
  const blocked = f.operate({
    operation: "adopt",
    candidateCommit,
    targetBranch: "main",
    expectedTargetHead: f.base,
    authorize() {
      const during = f.snapshot();
      if (!lost && during.workspaces[0]?.candidate?.phase === "merging") {
        const competing = f.operate({
          operation: "adopt",
          candidateCommit,
          targetBranch: "main",
          expectedTargetHead: f.base,
          authorize: () => true,
        });
        assert.equal(competing.status, "blocked");
        assert.equal(competing.reason, "workspace_operation_lock_present");
        assert.equal(competing.candidateResult, null);
        assert.deepEqual(f.snapshot(), during);
        const lock = fs
          .readdirSync(lockDirectory)
          .find((name) =>
            name.startsWith("coordinator.lease.project-operation-"),
          );
        assert.ok(lock);
        fs.rmSync(path.join(lockDirectory, lock));
        lost = true;
      }
      return true;
    },
  });
  assert.equal(lost, true);
  assert.equal(blocked.status, "blocked");
  assert.equal(
    blocked.reason,
    "workspace_operation_lock_requires_manual_review",
  );
  assert.equal(blocked.candidateResult, null);
  assert.equal(blocked.leaseReleased, false);
  assert.equal(blocked.manualRecoveryRequired, true);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  const current = f.snapshot();
  assert.equal(current.workspaces[0]?.candidate?.phase, "merging");
  assert.equal(current.results.length, 0);
  assert.deepEqual(current.leaseIntents, before.leaseIntents);
  assert.deepEqual(current.leaseEvidence, before.leaseEvidence);
});

/**
 * Merge成立後の保存拒否を別Processから同じ操作へ戻す。
 * @responsibility 再Mergeせず元親関係と採用記録を確定する。
 * @trace CPR-IT-006
 * @precondition 固定Candidateと実保存。
 * @stimulus Merge後の最初の保存を一回拒否し子Processで再入場。
 * @observation Git HEAD、記録段階、Merge件数、Ref回収。
 * @oracle 取込済みを未実施に戻さず結果保存だけを閉じる。
 * @cleanup 差替えを戻しfixtureだけ回収。
 * @boundary 実Git／実Store、拒否発火点だけ代役。
 */
test("Merge成功後の保存失敗は別Process再入場で二重Mergeせず閉じる", (t) => {
  const f = fixture(t);
  f.operate({ operation: "create", baseCommit: f.base });
  fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
  const fixed = f.operate({
    operation: "freeze",
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedHead: f.base,
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
      },
    ],
    candidateName: null,
    relatedChangeIds: [],
    authorize: () => true,
  });
  const commit = fixed.candidateResult?.candidateCommit;
  assert.ok(commit, JSON.stringify(fixed));
  const spawn = childProcess.spawnSync;
  const open = fs.openSync;
  let completed = false;
  let injected = false;
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const outcome = Reflect.apply(spawn, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("merge") &&
      outcome.status === 0
    )
      completed = true;
    return outcome;
  }) as typeof childProcess.spawnSync;
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (
      completed &&
      !injected &&
      String(args[0]).endsWith("state.pending.json") &&
      String(args[1]).includes("w")
    ) {
      injected = true;
      throw Object.assign(new Error("synthetic storage failure"), {
        code: "EACCES",
      });
    }
    return Reflect.apply(open, fs, args);
  }) as typeof fs.openSync;
  syncBuiltinESMExports();
  const request = {
    operation: "adopt" as const,
    candidateCommit: commit,
    targetBranch: "main",
    expectedTargetHead: f.base,
    authorize: () => true,
  };
  let failed: ReturnType<typeof f.operate>;
  try {
    failed = f.operate(request);
  } finally {
    childProcess.spawnSync = spawn;
    fs.openSync = open;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.equal(failed.status, "blocked");
  assert.equal(failed.candidateResult?.reason, "commit_merge_completed");
  const head = git(f.root, ["rev-parse", "HEAD"]);
  assert.equal(f.snapshot().workspaces[0]?.candidate?.phase, "merging");
  const module = pathToFileURL(
    path.resolve(import.meta.dirname, "../../src/service/workspace.ts"),
  ).href;
  const script = `import(${JSON.stringify(module)}).then(({manageWorkspace})=>process.stdout.write(JSON.stringify(manageWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
  const resumed = JSON.parse(
    execFileSync(
      process.execPath,
      ["-e", script, JSON.stringify({ ...f.common, ...request })],
      { encoding: "utf8", timeout: 60_000, windowsHide: true },
    ),
  );
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.equal(
    resumed.candidateResult.reason,
    "commit_merge_existing_confirmed",
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
  assert.equal(f.snapshot().results.length, 1);
  assert.equal(
    f.operate({
      operation: "close-candidate",
      expectedCommit: commit,
      disposition: "adopted",
      referencesReleased: true,
      authorize: () => true,
    }).status,
    "completed",
  );
});

/**
 * 別Processで同じ保存・操作入口へ再入場する。
 * @responsibility 長期Sessionの記憶に依存しない現在状態の確認。
 * @trace PRL-IT-013
 * @precondition 固定fixtureの同一結合だけを渡す。
 * @stimulus 新Node Processと同じWorkspace操作。
 * @observation 構造化結果。
 * @oracle 秘密・Source本文を送信せず同対象だけへ到達。
 * @cleanup 子Process終了を待ちfixtureで回収。
 * @boundary ローカル子Processのみ。
 */
function reenter(
  f: ReturnType<typeof fixture>,
  operation: "observe" | "discard",
) {
  const module = pathToFileURL(
    path.resolve(import.meta.dirname, "../../src/service/workspace.ts"),
  ).href;
  const script = `import(${JSON.stringify(module)}).then(({manageWorkspace})=>process.stdout.write(JSON.stringify(manageWorkspace(JSON.parse(process.argv[1])))));`;
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "-e",
        script,
        JSON.stringify({
          ...f.common,
          operation,
          expectedHead: f.base,
          discardChanges: true,
        }),
      ],
      {
        cwd: operation === "observe" && fs.existsSync(f.tree) ? f.tree : f.root,
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    ),
  ) as { status: string; reason: string };
}

/**
 * 二Taskの状態遷移を実Writerへ保存し同Treeで継続する。
 * @responsibility Task終端とWorkspace寿命の分離・実行Treeだけの変更。
 * @trace PRL-IT-013
 * @precondition 実保存されたQueueとWorkspace。
 * @stimulus 有限Task作業、開始・結果保存、不採用破棄。
 * @observation 所属state、Tree、Ref、履歴、元dirty。
 * @oracle 第一Task後もTreeあり、最終破棄後は不要資源なし。
 * @cleanup fixtureのafter。
 * @boundary AIは合成作業、Gitと保存は実物。
 */
test("同Workspaceを二Taskで継続し保存Rootを分けて不採用後に回収する", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "source.txt"), "human dirty\n");
  const created = f.operate({
    operation: "create",
    baseCommit: f.base,
    acceptUncommittedChangesExcluded: true,
  });
  assert.equal(created.status, "completed", JSON.stringify(created));
  for (const taskId of ["task-a", "task-b"]) {
    const target = confirmPreparedWorkspaceTarget(
      f.root,
      f.binding,
      "queue-a",
      prepareWorkspaceExecutionTarget(
        f.root,
        "project-a",
        f.common.workspaceId,
      ),
    );
    assert.equal(target.status, "completed");
    if (target.status !== "completed") return;
    assert.equal(target.value.ownerRepositoryRoot, f.root);
    assert.equal(target.value.executionTree, f.tree);
    const initialState = f.snapshot().projects[0];
    assert.ok(initialState);
    let state = initialState;
    for (const command of [
      {
        kind: "task_start" as const,
        projectId: state.projectId,
        taskId,
        attemptId: `attempt-${taskId}`,
        authorityBindingId: `authority-${taskId}`,
      },
      {
        kind: "task_handoff" as const,
        projectId: state.projectId,
        taskId,
        attemptId: `attempt-${taskId}`,
        operationId: `operation-${taskId}`,
      },
      {
        kind: "task_started" as const,
        projectId: state.projectId,
        taskId,
        attemptId: `attempt-${taskId}`,
        operationId: `operation-${taskId}`,
      },
    ]) {
      const next = saveProjectExecutionState(
        resolveExecutionStorageDirectory(f.root),
        f.binding,
        command,
        state.generation,
      );
      assert.equal(next.status, "completed", next.reason);
      if (next.status !== "completed")
        throw new Error("fixture_task_update_failed");
      state = next.value;
    }
    assert.equal(
      f.operate({
        operation: "discard",
        expectedHead: f.base,
        discardChanges: true,
      }).status,
      "blocked",
    );
    fs.writeFileSync(
      path.join(target.value.executionTree, "source.txt"),
      `${taskId}\n`,
    );
    const terminal = saveProjectExecutionState(
      resolveExecutionStorageDirectory(f.root),
      f.binding,
      {
        kind: "task_settle",
        projectId: state.projectId,
        taskId,
        attemptId: `attempt-${taskId}`,
        operationId: `operation-${taskId}`,
        authorityBindingId: `authority-${taskId}`,
        outcome: "completed",
        cleanupConfirmed: true,
        recoveryUnresolved: false,
        recoveryObligations: [],
        resultUnresolved: false,
      },
      state.generation,
    );
    assert.equal(terminal.status, "completed", terminal.reason);
    assert.equal(fs.existsSync(f.tree), true);
    assert.equal(f.snapshot().workspaces.length, 1);
  }
  fs.writeFileSync(path.join(f.tree, ".env"), "SYNTHETIC=not-a-credential\n");
  const held = f.operate({ operation: "hold", until: "2026-10-01T00:00:00Z" });
  assert.equal(held.status, "completed", JSON.stringify(held));
  assert.equal(
    f.operate({
      operation: "discard",
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "coordinator_workspace_held",
  );
  assert.equal(
    f.operate({ operation: "hold", until: null }).status,
    "completed",
  );
  assert.equal(
    f.operate({ operation: "adopted" }).reason,
    "coordinator_workspace_adoption_not_connected",
  );
  const discarded = f.operate({
    operation: "discard",
    expectedHead: f.base,
    discardChanges: true,
  });
  assert.equal(discarded.status, "completed", JSON.stringify(discarded));
  assert.equal(fs.existsSync(f.tree), false);
  assert.equal(f.snapshot().workspaces.length, 0);
  assert.equal(f.snapshot().historyPending.length, 1);
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "human dirty\n",
  );
  assert.equal(git(f.root, ["branch", "--show-current"]), "main");
});

/**
 * 専用Branchの通常Commit後や未Commit変更があるときも、同じWorkspaceで実行できる。
 * @responsibility 実行対象を過去のHEADや作業途中の変更へ拘束しない。
 * @trace PRL-IT-013
 * @precondition WorktreeとQueueを実Storeに作成する。
 * @stimulus 準備済み対象の専用Branchで通常Commitを作り、Stage済みと未Stageの変更を加える。
 * @observation 実行先、現在Commit、保存済みWorkspace。
 * @oracle 準備済み対象は不変で、Gitと保存記録を書き換えず同じ対象を選択する。
 * @cleanup fixtureが所有するGit・保存領域だけを回収する。
 * @boundary CRDD Serverの準備、Coordinatorの確認、実GitとEM。
 */
test("専用WorkspaceのHEADが進み未コミット変更があっても実行先にできる", (t) => {
  const f = fixture(t);
  const created = f.operate({ operation: "create", baseCommit: f.base });
  assert.equal(created.status, "completed", JSON.stringify(created));
  const prepared = prepareWorkspaceExecutionTarget(
    f.root,
    "project-a",
    f.common.workspaceId,
  );
  assert.ok(prepared);
  assert.equal(Object.hasOwn(prepared, "head"), false);
  fs.writeFileSync(path.join(f.tree, "source.txt"), "task commit\n");
  git(f.tree, ["add", "--", "source.txt"]);
  git(f.tree, ["commit", "-m", "fixture task"]);
  const commit = git(f.tree, ["rev-parse", "HEAD"]);
  assert.notEqual(commit, f.base);
  fs.writeFileSync(path.join(f.tree, "source.txt"), "staged work\n");
  git(f.tree, ["add", "--", "source.txt"]);
  fs.writeFileSync(path.join(f.tree, "source.txt"), "unstaged work\n");
  const before = git(f.tree, ["status", "--porcelain=v1"]);
  assert.match(before, /^MM /u);
  const commands: string[][] = [];
  const spawn = childProcess.spawnSync;
  const spy = t.mock.method(childProcess, "spawnSync", ((
    ...args: Parameters<typeof spawn>
  ) => {
    if (args[0] === "git" && Array.isArray(args[1]))
      commands.push([...args[1]]);
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof spawn);
  syncBuiltinESMExports();
  let target: ReturnType<typeof confirmPreparedWorkspaceTarget>;
  try {
    const fresh = prepareWorkspaceExecutionTarget(
      f.root,
      "project-a",
      f.common.workspaceId,
    );
    assert.deepEqual(fresh, prepared);
    const serverCommands = commands.length;
    assert.equal(serverCommands, 0, "Serverは保存記録の照合だけを行う");
    target = confirmPreparedWorkspaceTarget(
      f.root,
      f.binding,
      "queue-a",
      prepared,
    );
    const observations = commands.filter(
      (args) => args.includes("worktree") && args.includes("list"),
    );
    assert.equal(observations.length, 1);
    assert.equal(commands.length - serverCommands, 2);
    assert.ok(commands[1]?.includes("for-each-ref"));
    t.diagnostic(
      `Git起動回数: Server準備=${serverCommands}、Coordinator確認=${commands.length - serverCommands}、worktree list合計=${observations.length}`,
    );
  } finally {
    spy.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(target.status, "completed", JSON.stringify(target));
  assert.equal(target.value?.executionTree, f.tree);
  assert.equal(target.value?.head, commit);
  assert.equal(f.snapshot().workspaces[0]?.head, f.base);
  assert.equal(git(f.tree, ["status", "--porcelain=v1"]), before);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  git(f.root, ["worktree", "lock", f.tree]);
  try {
    assert.deepEqual(
      prepareWorkspaceExecutionTarget(
        f.root,
        "project-a",
        f.common.workspaceId,
      ),
      prepared,
    );
    const locked = confirmPreparedWorkspaceTarget(
      f.root,
      f.binding,
      "queue-a",
      prepared,
    );
    assert.equal(locked.status, "blocked");
    assert.equal(locked.reason, "coordinator_workspace_target_changed");
  } finally {
    git(f.root, ["worktree", "unlock", f.tree]);
  }
  const other = ".crdd/other-worktree";
  git(f.root, ["worktree", "add", "-b", "other-worktree", other, commit]);
  const mismatched = confirmPreparedWorkspaceTarget(
    f.root,
    f.binding,
    "queue-a",
    {
      ...prepared,
      executionTree: path.join(f.root, other),
      worktree: { relativePath: other, branch: "other-worktree" },
    },
  );
  assert.equal(mismatched.status, "blocked");
  assert.equal(mismatched.reason, "coordinator_workspace_target_changed");
});

/**
 * 部分削除と既存Lease競合を実Storeから再入場する。
 * @responsibility Git成功・保存とLeaseの状態を別々に確認する。
 * @trace PRL-IT-011
 * @trace PRL-IT-013
 * @precondition 新品Workspaceと実操作Lease。
 * @stimulus Ref削除だけ失敗、Lease保持中の重複操作。
 * @observation 同UUIDの現在意図と再読取り。
 * @oracle 別対象処置0、再入場後Ref／Treeなし。
 * @cleanup Process差替え復元とfixture回収。
 * @boundary 実Git／Writer／Lease＋Ref失敗通知代役。
 */
test("Branchだけ残る失敗を同対象で回収し既存Leaseで二重操作を拒否する", (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    f.root,
    f.binding,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") return;
  assert.equal(f.operate({ operation: "observe" }).status, "blocked");
  assert.equal(reenter(f, "observe").status, "blocked");
  const lockDirectory = path.join(f.root, ".crdd", "lock");
  const physicalLease = fs
    .readdirSync(lockDirectory)
    .find((name) => name.startsWith("coordinator.lease."));
  assert.ok(physicalLease);
  const duringLease = f.snapshot();
  assert.equal(
    f.operate({ operation: "rename", name: "競合中" }).reason,
    "coordinator_lease_unavailable",
  );
  assert.deepEqual(f.snapshot(), duringLease);
  assert.equal(lease.value.release().status, "completed");
  const beforeRename = f.snapshot();
  const residue = path.join(lockDirectory, physicalLease);
  fs.writeFileSync(residue, "synthetic orphan", { flag: "wx" });
  try {
    assert.equal(
      f.operate({ operation: "rename", name: "残存中" }).reason,
      "coordinator_lease_preexisting_resource",
    );
    assert.deepEqual(f.snapshot(), beforeRename);
    assert.equal(fs.readFileSync(residue, "utf8"), "synthetic orphan");
  } finally {
    fs.unlinkSync(residue);
  }
  const open = fs.openSync;
  const stateFile = path.join(f.root, ".crdd", "execution-model", "state.json");
  const gitConfig = path.join(f.root, ".git", "config");
  let stateRead = false;
  let configReads = 0;
  let configReadsDuringSave = 0;
  const openSpy = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (args[0] === stateFile) stateRead = true;
      if (args[0] === gitConfig) {
        configReads++;
        if (stateRead) configReadsDuringSave++;
      }
      return Reflect.apply(open, fs, args);
    },
  );
  let renamed: ReturnType<typeof f.operate>;
  try {
    renamed = f.operate({ operation: "rename", name: "改名後" });
  } finally {
    openSpy.mock.restore();
  }
  assert.equal(stateRead, true);
  assert.equal(configReads, 1, "入口のGit配置を一回だけ観測する");
  assert.equal(
    configReadsDuringSave,
    0,
    "状態ファイルを読み始めた後はGitを再観測しない",
  );
  assert.equal(renamed.status, "completed");
  assert.equal(renamed.leaseReleased, null);
  assert.equal(renamed.gitResult, null);
  assert.deepEqual(f.snapshot(), {
    ...beforeRename,
    snapshotRevision: beforeRename.snapshotRevision + 1,
    workspaces: beforeRename.workspaces.map((workspace) => ({
      ...workspace,
      name: "改名後",
      generation: workspace.generation + 1,
    })),
    queueEntries: beforeRename.queueEntries.map((queue) =>
      queue.queueId === "queue-a"
        ? { ...queue, generation: queue.generation + 1 }
        : queue,
    ),
  });
  const marker = path.join(f.root, ".git");
  const retiredMarker = path.join(f.root, ".git-rename-observation-fixture");
  const published = fs.readFileSync(stateFile);
  assert.equal(
    f.operate({
      operation: "rename",
      name: "連結先を変更",
      ownerRepositoryRoot: f.tree,
    }).reason,
    "coordinator_workspace_input_invalid",
  );
  assert.deepEqual(fs.readFileSync(stateFile), published);
  fs.renameSync(marker, retiredMarker);
  try {
    assert.equal(
      f.operate({ operation: "rename", name: "配置なし" }).reason,
      "coordinator_workspace_input_invalid",
    );
    assert.deepEqual(fs.readFileSync(stateFile), published);
  } finally {
    fs.renameSync(retiredMarker, marker);
  }
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) =>
    Array.isArray(args[1]) && args[1].includes("update-ref")
      ? {
          pid: 0,
          output: [],
          stdout: "",
          stderr: "synthetic",
          status: 1,
          signal: null,
        }
      : Reflect.apply(
          original,
          childProcess,
          args,
        )) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const failed = f.operate({
    operation: "discard",
    expectedHead: f.base,
    discardChanges: true,
  });
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  assert.equal(failed.status, "blocked");
  assert.equal(failed.gitResult?.worktreeRemoved, true);
  assert.equal(f.snapshot().workspaces[0]?.phase, "discarding");
  assert.equal(
    f.snapshot().workspaces[0]?.primaryFailure,
    "worktree_branch_remove_failed",
  );
  const retried = reenter(f, "discard");
  assert.equal(retried.status, "completed", JSON.stringify(retried));
  assert.equal(f.snapshot().workspaces.length, 0);
  assert.equal(f.snapshot().historyPending[0]?.primaryFailure, "cleanup");
});

/**
 * Candidateの成功相関と正当な途中意図を実Writerで区別する。
 * @responsibility 形式だけのfixed／merged昇格を防ぐ。
 * @trace CPR-IT-006
 * @precondition 実固定済みCandidateのSnapshot。
 * @stimulus 不正target・採否・Commit・結果相関と正常merging保存。
 * @observation Writerの受理／拒否と旧値。
 * @oracle 不正は不変、前段lastResultを持つ途中意図は保存できる。
 * @cleanup fixtureのafter。
 * @boundary 実保存とcodec、Git Effectなし。
 */
test("Candidate codecは矛盾した成功を拒否し正当な途中意図を受理する", (t) => {
  const f = fixture(t);
  f.operate({ operation: "create", baseCommit: f.base });
  fs.writeFileSync(path.join(f.tree, "source.txt"), "candidate\n");
  const fixed = f.operate({
    operation: "freeze",
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedHead: f.base,
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: git(f.tree, ["hash-object", "--no-filters", "source.txt"]),
      },
    ],
    candidateName: null,
    relatedChangeIds: [],
    authorize: () => true,
  });
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  const workspaceOperation = beginWorkspaceOperation(
    resolveExecutionStorageDirectory(f.root),
    f.binding,
    "project-a",
    "queue-a",
    f.common.workspaceId,
    "adopt",
  );
  assert.equal(workspaceOperation.status, "completed");
  assert.ok(workspaceOperation.value);
  try {
    const before = f.snapshot();
    const workspace = before.workspaces[0];
    const candidate = workspace?.candidate;
    assert.ok(workspace && candidate);
    const target = { targetBranch: "main", expectedTargetHead: f.base };
    const invalid = workspaceOperation.value.save(workspace.generation, {
      ...workspace,
      generation: workspace.generation + 1,
      candidate: {
        ...candidate,
        phase: "merging",
        target,
        disposition: "rejected",
      },
    });
    assert.equal(invalid.status, "blocked");
    assert.equal(invalid.reason, "coordinator_workspace_record_invalid");
    assert.deepEqual(f.snapshot(), before);
    const pending = {
      ...workspace,
      generation: workspace.generation + 1,
      candidate: { ...candidate, phase: "merging" as const, target },
    };
    assert.equal(
      workspaceOperation.value.save(workspace.generation, pending).status,
      "completed",
    );
    assert.deepEqual(f.snapshot(), {
      ...before,
      snapshotRevision: before.snapshotRevision + 1,
      queueEntries: before.queueEntries.map((item) =>
        item.queueId === "queue-a"
          ? {
              ...item,
              workspaceId: pending.workspaceId,
              generation: item.generation + 1,
            }
          : item,
      ),
      workspaces: before.workspaces.map((item) =>
        item.workspaceId === pending.workspaceId ? pending : item,
      ),
    });
  } finally {
    assert.equal(workspaceOperation.value.release().status, "completed");
  }
});

/**
 * 本番Dispatcherから有限AI代役へ選択Treeと所属Rootを搬送する。
 * @responsibility 新型を置くだけでなく実Task搬送箇所を結合する。
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @precondition 実Git・実state・既存Lease。
 * @stimulus 既存の二Task実行と不完全なWorkspace入力の拒否。
 * @observation 代役入力、状態、Tree、Provider依存への接触。
 * @oracle 二Taskが同Tree、保存は所属Root、実Provider依頼0。
 * @cleanup fixtureのafter。
 * @boundary Dispatcherは実装、外部AIだけ有限代役。
 */
test("本番Task搬送は所属Rootと選択Treeを分離し不正入力ではProviderを起動しない", async (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  let calls = 0;
  const outcome = await runTestCoordinatorOperation(
    {
      persistence: f.ports,
      workspaceTarget: prepareWorkspaceExecutionTarget(
        f.root,
        "project-a",
        f.common.workspaceId,
      ),
      runSingleTaskAttempt: async (input) => {
        calls++;
        const target = input.workspaceTarget;
        assert.ok(target);
        assert.deepEqual(target, {
          workspaceId: f.common.workspaceId,
          ownerRepositoryRoot: f.root,
          executionTree: f.tree,
          head: f.base,
          baseCommit: f.base,
        });
        assert.equal(await input.observeStarted?.(), undefined);
        fs.writeFileSync(
          path.join(target.executionTree, "source.txt"),
          `task-${calls}\n`,
        );
        return {
          contract: "crdd-coordinator/single-task-adapter",
          attemptId: input.attemptId,
          operationId: input.operationId,
          authorityBindingId: input.authorityBindingId,
          repositoryRevision: input.repositoryRevision,
          status: "completed",
          reason: "task_completed",
          effectState: "settled",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          candidateId: null,
          recoveryIds: [],
          workspaceResult: {
            workspaceId: target.workspaceId,
            changedPaths: ["source.txt"],
            canonicalRepositoryChanged: false,
            changeAttribution: "unattributed",
            workspaceDeletionIssued: false,
          },
        };
      },
    },
    {
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      cancellationSignal: new AbortController().signal,
      taskExecutions: ["task-a", "task-b"].map((taskId) => ({
        taskId,
        authorityBindingId: `authority-${taskId}`,
        taskRequest: { synthetic: true },
        repositoryRoot: f.root,
      })),
    },
  );
  assert.equal(outcome.status, "completed", JSON.stringify(outcome));
  assert.equal(calls, 2);
  assert.equal(outcome.workspaceResults?.length, 2);
  for (const observation of outcome.workspaceResults ?? []) {
    assert.ok(["task-a", "task-b"].includes(observation.taskId));
    assert.equal(observation.result.workspaceId, f.common.workspaceId);
    assert.deepEqual(observation.result.changedPaths, ["source.txt"]);
    assert.ok(
      observation.attemptId.length > 0 && observation.operationId.length > 0,
    );
  }
  assert.equal(f.snapshot().queueEntries[0]?.state, "integration_pending");
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "base\n",
  );
  assert.equal(
    fs.existsSync(path.join(f.tree, ".crdd", "orchestrator")),
    false,
  );
  const unavailable = await runTestSingleTaskAttempt(
    new Proxy({} as Parameters<typeof runTestSingleTaskAttempt>[0], {
      get() {
        throw new Error("provider_dependency_touched");
      },
    }),
    {
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
      repositoryRevision: f.base,
      taskRequest: {},
      repositoryRoot: f.root,
      workspaceTarget: {
        workspaceId: f.common.workspaceId,
        executionTree: f.tree,
        ownerRepositoryRoot: f.root,
        baseCommit: null,
        head: null,
      },
      cancellationSignal: new AbortController().signal,
    },
  );
  assert.equal(unavailable.reason, "single_task_workspace_target_invalid");
  assert.equal(unavailable.effectState, "no_effect");
  const prior = f.snapshot();
  const terminalQueues = ["completed", "cancelled"].map((state) => ({
    ...prior.queueEntries[0],
    queueId: `prior-${state}`,
    state,
  }));
  // 既存の終了Queue二件は今回fixtureの値準備。破棄操作自体は以降の正式入口で検証する。
  const physical = readState(
    prepareFixtureRecovery(getRepository(f.root).capability),
    {
      scope: "recovery",
    },
  );
  assert.equal(physical.status, "completed");
  assert.ok(physical.value);
  const fixtureBytes = Buffer.from(
    `${canonicalJson({ ...readStoredExecutionFixture(f.root, physical.value.payloadSha256), revision: physical.value.snapshot.revision + 1, previous: { revision: physical.value.snapshot.revision, payloadSha256: physical.value.payloadSha256 }, queueEntries: [...prior.queueEntries, ...terminalQueues] })}\n`,
  );
  fs.writeFileSync(
    path.join(f.root, ".crdd", "execution-model", "state.json"),
    fixtureBytes,
  );
  assert.equal(readFixtureSnapshot(f.root, f.binding).status, "completed");
  assert.equal(
    f.operate({
      operation: "discard",
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
  assert.equal(f.snapshot().queueEntries[0]?.state, "cancelled");
  for (const state of ["completed", "cancelled"])
    assert.equal(
      f
        .snapshot()
        .queueEntries.find((entry) => entry.queueId === `prior-${state}`)
        ?.state,
      state,
    );
});

/**
 * Directの対象解決と途中失敗まで観測を搬送する。
 * @responsibility Workspace ID省略をnullと照合し既得観測を落とさない。
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @precondition Workspace未作成の実QueueとGit。
 * @stimulus 二Taskの正常、二件目失敗。
 * @observation 受けた対象と最終workspaceResults。
 * @oracle 所属Rootを直接渡し二Attempt分を保持する。
 * @cleanup fixtureが自己生成Repositoryを回収する。
 * @boundary 実Dispatcher／Writerと有限Task代役。
 */
test("DirectのTask搬送はID省略と途中失敗でも変更観測を保持する", async (t) => {
  for (const failSecond of [false, true]) {
    const f = fixture(t);
    let calls = 0;
    const outcome = await runTestCoordinatorOperation(
      {
        persistence: f.ports,
        runSingleTaskAttempt: async (input) => {
          calls++;
          assert.equal(input.workspaceTarget?.workspaceId, null);
          assert.equal(input.workspaceTarget?.executionTree, f.root);
          assert.equal(await input.observeStarted?.(), undefined);
          fs.writeFileSync(path.join(f.root, "source.txt"), `direct-${calls}`);
          return {
            contract: "crdd-coordinator/single-task-adapter",
            attemptId: input.attemptId,
            operationId: input.operationId,
            authorityBindingId: input.authorityBindingId,
            repositoryRevision: input.repositoryRevision,
            status: failSecond && calls === 2 ? "blocked" : "completed",
            reason:
              failSecond && calls === 2 ? "synthetic_failure" : "completed",
            effectState: "settled",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            candidateId: null,
            recoveryIds: [],
            workspaceResult: {
              workspaceId: null,
              changedPaths: ["source.txt"],
              canonicalRepositoryChanged: true,
              changeAttribution: "unattributed",
              workspaceDeletionIssued: false,
            },
          };
        },
      },
      {
        projectId: "project-a",
        milestoneId: "milestone-a",
        queueId: "queue-a",
        cancellationSignal: new AbortController().signal,
        taskExecutions: ["task-a", "task-b"].map((taskId) => ({
          taskId,
          authorityBindingId: `authority-${taskId}`,
          taskRequest: {},
          repositoryRoot: f.root,
        })),
      },
    );
    assert.equal(outcome.status, failSecond ? "blocked" : "completed");
    assert.equal(calls, 2);
    assert.equal(outcome.workspaceResults?.length, 2);
    assert.ok(
      outcome.workspaceResults?.every(
        (item) => item.result.canonicalRepositoryChanged === true,
      ),
    );
    assert.equal(
      fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
      "direct-2",
    );
  }
});

/**
 * Git作成後の保存要求失敗を別Processから同UUIDで再観測する。
 * @responsibility 作成済みを未作成へ巻き戻さず意図を保全する。
 * @trace PRL-IT-013
 * @precondition 実Writerへ一回だけ保存前拒否を注入する。
 * @stimulus Git作成成功→結果保存用pendingのopen失敗→別Process観測。
 * @observation 現在意図、実Tree、次Process結果。
 * @oracle 別Worktreeを作らず同対象がreadyになり保存Rootは一つ。
 * @cleanup fs/Process差替え復元とfixture回収。
 * @boundary 実Git／Writer、保存前失敗のみ代役。全保存障害の実証ではない。
 */
test("Git作成後の保存失敗は意図を残して別Processで再観測する", (t) => {
  const f = fixture(t);
  const spawn = childProcess.spawnSync;
  const open = fs.openSync;
  let gitCompleted = false;
  let injected = false;
  t.after(() => {
    childProcess.spawnSync = spawn;
    fs.openSync = open;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const outcome = Reflect.apply(spawn, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("worktree") &&
      args[1].includes("add") &&
      outcome.status === 0
    )
      gitCompleted = true;
    return outcome;
  }) as typeof childProcess.spawnSync;
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (
      gitCompleted &&
      !injected &&
      String(args[0]).endsWith("state.pending.json") &&
      String(args[1]).includes("w")
    ) {
      injected = true;
      throw Object.assign(new Error("synthetic storage failure"), {
        code: "EACCES",
      });
    }
    return Reflect.apply(open, fs, args);
  }) as typeof fs.openSync;
  syncBuiltinESMExports();
  const failed = f.operate({ operation: "create", baseCommit: f.base });
  childProcess.spawnSync = spawn;
  fs.openSync = open;
  syncBuiltinESMExports();
  assert.equal(injected, true);
  assert.equal(failed.status, "blocked");
  assert.equal(failed.gitResult?.status, "completed");
  assert.equal(f.snapshot().workspaces[0]?.phase, "creating");
  assert.equal(fs.existsSync(f.tree), true);
  /**
   * 作成中Workspaceの不適合観測が意図を維持することを確認する。
   * @responsibility 作成中Workspaceの不適合観測が意図を維持することを確認する。
   * @trace PRL-IT-013
   * @precondition dirty・locked・別HEAD・prunableの各反例。
   * @stimulus 作成再入場を呼び現在Snapshotを読む。
   * @observation blocked、固定Baseとpending/headの内容。
   * @oracle 正常readyへ進まず元の作成意図を変えない。
   * @cleanup 各反例の状態を戻してfixtureを回収する。
   * @boundary 実Git観測と既存Writer。新回復機構は作らない。
   */
  const checkStillCreating = () => {
    const refused = f.operate({ operation: "observe" });
    assert.equal(refused.status, "blocked", JSON.stringify(refused));
    assert.equal(f.snapshot().workspaces[0]?.phase, "creating");
    assert.equal(f.snapshot().workspaces[0]?.baseCommit, f.base);
    assert.equal(f.snapshot().workspaces[0]?.pending?.expectedHead, f.base);
  };
  fs.writeFileSync(path.join(f.tree, "source.txt"), "unexpected dirty\n");
  checkStillCreating();
  fs.writeFileSync(path.join(f.tree, "source.txt"), "base\n");
  git(f.root, ["worktree", "lock", f.tree]);
  checkStillCreating();
  git(f.root, ["worktree", "unlock", f.tree]);
  git(f.tree, ["commit", "--allow-empty", "-m", "unexpected head"]);
  checkStillCreating();
  git(f.root, [
    "update-ref",
    `refs/heads/crdd/workspace/${f.common.workspaceId}`,
    f.base,
  ]);
  const movedTree = `${f.tree}-held`;
  fs.renameSync(f.tree, movedTree);
  try {
    checkStillCreating();
  } finally {
    fs.renameSync(movedTree, f.tree);
  }
  const resumed = reenter(f, "observe");
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.equal(f.snapshot().workspaces[0]?.phase, "ready");
  assert.equal(
    fs.existsSync(path.join(f.tree, ".crdd", "orchestrator")),
    false,
  );
  const disposed = reenter(f, "discard");
  assert.equal(disposed.status, "completed", JSON.stringify(disposed));
});

/**
 * 実行前の対象拒否は未委譲として終了する。
 * @responsibility 対象不成立を外部実行不明へ昇格しない。
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @precondition 実WorkspaceとQueue。
 * @stimulus 未準備対象・hold・別Branch・対象欠測・Reader拒否。
 * @observation 下位呼出し、回復ID、Process破棄要求。
 * @oracle 実行0、回復0、Process破棄0、清掃確認。
 * @cleanup 自己生成Rootだけをfixtureで回収。
 * @boundary 実Dispatcher／Writer／Git、Reader拒否だけ代役。
 */
test("Workspace対象拒否はProvider委譲も架空の回復も発行しない", async (t) => {
  for (const mode of [
    "unprepared",
    "hold",
    "branch",
    "missing",
    "reader",
  ] as const) {
    const f = fixture(t);
    const created = f.operate({ operation: "create", baseCommit: f.base });
    assert.equal(
      created.status,
      "completed",
      `${mode}: ${JSON.stringify(created)}`,
    );
    const workspaceTarget = prepareWorkspaceExecutionTarget(
      f.root,
      "project-a",
      f.common.workspaceId,
    );
    assert.ok(workspaceTarget);
    if (mode === "hold")
      assert.equal(
        f.operate({ operation: "hold", until: "2099-01-01T00:00:00Z" }).status,
        "completed",
      );
    if (mode === "branch")
      git(f.tree, ["switch", "-c", "fixture-other-branch"]);
    if (mode === "missing") fs.renameSync(f.tree, `${f.tree}-missing`);
    let calls = 0;
    let readerCalls = 0;
    const original = await import(
      "../../../coordinator/src/lifecycle/workspace.ts"
    );
    const reader =
      mode === "reader"
        ? mock.module(
            new URL(
              "../../../coordinator/src/lifecycle/workspace.ts",
              import.meta.url,
            ).href,
            {
              namedExports: {
                ...original,
                confirmPreparedWorkspaceTarget: (
                  root: string,
                  binding: string,
                  queueId: string,
                ) => {
                  readerCalls++;
                  assert.equal(root, f.ports.workingDirectory);
                  assert.equal(binding, f.ports.repositoryBindingId);
                  assert.equal(queueId, "queue-a");
                  return {
                    status: "blocked",
                    reason: "synthetic_reader_blocked",
                    value: null,
                    manualRecoveryRequired: false,
                    recoveryId: null,
                  };
                },
              },
            },
          )
        : null;
    let outcome: Awaited<ReturnType<typeof runTestCoordinatorOperation>>;
    try {
      const dispatch = runTestCoordinatorOperation;
      outcome = await dispatch(
        {
          persistence: f.ports,
          workspaceTarget: mode === "unprepared" ? null : workspaceTarget,
          runSingleTaskAttempt: async () => {
            calls++;
            throw new Error("must_not_delegate");
          },
        },
        {
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          cancellationSignal: new AbortController().signal,
          taskExecutions: ["task-a", "task-b"].map((taskId) => ({
            taskId,
            authorityBindingId: `authority-${taskId}`,
            taskRequest: {},
            repositoryRoot: f.root,
          })),
        },
      );
    } finally {
      reader?.restore();
    }
    assert.equal(readerCalls, mode === "reader" ? 1 : 0);
    assert.equal(calls, 0, mode);
    assert.equal(outcome.status, "blocked", JSON.stringify(outcome));
    assert.equal(outcome.effectState, "no_effect", JSON.stringify(outcome));
    assert.equal(outcome.cleanupConfirmed, true, JSON.stringify(outcome));
    assert.equal(
      outcome.processRestartRequired,
      false,
      JSON.stringify(outcome),
    );
    assert.deepEqual(outcome.recoveryIds, [], mode);
  }
});

/**
 * 一次保存失敗とLease解放失敗の結果合成だけを反証する。
 * @responsibility 実処理本文で既存回復参照を失わないことを確認する。
 * @trace PRL-IT-013
 * @precondition 本番関数本文を型除去し、境界を有限代役へ接続する。
 * @stimulus 保存拒否Aと解放拒否B、解放拒否単独。
 * @observation 元理由と両参照。
 * @oracle Aを上書きせずBも解放結果として追跡できる。
 * @cleanup N/A: 局所値だけ。
 * @boundary 結果合成の代役試験。実保存・実Leaseの成立根拠にしない。
 */
test("Workspaceの保存失敗と解放失敗は元理由と両回復参照を保持する", () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/service/workspace.ts", import.meta.url),
      "utf8",
    ),
  );
  const start = source.indexOf("export function manageWorkspace(");
  const end = source.indexOf("export function workspaceWorktreeTarget(", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end).replace("export function", "function");
  for (const saveFails of [true, false]) {
    let locations = 0;
    let observations = 0;
    /**
     * 保存または解放失敗のexact回復参照を返す。
     * @responsibility 保存または解放失敗のexact回復参照を返す。
     * @trace PRL-IT-013
     * @precondition 有限reasonと固有recoveryId。
     * @stimulus manualRecoveryRequired付きの保存拒否結果を構築する。
     * @observation 元reason、一次回復IDと解放側回復ID。
     * @oracle 一次失敗を上書きせず副次参照も脱落しない。
     * @cleanup N/A: 故障結果の局所生成だけ。
     * @boundary 既存Store/Lease Portの代役。実回復要求なし。
     */
    const blocked = (reason: string, recoveryId: string) => ({
      status: "blocked",
      reason,
      value: null,
      manualRecoveryRequired: true,
      recoveryId,
    });
    const execute = new Function(
      "getRepository",
      "getWorktree",
      "workspaceWorktreeTarget",
      "workspaceWorktreeResult",
      "beginWorkspaceOperation",
      `${body}\nreturn manageWorkspace;`,
    )(
      (root: string, observation: string) => {
        assert.equal(root, "synthetic");
        assert.equal(observation, "placement");
        locations++;
        return {
          status: "completed",
          capability: {},
          placement: { directory: "confirmed", linked: false },
        };
      },
      () => ({}),
      () => ({}),
      () => ({ status: "completed", observation: null }),
      (directory: { directory: string }) => {
        assert.equal(directory.directory, "confirmed");
        return {
          status: "completed",
          value: {
            generation: 1,
            linkedToProject: true,
            record: { workspaceId: "same-id", generation: 1, phase: "ready" },
            isHeld: () => true,
            save: () => assert.fail("Workspace intent write"),
            saveObservation: () => {
              observations++;
              return saveFails
                ? blocked("save_failed", "recovery-a")
                : { status: "completed", value: {} };
            },
            release: () => blocked("release_failed", "recovery-b"),
          },
        };
      },
    );
    const result = execute({
      operation: "observe",
      ownerRepositoryRoot: "synthetic",
      projectId: "project-a",
      queueId: "queue-a",
      workspaceId: "same-id",
    });
    assert.equal(observations, 1);
    assert.equal(locations, 1);
    assert.equal(result.reason, saveFails ? "save_failed" : "release_failed");
    assert.equal(result.recoveryId, saveFails ? "recovery-a" : "recovery-b");
    assert.equal(result.releaseRecoveryId, "recovery-b");
    assert.equal(result.releaseFailure, "release_failed");
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.leaseReleased, false);
  }
});

import { inspectWorkspaceCommand } from "../../src/service/workspace.ts";
