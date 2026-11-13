/**
 * 保存専用Kernelを子Processで保持する。
 * @packageDocumentation
 * @responsibility 親試験の競合・強制終了後の再取得を観測可能にする。
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定Hashだけ。
 * @boundary 今回試験のProcessと既存OS排他。
 */
import { acquireExecutionStateLock } from "../../src/storage/lock.ts";

const lock = acquireExecutionStateLock(process.argv[2], process.argv[3] ?? "");
if (lock.status !== "acquired") process.exit(2);
process.stdout.write("READY\n");
setInterval(() => {}, 1000);
