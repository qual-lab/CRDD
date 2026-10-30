/**
 * レビュー内容の完了と、Hostが所有する次試行許可を分離する。
 * @packageDocumentation
 * @responsibility 実Executorと有限Command代役で固定callbackの順序・欠測を検査する。
 * @trace ERB-IT-004
 * @level UT
 * @scope 合成Planとメモリ内Commandのみ。実AI・Docker・保存なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createExecutorTestCandidate,
  type TaskResult,
} from "../../src/index.ts";
import type { RuntimeDependencies } from "../../src/attempt/types.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 許可発行の成功・欠測・例外を同じ実行と清掃へ接続する。
 * @trace ERB-IT-004
 * @precondition 外部EffectのないCommand代役を使用する。
 * @stimulus 各Host構成で一回のレビューを実行する。
 * @observation 内容、許可、callback回数と清掃後の通知順序。
 * @oracle 内容完了は保持し、Hostが返した場合だけ許可を付加する。
 * @cleanup メモリ内sessionのcompletionを全件待つ。
 * @boundary Executorから既存Hostへの内部通知。
 */
test("レビュー完了はHost許可の欠測・例外と独立し、許可は清掃後だけ結合する", async () => {
  for (const mode of ["issued", "missing", "throw"] as const) {
    const management = {},
      prepared = {},
      recovery = {},
      capability = {};
    const plan = {
      ...attemptPlan(),
      operationMode: "isolated_task" as const,
      taskRole: "reviewer" as const,
      taskPacketRef: `TASKPKT-${"A".repeat(32)}`,
      taskPacketHash: "a".repeat(64),
      providerInput: "synthetic",
      taskWorkload: {
        readPathCount: 1,
        allowedPathCount: 1,
        acceptanceCriterionCount: 1,
        remediationFindingCount: 0,
      },
      workspaceSourcePath: "C:/synthetic/work",
      workspaceMountMode: "read_only" as const,
    };
    const recoveryId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
    const events: string[] = [];
    const review = {
      decision: "changes_requested",
      summary: "Synthetic review.",
      findings: [
        {
          severity: "medium",
          path: "source.txt",
          category: "acceptance_criterion_not_met",
          criterionNumber: 1,
          message: "Synthetic finding.",
        },
      ],
    };
    let callbackCalls = 0,
      consumed = false;
    const dependencies: RuntimeDependencies = {
      effectExecutorAvailable: true,
      verifyRevision: () => true,
      consumePreparedPlan: (p, m) => {
        if (p !== prepared || m !== management || consumed) return null;
        consumed = true;
        return plan;
      },
      consumeProviderAuthority: () => ({
        operationId: plan.operationId,
        provider: plan.provider,
        providerHomeMountGrantRef: plan.grantRef,
        runtimeAuthorityIssued: true,
        providerEffectAllowed: true,
      }),
      beginRecovery: () => ({
        status: "ready",
        recoveryId,
        recoveryCapability: recovery,
      }),
      verifyRecoveryBinding: () => true,
      startCommand: (command) => ({
        started: async () => true,
        terminateAndWait: async () => true,
        wait: async () => ({
          status: 0,
          signal: null,
          stderr: "",
          outputExceeded: false,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? JSON.stringify({
                  loggedIn: true,
                  authMethod: "claude.ai",
                  apiProvider: "firstParty",
                  forcedLoginMethod: "claudeai",
                  subscriptionType: "max",
                })
              : command.purpose === "start_provider_attached"
                ? JSON.stringify({
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    num_turns: 1,
                    total_cost_usd: 0,
                    result: JSON.stringify(review),
                  })
                : "",
        }),
      }),
      cleanupOwnedResources: async () => {
        events.push("cleanup");
        return {
          confirmed: true,
          processTreeTerminated: true,
          containersAbsent: true,
          networksAbsent: true,
          resourceObservations: [],
        };
      },
      completeMount: () => ({ status: "completed" }),
      completeRecovery: () => ({
        status: "completed",
        recoveryFinalizationCapability: {},
      }),
      recordProviderSubmission: () => true,
      recordTerminalObservation: (_r, result) => {
        events.push("terminal");
        assert.equal(Reflect.get(result, "status"), "completed");
      },
      ...(mode === "missing"
        ? {}
        : {
            registerReviewFindings: (r, p, findings) => {
              callbackCalls++;
              events.push("permission");
              assert.equal(r, recovery);
              assert.equal(p, plan);
              assert.equal(findings[0]?.message, "Synthetic finding.");
              assert.ok(
                events.indexOf("cleanup") < events.indexOf("permission"),
              );
              if (mode === "throw") throw Error("synthetic_callback_failure");
              return capability;
            },
          }),
    };
    const runtime = createExecutorTestCandidate(dependencies);
    const started = runtime.start(prepared, management, () => true);
    assert.equal(started.status, "started");
    if (started.status !== "started") continue;
    const result = await started.completion;
    assert.equal(result.status, "completed", result.reason);
    assert.equal(result.cleanupConfirmed, true);
    const content = result.normalizedResult as TaskResult;
    assert.ok(
      "decision" in content && content.decision === "changes_requested",
    );
    assert.equal(
      content.remediationCapability,
      mode === "issued" ? capability : undefined,
    );
    assert.equal(callbackCalls, mode === "missing" ? 0 : 1);
    assert.equal(events.at(-1), "terminal");
    assert.equal("findings" in content, false);
  }
});
