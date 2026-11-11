/** 新9操作の実Filesystem保存・不明・競合・回収を確認する。 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  createExecution,
  completeExecution,
  getExecution,
  listExecutions,
  type ExecutionCreateInput,
} from "../../src/index.ts";
import { fixture, completion, startedAt } from "../fixtures/store.ts";

test("開始・終了は同じIDへ一度だけ保存し、同一再送だけを受理する", (t) => {
  const s = fixture(t),
    input = { executionId: "e", startedAt };
  assert.equal(createExecution(s, input).status, "completed");
  assert.equal(createExecution(s, input).reason, "record_already_created");
  assert.equal(
    createExecution(s, { ...input, application: "different" }).reason,
    "record_identity_conflict",
  );
  assert.equal(completeExecution(s, "e", completion()).status, "completed");
  assert.equal(
    completeExecution(s, "e", completion()).reason,
    "record_already_completed",
  );
  assert.equal(createExecution(s, input).reason, "record_already_created");
  assert.equal(
    completeExecution(s, "e", completion({ outcome: { status: "failed" } }))
      .reason,
    "record_completion_conflict",
  );
  const r = getExecution(s, "e");
  assert.equal(r.status, "completed");
  if (r.status === "completed")
    assert.equal(r.value?.completion?.outcome.status, "completed");
  assert.deepEqual(fs.readdirSync(s.directory), ["history.jsonl"]);
});
test("開始のない終了・未知field・逆行時間はEffect前に拒否", (t) => {
  const s = fixture(t);
  assert.equal(
    completeExecution(s, "none", completion()).reason,
    "record_not_found",
  );
  assert.equal(
    createExecution(s, {
      executionId: "e",
      startedAt,
      state: "closed",
    } as ExecutionCreateInput).status,
    "blocked",
  );
  assert.equal(
    createExecution(s, { executionId: "e", startedAt }).status,
    "completed",
  );
  assert.equal(
    completeExecution(s, "e", completion({ endedAt: "2025-01-01T00:00:00Z" }))
      .reason,
    "record_time_reversed",
  );
});
for (const contents of [
  '{"contract":"crdd/execution-intelligence-event/v2"}\n',
  '{"contract":"execution-intelligence/history/v3"}\n{"contract":"old"}\n',
  "{broken}\n",
  "{}",
  "\n",
]) {
  test("旧形式・混在・破損・不完全行を読み飛ばさずbytesを保全", (t) => {
    const s = fixture(t),
      history = path.join(s.directory, "history.jsonl");
    fs.writeFileSync(history, contents);
    assert.equal(
      createExecution(s, { executionId: "e", startedAt }).status,
      "blocked",
    );
    assert.equal(listExecutions(s).status, "blocked");
    assert.equal(fs.readFileSync(history, "utf8"), contents);
    assert.deepEqual(fs.readdirSync(s.directory), ["history.jsonl"]);
  });
}
for (const residual of [
  "history.lock",
  "history.pending.jsonl",
  "unknown.json",
]) {
  test(`未所有残存${residual}を削除・奪取しない`, (t) => {
    const s = fixture(t);
    fs.writeFileSync(path.join(s.directory, residual), "owned elsewhere");
    const r = createExecution(s, { executionId: "e", startedAt });
    assert.equal(r.status, "blocked");
    assert.equal(
      fs.readFileSync(path.join(s.directory, residual), "utf8"),
      "owned elsewhere",
    );
    assert.deepEqual(fs.readdirSync(s.directory), [residual]);
  });
}
for (const fault of [
  "write",
  "fsync",
  "rename",
  "afterRename",
  "release",
] as const) {
  test(`保存故障${fault}のEffect段階と回収結果を保持`, (t) => {
    const s = fixture(t);
    const originalWrite = fs.writeFileSync,
      originalSync = fs.fsyncSync,
      originalRename = fs.renameSync,
      originalRead = fs.readFileSync,
      originalUnlink = fs.unlinkSync,
      originalRm = fs.rmSync,
      originalOpen = fs.openSync;
    let pendingFd: number | null = null;
    let faultObserved = false;
    t.after(() => {
      fs.writeFileSync = originalWrite;
      fs.fsyncSync = originalSync;
      fs.renameSync = originalRename;
      fs.readFileSync = originalRead;
      fs.unlinkSync = originalUnlink;
      fs.rmSync = originalRm;
      fs.openSync = originalOpen;
    });
    fs.openSync = ((file, ...args) => {
      if (
        fault === "afterRename" &&
        typeof file === "string" &&
        file.endsWith("history.jsonl")
      ) {
        faultObserved = true;
        throw Error("injected_read");
      }
      const fd = Reflect.apply(originalOpen, fs, [file, ...args]);
      if (String(file).endsWith("history.pending.jsonl") && args[0] === "wx")
        pendingFd = fd;
      return fd;
    }) as typeof fs.openSync;
    if (fault === "write")
      fs.writeFileSync = ((target, ...args) => {
        if (target === pendingFd) {
          faultObserved = true;
          throw Error("injected_write");
        }
        return Reflect.apply(originalWrite, fs, [target, ...args]);
      }) as typeof fs.writeFileSync;
    if (fault === "fsync")
      fs.fsyncSync = (fd) => {
        if (fd === pendingFd) {
          faultObserved = true;
          throw Error("injected_fsync");
        }
        return originalSync(fd);
      };
    if (fault === "rename")
      fs.renameSync = () => {
        faultObserved = true;
        throw Error("injected_rename");
      };
    if (fault === "release")
      fs.rmSync = (file, options) => {
        if (String(file).endsWith("history.lock")) {
          faultObserved = true;
          throw Error("injected_release");
        }
        return originalRm(file, options);
      };
    const r = createExecution(s, { executionId: "e", startedAt });
    assert.equal(faultObserved, true);
    assert.equal(r.status, "blocked");
    assert.equal(r.recordId, "e");
    if (fault === "rename" || fault === "afterRename") {
      assert.equal(r.effectState, "unknown");
      assert.equal(r.recoveryReference, "e");
    }
    if (fault === "release") {
      assert.equal(r.cleanupConfirmed, false);
      assert.equal(r.effectState, "settled");
      assert.equal(r.recoveryReference, "e");
    }
  });
}
test("Directory不存在と観測不能を正常空履歴へ変換しない", (t) => {
  const s = fixture(t);
  assert.equal(
    listExecutions({ ...s, directory: path.join(s.directory, "missing") })
      .status,
    "blocked",
  );
  assert.equal(listExecutions({ ...s, retentionDays: 0 }).status, "blocked");
});
for (const replaced of ["directory", "pending"] as const) {
  test(`出版前の${replaced}置換では別実体を後始末で削除しない`, (t) => {
    const s = fixture(t),
      originalOpen = fs.openSync,
      originalClose = fs.closeSync,
      originalLstat = fs.lstatSync;
    let pendingFd: number | null = null,
      injected = false;
    fs.openSync = ((file, ...args) => {
      const fd = Reflect.apply(originalOpen, fs, [file, ...args]);
      if (String(file).endsWith("history.pending.jsonl") && args[0] === "wx")
        pendingFd = fd;
      return fd;
    }) as typeof fs.openSync;
    fs.closeSync = (fd) => {
      originalClose(fd);
      if (fd !== pendingFd || injected) return;
      injected = true;
      fs.renameSync(
        path.join(s.directory, "history.pending.jsonl"),
        path.join(s.directory, "original-pending"),
      );
      fs.writeFileSync(
        path.join(s.directory, "history.pending.jsonl"),
        "foreign-pending",
      );
      // WindowsではLockがDirectory移動自体を拒否するため、Root差替えの観測だけを注入する。
      if (replaced === "directory")
        Object.defineProperty(fs, "lstatSync", {
          value: (file: fs.PathLike, options?: fs.StatSyncOptions) => {
            const observed = originalLstat(file, options);
            if (!observed) throw Error("fixture_observation_missing");
            if (String(file) === s.directory)
              return Object.assign(Object.create(observed), {
                ino:
                  typeof observed.ino === "bigint"
                    ? observed.ino + 1n
                    : observed.ino + 1,
              });
            return observed;
          },
        });
    };
    t.after(() => {
      fs.openSync = originalOpen;
      fs.closeSync = originalClose;
      Object.defineProperty(fs, "lstatSync", { value: originalLstat });
    });
    const result = createExecution(s, { executionId: "e", startedAt });
    assert.equal(injected, true);
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.recoveryReference, "e");
    assert.equal(
      fs.readFileSync(path.join(s.directory, "history.pending.jsonl"), "utf8"),
      "foreign-pending",
    );
  });
}
test("open後のFile増大を本文読取り前に拒否する", (t) => {
  const s = fixture(t);
  createExecution(s, { executionId: "e", startedAt });
  const originalOpen = fs.openSync,
    originalStat = fs.fstatSync,
    originalRead = fs.readSync;
  let historyFd: number | null = null,
    reads = 0;
  fs.openSync = ((file, ...args) => {
    const fd = Reflect.apply(originalOpen, fs, [file, ...args]);
    if (String(file).endsWith("history.jsonl")) historyFd = fd;
    return fd;
  }) as typeof fs.openSync;
  fs.fstatSync = ((fd, options) => {
    const s = originalStat(fd, options);
    return fd === historyFd
      ? Object.assign(Object.create(s), { size: 33n * 1024n * 1024n })
      : s;
  }) as typeof fs.fstatSync;
  fs.readSync = ((fd, ...args) => {
    if (fd === historyFd) reads++;
    return Reflect.apply(originalRead, fs, [fd, ...args]);
  }) as typeof fs.readSync;
  t.after(() => {
    fs.openSync = originalOpen;
    fs.fstatSync = originalStat;
    fs.readSync = originalRead;
  });
  assert.equal(listExecutions(s).status, "blocked");
  assert.equal(reads, 0);
});
test("正規Writerの複数Processは一件だけを出版し競合内容を上書きしない", async (t) => {
  const s = fixture(t),
    script = fileURLToPath(
      new URL(
        "../fixtures/execution-intelligence-store-writer.ts",
        import.meta.url,
      ),
    );
  const outcomes = await Promise.all(
    ["app", "app", "different"].map(
      (application) =>
        new Promise<{ status: string; reason: string }>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [script, s.directory, application],
            { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
          );
          let output = "",
            expired = false;
          const timer = setTimeout(() => {
            expired = true;
            child.kill();
          }, 15000);
          child.stdout.on("data", (b) => {
            if (output.length < 8192) output += String(b);
          });
          child.once("error", reject);
          child.once("close", (code) => {
            clearTimeout(timer);
            if (expired || code !== 0) reject(Error("fixture_child_failed"));
            else {
              try {
                resolve(JSON.parse(output));
              } catch {
                reject(Error("fixture_child_output_invalid"));
              }
            }
          });
        }),
    ),
  );
  assert.ok(outcomes.some((r) => r.status === "completed"));
  for (const outcome of outcomes)
    assert.ok(
      outcome.status === "completed" ||
        [
          "lock_exists",
          "store_publication_pending",
          "record_identity_conflict",
        ].includes(outcome.reason),
    );
  const r = listExecutions(s);
  assert.equal(r.status, "completed");
  if (r.status === "completed") assert.equal(r.value.total, 1);
});
test("WriterのCrash残存は自動回収せず再入場を拒否する", async (t) => {
  const s = fixture(t),
    script = fileURLToPath(
      new URL(
        "../fixtures/execution-intelligence-store-writer.ts",
        import.meta.url,
      ),
    );
  const child = spawn(process.execPath, [script, s.directory, "hold"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => child.kill(), 15000);
    child.stdout.once("data", (b) => {
      ready = String(b).trim() === "ready";
      child.kill();
    });
    child.once("error", reject);
    child.once("close", () => {
      clearTimeout(timer);
      ready ? resolve() : reject(Error("fixture_child_not_ready"));
    });
  });
  const before = fs.readFileSync(path.join(s.directory, "history.lock"));
  assert.equal(
    createExecution(s, { executionId: "after-crash", startedAt }).status,
    "blocked",
  );
  assert.deepEqual(
    fs.readFileSync(path.join(s.directory, "history.lock")),
    before,
  );
});
