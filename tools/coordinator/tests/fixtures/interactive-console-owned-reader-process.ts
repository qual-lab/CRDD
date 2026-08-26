import { readOwnedInteractiveConsoleLineOutcomeUsingAdapter } from "../../src/core/interactive-console-reader.ts";

let readBuffer: Buffer | null = null;
let readCallback:
  | ((error: NodeJS.ErrnoException | null, count: number) => void)
  | null = null;

const pending = readOwnedInteractiveConsoleLineOutcomeUsingAdapter(
  "win32",
  new AbortController().signal,
  Object.freeze({
    open: () => 17,
    close: () => {
      throw new Error("fixture_close_failed");
    },
    read: (
      _descriptor: number,
      buffer: Buffer,
      _offset: number,
      _length: number,
      _position: null,
      callback: (error: NodeJS.ErrnoException | null, count: number) => void,
    ) => {
      readBuffer = buffer;
      readCallback = callback;
    },
  }) as unknown as Parameters<
    typeof readOwnedInteractiveConsoleLineOutcomeUsingAdapter
  >[2],
);

const bytes = Buffer.from("123456\r\n", "utf8");
bytes.copy(readBuffer as unknown as Buffer);
(
  readCallback as unknown as (
    error: NodeJS.ErrnoException | null,
    count: number,
  ) => void
)(null, bytes.byteLength);
const outcome = await pending;
process.stdout.write(`${JSON.stringify(outcome)}\n`);
process.exit(outcome.status === "completed" ? 0 : 2);
