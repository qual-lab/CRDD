import assert from "node:assert/strict";
import {
  projectRuntimeOwnedDockerProcessCompletionForTask,
  projectRuntimeOwnedDockerProcessStartForTask,
} from "../../src/security/coordinator-task-runtime.ts";
import { createIsolatedDockerProcessControllerCandidate } from "../../src/security/docker-process-controller.ts";
import { createOwnedProcessTreeFixture } from "./docker-owned-process-test-support.ts";

// Only Node descendants are real. Docker, authentication and durable recovery
// are explicit fixture contracts; no production Authority is issued.
export function createTaskControllerCancellationFixture(
  operationId: string,
  managementCapability: object,
  hostRecoveryId: string,
  dockerCleanupConfirmed: boolean,
) {
  const processes = createOwnedProcessTreeFixture();
  const preparedCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  const stableLogicalHomeBindingHash = "d".repeat(64);
  const recoveryId = `docker-task.${stableLogicalHomeBindingHash}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const events: string[] = [];
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
  const plan = Object.freeze({
    provider: "claude" as const,
    operationId,
    grantRef: "PHMGRANT-123456",
    profileId: "PROFILE-200001",
    activeMountCapability,
    authorityUseCapability,
    providerHomeSourcePath: "C:\\fixture\\claude-home",
    providerHomeIdentityHash: "a".repeat(64),
    providerHomeProtectionHash: "b".repeat(64),
    localUserBindingHash: "c".repeat(64),
    stableLogicalHomeBindingHash,
    authContainerName: "crdd-auth-0101010101010101",
    providerContainerName: "crdd-claude-0101010101010101",
    proxyContainerName: "crdd-proxy-0101010101010101",
    internalNetworkName: "crdd-internal-0101010101010101",
    egressNetworkName: "crdd-egress-0101010101010101",
    ownershipLabel: "crdd.coordinator.runtime=0101010101010101",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    selectionRecordId: "MODELSEL-12345678",
    subscriptionOffering: "claude_max" as const,
    selectedModel: "opus",
    selectedEffort: "low" as const,
    selectedModelTier: "preferred",
    operationMode: "isolated_task" as const,
    taskRole: "executor" as const,
    taskPacketRef: `TASKPKT-${"A".repeat(32)}`,
    taskPacketHash: "c".repeat(64),
    providerInput: "fixed fixture only",
    workspaceSourcePath: "C:\\fixture\\workspace",
    workspaceMountMode: "read_write" as const,
    commands: purposes.map((purpose) =>
      Object.freeze({ purpose, argv: [purpose] }),
    ),
  });
  let startProjections = 0;
  let completionProjections = 0;
  let terminationCount = 0;
  let processStarted = false;
  let controllerControl: object | null = null;
  const controller = createIsolatedDockerProcessControllerCandidate({
    effectExecutorAvailable: true,
    verifyRevision: () => ({ revisionCurrent: true }),
    consumePreparedPlan: (prepared, management) => {
      assert.equal(prepared, preparedCapability);
      assert.equal(management, managementCapability);
      return plan;
    },
    beginRecovery: () => ({ status: "ready", recoveryId, recoveryCapability }),
    verifyRecoveryBinding: (capability, id, management, home) =>
      capability === recoveryCapability &&
      id === recoveryId &&
      management === managementCapability &&
      home === stableLogicalHomeBindingHash,
    abandonRecovery: (capability) => capability === recoveryCapability,
    consumeProviderAuthority: (use, active, management) => {
      assert.equal(use, authorityUseCapability);
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return {
        operationId,
        provider: "claude",
        profileId: plan.profileId,
        providerHomeMountGrantRef: plan.grantRef,
        runtimeAuthorityIssued: true,
        providerEffectAllowed: true,
      };
    },
    startCommand: (command) => {
      if (command.purpose === "start_provider_attached") {
        const owned = processes.start();
        processStarted = true;
        events.push("process-start");
        return {
          wait: owned.wait,
          terminateAndWait: async (graceMs) => {
            terminationCount += 1;
            const closed = await owned.terminateAndWait(graceMs);
            return closed;
          },
        };
      }
      return {
        wait: async () => ({
          status: 0,
          signal: null,
          stdout:
            command.purpose === "start_subscription_auth_probe_attached"
              ? JSON.stringify({
                  loggedIn: true,
                  authMethod: "claude.ai",
                  apiProvider: "firstParty",
                  forcedLoginMethod: "claudeai",
                  subscriptionType: "max",
                })
              : "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => true,
      };
    },
    cleanupOwnedResources: async () => {
      processes.assertAbsent();
      events.push("process-absence-observed");
      events.push("docker-cleanup");
      return {
        confirmed: dockerCleanupConfirmed,
        processTreeTerminated: true,
        containersAbsent: dockerCleanupConfirmed,
        networksAbsent: dockerCleanupConfirmed,
      };
    },
    completeMount: () => {
      events.push("mount-complete");
      return { status: "completed" };
    },
    completeRecovery: (capability) => {
      assert.equal(capability, recoveryCapability);
      events.push("recovery-finalizable");
      return {
        status: "completed",
        recoveryFinalizationCapability: recoveryCapability,
      };
    },
    markResourceSubmission: () => true,
    recordResourceReceipt: () => true,
    recordDockerAbsence: () => {
      events.push("docker-absence");
      return true;
    },
    recordMountCompletion: () => {
      events.push("mount-receipt");
      return true;
    },
  });
  return {
    preparedCapability,
    recoveryId,
    events,
    productionAuthority: controller.productionAuthority,
    processes,
    processStarted: () => processStarted,
    projectionCounts: () => [startProjections, completionProjections],
    terminationCount: () => terminationCount,
    async assertControllerExpired() {
      assert.ok(controllerControl);
      assert.deepEqual(
        await controller.cancel(controllerControl, managementCapability),
        { status: "blocked", reason: "invalid" },
      );
    },
    startProcess: (
      prepared: unknown,
      management: unknown,
      registerHandoff: (capability: unknown, id: unknown) => boolean,
      restriction?: unknown,
    ) => {
      const raw = controller.start(
        prepared,
        management,
        registerHandoff,
        restriction,
      );
      const projected = projectRuntimeOwnedDockerProcessStartForTask(
        raw,
        recoveryId,
        operationId,
      );
      assert.ok(projected);
      assert.equal(projected.status, "started");
      startProjections += 1;
      controllerControl = projected.controlCapability as object;
      assert.ok(projected.completion instanceof Promise);
      return {
        ...projected,
        completion: projected.completion.then((result: unknown) => {
          const completion = projectRuntimeOwnedDockerProcessCompletionForTask(
            result,
            recoveryId,
            operationId,
          );
          assert.ok(completion);
          completionProjections += 1;
          return completion;
        }),
      };
    },
    cancelProcess: controller.cancel,
    prepareDockerHostCleanup: (capability: unknown) => {
      assert.equal(capability, recoveryCapability);
      assert.ok(events.includes("recovery-finalizable"));
      events.push("host-intent");
      return hostRecoveryId;
    },
    recordDockerHostCleanupReceipt: (capability: unknown) => {
      assert.equal(capability, recoveryCapability);
      assert.ok(events.includes("host-cleanup"));
      events.push("host-receipt");
      return true;
    },
    finalizeDockerRecovery: (capability: unknown) => {
      assert.equal(capability, recoveryCapability);
      assert.ok(events.includes("host-receipt"));
      events.push("docker-finalize");
      return { status: "completed" };
    },
  };
}
