/**
 * CurrentStateのwx排他・通常解放・Crash残存と停止下再入場を確認する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary 新品Repository-local領域と実Node子Process。AI・Dockerは使用しない。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { acquireCoordinatorStorageOwnerForRepository } from "../../src/storage/runtime-lock.ts";
import { acquireRuntimeStateLock } from "../../src/storage/runtime-kernel-lock.ts";

function fixture(t: TestContext) {
  const parent = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "current-state-wx-"));
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(path.dirname(root), path.resolve(parent));
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  return { root, hash: randomBytes(32).toString("hex") };
}

test("同じCurrentStateだけが競合し、通常解放後は新世代で取得する", (t) => {
  const { root, hash } = fixture(t);
  for (const value of [null, {}, "", "A".repeat(64), "a".repeat(63)]) {
    assert.equal(acquireRuntimeStateLock(value, root).status, "blocked");
  }
  const first = acquireRuntimeStateLock(hash, root);
  assert.ok(first.status === "acquired");
  assert.equal(acquireRuntimeStateLock(hash, root).status, "blocked");
  const other = acquireRuntimeStateLock(randomBytes(32).toString("hex"), root);
  assert.ok(other.status === "acquired");
  assert.equal(other.lock.release(), true);
  assert.equal(first.lock.assertLive(), true);
  assert.equal(first.lock.release(), true);
  assert.equal(first.lock.release(), false);
  const next = acquireRuntimeStateLock(hash, root);
  assert.ok(next.status === "acquired");
  assert.notEqual(
    next.lock.reference.generation,
    first.lock.reference.generation,
  );
  assert.equal(next.lock.release(), true);
});

test("CurrentState Owner強制終了後も残存で拒否し、停止下のexact処置後だけ再入場する", {
  timeout: 15000,
}, async (t) => {
  const { root, hash } = fixture(t);
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../fixtures/runtime-kernel-owner.ts", import.meta.url),
      ),
      hash,
      root,
    ],
    {
      shell: false,
      windowsHide: true,
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = once(child, "close");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await closed;
    }
  });
  const ready = await Promise.race([
    once(child.stdout, "data"),
    closed.then(() => {
      throw new Error("owner_not_ready");
    }),
  ]);
  assert.equal(ready[0].toString(), "READY\n");
  assert.equal(acquireRuntimeStateLock(hash, root).status, "blocked");
  const target = path.join(root, ".crdd", `current-state.${hash}.lock`);
  const bytes = fs.readFileSync(target);
  const stat = fs.lstatSync(target, { bigint: true });
  const record = JSON.parse(bytes.toString());
  assert.equal(record.owner.processId, child.pid);
  assert.equal(record.identity, `current-state:${hash}`);
  assert.equal(child.kill(), true);
  await closed;
  assert.equal(acquireRuntimeStateLock(hash, root).status, "blocked");
  const current = fs.lstatSync(target, { bigint: true });
  assert.equal(current.dev, stat.dev);
  assert.equal(current.ino, stat.ino);
  assert.deepEqual(fs.readFileSync(target), bytes);
  // 唯一の子はjoin済み。この試験の全利用者停止下で元世代だけを回収する。
  fs.unlinkSync(target);
  const next = acquireRuntimeStateLock(hash, root);
  assert.ok(next.status === "acquired");
  assert.notEqual(next.lock.reference.generation, record.generation);
  assert.equal(next.lock.release(), true);
});

/**
 * 新規Lock初期化故障を保存Ownerの停止結果まで搬送する。
 * @trace ERB-IT-003
 * @boundary 今回のRootだけ。書込み・同期・closeを有限故障にし、元fdは試験でjoinする。
 */
test("CurrentStateの初期化失敗は取得参照・手動回復とdescriptor終了不明を失わない", async (t) => {
  for (const fault of ["write", "sync", "close"] as const)
    await t.test(fault, (st) => {
      const { root, hash } = fixture(st);
      const open = fs.openSync,
        close = fs.closeSync;
      let descriptor: number | null = null;
      st.mock.method(
        fs,
        "openSync",
        (...args: Parameters<typeof fs.openSync>) => {
          const fd = open(...args);
          if (String(args[1]) === "wx") descriptor = fd;
          return fd;
        },
      );
      if (fault === "write" || fault === "close")
        st.mock.method(fs, "writeFileSync", () => {
          throw Error("finite_write");
        });
      else
        st.mock.method(fs, "fsyncSync", () => {
          throw Error("finite_sync");
        });
      if (fault === "close")
        st.mock.method(fs, "closeSync", () => {
          throw Error("finite_close");
        });
      const outcome = acquireCoordinatorStorageOwnerForRepository({
        repositoryRoot: root,
        repositoryBinding: hash,
        revalidate: () => true,
      });
      assert.equal(outcome.status, "blocked");
      assert.ok(outcome.status === "blocked");
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.match(
        outcome.recoveryId ?? "",
        /^current-state-lock\.[a-f0-9-]{36}$/u,
      );
      assert.equal(
        outcome.reason,
        fault === "close"
          ? "coordinator_state_lock_descriptor_close_unconfirmed"
          : "coordinator_state_lock_initialization_failed",
      );
      assert.equal(JSON.stringify(outcome).includes(root), false);
      st.mock.restoreAll();
      const file = path.join(root, ".crdd", `current-state.${hash}.lock`);
      assert.equal(fs.existsSync(file), true);
      assert.equal(acquireRuntimeStateLock(hash, root).status, "blocked");
      assert.notEqual(descriptor, null);
      const fd = descriptor;
      assert.ok(typeof fd === "number");
      if (fault === "close") close(fd);
      assert.throws(() => fs.fstatSync(fd), { code: "EBADF" });
      // 呼出し完了・元descriptor終了後、今回の未知／部分Recordを試験だけで明示回収する。
      fs.unlinkSync(file);
    });
});
