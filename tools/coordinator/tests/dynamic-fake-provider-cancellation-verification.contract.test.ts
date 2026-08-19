import assert from "node:assert/strict";
import test from "node:test";

import {
  dockerCreateArgumentsForCancellationVerificationFixture,
  normalizeDynamicFakeProviderCancellationForFixture,
  runDynamicFakeProviderCancellationVerification,
} from "../src/security/docker-isolation.ts";
import { verifyDynamicFakeProviderCancellation } from "../scripts/verify-dynamic-fake-provider-cancellation.ts";

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
  assert.equal(runDynamicFakeProviderCancellationVerification.length, 1);
  assert.equal(verifyDynamicFakeProviderCancellation.length, 0);
});

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
  assert.equal(result.containerAbsenceVerified, false);
  assert.equal(result.hostCleanupVerified, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.operationCapabilityIssued, false);
  assert.equal(result.realProviderReadiness, false);
});

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
