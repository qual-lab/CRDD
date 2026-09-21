/**
 * coordinator:integration:project-runtime-composition-rootの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-composition-rootが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @trace PPR-IT-001
 * @level IT
 * @scope project、runtime、public、state、mcp
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
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
  MCP_PROJECT_RUNTIME_STATE_TOOL,
} from "../../../mcp/src/index.ts";
import {
  createDevelopmentProjectRuntimePublicObjectiveCandidate,
  createProjectRuntimeExecutionIntelligenceDiagnosticReporter,
  createProjectRuntimeRecoveryDiagnosticReporter,
  projectRuntimeDataBoundaryBlocked,
  PROJECT_RUNTIME_EXECUTION_INTELLIGENCE_PREFIX,
} from "../../src/composition/project-runtime-composition-root.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../runtime-data/src/index.ts";
import { recordProjectRuntimeExecutionEvent } from "../../src/security/execution-intelligence-adapter.ts";
import { createProjectRuntimeWindowsDecisionStoreTestingAdapter } from "../../src/security/project-runtime-windows-decision-store.ts";
import {
  readExecutionIntelligence,
  verifyExecutionIntelligenceRepositoryRoot,
} from "../../../execution-intelligence/src/index.ts";

/**
 * Runtime Data失敗を公開Project Runtime結果まで意味変更せず投影するを検証する。
 *
 * @responsibility Runtime Data失敗を公開Project Runtime結果まで意味変更せず投影するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Data失敗を公開Project Runtime結果まで意味変更せず投影するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("Runtime Data失敗を公開Project Runtime結果まで意味変更せず投影する", () => {
  const error = new RepositoryRuntimeDataAreaBlockedError({
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    effectIssued: true,
    effectStateUnknown: true,
    effectConfirmation: "unknown",
    cleanupConfirmed: false,
    retryAllowed: false,
    recoveryReference: "repository-local-ignore.test-reference",
    repositoryPathReported: false,
  });
  assert.deepEqual(projectRuntimeDataBoundaryBlocked(error), {
    contract: "crdd-coordinator/project-runtime-public-runtime/v1",
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    effectState: "unknown",
    effectIssued: true,
    effectStateUnknown: true,
    retryAllowed: false,
    recoveryIds: ["repository-local-ignore.test-reference"],
  });
});

/**
 * development composition uses the explicitly supplied candidate integration boundaryを検証する。
 *
 * @responsibility development composition uses the explicitly supplied candidate integration boundaryの合否判定を所有する。
 * @trace PPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus development composition uses the explicitly supplied candidate integration boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Adjacent 1 Block: 複数Source Reader→Projector
 */
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
  let shouldBlockExecutionPublication = false;
  let shouldThrowFromPublicationObserver = false;
  let shouldBlockCandidateObservation = false;
  const publicationObservations: object[] = [];
  const runtime = createDevelopmentProjectRuntimePublicObjectiveCandidate({
    issueRuntimeExecutionAuthorization: () => Object.freeze({}),
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
    recordExecutionEvent: (repositoryRoot, event) =>
      shouldBlockExecutionPublication
        ? Object.freeze({
            status: "blocked" as const,
            reason: "execution_event_store_test_unavailable",
            effectState: "unknown" as const,
            cleanupConfirmed: false,
            retryAllowed: false,
            manualRecoveryRequired: true,
            residualArtifactIds: Object.freeze(["test-residual"]),
          })
        : recordProjectRuntimeExecutionEvent(repositoryRoot, event),
    observeExecutionEventPublication: (observation) => {
      publicationObservations.push(observation);
      if (shouldThrowFromPublicationObserver)
        throw new Error("publication_diagnostic_test_failure");
    },
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
          shouldBlockCandidateObservation
            ? Object.freeze({
                status: "blocked" as const,
                reason: "project_runtime_candidate_base_cleanup_unconfirmed",
                effectIssued: false,
                effectStateUnknown: false,
                cleanupConfirmed: false,
                retryAllowed: false,
                recoveryReference: null,
              })
            : Object.freeze({
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
  const before = runtime.runStateQuery(
    {
      requestId: "query-before",
      projectId: "project-public-runtime",
      repositoryRevision: revision,
    },
    root,
    { principalId: "local-user-test-user" },
  );
  assert.equal(before.status, "completed");
  assert.equal(before.observationState, "absent");
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
  const after = runtime.runStateQuery(
    {
      requestId: "query-after",
      projectId: "project-public-runtime",
      repositoryRevision: revision,
    },
    root,
    { principalId: "local-user-test-user" },
  );
  assert.equal(after.status, "completed");
  assert.equal(after.observationState, "observed");
  assert.equal(after.projection?.milestoneState, "accepted");
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
  shouldBlockCandidateObservation = true;
  const cleanupBlocked = await runtime.run(
    {
      requestId: "request-candidate-cleanup-blocked",
      projectId: "project-candidate-cleanup-blocked",
      milestoneId: "milestone-candidate-cleanup-blocked",
      repositoryRevision: revision,
      objective: "Confirm cleanup failure projection.",
      acceptanceCriteria: ["cleanup failure is preserved"],
      allowedPaths: ["result.txt"],
      readPaths: ["result.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      requestedExecutorProvider: "codex",
      adoptResult: true,
    },
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local-user-test-user" }),
  );
  assert.equal(
    cleanupBlocked.reason,
    "project_runtime_candidate_base_cleanup_unconfirmed",
  );
  const cleanupBlockedDetails = cleanupBlocked as Record<string, unknown>;
  assert.equal(cleanupBlockedDetails.effectIssued, false);
  assert.equal(cleanupBlockedDetails.effectStateUnknown, false);
  assert.equal(cleanupBlocked.cleanupConfirmed, false);
  assert.equal(cleanupBlockedDetails.retryAllowed, false);
  assert.equal(cleanupBlocked.manualRecoveryRequired, true);
  assert.deepEqual(cleanupBlocked.recoveryIds, []);
  const verifiedRoot = verifyExecutionIntelligenceRepositoryRoot(root);
  assert.equal(verifiedRoot.status, "completed");
  if (verifiedRoot.status !== "completed")
    throw new Error("execution_intelligence_root_not_verified");
  const executionIntelligenceResult = readExecutionIntelligence(
    verifiedRoot.root,
  );
  assert.equal(executionIntelligenceResult.status, "completed");
  if (executionIntelligenceResult.status !== "completed")
    throw new Error("execution_intelligence_observation_failed");
  assert.equal(executionIntelligenceResult.events.length, 2);
  const primaryExecutionEvent = executionIntelligenceResult.events.find(
    (entry) => entry.identity.projectId === "project-public-runtime",
  );
  assert.equal(
    primaryExecutionEvent?.identity.projectId,
    "project-public-runtime",
  );
  assert.equal(primaryExecutionEvent?.outcome.status, "completed");
  assert.deepEqual(primaryExecutionEvent?.execution.provider, {
    state: "observed",
    value: "codex",
    source: "single_task_verified_completion",
  });
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
      getProjectState: async () => {
        throw new Error("state_query_not_expected");
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

  const mcpState = await handleMcpProjectRuntimeRequest(
    {
      jsonrpc: "2.0",
      id: "state-after-objective",
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
        name: MCP_PROJECT_RUNTIME_STATE_TOOL,
        arguments: {
          requestId: "query-through-mcp",
          projectId: "project-public-runtime",
          repositoryRevision: revision,
        },
      },
    },
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "local-user-test-user",
      }),
      runObjective: async () => {
        throw new Error("objective_not_expected");
      },
      submitDecision: async () => {
        throw new Error("decision_not_expected");
      },
      getProjectState: async (request, authentication) =>
        runtime.runStateQuery(request, root, authentication),
    },
  );
  const mcpStateResult = mcpState.result as {
    structuredContent: {
      observationState: string;
      projection: { milestoneState: string } | null;
      effectState: string;
    };
    isError: boolean;
  };
  assert.equal(mcpStateResult.isError, false);
  assert.equal(mcpStateResult.structuredContent.observationState, "observed");
  assert.equal(
    mcpStateResult.structuredContent.projection?.milestoneState,
    "accepted",
  );
  assert.equal(mcpStateResult.structuredContent.effectState, "no_effect");

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
  assert.equal(taskStarts, 2);
  assert.equal(integrationAdapterCalls, 2);

  shouldBlockExecutionPublication = true;
  const publicationBlocked = await runtime.run(
    {
      requestId: "request-public-runtime-publication-blocked",
      projectId: "project-public-runtime-publication-blocked",
      milestoneId: "milestone-public-runtime-publication-blocked",
      repositoryRevision: revision,
      objective: "Keep the Task result when execution publication is blocked.",
      acceptanceCriteria: ["Task result remains accepted"],
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
  assert.equal(publicationBlocked.status, "completed");
  assert.equal(publicationBlocked.reason, "project_runtime_milestone_accepted");
  assert.equal(
    (publicationObservations.at(-1) as { status?: unknown }).status,
    "blocked",
  );
  assert.equal(taskStarts, 3);

  shouldThrowFromPublicationObserver = true;
  const diagnosticFailed = await runtime.run(
    {
      requestId: "request-public-runtime-diagnostic-failed",
      projectId: "project-public-runtime-diagnostic-failed",
      milestoneId: "milestone-public-runtime-diagnostic-failed",
      repositoryRevision: revision,
      objective: "Keep the Task result when publication diagnostics fail.",
      acceptanceCriteria: ["Task result remains accepted"],
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
  assert.equal(diagnosticFailed.status, "completed");
  assert.equal(diagnosticFailed.reason, "project_runtime_milestone_accepted");
  assert.equal(taskStarts, 4);
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

/**
 * 回復診断を直列化しcallback成功だけを成功として扱うを検証する。
 *
 * @responsibility 回復診断を直列化しcallback成功だけを成功として扱うの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 回復診断を直列化しcallback成功だけを成功として扱うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
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

/**
 * 実行Event発行診断は回復診断と別の閉じた識別子で出力するを検証する。
 *
 * @responsibility 実行Event発行診断は回復診断と別の閉じた識別子で出力するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行Event発行診断は回復診断と別の閉じた識別子で出力するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("実行Event発行診断は回復診断と別の閉じた識別子で出力する", async () => {
  const stream = new ControlledDiagnosticStream();
  const reporter = createProjectRuntimeExecutionIntelligenceDiagnosticReporter(
    stream,
    200,
  );
  const result = reporter.report({
    event: "untrusted_override",
    status: "blocked",
    reason: "execution_event_store_unavailable",
  });
  await new Promise((resolve) => setImmediate(resolve));
  stream.callbacks[0]?.(null);
  assert.equal(await result, "success");
  assert.ok(
    stream.writes[0]?.startsWith(PROJECT_RUNTIME_EXECUTION_INTELLIGENCE_PREFIX),
  );
  assert.match(
    stream.writes[0] ?? "",
    /"event":"project_runtime_execution_intelligence_publication"/u,
  );
  assert.doesNotMatch(stream.writes[0] ?? "", /untrusted_override/u);
  reporter.dispose();
});

/**
 * 回復診断の各終端を区別し失敗後の書込みを停止するを検証する。
 *
 * @responsibility 回復診断の各終端を区別し失敗後の書込みを停止するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 回復診断の各終端を区別し失敗後の書込みを停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
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

/**
 * 回復診断timeout後の遅延callbackとerrorを二重完了にしないを検証する。
 *
 * @responsibility 回復診断timeout後の遅延callbackとerrorを二重完了にしないの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 回復診断timeout後の遅延callbackとerrorを二重完了にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
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

/**
 * 回復診断の同期throwと明示disposeを閉じた結果へ変換するを検証する。
 *
 * @responsibility 回復診断の同期throwと明示disposeを閉じた結果へ変換するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 回復診断の同期throwと明示disposeを閉じた結果へ変換するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
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
