/**
 * coordinator:integration:coordinator-claude-delegationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:coordinator-claude-delegationが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope coordinator、claude、delegation
 * @boundary PRL-IT-005=Related 2 Blocks: Task選定→Provider準備・実行→回収
 */
import { createAttemptPreparation } from "../fixtures/attempt-preparation.ts";
import assert from "node:assert/strict";
import { executionSelection } from "../fixtures/ai-selection.ts";
import test from "node:test";

import { createExecutorTestCandidate } from "../../../executor/scripts/executor-test.ts";

/**
 * Codex frontから選定理由付きClaude委譲をcleanup済みResultまで接続するを検証する。
 *
 * @responsibility Codex frontから選定理由付きClaude委譲をcleanup済みResultまで接続するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex frontから選定理由付きClaude委譲をcleanup済みResultまで接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex frontから選定理由付きClaude委譲をcleanup済みResultまで接続する", async () => {
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  let randomValue = 0;
  let recoveryCompletionCount = 0;
  let technicalPlan:
    | import("../../../executor/scripts/executor-test.ts").TestAttemptPlan
    | null = null;
  const selected = executionSelection("executor", {
    provider: "claude",
    model: "opus",
    effort: "low",
  });
  const adapter = createAttemptPreparation(
    "claude",
    {
      verifyOperationMount: (management: unknown, mount: unknown) => {
        assert.equal(management, managementCapability);
        assert.equal(mount, mountCapability);
        return Object.freeze({
          operationId: "OP-123456",
          createdAt: "2026-08-24T00:00:00.000Z",
          mounts: Object.freeze({
            workspace: "C:\\crdd\\operation\\workspace",
            providerHome: "C:\\crdd\\operation\\provider-home",
            tmp: "C:\\crdd\\operation\\tmp",
            events: "C:\\crdd\\operation\\events",
            projection: "C:\\crdd\\operation\\projection",
            management: "C:\\crdd\\operation\\management",
          }),
        });
      },
      randomBytes: (size: number) => {
        randomValue += 1;
        return Buffer.alloc(size, randomValue);
      },
    },
    (_upper, lower) => {
      technicalPlan = lower;
    },
  );
  const prepared = adapter.prepare({
    purpose: "probe",
    managementCapability: managementCapability,
    mountCapability: mountCapability,
    providerHome: {
      provider: "claude",
      providerHomeSourcePath:
        "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude",
      providerHomeIdentityHash: "c".repeat(64),
      stableLogicalHomeBindingHash: "1".repeat(64),
    },
    executionSelection: selected,
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "opus");
  assert.equal(prepared.selectedEffort, "low");

  const purposes: string[] = [];
  const controller = createExecutorTestCandidate({
    effectExecutorAvailable: true,
    verifyRevision: (candidate) => candidate === managementCapability,
    beginRecovery: () =>
      Object.freeze({
        status: "ready" as const,
        recoveryId: `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`,
        recoveryCapability,
      }),
    verifyRecoveryBinding: (
      capability: unknown,
      recoveryId: unknown,
      management: unknown,
      stableHomeHash: unknown,
    ) =>
      capability === recoveryCapability &&
      recoveryId ===
        `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}` &&
      management === managementCapability &&
      stableHomeHash === "1".repeat(64),
    startCommand: (command) => {
      purposes.push(command.purpose);
      return Object.freeze({
        started: async () => true,
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout: command.purpose.startsWith("create_")
              ? String(purposes.length).repeat(64)
              : command.purpose === "start_provider_attached"
                ? `${JSON.stringify({
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    num_turns: 2,
                    total_cost_usd: 0.04699,
                    structured_output: { status: true },
                  })}\n`
                : command.purpose === "start_subscription_auth_probe_attached"
                  ? JSON.stringify({
                      loggedIn: true,
                      authMethod: "claude.ai",
                      apiProvider: "firstParty",
                      forcedLoginMethod: "claudeai",
                      subscriptionType: "max",
                    })
                  : "",
            stderr: "",
            outputExceeded: false,
          }),
        terminateAndWait: async () => true,
      });
    },
    cleanupOwnedResources: async (plan) =>
      Object.freeze({
        confirmed: true,
        processTreeTerminated: true,
        containersAbsent: true,
        networksAbsent: true,
        resourceObservations: (
          [
            ["create_subscription_auth_probe", "authContainerName"],
            ["create_internal_network", "internalNetworkName"],
            ["create_egress_network", "egressNetworkName"],
            ["create_proxy", "proxyContainerName"],
            ["create_provider", "providerContainerName"],
          ] as const
        ).map(([purpose, field]) => ({
          purpose,
          plannedResourceName: plan[field],
          dockerId: String(
            plan.commands.findIndex((command) => command.purpose === purpose) +
              1,
          ).repeat(64),
          observation: "absent" as const,
        })),
      }),
    completeRecovery: (capability: unknown, management: unknown) => {
      assert.equal(capability, recoveryCapability);
      assert.equal(management, managementCapability);
      recoveryCompletionCount += 1;
      return Object.freeze({
        status: "completed",
        recoveryFinalizationCapability: Object.freeze({}),
      });
    },
  });
  assert.ok(technicalPlan);
  const started = controller.start(technicalPlan, managementCapability);
  assert.equal(started.status, "started");
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "completed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(Object.hasOwn(result, "selectionRecordId"), false);
  assert.deepEqual(prepared.plan.executionSelection, selected);
  assert.equal(recoveryCompletionCount, 1);
  assert.deepEqual(purposes, [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ]);
});
