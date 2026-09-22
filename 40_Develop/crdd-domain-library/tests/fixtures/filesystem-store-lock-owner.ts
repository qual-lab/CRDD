/**
 * Filesystem Store Lockを別Processで保持する固定試験Worker。
 *
 * @packageDocumentation
 * @responsibility Owner Processの生存中と異常終了後を実境界で再現する。
 * @trace RFD-UT-006
 * @level UT
 * @scope filesystem-store-root、process-owner、recovery
 * @boundary Test Process→別Node Process→Filesystem Lock。
 */
import fs from "node:fs";

import {
  createFilesystemStoreRoot,
  withFilesystemStoreLock,
} from "../../src/filesystem-store-root/index.ts";

const [root, readyFile] = process.argv.slice(2);
if (!root || !readyFile)
  throw new Error("filesystem_store_worker_input_required");
const capability = createFilesystemStoreRoot(root);
if (!capability) throw new Error("filesystem_store_worker_root_invalid");
withFilesystemStoreLock(capability, "locks/store.lock", () => {
  fs.writeFileSync(readyFile, "ready\n", { flag: "wx" });
  const waitArray = new Int32Array(new SharedArrayBuffer(4));
  while (true) Atomics.wait(waitArray, 0, 0, 1_000);
});
