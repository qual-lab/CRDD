/**
 * Filesystem Store Lockの回復者と後続Ownerを同じBarrierで競合させる。
 *
 * @packageDocumentation
 * @responsibility 二つの回復Processと一つの取得Processの所有権遷移を実境界で再現する。
 * @trace RFD-UT-006
 * @level UT
 * @scope filesystem-store-root、kernel-lock、recovery-race
 * @boundary Test Process→別Node Process→OS Kernel Lock。
 */
import fs from "node:fs";

import {
  createFilesystemStoreRoot,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
  withFilesystemStoreLock,
} from "../../src/filesystem-store-root/index.ts";

const [mode, root, identity, readyFile, goFile, resultFile, releaseFile] =
  process.argv.slice(2);
if (!mode || !root || !identity || !readyFile || !goFile || !resultFile)
  throw new Error("filesystem_store_contender_input_required");
const capability = createFilesystemStoreRoot(root);
if (!capability) throw new Error("filesystem_store_contender_root_invalid");
const waitArray = new Int32Array(new SharedArrayBuffer(4));

if (mode === "recover") {
  const observation = observeFilesystemStoreLockOwnerAbsence(
    capability,
    "locks/store.lock",
    identity,
  );
  if (observation.status !== "confirmed")
    throw new Error(
      `filesystem_store_contender_observation_${observation.reason}`,
    );
  fs.writeFileSync(readyFile, "ready\n", { flag: "wx" });
  while (!fs.existsSync(goFile)) Atomics.wait(waitArray, 0, 0, 10);
  const result = recoverFilesystemStoreLock(
    capability,
    "locks/store.lock",
    observation.proof,
  );
  fs.writeFileSync(resultFile, `${JSON.stringify(result)}\n`, { flag: "wx" });
} else if (mode === "owner") {
  fs.writeFileSync(readyFile, "ready\n", { flag: "wx" });
  while (!fs.existsSync(goFile)) Atomics.wait(waitArray, 0, 0, 10);
  while (true) {
    const result = withFilesystemStoreLock(
      capability,
      "locks/store.lock",
      () => {
        fs.writeFileSync(resultFile, "acquired\n", { flag: "wx" });
        while (!releaseFile || !fs.existsSync(releaseFile))
          Atomics.wait(waitArray, 0, 0, 10);
        return "released";
      },
    );
    if (result.acquired) break;
    Atomics.wait(waitArray, 0, 0, 10);
  }
} else {
  throw new Error("filesystem_store_contender_mode_invalid");
}
