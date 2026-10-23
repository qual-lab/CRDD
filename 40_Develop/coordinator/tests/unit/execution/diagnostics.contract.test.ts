/**
 * 単発診断の実行結果とreadinessの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:doctorが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope doctor
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { sourceDeclaration } from "../../support/source-declaration.ts";
import { isSupportedCoordinatorNodeRuntime } from "../../../src/execution/diagnostics.ts";
import test from "node:test";

import type { DiagnosticCheck } from "../../../src/execution/diagnostics.ts";
import {
  CHECK_STATUS,
  discoverCommand,
  evaluateReadiness,
  REQUIRED_CHECK_IDS,
  runDoctor,
} from "../../../src/execution/diagnostics.ts";
import { renderDoctorCommandFailure } from "../../../src/cli/recovery-report.ts";

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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Node基準は24.12.0以上だけを受理する", () => {
  for (const version of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedCoordinatorNodeRuntime(version), true);
  }
  for (const version of ["24.11.9", "23.99.0", "v24.12.0", "bad"]) {
    assert.equal(isSupportedCoordinatorNodeRuntime(version), false);
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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

/**
 * 診断の元ErrorとCLI表示が同じ私有分類を共有する。
 * @responsibility 移管によるWeakMap複製・元回復参照欠落を検出する。
 * @trace PRL-UT-014
 * @precondition 新しいNode子で実宣言の共有閉包を作り、作成失敗分類だけを模擬する。
 * @stimulus 元失敗を診断へ渡し、投影ErrorをCLIで表示する。
 * @observation JSON・人向け表示とコピーErrorの分類。
 * @oracle 元Errorだけにexact回復参照を保持し、原因本文を出力しない。
 * @cleanup spawnSyncが同じ子の終了を待つ。外部資源は取得しない。
 * @boundary PRL-UT-014=Related 2 Blocks: 診断失敗の実宣言→実CLI表示。集約Moduleの初期化検査ではない。
 */
test("診断とCLI表示は元Errorの回復参照を共有しコピーを拒否する", () => {
  const diagnostics = new URL(
    "../../../src/execution/diagnostics.ts",
    import.meta.url,
  ).href;
  const source = fs.readFileSync(new URL(diagnostics), "utf8");
  const declarations = [
    "doctorOperationInitializationFailures",
    "classifyDoctorOperationInitializationFailure",
    "throwDoctorOperationInitializationFailure",
    "projectDoctorOperationCreationFailure",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const report = new URL("../../../src/cli/recovery-report.ts", import.meta.url)
    .href;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
import assert from "node:assert/strict";
import { mock } from "node:test";
const original = new Error("private failure detail");
const recoveryId = "host.synthetic-doctor-original";
const classifyOwnedCoordinatorOperationCreationFailure = error => error === original
  ? { cleanupConfirmed: false, hostRecoveryId: recoveryId } : null;
${declarations}
mock.module(${JSON.stringify(diagnostics)}, { namedExports: {
  classifyDoctorOperationInitializationFailure,
  projectDoctorOperationCreationFailure,
} });
const report = await import(${JSON.stringify(report)});
let projected;
try { projectDoctorOperationCreationFailure(original); }
catch (error) { projected = error; }
assert.ok(projected instanceof Error);
const rendered = report.renderDoctorCommandFailure(projected);
assert.deepEqual(JSON.parse(rendered.json), { status: "blocked",
  reason: "doctor_operation_initialization_cleanup_unknown",
  manualRecoveryRequired: true, hostRecoveryId: recoveryId });
assert.ok(rendered.human.includes(recoveryId));
assert.equal(rendered.json.includes(original.message), false);
const copy = report.renderDoctorCommandFailure(new Error(projected.message));
assert.equal(Object.hasOwn(JSON.parse(copy.json), "hostRecoveryId"), false);
`,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15_000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
});
