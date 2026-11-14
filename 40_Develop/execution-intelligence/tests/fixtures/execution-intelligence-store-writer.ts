/**
 * 競合出版とCrash残存を親試験へ観測させる別Process入口。
 * @packageDocumentation
 * @responsibility 親が渡した新品Rootで一件保存、又はready通知後にLock保持して親の終了要求を待つ。
 * @trace ERP-IT-002
 * @level IT
 * @scope 親試験が起動・終了・回収する専用Process。AI・Git・Dockerは起動しない。
 * @boundary stdoutは有限結果又はreadyだけ。Crash時のLock残存は親が観測し、exact Rootを回収する。
 */
import { createExecution } from "../../src/index.ts";
import { acquireLock } from "../../../lock/src/index.ts";
const directory = process.argv[2];
if (!directory) throw Error("fixture_directory_required");
if (process.argv[3] === "hold") {
  const lock = acquireLock({
    directory,
    name: "execution-intelligence.history.lock",
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
