/**
 * Workbench助言Production RuntimeのLifecycle契約を検証する。
 *
 * @packageDocumentation
 * @responsibility Identity伝播、Provider Effect、取消、Host／Docker cleanupおよび助言公開順序を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Coordinator RuntimeとFake Docker／Host境界。
 */
import assert from "node:assert/strict";
import type { AttemptInput } from "../../../../executor/src/index.ts";
import { fixtureNetworkPolicy } from "../../fixtures/network-policy.ts";
import test from "node:test";
import {
  beginRuntimeProcessEffectDrain,
  endRuntimeProcessEffectDrain,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../../../src/execution/process-safety-state.ts";

import { hashExecutionSelection } from "../../../../domain-model/src/index.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { prepareProviderAdvicePlan } from "../../../src/execution/preparation.ts";
import {
  createIsolatedProviderAdviceRuntimeCandidate,
  createRuntimeOwnedProviderAdviceRuntime,
  createIsolatedProviderOperationCandidate,
  classifyProviderAdviceHostFailure,
  type ProviderAdviceRuntimeDependencies,
} from "../../../src/execution/advice.ts";
import { createIsolatedDelegationSelectionGrantRuntimeCandidate } from "../../../src/execution/authority.ts";
import { createIsolatedCoordinatorOperationCreationCandidate } from "../../../src/execution/operation.ts";

const selection = executionSelection("advice");
const prepared = prepareProviderAdvicePlan(
  Object.freeze({
    networkPolicy: fixtureNetworkPolicy(selection.provider),
    provider: selection.provider,
    providerPrompt: "固定投影だけを根拠に説明する",
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
    executionSelection: selection,
    exactModelId: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    offering: "chatgpt_subscription_oauth" as const,
  }),
);
if (prepared.status !== "prepared" || prepared.executionPlan === null)
  throw new Error("test_execution_plan_required");
const plan = prepared.executionPlan;
const dockerRecoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

/**
 * Controller引渡し後の失敗から初回結果へexact参照を保持する。
 * @responsibility Host清掃だけによるDocker回収完了の誤認と参照上書きを反証する。
 * @trace ERB-UT-023
 * @precondition 外部資源を作らない既存の合成Runtime依存を使用する。
 * @stimulus 同期例外、取消、完了失敗、清掃不明、二重引渡しとfinalize失敗を与える。
 * @observation 私有分類のexact参照、Host清掃、取消と公開JSONを照合する。
 * @oracle finalize前の失敗は同じIDを保持し、正常finalizeだけ参照を解放する。
 * @cleanup N/A: メモリ内の代役だけを使う。
 * @boundary ERB-UT-023=Direct Boundary: Controller引渡し→助言Runtime初回結果。
 */
test("助言は引渡し済みDocker参照を初回失敗まで保持し正式終了後だけ解放する", async () => {
  for (const scenario of [
    "normal",
    "throw",
    "blocked",
    "cancel",
    "completion_throw",
    "cleanup_unknown",
    "finalize_failed",
    "duplicate",
    "different",
    "missing",
    "invalid",
  ]) {
    const current = fixture();
    const abort = new AbortController();
    const runtime = createIsolatedProviderAdviceRuntimeCandidate({
      ...current.dependencies,
      startProcess(
        ...args: Parameters<ProviderAdviceRuntimeDependencies["startProcess"]>
      ) {
        const register = args[2] as (
          capability: unknown,
          id: unknown,
        ) => boolean;
        if (scenario === "missing")
          return {
            status: "started",
            controlCapability: {},
            completion: Promise.resolve({}),
          };
        if (scenario === "invalid") {
          assert.equal(register({}, "invalid"), false);
          assert.equal(register({}, dockerRecoveryId), false);
          return { status: "blocked", reason: "synthetic_invalid_handoff" };
        }
        const started = current.dependencies.startProcess(...args) as {
          completion: Promise<Record<string, unknown>>;
        };
        if (scenario === "throw") throw Error("synthetic_after_handoff");
        if (scenario === "blocked")
          return { status: "blocked", reason: "synthetic_start_blocked" };
        if (scenario === "duplicate" || scenario === "different") {
          assert.equal(
            register(
              {},
              scenario === "duplicate"
                ? dockerRecoveryId
                : dockerRecoveryId.replace(/1/g, "4"),
            ),
            false,
          );
        }
        return {
          ...started,
          completion: started.completion.then((completed) => {
            if (scenario === "completion_throw")
              throw Error("synthetic_completion");
            if (scenario === "cancel") abort.abort();
            return scenario === "cleanup_unknown" || scenario === "cancel"
              ? { ...completed, cleanupConfirmed: false }
              : completed;
          }),
        };
      },
      finalizeDockerRecovery:
        scenario === "finalize_failed"
          ? () => ({ status: "blocked" as const })
          : current.dependencies.finalizeDockerRecovery,
    } as unknown as ProviderAdviceRuntimeDependencies);
    const result = await runtime.run(plan, abort.signal);
    const classification = classifyProviderAdviceHostFailure(result);
    if (scenario === "normal") {
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(classification, null);
    } else if (scenario === "missing" || scenario === "invalid") {
      assert.equal(result.status, "blocked");
      assert.equal(classification?.dockerRecoveryId, null);
    } else {
      assert.equal(result.status, "blocked", scenario);
      assert.equal(result.cleanupConfirmed, false, scenario);
      assert.equal(
        classification?.dockerRecoveryId,
        dockerRecoveryId,
        scenario,
      );
      assert.equal(classification?.hostRecoveryId, "HOST-RECOVERY", scenario);
      if (scenario === "throw" || scenario === "blocked")
        assert.equal(
          current.calls.includes("cleanup-operation"),
          false,
          scenario,
        );
    }
    assert.equal(JSON.stringify(result).includes(dockerRecoveryId), false);
    assert.equal(classifyProviderAdviceHostFailure({ ...result }), null);
  }
});

/**
 * fixture用の試験入力または観測処理を提供する。
 *
 * @responsibility fixture用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus fixtureの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(
  overrides: Partial<ProviderAdviceRuntimeDependencies> = {},
  options: Readonly<{
    mountReobservationUnavailable?: boolean;
    realSelectionRuntime?: boolean;
    selectionRefreshRevokeFailure?: boolean;
    selectionRefreshUnavailable?: boolean;
    selectionRefreshMismatch?: boolean;
    selectionCorrelationMismatch?: Readonly<{
      index: 0 | 1;
      field: "operationId" | "taskAttempt" | "selectionHash";
    }>;
  }> = {},
) {
  const owned = Object.freeze({});
  const mountCapability = Object.freeze({});
  const managementCapability = Object.freeze({});
  const grantObservationCapability = Object.freeze({});
  const mountObservationCapability = Object.freeze({});
  const mountControl = Object.freeze({});
  const mountUse = Object.freeze({});
  const mountAuthorization = Object.freeze({});
  const selectionControls = [Object.freeze({}), Object.freeze({})];
  const selectionUses = [Object.freeze({}), Object.freeze({})];
  const packetOwner = Object.freeze({});
  const packetUse = Object.freeze({});
  const processControl = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  const calls: string[] = [];
  const runtimeObservation = {
    providerHomeCount: 0,
    mountGrantConsumed: false,
    selectionIssueCount: 0,
  };
  let selectionRandomValue = 0;
  const selectionRuntime =
    createIsolatedDelegationSelectionGrantRuntimeCandidate({
      verifyOperation: (candidate: unknown) => {
        assert.equal(candidate, managementCapability);
        return Object.freeze({
          operationId: "OP-123456",
          createdAt: "2026-09-29T00:00:00.000Z",
        });
      },
      observeProviderEligibility: () =>
        Object.freeze([
          Object.freeze({
            provider: "codex",
            status: "eligible",
            reason: "ready",
          }),
          Object.freeze({
            provider: "claude",
            status: "eligible",
            reason: "ready",
          }),
        ]),
      wallNow: () => 1_000,
      monotonicNow: () => 2_000,
      randomBytes: (size: number) => {
        selectionRandomValue += 1;
        return Buffer.alloc(size, selectionRandomValue);
      },
    });
  const adviceJson = JSON.stringify({
    status: "completed",
    facts: [],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  });
  const dependencies = Object.freeze({
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
    bindRepository: () => {
      calls.push("bind-repository");
      return Object.freeze({ operationId: "OP-123456" });
    },
    observeProviderHome: () => {
      calls.push("observe-provider-home");
      if (
        runtimeObservation.providerHomeCount === 1 &&
        options.mountReobservationUnavailable === true
      ) {
        runtimeObservation.providerHomeCount += 1;
        return Object.freeze({
          status: "unavailable" as const,
          provider: plan.provider,
        });
      }
      const observationCapability =
        runtimeObservation.providerHomeCount === 0
          ? grantObservationCapability
          : mountObservationCapability;
      runtimeObservation.providerHomeCount += 1;
      return Object.freeze({
        status: "candidate" as const,
        provider: plan.provider,
        observationCapability,
      });
    },
    issueMountGrant: (
      _managementCapability: unknown,
      observationCapability: unknown,
    ) => {
      assert.equal(observationCapability, grantObservationCapability);
      return Object.freeze({
        status: "issued" as const,
        controlCapability: mountControl,
        useCapability: mountUse,
      });
    },
    consumeMountGrant: (
      _useCapability: unknown,
      _managementCapability: unknown,
      observationCapability: unknown,
    ) => {
      calls.push("consume-mount-grant");
      runtimeObservation.mountGrantConsumed = true;
      assert.equal(observationCapability, mountObservationCapability);
      return Object.freeze({
        status: "consumed" as const,
        mountAuthorizationCapability: mountAuthorization,
      });
    },
    revokeMountGrant: () => {
      calls.push("revoke-mount-grant");
      return Object.freeze({ status: "revoked" as const });
    },
    issueSelection: (selectionCapability: unknown, request: unknown) => {
      calls.push("issue-selection");
      const record = request as Readonly<Record<string, unknown>>;
      assert.deepEqual(record, {
        operationId: "OP-123456",
        taskAttempt: 0,
        executionSelection: plan.executionSelection,
      });
      const index = runtimeObservation.selectionIssueCount;
      runtimeObservation.selectionIssueCount += 1;
      if (options.realSelectionRuntime === true)
        return selectionRuntime.issue(selectionCapability, request);
      return Object.freeze({
        status: "issued" as const,
        controlCapability: selectionControls[index],
        useCapability: selectionUses[index],
        operationId:
          options.selectionCorrelationMismatch?.index === index &&
          options.selectionCorrelationMismatch.field === "operationId"
            ? "OP-654321"
            : "OP-123456",
        selectionHash:
          options.selectionCorrelationMismatch?.index === index &&
          options.selectionCorrelationMismatch.field === "selectionHash"
            ? "f".repeat(64)
            : hashExecutionSelection(plan.executionSelection),
        executorProvider: plan.provider,
        executionSelection: plan.executionSelection,
        taskAttempt:
          options.selectionCorrelationMismatch?.index === index &&
          options.selectionCorrelationMismatch.field === "taskAttempt"
            ? 1
            : 0,
        selectedModel:
          index === 1 && options.selectionRefreshUnavailable === true
            ? "invalid-model"
            : plan.exactModelId,
        selectedEffort: plan.reasoningEffort,
        speedMode: "normal",
        selectionNotice:
          index === 1 && options.selectionRefreshMismatch === true
            ? "workbench-advice-changed-selection"
            : "workbench-advice-fixed-selection",
      });
    },
    revokeSelection: (controlCapability: unknown, capability: unknown) => {
      calls.push("revoke-selection");
      if (
        runtimeObservation.selectionIssueCount === 1 &&
        options.selectionRefreshRevokeFailure === true
      )
        return Object.freeze({ status: "blocked" as const });
      if (options.realSelectionRuntime === true)
        return selectionRuntime.revoke(controlCapability, capability);
      return Object.freeze({ status: "revoked" as const });
    },
    issuePacket: (input: Readonly<Record<string, unknown>>) => {
      calls.push("issue-packet");
      assert.equal(input.taskHash, plan.taskHash);
      assert.equal(input.projectionHash, plan.projectionHash);
      return Object.freeze({
        status: "issued" as const,
        ownerCapability: packetOwner,
        useCapability: packetUse,
      });
    },
    revokePacket: () => true,
    startProcess: (
      _provider: "codex" | "claude",
      input: AttemptInput,
      register: unknown,
    ) => {
      const { managementCapability: capability, selectionUseCapability } =
        input;
      if (options.realSelectionRuntime === true) {
        const consumedSelection = selectionRuntime.consume(
          selectionUseCapability,
          capability,
        );
        assert.ok(consumedSelection);
        assert.equal(consumedSelection.executorProvider, plan.provider);
        assert.deepEqual(
          consumedSelection.executionSelection,
          plan.executionSelection,
        );
      }
      calls.push("start-process");
      calls.push("register-recovery");
      assert.equal(
        (register as (capability: unknown, id: string) => boolean)(
          recoveryCapability,
          dockerRecoveryId,
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
              ...JSON.parse(adviceJson),
              reason: null,
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
  }) as unknown as ProviderAdviceRuntimeDependencies;
  return Object.freeze({
    dependencies,
    calls,
    adviceJson,
    runtimeObservation,
  });
}

/**
 * 助言終了へ元結果を搬送し、Host Protocol失敗を成功へ変更しない。
 *
 * @responsibility Host清掃分類と元結果搬送の共同条件を検証する。
 * @trace ERB-UT-023
 * @precondition 固定助言と同じRuntimeの模擬Controller・Host結果を使用する。
 * @stimulus 清掃成功、Protocol失敗の清掃確認、分類不能を順に実行する。
 * @observation 記録callbackの引数同一性、呼出し数、公開結果を取得する。
 * @oracle 成功分類だけ元結果を搬送し、Protocol失敗はblocked、分類不能は記録0。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary 助言Ownerと模擬Host／Controllerの終了境界。
 */
test("助言終了は元結果を搬送しProtocol失敗と分類不能を成功へ変更しない", async () => {
  for (const classification of [
    "completed",
    "protocol_failure_cleanup_confirmed",
    null,
  ] as const) {
    const current = fixture();
    let dockerCompletion: unknown;
    let hostCleanupOutcome: unknown;
    let receipts = 0;
    const runtime = createIsolatedProviderAdviceRuntimeCandidate({
      ...current.dependencies,
      startProcess(...args) {
        const started = current.dependencies.startProcess(...args);
        const completion = (
          started as { completion: Promise<unknown> }
        ).completion.then((result) => {
          dockerCompletion = result;
          return result;
        });
        return Object.freeze({ ...started, completion }) as typeof started;
      },
      async cleanupOperation(...args) {
        hostCleanupOutcome = await current.dependencies.cleanupOperation(
          ...args,
        );
        return hostCleanupOutcome as Awaited<
          ReturnType<ProviderAdviceRuntimeDependencies["cleanupOperation"]>
        >;
      },
      classifyOperationCleanup: () => classification,
      recordDockerHostCleanupReceipt(_capability, completion) {
        receipts += 1;
        assert.equal(Object.isFrozen(completion), true);
        assert.equal(completion.hostCleanupOutcome, hostCleanupOutcome);
        assert.equal(completion.dockerCompletion, dockerCompletion);
        return true;
      },
    });
    const result = await runtime.run(plan, new AbortController().signal);
    assert.equal(
      result.status,
      classification === "completed" ? "completed" : "blocked",
    );
    assert.equal(receipts, classification === null ? 0 : 1);
    assert.equal(
      current.calls.includes("finalize-docker-recovery"),
      classification !== null,
    );
    if (classification === "protocol_failure_cleanup_confirmed") {
      assert.equal(result.reason, "workbench_ai_advice_host_generation_lost");
      assert.equal(result.cleanupConfirmed, true);
    }
  }
});

/**
 * 署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返すを検証する。
 *
 * @responsibility 署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返す", async () => {
  const current = fixture();
  const runtime = createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  );
  const result = await runtime.run(plan, new AbortController().signal);
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    adviceJson: current.adviceJson,
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
  assert.deepEqual(current.calls, [
    "create-operation",
    "bind-repository",
    "issue-selection",
    "observe-provider-home",
    "observe-provider-home",
    "consume-mount-grant",
    "revoke-selection",
    "issue-selection",
    "issue-packet",
    "start-process",
    "register-recovery",
    "prepare-docker-host-cleanup",
    "cleanup-operation",
    "record-docker-host-cleanup",
    "finalize-docker-recovery",
  ]);
});

/**
 * Production要求を実Selection Runtimeへ直接接続できることを検証する。
 *
 * @responsibility Workbenchが生成した初回・再発行Selection要求を実Selection Runtimeへ渡し、Grantの発行・失効・消費まで同じLifecycleで成立することの合否判定を所有する。
 * @trace ERB-UT-023
 * @precondition Workbench Production Runtimeの他境界は決定論的fixtureとし、Selection境界だけを実Runtimeへ接続する。
 * @stimulus 明示Codex Profileを持つWorkbench助言を実行する。
 * @observation Production要求、Selection発行回数、旧Grant失効、再発行Grant消費およびProvider Effectを観測する。
 * @oracle 初回と再発行の2 Grantが実Runtimeから発行され、旧Grantは失効し、新GrantはProvider準備で一回だけ消費されて助言が完了する。
 * @cleanup Workbench LifecycleがOperationとProvider資源を清掃し、Selection Authorityは失効または消費済みになる。
 * @boundary ERB-UT-023=Direct Boundary: Workbench Production Runtime→Delegation Selection Grant Runtime→Provider準備
 */
test("Production要求を実Selection Runtimeへ直接接続できる", async () => {
  const current = fixture({}, { realSelectionRuntime: true });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    adviceJson: current.adviceJson,
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
  assert.equal(current.runtimeObservation.selectionIssueCount, 2);
  assert.equal(
    current.calls.filter((call) => call === "revoke-selection").length,
    1,
  );
});

/**
 * Mount Grant発行後のfresh再観測が不成立ならProvider Effectを発行しないことを検証する。
 *
 * @responsibility 一回限りの観測Capabilityを再利用せず、Mount Grant消費直前の観測不能をFail Closedにする。
 * @trace ERB-UT-023
 * @precondition Grant発行時の観測は成立し、消費直前の再観測だけが不成立である。
 * @stimulus Workbench助言Production Runtimeを実行する。
 * @observation 結果理由、Grant失効・消費、Selection、Packet、Recovery、Process、Provider Effect、Operation cleanupおよびProcess poisonの件数を観測する。
 * @oracle 再観測固有理由でblockedとなり、未消費Grant失効1、Operation cleanup 1、その他の後続Authority・Effect・poison 0になる。
 * @cleanup Operation cleanupが完了し、Process外資源を残さない。
 * @boundary ERB-UT-023=Direct Boundary: Provider Home観測→Mount Grant消費
 */
test("Mount Grant消費直前のfresh再観測が不成立ならProvider Effectを発行しない", async () => {
  const current = fixture({}, { mountReobservationUnavailable: true });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_mount_reobservation_unavailable",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(current.runtimeObservation.providerHomeCount, 2);
  assert.equal(current.runtimeObservation.mountGrantConsumed, false);
  assert.equal(current.runtimeObservation.selectionIssueCount, 1);
  assert.equal(
    current.calls.filter((call) => call === "revoke-mount-grant").length,
    1,
  );
  assert.equal(
    current.calls.filter((call) => call === "issue-selection").length,
    1,
  );
  assert.equal(
    current.calls.filter((call) => call === "revoke-selection").length,
    1,
  );
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("register-recovery"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
  assert.equal(current.calls.includes("poison"), false);
});

/**
 * Repository結合が不成立ならSelectionとProvider Effectを発行しないことを検証する。
 *
 * @responsibility Workbench助言Operationを元Repository Identityへ結合できない状態をFail Closedにする。
 * @trace ERB-UT-023
 * @precondition Operation生成は成立するがRepository結合だけが不成立である。
 * @stimulus Workbench助言Production Runtimeを実行する。
 * @observation 結果理由、Selection、Mount、Packet、Process、Provider EffectおよびOperation cleanupを観測する。
 * @oracle Repository結合固有理由でblockedとなり、後続Authority・Effect 0、Operation cleanup 1になる。
 * @cleanup Operation cleanupが完了し、Process外資源を残さない。
 * @boundary ERB-UT-023=Direct Boundary: Repository Identity→Selection Grant
 */
test("Repository結合が不成立ならSelectionとProvider Effectを発行しない", async () => {
  const current = fixture({ bindRepository: () => null });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_repository_binding_unavailable",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(current.calls.includes("issue-selection"), false);
  assert.equal(current.calls.includes("observe-provider-home"), false);
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
});

/**
 * 作成済みOperationの保存拒否をProvider前で止める。
 * @responsibility 作成・保存・実開始の三境界を混同しない。
 * @trace ERB-UT-023
 * @precondition 外部資源を持たない固定依存を用いる。
 * @stimulus 保存callbackの拒否とHost清掃の成立・不明を組み合わせる。
 * @observation callbackの実ID、Provider開始0、清掃回数と元Host参照。
 * @oracle 保存前Provider0、清掃不明でも同exact参照を保持する。
 * @cleanup 偽依存だけでProcess外資源0。
 * @boundary Operation作成通知と上位Writer。
 */
test("RO Operation参照の保存拒否はProvider前で停止しHost回収結果を残す", async () => {
  for (const cleanup of [true, false]) {
    let notified = 0;
    const current = fixture({
      observeOperation: async (operation) => {
        notified++;
        assert.deepEqual(operation, {
          operationId: "OP-123456",
          hostRecoveryId: "HOST-RECOVERY",
        });
        return false;
      },
      classifyOperationCleanup: () => (cleanup ? "completed" : null),
    });
    const result = await createIsolatedProviderAdviceRuntimeCandidate(
      current.dependencies,
    ).run(plan, new AbortController().signal);
    assert.equal(notified, 1);
    assert.equal(
      result.reason,
      "workbench_ai_advice_operation_save_unconfirmed",
    );
    assert.equal(result.providerEffectIssued, false);
    assert.equal(current.calls.includes("start-process"), false);
    assert.equal(
      current.calls.filter((call) => call === "cleanup-operation").length,
      1,
    );
    assert.equal(result.cleanupConfirmed, cleanup);
    assert.equal(
      classifyProviderAdviceHostFailure(result)?.hostRecoveryId,
      cleanup ? null : "HOST-RECOVERY",
    );
  }
});

/**
 * 初回Selectionを失効できなければ再発行とProvider Effectへ進まないことを検証する。
 *
 * @responsibility Mount後のSelection更新前に旧Authorityの失効を必須とし、失効不能時に後続Authorityを発行しない。
 * @trace ERB-UT-023
 * @precondition Repository結合、初回Selection、Provider Home再観測およびMount Grant消費は成立する。
 * @stimulus 初回Selectionの失効だけを不成立にしてWorkbench助言Runtimeを実行する。
 * @observation Selection発行・失効、Packet、Process、Provider EffectおよびOperation cleanupを観測する。
 * @oracle Selection再発行0、Packet・Process・Provider Effect 0、Operation cleanup 1となり、失効不明をcleanup成功へ畳まない。
 * @cleanup catch経路が旧Selection失効を再試行し、なお失敗する場合はProcessをpoisonする。
 * @boundary ERB-UT-023=Direct Boundary: Mount完了→旧Selection失効
 */
test("初回Selectionを失効できなければ再発行とProvider Effectへ進まない", async () => {
  const current = fixture({}, { selectionRefreshRevokeFailure: true });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_selection_refresh_revoke_failed",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(current.runtimeObservation.selectionIssueCount, 1);
  assert.equal(
    current.calls.filter((call) => call === "revoke-selection").length,
    2,
  );
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
  assert.equal(current.calls.includes("poison"), true);
});

/**
 * 再発行Selectionが不正でも取得済みAuthorityを失効することを検証する。
 *
 * @responsibility 再Selectionの検証前にCleanup Authorityを保持し、不正RecordをAuthority残存へ変換しない。
 * @trace ERB-UT-023
 * @precondition 初回Selection失効後に、ControlとUseを持つがModelが不正な再Selectionが発行される。
 * @stimulus 不正な再SelectionでWorkbench助言Runtimeを実行する。
 * @observation 二回のSelection、両Selection失効、Packet、Process、Provider EffectおよびOperation cleanupを観測する。
 * @oracle 再Selection不成立理由でblockedとなり、新旧Selectionを失効してProvider Effect 0で閉じる。
 * @cleanup Operation cleanupが完了し、Process外資源を残さない。
 * @boundary ERB-UT-023=Direct Boundary: Selection再発行→Selection検証
 */
test("不正な再Selectionは取得済みAuthorityを失効してProvider Effectへ進まない", async () => {
  const current = fixture({}, { selectionRefreshUnavailable: true });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_selection_refresh_unavailable",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(current.runtimeObservation.selectionIssueCount, 2);
  assert.equal(
    current.calls.filter((call) => call === "revoke-selection").length,
    2,
  );
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
});

/**
 * Mount後の再Selectionが初回Selectionと異なる場合はProvider Effectを発行しないことを検証する。
 *
 * @responsibility 短命Selection更新時の意味変更をProvider Effect前に拒否する。
 * @trace ERB-UT-023
 * @precondition Repository結合、初回Selection、Provider Home再観測およびMount Grant消費は成立する。
 * @stimulus 再Selectionの理由だけを初回から変更してWorkbench助言Runtimeを実行する。
 * @observation 二回のSelection、旧Selection失効、新Selection失効、Packet、Process、Effectおよびcleanupを観測する。
 * @oracle 意味不一致固有理由でblockedとなり、二つのSelectionを失効してProvider Effect 0で閉じる。
 * @cleanup Operation cleanupが完了し、Process外資源を残さない。
 * @boundary ERB-UT-023=Direct Boundary: Mount完了→Effect直前Selection更新
 */
test("Mount後の再Selectionが初回Selectionと異なる場合はProvider Effectを発行しない", async () => {
  const current = fixture({}, { selectionRefreshMismatch: true });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_selection_refresh_mismatch");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(current.runtimeObservation.selectionIssueCount, 2);
  assert.equal(
    current.calls.filter((call) => call === "revoke-selection").length,
    2,
  );
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
});

/**
 * 片付け中はOperationとProvider Effectを発行しないを検証する。
 *
 * @responsibility 片付け中はOperationとProvider Effectを発行しないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 片付け中はOperationとProvider Effectを発行しないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("片付け中はOperationとProvider Effectを発行しない", async () => {
  const current = fixture();
  const token = beginRuntimeProcessEffectDrain();
  try {
    const result = await createIsolatedProviderAdviceRuntimeCandidate(
      current.dependencies,
    ).run(plan, new AbortController().signal);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "workbench_ai_advice_runtime_cleanup_in_progress",
    );
    assert.equal(result.providerEffectIssued, false);
    assert.equal(result.cleanupConfirmed, true);
    assert.deepEqual(current.calls, []);
  } finally {
    assert.equal(endRuntimeProcessEffectDrain(token), true);
  }
});

/**
 * Host cleanup不成立後は助言を公開せず回復状態を保持するを検証する。
 *
 * @responsibility Host cleanup不成立後は助言を公開せず回復状態を保持するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Host cleanup不成立後は助言を公開せず回復状態を保持するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host cleanup不成立後は助言を公開せず回復状態を保持する", async () => {
  const current = fixture({ prepareDockerHostCleanup: () => null });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_host_cleanup_intent_unconfirmed",
  );
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.adviceJson, null);
});

/**
 * 所有Operation作成の固定された失敗分類を実際の状態機械から取得する。
 *
 * @responsibility 清掃確認済みと未確認を同じ作成失敗の反例として用意する。
 * @trace ERB-UT-023
 * @precondition メモリ内の偽所有対象と固定参照だけを使う。
 * @stimulus Capability初期化を失敗させ、指定した清掃結果へ分岐する。
 * @observation 作成境界が投げた元のError Objectを保持する。
 * @oracle 下位の私有分類が対象の清掃確認とexact参照を保持する。
 * @cleanup N/A: Filesystem、Dockerまたは子Processを操作しない。
 * @boundary ERB-UT-023=Direct Boundary: Operation作成分類→助言Runtime。
 */
function initializationFailure(cleanupConfirmed: boolean): unknown {
  const candidate = createIsolatedCoordinatorOperationCreationCandidate({
    /**
     * メモリ内の偽所有対象を生成する。
     *
     * @responsibility createDirectoriesの局所反証を所有する。
     * @trace ERB-UT-023
     * @precondition 固定した偽依存と対象段だけを使う。
     * @stimulus 本番と同じ初期化処理から呼び出す。
     * @observation 返値、例外および局所呼出しを観測する。
     * @oracle 固定Objectだけを返し、Filesystemを取得しない。
     * @cleanup N/A: Process外資源を取得しない。
     * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
     */
    createDirectories: () =>
      Object.freeze({}) as ReturnType<
        Parameters<
          typeof createIsolatedCoordinatorOperationCreationCandidate
        >[0]["createDirectories"]
      >,
    /**
     * 固定の元参照を返す。
     *
     * @responsibility getHostRecoveryIdの局所反証を所有する。
     * @trace ERB-UT-023
     * @precondition 固定した偽依存と対象段だけを使う。
     * @stimulus 本番と同じ初期化処理から呼び出す。
     * @observation 返値、例外および局所呼出しを観測する。
     * @oracle 実Tokenではない同じfixture文字列を返す。
     * @cleanup N/A: Process外資源を取得しない。
     * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
     */
    getHostRecoveryId: () => "exact-host-reference-fixture",
    /**
     * Capability初期化失敗を注入する。
     *
     * @responsibility initializeCapabilitiesの局所反証を所有する。
     * @trace ERB-UT-023
     * @precondition 固定した偽依存と対象段だけを使う。
     * @stimulus 本番と同じ初期化処理から呼び出す。
     * @observation 返値、例外および局所呼出しを観測する。
     * @oracle 固定例外を投げ、Authorityを生成しない。
     * @cleanup N/A: Process外資源を取得しない。
     * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
     */
    initializeCapabilities: () => {
      throw new Error("fixture_initialization_failure");
    },
    /**
     * 作成失敗後の清掃確認を分岐する。
     *
     * @responsibility cleanupDirectoriesの局所反証を所有する。
     * @trace ERB-UT-023
     * @precondition 固定した偽依存と対象段だけを使う。
     * @stimulus 本番と同じ初期化処理から呼び出す。
     * @observation 返値、例外および局所呼出しを観測する。
     * @oracle 指定したfalseだけ例外を投げ、実削除しない。
     * @cleanup N/A: Process外資源を取得しない。
     * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
     */
    cleanupDirectories: () => {
      if (!cleanupConfirmed) throw new Error("fixture_cleanup_unknown");
    },
  });
  try {
    candidate.create();
  } catch (error) {
    return error;
  }
  throw new Error("fixture_failure_required");
}

/**
 * 初期化失敗の既知清掃分類とexact参照を初回結果まで保持する。
 *
 * @responsibility operation未返却を未清掃と読み替えず、元分類と公開境界を確認する。
 * @trace ERB-UT-023
 * @precondition 固定した作成失敗、偽依存および有効な助言計画を用いる。
 * @stimulus 清掃確認済みと未確認の作成失敗で助言Runtimeを実行する。
 * @observation 初回結果、私有分類、poison呼出し、JSONおよびProvider開始を確認する。
 * @oracle 清掃trueは維持し参照null、falseはexact参照保持。両方ともProvider開始0。
 * @cleanup N/A: 全依存はProcess内の偽実装である。
 * @boundary ERB-UT-023=Direct Boundary: 作成失敗分類→初回Runtime結果。
 */
test("初期化失敗の清掃分類と取得済み参照を初回結果まで保持する", async () => {
  for (const confirmed of [true, false]) {
    const failure = initializationFailure(confirmed);
    const current = fixture({
      createOperation: async () => {
        throw failure;
      },
    });
    const result = await createIsolatedProviderAdviceRuntimeCandidate(
      current.dependencies,
    ).run(plan, new AbortController().signal);
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, confirmed);
    assert.equal(result.providerEffectIssued, false);
    assert.deepEqual(classifyProviderAdviceHostFailure(result), {
      cleanupConfirmed: confirmed,
      manualRecoveryRequired: !confirmed,
      hostRecoveryId: confirmed ? null : "exact-host-reference-fixture",
      dockerRecoveryId: null,
    });
    assert.equal(current.calls.includes("start-process"), false);
    assert.equal(current.calls.includes("poison"), !confirmed);
    assert.equal(
      JSON.stringify(result).includes("exact-host-reference"),
      false,
    );
    assert.equal(classifyProviderAdviceHostFailure({ ...result }), null);
  }
});

/**
 * 分類のない作成例外を清掃確認や回復参照へ補完しない。
 *
 * @responsibility operation未取得とHost不存在を区別し、未知失敗を停止状態に保持する。
 * @trace ERB-UT-023
 * @precondition 元作成分類を持たない固定例外を用いる。
 * @stimulus createOperationが未知例外を投げる。
 * @observation cleanup、私有参照、poisonおよびProvider開始を確認する。
 * @oracle cleanup=false、manual=true、参照null。Provider開始0でpoisonを要求する。
 * @cleanup N/A: Process外資源を取得しない。
 * @boundary ERB-UT-023=Direct Boundary: 未分類例外→Runtime停止結果。
 */
test("未知の初期化失敗は不存在へ畳まない", async () => {
  const current = fixture({
    createOperation: async () => {
      throw new Error("fixture_unknown_creation");
    },
  });
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.cleanupConfirmed, false);
  assert.deepEqual(classifyProviderAdviceHostFailure(result), {
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    hostRecoveryId: null,
    dockerRecoveryId: null,
  });
  assert.equal(current.calls.includes("poison"), true);
  assert.equal(current.calls.includes("start-process"), false);
});

/**
 * 本番と同じ初期化処理の各失敗段で清掃分類と元参照を保持する。
 *
 * @responsibility 作成、activationおよびreadinessの元失敗から初回結果への接続を反証する。
 * @trace ERB-UT-023
 * @precondition 本番と同じ初期化関数を使用し、全OS依存をメモリ内の偽依存へ固定する。
 * @stimulus 三失敗段それぞれで清掃確認済みと未確認へ分岐する。
 * @observation 初回結果、exact参照、清掃呼出し、Provider開始および公開JSONを確認する。
 * @oracle 三段全てで清掃分類を維持し、未確認だけ元参照を保持する。Provider開始0。
 * @cleanup N/A: 偽Operationだけを用い、Filesystem、Lock、Dockerまたは子Processを取得しない。
 * @boundary ERB-UT-023=Direct Boundary: 本番初期化状態機械→助言Runtime初回結果。
 */
test("作成と世代Lock準備の失敗分類を本番と同じ処理で搬送する", async () => {
  for (const stage of ["creation", "activation", "readiness"] as const) {
    for (const confirmed of [true, false]) {
      let cleanupCalls = 0;
      const operation = createIsolatedProviderOperationCandidate({
        /**
         * 指定段に応じて偽Operationまたは作成失敗を返す。
         *
         * @responsibility createの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle 取得済み固定参照を使い、新しい参照を生成しない。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        create: () => {
          if (stage === "creation") throw initializationFailure(confirmed);
          return Object.freeze({
            owned: Object.freeze({}),
            mountCapability: Object.freeze({}),
            managementCapability: Object.freeze({}),
            operationId: "OP-123456",
            hostRecoveryId: "exact-host-reference-fixture",
          });
        },
        /**
         * 世代Lockのactivation失敗を注入する。
         *
         * @responsibility activateの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle 指定段だけthrowし、それ以外はactivatedを返す。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        activate: async () => {
          if (stage === "activation") throw new Error("fixture_activation");
          return "activated" as const;
        },
        /**
         * 世代Lockのreadiness失敗を注入する。
         *
         * @responsibility confirmReadinessの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle 固定例外を投げ、OS Lockを取得しない。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        confirmReadiness: async () => {
          throw new Error("fixture_readiness");
        },
        /**
         * 失敗試験で喪失観測へ到達しないことを守る。
         *
         * @responsibility observeLossの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle 到達した場合は固定例外を投げる。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        observeLoss: () => {
          throw new Error("fixture_loss_observation_not_expected");
        },
        /**
         * 世代Lock準備失敗後の清掃回数と結果を返す。
         *
         * @responsibility cleanupの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle 一回を計数し、指定falseだけthrowする。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        cleanup: async () => {
          cleanupCalls += 1;
          if (!confirmed) throw new Error("fixture_cleanup_unknown");
          return Object.freeze({
            kind: "owned_operation_cleanup_outcome" as const,
          });
        },
        /**
         * 偽清掃Receiptを分類する。
         *
         * @responsibility classifyCleanupの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle cleanupが返った経路だけcompletedを返す。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        classifyCleanup: () => "completed" as const,
        /**
         * 本番のProcess停止依存を局所試験で分離する。
         *
         * @responsibility poisonの局所反証を所有する。
         * @trace ERB-UT-023
         * @precondition 固定した偽依存と対象段だけを使う。
         * @stimulus 本番と同じ初期化処理から呼び出す。
         * @observation 返値、例外および局所呼出しを観測する。
         * @oracle 実Process状態を変更しない。
         * @cleanup N/A: Process外資源を取得しない。
         * @boundary ERB-UT-023=Direct Boundary: 偽依存→初期化処理。
         */
        poison: () => {},
      });
      let failure: unknown;
      try {
        await operation.create();
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof Error);
      assert.equal(Object.keys(failure).includes("hostFailure"), false);
      assert.equal(
        JSON.stringify(failure).includes("exact-host-reference"),
        false,
      );
      assert.equal(
        JSON.stringify({ ...failure }).includes("exact-host-reference"),
        false,
      );
      const current = fixture({
        /**
         * 本番と同じ初期化境界の元ErrorをRuntimeへ渡す。
         *
         * @responsibility 列挙反証で保持した同じ失敗Objectの分類を消費させる。
         * @trace ERB-UT-023
         * @precondition 初期化境界が元Errorを返却済みである。
         * @stimulus 助言RuntimeからOperation取得を要求する。
         * @observation 同じError Objectをthrowする。
         * @oracle Runtimeの私有分類が清掃結果と元参照を保持する。
         * @cleanup N/A: 追加資源を生成しない。
         * @boundary ERB-UT-023=Direct Boundary: 初期化Error→Runtime catch。
         */
        createOperation: async () => {
          throw failure;
        },
      });
      const result = await createIsolatedProviderAdviceRuntimeCandidate(
        current.dependencies,
      ).run(plan, new AbortController().signal);
      assert.equal(result.status, "blocked");
      assert.equal(result.cleanupConfirmed, confirmed);
      assert.deepEqual(classifyProviderAdviceHostFailure(result), {
        cleanupConfirmed: confirmed,
        manualRecoveryRequired: !confirmed,
        hostRecoveryId: confirmed ? null : "exact-host-reference-fixture",
        dockerRecoveryId: null,
      });
      assert.equal(cleanupCalls, stage === "creation" ? 0 : 1);
      assert.equal(current.calls.includes("start-process"), false);
      assert.equal(
        JSON.stringify(result).includes("exact-host-reference"),
        false,
      );
    }
  }
});

/**
 * 無効なRepository資格から本番助言Operationを作成しない。
 * @responsibility Rootを補完せず固定拒否しPathやAuthorityを公開しない。
 * @trace ERB-UT-023
 * @precondition テスト専用の無効Objectであり本番Root資格ではない。
 * @stimulus 同じ一引数の本番Factoryで未取消と開始前取消のSignalを使う。
 * @observation Root結合拒否と取消優先、Provider Effect非発行、秘密を含まない固定結果。
 * @oracle 署名資格の撤去後も無効RootではProduction依存の構築前に停止する。
 * @cleanup N/A: Root解決失敗の早期返却なのでOperationを作らない。
 * @boundary ERB-UT-023=Unit: 本番助言FactoryのRoot入口。
 */
test("署名資格を要求しない本番助言Factoryも無効Rootを補完しない", async () => {
  const runtime = createRuntimeOwnedProviderAdviceRuntime(
    Object.freeze({}) as Parameters<
      typeof createRuntimeOwnedProviderAdviceRuntime
    >[0],
  );
  const result = await runtime(plan, new AbortController().signal);
  assert.deepEqual(result, {
    status: "blocked",
    reason: "workbench_ai_advice_repository_binding_unavailable",
    adviceJson: null,
    providerEffectIssued: false,
    cleanupConfirmed: true,
  });
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await runtime(plan, controller.signal), {
    status: "blocked",
    reason: "workbench_ai_advice_cancelled_before_runtime_effect",
    adviceJson: null,
    providerEffectIssued: false,
    cleanupConfirmed: true,
  });
});

/**
 * 署名資格を受け取らず開始前取消を処理する。
 * @responsibility Operation・Home・Providerを一つも開始しない。
 * @trace ERB-UT-023
 * @precondition 依存は局所fixtureで、Signalは開始前に取消済み。
 * @stimulus 二引数の助言Runtimeへ取消Signalを渡す。
 * @observation cancelled理由、Effect非発行、依存call空。
 * @oracle 署名Gateの撤去が取消確認を省略しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-UT-023=Unit: 助言の開始境界。
 */
test("署名資格なしでも開始前取消は全依存を呼ばない", async () => {
  const current = fixture();
  const controller = new AbortController();
  controller.abort();
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, controller.signal);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_cancelled_before_runtime_effect",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(current.calls, []);
});

/**
 * 助言Grantの初回と更新で操作・試行・選定Hashの差を拒否する。
 * @responsibility 別操作又は異なる試行の値をProviderへ搬送しない。
 * @trace ERB-UT-023
 * @precondition 既存合成Runtimeの一項目だけを差し替える。
 * @stimulus 初回・更新それぞれ三項目の差を返す。
 * @observation 元Grant失効、Packet／Process呼出しとEffect。
 * @oracle 各差でblocked、Packet／Process／Provider 0かつ取得済みGrantを失効する。
 * @cleanup 同じRuntimeが取得済みOperationとGrantを解放する。
 * @boundary ERB-UT-023=Direct Boundary: 助言Runtime→合成Grant発行境界。
 */
test("助言の初回・更新Grantは別操作・試行・選定HashをEffect前に拒否する", async () => {
  for (const index of [0, 1] as const)
    for (const field of [
      "operationId",
      "taskAttempt",
      "selectionHash",
    ] as const) {
      const current = fixture(
        {},
        { selectionCorrelationMismatch: { index, field } },
      );
      const result = await createIsolatedProviderAdviceRuntimeCandidate(
        current.dependencies,
      ).run(plan, new AbortController().signal);
      assert.equal(result.status, "blocked", index + ":" + field);
      assert.equal(result.providerEffectIssued, false);
      assert.equal(current.calls.includes("issue-packet"), false);
      assert.equal(current.calls.includes("start-process"), false);
      assert.equal(
        current.calls.filter((x) => x === "revoke-selection").length,
        index + 1,
      );
      assert.equal(result.cleanupConfirmed, true);
    }
});

/**
 * 回収不明で停止したProcessから新しい助言を開始しない。
 * @responsibility 旧署名拒否とProcess再起動要求を区別する。
 * @trace ERB-UT-023
 * @precondition このファイルの最終Caseで現在Processを停止状態にする。
 * @stimulus 既存process safety Ownerをpoisonし二引数のRuntimeを呼ぶ。
 * @observation 再起動要求理由、Effect非発行、依存call空。
 * @oracle 署名資格なしでも既存の新Effect抑止を維持する。
 * @cleanup 試験Runnerがこのファイル専用Processを終了する。Poison解除APIは作らない。
 * @boundary ERB-UT-023=Unit: Process safety→助言開始。
 */
test("Process回収不明は署名拒否でなく再起動要求として停止する", async () => {
  const current = fixture();
  poisonRuntimeProcessAfterCleanupUnknown();
  const result = await createIsolatedProviderAdviceRuntimeCandidate(
    current.dependencies,
  ).run(plan, new AbortController().signal);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_process_restart_required");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(current.calls, []);
});
