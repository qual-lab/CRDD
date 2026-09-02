import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDevelopmentProjectRuntimePublicObjectiveCandidate } from "../src/security/project-runtime-public-runtime.ts";
import { createProjectRuntimeWindowsDecisionStoreTestingAdapter } from "../src/security/project-runtime-windows-decision-store.ts";

test("development composition uses the explicitly supplied candidate integration boundary", async (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-public-runtime-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    ["-C", root, "config", "user.email", "test@example.invalid"],
    {
      windowsHide: true,
    },
  );
  execFileSync("git", ["-C", root, "config", "user.name", "CRDD Test"], {
    windowsHide: true,
  });
  fs.writeFileSync(path.join(root, "result.txt"), "base\n", "utf8");
  execFileSync("git", ["-C", root, "add", "result.txt"], {
    windowsHide: true,
  });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"], {
    windowsHide: true,
  });
  const revision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  const decisionRoot = path.join(root, ".decision-store");
  fs.mkdirSync(decisionRoot);
  const decisionStore =
    createProjectRuntimeWindowsDecisionStoreTestingAdapter(decisionRoot);
  let integrationAdapterCalls = 0;
  let taskStarts = 0;
  const runtime = createDevelopmentProjectRuntimePublicObjectiveCandidate({
    issueTaskAuthority: () => Object.freeze({}),
    startTask: () => {
      taskStarts += 1;
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started" as const,
        controlCapability: Object.freeze({}),
        completion: Promise.resolve(
          Object.freeze({
            status: "completed" as const,
            reason: "coordinator_task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            candidateId: "candidate-task",
            hostRecoveryId: null,
            dockerRecoveryId: null,
            candidateRecoveryId: null,
            candidateStoreRecoveryId: null,
            dockerRecoveryIds: Object.freeze([]),
            candidateRevision: null,
            executorProvider: "codex",
            reviewerProvider: "claude",
            canonicalRepositoryChanged: false,
          }),
        ),
        rawOutputReported: false as const,
        hostPathReported: false as const,
        untrustedProviderTextReported: false as const,
        credentialAbsenceVerified: false as const,
      });
    },
    cancelTask: () =>
      Promise.resolve(
        Object.freeze({
          status: "blocked" as const,
          reason: "coordinator_task_control_invalid" as const,
        }),
      ),
    frontProviderForTask: () => "codex",
    openDecisionStore: () =>
      Object.freeze({
        status: "completed" as const,
        principalId: "local-user-test-user",
        store: decisionStore,
      }),
    createIntegrationAdapter: () => {
      integrationAdapterCalls += 1;
      return Object.freeze({
        createCandidate: async ({
          state,
        }: {
          state: {
            repositoryRevision: string;
            objectives: readonly { definition: { id: string } }[];
            milestoneId: string;
          };
        }) =>
          Object.freeze({
            status: "candidate" as const,
            candidateId: "candidate-integrated",
            candidateHash: "b".repeat(64),
            baseRevision: state.repositoryRevision,
            changedPaths: Object.freeze(["result.txt"]),
            objectiveEvidence: Object.freeze({
              [state.objectives[0]?.definition.id ?? "missing"]: Object.freeze([
                "evidence-objective",
              ]),
            }),
            milestoneEvidence: Object.freeze(["evidence-milestone"]),
            conflicts: Object.freeze([]),
            cleanupConfirmed: true,
          }),
        observeCanonicalRepository: () =>
          Object.freeze({
            status: "observed" as const,
            repositoryRevision: revision,
            dirty: false,
            observedPaths: Object.freeze([]),
          }),
        adoptCandidate: async () => {
          throw new Error("adoption_must_not_be_used");
        },
      });
    },
  });
  const result = await runtime.run(
    {
      requestId: "request-public-runtime",
      projectId: "project-public-runtime",
      milestoneId: "milestone-public-runtime",
      repositoryRevision: revision,
      objective: "Create the bounded result.",
      acceptanceCriteria: ["result accepted"],
      allowedPaths: ["result.txt"],
      readPaths: ["result.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      requestedExecutorProvider: "codex",
      adoptResult: false,
    },
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local-user-test-user" }),
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(result.reason, "project_runtime_milestone_accepted");
  assert.equal(integrationAdapterCalls, 1);
  assert.equal(taskStarts, 1);

  const replay = await runtime.run(
    {
      requestId: "request-public-runtime",
      projectId: "project-public-runtime",
      milestoneId: "milestone-public-runtime",
      repositoryRevision: revision,
      objective: "Create the bounded result.",
      acceptanceCriteria: ["result accepted"],
      allowedPaths: ["result.txt"],
      readPaths: ["result.txt"],
      maximumConcurrency: 1,
      maximumReplans: 0,
      originLane: "interactive",
      requestedExecutorProvider: "codex",
      adoptResult: false,
    },
    new AbortController().signal,
    root,
    Object.freeze({ principalId: "local-user-test-user" }),
  );
  assert.equal(replay.status, "completed", JSON.stringify(replay));
  assert.equal(replay.reason, "project_runtime_objective_already_accepted");
  assert.equal(taskStarts, 1);
  assert.equal(integrationAdapterCalls, 1);
});
