/**
 * MCP Runtime活動Adapterの開始済みReader終了を検証する。
 * @packageDocumentation
 * @responsibility 開始済みReaderのjoinと、実ObjectiveのWorkspace観測をMCPへ搬送する。
 * @trace EST-IT-014
 * @trace PRL-IT-012
 * @level IT
 * @scope Reader取消・完了、配布入口のSource接続、実Git／保存／Objectiveの結果投影。
 * @boundary MCP Routing→活動Reader。旧CROS資格・Gatewayは使わない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { verifyRuntimePersistenceRepository } from "../../../coordinator/src/execution/persistence.ts";
import { executeCoordinatorObjective } from "../../../coordinator/src/objective/execute.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../../../coordinator/src/state/transaction.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../../coordinator/src/state/validation.ts";
import { createCoordinatorExecutionHostPorts } from "../../../coordinator/src/task/dispatch.ts";
import { taskExecutionSelections } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import {
  fixture,
  git,
  readFixtureSnapshot,
} from "../../../coordinator/tests/fixtures/workspace-surface.ts";
import { initializeExecutionStore } from "../../../execution-model/src/index.ts";
import { withCallerPlan } from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  getMcpExecutionStatusToolDefinitions,
  inspectMcpCoordinatorObjectiveResult,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  MCP_EXECUTION_STATUS_TOOL,
} from "../../src/index.ts";
import { invokeMcpRequest } from "../fixtures/sdk-request.ts";

/**
 * 配布MCP入口がCoordinatorの公開Rootへ直接接続することを確認する。
 * @responsibility 呼出し先のOwner迂回を検出する。
 * @trace PRL-IT-012
 * @precondition Repository内の現行Sourceが読取り可能である。
 * @stimulus 配布MCP入口のSourceを読み取る。
 * @observation CoordinatorのModule specifierを取得する。
 * @oracle 統合Rootへの接続を維持する。
 * @cleanup N/A: Sourceの読取りのみ。
 * @boundary 配布MCP入口→Coordinator公開入口のSource配線。
 */
test("配布MCP入口は業務Ownerへ直接接続する", () => {
  const source = fs.readFileSync(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /coordinator\/src\/index\.ts/);
});

/**
 * 実行状況Toolの現行名だけを公開・受付することを検証する。
 * @responsibility 通信名の変更と旧名でのReader非実行を確認する。
 * @trace EST-IT-014
 * @precondition 認可済み読取り依存と有効なMCP metadataを用意する。
 * @stimulus 一覧を取得し、旧名と新名で同じ引数を送る。
 * @observation 公開名、旧名拒否、Reader呼出し数と新名の結果を観測する。
 * @oracle 新名だけを公開し、旧名は-32601かつReader零回、新名は一回呼ぶ。
 * @cleanup N/A: 永続状態・外部資源を生成しない。
 * @boundary MCP公開名とCoordinator Readerの境界。
 */
test("実行状況MCPは新Tool名だけを公開・受付する", async () => {
  assert.equal(MCP_EXECUTION_STATUS_TOOL, "crdd.get_execution_status");
  assert.deepEqual(
    getMcpExecutionStatusToolDefinitions().map((tool) => tool.name),
    ["crdd.get_execution_status"],
  );
  let reads = 0;
  const dependencies = {
    projectContext: {
      readPortfolio: async () => ({
        projects: [],
        retainedAsSourceOfTruth: false as const,
      }),
    },
    runtimeActivity: {
      read: async () => {
        reads += 1;
        return null;
      },
    },
  };
  /**
   * Tool名だけが異なる同一条件の要求を構築する。
   * @responsibility 改名以外の入力条件を固定する。
   * @trace EST-IT-014
   * @precondition Tool名を指定する。
   * @stimulus 固定metadataとprojectIdを付与する。
   * @observation 返された要求をRoutingへ渡す。
   * @oracle Tool名以外の要求内容は同一である。
   * @cleanup N/A: 値だけを構築する。
   * @boundary 試験入力の構築境界。
   */
  const request = (name: string) => ({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name,
      arguments: { projectId: "PRJ-MCP" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  });
  const signal = new AbortController().signal;
  const old = await invokeMcpRequest(
    request("crdd.get_runtime_activity"),
    dependencies,
    signal,
  );
  assert.ok("error" in old);
  assert.equal(old.error.code, -32601);
  assert.equal(reads, 0);
  const current = await invokeMcpRequest(
    request("crdd.get_execution_status"),
    dependencies,
    signal,
  );
  assert.ok("result" in current);
  assert.equal(reads, 1);
});

/**
 * Runtime活動の読取り中取消をjoin後に返すことを検証する。
 *
 * @responsibility 取消応答と読取り完了を混同しないProtocol境界を確認する。
 * @trace EST-IT-014
 * @precondition 解放まで保留するReaderとAbortControllerを用意する。
 * @stimulus Tool開始後に取消し、その後Readerを解放する。
 * @observation 応答保留、Reader完了と取消結果を確認する。
 * @oracle Reader完了前に結果を返さず、完了後-32800を返す。
 * @cleanup 保留gateをfinallyで解放し、開始済みPromiseをjoinする。
 * @boundary MCP Adapterと非取消Readerの境界。
 */
test("Runtime活動MCPは開始済みReaderをjoinしてから取消を返す", async () => {
  const controller = new AbortController();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let readStarted = false;
  let markStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let readCompleted = false;
  let responseSettled = false;
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: MCP_EXECUTION_STATUS_TOOL,
      arguments: { projectId: "PRJ-MCP" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  let cancelledReadCount = 0;
  const refused = await invokeMcpRequest(
    request,
    {
      projectContext: {
        readPortfolio: async () => ({
          projects: [],
          retainedAsSourceOfTruth: false,
        }),
      },
      runtimeActivity: {
        read: async () => {
          cancelledReadCount += 1;
          return null;
        },
      },
    },
    alreadyCancelled.signal,
  );
  assert.ok("error" in refused);
  assert.equal(refused.error.code, -32800);
  assert.equal(cancelledReadCount, 0);
  const pending = invokeMcpRequest(
    request,
    {
      projectContext: {
        readPortfolio: async () => ({
          projects: [],
          retainedAsSourceOfTruth: false,
        }),
      },
      runtimeActivity: {
        read: async () => {
          readStarted = true;
          markStarted();
          await gate;
          readCompleted = true;
          return null;
        },
      },
    },
    controller.signal,
  );
  void pending.then(() => {
    responseSettled = true;
  });
  try {
    await started;
    assert.equal(readStarted, true);
    controller.abort();
    await Promise.resolve();
    assert.equal(responseSettled, false);
    assert.equal(readCompleted, false);
    release();
    const reply = await pending;
    assert.equal(readCompleted, true);
    assert.ok("error" in reply);
    assert.equal(reply.error.code, -32800);
  } finally {
    release();
    await pending;
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
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const initialized = initializeExecutionStore(
    verifyRuntimePersistenceRepository(root),
    binding,
  );
  assert.equal(initialized.status, "completed", JSON.stringify(initialized));
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const f = {
    root,
    binding,
    base,
    ports: createCoordinatorSnapshotPersistencePorts(
      root,
      binding,
      initialized.value,
    ),
    snapshot: () => {
      const read = readFixtureSnapshot(root, binding);
      if (read.status !== "completed" || !read.value)
        throw new Error("fixture_read_failed");
      return read.value;
    },
  };
  const initial = f.snapshot();
  const state = owner.snapshot().projects[0];
  assert.ok(state);
  let calls = 0;
  const result = await executeCoordinatorObjective(
    {
      authenticatedPrincipalId: "principal-a",
      resolveTaskSelections: () => ({
        status: "resolved" as const,
        value: taskExecutionSelections(),
        reason: null,
      }),
      repositoryBindingId: f.binding,
      repositoryRoot: f.root,
      plan: {
        milestoneAcceptanceCriteria: state.milestone.acceptanceCriteria,
        objectives: state.objectives.map((entry) => entry.definition),
        tasks: state.tasks.map((entry) => entry.definition),
      },
      persistence: f.ports,
      ...createCoordinatorExecutionHostPorts(),
      taskRecovery: {
        resolveCorrelations: () => null,
        recover: () => {
          throw new Error("unexpected_recovery");
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
          assert.equal(await input.observeStarted?.(), undefined);
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
    withCallerPlan({
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
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(calls, 2);
  assert.equal(result.workspaceResults?.length, 2);
  const projected = inspectMcpCoordinatorObjectiveResult(result);
  assert.ok(projected, JSON.stringify(result));
  assert.equal(projected.status, "blocked");
  assert.equal(projected.reason, result.reason);
  assert.equal(projected.cleanupConfirmed, true);
  assert.deepEqual(projected.workspaceResults, result.workspaceResults);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.equal(f.snapshot().queueEntries[0]?.state, "integration_pending");
});
