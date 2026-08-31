import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createDockerRecoveryRuntimeStateLockController } from "../src/security/docker-recovery-lock-controller.ts";

const ownerFixture = new URL(
  "./fixtures/docker-recovery-lock-owner.ts",
  import.meta.url,
);

function acquireInChild(binding: string) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(ownerFixture), "probe", binding],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

test("長時間Effect中だけRuntimeState global lockを解放し前後で再取得する", () => {
  const binding = randomBytes(32).toString("hex");
  const controller = createDockerRecoveryRuntimeStateLockController(binding);
  assert.ok(controller);
  try {
    assert.equal(acquireInChild(binding).status, 2);
    controller.outsideLock(() => {
      assert.equal(acquireInChild(binding).status, 0);
    });
    assert.equal(acquireInChild(binding).status, 2);
  } finally {
    assert.equal(controller.close(), true);
  }
  assert.equal(acquireInChild(binding).status, 0);
});

test("production共有lock controllerのowner process強制終了後に再取得する", async () => {
  const binding = randomBytes(32).toString("hex");
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), "controller", binding],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("lock_controller_child_timeout")),
      10_000,
    );
    child.stdout.once("data", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`lock_controller_child_exit_${code}`));
      }
    });
  });
  assert.equal(acquireInChild(binding).status, 2);
  child.kill("SIGKILL");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  assert.equal(acquireInChild(binding).status, 0);
});
