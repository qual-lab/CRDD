import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { describeProviderBillingPolicyContract } from "./provider-billing-policy.ts";

export const CODEX_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/codex-execution-plan";
export const CODEX_EXECUTION_PLAN_CONTRACT_REVISION = 6;

const PLAN_KEYS = new Set(["provider", "mode", "effort"]);
const TASK_PLAN_KEYS = new Set(["provider", "mode", "effort", "taskRole"]);
const EFFORTS = new Set(["low", "medium", "high"]);
const FIXED_PROMPT =
  "Return one JSON object with the single key status and the boolean value true. Do not use tools.";
const FIXED_SCHEMA_PATH = "/etc/crdd/codex-result-schema.json";
const EXECUTOR_SCHEMA_PATH = "/etc/crdd/codex-executor-result-schema.json";
const REVIEWER_SCHEMA_PATH = "/etc/crdd/codex-reviewer-result-schema.json";
const COMPATIBLE_TASK_MODEL = "gpt-5.5";
const DISTRIBUTION_IDENTITY = Object.freeze({
  targetPlatform: "linux-x64-musl",
  executablePath: "/opt/crdd/providers/codex/0.149.1/codex",
  exactVersion: "0.149.1",
  releaseTag: "rust-v0.149.1",
  releaseCommit: "ff29a44391deccde0aba0f8390337d7f3c319ea4",
  archiveSha256:
    "e24fb784c7d71140d67afb620f56e9137496cf7f6c9e19217fa3666dcf306278",
  archiveBytes: 99_479_490,
  binarySha256:
    "73dc5888888f411c1f0fa7b81d866e721dcc86b527ce8e3b2cf4708661e823ba",
  binaryBytes: 258_227_840,
  sigstoreBundleSha256:
    "1976d459060cac4638f481b72142271d8bbd821abebd72555145b83b2bf3e85e",
  sigstoreIdentity:
    "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
  sigstoreIssuer: "https://token.actions.githubusercontent.com",
  bwrapArchiveSha256:
    "7b0604dc48a487e25dae35a1f200aaf125666c5c8ef73bc913e915cebc86ce7b",
  bwrapArchiveBytes: 261_611,
  bwrapBinaryPath: "/opt/crdd/providers/codex/0.149.1/codex-resources/bwrap",
  bwrapBinarySha256:
    "01fb705f067bd5365b63d8ad2323a61c8d007733ca5e649437e086f3fb9935d8",
  bwrapBinaryBytes: 529_776,
  bwrapSigstoreBundleSha256:
    "2c8b6f67a874ecb25e231366302386450775266220c08d98625408171c0d0238",
  bwrapSigstoreIdentity:
    "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
  bwrapSigstoreIssuer: "https://token.actions.githubusercontent.com",
  fixedImageDigest:
    "sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c",
  fixedImageBytes: 145_299_281,
  executorSchemaSha256:
    "daf04adf5282157984b43559298a82f1ab16de837cfb5f6cc929805390f776ce",
  reviewerSchemaSha256:
    "09e8592838b1642f738eee07fb2c1b366dc25d6a3e842dbb0649930c94a25df8",
  imageBuildDefinition:
    "40_Develop/coordinator/runtime/codex-provider.Dockerfile",
  releaseUrl: "https://github.com/openai/codex/releases/tag/rust-v0.149.1",
});
const distributionBinding = Object.freeze({
  identity: DISTRIBUTION_IDENTITY,
  fixedDigestImageRequired: true,
  fixedImageDigest: DISTRIBUTION_IDENTITY.fixedImageDigest,
  fixedImageBytes: DISTRIBUTION_IDENTITY.fixedImageBytes,
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
});
const billingPolicy = describeProviderBillingPolicyContract();

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    spawnAllowed: false,
    providerEffectAllowed: false,
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

export function planCodexReadOnlyProbe(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, PLAN_KEYS);
  if (!value) return blocked("codex_execution_plan_shape_invalid");
  if (value.provider !== "codex")
    return blocked("codex_execution_plan_provider_mismatch");
  if (value.mode !== "read_only_probe")
    return blocked("codex_execution_plan_mode_not_supported");
  if (typeof value.effort !== "string" || !EFFORTS.has(value.effort))
    return blocked("codex_execution_plan_effort_invalid");

  const effort = value.effort as "low" | "medium" | "high";
  return Object.freeze({
    status: "candidate" as const,
    reason: "runtime_owned_authority_and_distribution_required",
    spawnAllowed: false,
    providerEffectAllowed: false,
    provider: "codex" as const,
    mode: "read_only_probe" as const,
    distributionBinding: distributionBinding,
    command: DISTRIBUTION_IDENTITY.executablePath,
    exactModel: "gpt-5.6-sol",
    effort,
    speedMode: "normal" as const,
    argv: Object.freeze([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--strict-config",
      "--model",
      "gpt-5.6-sol",
      "--config",
      `model_reasoning_effort="${effort}"`,
      "--config",
      "features.respect_system_proxy=true",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--output-schema",
      FIXED_SCHEMA_PATH,
      "--color",
      "never",
      FIXED_PROMPT,
    ]),
    environment: Object.freeze({
      CODEX_HOME: "/provider-home",
      CODEX_DISABLE_AUTO_UPDATE: "1",
    }),
    providerHomeMountRequired: true,
    repositoryMounted: false,
    workspaceMountRequired: false,
    rootFilesystemReadOnly: true,
    sessionPersistenceAllowed: false,
    projectRulesLoaded: false,
    userConfigLoaded: false,
    networkAccessForModelRequestOnly: true,
    loginPolicy: "existing_chatgpt_subscription_oauth" as const,
    billingPolicy: billingPolicy,
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
    additionalCreditPurchaseAllowed: false,
    automaticPlanSwitchAllowed: false,
  });
}

export function planCodexIsolatedTask(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, TASK_PLAN_KEYS);
  if (!value) return blocked("codex_task_execution_plan_shape_invalid");
  if (value.provider !== "codex")
    return blocked("codex_task_execution_plan_provider_mismatch");
  if (value.mode !== "isolated_task")
    return blocked("codex_task_execution_plan_mode_not_supported");
  if (typeof value.effort !== "string" || !EFFORTS.has(value.effort))
    return blocked("codex_task_execution_plan_effort_invalid");
  if (value.taskRole !== "executor" && value.taskRole !== "reviewer")
    return blocked("codex_task_execution_plan_role_invalid");

  const effort = value.effort as "low" | "medium" | "high";
  const taskRole = value.taskRole as "executor" | "reviewer";
  const permissionProfile = `crdd-${taskRole}`;
  const workspaceAccess = taskRole === "executor" ? "write" : "read";
  return Object.freeze({
    status: "candidate" as const,
    reason: "runtime_owned_task_packet_and_authority_required",
    spawnAllowed: false,
    providerEffectAllowed: false,
    provider: "codex" as const,
    mode: "isolated_task" as const,
    taskRole,
    distributionBinding: distributionBinding,
    command: DISTRIBUTION_IDENTITY.executablePath,
    exactModel: COMPATIBLE_TASK_MODEL,
    effort,
    speedMode: "normal" as const,
    argv: Object.freeze([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--strict-config",
      "--model",
      COMPATIBLE_TASK_MODEL,
      "--config",
      `model_reasoning_effort="${effort}"`,
      "--config",
      "features.respect_system_proxy=true",
      "--config",
      "features.code_mode=false",
      "--config",
      "features.code_mode_host=false",
      "--config",
      "features.shell_tool=true",
      "--config",
      "features.unified_exec=true",
      "--config",
      'approval_policy="never"',
      "--config",
      'web_search="disabled"',
      "--config",
      "features.plugins=false",
      "--config",
      "features.memories=false",
      "--config",
      "agents.enabled=false",
      "--config",
      "memories.generate_memories=false",
      "--config",
      "memories.use_memories=false",
      "--config",
      "project_doc_max_bytes=0",
      "--config",
      `default_permissions="${permissionProfile}"`,
      "--config",
      `permissions.${permissionProfile}.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="${workspaceAccess}"},"${DISTRIBUTION_IDENTITY.executablePath}"="read"}`,
      "--config",
      `permissions.${permissionProfile}.network.enabled=false`,
      "--skip-git-repo-check",
      "--cd",
      "/work",
      "--output-schema",
      taskRole === "executor" ? EXECUTOR_SCHEMA_PATH : REVIEWER_SCHEMA_PATH,
      "--color",
      "never",
      "-",
    ]),
    environment: Object.freeze({
      CODEX_HOME: "/provider-home",
      CODEX_DISABLE_AUTO_UPDATE: "1",
    }),
    providerHomeMountRequired: true,
    workspaceMountRequired: true,
    workspaceMountMode: taskRole === "executor" ? "read_write" : "read_only",
    rootFilesystemReadOnly: true,
    taskPromptTransport: "stdin_only" as const,
    taskPromptInArgvAllowed: false,
    commandNetworkAccessAllowed: false,
    webSearchAllowed: false,
    mcpAllowed: false,
    pluginAllowed: false,
    subagentAllowed: false,
    memoryAllowed: false,
    projectInstructionsLoaded: false,
    userConfigLoaded: false,
    providerHomeCommandReadAllowed: false,
    sessionPersistenceAllowed: false,
    loginPolicy: "existing_chatgpt_subscription_oauth" as const,
    billingPolicy: billingPolicy,
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
    additionalCreditPurchaseAllowed: false,
    automaticPlanSwitchAllowed: false,
  });
}

export function describeCodexExecutionPlanContract() {
  return Object.freeze({
    contract: CODEX_EXECUTION_PLAN_CONTRACT,
    contractRevision: CODEX_EXECUTION_PLAN_CONTRACT_REVISION,
    provider: "codex",
    implementationState: "fixed_distribution_read_only_probe_candidate",
    distributionIdentity: DISTRIBUTION_IDENTITY,
    distributionVerification: Object.freeze({
      githubReleaseArchiveDigestMatched: true,
      extractedBinaryDigestMatchedRekorBody: true,
      sigstoreBlobSignatureVerified: true,
      sigstoreCertificateIdentityMatched: true,
      bundledBwrapDigestMatchedRekorBody: true,
      bundledBwrapSigstoreBlobSignatureVerified: true,
      bundledBwrapCertificateIdentityMatched: true,
      fixedImageBuiltFromExactBinary: true,
      fixedImageBuiltFromExactBundledBwrap: true,
      fixedImageBundledBwrapProbePassed: true,
      fixedImageBundledBwrapSelectedUnderNoNetworkProbe: true,
      fixedImageNoNetworkVersionProbePassed: true,
      fixedImageNonRootSchemaReadPassed: true,
      subscriptionBooleanRequestPassed: true,
      subscriptionBooleanRequestExitCode: 0,
      subscriptionBooleanRequestResult: Object.freeze({ status: true }),
      subscriptionBooleanRequestModel: "gpt-5.6-sol",
      subscriptionBooleanRequestEffort: "low",
      subscriptionBooleanRequestSandbox: "read-only",
      subscriptionBooleanRequestContainerResidue: 0,
      subscriptionBooleanRequestNetworkResidue: 0,
      isolatedTaskCompatibilityModel: "gpt-5.5",
      isolatedTaskCodeModeHostDisabled: true,
      isolatedTaskShellVerificationPassed: true,
      isolatedTaskExactCandidateContentPassed: true,
      isolatedTaskContainerResidue: 0,
      isolatedTaskNetworkResidue: 0,
      isolatedTaskVerifiedAt: "2026-08-30",
      verifiedAt: "2026-08-25",
    }),
    authentication: "existing_chatgpt_subscription_oauth_only",
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
    readOnlyProbeExactModel: "gpt-5.6-sol",
    isolatedTaskExactModel: COMPATIBLE_TASK_MODEL,
    preferredModelFamily: "sol",
    compatibilityReason:
      "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
    efforts: Object.freeze(["low", "medium", "high"]),
    speedMode: "normal_only",
    outboundProxyPolicy: "official_cli_respect_system_proxy_required",
    isolatedTask: Object.freeze({
      roles: Object.freeze(["executor", "reviewer"]),
      permissionProfile: "root_deny_minimal_read_workspace_role_access",
      providerHomeCommandReadAllowed: false,
      commandNetworkAccessAllowed: false,
      webSearchAllowed: false,
      taskPromptTransport: "stdin_only",
      promptInArgvAllowed: false,
    }),
    repositoryMounted: false,
    workspaceMountRequired: false,
    directProviderSpawnAllowed: false,
    providerEffectAllowed: false,
  });
}
