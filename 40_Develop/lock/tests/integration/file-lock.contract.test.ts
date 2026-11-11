/**
 * wx排他を新品Repository-local領域と協調する実Node子Processで確認する。
 * @trace ERB-IT-003
 * @level IT
 * @scope wx、所有確認、単一Host、協調Process、停止下再入場
 * @boundary 非協調Processによる最終照合後の置換は保証対象外。
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import { acquireLock } from "../../src/index.ts";

test("未完了操作はdescriptorを閉じLock Fileを保全し再取得を拒否する", (t) => {
  const request = fixture(t);
  const result = acquireLock(request);
  assert.equal(result.status, "acquired");
  if (result.status !== "acquired") return;
  const target = path.join(request.directory, request.name);
  const before = fs.readFileSync(target);
  const close = fs.closeSync;
  let closes = 0;
  t.mock.method(fs, "closeSync", (fd: number) => {
    closes++;
    close(fd);
  });
  assert.equal(result.lock.release(true), true);
  assert.ok(closes >= 1);
  assert.equal(result.lock.assertLive(), false);
  assert.equal(result.lock.release(), false);
  assert.ok(fs.readFileSync(target).equals(before));
  assert.equal(acquireLock(request).status, "blocked");
});

function fixture(t: TestContext) {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(path.join(parent, "wx-lock-"));
  t.after(() => {
    assert.equal(fs.realpathSync.native(directory), directory);
    assert.equal(path.dirname(directory), parent);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  return Object.freeze({
    directory,
    name: "subject.lock",
    identity: "test:shared-resource",
  });
}

test("既存Ownerの大文字・隠し固定名を保ちPath逸脱を許さない", (t) => {
  const request = fixture(t);
  for (const name of [
    ".TOPIC-000001.lock",
    ".MTG-000001.lock",
    `${"a".repeat(128)}.lock`,
    `${"a".repeat(250)}.lock`,
    "owner-a..b.lock",
  ]) {
    const result = acquireLock({ ...request, name });
    assert.equal(result.status, "acquired");
    if (result.status === "acquired") assert.equal(result.lock.release(), true);
  }
  for (const name of [
    "../subject.lock",
    "..evil.lock",
    "child/subject.lock",
    "child\\subject.lock",
    ".lock",
    `${"a".repeat(251)}.lock`,
  ]) {
    const result = acquireLock({ ...request, name });
    assert.equal(result.status, "blocked");
    if (result.status === "blocked")
      assert.equal(result.reason, "lock_input_invalid");
  }
});

test("wxは同じ対象の二重取得を拒否し、通常解放・新世代・旧解放の一回性を守る", (t) => {
  const request = fixture(t);
  const first = acquireLock(request);
  assert.equal(first.status, "acquired");
  if (first.status !== "acquired") return;
  assert.equal(first.lock.assertLive(), true);
  assert.deepEqual(acquireLock(request), {
    status: "blocked",
    reason: "lock_exists",
    reference: null,
    cleanupConfirmed: true,
    descriptorClosed: true,
  });
  const other = acquireLock({
    ...request,
    name: "independent.lock",
    identity: "test:other-resource",
  });
  assert.equal(other.status, "acquired");
  if (other.status === "acquired") assert.equal(other.lock.release(), true);
  assert.equal(first.lock.release(), true);
  assert.equal(first.lock.assertLive(), false);
  const next = acquireLock(request);
  assert.equal(next.status, "acquired");
  if (next.status !== "acquired") return;
  assert.notEqual(
    next.lock.reference.generation,
    first.lock.reference.generation,
  );
  assert.equal(first.lock.release(), false);
  assert.equal(next.lock.assertLive(), true);
  assert.equal(next.lock.release(), true);
});

for (const change of ["identity", "owner", "generation", "file"] as const) {
  test(`通常解放は${change}の置換を観測したら削除せず失敗する`, (t) => {
    const request = fixture(t);
    const result = acquireLock(request);
    assert.equal(result.status, "acquired");
    if (result.status !== "acquired") return;
    const target = path.join(request.directory, request.name);
    if (change === "file") {
      fs.renameSync(target, path.join(request.directory, "original.lock"));
      fs.writeFileSync(target, "unknown-object", { flag: "wx" });
    } else {
      const record = JSON.parse(fs.readFileSync(target, "utf8"));
      record[change] =
        change === "owner"
          ? { processId: process.pid, processIdentity: "different-owner" }
          : "different-value";
      fs.writeFileSync(target, `${JSON.stringify(record)}\n`);
    }
    const before = fs.readFileSync(target);
    assert.equal(result.lock.assertLive(), false);
    assert.equal(result.lock.release(), false);
    assert.deepEqual(fs.readFileSync(target), before);
    assert.equal(result.lock.release(), false);
  });
}

test("未知・空・部分RecordはEEXISTとして保全し、入力境界違反も拒否する", (t) => {
  const request = fixture(t);
  const target = path.join(request.directory, request.name);
  for (const bytes of ["", "{", "unknown-record"]) {
    fs.writeFileSync(target, bytes);
    const result = acquireLock(request);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") assert.equal(result.reason, "lock_exists");
    assert.equal(fs.readFileSync(target, "utf8"), bytes);
    fs.unlinkSync(target); // この試験が作成し、利用Processがいない既知Fileだけを終了処置する。
  }
  for (const name of ["../outside.lock", "x/subject.lock", "..lock"]) {
    const result = acquireLock({ ...request, name });
    assert.equal(result.status, "blocked");
    if (result.status === "blocked")
      assert.equal(result.reason, "lock_input_invalid");
  }
});

async function owner(request: object): Promise<ChildProcess> {
  const entry = new URL("../../src/index.ts", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import {acquireLock} from ${JSON.stringify(entry)};
    const result=acquireLock(${JSON.stringify(request)});
    if(result.status!=='acquired')process.exit(2);
    process.on('message',message=>{if(message==='release'){
      const released=result.lock.release();process.send({released},()=>process.exit(released?0:3));
    }});
    process.send({status:'ready',reference:result.lock.reference});
  `,
    ],
    {
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      env: {},
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );
  child.stderr?.resume();
  const earlyClose = once(child, "close").then(() => {
    throw Error("owner_closed_before_ready");
  });
  try {
    const [message] = await Promise.race([once(child, "message"), earlyClose]);
    assert.equal(message.status, "ready");
    return child;
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill();
      await closed;
    }
    throw error;
  }
}

test("実Process間の競合・通常解放と、Crash後の残存・停止下の明示再入場", {
  timeout: 15_000,
}, async (t) => {
  let child: ChildProcess | null = null;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill();
      await closed;
    }
  });
  const request = fixture(t);
  child = await owner(request);
  const occupied = acquireLock(request);
  assert.equal(occupied.status, "blocked");
  const normalClose = once(child, "close");
  const response = once(child, "message");
  child.send("release");
  assert.equal((await response)[0].released, true);
  await normalClose;
  const next = acquireLock(request);
  assert.equal(next.status, "acquired");
  if (next.status === "acquired") assert.equal(next.lock.release(), true);

  child = await owner(request);
  const target = path.join(request.directory, request.name);
  const record = fs.readFileSync(target);
  const identity = fs.lstatSync(target, { bigint: true });
  const closed = once(child, "close");
  assert.equal(child.kill(), true);
  await closed;
  const blocked = acquireLock(request);
  assert.equal(blocked.status, "blocked");
  if (blocked.status === "blocked") assert.equal(blocked.reason, "lock_exists");
  assert.deepEqual(fs.readFileSync(target), record);
  // 有限試験の全利用者は親と終了済み子のみ。製品のPIDベース自動回復ではない。
  const current = fs.lstatSync(target, { bigint: true });
  assert.equal(current.dev, identity.dev);
  assert.equal(current.ino, identity.ino);
  assert.equal(JSON.parse(record.toString()).identity, request.identity);
  assert.deepEqual(fs.readFileSync(target), record);
  fs.unlinkSync(target);
  const recovered = acquireLock(request);
  assert.equal(recovered.status, "acquired");
  if (recovered.status === "acquired")
    assert.equal(recovered.lock.release(), true);
});

for (const stage of ["write", "sync", "release_close", "remove"] as const) {
  test(`${stage}失敗は成功にせずFileを保全し、既知descriptorを終了する`, (t) => {
    const request = fixture(t);
    const target = path.join(request.directory, request.name);
    const originalOpen = fs.openSync;
    const originalClose = fs.closeSync;
    let descriptor: number | null = null;
    const open = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof fs.openSync>) => {
        const value = originalOpen(...args);
        if (args[0] === target) descriptor = value;
        return value;
      },
    );
    let fault: { mock: { restore(): void } } | null = null;
    try {
      if (stage === "write")
        fault = t.mock.method(fs, "writeFileSync", () => {
          throw null;
        });
      if (stage === "sync")
        fault = t.mock.method(fs, "fsyncSync", () => {
          throw Error("injected");
        });
      const result = acquireLock(request);
      if (stage === "write" || stage === "sync") {
        assert.equal(result.status, "blocked");
        if (result.status === "blocked") {
          assert.equal(result.reason, "lock_initialization_failed");
          assert.equal(result.cleanupConfirmed, false);
          assert.equal(result.descriptorClosed, true);
          assert.ok(result.reference?.generation);
          assert.ok(result.reference?.fileIdentity);
        }
        assert.ok(descriptor !== null);
        const closedDescriptor = descriptor;
        assert.throws(() => fs.fstatSync(closedDescriptor));
      } else {
        assert.equal(result.status, "acquired");
        if (result.status !== "acquired") return;
        fault =
          stage === "release_close"
            ? t.mock.method(fs, "closeSync", () => {
                throw Error("injected");
              })
            : t.mock.method(fs, "rmSync", () => {
                throw Error("injected");
              });
        assert.equal(result.lock.release(), false);
        assert.equal(result.lock.release(), false);
      }
      assert.equal(fs.existsSync(target), true);
    } finally {
      fault?.mock.restore();
      open.mock.restore();
      if (stage === "release_close" && descriptor !== null)
        originalClose(descriptor);
    }
  });
}

test("親Directoryの差替えと取得後の入力変更を所有確認から隠さない", (t) => {
  const request = fixture(t);
  const directory = path.join(request.directory, "parent");
  fs.mkdirSync(directory);
  const input: { directory: string; name: string; identity: string } = {
    ...request,
    directory,
  };
  const result = acquireLock(input);
  assert.equal(result.status, "acquired");
  if (result.status !== "acquired") return;
  input.name = "different.lock";
  assert.equal(result.lock.assertLive(), true);
  try {
    fs.renameSync(directory, path.join(request.directory, "previous"));
  } catch (error) {
    // Windowsが保持中Directoryのrename自体を拒否した場合も、成立した置換とは表示しない。
    assert.equal(process.platform, "win32");
    assert.ok(
      error &&
        typeof error === "object" &&
        "code" in error &&
        ["EPERM", "EACCES"].includes(String(error.code)),
    );
    assert.equal(result.lock.assertLive(), true);
    assert.equal(result.lock.release(), true);
    return;
  }
  fs.mkdirSync(directory);
  const replacement = path.join(directory, request.name);
  fs.writeFileSync(replacement, "unknown-object", { flag: "wx" });
  assert.equal(result.lock.assertLive(), false);
  assert.equal(result.lock.release(), false);
  assert.equal(fs.readFileSync(replacement, "utf8"), "unknown-object");
});
