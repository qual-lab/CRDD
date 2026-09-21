/**
 * coordinator:integration:project-runtime-objective-intakeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-objective-intakeが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、objective、intake
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { consumeDockerRecoveryReceiptAfterProjectSettlement } from "../../src/security/docker-recovery-runtime.ts";
import { consumeProjectSettledDockerRecoveryWithRuntimeBoundary } from "../../src/security/docker-project-recovery-settlement.ts";
import { acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot } from "../../src/security/docker-recovery-runtime-internal.ts";
import {
  dockerRecoveryCommitName,
  writeCommittedDockerRecoveryJson,
} from "../../src/security/docker-recovery-journal.ts";

import {
  acquireProjectRuntimeLease,
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  selectNextProjectOperation,
  settleProjectOperationQueueRecovery,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "../../src/security/project-runtime-durable-foundation.ts";
import {
  inspectProjectRuntimeObjectiveRequest,
  runProjectRuntimeObjective as runProjectRuntimeObjectiveWithPorts,
} from "../../src/security/project-runtime-objective-intake.ts";
import { createProjectRuntimeExecutionAuthorizationAdapter } from "../../src/security/project-runtime-execution-authorization-adapter.ts";
import {
  markProjectTaskRecoveryObligationRecovering,
  type ProjectRuntimeSingleTaskAttemptInput,
  type ProjectRuntimeSingleTaskResult,
  reserveProjectTaskStart,
  settleProjectTaskRecoveryObligation,
} from "../../../project-runtime/src/index.ts";

const revision = "a".repeat(40);
type ObjectiveDependencies = Parameters<
  typeof runProjectRuntimeObjectiveWithPorts
>[0];
type TestObjectiveDependencies = Omit<ObjectiveDependencies, "execution"> &
  Readonly<{
    execution: Omit<ObjectiveDependencies["execution"], "authorization">;
  }>;

/**
 * runProjectRuntimeObjectiveのTest準備責務を実行する。
 *
 * @responsibility runProjectRuntimeObjectiveがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runProjectRuntimeObjectiveを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function runProjectRuntimeObjective(
  dependencies: TestObjectiveDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  return runProjectRuntimeObjectiveWithPorts(
    {
      ...dependencies,
      execution: {
        ...dependencies.execution,
        authorization: createProjectRuntimeExecutionAuthorizationAdapter({
          issueRuntimeCapability: () => Object.freeze({}),
          revokeRuntimeCapability: () => true,
        }),
      },
    },
    rawRequest,
    cancellationSignal,
  );
}
const dockerAcknowledgement = Object.freeze({
  runtimeStateBinding: Object.freeze({
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    runtimeStateBindingHash: "4".repeat(64),
  }),
  receiptContentHash: "5".repeat(64),
  receiptContentIdentity: "1:2:3",
});
/**
 * finalizedAcknowledgementのTest準備責務を実行する。
 *
 * @responsibility finalizedAcknowledgementがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus finalizedAcknowledgementを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
const finalizedAcknowledgement = () => ({
  status: "completed" as const,
  reason: "acknowledgement_collected",
});
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function root(t: test.TestContext) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-intake-"));
  execFileSync("git", ["init", "--quiet", value], { windowsHide: true });
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
   * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
    "project-runtime-lease-interleaving-probe.ts",
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function request(overrides: Record<string, unknown> = {}) {
  return {
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
  };
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
async function completed(input: {
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  observeStarted?: () => Promise<boolean>;
}): Promise<ProjectRuntimeSingleTaskResult> {
  assert.equal(await input.observeStarted?.(), true);
  return {
    contract: "crdd-coordinator/project-runtime-single-task-adapter",
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function settleRuntimeProcessAsFreshProcess(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
) {
  const observed = readProjectRuntimeState(
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
    const recovering = markProjectTaskRecoveryObligationRecovering(
      state,
      state.generation,
      task.definition.id,
      obligation.kind,
      obligation.recoveryId,
    );
    assert.equal(recovering.status, "completed");
    assert.ok(recovering.state);
    const write = writeProjectRuntimeState(
      workingDirectory,
      repositoryBindingId,
      recovering.state,
      state.generation,
    );
    assert.equal(write.status, "completed");
    state = write.value;
  }
  const settled = settleProjectTaskRecoveryObligation(
    state,
    state.generation,
    task.definition.id,
    obligation.kind,
    obligation.recoveryId,
  );
  assert.equal(settled.status, "completed");
  assert.ok(settled.state);
  const write = writeProjectRuntimeState(
    workingDirectory,
    repositoryBindingId,
    settled.state,
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("public Objective intake binds, plans, executes and deduplicates the same request", async (t) => {
  const workingDirectory = root(t);
  let effects = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
      bindingCapability: {},
    }),
    planObjective: () => ({
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
      runSingleTaskAttempt: async (
        input: ProjectRuntimeSingleTaskAttemptInput,
      ) => {
        effects += 1;
        return completed(input);
      },
    },
  };
  const first = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(first.status, "completed");
  assert.equal(first.projection?.nextAction, "verify_objective_integration");
  assert.equal(effects, 1);
  const second = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(second.status, "completed", JSON.stringify(second));
  assert.equal(effects, 1);
  const state = readProjectRuntimeState(
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("public Objective re-entry reconciles a pre-publication owner loss before execution", async (t) => {
  const workingDirectory = root(t);
  const queueId = `queue-${createHash("sha256")
    .update(
      [
        "binding-a",
        "project-a",
        "milestone-a",
        "request-a",
        "principal-a",
      ].join("\0"),
    )
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
          ...exactRequest,
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
    "project-runtime-lease-interleaving-probe.ts",
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
  const result = await runProjectRuntimeObjective(
    {
      authenticatedPrincipalId: "principal-a",
      verifyProjectBinding: () => ({
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory,
        repositoryRoot: workingDirectory,
        bindingCapability: {},
      }),
      planObjective: () => ({
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
    exactRequest,
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("public Objective re-entry preserves ambiguous acquisition evidence and returns its exact recovery reference", async (t) => {
  for (const count of [1, 2]) {
    const workingDirectory = root(t);
    const locks = path.join(
      workingDirectory,
      ".crdd",
      "project-runtime",
      "work",
      "locks",
    );
    fs.mkdirSync(locks, { recursive: true });
    const createdItems = Array.from({ length: count }, (_unused, index) =>
      path.join(
        locks,
        `.pending-project-operation-binding-a-acquisition-malformed-${index}.tmp`,
      ),
    );
    for (const target of createdItems)
      fs.writeFileSync(target, "not-json\n", "utf8");
    let effects = 0;
    const result = await runProjectRuntimeObjective(
      {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({
          status: "verified",
          repositoryBindingId: "binding-a",
          repositoryRevision: revision,
          workingDirectory,
          repositoryRoot: workingDirectory,
          bindingCapability: {},
        }),
        planObjective: () => ({
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
    assert.match(
      result.recoveryIds[0] ?? "",
      /^lease-acquisition-[0-9a-f]{40}$/u,
    );
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
    if (scenario !== "missing-queue") {
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
    if (scenario === "queue-mismatch") {
      const record = path.join(
        workingDirectory,
        ".crdd",
        "project-runtime",
        "queues",
        residualQueueId,
        "generation-1.json",
      );
      fs.writeFileSync(record, "not-json\n", "utf8");
    }
    const before = runtimeSnapshot(workingDirectory);
    let effects = 0;
    const result = await runProjectRuntimeObjective(
      {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({
          status: "verified",
          repositoryBindingId: "binding-a",
          repositoryRevision: revision,
          workingDirectory,
          repositoryRoot: workingDirectory,
          bindingCapability: {},
        }),
        planObjective: () => ({
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
    assert.match(
      result.recoveryIds[0] ?? "",
      /^lease-acquisition-[0-9a-f]{40}$/u,
      scenario,
    );
    assert.equal(
      result.reason,
      scenario === "foreign-project"
        ? "project_runtime_lease_acquisition_project_identity_mismatch"
        : "project_runtime_lease_acquisition_queue_identity_mismatch",
      scenario,
    );
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
      bindingCapability: {},
    }),
    planObjective: () => ({
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

  const interactive = runProjectRuntimeObjective(
    dependencies,
    request({ requestId: "request-interactive" }),
    new AbortController().signal,
  );
  await started;
  const scheduled = await runProjectRuntimeObjective(
    dependencies,
    request({ requestId: "request-scheduled", originLane: "scheduled" }),
    new AbortController().signal,
  );
  assert.equal(scheduled.status, "blocked");
  assert.equal(
    scheduled.reason,
    "project_runtime_objective_queued_waiting_foreground",
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
 * binding or planner scope failure creates no Project State or Task effectを検証する。
 *
 * @responsibility binding or planner scope failure creates no Project State or Task effectの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus binding or planner scope failure creates no Project State or Task effectの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("binding or planner scope failure creates no Project State or Task effect", async (t) => {
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
      bindingCapability: {},
    }),
    planObjective: () => ({
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
  const result = await runProjectRuntimeObjective(
    base,
    request(),
    new AbortController().signal,
  );
  assert.equal(result.reason, "project_runtime_plan_invalid_or_out_of_scope");
  assert.equal(effects, 0);
  const state = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(state.status === "completed" && state.value, null);
});

/**
 * public Objective intake rejects unknown fields, accessors, proxies, and non-closed planner output before effectを検証する。
 *
 * @responsibility public Objective intake rejects unknown fields, accessors, proxies, and non-closed planner output before effectの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus public Objective intake rejects unknown fields, accessors, proxies, and non-closed planner output before effectの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("public Objective intake rejects unknown fields, accessors, proxies, and non-closed planner output before effect", async (t) => {
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
        bindingCapability: {},
      };
    },
    planObjective: () => ({
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

  const unknownField = await runProjectRuntimeObjective(
    dependencies,
    request({ unknown: true }),
    new AbortController().signal,
  );
  assert.equal(
    unknownField.reason,
    "project_runtime_objective_request_invalid",
  );

  const getterRequest = request();
  Object.defineProperty(getterRequest, "objective", {
    enumerable: true,
    get: () => "Create the result.",
  });
  const accessor = await runProjectRuntimeObjective(
    dependencies,
    getterRequest,
    new AbortController().signal,
  );
  assert.equal(accessor.reason, "project_runtime_objective_request_invalid");

  let proxyTrapCount = 0;
  const proxy = await runProjectRuntimeObjective(
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
  assert.equal(proxy.reason, "project_runtime_objective_request_invalid");
  assert.equal(proxyTrapCount, 0);
  assert.equal(bindingCalls, 0);

  const planner = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(planner.reason, "project_runtime_plan_invalid_or_out_of_scope");
  assert.equal(bindingCalls, 1);
  assert.equal(taskEffects, 0);
  const state = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(state.status === "completed" && state.value, null);
});

/**
 * Objective intake accepts only a closed explicit decision-capability replacement requestを検証する。
 *
 * @responsibility Objective intake accepts only a closed explicit decision-capability replacement requestの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective intake accepts only a closed explicit decision-capability replacement requestの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("Objective intake accepts only a closed explicit decision-capability replacement request", () => {
  const base = request();
  const accepted = inspectProjectRuntimeObjectiveRequest({
    ...base,
    decisionCapabilityReplacement: {
      decisionId: "decision-a",
      replacementRequestId: "replacement-a",
    },
  });
  assert.equal(
    accepted?.decisionCapabilityReplacement?.replacementRequestId,
    "replacement-a",
  );
  assert.equal(
    inspectProjectRuntimeObjectiveRequest({
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
 * exact Runtime-owned recovery settles and retries without client recovery authorityを検証する。
 *
 * @responsibility exact Runtime-owned recovery settles and retries without client recovery authorityの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact Runtime-owned recovery settles and retries without client recovery authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("exact Runtime-owned recovery settles and retries without client recovery authority", async (t) => {
  const workingDirectory = root(t);
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  let attempts = 0;
  let recoveries = 0;
  let acknowledgements = 0;
  let recoveryObservationAttempts = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
      bindingCapability: {},
    }),
    planObjective: () => ({
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
    }),
    createTaskExecutions: () => [
      {
        taskId: "task-a",
        taskRequest: {},
        repositoryRoot: workingDirectory,
      },
    ],
    observeLeaseOwner: () => ({ status: "absent" }),
    recoverTaskRecovery: (exact: string) => {
      recoveries += 1;
      assert.equal(exact, recoveryId);
      return { status: "recovered", recoveryId: null };
    },
    acknowledgeTaskRecovery: (settlement: {
      workingDirectory: string;
      repositoryBindingId: string;
      recoveryId: string;
      projectId: string;
      milestoneId: string;
      stateGeneration: number;
      taskId: string;
      attemptId: string;
      operationId: string;
      kind: "docker";
    }) => {
      acknowledgements += 1;
      assert.equal(settlement.workingDirectory, workingDirectory);
      assert.equal(settlement.repositoryBindingId, "binding-a");
      assert.equal(settlement.recoveryId, recoveryId);
      assert.equal(settlement.projectId, "project-a");
      assert.equal(settlement.milestoneId, "milestone-a");
      assert.equal(settlement.taskId, "task-a");
      assert.equal(settlement.kind, "docker");
      assert.ok(settlement.stateGeneration > 0);
      assert.match(settlement.attemptId, /^attempt-/u);
      assert.match(settlement.operationId, /^operation-/u);
      const observed = readProjectRuntimeState(
        workingDirectory,
        settlement.repositoryBindingId,
        settlement.projectId,
      );
      const task = observed.value?.tasks.find(
        (entry) => entry.definition.id === settlement.taskId,
      );
      assert.equal(observed.value?.generation, settlement.stateGeneration);
      assert.equal(task?.attemptId, settlement.attemptId);
      assert.equal(task?.operationId, settlement.operationId);
      assert.ok(
        task?.recoveryObligations.some(
          (entry) =>
            entry.kind === "docker" &&
            entry.recoveryId === settlement.recoveryId &&
            entry.phase === "settled",
        ),
      );
      assert.equal(
        consumeDockerRecoveryReceiptAfterProjectSettlement({
          ...settlement,
          repositoryBindingId: "binding-b",
        }).status,
        "blocked",
      );
      assert.equal(
        consumeDockerRecoveryReceiptAfterProjectSettlement({
          ...settlement,
          stateGeneration: settlement.stateGeneration - 1,
        }).status,
        "blocked",
      );
      assert.notEqual(
        consumeDockerRecoveryReceiptAfterProjectSettlement(settlement).reason,
        "docker_task_recovery_settlement_not_verified",
      );
      return acknowledgements === 1
        ? { status: "blocked", reason: "acknowledgement_interrupted" }
        : {
            status: "completed",
            reason: "acknowledged",
            acknowledgement: dockerAcknowledgement,
          };
    },
    finalizeTaskRecoveryAcknowledgement: finalizedAcknowledgement,
    observeRecoveryTransition: async () => {
      recoveryObservationAttempts += 1;
      throw new Error("diagnostic_unavailable");
    },
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        attempts += 1;
        return attempts === 1
          ? {
              ...(await completed(input)),
              status: "blocked" as const,
              reason: "docker_cleanup_unknown",
              effectState: "unknown" as const,
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              recoveryIds: [recoveryId],
              recoveryObligations: [{ kind: "docker" as const, recoveryId }],
              candidateId: null,
            }
          : completed(input);
      },
    },
  };

  const first = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(
    first.reason,
    "project_runtime_task_recovery_required",
    JSON.stringify(first),
  );
  assert.equal(first.manualRecoveryRequired, true);
  assert.equal(first.recoveryIds.includes(recoveryId), true);
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
  const staleAttemptState = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  const staleTask = staleAttemptState.value?.tasks.find(
    (entry) => entry.definition.id === "task-a",
  );
  assert.ok(staleTask?.attemptId);
  assert.ok(staleTask?.operationId);

  const resumed = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(resumed.status, "blocked", JSON.stringify(resumed));
  assert.equal(resumed.reason, "project_runtime_task_recovery_not_settled");
  assert.equal(recoveries, 1);
  assert.equal(attempts, 1);

  settleRuntimeProcessAsFreshProcess(
    workingDirectory,
    "binding-a",
    "project-a",
  );

  const acknowledgementInterrupted = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(acknowledgementInterrupted.status, "blocked");
  assert.equal(
    acknowledgementInterrupted.reason,
    "project_runtime_task_recovery_acknowledgement_not_settled",
  );

  const acknowledged = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(acknowledged.status, "completed", JSON.stringify(acknowledged));
  assert.equal(
    acknowledged.reason,
    "project_runtime_tasks_completed_integration_pending",
  );
  assert.equal(recoveries, 1);
  assert.equal(acknowledgements, 2);
  assert.equal(attempts, 2);
  assert.ok(recoveryObservationAttempts > 0);
  const latest = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(
    latest.status === "completed" && latest.value?.tasks[0]?.retryCount,
    1,
  );
  const runtimeDirectory = path.join(workingDirectory, "runtime-state");
  fs.mkdirSync(runtimeDirectory);
  const verifiedRoot = Object.freeze({
    rootPath: runtimeDirectory,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    stableLogicalHomeBindingHash: "4".repeat(64),
  });
  const receiptName = `completed-docker-recovery-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}.json`;
  writeCommittedDockerRecoveryJson(runtimeDirectory, receiptName, receiptName, {
    schema: "crdd-coordinator-docker-recovery-completion/v1",
    recoveryId,
    runtimeStateBinding: {
      runtimeStateIdentityHash: verifiedRoot.runtimeStateIdentityHash,
      runtimeStateProtectionHash: verifiedRoot.runtimeStateProtectionHash,
      localUserBindingHash: verifiedRoot.localUserBindingHash,
      runtimeStateBindingHash: verifiedRoot.stableLogicalHomeBindingHash,
    },
  });
  const projectBefore = JSON.stringify(latest.value);
  const queueId = acknowledged.queueId ?? "missing";
  const queueBefore = JSON.stringify(
    readProjectOperationQueueState(workingDirectory, "binding-a", queueId)
      .value,
  );
  const receiptBefore = fs.readFileSync(
    path.join(runtimeDirectory, receiptName),
  );
  const receiptCommitBefore = fs.readFileSync(
    path.join(runtimeDirectory, dockerRecoveryCommitName(receiptName)),
  );
  let runtimeAcknowledgementEffects = 0;
  const staleSettlement = {
    workingDirectory,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    stateGeneration: latest.value?.generation ?? -1,
    taskId: "task-a",
    attemptId: staleTask?.attemptId ?? "missing",
    operationId: staleTask?.operationId ?? "missing",
    kind: "docker" as const,
    recoveryId,
  };
  assert.deepEqual(
    consumeProjectSettledDockerRecoveryWithRuntimeBoundary(
      staleSettlement,
      (exactRecoveryId) => {
        runtimeAcknowledgementEffects += 1;
        return acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot(
          exactRecoveryId,
          verifiedRoot,
        );
      },
    ),
    {
      status: "blocked",
      reason: "docker_task_recovery_settlement_not_verified",
    },
  );
  assert.equal(runtimeAcknowledgementEffects, 0);
  assert.equal(
    JSON.stringify(
      readProjectRuntimeState(workingDirectory, "binding-a", "project-a").value,
    ),
    projectBefore,
  );
  assert.equal(
    JSON.stringify(
      readProjectOperationQueueState(workingDirectory, "binding-a", queueId)
        .value,
    ),
    queueBefore,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(runtimeDirectory, receiptName)),
    receiptBefore,
  );
  assert.deepEqual(
    fs.readFileSync(
      path.join(runtimeDirectory, dockerRecoveryCommitName(receiptName)),
    ),
    receiptCommitBefore,
  );
});

/**
 * 混在RecoveryはDockerをsettleして外部義務を型付きで返すを検証する。
 *
 * @responsibility 混在RecoveryはDockerをsettleして外部義務を型付きで返すの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 混在RecoveryはDockerをsettleして外部義務を型付きで返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("混在RecoveryはDockerをsettleして外部義務を型付きで返す", async (t) => {
  const workingDirectory = root(t);
  const hostRecoveryId = `host-task.${"a".repeat(64)}`;
  const dockerRecoveryId = `docker-task.${"b".repeat(64)}.${"c".repeat(64)}.${"d".repeat(64)}`;
  let recoveryCalls = 0;
  let attempts = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified",
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
      bindingCapability: {},
    }),
    planObjective: () => ({
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
      recoveryCalls += 1;
      assert.equal(recoveryId, dockerRecoveryId);
      return {
        status: "recovered",
        recoveryId: null,
        manualRecoveryRequired: false,
      };
    },
    acknowledgeTaskRecovery: () => ({
      status: "completed",
      reason: "acknowledged",
      acknowledgement: dockerAcknowledgement,
    }),
    finalizeTaskRecoveryAcknowledgement: finalizedAcknowledgement,
    execution: {
      runSingleTaskAttempt: async (
        input: ProjectRuntimeSingleTaskAttemptInput,
      ) => {
        attempts += 1;
        return {
          ...(await completed(input)),
          status: "blocked" as const,
          reason: "host_cleanup_unknown",
          effectState: "unknown" as const,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          recoveryIds: [hostRecoveryId, dockerRecoveryId],
          recoveryObligations: [
            { kind: "host" as const, recoveryId: hostRecoveryId },
            { kind: "docker" as const, recoveryId: dockerRecoveryId },
          ],
          candidateId: null,
        };
      },
    },
  };
  const first = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(
    first.reason,
    "project_runtime_task_recovery_required",
    JSON.stringify(first),
  );
  const resumed = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(resumed.reason, "project_runtime_task_recovery_not_settled");
  settleRuntimeProcessAsFreshProcess(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  const externalRecovery = await runProjectRuntimeObjective(
    dependencies,
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(
    externalRecovery.reason,
    "project_runtime_external_recovery_required",
  );
  assert.deepEqual(externalRecovery.recoveryObligations, [
    { kind: "host", recoveryId: hostRecoveryId },
  ]);
  assert.equal(recoveryCalls, 1);
  assert.equal(attempts, 1);
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
      bindingCapability: {},
    }),
    planObjective: () => ({
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
    }),
    observeLeaseOwner: () => ({ status: "absent" }),
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        effects += 1;
        return completed(input);
      },
    },
  };
  const seeded = await runProjectRuntimeObjective(
    { ...baseDependencies, createTaskExecutions: () => [] },
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(seeded.reason, "project_runtime_task_execution_set_invalid");
  const selectedQueue = selectNextProjectOperation(
    workingDirectory,
    "binding-a",
  );
  assert.ok(selectedQueue.value);
  const queueId = selectedQueue.value.queueId;
  const stateRead = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.ok(stateRead.value);
  const reserved = reserveProjectTaskStart(
    stateRead.value,
    stateRead.value.generation,
    "task-a",
    "attempt-owner-loss",
    "authority-owner-loss",
  );
  assert.ok(reserved.state);
  assert.equal(
    writeProjectRuntimeState(
      workingDirectory,
      "binding-a",
      reserved.state,
      stateRead.value.generation,
    ).status,
    "completed",
  );
  const queueRead = readProjectOperationQueueState(
    workingDirectory,
    "binding-a",
    queueId,
  );
  assert.ok(queueRead.value);
  const lease = acquireProjectRuntimeLease(
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

  const resumed = await runProjectRuntimeObjective(
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
    request({ maximumReplans: 0 }),
    new AbortController().signal,
  );
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.equal(effects, 1);
  assert.equal(resumed.manualRecoveryRequired, false);
});

for (const interruption of [
  "recovering_only",
  "item_only",
  "item_and_queue",
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
   * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
   */
  test(`exact Recovery settlement resumes after ${interruption} durable interruption without replay`, async (t) => {
    const workingDirectory = root(t);
    const recoveryId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
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
        bindingCapability: {},
      }),
      planObjective: () => ({
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
      }),
      createTaskExecutions: () => [
        {
          taskId: "task-a",
          taskRequest: {},
          repositoryRoot: workingDirectory,
        },
      ],
      observeLeaseOwner: () => ({ status: "absent" }),
      recoverTaskRecovery: () => {
        recoveries += 1;
        if (interruption !== "recovering_only")
          throw new Error("recovery_effect_must_not_replay");
        return {
          status: "recovered",
          recoveryId: null,
          manualRecoveryRequired: false,
        };
      },
      acknowledgeTaskRecovery: () => ({
        status: "completed",
        reason: "acknowledged",
        acknowledgement: dockerAcknowledgement,
      }),
      finalizeTaskRecoveryAcknowledgement: finalizedAcknowledgement,
      execution: {
        runSingleTaskAttempt: async (
          input: Parameters<typeof completed>[0],
        ) => {
          attempts += 1;
          return attempts === 1
            ? {
                ...(await completed(input)),
                status: "blocked" as const,
                reason: "docker_cleanup_unknown",
                effectState: "unknown" as const,
                cleanupConfirmed: false,
                manualRecoveryRequired: true,
                recoveryIds: [recoveryId],
                recoveryObligations: [{ kind: "docker" as const, recoveryId }],
                candidateId: null,
              }
            : completed(input);
        },
      },
    };
    const initial = await runProjectRuntimeObjective(
      dependencies,
      request({ maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(initial.reason, "project_runtime_task_recovery_required");
    const queueBefore = readProjectOperationQueueState(
      workingDirectory,
      "binding-a",
      initial.queueId ?? "invalid",
    );
    const stateBefore = readProjectRuntimeState(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    assert.equal(queueBefore.status, "completed");
    assert.equal(stateBefore.status, "completed");
    assert.ok(queueBefore.value?.resultReference);
    assert.ok(stateBefore.value);
    const durableState = stateBefore.value;
    const recovering = markProjectTaskRecoveryObligationRecovering(
      durableState,
      durableState.generation,
      "task-a",
      "docker",
      recoveryId,
    );
    assert.equal(recovering.status, "completed");
    assert.ok(recovering.state);
    const recoveringWrite = writeProjectRuntimeState(
      workingDirectory,
      "binding-a",
      recovering.state,
      durableState.generation,
    );
    assert.equal(recoveringWrite.status, "completed");
    if (interruption !== "recovering_only") {
      const itemSettled = settleProjectTaskRecoveryObligation(
        recoveringWrite.value,
        recoveringWrite.value.generation,
        "task-a",
        "docker",
        recoveryId,
      );
      assert.equal(itemSettled.status, "completed");
      assert.ok(itemSettled.state);
      const settledWrite = writeProjectRuntimeState(
        workingDirectory,
        "binding-a",
        itemSettled.state,
        recoveringWrite.value.generation,
      );
      assert.equal(settledWrite.status, "completed");
    }
    if (interruption === "item_and_queue") {
      const queueSettled = settleProjectOperationQueueRecovery(
        workingDirectory,
        "binding-a",
        initial.queueId ?? "invalid",
        queueBefore.value?.generation ?? -1,
        queueBefore.value?.resultReference ?? "invalid",
      );
      assert.equal(queueSettled.status, "completed");
    }
    settleRuntimeProcessAsFreshProcess(
      workingDirectory,
      "binding-a",
      "project-a",
    );
    const resumed = await runProjectRuntimeObjective(
      dependencies,
      request({ maximumReplans: 0 }),
      new AbortController().signal,
    );
    assert.equal(resumed.status, "completed");
    assert.equal(recoveries, interruption === "recovering_only" ? 1 : 0);
    assert.equal(attempts, 2);
  });
}
