/**
 * ClaudeのTask・Probe・読取り助言の固定CLI計画とTurn予算を所有する。
 *
 * @responsibility Model・effortの引数順、Turn予算、固有CLI制約と配布要件を純粋に生成し、実起動・認可・回収を所有しない。
 * @trace ARCH-000010
 */

import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import { describeProviderBillingPolicy } from "../billing/policy.ts";
import type {
  ProviderModelSelection,
  ProviderAdvicePlan,
} from "../provider/plan.ts";
import type { ProviderExecutionLocations } from "../provider/types.ts";

export const CLAUDE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/claude-execution-plan";
export const CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION = 18;

/**
 * 検証済みModelと推論強度をClaude固有のCLI引数へ結合する。
 *
 * @responsibility ClaudeのModel・effortオプションと固定計画argvの順序を所有する。
 * @trace ARCH-000010
 * @input modelとeffort: 呼出し側で照合済みの選定値。argv: 固定Claude計画の引数。
 * @returns Model・effortを先頭に結合した不変のargv。
 * @precondition 呼出し側がModel構文・選定Identityと固定計画の受理を確認している。
 * @postcondition 元のargvを変更せず、既存CLI引数順序を保持する。
 * @effect N/A: 値の組立てだけでProcessや外部送信を開始しない。
 * @failure N/A: 受理・拒否判断は選定と固定計画のOwnerが行う。
 * @invariant 任意Path、環境継承、追加Model fallbackを導入しない。
 * @boundary AI AdapterのClaude記述とCoordinatorの実行組立ての間。
 * @security Authority、Prompt本文または認証情報を引数へ追加しない。
 * @concurrency N/A: 同期の純粋計算で共有状態を変更しない。
 */
export function buildClaudeExecutionArguments(
  model: string,
  effort: string,
  argv: readonly string[],
) {
  return Object.freeze(["--model", model, "--effort", effort, ...argv]);
}

export const CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "HTTP_PROXY",
  "NO_PROXY",
]);

export const CLAUDE_TASK_MAXIMUM_TURNS = 16;
const TASK_WORKLOAD_KEYS = new Set([
  "readPathCount",
  "allowedPathCount",
  "acceptanceCriterionCount",
  "remediationFindingCount",
]);

/**
 * Claude TaskのTurn予算を評価する。
 *
 * @responsibility 役割と作業量に基づくCLI要求上限と計画上限を所有する。
 * @trace ARCH-000010
 * @input taskRole: unknown、taskWorkload: unknown
 * @returns 候補予算又はblocked。
 * @precondition taskRoleとworkloadは関数内で検査し、計画を起動許可としない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: planClaudeTaskTurnBudgetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不正な役割・作業量と上限超過を拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security planClaudeTaskTurnBudgetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planClaudeTaskTurnBudgetは共有非同期状態を持たない同期処理である。
 */
export function planClaudeTaskTurnBudget(
  taskRole: unknown,
  taskWorkload: unknown,
) {
  const workload = snapshotPlainRecord(taskWorkload, TASK_WORKLOAD_KEYS);
  if (!workload || (taskRole !== "executor" && taskRole !== "reviewer"))
    return blocked("claude_task_workload_invalid");
  for (const [key, minimum, maximum] of [
    ["readPathCount", 1, 64],
    ["allowedPathCount", 1, 64],
    ["acceptanceCriterionCount", 1, 16],
    ["remediationFindingCount", 0, 64],
  ] as const) {
    const value = workload[key];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < minimum ||
      value > maximum
    )
      return blocked("claude_task_workload_invalid");
  }
  const estimatedTurns =
    2 +
    (workload.readPathCount as number) +
    (taskRole === "executor" ? 2 : 1) * (workload.allowedPathCount as number) +
    Math.ceil((workload.acceptanceCriterionCount as number) / 4) +
    Math.ceil((workload.remediationFindingCount as number) / 4);
  if (estimatedTurns > CLAUDE_TASK_MAXIMUM_TURNS)
    return blocked("claude_task_workload_split_required");
  return Object.freeze({
    status: "candidate" as const,
    maximumTurns: Math.max(taskRole === "executor" ? 8 : 4, estimatedTurns),
    hardMaximumTurns: CLAUDE_TASK_MAXIMUM_TURNS,
    basis:
      "validated_task_scope_counts_not_file_count_or_completion_prediction" as const,
    hardMaximumTurnsBasis:
      "validated_task_scope_planning_cap_not_result_acceptance" as const,
    taskWorkload: Object.freeze(workload),
  });
}

const PLAN_KEYS = new Set(["provider", "mode"]);
const TASK_PLAN_KEYS = new Set([
  "provider",
  "mode",
  "taskRole",
  "effort",
  "taskWorkload",
]);
const billingPolicy = describeProviderBillingPolicy();
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
const TASK_SETTINGS_PATH = "claude-task-settings.json";
const EXECUTOR_SCHEMA_ARGUMENT =
  '{"type":"object","properties":{"status":{"type":"string","const":"completed"},"summary":{"type":"string","minLength":1,"maxLength":8192},"changedPaths":{"type":"array","maxItems":1000,"uniqueItems":true,"items":{"type":"string","minLength":1,"maxLength":1024}},"verification":{"type":"array","maxItems":32,"items":{"type":"string","minLength":1,"maxLength":1024}}},"required":["status","summary","changedPaths","verification"],"additionalProperties":false}';
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
const ACTIVATION_GATES = Object.freeze([
  "runtime_owned_model_selection_grant",
  "runtime_owned_minimal_environment_replacement",
  "interactive_external_send_grant",
  "subscription_oauth_preflight_before_provider_request",
]);
const ACTIVATION_BLOCKERS = Object.freeze([] as string[]);

/**
 * Claude計画の拒否値を生成する。
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
    status: "blocked",
    reason,
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
  });
}

/**
 * Claude読取りProbeを計画する。
 *
 * @responsibility Provider・用途の検査と固定CLI・設定条件を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns candidate計画又はblocked。
 * @precondition candidateを未信頼値として関数内で閉じたshapeと値を検査する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: 検証用の起動計画を構築するだけで、Process・Filesystem・外部送信を開始しない。
 * @failure 不正shape、Provider、用途を拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security planClaudeReadOnlyProbeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planClaudeReadOnlyProbeは共有非同期状態を持たない同期処理である。
 */
export function planClaudeReadOnlyProbe(
  candidate: unknown,
  locations: ProviderExecutionLocations = {},
) {
  const value = snapshotPlainRecord(candidate, PLAN_KEYS);
  if (!value) return blocked("claude_execution_plan_shape_invalid");
  if (value.provider !== "claude")
    return blocked("claude_execution_plan_provider_mismatch");
  if (value.mode !== "read_only_probe")
    return blocked("claude_execution_plan_mode_not_supported");

  return Object.freeze({
    status: "candidate",
    reason: "claude_task_execution_gates_required",
    activationGates: ACTIVATION_GATES,
    activationBlockers: ACTIVATION_BLOCKERS,
    spawnAllowed: false,
    loginEffectAllowed: false,
    networkEffectAllowed: false,
    filesystemEffectAllowed: false,
    operationCapabilityIssued: false,
    provider: "claude",
    mode: "read_only_probe",

    command: locations.commandPath ?? "claude",
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
    parentEnvironmentInherited: false,
    environment: FIXED_ENVIRONMENT,
    managedSettings: FIXED_MANAGED_SETTINGS,
    managedSettingsPath:
      locations.managedSettingsPath ?? "managed-settings.json",
    bareModeAllowed: false,
    safeModeRequired: true,
    runtimeOwnedEnvironmentSlots: RUNTIME_OWNED_ENVIRONMENT_SLOTS,
    forbiddenParentEnvironmentCategories:
      FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES,
    shellAllowed: false,
    pathLookupAllowed: false,
    providerRequestExpected: true,
    includedSubscriptionUsageMayBeConsumed: true,
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    automaticPlanSwitchAllowed: false,
    billingPolicy: billingPolicy,
    sessionResumeAllowed: false,
    sessionPersistenceAllowed: false,
    builtInToolsRequested: "none",
    mcpToolsRequested: "none",
    projectInstructionsRequested: "not_loaded",
    autoDiscoveredCustomizationsRequested: "not_loaded",
  });
}

/**
 * Claude Taskを役割別に計画する。
 *
 * @responsibility 役割・Turn予算と固定CLI・環境条件を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns candidate計画又はblocked。
 * @precondition candidateを未信頼値として関数内で閉じたshape・役割・予算を検査する。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: Taskの起動計画を構築するだけで、Process・Filesystem・外部送信を開始しない。
 * @failure 不正shape、役割、予算を拒否する。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security planClaudeIsolatedTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planClaudeIsolatedTaskは共有非同期状態を持たない同期処理である。
 */
export function planClaudeIsolatedTask(
  candidate: unknown,
  locations: ProviderExecutionLocations = {},
) {
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
  const turnBudget = planClaudeTaskTurnBudget(taskRole, value.taskWorkload);
  if (turnBudget.status !== "candidate") return turnBudget;
  const maximumTurns = turnBudget.maximumTurns;
  const toolArguments =
    taskRole === "executor"
      ? ["--tools", "Read,Glob,Grep,Edit,Write"]
      : ["--tools="];
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
    command: locations.commandPath ?? "claude",
    speedMode: "normal_only" as const,
    argv: Object.freeze([
      "--safe-mode",
      "--setting-sources=",
      "--settings",
      locations.taskSettingsPath ?? TASK_SETTINGS_PATH,
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--no-chrome",
      ...(taskRole === "executor"
        ? ["--json-schema", EXECUTOR_SCHEMA_ARGUMENT]
        : []),
      "-p",
      "--output-format",
      "json",
      "--max-turns",
      maximumTurns.toString(),
      "--no-session-persistence",
      "--permission-mode",
      taskRole === "executor" ? "acceptEdits" : "dontAsk",
      ...toolArguments,
      "--disallowedTools",
      "Bash,WebFetch,WebSearch,Task,NotebookEdit,mcp__*",
      "--disable-slash-commands",
      "--prompt-suggestions",
      "false",
    ]),
    environment: FIXED_ENVIRONMENT,
    environmentMode: "replace_required" as const,
    parentEnvironmentInherited: false,
    reviewerFilesystemOrShellToolAllowed: false,
    reviewerInput: "runtime_owned_immutable_candidate_content_projection_only",
    taskPromptTransport: "stdin_only" as const,
    resultTransport:
      taskRole === "executor"
        ? ("claude_structured_output" as const)
        : ("claude_json_envelope_result_validated_by_crdd" as const),
    taskPromptInArgvAllowed: false,
    shellAllowed: false,
    commandNetworkAccessAllowed: false,
    webToolsAllowed: false,
    mcpAllowed: false,
    subagentAllowed: false,
    providerHomeBuiltInToolAccessAllowed: false,
    maximumTurns,
    maximumTurnsBasis: turnBudget.basis,
    hardMaximumTurns: turnBudget.hardMaximumTurns,
    hardMaximumTurnsBasis: turnBudget.hardMaximumTurnsBasis,
    taskWorkload: turnBudget.taskWorkload,
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

/**
 * Claude実行の固定条件を記述する。
 *
 * @responsibility Providerの認証方法・CLI制約・入出力条件だけを記述する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns 固定実行定義。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 返却値を現在の認証、実行成功又は資源回収の証明としない。
 * @effect N/A: describeClaudeExecutionPlanContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 固定宣言を返す。
 * @invariant 計画・解析・宣言の範囲に限り、起動・送信同意・Authorityを代行しない。
 * @boundary Provider固有条件と共通AI Adapter APIの内部境界。
 * @security describeClaudeExecutionPlanContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeClaudeExecutionPlanContractは共有非同期状態を持たない同期処理である。
 */
export function describeClaudeExecutionPlanContract() {
  return Object.freeze({
    contract: CLAUDE_EXECUTION_PLAN_CONTRACT,
    contractRevision: CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
    provider: "claude",
    authentication: Object.freeze({
      loginPolicy: "existing_subscription_oauth",
      explicitLoginCommand: Object.freeze([
        "claude",
        "auth",
        "login",
        "--claudeai",
      ]),
      consoleLoginAllowed: false,
      consoleApiAccountAllowed: false,
      thirdPartyApiProviderAllowed: false,
      apiKeyAllowed: false,
      hostCredentialImportAllowed: false,
      rawAuthOutputRecorded: false,
      oauthTokenReadByRuntime: false,
    }),
    billingPolicy,
    readOnlyProbe: Object.freeze({
      command: "claude",
      argv: FIXED_ARGV,
      structuredOutputSchema: FIXED_STRUCTURED_OUTPUT_SCHEMA,
      environment: FIXED_ENVIRONMENT,
      managedSettings: FIXED_MANAGED_SETTINGS,
      environmentMode: "replace_required",
      parentEnvironmentInherited: false,
      safeModeRequired: true,
      bareModeAllowed: false,
      runtimeOwnedEnvironmentSlots: RUNTIME_OWNED_ENVIRONMENT_SLOTS,
      forbiddenParentEnvironmentCategories:
        FORBIDDEN_PARENT_ENVIRONMENT_CATEGORIES,
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
      requestedMaximumTurnsRange: Object.freeze({ minimum: 4, maximum: 16 }),
      requestedMaximumTurnsBasis:
        "validated_task_scope_counts_with_role_specific_floor",
      reportedTurnsDisposition:
        "positive_safe_integer_metadata_not_execution_round_limit",
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
    providerSpawn: "runtime_adapter_authority_and_preflight_gated",
    operationCapabilityIssued: false,
  });
}

/**
 * Claude向け助言コマンドを生成する。
 *
 * @responsibility Claude CLIへToolなし・標準入力・Schema付きJSON出力の一回助言を割り当てる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: 検証済みProvider Model選定。resultSchema: 検査済みの固定助言結果Schema。
 * @returns Claude助言コマンド計画。
 * @precondition input.providerはclaudeである。
 * @postcondition Prompt本文はargvへ含めず、標準入力からだけ受け取る。
 * @effect N/A: コマンド計画を生成するだけである。
 * @failure N/A: 共通計画入口で技術対応とSchemaを検証済みの入力だけを受け取る。
 * @invariant 配置は信頼した構成側の値だけを使い、Catalogや外部要求から受け付けない。
 * @boundary Workbench助言とClaude CLIの間。
 * @security Built-in Tool、MCP、Chrome、Slash CommandおよびSession保存を無効化する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function planClaudeAdviceCommand(
  input: ProviderModelSelection,
  resultSchema: Readonly<Record<string, unknown>>,
  locations: ProviderExecutionLocations = {},
): Omit<
  ProviderAdvicePlan,
  "contract" | "contractRevision" | "catalogIdentity"
> {
  const contract = describeClaudeExecutionPlanContract();
  return Object.freeze({
    provider: "claude" as const,
    command: locations.commandPath ?? "claude",
    argv: Object.freeze([
      "--model",
      input.modelIdentifier,
      "--effort",
      input.reasoningEffort,
      "--safe-mode",
      "--setting-sources=",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--no-chrome",
      "--json-schema",
      JSON.stringify(resultSchema),
      "-p",
      "--output-format",
      "json",
      "--max-turns",
      "2",
      "--no-session-persistence",
      "--permission-mode",
      "dontAsk",
      "--tools=",
      "--disallowedTools",
      "Bash,WebFetch,WebSearch,Task,NotebookEdit,mcp__*",
      "--disable-slash-commands",
      "--prompt-suggestions",
      "false",
    ]),
    environment: contract.readOnlyProbe.environment,
    modelIdentifier: input.modelIdentifier,
    identifierKind: input.identifierKind,
    reasoningEffort: input.reasoningEffort,
    promptTransport: "stdin_only" as const,
    resultTransport: "claude_json_envelope" as const,
    toolsAllowed: false as const,
    sessionPersistenceAllowed: false as const,
  });
}
