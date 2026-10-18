/**
 * Workspace操作を実Git・実Snapshot・既存Leaseで結合検証する。
 * @responsibility 複数Task継続、Root分離、明示破棄と再入場。
 * @trace PRL-IT-011
 * @trace PRL-IT-013
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
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
import { promisify } from "node:util";
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
  executeOrchestratorObjective,
  runOrchestratorSingleTaskAttempt,
  executeWorkspaceCommand,
  inspectWorkspaceCommand,
  type WorkspaceView,
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
import { inspectMcpOrchestratorObjectiveResult } from "../../../mcp-server/src/index.ts";
import { workspacePlanReadyForAcceptance } from "../../src/workspace/operations.ts";
import {
  executeOrchestratorPublicAcceptanceDecision,
  executeOrchestratorPublicStateQuery,
} from "../../src/operation-composition.ts";

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
function fixture(t: TestContext, independent = false) {
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
  const binding = deriveOrchestratorRepositoryBindingId(root);
  const initialized = initializeOrchestratorSnapshot(root, binding);
  assert.equal(initialized.status, "completed", JSON.stringify(initialized));
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const created = createOrchestratorState({
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
 * 独立Taskも同じTreeでは順番に実行し、明示Git採用と品質受入を分離する。
 * @trace CPR-IT-001 CPR-IT-004 CPR-IT-006
 * @precondition 自己生成Gitと実Writer。Provider／Dockerは使わない。
 * @stimulus Direct／Isolated、最大並行数3、依存なし二Task、取消と失敗。
 * @observation 稼働最大数、後続の前変更読取り、HEAD／index、品質判断。
 * @oracle 一件終端後だけ次開始、自動Commit0、Isolatedは採用前拒否・Ref終了後も別Process受入。
 * @cleanup fixtureのexact Rootだけ回収する。
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
      const result = await runOrchestratorOperation(
        {
          ...createOrchestratorExecutionHostPorts(),
          persistence: f.ports,
          runSingleTaskAttempt: async (input) => {
            const call = ++calls;
            active++;
            maximum = Math.max(maximum, active);
            assert.equal(input.executionTree, tree);
            assert.equal(await input.observeStarted?.(), true);
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
              contract: "crdd-coordinator/orchestrator-single-task-adapter",
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
                workspaceId: input.workspaceId ?? null,
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
      const decide = async (separate = false) => {
        const plan = f.snapshot().projects[0];
        assert.ok(plan);
        const input = {
          contract: "crdd-coordinator/orchestrator-acceptance-decision/v1",
          decisionId: "quality-objective",
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
          return executeOrchestratorPublicAcceptanceDecision(
            () => ({ status: "completed", principalId: "principal-a" }),
            input,
            f.root,
            { principalId: "principal-a" },
          );
        const entry = pathToFileURL(
          path.resolve(
            import.meta.dirname,
            "../../src/operation-composition.ts",
          ),
        ).href;
        return JSON.parse(
          (
            await promisify(childProcess.execFile)(
              process.execPath,
              [
                "-e",
                `import {executeOrchestratorPublicAcceptanceDecision as run} from ${JSON.stringify(entry)}; console.log(JSON.stringify(run(()=>({status:'completed',principalId:'principal-a'}),${JSON.stringify(input)},${JSON.stringify(f.root)},{principalId:'principal-a'})));`,
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
              executeWorkspaceCommand(
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
      const query = executeOrchestratorPublicStateQuery(
        () => ({ status: "completed", principalId: "principal-a" }) as never,
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
  const call = (command: Record<string, unknown>) =>
    executeWorkspaceCommand(
      f.root,
      "project-a",
      { ...common, ...command },
      () => true,
    ).data as {
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
      executeWorkspaceCommand(
        f.root,
        "project-a",
        {
          ...common,
          operation: "create",
          expectedGeneration: 0,
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
      executeWorkspaceCommand(
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
  assert.equal(stale.reason, "orchestrator_workspace_generation_conflict");
  fs.writeFileSync(path.join(f.tree, "source.txt"), "selected\n");
  const preview = executeWorkspaceCommand(
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
  const patch = executeWorkspaceCommand(
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
        "orchestrator_candidate_input_invalid",
      );
      assert.equal(f.snapshot().workspaces[0]?.candidate, null);
    }
    fs.writeFileSync(
      path.join(f.tree, "source.txt"),
      "changed after confirmation\n",
    );
    const failed = f.operate(input);
    assert.equal(failed.reason, "candidate_content_changed");
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
        "candidate_content_changed",
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
      path.resolve(import.meta.dirname, "../../src/index.ts"),
    ).href;
    const script = `import(${JSON.stringify(module)}).then(({manageOrchestratorWorkspace})=>process.stdout.write(JSON.stringify(manageOrchestratorWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
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
      path.resolve(import.meta.dirname, "../../src/index.ts"),
    ).href;
    const script = `import(${JSON.stringify(module)}).then(({manageOrchestratorWorkspace})=>process.stdout.write(JSON.stringify(manageOrchestratorWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
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
    path.resolve(import.meta.dirname, "../../src/index.ts"),
  ).href;
  const diagnostic = `Promise.all([import(${JSON.stringify(module)}),import('node:child_process'),import('node:module')]).then(([m,cp,modules])=>{const original=cp.default.spawnSync;cp.default.spawnSync=(...args)=>Array.isArray(args[1])&&args[1].includes('rev-parse')&&args[1].includes(${JSON.stringify(ref)})?{pid:0,status:1,signal:null,stdout:'synthetic',stderr:'',output:[null,'synthetic','']}:Reflect.apply(original,cp.default,args);modules.syncBuiltinESMExports();process.stdout.write(JSON.stringify(m.manageOrchestratorWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true})));});`;
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
    "candidate_ref_mismatch",
  );
  assert.equal(JSON.stringify(f.snapshot().results), original);
  const script = `import(${JSON.stringify(module)}).then(({manageOrchestratorWorkspace})=>process.stdout.write(JSON.stringify(manageOrchestratorWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
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
 * @boundary 本番Orchestrator／VC／保存。Providerなし。
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
  assert.equal(
    f.operate({ ...adoption, authorize: () => false }).reason,
    "orchestrator_candidate_not_authorized",
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  const merged = f.operate(adoption);
  assert.equal(merged.status, "completed", JSON.stringify(merged));
  const head = git(f.root, ["rev-parse", "HEAD"]);
  assert.equal(
    git(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
    `${head} ${f.base} ${commit}`,
  );
  assert.ok(
    git(f.root, ["log", "-1", "--format=%B"]).includes("Workspace: 元の作業名"),
  );
  assert.equal(f.snapshot().workspaces[0]?.name, "次の作業名");
  assert.equal(
    f.operate(adoption).candidateResult?.reason,
    "candidate_merge_existing",
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
    "orchestrator_candidate_still_referenced",
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
  assert.equal(failed.candidateResult?.reason, "candidate_merged");
  const head = git(f.root, ["rev-parse", "HEAD"]);
  assert.equal(f.snapshot().workspaces[0]?.candidate?.phase, "merging");
  const module = pathToFileURL(
    path.resolve(import.meta.dirname, "../../src/index.ts"),
  ).href;
  const script = `import(${JSON.stringify(module)}).then(({manageOrchestratorWorkspace})=>process.stdout.write(JSON.stringify(manageOrchestratorWorkspace({...JSON.parse(process.argv[1]),authorize:()=>true}))));`;
  const resumed = JSON.parse(
    execFileSync(
      process.execPath,
      ["-e", script, JSON.stringify({ ...f.common, ...request })],
      { encoding: "utf8", timeout: 60_000, windowsHide: true },
    ),
  );
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.equal(resumed.candidateResult.reason, "candidate_merge_existing");
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
  const before = f.snapshot();
  const workspace = before.workspaces[0];
  const candidate = workspace?.candidate;
  assert.ok(workspace && candidate);
  const target = { targetBranch: "main", expectedTargetHead: f.base };
  for (const invalid of [
    { ...candidate, target },
    { ...candidate, disposition: "adopted" },
    { ...candidate, candidateCommit: null },
    { ...candidate, lastResult: null },
    { ...candidate, phase: "merged", disposition: "adopted", target },
    {
      ...candidate,
      lastResult: { ...candidate.lastResult, candidateCommit: f.base },
    },
  ]) {
    const attempted: unknown = {
      ...before,
      snapshotRevision: before.snapshotRevision + 1,
      workspaces: [{ ...workspace, candidate: invalid }],
    };
    assert.equal(
      writeOrchestratorSnapshot(
        f.root,
        f.binding,
        JSON.stringify(attempted),
        before.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.deepEqual(f.snapshot(), before);
  }
  const pending: unknown = {
    ...before,
    snapshotRevision: before.snapshotRevision + 1,
    workspaces: [
      { ...workspace, candidate: { ...candidate, phase: "merging", target } },
    ],
  };
  assert.equal(
    writeOrchestratorSnapshot(
      f.root,
      f.binding,
      JSON.stringify(pending),
      before.snapshotRevision,
    ).status,
    "completed",
  );
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
          workspaceResult: {
            workspaceId: input.workspaceId ?? null,
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
  assert.equal(unavailable.reason, "single_task_workspace_target_invalid");
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
 * Directの対象解決と途中失敗まで観測を搬送する。
 * @responsibility Workspace ID省略をnullと照合し既得観測を落とさない。
 * @trace PRL-IT-012 PRL-IT-013
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
    const outcome = await runOrchestratorOperation(
      {
        ...createOrchestratorExecutionHostPorts(),
        persistence: f.ports,
        runSingleTaskAttempt: async (input) => {
          calls++;
          assert.equal(input.workspaceId, null);
          assert.equal(input.executionTree, f.root);
          assert.equal(await input.observeStarted?.(), true);
          fs.writeFileSync(path.join(f.root, "source.txt"), "direct-" + calls);
          return {
            contract: "crdd-coordinator/orchestrator-single-task-adapter",
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
          authorityBindingId: "authority-" + taskId,
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
            queueEntries: [
              {
                queueId: "queue-a",
                projectId: "project-a",
                workspaceId: "same-id",
              },
            ],
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
      projectId: "project-a",
      queueId: "queue-a",
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

/**
 * 実受付・Dispatcherの変更観測をObjectiveとMCPへ引き渡す。
 * @responsibility 中間Envelopeが観測を落とす回帰を検出する。
 * @trace PRL-IT-012
 * @precondition 自己生成Gitと実Writer、Providerのみ有限代役。
 * @stimulus 新規受付からDirectの二Taskを実行する。
 * @observation Task／Attempt／Operation、変更Path、現在Queue、MCP投影。
 * @oracle 変更観測二件を保持し、Git採用・旧Bundle生成は行わない。
 * @cleanup fixtureのafterがRootを回収し不存在を確認する。
 * @boundary 実Git・受付・Writer・Dispatcher・公開結果。
 */
test("実Objective受付はWorkspace観測をMCPまで欠落なく渡す", async (t) => {
  const owner = fixture(t);
  const root = path.join(owner.root, "objective");
  fs.mkdirSync(root);
  git(root, ["init", "--initial-branch=main", "--template="]);
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "");
  git(root, ["config", "user.name", "Workspace Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n");
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  const binding = deriveOrchestratorRepositoryBindingId(root);
  const initialized = initializeOrchestratorSnapshot(root, binding);
  assert.equal(initialized.status, "completed", JSON.stringify(initialized));
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const f = {
    root,
    binding,
    base,
    ports: createOrchestratorSnapshotPersistencePorts(
      root,
      binding,
      initialized.value,
    ),
    snapshot: () => {
      const read = readOrchestratorSnapshot(root, binding);
      if (read.status !== "completed" || !read.value)
        throw new Error("fixture_read_failed");
      return read.value;
    },
  };
  const initial = f.snapshot();
  const state = owner.snapshot().projects[0];
  assert.ok(state);
  let calls = 0;
  const result = await executeOrchestratorObjective(
    {
      authenticatedPrincipalId: "principal-a",
      repositoryBindingId: f.binding,
      repositoryRoot: f.root,
      plan: {
        milestoneAcceptanceCriteria: state.milestone.acceptanceCriteria,
        objectives: state.objectives.map((entry) => entry.definition),
        tasks: state.tasks.map((entry) => entry.definition),
      },
      persistence: f.ports,
      ...createOrchestratorExecutionHostPorts(),
      taskRecovery: {
        resolveCorrelations: () => null,
        recover: () => {
          throw new Error("unexpected_recovery");
        },
        acknowledgeDocker: () => {
          throw new Error("unexpected_docker");
        },
        finalizeDockerAcknowledgement: () => {
          throw new Error("unexpected_docker");
        },
        observeTransition: () => {},
      },
      createTaskExecutions: () =>
        state.tasks.map((entry) => ({
          taskId: entry.definition.id,
          taskRequest: { synthetic: true },
          repositoryRoot: f.root,
        })),
      observeLeaseOwner: () => ({ status: "unknown" }),
      execution: {
        runSingleTaskAttempt: async (input) => {
          calls++;
          assert.equal(input.executionTree, f.root);
          assert.equal(await input.observeStarted?.(), true);
          fs.writeFileSync(
            path.join(f.root, "source.txt"),
            `observed-${calls}\n`,
          );
          return {
            contract: "crdd-coordinator/orchestrator-single-task-adapter",
            attemptId: input.attemptId,
            operationId: input.operationId,
            authorityBindingId: input.authorityBindingId,
            repositoryRevision: input.repositoryRevision,
            status: "completed",
            reason: "synthetic_complete",
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
    },
    {
      intakeEpoch: initial.intakeEpoch,
      requestId: "request-observation",
      projectId: "project-a",
      milestoneId: "milestone-a",
      repositoryRevision: f.base,
      objective: "synthetic direct edit",
      acceptanceCriteria: ["done"],
      allowedPaths: ["source.txt"],
      readPaths: ["source.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      adoptResult: false,
    },
    new AbortController().signal,
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(calls, 2);
  assert.equal(result.workspaceResults?.length, 2);
  const projected = inspectMcpOrchestratorObjectiveResult(result);
  assert.ok(projected, JSON.stringify(result));
  assert.equal(projected.status, "blocked");
  assert.equal(projected.reason, result.reason);
  assert.equal(projected.cleanupConfirmed, true);
  assert.deepEqual(projected.workspaceResults, result.workspaceResults);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.equal(f.snapshot().queueEntries[0]?.state, "integration_pending");
});
