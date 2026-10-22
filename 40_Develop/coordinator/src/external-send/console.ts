/**
 * 送信同意の端末接続と回収不明時のProcess停止を所有する。
 *
 * @responsibility InteractiveConsoleHandlesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import {
  type InteractiveConsoleTextWriteOutcome,
  type TerminalHandles as InteractiveConsoleHandles,
  type TerminalOperationOutcome as InteractiveConsoleOperationOutcome,
  withTerminalOutcome,
  withTerminalAsyncOutcome,
  WINDOWS_TERMINAL_WRITE_TIMEOUT_MS as TERMINAL_WRITE_TIMEOUT_MS,
  writeWindowsTerminalTextOutcome,
  readConfirmationCodeOutcome,
  INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
} from "../../../platform-access/src/index.ts";
import fs from "node:fs";
import { poisonRuntimeProcessAfterInteractiveCleanupUnknown } from "../execution/process-safety-state.ts";

export const INTERACTIVE_CONSOLE_CONTRACT =
  "crdd-coordinator/interactive-console";
export const INTERACTIVE_CONSOLE_CONTRACT_REVISION = 16;

const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 110_000;
const READER_CLEANUP_SCHEDULING_MARGIN_MS = 5_000;

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
 * @postcondition PAの回収結果を受け、cleanup_unknownならpoisonした後に返す。
 * @effect PAで端末を取得・回収し、回収不明時は現在Runtimeを停止状態にする。
 * @failure 回収不明を成功へ畳まず、非completedのvalueはnullにする。
 * @invariant OS技術処理はPAに委譲し、poisonと未完了値の非開示を所有する。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: withInteractiveConsoleOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: withInteractiveConsoleOutcomeは共有非同期状態を持たない同期処理である。
 */
export function withInteractiveConsoleOutcome<T>(
  operation: (handles: InteractiveConsoleHandles) => T,
): InteractiveConsoleOperationOutcome<T> {
  const outcome = withTerminalOutcome(operation);
  if (outcome.status === "cleanup_unknown")
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
  return Object.freeze({
    status: outcome.status,
    value: outcome.status === "completed" ? outcome.value : null,
  });
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
 * @postcondition PAの処理・回収完了を待ち、cleanup_unknownならpoison後に返す。
 * @effect PAで端末を取得・回収し、回収不明時は現在Runtimeを停止状態にする。
 * @failure 回収不明を成功へ畳まず、非completedのvalueはnullにする。
 * @invariant OS技術処理はPAに委譲し、poisonと未完了値の非開示を所有する。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: withInteractiveConsoleAsyncOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency PAの非同期完了後、必要なpoisonと値投影を行って一度だけ返す。
 */
export function withInteractiveConsoleAsyncOutcome<T>(
  operation: (handles: InteractiveConsoleHandles) => Promise<T>,
) {
  return withTerminalAsyncOutcome(operation).then((outcome) => {
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
  return readConfirmationCodeOutcome(inputDescriptor, cancellationSignal).then(
    (outcome) => {
      if (outcome.status === "cleanup_unknown")
        poisonRuntimeProcessAfterInteractiveCleanupUnknown();
      return outcome;
    },
  );
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
      writeWindowsTerminal: writeWindowsTerminalTextOutcome,
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
  const outcome = withTerminalOutcome(() => true);
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
