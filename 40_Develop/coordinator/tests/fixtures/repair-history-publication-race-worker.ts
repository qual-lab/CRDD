import fs from "node:fs";
import path from "node:path";
import { createRepairHistoryPublicationTestingAdapter } from "../support/helpers/docker-desktop-repair-history-publication-testing.ts";

const [
  directory,
  targetName,
  preparationName,
  contentBase64,
  start,
  ready,
  release,
] = process.argv.slice(2);
if (
  !directory ||
  !targetName ||
  !preparationName ||
  !contentBase64 ||
  !start ||
  !ready ||
  !release
)
  process.exit(2);

while (!fs.existsSync(start))
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
const adapter = createRepairHistoryPublicationTestingAdapter(directory, {
  observeBeforeLink: () => {
    fs.writeFileSync(ready, `${process.pid}\n`, { flag: "wx" });
    while (!fs.existsSync(release))
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  },
});
const isResult = adapter.publish(
  path.basename(targetName),
  path.basename(preparationName),
  Buffer.from(contentBase64, "base64"),
);
process.stdout.write(`${JSON.stringify({ result: isResult })}\n`);
