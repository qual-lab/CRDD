import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../../src/security/candidate-store-kernel-lock.ts";

let outcome = await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
for (
  let attempt = 0;
  outcome.status === "unavailable" && attempt < 100;
  attempt += 1
) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  outcome = await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
}
if (outcome.status !== "acquired" || !outcome.lock) process.exitCode = 2;
else if ((await outcome.lock.release()) !== "released") process.exitCode = 3;
else process.stdout.write("LOCK_RELEASED\n");
