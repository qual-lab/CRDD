/**
 * coordinator:integration:project-runtime-queue-priorityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-queue-priorityが所有する検証責務を実行する。
 * @trace PRL-IT-011
 * @level IT
 * @scope project、runtime、queue、priority
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireProjectRuntimeLease,
  enqueueProjectOperation,
  readProjectOperationQueueState,
  selectNextProjectOperation,
  updateProjectOperationQueueState,
} from "../../src/security/project-runtime-durable-foundation.ts";

const revision = "a".repeat(40);
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
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
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
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */
test("interactive queue parks scheduled work without preempting an active owner", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-priority-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [queueId, originLane] of [
    ["queue-scheduled", "scheduled"],
    ["queue-interactive", "interactive"],
  ] as const)
    assert.equal(
      enqueueProjectOperation(root, "binding-a", {
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
  const first = selectNextProjectOperation(root, "binding-a");
  assert.equal(
    first.status === "completed" && first.value?.queueId,
    "queue-interactive",
  );
  const parked = readProjectOperationQueueState(
    root,
    "binding-a",
    "queue-scheduled",
  );
  assert.equal(
    parked.status === "completed" && parked.value.state,
    "waiting_foreground",
  );
  if (parked.status !== "completed") throw new Error("parked queue");
  const forbiddenLease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-scheduled",
    "project-operation",
  );
  assert.equal(forbiddenLease.status, "completed");
  if (forbiddenLease.status !== "completed") throw new Error("lease");
  const directLease = updateProjectOperationQueueState(
    root,
    "binding-a",
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
  assert.equal(directLease.reason, "project_runtime_queue_transition_invalid");
  assert.equal(forbiddenLease.value.release().status, "completed");
  const interactive = readProjectOperationQueueState(
    root,
    "binding-a",
    "queue-interactive",
  );
  assert.equal(interactive.status, "completed");
  if (interactive.status !== "completed") throw new Error("queue");
  assert.equal(
    updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-interactive",
      interactive.value.generation,
      {
        state: "cancelled",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      },
    ).status,
    "completed",
  );
  const second = selectNextProjectOperation(root, "binding-a");
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
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */
test("scheduled work arriving after an interactive operation starts remains effect-free", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-priority-active-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-interactive",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-interactive",
    1,
    {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  if (leased.status !== "completed") throw new Error("leased queue");
  const running = updateProjectOperationQueueState(
    root,
    "binding-a",
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
    enqueueProjectOperation(root, "binding-a", {
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
  const selected = selectNextProjectOperation(root, "binding-a");
  assert.equal(selected.status, "completed");
  assert.equal(selected.status === "completed" && selected.value, null);
  assert.equal(
    selected.status === "completed" && selected.reason,
    "project_runtime_active_operation_retained",
  );
  const scheduled = readProjectOperationQueueState(
    root,
    "binding-a",
    "queue-scheduled",
  );
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
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */
test("one Repository Binding cannot acquire two Project Operation leases", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-binding-lease-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  if (first.status !== "completed") throw new Error("first lease");
  const sameProject = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "project-operation",
  );
  const otherProject = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-b",
    "queue-c",
    "project-operation",
  );
  assert.equal(sameProject.status, "blocked");
  assert.equal(sameProject.reason, "project_runtime_lease_unavailable");
  assert.equal(otherProject.status, "blocked");
  assert.equal(otherProject.reason, "project_runtime_lease_unavailable");
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
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */
test("separate processes cannot both own one Repository Binding operation", async (t) => {
  const workingDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-priority-race-"),
  );
  execFileSync("git", ["init", "--quiet", workingDirectory], {
    windowsHide: true,
  });
  t.after(() => fs.rmSync(workingDirectory, { recursive: true, force: true }));
  const initialized = acquireProjectRuntimeLease(
    workingDirectory,
    "binding-race",
    "project-initializer",
    "queue-initializer",
    "project-operation",
  );
  assert.equal(initialized.status, "completed");
  if (initialized.status === "completed")
    assert.equal(initialized.value.release().status, "completed");
  const controlDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-priority-race-control-"),
  );
  t.after(() => fs.rmSync(controlDirectory, { recursive: true, force: true }));
  const barrier = path.join(controlDirectory, "go");
  const probe = fileURLToPath(
    new URL("../fixtures/project-runtime-lease-race-probe.ts", import.meta.url),
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
   * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
   */
  const operationRun = (projectId: string, queueId: string) => {
    const child = spawn(
      process.execPath,
      [probe, workingDirectory, barrier, projectId, queueId],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
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
        child.once("exit", (code) => resolve({ code, stdout, stderr }));
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
      .every((result) => result.reason === "project_runtime_lease_unavailable"),
    JSON.stringify({
      outcomes,
      stderr: results.map((result) => result.stderr),
    }),
  );
});
