import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import tty from "node:tty";
import { pathToFileURL } from "node:url";

import {
  describeInteractiveConsoleContract,
  INTERACTIVE_CONSOLE_CONTRACT,
  readInteractiveConsoleLine,
  readInteractiveConsoleLineOutcomeUsingAdapter,
  readTerminalLineUsingStream,
  withInteractiveConsoleAsyncOutcomeUsingAdapter,
  withInteractiveConsoleAsyncUsingAdapter,
  withInteractiveConsoleOutcomeUsingAdapter,
  withInteractiveConsoleUsingAdapter,
  writeInteractiveConsoleTextUsingAdapter,
  writeWindowsTerminalTextOutcomeUsingStream,
  writeWindowsTerminalTextUsingStream,
} from "../src/core/interactive-console.ts";
import {
  INTERACTIVE_CONSOLE_READER_CONTRACT,
  INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
  parseInteractiveConsoleLine,
} from "../src/core/interactive-console-reader.ts";
import {
  describeCoordinatorNodeRuntimeVersionContract,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";
import { isRuntimeProcessPoisoned } from "../src/core/runtime-process-safety-state.ts";
import {
  createWindowsDockerCliEnvironment,
  createInteractiveConsoleReaderEnvironment,
  createWindowsNativeHelperEnvironment,
  createWindowsNodeConsoleReaderEnvironment,
} from "../src/core/windows-child-environment.ts";
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../src/security/candidate-store-kernel-lock.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "..");

function resolveDeferredBoolean(resolver: unknown, isResolved: boolean) {
  assert.equal(typeof resolver, "function");
  (resolver as (isSuccessful: boolean) => void)(isResolved);
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

test("対話Consoleは一つのRuntime契約だけがOS deviceを所有する", () => {
  const contract = describeInteractiveConsoleContract();
  assert.deepEqual(contract, {
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: 12,
    windowsDevices: ["\\\\.\\CONIN$", "\\\\.\\CONOUT$"],
    windowsDeviceOpenModes: { input: "r", output: "r+" },
    windowsUnicodeOutput: "node_unicode_tty_output_required",
    windowsTerminalWriteTimeoutMs: 1_000,
    windowsTerminalWriteOutcomes: [
      "completed",
      "write_failed",
      "cleanup_unknown_process_restart_required",
    ],
    synchronousPreflightOutcomes: [
      "available",
      "unavailable",
      "cleanup_unknown_process_restart_required",
    ],
    productionPoisonTiming:
      "synchronous_on_cleanup_unknown_observation_before_return_or_next_non_cleanup_await",
    productionPoisonPreservingEntrypoints: [
      "withInteractiveConsoleOutcome",
      "withInteractiveConsole",
      "withInteractiveConsoleAsyncOutcome",
      "withInteractiveConsoleAsync",
      "readInteractiveConsoleLineOutcome",
      "readInteractiveConsoleLine",
      "writeInteractiveConsoleTextOutcome",
      "writeInteractiveConsoleText",
      "interactiveConsoleAvailabilityOutcome",
      "interactiveConsoleAvailable",
    ],
    genericUsingAdapterAuthority:
      "non_authority_pure_no_production_process_state",
    productionNoncompletedValue: "null",
    validatedTtyInput: "exact_console_descriptor_child_tty_required",
    taskStandardInputRole: "structured_transport_only",
    readerEntrypoint: "fixed_runtime_owned_non_exported_module",
    readerArtifactIdentity:
      "single_use_verified_package_capability_and_fresh_content_root",
    readerArguments: "fixed_entrypoint_only_no_dynamic_arguments",
    readerEnvironment:
      "windows_loaded_kernel32_os_directory_plus_fixed_neutral_names_posix_fixed_empty",
    platformGuarantee:
      "windows_local_personal_only_posix_fixed_empty_candidate_not_promoted",
    readerTimeoutMs: 110_000,
    readerCancelGraceMs: 500,
    readerCleanupSchedulingMarginMs: 5_000,
    readerOrphanFailsafeMs: 120_000,
    readerStandardIo:
      "exact_console_input_bounded_stdout_discarded_stderr_private_ipc",
    readerCancellation:
      "ipc_cancel_parent_disconnect_then_exact_child_force_termination",
    readerCompletion:
      "exact_child_close_and_bounded_stdout_close_required_no_unknown_normal_return",
    windowsRedirectedOutput: "fail_closed",
    redirectedStandardInputAllowed: false,
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });
  assert.equal(
    contract.readerTimeoutMs +
      contract.readerCancelGraceMs +
      contract.readerCleanupSchedulingMarginMs <
      contract.readerOrphanFailsafeMs,
    true,
  );

  const executableSources = ["bin", "scripts", "src"]
    .flatMap((directory) => sourceFiles(path.join(coordinatorRoot, directory)))
    .filter((file) => !file.endsWith("interactive-console.ts"));
  for (const file of executableSources) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/CONIN\$|CONOUT\$|\/dev\/tty/u.test(source), false, file);
  }

  const parentConsoleSource = fs.readFileSync(
    path.join(coordinatorRoot, "src", "core", "interactive-console.ts"),
    "utf8",
  );
  const readerSource = fs.readFileSync(
    path.join(coordinatorRoot, "src", "core", "interactive-console-reader.ts"),
    "utf8",
  );
  const cliSource = fs.readFileSync(
    path.join(coordinatorRoot, "bin", "coordinator.ts"),
    "utf8",
  );
  assert.equal(parentConsoleSource.includes("process.stdin"), false);
  assert.equal(readerSource.includes("process.stdin"), true);
  assert.equal(cliSource.includes("fs.readSync(0"), true);
});

test("generic Console adapterはcleanup不明でもproduction stateを変更しない", async () => {
  assert.equal(isRuntimeProcessPoisoned(), false);
  const syncOutcome = withInteractiveConsoleOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (device: string) => (device.endsWith("CONIN$") ? 11 : 12),
      close: () => {
        throw new Error("fixture_close_failed");
      },
    }),
    () => "candidate",
  );
  assert.deepEqual(syncOutcome, {
    status: "cleanup_unknown",
    value: "candidate",
  });
  const asyncOutcome = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (device: string) => (device.endsWith("CONIN$") ? 11 : 12),
      close: () => {
        throw new Error("fixture_close_failed");
      },
    }),
    async () => Promise.resolve("candidate"),
  );
  assert.deepEqual(asyncOutcome, {
    status: "cleanup_unknown",
    value: "candidate",
  });
  assert.equal(isRuntimeProcessPoisoned(), false);
});

test("Console非同期所有はoperationと全close失敗を構造化する", async () => {
  const closedDescriptors: number[] = [];
  const cleanupUnknown = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (_name: string, flags: "r" | "r+" | "w") => (flags === "r" ? 1 : 2),
      close: (descriptor: number) => {
        closedDescriptors.push(descriptor);
        if (descriptor === 1) throw new Error("fixture_close_failed");
      },
      validate: () => true,
    }),
    async () => "completed",
  );
  assert.deepEqual(cleanupUnknown, {
    status: "cleanup_unknown",
    value: "completed",
  });
  assert.deepEqual(closedDescriptors, [1, 2]);

  const operationFailed = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (_name: string, flags: "r" | "r+" | "w") => (flags === "r" ? 1 : 2),
      close: () => undefined,
      validate: () => true,
    }),
    async () => {
      throw new Error("fixture_operation_failed");
    },
  );
  assert.deepEqual(operationFailed, {
    status: "operation_failed",
    value: null,
  });

  for (const validation of [
    () => false,
    () => {
      throw new Error("fixture_validation_failed");
    },
  ]) {
    const validationClosedDescriptors: number[] = [];
    let operationCount = 0;
    const unavailable = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
      "win32",
      Object.freeze({
        open: (_name: string, flags: "r" | "r+" | "w") =>
          flags === "r" ? 1 : 2,
        close: (descriptor: number) => {
          validationClosedDescriptors.push(descriptor);
        },
        validate: validation,
      }),
      async () => {
        operationCount += 1;
        return "unexpected";
      },
    );
    assert.deepEqual(unavailable, { status: "unavailable", value: null });
    assert.equal(operationCount, 0);
    assert.deepEqual(validationClosedDescriptors, [1, 2]);
  }
});

test("Windows writerはwrite失敗とlistener cleanup不明を分離する", async () => {
  const outcome = await writeWindowsTerminalTextOutcomeUsingStream("value", {
    isTTY: true,
    destroyed: false,
    writable: true,
    once: () => undefined,
    removeListener: () => {
      throw new Error("fixture_listener_cleanup_failed");
    },
    write: (_value: string, callback: (error?: Error | null) => void) => {
      callback(null);
      return true;
    },
  });
  assert.deepEqual(outcome, { status: "cleanup_unknown" });

  let lateCallback: ((error?: Error | null) => void) | null = null;
  const lateEvents = new EventEmitter();
  const timedOut = await writeWindowsTerminalTextOutcomeUsingStream("value", {
    isTTY: true,
    destroyed: false,
    writable: true,
    once: (event, listener) => lateEvents.once(event, listener),
    removeListener: (event, listener) =>
      lateEvents.removeListener(event, listener),
    write: (_value: string, callback: (error?: Error | null) => void) => {
      lateCallback = callback;
      return true;
    },
  });
  assert.deepEqual(timedOut, { status: "cleanup_unknown" });
  assert.equal(lateEvents.listenerCount("error"), 1);
  assert.equal(typeof lateCallback, "function");
  (lateCallback as unknown as (error?: Error | null) => void)(null);
  assert.equal(lateEvents.listenerCount("error"), 1);
  lateEvents.emit("error", new Error("fixture_late_error"));
  assert.equal(lateEvents.listenerCount("error"), 0);
});

test("POSIX reader Profileは親環境を受けない固定空集合にする", () => {
  assert.deepEqual(createInteractiveConsoleReaderEnvironment("linux"), {});
});

test("Windows対話表示はUnicode TTYの完了へ結合しredirect時にFail Closedとなる", async () => {
  function scenario(isWindowsTerminal: boolean) {
    const terminalWrites: string[] = [];
    const descriptorWrites: Array<Readonly<[number, string]>> = [];
    return {
      terminalWrites,
      descriptorWrites,
      adapter: Object.freeze({
        isWindowsTerminal,
        writeWindowsTerminal: async (value: string) => {
          terminalWrites.push(value);
          return true;
        },
        writeDescriptor: (descriptor: number, value: string) => {
          descriptorWrites.push(Object.freeze([descriptor, value]));
        },
      }),
    };
  }

  const windows = scenario(true);
  assert.equal(
    await writeInteractiveConsoleTextUsingAdapter(
      "win32",
      12,
      "外部送信を確認",
      windows.adapter,
    ),
    true,
  );
  assert.deepEqual(windows.terminalWrites, ["外部送信を確認"]);
  assert.deepEqual(windows.descriptorWrites, []);

  const redirected = scenario(false);
  assert.equal(
    await writeInteractiveConsoleTextUsingAdapter(
      "win32",
      12,
      "外部送信を確認",
      redirected.adapter,
    ),
    false,
  );
  assert.deepEqual(redirected.terminalWrites, []);
  assert.deepEqual(redirected.descriptorWrites, []);

  const posix = scenario(false);
  assert.equal(
    await writeInteractiveConsoleTextUsingAdapter(
      "linux",
      12,
      "外部送信を確認",
      posix.adapter,
    ),
    true,
  );
  assert.deepEqual(posix.terminalWrites, []);
  assert.deepEqual(posix.descriptorWrites, [[12, "外部送信を確認"]]);

  const failed = scenario(true);
  const failingAdapter = Object.freeze({
    ...failed.adapter,
    writeWindowsTerminal: async () => {
      throw new Error("write failed");
    },
  });
  assert.equal(
    await writeInteractiveConsoleTextUsingAdapter(
      "win32",
      12,
      "外部送信を確認",
      failingAdapter,
    ),
    false,
  );

  let completeWrite: ((isSuccessful: boolean) => void) | null = null;
  const deferredAdapter = Object.freeze({
    ...scenario(true).adapter,
    writeWindowsTerminal: () =>
      new Promise<boolean>((resolve) => {
        completeWrite = resolve;
      }),
  });
  const pendingWrite = writeInteractiveConsoleTextUsingAdapter(
    "win32",
    12,
    "外部送信を確認",
    deferredAdapter,
  );
  let isWriteCompleted = false;
  void pendingWrite.then(() => {
    isWriteCompleted = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(isWriteCompleted, false);
  resolveDeferredBoolean(completeWrite, true);
  assert.equal(await pendingWrite, true);
});

test("Windows TTY writeのcallback・stream error・backpressureを一度だけ完了させる", async () => {
  function streamScenario(
    outcome: "success" | "callback_error" | "stream_error" | "throw",
    isTTY = true,
  ) {
    let errorListener: (() => void) | null = null;
    let removeCount = 0;
    const values: string[] = [];
    const stream = Object.freeze({
      isTTY,
      destroyed: false,
      writable: true,
      once: (_event: "error", listener: () => void) => {
        errorListener = listener;
      },
      removeListener: (_event: "error", listener: () => void) => {
        if (errorListener === listener) errorListener = null;
        removeCount += 1;
      },
      write: (value: string, callback: (error?: Error | null) => void) => {
        values.push(value);
        if (outcome === "throw") throw new Error("write failed");
        setImmediate(() => {
          if (outcome === "stream_error") errorListener?.();
          else {
            callback(
              outcome === "callback_error"
                ? new Error("callback failed")
                : null,
            );
            if (outcome === "callback_error") {
              queueMicrotask(() => errorListener?.());
            }
          }
        });
        return false;
      },
    });
    return {
      stream,
      values,
      removeCount: () => removeCount,
      errorListener: () => errorListener,
    };
  }

  for (const [outcome, isExpected] of [
    ["success", true],
    ["callback_error", false],
    ["stream_error", false],
    ["throw", false],
  ] as const) {
    const scenario = streamScenario(outcome);
    assert.equal(
      await writeWindowsTerminalTextUsingStream(
        "外部送信を確認",
        scenario.stream,
      ),
      isExpected,
      outcome,
    );
    assert.deepEqual(scenario.values, ["外部送信を確認"]);
    assert.equal(scenario.removeCount(), 1);
    assert.equal(scenario.errorListener(), null);
  }

  const cleanupFailure = Object.freeze({
    isTTY: true,
    destroyed: false,
    writable: true,
    once: () => undefined,
    removeListener: () => {
      throw new Error("remove failed");
    },
    write: (_value: string, callback: (error?: Error | null) => void) => {
      setImmediate(() => callback(null));
      return true;
    },
  });
  assert.equal(
    await writeWindowsTerminalTextUsingStream("外部送信を確認", cleanupFailure),
    false,
  );

  const redirected = streamScenario("success", false);
  assert.equal(
    await writeWindowsTerminalTextUsingStream(
      "外部送信を確認",
      redirected.stream,
    ),
    false,
  );
  assert.deepEqual(redirected.values, []);

  const actualWritable = new Writable({
    write: (_chunk, _encoding, callback) => {
      callback(new Error("actual writable failure"));
    },
  });
  Object.defineProperty(actualWritable, "isTTY", { value: true });
  assert.equal(
    await writeWindowsTerminalTextUsingStream(
      "外部送信を確認",
      actualWritable as unknown as Parameters<
        typeof writeWindowsTerminalTextUsingStream
      >[1],
    ),
    false,
  );
  assert.equal(actualWritable.listenerCount("error"), 0);
});

test("検証済みTTY入力は完了・取消・errorをlistener残存なしへ収束する", async () => {
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
    coordinatorRoot,
    "src",
    "core",
    "interactive-console-reader.ts",
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

test("Windows内部子Processの実Environmentは用途別固定集合へ閉じる", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  for (const [kind, environment] of [
    ["console", createWindowsNodeConsoleReaderEnvironment()],
    ["native", createWindowsNativeHelperEnvironment()],
  ] as const) {
    assert.ok(environment);
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify({keys:Object.keys(process.env).sort(),neutral:Object.entries(process.env).filter(([k])=>!['SYSTEMROOT','WINDIR','USERPROFILE'].includes(k.toUpperCase())).every(([,v])=>v===''),systemRoot:process.env.SystemRoot,windir:process.env.WINDIR,userProfile:process.env.USERPROFILE}))",
      ],
      {
        shell: false,
        env: environment,
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.neutral, true);
    assert.equal(typeof observed.systemRoot, "string");
    assert.equal(observed.systemRoot.length > 0, true);
    assert.equal(observed.windir, observed.systemRoot);
    assert.equal(
      observed.userProfile,
      kind === "native" ? path.win32.normalize(os.userInfo().homedir) : "",
    );
    assert.equal(
      observed.keys.includes("SystemRoot") ||
        observed.keys.includes("SYSTEMROOT"),
      true,
    );
  }
  const dockerEnvironment = createWindowsDockerCliEnvironment({
    dockerConfig: "C:\\runtime-owned\\docker-config",
    dockerHome: "C:\\runtime-owned\\docker-home",
  });
  assert.ok(dockerEnvironment);
  const dockerResult = spawnSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(JSON.stringify({keys:Object.keys(process.env).sort(),pathNeutral:process.env.PATH==='',proxyNeutral:process.env.HTTPS_PROXY==='',homeOwned:process.env.HOME==='C:\\\\runtime-owned\\\\docker-home',configOwned:process.env.DOCKER_CONFIG==='C:\\\\runtime-owned\\\\docker-config',systemRoot:process.env.SystemRoot,windir:process.env.WINDIR}))",
    ],
    {
      shell: false,
      env: dockerEnvironment,
      encoding: "utf8",
      timeout: 5_000,
    },
  );
  assert.equal(dockerResult.status, 0, dockerResult.stderr);
  const observedDocker = JSON.parse(dockerResult.stdout);
  assert.equal(observedDocker.pathNeutral, true);
  assert.equal(observedDocker.proxyNeutral, true);
  assert.equal(observedDocker.homeOwned, true);
  assert.equal(observedDocker.configOwned, true);
  assert.equal(observedDocker.systemRoot, observedDocker.windir);
  assert.equal(typeof observedDocker.systemRoot, "string");
});

test("Windows directoryの親環境差替えを子Environment Authorityにしない", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-fake-windows-"));
  const system32 = path.join(root, "System32");
  fs.mkdirSync(system32);
  fs.copyFileSync(
    path.join(String(process.env.SystemRoot), "System32", "kernel32.dll"),
    path.join(system32, "kernel32.dll"),
  );
  const originalSystemRoot = process.env.SystemRoot;
  const originalWindir = process.env.WINDIR;
  const originalUserProfile = process.env.USERPROFILE;
  try {
    process.env.SystemRoot = root;
    process.env.WINDIR = root;
    process.env.USERPROFILE = root;
    const consoleEnvironment = createWindowsNodeConsoleReaderEnvironment();
    const nativeEnvironment = createWindowsNativeHelperEnvironment();
    assert.ok(consoleEnvironment);
    assert.ok(nativeEnvironment);
    const consoleValues = consoleEnvironment as Readonly<
      Record<string, string>
    >;
    const nativeValues = nativeEnvironment as Readonly<Record<string, string>>;
    assert.equal(consoleValues.SystemRoot, originalSystemRoot);
    assert.equal(consoleValues.WINDIR, originalSystemRoot);
    assert.equal(consoleValues.USERPROFILE, "");
    assert.equal(nativeValues.SystemRoot, originalSystemRoot);
    assert.equal(nativeValues.WINDIR, originalSystemRoot);
    assert.equal(
      nativeValues.USERPROFILE,
      path.win32.normalize(os.userInfo().homedir),
    );
    assert.notEqual(
      nativeValues.USERPROFILE.toLocaleLowerCase("en-US"),
      root.toLocaleLowerCase("en-US"),
    );
    const result = spawnSync(
      process.execPath,
      ["-e", "process.stdout.write(String(process.env.SystemRoot))"],
      {
        shell: false,
        env: consoleEnvironment,
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(
      result.stdout.toLocaleLowerCase("en-US"),
      root.toLocaleLowerCase("en-US"),
    );
  } finally {
    if (originalSystemRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = originalSystemRoot;
    if (originalWindir === undefined) delete process.env.WINDIR;
    else process.env.WINDIR = originalWindir;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    fs.rmSync(path.join(system32, "kernel32.dll"));
    fs.rmdirSync(system32);
    fs.rmdirSync(root);
  }
});

test("Windows実Console descriptorの取消は固定reader終了後に戻る", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync("\\\\.\\CONIN$", "r");
    if (!tty.isatty(descriptor)) {
      context.skip("interactive console unavailable");
      return;
    }
    const controller = new AbortController();
    const startedAt = performance.now();
    const pending = readInteractiveConsoleLine(descriptor, controller.signal);
    setTimeout(() => controller.abort(), 50);
    assert.equal(await pending, null);
    assert.ok(performance.now() - startedAt < 3_000);
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
});

test("Windows実ProcessでTask stdin pipeと固定Console readerを分離する", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  let outputDescriptor: number | null = null;
  try {
    outputDescriptor = fs.openSync("\\\\.\\CONOUT$", "r+");
  } catch {
    context.skip("Windows interactive console unavailable");
    return;
  }
  try {
    assert.equal(tty.isatty(outputDescriptor), true);
    const moduleUrl = pathToFileURL(
      path.join(coordinatorRoot, "src", "core", "interactive-console.ts"),
    ).href;
    const taskBytes = Buffer.from('{"task":"transport-only"}\n', "utf8");
    const inlineScript = `
    import fs from "node:fs";
    const { readInteractiveConsoleLine } = await import(process.argv[1]);
    const descriptor = fs.openSync(${JSON.stringify("\\\\.\\CONIN$")}, "r");
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);
      const line = await readInteractiveConsoleLine(descriptor, controller.signal);
      const task = fs.readFileSync(0);
      if (line !== null || !task.equals(Buffer.from(${JSON.stringify(taskBytes.toString("base64"))}, "base64"))) process.exitCode = 3;
    } finally {
      fs.closeSync(descriptor);
    }
  `;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", inlineScript, moduleUrl],
      {
        shell: false,
        cwd: coordinatorRoot,
        env: {},
        input: taskBytes,
        stdio: ["pipe", outputDescriptor, "pipe"],
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  } finally {
    fs.closeSync(outputDescriptor);
  }
});

test("Windows固定readerは親Process消失時に終了しLockを次回へ返す", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  let probeDescriptor: number | null = null;
  try {
    probeDescriptor = fs.openSync("\\\\.\\CONIN$", "r");
    if (!tty.isatty(probeDescriptor)) {
      context.skip("interactive console unavailable");
      return;
    }
  } catch {
    context.skip("interactive console unavailable");
    return;
  } finally {
    if (probeDescriptor !== null) fs.closeSync(probeDescriptor);
  }
  const fixture = path.join(
    coordinatorRoot,
    "tests",
    "fixtures",
    "interactive-console-parent.ts",
  );
  const parent = spawn(process.execPath, [fixture], {
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.ok(parent.stdout);
  const firstLine = await new Promise<string>((resolve, reject) => {
    let buffered = "";
    const timeout = setTimeout(
      () => reject(new Error("reader_parent_fixture_timeout")),
      5_000,
    );
    parent.once("error", reject);
    parent.stdout?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("utf8");
      const lineEnd = buffered.indexOf("\n");
      if (lineEnd >= 0) {
        clearTimeout(timeout);
        resolve(buffered.slice(0, lineEnd));
      }
    });
  });
  const readerPid = Number(JSON.parse(firstLine).readerPid);
  assert.equal(Number.isSafeInteger(readerPid) && readerPid > 0, true);
  assert.equal(parent.kill("SIGKILL"), true);
  await new Promise<void>((resolve) => parent.once("close", () => resolve()));
  const deadline = performance.now() + 5_000;
  let readerExists = true;
  while (performance.now() < deadline) {
    try {
      process.kill(readerPid, 0);
    } catch {
      readerExists = false;
      break;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(readerExists, false);
  const lockOutcome =
    await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  assert.equal(lockOutcome.status, "acquired");
  assert.ok(lockOutcome.lock);
  const descriptor = fs.openSync("\\\\.\\CONIN$", "r");
  try {
    const controller = new AbortController();
    const pending = readInteractiveConsoleLine(descriptor, controller.signal);
    setTimeout(() => controller.abort(), 50);
    assert.equal(await pending, null);
  } finally {
    fs.closeSync(descriptor);
    assert.equal(await lockOutcome.lock.release(), "released");
  }
});

test("固定reader親はProcess順序・取消・timeout・cleanupを同じ状態機械で閉じる", async () => {
  function readerProcessScenario(isKillSuccessful = true) {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      connected: boolean;
      send: (message: unknown) => boolean;
      kill: (signal: string) => boolean;
      disconnect: () => void;
    };
    child.stdout = new EventEmitter();
    child.connected = true;
    const messages: unknown[] = [];
    const killSignals: string[] = [];
    child.send = (message) => {
      messages.push(message);
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
    const spawnRecords: unknown[][] = [];
    const adapter = Object.freeze({
      isTty: () => true,
      spawn: (...args: unknown[]) => {
        spawnRecords.push(args);
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
    return { child, messages, killSignals, timers, spawnRecords, adapter };
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
    assert.equal(scenario.spawnRecords.length, 1);
    const [executable, argv, options] = scenario.spawnRecords[0] ?? [];
    assert.equal(executable, process.execPath);
    assert.equal(Array.isArray(argv), true);
    assert.equal((argv as unknown[]).length, 1);
    assert.match(
      String((argv as unknown[])[0]),
      /interactive-console-reader\.ts$/u,
    );
    const spawnOptions = options as Readonly<Record<string, unknown>>;
    const { env, ...optionsWithoutEnvironment } = spawnOptions;
    assert.deepEqual(optionsWithoutEnvironment, {
      shell: false,
      detached: false,
      windowsHide: true,
      cwd: path.dirname(String((argv as unknown[])[0])),
      stdio: [17, "pipe", "ignore", "ipc"],
    });
    assert.equal((env as Record<string, string>).PATH, "");
    assert.equal((env as Record<string, string>).USERPROFILE, "");
    assert.equal(
      (env as Record<string, string>).SystemRoot,
      process.env.SystemRoot,
    );
    assert.equal(
      (env as Record<string, string>).WINDIR,
      process.env.SystemRoot,
    );

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

test("対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じる", async () => {
  function scenario(
    options: { failOpenAt?: number; failClose?: ReadonlySet<number> } = {},
  ) {
    const deviceOpenRecords: Array<Readonly<[string, "r" | "r+" | "w"]>> = [];
    const closedDescriptors: number[] = [];
    return {
      deviceOpenRecords,
      closedDescriptors,
      adapter: Object.freeze({
        open: (device: string, flags: "r" | "r+" | "w") => {
          deviceOpenRecords.push(Object.freeze([device, flags]));
          if (deviceOpenRecords.length === options.failOpenAt) {
            throw new Error("open failed");
          }
          return 10 + deviceOpenRecords.length;
        },
        close: (descriptor: number) => {
          closedDescriptors.push(descriptor);
          if (options.failClose?.has(descriptor)) {
            throw new Error("close failed");
          }
        },
      }),
    };
  }

  const windows = scenario();
  assert.deepEqual(
    withInteractiveConsoleUsingAdapter(
      "win32",
      windows.adapter,
      (handles) => handles,
    ),
    { input: 11, output: 12 },
  );
  assert.deepEqual(windows.deviceOpenRecords, [
    ["\\\\.\\CONIN$", "r"],
    ["\\\\.\\CONOUT$", "r+"],
  ]);
  assert.deepEqual(windows.closedDescriptors, [11, 12]);

  const posix = scenario();
  assert.equal(
    withInteractiveConsoleUsingAdapter("linux", posix.adapter, () => true),
    true,
  );
  assert.deepEqual(posix.deviceOpenRecords, [
    ["/dev/tty", "r"],
    ["/dev/tty", "w"],
  ]);
  assert.deepEqual(posix.closedDescriptors, [11, 12]);

  const windowsAsync = scenario();
  assert.deepEqual(
    await withInteractiveConsoleAsyncOutcomeUsingAdapter(
      "win32",
      windowsAsync.adapter,
      async () => "completed",
    ),
    { status: "completed", value: "completed" },
  );
  assert.deepEqual(windowsAsync.deviceOpenRecords, [
    ["\\\\.\\CONIN$", "r"],
    ["\\\\.\\CONOUT$", "r+"],
  ]);
  assert.deepEqual(windowsAsync.closedDescriptors, [11, 12]);

  const posixAsync = scenario();
  assert.deepEqual(
    await withInteractiveConsoleAsyncOutcomeUsingAdapter(
      "linux",
      posixAsync.adapter,
      async () => "completed",
    ),
    { status: "completed", value: "completed" },
  );
  assert.deepEqual(posixAsync.deviceOpenRecords, [
    ["/dev/tty", "r"],
    ["/dev/tty", "w"],
  ]);
  assert.deepEqual(posixAsync.closedDescriptors, [11, 12]);

  const inputOpenFailure = scenario({ failOpenAt: 1 });
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      inputOpenFailure.adapter,
      () => true,
    ),
    null,
  );
  assert.deepEqual(inputOpenFailure.closedDescriptors, []);

  const outputOpenFailure = scenario({ failOpenAt: 2 });
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      outputOpenFailure.adapter,
      () => true,
    ),
    null,
  );
  assert.deepEqual(outputOpenFailure.closedDescriptors, [11]);

  const operationFailure = scenario();
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      operationFailure.adapter,
      () => {
        throw new Error("operation failed");
      },
    ),
    null,
  );
  assert.deepEqual(operationFailure.closedDescriptors, [11, 12]);

  const validationFailure = scenario();
  let operationCalls = 0;
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      Object.freeze({
        ...validationFailure.adapter,
        validate: () => false,
      }),
      () => {
        operationCalls += 1;
        return true;
      },
    ),
    null,
  );
  assert.equal(operationCalls, 0);
  assert.deepEqual(validationFailure.closedDescriptors, [11, 12]);

  const validationOutcome = scenario();
  assert.deepEqual(
    withInteractiveConsoleOutcomeUsingAdapter(
      "win32",
      Object.freeze({
        ...validationOutcome.adapter,
        validate: () => false,
      }),
      () => true,
    ),
    { status: "unavailable", value: null },
  );
  assert.deepEqual(validationOutcome.closedDescriptors, [11, 12]);

  for (const failedDescriptor of [11, 12]) {
    const closeFailure = scenario({
      failClose: new Set([failedDescriptor]),
    });
    assert.equal(
      withInteractiveConsoleUsingAdapter(
        "win32",
        closeFailure.adapter,
        () => true,
      ),
      null,
    );
    assert.deepEqual(closeFailure.closedDescriptors, [11, 12]);
    const structuredCloseFailure = scenario({
      failClose: new Set([failedDescriptor]),
    });
    assert.deepEqual(
      withInteractiveConsoleOutcomeUsingAdapter(
        "win32",
        structuredCloseFailure.adapter,
        () => true,
      ),
      { status: "cleanup_unknown", value: true },
    );
    assert.deepEqual(structuredCloseFailure.closedDescriptors, [11, 12]);
  }
});

test("非同期対話処理が完了するまで両OS deviceを保持してから回収する", async () => {
  const closedDescriptors: number[] = [];
  let completeOperation: ((isSuccessful: boolean) => void) | null = null;
  const adapter = Object.freeze({
    open: (device: string) => (device.endsWith("CONIN$") ? 11 : 12),
    close: (descriptor: number) => {
      closedDescriptors.push(descriptor);
    },
  });
  const pendingOperation = withInteractiveConsoleAsyncUsingAdapter(
    "win32",
    adapter,
    () =>
      new Promise<boolean>((resolve) => {
        completeOperation = resolve;
      }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(closedDescriptors, []);
  resolveDeferredBoolean(completeOperation, true);
  assert.equal(await pendingOperation, true);
  assert.deepEqual(closedDescriptors, [11, 12]);

  closedDescriptors.length = 0;
  assert.equal(
    await withInteractiveConsoleAsyncUsingAdapter(
      "win32",
      adapter,
      async () => {
        throw new Error("operation failed");
      },
    ),
    null,
  );
  assert.deepEqual(closedDescriptors, [11, 12]);

  const closeFailureClosedDescriptors: number[] = [];
  const closeFailureAdapter = Object.freeze({
    ...adapter,
    close: (descriptor: number) => {
      closeFailureClosedDescriptors.push(descriptor);
      if (descriptor === 11) throw new Error("close failed");
    },
  });
  assert.equal(
    await withInteractiveConsoleAsyncUsingAdapter(
      "win32",
      closeFailureAdapter,
      async () => true,
    ),
    null,
  );
  assert.deepEqual(closeFailureClosedDescriptors, [11, 12]);
});

test("Executable sourceとpackage commandへShell依存のJSON搬送を再導入しない", () => {
  const forbiddenPatterns = [
    /StandardInputEncoding/u,
    /Start-Process/u,
    /ConvertTo-Json/u,
    /shell\s*:\s*true/u,
  ];
  for (const directory of ["bin", "scripts", "src"]) {
    for (const file of sourceFiles(path.join(coordinatorRoot, directory))) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        assert.equal(pattern.test(source), false, `${file}: ${pattern.source}`);
      }
    }
  }

  const packageDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  ) as { engines?: { node?: string }; scripts?: Record<string, string> };
  assert.equal(
    packageDocument.engines?.node,
    `>=${MINIMUM_COORDINATOR_NODE_VERSION}`,
  );
  const lockDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package-lock.json"), "utf8"),
  ) as { packages?: { ""?: { engines?: { node?: string } } } };
  assert.equal(
    lockDocument.packages?.[""]?.engines?.node,
    packageDocument.engines?.node,
  );
  for (const [name, command] of Object.entries(packageDocument.scripts ?? {})) {
    assert.equal(
      /powershell|pwsh|cmd(?:\.exe)?\s+\/c/iu.test(command),
      false,
      name,
    );
  }
  assert.equal(packageDocument.scripts?.["release-key:generate"], undefined);
  assert.equal(packageDocument.scripts?.["release-manifest:sign"], undefined);
  assert.equal(packageDocument.scripts?.doctor, undefined);

  for (const relative of [
    "scripts/sign-release-manifest.ts",
    "src/core/doctor.ts",
  ]) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.equal(
      /(?:execFile|spawn)Sync\(\s*["']git["']/u.test(source),
      false,
      relative,
    );
  }

  const productionChildProcessOwners = sourceFiles(
    path.join(coordinatorRoot, "src"),
  )
    .filter((file) =>
      fs.readFileSync(file, "utf8").includes('from "node:child_process"'),
    )
    .map((file) => path.relative(coordinatorRoot, file).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(productionChildProcessOwners, [
    "src/core/interactive-console.ts",
    "src/security/candidate-store-windows-adapter.ts",
    "src/security/docker-effect-runtime.ts",
    "src/security/docker-isolation.ts",
    "src/security/docker-recovery-runtime-internal.ts",
    "src/security/provider-home-windows-adapter.ts",
  ]);

  for (const directory of ["bin", "scripts", "src"]) {
    for (const file of sourceFiles(path.join(coordinatorRoot, directory))) {
      const source = fs.readFileSync(file, "utf8");
      assert.equal(
        /(?:execFile|spawn)(?:Sync)?\(\s*["']git["']/u.test(source),
        false,
        file,
      );
    }
  }
});

test("Node版GateはPATHをAuthorityにせずEffect前に停止する", () => {
  assert.deepEqual(describeCoordinatorNodeRuntimeVersionContract(), {
    contract: "crdd-coordinator/node-runtime-version",
    contractRevision: 1,
    minimumVersion: "24.12.0",
    checkTiming: "before_interactive_input_release_verification_or_effect",
    pathLookupAuthority: false,
    unsupportedRuntimeFallbackAllowed: false,
  });

  const guardedEntrypoints = [
    "bin/coordinator.ts",
    "scripts/generate-release-key.ts",
    "scripts/sign-release-manifest.ts",
    "scripts/verify-signed-general-task.ts",
  ];
  for (const relative of guardedEntrypoints) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.match(source, /CoordinatorNodeRuntime/u, relative);
  }

  const readme = fs.readFileSync(
    path.join(coordinatorRoot, "README.md"),
    "utf8",
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\tools\\coordinator\\scripts\\generate-release-key\.ts"/u,
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\tools\\coordinator\\scripts\\sign-release-manifest\.ts"/u,
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\tools\\coordinator\\bin\\coordinator\.ts" doctor/u,
  );
  assert.equal(readme.includes("$CRDD_NODE"), false);
  assert.equal(readme.includes("$CRDD_COORDINATOR"), false);
  assert.equal(
    /<absolute-preverified-node-24\.12\+-executable> tools\/coordinator\/scripts\/(?:generate-release-key|sign-release-manifest)\.ts/u.test(
      readme,
    ),
    false,
  );
  assert.match(readme, /--runtime-root "<absolute-path>"/u);
  assert.match(
    readme,
    /"<signed-distribution-root>\\tools\\coordinator\\scripts\\verify-signed-general-task\.ts"/u,
  );
  assert.match(readme, /--distribution-root "<absolute-staging-root>"/u);
  assert.match(
    readme,
    /--private-key "C:\\project\\key\\CRDD\\crdd-release-v1-private\.pem"/u,
  );
  assert.equal(
    /```powershell\r?\n& <absolute-preverified-node/u.test(readme),
    false,
  );

  const keyGeneratorSource = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "generate-release-key.ts"),
    "utf8",
  );
  assert.match(
    keyGeneratorSource,
    /usage: & "<absolute-preverified-node-24\.12\+-executable>"/u,
  );
});
