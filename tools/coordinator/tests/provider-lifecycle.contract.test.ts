import assert from "node:assert/strict";
import test from "node:test";
import {
  describeProviderLifecycleContract,
  evaluateFakeProviderLifecycle,
  planProviderLifecycle,
  PROVIDER_LIFECYCLE_CONTRACT,
  PROVIDER_LIFECYCLE_CONTRACT_REVISION,
  PROVIDER_LIFECYCLE_LIMITS,
} from "../src/security/provider-lifecycle.ts";

const COMPLETE_STATES = Object.freeze([
  "prepared",
  "submission_started",
  "created",
  "inspect_verified",
  "started",
  "exited_or_terminated",
  "absence_confirmed",
  "cleanup_confirmed",
]);

function observation(overrides: Record<string, unknown> = {}) {
  return {
    contract: PROVIDER_LIFECYCLE_CONTRACT,
    contractRevision: PROVIDER_LIFECYCLE_CONTRACT_REVISION,
    provider: "fake",
    mode: "run",
    states: COMPLETE_STATES,
    elapsedMs: 1,
    stdoutBytes: 2,
    stderrBytes: 0,
    exitCode: 0,
    signal: null,
    timedOut: false,
    cancellationRequested: false,
    processTreeTerminated: true,
    containerAbsent: true,
    resultCount: 1,
    resultFormat: "exact_json_object",
    quotaState: "available",
    ...overrides,
  };
}

test("Provider認証方針は既存subscription OAuthだけを許可する", () => {
  const contract = describeProviderLifecycleContract();
  assert.equal(
    contract.authPolicies.codex.method,
    "existing_chatgpt_plan_subscription_oauth",
  );
  assert.equal(
    contract.authPolicies.claude.method,
    "existing_subscription_oauth",
  );
  assert.equal(contract.apiKeyAllowed, false);
  assert.equal(contract.additionalCreditPurchaseAllowed, false);
  assert.equal(contract.oauthTokenReadByRuntime, false);
  assert.equal(contract.rawAuthOutputRecorded, false);
});

test("専用Provider HomeはProvider単位で永続しOperation cleanupへ含めない", () => {
  const home = describeProviderLifecycleContract().dedicatedProviderHome;
  assert.equal(home.scope, "local_os_user_and_provider");
  assert.equal(home.persistentAcrossOperations, true);
  assert.equal(home.sharedAcrossRepositoriesForSameOsUser, true);
  assert.equal(home.hostDefaultHomeImportAllowed, false);
  assert.equal(home.otherProviderHomeSharingAllowed, false);
  assert.equal(home.operationCleanupOwned, false);
  assert.equal(home.protectionVerification, "not_implemented");
});

test("実Providerのloginとrunはいずれもspawn前にblockedとなる", () => {
  const codex = planProviderLifecycle({ provider: "codex", mode: "login" });
  const claude = planProviderLifecycle({ provider: "claude", mode: "run" });
  assert.equal(codex.status, "blocked");
  assert.equal(codex.reason, "provider_explicit_login_effect_not_implemented");
  assert.equal(claude.status, "blocked");
  assert.equal(
    claude.reason,
    "provider_egress_auth_and_fixed_image_binding_not_implemented",
  );
  assert.equal(codex.spawnAllowed, false);
  assert.equal(claude.spawnAllowed, false);
});

test("任意Provider、mode、余分field、accessorおよびProxyを拒否する", () => {
  assert.equal(
    planProviderLifecycle({ provider: "other", mode: "run" }).reason,
    "provider_lifecycle_provider_not_supported",
  );
  assert.equal(
    planProviderLifecycle({ provider: "codex", mode: "other" }).reason,
    "provider_lifecycle_mode_not_supported",
  );
  assert.equal(
    planProviderLifecycle({ provider: "codex", mode: "run", argv: ["x"] })
      .reason,
    "provider_lifecycle_plan_shape_invalid",
  );
  const accessor = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessor, "provider", { get: () => "codex" });
  Object.defineProperty(accessor, "mode", { value: "run", enumerable: true });
  assert.equal(
    planProviderLifecycle(accessor).reason,
    "provider_lifecycle_plan_shape_invalid",
  );
  assert.equal(
    planProviderLifecycle(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("must_not_escape");
          },
        },
      ),
    ).reason,
    "provider_lifecycle_plan_shape_invalid",
  );
});

test("Fake Providerの正常完了は実Provider readinessやCapabilityを発行しない", () => {
  const result = evaluateFakeProviderLifecycle(observation());
  assert.equal(result.status, "confirmed");
  assert.equal(result.fakeProviderOnly, true);
  assert.equal(result.spawnAllowed, false);
  assert.equal(result.operationCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.networkEffectIssued, false);
});

test("Fake Providerの契約、revision、providerおよびmode差を拒否する", () => {
  for (const changed of [
    { contract: "other" },
    { contractRevision: 2 },
    { provider: "codex" },
    { mode: "login" },
  ]) {
    assert.equal(
      evaluateFakeProviderLifecycle(observation(changed)).reason,
      "provider_lifecycle_observation_contract_mismatch",
    );
  }
});

test("Fake Providerのtimeout、cancel、出力超過およびquotaを安全側へ閉じる", () => {
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ timedOut: true })).reason,
    "provider_deadline_exceeded",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ cancellationRequested: true }))
      .reason,
    "provider_operation_cancelled",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(
      observation({
        stdoutBytes: PROVIDER_LIFECYCLE_LIMITS.stdoutBytes + 1,
      }),
    ).reason,
    "provider_stdout_limit_exceeded",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(
      observation({
        stderrBytes: PROVIDER_LIFECYCLE_LIMITS.stderrBytes + 1,
      }),
    ).reason,
    "provider_stderr_limit_exceeded",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ quotaState: "exhausted" }))
      .reason,
    "provider_subscription_quota_exhausted",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ quotaState: "unknown" }))
      .reason,
    "provider_subscription_quota_state_unknown",
  );
});

test("Fake Providerの異常終了、二重完了、malformed結果および残存processを拒否する", () => {
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ exitCode: 2 })).reason,
    "provider_process_exit_nonzero",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(
      observation({ exitCode: null, signal: "SIGTERM" }),
    ).reason,
    "provider_process_signalled",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ resultCount: 2 })).reason,
    "provider_result_invalid",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ resultFormat: "text" })).reason,
    "provider_result_invalid",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ processTreeTerminated: false }))
      .reason,
    "provider_process_absence_unconfirmed",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ containerAbsent: false }))
      .reason,
    "provider_process_absence_unconfirmed",
  );
});

test("Fake Providerは状態順序、上限外値および入力trapをfail closedにする", () => {
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ states: ["prepared"] })).reason,
    "provider_lifecycle_state_sequence_invalid",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(observation({ stdoutBytes: -1 })).reason,
    "provider_lifecycle_observation_value_invalid",
  );
  assert.equal(
    evaluateFakeProviderLifecycle({ ...observation(), unexpected: true })
      .reason,
    "provider_lifecycle_observation_shape_invalid",
  );
  assert.equal(
    evaluateFakeProviderLifecycle(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("must_not_escape");
          },
        },
      ),
    ).reason,
    "provider_lifecycle_observation_shape_invalid",
  );
});
