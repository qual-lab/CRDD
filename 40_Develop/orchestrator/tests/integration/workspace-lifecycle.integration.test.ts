/**
 * Workspace操作を実Git・実Snapshot・既存Leaseで結合検証する。
 * @responsibility 複数Task継続、Root分離、明示破棄と再入場。
 * @trace PRL-IT-011
 * @trace PRL-IT-013
 * @level IT
 * @scope OrchestratorとVersion Control。AIは合成作業のみ。
 * @boundary 実Filesystem／Git／既存操作Lease。Provider・Dockerなし。
 */
import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import { devNull } from "node:os";
import { pathToFileURL } from "node:url";
import test, { type TestContext } from "node:test";
import {
  createOrchestratorState,
  initializeOrchestratorSnapshot,
  manageOrchestratorWorkspace,
  resolveOrchestratorWorkspaceTaskTarget,
  reserveProjectTaskStart,
  prepareProjectTaskHandoff,
  observeProjectTaskStarted,
  settleProjectTask,
  runOrchestratorOperation,
  createOrchestratorExecutionHostPorts,
  runOrchestratorSingleTaskAttempt,
} from "../../src/index.ts";
import {
  readOrchestratorSnapshot,
  writeOrchestratorSnapshotState,
  createOrchestratorSnapshotPersistencePorts,
  acquireOrchestratorSnapshotLease,
  writeOrchestratorSnapshot,
} from "../../src/storage/current-state.ts";
import { deriveOrchestratorRepositoryBindingId } from "../../src/identity/repository-binding.ts";
import type { OrchestratorWorkspaceRequest } from "../../src/index.ts";

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
function git(root: string, args: string[]) {
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
 * @precondition Repository-local tests領域が実Directory。
 * @stimulus 新品Snapshot初期化と二Task計画。
 * @observation 世代・Queue・受付と固定Commit。
 * @oracle 全保存を読戻せる。
 * @cleanup 自己生成Rootだけを削除し不存在確認。
 * @boundary 実Git・Filesystem・既存Native排他。
 */
function fixture(t: TestContext) {
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
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  const binding = deriveOrchestratorRepositoryBindingId(root);
  const initialized = initializeOrchestratorSnapshot(root, binding);
  assert.equal(initialized.status, "completed", JSON.stringify(initialized));
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const created = createOrchestratorState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: base,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["done"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: ["task-a", "task-b"].map((id, index) => ({
      id,
      objectiveId: "objective-a",
      dependencies: index ? ["task-a"] : [],
      allowedPaths: ["source.txt"],
      conflictKeys: ["same-file"],
    })),
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  assert.equal(
    writeOrchestratorSnapshotState(
      root,
      binding,
      JSON.stringify(created.state),
      0,
    ).status,
    "completed",
  );
  const ports = createOrchestratorSnapshotPersistencePorts(
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
    operation: Omit<OrchestratorWorkspaceRequest, keyof typeof common> &
      Record<string, unknown>,
  ) =>
    manageOrchestratorWorkspace({
      ...common,
      ...operation,
    } as OrchestratorWorkspaceRequest);
  const snapshot = () => {
    const read = readOrchestratorSnapshot(root, binding);
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
    path.resolve(import.meta.dirname, "../../src/index.ts"),
  ).href;
  const script = `import(${JSON.stringify(module)}).then(({manageOrchestratorWorkspace})=>process.stdout.write(JSON.stringify(manageOrchestratorWorkspace(JSON.parse(process.argv[1])))));`;
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
  const created = f.operate({ operation: "create", baseCommit: f.base });
  assert.equal(created.status, "completed", JSON.stringify(created));
  for (const taskId of ["task-a", "task-b"]) {
    const target = resolveOrchestratorWorkspaceTaskTarget(
      f.root,
      f.binding,
      "queue-a",
    );
    assert.equal(target.status, "completed");
    if (target.status !== "completed") return;
    assert.equal(target.value.ownerRepositoryRoot, f.root);
    assert.equal(target.value.executionTree, f.tree);
    const initialState = f.snapshot().projects[0];
    assert.ok(initialState);
    let state = initialState;
    const save = (next: ReturnType<typeof reserveProjectTaskStart>) => {
      assert.equal(next.status, "completed", JSON.stringify(next));
      assert.ok(next.state);
      assert.equal(
        writeOrchestratorSnapshotState(
          f.root,
          f.binding,
          JSON.stringify(next.state),
          state.generation,
        ).status,
        "completed",
      );
      state = next.state;
    };
    save(
      reserveProjectTaskStart(
        state,
        state.generation,
        taskId,
        `attempt-${taskId}`,
        `authority-${taskId}`,
      ),
    );
    save(
      prepareProjectTaskHandoff(
        state,
        state.generation,
        taskId,
        `attempt-${taskId}`,
        `operation-${taskId}`,
      ),
    );
    save(
      observeProjectTaskStarted(
        state,
        state.generation,
        taskId,
        `attempt-${taskId}`,
        `operation-${taskId}`,
      ),
    );
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
    save(
      settleProjectTask(state, state.generation, {
        taskId,
        attemptId: `attempt-${taskId}`,
        operationId: `operation-${taskId}`,
        authorityBindingId: `authority-${taskId}`,
        outcome: "completed",
        cleanupConfirmed: true,
        recoveryUnresolved: false,
        recoveryObligations: [],
      }),
    );
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
    "orchestrator_workspace_held",
  );
  assert.equal(
    f.operate({ operation: "hold", until: null }).status,
    "completed",
  );
  assert.equal(
    f.operate({ operation: "adopted" }).reason,
    "orchestrator_workspace_adoption_not_connected",
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
  const lease = acquireOrchestratorSnapshotLease(
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
  assert.equal(lease.value.release().status, "completed");
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
 * 新Snapshotは旧形式を補完せず拒否する。
 * @responsibility 新しい現在集合の欠落を暗黙初期化にしない。
 * @trace PRL-IT-013
 * @precondition 新品の実Store。
 * @stimulus 旧schemaとworkspaces欠落の保存要求。
 * @observation 拒否と元Snapshot。
 * @oracle 改訂・現在値不変。
 * @cleanup fixtureのafter。
 * @boundary 実Snapshot codec／Writer。
 */
test("旧SnapshotとWorkspace集合欠落を補完しない", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  const old = {
    ...before,
    schema: "crdd-coordinator/orchestrator-snapshot/v2",
    schemaRevision: 2,
    snapshotRevision: before.snapshotRevision + 1,
  };
  assert.equal(
    writeOrchestratorSnapshot(
      f.root,
      f.binding,
      JSON.stringify(old),
      before.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.deepEqual(f.snapshot(), before);
  const { workspaces: _removed, ...missing } = before;
  assert.equal(
    writeOrchestratorSnapshot(
      f.root,
      f.binding,
      JSON.stringify({
        ...missing,
        snapshotRevision: before.snapshotRevision + 1,
      }),
      before.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.deepEqual(f.snapshot(), before);
});

/**
 * 本番Dispatcherから有限AI代役へ選択Treeと所属Rootを搬送する。
 * @responsibility 新型を置くだけでなく実Task搬送箇所を結合する。
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @precondition 実Git・実state・既存Lease。
 * @stimulus 既存の二Task実行と未接続Coordinatorの拒否。
 * @observation 代役入力、状態、Tree、Provider依存への接触。
 * @oracle 二Taskが同Tree、保存は所属Root、実Provider依頼0。
 * @cleanup fixtureのafter。
 * @boundary Dispatcherは実装、外部AIだけ有限代役。
 */
test("本番Task搬送は所属Rootと選択Treeを分離し未接続Providerを起動しない", async (t) => {
  const f = fixture(t);
  assert.equal(
    f.operate({ operation: "create", baseCommit: f.base }).status,
    "completed",
  );
  let calls = 0;
  const outcome = await runOrchestratorOperation(
    {
      ...createOrchestratorExecutionHostPorts(),
      persistence: f.ports,
      runSingleTaskAttempt: async (input) => {
        calls++;
        assert.equal(input.workspaceId, f.common.workspaceId);
        assert.equal(input.ownerRepositoryRoot, f.root);
        assert.equal(input.executionTree, f.tree);
        assert.equal(input.workspaceHead, f.base);
        assert.equal(input.workspaceBaseCommit, f.base);
        assert.equal(await input.observeStarted?.(), true);
        fs.writeFileSync(
          path.join(input.executionTree, "source.txt"),
          `task-${calls}\n`,
        );
        return {
          contract: "crdd-coordinator/orchestrator-single-task-adapter",
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
  assert.equal(f.snapshot().queueEntries[0]?.state, "integration_pending");
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "base\n",
  );
  assert.equal(
    fs.existsSync(path.join(f.tree, ".crdd", "orchestrator")),
    false,
  );
  const unavailable = await runOrchestratorSingleTaskAttempt(
    new Proxy({} as Parameters<typeof runOrchestratorSingleTaskAttempt>[0], {
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
      workspaceId: f.common.workspaceId,
      executionTree: f.tree,
      ownerRepositoryRoot: f.root,
      cancellationSignal: new AbortController().signal,
    },
  );
  assert.equal(
    unavailable.reason,
    "single_task_workspace_execution_not_connected",
  );
  assert.equal(unavailable.effectState, "no_effect");
  const prior = f.snapshot();
  const terminalQueues = ["completed", "cancelled"].map((state) => ({
    ...prior.queueEntries[0],
    queueId: `prior-${state}`,
    state,
  }));
  assert.equal(
    writeOrchestratorSnapshot(
      f.root,
      f.binding,
      JSON.stringify({
        ...prior,
        snapshotRevision: prior.snapshotRevision + 1,
        intakeBindings: [
          ...prior.intakeBindings,
          ...terminalQueues.map((entry) => ({
            queueId: entry.queueId,
            epoch: prior.intakeEpoch,
          })),
        ],
        queueEntries: [...prior.queueEntries, ...terminalQueues],
      }),
      prior.snapshotRevision,
    ).status,
    "completed",
  );
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
 * @stimulus hold・別HEAD・対象欠測・Reader拒否。
 * @observation 下位呼出し、回復ID、Process破棄要求。
 * @oracle 実行0、回復0、Process破棄0、清掃確認。
 * @cleanup 自己生成Rootだけをfixtureで回収。
 * @boundary 実Dispatcher／Writer／Git、Reader拒否だけ代役。
 */
test("Workspace対象拒否はProvider委譲も架空の回復も発行しない", async (t) => {
  for (const mode of ["hold", "head", "missing", "reader"] as const) {
    const f = fixture(t);
    assert.equal(
      f.operate({ operation: "create", baseCommit: f.base }).status,
      "completed",
    );
    if (mode === "hold")
      assert.equal(
        f.operate({ operation: "hold", until: "2099-01-01T00:00:00Z" }).status,
        "completed",
      );
    if (mode === "head")
      git(f.tree, ["commit", "--allow-empty", "-m", "changed"]);
    if (mode === "missing") fs.renameSync(f.tree, `${f.tree}-missing`);
    let calls = 0;
    const outcome = await runOrchestratorOperation(
      {
        ...createOrchestratorExecutionHostPorts(),
        persistence:
          mode === "reader"
            ? {
                ...f.ports,
                state: {
                  ...f.ports.state,
                  readWorkspaceTaskTarget: () => ({
                    status: "blocked",
                    reason: "synthetic_reader_blocked",
                    value: null,
                    manualRecoveryRequired: false,
                    recoveryId: null,
                  }),
                },
              }
            : f.ports,
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
      new URL("../../src/workspace/operations.ts", import.meta.url),
      "utf8",
    ),
  );
  const start = source.indexOf("export function manageOrchestratorWorkspace(");
  const end = source.indexOf(
    "export function resolveOrchestratorWorkspaceTaskTarget(",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end).replace("export function", "function");
  for (const saveFails of [true, false]) {
    let reads = 0;
    const blocked = (reason: string, recoveryId: string) => ({
      status: "blocked",
      reason,
      value: null,
      manualRecoveryRequired: true,
      recoveryId,
    });
    const execute = new Function(
      "verifyRepositoryRoot",
      "inspectGitRepositoryLayoutCandidate",
      "readOrchestratorSnapshot",
      "acquireOrchestratorSnapshotLease",
      "writeOrchestratorWorkspaceRecord",
      `${body}\nreturn manageOrchestratorWorkspace;`,
    )(
      () => ({ status: "completed", capability: {} }),
      () => ({ status: "candidate", layout: { kind: "main" } }),
      () => {
        reads++;
        return {
          status: "completed",
          value: {
            workspaces: [
              { workspaceId: "same-id", generation: 1, phase: "ready" },
            ],
          },
        };
      },
      () => ({
        status: "completed",
        value: {
          ownerGeneration: "owner",
          release: () => blocked("release_failed", "recovery-b"),
        },
      }),
      () =>
        saveFails
          ? blocked("save_failed", "recovery-a")
          : { status: "completed", value: {} },
    );
    const result = execute({
      operation: "hold",
      until: null,
      ownerRepositoryRoot: "synthetic",
      workspaceId: "same-id",
    });
    assert.equal(reads, 2);
    assert.equal(result.reason, saveFails ? "save_failed" : "release_failed");
    assert.equal(result.recoveryId, saveFails ? "recovery-a" : "recovery-b");
    assert.equal(result.releaseRecoveryId, "recovery-b");
    assert.equal(result.releaseFailure, "release_failed");
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.leaseReleased, false);
  }
});
