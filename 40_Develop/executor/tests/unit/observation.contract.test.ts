/**
 * 固定構成の診断投影と受動callbackの失敗を反証する。
 * @packageDocumentation
 * @responsibility 元入力の保全、Reporterの束縛、同期・非同期故障の封じ込めを確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level UT
 * @scope Process内の模擬Ownerのみ。
 * @boundary Executor観測Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  providerBoundaryConfiguration,
  reportPassiveBoundaryDiagnostic,
} from "../../src/attempt/observation.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 診断投影とReporter例外が試行判定を代行しないことを確認する。
 * @responsibility 元入力と受動通知を保ち、同期・非同期失敗を外へ漏らさない。
 * @trace ERB-IT-004
 * @precondition 合成計画とメモリ内Reporterだけ。
 * @stimulus 正常、同期throw、Promise拒否、Reporterなしを呼ぶ。
 * @observation 固定field、元notice、callbackのthisと例外不伝播。
 * @oracle 診断は秘密や実清掃成功を生成せず、失敗を握ったまま終了する。
 * @cleanup Promise拒否処置を一microtask待つ。外部資源なし。
 * @boundary ERB-IT-004=Direct Boundary: 構成診断・受動搬送。
 */
test("受動診断は元通知とReporterの呼出し束縛を保ち例外を試行へ漏らさない", async () => {
  const plan = attemptPlan();
  const notice = providerBoundaryConfiguration(plan);
  assert.equal(notice.event, "coordinator_provider_boundary_configured");
  assert.equal(notice.provider, plan.provider);
  assert.equal(notice.operationId, plan.operationId);
  assert.equal(notice.networkPolicyHash, null);
  assert.equal("commands" in notice, false);
  assert.equal("providerHomeSourcePath" in notice, false);
  for (const mode of ["normal", "sync", "async"]) {
    let calls = 0;
    const dependencies = {
      marker: "original",
      reportProviderBoundaryDiagnostic(value: unknown) {
        calls++;
        assert.equal(this.marker, "original");
        assert.equal(value, notice);
        if (mode === "sync") throw Error("synthetic");
        return mode === "async"
          ? Promise.reject(Error("synthetic"))
          : Promise.resolve(false);
      },
    };
    assert.doesNotThrow(() =>
      reportPassiveBoundaryDiagnostic(dependencies, notice),
    );
    await Promise.resolve();
    assert.equal(calls, 1);
  }
  assert.doesNotThrow(() => reportPassiveBoundaryDiagnostic({}, notice));
});
