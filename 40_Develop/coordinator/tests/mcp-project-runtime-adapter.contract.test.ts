import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeMcpProjectRuntimeAdapterContract,
  handleMcpProjectRuntimeRequest,
  type McpProjectRuntimeDependencies,
} from "../src/security/mcp-project-runtime-adapter.ts";

const revision = "a".repeat(40);

function envelope() {
  return {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": {
      name: "test-client",
      version: "1.0.0",
    },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
}

function callRequest(overrides: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      _meta: envelope(),
      name: "crdd.run_objective",
      arguments: {
        projectId: "crdd",
        milestoneId: "v0.19",
        repositoryRevision: revision,
        frontProvider: "codex",
        requestedExecutorProvider: "claude",
        objective: "固定されたTaskを一件実行する",
        acceptanceCriteria: ["構造化結果を返す"],
        allowedPaths: ["work/result.txt"],
        readPaths: ["README.md"],
        ...overrides,
      },
    },
  };
}

function dependencies(observations: {
  runs: number;
  bindingChecks: number;
}): McpProjectRuntimeDependencies {
  return Object.freeze({
    verifyProjectBinding: (input) => {
      observations.bindingChecks += 1;
      assert.deepEqual(input, {
        projectId: "crdd",
        milestoneId: "v0.19",
        repositoryRevision: revision,
      });
      return Object.freeze({
        status: "verified" as const,
        bindingCapability: Object.freeze({}),
        repositoryRevision: revision,
      });
    },
    runSingleTask: async (taskRequest, bindingCapability, signal) => {
      observations.runs += 1;
      assert.ok(bindingCapability);
      assert.equal(signal.aborted, false);
      assert.equal(taskRequest.objective, "固定されたTaskを一件実行する");
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_task_completed",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        candidateId: "candidate-1",
        recoveryIds: Object.freeze([]),
      });
    },
  });
}

describe("MCP Project Runtime adapter", () => {
  it("現行Protocolをstatelessにdiscoverする", async () => {
    const result = await handleMcpProjectRuntimeRequest(
      {
        jsonrpc: "2.0",
        id: "discover-1",
        method: "server/discover",
        params: { _meta: envelope() },
      },
      dependencies({ runs: 0, bindingChecks: 0 }),
    );
    assert.equal(result.id, "discover-1");
    assert.deepEqual(
      (result.result as { supportedVersions: string[] }).supportedVersions,
      ["2026-07-28"],
    );
  });

  it("Project Toolだけを列挙する", async () => {
    const result = await handleMcpProjectRuntimeRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: envelope(), cursor: null },
      },
      dependencies({ runs: 0, bindingChecks: 0 }),
    );
    const tools = (result.result as { tools: Array<{ name: string }> }).tools;
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["crdd.run_objective"],
    );
  });

  it("任意のclientInfoとcursor省略をAuthorityなしで受理する", async () => {
    const result = await handleMcpProjectRuntimeRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": { tools: {} },
          },
        },
      },
      dependencies({ runs: 0, bindingChecks: 0 }),
    );
    assert.equal(result.error, undefined);
  });

  it("Binding済みObjectiveをSingle Task Runtimeへ一回だけ渡す", async () => {
    const observations = { runs: 0, bindingChecks: 0 };
    const result = await handleMcpProjectRuntimeRequest(
      callRequest(),
      dependencies(observations),
    );
    assert.equal(observations.bindingChecks, 1);
    assert.equal(observations.runs, 1);
    const structuredContent = (
      result.result as {
        structuredContent: { status: string; cleanupConfirmed: boolean };
      }
    ).structuredContent;
    assert.equal(structuredContent.status, "completed");
    assert.equal(structuredContent.cleanupConfirmed, true);
  });

  it("Binding不一致ではSingle Task Effectを発行しない", async () => {
    const observations = { runs: 0, bindingChecks: 0 };
    const base = dependencies(observations);
    const result = await handleMcpProjectRuntimeRequest(callRequest(), {
      ...base,
      verifyProjectBinding: () => ({
        status: "blocked",
        reason: "project_binding_unknown",
      }),
    });
    assert.equal(observations.runs, 0);
    assert.equal(
      (
        result.result as {
          structuredContent: { reason: string };
        }
      ).structuredContent.reason,
      "project_binding_unknown",
    );
  });

  it("Protocol版・余分field・入力上限の不一致をEffect前に拒否する", async () => {
    for (const request of [
      {
        ...callRequest(),
        params: {
          ...(callRequest().params as Record<string, unknown>),
          _meta: {
            ...envelope(),
            "io.modelcontextprotocol/protocolVersion": "2025-06-18",
          },
        },
      },
      callRequest({ unexpected: true }),
      callRequest({ objective: "x".repeat(16_385) }),
    ]) {
      const observations = { runs: 0, bindingChecks: 0 };
      const result = await handleMcpProjectRuntimeRequest(
        request,
        dependencies(observations),
      );
      assert.equal(result.error?.code, -32602);
      assert.deepEqual(observations, { runs: 0, bindingChecks: 0 });
    }
  });

  it("Single Taskの不正結果と例外を外へ投影しない", async () => {
    for (const runSingleTask of [
      async () => ({ status: "completed", raw: "provider output" }),
      async () => {
        throw new Error("sensitive provider failure");
      },
    ]) {
      const result = await handleMcpProjectRuntimeRequest(callRequest(), {
        verifyProjectBinding: () => ({
          status: "verified",
          bindingCapability: {},
          repositoryRevision: revision,
        }),
        runSingleTask,
      });
      const structuredContent = (
        result.result as { structuredContent: { reason: string } }
      ).structuredContent;
      assert.equal(
        structuredContent.reason,
        "project_runtime_single_task_result_invalid",
      );
      assert.equal(JSON.stringify(result).includes("sensitive"), false);
      assert.equal(JSON.stringify(result).includes("provider output"), false);
    }
  });

  it("Client metadataをAuthorityへ使わない契約を示す", () => {
    assert.deepEqual(describeMcpProjectRuntimeAdapterContract(), {
      contract: "crdd-coordinator/mcp-project-runtime-adapter/v1",
      protocolVersion: "2026-07-28",
      toolName: "crdd.run_objective",
      transportState: "stateless_per_request",
      clientMetadataAuthority: "none",
      projectModelOwnership: "coordinator_core",
      repositoryBinding: "runtime_verified_explicit_binding_only",
    });
  });
});
