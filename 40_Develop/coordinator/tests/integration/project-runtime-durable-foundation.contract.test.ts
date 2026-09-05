import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireProjectRuntimeLease,
  describeProjectRuntimeDurableFoundation,
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss,
  reconcileProjectRuntimeLeaseOwnerLoss,
  selectNextProjectOperation,
  settleProjectOperationQueueLeaseRelease,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "../../src/security/project-runtime-durable-foundation.ts";
import {
  createProjectRuntimeState,
  type ProjectRuntimeState,
} from "../../../project-runtime/src/index.ts";

const MAX_RECORD_BYTES = 16 * 1024 * 1024;

function stateEnvelope(state: ProjectRuntimeState) {
  const serialized = JSON.stringify(state);
  return {
    schema: "crdd-coordinator/project-runtime-durable-foundation/v1",
    schemaRevision: 1,
    recordKind: "project-state",
    repositoryBindingId: "binding-a",
    projectId: state.projectId,
    createdGeneration: 1,
    updatedGeneration: state.generation,
    contentHash: createHash("sha256").update(serialized, "utf8").digest("hex"),
    content: state,
  };
}

function storedEnvelopeBytes(state: ProjectRuntimeState) {
  return Buffer.byteLength(`${JSON.stringify(stateEnvelope(state))}\n`, "utf8");
}

function stateDirectory(root: string) {
  return path.join(root, ".crdd", "project-runtime", "states", "project-a");
}

function queueDirectory(root: string) {
  return path.join(root, ".crdd", "project-runtime", "queue", "queue-a");
}

function stateWithStoredBytes(
  template: ProjectRuntimeState,
  targetBytes: number,
): ProjectRuntimeState {
  const pathValue = "p".repeat(512);
  const mutable = structuredClone(template) as unknown as {
    milestone: { acceptanceCriteria: string[] };
    tasks: Array<{
      definition: {
        id: string;
        objectiveId: string;
        dependencies: string[];
        allowedPaths: string[];
        conflictKeys: string[];
      };
    }>;
  } & Omit<ProjectRuntimeState, "milestone" | "tasks">;
  mutable.milestone.acceptanceCriteria = ["a", "b"];
  mutable.tasks = Array.from({ length: 1024 }, (_unused, index) => ({
    ...structuredClone(template.tasks[0]),
    definition: {
      id: `task-${index}`,
      objectiveId: "objective-a",
      dependencies: [],
      allowedPaths: Array.from({ length: 28 }, () => pathValue),
      conflictKeys: [],
    },
  }));
  let remaining =
    targetBytes -
    storedEnvelopeBytes(mutable as unknown as ProjectRuntimeState);
  if (remaining < 0) throw new Error("record_boundary_fixture_too_large");
  const wholePaths = Math.floor(remaining / 515);
  for (let index = 0; index < wholePaths; index += 1) {
    const task = mutable.tasks[index % mutable.tasks.length];
    if (!task || task.definition.allowedPaths.length >= 128)
      throw new Error("record_boundary_fixture_capacity_exhausted");
    task.definition.allowedPaths.push(pathValue);
  }
  remaining =
    targetBytes -
    storedEnvelopeBytes(mutable as unknown as ProjectRuntimeState);
  const firstGrowth = Math.min(remaining, 511);
  mutable.milestone.acceptanceCriteria[0] = "a".repeat(1 + firstGrowth);
  remaining -= firstGrowth;
  mutable.milestone.acceptanceCriteria[1] = "b".repeat(1 + remaining);
  const result = mutable as unknown as ProjectRuntimeState;
  assert.equal(storedEnvelopeBytes(result), targetBytes);
  return result;
}

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-project-durable-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const created = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency: 2,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/a.ts"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture_failed");
  return { root, state: created.state };
}

test("PR-D-N-01 durably creates and reads generation-bound Project State", (t) => {
  const { root, state } = fixture(t);
  const write = writeProjectRuntimeState(root, "binding-a", state, 0);
  assert.equal(write.status, "completed");
  const read = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(read.status, "completed");
  assert.deepEqual(read.value, state);

  const stale = writeProjectRuntimeState(root, "binding-a", state, 0);
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "project_runtime_state_generation_conflict");
});

test("PR-D-A-01 rejects corrupt or semantically invalid durable state", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", state, 0).status,
    "completed",
  );
  const record = path.join(stateDirectory(root), "generation-1.json");
  const original = JSON.parse(fs.readFileSync(record, "utf8")) as Record<
    string,
    unknown
  >;
  fs.writeFileSync(record, "{}\n", "utf8");
  const read = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(read.status, "blocked");
  assert.equal(read.reason, "project_runtime_state_observation_unknown");
  assert.equal(read.manualRecoveryRequired, true);

  const rewritten = { ...original };
  rewritten.content = { contract: "crdd-coordinator/project-runtime-state/v1" };
  rewritten.contentHash = createHash("sha256")
    .update(JSON.stringify(rewritten.content), "utf8")
    .digest("hex");
  fs.writeFileSync(record, `${JSON.stringify(rewritten)}\n`, "utf8");
  assert.equal(
    readProjectRuntimeState(root, "binding-a", "project-a").reason,
    "project_runtime_state_observation_unknown",
  );
});

test("PR-D-A-01 rejects impossible Task state and identity tuples", (t) => {
  const cases = [
    {
      name: "running-without-operation",
      mutate(task: Record<string, unknown>) {
        task.state = "running";
        task.startPhase = "running";
        task.attemptId = "attempt-a";
        task.operationId = null;
        task.authorityBindingId = "authority-a";
      },
    },
    {
      name: "handoff-without-operation",
      mutate(task: Record<string, unknown>) {
        task.state = "starting";
        task.startPhase = "handoff_prepared";
        task.attemptId = "attempt-a";
        task.operationId = null;
        task.authorityBindingId = "authority-a";
      },
    },
    {
      name: "ready-with-running-phase",
      mutate(task: Record<string, unknown>) {
        task.state = "ready";
        task.startPhase = "running";
        task.attemptId = null;
        task.operationId = null;
        task.authorityBindingId = null;
      },
    },
  ] as const;

  for (const item of cases) {
    const { root, state } = fixture(t);
    assert.equal(
      writeProjectRuntimeState(root, "binding-a", state, 0).status,
      "completed",
      item.name,
    );
    const location = path.join(stateDirectory(root), "generation-1.json");
    const envelope = JSON.parse(fs.readFileSync(location, "utf8")) as {
      content: { tasks: Record<string, unknown>[] };
      contentHash: string;
    };
    const task = envelope.content.tasks[0];
    if (!task) throw new Error("fixture_task_missing");
    item.mutate(task);
    envelope.contentHash = createHash("sha256")
      .update(JSON.stringify(envelope.content), "utf8")
      .digest("hex");
    fs.writeFileSync(location, `${JSON.stringify(envelope)}\n`, "utf8");

    const observed = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(observed.status, "blocked", item.name);
    assert.equal(
      observed.reason,
      "project_runtime_state_observation_unknown",
      item.name,
    );
    assert.equal(observed.manualRecoveryRequired, true, item.name);
  }
});

test("PR-D-A-01 rejects malformed envelopes, generation gaps, and residual inventory", (t) => {
  const cases: ReadonlyArray<{
    name: string;
    mutate: (directory: string, state: ProjectRuntimeState) => void;
  }> = [
    {
      name: "filename-generation-mismatch",
      mutate: (directory) =>
        fs.renameSync(
          path.join(directory, "generation-1.json"),
          path.join(directory, "generation-2.json"),
        ),
    },
    {
      name: "missing-generation",
      mutate: (directory, state) => {
        const generationThree = { ...state, generation: 3 };
        fs.writeFileSync(
          path.join(directory, "generation-3.json"),
          `${JSON.stringify(stateEnvelope(generationThree))}\n`,
          "utf8",
        );
      },
    },
    {
      name: "pending-residue",
      mutate: (directory) =>
        fs.writeFileSync(
          path.join(directory, ".pending-interrupted"),
          "residue",
          "utf8",
        ),
    },
    {
      name: "unknown-inventory",
      mutate: (directory) =>
        fs.writeFileSync(path.join(directory, "notes.txt"), "unknown", "utf8"),
    },
    {
      name: "envelope-extra-field",
      mutate: (directory) => {
        const location = path.join(directory, "generation-1.json");
        const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
          string,
          unknown
        >;
        record.unexpected = true;
        fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
      },
    },
    {
      name: "envelope-missing-field",
      mutate: (directory) => {
        const location = path.join(directory, "generation-1.json");
        const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
          string,
          unknown
        >;
        delete record.createdGeneration;
        fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
      },
    },
    {
      name: "unknown-record-kind",
      mutate: (directory) => {
        const location = path.join(directory, "generation-1.json");
        const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
          string,
          unknown
        >;
        record.recordKind = "unknown";
        fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
      },
    },
  ];

  for (const scenario of cases) {
    const { root, state } = fixture(t);
    assert.equal(
      writeProjectRuntimeState(root, "binding-a", state, 0).status,
      "completed",
      scenario.name,
    );
    scenario.mutate(stateDirectory(root), state);
    const priorNames = fs.readdirSync(stateDirectory(root)).sort();
    const result = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(result.status, "blocked", scenario.name);
    assert.equal(result.manualRecoveryRequired, true, scenario.name);
    assert.deepEqual(
      fs.readdirSync(stateDirectory(root)).sort(),
      priorNames,
      scenario.name,
    );
  }
});

test("PR-D-A-01 rejects an unknown queue record kind on exact retry", (t) => {
  const { root } = fixture(t);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    enqueueProjectOperation(root, "binding-a", input).status,
    "completed",
  );
  const location = path.join(queueDirectory(root), "generation-1.json");
  const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
    string,
    unknown
  >;
  record.recordKind = "unknown";
  fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
  const result = enqueueProjectOperation(root, "binding-a", input);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "project_runtime_mutation_observation_unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), ["generation-1.json"]);
});

test("PR-D-Q-00 selects only queues owned by the requested Project binding", (t) => {
  const { root } = fixture(t);
  const commonFields = {
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      ...commonFields,
      queueId: "queue-a",
      projectId: "project-a",
    }).status,
    "completed",
  );
  assert.equal(
    enqueueProjectOperation(root, "binding-b", {
      ...commonFields,
      queueId: "queue-b",
      projectId: "project-b",
    }).status,
    "completed",
  );
  const selectedA = selectNextProjectOperation(root, "binding-a");
  const selectedB = selectNextProjectOperation(root, "binding-b");
  assert.equal(selectedA.status, "completed");
  assert.equal(selectedA.value?.queueId, "queue-a");
  assert.equal(selectedB.status, "completed");
  assert.equal(selectedB.value?.queueId, "queue-b");
});

test("PR-D-Q-01 binds queue ownership to a live opaque lease", (t) => {
  const { root } = fixture(t);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const created = enqueueProjectOperation(root, "binding-a", input);
  assert.equal(created.reason, "project_runtime_queue_entry_durable");
  const observed = enqueueProjectOperation(root, "binding-a", input);
  assert.equal(observed.reason, "project_runtime_queue_request_reused");
  assert.equal(created.status, "completed");
  assert.equal(observed.status, "completed");
  if (created.status !== "completed" || observed.status !== "completed")
    throw new Error("queue_observation_failed");
  assert.deepEqual(observed.value, created.value);
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), ["generation-1.json"]);
  const conflict = enqueueProjectOperation(root, "binding-a", {
    ...input,
    requestHash: "d".repeat(64),
  });
  assert.equal(conflict.status, "blocked");
  assert.equal(conflict.reason, "project_runtime_queue_identity_conflict");

  const missingLease = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: null,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(missingLease.reason, "project_runtime_queue_lease_invalid");
  const fabricatedLease = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: {
        kind: "project-operation",
        ownerGeneration: "fabricated-owner",
        release: () => ({
          status: "completed" as const,
          reason: "fabricated",
          value: { released: true as const },
        }),
      },
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(fabricatedLease.reason, "project_runtime_queue_lease_invalid");
  const acquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  const stale = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "running",
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(stale.reason, "project_runtime_queue_generation_conflict");
  const wrongQueueLease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "project_runtime_lease_unavailable");
  assert.equal(acquired.value.release().status, "completed");
  const releasedLease = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "running",
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(releasedLease.reason, "project_runtime_queue_lease_invalid");
});

test("PR-D-A-01 rejects identity changes in every queue generation", (t) => {
  for (const identity of ["project", "queue"] as const) {
    for (const operation of ["retry", "update"] as const) {
      const { root } = fixture(t);
      const input = {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: "b".repeat(64),
        originLane: "scheduled" as const,
        repositoryRevision: "a".repeat(40),
        scopeHash: "c".repeat(64),
      };
      assert.equal(
        enqueueProjectOperation(root, "binding-a", input).status,
        "completed",
      );
      const lease = acquireProjectRuntimeLease(
        root,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(lease.status, "completed");
      if (lease.status !== "completed") throw new Error("lease_fixture_failed");
      assert.equal(
        updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
          state: "leased",
          lease: lease.value,
          resumeCondition: null,
          resultReference: null,
        }).status,
        "completed",
      );

      const first = path.join(queueDirectory(root), "generation-1.json");
      const record = JSON.parse(fs.readFileSync(first, "utf8")) as Record<
        string,
        unknown
      >;
      const content = record.content as Record<string, unknown>;
      if (identity === "project") {
        record.projectId = "project-b";
        content.projectId = "project-b";
      } else {
        content.queueId = "queue-b";
      }
      record.contentHash = createHash("sha256")
        .update(JSON.stringify(content), "utf8")
        .digest("hex");
      fs.writeFileSync(first, `${JSON.stringify(record)}\n`, "utf8");

      const result =
        operation === "retry"
          ? enqueueProjectOperation(root, "binding-a", input)
          : updateProjectOperationQueueState(root, "binding-a", "queue-a", 2, {
              state: "running",
              lease: lease.value,
              resumeCondition: null,
              resultReference: null,
            });
      assert.equal(result.status, "blocked", `${identity}-${operation}`);
      assert.equal(
        result.reason,
        "project_runtime_queue_record_mismatch",
        `${identity}-${operation}`,
      );
      assert.equal(
        result.manualRecoveryRequired,
        true,
        `${identity}-${operation}`,
      );
      assert.deepEqual(fs.readdirSync(queueDirectory(root)).sort(), [
        "generation-1.json",
        "generation-2.json",
      ]);
      assert.equal(lease.value.release().status, "completed");
    }
  }
});

test("PR-D-Q-01 serializes operation and project-scoped adoption leases", (t) => {
  const { root } = fixture(t);
  const first = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  const duplicate = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(duplicate.status, "blocked");
  assert.equal(duplicate.reason, "project_runtime_lease_unavailable");
  const adoption = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "canonical-adoption",
  );
  assert.equal(adoption.status, "completed");
  const crossQueueAdoption = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(crossQueueAdoption.status, "blocked");
  assert.equal(crossQueueAdoption.reason, "project_runtime_lease_unavailable");
  if (first.status !== "completed" || adoption.status !== "completed")
    throw new Error("lease_fixture_failed");
  assert.equal(first.value.release().status, "completed");
  assert.equal(
    first.value.release().reason,
    "project_runtime_lease_already_released",
  );
  assert.equal(adoption.value.release().status, "completed");
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

test("PR-D-A-01 preserves a recovery marker when lease release evidence fails", (t) => {
  const { root } = fixture(t);
  const acquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const leases = path.join(root, ".crdd", "project-runtime", "leases");
  fs.renameSync(leases, `${leases}.saved`);
  fs.writeFileSync(leases, "not-a-directory", "utf8");
  const released = acquired.value.release();
  assert.equal(released.status, "blocked");
  assert.equal(released.reason, "project_runtime_lease_release_unknown");
  assert.equal(released.manualRecoveryRequired, true);
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "blocked");
  assert.equal(reacquired.reason, "project_runtime_lease_recovery_required");
  assert.equal(reacquired.manualRecoveryRequired, true);
});

test("PR-A-04 reconciles an exited lease owner without starting new work", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const moduleUrl = new URL(
    "../../src/security/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease, updateProjectOperationQueueState } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);
const queued = updateProjectOperationQueueState(${JSON.stringify(root)}, "binding-a", "queue-a", 1, { state: "leased", lease: lease.value, resumeCondition: null, resultReference: null });
if (queued.status !== "completed") process.exit(21);`,
    ],
    { windowsHide: true },
  );
  const before = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(before.status, "completed");
  assert.equal(before.status === "completed" && before.value.state, "leased");
  let observedOwnerProcessId = 0;
  const recovered = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => {
      observedOwnerProcessId = owner.ownerProcessId;
      return {
        status: "absent",
        ownerProcessId: owner.ownerProcessId,
        ownerGeneration: owner.ownerGeneration,
      };
    },
  );
  assert.equal(recovered.status, "completed");
  assert.notEqual(observedOwnerProcessId, process.pid);
  assert.equal(
    recovered.status === "completed" && recovered.value.state,
    "recovery_required",
  );
  assert.equal(
    recovered.status === "completed" && recovered.value.ownerGeneration,
    null,
  );
  assert.equal(
    recovered.status === "completed" && recovered.value.resumeCondition,
    "owner_loss",
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

test("PR-A-04 recovers a lease acquisition interrupted before Queue ownership", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const moduleUrl = new URL(
    "../../src/security/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );

  const locks = path.join(root, ".crdd", "project-runtime", "locks");
  const marker = path.join(
    locks,
    "project-operation-binding-a.acquire-pending",
  );
  const lock = path.join(locks, "project-operation-binding-a.lock");
  assert.equal(fs.existsSync(marker), true);
  assert.equal(fs.existsSync(lock), true);
  const acquisitionMarkerBytes = fs.readFileSync(marker, "utf8");
  const blockedAcquire = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "project_runtime_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  assert.equal(blockedAcquire.recoveryId, null);

  let observedOwnerProcessId = 0;
  const recovered = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => {
      observedOwnerProcessId = owner.ownerProcessId;
      return { status: "absent", ...owner };
    },
  );
  assert.equal(recovered.status, "completed");
  assert.notEqual(observedOwnerProcessId, process.pid);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(lock), false);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "queued");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
  assert.match(
    queue.status === "completed" ? (queue.value.resultReference ?? "") : "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  fs.writeFileSync(marker, acquisitionMarkerBytes, "utf8");
  const resumedSettlement = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(resumedSettlement.status, "completed");
  assert.equal(
    resumedSettlement.status === "completed" &&
      resumedSettlement.value.generation,
    2,
  );
  assert.equal(fs.existsSync(marker), false);
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

test("PR-A-04 recovers canonical-adoption acquisition across Queue callers", (t) => {
  const { root } = fixture(t);
  const moduleUrl = new URL(
    "../../src/security/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "canonical-adoption");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );
  const blockedAcquire = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "project_runtime_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  assert.equal(blockedAcquire.recoveryId, null);
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.match(
    recovered.status === "completed" ? (recovered.value.recoveryId ?? "") : "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

test("PR-A-04 classifies a late contender against a live owner as unavailable", async (t) => {
  const { root } = fixture(t);
  const signal = path.join(root, "live-owner-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "project-runtime-lease-interleaving-probe.ts",
  );
  const child = spawn(process.execPath, [probe, root, signal, "hold"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(signal) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(signal), true);
  const contender = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(contender.status, "blocked");
  assert.equal(contender.reason, "project_runtime_lease_unavailable");
  assert.equal(contender.manualRecoveryRequired, false);
  assert.equal(contender.recoveryId, null);
  fs.writeFileSync(`${signal}.go`, "go\n", "utf8");
  const exitCode = await new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  assert.equal(exitCode, 0);
});

test("PR-A-04 keeps pre-publication contention effect-free and recovers only after owner loss", async (t) => {
  const { root } = fixture(t);
  const signal = path.join(root, "pre-publication-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "project-runtime-lease-interleaving-probe.ts",
  );
  const child = spawn(
    process.execPath,
    [probe, root, signal, "pause-before-publish"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(signal) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(signal), true);
  const contender = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(contender.status, "blocked");
  assert.equal(contender.reason, "project_runtime_lease_unavailable");
  assert.equal(contender.manualRecoveryRequired, false);
  assert.equal(contender.recoveryId, null);
  child.kill();
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.match(
    recovered.status === "completed" ? (recovered.value.recoveryId ?? "") : "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

test("PR-A-04 returns the exact Recovery ID when acquisition Marker readback fails after publication", (t) => {
  const { root } = fixture(t);
  const marker = path.join(
    root,
    ".crdd",
    "project-runtime",
    "locks",
    "canonical-adoption-binding-a-project-a.acquire-pending",
  );
  const originalReadFileSync = fs.readFileSync;
  let isFaultInjected = false;
  const faultingReadFileSync = ((...args: unknown[]) => {
    if (!isFaultInjected && String(args[0]) === marker) {
      isFaultInjected = true;
      throw new Error("injected_acquisition_marker_readback_failure");
    }
    return Reflect.apply(originalReadFileSync, fs, args);
  }) as typeof fs.readFileSync;
  let acquisition: ReturnType<typeof acquireProjectRuntimeLease>;
  Object.defineProperty(fs, "readFileSync", {
    configurable: true,
    writable: true,
    value: faultingReadFileSync,
  });
  try {
    acquisition = acquireProjectRuntimeLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "canonical-adoption",
    );
  } finally {
    Object.defineProperty(fs, "readFileSync", {
      configurable: true,
      writable: true,
      value: originalReadFileSync,
    });
  }
  assert.equal(isFaultInjected, true);
  assert.equal(acquisition.status, "blocked");
  assert.equal(
    acquisition.reason,
    "project_runtime_lease_acquisition_recovery_required",
  );
  assert.equal(
    acquisition.status === "blocked" && acquisition.manualRecoveryRequired,
    true,
  );
  const recoveryId =
    acquisition.status === "blocked" ? acquisition.recoveryId : null;
  assert.match(recoveryId ?? "", /^lease-acquisition-[0-9a-f]{40}$/u);
  assert.equal(fs.existsSync(marker), true);
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        ".crdd",
        "project-runtime",
        "locks",
        "canonical-adoption-binding-a-project-a.lock",
      ),
    ),
    false,
  );
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(
    recovered.status === "completed" && recovered.value.recoveryId,
    recoveryId,
  );
  assert.equal(fs.existsSync(marker), false);
});

test("PR-A-04 preserves a published acquisition when temporary cleanup is unknown", (t) => {
  const { root } = fixture(t);
  const locks = path.join(root, ".crdd", "project-runtime", "locks");
  const identity = "canonical-adoption-binding-a-project-a";
  const marker = path.join(locks, `${identity}.acquire-pending`);
  const lock = path.join(locks, `${identity}.lock`);
  const originalRmSync = fs.rmSync;
  let isCleanupFaultInjected = false;
  const faultingRmSync = ((...args: unknown[]) => {
    if (
      !isCleanupFaultInjected &&
      path
        .basename(String(args[0]))
        .startsWith(
          ".pending-canonical-adoption-binding-a-project-a-acquisition-",
        )
    ) {
      isCleanupFaultInjected = true;
      throw new Error("injected_acquisition_temporary_cleanup_failure");
    }
    return Reflect.apply(originalRmSync, fs, args);
  }) as typeof fs.rmSync;
  let acquisition: ReturnType<typeof acquireProjectRuntimeLease>;
  Object.defineProperty(fs, "rmSync", {
    configurable: true,
    writable: true,
    value: faultingRmSync,
  });
  try {
    acquisition = acquireProjectRuntimeLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "canonical-adoption",
    );
  } finally {
    Object.defineProperty(fs, "rmSync", {
      configurable: true,
      writable: true,
      value: originalRmSync,
    });
  }
  assert.equal(isCleanupFaultInjected, true);
  assert.equal(acquisition.status, "blocked");
  assert.equal(
    acquisition.reason,
    "project_runtime_lease_acquisition_recovery_required",
  );
  assert.equal(
    acquisition.status === "blocked" && acquisition.manualRecoveryRequired,
    true,
  );
  const recoveryId =
    acquisition.status === "blocked" ? acquisition.recoveryId : null;
  assert.match(recoveryId ?? "", /^lease-acquisition-[0-9a-f]{40}$/u);
  assert.equal(fs.existsSync(marker), true);
  assert.equal(fs.existsSync(lock), false);
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(
    recovered.status === "completed" && recovered.value.recoveryId,
    recoveryId,
  );
  assert.equal(fs.existsSync(marker), false);
});

test("PR-A-04 reconciles release intent created before Queue ownership", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const moduleUrl = new URL(
    "../../src/security/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );
  const locks = path.join(root, ".crdd", "project-runtime", "locks");
  const acquisitionMarker = path.join(
    locks,
    "project-operation-binding-a.acquire-pending",
  );
  const pending = JSON.parse(fs.readFileSync(acquisitionMarker, "utf8")) as {
    ownerGeneration: string;
  };
  const releaseMarker = path.join(
    locks,
    "project-operation-binding-a.release-unknown",
  );
  fs.writeFileSync(releaseMarker, `${pending.ownerGeneration}\n`, "utf8");
  const recovered = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(fs.existsSync(acquisitionMarker), false);
  assert.equal(fs.existsSync(releaseMarker), false);
  assert.equal(
    fs.existsSync(path.join(locks, "project-operation-binding-a.lock")),
    false,
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

test("PR-A-04 leaves mismatched acquisition and release identities unchanged", (t) => {
  const { root } = fixture(t);
  const moduleUrl = new URL(
    "../../src/security/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "canonical-adoption");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );
  const locks = path.join(root, ".crdd", "project-runtime", "locks");
  const ownershipMarker = path.join(
    locks,
    "canonical-adoption-binding-a-project-a.acquire-lock-owned",
  );
  const ownership = JSON.parse(fs.readFileSync(ownershipMarker, "utf8")) as {
    recoveryId: string;
  };
  ownership.recoveryId = `lease-acquisition-${"0".repeat(40)}`;
  fs.writeFileSync(ownershipMarker, `${JSON.stringify(ownership)}\n`, "utf8");
  const before = new Map(
    fs
      .readdirSync(locks)
      .sort()
      .map((name) => [
        name,
        fs.lstatSync(path.join(locks, name)).isFile()
          ? fs.readFileSync(path.join(locks, name), "utf8")
          : "<directory>",
      ]),
  );
  const result = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "project_runtime_lease_acquisition_recovery_evidence_mismatch",
  );
  assert.deepEqual(
    new Map(
      fs
        .readdirSync(locks)
        .sort()
        .map((name) => [
          name,
          fs.lstatSync(path.join(locks, name)).isFile()
            ? fs.readFileSync(path.join(locks, name), "utf8")
            : "<directory>",
        ]),
    ),
    before,
  );
});

test("PR-D-A-01 preserves malformed and partial acquisition state with an exact recovery ID", (t) => {
  for (const scenario of [
    "malformed-marker",
    "partial-temporary",
    "existing-lock",
  ] as const) {
    const { root: scenarioRoot } = fixture(t);
    const initialized = acquireProjectRuntimeLease(
      scenarioRoot,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(initialized.status, "completed");
    if (initialized.status !== "completed")
      throw new Error("lease_fixture_failed");
    assert.equal(initialized.value.release().status, "completed");
    const locks = path.join(scenarioRoot, ".crdd", "project-runtime", "locks");
    if (scenario === "malformed-marker")
      fs.writeFileSync(
        path.join(locks, "project-operation-binding-a.acquire-pending"),
        '{"ownerGeneration":',
        "utf8",
      );
    if (scenario === "partial-temporary")
      fs.writeFileSync(
        path.join(
          locks,
          ".pending-project-operation-binding-a-acquisition-partial.tmp",
        ),
        "partial",
        "utf8",
      );
    if (scenario === "existing-lock")
      fs.mkdirSync(path.join(locks, "project-operation-binding-a.lock"));
    const result = acquireProjectRuntimeLease(
      scenarioRoot,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(result.status, "blocked", scenario);
    const doesRequireRecovery = scenario === "existing-lock";
    assert.equal(
      result.status === "blocked" && result.manualRecoveryRequired,
      doesRequireRecovery,
      scenario,
    );
    if (doesRequireRecovery)
      assert.match(
        result.status === "blocked" ? (result.recoveryId ?? "") : "",
        /^lease-acquisition-[0-9a-f]{40}$/u,
        scenario,
      );
    else {
      assert.equal(
        result.reason,
        "project_runtime_lease_unavailable",
        scenario,
      );
      assert.equal(result.recoveryId, null, scenario);
    }
    assert.notEqual(
      result.reason,
      "project_runtime_lease_acquisition_rolled_back",
    );
  }
});

test("PR-A-04 clears Queue ownership only after exact lease release settlement", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  const running = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "running",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(running.status, "completed");
  const terminalIntent = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    3,
    {
      state: "integration_pending",
      lease: lease.value,
      resumeCondition: "objective_integration",
      resultReference: "result-a",
    },
  );
  assert.equal(terminalIntent.status, "completed");
  assert.equal(
    terminalIntent.status === "completed" &&
      terminalIntent.value.ownerGeneration,
    lease.value.ownerGeneration,
  );
  assert.equal(
    settleProjectOperationQueueLeaseRelease(
      root,
      "binding-a",
      "queue-a",
      4,
      lease.value.ownerGeneration,
    ).status,
    "blocked",
  );
  assert.equal(lease.value.release().status, "completed");
  const settled = settleProjectOperationQueueLeaseRelease(
    root,
    "binding-a",
    "queue-a",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settled.status, "completed");
  assert.equal(
    settled.status === "completed" && settled.value.ownerGeneration,
    null,
  );
  assert.equal(
    settled.status === "completed" && settled.value.state,
    "integration_pending",
  );
});

test("PR-A-04 preserves an exact long recovery reference in Queue terminal intent", (t) => {
  const { root } = fixture(t);
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-long-recovery",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "interactive",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-long-recovery",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-long-recovery",
    1,
    {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  const running = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-long-recovery",
    2,
    {
      state: "running",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(running.status, "completed");
  const recoveryRequired = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-long-recovery",
    3,
    {
      state: "recovery_required",
      lease: lease.value,
      resumeCondition: "runtime_recovery",
      resultReference: recoveryId,
    },
  );
  assert.equal(recoveryRequired.status, "completed");
  assert.equal(
    recoveryRequired.status === "completed" &&
      recoveryRequired.value.resultReference,
    recoveryId,
  );
  assert.equal(lease.value.release().status, "completed");
  const settled = settleProjectOperationQueueLeaseRelease(
    root,
    "binding-a",
    "queue-long-recovery",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settled.status, "completed");
  assert.equal(
    settled.status === "completed" && settled.value.resultReference,
    recoveryId,
  );
});

test("PR-A-04 reconciles a released terminal intent after owner settlement was interrupted", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-a",
      generation,
      {
        state,
        lease: lease.value,
        resumeCondition:
          state === "integration_pending" ? "objective_integration" : null,
        resultReference: state === "integration_pending" ? "result-a" : null,
      },
    );
    assert.equal(updated.status, "completed");
    generation += 1;
  }
  assert.equal(lease.value.release().status, "completed");
  let observerCalls = 0;
  const reconciled = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    () => {
      observerCalls += 1;
      return null;
    },
  );
  assert.equal(reconciled.status, "completed");
  assert.equal(observerCalls, 0);
  assert.equal(
    reconciled.status === "completed" && reconciled.value.state,
    "integration_pending",
  );
  assert.equal(
    reconciled.status === "completed" && reconciled.value.ownerGeneration,
    null,
  );
});

test("PR-A-04 requires exact Queue-bound lease evidence before clearing ownership", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-a",
      generation,
      {
        state,
        lease: lease.value,
        resumeCondition:
          state === "integration_pending" ? "objective_integration" : null,
        resultReference: state === "integration_pending" ? "result-a" : null,
      },
    );
    assert.equal(updated.status, "completed");
    generation += 1;
  }
  assert.equal(lease.value.release().status, "completed");
  const evidenceDirectory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "leases",
  );
  const releasedName = fs
    .readdirSync(evidenceDirectory)
    .find((name) => name.endsWith("-released.json"));
  assert.ok(releasedName);
  const releasedPath = path.join(evidenceDirectory, releasedName);
  const envelope = JSON.parse(fs.readFileSync(releasedPath, "utf8")) as {
    content: Record<string, unknown>;
    contentHash: string;
  };
  envelope.content.queueId = "queue-b";
  envelope.contentHash = createHash("sha256")
    .update(JSON.stringify(envelope.content), "utf8")
    .digest("hex");
  fs.writeFileSync(releasedPath, `${JSON.stringify(envelope)}\n`, "utf8");

  const settlement = settleProjectOperationQueueLeaseRelease(
    root,
    "binding-a",
    "queue-a",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settlement.status, "blocked");
  assert.equal(settlement.manualRecoveryRequired, true);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    lease.value.ownerGeneration,
  );
});

test("PR-A-04 rejects malformed pre-existing recovered evidence", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  const evidenceDirectory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "leases",
  );
  const acquiredName = fs
    .readdirSync(evidenceDirectory)
    .find((name) => !name.includes("released") && name.endsWith(".json"));
  assert.ok(acquiredName);
  const acquired = JSON.parse(
    fs.readFileSync(path.join(evidenceDirectory, acquiredName), "utf8"),
  ) as Record<string, unknown>;
  const recoveredName = acquiredName.replace(/\.json$/u, "-recovered.json");
  fs.writeFileSync(
    path.join(evidenceDirectory, recoveredName),
    `${JSON.stringify({ ...acquired, content: {} })}\n`,
    "utf8",
  );
  const result = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(lease.value.release().status, "completed");
});

test("PR-A-04 does not steal a lease from a live or unobservable owner", (t) => {
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  for (const status of ["alive", "unknown"] as const) {
    const outcome = reconcileProjectRuntimeLeaseOwnerLoss(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      (owner) => ({ ...owner, status }),
    );
    assert.equal(outcome.status, "blocked");
    assert.equal(
      outcome.reason,
      status === "alive"
        ? "project_runtime_lease_owner_still_active"
        : "project_runtime_lease_owner_observation_unknown",
    );
  }
  assert.equal(lease.value.release().status, "completed");
});

test("PR-D-A-01 rejects generic recovery resume without advancing generation", (t) => {
  const { root } = fixture(t);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    enqueueProjectOperation(root, "binding-a", input).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  for (const state of [
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ] as const) {
    const result = updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-a",
      2,
      {
        state,
        lease: null,
        resumeCondition:
          state === "replan_required" || state === "human_decision_required"
            ? "resume-a"
            : state === "recovery_required"
              ? "recover-a"
              : null,
        resultReference: state === "cancelled" ? "cancelled-a" : null,
      },
    );
    assert.equal(result.reason, "project_runtime_queue_lease_invalid", state);
  }
  const fabricated = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "replan_required",
      lease: {
        kind: "project-operation",
        ownerGeneration: lease.value.ownerGeneration,
        release: lease.value.release,
      },
      resumeCondition: "resume-a",
      resultReference: null,
    },
  );
  assert.equal(fabricated.reason, "project_runtime_queue_lease_invalid");
  const wrongQueueLease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "project_runtime_lease_unavailable");
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), [
    "generation-1.json",
    "generation-2.json",
  ]);
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 2, {
      state: "recovery_required",
      lease: lease.value,
      resumeCondition: "recover-a",
      resultReference: null,
    }).status,
    "completed",
  );
  assert.equal(lease.value.release().status, "completed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 3, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).reason,
    "project_runtime_queue_transition_invalid",
  );
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 3, {
      state: "cancelled",
      lease: lease.value,
      resumeCondition: null,
      resultReference: "cancelled-a",
    }).reason,
    "project_runtime_queue_lease_invalid",
  );
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), [
    "generation-1.json",
    "generation-2.json",
    "generation-3.json",
  ]);
});

test("PR-D-A-01 enforces the exact stored-record byte boundary", (t) => {
  for (const targetBytes of [MAX_RECORD_BYTES - 1, MAX_RECORD_BYTES]) {
    const { root, state } = fixture(t);
    const boundary = stateWithStoredBytes(state, targetBytes);
    const written = writeProjectRuntimeState(root, "binding-a", boundary, 0);
    assert.equal(written.status, "completed", String(targetBytes));
    const location = path.join(stateDirectory(root), "generation-1.json");
    assert.equal(fs.statSync(location).size, targetBytes);
    const observed = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(observed.status, "completed", String(targetBytes));
  }

  const { root, state } = fixture(t);
  const oversized = stateWithStoredBytes(state, MAX_RECORD_BYTES + 1);
  const rejected = writeProjectRuntimeState(root, "binding-a", oversized, 0);
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.reason, "project_runtime_mutation_observation_unknown");
  assert.equal(rejected.manualRecoveryRequired, true);
  assert.equal(
    fs.existsSync(path.join(stateDirectory(root), "generation-1.json")),
    false,
  );
});

test("describes the durable foundation without claiming the upper Runtime complete", () => {
  const contract = describeProjectRuntimeDurableFoundation();
  assert.equal(contract.upperProjectRuntimeCapabilityComplete, false);
  assert.equal(
    contract.staleLockDisposition,
    "blocked_manual_reconciliation_required_before_reuse",
  );
});
