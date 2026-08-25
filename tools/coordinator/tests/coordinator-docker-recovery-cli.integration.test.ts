import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const RECOVERY_ID = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

function invokeCli(isJson: boolean) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.resolve("bin/coordinator.ts"),
      "doctor",
      "--recover-isolation",
      RECOVERY_ID,
      ...(isJson ? ["--json"] : []),
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

test("実CLIのdocker-task dispatchはJSONでexact IDと安全なblocked理由を返す", () => {
  const result = invokeCli(true);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "blocked",
    reason: "docker_task_runtime_state_unavailable",
    recoveryId: RECOVERY_ID,
  });
  assert.equal(result.stderr, "");
});

test("実CLIの人間表示はexact回復commandを保持しHost Pathを出さない", () => {
  const result = invokeCli(false);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /Coordinator environment: blocked/u);
  assert.match(result.stdout, new RegExp(`recovery ID: ${RECOVERY_ID}`, "u"));
  assert.match(
    result.stdout,
    new RegExp(
      `next: coordinator doctor --recover-isolation ${RECOVERY_ID}`,
      "u",
    ),
  );
  assert.doesNotMatch(result.stdout, /C:\\/u);
  assert.equal(result.stderr, "");
});
