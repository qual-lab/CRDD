import type { ChildProcess } from "node:child_process";

import {
  INTERACTIVE_CONSOLE_READER_CONTRACT,
  INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
} from "./interactive-console-reader.ts";

const READER_MAXIMUM_OUTPUT_BYTES = 512;
const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 110_000;

export type InteractiveConsoleReaderLifecycleOutcome = Readonly<{
  status:
    | "completed"
    | "cancelled"
    | "timeout"
    | "reader_failed"
    | "cleanup_unknown";
  line: string | null;
}>;

export type InteractiveConsoleReaderLifecycleSnapshot = Readonly<{
  inputDescriptor: number;
}>;

export type InteractiveConsoleReaderLifecycleAdapter = Readonly<{
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}>;

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
    !["completed", "blocked"].includes(String(record.status)) ||
    (record.status === "completed"
      ? typeof record.line !== "string" || !/^[0-9]{6}$/u.test(record.line)
      : record.line !== null)
  )
    return null;
  return Object.freeze({
    status: record.status as "completed" | "blocked",
    line: typeof record.line === "string" ? record.line : null,
  });
}

export function runInteractiveConsoleReaderLifecycle(
  snapshot: InteractiveConsoleReaderLifecycleSnapshot,
  cancellationSignal: AbortSignal,
  child: ChildProcess,
  adapter: InteractiveConsoleReaderLifecycleAdapter,
): Promise<InteractiveConsoleReaderLifecycleOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let isInvalid = false;
    let isChildClosed = false;
    let childExitCode: number | null = null;
    let isOutputClosed = false;
    let outputBytes = 0;
    const outputBuffers: Buffer[] = [];
    let killTimer: NodeJS.Timeout | null = null;
    let isCompletionObserved = false;
    let isCompletionForceStopIssued = false;
    let outcomeStatus: InteractiveConsoleReaderLifecycleOutcome["status"] =
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
      const cleanup = (operation: () => void) => {
        try {
          operation();
        } catch {
          isInvalid = true;
          outcomeStatus = "cleanup_unknown";
        }
      };
      cleanup(() => void child.removeListener("error", onFailure));
      cleanup(() => void child.removeListener("close", onClose));
      if (child.stdout) {
        cleanup(() => void child.stdout?.removeListener("data", onData));
        cleanup(() => void child.stdout?.removeListener("error", onFailure));
        cleanup(
          () => void child.stdout?.removeListener("close", onOutputClose),
        );
      }
      cleanup(
        () => void cancellationSignal.removeEventListener("abort", onAbort),
      );
      cleanup(() => {
        if (child.connected) child.disconnect();
      });
      const parsed =
        !isInvalid && !cancellationSignal.aborted
          ? parseReaderResult(Buffer.concat(outputBuffers, outputBytes))
          : null;
      const completed =
        parsed?.status === "completed" &&
        (childExitCode === 0 ||
          (isCompletionObserved && isCompletionForceStopIssued));
      resolve(
        Object.freeze({
          status: completed
            ? "completed"
            : outcomeStatus === "cleanup_unknown"
              ? "cleanup_unknown"
              : cancellationSignal.aborted
                ? "cancelled"
                : outcomeStatus,
          line: completed ? parsed.line : null,
        }),
      );
    };
    const forceStop = () => {
      if (isCompletionObserved) isCompletionForceStopIssued = true;
      try {
        if (!child.kill("SIGKILL")) {
          isInvalid = true;
          outcomeStatus = "cleanup_unknown";
        }
      } catch {
        isInvalid = true;
        outcomeStatus = "cleanup_unknown";
      }
    };
    const requestStop = (
      reason: Exclude<
        InteractiveConsoleReaderLifecycleOutcome["status"],
        "completed" | "cleanup_unknown"
      > = "reader_failed",
    ) => {
      isInvalid = true;
      if (outcomeStatus !== "timeout" && reason !== "reader_failed")
        outcomeStatus = reason;
      try {
        if (child.connected) child.send("cancel", () => undefined);
      } catch {
        // The exact child is force-terminated by the bounded fallback.
      }
      if (!killTimer)
        killTimer = adapter.setTimeout(forceStop, READER_CANCEL_GRACE_MS);
    };
    const onAbort = () => requestStop("cancelled");
    const onFailure = () => requestStop("reader_failed");
    const onData = (chunk: Buffer | string) => {
      if (!Buffer.isBuffer(chunk)) return requestStop("reader_failed");
      outputBytes += chunk.byteLength;
      if (outputBytes > READER_MAXIMUM_OUTPUT_BYTES)
        return requestStop("reader_failed");
      outputBuffers.push(Buffer.from(chunk));
      const parsed = parseReaderResult(
        Buffer.concat(outputBuffers, outputBytes),
      );
      if (parsed?.status === "completed" && !isCompletionObserved) {
        isCompletionObserved = true;
        if (!killTimer)
          killTimer = adapter.setTimeout(forceStop, READER_CANCEL_GRACE_MS);
      }
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
      void snapshot.inputDescriptor;
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
      cancellationSignal.addEventListener("abort", onAbort, { once: true });
      if (cancellationSignal.aborted) onAbort();
    } catch {
      requestStop("reader_failed");
    }
  });
}
