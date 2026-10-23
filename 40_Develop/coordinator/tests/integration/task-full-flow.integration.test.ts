/**
 * coordinator:integration:task-full-flowの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-full-flowが所有する検証責務を実行する。
 * @trace PPR-IT-001
 * @trace PRL-IT-008
 * @level IT
 * @scope project、runtime、full、flow、bounded、integration、execution-intelligence
 * @boundary PPR-IT-001=Adjacent 1 Block: 複数Source Reader→Projector
 */
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import path from "node:path";
import test from "node:test";

import {
  BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
  evaluateBoundedIntegratedResult,
  notObserved,
  observed,
  readExecutionIntelligence,
  verifyExecutionIntelligenceRepositoryRoot,
} from "../../../execution-intelligence/src/index.ts";
import {
  createCurrentCoordinatorPersistencePorts as createCoordinatorPersistencePorts,
  readCurrentCoordinatorState as readCoordinatorState,
  initializeCoordinatorSnapshot,
  createCoordinatorSnapshotAcceptanceDecisionStore as createCoordinatorAcceptanceDecisionStore,
} from "../../src/storage/current-state.ts";
import { recordCoordinatorExecutionEvent } from "../../src/index.ts";
import {
  resolveCoordinatorReplan as resolveCoordinatorReplanWithPort,
  createCoordinatorAcceptanceAuthorityAdapter,
  issueCoordinatorHumanDecision,
  COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
  recordCoordinatorAcceptanceDecision,
  submitCoordinatorHumanDecision,
  type CoordinatorDecisionRecord,
  type CoordinatorReplanClassifier,
  type CoordinatorReplanInput,
} from "../../src/index.ts";
import { runCoordinatorObjective } from "../../src/objective/execute.ts";
import { createCoordinatorDecisionCapabilityAdapter } from "../../src/index.ts";

const revision = "a".repeat(40);

/**
 * resolveCoordinatorReplanのTest準備責務を実行する。
 *
 * @responsibility resolveCoordinatorReplanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolveCoordinatorReplanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
function resolveCoordinatorReplan(
  input: CoordinatorReplanInput &
    Readonly<{ workingDirectory: string; repositoryBindingId: string }>,
  classify: CoordinatorReplanClassifier,
) {
  const ports = createCoordinatorPersistencePorts(
    input.workingDirectory,
    input.repositoryBindingId,
  );
  return resolveCoordinatorReplanWithPort(ports.state, input, classify);
}

/**
 * 統合済み結果をObjective、Milestoneの順で明示受入する。
 *
 * @responsibility Task完了と上位受入を分離し、二つのAcceptance Decisionをexactな世代へ適用する。
 * @trace PRL-IT-008
 * @precondition 対象Projectは統合候補作成済みでObjectiveがintegration_pendingである。
 * @stimulus Objective受入後に最新世代を再観測し、Milestone受入を要求する。
 * @observation 二つのDecision Resultと最終Coordinator Stateを観測する。
 * @oracle ObjectiveとMilestoneが明示判断なしにacceptedへ昇格しない。
 * @cleanup 親TestがRepository Rootを削除する。
 * @boundary PRL-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function acceptIntegratedResult(
  input: Readonly<{
    root: string;
    repositoryBindingId: string;
    projectId: string;
    milestoneId: string;
    objectiveId: string;
  }>,
) {
  const persistence = createCoordinatorPersistencePorts(
    input.root,
    input.repositoryBindingId,
  );
  const dependencies = Object.freeze({
    state: persistence.state,
    authority: createCoordinatorAcceptanceAuthorityAdapter("operator-a"),
    store: createCoordinatorAcceptanceDecisionStore(
      input.root,
      input.repositoryBindingId,
    ),
  });
  const decide = (
    target: "objective" | "milestone",
    targetId: string,
    suffix: string,
  ) => {
    const observed = readCoordinatorState(
      input.root,
      input.repositoryBindingId,
      input.projectId,
    );
    assert.equal(observed.status, "completed");
    assert.ok(observed.value);
    return recordCoordinatorAcceptanceDecision(dependencies, {
      contract: COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
      decisionId: `decision-${input.projectId}-${suffix}`,
      sourceSpecId: "SPEC-000002",
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      repositoryRevision: revision,
      expectedGeneration: observed.value.generation,
      target,
      targetId,
      decision: "accept",
      criterionEvidenceIds: [`evidence-${suffix}`],
      principalId: "operator-a",
    });
  };
  assert.equal(
    decide("objective", input.objectiveId, "objective").status,
    "completed",
  );
  assert.equal(
    decide("milestone", input.milestoneId, "milestone").status,
    "completed",
  );
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(
      requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
          path.resolve(import.meta.dirname, "../../../.."),
          "tests",
        ),
        "fixture_root_invalid",
      ).directory,
      "crdd-project-full-flow-",
    ),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const initialized = initializeCoordinatorSnapshot(root, "binding-full");
  assert.equal(initialized.status, "completed");
  if (initialized.status !== "completed")
    throw new Error("fixture_bootstrap_failed");
  const request = Object.freeze({
    requestId: "request-full",
    projectId: "project-full",
    milestoneId: "milestone-full",
    repositoryRevision: revision,
    objective: "Create the bounded result.",
    acceptanceCriteria: Object.freeze(["result accepted"]),
    allowedPaths: Object.freeze(["result.txt"]),
    readPaths: Object.freeze(["README.md"]),
    maximumConcurrency: 1,
    maximumReplans: 2,
    originLane: "interactive" as const,
    adoptResult: false,
    intakeEpoch: initialized.value,
  });
  let attempts = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-full",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-full",
      repositoryRevision: revision,
      workingDirectory: root,
      repositoryRoot: root,
      bindingCapability: {},
    }),
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["milestone accepted"],
      objectives: [
        { id: "objective-full", acceptanceCriteria: ["result accepted"] },
      ],
      tasks: [
        {
          id: "task-full",
          objectiveId: "objective-full",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["result.txt"],
        },
      ],
    }),
    createTaskExecutions: (
      _request: unknown,
      _binding: unknown,
      state: {
        tasks: readonly {
          definition: { id: string };
          state: string;
          retryCount: number;
        }[];
      },
    ) =>
      state.tasks
        .filter((task) => task.state !== "superseded")
        .map((task) => ({
          taskId: task.definition.id,
          taskRequest: {},
          repositoryRoot: root,
        })),
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async (input: {
        attemptId: string;
        operationId: string;
        authorityBindingId: string;
        repositoryRevision: string;
        observeStarted?: () => Promise<boolean>;
      }) => {
        assert.equal(await input.observeStarted?.(), true);
        attempts += 1;
        const isSuccessful = attempts > 1;
        return {
          contract:
            "crdd-coordinator/orchestrator-single-task-adapter" as const,
          attemptId: input.attemptId,
          operationId: input.operationId,
          authorityBindingId: input.authorityBindingId,
          repositoryRevision: input.repositoryRevision,
          status: isSuccessful ? ("completed" as const) : ("blocked" as const),
          reason: isSuccessful ? "task_completed" : "transient_failure",
          effectState: "settled" as const,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          candidateId: null,
          recoveryIds: Object.freeze([]),
        };
      },
    },
  };
  return {
    root,
    request,
    dependencies,
    get attempts() {
      return attempts;
    },
  };
}

/**
 * public intake, bounded retry, progress and integration form one accepted flowを検証する。
 *
 * @responsibility public intake, bounded retry, progress and integration form one accepted flowの合否判定を所有する。
 * @trace PPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public intake, bounded retry, progress and integration form one accepted flowの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("public intake, bounded retry, progress and integration form one accepted flow", async (t) => {
  const context = fixture(t);
  const first = await runCoordinatorObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  assert.equal(first.reason, "orchestrator_replan_required");
  assert.equal(first.projection?.qualityState, "blocked");
  const replanned = resolveCoordinatorReplan(
    {
      workingDirectory: context.root,
      repositoryBindingId: "binding-full",
      projectId: context.request.projectId,
      milestoneId: context.request.milestoneId,
      queueId: first.queueId ?? "invalid",
      maximumReplans: context.request.maximumReplans,
    },
    () => ({ disposition: "maintain_plan", reason: "transient failure" }),
  );
  assert.equal(replanned.status, "completed");
  const second = await runCoordinatorObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  assert.equal(
    second.reason,
    "orchestrator_tasks_completed_integration_pending",
  );
  assert.equal(context.attempts, 2);
  acceptIntegratedResult({
    root: context.root,
    repositoryBindingId: "binding-full",
    projectId: context.request.projectId,
    milestoneId: context.request.milestoneId,
    objectiveId: "objective-full",
  });
  const finalState = readCoordinatorState(
    context.root,
    "binding-full",
    context.request.projectId,
  );
  assert.equal(
    finalState.status === "completed" && finalState.value?.milestone.state,
    "accepted",
  );
});

/**
 * 同じWorkspaceの二Taskを順番に実行し明示品質受入へ接続するを検証する。
 *
 * @responsibility 同じWorkspaceの二Taskを順番に実行し明示品質受入へ接続するの合否判定を所有する。
 * @trace PPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同じWorkspaceの二Taskを順番に実行し明示品質受入へ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("同じWorkspaceの二Taskを順番に実行し明示品質受入へ接続する", async (t) => {
  const root = fs.mkdtempSync(
    path.join(
      requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
          path.resolve(import.meta.dirname, "../../../.."),
          "tests",
        ),
        "fixture_root_invalid",
      ).directory,
      "crdd-project-bounded-evaluation-",
    ),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const initialized = initializeCoordinatorSnapshot(
    root,
    "binding-bounded-evaluation",
  );
  assert.equal(initialized.status, "completed");
  if (initialized.status !== "completed")
    throw new Error("fixture_bootstrap_failed");
  const request = Object.freeze({
    requestId: "request-bounded-evaluation",
    projectId: "project-bounded-evaluation",
    milestoneId: "milestone-bounded-evaluation",
    repositoryRevision: revision,
    objective: "Produce and integrate two independent bounded results.",
    acceptanceCriteria: Object.freeze(["both results accepted"]),
    allowedPaths: Object.freeze(["result-a.txt", "result-b.txt"]),
    readPaths: Object.freeze(["README.md"]),
    maximumConcurrency: 2,
    maximumReplans: 0,
    originLane: "interactive" as const,
    adoptResult: false,
    intakeEpoch: initialized.value,
  });
  let active = 0;
  let maximumActive = 0;
  const lifecycle: string[] = [];
  const dependencies = {
    authenticatedPrincipalId: "principal-bounded-evaluation",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-bounded-evaluation",
      repositoryRevision: revision,
      workingDirectory: root,
      repositoryRoot: root,
      bindingCapability: {},
    }),
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["both results accepted"],
      objectives: [
        {
          id: "objective-bounded-evaluation",
          acceptanceCriteria: ["both results accepted"],
        },
      ],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-bounded-evaluation",
          dependencies: [],
          allowedPaths: ["result-a.txt"],
          conflictKeys: ["result-a.txt"],
        },
        {
          id: "task-b",
          objectiveId: "objective-bounded-evaluation",
          dependencies: [],
          allowedPaths: ["result-b.txt"],
          conflictKeys: ["result-b.txt"],
        },
      ],
    }),
    createTaskExecutions: (
      _request: unknown,
      _binding: unknown,
      state: {
        tasks: readonly { definition: { id: string }; state: string }[];
      },
    ) =>
      state.tasks.map((task) => ({
        taskId: task.definition.id,
        taskRequest: {},
        repositoryRoot: root,
      })),
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      executionObservation: {
        recordTaskAttempt: (
          event: Parameters<typeof recordCoordinatorExecutionEvent>[1],
        ) => recordCoordinatorExecutionEvent(root, event),
      },
      runSingleTaskAttempt: async (input: {
        attemptId: string;
        operationId: string;
        authorityBindingId: string;
        repositoryRevision: string;
        observeStarted?: () => Promise<boolean>;
      }) => {
        assert.equal(await input.observeStarted?.(), true);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        lifecycle.push(`started:${input.attemptId}`);
        await Promise.resolve();
        lifecycle.push(`completed:${input.attemptId}`);
        active -= 1;
        return {
          contract:
            "crdd-coordinator/orchestrator-single-task-adapter" as const,
          attemptId: input.attemptId,
          operationId: input.operationId,
          authorityBindingId: input.authorityBindingId,
          repositoryRevision: input.repositoryRevision,
          status: "completed" as const,
          reason: "task_completed",
          effectState: "settled" as const,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          candidateId: null,
          recoveryIds: Object.freeze([]),
          executorProvider: input.attemptId.includes("task-a")
            ? ("codex" as const)
            : ("claude" as const),
        };
      },
    },
  };
  const execution = await runCoordinatorObjective(
    dependencies,
    request,
    new AbortController().signal,
  );
  assert.equal(
    execution.reason,
    "orchestrator_tasks_completed_integration_pending",
  );
  assert.equal(maximumActive, 1);
  assert.equal(lifecycle.length, 4);
  assert.ok(lifecycle[0]?.startsWith("started:"));
  assert.equal(lifecycle[1], lifecycle[0]?.replace("started:", "completed:"));
  assert.ok(lifecycle[2]?.startsWith("started:"));
  assert.equal(lifecycle[3], lifecycle[2]?.replace("started:", "completed:"));
  assert.notEqual(lifecycle[0], lifecycle[2]);
  acceptIntegratedResult({
    root,
    repositoryBindingId: "binding-bounded-evaluation",
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    objectiveId: "objective-bounded-evaluation",
  });
  const verified = verifyExecutionIntelligenceRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("root_not_verified");
  const intelligenceResult = readExecutionIntelligence(verified.root);
  assert.equal(intelligenceResult.status, "completed");
  if (intelligenceResult.status !== "completed")
    throw new Error("execution_events_not_observed");
  const evaluation = evaluateBoundedIntegratedResult({
    contract: BOUNDED_INTEGRATED_RESULT_EVALUATION_INPUT_CONTRACT,
    evaluationId: "evaluation-bounded-evaluation",
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    expectedTaskIds: ["task-a", "task-b"],
    taskAttemptEvents: intelligenceResult.events,
    integratedResult: observed(
      { result: "accepted", evidenceIds: ["evidence-milestone"] },
      "orchestrator_integration_result",
    ),
    measurements: {
      timeToAcceptedResultMs: notObserved(
        "deterministic_contract_test_is_not_a_latency_benchmark",
      ),
      humanActiveMs: notObserved("no_human_activity_observer_attached"),
      reviewLoopCount: observed(0, "bounded_test_fixture"),
      remediationCount: observed(0, "bounded_test_fixture"),
      retryCount: observed(0, "orchestrator_terminal_state"),
      integrationConflictCount: observed(0, "integration_candidate"),
      postIntegrationFindingCount: notObserved(
        "independent_review_not_part_of_this_test",
      ),
    },
  });
  assert.equal(evaluation?.status, "completed");
  assert.equal(evaluation?.integratedAcceptedResult, true);
  assert.equal(evaluation?.observedTaskCount, 2);
  assert.equal(evaluation?.attemptCount, 2);
  assert.equal(evaluation?.taskSuccessIsIntegrationAcceptance, false);
});

/**
 * human decision is one-time and resumes only through a fresh bounded planを検証する。
 *
 * @responsibility human decision is one-time and resumes only through a fresh bounded planの合否判定を所有する。
 * @trace PPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus human decision is one-time and resumes only through a fresh bounded planの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("human decision is one-time and resumes only through a fresh bounded plan", async (t) => {
  const context = fixture(t);
  const first = await runCoordinatorObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  const input = {
    workingDirectory: context.root,
    repositoryBindingId: "binding-full",
    projectId: context.request.projectId,
    milestoneId: context.request.milestoneId,
    queueId: first.queueId ?? "invalid",
    maximumReplans: context.request.maximumReplans,
  };
  const escalated = resolveCoordinatorReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-full",
    reason: "human choice required",
  }));
  assert.equal(escalated.reason, "orchestrator_human_decision_required");
  const state = readCoordinatorState(
    context.root,
    "binding-full",
    context.request.projectId,
  );
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value)
    throw new Error("state missing");
  const records = new Map<string, CoordinatorDecisionRecord>();
  const store = {
    create(record: CoordinatorDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      const value = records.get(recordId);
      return value ? { status: "completed", value } : { status: "blocked" };
    },
    compareAndSet(
      expected: CoordinatorDecisionRecord,
      next: CoordinatorDecisionRecord,
    ) {
      if (records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const commonFields = {
    ...input,
    capability: createCoordinatorDecisionCapabilityAdapter(),
    persistence: createCoordinatorPersistencePorts(
      context.root,
      "binding-full",
    ),
    principalId: "principal-full",
    store,
  };
  const issued = issueCoordinatorHumanDecision(commonFields, {
    decisionId: "decision-full",
    repositoryRevision: revision,
    expectedGeneration: state.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("decision not issued");
  const applied = submitCoordinatorHumanDecision(commonFields, {
    decisionId: "decision-full",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  });
  assert.equal(applied.status, "completed");
  const resumed = resolveCoordinatorReplan(input, () => ({
    disposition: "maintain_plan",
    reason: "human authorized retry",
  }));
  assert.equal(resumed.status, "completed");
  const completed = await runCoordinatorObjective(
    context.dependencies,
    context.request,
    new AbortController().signal,
  );
  assert.equal(
    completed.reason,
    "orchestrator_tasks_completed_integration_pending",
  );
});
