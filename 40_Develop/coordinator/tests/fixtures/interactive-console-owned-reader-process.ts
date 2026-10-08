/**
 * 所有Readerの取消と未完了入力を試験する。
 *
 * @packageDocumentation
 * @responsibility 注入した読取りCallback・Bufferを保持し、取消後の応答と所有終了を観測する。
 * @trace EST-ST-003
 * @level ST
 * @scope 所有対話Readerの取消
 * @boundary 試験Adapter→Reader制御。実端末の秘密値は取得しない。
 */
import { readOwnedInteractiveConsoleLineOutcomeUsingAdapter } from "../../src/cli/interactive-console-reader.ts";

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
