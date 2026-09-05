import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyExecutionIntelligenceRetention,
  createTaskAttemptSettledEvent,
  readExecutionIntelligence,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
  type VerifiedExecutionRepositoryRoot,
} from "../../src/index.ts";

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-execution-store-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function verifiedRoot(root: string): VerifiedExecutionRepositoryRoot {
  const observed = verifyExecutionIntelligenceRepositoryRoot(root);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("root_not_verified");
  return observed.root;
}

function eventForTask(taskId: string) {
  return createTaskAttemptSettledEvent({
    occurredAt: "2026-09-05T00:00:01.000Z",
    identity: {
      projectId: "project-a",
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId,
      attemptId: `attempt-${taskId}`,
      operationId: "operation-a",
    },
    outcome: {
      status: "completed",
      reason: "task_completed",
      effectState: "settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider: { state: "not_observed", reason: "provider_not_reported" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: {
        state: "observed",
        value: "test/input/v1",
        source: "integration_fixture",
      },
      durationMs: {
        state: "observed",
        value: 10,
        source: "integration_clock",
      },
      usage: { state: "not_observed", reason: "usage_not_reported" },
      humanActiveMs: {
        state: "not_observed",
        reason: "human_time_not_reported",
      },
    },
    quality: {
      state: "not_applicable",
      reason: "attempt_settlement_is_not_acceptance",
    },
  });
}

function event() {
  return eventForTask("task-a");
}

function runWriter(root: string, reason: string) {
  return new Promise<Readonly<{ exitCode: number | null; result: unknown }>>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          path.resolve("tests/fixtures/execution-intelligence-store-writer.ts"),
          root,
          reason,
        ],
        { cwd: path.resolve("."), stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (exitCode) => {
        if (stderr) reject(new Error(stderr));
        else resolve({ exitCode, result: JSON.parse(stdout) as unknown });
      });
    },
  );
}

test("writes immutable events under repository-local .crdd and reads a summary", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  const observed = readExecutionIntelligence(capability);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("observation_failed");
  assert.equal(observed.events.length, 1);
  assert.equal(observed.summary.eventCount, 1);
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        ".crdd",
        "execution",
        "events",
        `${created.eventId}.json`,
      ),
    ),
    true,
  );
});

test("rejects conflicting content for the same exact identity", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  const changed = {
    ...created,
    outcome: { ...created.outcome, reason: "different_reason" },
  };
  assert.equal(
    writeExecutionIntelligenceEvent(capability, changed).reason,
    "execution_event_identity_conflict",
  );
});

test("fails closed when stored content is corrupt", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(root, ".crdd", "execution", "events", `${created.eventId}.json`),
    "{}\n",
    "utf8",
  );
  assert.deepEqual(readExecutionIntelligence(capability), {
    status: "blocked",
    reason: "execution_event_store_observation_failed",
  });
});

test("does not replace a non-directory repository-local boundary", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  fs.writeFileSync(path.join(root, ".crdd"), "occupied\n", "utf8");
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_event_store_unavailable");
  assert.equal(result.effectState, "no_effect");
  assert.equal(fs.readFileSync(path.join(root, ".crdd"), "utf8"), "occupied\n");
});

test("does not hide an unknown residual file from the store result", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  assert.equal(
    writeExecutionIntelligenceEvent(capability, event()).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(root, ".crdd", "execution", "events", "unknown.pending"),
    "residual\n",
    "utf8",
  );
  assert.deepEqual(readExecutionIntelligence(capability), {
    status: "blocked",
    reason: "execution_event_store_observation_failed",
  });
});

test("cleans only exact hashes after durable evidence and no unresolved references", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  writeExecutionIntelligenceEvent(capability, created);
  const observed = readExecutionIntelligence(capability);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("observation_failed");
  assert.equal(
    applyExecutionIntelligenceRetention(capability, {
      eventHashes: {},
      unresolvedReferenceEventIds: [],
      durableEvidenceId: "evidence-a",
    }).reason,
    "execution_retention_not_safe",
  );
  assert.equal(
    applyExecutionIntelligenceRetention(capability, {
      eventHashes: observed.hashes,
      unresolvedReferenceEventIds: [created.eventId],
      durableEvidenceId: "evidence-a",
    }).reason,
    "execution_retention_not_safe",
  );
  const cleaned = applyExecutionIntelligenceRetention(capability, {
    eventHashes: observed.hashes,
    unresolvedReferenceEventIds: [],
    durableEvidenceId: "evidence-a",
  });
  assert.equal(cleaned.status, "completed");
  assert.deepEqual(cleaned.removedEventIds, [created.eventId]);
  const after = readExecutionIntelligence(capability);
  assert.equal(after.status, "completed");
  if (after.status === "completed") assert.equal(after.events.length, 0);
});

test("Repository RootはexactなVCS worktreeだけを実行時能力にする", (t) => {
  const root = fixture(t);
  const child = path.join(root, "child");
  fs.mkdirSync(child);
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(root).status,
    "completed",
  );
  assert.deepEqual(verifyExecutionIntelligenceRepositoryRoot(child), {
    status: "blocked",
    reason: "execution_repository_root_invalid",
  });
  const nonRepository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-execution-nonrepo-"),
  );
  t.after(() => fs.rmSync(nonRepository, { recursive: true, force: true }));
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(nonRepository).status,
    "blocked",
  );
  const forged = Object.freeze({
    contract: "crdd/verified-execution-repository-root/v1" as const,
  });
  assert.equal(
    writeExecutionIntelligenceEvent(forged, event()).status,
    "blocked",
  );
});

test("並行Processの同一Eventは冪等で、異なる内容は上書きしない", async (t) => {
  const sameRoot = fixture(t);
  const sameResults = await Promise.all([
    runWriter(sameRoot, "task_completed"),
    runWriter(sameRoot, "task_completed"),
  ]);
  assert.ok(sameResults.every((entry) => entry.exitCode === 0));
  assert.ok(
    sameResults.every(
      (entry) => (entry.result as { status: string }).status === "completed",
    ),
  );

  const conflictRoot = fixture(t);
  const conflictResults = await Promise.all([
    runWriter(conflictRoot, "task_completed_a"),
    runWriter(conflictRoot, "task_completed_b"),
  ]);
  const statuses = conflictResults.map(
    (entry) => (entry.result as { status: string }).status,
  );
  assert.equal(statuses.filter((status) => status === "completed").length, 1);
  assert.equal(statuses.filter((status) => status === "blocked").length, 1);
  const eventDirectory = path.join(
    conflictRoot,
    ".crdd",
    "execution",
    "events",
  );
  assert.equal(
    fs.readdirSync(eventDirectory).filter((name) => name.endsWith(".json"))
      .length,
    1,
  );
  assert.equal(
    fs.existsSync(
      path.join(conflictRoot, ".crdd", "execution", ".mutation-lock"),
    ),
    false,
  );
});

test("通常Repository・linked worktree・submoduleのexact Rootを区別する", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-execution-layout-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const primary = path.join(base, "primary");
  const source = path.join(base, "source");
  const linked = path.join(base, "linked");
  fs.mkdirSync(primary);
  execFileSync("git", ["init", "--quiet", primary], { windowsHide: true });
  fs.writeFileSync(path.join(primary, "README.md"), "primary\n", "utf8");
  execFileSync("git", ["-C", primary, "add", "README.md"], {
    windowsHide: true,
  });
  execFileSync(
    "git",
    [
      "-C",
      primary,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  execFileSync(
    "git",
    ["-C", primary, "worktree", "add", "--quiet", "-b", "linked", linked],
    { windowsHide: true },
  );

  fs.mkdirSync(source);
  execFileSync("git", ["init", "--quiet", source], { windowsHide: true });
  fs.writeFileSync(path.join(source, "README.md"), "source\n", "utf8");
  execFileSync("git", ["-C", source, "add", "README.md"], {
    windowsHide: true,
  });
  execFileSync(
    "git",
    [
      "-C",
      source,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  execFileSync(
    "git",
    [
      "-c",
      "protocol.file.allow=always",
      "-C",
      primary,
      "submodule",
      "add",
      "--quiet",
      source,
      "dependency",
    ],
    { windowsHide: true },
  );

  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(primary).status,
    "completed",
  );
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(linked).status,
    "completed",
  );
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(path.join(primary, "dependency"))
      .status,
    "completed",
  );
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(base).status,
    "blocked",
  );
});

for (const fault of ["open", "write", "flush", "publish", "readback"] as const)
  test(`Storeの${fault}失敗を成功へ丸めず資源を回収する`, (t) => {
    const root = fixture(t);
    const capability = verifiedRoot(root);
    const originalOpen = fs.openSync;
    const originalWrite = fs.writeFileSync;
    const originalFsync = fs.fsyncSync;
    const originalLink = fs.linkSync;
    const originalRead = fs.readFileSync;
    let hasObservedOwnerWrite = false;
    let hasObservedOwnerFlush = false;
    fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
      if (fault === "open" && String(target).includes("execution-pending-"))
        throw new Error("injected_open_failure");
      return Reflect.apply(originalOpen, fs, [target, ...args]);
    }) as typeof fs.openSync;
    fs.writeFileSync = ((target: unknown, ...args: unknown[]) => {
      if (typeof target === "number") {
        if (!hasObservedOwnerWrite) hasObservedOwnerWrite = true;
        else if (fault === "write") throw new Error("injected_write_failure");
      }
      return Reflect.apply(originalWrite, fs, [target, ...args]);
    }) as typeof fs.writeFileSync;
    fs.fsyncSync = ((descriptor: number) => {
      if (!hasObservedOwnerFlush) hasObservedOwnerFlush = true;
      else if (fault === "flush") throw new Error("injected_flush_failure");
      return originalFsync(descriptor);
    }) as typeof fs.fsyncSync;
    fs.linkSync = ((existingPath: fs.PathLike, newPath: fs.PathLike) => {
      if (fault === "publish") throw new Error("injected_publish_failure");
      return originalLink(existingPath, newPath);
    }) as typeof fs.linkSync;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ) => {
      if (
        fault === "readback" &&
        path.basename(String(target)).startsWith("execution-") &&
        String(target).endsWith(".json")
      )
        throw new Error("injected_readback_failure");
      return Reflect.apply(originalRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    t.after(() => {
      fs.openSync = originalOpen;
      fs.writeFileSync = originalWrite;
      fs.fsyncSync = originalFsync;
      fs.linkSync = originalLink;
      fs.readFileSync = originalRead;
    });

    const result = writeExecutionIntelligenceEvent(capability, event());
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
    assert.deepEqual(result.residualArtifactIds, []);
    assert.equal(
      fs.existsSync(path.join(root, ".crdd", "execution", ".mutation-lock")),
      false,
    );
  });

test("一時fileの回収不明はexactな残存Identityを返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalUnlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (String(target).includes("execution-pending-"))
      throw new Error("injected_pending_cleanup_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  t.after(() => {
    fs.unlinkSync = originalUnlink;
  });
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.effectState, "settled");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.residualArtifactIds.length, 1);
  assert.match(result.residualArtifactIds[0] ?? "", /^\.execution-pending-/u);
});

test("保持処理の部分失敗は削除済み・未削除を分けて返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const first = eventForTask("task-a");
  const second = eventForTask("task-b");
  assert.equal(
    writeExecutionIntelligenceEvent(capability, first).status,
    "completed",
  );
  assert.equal(
    writeExecutionIntelligenceEvent(capability, second).status,
    "completed",
  );
  const observed = readExecutionIntelligence(capability);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("observation_failed");
  const originalUnlink = fs.unlinkSync;
  let eventRemovalCount = 0;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (String(target).endsWith(".json")) {
      eventRemovalCount += 1;
      if (eventRemovalCount === 2)
        throw new Error("injected_retention_failure");
    }
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  t.after(() => {
    fs.unlinkSync = originalUnlink;
  });
  const result = applyExecutionIntelligenceRetention(capability, {
    eventHashes: observed.hashes,
    unresolvedReferenceEventIds: [],
    durableEvidenceId: "evidence-a",
  });
  const requestedIds = Object.keys(observed.hashes).sort();
  assert.equal(result?.status, "blocked");
  assert.equal(result?.effectState, "unknown");
  assert.deepEqual(result?.removedEventIds, requestedIds.slice(0, 1));
  assert.deepEqual(result?.remainingEventIds, requestedIds.slice(1));
  assert.deepEqual(result?.unobservableEventIds, []);
});

test("所有不明の残存Lockを自動奪取しない", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const executionDirectory = path.join(root, ".crdd", "execution");
  fs.mkdirSync(path.join(executionDirectory, "events"), { recursive: true });
  const lockDirectory = path.join(executionDirectory, ".mutation-lock");
  fs.mkdirSync(lockDirectory);
  fs.writeFileSync(
    path.join(lockDirectory, "owner.json"),
    '{"contract":"crdd/execution-store-lock/v1","identity":"unknown"}\n',
    "utf8",
  );
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_store_lock_unavailable");
  assert.equal(result.effectState, "no_effect");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.retryAllowed, true);
  assert.equal(fs.existsSync(lockDirectory), true);
});

test("Lock所有者の初期化失敗は回収済みとして閉じる", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalOpen = fs.openSync;
  fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
    if (path.basename(String(target)) === "owner.json")
      throw new Error("injected_lock_owner_open_failure");
    return Reflect.apply(originalOpen, fs, [target, ...args]);
  }) as typeof fs.openSync;
  let result: ReturnType<typeof writeExecutionIntelligenceEvent>;
  try {
    result = writeExecutionIntelligenceEvent(capability, event());
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_store_lock_initialization_failed");
  assert.equal(result.effectState, "no_effect");
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(result.residualArtifactIds, []);
});

test("Lock所有者の初期化と回収が失敗した場合は残存Lockを返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalFsync = fs.fsyncSync;
  const originalUnlink = fs.unlinkSync;
  fs.fsyncSync = (() => {
    throw new Error("injected_lock_owner_flush_failure");
  }) as typeof fs.fsyncSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (path.basename(String(target)) === "owner.json")
      throw new Error("injected_lock_owner_cleanup_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  let result: ReturnType<typeof writeExecutionIntelligenceEvent>;
  try {
    result = writeExecutionIntelligenceEvent(capability, event());
  } finally {
    fs.fsyncSync = originalFsync;
    fs.unlinkSync = originalUnlink;
  }
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_store_lock_initialization_failed");
  assert.equal(result.effectState, "no_effect");
  assert.equal(result.cleanupConfirmed, false);
  assert.deepEqual(result.residualArtifactIds, [
    "execution-store-mutation-lock",
  ]);
});

test("Lock解放不明はEvent成立と残存Lockを分けて返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalUnlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (path.basename(String(target)) === "owner.json")
      throw new Error("injected_lock_release_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  t.after(() => {
    fs.unlinkSync = originalUnlink;
  });
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.effectState, "settled");
  assert.equal(result.cleanupConfirmed, false);
  assert.deepEqual(result.residualArtifactIds, [
    "execution-store-mutation-lock",
  ]);
});

test("Repository Rootへのlink経由は実行時能力にしない", (t) => {
  const root = fixture(t);
  const link = path.join(os.tmpdir(), `crdd-execution-link-${randomUUID()}`);
  t.after(() => fs.rmSync(link, { recursive: true, force: true }));
  try {
    fs.symlinkSync(
      root,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("symlink_or_junction_creation_not_permitted");
      return;
    }
    throw error;
  }
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(link).status,
    "blocked",
  );
});
