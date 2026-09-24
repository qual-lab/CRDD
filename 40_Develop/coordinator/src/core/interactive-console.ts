/**
 * interactive-consoleに属する責務をまとめる。
 *
 * @responsibility InteractiveConsoleHandlesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import tty from "node:tty";
import { fileURLToPath } from "node:url";
import {
  INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
  readInteractiveConsoleLineFromStream,
} from "./interactive-console-reader.ts";
import { runInteractiveConsoleReaderLifecycle } from "./interactive-console-reader-lifecycle-internal.ts";
import { spawnRuntimeLocalTypeScriptChild } from "./runtime-local-typescript-child-entrypoints.ts";
import { poisonRuntimeProcessAfterInteractiveCleanupUnknown } from "./runtime-process-safety-state.ts";
import { createInteractiveConsoleReaderEnvironment } from "./windows-child-environment.ts";

export { readInteractiveConsoleLineFromStream as readTerminalLineUsingStream };

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 16;

const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 110_000;
const READER_CLEANUP_SCHEDULING_MARGIN_MS = 5_000;
const TERMINAL_WRITE_TIMEOUT_MS = 1_000;

/**
 * interactive-consoleで使用するInteractive Console Handlesの値契約を定義する。
 *
 * @responsibility Interactive Console HandlesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleHandlesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleHandlesで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleHandlesの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleHandlesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleHandlesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InteractiveConsoleHandles = Readonly<{
  input: number;
  output: number;
}>;

/**
 * interactive-consoleで使用するInteractive Console Adapterの値契約を定義する。
 *
 * @responsibility Interactive Console AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleAdapterの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InteractiveConsoleAdapter = Readonly<{
  open: (path: string, flags: "r" | "r+" | "w") => number;
  close: (descriptor: number) => void;
  validate?: (handles: InteractiveConsoleHandles) => boolean;
}>;

/**
 * interactive-consoleで使用するInteractive Console Text Adapterの値契約を定義する。
 *
 * @responsibility Interactive Console Text AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleTextAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleTextAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleTextAdapterの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleTextAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleTextAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InteractiveConsoleTextAdapter = Readonly<{
  isWindowsTerminal: boolean;
  writeWindowsTerminal: (
    value: string,
  ) => Promise<boolean | InteractiveConsoleTextWriteOutcome>;
  writeDescriptor: (descriptor: number, value: string) => void;
}>;

/**
 * interactive-consoleで使用するInteractive Console Text Write Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Text Write OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleTextWriteOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleTextWriteOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleTextWriteOutcomeの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleTextWriteOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleTextWriteOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleTextWriteOutcome = Readonly<{
  status: "completed" | "write_failed" | "cleanup_unknown";
}>;

/**
 * interactive-consoleで使用するInteractive Console Operation Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Operation OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleOperationOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleOperationOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleOperationOutcomeの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleOperationOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleOperationOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleOperationOutcome<T> = Readonly<{
  status: "completed" | "unavailable" | "operation_failed" | "cleanup_unknown";
  value: T | null;
}>;

/**
 * interactive-consoleで使用するInteractive Console Availability Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Availability OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleAvailabilityOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleAvailabilityOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleAvailabilityOutcomeの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleAvailabilityOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleAvailabilityOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleAvailabilityOutcome = Readonly<{
  status: "available" | "unavailable" | "cleanup_unknown";
}>;

/**
 * interactive-consoleで使用するWindows Terminal Streamの値契約を定義する。
 *
 * @responsibility Windows Terminal StreamのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape WindowsTerminalStreamが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WindowsTerminalStreamで宣言した値と責務の対応を維持する。
 * @boundary N/A: WindowsTerminalStreamの宣言は外部境界を開かない。
 * @security N/A: WindowsTerminalStreamはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility WindowsTerminalStreamの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * interactive Console Devicesを決定する。
 *
 * @responsibility interactive Console Devicesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform
 * @returns interactiveConsoleDevicesの計算結果を返す。
 * @precondition 「platform: NodeJS.Platform」がinteractiveConsoleDevicesの入力契約を満たす。
 * @postcondition interactiveConsoleDevicesの責務を完了した結果だけを返す。
 * @effect N/A: interactiveConsoleDevicesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: interactiveConsoleDevicesは独自の失敗分岐を所有しない。
 * @invariant interactiveConsoleDevicesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: interactiveConsoleDevicesはProcess内の同一Subsystemで完結する。
 * @security N/A: interactiveConsoleDevicesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: interactiveConsoleDevicesは共有非同期状態を持たない同期処理である。
 */
function interactiveConsoleDevices(platform: NodeJS.Platform) {
  return platform === "win32"
    ? WINDOWS_INTERACTIVE_CONSOLE_DEVICES
    : POSIX_INTERACTIVE_CONSOLE_DEVICES;
}

/**
 * interactive-consoleで使用するInteractive Console Read Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Read OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleReadOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleReadOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleReadOutcomeの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleReadOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleReadOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleReadOutcome = Readonly<{
  status:
    | "completed"
    | "cancelled"
    | "timeout"
    | "reader_failed"
    | "cleanup_unknown";
  line: string | null;
}>;

/**
 * with Interactive Console Using Adapterを決定する。
 *
 * @responsibility with Interactive Console Using Adapterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => T
 * @returns T | nullを返す。
 * @precondition 「platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => T」がwithInteractiveConsoleUsingAdapterの入力契約を満たす。
 * @postcondition withInteractiveConsoleUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: withInteractiveConsoleUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: withInteractiveConsoleUsingAdapterは独自の失敗分岐を所有しない。
 * @invariant withInteractiveConsoleUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withInteractiveConsoleUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: withInteractiveConsoleUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleUsingAdapterは共有非同期状態を持たない同期処理である。
 */
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

/**
 * with Interactive Console Outcome Using Adapterを決定する。
 *
 * @responsibility with Interactive Console Outcome Using Adapterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => T
 * @returns InteractiveConsoleOperationOutcome<T>を返す。
 * @precondition 「platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => T」がwithInteractiveConsoleOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition withInteractiveConsoleOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: withInteractiveConsoleOutcomeUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure withInteractiveConsoleOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withInteractiveConsoleOutcomeUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withInteractiveConsoleOutcomeUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: withInteractiveConsoleOutcomeUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleOutcomeUsingAdapterは共有非同期状態を持たない同期処理である。
 */
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

/**
 * with Interactive Consoleを決定する。
 *
 * @responsibility with Interactive Consoleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: (handles: InteractiveConsoleHandles) => T
 * @returns T | nullを返す。
 * @precondition 「operation: (handles: InteractiveConsoleHandles) => T」がwithInteractiveConsoleの入力契約を満たす。
 * @postcondition withInteractiveConsoleの責務を完了した結果だけを返す。
 * @effect N/A: withInteractiveConsoleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: withInteractiveConsoleは独自の失敗分岐を所有しない。
 * @invariant withInteractiveConsoleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withInteractiveConsoleはProcess内の同一Subsystemで完結する。
 * @security N/A: withInteractiveConsoleはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleは共有非同期状態を持たない同期処理である。
 */
export function withInteractiveConsole<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): T | null {
  const outcome = withInteractiveConsoleOutcome(operation);
  return outcome.status === "completed" ? outcome.value : null;
}

/**
 * with Interactive Console Outcomeを決定する。
 *
 * @responsibility with Interactive Console Outcomeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: (handles: InteractiveConsoleHandles) => T
 * @returns InteractiveConsoleOperationOutcome<T>を返す。
 * @precondition 「operation: (handles: InteractiveConsoleHandles) => T」がwithInteractiveConsoleOutcomeの入力契約を満たす。
 * @postcondition withInteractiveConsoleOutcomeの責務を完了した結果だけを返す。
 * @effect withInteractiveConsoleOutcomeはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: withInteractiveConsoleOutcomeは独自の失敗分岐を所有しない。
 * @invariant withInteractiveConsoleOutcomeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: withInteractiveConsoleOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleOutcomeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * with Interactive Console Async Using Adapterを決定する。
 *
 * @responsibility with Interactive Console Async Using Adapterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => Promise<T>
 * @returns Promise<T | null>を返す。
 * @precondition 「platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => Promise<T>」がwithInteractiveConsoleAsyncUsingAdapterの入力契約を満たす。
 * @postcondition withInteractiveConsoleAsyncUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: withInteractiveConsoleAsyncUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: withInteractiveConsoleAsyncUsingAdapterは独自の失敗分岐を所有しない。
 * @invariant withInteractiveConsoleAsyncUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withInteractiveConsoleAsyncUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: withInteractiveConsoleAsyncUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency withInteractiveConsoleAsyncUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * with Interactive Console Async Outcome Using Adapterを決定する。
 *
 * @responsibility with Interactive Console Async Outcome Using Adapterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => Promise<T>
 * @returns Promise<InteractiveConsoleOperationOutcome<T>>を返す。
 * @precondition 「platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: InteractiveConsoleHandles) => Promise<T>」がwithInteractiveConsoleAsyncOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition withInteractiveConsoleAsyncOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: withInteractiveConsoleAsyncOutcomeUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure withInteractiveConsoleAsyncOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withInteractiveConsoleAsyncOutcomeUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withInteractiveConsoleAsyncOutcomeUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: withInteractiveConsoleAsyncOutcomeUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency withInteractiveConsoleAsyncOutcomeUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * with Interactive Console Asyncを決定する。
 *
 * @responsibility with Interactive Console Asyncの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: (handles: InteractiveConsoleHandles) => Promise<T>
 * @returns withInteractiveConsoleAsyncの計算結果を返す。
 * @precondition 「operation: (handles: InteractiveConsoleHandles) => Promise<T>」がwithInteractiveConsoleAsyncの入力契約を満たす。
 * @postcondition withInteractiveConsoleAsyncの責務を完了した結果だけを返す。
 * @effect N/A: withInteractiveConsoleAsyncは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: withInteractiveConsoleAsyncは独自の失敗分岐を所有しない。
 * @invariant withInteractiveConsoleAsyncは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withInteractiveConsoleAsyncはProcess内の同一Subsystemで完結する。
 * @security N/A: withInteractiveConsoleAsyncはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleAsyncは共有非同期状態を持たない同期処理である。
 */
export function withInteractiveConsoleAsync<T>(
  operation: (handles: InteractiveConsoleHandles) => Promise<T>,
) {
  return withInteractiveConsoleAsyncOutcome(operation).then((outcome) =>
    outcome.status === "completed" ? outcome.value : null,
  );
}

/**
 * with Interactive Console Async Outcomeを決定する。
 *
 * @responsibility with Interactive Console Async Outcomeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: (handles: InteractiveConsoleHandles) => Promise<T>
 * @returns withInteractiveConsoleAsyncOutcomeの計算結果を返す。
 * @precondition 「operation: (handles: InteractiveConsoleHandles) => Promise<T>」がwithInteractiveConsoleAsyncOutcomeの入力契約を満たす。
 * @postcondition withInteractiveConsoleAsyncOutcomeの責務を完了した結果だけを返す。
 * @effect withInteractiveConsoleAsyncOutcomeはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: withInteractiveConsoleAsyncOutcomeは独自の失敗分岐を所有しない。
 * @invariant withInteractiveConsoleAsyncOutcomeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: withInteractiveConsoleAsyncOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleAsyncOutcomeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Interactive Console Text Outcome Using Adapterを書き込む。
 *
 * @responsibility Interactive Console Text Outcome Using Adapterの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、outputDescriptor: number、value: string、adapter: InteractiveConsoleTextAdapter
 * @returns Promise<InteractiveConsoleTextWriteOutcome>を返す。
 * @precondition 「platform: NodeJS.Platform、outputDescriptor: number、value: string、adapter: InteractiveConsoleTextAdapter」がwriteInteractiveConsoleTextOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition writeInteractiveConsoleTextOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: writeInteractiveConsoleTextOutcomeUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeInteractiveConsoleTextOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeInteractiveConsoleTextOutcomeUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeInteractiveConsoleTextOutcomeUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: writeInteractiveConsoleTextOutcomeUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeInteractiveConsoleTextOutcomeUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Interactive Console Text Using Adapterを書き込む。
 *
 * @responsibility Interactive Console Text Using Adapterの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、outputDescriptor: number、value: string、adapter: InteractiveConsoleTextAdapter
 * @returns writeInteractiveConsoleTextUsingAdapterの計算結果を返す。
 * @precondition 「platform: NodeJS.Platform、outputDescriptor: number、value: string、adapter: InteractiveConsoleTextAdapter」がwriteInteractiveConsoleTextUsingAdapterの入力契約を満たす。
 * @postcondition writeInteractiveConsoleTextUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: writeInteractiveConsoleTextUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeInteractiveConsoleTextUsingAdapterは独自の失敗分岐を所有しない。
 * @invariant writeInteractiveConsoleTextUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeInteractiveConsoleTextUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: writeInteractiveConsoleTextUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeInteractiveConsoleTextUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Windows Terminal Text Outcome Using Streamを書き込む。
 *
 * @responsibility Windows Terminal Text Outcome Using Streamの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input value: string、stream: WindowsTerminalStream
 * @returns Promise<InteractiveConsoleTextWriteOutcome>を返す。
 * @precondition 「value: string、stream: WindowsTerminalStream」がwriteWindowsTerminalTextOutcomeUsingStreamの入力契約を満たす。
 * @postcondition writeWindowsTerminalTextOutcomeUsingStreamの責務を完了した結果だけを返す。
 * @effect N/A: writeWindowsTerminalTextOutcomeUsingStreamは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeWindowsTerminalTextOutcomeUsingStreamは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeWindowsTerminalTextOutcomeUsingStreamは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeWindowsTerminalTextOutcomeUsingStreamはProcess内の同一Subsystemで完結する。
 * @security N/A: writeWindowsTerminalTextOutcomeUsingStreamはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeWindowsTerminalTextOutcomeUsingStreamは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Windows Terminal Text Using Streamを書き込む。
 *
 * @responsibility Windows Terminal Text Using Streamの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input value: string、stream: WindowsTerminalStream
 * @returns writeWindowsTerminalTextUsingStreamの計算結果を返す。
 * @precondition 「value: string、stream: WindowsTerminalStream」がwriteWindowsTerminalTextUsingStreamの入力契約を満たす。
 * @postcondition writeWindowsTerminalTextUsingStreamの責務を完了した結果だけを返す。
 * @effect N/A: writeWindowsTerminalTextUsingStreamは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeWindowsTerminalTextUsingStreamは独自の失敗分岐を所有しない。
 * @invariant writeWindowsTerminalTextUsingStreamは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeWindowsTerminalTextUsingStreamはProcess内の同一Subsystemで完結する。
 * @security N/A: writeWindowsTerminalTextUsingStreamはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeWindowsTerminalTextUsingStreamは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Interactive Console Handlesの契約を検証する。
 *
 * @responsibility Interactive Console Handlesの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input handles: InteractiveConsoleHandles
 * @returns validateInteractiveConsoleHandlesの計算結果を返す。
 * @precondition 「handles: InteractiveConsoleHandles」がvalidateInteractiveConsoleHandlesの入力契約を満たす。
 * @postcondition validateInteractiveConsoleHandlesの責務を完了した結果だけを返す。
 * @effect validateInteractiveConsoleHandlesは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure validateInteractiveConsoleHandlesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateInteractiveConsoleHandlesは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: validateInteractiveConsoleHandlesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateInteractiveConsoleHandlesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Interactive Console Lineを読み取る。
 *
 * @responsibility Interactive Console Lineの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input inputDescriptor: number、cancellationSignal: AbortSignal
 * @returns readInteractiveConsoleLineの計算結果を返す。
 * @precondition 「inputDescriptor: number、cancellationSignal: AbortSignal」がreadInteractiveConsoleLineの入力契約を満たす。
 * @postcondition readInteractiveConsoleLineの責務を完了した結果だけを返す。
 * @effect N/A: readInteractiveConsoleLineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readInteractiveConsoleLineは独自の失敗分岐を所有しない。
 * @invariant readInteractiveConsoleLineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readInteractiveConsoleLineはProcess内の同一Subsystemで完結する。
 * @security N/A: readInteractiveConsoleLineはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readInteractiveConsoleLineは共有非同期状態を持たない同期処理である。
 */
export function readInteractiveConsoleLine(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
) {
  return readInteractiveConsoleLineOutcome(
    inputDescriptor,
    cancellationSignal,
  ).then((outcome) => (outcome.status === "completed" ? outcome.line : null));
}

/**
 * Interactive Console Line Outcomeを読み取る。
 *
 * @responsibility Interactive Console Line Outcomeの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input inputDescriptor: number、cancellationSignal: AbortSignal
 * @returns readInteractiveConsoleLineOutcomeの計算結果を返す。
 * @precondition 「inputDescriptor: number、cancellationSignal: AbortSignal」がreadInteractiveConsoleLineOutcomeの入力契約を満たす。
 * @postcondition readInteractiveConsoleLineOutcomeの責務を完了した結果だけを返す。
 * @effect readInteractiveConsoleLineOutcomeは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure readInteractiveConsoleLineOutcomeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readInteractiveConsoleLineOutcomeは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: readInteractiveConsoleLineOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency readInteractiveConsoleLineOutcomeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Windows Terminal Textを書き込む。
 *
 * @responsibility Windows Terminal Textの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns writeWindowsTerminalTextの計算結果を返す。
 * @precondition 「value: string」がwriteWindowsTerminalTextの入力契約を満たす。
 * @postcondition writeWindowsTerminalTextの責務を完了した結果だけを返す。
 * @effect writeWindowsTerminalTextは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: writeWindowsTerminalTextは独自の失敗分岐を所有しない。
 * @invariant writeWindowsTerminalTextは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: writeWindowsTerminalTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeWindowsTerminalTextは共有非同期状態を持たない同期処理である。
 */
function writeWindowsTerminalText(value: string) {
  return writeWindowsTerminalTextOutcomeUsingStream(value, process.stdout);
}

/**
 * Interactive Console Text Outcomeを書き込む。
 *
 * @responsibility Interactive Console Text Outcomeの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input outputDescriptor: number、value: string
 * @returns writeInteractiveConsoleTextOutcomeの計算結果を返す。
 * @precondition 「outputDescriptor: number、value: string」がwriteInteractiveConsoleTextOutcomeの入力契約を満たす。
 * @postcondition writeInteractiveConsoleTextOutcomeの責務を完了した結果だけを返す。
 * @effect writeInteractiveConsoleTextOutcomeはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: writeInteractiveConsoleTextOutcomeは独自の失敗分岐を所有しない。
 * @invariant writeInteractiveConsoleTextOutcomeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeInteractiveConsoleTextOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeInteractiveConsoleTextOutcomeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Interactive Console Textを書き込む。
 *
 * @responsibility Interactive Console Textの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input outputDescriptor: number、value: string
 * @returns writeInteractiveConsoleTextの計算結果を返す。
 * @precondition 「outputDescriptor: number、value: string」がwriteInteractiveConsoleTextの入力契約を満たす。
 * @postcondition writeInteractiveConsoleTextの責務を完了した結果だけを返す。
 * @effect N/A: writeInteractiveConsoleTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeInteractiveConsoleTextは独自の失敗分岐を所有しない。
 * @invariant writeInteractiveConsoleTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeInteractiveConsoleTextはProcess内の同一Subsystemで完結する。
 * @security N/A: writeInteractiveConsoleTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeInteractiveConsoleTextは共有非同期状態を持たない同期処理である。
 */
export function writeInteractiveConsoleText(
  outputDescriptor: number,
  value: string,
) {
  return writeInteractiveConsoleTextOutcome(outputDescriptor, value).then(
    (outcome) => outcome.status === "completed",
  );
}

/**
 * interactive Console Availableを決定する。
 *
 * @responsibility interactive Console Availableの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns interactiveConsoleAvailableの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinteractiveConsoleAvailableの入力契約を満たす。
 * @postcondition interactiveConsoleAvailableの責務を完了した結果だけを返す。
 * @effect N/A: interactiveConsoleAvailableは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: interactiveConsoleAvailableは独自の失敗分岐を所有しない。
 * @invariant interactiveConsoleAvailableは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: interactiveConsoleAvailableはProcess内の同一Subsystemで完結する。
 * @security N/A: interactiveConsoleAvailableはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: interactiveConsoleAvailableは共有非同期状態を持たない同期処理である。
 */
export function interactiveConsoleAvailable() {
  return interactiveConsoleAvailabilityOutcome().status === "available";
}

/**
 * interactive Console Availability Outcomeを決定する。
 *
 * @responsibility interactive Console Availability Outcomeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns InteractiveConsoleAvailabilityOutcomeを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinteractiveConsoleAvailabilityOutcomeの入力契約を満たす。
 * @postcondition interactiveConsoleAvailabilityOutcomeの責務を完了した結果だけを返す。
 * @effect interactiveConsoleAvailabilityOutcomeはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: interactiveConsoleAvailabilityOutcomeは独自の失敗分岐を所有しない。
 * @invariant interactiveConsoleAvailabilityOutcomeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: interactiveConsoleAvailabilityOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: interactiveConsoleAvailabilityOutcomeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Interactive Console 契約の公開契約を記述する。
 *
 * @responsibility Interactive Console 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeInteractiveConsoleContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeInteractiveConsoleContractの入力契約を満たす。
 * @postcondition describeInteractiveConsoleContractの責務を完了した結果だけを返す。
 * @effect describeInteractiveConsoleContractは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: describeInteractiveConsoleContractは独自の失敗分岐を所有しない。
 * @invariant describeInteractiveConsoleContractは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeInteractiveConsoleContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeInteractiveConsoleContractは共有非同期状態を持たない同期処理である。
 */
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
      "windows_native_os_directory_plus_fixed_neutral_names_posix_fixed_empty",
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
