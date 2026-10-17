/**
 * docker-isolation:integration:owned-processの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility docker-isolation:integration:owned-processが所有する検証責務を実行する。
 * @trace ERB-IT-002
 * @level IT
 * @scope docker、owned、process
 * @boundary ERB-IT-002=Adjacent 1 Block: Controller→stdio・signal・close→資源Observer
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  STDERR_LIMIT_BYTES,
  STDOUT_LIMIT_BYTES,
  startOwnedAttachTerminationFixture,
  createDockerCliEnvironment,
} from "../../src/index.ts";
import {
  createOwnedProcessTreeFixture,
  createOwnedProcessTestEnvironment,
  startOwnedProcess,
  ownedProcessWorker,
  waitForCondition,
} from "../fixtures/owned-process-test-support.ts";

const windowsOnly = { skip: process.platform !== "win32", timeout: 20_000 };

/**
 * 試験の元Promiseを固定時間だけ観測する。
 * @responsibility 観測期限と元Processの終端責任を分離しTimerを解除する。
 * @trace ERB-IT-002
 * @precondition 元HandleはCaseのfinallyで必ず終端する。
 * @stimulus 元Promiseと固定期限を同時に待つ。
 * @observation 期限内の値または明示した未確認値。
 * @oracle TimeoutだけをProcess完了へ昇格しない。
 * @cleanup 期限Timerを必ず解除する。
 * @boundary ERB-IT-002=Direct Boundary: 試験観測と同じ子Process。
 */
async function waitForAttachFixture<T>(
  promise: Promise<T>,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), 5_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 所有Attach子の三つの故障を実Processで確認する。
 * @responsibility 旧Coordinator試験のready・overflow・終端exact1・closeを下位の直接境界で維持する。
 * @trace ERB-IT-002
 * @precondition 固定Node試験子と固定環境だけを使用する。
 * @stimulus 未ready、ready後保留、出力超過を順に発生させる。
 * @observation ready、出力超過、終了要求数、元結果とclose。
 * @oracle 各元子が終端し、シナリオ別ready／overflowが一致、終了要求exact1。
 * @cleanup 各Caseのfinallyで同じ所有子を終端・joinする。
 * @boundary ERB-IT-002=Direct Boundary: 固定Attach実子Process。Docker・上位ST成立ではない。
 */
test(
  "Host Windows: Attach試験子の三故障は終了要求一回とcloseへ収束する",
  windowsOnly,
  async () => {
    const environment = createDockerCliEnvironment({
      dockerConfig: null,
      dockerHome: null,
    });
    assert.ok(environment);
    for (const scenario of [
      "never_ready",
      "ready_then_never_complete",
      "output_overflow",
    ] as const) {
      const controller: ReturnType<typeof startOwnedAttachTerminationFixture> =
        startOwnedAttachTerminationFixture(scenario, environment);
      try {
        assert.equal(
          await waitForAttachFixture(controller.started, false),
          true,
        );
        const ready: boolean =
          scenario === "ready_then_never_complete"
            ? await waitForAttachFixture(controller.ready, false)
            : false;
        if (scenario === "output_overflow")
          await waitForAttachFixture(controller.completion, null);
        if (scenario !== "output_overflow" || !controller.isClosed())
          await controller.terminateAndWait();
        const execution = await controller.terminateAndWait();
        assert.ok(execution);
        assert.equal(controller.isClosed(), true);
        assert.equal(controller.getTerminationRequestCount(), 1);
        assert.equal(ready, scenario === "ready_then_never_complete");
        assert.equal(execution.outputExceeded, scenario === "output_overflow");
      } finally {
        await controller.terminateAndWait();
      }
    }
  },
);

/**
 * createSyntheticChildのTest準備責務を実行する。
 *
 * @responsibility createSyntheticChildがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createSyntheticChildを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
function createSyntheticChild() {
  return Object.assign(new childProcess.ChildProcess(), {
    pid: undefined as number | undefined,
    stdin: null as PassThrough | null,
    stdout: null as PassThrough | null,
    stderr: null as PassThrough | null,
    exitCode: null,
    signalCode: null,
  });
}

/**
 * withSyntheticSpawnのTest準備責務を実行する。
 *
 * @responsibility withSyntheticSpawnがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus withSyntheticSpawnを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
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

/**
 * 固定子: stdio構築前のEMFILE/ENFILEは所有を保持しerror後closeを待つを検証する。
 *
 * @responsibility 固定子: stdio構築前のEMFILE/ENFILEは所有を保持しerror後closeを待つの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定子: stdio構築前のEMFILE/ENFILEは所有を保持しerror後closeを待つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
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
        assert.equal(await handle.started(20), false);
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

/**
 * 固定子: close不明と同期spawn失敗を資源終了へ昇格しないを検証する。
 *
 * @responsibility 固定子: close不明と同期spawn失敗を資源終了へ昇格しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定子: close不明と同期spawn失敗を資源終了へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
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

/**
 * 固定子: 入出力欠落・送信失敗・stream errorの後もcloseを所有するを検証する。
 *
 * @responsibility 固定子: 入出力欠落・送信失敗・stream errorの後もcloseを所有するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定子: 入出力欠落・送信失敗・stream errorの後もcloseを所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
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

/**
 * 固定子: taskkill起動失敗・非0結果を元子の終了失敗と混同しないを検証する。
 *
 * @responsibility 固定子: taskkill起動失敗・非0結果を元子の終了失敗と混同しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定子: taskkill起動失敗・非0結果を元子の終了失敗と混同しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("固定子: taskkill起動失敗・非0結果を元子の終了失敗と混同しない", async () => {
  for (const failure of ["throw", "error", "nonzero"]) {
    const child = createSyntheticChild();
    child.pid = 123456;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const killer = Object.assign(new childProcess.ChildProcess(), {
      pid: 654321,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => true,
    });
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
    killer.stdout.destroy();
    killer.stderr.destroy();
  }
});

/**
 * 固定子: 元子がcloseしてもtaskkill補助子のclose不明を成功にしないを検証する。
 *
 * @responsibility 固定子: 元子がcloseしてもtaskkill補助子のclose不明を成功にしないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定子: 元子がcloseしてもtaskkill補助子のclose不明を成功にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("固定子: 元子がcloseしてもtaskkill補助子のclose不明を成功にしない", async () => {
  const child = createSyntheticChild();
  child.pid = 123456;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const killer = Object.assign(new childProcess.ChildProcess(), {
    pid: 654321,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: () => true,
  });
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
  killer.stdout.destroy();
  killer.stderr.destroy();
});

/**
 * 動的条件の検証Caseを検証する。
 *
 * @responsibility 動的条件の検証Caseの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的条件の検証Caseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
test(
  "Host Windows: 本番共通process: UTF-8標準入力と正常/非0終了を実観測",
  windowsOnly,
  async (t) => {
    for (const mode of ["echo", "nonzero"]) {
      const input = mode === "echo" ? "日本語\r\nfixed input\n" : null;
      const handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, mode],
        createOwnedProcessTestEnvironment(),
        input,
      );
      assert.equal(await handle.started(5_000), true);
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

/**
 * 動的条件の検証Caseを検証する。
 *
 * @responsibility 動的条件の検証Caseの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的条件の検証Caseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
test(
  "Host Windows: 本番共通process: 待機期限は取消ではなく、重複取消後に実子孫とcloseを確認",
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
  /**
   * 動的条件の検証Caseを検証する。
   *
   * @responsibility 動的条件の検証Caseの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 動的条件の検証Caseの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
   */
  test(
    `Host Windows: 本番共通process: ${mode}は実processを終了し出力保持を制限`,
    windowsOnly,
    async (t) => {
      const handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, mode],
        createOwnedProcessTestEnvironment(),
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

/**
 * 動的条件の検証Caseを検証する。
 *
 * @responsibility 動的条件の検証Caseの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的条件の検証Caseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: docker-isolation Test Source→対象契約
 */
test(
  "Host Windows: 本番共通process: 起動失敗はerror結果とcloseを区別して観測",
  windowsOnly,
  async (t) => {
    const handle = startOwnedProcess(
      `${ownedProcessWorker}.missing.exe`,
      [],
      createOwnedProcessTestEnvironment(),
      null,
    );
    assert.equal(await handle.started(5_000), false);
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
