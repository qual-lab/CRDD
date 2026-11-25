/**
 * Home・Host世代を既存Owner所在の共通wxへ接続する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary 新品Repository-local領域と実Node子Process。AI・Dockerなし。
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { getRepository } from "@qual-lab/crdd-version-control";
import { acquireLock } from "@qual-lab/crdd-lock";
import {
  acquireHostOperationLock,
  acquireProviderHomeLock,
} from "../../src/lifecycle/host.ts";
import { isHostOperationRootAbsent } from "../../src/lifecycle/host.ts";

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
      name: `executor.provider-home.${hash}.lock`,
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

/** @trace ERB-IT-003 GraphごとにProcessが分かれても、同じProvider Homeは物理資源として排他する。 */
test("別Node子は同じProvider Homeを取得できず、別Homeと解放後のHomeを取得できる", (t) => {
  const directory = fixture(t);
  const home = randomBytes(32).toString("hex");
  const independent = randomBytes(32).toString("hex");
  const entry = new URL("../../src/lifecycle/host.ts", import.meta.url).href;
  const probe = (binding: string) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `import { acquireProviderHomeLock } from ${JSON.stringify(entry)};
     const [binding, directory] = process.argv.slice(1);
     const result = acquireProviderHomeLock(binding, directory);
     const released = result.status === "acquired" ? result.lock.release() : null;
     process.stdout.write(JSON.stringify({ pid: process.pid, status: result.status, reason: result.status === "blocked" ? result.reason : null, released }));`,
          binding,
          directory,
        ],
        { encoding: "utf8", timeout: 5000, windowsHide: true },
      ),
    );
  const acquired = acquireProviderHomeLock(home, directory);
  assert.ok(acquired.status === "acquired");
  const file = path.join(directory, `executor.provider-home.${home}.lock`);
  const before = fs.readFileSync(file);
  try {
    const same = probe(home);
    const other = probe(independent);
    assert.notEqual(same.pid, process.pid);
    assert.equal(same.status, "blocked");
    assert.equal(same.reason, "lock_exists");
    assert.equal(same.released, null);
    assert.equal(other.status, "acquired");
    assert.equal(other.released, true);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.deepEqual(fs.readdirSync(directory), [path.basename(file)]);
  } finally {
    assert.equal(acquired.lock.release(), true);
  }
  const next = probe(home);
  assert.equal(next.status, "acquired");
  assert.equal(next.released, true);
  assert.deepEqual(fs.readdirSync(directory), []);
});

/** 新品Git Rootに、既存LockとHost領域の親だけを用意する。 */
function hostFixture(t: TestContext) {
  const root = fixture(t);
  execFileSync("git", ["init", "--quiet", "--template=", root], {
    windowsHide: true,
  });
  const repository = getRepository(root);
  assert.equal(repository.status, "completed");
  if (repository.status !== "completed")
    throw Error("fixture_repository_unavailable");
  const lockDirectory = path.join(root, ".crdd", "lock");
  const hostDirectory = path.join(root, ".crdd", "coordinator", "OP-000001");
  fs.mkdirSync(lockDirectory, { recursive: true });
  fs.mkdirSync(path.dirname(hostDirectory), { recursive: true });
  return {
    root,
    capability: repository.capability,
    lockDirectory,
    hostDirectory,
    operationId: "OP-000001",
  };
}

test("確定済みディレクトリのHost不存在はGitを読まず、観測不能を拒否する", (t) => {
  const root = fixture(t);
  const host = path.join(root, ".crdd", "coordinator", "OP-000001");
  fs.mkdirSync(path.dirname(host), { recursive: true });
  const observe = fs.lstatSync;
  let unavailable = false;
  let gitChecks = 0;
  const calls = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof observe>) => {
      if (
        typeof args[0] === "string" &&
        path.relative(root, args[0]).split(path.sep).includes(".git")
      )
        gitChecks++;
      if (args[0] === host && unavailable)
        throw Object.assign(new Error("fixture_observation_denied"), {
          code: "EPERM",
        });
      return observe(...args);
    },
  );
  try {
    assert.equal(isHostOperationRootAbsent(root, "OP-000001"), true);
    unavailable = true;
    assert.equal(isHostOperationRootAbsent(root, "OP-000001"), false);
    assert.equal(isHostOperationRootAbsent(".", "OP-000001"), false);
    assert.equal(isHostOperationRootAbsent(root, "../OP-000001"), false);
    assert.equal(gitChecks, 0);
  } finally {
    calls.mock.restore();
  }
});

test("Host世代は子Rootの外で保持し、子Root清掃後も元世代だけを解放する", (t) => {
  const { root, capability, lockDirectory, hostDirectory, operationId } =
    hostFixture(t);
  fs.mkdirSync(hostDirectory);
  assert.equal(isHostOperationRootAbsent(root, operationId), false);
  assert.equal(
    Reflect.apply(acquireHostOperationLock, undefined, [root, operationId])
      .status,
    "blocked",
  );
  assert.equal(
    acquireHostOperationLock(capability, "invalid").status,
    "blocked",
  );
  assert.deepEqual(fs.readdirSync(lockDirectory), []);
  const first = acquireHostOperationLock(capability, operationId);
  assert.equal(first.status, "acquired");
  if (first.status !== "acquired") return;
  assert.equal(
    acquireHostOperationLock(capability, operationId).status,
    "blocked",
  );
  fs.rmdirSync(hostDirectory);
  assert.equal(isHostOperationRootAbsent(root, operationId), true);
  const hostParent = path.dirname(hostDirectory);
  fs.rmdirSync(hostParent);
  assert.equal(isHostOperationRootAbsent(root, operationId), false);
  assert.equal(fs.existsSync(hostParent), false);
  fs.writeFileSync(hostParent, "not a directory");
  assert.equal(isHostOperationRootAbsent(root, operationId), false);
  assert.equal(first.lock.assertLive(), true);
  assert.equal(first.lock.release(), true);
  assert.equal(first.lock.release(), false);
});

test("Host世代のCrashはFileを残し、停止下の元実体処置まで再入場しない", {
  timeout: 15000,
}, async (t) => {
  const { root, capability, operationId, lockDirectory } = hostFixture(t);
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../fixtures/kernel-lock-owner.ts", import.meta.url),
      ),
      root,
      operationId,
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
  assert.equal(
    acquireHostOperationLock(capability, operationId).status,
    "blocked",
  );
  const names = fs.readdirSync(lockDirectory);
  assert.equal(names.length, 1);
  const name = names[0];
  assert.ok(name);
  assert.equal(name, `coordinator.host-operation.${operationId}.lock`);
  const target = path.join(lockDirectory, name);
  const bytes = fs.readFileSync(target),
    before = fs.lstatSync(target, { bigint: true });
  assert.equal(JSON.parse(bytes.toString()).owner.processId, child.pid);
  assert.equal(child.kill(), true);
  await closed;
  assert.equal(
    acquireHostOperationLock(capability, operationId).status,
    "blocked",
  );
  const current = fs.lstatSync(target, { bigint: true });
  assert.equal(current.dev, before.dev);
  assert.equal(current.ino, before.ino);
  assert.deepEqual(fs.readFileSync(target), bytes);
  // この試験の全利用者をjoinし、同じFile・世代だけを明示回収する。
  fs.unlinkSync(target);
  const next = acquireHostOperationLock(capability, operationId);
  assert.equal(next.status, "acquired");
  if (next.status === "acquired") assert.equal(next.lock.release(), true);
});
