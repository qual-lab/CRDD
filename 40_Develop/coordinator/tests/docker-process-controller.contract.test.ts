import assert from "node:assert/strict";
import test from "node:test";
import { bindTaskCliCancellationSignals } from "../src/core/task-cli-cancellation.ts";
import {
  projectRuntimeOwnedDockerProcessCompletionForTask,
  projectRuntimeOwnedDockerProcessStartForTask,
} from "../src/security/coordinator-task-runtime.ts";
import { createDevelopmentMeasurementConstraints } from "../src/security/development-measurement-constraints.ts";
import type { OwnedCommandHandle } from "../src/security/docker-owned-process.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  createIsolatedDockerProcessControllerCandidate,
  describeDockerProcessControllerContract,
  projectDockerProcessControllerCompletionResult,
  projectDockerProcessControllerStartResult,
  startRuntimeOwnedDockerProcessController,
} from "../src/security/docker-process-controller.ts";
import { createOwnedProcessTreeFixture } from "./fixtures/docker-owned-process-test-support.ts";

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

function assertCompletionAcceptedByAll(value: unknown, recoveryId: unknown) {
  for (const projectCompletion of completionProjectors)
    assert.ok(projectCompletion(value, recoveryId, "OP-123456"));
}

function assertCompletionRejectedByAll(value: unknown, recoveryId: unknown) {
  for (const projectCompletion of completionProjectors)
    assert.equal(projectCompletion(value, recoveryId, "OP-123456"), null);
}

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
  const dependencies = {
    effectExecutorAvailable: true,
    verifyRevision: () => Object.freeze({ revisionCurrent: true }),
    consumePreparedPlan: (prepared: unknown, management: unknown) => {
      assert.equal(prepared, preparedCapability);
      assert.equal(management, managementCapability);
      return plan;
    },
    beginRecovery: () =>
      Object.freeze({
        status: "ready" as const,
        recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
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
    recordDockerAbsence: () => {
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
    managementCapability,
    preparedCapability,
    getCommandCount: () => commandCount,
    getCleanupCount: () => cleanupCount,
    getMountCompletionCount: () => mountCompletionCount,
    getRecoveryCompletionCount: () => recoveryCompletionCount,
    getRecoveryEvents: () => [...recoveryEvents],
  };
}

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
  test(`CREATE取消競合は${purpose}の正常IDをcleanup前に保存する`, async () => {
    const result = await runCreateCancellationRace(purpose, "valid", true);
    assert.equal(result.status, "cancelled");
    assert.equal(result.reason, "provider_operation_cancelled");
  });
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
      nonzero: "docker_setup_command_failed",
      signal: "provider_process_signalled",
      output_limit: "provider_output_limit_exceeded",
    };
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, expectedReasons[outcome]);
  });
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

test("追加制約のtrueは既存Authorityを代替せず、不正Capabilityを起動しない", () => {
  let restrictionCalls = 0;
  let recoveryCalls = 0;
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
  test(`実測制約をControllerへ接続し、準備待機後の${stop}を起動直前に照合する`, async () => {
    let wallTimeMs = 100;
    let bindingSha256 = "1".repeat(64);
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

test("Subscription OAuthを確認できなければProvider request前に停止する", async () => {
  let providerStarted = false;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      if (command.purpose === "start_provider_attached") providerStarted = true;
      return Object.freeze({
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

test("Claude Max以外のSubscription OfferingではProvider request前に停止する", async () => {
  let providerStarted = false;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      if (command.purpose === "start_provider_attached") providerStarted = true;
      return Object.freeze({
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

test("搬送失敗status:nullは出力上限やtimeoutでなく既存の実行失敗へ分類する", async () => {
  for (const [failedPurpose, expectedReason] of [
    ["create_subscription_auth_probe", "docker_setup_command_failed"],
    ["start_provider_attached", "provider_process_exit_nonzero"],
  ] as const) {
    const commands: string[] = [];
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => {
        commands.push(command.purpose);
        return {
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

test("Provider非ゼロ分類はTask本文に似たstdoutと過長・制御文字stderrを診断へ昇格しない", async () => {
  for (const execution of [
    { stdout: "The task says usage limit and OAuth token expired", stderr: "" },
    { stdout: "", stderr: `Service unavailable\0` },
    { stdout: "", stderr: "x".repeat(8_193) },
  ]) {
    const fixture = createFixture({
      startCommand: (command: { purpose: string }) => ({
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

test("provider timeoutは終了要求後もcleanupを必須にする", async () => {
  let terminationCount = 0;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => ({
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
  test(`Windows Process Gate: 取消結合: 実子孫終了後の模擬Docker cleanup=${dockerCleanupConfirmed}`, {
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
            wait: owned.wait,
            terminateAndWait: async (graceMs: number) => {
              terminationCount += 1;
              return owned.terminateAndWait(graceMs);
            },
          };
        }
        return {
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

test("取消はactive processへ一度だけ伝えcleanup後にcancelledになる", async () => {
  let finishProvider: (() => void) | null = null;
  let terminationCount = 0;
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => {
      if (command.purpose !== "start_provider_attached") {
        return {
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

test("Provider Result不正時もcleanupし正規化Resultを公開しない", async () => {
  const fixture = createFixture({
    startCommand: (command: { purpose: string }) => ({
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

test("公開契約はtimeout、cancel、cleanup、Recoveryと秘密非出力を固定する", () => {
  const contract = describeDockerProcessControllerContract();
  assert.equal(contract.setupTimeoutMs, 10_000);
  assert.equal(contract.providerTimeoutMs, 300_000);
  assert.equal(contract.cancellationGraceMs, 5_000);
  assert.equal(contract.recoveryBeforeDockerEffect, true);
  assert.equal(contract.contractRevision, 25);
  assert.match(contract.subscriptionAuthentication, /required_before/u);
  assert.match(contract.subscriptionAuthentication, /stdout_stderr_shape/u);
  assert.match(contract.subscriptionOffering, /exact_match_required/u);
  assert.match(contract.providerAuthority, /consumed_before/u);
  assert.equal(
    contract.structuredResult,
    "exact_provider_boolean_or_role_task_result_published_after_cleanup_only",
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
