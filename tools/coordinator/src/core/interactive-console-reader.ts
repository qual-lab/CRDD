import { fileURLToPath } from "node:url";

export const INTERACTIVE_CONSOLE_READER_CONTRACT =
  "crdd-coordinator/interactive-console-reader";
export const INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION = 2;
export const INTERACTIVE_CONSOLE_READER_MAXIMUM_BYTES = 64;
export const INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS = 120_000;

type ReaderInput = Readonly<{
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

function writeResult(
  line: string | null,
  cancellationSignal: AbortSignal,
): Promise<boolean> {
  const result = Object.freeze({
    contract: INTERACTIVE_CONSOLE_READER_CONTRACT,
    contractRevision: INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
    status: line === null ? "blocked" : "completed",
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

async function main() {
  process.exitCode = 2;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    INTERACTIVE_CONSOLE_READER_ORPHAN_FAILSAFE_MS,
  );
  timeout.unref();
  const onMessage = (message: unknown) => {
    if (message === "cancel") controller.abort();
  };
  const onDisconnect = () => controller.abort();
  process.on("message", onMessage);
  process.once("disconnect", onDisconnect);
  try {
    if (!process.connected) return;
    const line = await readInteractiveConsoleLineFromStream(
      process.stdin,
      controller.signal,
    );
    if (!process.connected || controller.signal.aborted) return;
    const isWritten = await writeResult(line, controller.signal);
    process.exitCode = isWritten && line !== null ? 0 : 2;
    if (isWritten && process.connected) process.disconnect();
  } finally {
    clearTimeout(timeout);
    process.removeListener("message", onMessage);
    process.removeListener("disconnect", onDisconnect);
    try {
      process.stdin.pause();
    } catch {
      // Process termination is the remaining bounded cleanup boundary.
    }
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
