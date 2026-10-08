/**
 * Kernel Lockを所有する固定試験Processを実行する。
 *
 * @packageDocumentation
 * @responsibility 指定した試験ModeでStore・Host・SupervisorのLockを取得し、競合観測の前提を作る。
 * @trace CPR-IT-001
 * @trace ERB-IT-003
 * @level IT
 * @scope Store／Host Lockの所有と競合
 * @boundary 試験Process→Native Lock。利用側試験が終了とLock解放を確認する。
 */
import {
  acquireRuntimeOwnedCandidateStoreKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
} from "../../src/host-execution/kernel-lock.ts";

const mode = process.argv[2];
const supervisorOutcome =
  mode === "host-supervisor"
    ? await acquireRuntimeOwnedHostOperationSupervisorLock(
        process.argv[3],
        process.argv[4],
      )
    : null;
const lock =
  mode === "host-supervisor"
    ? supervisorOutcome?.status === "acquired"
      ? supervisorOutcome.lock
      : null
    : mode === "host"
      ? acquireRuntimeOwnedHostOperationKernelLock(
          process.argv[3],
          process.argv[4],
        )
      : acquireRuntimeOwnedCandidateStoreKernelLock(mode);
if (!lock) process.exit(2);
process.stdout.write("READY\n");
setInterval(() => {}, 1_000);
