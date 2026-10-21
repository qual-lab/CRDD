/**
 * 固定OS端末の取得・検査・回収を所有する。
 * @responsibility 入出力descriptorを処理中保持し、実行失敗・回収不明を区別する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import tty from "node:tty";

const WINDOWS_INTERACTIVE_CONSOLE_DEVICES = Object.freeze({
  input: Object.freeze({ path: "\\\\.\\CONIN$", flags: "r" as const }),
  output: Object.freeze({ path: "\\\\.\\CONOUT$", flags: "r+" as const }),
});
const POSIX_INTERACTIVE_CONSOLE_DEVICES = Object.freeze({
  input: Object.freeze({ path: "/dev/tty", flags: "r" as const }),
  output: Object.freeze({ path: "/dev/tty", flags: "w" as const }),
});

/**
 * interactive-consoleで使用するInteractive Console Handlesの値契約を定義する。
 *
 * @responsibility Interactive Console HandlesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape TerminalHandlesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TerminalHandlesで宣言した値と責務の対応を維持する。
 * @boundary N/A: TerminalHandlesの宣言は外部境界を開かない。
 * @security N/A: TerminalHandlesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TerminalHandlesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TerminalHandles = Readonly<{
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
  validate?: (handles: TerminalHandles) => boolean;
}>;

/**
 * interactive-consoleで使用するInteractive Console Operation Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Operation OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape TerminalOperationOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TerminalOperationOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: TerminalOperationOutcomeの宣言は外部境界を開かない。
 * @security N/A: TerminalOperationOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TerminalOperationOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TerminalOperationOutcome<T> = Readonly<{
  status: "completed" | "unavailable" | "operation_failed" | "cleanup_unknown";
  value: T | null;
}>;

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
 * with Interactive Console Outcome Using Adapterを決定する。
 *
 * @responsibility with Interactive Console Outcome Using Adapterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: TerminalHandles) => T
 * @returns TerminalOperationOutcome<T>を返す。
 * @precondition 「platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: TerminalHandles) => T」がwithInteractiveConsoleOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition withInteractiveConsoleOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect Adapterで固定deviceを開き、callback完了後に取得済みdescriptorを閉じる。
 * @failure withInteractiveConsoleOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 取得・callback・回収だけを所有し、上位状態・同意・poisonを判断しない。
 * @boundary OS端末Adapterとcallbackの境界。
 * @security N/A: withInteractiveConsoleOutcomeUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleOutcomeUsingAdapterは共有非同期状態を持たない同期処理である。
 */
export function withInteractiveConsoleOutcomeUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: TerminalHandles) => T,
): TerminalOperationOutcome<T> {
  const devices = interactiveConsoleDevices(platform);
  let input: number | null = null;
  let output: number | null = null;
  let status: TerminalOperationOutcome<T>["status"] = "unavailable";
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
 * with Interactive Console Async Outcome Using Adapterを決定する。
 *
 * @responsibility with Interactive Console Async Outcome Using Adapterの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: TerminalHandles) => Promise<T>
 * @returns Promise<TerminalOperationOutcome<T>>を返す。
 * @precondition 「platform: NodeJS.Platform、adapter: InteractiveConsoleAdapter、operation: (handles: TerminalHandles) => Promise<T>」がwithInteractiveConsoleAsyncOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition withInteractiveConsoleAsyncOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect Adapterで固定deviceを開き、callback完了後に取得済みdescriptorを閉じる。
 * @failure withInteractiveConsoleAsyncOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 取得・callbackの完了待ち・回収だけを所有し、上位状態・同意・poisonを判断しない。
 * @boundary OS端末Adapterとcallbackの境界。
 * @security N/A: withInteractiveConsoleAsyncOutcomeUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency withInteractiveConsoleAsyncOutcomeUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function withInteractiveConsoleAsyncOutcomeUsingAdapter<T>(
  platform: NodeJS.Platform,
  adapter: InteractiveConsoleAdapter,
  operation: (handles: TerminalHandles) => Promise<T>,
): Promise<TerminalOperationOutcome<T>> {
  const devices = interactiveConsoleDevices(platform);
  let input: number | null = null;
  let output: number | null = null;
  let status: TerminalOperationOutcome<T>["status"] = "unavailable";
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
 * Interactive Console Handlesの契約を検証する。
 *
 * @responsibility Interactive Console Handlesの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input handles: TerminalHandles
 * @returns validateTerminalHandlesの計算結果を返す。
 * @precondition 「handles: TerminalHandles」がvalidateTerminalHandlesの入力契約を満たす。
 * @postcondition validateTerminalHandlesの責務を完了した結果だけを返す。
 * @effect tty.isattyと現在のstdout属性を観測する。Process起動は行わない。
 * @failure validateTerminalHandlesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateTerminalHandlesは宣言した境界以外へEffectを拡張しない。
 * @boundary OS端末descriptorのTTY観測と現在Processのstdout属性。
 * @security N/A: validateTerminalHandlesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateTerminalHandlesは共有非同期状態を持たない同期処理である。
 */
function validateTerminalHandles(handles: TerminalHandles) {
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
 * 固定OS端末を開き、同期処理後に回収する。
 * @responsibility 固定deviceの取得・TTY検査から取得済みdescriptorすべてのcloseまでを所有する。
 * @trace ARCH-000008
 * @input operation: 開いている端末を利用する同期処理。
 * @returns 処理結果と取得・回収の状態。
 * @precondition 呼出し側が内容・実行許可・取消を所有する。
 * @postcondition 処理完了後にすべてのcloseを試行する。
 * @effect 固定OS端末のopen、callback実行、close。
 * @failure unavailable、operation_failed、cleanup_unknownを区別する。
 * @invariant 同意・Runtime停止は判断しない。descriptorをcallback外へ保持しない。
 * @boundary OS端末とcallbackの境界。
 * @security 任意Path・任意OS Adapterは公開しない。
 * @concurrency callback完了前にdescriptorを回収しない。
 */
export function withTerminalOutcome<T>(
  operation: (handles: TerminalHandles) => T,
): TerminalOperationOutcome<T> {
  return withInteractiveConsoleOutcomeUsingAdapter(
    process.platform,
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateTerminalHandles,
    }),
    operation,
  );
}

/**
 * 固定OS端末を開き、非同期処理後に回収する。
 * @responsibility 固定deviceの取得・TTY検査から取得済みdescriptorすべてのcloseまでを所有する。
 * @trace ARCH-000008
 * @input operation: 開いている端末を利用する非同期処理。
 * @returns 処理結果と取得・回収の状態。
 * @precondition 呼出し側が内容・実行許可・取消を所有する。
 * @postcondition 処理完了後にすべてのcloseを試行する。
 * @effect 固定OS端末のopen、callback実行と待機、close。
 * @failure unavailable、operation_failed、cleanup_unknownを区別する。
 * @invariant 同意・Runtime停止は判断しない。descriptorをcallback外へ保持しない。
 * @boundary OS端末とcallbackの境界。
 * @security 任意Path・任意OS Adapterは公開しない。
 * @concurrency callback完了前にdescriptorを回収しない。
 */
export function withTerminalAsyncOutcome<T>(
  operation: (handles: TerminalHandles) => Promise<T>,
): Promise<TerminalOperationOutcome<T>> {
  return withInteractiveConsoleAsyncOutcomeUsingAdapter(
    process.platform,
    Object.freeze({
      open: fs.openSync,
      close: fs.closeSync,
      validate: validateTerminalHandles,
    }),
    operation,
  );
}
