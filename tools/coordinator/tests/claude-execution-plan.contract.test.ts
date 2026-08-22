import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAUDE_EXECUTION_PLAN_CONTRACT,
  CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  describeClaudeExecutionPlanContract,
  planClaudeReadOnlyProbe,
} from "../src/security/claude-execution-plan.ts";

test("Claude配布候補は固定絶対pathと同じexact artifact Identityへ結合する", () => {
  const contract = describeClaudeExecutionPlanContract();
  const identity = contract.distribution.identity;
  assert.equal(contract.contract, CLAUDE_EXECUTION_PLAN_CONTRACT);
  assert.equal(
    contract.contractRevision,
    CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  );
  assert.equal(identity.targetPlatform, "linux-x64");
  assert.equal(
    identity.executablePath,
    "/opt/crdd/providers/claude/2.1.220/claude",
  );
  assert.equal(identity.exactVersion, "2.1.220");
  assert.equal(
    identity.binarySha256,
    "674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863",
  );
  assert.equal(identity.binaryBytes, 275_012_592);
  assert.equal(contract.distribution.manifestSignatureRequired, true);
  assert.equal(contract.distribution.manifestSignatureVerified, false);
  assert.equal(contract.distribution.fixedImageDigest, null);
  assert.equal(contract.distribution.argvCompatibilityRequired, true);
  assert.equal(contract.distribution.argvCompatibilityVerified, false);
  assert.equal(contract.readOnlyProbe.command, identity.executablePath);
  assert.deepEqual(contract.readOnlyProbe.artifactIdentity, identity);
  assert.equal(contract.providerSpawn, "blocked_before_spawn");
});

test("配布物条件と認証service条件を別axisの未解決条件にする", () => {
  const contract = describeClaudeExecutionPlanContract();
  const distributionTerms = contract.distribution.binaryDistributionTerms;
  const authentication = contract.authentication;
  const serviceTerms = authentication.authenticatedServiceTerms;
  assert.equal(distributionTerms.termsIdentityResolved, false);
  assert.equal(distributionTerms.termsActivated, false);
  assert.equal(distributionTerms.fixedImageUsePermission, "unresolved");
  assert.equal(distributionTerms.redistributionPermission, "unresolved");
  assert.deepEqual(authentication.offeringCandidates, [
    {
      offering: "claude_pro",
      offeringClass: "individual_offering_candidate",
    },
    {
      offering: "claude_max",
      offeringClass: "individual_offering_candidate",
    },
    {
      offering: "claude_team",
      offeringClass: "organization_offering_candidate",
    },
    {
      offering: "claude_enterprise",
      offeringClass: "organization_offering_candidate",
    },
  ]);
  assert.equal(authentication.selectedAccountOfferingObserved, false);
  assert.equal(serviceTerms.termsIdentityResolved, false);
  assert.equal(serviceTerms.termsActivated, false);
  assert.equal(serviceTerms.automatedSubscriptionUsePermission, "unresolved");
  assert.equal(authentication.humanAuthorityConfirmed, false);
  assert.equal(authentication.accountAuthorityBinding, "not_implemented");
  assert.equal("supportedSubscriptions" in authentication, false);
  assert.equal("termsReview" in contract.distribution, false);
});

test("Claude認証はsubscription OAuth候補だけを残しAPI課金経路を拒否する", () => {
  const authentication = describeClaudeExecutionPlanContract().authentication;
  assert.equal(authentication.loginPolicy, "existing_subscription_oauth");
  assert.equal(authentication.consoleApiAccountAllowed, false);
  assert.equal(authentication.thirdPartyApiProviderAllowed, false);
  assert.equal(authentication.apiKeyAllowed, false);
  assert.equal(authentication.hostCredentialImportAllowed, false);
  assert.equal(authentication.rawAuthOutputRecorded, false);
  assert.equal(authentication.oauthTokenReadByRuntime, false);
});

test("読取専用probe候補は固定argv、環境置換要求、未検証制約を投影する", () => {
  const plan = planClaudeReadOnlyProbe({
    provider: "claude",
    mode: "read_only_probe",
  });
  assert.equal(plan.status, "candidate");
  assert.equal(plan.reason, "claude_activation_blockers_unresolved");
  assert.equal(plan.command, "/opt/crdd/providers/claude/2.1.220/claude");
  assert.deepEqual(plan.argv, [
    "--bare",
    "-p",
    "Return one JSON object with the single key status and the value available. Do not use tools.",
    "--output-format",
    "json",
    "--max-turns",
    "1",
    "--no-session-persistence",
    "--permission-mode",
    "plan",
    "--tools",
    "",
    "--disallowedTools",
    "mcp__*",
    "--disable-slash-commands",
  ]);
  assert.equal(plan.argvCompatibilityRequired, true);
  assert.equal(plan.argvCompatibilityVerified, false);
  assert.equal(plan.fixedImageDigest, null);
  assert.equal(plan.environmentMode, "replace_required");
  assert.equal(plan.environmentReplacementImplemented, false);
  assert.equal(plan.parentEnvironmentInherited, false);
  assert.deepEqual(plan.environment, {
    DISABLE_AUTOUPDATER: "1",
    DISABLE_UPDATES: "1",
    CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1",
  });
  assert.deepEqual(plan.runtimeOwnedEnvironmentSlots, [
    "HOME",
    "TMPDIR",
    "HTTPS_PROXY",
  ]);
  assert.equal(
    plan.forbiddenParentEnvironmentCategories.includes("provider_api_keys"),
    true,
  );
  assert.equal(
    plan.forbiddenParentEnvironmentCategories.includes(
      "host_credential_or_settings_paths",
    ),
    true,
  );
  assert.equal(plan.spawnAllowed, false);
  assert.equal(plan.pathLookupAllowed, false);
  assert.equal(plan.workspaceMountRequired, false);
  assert.equal(plan.providerHomeMountRequired, true);
  assert.equal(plan.providerRequestExpected, true);
  assert.equal(plan.includedSubscriptionUsageMayBeConsumed, true);
  assert.equal(plan.apiKeyAllowed, false);
  assert.equal(plan.additionalCreditPurchaseAllowed, false);
  assert.equal(plan.automaticPlanSwitchAllowed, false);
  assert.equal(plan.sessionResumeAllowed, false);
  assert.equal(plan.sessionPersistenceAllowed, false);
  assert.equal(plan.builtInToolsRequested, "none");
  assert.equal(plan.builtInToolsRestrictionVerified, false);
  assert.equal(plan.mcpToolsRequested, "none");
  assert.equal(plan.mcpToolsRestrictionVerified, false);
  assert.equal(plan.projectInstructionsRequested, "not_loaded");
  assert.equal(plan.projectInstructionsRestrictionVerified, false);
  assert.equal(plan.autoDiscoveredCustomizationsRequested, "not_loaded");
  assert.equal(plan.autoDiscoveredCustomizationsRestrictionVerified, false);
  assert.equal(plan.settingsSourcesVerification, "not_verified");
  assert.equal(plan.managedSettingsVerification, "not_verified");
  assert.equal(plan.providerHomeSettingsIsolation, "not_implemented");
  assert.equal(
    plan.authenticationStateAndSettingsSeparation,
    "not_implemented",
  );
  assert.equal("customizationsLoaded" in plan, false);
  assert.equal(plan.operationCapabilityIssued, false);
});

test("probeの任意Provider、mode、余分field、accessor、Proxyを拒否する", () => {
  assert.equal(
    planClaudeReadOnlyProbe({ provider: "codex", mode: "read_only_probe" })
      .reason,
    "claude_execution_plan_provider_mismatch",
  );
  assert.equal(
    planClaudeReadOnlyProbe({ provider: "claude", mode: "run" }).reason,
    "claude_execution_plan_mode_not_supported",
  );
  assert.equal(
    planClaudeReadOnlyProbe({
      provider: "claude",
      mode: "read_only_probe",
      prompt: "forged",
    }).reason,
    "claude_execution_plan_shape_invalid",
  );
  const accessor = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessor, "provider", {
    enumerable: true,
    get: () => "claude",
  });
  Object.defineProperty(accessor, "mode", {
    enumerable: true,
    value: "read_only_probe",
  });
  assert.equal(
    planClaudeReadOnlyProbe(accessor).reason,
    "claude_execution_plan_shape_invalid",
  );
  assert.equal(
    planClaudeReadOnlyProbe(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("must_not_escape");
          },
        },
      ),
    ).reason,
    "claude_execution_plan_shape_invalid",
  );
});

test("全activation blockerとEffect非発行を説明契約へ保持する", () => {
  const contract = describeClaudeExecutionPlanContract();
  assert.equal(contract.implementationState, "fixed_non_executable_candidate");
  assert.equal(
    contract.activationBlockers.includes(
      "automated_subscription_use_permission_unresolved",
    ),
    true,
  );
  assert.equal(
    contract.activationBlockers.includes(
      "environment_replacement_not_implemented",
    ),
    true,
  );
  assert.equal(contract.readOnlyProbe.resultFormat, "single_json_result");
  assert.equal(contract.readOnlyProbe.maximumTurns, 1);
  assert.equal(contract.operationCapabilityIssued, false);
});
