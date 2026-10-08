/**
 * Recovery Lockの競合を観測する固定Processを実行する。
 *
 * @packageDocumentation
 * @responsibility 指定BindingのLockを所有・観測し、別Processとの排他条件を試験する。
 * @trace PRL-IT-013
 * @level IT
 * @scope Recovery State Lockの所有と再取得
 * @boundary 試験Process→Kernel Lock Controller。Docker復旧やProvider依頼は発行しない。
 */
import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "../../src/host-execution/kernel-lock.ts";
import { createDockerRecoveryRuntimeStateLockController } from "../../src/docker-execution/recovery-lock-controller.ts";

const mode = process.argv[2];
const binding = process.argv[3];

if (mode === "probe") {
  const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(binding);
  if (!lock) process.exit(2);
  process.exit(lock.release() ? 0 : 3);
}

if (mode === "controller") {
  const controller = createDockerRecoveryRuntimeStateLockController(binding);
  if (!controller) process.exit(2);
  process.stdout.write("READY\n");
  setInterval(() => {}, 1_000);
} else process.exit(4);
