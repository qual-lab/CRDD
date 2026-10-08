/**
 * coordinator:integration:orchestrator-queue-priorityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:orchestrator-queue-priorityが所有する検証責務を実行する。
 * @trace PRL-IT-011
 * @level IT
 * @scope project、runtime、queue、priority
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  initializeOrchestratorSnapshot,
  createCurrentOrchestratorPersistencePorts,
} from "../../../orchestrator/src/storage/current-state.ts";

import { createOrchestratorState } from "../../../orchestrator/src/index.ts";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";

const revision = "a".repeat(40);

/**
 * 新版保存と競合試験の自己所有Repositoryを構築する。
 * @responsibility QueueとLeaseの前状態を現行Portだけで生成する。
 * @trace PRL-IT-011
 * @precondition 検証済みCRDD Repository-local tmpを使用する。
 * @stimulus Git fixture、新版Snapshot、対象Projectを明示初期化する。
 * @observation Root、保存Portと所有子Process参照を返す。
 * @oracle 旧世代Directoryを生成せず同じRepository bindingへ結合する。
 * @cleanup 所有子Processの終了確認後、exact Rootを回収し不存在を確認する。
 * @boundary Repository-local fixture→新版State／Queue／Lease Port。
 */
function fixture(
  t: test.TestContext,
  binding = "binding-a",
  projectIds = ["project-a"],
) {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(repository, "tmp"),
    "fixture_area_invalid",
  );
  const parent = fs.realpathSync.native(area.directory);
  const root = fs.mkdtempSync(path.join(parent, "crdd-project-priority-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  const childProcesses: ReturnType<typeof spawn>[] = [];
  t.after(async () => {
    for (const child of childProcesses) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      const closed = once(child, "close", {
        signal: AbortSignal.timeout(10000),
      });
      child.kill("SIGKILL");
      await closed;
      assert.ok(child.exitCode !== null || child.signalCode !== null);
    }
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(path.dirname(root), parent);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  assert.equal(
    initializeOrchestratorSnapshot(root, binding).status,
    "completed",
  );
  const ports = createCurrentOrchestratorPersistencePorts(root, binding);
  for (const projectId of projectIds) {
    const created = createOrchestratorState({
      projectId,
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
    if (created.status !== "completed")
      throw new Error("fixture_state_invalid");
    assert.equal(ports.state.writeState(created.state, 0).status, "completed");
  }
  return { root, ports, children: childProcesses };
}
/**
 * hashのTest準備責務を実行する。
 *
 * @responsibility hashがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus hashを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
/**
 * interactive queue parks scheduled work without preempting an active ownerを検証する。
 *
 * @responsibility interactive queue parks scheduled work without preempting an active ownerの合否判定を所有する。
 * @trace PRL-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus interactive queue parks scheduled work without preempting an active ownerの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("interactive queue parks scheduled work without preempting an active owner", (t) => {
  const { ports } = fixture(t);
  for (const [queueId, originLane] of [
    ["queue-scheduled", "scheduled"],
    ["queue-interactive", "interactive"],
  ] as const)
    assert.equal(
      ports.state.enqueueOperation({
        queueId,
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: hash(queueId),
        originLane,
        repositoryRevision: revision,
        scopeHash: hash("scope"),
      }).status,
      "completed",
    );
  const first = ports.state.selectNextOperation();
  assert.equal(
    first.status === "completed" && first.value?.queueId,
    "queue-interactive",
  );
  const parked = ports.state.readQueue("queue-scheduled");
  assert.equal(
    parked.status === "completed" && parked.value.state,
    "waiting_foreground",
  );
  if (parked.status !== "completed") throw new Error("parked queue");
  const forbiddenLease = ports.lease.acquire(
    "project-a",
    "queue-scheduled",
    "project-operation",
  );
  assert.equal(forbiddenLease.status, "completed");
  if (forbiddenLease.status !== "completed") throw new Error("lease");
  const directLease = ports.state.updateQueue(
    "queue-scheduled",
    parked.value.generation,
    {
      state: "leased",
      lease: forbiddenLease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(directLease.status, "blocked");
  assert.equal(directLease.reason, "orchestrator_queue_transition_invalid");
  assert.equal(forbiddenLease.value.release().status, "completed");
  const interactive = ports.state.readQueue("queue-interactive");
  assert.equal(interactive.status, "completed");
  if (interactive.status !== "completed") throw new Error("queue");
  assert.equal(
    ports.state.updateQueue("queue-interactive", interactive.value.generation, {
      state: "cancelled",
      lease: null,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  const second = ports.state.selectNextOperation();
  assert.equal(
    second.status === "completed" && second.value?.queueId,
    "queue-scheduled",
  );
  assert.equal(second.status === "completed" && second.value?.state, "queued");
});

/**
 * scheduled work arriving after an interactive operation starts remains effect-freeを検証する。
 *
 * @responsibility scheduled work arriving after an interactive operation starts remains effect-freeの合否判定を所有する。
 * @trace PRL-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus scheduled work arriving after an interactive operation starts remains effect-freeの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("scheduled work arriving after an interactive operation starts remains effect-free", (t) => {
  const { ports } = fixture(t);

  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-interactive",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("interactive"),
      originLane: "interactive",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-interactive",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease");
  const leased = ports.state.updateQueue("queue-interactive", 1, {
    state: "leased",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  if (leased.status !== "completed") throw new Error("leased queue");
  const running = ports.state.updateQueue(
    "queue-interactive",
    leased.value.generation,
    {
      state: "running",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(running.status, "completed");

  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-scheduled",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("scheduled"),
      originLane: "scheduled",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    }).status,
    "completed",
  );
  const selected = ports.state.selectNextOperation();
  assert.equal(selected.status, "completed");
  assert.equal(selected.status === "completed" && selected.value, null);
  assert.equal(
    selected.status === "completed" && selected.reason,
    "orchestrator_active_operation_retained",
  );
  const scheduled = ports.state.readQueue("queue-scheduled");
  assert.equal(
    scheduled.status === "completed" && scheduled.value.state,
    "waiting_foreground",
  );
  assert.equal(
    scheduled.status === "completed" && scheduled.value.resumeCondition,
    "active_operation_pending",
  );

  assert.equal(lease.value.release().status, "completed");
});

/**
 * one Repository Binding cannot acquire two Project Operation leasesを検証する。
 *
 * @responsibility one Repository Binding cannot acquire two Project Operation leasesの合否判定を所有する。
 * @trace PRL-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus one Repository Binding cannot acquire two Project Operation leasesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("one Repository Binding cannot acquire two Project Operation leases", (t) => {
  const { ports } = fixture(t, "binding-a", ["project-a", "project-b"]);
  for (const [projectId, queueId] of [
    ["project-a", "queue-a"],
    ["project-a", "queue-b"],
    ["project-b", "queue-c"],
  ] as const) {
    assert.equal(
      ports.state.enqueueOperation({
        queueId,
        projectId,
        milestoneId: "milestone-a",
        requestHash: hash(queueId),
        originLane: "interactive",
        repositoryRevision: revision,
        scopeHash: hash("scope"),
      }).status,
      "completed",
    );
  }
  const first = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  if (first.status !== "completed") throw new Error("first lease");
  const sameProject = ports.lease.acquire(
    "project-a",
    "queue-b",
    "project-operation",
  );
  const otherProject = ports.lease.acquire(
    "project-b",
    "queue-c",
    "project-operation",
  );
  assert.equal(sameProject.status, "blocked");
  assert.equal(sameProject.reason, "orchestrator_lease_unavailable");
  assert.equal(otherProject.status, "blocked");
  assert.equal(otherProject.reason, "orchestrator_lease_unavailable");
  assert.equal(first.value.release().status, "completed");
});

/**
 * separate processes cannot both own one Repository Binding operationを検証する。
 *
 * @responsibility separate processes cannot both own one Repository Binding operationの合否判定を所有する。
 * @trace PRL-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus separate processes cannot both own one Repository Binding operationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("separate processes cannot both own one Repository Binding operation", async (t) => {
  const {
    root: workingDirectory,
    ports,
    children: childProcesses,
  } = fixture(t, "binding-race", ["project-a", "project-b", "project-c"]);
  for (const [projectId, queueId] of [
    ["project-a", "queue-a"],
    ["project-b", "queue-b"],
    ["project-c", "queue-c"],
  ] as const) {
    assert.equal(
      ports.state.enqueueOperation({
        queueId,
        projectId,
        milestoneId: "milestone-a",
        requestHash: hash(queueId),
        originLane: "interactive",
        repositoryRevision: revision,
        scopeHash: hash("scope"),
      }).status,
      "completed",
    );
  }
  const controlDirectory = path.join(workingDirectory, "race-control");
  fs.mkdirSync(controlDirectory);
  const barrier = path.join(controlDirectory, "go");
  const probe = fileURLToPath(
    new URL("../fixtures/orchestrator-lease-race-probe.ts", import.meta.url),
  );
  /**
   * operationRunのTest準備責務を実行する。
   *
   * @responsibility operationRunがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace PRL-IT-011
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus operationRunを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
   */
  const operationRun = (projectId: string, queueId: string) => {
    const child = spawn(
      process.execPath,
      [probe, workingDirectory, barrier, projectId, queueId],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    childProcesses.push(child);
    return {
      child,
      completed: new Promise<
        Readonly<{ code: number | null; stdout: string; stderr: string }>
      >((resolve) => {
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", (chunk) => {
          stdout += String(chunk);
        });
        child.stderr.setEncoding("utf8").on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.once("close", (code) => resolve({ code, stdout, stderr }));
      }),
    };
  };
  const first = operationRun("project-a", "queue-a");
  const second = operationRun("project-b", "queue-b");
  const third = operationRun("project-c", "queue-c");
  const deadline = Date.now() + 10_000;
  while (
    (!fs.existsSync(`${barrier}.queue-a.ready`) ||
      !fs.existsSync(`${barrier}.queue-b.ready`) ||
      !fs.existsSync(`${barrier}.queue-c.ready`)) &&
    Date.now() < deadline
  )
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(`${barrier}.queue-a.ready`), true);
  assert.equal(fs.existsSync(`${barrier}.queue-b.ready`), true);
  assert.equal(fs.existsSync(`${barrier}.queue-c.ready`), true);
  fs.writeFileSync(barrier, "go\n", "utf8");
  const results = await Promise.all([
    first.completed,
    second.completed,
    third.completed,
  ]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  const outcomes = results.map((result) => JSON.parse(result.stdout));
  for (const outcome of outcomes.filter(
    (result) => result.status === "acquired",
  )) {
    assert.equal(outcome.released, "completed");
    assert.equal(outcome.manualRecoveryRequired, false);
  }
  assert.equal(
    outcomes.filter((result) => result.status === "acquired").length,
    1,
  );
  assert.equal(
    outcomes.filter((result) => result.status === "blocked").length,
    2,
  );
  assert.ok(
    outcomes
      .filter((result) => result.status === "blocked")
      .every(
        (result) =>
          result.manualRecoveryRequired === false &&
          [
            "orchestrator_lease_unavailable",
            "orchestrator_snapshot_lock_unavailable",
          ].includes(result.reason),
      ),
    JSON.stringify({
      outcomes,
      stderr: results.map((result) => result.stderr),
    }),
  );
  const owner = ports.lease.inspectAcquisitionOwner();
  assert.equal(owner.status, "completed");
  assert.equal(owner.value?.acquisition, null);
});
