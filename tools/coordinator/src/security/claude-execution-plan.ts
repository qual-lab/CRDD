import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const CLAUDE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/claude-execution-plan";
export const CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION = 2;

const PLAN_KEYS = new Set(["provider", "mode"]);
const FIXED_PROMPT =
  "Return one JSON object with the single key status and the value available. Do not use tools.";
const FIXED_ARGV = Object.freeze([
  "--bare",
  "-p",
  FIXED_PROMPT,
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
const FIXED_ENVIRONMENT = Object.freeze({
  DISABLE_AUTOUPDATER: "1",
  DISABLE_UPDATES: "1",
  CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1",
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
  manifestSignatureVerified: false,
  releaseSigningKeyFingerprint: "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE",
  fixedDigestImageRequired: true,
  fixedImageDigest: null,
  argvCompatibilityRequired: true,
  argvCompatibilityVerified: false,
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
const ACTIVATION_BLOCKERS = Object.freeze([
  "manifest_signature_not_verified",
  "fixed_image_digest_not_configured",
  "fixed_argv_compatibility_not_verified",
  "environment_replacement_not_implemented",
  "settings_and_provider_home_isolation_not_verified",
  "distribution_terms_not_activated",
  "authenticated_service_terms_identity_not_resolved",
  "automated_subscription_use_permission_unresolved",
  "selected_account_offering_not_observed",
  "human_account_authority_not_confirmed",
  "provider_home_mount_grant_not_implemented",
  "egress_and_telemetry_controls_not_implemented",
  "oauth_login_and_quota_observation_not_implemented",
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
    command: DISTRIBUTION_BINDING.identity.executablePath,
    argv: FIXED_ARGV,
    environmentMode: "replace_required",
    environmentReplacementImplemented: false,
    parentEnvironmentInherited: false,
    environment: FIXED_ENVIRONMENT,
    runtimeOwnedEnvironmentSlots: RUNTIME_OWNED_ENVIRONMENT_SLOTS,
    forbiddenParentEnvironmentCategories:
      FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES,
    shellAllowed: false,
    pathLookupAllowed: false,
    workspaceMountRequired: false,
    providerHomeMountRequired: true,
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
    implementationState: "fixed_non_executable_candidate",
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
      offeringCandidates: OFFERING_CANDIDATES,
      selectedAccountOfferingObserved: false,
      authenticatedServiceTerms: Object.freeze({
        candidateDocuments: Object.freeze([
          CONSUMER_TERMS_DOCUMENT,
          COMMERCIAL_TERMS_DOCUMENT,
        ]),
        termsIdentityResolved: false,
        termsActivated: false,
        automatedSubscriptionUsePermission: "unresolved",
      }),
      humanAuthorityConfirmed: false,
      accountAuthorityBinding: "not_implemented",
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
      command: DISTRIBUTION_BINDING.identity.executablePath,
      argv: FIXED_ARGV,
      environmentMode: "replace_required",
      environmentReplacementImplemented: false,
      parentEnvironmentInherited: false,
      environment: FIXED_ENVIRONMENT,
      runtimeOwnedEnvironmentSlots: RUNTIME_OWNED_ENVIRONMENT_SLOTS,
      forbiddenParentEnvironmentCategories:
        FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES,
      workspaceMountRequired: false,
      providerHomeMountRequired: true,
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
      maximumTurns: 1,
    }),
    activationBlockers: ACTIVATION_BLOCKERS,
    providerSpawn: "blocked_before_spawn",
    operationCapabilityIssued: false,
  });
}
