/**
 * 公式素材Storeへ並行判断を発行する固定Test Worker。
 *
 * @packageDocumentation
 * @responsibility Barrier後に別Processから同じRevisionの判断を一度発行する。
 * @trace OAG-IT-006
 * @boundary Worker Process→Filesystem Store Lock→Official Asset Store。
 * @effect Test Root内のReady、結果および素材Storeだけを変更する。
 * @security 検証済みTest Root Capability外へ書き込まない。
 */
import fs from "node:fs";
import path from "node:path";

import { createFilesystemStoreRoot } from "../../../crdd-domain-library/src/filesystem-store-root/index.ts";
import {
  createFileOfficialAssetStore,
  executeOfficialAssetDecision,
  type OfficialAssetDecisionInput,
  type OfficialAssetRecord,
} from "../../src/index.ts";

const [root, storeFile, readyFile, startFile, resultFile, inputJson] =
  process.argv.slice(2);
if (
  !root ||
  !storeFile ||
  !readyFile ||
  !startFile ||
  !resultFile ||
  !inputJson
)
  throw new Error("official_asset_worker_arguments_invalid");
const capability = createFilesystemStoreRoot(root);
if (!capability) throw new Error("official_asset_worker_root_invalid");
const initial = JSON.parse(
  fs.readFileSync(storeFile, "utf8"),
) as OfficialAssetRecord;
const store = createFileOfficialAssetStore(
  capability,
  path.relative(root, storeFile),
  initial,
);
fs.writeFileSync(readyFile, "ready\n", { flag: "wx" });
while (!fs.existsSync(startFile))
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
const result = executeOfficialAssetDecision(
  store,
  { verify: () => true },
  JSON.parse(inputJson) as OfficialAssetDecisionInput,
);
fs.writeFileSync(resultFile, `${JSON.stringify(result)}\n`, { flag: "wx" });
