/**
 * Coordinator最新現在状態の実Filesystem保存を自己生成Repositoryで確認する。
 * @packageDocumentation
 * @responsibility 固定配置、pending再入場、拒否時の保全とOwner失効を検証する。
 * @trace ERB-IT-003 ERB-IT-014
 * @level IT
 * @scope Coordinator現在状態、fresh回収Owner、Host清掃後保存、Repository-local Filesystem。
 * @boundary ERB-IT-003=Direct Boundary: 現在状態Writer→Repository-local Filesystem。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在準備Owner・Kernel排他→現在状態Writer／Filesystem。
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  isDockerResourcePurpose,
  planDockerRecoveryResourceExpectations,
} from "../../../docker-isolation/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import * as projectStorage from "../../../orchestrator/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import * as dockerController from "../../src/provider/execution-controller.ts";
import {
  finalizeRuntimeOwnedDockerRestartPreparation,
  persistRuntimeOwnedDockerRestartCheckpoint,
  persistRuntimeOwnedDockerTaskRecoveryCheckpoint,
  prepareRuntimeOwnedDockerRestart,
  prepareRuntimeOwnedDockerTaskRecovery,
  prepareRuntimeOwnedRepositoryDockerOperationIdentity,
  recoverRuntimeOwnedDockerTaskFromCurrentRepository,
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  releaseRuntimeOwnedDockerRestartPreparation,
  releaseRuntimeOwnedDockerTaskRecoveryPreparation,
  verifyRuntimeOwnedDockerRestartPreparation,
} from "../../src/task/recovery.ts";
import * as stateKernelLocks from "../../src/host-execution/kernel-lock.ts";
import * as executionEnvironment from "../../src/host-execution/operation-workspace-lifecycle.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  beginOwnedDockerSubmissionRecovery,
  borrowOwnedHostRecoverySnapshot,
  cleanupOwnedOperationDirectories,
  cleanupOwnedOperationDirectoriesAsync,
  completeOwnedDockerSubmissionRecovery,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  recoverOwnedOperationDirectories,
} from "../../src/host-execution/operation-workspace-lifecycle.ts";
import { loadHostRecoveryRecordByToken } from "../../src/host-execution/recovery-record.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
} from "../../src/repository-operation/binding.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  coordinatorTaskResourcesAreSettled,
  coordinatorAuthenticationUnknownCanClose,
  type CoordinatorStateOperation,
  type CoordinatorStateTaskOperation,
  coordinatorStateContentHash,
  decodeCoordinatorStateSnapshot,
  decodeCoordinatorHistoryRows,
  encodeCoordinatorStateValue,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHistorySummary,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateProjectAcceptanceSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateRepairCheckpointSnapshot,
  prepareCoordinatorStateRepairSessionSnapshot,
  prepareCoordinatorStateRepairSnapshot,
  prepareCoordinatorStateResourceSnapshot,
} from "../../src/state-storage/model.ts";
import { observeRuntimeOwnedWorkbenchTaskCompletion } from "../../src/state-storage/settlement-store.ts";
import {
  createDockerRestartRequestId,
  type DockerRestartCheckpoint,
} from "../../src/state-storage/restart-checkpoint.ts";
import {
  checkpointRuntimeOwnedCoordinatorCleanup,
  checkpointRuntimeOwnedCoordinatorHost,
  checkpointRuntimeOwnedCoordinatorLifecycle,
  checkpointRuntimeOwnedCoordinatorReferences,
  checkpointRuntimeOwnedCoordinatorResource,
  checkpointRuntimeOwnedCoordinatorResourceNotIssued,
  checkpointRuntimeOwnedCoordinatorRestart,
  advanceRuntimeOwnedCoordinatorRecoveryHistory,
  completeRuntimeOwnedCoordinatorCurrentRecovery,
  prepareRuntimeOwnedCoordinatorSettlement,
  prepareRuntimeOwnedCoordinatorStateInitialization,
  publishRuntimeOwnedCoordinatorHistory,
  readRuntimeOwnedCoordinatorRecoverySnapshot,
  readRuntimeOwnedCoordinatorResourcePublicationSnapshot,
  resumeRuntimeOwnedCoordinatorResourcePublication,
  readRuntimeOwnedCoordinatorCurrentHistorySnapshot,
  readRuntimeOwnedCoordinatorCurrentCompletionSnapshot,
  readRuntimeOwnedCoordinatorResourceRequests,
  readRuntimeOwnedCoordinatorSettlementSnapshot,
  readRuntimeOwnedCoordinatorStateSnapshot,
  saveRuntimeOwnedCoordinatorOperationStart,
  writeRuntimeOwnedCoordinatorHistoryCheckpoint,
  writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure,
  writeRuntimeOwnedCoordinatorRecoveryCheckpoint,
  writeRuntimeOwnedCoordinatorRepairSnapshot,
  writeRuntimeOwnedCoordinatorRestartCheckpoint,
  writeRuntimeOwnedCoordinatorSettlement,
  writeRuntimeOwnedCoordinatorStateSnapshot,
} from "../../src/state-storage/settlement-store.ts";

/**
 * 固定二File保存と同じ更新の再入場、保全停止を確認する。
 * @responsibility 自己生成Repositoryで実保存・現在回収Owner・拒否境界を観測する。
 * @trace ERB-IT-003 ERB-IT-014
 * @precondition Windowsの実効排他とRepository内試験領域だけを使う。
 * @stimulus 初回・次版・pending再入場、不一致・hardlink・Owner失効、実CLIの単一Host／Probe・重複・別Repository・旧token拒否と、実準備Map／Kernel排他／Writerで再起動要求の全保存段階を処置する。技術完了入力は合成としNative／Docker要求を発行しない。
 * @observation 本文、pendingとlock不存在、拒否結果、再起動欄とReader／Writer境界の排他・Owner再確認。
 * @oracle 同じ更新だけ成功し、別pendingや不正入力を上書きしない。再起動保存の拒否は本文不変・Host要求0とし、排他終了不明を保持する。
 * @cleanup 所有操作を閉じ、自己生成した子Repositoryだけを削除する。
 * @boundary ERB-IT-003=Direct Boundary: Writer→実FilesystemとOS排他。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在準備Owner・Kernel排他→現在状態Writer／Filesystem。
 */
test("Host Windows: Coordinator現在状態の保存とpending再入場", async (t) => {
  assert.equal(process.platform, "win32");
  const tests = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "test_root",
  );
  const root = fs.mkdtempSync(path.join(tests.directory, "coordinator-state-"));
  let owned: ReturnType<typeof createOwnedOperationDirectories> | null = null;
  let isCleaned = false;
  t.after(() => {
    if (owned && !isCleaned) cleanupOwnedOperationDirectories(owned);
    fs.rmSync(root, { recursive: true });
    if (fs.readdirSync(tests.directory).length === 0)
      fs.rmdirSync(tests.directory);
  });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const ownArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests"),
    "owned_root",
  );
  owned = createOwnedOperationDirectories(ownArea.directory);
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  const binding = bindRuntimeOwnedRepositoryOperation(management, root);
  assert.ok(binding);
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(repository);
  const verifiedRoot = verifyRepositoryRoot(root);
  assert.equal(verifiedRoot.status, "completed");
  assert.ok(verifiedRoot.capability);
  assert.equal(
    readRuntimeOwnedCoordinatorRecoverySnapshot(verifiedRoot.capability).status,
    "blocked",
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd", "coordinator")), false);
  const first = {
    schema: COORDINATOR_STATE_SCHEMA,
    revision: 1,
    previous: null,
    repositoryBinding: repository.repositoryBinding,
    operations: [],
    unresolvedRecoveries: [],
    pendingDeliveries: [],
  };
  const firstBytes = Buffer.from(`${encodeCoordinatorStateValue(first)}\n`);
  assert.equal(
    readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    prepareRuntimeOwnedCoordinatorStateInitialization(management, firstBytes)
      .status,
    "prepared",
  );
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "coordinator"),
    "state_root",
  );
  assert.equal(
    prepareRuntimeOwnedCoordinatorStateInitialization(management, firstBytes)
      .status,
    "blocked",
  );
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot({}, firstBytes)
      .filesystemEffectIssued,
    false,
  );
  const result = writeRuntimeOwnedCoordinatorStateSnapshot(
    management,
    firstBytes,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.snapshotConfirmed, true);
  assert.equal(result.lockReleased, true);
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  const readFirst = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(readFirst.status, "completed");
  assert.equal(readFirst.lockReleased, true);
  assert.equal(readFirst.value?.snapshot.revision, 1);
  assert.equal(
    readFirst.value?.payloadSha256,
    coordinatorStateContentHash(first),
  );
  assert.equal(readRuntimeOwnedCoordinatorStateSnapshot({}).status, "blocked");
  const recoveryRead = readRuntimeOwnedCoordinatorRecoverySnapshot(
    verifiedRoot.capability,
  );
  assert.equal(recoveryRead.status, "completed");
  assert.equal(recoveryRead.lockReleased, true);
  assert.deepEqual(recoveryRead.value, readFirst.value);
  for (const invalidRoot of [null, {}, { ...verifiedRoot.capability }, root]) {
    const rejectedRoot =
      readRuntimeOwnedCoordinatorRecoverySnapshot(invalidRoot);
    assert.equal(rejectedRoot.status, "blocked");
    assert.equal(rejectedRoot.value, null);
  }
  const freshProcessRead = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "-e",
        `(async () => {
     const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
     const { readRuntimeOwnedCoordinatorRecoverySnapshot } = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
     const root = verifyRepositoryRoot(process.argv[1]);
     const result = readRuntimeOwnedCoordinatorRecoverySnapshot(root.capability);
     process.stdout.write(JSON.stringify({status: result.status, lockReleased: result.lockReleased, hash: result.value?.payloadSha256 ?? null}));
     })().catch(error => { console.error(error); process.exitCode = 1; });`,
        root,
      ],
      { windowsHide: true, encoding: "utf8", timeout: 30_000 },
    ),
  );
  assert.deepEqual(freshProcessRead, {
    status: "completed",
    lockReleased: true,
    hash: readFirst.value?.payloadSha256,
  });
  const otherRoot = path.join(root, "other-repository");
  fs.mkdirSync(otherRoot);
  execFileSync("git", ["init", "--quiet", otherRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      otherRoot,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "other fixture",
    ],
    { windowsHide: true },
  );
  const verifiedOtherRoot = verifyRepositoryRoot(otherRoot);
  assert.ok(verifiedOtherRoot.capability);
  const otherArea = path.join(otherRoot, ".crdd", "coordinator");
  fs.mkdirSync(otherArea, { recursive: true });
  fs.writeFileSync(path.join(otherArea, "state.json"), firstBytes, {
    flag: "wx",
  });
  const foreignSnapshot = readRuntimeOwnedCoordinatorRecoverySnapshot(
    verifiedOtherRoot.capability,
  );
  assert.equal(foreignSnapshot.status, "blocked");
  assert.equal(foreignSnapshot.value, null);
  assert.deepEqual(
    fs.readFileSync(path.join(otherArea, "state.json")),
    firstBytes,
  );
  const borrowedOtherRoot = borrowRuntimeOwnedCoordinatorRecoveryRepository(
    verifiedOtherRoot.capability,
  );
  assert.ok(borrowedOtherRoot);
  assert.equal(borrowedOtherRoot.revalidate(), true);
  fs.renameSync(otherRoot, `${otherRoot}-previous`);
  fs.mkdirSync(otherRoot);
  execFileSync("git", ["init", "--quiet", otherRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      otherRoot,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "replacement fixture",
    ],
    { windowsHide: true },
  );
  assert.equal(borrowedOtherRoot.revalidate(), false);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    firstBytes,
  );
  // 公開後に消えた現在状態を初回の空領域として再作成しない。
  fs.unlinkSync(path.join(area.directory, "state.json"));
  assert.equal(
    readRuntimeOwnedCoordinatorRecoverySnapshot(verifiedRoot.capability).status,
    "blocked",
  );
  assert.equal(fs.existsSync(path.join(area.directory, "state.json")), false);
  assert.equal(
    readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, firstBytes)
      .filesystemEffectIssued,
    false,
  );
  assert.equal(
    prepareRuntimeOwnedCoordinatorStateInitialization(management, firstBytes)
      .status,
    "blocked",
  );
  fs.writeFileSync(path.join(area.directory, "state.json"), firstBytes, {
    flag: "wx",
  });
  const second = {
    ...first,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: coordinatorStateContentHash(first),
    },
  };
  const secondBytes = Buffer.from(`${encodeCoordinatorStateValue(second)}\n`);
  // 同じ本文への実体差し替えを、公開前の再観測で拒否する。
  const originalFsync = fs.fsyncSync;
  let isReplaced = false;
  fs.fsyncSync = (fd) => {
    originalFsync(fd);
    if (!isReplaced) {
      isReplaced = true;
      const state = path.join(area.directory, "state.json");
      fs.renameSync(state, path.join(root, "replaced-state"));
      fs.writeFileSync(state, firstBytes, { flag: "wx" });
    }
  };
  try {
    const replacement = writeRuntimeOwnedCoordinatorStateSnapshot(
      management,
      secondBytes,
    );
    assert.equal(replacement.status, "blocked");
    assert.equal(replacement.snapshotConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      firstBytes,
    );
  } finally {
    fs.fsyncSync = originalFsync;
  }
  fs.unlinkSync(path.join(area.directory, "state.lock"));
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.pending.json")),
    secondBytes,
  );
  fs.unlinkSync(path.join(area.directory, "state.pending.json"));
  fs.writeFileSync(
    path.join(area.directory, "state.pending.json"),
    secondBytes,
    { flag: "wx" },
  );
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, secondBytes).status,
    "completed",
  );
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    secondBytes,
  );
  // 正規保存済みと同じpending残存は再適用せず短命物だけを回収する。
  fs.writeFileSync(
    path.join(area.directory, "state.pending.json"),
    secondBytes,
    { flag: "wx" },
  );
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, secondBytes).status,
    "completed",
  );
  fs.writeFileSync(path.join(area.directory, "state.pending.json"), "invalid", {
    flag: "wx",
  });
  assert.equal(
    readRuntimeOwnedCoordinatorStateSnapshot(management).reason,
    "coordinator_state_reentry_required",
  );
  assert.equal(
    readRuntimeOwnedCoordinatorRecoverySnapshot(verifiedRoot.capability).reason,
    "coordinator_state_reentry_required",
  );
  const rejected = writeRuntimeOwnedCoordinatorStateSnapshot(
    management,
    secondBytes,
  );
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.filesystemEffectIssued, false);
  assert.equal(
    fs.readFileSync(path.join(area.directory, "state.pending.json"), "utf8"),
    "invalid",
  );
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    secondBytes,
  );
  fs.unlinkSync(path.join(area.directory, "state.pending.json"));
  const hardlink = path.join(root, "state-hardlink");
  fs.linkSync(path.join(area.directory, "state.json"), hardlink);
  assert.equal(
    readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, secondBytes)
      .filesystemEffectIssued,
    false,
  );
  fs.unlinkSync(hardlink);
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${hostHash}`;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v1",
    operationNonce: "b".repeat(64),
    provider: "claude",
    consumer: "orchestrator",
    operationId: repository.operationId,
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: repository.repositoryBinding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const operationBytes = prepareCoordinatorStateOperationSnapshot(
    secondBytes,
    `${JSON.stringify(identity)}\n`,
    repository.repositoryBinding,
  );
  assert.ok(operationBytes);
  // CLI自身と実Readerを使い、処置境界だけを無Effectの観測へ置き換える。
  const cliIdentity = {
    ...identity,
    hostPaths: {
      root: path.join(root, "crdd-coordinator-doctor-fixture"),
      marker: path.join(root, "marker-fixture"),
    },
  };
  const singleCliBytes = prepareCoordinatorStateOperationSnapshot(
    secondBytes,
    `${JSON.stringify(cliIdentity)}\n`,
    repository.repositoryBinding,
  );
  assert.ok(singleCliBytes);
  const duplicateCliBytes = prepareCoordinatorStateOperationSnapshot(
    singleCliBytes,
    `${JSON.stringify({
      ...cliIdentity,
      operationNonce: "d".repeat(64),
      operationId: "OP-999999999999999999999999999999999999999",
      stableLogicalHomeBindingHash: "e".repeat(64),
    })}\n`,
    repository.repositoryBinding,
  );
  assert.ok(duplicateCliBytes);
  const probeCliBytes = prepareCoordinatorStateOperationSnapshot(
    secondBytes,
    `${JSON.stringify({ ...cliIdentity, operationMode: "boolean_probe" })}\n`,
    repository.repositoryBinding,
  );
  assert.ok(probeCliBytes);
  const probeToken = `docker.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.12345678-1234-4234-8234-123456789abc.${"f".repeat(64)}`;
  const cliModule = new URL("../../src/cli/command.ts", import.meta.url).href;
  const hostModule = new URL(
    "../../src/host-execution/operation-workspace-lifecycle.ts",
    import.meta.url,
  ).href;
  const probeModule = new URL(
    "../../src/diagnostics/isolation-probe.ts",
    import.meta.url,
  ).href;
  for (const [bytes, recoveryId, expectedKind, workingDirectory = root] of [
    [singleCliBytes, token, "host"],
    [probeCliBytes, probeToken, "probe"],
    [secondBytes, token, null],
    [duplicateCliBytes, token, null],
    [singleCliBytes, token.replace(hostHash, "e".repeat(64)), null],
    [singleCliBytes, probeToken, null],
    [singleCliBytes, token, null, otherRoot],
  ] as const) {
    const cliState = path.join(
      workingDirectory,
      ".crdd",
      "coordinator",
      "state.json",
    );
    if (workingDirectory === otherRoot)
      fs.mkdirSync(path.dirname(cliState), { recursive: true });
    fs.writeFileSync(cliState, bytes);
    const valid = readRuntimeOwnedCoordinatorRecoverySnapshot(
      verifiedRoot.capability,
    );
    assert.equal(valid.status, "completed");
    assert.equal(valid.lockReleased, true);
    if (bytes === duplicateCliBytes)
      assert.equal(valid.value?.snapshot.operations.length, 2);
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "-e",
        `(async()=>{
         const { mock } = await import("node:test");
         const { createHash } = await import("node:crypto");
         const calls = [];
         const vc = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
         const store = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
         const verified = vc.verifyRepositoryRoot(process.cwd());
         const before = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
         const host = await import(${JSON.stringify(hostModule)});
         const probe = await import(${JSON.stringify(probeModule)});
         const observe = (kind, id, root) => {
           calls.push({kind, id, rootHash:createHash("sha256").update(root).digest("hex")});
           return {status:"blocked",reason:"fixture_no_effect",recoveryId:id,hostCleanupCompleted:false};
         };
         await mock.module(${JSON.stringify(hostModule)}, {namedExports:{...host,
           recoverOwnedOperationDirectories:(id, generation, root)=>observe("host",id,root)}});
         await mock.module(${JSON.stringify(probeModule)}, {namedExports:{...probe,
           recoverDockerIsolationProbe:(id,root)=>observe("probe",id,root)}});
         process.argv=[process.execPath,"coordinator","doctor","--recover-isolation",${JSON.stringify(recoveryId)},"--json"];
         await import(${JSON.stringify(cliModule)});
         const cliExitCode=process.exitCode;
         process.stdout.write("\\nCLI_ROOT_OBSERVATION="+JSON.stringify({calls,cliExitCode,readerStatus:before.status,readerReason:before.reason,readerReleased:before.lockReleased})+"\\n");
         process.exitCode=0;
         })().catch(error=>{console.error(error);process.exitCode=1;});`,
      ],
      {
        cwd: workingDirectory,
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.includes(root), false);
    assert.equal(child.stderr.includes(root), false);
    const observation = JSON.parse(
      child.stdout.split("CLI_ROOT_OBSERVATION=")[1]?.trim() ?? "null",
    );
    assert.ok(observation);
    assert.equal(observation.cliExitCode, 2);
    assert.deepEqual(
      observation.calls,
      expectedKind === null
        ? []
        : [
            {
              kind: expectedKind,
              id: recoveryId,
              rootHash: createHash("sha256")
                .update(cliIdentity.hostPaths.root)
                .digest("hex"),
            },
          ],
      child.stdout,
    );
    if (expectedKind === null)
      assert.ok(
        child.stdout.includes(
          "coordinator_recovery_current_operation_unconfirmed",
        ),
      );
    assert.deepEqual(fs.readFileSync(cliState), bytes);
  }
  fs.writeFileSync(path.join(area.directory, "state.json"), secondBytes);
  const recoveryOwned = createOwnedOperationDirectories(ownArea.directory);
  const recoveryManagement = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(recoveryOwned),
    createOwnedMountCapability(recoveryOwned),
  );
  let recoveryPreparation: object | null = null;
  let recoveryOwnerAbandoned = false;
  try {
    assert.ok(bindRuntimeOwnedRepositoryOperation(recoveryManagement, root));
    const recoveryRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(recoveryManagement);
    assert.ok(recoveryRepository);
    const recoveryHost =
      borrowOwnedHostRecoverySnapshot(recoveryManagement).snapshot;
    const recoveryIdentity = {
      ...identity,
      operationId: recoveryRepository.operationId,
      operationNonce: "2".repeat(64),
      stableLogicalHomeBindingHash: "1".repeat(64),
      initialHostRecoveryId: recoveryHost.token,
      initialHostRecovery: recoveryHost,
      hostPaths: {
        root: recoveryOwned.root,
        marker: loadHostRecoveryRecordByToken(
          recoveryHost.token,
          recoveryOwned.root,
        ).marker,
      },
    };
    fs.writeFileSync(path.join(area.directory, "state.json"), singleCliBytes);
    const recoveryStarted = saveRuntimeOwnedCoordinatorOperationStart(
      recoveryManagement,
      `${JSON.stringify(recoveryIdentity)}\n`,
    );
    assert.equal(recoveryStarted.status, "completed");
    assert.ok(recoveryStarted.recoveryId);
    const initialRecoveryBytes = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    assert.equal(
      await activateOwnedHostOperationGenerationLock(recoveryManagement),
      "activated",
    );
    const activeHost = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(activeHost.status, "blocked");
    assert.equal(
      activeHost.reason,
      "docker_task_recovery_host_active_or_unknown",
    );
    assert.equal(activeHost.cleanupConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      initialRecoveryBytes,
    );
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(recoveryManagement),
      true,
    );
    recoveryOwnerAbandoned = true;
    const activeHome =
      stateKernelLocks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(
        "1".repeat(64),
      );
    assert.ok(activeHome);
    try {
      const refusedHome = prepareRuntimeOwnedDockerTaskRecovery(
        recoveryStarted.recoveryId,
        verifiedRoot.capability,
      );
      assert.equal(refusedHome.status, "blocked");
      assert.equal(
        refusedHome.reason,
        "docker_task_recovery_home_active_or_unknown",
      );
      assert.equal(refusedHome.cleanupConfirmed, false);
    } finally {
      assert.equal(activeHome.release(), true);
    }
    // 実Driverの最初の待機後に退役を実保存し、次の待機中に取消する。
    // Dockerへ到達させず、実Kernel排他・Writer・読戻しと解放を確認する。
    for (const ownerEffect of ["active", "unknown"] as const) {
      const fixture = JSON.parse(initialRecoveryBytes.toString("utf8"));
      const oldOperation = fixture.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === recoveryStarted.recoveryId,
      );
      assert.ok(oldOperation);
      oldOperation.execution.ownerEffect = ownerEffect;
      const fixtureBytes = Buffer.from(
        `${encodeCoordinatorStateValue(fixture)}\n`,
      );
      fs.writeFileSync(path.join(area.directory, "state.json"), fixtureBytes);
      const prior = readRuntimeOwnedCoordinatorRecoverySnapshot(
        verifiedRoot.capability,
      );
      assert.equal(prior.status, "completed");
      assert.ok(prior.value);
      const cancellation = new AbortController();
      const recovering = recoverRuntimeOwnedDockerTaskFromCurrentRepository(
        recoveryStarted.recoveryId,
        verifiedRoot.capability,
        cancellation.signal,
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      cancellation.abort();
      const cancelled = await recovering;
      assert.equal(cancelled.reason, "docker_task_recovery_cancelled");
      assert.equal(cancelled.dockerCleanupConfirmed, false);
      assert.equal(cancelled.hostCleanupConfirmed, false);
      assert.equal(cancelled.locksReleased, true);
      const actual = readRuntimeOwnedCoordinatorRecoverySnapshot(
        verifiedRoot.capability,
      );
      assert.equal(actual.status, "completed");
      assert.ok(actual.value);
      const expected = JSON.parse(
        encodeCoordinatorStateValue(prior.value.snapshot),
      );
      expected.revision++;
      expected.previous = {
        revision: prior.value.snapshot.revision,
        payloadSha256: prior.value.payloadSha256,
      };
      const retired = expected.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === recoveryStarted.recoveryId,
      );
      retired.phase = "settling";
      retired.execution.ownerEffect = "disabled";
      assert.deepEqual(actual.value.snapshot, expected);
      assert.equal(
        actual.value.payloadSha256,
        coordinatorStateContentHash(expected),
      );
    }
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      initialRecoveryBytes,
    );
    // 実保存中断と同じ資源Receipt pairをfresh回収Ownerへ接続する。
    const resourceStart = decodeCoordinatorStateSnapshot(
      initialRecoveryBytes,
      repository.repositoryBinding,
    );
    assert.ok(resourceStart);
    const resourceOperation = resourceStart.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" &&
        item.recoveryId === recoveryStarted.recoveryId,
    );
    assert.ok(resourceOperation);
    const providerResource = resourceOperation.resources.find(
      (item) => item.purpose === "create_provider",
    );
    assert.ok(providerResource);
    const receiptBefore = prepareCoordinatorStateResourceSnapshot(
      initialRecoveryBytes,
      recoveryStarted.recoveryId,
      { ...providerResource, request: "intent_saved" },
      repository.repositoryBinding,
    );
    assert.ok(receiptBefore);
    const receiptPending = prepareCoordinatorStateResourceSnapshot(
      receiptBefore,
      recoveryStarted.recoveryId,
      {
        ...providerResource,
        request: "identified",
        dockerId: "d".repeat(64),
        receiptSource: "docker_create_result",
      },
      repository.repositoryBinding,
    );
    assert.ok(receiptPending);
    fs.writeFileSync(path.join(area.directory, "state.json"), receiptBefore);
    fs.writeFileSync(
      path.join(area.directory, "state.pending.json"),
      receiptPending,
      { flag: "wx" },
    );
    fs.writeFileSync(
      path.join(area.directory, "state.lock"),
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
      { flag: "wx" },
    );
    assert.equal(
      readRuntimeOwnedCoordinatorRecoverySnapshot(verifiedRoot.capability)
        .reason,
      "coordinator_state_reentry_required",
    );
    const markerPath = path.join(area.directory, "state.lock");
    const markerBytes = fs.readFileSync(markerPath);
    const recoveryBinding = borrowRuntimeOwnedCoordinatorRecoveryRepository(
      verifiedRoot.capability,
    );
    assert.ok(recoveryBinding);
    for (const failAt of [1, 2, 3]) {
      for (const shouldThrow of [false, true]) {
        let ownerChecks = 0;
        const rejectedReceipt =
          resumeRuntimeOwnedCoordinatorResourcePublication(
            { ...recoveryBinding, operationId: recoveryRepository.operationId },
            recoveryStarted.recoveryId,
            receiptBefore,
            receiptPending,
            () => {
              ownerChecks++;
              if (ownerChecks !== failAt) return true;
              if (shouldThrow) throw new Error("fixture_owner_lost");
              return false;
            },
          );
        assert.equal(ownerChecks, failAt);
        assert.equal(rejectedReceipt.status, "blocked");
        assert.equal(rejectedReceipt.filesystemEffectIssued, false);
        assert.equal(rejectedReceipt.snapshotConfirmed, false);
        assert.deepEqual(
          fs.readFileSync(path.join(area.directory, "state.json")),
          receiptBefore,
        );
        assert.deepEqual(
          fs.readFileSync(path.join(area.directory, "state.pending.json")),
          receiptPending,
        );
        assert.deepEqual(fs.readFileSync(markerPath), markerBytes);
      }
    }
    for (const badMarker of [null, Buffer.from("different-marker")]) {
      if (badMarker === null) fs.unlinkSync(markerPath);
      else fs.writeFileSync(markerPath, badMarker);
      assert.equal(
        readRuntimeOwnedCoordinatorResourcePublicationSnapshot(
          verifiedRoot.capability,
          recoveryStarted.recoveryId,
        ).status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        receiptBefore,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.pending.json")),
        receiptPending,
      );
      fs.writeFileSync(markerPath, markerBytes);
    }
    // 読取り直後の候補差替えは元pairと一致せず、Writerへ渡らない。
    for (const fileName of ["state.json", "state.pending.json"] as const) {
      let checks = 0;
      const rejectedReceipt = resumeRuntimeOwnedCoordinatorResourcePublication(
        { ...recoveryBinding, operationId: recoveryRepository.operationId },
        recoveryStarted.recoveryId,
        receiptBefore,
        receiptPending,
        () => {
          checks++;
          if (checks === 1)
            fs.writeFileSync(
              path.join(area.directory, fileName),
              "fixture_changed",
            );
          return true;
        },
      );
      assert.equal(rejectedReceipt.status, "blocked");
      assert.equal(rejectedReceipt.filesystemEffectIssued, false);
      assert.equal(
        fs.readFileSync(path.join(area.directory, fileName), "utf8"),
        "fixture_changed",
      );
      fs.writeFileSync(
        path.join(area.directory, fileName),
        fileName === "state.json" ? receiptBefore : receiptPending,
      );
      assert.deepEqual(fs.readFileSync(markerPath), markerBytes);
    }
    const receiptReentry = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(receiptReentry.status, "prepared");
    assert.ok(receiptReentry.capability);
    try {
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        receiptPending,
      );
      assert.equal(
        fs.existsSync(path.join(area.directory, "state.pending.json")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(area.directory, "state.lock")),
        false,
      );
    } finally {
      assert.equal(
        releaseRuntimeOwnedDockerTaskRecoveryPreparation(
          receiptReentry.capability,
        ),
        true,
      );
    }
    // 以下の既存反証は元fixtureから開始する。実製品記録は変更しない。
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      initialRecoveryBytes,
    );
    const preparedRecovery = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(preparedRecovery.status, "prepared");
    assert.ok(preparedRecovery.capability);
    recoveryPreparation = preparedRecovery.capability;
    assert.equal(
      verifyRuntimeOwnedDockerRestartPreparation(recoveryPreparation),
      false,
    );
    assert.equal(
      releaseRuntimeOwnedDockerRestartPreparation(recoveryPreparation),
      false,
    );
    const recoveryCurrent = readRuntimeOwnedCoordinatorRecoverySnapshot(
      verifiedRoot.capability,
    );
    assert.ok(recoveryCurrent.value);
    const recoveryOperation = recoveryCurrent.value.snapshot.operations.find(
      (value) => value.recoveryId === recoveryStarted.recoveryId,
    );
    assert.ok(recoveryOperation && recoveryOperation.kind === "docker_task");
    const lifecycleValue = {
      phase: "settling",
      lease: recoveryOperation.lease,
      execution: { ...recoveryOperation.execution, ownerEffect: "disabled" },
      primaryFailure: recoveryOperation.primaryFailure,
      outcome: recoveryOperation.outcome,
      summarySha256: recoveryOperation.summarySha256,
    };
    const names: Record<string, string> = {
      create_subscription_auth_probe: recoveryIdentity.resources.auth,
      create_internal_network: recoveryIdentity.resources.internal,
      create_egress_network: recoveryIdentity.resources.egress,
      create_proxy: recoveryIdentity.resources.proxy,
      create_provider: recoveryIdentity.resources.provider,
    };
    const firstRecoveryResource = recoveryOperation.resources[0];
    assert.ok(firstRecoveryResource);
    const intendedResource = {
      ...firstRecoveryResource,
      request: "intent_saved" as const,
    };
    const intendedResources = recoveryOperation.resources.map((resource) =>
      resource.purpose === firstRecoveryResource.purpose
        ? intendedResource
        : resource,
    );
    const cleanupResources = intendedResources.map((resource) =>
      resource.purpose === firstRecoveryResource.purpose
        ? { ...resource, observation: "unknown" as const }
        : resource,
    );
    const unknownHost = {
      ...recoveryOperation.host,
      cleanup: "unknown" as const,
    };
    const expectedResourceOperation = {
      ...recoveryOperation,
      resources: intendedResources,
    };
    const expectedCleanupOperation = {
      ...expectedResourceOperation,
      resources: cleanupResources,
    };
    const expectedHostOperation = {
      ...expectedCleanupOperation,
      host: unknownHost,
    };
    for (const [kind, value, expectedOperation] of [
      ["resource", intendedResource, expectedResourceOperation],
      [
        "cleanup",
        intendedResources.map((resource) => ({
          purpose: resource.purpose,
          plannedResourceName: names[resource.purpose],
          dockerId: null,
          observation:
            resource.purpose === firstRecoveryResource.purpose
              ? "unknown"
              : "not_requested",
        })),
        expectedCleanupOperation,
      ],
      ["host", unknownHost, expectedHostOperation],
    ] as const) {
      const beforeFixed = readRuntimeOwnedCoordinatorRecoverySnapshot(
        verifiedRoot.capability,
      );
      assert.equal(beforeFixed.status, "completed");
      assert.equal(beforeFixed.lockReleased, true);
      assert.ok(beforeFixed.value);
      assert.equal(
        persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
          recoveryPreparation,
          kind,
          value,
        ),
        true,
      );
      const afterFixed = readRuntimeOwnedCoordinatorRecoverySnapshot(
        verifiedRoot.capability,
      );
      assert.equal(afterFixed.status, "completed");
      assert.equal(afterFixed.lockReleased, true);
      assert.ok(afterFixed.value);
      assert.equal(
        afterFixed.value.snapshot.revision,
        beforeFixed.value.snapshot.revision + 1,
      );
      assert.deepEqual(afterFixed.value.snapshot.previous, {
        revision: beforeFixed.value.snapshot.revision,
        payloadSha256: beforeFixed.value.payloadSha256,
      });
      assert.equal(
        afterFixed.value.payloadSha256,
        createHash("sha256")
          .update(fs.readFileSync(path.join(area.directory, "state.json")))
          .digest("hex"),
      );
      assert.equal(
        afterFixed.value.snapshot.schema,
        beforeFixed.value.snapshot.schema,
      );
      assert.equal(
        afterFixed.value.snapshot.repositoryBinding,
        beforeFixed.value.snapshot.repositoryBinding,
      );
      assert.deepEqual(
        afterFixed.value.snapshot.operations,
        beforeFixed.value.snapshot.operations.map(
          (operation): CoordinatorStateOperation =>
            operation.recoveryId === recoveryStarted.recoveryId
              ? expectedOperation
              : operation,
        ),
      );
      assert.deepEqual(
        afterFixed.value.snapshot.pendingDeliveries,
        beforeFixed.value.snapshot.pendingDeliveries,
      );
      assert.deepEqual(
        afterFixed.value.snapshot.unresolvedRecoveries,
        beforeFixed.value.snapshot.unresolvedRecoveries,
      );
    }
    const beforeLifecycle = readRuntimeOwnedCoordinatorRecoverySnapshot(
      verifiedRoot.capability,
    );
    assert.ok(beforeLifecycle.value);
    for (const invalid of [null, {}, { ...recoveryPreparation }]) {
      assert.equal(
        persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
          invalid,
          "lifecycle",
          lifecycleValue,
        ),
        false,
      );
      assert.equal(
        releaseRuntimeOwnedDockerTaskRecoveryPreparation(invalid),
        false,
      );
    }
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "lifecycle",
        lifecycleValue,
      ),
      true,
    );
    const afterRecovery = readRuntimeOwnedCoordinatorRecoverySnapshot(
      verifiedRoot.capability,
    );
    assert.equal(afterRecovery.status, "completed");
    assert.ok(afterRecovery.value);
    assert.equal(
      afterRecovery.value.snapshot.revision,
      beforeLifecycle.value.snapshot.revision + 1,
    );
    assert.equal(afterRecovery.lockReleased, true);
    assert.deepEqual(afterRecovery.value.snapshot.previous, {
      revision: beforeLifecycle.value.snapshot.revision,
      payloadSha256: beforeLifecycle.value.payloadSha256,
    });
    assert.equal(
      afterRecovery.value.payloadSha256,
      createHash("sha256")
        .update(fs.readFileSync(path.join(area.directory, "state.json")))
        .digest("hex"),
    );
    assert.equal(
      afterRecovery.value.snapshot.schema,
      beforeLifecycle.value.snapshot.schema,
    );
    assert.equal(
      afterRecovery.value.snapshot.repositoryBinding,
      beforeLifecycle.value.snapshot.repositoryBinding,
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.operations,
      beforeLifecycle.value.snapshot.operations.map((operation) =>
        operation.recoveryId === recoveryStarted.recoveryId
          ? { ...expectedHostOperation, ...lifecycleValue }
          : operation,
      ),
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.pendingDeliveries,
      beforeLifecycle.value.snapshot.pendingDeliveries,
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.unresolvedRecoveries,
      beforeLifecycle.value.snapshot.unresolvedRecoveries,
    );
    const otherBefore = recoveryCurrent.value.snapshot.operations.filter(
      (value) => value.recoveryId !== recoveryStarted.recoveryId,
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.operations.filter(
        (value) => value.recoveryId !== recoveryStarted.recoveryId,
      ),
      otherBefore,
    );
    const savedRecoveryBytes = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    // 清掃前のconfirmedやLease解放を、この途中Ownerで偽装できない。
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "host",
        { ...recoveryOperation.host, cleanup: "confirmed" },
      ),
      false,
    );
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "lifecycle",
        lifecycleValue,
      ),
      false,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      savedRecoveryBytes,
    );
    assert.equal(
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(recoveryPreparation),
      true,
    );
    assert.equal(
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(recoveryPreparation),
      false,
    );
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "lifecycle",
        lifecycleValue,
      ),
      false,
    );
    recoveryPreparation = null;
    const reentered = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(reentered.status, "prepared");
    assert.ok(reentered.capability);
    assert.equal(
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(reentered.capability),
      true,
    );
  } finally {
    if (recoveryPreparation)
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(recoveryPreparation);
    if (!recoveryOwnerAbandoned)
      await abandonOwnedHostOperationGenerationLock(recoveryManagement);
    assert.equal(
      recoverOwnedOperationDirectories(
        recoveryOwned.hostRecoveryId,
        null,
        recoveryOwned.root,
      ).status,
      "recovered",
    );
    assert.equal(fs.existsSync(recoveryOwned.root), false);
    fs.writeFileSync(path.join(area.directory, "state.json"), secondBytes);
  }
  let lockAcquisitions = 0;
  let actualLockReleased = false;
  let releaseObservationThrows = false;
  const lockObservationMock = t.mock.module(
    "../../src/host-execution/kernel-lock.ts",
    {
      namedExports: {
        ...stateKernelLocks,
        acquireRuntimeOwnedCoordinatorStateKernelLock: (hash: unknown) => {
          lockAcquisitions += 1;
          const acquired =
            stateKernelLocks.acquireRuntimeOwnedCoordinatorStateKernelLock(
              hash,
            );
          assert.ok(acquired);
          return {
            ...acquired,
            release: () => {
              actualLockReleased = acquired.release();
              // 実資源は回収し、解放観測だけを意図的に欠測にする。
              if (releaseObservationThrows)
                throw new Error("private release observation");
              return false;
            },
          };
        },
      },
    },
  );
  try {
    const missingReleaseModuleUrl = new URL(
      "../../src/state-storage/settlement-store.ts?reader-release-observation",
      import.meta.url,
    ).href;
    const missingReleaseRuntime: typeof import("../../src/state-storage/settlement-store.ts") =
      await import(missingReleaseModuleUrl);
    const stopped =
      missingReleaseRuntime.saveRuntimeOwnedCoordinatorOperationStart(
        management,
        `${JSON.stringify(identity)}\n`,
      );
    assert.equal(stopped.status, "blocked");
    assert.equal(stopped.reason, "coordinator_state_lock_release_unconfirmed");
    assert.equal(stopped.lockReleased, false);
    assert.equal(stopped.snapshotConfirmed, false);
    assert.equal(stopped.filesystemEffectIssued, false);
    assert.match(stopped.recoveryId ?? "", /^docker-task\./u);
    assert.equal(lockAcquisitions, 1);
    assert.equal(actualLockReleased, true);
    const unreadableUnissued =
      missingReleaseRuntime.checkpointRuntimeOwnedCoordinatorResourceNotIssued(
        management,
        stopped.recoveryId,
        "create_provider",
        {},
        {},
      );
    assert.equal(unreadableUnissued.status, "blocked");
    assert.equal(unreadableUnissued.lockReleased, false);
    assert.equal(unreadableUnissued.filesystemEffectIssued, false);
    assert.equal(actualLockReleased, true);
    for (const throws of [false, true]) {
      releaseObservationThrows = throws;
      const acquisitionsBefore: number = lockAcquisitions;
      const refused =
        missingReleaseRuntime.writeRuntimeOwnedCoordinatorRestartCheckpoint(
          repository,
          "unselected-recovery",
          secondBytes,
          null,
          () => true,
        );
      assert.equal(refused.status, "blocked");
      assert.equal(
        refused.reason,
        "coordinator_state_lock_release_unconfirmed",
      );
      assert.equal(refused.lockReleased, false);
      assert.equal(refused.filesystemEffectIssued, false);
      assert.equal(actualLockReleased, true);
      assert.equal(lockAcquisitions, acquisitionsBefore + 1);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        secondBytes,
      );
    }
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      secondBytes,
    );
    assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  } finally {
    lockObservationMock.restore();
  }
  const started = saveRuntimeOwnedCoordinatorOperationStart(
    management,
    `${JSON.stringify(identity)}\n`,
  );
  assert.equal(started.status, "completed");
  assert.equal(started.snapshotConfirmed, true);
  assert.equal(started.lockReleased, true);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    operationBytes,
  );
  const legacyIdentity = { ...identity } as Record<string, unknown>;
  delete legacyIdentity.consumer;
  const legacyState = JSON.parse(operationBytes.toString("utf8"));
  const legacyJson = `${JSON.stringify(legacyIdentity)}\n`;
  const legacyHash = createHash("sha256").update(legacyJson).digest("hex");
  legacyState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identityJson = legacyJson;
  legacyState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identitySha256 = legacyHash;
  legacyState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).recoveryId =
    `docker-task.${identity.stableLogicalHomeBindingHash}.${identity.operationNonce}.${legacyHash}`;
  const legacyBytes = Buffer.from(
    `${encodeCoordinatorStateValue(legacyState)}\n`,
  );
  for (const fixtureName of ["state.json", "state.pending.json"]) {
    const fixturePath = path.join(area.directory, fixtureName);
    fs.writeFileSync(fixturePath, legacyBytes);
    try {
      const refusedLegacy = saveRuntimeOwnedCoordinatorOperationStart(
        management,
        `${JSON.stringify(identity)}\n`,
      );
      assert.equal(refusedLegacy.status, "blocked");
      assert.deepEqual(fs.readFileSync(fixturePath), legacyBytes);
    } finally {
      if (fixtureName === "state.json")
        fs.writeFileSync(fixturePath, operationBytes);
      else fs.unlinkSync(fixturePath);
    }
  }
  const duplicatedStart = saveRuntimeOwnedCoordinatorOperationStart(
    management,
    `${JSON.stringify(identity)}\n`,
  );
  assert.equal(duplicatedStart.status, "blocked");
  assert.equal(duplicatedStart.filesystemEffectIssued, false);
  assert.equal(duplicatedStart.recoveryId, started.recoveryId);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    operationBytes,
  );
  const beforeCheckpoint = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.ok(beforeCheckpoint.value);
  const restartOperation = beforeCheckpoint.value.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(restartOperation);
  const restartScope = "e".repeat(64);
  const restartRequest = {
    requestId: createDockerRestartRequestId(
      repository.repositoryBinding,
      restartOperation.identitySha256,
      restartOperation.recoveryId,
      restartScope,
    ),
    scopeSha256: restartScope,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  };
  // 保存値だけを刺激する。Host再起動・Scope承認の実証には使用しない。
  const restartBeforeBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  // 実Map・実排他・実Writerの接続だけを確認する。技術結果は実Dockerの根拠にしない。
  for (const completedRestart of [true, false]) {
    const preparation = prepareRuntimeOwnedDockerRestart(
      restartOperation.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(preparation.status, "prepared");
    assert.ok(preparation.capability);
    let preparationReleased = false;
    try {
      let previousBytes = restartBeforeBytes;
      let revision: number = beforeCheckpoint.value.snapshot.revision;
      const requests = completedRestart
        ? (["not_issued", "unknown", "issued", "confirmed"] as const)
        : (["not_issued", "unknown"] as const);
      for (const request of requests) {
        const checkpoint: DockerRestartCheckpoint = {
          requestId: preparation.requestId,
          scopeSha256: preparation.scopeSha256,
          request,
          cleanup:
            request === "not_issued"
              ? ("not_required" as const)
              : ("pending" as const),
          result: null,
        };
        assert.equal(
          persistRuntimeOwnedDockerRestartCheckpoint(
            preparation.capability,
            checkpoint,
          ),
          true,
        );
        const observed = readRuntimeOwnedCoordinatorRecoverySnapshot(
          verifiedRoot.capability,
        );
        assert.equal(observed.status, "completed");
        assert.equal(observed.lockReleased, true);
        assert.ok(observed.value);
        const bytes = fs.readFileSync(path.join(area.directory, "state.json"));
        assert.equal(
          observed.value.payloadSha256,
          createHash("sha256").update(bytes).digest("hex"),
        );
        assert.equal(observed.value.snapshot.revision, ++revision);
        assert.deepEqual(observed.value.snapshot.previous, {
          revision: revision - 1,
          payloadSha256: createHash("sha256")
            .update(previousBytes)
            .digest("hex"),
        });
        assert.deepEqual(observed.value.snapshot.operations, [
          { ...restartOperation, dockerRestart: checkpoint },
        ]);
        assert.deepEqual(
          observed.value.snapshot.unresolvedRecoveries,
          beforeCheckpoint.value.snapshot.unresolvedRecoveries,
        );
        assert.deepEqual(
          observed.value.snapshot.pendingDeliveries,
          beforeCheckpoint.value.snapshot.pendingDeliveries,
        );
        previousBytes = bytes;
      }
      const technical: Awaited<
        ReturnType<
          typeof import("../../../docker-isolation/src/index.ts").restartDockerRuntime
        >
      > = {
        requestId: preparation.requestId,
        status: completedRestart
          ? ("completed" as const)
          : ("blocked" as const),
        reason: completedRestart
          ? "docker_restart_settled"
          : "docker_restart_stop_unconfirmed",
        request: completedRestart
          ? ("confirmed" as const)
          : ("not_issued" as const),
        primaryFailure: completedRestart
          ? null
          : "docker_restart_stop_unconfirmed",
        stopFailure: null,
        startFailure: null,
        cleanupFailure: null,
        cleanupConfirmed: true,
        restartCompleted: completedRestart,
        effectOutcomeUnknown: false,
        startupElapsedMs: 1,
        delivery: "confirmed" as const,
      };
      assert.equal(
        finalizeRuntimeOwnedDockerRestartPreparation(
          preparation.capability,
          technical,
        ).status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        previousBytes,
      );
      const released = releaseRuntimeOwnedDockerRestartPreparation(
        preparation.capability,
      );
      preparationReleased = true;
      assert.equal(released, true);
      const finalized = finalizeRuntimeOwnedDockerRestartPreparation(
        preparation.capability,
        technical,
      );
      assert.equal(finalized.status, "completed");
      assert.equal(finalized.snapshotConfirmed, true);
      assert.equal(finalized.lockReleased, true);
      assert.equal(finalized.cleanupConfirmed, true);
      const terminalRead = readRuntimeOwnedCoordinatorRecoverySnapshot(
        verifiedRoot.capability,
      );
      assert.equal(terminalRead.status, "completed");
      assert.equal(terminalRead.lockReleased, true);
      assert.ok(terminalRead.value);
      assert.deepEqual(terminalRead.value.snapshot.operations, [
        {
          ...restartOperation,
          dockerRestart: {
            requestId: preparation.requestId,
            scopeSha256: preparation.scopeSha256,
            request: completedRestart ? "confirmed" : "unknown",
            cleanup: "confirmed",
            result: {
              status: completedRestart ? "completed" : "blocked",
              reason: technical.reason,
              request: completedRestart ? "confirmed" : "not_issued",
              effectOutcomeUnknown: false,
            },
          },
        },
      ]);
      const terminalBytes = fs.readFileSync(
        path.join(area.directory, "state.json"),
      );
      assert.equal(
        terminalRead.value.payloadSha256,
        createHash("sha256").update(terminalBytes).digest("hex"),
      );
      assert.equal(terminalRead.value.snapshot.revision, ++revision);
      assert.deepEqual(terminalRead.value.snapshot.previous, {
        revision: revision - 1,
        payloadSha256: createHash("sha256").update(previousBytes).digest("hex"),
      });
      assert.equal(
        terminalRead.value.snapshot.schema,
        beforeCheckpoint.value.snapshot.schema,
      );
      assert.equal(
        terminalRead.value.snapshot.repositoryBinding,
        beforeCheckpoint.value.snapshot.repositoryBinding,
      );
      assert.deepEqual(
        terminalRead.value.snapshot.unresolvedRecoveries,
        beforeCheckpoint.value.snapshot.unresolvedRecoveries,
      );
      assert.deepEqual(
        terminalRead.value.snapshot.pendingDeliveries,
        beforeCheckpoint.value.snapshot.pendingDeliveries,
      );
      assert.equal(
        finalizeRuntimeOwnedDockerRestartPreparation(
          preparation.capability,
          technical,
        ).status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        terminalBytes,
      );
      assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
      const repeated = prepareRuntimeOwnedDockerRestart(
        restartOperation.recoveryId,
        verifiedRoot.capability,
      );
      assert.equal(repeated.status, "prepared");
      assert.ok(repeated.capability);
      try {
        assert.equal(repeated.alreadyRequested, true);
        assert.equal(repeated.requestId, preparation.requestId);
        assert.deepEqual(
          fs.readFileSync(path.join(area.directory, "state.json")),
          terminalBytes,
        );
      } finally {
        assert.equal(
          releaseRuntimeOwnedDockerRestartPreparation(repeated.capability),
          true,
        );
      }
      // 試験fixtureを元本文へ戻す。製品の切戻し／再実行保証ではない。
      fs.writeFileSync(
        path.join(area.directory, "state.json"),
        restartBeforeBytes,
      );
    } finally {
      if (!preparationReleased)
        releaseRuntimeOwnedDockerRestartPreparation(preparation.capability);
    }
  }
  try {
    for (const [owner, reference, value] of [
      [{}, restartOperation.recoveryId, restartRequest],
      [management, "wrong-recovery", restartRequest],
      [
        management,
        restartOperation.recoveryId,
        { ...restartRequest, requestId: "f".repeat(64) },
      ],
    ]) {
      const refused = checkpointRuntimeOwnedCoordinatorRestart(
        owner,
        reference,
        value,
      );
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        restartBeforeBytes,
      );
    }
    // 同じ実Ownerの保存接続だけを確認する。fresh Host排他の取得証明ではない。
    for (const [target, before, live] of [
      [repository, restartBeforeBytes, () => false],
      [
        repository,
        restartBeforeBytes,
        () => {
          throw new Error("private owner failure");
        },
      ],
      [
        { ...repository, operationId: "wrong-operation" },
        restartBeforeBytes,
        () => true,
      ],
      [repository, Buffer.from("stale"), () => true],
    ] as const) {
      const refused = writeRuntimeOwnedCoordinatorRestartCheckpoint(
        target,
        restartOperation.recoveryId,
        before,
        restartRequest,
        live,
      );
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        restartBeforeBytes,
      );
    }
    for (const failure of ["false", "throw"] as const) {
      let ownerChecks = 0;
      const refused = writeRuntimeOwnedCoordinatorRestartCheckpoint(
        repository,
        restartOperation.recoveryId,
        restartBeforeBytes,
        restartRequest,
        () => {
          if (++ownerChecks <= 2) return true;
          if (failure === "throw")
            throw new Error("private late owner failure");
          return false;
        },
      );
      assert.ok(ownerChecks > 2);
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        restartBeforeBytes,
      );
    }
    let successfulOwnerChecks = 0;
    const saved = writeRuntimeOwnedCoordinatorRestartCheckpoint(
      repository,
      restartOperation.recoveryId,
      restartBeforeBytes,
      restartRequest,
      () => {
        successfulOwnerChecks++;
        return repository.revalidate();
      },
    );
    assert.ok(successfulOwnerChecks > 2);
    assert.equal(saved.status, "completed");
    assert.equal(saved.snapshotConfirmed, true);
    assert.equal(saved.lockReleased, true);
    assert.deepEqual(
      readRuntimeOwnedCoordinatorStateSnapshot(
        management,
      ).value?.snapshot.operations.find((item) => item.kind === "docker_task")
        ?.dockerRestart,
      restartRequest,
    );
    const pendingRestart = {
      ...restartRequest,
      request: "unknown",
      cleanup: "pending",
    };
    assert.equal(
      checkpointRuntimeOwnedCoordinatorRestart(
        management,
        restartOperation.recoveryId,
        pendingRestart,
      ).status,
      "completed",
    );
    const blockedRestart = {
      ...pendingRestart,
      result: {
        status: "blocked",
        reason: "docker_restart_test_cancelled",
        request: "unknown",
        effectOutcomeUnknown: true,
      },
    };
    assert.equal(
      checkpointRuntimeOwnedCoordinatorRestart(
        management,
        restartOperation.recoveryId,
        blockedRestart,
      ).status,
      "completed",
    );
    assert.equal(
      checkpointRuntimeOwnedCoordinatorRestart(
        management,
        restartOperation.recoveryId,
        { ...blockedRestart, cleanup: "confirmed" },
      ).status,
      "completed",
    );
    const restartAfter = readRuntimeOwnedCoordinatorStateSnapshot(management);
    assert.deepEqual(
      restartAfter.value?.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      ),
      {
        ...restartOperation,
        dockerRestart: { ...blockedRestart, cleanup: "confirmed" },
      },
    );
    const restartRefusalBefore = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    const restartRefusal = checkpointRuntimeOwnedCoordinatorRestart(
      management,
      restartOperation.recoveryId,
      restartRequest,
    );
    assert.equal(restartRefusal.status, "blocked");
    assert.equal(restartRefusal.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      restartRefusalBefore,
    );
    assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  } finally {
    // 次の独立した故障注入へ、自己生成fixtureの元版を明示的に戻す。
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      restartBeforeBytes,
    );
  }
  const operation = beforeCheckpoint.value.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(operation && operation.kind === "docker_task");
  const initialRequests = readRuntimeOwnedCoordinatorResourceRequests(
    management,
    operation.recoveryId,
  );
  assert.ok(initialRequests);
  assert.equal(Object.keys(initialRequests).length, 5);
  assert.equal(Object.isFrozen(initialRequests), true);
  for (const receipt of Object.values(initialRequests)) {
    assert.deepEqual(receipt, { submitted: false, dockerId: null });
    assert.equal(Object.isFrozen(receipt), true);
  }
  assert.equal(
    readRuntimeOwnedCoordinatorResourceRequests({}, operation.recoveryId),
    null,
  );
  assert.equal(
    readRuntimeOwnedCoordinatorResourceRequests(management, "other-recovery"),
    null,
  );
  const resource = operation.resources.find(
    (item) => item.purpose === "create_provider",
  );
  assert.ok(resource);
  const readerInitialBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  const notIssuedNotice = Object.freeze({});
  const notIssuedRecovery = Object.freeze({});
  let notIssuedActive = true;
  const notIssuedMock = t.mock.module(
    "../../src/provider/execution-controller.ts",
    {
      namedExports: {
        ...dockerController,
        verifyRuntimeOwnedDockerUnissuedNotice: (
          notice: unknown,
          recovery: unknown,
          owner: unknown,
          purpose: unknown,
          actualOperation: unknown,
          recoveryId: unknown,
        ) =>
          notIssuedActive &&
          notice === notIssuedNotice &&
          recovery === notIssuedRecovery &&
          owner === management &&
          purpose === resource.purpose &&
          actualOperation === repository.operationId &&
          recoveryId === operation.recoveryId,
      },
    },
  );
  try {
    const unissuedRuntime: typeof import("../../src/state-storage/settlement-store.ts") =
      await import(
        new URL(
          "../../src/state-storage/settlement-store.ts?unissued-proof",
          import.meta.url,
        ).href
      );
    const intentSaved = checkpointRuntimeOwnedCoordinatorResource(
      management,
      operation.recoveryId,
      { ...resource, request: "intent_saved" },
    );
    assert.equal(intentSaved.status, "completed");
    const intentBytes = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    const unissuedBytes = prepareCoordinatorStateResourceSnapshot(
      intentBytes,
      operation.recoveryId,
      { ...resource, request: "not_issued" },
      repository.repositoryBinding,
    );
    assert.ok(unissuedBytes);
    assert.equal(
      writeRuntimeOwnedCoordinatorStateSnapshot(management, unissuedBytes)
        .filesystemEffectIssued,
      false,
    );
    assert.equal(
      checkpointRuntimeOwnedCoordinatorResource(
        management,
        operation.recoveryId,
        { ...resource, request: "not_issued" },
      ).filesystemEffectIssued,
      false,
    );
    assert.equal(
      checkpointRuntimeOwnedCoordinatorResourceNotIssued(
        management,
        operation.recoveryId,
        resource.purpose,
        notIssuedNotice,
        notIssuedRecovery,
      ).filesystemEffectIssued,
      false,
    );
    assert.equal(
      unissuedRuntime.checkpointRuntimeOwnedCoordinatorResourceNotIssued(
        management,
        operation.recoveryId,
        resource.purpose,
        { ...notIssuedNotice },
        notIssuedRecovery,
      ).filesystemEffectIssued,
      false,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      intentBytes,
    );
    const saved =
      unissuedRuntime.checkpointRuntimeOwnedCoordinatorResourceNotIssued(
        management,
        operation.recoveryId,
        resource.purpose,
        notIssuedNotice,
        notIssuedRecovery,
      );
    assert.equal(saved.status, "completed");
    assert.equal(saved.snapshotConfirmed, true);
    assert.equal(saved.lockReleased, true);
    assert.deepEqual(
      readRuntimeOwnedCoordinatorResourceRequests(
        management,
        operation.recoveryId,
      )?.create_provider,
      { submitted: false, dockerId: null },
    );
    assert.equal(
      checkpointRuntimeOwnedCoordinatorResource(
        management,
        operation.recoveryId,
        { ...resource, request: "issued" },
      ).filesystemEffectIssued,
      false,
    );
    fs.writeFileSync(path.join(area.directory, "state.json"), intentBytes);
    notIssuedActive = false;
    assert.equal(
      unissuedRuntime.checkpointRuntimeOwnedCoordinatorResourceNotIssued(
        management,
        operation.recoveryId,
        resource.purpose,
        notIssuedNotice,
        notIssuedRecovery,
      ).filesystemEffectIssued,
      false,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      intentBytes,
    );
  } finally {
    notIssuedMock.restore();
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      readerInitialBytes,
    );
  }
  for (const request of ["intent_saved", "issued", "unknown"] as const) {
    const saved = checkpointRuntimeOwnedCoordinatorResource(
      management,
      operation.recoveryId,
      {
        ...resource,
        request,
        observation: request === "unknown" ? "unknown" : "unobserved",
      },
    );
    assert.equal(saved.status, "completed");
    assert.equal(saved.snapshotConfirmed, true);
    assert.equal(saved.lockReleased, true);
    assert.equal(saved.filesystemEffectIssued, true);
    const requests = readRuntimeOwnedCoordinatorResourceRequests(
      management,
      operation.recoveryId,
    );
    assert.ok(requests);
    assert.deepEqual(requests.create_provider, {
      submitted: true,
      dockerId: null,
    });
    assert.deepEqual(requests.create_subscription_auth_probe, {
      submitted: false,
      dockerId: null,
    });
  }
  const checkpoint = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(checkpoint.value?.snapshot.revision, 6);
  assert.equal(
    checkpoint.value?.snapshot.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.find((item) => item.purpose === "create_provider")?.request,
    "unknown",
  );
  const checkpointOperation = checkpoint.value?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(checkpointOperation && checkpointOperation.kind === "docker_task");
  assert.ok(checkpoint.value);
  const resourceReaderBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  try {
    for (const selected of checkpointOperation.resources) {
      for (const request of [
        "not_requested",
        "intent_saved",
        "issued",
        "unknown",
        "identified",
      ] as const) {
        const dockerId = request === "identified" ? "a".repeat(64) : null;
        const snapshot = {
          ...checkpoint.value.snapshot,
          operations: [
            {
              ...checkpointOperation,
              resources: checkpointOperation.resources.map((item) =>
                item.purpose === selected.purpose
                  ? {
                      ...item,
                      request,
                      dockerId,
                      receiptSource:
                        request === "identified"
                          ? "docker_create_result"
                          : null,
                      observation: "unobserved",
                    }
                  : item,
              ),
            },
          ],
        };
        fs.writeFileSync(
          path.join(area.directory, "state.json"),
          `${JSON.stringify(snapshot)}\n`,
        );
        const requests = readRuntimeOwnedCoordinatorResourceRequests(
          management,
          operation.recoveryId,
        );
        assert.ok(requests);
        assert.deepEqual(requests[selected.purpose], {
          submitted: request !== "not_requested",
          dockerId,
        });
      }
    }
    for (const resources of [
      checkpointOperation.resources.slice(1),
      checkpointOperation.resources.map((item, index) =>
        index === 1 ? checkpointOperation.resources[0] : item,
      ),
      checkpointOperation.resources.map((item, index) =>
        index === 0
          ? {
              ...item,
              request: "identified",
              dockerId: "not-an-exact-id",
              receiptSource: "docker_create_result",
            }
          : item,
      ),
    ]) {
      fs.writeFileSync(
        path.join(area.directory, "state.json"),
        `${JSON.stringify({
          ...checkpoint.value.snapshot,
          operations: [{ ...checkpointOperation, resources }],
        })}\n`,
      );
      assert.equal(
        readRuntimeOwnedCoordinatorResourceRequests(
          management,
          operation.recoveryId,
        ),
        null,
      );
    }
  } finally {
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      resourceReaderBytes,
    );
  }
  const cleanupObservations = checkpointOperation.resources.map((item) => ({
    purpose: item.purpose,
    plannedResourceName:
      identity.resources[
        (
          {
            create_egress_network: "egress",
            create_internal_network: "internal",
            create_provider: "provider",
            create_proxy: "proxy",
            create_subscription_auth_probe: "auth",
          } as const
        )[item.purpose]
      ],
    dockerId: item.dockerId,
    observation: item.request === "not_requested" ? "not_requested" : "unknown",
  }));
  const cleanupSaved = checkpointRuntimeOwnedCoordinatorCleanup(
    management,
    operation.recoveryId,
    cleanupObservations,
  );
  assert.equal(cleanupSaved.status, "completed");
  assert.equal(cleanupSaved.snapshotConfirmed, true);
  assert.equal(cleanupSaved.lockReleased, true);
  const afterCleanup = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(afterCleanup.value?.snapshot.revision, 7);
  assert.equal(
    afterCleanup.value?.snapshot.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.find((item) => item.purpose === "create_provider")?.request,
    "unknown",
  );
  const hostSuccessor = { ...hostRecord, state: "docker_submission_started" };
  const expectedHostToken =
    token.slice(0, -64) +
    createHash("sha256")
      .update(`${JSON.stringify(hostSuccessor)}\n`)
      .digest("hex");
  const hostTransition = {
    currentToken: token,
    expectedToken: expectedHostToken,
    rootName: hostRecord.rootName,
    nonce: "12345678-1234-4234-8234-123456789abc",
    currentState: "host_only",
    nextState: "docker_submission_started",
    recordBefore: hostRecord,
  };
  const hostIntent = {
    ...operation.host,
    pendingTransitionJson: `${JSON.stringify(hostTransition)}\n`,
  };
  const hostReceipt = { ...operation.host, currentToken: expectedHostToken };
  const missingIntent = checkpointRuntimeOwnedCoordinatorHost(
    management,
    operation.recoveryId,
    hostReceipt,
  );
  assert.equal(missingIntent.status, "blocked");
  assert.equal(missingIntent.filesystemEffectIssued, false);
  for (const value of [hostIntent, hostReceipt]) {
    const savedHost = checkpointRuntimeOwnedCoordinatorHost(
      management,
      operation.recoveryId,
      value,
    );
    assert.equal(savedHost.status, "completed");
    assert.equal(savedHost.snapshotConfirmed, true);
    assert.equal(savedHost.lockReleased, true);
  }
  const afterHost = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(afterHost.value?.snapshot.revision, 9);
  assert.equal(
    afterHost.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host.currentToken,
    expectedHostToken,
  );
  assert.deepEqual(
    afterHost.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
    afterCleanup.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
  );
  const rollback = checkpointRuntimeOwnedCoordinatorHost(
    management,
    operation.recoveryId,
    operation.host,
  );
  assert.equal(rollback.status, "blocked");
  assert.equal(rollback.filesystemEffectIssued, false);
  const lifecycle = {
    phase: "settling",
    lease: operation.lease,
    execution: {
      ...operation.execution,
      providerStart: "unknown",
      externalSend: "unknown",
      sharedWrite: "unknown",
      ownerEffect: "unknown",
    },
    primaryFailure: {
      purpose: "create_provider",
      stage: "command_wait",
      reason: "provider_result_invalid",
      exceptionCode: null,
      commandObservation: { exitCode: 1, stdoutBytes: 12, stderrBytes: 7 },
      commandHandleObtained: true,
      responseObserved: true,
      receiptRecorded: false,
    },
    outcome: {
      status: "blocked",
      reason: "provider_result_invalid",
      cleanupConfirmed: false,
    },
    summarySha256: null,
  };
  const savedLifecycle = checkpointRuntimeOwnedCoordinatorLifecycle(
    management,
    operation.recoveryId,
    lifecycle,
  );
  assert.equal(savedLifecycle.status, "completed");
  assert.equal(savedLifecycle.snapshotConfirmed, true);
  assert.equal(savedLifecycle.lockReleased, true);
  const afterLifecycle = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(afterLifecycle.value?.snapshot.revision, 10);
  assert.deepEqual(
    afterLifecycle.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.primaryFailure,
    lifecycle.primaryFailure,
  );
  assert.deepEqual(
    afterLifecycle.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
    afterHost.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
  );
  assert.deepEqual(
    afterLifecycle.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host,
    afterHost.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host,
  );
  const references = {
    recovery: {
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      reason: "provider_result_invalid",
      obligations: ["docker_resources"],
    },
    deliveries: [
      {
        operationNonce: identity.operationNonce,
        recoveryId: operation.recoveryId,
        resultId: "b".repeat(64),
        consumer: "orchestrator",
        acceptanceSha256: null as string | null,
      },
    ],
  };
  const acceptedReferences = {
    ...references,
    deliveries: references.deliveries.map((item) => ({
      ...item,
      acceptanceSha256: "c".repeat(64),
    })),
  };
  const beforeReferenceUpdates = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  for (const value of [references, acceptedReferences]) {
    const savedReferences = checkpointRuntimeOwnedCoordinatorReferences(
      management,
      operation.recoveryId,
      value,
    );
    assert.equal(savedReferences.status, "blocked");
    assert.equal(savedReferences.snapshotConfirmed, false);
    assert.equal(savedReferences.filesystemEffectIssued, false);
    assert.equal(savedReferences.lockReleased, true);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      beforeReferenceUpdates,
    );
    const arbitraryCandidate = prepareCoordinatorStateReferencesSnapshot(
      beforeReferenceUpdates,
      operation.recoveryId,
      value,
      repository.repositoryBinding,
    );
    assert.ok(arbitraryCandidate);
    const direct = writeRuntimeOwnedCoordinatorStateSnapshot(
      management,
      arbitraryCandidate,
    );
    assert.equal(direct.status, "blocked");
    assert.equal(direct.snapshotConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      beforeReferenceUpdates,
    );
  }
  const savedRecoveryOnly = checkpointRuntimeOwnedCoordinatorReferences(
    management,
    operation.recoveryId,
    { recovery: references.recovery, deliveries: [] },
  );
  assert.equal(savedRecoveryOnly.status, "completed", savedRecoveryOnly.reason);
  assert.equal(savedRecoveryOnly.snapshotConfirmed, true);
  assert.equal(savedRecoveryOnly.lockReleased, true);
  const afterReferences = readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(afterReferences.value?.snapshot.revision, 11);
  assert.deepEqual(afterReferences.value?.snapshot.pendingDeliveries, []);
  assert.deepEqual(
    afterReferences.value?.snapshot.operations,
    afterLifecycle.value?.snapshot.operations,
  );
  const checkpointBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  for (const [owner, ref, update] of [
    [{}, operation.recoveryId, resource],
    [management, `${operation.recoveryId}0`, resource],
    [management, operation.recoveryId, resource],
  ]) {
    const rejectedCheckpoint = checkpointRuntimeOwnedCoordinatorResource(
      owner,
      ref,
      update,
    );
    assert.equal(rejectedCheckpoint.status, "blocked");
    assert.equal(rejectedCheckpoint.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  for (const invalidValues of [
    null,
    cleanupObservations.slice(1),
    cleanupObservations.map((item) => ({ ...item, observation: "absent" })),
  ]) {
    const rejected = checkpointRuntimeOwnedCoordinatorCleanup(
      management,
      operation.recoveryId,
      invalidValues,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  for (const invalid of [
    { ...lifecycle, primaryFailure: null },
    { ...lifecycle, execution: operation.execution },
    { phase: "settling" },
    { ...lifecycle, recoveryId: operation.recoveryId },
  ]) {
    const rejected = checkpointRuntimeOwnedCoordinatorLifecycle(
      management,
      operation.recoveryId,
      invalid,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  for (const invalid of [
    { recovery: null, deliveries: [] },
    references,
    {
      ...acceptedReferences,
      deliveries: acceptedReferences.deliveries.map((item) => ({
        ...item,
        resultId: "d".repeat(64),
      })),
    },
  ]) {
    const rejected = checkpointRuntimeOwnedCoordinatorReferences(
      management,
      operation.recoveryId,
      invalid,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, operationBytes)
      .status,
    "blocked",
  );
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  const settlement = prepareRuntimeOwnedCoordinatorSettlement(
    management,
    operation.recoveryId,
    "orchestrator",
  );
  assert.ok(settlement);
  // この追加経路だけDocker終了観測を模擬する。本番Controllerの肯定根拠ではない。
  const simulatedCompletion = Object.freeze({
    fixture: "docker-terminal",
    status: "blocked",
    reason: "provider_result_invalid",
    cleanupConfirmed: true,
  });
  let observedProviderId: string | null = null;
  let observedProviderObservation = "absent";
  const transientRecoveryIds = new Set<string>();
  t.mock.module("../../src/provider/execution-controller.ts", {
    namedExports: {
      ...dockerController,
      /**
       * Filesystem履歴試験に固定したDocker終了観測を返す。
       * @responsibility 実Dockerを起動せず保存処理だけを刺激する。
       * @trace ERB-IT-003
       * @precondition 同じfixture結果と操作を指定する。
       * @stimulus 模擬Controller終了結果をWriterへ渡す。
       * @observation Owner、操作ID、回復IDの一致。
       * @oracle 一致時だけ五用途の未要求とLease終了を返す。
       * @cleanup TestContextがModule差替えを解除する。
       * @boundary 模擬Docker観測から実Filesystem Writer。
       */
      borrowRuntimeOwnedDockerTerminalObservations(
        result: unknown,
        owner: unknown,
        id: unknown,
        ref: unknown,
      ) {
        if (
          result !== simulatedCompletion ||
          owner !== management ||
          id !== repository.operationId ||
          (ref !== operation.recoveryId &&
            (typeof ref !== "string" || !transientRecoveryIds.has(ref)))
        )
          return null;
        return Object.freeze({
          resources: operation.resources.map((item) => ({
            purpose: item.purpose,
            plannedResourceName: cleanupObservations.find(
              (value) => value.purpose === item.purpose,
            )?.plannedResourceName,
            dockerId:
              item.purpose === "create_provider" ? observedProviderId : null,
            observation:
              item.purpose === "create_provider" && observedProviderId
                ? observedProviderObservation
                : "not_requested",
          })),
          homeLeaseReleased: true,
          mountLeaseReleased: true,
          recoveryCompleted: true,
          primaryFailure: lifecycle.primaryFailure,
        });
      },
    },
  });
  let isCompletionReleaseObservationMissing = false;
  let completionReleaseMissingAt = 1;
  let completionReleaseCount = 0;
  let completionActualReleaseConfirmed = false;
  const completionLockObservationMock = t.mock.module(
    "../../src/host-execution/kernel-lock.ts",
    {
      namedExports: {
        ...stateKernelLocks,
        acquireRuntimeOwnedCoordinatorStateKernelLock: (hash: unknown) => {
          const acquired =
            stateKernelLocks.acquireRuntimeOwnedCoordinatorStateKernelLock(
              hash,
            );
          if (!acquired) return acquired;
          return {
            ...acquired,
            release: () => {
              const released = acquired.release();
              if (isCompletionReleaseObservationMissing) {
                completionReleaseCount += 1;
                // 出版後の再入場は保持候補を使い、更新Writerの解放だけ欠測にする。
                if (completionReleaseCount === completionReleaseMissingAt) {
                  completionActualReleaseConfirmed = released;
                  return false;
                }
              }
              return released;
            },
          };
        },
      },
    },
  );
  t.after(() => completionLockObservationMock.restore());
  const isolatedModuleUrl = new URL(
    "../../src/state-storage/settlement-store.ts?history-filesystem-fixture",
    import.meta.url,
  );
  const historyRuntime = (await import(
    isolatedModuleUrl.href
  )) as typeof import("../../src/state-storage/settlement-store.ts");
  let projectAcceptanceValue: unknown = null;
  let projectAcceptanceReads = 0;
  let projectAcceptanceThrow = false;
  let isProjectAcceptanceChangeOnSecondRead = false;
  const historySettlement =
    historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
      management,
      operation.recoveryId,
      "orchestrator",
      () => {
        projectAcceptanceReads += 1;
        if (projectAcceptanceThrow) throw new Error("fixture_upper_reader");
        if (
          isProjectAcceptanceChangeOnSecondRead &&
          projectAcceptanceReads === 2
        )
          return null;
        return projectAcceptanceValue;
      },
    );
  const historySettlementAgain =
    historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
      management,
      operation.recoveryId,
      "orchestrator",
    );
  assert.ok(historySettlement);
  assert.ok(historySettlementAgain);
  let lateReaderCalls = 0;
  /**
   * 保存後に登録したReaderの呼出し回数を観測する。
   *
   * @responsibility 遅延登録を消費していないことをカウンターで確認する。
   * @trace ERB-IT-003
   * @precondition 終了予定を固定済みでlateReaderCallsを0にする。
   * @stimulus 固定後のReader登録と同じ終了Contextへの再入場を試みる。
   * @observation 登録の拒否、固定Reader IdentityとlateReaderCallsを取得する。
   * @oracle 固定Readerを差し替えずlateReaderCallsは0のままである。
   * @cleanup Case所有の保存fixtureとModule差替えを回収する。
   * @boundary 保存済み終了予定と後から渡したReaderの登録境界。
   */
  const lateReader = () => {
    lateReaderCalls += 1;
    return projectAcceptanceValue;
  };
  const lateSettlement =
    historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
      management,
      operation.recoveryId,
      "orchestrator",
    );
  assert.ok(lateSettlement);
  for (const context of [{}, { ...lateSettlement }])
    assert.equal(
      historyRuntime.bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
        context,
        operation.recoveryId,
        lateReader,
      ),
      false,
    );
  for (const reader of [null, {}, "reader", Promise.resolve(null)])
    assert.equal(
      historyRuntime.bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
        lateSettlement,
        operation.recoveryId,
        reader,
      ),
      false,
    );
  assert.equal(
    historyRuntime.bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
      lateSettlement,
      "other-recovery",
      lateReader,
    ),
    false,
  );
  for (let index = 0; index < 2; index++)
    assert.equal(
      historyRuntime.bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
        lateSettlement,
        operation.recoveryId,
        lateReader,
      ),
      true,
    );
  assert.equal(
    historyRuntime.bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
      lateSettlement,
      operation.recoveryId,
      () => projectAcceptanceValue,
    ),
    false,
  );
  assert.equal(lateReaderCalls, 0);
  const identifiedSettlement =
    historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
      management,
      operation.recoveryId,
      "orchestrator",
      () => projectAcceptanceValue,
    );
  assert.ok(identifiedSettlement);
  const initialDriverIdentity = {
    ...JSON.parse(operation.identityJson),
    operationNonce: "d".repeat(64),
  };
  const initialDriverIdentityJson = `${JSON.stringify(initialDriverIdentity)}\n`;
  const initialDriverIdentitySha256 = createHash("sha256")
    .update(initialDriverIdentityJson)
    .digest("hex");
  const initialDriverRecoveryId = `docker-task.${initialDriverIdentity.stableLogicalHomeBindingHash}.${initialDriverIdentity.operationNonce}.${initialDriverIdentitySha256}`;
  const initialContextFixture = JSON.parse(checkpointBytes.toString("utf8"));
  initialContextFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identityJson = initialDriverIdentityJson;
  initialContextFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identitySha256 = initialDriverIdentitySha256;
  initialContextFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).recoveryId = initialDriverRecoveryId;
  initialContextFixture.pendingDeliveries = [];
  initialContextFixture.unresolvedRecoveries = [];
  fs.writeFileSync(
    path.join(area.directory, "state.json"),
    `${encodeCoordinatorStateValue(initialContextFixture)}\n`,
  );
  transientRecoveryIds.add(initialDriverRecoveryId);
  const initialDriverSettlement =
    historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
      management,
      initialDriverRecoveryId,
      "orchestrator",
      () => {
        projectAcceptanceReads += 1;
        return null;
      },
    );
  assert.ok(initialDriverSettlement);
  const transientSettlements = [];
  for (const consumer of ["coordinator_cli", "workbench"] as const) {
    const transientIdentity = {
      ...JSON.parse(operation.identityJson),
      consumer,
    };
    const identityJson = `${JSON.stringify(transientIdentity)}\n`;
    const identitySha256 = createHash("sha256")
      .update(identityJson)
      .digest("hex");
    const recoveryId: string = operation.recoveryId.replace(
      operation.identitySha256,
      identitySha256,
    );
    const fixture = JSON.parse(checkpointBytes.toString("utf8"));
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identityJson = identityJson;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identitySha256 = identitySha256;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).recoveryId = recoveryId;
    fixture.pendingDeliveries = [];
    fixture.unresolvedRecoveries = [];
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      `${encodeCoordinatorStateValue(fixture)}\n`,
    );
    const context = historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
      management,
      recoveryId,
      consumer,
    );
    const freshContext =
      historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
        management,
        recoveryId,
        consumer,
      );
    const driverContext =
      historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
        management,
        recoveryId,
        consumer,
      );
    assert.ok(context);
    assert.ok(freshContext);
    assert.ok(driverContext);
    assert.equal(
      historyRuntime.bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
        context,
        recoveryId,
        lateReader,
      ),
      false,
    );
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
        management,
        recoveryId,
        consumer,
        () => projectAcceptanceValue,
      ),
      null,
    );
    transientRecoveryIds.add(recoveryId);
    transientSettlements.push({
      context,
      freshContext,
      driverContext,
      identityJson,
      identitySha256,
      recoveryId,
    });
  }
  fs.writeFileSync(path.join(area.directory, "state.json"), checkpointBytes);
  assert.equal(
    prepareRuntimeOwnedCoordinatorSettlement(
      {},
      operation.recoveryId,
      "orchestrator",
    ),
    null,
  );
  for (const consumer of [undefined, "durable", { consumer: "orchestrator" }]) {
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
        management,
        operation.recoveryId,
        consumer,
      ),
      null,
    );
  }
  for (const consumer of ["coordinator_cli", "workbench"]) {
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
        management,
        operation.recoveryId,
        consumer,
      ),
      null,
    );
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorSettlement(
        management,
        operation.recoveryId,
        consumer,
        () => projectAcceptanceValue,
      ),
      null,
    );
  }
  const beforeTerminalBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  const beforeTerminal = JSON.parse(beforeTerminalBytes.toString("utf8"));
  const terminal = {
    ...beforeTerminal,
    revision: beforeTerminal.revision + 1,
    previous: {
      revision: beforeTerminal.revision,
      payloadSha256: createHash("sha256")
        .update(beforeTerminalBytes)
        .digest("hex"),
    },
    operations: beforeTerminal.operations.map((value: typeof operation) => ({
      ...value,
      host: { ...value.host, cleanup: "confirmed" },
      execution: { ...value.execution, ownerEffect: "disabled" },
    })),
  };
  const terminalBytes = Buffer.from(
    `${encodeCoordinatorStateValue(terminal)}\n`,
  );
  const unconfirmed = writeRuntimeOwnedCoordinatorSettlement(
    settlement,
    terminalBytes,
    {},
  );
  assert.equal(unconfirmed.status, "blocked");
  assert.equal(unconfirmed.filesystemEffectIssued, false);
  const cleanupOutcome = await cleanupOwnedOperationDirectoriesAsync(owned);
  isCleaned = true;
  const terminalRead =
    readRuntimeOwnedCoordinatorSettlementSnapshot(settlement);
  assert.equal(terminalRead.status, "completed");
  assert.equal(terminalRead.lockReleased, true);
  assert.deepEqual(terminalRead.value?.snapshot, beforeTerminal);
  const cleanedOwnerRecoveryRead = readRuntimeOwnedCoordinatorRecoverySnapshot(
    verifiedRoot.capability,
  );
  assert.equal(cleanedOwnerRecoveryRead.status, "completed");
  assert.deepEqual(cleanedOwnerRecoveryRead.value, terminalRead.value);
  assert.equal(
    terminalRead.value?.payloadSha256,
    createHash("sha256").update(beforeTerminalBytes).digest("hex"),
  );
  const forgedRead = readRuntimeOwnedCoordinatorSettlementSnapshot({});
  assert.equal(forgedRead.status, "blocked");
  assert.equal(forgedRead.value, null);
  assert.equal(
    readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, secondBytes)
      .filesystemEffectIssued,
    false,
  );
  assert.equal(
    prepareRuntimeOwnedCoordinatorSettlement(
      management,
      operation.recoveryId,
      "orchestrator",
    ),
    null,
  );
  const forged = writeRuntimeOwnedCoordinatorSettlement(
    {},
    terminalBytes,
    cleanupOutcome,
  );
  assert.equal(forged.status, "blocked");
  assert.equal(forged.filesystemEffectIssued, false);
  // 診断の初回保存は、元Controller観測と完全に一致する場合だけ成立する。
  const diagnosticBefore = JSON.parse(beforeTerminalBytes.toString("utf8"));
  diagnosticBefore.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).primaryFailure = null;
  const diagnosticBeforeBytes = Buffer.from(
    `${encodeCoordinatorStateValue(diagnosticBefore)}\n`,
  );
  fs.writeFileSync(
    path.join(area.directory, "state.json"),
    diagnosticBeforeBytes,
  );
  for (const primaryFailure of [
    null,
    { ...lifecycle.primaryFailure, reason: "docker_setup_deadline_exceeded" },
    { ...lifecycle.primaryFailure, commandHandleObtained: false },
    {
      ...lifecycle.primaryFailure,
      responseObserved: false,
      commandObservation: null,
    },
    { ...lifecycle.primaryFailure, receiptRecorded: true },
    { ...lifecycle.primaryFailure, stage: "command_start" },
    { ...lifecycle.primaryFailure, purpose: "create_proxy" },
    { ...lifecycle.primaryFailure, exceptionCode: "EPIPE" },
  ]) {
    const candidate = prepareCoordinatorStateLifecycleSnapshot(
      diagnosticBeforeBytes,
      operation.recoveryId,
      {
        ...lifecycle,
        execution: { ...lifecycle.execution, ownerEffect: "disabled" },
        primaryFailure,
      },
      repository.repositoryBinding,
    );
    assert.ok(candidate);
    const rejected = historyRuntime.writeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      candidate,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      diagnosticBeforeBytes,
    );
  }
  const matchingDiagnostic = prepareCoordinatorStateLifecycleSnapshot(
    diagnosticBeforeBytes,
    operation.recoveryId,
    {
      ...lifecycle,
      execution: { ...lifecycle.execution, ownerEffect: "disabled" },
    },
    repository.repositoryBinding,
  );
  assert.ok(matchingDiagnostic);
  const diagnosticSaved = historyRuntime.writeRuntimeOwnedCoordinatorSettlement(
    historySettlement,
    matchingDiagnostic,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(diagnosticSaved.status, "completed", diagnosticSaved.reason);
  fs.writeFileSync(
    path.join(area.directory, "state.json"),
    beforeTerminalBytes,
  );
  const terminalSaved = writeRuntimeOwnedCoordinatorSettlement(
    settlement,
    terminalBytes,
    cleanupOutcome,
  );
  assert.equal(terminalSaved.status, "completed");
  assert.equal(terminalSaved.snapshotConfirmed, true);
  assert.equal(terminalSaved.lockReleased, true);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    terminalBytes,
  );
  for (const completion of [
    null,
    {},
    { status: "completed", cleanupConfirmed: true, homeLeaseReleased: true },
  ]) {
    const checkpoint = writeRuntimeOwnedCoordinatorHistoryCheckpoint(
      settlement,
      cleanupOutcome,
      completion,
    );
    assert.equal(checkpoint.status, "blocked");
    assert.equal(checkpoint.filesystemEffectIssued, false);
    assert.equal(checkpoint.snapshotConfirmed, false);
    const publication = publishRuntimeOwnedCoordinatorHistory(
      settlement,
      cleanupOutcome,
      completion,
    );
    assert.equal(publication.status, "blocked");
    assert.equal(publication.filesystemEffectIssued, false);
    assert.equal(publication.snapshotConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      terminalBytes,
    );
    assert.equal(
      fs.existsSync(path.join(area.directory, "history.jsonl")),
      false,
    );
  }
  const savedTerminalRead =
    readRuntimeOwnedCoordinatorSettlementSnapshot(settlement);
  assert.equal(savedTerminalRead.status, "completed");
  assert.deepEqual(savedTerminalRead.value?.snapshot, terminal);
  assert.equal(
    savedTerminalRead.value?.payloadSha256,
    createHash("sha256").update(terminalBytes).digest("hex"),
  );
  const missingTargetBytes = Buffer.from(
    `${encodeCoordinatorStateValue({ ...terminal, operations: [], unresolvedRecoveries: [], pendingDeliveries: [] })}\n`,
  );
  const stateFile = path.join(area.directory, "state.json");
  fs.writeFileSync(stateFile, missingTargetBytes);
  const missingTargetRead =
    readRuntimeOwnedCoordinatorSettlementSnapshot(settlement);
  assert.equal(missingTargetRead.status, "blocked");
  assert.equal(missingTargetRead.value, null);
  assert.equal(
    missingTargetRead.reason,
    "coordinator_state_settlement_target_invalid",
  );
  assert.deepEqual(fs.readFileSync(stateFile), missingTargetBytes);
  fs.writeFileSync(stateFile, terminalBytes);
  const gitDirectory = path.join(root, ".git");
  const retainedGitDirectory = path.join(root, "git-unavailable");
  fs.renameSync(gitDirectory, retainedGitDirectory);
  try {
    const changedRootRead =
      readRuntimeOwnedCoordinatorSettlementSnapshot(settlement);
    assert.equal(changedRootRead.status, "blocked");
    assert.equal(changedRootRead.value, null);
    assert.deepEqual(fs.readFileSync(stateFile), terminalBytes);
  } finally {
    fs.renameSync(retainedGitDirectory, gitDirectory);
  }
  const pendingFile = path.join(area.directory, "state.pending.json");
  fs.writeFileSync(pendingFile, terminalBytes);
  const pendingRead = readRuntimeOwnedCoordinatorSettlementSnapshot(settlement);
  assert.equal(pendingRead.status, "blocked");
  assert.equal(pendingRead.value, null);
  assert.equal(pendingRead.reason, "coordinator_state_reentry_required");
  assert.deepEqual(fs.readFileSync(pendingFile), terminalBytes);
  fs.unlinkSync(pendingFile);
  const unsafe = {
    ...terminal,
    revision: terminal.revision + 1,
    previous: {
      revision: terminal.revision,
      payloadSha256: createHash("sha256").update(terminalBytes).digest("hex"),
    },
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      phase: "executing",
    })),
  };
  const unprovenCleanup = {
    ...unsafe,
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      outcome: { ...value.outcome, cleanupConfirmed: true },
    })),
  };
  const unprovenLease = {
    ...unsafe,
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      lease: "released",
    })),
  };
  for (const invalid of [unsafe, unprovenCleanup, unprovenLease]) {
    const unsafeSaved = writeRuntimeOwnedCoordinatorSettlement(
      settlement,
      Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
      cleanupOutcome,
    );
    assert.equal(unsafeSaved.status, "blocked");
    assert.equal(unsafeSaved.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      terminalBytes,
    );
  }
  const summary = prepareCoordinatorStateHistorySummary(
    terminalBytes,
    operation.recoveryId,
    repository.repositoryBinding,
  );
  const terminalResource = terminal.operations
    .find((item: { kind?: unknown }) => item.kind === "docker_task")
    ?.resources.find(
      (value: typeof resource) => value.purpose === "create_provider",
    );
  assert.ok(terminalResource);
  const alteredResources = prepareCoordinatorStateResourceSnapshot(
    terminalBytes,
    operation.recoveryId,
    { ...terminalResource, observation: "present", absence: null },
    repository.repositoryBinding,
  );
  assert.ok(alteredResources);
  for (const dockerCompletion of [
    undefined,
    Object.freeze({
      status: "completed",
      cleanupConfirmed: true,
      resourceObservations: cleanupObservations,
    }),
  ]) {
    const rejected = writeRuntimeOwnedCoordinatorSettlement(
      settlement,
      alteredResources,
      cleanupOutcome,
      dockerCompletion,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), terminalBytes);
  }
  assert.ok(summary);
  const occurredAt = "2026-10-08T00:00:00.000Z";
  const line = Buffer.from(
    `${encodeCoordinatorStateValue({ schema: "crdd-coordinator/history-row/v2", occurredAt, summary: JSON.parse(summary.summaryBytes.toString("utf8")) })}\n`,
  );
  for (const confirmed of [false, true]) {
    const bypass = {
      ...terminal,
      revision: terminal.revision + 1,
      previous: {
        revision: terminal.revision,
        payloadSha256: createHash("sha256").update(terminalBytes).digest("hex"),
      },
      operations: terminal.operations.map((value: typeof operation) => ({
        ...value,
        summarySha256: summary.summarySha256,
        history: {
          occurredAt,
          lineSha256: createHash("sha256").update(line).digest("hex"),
          confirmed,
        },
      })),
    };
    const rejected = writeRuntimeOwnedCoordinatorSettlement(
      settlement,
      Buffer.from(`${encodeCoordinatorStateValue(bypass)}\n`),
      cleanupOutcome,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), terminalBytes);
  }
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  // 保存の正例用に未要求五資源の終端fixtureを置く。実Provider完了を主張しない。
  const historyFixture = {
    ...terminal,
    pendingDeliveries: [],
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      resources: value.resources.map((item) => ({
        ...item,
        request: "not_requested",
        dockerId: null,
        observation: "unobserved",
        absence: null,
      })),
      lease: "released",
      execution: {
        ...value.execution,
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
      },
      outcome: { ...value.outcome, cleanupConfirmed: true },
    })),
  };
  fs.writeFileSync(
    stateFile,
    `${encodeCoordinatorStateValue(historyFixture)}\n`,
  );
  const beforeResultRegistration = fs.readFileSync(stateFile);
  for (const [hostResult, completion, consumers] of [
    [{ ...cleanupOutcome }, simulatedCompletion, ["orchestrator"]],
    [cleanupOutcome, { ...simulatedCompletion }, ["orchestrator"]],
    [cleanupOutcome, simulatedCompletion, []],
    [cleanupOutcome, simulatedCompletion, ["workbench", "workbench"]],
  ] as const) {
    const refused =
      historyRuntime.registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
        historySettlement,
        hostResult,
        completion,
        consumers,
      );
    assert.equal(refused.status, "blocked");
    assert.equal(refused.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), beforeResultRegistration);
  }
  const fixed = historyRuntime.writeRuntimeOwnedCoordinatorHistoryCheckpoint(
    historySettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(fixed.status, "completed", fixed.reason);
  const resultBeforeRegistration =
    historyRuntime.readRuntimeOwnedCoordinatorSettlementResult(
      historySettlement,
      "orchestrator",
    );
  assert.equal(resultBeforeRegistration.status, "blocked");
  assert.equal(resultBeforeRegistration.value, null);
  const fixedBeforeRegistration = fs.readFileSync(stateFile);
  for (const consumers of [
    [],
    ["orchestrator", "workbench"],
    ["workbench", "workbench"],
    ["unknown"],
    { consumers: ["workbench"], resultId: "c".repeat(64) },
  ]) {
    const rejected =
      historyRuntime.registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
        historySettlement,
        cleanupOutcome,
        simulatedCompletion,
        consumers,
      );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), fixedBeforeRegistration);
  }
  const resultRegistered =
    historyRuntime.registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
      ["orchestrator"],
    );
  assert.equal(resultRegistered.status, "completed", resultRegistered.reason);
  assert.equal(resultRegistered.snapshotConfirmed, true);
  assert.equal(resultRegistered.lockReleased, true);
  const registeredResultBytes = fs.readFileSync(stateFile);
  const registeredResultIdentity = fs.lstatSync(stateFile, { bigint: true });
  const registeredResult = JSON.parse(registeredResultBytes.toString("utf8"));
  const observedResult =
    historyRuntime.readRuntimeOwnedCoordinatorSettlementResult(
      historySettlement,
      "orchestrator",
    );
  assert.equal(observedResult.status, "completed", observedResult.reason);
  assert.equal(observedResult.lockReleased, true);
  assert.deepEqual(observedResult.value, {
    repositoryBinding: repository.repositoryBinding,
    operationId: identity.recoveryCorrelationId,
    recoveryId: operation.recoveryId,
    resultId: registeredResult.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).summarySha256,
    consumer: "orchestrator",
  });
  const recoveryResultRoot = verifyRepositoryRoot(root);
  assert.equal(recoveryResultRoot.status, "completed");
  const recoveryReadHistoryFile = path.join(area.directory, "history.jsonl");
  const historyBeforeRecoveryRead = fs.existsSync(recoveryReadHistoryFile)
    ? fs.readFileSync(recoveryReadHistoryFile)
    : null;
  const freshResult = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "-e",
        `(async () => {
          const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
          const { readRuntimeOwnedCoordinatorRecoveryResult } = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
          const root = verifyRepositoryRoot(process.argv[1]);
          process.stdout.write(JSON.stringify(readRuntimeOwnedCoordinatorRecoveryResult(root.capability, process.argv[2])));
        })().catch(() => { process.exitCode = 1; });`,
        root,
        operation.recoveryId,
      ],
      { windowsHide: true, encoding: "utf8", timeout: 30_000 },
    ),
  );
  assert.deepEqual(freshResult, observedResult);
  assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
  assert.deepEqual(
    fs.existsSync(recoveryReadHistoryFile)
      ? fs.readFileSync(recoveryReadHistoryFile)
      : null,
    historyBeforeRecoveryRead,
  );
  for (const [rootCapability, recoveryId] of [
    [{}, operation.recoveryId],
    [{ ...recoveryResultRoot.capability }, operation.recoveryId],
    [verifyRepositoryRoot(otherRoot).capability, operation.recoveryId],
    [recoveryResultRoot.capability, "not-the-recorded-recovery"],
    [recoveryResultRoot.capability, null],
  ]) {
    const rejectedRead =
      historyRuntime.readRuntimeOwnedCoordinatorRecoveryResult(
        rootCapability,
        recoveryId,
      );
    assert.equal(rejectedRead.status, "blocked");
    assert.equal(rejectedRead.value, null);
    assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
  }
  for (const invalid of [
    { ...registeredResult, pendingDeliveries: [] },
    {
      ...registeredResult,
      pendingDeliveries: registeredResult.pendingDeliveries.map(
        (item: Record<string, unknown>) => ({
          ...item,
          resultId: "e".repeat(64),
        }),
      ),
    },
    {
      ...registeredResult,
      pendingDeliveries: registeredResult.pendingDeliveries.map(
        (item: Record<string, unknown>) => ({ ...item, consumer: "workbench" }),
      ),
    },
    {
      ...registeredResult,
      operations: registeredResult.operations.map(
        (item: Record<string, unknown>) => ({
          ...item,
          phase: "executing",
        }),
      ),
    },
    {
      ...registeredResult,
      operations: registeredResult.operations.map(
        (item: Record<string, unknown>) => ({
          ...item,
          resources: (item.resources as Record<string, unknown>[]).map(
            (resource, index) =>
              index === 0 ? { ...resource, request: "unknown" } : resource,
          ),
        }),
      ),
    },
  ]) {
    const invalidBytes = Buffer.from(
      `${encodeCoordinatorStateValue(invalid)}\n`,
    );
    try {
      fs.writeFileSync(stateFile, invalidBytes);
      const rejectedRead =
        historyRuntime.readRuntimeOwnedCoordinatorRecoveryResult(
          recoveryResultRoot.capability,
          operation.recoveryId,
        );
      assert.equal(rejectedRead.status, "blocked");
      assert.equal(rejectedRead.value, null);
      assert.deepEqual(fs.readFileSync(stateFile), invalidBytes);
      assert.deepEqual(
        fs.existsSync(recoveryReadHistoryFile)
          ? fs.readFileSync(recoveryReadHistoryFile)
          : null,
        historyBeforeRecoveryRead,
      );
    } finally {
      fs.writeFileSync(stateFile, registeredResultBytes);
    }
  }
  const pendingRecoveryReadFile = path.join(
    area.directory,
    "state.pending.json",
  );
  try {
    fs.writeFileSync(pendingRecoveryReadFile, registeredResultBytes);
    const pendingResult =
      historyRuntime.readRuntimeOwnedCoordinatorRecoveryResult(
        recoveryResultRoot.capability,
        operation.recoveryId,
      );
    assert.equal(pendingResult.status, "blocked");
    assert.equal(pendingResult.value, null);
    assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
    assert.deepEqual(
      fs.readFileSync(pendingRecoveryReadFile),
      registeredResultBytes,
    );
  } finally {
    fs.unlinkSync(pendingRecoveryReadFile);
  }
  const unverifiedAcceptance = prepareCoordinatorStateReferencesSnapshot(
    registeredResultBytes,
    operation.recoveryId,
    {
      recovery:
        registeredResult.unresolvedRecoveries.find(
          (item: { recoveryId: string }) =>
            item.recoveryId === operation.recoveryId,
        ) ?? null,
      deliveries: registeredResult.pendingDeliveries.map(
        (item: Record<string, unknown>) => ({
          ...item,
          acceptanceSha256: "f".repeat(64),
        }),
      ),
    },
    repository.repositoryBinding,
  );
  assert.ok(unverifiedAcceptance);
  const refusedAcceptance =
    historyRuntime.writeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      unverifiedAcceptance,
      cleanupOutcome,
    );
  assert.equal(refusedAcceptance.status, "blocked");
  assert.equal(refusedAcceptance.snapshotConfirmed, false);
  assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
  for (const [context, consumer] of [
    [{}, "orchestrator"],
    [{ ...historySettlement }, "orchestrator"],
    [historySettlement, "coordinator_cli"],
    [historySettlement, "unknown"],
  ]) {
    const unavailable =
      historyRuntime.readRuntimeOwnedCoordinatorSettlementResult(
        context,
        consumer,
      );
    assert.equal(unavailable.status, "blocked");
    assert.equal(unavailable.value, null);
    assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
  }
  assert.deepEqual(
    registeredResult.pendingDeliveries.map(
      (item: {
        consumer: string;
        resultId: string;
        acceptanceSha256: null;
      }) => [item.consumer, item.resultId, item.acceptanceSha256],
    ),
    [
      [
        "orchestrator",
        registeredResult.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).summarySha256,
        null,
      ],
    ],
  );
  const registrationReplay =
    historyRuntime.registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
      ["orchestrator"],
    );
  assert.equal(
    registrationReplay.status,
    "completed",
    registrationReplay.reason,
  );
  assert.equal(registrationReplay.filesystemEffectIssued, true);
  assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
  const replayedResultIdentity = fs.lstatSync(stateFile, { bigint: true });
  assert.equal(replayedResultIdentity.dev, registeredResultIdentity.dev);
  assert.equal(replayedResultIdentity.ino, registeredResultIdentity.ino);
  assert.equal(
    replayedResultIdentity.birthtimeNs,
    registeredResultIdentity.birthtimeNs,
  );
  const changedConsumers =
    historyRuntime.registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
      ["coordinator_cli"],
    );
  assert.equal(changedConsumers.status, "blocked");
  assert.equal(changedConsumers.filesystemEffectIssued, false);
  assert.deepEqual(fs.readFileSync(stateFile), registeredResultBytes);
  const fixedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(
    fixedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.confirmed,
    false,
  );
  const fixedTimestamp = fixedState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).history.occurredAt;
  const fixedBytes = fs.readFileSync(stateFile);
  const forgedHistory = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
    historySettlement,
    cleanupOutcome,
    { ...simulatedCompletion },
  );
  assert.equal(forgedHistory.status, "blocked");
  assert.equal(forgedHistory.filesystemEffectIssued, false);
  assert.deepEqual(fs.readFileSync(stateFile), fixedBytes);
  const historyPendingFile = path.join(area.directory, "history.pending.jsonl");
  let historySyncFailed = false;
  fs.fsyncSync = (fd) => {
    if (!historySyncFailed && fs.existsSync(historyPendingFile)) {
      historySyncFailed = true;
      throw new Error("fixture_history_sync_failure");
    }
    originalFsync(fd);
  };
  try {
    const unflushed = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(unflushed.status, "blocked");
    assert.equal(unflushed.snapshotConfirmed, false);
    assert.deepEqual(fs.readFileSync(stateFile), fixedBytes);
  } finally {
    fs.fsyncSync = originalFsync;
  }
  assert.equal(historySyncFailed, true);
  const pendingHistory = fs.readFileSync(historyPendingFile);
  fs.writeFileSync(historyPendingFile, Buffer.alloc(0));
  const alteredPending = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
    historySettlementAgain,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(alteredPending.status, "blocked");
  assert.deepEqual(fs.readFileSync(stateFile), fixedBytes);
  assert.equal(fs.readFileSync(historyPendingFile).length, 0);
  fs.writeFileSync(historyPendingFile, pendingHistory);
  // 履歴公開後・Snapshot公開前で失敗しても、別Contextから同じ行を再利用する。
  const originalRename = fs.renameSync;
  let statePublishFailed = false;
  fs.renameSync = (from, to) => {
    if (String(from).endsWith("state.pending.json") && !statePublishFailed) {
      statePublishFailed = true;
      throw new Error("fixture_state_publish_failure");
    }
    originalRename(from, to);
  };
  try {
    const interrupted = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(interrupted.status, "blocked");
    assert.equal(interrupted.snapshotConfirmed, false);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(statePublishFailed, true);
  const historyFile = path.join(area.directory, "history.jsonl");
  const firstHistory = fs.readFileSync(historyFile);
  assert.equal(firstHistory.toString("utf8").trim().split("\n").length, 1);
  const resumed = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
    historySettlementAgain,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(resumed.status, "completed", resumed.reason);
  assert.equal(resumed.snapshotConfirmed, true);
  assert.equal(resumed.lockReleased, true);
  assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
  const confirmedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(
    confirmedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.confirmed,
    true,
  );
  assert.equal(
    confirmedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.occurredAt,
    fixedTimestamp,
  );
  assert.deepEqual(
    confirmedState.pendingDeliveries,
    registeredResult.pendingDeliveries,
  );
  const repeated = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
    historySettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(repeated.status, "completed", repeated.reason);
  assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
  assert.deepEqual(fs.readdirSync(area.directory).sort(), [
    "history.jsonl",
    "state.json",
  ]);
  const beforeProjectAcceptance = fs.readFileSync(stateFile);
  assert.equal(
    historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
      recoveryResultRoot.capability,
      operation.recoveryId,
      null,
    ),
    null,
  );
  for (const [rootValue, target] of [
    [{ ...recoveryResultRoot.capability }, operation.recoveryId],
    [recoveryResultRoot.capability, "invalid"],
  ]) {
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
        rootValue,
        target,
        () => null,
      ),
      null,
    );
  }
  const recoveredContext =
    historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
      recoveryResultRoot.capability,
      operation.recoveryId,
      () => null,
    );
  assert.ok(recoveredContext);
  for (const context of [recoveredContext, { ...recoveredContext }]) {
    const refused = historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      context,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(refused.status, "blocked");
    assert.equal(refused.filesystemEffectIssued, false);
  }
  const freshPreparation = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "-e",
        `(async () => { const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
     const runtime = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
     const root = verifyRepositoryRoot(process.argv[1]);
     const context = runtime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(root.capability, process.argv[2], () => null);
     const refused = runtime.completeRuntimeOwnedCoordinatorSettlement(context, null, null);
     process.stdout.write(JSON.stringify({ prepared: context !== null, status: refused.status, effect: refused.filesystemEffectIssued })); })().catch(() => { process.exitCode = 1; });`,
        root,
        operation.recoveryId,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 30_000 },
    ),
  );
  assert.deepEqual(freshPreparation, {
    prepared: true,
    status: "blocked",
    effect: false,
  });
  assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
  const lateAcceptanceMissing =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      lateSettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(lateAcceptanceMissing.status, "blocked");
  assert.equal(lateReaderCalls, 1);
  assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  for (const context of [
    {},
    { ...historySettlement },
    historySettlementAgain,
  ]) {
    const refused = historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      context,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(refused.status, "blocked");
    assert.equal(refused.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  }
  for (const value of [null, Promise.resolve(null), { status: "blocked" }]) {
    projectAcceptanceValue = value;
    const refused = historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(refused.status, "blocked");
    assert.equal(refused.snapshotConfirmed, false);
    assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  }
  projectAcceptanceThrow = true;
  const failedReader =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(failedReader.status, "blocked");
  assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  projectAcceptanceThrow = false;
  const logicalAcceptance = {
    repositoryBindingId: "repository-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: identity.recoveryCorrelationId,
    recoveryId: operation.recoveryId,
    settlementGeneration: 7,
    repositoryBinding: repository.repositoryBinding,
    resultId: confirmedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).summarySha256,
    consumer: "orchestrator",
  };
  {
    const before = fs.readFileSync(stateFile);
    const child = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "-e",
          `(async () => {
        const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
        const runtime = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
        const root = verifyRepositoryRoot(process.argv[1]);
        const ack = JSON.parse(process.argv[3]);
        const context = runtime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(root.capability, process.argv[2], () => ack);
        const first = runtime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context);
        const replay = runtime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context);
        const replacement = runtime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(root.capability, process.argv[2], () => ack);
        process.stdout.write(JSON.stringify({ first, replay, replacement }));
      })().catch(() => { process.exitCode = 1; });`,
          root,
          operation.recoveryId,
          JSON.stringify(logicalAcceptance),
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30_000 },
      ),
    );
    assert.equal(child.first.status, "completed", child.first.reason);
    assert.equal(child.first.snapshotConfirmed, true);
    assert.equal(child.first.lockReleased, true);
    assert.equal(child.replay.status, "completed");
    assert.equal(child.replacement, null);
    const removed = prepareCoordinatorStateCompletionSnapshot(
      prepareCoordinatorStateProjectAcceptanceSnapshot(
        before,
        logicalAcceptance,
        repository.repositoryBinding,
      ),
      operation.recoveryId,
      repository.repositoryBinding,
    );
    assert.ok(removed);
    assert.deepEqual(fs.readFileSync(stateFile), removed);
    assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
    /**
     * 同じ自己生成Rootとexact対象の配送不存在観測を呼ぶ。
     * @responsibility 整理後Fixtureの正規・拒否Readerを同じ対象へ結合する。
     * @trace ERB-IT-003
     * @precondition 自己生成状態・履歴と真正Rootを保持している。
     * @stimulus 指定Readerを終了限定の不存在観測へ渡す。
     * @observation status・不存在観測・排他解放と元本文を確認する。
     * @oracle ACK・履歴・現在状態が共同成立した場合だけcompleted。
     * @cleanup 親試験が自己生成Fixtureと元版を復元・回収する。
     * @boundary 現在状態・履歴・固定上位Readerの実Filesystem境界。
     */
    const observeAbsent = (reader: () => unknown) =>
      historyRuntime.observeRuntimeOwnedCoordinatorCompletedDelivery(
        recoveryResultRoot.capability,
        operation.recoveryId,
        reader,
      );
    const absent = observeAbsent(() => logicalAcceptance);
    assert.equal(absent.status, "completed", absent.reason);
    assert.equal(absent.deliveryAbsentObserved, true);
    assert.equal(absent.lockReleased, true);
    for (const ack of [
      null,
      { ...logicalAcceptance, resultId: "0".repeat(64) },
      { ...logicalAcceptance, repositoryBinding: "0".repeat(64) },
      { ...logicalAcceptance, recoveryId: "invalid" },
      { ...logicalAcceptance, unexpected: true },
    ])
      assert.equal(observeAbsent(() => ack).status, "blocked");
    fs.writeFileSync(historyFile, Buffer.alloc(0));
    assert.equal(observeAbsent(() => logicalAcceptance).status, "blocked");
    fs.writeFileSync(historyFile, Buffer.concat([firstHistory, firstHistory]));
    assert.equal(observeAbsent(() => logicalAcceptance).status, "blocked");
    fs.writeFileSync(historyFile, firstHistory);
    fs.writeFileSync(pendingFile, removed);
    assert.equal(observeAbsent(() => logicalAcceptance).status, "blocked");
    fs.unlinkSync(pendingFile);
    fs.writeFileSync(stateFile, before);
    assert.equal(observeAbsent(() => logicalAcceptance).status, "blocked");
    fs.writeFileSync(stateFile, removed);
    const absentScript = `(async () => {
      const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
      const runtime = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
      const root = verifyRepositoryRoot(process.argv[1]);
      const ack = JSON.parse(process.argv[3]);
      process.stdout.write(JSON.stringify(runtime.observeRuntimeOwnedCoordinatorCompletedDelivery(root.capability, process.argv[2], () => ack)));
    })().catch(() => { process.exitCode = 1; });`;
    const freshAbsent = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "-e",
          absentScript,
          root,
          operation.recoveryId,
          JSON.stringify(logicalAcceptance),
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30_000 },
      ),
    );
    assert.equal(freshAbsent.status, "completed", freshAbsent.reason);
    assert.equal(freshAbsent.deliveryAbsentObserved, true);
    assert.equal(freshAbsent.lockReleased, true);
    assert.deepEqual(fs.readFileSync(stateFile), removed);
    assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
    fs.writeFileSync(stateFile, before);

    let recoveredAck: unknown = null;
    let isRecoveredReaderThrows = false;
    let recoveredReads = 0;
    let isChangeOnSecondRead = false;
    const context =
      historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
        recoveryResultRoot.capability,
        operation.recoveryId,
        () => {
          recoveredReads += 1;
          if (isRecoveredReaderThrows)
            throw new Error("fixture_recovered_reader");
          return isChangeOnSecondRead && recoveredReads === 2
            ? null
            : recoveredAck;
        },
      );
    assert.ok(context);
    for (const invalid of [{}, { ...context }, historySettlement]) {
      const refused =
        historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
          invalid,
        );
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
    }
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "blocked",
    );
    isRecoveredReaderThrows = true;
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "blocked",
    );
    isRecoveredReaderThrows = false;
    recoveredAck = logicalAcceptance;
    isChangeOnSecondRead = true;
    recoveredReads = 0;
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "blocked",
    );
    assert.deepEqual(fs.readFileSync(stateFile), before);
    isChangeOnSecondRead = false;
    let isFailedAcceptance = false;
    fs.renameSync = (source, target) => {
      if (
        String(source) === pendingFile &&
        String(target) === stateFile &&
        !isFailedAcceptance
      ) {
        isFailedAcceptance = true;
        throw new Error("fixture_recovered_acceptance_publish");
      }
      return Reflect.apply(originalRename, fs, [source, target]);
    };
    try {
      const failed =
        historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
          context,
        );
      assert.equal(failed.status, "blocked");
      assert.equal(failed.snapshotConfirmed, false);
      assert.equal(failed.filesystemEffectIssued, true);
    } finally {
      fs.renameSync = originalRename;
    }
    assert.equal(isFailedAcceptance, true);
    const pendingAck = fs.readFileSync(pendingFile);
    const pendingMarkerFile = path.join(path.dirname(stateFile), "state.lock");
    const pendingMarkerBytes = fs.readFileSync(pendingMarkerFile);
    fs.writeFileSync(pendingMarkerFile, Buffer.from("foreign-marker\n"));
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
        recoveryResultRoot.capability,
        operation.recoveryId,
        () => logicalAcceptance,
      ),
      null,
    );
    assert.deepEqual(fs.readFileSync(stateFile), before);
    assert.deepEqual(fs.readFileSync(pendingFile), pendingAck);
    fs.writeFileSync(pendingMarkerFile, pendingMarkerBytes);
    assert.equal(
      historyRuntime.readRuntimeOwnedCoordinatorRecoveryResult(
        recoveryResultRoot.capability,
        operation.recoveryId,
      ).status,
      "blocked",
    );
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
        recoveryResultRoot.capability,
        operation.recoveryId,
        () => null,
      ),
      null,
    );
    fs.writeFileSync(pendingFile, Buffer.from("invalid-pending\n"));
    assert.equal(
      historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
        recoveryResultRoot.capability,
        operation.recoveryId,
        () => logicalAcceptance,
      ),
      null,
    );
    assert.deepEqual(fs.readFileSync(stateFile), before);
    fs.writeFileSync(pendingFile, pendingAck);
    const pendingReentryScript = `(async () => {
      const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
      const runtime = await import(${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)});
      const root = verifyRepositoryRoot(process.argv[1]);
      const ack = JSON.parse(process.argv[3]);
      let reads = 0;
      const context = runtime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(root.capability, process.argv[2], () => { reads += 1; return ack; });
      const result = runtime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context);
      process.stdout.write(JSON.stringify({ prepared: context !== null, reads, result }));
    })().catch(() => { process.exitCode = 1; });`;
    const freshPendingAck = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "-e",
          pendingReentryScript,
          root,
          operation.recoveryId,
          JSON.stringify(logicalAcceptance),
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30_000 },
      ),
    );
    assert.equal(
      freshPendingAck.prepared,
      true,
      JSON.stringify(freshPendingAck),
    );
    assert.equal(
      freshPendingAck.result.status,
      "completed",
      freshPendingAck.result.reason,
    );
    assert.equal(freshPendingAck.result.snapshotConfirmed, true);
    assert.equal(freshPendingAck.result.lockReleased, true);
    assert.deepEqual(fs.readFileSync(stateFile), removed);
    assert.equal(fs.existsSync(pendingFile), false);
    assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
    // 同Contextの既存反証も維持するため、自己生成fixtureの元版と候補を復元する。
    fs.writeFileSync(stateFile, before);
    fs.writeFileSync(pendingFile, pendingAck);
    recoveredAck = null;
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "blocked",
    );
    assert.deepEqual(fs.readFileSync(stateFile), before);
    assert.deepEqual(fs.readFileSync(pendingFile), pendingAck);
    recoveredAck = logicalAcceptance;
    let publishes = 0;
    fs.renameSync = (source, target) => {
      if (
        String(source) === pendingFile &&
        String(target) === stateFile &&
        ++publishes === 2
      )
        throw new Error("fixture_recovered_completion_publish");
      return Reflect.apply(originalRename, fs, [source, target]);
    };
    try {
      const failed =
        historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
          context,
        );
      assert.equal(failed.status, "blocked");
      assert.equal(failed.snapshotConfirmed, false);
      assert.equal(failed.filesystemEffectIssued, true);
    } finally {
      fs.renameSync = originalRename;
    }
    assert.equal(publishes, 2);
    assert.deepEqual(fs.readFileSync(stateFile), pendingAck);
    const pendingRemoval = fs.readFileSync(pendingFile);
    const freshPendingRemoval = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "-e",
          pendingReentryScript,
          root,
          operation.recoveryId,
          JSON.stringify(logicalAcceptance),
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30_000 },
      ),
    );
    assert.equal(freshPendingRemoval.prepared, true);
    assert.equal(
      freshPendingRemoval.result.status,
      "completed",
      freshPendingRemoval.result.reason,
    );
    assert.equal(freshPendingRemoval.result.snapshotConfirmed, true);
    assert.equal(freshPendingRemoval.result.lockReleased, true);
    assert.deepEqual(fs.readFileSync(stateFile), removed);
    assert.equal(fs.existsSync(pendingFile), false);
    assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
    fs.writeFileSync(stateFile, pendingAck);
    fs.writeFileSync(pendingFile, pendingRemoval);
    recoveredAck = null;
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "blocked",
    );
    assert.deepEqual(fs.readFileSync(pendingFile), pendingRemoval);
    recoveredAck = logicalAcceptance;
    const resumed =
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
        context,
      );
    assert.equal(resumed.status, "completed", resumed.reason);
    assert.equal(resumed.snapshotConfirmed, true);
    assert.equal(resumed.lockReleased, true);
    assert.deepEqual(fs.readFileSync(stateFile), removed);
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "completed",
    );
    recoveredAck = null;
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(context)
        .status,
      "blocked",
    );
    assert.deepEqual(fs.readFileSync(stateFile), removed);
    assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
    fs.writeFileSync(stateFile, before);
  }
  projectAcceptanceValue = {
    ...logicalAcceptance,
    operationId: repository.operationId,
  };
  {
    const before = fs.readFileSync(stateFile);
    let acknowledgement: unknown = logicalAcceptance;
    for (const releaseAt of [1, 2]) {
      const context =
        historyRuntime.prepareRuntimeOwnedCoordinatorRecoveredSettlement(
          recoveryResultRoot.capability,
          operation.recoveryId,
          () => acknowledgement,
        );
      assert.ok(context);
      completionReleaseCount = 0;
      completionReleaseMissingAt = releaseAt;
      completionActualReleaseConfirmed = false;
      isCompletionReleaseObservationMissing = true;
      let interrupted: ReturnType<
        typeof historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement
      >;
      try {
        interrupted =
          historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
            context,
          );
      } finally {
        isCompletionReleaseObservationMissing = false;
      }
      assert.equal(completionActualReleaseConfirmed, true);
      assert.equal(interrupted.status, "blocked");
      assert.equal(interrupted.snapshotConfirmed, true);
      assert.equal(interrupted.lockReleased, false);
      const expectedAccepted = prepareCoordinatorStateProjectAcceptanceSnapshot(
        before,
        logicalAcceptance,
        repository.repositoryBinding,
      );
      assert.ok(expectedAccepted);
      const expectedRemoved = prepareCoordinatorStateCompletionSnapshot(
        expectedAccepted,
        operation.recoveryId,
        repository.repositoryBinding,
      );
      assert.ok(expectedRemoved);
      const interruptedBytes = fs.readFileSync(stateFile);
      assert.deepEqual(
        interruptedBytes,
        releaseAt === 1 ? expectedAccepted : expectedRemoved,
      );
      acknowledgement = null;
      const refused =
        historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
          context,
        );
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), interruptedBytes);
      acknowledgement = logicalAcceptance;
      const resumed =
        historyRuntime.completeRuntimeOwnedCoordinatorRecoveredSettlement(
          context,
        );
      assert.equal(resumed.status, "completed", resumed.reason);
      assert.equal(resumed.snapshotConfirmed, true);
      assert.equal(resumed.lockReleased, true);
      assert.deepEqual(fs.readFileSync(stateFile), expectedRemoved);
      assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
      fs.writeFileSync(stateFile, before);
    }
    completionReleaseCount = 0;
    completionReleaseMissingAt = 1;
    completionActualReleaseConfirmed = false;
  }
  projectAcceptanceValue = {
    ...logicalAcceptance,
    operationId: repository.operationId,
  };
  const physicalIdAcceptance =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(physicalIdAcceptance.status, "blocked");
  assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  projectAcceptanceValue = logicalAcceptance;
  projectAcceptanceReads = 0;
  isProjectAcceptanceChangeOnSecondRead = true;
  const changedReader =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(changedReader.status, "blocked");
  assert.equal(changedReader.snapshotConfirmed, false);
  assert.equal(projectAcceptanceReads, 2);
  assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  isProjectAcceptanceChangeOnSecondRead = false;
  let acceptancePublicationFailed = false;
  fs.renameSync = (from, to) => {
    if (
      String(from).endsWith("state.pending.json") &&
      !acceptancePublicationFailed
    ) {
      acceptancePublicationFailed = true;
      throw new Error("fixture_acceptance_publish_failure");
    }
    originalRename(from, to);
  };
  try {
    const interruptedAcceptance =
      historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
        historySettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
    assert.equal(interruptedAcceptance.status, "blocked");
    assert.equal(interruptedAcceptance.snapshotConfirmed, false);
    assert.equal(interruptedAcceptance.filesystemEffectIssued, true);
    assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(acceptancePublicationFailed, true);
  const savedProjectAcceptanceValue = projectAcceptanceValue;
  projectAcceptanceValue = null;
  const pendingAcceptanceBytes = fs.readFileSync(
    path.join(area.directory, "state.pending.json"),
  );
  const pendingReaderFailed =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(pendingReaderFailed.status, "blocked");
  assert.equal(pendingReaderFailed.snapshotConfirmed, false);
  assert.deepEqual(fs.readFileSync(stateFile), beforeProjectAcceptance);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.pending.json")),
    pendingAcceptanceBytes,
  );
  projectAcceptanceValue = savedProjectAcceptanceValue;
  projectAcceptanceReads = 0;
  const acceptedProject =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(acceptedProject.status, "completed", acceptedProject.reason);
  assert.equal(acceptedProject.snapshotConfirmed, true);
  assert.equal(acceptedProject.lockReleased, true);
  assert.equal(projectAcceptanceReads, 1);
  const acceptedProjectBytes = fs.readFileSync(stateFile);
  const acceptedProjectState = JSON.parse(
    acceptedProjectBytes.toString("utf8"),
  );
  assert.equal(
    acceptedProjectState.pendingDeliveries.find(
      (item: { consumer: string }) => item.consumer === "orchestrator",
    ).acceptanceSha256,
    createHash("sha256")
      .update(`${encodeCoordinatorStateValue(projectAcceptanceValue)}\n`)
      .digest("hex"),
  );
  assert.equal(acceptedProjectState.pendingDeliveries.length, 1);
  const acceptedResultRead =
    historyRuntime.readRuntimeOwnedCoordinatorRecoveryResult(
      recoveryResultRoot.capability,
      operation.recoveryId,
    );
  assert.equal(acceptedResultRead.status, "completed");
  assert.deepEqual(acceptedResultRead.value, observedResult.value);
  assert.deepEqual(fs.readFileSync(stateFile), acceptedProjectBytes);
  const lateReadsBeforeAcceptance = lateReaderCalls;
  const acceptedByLateReader =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      lateSettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(acceptedByLateReader.status, "completed");
  assert.equal(acceptedByLateReader.snapshotConfirmed, true);
  assert.equal(acceptedByLateReader.lockReleased, true);
  assert.equal(lateReaderCalls, lateReadsBeforeAcceptance + 2);
  assert.deepEqual(fs.readFileSync(stateFile), acceptedProjectBytes);
  projectAcceptanceReads = 0;
  const acceptanceReplay =
    historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(acceptanceReplay.status, "completed", acceptanceReplay.reason);
  assert.equal(projectAcceptanceReads, 2);
  assert.deepEqual(fs.readFileSync(stateFile), acceptedProjectBytes);
  for (const [context, hostResult, completion] of [
    [{}, cleanupOutcome, simulatedCompletion],
    [{ ...historySettlement }, cleanupOutcome, simulatedCompletion],
    [historySettlement, { ...cleanupOutcome }, simulatedCompletion],
    [historySettlement, cleanupOutcome, { ...simulatedCompletion }],
    [historySettlementAgain, cleanupOutcome, simulatedCompletion],
  ]) {
    const refused = historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      context,
      hostResult,
      completion,
    );
    assert.equal(refused.status, "blocked");
    assert.equal(refused.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), acceptedProjectBytes);
  }
  const unconnectedConsumerFixture = {
    ...JSON.parse(acceptedProjectBytes.toString("utf8")),
    pendingDeliveries: JSON.parse(
      acceptedProjectBytes.toString("utf8"),
    ).pendingDeliveries.map((delivery: Record<string, unknown>) => ({
      ...delivery,
      acceptanceSha256: "e".repeat(64),
    })),
  };
  fs.writeFileSync(
    stateFile,
    `${encodeCoordinatorStateValue(unconnectedConsumerFixture)}\n`,
  );
  const unconnectedBytes = fs.readFileSync(stateFile);
  assert.ok(
    prepareCoordinatorStateCompletionSnapshot(
      unconnectedBytes,
      operation.recoveryId,
      repository.repositoryBinding,
    ),
  );
  assert.equal(
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(stateFile), unconnectedBytes);
  // 耐久Consumer一つの登録集合を使う。実Providerの本番接続は別に確認する。
  const singleConsumerFixture = {
    ...JSON.parse(acceptedProjectBytes.toString("utf8")),
    pendingDeliveries: JSON.parse(
      acceptedProjectBytes.toString("utf8"),
    ).pendingDeliveries.filter(
      (delivery: { consumer: string }) => delivery.consumer === "orchestrator",
    ),
  };
  fs.writeFileSync(
    stateFile,
    `${encodeCoordinatorStateValue(singleConsumerFixture)}\n`,
  );
  const beforeCompletion = fs.readFileSync(stateFile);
  for (const field of [
    "providerStart",
    "externalSend",
    "sharedWrite",
  ] as const) {
    const unknownEffect = {
      ...singleConsumerFixture,
      operations: singleConsumerFixture.operations.map(
        (entry: { execution: Record<string, unknown> }) => ({
          ...entry,
          execution: { ...entry.execution, [field]: "unknown" },
        }),
      ),
    };
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(unknownEffect)}\n`),
        operation.recoveryId,
        repository.repositoryBinding,
      ),
      null,
    );
  }
  const removal = prepareCoordinatorStateCompletionSnapshot(
    beforeCompletion,
    operation.recoveryId,
    repository.repositoryBinding,
  );
  assert.ok(removal);
  assert.equal(
    historyRuntime.writeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      removal,
      cleanupOutcome,
      simulatedCompletion,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(stateFile), beforeCompletion);
  fs.writeFileSync(historyFile, "not-json\n");
  const invalidHistory =
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(invalidHistory.status, "blocked");
  assert.equal(invalidHistory.filesystemEffectIssued, false);
  assert.deepEqual(fs.readFileSync(stateFile), beforeCompletion);
  fs.writeFileSync(historyFile, firstHistory);
  projectAcceptanceValue = null;
  assert.equal(
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(stateFile), beforeCompletion);
  projectAcceptanceValue = savedProjectAcceptanceValue;
  let completionPublicationFailed = false;
  fs.renameSync = (source, target) => {
    if (
      String(source) === pendingFile &&
      String(target) === stateFile &&
      !completionPublicationFailed
    ) {
      completionPublicationFailed = true;
      throw new Error("fixture_completion_publish_failure");
    }
    return Reflect.apply(originalRename, fs, [source, target]);
  };
  let incompleteCompletion: ReturnType<
    typeof historyRuntime.completeRuntimeOwnedCoordinatorSettlement
  >;
  try {
    incompleteCompletion =
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        historySettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(completionPublicationFailed, true);
  assert.equal(incompleteCompletion.status, "blocked");
  assert.equal(incompleteCompletion.filesystemEffectIssued, true);
  assert.equal(incompleteCompletion.snapshotConfirmed, false);
  assert.deepEqual(fs.readFileSync(stateFile), beforeCompletion);
  const completionPending = fs.readFileSync(pendingFile);
  projectAcceptanceValue = null;
  const missingCompletionAcceptance =
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(missingCompletionAcceptance.status, "blocked");
  assert.deepEqual(fs.readFileSync(stateFile), beforeCompletion);
  assert.deepEqual(fs.readFileSync(pendingFile), completionPending);
  projectAcceptanceValue = savedProjectAcceptanceValue;
  // 整理された既確認履歴は再追加しない。不明I/Oとは区別する。
  fs.unlinkSync(historyFile);
  let isCompletionPublishedThenLost = false;
  fs.renameSync = (source, target) => {
    const result = Reflect.apply(originalRename, fs, [source, target]);
    if (
      String(source) === pendingFile &&
      String(target) === stateFile &&
      !isCompletionPublishedThenLost
    ) {
      isCompletionPublishedThenLost = true;
      throw new Error("fixture_completion_publication_result_lost");
    }
    return result;
  };
  let publicationUnknown: ReturnType<
    typeof historyRuntime.completeRuntimeOwnedCoordinatorSettlement
  >;
  try {
    publicationUnknown =
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        historySettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(isCompletionPublishedThenLost, true);
  assert.equal(publicationUnknown.status, "blocked");
  assert.equal(publicationUnknown.filesystemEffectIssued, true);
  assert.equal(publicationUnknown.snapshotConfirmed, false);
  assert.deepEqual(fs.readFileSync(stateFile), removal);
  assert.equal(fs.existsSync(pendingFile), false);
  projectAcceptanceValue = null;
  assert.equal(
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(stateFile), removal);
  projectAcceptanceValue = savedProjectAcceptanceValue;
  isCompletionReleaseObservationMissing = true;
  let completionReleaseUnknown: ReturnType<
    typeof historyRuntime.completeRuntimeOwnedCoordinatorSettlement
  >;
  try {
    completionReleaseUnknown =
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        historySettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
  } finally {
    isCompletionReleaseObservationMissing = false;
  }
  assert.equal(completionReleaseCount, 1);
  assert.equal(completionActualReleaseConfirmed, true);
  assert.equal(completionReleaseUnknown.status, "blocked");
  assert.equal(
    completionReleaseUnknown.reason,
    "coordinator_state_lock_release_unconfirmed",
  );
  assert.equal(completionReleaseUnknown.snapshotConfirmed, true);
  assert.equal(completionReleaseUnknown.lockReleased, false);
  assert.deepEqual(fs.readFileSync(stateFile), removal);
  assert.equal(fs.existsSync(pendingFile), false);
  assert.equal(fs.existsSync(historyFile), false);
  const completedOperation =
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(
    completedOperation.status,
    "completed",
    completedOperation.reason,
  );
  assert.equal(completedOperation.snapshotConfirmed, true);
  assert.equal(completedOperation.lockReleased, true);
  assert.deepEqual(fs.readFileSync(stateFile), removal);
  assert.equal(fs.existsSync(historyFile), false);
  assert.equal(fs.existsSync(pendingFile), false);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(stateFile, "utf8")).operations,
    [],
  );
  const completionReplay =
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(completionReplay.status, "completed", completionReplay.reason);
  assert.deepEqual(fs.readFileSync(stateFile), removal);
  assert.equal(
    historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
      historySettlementAgain,
      cleanupOutcome,
      simulatedCompletion,
    ).status,
    "blocked",
  );
  // 固定済み不存在根拠は再生成せず、元観測の意味を照合する。
  const identifiedFixture = JSON.parse(acceptedProjectBytes.toString("utf8"));
  const identifiedId = "a".repeat(64);
  identifiedFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).summarySha256 = null;
  identifiedFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).history = null;
  identifiedFixture.pendingDeliveries = [];
  const identifiedResource = identifiedFixture.operations
    .find((item: { kind?: unknown }) => item.kind === "docker_task")
    .resources.find(
      (item: { purpose: string }) => item.purpose === "create_provider",
    );
  assert.ok(identifiedResource);
  identifiedResource.request = "identified";
  identifiedResource.dockerId = identifiedId;
  identifiedResource.receiptSource = "docker_create_result";
  identifiedResource.observation = "absent";
  identifiedResource.absence = {
    recoveryId: operation.recoveryId,
    purpose: "create_provider",
    plannedResourceName: cleanupObservations.find(
      (item) => item.purpose === "create_provider",
    )?.plannedResourceName,
    dockerId: identifiedId,
    evidenceSha256: "c".repeat(64),
  };
  const identifiedFixed = prepareCoordinatorStateHistorySnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(identifiedFixture)}\n`),
    operation.recoveryId,
    "2026-10-08T00:00:00.000Z",
    false,
    repository.repositoryBinding,
  );
  assert.ok(identifiedFixed);
  const identifiedReady = prepareCoordinatorStateHistorySnapshot(
    identifiedFixed,
    operation.recoveryId,
    "2026-10-08T00:00:00.000Z",
    true,
    repository.repositoryBinding,
  );
  assert.ok(identifiedReady);
  fs.writeFileSync(stateFile, identifiedReady);
  observedProviderId = identifiedId;
  try {
    const readsBeforeDriver = projectAcceptanceReads;
    const firstDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
      historySettlementAgain,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(firstDriver.status, "completed", firstDriver.reason);
    assert.equal(firstDriver.deliveryPending, true);
    assert.ok(firstDriver.result);
    assert.equal(projectAcceptanceReads, readsBeforeDriver);
    const identifiedDelivered = fs.readFileSync(stateFile);
    const repeatedDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
      historySettlementAgain,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(repeatedDriver.status, "completed", repeatedDriver.reason);
    assert.equal(repeatedDriver.deliveryPending, true);
    assert.deepEqual(fs.readFileSync(stateFile), identifiedDelivered);
    for (const mismatch of ["different_id", "unknown_observation"]) {
      observedProviderId =
        mismatch === "different_id" ? "b".repeat(64) : identifiedId;
      observedProviderObservation =
        mismatch === "unknown_observation" ? "unknown" : "absent";
      const rejectedDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
        historySettlementAgain,
        cleanupOutcome,
        simulatedCompletion,
      );
      assert.equal(rejectedDriver.status, "blocked");
      assert.equal(rejectedDriver.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), identifiedDelivered);
    }
    observedProviderId = identifiedId;
    observedProviderObservation = "absent";
    projectAcceptanceValue = null;
    const missingIdentifiedAck =
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        identifiedSettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
    assert.equal(missingIdentifiedAck.status, "blocked");
    assert.deepEqual(fs.readFileSync(stateFile), identifiedDelivered);
    projectAcceptanceValue = {
      ...logicalAcceptance,
      resultId: JSON.parse(
        identifiedDelivered.toString("utf8"),
      ).operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).summarySha256,
    };
    const identifiedAcceptance =
      historyRuntime.acceptRuntimeOwnedCoordinatorProjectResult(
        identifiedSettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
    assert.equal(
      identifiedAcceptance.status,
      "completed",
      identifiedAcceptance.reason,
    );
    const identifiedAcceptedBytes = fs.readFileSync(stateFile);
    for (const observation of [
      { dockerId: "b".repeat(64), observation: "absent" },
      { dockerId: identifiedId, observation: "unknown" },
    ]) {
      observedProviderId = observation.dockerId;
      observedProviderObservation = observation.observation;
      const rejectedCompletion =
        historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
          identifiedSettlement,
          cleanupOutcome,
          simulatedCompletion,
        );
      assert.equal(rejectedCompletion.status, "blocked");
      assert.equal(rejectedCompletion.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), identifiedAcceptedBytes);
    }
    observedProviderId = identifiedId;
    observedProviderObservation = "absent";
    const identifiedComplete =
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        identifiedSettlement,
        cleanupOutcome,
        simulatedCompletion,
      );
    assert.equal(
      identifiedComplete.status,
      "completed",
      identifiedComplete.reason,
    );
    const identifiedCompletedState = JSON.parse(
      fs.readFileSync(stateFile, "utf8"),
    );
    assert.equal(identifiedCompletedState.operations.length, 0);
    assert.equal(identifiedCompletedState.pendingDeliveries.length, 0);
  } finally {
    observedProviderId = null;
    observedProviderObservation = "absent";
    projectAcceptanceValue = savedProjectAcceptanceValue;
  }
  // 未固定終端から履歴と耐久配送へ一度で接続し、返却前にACKを読まない。
  const initialDriverFixture = JSON.parse(
    acceptedProjectBytes.toString("utf8"),
  );
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identityJson = initialDriverIdentityJson;
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identitySha256 = initialDriverIdentitySha256;
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).recoveryId = initialDriverRecoveryId;
  initialDriverFixture.unresolvedRecoveries = [];
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).summarySha256 = null;
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).history = null;
  initialDriverFixture.pendingDeliveries = [];
  const initialDriverBytes = Buffer.from(
    `${encodeCoordinatorStateValue(initialDriverFixture)}\n`,
  );
  fs.writeFileSync(stateFile, initialDriverBytes);
  try {
    fs.unlinkSync(historyFile);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
  }
  for (const [context, host, completion] of [
    [{ ...initialDriverSettlement }, cleanupOutcome, simulatedCompletion],
    [initialDriverSettlement, { ...cleanupOutcome }, simulatedCompletion],
    [initialDriverSettlement, cleanupOutcome, { ...simulatedCompletion }],
  ]) {
    const refusedDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
      context,
      host,
      completion,
    );
    assert.equal(refusedDriver.status, "blocked");
    assert.equal(refusedDriver.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), initialDriverBytes);
    assert.equal(fs.existsSync(historyFile), false);
  }
  const readsBeforeInitialDriver = projectAcceptanceReads;
  assert.equal(
    historyRuntime.captureRuntimeOwnedCoordinatorSettlementInputs(
      initialDriverSettlement,
      { ...cleanupOutcome },
      simulatedCompletion,
    ),
    false,
  );
  assert.equal(
    historyRuntime.captureRuntimeOwnedCoordinatorSettlementInputs(
      initialDriverSettlement,
      cleanupOutcome,
      simulatedCompletion,
    ),
    true,
  );
  assert.equal(
    historyRuntime.captureRuntimeOwnedCoordinatorSettlementInputs(
      initialDriverSettlement,
      cleanupOutcome,
      { ...simulatedCompletion },
    ),
    false,
  );
  assert.deepEqual(fs.readFileSync(stateFile), initialDriverBytes);
  assert.equal(fs.existsSync(historyFile), false);
  const initialDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
    initialDriverSettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(initialDriver.status, "completed", initialDriver.reason);
  assert.equal(initialDriver.deliveryPending, true);
  assert.ok(initialDriver.result);
  assert.equal(projectAcceptanceReads, readsBeforeInitialDriver);
  const initialDeliveredBytes = fs.readFileSync(stateFile);
  const initialHistoryBytes = fs.readFileSync(historyFile);
  const initialDelivered = JSON.parse(initialDeliveredBytes.toString("utf8"));
  assert.equal(
    initialDelivered.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.confirmed,
    true,
  );
  assert.equal(initialDelivered.pendingDeliveries.length, 1);
  assert.equal(initialDelivered.pendingDeliveries[0].acceptanceSha256, null);
  const repeatedInitialDriver =
    historyRuntime.settleRuntimeOwnedCoordinatorResult(
      initialDriverSettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
  assert.equal(
    repeatedInitialDriver.status,
    "completed",
    repeatedInitialDriver.reason,
  );
  assert.equal(repeatedInitialDriver.deliveryPending, true);
  assert.deepEqual(fs.readFileSync(stateFile), initialDeliveredBytes);
  assert.deepEqual(fs.readFileSync(historyFile), initialHistoryBytes);
  assert.equal(projectAcceptanceReads, readsBeforeInitialDriver);
  fs.writeFileSync(historyFile, firstHistory);
  // 保存Identityと実Host清掃は固定し、Docker終端だけ模擬する一時返却のWriter試験。
  for (const transient of transientSettlements) {
    const fixture = JSON.parse(acceptedProjectBytes.toString("utf8"));
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identityJson = transient.identityJson;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identitySha256 = transient.identitySha256;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).recoveryId = transient.recoveryId;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).summarySha256 = null;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history = null;
    fixture.pendingDeliveries = [];
    fixture.unresolvedRecoveries = [];
    fs.writeFileSync(stateFile, `${encodeCoordinatorStateValue(fixture)}\n`);
    fs.unlinkSync(historyFile);
    const transientDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
      transient.driverContext,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(transientDriver.status, "completed", transientDriver.reason);
    assert.equal(transientDriver.deliveryPending, false);
    assert.equal(transientDriver.result, null);
    const transientDriverState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    assert.equal(transientDriverState.operations.length, 0);
    assert.equal(transientDriverState.pendingDeliveries.length, 0);
    assert.equal(
      fs.readFileSync(historyFile, "utf8").trim().split("\n").length,
      1,
    );
    fs.writeFileSync(historyFile, firstHistory);
    const transientFixed = prepareCoordinatorStateHistorySnapshot(
      Buffer.from(`${encodeCoordinatorStateValue(fixture)}\n`),
      transient.recoveryId,
      "2026-10-08T00:00:00.000Z",
      false,
      repository.repositoryBinding,
    );
    assert.ok(transientFixed);
    const transientReady = prepareCoordinatorStateHistorySnapshot(
      transientFixed,
      transient.recoveryId,
      "2026-10-08T00:00:00.000Z",
      true,
      repository.repositoryBinding,
    );
    assert.ok(transientReady);
    fs.writeFileSync(stateFile, transientReady);
    const transientRemoval = prepareCoordinatorStateCompletionSnapshot(
      transientReady,
      transient.recoveryId,
      repository.repositoryBinding,
    );
    assert.ok(transientRemoval);
    const generalRemoval =
      historyRuntime.writeRuntimeOwnedCoordinatorSettlement(
        transient.context,
        transientRemoval,
        cleanupOutcome,
        simulatedCompletion,
      );
    assert.equal(generalRemoval.status, "blocked");
    assert.equal(generalRemoval.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), transientReady);
    const readsBeforeCompletion: number = projectAcceptanceReads;
    isCompletionReleaseObservationMissing = true;
    completionReleaseCount = 0;
    completionReleaseMissingAt = 2;
    let transientComplete: ReturnType<
      typeof historyRuntime.completeRuntimeOwnedCoordinatorSettlement
    >;
    try {
      transientComplete =
        historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
          transient.context,
          cleanupOutcome,
          simulatedCompletion,
        );
    } finally {
      isCompletionReleaseObservationMissing = false;
      completionReleaseMissingAt = 1;
    }
    assert.equal(transientComplete.status, "blocked", transientComplete.reason);
    assert.equal(
      transientComplete.reason,
      "coordinator_state_lock_release_unconfirmed",
    );
    assert.equal(transientComplete.lockReleased, false);
    assert.equal(completionActualReleaseConfirmed, true);
    assert.equal(completionReleaseCount, 2);
    assert.equal(transientComplete.snapshotConfirmed, true);
    assert.deepEqual(fs.readFileSync(stateFile), transientRemoval);
    assert.equal(projectAcceptanceReads, readsBeforeCompletion);
    const readsBeforeReplay: number = projectAcceptanceReads;
    const transientReplay =
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        transient.context,
        cleanupOutcome,
        simulatedCompletion,
      );
    assert.equal(transientReplay.status, "completed", transientReplay.reason);
    assert.equal(projectAcceptanceReads, readsBeforeReplay);
    const driverReplay = historyRuntime.settleRuntimeOwnedCoordinatorResult(
      transient.context,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(driverReplay.status, "completed", driverReplay.reason);
    assert.equal(driverReplay.deliveryPending, false);
    assert.equal(driverReplay.result, null);
    assert.deepEqual(fs.readFileSync(stateFile), transientRemoval);
    assert.equal(projectAcceptanceReads, readsBeforeReplay);
    for (const unconfirmedContext of [transient.freshContext, {}]) {
      const refusedDriver = historyRuntime.settleRuntimeOwnedCoordinatorResult(
        unconfirmedContext,
        cleanupOutcome,
        simulatedCompletion,
      );
      assert.equal(refusedDriver.status, "blocked");
      assert.equal(refusedDriver.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), transientRemoval);
    }
    assert.equal(
      historyRuntime.completeRuntimeOwnedCoordinatorSettlement(
        transient.freshContext,
        cleanupOutcome,
        simulatedCompletion,
      ).status,
      "blocked",
    );
  }
  // 後続の既存履歴再入場試験へ自己生成fixtureを戻す。
  fs.writeFileSync(stateFile, acceptedProjectBytes);
  fs.writeFileSync(historyFile, firstHistory);
  // 別処理で整理済みの確認行は、再入場で復元しない。
  fs.unlinkSync(historyFile);
  const afterRetention = historyRuntime.publishRuntimeOwnedCoordinatorHistory(
    historySettlementAgain,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(afterRetention.status, "completed", afterRetention.reason);
  assert.equal(fs.existsSync(historyFile), false);
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  // 初回開始は空Snapshotを別保存せず、同じ操作を含む初版を確定する。
  const freshRoot = path.join(root, "fresh-start");
  execFileSync("git", ["init", "--quiet", freshRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      freshRoot,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const freshTests = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(freshRoot, "tests"),
    "fresh_owned_root",
  );
  const freshOwned = createOwnedOperationDirectories(freshTests.directory);
  try {
    const freshManagement = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(freshOwned),
      createOwnedMountCapability(freshOwned),
    );
    assert.ok(bindRuntimeOwnedRepositoryOperation(freshManagement, freshRoot));
    const freshRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(freshManagement);
    assert.ok(freshRepository);
    const startPlan = {
      provider: "claude" as const,
      consumer: "orchestrator" as const,
      operationId: freshRepository.operationId,
      grantRef: identity.grantRef,
      profileId: identity.profileId,
      stableLogicalHomeBindingHash: identity.stableLogicalHomeBindingHash,
      providerHomeIdentityHash: identity.providerHomeIdentityHash,
      providerHomeProtectionHash: identity.providerHomeProtectionHash,
      localUserBindingHash: identity.localUserBindingHash,
      authContainerName: identity.resources.auth,
      providerContainerName: identity.resources.provider,
      proxyContainerName: identity.resources.proxy,
      internalNetworkName: identity.resources.internal,
      egressNetworkName: identity.resources.egress,
      ownershipLabel: identity.ownershipLabel,
      providerImageDigest: identity.images.provider,
      proxyImageDigest: identity.images.proxy,
      operationMode: "isolated_task" as const,
      workspaceMountMode: "read_write" as const,
    };
    const freshIdentity = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      startPlan,
      freshManagement,
      "b".repeat(64),
      "orchestrator",
    );
    assert.ok(freshIdentity);
    const freshIdentityValue = JSON.parse(freshIdentity);
    assert.equal(freshIdentityValue.consumer, startPlan.consumer);
    assert.equal(freshIdentityValue.hostPaths.root, freshOwned.root);
    assert.equal(
      path
        .relative(freshRoot, freshIdentityValue.hostPaths.root)
        .startsWith(".."),
      false,
    );
    assert.equal(
      freshIdentityValue.repositoryBinding,
      freshRepository.repositoryBinding,
    );
    assert.equal(
      Object.hasOwn(freshIdentityValue, "runtimeStateBinding"),
      false,
    );
    assert.equal(
      freshIdentityValue.initialHostRecovery.recordHash,
      freshIdentityValue.initialHostRecoveryId.split(".").at(-1),
    );
    for (const [plan, owner, nonce] of [
      [startPlan, null, "b".repeat(64)],
      [startPlan, { ...freshManagement }, "b".repeat(64)],
      [
        { ...startPlan, operationId: "OP-999999" },
        freshManagement,
        "b".repeat(64),
      ],
      [startPlan, freshManagement, "invalid"],
      ...[
        "authContainerName",
        "providerContainerName",
        "proxyContainerName",
        "internalNetworkName",
        "egressNetworkName",
        "ownershipLabel",
        "providerImageDigest",
        "proxyImageDigest",
      ].map(
        (key) =>
          [
            { ...startPlan, [key]: "invalid" },
            freshManagement,
            "b".repeat(64),
          ] as const,
      ),
      [
        { ...startPlan, proxyContainerName: startPlan.authContainerName },
        freshManagement,
        "b".repeat(64),
      ],
    ] as const) {
      assert.equal(
        prepareRuntimeOwnedRepositoryDockerOperationIdentity(
          plan,
          owner,
          nonce,
          "orchestrator",
        ),
        null,
      );
    }
    for (const consumer of [
      undefined,
      null,
      "unknown",
      "coordinator_cli",
      "workbench",
    ]) {
      assert.equal(
        prepareRuntimeOwnedRepositoryDockerOperationIdentity(
          startPlan,
          freshManagement,
          "b".repeat(64),
          consumer,
        ),
        null,
      );
    }
    for (const consumer of [
      undefined,
      null,
      "unknown",
      "coordinator_cli",
      "workbench",
    ]) {
      assert.equal(
        prepareRuntimeOwnedRepositoryDockerOperationIdentity(
          { ...startPlan, consumer } as never,
          freshManagement,
          "b".repeat(64),
          "orchestrator",
        ),
        null,
      );
    }
    const freshStarted = saveRuntimeOwnedCoordinatorOperationStart(
      freshManagement,
      freshIdentity,
    );
    assert.equal(freshStarted.status, "completed", freshStarted.reason);
    assert.equal(freshStarted.snapshotConfirmed, true);
    assert.equal(freshStarted.lockReleased, true);
    assert.ok(freshStarted.recoveryId);
    const freshArea = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        freshRoot,
        "coordinator",
      ),
      "fresh_state_root",
    );
    const freshStateFile = path.join(freshArea.directory, "state.json");
    assert.deepEqual(
      fs.readFileSync(freshStateFile),
      prepareCoordinatorStateOperationSnapshot(
        null,
        freshIdentity,
        freshRepository.repositoryBinding,
      ),
    );
    assert.equal(
      readRuntimeOwnedCoordinatorStateSnapshot(freshManagement).value?.snapshot
        .revision,
      1,
    );
    assert.deepEqual(fs.readdirSync(freshArea.directory), ["state.json"]);
    const hostBefore = borrowOwnedHostRecoverySnapshot(freshManagement);
    assert.throws(() =>
      beginOwnedDockerSubmissionRecovery({}, freshRepository.operationId),
    );
    assert.throws(() =>
      beginOwnedDockerSubmissionRecovery(freshManagement, "OP-999999"),
    );
    assert.equal(
      borrowOwnedHostRecoverySnapshot(freshManagement).snapshot.token,
      hostBefore.snapshot.token,
    );
    const submissionToken = beginOwnedDockerSubmissionRecovery(
      freshManagement,
      freshRepository.operationId,
    );
    const hostStarted = borrowOwnedHostRecoverySnapshot(freshManagement);
    assert.equal(hostStarted.snapshot.token, submissionToken);
    assert.equal(
      hostStarted.snapshot.record.state,
      "docker_submission_started",
    );
    assert.equal(hostStarted.hostPaths.root, freshOwned.root);
    assert.notEqual(
      hostStarted.snapshot.recordHash,
      hostBefore.snapshot.recordHash,
    );
    assert.throws(() =>
      completeOwnedDockerSubmissionRecovery(
        freshManagement,
        hostBefore.snapshot.token,
      ),
    );
    const completedToken = completeOwnedDockerSubmissionRecovery(
      freshManagement,
      submissionToken,
    );
    assert.equal(completedToken, hostBefore.snapshot.token);
    assert.equal(
      borrowOwnedHostRecoverySnapshot(freshManagement).snapshot.record.state,
      "host_only",
    );
    let beginCalls = 0;
    let completeCalls = 0;
    let isFailHostObservation = false;
    let hostObservationCalls = 0;
    const cleanupResult = Object.freeze({
      confirmed: true,
      processTreeTerminated: true,
      containersAbsent: true,
      networksAbsent: true,
    });
    let acceptedCleanup: unknown = cleanupResult;
    const mountResult = Object.freeze({});
    const recoveryCapability = Object.freeze({});
    const completionPlan = {
      ...startPlan,
      activeMountCapability: Object.freeze({}),
    } as unknown as Parameters<
      typeof import("../../src/state-storage/settlement-store.ts").completeRuntimeOwnedCoordinatorHostSubmission
    >[2];
    const cleanupObservations = (
      [
        ["create_egress_network", "egress"],
        ["create_internal_network", "internal"],
        ["create_provider", "provider"],
        ["create_proxy", "proxy"],
        ["create_subscription_auth_probe", "auth"],
      ] as const
    ).map(([purpose, name]) => ({
      purpose,
      plannedResourceName: freshIdentityValue.resources[name],
      dockerId: null,
      observation: "not_requested",
    }));
    const dockerEffects = await import(
      "../../src/provider/isolation-execution.ts"
    );
    const mountRuntime = await import(
      "../../src/provider/home-mount-authorization.ts"
    );
    const cleanupMock = t.mock.module(
      "../../src/provider/isolation-execution.ts",
      {
        namedExports: {
          ...dockerEffects,
          verifyRuntimeOwnedDockerCleanupOutcome(
            result: unknown,
            plan: unknown,
            recovery: unknown,
            owner: unknown,
          ) {
            return result === acceptedCleanup &&
              plan === completionPlan &&
              recovery === recoveryCapability &&
              owner === freshManagement
              ? cleanupObservations
              : null;
          },
        },
      },
    );
    const mountMock = t.mock.module(
      "../../src/provider/home-mount-authorization.ts",
      {
        namedExports: {
          ...mountRuntime,
          verifyRuntimeOwnedProviderHomeMountCompletion(
            result: unknown,
            owner: unknown,
            active: unknown,
            operationId: unknown,
            home: unknown,
          ) {
            return (
              result === mountResult &&
              owner === freshManagement &&
              active === completionPlan.activeMountCapability &&
              operationId === completionPlan.operationId &&
              home === completionPlan.stableLogicalHomeBindingHash
            );
          },
        },
      },
    );
    const hostStartMock = t.mock.module(
      "../../src/host-execution/operation-workspace-lifecycle.ts",
      {
        namedExports: {
          ...executionEnvironment,
          borrowOwnedHostRecoverySnapshot(owner: unknown) {
            if (isFailHostObservation && ++hostObservationCalls === 2)
              throw new Error("host_observation_missing");
            return executionEnvironment.borrowOwnedHostRecoverySnapshot(owner);
          },
          beginOwnedDockerSubmissionRecovery(
            owner: unknown,
            operationId: unknown,
          ) {
            beginCalls += 1;
            if (beginCalls === 1) throw new Error("host_start_before_write");
            const token =
              executionEnvironment.beginOwnedDockerSubmissionRecovery(
                owner,
                operationId,
              );
            if (beginCalls === 2) throw new Error("host_start_response_lost");
            return token;
          },
          completeOwnedDockerSubmissionRecovery(
            owner: unknown,
            token: unknown,
          ) {
            completeCalls += 1;
            if (completeCalls === 1)
              throw new Error("host_complete_before_write");
            const next =
              executionEnvironment.completeOwnedDockerSubmissionRecovery(
                owner,
                token,
              );
            if (completeCalls === 2)
              throw new Error("host_complete_response_lost");
            return next;
          },
        },
      },
    );
    try {
      const hostStartModule = new URL(
        "../../src/state-storage/settlement-store.ts?host-start-reentry",
        import.meta.url,
      ).href;
      const hostStartRuntime: typeof import("../../src/state-storage/settlement-store.ts") =
        await import(hostStartModule);
      const beforeHostRequest = fs.readFileSync(freshStateFile);
      const wrongOwner =
        hostStartRuntime.beginRuntimeOwnedCoordinatorHostSubmission(
          {},
          freshStarted.recoveryId,
        );
      assert.equal(wrongOwner.status, "blocked");
      assert.equal(wrongOwner.hostTransitionRequested, false);
      assert.equal(beginCalls, 0);
      assert.deepEqual(fs.readFileSync(freshStateFile), beforeHostRequest);
      const interruptedBefore =
        hostStartRuntime.beginRuntimeOwnedCoordinatorHostSubmission(
          freshManagement,
          freshStarted.recoveryId,
        );
      assert.equal(interruptedBefore.status, "blocked");
      assert.equal(interruptedBefore.recoveryId, freshStarted.recoveryId);
      assert.equal(interruptedBefore.hostTransitionRequested, true);
      assert.equal(interruptedBefore.hostTransitionConfirmed, false);
      const pendingHostBytes = fs.readFileSync(freshStateFile);
      const pendingHost = JSON.parse(pendingHostBytes.toString("utf8"));
      const intent = JSON.parse(
        pendingHost.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.pendingTransitionJson,
      );
      assert.equal(intent.currentToken, completedToken);
      assert.equal(
        pendingHost.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.currentToken,
        completedToken,
      );
      assert.equal(
        borrowOwnedHostRecoverySnapshot(freshManagement).snapshot.token,
        completedToken,
      );
      const responseLost =
        hostStartRuntime.beginRuntimeOwnedCoordinatorHostSubmission(
          freshManagement,
          freshStarted.recoveryId,
        );
      assert.equal(responseLost.status, "blocked");
      assert.equal(responseLost.recoveryId, freshStarted.recoveryId);
      assert.equal(responseLost.hostTransitionRequested, true);
      assert.equal(responseLost.hostTransitionConfirmed, false);
      assert.equal(responseLost.filesystemEffectIssued, true);
      assert.deepEqual(fs.readFileSync(freshStateFile), pendingHostBytes);
      assert.equal(
        borrowOwnedHostRecoverySnapshot(freshManagement).snapshot.token,
        intent.expectedToken,
      );
      const resumed =
        hostStartRuntime.beginRuntimeOwnedCoordinatorHostSubmission(
          freshManagement,
          freshStarted.recoveryId,
        );
      assert.equal(resumed.status, "completed", resumed.reason);
      assert.equal(resumed.recoveryId, freshStarted.recoveryId);
      assert.equal(resumed.hostTransitionRequested, false);
      assert.equal(resumed.hostTransitionConfirmed, true);
      assert.equal(resumed.snapshotConfirmed, true);
      assert.equal(resumed.lockReleased, true);
      assert.equal(beginCalls, 2);
      const confirmedHostBytes = fs.readFileSync(freshStateFile);
      const confirmedHost = JSON.parse(confirmedHostBytes.toString("utf8"));
      assert.equal(
        confirmedHost.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.currentToken,
        intent.expectedToken,
      );
      assert.equal(
        confirmedHost.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.pendingTransitionJson,
        null,
      );
      const replay =
        hostStartRuntime.beginRuntimeOwnedCoordinatorHostSubmission(
          freshManagement,
          freshStarted.recoveryId,
        );
      assert.equal(replay.status, "blocked");
      assert.equal(replay.hostTransitionRequested, false);
      assert.equal(beginCalls, 2);
      assert.deepEqual(fs.readFileSync(freshStateFile), confirmedHostBytes);
      const completeHost = (
        cleanup: unknown = cleanupResult,
        mount: unknown = mountResult,
      ) =>
        hostStartRuntime.completeRuntimeOwnedCoordinatorHostSubmission(
          freshManagement,
          freshStarted.recoveryId,
          completionPlan,
          recoveryCapability,
          cleanup,
          mount,
        );
      for (const [cleanup, mount] of [
        [{}, mountResult],
        [cleanupResult, {}],
        [null, mountResult],
        [cleanupResult, null],
      ]) {
        const invalid = completeHost(cleanup, mount);
        assert.equal(invalid.status, "blocked");
        assert.equal(invalid.hostTransitionRequested, false);
        assert.deepEqual(fs.readFileSync(freshStateFile), confirmedHostBytes);
      }
      assert.equal(completeCalls, 0);
      for (const field of [
        "confirmed",
        "processTreeTerminated",
        "containersAbsent",
        "networksAbsent",
      ]) {
        for (const value of [false, undefined, "unknown"]) {
          acceptedCleanup = Object.freeze({ ...cleanupResult, [field]: value });
          assert.equal(completeHost(acceptedCleanup).status, "blocked");
          assert.equal(completeCalls, 0);
          assert.deepEqual(fs.readFileSync(freshStateFile), confirmedHostBytes);
        }
      }
      acceptedCleanup = cleanupResult;
      isFailHostObservation = true;
      hostObservationCalls = 0;
      const observedBeforeFailure = fs.readFileSync(freshStateFile);
      const observationFailed = completeHost();
      isFailHostObservation = false;
      assert.equal(observationFailed.status, "blocked");
      assert.equal(observationFailed.filesystemEffectIssued, true);
      assert.equal(observationFailed.snapshotConfirmed, false);
      assert.equal(observationFailed.hostTransitionRequested, false);
      assert.equal(observationFailed.recoveryId, freshStarted.recoveryId);
      assert.equal(completeCalls, 0);
      const afterObservationFailure = fs.readFileSync(freshStateFile);
      assert.notDeepEqual(afterObservationFailure, observedBeforeFailure);
      const observationFailureState = JSON.parse(
        afterObservationFailure.toString("utf8"),
      );
      assert.equal(
        observationFailureState.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.pendingTransitionJson,
        null,
      );
      assert.equal(
        observationFailureState.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.currentToken,
        intent.expectedToken,
      );
      const completeBefore = completeHost();
      assert.equal(completeBefore.status, "blocked");
      assert.equal(completeBefore.hostTransitionRequested, true);
      const completionPending = JSON.parse(
        fs.readFileSync(freshStateFile, "utf8"),
      );
      const completionIntent = JSON.parse(
        completionPending.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.pendingTransitionJson,
      );
      assert.equal(completionIntent.currentToken, intent.expectedToken);
      assert.equal(completionIntent.nextState, "host_only");
      const completeLost = completeHost();
      assert.equal(completeLost.status, "blocked");
      assert.equal(completeLost.hostTransitionRequested, true);
      assert.equal(
        borrowOwnedHostRecoverySnapshot(freshManagement).snapshot.token,
        completionIntent.expectedToken,
      );
      const completeResumed = completeHost();
      assert.equal(completeResumed.status, "completed", completeResumed.reason);
      assert.equal(completeResumed.hostTransitionRequested, false);
      assert.equal(completeResumed.hostTransitionConfirmed, true);
      assert.equal(completeCalls, 2);
      const completeBytes = fs.readFileSync(freshStateFile);
      const completeState = JSON.parse(completeBytes.toString("utf8"));
      assert.equal(
        completeState.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.currentToken,
        completedToken,
      );
      assert.equal(
        completeState.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.pendingTransitionJson,
        null,
      );
      assert.equal(
        completeState.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).host.cleanup,
        "not_requested",
      );
      assert.equal(completeHost().status, "blocked");
      assert.equal(completeCalls, 2);
      assert.deepEqual(fs.readFileSync(freshStateFile), completeBytes);
    } finally {
      hostStartMock.restore();
      cleanupMock.restore();
      mountMock.restore();
      const remainingHost = borrowOwnedHostRecoverySnapshot(freshManagement);
      if (remainingHost.snapshot.record.state === "docker_submission_started") {
        completeOwnedDockerSubmissionRecovery(
          freshManagement,
          remainingHost.snapshot.token,
        );
      }
    }
    fs.writeFileSync(freshStateFile, "invalid-state");
    const unreadableStarted = saveRuntimeOwnedCoordinatorOperationStart(
      freshManagement,
      `${JSON.stringify({ ...identity, operationId: freshRepository.operationId, repositoryBinding: freshRepository.repositoryBinding, operationNonce: "e".repeat(64) })}\n`,
    );
    assert.equal(unreadableStarted.status, "blocked");
    assert.equal(unreadableStarted.filesystemEffectIssued, false);
    assert.equal(unreadableStarted.snapshotConfirmed, false);
    assert.ok(unreadableStarted.recoveryId);
    assert.equal(fs.readFileSync(freshStateFile, "utf8"), "invalid-state");
    assert.deepEqual(fs.readdirSync(freshArea.directory), ["state.json"]);
  } finally {
    cleanupOwnedOperationDirectories(freshOwned);
  }
  const failedRoot = path.join(root, "failed-start");
  execFileSync("git", ["init", "--quiet", failedRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      failedRoot,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const failedTests = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(failedRoot, "tests"),
    "failed_owned_root",
  );
  const failedOwned = createOwnedOperationDirectories(failedTests.directory);
  const originalReadDirectory = fs.readdirSync;
  const failedArea = path.join(failedRoot, ".crdd", "coordinator");
  let areaReads = 0;
  let isWriterRefused = false;
  try {
    const failedManagement = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(failedOwned),
      createOwnedMountCapability(failedOwned),
    );
    assert.ok(
      bindRuntimeOwnedRepositoryOperation(failedManagement, failedRoot),
    );
    const failedRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(failedManagement);
    assert.ok(failedRepository);
    const failedIdentity = `${JSON.stringify({ ...identity, operationId: failedRepository.operationId, repositoryBinding: failedRepository.repositoryBinding })}\n`;
    fs.readdirSync = new Proxy(originalReadDirectory, {
      apply: (fn, receiver, args) => {
        const value = Reflect.apply(fn, receiver, args);
        if (args[0] === failedArea && ++areaReads === 2) {
          isWriterRefused = true;
          return ["fixture_unknown_content"];
        }
        return value;
      },
    });
    const failedStart = saveRuntimeOwnedCoordinatorOperationStart(
      failedManagement,
      failedIdentity,
    );
    assert.equal(isWriterRefused, true);
    assert.equal(failedStart.status, "blocked");
    assert.equal(failedStart.snapshotConfirmed, false);
    assert.equal(failedStart.filesystemEffectIssued, true);
    assert.equal(failedStart.lockReleased, true);
    assert.ok(failedStart.recoveryId);
    assert.equal(fs.existsSync(path.join(failedArea, "state.json")), false);
  } finally {
    fs.readdirSync = originalReadDirectory;
    cleanupOwnedOperationDirectories(failedOwned);
  }
  assert.deepEqual(fs.readdirSync(failedArea), []);
});

/**
 * 保存済み上位受理の同期Readerを固定されたTask結合で確認する。
 * @responsibility 上位Readerの戻り値を模擬し、受理本文・世代・Attempt照合を検証する。
 * @trace ERB-IT-003
 * @precondition 上位保存結果だけを模擬し、DockerやProviderを起動しない。
 * @stimulus 新形式ACK、後続世代、別Task、旧形式、読取り失敗を与える。
 * @observation 固定された読取り引数、返却本文、null拒否、入力の非変更。
 * @oracle 保存確認済みの同じAttemptの十一項目だけを返す。
 * @cleanup 試験スコープのModule mockを復元する。
 * @boundary ERB-IT-003=Direct Boundary: 上位保存Reader→終端受理Reader。
 */
/**
 * 確定未発行と発行済み既知失敗の再起動結果を実保存からTask終了へ接続する。
 * @responsibility 過去unknownを保持し、実Host清掃・履歴・transient操作除去を一つの入口で確認する。
 * @trace ERB-IT-003 ERB-IT-014
 * @precondition 自己生成Repository、未要求五資源、真正OwnerとWindows実排他を使う。
 * @stimulus 段階checkpoint、Owner解放、未発行／発行済み失敗の合成DI結果を実finalizeへ渡し公開回収を一回呼ぶ。
 * @observation 実Reader全文・Hash、Host／marker不存在、履歴一件、操作除去、再要求禁止。
 * @oracle 再起動blockedを維持したままTask回収だけが成立し、Docker実行を必要としない。
 * @cleanup 自己生成Rootだけを回収し不存在を確認する。
 * @boundary 実Writer／Kernel／Host／履歴。DI技術結果は合成で実再起動を証明しない。
 */
for (const issuedFailure of [false, true]) {
  test(`Host Windows: 再起動${issuedFailure ? "発行済み既知失敗" : "未発行の確定結果"}を実履歴とTask終了へ接続する`, async (t) => {
    const restartReason = issuedFailure
      ? "docker_restart_start_unconfirmed"
      : "docker_restart_stop_unconfirmed";
    assert.equal(process.platform, "win32");
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "restart_unissued_test",
    );
    const root = fs.mkdtempSync(path.join(area.directory, "restart-unissued-"));
    let owned: ReturnType<typeof createOwnedOperationDirectories> | null = null;
    let active = false;
    let management: object | null = null;
    t.after(async () => {
      if (active && management)
        await abandonOwnedHostOperationGenerationLock(management);
      if (owned && fs.existsSync(owned.root))
        cleanupOwnedOperationDirectories(owned);
      assert.equal(fs.realpathSync(root), root);
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(fs.existsSync(root), false);
    });
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { windowsHide: true },
    );
    const ownArea = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests"),
      "restart_unissued_owned",
    );
    owned = createOwnedOperationDirectories(ownArea.directory);
    management = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(owned),
      createOwnedMountCapability(owned),
    );
    assert.ok(bindRuntimeOwnedRepositoryOperation(management, root));
    const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
    assert.ok(repository);
    const verified = verifyRepositoryRoot(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const initial = Buffer.from(
      `${encodeCoordinatorStateValue({ schema: COORDINATOR_STATE_SCHEMA, revision: 1, previous: null, repositoryBinding: repository.repositoryBinding, operations: [], unresolvedRecoveries: [], pendingDeliveries: [] })}\n`,
    );
    assert.equal(
      prepareRuntimeOwnedCoordinatorStateInitialization(management, initial)
        .status,
      "prepared",
    );
    assert.equal(
      writeRuntimeOwnedCoordinatorStateSnapshot(management, initial).status,
      "completed",
    );
    const identity = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      {
        provider: "claude",
        consumer: "workbench",
        operationId: repository.operationId,
        grantRef: "PHMGRANT-FIXTURE",
        profileId: "PROFILE-123456",
        stableLogicalHomeBindingHash: "c".repeat(64),
        providerHomeIdentityHash: "8".repeat(64),
        providerHomeProtectionHash: "9".repeat(64),
        localUserBindingHash: "6".repeat(64),
        authContainerName: "crdd-auth-0123456789abcdef",
        providerContainerName: "crdd-claude-0123456789abcdef",
        proxyContainerName: "crdd-proxy-0123456789abcdef",
        internalNetworkName: "crdd-internal-0123456789abcdef",
        egressNetworkName: "crdd-egress-0123456789abcdef",
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
        providerImageDigest: `sha256:${"a".repeat(64)}`,
        proxyImageDigest: `sha256:${"b".repeat(64)}`,
        operationMode: "workbench_advice",
        workspaceMountMode: null,
      },
      management,
      "b".repeat(64),
      "workbench",
    );
    assert.ok(identity);
    const start = saveRuntimeOwnedCoordinatorOperationStart(
      management,
      identity,
    );
    assert.equal(start.status, "completed");
    assert.ok(start.recoveryId);
    assert.equal(
      await activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    active = true;
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    active = false;
    const preparation = prepareRuntimeOwnedDockerRestart(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(preparation.status, "prepared");
    assert.ok(preparation.capability);
    let released = false;
    try {
      for (const request of issuedFailure
        ? (["not_issued", "unknown", "issued"] as const)
        : (["not_issued", "unknown"] as const))
        assert.equal(
          persistRuntimeOwnedDockerRestartCheckpoint(preparation.capability, {
            requestId: preparation.requestId,
            scopeSha256: preparation.scopeSha256,
            request,
            cleanup: request === "not_issued" ? "not_required" : "pending",
            result: null,
          }),
          true,
        );
      assert.equal(
        releaseRuntimeOwnedDockerRestartPreparation(preparation.capability),
        true,
      );
      released = true;
      const finalized = finalizeRuntimeOwnedDockerRestartPreparation(
        preparation.capability,
        {
          requestId: preparation.requestId,
          status: "blocked",
          reason: restartReason,
          request: issuedFailure ? "issued" : "not_issued",
          primaryFailure: restartReason,
          stopFailure: null,
          startFailure: null,
          cleanupFailure: null,
          cleanupConfirmed: true,
          restartCompleted: false,
          effectOutcomeUnknown: false,
          startupElapsedMs: null,
          delivery: "confirmed",
        },
      );
      assert.equal(finalized.status, "completed");
      assert.equal(finalized.snapshotConfirmed, true);
      assert.equal(finalized.lockReleased, true);
    } finally {
      if (!released)
        releaseRuntimeOwnedDockerRestartPreparation(preparation.capability);
    }
    const saved = readRuntimeOwnedCoordinatorRecoverySnapshot(
      verified.capability,
    );
    assert.equal(saved.status, "completed");
    assert.ok(saved.value);
    const checkpoint = saved.value.snapshot.operations.find(
      (
        x,
      ): x is import("../../src/state-storage/model.ts").CoordinatorStateTaskOperation =>
        x.kind === "docker_task" && x.recoveryId === start.recoveryId,
    )?.dockerRestart;
    assert.deepEqual(checkpoint, {
      requestId: preparation.requestId,
      scopeSha256: preparation.scopeSha256,
      request: issuedFailure ? "issued" : "unknown",
      cleanup: "confirmed",
      result: {
        status: "blocked",
        reason: restartReason,
        request: issuedFailure ? "issued" : "not_issued",
        effectOutcomeUnknown: false,
      },
    });
    const result = await recoverRuntimeOwnedDockerTaskForCurrentConsumer(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(result.status, "recovered", result.reason);
    assert.equal(result.taskRecoveryCompleted, true);
    assert.equal(result.historyConfirmed, true);
    assert.equal(result.operationRemovalConfirmed, true);
    assert.equal(result.dockerCleanupConfirmed, true);
    assert.equal(result.hostCleanupConfirmed, true);
    assert.equal(result.locksReleased, true);
    assert.equal(fs.existsSync(owned.root), false);
    const after = readRuntimeOwnedCoordinatorRecoverySnapshot(
      verified.capability,
    );
    assert.equal(after.status, "completed");
    assert.equal(after.lockReleased, true);
    assert.ok(after.value);
    assert.deepEqual(after.value.snapshot.operations, []);
    assert.deepEqual(after.value.snapshot.unresolvedRecoveries, []);
    assert.deepEqual(after.value.snapshot.pendingDeliveries, []);
    const rows = fs
      .readFileSync(
        path.join(root, ".crdd", "coordinator", "history.jsonl"),
        "utf8",
      )
      .trim()
      .split("\n");
    assert.equal(rows.length, 1);
    const summary = JSON.parse(rows[0] ?? "").summary;
    assert.equal(summary.schema, "crdd-coordinator/operation-summary/v3");
    assert.deepEqual(summary.dockerRestart, checkpoint);
    assert.equal(summary.primaryFailure, null);
    assert.equal(summary.outcome.status, "blocked");
  });
}

/**
 * 専用auth不存在の候補を実Root・既存Kernel・固定File保存へ結合する。
 * @responsibility 模擬した過去観測を実保存の成立と区別し、CAS・Owner拒否と読戻しを確認する。
 * @trace ERB-IT-003 ERB-IT-014
 * @precondition Repository-localの自己生成Git Rootと合成したcodec合法状態だけを使う。
 * @stimulus 別operationId、Owner失効、元版差、rename故障と再入場後、本番Driver本文の観測順と保存停止を確認する。
 * @observation state全文、revision、Hash、短命File不存在、Kernel排他解放と実履歴・transient終了出版。
 * @oracle 拒否時の本文不変、成功時のauth以外全文不変とunknown維持。
 * @cleanup 自作Rootだけを回収し不存在を確認する。
 * @boundary 実Root／Kernel／Filesystemと本番Driver本文・履歴／終了出版。Owner生存・Host終了値・Docker観測・再起動結果・Driver Readerは代役で実Daemon／公開Consumerの証明ではない。
 */
test("Host Windows: 認証unknownの専用Writerを実保存へ接続する", async (t) => {
  assert.equal(process.platform, "win32");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "authentication_closure_store",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "auth-closure-store-"));
  let genericOwned: ReturnType<typeof createOwnedOperationDirectories> | null =
    null;
  t.after(() => {
    if (genericOwned && fs.existsSync(genericOwned.root)) {
      cleanupOwnedOperationDirectories(genericOwned);
      assert.equal(fs.existsSync(genericOwned.root), false);
    }
    assert.equal(fs.realpathSync(root), root);
    assert.equal(path.dirname(root), area.directory);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  const borrowed = borrowRuntimeOwnedCoordinatorRecoveryRepository(
    verified.capability,
  );
  assert.ok(borrowed);
  const ownArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests"),
    "authentication_generic_writer",
  );
  genericOwned = createOwnedOperationDirectories(ownArea.directory);
  const genericManagement = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(genericOwned),
    createOwnedMountCapability(genericOwned),
  );
  assert.ok(bindRuntimeOwnedRepositoryOperation(genericManagement, root));
  const genericRepository =
    borrowRuntimeOwnedCoordinatorStateRepository(genericManagement);
  assert.ok(genericRepository);
  assert.equal(genericRepository.repositoryBinding, borrowed.repositoryBinding);
  const repository = {
    ...borrowed,
    operationId: genericRepository.operationId,
  };
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token = `host.${hostRecord.rootName}.12345678-1234-4234-8234-123456789abc.${hostHash}`;
  const identityJson = `${JSON.stringify({
    schema: "crdd-coordinator/operation-identity/v1",
    operationNonce: "b".repeat(64),
    provider: "claude",
    consumer: "workbench",
    operationId: repository.operationId,
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: repository.repositoryBinding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "workbench_advice",
    workspaceMountMode: null,
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  })}\n`;
  const identitySha256 = createHash("sha256")
    .update(identityJson)
    .digest("hex");
  const recoveryId = `docker-task.${"c".repeat(64)}.${"b".repeat(64)}.${identitySha256}`;
  const requestId = createDockerRestartRequestId(
    repository.repositoryBinding,
    identitySha256,
    recoveryId,
    "f".repeat(64),
  );
  assert.ok(requestId);
  const snapshot = {
    schema: COORDINATOR_STATE_SCHEMA,
    revision: 1,
    previous: null,
    repositoryBinding: repository.repositoryBinding,
    operations: [
      {
        kind: "docker_task",
        identityJson,
        identitySha256,
        recoveryId,
        phase: "settling",
        resources: [
          "create_egress_network",
          "create_internal_network",
          "create_provider",
          "create_proxy",
          "create_subscription_auth_probe",
        ].map((purpose) => ({
          purpose,
          request:
            purpose === "create_subscription_auth_probe"
              ? "unknown"
              : "not_requested",
          dockerId: null,
          receiptSource: null,
          observation: "unobserved",
          absence: null,
        })),
        host: {
          currentToken: token,
          pendingTransitionJson: null,
          cleanup: "not_requested",
        },
        lease: "held",
        execution: {
          providerStart: "not_started",
          externalSend: "not_issued",
          sharedWrite: "not_issued",
          ownerEffect: "disabled",
          workspaceReusable: false,
        },
        dockerRestart: {
          requestId,
          scopeSha256: "f".repeat(64),
          request: "confirmed",
          cleanup: "confirmed",
          result: {
            status: "completed",
            reason: "docker_restart_settled",
            request: "confirmed",
            effectOutcomeUnknown: false,
          },
        },
        primaryFailure: null,
        outcome: null,
        summarySha256: null,
        history: null,
      },
    ],
    unresolvedRecoveries: [],
    pendingDeliveries: [],
  };
  const before = Buffer.from(`${encodeCoordinatorStateValue(snapshot)}\n`);
  const decodedBefore = decodeCoordinatorStateSnapshot(
    before,
    repository.repositoryBinding,
  );
  assert.ok(decodedBefore);
  const directory = path.join(root, ".crdd", "coordinator");
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "state.json");
  fs.writeFileSync(file, before);
  const observations = [
    { round: 1, name: "absent", name_label: "absent" },
    { round: 2, name: "absent", name_label: "absent" },
  ];
  const candidate = prepareCoordinatorAuthenticationUnknownClosureSnapshot(
    before,
    recoveryId,
    observations,
    repository.repositoryBinding,
  );
  assert.ok(candidate);
  const bypass = writeRuntimeOwnedCoordinatorStateSnapshot(
    genericManagement,
    candidate,
  );
  assert.equal(bypass.status, "blocked");
  assert.equal(
    bypass.reason,
    "coordinator_state_authentication_closure_owner_required",
  );
  assert.equal(bypass.filesystemEffectIssued, false);
  assert.equal(bypass.lockReleased, true);
  assert.ok(fs.readFileSync(file).equals(before));
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  let ownerLive = true,
    kernelAcquisitions = 0;
  const kernelLoss = t.mock.module("../../src/host-execution/kernel-lock.ts", {
    namedExports: {
      ...stateKernelLocks,
      acquireRuntimeOwnedCoordinatorStateKernelLock: (
        ...args: Parameters<
          typeof stateKernelLocks.acquireRuntimeOwnedCoordinatorStateKernelLock
        >
      ) => {
        const acquired =
          stateKernelLocks.acquireRuntimeOwnedCoordinatorStateKernelLock(
            ...args,
          );
        assert.ok(acquired);
        kernelAcquisitions++;
        ownerLive = false;
        return acquired;
      },
    },
  });
  try {
    const lostOwnerRuntime: typeof import("../../src/state-storage/settlement-store.ts") =
      await import(
        new URL(
          "../../src/state-storage/settlement-store.ts?authentication-owner-lost-after-lock",
          import.meta.url,
        ).href
      );
    const lostOwner =
      lostOwnerRuntime.writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
        repository,
        recoveryId,
        before,
        observations,
        () => ownerLive,
      );
    assert.equal(kernelAcquisitions, 1);
    assert.equal(lostOwner.status, "blocked");
    assert.equal(lostOwner.snapshotConfirmed, false);
    assert.equal(lostOwner.filesystemEffectIssued, false);
    assert.equal(lostOwner.lockReleased, true);
    assert.ok(fs.readFileSync(file).equals(before));
    assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  } finally {
    kernelLoss.restore();
  }
  for (const refusal of [
    "other_owner",
    "owner_lost",
    "stale_before",
  ] as const) {
    const result = writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
      refusal === "other_owner"
        ? { ...repository, operationId: "OP-654321" }
        : repository,
      recoveryId,
      refusal === "stale_before" ? candidate : before,
      observations,
      () => refusal !== "owner_lost",
    );
    assert.equal(result.status, "blocked", refusal);
    assert.equal(result.snapshotConfirmed, false, refusal);
    assert.equal(result.filesystemEffectIssued, false, refusal);
    assert.equal(result.lockReleased, true, refusal);
    assert.ok(fs.readFileSync(file).equals(before), refusal);
    assert.deepEqual(fs.readdirSync(directory), ["state.json"], refusal);
  }
  const originalRename = fs.renameSync;
  let interrupted = 0;
  const renameFailure = t.mock.method(
    fs,
    "renameSync",
    (from: fs.PathLike, to: fs.PathLike) => {
      if (
        String(from) === path.join(directory, "state.pending.json") &&
        String(to) === file
      ) {
        interrupted++;
        throw new Error("synthetic_authentication_closure_publication_failure");
      }
      return originalRename(from, to);
    },
  );
  try {
    const failed = writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
      repository,
      recoveryId,
      before,
      observations,
      () => true,
    );
    assert.equal(interrupted, 1);
    assert.equal(failed.status, "blocked");
    assert.equal(failed.snapshotConfirmed, false);
    assert.equal(failed.filesystemEffectIssued, true);
    assert.equal(failed.lockReleased, true);
    assert.ok(fs.readFileSync(file).equals(before));
    assert.ok(
      fs
        .readFileSync(path.join(directory, "state.pending.json"))
        .equals(candidate),
    );
  } finally {
    renameFailure.mock.restore();
  }
  const saved = writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
    repository,
    recoveryId,
    before,
    observations,
    () => true,
  );
  assert.equal(saved.status, "completed", saved.reason);
  assert.equal(saved.snapshotConfirmed, true);
  assert.equal(saved.filesystemEffectIssued, true);
  assert.equal(saved.lockReleased, true);
  assert.ok(fs.readFileSync(file).equals(candidate));
  const read = readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
  assert.equal(read.status, "completed");
  assert.equal(read.lockReleased, true);
  assert.ok(read.value);
  assert.equal(read.value.snapshot.revision, 2);
  assert.deepEqual(read.value.snapshot.previous, {
    revision: 1,
    payloadSha256: decodedBefore.payloadSha256,
  });
  const operation = read.value.snapshot.operations[0];
  assert.ok(operation?.kind === "docker_task");
  assert.equal(coordinatorTaskResourcesAreSettled(operation), true);
  assert.deepEqual(
    { ...operation, resources: snapshot.operations[0]?.resources },
    snapshot.operations[0],
  );
  /**
   * 保存後資源の許可差分だけを独立比較する。
   * @responsibility authの観測差分で他資源の変更を隠さない。
   * @trace ERB-IT-003 ERB-IT-014
   * @precondition 正常fixtureの元五資源を閉包から使う。
   * @stimulus 実読戻し資源またはその単独変更コピーを受ける。
   * @observation purpose順序・全文とauthのunknown／null／null。
   * @oracle auth observation／absence以外の差はassertion失敗になる。
   * @cleanup N/A: メモリ比較だけ。
   * @boundary 物理読戻しの資源別保全Oracle。
   */
  const assertPreservedResources = (
    resources: CoordinatorStateTaskOperation["resources"],
  ) => {
    const originals = snapshot.operations[0]?.resources;
    assert.ok(originals);
    assert.deepEqual(
      resources.map((resource) => resource.purpose),
      originals.map((resource) => resource.purpose),
    );
    for (const resource of resources) {
      const original: (typeof originals)[number] | undefined = originals.find(
        (item) => item.purpose === resource.purpose,
      );
      assert.ok(original);
      if (resource.purpose === "create_subscription_auth_probe") {
        assert.equal(resource.request, "unknown");
        assert.equal(resource.dockerId, null);
        assert.equal(resource.receiptSource, null);
        assert.deepEqual(
          {
            ...resource,
            observation: original.observation,
            absence: original.absence,
          },
          original,
        );
      } else assert.deepEqual(resource, original);
    }
  };
  assertPreservedResources(operation.resources);
  for (const purpose of [
    "create_internal_network",
    "create_subscription_auth_probe",
  ] as const) {
    const changed = operation.resources.map((resource) =>
      resource.purpose !== purpose
        ? resource
        : { ...resource, dockerId: "0".repeat(64) },
    );
    assert.throws(() => assertPreservedResources(changed));
  }
  assert.equal(
    operation.resources.find(
      (resource) => resource.purpose === "create_subscription_auth_probe",
    )?.request,
    "unknown",
  );
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const recoverySource = fs.readFileSync(
    new URL("../../src/task/recovery.ts", import.meta.url),
    "utf8",
  );
  const driverBody = [
    "currentDockerRecoveryResourceExpectations",
    "persistRuntimeOwnedDockerTaskRecoveryCheckpoint",
    "recoverRuntimeOwnedDockerTaskResources",
  ]
    .map((name) => {
      const start = recoverySource.indexOf(`export function ${name}(`);
      const end = recoverySource.indexOf("\n/**", start);
      assert.ok(start > 0 && end > start, name);
      return stripTypeScriptTypes(recoverySource.slice(start, end)).replace(
        "export function",
        "function",
      );
    })
    .join("\n");
  const idMutationPattern =
    /request: "identified",\s+dockerId,\s+receiptSource: "runtime_reconciliation"/g;
  const idMutationMatches = [...driverBody.matchAll(idMutationPattern)];
  assert.equal(idMutationMatches.length, 1);
  const idMutationMatch = idMutationMatches[0]?.[0];
  assert.ok(idMutationMatch);
  const wrongIdDriverBody = driverBody.replace(
    idMutationMatch,
    idMutationMatch.replace("dockerId,", 'dockerId: "e".repeat(64),'),
  );
  assert.notEqual(wrongIdDriverBody, driverBody);
  assert.equal([...wrongIdDriverBody.matchAll(idMutationPattern)].length, 0);
  for (const scenario of [
    "normal",
    "known_id",
    "known_id_mutant",
    "first_absence_unknown",
    "second_absence_unknown",
    "first_owner_lost",
    "second_owner_lost",
    "writer_refused",
    "writer_throw",
    "readback_mismatch",
    "release_unknown",
    "saved_reentry",
  ] as const) {
    const seed = scenario === "saved_reentry" ? candidate : before;
    fs.writeFileSync(file, seed);
    const owner = Object.freeze({});
    const events: string[] = [];
    let live = true,
      rounds = 0,
      closureWrites = 0,
      removals = 0,
      removalOracleHits = 0,
      idMismatchDetected = 0;
    const record: {
      kind: string;
      rootCapability: unknown;
      repository: object;
      recoveryId: string;
      before: Buffer;
      closed: boolean;
      persistenceFailed: boolean;
      cleanupUnknown: boolean;
      hostCleanup: string;
      hostCleanupPublication: null;
    } = {
      kind: "recovery",
      rootCapability: verified.capability,
      repository,
      recoveryId,
      before: Buffer.from(seed),
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "present",
      hostCleanupPublication: null,
    };
    const map = new WeakMap([[owner, record]]);
    const driver = runInNewContext(
      `${scenario === "known_id_mutant" ? wrongIdDriverBody : driverBody}; recoverRuntimeOwnedDockerTaskResources`,
      {
        Buffer,
        Object,
        Error,
        Map,
        dockerRecoveryPreparations: map,
        coordinatorTaskResourcesAreSettled,
        coordinatorAuthenticationUnknownCanClose,
        isDockerResourcePurpose,
        planDockerRecoveryResourceExpectations,
        codexAdviceProviderInitRequired: () => false,
        encodeCoordinatorStateValue,
        decodeCoordinatorStateSnapshot,
        assertCurrentRecoveryOwner: () => {
          events.push("owner");
          return live;
        },
        readRuntimeOwnedCoordinatorRecoverySnapshot: () => {
          events.push("read");
          const value = decodeCoordinatorStateSnapshot(
            fs.readFileSync(file),
            repository.repositoryBinding,
          );
          assert.ok(value);
          return {
            status: "completed",
            lockReleased: true,
            value:
              scenario === "readback_mismatch" && closureWrites > 0
                ? {
                    ...value,
                    snapshot: {
                      ...value.snapshot,
                      revision: value.snapshot.revision + 1,
                    },
                  }
                : value,
          };
        },
        writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
          ...args: Parameters<
            typeof writeRuntimeOwnedCoordinatorRecoveryCheckpoint
          >
        ) => {
          events.push(`write:${args[3]}`);
          const saved = writeRuntimeOwnedCoordinatorRecoveryCheckpoint(
            args[0],
            args[1],
            args[2],
            args[3],
            JSON.parse(JSON.stringify(args[4])),
            args[5],
          );
          events.push(`checkpoint:${saved.status}:${saved.reason}`);
          return saved;
        },
        writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure: (
          ...args: Parameters<
            typeof writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure
          >
        ) => {
          closureWrites++;
          events.push("write:closure");
          if (scenario === "writer_throw")
            throw new Error("synthetic_closure_writer_failure");
          if (scenario === "writer_refused")
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          const result =
            writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
              args[0],
              args[1],
              args[2],
              JSON.parse(JSON.stringify(args[3])),
              args[4],
            );
          return scenario === "release_unknown"
            ? { ...result, lockReleased: false }
            : result;
        },
      },
    ) as (
      capability: object,
      operations: object,
    ) => {
      status: string;
      reason: string;
      dockerCleanupConfirmed: boolean;
      recoveryId: string;
    };
    const observedId = "d".repeat(64);
    const result = driver(owner, {
      discoverSubmitted: () => {
        events.push("discover");
        return ["known_id", "known_id_mutant"].includes(scenario)
          ? observedId
          : null;
      },
      recoverObserved: (
        expectation: { dockerId: string },
        guard: { assertBeforeRemoval: () => boolean },
      ) => {
        events.push("remove");
        assert.equal(expectation.dockerId, observedId);
        assert.equal(guard.assertBeforeRemoval(), true);
        const current = decodeCoordinatorStateSnapshot(
          fs.readFileSync(file),
          repository.repositoryBinding,
        )?.snapshot.operations[0];
        assert.ok(current?.kind === "docker_task");
        const auth = current.resources.find(
          (resource) => resource.purpose === "create_subscription_auth_probe",
        );
        assert.ok(auth);
        removalOracleHits++;
        if (auth.dockerId !== observedId) idMismatchDetected++;
        assert.deepEqual(auth, {
          purpose: "create_subscription_auth_probe",
          request: "identified",
          dockerId: observedId,
          receiptSource: "runtime_reconciliation",
          observation: "present",
          absence: null,
        });
        removals++;
        return true;
      },
      observeAbsent: (kind: string, name: string, label: string) => {
        assert.equal(kind, "container");
        assert.equal(name, "crdd-auth-0123456789abcdef");
        assert.equal(label, "crdd.coordinator.runtime=0123456789abcdef");
        rounds++;
        events.push(`round:${rounds}`);
        if (
          (scenario === "first_owner_lost" && rounds === 1) ||
          (scenario === "second_owner_lost" && rounds === 2)
        )
          live = false;
        return !(
          (scenario === "first_absence_unknown" && rounds === 1) ||
          (scenario === "second_absence_unknown" && rounds === 2)
        );
      },
    });
    assert.equal(result.recoveryId, recoveryId, scenario);
    const completed = ["normal", "known_id", "saved_reentry"].includes(
      scenario,
    );
    assert.equal(
      result.status,
      completed ? "completed" : "blocked",
      `${scenario}: ${result.reason}: ${events.join(",")}`,
    );
    assert.equal(result.dockerCleanupConfirmed, completed, scenario);
    assert.equal(removals, scenario === "known_id" ? 1 : 0, scenario);
    assert.equal(
      removalOracleHits,
      ["known_id", "known_id_mutant"].includes(scenario) ? 1 : 0,
      scenario,
    );
    assert.equal(
      idMismatchDetected,
      scenario === "known_id_mutant" ? 1 : 0,
      scenario,
    );
    const shouldSave = [
      "normal",
      "writer_refused",
      "writer_throw",
      "readback_mismatch",
      "release_unknown",
      "saved_reentry",
    ].includes(scenario);
    assert.equal(closureWrites, shouldSave ? 1 : 0, scenario);
    assert.equal(
      rounds,
      ["known_id", "known_id_mutant"].includes(scenario)
        ? 0
        : ["first_absence_unknown", "first_owner_lost"].includes(scenario)
          ? 1
          : 2,
      scenario,
    );
    if (shouldSave) {
      const first = events.indexOf("round:1"),
        second = events.indexOf("round:2"),
        write = events.indexOf("write:closure");
      assert.ok(first >= 0 && second > first && write > second, scenario);
      assert.ok(events.slice(first + 1, second).includes("owner"), scenario);
      assert.ok(events.slice(second + 1, write).includes("read"), scenario);
    }
    if (scenario === "saved_reentry")
      assert.equal(events.includes("write:cleanup"), false);
    assert.equal(record.hostCleanup, "present", scenario);
    const persisted = decodeCoordinatorStateSnapshot(
      fs.readFileSync(file),
      repository.repositoryBinding,
    )?.snapshot.operations[0];
    assert.ok(persisted?.kind === "docker_task");
    assert.deepEqual(
      { ...persisted, resources: snapshot.operations[0]?.resources },
      snapshot.operations[0],
      scenario,
    );
    if (!["known_id", "known_id_mutant"].includes(scenario)) {
      assertPreservedResources(persisted.resources);
      const auth = persisted.resources.find(
        (resource) => resource.purpose === "create_subscription_auth_probe",
      );
      assert.ok(auth);
      assert.equal(
        auth.observation === "absent",
        [
          "normal",
          "readback_mismatch",
          "release_unknown",
          "saved_reentry",
        ].includes(scenario),
        scenario,
      );
    } else {
      for (const resource of persisted.resources) {
        if (resource.purpose === "create_subscription_auth_probe") {
          assert.equal(resource.request, "identified");
          assert.equal(
            resource.dockerId,
            scenario === "known_id" ? observedId : "e".repeat(64),
          );
          assert.equal(resource.receiptSource, "runtime_reconciliation");
          assert.equal(
            resource.observation,
            scenario === "known_id" ? "absent" : "present",
          );
        } else {
          assert.deepEqual(
            resource,
            snapshot.operations[0]?.resources.find(
              (original) => original.purpose === resource.purpose,
            ),
          );
        }
      }
    }
    assert.deepEqual(fs.readdirSync(directory), ["state.json"], scenario);
  }
  const last = decodeCoordinatorStateSnapshot(
    fs.readFileSync(file),
    repository.repositoryBinding,
  );
  const lastOperation = last?.snapshot.operations[0];
  assert.ok(last && lastOperation?.kind === "docker_task");
  const terminalTask: CoordinatorStateTaskOperation = {
    ...lastOperation,
    host: {
      ...lastOperation.host,
      pendingTransitionJson: null,
      cleanup: "confirmed",
    },
    lease: "released",
    outcome: {
      status: "blocked",
      reason: "docker_setup_create_subscription_auth_probe_failed",
      cleanupConfirmed: true,
    },
  };
  const terminalBytes = Buffer.from(
    `${encodeCoordinatorStateValue({ ...last.snapshot, operations: [terminalTask] })}\n`,
  );
  assert.ok(
    decodeCoordinatorStateSnapshot(terminalBytes, repository.repositoryBinding),
  );
  const corruptTask: CoordinatorStateTaskOperation = {
    ...terminalTask,
    resources: terminalTask.resources.map((resource) =>
      resource.purpose !== "create_subscription_auth_probe" || !resource.absence
        ? resource
        : {
            ...resource,
            absence: { ...resource.absence, evidenceSha256: "0".repeat(64) },
          },
    ),
  };
  const corruptBytes = Buffer.from(
    `${encodeCoordinatorStateValue({ ...last.snapshot, operations: [corruptTask] })}\n`,
  );
  assert.ok(
    decodeCoordinatorStateSnapshot(corruptBytes, repository.repositoryBinding),
  );
  fs.writeFileSync(file, corruptBytes);
  const refusedHistory = readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
    verified.capability,
    recoveryId,
  );
  assert.equal(refusedHistory.status, "blocked");
  assert.equal(refusedHistory.lockReleased, true);
  assert.ok(fs.readFileSync(file).equals(corruptBytes));
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  fs.writeFileSync(file, terminalBytes);
  const historyStart = readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
    verified.capability,
    recoveryId,
  );
  assert.equal(historyStart.status, "completed", historyStart.reason);
  assert.equal(historyStart.lockReleased, true);
  assert.ok(historyStart.currentHistoryPublication);
  let historyConfirmed = false;
  for (let stage = 0; stage < 5 && !historyConfirmed; stage++) {
    const advanced = advanceRuntimeOwnedCoordinatorRecoveryHistory(
      repository,
      recoveryId,
      () => true,
    );
    assert.equal(advanced.status, "completed", advanced.reason);
    assert.equal(advanced.snapshotConfirmed, true);
    assert.equal(advanced.lockReleased, true);
    historyConfirmed = advanced.historyConfirmed;
  }
  assert.equal(historyConfirmed, true);
  const completionReady = readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
    verified.capability,
    recoveryId,
  );
  assert.equal(completionReady.status, "completed", completionReady.reason);
  assert.equal(completionReady.lockReleased, true);
  const finished = completeRuntimeOwnedCoordinatorCurrentRecovery(
    verified.capability,
    recoveryId,
    () => true,
  );
  assert.equal(finished.status, "completed", finished.reason);
  assert.equal(finished.snapshotConfirmed, true);
  assert.equal(finished.lockReleased, true);
  const finishedSnapshot = readRuntimeOwnedCoordinatorRecoverySnapshot(
    verified.capability,
  );
  assert.equal(finishedSnapshot.status, "completed");
  assert.equal(finishedSnapshot.lockReleased, true);
  assert.ok(finishedSnapshot.value);
  assert.deepEqual(finishedSnapshot.value.snapshot.operations, []);
  assert.deepEqual(finishedSnapshot.value.snapshot.pendingDeliveries, []);
  assert.deepEqual(finishedSnapshot.value.snapshot.unresolvedRecoveries, []);
  const historyRows = fs
    .readFileSync(path.join(directory, "history.jsonl"), "utf8")
    .trim()
    .split("\n");
  assert.equal(historyRows.length, 1);
  const historyRow = JSON.parse(historyRows[0] ?? "null");
  assert.equal(historyRow.summary.recoveryId, recoveryId);
  assert.equal(historyRow.summary.outcome.status, "blocked");
  assert.equal(
    historyRow.summary.schema,
    "crdd-coordinator/operation-summary/v4",
  );
  assert.equal(
    observeRuntimeOwnedWorkbenchTaskCompletion(
      verified.capability,
      recoveryId,
      "task-operation-a",
    ).completionConfirmed,
    true,
  );
  assert.equal(
    observeRuntimeOwnedWorkbenchTaskCompletion(
      verified.capability,
      recoveryId,
      "another-operation",
    ).completionConfirmed,
    false,
  );
  const historyFile = path.join(directory, "history.jsonl");
  const originalHistory = fs.readFileSync(historyFile);
  for (const mutation of [
    "consumer",
    "correlation",
    "legacy",
    "duplicate",
    "missing",
    "restart_null",
    "restart_pending",
    "restart_unknown_shape",
  ] as const) {
    const row = structuredClone(historyRow);
    if (mutation === "consumer") row.summary.consumer = "coordinator_cli";
    if (mutation === "correlation") row.summary.recoveryCorrelationId = "other";
    if (mutation === "legacy") {
      row.summary.schema = "crdd-coordinator/operation-summary/v2";
      delete row.summary.consumer;
      delete row.summary.recoveryCorrelationId;
    }
    if (mutation === "restart_null") row.summary.dockerRestart = null;
    if (mutation === "restart_pending")
      row.summary.dockerRestart = {
        request: "issued",
        cleanup: "unknown",
        result: null,
      };
    if (mutation === "restart_unknown_shape")
      row.summary.dockerRestart = { unexpected: true };
    const line = `${encodeCoordinatorStateValue(row)}\n`;
    if (mutation.startsWith("restart_"))
      assert.equal(decodeCoordinatorHistoryRows(Buffer.from(line)), null);
    fs.writeFileSync(
      historyFile,
      mutation === "missing"
        ? ""
        : mutation === "duplicate"
          ? line + line
          : line,
    );
    assert.equal(
      observeRuntimeOwnedWorkbenchTaskCompletion(
        verified.capability,
        recoveryId,
        "task-operation-a",
      ).completionConfirmed,
      false,
      mutation,
    );
  }
  fs.writeFileSync(historyFile, originalHistory);
  assert.equal(
    historyRow.summary.outcome.reason,
    "docker_setup_create_subscription_auth_probe_failed",
  );
  assert.deepEqual(fs.readdirSync(directory).sort(), [
    "history.jsonl",
    "state.json",
  ]);
});

/**
 * 一次診断の追加観測を保存契約の実本文で反証する。
 * @trace ERB-IT-003
 * @precondition 合成値と実Validatorだけを使用する。
 * @stimulus 新旧正常形、欠測・過剰field・不正数値・応答相関違反。
 * @observation 実Validatorの真偽。
 * @oracle 旧形と正常形のみ受理し、不正値をゼロへ丸めない。
 * @cleanup N/A: 外部Effectなし。
 */
test("一次失敗のCommand観測は閉じた数値契約と応答相関を検査する", () => {
  const source = fs.readFileSync(
    new URL("../../src/state-storage/model.ts", import.meta.url),
    "utf8",
  );
  const extract = (name: string) => {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf("\n/**", start);
    assert.ok(start >= 0 && end > start);
    return stripTypeScriptTypes(source.slice(start, end));
  };
  const validate = runInNewContext(
    `${extract("exactRecordKeys")}\n${extract("validCoordinatorPrimaryFailure")}\nvalidCoordinatorPrimaryFailure`,
    {
      commandPurposes: ["start_provider_attached"],
      Object,
      failureStages: ["execution_classification"],
      finalReasons: new Set(["provider_process_exit_nonzero"]),
    },
  ) as (value: unknown) => boolean;
  const base = {
    purpose: "start_provider_attached",
    stage: "execution_classification",
    reason: "provider_process_exit_nonzero",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const observation = { exitCode: 1, stdoutBytes: 12, stderrBytes: 7 };
  for (const value of [
    base,
    { ...base, commandObservation: null },
    { ...base, commandObservation: observation },
    { ...base, commandObservation: { ...observation, exitCode: null } },
  ])
    assert.equal(validate(value), true);
  for (const value of [
    undefined,
    {},
    { ...observation, extra: 1 },
    { stdoutBytes: 12, stderrBytes: 7 },
    ...[-1, 0.5, Infinity, NaN, "1"].flatMap((n) => [
      { ...observation, stdoutBytes: n },
      { ...observation, stderrBytes: n },
      { ...observation, exitCode: n },
    ]),
  ])
    assert.equal(validate({ ...base, commandObservation: value }), false);
  assert.equal(
    validate({
      ...base,
      responseObserved: false,
      commandObservation: observation,
    }),
    false,
  );
});

test("上位受理Readerは保存済みの同じAttemptだけを返す", async (t) => {
  const binding = {
    workingDirectory: "fixed-repository",
    repositoryBindingId: "repo-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    recoveryId: "recovery-a",
  };
  const acknowledgement = {
    repositoryBindingId: binding.repositoryBindingId,
    projectId: binding.projectId,
    milestoneId: binding.milestoneId,
    taskId: binding.taskId,
    attemptId: binding.attemptId,
    operationId: binding.operationId,
    recoveryId: binding.recoveryId,
    settlementGeneration: 7,
    repositoryBinding: "a".repeat(64),
    resultId: "b".repeat(64),
    consumer: "orchestrator",
  };
  const state = {
    projectId: binding.projectId,
    milestoneId: binding.milestoneId,
    generation: 8,
    tasks: [
      {
        definition: { id: binding.taskId },
        attemptId: binding.attemptId,
        operationId: binding.operationId,
        state: "recovery_required",
        startPhase: "settled",
        cleanupConfirmed: true,
        recoveryUnresolved: false,
        resultAcceptances: [] as (typeof acknowledgement)[],
        recoveryObligations: [
          {
            kind: "docker",
            recoveryId: binding.recoveryId,
            phase: "acknowledged",
            acknowledgement,
          },
        ],
      },
    ],
  };
  let observation: unknown = { status: "completed", value: state };
  let shouldThrow = false;
  const calls: unknown[][] = [];
  t.mock.module("../../../orchestrator/src/storage/current-state.ts", {
    namedExports: {
      ...projectStorage,
      readCurrentOrchestratorState: (...args: unknown[]) => {
        calls.push(args);
        if (shouldThrow) throw new Error("fixture_read_failure");
        return observation;
      },
    },
  });
  const moduleUrl = new URL(
    "../../../orchestrator/src/task/settle-docker-recovery.ts?acceptance-reader-contract",
    import.meta.url,
  ).href;
  const { createProjectResultAcceptanceReader } = (await import(
    moduleUrl
  )) as typeof import("../../../orchestrator/src/task/settle-docker-recovery.ts");
  const task = state.tasks[0];
  assert.ok(task);
  const obligation = task.recoveryObligations[0];
  assert.ok(obligation);
  const reader = createProjectResultAcceptanceReader(binding);
  assert.ok(reader);
  binding.workingDirectory = "changed-after-binding";
  const accepted = reader();
  assert.deepEqual({ ...accepted }, acknowledgement);
  assert.equal(Object.isFrozen(accepted), true);
  assert.deepEqual(calls[0], ["fixed-repository", "repo-a", "project-a"]);
  state.generation = 19;
  assert.deepEqual({ ...reader() }, acknowledgement);
  assert.equal(acknowledgement.settlementGeneration, 7);
  task.resultAcceptances = [acknowledgement];
  assert.equal(reader(), null, "同じ対象を正常受領と回復ACKの両方へ置かない");
  const recoveryObligations = task.recoveryObligations;
  task.recoveryObligations = [];
  for (const terminal of ["completed", "failed", "cancelled"]) {
    task.state = terminal;
    assert.deepEqual({ ...reader() }, acknowledgement);
  }
  task.resultAcceptances = [acknowledgement, acknowledgement];
  assert.equal(reader(), null);
  task.resultAcceptances = [acknowledgement];
  task.cleanupConfirmed = false;
  assert.equal(reader(), null);
  task.cleanupConfirmed = true;
  task.recoveryUnresolved = true;
  assert.equal(reader(), null);
  task.recoveryUnresolved = false;
  task.state = "running";
  assert.equal(reader(), null);
  task.state = "recovery_required";
  task.resultAcceptances = [];
  task.recoveryObligations = recoveryObligations;
  for (const key of Object.keys(binding)) {
    const incomplete = { ...binding } as Record<string, unknown>;
    delete incomplete[key];
    assert.equal(createProjectResultAcceptanceReader(incomplete), null);
  }
  assert.equal(
    createProjectResultAcceptanceReader({ ...binding, extra: true }),
    null,
  );
  let isGetterCalled = false;
  assert.equal(
    createProjectResultAcceptanceReader({
      ...binding,
      get taskId() {
        isGetterCalled = true;
        return "task-a";
      },
    }),
    null,
  );
  assert.equal(isGetterCalled, false);
  assert.equal(
    createProjectResultAcceptanceReader(new Proxy(binding, {})),
    null,
  );
  for (const key of Object.keys(acknowledgement)) {
    const original = obligation.acknowledgement;
    const invalid = { ...acknowledgement } as Record<string, unknown>;
    delete invalid[key];
    obligation.acknowledgement = invalid as typeof acknowledgement;
    assert.equal(reader(), null);
    obligation.acknowledgement = original;
  }
  for (const [key, value] of [
    ["taskId", "another-task"],
    ["attemptId", "another-attempt"],
    ["operationId", "another-operation"],
    ["repositoryBindingId", "another-repo"],
    ["projectId", "another-project"],
    ["milestoneId", "another-milestone"],
    ["recoveryId", "another-recovery"],
    ["consumer", "workbench"],
    ["repositoryBinding", "invalid"],
    ["resultId", "invalid"],
    ["settlementGeneration", 0],
    ["settlementGeneration", 20],
    ["settlementGeneration", 1.5],
  ] as const) {
    obligation.acknowledgement = {
      ...acknowledgement,
      [key]: value,
    } as typeof acknowledgement;
    assert.equal(reader(), null);
  }
  obligation.acknowledgement = acknowledgement;
  obligation.acknowledgement = {
    repositoryBindingId: binding.repositoryBindingId,
    projectId: binding.projectId,
    milestoneId: binding.milestoneId,
    taskId: binding.taskId,
    attemptId: binding.attemptId,
    operationId: binding.operationId,
    recoveryId: binding.recoveryId,
    settlementGeneration: 7,
    runtimeStateBinding: {},
    receiptContentHash: "a".repeat(64),
    receiptContentIdentity: "b".repeat(64),
  } as unknown as typeof acknowledgement;
  assert.equal(reader(), null);
  obligation.acknowledgement = acknowledgement;
  for (const target of [state, task, task.definition, obligation]) {
    const keys =
      target === state
        ? ["projectId", "milestoneId"]
        : target === task
          ? ["operationId"]
          : target === task.definition
            ? ["id"]
            : ["kind", "recoveryId"];
    const mutable = target as unknown as Record<string, unknown>;
    for (const key of keys) {
      const original = mutable[key];
      mutable[key] = "different-binding";
      assert.equal(reader(), null);
      mutable[key] = original;
    }
  }
  task.attemptId = "different-attempt";
  assert.equal(reader(), null);
  task.attemptId = binding.attemptId;
  obligation.phase = "settled";
  assert.equal(reader(), null);
  obligation.phase = "acknowledged";
  observation = { status: "blocked", value: state };
  assert.equal(reader(), null);
  observation = { status: "completed", value: null };
  assert.equal(reader(), null);
  shouldThrow = true;
  assert.equal(reader(), null);
});

/**
 * 修復専用Contextから既存Writerへ実保存する。
 * @responsibility 偽Taskなしの初回・更新・対象外保全と拒否時Effectを確認する。
 * @trace ERB-IT-014
 * @precondition 自作Git Repositoryと実Windows Kernel排他。
 * @stimulus 修復追加・完了・次修復、偽Root・失効・元版差を与える。
 * @observation state.json本文、短命物不存在、保存確認・解放・Effect。
 * @oracle 同じRoot／対象／元版／呼出しだけ保存し、他操作を全文保全する。
 * @cleanup 自己生成Rootを境界確認後に削除し、不存在確認する。
 * @boundary ERB-IT-014=Related 2 Blocks: 修復保存Owner→実Writer・Kernel・Filesystem。
 */
test("Host Windows: 修復専用Ownerは偽Taskなしで同じ状態Writerを使う", (t) => {
  const tests = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "test_root",
  );
  const root = fs.mkdtempSync(path.join(tests.directory, "repair-state-"));
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.ok(root.startsWith(`${tests.directory}${path.sep}repair-state-`));
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
    if (fs.readdirSync(tests.directory).length === 0)
      fs.rmdirSync(tests.directory);
  });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests");
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("root unavailable");
  const repository = borrowRuntimeOwnedCoordinatorRecoveryRepository(
    verified.capability,
  );
  assert.ok(repository);
  const identity = {
    schema: "crdd-coordinator/runtime-repair-identity/v1",
    kind: "runtime_repair",
    operationNonce: "a".repeat(64),
    operationId: "OP-123456",
    repositoryBinding: repository.repositoryBinding,
    ownerBindingSha256: "b".repeat(64),
    scopeSha256: "c".repeat(64),
    consumer: "coordinator_cli",
  };
  const first = prepareCoordinatorStateRepairSnapshot(
    null,
    `${JSON.stringify(identity)}\n`,
    repository.repositoryBinding,
  );
  assert.ok(first);
  const initial = decodeCoordinatorStateSnapshot(
    first,
    repository.repositoryBinding,
  );
  assert.ok(initial);
  const recoveryId = initial.snapshot.operations[0]?.recoveryId;
  assert.ok(recoveryId);
  for (const invalidRoot of [{}, { ...verified.capability }]) {
    const rejected = writeRuntimeOwnedCoordinatorRepairSnapshot(
      invalidRoot,
      recoveryId,
      null,
      first,
      () => true,
      "checkpoint",
    );
    assert.equal(rejected.filesystemEffectIssued, false);
  }
  assert.equal(
    writeRuntimeOwnedCoordinatorRepairSnapshot(
      verified.capability,
      recoveryId,
      null,
      first,
      () => false,
      "checkpoint",
    ).filesystemEffectIssued,
    false,
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd", "coordinator")), false);
  const saved = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    null,
    first,
    () => true,
    "checkpoint",
  );
  assert.equal(saved.status, "completed");
  assert.equal(saved.snapshotConfirmed, true);
  assert.equal(saved.lockReleased, true);
  const directory = path.join(root, ".crdd", "coordinator");
  const state = path.join(directory, "state.json");
  assert.ok(fs.readFileSync(state).equals(first));
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const actionNames = [
    "stop_runtime",
    "terminate_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ];
  const technical = {
    actions: Object.fromEntries(
      actionNames.map((name) => [
        name,
        { intent: "not_saved", request: "not_issued", result: "not_required" },
      ]),
    ),
    directories: Object.fromEntries(
      ["primary", "failed", "auxiliary"].map((name) => [
        name,
        {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "absent", identity: null },
        },
      ]),
    ),
    engine: "ready",
    stale: "absent",
    hostSafety: "safe",
    cleanup: "confirmed",
    cleanupFailure: null,
  };
  let prepared = prepareCoordinatorStateRepairCheckpointSnapshot(
    first,
    recoveryId,
    {
      phase: "repairing",
      checkpoint: {
        ...technical,
        actions: Object.fromEntries(
          actionNames.map((name) => [
            name,
            {
              intent: "not_saved",
              request: "not_issued",
              result: "unobserved",
            },
          ]),
        ),
        directories: Object.fromEntries(
          ["primary", "failed", "auxiliary"].map((name) => [
            name,
            {
              expected: null,
              source: { state: "unobserved", identity: null },
              retained: { state: "unobserved", identity: null },
            },
          ]),
        ),
        engine: "unobserved",
        stale: "unknown",
        hostSafety: "unknown",
        cleanup: "not_requested",
      },
      disposition: "not_applicable",
      primaryFailure: null,
      outcome: null,
    },
    repository.repositoryBinding,
  );
  assert.ok(prepared);
  assert.equal(
    writeRuntimeOwnedCoordinatorRepairSnapshot(
      verified.capability,
      recoveryId,
      first,
      prepared,
      () => true,
      "checkpoint",
    ).status,
    "completed",
  );
  const beforeSession = decodeCoordinatorStateSnapshot(
    prepared,
    repository.repositoryBinding,
  );
  const repair = beforeSession?.snapshot.operations[0];
  assert.ok(repair?.kind === "runtime_repair" && repair.checkpoint);
  const cleanSession = prepareCoordinatorStateRepairCheckpointSnapshot(
    prepared,
    recoveryId,
    {
      phase: "repairing",
      checkpoint: { ...repair.checkpoint, cleanup: "confirmed" },
      disposition: "not_applicable",
      primaryFailure: null,
      outcome: null,
    },
    repository.repositoryBinding,
  );
  assert.ok(cleanSession);
  assert.equal(
    writeRuntimeOwnedCoordinatorRepairSnapshot(
      verified.capability,
      recoveryId,
      prepared,
      cleanSession,
      () => true,
      "checkpoint",
    ).snapshotConfirmed,
    true,
  );
  const sessionBeginning = prepareCoordinatorStateRepairSessionSnapshot(
    cleanSession,
    recoveryId,
    repository.repositoryBinding,
  );
  assert.ok(sessionBeginning);
  const refusedSession = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    cleanSession,
    sessionBeginning,
    () => true,
    "checkpoint",
  );
  assert.equal(refusedSession.filesystemEffectIssued, false);
  assert.equal(refusedSession.snapshotConfirmed, false);
  assert.ok(fs.readFileSync(state).equals(cleanSession));
  const resumed = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    cleanSession,
    sessionBeginning,
    () => true,
    "session_begin",
  );
  assert.equal(resumed.status, "completed");
  assert.equal(resumed.snapshotConfirmed, true);
  assert.equal(resumed.lockReleased, true);
  assert.ok(fs.readFileSync(state).equals(sessionBeginning));
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const repeated = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    cleanSession,
    sessionBeginning,
    () => true,
    "session_begin",
  );
  assert.equal(repeated.filesystemEffectIssued, false);
  assert.equal(repeated.snapshotConfirmed, false);
  prepared = sessionBeginning;
  let complete = prepareCoordinatorStateRepairCheckpointSnapshot(
    prepared,
    recoveryId,
    {
      phase: "settling",
      checkpoint: technical,
      disposition: "not_applicable",
      primaryFailure: null,
      outcome: {
        status: "recovered",
        reason: "runtime_repair_recovered",
        cleanupConfirmed: true,
      },
    },
    repository.repositoryBinding,
  );
  assert.ok(complete);
  const failedOwner = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    prepared,
    complete,
    () => false,
    "checkpoint",
  );
  assert.equal(failedOwner.filesystemEffectIssued, false);
  assert.ok(fs.readFileSync(state).equals(prepared));
  const completed = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    prepared,
    complete,
    () => true,
    "checkpoint",
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.lockReleased, true);
  const stale = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    recoveryId,
    first,
    complete,
    () => true,
    "checkpoint",
  );
  assert.equal(stale.status, "blocked");
  assert.equal(stale.filesystemEffectIssued, false);
  // 複数Repairの保全用fixtureだけが既存codecの配送待ち値を用いる。
  // 現在CLIの生成経路ではなく、許可辺を飛び越えない二段保存として扱う。
  const settledValue = decodeCoordinatorStateSnapshot(
    complete,
    repository.repositoryBinding,
  );
  const settledRepair = settledValue?.snapshot.operations.find(
    (item) => item.recoveryId === recoveryId,
  );
  assert.ok(settledValue && settledRepair?.kind === "runtime_repair");
  const deliveredFixture = prepareCoordinatorStateRepairCheckpointSnapshot(
    complete,
    recoveryId,
    {
      phase: "awaiting_delivery",
      checkpoint: settledRepair.checkpoint,
      disposition: settledRepair.disposition,
      primaryFailure: settledRepair.primaryFailure,
      outcome: settledRepair.outcome,
    },
    repository.repositoryBinding,
  );
  assert.ok(deliveredFixture);
  const deliveryValue = decodeCoordinatorStateSnapshot(
    deliveredFixture,
    repository.repositoryBinding,
  );
  assert.ok(deliveryValue);
  assert.equal(
    deliveryValue.snapshot.revision,
    settledValue.snapshot.revision + 1,
  );
  assert.deepEqual(deliveryValue.snapshot.previous, {
    revision: settledValue.snapshot.revision,
    payloadSha256: settledValue.payloadSha256,
  });
  assert.equal(
    writeRuntimeOwnedCoordinatorRepairSnapshot(
      verified.capability,
      recoveryId,
      complete,
      deliveredFixture,
      () => true,
      "checkpoint",
    ).status,
    "completed",
  );
  complete = deliveredFixture;
  const next = prepareCoordinatorStateRepairSnapshot(
    complete,
    `${JSON.stringify({ ...identity, operationNonce: "d".repeat(64), operationId: "OP-654321" })}\n`,
    repository.repositoryBinding,
  );
  assert.ok(next);
  const nextDecoded = decodeCoordinatorStateSnapshot(
    next,
    repository.repositoryBinding,
  );
  assert.ok(nextDecoded);
  const nextId = nextDecoded.snapshot.operations.find(
    (item) => item.recoveryId !== recoveryId,
  )?.recoveryId;
  assert.ok(nextId);
  const added = writeRuntimeOwnedCoordinatorRepairSnapshot(
    verified.capability,
    nextId,
    complete,
    next,
    () => true,
    "checkpoint",
  );
  assert.equal(added.status, "completed");
  const observed = decodeCoordinatorStateSnapshot(
    fs.readFileSync(state),
    repository.repositoryBinding,
  );
  const prior = decodeCoordinatorStateSnapshot(
    complete,
    repository.repositoryBinding,
  );
  assert.ok(observed && prior);
  assert.equal(
    encodeCoordinatorStateValue(
      observed.snapshot.operations.find(
        (item) => item.recoveryId === recoveryId,
      ),
    ),
    encodeCoordinatorStateValue(prior.snapshot.operations[0]),
  );
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const failedRoot = path.join(root, "failed-initialization");
  fs.mkdirSync(failedRoot);
  execFileSync("git", ["init", "--quiet", failedRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      failedRoot,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory(failedRoot, "tests");
  const failedVerified = verifyRepositoryRoot(failedRoot);
  assert.equal(failedVerified.status, "completed");
  if (failedVerified.status !== "completed")
    throw new Error("root unavailable");
  const failedBinding = borrowRuntimeOwnedCoordinatorRecoveryRepository(
    failedVerified.capability,
  );
  assert.ok(failedBinding);
  const failedFirst = prepareCoordinatorStateRepairSnapshot(
    null,
    `${JSON.stringify({ ...identity, repositoryBinding: failedBinding.repositoryBinding })}\n`,
    failedBinding.repositoryBinding,
  );
  assert.ok(failedFirst);
  const failedValue = decodeCoordinatorStateSnapshot(
    failedFirst,
    failedBinding.repositoryBinding,
  );
  const failedId = failedValue?.snapshot.operations[0]?.recoveryId;
  assert.ok(failedId);
  const failedDirectory = path.join(failedRoot, ".crdd", "coordinator");
  let sawCreatedArea = false;
  const lost = writeRuntimeOwnedCoordinatorRepairSnapshot(
    failedVerified.capability,
    failedId,
    null,
    failedFirst,
    () => {
      if (!fs.existsSync(failedDirectory)) return true;
      if (!sawCreatedArea) {
        sawCreatedArea = true;
        return true;
      }
      return false;
    },
    "checkpoint",
  );
  assert.equal(lost.status, "blocked");
  assert.equal(lost.reason, "coordinator_state_storage_unconfirmed");
  assert.equal(lost.snapshotConfirmed, false);
  assert.equal(lost.filesystemEffectIssued, true);
  assert.equal(lost.lockReleased, true);
  assert.equal(fs.existsSync(failedDirectory), true);
  assert.deepEqual(fs.readdirSync(failedDirectory), []);
});
