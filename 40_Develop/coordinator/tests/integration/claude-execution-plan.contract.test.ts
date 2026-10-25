/**
 * coordinator:integration:claude-execution-planの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:claude-execution-planが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope claude、execution、plan
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CLAUDE_EXECUTION_PLAN_CONTRACT,
  CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  describeProviderExecution,
  describeProviderAuthentication,
} from "../../../ai-adapter/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderAssets } from "../../../docker-isolation/src/index.ts";

import buildInputs from "../../../docker-isolation/images/build-inputs.json" with {
  type: "json",
};

/**
 * Claude配布候補は固定絶対pathと同じexact artifact Identityへ結合するを検証する。
 *
 * @responsibility Claude配布候補は固定絶対pathと同じexact artifact Identityへ結合するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude配布候補は固定絶対pathと同じexact artifact Identityへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude配布候補は固定絶対pathと同じexact artifact Identityへ結合する", () => {
  const neutral = planProviderExecution({
    provider: "claude",
    purpose: "probe",
    input: { provider: "claude", mode: "read_only_probe" },
  });
  assert.equal(neutral.status, "ready");
  if (neutral.status !== "ready") assert.fail("neutral_plan_rejected");
  assert.equal(neutral.plan.command, "claude");
  assert.equal("distributionBinding" in neutral.plan, false);
  const locations = describeDockerProviderExecutionLocations("claude", "probe");
  const fixed = planProviderExecution(
    {
      provider: "claude",
      purpose: "probe",
      input: { provider: "claude", mode: "read_only_probe" },
    },
    locations,
  );
  assert.equal(fixed.status, "ready");
  if (fixed.status !== "ready") assert.fail("bound_plan_rejected");
  assert.equal(
    fixed.plan.command,
    describeDockerProviderAssets("claude").identity.executablePath,
  );
  assert.deepEqual(fixed.plan.argv, neutral.plan.argv);
  assert.equal(fixed.plan.spawnAllowed, false);
  const contract = describeProviderExecution("claude");
  assert.equal(contract.contract, CLAUDE_EXECUTION_PLAN_CONTRACT);
  assert.equal(
    contract.contractRevision,
    CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  );
});

/**
 * ClaudeのCLI契約に過去の配布・認証観測を含めないを検証する。
 *
 * @responsibility ClaudeのCLI契約に過去の配布・認証観測を含めないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus ClaudeのCLI契約に過去の配布・認証観測を含めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("ClaudeのCLI契約に過去の配布・認証観測を含めない", () => {
  const contract = describeProviderExecution("claude");
  for (const key of [
    "distribution",
    "fixedPromptRequestAttempt",
    "fixedPromptSchemaRequestAttempt",
    "fixedPromptBoundedRequestAttempt",
    "fixedPromptBooleanRequestVerification",
  ])
    assert.equal(key in contract, false, key);
  for (const key of [
    "verification",
    "accountAuthorityBinding",
    "selectedAccountOfferingObserved",
    "authenticatedServiceTerms",
  ])
    assert.equal(key in contract.authentication, false, key);
  assert.equal(
    contract.authentication.loginPolicy,
    "existing_subscription_oauth",
  );
});

/**
 * Claude認証はsubscription OAuth候補だけを残しAPI課金経路を拒否するを検証する。
 *
 * @responsibility Claude認証はsubscription OAuth候補だけを残しAPI課金経路を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude認証はsubscription OAuth候補だけを残しAPI課金経路を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude認証はsubscription OAuth候補だけを残しAPI課金経路を拒否する", () => {
  const definition = describeProviderAuthentication("claude");
  assert.deepEqual(definition.loginArgv, ["auth", "login", "--claudeai"]);
  assert.deepEqual(definition.statusArgv, ["auth", "status", "--json"]);
  assert.equal(definition.offering, "claude_max");
  assert.equal(definition.authorityOrigin, "https://claude.ai");
  assert.ok(Object.isFrozen(definition));
  assert.ok(Object.isFrozen(definition.loginArgv));
  assert.ok(Object.isFrozen(definition.statusArgv));
  const contract = describeProviderExecution("claude");
  const authentication = contract.authentication;
  assert.equal(authentication.loginPolicy, "existing_subscription_oauth");
  assert.deepEqual(authentication.explicitLoginCommand, [
    "claude",
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

/**
 * 読取専用probe候補はCLI引数と環境置換要求だけを投影するを検証する。
 *
 * @responsibility 読取専用probe候補はCLI引数と環境置換要求だけを投影するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 読取専用probe候補はCLI引数と環境置換要求だけを投影するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("読取専用probe候補はCLI引数と環境置換要求だけを投影する", () => {
  const contract = describeProviderExecution("claude");
  const plan =
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: {
          provider: "claude",
          mode: "read_only_probe",
        },
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  assert.equal(plan.status, "candidate");
  assert.equal(plan.reason, "claude_task_execution_gates_required");

  assert.equal(plan.command, "/opt/crdd/providers/claude/2.1.310/claude");
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

  assert.equal(plan.environmentMode, "replace_required");
  assert.equal(plan.environmentReplacementImplemented, true);

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

  assert.equal(plan.providerRequestExpected, true);
  assert.equal(plan.includedSubscriptionUsageMayBeConsumed, true);
  assert.equal(plan.apiKeyAllowed, false);
  assert.equal(plan.additionalCreditPurchaseAllowed, false);
  assert.equal(plan.automaticPlanSwitchAllowed, false);
  assert.deepEqual(plan.billingPolicy, contract.billingPolicy);
  assert.equal(plan.sessionResumeAllowed, false);
  assert.equal(plan.sessionPersistenceAllowed, false);
  assert.equal(plan.builtInToolsRequested, "none");

  assert.equal(plan.mcpToolsRequested, "none");

  assert.equal(plan.projectInstructionsRequested, "not_loaded");

  assert.equal(plan.autoDiscoveredCustomizationsRequested, "not_loaded");

  assert.equal("settingsSourcesVerification" in plan, false);
  assert.equal("providerHomeSettingsIsolation" in plan, false);
  assert.equal("customizationsLoaded" in plan, false);
  assert.equal(plan.operationCapabilityIssued, false);
});

/**
 * Managed Settingsの固定byte列を検証済みimage identityへ結合するを検証する。
 *
 * @responsibility Managed Settingsの固定byte列を検証済みimage identityへ結合するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Managed Settingsの固定byte列を検証済みimage identityへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Managed Settingsの固定byte列を検証済みimage identityへ結合する", () => {
  const settings = readFileSync(
    new URL(
      "../../../ai-adapter/src/claude/claude-managed-settings.json",
      import.meta.url,
    ),
  );
  assert.equal(
    createHash("sha256").update(settings).digest("hex"),
    buildInputs.claude.managedSettingsSha256,
  );
  assert.deepEqual(JSON.parse(settings.toString("utf8")), {
    autoUpdates: false,
    feedbackSurveyRate: 0,
    forceLoginMethod: "claudeai",
    skipWebFetchPreflight: true,
  });
});

/**
 * 一般TaskはRole別built-in tools、stdin、Provider Home denyへ固定するを検証する。
 *
 * @responsibility 一般TaskはRole別built-in tools、stdin、Provider Home denyへ固定するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 一般TaskはRole別built-in tools、stdin、Provider Home denyへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("一般TaskはRole別built-in tools、stdin、Provider Home denyへ固定する", () => {
  const executor =
    planProviderExecution(
      {
        provider: "claude",
        purpose: "task",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          identifierKind: "alias",
          reasoningEffort: "low",
        },
        input: {
          provider: "claude",
          mode: "isolated_task",
          taskRole: "executor",
          effort: "low",
          taskWorkload: {
            readPathCount: 1,
            allowedPathCount: 1,
            acceptanceCriterionCount: 1,
            remediationFindingCount: 0,
          },
        },
      },
      describeDockerProviderExecutionLocations("claude", "task"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  const reviewer =
    planProviderExecution(
      {
        provider: "claude",
        purpose: "task",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          identifierKind: "alias",
          reasoningEffort: "high",
        },
        input: {
          provider: "claude",
          mode: "isolated_task",
          taskRole: "reviewer",
          effort: "high",
          taskWorkload: {
            readPathCount: 1,
            allowedPathCount: 1,
            acceptanceCriterionCount: 1,
            remediationFindingCount: 0,
          },
        },
      },
      describeDockerProviderExecutionLocations("claude", "task"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  assert.equal(executor.status, "candidate");

  assert.equal(executor.resultTransport, "claude_structured_output");
  assert.equal(executor.argv.includes("--json-schema"), true);
  assert.equal(executor.maximumTurns, 8);
  assert.equal(
    executor.maximumTurnsBasis,
    "validated_task_scope_counts_not_file_count_or_completion_prediction",
  );
  assert.equal(executor.maximumBudgetUsd, null);
  assert.equal(executor.hardMaximumTurns, 16);
  assert.equal(
    executor.hardMaximumTurnsBasis,
    "validated_task_scope_planning_cap_not_result_acceptance",
  );
  assert.equal(
    executor.argv[executor.argv.indexOf("--permission-mode") + 1],
    "acceptEdits",
  );
  assert.equal(
    executor.argv[executor.argv.indexOf("--tools") + 1],
    "Read,Glob,Grep,Edit,Write",
  );
  assert.equal(reviewer.status, "candidate");

  assert.equal(
    reviewer.resultTransport,
    "claude_json_envelope_result_validated_by_crdd",
  );
  assert.equal(reviewer.argv.includes("--json-schema"), false);
  assert.equal(reviewer.maximumTurns, 5);
  assert.equal(
    reviewer.maximumTurnsBasis,
    "validated_task_scope_counts_not_file_count_or_completion_prediction",
  );
  assert.equal(reviewer.maximumBudgetUsd, null);
  assert.equal(reviewer.hardMaximumTurns, 16);
  assert.equal(
    reviewer.argv[reviewer.argv.indexOf("--permission-mode") + 1],
    "dontAsk",
  );
  assert.equal(reviewer.argv.includes("--tools="), true);
  assert.equal(reviewer.argv.includes("--tools"), false);
  assert.equal(reviewer.argv.includes("Read,Glob,Grep"), false);
  assert.equal(reviewer.reviewerFilesystemOrShellToolAllowed, false);
  assert.equal(
    reviewer.reviewerInput,
    "runtime_owned_immutable_candidate_content_projection_only",
  );
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
    assert.equal(plan.argv.includes("--max-budget-usd"), false);
    assert.equal(
      plan.apiEquivalentUsdBudgetDisposition,
      "not_applied_to_subscription_only_execution",
    );
    assert.deepEqual(plan.usageControls, [
      "coordinator_model_and_effort_selection",
      "maximum_turns",
      "provider_timeout",
      "output_limit",
    ]);
    assert.equal(plan.explicitSpendBudgetProfileImplemented, false);
  }
});

/**
 * Claude Task SettingsはProvider Homeと外部Toolをdenyするを検証する。
 *
 * @responsibility Claude Task SettingsはProvider Homeと外部Toolをdenyするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Task SettingsはProvider Homeと外部Toolをdenyするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude Task SettingsはProvider Homeと外部Toolをdenyする", () => {
  const settings = JSON.parse(
    readFileSync(
      new URL(
        "../../../ai-adapter/src/claude/claude-task-settings.json",
        import.meta.url,
      ),
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
/**
 * probeの任意Provider、mode、余分field、accessor、Proxyを拒否するを検証する。
 *
 * @responsibility probeの任意Provider、mode、余分field、accessor、Proxyを拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus probeの任意Provider、mode、余分field、accessor、Proxyを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("probeの任意Provider、mode、余分field、accessor、Proxyを拒否する", () => {
  assert.equal(
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: { provider: "codex", mode: "read_only_probe" },
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).error?.reason,
    "claude_execution_plan_provider_mismatch",
  );
  assert.equal(
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: { provider: "claude", mode: "run" },
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).error?.reason,
    "claude_execution_plan_mode_not_supported",
  );
  assert.equal(
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: {
          provider: "claude",
          mode: "read_only_probe",
          billingProfile: "paid_api",
        },
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).error?.reason,
    "claude_execution_plan_shape_invalid",
  );
  assert.equal(
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: {
          provider: "claude",
          mode: "read_only_probe",
          prompt: "forged",
        },
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).error?.reason,
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
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: accessor,
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).error?.reason,
    "claude_execution_plan_shape_invalid",
  );
  assert.equal(
    planProviderExecution(
      {
        provider: "claude",
        purpose: "probe",
        input: new Proxy(
          {},
          {
            ownKeys() {
              throw new Error("must_not_escape");
            },
          },
        ),
      },
      describeDockerProviderExecutionLocations("claude", "probe"),
    ).error?.reason,
    "claude_execution_plan_shape_invalid",
  );
});

/**
 * ClaudeのCLI制約とPlan単体のEffect非発行を説明するを検証する。
 *
 * @responsibility ClaudeのCLI制約とPlan単体のEffect非発行を説明するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus ClaudeのCLI制約とPlan単体のEffect非発行を説明するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("ClaudeのCLI制約とPlan単体のEffect非発行を説明する", () => {
  const contract = describeProviderExecution("claude");
  assert.equal(contract.operationCapabilityIssued, false);
  assert.equal(contract.readOnlyProbe.maximumTurns, 2);
  assert.equal(contract.readOnlyProbe.maximumBudgetUsd, 0.1);
  assert.deepEqual(contract.isolatedTask.requestedMaximumTurnsRange, {
    minimum: 4,
    maximum: 16,
  });
  assert.equal(
    contract.isolatedTask.reportedTurnsDisposition,
    "positive_safe_integer_metadata_not_execution_round_limit",
  );
  assert.equal(contract.isolatedTask.taskPromptTransport, "stdin_only");
  assert.equal("activationGates" in contract, false);
});
