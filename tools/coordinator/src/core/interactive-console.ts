import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import tty from "node:tty";
import { fileURLToPath } from "node:url";

import {
  INTERACTIVE_CONSOLE_READER_CONTRACT,
  INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
  INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
  readInteractiveConsoleLineFromStream,
} from "./interactive-console-reader.ts";
import { createInteractiveConsoleReaderEnvironment } from "./windows-child-environment.ts";

export { readInteractiveConsoleLineFromStream as readTerminalLineUsingStream };

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 8;

const readerEntrypoint = fileURLToPath(
  new URL("./interactive-console-reader.ts", import.meta.url),
);
const READER_MAXIMUM_OUTPUT_BYTES = 512;
const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 110_000;
const READER_CLEANUP_SCHEDULING_MARGIN_MS = 5_000;
const TERMINAL_WRITE_TIMEOUT_MS = 1_000;

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
  writeWindowsTerminal: (
    value: string,
  ) => Promise<boolean | InteractiveConsoleTextWriteOutcome>;
  writeDescriptor: (descriptor: number, value: string) => void;
}>;

export type InteractiveConsoleTextWriteOutcome = Readonly<{
  status: "completed" | "write_failed" | "cleanup_unknown";
}>;

export type InteractiveConsoleOperationOutcome<T> = Readonly<{
  status: "completed" | "unavailable" | "operation_failed" | "cleanup_unknown";
  value: T | null;
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

export type InteractiveConsoleReadOutcome = Readonly<{
  status:
    | "completed"
    | "cancelled"
    | "timeout"
    | "reader_failed"
    | "cleanup_unknown";
  line: string | null;
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
  const outcome = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    platform,
    adapter,
    operation,
  );
  return outcome.status === "completed" ? outcome.value : null;
}

export async function withInteractiveConsoleAsyncOutcomeUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: InteractiveConsoleHandles) => Promise<T>,
): Promise<InteractiveConsoleOperationOutcome<T>> {
  const names =
    platform === "win32"
      ? Object.freeze({ input: "\\\\.\\CONIN$", output: "\\\\.\\CONOUT$" })
      : Object.freeze({ input: "/dev/tty", output: "/dev/tty" });
  let input: number | null = null;
  let output: number | null = null;
  let status: InteractiveConsoleOperationOutcome<T>["status"] = "unavailable";
  let value: T | null = null;
  try {
    input = adapter.open(names.input, "r");
    output = adapter.open(names.output, "w");
    if (adapter.validate && !adapter.validate({ input, output })) {
      throw new Error("interactive_console_validation_failed");
    }
    value = await operation(Object.freeze({ input, output }));
    status = "completed";
  } catch {
    status =
      input !== null && output !== null ? "operation_failed" : "unavailable";
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
  if (!isCleanupSuccessful) status = "cleanup_unknown";
  return Object.freeze({ status, value });
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

export function withInteractiveConsoleAsyncOutcome<T>(
  operation: (handles: InteractiveConsoleHandles) => Promise<T>,
) {
  return withInteractiveConsoleAsyncOutcomeUsingAdapter(
    process.platform,
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateInteractiveConsoleHandles,
    }),
    operation,
  );
}

export async function writeInteractiveConsoleTextOutcomeUsingAdapter(
  platform: NodeJS.Platform,
  outputDescriptor: number,
  value: string,
  adapter: InteractiveConsoleTextAdapter,
): Promise<InteractiveConsoleTextWriteOutcome> {
  try {
    if (platform === "win32") {
      if (!adapter.isWindowsTerminal)
        return Object.freeze({ status: "write_failed" });
      const result = await adapter.writeWindowsTerminal(value);
      return typeof result === "boolean"
        ? Object.freeze({ status: result ? "completed" : "write_failed" })
        : result;
    }
    adapter.writeDescriptor(outputDescriptor, value);
    return Object.freeze({ status: "completed" });
  } catch {
    return Object.freeze({ status: "write_failed" });
  }
}

export async function writeInteractiveConsoleTextUsingAdapter(
  platform: NodeJS.Platform,
  outputDescriptor: number,
  value: string,
  adapter: InteractiveConsoleTextAdapter,
) {
  const outcome = await writeInteractiveConsoleTextOutcomeUsingAdapter(
    platform,
    outputDescriptor,
    value,
    adapter,
  );
  return outcome.status === "completed";
}

export function writeWindowsTerminalTextOutcomeUsingStream(
  value: string,
  stream: WindowsTerminalStream,
): Promise<InteractiveConsoleTextWriteOutcome> {
  if (stream.isTTY !== true || stream.destroyed || !stream.writable) {
    return Promise.resolve(Object.freeze({ status: "write_failed" }));
  }
  return new Promise((resolve) => {
    let isSettled = false;
    let deferredCompletion: NodeJS.Immediate | null = null;
    const timeout = setTimeout(
      () => settle("write_failed"),
      TERMINAL_WRITE_TIMEOUT_MS,
    );
    timeout.unref();
    const settle = (status: InteractiveConsoleTextWriteOutcome["status"]) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      if (deferredCompletion) clearImmediate(deferredCompletion);
      try {
        stream.removeListener("error", onError);
      } catch {
        status = "cleanup_unknown";
      }
      resolve(Object.freeze({ status }));
    };
    const deferSettlement = (
      status: InteractiveConsoleTextWriteOutcome["status"],
    ) => {
      if (isSettled || deferredCompletion) return;
      deferredCompletion = setImmediate(() => settle(status));
    };
    const onError = () => settle("write_failed");
    stream.once("error", onError);
    try {
      stream.write(value, (error) =>
        deferSettlement(error ? "write_failed" : "completed"),
      );
    } catch {
      deferSettlement("write_failed");
    }
  });
}

export async function writeWindowsTerminalTextUsingStream(
  value: string,
  stream: WindowsTerminalStream,
) {
  const outcome = await writeWindowsTerminalTextOutcomeUsingStream(
    value,
    stream,
  );
  return outcome.status === "completed";
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

export function readInteractiveConsoleLineOutcomeUsingAdapter(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
  adapter: InteractiveConsoleReaderProcessAdapter,
): Promise<InteractiveConsoleReadOutcome> {
  if (
    !Number.isSafeInteger(inputDescriptor) ||
    inputDescriptor < 0 ||
    cancellationSignal.aborted ||
    !adapter.isTty(inputDescriptor)
  ) {
    return Promise.resolve(
      Object.freeze({
        status: cancellationSignal.aborted ? "cancelled" : "reader_failed",
        line: null,
      }),
    );
  }
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      const environment = createInteractiveConsoleReaderEnvironment();
      if (!environment) {
        resolve(Object.freeze({ status: "reader_failed", line: null }));
        return;
      }
      child = adapter.spawn(process.execPath, [readerEntrypoint], {
        shell: false,
        detached: false,
        windowsHide: true,
        cwd: path.dirname(readerEntrypoint),
        env: environment,
        stdio: [inputDescriptor, "pipe", "ignore", "ipc"],
      });
    } catch {
      resolve(Object.freeze({ status: "reader_failed", line: null }));
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
    let outcomeStatus: InteractiveConsoleReadOutcome["status"] =
      "reader_failed";
    const timeout = adapter.setTimeout(
      () => requestStop("timeout"),
      READER_TIMEOUT_MS,
    );
    const finish = () => {
      if (settled || !isChildClosed || !isOutputClosed) return;
      settled = true;
      adapter.clearTimeout(timeout);
      if (killTimer) adapter.clearTimeout(killTimer);
      try {
        child.removeListener("error", onFailure);
      } catch {
        isInvalid = true;
        outcomeStatus = "cleanup_unknown";
      }
      try {
        child.removeListener("close", onClose);
      } catch {
        isInvalid = true;
        outcomeStatus = "cleanup_unknown";
      }
      if (child.stdout) {
        try {
          child.stdout.removeListener("data", onData);
        } catch {
          isInvalid = true;
          outcomeStatus = "cleanup_unknown";
        }
        try {
          child.stdout.removeListener("error", onFailure);
        } catch {
          isInvalid = true;
          outcomeStatus = "cleanup_unknown";
        }
        try {
          child.stdout.removeListener("close", onOutputClose);
        } catch {
          isInvalid = true;
          outcomeStatus = "cleanup_unknown";
        }
      }
      try {
        cancellationSignal.removeEventListener("abort", onAbort);
      } catch {
        isInvalid = true;
        outcomeStatus = "cleanup_unknown";
      }
      try {
        if (child.connected) child.disconnect();
      } catch {
        isInvalid = true;
        outcomeStatus = "cleanup_unknown";
      }
      const parsed =
        !isInvalid && childExitCode === 0 && !cancellationSignal.aborted
          ? parseReaderResult(Buffer.concat(outputBuffers, outputBytes))
          : null;
      resolve(
        Object.freeze({
          status:
            parsed !== null
              ? "completed"
              : outcomeStatus === "cleanup_unknown"
                ? "cleanup_unknown"
                : cancellationSignal.aborted
                  ? "cancelled"
                  : outcomeStatus,
          line: parsed,
        }),
      );
    };
    const forceStop = () => {
      try {
        if (!child.kill("SIGKILL")) isInvalid = true;
      } catch {
        isInvalid = true;
      }
      if (isInvalid) outcomeStatus = "cleanup_unknown";
    };
    const requestStop = (
      reason: Exclude<
        InteractiveConsoleReadOutcome["status"],
        "completed" | "cleanup_unknown"
      > = "reader_failed",
    ) => {
      isInvalid = true;
      if (outcomeStatus !== "timeout" && reason !== "reader_failed")
        outcomeStatus = reason;
      try {
        if (child.connected) child.send("cancel");
      } catch {
        // The exact child is force-terminated below.
      }
      if (!killTimer) {
        killTimer = adapter.setTimeout(forceStop, READER_CANCEL_GRACE_MS);
      }
    };
    const onAbort = () => requestStop("cancelled");
    const onFailure = () => requestStop("reader_failed");
    const onData = (chunk: Buffer | string) => {
      if (!Buffer.isBuffer(chunk)) {
        requestStop("reader_failed");
        return;
      }
      outputBytes += chunk.byteLength;
      if (outputBytes > READER_MAXIMUM_OUTPUT_BYTES) {
        requestStop("reader_failed");
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
        requestStop("reader_failed");
      } else {
        child.stdout.on("data", onData);
        child.stdout.once("error", onFailure);
        child.stdout.once("close", onOutputClose);
      }
      cancellationSignal.addEventListener("abort", onAbort, {
        once: true,
      });
      if (cancellationSignal.aborted) onAbort();
    } catch {
      requestStop("reader_failed");
    }
  });
}

export async function readInteractiveConsoleLineUsingAdapter(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
  adapter: InteractiveConsoleReaderProcessAdapter,
) {
  const outcome = await readInteractiveConsoleLineOutcomeUsingAdapter(
    inputDescriptor,
    cancellationSignal,
    adapter,
  );
  return outcome.status === "completed" ? outcome.line : null;
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

export function readInteractiveConsoleLineOutcome(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
) {
  return readInteractiveConsoleLineOutcomeUsingAdapter(
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
  return writeWindowsTerminalTextOutcomeUsingStream(value, process.stdout);
}

export function writeInteractiveConsoleTextOutcome(
  outputDescriptor: number,
  value: string,
) {
  return writeInteractiveConsoleTextOutcomeUsingAdapter(
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

export function writeInteractiveConsoleText(
  outputDescriptor: number,
  value: string,
) {
  return writeInteractiveConsoleTextOutcome(outputDescriptor, value).then(
    (outcome) => outcome.status === "completed",
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
    readerArtifactIdentity:
      "single_use_verified_package_capability_and_fresh_content_root",
    readerArguments: "fixed_entrypoint_only_no_dynamic_arguments",
    readerEnvironment:
      "windows_loaded_kernel32_os_directory_plus_fixed_neutral_names_posix_fixed_empty",
    readerTimeoutMs: READER_TIMEOUT_MS,
    readerCancelGraceMs: READER_CANCEL_GRACE_MS,
    readerCleanupSchedulingMarginMs: READER_CLEANUP_SCHEDULING_MARGIN_MS,
    readerOrphanFailsafeMs: INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
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
}
