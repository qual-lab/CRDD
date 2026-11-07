/**
 * 公開Lockの実Process競合・異常終了と、固定Sourceだけの起動閉包を検証する。
 * @responsibility wxの独立Source閉包・Crash残存を分けて観測する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary 自己生成SourceコピーとNode子Process・OS排他。
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acquireLock } from "../../src/index.ts";

/** 新品Sourceコピーのwxを保持し、Owner終了後も残存で停止し、全利用者停止下の明示処置後だけ再取得する。 */
test("共通SourceコピーのwxはOwner強制終了で残存し、停止下処置後に再取得できる", {
  timeout: 20_000,
}, async () => {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const scope = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(scope, { recursive: true });
  assert.equal(fs.realpathSync.native(scope), scope);
  const root = fs.mkdtempSync(path.join(scope, "lock-copy-"));
  assert.equal(path.dirname(root), scope);
  const identity = randomBytes(32).toString("hex");
  const request = {
    directory: root,
    name: "source-copy.lock",
    identity: `source-copy:${identity}`,
  };
  let child: ChildProcess | null = null;
  try {
    fs.cpSync(
      fileURLToPath(new URL("../../src/", import.meta.url)),
      path.join(root, "src"),
      { recursive: true },
    );
    const entry = pathToFileURL(path.join(root, "src", "index.ts")).href;
    const owner = path.join(root, "owner.ts");
    fs.writeFileSync(
      owner,
      `
      import {acquireLock} from ${JSON.stringify(entry)};
      const result=acquireLock(${JSON.stringify(request)});
      if(result.status!=='acquired')process.exit(2);
      process.send('ready');
      process.on('message',()=>{});
    `,
      { flag: "wx" },
    );
    child = spawn(process.execPath, [owner], {
      shell: false,
      windowsHide: true,
      timeout: 15_000,
      env: {},
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    const close = once(child, "close");
    const ready = await Promise.race([
      once(child, "message"),
      close.then(() => {
        throw new Error("lock_owner_closed_before_ready");
      }),
    ]);
    assert.equal(ready[0], "ready");
    assert.equal(acquireLock(request).status, "blocked");
    const target = path.join(root, request.name);
    const original = fs.lstatSync(target, { bigint: true });
    const bytes = fs.readFileSync(target);
    assert.equal(JSON.parse(bytes.toString()).owner.processId, child.pid);
    assert.equal(child.kill(), true);
    await close;
    assert.equal(acquireLock(request).status, "blocked");
    const current = fs.lstatSync(target, { bigint: true });
    assert.equal(current.dev, original.dev);
    assert.equal(current.ino, original.ino);
    assert.deepEqual(fs.readFileSync(target), bytes);
    // この有限試験の子はjoin済み。未知の他利用者はいない。製品の自動Recoveryではない。
    fs.unlinkSync(target);
    const recovered = acquireLock(request);
    assert.equal(recovered.status, "acquired");
    if (recovered.status === "acquired") {
      assert.equal(recovered.lock.release(), true);
      assert.equal(recovered.lock.release(), false);
    }
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill();
      await closed;
    }
    assert.equal(path.dirname(root), scope);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  }
});
