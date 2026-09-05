import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { ProjectRuntimeDecisionRecord } from "../../src/security/project-runtime-human-decision.ts";
import { createProjectRuntimeWindowsDecisionStoreTestingAdapter } from "../../src/security/project-runtime-windows-decision-store.ts";

function record(): ProjectRuntimeDecisionRecord {
  return Object.freeze({
    recordId: "decision-a",
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    repositoryRevision: "a".repeat(40),
    expectedGeneration: 2,
    principalId: "c".repeat(64),
    allowedOptions: Object.freeze(["resume"] as const),
    capabilityHash: "d".repeat(64),
    expiresAtEpochMs: 10_000,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  });
}

test("protected decision store retains an immutable CAS generation chain", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-decision-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createProjectRuntimeWindowsDecisionStoreTestingAdapter(root);
  const first = record();
  assert.deepEqual(store.create(first), { status: "completed", value: first });
  const prepared = Object.freeze({
    ...first,
    disposition: "prepared" as const,
    applicationId: "application-a",
    selectedOption: "resume" as const,
    newGeneration: 3,
  });
  assert.deepEqual(store.compareAndSet(first, prepared), {
    status: "completed",
    value: prepared,
  });
  assert.deepEqual(store.read(first.recordId), {
    status: "completed",
    value: prepared,
  });
  assert.equal(
    (store.compareAndSet(first, prepared) as { status: string }).status,
    "blocked",
  );
  assert.equal(
    fs
      .readdirSync(root)
      .filter((name) =>
        /^project-decision-[0-9a-f]{40}-[0-9]{8}\.json$/u.test(name),
      ).length,
    2,
  );
});

test("missing generation or changed immutable record fails closed", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-decision-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createProjectRuntimeWindowsDecisionStoreTestingAdapter(root);
  const first = record();
  assert.equal((store.create(first) as { status: string }).status, "completed");
  const recordPath = fs
    .readdirSync(root)
    .find((name) => name.endsWith(".json"));
  assert.ok(recordPath);
  fs.appendFileSync(path.join(root, recordPath), " ");
  assert.equal(
    (store.read(first.recordId) as { status: string }).status,
    "blocked",
  );
});
