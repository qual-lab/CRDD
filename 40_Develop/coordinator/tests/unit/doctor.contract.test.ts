/**
 * coordinator:unit:doctorの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:doctorが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope doctor
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { DiagnosticCheck } from "../../src/core/doctor.ts";
import {
  CHECK_STATUS,
  discoverCommand,
  evaluateReadiness,
  isSupportedNodeVersion,
  REQUIRED_CHECK_IDS,
  renderDoctorCommandFailure,
  runDoctor,
} from "../../src/core/doctor.ts";

/**
 * Node基準は24.12.0以上だけを受理するを検証する。
 *
 * @responsibility Node基準は24.12.0以上だけを受理するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Node基準は24.12.0以上だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Node基準は24.12.0以上だけを受理する", () => {
  for (const version of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedNodeVersion(version), true);
  }
  for (const version of ["24.11.9", "23.99.0", "v24.12.0", "bad"]) {
    assert.equal(isSupportedNodeVersion(version), false);
  }
});

/**
 * 全必須checkがconfirmedの場合だけpure集約はReadyを返すを検証する。
 *
 * @responsibility 全必須checkがconfirmedの場合だけpure集約はReadyを返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全必須checkがconfirmedの場合だけpure集約はReadyを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("全必須checkがconfirmedの場合だけpure集約はReadyを返す", () => {
  const checks: DiagnosticCheck[] = REQUIRED_CHECK_IDS.map((id) => ({
    id,
    status: "confirmed",
    reason: null,
    followUp: null,
  }));
  assert.deepEqual(evaluateReadiness(checks), {
    status: "ready",
    blockers: [],
  });
});

/**
 * 欠落、重複、未知および不正なcheckをfail closedにするを検証する。
 *
 * @responsibility 欠落、重複、未知および不正なcheckをfail closedにするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 欠落、重複、未知および不正なcheckをfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("欠落、重複、未知および不正なcheckをfail closedにする", () => {
  const baseItems: DiagnosticCheck[] = REQUIRED_CHECK_IDS.map((id) => ({
    id,
    status: "confirmed",
    reason: null,
    followUp: null,
  }));
  assert.equal(evaluateReadiness(baseItems.slice(1)).status, "blocked");
  assert.equal(
    evaluateReadiness([...baseItems, baseItems[0]]).status,
    "blocked",
  );
  assert.equal(
    evaluateReadiness([
      ...baseItems,
      { id: "unknown", status: "confirmed", reason: null },
    ]).status,
    "blocked",
  );
  assert.deepEqual(CHECK_STATUS, [
    "confirmed",
    "blocked",
    "not_implemented",
    "unknown",
  ]);
});

/**
 * passive discoveryは候補名を実行せず絶対Pathを公開しないを検証する。
 *
 * @responsibility passive discoveryは候補名を実行せず絶対Pathを公開しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus passive discoveryは候補名を実行せず絶対Pathを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("passive discoveryは候補名を実行せず絶対Pathを公開しない", () => {
  const result = discoverCommand("definitely-not-a-provider-command");
  assert.equal(result.located, false);
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.formats, []);
});

/**
 * production doctorは通常Taskに不要な永続準備状態を公開しないを検証する。
 *
 * @responsibility production doctorは通常Taskに不要な永続準備状態を公開しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production doctorは通常Taskに不要な永続準備状態を公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("production doctorは通常Taskに不要な永続準備状態を公開しない", () => {
  const report = runDoctor({ activeIsolation: false, cwd: process.cwd() });
  for (const removedKey of [
    "runtimeRoot",
    "runtimeRootPathIdentity",
    "runtimeActivation",
    "runtimeRootEvaluation",
    "runtimeRootProtectionPrecheck",
  ]) {
    assert.equal(Object.hasOwn(report, removedKey), false);
  }
  assert.equal(Object.hasOwn(report.egress, "authorityRoot"), false);
  assert.equal(Object.hasOwn(report.egress, "activation"), false);
  assert.equal(REQUIRED_CHECK_IDS.includes("runtime.root"), false);
  assert.equal(report.diagnosticMode, "passive_preflight");
  assert.equal(report.reportVersion, 12);
  assert.equal(Object.hasOwn(report, "repositoryLocation"), true);
  assert.equal(Object.hasOwn(report, "repositoryGitLayout"), false);
  assert.equal(report.repositoryLocation.pathReported, false);
  assert.equal(report.fakeProviderLifecycle.fakeProviderExecuted, false);
});

/**
 * doctor optionsは余分field、accessorおよびProxyを処置前に拒否するを検証する。
 *
 * @responsibility doctor optionsは余分field、accessorおよびProxyを処置前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus doctor optionsは余分field、accessorおよびProxyを処置前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("doctor optionsは余分field、accessorおよびProxyを処置前に拒否する", () => {
  assert.throws(
    () =>
      runDoctor({
        activeIsolation: false,
        cwd: process.cwd(),
        runtimeRootRequest: null,
      }),
    /doctor_options_invalid/u,
  );
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "cwd", {
    enumerable: true,
    get() {
      throw new Error("must_not_read");
    },
  });
  assert.throws(() => runDoctor(accessor), /doctor_options_invalid/u);
  assert.throws(
    () => runDoctor(new Proxy({}, { ownKeys: () => [] })),
    /doctor_options_invalid/u,
  );
});

/**
 * Doctor診断失敗は理由コードだけを公開するを検証する。
 *
 * @responsibility Doctor診断失敗は理由コードだけを公開するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Doctor診断失敗は理由コードだけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Doctor診断失敗は理由コードだけを公開する", () => {
  const rendered = renderDoctorCommandFailure(
    new Error("provider_discovery_failed"),
  );
  assert.equal(rendered.exitCode, 2);
  assert.deepEqual(JSON.parse(rendered.json), {
    status: "blocked",
    reason: "provider_discovery_failed",
  });
  assert.equal(rendered.human.includes("provider_discovery_failed"), true);
});
