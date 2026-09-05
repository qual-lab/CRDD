import assert from "node:assert/strict";
import test from "node:test";

import {
  describeMcpProjectRuntimeAdapterContract,
  handleMcpProjectRuntimeRequest,
  MCP_PROJECT_RUNTIME_DECISION_TOOL,
  MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  type McpProjectRuntimeDependencies,
} from "../../src/security/mcp-project-runtime-adapter.ts";

const revision = "a".repeat(40);
const META = Object.freeze({
  "io.modelcontextprotocol/protocolVersion":
    MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});
function request(method: string, params: unknown, id = 1) {
  return { jsonrpc: "2.0", id, method, params };
}
function objective() {
  return {
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
  };
}

test("MCP semantic operations require a runtime-observed client principal before effects", async () => {
  let effects = 0;
  const result = await handleMcpProjectRuntimeRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
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
    "project_runtime_mcp_client_not_authenticated",
  );
});
function decision() {
  return {
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 4,
    repositoryRevision: revision,
    selectedOption: "resume",
    continuationCapability: "opaque-public-capability",
  };
}
function dependencies(
  overrides: Partial<McpProjectRuntimeDependencies> = {},
): McpProjectRuntimeDependencies {
  return {
    runObjective: async (input) => ({
      contract: "crdd-coordinator/project-runtime-objective-intake/v1",
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
    submitDecision: async (input) => ({
      contract: "crdd-coordinator/project-runtime-human-decision/v1",
      status: "completed",
      reason: "decision_complete",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled",
      decisionId: input.decisionId,
      applicationId: "application-a",
      generation: 5,
    }),
    ...overrides,
    authenticateClient:
      overrides.authenticateClient ??
      (() => ({ status: "verified", principalId: "principal-a" })),
  };
}

test("MCP discovery and tool list expose only the two v0.19 public operations", async () => {
  const discover = await handleMcpProjectRuntimeRequest(
    request("server/discover", { _meta: META }),
    dependencies(),
  );
  assert.equal(discover.error, undefined);
  const listed = await handleMcpProjectRuntimeRequest(
    request("tools/list", { _meta: META }),
    dependencies(),
  );
  assert.equal(listed.error, undefined);
  const tools = (listed.result as { tools: readonly { name: string }[] }).tools;
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL, MCP_PROJECT_RUNTIME_DECISION_TOOL],
  );
});

test("MCP Objective uses the common semantic entry and preserves cancellation", async () => {
  const controller = new AbortController();
  let observedRequestId: unknown = null;
  const response = await handleMcpProjectRuntimeRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
      arguments: objective(),
    }),
    dependencies({
      runObjective: async (input, signal, authentication) => {
        observedRequestId = input.requestId;
        assert.equal(signal, controller.signal);
        assert.deepEqual(authentication, { principalId: "principal-a" });
        return {
          contract: "crdd-coordinator/project-runtime-objective-intake/v1",
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

test("MCP Decision uses a separate entry and never forwards comment to Objective", async () => {
  let calls = 0;
  const response = await handleMcpProjectRuntimeRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_PROJECT_RUNTIME_DECISION_TOOL,
      arguments: { ...decision(), comment: "確認済み" },
    }),
    dependencies({
      runObjective: async () => {
        throw new Error("not_expected");
      },
      submitDecision: async (input, authentication) => {
        calls += 1;
        assert.equal(input.selectedOption, "resume");
        assert.deepEqual(authentication, { principalId: "principal-a" });
        return {
          contract: "crdd-coordinator/project-runtime-human-decision/v1",
          status: "completed",
          reason: "decision_applied",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "settled",
          decisionId: input.decisionId,
          applicationId: "application-a",
          generation: 5,
        };
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal((response.result as { isError: boolean }).isError, false);
});

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
    [MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL, { ...objective(), authority: true }],
    [MCP_PROJECT_RUNTIME_DECISION_TOOL, { ...decision(), generation: 0 }],
    [
      MCP_PROJECT_RUNTIME_DECISION_TOOL,
      { ...decision(), comment: "line1\nline2" },
    ],
  ] as const) {
    const response = await handleMcpProjectRuntimeRequest(
      request("tools/call", { _meta: META, name, arguments: args }),
      deps,
    );
    assert.equal(response.error?.code, -32602);
  }
  assert.equal(effects, 0);
});

test("MCP fails closed when a semantic result is malformed", async () => {
  const response = await handleMcpProjectRuntimeRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
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
    "project_runtime_adapter_result_invalid",
  );
});

test("MCPは内部Task fieldを公開結果へ透過しない", async () => {
  for (const extra of [
    { taskId: "task-internal" },
    { phase: "handoff_prepared" },
  ]) {
    const response = await handleMcpProjectRuntimeRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({
        runObjective: async () => ({
          contract: "crdd-coordinator/project-runtime-objective-intake/v1",
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
      "project_runtime_adapter_result_invalid",
    );
  }
});

test("MCP公開結果は入れ子、相関、操作別fieldを閉じたDTOへ再構成する", async () => {
  const base = {
    contract: "crdd-coordinator/project-runtime-objective-intake/v1",
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
          recovery_required: 1025,
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
          recovery_required: Number.MAX_SAFE_INTEGER,
        },
        objectiveTaskSummaries: [
          {
            ...validProjection.objectiveTaskSummaries[0],
            taskCounts: {
              ...validProjection.taskCounts,
              recovery_required: Number.MAX_SAFE_INTEGER,
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
          recovery_required: 1025,
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
    const response = await handleMcpProjectRuntimeRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({ runObjective: async () => raw }),
    );
    assert.equal(
      (response.result as { structuredContent: { reason: string } })
        .structuredContent.reason,
      "project_runtime_adapter_result_invalid",
      `malformed projection case ${index}`,
    );
  }
});

test("MCP Integration結果はblocked時のcleanupとmanual recoveryを相関検証する", async () => {
  for (const [cleanupConfirmed, manualRecoveryRequired] of [
    [true, true],
    [false, false],
  ] as const) {
    const response = await handleMcpProjectRuntimeRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({
        runObjective: async () => ({
          contract: "crdd-coordinator/project-runtime-integration/v1",
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
      "project_runtime_adapter_result_invalid",
    );
  }
});

test("MCP Integration結果はCanonical recoveryIdsを保持し不正な集合を拒否する", async () => {
  const recoveryId = `lease-acquisition-${"1".repeat(40)}`;
  const base = {
    contract: "crdd-coordinator/project-runtime-integration/v1",
    reason: "project_runtime_milestone_accepted",
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
        reason: "project_runtime_lease_acquisition_recovery_evidence_mismatch",
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
    const response = await handleMcpProjectRuntimeRequest(
      request("tools/call", {
        _meta: META,
        name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
        arguments: objective(),
      }),
      dependencies({ runObjective: async () => raw }),
    );
    const result = response.result as {
      structuredContent: { reason: string; recoveryIds?: readonly string[] };
      isError: boolean;
    };
    if (isExpectedAdapterInvalid)
      assert.equal(
        result.structuredContent.reason,
        "project_runtime_adapter_result_invalid",
      );
    else {
      assert.deepEqual(result.structuredContent.recoveryIds, raw.recoveryIds);
      assert.equal(result.isError, isExpectedError);
    }
  }
});

test("MCP DecisionはObjective専用fieldを拒否する", async () => {
  const response = await handleMcpProjectRuntimeRequest(
    request("tools/call", {
      _meta: META,
      name: MCP_PROJECT_RUNTIME_DECISION_TOOL,
      arguments: decision(),
    }),
    dependencies({
      submitDecision: async () => ({
        contract: "crdd-coordinator/project-runtime-human-decision/v1",
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
    "project_runtime_adapter_result_invalid",
  );
});

test("MCP contract reports stateless transport and the exact public tools", () => {
  assert.deepEqual(describeMcpProjectRuntimeAdapterContract(), {
    contract: "crdd-coordinator/mcp-project-runtime-adapter/v2",
    protocolVersion: MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
    tools: [
      MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
      MCP_PROJECT_RUNTIME_DECISION_TOOL,
    ],
    transportState: "stateless_per_request",
    clientMetadataAuthority: "none",
    projectModelOwnership: "coordinator_core",
  });
});
