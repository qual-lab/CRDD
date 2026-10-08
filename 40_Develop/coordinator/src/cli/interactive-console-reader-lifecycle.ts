/**
 * interactive-console-reader-lifecycle-internalに属する責務をまとめる。
 *
 * @responsibility InteractiveConsoleReaderLifecycleOutcomeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { ChildProcess } from "node:child_process";

import {
  INTERACTIVE_CONSOLE_READER_CONTRACT,
  INTERACTIVE_CONSOLE_READER_CONTRACT_REVISION,
} from "./interactive-console-reader.ts";

const READER_MAXIMUM_OUTPUT_BYTES = 512;
const READER_CANCEL_GRACE_MS = 500;
const READER_TIMEOUT_MS = 110_000;

/**
 * interactive-console-reader-lifecycle-internalで使用するInteractive Console Reader Lifecycle Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Reader Lifecycle OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleReaderLifecycleOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleReaderLifecycleOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleReaderLifecycleOutcomeの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleReaderLifecycleOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleReaderLifecycleOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleReaderLifecycleOutcome = Readonly<{
  status:
    | "completed"
    | "cancelled"
    | "timeout"
    | "reader_failed"
    | "cleanup_unknown";
  line: string | null;
}>;

/**
 * interactive-console-reader-lifecycle-internalで使用するInteractive Console Reader Lifecycle Snapshotの値契約を定義する。
 *
 * @responsibility Interactive Console Reader Lifecycle SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleReaderLifecycleSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleReaderLifecycleSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleReaderLifecycleSnapshotの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleReaderLifecycleSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleReaderLifecycleSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleReaderLifecycleSnapshot = Readonly<{
  inputDescriptor: number;
}>;

/**
 * interactive-console-reader-lifecycle-internalで使用するInteractive Console Reader Lifecycle Adapterの値契約を定義する。
 *
 * @responsibility Interactive Console Reader Lifecycle AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape InteractiveConsoleReaderLifecycleAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleReaderLifecycleAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleReaderLifecycleAdapterの宣言は外部境界を開かない。
 * @security N/A: InteractiveConsoleReaderLifecycleAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility InteractiveConsoleReaderLifecycleAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleReaderLifecycleAdapter = Readonly<{
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}>;

/**
 * Reader 結果を構造化値へ解析する。
 *
 * @responsibility Reader 結果の入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input source: Buffer
 * @returns parseReaderResultの計算結果を返す。
 * @precondition 「source: Buffer」がparseReaderResultの入力契約を満たす。
 * @postcondition parseReaderResultの責務を完了した結果だけを返す。
 * @effect N/A: parseReaderResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseReaderResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseReaderResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseReaderResultはProcess内の同一Subsystemで完結する。
 * @security N/A: parseReaderResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseReaderResultは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Interactive Console Reader Lifecycleを実行する。
 *
 * @responsibility Interactive Console Reader Lifecycleの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input snapshot: InteractiveConsoleReaderLifecycleSnapshot、cancellationSignal: AbortSignal、child: ChildProcess、adapter: InteractiveConsoleReaderLifecycleAdapter
 * @returns Promise<InteractiveConsoleReaderLifecycleOutcome>を返す。
 * @precondition 「snapshot: InteractiveConsoleReaderLifecycleSnapshot、cancellationSignal: AbortSignal、child: ChildProcess、adapter: InteractiveConsoleReaderLifecycleAdapter」がrunInteractiveConsoleReaderLifecycleの入力契約を満たす。
 * @postcondition runInteractiveConsoleReaderLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: runInteractiveConsoleReaderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runInteractiveConsoleReaderLifecycleは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runInteractiveConsoleReaderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runInteractiveConsoleReaderLifecycleはProcess内の同一Subsystemで完結する。
 * @security N/A: runInteractiveConsoleReaderLifecycleはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runInteractiveConsoleReaderLifecycleは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
      const isCompleted =
        parsed?.status === "completed" &&
        (childExitCode === 0 ||
          (isCompletionObserved && isCompletionForceStopIssued));
      resolve(
        Object.freeze({
          status: isCompleted
            ? "completed"
            : outcomeStatus === "cleanup_unknown"
              ? "cleanup_unknown"
              : cancellationSignal.aborted
                ? "cancelled"
                : outcomeStatus,
          line: isCompleted ? parsed.line : null,
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
