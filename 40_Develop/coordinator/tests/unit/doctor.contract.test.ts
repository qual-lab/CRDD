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

test("Node基準は24.12.0以上だけを受理する", () => {
  for (const version of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedNodeVersion(version), true);
  }
  for (const version of ["24.11.9", "23.99.0", "v24.12.0", "bad"]) {
    assert.equal(isSupportedNodeVersion(version), false);
  }
});

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

test("passive discoveryは候補名を実行せず絶対Pathを公開しない", () => {
  const result = discoverCommand("definitely-not-a-provider-command");
  assert.equal(result.located, false);
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.formats, []);
});

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
  assert.equal(report.fakeProviderLifecycle.fakeProviderExecuted, false);
});

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
