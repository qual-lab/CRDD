import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLAUDE_EXECUTION_PLAN_CONTRACT,
  CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  describeClaudeExecutionPlanContract,
  planClaudeIsolatedTask,
  planClaudeReadOnlyProbe,
} from "../src/security/claude-execution-plan.ts";

test("Claude配布候補は固定絶対pathと同じexact artifact Identityへ結合する", () => {
  const contract = describeClaudeExecutionPlanContract();
  const binding = contract.distribution.binding;
  const identity = binding.identity;
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
  assert.equal(binding.manifestSignatureRequired, true);
  assert.equal(binding.manifestSignatureVerified, true);
  assert.deepEqual(binding.manifestSignatureEvidence, {
    verifiedAt: "2026-08-24",
    releaseSigningKeyFingerprint: "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE",
    detachedSignature: "verified_good_signature",
    binaryLengthAndSha256MatchedManifest: true,
  });
  assert.equal(
    binding.fixedImageDigest,
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
  );
  assert.deepEqual(binding.fixedImageEvidence, {
    verifiedAt: "2026-08-25",
    buildNetworkMode: "none",
    baseImageDigest:
      "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
    embeddedBinaryLengthAndSha256Matched: true,
    managedSettingsSha256:
      "736c1447df695f074743f52564eefd4f9f8d8850737657d54a1f3d6052151ee8",
    taskSettingsSha256:
      "1924f4754c93793668056446ee68e3cd1b0f45dd38db6b137c5aa43441599ca1",
    fixedImageBytes: 129_732_853,
    imageUser: "65534:65534",
    imageWorkingDirectory: "/work",
    imageEntrypoint: "/opt/crdd/providers/claude/2.1.220/claude",
    reproducibleImageBuildClaimed: false,
    releaseDistributionConnected: false,
  });
  assert.equal(binding.argvCompatibilityRequired, true);
  assert.equal(binding.argvCompatibilityVerified, true);
  assert.deepEqual(binding.argvCompatibilityEvidence, {
    verifiedAt: "2026-08-25",
    exactBinaryVersion: "2.1.220",
    networkMode: "none",
    credentialOrProviderHomeMounted: false,
    processReachedAuthenticationBoundary: true,
    providerRequestIssued: false,
    totalCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    structuredOutputSchemaArgumentVerified: true,
  });
  assert.equal(contract.readOnlyProbe.command, identity.executablePath);
  assert.deepEqual(contract.readOnlyProbe.distributionBinding, binding);
  const plan = planClaudeReadOnlyProbe({
    provider: "claude",
    mode: "read_only_probe",
  });
  if (plan.status !== "candidate") assert.fail(plan.reason);
  assert.deepEqual(plan.distributionBinding, binding);
  assert.equal(plan.distributionBinding.manifestSignatureVerified, true);
  assert.equal(
    plan.distributionBinding.fixedImageDigest,
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
  );
  assert.equal(plan.distributionBinding.argvCompatibilityVerified, true);
  assert.equal(plan.spawnAllowed, false);
  assert.equal(
    contract.providerSpawn,
    "runtime_adapter_authority_and_preflight_gated",
  );
  assert.deepEqual(contract.readOnlyProbe.noNetworkVersionProbe, {
    status: "verified",
    verifiedAt: "2026-08-24",
    command: "/opt/crdd/providers/claude/2.1.220/claude",
    argv: ["--version"],
    output: "2.1.220 (Claude Code)",
    processExitCode: 0,
    providerRequestExpected: false,
    networkMode: "none",
    repositoryMounted: false,
    credentialOrProviderHomeMounted: false,
    readOnlyRootFilesystem: true,
    linuxUser: "65534:65534",
    capabilities: "all_dropped",
    pidLimit: 16,
    binaryMount: "read_only_verified_artifact",
    baseImage:
      "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
    containerRemovedAfterExit: true,
    finalProviderImageEstablished: false,
  });
});

test("配布物条件と認証service条件を別axisの未解決条件にする", () => {
  const contract = describeClaudeExecutionPlanContract();
  const distributionTerms = contract.distribution.binaryDistributionTerms;
  const authentication = contract.authentication;
  const serviceTerms = authentication.authenticatedServiceTerms;
  assert.equal(distributionTerms.termsIdentityResolved, false);
  assert.equal(distributionTerms.termsActivated, false);
  assert.equal(
    distributionTerms.fixedImageUsePermission,
    "local_personal_user_directed_use_only",
  );
  assert.equal(
    distributionTerms.redistributionPermission,
    "unresolved_not_exercised",
  );
  assert.deepEqual(distributionTerms.licenseDocument, {
    documentIdentity: "claude_code_license_at_release_v2.1.220",
    sourceRevision: "7ef6eec9d9ba84ea6f233f26c45f1df5c5991843",
    url: "https://github.com/anthropics/claude-code/blob/7ef6eec9d9ba84ea6f233f26c45f1df5c5991843/LICENSE.md",
    publishedVersionEffectiveDate: null,
    reviewedAt: "2026-08-22",
    reviewState: "candidate_unresolved",
    relation: "references_anthropic_commercial_terms",
  });
  assert.deepEqual(distributionTerms.referencedTermsCandidate, {
    documentIdentity: "anthropic_commercial_terms_2025-06-17",
    url: "https://www.anthropic.com/legal/commercial-terms",
    publishedVersionEffectiveDate: "2025-06-17",
    reviewedAt: "2026-08-22",
    reviewState: "candidate_unresolved",
  });
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
  assert.equal(authentication.selectedAccountOfferingObserved, true);
  assert.equal(authentication.selectedAccountOffering, "claude_max");
  assert.deepEqual(authentication.verification, {
    verifiedAt: "2026-08-24",
    loginCommand: [
      "/opt/crdd/providers/claude/2.1.220/claude",
      "auth",
      "login",
      "--claudeai",
    ],
    loginProcessExitCode: 0,
    loginMethod: "claude.ai",
    subscriptionType: "max",
    authStatusProcessExitCode: 0,
    authStatusNetworkMode: "none",
    authStatusProviderHomeMount: "read_only",
    rawAuthOutputRecorded: false,
    identityFieldsRecorded: false,
    credentialContentRead: false,
    oauthTokenReadByRuntime: false,
    oauthInfrastructureCleanupVerified: true,
  });
  assert.deepEqual(serviceTerms.candidateDocuments, [
    {
      documentIdentity: "anthropic_consumer_terms_2025-10-08",
      url: "https://www.anthropic.com/legal/consumer-terms",
      publishedVersionEffectiveDate: "2025-10-08",
      reviewedAt: "2026-08-22",
      reviewState: "candidate_unresolved",
    },
    {
      documentIdentity: "anthropic_commercial_terms_2025-06-17",
      url: "https://www.anthropic.com/legal/commercial-terms",
      publishedVersionEffectiveDate: "2025-06-17",
      reviewedAt: "2026-08-22",
      reviewState: "candidate_unresolved",
    },
  ]);
  assert.equal(serviceTerms.termsIdentityResolved, false);
  assert.equal(serviceTerms.termsActivated, false);
  assert.equal(
    serviceTerms.automatedSubscriptionUsePermission,
    "user_directed_local_personal_use_only_no_general_permission_claim",
  );
  assert.equal(authentication.humanAuthorityConfirmed, true);
  assert.equal(
    authentication.accountAuthorityBinding,
    "network_none_read_only_subscription_preflight_connected",
  );
  assert.equal("supportedSubscriptions" in authentication, false);
  assert.equal("termsReview" in contract.distribution, false);
});

test("Claude認証はsubscription OAuth候補だけを残しAPI課金経路を拒否する", () => {
  const contract = describeClaudeExecutionPlanContract();
  const authentication = contract.authentication;
  assert.equal(authentication.loginPolicy, "existing_subscription_oauth");
  assert.deepEqual(authentication.explicitLoginCommand, [
    "/opt/crdd/providers/claude/2.1.220/claude",
    "auth",
    "login",
    "--claudeai",
  ]);
  assert.equal(authentication.consoleLoginAllowed, false);
  assert.equal(authentication.consoleApiAccountAllowed, false);
  assert.equal(authentication.thirdPartyApiProviderAllowed, false);
  assert.equal(authentication.apiKeyAllowed, false);
  assert.equal(authentication.hostCredentialImportAllowed, false);
  assert.equal(authentication.rawAuthOutputRecorded, false);
  assert.equal(authentication.oauthTokenReadByRuntime, false);
  assert.equal(authentication.verification.loginMethod, "claude.ai");
  assert.equal(authentication.verification.subscriptionType, "max");
  assert.equal(contract.billingPolicy.defaultProfile, "subscription_only");
  assert.equal(
    contract.billingPolicy.defaultPaidApiDisposition,
    "prohibited_and_unsupported",
  );
  assert.equal(
    contract.billingPolicy.paidApiCapability,
    "not_implemented_separate_opt_in_profile",
  );
  assert.equal(contract.billingPolicy.implicitFallbackAllowed, false);
  assert.equal(contract.billingPolicy.quotaExhaustionFallbackAllowed, false);
  assert.equal(
    contract.billingPolicy.userConfigurationEffect,
    "enables_separate_paid_api_policy_evaluation_only",
  );
});

test("読取専用probe候補は固定argv、環境置換要求、未検証制約を投影する", () => {
  const contract = describeClaudeExecutionPlanContract();
  const plan = planClaudeReadOnlyProbe({
    provider: "claude",
    mode: "read_only_probe",
  });
  assert.equal(plan.status, "candidate");
  assert.equal(plan.reason, "claude_runtime_activation_gates_required");
  assert.equal(plan.activationBlockers.length, 0);
  assert.equal(
    plan.activationGates.includes("interactive_external_send_grant"),
    true,
  );
  assert.equal(plan.command, "/opt/crdd/providers/claude/2.1.220/claude");
  assert.deepEqual(plan.argv, [
    "--safe-mode",
    "--setting-sources=",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-chrome",
    "--json-schema",
    '{"type":"object","properties":{"status":{"const":true}},"required":["status"],"additionalProperties":false}',
    "-p",
    "Return one JSON object with the single key status and the boolean value true. Do not use tools.",
    "--output-format",
    "json",
    "--max-turns",
    "2",
    "--max-budget-usd",
    "0.10",
    "--no-session-persistence",
    "--permission-mode",
    "plan",
    "--tools=",
    "--disallowedTools",
    "mcp__*",
    "--disable-slash-commands",
    "--prompt-suggestions",
    "false",
  ]);
  assert.equal(plan.distributionBinding.argvCompatibilityRequired, true);
  assert.equal(plan.distributionBinding.argvCompatibilityVerified, true);
  assert.equal(
    plan.distributionBinding.fixedImageDigest,
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
  );
  assert.equal(plan.environmentMode, "replace_required");
  assert.equal(plan.environmentReplacementImplemented, true);
  assert.equal(plan.environmentReplacementTransientlyVerified, true);
  assert.equal(plan.parentEnvironmentInherited, false);
  assert.deepEqual(plan.environment, {
    DISABLE_AUTOUPDATER: "1",
    DISABLE_UPDATES: "1",
    CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
    CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: "1",
  });
  assert.deepEqual(plan.managedSettings, {
    forceLoginMethod: "claudeai",
    autoUpdates: false,
    feedbackSurveyRate: 0,
    skipWebFetchPreflight: true,
  });
  assert.equal(
    plan.managedSettingsPath,
    "/etc/claude-code/managed-settings.json",
  );
  assert.equal(plan.bareModeAllowed, false);
  assert.equal(plan.safeModeRequired, true);
  assert.deepEqual(plan.structuredOutputSchema, {
    type: "object",
    properties: { status: { const: true } },
    required: ["status"],
    additionalProperties: false,
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
  assert.equal(plan.providerHomeBindMountTransientlyVerified, true);
  assert.equal(plan.providerRequestExpected, true);
  assert.equal(plan.includedSubscriptionUsageMayBeConsumed, true);
  assert.equal(plan.apiKeyAllowed, false);
  assert.equal(plan.additionalCreditPurchaseAllowed, false);
  assert.equal(plan.automaticPlanSwitchAllowed, false);
  assert.deepEqual(plan.billingPolicy, contract.billingPolicy);
  assert.equal(plan.sessionResumeAllowed, false);
  assert.equal(plan.sessionPersistenceAllowed, false);
  assert.equal(plan.builtInToolsRequested, "none");
  assert.equal(plan.builtInToolsRestrictionVerified, true);
  assert.equal(plan.mcpToolsRequested, "none");
  assert.equal(plan.mcpToolsRestrictionVerified, true);
  assert.equal(plan.projectInstructionsRequested, "not_loaded");
  assert.equal(plan.projectInstructionsRestrictionVerified, true);
  assert.equal(plan.autoDiscoveredCustomizationsRequested, "not_loaded");
  assert.equal(plan.autoDiscoveredCustomizationsRestrictionVerified, true);
  assert.equal(
    plan.settingsSourcesVerification,
    "fixed_empty_sources_verified",
  );
  assert.equal(plan.managedSettingsVerification, "fixed_image_hash_verified");
  assert.equal(
    plan.providerHomeSettingsIsolation,
    "dedicated_provider_home_connected",
  );
  assert.equal(
    plan.authenticationStateAndSettingsSeparation,
    "dedicated_provider_home_no_cross_provider_mixing",
  );
  assert.equal("customizationsLoaded" in plan, false);
  assert.equal(plan.operationCapabilityIssued, false);
});

test("Managed Settingsの固定byte列を検証済みimage identityへ結合する", () => {
  const settings = readFileSync(
    new URL("../runtime/claude-managed-settings.json", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(settings).digest("hex"),
    describeClaudeExecutionPlanContract().distribution.binding
      .fixedImageEvidence.managedSettingsSha256,
  );
  assert.deepEqual(JSON.parse(settings.toString("utf8")), {
    autoUpdates: false,
    feedbackSurveyRate: 0,
    forceLoginMethod: "claudeai",
    skipWebFetchPreflight: true,
  });
});

test("一般TaskはRole別built-in tools、stdin、Provider Home denyへ固定する", () => {
  const executor = planClaudeIsolatedTask({
    provider: "claude",
    mode: "isolated_task",
    taskRole: "executor",
    effort: "low",
  });
  const reviewer = planClaudeIsolatedTask({
    provider: "claude",
    mode: "isolated_task",
    taskRole: "reviewer",
    effort: "high",
  });
  assert.equal(executor.status, "candidate");
  assert.equal(executor.activationBlockers.length, 0);
  assert.equal(
    executor.activationGates.includes(
      "subscription_oauth_preflight_before_provider_request",
    ),
    true,
  );
  assert.equal(executor.workspaceMountMode, "read_write");
  assert.equal(executor.maximumTurns, 4);
  assert.equal(executor.maximumBudgetUsd, 0.2);
  assert.equal(reviewer.status, "candidate");
  assert.equal(reviewer.workspaceMountMode, "read_only");
  assert.equal(reviewer.maximumTurns, 8);
  assert.equal(reviewer.maximumBudgetUsd, 0.5);
  for (const plan of [executor, reviewer]) {
    assert.equal(plan.taskPromptTransport, "stdin_only");
    assert.equal(plan.taskPromptInArgvAllowed, false);
    assert.equal(plan.shellAllowed, false);
    assert.equal(plan.commandNetworkAccessAllowed, false);
    assert.equal(plan.providerHomeBuiltInToolAccessAllowed, false);
    assert.equal(plan.argv.includes("--settings"), true);
    assert.equal(
      plan.argv.includes("/etc/crdd/claude-task-settings.json"),
      true,
    );
    assert.equal(plan.argv.includes("--permission-mode"), true);
    assert.equal(plan.argv.includes("dontAsk"), true);
  }
});

test("Claude Task SettingsはProvider Homeと外部Toolをdenyする", () => {
  const settings = JSON.parse(
    readFileSync(
      new URL("../runtime/claude-task-settings.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(settings.permissions.deny, [
    "Read(//provider-home/**)",
    "Edit(//provider-home/**)",
    "Write(//provider-home/**)",
    "Glob(//provider-home/**)",
    "Grep(//provider-home/**)",
    "Bash",
    "WebFetch",
    "WebSearch",
    "Task",
    "NotebookEdit",
    "mcp__*",
  ]);
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
      billingProfile: "paid_api",
    }).reason,
    "claude_execution_plan_shape_invalid",
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

test("全Runtime activation gateとPlan単体のEffect非発行を説明契約へ保持する", () => {
  const contract = describeClaudeExecutionPlanContract();
  assert.equal(
    contract.implementationState,
    "local_personal_runtime_activation_gates_connected_candidate",
  );
  assert.deepEqual(contract.activationBlockers, []);
  assert.equal(
    contract.activationGates.includes("interactive_external_send_grant"),
    true,
  );
  assert.equal(
    contract.activationGates.includes(
      "subscription_oauth_preflight_before_provider_request",
    ),
    true,
  );
  assert.equal(contract.readOnlyProbe.resultFormat, "single_json_result");
  assert.equal(contract.readOnlyProbe.maximumTurns, 2);
  assert.equal(contract.readOnlyProbe.maximumBudgetUsd, 0.1);
  assert.deepEqual(contract.fixedPromptRequestAttempt, {
    executedAt: "2026-08-24",
    exactRequestCount: 1,
    processExitCode: 0,
    providerReportedError: false,
    numberOfTurns: 1,
    providerReportedApiEquivalentCostUsd: 0.036975,
    inputTokens: 2,
    outputTokens: 15,
    cacheCreationInputTokens: 3659,
    cacheReadInputTokens: 0,
    resultContractVerified: false,
    resultRecorded: false,
    rawOutputSha256:
      "b8ee44de22aea189061358353123b0e9eff10d62f2723cb05ddd2a8b0e6940be",
    providerNetworkInternal: true,
    repositoryMounted: false,
    workspaceMounted: false,
    toolsRequested: "none",
    sessionPersistenceRequested: false,
    apiKeyEnvironmentProvided: false,
    cleanupVerified: true,
    containerResidue: 0,
    networkResidue: 0,
    retryIssued: false,
  });
  assert.deepEqual(contract.fixedPromptSchemaRequestAttempt, {
    executedAt: "2026-08-24",
    exactRequestCommandCount: 1,
    structuredOutputSchemaRequested: true,
    processExitCode: 1,
    resultContractVerified: false,
    resultRecorded: false,
    providerRequestIssued: "unknown",
    rawOutputSha256:
      "2e5ab9be33e00c0330eb30cf15791f1a15a87705b97f0ee20a58f46569178e70",
    authenticationStatusAfterAttempt: "logged_in_claude_ai_max",
    authenticationStatusNetworkMode: "none",
    cleanupVerified: true,
    containerResidue: 0,
    networkResidue: 0,
    automaticRetryIssued: false,
  });
  assert.deepEqual(contract.fixedPromptBoundedRequestAttempt, {
    executedAt: "2026-08-24",
    exactRequestCommandCount: 1,
    structuredOutputSchemaRequested: true,
    processExitCode: 0,
    responseSubtype: "success",
    providerReportedError: false,
    numberOfTurns: 2,
    providerReportedApiEquivalentCostUsd: 0.022397,
    inputTokens: 2,
    outputTokens: 262,
    cacheCreationInputTokens: 1452,
    cacheReadInputTokens: 2634,
    structuredOutputPresent: true,
    structuredOutputPropertyCount: 1,
    localStringResultContractVerified: false,
    resultRecorded: false,
    rawOutputSha256:
      "71fe73491564fe87b94f95b25905c23c5e2764aefcb00300c5dca14bd84235a0",
    providerNetworkInternal: true,
    repositoryMounted: false,
    workspaceMounted: false,
    toolsRequested: "none",
    maximumTurns: 2,
    maximumBudgetUsd: 0.1,
    apiKeyEnvironmentProvided: false,
    cleanupVerified: true,
    containerResidue: 0,
    networkResidue: 0,
    automaticRetryIssued: false,
  });
  assert.deepEqual(contract.fixedPromptBooleanRequestVerification, {
    status: "verified",
    executedAt: "2026-08-24",
    exactRequestCommandCount: 1,
    processExitCode: 0,
    responseSubtype: "success",
    providerReportedError: false,
    normalizedResult: { status: true },
    numberOfTurns: 2,
    maximumTurns: 2,
    maximumBudgetUsd: 0.1,
    providerReportedApiEquivalentCostUsd: 0.04699,
    inputTokens: 2,
    outputTokens: 244,
    cacheCreationInputTokens: 4088,
    cacheReadInputTokens: 0,
    structuredOutputPresent: true,
    structuredOutputPropertyCount: 1,
    resultPropertyNameExact: true,
    resultValueBooleanTrue: true,
    verifierCorrection: {
      defect: "powershell_single_element_expression_unwrapped_to_scalar_string",
      oldIndexZero: "s",
      correctedCollectionType: "System.Object[]",
      correctedIndexZero: "status",
      deterministicFixtureVerified: true,
    },
    rawOutputSha256:
      "65c2a2079a4de7b673bae1197b82025a5a251276e9781b8e68d42bb4d5169aeb",
    rawOutputRecorded: false,
    identityFieldsRecorded: false,
    providerNetworkCount: 1,
    providerNetworkInternal: true,
    proxyOutcomes: ["ready", "tunnel_established", "tunnel_closed"],
    repositoryMounted: false,
    workspaceMounted: false,
    toolsRequested: "none",
    sessionPersistenceRequested: false,
    apiKeyEnvironmentProvided: false,
    cleanupVerified: true,
    containerResidue: 0,
    networkResidue: 0,
  });
  assert.deepEqual(contract.activationBlockers, []);
  assert.equal(contract.operationCapabilityIssued, false);
});
