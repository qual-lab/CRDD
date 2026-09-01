import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  createDockerProcessEnvironment,
  startOwnedProcess,
  STDERR_LIMIT_BYTES,
  STDOUT_LIMIT_BYTES,
} from "../src/security/docker-owned-process.ts";
import {
  createOwnedProcessTreeFixture,
  ownedProcessWorker,
  waitForCondition,
} from "./fixtures/docker-owned-process-test-support.ts";

const windowsOnly = { skip: process.platform !== "win32", timeout: 20_000 };

function createSyntheticChild() {
  return Object.assign(new EventEmitter(), {
    pid: undefined as number | undefined,
    stdin: null as PassThrough | null,
    stdout: null as PassThrough | null,
    stderr: null as PassThrough | null,
  });
}

async function withSyntheticSpawn(
  spawnFixture: typeof childProcess.spawn,
  verify: () => Promise<void>,
) {
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = spawnFixture;
  syncBuiltinESMExports();
  try {
    await verify();
  } finally {
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
  }
}

test("固定子: stdio構築前のEMFILE/ENFILEは所有を保持しerror後closeを待つ", async () => {
  for (const code of ["EMFILE", "ENFILE"]) {
    const child = createSyntheticChild();
    await withSyntheticSpawn(
      (() => child) as unknown as typeof childProcess.spawn,
      async () => {
        const handle = startOwnedProcess("fixture", [], {}, null);
        assert.ok(child.listenerCount("error") > 0);
        assert.ok(child.listenerCount("close") > 0);
        child.emit("error", Object.assign(new Error(code), { code }));
        const result = await handle.wait(20);
        assert.equal(result?.status, null);
        assert.equal(result?.outputExceeded, false);
        assert.equal(handle.closed(), false);
        let terminationSettled = false;
        const termination = handle.terminateAndWait(100).then((confirmed) => {
          terminationSettled = true;
          return confirmed;
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(terminationSettled, false);
        child.emit("close", 0, null);
        assert.equal(await termination, true);
        assert.equal(handle.closed(), true);
        assert.equal((await handle.wait(20))?.status, null);
        assert.equal((await handle.wait(20))?.outputExceeded, false);
      },
    );
  }
});

test("固定子: close不明と同期spawn失敗を資源終了へ昇格しない", async () => {
  for (const pid of [
    undefined,
    0,
    -1,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const child = createSyntheticChild();
    child.pid = pid;
    let spawnCount = 0;
    await withSyntheticSpawn(
      (() => {
        spawnCount += 1;
        return child;
      }) as unknown as typeof childProcess.spawn,
      async () => {
        const handle = startOwnedProcess("fixture", [], {}, null);
        child.emit("error", new Error("EMFILE"));
        assert.equal(await handle.terminateAndWait(1), false);
        assert.equal(handle.closed(), false);
        assert.equal(spawnCount, 1);
        child.emit("close", null, null);
        assert.equal(await handle.terminateAndWait(1), true);
      },
    );
  }
  await withSyntheticSpawn(
    (() => {
      throw new Error("fixture_spawn_sync_failed");
    }) as typeof childProcess.spawn,
    async () => {
      assert.throws(
        () => startOwnedProcess("fixture", [], {}, null),
        /fixture_spawn_sync_failed/u,
      );
    },
  );
});

test("固定子: 入出力欠落・送信失敗・stream errorの後もcloseを所有する", async () => {
  for (const failure of [
    "stdout",
    "stderr",
    "stdin",
    "write",
    "stream_error",
  ]) {
    const child = createSyntheticChild();
    child.stdout = failure === "stdout" ? null : new PassThrough();
    child.stderr = failure === "stderr" ? null : new PassThrough();
    child.stdin = failure === "stdin" ? null : new PassThrough();
    if (failure === "write" && child.stdin)
      child.stdin.end = (() => {
        throw new Error("fixture_write_failed");
      }) as typeof child.stdin.end;
    await withSyntheticSpawn(
      (() => child) as unknown as typeof childProcess.spawn,
      async () => {
        const handle = startOwnedProcess("fixture", [], {}, "fixed");
        if (failure === "stream_error")
          child.stdout?.emit("error", new Error("fixture_stream_failed"));
        assert.equal((await handle.wait(20))?.status, null);
        assert.equal((await handle.wait(20))?.outputExceeded, false);
        assert.equal(handle.closed(), false);
        child.emit("close", 0, null);
        assert.equal(await handle.terminateAndWait(20), true);
        assert.equal((await handle.wait(20))?.status, null);
      },
    );
    child.stdin?.destroy();
    child.stdout?.destroy();
    child.stderr?.destroy();
  }
});

test("固定子: taskkill起動失敗・非0結果を元子の終了失敗と混同しない", async () => {
  for (const failure of ["throw", "error", "nonzero"]) {
    const child = createSyntheticChild();
    child.pid = 123456;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const killer = new EventEmitter();
    let spawnCount = 0;
    await withSyntheticSpawn(
      (() => {
        spawnCount += 1;
        if (spawnCount === 1) return child;
        if (failure === "throw") throw new Error("fixture_killer_failed");
        queueMicrotask(() => {
          if (failure === "error")
            killer.emit("error", new Error("fixture_killer_failed"));
          killer.emit("close", 1, null);
        });
        return killer;
      }) as unknown as typeof childProcess.spawn,
      async () => {
        const handle = startOwnedProcess("fixture", [], {}, null);
        const termination = handle.terminateAndWait(100);
        await new Promise<void>((resolve) => setImmediate(resolve));
        child.emit("close", null, "SIGTERM");
        assert.equal(await termination, true);
        assert.equal(await handle.terminateAndWait(1), true);
        assert.equal(spawnCount, 2);
      },
    );
    child.stdout.destroy();
    child.stderr.destroy();
  }
});

test("固定子: 元子がcloseしてもtaskkill補助子のclose不明を成功にしない", async () => {
  const child = createSyntheticChild();
  child.pid = 123456;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const killer = new EventEmitter();
  let spawnCount = 0;
  await withSyntheticSpawn(
    (() =>
      ++spawnCount === 1
        ? child
        : killer) as unknown as typeof childProcess.spawn,
    async () => {
      const handle = startOwnedProcess("fixture", [], {}, null);
      const termination = handle.terminateAndWait(10);
      killer.emit("error", new Error("fixture_killer_error"));
      child.emit("close", 0, null);
      assert.equal(await termination, false);
      assert.equal(handle.closed(), false);
      const second = handle.terminateAndWait(100);
      killer.emit("close", 1, null);
      assert.equal(await second, true);
      assert.equal(handle.closed(), true);
      assert.equal(spawnCount, 2);
    },
  );
  child.stdout.destroy();
  child.stderr.destroy();
});

test(
  "本番共通process: UTF-8標準入力と正常/非0終了を実観測",
  windowsOnly,
  async (t) => {
    for (const mode of ["echo", "nonzero"]) {
      const input = mode === "echo" ? "日本語\r\nfixed input\n" : null;
      const handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, mode],
        createDockerProcessEnvironment(),
        input,
      );
      t.after(async () => {
        assert.equal(await handle.terminateAndWait(5_000), true);
      });
      const result = await handle.wait(5_000);
      assert.ok(result);
      assert.equal(result.status, mode === "echo" ? 0 : 7);
      assert.equal(result.stdout, input ?? "");
      assert.equal(result.stderr, "");
      assert.equal(result.outputExceeded, false);
      assert.equal(handle.closed(), true);
    }
  },
);

test(
  "Windows Process Gate: 本番共通process: 待機期限は取消ではなく、重複取消後に実子孫とcloseを確認",
  windowsOnly,
  async (t) => {
    const fixture = createOwnedProcessTreeFixture();
    t.after(() => fixture.dispose());
    const handle = fixture.start();
    await fixture.ready();
    assert.equal(await handle.wait(10), null);
    assert.equal(handle.closed(), false);
    assert.deepEqual(
      await Promise.all([
        handle.terminateAndWait(5_000),
        handle.terminateAndWait(5_000),
      ]),
      [true, true],
    );
    fixture.assertAbsent();
    assert.equal(await handle.terminateAndWait(5_000), true);
  },
);

for (const mode of ["stdout-limit", "stderr-limit"]) {
  test(
    `Windows Process Gate: 本番共通process: ${mode}は実processを終了し出力保持を制限`,
    windowsOnly,
    async (t) => {
      const handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, mode],
        createDockerProcessEnvironment(),
        null,
      );
      t.after(async () => {
        assert.equal(await handle.terminateAndWait(5_000), true);
      });
      const result = await handle.wait(10_000);
      assert.ok(result);
      assert.equal(result.outputExceeded, true);
      assert.ok(Buffer.byteLength(result.stdout) <= STDOUT_LIMIT_BYTES);
      assert.ok(Buffer.byteLength(result.stderr) <= STDERR_LIMIT_BYTES);
      assert.equal(await handle.terminateAndWait(5_000), true);
      assert.equal(handle.closed(), true);
    },
  );
}

test(
  "本番共通process: 起動失敗はerror結果とcloseを区別して観測",
  windowsOnly,
  async (t) => {
    const handle = startOwnedProcess(
      `${ownedProcessWorker}.missing.exe`,
      [],
      createDockerProcessEnvironment(),
      null,
    );
    t.after(async () => {
      assert.equal(await handle.terminateAndWait(5_000), true);
    });
    const result = await handle.wait(5_000);
    assert.ok(result);
    assert.equal(result.status, null);
    await waitForCondition(handle.closed);
    assert.equal(handle.closed(), true);
  },
);
