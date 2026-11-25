/**
 * 共通保存の短期Ownerと子Process終了を実確認する。
 * @packageDocumentation
 * @responsibility 保存先ごとの競合・Crash残存と停止下再入場をDomainへ閉じる。
 * @trace PRL-IT-005
 * @level IT
 * @scope 自己生成Repositoryと今回の子Process。
 * @boundary Domain短期排他とWindows OS。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { acquireSnapshotPilotLock } from "../../src/storage/lock.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";

/**
 * 今回Rootだけを初期化する。
 * @responsibility 本体や過去保持物を使わない試験ディレクトリを返す。
 * @trace PRL-IT-005
 * @precondition helperの検証済み試験Rootを使用する。
 * @stimulus Gitを初期化せず、今回の保存先を準備する。
 * @observation exact Root。
 * @oracle 既存Rootを再利用しない。
 * @cleanup helperが今回Rootだけを清掃する。
 * @boundary 試験準備。
 */
function fixture(t: test.TestContext) {
  const directory = createRepositoryTestDirectory("runtime-snapshot-lock-");
  t.after(directory.cleanup);
  return { root: directory.path };
}

/**
 * Repository結合した排他とProcess喪失後の再取得を実環境で確認する。
 *
 * @responsibility 同Rootの競合を拒否し、OS排他の解放を反証する。
 * @trace PRL-IT-005
 * @precondition Windows上の自己所有Repository fixtureを使用する。
 * @stimulus 独立Processが取得し、競合、別Root、通常解放と強制終了を試す。
 * @observation 取得結果、保持handleと子Processの終了を観測する。
 * @oracle 同Rootだけ拒否し、終了後に新しいhandleを取得できる。
 * @cleanup 子Processを終了確認し、全handle解放後にfixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 確定ディレクトリ→共通wx。
 */
test("Host Windows: Snapshot排他は同じ保存先で競合しCrash後の残存を拒否する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const { root } = fixture(t);
  const { root: otherRoot } = fixture(t);
  assert.equal(
    Reflect.apply(acquireSnapshotPilotLock, null, [root]).status,
    "blocked",
  );
  assert.deepEqual(fs.readdirSync(root), []);
  const ownerProbe = fileURLToPath(
    new URL("../fixtures/task-snapshot-lock-owner.ts", import.meta.url),
  );
  const child = spawn(process.execPath, [ownerProbe, root], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const [ready] = await once(child.stdout, "data", {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(String(ready), "ready");
    const contender = acquireSnapshotPilotLock({ directory: root });
    try {
      assert.equal(contender.status, "blocked");
      assert.equal(contender.reason, "coordinator_snapshot_lock_contended");
      assert.equal(contender.manualRecoveryRequired, false);
      assert.equal(contender.recoveryId, null);
    } finally {
      if (contender.status === "completed") {
        assert.equal(contender.value.release(), true);
      }
    }
    const independent = acquireSnapshotPilotLock({ directory: otherRoot });
    assert.equal(independent.status, "completed");
    if (independent.status === "completed") {
      try {
        assert.equal(independent.value.assertLive(), true);
      } finally {
        assert.equal(independent.value.release(), true);
      }
      assert.equal(independent.value.assertLive(), false);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close", {
        signal: AbortSignal.timeout(10000),
      });
      child.kill("SIGKILL");
      await closed;
    }
  }
  assert.equal(acquireSnapshotPilotLock({ directory: root }).status, "blocked");
  const lockDirectory = path.join(root, ".crdd", "lock");
  const names = fs
    .readdirSync(lockDirectory)
    .filter((name) => /^execution-model\.state\.lock$/u.test(name));
  assert.equal(names.length, 1);
  const name = names[0];
  assert.ok(name);
  const file = path.join(lockDirectory, name),
    bytes = fs.readFileSync(file);
  const record = JSON.parse(bytes.toString()),
    stat = fs.lstatSync(file, { bigint: true });
  assert.equal(record.owner.processId, child.pid);
  assert.equal(record.schema, "crdd-lock/v1");
  assert.match(record.generation, /^[a-f0-9-]{36}$/u);
  // 唯一の子はjoin済み。停止下で今回の元実体だけを明示処置する。
  const current = fs.lstatSync(file, { bigint: true });
  assert.equal(current.dev, stat.dev);
  assert.equal(current.ino, stat.ino);
  assert.deepEqual(fs.readFileSync(file), bytes);
  fs.unlinkSync(file);
  const next = acquireSnapshotPilotLock({ directory: root });
  assert.equal(next.status, "completed");
  if (next.status === "completed") assert.equal(next.value.release(), true);
  assert.equal(
    acquireSnapshotPilotLock({ directory: path.join(root, "missing") }).status,
    "blocked",
  );
});
