import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  enqueueProjectOperation,
  readProjectOperationQueueState,
  selectNextProjectOperation,
  updateProjectOperationQueueState,
} from "../src/security/project-runtime-durable-foundation.ts";

const revision = "a".repeat(40);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
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
