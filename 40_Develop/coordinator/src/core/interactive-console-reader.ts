import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const INTERACTIVE_CONSOLE_READER_CONTRACT =
  "crdd-coordinator/interactive-console-reader";
export const INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION = 7;
export const INTERACTIVE_CONSOLE_READER_MAXIMUM_BYTES = 64;
export const INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS = 120_000;

/**
 * ReaderInputが扱う値の構造を表す。
 *
 * @responsibility ReaderInputに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape ReaderInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ReaderInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReaderInputの宣言は外部境界を開かない。
 * @security N/A: ReaderInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ReaderInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ReaderInput = Readonly<{
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

/**
 * OwnedReaderAdapterが扱う値の構造を表す。
 *
 * @responsibility OwnedReaderAdapterに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape OwnedReaderAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedReaderAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedReaderAdapterの宣言は外部境界を開かない。
 * @security N/A: OwnedReaderAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OwnedReaderAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedReaderAdapter = Readonly<{
  open: (device: string, flags: "r") => number;
  close: (descriptor: number) => void;
  read: (
    descriptor: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: null,
    callback: (error: NodeJS.ErrnoException | null, count: number) => void,
  ) => unknown;
}>;

/**
 * OwnedInteractiveConsoleReadOutcomeが扱う値の構造を表す。
 *
 * @responsibility OwnedInteractiveConsoleReadOutcomeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape OwnedInteractiveConsoleReadOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedInteractiveConsoleReadOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedInteractiveConsoleReadOutcomeの宣言は外部境界を開かない。
 * @security N/A: OwnedInteractiveConsoleReadOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OwnedInteractiveConsoleReadOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedInteractiveConsoleReadOutcome = Readonly<{
  status: "completed" | "cancelled" | "reader_failed";
  line: string | null;
  descriptorCloseConfirmed: boolean;
}>;

/**
 * parseInteractiveConsoleLineの処理を実行する。
 *
 * @responsibility parseInteractiveConsoleLineに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input bytes: Uint8Array
 * @returns parseInteractiveConsoleLineの計算結果を返す。
 * @precondition 「bytes: Uint8Array」がparseInteractiveConsoleLineの入力契約を満たす。
 * @postcondition parseInteractiveConsoleLineの責務を完了した結果だけを返す。
 * @effect N/A: parseInteractiveConsoleLineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseInteractiveConsoleLineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseInteractiveConsoleLineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseInteractiveConsoleLineはProcess内の同一Subsystemで完結する。
 * @security N/A: parseInteractiveConsoleLineはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseInteractiveConsoleLineは共有非同期状態を持たない同期処理である。
 */
export function parseInteractiveConsoleLine(bytes: Uint8Array) {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > INTERACTIVE_CONSOLE_READER_MAXIMUM_BYTES ||
    bytes.includes(0) ||
    bytes.some(
      (value) =>
        (value < 0x20 && value !== 0x0d && value !== 0x0a) || value === 0x7f,
    )
  ) {
    return null;
  }
  const firstLf = bytes.indexOf(0x0a);
  if (firstLf < 0 || firstLf !== bytes.byteLength - 1) return null;
  const contentEnd =
    firstLf > 0 && bytes[firstLf - 1] === 0x0d ? firstLf - 1 : firstLf;
  const content = bytes.subarray(0, contentEnd);
  let line: string;
  try {
    line = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return null;
  }
  return /^[0-9]{6}$/u.test(line) ? line : null;
}

/**
 * readInteractiveConsoleLineFromStreamの処理を実行する。
 *
 * @responsibility readInteractiveConsoleLineFromStreamに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input stream: ReaderInput、cancellationSignal: AbortSignal
 * @returns Promise<string | null>を返す。
 * @precondition 「stream: ReaderInput、cancellationSignal: AbortSignal」がreadInteractiveConsoleLineFromStreamの入力契約を満たす。
 * @postcondition readInteractiveConsoleLineFromStreamの責務を完了した結果だけを返す。
 * @effect N/A: readInteractiveConsoleLineFromStreamは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readInteractiveConsoleLineFromStreamは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readInteractiveConsoleLineFromStreamは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readInteractiveConsoleLineFromStreamはProcess内の同一Subsystemで完結する。
 * @security N/A: readInteractiveConsoleLineFromStreamはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency readInteractiveConsoleLineFromStreamは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function readInteractiveConsoleLineFromStream(
  stream: ReaderInput,
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
    let settled = false;
    let isCleanupSuccessful = true;
    let deferredCompletion: NodeJS.Immediate | null = null;
    const bytes: number[] = [];
    const settle = (line: string | null) => {
      if (settled) return;
      settled = true;
      if (deferredCompletion) clearImmediate(deferredCompletion);
      try {
        stream.removeListener("data", onData);
      } catch {
        isCleanupSuccessful = false;
      }
      try {
        stream.removeListener("error", onFailure);
      } catch {
        isCleanupSuccessful = false;
      }
      try {
        stream.removeListener("end", onFailure);
      } catch {
        isCleanupSuccessful = false;
      }
      try {
        cancellationSignal.removeEventListener("abort", onFailure);
      } catch {
        isCleanupSuccessful = false;
      }
      try {
        stream.pause();
      } catch {
        isCleanupSuccessful = false;
      }
      resolve(isCleanupSuccessful ? line : null);
    };
    const onFailure = () => settle(null);
    const onData = (chunk: Buffer | string) => {
      if (!Buffer.isBuffer(chunk)) {
        settle(null);
        return;
      }
      bytes.push(...chunk);
      if (bytes.length > INTERACTIVE_CONSOLE_READER_MAXIMUM_BYTES) {
        settle(null);
        return;
      }
      if (chunk.includes(0x0a)) {
        if (!deferredCompletion) {
          deferredCompletion = setImmediate(() =>
            settle(parseInteractiveConsoleLine(Uint8Array.from(bytes))),
          );
        }
      }
    };
    try {
      stream.on("data", onData);
      stream.once("error", onFailure);
      stream.once("end", onFailure);
      cancellationSignal.addEventListener("abort", onFailure, { once: true });
      if (cancellationSignal.aborted) {
        settle(null);
        return;
      }
      stream.resume();
    } catch {
      settle(null);
    }
  });
}

/**
 * readOwnedInteractiveConsoleLineOutcomeUsingAdapterの処理を実行する。
 *
 * @responsibility readOwnedInteractiveConsoleLineOutcomeUsingAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input platform: NodeJS.Platform、cancellationSignal: AbortSignal、adapter: OwnedReaderAdapter
 * @returns Promise<OwnedInteractiveConsoleReadOutcome>を返す。
 * @precondition 「platform: NodeJS.Platform、cancellationSignal: AbortSignal、adapter: OwnedReaderAdapter」がreadOwnedInteractiveConsoleLineOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition readOwnedInteractiveConsoleLineOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: readOwnedInteractiveConsoleLineOutcomeUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readOwnedInteractiveConsoleLineOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readOwnedInteractiveConsoleLineOutcomeUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readOwnedInteractiveConsoleLineOutcomeUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: readOwnedInteractiveConsoleLineOutcomeUsingAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency readOwnedInteractiveConsoleLineOutcomeUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
  platform: NodeJS.Platform,
  cancellationSignal: AbortSignal,
  adapter: OwnedReaderAdapter,
): Promise<OwnedInteractiveConsoleReadOutcome> {
  if (cancellationSignal.aborted) {
    return Object.freeze({
      status: "cancelled",
      line: null,
      descriptorCloseConfirmed: true,
    });
  }
  const device = platform === "win32" ? "\\\\.\\CONIN$" : "/dev/tty";
  let descriptor: number | null = null;
  try {
    descriptor = adapter.open(device, "r");
  } catch {
    return Object.freeze({
      status: "reader_failed",
      line: null,
      descriptorCloseConfirmed: descriptor === null,
    });
  }

  const bytes = Buffer.alloc(INTERACTIVE_CONSOLE_READER_MAXIMUM_BYTES);
  let count: number | null = null;
  try {
    count = await new Promise<number | null>((resolve) => {
      let settled = false;
      const settle = (value: number | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        adapter.read(
          descriptor as number,
          bytes,
          0,
          bytes.byteLength,
          null,
          (error, observedCount) =>
            settle(
              error ||
                !Number.isSafeInteger(observedCount) ||
                observedCount < 0 ||
                observedCount > bytes.byteLength
                ? null
                : observedCount,
            ),
        );
      } catch {
        settle(null);
      }
    });
  } catch {
    count = null;
  }
  let isClosed = true;
  try {
    adapter.close(descriptor);
  } catch {
    isClosed = false;
  }
  if (cancellationSignal.aborted) {
    return Object.freeze({
      status: "cancelled",
      line: null,
      descriptorCloseConfirmed: isClosed,
    });
  }
  const line =
    count === null
      ? null
      : parseInteractiveConsoleLine(bytes.subarray(0, count));
  return line === null || !isClosed
    ? Object.freeze({
        status: "reader_failed",
        line: null,
        descriptorCloseConfirmed: isClosed,
      })
    : Object.freeze({
        status: "completed",
        line,
        descriptorCloseConfirmed: true,
      });
}

/**
 * writeResultの処理を実行する。
 *
 * @responsibility writeResultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input status: "completed" | "blocked"、line: string | null、cancellationSignal: AbortSignal
 * @returns Promise<boolean>を返す。
 * @precondition 「status: "completed" | "blocked"、line: string | null、cancellationSignal: AbortSignal」がwriteResultの入力契約を満たす。
 * @postcondition writeResultの責務を完了した結果だけを返す。
 * @effect writeResultは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure writeResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeResultは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: writeResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeResultは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function writeResult(
  status: "completed" | "blocked",
  line: string | null,
  cancellationSignal: AbortSignal,
): Promise<boolean> {
  const result = Object.freeze({
    contract: INTERACTIVE_CONSOLE_READER_CONTRACT,
    contractRevision: INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
    status,
    line,
  });
  if (!process.connected || cancellationSignal.aborted)
    return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => settle(false), 1_000);
    timeout.unref();
    const cleanup = () => {
      clearTimeout(timeout);
      process.removeListener("disconnect", onDisconnect);
      process.stdout.removeListener("error", onError);
      cancellationSignal.removeEventListener("abort", onAbort);
    };
    const settle = (isSuccessful: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(isSuccessful);
    };
    const onDisconnect = () => settle(false);
    const onError = () => settle(false);
    const onAbort = () => settle(false);
    process.once("disconnect", onDisconnect);
    process.stdout.once("error", onError);
    cancellationSignal.addEventListener("abort", onAbort, { once: true });
    if (!process.connected || cancellationSignal.aborted) {
      settle(false);
      return;
    }
    try {
      process.stdout.write(`${JSON.stringify(result)}\n`, (error) =>
        settle(!error && process.connected && !cancellationSignal.aborted),
      );
    } catch {
      settle(false);
    }
  });
}

/**
 * mainの処理を実行する。
 *
 * @responsibility mainに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns mainの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了した結果だけを返す。
 * @effect mainはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: mainは独自の失敗分岐を所有しない。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  process.exitCode = 2;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
  );
  timeout.unref();
  const onMessage = (message: unknown) => {
    if (message === "cancel") {
      controller.abort();
      process.kill(process.pid, "SIGKILL");
    }
  };
  const onDisconnect = () => {
    controller.abort();
    process.kill(process.pid, "SIGKILL");
  };
  process.on("message", onMessage);
  process.once("disconnect", onDisconnect);
  try {
    if (!process.connected) return;
    const outcome = await readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
      process.platform,
      controller.signal,
      Object.freeze({
        open: fs.openSync,
        close: fs.closeSync,
        read: fs.read,
      }),
    );
    if (!process.connected || controller.signal.aborted) return;
    const readerStatus =
      outcome.status === "completed" ? "completed" : "blocked";
    const isWritten = await writeResult(
      readerStatus,
      outcome.line,
      controller.signal,
    );
    process.exitCode = isWritten && outcome.status === "completed" ? 0 : 2;
    if (isWritten && process.connected) process.disconnect();
  } finally {
    clearTimeout(timeout);
    process.removeListener("message", onMessage);
    process.removeListener("disconnect", onDisconnect);
  }
}

if (
  process.argv.length === 2 &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main().catch(() => {
    process.exitCode = 2;
  });
}
