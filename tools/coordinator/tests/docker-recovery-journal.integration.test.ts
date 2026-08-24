import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  dockerRecoveryCommitName,
  isDockerRecoveryJournalTemporaryName,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  writeCommittedDockerRecoveryJson,
} from "../src/security/docker-recovery-journal.ts";
import { inspectDockerRecoveryRootSnapshot } from "../src/security/docker-recovery-runtime.ts";

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

function createRecoveryRecord(
  root: string,
  stableLogicalHomeBindingHash: string,
  nonce: string,
) {
  const operationDirectory = path.join(root, `docker-task-${nonce}`);
  fs.mkdirSync(operationDirectory);
  const hostNonce = "12345678-1234-1234-1234-123456789abc";
  const hostHash = "a".repeat(64);
  const initialHostRecoveryId = `host.crdd-coordinator-doctor-fixture.${hostNonce}.${hostHash}`;
  const base = Object.freeze({
    schema: "crdd-coordinator-task-docker-recovery/v1",
    operationNonce: nonce,
    provider: "claude",
    operationId: "OP-123456",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
    stableLogicalHomeBindingHash,
    providerHomeIdentityHash: "1".repeat(64),
    providerHomeProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    ownershipLabel: `crdd.coordinator.runtime=${"4".repeat(16)}`,
    resources: Object.freeze({
      auth: `crdd-auth-${"1".repeat(16)}`,
      provider: `crdd-claude-${"2".repeat(16)}`,
      proxy: `crdd-proxy-${"3".repeat(16)}`,
      internal: `crdd-internal-${"4".repeat(16)}`,
      egress: `crdd-egress-${"5".repeat(16)}`,
    }),
    images: Object.freeze({
      provider: `sha256:${"6".repeat(64)}`,
      proxy: `sha256:${"7".repeat(64)}`,
    }),
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId,
    initialHostRecovery: Object.freeze({
      token: initialHostRecoveryId,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: Object.freeze({
        schema: "crdd-coordinator-host-recovery/v1",
        state: "host_only",
        rootName: "crdd-coordinator-doctor-fixture",
        rootIdentity: Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
        childIdentities: Object.freeze({
          management: Object.freeze({
            pathName: "management",
            dev: "1",
            ino: "3",
            birthtimeNs: "4",
          }),
        }),
        createdAt: "2026-08-25T00:00:00.000Z",
      }),
    }),
    hostPaths: Object.freeze({
      root: path.join(root, "crdd-coordinator-doctor-fixture"),
      marker: path.join(root, `host-${"8".repeat(64)}.json`),
    }),
  });
  const baseRecord = writeCommittedDockerRecoveryJson(
    operationDirectory,
    "base.json",
    "base.json",
    base,
  );
  const recoveryId = `docker-task.${stableLogicalHomeBindingHash}.${nonce}.${baseRecord.hash}`;
  writeCommittedDockerRecoveryJson(
    operationDirectory,
    "base-commit.json",
    "base-commit.json",
    Object.freeze({
      schema: "crdd-coordinator-task-docker-base-commit/v1",
      operationNonce: nonce,
      stableLogicalHomeBindingHash,
      baseHash: baseRecord.hash,
      recoveryId,
    }),
  );
  return Object.freeze({
    recoveryId,
    baseHash: baseRecord.hash,
    operationDirectory,
  });
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

test("production共用inventoryは複数recordをactive pointer優先で安全投影する", () => {
  const root = temporaryDirectory();
  try {
    const first = createRecoveryRecord(root, "8".repeat(64), "a".repeat(64));
    const second = createRecoveryRecord(root, "9".repeat(64), "b".repeat(64));
    writeCommittedDockerRecoveryJson(
      root,
      `active-lease-${"9".repeat(64)}.json`,
      `active-lease-${"9".repeat(64)}.json`,
      Object.freeze({
        schema: "crdd-coordinator-provider-home-active-lease/v1",
        stableLogicalHomeBindingHash: "9".repeat(64),
        operationName: `docker-task-${"b".repeat(64)}`,
        recoveryId: second.recoveryId,
        baseHash: second.baseHash,
      }),
    );
    const inventory = inspectDockerRecoveryRootSnapshot(root);
    assert.equal(inventory.status, "completed");
    assert.deepEqual(inventory.dockerRecoveryIds, [
      second.recoveryId,
      first.recoveryId,
    ]);
    assert.deepEqual(inventory.activeStableLogicalHomeBindingHashes, [
      "9".repeat(64),
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("production共用inventoryはunknownと未commit finalを削除せずglobal blockする", () => {
  for (const entryName of ["unknown.bin", "orphan.json"] as const) {
    const root = temporaryDirectory();
    try {
      fs.writeFileSync(path.join(root, entryName), "fixture", "utf8");
      const inventory = inspectDockerRecoveryRootSnapshot(root);
      assert.equal(inventory.status, "blocked");
      assert.equal(inventory.manualRecoveryRequired, true);
      assert.equal(fs.existsSync(path.join(root, entryName)), true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("cleanup tombstoneのpartial既知entryは同じRecovery IDとして列挙する", () => {
  const root = temporaryDirectory();
  try {
    const stable = "8".repeat(64);
    const nonce = "a".repeat(64);
    const baseHash = "b".repeat(64);
    const cleanupDirectory = path.join(
      root,
      `cleanup-docker-task-${stable}-${nonce}-${baseHash}`,
    );
    fs.mkdirSync(cleanupDirectory);
    fs.writeFileSync(
      path.join(cleanupDirectory, "base.json.crdd-commit.json"),
      "partial",
      "utf8",
    );
    const inventory = inspectDockerRecoveryRootSnapshot(root);
    assert.equal(inventory.status, "completed");
    assert.deepEqual(inventory.dockerRecoveryIds, [
      `docker-task.${stable}.${nonce}.${baseHash}`,
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
