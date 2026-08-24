import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const CLAUDE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/claude-execution-plan";
export const CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION = 6;

const PLAN_KEYS = new Set(["provider", "mode"]);
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
const DISTRIBUTION_BINDING = Object.freeze({
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
    "sha256:9815772cdc09551d2635f8cf15d90077b2da07ee87f4fe83c7c29dd59cb48ec7",
  fixedImageEvidence: Object.freeze({
    verifiedAt: "2026-08-24",
    buildNetworkMode: "none",
    baseImageDigest:
      "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
    embeddedBinaryLengthAndSha256Matched: true,
    managedSettingsSha256:
      "736c1447df695f074743f52564eefd4f9f8d8850737657d54a1f3d6052151ee8",
    imageUser: "65534:65534",
    imageWorkingDirectory: "/work",
    imageEntrypoint: DISTRIBUTION_IDENTITY.executablePath,
    reproducibleImageBuildClaimed: false,
    releaseDistributionConnected: false,
  }),
  argvCompatibilityRequired: true,
  argvCompatibilityVerified: true,
  argvCompatibilityEvidence: Object.freeze({
    verifiedAt: "2026-08-24",
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
const AUTHENTICATION_VERIFICATION = Object.freeze({
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
const ACTIVATION_BLOCKERS = Object.freeze([
  "manifest_signature_verification_not_connected_to_runtime",
  "fixed_image_distribution_not_connected_to_runtime",
  "environment_replacement_runtime_adapter_not_connected",
  "provider_home_runtime_observer_not_connected",
  "distribution_terms_not_activated",
  "authenticated_service_terms_identity_not_resolved",
  "automated_subscription_use_permission_unresolved",
  "provider_home_mount_grant_not_implemented",
  "egress_runtime_adapter_not_connected",
  "oauth_runtime_adapter_and_quota_observation_not_connected",
]);

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
    reason: "claude_activation_blockers_unresolved",
    activationBlockers: ACTIVATION_BLOCKERS,
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
    provider: "claude",
    mode: "read_only_probe",
    distributionBinding: DISTRIBUTION_BINDING,
    noNetworkVersionProbe,
    command: DISTRIBUTION_BINDING.identity.executablePath,
    argv: FIXED_ARGV,
    structuredOutputSchema: FIXED_STRUCTURED_OUTPUT_SCHEMA,
    environmentMode: "replace_required",
    environmentReplacementImplemented: false,
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
    sessionResumeAllowed: false,
    sessionPersistenceAllowed: false,
    builtInToolsRequested: "none",
    builtInToolsRestrictionVerified: false,
    mcpToolsRequested: "none",
    mcpToolsRestrictionVerified: false,
    projectInstructionsRequested: "not_loaded",
    projectInstructionsRestrictionVerified: false,
    autoDiscoveredCustomizationsRequested: "not_loaded",
    autoDiscoveredCustomizationsRestrictionVerified: false,
    settingsSourcesVerification: "not_verified",
    managedSettingsVerification: "not_verified",
    providerHomeSettingsIsolation: "not_implemented",
    authenticationStateAndSettingsSeparation: "not_implemented",
  });
}

export function describeClaudeExecutionPlanContract() {
  return Object.freeze({
    contract: CLAUDE_EXECUTION_PLAN_CONTRACT,
    contractRevision: CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
    provider: "claude",
    implementationState:
      "transient_claude_max_boolean_probe_verified_runtime_activation_blocked",
    distribution: Object.freeze({
      binding: DISTRIBUTION_BINDING,
      installationMethod: "official_native_binary_in_fixed_runtime_image",
      binaryDistributionTerms: Object.freeze({
        licenseDocument: LICENSE_DOCUMENT,
        referencedTermsCandidate: COMMERCIAL_TERMS_DOCUMENT,
        termsIdentityResolved: false,
        termsActivated: false,
        fixedImageUsePermission: "unresolved",
        redistributionPermission: "unresolved",
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
      verification: AUTHENTICATION_VERIFICATION,
      authenticatedServiceTerms: Object.freeze({
        candidateDocuments: Object.freeze([
          CONSUMER_TERMS_DOCUMENT,
          COMMERCIAL_TERMS_DOCUMENT,
        ]),
        termsIdentityResolved: false,
        termsActivated: false,
        automatedSubscriptionUsePermission: "unresolved",
      }),
      humanAuthorityConfirmed: true,
      accountAuthorityBinding:
        "transient_oauth_bootstrap_verified_runtime_binding_not_connected",
      consoleApiAccountAllowed: false,
      thirdPartyApiProviderAllowed: false,
      apiKeyAllowed: false,
      hostCredentialImportAllowed: false,
      accountCardinality: 1,
      rawAuthOutputRecorded: false,
      oauthTokenReadByRuntime: false,
    }),
    readOnlyProbe: Object.freeze({
      distributionBinding: DISTRIBUTION_BINDING,
      noNetworkVersionProbe,
      command: DISTRIBUTION_BINDING.identity.executablePath,
      argv: FIXED_ARGV,
      structuredOutputSchema: FIXED_STRUCTURED_OUTPUT_SCHEMA,
      environmentMode: "replace_required",
      environmentReplacementImplemented: false,
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
      builtInToolsRestrictionVerified: false,
      mcpToolsRequested: "none",
      mcpToolsRestrictionVerified: false,
      projectInstructionsRequested: "not_loaded",
      projectInstructionsRestrictionVerified: false,
      autoDiscoveredCustomizationsRequested: "not_loaded",
      autoDiscoveredCustomizationsRestrictionVerified: false,
      settingsSourcesVerification: "not_verified",
      managedSettingsVerification: "not_verified",
      providerHomeSettingsIsolation: "not_implemented",
      authenticationStateAndSettingsSeparation: "not_implemented",
      resultFormat: "single_json_result",
      maximumTurns: 2,
      maximumBudgetUsd: 0.1,
    }),
    fixedPromptRequestAttempt: FIXED_PROMPT_REQUEST_ATTEMPT,
    fixedPromptSchemaRequestAttempt: FIXED_PROMPT_SCHEMA_REQUEST_ATTEMPT,
    fixedPromptBoundedRequestAttempt: FIXED_PROMPT_BOUNDED_REQUEST_ATTEMPT,
    fixedPromptBooleanRequestVerification:
      FIXED_PROMPT_BOOLEAN_REQUEST_VERIFICATION,
    activationBlockers: ACTIVATION_BLOCKERS,
    providerSpawn:
      "transient_fixed_request_verified_runtime_activation_blocked",
    operationCapabilityIssued: false,
  });
}
