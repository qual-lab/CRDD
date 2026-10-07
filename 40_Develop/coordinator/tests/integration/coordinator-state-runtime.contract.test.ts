/**
 * Coordinator最新現在状態の実Filesystem保存を自己生成Repositoryで確認する。
 * @responsibility 固定配置、pending再入場、拒否時の保全とOwner失効を検証する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary ERB-IT-003=Direct Boundary: 現在状態Writer→Repository-local Filesystem。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  coordinatorStateContentHash,
  encodeCoordinatorStateValue,
} from "../../src/security/coordinator-state-model.ts";
import {
  prepareRuntimeOwnedCoordinatorStateInitialization,
  writeRuntimeOwnedCoordinatorStateSnapshot,
} from "../../src/security/coordinator-state-runtime.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../../src/security/execution-environment.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedCoordinatorStateRepository,
} from "../../src/security/repository-operation-runtime.ts";

/**
 * 固定二File保存と同じ更新の再入場、保全停止を確認する。
 * @responsibility 自己生成Repositoryで実保存と拒否境界を観測する。
 * @trace ERB-IT-003
 * @precondition Windowsの実効排他とRepository内試験領域だけを使う。
 * @stimulus 初回・次版・pending再入場、不一致・hardlink・Owner失効を処置する。
 * @observation 本文、pendingとlock不存在、拒否結果と元状態の保持。
 * @oracle 同じ更新だけ成功し、別pendingや不正入力を上書きしない。
 * @cleanup 所有操作を閉じ、自己生成した子Repositoryだけを削除する。
 * @boundary ERB-IT-003=Direct Boundary: Writer→実FilesystemとOS排他。
 */
test("Host Windows: Coordinator現在状態の保存とpending再入場", (t) => {
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
  let cleaned = false;
  t.after(() => {
    if (owned && !cleaned) cleanupOwnedOperationDirectories(owned);
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
  assert.ok(bindRuntimeOwnedRepositoryOperation(management, root));
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(repository);
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
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    firstBytes,
  );
  // 公開後に消えた現在状態を初回の空領域として再作成しない。
  fs.unlinkSync(path.join(area.directory, "state.json"));
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
  let replaced = false;
  fs.fsyncSync = (fd) => {
    originalFsync(fd);
    if (!replaced) {
      replaced = true;
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
    writeRuntimeOwnedCoordinatorStateSnapshot(management, secondBytes)
      .filesystemEffectIssued,
    false,
  );
  fs.unlinkSync(hardlink);
  cleanupOwnedOperationDirectories(owned);
  cleaned = true;
  assert.equal(
    writeRuntimeOwnedCoordinatorStateSnapshot(management, secondBytes)
      .filesystemEffectIssued,
    false,
  );
});
