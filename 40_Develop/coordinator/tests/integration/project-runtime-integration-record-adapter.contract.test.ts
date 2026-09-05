import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProjectRuntimeIntegrationRecordAdapter } from "../../src/security/project-runtime-integration-record-adapter.ts";

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-integration-record-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root };
}

function adapter(root: string, projectId = "project-a") {
  return createProjectRuntimeIntegrationRecordAdapter({
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId,
    milestoneId: "milestone-a",
    queueId: "queue-a",
  });
}

test("integration records are immutable and an identical retry is idempotent", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const record = {
    kind: "integration" as const,
    identity: "candidate-a",
    value: { status: "candidate", changedPaths: ["result.txt"] },
  };
  assert.equal(records.write(record).status, "completed");
  assert.equal(records.write(record).status, "completed");
  const target = path.join(
    root,
    ".crdd",
    "project-runtime",
    "integration",
    "project-a",
    "candidate-a.json",
  );
  assert.equal(fs.existsSync(target), true);
  assert.equal(
    JSON.parse(fs.readFileSync(target, "utf8")).identity,
    "candidate-a",
  );
});

test("an identity collision is blocked without replacing the first record", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const first = {
    kind: "adoption" as const,
    identity: "receipt-a",
    value: { afterRevision: "a".repeat(40) },
  };
  assert.equal(records.write(first).status, "completed");
  const collision = records.write({
    ...first,
    value: { afterRevision: "b".repeat(40) },
  });
  assert.equal(collision.status, "blocked");
  assert.equal(
    collision.status === "blocked" && collision.manualRecoveryRequired,
    true,
  );
});

test("invalid path identities fail before creating a record directory", (t) => {
  const { root } = fixture(t);
  const escaped = `escape-${path.basename(root)}`;
  const outside = path.join(root, "..", escaped);
  const result = adapter(root, `../${escaped}`).write({
    kind: "integration",
    identity: "candidate-a",
    value: {},
  });
  assert.equal(result.status, "blocked");
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  assert.equal(fs.existsSync(outside), false);
});
