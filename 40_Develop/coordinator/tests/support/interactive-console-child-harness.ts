import type { ChildProcess } from "node:child_process";

import type { InteractiveConsoleReadOutcome } from "../../src/core/interactive-console.ts";
import { runInteractiveConsoleReaderLifecycle } from "../../src/core/interactive-console-reader-lifecycle-internal.ts";

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
