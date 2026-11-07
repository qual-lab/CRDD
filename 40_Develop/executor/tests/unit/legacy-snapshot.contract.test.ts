/**
 * 移行中の有限試験代役でも要求不明を未発行へ変更しない。
 * @responsibility 初期・要求後欠測・明示未発行・Receiptを別の技術事実として保持する。
 * @trace ERB-UT-023
 * @level UT
 * @boundary 試験専用変換。実Process・Docker・外部AI・保存は使用しない。
 * @packageDocumentation
 * @scope 試験専用変換。実Process・Docker・外部AI・保存は使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bindLegacyTestIsolation,
  type IsolationRuntime,
  type DockerCommandSessionResult,
} from "../../scripts/executor-test.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 有限代役のSnapshotは初期・unknown・未発行・Receiptを区別する。
 * @responsibility 有限代役のSnapshotは初期・unknown・未発行・Receiptを区別する
 * @trace ERB-UT-023
 * @precondition 試験専用変換。実Process・Docker・外部AI・保存は使用しない。
 * @stimulus 有限代役のSnapshotは初期・unknown・未発行・Receiptを区別するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 有限代役のSnapshotは初期・unknown・未発行・Receiptを区別するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 試験専用変換。実Process・Docker・外部AI・保存は使用しない。
 */
test("有限代役のSnapshotは初期・unknown・未発行・Receiptを区別する", async () => {
  for (const state of [
    "initial",
    "unknown",
    "not_issued",
    "receipt",
  ] as const) {
    const plan = attemptPlan();
    const key = "create_provider";
    const resource = plan.isolationRequest.resources.find((r) => r.key === key);
    assert.ok(resource);
    const id = "a".repeat(64);
    const runtime: IsolationRuntime = {
      acquireHomeLease: () => ({
        status: "blocked",
        reason: "lock_exists",
        reference: null,
        cleanupConfirmed: true,
        descriptorClosed: true,
      }),
      cleanupOwnedResources: async () => {
        throw Error("unused");
      },
      verifyCleanupOutcome: () => {
        throw Error("unused");
      },
      startExecution: (_plan, _recovery, _management, hooks) => ({
        cancel: async () => ({
          cancellationRequested: true,
          processTerminationObserved: false,
        }),
        completion: (async (): Promise<DockerCommandSessionResult> => {
          if (state !== "initial") await hooks.onCommandSubmitting?.(key);
          if (state === "not_issued") await hooks.onCommandNotIssued?.(key);
          if (state === "receipt") await hooks.onResourceCreated?.(key, id);
          return {
            failure: null,
            notificationDeliveryConfirmed: true,
            callbackRegistrationReleased: true,
            cancellationRequested: false,
            executionStarted: false,
            executionCompleted: false,
            executionContainerCreated: false,
            executionExit: "not_observed",
            processTreeTerminationConfirmed: false,
            cleanup: {
              confirmed: false,
              processTreeTerminated: false,
              containersAbsent: false,
              networksAbsent: false,
            },
            resourceObservations:
              state === "initial"
                ? undefined
                : [
                    {
                      purpose: key,
                      plannedResourceName: resource.name,
                      dockerId: state === "receipt" ? id : null,
                      observation:
                        state === "not_issued" ? "not_requested" : "unknown",
                    },
                  ],
          };
        })(),
      }),
    };
    const bound = bindLegacyTestIsolation(
      plan,
      {},
      { recoveryId: "exact-recovery", recoveryCapability: {} },
      runtime,
    );
    const prepared = bound.prepareIsolation(plan.isolationRequest);
    assert.ok(prepared);
    assert.ok(
      prepared.resources.resources.every((r) => r.request === "not_issued"),
    );
    const result = await bound.executeIsolation(prepared).completion;
    const observed = result.resources.resources.find((r) => r.key === key);
    assert.ok(observed);
    assert.equal(
      observed.request,
      state === "unknown"
        ? "unknown"
        : state === "receipt"
          ? "issued"
          : "not_issued",
    );
    assert.equal(observed.identity.dockerId, state === "receipt" ? id : null);
  }
});
