/**
 * coordinator:integration:docker-process-controllerの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-process-controllerが所有する検証責務を実行する。
 * @trace ERB-IT-002
 * @level IT
 * @scope docker、process、controller
 * @boundary ERB-IT-002=Adjacent 1 Block: Controller→stdio・signal・close→資源Observer
 */
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";
import { bindTaskCliCancellationSignals } from "../../src/cli/task-cli-cancellation.ts";
import type { OwnedCommandHandle } from "../../src/docker-runtime/docker-owned-process.ts";
import {
  borrowRuntimeOwnedDockerTerminalObservations,
  cancelRuntimeOwnedDockerProcessController,
  createIsolatedDockerProcessControllerCandidate,
  createRuntimeOwnedLifecycleNoticeReporter,
  describeDockerProcessControllerContract,
  projectDockerProcessControllerCompletionResult,
  projectDockerProcessControllerStartResult,
  startRuntimeOwnedDockerProcessController,
  verifyRuntimeOwnedDockerUnissuedNotice,
} from "../../src/docker-runtime/docker-process-controller.ts";
import {
  projectRuntimeOwnedDockerProcessCompletionForTask,
  projectRuntimeOwnedDockerProcessStartForTask,
} from "../../src/task/coordinator-task-runtime.ts";
import { createDevelopmentMeasurementConstraints } from "../../src/task/development-measurement-constraints.ts";
import { createOwnedProcessTreeFixture } from "../fixtures/docker-owned-process-test-support.ts";

/**
 * createPlanのTest準備責務を実行する。
 *
 * @responsibility createPlanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createPlanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function createPlan(
  activeMountCapability: object,
  authorityUseCapability: object,
) {
  const suffix = "0101010101010101";
  const purposes = [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ];
  return Object.freeze({
    provider: "claude" as const,
    consumer: "coordinator_cli" as const,
    operationId: "OP-123456",
    grantRef: "PHMGRANT-123456",
    profileId: "PROFILE-123456",
    activeMountCapability,
    authorityUseCapability,
    providerHomeSourcePath: "C:\\runtime-owned\\claude-home",
    providerHomeIdentityHash: "a".repeat(64),
    providerHomeProtectionHash: "b".repeat(64),
    localUserBindingHash: "c".repeat(64),
    stableLogicalHomeBindingHash: "d".repeat(64),
    authContainerName: `crdd-auth-${suffix}`,
    providerContainerName: `crdd-claude-${suffix}`,
    proxyContainerName: `crdd-proxy-${suffix}`,
    internalNetworkName: `crdd-internal-${suffix}`,
    egressNetworkName: `crdd-egress-${suffix}`,
    ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
    providerImageDigest:
      "sha256:9815772cdc09551d2635f8cf15d90077b2da07ee87f4fe83c7c29dd59cb48ec7",
    proxyImageDigest:
      "sha256:f8dad0fbda2d96669dff0a7a0d56864047640af0f4514cbd1383abada91d5d68",
    selectionRecordId: "MODELSEL-12345678",
    subscriptionOffering: "claude_max" as const,
    selectedModel: "opus",
    selectedEffort: "low" as const,
    selectedModelTier: "preferred",
    operationMode: "boolean_probe" as const,
    taskRole: null,
    taskPacketRef: null,
    taskPacketHash: null,
    providerInput: null,
    workspaceSourcePath: null,
    workspaceMountMode: null,
    commands: Object.freeze(
      purposes.map((purpose) =>
        Object.freeze({ purpose, argv: Object.freeze([purpose]) }),
      ),
    ),
  });
}

/**
 * 実Controller出力のstart・handoff・completion相関をproducer所有projectionで固定するを検証する。
 *
 * @responsibility 実Controller出力のstart・handoff・completion相関をproducer所有projectionで固定するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Controller出力のstart・handoff・completion相関をproducer所有projectionで固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("実Controller出力のstart・handoff・completion相関をproducer所有projectionで固定する", async () => {
  const fixture = createFixture();
  let handedOffRecoveryId: unknown = null;
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
    (_capability: unknown, recoveryId: unknown) => {
      handedOffRecoveryId = recoveryId;
      return true;
    },
  );
  const projectedStart = projectDockerProcessControllerStartResult(
    started,
    handedOffRecoveryId,
    "OP-123456",
  );
  assert.ok(projectedStart);
  assert.equal(projectedStart.status, "started");
  const completion = await (projectedStart.completion as Promise<unknown>);
  assert.ok(
    projectRuntimeOwnedDockerProcessStartForTask(
      started,
      handedOffRecoveryId,
      "OP-123456",
    ),
  );
  assert.ok(
    projectRuntimeOwnedDockerProcessCompletionForTask(
      completion,
      handedOffRecoveryId,
      "OP-123456",
    ),
  );
  assert.ok(
    projectDockerProcessControllerCompletionResult(
      completion,
      handedOffRecoveryId,
      "OP-123456",
    ),
  );
  assert.equal(
    projectDockerProcessControllerStartResult(
      Object.freeze({
        ...started,
        recoveryId: `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`,
      }),
      handedOffRecoveryId,
      "OP-123456",
    ),
    null,
  );
  assert.equal(
    projectDockerProcessControllerCompletionResult(
      Object.freeze({
        ...(completion as Readonly<Record<string, unknown>>),
        recoveryId: handedOffRecoveryId,
      }),
      handedOffRecoveryId,
      "OP-123456",
    ),
    null,
  );

  const missing = { ...(completion as Readonly<Record<string, unknown>>) };
  delete missing.selectionRecordId;
  const extra = {
    ...(completion as Readonly<Record<string, unknown>>),
    extra: true,
  };
  const renamed = { ...(completion as Readonly<Record<string, unknown>>) };
  delete renamed.selectionRecordId;
  renamed.selectionId = "MODELSEL-12345678";
  const accessor = { ...(completion as Readonly<Record<string, unknown>>) };
  Object.defineProperty(accessor, "normalizedResult", {
    enumerable: true,
    get: () => {
      throw new Error("accessor_must_not_run");
    },
  });
  let proxyTrapCount = 0;
  const hostileCompletionProxy = new Proxy(completion as object, {
    getOwnPropertyDescriptor: () => {
      proxyTrapCount += 1;
      throw new Error("proxy_trap_must_not_run");
    },
  });
  for (const malformed of [
    missing,
    extra,
    renamed,
    accessor,
    hostileCompletionProxy,
  ]) {
    assert.equal(
      projectDockerProcessControllerCompletionResult(
        malformed,
        handedOffRecoveryId,
        "OP-123456",
      ),
      null,
    );
  }
  assert.equal(proxyTrapCount, 0);

  for (const impossible of [
    {
      cleanupConfirmed: false,
      processTreeTerminationConfirmed: false,
      status: "completed",
      recoveryId: handedOffRecoveryId,
      manualRecoveryRequired: true,
    },
    {
      status: "blocked",
      normalizedResult: Object.freeze({ status: true }),
      resultSha256: "a".repeat(64),
      resultBytes: 1,
    },
    {
      normalizedResult: null,
      resultSha256: null,
      resultBytes: 0,
    },
    { cancellationRequested: true },
    { subscriptionAuthConfirmed: false },
    { operationId: "OP-999999" },
  ]) {
    const malformed = Object.freeze({
      ...(completion as Readonly<Record<string, unknown>>),
      ...impossible,
    });
    for (const projectCompletion of [
      projectDockerProcessControllerCompletionResult,
      projectRuntimeOwnedDockerProcessCompletionForTask,
    ])
      assert.equal(
        projectCompletion(malformed, handedOffRecoveryId, "OP-123456"),
        null,
      );
  }

  const missingStart = { ...started } as Record<string, unknown>;
  delete missingStart.reason;
  const extraStart = { ...started, extra: true };
  const accessorStart = { ...started } as Record<string, unknown>;
  Object.defineProperty(accessorStart, "completion", {
    enumerable: true,
    get: () => {
      throw new Error("accessor_must_not_run");
    },
  });
  const hostileStartProxy = new Proxy(started as object, {
    getOwnPropertyDescriptor: () => {
      proxyTrapCount += 1;
      throw new Error("proxy_trap_must_not_run");
    },
  });
  for (const malformed of [
    missingStart,
    extraStart,
    accessorStart,
    hostileStartProxy,
  ]) {
    assert.equal(
      projectDockerProcessControllerStartResult(
        malformed,
        handedOffRecoveryId,
        "OP-123456",
      ),
      null,
    );
  }
  assert.equal(proxyTrapCount, 0);

  const blockedFixture = createFixture({ verifyRevision: () => false });
  const blockedStart = blockedFixture.controller.start(
    blockedFixture.preparedCapability,
    blockedFixture.managementCapability,
  );
  for (const impossible of [
    { cleanupConfirmed: false, manualRecoveryRequired: false },
    {
      recoveryId: handedOffRecoveryId,
      manualRecoveryRequired: false,
    },
  ]) {
    assert.equal(
      projectDockerProcessControllerStartResult(
        Object.freeze({
          ...blockedStart,
          ...impossible,
        }),
        handedOffRecoveryId,
      ),
      null,
    );
  }
});

/**
 * 実Controllerのclean blockedとmanual blockedをexact projectionするを検証する。
 *
 * @responsibility 実Controllerのclean blockedとmanual blockedをexact projectionするの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Controllerのclean blockedとmanual blockedをexact projectionするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("実Controllerのclean blockedとmanual blockedをexact projectionする", () => {
  const cleanFixture = createFixture({ verifyRevision: () => false });
  const cleanBlocked = cleanFixture.controller.start(
    cleanFixture.preparedCapability,
    cleanFixture.managementCapability,
  );
  assert.equal(cleanBlocked.status, "blocked");
  assert.equal(cleanBlocked.cleanupConfirmed, true);
  assert.ok(projectDockerProcessControllerStartResult(cleanBlocked, null));

  const manualFixture = createFixture({
    beginRecovery: () =>
      Object.freeze({
        status: "blocked",
        reason: "docker_recovery_pending",
        recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
      }),
  });
  const manualBlocked = manualFixture.controller.start(
    manualFixture.preparedCapability,
    manualFixture.managementCapability,
  );
  assert.equal(manualBlocked.status, "blocked");
  assert.equal(manualBlocked.manualRecoveryRequired, true);
  assert.ok(projectDockerProcessControllerStartResult(manualBlocked, null));
});

/**
 * createProviderOutputのTest準備責務を実行する。
 *
 * @responsibility createProviderOutputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createProviderOutputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function createProviderOutput(overrides: Record<string, unknown> = {}) {
  return `${JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 2,
    total_cost_usd: 0.04699,
    structured_output: { status: true },
    ...overrides,
  })}\n`;
}

/**
 * createSubscriptionAuthOutputのTest準備責務を実行する。
 *
 * @responsibility createSubscriptionAuthOutputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createSubscriptionAuthOutputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function createSubscriptionAuthOutput(subscriptionType = "max") {
  return JSON.stringify({
    loggedIn: true,
    authMethod: "claude.ai",
    apiProvider: "firstParty",
    forcedLoginMethod: "claudeai",
    subscriptionType,
  });
}

const completionProjectors = [
  projectDockerProcessControllerCompletionResult,
  projectRuntimeOwnedDockerProcessCompletionForTask,
] as const;

/**
 * assertCompletionAcceptedByAllのTest準備責務を実行する。
 *
 * @responsibility assertCompletionAcceptedByAllがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertCompletionAcceptedByAllを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function assertCompletionAcceptedByAll(value: unknown, recoveryId: unknown) {
  for (const projectCompletion of completionProjectors)
    assert.ok(projectCompletion(value, recoveryId, "OP-123456"));
}

/**
 * assertCompletionRejectedByAllのTest準備責務を実行する。
 *
 * @responsibility assertCompletionRejectedByAllがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertCompletionRejectedByAllを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function assertCompletionRejectedByAll(value: unknown, recoveryId: unknown) {
  for (const projectCompletion of completionProjectors)
    assert.equal(projectCompletion(value, recoveryId, "OP-123456"), null);
}

/**
 * createFixtureのTest準備責務を実行する。
 *
 * @responsibility createFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function createFixture(
  overrides: Record<string, unknown> = {},
  planOverrides: Record<string, unknown> = {},
) {
  const managementCapability = Object.freeze({});
  const preparedCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  const plan = Object.freeze({
    ...createPlan(activeMountCapability, authorityUseCapability),
    ...planOverrides,
  });
  let mountCompletionCount = 0;
  let recoveryCompletionCount = 0;
  let commandCount = 0;
  let cleanupCount = 0;
  const recoveryEvents: string[] = [];
  const recoveryConsumers: unknown[] = [];
  let recordedResourceObservations: unknown = null;
  const resourceObservations = Object.freeze([
    Object.freeze({
      purpose: "create_egress_network" as const,
      plannedResourceName: plan.egressNetworkName,
      dockerId: null,
      observation: "absent" as const,
    }),
    Object.freeze({
      purpose: "create_internal_network" as const,
      plannedResourceName: plan.internalNetworkName,
      dockerId: null,
      observation: "absent" as const,
    }),
    Object.freeze({
      purpose: "create_provider" as const,
      plannedResourceName: plan.providerContainerName,
      dockerId: null,
      observation: "absent" as const,
    }),
    Object.freeze({
      purpose: "create_proxy" as const,
      plannedResourceName: plan.proxyContainerName,
      dockerId: null,
      observation: "absent" as const,
    }),
    Object.freeze({
      purpose: "create_subscription_auth_probe" as const,
      plannedResourceName: plan.authContainerName,
      dockerId: null,
      observation: "absent" as const,
    }),
  ]);
  const dependencies = {
    effectExecutorAvailable: true,
    verifyRevision: () => Object.freeze({ revisionCurrent: true }),
    consumePreparedPlan: (prepared: unknown, management: unknown) => {
      assert.equal(prepared, preparedCapability);
      assert.equal(management, managementCapability);
      return plan;
    },
    beginRecovery: (plan: { consumer: unknown }) => {
      recoveryConsumers.push(plan.consumer);
      return Object.freeze({
        status: "ready" as const,
        recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
        recoveryCapability,
      });
    },
    verifyRecoveryBinding: (
      capability: unknown,
      recoveryId: unknown,
      management: unknown,
      stableHomeHash: unknown,
    ) =>
      capability === recoveryCapability &&
      recoveryId ===
        `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}` &&
      management === managementCapability &&
      stableHomeHash === plan.stableLogicalHomeBindingHash,
    abandonRecovery: (capability: unknown) => capability === recoveryCapability,
    startCommand: (command: { purpose: string }) => {
      commandCount += 1;
      const isProvider = command.purpose === "start_provider_attached";
      const isAuth =
        command.purpose === "start_subscription_auth_probe_attached";
      return Object.freeze({
        started: async () => true,
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout: isProvider
              ? createProviderOutput()
              : isAuth
                ? createSubscriptionAuthOutput()
                : "",
            stderr: "",
            outputExceeded: false,
          }),
        terminateAndWait: async () => true,
      });
    },
    cleanupOwnedResources: async () => {
      cleanupCount += 1;
      return Object.freeze({
        confirmed: true,
        processTreeTerminated: true,
        containersAbsent: true,
        networksAbsent: true,
        resourceObservations,
      });
    },
    completeMount: () => {
      mountCompletionCount += 1;
      return Object.freeze({ status: "completed" });
    },
    completeRecovery: () => {
      recoveryCompletionCount += 1;
      recoveryEvents.push("recovery-completed");
      return Object.freeze({
        status: "completed",
        recoveryFinalizationCapability: Object.freeze({}),
      });
    },
    markResourceSubmission: (_capability: object, purpose: string) => {
      recoveryEvents.push(`submission:${purpose}`);
      return true;
    },
    recordResourceReceipt: (
      _capability: object,
      purpose: string,
      _dockerId: string,
    ) => {
      recoveryEvents.push(`receipt:${purpose}`);
      return true;
    },
    recordDockerAbsence: (_capability: object, observations: unknown) => {
      recordedResourceObservations = observations;
      recoveryEvents.push("docker-absence");
      return true;
    },
    recordMountCompletion: () => {
      recoveryEvents.push("mount-completion");
      return true;
    },
    consumeProviderAuthority: (
      use: unknown,
      active: unknown,
      management: unknown,
    ) => {
      assert.equal(use, authorityUseCapability);
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return Object.freeze({
        operationId: "OP-123456",
        provider: "claude",
        profileId: "PROFILE-123456",
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true as const,
        providerEffectAllowed: true as const,
      });
    },
    ...overrides,
  };
  const controller = createIsolatedDockerProcessControllerCandidate(
    dependencies as Parameters<
      typeof createIsolatedDockerProcessControllerCandidate
    >[0],
  );
  return {
    controller,
    plan,
    recoveryCapability,
    managementCapability,
    preparedCapability,
    getCommandCount: () => commandCount,
    getCleanupCount: () => cleanupCount,
    getMountCompletionCount: () => mountCompletionCount,
    getRecoveryCompletionCount: () => recoveryCompletionCount,
    getRecoveryEvents: () => [...recoveryEvents],
    getRecoveryConsumers: () => [...recoveryConsumers],
    getRecordedResourceObservations: () => recordedResourceObservations,
    resourceObservations,
  };
}

/**
 * Controllerが固定利用側を開始Ownerへ搬送し、未指定・未知用途を拒否する。
 *
 * @responsibility 最新計画の必須利用側とEffect前拒否を確認する。
 * @trace ERB-IT-002
 * @precondition 正規計画・管理Capabilityと模擬実行依存を用意する。
 * @stimulus 三利用側および欠落・未知値の計画をControllerへ渡す。
 * @observation 開始Ownerへ渡された利用側とDocker Command回数を読む。
 * @oracle 正規用途は保持し、欠落・未知用途は開始OwnerとDocker Commandを呼ばない。
 * @cleanup 正規用途の模擬実行は既存終了・回収経路へ収束する。
 * @boundary ERB-IT-002=Direct Boundary: Provider計画→Controller→開始Owner。
 */
test("Controllerは固定利用側を保持し未指定・未知用途をEffect前に拒否する", async () => {
  for (const consumer of ["coordinator_cli", "workbench", "project_runtime"]) {
    const fixture = createFixture({}, { consumer });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(started.status, "started");
    const result = await started.completion;
    assert.equal(result?.status, "completed");
    assert.deepEqual(fixture.getRecoveryConsumers(), [consumer]);
  }
  for (const consumer of [
    undefined,
    null,
    "unknown",
    "transient",
    "durable",
    {},
    0,
  ]) {
    const fixture = createFixture({}, { consumer });
    const result = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "docker_process_controller_plan_invalid");
    assert.deepEqual(fixture.getRecoveryConsumers(), []);
    assert.equal(fixture.getCommandCount(), 0);
  }
});

/**
 * Mountの元完了結果を縮約せず回復Ownerへ渡す。
 *
 * @responsibility 結果Objectの出自を照合できるまま搬送する。
 * @trace ERB-IT-002
 * @precondition 自己生成のControllerと固定Mount結果を使う。
 * @stimulus Mount成功と失敗を実行する。
 * @observation 回復Ownerへ搬送された結果と呼出し回数を確認する。
 * @oracle 成功は元Objectそのものを一度渡し、失敗は渡さない。
 * @cleanup N/A: 実DockerやFilesystem資源を作らない。
 * @boundary ERB-IT-002=Direct Boundary: Controller→Mount終了→回復Owner。
 */
test("ControllerはMount元完了結果を同じ回復Ownerへ搬送する", async () => {
  for (const status of ["completed", "blocked"]) {
    const completion = Object.freeze({ status });
    const received: unknown[] = [];
    const fixture = createFixture({
      completeMount: () => completion,
      recordMountCompletion: (_recovery: object, result: unknown) => {
        received.push(result);
        return true;
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    await started.completion;
    assert.equal(received.length, status === "completed" ? 1 : 0);
    if (status === "completed") assert.equal(received[0], completion);
    else assert.equal(fixture.getRecoveryCompletionCount(), 0);
  }
});

/**
 * 終了Ownerへ計画と清掃・Mountの元結果を一緒に搬送する。
 * @responsibility 真正性の再照合に必要な元objectを保持する。
 * @trace ERB-IT-002
 * @precondition 模擬Controllerと自己生成結果を使用する。
 * @stimulus 清掃成功、不一致、Mount失敗と保存失敗を実行する。
 * @observation 終了callbackの引数、同一性、外側freezeと呼出し数。
 * @oracle 成功時だけ同じOwnerと元三objectを渡し、失敗時は呼ばない。
 * @cleanup N/A: 実Docker・Filesystem資源を作成しない。
 * @boundary Controllerから同じ操作の回復終了Owner。
 */
test("終了Ownerへ元清掃とMount結果を縮約せず渡す", async () => {
  for (const mode of [
    "valid",
    "cleanup_invalid",
    "mount_failed",
    "record_failed",
  ]) {
    const cleanup = Object.freeze({
      confirmed: true,
      processTreeTerminated: true,
      containersAbsent: true,
      networksAbsent: true,
    });
    const mount = Object.freeze({
      status: mode === "mount_failed" ? "blocked" : "completed",
    });
    let completed = 0;
    const fixture = createFixture({
      cleanupOwnedResources: async () => cleanup,
      verifyCleanupOutcome: () =>
        mode === "cleanup_invalid" ? null : fixture.resourceObservations,
      completeMount: () => mount,
      recordMountCompletion: () => mode !== "record_failed",
      completeRecovery: (
        recovery: unknown,
        management: unknown,
        context: Readonly<{
          plan: unknown;
          cleanupOutcome: unknown;
          mountCompletion: unknown;
        }>,
      ) => {
        completed += 1;
        assert.equal(recovery, fixture.recoveryCapability);
        assert.equal(management, fixture.managementCapability);
        assert.equal(context.plan, fixture.plan);
        assert.equal(context.cleanupOutcome, cleanup);
        assert.equal(context.mountCompletion, mount);
        assert.ok(Object.isFrozen(context));
        return Object.freeze({
          status: "completed",
          recoveryFinalizationCapability: Object.freeze({}),
        });
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    await started.completion;
    assert.equal(completed, mode === "valid" ? 1 : 0);
  }
});

/**
 * 清掃成功値だけでは回復完了へ進めないことを確認する。
 *
 * @responsibility Controllerの終端経路を実清掃返却の相関検査へ接続する。
 * @trace ERB-IT-002
 * @precondition 成功形の清掃を返す模擬Controllerを使用する。
 * @stimulus 清掃相関検査を不一致または例外にする。
 * @observation Mount完了、回復完了、absence記録と公開結果を確認する。
 * @oracle 相関不成立なら完了処置を発行せず清掃未確認で停止する。
 * @cleanup N/A: Docker・Provider・Filesystemの実資源は作成しない。
 * @boundary ERB-IT-002=Adjacent 1 Block: Controller→実清掃相関→終端処置。
 */
test("Controllerは実清掃相関の不一致と例外で終端完了を拒否する", async () => {
  for (const throws of [false, true]) {
    let verificationCount = 0;
    const fixture = createFixture({
      verifyCleanupOutcome: () => {
        verificationCount += 1;
        if (throws) throw new Error("cleanup_correlation_invalid");
        return null;
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    const result = await started.completion;
    assert.equal(verificationCount, 1);
    assert.ok(result);
    assert.equal(
      result.reason,
      "docker_process_controller_cleanup_unconfirmed",
    );
    assert.equal(fixture.getMountCompletionCount(), 0);
    assert.equal(fixture.getRecoveryCompletionCount(), 0);
    assert.equal(fixture.getRecoveryEvents().includes("docker-absence"), false);
  }
});

/**
 * 完了後の終端観測を同じ結果へ保持する。
 *
 * @responsibility 制御Contextの終了後も観測が残り、別操作へ流用されないことを確認する。
 * @trace ERB-IT-002
 * @precondition 独立Controllerと五purpose観測を使う。
 * @stimulus 完了後に元結果、コピー、別管理Capabilityと別回復参照を借用する。
 * @observation 保持観測、取消結果と本番Ownerの拒否を確認する。
 * @oracle 元結果・同じ相関だけに観測が残り、終了済み制御は復活しない。
 * @cleanup N/A: Docker・Provider・Filesystemの実資源は作成しない。
 * @boundary ERB-IT-002=Adjacent 1 Block: Controller完了→終端借用。
 */
test("完了後の終端観測は元結果と同じ操作相関だけへ保持する", async () => {
  const fixture = createFixture();
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  const recoveryId = started.recoveryId;
  const borrowed = fixture.controller.borrowTerminalObservations(
    result,
    fixture.managementCapability,
    "OP-123456",
    recoveryId,
  );
  assert.ok(borrowed);
  assert.equal(borrowed.resources, fixture.resourceObservations);
  assert.equal(borrowed.primaryFailure, null);
  assert.equal(borrowed.mountLeaseReleased, true);
  assert.equal(borrowed.recoveryCompleted, true);
  assert.equal(borrowed.homeLeaseReleased, false);
  assert.equal(
    fixture.controller.borrowTerminalObservations(
      { ...result },
      fixture.managementCapability,
      "OP-123456",
      recoveryId,
    ),
    null,
  );
  assert.equal(
    fixture.controller.borrowTerminalObservations(
      result,
      {},
      "OP-123456",
      recoveryId,
    ),
    null,
  );
  assert.equal(
    fixture.controller.borrowTerminalObservations(
      result,
      fixture.managementCapability,
      "OP-654321",
      recoveryId,
    ),
    null,
  );
  assert.equal(
    fixture.controller.borrowTerminalObservations(
      result,
      fixture.managementCapability,
      "OP-123456",
      "other",
    ),
    null,
  );
  assert.equal(
    borrowRuntimeOwnedDockerTerminalObservations(
      result,
      fixture.managementCapability,
      "OP-123456",
      recoveryId,
    ),
    null,
  );
  assert.equal(
    (
      await fixture.controller.cancel(
        started.controlCapability,
        fixture.managementCapability,
      )
    ).status,
    "blocked",
  );
});

/**
 * Home解放と回復全体の完了を別の事実として搬送する。
 *
 * @responsibility 解放不明を肯定せず、解放後の失敗で実解放を消さないことを確認する。
 * @trace ERB-IT-002
 * @precondition 独立Controllerの実行と五purposeの終端観測を使用する。
 * @stimulus 回復完了を失敗させ、Home解放照合へfalse、例外、trueを返す。
 * @observation 元の完了結果、全清掃状態、終端借用の解放・回復状態。
 * @oracle trueの解放だけを保持し、全ケースで回復と全清掃は未完了である。
 * @cleanup 独立Fixtureは外部Process、Docker、Filesystem資源を作成しない。
 * @boundary Controllerから同じ操作の終端観測搬送。
 */
test("Home解放の実観測は回復後続失敗と区別し照合例外を肯定しない", async () => {
  for (const release of ["unknown", "throws", "released"]) {
    let verified = 0;
    const fixture = createFixture({
      completeRecovery: () => Object.freeze({ status: "blocked" }),
      verifyHomeLeaseRelease: (
        recoveryCapability: unknown,
        managementCapability: unknown,
        operationId: unknown,
        recoveryId: unknown,
      ) => {
        verified += 1;
        assert.ok(recoveryCapability);
        assert.equal(managementCapability, fixture.managementCapability);
        assert.equal(operationId, "OP-123456");
        assert.equal(recoveryId, started.recoveryId);
        if (release === "throws")
          throw new Error("release_observation_unknown");
        return release === "released";
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    const result = await started.completion;
    assert.ok(result);
    assert.equal(verified, 1);
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.status, "blocked");
    const observation = fixture.controller.borrowTerminalObservations(
      result,
      fixture.managementCapability,
      "OP-123456",
      started.recoveryId,
    );
    assert.ok(observation);
    assert.equal(observation.recoveryCompleted, false);
    assert.equal(observation.mountLeaseReleased, true);
    assert.equal(observation.homeLeaseReleased, release === "released");
  }
});

const providerStartObservationTaskPlan = {
  operationMode: "isolated_task",
  taskRole: "reviewer",
  taskWorkload: {
    readPathCount: 1,
    allowedPathCount: 1,
    acceptanceCriterionCount: 1,
    remediationFindingCount: 0,
  },
  taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
  taskPacketHash: "c".repeat(64),
  providerInput: "Review the exact local candidate.",
  workspaceSourcePath: "C:\\runtime-owned\\workspace",
  workspaceMountMode: "read_only",
} as const;
const providerStartObservationTaskOutput = createProviderOutput({
  structured_output: undefined,
  result: JSON.stringify({
    decision: "approved",
    summary: "The exact candidate is acceptable.",
    findings: [],
  }),
});

/**
 * 作成境界の一次失敗を清掃結果から分離して検証する。
 *
 * @responsibility 要求前例外、応答、期限超過、記録失敗を区別し原因の上書きを拒否する。
 * @trace ERB-IT-002
 * @precondition 自己生成のController fixtureだけを使用する。
 * @stimulus 作成境界の各段階と清掃の成功・失敗・例外を組み合わせる。
 * @observation 終了診断、最終結果と後続Command件数を取得する。
 * @oracle 一次失敗は清掃状態によらず不変で、清掃不明時の安全結果を維持する。
 * @cleanup N/A: Docker、ProviderやFilesystem資源を作成しない。
 * @boundary ERB-IT-002=Adjacent 1 Block: Controller→Command／清掃Adapter→診断
 */
test("作成境界の一次失敗を清掃結果から分離する", async () => {
  const scenarios = [
    "submission_false",
    "submission_throw",
    "start_throw",
    "wait_throw",
    "timeout",
    "timeout_termination_throw",
    "nonzero",
    "receipt_false",
    "receipt_throw",
    "secret_exception",
  ];
  for (const scenario of scenarios) {
    for (const cleanupMode of ["complete", "unknown", "throw"]) {
      const notices: Array<Record<string, unknown>> = [];
      let startCount = 0;
      const fixture = createFixture({
        reportProviderBoundaryDiagnostic: (notice: Record<string, unknown>) => {
          notices.push(notice);
        },
        markResourceSubmission: () => {
          if (scenario === "submission_throw") throw new Error("EACCES");
          return scenario !== "submission_false";
        },
        startCommand: () => {
          startCount += 1;
          if (scenario === "start_throw")
            throw new Error("docker_effect_plan_invalid");
          if (scenario === "secret_exception")
            throw new Error("secret-value-must-not-escape");
          return {
            started: async () => true,
            wait: async () => {
              if (scenario === "wait_throw") throw new Error("ECONNREFUSED");
              if (scenario.startsWith("timeout")) return null;
              return {
                status: scenario === "nonzero" ? 1 : 0,
                signal: null,
                stdout: "fixed-id",
                stderr: "secret-value-must-not-escape",
                outputExceeded: false,
              };
            },
            terminateAndWait: async () => {
              if (scenario === "timeout_termination_throw")
                throw new Error("EPIPE");
              return true;
            },
          };
        },
        recordResourceReceipt: () => {
          if (scenario === "receipt_throw") throw new Error("EPERM");
          return false;
        },
        cleanupOwnedResources: async () => {
          if (cleanupMode === "throw") throw new Error("secret-cleanup-error");
          return {
            confirmed: cleanupMode === "complete",
            processTreeTerminated: cleanupMode === "complete",
            containersAbsent: cleanupMode === "complete",
            networksAbsent: cleanupMode === "complete",
            resourceObservations: fixture.resourceObservations,
          };
        },
      });
      const started = fixture.controller.start(
        fixture.preparedCapability,
        fixture.managementCapability,
      );
      const result = await started.completion;
      assert.ok(result);
      assert.equal(startCount, scenario.startsWith("submission") ? 0 : 1);
      const settled = notices.find(
        (notice) => notice.event === "coordinator_provider_boundary_settled",
      );
      assert.ok(settled);
      const primary = settled.primaryFailure as Record<string, unknown>;
      const terminal = fixture.controller.borrowTerminalObservations(
        result,
        fixture.managementCapability,
        fixture.plan.operationId,
        started.recoveryId,
      );
      if (cleanupMode === "throw") {
        assert.equal(terminal, null);
      } else {
        assert.ok(terminal);
        assert.equal(terminal.primaryFailure, primary);
        assert.equal(terminal.resources, fixture.resourceObservations);
      }
      assert.equal(primary.purpose, "create_subscription_auth_probe");
      assert.equal(
        primary.stage,
        scenario.startsWith("submission")
          ? "submission_record"
          : scenario === "start_throw" || scenario === "secret_exception"
            ? "command_start"
            : scenario === "wait_throw"
              ? "command_wait"
              : scenario.startsWith("receipt")
                ? "resource_receipt_record"
                : "execution_classification",
      );
      assert.equal(
        primary.reason,
        scenario === "submission_false"
          ? "docker_resource_submission_record_unavailable"
          : scenario === "receipt_false"
            ? "docker_resource_receipt_unavailable"
            : scenario.startsWith("timeout")
              ? "docker_setup_deadline_exceeded"
              : scenario === "nonzero"
                ? "docker_setup_create_subscription_auth_probe_failed"
                : "docker_process_controller_execution_failed_closed",
      );
      assert.equal(
        primary.commandHandleObtained,
        !scenario.startsWith("submission") &&
          scenario !== "start_throw" &&
          scenario !== "secret_exception",
      );
      assert.equal(
        primary.responseObserved,
        scenario === "nonzero" || scenario.startsWith("receipt"),
      );
      assert.equal(primary.receiptRecorded, false);
      assert.equal(settled.cleanupConfirmed, cleanupMode === "complete");
      if (cleanupMode !== "complete")
        assert.equal(
          result.reason,
          "docker_process_controller_cleanup_unconfirmed",
        );
      assert.equal(JSON.stringify(settled).includes("secret-"), false);
      if (scenario === "start_throw")
        assert.equal(primary.exceptionCode, "docker_effect_plan_invalid");
      if (scenario === "secret_exception")
        assert.equal(primary.exceptionCode, "unclassified_exception");
      if (scenario === "timeout_termination_throw")
        assert.equal(primary.exceptionCode, null);
    }
  }
});

/**
 * Workbench助言出力をcleanup後の助言JSONへ縮約することを検証する。
 *
 * @responsibility 第3実行モードのPlan受理、Provider Envelope除去および終了後公開境界を判定する。
 * @trace ERB-IT-002
 * @precondition 有効なAdvice Packet IdentityとClaude二Turn出力を使用する。
 * @stimulus Process Controllerでworkbench_advice Planを完了する。
 * @observation completionのstatus、cleanupおよびnormalizedResultを観測する。
 * @oracle 生Envelopeを含めずadviceJsonだけをcleanup確認後に返す。
 * @cleanup fixtureが全資源不存在とMount解放を確認する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Workbench助言出力をcleanup後の助言JSONへ縮約する", async () => {
  const advice = {
    contract: "crdd-coordinator/workbench-ai-advice-result",
    contractRevision: 1,
    status: "completed",
    facts: [
      { text: "Current state is visible.", references: ["PROJECT_CONTEXT.md"] },
    ],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  };

  const fixture = createFixture(
    {
      startCommand: (command: { purpose: string }) => {
        const isProvider = command.purpose === "start_provider_attached";
        const isAuth =
          command.purpose === "start_subscription_auth_probe_attached";
        return Object.freeze({
          started: async () => true,
          wait: async () =>
            Object.freeze({
              status: 0,
              signal: null,
              stdout: isProvider
                ? createProviderOutput({
                    num_turns: 2,
                    structured_output: advice,
                  })
                : isAuth
                  ? createSubscriptionAuthOutput()
                  : "",
              stderr: "",
              outputExceeded: false,
            }),
          terminateAndWait: async () => true,
        });
      },
    },
    {
      operationMode: "workbench_advice",
      taskRole: null,
      taskPacketRef: null,
      taskPacketHash: null,
      advicePacketRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
      advicePacketHash: "a".repeat(64),
      adviceCommandHash: "b".repeat(64),
      providerInput: "Give advice from the supplied projection.",
      workspaceSourcePath: null,
      workspaceMountMode: null,
    },
  );
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(started.status, "started");
  const completion = await started.completion;
  assert.equal(completion.status, "completed");
  assert.deepEqual(completion.normalizedResult, {
    contract: "crdd-coordinator/workbench-ai-advice-provider-output",
    contractRevision: 1,
    adviceJson: JSON.stringify(advice),
  });
  assert.equal(completion.cleanupConfirmed, true);
});

/**
 * 助言抽出の固定拒否理由を清掃後に上位へ搬送する。
 *
 * @responsibility 不正Claude Envelopeの具体的理由を一般理由へ丸めず、成功本文を公開せずに帰還することを確認する。
 * @trace ERB-IT-002
 * @precondition 実Controllerへ助言Planと正常終了する不正Envelopeを渡す。
 * @stimulus Provider実行を完了し、所有資源のcleanupを観測する。
 * @observation completionの状態、理由、正規化結果とcleanupを取得する。
 * @oracle blockedとexact拒否理由を保持し、normalizedResultはnull、cleanupは確認済みである。
 * @cleanup fixtureで所有Process、Container、NetworkおよびMount不存在を観測する。
 * @boundary ERB-IT-002=Direct Boundary: Provider抽出→Controller→公開結果
 */
test("助言抽出の固定拒否理由を清掃後に上位へ搬送する", async () => {
  const cases = [
    ["null", "workbench_ai_claude_envelope_invalid"],
    ["{}", "workbench_ai_claude_completion_invalid"],
    [
      '{"type":"result","subtype":"success","is_error":false}',
      "workbench_ai_claude_turn_count_invalid",
    ],
    [
      '{"type":"result","subtype":"success","is_error":false,"num_turns":1}',
      "workbench_ai_claude_metadata_invalid",
    ],
    [
      '{"type":"result","subtype":"success","is_error":false,"num_turns":1,"total_cost_usd":0}',
      "workbench_ai_claude_structured_output_invalid",
    ],
  ] as const;
  for (const [raw, reason] of cases) {
    const fixture = createFixture(
      {
        startCommand: (command: { purpose: string }) => ({
          started: async () => true,
          wait: async () => ({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_provider_attached"
                ? raw
                : command.purpose === "start_subscription_auth_probe_attached"
                  ? createSubscriptionAuthOutput()
                  : "",
            stderr: "",
            outputExceeded: false,
          }),
          terminateAndWait: async () => true,
        }),
      },
      {
        operationMode: "workbench_advice",
        taskRole: null,
        taskPacketRef: null,
        taskPacketHash: null,
        advicePacketRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
        advicePacketHash: "a".repeat(64),
        adviceCommandHash: "b".repeat(64),
        providerInput: "Give advice from the supplied projection.",
        workspaceSourcePath: null,
        workspaceMountMode: null,
      },
    );
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(started.status, "started");
    const completion = await started.completion;
    assert.equal(completion.status, "blocked");
    assert.equal(completion.reason, reason);
    assert.equal(completion.normalizedResult, null);
    assert.equal(completion.cleanupConfirmed, true);
  }
});

/**
 * Provider実ProcessのOS起動確認後だけRuntime所有の開始観測を公開するを検証する。
 *
 * @responsibility Provider実ProcessのOS起動確認後だけRuntime所有の開始観測を公開するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider実ProcessのOS起動確認後だけRuntime所有の開始観測を公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows Process Gate: Provider実ProcessのOS起動確認後だけRuntime所有の開始観測を公開する", async () => {
  const notices: unknown[] = [];
  const fixture = createFixture(
    {
      startCommand: (command: { purpose: string }) => ({
        started: async () => true,
        wait: async () => ({
          status: 0,
          signal: null,
          stdout:
            command.purpose === "start_provider_attached"
              ? providerStartObservationTaskOutput
              : command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => true,
      }),
      reportProviderProcessStarted: async (notice: unknown) => {
        notices.push(notice);
        return true;
      },
    },
    providerStartObservationTaskPlan,
  );
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.status, "completed");
  assert.deepEqual(notices, [
    {
      event: "coordinator_provider_process_started",
      taskRole: "reviewer",
      provider: "claude",
      operationId: "OP-123456",
    },
  ]);
});

/**
 * Provider境界診断は実行構成とProcess・cleanup観測を本文なしで分離するを検証する。
 *
 * @responsibility Provider境界診断は実行構成とProcess・cleanup観測を本文なしで分離するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider境界診断は実行構成とProcess・cleanup観測を本文なしで分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider境界診断は実行構成とProcess・cleanup観測を本文なしで分離する", async () => {
  const notices: unknown[] = [];
  const purposes = [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ];
  const fixture = createFixture(
    {
      consumeProviderAuthority: () =>
        Object.freeze({
          operationId: "OP-123456",
          provider: "codex",
          profileId: "PROFILE-123456",
          providerHomeMountGrantRef: "PHMGRANT-123456",
          runtimeAuthorityIssued: true as const,
          providerEffectAllowed: true as const,
        }),
      startCommand: (command: { purpose: string }) => ({
        started: async () => true,
        wait: async () => ({
          status: command.purpose === "start_provider_attached" ? 127 : 0,
          signal: null,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? "Logged in using ChatGPT"
              : command.purpose.startsWith("create_")
                ? "docker-id"
                : "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => true,
      }),
      reportProviderBoundaryDiagnostic: async (notice: unknown) => {
        notices.push(notice);
        return true;
      },
    },
    {
      provider: "codex",
      subscriptionOffering: "chatgpt_subscription_oauth",
      ...providerStartObservationTaskPlan,
      taskRole: "executor",
      workspaceMountMode: "read_write",
      commands: Object.freeze(
        purposes.map((purpose) =>
          Object.freeze({
            purpose,
            argv: Object.freeze(
              purpose === "create_provider"
                ? [
                    "create",
                    "--read-only",
                    "--user",
                    "65534:65534",
                    "--workdir=/work",
                    "image",
                    "exec",
                    "--approve-for-me",
                  ]
                : [purpose],
            ),
          }),
        ),
      ),
    },
  );

  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_process_exit_nonzero");
  assert.deepEqual(notices, [
    {
      event: "coordinator_provider_boundary_configured",
      taskRole: "executor",
      provider: "codex",
      operationId: "OP-123456",
      approvalModeConfigured: "approve_for_me",
      sandboxModeConfigured: "implicit",
      workspaceMountModeConfigured: "read_write",
      rootFilesystemReadOnlyConfigured: true,
      nonRootUserConfigured: true,
      workdirConfigured: true,
    },
    {
      event: "coordinator_provider_boundary_settled",
      taskRole: "executor",
      provider: "codex",
      operationId: "OP-123456",
      providerContainerCreatedObserved: true,
      providerProcessStartedObserved: true,
      providerProcessCompletionObserved: true,
      providerProcessExitStatusClass: "one_two_seven",
      processTreeTerminationObserved: true,
      containersAbsentObserved: true,
      networksAbsentObserved: true,
      cleanupConfirmed: true,
      primaryFailure: {
        purpose: "start_provider_attached",
        stage: "execution_classification",
        reason: "provider_process_exit_nonzero",
        exceptionCode: null,
        commandHandleObtained: true,
        responseObserved: true,
        receiptRecorded: false,
      },
    },
  ]);
});

/**
 * Provider境界診断の失敗はAuthority・Effect・完了結果を変更しないを検証する。
 *
 * @responsibility Provider境界診断の失敗はAuthority・Effect・完了結果を変更しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider境界診断の失敗はAuthority・Effect・完了結果を変更しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider境界診断の失敗はAuthority・Effect・完了結果を変更しない", async () => {
  const fixture = createFixture({
    reportProviderBoundaryDiagnostic: async () => {
      throw new Error("diagnostic_sink_unavailable");
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "provider_operation_completed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(fixture.getCommandCount(), 9);
});

/**
 * Provider commandの同期起動失敗を実Process開始として公開しないを検証する。
 *
 * @responsibility Provider commandの同期起動失敗を実Process開始として公開しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider commandの同期起動失敗を実Process開始として公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider commandの同期起動失敗を実Process開始として公開しない", async () => {
  const notices: unknown[] = [];
  const fixture = createFixture(
    {
      startCommand: (command: { purpose: string }) => {
        if (command.purpose === "start_provider_attached")
          throw new Error("fixed_provider_start_failure");
        return {
          started: async () => true,
          wait: async () => ({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : "",
            stderr: "",
            outputExceeded: false,
          }),
          terminateAndWait: async () => true,
        };
      },
      reportProviderProcessStarted: async (notice: unknown) => {
        notices.push(notice);
        return true;
      },
    },
    providerStartObservationTaskPlan,
  );
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_process_controller_execution_failed_closed",
  );
  assert.equal(result.providerRequestStarted, false);
  assert.deepEqual(notices, []);
});

/**
 * Provider commandの非同期起動失敗も開始観測とProvider Effectへ昇格しないを検証する。
 *
 * @responsibility Provider commandの非同期起動失敗も開始観測とProvider Effectへ昇格しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider commandの非同期起動失敗も開始観測とProvider Effectへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider commandの非同期起動失敗も開始観測とProvider Effectへ昇格しない", async () => {
  const notices: unknown[] = [];
  let providerTerminationCount = 0;
  const fixture = createFixture(
    {
      startCommand: (command: { purpose: string }) => ({
        started: async () => command.purpose !== "start_provider_attached",
        wait: async () => ({
          status: 0,
          signal: null,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? createSubscriptionAuthOutput()
              : "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => {
          if (command.purpose === "start_provider_attached")
            providerTerminationCount += 1;
          return true;
        },
      }),
      reportProviderProcessStarted: async (notice: unknown) => {
        notices.push(notice);
        return true;
      },
    },
    providerStartObservationTaskPlan,
  );
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_process_controller_provider_start_failed",
  );
  assert.equal(result.providerRequestStarted, false);
  assert.deepEqual(notices, []);
  assert.equal(providerTerminationCount, 1);
  assert.equal(result.cleanupConfirmed, true);
});

/**
 * Lifecycle通知はbackpressureを失敗とせずwrite完了を待ち、close先着を拒否するを検証する。
 *
 * @responsibility Lifecycle通知はbackpressureを失敗とせずwrite完了を待ち、close先着を拒否するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lifecycle通知はbackpressureを失敗とせずwrite完了を待ち、close先着を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Lifecycle通知はbackpressureを失敗とせずwrite完了を待ち、close先着を拒否する", async () => {
  const notice = {
    event: "coordinator_provider_process_started" as const,
    taskRole: "executor" as const,
    provider: "codex" as const,
    operationId: "OP-123456",
  };
  let written = "";
  const backpressured = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, callback) {
      written += chunk.toString("utf8");
      setImmediate(callback);
    },
  });
  assert.equal(
    await createRuntimeOwnedLifecycleNoticeReporter(backpressured)(notice),
    true,
  );
  assert.match(written, /^\[Coordinator lifecycle\] /u);
  backpressured.end();

  const closesBeforeWrite = new Writable({
    write(_chunk, _encoding, _callback) {
      // Keep the callback pending so close is the first observable outcome.
    },
  });
  const reported =
    createRuntimeOwnedLifecycleNoticeReporter(closesBeforeWrite)(notice);
  closesBeforeWrite.destroy();
  assert.equal(await reported, false);

  const writeFails = new Writable({
    write(_chunk, _encoding, callback) {
      callback(new Error("fixed_notice_write_failure"));
    },
  });
  assert.equal(
    await createRuntimeOwnedLifecycleNoticeReporter(writeFails)(notice),
    false,
  );
});

/**
 * Provider開始失敗を後続の終了例外で上書きしないことを検証する。
 *
 * @responsibility 開始確認と開始通知の一次失敗の保持を判定する。
 * @trace ERB-IT-002
 * @precondition 外部操作を発行しない決定論的fixtureを使用する。
 * @stimulus 開始失敗後の終了処理で例外を発生させる。
 * @observation 一次失敗と清掃結果を別々に観測する。
 * @oracle 一次失敗の理由が終了例外によって変わらない。
 * @cleanup fixtureのみで実資源を作成しない。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider開始失敗を後続の終了例外で上書きしない", async () => {
  for (const scenario of ["start_failed", "notice_failed"]) {
    for (const confirmed of [true, false]) {
      const notices: Array<Record<string, unknown>> = [];
      const fixture = createFixture(
        {
          reportProviderBoundaryDiagnostic: (
            notice: Record<string, unknown>,
          ) => {
            notices.push(notice);
          },
          reportProviderProcessStarted: async () => false,
          startCommand: (command: { purpose: string }) => ({
            started: async () =>
              command.purpose !== "start_provider_attached" ||
              scenario !== "start_failed",
            wait: async () => ({
              status: 0,
              signal: null,
              stdout:
                command.purpose === "start_subscription_auth_probe_attached"
                  ? createSubscriptionAuthOutput()
                  : "",
              stderr: "",
              outputExceeded: false,
            }),
            terminateAndWait: async () => {
              throw new Error("EPIPE");
            },
          }),
          cleanupOwnedResources: async () => ({
            confirmed,
            processTreeTerminated: confirmed,
            containersAbsent: confirmed,
            networksAbsent: confirmed,
          }),
        },
        providerStartObservationTaskPlan,
      );
      const result = await fixture.controller.start(
        fixture.preparedCapability,
        fixture.managementCapability,
      ).completion;
      assert.ok(result);
      const settled = notices.find(
        (notice) => notice.event === "coordinator_provider_boundary_settled",
      );
      assert.ok(settled);
      const primary = settled.primaryFailure as Record<string, unknown>;
      assert.equal(primary.purpose, "start_provider_attached");
      assert.equal(
        primary.reason,
        scenario === "start_failed"
          ? "docker_process_controller_provider_start_failed"
          : "docker_process_controller_provider_start_observation_failed",
      );
      assert.equal(primary.exceptionCode, null);
      assert.equal(settled.cleanupConfirmed, confirmed);
    }
  }
});

/**
 * 実Process開始観測を公開できなければ対象Processを終了して成功を返さないを検証する。
 *
 * @responsibility 実Process開始観測を公開できなければ対象Processを終了して成功を返さないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Process開始観測を公開できなければ対象Processを終了して成功を返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("実Process開始観測を公開できなければ対象Processを終了して成功を返さない", async () => {
  let providerTerminationCount = 0;
  const fixture = createFixture(
    {
      startCommand: (command: { purpose: string }) => ({
        started: async () => true,
        wait: async () => ({
          status: 0,
          signal: null,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? createSubscriptionAuthOutput()
              : command.purpose === "start_provider_attached"
                ? providerStartObservationTaskOutput
                : "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => {
          if (command.purpose === "start_provider_attached")
            providerTerminationCount += 1;
          return true;
        },
      }),
      reportProviderProcessStarted: async () => false,
    },
    providerStartObservationTaskPlan,
  );
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_process_controller_provider_start_observation_failed",
  );
  assert.equal(result.providerRequestStarted, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(providerTerminationCount, 1);
});

const cancellationCreatePurposes = [
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
] as const;

type CreateCancellationOutcome =
  | "valid"
  | "invalid_id"
  | "receipt_false"
  | "receipt_throw"
  | "null"
  | "nonzero"
  | "signal"
  | "output_limit";

/**
 * runCreateCancellationRaceのTest準備責務を実行する。
 *
 * @responsibility runCreateCancellationRaceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runCreateCancellationRaceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
async function runCreateCancellationRace(
  purpose: (typeof cancellationCreatePurposes)[number],
  outcome: CreateCancellationOutcome,
  cleanupConfirmed: boolean,
  shouldCancelDuringReceipt = false,
) {
  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  let releaseWait!: () => void;
  const waitGate = new Promise<void>((resolve) => {
    releaseWait = resolve;
  });
  const dockerId = "1".repeat(64);
  const commands: string[] = [];
  const receipts: Array<{ purpose: string; id: string }> = [];
  const events: string[] = [];
  let terminationCount = 0;
  let cancellation: Promise<unknown> | null = null;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      commands.push(command.purpose);
      return {
        started: async () => true,
        wait: async () => {
          if (command.purpose === purpose) {
            markReady();
            await waitGate;
            if (outcome === "null") return null;
          }
          const isTarget = command.purpose === purpose;
          return {
            status: isTarget && outcome === "nonzero" ? 1 : 0,
            signal: isTarget && outcome === "signal" ? "SIGTERM" : null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : isTarget && outcome === "invalid_id"
                  ? "invalid"
                  : `${dockerId}\n`,
            stderr: "",
            outputExceeded: isTarget && outcome === "output_limit",
          };
        },
        terminateAndWait: async () => {
          terminationCount += 1;
          return true;
        },
      };
    },
    recordResourceReceipt: (
      _capability: object,
      currentPurpose: string,
      id: string,
    ) => {
      receipts.push({ purpose: currentPurpose, id });
      events.push(`receipt:${currentPurpose}`);
      if (currentPurpose !== purpose) return true;
      if (shouldCancelDuringReceipt)
        cancellation = fixture.controller.cancel(
          started.controlCapability,
          fixture.managementCapability,
        );
      if (outcome === "receipt_throw") throw new Error("fixed-receipt-failure");
      // Explicit fixture response, not a replacement for the durable store validator.
      return outcome !== "receipt_false" && id === `${dockerId}\n`;
    },
    cleanupOwnedResources: async () => {
      events.push("cleanup");
      if (outcome === "valid") {
        assert.deepEqual(
          receipts.filter((entry) => entry.purpose === purpose),
          [{ purpose, id: `${dockerId}\n` }],
        );
      }
      return {
        confirmed: cleanupConfirmed,
        processTreeTerminated: true,
        containersAbsent: cleanupConfirmed,
        networksAbsent: cleanupConfirmed,
      };
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(started.status, "started");
  await ready;
  if (!shouldCancelDuringReceipt)
    cancellation = fixture.controller.cancel(
      started.controlCapability,
      fixture.managementCapability,
    );
  releaseWait();
  const result = await started.completion;
  await cancellation;
  assert.ok(result);
  assert.equal(result.cancellationRequested, true);
  assert.deepEqual(
    commands,
    createPlan({}, {})
      .commands.map((entry) => entry.purpose)
      .slice(0, commands.indexOf(purpose) + 1),
  );
  assert.equal(commands.at(-1), purpose);
  const targetReceipts = receipts.filter((entry) => entry.purpose === purpose);
  assert.equal(
    targetReceipts.length,
    ["null", "nonzero", "signal", "output_limit"].includes(outcome) ? 0 : 1,
  );
  assert.equal(events.at(-1), "cleanup");
  assert.equal(result.cleanupConfirmed, cleanupConfirmed);
  assert.equal(result.manualRecoveryRequired, !cleanupConfirmed);
  assert.equal(fixture.getMountCompletionCount(), cleanupConfirmed ? 1 : 0);
  assert.equal(fixture.getRecoveryCompletionCount(), cleanupConfirmed ? 1 : 0);
  assert.equal(result.recoveryId, cleanupConfirmed ? null : started.recoveryId);
  if (outcome === "null") assert.ok(terminationCount >= 1);
  return result;
}

for (const purpose of cancellationCreatePurposes) {
  /**
   * CREATE取消競合は${purpose}の正常IDをcleanup前に保存するを検証する。
   *
   * @responsibility CREATE取消競合は${purpose}の正常IDをcleanup前に保存するの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus CREATE取消競合は${purpose}の正常IDをcleanup前に保存するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`CREATE取消競合は${purpose}の正常IDをcleanup前に保存する`, async () => {
    const result = await runCreateCancellationRace(purpose, "valid", true);
    assert.equal(result.status, "cancelled");
    assert.equal(result.reason, "provider_operation_cancelled");
  });
  /**
   * CREATE取消競合は${purpose}のreceipt中取消でも次を発行しないを検証する。
   *
   * @responsibility CREATE取消競合は${purpose}のreceipt中取消でも次を発行しないの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus CREATE取消競合は${purpose}のreceipt中取消でも次を発行しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`CREATE取消競合は${purpose}のreceipt中取消でも次を発行しない`, async () => {
    const result = await runCreateCancellationRace(
      purpose,
      "valid",
      true,
      true,
    );
    assert.equal(result.status, "cancelled");
    assert.equal(result.reason, "provider_operation_cancelled");
  });
  for (const outcome of ["invalid_id", "receipt_false"] as const) {
    /**
     * CREATE取消競合は${purpose}の${outcome}を回収成功にしないを検証する。
     *
     * @responsibility CREATE取消競合は${purpose}の${outcome}を回収成功にしないの合否判定を所有する。
     * @trace ERB-IT-002
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus CREATE取消競合は${purpose}の${outcome}を回収成功にしないの対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
     */
    test(`CREATE取消競合は${purpose}の${outcome}を回収成功にしない`, async () => {
      const result = await runCreateCancellationRace(purpose, outcome, false);
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        "docker_process_controller_cleanup_unconfirmed",
      );
    });
  }
}

for (const outcome of [
  "invalid_id",
  "receipt_false",
  "receipt_throw",
  "null",
  "nonzero",
  "signal",
  "output_limit",
] as const) {
  /**
   * CREATE取消競合は確認済みcleanupでも${outcome}の失敗理由を保持するを検証する。
   *
   * @responsibility CREATE取消競合は確認済みcleanupでも${outcome}の失敗理由を保持するの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus CREATE取消競合は確認済みcleanupでも${outcome}の失敗理由を保持するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`CREATE取消競合は確認済みcleanupでも${outcome}の失敗理由を保持する`, async () => {
    const result = await runCreateCancellationRace(
      "create_provider",
      outcome,
      true,
    );
    const expectedReasons = {
      invalid_id: "docker_resource_receipt_unavailable",
      receipt_false: "docker_resource_receipt_unavailable",
      receipt_throw: "docker_process_controller_execution_failed_closed",
      null: "docker_setup_deadline_exceeded",
      nonzero: "docker_setup_create_provider_failed",
      signal: "provider_process_signalled",
      output_limit: "provider_output_limit_exceeded",
    };
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, expectedReasons[outcome]);
  });
  /**
   * CREATE取消競合は${outcome}でcleanup不明なら同じ回復義務を保持するを検証する。
   *
   * @responsibility CREATE取消競合は${outcome}でcleanup不明なら同じ回復義務を保持するの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus CREATE取消競合は${outcome}でcleanup不明なら同じ回復義務を保持するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`CREATE取消競合は${outcome}でcleanup不明なら同じ回復義務を保持する`, async () => {
    const result = await runCreateCancellationRace(
      "create_provider",
      outcome,
      false,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "docker_process_controller_cleanup_unconfirmed",
    );
  });
}

/**
 * 追加制約のtrueは既存Authorityを代替せず、不正Capabilityを起動しないを検証する。
 *
 * @responsibility 追加制約のtrueは既存Authorityを代替せず、不正Capabilityを起動しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加制約のtrueは既存Authorityを代替せず、不正Capabilityを起動しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("追加制約のtrueは既存Authorityを代替せず、不正Capabilityを起動しない", () => {
  let restrictionCalls = 0;
  let recoveryCalls = 0;
  /**
   * restrictionのTest準備責務を実行する。
   *
   * @responsibility restrictionがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-002
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus restrictionを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  const restriction = () => {
    restrictionCalls += 1;
    return true;
  };
  const fixture = createFixture({
    consumeProviderAuthority: () => null,
    beginRecovery: () => {
      recoveryCalls += 1;
      return null;
    },
  });
  const result = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
    () => true,
    restriction,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_process_controller_authority_invalid");
  assert.equal(restrictionCalls, 0);
  assert.equal(recoveryCalls, 0);
  assert.equal(fixture.getCommandCount(), 0);
  assert.equal(
    startRuntimeOwnedDockerProcessController({}, {}, () => true, restriction)
      .status,
    "blocked",
  );
});

for (const deniedPurpose of createPlan({}, {}).commands.map(
  (command) => command.purpose,
)) {
  /**
   * 追加制約は${deniedPurpose}直前で停止し、既存cleanupへ戻すを検証する。
   *
   * @responsibility 追加制約は${deniedPurpose}直前で停止し、既存cleanupへ戻すの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 追加制約は${deniedPurpose}直前で停止し、既存cleanupへ戻すの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`追加制約は${deniedPurpose}直前で停止し、既存cleanupへ戻す`, async () => {
    const fixture = createFixture();
    const observedPurposes: string[] = [];
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
      () => true,
      (purpose: string) => {
        observedPurposes.push(purpose);
        return purpose !== deniedPurpose;
      },
    );
    assert.equal(started.status, "started");
    const result = await started.completion;
    assert.ok(result);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "docker_process_controller_execution_restricted",
    );
    assert.equal(result.providerRequestStarted, false);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.manualRecoveryRequired, false);
    assert.equal(result.normalizedResult, null);
    assert.equal(observedPurposes.at(-1), deniedPurpose);
    assert.equal(fixture.getCommandCount(), observedPurposes.length - 1);
    assert.equal(
      fixture.getRecoveryEvents().includes(`submission:${deniedPurpose}`),
      false,
    );
    assert.equal(fixture.getCleanupCount(), 1);
    assert.equal(fixture.getMountCompletionCount(), 1);
    assert.equal(fixture.getRecoveryCompletionCount(), 1);
    for (const projectCompletion of [
      projectDockerProcessControllerCompletionResult,
      projectRuntimeOwnedDockerProcessCompletionForTask,
    ])
      assert.ok(projectCompletion(result, started.recoveryId, "OP-123456"));
  });
}

/**
 * 追加制約は例外・非Boolean・非同期・Proxyを拒否し、例外内容を出さないを検証する。
 *
 * @responsibility 追加制約は例外・非Boolean・非同期・Proxyを拒否し、例外内容を出さないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加制約は例外・非Boolean・非同期・Proxyを拒否し、例外内容を出さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("追加制約は例外・非Boolean・非同期・Proxyを拒否し、例外内容を出さない", async () => {
  let proxyCalls = 0;
  let asyncCalls = 0;
  const secretMarker = "private-restriction-diagnostic";
  for (const restriction of [
    null,
    true,
    () => undefined,
    () => 1,
    () => ({
      // biome-ignore lint/suspicious/noThenProperty: deliberately hostile thenable verifies synchronous refusal without then invocation.
      then: () => {
        throw new Error(secretMarker);
      },
    }),
    () => {
      throw new Error(secretMarker);
    },
    () => Promise.resolve(true),
    () => Promise.reject(new Error(secretMarker)),
    async () => {
      asyncCalls += 1;
      throw new Error(secretMarker);
    },
    new Proxy(() => true, {
      apply: () => {
        proxyCalls += 1;
        return true;
      },
    }),
  ]) {
    const fixture = createFixture();
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
      () => true,
      restriction,
    );
    assert.equal(started.status, "started");
    const result = await started.completion;
    assert.ok(result);
    assert.equal(
      result.reason,
      "docker_process_controller_execution_restricted",
    );
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.providerRequestStarted, false);
    assert.equal(fixture.getCommandCount(), 0);
    assert.equal(fixture.getCleanupCount(), 1);
    assert.equal(JSON.stringify(result).includes(secretMarker), false);
    assert.equal(
      fixture
        .getRecoveryEvents()
        .some((event) => event.startsWith("submission:")),
      false,
    );
  }
  assert.equal(proxyCalls, 0);
  assert.equal(asyncCalls, 0);
});

for (const stop of [
  "none",
  "expired",
  "cancelled",
  "identity_mismatch",
] as const) {
  /**
   * 実測制約をControllerへ接続し、準備待機後の${stop}を起動直前に照合するを検証する。
   *
   * @responsibility 実測制約をControllerへ接続し、準備待機後の${stop}を起動直前に照合するの合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 実測制約をControllerへ接続し、準備待機後の${stop}を起動直前に照合するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`実測制約をControllerへ接続し、準備待機後の${stop}を起動直前に照合する`, async () => {
    let wallTimeMs = 100;
    let bindingSha256 = "1".repeat(64);
    /**
     * observeのTest準備責務を実行する。
     *
     * @responsibility observeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
     * @trace ERB-IT-002
     * @precondition 呼出し元Test Caseが必要な入力を渡す。
     * @stimulus observeを呼び出す。
     * @observation 返却値、生成fixtureまたは観測値を取得する。
     * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
     * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
     */
    const observe = () => ({
      bindingSha256,
      wallTimeMs,
      monotonicTimeMs: wallTimeMs,
    });
    const scopeSha256 = "2".repeat(64);
    const constraints = createDevelopmentMeasurementConstraints(
      {
        bindingSha256,
        expiresAtMs: 1_100,
        tasks: [
          { scopeSha256, executor: "claude", reviewer: "codex" },
          {
            scopeSha256: "3".repeat(64),
            executor: "codex",
            reviewer: "claude",
          },
        ],
      },
      observe(),
    );
    assert.ok(constraints);
    const task = constraints.reserveTask(scopeSha256, observe());
    assert.equal(task.status, "recorded");
    const invocation = constraints.reserveInvocation(
      task.value,
      "claude",
      "executor",
      observe(),
    );
    assert.equal(invocation.status, "recorded");
    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let providerStarts = 0;
    let consumeCalls = 0;
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => {
        if (command.purpose === "start_provider_attached") providerStarts += 1;
        return {
          started: async () => true,
          wait: async () => {
            if (command.purpose === "start_proxy") {
              markReady();
              await gate;
            }
            return {
              status: 0,
              signal: null,
              stdout:
                command.purpose === "start_provider_attached"
                  ? createProviderOutput()
                  : command.purpose === "start_subscription_auth_probe_attached"
                    ? createSubscriptionAuthOutput()
                    : "",
              stderr: "",
              outputExceeded: false,
            };
          },
          terminateAndWait: async () => true,
        };
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
      () => true,
      (purpose: string) => {
        if (purpose !== "start_provider_attached") return true;
        consumeCalls += 1;
        return (
          constraints.consumeInvocation(
            invocation.value,
            task.value,
            "claude",
            "executor",
            observe(),
          ).status === "recorded"
        );
      },
    );
    assert.equal(started.status, "started");
    await ready;
    if (stop === "expired") wallTimeMs = 1_100;
    if (stop === "cancelled") constraints.cancel();
    if (stop === "identity_mismatch") bindingSha256 = "4".repeat(64);
    releaseGate();
    const result = await started.completion;
    assert.ok(result);
    assert.equal(result.status, stop === "none" ? "completed" : "blocked");
    assert.equal(providerStarts, stop === "none" ? 1 : 0);
    assert.equal(consumeCalls, 1);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(fixture.getCleanupCount(), 1);
    assert.equal(constraints.inspect().invocationCount, 1);
    assert.equal(
      constraints.settleInvocation(invocation.value).status,
      "recorded",
    );
    assert.equal(
      constraints.settleTask(task.value, "finished").status,
      "recorded",
    );
    assert.equal(constraints.inspect().productionAuthorityConferred, false);
  });
}

/**
 * 制約内から取消が発生しても新しいcommandを起動しないを検証する。
 *
 * @responsibility 制約内から取消が発生しても新しいcommandを起動しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 制約内から取消が発生しても新しいcommandを起動しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("制約内から取消が発生しても新しいcommandを起動しない", async () => {
  const fixture = createFixture();
  let cancellation: Promise<unknown> | null = null;
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
    () => true,
    (purpose: string) => {
      if (purpose === "start_provider_attached")
        cancellation = fixture.controller.cancel(
          started.controlCapability,
          fixture.managementCapability,
        );
      return true;
    },
  );
  assert.equal(started.status, "started");
  const result = await started.completion;
  await cancellation;
  assert.ok(result);
  assert.equal(result.status, "cancelled");
  assert.equal(result.providerRequestStarted, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(fixture.getCommandCount(), 8);
});

/**
 * 追加制約の拒否後もcleanup不明はRecovery必要として保持するを検証する。
 *
 * @responsibility 追加制約の拒否後もcleanup不明はRecovery必要として保持するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加制約の拒否後もcleanup不明はRecovery必要として保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("追加制約の拒否後もcleanup不明はRecovery必要として保持する", async () => {
  const fixture = createFixture({
    cleanupOwnedResources: async () => ({
      confirmed: false,
      processTreeTerminated: false,
      containersAbsent: false,
      networksAbsent: false,
    }),
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
    () => true,
    () => false,
  );
  assert.equal(started.status, "started");
  const result = await started.completion;
  assert.ok(result);
  assert.equal(result.reason, "docker_process_controller_cleanup_unconfirmed");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.recoveryId, started.recoveryId);
  assert.equal(fixture.getRecoveryCompletionCount(), 0);
});

/**
 * 固定command planを完了後に全resource不存在とlease解放へ閉じるを検証する。
 *
 * @responsibility 固定command planを完了後に全resource不存在とlease解放へ閉じるの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定command planを完了後に全resource不存在とlease解放へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定command planを完了後に全resource不存在とlease解放へ閉じる", async () => {
  const fixture = createFixture();
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(started.status, "started");
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "completed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.processTreeTerminationConfirmed, true);
  assert.equal(result.containersAbsent, true);
  assert.equal(result.networksAbsent, true);
  assert.equal(result.mountLeaseReleased, true);
  assert.equal(result.recoveryCompleted, true);
  assert.equal(result.resultBytes, Buffer.byteLength(createProviderOutput()));
  assert.match(result.resultSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.rawOutputReported, false);
  assert.equal(fixture.getCommandCount(), 9);
  assert.equal(result.subscriptionAuthConfirmed, true);
  assert.ok(
    projectRuntimeOwnedDockerProcessCompletionForTask(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  assert.equal(fixture.getCleanupCount(), 1);
  assert.equal(fixture.getMountCompletionCount(), 1);
  assert.equal(fixture.getRecoveryCompletionCount(), 1);
  assert.deepEqual(fixture.getRecoveryEvents().slice(-3), [
    "docker-absence",
    "mount-completion",
    "recovery-completed",
  ]);
  assert.equal(
    fixture.getRecordedResourceObservations(),
    fixture.resourceObservations,
  );
  for (const purpose of [
    "create_subscription_auth_probe",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "create_provider",
  ]) {
    const events = fixture.getRecoveryEvents();
    assert.ok(events.indexOf(`submission:${purpose}`) >= 0);
    assert.ok(
      events.indexOf(`submission:${purpose}`) <
        events.indexOf(`receipt:${purpose}`),
    );
  }
});

/**
 * Docker create前の耐久submission markerを書けなければEffectを開始しないを検証する。
 *
 * @responsibility Docker create前の耐久submission markerを書けなければEffectを開始しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker create前の耐久submission markerを書けなければEffectを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker create前の耐久submission markerを書けなければEffectを開始しない", async () => {
  let commandStarted = false;
  const fixture = createFixture({
    markResourceSubmission: () => false,
    startCommand: () => {
      commandStarted = true;
      throw new Error("must_not_start");
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(started.status, "started");
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(commandStarted, false);
  assert.equal(result.reason, "docker_resource_submission_record_unavailable");
});

/**
 * Provider要求前の同期保存と取消・通知失効を確認する。
 * @responsibility 保存未確認からのAI起動と偽通知の受入を反証する。
 * @trace ERB-IT-002
 * @precondition Docker・保存境界を模擬したisolated Controllerを使用する。
 * @stimulus 保存成功・拒否・例外・同期取消・要求例外・spawn失敗を発生させる。
 * @observation 通知相関、保存と要求の順序、要求回数、清掃、終端結果。
 * @oracle 保存拒否・例外・取消なら要求0、成功保存後だけ要求し、通知はcallback後に失効する。
 * @cleanup Process内Fixtureのみ。実Docker・Providerへ依頼しない。
 * @boundary Controllerと保存Ownerの模擬同期境界。
 */
test("Provider要求は元通知の保存後だけ発行し保存中取消で停止する", async () => {
  for (const mode of [
    "success",
    "reject",
    "throw",
    "cancel",
    "start_throw",
    "spawn_failed",
  ] as const) {
    let notice: unknown;
    let control: unknown;
    let recovery: unknown;
    let saves = 0;
    let providerRequests = 0;
    let saved = false;
    const events: string[] = [];
    const fixture = createFixture({
      recordProviderSubmission: (capability: object, value: object) => {
        saves += 1;
        notice = value;
        recovery = capability;
        const args = [
          capability,
          fixture.managementCapability,
          "OP-123456",
          `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
        ] as const;
        assert.equal(
          fixture.controller.verifyProviderSubmissionNotice(value, ...args),
          true,
        );
        assert.equal(
          fixture.controller.verifyProviderSubmissionNotice(
            { ...value },
            ...args,
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyProviderSubmissionNotice(
            value,
            {},
            ...(args.slice(1) as [unknown, string, string]),
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyProviderSubmissionNotice(
            value,
            capability,
            {},
            args[2],
            args[3],
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyProviderSubmissionNotice(
            value,
            capability,
            args[1],
            "OP-other",
            args[3],
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyProviderSubmissionNotice(
            value,
            capability,
            args[1],
            args[2],
            "other",
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice(
            value,
            capability,
            args[1],
            "start_provider_attached",
            args[2],
            args[3],
          ),
          false,
        );
        events.push("save");
        if (mode === "throw") throw new Error("save_failed");
        if (mode === "reject") return false;
        saved = true;
        if (mode === "cancel")
          void fixture.controller.cancel(control, fixture.managementCapability);
        return true;
      },
      startCommand: (command: { purpose: string }) => {
        const provider = command.purpose === "start_provider_attached";
        if (provider) {
          assert.equal(saved, true);
          providerRequests += 1;
          events.push("request");
          if (mode === "start_throw") throw new Error("request_unknown");
        }
        return Object.freeze({
          started: async () => !(provider && mode === "spawn_failed"),
          wait: async () =>
            Object.freeze({
              status: 0,
              signal: null,
              stdout: provider
                ? createProviderOutput()
                : command.purpose === "start_subscription_auth_probe_attached"
                  ? createSubscriptionAuthOutput()
                  : "",
              stderr: "",
              outputExceeded: false,
            }),
          terminateAndWait: async () => true,
        });
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    control = started.controlCapability;
    const result = await started.completion;
    assert.ok(result);
    assert.equal(saves, 1);
    assert.equal(
      providerRequests,
      ["success", "start_throw", "spawn_failed"].includes(mode) ? 1 : 0,
    );
    assert.deepEqual(events, providerRequests ? ["save", "request"] : ["save"]);
    assert.equal(
      result.status,
      mode === "success"
        ? "completed"
        : mode === "cancel"
          ? "cancelled"
          : "blocked",
    );
    assert.equal(fixture.getCleanupCount(), 1);
    assert.equal(
      fixture.controller.verifyProviderSubmissionNotice(
        notice,
        recovery,
        fixture.managementCapability,
        "OP-123456",
        started.recoveryId,
      ),
      false,
    );
  }
});

/**
 * 作成予定保存中の取消を実要求前の元通知として確認する。
 * @responsibility 未発行通知の出自・同期寿命と保存失敗時の停止を検証する。
 * @trace ERB-IT-002
 * @precondition isolated Controllerと固定fixtureだけを使用する。
 * @stimulus 二番目の作成予定callback内で取消し、未発行保存を成功・拒否・例外にする。
 * @observation 発行件数、元通知の照合、callback後の失効、最終結果。
 * @oracle 対象要求は発行0、同じcallback中の元通知だけ有効、保存失敗はblocked。
 * @cleanup N/A: DockerやFilesystemの実資源を作成しない。
 * @boundary ERB-IT-002=Direct Boundary: Controller→予定保存・取消・未発行保存。
 */
test("予定保存後の取消は未発行通知を同期保存中だけ保持する", async () => {
  for (const mode of ["success", "false", "throw"] as const) {
    let control: unknown = null;
    let notice: unknown = null;
    let capability: unknown = null;
    let notices = 0;
    const fixture = createFixture({
      markResourceSubmission: (_capability: object, purpose: string) => {
        if (purpose === "create_internal_network")
          void fixture.controller.cancel(control, fixture.managementCapability);
        return true;
      },
      recordResourceNotIssued: (
        recovery: object,
        purpose: string,
        value: object,
      ) => {
        notices += 1;
        notice = value;
        capability = recovery;
        const args = [
          recovery,
          fixture.managementCapability,
          purpose,
          "OP-123456",
          `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
        ] as const;
        assert.equal(
          fixture.controller.verifyUnissuedNotice(value, ...args),
          true,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice({ ...value }, ...args),
          false,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice(
            value,
            {},
            ...(args.slice(1) as [unknown, string, string, string]),
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice(
            value,
            recovery,
            {},
            purpose,
            args[3],
            args[4],
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice(
            value,
            recovery,
            fixture.managementCapability,
            "create_provider",
            args[3],
            args[4],
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice(
            value,
            recovery,
            fixture.managementCapability,
            purpose,
            "OP-other",
            args[4],
          ),
          false,
        );
        assert.equal(
          fixture.controller.verifyUnissuedNotice(
            value,
            recovery,
            fixture.managementCapability,
            purpose,
            args[3],
            "other-recovery",
          ),
          false,
        );
        assert.equal(
          verifyRuntimeOwnedDockerUnissuedNotice(value, ...args),
          false,
        );
        if (mode === "throw") throw new Error("not_issued_save_failed");
        return mode === "success";
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    control = started.controlCapability;
    const result = await started.completion;
    assert.ok(result);
    assert.equal(notices, 1);
    assert.equal(fixture.getCommandCount(), 2);
    assert.equal(result.status, mode === "success" ? "cancelled" : "blocked");
    assert.equal(
      fixture.controller.verifyUnissuedNotice(
        notice,
        capability,
        fixture.managementCapability,
        "create_internal_network",
        "OP-123456",
        started.recoveryId,
      ),
      false,
    );
  }
  let noticesAfterStart = 0;
  const startFailure = createFixture({
    startCommand: () => {
      throw new Error("start_outcome_unknown");
    },
    recordResourceNotIssued: () => {
      noticesAfterStart += 1;
      return true;
    },
  });
  const failed = startFailure.controller.start(
    startFailure.preparedCapability,
    startFailure.managementCapability,
  );
  const failedResult = await failed.completion;
  assert.ok(failedResult);
  assert.equal(failedResult.status, "blocked");
  assert.equal(noticesAfterStart, 0);
});

/**
 * Subscription OAuthを確認できなければProvider request前に停止するを検証する。
 *
 * @responsibility Subscription OAuthを確認できなければProvider request前に停止するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Subscription OAuthを確認できなければProvider request前に停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Subscription OAuthを確認できなければProvider request前に停止する", async () => {
  let providerStarted = false;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      if (command.purpose === "start_provider_attached") providerStarted = true;
      return Object.freeze({
        started: async () => true,
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? JSON.stringify({
                    loggedIn: true,
                    authMethod: "apiKey",
                    apiProvider: "firstParty",
                    forcedLoginMethod: null,
                    subscriptionType: null,
                  })
                : "",
            stderr: "",
            outputExceeded: false,
          }),
        terminateAndWait: async () => true,
      });
    },
  });
  const result = await fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  ).completion;
  assert.equal(result?.status, "blocked");
  assert.equal(result?.reason, "provider_subscription_auth_not_confirmed");
  assert.equal(result?.subscriptionAuthConfirmed, false);
  assert.equal(providerStarted, false);
  assert.equal(fixture.getCleanupCount(), 1);
});

/**
 * Codex認証ProbeはDocker attachのexact stderr形だけを認証済みとして受け入れるを検証する。
 *
 * @responsibility Codex認証ProbeはDocker attachのexact stderr形だけを認証済みとして受け入れるの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex認証ProbeはDocker attachのexact stderr形だけを認証済みとして受け入れるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex認証ProbeはDocker attachのexact stderr形だけを認証済みとして受け入れる", async () => {
  const status = "Logged in using ChatGPT";
  const warning =
    "WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)";
  const acceptedItems = [
    { stdout: `${status}\n`, stderr: "" },
    { stdout: "", stderr: `${status}\r\n` },
    { stdout: `${status}\n`, stderr: `${warning}\n` },
    { stdout: "", stderr: `${warning}\r\n${status}\r\n` },
  ];
  for (const auth of acceptedItems) {
    let providerStarted = false;
    const fixture = createFixture(
      {
        consumeProviderAuthority: () =>
          Object.freeze({
            operationId: "OP-123456",
            provider: "codex",
            profileId: "PROFILE-123456",
            providerHomeMountGrantRef: "PHMGRANT-123456",
            runtimeAuthorityIssued: true as const,
            providerEffectAllowed: true as const,
          }),
        startCommand: (command: { purpose: string }) => {
          if (command.purpose === "start_provider_attached")
            providerStarted = true;
          return Object.freeze({
            started: async () => true,
            wait: async () =>
              Object.freeze({
                status: 0,
                signal: null,
                stdout:
                  command.purpose === "start_subscription_auth_probe_attached"
                    ? auth.stdout
                    : command.purpose === "start_provider_attached"
                      ? '{"status":true}\n'
                      : "",
                stderr:
                  command.purpose === "start_subscription_auth_probe_attached"
                    ? auth.stderr
                    : "",
                outputExceeded: false,
              }),
            terminateAndWait: async () => true,
          });
        },
      },
      {
        provider: "codex",
        subscriptionOffering: "chatgpt_subscription_oauth",
        providerContainerName: "crdd-codex-0101010101010101",
      },
    );
    const result = await fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    ).completion;
    assert.ok(result);
    assert.equal(providerStarted, true);
    assert.equal(result.status, "completed");
    assert.equal(result.subscriptionAuthConfirmed, true);
  }
});

/**
 * Codex認証Probeは未知行・重複成功・制御文字をfail closedするを検証する。
 *
 * @responsibility Codex認証Probeは未知行・重複成功・制御文字をfail closedするの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex認証Probeは未知行・重複成功・制御文字をfail closedするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex認証Probeは未知行・重複成功・制御文字をfail closedする", async () => {
  const status = "Logged in using ChatGPT";
  for (const auth of [
    { stdout: "", stderr: `unknown warning\n${status}\n` },
    { stdout: "", stderr: `${status}\n${status}\n` },
    { stdout: `${status}\nextra\n`, stderr: "" },
    { stdout: "", stderr: `${status}\0` },
  ]) {
    let providerStarted = false;
    const fixture = createFixture(
      {
        consumeProviderAuthority: () =>
          Object.freeze({
            operationId: "OP-123456",
            provider: "codex",
            profileId: "PROFILE-123456",
            providerHomeMountGrantRef: "PHMGRANT-123456",
            runtimeAuthorityIssued: true as const,
            providerEffectAllowed: true as const,
          }),
        startCommand: (command: { purpose: string }) => {
          if (command.purpose === "start_provider_attached")
            providerStarted = true;
          return Object.freeze({
            started: async () => true,
            wait: async () =>
              Object.freeze({
                status: 0,
                signal: null,
                stdout:
                  command.purpose === "start_subscription_auth_probe_attached"
                    ? auth.stdout
                    : "",
                stderr:
                  command.purpose === "start_subscription_auth_probe_attached"
                    ? auth.stderr
                    : "",
                outputExceeded: false,
              }),
            terminateAndWait: async () => true,
          });
        },
      },
      {
        provider: "codex",
        subscriptionOffering: "chatgpt_subscription_oauth",
        providerContainerName: "crdd-codex-0101010101010101",
      },
    );
    const result = await fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    ).completion;
    assert.ok(result);
    assert.equal(providerStarted, false);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "provider_subscription_auth_not_confirmed");
  }
});

/**
 * Claude Max以外のSubscription OfferingではProvider request前に停止するを検証する。
 *
 * @responsibility Claude Max以外のSubscription OfferingではProvider request前に停止するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Max以外のSubscription OfferingではProvider request前に停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude Max以外のSubscription OfferingではProvider request前に停止する", async () => {
  let providerStarted = false;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      if (command.purpose === "start_provider_attached") providerStarted = true;
      return Object.freeze({
        started: async () => true,
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput("pro")
                : "",
            stderr: "",
            outputExceeded: false,
          }),
        terminateAndWait: async () => true,
      });
    },
  });
  const result = await fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  ).completion;
  assert.equal(result?.status, "blocked");
  assert.equal(result?.reason, "provider_subscription_auth_not_confirmed");
  assert.equal(result?.subscriptionAuthConfirmed, false);
  assert.equal(providerStarted, false);
});

/**
 * Provider非ゼロ終了は生出力を返さず既知の運用原因だけを閉集合へ分類するを検証する。
 *
 * @responsibility Provider非ゼロ終了は生出力を返さず既知の運用原因だけを閉集合へ分類するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider非ゼロ終了は生出力を返さず既知の運用原因だけを閉集合へ分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider非ゼロ終了は生出力を返さず既知の運用原因だけを閉集合へ分類する", async () => {
  const cases = [
    [
      "",
      "You've hit your current usage limit",
      "provider_subscription_quota_exhausted",
    ],
    [
      "",
      "OAuth token expired; please login",
      "provider_authentication_expired",
    ],
    [
      JSON.stringify({ type: "result", subtype: "error_max_budget_usd" }),
      "",
      "provider_operation_budget_exceeded",
    ],
    [
      JSON.stringify({ type: "result", subtype: "error_max_turns" }),
      "",
      "provider_turn_limit_exceeded",
    ],
    [
      JSON.stringify({
        type: "result",
        subtype: "error_max_structured_output_retries",
      }),
      "",
      "provider_structured_output_retry_exhausted",
    ],
    ["", "Unknown option --future-flag", "provider_invocation_rejected"],
    ["", "proxy connection failed: ECONNRESET", "provider_network_unavailable"],
    ["", "Service unavailable (HTTP 503)", "provider_service_unavailable"],
    ["", "unclassified provider failure", "provider_process_exit_nonzero"],
  ] as const;
  for (const [stdout, stderr, expectedReason] of cases) {
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => ({
        started: async () => true,
        wait: async () => ({
          status: command.purpose === "start_provider_attached" ? 1 : 0,
          signal: null,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? createSubscriptionAuthOutput()
              : command.purpose === "start_provider_attached"
                ? stdout
                : "",
          stderr: command.purpose === "start_provider_attached" ? stderr : "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => true,
      }),
    });
    const result = await fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    ).completion;
    assert.ok(result);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, expectedReason);
    assert.equal(result.rawOutputReported, false);
    assert.equal(
      stdout.length === 0 || !JSON.stringify(result).includes(stdout),
      true,
    );
    assert.equal(
      stderr.length === 0 || !JSON.stringify(result).includes(stderr),
      true,
    );
    assert.equal(result.cleanupConfirmed, true);
  }
});

/**
 * 搬送失敗status:nullは出力上限やtimeoutでなく既存の実行失敗へ分類するを検証する。
 *
 * @responsibility 搬送失敗status:nullは出力上限やtimeoutでなく既存の実行失敗へ分類するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 搬送失敗status:nullは出力上限やtimeoutでなく既存の実行失敗へ分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("搬送失敗status:nullは出力上限やtimeoutでなく既存の実行失敗へ分類する", async () => {
  for (const [failedPurpose, expectedReason] of [
    [
      "create_subscription_auth_probe",
      "docker_setup_create_subscription_auth_probe_failed",
    ],
    [
      "start_subscription_auth_probe_attached",
      "docker_setup_start_subscription_auth_probe_attached_failed",
    ],
    ["create_internal_network", "docker_setup_create_internal_network_failed"],
    ["create_egress_network", "docker_setup_create_egress_network_failed"],
    ["create_proxy", "docker_setup_create_proxy_failed"],
    ["connect_proxy_egress", "docker_setup_connect_proxy_egress_failed"],
    ["create_provider", "docker_setup_create_provider_failed"],
    ["start_proxy", "docker_setup_start_proxy_failed"],
    ["start_provider_attached", "provider_process_exit_nonzero"],
  ] as const) {
    const commands: string[] = [];
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => {
        commands.push(command.purpose);
        return {
          started: async () => true,
          wait: async () => ({
            status: command.purpose === failedPurpose ? null : 0,
            signal: null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : "",
            stderr: "",
            outputExceeded: false,
          }),
          terminateAndWait: async () => true,
        };
      },
    });
    const result = await fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    ).completion;
    assert.equal(result?.status, "blocked");
    assert.equal(result?.reason, expectedReason);
    assert.equal(result?.cleanupConfirmed, true);
    assert.equal(result?.rawOutputReported, false);
    assert.equal(commands.at(-1), failedPurpose);
    assert.equal(fixture.getCleanupCount(), 1);
  }
});

/**
 * Provider非ゼロ分類はTask本文に似たstdoutと過長・制御文字stderrを診断へ昇格しないを検証する。
 *
 * @responsibility Provider非ゼロ分類はTask本文に似たstdoutと過長・制御文字stderrを診断へ昇格しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider非ゼロ分類はTask本文に似たstdoutと過長・制御文字stderrを診断へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider非ゼロ分類はTask本文に似たstdoutと過長・制御文字stderrを診断へ昇格しない", async () => {
  for (const execution of [
    { stdout: "The task says usage limit and OAuth token expired", stderr: "" },
    { stdout: "", stderr: `Service unavailable\0` },
    { stdout: "", stderr: "x".repeat(8_193) },
  ]) {
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => ({
        started: async () => true,
        wait: async () => ({
          status: command.purpose === "start_provider_attached" ? 1 : 0,
          signal: null,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? createSubscriptionAuthOutput()
              : execution.stdout,
          stderr:
            command.purpose === "start_provider_attached"
              ? execution.stderr
              : "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => true,
      }),
    });
    const result = await fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    ).completion;
    assert.equal(result?.reason, "provider_process_exit_nonzero");
    assert.equal(result?.rawOutputReported, false);
    assert.equal(result?.cleanupConfirmed, true);
  }
});

/**
 * provider timeoutは終了要求後もcleanupを必須にするを検証する。
 *
 * @responsibility provider timeoutは終了要求後もcleanupを必須にするの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus provider timeoutは終了要求後もcleanupを必須にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("provider timeoutは終了要求後もcleanupを必須にする", async () => {
  let terminationCount = 0;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => ({
      started: async () => true,
      wait: async () =>
        command.purpose === "start_provider_attached"
          ? null
          : {
              status: 0,
              signal: null,
              stdout:
                command.purpose === "start_subscription_auth_probe_attached"
                  ? createSubscriptionAuthOutput()
                  : "",
              stderr: "",
              outputExceeded: false,
            },
      terminateAndWait: async () => {
        terminationCount += 1;
        return true;
      },
    }),
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_deadline_exceeded");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(terminationCount, 1);
});

// OSのCtrl+C配送とDocker資源は未観測。CLI listener/Controllerの共有処理から
// 本番共通のtaskkillへ接続し、固定Node子孫のclose/不存在を実観測する。
for (const dockerCleanupConfirmed of [true, false]) {
  /**
   * Host Windows: 取消結合: 実子孫終了後の模擬Docker cleanup=${dockerCleanupConfirmed}を検証する。
   *
   * @responsibility Host Windows: 取消結合: 実子孫終了後の模擬Docker cleanup=${dockerCleanupConfirmed}の合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Host Windows: 取消結合: 実子孫終了後の模擬Docker cleanup=${dockerCleanupConfirmed}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`Host Windows: 取消結合: 実子孫終了後の模擬Docker cleanup=${dockerCleanupConfirmed}`, {
    skip: process.platform !== "win32",
    timeout: 20_000,
  }, async (t) => {
    const processes = createOwnedProcessTreeFixture();
    t.after(() => processes.dispose());
    let handle: OwnedCommandHandle | null = null;
    let terminationCount = 0;
    let cleanupCount = 0;
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => {
        if (command.purpose === "start_provider_attached") {
          const owned = processes.start();
          handle = owned;
          return {
            started: owned.started,
            wait: owned.wait,
            terminateAndWait: async (graceMs: number) => {
              terminationCount += 1;
              return owned.terminateAndWait(graceMs);
            },
          };
        }
        return {
          started: async () => true,
          wait: async () => ({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : "",
            stderr: "",
            outputExceeded: false,
          }),
          terminateAndWait: async () => true,
        };
      },
      cleanupOwnedResources: async () => {
        cleanupCount += 1;
        assert.ok(handle);
        assert.equal(await handle.terminateAndWait(5_000), true);
        processes.assertAbsent();
        return {
          confirmed: dockerCleanupConfirmed,
          processTreeTerminated: true,
          containersAbsent: dockerCleanupConfirmed,
          networksAbsent: dockerCleanupConfirmed,
        };
      },
    });
    assert.equal(fixture.controller.productionAuthority, false);
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(started.status, "started");
    const beforeSigint = process.listenerCount("SIGINT");
    const beforeSigterm = process.listenerCount("SIGTERM");
    const binding = bindTaskCliCancellationSignals(() =>
      fixture.controller.cancel(
        started.controlCapability,
        fixture.managementCapability,
      ),
    );
    t.after(() => binding.unbind());
    assert.equal(binding.status, "bound");
    await processes.ready();
    assert.ok(handle);
    binding.listener();
    binding.listener();
    const cancellation = await binding.cancellation.observedPromise();
    assert.deepEqual(cancellation, {
      status: "requested",
      reason: "provider_cancellation_requested",
      cancellationRequested: true,
      processTerminationObserved: true,
    });
    const result = await started.completion;
    assert.ok(result);
    assert.equal(terminationCount, 1);
    assert.equal(binding.cancellation.observerCount(), 1);
    assert.equal(cleanupCount, 1);
    assert.equal(
      result.status,
      dockerCleanupConfirmed ? "cancelled" : "blocked",
    );
    assert.equal(result.cleanupConfirmed, dockerCleanupConfirmed);
    assert.equal(result.manualRecoveryRequired, !dockerCleanupConfirmed);
    assert.equal(result.normalizedResult, null);
    processes.assertAbsent();
    assertCompletionAcceptedByAll(result, started.recoveryId);
    assert.equal(binding.unbind().status, "released");
    assert.equal(process.listenerCount("SIGINT"), beforeSigint);
    assert.equal(process.listenerCount("SIGTERM"), beforeSigterm);
  });
}

/**
 * 取消はactive processへ一度だけ伝えcleanup後にcancelledになるを検証する。
 *
 * @responsibility 取消はactive processへ一度だけ伝えcleanup後にcancelledになるの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消はactive processへ一度だけ伝えcleanup後にcancelledになるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("取消はactive processへ一度だけ伝えcleanup後にcancelledになる", async () => {
  let finishProvider: (() => void) | null = null;
  let terminationCount = 0;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      if (command.purpose !== "start_provider_attached") {
        return {
          started: async () => true,
          wait: async () => ({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : "",
            stderr: "",
            outputExceeded: false,
          }),
          terminateAndWait: async () => true,
        };
      }
      let resolveExecution: (() => void) | null = null;
      const completion = new Promise<void>((resolve) => {
        resolveExecution = resolve;
        finishProvider = resolve;
      });
      return {
        started: async () => true,
        wait: async () => {
          await completion;
          return {
            status: null,
            signal: "SIGTERM",
            stdout: "",
            stderr: "",
            outputExceeded: false,
          };
        },
        terminateAndWait: async () => {
          terminationCount += 1;
          resolveExecution?.();
          return true;
        },
      };
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(started.status, "started");
  while (!finishProvider) await Promise.resolve();
  const cancelled = await fixture.controller.cancel(
    started.controlCapability,
    fixture.managementCapability,
  );
  assert.equal(cancelled.status, "requested");
  assert.equal(terminationCount, 1);
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "cancelled");
  assert.equal(result.cleanupConfirmed, true);
  assert.ok(
    projectDockerProcessControllerCompletionResult(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  assert.ok(
    projectRuntimeOwnedDockerProcessCompletionForTask(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  for (const projectCompletion of [
    projectDockerProcessControllerCompletionResult,
    projectRuntimeOwnedDockerProcessCompletionForTask,
  ])
    assert.equal(
      projectCompletion(
        Object.freeze({ ...result, cancellationRequested: false }),
        started.recoveryId,
        "OP-123456",
      ),
      null,
    );
  assert.equal(
    (
      await fixture.controller.cancel(
        started.controlCapability,
        fixture.managementCapability,
      )
    ).status,
    "blocked",
  );
});

/**
 * cleanup待機中の遅延取消はcompletedをcancelledへ再settleするを検証する。
 *
 * @responsibility cleanup待機中の遅延取消はcompletedをcancelledへ再settleするの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup待機中の遅延取消はcompletedをcancelledへ再settleするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanup待機中の遅延取消はcompletedをcancelledへ再settleする", async () => {
  let notifyCleanupStarted!: () => void;
  const cleanupStarted = new Promise<void>((resolve) => {
    notifyCleanupStarted = resolve;
  });
  let releaseCleanup!: () => void;
  const cleanupGate = new Promise<void>((resolve) => {
    releaseCleanup = resolve;
  });
  const fixture = createFixture({
    cleanupOwnedResources: async () => {
      notifyCleanupStarted();
      await cleanupGate;
      return Object.freeze({
        confirmed: true,
        processTreeTerminated: true,
        containersAbsent: true,
        networksAbsent: true,
      });
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  await cleanupStarted;
  const cancellation = await fixture.controller.cancel(
    started.controlCapability,
    fixture.managementCapability,
  );
  assert.equal(cancellation.status, "requested");
  releaseCleanup();
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "cancelled");
  assert.equal(result.reason, "provider_operation_cancelled");
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.normalizedResult, null);
  assertCompletionAcceptedByAll(result, started.recoveryId);
});

/**
 * cleanup待機前にblockedなら遅延取消で失敗理由を上書きしないを検証する。
 *
 * @responsibility cleanup待機前にblockedなら遅延取消で失敗理由を上書きしないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup待機前にblockedなら遅延取消で失敗理由を上書きしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanup待機前にblockedなら遅延取消で失敗理由を上書きしない", async () => {
  let notifyCleanupStarted!: () => void;
  const cleanupStarted = new Promise<void>((resolve) => {
    notifyCleanupStarted = resolve;
  });
  let releaseCleanup!: () => void;
  const cleanupGate = new Promise<void>((resolve) => {
    releaseCleanup = resolve;
  });
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => ({
      started: async () => true,
      wait: async () => ({
        status: 0,
        signal: null,
        stdout:
          command.purpose === "start_provider_attached"
            ? createProviderOutput({ structured_output: { status: false } })
            : command.purpose === "start_subscription_auth_probe_attached"
              ? createSubscriptionAuthOutput()
              : "",
        stderr: "",
        outputExceeded: false,
      }),
      terminateAndWait: async () => true,
    }),
    cleanupOwnedResources: async () => {
      notifyCleanupStarted();
      await cleanupGate;
      return Object.freeze({
        confirmed: true,
        processTreeTerminated: true,
        containersAbsent: true,
        networksAbsent: true,
      });
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  await cleanupStarted;
  const cancellation = await fixture.controller.cancel(
    started.controlCapability,
    fixture.managementCapability,
  );
  assert.equal(cancellation.status, "requested");
  releaseCleanup();
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_result_invalid");
  assert.equal(result.cancellationRequested, true);
  assertCompletionAcceptedByAll(result, started.recoveryId);
  assertCompletionRejectedByAll(
    Object.freeze({ ...result, reason: "unregistered_blocked_reason" }),
    started.recoveryId,
  );
});

/**
 * cleanup不明なら成功出力を破棄しmanual Recoveryへ閉じるを検証する。
 *
 * @responsibility cleanup不明なら成功出力を破棄しmanual Recoveryへ閉じるの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup不明なら成功出力を破棄しmanual Recoveryへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanup不明なら成功出力を破棄しmanual Recoveryへ閉じる", async () => {
  const fixture = createFixture({
    cleanupOwnedResources: async () => ({
      confirmed: false,
      processTreeTerminated: false,
      containersAbsent: false,
      networksAbsent: false,
    }),
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_process_controller_cleanup_unconfirmed");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(
    result.recoveryId,
    `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
  );
  assert.equal(result.resultSha256, null);
  assert.equal(result.resultBytes, 0);
  assert.equal(result.normalizedResult, null);
  assert.equal(result.recoveryFinalizationCapability, null);
  assert.ok(
    projectDockerProcessControllerCompletionResult(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  assert.ok(
    projectRuntimeOwnedDockerProcessCompletionForTask(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  assertCompletionRejectedByAll(
    Object.freeze({ ...result, reason: "provider_result_invalid" }),
    started.recoveryId,
  );
  assert.equal(fixture.getMountCompletionCount(), 0);
  assert.equal(fixture.getRecoveryCompletionCount(), 0);
});

/**
 * Provider Result不正時もcleanupし正規化Resultを公開しないを検証する。
 *
 * @responsibility Provider Result不正時もcleanupし正規化Resultを公開しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Result不正時もcleanupし正規化Resultを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Result不正時もcleanupし正規化Resultを公開しない", async () => {
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => ({
      started: async () => true,
      wait: async () => ({
        status: 0,
        signal: null,
        stdout:
          command.purpose === "start_provider_attached"
            ? createProviderOutput({ structured_output: { status: false } })
            : command.purpose === "start_subscription_auth_probe_attached"
              ? createSubscriptionAuthOutput()
              : "",
        stderr: "",
        outputExceeded: false,
      }),
      terminateAndWait: async () => true,
    }),
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_result_invalid");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.normalizedResult, null);
  assert.equal(result.resultSha256, null);
  assert.equal(result.resultBytes, 0);
  assert.ok(
    projectDockerProcessControllerCompletionResult(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  assert.ok(
    projectRuntimeOwnedDockerProcessCompletionForTask(
      result,
      started.recoveryId,
      "OP-123456",
    ),
  );
  assertCompletionRejectedByAll(
    Object.freeze({ ...result, reason: "unregistered_blocked_reason" }),
    started.recoveryId,
  );
});

/**
 * 隔離TaskのRole別Resultだけをcleanup後に公開するを検証する。
 *
 * @responsibility 隔離TaskのRole別Resultだけをcleanup後に公開するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 隔離TaskのRole別Resultだけをcleanup後に公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("隔離TaskのRole別Resultだけをcleanup後に公開する", async () => {
  const taskOutput = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 3,
    total_cost_usd: 0.12,
    result: JSON.stringify({
      decision: "approved",
      summary: "The exact candidate is acceptable.",
      findings: [],
    }),
  });
  const fixture = createFixture(
    {
      startCommand: (command: { purpose: string }) => ({
        started: async () => true,
        wait: async () => ({
          status: 0,
          signal: null,
          stdout:
            command.purpose === "start_provider_attached"
              ? taskOutput
              : command.purpose === "start_subscription_auth_probe_attached"
                ? createSubscriptionAuthOutput()
                : "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => true,
      }),
    },
    {
      operationMode: "isolated_task",
      taskRole: "reviewer",
      taskWorkload: {
        readPathCount: 1,
        allowedPathCount: 1,
        acceptanceCriterionCount: 1,
        remediationFindingCount: 0,
      },
      taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskPacketHash: "c".repeat(64),
      providerInput: "Review the exact local candidate.",
      workspaceSourcePath: "C:\\runtime-owned\\workspace",
      workspaceMountMode: "read_only",
    },
  );
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "completed");
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(result.normalizedResult, {
    decision: "approved",
    findingCount: 0,
    findingDiagnostics: [],
    providerTurnObservation: {
      provider: "claude",
      taskRole: "reviewer",
      requestedMaximumTurns: 5,
      providerReportedTurns: 3,
      resultAcceptanceMaximumTurns: 16,
      requestedTurnTargetExceeded: false,
    },
  });
  assert.equal(result.rawOutputReported, false);
  assert.equal(result.untrustedProviderTextReported, false);
  assert.equal(result.credentialAbsenceVerified, false);
});

/**
 * Claude Envelopeの拒否理由を実Controllerから全consumerへ回収状態と共に渡すを検証する。
 *
 * @responsibility Claude Envelopeの拒否理由を実Controllerから全consumerへ回収状態と共に渡すの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Envelopeの拒否理由を実Controllerから全consumerへ回収状態と共に渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude Envelopeの拒否理由を実Controllerから全consumerへ回収状態と共に渡す", async () => {
  const cases = [
    [{ subtype: "unknown" }, "provider_task_result_envelope_status_invalid"],
    [{ num_turns: 0 }, "provider_task_result_turn_count_invalid"],
    [{ subtype: "error_max_turns" }, "provider_turn_limit_exceeded"],
    [{ num_turns: 17 }, "provider_task_result_turn_limit_mismatch"],
    [{ total_cost_usd: -1 }, "provider_task_result_cost_metadata_invalid"],
    [{ result: undefined }, "provider_task_reviewer_result_transport_invalid"],
  ] as const;
  for (const [overrides, expectedReason] of cases) {
    for (const cleanupConfirmed of [true, false]) {
      const taskOutput = createProviderOutput({
        result: JSON.stringify({
          decision: "approved",
          summary: "ok",
          findings: [],
        }),
        ...overrides,
      });
      const fixture = createFixture(
        {
          startCommand: (command: { purpose: string }) => ({
            started: async () => true,
            wait: async () => ({
              status: 0,
              signal: null,
              stdout:
                command.purpose === "start_provider_attached"
                  ? taskOutput
                  : command.purpose === "start_subscription_auth_probe_attached"
                    ? createSubscriptionAuthOutput()
                    : "",
              stderr: "",
              outputExceeded: false,
            }),
            terminateAndWait: async () => true,
          }),
          cleanupOwnedResources: async () => ({
            confirmed: cleanupConfirmed,
            processTreeTerminated: cleanupConfirmed,
            containersAbsent: cleanupConfirmed,
            networksAbsent: cleanupConfirmed,
          }),
        },
        {
          operationMode: "isolated_task",
          taskRole: "reviewer",
          taskWorkload: {
            readPathCount: 1,
            allowedPathCount: 1,
            acceptanceCriterionCount: 1,
            remediationFindingCount: 0,
          },
          taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
          taskPacketHash: "c".repeat(64),
          providerInput: "Review the exact local candidate.",
          workspaceSourcePath: "C:\\runtime-owned\\workspace",
          workspaceMountMode: "read_only",
        },
      );
      const started = fixture.controller.start(
        fixture.preparedCapability,
        fixture.managementCapability,
      );
      assert.ok(started.completion);
      const result = await started.completion;
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        cleanupConfirmed
          ? expectedReason
          : "docker_process_controller_cleanup_unconfirmed",
      );
      assert.equal(result.cleanupConfirmed, cleanupConfirmed);
      assert.equal(result.manualRecoveryRequired, !cleanupConfirmed);
      assert.equal(result.normalizedResult, null);
      assert.equal(result.rawOutputReported, false);
      assert.equal(result.untrustedProviderTextReported, false);
      assertCompletionAcceptedByAll(result, started.recoveryId);
      if (!cleanupConfirmed)
        assert.equal(result.recoveryId, started.recoveryId);
    }
  }
});

/**
 * Claude Reviewerの構造不正理由を実Controllerから安全な固定診断として渡すを検証する。
 *
 * @responsibility Claude Reviewerの構造不正理由を実Controllerから安全な固定診断として渡すの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Reviewerの構造不正理由を実Controllerから安全な固定診断として渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude Reviewerの構造不正理由を実Controllerから安全な固定診断として渡す", async () => {
  const cases = [
    [
      {
        decision: "approved",
        summary: "ok",
        findings: [],
        unexpected: true,
      },
      "provider_task_reviewer_keys_invalid",
    ],
    [
      { decision: "unknown", summary: "ok", findings: [] },
      "provider_task_reviewer_decision_invalid",
    ],
    [
      { decision: "approved", summary: "", findings: [] },
      "provider_task_reviewer_summary_invalid",
    ],
    [
      { decision: "approved", summary: "ok", findings: {} },
      "provider_task_reviewer_findings_invalid",
    ],
  ] as const;

  for (const [reviewerResult, expectedReason] of cases) {
    const cleanupOutcomes =
      expectedReason === "provider_task_reviewer_keys_invalid"
        ? [true, false]
        : [true];
    for (const cleanupConfirmed of cleanupOutcomes) {
      const taskOutput = createProviderOutput({
        result: JSON.stringify(reviewerResult),
      });
      const fixture = createFixture(
        {
          startCommand: (command: { purpose: string }) => ({
            started: async () => true,
            wait: async () => ({
              status: 0,
              signal: null,
              stdout:
                command.purpose === "start_provider_attached"
                  ? taskOutput
                  : command.purpose === "start_subscription_auth_probe_attached"
                    ? createSubscriptionAuthOutput()
                    : "",
              stderr: "",
              outputExceeded: false,
            }),
            terminateAndWait: async () => true,
          }),
          cleanupOwnedResources: async () => ({
            confirmed: cleanupConfirmed,
            processTreeTerminated: cleanupConfirmed,
            containersAbsent: cleanupConfirmed,
            networksAbsent: cleanupConfirmed,
          }),
        },
        {
          operationMode: "isolated_task",
          taskRole: "reviewer",
          taskWorkload: {
            readPathCount: 1,
            allowedPathCount: 1,
            acceptanceCriterionCount: 1,
            remediationFindingCount: 0,
          },
          taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
          taskPacketHash: "c".repeat(64),
          providerInput: "Review the exact local candidate.",
          workspaceSourcePath: "C:\\runtime-owned\\workspace",
          workspaceMountMode: "read_only",
        },
      );
      const started = fixture.controller.start(
        fixture.preparedCapability,
        fixture.managementCapability,
      );
      assert.ok(started.completion);
      const result = await started.completion;
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        cleanupConfirmed
          ? expectedReason
          : "docker_process_controller_cleanup_unconfirmed",
      );
      assert.equal(result.cleanupConfirmed, cleanupConfirmed);
      assert.equal(result.manualRecoveryRequired, !cleanupConfirmed);
      assert.equal(result.normalizedResult, null);
      assert.equal(result.rawOutputReported, false);
      assert.equal(result.untrustedProviderTextReported, false);
      assertCompletionAcceptedByAll(result, started.recoveryId);
      if (cleanupConfirmed) assert.equal(result.recoveryId, null);
      else assert.equal(result.recoveryId, started.recoveryId);
    }
  }
});

/**
 * Recovery記録前と偽造production CapabilityはDocker Effectを開始しないを検証する。
 *
 * @responsibility Recovery記録前と偽造production CapabilityはDocker Effectを開始しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery記録前と偽造production CapabilityはDocker Effectを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery記録前と偽造production CapabilityはDocker Effectを開始しない", async () => {
  const fixture = createFixture({ beginRecovery: () => null });
  const blocked = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.dockerEffectStarted, false);
  assert.equal(fixture.getCommandCount(), 0);
  assert.equal(fixture.getMountCompletionCount(), 1);

  assert.equal(
    startRuntimeOwnedDockerProcessController({}, {}).status,
    "blocked",
  );
  assert.equal(
    (await cancelRuntimeOwnedDockerProcessController({}, {})).status,
    "blocked",
  );
});

/**
 * Recovery開始成功形でもexact ID・Home binding・Capability不一致はEffect 0へ閉じるを検証する。
 *
 * @responsibility Recovery開始成功形でもexact ID・Home binding・Capability不一致はEffect 0へ閉じるの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery開始成功形でもexact ID・Home binding・Capability不一致はEffect 0へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery開始成功形でもexact ID・Home binding・Capability不一致はEffect 0へ閉じる", () => {
  const cases = [
    Object.freeze({
      status: "ready" as const,
      recoveryId: "docker-task.invalid",
      recoveryCapability: Object.freeze({}),
      abandonExpected: 1,
      expectedRecoveryId: null,
      expectedCleanupConfirmed: false,
    }),
    Object.freeze({
      status: "ready" as const,
      recoveryId: `docker-task.${"a".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
      recoveryCapability: Object.freeze({}),
      abandonExpected: 1,
      expectedRecoveryId: `docker-task.${"a".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
      expectedCleanupConfirmed: false,
    }),
    Object.freeze({
      status: "ready" as const,
      recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
      recoveryCapability: null,
      abandonExpected: 0,
      expectedRecoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
      expectedCleanupConfirmed: false,
    }),
  ] as const;

  for (const recovery of cases) {
    let abandonCount = 0;
    const fixture = createFixture({
      beginRecovery: () => recovery,
      abandonRecovery: () => {
        abandonCount += 1;
        return true;
      },
    });
    const blocked = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(blocked.status, "blocked");
    assert.equal(
      blocked.reason,
      "docker_process_controller_recovery_identity_invalid",
    );
    assert.equal(blocked.dockerEffectStarted, false);
    assert.equal(blocked.recoveryId, recovery.expectedRecoveryId);
    assert.equal(blocked.cleanupConfirmed, recovery.expectedCleanupConfirmed);
    assert.equal(
      blocked.manualRecoveryRequired,
      !recovery.expectedCleanupConfirmed,
    );
    assert.equal(fixture.getCommandCount(), 0);
    assert.equal(fixture.getMountCompletionCount(), 1);
    assert.equal(abandonCount, recovery.abandonExpected);
  }
});

/**
 * Recovery成功unionはready exact形とopaque bindingを必須にしdurable IDを保持するを検証する。
 *
 * @responsibility Recovery成功unionはready exact形とopaque bindingを必須にしdurable IDを保持するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery成功unionはready exact形とopaque bindingを必須にしdurable IDを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery成功unionはready exact形とopaque bindingを必須にしdurable IDを保持する", () => {
  const exactId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
  for (const malformed of [
    Object.freeze({
      recoveryId: exactId,
      recoveryCapability: Object.freeze({}),
    }),
    Object.freeze({
      status: "blocked",
      recoveryId: exactId,
      recoveryCapability: Object.freeze({}),
    }),
    Object.freeze({
      status: "ready",
      recoveryId: exactId,
      recoveryCapability: Object.freeze({}),
      extra: true,
    }),
  ]) {
    let abandonCount = 0;
    const fixture = createFixture({
      beginRecovery: () => malformed,
      verifyRecoveryBinding: () => true,
      abandonRecovery: () => {
        abandonCount += 1;
        return true;
      },
    });
    const blocked = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(blocked.status, "blocked");
    assert.equal(
      blocked.reason,
      "docker_process_controller_recovery_identity_invalid",
    );
    assert.equal(blocked.cleanupConfirmed, false);
    assert.equal(blocked.manualRecoveryRequired, true);
    assert.equal(blocked.recoveryId, exactId);
    assert.equal(fixture.getCommandCount(), 0);
    assert.equal(abandonCount, 1);
  }
});

/**
 * Recovery初期化がexact ID付きで安全停止した場合は下位理由を公開分類してEffect 0を保つを検証する。
 *
 * @responsibility Recovery初期化がexact ID付きで安全停止した場合は下位理由を公開分類してEffect 0を保つの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery初期化がexact ID付きで安全停止した場合は下位理由を公開分類してEffect 0を保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery初期化がexact ID付きで安全停止した場合は下位理由を公開分類してEffect 0を保つ", () => {
  const exactId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const fixture = createFixture({
    beginRecovery: () =>
      Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
        recoveryId: exactId,
      }),
  });
  const blocked = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(
    blocked.reason,
    "docker_process_controller_recovery_observation_unknown",
  );
  assert.equal(blocked.recoveryId, exactId);
  assert.equal(blocked.cleanupConfirmed, true);
  assert.equal(blocked.manualRecoveryRequired, true);
  assert.equal(blocked.dockerEffectStarted, false);
  assert.equal(fixture.getCommandCount(), 0);
  assert.equal(fixture.getMountCompletionCount(), 1);
});

/**
 * Recovery初期化のexact IDは現在のProvider Home bindingと一致しなければ公開理由へ採用しないを検証する。
 *
 * @responsibility Recovery初期化のexact IDは現在のProvider Home bindingと一致しなければ公開理由へ採用しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery初期化のexact IDは現在のProvider Home bindingと一致しなければ公開理由へ採用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery初期化のexact IDは現在のProvider Home bindingと一致しなければ公開理由へ採用しない", () => {
  const foreignId = `docker-task.${"a".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const fixture = createFixture({
    beginRecovery: () =>
      Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
        recoveryId: foreignId,
      }),
  });
  const blocked = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(
    blocked.reason,
    "docker_process_controller_recovery_identity_invalid",
  );
  assert.equal(blocked.recoveryId, foreignId);
  assert.equal(blocked.manualRecoveryRequired, true);
  assert.equal(blocked.dockerEffectStarted, false);
  assert.equal(fixture.getCommandCount(), 0);
});

/**
 * Owner付き開始停止の真正性と結果搬送を検証する。
 * @responsibility 開始失敗を不正Identityへ上書きせず、未確認清掃と処置権限を公開しない。
 * @trace ERB-IT-002
 * @precondition Controllerの下位Owner照合だけを模擬する。
 * @stimulus 真正な照合、拒否、例外、未接続を同じ停止shapeへ与える。
 * @observation 公開理由、回復参照、返却結果のOwner結合、Docker要求数と清掃確認。
 * @oracle 真正な停止だけ元の安全分類を維持し、他は不正Identity、すべてDocker要求0。
 * @cleanup N/A: Process内fixtureのみで実資源を作成しない。
 * @boundary Controllerから初期化Owner照合への模擬接続。
 */
test("Owner付き初期化停止は照合済み理由と回復参照を搬送する", () => {
  const exactId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const owner = Object.freeze({});
  const reason = "docker_task_runtime_state_lock_release_unconfirmed";
  for (const mode of [
    "verified",
    "verified_cleanup_throws",
    "rejected",
    "throws",
    "missing",
  ]) {
    let boundResult: unknown = null;
    let bindingCalls = 0;
    const fixture = createFixture({
      beginRecovery: () =>
        Object.freeze({
          status: "blocked",
          reason,
          recoveryId: exactId,
          recoveryCapability: owner,
          manualRecoveryRequired: true,
        }),
      abandonRecovery: () => {
        if (mode === "verified_cleanup_throws")
          throw new Error("fixture_release_failed");
        return false;
      },
      ...(mode === "verified_cleanup_throws"
        ? {
            completeMount: () => {
              throw new Error("fixture_mount_failed");
            },
          }
        : {}),
      bindInitializationFailure:
        mode === "missing"
          ? undefined
          : (
              capability: unknown,
              reference: unknown,
              management: unknown,
              home: unknown,
              originalReason: unknown,
              result: unknown,
            ) => {
              bindingCalls++;
              assert.ok(result && typeof result === "object");
              assert.equal(capability, owner);
              assert.equal(reference, exactId);
              assert.equal(management, fixture.managementCapability);
              assert.equal(home, fixture.plan.stableLogicalHomeBindingHash);
              assert.equal(originalReason, reason);
              if (mode === "throws") throw new Error("fixture_binding_failed");
              if (mode === "rejected") return false;
              boundResult = result;
              return true;
            },
    });
    const stopped = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(stopped.status, "blocked");
    assert.equal(
      stopped.reason,
      mode.startsWith("verified")
        ? "docker_process_controller_recovery_observation_unknown"
        : "docker_process_controller_recovery_identity_invalid",
    );
    assert.equal(stopped.recoveryId, exactId);
    assert.equal(stopped.cleanupConfirmed, false);
    assert.equal(stopped.manualRecoveryRequired, true);
    assert.equal(stopped.dockerEffectStarted, false);
    assert.equal(fixture.getCommandCount(), 0);
    assert.equal("recoveryCapability" in stopped, false);
    assert.equal(bindingCalls, mode === "missing" ? 0 : 1);
    if (mode.startsWith("verified")) assert.equal(boundResult, stopped);
  }
  const base = {
    status: "blocked",
    reason,
    recoveryId: exactId,
    recoveryCapability: owner,
    manualRecoveryRequired: true,
  };
  const accessor = { ...base };
  Object.defineProperty(accessor, "recoveryCapability", {
    enumerable: true,
    get: () => {
      throw new Error("fixture_getter_forbidden");
    },
  });
  for (const malformed of [
    { ...base, recoveryCapability: undefined },
    accessor,
    { ...base, manualRecoveryRequired: false },
    { ...base, manualRecoveryRequired: undefined },
  ]) {
    let bindingCalls = 0;
    const fixture = createFixture({
      beginRecovery: () => malformed,
      bindInitializationFailure: () => {
        bindingCalls++;
        return true;
      },
    });
    const stopped = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(
      stopped.reason,
      "docker_process_controller_recovery_identity_invalid",
    );
    assert.equal(stopped.cleanupConfirmed, false);
    assert.equal(stopped.recoveryId, exactId);
    assert.equal(fixture.getCommandCount(), 0);
    assert.equal(bindingCalls, 0);
  }
});

/**
 * exact ID付き安全停止も余分field・accessor・Proxyから公開理由を採用しないを検証する。
 *
 * @responsibility exact ID付き安全停止も余分field・accessor・Proxyから公開理由を採用しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact ID付き安全停止も余分field・accessor・Proxyから公開理由を採用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact ID付き安全停止も余分field・accessor・Proxyから公開理由を採用しない", () => {
  const exactId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const accessor = Object.create(Object.prototype);
  Object.defineProperties(accessor, {
    status: { enumerable: true, value: "blocked" },
    reason: {
      enumerable: true,
      get: () => "docker_task_runtime_state_lock_release_unconfirmed",
    },
    recoveryId: { enumerable: true, value: exactId },
  });
  for (const malformed of [
    Object.freeze({
      status: "blocked",
      reason: "docker_task_runtime_state_lock_release_unconfirmed",
      recoveryId: exactId,
      extra: true,
    }),
    accessor,
    new Proxy(Object.freeze({ status: "blocked" }), {
      ownKeys: () => {
        throw new Error("fixture_proxy_must_not_escape");
      },
    }),
  ]) {
    const fixture = createFixture({ beginRecovery: () => malformed });
    const blocked = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(blocked.status, "blocked");
    assert.notEqual(
      blocked.reason,
      "docker_process_controller_recovery_observation_unknown",
    );
    assert.equal(blocked.dockerEffectStarted, false);
    assert.equal(fixture.getCommandCount(), 0);
  }
});

/**
 * Recovery bindingまたはabort不明はexact IDを保持してEffect 0へ閉じるを検証する。
 *
 * @responsibility Recovery bindingまたはabort不明はexact IDを保持してEffect 0へ閉じるの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery bindingまたはabort不明はexact IDを保持してEffect 0へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery bindingまたはabort不明はexact IDを保持してEffect 0へ閉じる", () => {
  const exactId = `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`;
  for (const abandonRecovery of [
    () => false,
    () => {
      throw new Error("fixture_abandon_unknown");
    },
  ]) {
    const fixture = createFixture({
      verifyRecoveryBinding: () => false,
      abandonRecovery,
    });
    const blocked = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.cleanupConfirmed, false);
    assert.equal(blocked.manualRecoveryRequired, true);
    assert.equal(blocked.recoveryId, exactId);
    assert.equal(fixture.getCommandCount(), 0);
  }
});

/**
 * Recovery開始失敗は秘密を含まない固定分類で公開するを検証する。
 *
 * @responsibility Recovery開始失敗は秘密を含まない固定分類で公開するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery開始失敗は秘密を含まない固定分類で公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery開始失敗は秘密を含まない固定分類で公開する", () => {
  const cases = [
    [
      "docker_task_runtime_state_generation_active_or_unknown",
      "docker_process_controller_recovery_observation_unknown",
    ],
    [
      "docker_task_runtime_state_pending_incomplete",
      "docker_process_controller_recovery_partial_state",
    ],
    [
      "docker_task_runtime_state_binding_changed",
      "docker_process_controller_recovery_identity_mismatch",
    ],
    [
      "docker_task_multiple_recovery_inventory_available",
      "docker_process_controller_recovery_conflict",
    ],
    [
      "docker_task_runtime_state_lock_release_unconfirmed",
      "docker_process_controller_recovery_observation_unknown",
    ],
    ["caller-secret-value", "docker_process_controller_recovery_unavailable"],
    [
      "caller-lock-secret-value",
      "docker_process_controller_recovery_unavailable",
    ],
  ] as const;
  for (const [lowerReason, expectedReason] of cases) {
    const fixture = createFixture({
      beginRecovery: () =>
        Object.freeze({
          status: "blocked",
          reason: lowerReason,
          recoveryId: null,
          manualRecoveryRequired: true,
        }),
    });
    const blocked = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
    );
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, expectedReason);
    assert.equal(blocked.cleanupConfirmed, true);
    assert.equal(blocked.manualRecoveryRequired, true);
    assert.equal(blocked.dockerEffectStarted, false);
    assert.equal(fixture.getCommandCount(), 0);
  }
});

/**
 * 起動直前Authority不成立ならMountを返しDocker Effectを開始しないを検証する。
 *
 * @responsibility 起動直前Authority不成立ならMountを返しDocker Effectを開始しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 起動直前Authority不成立ならMountを返しDocker Effectを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("起動直前Authority不成立ならMountを返しDocker Effectを開始しない", () => {
  const fixture = createFixture({ consumeProviderAuthority: () => null });
  const blocked = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.reason, "docker_process_controller_authority_invalid");
  assert.equal(blocked.dockerEffectStarted, false);
  assert.equal(blocked.cleanupConfirmed, true);
  assert.equal(blocked.manualRecoveryRequired, false);
  assert.equal(fixture.getCommandCount(), 0);
  assert.equal(fixture.getMountCompletionCount(), 1);
  assert.equal(fixture.getRecoveryCompletionCount(), 0);
});

/**
 * 起動直前にRepository Revisionが一致しなければEffectを開始しないを検証する。
 *
 * @responsibility 起動直前にRepository Revisionが一致しなければEffectを開始しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 起動直前にRepository Revisionが一致しなければEffectを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("起動直前にRepository Revisionが一致しなければEffectを開始しない", () => {
  const fixture = createFixture({ verifyRevision: () => null });
  const blocked = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.reason, "docker_process_controller_revision_invalid");
  assert.equal(blocked.dockerEffectStarted, false);
  assert.equal(blocked.cleanupConfirmed, true);
  assert.equal(blocked.manualRecoveryRequired, false);
  assert.equal(fixture.getCommandCount(), 0);
  assert.equal(fixture.getMountCompletionCount(), 1);
  assert.equal(fixture.getRecoveryCompletionCount(), 0);
});

/**
 * Provider完了後にRepository Revisionが変わればResultを公開しないを検証する。
 *
 * @responsibility Provider完了後にRepository Revisionが変わればResultを公開しないの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider完了後にRepository Revisionが変わればResultを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider完了後にRepository Revisionが変わればResultを公開しない", async () => {
  let observation = 0;
  const fixture = createFixture({
    verifyRevision: () => {
      observation += 1;
      return observation === 1
        ? Object.freeze({ revisionCurrent: true })
        : null;
    },
  });
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(started.status, "started");
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "repository_revision_changed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.resultSha256, null);
  assert.equal(result.resultBytes, 0);
  assert.equal(result.normalizedResult, null);
});

/**
 * 公開契約はtimeout、cancel、cleanup、Recoveryと秘密非出力を固定するを検証する。
 *
 * @responsibility 公開契約はtimeout、cancel、cleanup、Recoveryと秘密非出力を固定するの合否判定を所有する。
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はtimeout、cancel、cleanup、Recoveryと秘密非出力を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約はtimeout、cancel、cleanup、Recoveryと秘密非出力を固定する", () => {
  const contract = describeDockerProcessControllerContract();
  assert.equal(contract.setupTimeoutMs, 10_000);
  assert.equal(contract.providerTimeoutMs, 300_000);
  assert.equal(contract.cancellationGraceMs, 5_000);
  assert.equal(contract.recoveryBeforeDockerEffect, true);
  assert.equal(contract.contractRevision, 31);
  assert.match(contract.subscriptionAuthentication, /required_before/u);
  assert.match(contract.subscriptionAuthentication, /stdout_stderr_shape/u);
  assert.match(contract.subscriptionOffering, /exact_match_required/u);
  assert.match(contract.providerAuthority, /consumed_before/u);
  assert.equal(
    contract.structuredResult,
    "exact_provider_boolean_role_task_or_workbench_advice_result_published_after_cleanup_only",
  );
  assert.equal(contract.rawOutputReported, false);
  assert.equal(contract.hostPathReported, false);
  assert.equal(contract.proxyCredentialReported, false);
  assert.equal(
    contract.productionPreparedPlan,
    "runtime_owned_adapter_connected",
  );
  assert.equal(
    contract.productionRecovery,
    "runtime_state_docker_task_recovery_and_deferred_host_finalization_connected",
  );
  assert.equal(
    contract.productionMountCompletion,
    "runtime_owned_mount_lease_connected",
  );
  assert.equal(
    contract.productionRevisionBinding,
    "runtime_owned_repository_revision_connected",
  );
  assert.equal(contract.productionEffectExecutor, "fixed_docker_cli_connected");
  assert.equal(
    contract.providerFailureClassification,
    "known_operational_nonzero_output_mapped_to_closed_public_reason_unknown_output_kept_generic",
  );
});

/**
 * 登録した呼出しだけへ既存開始観測を搬送する。
 *
 * @responsibility 診断Reporterと呼出し単位の通知が順序付きで共存することを確認する。
 * @trace ERB-IT-002
 * @precondition 外部Effectのない既存Controller Fixtureを使用する。
 * @stimulus 二つのControllerへ別の通知を登録し、準備拒否例も実行する。
 * @observation 通知順序、固定本文、完了とcleanupを取得する。
 * @oracle 診断後に登録先へ一回だけ通知し、別操作・準備失敗へ搬送しない。
 * @cleanup Fixtureの元の完了をすべて待ち、実DockerやFilesystemを操作しない。
 * @boundary ERB-IT-002=Direct Boundary: Controllerから呼出し単位の開始観測。
 */
test("呼出し単位の開始通知は診断後に一回だけ搬送される", async () => {
  for (const id of ["first", "second"]) {
    const observations: string[] = [];
    const fixture = createFixture({
      reportProviderProcessStarted: async () => {
        observations.push("diagnostic");
        return true;
      },
    });
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
      () => true,
      undefined,
      async (notice) => {
        observations.push(id);
        assert.deepEqual(notice, {
          event: "coordinator_provider_process_started",
          provider: "claude",
          taskRole: null,
          operationId: "OP-123456",
        });
        assert.equal(Object.isFrozen(notice), true);
        return true;
      },
    );
    const result = await started.completion;
    assert.equal(result?.status, "completed");
    assert.equal(result?.cleanupConfirmed, true);
    assert.deepEqual(observations, ["diagnostic", id]);
  }
  let rejectedNoticeCount = 0;
  const rejected = createFixture({ verifyRevision: () => false });
  const result = rejected.controller.start(
    rejected.preparedCapability,
    rejected.managementCapability,
    () => true,
    undefined,
    () => {
      rejectedNoticeCount += 1;
      return true;
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(rejectedNoticeCount, 0);
});

/**
 * 登録通知の失敗を既存の開始観測失敗へ収束させる。
 *
 * @responsibility false・例外で成功を返さず、元のProcess終了・資源回収を維持する。
 * @trace ERB-IT-002
 * @precondition Controller Fixtureの開始観測は成功する。
 * @stimulus 登録通知がfalseまたは例外になる二例を実行する。
 * @observation 元の失敗理由、開始観測事実とcleanupを取得する。
 * @oracle 開始観測失敗としてblockedとなり、開始済み事実を消さずcleanupを確認する。
 * @cleanup 元の完了を待ち、実DockerやFilesystemを操作しない。
 * @boundary ERB-IT-002=Direct Boundary: 呼出し通知とController取消・回収。
 */
test("呼出し単位の開始通知失敗は既存回収経路へ収束する", async () => {
  for (const mode of ["false", "throw"]) {
    const fixture = createFixture();
    const started = fixture.controller.start(
      fixture.preparedCapability,
      fixture.managementCapability,
      () => true,
      undefined,
      async () => {
        if (mode === "throw") throw new Error("fixed_observer_failure");
        return false;
      },
    );
    const result = await started.completion;
    assert.equal(result?.status, "blocked");
    assert.equal(
      result?.reason,
      "docker_process_controller_provider_start_observation_failed",
    );
    assert.equal(result?.providerRequestStarted, true);
    assert.equal(result?.cleanupConfirmed, true);
  }
});

/**
 * 通知待機中の取消を元の実行完了へ収束させる。
 *
 * @responsibility 通知待機を別実行に切り離さず、取消後の終了観測を維持する。
 * @trace ERB-IT-002
 * @precondition Fakeの開始観測成功後に登録ハンドラーを保留できる。
 * @stimulus 通知を保留し、同じ制御参照へ取消を渡してから通知を解放する。
 * @observation 完了前の保留、最終status、取消とcleanupを取得する。
 * @oracle 通知保留中に完了せず、解放後は同じ実行がcancelledとcleanup確認へ収束する。
 * @cleanup 保留通知を解放し、元の完了を待つ。実Dockerは操作しない。
 * @boundary ERB-IT-002=Direct Boundary: 登録通知待機とController取消。
 */
test("呼出し単位の開始通知待機中も元の取消と完了を維持する", async () => {
  let entered!: () => void;
  let release!: (value: boolean) => void;
  const notificationEntered = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const notificationResult = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  const fixture = createFixture();
  const started = fixture.controller.start(
    fixture.preparedCapability,
    fixture.managementCapability,
    () => true,
    undefined,
    () => {
      entered();
      return notificationResult;
    },
  );
  let finished = false;
  const completion = started.completion?.then((value) => {
    finished = true;
    return value;
  });
  await notificationEntered;
  assert.equal(finished, false);
  await fixture.controller.cancel(
    started.controlCapability,
    fixture.managementCapability,
  );
  assert.equal(finished, false);
  release(true);
  const result = await completion;
  assert.equal(result?.status, "cancelled");
  assert.equal(result?.cleanupConfirmed, true);
});
