/**
 * 固定確認コードReaderの技術搬送・取消・終了を検証する。
 * @packageDocumentation
 * @responsibility 既存Reader低層OracleをPA内部へ移管する。
 * @trace EST-ST-003
 * @level ST
 * @scope terminal、reader、cancellation
 * @boundary EST-ST-003=System/E2E: 固定Readerと合成子の技術境界。同意判断は対象外。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  INTERACTIVE_CONSOLE_READER_CONTRACT,
  INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
  parseInteractiveConsoleLine,
  readInteractiveConsoleLineFromStream as readTerminalLineUsingStream,
  readOwnedInteractiveConsoleLineOutcomeUsingAdapter,
} from "../../src/terminal/confirmation-reader.ts";
import { readInteractiveConsoleLineOutcomeUsingAdapter } from "../support/terminal-reader-harness.ts";
const platformRoot = path.resolve(import.meta.dirname, "../..");
/**
 * 検証済みTTY入力は完了・取消・errorをlistener残存なしへ収束するを検証する。
 *
 * @responsibility 検証済みTTY入力は完了・取消・errorをlistener残存なしへ収束するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 検証済みTTY入力は完了・取消・errorをlistener残存なしへ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
 */
test("検証済みTTY入力は完了・取消・errorをlistener残存なしへ収束する", async () => {
  /**
   * inputScenarioのTest準備責務を実行する。
   *
   * @responsibility inputScenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace EST-ST-003
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus inputScenarioを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
   */
  function inputScenario(overrides: Record<string, unknown> = {}) {
    const emitter = new EventEmitter();
    let pauseCount = 0;
    let resumeCount = 0;
    const stream = {
      isTTY: true,
      destroyed: false,
      readable: true,
      readableEncoding: null,
      readableFlowing: false,
      listenerCount: (event: "data") => emitter.listenerCount(event),
      on: (event: "data", listener: (chunk: Buffer | string) => void) => {
        emitter.on(event, listener);
      },
      once: (event: "error" | "end", listener: (error?: Error) => void) => {
        emitter.once(event, listener);
      },
      removeListener: (
        event: "data" | "error" | "end",
        listener:
          | ((chunk: Buffer | string) => void)
          | ((error?: Error) => void),
      ) => {
        emitter.removeListener(event, listener);
      },
      pause: () => {
        pauseCount += 1;
      },
      resume: () => {
        resumeCount += 1;
      },
      ...overrides,
    };
    return {
      stream,
      emitter,
      pauseCount: () => pauseCount,
      resumeCount: () => resumeCount,
    };
  }

  {
    const scenario = inputScenario();
    const controller = new AbortController();
    const line = readTerminalLineUsingStream(
      scenario.stream,
      controller.signal,
    );
    scenario.emitter.emit("data", Buffer.from("123456\r\n", "utf8"));
    assert.equal(await line, "123456");
    assert.equal(scenario.pauseCount(), 1);
    assert.equal(scenario.resumeCount(), 1);
    assert.equal(scenario.emitter.listenerCount("data"), 0);
    assert.equal(scenario.emitter.listenerCount("error"), 0);
    assert.equal(scenario.emitter.listenerCount("end"), 0);
  }

  for (const outcome of ["abort", "error", "end"] as const) {
    const scenario = inputScenario();
    const controller = new AbortController();
    const line = readTerminalLineUsingStream(
      scenario.stream,
      controller.signal,
    );
    if (outcome === "abort") controller.abort();
    else scenario.emitter.emit(outcome, new Error(outcome));
    assert.equal(await line, null, outcome);
    assert.equal(scenario.pauseCount(), 1, outcome);
    assert.equal(scenario.emitter.listenerCount("data"), 0, outcome);
    assert.equal(scenario.emitter.listenerCount("error"), 0, outcome);
    assert.equal(scenario.emitter.listenerCount("end"), 0, outcome);
  }

  for (const overrides of [
    { isTTY: false },
    { destroyed: true },
    { readable: false },
    { readableEncoding: "utf8" },
    { readableFlowing: true },
  ]) {
    const scenario = inputScenario(overrides);
    assert.equal(
      await readTerminalLineUsingStream(
        scenario.stream,
        new AbortController().signal,
      ),
      null,
    );
    assert.equal(scenario.resumeCount(), 0);
  }

  {
    const scenario = inputScenario({
      resume: () => {
        throw new Error("resume failed");
      },
    });
    assert.equal(
      await readTerminalLineUsingStream(
        scenario.stream,
        new AbortController().signal,
      ),
      null,
    );
    assert.equal(scenario.emitter.listenerCount("data"), 0);
    assert.equal(scenario.emitter.listenerCount("error"), 0);
    assert.equal(scenario.emitter.listenerCount("end"), 0);
  }

  for (const registrationFailure of ["on", "error", "end"] as const) {
    const scenario = inputScenario({
      on: (event: "data", listener: (chunk: Buffer | string) => void) => {
        scenario.emitter.on(event, listener);
        if (registrationFailure === "on") throw new Error("on failed");
      },
      once: (event: "error" | "end", listener: (error?: Error) => void) => {
        scenario.emitter.once(event, listener);
        if (registrationFailure === event) throw new Error(`${event} failed`);
      },
    });
    assert.equal(
      await readTerminalLineUsingStream(
        scenario.stream,
        new AbortController().signal,
      ),
      null,
      registrationFailure,
    );
    assert.equal(scenario.emitter.listenerCount("data"), 0);
    assert.equal(scenario.emitter.listenerCount("error"), 0);
    assert.equal(scenario.emitter.listenerCount("end"), 0);
  }

  {
    const scenario = inputScenario({
      pause: () => {
        throw new Error("pause failed");
      },
    });
    const line = readTerminalLineUsingStream(
      scenario.stream,
      new AbortController().signal,
    );
    scenario.emitter.emit("data", Buffer.from("123456\n", "utf8"));
    assert.equal(await line, null);
    assert.equal(scenario.emitter.listenerCount("data"), 0);
    assert.equal(scenario.emitter.listenerCount("error"), 0);
    assert.equal(scenario.emitter.listenerCount("end"), 0);
  }

  {
    let removalAttempts = 0;
    const scenario = inputScenario({
      removeListener: () => {
        removalAttempts += 1;
        throw new Error("remove failed");
      },
    });
    const line = readTerminalLineUsingStream(
      scenario.stream,
      new AbortController().signal,
    );
    scenario.emitter.emit("data", Buffer.from("123456\n", "utf8"));
    assert.equal(await line, null);
    assert.equal(removalAttempts, 3);
  }

  const actualInput = new PassThrough();
  Object.defineProperty(actualInput, "isTTY", { value: true });
  const actualLine = readTerminalLineUsingStream(
    actualInput as unknown as Parameters<typeof readTerminalLineUsingStream>[0],
    new AbortController().signal,
  );
  actualInput.write(Buffer.from("123456\r\n", "utf8"));
  assert.equal(await actualLine, "123456");
  assert.equal(actualInput.listenerCount("data"), 0);
  assert.equal(actualInput.listenerCount("error"), 0);
  assert.equal(actualInput.listenerCount("end"), 0);

  const delayedErrorInput = new PassThrough();
  Object.defineProperty(delayedErrorInput, "isTTY", { value: true });
  const delayedErrorLine = readTerminalLineUsingStream(
    delayedErrorInput as unknown as Parameters<
      typeof readTerminalLineUsingStream
    >[0],
    new AbortController().signal,
  );
  delayedErrorInput.write(Buffer.from("123456\n", "utf8"));
  queueMicrotask(() =>
    delayedErrorInput.emit("error", new Error("late error")),
  );
  assert.equal(await delayedErrorLine, null);
  assert.equal(delayedErrorInput.listenerCount("data"), 0);
  assert.equal(delayedErrorInput.listenerCount("error"), 0);
  assert.equal(delayedErrorInput.listenerCount("end"), 0);

  const cancelledInput = new PassThrough();
  Object.defineProperty(cancelledInput, "isTTY", { value: true });
  const controller = new AbortController();
  const cancelledLine = readTerminalLineUsingStream(
    cancelledInput as unknown as Parameters<
      typeof readTerminalLineUsingStream
    >[0],
    controller.signal,
  );
  controller.abort();
  assert.equal(await cancelledLine, null);
  assert.equal(cancelledInput.listenerCount("data"), 0);
  assert.equal(cancelledInput.listenerCount("error"), 0);
  assert.equal(cancelledInput.listenerCount("end"), 0);
});

/**
 * 固定reader子Processは単一OS readとdescriptor closeを分離するを検証する。
 *
 * @responsibility 固定reader子Processは単一OS readとdescriptor closeを分離するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定reader子Processは単一OS readとdescriptor closeを分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
 */
test("固定reader子Processは単一OS readとdescriptor closeを分離する", async () => {
  /**
   * scenarioのTest準備責務を実行する。
   *
   * @responsibility scenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace EST-ST-003
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus scenarioを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
   */
  function scenario(
    options: { closeConfirmed?: boolean; openFails?: boolean } = {},
  ) {
    let closeCount = 0;
    let readBuffer: Buffer | null = null;
    let readCallback:
      | ((error: NodeJS.ErrnoException | null, count: number) => void)
      | null = null;
    const adapter = Object.freeze({
      open: () => {
        if (options.openFails) throw new Error("fixture_open_failed");
        return 17;
      },
      close: () => {
        closeCount += 1;
        if (options.closeConfirmed === false)
          throw new Error("fixture_close_failed");
      },
      read: (
        _descriptor: number,
        buffer: Buffer,
        _offset: number,
        _length: number,
        _position: null,
        callback: (error: NodeJS.ErrnoException | null, count: number) => void,
      ) => {
        readBuffer = buffer;
        readCallback = callback;
      },
    });
    return {
      adapter: adapter as unknown as Parameters<
        typeof readOwnedInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
      complete: (value = "123456\r\n") => {
        assert.ok(readBuffer);
        const bytes = Buffer.from(value, "utf8");
        bytes.copy(readBuffer);
        assert.equal(typeof readCallback, "function");
        readCallback?.(null, bytes.byteLength);
      },
      closeCount: () => closeCount,
    };
  }

  {
    const observed = scenario();
    const pending = readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
      "win32",
      new AbortController().signal,
      observed.adapter,
    );
    observed.complete();
    assert.deepEqual(await pending, {
      status: "completed",
      line: "123456",
      descriptorCloseConfirmed: true,
    });
    assert.equal(observed.closeCount(), 1);
  }

  {
    const observed = scenario();
    const controller = new AbortController();
    const pending = readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
      "win32",
      controller.signal,
      observed.adapter,
    );
    controller.abort();
    observed.complete();
    assert.deepEqual(await pending, {
      status: "cancelled",
      line: null,
      descriptorCloseConfirmed: true,
    });
    assert.equal(observed.closeCount(), 1);
  }

  {
    const observed = scenario({ closeConfirmed: false });
    const pending = readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
      "win32",
      new AbortController().signal,
      observed.adapter,
    );
    observed.complete();
    assert.deepEqual(await pending, {
      status: "reader_failed",
      line: null,
      descriptorCloseConfirmed: false,
    });
  }

  {
    const observed = scenario({ openFails: true });
    assert.deepEqual(
      await readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
        "win32",
        new AbortController().signal,
        observed.adapter,
      ),
      {
        status: "reader_failed",
        line: null,
        descriptorCloseConfirmed: true,
      },
    );
    assert.equal(observed.closeCount(), 0);
  }
});

/**
 * 固定reader fixtureはdescriptor close失敗を成功へ流用しないを検証する。
 *
 * @responsibility 固定reader fixtureはdescriptor close失敗を成功へ流用しないの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定reader fixtureはdescriptor close失敗を成功へ流用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
 */
test("固定reader fixtureはdescriptor close失敗を成功へ流用しない", () => {
  const fixture = path.join(
    platformRoot,
    "tests",
    "fixtures",
    "interactive-console-owned-reader-process.ts",
  );
  const result = spawnSync(process.execPath, [fixture], {
    shell: false,
    cwd: platformRoot,
    env: {},
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "reader_failed",
    line: null,
    descriptorCloseConfirmed: false,
  });
});

/**
 * 固定Console readerは厳密な一行protocolと非TTY拒否へ閉じるを検証する。
 *
 * @responsibility 固定Console readerは厳密な一行protocolと非TTY拒否へ閉じるの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Console readerは厳密な一行protocolと非TTY拒否へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
 */
test("固定Console readerは厳密な一行protocolと非TTY拒否へ閉じる", () => {
  assert.equal(
    parseInteractiveConsoleLine(Buffer.from("123456\n", "utf8")),
    "123456",
  );
  assert.equal(
    parseInteractiveConsoleLine(Buffer.from("123456\r\n", "utf8")),
    "123456",
  );
  for (const invalid of [
    Buffer.alloc(0),
    Buffer.from("\n", "utf8"),
    Buffer.from("\r\n", "utf8"),
    Buffer.from("12345\n", "utf8"),
    Buffer.from("123456\n654321\n", "utf8"),
    Buffer.from("123456\0\n", "utf8"),
    Buffer.from("123456", "utf8"),
    Buffer.concat([Buffer.alloc(64, 0x31), Buffer.from("\n")]),
    Buffer.from([0xc3, 0x28, 0x0a]),
  ]) {
    assert.equal(parseInteractiveConsoleLine(invalid), null);
  }

  const readerEntrypoint = path.join(
    platformRoot,
    "src/terminal/confirmation-reader.ts",
  );
  const result = spawnSync(process.execPath, [readerEntrypoint], {
    shell: false,
    cwd: path.dirname(readerEntrypoint),
    env: {},
    input: Buffer.from("123456\n", "utf8"),
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "");
});

/**
 * 固定reader親はProcess順序・取消・timeout・cleanupを同じ状態機械で閉じるを検証する。
 *
 * @responsibility 固定reader親はProcess順序・取消・timeout・cleanupを同じ状態機械で閉じるの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定reader親はProcess順序・取消・timeout・cleanupを同じ状態機械で閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
 */
test("固定reader親はProcess順序・取消・timeout・cleanupを同じ状態機械で閉じる", async () => {
  /**
   * readerProcessScenarioのTest準備責務を実行する。
   *
   * @responsibility readerProcessScenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace EST-ST-003
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus readerProcessScenarioを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary EST-ST-003=Direct Boundary: PA内のReader技術境界
   */
  function readerProcessScenario(isKillSuccessful = true) {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      connected: boolean;
      send: (
        message: unknown,
        callback?: (error: Error | null) => void,
      ) => boolean;
      kill: (signal: string) => boolean;
      disconnect: () => void;
    };
    child.stdout = new EventEmitter();
    child.connected = true;
    const messages: unknown[] = [];
    const sendCallbacks: Array<(error: Error | null) => void> = [];
    const killSignals: string[] = [];
    child.send = (message, callback) => {
      messages.push(message);
      if (callback) sendCallbacks.push(callback);
      return true;
    };
    child.kill = (signal) => {
      killSignals.push(signal);
      return isKillSuccessful;
    };
    child.disconnect = () => {
      child.connected = false;
    };
    const timers: Array<{
      callback: () => void;
      milliseconds: number;
      cleared: boolean;
    }> = [];
    let createCount = 0;
    const adapter = Object.freeze({
      isTty: () => true,
      createChild: () => {
        createCount += 1;
        return child;
      },
      setTimeout: (callback: () => void, milliseconds: number) => {
        const timer = { callback, milliseconds, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer: { cleared: boolean }) => {
        timer.cleared = true;
      },
    });
    return {
      child,
      messages,
      sendCallbacks,
      killSignals,
      timers,
      createCount: () => createCount,
      adapter,
    };
  }

  {
    const scenario = readerProcessScenario();
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      new AbortController().signal,
      scenario.adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    assert.equal(scenario.createCount(), 1);

    let isCompleted = false;
    void pending.then(() => {
      isCompleted = true;
    });
    scenario.child.emit("close", 0);
    scenario.child.stdout.emit(
      "data",
      Buffer.from(
        `${JSON.stringify({
          contract: INTERACTIVE_CONSOLE_READER_CONTRACT,
          contractRevision: INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
          status: "completed",
          line: "123456",
        })}\n`,
        "utf8",
      ),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(isCompleted, false);
    scenario.child.stdout.emit("close");
    assert.deepEqual(await pending, { status: "completed", line: "123456" });
    scenario.child.emit("close", 0);
    scenario.child.stdout.emit("close");
    assert.equal(scenario.child.listenerCount("error"), 0);
    assert.equal(scenario.child.listenerCount("close"), 0);
    assert.equal(scenario.child.stdout.listenerCount("data"), 0);
    assert.equal(scenario.child.stdout.listenerCount("error"), 0);
    assert.equal(scenario.child.stdout.listenerCount("close"), 0);
    assert.equal(
      scenario.timers.every((timer) => timer.cleared),
      true,
    );
  }

  {
    const scenario = readerProcessScenario();
    let ttyChecks = 0;
    const adapter = Object.freeze({
      ...scenario.adapter,
      isTty: () => {
        ttyChecks += 1;
        return ttyChecks === 1;
      },
    });
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      new AbortController().signal,
      adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    scenario.child.stdout.emit("close");
    scenario.child.emit("close", 2);
    assert.deepEqual(await pending, { status: "reader_failed", line: null });
    assert.equal(ttyChecks, 1);
  }

  {
    const scenario = readerProcessScenario();
    const controller = new AbortController();
    const adapter = Object.freeze({
      ...scenario.adapter,
      createChild: () => {
        controller.abort();
        return scenario.child;
      },
    });
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      controller.signal,
      adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    assert.deepEqual(scenario.messages, ["cancel"]);
    scenario.child.stdout.emit("close");
    scenario.child.emit("close", null);
    assert.deepEqual(await pending, { status: "cancelled", line: null });
  }

  {
    const scenario = readerProcessScenario();
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      new AbortController().signal,
      scenario.adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    scenario.child.stdout.emit(
      "data",
      Buffer.from(
        `${JSON.stringify({
          contract: INTERACTIVE_CONSOLE_READER_CONTRACT,
          contractRevision: INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
          status: "completed",
          line: "123456",
        })}\n`,
        "utf8",
      ),
    );
    assert.deepEqual(scenario.messages, []);
    scenario.timers.find((timer) => timer.milliseconds === 500)?.callback();
    assert.deepEqual(scenario.killSignals, ["SIGKILL"]);
    scenario.child.stdout.emit("close");
    scenario.child.emit("close", null);
    assert.deepEqual(await pending, { status: "completed", line: "123456" });
  }

  for (const stopSource of ["cancel", "timeout"] as const) {
    const scenario = readerProcessScenario(false);
    const controller = new AbortController();
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      controller.signal,
      scenario.adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    if (stopSource === "cancel") controller.abort();
    else
      scenario.timers
        .find((timer) => timer.milliseconds === 110_000)
        ?.callback();
    assert.deepEqual(scenario.messages, ["cancel"]);
    scenario.timers.find((timer) => timer.milliseconds === 500)?.callback();
    assert.deepEqual(scenario.killSignals, ["SIGKILL"]);
    let isCompleted = false;
    void pending.then(() => {
      isCompleted = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(isCompleted, false, stopSource);
    scenario.child.stdout.emit("close");
    scenario.child.emit("close", null);
    assert.deepEqual(
      await pending,
      { status: "cleanup_unknown", line: null },
      stopSource,
    );
    assert.equal(scenario.sendCallbacks.length, 1, stopSource);
    assert.doesNotThrow(() =>
      scenario.sendCallbacks[0]?.(new Error("fixture_late_ipc_epipe")),
    );
    assert.equal(scenario.child.listenerCount("error"), 0, stopSource);
    assert.equal(scenario.child.listenerCount("close"), 0, stopSource);
    assert.equal(scenario.child.stdout.listenerCount("data"), 0, stopSource);
    assert.equal(scenario.child.stdout.listenerCount("error"), 0, stopSource);
    assert.equal(scenario.child.stdout.listenerCount("close"), 0, stopSource);
  }

  {
    const scenario = readerProcessScenario(true);
    const controller = new AbortController();
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      controller.signal,
      scenario.adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    controller.abort();
    scenario.timers.find((timer) => timer.milliseconds === 500)?.callback();
    let isCompleted = false;
    void pending.then(() => {
      isCompleted = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(isCompleted, false);
    scenario.child.emit("close", null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(isCompleted, false);
    scenario.child.stdout.emit("close");
    assert.deepEqual(await pending, { status: "cancelled", line: null });
  }

  for (const failurePoint of [
    "child_listener",
    "stdout_listener",
    "abort_listener",
    "disconnect",
  ] as const) {
    const scenario = readerProcessScenario();
    const childRemoveListener = scenario.child.removeListener.bind(
      scenario.child,
    );
    const stdoutRemoveListener = scenario.child.stdout.removeListener.bind(
      scenario.child.stdout,
    );
    let childRemoveCount = 0;
    let stdoutRemoveCount = 0;
    let abortRemoveCount = 0;
    let disconnectCount = 0;
    scenario.child.removeListener = ((event: string, listener: () => void) => {
      childRemoveCount += 1;
      if (failurePoint === "child_listener" && event === "error")
        throw new Error("fixture_child_listener_cleanup_failed");
      return childRemoveListener(event, listener);
    }) as typeof scenario.child.removeListener;
    scenario.child.stdout.removeListener = ((
      event: string,
      listener: () => void,
    ) => {
      stdoutRemoveCount += 1;
      if (failurePoint === "stdout_listener" && event === "data")
        throw new Error("fixture_stdout_listener_cleanup_failed");
      return stdoutRemoveListener(event, listener);
    }) as typeof scenario.child.stdout.removeListener;
    scenario.child.disconnect = () => {
      disconnectCount += 1;
      if (failurePoint === "disconnect")
        throw new Error("fixture_disconnect_failed");
      scenario.child.connected = false;
    };
    const cancellationSignal = Object.freeze({
      aborted: false,
      addEventListener: () => undefined,
      removeEventListener: () => {
        abortRemoveCount += 1;
        if (failurePoint === "abort_listener")
          throw new Error("fixture_abort_listener_cleanup_failed");
      },
    }) as unknown as AbortSignal;
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      cancellationSignal,
      scenario.adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    scenario.child.stdout.emit(
      "data",
      Buffer.from(
        `${JSON.stringify({
          contract: INTERACTIVE_CONSOLE_READER_CONTRACT,
          contractRevision: INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
          status: "completed",
          line: "123456",
        })}\n`,
        "utf8",
      ),
    );
    scenario.child.stdout.emit("close");
    scenario.child.emit("close", 0);
    assert.deepEqual(
      await pending,
      { status: "cleanup_unknown", line: null },
      failurePoint,
    );
    assert.equal(childRemoveCount >= 2, true, failurePoint);
    assert.equal(stdoutRemoveCount >= 3, true, failurePoint);
    assert.equal(abortRemoveCount, 1, failurePoint);
    assert.equal(disconnectCount, 1, failurePoint);
  }

  {
    const scenario = readerProcessScenario();
    scenario.child.kill = () => {
      throw new Error("fixture_kill_failed");
    };
    const controller = new AbortController();
    const pending = readInteractiveConsoleLineOutcomeUsingAdapter(
      17,
      controller.signal,
      scenario.adapter as unknown as Parameters<
        typeof readInteractiveConsoleLineOutcomeUsingAdapter
      >[2],
    );
    controller.abort();
    scenario.timers.find((timer) => timer.milliseconds === 500)?.callback();
    scenario.child.stdout.emit("close");
    scenario.child.emit("close", null);
    assert.deepEqual(await pending, {
      status: "cleanup_unknown",
      line: null,
    });
  }
});
