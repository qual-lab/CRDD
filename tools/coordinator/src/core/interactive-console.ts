import fs from "node:fs";

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 5;

type InteractiveConsoleHandles = Readonly<{
  input: number;
  output: number;
}>;

type InteractiveConsoleAdapter = Readonly<{
  open: (path: string, flags: "r" | "w") => number;
  close: (descriptor: number) => void;
}>;

type InteractiveConsoleTextAdapter = Readonly<{
  isWindowsTerminal: boolean;
  writeWindowsTerminal: (value: string) => Promise<boolean>;
  writeDescriptor: (descriptor: number, value: string) => void;
}>;

type WindowsTerminalStream = Readonly<{
  isTTY?: boolean;
  destroyed: boolean;
  writable: boolean;
  once: (event: "error", listener: () => void) => unknown;
  removeListener: (event: "error", listener: () => void) => unknown;
  write: (value: string, callback: (error?: Error | null) => void) => boolean;
}>;

type TerminalInputStream = Readonly<{
  isTTY?: boolean;
  destroyed: boolean;
  readable: boolean;
  readableEncoding: BufferEncoding | null;
  readableFlowing: boolean | null;
  listenerCount: (event: "data") => number;
  on: (event: "data", listener: (chunk: Buffer | string) => void) => unknown;
  once: (event: "error" | "end", listener: (error?: Error) => void) => unknown;
  removeListener: (
    event: "data" | "error" | "end",
    listener: ((chunk: Buffer | string) => void) | ((error?: Error) => void),
  ) => unknown;
  pause: () => unknown;
  resume: () => unknown;
}>;

export function withInteractiveConsoleUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  const names =
    platform === "win32"
      ? Object.freeze({ input: "\\\\.\\CONIN$", output: "\\\\.\\CONOUT$" })
      : Object.freeze({ input: "/dev/tty", output: "/dev/tty" });
  let input: number | null = null;
  let output: number | null = null;
  let result: Readonly<{ value: T }> | null = null;
  try {
    input = adapter.open(names.input, "r");
    output = adapter.open(names.output, "w");
    result = Object.freeze({
      value: operation(Object.freeze({ input, output })),
    });
  } catch {
    result = null;
  }
  let isCleanupSuccessful = true;
  if (input !== null) {
    try {
      adapter.close(input);
    } catch {
      isCleanupSuccessful = false;
    }
  }
  if (output !== null) {
    try {
      adapter.close(output);
    } catch {
      isCleanupSuccessful = false;
    }
  }
  return isCleanupSuccessful && result ? result.value : null;
}

export function withInteractiveConsole<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  return withInteractiveConsoleUsingAdapter(
    process.platform,
    Object.freeze({ open: fs.openSync, close: fs.closeSync }),
    operation,
  );
}

export async function withInteractiveConsoleAsyncUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: InteractiveConsoleHandles) => Promise<T>,
): Promise<T | null> {
  const names =
    platform === "win32"
      ? Object.freeze({ input: "\\\\.\\CONIN$", output: "\\\\.\\CONOUT$" })
      : Object.freeze({ input: "/dev/tty", output: "/dev/tty" });
  let input: number | null = null;
  let output: number | null = null;
  let result: Readonly<{ value: T }> | null = null;
  try {
    input = adapter.open(names.input, "r");
    output = adapter.open(names.output, "w");
    result = Object.freeze({
      value: await operation(Object.freeze({ input, output })),
    });
  } catch {
    result = null;
  }
  let isCleanupSuccessful = true;
  if (input !== null) {
    try {
      adapter.close(input);
    } catch {
      isCleanupSuccessful = false;
    }
  }
  if (output !== null) {
    try {
      adapter.close(output);
    } catch {
      isCleanupSuccessful = false;
    }
  }
  return isCleanupSuccessful && result ? result.value : null;
}

export function withInteractiveConsoleAsync<T>(
  operation: (handles: InteractiveConsoleHandles) => Promise<T>,
) {
  return withInteractiveConsoleAsyncUsingAdapter(
    process.platform,
    Object.freeze({ open: fs.openSync, close: fs.closeSync }),
    operation,
  );
}

export async function writeInteractiveConsoleTextUsingAdapter(
  platform: NodeJS.Platform,
  outputDescriptor: number,
  value: string,
  adapter: InteractiveConsoleTextAdapter,
) {
  try {
    if (platform === "win32") {
      if (!adapter.isWindowsTerminal) return false;
      return (await adapter.writeWindowsTerminal(value)) === true;
    } else {
      adapter.writeDescriptor(outputDescriptor, value);
    }
    return true;
  } catch {
    return false;
  }
}

export function writeWindowsTerminalTextUsingStream(
  value: string,
  stream: WindowsTerminalStream,
): Promise<boolean> {
  if (stream.isTTY !== true || stream.destroyed || !stream.writable) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let isSettled = false;
    let deferredCompletion: NodeJS.Immediate | null = null;
    const settle = (isSuccessful: boolean) => {
      if (isSettled) return;
      isSettled = true;
      if (deferredCompletion) clearImmediate(deferredCompletion);
      stream.removeListener("error", onError);
      resolve(isSuccessful);
    };
    const deferSettlement = (isSuccessful: boolean) => {
      if (isSettled || deferredCompletion) return;
      deferredCompletion = setImmediate(() => settle(isSuccessful));
    };
    const onError = () => settle(false);
    stream.once("error", onError);
    try {
      stream.write(value, (error) => deferSettlement(!error));
    } catch {
      deferSettlement(false);
    }
  });
}

export function readTerminalLineUsingStream(
  stream: TerminalInputStream,
  cancellationSignal: AbortSignal,
): Promise<string | null> {
  if (
    stream.isTTY !== true ||
    stream.destroyed ||
    !stream.readable ||
    stream.readableEncoding !== null ||
    stream.readableFlowing === true ||
    stream.listenerCount("data") !== 0 ||
    cancellationSignal.aborted
  ) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let isSettled = false;
    let isPaused = false;
    let deferredCompletion: NodeJS.Immediate | null = null;
    const bytes: number[] = [];
    const removeListenerSafely = (
      event: "data" | "error" | "end",
      listener: ((chunk: Buffer | string) => void) | ((error?: Error) => void),
    ) => {
      try {
        stream.removeListener(event, listener);
      } catch {
        // Settlement remains fail closed even if the stream is already broken.
      }
    };
    const settle = (line: string | null) => {
      if (isSettled) return;
      isSettled = true;
      if (deferredCompletion) clearImmediate(deferredCompletion);
      removeListenerSafely("data", onData);
      removeListenerSafely("error", onFailure);
      removeListenerSafely("end", onFailure);
      try {
        cancellationSignal.removeEventListener("abort", onFailure);
      } catch {
        line = null;
      }
      try {
        if (!isPaused) stream.pause();
        resolve(line);
      } catch {
        resolve(null);
      }
    };
    const deferSuccessfulSettlement = (line: string) => {
      if (isSettled || deferredCompletion) return;
      try {
        stream.pause();
        isPaused = true;
      } catch {
        settle(null);
        return;
      }
      deferredCompletion = setImmediate(() => settle(line));
    };
    const onFailure = () => settle(null);
    const onData = (chunk: Buffer | string) => {
      if (deferredCompletion) return;
      if (!Buffer.isBuffer(chunk)) {
        settle(null);
        return;
      }
      for (const value of chunk) {
        if (value === 0x0a) {
          deferSuccessfulSettlement(Buffer.from(bytes).toString("utf8"));
          return;
        }
        if (value !== 0x0d) bytes.push(value);
        if (bytes.length > 64) {
          settle(null);
          return;
        }
      }
    };
    try {
      stream.on("data", onData);
      if (isSettled) return;
      stream.once("error", onFailure);
      if (isSettled) return;
      stream.once("end", onFailure);
      if (isSettled) return;
      cancellationSignal.addEventListener("abort", onFailure, { once: true });
    } catch {
      settle(null);
      return;
    }
    if (cancellationSignal.aborted) {
      settle(null);
      return;
    }
    try {
      stream.resume();
    } catch {
      settle(null);
    }
  });
}

export function readInteractiveConsoleLine(cancellationSignal: AbortSignal) {
  return readTerminalLineUsingStream(process.stdin, cancellationSignal);
}

function writeWindowsTerminalText(value: string) {
  return writeWindowsTerminalTextUsingStream(value, process.stdout);
}

export function writeInteractiveConsoleText(
  outputDescriptor: number,
  value: string,
) {
  return writeInteractiveConsoleTextUsingAdapter(
    process.platform,
    outputDescriptor,
    value,
    Object.freeze({
      isWindowsTerminal: process.stdout.isTTY === true,
      writeWindowsTerminal: writeWindowsTerminalText,
      writeDescriptor: (descriptor: number, text: string) => {
        fs.writeSync(descriptor, text, null, "utf8");
      },
    }),
  );
}

export function interactiveConsoleAvailable() {
  return withInteractiveConsole(() => true) === true;
}

export function describeInteractiveConsoleContract() {
  return Object.freeze({
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: INTERACTIVE_CONSOLE_CONTRACT_REVISION,
    windowsDevices: Object.freeze(["\\\\.\\CONIN$", "\\\\.\\CONOUT$"]),
    windowsUnicodeOutput: "node_unicode_tty_output_required",
    validatedTtyInput: "node_tty_input_required",
    windowsRedirectedOutput: "fail_closed",
    redirectedStandardInputAllowed: false,
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });
}
