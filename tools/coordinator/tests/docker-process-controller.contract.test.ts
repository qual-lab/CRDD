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
        recoveryId: "docker.runtime.RECOVERY-123456",
        recoveryCapability,
      }),
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
});

test("隔離TaskのRole別Resultだけをcleanup後に公開する", async () => {
  const taskOutput = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 3,
    total_cost_usd: 0.12,
    structured_output: {
      decision: "approved",
      summary: "The exact candidate is acceptable.",
      findings: [],
    },
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
  });
  assert.equal(result.rawOutputReported, false);
  assert.equal(result.untrustedProviderTextReported, false);
  assert.equal(result.credentialAbsenceVerified, false);
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
  assert.equal(contract.contractRevision, 11);
  assert.match(contract.subscriptionAuthentication, /required_before/u);
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
});
