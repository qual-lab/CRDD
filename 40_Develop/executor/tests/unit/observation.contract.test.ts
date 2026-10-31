/**
 * 固定隔離構成から非秘密診断だけを投影することを確認する。
 * @packageDocumentation
 * @responsibility 元の操作相関を保ち、Command・Home Pathを公開しないことを確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level UT
 * @scope Process内の模擬Ownerのみ。
 * @boundary Executor観測Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createConfigurationNotice } from "../../src/attempt/result.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 構成診断に操作相関だけを含め、秘密や実清掃成功を生成しないことを確認する。
 * @responsibility 結果Ownerによる純粋な診断投影のfield境界を確認する。
 * @trace ERB-IT-004
 * @precondition 固定の合成計画だけ。
 * @stimulus 同じ試行構成を診断投影へ渡す。
 * @observation 固定event、操作・Provider、Network Hashと非公開field。
 * @oracle Command・Home Pathを含まず、構成値を実環境の成立へ昇格しない。
 * @cleanup N/A: 外部資源・待機なし。実搬送と通知例外はnotifications Suiteが確認する。
 * @boundary ERB-IT-004=Direct Boundary: 構成から非秘密診断への投影。
 */
test("構成診断は元操作の相関を保ちCommandとHome Pathを公開しない", () => {
  const plan = attemptPlan();
  const notice = createConfigurationNotice(plan);
  assert.equal(notice.event, "coordinator_provider_boundary_configured");
  assert.equal(notice.provider, plan.provider);
  assert.equal(notice.operationId, plan.operationId);
  assert.equal(notice.networkPolicyHash, null);
  assert.equal("commands" in notice, false);
  assert.equal("providerHomeSourcePath" in notice, false);
});
