/**
 * 対話Readerの子Process操作を試験へ接続する。
 *
 * @packageDocumentation
 * @responsibility 注入した子Processの開始・取消・終了をReader Lifecycleへ搬送する。
 * @trace EST-ST-003
 * @level ST
 * @scope 対話入力Readerの子Process所有
 * @boundary 試験用Process Adapter→Reader Lifecycle。実利用者の秘密入力は取得しない。
 */
import type { ChildProcess } from "node:child_process";

import type { InteractiveConsoleReadOutcome } from "../../src/cli/interactive-console.ts";
import { runInteractiveConsoleReaderLifecycle } from "../../src/cli/interactive-console-reader-lifecycle.ts";

export function readInteractiveConsoleLineOutcomeUsingAdapter(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
  adapter: Readonly<{
    isTty: (descriptor: number) => boolean;
    createChild: () => ChildProcess;
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  }>,
): Promise<InteractiveConsoleReadOutcome> {
  if (
    !Number.isSafeInteger(inputDescriptor) ||
    inputDescriptor < 0 ||
    cancellationSignal.aborted ||
    !adapter.isTty(inputDescriptor)
  )
    return Promise.resolve(
      Object.freeze({
        status: cancellationSignal.aborted ? "cancelled" : "reader_failed",
        line: null,
      }) as InteractiveConsoleReadOutcome,
    );
  let child: ChildProcess;
  try {
    child = adapter.createChild();
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
    Object.freeze({
      setTimeout: adapter.setTimeout,
      clearTimeout: adapter.clearTimeout,
    }),
  );
}
