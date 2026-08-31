import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import { createDockerRecoveryRuntimeStateLockController } from "../../src/security/docker-recovery-lock-controller.ts";

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
