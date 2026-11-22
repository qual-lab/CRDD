/**
 * mcp:unit:orchestratorの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:unit:orchestratorが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @trace PRL-UT-014
 * @level UT
 * @scope mcp、project、runtime、adapter、protocol
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。 / PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compileFunction } from "node:vm";
import * as automation from "@qual-lab/crdd-server/automation";
import {
  describeMcpCoordinatorAdapterContract,
  handleMcpCoordinatorRequest,
  MCP_COORDINATOR_DECISION_TOOL,
  MCP_COORDINATOR_OBJECTIVE_TOOL,
  MCP_COORDINATOR_STATE_TOOL,
  type McpCoordinatorDependencies,
} from "@qual-lab/crdd-server/automation";
import {
  createRuntimeProcessRecoveryIdentity,
  observeObjectiveLeaseOwner,
} from "../../../coordinator/src/lifecycle/host.ts";
import {
  inspectCoordinatorDecisionResult,
  inspectCoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveResult,
  inspectWorkspaceCommand,
} from "../../../coordinator/src/index.ts";
import { createCoordinatorObjectiveResult } from "../../../coordinator/src/lifecycle/execution.ts";
import {
  inspectTaskStartCandidates,
  projectCoordinatorState,
} from "../../../coordinator/src/lifecycle/validation.ts";
import { taskExecutionSelections } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { inspectTaskExecutionSelections } from "../../../execution-model/src/index.ts";
import {
  projectExecutionFixture,
  withCallerPlan,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { MCP_COORDINATOR_PROTOCOL_VERSION } from "../../src/mcp/core.ts";
import { protocolError } from "../../src/mcp/request-validation.ts";

const revision = "a".repeat(40);

/**
 * 候補不明の公開停止をMCPでも欠落なく搬送する。
 * @trace PRL-UT-014
 * @precondition 回復ID二件と再起動必要性を持つProducer結果だけを使う。
 * @stimulus 認証済みの有限Adapterへ停止結果を返す。
 * @observation ID・種別・不明・清掃未確認・手動確認必要。
 * @oracle 内部の候補情報を公開せず、元の回復事実を失わない。
 * @cleanup メモリのみ。
 */
test("MCPは候補不明の停止でもexact回復情報と再起動必要性を保持する", async () => {
  const dockerId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const processId = createRuntimeProcessRecoveryIdentity(
    "attempt",
    "operation",
  );
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({
      runObjective: async (input) => {
        const parsed = inspectCoordinatorObjectiveRequest(input);
        assert.ok(parsed);
        return createCoordinatorObjectiveResult(parsed, {
          status: "blocked",
          reason: "orchestrator_state_observation_unknown",
          projection: null,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          recoveryIds: [dockerId, processId],
          recoveryObligations: [
            { kind: "docker", recoveryId: dockerId },
            { kind: "runtime_process", recoveryId: processId },
          ],
          effectState: "unknown",
        });
      },
    }),
    new AbortController().signal,
  );
  assert.equal(response.error, undefined);
  const result = (
    response.result as {
      structuredContent: ReturnType<typeof createCoordinatorObjectiveResult>;
    }
  ).structuredContent;
  assert.deepEqual(result.recoveryIds, [dockerId, processId]);
  assert.deepEqual(result.recoveryObligations, [
    { kind: "docker", recoveryId: dockerId },
    { kind: "runtime_process", recoveryId: processId },
  ]);
  assert.equal(result.effectState, "unknown");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.processRestartRequired, true);
  assert.equal(Object.hasOwn(result, "taskStartCandidates"), false);
});

/**
 * @trace PRL-UT-014
 * @precondition 判断結果とCandidate終了の正常な文字列入力を構築する。
 * @stimulus effectState／dispositionへ変換hook付きObjectとProxyを与える。
 * @observation 値拒否、未知コード実行0と正常入力の維持。
 * @oracle 不正な型を正しい語彙へ暗黙変換せず、権限や保存処置へ進まない。
 * @cleanup メモリのみ。
 */
test("判断とWorkspace受付も未知Objectを文字列へ変換しない", () => {
  const outcome = decisionOutcome(decision());
  const command = {
    operation: "close-candidate",
    projectId: "project-a",
    queueId: "queue-a",
    workspaceId: "00000000-0000-4000-8000-000000000001",
    expectedGeneration: 1,
    expectedCommit: null,
    disposition: "adopted",
  };
  assert.ok(inspectCoordinatorDecisionResult(outcome));
  assert.ok(inspectWorkspaceCommand(command));
  for (const target of [
    {
      valid: outcome.effectState,
      inspect: (value: unknown) =>
        inspectCoordinatorDecisionResult({ ...outcome, effectState: value }),
    },
    {
      valid: command.disposition,
      inspect: (value: unknown) =>
        inspectWorkspaceCommand({ ...command, disposition: value }),
    },
  ]) {
    let calls = 0;
    const convert = () => {
      calls++;
      return target.valid;
    };
    const hook = {
      toString: convert,
      valueOf: convert,
      [Symbol.toPrimitive]: convert,
    };
    const proxy = new Proxy(
      {},
      {
        get() {
          calls++;
          throw Error("proxy_get");
        },
      },
    );
    for (const value of [hook, proxy]) {
      assert.doesNotThrow(() => assert.equal(target.inspect(value), null));
      assert.equal(calls, 0);
    }
  }
});

/**
 * @trace PRL-UT-014
 * @precondition 同じ不変準備から差戻し・回復必要の状態だけを独立生成する。
 * @stimulus Coの実Producer結果をObjective／状態Toolへ渡す。
 * @observation 完成受付後の状態と回復参照、getterや元値を共有しない結果。
 * @oracle 両状態を誤拒否せず、元のblocked／unknownと回復義務を保持する。
 * @cleanup メモリのみ。実AI・Docker・保存なし。
 */
test("MCPはProducerの差戻しと回復必要を両Toolで保持する", async () => {
  const created = projectExecutionFixture({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["受入"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["完了"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  const base = created.state;
  for (const mode of ["returned", "recovery_required"] as const) {
    const recovery = mode === "recovery_required";
    const projection = projectCoordinatorState(
      {
        ...base,
        milestone: { ...base.milestone, state: mode },
        objectives: base.objectives.map((entry) => ({
          ...entry,
          state: recovery ? "blocked" : "accepted",
        })),
        tasks: base.tasks.map((entry) => ({
          ...entry,
          state: recovery ? "recovery_required" : "completed",
        })),
      },
      { projectId: base.projectId, generation: base.generation, taskIds: [] },
    );
    for (const tool of [
      MCP_COORDINATOR_OBJECTIVE_TOOL,
      MCP_COORDINATOR_STATE_TOOL,
    ]) {
      const response = await handleMcpCoordinatorRequest(
        request("tools/call", {
          _meta: META,
          name: tool,
          arguments:
            tool === MCP_COORDINATOR_OBJECTIVE_TOOL
              ? objective()
              : {
                  requestId: "state-a",
                  projectId: "project-a",
                  repositoryRevision: revision,
                },
        }),
        dependencies({
          runObjective: async (input) => ({
            contract: "crdd-coordinator/orchestrator-objective-intake/v4",
            status: "blocked",
            reason: "fixture_pending",
            requestId: input.requestId,
            projectId: "project-a",
            milestoneId: "milestone-a",
            queueId: null,
            projection,
            cleanupConfirmed: !recovery,
            manualRecoveryRequired: recovery,
            processRestartRequired: false,
            recoveryIds: recovery ? ["host.fixture"] : [],
            recoveryObligations: recovery
              ? [{ kind: "host", recoveryId: "host.fixture" }]
              : [],
            effectState: recovery ? "unknown" : "no_effect",
          }),
          getProjectState: async (input) => ({
            contract: "crdd-coordinator/orchestrator-state-query/v2",
            status: "completed",
            reason: "orchestrator_state_observed",
            requestId: input.requestId,
            projectId: "project-a",
            repositoryRevision: revision,
            observationState: "observed",
            projection,
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            effectState: "no_effect",
          }),
        }),
        new AbortController().signal,
      );
      assert.equal(response.error, undefined);
      const result = response.result as {
        structuredContent: {
          reason: string;
          projection: { milestoneState: string };
          recoveryIds?: readonly string[];
        };
      };
      assert.equal(result.structuredContent.projection.milestoneState, mode);
      assert.notEqual(
        result.structuredContent.reason,
        "mcp_coordinator_result_invalid",
      );
      if (tool === MCP_COORDINATOR_OBJECTIVE_TOOL)
        assert.deepEqual(
          result.structuredContent.recoveryIds,
          recovery ? ["host.fixture"] : [],
        );
    }
  }
});

/**
 * MCPから二Taskの実行内容をDomain検査経由で搬送する。
 * @trace PRL-UT-014
 * @precondition Taskの実行はFake依存で置き換える。
 * @stimulus 依存する二Taskと、Task入力が欠落する要求を送る。
 * @observation 実行入口の呼出し回数と受領値。
 * @oracle 正常値だけ一回渡り、欠落は実行前に拒否する。
 * @cleanup 局所値のみ。外部Transport・AI・Dockerを使用しない。
 * @boundary MCP handler→Coordinator要求検査→Domain検査。
 */
test("MCPは複数Taskの計画と個別入力を対応付けて搬送する", async () => {
  const base = objective();
  const task = base.plan.tasks[0];
  const taskInput = base.taskInputs[0];
  assert.ok(task && taskInput);
  const input = {
    ...base,
    plan: {
      ...base.plan,
      tasks: [task, { ...task, id: "task-b", dependencies: [task.id] }],
    },
    taskInputs: [
      taskInput,
      { ...taskInput, taskId: "task-b", objective: "二番目の指示" },
    ],
  };
  let calls = 0;
  const baseline = dependencies();
  const deps = dependencies({
    runObjective: async (value, signal, authentication) => {
      calls++;
      assert.deepEqual(value, input);
      assert.ok(Object.isFrozen(value.taskInputs));
      return baseline.runObjective(value, signal, authentication);
    },
  });
  const envelope = (argumentsValue: unknown) =>
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: argumentsValue,
    });
  const result = await handleMcpCoordinatorRequest(
    envelope(input),
    deps,
    new AbortController().signal,
  );
  assert.equal((result.result as { isError: boolean }).isError, false);
  const rejected = await handleMcpCoordinatorRequest(
    envelope({ ...input, taskInputs: [taskInput] }),
    deps,
    new AbortController().signal,
  );
  assert.equal(rejected.error?.code, -32602);
  assert.equal(calls, 1);
});
const META = Object.freeze({
  "io.modelcontextprotocol/protocolVersion": MCP_COORDINATOR_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});

/**
 * 品質判断待ちと受入済み状態のTransport変換を検証する。
 * @responsibility 旧組立て試験のMCP変換OracleをProtocol Ownerへ移す。
 * @trace PRL-UT-014
 * @precondition 公開契約に一致する合成結果と認証主体を使用する。
 * @stimulus ObjectiveとStateの実Adapter入口へ要求する。
 * @observation 認証Context、固定text、structuredContentとisErrorを確認する。
 * @oracle 品質判断待ちはblockedのまま、受入済み読取りは観測済み・no_effectのまま返る。
 * @cleanup N/A: 保存・外部Process・Providerを使用しない。
 * @boundary PRL-UT-014=Direct Boundary: 公開DTO→MCP Adapterの結果変換。
 */
test("MCPは品質判断待ちと受入済み読取りの結果を保持する", async () => {
  const input = objective();
  const blocked = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: input,
    }),
    dependencies({
      runObjective: async (observed, _signal, authentication) => {
        assert.deepEqual(observed, input);
        assert.notEqual(observed, input);
        assert.ok(Object.isFrozen(observed));
        assert.deepEqual(authentication, { principalId: "principal-a" });
        return {
          contract: "crdd-coordinator/orchestrator-objective-intake/v4",
          status: "blocked",
          reason: "orchestrator_quality_acceptance_required",
          requestId: observed.requestId,
          projectId: observed.projectId,
          milestoneId: observed.milestoneId,
          queueId: "queue-a",
          projection: null,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          effectState: "settled",
          recoveryIds: [],
          recoveryObligations: [],
        };
      },
    }),
  );
  const result = blocked.result as {
    isError: boolean;
    content: readonly { type: string; text: string }[];
    structuredContent: {
      status: string;
      reason: string;
      recoveryIds: readonly string[];
    };
  };
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.status, "blocked");
  assert.equal(
    result.structuredContent.reason,
    "orchestrator_quality_acceptance_required",
  );
  assert.deepEqual(result.structuredContent.recoveryIds, []);
  assert.equal(result.content[0]?.type, "text");
  assert.equal(
    result.content[0]?.text,
    "処理は完了していません。構造化された理由を確認してください。",
  );

  const taskCounts = {
    planned: 0,
    waiting_dependency: 0,
    ready: 0,
    starting: 0,
    running: 0,
    cleanup_pending: 0,
    completed: 1025,
    failed: 0,
    cancelled: 0,
    recovery_required: 0,
    superseded: 0,
  };
  const projection = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 5,
    milestoneState: "accepted",
    objectiveCounts: {
      planned: 0,
      executing: 0,
      integration_pending: 0,
      accepted: 129,
      returned: 0,
      blocked: 0,
      cancelled: 0,
    },
    taskCounts,
    objectiveTaskSummaries: Array.from({ length: 129 }, (_, index) => ({
      objectiveId: `objective-${index}`,
      objectiveState: "accepted",
      taskCounts: { ...taskCounts, completed: index === 0 ? 1 : 8 },
    })),
    workProgress: "tasks_complete",
    qualityState: "accepted",
    humanDecisionRequired: false,
    recoveryRequired: false,
    nextAction: "complete",
  };
  const state = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_STATE_TOOL,
      arguments: {
        requestId: "state-a",
        projectId: "project-a",
        repositoryRevision: revision,
      },
    }),
    dependencies({
      getProjectState: async (observed, authentication) => {
        assert.deepEqual(authentication, { principalId: "principal-a" });
        assert.ok(Object.isFrozen(observed));
        return {
          contract: "crdd-coordinator/orchestrator-state-query/v2",
          status: "completed",
          reason: "orchestrator_state_observed",
          requestId: observed.requestId,
          projectId: observed.projectId,
          repositoryRevision: observed.repositoryRevision,
          observationState: "observed",
          projection,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        };
      },
    }),
  );
  const observed = state.result as {
    isError: boolean;
    content: readonly { type: string; text: string }[];
    structuredContent: {
      observationState: string;
      projection: {
        milestoneState: string;
        objectiveTaskSummaries: readonly unknown[];
        taskCounts: { completed: number };
      };
      effectState: string;
    };
  };
  assert.equal(observed.isError, false);
  assert.equal(observed.structuredContent.observationState, "observed");
  assert.equal(
    observed.structuredContent.projection.milestoneState,
    "accepted",
  );
  assert.equal(observed.structuredContent.effectState, "no_effect");
  assert.equal(
    observed.structuredContent.projection.objectiveTaskSummaries.length,
    129,
  );
  assert.equal(
    observed.structuredContent.projection.taskCounts.completed,
    1025,
  );
  assert.equal(observed.content[0]?.type, "text");
  assert.equal(observed.content[0]?.text, "処理が完了しました。");
});
/**
 * requestのTest準備責務を実行する。
 *
 * @responsibility requestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus requestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: mcp Test Source→対象契約
 */
function request(method: string, params: unknown, id = 1) {
  return { jsonrpc: "2.0", id, method, params };
}
/**
 * objectiveのTest準備責務を実行する。
 *
 * @responsibility objectiveがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus objectiveを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: mcp Test Source→対象契約
 */
function objective() {
  return withCallerPlan({
    operation: "start" as const,
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    objective: "Create the bounded result.",
    acceptanceCriteria: ["The result is verified."],
    allowedPaths: ["result.txt"],
    readPaths: ["README.md"],
    maximumConcurrency: 2,
    maximumReplans: 1,
    originLane: "interactive",
    adoptResult: false,
  });
}

/**
 * MCP semantic operations require a runtime-observed client principal before effectsを検証する。
 *
 * @responsibility MCP semantic operations require a runtime-observed client principal before effectsの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP semantic operations require a runtime-observed client principal before effectsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP semantic operations require a runtime-observed client principal before effects", async () => {
  let effects = 0;
  const result = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({
      authenticateClient: () => ({ status: "unknown" }),
      runObjective: async () => {
        effects += 1;
        return { status: "completed" };
      },
    }),
  );
  assert.equal(effects, 0);
  assert.equal(
    (result.result as { structuredContent: { reason: string } })
      .structuredContent.reason,
    "mcp_client_not_authenticated",
  );
});

/**
 * MCP envelope and authentication reject accessors and proxies without invoking themを検証する。
 *
 * @responsibility MCP envelope and authentication reject accessors and proxies without invoking themの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP envelope and authentication reject accessors and proxies without invoking themの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP envelope and authentication reject accessors and proxies without invoking them", async () => {
  let effects = 0;
  let getterCalls = 0;
  const accessorMeta = Object.defineProperties(
    {},
    {
      "io.modelcontextprotocol/protocolVersion": {
        enumerable: true,
        get() {
          getterCalls += 1;
          return MCP_COORDINATOR_PROTOCOL_VERSION;
        },
      },
      "io.modelcontextprotocol/clientCapabilities": {
        enumerable: true,
        value: {},
      },
    },
  );
  const accessorResult = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: accessorMeta,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({
      runObjective: async () => {
        effects += 1;
        return { status: "completed" };
      },
    }),
  );
  assert.equal(accessorResult.error?.code, -32602);
  assert.equal(getterCalls, 0);
  assert.equal(effects, 0);

  const proxyResult = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: new Proxy(META, {
        getPrototypeOf() {
          throw new Error("trap");
        },
      }),
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies(),
  );
  assert.equal(proxyResult.error?.code, -32602);

  const authentication = Object.defineProperties(
    {},
    {
      status: { enumerable: true, value: "verified" },
      principalId: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "principal-a";
        },
      },
    },
  );
  const authenticationResult = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({
      authenticateClient: () => authentication,
      runObjective: async () => {
        effects += 1;
        return { status: "completed" };
      },
    }),
  );
  assert.equal(
    (authenticationResult.result as { structuredContent: { reason: string } })
      .structuredContent.reason,
    "mcp_client_not_authenticated",
  );
  assert.equal(getterCalls, 0);
  assert.equal(effects, 0);
});

/**
 * Inspectorが送る任意ログレベルと未登録メタデータを区別する。
 * @trace EST-ST-003
 * @oracle 仕様値を使った一覧は成功し、不正値・別項目・版欠落は拒否する。
 */
test("MCP一覧はInspectorの標準logLevelだけを追加で受理する", async () => {
  const logLevel = "io.modelcontextprotocol/logLevel";
  const identity = {
    "io.modelcontextprotocol/clientInfo": {
      name: "inspector-test",
      version: "1",
    },
  };
  const list = (_meta: unknown) =>
    handleMcpCoordinatorRequest(
      request("tools/list", { _meta }),
      dependencies(),
    );
  for (const level of [
    "debug",
    "info",
    "notice",
    "warning",
    "error",
    "critical",
    "alert",
    "emergency",
  ]) {
    const result = await list({ ...META, ...identity, [logLevel]: level });
    assert.equal(result.error, undefined);
    assert.ok(
      Array.isArray((result.result as { tools?: unknown } | undefined)?.tools),
    );
  }
  for (const metadata of [
    { ...META, [logLevel]: "verbose" },
    { ...META, [logLevel]: 1 },
    { ...META, [logLevel]: undefined },
    { ...META, [logLevel]: "debug", "unsupported.extension/meta": true },
    { [logLevel]: "debug", ...identity },
  ])
    assert.equal((await list(metadata)).error?.code, -32602);
});
/**
 * decisionのTest準備責務を実行する。
 *
 * @responsibility decisionがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus decisionを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: mcp Test Source→対象契約
 */
function decision() {
  return {
    operation: "answer",
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 4,
    repositoryRevision: revision,
    selectedOption: "resume",
  };
}

/** 検査対象と同じ新判断値を返し、旧結果の互換変換は行わない。 */
function decisionOutcome(input: ReturnType<typeof decision>) {
  const time = "2026-11-12T00:00:00.000Z";
  return {
    contract: "crdd-coordinator/orchestrator-human-decision/v2",
    status: "completed",
    reason: "decision_applied",
    decisionId: input.decisionId,
    recoveryId: null,
    decision: {
      decisionId: input.decisionId,
      blockerId: "blocker-a",
      kind: "continuation",
      queueId: "queue-a",
      respondentPrincipalId: "principal-a",
      target: {
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        kind: "milestone",
        id: input.milestoneId,
        generation: input.generation,
        repositoryRevision: input.repositoryRevision,
      },
      question: "継続しますか",
      options: [{ value: "resume", label: "継続" }],
      requestedAt: time,
      status: "applied",
      result: {
        status: "applied",
        answer: {
          principalId: "principal-a",
          answeredAt: time,
          selectedOption: "resume",
          reason: null,
          evidenceIds: [],
        },
        application: {
          applicationId: input.decisionId,
          appliedAt: time,
          beforeGeneration: 4,
          afterGeneration: 5,
          previousState: "executing",
          nextState: "executing",
          blockerResolved: true,
        },
      },
    },
    history: { status: "confirmed" },
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled",
  };
}
/**
 * dependenciesのTest準備責務を実行する。
 *
 * @responsibility dependenciesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus dependenciesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: mcp Test Source→対象契約
 */
function dependencies(
  overrides: Partial<McpCoordinatorDependencies> = {},
): McpCoordinatorDependencies {
  return {
    runObjective: async (input) => ({
      contract: "crdd-coordinator/orchestrator-objective-intake/v4",
      status: "completed",
      reason: "objective_complete",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      effectState: "settled",
      requestId: input.requestId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      queueId: "queue-a",
      projection: null,
      recoveryIds: [],
      recoveryObligations: [],
    }),
    submitDecision: async (input) =>
      decisionOutcome({ ...decision(), ...input }),
    getProjectState: async (input) => ({
      contract: "crdd-coordinator/orchestrator-state-query/v2",
      status: "completed",
      reason: "orchestrator_state_absent",
      requestId: input.requestId,
      projectId: input.projectId,
      repositoryRevision: input.repositoryRevision,
      observationState: "absent",
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    }),
    ...overrides,
    authenticateClient:
      overrides.authenticateClient ??
      (() => ({ status: "verified", principalId: "principal-a" })),
  };
}

/**
 * MCP discovery and tool list expose the three public operationsを検証する。
 *
 * @responsibility MCP discovery and tool list expose the three public operationsの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP discovery and tool list expose the three public operationsの対象操作を実行する。
 * @observation 直接discover metadataのServer識別名と公開Tool集合を観測する。
 * @oracle Server識別名はcrdd-mcp、三つの公開操作の名前と順序を保持する。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP discovery and tool list expose the three public operations", async () => {
  assert.deepEqual(
    Object.keys(automation).sort(),
    [
      "MCP_COORDINATOR_ADAPTER_CONTRACT",
      "MCP_COORDINATOR_DECISION_TOOL",
      "MCP_COORDINATOR_OBJECTIVE_TOOL",
      "MCP_COORDINATOR_STATE_TOOL",
      "describeMcpCoordinatorAdapterContract",
      "getMcpCoordinatorToolDefinitions",
      "handleMcpCoordinatorRequest",
    ].sort(),
  );
  assert.equal(inspectCoordinatorObjectiveResult(null), null);
  const discover = await handleMcpCoordinatorRequest(
    request("server/discover", { _meta: META }),
    dependencies(),
  );
  assert.equal(discover.error, undefined);
  assert.equal(
    (discover.result as { _meta?: Record<string, { name: string }> })?._meta?.[
      "io.modelcontextprotocol/serverInfo"
    ]?.name,
    "crdd-mcp",
  );
  const listed = await handleMcpCoordinatorRequest(
    request("tools/list", { _meta: META }),
    dependencies(),
  );
  assert.equal(listed.error, undefined);
  const tools = (listed.result as { tools: readonly { name: string }[] }).tools;
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      MCP_COORDINATOR_OBJECTIVE_TOOL,
      MCP_COORDINATOR_DECISION_TOOL,
      MCP_COORDINATOR_STATE_TOOL,
    ],
  );
});

/**
 * MCPはProfileを任意のObjective入力として公開する。
 *
 * @responsibility 発見Schemaと実入力検査のProfile契約を一致させる。
 * @trace PRL-UT-014
 * @precondition 既存の三操作と正常metadataを使用する。
 * @stimulus tools/listで公開Schemaを取得する。
 * @observation Objectiveのproperties、requiredと未知field拒否を確認する。
 * @oracle 分類と三項目の選択は任意項目で、Decision／Stateへ追加しない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: Protocol handlerの局所試験。
 */
test("MCP Schemaは分類と明示選択をObjectiveだけの任意項目として公開する", async () => {
  const response = await handleMcpCoordinatorRequest(
    request("tools/list", { _meta: META }),
    dependencies(),
  );
  const tools = (
    response.result as {
      tools: readonly {
        name: string;
        inputSchema: {
          properties: Record<string, unknown>;
          required: readonly string[];
          additionalProperties: boolean;
        };
      }[];
    }
  ).tools;
  const schema = tools.find(
    (tool) => tool.name === MCP_COORDINATOR_OBJECTIVE_TOOL,
  )?.inputSchema;
  assert.ok(schema);
  assert.deepEqual(schema.properties.workType, {
    type: "string",
    pattern: "^[a-z0-9][a-z0-9._-]*$",
  });
  assert.deepEqual(schema.properties.choice, {
    type: "object",
    additionalProperties: false,
    required: ["provider", "model", "effort"],
    properties: {
      provider: { enum: ["codex", "claude"] },
      model: {
        type: "string",
        maxLength: 128,
        pattern: "^[a-z0-9][a-z0-9._-]{0,127}$",
      },
      effort: { enum: ["low", "medium", "high", "xhigh", "max"] },
    },
  });
  assert.equal(Object.hasOwn(schema.properties, "requestedProfileId"), false);
  assert.equal(
    Object.hasOwn(schema.properties, "requestedExecutorProvider"),
    false,
  );
  assert.equal(schema.required.includes("choice"), false);
  assert.equal(schema.required.includes("intakeEpoch"), false);
  assert.equal(schema.required.includes("plan"), true);
  assert.equal(schema.required.includes("taskInputs"), true);
  assert.equal(schema.required.length, 15);
  assert.equal(schema.required.includes("operation"), true);
  assert.deepEqual(schema.properties.operation, {
    type: "string",
    enum: ["start", "resume"],
  });
  assert.equal(schema.additionalProperties, false);
  for (const tool of tools.filter(
    (tool) => tool.name !== MCP_COORDINATOR_OBJECTIVE_TOOL,
  ))
    assert.equal(Object.hasOwn(tool.inputSchema.properties, "choice"), false);
});

/**
 * MCPからCoreへ明示選択を入力だけから搬送する。
 *
 * @responsibility 明示選択と省略を区別し、認証からModel希望を補完しないことを検証する。
 * @trace PRL-UT-014
 * @precondition 認証済みの合成入力とメモリ内のCore観測Portを使用する。
 * @stimulus 同じObjectiveを明示選択と分類の有無の四組合せで渡す。
 * @observation Core入力、認証Context、取消Signalと結果を確認する。
 * @oracle 三項目はexact、省略は省略、Authorityと結果意味は既存契約のまま。
 * @cleanup N/A: 外部Process、Providerと永続状態を生成しない。
 * @boundary N/A: 実Transportや実Application全体を起動しない。
 */
test("MCP Objectiveは明示選択をexactに保持し省略時に生成しない", async () => {
  for (let mask = 0; mask < 4; mask += 1) {
    const input = {
      ...objective(),
      ...(mask & 1
        ? { choice: { provider: "codex", model: "gpt-5.5", effort: "high" } }
        : {}),
      ...(mask & 2 ? { workType: "coding" } : {}),
    };
    const controller = new AbortController();
    let calls = 0;
    const baseline = dependencies();
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: input,
      }),
      dependencies({
        runObjective: async (observed, signal, authentication) => {
          calls += 1;
          assert.deepEqual(observed, input);
          assert.notEqual(observed, input);
          assert.ok(Object.isFrozen(observed));
          assert.equal(signal, controller.signal);
          assert.deepEqual(authentication, { principalId: "principal-a" });
          return baseline.runObjective(observed, signal, authentication);
        },
      }),
      controller.signal,
    );
    assert.equal(calls, 1);
    assert.equal((response.result as { isError: boolean }).isError, false);
  }
});

/**
 * 不正なAI選択と旧形式入力を認証・Core処理より前に拒否する。
 *
 * @responsibility 不正な明示選択・廃止fieldが下位呼出しや動的入力実行を生じないことを検証する。
 * @trace PRL-UT-014
 * @precondition 不正形式、未知field、getterとProxyを持つ合成入力。
 * @stimulus 各入力をMCP Objective handlerへ渡す。
 * @observation error code、認証・Core・getter／trap呼出し件数。
 * @oracle -32602で拒否し、全呼出し件数0。
 * @cleanup N/A: メモリ内の入力だけを使用する。
 * @boundary N/A: 実Transportを起動しない局所試験。
 */
test("MCP Objectiveは不正選択と旧形式を認証・Core呼出し前に拒否する", async () => {
  let calls = 0;
  const invalidArguments = [
    {
      ...objective(),
      choice: { provider: "codex", model: "gpt-5.5", effort: "automatic" },
    },
    {
      ...objective(),
      choice: {
        provider: "codex",
        model: "gpt-5.5",
        effort: "high",
        credential: "forbidden",
      },
    },
    ...[null, undefined, "PROFILE-12345", "profile-100001"].map(
      (requestedProfileId) => ({ ...objective(), requestedProfileId }),
    ),
    {
      ...objective(),
      requestedProfileId: "PROFILE-100001",
      authority: "not-authority",
    },
    Object.defineProperty({ ...objective() }, "requestedProfileId", {
      enumerable: true,
      get: () => {
        calls += 1;
        return "PROFILE-100001";
      },
    }),
    new Proxy(
      { ...objective(), requestedProfileId: "PROFILE-100001" },
      {
        ownKeys: () => {
          calls += 1;
          throw new Error("trap must not execute");
        },
      },
    ),
  ];
  for (const argumentsValue of invalidArguments) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: argumentsValue,
      }),
      dependencies({
        authenticateClient: () => {
          calls += 1;
          return { status: "verified", principalId: "principal-a" };
        },
        runObjective: async () => {
          calls += 1;
          throw new Error("Core must not execute");
        },
      }),
    );
    assert.equal(response.error?.code, -32602);
  }
  assert.equal(calls, 0);
});

/**
 * MCP state tool returns the canonical read-only resultを検証する。
 *
 * @responsibility MCP state tool returns the canonical read-only resultの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP state tool returns the canonical read-only resultの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP state tool returns the canonical read-only result", async () => {
  let authentication: unknown = null;
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_STATE_TOOL,
      arguments: {
        requestId: "state-a",
        projectId: "project-a",
        repositoryRevision: revision,
      },
    }),
    dependencies({
      getProjectState: async (input, observedAuthentication) => {
        authentication = observedAuthentication;
        return {
          contract: "crdd-coordinator/orchestrator-state-query/v2",
          status: "completed",
          reason: "orchestrator_state_absent",
          requestId: input.requestId,
          projectId: input.projectId,
          repositoryRevision: input.repositoryRevision,
          observationState: "absent",
          projection: null,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        };
      },
    }),
  );
  assert.deepEqual(authentication, { principalId: "principal-a" });
  assert.equal(
    (response.result as { structuredContent: { observationState: string } })
      .structuredContent.observationState,
    "absent",
  );
});

/**
 * MCP Objective uses the common semantic entry and preserves cancellationを検証する。
 *
 * @responsibility MCP Objective uses the common semantic entry and preserves cancellationの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP Objective uses the common semantic entry and preserves cancellationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP Objective uses the common semantic entry and preserves cancellation", async () => {
  const controller = new AbortController();
  let observedRequestId: unknown = null;
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({
      runObjective: async (input, signal, authentication) => {
        observedRequestId = input.requestId;
        assert.equal(signal, controller.signal);
        assert.deepEqual(authentication, { principalId: "principal-a" });
        return {
          contract: "crdd-coordinator/orchestrator-objective-intake/v4",
          status: "completed",
          reason: "accepted",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          effectState: "settled",
          requestId: input.requestId,
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          queueId: "queue-a",
          projection: null,
          recoveryIds: [],
          recoveryObligations: [],
        };
      },
    }),
    controller.signal,
  );
  assert.equal(observedRequestId, "request-a");
  assert.equal((response.result as { isError: boolean }).isError, false);
});

/**
 * MCP Decision uses a separate entry and never forwards comment to Objectiveを検証する。
 *
 * @responsibility MCP Decision uses a separate entry and never forwards comment to Objectiveの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP Decision uses a separate entry and never forwards comment to Objectiveの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP Decision uses a separate entry and never forwards comment to Objective", async () => {
  let calls = 0;
  const outcome = decisionOutcome(decision());
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_DECISION_TOOL,
      arguments: { ...decision(), comment: "確認済み" },
    }),
    dependencies({
      runObjective: async () => {
        throw new Error("not_expected");
      },
      submitDecision: async (input, authentication) => {
        calls += 1;
        assert.equal(
          input.operation === "answer" && input.selectedOption,
          "resume",
        );
        assert.deepEqual(authentication, { principalId: "principal-a" });
        return outcome;
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal((response.result as { isError: boolean }).isError, false);
  const accepted = (response.result as { structuredContent: typeof outcome })
    .structuredContent;
  assert.deepEqual(accepted, outcome);
  assert.notEqual(accepted.decision, outcome.decision);
  assert.equal(Object.isFrozen(accepted.decision), true);
  outcome.decision.question = "changed after receipt";
  outcome.decision.result.answer.principalId = "another-principal";
  assert.equal(accepted.decision.question, "継続しますか");
  assert.equal(accepted.decision.result.answer.principalId, "principal-a");
});

/**
 * MCP rejects unknown fields, stale-shaped decisions, and multiline comments before effectsを検証する。
 *
 * @responsibility MCP rejects unknown fields, stale-shaped decisions, and multiline comments before effectsの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP rejects unknown fields, stale-shaped decisions, and multiline comments before effectsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP rejects unknown fields, stale-shaped decisions, and multiline comments before effects", async () => {
  let effects = 0;
  const deps = dependencies({
    runObjective: async () => {
      effects += 1;
      return null;
    },
    submitDecision: async () => {
      effects += 1;
      return null;
    },
  });
  for (const [name, args] of [
    [MCP_COORDINATOR_OBJECTIVE_TOOL, { ...objective(), authority: true }],
    [MCP_COORDINATOR_DECISION_TOOL, { ...decision(), generation: 0 }],
    [MCP_COORDINATOR_DECISION_TOOL, { ...decision(), comment: "line1\nline2" }],
  ] as const) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", { _meta: META, name, arguments: args }),
      deps,
    );
    assert.equal(response.error?.code, -32602);
  }
  assert.equal(effects, 0);
});

/**
 * MCP fails closed when a semantic result is malformedを検証する。
 *
 * @responsibility MCP fails closed when a semantic result is malformedの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP fails closed when a semantic result is malformedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP fails closed when a semantic result is malformed", async () => {
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({ runObjective: async () => ({ status: "completed" }) }),
  );
  const result = response.result as {
    isError: boolean;
    structuredContent: { reason: string };
  };
  assert.equal(result.isError, true);
  assert.equal(
    result.structuredContent.reason,
    "mcp_coordinator_result_invalid",
  );
});

/**
 * MCPは内部Task fieldを公開結果へ透過しないを検証する。
 *
 * @responsibility MCPは内部Task fieldを公開結果へ透過しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCPは内部Task fieldを公開結果へ透過しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPは内部Task fieldを公開結果へ透過しない", async () => {
  for (const extra of [
    { taskId: "task-internal" },
    { phase: "handoff_prepared" },
  ]) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({
        runObjective: async () => ({
          contract: "crdd-coordinator/orchestrator-objective-intake/v4",
          status: "completed",
          reason: "accepted",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          effectState: "settled",
          requestId: "request-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          projection: null,
          recoveryIds: [],
          recoveryObligations: [],
          ...extra,
        }),
      }),
    );
    const result = response.result as {
      isError: boolean;
      structuredContent: { reason: string };
    };
    assert.equal(result.isError, true);
    assert.equal(
      result.structuredContent.reason,
      "mcp_coordinator_result_invalid",
    );
  }
});

/**
 * MCP公開結果は入れ子、相関、操作別fieldを閉じたDTOへ再構成するを検証する。
 *
 * @responsibility MCP公開結果は入れ子、相関、操作別fieldを閉じたDTOへ再構成するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP公開結果は入れ子、相関、操作別fieldを閉じたDTOへ再構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP公開結果は入れ子、相関、操作別fieldを閉じたDTOへ再構成する", async () => {
  const base = {
    contract: "crdd-coordinator/orchestrator-objective-intake/v4",
    status: "blocked",
    reason: "recovery_required",
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    projection: null,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
    recoveryIds: ["host-task.a"],
    recoveryObligations: [{ kind: "host", recoveryId: "host-task.a" }],
    effectState: "unknown",
  };
  const getterObligation = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(getterObligation, "kind", {
    enumerable: true,
    get: () => "host",
  });
  Object.defineProperty(getterObligation, "recoveryId", {
    enumerable: true,
    value: "host-task.a",
  });
  const validProjection = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 1,
    milestoneState: "recovery_required",
    objectiveCounts: {
      planned: 0,
      executing: 0,
      integration_pending: 0,
      accepted: 0,
      returned: 0,
      blocked: 1,
      cancelled: 0,
    },
    taskCounts: {
      planned: 0,
      waiting_dependency: 0,
      ready: 0,
      starting: 0,
      running: 0,
      cleanup_pending: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      recovery_required: 1,
      superseded: 0,
    },
    objectiveTaskSummaries: [
      {
        objectiveId: "objective-a",
        objectiveState: "blocked",
        taskCounts: {
          planned: 0,
          waiting_dependency: 0,
          ready: 0,
          starting: 0,
          running: 0,
          cleanup_pending: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          recovery_required: 1,
          superseded: 0,
        },
      },
    ],
    workProgress: "in_progress",
    qualityState: "blocked",
    humanDecisionRequired: true,
    recoveryRequired: true,
    nextAction: "recover",
  };
  const source = fs.readFileSync(
    new URL("../../../coordinator/src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const result = compileFunction(
    `return (${sourceDeclaration(source, "createCoordinatorObjectiveResult")});`,
    [
      "COORDINATOR_OBJECTIVE_INTAKE_CONTRACT",
      "inspectCoordinatorWorkspaceResults",
    ],
  )(base.contract, () => assert.fail("workspace not used"));
  const runningCounts = {
    ...validProjection.taskCounts,
    recovery_required: 0,
    running: 1,
  };
  const runningProjection = {
    ...validProjection,
    milestoneState: "executing",
    objectiveCounts: {
      ...validProjection.objectiveCounts,
      blocked: 0,
      executing: 1,
    },
    taskCounts: runningCounts,
    objectiveTaskSummaries: [
      {
        objectiveId: "objective-a",
        objectiveState: "executing",
        taskCounts: runningCounts,
      },
    ],
    qualityState: "not_evaluated",
    humanDecisionRequired: false,
    recoveryRequired: false,
    nextAction: "wait_for_task",
  };
  let projection = runningProjection;
  const replay = compileFunction(
    `return (${sourceDeclaration(source, "projectObjectiveReplay")});`,
    ["createCoordinatorObjectiveResult", "projectCoordinatorState", "blocked"],
  )(
    result,
    () => projection,
    () => assert.fail("captured_candidates_must_reach_replay"),
  ) as (
    request: object,
    queue: object,
    state: object | null,
    candidates?: object,
  ) => Record<string, unknown>;
  const input = objective();
  const queue = {
    queueId: "queue-a",
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    state: "running",
    ownerGeneration: "active-owner",
  };
  const state = {
    projectId: input.projectId,
    generation: 1,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    milestone: { state: "executing" },
    tasks: [
      {
        definition: { id: "task-a" },
        cleanupConfirmed: false,
        recoveryUnresolved: false,
        recoveryObligations: [],
      },
    ],
  };
  const candidates = Object.freeze({
    projectId: state.projectId,
    generation: state.generation,
    taskIds: Object.freeze([]),
  });
  const running = replay(input, queue, state, candidates);
  assert.ok(
    inspectCoordinatorObjectiveResult(running),
    JSON.stringify(running),
  );
  assert.equal(running.effectState, "no_effect");
  const missingProjection = replay(
    input,
    { ...queue, state: "completed", ownerGeneration: null },
    null,
  );
  assert.ok(inspectCoordinatorObjectiveResult(missingProjection));
  assert.equal(missingProjection.projection, null);
  const completedCounts = { ...runningCounts, running: 0, completed: 1 };
  projection = {
    ...runningProjection,
    milestoneState: "accepted",
    objectiveCounts: {
      ...runningProjection.objectiveCounts,
      executing: 0,
      accepted: 1,
    },
    taskCounts: completedCounts,
    objectiveTaskSummaries: [
      {
        objectiveId: "objective-a",
        objectiveState: "accepted",
        taskCounts: completedCounts,
      },
    ],
    workProgress: "tasks_complete",
    qualityState: "accepted",
    nextAction: "complete",
  };
  const acceptedReplay = replay(
    input,
    { ...queue, state: "integration_pending", ownerGeneration: null },
    {
      ...state,
      milestone: { state: "accepted" },
      tasks: [
        {
          definition: { id: "task-a" },
          cleanupConfirmed: true,
          recoveryUnresolved: false,
          recoveryObligations: [],
        },
      ],
    },
    candidates,
  );
  assert.equal(acceptedReplay.status, "completed");
  assert.ok(inspectCoordinatorObjectiveResult(acceptedReplay));
  projection = validProjection;
  const recovering = replay(
    input,
    { ...queue, state: "recovery_required", ownerGeneration: null },
    {
      ...state,
      tasks: [
        {
          definition: { id: "task-a" },
          cleanupConfirmed: true,
          recoveryUnresolved: false,
          recoveryObligations: [
            { kind: "host", recoveryId: "host-original", phase: "required" },
          ],
        },
      ],
    },
    candidates,
  );
  assert.ok(inspectCoordinatorObjectiveResult(recovering));
  assert.equal(recovering.cleanupConfirmed, false);
  assert.deepEqual(recovering.recoveryIds, ["host-original"]);
  const identity = compileFunction(
    `return (${sourceDeclaration(source, "createObjectiveIntake")});`,
    ["createCoordinatorStableId", "hashCoordinatorContent"],
  )(
    () => "queue",
    () => "hash",
  );
  const failedRead = compileFunction(
    `return (${sourceDeclaration(source, "readObjectiveReplay")});`,
    [
      "createObjectiveIntake",
      "readState",
      "verifyRuntimePersistenceRepository",
      "COORDINATOR_PUBLIC_RUNTIME_CONTRACT",
    ],
  )(
    identity,
    () => ({
      status: "blocked",
      reason: "store_read_unknown",
      recoveryId: "store-original",
    }),
    () => ({}),
    "crdd-coordinator/public-runtime/v2",
  ) as (
    input: object,
    root: string,
    binding: string,
    principal: string,
  ) => Record<string, unknown>;
  const boundary = failedRead(input, "fixture", "binding", "principal");
  assert.deepEqual(inspectCoordinatorObjectiveResult(boundary)?.recoveryIds, [
    "store-original",
  ]);
  const createCore = (operations: {
    readProjectExecutionState?: () => unknown;
    readQueueEntry?: () => unknown;
    createQueue?: () => unknown;
    inspectAcquisition?: () => unknown;
    reconcileOwnerLoss?: () => unknown;
    resolveObjectiveTaskSelections?: () => unknown;
  }) =>
    compileFunction(
      `return (${sourceDeclaration(source, "executeCoordinatorObjective")});`,
      [
        "isPrincipalId",
        "COORDINATOR_PUBLIC_RUNTIME_CONTRACT",
        "resolveObjectiveTaskSelections",
        "inspectTaskExecutionSelections",
        "objectiveSelectionsMatch",
        "inspectTaskStartCandidates",
        "readQueueEntry",
        "createQueue",
        "inspectCoordinatorSnapshotLeaseAcquisitionOwner",
        "reconcileCoordinatorSnapshotLeaseOwnerLoss",
        "observeObjectiveLeaseOwner",
        "updateCoordinatorQueue",
        "readProjectExecutionState",
        "wasObjectiveStateUninitialized",
        "hashCoordinatorContent",
        "getRuntimeProcessInstanceIdentity",
        "runCoordinatorOperation",
      ],
    )(
      () => true,
      "crdd-coordinator/public-runtime/v2",
      operations.resolveObjectiveTaskSelections ??
        (() => assert.fail("selection forbidden")),
      inspectTaskExecutionSelections,
      () => true,
      inspectTaskStartCandidates,
      operations.readQueueEntry ?? (() => assert.fail("Queue read forbidden")),
      operations.createQueue ?? (() => assert.fail("enqueue forbidden")),
      operations.inspectAcquisition ??
        (() => assert.fail("lease inspection forbidden")),
      operations.reconcileOwnerLoss ??
        (() => assert.fail("reconciliation forbidden")),
      observeObjectiveLeaseOwner,
      () => assert.fail("Queue mutation forbidden"),
      operations.readProjectExecutionState ??
        (() => assert.fail("state must not be created")),
      compileFunction(
        `return (${sourceDeclaration(source, "wasObjectiveStateUninitialized")});`,
        [],
      )(),
      () => "hash",
      () => "owner",
      () => assert.fail("execution forbidden after Store refusal"),
    ) as (
      deps: object,
      input: object,
      signal: AbortSignal,
    ) => Promise<Record<string, unknown>>;
  let queueReads = 0;
  const coreBoundary = await createCore({
    readQueueEntry: () => {
      queueReads++;
      return {
        status: "blocked",
        reason: "store_read_unknown",
        manualRecoveryRequired: true,
        recoveryId: "queue-store-original",
      };
    },
  })(
    {
      authenticatedPrincipalId: "principal",

      persistence: {
        repository: {},
        repositoryBindingId: "binding",
        workingDirectory: "fixture",
        intake: identity(
          { ...input, operation: "resume" },
          "binding",
          "principal",
        ),
      },
      execution: {},
    },
    { ...input, operation: "resume" },
    new AbortController().signal,
  );
  assert.equal(queueReads, 1);
  assert.deepEqual(
    inspectCoordinatorObjectiveResult(coreBoundary)?.recoveryIds,
    ["queue-store-original"],
  );
  for (const failedState of [
    {
      status: "completed",
      reason: "state_missing_after_acceptance",
      value: null,
    },
    {
      status: "blocked",
      reason: "state_read_unavailable",
      value: null,
      manualRecoveryRequired: false,
      recoveryId: null,
    },
    {
      status: "blocked",
      reason: "state_read_unavailable",
      value: null,
      manualRecoveryRequired: true,
      recoveryId: "post-enqueue-original",
    },
    {
      status: "blocked",
      reason: "initial_acceptance_unknown",
      value: null,
      manualRecoveryRequired: false,
      recoveryId: "enqueue-original",
      duringEnqueue: true,
    },
  ]) {
    let reads = 0;
    let saves = 0;
    const saved = new Map();
    const result = await createCore({
      resolveObjectiveTaskSelections: () => ({
        status: "resolved",
        value: taskExecutionSelections(),
      }),
      readProjectExecutionState: () =>
        ++reads === 1 ? { status: "completed", value: null } : failedState,
      createQueue: () => {
        saves++;
        saved.set("queue", queue);
        return "duringEnqueue" in failedState
          ? failedState
          : { status: "completed", reason: "accepted", value: queue };
      },
      inspectAcquisition: () => ({
        status: "completed",
        value: { acquisition: null },
      }),
    })(
      {
        authenticatedPrincipalId: "principal",

        persistence: {
          repository: {},
          repositoryBindingId: "binding",
          workingDirectory: "fixture",
          intake: identity(
            { ...input, operation: "start" },
            "binding",
            "principal",
          ),
        },
        execution: {},
      },
      { ...input, operation: "start" },
      new AbortController().signal,
    );
    const captured = inspectCoordinatorObjectiveResult(result);
    assert.ok(captured);
    assert.equal(captured.effectState, "unknown");
    assert.equal(captured.cleanupConfirmed, false);
    assert.equal(captured.manualRecoveryRequired, true);
    assert.deepEqual(
      captured.recoveryIds,
      "recoveryId" in failedState && failedState.recoveryId
        ? [failedState.recoveryId]
        : [],
    );
    assert.equal(reads, "duringEnqueue" in failedState ? 1 : 2);
    assert.equal(saves, 1);
    assert.equal(saved.size, 1);
    assert.strictEqual(saved.get("queue"), queue);
  }
  const ordinary = {
    status: "blocked" as const,
    reason: "orchestrator_state_generation_conflict",
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  };
  const uncertain = {
    ...ordinary,
    reason: "store_unconfirmed",
    manualRecoveryRequired: true,
    recoveryId: "original-store-reference",
  };
  for (const [stage, outcome, pure] of [
    ["enqueue", ordinary, true],
    ["acquisition", { ...ordinary, reason: "lease_inspection_blocked" }, true],
    ["acquisition", uncertain, false],
    ["acquisition_other", uncertain, false],
    ["initial_read", uncertain, false],
    ["initial_read", ordinary, false],
    ["reconciliation", uncertain, false],
    ["reconciliation", ordinary, true],
    ["queue_read", uncertain, false],
    ["queue_read", ordinary, false],
  ] as const) {
    let stateReads = 0;
    let enqueues = 0;
    let reconciliations = 0;
    let queueReads = 0;
    const saved = new Map([["queue", queue]]);
    const observed = await createCore({
      readProjectExecutionState: () => {
        stateReads++;
        return stage === "initial_read"
          ? outcome
          : {
              status: "completed",
              value: state,
              taskStartCandidates: {
                projectId: state.projectId,
                generation: state.generation,
                taskIds: [],
              },
            };
      },
      createQueue: () => {
        enqueues++;
        return stage === "enqueue"
          ? outcome
          : { status: "completed", reason: "existing", value: queue };
      },
      readQueueEntry: () => {
        queueReads++;
        assert.equal(stage, "queue_read");
        return outcome;
      },
      inspectAcquisition: () =>
        stage === "acquisition"
          ? outcome
          : {
              status: "completed",
              value: {
                acquisition:
                  stage === "acquisition_other"
                    ? {
                        projectId: "other-project",
                        recoveryId: uncertain.recoveryId,
                      }
                    : null,
              },
            },
      reconcileOwnerLoss: () => {
        reconciliations++;
        return stage === "reconciliation"
          ? outcome
          : {
              status: "completed",
              value: {
                queue: { ...queue, queueId: "queue" },
                recoveryId: null,
              },
            };
      },
    })(
      {
        authenticatedPrincipalId: "principal",

        persistence: {
          repository: {},
          repositoryBindingId: "binding",
          workingDirectory: "fixture",
          intake: identity(
            { ...input, operation: "start" },
            "binding",
            "principal",
          ),
        },
        execution: {},
      },
      { ...input, operation: "start" },
      new AbortController().signal,
    );
    const captured = inspectCoordinatorObjectiveResult(observed);
    assert.ok(captured, JSON.stringify(observed));
    assert.equal(captured.effectState, pure ? "no_effect" : "unknown");
    assert.equal(captured.cleanupConfirmed, pure);
    assert.equal(captured.manualRecoveryRequired, !pure);
    assert.deepEqual(
      captured.recoveryIds,
      outcome.recoveryId ? [outcome.recoveryId] : [],
    );
    assert.equal(
      captured.reason,
      stage === "acquisition_other"
        ? "orchestrator_lease_acquisition_project_identity_mismatch"
        : outcome.reason,
    );
    assert.equal(stateReads, stage.startsWith("acquisition") ? 0 : 1);
    assert.equal(
      enqueues,
      ["enqueue", "reconciliation", "queue_read"].includes(stage) ? 1 : 0,
    );
    assert.equal(
      reconciliations,
      ["reconciliation", "queue_read"].includes(stage) ? 1 : 0,
    );
    assert.equal(queueReads, stage === "queue_read" ? 1 : 0);
    assert.equal(saved.size, 1);
    assert.strictEqual(saved.get("queue"), queue);
  }
  for (const invalid of [
    { ...boundary, recoveryIds: ["duplicate", "duplicate"] },
    { ...boundary, recoveryIds: Array(1) },
    { ...boundary, recoveryIds: ["../invalid"] },
    { ...boundary, unexpected: true },
    {
      ...boundary,
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
    },
  ])
    assert.equal(inspectCoordinatorObjectiveResult(invalid), null);
  for (const count of [1025, Number.MAX_SAFE_INTEGER]) {
    const counts = { ...validProjection.taskCounts, recovery_required: count };
    assert.ok(
      inspectCoordinatorObjectiveResult({
        ...base,
        projection: {
          ...validProjection,
          taskCounts: counts,
          objectiveTaskSummaries: [
            {
              ...validProjection.objectiveTaskSummaries[0],
              taskCounts: counts,
            },
          ],
        },
      }),
    );
  }
  const malformedItems = [
    {
      ...base,
      recoveryObligations: [
        { kind: "host", recoveryId: "host-task.a", taskId: "internal" },
      ],
    },
    { ...base, recoveryObligations: [getterObligation] },
    {
      ...base,
      recoveryObligations: [
        new Proxy({ kind: "host", recoveryId: "host-task.a" }, {}),
      ],
    },
    { ...base, processRestartRequired: true },
    { ...base, manualRecoveryRequired: false },
    { ...base, cleanupConfirmed: true },
    {
      ...base,
      processRestartRequired: false,
      recoveryIds: ["runtime-process.a"],
      recoveryObligations: [
        { kind: "runtime_process", recoveryId: "runtime-process.a" },
      ],
    },
    { ...base, status: "cancelled" },
    {
      ...base,
      projection: { ...validProjection, projectId: "project-b" },
    },
    { ...base, decisionId: "decision-a" },
    {
      ...base,
      projection: { ...validProjection, internalTaskId: "task-a" },
    },
    {
      ...base,
      projection: { ...validProjection, recoveryRequired: false },
    },
    {
      ...base,
      projection: { ...validProjection, qualityState: "accepted" },
    },
    {
      ...base,
      projection: { ...validProjection, nextAction: "schedule_task" },
    },
    {
      ...base,
      projection: { ...validProjection, workProgress: "not_started" },
    },
    {
      ...base,
      projection: {
        ...validProjection,
        taskCounts: {
          ...validProjection.taskCounts,
          recovery_required: 1026,
        },
        objectiveTaskSummaries: [
          {
            ...validProjection.objectiveTaskSummaries[0],
            taskCounts: {
              ...validProjection.taskCounts,
              recovery_required: 1025,
            },
          },
        ],
      },
    },
    {
      ...base,
      projection: {
        ...validProjection,
        taskCounts: {
          ...validProjection.taskCounts,
          recovery_required: Number.MAX_SAFE_INTEGER + 1,
        },
        objectiveTaskSummaries: [
          {
            ...validProjection.objectiveTaskSummaries[0],
            taskCounts: {
              ...validProjection.taskCounts,
              recovery_required: Number.MAX_SAFE_INTEGER + 1,
            },
          },
        ],
      },
    },
    {
      ...base,
      projection: {
        ...validProjection,
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          blocked: 2,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          recovery_required: 1026,
        },
        objectiveTaskSummaries: [
          {
            ...validProjection.objectiveTaskSummaries[0],
            objectiveId: "objective-a",
            taskCounts: {
              ...validProjection.taskCounts,
              recovery_required: 512,
            },
          },
          {
            ...validProjection.objectiveTaskSummaries[0],
            objectiveId: "objective-b",
            taskCounts: {
              ...validProjection.taskCounts,
              recovery_required: 513,
            },
          },
        ],
      },
    },
    {
      ...base,
      recoveryIds: [],
      recoveryObligations: [],
      manualRecoveryRequired: false,
      cleanupConfirmed: true,
      effectState: "settled",
      projection: {
        ...validProjection,
        milestoneState: "executing",
        objectiveCounts: {
          planned: 0,
          executing: 1,
          integration_pending: 1,
          accepted: 0,
          blocked: 0,
          cancelled: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          ready: 1,
          completed: 1,
          recovery_required: 0,
        },
        objectiveTaskSummaries: [
          {
            objectiveId: "objective-integrating",
            objectiveState: "integration_pending",
            taskCounts: {
              ...validProjection.taskCounts,
              ready: 1,
              recovery_required: 0,
            },
          },
          {
            objectiveId: "objective-executing",
            objectiveState: "executing",
            taskCounts: {
              ...validProjection.taskCounts,
              completed: 1,
              recovery_required: 0,
            },
          },
        ],
        workProgress: "in_progress",
        qualityState: "integration_pending",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "verify_objective_integration",
      },
    },
    {
      ...base,
      status: "completed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled",
      recoveryIds: [],
      recoveryObligations: [],
      projection: validProjection,
    },
    {
      ...base,
      recoveryIds: [],
      recoveryObligations: [],
      projection: {
        ...validProjection,
        milestoneState: "accepted",
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          accepted: 1,
          blocked: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          recovery_required: 1,
        },
        qualityState: "accepted",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "complete",
      },
    },
    {
      ...base,
      status: "cancelled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
      recoveryIds: [],
      recoveryObligations: [],
      projection: {
        ...validProjection,
        milestoneState: "planned",
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          planned: 1,
          blocked: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          ready: 1,
          recovery_required: 0,
        },
        workProgress: "not_started",
        qualityState: "not_evaluated",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "schedule_task",
      },
    },
    {
      ...base,
      status: "completed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled",
      recoveryIds: [],
      recoveryObligations: [],
      projection: {
        ...validProjection,
        milestoneState: "planned",
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          planned: 1,
          blocked: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          completed: 1,
          recovery_required: 0,
        },
        workProgress: "tasks_complete",
        qualityState: "not_evaluated",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "schedule_task",
      },
    },
    {
      ...base,
      projection: {
        ...validProjection,
        milestoneState: "executing",
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          accepted: 1,
          blocked: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          completed: 1,
          recovery_required: 0,
        },
        workProgress: "tasks_complete",
        qualityState: "not_evaluated",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "wait_for_task",
      },
    },
    {
      ...base,
      projection: {
        ...validProjection,
        milestoneState: "integrating",
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          planned: 1,
          blocked: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          ready: 1,
          recovery_required: 0,
        },
        workProgress: "not_started",
        qualityState: "integration_pending",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "verify_milestone_integration",
      },
    },
    {
      ...base,
      status: "completed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled",
      recoveryIds: [],
      recoveryObligations: [],
      projection: {
        ...validProjection,
        milestoneState: "cancelled",
        objectiveCounts: {
          ...validProjection.objectiveCounts,
          planned: 1,
          blocked: 0,
        },
        taskCounts: {
          ...validProjection.taskCounts,
          cancelled: 1,
          recovery_required: 0,
        },
        workProgress: "in_progress",
        qualityState: "not_evaluated",
        humanDecisionRequired: false,
        recoveryRequired: false,
        nextAction: "wait_for_task",
      },
    },
  ];
  for (const [index, raw] of malformedItems.entries()) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({ runObjective: async () => raw }),
    );
    assert.equal(
      (response.result as { structuredContent: { reason: string } })
        .structuredContent.reason,
      "mcp_coordinator_result_invalid",
      `malformed projection case ${index}`,
    );
  }
});

/**
 * 回復結果の全量をMCP公開DTOへ搬送し集合相関を維持する。
 * @responsibility 旧128件を超えるID・義務の受理と重複・集合差の拒否を確認する。
 * @trace PRL-UT-014
 * @precondition Coordinator依存は合成された129件の回復結果を返す。
 * @stimulus handlerへ正常結果、ID重複、義務重複と片側欠落を渡す。
 * @observation 公開DTOの全配列と不正結果理由。
 * @oracle 正常は順序・件数を保持し不正はmcp_coordinator_result_invalidになる。
 * @cleanup N/A: Process内の値と有限Promiseだけ。
 * @boundary MCP handler→Coordinator代役結果→公開DTO。外部AI・Dockerなし。
 */
test("MCPは129件の回復IDと義務を全量搬送し集合差を拒否する", async () => {
  const recoveryIds = Array.from(
    { length: 129 },
    (_, index) => `host-task.${index}`,
  );
  const recoveryObligations = recoveryIds.map((recoveryId) => ({
    kind: "host",
    recoveryId,
  }));
  const base = {
    contract: "crdd-coordinator/orchestrator-objective-intake/v4",
    status: "blocked",
    reason: "recovery_required",
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    projection: null,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
    recoveryIds,
    recoveryObligations,
    effectState: "unknown",
  };
  const envelope = request("tools/call", {
    _meta: META,
    name: MCP_COORDINATOR_OBJECTIVE_TOOL,
    arguments: objective(),
  });
  const response = await handleMcpCoordinatorRequest(
    envelope,
    dependencies({ runObjective: async () => base }),
  );
  const result = response.result as {
    structuredContent: {
      reason: string;
      recoveryIds: readonly string[];
      recoveryObligations: readonly { kind: string; recoveryId: string }[];
    };
  };
  assert.equal(result.structuredContent.reason, "recovery_required");
  assert.deepEqual(result.structuredContent.recoveryIds, recoveryIds);
  assert.deepEqual(
    result.structuredContent.recoveryObligations,
    recoveryObligations,
  );
  for (const invalid of [
    { ...base, recoveryIds: [...recoveryIds, recoveryIds[0]] },
    {
      ...base,
      recoveryObligations: [...recoveryObligations, recoveryObligations[0]],
    },
    { ...base, recoveryIds: recoveryIds.slice(1) },
    { ...base, recoveryObligations: recoveryObligations.slice(1) },
    {
      ...base,
      recoveryObligations: recoveryObligations.map((entry, index) =>
        index === 0 ? { ...entry, recoveryId: "host-task.other" } : entry,
      ),
    },
  ]) {
    const rejected = await handleMcpCoordinatorRequest(
      envelope,
      dependencies({ runObjective: async () => invalid }),
    );
    assert.equal(
      (rejected.result as { structuredContent: { reason: string } })
        .structuredContent.reason,
      "mcp_coordinator_result_invalid",
    );
  }
});

/**
 * MCP Integration結果はblocked時のcleanupとmanual recoveryを相関検証するを検証する。
 *
 * @responsibility MCP Integration結果はblocked時のcleanupとmanual recoveryを相関検証するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP Integration結果はblocked時のcleanupとmanual recoveryを相関検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP Integration結果はblocked時のcleanupとmanual recoveryを相関検証する", async () => {
  for (const [cleanupConfirmed, manualRecoveryRequired] of [
    [true, true],
    [false, false],
  ] as const) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({
        runObjective: async () => ({
          contract: "crdd-coordinator/orchestrator-integration/v1",
          status: "blocked",
          reason: "integration_blocked",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          stateGeneration: 2,
          candidateId: null,
          receiptId: null,
          cleanupConfirmed,
          manualRecoveryRequired,
          recoveryIds: [],
        }),
      }),
    );
    assert.equal(
      (response.result as { structuredContent: { reason: string } })
        .structuredContent.reason,
      "mcp_coordinator_result_invalid",
    );
  }
});

/**
 * MCPは旧Integration契約を成功や回復参照の有無にかかわらず拒否するを検証する。
 *
 * @responsibility MCPは旧Integration契約を成功や回復参照の有無にかかわらず拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCPは旧Integration契約を成功や回復参照の有無にかかわらず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPは旧Integration契約を成功や回復参照の有無にかかわらず拒否する", async () => {
  const recoveryId = `lease-acquisition-${"1".repeat(40)}`;
  const base = {
    contract: "crdd-coordinator/orchestrator-integration/v1",
    reason: "orchestrator_milestone_accepted",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    stateGeneration: 2,
    candidateId: "candidate-a",
    receiptId: null,
  };
  for (const [raw, isExpectedError, isExpectedAdapterInvalid] of [
    [
      {
        ...base,
        status: "completed",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        recoveryIds: [],
      },
      false,
      false,
    ],
    [
      {
        ...base,
        status: "blocked",
        reason: "repository_runtime_data_ignore_registration_blocked",
        cleanupConfirmed: true,
        manualRecoveryRequired: true,
        recoveryIds: [recoveryId],
        effectIssued: true,
        effectStateUnknown: true,
        retryAllowed: false,
      },
      true,
      false,
    ],
    [
      {
        ...base,
        status: "blocked",
        reason: "orchestrator_candidate_base_cleanup_unconfirmed",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: [],
        effectIssued: false,
        effectStateUnknown: false,
        retryAllowed: false,
      },
      true,
      false,
    ],
    [
      {
        ...base,
        status: "blocked",
        reason: "orchestrator_lease_acquisition_recovery_evidence_mismatch",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: [recoveryId],
      },
      true,
      false,
    ],
    [
      {
        ...base,
        status: "blocked",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: [recoveryId, recoveryId],
      },
      true,
      true,
    ],
    [
      {
        ...base,
        status: "completed",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        recoveryIds: [recoveryId],
      },
      true,
      true,
    ],
    [
      {
        ...base,
        status: "blocked",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: ["not valid"],
      },
      true,
      true,
    ],
  ] as const) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({ runObjective: async () => raw }),
    );
    const result = response.result as {
      structuredContent: {
        reason: string;
        recoveryIds?: readonly string[];
        effectIssued?: boolean;
        effectStateUnknown?: boolean;
        retryAllowed?: boolean;
      };
      isError: boolean;
    };
    assert.equal(
      result.structuredContent.reason,
      "mcp_coordinator_result_invalid",
    );
    assert.equal(result.isError, true);
    void isExpectedError;
    void isExpectedAdapterInvalid;
  }
});

/**
 * MCPは旧Integration契約をDecision付きでも拒否するを検証する。
 *
 * @responsibility MCPは旧Integration契約をDecision付きでも拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCPは旧Integration契約をDecision付きでも拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPは旧Integration契約をDecision付きでも拒否する", async () => {
  const decisionResult = {
    contract: "crdd-coordinator/orchestrator-human-decision/v1",
    status: "completed",
    reason: "decision_issued",
    decisionId: "decision-a",
    recordId: "record-a",
    continuationCapability: "capability-a",
    allowedOptions: ["resume", "cancel"],
    expiresAtEpochMs: Date.now() + 60_000,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled",
  };
  const integrationBase = {
    contract: "crdd-coordinator/orchestrator-integration/v1",
    status: "blocked",
    reason: "integration_conflict",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    stateGeneration: 2,
    candidateId: "candidate-a",
    receiptId: null,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    recoveryIds: [],
  };
  for (const raw of [
    { ...integrationBase, decision: decisionResult },
    {
      ...integrationBase,
      reason: "orchestrator_candidate_base_cleanup_unconfirmed",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectIssued: false,
      effectStateUnknown: false,
      retryAllowed: false,
      decision: decisionResult,
    },
    {
      ...integrationBase,
      reason: "repository_runtime_data_ignore_registration_blocked",
      cleanupConfirmed: true,
      manualRecoveryRequired: true,
      recoveryIds: [`runtime-process.${"1".repeat(40)}`],
      effectIssued: true,
      effectStateUnknown: true,
      retryAllowed: false,
      decision: decisionResult,
    },
  ]) {
    const response = await handleMcpCoordinatorRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_COORDINATOR_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({ runObjective: async () => raw }),
    );
    const result = response.result as {
      structuredContent: Readonly<Record<string, unknown>>;
    };
    assert.equal(
      result.structuredContent.reason,
      "mcp_coordinator_result_invalid",
    );
    assert.equal(Object.hasOwn(result.structuredContent, "decision"), false);
  }
});

/**
 * MCP DecisionはObjective専用fieldを拒否するを検証する。
 *
 * @responsibility MCP DecisionはObjective専用fieldを拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP DecisionはObjective専用fieldを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP DecisionはObjective専用fieldを拒否する", async () => {
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_DECISION_TOOL,
      arguments: decision(),
    }),
    dependencies({
      submitDecision: async () => ({
        contract: "crdd-coordinator/orchestrator-human-decision/v1",
        status: "completed",
        reason: "decision_applied",
        decisionId: "decision-a",
        applicationId: "application-a",
        generation: 5,
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "settled",
        projection: null,
      }),
    }),
  );
  assert.equal(
    (response.result as { structuredContent: { reason: string } })
      .structuredContent.reason,
    "mcp_coordinator_result_invalid",
  );
});

/**
 * MCP contract reports stateless transport and the exact public toolsを検証する。
 *
 * @responsibility MCP contract reports stateless transport and the exact public toolsの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP contract reports stateless transport and the exact public toolsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP contract reports stateless transport and the exact public tools", () => {
  assert.deepEqual(describeMcpCoordinatorAdapterContract(), {
    contract: "crdd-mcp/coordinator-adapter/v6",
    protocolVersion: MCP_COORDINATOR_PROTOCOL_VERSION,
    tools: [
      MCP_COORDINATOR_OBJECTIVE_TOOL,
      MCP_COORDINATOR_DECISION_TOOL,
      MCP_COORDINATOR_STATE_TOOL,
    ],
    transportState: "stateless_per_request",
    clientMetadataAuthority: "none",
    projectModelOwnership: "coordinator",
  });
});

/**
 * JSON-RPC error envelopeはProtocolだけが所有しTransportは再定義しないを検証する。
 *
 * @responsibility JSON-RPC error envelopeはProtocolだけが所有しTransportは再定義しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus JSON-RPC error envelopeはProtocolだけが所有しTransportは再定義しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: mcp Test Source→対象契約
 */
test("JSON-RPC error envelopeはProtocolだけが所有しTransportは再定義しない", () => {
  assert.deepEqual(protocolError(null, -32700, "Parse error"), {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Parse error" },
  });
  const sourceRoot = fileURLToPath(new URL("../../src/mcp", import.meta.url));
  for (const relative of ["transport/stdio.ts", "transport/http.ts"]) {
    const source = fs.readFileSync(path.join(sourceRoot, relative), "utf8");
    assert.doesNotMatch(source, /jsonrpc\s*:/u, relative);
    assert.match(source, /protocolError\(/u, relative);
  }
});

/**
 * Objectiveの変更観測を閉じた公開結果へ搬送する。
 * @responsibility 新旧shape、要求対象相関と失敗field保持を確認する。
 * @trace PRL-UT-014
 * @precondition Providerを呼ばない有限依存。
 * @stimulus 正常観測、別対象、余分fieldと不正な失敗付随観測。
 * @observation MCP応答、公開metadataと一次理由。
 * @oracle 別対象の成功は拒否し失敗の不正観測はnullとする。
 * @cleanup N/A: 値処理だけ。
 * @boundary MCP AdapterとCoordinator結果契約。
 */
test("MCPはWorkspace観測を要求対象へ結合し失敗理由を維持する", async () => {
  const workspaceId = "00000000-0000-4000-8000-000000000001";
  const base = (await dependencies().runObjective(
    objective(),
    new AbortController().signal,
    { principalId: "principal-a" },
  )) as Record<string, unknown>;
  const observation = {
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    result: {
      workspaceId,
      changedPaths: ["source.txt"],
      canonicalRepositoryChanged: false,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    },
  };
  const raw = { ...base, workspaceResults: [observation] };
  const observed = inspectCoordinatorObjectiveResult(raw);
  assert.ok(observed);
  observation.result.changedPaths.push("later.txt");
  assert.deepEqual(
    (observed.workspaceResults as typeof raw.workspaceResults)[0]?.result
      .changedPaths,
    ["source.txt"],
  );
  const response = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: { ...objective(), workspaceId },
    }),
    dependencies({ runObjective: async () => raw }),
  );
  assert.equal((response.result as Record<string, unknown>).isError, false);
  const mismatch = await handleMcpCoordinatorRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_COORDINATOR_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({ runObjective: async () => raw }),
  );
  assert.equal((mismatch.result as Record<string, unknown>).isError, true);
  assert.equal(
    (
      (mismatch.result as Record<string, unknown>).structuredContent as Record<
        string,
        unknown
      >
    ).reason,
    "mcp_coordinator_result_invalid",
  );
  assert.equal(
    inspectCoordinatorObjectiveResult({
      ...raw,
      workspaceResults: [{ ...observation, extra: true }],
    }),
    null,
  );
  const failure = inspectCoordinatorObjectiveResult({
    ...base,
    status: "blocked",
    reason: "original_failure",
    effectState: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    recoveryIds: ["host-task.a"],
    recoveryObligations: [{ kind: "host", recoveryId: "host-task.a" }],
    workspaceResults: [{ ...observation, extra: true }],
  });
  assert.equal(failure?.reason, "original_failure");
  assert.equal(failure?.workspaceResults, null);
  assert.deepEqual(failure?.recoveryIds, ["host-task.a"]);
  assert.equal(
    Object.hasOwn(
      inspectCoordinatorObjectiveResult(base) ?? {},
      "workspaceResults",
    ),
    false,
  );
});
