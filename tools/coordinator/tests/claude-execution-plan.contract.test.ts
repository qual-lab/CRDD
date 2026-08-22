import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAUDE_EXECUTION_PLAN_CONTRACT,
  CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  describeClaudeExecutionPlanContract,
  planClaudeReadOnlyProbe,
} from "../src/security/claude-execution-plan.ts";

test("Claude配布候補は公式Linux binaryのexact Identityへ固定する", () => {
  const contract = describeClaudeExecutionPlanContract();
  assert.equal(contract.contract, CLAUDE_EXECUTION_PLAN_CONTRACT);
  assert.equal(
    contract.contractRevision,
    CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  );
  assert.equal(contract.distribution.exactVersion, "2.1.220");
  assert.equal(contract.targetPlatform, "linux-x64");
  assert.equal(
    contract.distribution.binarySha256,
    "674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863",
  );
  assert.equal(contract.distribution.binaryBytes, 275_012_592);
  assert.equal(contract.distribution.manifestSignatureRequired, true);
  assert.equal(contract.distribution.manifestSignatureVerified, false);
  assert.equal(contract.distribution.fixedDigestImageConfigured, false);
  assert.equal(contract.distribution.termsReview, "human_activation_required");
  assert.equal(contract.providerSpawn, "blocked_before_spawn");
});

test("Claude認証は既存subscription OAuthだけを候補にする", () => {
  const authentication = describeClaudeExecutionPlanContract().authentication;
  assert.equal(authentication.loginPolicy, "existing_subscription_oauth");
  assert.deepEqual(authentication.supportedSubscriptions, [
    "claude_pro",
    "claude_max",
    "claude_team",
    "claude_enterprise",
  ]);
  assert.equal(authentication.consoleApiAccountAllowed, false);
  assert.equal(authentication.thirdPartyApiProviderAllowed, false);
  assert.equal(authentication.apiKeyAllowed, false);
  assert.equal(authentication.hostCredentialImportAllowed, false);
  assert.equal(authentication.rawAuthOutputRecorded, false);
  assert.equal(authentication.oauthTokenReadByRuntime, false);
});

test("読取専用probe候補はtool、MCP、resume、永続sessionを無効化する", () => {
  const plan = planClaudeReadOnlyProbe({
    provider: "claude",
    mode: "read_only_probe",
  });
  assert.equal(plan.status, "candidate");
  assert.equal(
    plan.reason,
    "claude_fixed_image_home_egress_auth_and_terms_activation_not_completed",
  );
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
  assert.deepEqual(plan.environment, {
    DISABLE_AUTOUPDATER: "1",
    DISABLE_UPDATES: "1",
    CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1",
  });
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
  assert.equal(plan.builtInToolsAllowed, false);
  assert.equal(plan.mcpToolsAllowed, false);
  assert.equal(plan.projectInstructionsLoaded, false);
  assert.equal(plan.customizationsLoaded, false);
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

test("説明契約とprobe計画は同じ固定非発行境界を投影する", () => {
  const contract = describeClaudeExecutionPlanContract();
  const probe = contract.readOnlyProbe;
  assert.equal(contract.implementationState, "fixed_non_executable_candidate");
  assert.equal(probe.workspaceMountRequired, false);
  assert.equal(probe.providerHomeMountRequired, true);
  assert.equal(probe.providerRequestExpected, true);
  assert.equal(probe.includedSubscriptionUsageMayBeConsumed, true);
  assert.equal(probe.additionalCreditPurchaseAllowed, false);
  assert.equal(probe.sessionResumeAllowed, false);
  assert.equal(probe.sessionPersistenceAllowed, false);
  assert.equal(probe.builtInToolsAllowed, false);
  assert.equal(probe.mcpToolsAllowed, false);
  assert.equal(probe.projectInstructionsLoaded, false);
  assert.equal(probe.customizationsLoaded, false);
  assert.equal(probe.resultFormat, "single_json_result");
  assert.equal(probe.maximumTurns, 1);
  assert.equal(contract.operationCapabilityIssued, false);
});
