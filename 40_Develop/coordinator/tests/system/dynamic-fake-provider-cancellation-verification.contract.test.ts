/**
 * coordinator:system:dynamic-fake-provider-cancellation-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:dynamic-fake-provider-cancellation-verificationが所有する検証責務を実行する。
 * @trace PRL-ST-003
 * @level ST
 * @scope dynamic、fake、provider、cancellation、verification
 * @boundary PRL-ST-003=System/E2E: 公開入口→Runtime→Provider・Process→資源Observer
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  dockerCreateArgumentsForCancellationVerificationFixture,
  normalizeDynamicFakeProviderCancellationForFixture,
  OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS,
  runDynamicFakeProviderCancellationVerification,
  verifyOwnedAttachTerminationForFixture,
} from "../../src/security/docker-isolation.ts";
import { verifyDynamicFakeProviderCancellation } from "../../scripts/verify-dynamic-fake-provider-cancellation.ts";

const MOUNTS = Object.freeze({
  workspace: "C:\\crdd\\workspace",
  providerHome: "C:\\crdd\\provider-home",
  tmp: "C:\\crdd\\tmp",
  events: "C:\\crdd\\events",
  projection: "C:\\crdd\\projection",
  management: "C:\\crdd\\management",
});

const EXACT_EXECUTION = Object.freeze({
  status: 42,
  signal: null,
  stdout:
    '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}\n' +
    '{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}\n',
  stderr: "",
});

/**
 * 取消verificationは固定image・network none・固定SIGTERM handlerだけを構成するを検証する。
 *
 * @responsibility 取消verificationは固定image・network none・固定SIGTERM handlerだけを構成するの合否判定を所有する。
 * @trace PRL-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消verificationは固定image・network none・固定SIGTERM handlerだけを構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-003=System/E2E: 公開入口→Runtime→Provider・Process→資源Observer
 */
test("取消verificationは固定image・network none・固定SIGTERM handlerだけを構成する", () => {
  const args = dockerCreateArgumentsForCancellationVerificationFixture(MOUNTS);
  assert.equal(args.includes("--pull=never"), true);
  assert.equal(args.includes("--network=none"), true);
  assert.equal(args.includes("--read-only"), true);
  assert.equal(args.includes("--cap-drop=ALL"), true);
  assert.equal(args.includes("--security-opt=no-new-privileges"), true);
  assert.equal(args.includes("python"), true);
  const source = args.at(-1) ?? "";
  assert.match(source, /SIGTERM/u);
  assert.match(source, /crdd-coordinator-cancellation-v1/u);
  assert.equal(
    source.indexOf("signal.signal") < source.lastIndexOf("print(json.dumps"),
    true,
  );
  assert.equal(runDynamicFakeProviderCancellationVerification.length, 1);
  assert.equal(verifyDynamicFakeProviderCancellation.length, 0);
});

/**
 * plain cancellation観測はcandidateに留まりrepository実行なしでverifiedにならないを検証する。
 *
 * @responsibility plain cancellation観測はcandidateに留まりrepository実行なしでverifiedにならないの合否判定を所有する。
 * @trace PRL-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus plain cancellation観測はcandidateに留まりrepository実行なしでverifiedにならないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-003=System/E2E: 公開入口→Runtime→Provider・Process→資源Observer
 */
test("plain cancellation観測はcandidateに留まりrepository実行なしでverifiedにならない", () => {
  const result = normalizeDynamicFakeProviderCancellationForFixture(
    EXACT_EXECUTION,
    5_000,
    true,
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "dynamic_fake_provider_cancellation_candidate");
  assert.equal(result.cancellationAcknowledged, true);
  assert.equal(result.processTerminationObserved, true);
  assert.equal(result.attachProcessTerminationObserved, false);
  assert.equal(result.attachProcessTerminationRequestCount, 0);
  assert.equal(result.containerAbsenceVerified, false);
  assert.equal(result.hostCleanupVerified, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.operationCapabilityIssued, false);
  assert.equal(result.realProviderReadiness, false);
});

/**
 * Host attach process ownerは全固定異常scenarioで終了要求exact 1回とcloseを確認するを検証する。
 *
 * @responsibility Host attach process ownerは全固定異常scenarioで終了要求exact 1回とcloseを確認するの合否判定を所有する。
 * @trace PRL-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host attach process ownerは全固定異常scenarioで終了要求exact 1回とcloseを確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-003=System/E2E: 公開入口→Runtime→Provider・Process→資源Observer
 */
test("Host attach process ownerは全固定異常scenarioで終了要求exact 1回とcloseを確認する", async () => {
  assert.deepEqual(OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS, [
    "never_ready",
    "ready_then_never_complete",
    "output_overflow",
  ]);
  assert.equal(verifyOwnedAttachTerminationForFixture.length, 1);
  for (const scenario of OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS) {
    const result = await verifyOwnedAttachTerminationForFixture(scenario);
    assert.equal(result.status, "verified");
    assert.equal(result.reason, "owned_attach_process_termination_verified");
    assert.equal(result.scenario, scenario);
    assert.equal(result.terminationRequestCount, 1);
    assert.equal(result.attachProcessTerminationObserved, true);
    assert.equal(
      result.readyObserved,
      scenario === "ready_then_never_complete",
    );
    assert.equal(result.outputExceeded, scenario === "output_overflow");
  }
});

/**
 * 取消観測は要求・grace・ack・終了envelopeの差をfail closedにするを検証する。
 *
 * @responsibility 取消観測は要求・grace・ack・終了envelopeの差をfail closedにするの合否判定を所有する。
 * @trace PRL-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消観測は要求・grace・ack・終了envelopeの差をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-003=System/E2E: 公開入口→Runtime→Provider・Process→資源Observer
 */
test("取消観測は要求・grace・ack・終了envelopeの差をfail closedにする", () => {
  assert.equal(
    normalizeDynamicFakeProviderCancellationForFixture(
      EXACT_EXECUTION,
      1,
      false,
    ).reason,
    "dynamic_fake_provider_cancellation_not_requested",
  );
  for (const elapsed of [-1, 5_001, 1.5, Number.NaN])
    assert.equal(
      normalizeDynamicFakeProviderCancellationForFixture(
        EXACT_EXECUTION,
        elapsed,
        true,
      ).reason,
      "dynamic_fake_provider_cancellation_grace_exceeded",
    );
  assert.equal(
    normalizeDynamicFakeProviderCancellationForFixture(
      { ...EXACT_EXECUTION, stdout: "bad\n" },
      1,
      true,
    ).reason,
    "dynamic_fake_provider_cancellation_acknowledgement_invalid",
  );
  assert.equal(
    normalizeDynamicFakeProviderCancellationForFixture(
      { ...EXACT_EXECUTION, status: 0 },
      1,
      true,
    ).reason,
    "dynamic_fake_provider_cancellation_termination_invalid",
  );
  assert.equal(
    normalizeDynamicFakeProviderCancellationForFixture(
      { ...EXACT_EXECUTION, signal: "SIGKILL" },
      1,
      true,
    ).status,
    "blocked",
  );
});
