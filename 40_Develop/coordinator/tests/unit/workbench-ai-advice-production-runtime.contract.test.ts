/**
 * Workbench助言Production RuntimeのLifecycle契約を検証する。
 *
 * @responsibility 署名Capability、Identity伝播、Provider Effect、取消、Host／Docker cleanupおよび助言公開順序を検証する。
 * @trace ERB-UT-023 ERB-IT-004
 * @boundary Coordinator RuntimeとFake Docker／Host境界。
 * @effect 外部Providerを使わずProcess内Fakeだけを実行する。
 * @security Credential、Repository PathおよびNetworkを使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../ai-runtime/src/catalog.ts";
import { prepareWorkbenchAiAdviceExecutionPlan } from "../../src/security/workbench-ai-advice-execution-plan.ts";
import {
  createIsolatedWorkbenchAiAdviceRuntimeCandidate,
  type WorkbenchAiAdviceRuntimeDependencies,
} from "../../src/security/workbench-ai-advice-production-runtime.ts";

const profile = resolveAiProfileById(
  DEFAULT_AI_PROFILE_CATALOG,
  "PROFILE-100001",
);
if (profile === null) throw new Error("test_profile_required");
const prepared = prepareWorkbenchAiAdviceExecutionPlan(
  Object.freeze({
    catalogRevision: 1,
    provider: profile.provider,
    providerPrompt: "固定投影だけを根拠に説明する",
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
    profileId: profile.profileId,
    exactModelId: profile.exactModelId,
    reasoningEffort: profile.defaultReasoningEffort,
    offering: profile.offering,
  }),
  profile,
);
if (prepared.status !== "prepared" || prepared.executionPlan === null)
  throw new Error("test_execution_plan_required");
const plan = prepared.executionPlan;

function fixture(
  overrides: Partial<WorkbenchAiAdviceRuntimeDependencies> = {},
) {
  const owned = Object.freeze({});
  const mountCapability = Object.freeze({});
  const managementCapability = Object.freeze({});
  const observationCapability = Object.freeze({});
  const mountControl = Object.freeze({});
  const mountUse = Object.freeze({});
  const mountAuthorization = Object.freeze({});
  const selectionControl = Object.freeze({});
  const selectionUse = Object.freeze({});
  const packetOwner = Object.freeze({});
  const packetUse = Object.freeze({});
  const preparedCapability = Object.freeze({});
  const processControl = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  const calls: string[] = [];
  const adviceJson = JSON.stringify({
    contract: "crdd-coordinator/workbench-ai-advice-result",
    contractRevision: 1,
    status: "completed",
    facts: [],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  });
  const dependencies = Object.freeze({
    consumeVerifiedPackage: () => {
      calls.push("consume-package");
      return true;
    },
    createOperation: async () => {
      calls.push("create-operation");
      return Object.freeze({
        owned,
        mountCapability,
        managementCapability,
        operationId: "OP-123456",
        hostRecoveryId: "HOST-RECOVERY",
      });
    },
    observeProviderHome: () =>
      Object.freeze({
        status: "candidate" as const,
        provider: plan.provider,
        observationCapability,
      }),
    issueMountGrant: () =>
      Object.freeze({
        status: "issued" as const,
        controlCapability: mountControl,
        useCapability: mountUse,
      }),
    consumeMountGrant: () =>
      Object.freeze({
        status: "consumed" as const,
        mountAuthorizationCapability: mountAuthorization,
      }),
    revokeMountGrant: () => Object.freeze({ status: "revoked" as const }),
    issueSelection: (_capability: unknown, request: unknown) => {
      const record = request as Readonly<Record<string, unknown>>;
      assert.equal(record.requestedProfileId, plan.profileId);
      assert.equal(record.operationId, "OP-123456");
      return Object.freeze({
        status: "issued" as const,
        controlCapability: selectionControl,
        useCapability: selectionUse,
        profileId: plan.profileId,
        selectedModel: plan.exactModelId,
        selectedEffort: plan.reasoningEffort,
      });
    },
    revokeSelection: () => Object.freeze({ status: "revoked" as const }),
    issuePacket: (input: Readonly<Record<string, unknown>>) => {
      assert.equal(input.taskHash, plan.taskHash);
      assert.equal(input.projectionHash, plan.projectionHash);
      return Object.freeze({
        status: "issued" as const,
        ownerCapability: packetOwner,
        useCapability: packetUse,
      });
    },
    revokePacket: () => true,
    prepareCodex: () =>
      Object.freeze({
        status: "prepared" as const,
        preparedCapability,
      }),
    prepareClaude: () =>
      Object.freeze({
        status: "prepared" as const,
        preparedCapability,
      }),
    startProcess: (
      _prepared: unknown,
      _management: unknown,
      register: unknown,
    ) => {
      calls.push("start-process");
      assert.equal(
        (register as (capability: unknown, id: string) => boolean)(
          recoveryCapability,
          "docker-recovery.test",
        ),
        true,
      );
      return Object.freeze({
        status: "started" as const,
        dockerEffectStarted: true,
        controlCapability: processControl,
        completion: Promise.resolve(
          Object.freeze({
            status: "completed" as const,
            reason: "provider_operation_completed",
            cleanupConfirmed: true,
            recoveryFinalizationCapability: recoveryCapability,
            normalizedResult: Object.freeze({
              contract: "crdd-coordinator/workbench-ai-advice-provider-output",
              contractRevision: 1,
              adviceJson,
            }),
          }),
        ),
      });
    },
    cancelProcess: async () => Object.freeze({ status: "cancelled" as const }),
    prepareDockerHostCleanup: () => {
      calls.push("prepare-docker-host-cleanup");
      return "HOST-RECOVERY";
    },
    cleanupOperation: async () => {
      calls.push("cleanup-operation");
      return Object.freeze({ status: "completed" as const });
    },
    classifyOperationCleanup: () => "completed" as const,
    recordDockerHostCleanupReceipt: () => {
      calls.push("record-docker-host-cleanup");
      return true;
    },
    finalizeDockerRecovery: () => {
      calls.push("finalize-docker-recovery");
      return Object.freeze({ status: "completed" as const });
    },
    abandonDockerRecovery: () => true,
    abandonOperation: async () => Object.freeze({ status: "retained" }),
    poisonAfterCleanupUnknown: () => calls.push("poison"),
    ...overrides,
  }) as unknown as WorkbenchAiAdviceRuntimeDependencies;
  return Object.freeze({ dependencies, calls, adviceJson });
}

test("署名確認からHost／Docker cleanup完了後にだけ助言JSONを返す", async () => {
  const current = fixture();
  const runtime = createIsolatedWorkbenchAiAdviceRuntimeCandidate(
    current.dependencies,
  );
  const result = await runtime.run(
    plan,
    new AbortController().signal,
    Object.freeze({}),
  );
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    adviceJson: current.adviceJson,
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
  assert.deepEqual(current.calls, [
    "consume-package",
    "create-operation",
    "start-process",
    "prepare-docker-host-cleanup",
    "cleanup-operation",
    "record-docker-host-cleanup",
    "finalize-docker-recovery",
  ]);
});

test("署名Capability不成立はOperationとProvider Effectを発行しない", async () => {
  const current = fixture({ consumeVerifiedPackage: () => false });
  const result = await createIsolatedWorkbenchAiAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal, Object.freeze({}));
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_release_verification_required",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(current.calls, []);
});

test("Host cleanup不成立後は助言を公開せず回復状態を保持する", async () => {
  const current = fixture({ prepareDockerHostCleanup: () => null });
  const result = await createIsolatedWorkbenchAiAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal, Object.freeze({}));
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_host_cleanup_intent_unconfirmed",
  );
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.adviceJson, null);
});
