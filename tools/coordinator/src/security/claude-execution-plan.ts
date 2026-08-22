import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const CLAUDE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/claude-execution-plan";
export const CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION = 1;

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
    reason:
      "claude_fixed_image_home_egress_auth_and_terms_activation_not_completed",
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
    provider: "claude",
    mode: "read_only_probe",
    command: "claude",
    argv: FIXED_ARGV,
    environment: FIXED_ENVIRONMENT,
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
    builtInToolsAllowed: false,
    mcpToolsAllowed: false,
    projectInstructionsLoaded: false,
    customizationsLoaded: false,
  });
}

export function describeClaudeExecutionPlanContract() {
  return Object.freeze({
    contract: CLAUDE_EXECUTION_PLAN_CONTRACT,
    contractRevision: CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
    provider: "claude",
    implementationState: "fixed_non_executable_candidate",
    targetPlatform: "linux-x64",
    distribution: Object.freeze({
      installationMethod: "official_native_binary_in_fixed_runtime_image",
      exactVersion: "2.1.220",
      upstreamCommit: "4073f59596e272f39393db4f96abc5f4b10eff21",
      binarySha256:
        "674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863",
      binaryBytes: 275_012_592,
      manifestUrl:
        "https://downloads.claude.ai/claude-code-releases/2.1.220/manifest.json",
      manifestSignatureRequired: true,
      manifestSignatureVerified: false,
      releaseSigningKeyFingerprint: "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE",
      fixedDigestImageRequired: true,
      fixedDigestImageConfigured: false,
      termsReview: "human_activation_required",
      autoUpdateAllowed: false,
      manualUpdateAllowedAtRuntime: false,
    }),
    authentication: Object.freeze({
      loginPolicy: "existing_subscription_oauth",
      supportedSubscriptions: Object.freeze([
        "claude_pro",
        "claude_max",
        "claude_team",
        "claude_enterprise",
      ]),
      consoleApiAccountAllowed: false,
      thirdPartyApiProviderAllowed: false,
      apiKeyAllowed: false,
      hostCredentialImportAllowed: false,
      accountCardinality: 1,
      rawAuthOutputRecorded: false,
      oauthTokenReadByRuntime: false,
    }),
    readOnlyProbe: Object.freeze({
      argv: FIXED_ARGV,
      environment: FIXED_ENVIRONMENT,
      workspaceMountRequired: false,
      providerHomeMountRequired: true,
      providerRequestExpected: true,
      includedSubscriptionUsageMayBeConsumed: true,
      additionalCreditPurchaseAllowed: false,
      sessionResumeAllowed: false,
      sessionPersistenceAllowed: false,
      builtInToolsAllowed: false,
      mcpToolsAllowed: false,
      projectInstructionsLoaded: false,
      customizationsLoaded: false,
      resultFormat: "single_json_result",
      maximumTurns: 1,
    }),
    providerSpawn: "blocked_before_spawn",
    operationCapabilityIssued: false,
  });
}
