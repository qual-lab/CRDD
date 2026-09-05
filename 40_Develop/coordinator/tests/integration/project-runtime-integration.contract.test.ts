import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  readProjectOperationQueueState,
  readProjectRuntimeState,
} from "../../src/security/project-runtime-durable-foundation.ts";
import { integrateProjectRuntimeOperation } from "../../src/security/project-runtime-integration.ts";
import { inspectMcpProjectRuntimeObjectiveResult } from "../../src/security/mcp-project-runtime-adapter.ts";
import { runProjectRuntimeObjective } from "../../src/security/project-runtime-objective-intake.ts";

const revision = "a".repeat(40);
async function prepared(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-integration-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = await runProjectRuntimeObjective(
    {
      authenticatedPrincipalId: "principal-integration",
      verifyProjectBinding: () => ({
        status: "verified",
        repositoryBindingId: "binding-a",
        repositoryRevision: revision,
        workingDirectory: root,
        repositoryRoot: root,
        bindingCapability: {},
      }),
      planObjective: () => ({
        milestoneAcceptanceCriteria: ["milestone-evidence"],
        objectives: [
          { id: "objective-a", acceptanceCriteria: ["objective-evidence"] },
        ],
        tasks: [
          {
            id: "task-a",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["result.txt"],
            conflictKeys: [],
          },
        ],
      }),
      createTaskExecutions: () => [
        {
          taskId: "task-a",
          authorityBindingId: "authority-a",
          taskRequest: {},
          taskAuthorityCapability: {},
          repositoryRoot: root,
        },
      ],
      observeLeaseOwner: () => ({ status: "absent" }),
      execution: {
        runSingleTaskAttempt: async (input) => {
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
            candidateId: "task-candidate-a",
            recoveryIds: [],
          };
        },
      },
    },
    {
      requestId: "request-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      repositoryRevision: revision,
      objective: "Create result",
      acceptanceCriteria: ["accepted"],
      allowedPaths: ["result.txt"],
      readPaths: ["README.md"],
      maximumConcurrency: 1,
      maximumReplans: 1,
      originLane: "interactive",
      adoptResult: false,
    },
    new AbortController().signal,
  );
  assert.equal(result.status, "completed");
  return { root, queueId: result.queueId ?? "invalid" };
}
function candidate(conflicts: readonly string[] = []) {
  return {
    status: "candidate",
    candidateId: "integrated-a",
    candidateHash: "b".repeat(64),
    baseRevision: revision,
    changedPaths: ["result.txt"],
    objectiveEvidence: { "objective-a": ["evidence-objective"] },
    milestoneEvidence: ["evidence-milestone"],
    conflicts,
    cleanupConfirmed: true,
  };
}

test("Task completion is integrated into Objective and Milestone acceptance", async (t) => {
  const { root, queueId } = await prepared(t);
  let adoptions = 0;
  const result = await integrateProjectRuntimeOperation(
    {
      createCandidate: async () => candidate(),
      observeCanonicalRepository: () => ({
        status: "observed",
        repositoryRevision: revision,
        dirty: false,
        observedPaths: [],
      }),
      observeLeaseOwner: (owner) => ({ ...owner, status: "absent" }),
      adoptCandidate: async () => {
        adoptions += 1;
        return null;
      },
    },
    {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId,
      taskCandidateIds: ["task-candidate-a"],
      allowedPaths: ["result.txt"],
      adoptionAuthorized: false,
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(adoptions, 0);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  const queue = readProjectOperationQueueState(root, "binding-a", queueId);
  assert.equal(
    state.status === "completed" && state.value?.milestone.state,
    "accepted",
  );
  assert.equal(queue.status === "completed" && queue.value.state, "completed");
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        ".crdd",
        "project-runtime",
        "integration",
        "project-a",
        "integrated-a.json",
      ),
    ),
    true,
  );
});

test("explicit adoption is serialized and requires a fresh matching repository observation", async (t) => {
  const { root, queueId } = await prepared(t);
  const signal = path.join(root, "canonical-pre-publication-ready");
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
  child.kill();
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  let adoptions = 0;
  const result = await integrateProjectRuntimeOperation(
    {
      createCandidate: async () => candidate(),
      observeCanonicalRepository: () => ({
        status: "observed",
        repositoryRevision: revision,
        dirty: false,
        observedPaths: [],
      }),
      observeLeaseOwner: (owner) => ({ ...owner, status: "absent" }),
      adoptCandidate: async () => {
        adoptions += 1;
        return {
          status: "completed",
          receiptId: "receipt-a",
          beforeRevision: revision,
          afterRevision: "c".repeat(40),
          changedPaths: ["result.txt"],
          cleanupConfirmed: true,
        };
      },
    },
    {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId,
      taskCandidateIds: ["task-candidate-a"],
      allowedPaths: ["result.txt"],
      adoptionAuthorized: true,
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(result.receiptId, "receipt-a");
  assert.equal(adoptions, 1);
});

test("integration conflict stops before adoption and requests a human decision", async (t) => {
  const { root, queueId } = await prepared(t);
  let adoptions = 0;
  const result = await integrateProjectRuntimeOperation(
    {
      createCandidate: async () => candidate(["semantic-conflict"]),
      observeCanonicalRepository: () => {
        throw new Error("not_expected");
      },
      adoptCandidate: async () => {
        adoptions += 1;
      },
    },
    {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId,
      taskCandidateIds: ["task-candidate-a"],
      allowedPaths: ["result.txt"],
      adoptionAuthorized: true,
    },
  );
  assert.equal(result.reason, "project_runtime_integration_conflict");
  assert.equal(adoptions, 0);
  const queue = readProjectOperationQueueState(root, "binding-a", queueId);
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "human_decision_required",
  );
});

test("revision mismatch blocks canonical adoption and releases its lease", async (t) => {
  const { root, queueId } = await prepared(t);
  const input = {
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId,
    taskCandidateIds: ["task-candidate-a"],
    allowedPaths: ["result.txt"],
    adoptionAuthorized: true,
  } as const;
  const dependencies = {
    createCandidate: async () => candidate(),
    observeCanonicalRepository: () => ({
      status: "observed",
      repositoryRevision: "d".repeat(40),
      dirty: false,
      observedPaths: [],
    }),
    observeLeaseOwner: (
      owner: Readonly<{
        ownerProcessId: number;
        ownerGeneration: string;
      }>,
    ) => ({ ...owner, status: "absent" }),
    adoptCandidate: async () => {
      throw new Error("not_expected");
    },
  };
  const first = await integrateProjectRuntimeOperation(dependencies, input);
  const second = await integrateProjectRuntimeOperation(dependencies, input);
  assert.equal(
    first.reason,
    "project_runtime_adoption_revision_or_scope_mismatch",
  );
  assert.equal(
    second.reason,
    "project_runtime_adoption_revision_or_scope_mismatch",
  );
  assert.equal(first.manualRecoveryRequired, false);
});

test("canonical adoption preserves malformed acquisition evidence and exposes its recovery reference", async (t) => {
  const { root, queueId } = await prepared(t);
  const marker = path.join(
    root,
    ".crdd",
    "project-runtime",
    "locks",
    "canonical-adoption-binding-a-project-a.acquire-pending",
  );
  fs.writeFileSync(marker, "not-json\n", "utf8");
  let adoptions = 0;
  const result = await integrateProjectRuntimeOperation(
    {
      createCandidate: async () => candidate(),
      observeCanonicalRepository: () => ({
        status: "observed",
        repositoryRevision: revision,
        dirty: false,
        observedPaths: [],
      }),
      observeLeaseOwner: (owner) => ({ ...owner, status: "unknown" }),
      adoptCandidate: async () => {
        adoptions += 1;
        return null;
      },
    },
    {
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId,
      taskCandidateIds: ["task-candidate-a"],
      allowedPaths: ["result.txt"],
      adoptionAuthorized: true,
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
  assert.match(
    result.recoveryIds[0] ?? "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  assert.equal(adoptions, 0);
  assert.equal(fs.existsSync(marker), true);
  const publicProjection = inspectMcpProjectRuntimeObjectiveResult(result);
  assert.ok(publicProjection);
  assert.deepEqual(publicProjection.recoveryIds, result.recoveryIds);
});
