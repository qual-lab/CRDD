import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderDockerRecoveryDoctorReport } from "../src/core/docker-recovery-command-report.ts";
import { assertRuntimeTraceCase } from "./runtime-trace-case.ts";
import {
  dockerRecoveryCommitName,
  inspectDockerRecoveryJournalDirectory,
  moveCommittedDockerRecoveryJson,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  resumeDockerRecoveryJournalDirectoryForRecovery,
  writeCommittedDockerRecoveryJson,
} from "../src/security/docker-recovery-journal.ts";
import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "../src/security/candidate-store-kernel-lock.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver,
  classifyRuntimeOwnedDockerRecoveryEvidence,
  completeRuntimeOwnedDockerRecovery,
  createIsolatedDockerRecoveryRuntimeCandidate,
  describeDockerRecoveryRuntimeContract,
  finalizeRuntimeOwnedDockerRecovery,
  inspectDockerRecoveryRootSnapshotWithLock,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedDockerHostCleanupReceipt,
  recordRuntimeOwnedNormalMountCompletion,
  recoverExactDockerResourceWithRunner,
  recoverUnknownDockerCreateOutcomeWithRunner,
  recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver,
} from "../src/security/docker-recovery-runtime-internal.ts";
import {
  acquireHostOperationRecoveryGenerationByIdentity,
  abandonOwnedHostOperationGenerationLock,
  classifyOwnedOperationDirectoryCreationFailure,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementCapability,
} from "../src/security/execution-environment.ts";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "../src/security/host-recovery-record.ts";

const RECOVERY_TRACE_ASSERTIONS: Readonly<
  Record<string, typeof assertRuntimeTraceCase>
> = Object.freeze({
  "CASE-PARTIAL-PAIR-TO-RECOVERY": assertRuntimeTraceCase,
  "CASE-RECOVERY-TO-RECOVERED": assertRuntimeTraceCase,
});

const FIRST_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const stableHome = "1".repeat(64);
const operationNonce = "2".repeat(64);
const baseHash = "3".repeat(64);
const dockerTaskRecoveryId = `docker-task.${stableHome}.${operationNonce}.${baseHash}`;

test("Operation Directory生成primitiveはEffect前失敗とrollback確認済み失敗をopaque分類する", () => {
  const missingParent = path.join(
    os.tmpdir(),
    `crdd-missing-operation-parent-${Date.now()}-${process.pid}`,
  );
  assert.throws(
    () => createOwnedOperationDirectories(missingParent),
    (error) => {
      assert.deepEqual(classifyOwnedOperationDirectoryCreationFailure(error), {
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        hostRecoveryId: null,
      });
      return true;
    },
  );

  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-creation-failure-test-"),
  );
  try {
    fs.writeFileSync(path.join(parent, "crdd-coordinator-recovery-v1"), "x");
    assert.throws(
      () => createOwnedOperationDirectories(parent),
      (error) => {
        assert.deepEqual(
          classifyOwnedOperationDirectoryCreationFailure(error),
          {
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            hostRecoveryId: null,
          },
        );
        return true;
      },
    );
    assert.deepEqual(
      fs
        .readdirSync(parent)
        .filter((name) => name.startsWith("crdd-coordinator-doctor-")),
      [],
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("公開Recovery Evidence分類はfresh inventoryの存在・不存在・不明を三状態へ固定する", () => {
  assert.equal(
    classifyRuntimeOwnedDockerRecoveryEvidence(
      { status: "completed", dockerRecoveryIds: [dockerTaskRecoveryId] },
      dockerTaskRecoveryId,
    ),
    "preserved",
  );
  assert.equal(
    classifyRuntimeOwnedDockerRecoveryEvidence(
      { status: "completed", dockerRecoveryIds: [] },
      dockerTaskRecoveryId,
    ),
    "not_preserved",
  );
  assert.equal(
    classifyRuntimeOwnedDockerRecoveryEvidence(
      { status: "blocked", dockerRecoveryIds: [dockerTaskRecoveryId] },
      dockerTaskRecoveryId,
    ),
    "unknown",
  );
});

function consentRecord(boundary: string, generation: string) {
  return Object.freeze({
    schema: "crdd-coordinator/external-send-consent/v2",
    consentBoundaryHash: boundary,
    policyId: "fixture/policy/v1",
    sourceFileHash: "8".repeat(64),
    informationClassification: "public",
    providerBoundaries: Object.freeze([]),
    localUserBindingHash: "6".repeat(64),
    runtimeStateIdentityHash: "4".repeat(64),
    runtimeStateProtectionHash: "5".repeat(64),
    runtimeStateBindingHash: "7".repeat(64),
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    generation,
    confirmedAtEpochMs: 1_000_000,
    expiresAtEpochMs: 2_000_000,
  });
}

test("RuntimeState inventoryは単一Active同意だけの正常状態をDocker recovery cleanと判定する", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-consent-only-runtime-state-"),
  );
  const boundary = "a".repeat(64);
  const generation = "b".repeat(16);
  const name = `external-send-consent-active-v2-${boundary}-${generation}.json`;
  try {
    writeCommittedDockerRecoveryJson(
      rootPath,
      name,
      name,
      consentRecord(boundary, generation),
    );
    const result = inspectDockerRecoveryRootSnapshotWithLock(
      verifiedRoot(rootPath),
      () => Object.freeze({ release: () => true }),
    );
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.equal(result.reason, "docker_task_runtime_state_clean");
    assert.equal(result.manualRecoveryRequired, false);
    assert.equal(result.dockerRecoveryId, null);
    assert.deepEqual(result.dockerRecoveryIds, []);
    assert.deepEqual(result.activeStableLogicalHomeBindingHashes, []);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("RuntimeState inventoryは単一Active同意とDocker状態を共存させ複数同意を拒否する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const firstBoundary = "a".repeat(64);
  const firstGeneration = "b".repeat(16);
  const firstName = `external-send-consent-active-v2-${firstBoundary}-${firstGeneration}.json`;
  try {
    writeCommittedDockerRecoveryJson(
      fixture.root,
      firstName,
      firstName,
      consentRecord(firstBoundary, firstGeneration),
    );
    const single = inspectDockerRecoveryRootSnapshotWithLock(root, () =>
      Object.freeze({ release: () => true }),
    );
    assert.equal(single.status, "completed");
    assert.deepEqual(single.dockerRecoveryIds, [fixture.recoveryId]);

    const secondBoundary = "c".repeat(64);
    const secondGeneration = "d".repeat(16);
    const secondName = `external-send-consent-active-v2-${secondBoundary}-${secondGeneration}.json`;
    writeCommittedDockerRecoveryJson(
      fixture.root,
      secondName,
      secondName,
      consentRecord(secondBoundary, secondGeneration),
    );
    assert.equal(
      inspectDockerRecoveryRootSnapshotWithLock(root, () =>
        Object.freeze({ release: () => true }),
      ).status,
      "blocked",
    );
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

function verifiedRoot(rootPath: string) {
  return Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "4".repeat(64),
    runtimeStateProtectionHash: "5".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: "7".repeat(64),
  });
}

function productionPlan(operationId: string, stableHome: string) {
  return Object.freeze({
    provider: "claude" as const,
    operationId,
    grantRef: "PHMGRANT-123456",
    profileId: "PROFILE-123456",
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: stableHome,
    authContainerName: "crdd-auth-0123456789abcdef",
    providerContainerName: "crdd-claude-0123456789abcdef",
    proxyContainerName: "crdd-proxy-0123456789abcdef",
    internalNetworkName: "crdd-internal-0123456789abcdef",
    egressNetworkName: "crdd-egress-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    operationMode: "isolated_task" as const,
    workspaceMountMode: "read_write" as const,
  });
}

function providerHomeForPlan(plan: ReturnType<typeof productionPlan>) {
  return Object.freeze({
    providerHomeIdentityHash: plan.providerHomeIdentityHash,
    providerHomeProtectionHash: plan.providerHomeProtectionHash,
    localUserBindingHash: plan.localUserBindingHash,
    stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
  });
}

function addSplitRootBaseMove(
  root: string,
  discriminator: "a" | "b",
  move:
    | "pending_base_only"
    | "pending_pairs"
    | "empty_directory"
    | "base"
    | "base_complete"
    | "base_commit"
    | "full" = "base",
  stableDiscriminator: "a" | "b" | "c" = discriminator,
  killAfterRename: 1 | 2 | 3 = 2,
) {
  const stable = stableDiscriminator.repeat(64);
  const nonce = discriminator.repeat(64);
  const hostHash = "f".repeat(64);
  const initialHostRecoveryId = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${hostHash}`;
  const base = Object.freeze({
    schema: "crdd-coordinator-task-docker-recovery/v1",
    operationNonce: nonce,
    provider: "claude",
    operationId: "OP-123456",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
    stableLogicalHomeBindingHash: stable,
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    runtimeStateBinding: Object.freeze({
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash: "6".repeat(64),
      runtimeStateBindingHash: "7".repeat(64),
    }),
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: Object.freeze({
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    }),
    images: Object.freeze({
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
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
    hostPaths: Object.freeze({ root: "host-root", marker: "host-marker" }),
  });
  const operationDirectory = path.join(root, `docker-task-${nonce}`);
  if (move !== "pending_base_only" && move !== "pending_pairs")
    fs.mkdirSync(operationDirectory);
  const baseRecord = writeCommittedDockerRecoveryJson(
    move === "base" ||
      move === "base_complete" ||
      move === "pending_base_only" ||
      move === "pending_pairs" ||
      move === "empty_directory"
      ? root
      : operationDirectory,
    move === "base" ||
      move === "base_complete" ||
      move === "pending_base_only" ||
      move === "pending_pairs" ||
      move === "empty_directory"
      ? `pending-docker-task-${nonce}.json`
      : "base.json",
    "base.json",
    base,
  );
  const recoveryId = `docker-task.${stable}.${nonce}.${baseRecord.hash}`;
  if (move === "pending_base_only") return recoveryId;
  const pendingCommit = writeCommittedDockerRecoveryJson(
    root,
    `pending-docker-task-${nonce}.commit.json`,
    "base-commit.json",
    Object.freeze({
      schema: "crdd-coordinator-task-docker-base-commit/v1",
      operationNonce: nonce,
      stableLogicalHomeBindingHash: stable,
      baseHash: baseRecord.hash,
      recoveryId,
    }),
  );
  if (move === "full") {
    moveCommittedDockerRecoveryJson(
      pendingCommit,
      path.join(operationDirectory, "base-commit.json"),
    );
    return recoveryId;
  }
  if (move === "pending_pairs" || move === "empty_directory") return recoveryId;
  if (move === "base_complete") {
    moveCommittedDockerRecoveryJson(
      baseRecord,
      path.join(operationDirectory, "base.json"),
    );
    return recoveryId;
  }
  const source = move === "base" ? baseRecord : pendingCommit;
  const target = path.join(
    operationDirectory,
    move === "base" ? "base.json" : "base-commit.json",
  );
  const originalRename = fs.renameSync;
  let renameCount = 0;
  Reflect.set(fs, "renameSync", (...args: Parameters<typeof fs.renameSync>) => {
    originalRename(...args);
    renameCount += 1;
    if (renameCount === killAfterRename)
      throw new Error("simulated_process_kill_after_content_move");
  });
  try {
    assert.throws(
      () => moveCommittedDockerRecoveryJson(source, target),
      /simulated_process_kill_after_content_move/u,
    );
  } finally {
    Reflect.set(fs, "renameSync", originalRename);
  }
  return recoveryId;
}

function snapshotRecoveryTree(root: string) {
  const snapshots: Array<
    Readonly<{
      name: string;
      type: "directory" | "file";
      bytes: Buffer | null;
      identity: readonly [bigint, bigint, bigint];
    }>
  > = [];
  const visit = (directory: string) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const target = path.join(directory, entry.name);
      const metadata = fs.lstatSync(target, { bigint: true });
      const name = path.relative(root, target);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        snapshots.push(
          Object.freeze({
            name,
            type: "directory" as const,
            bytes: null,
            identity: [
              metadata.dev,
              metadata.ino,
              metadata.birthtimeNs,
            ] as const,
          }),
        );
        visit(target);
        continue;
      }
      assert.equal(entry.isFile() && !entry.isSymbolicLink(), true);
      snapshots.push(
        Object.freeze({
          name,
          type: "file" as const,
          bytes: fs.readFileSync(target),
          identity: [metadata.dev, metadata.ino, metadata.birthtimeNs] as const,
        }),
      );
    }
  };
  visit(root);
  return Object.freeze(snapshots);
}

function copyCommittedJsonWithFreshIdentity(
  source: string,
  target: string,
  logicalKey: string,
) {
  fs.copyFileSync(source, target);
  const serialized = fs.readFileSync(target, "utf8");
  const identity = fs.lstatSync(target, { bigint: true });
  fs.writeFileSync(
    `${target}.crdd-commit.json`,
    `${JSON.stringify({
      schema: "crdd-coordinator-durable-json-commit/v1",
      logicalKey,
      contentHash: createHash("sha256").update(serialized).digest("hex"),
      contentIdentity: `${identity.dev}:${identity.ino}:${identity.birthtimeNs}`,
      contentBytes: Buffer.byteLength(serialized, "utf8"),
    })}\n`,
    "utf8",
  );
}

function addActivePointer(root: string, recoveryId: string) {
  const [, stable, nonce, baseHash] = recoveryId.split(".");
  assert.ok(stable && nonce && baseHash);
  writeCommittedDockerRecoveryJson(
    root,
    `active-lease-${stable}.json`,
    `active-lease-${stable}.json`,
    Object.freeze({
      schema: "crdd-coordinator-provider-home-active-lease/v1",
      stableLogicalHomeBindingHash: stable,
      operationName: `docker-task-${nonce}`,
      recoveryId,
      baseHash,
    }),
  );
}

function leaveCommittedPairMoveAnchor(
  root: string,
  recoveryId: string,
  logicalKey: "base.json" | "base-commit.json",
) {
  const nonce = recoveryId.split(".")[2];
  assert.ok(nonce);
  const operationDirectory = path.join(root, `docker-task-${nonce}`);
  const target = path.join(operationDirectory, logicalKey);
  const pending = path.join(
    root,
    logicalKey === "base.json"
      ? `pending-docker-task-${nonce}.json`
      : `pending-docker-task-${nonce}.commit.json`,
  );
  fs.renameSync(target, pending);
  fs.renameSync(
    dockerRecoveryCommitName(target),
    dockerRecoveryCommitName(pending),
  );
  const source = readCommittedDockerRecoveryJson(pending, logicalKey);
  const originalRename = fs.renameSync;
  let renameCount = 0;
  Reflect.set(fs, "renameSync", (...args: Parameters<typeof fs.renameSync>) => {
    originalRename(...args);
    renameCount += 1;
    if (renameCount === 3)
      throw new Error("simulated_process_kill_after_pair_move");
  });
  try {
    assert.throws(
      () => moveCommittedDockerRecoveryJson(source, target),
      /simulated_process_kill_after_pair_move/u,
    );
  } finally {
    Reflect.set(fs, "renameSync", originalRename);
  }
}

function leaveActivePointerDeleteJournal(root: string, recoveryId: string) {
  const stable = recoveryId.split(".")[1];
  assert.ok(stable);
  const pointer = path.join(root, `active-lease-${stable}.json`);
  const originalRm = fs.rmSync;
  let removeCount = 0;
  Reflect.set(fs, "rmSync", (...args: Parameters<typeof fs.rmSync>) => {
    const result = originalRm(...args);
    removeCount += 1;
    if (removeCount === 1)
      throw new Error("simulated_process_kill_during_pointer_delete");
    return result;
  });
  try {
    assert.throws(
      () => removeCommittedDockerRecoveryJson(pointer),
      /simulated_process_kill_during_pointer_delete/u,
    );
  } finally {
    Reflect.set(fs, "rmSync", originalRm);
  }
}

function addPointerReleaseEvidence(
  root: string,
  recoveryId: string,
  name:
    | "lease-release-receipt.json"
    | "normal-run-complete.json"
    | "host-cleanup-intent.json"
    | "host-cleanup-receipt.json",
) {
  const nonce = recoveryId.split(".")[2];
  assert.ok(nonce);
  const operationDirectory = path.join(root, `docker-task-${nonce}`);
  const values = {
    "lease-release-receipt.json": Object.freeze({
      schema: "crdd-coordinator-provider-home-lease-release/v1",
      recoveryId,
      pointerAbsent: true,
    }),
    "normal-run-complete.json": Object.freeze({
      schema: "crdd-coordinator-docker-run-completion/v1",
      recoveryId,
      hostSuccessor: "host-successor-fixture",
    }),
    "host-cleanup-intent.json": Object.freeze({
      schema: "crdd-coordinator-host-cleanup-intent/v1",
      recoveryId,
      currentHostRecoveryId: "host-cleanup-fixture",
    }),
    "host-cleanup-receipt.json": Object.freeze({
      schema: "crdd-coordinator-host-cleanup-receipt/v1",
      recoveryId,
      hostRootAbsent: true,
      hostMarkerAbsent: true,
    }),
  } as const;
  writeCommittedDockerRecoveryJson(
    operationDirectory,
    name,
    name,
    values[name],
  );
}

function addKilledProductionCleanup(
  root: string,
  stableHome: string,
  operationNonce: string,
  baseHash: string,
) {
  const recoveryId = `docker-task.${stableHome}.${operationNonce}.${baseHash}`;
  const cleanupName = `cleanup-docker-task-${stableHome}-${operationNonce}-${baseHash}`;
  const moduleUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    import path from "node:path";
    const journal = await import(${JSON.stringify(moduleUrl)});
    const root = process.argv[1];
    const cleanupName = process.argv[2];
    const recoveryId = process.argv[3];
    const cleanup = path.join(root, cleanupName);
    fs.mkdirSync(cleanup);
    journal.writeCommittedDockerRecoveryJson(
      cleanup,
      "record.json",
      "record.json",
      { schema: "fixture/v1", value: true },
    );
    fs.mkdirSync(path.join(cleanup, "empty"));
    const originalRm = fs.rmSync;
    fs.rmSync = (...args) => {
      const result = originalRm(...args);
      process.kill(process.pid, "SIGKILL");
      return result;
    };
    journal.removeDockerRecoveryCleanupDirectory(root, cleanup, recoveryId, {
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash: "6".repeat(64),
      runtimeStateBindingHash: "7".repeat(64),
    });
  `;
  const crashed = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "-e", source, root, cleanupName, recoveryId],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.notEqual(crashed.status, 0);
  assert.ok(fs.readdirSync(root).length > 0);
  return recoveryId;
}

function createKilledProductionCleanupRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-recovery-test-"),
  );
  addKilledProductionCleanup(root, stableHome, operationNonce, baseHash);
  return root;
}

function spawnLogicalHomeLockHolder(stableHome: string) {
  const readyDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-home-lock-holder-"),
  );
  const ready = path.join(readyDirectory, "ready");
  const lockUrl = pathToFileURL(
    path.resolve("src/security/candidate-store-kernel-lock.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    const locks = await import(${JSON.stringify(lockUrl)});
    const lock = locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(process.argv[1]);
    if (!lock) process.exit(75);
    fs.writeFileSync(process.argv[2], "ready", "utf8");
    setInterval(() => {}, 1000);
  `;
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "-e", source, stableHome, ready],
    { windowsHide: true, stdio: "ignore" },
  );
  const waitState = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 5_000;
  while (
    !fs.existsSync(ready) &&
    child.exitCode === null &&
    Date.now() < deadline
  )
    Atomics.wait(waitState, 0, 0, 10);
  assert.equal(fs.existsSync(ready), true);
  return Object.freeze({ child, readyDirectory });
}

function createKilledFullProductionRecoveryRoot(
  hostPhase:
    | "active_binding_content"
    | "pending_base"
    | "previous"
    | "expected"
    | "submission"
    | "receipt"
    | "receipt_proxy" = "expected",
) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-full-recovery-test-"),
  );
  const root = path.join(parent, "runtime-state");
  const handoff = path.join(parent, "handoff.json");
  fs.mkdirSync(root);
  const dockerRecoveryUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-runtime-internal.ts"),
  ).href;
  const executionEnvironmentUrl = pathToFileURL(
    path.resolve("src/security/execution-environment.ts"),
  ).href;
  const hostRecoveryRecordUrl = pathToFileURL(
    path.resolve("src/security/host-recovery-record.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    import path from "node:path";
    const recovery = await import(${JSON.stringify(dockerRecoveryUrl)});
    const host = await import(${JSON.stringify(executionEnvironmentUrl)});
    const hostRecord = await import(${JSON.stringify(hostRecoveryRecordUrl)});
    const rootPath = process.argv[1];
    const handoff = process.argv[2];
    const hostPhase = process.argv[3];
    const owned = host.createOwnedOperationDirectories();
    const context = host.createOwnedOperationContextCapability(owned);
    const mounts = host.createOwnedMountCapability(owned);
    const management = host.createOwnedOperationManagementCapability(context, mounts);
    const operation = host.verifyOwnedOperationManagementCapability(management);
    const localUserBindingHash = "6".repeat(64);
    const stableLogicalHomeBindingHash = "c".repeat(64);
    const runtimeRoot = Object.freeze({
      rootPath,
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash,
      stableLogicalHomeBindingHash: "7".repeat(64),
    });
    const providerHome = Object.freeze({
      providerHomeIdentityHash: "8".repeat(64),
      providerHomeProtectionHash: "9".repeat(64),
      localUserBindingHash,
      stableLogicalHomeBindingHash,
    });
    if (hostPhase === "active_binding_content") {
      const originalRename = fs.renameSync;
      fs.renameSync = (...args) => {
        const result = originalRename(...args);
        const target = String(args[1]);
        if (path.basename(target) === "active-docker-task-v1.json") {
          const active = JSON.parse(fs.readFileSync(target, "utf8"));
          const currentHostRecoveryId =
            host.getOwnedHostRecoveryIdByManagementCapability(management);
          fs.writeFileSync(
            handoff,
            JSON.stringify({
              recoveryId: active.recoveryId,
              hostRoot: owned.root,
              hostMarker:
                hostRecord.loadHostRecoveryRecordByToken(currentHostRecoveryId).marker,
            }),
            "utf8",
          );
          process.kill(process.pid, "SIGKILL");
        }
        return result;
      };
    }
    let begun;
    try {
      const plan = Object.freeze({
        provider: "claude",
        operationId: operation.operationId,
        grantRef: "PHMGRANT-123456",
        profileId: "PROFILE-123456",
        providerHomeIdentityHash: providerHome.providerHomeIdentityHash,
        providerHomeProtectionHash: providerHome.providerHomeProtectionHash,
        localUserBindingHash,
        stableLogicalHomeBindingHash,
        authContainerName: "crdd-auth-0123456789abcdef",
        providerContainerName: "crdd-claude-0123456789abcdef",
        proxyContainerName: "crdd-proxy-0123456789abcdef",
        internalNetworkName: "crdd-internal-0123456789abcdef",
        egressNetworkName: "crdd-egress-0123456789abcdef",
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
        providerImageDigest: "sha256:" + "a".repeat(64),
        proxyImageDigest: "sha256:" + "b".repeat(64),
        operationMode: "isolated_task",
        workspaceMountMode: "read_write",
      });
      if (hostPhase === "pending_base") {
        begun = recovery.beginRuntimeOwnedDockerRecoveryWithPendingBaseObserver(
          plan,
          management,
          providerHome,
          runtimeRoot,
          (recoveryId) => {
            const currentHostRecoveryId =
              host.getOwnedHostRecoveryIdByManagementCapability(management);
            fs.writeFileSync(
              handoff,
              JSON.stringify({
                recoveryId,
                hostRoot: owned.root,
                hostMarker:
                  hostRecord.loadHostRecoveryRecordByToken(currentHostRecoveryId).marker,
              }),
              "utf8",
            );
            process.kill(process.pid, "SIGKILL");
          },
          () => runtimeRoot,
        );
      } else if (hostPhase === "previous") {
        begun = recovery.beginRuntimeOwnedDockerRecoveryWithHostBeginObserver(
          plan,
          management,
          providerHome,
          runtimeRoot,
          (recoveryId) => {
            const currentHostRecoveryId =
              host.getOwnedHostRecoveryIdByManagementCapability(management);
            fs.writeFileSync(
              handoff,
              JSON.stringify({
                recoveryId,
                hostRoot: owned.root,
                hostMarker:
                  hostRecord.loadHostRecoveryRecordByToken(currentHostRecoveryId).marker,
              }),
              "utf8",
            );
            process.kill(process.pid, "SIGKILL");
          },
          () => runtimeRoot,
        );
      } else {
        begun = recovery.beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
          plan,
          management,
          providerHome,
          runtimeRoot,
          () => runtimeRoot,
        );
      }
    } catch (error) {
      fs.writeFileSync(
        handoff,
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        "utf8",
      );
      process.exit(70);
    }
    if (!begun || begun.status !== "ready") {
      fs.writeFileSync(
        handoff,
        JSON.stringify({ diagnostic: begun, operationId: operation.operationId }),
        "utf8",
      );
      process.exit(71);
    }
    if (hostPhase === "submission") {
      if (!recovery.markRuntimeOwnedDockerResourceSubmission(
        begun.recoveryCapability,
        "create_subscription_auth_probe",
      )) process.exit(73);
    }
    if (hostPhase === "receipt") {
      if (!recovery.markRuntimeOwnedDockerResourceSubmission(
        begun.recoveryCapability,
        "create_provider",
      )) process.exit(73);
      if (!recovery.recordRuntimeOwnedDockerResourceReceipt(
        begun.recoveryCapability,
        "create_provider",
        "a".repeat(64),
      )) process.exit(74);
    }
    if (hostPhase === "receipt_proxy") {
      if (!recovery.markRuntimeOwnedDockerResourceSubmission(
        begun.recoveryCapability,
        "create_proxy",
      )) process.exit(73);
      if (!recovery.recordRuntimeOwnedDockerResourceReceipt(
        begun.recoveryCapability,
        "create_proxy",
        "a".repeat(64),
      )) process.exit(74);
    }
    fs.writeFileSync(
      handoff,
      JSON.stringify({
        recoveryId: begun.recoveryId,
        hostRoot: owned.root,
        hostMarker: hostRecord.loadHostRecoveryRecordByToken(
          host.getOwnedHostRecoveryIdByManagementCapability(management),
        ).marker,
      }),
      "utf8",
    );
    if (!(await host.abandonOwnedHostOperationGenerationLock(management))) process.exit(72);
    process.kill(process.pid, "SIGKILL");
  `;
  const crashed = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "-e", source, root, handoff, hostPhase],
    { windowsHide: true, encoding: "utf8", timeout: 15_000 },
  );
  assert.notEqual(crashed.status, 0, crashed.stderr);
  assert.equal(fs.existsSync(handoff), true, crashed.stderr);
  const handoffText = fs.readFileSync(handoff, "utf8");
  const childDiagnostic = `${handoffText}\n${crashed.stderr}`;
  assert.notEqual(crashed.status, 70, childDiagnostic);
  assert.notEqual(crashed.status, 71, childDiagnostic);
  assert.notEqual(crashed.status, 73, childDiagnostic);
  assert.notEqual(crashed.status, 74, childDiagnostic);
  const result = JSON.parse(handoffText) as {
    recoveryId: string;
    hostRoot: string;
    hostMarker: string;
  };
  fs.rmSync(handoff);
  return Object.freeze({ parent, root, ...result });
}

function productionRecoveryBindingPaths(fixture: {
  root: string;
  hostRoot: string;
}) {
  const pointerName = fs
    .readdirSync(fixture.root)
    .find((name) => name.startsWith("active-lease-"));
  assert.ok(pointerName);
  const activePath = fs
    .readdirSync(fixture.hostRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.join(fixture.hostRoot, entry.name, "active-docker-task-v1.json"),
    )
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(activePath);
  return Object.freeze({
    activePath,
    pointerPath: path.join(fixture.root, pointerName),
    pointerCommitPath: path.join(
      fixture.root,
      dockerRecoveryCommitName(pointerName),
    ),
  });
}

function breakProductionRecoveryPointer(
  fixture: {
    root: string;
    hostRoot: string;
    recoveryId: string;
  },
  pointerState: "missing" | "partial" | "replacement",
) {
  const paths = productionRecoveryBindingPaths(fixture);
  if (pointerState === "missing") {
    assert.equal(removeCommittedDockerRecoveryJson(paths.pointerPath), true);
  } else if (pointerState === "partial") {
    fs.rmSync(paths.pointerCommitPath);
  } else {
    const [stableLogicalHomeBindingHash, operationNonce, baseHash] =
      fixture.recoveryId.split(".").slice(1);
    rewriteCommittedRecoveryRecordForTest(
      paths.pointerPath,
      path.basename(paths.pointerPath),
      {
        schema: "crdd-coordinator-provider-home-active-lease/v1",
        stableLogicalHomeBindingHash,
        operationName: `docker-task-${operationNonce}-replacement`,
        recoveryId: fixture.recoveryId,
        baseHash,
      },
    );
  }
  return paths;
}

function disposeKilledFullProductionRecoveryFixture(
  fixture: Readonly<{
    hostRoot: string;
    hostMarker: string;
    parent: string;
  }>,
) {
  fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
  fs.rmSync(fixture.hostMarker, { force: true });
  fs.rmSync(fixture.parent, { recursive: true, force: true });
}

function rewriteCommittedRecoveryRecordForTest(
  target: string,
  logicalKey: string,
  value: unknown,
) {
  const serialized = `${JSON.stringify(value)}\n`;
  fs.writeFileSync(target, serialized, "utf8");
  const identity = fs.lstatSync(target, { bigint: true });
  const commit = {
    schema: "crdd-coordinator-durable-json-commit/v1",
    logicalKey,
    contentHash: createHash("sha256").update(serialized).digest("hex"),
    contentIdentity: `${identity.dev}:${identity.ino}:${identity.birthtimeNs}`,
    contentBytes: Buffer.byteLength(serialized, "utf8"),
  };
  fs.writeFileSync(
    path.join(
      path.dirname(target),
      dockerRecoveryCommitName(path.basename(target)),
    ),
    `${JSON.stringify(commit)}\n`,
    "utf8",
  );
}

function dockerResult(stdout = "") {
  return Object.freeze({
    status: 0,
    signal: null,
    stdout,
    stderr: "",
    error: null,
  });
}

function exactContainerRunner(overrides: Record<string, unknown> = {}) {
  let exists = true;
  let removeCount = 0;
  const dockerId = "a".repeat(64);
  const inspected = Object.freeze({
    Id: dockerId,
    Name: "/provider",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"b".repeat(64)}`,
      Labels: Object.freeze({ "crdd.coordinator.runtime": "0123456789abcdef" }),
    }),
    HostConfig: Object.freeze({
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 64,
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze({ internal: Object.freeze({}) }),
    }),
    Mounts: Object.freeze([
      Object.freeze({
        Type: "bind",
        Destination: "/provider-home",
        RW: true,
        Propagation: "rprivate",
      }),
      Object.freeze({
        Type: "bind",
        Destination: "/tmp",
        RW: true,
        Propagation: "rprivate",
      }),
      Object.freeze({
        Type: "bind",
        Destination: "/work",
        RW: true,
        Propagation: "rprivate",
      }),
    ]),
    ...overrides,
  });
  return Object.freeze({
    dockerId,
    removeCount: () => removeCount,
    runDockerCommand(argv: readonly string[]) {
      if (argv[1] === "inspect")
        return dockerResult(JSON.stringify([inspected]));
      if (argv[1] === "rm") {
        exists = false;
        removeCount += 1;
        return dockerResult();
      }
      if (argv.includes(`id=${dockerId}`))
        return dockerResult(exists ? `${dockerId}\n` : "");
      if (
        argv.some(
          (value) => value.startsWith("name=") || value.startsWith("label="),
        )
      )
        return dockerResult(exists ? `${dockerId}\n` : "");
      return Object.freeze({
        status: 1,
        signal: null,
        stdout: "",
        stderr: "unexpected",
        error: null,
      });
    },
  });
}

function exactProxyRunner(networkNames: readonly string[]) {
  return exactContainerRunner({
    Name: "/crdd-proxy-0123456789abcdef",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"b".repeat(64)}`,
      Labels: Object.freeze({
        "crdd.coordinator.runtime": "0123456789abcdef",
      }),
    }),
    HostConfig: Object.freeze({
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 64,
      Tmpfs: Object.freeze({
        "/tmp": "rw,noexec,nosuid,size=16777216",
      }),
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze(
        Object.fromEntries(
          networkNames.map((networkName) => [networkName, Object.freeze({})]),
        ),
      ),
    }),
    Mounts: Object.freeze([]),
  });
}

function exactAuthRunner(networkNames: readonly string[] = ["none"]) {
  return exactContainerRunner({
    Name: "/crdd-auth-0123456789abcdef",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"a".repeat(64)}`,
      Labels: Object.freeze({
        "crdd.coordinator.runtime": "0123456789abcdef",
      }),
    }),
    HostConfig: Object.freeze({
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 32,
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze(
        Object.fromEntries(
          networkNames.map((networkName) => [networkName, Object.freeze({})]),
        ),
      ),
    }),
    Mounts: Object.freeze([
      Object.freeze({
        Type: "bind",
        Destination: "/provider-home",
        RW: false,
        Propagation: "rprivate",
      }),
    ]),
  });
}

function createIsolatedFixture() {
  const managementCapability = Object.freeze({});
  const otherManagementCapability = Object.freeze({});
  let beginCount = 0;
  let completeCount = 0;
  const runtime = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: (capability) => {
      if (capability !== managementCapability)
        throw new Error("management_invalid");
      return Object.freeze({ operationId: "OP-123456" });
    },
    beginDurableRecovery: (capability, operationId) => {
      assert.equal(capability, managementCapability);
      assert.equal(operationId, "OP-123456");
      beginCount += 1;
      return FIRST_RECOVERY;
    },
    completeDurableRecovery: (capability, recoveryId) => {
      assert.equal(capability, managementCapability);
      assert.equal(recoveryId, FIRST_RECOVERY);
      completeCount += 1;
      return SECOND_RECOVERY;
    },
  });
  return {
    runtime,
    managementCapability,
    otherManagementCapability,
    counts: () => ({ beginCount, completeCount }),
  };
}

test("Docker RecoveryはOperation bindingを確認してからdurable stateを開始する", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-999999" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.counts().beginCount, 0);
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.equal(begun.recoveryId, FIRST_RECOVERY);
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 0 });
});

test("Docker Recovery capabilityは同一管理権限で一度だけ完了できる", () => {
  const fixture = createIsolatedFixture();
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.otherManagementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "completed" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 1 });
});

test("Docker Recoveryは不正入力と依存例外をfail closedする", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "invalid" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.otherManagementCapability,
    ),
    null,
  );
  assert.deepEqual(fixture.runtime.complete(Object.freeze({}), null), {
    status: "blocked",
  });
  assert.deepEqual(fixture.runtime.complete(null, null), {
    status: "blocked",
  });

  let verificationCount = 0;
  const operationChanges = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => {
      verificationCount += 1;
      return Object.freeze({
        operationId: verificationCount === 1 ? "OP-123456" : "OP-654321",
      });
    },
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => SECOND_RECOVERY,
  });
  const begun = operationChanges.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    operationChanges.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const unchanged = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => FIRST_RECOVERY,
  });
  const unchangedBegun = unchanged.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(unchangedBegun);
  assert.deepEqual(
    unchanged.complete(
      unchangedBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const dependencyFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => {
      throw new Error("begin_failed");
    },
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  assert.equal(
    dependencyFailure.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.managementCapability,
    ),
    null,
  );

  const completeFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  const completeFailureBegun = completeFailure.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(completeFailureBegun);
  assert.deepEqual(
    completeFailure.complete(
      completeFailureBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
  assert.deepEqual(
    completeRuntimeOwnedDockerRecovery(Object.freeze({}), Object.freeze({})),
    { status: "blocked" },
  );
});

test("Production Docker Recoveryは不完全なTask planをEffect前に拒否する", () => {
  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
});

test("production facadeとpackage exportsはcaller Root／observer／runner seamを閉じる", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve("package.json"), "utf8"),
  );
  assert.deepEqual(packageJson.exports, { "./cli": "./bin/coordinator.ts" });
  const facade = fs.readFileSync(
    path.resolve("src/security/docker-recovery-runtime.ts"),
    "utf8",
  );
  for (const symbol of [
    "beginRuntimeOwnedDockerRecoveryWithHostBeginObserver",
    "beginRuntimeOwnedDockerRecoveryWithPendingBaseObserver",
    "beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver",
    "inspectDockerRecoveryRootSnapshotWithLock",
    "recoverExactDockerResourceWithRunner",
    "recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver",
  ])
    assert.equal(facade.includes(symbol), false, symbol);
  for (const root of ["src", "bin"]) {
    const pendingSourcePaths = [path.resolve(root)];
    while (pendingSourcePaths.length > 0) {
      const current = pendingSourcePaths.pop();
      assert.ok(current);
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) pendingSourcePaths.push(target);
        else if (
          entry.isFile() &&
          entry.name.endsWith(".ts") &&
          target !== path.resolve("src/security/docker-recovery-runtime.ts") &&
          target !==
            path.resolve("src/security/docker-recovery-runtime-internal.ts")
        )
          assert.equal(
            fs
              .readFileSync(target, "utf8")
              .includes("docker-recovery-runtime-internal.ts"),
            false,
            target,
          );
      }
    }
  }
  const blocked = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'await import("@qual-lab/crdd-coordinator/src/security/docker-recovery-runtime-internal.ts")',
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/u);
});

test("RuntimeState inventoryはlock release false／throwを成功へ投影しない", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-inventory-release-test-"),
  );
  const root = verifiedRoot(rootPath);
  try {
    for (const release of [
      () => false,
      () => {
        throw new Error("release failed");
      },
    ])
      assert.deepEqual(
        inspectDockerRecoveryRootSnapshotWithLock(root, () => ({ release })),
        {
          status: "blocked",
          reason: "docker_task_runtime_state_lock_release_unconfirmed",
          manualRecoveryRequired: true,
          dockerRecoveryId: null,
          dockerRecoveryIds: [],
          activeStableLogicalHomeBindingHashes: [],
        },
      );
    const recoveryId = addKilledProductionCleanup(
      rootPath,
      stableHome,
      operationNonce,
      baseHash,
    );
    assert.deepEqual(
      inspectDockerRecoveryRootSnapshotWithLock(root, () => ({
        release: () => false,
      })),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
        manualRecoveryRequired: true,
        dockerRecoveryId: recoveryId,
        dockerRecoveryIds: [recoveryId],
        activeStableLogicalHomeBindingHashes: [],
      },
    );
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production inventoryは別Homeの複数base move中間状態をexact ID別に列挙する", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-multiple-base-move-test-"),
  );
  try {
    const first = addSplitRootBaseMove(rootPath, "a");
    const second = addSplitRootBaseMove(rootPath, "b");
    const result = inspectDockerRecoveryRootSnapshotWithLock(
      verifiedRoot(rootPath),
      () => Object.freeze({ release: () => true }),
    );
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.equal(
      result.reason,
      "docker_task_multiple_recovery_inventory_available",
    );
    assert.deepEqual(result.dockerRecoveryIds, [first, second]);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production inventoryはbase／base-commit moveの全境界を同一／別Homeともexact ID別に列挙する", () => {
  for (const move of ["base", "base_commit"] as const) {
    for (const killAfterRename of [1, 2, 3] as const) {
      for (const isSameHome of [false, true]) {
        const rootPath = fs.mkdtempSync(
          path.join(os.tmpdir(), "crdd-runtime-base-commit-move-test-"),
        );
        try {
          const first = addSplitRootBaseMove(
            rootPath,
            "a",
            move,
            "a",
            killAfterRename,
          );
          const second = addSplitRootBaseMove(
            rootPath,
            "b",
            move,
            isSameHome ? "a" : "b",
            killAfterRename,
          );
          const beforeIntents = inspectDockerRecoveryJournalDirectory(rootPath);
          const secondIntent = beforeIntents.find(
            (intent) => intent.recoveryId === second,
          );
          assert.ok(secondIntent);
          const secondAnchor = path.join(rootPath, secondIntent.name);
          const secondBytes = fs.readFileSync(secondAnchor);
          const secondIdentity = fs.lstatSync(secondAnchor, { bigint: true });
          const secondNonce = second.split(".")[2];
          assert.ok(secondNonce);
          const secondRecoveryTreeEntries = snapshotRecoveryTree(
            rootPath,
          ).filter(
            (entry) =>
              entry.name.includes(secondNonce) ||
              entry.name === secondIntent.name,
          );

          const initial = inspectDockerRecoveryRootSnapshotWithLock(
            verifiedRoot(rootPath),
            () => Object.freeze({ release: () => true }),
          );
          assert.equal(initial.status, "completed", JSON.stringify(initial));
          assert.deepEqual(initial.dockerRecoveryIds, [first, second].sort());
          assert.deepEqual(fs.readFileSync(secondAnchor), secondBytes);
          assert.deepEqual(
            snapshotRecoveryTree(rootPath).filter(
              (entry) =>
                entry.name.includes(secondNonce) ||
                entry.name === secondIntent.name,
            ),
            secondRecoveryTreeEntries,
          );

          assert.equal(
            resumeDockerRecoveryJournalDirectoryForRecovery(rootPath, first, {
              runtimeStateIdentityHash: "4".repeat(64),
              runtimeStateProtectionHash: "5".repeat(64),
              localUserBindingHash: "6".repeat(64),
              runtimeStateBindingHash: "7".repeat(64),
            }),
            true,
          );
          const afterFirst = inspectDockerRecoveryRootSnapshotWithLock(
            verifiedRoot(rootPath),
            () => Object.freeze({ release: () => true }),
          );
          assert.equal(
            afterFirst.status,
            "completed",
            JSON.stringify(afterFirst),
          );
          assert.deepEqual(
            afterFirst.dockerRecoveryIds,
            [first, second].sort(),
          );
          assert.deepEqual(fs.readFileSync(secondAnchor), secondBytes);
          assert.deepEqual(
            snapshotRecoveryTree(rootPath).filter(
              (entry) =>
                entry.name.includes(secondNonce) ||
                entry.name === secondIntent.name,
            ),
            secondRecoveryTreeEntries,
          );
          const afterIdentity = fs.lstatSync(secondAnchor, { bigint: true });
          assert.deepEqual(
            [afterIdentity.dev, afterIdentity.ino, afterIdentity.birthtimeNs],
            [
              secondIdentity.dev,
              secondIdentity.ino,
              secondIdentity.birthtimeNs,
            ],
          );

          assert.equal(
            resumeDockerRecoveryJournalDirectoryForRecovery(rootPath, second, {
              runtimeStateIdentityHash: "4".repeat(64),
              runtimeStateProtectionHash: "5".repeat(64),
              localUserBindingHash: "6".repeat(64),
              runtimeStateBindingHash: "7".repeat(64),
            }),
            true,
          );
          assert.equal(
            inspectDockerRecoveryJournalDirectory(rootPath).length,
            0,
          );
        } finally {
          fs.rmSync(rootPath, { recursive: true, force: true });
          assert.equal(fs.existsSync(rootPath), false);
        }
      }
    }
  }
});

test("production inventoryはpending base-only／両pending pair／空Directory／base完了後を列挙する", () => {
  for (const state of [
    "pending_base_only",
    "pending_pairs",
    "empty_directory",
    "base_complete",
  ] as const) {
    for (const isSameHome of [false, true]) {
      const rootPath = fs.mkdtempSync(
        path.join(os.tmpdir(), "crdd-runtime-bootstrap-state-test-"),
      );
      try {
        const first = addSplitRootBaseMove(rootPath, "a", state, "a");
        const second = addSplitRootBaseMove(
          rootPath,
          "b",
          state,
          isSameHome ? "a" : "b",
        );
        const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
        const result = inspectDockerRecoveryRootSnapshotWithLock(
          verifiedRoot(rootPath),
          () => Object.freeze({ release: () => true }),
        );
        assert.equal(result.status, "completed", `${state}:${isSameHome}`);
        assert.deepEqual(result.dockerRecoveryIds, [first, second].sort());
        assert.deepEqual(
          snapshotRecoveryTree(rootPath),
          beforeRecoveryTreeEntries,
        );
      } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
      }
    }
  }
});

test("production inventoryはno-intentのRoot source／target重複を第三状態として拒否する", () => {
  for (const duplicate of ["base", "base_commit", "both"] as const) {
    const rootPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-runtime-bootstrap-duplicate-test-"),
    );
    try {
      const state = duplicate === "base" ? "base_complete" : "full";
      const recoveryId = addSplitRootBaseMove(rootPath, "a", state, "a");
      addSplitRootBaseMove(rootPath, "b", "full", "b");
      const nonce = recoveryId.split(".")[2];
      assert.ok(nonce);
      const operationDirectory = path.join(rootPath, `docker-task-${nonce}`);
      if (duplicate === "base" || duplicate === "both") {
        copyCommittedJsonWithFreshIdentity(
          path.join(operationDirectory, "base.json"),
          path.join(rootPath, `pending-docker-task-${nonce}.json`),
          "base.json",
        );
      }
      if (duplicate === "base_commit" || duplicate === "both") {
        copyCommittedJsonWithFreshIdentity(
          path.join(operationDirectory, "base-commit.json"),
          path.join(rootPath, `pending-docker-task-${nonce}.commit.json`),
          "base-commit.json",
        );
      }
      const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
      const result = inspectDockerRecoveryRootSnapshotWithLock(
        verifiedRoot(rootPath),
        () => Object.freeze({ release: () => true }),
      );
      assert.equal(result.status, "blocked", duplicate);
      assert.deepEqual(result.dockerRecoveryIds, []);
      assert.deepEqual(
        snapshotRecoveryTree(rootPath),
        beforeRecoveryTreeEntries,
      );
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  }
});

test("production inventoryはpending base-onlyの改変・置換・orphanを採用しない", () => {
  for (const mutation of ["bytes", "replacement", "orphan_sidecar"] as const) {
    const rootPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-runtime-pending-base-negative-test-"),
    );
    let external: string | null = null;
    try {
      const recoveryId = addSplitRootBaseMove(
        rootPath,
        "a",
        "pending_base_only",
        "a",
      );
      addSplitRootBaseMove(rootPath, "b", "full", "b");
      const nonce = recoveryId.split(".")[2];
      assert.ok(nonce);
      const pendingBase = path.join(
        rootPath,
        `pending-docker-task-${nonce}.json`,
      );
      if (mutation === "bytes") fs.writeFileSync(pendingBase, "{}\n");
      if (mutation === "replacement") {
        external = fs.mkdtempSync(
          path.join(os.tmpdir(), "crdd-runtime-pending-replacement-"),
        );
        const replacement = path.join(external, "replacement.json");
        fs.writeFileSync(replacement, fs.readFileSync(pendingBase));
        fs.renameSync(pendingBase, path.join(external, "original.json"));
        fs.renameSync(replacement, pendingBase);
      }
      if (mutation === "orphan_sidecar")
        fs.writeFileSync(
          path.join(
            rootPath,
            dockerRecoveryCommitName(
              `pending-docker-task-${nonce}.commit.json`,
            ),
          ),
          "{}\n",
        );
      const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
      const result = inspectDockerRecoveryRootSnapshotWithLock(
        verifiedRoot(rootPath),
        () => Object.freeze({ release: () => true }),
      );
      assert.equal(result.status, "blocked", mutation);
      assert.deepEqual(result.dockerRecoveryIds, []);
      assert.deepEqual(
        snapshotRecoveryTree(rootPath),
        beforeRecoveryTreeEntries,
      );
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
      if (external) fs.rmSync(external, { recursive: true, force: true });
    }
  }
});

test("production inventoryはpointer生成前の全bootstrap状態にactive pointerを結合しない", () => {
  const states = [
    Object.freeze({ move: "pending_base_only" as const, boundary: 2 as const }),
    Object.freeze({ move: "pending_pairs" as const, boundary: 2 as const }),
    Object.freeze({ move: "empty_directory" as const, boundary: 2 as const }),
    Object.freeze({ move: "base" as const, boundary: 1 as const }),
    Object.freeze({ move: "base" as const, boundary: 2 as const }),
    Object.freeze({ move: "base" as const, boundary: 3 as const }),
    Object.freeze({ move: "base_complete" as const, boundary: 2 as const }),
    Object.freeze({ move: "base_commit" as const, boundary: 1 as const }),
    Object.freeze({ move: "base_commit" as const, boundary: 2 as const }),
    Object.freeze({ move: "base_commit" as const, boundary: 3 as const }),
    Object.freeze({ move: "full" as const, boundary: 2 as const }),
  ];
  for (const state of states) {
    for (const isSameHome of [false, true]) {
      const rootPath = fs.mkdtempSync(
        path.join(os.tmpdir(), "crdd-runtime-premature-pointer-test-"),
      );
      try {
        const recoveryId = addSplitRootBaseMove(
          rootPath,
          "a",
          state.move,
          "a",
          state.boundary,
        );
        addSplitRootBaseMove(rootPath, "b", "full", isSameHome ? "a" : "b");
        addActivePointer(rootPath, recoveryId);
        const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
        const result = inspectDockerRecoveryRootSnapshotWithLock(
          verifiedRoot(rootPath),
          () => Object.freeze({ release: () => true }),
        );
        assert.equal(
          result.status,
          "blocked",
          `${state.move}:${state.boundary}:${isSameHome}`,
        );
        assert.deepEqual(result.dockerRecoveryIds, []);
        assert.deepEqual(
          snapshotRecoveryTree(rootPath),
          beforeRecoveryTreeEntries,
        );
      } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
      }
    }
  }
});

test("production inventoryはmove anchor残存中のcommitted／journal pointerを採用しない", () => {
  for (const logicalKey of ["base.json", "base-commit.json"] as const) {
    for (const pointerState of ["committed", "journal"] as const) {
      for (const isSameHome of [false, true]) {
        const fixture = createKilledFullProductionRecoveryRoot("previous");
        try {
          addSplitRootBaseMove(
            fixture.root,
            "b",
            "full",
            isSameHome ? "c" : "b",
          );
          leaveCommittedPairMoveAnchor(
            fixture.root,
            fixture.recoveryId,
            logicalKey,
          );
          if (pointerState === "journal")
            leaveActivePointerDeleteJournal(fixture.root, fixture.recoveryId);
          const beforeRecoveryTreeEntries = snapshotRecoveryTree(fixture.root);
          const result = inspectDockerRecoveryRootSnapshotWithLock(
            verifiedRoot(fixture.root),
            () => Object.freeze({ release: () => true }),
          );
          assert.equal(
            result.status,
            "blocked",
            `${logicalKey}:${pointerState}:${isSameHome}`,
          );
          assert.deepEqual(result.dockerRecoveryIds, []);
          assert.deepEqual(
            snapshotRecoveryTree(fixture.root),
            beforeRecoveryTreeEntries,
          );
        } finally {
          fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
          fs.rmSync(fixture.hostMarker, { force: true });
          fs.rmSync(fixture.parent, { recursive: true, force: true });
        }
      }
    }
  }
});

test("production inventoryはpointer解放後Evidenceとcommitted／journal pointerの第三状態を採用しない", () => {
  const evidenceNames = [
    "lease-release-receipt.json",
    "normal-run-complete.json",
    "host-cleanup-intent.json",
    "host-cleanup-receipt.json",
  ] as const;
  for (const evidenceName of evidenceNames) {
    for (const pointerState of ["committed", "journal"] as const) {
      for (const isSameHome of [false, true]) {
        const fixture = createKilledFullProductionRecoveryRoot("previous");
        try {
          addSplitRootBaseMove(
            fixture.root,
            "b",
            "full",
            isSameHome ? "c" : "b",
          );
          addPointerReleaseEvidence(
            fixture.root,
            fixture.recoveryId,
            evidenceName,
          );
          if (pointerState === "journal")
            leaveActivePointerDeleteJournal(fixture.root, fixture.recoveryId);
          const beforeRecoveryTreeEntries = snapshotRecoveryTree(fixture.root);
          const result = inspectDockerRecoveryRootSnapshotWithLock(
            verifiedRoot(fixture.root),
            () => Object.freeze({ release: () => true }),
          );
          assert.equal(
            result.status,
            "blocked",
            `${evidenceName}:${pointerState}:${isSameHome}`,
          );
          assert.deepEqual(result.dockerRecoveryIds, []);
          assert.deepEqual(
            snapshotRecoveryTree(fixture.root),
            beforeRecoveryTreeEntries,
          );
        } finally {
          fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
          fs.rmSync(fixture.hostMarker, { force: true });
          fs.rmSync(fixture.parent, { recursive: true, force: true });
        }
      }
    }
  }
});

test("production inventoryはbase完了anchor残存中に次pairを開始した順序外状態を拒否する", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-bootstrap-order-test-"),
  );
  try {
    const recoveryId = addSplitRootBaseMove(rootPath, "a", "base", "a", 3);
    const nonce = recoveryId.split(".")[2];
    assert.ok(nonce);
    const pendingCommit = readCommittedDockerRecoveryJson(
      path.join(rootPath, `pending-docker-task-${nonce}.commit.json`),
      "base-commit.json",
    );
    const originalRename = fs.renameSync;
    let renameCount = 0;
    Reflect.set(
      fs,
      "renameSync",
      (...args: Parameters<typeof fs.renameSync>) => {
        originalRename(...args);
        renameCount += 1;
        if (renameCount === 1)
          throw new Error("simulated_process_kill_after_intent_commit");
      },
    );
    try {
      assert.throws(
        () =>
          moveCommittedDockerRecoveryJson(
            pendingCommit,
            path.join(rootPath, `docker-task-${nonce}`, "base-commit.json"),
          ),
        /simulated_process_kill_after_intent_commit/u,
      );
    } finally {
      Reflect.set(fs, "renameSync", originalRename);
    }
    const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
    const result = inspectDockerRecoveryRootSnapshotWithLock(
      verifiedRoot(rootPath),
      () => Object.freeze({ release: () => true }),
    );
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.dockerRecoveryIds, []);
    assert.deepEqual(snapshotRecoveryTree(rootPath), beforeRecoveryTreeEntries);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production inventoryはsplit moveの改変・置換・第三状態を採用せず全Evidenceを保持する", () => {
  for (const move of ["base", "base_commit"] as const) {
    for (const mutation of [
      "target_bytes",
      "target_replacement",
      "source_commit_bytes",
      "source_and_target",
      "all_missing",
      "target_sidecar",
      "target_directory_replacement",
    ] as const) {
      const boundary =
        mutation === "source_and_target" || mutation === "all_missing" ? 1 : 2;
      const rootPath = fs.mkdtempSync(
        path.join(os.tmpdir(), "crdd-runtime-split-negative-test-"),
      );
      let external: string | null = null;
      try {
        const recoveryId = addSplitRootBaseMove(
          rootPath,
          "a",
          move,
          "a",
          boundary,
        );
        addSplitRootBaseMove(rootPath, "b", "base_commit", "b", 2);
        const nonce = recoveryId.split(".")[2];
        assert.ok(nonce);
        const sourceName =
          move === "base"
            ? `pending-docker-task-${nonce}.json`
            : `pending-docker-task-${nonce}.commit.json`;
        const targetName = move === "base" ? "base.json" : "base-commit.json";
        const source = path.join(rootPath, sourceName);
        const sourceCommit = path.join(
          rootPath,
          dockerRecoveryCommitName(sourceName),
        );
        const targetDirectory = path.join(rootPath, `docker-task-${nonce}`);
        const target = path.join(targetDirectory, targetName);
        const targetCommit = path.join(
          targetDirectory,
          dockerRecoveryCommitName(targetName),
        );

        if (mutation === "target_bytes") fs.writeFileSync(target, "{}\n");
        if (mutation === "target_replacement") {
          external = fs.mkdtempSync(
            path.join(os.tmpdir(), "crdd-runtime-replacement-"),
          );
          const replacement = path.join(external, "replacement.json");
          const original = path.join(external, "original.json");
          fs.writeFileSync(replacement, fs.readFileSync(target));
          fs.renameSync(target, original);
          fs.renameSync(replacement, target);
        }
        if (mutation === "source_commit_bytes")
          fs.writeFileSync(sourceCommit, "{}\n");
        if (mutation === "source_and_target") fs.copyFileSync(source, target);
        if (mutation === "all_missing") {
          fs.rmSync(source);
          fs.rmSync(sourceCommit);
        }
        if (mutation === "target_sidecar")
          fs.writeFileSync(targetCommit, "{}\n");
        if (mutation === "target_directory_replacement") {
          external = fs.mkdtempSync(
            path.join(os.tmpdir(), "crdd-runtime-directory-replacement-"),
          );
          fs.renameSync(targetDirectory, path.join(external, "original"));
          fs.mkdirSync(targetDirectory);
        }

        const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
        const result = inspectDockerRecoveryRootSnapshotWithLock(
          verifiedRoot(rootPath),
          () => Object.freeze({ release: () => true }),
        );
        assert.equal(result.status, "blocked", `${move}:${mutation}`);
        assert.deepEqual(result.dockerRecoveryIds, []);
        assert.deepEqual(
          snapshotRecoveryTree(rootPath),
          beforeRecoveryTreeEntries,
        );
      } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
        if (external) fs.rmSync(external, { recursive: true, force: true });
      }
    }
  }
});

test("production inventoryは全partial bootstrap状態のunknown／orphan／replacementをEffect前に拒否する", () => {
  const states = [
    Object.freeze({ move: "pending_pairs" as const, boundary: 2 as const }),
    Object.freeze({ move: "empty_directory" as const, boundary: 2 as const }),
    Object.freeze({ move: "base" as const, boundary: 1 as const }),
    Object.freeze({ move: "base" as const, boundary: 2 as const }),
    Object.freeze({ move: "base" as const, boundary: 3 as const }),
    Object.freeze({ move: "base_complete" as const, boundary: 2 as const }),
    Object.freeze({ move: "base_commit" as const, boundary: 1 as const }),
    Object.freeze({ move: "base_commit" as const, boundary: 2 as const }),
  ];
  for (const state of states) {
    for (const mutation of [
      "unknown_file",
      "orphan_temporary",
      "extra_sidecar",
      "nonregular",
      "replacement",
    ] as const) {
      const rootPath = fs.mkdtempSync(
        path.join(os.tmpdir(), "crdd-runtime-bootstrap-negative-test-"),
      );
      let external: string | null = null;
      try {
        const recoveryId = addSplitRootBaseMove(
          rootPath,
          "a",
          state.move,
          "a",
          state.boundary,
        );
        addSplitRootBaseMove(rootPath, "b", "base_commit", "b", 2);
        const nonce = recoveryId.split(".")[2];
        assert.ok(nonce);
        const operationDirectory = path.join(rootPath, `docker-task-${nonce}`);
        const mutationDirectory = fs.existsSync(operationDirectory)
          ? operationDirectory
          : rootPath;
        if (mutation === "unknown_file")
          fs.writeFileSync(path.join(mutationDirectory, "unknown.txt"), "x");
        if (mutation === "orphan_temporary")
          fs.writeFileSync(
            path.join(mutationDirectory, ".crdd-tmp-unknown-00.tmp"),
            "x",
          );
        if (mutation === "extra_sidecar")
          fs.writeFileSync(
            path.join(mutationDirectory, "unknown.json.crdd-commit.json"),
            "{}\n",
          );
        if (mutation === "nonregular")
          fs.mkdirSync(path.join(mutationDirectory, "unexpected-directory"));
        if (mutation === "replacement") {
          const targetBase = path.join(operationDirectory, "base.json");
          const pendingBase = path.join(
            rootPath,
            `pending-docker-task-${nonce}.json`,
          );
          const target = fs.existsSync(targetBase) ? targetBase : pendingBase;
          external = fs.mkdtempSync(
            path.join(os.tmpdir(), "crdd-runtime-bootstrap-replacement-"),
          );
          const replacement = path.join(external, "replacement.json");
          const original = path.join(external, "original.json");
          fs.writeFileSync(replacement, fs.readFileSync(target));
          fs.renameSync(target, original);
          fs.renameSync(replacement, target);
        }
        const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
        const result = inspectDockerRecoveryRootSnapshotWithLock(
          verifiedRoot(rootPath),
          () => Object.freeze({ release: () => true }),
        );
        assert.equal(
          result.status,
          "blocked",
          `${state.move}:${state.boundary}:${mutation}`,
        );
        assert.deepEqual(result.dockerRecoveryIds, []);
        assert.deepEqual(
          snapshotRecoveryTree(rootPath),
          beforeRecoveryTreeEntries,
        );
      } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
        if (external) fs.rmSync(external, { recursive: true, force: true });
      }
    }
  }
});

test("production Task admissionはpartial bootstrapのunknownを新規記録前に拒否する", () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-bootstrap-admission-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const existingRecoveryId = addSplitRootBaseMove(
    runtimeRootPath,
    "a",
    "base",
    "a",
    2,
  );
  const existingNonce = existingRecoveryId.split(".")[2];
  assert.ok(existingNonce);
  fs.writeFileSync(
    path.join(runtimeRootPath, `docker-task-${existingNonce}`, "unknown.txt"),
    "x",
  );
  const beforeRecoveryTreeEntries = snapshotRecoveryTree(runtimeRootPath);
  const root = verifiedRoot(runtimeRootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "e".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  try {
    assert.deepEqual(
      beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => root,
      ),
      {
        status: "blocked",
        recoveryId: null,
        manualRecoveryRequired: true,
        reason: "docker_recovery_initialization_failed_closed",
      },
    );
    assert.deepEqual(
      snapshotRecoveryTree(runtimeRootPath),
      beforeRecoveryTreeEntries,
    );
    assert.equal(
      loadHostRecoveryRecordByToken(owned.hostRecoveryId).record.state,
      "host_only",
    );
  } finally {
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("production recoveryはpartial bootstrapのunknownをjournal resume前に拒否する", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-bootstrap-recovery-test-"),
  );
  try {
    const recoveryId = addSplitRootBaseMove(rootPath, "a", "base", "a", 2);
    const nonce = recoveryId.split(".")[2];
    assert.ok(nonce);
    fs.writeFileSync(
      path.join(rootPath, `docker-task-${nonce}`, "unknown.txt"),
      "x",
    );
    const root = verifiedRoot(rootPath);
    const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        recoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId,
      },
    );
    assert.deepEqual(snapshotRecoveryTree(rootPath), beforeRecoveryTreeEntries);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production Task admission／Recoveryはno-intent duplicateを最初のmutation前に拒否する", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-bootstrap-duplicate-gate-test-"),
  );
  const root = verifiedRoot(rootPath);
  const recoveryId = addSplitRootBaseMove(rootPath, "a", "base_complete", "a");
  const nonce = recoveryId.split(".")[2];
  assert.ok(nonce);
  copyCommittedJsonWithFreshIdentity(
    path.join(rootPath, `docker-task-${nonce}`, "base.json"),
    path.join(rootPath, `pending-docker-task-${nonce}.json`),
    "base.json",
  );
  const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "e".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  try {
    assert.deepEqual(
      beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => root,
      ),
      {
        status: "blocked",
        recoveryId: null,
        manualRecoveryRequired: true,
        reason: "docker_recovery_initialization_failed_closed",
      },
    );
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        recoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId,
      },
    );
    assert.deepEqual(snapshotRecoveryTree(rootPath), beforeRecoveryTreeEntries);
    assert.equal(
      loadHostRecoveryRecordByToken(owned.hostRecoveryId).record.state,
      "host_only",
    );
  } finally {
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production Task admission／Recoveryはpremature active pointerを最初のmutation前に拒否する", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-premature-pointer-gate-test-"),
  );
  const root = verifiedRoot(rootPath);
  const recoveryId = addSplitRootBaseMove(rootPath, "a", "pending_pairs", "a");
  addActivePointer(rootPath, recoveryId);
  const beforeRecoveryTreeEntries = snapshotRecoveryTree(rootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "e".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  try {
    assert.equal(
      beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => root,
      )?.status,
      "blocked",
    );
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        recoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId,
      },
    );
    assert.deepEqual(snapshotRecoveryTree(rootPath), beforeRecoveryTreeEntries);
    assert.equal(
      loadHostRecoveryRecordByToken(owned.hostRecoveryId).record.state,
      "host_only",
    );
  } finally {
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production Task admission／Recoveryはpointer解放後の再出現を最初のmutation前に拒否する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  addPointerReleaseEvidence(
    fixture.root,
    fixture.recoveryId,
    "lease-release-receipt.json",
  );
  const beforeRecoveryTreeEntries = snapshotRecoveryTree(fixture.root);
  const hostBefore = fs.readFileSync(fixture.hostMarker);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "e".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  try {
    assert.equal(
      beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => root,
      )?.status,
      "blocked",
    );
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId: fixture.recoveryId,
      },
    );
    assert.deepEqual(
      snapshotRecoveryTree(fixture.root),
      beforeRecoveryTreeEntries,
    );
    assert.deepEqual(fs.readFileSync(fixture.hostMarker), hostBefore);
  } finally {
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production共有回復engineはcleanup途中のprocess killから残存0へ収束する", () => {
  const root = createKilledProductionCleanupRoot();
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        dockerTaskRecoveryId,
        verifiedRoot(root),
        () => verifiedRoot(root),
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("production共有回復engineはTask Aの回復でTask Bのanchor／payloadを変更しない", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-scoped-recovery-test-"),
  );
  const root = verifiedRoot(rootPath);
  const first = addKilledProductionCleanup(
    rootPath,
    "a".repeat(64),
    "b".repeat(64),
    "c".repeat(64),
  );
  const second = addKilledProductionCleanup(
    rootPath,
    "d".repeat(64),
    "e".repeat(64),
    "f".repeat(64),
  );
  try {
    const secondNames = fs.readdirSync(rootPath).filter((name) => {
      if (name.includes("d".repeat(64))) return true;
      const target = path.join(rootPath, name);
      return (
        fs.lstatSync(target).isFile() &&
        fs.readFileSync(target, "utf8").includes(second)
      );
    });
    const before = new Map(
      secondNames.map((name) => {
        const target = path.join(rootPath, name);
        const metadata = fs.lstatSync(target, { bigint: true });
        return [
          name,
          Object.freeze({
            identity: [metadata.dev, metadata.ino, metadata.birthtimeNs],
            bytes: metadata.isFile() ? fs.readFileSync(target) : null,
          }),
        ];
      }),
    );
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        first,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      },
    );
    assert.equal(
      fs.readdirSync(rootPath).some((name) => name.includes("a".repeat(64))),
      false,
    );
    for (const [name, snapshot] of before) {
      const target = path.join(rootPath, name);
      assert.equal(fs.existsSync(target), true, name);
      const metadata = fs.lstatSync(target, { bigint: true });
      assert.deepEqual(
        [metadata.dev, metadata.ino, metadata.birthtimeNs],
        snapshot.identity,
        name,
      );
      if (snapshot.bytes)
        assert.deepEqual(fs.readFileSync(target), snapshot.bytes);
    }
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        first,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_recovery_evidence_missing",
        recoveryId: first,
      },
    );
    assert.match(second, /^docker-task\./u);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production共有回復engineは空Rootの未発行tokenを完了済みと推測しない", () => {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-empty-recovery-test-"),
  );
  const root = verifiedRoot(rootPath);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        dockerTaskRecoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_recovery_evidence_missing",
        recoveryId: dockerTaskRecoveryId,
      },
    );
    assert.deepEqual(fs.readdirSync(rootPath), []);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production共有回復engineはHost expected世代のprocess killを残存0へ収束する", () => {
  const fixture = createKilledFullProductionRecoveryRoot();
  const root = verifiedRoot(fixture.root);
  try {
    const beforeHostPresent =
      fs.existsSync(fixture.hostRoot) && fs.existsSync(fixture.hostMarker);
    const beforeRecoveryEntries = fs.readdirSync(fixture.root).length;
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
    const hostEffectCount =
      beforeHostPresent &&
      !fs.existsSync(fixture.hostRoot) &&
      !fs.existsSync(fixture.hostMarker)
        ? 1
        : 0;
    const cleanupEffectCount =
      beforeRecoveryEntries > 0 && fs.readdirSync(fixture.root).length === 0
        ? 1
        : 0;
    const recoveryTraceAssertion =
      RECOVERY_TRACE_ASSERTIONS["CASE-RECOVERY-TO-RECOVERED"];
    assert.ok(recoveryTraceAssertion);
    recoveryTraceAssertion("CASE-RECOVERY-TO-RECOVERED", {
      id: "CASE-RECOVERY-TO-RECOVERED",
      transitionId: "TRANS-RECOVERY-TO-RECOVERED",
      fromState: "STATE-RECOVERY-REQUIRED",
      outcome: "taken",
      expectedEndState: "STATE-RECOVERED",
      effectObservations: {
        provider: 0,
        host: hostEffectCount,
        cleanup: cleanupEffectCount,
      },
      expectedStatus: "completed",
      resourcePostconditions: {
        "RES-HOST-GENERATION": "absent",
        "RES-DOCKER-OWNED": "absent",
        "RES-OPERATION-WORKSPACE": "absent",
      },
    });
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("closed production engineはreceiptからexact Docker削除・Host回復・残存0まで通す", () => {
  const fixture = createKilledFullProductionRecoveryRoot("receipt");
  const root = verifiedRoot(fixture.root);
  const docker = exactContainerRunner({
    Name: "/crdd-claude-0123456789abcdef",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"a".repeat(64)}`,
      Labels: Object.freeze({
        "crdd.coordinator.runtime": "0123456789abcdef",
      }),
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze({
        "crdd-internal-0123456789abcdef": Object.freeze({}),
      }),
    }),
  });
  try {
    const recovered = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
      docker.runDockerCommand,
    );
    assert.deepEqual(recovered, {
      status: "recovered",
      reason: "docker_task_recovery_completed",
      recoveryId: null,
    });
    const publicSuccess = Object.freeze({
      ...recovered,
      manualRecoveryRequired: false,
      evidenceState: "unknown" as const,
    });
    const jsonReport = renderDockerRecoveryDoctorReport(publicSuccess, true);
    assert.equal(jsonReport.exitCode, 0);
    assert.deepEqual(JSON.parse(jsonReport.stdout), publicSuccess);
    const humanReport = renderDockerRecoveryDoctorReport(publicSuccess, false);
    assert.equal(humanReport.exitCode, 0);
    assert.match(humanReport.stdout, /Coordinator environment: recovered/u);
    assert.match(humanReport.stdout, /docker_task_recovery_completed/u);
    assert.doesNotMatch(humanReport.stdout, /C:\\/u);
    assert.doesNotMatch(
      humanReport.stdout,
      /recovery ID|next: coordinator doctor|Runtime operator|automatic recovery stopped/iu,
    );
    assert.equal(docker.removeCount(), 1);
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("closed production engineはcreate submission後receipt前のprocess killを空照会だけで収束させない", () => {
  const fixture = createKilledFullProductionRecoveryRoot("submission");
  const root = verifiedRoot(fixture.root);
  const observedCommands: string[][] = [];
  try {
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
      (argv) => {
        observedCommands.push([...argv]);
        return dockerResult();
      },
    );
    assert.deepEqual(result, {
      status: "blocked",
      reason: "docker_task_recovery_create_outcome_unknown",
      recoveryId: fixture.recoveryId,
    });
    assert.equal(observedCommands.length, 2);
    assert.equal(
      observedCommands[0]?.includes("name=^/crdd-auth-0123456789abcdef$"),
      true,
    );
    assert.equal(
      observedCommands[1]?.includes(
        "label=crdd.coordinator.runtime=0123456789abcdef",
      ),
      true,
    );
    assert.ok(fs.readdirSync(fixture.root).length > 0);
    assert.equal(fs.existsSync(fixture.hostRoot), true);
    assert.equal(fs.existsSync(fixture.hostMarker), true);
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("closed production engineは発見IDをreconciled receiptへ耐久化してから削除する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("submission");
  const root = verifiedRoot(fixture.root);
  const docker = exactAuthRunner();
  const failRemoval = (argv: readonly string[]) =>
    argv[1] === "rm"
      ? Object.freeze({
          status: 1,
          signal: null,
          stdout: "",
          stderr: "removal interrupted",
          error: null,
        })
      : docker.runDockerCommand(argv);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
        failRemoval,
      ),
      {
        status: "blocked",
        reason: "docker_task_recovery_resource_mismatch",
        recoveryId: fixture.recoveryId,
      },
    );
    const operationDirectory = fs
      .readdirSync(fixture.root, { withFileTypes: true })
      .find(
        (entry) => entry.isDirectory() && entry.name.startsWith("docker-task-"),
      );
    assert.ok(operationDirectory);
    const receiptPath = path.join(
      fixture.root,
      operationDirectory.name,
      "receipt-create_subscription_auth_probe.json",
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(receiptPath, "utf8")), {
      schema: "crdd-coordinator-docker-resource-receipt/v2",
      purpose: "create_subscription_auth_probe",
      dockerId: docker.dockerId,
      recoveryId: fixture.recoveryId,
      source: "runtime_reconciliation",
    });
    assert.equal(docker.removeCount(), 0);
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
        docker.runDockerCommand,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed",
        recoveryId: null,
      },
    );
    assert.equal(docker.removeCount(), 1);
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("production共有回復engineはHost previous世代のprocess killをEffect前として残存0へ収束する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  try {
    const active = inspectDockerRecoveryRootSnapshotWithLock(root, () =>
      Object.freeze({ release: () => true }),
    );
    assert.equal(active.status, "completed");
    assert.deepEqual(active.dockerRecoveryIds, [fixture.recoveryId]);
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("Host active bindingのexact content-onlyをEffect前状態として残存0へ収束する", () => {
  const fixture = createKilledFullProductionRecoveryRoot(
    "active_binding_content",
  );
  const root = verifiedRoot(fixture.root);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("Host active bindingのcontent-only不一致はEvidenceを保持して停止する", () => {
  const fixture = createKilledFullProductionRecoveryRoot(
    "active_binding_content",
  );
  const root = verifiedRoot(fixture.root);
  const managementDirectory = fs
    .readdirSync(fixture.hostRoot, { withFileTypes: true })
    .find(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(
          path.join(fixture.hostRoot, entry.name, "active-docker-task-v1.json"),
        ),
    );
  assert.ok(managementDirectory);
  const activePath = path.join(
    fixture.hostRoot,
    managementDirectory.name,
    "active-docker-task-v1.json",
  );
  try {
    fs.writeFileSync(
      activePath,
      JSON.stringify({
        schema: "crdd-coordinator-host-active-docker-task/v1",
        recoveryId: fixture.recoveryId,
        baseHash: "0".repeat(64),
        operationNonce: "0".repeat(64),
      }),
      "utf8",
    );
    const beforeActive = fs.readFileSync(activePath);
    const beforeHostEntries = fs.readdirSync(fixture.hostRoot).sort();
    const beforeRecoveryEntries = fs.readdirSync(fixture.root).sort();
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "docker_task_recovery_active_run_mismatch");
    assert.equal(result.recoveryId, fixture.recoveryId);
    assert.equal(fs.existsSync(activePath), true);
    assert.ok(fs.readdirSync(fixture.root).length > 0);
    const hostEffectCount = fs.readFileSync(activePath).equals(beforeActive)
      ? 0
      : 1;
    const cleanupEffectCount =
      JSON.stringify(fs.readdirSync(fixture.hostRoot).sort()) ===
        JSON.stringify(beforeHostEntries) &&
      JSON.stringify(fs.readdirSync(fixture.root).sort()) ===
        JSON.stringify(beforeRecoveryEntries)
        ? 0
        : 1;
    const partialTraceAssertion =
      RECOVERY_TRACE_ASSERTIONS["CASE-PARTIAL-PAIR-TO-RECOVERY"];
    assert.ok(partialTraceAssertion);
    partialTraceAssertion("CASE-PARTIAL-PAIR-TO-RECOVERY", {
      id: "CASE-PARTIAL-PAIR-TO-RECOVERY",
      transitionId: "TRANS-PARTIAL-PAIR-TO-RECOVERY",
      fromState: "STATE-DURABLE-PAIR-PARTIAL-PRE-EFFECT",
      outcome: "taken",
      expectedEndState: "STATE-RECOVERY-REQUIRED",
      effectObservations: {
        provider: 0,
        host: hostEffectCount,
        cleanup: cleanupEffectCount,
      },
      expectedStatus: "recovery_required",
      resourcePostconditions: {
        "RES-HOST-GENERATION": "preserved",
        "RES-OPERATION-WORKSPACE": "preserved",
      },
    });
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("Effect前active bindingはcommitted pointerの完全一致前に削除しない", () => {
  for (const pointerState of ["missing", "partial", "replacement"] as const) {
    const fixture = createKilledFullProductionRecoveryRoot(
      "active_binding_content",
    );
    const root = verifiedRoot(fixture.root);
    const { activePath } = breakProductionRecoveryPointer(
      fixture,
      pointerState,
    );
    try {
      const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      );
      assert.equal(result.status, "blocked");
      assert.equal(result.recoveryId, fixture.recoveryId);
      assert.equal(fs.existsSync(activePath), true);
      assert.equal(fs.existsSync(fixture.hostRoot), true);
      assert.equal(fs.existsSync(fixture.hostMarker), true);
    } finally {
      disposeKilledFullProductionRecoveryFixture(fixture);
    }
  }
});

test("Effect後Recovery経路もactive bindingをpointer閉包前に削除しない", () => {
  for (const hostPhase of ["expected", "receipt"] as const) {
    for (const pointerState of ["missing", "partial", "replacement"] as const) {
      const fixture = createKilledFullProductionRecoveryRoot(hostPhase);
      const root = verifiedRoot(fixture.root);
      const { activePath } = breakProductionRecoveryPointer(
        fixture,
        pointerState,
      );
      const beforeActive = fs.readFileSync(activePath);
      try {
        const result =
          recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
            fixture.recoveryId,
            root,
            () => root,
            hostPhase === "receipt"
              ? exactContainerRunner({
                  Name: "/crdd-claude-0123456789abcdef",
                  Config: Object.freeze({
                    User: "65534:65534",
                    Image: `sha256:${"a".repeat(64)}`,
                    Labels: Object.freeze({
                      "crdd.coordinator.runtime": "0123456789abcdef",
                    }),
                  }),
                  NetworkSettings: Object.freeze({
                    Networks: Object.freeze({
                      "crdd-internal-0123456789abcdef": Object.freeze({}),
                    }),
                  }),
                }).runDockerCommand
              : undefined,
          );
        assert.equal(result.status, "blocked");
        assert.equal(result.recoveryId, fixture.recoveryId);
        assert.deepEqual(fs.readFileSync(activePath), beforeActive);
        assert.equal(fs.existsSync(fixture.hostRoot), true);
        assert.equal(fs.existsSync(fixture.hostMarker), true);
      } finally {
        disposeKilledFullProductionRecoveryFixture(fixture);
      }
    }
  }
});

test("active binding削除後の観測不能は不存在にせずRecovery Evidenceを保持する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const activePath = fs
    .readdirSync(fixture.hostRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.join(fixture.hostRoot, entry.name, "active-docker-task-v1.json"),
    )
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(activePath);
  const originalRm = fs.rmSync;
  const originalLstat = fs.lstatSync;
  let activeDeleted = false;
  try {
    fs.rmSync = ((target: fs.PathLike, options?: fs.RmOptions) => {
      const result = originalRm(target, options);
      if (path.resolve(String(target)) === path.resolve(activePath))
        activeDeleted = true;
      return result;
    }) as typeof fs.rmSync;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: ((target: fs.PathLike, options?: unknown) => {
        if (
          activeDeleted &&
          path.resolve(String(target)) === path.resolve(activePath)
        ) {
          const error = new Error("injected observation failure") as Error & {
            code: string;
          };
          error.code = "EACCES";
          throw error;
        }
        return originalLstat(target, options as never);
      }) as typeof fs.lstatSync,
    });
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.recoveryId, fixture.recoveryId);
    assert.equal(
      fs
        .readdirSync(path.dirname(activePath))
        .some((entry) => entry.includes("delete")),
      true,
    );
    assert.ok(fs.readdirSync(fixture.root).length > 0);
  } finally {
    fs.rmSync = originalRm;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: originalLstat,
    });
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("pointer削除後の観測不能も不存在にせずRecovery Evidenceを保持する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const { pointerPath } = productionRecoveryBindingPaths(fixture);
  const originalRm = fs.rmSync;
  const originalLstat = fs.lstatSync;
  let pointerDeleted = false;
  try {
    fs.rmSync = ((target: fs.PathLike, options?: fs.RmOptions) => {
      const result = originalRm(target, options);
      if (path.resolve(String(target)) === path.resolve(pointerPath))
        pointerDeleted = true;
      return result;
    }) as typeof fs.rmSync;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: ((target: fs.PathLike, options?: unknown) => {
        if (
          pointerDeleted &&
          path.resolve(String(target)) === path.resolve(pointerPath)
        ) {
          const error = new Error("injected observation failure") as Error & {
            code: string;
          };
          error.code = "EACCES";
          throw error;
        }
        return originalLstat(target, options as never);
      }) as typeof fs.lstatSync,
    });
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.recoveryId, fixture.recoveryId);
    assert.equal(
      fs.readdirSync(fixture.root).some((entry) => entry.includes("delete")),
      true,
    );
    assert.ok(fs.readdirSync(fixture.root).length > 0);
  } finally {
    fs.rmSync = originalRm;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: originalLstat,
    });
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("Host Root削除後の観測不能もRecovery完了へ縮退しない", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const originalRm = fs.rmSync;
  const originalLstat = fs.lstatSync;
  let hostRootDeleted = false;
  try {
    fs.rmSync = ((target: fs.PathLike, options?: fs.RmOptions) => {
      const result = originalRm(target, options);
      if (path.resolve(String(target)) === path.resolve(fixture.hostRoot))
        hostRootDeleted = true;
      return result;
    }) as typeof fs.rmSync;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: ((target: fs.PathLike, options?: unknown) => {
        if (
          hostRootDeleted &&
          path.resolve(String(target)) === path.resolve(fixture.hostRoot)
        ) {
          const error = new Error("injected observation failure") as Error & {
            code: string;
          };
          error.code = "EACCES";
          throw error;
        }
        return originalLstat(target, options as never);
      }) as typeof fs.lstatSync,
    });
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.recoveryId, fixture.recoveryId);
    assert.notEqual(result.reason, "docker_task_recovery_completed");
  } finally {
    fs.rmSync = originalRm;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: originalLstat,
    });
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("committed Host active bindingのoperation nonce差と余分fieldを削除しない", () => {
  for (const mutation of ["nonce", "extra"] as const) {
    const fixture = createKilledFullProductionRecoveryRoot("previous");
    const root = verifiedRoot(fixture.root);
    const activePath = fs
      .readdirSync(fixture.hostRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        path.join(fixture.hostRoot, entry.name, "active-docker-task-v1.json"),
      )
      .find((candidate) => fs.existsSync(candidate));
    assert.ok(activePath);
    const original = JSON.parse(fs.readFileSync(activePath, "utf8")) as Record<
      string,
      unknown
    >;
    try {
      rewriteCommittedRecoveryRecordForTest(
        activePath,
        path.basename(activePath),
        mutation === "nonce"
          ? { ...original, operationNonce: "0".repeat(64) }
          : { ...original, unexpected: true },
      );
      const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      );
      assert.equal(result.status, "blocked");
      assert.equal(result.recoveryId, fixture.recoveryId);
      assert.equal(fs.existsSync(activePath), true);
      assert.equal(fs.existsSync(fixture.hostRoot), true);
      assert.equal(fs.existsSync(fixture.hostMarker), true);
    } finally {
      disposeKilledFullProductionRecoveryFixture(fixture);
    }
  }
});

test("production共有回復engineはpending base完成直後の実process killをRecovery IDから残存0へ収束する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("pending_base");
  const root = verifiedRoot(fixture.root);
  try {
    const inventory = inspectDockerRecoveryRootSnapshotWithLock(root, () =>
      Object.freeze({ release: () => true }),
    );
    assert.equal(inventory.status, "completed");
    assert.deepEqual(inventory.dockerRecoveryIds, [fixture.recoveryId]);
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
    assert.deepEqual(
      inspectDockerRecoveryRootSnapshotWithLock(root, () =>
        Object.freeze({ release: () => true }),
      ).dockerRecoveryIds,
      [],
    );
  } finally {
    disposeKilledFullProductionRecoveryFixture(fixture);
  }
});

test("production正常完了経路はHost cleanup receipt後だけfinalizeして残存0へ収束する", async () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-normal-recovery-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const root = verifiedRoot(runtimeRootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "d".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  let recoveryCapability: object | null = null;
  try {
    const begun = beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
      plan,
      management,
      providerHomeForPlan(plan),
      root,
      () => root,
    );
    assert.ok(begun && begun.status === "ready");
    recoveryCapability = begun.recoveryCapability;
    assert.equal(recordRuntimeOwnedDockerAbsence(recoveryCapability), true);
    assert.equal(
      recordRuntimeOwnedNormalMountCompletion(recoveryCapability),
      true,
    );
    const completed = completeRuntimeOwnedDockerRecovery(
      recoveryCapability,
      management,
    );
    assert.equal(completed.status, "completed");
    assert.equal(
      finalizeRuntimeOwnedDockerRecovery(recoveryCapability).status,
      "blocked",
    );
    const hostCleanupToken =
      prepareRuntimeOwnedDockerHostCleanup(recoveryCapability);
    assert.equal(typeof hostCleanupToken, "string");
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    assert.deepEqual(recoverOwnedOperationDirectories(hostCleanupToken), {
      status: "recovered",
      reason: "host_cleanup_recovered",
      recoveryId: null,
    });
    assert.equal(
      recordRuntimeOwnedDockerHostCleanupReceipt(recoveryCapability),
      true,
    );
    assert.deepEqual(finalizeRuntimeOwnedDockerRecovery(recoveryCapability), {
      status: "completed",
    });
    recoveryCapability = null;
    assert.deepEqual(fs.readdirSync(runtimeRootPath), []);
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(fs.existsSync(initialHost.marker), false);
  } finally {
    if (recoveryCapability)
      void abandonRuntimeOwnedDockerRecovery(recoveryCapability);
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("production正常完了もactive bindingをpointer閉包前に削除しない", () => {
  for (const pointerState of ["missing", "partial", "replacement"] as const) {
    const runtimeParent = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-production-normal-pointer-test-"),
    );
    const runtimeRootPath = path.join(runtimeParent, "runtime-state");
    fs.mkdirSync(runtimeRootPath);
    const root = verifiedRoot(runtimeRootPath);
    const owned = createOwnedOperationDirectories();
    const context = createOwnedOperationContextCapability(owned);
    const mounts = createOwnedMountCapability(owned);
    const management = createOwnedOperationManagementCapability(
      context,
      mounts,
    );
    const operation = verifyOwnedOperationManagementCapability(management);
    const plan = productionPlan(operation.operationId, "d".repeat(64));
    const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
    let recoveryCapability: object | null = null;
    try {
      const begun = beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => root,
      );
      assert.ok(begun && begun.status === "ready");
      recoveryCapability = begun.recoveryCapability;
      assert.equal(recordRuntimeOwnedDockerAbsence(recoveryCapability), true);
      assert.equal(
        recordRuntimeOwnedNormalMountCompletion(recoveryCapability),
        true,
      );
      const fixture = {
        root: runtimeRootPath,
        hostRoot: owned.root,
        recoveryId: begun.recoveryId,
      };
      const paths = productionRecoveryBindingPaths(fixture);
      const pointerValue = JSON.parse(
        fs.readFileSync(paths.pointerPath, "utf8"),
      );
      const beforeActive = fs.readFileSync(paths.activePath);
      breakProductionRecoveryPointer(fixture, pointerState);
      assert.deepEqual(
        completeRuntimeOwnedDockerRecovery(recoveryCapability, management),
        { status: "blocked" },
      );
      assert.deepEqual(fs.readFileSync(paths.activePath), beforeActive);
      rewriteCommittedRecoveryRecordForTest(
        paths.pointerPath,
        path.basename(paths.pointerPath),
        pointerValue,
      );
    } finally {
      if (recoveryCapability)
        void abandonRuntimeOwnedDockerRecovery(recoveryCapability);
      void abandonOwnedHostOperationGenerationLock(management);
      fs.rmSync(owned.root, { recursive: true, force: true });
      fs.rmSync(initialHost.marker, { force: true });
      fs.rmSync(runtimeParent, { recursive: true, force: true });
    }
  }
});

type FreshRecoveryHandoff = {
  recoveryId: string;
  root: Readonly<Record<string, string>>;
  hostRoot: string;
  hostMarker: string;
  hostRecoveryId: string;
  setupPid: number;
};

function cleanupFreshRecoveryHandoff(handoff: FreshRecoveryHandoff | null) {
  if (!handoff) return;
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const parsed = parseHostRecoveryToken(handoff.hostRecoveryId);
  assert.ok(parsed);
  const hostRoot = path.resolve(handoff.hostRoot);
  const rootMetadata = fs.existsSync(hostRoot) ? fs.lstatSync(hostRoot) : null;
  if (
    path.dirname(hostRoot) === temporaryRoot &&
    path.basename(hostRoot) === parsed.rootName &&
    (!rootMetadata ||
      (rootMetadata.isDirectory() &&
        !rootMetadata.isSymbolicLink() &&
        fs.realpathSync(hostRoot) === hostRoot))
  )
    fs.rmSync(hostRoot, { recursive: true, force: true });
  const hostMarker = path.resolve(handoff.hostMarker);
  const expectedMarkerName = `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`;
  const markerMetadata = fs.existsSync(hostMarker)
    ? fs.lstatSync(hostMarker)
    : null;
  if (
    path.dirname(hostMarker) ===
      path.join(temporaryRoot, "crdd-coordinator-recovery-v1") &&
    path.basename(hostMarker) === expectedMarkerName &&
    (!markerMetadata ||
      (markerMetadata.isFile() && !markerMetadata.isSymbolicLink()))
  )
    fs.rmSync(hostMarker, { force: true });
}

test("receipt失敗後は独立Processがexact Docker IDだけで残存0へ回復する", () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-fresh-recovery-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const probe = fileURLToPath(
    new URL("./fixtures/recovery-cleanup-probe.ts", import.meta.url),
  );
  let handoff: FreshRecoveryHandoff | null = null;
  try {
    const setup = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        probe,
        "receipt-failure-setup",
        runtimeRootPath,
      ],
      { encoding: "utf8", timeout: 15_000, windowsHide: true },
    );
    assert.equal(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);
    handoff = JSON.parse(setup.stdout) as FreshRecoveryHandoff;
    assert.deepEqual(fs.readdirSync(runtimeRootPath).length > 0, true);
    const recovered = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        probe,
        "fresh-recovery",
        handoff.recoveryId,
        Buffer.from(JSON.stringify(handoff.root), "utf8").toString("base64url"),
      ],
      { encoding: "utf8", timeout: 15_000, windowsHide: true },
    );
    assert.equal(
      recovered.status,
      0,
      `${recovered.stdout}\n${recovered.stderr}`,
    );
    const recoveredResult = JSON.parse(recovered.stdout) as Record<
      string,
      unknown
    >;
    assert.notEqual(recoveredResult.probePid, handoff.setupPid);
    delete recoveredResult.probePid;
    assert.deepEqual(recoveredResult, {
      status: "recovered",
      reason: "docker_task_recovery_finalization_completed",
      recoveryId: null,
    });
    assert.deepEqual(fs.readdirSync(runtimeRootPath), []);
    assert.equal(fs.existsSync(handoff.hostRoot), false);
    assert.equal(fs.existsSync(handoff.hostMarker), false);
  } finally {
    cleanupFreshRecoveryHandoff(handoff);
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("active binding削除済み・pointer残存もfresh Processで残存0へ回復する", () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-active-deleted-recovery-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const probe = fileURLToPath(
    new URL("./fixtures/recovery-cleanup-probe.ts", import.meta.url),
  );
  let handoff: FreshRecoveryHandoff | null = null;
  try {
    const setup = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        probe,
        "active-deleted-pointer-setup",
        runtimeRootPath,
      ],
      { encoding: "utf8", timeout: 15_000, windowsHide: true },
    );
    assert.equal(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);
    handoff = JSON.parse(setup.stdout) as FreshRecoveryHandoff;
    const recovered = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        probe,
        "fresh-recovery",
        handoff.recoveryId,
        Buffer.from(JSON.stringify(handoff.root), "utf8").toString("base64url"),
      ],
      { encoding: "utf8", timeout: 15_000, windowsHide: true },
    );
    assert.equal(
      recovered.status,
      0,
      `${recovered.stdout}\n${recovered.stderr}`,
    );
    const recoveredResult = JSON.parse(recovered.stdout) as Record<
      string,
      unknown
    >;
    assert.notEqual(recoveredResult.probePid, handoff.setupPid);
    delete recoveredResult.probePid;
    assert.deepEqual(recoveredResult, {
      status: "recovered",
      reason: "docker_task_recovery_completed",
      recoveryId: null,
    });
    assert.deepEqual(fs.readdirSync(runtimeRootPath), []);
    assert.equal(fs.existsSync(handoff.hostRoot), false);
    assert.equal(fs.existsSync(handoff.hostMarker), false);
  } finally {
    cleanupFreshRecoveryHandoff(handoff);
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("production共有回復engineはHost third世代を上書きせずfail closedする", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const beforeEntries = fs.readdirSync(fixture.root).sort();
  try {
    const hostRecord = JSON.parse(
      fs.readFileSync(fixture.hostMarker, "utf8"),
    ) as Record<string, unknown>;
    fs.writeFileSync(
      fixture.hostMarker,
      `${JSON.stringify({ ...hostRecord, state: "docker_absent_confirmed" })}\n`,
      "utf8",
    );
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_recovery_host_transition_third_state",
        recoveryId: fixture.recoveryId,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root).sort(), beforeEntries);
    assert.equal(fs.existsSync(fixture.hostRoot), true);
    assert.equal(fs.existsSync(fixture.hostMarker), true);
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production共有回復engineはselected-user再bind不一致をEffect前に停止する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const changedUserRoot = Object.freeze({
    ...root,
    localUserBindingHash: "0".repeat(64),
  });
  const beforeEntries = fs.readdirSync(fixture.root).sort();
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => changedUserRoot,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId: fixture.recoveryId,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root).sort(), beforeEntries);
    assert.equal(fs.existsSync(fixture.hostRoot), true);
    assert.equal(fs.existsSync(fixture.hostMarker), true);
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production共有回復engineはnative観測中にHost世代とRuntimeState世代を解放して同一世代へ再取得する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("expected");
  const root = verifiedRoot(fixture.root);
  const operationDirectory = fs
    .readdirSync(fixture.root)
    .find((name) => name.startsWith("docker-task-"));
  assert.ok(operationDirectory);
  const base = readCommittedDockerRecoveryJson(
    path.join(fixture.root, operationDirectory, "base.json"),
    "base.json",
  ).value as Record<string, unknown>;
  const hostNonce = parseHostRecoveryToken(base.initialHostRecoveryId).nonce;
  let hostGenerationWasReleasedForObservation = false;
  let runtimeStateGenerationWasReleasedForObservation = false;
  try {
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => {
        const hostGeneration = acquireHostOperationRecoveryGenerationByIdentity(
          fixture.hostRoot,
          hostNonce,
        );
        hostGenerationWasReleasedForObservation = Boolean(hostGeneration);
        const runtimeStateGeneration =
          acquireRuntimeOwnedDockerRuntimeStateKernelLock(
            root.stableLogicalHomeBindingHash,
          );
        runtimeStateGenerationWasReleasedForObservation = Boolean(
          runtimeStateGeneration,
        );
        assert.equal(runtimeStateGeneration?.release(), true);
        assert.equal(
          releaseHostOperationRecoveryGeneration(hostGeneration),
          true,
        );
        return null;
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "docker_task_runtime_state_binding_changed");
    assert.equal(hostGenerationWasReleasedForObservation, true);
    assert.equal(runtimeStateGenerationWasReleasedForObservation, true);
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production共有回復engineはDocker照会中もHost世代とRuntimeState世代を解放して同一世代へ再取得する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("submission");
  const root = verifiedRoot(fixture.root);
  const operationDirectory = fs
    .readdirSync(fixture.root)
    .find((name) => name.startsWith("docker-task-"));
  assert.ok(operationDirectory);
  const base = readCommittedDockerRecoveryJson(
    path.join(fixture.root, operationDirectory, "base.json"),
    "base.json",
  ).value as Record<string, unknown>;
  const hostNonce = parseHostRecoveryToken(base.initialHostRecoveryId).nonce;
  let dockerRunnerObservedReleasedHostGeneration = false;
  let dockerRunnerObservedReleasedRuntimeStateGeneration = false;
  let lockObservationCompleted = false;
  try {
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      fixture.recoveryId,
      root,
      () => root,
      () => {
        if (!lockObservationCompleted) {
          const hostGeneration =
            acquireHostOperationRecoveryGenerationByIdentity(
              fixture.hostRoot,
              hostNonce,
            );
          dockerRunnerObservedReleasedHostGeneration = Boolean(hostGeneration);
          const runtimeStateGeneration =
            acquireRuntimeOwnedDockerRuntimeStateKernelLock(
              root.stableLogicalHomeBindingHash,
            );
          dockerRunnerObservedReleasedRuntimeStateGeneration = Boolean(
            runtimeStateGeneration,
          );
          assert.equal(runtimeStateGeneration?.release(), true);
          assert.equal(
            releaseHostOperationRecoveryGeneration(hostGeneration),
            true,
          );
          lockObservationCompleted = true;
        }
        return dockerResult("");
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "docker_task_recovery_create_outcome_unknown");
    assert.equal(dockerRunnerObservedReleasedHostGeneration, true);
    assert.equal(dockerRunnerObservedReleasedRuntimeStateGeneration, true);
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("cleanup-only回復も作成時selected-user再bind不一致を削除前に停止する", () => {
  const rootPath = createKilledProductionCleanupRoot();
  const root = verifiedRoot(rootPath);
  const changedUserRoot = Object.freeze({
    ...root,
    localUserBindingHash: "0".repeat(64),
  });
  const beforeEntries = fs.readdirSync(rootPath).sort();
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        dockerTaskRecoveryId,
        root,
        () => changedUserRoot,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId: dockerTaskRecoveryId,
      },
    );
    assert.deepEqual(fs.readdirSync(rootPath).sort(), beforeEntries);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production beginはlock取得後のRuntimeState再bind不一致を初回記録前に停止する", () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-begin-rebind-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const root = verifiedRoot(runtimeRootPath);
  const changedRoot = Object.freeze({
    ...root,
    runtimeStateProtectionHash: "0".repeat(64),
  });
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "e".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  let runtimeStateLockWasReleasedForObservation = false;
  try {
    assert.deepEqual(
      beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => {
          const observationLock =
            acquireRuntimeOwnedDockerRuntimeStateKernelLock(
              root.stableLogicalHomeBindingHash,
            );
          runtimeStateLockWasReleasedForObservation = Boolean(observationLock);
          assert.equal(observationLock?.release(), true);
          return changedRoot;
        },
      ),
      {
        status: "blocked",
        recoveryId: null,
        manualRecoveryRequired: true,
        reason: "docker_recovery_initialization_failed_closed",
      },
    );
    assert.equal(runtimeStateLockWasReleasedForObservation, true);
    assert.deepEqual(fs.readdirSync(runtimeRootPath), []);
    assert.equal(
      loadHostRecoveryRecordByToken(owned.hostRecoveryId).record.state,
      "host_only",
    );
  } finally {
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("独立2 processでも同じHomeはexact-oneとなり別Homeを妨げない", async () => {
  const blockedRoot = createKilledProductionCleanupRoot();
  const sameHomeHolder = spawnLogicalHomeLockHolder(stableHome);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        dockerTaskRecoveryId,
        verifiedRoot(blockedRoot),
        () => verifiedRoot(blockedRoot),
      ),
      {
        status: "blocked",
        reason: "docker_task_process_generation_active_or_unknown",
        recoveryId: dockerTaskRecoveryId,
      },
    );
  } finally {
    sameHomeHolder.child.kill();
    await once(sameHomeHolder.child, "exit");
    fs.rmSync(sameHomeHolder.readyDirectory, {
      recursive: true,
      force: true,
    });
    fs.rmSync(blockedRoot, { recursive: true, force: true });
  }

  const completedRoot = createKilledProductionCleanupRoot();
  const otherHomeHolder = spawnLogicalHomeLockHolder("8".repeat(64));
  try {
    assert.equal(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        dockerTaskRecoveryId,
        verifiedRoot(completedRoot),
        () => verifiedRoot(completedRoot),
      ).status,
      "recovered",
    );
    assert.deepEqual(fs.readdirSync(completedRoot), []);
  } finally {
    otherHomeHolder.child.kill();
    await once(otherHomeHolder.child, "exit");
    fs.rmSync(otherHomeHolder.readyDirectory, {
      recursive: true,
      force: true,
    });
    fs.rmSync(completedRoot, { recursive: true, force: true });
  }
});

test("production共有Docker回復はexact IDと全構成一致だけを削除する", () => {
  const fixture = exactContainerRunner();
  assert.equal(
    recoverExactDockerResourceWithRunner(
      fixture.runDockerCommand,
      "container",
      fixture.dockerId,
      "provider",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_provider",
      Object.freeze(["internal"]),
      "isolated_task",
      "read_write",
    ),
    true,
  );
  assert.equal(fixture.removeCount(), 1);
});

test("production共有Docker回復はreplacement構成を削除せずEvidenceを保持する", () => {
  const fixture = exactContainerRunner({ Name: "/replacement" });
  assert.equal(
    recoverExactDockerResourceWithRunner(
      fixture.runDockerCommand,
      "container",
      fixture.dockerId,
      "provider",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_provider",
      Object.freeze(["internal"]),
      "isolated_task",
      "read_write",
    ),
    false,
  );
  assert.equal(fixture.removeCount(), 0);
});

test("production共有Docker回復はreceipt前crashの二軸不存在をsettlement証明にしない", () => {
  const observedCalls: string[][] = [];
  const result = recoverUnknownDockerCreateOutcomeWithRunner(
    (argv) => {
      observedCalls.push([...argv]);
      return dockerResult();
    },
    "container",
    "auth-probe",
    "crdd.coordinator.runtime=0123456789abcdef",
    `sha256:${"b".repeat(64)}`,
    null,
    "create_subscription_auth_probe",
    Object.freeze([]),
    "isolated_task",
    "read_write",
  );
  assert.equal(result, null);
  assert.equal(observedCalls.length, 2);
  assert.equal(observedCalls[0]?.includes("name=^/auth-probe$"), true);
  assert.equal(
    observedCalls[1]?.includes(
      "label=crdd.coordinator.runtime=0123456789abcdef",
    ),
    true,
  );
});

test("production共有Docker回復はreceipt前crashの同一owned resourceを削除前にexact IDへ固定する", () => {
  const fixture = exactContainerRunner();
  assert.equal(
    recoverUnknownDockerCreateOutcomeWithRunner(
      fixture.runDockerCommand,
      "container",
      "provider",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_provider",
      Object.freeze(["internal"]),
      "isolated_task",
      "read_write",
    ),
    fixture.dockerId,
  );
  assert.equal(fixture.removeCount(), 0);
});

test("production共有Docker回復はauth probeのDocker none network表現だけを受理する", () => {
  const accepted = exactAuthRunner();
  assert.equal(
    recoverUnknownDockerCreateOutcomeWithRunner(
      accepted.runDockerCommand,
      "container",
      "crdd-auth-0123456789abcdef",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"a".repeat(64)}`,
      null,
      "create_subscription_auth_probe",
      Object.freeze(["none"]),
      "isolated_task",
      "read_write",
    ),
    accepted.dockerId,
  );
  assert.equal(accepted.removeCount(), 0);

  for (const networks of [[], ["foreign"], ["none", "foreign"]] as const) {
    const rejected = exactAuthRunner(networks);
    assert.equal(
      recoverUnknownDockerCreateOutcomeWithRunner(
        rejected.runDockerCommand,
        "container",
        "crdd-auth-0123456789abcdef",
        "crdd.coordinator.runtime=0123456789abcdef",
        `sha256:${"a".repeat(64)}`,
        null,
        "create_subscription_auth_probe",
        Object.freeze(["none"]),
        "isolated_task",
        "read_write",
      ),
      null,
    );
    assert.equal(rejected.removeCount(), 0);
  }
});

test("production共有Docker回復はreceipt前proxyのinternal-only構成を削除前にexact IDへ固定する", () => {
  const internal = "crdd-internal-0123456789abcdef";
  const fixture = exactProxyRunner([internal]);
  assert.equal(
    recoverUnknownDockerCreateOutcomeWithRunner(
      fixture.runDockerCommand,
      "container",
      "crdd-proxy-0123456789abcdef",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_proxy",
      Object.freeze([internal]),
      "isolated_task",
      "read_write",
    ),
    fixture.dockerId,
  );
  assert.equal(fixture.removeCount(), 0);
});

for (const networkState of ["pre-connect", "post-connect"] as const) {
  test(`production共有Docker回復はreceipt済みproxyの${networkState}閉集合だけを回収する`, () => {
    const fixture = createKilledFullProductionRecoveryRoot("receipt_proxy");
    const root = verifiedRoot(fixture.root);
    const internal = "crdd-internal-0123456789abcdef";
    const egress = "crdd-egress-0123456789abcdef";
    const docker = exactProxyRunner(
      networkState === "pre-connect" ? [internal] : [internal, egress],
    );
    try {
      assert.deepEqual(
        recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
          fixture.recoveryId,
          root,
          () => root,
          docker.runDockerCommand,
        ),
        {
          status: "recovered",
          reason: "docker_task_recovery_completed",
          recoveryId: null,
        },
      );
      assert.equal(docker.removeCount(), 1);
      assert.deepEqual(fs.readdirSync(fixture.root), []);
      assert.equal(fs.existsSync(fixture.hostRoot), false);
      assert.equal(fs.existsSync(fixture.hostMarker), false);
    } finally {
      disposeKilledFullProductionRecoveryFixture(fixture);
    }
  });
}

for (const [networkState, networks] of [
  ["none", []],
  ["egress-only", ["crdd-egress-0123456789abcdef"]],
  [
    "additional",
    [
      "crdd-internal-0123456789abcdef",
      "crdd-egress-0123456789abcdef",
      "foreign",
    ],
  ],
] as const) {
  test(`production共有Docker回復はreceipt済みproxyの${networkState}構成を削除しない`, () => {
    const fixture = createKilledFullProductionRecoveryRoot("receipt_proxy");
    const root = verifiedRoot(fixture.root);
    const docker = exactProxyRunner(networks);
    try {
      assert.deepEqual(
        recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
          fixture.recoveryId,
          root,
          () => root,
          docker.runDockerCommand,
        ),
        {
          status: "blocked",
          reason: "docker_task_recovery_resource_mismatch",
          recoveryId: fixture.recoveryId,
        },
      );
      assert.equal(docker.removeCount(), 0);
      assert.ok(fs.readdirSync(fixture.root).length > 0);
      assert.equal(fs.existsSync(fixture.hostRoot), true);
      assert.equal(fs.existsSync(fixture.hostMarker), true);
    } finally {
      disposeKilledFullProductionRecoveryFixture(fixture);
    }
  });
}

test("production共有Docker回復はreceipt前crashのforeign／ambiguous resourceを採用しない", () => {
  const dockerId = "a".repeat(64);
  for (const [named, owned] of [
    [`${dockerId}\n`, ""],
    ["", `${dockerId}\n`],
    [`${dockerId}\n`, `${"b".repeat(64)}\n`],
    [`${dockerId}\n${"b".repeat(64)}\n`, `${dockerId}\n`],
  ] as const) {
    assert.equal(
      recoverUnknownDockerCreateOutcomeWithRunner(
        (argv) =>
          dockerResult(
            argv.some((value) => value.startsWith("label=")) ? owned : named,
          ),
        "container",
        "provider",
        "crdd.coordinator.runtime=0123456789abcdef",
        `sha256:${"b".repeat(64)}`,
        null,
        "create_provider",
        Object.freeze(["internal"]),
        "isolated_task",
        "read_write",
      ),
      null,
    );
  }
});

test("production共有Docker回復は発見IDがinspect前に消えた場合も完了へ進めない", () => {
  const dockerId = "a".repeat(64);
  let callCount = 0;
  assert.equal(
    recoverUnknownDockerCreateOutcomeWithRunner(
      () => {
        callCount += 1;
        return dockerResult(callCount <= 2 ? `${dockerId}\n` : "");
      },
      "container",
      "provider",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_provider",
      Object.freeze(["internal"]),
      "isolated_task",
      "read_write",
    ),
    null,
  );
  assert.equal(callCount, 3);
});

test("production共有Docker回復はreceipt前照会の失敗・signal・stderr・不正IDを処置0へ閉じる", () => {
  const cases = [
    dockerResult("not-a-docker-id\n"),
    dockerResult(`${"a".repeat(64)}\n${"b".repeat(64)}\n`),
    Object.freeze({
      status: 1,
      signal: null,
      stdout: "",
      stderr: "",
      error: null,
    }),
    Object.freeze({
      status: 0,
      signal: "SIGTERM" as const,
      stdout: "",
      stderr: "",
      error: null,
    }),
    Object.freeze({
      status: 0,
      signal: null,
      stdout: "",
      stderr: "docker unavailable",
      error: null,
    }),
    Object.freeze({
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: new Error("spawn failed"),
    }),
  ];
  for (const result of cases) {
    let callCount = 0;
    assert.equal(
      recoverUnknownDockerCreateOutcomeWithRunner(
        () => {
          callCount += 1;
          return result;
        },
        "container",
        "provider",
        "crdd.coordinator.runtime=0123456789abcdef",
        `sha256:${"b".repeat(64)}`,
        null,
        "create_provider",
        Object.freeze(["internal"]),
        "isolated_task",
        "read_write",
      ),
      null,
    );
    assert.ok(callCount >= 1 && callCount <= 2);
  }
});

test("Docker Recovery contractはEffect前記録とcleanup後完了を固定する", () => {
  assert.deepEqual(describeDockerRecoveryRuntimeContract(), {
    contract: "crdd-coordinator/docker-recovery-runtime",
    contractRevision: 21,
    durableStateBeforeDockerEffect: "docker_submission_started",
    durableStateAfterCleanup: "host_only",
    capability: "opaque_process_local_single_completion",
    crashRecovery: "durable_recovery_id_returned_for_manual_recovery",
    runtimeStateRoot:
      "selected_user_runtime_owned_fixed_known_folder_protected_root",
    runtimeStateRevalidation:
      "native_root_identity_protection_and_selected_user_observed_outside_the_runtime_state_lock_then_same_root_filesystem_identity_and_full_inventory_verified_after_reacquisition_before_each_mutation_and_after_effect",
    runtimeStateCreationBinding:
      "base_cleanup_manifest_and_root_cleanup_anchor_bind_creation_identity_protection_selected_user_and_runtime_state_hash",
    logicalHomeLease:
      "stable_sid_provider_namespace_kernel_lock_and_durable_active_pointer",
    resourceJournal:
      "file_fsync_base_commit_pointer_identity_host_active_binding_then_exact_docker_id_receipt",
    rootJournalResume:
      "exact_recovery_id_and_creation_binding_with_non_target_byte_identity_preservation",
    completionEvidence:
      "exact_durable_evidence_required_and_empty_root_is_not_a_receipt",
    offlineRecovery:
      "receipt_missing_empty_observation_remains_manual_discovered_exact_id_requires_full_configuration_and_durable_reconciled_receipt_before_removal",
    hostFinalization:
      "host_generation_owner_and_inventory_then_cleanup_intent_receipt_and_exact_removal",
    synchronizationRelease:
      "runtime_state_home_and_host_generation_release_confirmed_before_success",
    productionFacade:
      "native_observation_only_with_internal_contract_engine_excluded_by_package_exports",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
});
