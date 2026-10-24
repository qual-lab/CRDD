import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// No signature, credential, consent, Provider, Docker or repository mutation.
// Run from an actual terminal; this is not a simulated isTTY test.
assert.equal(process.stdout.isTTY, true, "terminal_required");
const launcher = fileURLToPath(
  new URL("../../bin/coordinator.ts", import.meta.url),
);
for (const [args, expected] of [
  [["--help"], 0],
  [["automation", "--help", "--json"], 64],
] as const) {
  const result = spawnSync(process.execPath, [launcher, ...args], {
    stdio: ["pipe", "inherit", "inherit"],
    timeout: 30_000,
    windowsHide: false,
    shell: false,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, expected);
}
for (const mode of ["sign-release", "promote-release"]) {
  const result = spawnSync(process.execPath, [launcher, mode], {
    stdio: ["pipe", "inherit", "pipe"],
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: false,
    shell: false,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /coordinator_launch_mode_invalid/u);
}
console.log("起動入口の端末結合確認: 合格（秘密入力・外部送信なし）");
