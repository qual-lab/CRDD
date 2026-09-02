import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProjectRuntimeDecisionRecoveryStore } from "../src/security/project-runtime-decision-recovery-store.ts";
import type { ProjectRuntimeDecisionRecoveryIntent } from "../src/security/project-runtime-human-decision.ts";

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-decision-recovery-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function intent(): ProjectRuntimeDecisionRecoveryIntent {
  return Object.freeze({
    recoveryId: "decision-recovery-a",
    recordId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 2,
    newGeneration: 3,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  });
}

test("independent decision recovery intent survives a fresh store and settles by CAS", (t) => {
  const root = fixture(t);
  const first = createProjectRuntimeDecisionRecoveryStore(root);
  const value = intent();
  assert.equal((first.create(value) as { status: string }).status, "completed");
  const reopened = createProjectRuntimeDecisionRecoveryStore(root);
  assert.deepEqual(
    (reopened.read(value.recoveryId) as { value: unknown }).value,
    value,
  );
  const settled = Object.freeze({ ...value, disposition: "settled" as const });
  assert.equal(
    (reopened.compareAndSet(value, settled) as { status: string }).status,
    "completed",
  );
  assert.deepEqual(
    (reopened.read(value.recoveryId) as { value: unknown }).value,
    settled,
  );
});

test("recovery intent store rejects duplicate creation and a stale CAS", (t) => {
  const store = createProjectRuntimeDecisionRecoveryStore(fixture(t));
  const value = intent();
  assert.equal((store.create(value) as { status: string }).status, "completed");
  assert.equal((store.create(value) as { status: string }).status, "blocked");
  const stale = Object.freeze({ ...value, unknownBoundary: "queue_update" });
  assert.equal(
    (
      store.compareAndSet(stale, {
        ...stale,
        disposition: "settled",
      }) as { status: string }
    ).status,
    "blocked",
  );
});

test("unknown files fail closed without replacing the recovery history", (t) => {
  const root = fixture(t);
  const store = createProjectRuntimeDecisionRecoveryStore(root);
  const value = intent();
  assert.equal((store.create(value) as { status: string }).status, "completed");
  const identity = fs
    .readdirSync(
      path.join(root, ".crdd", "project-runtime", "decision-recovery"),
    )
    .find((entry) => !entry.endsWith(".lock"));
  assert.ok(identity);
  fs.writeFileSync(
    path.join(
      root,
      ".crdd",
      "project-runtime",
      "decision-recovery",
      identity,
      "unexpected",
    ),
    "x",
  );
  assert.equal(
    (store.read(value.recoveryId) as { status: string }).status,
    "blocked",
  );
});
