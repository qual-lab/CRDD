/**
 * orchestrator:integration:public-operationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:integration:public-operationが所有する検証責務を実行する。
 * @trace PPR-IT-001
 * @trace PRL-IT-005
 * @trace PRL-IT-008
 * @level IT
 * @scope project、runtime、public、state
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import { getModelCatalog } from "../../../ai-adapter/src/index.ts";
import { saveRepositoryAiSelection } from "../../../configuration-model/src/index.ts";
import {
  ExecutionStorageBlockedError,
  initializeExecutionStore,
} from "../../../execution-model/src/index.ts";
import { withCallerPlan } from "../../../execution-model/tests/fixtures/execution-plan.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
  RepositoryDataBlockedError,
} from "../../src/configuration/runtime-data.ts";
import { executeCoordinatorPublicAcceptanceDecision } from "../../src/decision/acceptance.ts";
import {
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  inspectCoordinatorDecisionResult,
} from "../../src/decision/request.ts";
import {
  COORDINATOR_EXECUTION_INTELLIGENCE_PREFIX,
  createCoordinatorExecutionIntelligenceDiagnosticReporter,
  createCoordinatorRecoveryDiagnosticReporter,
} from "../../src/execution/diagnostics.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createDevelopmentCoordinatorPublicObjectiveCandidate } from "../../src/objective/composition.ts";
import { coordinatorDataBoundaryBlocked } from "../../src/state/result.ts";

/**
 * Co所在初期化の失敗をEM失敗と区別して同じ完成結果へ投影する。
 * @responsibility 型の所有者変更でEffect・解放不明を失わせない。
 * @trace PRL-IT-005
 * @precondition 合成例外のみを使用する。
 * @stimulus 既知Effectと元回復参照、Lock解放不明のcauseを渡す。
 * @observation 公開結果のreason・Effect・回復参照・再試行可否。
 * @oracle 元情報を保持し、解放不明時は清掃成功・再試行可能へ変換しない。
 * @cleanup メモリ内のみ。
 * @boundary 公開結果への局所接続。実保存は行わない。
 */
test("Co所在初期化の例外は公開結果でEffectと回復参照を保持する", () => {
  const error = new RepositoryDataBlockedError({
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    effectIssued: true,
    effectStateUnknown: false,
    effectConfirmation: "unknown",
    cleanupConfirmed: true,
    retryAllowed: true,
    recoveryReference: "repository-local-ignore.fixture",
    repositoryPathReported: false,
  });
  error.cause = "coordinator_snapshot_lock_release_unconfirmed";
  const result = coordinatorDataBoundaryBlocked(error);
  assert.equal(result.reason, error.reason);
  assert.equal(result.effectIssued, true);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.retryAllowed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.deepEqual(result.recoveryIds, [error.recoveryReference]);
});

import {
  executionSelection,
  selectionConfig,
} from "../fixtures/ai-selection.ts";

/**
 * Runtime Data失敗を公開Coordinator結果まで意味変更せず投影するを検証する。
 *
 * @responsibility Runtime Data失敗を公開Coordinator結果まで意味変更せず投影するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Data失敗を公開Coordinator結果まで意味変更せず投影するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Runtime Data失敗を公開Orchestrator結果まで意味変更せず投影する", async (t) => {
  const error = new ExecutionStorageBlockedError({
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
  assert.deepEqual(coordinatorDataBoundaryBlocked(error), {
    contract: "crdd-coordinator/public-runtime/v2",
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
  for (const effectState of ["unknown", "settled", "no_effect"] as const) {
    const result = {
      contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
      status: "blocked",
      reason: error.reason,
      decisionId: "decision-a",
      recoveryId: error.recoveryReference,
      decision: null,
      history: null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState,
    };
    assert.deepEqual(inspectCoordinatorDecisionResult(result), result);
    assert.equal(
      inspectCoordinatorDecisionResult({ ...result, status: "completed" }),
      null,
    );
    assert.equal(
      inspectCoordinatorDecisionResult({
        ...result,
        manualRecoveryRequired: false,
      }),
      null,
    );
  }
  const domain = await import("../../../execution-model/src/index.ts");
  let currentError = error;
  t.mock.module("../../../execution-model/src/index.ts", {
    namedExports: {
      ...domain,
      readDecision: () => {
        throw currentError;
      },
    },
  });
  t.mock.module("../../src/execution/persistence.ts", {
    namedExports: {
      verifyRuntimePersistenceRepository: () => ({}),
      historyRepositoryInput: () => {
        throw new Error("unexpected_history_boundary");
      },
    },
  });
  const modulePath = "../../src/decision/lifecycle.ts?boundary-failure-test";
  const { executeCoordinatorPublicDecision } = await import(modulePath);
  for (const [issued, unknown, cleanup] of [
    [true, true, false],
    [true, false, true],
    [false, false, true],
  ] as const) {
    currentError = new ExecutionStorageBlockedError({
      status: "blocked",
      reason: "repository_runtime_data_ignore_registration_blocked",
      effectIssued: issued,
      effectStateUnknown: unknown,
      effectConfirmation: issued || unknown ? "unknown" : "not_issued",
      cleanupConfirmed: cleanup,
      retryAllowed: false,
      recoveryReference: "repository-local-ignore.exact-reference",
      repositoryPathReported: false,
    });
    if (!issued)
      Object.defineProperty(currentError, "cause", {
        value: "coordinator_snapshot_lock_release_unconfirmed",
      });
    const result = executeCoordinatorPublicDecision(
      {
        operation: "apply",
        decisionId: "decision-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        generation: 1,
        repositoryRevision: "a".repeat(40),
      },
      path.resolve(import.meta.dirname, "../../../.."),
      { principalId: "operator-a" },
    );
    const expected = coordinatorDataBoundaryBlocked(currentError);
    assert.equal(result.reason, expected.reason);
    assert.equal(result.recoveryId, expected.recoveryIds[0]);
    assert.equal(result.effectState, expected.effectState);
    assert.equal(result.cleanupConfirmed, expected.cleanupConfirmed);
    assert.equal(
      result.manualRecoveryRequired,
      expected.manualRecoveryRequired,
    );
    assert.deepEqual(inspectCoordinatorDecisionResult(result), result);
  }
});

/**
 * 開発用構成はTask終了後に明示品質受入を要求し再入場で再送しないを検証する。
 *
 * @responsibility 開発用構成はTask終了後に明示品質受入を要求し再入場で再送しないの合否判定を所有する。
 * @trace PPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開発用構成はTask終了後に明示品質受入を要求し再入場で再送しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Direct Boundary: orchestrator Test Source→対象契約
 */
test("開発用構成はTask終了後に明示品質受入を要求し再入場で再送しない", async (t) => {
  const root = fs.mkdtempSync(
    path.join(
      requireReadyRepositoryExecutionDataArea(
        ensureRepositoryExecutionDataAreaFromWorkingDirectory(
          path.resolve(import.meta.dirname, "../../../.."),
          "tests",
        ),
        "fixture_root_invalid",
      ).directory,
      "crdd-project-public-runtime-",
    ),
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
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw new Error("fixture_root_not_verified");
  assert.equal(
    saveRepositoryAiSelection(
      verified.capability,
      { expectedIdentity: null, config: selectionConfig() },
      () => true,
      getModelCatalog().catalog,
    ).status,
    "saved",
  );
  const initialized = initializeExecutionStore(
    verifyRuntimePersistenceRepository(root),
    `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`,
  );
  assert.equal(initialized.status, "completed");
  let intakeEpoch = initialized.value as string;
  let taskStarts = 0;
  const deliveredRequests: Readonly<Record<string, unknown>>[] = [];
  const publicationObservations: object[] = [];
  const runtime = createDevelopmentCoordinatorPublicObjectiveCandidate({
    startTask: (
      taskRequest,
      _root,
      _correlation,
      notifyStarted,
      consumer,
      workspaceTarget,
    ) => {
      taskStarts += 1;
      const delivered = taskRequest as Readonly<Record<string, unknown>>;
      deliveredRequests.push(delivered);
      const selections = delivered.taskExecutionSelections as {
        executor: unknown;
        reviewer: unknown;
      };
      assert.deepEqual(
        selections.executor,
        executionSelection("executor", {
          provider: "codex",
          model: "gpt-5.5",
          effort: "medium",
        }),
      );
      assert.equal(Object.hasOwn(delivered, "requestedProfileId"), false);
      assert.equal(Object.hasOwn(delivered, "frontProvider"), false);
      assert.equal(consumer, "orchestrator");
      assert.deepEqual(workspaceTarget, {
        workspaceId: null,
        ownerRepositoryRoot: root,
        executionTree: root,
        baseCommit: null,
        head: null,
      });
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started" as const,
        controlCapability: Object.freeze({}),
        completion: Promise.resolve().then(async () => {
          assert.ok(notifyStarted);
          assert.equal(
            await notifyStarted({
              event: "coordinator_provider_process_started",
              taskRole: "executor",
              provider: "codex",
              operationId: `OP-fixture-${taskStarts}`,
            }),
            undefined,
          );
          return Object.freeze({
            status: "completed" as const,
            reason: "coordinator_task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            candidateId: null,
            hostRecoveryId: null,
            dockerRecoveryId: null,
            candidateRecoveryId: null,
            candidateStoreRecoveryId: null,
            dockerRecoveryIds: Object.freeze([]),
            candidateRevision: null,
            executorProvider: "codex",
            reviewerProvider: "claude",
            canonicalRepositoryChanged: false,
            workspaceResult: {
              workspaceId: null,
              changedPaths: [],
              canonicalRepositoryChanged: false,
              changeAttribution: "unattributed",
              workspaceDeletionIssued: false,
            },
          });
        }),
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
  });
  // 主体欠測・不正は保存先の観測・初期化より前に拒否する。
  for (const context of [
    undefined,
    { principalId: "" },
    { principalId: " bad" },
  ]) {
    const denied = runtime.runStateQuery(
      {
        requestId: "query-no-principal",
        projectId: "project-public-runtime",
        repositoryRevision: revision,
      },
      root,
      context,
    );
    assert.equal(
      denied.reason,
      "orchestrator_authenticated_principal_not_verified",
    );
    const decisionDenied = runtime.runDecision(
      {
        operation: "answer",
        decisionId: "decision-no-principal",
        projectId: "project-public-runtime",
        milestoneId: "milestone-public-runtime",
        generation: 1,
        repositoryRevision: revision,
        selectedOption: "cancel",
      },
      root,
      context,
    );
    assert.equal(
      decisionDenied.reason,
      "orchestrator_authenticated_principal_not_verified",
    );
    const acceptanceDenied = executeCoordinatorPublicAcceptanceDecision(
      {},
      root,
      context,
    );
    assert.equal(
      acceptanceDenied.reason,
      "orchestrator_authenticated_principal_not_verified",
    );
    assert.ok("effectState" in acceptanceDenied);
    assert.equal(acceptanceDenied.effectState, "no_effect");
  }
  const before = runtime.runStateQuery(
    {
      requestId: "query-before",
      projectId: "project-public-runtime",
      repositoryRevision: revision,
    },
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(before.status, "completed");
  assert.equal(before.observationState, "absent");
  const result = await runtime.run(
    withCallerPlan({
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
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: false,
      intakeEpoch,
    }),
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local.email.fixture@example.invalid" }),
  );
  assert.equal(result.status, "blocked", JSON.stringify(result));
  assert.equal(result.reason, "orchestrator_quality_acceptance_required");
  const resumedPending = await runtime.run(
    withCallerPlan({
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
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: false,
      intakeEpoch,
    }),
    new AbortController().signal,
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(
    resumedPending.reason,
    "orchestrator_quality_acceptance_required",
  );
  assert.equal(resumedPending.queueId, result.queueId);
  assert.equal(resumedPending.workspaceResults, undefined);
  assert.equal(taskStarts, 1);
  let pending = runtime.runStateQuery(
    {
      requestId: "query-acceptance-pending",
      projectId: "project-public-runtime",
      repositoryRevision: revision,
    },
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(pending.status, "completed");
  if (!("projection" in pending) || pending.projection === null)
    throw new Error("acceptance_pending_projection_missing");
  const objectiveId = pending.projection.objectiveTaskSummaries[0]?.objectiveId;
  assert.ok(objectiveId);
  let expectedGeneration = pending.projection.generation;
  /**
   * 指定対象へ明示的な受入判断を記録する。
   *
   * @responsibility ObjectiveとMilestoneの受入判断を同じPublic Contractで実行する。
   * @trace PRL-IT-008
   * @precondition 対象IDと現在Generationが取得済みである。
   * @stimulus accept判断とEvidence IDを受入判断入口へ渡す。
   * @observation 判断結果と更新後Generationを取得する。
   * @oracle 明示判断なしに受入状態へ遷移しない。
   * @cleanup N/A: 試験の一時Repositoryは外側のcleanupが回収する。
   * @boundary PRL-IT-008=Adjacent 1 Block: Public Acceptance Entry→Durable Decision Store
   */
  const decide = (
    target: "objective" | "milestone",
    targetId: string,
    decisionId: string,
    evidenceId: string,
    principalId = "local.email.fixture@example.invalid",
  ) =>
    executeCoordinatorPublicAcceptanceDecision(
      {
        contract: "crdd-coordinator/orchestrator-acceptance-decision/v1",
        decisionId,
        blockerId: `blocker-${decisionId}`,
        sourceSpecId: "SPEC-000002",
        projectId: "project-public-runtime",
        milestoneId: "milestone-public-runtime",
        repositoryRevision: revision,
        expectedGeneration,
        target,
        targetId,
        decision: "accept",
        criterionEvidenceIds: [evidenceId],
        principalId: "local.email.fixture@example.invalid",
      },
      root,
      { principalId },
    );
  const differentUser = decide(
    "objective",
    objectiveId,
    "decision-wrong-user",
    "evidence-objective",
    "other-user",
  );
  assert.equal(
    differentUser.reason,
    "orchestrator_authenticated_principal_not_verified",
  );
  assert.ok("effectState" in differentUser);
  assert.equal(differentUser.effectState, "no_effect");
  assert.equal(
    decide(
      "objective",
      objectiveId,
      "decision-objective-public-runtime",
      "evidence-objective",
    ).status,
    "completed",
  );
  pending = runtime.runStateQuery(
    {
      requestId: "query-objective-accepted",
      projectId: "project-public-runtime",
      repositoryRevision: revision,
    },
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  if (!("projection" in pending) || pending.projection === null)
    throw new Error("objective_accepted_projection_missing");
  expectedGeneration = pending.projection.generation;
  assert.equal(
    decide(
      "milestone",
      "milestone-public-runtime",
      "decision-milestone-public-runtime",
      "evidence-milestone",
    ).status,
    "completed",
  );
  const after = runtime.runStateQuery(
    {
      requestId: "query-after",
      projectId: "project-public-runtime",
      repositoryRevision: revision,
    },
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(after.status, "completed");
  assert.equal(after.observationState, "observed");
  assert.equal(after.projection?.milestoneState, "accepted");
  if ("intakeEpoch" in after && typeof after.intakeEpoch === "string")
    intakeEpoch = after.intakeEpoch;
  assert.equal(
    result.contract,
    "crdd-coordinator/orchestrator-objective-intake/v2",
  );
  assert.equal(result.requestId, "request-public-runtime");
  assert.equal(result.projectId, "project-public-runtime");
  assert.equal(result.milestoneId, "milestone-public-runtime");
  assert.equal(result.projection?.milestoneState, "executing");
  assert.equal(result.effectState, "settled");
  assert.equal(taskStarts, 1);
  const cleanupBlocked = await runtime.run(
    withCallerPlan({
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
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: true,
      intakeEpoch,
    }),
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local.email.fixture@example.invalid" }),
  );
  assert.equal(
    cleanupBlocked.reason,
    "orchestrator_explicit_workspace_adoption_required",
  );
  assert.equal(cleanupBlocked.cleanupConfirmed, true);
  assert.equal(cleanupBlocked.manualRecoveryRequired, false);
  assert.equal(cleanupBlocked.effectState, "no_effect");
  assert.deepEqual(cleanupBlocked.recoveryIds, []);
  assert.equal(taskStarts, 1);
  // Mock Taskの終了をAI実行済みのEI記録へ変換しない。
  const replay = await runtime.run(
    withCallerPlan({
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
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: false,
      intakeEpoch,
    }),
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local.email.fixture@example.invalid" }),
  );
  assert.equal(replay.status, "completed", JSON.stringify(replay));
  assert.equal(replay.reason, "orchestrator_objective_already_accepted");
  assert.equal(taskStarts, 1);

  const publicationBlocked = await runtime.run(
    withCallerPlan({
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
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: false,
      intakeEpoch,
    }),
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local.email.fixture@example.invalid" }),
  );
  assert.equal(publicationBlocked.status, "blocked");
  assert.equal(
    publicationBlocked.reason,
    "orchestrator_quality_acceptance_required",
  );
  assert.equal(publicationObservations.length, 0);
  assert.equal(taskStarts, 2);

  const diagnosticFailed = await runtime.run(
    withCallerPlan({
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
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: false,
      intakeEpoch,
    }),
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local.email.fixture@example.invalid" }),
  );
  assert.equal(diagnosticFailed.status, "blocked");
  assert.equal(
    diagnosticFailed.reason,
    "orchestrator_quality_acceptance_required",
  );
  assert.equal(taskStarts, 3);
  const graphRequest = {
    ...withCallerPlan({
      requestId: "request-public-runtime-two-tasks",
      projectId: "project-public-runtime-two-tasks",
      milestoneId: "milestone-public-runtime-two-tasks",
      repositoryRevision: revision,
      objective: "Execute two distinct caller Tasks.",
      acceptanceCriteria: ["both caller Tasks completed"],
      allowedPaths: ["result.txt", "second.txt"],
      readPaths: ["result.txt", "second.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
      adoptResult: false,
      intakeEpoch,
    }),
    plan: {
      milestoneAcceptanceCriteria: ["both caller Tasks completed"],
      objectives: [
        { id: "objective-graph", acceptanceCriteria: ["graph accepted"] },
      ],
      tasks: [
        {
          id: "task-first",
          objectiveId: "objective-graph",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["shared-tree"],
        },
        {
          id: "task-second",
          objectiveId: "objective-graph",
          dependencies: ["task-first"],
          allowedPaths: ["second.txt"],
          conflictKeys: ["shared-tree"],
        },
      ],
    },
    taskInputs: [
      {
        taskId: "task-first",
        objective: "Implement the first result.",
        acceptanceCriteria: ["first result verified"],
        readPaths: ["result.txt"],
      },
      {
        taskId: "task-second",
        objective: "Test the second result.",
        acceptanceCriteria: ["second result verified"],
        readPaths: ["second.txt"],
      },
    ],
  };
  for (const context of [
    undefined,
    { principalId: "" },
    { principalId: " bad" },
  ]) {
    const denied = await runtime.run(
      graphRequest,
      new AbortController().signal,
      root,
      context,
    );
    assert.equal(
      denied.reason,
      "orchestrator_authenticated_principal_not_verified",
    );
    assert.equal(taskStarts, 3);
  }
  const graphResult = await runtime.run(
    graphRequest,
    new AbortController().signal,
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(
    graphResult.reason,
    "orchestrator_quality_acceptance_required",
    JSON.stringify(graphResult),
  );
  assert.equal(taskStarts, 5);
  assert.deepEqual(
    deliveredRequests.slice(-2).map((request) => ({
      objective: request.objective,
      acceptanceCriteria: request.acceptanceCriteria,
      readPaths: request.readPaths,
      allowedPaths: request.allowedPaths,
    })),
    graphRequest.taskInputs.map((input, index) => ({
      objective: input.objective,
      acceptanceCriteria: input.acceptanceCriteria,
      readPaths: input.readPaths,
      allowedPaths: graphRequest.plan.tasks[index]?.allowedPaths,
    })),
  );
  const graphReplay = await runtime.run(
    graphRequest,
    new AbortController().signal,
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(graphReplay.reason, "orchestrator_quality_acceptance_required");
  assert.equal(taskStarts, 5);
  const changedGraph = await runtime.run(
    {
      ...graphRequest,
      taskInputs: graphRequest.taskInputs.map((input, index) =>
        index === 1 ? { ...input, objective: "Different Task body." } : input,
      ),
    },
    new AbortController().signal,
    root,
    { principalId: "local.email.fixture@example.invalid" },
  );
  assert.equal(changedGraph.status, "blocked");
  assert.equal(changedGraph.reason, "orchestrator_intake_epoch_retired");
  assert.equal(changedGraph.effectState, "no_effect");
  assert.equal(changedGraph.cleanupConfirmed, true);
  assert.equal(taskStarts, 5);
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
 * @boundary PRL-IT-005=Direct Boundary: orchestrator Test Source→対象契約
 */
test("回復診断を直列化しcallback成功だけを成功として扱う", async () => {
  const stream = new ControlledDiagnosticStream({ highWaterMark: 1 });
  const reporter = createCoordinatorRecoveryDiagnosticReporter(stream, 200);
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
 * @boundary PRL-IT-005=Direct Boundary: orchestrator Test Source→対象契約
 */
test("実行Event発行診断は回復診断と別の閉じた識別子で出力する", async () => {
  const stream = new ControlledDiagnosticStream();
  const reporter = createCoordinatorExecutionIntelligenceDiagnosticReporter(
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
    stream.writes[0]?.startsWith(COORDINATOR_EXECUTION_INTELLIGENCE_PREFIX),
  );
  assert.match(
    stream.writes[0] ?? "",
    /"event":"coordinator_execution_intelligence_publication"/u,
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
 * @boundary PRL-IT-005=Direct Boundary: orchestrator Test Source→対象契約
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
      const reporter = createCoordinatorRecoveryDiagnosticReporter(stream, 200);
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
 * @boundary PRL-IT-005=Direct Boundary: orchestrator Test Source→対象契約
 */
test("回復診断timeout後の遅延callbackとerrorを二重完了にしない", async () => {
  const stream = new ControlledDiagnosticStream();
  const reporter = createCoordinatorRecoveryDiagnosticReporter(stream, 10);
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
 * @boundary PRL-IT-005=Direct Boundary: orchestrator Test Source→対象契約
 */
test("回復診断の同期throwと明示disposeを閉じた結果へ変換する", async () => {
  class ThrowingDiagnosticStream extends Writable {
    override write(): boolean {
      throw new Error("write_failure");
    }
  }
  const throwing = new ThrowingDiagnosticStream();
  const throwingReporter = createCoordinatorRecoveryDiagnosticReporter(
    throwing,
    200,
  );
  assert.equal(await throwingReporter.report({ phase: "required" }), "throw");
  throwingReporter.dispose();

  const pending = new ControlledDiagnosticStream();
  const reporter = createCoordinatorRecoveryDiagnosticReporter(pending, 200);
  const result = reporter.report({ phase: "required" });
  await new Promise((resolve) => setImmediate(resolve));
  reporter.dispose();
  assert.equal(await result, "unavailable");
});
