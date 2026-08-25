import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";

import {
  describeInteractiveConsoleContract,
  INTERACTIVE_CONSOLE_CONTRACT,
  readTerminalLineUsingStream,
  withInteractiveConsoleAsyncUsingAdapter,
  withInteractiveConsoleUsingAdapter,
  writeInteractiveConsoleTextUsingAdapter,
  writeWindowsTerminalTextUsingStream,
} from "../src/core/interactive-console.ts";
import {
  describeCoordinatorNodeRuntimeVersionContract,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";

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
  assert.deepEqual(describeInteractiveConsoleContract(), {
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: 5,
    windowsDevices: ["\\\\.\\CONIN$", "\\\\.\\CONOUT$"],
    windowsUnicodeOutput: "node_unicode_tty_output_required",
    validatedTtyInput: "node_tty_input_required",
    windowsRedirectedOutput: "fail_closed",
    redirectedStandardInputAllowed: false,
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });

  const executableSources = ["bin", "scripts", "src"]
    .flatMap((directory) => sourceFiles(path.join(coordinatorRoot, directory)))
    .filter((file) => !file.endsWith("interactive-console.ts"));
  for (const file of executableSources) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/CONIN\$|CONOUT\$|\/dev\/tty/u.test(source), false, file);
  }
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
    scenario.emitter.emit("data", Buffer.from("123456\r\nignored", "utf8"));
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

  const actualInput = new PassThrough();
  Object.defineProperty(actualInput, "isTTY", { value: true });
  const actualLine = readTerminalLineUsingStream(
    actualInput as unknown as Parameters<typeof readTerminalLineUsingStream>[0],
    new AbortController().signal,
  );
  actualInput.write(Buffer.from("実入力\r\n", "utf8"));
  assert.equal(await actualLine, "実入力");
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

test("対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じる", () => {
  function scenario(
    options: { failOpenAt?: number; failClose?: ReadonlySet<number> } = {},
  ) {
    const deviceOpenRecords: Array<Readonly<[string, "r" | "w"]>> = [];
    const closedDescriptors: number[] = [];
    return {
      deviceOpenRecords,
      closedDescriptors,
      adapter: Object.freeze({
        open: (device: string, flags: "r" | "w") => {
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
    ["\\\\.\\CONOUT$", "w"],
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
