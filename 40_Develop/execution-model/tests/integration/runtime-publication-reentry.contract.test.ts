/**
 * markerに依存しない保存再入場と同じOwnerの借用を確認する。
 * @responsibility current/pending/historyの拒否・保全と排他解放を検証する。
 * @trace ERB-IT-014
 * @trace PRL-IT-011
 * @level IT
 * @scope 自己生成Repositoryと固定保存primitive。
 * @boundary 保存Reader・共通Lockと実Filesystem。実AI・Dockerは使用しない。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Lock } from "../../../lock/src/index.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import * as model from "../../src/index.ts";
import { readState } from "../../src/index.ts";
import {
  decodeStateSnapshot,
  EXECUTION_STATE_SCHEMA,
} from "../../src/state/validation.ts";
import { encodeStateValue } from "../../src/state/operations.ts";
import {
  acquireExecutionStateLock,
  acquireStorageOwner,
  observeExecutionRecoveryRepository,
} from "../../src/storage/lock.ts";
import {
  createExecutionStatePendingFile,
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  readExecutionStateFile,
  readStorageSnapshotOwned,
  requireReadyRepositoryExecutionDataArea,
  sameStableFileIdentity,
} from "../../src/storage/store.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";

/**
 * 廃止名は固定primitiveでもEffect前に拒否する。
 * @trace ERB-IT-014
 * @precondition 未信頼名だけを渡す。
 * @stimulus 旧marker名・未知名を読取り/作成へ渡す。
 * @observation Boundary callback/Effect callback回数。
 * @oracle File I/O前に拒否し旧公開入口も存在しない。
 * @cleanup N/A: 外部Effectなし。
 * @boundary 固定保存名の受付。
 */
test("保存再入場: 旧marker名と未知名はEffect前に拒否する", () => {
  assert.equal(Object.hasOwn(model, "completeStatePublication"), false);
  for (const name of ["state.lock", "unknown.json", "../state.json"]) {
    let effects = 0,
      boundaries = 0;
    const identities = new Map();
    assert.throws(() =>
      readExecutionStateFile(
        path.resolve("."),
        name as never,
        identities,
        () => {
          boundaries++;
        },
      ),
    );
    assert.throws(() =>
      createExecutionStatePendingFile(
        path.resolve("."),
        name as never,
        Buffer.from("x"),
        identities,
        () => {
          boundaries++;
        },
        () => {
          effects++;
        },
      ),
    );
    assert.equal(effects, 0);
    assert.equal(boundaries, 0);
  }
});

/**
 * 新品の同じ保存基準に観点差分だけを加えて拒否/保全を確認する。
 * @trace ERB-IT-014
 * @trace PRL-IT-011
 * @precondition 自己生成Git Repositoryの正常Stateを一度作る。
 * @stimulus 旧marker/pending/未知/不正履歴・File型・link・hardlink・観測不能・排他競合、Owner偽造/コピー/解放済み。
 * @observation status、本文とFile Identity、Lock競合と借用/解放結果。
 * @oracle 不明は拒否し保存物を変更/削除せず、復元後に正常読取りする。
 * @cleanup 今回のRootとLockだけをfinallyで回収する。
 * @boundary 実Filesystem・共通Lockと保存Reader。
 */
test("Host Windows: markerなしの読取り・残存保全と同Owner借用", {
  skip: process.platform !== "win32",
}, () => {
  const ownedDirectory = createRepositoryTestDirectory("current-marker-tests-");
  const area = { directory: ownedDirectory.path };
  const root = fs.mkdtempSync(path.join(area.directory, "current-marker-"));
  let held: Lock | null = null;
  try {
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
    const verified = getRepository(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const repository = observeExecutionRecoveryRepository(verified.capability);
    assert.ok(repository);
    const storage = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        root,
        "domain-model",
      ),
      "marker_storage",
    );
    const state = path.join(storage.directory, "state.json"),
      pending = path.join(storage.directory, "state.pending.json");
    const bytes = Buffer.from(
      `${encodeStateValue({ schema: EXECUTION_STATE_SCHEMA, revision: 1, repositoryBindingId: null, intakeEpoch: null, intakeBindings: [], projects: [], managedExecutions: [], workspaces: [], queueEntries: [], leaseEvidence: [], leaseIntents: [], results: [], historyPending: [], decisions: [], blockers: [], previous: null, repositoryBinding: repository.repositoryBinding, operations: [], unresolvedRecoveries: [] })}\n`,
    );
    fs.writeFileSync(state, bytes, { flag: "wx" });
    const before = fs.lstatSync(state, { bigint: true });
    const observe = () =>
      readState(verified.capability, {
        scope: "recovery",
        input: { kind: "history" },
      });
    assert.equal(observe().status, "completed");
    for (const [name, value] of [
      ["state.lock", "legacy"],
      ["state.pending.json", bytes],
      ["unknown.json", "unknown"],
      ["history.jsonl", "invalid"],
    ] as const) {
      const file = path.join(storage.directory, name);
      fs.writeFileSync(file, value, { flag: "wx" });
      const original = fs.readFileSync(file);
      assert.equal(observe().status, "blocked", name);
      assert.deepEqual(fs.readFileSync(file), original, name);
      assert.deepEqual(fs.readFileSync(state), bytes, name);
      fs.unlinkSync(file);
      assert.equal(observe().status, "completed", name);
    }
    fs.mkdirSync(pending);
    assert.equal(observe().status, "blocked");
    fs.rmdirSync(pending);
    const alias = path.join(root, "original-state");
    fs.renameSync(state, alias);
    try {
      fs.symlinkSync(alias, state, "file");
      assert.equal(observe().status, "blocked");
    } finally {
      if (fs.existsSync(state)) fs.unlinkSync(state);
      fs.renameSync(alias, state);
    }
    fs.linkSync(state, alias);
    try {
      assert.equal(observe().status, "blocked");
      assert.deepEqual(fs.readFileSync(alias), bytes);
    } finally {
      fs.unlinkSync(alias);
    }
    // Link故障の構築/復元でctimeは変わる。Readerによる変更は復元後の同実体と比較する。
    assert.equal(fs.lstatSync(state, { bigint: true }).ino, before.ino);
    const restored = fs.lstatSync(state, { bigint: true });
    const lstat = fs.lstatSync;
    try {
      Reflect.set(fs, "lstatSync", ((file: fs.PathLike, ...args: unknown[]) => {
        if (String(file) === state)
          throw Object.assign(new Error("fixture"), { code: "EACCES" });
        return Reflect.apply(lstat, fs, [file, ...args]);
      }) as typeof fs.lstatSync);
      assert.equal(observe().status, "blocked");
    } finally {
      Reflect.set(fs, "lstatSync", lstat);
    }
    const acquired = acquireExecutionStateLock(
      repository.repositoryBinding,
      root,
    );
    assert.ok(acquired.status === "acquired");
    held = acquired.lock;
    assert.equal(observe().status, "blocked");
    assert.equal(held.release(), true);
    held = null;
    assert.equal(observe().status, "completed");
    assert.deepEqual(fs.readFileSync(state), bytes);
    assert.equal(
      sameStableFileIdentity(restored, fs.lstatSync(state, { bigint: true })),
      true,
    );
    assert.deepEqual(fs.readdirSync(storage.directory), ["state.json"]);
    const ownerAcquisition = acquireStorageOwner(root);
    assert.ok(ownerAcquisition.status === "completed");
    const owner = ownerAcquisition.value;
    try {
      assert.equal(owner.assertLive(), true);
      for (let read = 0; read < 2; read++) {
        const observed = readStorageSnapshotOwned(owner);
        assert.equal(observed.status, "completed");
        assert.equal(observed.lockReleased, false);
        assert.ok("ownerHeld" in observed && observed.ownerHeld);
        assert.equal(
          observed.value?.payloadSha256,
          decodeStateSnapshot(bytes, repository.repositoryBinding)
            ?.payloadSha256,
        );
      }
      assert.equal(acquireStorageOwner(root).status, "blocked");
      let invoked = false;
      const fake = new Proxy(
        {},
        {
          get() {
            invoked = true;
            throw new Error("untrusted owner");
          },
        },
      );
      assert.equal(readStorageSnapshotOwned(fake).status, "blocked");
      assert.equal(readStorageSnapshotOwned({ ...owner }).status, "blocked");
      assert.equal(invoked, false);
      assert.equal(owner.assertLive(), true);
    } finally {
      assert.equal(owner.release(), true);
    }
    assert.equal(owner.assertLive(), false);
    assert.equal(owner.release(), false);
    assert.equal(readStorageSnapshotOwned(owner).status, "blocked");
    const nextOwnerAcquisition = acquireStorageOwner(root);
    assert.ok(nextOwnerAcquisition.status === "completed");
    const nextOwner = nextOwnerAcquisition.value;
    assert.equal(nextOwner.release(), true);
    assert.deepEqual(fs.readFileSync(state), bytes);
  } finally {
    if (held) assert.equal(held.release(), true);
    assert.equal(path.dirname(root), area.directory);
    fs.rmSync(root, { recursive: true });
    assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
    ownedDirectory.cleanup();
  }
});
