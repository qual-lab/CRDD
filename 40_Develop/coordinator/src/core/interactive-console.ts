import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import tty from "node:tty";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
  readInteractiveConsoleLineFromStream,
} from "./interactive-console-reader.ts";
import { runInteractiveConsoleReaderLifecycle } from "./interactive-console-reader-lifecycle-internal.ts";
import { createInteractiveConsoleReaderEnvironment } from "./windows-child-environment.ts";
import { poisonRuntimeProcessAfterInteractiveCleanupUnknown } from "./runtime-process-safety-state.ts";
import { spawnRuntimeLocalTypeScriptChild } from "./runtime-local-typescript-child-entrypoints.ts";

export { readInteractiveConsoleLineFromStream as readTerminalLineUsingStream };

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 16;

const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 110_000;
const READER_CLEANUP_SCHEDULING_MARGIN_MS = 5_000;
const TERMINAL_WRITE_TIMEOUT_MS = 1_000;

type InteractiveConsoleHandles = Readonly<{
  input: number;
  output: number;
}>;

type InteractiveConsoleAdapter = Readonly<{
  open: (path: string, flags: "r" | "r+" | "w") => number;
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

export type InteractiveConsoleAvailabilityOutcome = Readonly<{
  status: "available" | "unavailable" | "cleanup_unknown";
}>;

type WindowsTerminalStream = Readonly<{
  isTTY?: boolean;
  destroyed: boolean;
  writable: boolean;
  once: (event: "error", listener: () => void) => unknown;
  removeListener: (event: "error", listener: () => void) => unknown;
  write: (value: string, callback: (error?: Error | null) => void) => boolean;
}>;

const WINDOWS_INTERACTIVE_CONSOLE_DEVICES = Object.freeze({
  input: Object.freeze({ path: "\\\\.\\CONIN$", flags: "r" as const }),
  output: Object.freeze({ path: "\\\\.\\CONOUT$", flags: "r+" as const }),
});
const POSIX_INTERACTIVE_CONSOLE_DEVICES = Object.freeze({
  input: Object.freeze({ path: "/dev/tty", flags: "r" as const }),
  output: Object.freeze({ path: "/dev/tty", flags: "w" as const }),
});

function interactiveConsoleDevices(platform: NodeJS.Platform) {
  return platform === "win32"
    ? WINDOWS_INTERACTIVE_CONSOLE_DEVICES
    : POSIX_INTERACTIVE_CONSOLE_DEVICES;
}

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
  const outcome = withInteractiveConsoleOutcomeUsingAdapter(
    platform,
    adapter,
    operation,
  );
  return outcome.status === "completed" ? outcome.value : null;
}

export function withInteractiveConsoleOutcomeUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: InteractiveConsoleHandles) => T,
): InteractiveConsoleOperationOutcome<T> {
  const devices = interactiveConsoleDevices(platform);
  let input: number | null = null;
  let output: number | null = null;
  let status: InteractiveConsoleOperationOutcome<T>["status"] = "unavailable";
  let value: T | null = null;
  let isOperationStarted = false;
  try {
    input = adapter.open(devices.input.path, devices.input.flags);
    output = adapter.open(devices.output.path, devices.output.flags);
    if (adapter.validate && !adapter.validate({ input, output })) {
      throw new Error("interactive_console_validation_failed");
    }
    isOperationStarted = true;
    value = operation(Object.freeze({ input, output }));
    status = "completed";
  } catch {
    status = isOperationStarted ? "operation_failed" : "unavailable";
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

export function withInteractiveConsole<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  const outcome = withInteractiveConsoleOutcome(operation);
  return outcome.status === "completed" ? outcome.value : null;
}

export function withInteractiveConsoleOutcome<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): InteractiveConsoleOperationOutcome<T> {
  const outcome = withInteractiveConsoleOutcomeUsingAdapter(
    process.platform,
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateInteractiveConsoleHandles,
    }),
    operation,
  );
  if (outcome.status === "cleanup_unknown")
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
  return Object.freeze({
    status: outcome.status,
    value: outcome.status === "completed" ? outcome.value : null,
  });
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
  const devices = interactiveConsoleDevices(platform);
  let input: number | null = null;
  let output: number | null = null;
  let status: InteractiveConsoleOperationOutcome<T>["status"] = "unavailable";
  let value: T | null = null;
  let isOperationStarted = false;
  try {
    input = adapter.open(devices.input.path, devices.input.flags);
    output = adapter.open(devices.output.path, devices.output.flags);
    if (adapter.validate && !adapter.validate({ input, output })) {
      throw new Error("interactive_console_validation_failed");
    }
    isOperationStarted = true;
    value = await operation(Object.freeze({ input, output }));
    status = "completed";
  } catch {
    status = isOperationStarted ? "operation_failed" : "unavailable";
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
  return withInteractiveConsoleAsyncOutcome(operation).then((outcome) =>
    outcome.status === "completed" ? outcome.value : null,
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
  ).then((outcome) => {
    if (outcome.status === "cleanup_unknown")
      poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return Object.freeze({
      status: outcome.status,
      value: outcome.status === "completed" ? outcome.value : null,
    });
  });
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
      () => settle("cleanup_unknown", true),
      TERMINAL_WRITE_TIMEOUT_MS,
    );
    timeout.unref();
    const settle = (
      status: InteractiveConsoleTextWriteOutcome["status"],
      shouldRetainLateErrorSink = false,
    ) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      if (deferredCompletion) clearImmediate(deferredCompletion);
      if (!shouldRetainLateErrorSink) {
        try {
          stream.removeListener("error", onError);
        } catch {
          status = "cleanup_unknown";
        }
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

export function readInteractiveConsoleLine(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
) {
  return readInteractiveConsoleLineOutcome(
    inputDescriptor,
    cancellationSignal,
  ).then((outcome) => (outcome.status === "completed" ? outcome.line : null));
}

export function readInteractiveConsoleLineOutcome(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
) {
  if (
    !Number.isSafeInteger(inputDescriptor) ||
    inputDescriptor < 0 ||
    cancellationSignal.aborted ||
    !tty.isatty(inputDescriptor)
  )
    return Promise.resolve(
      Object.freeze({
        status: cancellationSignal.aborted ? "cancelled" : "reader_failed",
        line: null,
      }) as InteractiveConsoleReadOutcome,
    );
  const environment = createInteractiveConsoleReaderEnvironment();
  if (!environment)
    return Promise.resolve(
      Object.freeze({
        status: "reader_failed",
        line: null,
      }) as InteractiveConsoleReadOutcome,
    );
  let child: ChildProcess;
  try {
    child = spawnRuntimeLocalTypeScriptChild("interactive_console_reader", [], {
      shell: false,
      detached: false,
      windowsHide: false,
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      env: environment,
      stdio: ["ignore", "pipe", "ignore", "ipc"],
    });
  } catch {
    return Promise.resolve(
      Object.freeze({
        status: "reader_failed",
        line: null,
      }) as InteractiveConsoleReadOutcome,
    );
  }
  return runInteractiveConsoleReaderLifecycle(
    Object.freeze({ inputDescriptor }),
    cancellationSignal,
    child,
    Object.freeze({ setTimeout, clearTimeout }),
  ).then((outcome) => {
    if (outcome.status === "cleanup_unknown")
      poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return outcome;
  });
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
  ).then((outcome) => {
    if (outcome.status === "cleanup_unknown")
      poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return outcome;
  });
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
  return interactiveConsoleAvailabilityOutcome().status === "available";
}

export function interactiveConsoleAvailabilityOutcome(): InteractiveConsoleAvailabilityOutcome {
  const outcome = withInteractiveConsoleOutcomeUsingAdapter(
    process.platform,
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateInteractiveConsoleHandles,
    }),
    () => true,
  );
  if (outcome.status === "cleanup_unknown") {
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return Object.freeze({ status: "cleanup_unknown" });
  }
  return Object.freeze({
    status: outcome.status === "completed" ? "available" : "unavailable",
  });
}

export function describeInteractiveConsoleContract() {
  return Object.freeze({
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: INTERACTIVE_CONSOLE_CONTRACT_REVISION,
    windowsDevices: Object.freeze(["\\\\.\\CONIN$", "\\\\.\\CONOUT$"]),
    windowsDeviceOpenModes: Object.freeze({ input: "r", output: "r+" }),
    windowsUnicodeOutput: "node_unicode_tty_output_required",
    windowsTerminalWriteTimeoutMs: TERMINAL_WRITE_TIMEOUT_MS,
    windowsTerminalWriteOutcomes: Object.freeze([
      "completed",
      "write_failed",
      "cleanup_unknown_process_restart_required",
    ]),
    synchronousPreflightOutcomes: Object.freeze([
      "available",
      "unavailable",
      "cleanup_unknown_process_restart_required",
    ]),
    productionPoisonTiming:
      "synchronous_on_cleanup_unknown_observation_before_return_or_next_non_cleanup_await",
    productionPoisonPreservingEntrypoints: Object.freeze([
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
    ]),
    genericUsingAdapterAuthority:
      "non_authority_pure_no_production_process_state",
    productionNoncompletedValue: "null",
    validatedTtyInput:
      "parent_and_fixed_reader_child_independently_open_conin_tty",
    taskStandardInputRole: "structured_transport_only",
    readerEntrypoint: "fixed_runtime_owned_non_exported_module",
    readerArtifactIdentity:
      "single_use_verified_package_capability_and_fresh_content_root",
    readerArguments: "fixed_entrypoint_only_no_dynamic_arguments",
    readerEnvironment:
      "windows_loaded_kernel32_os_directory_plus_fixed_neutral_names_posix_fixed_empty",
    platformGuarantee:
      "windows_local_personal_only_posix_fixed_empty_candidate_not_promoted",
    readerTimeoutMs: READER_TIMEOUT_MS,
    readerCancelGraceMs: READER_CANCEL_GRACE_MS,
    readerCleanupSchedulingMarginMs: READER_CLEANUP_SCHEDULING_MARGIN_MS,
    readerOrphanFailsafeMs: INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
    readerStandardIo:
      "child_fixed_conin_bounded_stdout_discarded_stderr_private_ipc",
    readerCancellation:
      "ipc_cancel_parent_disconnect_then_exact_child_force_termination",
    readerCompletion:
      "exact_child_close_and_bounded_stdout_close_required_no_unknown_normal_return",
    readerOwnedHandleCleanup:
      "single_async_os_read_then_synchronous_descriptor_close_and_exact_child_process_close",
    readerSuccessRequiresDescriptorClose: true,
    readerSuccessRequiresChildClose: true,
    windowsRedirectedOutput: "fail_closed",
    redirectedStandardInputAllowed: false,
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });
}
