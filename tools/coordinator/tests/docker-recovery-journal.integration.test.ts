import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  dockerRecoveryCommitName,
  describeDockerRecoveryJournalContract,
  discoverDockerRecoveryJournalJson,
  discoverDockerRecoveryJournalJsonForRecovery,
  inspectDockerRecoveryJournalDirectory,
  isDockerRecoveryJournalTemporaryName,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  removeExactUncommittedDockerRecoveryJson,
  resumeDockerRecoveryJournalDirectoryForRecovery,
  resumeDockerRecoveryJournalDirectory,
  writeCommittedDockerRecoveryJson,
} from "../src/security/docker-recovery-journal.ts";

const scopedRuntimeStateBinding = Object.freeze({
  runtimeStateIdentityHash: "1".repeat(64),
  runtimeStateProtectionHash: "2".repeat(64),
  localUserBindingHash: "3".repeat(64),
  runtimeStateBindingHash: "4".repeat(64),
});

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "crdd-docker-journal-test-"));
}

function crashWriter(
  directory: string,
  boundary: "fsync" | "rename-1" | "rename-2",
) {
  const moduleUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    const boundary = process.argv[2];
    let fsyncCount = 0;
    let renameCount = 0;
    const originalFsync = fs.fsyncSync;
    const originalRename = fs.renameSync;
    fs.fsyncSync = (...args) => {
      const value = originalFsync(...args);
      fsyncCount += 1;
      if (boundary === "fsync" && fsyncCount === 1) process.kill(process.pid, "SIGKILL");
      return value;
    };
    fs.renameSync = (...args) => {
      const value = originalRename(...args);
      renameCount += 1;
      if (boundary === "rename-1" && renameCount === 1) process.kill(process.pid, "SIGKILL");
      if (boundary === "rename-2" && renameCount === 2) process.kill(process.pid, "SIGKILL");
      return value;
    };
    const journal = await import(${JSON.stringify(moduleUrl)});
    journal.writeCommittedDockerRecoveryJson(
      process.argv[1],
      "record.json",
      "record.json",
      { schema: "fixture/v1", value: true },
    );
  `;
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      source,
      directory,
      boundary,
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

function crashMutation(
  root: string,
  operation: "delete" | "move" | "cleanup",
  boundary:
    | "fsync"
    | "rename-1"
    | "rename-2"
    | "rename-3"
    | "rm-1"
    | "rm-2"
    | "rmdir",
) {
  const moduleUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    import path from "node:path";
    const root = process.argv[1];
    const operation = process.argv[2];
    const boundary = process.argv[3];
    const journal = await import(${JSON.stringify(moduleUrl)});
    const sourceDirectory = path.join(root, "source");
    const targetDirectory = path.join(root, "target");
    fs.mkdirSync(sourceDirectory);
    if (operation === "move") fs.mkdirSync(targetDirectory);
    const written = journal.writeCommittedDockerRecoveryJson(
      sourceDirectory,
      "record.json",
      "record.json",
      { schema: "fixture/v1", value: true },
    );
    if (operation === "cleanup") {
      fs.mkdirSync(path.join(sourceDirectory, "empty"));
    }
    let fsyncCount = 0;
    let renameCount = 0;
    let rmCount = 0;
    let rmdirCount = 0;
    const originalFsync = fs.fsyncSync;
    const originalRename = fs.renameSync;
    const originalRm = fs.rmSync;
    const originalRmdir = fs.rmdirSync;
    fs.fsyncSync = (...args) => {
      const result = originalFsync(...args);
      fsyncCount += 1;
      if (boundary === "fsync" && fsyncCount === 1) process.kill(process.pid, "SIGKILL");
      return result;
    };
    fs.renameSync = (...args) => {
      const result = originalRename(...args);
      renameCount += 1;
      if (boundary === "rename-" + renameCount) process.kill(process.pid, "SIGKILL");
      return result;
    };
    fs.rmSync = (...args) => {
      const result = originalRm(...args);
      rmCount += 1;
      if (boundary === "rm-" + rmCount) process.kill(process.pid, "SIGKILL");
      return result;
    };
    fs.rmdirSync = (...args) => {
      const result = originalRmdir(...args);
      rmdirCount += 1;
      if (boundary === "rmdir" && rmdirCount === 2) process.kill(process.pid, "SIGKILL");
      return result;
    };
    if (operation === "delete") {
      journal.removeCommittedDockerRecoveryJson(written.target);
    } else if (operation === "move") {
      journal.moveCommittedDockerRecoveryJson(
        written,
        path.join(targetDirectory, "record.json"),
      );
    } else {
      journal.removeDockerRecoveryCleanupDirectory(
        root,
        sourceDirectory,
        "docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}",
        {
          runtimeStateIdentityHash: "4".repeat(64),
          runtimeStateProtectionHash: "5".repeat(64),
          localUserBindingHash: "6".repeat(64),
          runtimeStateBindingHash: "7".repeat(64),
        },
      );
    }
  `;
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      source,
      root,
      operation,
      boundary,
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

function crashScopedCleanup(root: string, discriminator: "a" | "b") {
  const moduleUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    import path from "node:path";
    const journal = await import(${JSON.stringify(moduleUrl)});
    const discriminator = process.argv[2];
    const cleanup = path.join(process.argv[1], "cleanup-" + discriminator);
    fs.mkdirSync(cleanup);
    fs.writeFileSync(path.join(cleanup, "payload.json"), "{}\\n", "utf8");
    const originalRm = fs.rmSync;
    fs.rmSync = (...args) => {
      originalRm(...args);
      process.kill(process.pid, "SIGKILL");
    };
    journal.removeDockerRecoveryCleanupDirectory(
      process.argv[1],
      cleanup,
      "docker-task." + discriminator.repeat(64) + "." + discriminator.repeat(64) + "." + discriminator.repeat(64),
      ${JSON.stringify(scopedRuntimeStateBinding)},
    );
  `;
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      source,
      root,
      discriminator,
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

function crashRecoveryIdentityIntent(
  root: string,
  operation: "base_move" | "base_commit_move" | "pointer_delete",
  discriminator: "1" | "a" | "b" = "1",
) {
  const moduleUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const stable = discriminator.repeat(64);
  const nonce = (discriminator === "1" ? "2" : discriminator).repeat(64);
  const source = `
    import fs from "node:fs";
    import path from "node:path";
    const journal = await import(${JSON.stringify(moduleUrl)});
    const root = process.argv[1];
    const operation = process.argv[2];
    const stable = ${JSON.stringify(stable)};
    const nonce = ${JSON.stringify(nonce)};
    const runtimeStateBinding = ${JSON.stringify(scopedRuntimeStateBinding)};
    if (operation === "base_move") {
      const target = path.join(root, "docker-task-" + nonce);
      fs.mkdirSync(target);
      const record = journal.writeCommittedDockerRecoveryJson(
        root,
        "pending-docker-task-" + nonce + ".json",
        "base.json",
        { schema: "crdd-coordinator-task-docker-recovery/v1", operationNonce: nonce, stableLogicalHomeBindingHash: stable, runtimeStateBinding },
      );
      const originalRename = fs.renameSync;
      fs.renameSync = (...args) => {
        const result = originalRename(...args);
        process.kill(process.pid, "SIGKILL");
        return result;
      };
      journal.moveCommittedDockerRecoveryJson(record, path.join(target, "base.json"));
    } else if (operation === "base_commit_move") {
      const operationDirectory = path.join(root, "docker-task-" + nonce);
      fs.mkdirSync(operationDirectory);
      const base = journal.writeCommittedDockerRecoveryJson(
        operationDirectory,
        "base.json",
        "base.json",
        { schema: "crdd-coordinator-task-docker-recovery/v1", operationNonce: nonce, stableLogicalHomeBindingHash: stable, runtimeStateBinding },
      );
      const recoveryId = "docker-task." + stable + "." + nonce + "." + base.hash;
      const record = journal.writeCommittedDockerRecoveryJson(
        root,
        "pending-docker-task-" + nonce + ".commit.json",
        "base-commit.json",
        { schema: "crdd-coordinator-task-docker-base-commit/v1", operationNonce: nonce, stableLogicalHomeBindingHash: stable, baseHash: base.hash, recoveryId },
      );
      const originalRename = fs.renameSync;
      let renameCount = 0;
      fs.renameSync = (...args) => {
        const result = originalRename(...args);
        renameCount += 1;
        if (renameCount === 2) process.kill(process.pid, "SIGKILL");
        return result;
      };
      journal.moveCommittedDockerRecoveryJson(
        record,
        path.join(operationDirectory, "base-commit.json"),
      );
    } else {
      const operationDirectory = path.join(root, "docker-task-" + nonce);
      fs.mkdirSync(operationDirectory);
      const base = journal.writeCommittedDockerRecoveryJson(
        operationDirectory,
        "base.json",
        "base.json",
        { schema: "crdd-coordinator-task-docker-recovery/v1", operationNonce: nonce, stableLogicalHomeBindingHash: stable, runtimeStateBinding },
      );
      const recoveryId = "docker-task." + stable + "." + nonce + "." + base.hash;
      const name = "active-lease-" + stable + ".json";
      journal.writeCommittedDockerRecoveryJson(root, name, name, {
        schema: "crdd-coordinator-provider-home-active-lease/v1",
        stableLogicalHomeBindingHash: stable,
        operationName: "docker-task-" + nonce,
        recoveryId,
        baseHash: "3".repeat(64),
      });
      const originalRemove = fs.rmSync;
      fs.rmSync = (...args) => {
        const result = originalRemove(...args);
        process.kill(process.pid, "SIGKILL");
        return result;
      };
      journal.removeCommittedDockerRecoveryJson(path.join(root, name));
    }
  `;
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      source,
      root,
      operation,
      discriminator,
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

test("fsync済みtargetとcommit sidecarの完全な組だけをAuthorityとして読む", () => {
  const directory = temporaryDirectory();
  try {
    const written = writeCommittedDockerRecoveryJson(
      directory,
      "record.json",
      "record.json",
      Object.freeze({ schema: "fixture/v1", value: true }),
    );
    const read = readCommittedDockerRecoveryJson(written.target);
    assert.deepEqual(read.value, { schema: "fixture/v1", value: true });
    assert.equal(read.hash, written.hash);
    assert.equal(
      fs.existsSync(
        path.join(directory, dockerRecoveryCommitName("record.json")),
      ),
      true,
    );
    assert.equal(removeCommittedDockerRecoveryJson(written.target), true);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("target temp fsync直後のprocess killはorphan tempを保持して採用しない", () => {
  const directory = temporaryDirectory();
  try {
    const child = crashWriter(directory, "fsync");
    assert.notEqual(child.status, 0);
    const entries = fs.readdirSync(directory);
    assert.equal(entries.length, 1);
    assert.equal(isDockerRecoveryJournalTemporaryName(entries[0] ?? ""), true);
    assert.equal(fs.existsSync(path.join(directory, "record.json")), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("target rename直後のprocess killは未commit finalを保持してFail Closedにする", () => {
  const directory = temporaryDirectory();
  try {
    const child = crashWriter(directory, "rename-1");
    assert.notEqual(child.status, 0);
    const target = path.join(directory, "record.json");
    assert.equal(fs.existsSync(target), true);
    assert.equal(
      fs.existsSync(
        path.join(directory, dockerRecoveryCommitName("record.json")),
      ),
      false,
    );
    assert.throws(
      () => readCommittedDockerRecoveryJson(target),
      /docker_task_recovery_commit_missing/u,
    );
    assert.equal(fs.existsSync(target), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Effect前のexact未commit finalだけを決定論的rollbackできる", () => {
  const directory = temporaryDirectory();
  try {
    const child = crashWriter(directory, "rename-1");
    assert.notEqual(child.status, 0);
    const target = path.join(directory, "record.json");
    assert.equal(
      removeExactUncommittedDockerRecoveryJson(target, {
        schema: "fixture/v1",
        value: true,
      }),
      true,
    );
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("未commit finalの内容不一致と完全commit pairはrollbackしない", () => {
  const directory = temporaryDirectory();
  const committedDirectory = temporaryDirectory();
  try {
    const child = crashWriter(directory, "rename-1");
    assert.notEqual(child.status, 0);
    const target = path.join(directory, "record.json");
    assert.throws(
      () =>
        removeExactUncommittedDockerRecoveryJson(target, {
          schema: "fixture/v1",
          value: false,
        }),
      /docker_recovery_uncommitted_record_mismatch/u,
    );
    assert.equal(fs.existsSync(target), true);
    const committedTarget = path.join(committedDirectory, "record.json");
    writeCommittedDockerRecoveryJson(
      committedDirectory,
      "record.json",
      "record.json",
      {
        schema: "fixture/v1",
        value: true,
      },
    );
    assert.throws(
      () =>
        removeExactUncommittedDockerRecoveryJson(committedTarget, {
          schema: "fixture/v1",
          value: true,
        }),
      /docker_recovery_uncommitted_record_state_invalid/u,
    );
    assert.equal(
      readCommittedDockerRecoveryJson(committedTarget).value !== null,
      true,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    fs.rmSync(committedDirectory, { recursive: true, force: true });
  }
});

test("commit rename直後のprocess killでも親processが完全な組を再検証できる", () => {
  const directory = temporaryDirectory();
  try {
    const child = crashWriter(directory, "rename-2");
    assert.notEqual(child.status, 0);
    const target = path.join(directory, "record.json");
    const read = readCommittedDockerRecoveryJson(target);
    assert.deepEqual(read.value, { schema: "fixture/v1", value: true });
    assert.equal(read.logicalKey, "record.json");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("delete intentは全process-kill境界からexact pair削除を再開する", () => {
  for (const boundary of ["fsync", "rename-1", "rm-1", "rm-2"] as const) {
    const root = temporaryDirectory();
    try {
      const child = crashMutation(root, "delete", boundary);
      assert.notEqual(child.status, 0, boundary);
      const sourceDirectory = path.join(root, "source");
      resumeDockerRecoveryJournalDirectory(sourceDirectory);
      assert.deepEqual(fs.readdirSync(sourceDirectory), [], boundary);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("move intentはsource／targetの全既知中間状態からexact targetへ収束する", () => {
  for (const boundary of [
    "fsync",
    "rename-1",
    "rename-2",
    "rename-3",
    "rm-1",
  ] as const) {
    const root = temporaryDirectory();
    try {
      const child = crashMutation(root, "move", boundary);
      assert.notEqual(child.status, 0, boundary);
      const sourceDirectory = path.join(root, "source");
      const targetDirectory = path.join(root, "target");
      resumeDockerRecoveryJournalDirectory(sourceDirectory);
      const moved = readCommittedDockerRecoveryJson(
        path.join(targetDirectory, "record.json"),
      );
      assert.deepEqual(moved.value, { schema: "fixture/v1", value: true });
      assert.deepEqual(fs.readdirSync(sourceDirectory), [], boundary);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("cleanup root anchorはpayload部分削除からdirectory residue 0へ再開する", () => {
  for (const boundary of ["fsync", "rename-1", "rm-1", "rm-2"] as const) {
    const root = temporaryDirectory();
    try {
      const child = crashMutation(root, "cleanup", boundary);
      assert.notEqual(child.status, 0, boundary);
      resumeDockerRecoveryJournalDirectory(root);
      assert.deepEqual(fs.readdirSync(root), [], boundary);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("対象限定resumeは別Recovery IDのanchorをbyte／Identityとも変更しない", () => {
  const root = temporaryDirectory();
  try {
    assert.notEqual(crashScopedCleanup(root, "a").status, 0);
    assert.notEqual(crashScopedCleanup(root, "b").status, 0);
    const beforeJournalIntents = inspectDockerRecoveryJournalDirectory(root);
    const b = beforeJournalIntents.find(
      (intent) =>
        intent.recoveryId ===
        `docker-task.${"b".repeat(64)}.${"b".repeat(64)}.${"b".repeat(64)}`,
    );
    assert.ok(b);
    const bPath = path.join(root, b.name);
    const bBytes = fs.readFileSync(bPath);
    const bIdentity = fs.lstatSync(bPath, { bigint: true });
    assert.equal(
      resumeDockerRecoveryJournalDirectoryForRecovery(
        root,
        `docker-task.${"a".repeat(64)}.${"a".repeat(64)}.${"a".repeat(64)}`,
        scopedRuntimeStateBinding,
      ),
      true,
    );
    assert.equal(fs.existsSync(path.join(root, "cleanup-a")), false);
    assert.equal(fs.existsSync(path.join(root, "cleanup-b")), true);
    assert.deepEqual(fs.readFileSync(bPath), bBytes);
    const afterIdentity = fs.lstatSync(bPath, { bigint: true });
    assert.deepEqual(
      [afterIdentity.dev, afterIdentity.ino, afterIdentity.birthtimeNs],
      [bIdentity.dev, bIdentity.ino, bIdentity.birthtimeNs],
    );
    assert.deepEqual(
      inspectDockerRecoveryJournalDirectory(root).map(
        (intent) => intent.recoveryId,
      ),
      [`docker-task.${"b".repeat(64)}.${"b".repeat(64)}.${"b".repeat(64)}`],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("対象限定resumeは同一Recovery IDの作成時binding不一致をmutation前に拒否する", () => {
  const root = temporaryDirectory();
  try {
    assert.notEqual(crashScopedCleanup(root, "a").status, 0);
    const aIntent = inspectDockerRecoveryJournalDirectory(root)[0];
    assert.ok(aIntent);
    const aPath = path.join(root, aIntent.name);
    const before = fs.readFileSync(aPath);
    const beforeIdentity = fs.lstatSync(aPath, { bigint: true });
    assert.throws(
      () =>
        resumeDockerRecoveryJournalDirectoryForRecovery(
          root,
          `docker-task.${"a".repeat(64)}.${"a".repeat(64)}.${"a".repeat(64)}`,
          {
            ...scopedRuntimeStateBinding,
            localUserBindingHash: "f".repeat(64),
          },
        ),
      /docker_recovery_target_binding_mismatch/u,
    );
    assert.equal(fs.existsSync(path.join(root, "cleanup-a")), true);
    assert.deepEqual(fs.readFileSync(aPath), before);
    const afterIdentity = fs.lstatSync(aPath, { bigint: true });
    assert.deepEqual(
      [afterIdentity.dev, afterIdentity.ino, afterIdentity.birthtimeNs],
      [beforeIdentity.dev, beforeIdentity.ino, beforeIdentity.birthtimeNs],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("delete／moveの第三状態は上書きせずintentと観測物を保持する", () => {
  for (const [operation, boundary, replacement] of [
    ["delete", "rm-1", path.join("source", "record.json.crdd-commit.json")],
    ["move", "rename-2", path.join("target", "record.json")],
  ] as const) {
    const root = temporaryDirectory();
    try {
      const child = crashMutation(root, operation, boundary);
      assert.notEqual(child.status, 0);
      const replacementPath = path.join(root, replacement);
      fs.writeFileSync(replacementPath, "third-state", "utf8");
      if (operation === "move")
        assert.throws(
          () =>
            inspectDockerRecoveryJournalDirectory(path.join(root, "source")),
          /docker_recovery_(?:move_)?intent_third_state/u,
        );
      assert.throws(
        () => resumeDockerRecoveryJournalDirectory(path.join(root, "source")),
        /docker_recovery_(?:intent|move)_third_state/u,
      );
      assert.equal(fs.readFileSync(replacementPath, "utf8"), "third-state");
      assert.equal(
        fs
          .readdirSync(path.join(root, "source"))
          .some((name) => name.startsWith(".crdd-")),
        true,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("cleanup第三状態はrecursive deleteせずanchorとunknownを保持する", () => {
  const root = temporaryDirectory();
  try {
    const child = crashMutation(root, "cleanup", "rm-1");
    assert.notEqual(child.status, 0);
    const cleanupDirectory = path.join(root, "source");
    fs.writeFileSync(path.join(cleanupDirectory, "unknown.bin"), "unknown");
    assert.throws(
      () => resumeDockerRecoveryJournalDirectory(root),
      /docker_recovery_cleanup_intent_third_state/u,
    );
    assert.equal(
      fs.readFileSync(path.join(cleanupDirectory, "unknown.bin"), "utf8"),
      "unknown",
    );
    assert.equal(
      fs.readdirSync(root).some((name) => name.startsWith(".crdd-cleanup-")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("read-only intent inventoryはdelete／move／cleanupのAuthorityを厳密投影する", () => {
  for (const [operation, boundary] of [
    ["delete", "rm-1"],
    ["move", "rename-2"],
    ["cleanup", "rm-1"],
  ] as const) {
    const root = temporaryDirectory();
    try {
      const child = crashMutation(root, operation, boundary);
      assert.notEqual(child.status, 0);
      const directory =
        operation === "cleanup" ? root : path.join(root, "source");
      const intents = inspectDockerRecoveryJournalDirectory(directory);
      assert.equal(intents.length, 1);
      assert.equal(
        intents[0]?.schema,
        operation === "delete"
          ? "crdd-coordinator-durable-json-delete/v1"
          : operation === "move"
            ? "crdd-coordinator-durable-json-move/v1"
            : "crdd-coordinator-recovery-cleanup-delete/v1",
      );
      if (operation === "move") {
        const discovered = discoverDockerRecoveryJournalJson(
          directory,
          "record.json",
        );
        assert.deepEqual(discovered?.value, {
          schema: "fixture/v1",
          value: true,
        });
        assert.equal(
          discoverDockerRecoveryJournalJson(directory, "missing.json"),
          null,
        );
      }
      if (operation === "cleanup")
        assert.match(
          intents[0]?.recoveryId ?? "",
          /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u,
        );
      else assert.equal(intents[0]?.recoveryId, null);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("journal contractはprocess-crash回復とpower-loss非保証を分離する", () => {
  assert.deepEqual(describeDockerRecoveryJournalContract(), {
    commitSchema: "crdd-coordinator-durable-json-commit/v1",
    processCrashBoundary:
      "fsynced_temp_atomic_rename_then_fsynced_commit_atomic_rename",
    uncommittedFinalTreatment: "retain_and_fail_closed",
    orphanTemporaryTreatment: "retain_and_fail_closed",
    deleteBoundary: "single_atomic_anchor_then_target_commit_anchor",
    moveBoundary: "single_atomic_anchor_then_content_commit_anchor",
    runtimeStateResumeAuthority:
      "exact_recovery_id_and_creation_binding_non_target_unchanged",
    powerLossDurabilityClaimed: false,
  });
});

test("pending intent再入、cleanup rmdir後、競合anchorを決定的に分類する", () => {
  {
    const root = temporaryDirectory();
    try {
      assert.notEqual(crashMutation(root, "delete", "fsync").status, 0);
      const source = path.join(root, "source");
      const record = readCommittedDockerRecoveryJson(
        path.join(source, "record.json"),
      );
      assert.equal(removeCommittedDockerRecoveryJson(record.target), true);
      assert.deepEqual(fs.readdirSync(source), []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  {
    const root = temporaryDirectory();
    try {
      assert.notEqual(crashMutation(root, "cleanup", "rmdir").status, 0);
      assert.equal(fs.existsSync(path.join(root, "source")), false);
      resumeDockerRecoveryJournalDirectory(root);
      assert.deepEqual(fs.readdirSync(root), []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  {
    const root = temporaryDirectory();
    try {
      assert.notEqual(crashMutation(root, "delete", "rename-1").status, 0);
      const source = path.join(root, "source");
      const anchor = fs
        .readdirSync(source)
        .find((name) => name.startsWith(".crdd-delete-"));
      assert.ok(anchor);
      fs.copyFileSync(
        path.join(source, anchor),
        path.join(source, `${anchor}.pending`),
      );
      assert.throws(
        () => inspectDockerRecoveryJournalDirectory(source),
        /docker_recovery_intent_third_state/u,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("不正intent schemaと変更されたempty directoryをEvidenceとして保持する", () => {
  {
    const root = temporaryDirectory();
    try {
      fs.writeFileSync(
        path.join(root, `.crdd-delete-${"a".repeat(64)}.json`),
        `${JSON.stringify({ schema: "unknown/v1" })}\n`,
      );
      assert.throws(
        () => resumeDockerRecoveryJournalDirectory(root),
        /docker_recovery_intent_invalid/u,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  {
    const root = temporaryDirectory();
    try {
      assert.notEqual(crashMutation(root, "cleanup", "fsync").status, 0);
      fs.writeFileSync(path.join(root, "source", "empty", "changed"), "x");
      assert.throws(
        () => inspectDockerRecoveryJournalDirectory(root),
        /docker_recovery_cleanup_intent_third_state/u,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("intent anchorの改名、複製、commit semantic差を保持して拒否する", () => {
  for (const mutation of ["rename", "duplicate", "commit"] as const) {
    const root = temporaryDirectory();
    try {
      assert.notEqual(crashMutation(root, "delete", "rename-1").status, 0);
      const source = path.join(root, "source");
      const anchor = fs
        .readdirSync(source)
        .find((name) => name.startsWith(".crdd-delete-"));
      assert.ok(anchor);
      const anchorPath = path.join(source, anchor);
      if (mutation === "rename")
        fs.renameSync(
          anchorPath,
          path.join(source, `.crdd-delete-${"b".repeat(64)}.json`),
        );
      if (mutation === "duplicate")
        fs.copyFileSync(
          anchorPath,
          path.join(source, `.crdd-delete-${"c".repeat(64)}.json`),
        );
      if (mutation === "commit") {
        const value = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
        const commit = JSON.parse(value.pair.commitSerialized);
        commit.contentHash = "0".repeat(64);
        value.pair.commitSerialized = `${JSON.stringify(commit)}\n`;
        value.pair.commitHash = createHash("sha256")
          .update(value.pair.commitSerialized)
          .digest("hex");
        value.pair.commitBytes = Buffer.byteLength(
          value.pair.commitSerialized,
          "utf8",
        );
        fs.writeFileSync(anchorPath, `${JSON.stringify(value)}\n`);
      }
      assert.throws(
        () => inspectDockerRecoveryJournalDirectory(source),
        /docker_recovery_(?:delete_)?intent_invalid/u,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("root base／base-commit moveとpointer deleteのkill後もexact Recovery IDを再発見する", () => {
  for (const operation of [
    "base_move",
    "base_commit_move",
    "pointer_delete",
  ] as const) {
    const root = temporaryDirectory();
    try {
      assert.notEqual(crashRecoveryIdentityIntent(root, operation).status, 0);
      const intents = inspectDockerRecoveryJournalDirectory(root);
      assert.equal(intents.length, 1);
      assert.match(
        intents[0]?.recoveryId ?? "",
        /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("Root-level intent探索とresumeは全schemaでRecovery ID別にAだけを進めBを不変にする", () => {
  for (const operation of [
    "base_move",
    "base_commit_move",
    "pointer_delete",
  ] as const) {
    const root = temporaryDirectory();
    try {
      assert.notEqual(
        crashRecoveryIdentityIntent(root, operation, "a").status,
        0,
      );
      assert.notEqual(
        crashRecoveryIdentityIntent(root, operation, "b").status,
        0,
      );
      const intents = inspectDockerRecoveryJournalDirectory(root);
      const recoveryIds = intents
        .map((intent) => intent.recoveryId)
        .filter((value): value is string => value !== null)
        .sort();
      assert.equal(recoveryIds.length, 2);
      const [recoveryA, recoveryB] = recoveryIds;
      assert.ok(recoveryA);
      assert.ok(recoveryB);
      const logicalKey =
        operation === "base_move"
          ? "base.json"
          : operation === "base_commit_move"
            ? "base-commit.json"
            : `active-lease-${"a".repeat(64)}.json`;
      assert.ok(
        discoverDockerRecoveryJournalJsonForRecovery(
          root,
          logicalKey,
          recoveryA,
        ),
      );
      const bIntent = intents.find((intent) => intent.recoveryId === recoveryB);
      assert.ok(bIntent);
      const bPath = path.join(root, bIntent.name);
      const bBytes = fs.readFileSync(bPath);
      const bIdentity = fs.lstatSync(bPath, { bigint: true });
      assert.equal(
        resumeDockerRecoveryJournalDirectoryForRecovery(
          root,
          recoveryA,
          scopedRuntimeStateBinding,
        ),
        true,
      );
      assert.deepEqual(fs.readFileSync(bPath), bBytes);
      const afterBIdentity = fs.lstatSync(bPath, { bigint: true });
      assert.deepEqual(
        [afterBIdentity.dev, afterBIdentity.ino, afterBIdentity.birthtimeNs],
        [bIdentity.dev, bIdentity.ino, bIdentity.birthtimeNs],
      );
      assert.equal(
        resumeDockerRecoveryJournalDirectoryForRecovery(
          root,
          recoveryB,
          scopedRuntimeStateBinding,
        ),
        true,
      );
      assert.equal(inspectDockerRecoveryJournalDirectory(root).length, 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("Root-level base／base-commit／pointer intentはbinding不一致時に全anchorを保持する", () => {
  for (const operation of [
    "base_move",
    "base_commit_move",
    "pointer_delete",
  ] as const) {
    const root = temporaryDirectory();
    try {
      assert.notEqual(
        crashRecoveryIdentityIntent(root, operation, "a").status,
        0,
      );
      const intent = inspectDockerRecoveryJournalDirectory(root)[0];
      assert.ok(intent?.recoveryId);
      const anchor = path.join(root, intent.name);
      const before = fs.readFileSync(anchor);
      const identity = fs.lstatSync(anchor, { bigint: true });
      assert.throws(
        () =>
          resumeDockerRecoveryJournalDirectoryForRecovery(
            root,
            intent.recoveryId as string,
            {
              ...scopedRuntimeStateBinding,
              localUserBindingHash: "f".repeat(64),
            },
          ),
        /docker_recovery_target_binding_mismatch/u,
      );
      assert.deepEqual(fs.readFileSync(anchor), before);
      const after = fs.lstatSync(anchor, { bigint: true });
      assert.deepEqual(
        [after.dev, after.ino, after.birthtimeNs],
        [identity.dev, identity.ino, identity.birthtimeNs],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
