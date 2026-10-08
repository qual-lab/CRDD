/**
 * 履歴公開の競合を起こす固定Workerを実行する。
 *
 * @packageDocumentation
 * @responsibility 試験領域・対象名・準備名に結合して公開操作を実行し、競合時の結果を返す。
 * @trace ERB-IT-001
 * @level IT
 * @scope 履歴公開の競合Worker
 * @boundary 固定Worker→自己生成Filesystem対象。実履歴を更新しない。
 */
import fs from "node:fs";
import path from "node:path";
import { createRepairHistoryPublicationTestingAdapter } from "../support/repair-history-publication-fixture.ts";

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
