/**
 * 独立ProcessでRepository保存排他を保持する試験入口。
 *
 * @packageDocumentation
 * @responsibility OS排他の競合とOwner強制終了を試験へ提供する。
 * @trace PRL-IT-005
 * @level IT
 * @scope orchestrator、snapshot、lock
 * @boundary PRL-IT-005=Direct Boundary: 独立Process→Windows Named Pipe。
 */
import { acquireOrchestratorSnapshotPilotLock } from "../../../orchestrator/src/storage/current-state.ts";

const result = acquireOrchestratorSnapshotPilotLock(process.argv[2] ?? "");
if (result.status !== "completed") {
  process.stdout.write(result.reason);
  process.exit(21);
}
if (!result.value.assertLive()) {
  process.stdout.write("lock_not_live");
  process.exit(22);
}
process.stdout.write("ready");
setInterval(() => {}, 1000);
