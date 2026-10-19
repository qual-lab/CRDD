#!/usr/bin/env node
/**
 * Access ManagementのHost対話コマンドを起動する。
 * @packageDocumentation
 * @responsibility Process引数と取消を公開Host commandへ搬送する。
 * @trace ARCH-000013
 */
import { runHostAccessCommand } from "../src/cli/command.ts";

const controller = new AbortController();
const cancel = () => controller.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
try {
  process.exitCode = await runHostAccessCommand(
    process.argv.slice(2),
    process.env,
    process.stdin,
    process.stdout,
    controller.signal,
  );
} finally {
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
