import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import tty from "node:tty";
import { fileURLToPath } from "node:url";

import {
  INTERACTIVE_CONSOLE_READER_CONTRACT,
  INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
  readInteractiveConsoleLineFromStream,
} from "./interactive-console-reader.ts";

export { readInteractiveConsoleLineFromStream as readTerminalLineUsingStream };

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 6;

const readerEntrypoint = fileURLToPath(
  new URL("./interactive-console-reader.ts", import.meta.url),
);
const READER_MAXIMUM_OUTPUT_BYTES = 512;
const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 125_000;

type InteractiveConsoleHandles = Readonly<{
  input: number;
  output: number;
}>;

type InteractiveConsoleAdapter = Readonly<{
  open: (path: string, flags: "r" | "w") => number;
  close: (descriptor: number) => void;
  validate?: (handles: InteractiveConsoleHandles) => boolean;
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

type InteractiveConsoleReaderProcessAdapter = Readonly<{
  isTty: (descriptor: number) => boolean;
  spawn: typeof spawn;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
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
    if (adapter.validate && !adapter.validate({ input, output })) {
      throw new Error("interactive_console_validation_failed");
    }
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
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateInteractiveConsoleHandles,
    }),
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
    if (adapter.validate && !adapter.validate({ input, output })) {
      throw new Error("interactive_console_validation_failed");
    }
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
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateInteractiveConsoleHandles,
    }),
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
      let isCleanupSuccessful = true;
      try {
        stream.removeListener("error", onError);
      } catch {
        isCleanupSuccessful = false;
      }
      resolve(isSuccessful && isCleanupSuccessful);
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

function validateInteractiveConsoleHandles(handles: InteractiveConsoleHandles) {
  try {
    if (!tty.isatty(handles.input) || !tty.isatty(handles.output)) return false;
    return (
      process.platform !== "win32" ||
      (process.stdout.isTTY === true &&
        !process.stdout.destroyed &&
        process.stdout.writable)
    );
  } catch {
    return false;
  }
}

function parseReaderResult(source: Buffer) {
  if (
    source.byteLength === 0 ||
    source.byteLength > READER_MAXIMUM_OUTPUT_BYTES
  )
    return null;
  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(source);
    if (!text.endsWith("\n") || text.indexOf("\n") !== text.length - 1)
      return null;
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.join("\0") !==
      ["contract", "contractRevision", "line", "status"].sort().join("\0") ||
    record.contract !== INTERACTIVE_CONSOLE_READER_CONTRACT ||
    record.contractRevision !== INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION ||
    record.status !== "completed" ||
    typeof record.line !== "string" ||
    !/^[0-9]{6}$/u.test(record.line)
  ) {
    return null;
  }
  return record.line;
}

export function readInteractiveConsoleLineUsingAdapter(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
  adapter: InteractiveConsoleReaderProcessAdapter,
): Promise<string | null> {
  if (
    !Number.isSafeInteger(inputDescriptor) ||
    inputDescriptor < 0 ||
    cancellationSignal.aborted ||
    !adapter.isTty(inputDescriptor)
  ) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = adapter.spawn(process.execPath, [readerEntrypoint], {
        shell: false,
        detached: false,
        windowsHide: true,
        cwd: path.dirname(readerEntrypoint),
        env: Object.freeze({}),
        stdio: [inputDescriptor, "pipe", "ignore", "ipc"],
      });
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    let isInvalid = false;
    let isChildClosed = false;
    let childExitCode: number | null = null;
    let isOutputClosed = false;
    let outputBytes = 0;
    const outputBuffers: Buffer[] = [];
    let killTimer: NodeJS.Timeout | null = null;
    const timeout = adapter.setTimeout(() => requestStop(), READER_TIMEOUT_MS);
    const finish = () => {
      if (settled || !isChildClosed || !isOutputClosed) return;
      settled = true;
      adapter.clearTimeout(timeout);
      if (killTimer) adapter.clearTimeout(killTimer);
      try {
        child.removeListener("error", onFailure);
      } catch {
        isInvalid = true;
      }
      try {
        child.removeListener("close", onClose);
      } catch {
        isInvalid = true;
      }
      if (child.stdout) {
        try {
          child.stdout.removeListener("data", onData);
        } catch {
          isInvalid = true;
        }
        try {
          child.stdout.removeListener("error", onFailure);
        } catch {
          isInvalid = true;
        }
        try {
          child.stdout.removeListener("close", onOutputClose);
        } catch {
          isInvalid = true;
        }
      }
      try {
        cancellationSignal.removeEventListener("abort", requestStop);
      } catch {
        isInvalid = true;
      }
      try {
        if (child.connected) child.disconnect();
      } catch {
        isInvalid = true;
      }
      resolve(
        !isInvalid && childExitCode === 0 && !cancellationSignal.aborted
          ? parseReaderResult(Buffer.concat(outputBuffers, outputBytes))
          : null,
      );
    };
    const forceStop = () => {
      try {
        if (!child.kill("SIGKILL")) isInvalid = true;
      } catch {
        isInvalid = true;
      }
    };
    const requestStop = () => {
      isInvalid = true;
      try {
        if (child.connected) child.send("cancel");
      } catch {
        // The exact child is force-terminated below.
      }
      if (!killTimer) {
        killTimer = adapter.setTimeout(forceStop, READER_CANCEL_GRACE_MS);
      }
    };
    const onFailure = () => requestStop();
    const onData = (chunk: Buffer | string) => {
      if (!Buffer.isBuffer(chunk)) {
        requestStop();
        return;
      }
      outputBytes += chunk.byteLength;
      if (outputBytes > READER_MAXIMUM_OUTPUT_BYTES) {
        requestStop();
        return;
      }
      outputBuffers.push(Buffer.from(chunk));
    };
    const onClose = (code: number | null) => {
      isChildClosed = true;
      childExitCode = code;
      finish();
    };
    const onOutputClose = () => {
      isOutputClosed = true;
      finish();
    };
    try {
      child.once("error", onFailure);
      child.once("close", onClose);
      if (!child.stdout) {
        isOutputClosed = true;
        requestStop();
      } else {
        child.stdout.on("data", onData);
        child.stdout.once("error", onFailure);
        child.stdout.once("close", onOutputClose);
      }
      cancellationSignal.addEventListener("abort", requestStop, {
        once: true,
      });
      if (cancellationSignal.aborted) requestStop();
    } catch {
      requestStop();
    }
  });
}

export function readInteractiveConsoleLine(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
) {
  return readInteractiveConsoleLineUsingAdapter(
    inputDescriptor,
    cancellationSignal,
    Object.freeze({
      isTty: tty.isatty,
      spawn,
      setTimeout,
      clearTimeout,
    }),
  );
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
    validatedTtyInput: "exact_console_descriptor_child_tty_required",
    taskStandardInputRole: "structured_transport_only",
    readerEntrypoint: "fixed_runtime_owned_non_exported_module",
    readerArtifactIdentity: "signed_package_content_root_preflight",
    readerArguments: "fixed_empty",
    readerEnvironment: "empty_no_parent_environment_inheritance",
    readerStandardIo:
      "exact_console_input_bounded_stdout_discarded_stderr_private_ipc",
    readerCancellation: "ipc_then_exact_child_force_termination",
    readerCompletion:
      "exact_child_close_and_bounded_stdout_close_required_no_unknown_normal_return",
    windowsRedirectedOutput: "fail_closed",
    redirectedStandardInputAllowed: false,
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });
}
