/**
 * 保存専用Kernelを子Processで保持する。
 * @packageDocumentation
 * @responsibility 親試験の競合・強制終了後の再取得を観測可能にする。
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定Hashだけ。
 * @boundary 今回試験のProcessと既存OS排他。
 */
import { acquireRuntimeOwnedCoordinatorStateKernelLock } from "../../src/storage/runtime-kernel-lock.ts";

const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(process.argv[2]);
if (!lock) process.exit(2);
process.stdout.write("READY\n");
setInterval(() => {}, 1000);
