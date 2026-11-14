/**
 * Executor通知とEM資源記録の接続を上位Ownerで検証する。
 * @packageDocumentation
 * @responsibility Intent・Receipt・最終観測の搬送と同じBookへの適用を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 有限技術Producerと純粋なEM値更新のみ。
 * @boundary 耐久保存・実AI・Docker・Filesystemの成立は主張しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
} from "../../../../execution-model/src/index.ts";
import { createAttemptExecutionFixture } from "../../../../executor/tests/fixtures/attempt-execution.ts";

/**
 * 元DI通知をDomainの同じ記録へ順次適用する。
 * @responsibility 発行前Intent・Receipt・最終観測の順序を結合して確認する。
 * @trace ERB-UT-023
 * @boundary 実宣言と純粋Domain。物理耐久性・Docker実体の主張ではない。
 * @precondition 実入力構築とAdapter本文。実Process・Docker・AIは使用しない。
 * @stimulus 通常Attemptの必須通知は同じBookへIntent・Receipt・最終観測を接続できるの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 通常Attemptの必須通知は同じBookへIntent・Receipt・最終観測を接続できるという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 */
test("通常Attemptの必須通知は同じBookへIntent・Receipt・最終観測を接続できる", async () => {
  const f = createAttemptExecutionFixture();
  let book: OperationResources | null = null;
  let closed = false;
  await f.run({
    onCommandSubmitting: (purpose, resources) => {
      if (!purpose.startsWith("create_")) return;
      book = applyResourceEvent(
        book,
        JSON.parse(
          JSON.stringify({ ...resources, event: "submission", key: purpose }),
        ),
      );
      assert.ok(book, "後続Effect前に同じ資源のIntentが成立する");
    },
    onResourceCreated: (purpose, _id, resources) => {
      book = applyResourceEvent(
        book,
        JSON.parse(
          JSON.stringify({ ...resources, event: "receipt", key: purpose }),
        ),
      );
      assert.ok(book, "元SnapshotのReceiptだけを同じ記録に結合する");
    },
    onResourcesClosed: (observation) => {
      assert.ok(book);
      book = applyResourceCleanup(
        book,
        JSON.parse(JSON.stringify(observation.resourceSnapshot)),
        JSON.parse(JSON.stringify(observation.resources)),
        { recoveryId: "exact-recovery", previousPayloadSha256: "a".repeat(64) },
      );
      assert.ok(book);
      assert.ok(
        book.checkpoints.every(
          (c) =>
            c.receiptSource === "docker_create_result" &&
            c.observation === "absent",
        ),
      );
      closed = true;
    },
  });
  assert.equal(closed, true);
});
