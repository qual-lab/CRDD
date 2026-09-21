/**
 * CROSの別Process耐久境界を実行する固定Test Worker。
 *
 * @packageDocumentation
 * @responsibility Source、DestinationおよびResult Returnを別Processから公開APIへ接続する。
 * @trace ERB-ST-013
 * @trace EST-ST-011
 * @boundary Test Parent→Worker Process→CROS Durable Store。
 * @effect Testが指定した一時Store内だけへ耐久Recordを作成する。
 * @security Test入力以外のPath、Credentialまたは環境値を読み取らない。
 */
import fs from "node:fs";

import {
  createHandoff,
  resumeDurableHandoff,
  settleDurableDelegatedResult,
  writeDurableHandoff,
  type DelegatedResult,
} from "../../src/index.ts";

const [command, first, second, third] = process.argv.slice(2);

if (command === "write-handoff" && first) {
  const handoff = createHandoff(
    "handoff-system-1",
    "task-1",
    "PRJ-1",
    "revision-1",
    ["read"],
    { requirement: "REQ-1" },
  );
  writeDurableHandoff(first, handoff);
  process.stdout.write(JSON.stringify(handoff));
} else if (command === "resume-handoff" && first && second && third) {
  const destination = JSON.parse(third) as Parameters<
    typeof resumeDurableHandoff
  >[2];
  process.stdout.write(
    JSON.stringify(resumeDurableHandoff(first, second, destination)),
  );
} else if (command === "write-origin" && first && second) {
  fs.writeFileSync(first, `${second}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(JSON.stringify({ written: true }));
} else if (command === "settle-result" && first && second && third) {
  const result = JSON.parse(third) as DelegatedResult;
  process.stdout.write(
    JSON.stringify(settleDurableDelegatedResult(result, first, second)),
  );
} else {
  throw new Error("cros_durable_boundary_worker_arguments_invalid");
}
