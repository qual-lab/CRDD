/**
 * Store Root境界と共通wx接続の正常・残存・解放不明を確認する。
 * @trace RFD-IT-021
 * @level IT
 * @scope filesystem-store-root、path-authority、wx-lock
 * @boundary 新品Repository-local Filesystem。実Process競合はlock PackageのITが所有する。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../../src/index.ts";
import {
  createFilesystemStoreRoot,
  resolveFilesystemStorePath,
} from "../../src/initialization/root.ts";
import { withFilesystemStoreLock } from "../../src/storage/lock.ts";

function fixture(t: TestContext) {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(path.join(parent, "store-wx-"));
  t.after(() => {
    assert.equal(fs.realpathSync.native(directory), directory);
    assert.equal(path.dirname(directory), parent);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  return { directory, root };
}

test("Root外・絶対Path・Link親と偽Rootを拒否する", (t) => {
  const f = fixture(t);
  assert.throws(() => resolveFilesystemStorePath(f.root, "../outside"));
  assert.throws(() => resolveFilesystemStorePath(f.root, f.directory));
  assert.throws(() =>
    resolveFilesystemStorePath({ root: f.directory } as never, "record"),
  );
  const target = path.join(f.directory, "actual");
  fs.mkdirSync(target);
  fs.symlinkSync(target, path.join(f.directory, "linked"), "junction");
  assert.equal(
    createFilesystemStoreRoot(path.join(f.directory, "linked")),
    null,
  );
  assert.throws(() => resolveFilesystemStorePath(f.root, "linked/record"));
});

test("同じRootのReaderとWriterは同じwxを取得し、通常解放後だけ再取得する", (t) => {
  const f = fixture(t);
  let refusedCalls = 0;
  const first = withFilesystemStoreLock(f.root, "store.lock", () => {
    const nested = withFilesystemStoreLock(f.root, "store.lock", () => {
      refusedCalls++;
    });
    assert.equal(nested.acquired, false);
    if (!nested.acquired)
      assert.equal(nested.reason, "filesystem_store_lock_exists");
    return 42;
  });
  assert.deepEqual(first, {
    acquired: true,
    cleanupConfirmed: true,
    value: 42,
  });
  assert.equal(refusedCalls, 0);
  assert.equal(fs.existsSync(path.join(f.directory, "store.lock")), false);
  assert.deepEqual(
    withFilesystemStoreLock(f.root, "store.lock", () => "read"),
    { acquired: true, cleanupConfirmed: true, value: "read" },
  );
});

test("操作の元例外はnullを含めて維持し、通常解放する", (t) => {
  const f = fixture(t);
  for (const error of [null, undefined, Error("primary")]) {
    let caught = false;
    try {
      withFilesystemStoreLock(f.root, "store.lock", () => {
        throw error;
      });
    } catch (actual) {
      caught = true;
      assert.equal(actual, error);
    }
    assert.equal(caught, true);
    assert.equal(fs.existsSync(path.join(f.directory, "store.lock")), false);
  }
});

test("空・不完全・旧Recordの残存は自動回復せず処理を呼ばない", (t) => {
  const f = fixture(t);
  const lock = path.join(f.directory, "store.lock");
  for (const bytes of [
    "",
    "{",
    JSON.stringify({ recoveryId: "old", ownerPid: 999999 }),
  ]) {
    fs.writeFileSync(lock, bytes);
    let calls = 0;
    const result = withFilesystemStoreLock(f.root, "store.lock", () => {
      calls++;
    });
    assert.equal(result.acquired, false);
    if (!result.acquired)
      assert.equal(result.reason, "filesystem_store_lock_exists");
    assert.equal(calls, 0);
    assert.equal(fs.readFileSync(lock, "utf8"), bytes);
    fs.unlinkSync(lock); // この有限試験には稼働Ownerがなく、自己生成の既知Fileだけを終了処置する。
  }
});

test("旧清掃義務だけが残っていても取得せず保全する", (t) => {
  const f = fixture(t);
  const marker = path.join(f.directory, "store.lock.recovery-obligation");
  fs.writeFileSync(marker, "unknown-legacy-obligation", { flag: "wx" });
  const result = withFilesystemStoreLock(f.root, "store.lock", () =>
    assert.fail("must stop"),
  );
  assert.equal(result.acquired, false);
  assert.equal(fs.existsSync(path.join(f.directory, "store.lock")), false);
  assert.equal(fs.readFileSync(marker, "utf8"), "unknown-legacy-obligation");
});

test("解放前の世代置換を保全し、成立済み結果と解放不明を分ける", (t) => {
  const f = fixture(t);
  const target = path.join(f.directory, "store.lock");
  const result = withFilesystemStoreLock(f.root, "store.lock", () => {
    const record = JSON.parse(fs.readFileSync(target, "utf8"));
    record.generation = "different-generation";
    fs.writeFileSync(target, JSON.stringify(record));
    return "published";
  });
  assert.equal(result.acquired, true);
  if (!result.acquired || result.cleanupConfirmed)
    assert.fail("cleanup must be unknown");
  assert.equal(result.operationCompleted, true);
  if (result.operationCompleted) assert.equal(result.value, "published");
  assert.match(result.recoveryId, /^filesystem-store-lock\./u);
  assert.equal(
    JSON.parse(fs.readFileSync(target, "utf8")).generation,
    "different-generation",
  );
  const again = withFilesystemStoreLock(f.root, "store.lock", () =>
    assert.fail("must stop"),
  );
  assert.equal(again.acquired, false);
});

test("元失敗を解放不明で上書きせず、PIDだけの公開回復入口を廃止する", (t) => {
  const f = fixture(t);
  const target = path.join(f.directory, "store.lock");
  const result = withFilesystemStoreLock(f.root, "store.lock", () => {
    fs.writeFileSync(target, "unknown-object");
    throw null;
  });
  assert.equal(result.acquired, true);
  if (!result.acquired || result.cleanupConfirmed)
    assert.fail("cleanup must be unknown");
  assert.equal(result.operationCompleted, false);
  if (!result.operationCompleted) assert.equal(result.error, null);
  assert.equal(fs.readFileSync(target, "utf8"), "unknown-object");
  assert.equal("observeFilesystemStoreLockOwnerAbsence" in publicApi, false);
  assert.equal("recoverFilesystemStoreLock" in publicApi, false);
});

test("UUID失敗はDirectory作成・File取得0で閉じ、未準備の親も勝手に作らない", (t) => {
  const f = fixture(t);
  const entry = new URL("../../src/initialization/root.ts", import.meta.url)
    .href;
  const lockEntry = new URL("../../src/storage/lock.ts", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import * as crypto from 'node:crypto';
    import { mock } from 'node:test';
    const sentinel=Error('uuid-fault'); let uuid=0;
    mock.module('node:crypto',{namedExports:{createHash:crypto.createHash,randomUUID:()=>{
      uuid++;if(uuid===1)return crypto.randomUUID();throw sentinel;
    }}});
    const rootApi=await import(${JSON.stringify(entry)});
    const lockApi=await import(${JSON.stringify(lockEntry)});
    const api={...rootApi,...lockApi};
    const root=api.createFilesystemStoreRoot(${JSON.stringify(f.directory)});
    let mkdir=0,wx=0,operations=0;
    const open=fs.openSync;
    fs.mkdirSync=()=>{mkdir++;throw Error('must not create');};
    fs.openSync=(...args)=>{if(String(args[1]).includes('w'))wx++;return open(...args);};
    let caught=false;
    try{api.withFilesystemStoreLock(root,'store.lock',()=>{operations++;});}
    catch(error){caught=true;assert.equal(error,sentinel);}
    assert.equal(caught,true);assert.equal(uuid,2);
    const missing=api.withFilesystemStoreLock(root,'not-created/store.lock',()=>{operations++;});
    assert.equal(missing.acquired,false);assert.equal(uuid,2);
    assert.equal(mkdir,0);assert.equal(wx,0);assert.equal(operations,0);
    process.stdout.write(JSON.stringify({uuid,mkdir,wx,operations}),()=>process.exit(0));
  `;
  const child = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--input-type=module", "-e", script],
    {
      shell: false,
      windowsHide: true,
      env: {},
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    uuid: 2,
    mkdir: 0,
    wx: 0,
    operations: 0,
  });
  assert.deepEqual(fs.readdirSync(f.directory), []);
});
