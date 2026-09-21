/**
 * coordinator:integration:project-runtime-replanning-and-decisionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-replanning-and-decisionが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @trace PRL-IT-008
 * @level IT
 * @scope project、runtime、replanning、and、decision
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime / PRL-IT-008=Direct Boundary: Projection／SPEC入力→Acceptance Decision Port→Decision Store
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createProjectRuntimePersistencePorts,
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  writeProjectRuntimeState,
} from "../../src/security/project-runtime-durable-foundation.ts";
import { createProjectRuntimeDecisionCapabilityAdapter } from "../../src/security/project-runtime-decision-capability-adapter.ts";
import { runProjectRuntimeOperation as runProjectRuntimeOperationWithPorts } from "../../../project-runtime/src/index.ts";
import { createProjectRuntimeExecutionHostPorts } from "../../src/security/project-runtime-execution-host-adapter.ts";
import { createProjectRuntimeExecutionAuthorizationAdapter } from "../../src/security/project-runtime-execution-authorization-adapter.ts";
import {
  applyProjectRuntimeHumanDecision,
  invalidateProjectRuntimeHumanDecision,
  issueProjectRuntimeHumanDecision,
  recoverProjectRuntimeHumanDecision,
  replaceProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
  createProjectRuntimeState,
  resolveProjectRuntimeReplan as resolveProjectRuntimeReplanWithPort,
  type ProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionRecoveryIntent,
  type ProjectRuntimeReplanClassifier,
  type ProjectRuntimeReplanInput,
} from "../../../project-runtime/src/index.ts";

const revision = "a".repeat(40);

/**
 * decisionApplicationDependenciesのTest準備責務を実行する。
 *
 * @responsibility decisionApplicationDependenciesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus decisionApplicationDependenciesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function decisionApplicationDependencies(root: string) {
  return {
    capability: createProjectRuntimeDecisionCapabilityAdapter(),
    persistence: createProjectRuntimePersistencePorts(root, "binding-a"),
  };
}
/**
 * hashのTest準備責務を実行する。
 *
 * @responsibility hashがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus hashを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

type BoundExecutionDependencies = Omit<
  Parameters<typeof runProjectRuntimeOperationWithPorts>[0],
  "persistence" | "clockIdentity" | "processSafety" | "authorization"
>;
type BoundExecutionInput = Parameters<
  typeof runProjectRuntimeOperationWithPorts
>[1] &
  Readonly<{ workingDirectory: string; repositoryBindingId: string }>;

/**
 * runProjectRuntimeOperationのTest準備責務を実行する。
 *
 * @responsibility runProjectRuntimeOperationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runProjectRuntimeOperationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function runProjectRuntimeOperation(
  dependencies: BoundExecutionDependencies,
  input: BoundExecutionInput,
) {
  const { workingDirectory, repositoryBindingId, ...applicationInput } = input;
  return runProjectRuntimeOperationWithPorts(
    {
      ...dependencies,
      ...createProjectRuntimeExecutionHostPorts(),
      authorization: createProjectRuntimeExecutionAuthorizationAdapter({
        issueRuntimeCapability: () => Object.freeze({}),
        revokeRuntimeCapability: () => true,
      }),
      persistence: createProjectRuntimePersistencePorts(
        workingDirectory,
        repositoryBindingId,
      ),
    },
    applicationInput,
  );
}

/**
 * resolveProjectRuntimeReplanのTest準備責務を実行する。
 *
 * @responsibility resolveProjectRuntimeReplanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolveProjectRuntimeReplanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function resolveProjectRuntimeReplan(
  input: ProjectRuntimeReplanInput &
    Readonly<{ workingDirectory: string; repositoryBindingId: string }>,
  classify: ProjectRuntimeReplanClassifier,
) {
  const ports = createProjectRuntimePersistencePorts(
    input.workingDirectory,
    input.repositoryBindingId,
  );
  return resolveProjectRuntimeReplanWithPort(ports.state, input, classify);
}
/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-replan-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const created = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
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
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture");
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", created.state, 0).status,
    "completed",
  );
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("request"),
      originLane: "interactive",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    }).status,
    "completed",
  );
  return {
    root,
    input: {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      maximumReplans: 2,
    },
  };
}
/**
 * failTaskのTest準備責務を実行する。
 *
 * @responsibility failTaskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus failTaskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
async function failTask(root: string) {
  return runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (input) => {
        assert.equal(await input.observeStarted?.(), true);
        return {
          contract: "crdd-coordinator/project-runtime-single-task-adapter",
          attemptId: input.attemptId,
          operationId: input.operationId,
          authorityBindingId: input.authorityBindingId,
          repositoryRevision: input.repositoryRevision,
          status: "blocked",
          reason: "bounded_failure",
          effectState: "settled",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          candidateId: null,
          recoveryIds: [],
        };
      },
    },
    {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      taskExecutions: [
        {
          taskId: "task-a",
          authorityBindingId: "authority-a",
          taskRequest: {},
          repositoryRoot: root,
        },
      ],
      cancellationSignal: new AbortController().signal,
    },
  );
}

/**
 * bounded partial replan supersedes the failed task and returns the queue to readyを検証する。
 *
 * @responsibility bounded partial replan supersedes the failed task and returns the queue to readyの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus bounded partial replan supersedes the failed task and returns the queue to readyの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("bounded partial replan supersedes the failed task and returns the queue to ready", async (t) => {
  const { root, input } = fixture(t);
  assert.equal(
    (await failTask(root)).reason,
    "project_runtime_replan_required",
  );
  const result = resolveProjectRuntimeReplan(input, () => ({
    disposition: "partial_replan",
    failedTaskId: "task-a",
    replacements: [
      {
        id: "task-b",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
  }));
  assert.equal(result.status, "completed");
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.deepEqual(
    state.status === "completed" &&
      state.value?.tasks.map((task) => [task.definition.id, task.state]),
    [
      ["task-a", "superseded"],
      ["task-b", "ready"],
    ],
  );
  assert.equal(queue.status === "completed" && queue.value.state, "queued");
});

/**
 * 再計画分類は各形の余剰field・Accessor・ProxyをEffect前に拒否するを検証する。
 *
 * @responsibility 再計画分類は各形の余剰field・Accessor・ProxyをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 再計画分類は各形の余剰field・Accessor・ProxyをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("再計画分類は各形の余剰field・Accessor・ProxyをEffect前に拒否する", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  const beforeState = readProjectRuntimeState(root, "binding-a", "project-a");
  const beforeQueue = readProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
  );
  let getterCalls = 0;
  const cases: Array<() => unknown> = [
    () => ({ disposition: "maintain_plan", reason: "retry", extra: true }),
    () => ({
      disposition: "human_decision",
      objectiveId: "objective-a",
      get reason() {
        getterCalls += 1;
        return "choose";
      },
    }),
    () =>
      new Proxy(
        { disposition: "maintain_plan", reason: "retry" },
        {
          getPrototypeOf: () => {
            throw new Error("trap");
          },
        },
      ),
    () => ({
      disposition: "partial_replan",
      failedTaskId: "task-a",
      replacements: [
        {
          id: "task-b",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: [],
          extra: true,
        },
      ],
    }),
  ];
  for (const classify of cases) {
    const result = resolveProjectRuntimeReplan(input, classify);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "project_runtime_replan_decision_invalid");
    assert.deepEqual(
      readProjectRuntimeState(root, "binding-a", "project-a"),
      beforeState,
    );
    assert.deepEqual(
      readProjectOperationQueueState(root, "binding-a", "queue-a"),
      beforeQueue,
    );
  }
  assert.equal(getterCalls, 0);
});

/**
 * maintaining the plan creates a fresh attempt and enforces the retry limitを検証する。
 *
 * @responsibility maintaining the plan creates a fresh attempt and enforces the retry limitの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus maintaining the plan creates a fresh attempt and enforces the retry limitの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("maintaining the plan creates a fresh attempt and enforces the retry limit", async (t) => {
  const { root, input } = fixture(t);
  assert.equal(
    (await failTask(root)).reason,
    "project_runtime_replan_required",
  );
  const maintained = resolveProjectRuntimeReplan(
    { ...input, maximumReplans: 1 },
    () => ({
      disposition: "maintain_plan",
      reason: "transient provider failure",
    }),
  );
  assert.equal(maintained.reason, "project_runtime_same_plan_retry_ready");
  const beforeRetry = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(
    beforeRetry.status === "completed" &&
      beforeRetry.value?.tasks[0]?.retryCount,
    1,
  );
  assert.equal(
    (await failTask(root)).reason,
    "project_runtime_replan_required",
  );
  const exhausted = resolveProjectRuntimeReplan(
    { ...input, maximumReplans: 1 },
    () => ({
      disposition: "maintain_plan",
      reason: "another transient failure",
    }),
  );
  assert.equal(
    exhausted.reason,
    "project_runtime_retry_invalid_or_limit_exceeded",
  );
});

/**
 * human decision capability is one-time, principal-bound and finalized after Project readbackを検証する。
 *
 * @responsibility human decision capability is one-time, principal-bound and finalized after Project readbackの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus human decision capability is one-time, principal-bound and finalized after Project readbackの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("human decision capability is one-time, principal-bound and finalized after Project readback", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  const escalated = resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  assert.equal(escalated.reason, "project_runtime_human_decision_required");
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      if (records.has(record.recordId)) return { status: "blocked" };
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      const value = records.get(recordId);
      return value ? { status: "completed", value } : { status: "blocked" };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      const current = records.get(expected.recordId);
      if (JSON.stringify(current) !== JSON.stringify(expected))
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const commonFields = {
    ...input,
    ...decisionApplicationDependencies(root),
    principalId: "principal-a",
    store,
  };
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value) throw new Error("state");
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-a",
    repositoryRevision: revision,
    expectedGeneration: state.value.generation,
    allowedOptions: ["resume", "cancel"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed", JSON.stringify(issued));
  if (issued.status !== "completed") throw new Error("issue");
  const wrongPrincipal = submitProjectRuntimeHumanDecision(
    { ...commonFields, principalId: "principal-b" },
    {
      decisionId: "decision-a",
      recordId: issued.recordId,
      repositoryRevision: revision,
      generation: state.value.generation,
      selectedOption: "resume",
      continuationCapability: issued.continuationCapability,
      nowEpochMs: 2_000,
    },
  );
  assert.equal(wrongPrincipal.status, "blocked");
  const applied = submitProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-a",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  });
  assert.equal(applied.status, "completed", JSON.stringify(applied));
  const replay = submitProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-a",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  });
  assert.equal(replay.reason, "project_runtime_decision_already_consumed");
  assert.equal(records.get(issued.recordId)?.disposition, "finalized");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "replan_required",
  );
});

/**
 * Acceptance Decisionは対象・Revision・世代・Authorityが一致する要求だけを一度記録する。
 *
 * @responsibility 別対象、Revision不一致、古い世代、Authority不一致および重複判断をDecision Effect 0で拒否する。
 * @trace PRL-IT-008
 * @precondition 判断待ちの同一Project／Milestoneと、一回限りCapabilityを持つDecision Recordを用意する。
 * @stimulus 各不一致入力とexactに一致する入力をAcceptance Decision Portへ順に渡す。
 * @observation 拒否理由、Decision Record状態、Project世代および正常適用後の重複結果を観測する。
 * @oracle 不一致入力はRecordとProjectを変更せず、exact入力だけが一度完了し、再送はalready_consumedとなる。
 * @cleanup Test ContextがRepository fixtureを削除し、Decision Record以外の外部Effectを発行しない。
 * @boundary PRL-IT-008=Direct Boundary: Projection／SPEC入力→Acceptance Decision Port→Decision Store
 */
test("Acceptance Decisionは対象・Revision・世代・Authorityが一致する要求だけを一度記録する", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      if (records.has(record.recordId)) return { status: "blocked" };
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      const value = records.get(recordId);
      return value ? { status: "completed", value } : { status: "blocked" };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      const current = records.get(expected.recordId);
      if (JSON.stringify(current) !== JSON.stringify(expected))
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const commonFields = {
    ...input,
    ...decisionApplicationDependencies(root),
    principalId: "principal-a",
    store,
  };
  const before = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(before.status, "completed");
  if (before.status !== "completed" || !before.value) throw new Error("state");
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-contract",
    repositoryRevision: revision,
    expectedGeneration: before.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  const exactInput = {
    decisionId: "decision-contract",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: before.value.generation,
    selectedOption: "resume" as const,
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 2_000,
  };
  const mismatchCases = [
    [{ ...commonFields, projectId: "project-b" }, exactInput],
    [{ ...commonFields, milestoneId: "milestone-b" }, exactInput],
    [{ ...commonFields, principalId: "principal-b" }, exactInput],
    [commonFields, { ...exactInput, decisionId: "decision-other" }],
    [commonFields, { ...exactInput, repositoryRevision: "c".repeat(40) }],
    [commonFields, { ...exactInput, generation: before.value.generation + 1 }],
  ] as const;
  for (const [fields, decisionInput] of mismatchCases) {
    const rejected = submitProjectRuntimeHumanDecision(fields, decisionInput);
    assert.equal(
      rejected.reason,
      "project_runtime_decision_binding_mismatch_or_expired",
    );
    assert.equal(records.get(issued.recordId)?.disposition, "pending");
    const unchanged = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(
      unchanged.status === "completed" && unchanged.value?.generation,
      before.value.generation,
    );
  }
  const applied = submitProjectRuntimeHumanDecision(commonFields, exactInput);
  assert.equal(applied.status, "completed", JSON.stringify(applied));
  assert.equal(records.get(issued.recordId)?.disposition, "finalized");
  const replay = submitProjectRuntimeHumanDecision(commonFields, exactInput);
  assert.equal(replay.reason, "project_runtime_decision_already_consumed");
});

/**
 * prepared human decision is reconciled from durable Project state without replaying authorityを検証する。
 *
 * @responsibility prepared human decision is reconciled from durable Project state without replaying authorityの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus prepared human decision is reconciled from durable Project state without replaying authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("prepared human decision is reconciled from durable Project state without replaying authority", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      const value = records.get(recordId);
      return value ? { status: "completed", value } : { status: "blocked" };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (
        JSON.stringify(records.get(expected.recordId)) !==
        JSON.stringify(expected)
      )
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const commonFields = {
    ...input,
    ...decisionApplicationDependencies(root),
    principalId: "principal-a",
    store,
  };
  const before = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(before.status, "completed");
  if (before.status !== "completed" || !before.value) throw new Error("state");
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-recovery",
    repositoryRevision: revision,
    expectedGeneration: before.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  const pending = records.get(issued.recordId);
  assert.ok(pending);
  const applicationId = "decision-application-recovery";
  const prepared = Object.freeze({
    ...pending,
    disposition: "prepared" as const,
    applicationId,
    selectedOption: "resume" as const,
    newGeneration: before.value.generation + 1,
  });
  records.set(issued.recordId, prepared);
  const transitioned = applyProjectRuntimeHumanDecision(
    before.value,
    before.value.generation,
    "resume",
    applicationId,
  );
  assert.equal(transitioned.status, "completed");
  if (transitioned.status !== "completed" || !transitioned.state)
    throw new Error("transition");
  assert.equal(
    writeProjectRuntimeState(
      root,
      "binding-a",
      transitioned.state,
      before.value.generation,
    ).status,
    "completed",
  );
  const recovered = recoverProjectRuntimeHumanDecision(commonFields, {
    recordId: issued.recordId,
  });
  assert.equal(recovered.status, "completed", JSON.stringify(recovered));
  assert.equal(records.get(issued.recordId)?.disposition, "finalized");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "replan_required",
  );
});

/**
 * explicit replacement invalidates the former capability before issuing one fresh capabilityを検証する。
 *
 * @responsibility explicit replacement invalidates the former capability before issuing one fresh capabilityの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus explicit replacement invalidates the former capability before issuing one fresh capabilityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("explicit replacement invalidates the former capability before issuing one fresh capability", async (t) => {
  const { root, input } = fixture(t);
  await failTask(root);
  resolveProjectRuntimeReplan(input, () => ({
    disposition: "human_decision",
    objectiveId: "objective-a",
    reason: "scope choice required",
  }));
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      if (records.has(record.recordId)) return { status: "blocked" };
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      return { status: "completed", value: records.get(recordId) ?? null };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value) throw new Error("state");
  const commonFields = {
    ...input,
    ...decisionApplicationDependencies(root),
    principalId: "principal-a",
    store,
  };
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-replace",
    repositoryRevision: revision,
    expectedGeneration: state.value.generation,
    allowedOptions: ["resume"],
    lifetimeMs: 60_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  const replaced = replaceProjectRuntimeHumanDecision(commonFields, {
    recordId: issued.recordId,
    replacementRequestId: "replacement-a",
    lifetimeMs: 60_000,
    nowEpochMs: 2_000,
  });
  assert.equal(replaced.status, "completed", JSON.stringify(replaced));
  if (replaced.status !== "completed") throw new Error("replace");
  assert.notEqual(
    replaced.continuationCapability,
    issued.continuationCapability,
  );
  const oldAttempt = submitProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-replace",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 3_000,
  });
  assert.equal(oldAttempt.status, "blocked");
  const currentAttempt = submitProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-replace",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: state.value.generation,
    selectedOption: "resume",
    continuationCapability: replaced.continuationCapability,
    nowEpochMs: 3_000,
  });
  assert.equal(
    currentAttempt.status,
    "completed",
    JSON.stringify(currentAttempt),
  );
});

/**
 * parent lifecycle invalidation requires a fresh changed generationを検証する。
 *
 * @responsibility parent lifecycle invalidation requires a fresh changed generationの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus parent lifecycle invalidation requires a fresh changed generationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("parent lifecycle invalidation requires a fresh changed generation", async (t) => {
  const { root, input } = fixture(t);
  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      return { status: "completed", value: records.get(recordId) ?? null };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const before = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(before.status, "completed");
  if (before.status !== "completed" || !before.value) throw new Error("state");
  const commonFields = {
    ...input,
    ...decisionApplicationDependencies(root),
    principalId: "principal-a",
    store,
  };
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-invalidate",
    repositoryRevision: revision,
    expectedGeneration: before.value.generation,
    allowedOptions: ["cancel"],
    lifetimeMs: 60_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  assert.equal(
    invalidateProjectRuntimeHumanDecision(commonFields, {
      recordId: issued.recordId,
      reason: "project_advanced",
    }).reason,
    "project_runtime_decision_invalidation_not_proven",
  );
  const advanced = Object.freeze({
    ...before.value,
    generation: before.value.generation + 1,
  });
  assert.equal(
    writeProjectRuntimeState(
      root,
      "binding-a",
      advanced,
      before.value.generation,
    ).status,
    "completed",
  );
  const invalidated = invalidateProjectRuntimeHumanDecision(commonFields, {
    recordId: issued.recordId,
    reason: "project_advanced",
  });
  assert.equal(invalidated.status, "completed", JSON.stringify(invalidated));
  assert.equal(records.get(issued.recordId)?.disposition, "invalidated");
});

/**
 * issuance and expiry uncertainty persist an exact independent recovery intentを検証する。
 *
 * @responsibility issuance and expiry uncertainty persist an exact independent recovery intentの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus issuance and expiry uncertainty persist an exact independent recovery intentの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("issuance and expiry uncertainty persist an exact independent recovery intent", async (t) => {
  const { root, input } = fixture(t);
  const recovery = new Map<string, ProjectRuntimeDecisionRecoveryIntent>();
  const recoveryStore = {
    create(intent: ProjectRuntimeDecisionRecoveryIntent) {
      recovery.set(intent.recoveryId, intent);
      return { status: "completed", value: intent };
    },
    read(recoveryId: string) {
      return {
        status: "completed",
        value: recovery.get(recoveryId) ?? null,
      };
    },
    compareAndSet() {
      return { status: "blocked" };
    },
  };
  const failedIssue = issueProjectRuntimeHumanDecision(
    {
      ...input,
      ...decisionApplicationDependencies(root),
      principalId: "principal-a",
      recoveryStore,
      store: {
        create: () => ({ status: "blocked" }),
        read: () => ({ status: "blocked" }),
        compareAndSet: () => ({ status: "blocked" }),
      },
    },
    {
      decisionId: "decision-issue-unknown",
      repositoryRevision: revision,
      expectedGeneration: 1,
      allowedOptions: ["resume"],
      lifetimeMs: 60_000,
      nowEpochMs: 1_000,
    },
  );
  assert.equal(
    failedIssue.reason,
    "project_runtime_decision_recovery_required",
  );
  assert.equal(
    "recoveryId" in failedIssue && typeof failedIssue.recoveryId,
    "string",
  );
  assert.equal(recovery.size, 1);

  const records = new Map<string, ProjectRuntimeDecisionRecord>();
  let isFailUpdate = false;
  const store = {
    create(record: ProjectRuntimeDecisionRecord) {
      records.set(record.recordId, record);
      return { status: "completed", value: record };
    },
    read(recordId: string) {
      return { status: "completed", value: records.get(recordId) ?? null };
    },
    compareAndSet(
      expected: ProjectRuntimeDecisionRecord,
      next: ProjectRuntimeDecisionRecord,
    ) {
      if (isFailUpdate || records.get(expected.recordId) !== expected)
        return { status: "blocked" };
      records.set(expected.recordId, next);
      return { status: "completed", value: next };
    },
  };
  const commonFields = {
    ...input,
    ...decisionApplicationDependencies(root),
    principalId: "principal-a",
    store,
    recoveryStore,
  };
  const issued = issueProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-expiry-unknown",
    repositoryRevision: revision,
    expectedGeneration: 1,
    allowedOptions: ["cancel"],
    lifetimeMs: 1_000,
    nowEpochMs: 1_000,
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") throw new Error("issue");
  isFailUpdate = true;
  const expired = submitProjectRuntimeHumanDecision(commonFields, {
    decisionId: "decision-expiry-unknown",
    recordId: issued.recordId,
    repositoryRevision: revision,
    generation: 1,
    selectedOption: "cancel",
    continuationCapability: issued.continuationCapability,
    nowEpochMs: 3_000,
  });
  assert.equal(expired.reason, "project_runtime_decision_recovery_required");
  assert.equal("recoveryId" in expired && typeof expired.recoveryId, "string");
  assert.equal(recovery.size, 2);
  assert.equal(fs.existsSync(path.join(root, ".crdd")), true);
});
