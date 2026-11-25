/**
 * coordinator:integration:task-queue-priorityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-queue-priorityが所有する検証責務を実行する。
 * @trace PRL-IT-011
 * @level IT
 * @scope project、runtime、queue、priority
 * @boundary PRL-IT-011=Related 2 Blocks: Queue→Project Operation Lease→Scheduler Slot→Task開始
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  beginWorkspaceOperation,
  readProjectExecutionState,
  createQueue,
  readQueueEntry,
  readQueueState,
  selectNextQueueEntry,
  initializeExecutionStore,
  readExecutionState,
  type ProjectExecutionInitialization,
} from "@qual-lab/crdd-execution-model";
import {
  projectExecutionFixture,
  initialExecutionInput,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import { parseStoredExecutionFixture } from "../../../execution-model/tests/fixtures/stored-execution.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
  resolveExecutionStorageDirectory,
} from "../../src/lifecycle/host.ts";
import {
  inspectCoordinatorSnapshotLeaseAcquisitionOwner,
  acquireCoordinatorSnapshotLease,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
  updateCoordinatorQueue,
} from "../../src/lifecycle/host.ts";
import { createTestPersistence } from "../fixtures/task-persistence-fixture.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

const revision = "a".repeat(40);

/** 同一Projectの別Workspaceが物理Leaseを共存させ、片側回復で相手を変えない。 @trace PRL-IT-011 */
test("Workspace別の別Process Leaseは同時に保持し片方だけを回復できる", async (t) => {
  const { root, ports, children, initializations } = fixture(t);
  const binding = ports.repositoryBindingId;
  const wsA = "11111111-1111-4111-8111-111111111111";
  const wsB = "22222222-2222-4222-8222-222222222222";
  const wsFree = "33333333-3333-4333-8333-333333333333";
  const wsInterleaved = "44444444-4444-4444-8444-444444444444";
  const targets = [
    ["queue-a", wsA],
    ["queue-b", wsB],
    ["queue-c", wsA],
    ["queue-free", wsFree],
    ["queue-interleaved", wsInterleaved],
    ["queue-direct", null],
  ] as const;
  const initial = initializations["project-a"];
  assert.ok(initial);
  for (const [queueId] of targets) {
    assert.equal(
      createQueue(ports.repository, binding, {
        kind: "scheduled",
        input: [
          {
            queueId,
            projectId: initial.projectId,
            milestoneId: initial.milestoneId,
            requestHash: hash(queueId),
            originLane: "scheduled",
            repositoryRevision: revision,
            scopeHash: hash(queueId),
          },
          initial,
        ],
      }).status,
      "completed",
    );
  }
  const statePath = path.join(root, ".crdd", "execution-model", "state.json");
  // Workspaceの登録だけを合成。取得・保存・wx・子Process・回復は本番経路を使う。
  const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
  fs.writeFileSync(
    statePath,
    `${canonicalJson({
      ...raw,
      workspaces: [wsA, wsB, wsFree, wsInterleaved].map((workspaceId) => ({
        workspaceId,
        name: null,
        candidate: null,
        generation: 1,
        baseCommit: revision,
        head: revision,
        phase: "ready",
        holdUntil: null,
        pending: null,
        lastResult: null,
        primaryFailure: null,
      })),
      queueEntries: raw.queueEntries.map((queue: { queueId: string }) => ({
        ...queue,
        workspaceId: targets.find(([id]) => id === queue.queueId)?.[1] ?? null,
      })),
    })}\n`,
  );
  const probe = fileURLToPath(
    new URL("../fixtures/task-lease-interleaving-probe.ts", import.meta.url),
  );
  const launch = async (
    queueId: string,
    claim = false,
    reportRelease = false,
  ) => {
    const signal = path.join(root, `${queueId}.ready`);
    const child = spawn(
      process.execPath,
      [
        probe,
        root,
        signal,
        "hold",
        "project-operation",
        queueId,
        "project-a",
        ...(claim ? ["claim"] : []),
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        ...(reportRelease
          ? { env: { ...process.env, CRDD_LEASE_PROBE_RELEASE_MARKER: "1" } }
          : {}),
      },
    );
    children.push(child);
    let errors = "";
    child.stderr.on("data", (chunk) => {
      errors += String(chunk);
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    const closed = once(child, "close", {
      signal: AbortSignal.timeout(15_000),
    });
    // wait loop advances while the child is starting, but fails immediately on observed exit.
    const deadline = Date.now() + 6_000;
    while (
      !fs.existsSync(signal) &&
      child.exitCode === null &&
      child.signalCode === null &&
      Date.now() < deadline
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(fs.existsSync(signal), true, `${queueId}: ${output}${errors}`);
    return { child, signal, closed, output: () => output };
  };
  const a = await launch("queue-a", true);
  assert.equal(
    selectNextQueueEntry(ports.repository, binding, "queue-b").value?.queueId,
    "queue-b",
  );
  assert.equal(
    selectNextQueueEntry(ports.repository, binding, "queue-c").value,
    null,
  );
  const b = await launch("queue-b", false, true);
  const lockDir = path.join(root, ".crdd", "lock");
  const leaseFiles = () =>
    fs
      .readdirSync(lockDir)
      .filter((name) => name.startsWith("coordinator.lease."));
  assert.equal(leaseFiles().length, 2);
  const before = readQueueState(ports.repository, binding);
  const originalB = before.value?.leaseIntents.filter(
    (intent) => intent.queueId === "queue-b",
  );
  assert.deepEqual(originalB?.map((intent) => intent.phase).sort(), [
    "acquisition_reserved",
    "lock_owned",
  ]);
  assert.ok(
    originalB?.every((intent) => intent.ownerProcessId === b.child.pid),
  );
  for (const queueId of ["queue-c", "queue-direct"]) {
    const blocked = acquireCoordinatorSnapshotLease(
      root,
      binding,
      "project-a",
      queueId,
      "project-operation",
    );
    assert.equal(blocked.reason, "coordinator_lease_unavailable");
  }
  assert.equal(
    beginWorkspaceOperation(
      ports.repository,
      binding,
      "project-a",
      "queue-c",
      wsA,
      "observe",
    ).reason,
    "coordinator_lease_unavailable",
  );
  a.child.kill("SIGKILL");
  await a.closed;
  const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    root,
    binding,
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => {
      assert.equal(owner.ownerProcessId, a.child.pid);
      return { ...owner, status: "absent" };
    },
  );
  assert.equal(recovered.status, "completed", recovered.reason);
  assert.equal(recovered.value?.queue?.state, "recovery_required");
  assert.equal(recovered.value?.queue?.ownerGeneration, null);
  const after = readQueueState(ports.repository, binding);
  assert.deepEqual(after.value?.leaseIntents, originalB);
  assert.deepEqual(
    after.value?.queueEntries.find((queue) => queue.queueId === "queue-b"),
    before.value?.queueEntries.find((queue) => queue.queueId === "queue-b"),
  );
  assert.equal(leaseFiles().length, 1);
  assert.equal(
    acquireCoordinatorSnapshotLease(
      root,
      binding,
      "project-a",
      "queue-c",
      "project-operation",
    ).reason,
    "coordinator_lease_unavailable",
  );
  assert.equal(
    beginWorkspaceOperation(
      ports.repository,
      binding,
      "project-a",
      "queue-c",
      wsA,
      "discard",
    ).reason,
    "coordinator_lease_unavailable",
  );
  const workspaceOperation = beginWorkspaceOperation(
    ports.repository,
    binding,
    "project-a",
    "queue-free",
    wsFree,
    "observe",
  );
  assert.equal(
    workspaceOperation.status,
    "completed",
    workspaceOperation.reason,
  );
  assert.equal(workspaceOperation.value?.release().status, "completed");
  // 別回復を予約した直後に、Bの実物解放と証拠出版を先に確定させる。
  const interleaved = await launch("queue-interleaved", true);
  assert.ok(interleaved.child.kill("SIGKILL"));
  await interleaved.closed;
  const stored = () =>
    parseStoredExecutionFixture(fs.readFileSync(statePath, "utf8"));
  const shortLock = path.join(lockDir, "execution-model.state.lock");
  const releaseMarker = `${b.signal}.released`;
  const remove = fs.rmSync;
  let overlapped = false;
  let releaseDuringRecovery: string | null = null;
  const barrier = t.mock.method(
    fs,
    "rmSync",
    (...args: Parameters<typeof remove>) => {
      const recoveryReserved =
        args[0] === shortLock &&
        !overlapped &&
        stored().leaseIntents.some(
          (entry) =>
            entry.queueId === "queue-interleaved" &&
            entry.phase === "recovery_pending",
        );
      remove(...args);
      if (!recoveryReserved) return;
      overlapped = true;
      fs.writeFileSync(`${b.signal}.go`, "release\n", { flag: "wx" });
      const until = performance.now() + 2500;
      const sleep = new Int32Array(new SharedArrayBuffer(4));
      while (performance.now() < until) {
        if (fs.existsSync(releaseMarker)) {
          const observed = fs.readFileSync(releaseMarker, "utf8");
          if (observed.endsWith("\n")) {
            releaseDuringRecovery = observed.trim();
            return;
          }
        }
        Atomics.wait(sleep, 0, 0, 5);
      }
    },
  );
  let recovery: ReturnType<typeof reconcileCoordinatorSnapshotLeaseOwnerLoss>;
  try {
    recovery = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      root,
      binding,
      "project-a",
      "queue-interleaved",
      "project-operation",
      (owner) => {
        assert.equal(owner.ownerProcessId, interleaved.child.pid);
        assert.throws(() => process.kill(owner.ownerProcessId, 0), {
          code: "ESRCH",
        });
        return { ...owner, status: "absent" };
      },
    );
    assert.ok(overlapped);
  } finally {
    barrier.mock.restore();
  }
  assert.equal((await b.closed)[0], 0, b.output());
  assert.equal(
    recovery.status,
    "completed",
    JSON.stringify({
      reason: recovery.reason,
      b: b.output(),
      releaseDuringRecovery,
      files: fs.readdirSync(path.dirname(statePath)),
      phases: stored().leaseIntents.map(({ queueId, phase }) => [
        queueId,
        phase,
      ]),
    }),
  );
  assert.equal(recovery.value?.queue?.state, "recovery_required");
  assert.equal(recovery.value?.queue?.ownerGeneration, null);
  assert.deepEqual(JSON.parse(b.output()), {
    acquired: true,
    released: "completed",
  });
  assert.equal(
    releaseDuringRecovery,
    "completed:coordinator_lease_released",
    "Bの実解放が回復の予約段階と確定段階の間に収まらなかった",
  );
  assert.deepEqual(
    readQueueState(ports.repository, binding).value?.leaseIntents,
    [],
  );
  assert.deepEqual(leaseFiles(), []);
  for (const [queueId, disposition] of [
    ["queue-b", "released"],
    ["queue-interleaved", "recovered_after_owner_loss"],
  ] as const)
    assert.equal(
      stored().leaseEvidence.filter(
        ({ content }) =>
          content.queueId === queueId && content.disposition === disposition,
      ).length,
      1,
    );
  const unrelated = acquireCoordinatorSnapshotLease(
    root,
    binding,
    "project-a",
    "queue-free",
    "project-operation",
  );
  assert.equal(unrelated.status, "completed", unrelated.reason);
  if (unrelated.status !== "completed") throw Error("unrelated lease");
  assert.equal(unrelated.value.release().status, "completed");
  assert.equal(
    acquireCoordinatorSnapshotLease(
      root,
      binding,
      "project-a",
      "queue-direct",
      "project-operation",
    ).reason,
    "coordinator_lease_unavailable",
  );
});

/**
 * Domain固定候補を実Queue Portの受付・読取り・保存へ接続する。
 * @responsibility 新規一改訂と同値再入場・照会・拒否の無書込みを共同確認する。
 * @trace PRL-IT-011
 * @precondition 自己生成Gitと実Reader/Writer/Kernel、既存fixtureのProject保存。
 * @stimulus 新規Queue追加、同ID再送、不正ID、内容差、既存受付の照合を実Portから呼ぶ。
 * @observation 状態本文、改訂、Queue値、対象外区画、exact拒否理由。
 * @oracle 新規だけ一改訂し、照会/再送/拒否はbytesと他区画を保全する。
 * @cleanup 既存fixture hookが自己所有Rootだけを回収する。
 * @boundary Domain候補→既存単一Writer。実AI・Docker・Scheduling判断の成立は対象外。
 */
test("固定Queue CRUDは実Storeで新規だけ一改訂し照会と再送は書き換えない", (t) => {
  const { root, ports, initializations } = fixture(t);
  assert.ok(initializations["project-a"]);
  const preparation = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [
      {
        queueId: "queue-prior",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: hash("prior"),
        originLane: "interactive",
        repositoryRevision: revision,
        scopeHash: hash("prior-scope"),
      },
      initializations["project-a"],
    ],
  });
  assert.equal(preparation.status, "completed", preparation.reason);
  if (preparation.status !== "completed")
    throw new Error("fixture_initial_queue_failed");
  const prior = updateCoordinatorQueue(
    ports,
    "queue-prior",
    preparation.value.generation,
    {
      state: "cancelled",
      lease: null,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(prior.status, "completed", prior.reason);
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(file);
  const previous = readExecutionState(
    resolveExecutionStorageDirectory(root),
    "binding-a",
  );
  assert.equal(previous.status, "completed");
  if (previous.status !== "completed" || !previous.value)
    throw Error("fixture");
  assert.equal(previous.value.schemaRevision, 9);
  const beforeSnapshot = JSON.parse(before.toString("utf8"));
  assert.equal(
    readProjectExecutionState(
      ports.repository,
      ports.repositoryBindingId,
      "project-a",
    ).status,
    "completed",
  );
  assert.equal(
    readProjectExecutionState(
      ports.repository,
      ports.repositoryBindingId,
      "project-b",
    ).status,
    "completed",
  );
  assert.equal(
    readProjectExecutionState(
      ports.repository,
      ports.repositoryBindingId,
      "../escape",
    ).reason,
    "coordinator_state_identity_invalid",
  );
  assert.equal(
    readQueueEntry(ports.repository, ports.repositoryBindingId, "queue-a")
      .reason,
    "coordinator_queue_observation_unknown",
  );
  assert.deepEqual(fs.readFileSync(file), before);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: hash("request"),
    originLane: "interactive" as const,
    repositoryRevision: revision,
    scopeHash: hash("scope"),
  };
  const created = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [input],
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw Error("fixture");
  const after = fs.readFileSync(file);
  const snapshot = readExecutionState(
    resolveExecutionStorageDirectory(root),
    "binding-a",
  );
  assert.equal(snapshot.status, "completed");
  if (snapshot.status !== "completed" || !snapshot.value)
    throw Error("fixture");
  assert.deepEqual(snapshot.value.queueEntries, [
    ...previous.value.queueEntries,
    created.value,
  ]);
  assert.deepEqual(snapshot.value.projects, previous.value.projects);
  assert.deepEqual(JSON.parse(after.toString("utf8")), {
    ...beforeSnapshot,
    revision: beforeSnapshot.revision + 1,
    previous: {
      revision: beforeSnapshot.revision,
      payloadSha256: createHash("sha256").update(before).digest("hex"),
    },
    queueEntries: [...beforeSnapshot.queueEntries, created.value],
  });
  const found = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.equal(found.status, "completed");
  assert.deepEqual(found.value, created.value);
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [input],
    }).reason,
    "coordinator_queue_request_reused",
  );
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [{ ...input, requestHash: hash("other") }],
    }).reason,
    "coordinator_queue_identity_conflict",
  );
  assert.equal(
    readQueueEntry(ports.repository, ports.repositoryBindingId, "../escape")
      .reason,
    "coordinator_queue_input_invalid",
  );
  assert.deepEqual(fs.readFileSync(file), after);
  const scenarios = [
    {
      queueId: "missing",
      generation: 1,
      resume: null,
      result: null,
      expected: "coordinator_queue_generation_conflict",
      reads: [],
    },
    {
      queueId: "queue-a",
      generation: 2,
      resume: null,
      result: null,
      expected: "coordinator_queue_generation_conflict",
      reads: [],
    },
    {
      queueId: "queue-a",
      generation: 1,
      resume: "../bad",
      result: null,
      expected: "coordinator_queue_resume_condition_invalid",
      reads: ["resume", "resume"],
    },
    {
      queueId: "queue-a",
      generation: 1,
      resume: null,
      result: "../bad",
      expected: "coordinator_queue_result_reference_invalid",
      reads: ["resume", "result", "result"],
    },
    {
      queueId: "queue-a",
      generation: 1,
      resume: null,
      result: null,
      expected: "coordinator_queue_transition_invalid",
      reads: ["resume", "result", "state"],
    },
  ];
  for (const scenario of scenarios) {
    const reads: string[] = [];
    const result = updateCoordinatorQueue(
      ports,
      scenario.queueId,
      scenario.generation,
      {
        get state() {
          reads.push("state");
          return "completed" as const;
        },
        get resumeCondition() {
          reads.push("resume");
          return scenario.resume;
        },
        get resultReference() {
          reads.push("result");
          return scenario.result;
        },
        get lease(): never {
          throw Error("late_lease_getter_must_not_run");
        },
      },
    );
    assert.equal(result.reason, scenario.expected);
    assert.deepEqual(reads, scenario.reads);
    assert.deepEqual(fs.readFileSync(file), after);
  }
});

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
  const area = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(repository, "tmp"),
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
    initializeExecutionStore(resolveExecutionStorageDirectory(root), binding)
      .status,
    "completed",
  );
  const ports = createTestPersistence(root, binding);
  const initializations: Record<string, ProjectExecutionInitialization> =
    Object.create(null);
  for (const projectId of projectIds) {
    const created = projectExecutionFixture({
      taskExecutionSelections: taskExecutionSelections(),
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
    initializations[projectId] = initialExecutionInput(created.state);
  }
  return {
    root,
    ports,
    children: childProcesses,
    initializations: Object.freeze(initializations),
  };
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
  const { ports, initializations } = fixture(t);
  for (const [queueId, originLane] of [
    ["queue-scheduled", "scheduled"],
    ["queue-interactive", "interactive"],
  ] as const) {
    const input = {
      queueId,
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash(queueId),
      originLane,
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    } as const;
    const initialization =
      queueId === "queue-scheduled" ? initializations["project-a"] : undefined;
    assert.equal(
      createQueue(ports.repository, ports.repositoryBindingId, {
        kind: "scheduled",
        input: initialization ? [input, initialization] : [input],
      }).status,
      "completed",
    );
  }
  const first = selectNextQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-scheduled",
  );
  assert.equal(
    first.status === "completed" && first.value?.queueId,
    "queue-interactive",
  );
  const parked = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-scheduled",
  );
  assert.equal(
    parked.status === "completed" && parked.value.state,
    "waiting_foreground",
  );
  if (parked.status !== "completed") throw new Error("parked queue");
  const forbiddenLease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-scheduled",
    "project-operation",
  );
  assert.equal(forbiddenLease.status, "completed");
  if (forbiddenLease.status !== "completed") throw new Error("lease");
  const directLease = updateCoordinatorQueue(
    ports,
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
  assert.equal(directLease.reason, "coordinator_queue_transition_invalid");
  assert.equal(forbiddenLease.value.release().status, "completed");
  const interactive = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-interactive",
  );
  assert.equal(interactive.status, "completed");
  if (interactive.status !== "completed") throw new Error("queue");
  assert.equal(
    updateCoordinatorQueue(
      ports,
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
  const second = selectNextQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-scheduled",
  );
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
  const { ports, initializations } = fixture(t);
  assert.ok(initializations["project-a"]);

  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-interactive",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: hash("interactive"),
          originLane: "interactive",
          repositoryRevision: revision,
          scopeHash: hash("scope"),
        },
        initializations["project-a"],
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-interactive",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease");
  const reads: string[] = [];
  const leased = updateCoordinatorQueue(ports, "queue-interactive", 1, {
    get state() {
      reads.push("state");
      return "leased" as const;
    },
    get lease() {
      reads.push("lease");
      return lease.value;
    },
    get resumeCondition() {
      reads.push("resume");
      return null;
    },
    get resultReference() {
      reads.push("result");
      return null;
    },
  });
  // 既存Blocker Gateの状態遷移判定を含め、Lease借用前の読取り順を固定する。
  assert.deepEqual(reads, [
    "resume",
    "result",
    "state",
    "state",
    "state",
    "lease",
    "lease",
    "state",
    "state",
    "resume",
    "result",
  ]);
  assert.equal(leased.status, "completed");
  if (leased.status !== "completed") throw new Error("leased queue");
  const running = updateCoordinatorQueue(
    ports,
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
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-scheduled",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: hash("scheduled"),
          originLane: "scheduled",
          repositoryRevision: revision,
          scopeHash: hash("scope"),
        },
      ],
    }).status,
    "completed",
  );
  const selected = selectNextQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-scheduled",
  );
  assert.equal(selected.status, "completed");
  assert.equal(selected.status === "completed" && selected.value, null);
  assert.equal(
    selected.status === "completed" && selected.reason,
    "coordinator_active_operation_retained",
  );
  const scheduled = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
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
 * @boundary PRL-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("one Repository Binding cannot acquire two Project Operation leases", (t) => {
  const { ports, initializations } = fixture(t, "binding-a", [
    "project-a",
    "project-b",
  ]);
  for (const [projectId, queueId] of [
    ["project-a", "queue-a"],
    ["project-a", "queue-b"],
    ["project-b", "queue-c"],
  ] as const) {
    const input = {
      queueId,
      projectId,
      milestoneId: "milestone-a",
      requestHash: hash(queueId),
      originLane: "interactive",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    } as const;
    const initialization =
      queueId === "queue-b" ? undefined : initializations[projectId];
    assert.equal(
      createQueue(ports.repository, ports.repositoryBindingId, {
        kind: "scheduled",
        input: initialization ? [input, initialization] : [input],
      }).status,
      "completed",
    );
  }
  const first = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  if (first.status !== "completed") throw new Error("first lease");
  const sameProject = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-b",
    "project-operation",
  );
  const otherProject = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-b",
    "queue-c",
    "project-operation",
  );
  assert.equal(sameProject.status, "blocked");
  assert.equal(sameProject.reason, "coordinator_lease_unavailable");
  assert.equal(otherProject.status, "blocked");
  assert.equal(otherProject.reason, "coordinator_lease_unavailable");
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
    initializations,
  } = fixture(t, "binding-race", ["project-a", "project-b", "project-c"]);
  for (const [projectId, queueId] of [
    ["project-a", "queue-a"],
    ["project-b", "queue-b"],
    ["project-c", "queue-c"],
  ] as const) {
    const initialization = initializations[projectId];
    assert.ok(initialization);
    assert.equal(
      createQueue(ports.repository, ports.repositoryBindingId, {
        kind: "scheduled",
        input: [
          {
            queueId,
            projectId,
            milestoneId: "milestone-a",
            requestHash: hash(queueId),
            originLane: "interactive",
            repositoryRevision: revision,
            scopeHash: hash("scope"),
          },
          initialization,
        ],
      }).status,
      "completed",
    );
  }
  const controlDirectory = path.join(workingDirectory, "race-control");
  fs.mkdirSync(controlDirectory);
  const barrier = path.join(controlDirectory, "go");
  const probe = fileURLToPath(
    new URL("../fixtures/task-lease-race-probe.ts", import.meta.url),
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
            "coordinator_lease_unavailable",
            "coordinator_snapshot_lock_unavailable",
            "coordinator_snapshot_lock_contended",
          ].includes(result.reason),
      ),
    JSON.stringify({
      outcomes,
      stderr: results.map((result) => result.stderr),
    }),
  );
  const owner = inspectCoordinatorSnapshotLeaseAcquisitionOwner(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.equal(owner.status, "completed");
  assert.equal(owner.value?.acquisition, null);
});
