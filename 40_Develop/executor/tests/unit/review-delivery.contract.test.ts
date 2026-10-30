/**
 * レビュー内容の完了と、Hostが所有する次試行許可を分離する。
 * @packageDocumentation
 * @responsibility 実Executorと有限Command代役で所見返却・清掃・通知の相関を検査する。
 * @trace ERB-IT-004
 * @level UT
 * @scope 合成Planとメモリ内Commandのみ。実AI・Docker・保存なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { TaskResult } from "../../../ai-adapter/src/index.ts";
import { createExecutorTestCandidate } from "../../scripts/executor-test.ts";
import type { RuntimeDependencies } from "../../src/attempt/types.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 所見返却と終端通知の故障を同じ実行と清掃へ接続する。
 * @trace ERB-IT-004
 * @precondition 外部EffectのないCommand代役を使用する。
 * @stimulus 各Host構成で一回のレビューを実行する。
 * @observation 内容、所見、callback回数と清掃後の通知順序。
 * @oracle 所見は同じ完了結果で返し、通知故障でも内容完了と清掃を変えない。
 * @cleanup メモリ内sessionのcompletionを全件待つ。
 * @boundary Executorから既存Hostへの内部通知。
 */
test("レビュー所見は清掃後の同一完了結果で返し、Executorは是正許可を扱わない", async () => {
  for (const mode of [
    "normal",
    "rereview",
    "approved",
    "terminal_throw",
    "terminal_promise",
    "absence_promise",
    "absence_object",
    "mount_promise",
    "mount_object",
  ] as const) {
    const management = {},
      prepared = {},
      recovery = {};
    const plan = {
      ...attemptPlan(),
      operationMode: "isolated_task" as const,
      taskRole: "reviewer" as const,
      taskAttempt: mode === "rereview" ? (1 as const) : (0 as const),
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
      decision: mode === "approved" ? "approved" : "changes_requested",
      summary: "Synthetic review.",
      findings:
        mode === "approved"
          ? []
          : [
              {
                severity: "medium",
                path: "source.txt",
                category: "acceptance_criterion_not_met",
                criterionNumber: 1,
                message: "Synthetic finding.",
              },
            ],
    };
    let terminalResult: unknown = null;
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
      recordDockerAbsence: () =>
        (mode === "absence_promise"
          ? Promise.reject(Error("synthetic_absence"))
          : mode === "absence_object"
            ? {}
            : true) as unknown as boolean,
      recordMountCompletion: () =>
        (mode === "mount_promise"
          ? Promise.reject(Error("synthetic_mount"))
          : mode === "mount_object"
            ? {}
            : true) as unknown as boolean,
      completeMount: () => {
        events.push("mount");
        return { status: "completed" };
      },
      completeRecovery: () => {
        events.push("recovery");
        return {
          status: "completed",
          recoveryFinalizationCapability: {},
        };
      },
      recordProviderSubmission: () => true,
      recordTerminalObservation: (_r, result) => {
        events.push("terminal");
        callbackCalls++;
        terminalResult = result;
        if (mode === "terminal_throw") throw Error("synthetic_terminal");
        if (mode === "terminal_promise")
          return Promise.reject(Error("synthetic_terminal"));
      },
    };
    const runtime = createExecutorTestCandidate(dependencies);
    const started = runtime.start(prepared, management, () => true);
    assert.equal(started.status, "started");
    if (started.status !== "started") continue;
    const result = await started.completion;
    if (mode.startsWith("absence_") || mode.startsWith("mount_")) {
      assert.equal(result.status, "blocked");
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.normalizedResult, null);
      assert.equal(result.providerExecutionObservation, null);
      assert.equal(result.providerTurnObservation, null);
      assert.equal(result.reviewFindings, null);
      assert.equal(events.includes("recovery"), false);
      assert.equal(events.includes("mount"), !mode.startsWith("absence_"));
      assert.equal(callbackCalls, 1);
      continue;
    }
    assert.equal(result.status, "completed", result.reason);
    assert.equal(result.cleanupConfirmed, true);
    const content = result.normalizedResult as TaskResult;
    assert.ok("decision" in content && content.decision === review.decision);
    assert.equal(
      result.reviewFindings?.[0]?.message,
      mode === "approved" ? undefined : "Synthetic finding.",
    );
    assert.equal(result.reviewFindings === null, mode === "approved");
    assert.equal("remediationCapability" in result, false);
    assert.equal(terminalResult, result);
    assert.equal("remediationCapability" in content, false);
    assert.equal("providerTurnObservation" in content, false);
    assert.equal("providerExecutionObservation" in content, false);
    assert.equal(callbackCalls, 1);
    assert.equal(events.at(-1), "terminal");
    assert.equal("findings" in content, false);
  }
});
