import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelRuntimeOwnedDockerProcessController,
  createIsolatedDockerProcessControllerCandidate,
  describeDockerProcessControllerContract,
  startRuntimeOwnedDockerProcessController,
} from "../src/security/docker-process-controller.ts";

function createPlan(
  activeMountCapability: object,
  authorityUseCapability: object,
) {
  const suffix = "0101010101010101";
  const purposes = [
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
    selectedModel: "opus",
    selectedEffort: "low" as const,
    selectedModelTier: "preferred",
    commands: Object.freeze(
      purposes.map((purpose) =>
        Object.freeze({ purpose, argv: Object.freeze([purpose]) }),
      ),
    ),
  });
}

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

function createFixture(overrides: Record<string, unknown> = {}) {
  const managementCapability = Object.freeze({});
  const preparedCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  const plan = createPlan(activeMountCapability, authorityUseCapability);
  let mountCompletionCount = 0;
  let recoveryCompletionCount = 0;
  let commandCount = 0;
  let cleanupCount = 0;
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
        recoveryId: "docker.runtime.RECOVERY-123456",
        recoveryCapability,
      }),
    startCommand: (command: { purpose: string }) => {
      commandCount += 1;
      const isProvider = command.purpose === "start_provider_attached";
      return Object.freeze({
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout: isProvider ? createProviderOutput() : "",
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
      return Object.freeze({ status: "completed" });
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
  };
}

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
  assert.equal(fixture.getCommandCount(), 7);
  assert.equal(fixture.getCleanupCount(), 1);
  assert.equal(fixture.getMountCompletionCount(), 1);
  assert.equal(fixture.getRecoveryCompletionCount(), 1);
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
              stdout: "",
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
            stdout: "",
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
  assert.equal(result.recoveryId, "docker.runtime.RECOVERY-123456");
  assert.equal(result.resultSha256, null);
  assert.equal(result.resultBytes, 0);
  assert.equal(result.normalizedResult, null);
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
  assert.equal(contract.contractRevision, 6);
  assert.match(contract.providerAuthority, /consumed_before/u);
  assert.equal(
    contract.structuredResult,
    "exact_provider_boolean_result_published_after_cleanup_only",
  );
  assert.equal(contract.rawOutputReported, false);
  assert.equal(contract.hostPathReported, false);
  assert.equal(contract.proxyCredentialReported, false);
  assert.equal(
    contract.productionPreparedPlan,
    "runtime_owned_adapter_connected",
  );
  assert.equal(contract.productionRecovery, "durable_host_recovery_connected");
  assert.equal(
    contract.productionMountCompletion,
    "runtime_owned_mount_lease_connected",
  );
  assert.equal(
    contract.productionRevisionBinding,
    "runtime_owned_repository_revision_connected",
  );
  assert.equal(contract.productionEffectExecutor, "fixed_docker_cli_connected");
});
