/**
 * CodexのTask・Probe・読取り助言の固定CLI計画と構成診断を所有する。
 *
 * @responsibility Codex固有の引数・配布要件・制約と非秘密の構成分類を生成し、実起動・認可・回収を所有しない。
 * @trace ARCH-000010
 */
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../../../domain-model/src/index.ts";
import { describeProviderBillingPolicy } from "../billing/policy.ts";
import type {
  ProviderModelSelection,
  ProviderAdvicePlan,
} from "../provider/plan.ts";
import type { ProviderExecutionLocations } from "../provider/types.ts";

/**
 * Codexの起動引数から非秘密の構成分類だけを投影する。
 * @responsibility Codex固有の承認・sandbox optionの意味を所有する。
 * @trace ARCH-000010
 * @input candidate: Docker包装を除いたCodex引数。
 * @returns 承認方式とsandbox方式の固定分類。
 * @precondition 呼出し元が包装とpayloadを分離している。
 * @postcondition 生引数を返さず、既存の承認優先順と最初のsandbox値を維持する。
 * @effect N/A: 局所値の投影だけ。
 * @failure 不正配列は空引数相当のother／implicitへ閉じる。
 * @invariant 構成分類を実行許可・隔離成立へ昇格しない。
 * @boundary Codex CLI構成と非秘密の診断分類。
 * @security 引数本文・秘密値・Docker設定を公開しない。
 * @concurrency N/A: 同期で入力不変。
 */
export function projectCodexExecutionBoundary(candidate: unknown) {
  const snapshot = snapshotPlainArray(candidate, 256);
  const argv =
    snapshot.status === "ok" &&
    snapshot.value.every((value) => typeof value === "string")
      ? (snapshot.value as readonly string[])
      : [];
  const approvalModeConfigured = argv.includes("--approve-for-me")
    ? ("approve_for_me" as const)
    : argv.includes('approval_policy="never"')
      ? ("never" as const)
      : ("other" as const);
  const index = argv.indexOf("--sandbox");
  const sandbox = index < 0 ? undefined : argv[index + 1];
  const sandboxModeConfigured =
    sandbox === "read-only"
      ? ("read_only" as const)
      : sandbox === undefined
        ? ("implicit" as const)
        : ("other" as const);
  return Object.freeze({ approvalModeConfigured, sandboxModeConfigured });
}

export const CODEX_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/codex-execution-plan";
export const CODEX_EXECUTION_PLAN_CONTRACT_REVISION = 15;

export const CODEX_FORBIDDEN_ENVIRONMENT_NAMES = Object.freeze([
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
]);

const PLAN_KEYS = new Set(["provider", "mode", "effort"]);
const TASK_PLAN_KEYS = new Set(["provider", "mode", "effort", "taskRole"]);
const EFFORTS = new Set(["low", "medium", "high"]);
const FIXED_PROMPT =
  "Return one JSON object with the single key status and the boolean value true. Do not use tools.";
const FIXED_SCHEMA_PATH = "codex-result-schema.json";
const EXECUTOR_SCHEMA_PATH = "codex-executor-result-schema.json";
const REVIEWER_SCHEMA_PATH = "codex-reviewer-result-schema.json";
const COMPATIBLE_TASK_MODEL = "gpt-5.5";
const billingPolicy = describeProviderBillingPolicy();

/**
 * Codex計画の拒否値を生成する。
 *
 * @responsibility 入力拒否理由と起動・Effect禁止を所有する。
 * @trace ARCH-000010
 * @input reason: string
 * @returns 固定理由付きblocked。
 * @precondition reasonは計画検査が選んだ固定拒否理由である。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: 停止結果の値だけを構築し、Process・Filesystem・外部送信を開始しない。
 * @failure N/A: 拒否値を構築する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked<R extends string>(reason: R) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    spawnAllowed: false,
    providerEffectAllowed: false,
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

/**
 * Codex読取りProbeを計画する。
 *
 * @responsibility 閉じたProvider・用途・推論強度と固定CLI構成を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns candidate計画又はblocked。
 * @precondition candidateを未信頼値として関数内で閉じたshapeと値を検査する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: 検証用の起動計画を構築するだけで、Process・Filesystem・外部送信を開始しない。
 * @failure 不正shape、Provider、用途、推論強度を拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security planCodexReadOnlyProbeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planCodexReadOnlyProbeは共有非同期状態を持たない同期処理である。
 */
export function planCodexReadOnlyProbe(
  candidate: unknown,
  locations: ProviderExecutionLocations = {},
) {
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
    command: locations.commandPath ?? "codex",
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
      locations.resultSchemaPath ?? FIXED_SCHEMA_PATH,
      "--color",
      "never",
      FIXED_PROMPT,
    ]),
    environment: Object.freeze({
      ...(locations.providerHomeDirectory
        ? { CODEX_HOME: locations.providerHomeDirectory }
        : {}),
      CODEX_DISABLE_AUTO_UPDATE: "1",
    }),
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

/**
 * Codex Taskを役割別に計画する。
 *
 * @responsibility executor／reviewerの固定CLIとTool・書込み条件を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns candidate計画又はblocked。
 * @precondition candidateを未信頼値として関数内で閉じたshape・役割・推論強度を検査する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: Taskの起動計画を構築するだけで、Process・Filesystem・外部送信を開始しない。
 * @failure 不正shape、役割、推論強度を拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security planCodexIsolatedTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planCodexIsolatedTaskは共有非同期状態を持たない同期処理である。
 */
export function planCodexIsolatedTask(
  candidate: unknown,
  locations: ProviderExecutionLocations = {},
) {
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
    command: locations.commandPath ?? "codex",
    exactModel: COMPATIBLE_TASK_MODEL,
    effort,
    speedMode: "normal" as const,
    argv: Object.freeze([
      "exec",
      "--ephemeral",
      ...(taskRole === "executor" ? ["--approve-for-me"] : []),
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
      `features.shell_tool=${taskRole === "executor" ? "true" : "false"}`,
      "--config",
      `features.unified_exec=${taskRole === "executor" ? "true" : "false"}`,
      ...(taskRole === "reviewer"
        ? ["--config", 'approval_policy="never"']
        : []),
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
      `permissions.${permissionProfile}.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="${workspaceAccess}"},"${locations.commandPath ?? "codex"}"="read"}`,
      "--config",
      `permissions.${permissionProfile}.network.enabled=false`,
      ...(taskRole === "reviewer" ? ["--sandbox", "read-only"] : []),
      "--skip-git-repo-check",
      "--cd",
      locations.workingDirectory ?? ".",
      "--json",
      "--output-schema",
      taskRole === "executor"
        ? (locations.executorSchemaPath ?? EXECUTOR_SCHEMA_PATH)
        : (locations.reviewerSchemaPath ?? REVIEWER_SCHEMA_PATH),
      "--color",
      "never",
      "-",
    ]),
    environment: Object.freeze({
      ...(locations.providerHomeDirectory
        ? { CODEX_HOME: locations.providerHomeDirectory }
        : {}),
      CODEX_DISABLE_AUTO_UPDATE: "1",
    }),
    explicitSandboxOption: "approve_for_me_executor_reviewer_read_only",
    approvalMode:
      taskRole === "executor"
        ? "automatic_review_workspace_write"
        : "never_read_only",
    taskPromptTransport: "stdin_only" as const,
    structuredEventTransport: "fixed_cli_jsonl_v0_149_1" as const,
    taskPromptInArgvAllowed: false,
    reviewerFilesystemOrShellToolAllowed: false,
    reviewerInput: "runtime_owned_immutable_candidate_content_projection_only",
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

/**
 * Codex実行の固定条件を記述する。
 *
 * @responsibility 配布・認証・CLIの宣言と未成立条件を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定実行定義。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: describeCodexExecutionPlanContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 固定宣言を返す。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security describeCodexExecutionPlanContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCodexExecutionPlanContractは共有非同期状態を持たない同期処理である。
 */
export function describeCodexExecutionPlanContract() {
  return Object.freeze({
    contract: CODEX_EXECUTION_PLAN_CONTRACT,
    contractRevision: CODEX_EXECUTION_PLAN_CONTRACT_REVISION,
    provider: "codex",
    authentication: "existing_chatgpt_subscription_oauth_only",
    apiKeyAllowed: false,
    paidApiFallbackAllowed: false,
    readOnlyProbeExactModel: "gpt-5.6-sol",
    isolatedTaskExactModel: COMPATIBLE_TASK_MODEL,
    preferredModelFamily: "sol",
    efforts: Object.freeze(["low", "medium", "high"]),
    speedMode: "normal_only",
    outboundProxyPolicy: "official_cli_respect_system_proxy_required",
    isolatedTask: Object.freeze({
      roles: Object.freeze(["executor", "reviewer"]),
      structuredEventTransport: "fixed_cli_jsonl_v0_149_1",
      permissionProfile: "root_deny_minimal_read_workspace_role_access",
      providerHomeCommandReadAllowed: false,
      commandNetworkAccessAllowed: false,
      webSearchAllowed: false,
      taskPromptTransport: "stdin_only",
      promptInArgvAllowed: false,
    }),
    directProviderSpawnAllowed: false,
    providerEffectAllowed: false,
  });
}

/**
 * Codex向け助言コマンドを生成する。
 *
 * @responsibility 固定Codex配布物へToolなし・標準入力・JSONL出力の一回助言を割り当てる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Codex Profile Identity。
 * @returns Codex助言コマンド計画。
 * @precondition input.providerはcodexである。
 * @postcondition argv末尾は標準入力を示す`-`で、Prompt本文を含まない。
 * @effect N/A: コマンド計画を生成するだけである。
 * @failure N/A: Catalog検証済み入力だけを受け取る。
 * @invariant 配置は信頼した構成側の値だけを使い、Catalogや外部要求から受け付けない。
 * @boundary Workbench助言とCodex CLIの間。
 * @security Filesystem Tool、Web、MCP、Plugin、MemoryおよびSubagentを無効化する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function planCodexAdviceCommand(
  input: ProviderModelSelection,
  locations: ProviderExecutionLocations = {},
): Omit<ProviderAdvicePlan, "contract" | "contractRevision"> {
  return Object.freeze({
    provider: "codex" as const,
    command: locations.commandPath ?? "codex",
    argv: Object.freeze([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--strict-config",
      "--model",
      input.exactModelId,
      "--config",
      `model_reasoning_effort="${input.reasoningEffort}"`,
      "--config",
      "suppress_unstable_features_warning=true",
      "--config",
      "features.respect_system_proxy=true",
      "--config",
      "features.code_mode=true",
      "--config",
      "features.code_mode_host={enabled=true,disable_in_process_fallback=true}",
      "--config",
      "features.code_mode_interrupt=true",
      "--config",
      "features.code_mode_only=true",
      "--config",
      "features.shell_tool=false",
      "--config",
      "features.unified_exec=false",
      "--config",
      'approval_policy="never"',
      "--config",
      'web_search="disabled"',
      "--config",
      "features.plugins=false",
      "--config",
      "features.memories=false",
      "--config",
      "features.multi_agent=false",
      "--config",
      "features.multi_agent_v2=false",
      "--config",
      "memories.generate_memories=false",
      "--config",
      "memories.use_memories=false",
      "--config",
      "project_doc_max_bytes=0",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--json",
      "--color",
      "never",
      "-",
    ]),
    environment: Object.freeze({
      ...(locations.providerHomeDirectory
        ? { CODEX_HOME: locations.providerHomeDirectory }
        : {}),
      CODEX_DISABLE_AUTO_UPDATE: "1",
    }),
    exactModelId: input.exactModelId,
    reasoningEffort: input.reasoningEffort,
    promptTransport: "stdin_only" as const,
    resultTransport: "codex_cli_jsonl" as const,
    toolsAllowed: false as const,
    sessionPersistenceAllowed: false as const,
  });
}
