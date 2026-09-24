/**
 * coordinator:integration:docker-recovery-lock-controllerの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-recovery-lock-controllerが所有する検証責務を実行する。
 * @trace PRL-IT-013
 * @level IT
 * @scope docker、recovery、lock、controller
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createDockerRecoveryRuntimeStateLockController } from "../../src/security/docker-recovery-lock-controller.ts";

const ownerFixture = new URL(
  "../fixtures/docker-recovery-lock-owner.ts",
  import.meta.url,
);

/**
 * acquireInChildのTest準備責務を実行する。
 *
 * @responsibility acquireInChildがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus acquireInChildを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
function acquireInChild(binding: string) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(ownerFixture), "probe", binding],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

/**
 * 長時間Effect中だけRuntimeState global lockを解放し前後で再取得するを検証する。
 *
 * @responsibility 長時間Effect中だけRuntimeState global lockを解放し前後で再取得するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 長時間Effect中だけRuntimeState global lockを解放し前後で再取得するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
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

/**
 * production共有lock controllerのowner process強制終了後に再取得するを検証する。
 *
 * @responsibility production共有lock controllerのowner process強制終了後に再取得するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production共有lock controllerのowner process強制終了後に再取得するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
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
