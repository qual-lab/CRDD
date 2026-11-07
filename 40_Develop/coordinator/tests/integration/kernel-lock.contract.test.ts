/**
 * Home・RuntimeState・Host世代を既存Owner所在の共通wxへ接続する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary 新品Repository-local領域と実Node子Process。AI・Dockerなし。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  acquireRuntimeStateLock,
  acquireProviderHomeLock,
  acquireHostOperationLock,
} from "../../src/execution/kernel-lock.ts";
import { acquireLock } from "../../../lock/src/index.ts";

function fixture(t: TestContext) {
  const parent = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "coordinator-wx-"));
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(path.dirname(root), path.resolve(parent));
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  return root;
}

test("HomeはRepository横断で同一対象を排他し、Executorと同じRequestを使う", (t) => {
  const directory = fixture(t),
    hash = randomBytes(32).toString("hex");
  const firstAcquisition = acquireProviderHomeLock(hash, directory);
  assert.ok(firstAcquisition.status === "acquired");
  const first = firstAcquisition.lock;
  assert.ok(first);
  assert.equal(acquireProviderHomeLock(hash, directory).status, "blocked");
  assert.equal(
    acquireLock({
      directory,
      name: `provider-home.${hash}.lock`,
      identity: `provider-home:${hash}`,
    }).status,
    "blocked",
  );
  const otherAcquisition = acquireProviderHomeLock(
    randomBytes(32).toString("hex"),
    directory,
  );
  assert.ok(otherAcquisition.status === "acquired");
  const other = otherAcquisition.lock;
  assert.ok(other);
  assert.equal(other.release(), true);
  assert.equal(first.release(), true);
  const nextAcquisition = acquireProviderHomeLock(hash, directory);
  assert.ok(nextAcquisition.status === "acquired");
  const next = nextAcquisition.lock;
  assert.ok(next);
  assert.notEqual(next.reference.generation, first.reference.generation);
  assert.equal(next.release(), true);
});

test("共有RuntimeStateはRepository・Homeキーが違っても同じ所在で排他する", (t) => {
  const directory = fixture(t);
  const firstAcquisition = acquireRuntimeStateLock(
    randomBytes(32).toString("hex"),
    directory,
  );
  assert.ok(firstAcquisition.status === "acquired");
  const first = firstAcquisition.lock;
  assert.ok(first);
  assert.equal(
    acquireRuntimeStateLock(randomBytes(32).toString("hex"), directory).status,
    "blocked",
  );
  assert.equal(first.assertLive(), true);
  assert.equal(first.release(), true);
  const nextAcquisition = acquireRuntimeStateLock(
    randomBytes(32).toString("hex"),
    directory,
  );
  assert.ok(nextAcquisition.status === "acquired");
  const next = nextAcquisition.lock;
  assert.ok(next);
  assert.equal(next.release(), true);
});

test("Host世代は子Rootの外で保持し、子Root清掃後も元世代だけを解放する", (t) => {
  const parent = fixture(t),
    nonce = randomUUID();
  const root = path.join(parent, `crdd-coordinator-doctor-${nonce}`);
  fs.mkdirSync(root);
  const first = acquireHostOperationLock(root, nonce);
  assert.equal(first.status, "acquired");
  if (first.status !== "acquired") return;
  assert.equal(acquireHostOperationLock(root, nonce).status, "blocked");
  fs.rmdirSync(root);
  assert.equal(first.lock.assertLive(), true);
  assert.equal(first.lock.release(), true);
  assert.equal(first.lock.release(), false);
});

test("Host世代のCrashはFileを残し、停止下の元実体処置まで再入場しない", {
  timeout: 15000,
}, async (t) => {
  const parent = fixture(t),
    nonce = randomUUID();
  const root = path.join(parent, `crdd-coordinator-doctor-${nonce}`);
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../fixtures/kernel-lock-owner.ts", import.meta.url),
      ),
      root,
      nonce,
    ],
    {
      shell: false,
      windowsHide: true,
      env: {},
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  const closed = once(child, "close");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await closed;
    }
  });
  assert.ok(child.stdout);
  const ready = await Promise.race([
    once(child.stdout, "data"),
    closed.then(() => {
      throw new Error("owner_not_ready");
    }),
  ]);
  assert.equal(ready[0].toString(), "READY\n");
  assert.equal(acquireHostOperationLock(root, nonce).status, "blocked");
  const names = fs.readdirSync(parent);
  assert.equal(names.length, 1);
  const name = names[0];
  assert.ok(name);
  const target = path.join(parent, name);
  const bytes = fs.readFileSync(target),
    before = fs.lstatSync(target, { bigint: true });
  assert.equal(JSON.parse(bytes.toString()).owner.processId, child.pid);
  assert.equal(child.kill(), true);
  await closed;
  assert.equal(acquireHostOperationLock(root, nonce).status, "blocked");
  const current = fs.lstatSync(target, { bigint: true });
  assert.equal(current.dev, before.dev);
  assert.equal(current.ino, before.ino);
  assert.deepEqual(fs.readFileSync(target), bytes);
  // この試験の全利用者をjoinし、同じFile・世代だけを明示回収する。
  fs.unlinkSync(target);
  const next = acquireHostOperationLock(root, nonce);
  assert.equal(next.status, "acquired");
  if (next.status === "acquired") assert.equal(next.lock.release(), true);
});
