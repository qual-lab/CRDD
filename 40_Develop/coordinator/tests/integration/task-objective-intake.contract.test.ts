/**
 * coordinator:integration:task-objective-intakeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-objective-intakeが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @trace PRL-IT-013
 * @level IT
 * @scope project、runtime、objective、intake
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  initializeExecutionStore,
  readState,
  saveProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import { withCallerPlan } from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
  verifyRuntimePersistenceRepository,
} from "../../src/lifecycle/host.ts";
import { runTestCoordinatorObjective } from "../fixtures/task-persistence-fixture.ts";
import type {
  CoordinatorSingleTaskAttemptInput,
  CoordinatorSingleTaskResult,
} from "../../src/lifecycle/types.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import {
  acquireCoordinatorLease,
  enqueueProjectOperation,
  readCoordinatorState,
  readProjectOperationQueueState,
  selectNextProjectOperation,
  updateProjectOperationQueueState,
} from "../fixtures/task-persistence-fixture.ts";
import {
  registerSyntheticOperations,
  settleSyntheticOperation,
} from "../fixtures/task-result-fixture.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

const revision = "a".repeat(40);
/**
 * 上位受付試験の技術回収済み診断を構成する。
 * @responsibility exact回復参照と技術終端の共同条件を固定する。
 * @trace PRL-IT-005
 * @precondition 試験が同じ回復参照を所有する。
 * @stimulus 回復参照を渡す。
 * @observation 閉じた現在診断を返す。
 * @oracle Task完了・操作除去を主張せずTask保存へ進める。
 * @cleanup N/A: メモリ内だけ。
 * @boundary PRL-IT-005=Mock Boundary: Coordinator現在回復結果の固定代替。
 */
function intakeDockerRecoveryReady(recoveryId: string) {
  return Object.freeze({
    contract: "crdd-coordinator/current-task-recovery",
    status: "completed",
    reason: "docker_task_recovery_terminal_confirmed",
    recoveryId,
    dockerCleanupConfirmed: true,
    hostCleanupConfirmed: true,
    locksReleased: true,
    historyConfirmed: true,
    operationRetained: true,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: null,
  });
}
type ObjectiveDependencies = Parameters<typeof runTestCoordinatorObjective>[0];
type TestObjectiveDependencies = Omit<ObjectiveDependencies, "execution"> &
  Readonly<{
    execution: Omit<ObjectiveDependencies["execution"], "authorization">;
  }>;

/**
 * runCoordinatorObjectiveのTest準備責務を実行する。
 *
 * @responsibility runCoordinatorObjectiveがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runCoordinatorObjectiveを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function runCoordinatorObjective(
  dependencies: TestObjectiveDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  return runTestCoordinatorObjective(
    {
      ...dependencies,
      execution: {
        ...dependencies.execution,
      },
    },
    rawRequest,
    cancellationSignal,
  );
}

/**
 * rootのTest準備責務を実行する。
 *
 * @responsibility rootがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus rootを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function root(t: test.TestContext, initialize = true) {
  const parent = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      path.resolve(import.meta.dirname, "../../../.."),
      "tests",
    ),
    "intake_fixture",
  ).directory;
  const value = fs.mkdtempSync(path.join(parent, "crdd-project-intake-"));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync.native(value)), parent);
    fs.rmSync(value, { recursive: true, force: true });
    assert.throws(() => fs.lstatSync(value), { code: "ENOENT" });
  });

  execFileSync("git", ["init", "--quiet", value], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      value,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  if (initialize) {
    const initialized = initializeExecutionStore(
      verifyRuntimePersistenceRepository(value),
      "binding-a",
    );
    assert.equal(initialized.status, "completed");
  }
  return value;
}
/**
 * runtimeSnapshotのTest準備責務を実行する。
 *
 * @responsibility runtimeSnapshotがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runtimeSnapshotを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function runtimeSnapshot(workingDirectory: string) {
  const runtime = path.join(workingDirectory, ".crdd");
  const entries = new Map<string, string>();
  /**
   * visitのTest準備責務を実行する。
   *
   * @responsibility visitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace PRL-IT-005
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus visitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
   */
  const visit = (directory: string) => {
    if (!fs.existsSync(directory)) return;
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const relative = path.relative(runtime, target).replaceAll("\\", "/");
      const stat = fs.lstatSync(target);
      if (stat.isDirectory()) {
        entries.set(`${relative}/`, "directory");
        visit(target);
      } else {
        entries.set(relative, fs.readFileSync(target, "utf8"));
      }
    }
  };
  visit(runtime);
  return entries;
}

/**
 * abandonProjectOperationAcquisitionのTest準備責務を実行する。
 *
 * @responsibility abandonProjectOperationAcquisitionがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus abandonProjectOperationAcquisitionを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
async function abandonProjectOperationAcquisition(
  t: test.TestContext,
  workingDirectory: string,
  queueId: string,
  projectId: string,
) {
  const signal = path.join(
    workingDirectory,
    `pre-publication-${queueId}-ready`,
  );
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "task-lease-interleaving-probe.ts",
  );
  const child = spawn(
    process.execPath,
    [
      probe,
      workingDirectory,
      signal,
      "pause-before-publish",
      "project-operation",
      queueId,
      projectId,
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(signal) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(signal), true);
  child.kill();
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  fs.rmSync(signal);
}
/**
 * requestのTest準備責務を実行する。
 *
 * @responsibility requestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus requestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function request(overrides: Record<string, unknown> = {}) {
  return withCallerPlan({
    operation: "start" as const,
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    objective: "Create the result.",
    acceptanceCriteria: ["Result exists."],
    allowedPaths: ["result.txt"],
    readPaths: ["README.md"],
    maximumConcurrency: 1,
    maximumReplans: 1,
    originLane: "interactive",
    adoptResult: false,
    ...overrides,
  });
}
/**
 * completedのTest準備責務を実行する。
 *
 * @responsibility completedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
async function completed(input: {
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  observeStarted?: () => void | Promise<void>;
}): Promise<CoordinatorSingleTaskResult> {
  assert.equal(await input.observeStarted?.(), undefined);
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
    candidateId: "candidate-a",
    recoveryIds: [],
  };
}

/**
 * settleRuntimeProcessAsFreshProcessのTest準備責務を実行する。
 *
 * @responsibility settleRuntimeProcessAsFreshProcessがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus settleRuntimeProcessAsFreshProcessを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function settleRuntimeProcessAsFreshProcess(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
) {
  const observed = readCoordinatorState(
    workingDirectory,
    repositoryBindingId,
    projectId,
  );
  assert.equal(observed.status, "completed");
  assert.ok(observed.value);
  let state = observed.value;
  const task = state.tasks.find((entry) =>
    entry.recoveryObligations.some(
      (obligation) =>
        obligation.kind === "runtime_process" && obligation.phase !== "settled",
    ),
  );
  const obligation = task?.recoveryObligations.find(
    (entry) => entry.kind === "runtime_process" && entry.phase !== "settled",
  );
  assert.ok(task);
  assert.ok(obligation);
  if (obligation.phase === "required") {
    const write = saveProjectExecutionState(
      verifyRuntimePersistenceRepository(workingDirectory),
      repositoryBindingId,
      {
        kind: "task_recovery_start",
        projectId: state.projectId,
        taskId: task.definition.id,
        recoveryKind: obligation.kind,
        recoveryId: obligation.recoveryId,
      },
      state.generation,
    );
    assert.equal(write.status, "completed");
    assert.ok(write.value);
    state = write.value;
  }
  const write = saveProjectExecutionState(
    verifyRuntimePersistenceRepository(workingDirectory),
    repositoryBindingId,
    {
      kind: "task_recovery_settle",
      projectId: state.projectId,
      taskId: task.definition.id,
      recoveryKind: obligation.kind,
      recoveryId: obligation.recoveryId,
    },
    state.generation,
  );
  assert.equal(write.status, "completed");
}

/**
 * public Objective intake binds, plans, executes and deduplicates the same requestを検証する。
 *
 * @responsibility public Objective intake binds, plans, executes and deduplicates the same requestの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public Objective intake binds, plans, executes and deduplicates the same requestの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("public Objective intake binds, plans, executes and deduplicates the same request", async (t) => {
  const workingDirectory = root(t, false);
  let effects = 0;
  let selectionReads = 0;
  const defaults = taskExecutionSelections();
  const selected = {
    ...defaults,
    executor: {
      ...defaults.executor,
      source: "explicit",
      reasoningEffort: "high",
    },
  } as const;
  const explicitRequest = {
    ...request(),
    choice: { provider: "codex", model: "gpt-5.5", effort: "high" },
  };
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
    }),
    resolveTaskSelections: () => {
      selectionReads += 1;
      if (selectionReads > 1)
        throw new Error("config_must_not_be_read_on_reentry");
      return { status: "resolved" as const, value: selected, reason: null };
    },
    createTaskExecutions: () => [
      {
        taskId: "task-a",
        taskRequest: {},
        repositoryRoot: workingDirectory,
      },
    ],
    observeLeaseOwner: (owner: {
      ownerProcessId: number;
      ownerGeneration: string;
    }) => ({ ...owner, status: "absent" }),
    execution: {
      runSingleTaskAttempt: async (
        input: CoordinatorSingleTaskAttemptInput,
      ) => {
        effects += 1;
        return completed(input);
      },
    },
  };
  // Readerの排他Directoryだけを準備し、実行Stateは真正不存在のまま確認する。
  const before = readState(
    verifyRuntimePersistenceRepository(workingDirectory),
    "binding-a",
    "execution",
  );
  assert.equal(before.status, "completed");
  assert.equal(before.value, null);
  const untouched = runtimeSnapshot(workingDirectory);
  const missing = await runCoordinatorObjective(
    dependencies,
    request({ operation: "resume" }),
    new AbortController().signal,
  );
  assert.equal(missing.reason, "orchestrator_objective_request_not_found");
  assert.equal(effects, 0);
  assert.deepEqual(runtimeSnapshot(workingDirectory), untouched);
  for (const [input, pair] of [
    [{ ...request(), workType: "coding" }, defaults],
    [explicitRequest, defaults],
    [request(), selected],
    [
      request(),
      {
        ...defaults,
        executor: { ...defaults.executor, workType: "coding" },
        reviewer: { ...defaults.reviewer, workType: "coding" },
      },
    ],
  ] as const) {
    const rejected = await runCoordinatorObjective(
      {
        ...dependencies,
        resolveTaskSelections: () => ({
          status: "resolved",
          value: pair,
          reason: null,
        }),
      },
      input,
      new AbortController().signal,
    );
    assert.equal(rejected.reason, "coordinator_objective_selection_mismatch");
    assert.equal(rejected.effectState, "no_effect");
    assert.deepEqual(runtimeSnapshot(workingDirectory), untouched);
    assert.equal(effects, 0);
  }
  const first = await runCoordinatorObjective(
    dependencies,
    explicitRequest,
    new AbortController().signal,
  );
  assert.equal(first.status, "completed", JSON.stringify(first));
  assert.equal(first.projection?.nextAction, "verify_objective_integration");
  assert.equal(effects, 1);
  assert.equal(selectionReads, 1);
  const second = await runCoordinatorObjective(
    dependencies,
    explicitRequest,
    new AbortController().signal,
  );
  assert.equal(second.status, "blocked", JSON.stringify(second));
  assert.equal(second.reason, "orchestrator_objective_request_reused");
  assert.equal(effects, 1);
  assert.equal(selectionReads, 1);
  const savedBytes = runtimeSnapshot(workingDirectory);
  for (const scope of [
    { projectId: "other-project" },
    { milestoneId: "other-milestone" },
    { objective: "changed" },
  ]) {
    const rejected = await runCoordinatorObjective(
      dependencies,
      { ...explicitRequest, ...scope },
      new AbortController().signal,
    );
    assert.equal(
      rejected.reason,
      "orchestrator_objective_request_identity_conflict",
    );
    assert.equal(rejected.effectState, "no_effect");
    assert.deepEqual(runtimeSnapshot(workingDirectory), savedBytes);
  }
  for (const change of [
    { workType: "coding" },
    { choice: { provider: "claude", model: "gpt-5.5", effort: "high" } },
    { choice: { provider: "codex", model: "different-model", effort: "high" } },
    { choice: { provider: "codex", model: "gpt-5.5", effort: "medium" } },
  ]) {
    const rejected = await runCoordinatorObjective(
      dependencies,
      { ...explicitRequest, requestId: "request-changed", ...change },
      new AbortController().signal,
    );
    assert.equal(rejected.reason, "coordinator_objective_selection_mismatch");
    assert.equal(rejected.effectState, "no_effect");
    assert.deepEqual(runtimeSnapshot(workingDirectory), savedBytes);
    assert.equal(selectionReads, 1);
    assert.equal(effects, 1);
  }
  const inherited = await runCoordinatorObjective(
    dependencies,
    { ...request(), requestId: "request-inherited" },
    new AbortController().signal,
  );
  assert.equal(inherited.status, "completed", JSON.stringify(inherited));
  assert.equal(selectionReads, 1);
  assert.equal(effects, 1);
  const state = readCoordinatorState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  const queue = readProjectOperationQueueState(
    workingDirectory,
    "binding-a",
    first.queueId ?? "invalid",
  );
  assert.equal(
    state.status === "completed" && state.value?.tasks[0]?.state,
    "completed",
  );
  assert.deepEqual(
    state.status === "completed" && state.value?.taskExecutionSelections,
    selected,
  );
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "integration_pending",
  );
});

/**
 * public Objective re-entry reconciles a pre-publication owner loss before executionを検証する。
 *
 * @responsibility public Objective re-entry reconciles a pre-publication owner loss before executionの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public Objective re-entry reconciles a pre-publication owner loss before executionの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("public Objective re-entry reconciles a pre-publication owner loss before execution", async (t) => {
  const workingDirectory = root(t);
  const queueId = `queue-${createHash("sha256")
    .update(["binding-a", "principal-a", "request-a"].join("\0"))
    .digest("hex")
    .slice(0, 40)}`;
  const exactRequest = request();
  const queued = enqueueProjectOperation(workingDirectory, "binding-a", {
    queueId,
    projectId: exactRequest.projectId,
    milestoneId: exactRequest.milestoneId,
    requestHash: createHash("sha256")
      .update(
        JSON.stringify({
          ...inspectCoordinatorObjectiveRequest(exactRequest),
          operation: undefined,
          authenticatedPrincipalId: "principal-a",
          acceptanceCriteria: [...exactRequest.acceptanceCriteria],
          allowedPaths: [...exactRequest.allowedPaths],
          readPaths: [...exactRequest.readPaths],
        }),
      )
      .digest("hex"),
    originLane: "interactive",
    repositoryRevision: exactRequest.repositoryRevision,
    scopeHash: createHash("sha256")
      .update(
        JSON.stringify({
          allowedPaths: exactRequest.allowedPaths,
          readPaths: exactRequest.readPaths,
        }),
      )
      .digest("hex"),
  });
  assert.equal(queued.status, "completed");
  const signal = path.join(workingDirectory, "pre-publication-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "task-lease-interleaving-probe.ts",
  );
  const child = spawn(
    process.execPath,
    [
      probe,
      workingDirectory,
      signal,
      "pause-before-publish",
      "project-operation",
      queueId,
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(signal) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(signal), true);
  child.kill();
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));

  let effects = 0;
  const result = await runCoordinatorObjective(
    {
      authenticatedPrincipalId: "principal-a",
      verifyProjectBinding: () => ({
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory,
        repositoryRoot: workingDirectory,
      }),
      resolveTaskSelections: () => ({
        status: "resolved" as const,
        value: taskExecutionSelections(),
        reason: null,
      }),
      createTaskExecutions: () => [
        {
          taskId: "task-a",
          taskRequest: {},
          repositoryRoot: workingDirectory,
        },
      ],
      observeLeaseOwner: (owner: {
        ownerProcessId: number;
        ownerGeneration: string;
      }) => ({ ...owner, status: "absent" }),
      execution: {
        runSingleTaskAttempt: async (input) => {
          effects += 1;
          return completed(input);
        },
      },
    },
    { ...exactRequest, operation: "resume" },
    new AbortController().signal,
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(effects, 1);
  assert.equal(result.queueId, queueId);
});

/**
 * public Objective re-entry preserves ambiguous acquisition evidence and returns its exact recovery referenceを検証する。
 *
 * @responsibility public Objective re-entry preserves ambiguous acquisition evidence and returns its exact recovery referenceの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public Objective re-entry preserves ambiguous acquisition evidence and returns its exact recovery referenceの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("public Objective re-entry preserves malformed snapshot without inventing a recovery identity", async (t) => {
  for (const count of [1, 2]) {
    const workingDirectory = root(t);
    const locks = path.join(workingDirectory, ".crdd", "domain-model");
    fs.mkdirSync(locks, { recursive: true });
    const createdItems = Array.from({ length: count }, (_unused, index) =>
      path.join(locks, index === 0 ? "state.json" : "state.pending.json"),
    );
    for (const target of createdItems)
      fs.writeFileSync(target, "not-json\n", "utf8");
    let effects = 0;
    const result = await runCoordinatorObjective(
      {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({
          status: "verified",
          repositoryBindingId: "binding-a",
          repositoryRevision: revision,
          workingDirectory,
          repositoryRoot: workingDirectory,
        }),
        resolveTaskSelections: () => ({
          status: "resolved" as const,
          value: taskExecutionSelections(),
          reason: null,
        }),
        createTaskExecutions: () => [],
        observeLeaseOwner: (owner) => ({ ...owner, status: "unknown" }),
        execution: {
          runSingleTaskAttempt: async (input) => {
            effects += 1;
            return completed(input);
          },
        },
      },
      request(),
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.manualRecoveryRequired, true);
    assert.deepEqual(result.recoveryIds, []);
    assert.equal(effects, 0);
    assert.equal(
      createdItems.every((target) => fs.existsSync(target)),
      true,
    );
  }
});

/**
 * public Objective classifies foreign, missing, and mismatched acquisition queues before durable mutationを検証する。
 *
 * @responsibility public Objective classifies foreign, missing, and mismatched acquisition queues before durable mutationの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public Objective classifies foreign, missing, and mismatched acquisition queues before durable mutationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("public Objective classifies foreign, missing, and mismatched acquisition queues before durable mutation", async (t) => {
  for (const scenario of [
    "foreign-project",
    "missing-queue",
    "queue-mismatch",
  ] as const) {
    const workingDirectory = root(t);
    const residualQueueId = `queue-residual-${scenario}`;
    const residualProjectId =
      scenario === "foreign-project" ? "project-b" : "project-a";
    {
      const queued = enqueueProjectOperation(workingDirectory, "binding-a", {
        queueId: residualQueueId,
        projectId: residualProjectId,
        milestoneId: "milestone-residual",
        requestHash: "1".repeat(64),
        originLane: "scheduled",
        repositoryRevision: revision,
        scopeHash: "2".repeat(64),
      });
      assert.equal(queued.status, "completed");
    }
    await abandonProjectOperationAcquisition(
      t,
      workingDirectory,
      residualQueueId,
      residualProjectId,
    );
    if (scenario !== "foreign-project") {
      const record = path.join(
        workingDirectory,
        ".crdd",
        "domain-model",
        "state.json",
      );
      const envelope = JSON.parse(fs.readFileSync(record, "utf8"));
      if (scenario === "missing-queue") envelope.queueEntries = [];
      else envelope.queueEntries[0].projectId = "project-unbound";
      fs.writeFileSync(record, `${canonicalJson(envelope)}\n`, "utf8");
    }
    const before = runtimeSnapshot(workingDirectory);
    let effects = 0;
    const result = await runCoordinatorObjective(
      {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({
          status: "verified",
          repositoryBindingId: "binding-a",
          repositoryRevision: revision,
          workingDirectory,
          repositoryRoot: workingDirectory,
        }),
        resolveTaskSelections: () => ({
          status: "resolved" as const,
          value: taskExecutionSelections(),
          reason: null,
        }),
        createTaskExecutions: () => [],
        observeLeaseOwner: (owner) => ({ ...owner, status: "absent" }),
        execution: {
          runSingleTaskAttempt: async (input) => {
            effects += 1;
            return completed(input);
          },
        },
      },
      request(),
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked", scenario);
    assert.equal(result.manualRecoveryRequired, true, scenario);
    assert.equal(result.cleanupConfirmed, false, scenario);
    if (scenario === "foreign-project") {
      assert.match(
        result.recoveryIds[0] ?? "",
        /^lease-acquisition-[0-9a-f]{40}$/u,
      );
      assert.equal(
        result.reason,
        "orchestrator_lease_acquisition_project_identity_mismatch",
      );
    } else {
      assert.deepEqual(result.recoveryIds, []);
      assert.equal(result.reason, "coordinator_state_read_unconfirmed");
    }
    assert.equal(effects, 0, scenario);
    assert.deepEqual(runtimeSnapshot(workingDirectory), before, scenario);
  }
});

/**
 * a scheduled Objective arriving during interactive execution waits without effectを検証する。
 *
 * @responsibility a scheduled Objective arriving during interactive execution waits without effectの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus a scheduled Objective arriving during interactive execution waits without effectの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("a scheduled Objective arriving during interactive execution waits without effect", async (t) => {
  const workingDirectory = root(t);
  let effects = 0;
  let releaseEffect!: () => void;
  const effectStarted = new Promise<void>((resolveStarted) => {
    releaseEffect = () => resolveStarted();
  });
  let observeEffectStart!: () => void;
  const started = new Promise<void>((resolve) => {
    observeEffectStart = resolve;
  });
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
    }),
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    createTaskExecutions: () => [
      {
        taskId: "task-a",
        taskRequest: {},
        repositoryRoot: workingDirectory,
      },
    ],
    observeLeaseOwner: (owner: {
      ownerProcessId: number;
      ownerGeneration: string;
    }) => ({ ...owner, status: "alive" }),
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        effects += 1;
        observeEffectStart();
        await effectStarted;
        return completed(input);
      },
    },
  };

  const interactive = runCoordinatorObjective(
    dependencies,
    request({ requestId: "request-interactive" }),
    new AbortController().signal,
  );
  await started;
  const scheduled = await runCoordinatorObjective(
    dependencies,
    request({ requestId: "request-scheduled", originLane: "scheduled" }),
    new AbortController().signal,
  );
  assert.equal(scheduled.status, "blocked");
  assert.equal(
    scheduled.reason,
    "orchestrator_objective_queued_waiting_foreground",
  );
  assert.equal(scheduled.cleanupConfirmed, true);
  assert.equal(scheduled.manualRecoveryRequired, false);
  assert.equal(scheduled.effectState, "no_effect");
  assert.equal(effects, 1);

  releaseEffect();
  assert.equal((await interactive).status, "completed");
  assert.equal(effects, 1);
});

/**
 * 公開Objective受付は許可範囲外の計画をEffect前に拒否するを検証する。
 *
 * @responsibility 公開Objective受付は許可範囲外の計画をEffect前に拒否するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開Objective受付は許可範囲外の計画をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開Objective受付は許可範囲外の計画をEffect前に拒否する", async (t) => {
  const workingDirectory = root(t);
  let effects = 0;
  const base = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
    }),
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    createTaskExecutions: () => [
      {
        taskId: "task-a",
        taskRequest: {},
        repositoryRoot: workingDirectory,
      },
    ],
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async () => {
        effects += 1;
        throw new Error("not_expected");
      },
    },
  };
  const result = await runCoordinatorObjective(
    base,
    {
      ...request(),
      plan: {
        milestoneAcceptanceCriteria: ["Result exists."],
        objectives: [
          { id: "objective-a", acceptanceCriteria: ["Result exists."] },
        ],
        tasks: [
          {
            id: "task-a",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["outside.txt"],
            conflictKeys: [],
          },
        ],
      },
    },
    new AbortController().signal,
  );
  assert.equal(result.reason, "orchestrator_objective_request_invalid");
  assert.equal(effects, 0);
  const state = readCoordinatorState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(state.status === "completed" && state.value, null);
});

/**
 * 公開Objective受付は余分field・Accessor・Proxy・不正計画をEffect前に拒否するを検証する。
 *
 * @responsibility 公開Objective受付は余分field・Accessor・Proxy・不正計画をEffect前に拒否するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開Objective受付は余分field・Accessor・Proxy・不正計画をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開Objective受付は余分field・Accessor・Proxy・不正計画をEffect前に拒否する", async (t) => {
  const workingDirectory = root(t);
  let bindingCalls = 0;
  let taskEffects = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => {
      bindingCalls += 1;
      return {
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory,
        repositoryRoot: workingDirectory,
      };
    },
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    createTaskExecutions: () => [],
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async () => {
        taskEffects += 1;
        throw new Error("not_expected");
      },
    },
  };

  const unknownField = await runCoordinatorObjective(
    dependencies,
    request({ unknown: true }),
    new AbortController().signal,
  );
  assert.equal(unknownField.reason, "orchestrator_objective_request_invalid");

  const getterRequest = request();
  Object.defineProperty(getterRequest, "objective", {
    enumerable: true,
    get: () => "Create the result.",
  });
  const accessor = await runCoordinatorObjective(
    dependencies,
    getterRequest,
    new AbortController().signal,
  );
  assert.equal(accessor.reason, "orchestrator_objective_request_invalid");

  let proxyTrapCount = 0;
  const proxy = await runCoordinatorObjective(
    dependencies,
    new Proxy(request(), {
      get() {
        proxyTrapCount += 1;
        throw new Error("must_not_execute");
      },
      ownKeys() {
        proxyTrapCount += 1;
        throw new Error("must_not_execute");
      },
    }),
    new AbortController().signal,
  );
  assert.equal(proxy.reason, "orchestrator_objective_request_invalid");
  assert.equal(proxyTrapCount, 0);
  assert.equal(bindingCalls, 0);

  const invalidPlan = await runCoordinatorObjective(
    dependencies,
    {
      ...request(),
      plan: {
        milestoneAcceptanceCriteria: ["Result exists."],
        objectives: [
          { id: "objective-a", acceptanceCriteria: ["Result exists."] },
        ],
        tasks: [
          {
            id: "task-a",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["result.txt"],
            conflictKeys: ["result.txt"],
          },
        ],
        unknown: true,
      },
    },
    new AbortController().signal,
  );
  assert.equal(invalidPlan.reason, "orchestrator_objective_request_invalid");
  assert.equal(bindingCalls, 0);
  assert.equal(taskEffects, 0);
  const state = readCoordinatorState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(state.status === "completed" && state.value, null);
});

/**
 * Objective受付は廃止済みの判断Capability再発行fieldを拒否するを検証する。
 *
 * @responsibility Objective受付は廃止済みの判断Capability再発行fieldを拒否するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective受付は廃止済みの判断Capability再発行fieldを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Objective受付は廃止済みの判断Capability再発行fieldを拒否する", () => {
  const base = request();
  const accepted = inspectCoordinatorObjectiveRequest({
    ...base,
    decisionCapabilityReplacement: {
      decisionId: "decision-a",
      replacementRequestId: "replacement-a",
    },
  });
  assert.equal(accepted, null);
  assert.equal(
    inspectCoordinatorObjectiveRequest({
      ...base,
      decisionCapabilityReplacement: {
        decisionId: "decision-a",
        replacementRequestId: "replacement-a",
        authority: true,
      },
    }),
    null,
  );
});

/**
 * 非同期回復の待機中に前提が変わった場合の上位保存を反証する。
 * @responsibility 取消・拒否・状態改訂を回復成立へ昇格させない。
 * @trace PRL-IT-005
 * @precondition 自己生成Repositoryと本番の上位状態保存を使う。
 * @stimulus Promise待機中の取消・拒否・状態／Queue変更と、技術終端のTask保存直後の取消を発生させる。
 * @observation exact回復参照、保存済み段階、技術回復・Task実行回数。
 * @oracle 同じ回復参照と既に耐久保存済みの段階を保持し、各停止点からの次段処置とTask再実行を行わない。
 * @cleanup 自己生成Repositoryを登録済みhookで削除し不存在を確認する。
 * @boundary PRL-IT-005=Related 2 Blocks: 非同期回復→Task保存。
 */
test("async recovery interruption preserves technical and Task settlement boundaries", async (t) => {
  for (const scenario of [
    "cancel",
    "reject",
    "state_change",
    "queue_change",
    "after_settled",
  ] as const) {
    await t.test(scenario, async (t) => {
      const workingDirectory = root(t);
      const cancellation = new AbortController();
      let recoveryId = "";
      let attempts = 0;
      let recoveries = 0;
      let enter: (() => void) | undefined;
      let resolvePending:
        | ((value: ReturnType<typeof intakeDockerRecoveryReady>) => void)
        | undefined;
      let rejectPending: ((reason: Error) => void) | undefined;
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      const pending = new Promise<ReturnType<typeof intakeDockerRecoveryReady>>(
        (resolve, reject) => {
          resolvePending = resolve;
          rejectPending = reject;
        },
      );
      assert.ok(enter);
      assert.ok(resolvePending);
      assert.ok(rejectPending);
      const dependencies = {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({
          status: "verified",
          repositoryBindingId: "binding-a",
          repositoryRevision: revision,
          workingDirectory,
          repositoryRoot: workingDirectory,
        }),
        resolveTaskSelections: () => ({
          status: "resolved" as const,
          value: taskExecutionSelections(),
          reason: null,
        }),
        createTaskExecutions: () => [
          {
            taskId: "task-a",
            taskRequest: {},
            repositoryRoot: workingDirectory,
          },
        ],
        observeLeaseOwner: () => ({ status: "absent" }),
        recoverTaskRecovery: async (exact: string, signal: AbortSignal) => {
          assert.equal(exact, recoveryId);
          assert.equal(signal, cancellation.signal);
          recoveries += 1;
          enter?.();
          return pending;
        },
        observeRecoveryTransition: async (event: {
          phase: string;
          recoveryId: string | null;
        }) => {
          if (
            event.recoveryId === recoveryId &&
            scenario === "after_settled" &&
            event.phase === "settled"
          )
            cancellation.abort();
        },
        execution: {
          runSingleTaskAttempt: async (
            input: Parameters<typeof completed>[0],
          ) => {
            attempts += 1;
            const result = await completed(input);
            recoveryId =
              registerSyntheticOperations(
                workingDirectory,
                input.operationId,
                1,
              )[0]?.recoveryId ?? assert.fail("synthetic_operation_missing");
            return {
              ...result,
              status: "blocked" as const,
              reason: "docker_cleanup_unknown",
              effectState: "unknown" as const,
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              recoveryIds: [recoveryId],
              recoveryObligations: [{ kind: "docker" as const, recoveryId }],
              candidateId: null,
            };
          },
        },
      };
      const first = await runCoordinatorObjective(
        dependencies,
        request({ maximumReplans: 0 }),
        cancellation.signal,
      );
      assert.equal(first.reason, "orchestrator_task_recovery_required");
      if (scenario === "after_settled")
        settleRuntimeProcessAsFreshProcess(
          workingDirectory,
          "binding-a",
          "project-a",
        );
      const resumed = runCoordinatorObjective(
        dependencies,
        request({ operation: "resume", maximumReplans: 0 }),
        cancellation.signal,
      );
      await Promise.race([
        entered,
        resumed.then((result) => {
          throw new Error(`recovery_not_entered:${JSON.stringify(result)}`);
        }),
      ]);
      assert.equal(recoveries, 1);
      assert.equal(attempts, 1);
      const before = readCoordinatorState(
        workingDirectory,
        "binding-a",
        "project-a",
      );
      assert.equal(before.status, "completed");
      assert.ok(before.value);
      const obligation = before.value.tasks[0]?.recoveryObligations.find(
        (item) => item.recoveryId === recoveryId,
      );
      assert.equal(obligation?.phase, "required");
      let expected = before.value;
      if (scenario === "state_change") {
        const written = saveProjectExecutionState(
          verifyRuntimePersistenceRepository(workingDirectory),
          "binding-a",
          {
            kind: "task_recovery_start",
            projectId: "project-a",
            taskId: "task-a",
            recoveryKind: "docker",
            recoveryId,
          },
          before.value.generation,
        );
        assert.equal(written.status, "completed");
        if (written.status !== "completed")
          throw new Error("fixture_concurrent_recovery_change_failed");
        expected = written.value;
      }
      assert.ok("queueId" in first);
      const queueId = first.queueId;
      assert.ok(queueId);
      const queueBefore = readProjectOperationQueueState(
        workingDirectory,
        "binding-a",
        queueId,
      );
      assert.equal(queueBefore.status, "completed");
      assert.ok(queueBefore.value);
      if (scenario === "queue_change") {
        const changed = updateProjectOperationQueueState(
          workingDirectory,
          "binding-a",
          queueId,
          queueBefore.value.generation,
          {
            state: "cancelled",
            lease: null,
            resumeCondition: queueBefore.value.resumeCondition,
            resultReference: queueBefore.value.resultReference,
          },
        );
        assert.equal(changed.status, "completed", JSON.stringify(changed));
      }
      const expectedQueue = readProjectOperationQueueState(
        workingDirectory,
        "binding-a",
        queueId,
      ).value;
      if (scenario === "cancel") cancellation.abort();
      if (scenario === "reject")
        rejectPending(new Error("fixture_recovery_rejected"));
      else {
        settleSyntheticOperation(workingDirectory, recoveryId);
        resolvePending(intakeDockerRecoveryReady(recoveryId));
      }
      const result = await resumed;
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "orchestrator_task_recovery_not_settled");
      assert.ok(result.recoveryIds.includes(recoveryId));
      assert.equal(recoveries, 1);
      assert.equal(attempts, 1);
      const after = readCoordinatorState(
        workingDirectory,
        "binding-a",
        "project-a",
      ).value;
      if (scenario === "after_settled") {
        assert.equal(cancellation.signal.aborted, true);
        const remaining = after?.tasks[0]?.recoveryObligations.find(
          (item) => item.recoveryId === recoveryId,
        );
        assert.equal(remaining?.phase, "settled");
        assert.equal(Object.hasOwn(remaining ?? {}, "acknowledgement"), false);
        const physical = JSON.parse(
          fs.readFileSync(
            path.join(workingDirectory, ".crdd", "domain-model", "state.json"),
            "utf8",
          ),
        );
        assert.equal(
          physical.operations.some(
            (operation: { recoveryId: string }) =>
              operation.recoveryId === recoveryId,
          ),
          true,
          "技術終端後の取消では最終Task保存前のOperationとexact回復参照を保持する",
        );
      } else
        assert.deepEqual(after, {
          ...expected,
          tasks: expected.tasks.map((task) => ({
            ...task,
            cleanupConfirmed:
              scenario === "reject" ? task.cleanupConfirmed : true,
            recoveryObligations: task.recoveryObligations.map((item) =>
              item.recoveryId === recoveryId && scenario !== "reject"
                ? { ...item, phase: "settled" }
                : item,
            ),
          })),
        });
      assert.deepEqual(
        readProjectOperationQueueState(workingDirectory, "binding-a", queueId)
          .value,
        expectedQueue,
      );
    });
  }
});

/**
 * exact Runtime-owned recovery settles and retries without client recovery authorityを検証する。
 *
 * @responsibility exact Runtime-owned recovery settles and retries without client recovery authorityの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact Runtime-owned recovery settles and retries without client recovery authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact Runtime-owned recovery settles and retries without client recovery authority", async (t) => {
  const workingDirectory = root(t);
  const recoverySignal = new AbortController().signal;
  let recoveryId = "";
  let attempts = 0;
  let recoveries = 0;
  let recoveryObservationAttempts = 0;
  let interruptRetryAdmission = false;
  let finalizationFault:
    | "refused"
    | "save_blocked"
    | "candidate_missing"
    | null = null;
  let finalizations = 0;
  let finalizationDiagnostics = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
    }),
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    createTaskExecutions: () => {
      if (interruptRetryAdmission) {
        interruptRetryAdmission = false;
        throw new Error("fixture_retry_admission_interrupted");
      }
      return [
        {
          taskId: "task-a",
          taskRequest: {},
          repositoryRoot: workingDirectory,
        },
      ];
    },
    observeLeaseOwner: () => ({ status: "absent" }),
    recoverTaskRecovery: async (exact: string, signal: AbortSignal) => {
      recoveries += 1;
      assert.equal(exact, recoveryId);
      assert.equal(signal, recoverySignal);
      await new Promise<void>((resolve) => setImmediate(resolve));
      settleSyntheticOperation(workingDirectory, exact);
      return intakeDockerRecoveryReady(exact);
    },
    observeRecoveryTransition: async (event: Readonly<{ phase: string }>) => {
      recoveryObservationAttempts += 1;
      if (event.phase === "verification_resources_finalized")
        finalizationDiagnostics++;
      if (event.phase === "retry_ready") interruptRetryAdmission = true;
      throw new Error("diagnostic_unavailable");
    },
    finalizeRecoveryWrite: (
      ...args: Parameters<typeof saveProjectExecutionState>
    ) => {
      const [repository, binding, update, generation, intake] = args;
      assert.equal(binding, "binding-a");
      assert.equal(intake?.operation, "resume");
      assert.deepEqual(update, {
        kind: "task_recovery_finalize",
        projectId: "project-a",
        recoveries: [{ taskId: "task-a", recoveryId }],
      });
      const current = readState(repository, binding, "execution");
      assert.equal(current.status, "completed");
      assert.equal(current.value?.projects[0]?.generation, generation);
      finalizations++;
      if (
        finalizationFault === "refused" ||
        finalizationFault === "save_blocked"
      )
        return {
          status: "blocked",
          reason:
            finalizationFault === "refused"
              ? "orchestrator_task_recovery_not_settled"
              : "save_unconfirmed",
        };
      const result = saveProjectExecutionState(...args);
      if (finalizationFault === "candidate_missing") {
        assert.equal(result.status, "completed");
        return { ...result, taskStartCandidates: null };
      }
      return result;
    },
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        attempts += 1;
        const result = await completed(input);
        if (attempts === 1)
          recoveryId =
            registerSyntheticOperations(
              workingDirectory,
              input.operationId,
              1,
            )[0]?.recoveryId ?? assert.fail("synthetic_operation_missing");
        return attempts === 1
          ? {
              ...result,
              status: "blocked" as const,
              reason: "docker_cleanup_unknown",
              effectState: "unknown" as const,
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              recoveryIds: [recoveryId],
              recoveryObligations: [{ kind: "docker" as const, recoveryId }],
              candidateId: null,
            }
          : result;
      },
    },
  };

  const first = await runCoordinatorObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    recoverySignal,
  );
  assert.equal(
    first.reason,
    "orchestrator_task_recovery_required",
    JSON.stringify(first),
  );
  assert.equal(first.manualRecoveryRequired, true);
  assert.equal(first.recoveryIds.includes(recoveryId), true);
  assert.ok("recoveryObligations" in first);
  assert.equal(
    first.recoveryObligations.some(
      (entry) => entry.kind === "docker" && entry.recoveryId === recoveryId,
    ),
    true,
  );
  assert.equal(
    first.recoveryObligations.some(
      (entry) =>
        entry.kind === "runtime_process" &&
        entry.recoveryId.startsWith("runtime-process."),
    ),
    true,
  );
  assert.equal(recoveries, 0);
  assert.equal(finalizations, 0);
  const resumed = await runCoordinatorObjective(
    dependencies,
    request({ operation: "resume", maximumReplans: 0 }),
    recoverySignal,
  );
  assert.equal(resumed.status, "blocked", JSON.stringify(resumed));
  assert.equal(resumed.reason, "orchestrator_task_recovery_not_settled");
  assert.equal(recoveries, 1);
  assert.equal(attempts, 1);
  assert.equal(finalizations, 0);

  settleRuntimeProcessAsFreshProcess(
    workingDirectory,
    "binding-a",
    "project-a",
  );

  for (const [fault, reason] of [
    ["refused", "orchestrator_task_recovery_not_settled"],
    ["save_blocked", "save_unconfirmed"],
    ["candidate_missing", "orchestrator_state_observation_unknown"],
  ] as const) {
    finalizationFault = fault;
    const before: number = finalizations;
    const stopped = await runCoordinatorObjective(
      dependencies,
      request({ operation: "resume", maximumReplans: 0 }),
      recoverySignal,
    );
    assert.equal(stopped.status, "blocked");
    assert.equal(stopped.reason, reason);
    assert.equal(stopped.cleanupConfirmed, false);
    assert.equal(stopped.manualRecoveryRequired, true);
    assert.ok(stopped.recoveryIds.includes(recoveryId));
    assert.equal(finalizations, before + 1);
    assert.equal(finalizationDiagnostics, 0);
    assert.equal(attempts, 1);
    assert.equal(recoveries, 1);
  }
  finalizationFault = null;
  const interrupted = await runCoordinatorObjective(
    dependencies,
    request({ operation: "resume", maximumReplans: 0 }),
    recoverySignal,
  );
  assert.equal(interrupted.status, "blocked", JSON.stringify(interrupted));
  assert.equal(interrupted.reason, "orchestrator_task_execution_set_invalid");
  assert.equal(attempts, 1);
  assert.equal(recoveries, 1);
  assert.equal(finalizationDiagnostics, 1);
  const retained = readState(
    verifyRuntimePersistenceRepository(workingDirectory),
    "binding-a",
    "execution",
  );
  assert.equal(retained.status, "completed");
  assert.ok(retained.value);
  const queued = retained.value.queueEntries.find(
    (entry) => entry.projectId === "project-a",
  );
  assert.equal(queued?.state, "queued");
  assert.equal(queued?.resumeCondition, "exact_recovery_settled");
  assert.ok(queued?.resultReference);
  const task = retained.value.projects[0]?.tasks[0];
  assert.equal(task?.state, "ready");
  assert.equal(task.attemptId, null);
  assert.ok(
    task.recoveryObligations.some(
      (entry) => entry.recoveryId === recoveryId && entry.phase === "settled",
    ),
  );

  const finalizedBeforeRetry = finalizations;
  const completedRecovery = await runCoordinatorObjective(
    dependencies,
    request({ operation: "resume", maximumReplans: 0 }),
    recoverySignal,
  );
  assert.equal(
    completedRecovery.status,
    "completed",
    JSON.stringify(completedRecovery),
  );
  assert.equal(
    completedRecovery.reason,
    "orchestrator_tasks_completed_integration_pending",
  );
  assert.equal(recoveries, 1);
  assert.equal(attempts, 2);
  assert.equal(finalizations, finalizedBeforeRetry);
  assert.equal(finalizationDiagnostics, 1);
  assert.ok(recoveryObservationAttempts > 0);
  const latest = readCoordinatorState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(
    latest.status === "completed" && latest.value?.tasks[0]?.retryCount,
    1,
  );
});

/**
 * 複数Recoveryの順次処置、先行失敗後の保持とHost義務の非処置を検証する。
 *
 * @responsibility 同じTaskの二Docker回復をexact IDで処置し、失敗後の後続項目と対象外Host義務を保持する合否を判定する。
 * @trace PRL-IT-005
 * @trace PRL-IT-013
 * @precondition 実Repository保存層と実再入場Applicationを使い、Provider実行とDocker回復Portは合成する。
 * @stimulus 二Docker回復とHost義務を作り、通常と先頭回復の未確認の二条件で同じObjectiveへ再入場する。
 * @observation 回復呼出しID、受領ID、Task再実行回数、保存済み項目phaseとHost義務の全fieldを観測する。
 * @oracle 先頭未確認では後続をrequiredのまま保持し、次回も同じIDで回復する。Host義務は変更せず外部回復として返す。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 * @boundary PRL-IT-013=Related 2 Blocks: Task State Store→Objective Application→合成Task Recovery Port。実Docker清掃は対象外である。
 */
test("混在RecoveryはDockerをsettleして外部義務を型付きで返す", async (t) => {
  for (const isFirstRecoveryBlocked of [false, true]) {
    const workingDirectory = root(t);
    const hostRecoveryId = `host-task.${"a".repeat(64)}`;
    let dockerRecoveryId = "";
    let secondDockerRecoveryId = "";
    const recoveryCalls: string[] = [];
    let attempts = 0;
    const dependencies = {
      authenticatedPrincipalId: "principal-a",
      verifyProjectBinding: () => ({
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory,
        repositoryRoot: workingDirectory,
      }),
      resolveTaskSelections: () => ({
        status: "resolved" as const,
        value: taskExecutionSelections(),
        reason: null,
      }),
      createTaskExecutions: () => [
        {
          taskId: "task-a",
          taskRequest: {},
          repositoryRoot: workingDirectory,
        },
      ],
      observeLeaseOwner: () => ({ status: "absent" }),
      recoverTaskRecovery: (recoveryId: string) => {
        recoveryCalls.push(recoveryId);
        assert.ok(
          [dockerRecoveryId, secondDockerRecoveryId].includes(recoveryId),
        );
        if (isFirstRecoveryBlocked && recoveryCalls.length === 1) {
          assert.equal(recoveryId, dockerRecoveryId);
          return {
            status: "blocked",
            recoveryId,
            manualRecoveryRequired: true,
          };
        }
        settleSyntheticOperation(workingDirectory, recoveryId);
        return intakeDockerRecoveryReady(recoveryId);
      },
      execution: {
        runSingleTaskAttempt: async (
          input: CoordinatorSingleTaskAttemptInput,
        ) => {
          attempts += 1;
          const result = await completed(input);
          const references = registerSyntheticOperations(
            workingDirectory,
            input.operationId,
          );
          dockerRecoveryId =
            references[0]?.recoveryId ??
            assert.fail("synthetic_operation_missing");
          secondDockerRecoveryId =
            references[1]?.recoveryId ??
            assert.fail("synthetic_operation_missing");
          return {
            ...result,
            status: "blocked" as const,
            reason: "host_cleanup_unknown",
            effectState: "unknown" as const,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            recoveryIds: [
              hostRecoveryId,
              dockerRecoveryId,
              secondDockerRecoveryId,
            ],
            recoveryObligations: [
              { kind: "host" as const, recoveryId: hostRecoveryId },
              { kind: "docker" as const, recoveryId: dockerRecoveryId },
              { kind: "docker" as const, recoveryId: secondDockerRecoveryId },
            ],
            candidateId: null,
          };
        },
      },
    };
    const first = await runCoordinatorObjective(
      dependencies,
      request({ maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(
      first.reason,
      "orchestrator_task_recovery_required",
      JSON.stringify(first),
    );
    const beforeReentry = readCoordinatorState(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    assert.equal(beforeReentry.status, "completed");
    assert.ok(beforeReentry.value);
    const hostBefore = beforeReentry.value.tasks[0]?.recoveryObligations.find(
      (entry) => entry.recoveryId === hostRecoveryId,
    );
    assert.ok(hostBefore);
    assert.equal(hostBefore.phase, "required");
    const resumed = await runCoordinatorObjective(
      dependencies,
      request({ operation: "resume", maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(resumed.reason, "orchestrator_task_recovery_not_settled");
    const afterStoppedReentry = readCoordinatorState(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    assert.equal(afterStoppedReentry.status, "completed");
    assert.ok(afterStoppedReentry.value);
    assert.deepEqual(
      afterStoppedReentry.value.tasks[0]?.recoveryObligations.find(
        (entry) => entry.recoveryId === hostRecoveryId,
      ),
      hostBefore,
    );
    const secondAfterStop =
      afterStoppedReentry.value.tasks[0]?.recoveryObligations.find(
        (entry) => entry.recoveryId === secondDockerRecoveryId,
      );
    assert.ok(secondAfterStop);
    assert.equal(
      secondAfterStop.phase,
      isFirstRecoveryBlocked ? "required" : "settled",
    );
    assert.deepEqual(
      recoveryCalls,
      isFirstRecoveryBlocked
        ? [dockerRecoveryId]
        : [dockerRecoveryId, secondDockerRecoveryId],
    );
    assert.equal(attempts, 1);
    settleRuntimeProcessAsFreshProcess(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    const externalRecovery = await runCoordinatorObjective(
      dependencies,
      request({ operation: "resume", maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(
      externalRecovery.reason,
      "orchestrator_external_recovery_required",
    );
    assert.ok("recoveryObligations" in externalRecovery);
    assert.deepEqual(externalRecovery.recoveryObligations, [
      { kind: "host", recoveryId: hostRecoveryId },
    ]);
    assert.deepEqual(
      recoveryCalls,
      isFirstRecoveryBlocked
        ? [dockerRecoveryId, dockerRecoveryId, secondDockerRecoveryId]
        : [dockerRecoveryId, secondDockerRecoveryId],
    );
    const afterExternal = readCoordinatorState(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    assert.equal(afterExternal.status, "completed");
    assert.ok(afterExternal.value);
    assert.deepEqual(
      afterExternal.value.tasks[0]?.recoveryObligations.find(
        (entry) => entry.recoveryId === hostRecoveryId,
      ),
      hostBefore,
    );
    for (const id of [dockerRecoveryId, secondDockerRecoveryId]) {
      assert.equal(
        afterExternal.value.tasks[0]?.recoveryObligations.find(
          (entry) => entry.recoveryId === id,
        )?.phase,
        "settled",
      );
    }
    assert.equal(attempts, 1);
  }
});

/**
 * owner lossはAuthority発行前の予約をEffect 0で戻して同じObjectiveを再開するを検証する。
 *
 * @responsibility owner lossはAuthority発行前の予約をEffect 0で戻して同じObjectiveを再開するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus owner lossはAuthority発行前の予約をEffect 0で戻して同じObjectiveを再開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("owner lossはAuthority発行前の予約をEffect 0で戻して同じObjectiveを再開する", async (t) => {
  const workingDirectory = root(t);
  let effects = 0;
  const baseDependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
    }),
    resolveTaskSelections: () => ({
      status: "resolved" as const,
      value: taskExecutionSelections(),
      reason: null,
    }),
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        effects += 1;
        return completed(input);
      },
    },
  };
  const seeded = await runCoordinatorObjective(
    { ...baseDependencies, createTaskExecutions: () => [] },
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(seeded.reason, "orchestrator_task_execution_set_invalid");
  const selectedQueue = selectNextProjectOperation(
    workingDirectory,
    "binding-a",
  );
  assert.ok(selectedQueue.value);
  const queueId = selectedQueue.value.queueId;
  const stateRead = readCoordinatorState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.ok(stateRead.value);
  const reserved = saveProjectExecutionState(
    verifyRuntimePersistenceRepository(workingDirectory),
    "binding-a",
    {
      kind: "task_start",
      projectId: "project-a",
      taskId: "task-a",
      attemptId: "attempt-owner-loss",
      authorityBindingId: "authority-owner-loss",
    },
    stateRead.value.generation,
  );
  assert.equal(reserved.status, "completed", reserved.reason);
  const queueRead = readProjectOperationQueueState(
    workingDirectory,
    "binding-a",
    queueId,
  );
  assert.ok(queueRead.value);
  const lease = acquireCoordinatorLease(
    workingDirectory,
    "binding-a",
    "project-a",
    queueId,
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const ownedQueue = updateProjectOperationQueueState(
    workingDirectory,
    "binding-a",
    queueId,
    queueRead.value.generation,
    {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(ownedQueue.status, "completed");
  assert.equal(lease.value.release().status, "completed");

  const resumed = await runCoordinatorObjective(
    {
      ...baseDependencies,
      createTaskExecutions: () => [
        {
          taskId: "task-a",
          taskRequest: {},
          repositoryRoot: workingDirectory,
        },
      ],
    },
    request({ operation: "resume", maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.equal(effects, 1);
  assert.equal(resumed.manualRecoveryRequired, false);
});

for (const interruption of [
  "recovery_not_started",
  "technical_settled",
  "task_published",
] as const) {
  /**
   * exact Recovery settlement resumes after ${interruption} durable interruption without replayを検証する。
   *
   * @responsibility exact Recovery settlement resumes after ${interruption} durable interruption without replayの合否判定を所有する。
   * @trace PRL-IT-005
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus exact Recovery settlement resumes after ${interruption} durable interruption without replayの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`exact Recovery settlement resumes after ${interruption} durable interruption without replay`, async (t) => {
    const workingDirectory = root(t);
    let recoveryId = "";
    let attempts = 0;
    let recoveries = 0;
    const dependencies = {
      authenticatedPrincipalId: "principal-a",
      verifyProjectBinding: () => ({
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory,
        repositoryRoot: workingDirectory,
      }),
      resolveTaskSelections: () => ({
        status: "resolved" as const,
        value: taskExecutionSelections(),
        reason: null,
      }),
      createTaskExecutions: () => [
        {
          taskId: "task-a",
          taskRequest: {},
          repositoryRoot: workingDirectory,
        },
      ],
      observeLeaseOwner: () => ({ status: "absent" }),
      recoverTaskRecovery: (recoveryId: string) => {
        recoveries += 1;
        if (interruption !== "recovery_not_started")
          throw new Error("recovery_effect_must_not_replay");
        settleSyntheticOperation(workingDirectory, recoveryId);
        return intakeDockerRecoveryReady(recoveryId);
      },
      execution: {
        runSingleTaskAttempt: async (
          input: Parameters<typeof completed>[0],
        ) => {
          attempts += 1;
          const result = await completed(input);
          if (attempts === 1)
            recoveryId =
              registerSyntheticOperations(
                workingDirectory,
                input.operationId,
                1,
              )[0]?.recoveryId ?? assert.fail("synthetic_operation_missing");
          return attempts === 1
            ? {
                ...result,
                status: "blocked" as const,
                reason: "docker_cleanup_unknown",
                effectState: "unknown" as const,
                cleanupConfirmed: false,
                manualRecoveryRequired: true,
                recoveryIds: [recoveryId],
                recoveryObligations: [{ kind: "docker" as const, recoveryId }],
                candidateId: null,
              }
            : result;
        },
      },
    };
    const initial = await runCoordinatorObjective(
      dependencies,
      request({ maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(initial.reason, "orchestrator_task_recovery_required");
    assert.ok("queueId" in initial);
    const queueBefore = readProjectOperationQueueState(
      workingDirectory,
      "binding-a",
      initial.queueId ?? "invalid",
    );
    const stateBefore = readCoordinatorState(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    assert.equal(queueBefore.status, "completed");
    assert.equal(stateBefore.status, "completed");
    assert.ok(queueBefore.value?.resultReference);
    assert.ok(stateBefore.value);
    if (interruption !== "recovery_not_started")
      settleSyntheticOperation(workingDirectory, recoveryId);
    settleRuntimeProcessAsFreshProcess(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    if (interruption === "task_published") {
      const current = readCoordinatorState(
        workingDirectory,
        "binding-a",
        "project-a",
      );
      assert.ok(current.value);
      const state = current.value;
      assert.equal(
        saveProjectExecutionState(
          verifyRuntimePersistenceRepository(workingDirectory),
          "binding-a",
          {
            kind: "task_recovery_finalize",
            projectId: state.projectId,
            recoveries: state.tasks.flatMap((task) =>
              task.recoveryObligations
                .filter((item) => item.kind === "docker")
                .map(({ recoveryId }) => ({
                  taskId: task.definition.id,
                  recoveryId,
                })),
            ),
          },
          state.generation,
        ).status,
        "completed",
      );
    }
    const resumed = await runCoordinatorObjective(
      dependencies,
      request({ operation: "resume", maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(resumed.status, "completed");
    assert.equal(recoveries, interruption === "recovery_not_started" ? 1 : 0);
    assert.equal(attempts, 2);
  });
}

import { inspectCoordinatorObjectiveRequest } from "../../src/index.ts";
