/**
 * 移行中の有限試験代役でも要求不明を未発行へ変更しない。
 * @responsibility 初期・要求後欠測・明示未発行・Receiptを別の技術事実として保持する。
 * @trace ERB-UT-023
 * @level UT
 * @boundary 試験専用変換。実Process・Docker・外部AI・保存は使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bindLegacyTestIsolation,
  type IsolationRuntime,
  type DockerCommandSessionResult,
} from "../../scripts/executor-test.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

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
      acquireHomeLease: () => null,
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
