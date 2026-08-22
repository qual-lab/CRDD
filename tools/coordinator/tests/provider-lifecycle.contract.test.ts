import assert from "node:assert/strict";
import test from "node:test";
import {
  describeProviderLifecycleContract,
  evaluateSyntheticFakeProviderObservationCandidate,
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
    stdinBytes: 0,
    elapsedMs: 1,
    cancellationElapsedMs: null,
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
    contract.authPolicies.codex.loginPolicy,
    "existing_chatgpt_plan_subscription_oauth",
  );
  assert.equal(
    contract.authPolicies.claude.loginPolicy,
    "existing_subscription_oauth",
  );
  assert.equal(contract.apiKeyAllowed, false);
  assert.equal(contract.additionalCreditPurchaseAllowed, false);
  assert.equal(contract.oauthTokenReadByRuntime, false);
  assert.equal(contract.rawAuthOutputRecorded, false);
  assert.equal(contract.authPolicies.codex.accountCardinality, 1);
  assert.equal(contract.authPolicies.codex.billingMode, "subscription_only");
  assert.equal(contract.authPolicies.codex.automaticPlanSwitchAllowed, false);
  assert.equal(contract.authPolicies.codex.exactCliVersionRequired, true);
  assert.equal(contract.authPolicies.codex.exactCliVersionConfigured, false);
  assert.equal(
    contract.authPolicies.codex.usageSource,
    "selected_chatgpt_plan_included_usage",
  );
  assert.equal(
    contract.authPolicies.claude.usageSource,
    "selected_subscription_included_usage",
  );
  assert.equal(
    contract.authPolicies.claude.selectedAccountOfferingObserved,
    false,
  );
  assert.equal(
    contract.authPolicies.claude.authenticatedServiceTermsIdentity,
    "unresolved",
  );
  assert.equal(
    contract.authPolicies.claude.automatedSubscriptionUsePermission,
    "unresolved",
  );
  assert.equal(
    contract.authPolicies.claude.humanAccountAuthorityConfirmed,
    false,
  );
  assert.equal(
    contract.authPolicies.claude.accountAuthorityBinding,
    "not_implemented",
  );
  assert.equal(contract.authPolicies.claude.quotaProbe, "not_implemented");
});

test("専用Provider HomeはProvider単位で永続しOperation cleanupへ含めない", () => {
  const home = describeProviderLifecycleContract().dedicatedProviderHome;
  assert.equal(home.scope, "local_os_user_and_provider");
  assert.equal(home.persistentAcrossOperations, true);
  assert.equal(home.sharedAcrossRepositoriesForSameOsUser, true);
  assert.equal(home.hostDefaultHomeImportAllowed, false);
  assert.equal(home.otherProviderHomeSharingAllowed, false);
  assert.equal(home.operationCleanupOwned, false);
  assert.equal(home.protectionObservation, "not_implemented");
  assert.equal(home.selectedLocalUserBinder, "not_implemented");
  const grant = describeProviderLifecycleContract().providerHomeMountGrant;
  assert.equal(grant.grantIssued, false);
  assert.equal(grant.tokenCopyAllowed, false);
  assert.equal(grant.revocationRequiredAtOperationEnd, true);
  assert.equal(grant.revocationImplementationState, "not_implemented");
  assert.equal(grant.revocationVerified, false);
  assert.equal(grant.persistentHomeDeletedAtOperationEnd, false);
});

test("実Providerのloginとrunはいずれもspawn前にblockedとなる", () => {
  const codex = planProviderLifecycle({ provider: "codex", mode: "login" });
  const claude = planProviderLifecycle({ provider: "claude", mode: "run" });
  assert.equal(codex.status, "blocked");
  assert.equal(codex.reason, "provider_explicit_login_effect_not_implemented");
  assert.equal(claude.status, "blocked");
  assert.equal(
    claude.reason,
    "provider_home_protection_egress_auth_and_fixed_image_binding_not_implemented",
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

test("synthetic Fake claimの正常形も非Authority候補に限定する", () => {
  const result = evaluateSyntheticFakeProviderObservationCandidate(
    observation(),
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.syntheticFakeObservationOnly, true);
  assert.equal(result.observationAuthority, false);
  assert.equal(result.fakeProviderExecuted, false);
  assert.equal(result.processAbsenceVerified, false);
  assert.equal(result.resultNormalizationVerified, false);
  assert.equal(result.providerHomeMountGrantIssued, false);
  assert.equal(result.processTreeTerminationClaimed, true);
  assert.equal(result.containerAbsenceClaimed, true);
  assert.equal(result.spawnAllowed, false);
  assert.equal(result.operationCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.networkEffectIssued, false);
});

test("synthetic Fake claimの契約、revision、providerおよびmode差を拒否する", () => {
  for (const changed of [
    { contract: "other" },
    { contractRevision: 1 },
    { contractRevision: 2 },
    { provider: "codex" },
    { mode: "login" },
  ]) {
    assert.equal(
      evaluateSyntheticFakeProviderObservationCandidate(observation(changed))
        .reason,
      "provider_lifecycle_observation_contract_mismatch",
    );
  }
});

test("動的Fake契約はDocker所有観測だけを実装済みとしcancelを未実装に保つ", () => {
  const dynamic =
    describeProviderLifecycleContract().dynamicFakeProviderObservation;
  assert.equal(dynamic.provenance, "repository_owned_docker_fake_provider");
  assert.equal(dynamic.normalExecution, "implemented_candidate");
  assert.equal(dynamic.exactResultNormalization, "implemented_candidate");
  assert.equal(
    dynamic.containerAndProcessTreeAbsence,
    "implemented_candidate_after_owned_cleanup",
  );
  assert.equal(dynamic.inFlightCancellation, "not_implemented");
  assert.equal(dynamic.runtimeAuthorityIssued, false);
  assert.equal(dynamic.operationCapabilityIssued, false);
  assert.equal(dynamic.realProviderReadiness, false);
});

test("synthetic Fake claimのtimeout、cancel、入出力超過およびquotaを安全側へ閉じる", () => {
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ stdinBytes: PROVIDER_LIFECYCLE_LIMITS.stdinBytes }),
    ).status,
    "candidate",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ timedOut: true }),
    ).reason,
    "provider_deadline_exceeded",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ cancellationRequested: true, cancellationElapsedMs: 0 }),
    ).reason,
    "provider_operation_cancelled",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({
        cancellationRequested: true,
        cancellationElapsedMs:
          PROVIDER_LIFECYCLE_LIMITS.cancellationGraceMs + 1,
      }),
    ).reason,
    "provider_cancellation_grace_exceeded",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({
        stdinBytes: PROVIDER_LIFECYCLE_LIMITS.stdinBytes + 1,
      }),
    ).reason,
    "provider_stdin_limit_exceeded",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({
        stdoutBytes: PROVIDER_LIFECYCLE_LIMITS.stdoutBytes + 1,
      }),
    ).reason,
    "provider_stdout_limit_exceeded",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({
        stderrBytes: PROVIDER_LIFECYCLE_LIMITS.stderrBytes + 1,
      }),
    ).reason,
    "provider_stderr_limit_exceeded",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ quotaState: "exhausted" }),
    ).reason,
    "provider_subscription_quota_exhausted",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ quotaState: "unknown" }),
    ).reason,
    "provider_subscription_quota_state_unknown",
  );
});

test("synthetic Fake claimの異常終了、二重完了、malformed結果および残存claimを拒否する", () => {
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ exitCode: 2 }),
    ).reason,
    "provider_process_exit_nonzero",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ exitCode: null, signal: "SIGTERM" }),
    ).reason,
    "provider_process_signalled",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ resultCount: 2 }),
    ).reason,
    "provider_result_invalid",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ resultFormat: "text" }),
    ).reason,
    "provider_result_invalid",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ processTreeTerminated: false }),
    ).reason,
    "provider_process_absence_unconfirmed",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ containerAbsent: false }),
    ).reason,
    "provider_process_absence_unconfirmed",
  );
});

test("synthetic Fake claimは状態順序、cancel整合、値型および入力trapをfail closedにする", () => {
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ states: ["prepared"] }),
    ).reason,
    "provider_lifecycle_state_sequence_invalid",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
      observation({ stdoutBytes: -1 }),
    ).reason,
    "provider_lifecycle_observation_value_invalid",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate({
      ...observation(),
      unexpected: true,
    }).reason,
    "provider_lifecycle_observation_shape_invalid",
  );
  assert.equal(
    evaluateSyntheticFakeProviderObservationCandidate(
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
  for (const changed of [
    { cancellationRequested: false, cancellationElapsedMs: 0 },
    { cancellationRequested: true, cancellationElapsedMs: null },
    { cancellationRequested: true, cancellationElapsedMs: -1 },
    { cancellationRequested: true, cancellationElapsedMs: 1.5 },
  ]) {
    assert.equal(
      evaluateSyntheticFakeProviderObservationCandidate(observation(changed))
        .reason,
      "provider_cancellation_observation_inconsistent",
    );
  }
  for (const changed of [{ stdinBytes: -1 }, { stdinBytes: 1.5 }]) {
    assert.equal(
      evaluateSyntheticFakeProviderObservationCandidate(observation(changed))
        .reason,
      "provider_lifecycle_observation_value_invalid",
    );
  }
});
