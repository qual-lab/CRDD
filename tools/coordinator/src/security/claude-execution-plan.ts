import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { describeProviderBillingPolicyContract } from "./provider-billing-policy.ts";

export const CLAUDE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/claude-execution-plan";
export const CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION = 12;

const PLAN_KEYS = new Set(["provider", "mode"]);
const TASK_PLAN_KEYS = new Set(["provider", "mode", "taskRole", "effort"]);
const billingPolicy = describeProviderBillingPolicyContract();
const FIXED_PROMPT =
  "Return one JSON object with the single key status and the boolean value true. Do not use tools.";
const FIXED_STRUCTURED_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: Object.freeze({
    status: Object.freeze({ const: true }),
  }),
  required: Object.freeze(["status"]),
  additionalProperties: false,
});
const FIXED_STRUCTURED_OUTPUT_SCHEMA_ARGUMENT =
  '{"type":"object","properties":{"status":{"const":true}},"required":["status"],"additionalProperties":false}';
const TASK_SETTINGS_PATH = "/etc/crdd/claude-task-settings.json";
const EXECUTOR_SCHEMA_ARGUMENT =
  '{"type":"object","properties":{"status":{"type":"string","const":"completed"},"summary":{"type":"string","minLength":1,"maxLength":8192},"changedPaths":{"type":"array","maxItems":1000,"uniqueItems":true,"items":{"type":"string","minLength":1,"maxLength":1024}},"verification":{"type":"array","maxItems":32,"items":{"type":"string","minLength":1,"maxLength":1024}}},"required":["status","summary","changedPaths","verification"],"additionalProperties":false}';
const REVIEWER_SCHEMA_ARGUMENT =
  '{"type":"object","properties":{"decision":{"type":"string","enum":["approved","changes_requested"]},"summary":{"type":"string","minLength":1,"maxLength":8192},"findings":{"type":"array","maxItems":64,"items":{"type":"object","properties":{"severity":{"type":"string","enum":["critical","high","medium","low","info"]},"path":{"type":"string","minLength":1,"maxLength":1024},"category":{"type":"string","enum":["acceptance_criterion_not_met","implementation_defect","verification_defect","security_or_authority_defect"]},"criterionNumber":{"type":"integer","minimum":1,"maximum":16},"message":{"type":"string","minLength":1,"maxLength":4096}},"required":["severity","path","category","criterionNumber","message"],"additionalProperties":false}}},"required":["decision","summary","findings"],"additionalProperties":false}';
const FIXED_ARGV = Object.freeze([
  "--safe-mode",
  "--setting-sources=",
  "--strict-mcp-config",
  "--mcp-config",
  '{"mcpServers":{}}',
  "--no-chrome",
  "--json-schema",
  FIXED_STRUCTURED_OUTPUT_SCHEMA_ARGUMENT,
  "-p",
  FIXED_PROMPT,
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
const FIXED_ENVIRONMENT = Object.freeze({
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
const FIXED_MANAGED_SETTINGS = Object.freeze({
  forceLoginMethod: "claudeai",
  autoUpdates: false,
  feedbackSurveyRate: 0,
  skipWebFetchPreflight: true,
});
const RUNTIME_OWNED_ENVIRONMENT_SLOTS = Object.freeze([
  "HOME",
  "TMPDIR",
  "HTTPS_PROXY",
]);
const FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES = Object.freeze([
  "provider_api_keys",
  "provider_base_urls",
  "provider_selectors",
  "model_or_fallback_selectors",
  "host_proxy_configuration",
  "host_credential_or_settings_paths",
]);
const DISTRIBUTION_IDENTITY = Object.freeze({
  targetPlatform: "linux-x64",
  executablePath: "/opt/crdd/providers/claude/2.1.220/claude",
  exactVersion: "2.1.220",
  upstreamCommit: "4073f59596e272f39393db4f96abc5f4b10eff21",
  binarySha256:
    "674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863",
  binaryBytes: 275_012_592,
  manifestUrl:
    "https://downloads.claude.ai/claude-code-releases/2.1.220/manifest.json",
});
const distributionBinding = Object.freeze({
  identity: DISTRIBUTION_IDENTITY,
  manifestSignatureRequired: true,
  manifestSignatureVerified: true,
  manifestSignatureEvidence: Object.freeze({
    verifiedAt: "2026-08-24",
    releaseSigningKeyFingerprint: "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE",
    detachedSignature: "verified_good_signature",
    binaryLengthAndSha256MatchedManifest: true,
  }),
  releaseSigningKeyFingerprint: "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE",
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
  fixedImageEvidence: Object.freeze({
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
    imageEntrypoint: DISTRIBUTION_IDENTITY.executablePath,
    reproducibleImageBuildClaimed: false,
    releaseDistributionConnected: false,
  }),
  argvCompatibilityRequired: true,
  argvCompatibilityVerified: true,
  argvCompatibilityEvidence: Object.freeze({
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
  }),
});
const noNetworkVersionProbe = Object.freeze({
  status: "verified" as const,
  verifiedAt: "2026-08-24",
  command: DISTRIBUTION_IDENTITY.executablePath,
  argv: Object.freeze(["--version"]),
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
const COMMERCIAL_TERMS_DOCUMENT = Object.freeze({
  documentIdentity: "anthropic_commercial_terms_2025-06-17",
  url: "https://www.anthropic.com/legal/commercial-terms",
  publishedVersionEffectiveDate: "2025-06-17",
  reviewedAt: "2026-08-22",
  reviewState: "candidate_unresolved",
});
const CONSUMER_TERMS_DOCUMENT = Object.freeze({
  documentIdentity: "anthropic_consumer_terms_2025-10-08",
  url: "https://www.anthropic.com/legal/consumer-terms",
  publishedVersionEffectiveDate: "2025-10-08",
  reviewedAt: "2026-08-22",
  reviewState: "candidate_unresolved",
});
const LICENSE_DOCUMENT = Object.freeze({
  documentIdentity: "claude_code_license_at_release_v2.1.220",
  sourceRevision: "7ef6eec9d9ba84ea6f233f26c45f1df5c5991843",
  url: "https://github.com/anthropics/claude-code/blob/7ef6eec9d9ba84ea6f233f26c45f1df5c5991843/LICENSE.md",
  publishedVersionEffectiveDate: null,
  reviewedAt: "2026-08-22",
  reviewState: "candidate_unresolved",
  relation: "references_anthropic_commercial_terms",
});
const OFFERING_CANDIDATES = Object.freeze([
  Object.freeze({
    offering: "claude_pro",
    offeringClass: "individual_offering_candidate",
  }),
  Object.freeze({
    offering: "claude_max",
    offeringClass: "individual_offering_candidate",
  }),
  Object.freeze({
    offering: "claude_team",
    offeringClass: "organization_offering_candidate",
  }),
  Object.freeze({
    offering: "claude_enterprise",
    offeringClass: "organization_offering_candidate",
  }),
]);
const authenticationVerification = Object.freeze({
  verifiedAt: "2026-08-24",
  loginCommand: Object.freeze([
    DISTRIBUTION_IDENTITY.executablePath,
    "auth",
    "login",
    "--claudeai",
  ]),
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
const FIXED_PROMPT_REQUEST_ATTEMPT = Object.freeze({
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
const FIXED_PROMPT_SCHEMA_REQUEST_ATTEMPT = Object.freeze({
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
const FIXED_PROMPT_BOUNDED_REQUEST_ATTEMPT = Object.freeze({
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
const FIXED_PROMPT_BOOLEAN_REQUEST_VERIFICATION = Object.freeze({
  status: "verified",
  executedAt: "2026-08-24",
  exactRequestCommandCount: 1,
  processExitCode: 0,
  responseSubtype: "success",
  providerReportedError: false,
  normalizedResult: Object.freeze({ status: true }),
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
  verifierCorrection: Object.freeze({
    defect: "powershell_single_element_expression_unwrapped_to_scalar_string",
    oldIndexZero: "s",
    correctedCollectionType: "System.Object[]",
    correctedIndexZero: "status",
    deterministicFixtureVerified: true,
  }),
  rawOutputSha256:
    "65c2a2079a4de7b673bae1197b82025a5a251276e9781b8e68d42bb4d5169aeb",
  rawOutputRecorded: false,
  identityFieldsRecorded: false,
  providerNetworkCount: 1,
  providerNetworkInternal: true,
  proxyOutcomes: Object.freeze([
    "ready",
    "tunnel_established",
    "tunnel_closed",
  ]),
  repositoryMounted: false,
  workspaceMounted: false,
  toolsRequested: "none",
  sessionPersistenceRequested: false,
  apiKeyEnvironmentProvided: false,
  cleanupVerified: true,
  containerResidue: 0,
  networkResidue: 0,
});
const ACTIVATION_GATES = Object.freeze([
  "runtime_owned_model_selection_grant",
  "fixed_digest_official_provider_image",
  "runtime_owned_minimal_environment_replacement",
  "dedicated_provider_home_observation_and_mount_grant",
  "interactive_external_send_grant",
  "limited_egress_proxy",
  "subscription_oauth_preflight_before_provider_request",
  "runtime_owned_authority_revision_cleanup_and_recovery",
]);
const ACTIVATION_BLOCKERS = Object.freeze([] as string[]);

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
  });
}

export function planClaudeReadOnlyProbe(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, PLAN_KEYS);
  if (!value) return blocked("claude_execution_plan_shape_invalid");
  if (value.provider !== "claude")
    return blocked("claude_execution_plan_provider_mismatch");
  if (value.mode !== "read_only_probe")
    return blocked("claude_execution_plan_mode_not_supported");

  return Object.freeze({
    status: "candidate",
    reason: "claude_runtime_activation_gates_required",
    activationGates: ACTIVATION_GATES,
    activationBlockers: ACTIVATION_BLOCKERS,
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
    provider: "claude",
    mode: "read_only_probe",
    distributionBinding: distributionBinding,
    noNetworkVersionProbe,
    command: distributionBinding.identity.executablePath,
    modelSelection:
      "coordinator_explainable_selection_and_verified_profile_required",
    effortSelection:
      "coordinator_cost_guarded_selection_and_authority_binding_required",
    fallbackModelAllowed: false,
    providerAutomaticModelSwitchingAllowed: false,
    coordinatorPrelaunchModelSelectionAllowed: true,
    midExecutionModelSwitchingAllowed: false,
    speedMode: "normal_only",
    argv: FIXED_ARGV,
    structuredOutputSchema: FIXED_STRUCTURED_OUTPUT_SCHEMA,
    environmentMode: "replace_required",
    environmentReplacementImplemented: true,
    environmentReplacementTransientlyVerified: true,
    parentEnvironmentInherited: false,
    environment: FIXED_ENVIRONMENT,
    managedSettings: FIXED_MANAGED_SETTINGS,
    managedSettingsPath: "/etc/claude-code/managed-settings.json" as const,
    bareModeAllowed: false,
    safeModeRequired: true,
    runtimeOwnedEnvironmentSlots: RUNTIME_OWNED_ENVIRONMENT_SLOTS,
    forbiddenParentEnvironmentCategories:
      FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES,
    shellAllowed: false,
    pathLookupAllowed: false,
    workspaceMountRequired: false,
    providerHomeMountRequired: true,
    providerHomeBindMountTransientlyVerified: true,
    providerRequestExpected: true,
    includedSubscriptionUsageMayBeConsumed: true,
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    automaticPlanSwitchAllowed: false,
    billingPolicy: billingPolicy,
    sessionResumeAllowed: false,
    sessionPersistenceAllowed: false,
    builtInToolsRequested: "none",
    builtInToolsRestrictionVerified: true,
    mcpToolsRequested: "none",
    mcpToolsRestrictionVerified: true,
    projectInstructionsRequested: "not_loaded",
    projectInstructionsRestrictionVerified: true,
    autoDiscoveredCustomizationsRequested: "not_loaded",
    autoDiscoveredCustomizationsRestrictionVerified: true,
    settingsSourcesVerification: "fixed_empty_sources_verified",
    managedSettingsVerification: "fixed_image_hash_verified",
    providerHomeSettingsIsolation: "dedicated_provider_home_connected",
    authenticationStateAndSettingsSeparation:
      "dedicated_provider_home_no_cross_provider_mixing",
  });
}

export function planClaudeIsolatedTask(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, TASK_PLAN_KEYS);
  if (!value) return blocked("claude_task_execution_plan_shape_invalid");
  if (value.provider !== "claude")
    return blocked("claude_task_execution_plan_provider_mismatch");
  if (value.mode !== "isolated_task")
    return blocked("claude_task_execution_plan_mode_not_supported");
  if (value.taskRole !== "executor" && value.taskRole !== "reviewer")
    return blocked("claude_task_execution_plan_role_invalid");
  if (
    value.effort !== "low" &&
    value.effort !== "medium" &&
    value.effort !== "high"
  ) {
    return blocked("claude_task_execution_plan_effort_invalid");
  }
  const taskRole = value.taskRole;
  const effort = value.effort;
  const maximumTurns = effort === "low" ? 4 : effort === "medium" ? 6 : 8;
  const tools =
    taskRole === "executor" ? "Read,Glob,Grep,Edit,Write" : "Read,Glob,Grep";
  return Object.freeze({
    status: "candidate" as const,
    reason: "runtime_owned_activation_gates_required",
    activationGates: ACTIVATION_GATES,
    activationBlockers: ACTIVATION_BLOCKERS,
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
    provider: "claude" as const,
    mode: "isolated_task" as const,
    taskRole,
    effort,
    distributionBinding: distributionBinding,
    command: distributionBinding.identity.executablePath,
    speedMode: "normal_only" as const,
    argv: Object.freeze([
      "--safe-mode",
      "--setting-sources=",
      "--settings",
      TASK_SETTINGS_PATH,
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--no-chrome",
      "--json-schema",
      taskRole === "executor"
        ? EXECUTOR_SCHEMA_ARGUMENT
        : REVIEWER_SCHEMA_ARGUMENT,
      "-p",
      "--output-format",
      "json",
      "--max-turns",
      maximumTurns.toString(),
      "--no-session-persistence",
      "--permission-mode",
      "dontAsk",
      "--tools",
      tools,
      "--disallowedTools",
      "Bash,WebFetch,WebSearch,Task,NotebookEdit,mcp__*",
      "--disable-slash-commands",
      "--prompt-suggestions",
      "false",
    ]),
    environment: FIXED_ENVIRONMENT,
    environmentMode: "replace_required" as const,
    parentEnvironmentInherited: false,
    providerHomeMountRequired: true,
    workspaceMountRequired: true,
    workspaceMountMode: taskRole === "executor" ? "read_write" : "read_only",
    taskPromptTransport: "stdin_only" as const,
    taskPromptInArgvAllowed: false,
    shellAllowed: false,
    commandNetworkAccessAllowed: false,
    webToolsAllowed: false,
    mcpAllowed: false,
    subagentAllowed: false,
    providerHomeBuiltInToolAccessAllowed: false,
    maximumTurns,
    maximumBudgetUsd: null,
    apiEquivalentUsdBudgetDisposition:
      "not_applied_to_subscription_only_execution",
    usageControls: Object.freeze([
      "coordinator_model_and_effort_selection",
      "maximum_turns",
      "provider_timeout",
      "output_limit",
    ]),
    explicitSpendBudgetProfileImplemented: false,
    sessionPersistenceAllowed: false,
    loginPolicy: "existing_claude_subscription_oauth" as const,
    billingPolicy: billingPolicy,
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
    additionalCreditPurchaseAllowed: false,
    automaticPlanSwitchAllowed: false,
  });
}

export function describeClaudeExecutionPlanContract() {
  return Object.freeze({
    contract: CLAUDE_EXECUTION_PLAN_CONTRACT,
    contractRevision: CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
    provider: "claude",
    implementationState:
      "local_personal_runtime_activation_gates_connected_candidate",
    distribution: Object.freeze({
      binding: distributionBinding,
      installationMethod: "official_native_binary_in_fixed_runtime_image",
      binaryDistributionTerms: Object.freeze({
        licenseDocument: LICENSE_DOCUMENT,
        referencedTermsCandidate: COMMERCIAL_TERMS_DOCUMENT,
        termsIdentityResolved: false,
        termsActivated: false,
        fixedImageUsePermission: "local_personal_user_directed_use_only",
        redistributionPermission: "unresolved_not_exercised",
      }),
      autoUpdateAllowed: false,
      manualUpdateAllowedAtRuntime: false,
    }),
    authentication: Object.freeze({
      loginPolicy: "existing_subscription_oauth",
      explicitLoginCommand: Object.freeze([
        DISTRIBUTION_IDENTITY.executablePath,
        "auth",
        "login",
        "--claudeai",
      ]),
      consoleLoginAllowed: false,
      offeringCandidates: OFFERING_CANDIDATES,
      selectedAccountOfferingObserved: true,
      selectedAccountOffering: "claude_max",
      verification: authenticationVerification,
      authenticatedServiceTerms: Object.freeze({
        candidateDocuments: Object.freeze([
          CONSUMER_TERMS_DOCUMENT,
          COMMERCIAL_TERMS_DOCUMENT,
        ]),
        termsIdentityResolved: false,
        termsActivated: false,
        automatedSubscriptionUsePermission:
          "user_directed_local_personal_use_only_no_general_permission_claim",
      }),
      humanAuthorityConfirmed: true,
      accountAuthorityBinding:
        "network_none_read_only_subscription_preflight_connected",
      consoleApiAccountAllowed: false,
      thirdPartyApiProviderAllowed: false,
      apiKeyAllowed: false,
      hostCredentialImportAllowed: false,
      accountCardinality: 1,
      rawAuthOutputRecorded: false,
      oauthTokenReadByRuntime: false,
    }),
    billingPolicy: billingPolicy,
    readOnlyProbe: Object.freeze({
      distributionBinding: distributionBinding,
      noNetworkVersionProbe,
      command: distributionBinding.identity.executablePath,
      modelSelection:
        "coordinator_explainable_selection_and_verified_profile_required",
      effortSelection:
        "coordinator_cost_guarded_selection_and_authority_binding_required",
      fallbackModelAllowed: false,
      providerAutomaticModelSwitchingAllowed: false,
      coordinatorPrelaunchModelSelectionAllowed: true,
      midExecutionModelSwitchingAllowed: false,
      speedMode: "normal_only",
      argv: FIXED_ARGV,
      structuredOutputSchema: FIXED_STRUCTURED_OUTPUT_SCHEMA,
      environmentMode: "replace_required",
      environmentReplacementImplemented: true,
      environmentReplacementTransientlyVerified: true,
      parentEnvironmentInherited: false,
      environment: FIXED_ENVIRONMENT,
      managedSettings: FIXED_MANAGED_SETTINGS,
      managedSettingsPath: "/etc/claude-code/managed-settings.json",
      bareModeAllowed: false,
      safeModeRequired: true,
      runtimeOwnedEnvironmentSlots: RUNTIME_OWNED_ENVIRONMENT_SLOTS,
      forbiddenParentEnvironmentCategories:
        FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES,
      workspaceMountRequired: false,
      providerHomeMountRequired: true,
      providerHomeBindMountTransientlyVerified: true,
      providerRequestExpected: true,
      includedSubscriptionUsageMayBeConsumed: true,
      additionalCreditPurchaseAllowed: false,
      sessionResumeAllowed: false,
      sessionPersistenceAllowed: false,
      builtInToolsRequested: "none",
      builtInToolsRestrictionVerified: true,
      mcpToolsRequested: "none",
      mcpToolsRestrictionVerified: true,
      projectInstructionsRequested: "not_loaded",
      projectInstructionsRestrictionVerified: true,
      autoDiscoveredCustomizationsRequested: "not_loaded",
      autoDiscoveredCustomizationsRestrictionVerified: true,
      settingsSourcesVerification: "fixed_empty_sources_verified",
      managedSettingsVerification: "fixed_image_hash_verified",
      providerHomeSettingsIsolation: "dedicated_provider_home_connected",
      authenticationStateAndSettingsSeparation:
        "dedicated_provider_home_no_cross_provider_mixing",
      resultFormat: "single_json_result",
      maximumTurns: 2,
      maximumBudgetUsd: 0.1,
    }),
    isolatedTask: Object.freeze({
      roles: Object.freeze(["executor", "reviewer"]),
      shellAllowed: false,
      tools: "role_bounded_built_in_filesystem_tools_only",
      providerHomeBuiltInToolAccessAllowed: false,
      commandNetworkAccessAllowed: false,
      webToolsAllowed: false,
      mcpAllowed: false,
      taskPromptTransport: "stdin_only",
      promptInArgvAllowed: false,
      maximumTurnsByEffort: Object.freeze({ low: 4, medium: 6, high: 8 }),
      maximumBudgetUsdByEffort: null,
      apiEquivalentUsdBudgetDisposition:
        "not_applied_to_subscription_only_execution",
      usageControls: Object.freeze([
        "coordinator_model_and_effort_selection",
        "maximum_turns",
        "provider_timeout",
        "output_limit",
      ]),
      explicitSpendBudgetProfileImplemented: false,
    }),
    fixedPromptRequestAttempt: FIXED_PROMPT_REQUEST_ATTEMPT,
    fixedPromptSchemaRequestAttempt: FIXED_PROMPT_SCHEMA_REQUEST_ATTEMPT,
    fixedPromptBoundedRequestAttempt: FIXED_PROMPT_BOUNDED_REQUEST_ATTEMPT,
    fixedPromptBooleanRequestVerification:
      FIXED_PROMPT_BOOLEAN_REQUEST_VERIFICATION,
    activationBlockers: ACTIVATION_BLOCKERS,
    activationGates: ACTIVATION_GATES,
    providerSpawn: "runtime_adapter_authority_and_preflight_gated",
    operationCapabilityIssued: false,
  });
}
