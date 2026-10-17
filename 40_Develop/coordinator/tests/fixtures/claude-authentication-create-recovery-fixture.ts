/**
 * 認証を開始せず本番作成・保存Ownerを別Processで確認する。
 * @packageDocumentation
 * @responsibility 自己生成試験Rootの五実IDを既存回復記録へ保存してProcessを終了する。
 * @trace ERB-IT-002
 * @trace ERB-IT-017
 * @level IT
 * @scope 未起動認証資源、本番CLI構成、既存記録とHome排他。
 * @boundary 別Node ProcessからDocker／保存／Windows排他。
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClaudeSubscriptionAuthenticationDependencies,
  createClaudeSubscriptionAuthenticationPlan,
  createClaudeSubscriptionAuthenticationRecoveryRecord,
} from "../../src/provider/claude-subscription-authentication.ts";

/**
 * 固定試験入力から五資源を作成して保存完了後に終了する。
 * @responsibility 実createとReceipt保存を同じin_flightへ接続する。
 * @trace ERB-IT-002
 * @trace ERB-IT-017
 * @precondition 指定Rootは現在Repositoryの自己生成試験Rootである。
 * @stimulus 本番argv・環境の未起動資源だけを生成して保存・読戻しする。
 * @observation 完了・既存排他解放だけを親へ返す。
 * @oracle 全作成Receiptはidle前に保存される。
 * @cleanup 親が保存実IDから回収する。子は既存排他を解放する。
 * @boundary 実Docker作成結果と既存耐久記録。
 */
async function createRecordedAuthenticationFixture() {
  const directory = process.argv[2];
  const hash = process.argv[3];
  assert.ok(directory && hash && /^[a-f0-9]{64}$/u.test(hash));
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = fs.realpathSync(path.join(repository, ".crdd", "tests"));
  assert.equal(path.dirname(fs.realpathSync(directory)), parent);
  assert.ok(
    path.basename(directory).startsWith("claude-authentication-record-"),
  );
  const home = path.join(directory, "ProviderHomes", "claude");
  const plan = createClaudeSubscriptionAuthenticationPlan(
    home,
    hash.slice(0, 16),
    randomBytes(32).toString("hex"),
  );
  assert.ok(plan);
  const record = createClaudeSubscriptionAuthenticationRecoveryRecord(
    home,
    hash,
    plan,
  );
  assert.ok(record);
  const dependencies = createClaudeSubscriptionAuthenticationDependencies();
  const lock = dependencies.acquireProviderHomeLock(hash);
  assert.ok(lock);
  let completed = false;
  let released = false;
  try {
    assert.equal(dependencies.beginRecovery(record), "created");
    for (const command of plan.commands.filter(
      (item) =>
        item.purpose.startsWith("create_") ||
        item.purpose === "connect_proxy_egress",
    )) {
      assert.equal(
        dependencies.setRecoveryCommandState(
          record,
          "in_flight",
          command.purpose,
        ),
        true,
      );
      const result = await dependencies.run(command, lock.assertLive, plan);
      assert.equal(result.processCompletionConfirmed, true);
      assert.equal(result.status, 0);
      assert.equal(result.error, undefined);
      if (command.purpose.startsWith("create_"))
        assert.equal(dependencies.recordCreatedResource(record, result), true);
      assert.equal(lock.assertLive(), true);
      assert.equal(
        dependencies.setRecoveryCommandState(record, "idle", null),
        true,
      );
    }
    completed = true;
  } finally {
    released = lock.release();
  }
  process.stdout.write(
    `${JSON.stringify({ completed, lockReleased: released })}\n`,
  );
  assert.equal(released, true);
}

await createRecordedAuthenticationFixture();
