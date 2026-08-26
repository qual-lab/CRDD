import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../../src/security/candidate-store-kernel-lock.ts";

const outcome = await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
if (outcome.status !== "acquired" || !outcome.lock) process.exitCode = 2;
else if ((await outcome.lock.release()) !== "released") process.exitCode = 3;
else process.stdout.write("LOCK_RELEASED\n");
