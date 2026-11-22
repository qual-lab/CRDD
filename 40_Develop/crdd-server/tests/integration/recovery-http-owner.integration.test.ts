/**
 * 正常Owner回復とWorkbench検証HTTPのHost限定接続を確認する。
 * @packageDocumentation
 * @responsibility 三回の実Writerと受信済みHTTP応答を同じ元試験本体で検証する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @level IT
 * @scope Windows Host、自己生成Repository・Home・回復記録。実Docker・外部AIなし。
 * @boundary 本番Co Writerと有限技術代役、固定Node HTTP子。
 */
import test from "node:test";
import { verifyNormalOwnerLifecycle } from "../../../coordinator/tests/fixtures/docker-owned-process-test-support.ts";
import { requestInChild } from "../../scripts/ai-verification-http.ts";

/**
 * 正常Owner三回の結果保存とWorkbench検証HTTP一要求を結合する。
 * @responsibility 実Writer競合下の応答・時計・子close・終了を元の本体で確認する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryと有限Docker技術代役。
 * @stimulus 三Ownerの結果受領／確定とServer受信済みHTTP要求を重ねる。
 * @observation 元の保存・HTTP時計と全回収観測。
 * @oracle 元の正常Owner三回試験の全assertを満たす。
 * @cleanup 共有本体が今回のRoot・Server・子を終了し全代役を復元する。
 * @boundary Workbench検証子→loopback応答とCo実Writer。実AI・Dockerなし。
 */
test("Host Windows: 正常Owner3回から実Home解放・Host清掃・結果保存まで結合する", async (t) => {
  await verifyNormalOwnerLifecycle(t, 3, false, (url, observe) =>
    requestInChild(url, "/api/workbench-view?route=%2F", undefined, observe),
  );
});
