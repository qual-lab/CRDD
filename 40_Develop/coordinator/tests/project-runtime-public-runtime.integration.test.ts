import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import test from "node:test";

import {
  handleMcpProjectRuntimeRequest,
  MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
} from "../src/security/mcp-project-runtime-adapter.ts";
import {
  createDevelopmentProjectRuntimePublicObjectiveCandidate,
  createProjectRuntimeRecoveryDiagnosticReporter,
} from "../src/security/project-runtime-public-runtime.ts";
import { createProjectRuntimeWindowsDecisionStoreTestingAdapter } from "../src/security/project-runtime-windows-decision-store.ts";

test("development composition uses the explicitly supplied candidate integration boundary", async (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-public-runtime-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    ["-C", root, "config", "user.email", "test@example.invalid"],
    {
      windowsHide: true,
    },
  );
  execFileSync("git", ["-C", root, "config", "user.name", "CRDD Test"], {
    windowsHide: true,
  });
  fs.writeFileSync(path.join(root, "result.txt"), "base\n", "utf8");
  execFileSync("git", ["-C", root, "add", "result.txt"], {
    windowsHide: true,
  });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"], {
    windowsHide: true,
  });
  const revision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  const decisionRoot = path.join(root, ".decision-store");
  fs.mkdirSync(decisionRoot);
  const decisionStore =
    createProjectRuntimeWindowsDecisionStoreTestingAdapter(decisionRoot);
  let integrationAdapterCalls = 0;
  let taskStarts = 0;
  const runtime = createDevelopmentProjectRuntimePublicObjectiveCandidate({
    issueTaskAuthority: () => Object.freeze({}),
    startTask: () => {
      taskStarts += 1;
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started" as const,
        controlCapability: Object.freeze({}),
        completion: Promise.resolve(
          Object.freeze({
            status: "completed" as const,
            reason: "coordinator_task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            candidateId: "candidate-task",
            hostRecoveryId: null,
            dockerRecoveryId: null,
            candidateRecoveryId: null,
            candidateStoreRecoveryId: null,
            dockerRecoveryIds: Object.freeze([]),
            candidateRevision: null,
            executorProvider: "codex",
            reviewerProvider: "claude",
            canonicalRepositoryChanged: false,
          }),
        ),
        rawOutputReported: false as const,
        hostPathReported: false as const,
        untrustedProviderTextReported: false as const,
        credentialAbsenceVerified: false as const,
      });
    },
    cancelTask: () =>
      Promise.resolve(
        Object.freeze({
          status: "blocked" as const,
          reason: "coordinator_task_control_invalid" as const,
        }),
      ),
    frontProviderForTask: () => "codex",
    openDecisionStore: () =>
      Object.freeze({
        status: "completed" as const,
        principalId: "local-user-test-user",
        store: decisionStore,
      }),
    createIntegrationAdapter: () => {
      integrationAdapterCalls += 1;
      return Object.freeze({
        createCandidate: async ({
          state,
        }: {
          state: {
            repositoryRevision: string;
            objectives: readonly { definition: { id: string } }[];
            milestoneId: string;
          };
        }) =>
          Object.freeze({
            status: "candidate" as const,
            candidateId: "candidate-integrated",
            candidateHash: "b".repeat(64),
            baseRevision: state.repositoryRevision,
            changedPaths: Object.freeze(["result.txt"]),
            objectiveEvidence: Object.freeze({
              [state.objectives[0]?.definition.id ?? "missing"]: Object.freeze([
                "evidence-objective",
              ]),
            }),
            milestoneEvidence: Object.freeze(["evidence-milestone"]),
            conflicts: Object.freeze([]),
            cleanupConfirmed: true,
          }),
        observeCanonicalRepository: () =>
          Object.freeze({
            status: "observed" as const,
            repositoryRevision: revision,
            dirty: false,
            observedPaths: Object.freeze([]),
          }),
        adoptCandidate: async () => {
          throw new Error("adoption_must_not_be_used");
        },
      });
    },
  });
  const result = await runtime.run(
    {
      requestId: "request-public-runtime",
      projectId: "project-public-runtime",
      milestoneId: "milestone-public-runtime",
      repositoryRevision: revision,
      objective: "Create the bounded result.",
      acceptanceCriteria: ["result accepted"],
      allowedPaths: ["result.txt"],
      readPaths: ["result.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      requestedExecutorProvider: "codex",
      adoptResult: false,
    },
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local-user-test-user" }),
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(result.reason, "project_runtime_milestone_accepted");
  assert.equal(
    result.contract,
    "crdd-coordinator/project-runtime-objective-intake/v1",
  );
  assert.equal(result.requestId, "request-public-runtime");
  assert.equal(result.projectId, "project-public-runtime");
  assert.equal(result.milestoneId, "milestone-public-runtime");
  assert.equal(result.projection?.milestoneState, "accepted");
  assert.equal(result.effectState, "settled");
  assert.equal(integrationAdapterCalls, 1);
  assert.equal(taskStarts, 1);
  const mcp = await handleMcpProjectRuntimeRequest(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
        name: MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
        arguments: {
          requestId: "request-public-runtime",
          projectId: "project-public-runtime",
          milestoneId: "milestone-public-runtime",
          repositoryRevision: revision,
          objective: "Create the bounded result.",
          acceptanceCriteria: ["result accepted"],
          allowedPaths: ["result.txt"],
          readPaths: ["result.txt"],
          maximumConcurrency: 1,
          maximumReplans: 0,
          originLane: "interactive",
          requestedExecutorProvider: "codex",
          adoptResult: false,
        },
      },
    },
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "local-user-test-user",
      }),
      runObjective: async () => result,
      submitDecision: async () => {
        throw new Error("decision_not_expected");
      },
    },
  );
  const mcpResult = mcp.result as {
    structuredContent: {
      status: string;
      reason: string;
      recoveryIds: string[];
    };
    isError: boolean;
  };
  assert.equal(mcpResult.isError, false);
  assert.equal(mcpResult.structuredContent.status, "completed");
  assert.equal(
    mcpResult.structuredContent.reason,
    "project_runtime_milestone_accepted",
  );
  assert.deepEqual(mcpResult.structuredContent.recoveryIds, []);

  const replay = await runtime.run(
    {
      requestId: "request-public-runtime",
      projectId: "project-public-runtime",
      milestoneId: "milestone-public-runtime",
      repositoryRevision: revision,
      objective: "Create the bounded result.",
      acceptanceCriteria: ["result accepted"],
      allowedPaths: ["result.txt"],
      readPaths: ["result.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      requestedExecutorProvider: "codex",
      adoptResult: false,
    },
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local-user-test-user" }),
  );
  assert.equal(replay.status, "completed", JSON.stringify(replay));
  assert.equal(replay.reason, "project_runtime_objective_already_accepted");
  assert.equal(taskStarts, 1);
  assert.equal(integrationAdapterCalls, 1);
});

class ControlledDiagnosticStream extends Writable {
  readonly writes: string[] = [];
  readonly callbacks: ((error?: Error | null) => void)[] = [];
  entries = 0;

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.entries += 1;
    this.writes.push(chunk.toString("utf8"));
    this.callbacks.push(callback);
  }
}

test("回復診断を直列化しcallback成功だけを成功として扱う", async () => {
  const stream = new ControlledDiagnosticStream({ highWaterMark: 1 });
  const reporter = createProjectRuntimeRecoveryDiagnosticReporter(stream, 200);
  const first = reporter.report({ phase: "required" });
  const second = reporter.report({ phase: "recovering" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stream.entries, 1);
  assert.match(stream.writes[0] ?? "", /"phase":"required"/u);
  stream.callbacks[0]?.(null);
  assert.equal(await first, "success");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stream.entries, 2);
  stream.callbacks[1]?.(null);
  assert.equal(await second, "success");
  reporter.dispose();
});

test("回復診断の各終端を区別し失敗後の書込みを停止する", async (t) => {
  const cases = [
    {
      expected: "callback_error",
      settle: (stream: ControlledDiagnosticStream) =>
        stream.callbacks[0]?.(new Error("callback_failure")),
    },
    {
      expected: "stream_error",
      settle: (stream: ControlledDiagnosticStream) =>
        stream.emit("error", new Error("stream_failure")),
    },
    {
      expected: "stream_close",
      settle: (stream: ControlledDiagnosticStream) => stream.emit("close"),
    },
  ] as const;
  for (const item of cases) {
    await t.test(item.expected, async () => {
      const stream = new ControlledDiagnosticStream();
      const baselineErrorListeners = stream.listenerCount("error");
      const baselineCloseListeners = stream.listenerCount("close");
      const reporter = createProjectRuntimeRecoveryDiagnosticReporter(
        stream,
        200,
      );
      const result = reporter.report({ phase: "required" });
      await new Promise((resolve) => setImmediate(resolve));
      item.settle(stream);
      assert.equal(await result, item.expected);
      assert.equal(
        await reporter.report({ phase: "recovering" }),
        "unavailable",
      );
      await new Promise((resolve) => setImmediate(resolve));
      reporter.dispose();
      assert.equal(stream.listenerCount("error"), baselineErrorListeners);
      assert.equal(stream.listenerCount("close"), baselineCloseListeners);
    });
  }
});

test("回復診断timeout後の遅延callbackとerrorを二重完了にしない", async () => {
  const stream = new ControlledDiagnosticStream();
  const reporter = createProjectRuntimeRecoveryDiagnosticReporter(stream, 10);
  const result = reporter.report({ phase: "required" });
  assert.equal(await result, "timeout");
  stream.callbacks[0]?.(null);
  stream.emit("error", new Error("late_stream_failure"));
  assert.equal(await reporter.report({ phase: "recovering" }), "unavailable");
  reporter.dispose();
});

test("回復診断の同期throwと明示disposeを閉じた結果へ変換する", async () => {
  class ThrowingDiagnosticStream extends Writable {
    override write(): boolean {
      throw new Error("write_failure");
    }
  }
  const throwing = new ThrowingDiagnosticStream();
  const throwingReporter = createProjectRuntimeRecoveryDiagnosticReporter(
    throwing,
    200,
  );
  assert.equal(await throwingReporter.report({ phase: "required" }), "throw");
  throwingReporter.dispose();

  const pending = new ControlledDiagnosticStream();
  const reporter = createProjectRuntimeRecoveryDiagnosticReporter(pending, 200);
  const result = reporter.report({ phase: "required" });
  await new Promise((resolve) => setImmediate(resolve));
  reporter.dispose();
  assert.equal(await result, "unavailable");
});
