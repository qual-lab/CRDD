/**
 * 新品Host世代のwxを子Processで保持する。
 * @trace ERB-IT-003
 * @level IT
 * @boundary 親試験から受け取ったRepository-localのexact Rootだけ。
 */
import { getRepository } from "@qual-lab/crdd-version-control";
import { acquireHostOperationLock } from "../../src/lifecycle/host.ts";
const repository = getRepository(process.argv[2]);
if (repository.status !== "completed") process.exit(2);
const result = acquireHostOperationLock(repository.capability, process.argv[3]);
if (result.status !== "acquired") process.exit(2);
process.stdout.write("READY\n");
process.on("message", (message) => {
  if (message === "release") {
    const released = result.lock.release();
    process.send?.({ released }, () => process.exit(released ? 0 : 3));
  }
});
