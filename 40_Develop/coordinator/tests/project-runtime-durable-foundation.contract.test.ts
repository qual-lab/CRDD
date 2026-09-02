import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acquireProjectRuntimeLease,
  describeProjectRuntimeDurableFoundation,
  enqueueProjectOperation,
  readProjectRuntimeState,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "../src/security/project-runtime-durable-foundation.ts";
import {
  createProjectRuntimeState,
  type ProjectRuntimeState,
} from "../src/security/project-runtime-state.ts";

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
  mutable.tasks = Array.from({ length: 1024 }, (_, index) => ({
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
    const namesBefore = fs.readdirSync(stateDirectory(root)).sort();
    const result = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(result.status, "blocked", scenario.name);
    assert.equal(result.manualRecoveryRequired, true, scenario.name);
    assert.deepEqual(
      fs.readdirSync(stateDirectory(root)).sort(),
      namesBefore,
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
  assert.equal(wrongQueueLease.status, "completed");
  if (wrongQueueLease.status !== "completed")
    throw new Error("wrong_lease_fixture_failed");
  const wrongOwner = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "running",
      lease: wrongQueueLease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(wrongOwner.reason, "project_runtime_queue_lease_invalid");
  assert.equal(wrongQueueLease.value.release().status, "completed");
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
  assert.equal(wrongQueueLease.status, "completed");
  if (wrongQueueLease.status !== "completed")
    throw new Error("wrong_queue_lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 2, {
      state: "human_decision_required",
      lease: wrongQueueLease.value,
      resumeCondition: "resume-a",
      resultReference: null,
    }).reason,
    "project_runtime_queue_lease_invalid",
  );
  assert.equal(wrongQueueLease.value.release().status, "completed");
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
