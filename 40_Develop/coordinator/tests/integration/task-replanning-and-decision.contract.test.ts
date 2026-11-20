/**
 * coordinator:integration:task-replanning-and-decisionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-replanning-and-decisionが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、replanning、and、decision
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */

import { updateTestTaskAndQueue } from "../fixtures/task-persistence-fixture.ts";

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  initializeExecutionStore,
  readState,
} from "../../../execution-model/src/index.ts";
import {
  initialExecutionInput,
  projectExecutionFixture,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createTestPersistence } from "../fixtures/task-persistence-fixture.ts";
import {
  createCoordinatorExecutionHostPorts,
  runCoordinatorOperation as runCoordinatorOperationWithPorts,
} from "../../src/task/dispatch.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import {
  enqueueProjectOperation,
  readCoordinatorState,
  readProjectOperationQueueState,
} from "../fixtures/task-persistence-fixture.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

const revision = "a".repeat(40);

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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

type BoundExecutionDependencies = Omit<
  Parameters<typeof runCoordinatorOperationWithPorts>[0],
  "persistence" | "clockIdentity" | "processSafety" | "authorization"
>;
type BoundExecutionInput = Parameters<
  typeof runCoordinatorOperationWithPorts
>[1] &
  Readonly<{ workingDirectory: string; repositoryBindingId: string }>;

/**
 * runCoordinatorOperationのTest準備責務を実行する。
 *
 * @responsibility runCoordinatorOperationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runCoordinatorOperationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function runCoordinatorOperation(
  dependencies: BoundExecutionDependencies,
  input: BoundExecutionInput,
) {
  const { workingDirectory, repositoryBindingId, ...applicationInput } = input;
  return runCoordinatorOperationWithPorts(
    {
      ...dependencies,
      ...createCoordinatorExecutionHostPorts(),
      persistence: createTestPersistence(workingDirectory, repositoryBindingId),
    },
    applicationInput,
  );
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(t: test.TestContext) {
  const tests = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(tests, { recursive: true });
  const root = fs.mkdtempSync(path.join(tests, "project-replan-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const created = projectExecutionFixture({
    taskExecutionSelections: taskExecutionSelections(),
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
    enqueueProjectOperation(
      root,
      "binding-a",
      {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: hash("request"),
        originLane: "interactive",
        repositoryRevision: revision,
        scopeHash: hash("scope"),
      },
      initialExecutionInput(created.state),
    ).status,
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
async function failTask(root: string) {
  return runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (input) => {
        assert.equal(await input.observeStarted?.(), undefined);
        return {
          contract: "crdd-coordinator/orchestrator-single-task-adapter",
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
 * 部分再計画の旧Task退役・非対象定義保全と公開Readerの不整合拒否を検証する。
 * @responsibility 再計画結果の定義・管理参照と、自己生成Fileの読取り境界を確認する。
 * @trace PRL-IT-005
 * @precondition 自己生成RepositoryのHEADと、確認済みの失敗Taskを用意する。
 * @stimulus 兄弟定義を含む再計画、不正な定義HashとTask順序を実Fileへ配置する。
 * @observation 公開Readerの本文・解放・拒否、Task退役、定義Hashと古世代Writer拒否。
 * @oracle 正常Stateだけ読め、不正本文は変更されず、復元後の正常State上で古世代保存を拒否する。
 * @cleanup 不正値はfinallyで今回の確認済み本文へ戻し、既存hookで自己生成Rootを回収する。
 * @boundary PRL-IT-005=再計画→公開Reader／Writerと実Filesystem。実AI・Dockerは使わない。
 */
test("bounded partial replan supersedes the failed task and returns the queue to ready", async (t) => {
  const { root, input } = fixture(t);
  // 回復Readerは固定Revisionを確認するため、この自己生成RootだけにHEADを用意する。
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=NUL",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  assert.equal((await failTask(root)).reason, "orchestrator_replan_required");
  const stateFile = path.join(root, ".crdd/domain-model/state.json");
  const beforeBytes = fs.readFileSync(stateFile);
  const capability = verifyRuntimePersistenceRepository(root);
  const beforeRead = readState(capability, { scope: "recovery" });
  assert.equal(beforeRead.status, "completed", beforeRead.reason);
  assert.equal(beforeRead.lockReleased, true);
  assert.ok(beforeRead.value);
  assert.deepEqual(
    Buffer.from(beforeRead.value.sourceText, "utf8"),
    beforeBytes,
  );
  const before = beforeRead.value;
  const definition = before.snapshot.projects[0];
  assert.ok(definition);
  const siblings = [
    { ...definition, projectId: "core-before" },
    { ...definition, projectId: "core-after" },
  ];
  const mixedBytes = Buffer.from(
    `${canonicalJson({
      ...before.snapshot,
      projects: [siblings[0], definition, siblings[1]],
    })}\n`,
  );
  // この試験で生成した正本だけに、管理実行を持たない兄弟定義を配置する。
  fs.writeFileSync(stateFile, mixedBytes);
  const mixedRead = readState(capability, { scope: "recovery" });
  assert.equal(mixedRead.status, "completed", mixedRead.reason);
  assert.equal(mixedRead.lockReleased, true);
  assert.ok(mixedRead.value);
  assert.deepEqual(Buffer.from(mixedRead.value.sourceText, "utf8"), mixedBytes);
  const result = updateTestTaskAndQueue(input, {
    kind: "task_replan",
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
  });
  assert.equal(result.status, "completed");
  const state = readCoordinatorState(root, "binding-a", "project-a");
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
  assert.ok(state.status === "completed" && state.value);
  const replayBytes = fs.readFileSync(stateFile);
  const replay = createTestPersistence(root, "binding-a").state.updateTask(
    {
      kind: "task_replan",
      projectId: input.projectId,
      failedTaskId: "task-a",
      maximumReplans: input.maximumReplans,
      replacements: [
        {
          id: "task-b",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: [],
        },
      ],
    },
    state.value.generation - 1,
  );
  assert.equal(replay.status, "completed", replay.reason);
  assert.deepEqual(replay.status === "completed" && replay.taskUpdateTaskIds, [
    "task-b",
  ]);
  assert.deepEqual(fs.readFileSync(stateFile), replayBytes);
  const publishedBytes = fs.readFileSync(stateFile);
  const publishedRead = readState(capability, { scope: "recovery" });
  assert.equal(publishedRead.status, "completed", publishedRead.reason);
  assert.equal(publishedRead.lockReleased, true);
  assert.ok(publishedRead.value);
  assert.deepEqual(
    Buffer.from(publishedRead.value.sourceText, "utf8"),
    publishedBytes,
  );
  const published = publishedRead.value;
  assert.deepEqual(
    published.snapshot.projects.map((project) => project.projectId),
    ["core-before", "project-a", "core-after"],
  );
  assert.deepEqual(published.snapshot.projects[0], siblings[0]);
  assert.deepEqual(published.snapshot.projects[2], siblings[1]);
  const replanned = published.snapshot.projects[1];
  const execution = published.snapshot.managedExecutions[0];
  assert.ok(replanned && execution);
  assert.equal(
    execution.definitionHash,
    createHash("sha256")
      .update(
        canonicalJson({
          projectId: replanned.projectId,
          milestoneId: replanned.milestoneId,
          definition: {
            milestoneAcceptanceCriteria: replanned.milestone.acceptanceCriteria,
            objectives: replanned.objectives.map(
              (objective) => objective.definition,
            ),
            tasks: replanned.tasks,
          },
        }),
      )
      .update("\n", "utf8")
      .digest("hex"),
  );
  assert.deepEqual(
    execution.tasks.map((task) => task.taskId),
    ["task-a", "task-b"],
  );
  const failed = before.snapshot.managedExecutions[0]?.tasks[0];
  const superseded = execution.tasks[0];
  assert.ok(failed && superseded);
  for (const key of [
    "attemptId",
    "operationId",
    "authorityBindingId",
    "startPhase",
    "settlement",
    "recoveryObligations",
    "candidateId",
  ] as const)
    assert.deepEqual(superseded[key], failed[key]);
  for (const invalid of [
    { ...execution, definitionHash: "0".repeat(64) },
    { ...execution, tasks: [...execution.tasks].reverse() },
  ]) {
    const invalidBytes = Buffer.from(
      `${canonicalJson({ ...published.snapshot, managedExecutions: [invalid] })}\n`,
    );
    try {
      fs.writeFileSync(stateFile, invalidBytes);
      const refused = readState(capability, { scope: "recovery" });
      assert.equal(refused.status, "blocked");
      assert.equal(refused.lockReleased, true);
      assert.equal(refused.value, null);
      assert.deepEqual(fs.readFileSync(stateFile), invalidBytes);
    } finally {
      fs.writeFileSync(stateFile, publishedBytes);
    }
    const restored = readState(capability, { scope: "recovery" });
    assert.equal(restored.status, "completed", restored.reason);
    assert.equal(restored.lockReleased, true);
    assert.ok(restored.value);
    assert.deepEqual(
      Buffer.from(restored.value.sourceText, "utf8"),
      publishedBytes,
    );
  }
  assert.equal(state.status, "completed");
  if (state.status !== "completed" || !state.value) throw new Error("state");
  assert.equal(
    createTestPersistence(root, "binding-a").state.updateTask(
      {
        kind: "task_replan",
        projectId: "project-a",
        failedTaskId: "task-a",
        maximumReplans: input.maximumReplans,
        replacements: [
          {
            id: "task-b",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["result.txt"],
            conflictKeys: [],
          },
        ],
      },
      0,
    ).status,
    "blocked",
  );
  assert.deepEqual(
    fs.readFileSync(stateFile),
    publishedBytes,
    "古い世代の再保存は正本を変更しない",
  );
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
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("maintaining the plan creates a fresh attempt and enforces the retry limit", async (t) => {
  const { root, input } = fixture(t);
  assert.equal((await failTask(root)).reason, "orchestrator_replan_required");
  const maintained = updateTestTaskAndQueue(
    { ...input, maximumReplans: 1 },
    { kind: "task_retry", taskId: "task-a", previousRetryCount: 0 },
  );
  assert.equal(maintained.status, "completed");
  const beforeRetry = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(
    beforeRetry.status === "completed" &&
      beforeRetry.value?.tasks[0]?.retryCount,
    1,
  );
  assert.ok(beforeRetry.status === "completed" && beforeRetry.value);
  const stateFile = path.join(root, ".crdd/domain-model/state.json");
  const replayBytes = fs.readFileSync(stateFile);
  const request = {
    kind: "task_retry",
    projectId: input.projectId,
    taskId: "task-a",
    maximumReplans: 1,
    previousRetryCount: 0,
  } as const;
  const ports = createTestPersistence(root, "binding-a");
  const replay = ports.state.updateTask(
    request,
    beforeRetry.value.generation - 1,
  );
  assert.equal(replay.status, "completed", replay.reason);
  assert.deepEqual(replay.status === "completed" && replay.taskUpdateTaskIds, [
    "task-a",
  ]);
  assert.equal(
    ports.state.updateTask(
      { ...request, previousRetryCount: 1 },
      beforeRetry.value.generation - 1,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(stateFile), replayBytes);
  assert.equal((await failTask(root)).reason, "orchestrator_replan_required");
  const exhausted = updateTestTaskAndQueue(
    { ...input, maximumReplans: 1 },
    { kind: "task_retry", taskId: "task-a", previousRetryCount: 1 },
  );
  assert.equal(
    exhausted.reason,
    "orchestrator_retry_invalid_or_limit_exceeded",
  );
});
