#!/usr/bin/env node
/**
 * 配布RepositoryからAccess ManagementのHost対話入口を起動する。
 * @packageDocumentation
 * @responsibility 薄い配布入口から同じ公開Host commandへ委譲する。
 * @trace ARCH-000013
 */
import { runHostAccessCommand } from "../../40_Develop/access-management/src/index.ts";
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
