/**
 * 実Filesystemで記録遷移・保存不明・競合・今回資源の回収を反証する。
 * @packageDocumentation
 * @responsibility 旧形式保全、段階別故障、元実体照合、複数ProcessとCrash残存を検証する。
 * @trace ERP-IT-001
 * @trace ERP-IT-002
 * @trace ERP-IT-003
 * @trace ERP-IT-005
 * @level IT
 * @scope EI公開保存API、共通Lock、Node Filesystemと今回起動する有限試験Process。
 * @boundary 試験生成Storeだけを操作し、失敗注入を復元後に自己生成Rootを回収する。実AI・Dockerは使わない。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  completeExecution,
  createExecution,
  type ExecutionCreateInput,
  getExecution,
  listExecutions,
} from "../../src/index.ts";
import { completion, fixture, startedAt } from "../fixtures/store.ts";

/** 同じIDの開始・終了・再送・競合を実履歴で確認し、終了内容の上書きを拒否する。
 * @trace ERP-IT-001
 */
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
/** 開始欠測・未知field・逆行日時を渡し、履歴出版前の拒否を確認する。一時Lock作成0は主張しない。
 * @trace ERP-IT-001
 */
test("開始のない終了・未知field・逆行時間は履歴出版前に拒否", (t) => {
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
/** 旧32MiB・10,000行を超えても有効な履歴を読み、追加保存・再読取りできる。
 * @responsibility 容量だけの拒否を撤去し、全行Schema検査と元履歴の保全を対照する。
 * @trace ERP-IT-001
 * @trace ERP-IT-005
 * @precondition 自己生成Storeへ現行Schemaのopen実行を10,001件だけ用意する。
 * @stimulus 旧容量超過の読取り、新規実行追加、全件ページと末尾ページ、未知fieldを与える。
 * @observation 公開API結果・全件数・末尾ID・current本文と残存材料。
 * @oracle 有効履歴は保存・読取りでき、不正Schemaは容量にかかわらず拒否し元byteを保持する。
 * @cleanup fixtureが今回作成したRootだけを回収する。
 * @boundary 実Filesystemの保存・読取り。実AI・Docker・過去履歴は使わない。
 */
test("旧容量・総件数上限を超える履歴の読取りと追加保存", (t) => {
  const s = fixture(t),
    history = path.join(s.directory, "history.jsonl"),
    note = "x".repeat(3500);
  const rows = Array.from({ length: 10_001 }, (_, index) => ({
    contract: "execution-intelligence/history/v3",
    kind: "execution",
    value: {
      executionId: `capacity-${index}`,
      startedAt,
      metadata: { note },
      state: "open",
      completion: null,
    },
  }));
  fs.writeFileSync(
    history,
    rows.map((row) => `${JSON.stringify(row)}\n`).join(""),
  );
  assert.ok(fs.statSync(history).size > 32 * 1024 * 1024);
  assert.equal(getExecution(s, "capacity-10000").status, "completed");
  assert.equal(
    createExecution(s, { executionId: "after-capacity", startedAt }).status,
    "completed",
  );
  const all = listExecutions(s, { limit: 10_002 });
  assert.equal(all.status, "completed");
  if (all.status !== "completed") throw Error("history_read_failed");
  assert.equal(all.value.total, 10_002);
  assert.equal(all.value.executions.length, 10_002);
  const tail = listExecutions(s, { offset: 10_001, limit: 1 });
  assert.equal(tail.status, "completed");
  if (tail.status !== "completed") throw Error("history_tail_failed");
  assert.equal(tail.value.executions.length, 1);
  const invalid = Buffer.concat([
    fs.readFileSync(history),
    Buffer.from(
      '{"contract":"execution-intelligence/history/v3","kind":"unknown","value":{}}\n',
    ),
  ]);
  fs.writeFileSync(history, invalid);
  assert.equal(listExecutions(s).status, "blocked");
  assert.deepEqual(fs.readFileSync(history), invalid);
  assert.deepEqual(fs.readdirSync(s.directory), ["history.jsonl"]);
});

for (const contents of [
  '{"contract":"crdd/execution-intelligence-event/v2"}\n',
  '{"contract":"execution-intelligence/history/v3"}\n{"contract":"old"}\n',
  "{broken}\n",
  "{}",
  "\n",
]) {
  /** 旧Schema・混在・破損行を渡し、拒否後も元byteが不変であることを確認する。
   * @trace ERP-IT-005
   */
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
  "execution-intelligence.history.lock",
  "history.pending.jsonl",
  "unknown.json",
]) {
  /** 未知残存を配置し、通常保存がそれを削除・奪取しないことを確認する。
   * @trace ERP-IT-003
   */
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
  /** 対象段階へ故障を注入し、Effect分類と回収結果・同じ参照を確認する。差替えは終了hookで復元する。
   * @trace ERP-IT-003
   */
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
        if (String(file).endsWith("execution-intelligence.history.lock")) {
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
/** 不存在と不正Store設定を正常空集合へ変えないことを公開結果で確認する。
 * @trace ERP-IT-005
 */
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
  /** 元実体の差とpending置換を注入し、別実体を後始末で削除しないことを確認する。
   * @trace ERP-IT-003
   */
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
/** open後のFile増大を注入し、上限外の本文読取りより前に拒否することを確認する。
 * @trace ERP-IT-005
 */
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
/** 複数の専用子Processを競合させ、全終了後に一件出版・異内容上書きなしを実履歴で確認する。
 * @trace ERP-IT-002
 */
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
/** readyを確認した今回子Processだけを終了し、Lock残存と再入場拒否を確認後にfixtureを回収する。
 * @trace ERP-IT-002
 */
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
  const before = fs.readFileSync(
    path.join(s.directory, "execution-intelligence.history.lock"),
  );
  assert.equal(
    createExecution(s, { executionId: "after-crash", startedAt }).status,
    "blocked",
  );
  assert.deepEqual(
    fs.readFileSync(
      path.join(s.directory, "execution-intelligence.history.lock"),
    ),
    before,
  );
});
