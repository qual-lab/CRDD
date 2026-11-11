/** 新品試験Rootだけを使う有限な別Process Writer。AI・Git・Dockerを起動しない。 */
import { createExecution } from "../../src/index.ts";
import { acquireLock } from "../../../lock/src/index.ts";
const directory = process.argv[2];
if (!directory) throw Error("fixture_directory_required");
if (process.argv[3] === "hold") {
  const lock = acquireLock({
    directory,
    name: "history.lock",
    identity: "execution-intelligence:history",
  });
  if (lock.status !== "acquired") throw Error("fixture_lock_failed");
  process.stdout.write("ready\n");
  setInterval(() => {}, 1000);
} else {
  process.stdout.write(
    JSON.stringify(
      createExecution(
        { directory, retentionDays: 30 },
        {
          executionId: "shared",
          startedAt: "2026-01-01T00:00:00Z",
          application: process.argv[3] ?? "app",
        },
      ),
    ) + "\n",
  );
}
