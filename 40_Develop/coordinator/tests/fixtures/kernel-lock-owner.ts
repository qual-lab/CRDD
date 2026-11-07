/**
 * 新品Host世代のwxを子Processで保持する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary 親試験から受け取ったRepository-localのexact Rootだけ。
 */
import { acquireHostOperationLock } from "../../src/execution/kernel-lock.ts";
const result = acquireHostOperationLock(process.argv[2], process.argv[3]);
if (result.status !== "acquired") process.exit(2);
process.stdout.write("READY\n");
process.on("message", (message) => {
  if (message === "release") {
    const released = result.lock.release();
    process.send?.({ released }, () => process.exit(released ? 0 : 3));
  }
});
