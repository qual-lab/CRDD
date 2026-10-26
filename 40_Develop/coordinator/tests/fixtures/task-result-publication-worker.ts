/**
 * 同じTask受領保存を別Processから再提示する試験入口。
 * @packageDocumentation
 * @responsibility 実際の本番Port構築とwriteStateを通常のFile起動で確認する。
 * @trace PRL-IT-012
 * @level IT
 * @scope 合成Task受領の別Process再入場。
 * @boundary PRL-IT-012=Direct Boundary: 子Process→本番Persistence Port→共通Writer。
 */
import fs from "node:fs";
import { createCurrentCoordinatorPersistencePorts } from "../../src/state/transaction.ts";

const packet = JSON.parse(fs.readFileSync(0, "utf8"));
const ports = createCurrentCoordinatorPersistencePorts(
  packet.root,
  "binding-a",
);
const result = ports.state.writeState(
  packet.args[0],
  packet.args[1],
  packet.args[2],
);
process.stdout.write(JSON.stringify(result));
