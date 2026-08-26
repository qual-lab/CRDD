import { PassThrough } from "node:stream";

import { readOwnedInteractiveConsoleLineOutcomeUsingAdapter } from "../../src/core/interactive-console-reader.ts";

const stream = new PassThrough() as PassThrough & { isTTY: boolean };
stream.isTTY = true;

const pending = readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
  "win32",
  new AbortController().signal,
  Object.freeze({
    open: () => 17,
    closeUnownedDescriptor: () => undefined,
    createOwnedStream: () => stream,
    destroyAndConfirmClose: async () => {
      stream.destroy();
      return false;
    },
  }) as unknown as Parameters<
    typeof readOwnedInteractiveConsoleLineOutcomeUsingAdapter
  >[2],
);

stream.write(Buffer.from("123456\r\n", "utf8"));
const outcome = await pending;
process.stdout.write(`${JSON.stringify(outcome)}\n`);
process.exit(outcome.status === "completed" ? 0 : 2);
