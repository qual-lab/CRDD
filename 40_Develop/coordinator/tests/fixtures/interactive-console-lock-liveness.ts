/**
 * 対話Kernel Lockの生存と再取得を別Processで観測する。
 *
 * @packageDocumentation
 * @responsibility 固定回数の取得試行で所有者の終了後にLockが再取得できるかを返す。
 * @trace CPR-IT-001
 * @trace ERB-IT-003
 * @level IT
 * @scope 対話Lockの生存・解放
 * @boundary 試験Process→Native Kernel Lock。取得不能を正常終了へ丸めない。
 */
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../../src/host-execution/kernel-lock.ts";

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
