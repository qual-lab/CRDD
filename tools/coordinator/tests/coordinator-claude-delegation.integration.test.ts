import assert from "node:assert/strict";
import test from "node:test";

import { createIsolatedClaudeDockerRuntimeAdapterCandidate } from "../src/security/claude-docker-runtime-adapter.ts";
import { createIsolatedDelegationSelectionGrantRuntimeCandidate } from "../src/security/delegation-selection-grant-runtime.ts";
import { createIsolatedDockerProcessControllerCandidate } from "../src/security/docker-process-controller.ts";
import { createIsolatedProviderAuthorityRuntimeCandidate } from "../src/security/provider-authority-runtime.ts";

test("Codex frontから選定理由付きClaude委譲をcleanup済みResultまで接続する", async () => {
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  let randomValue = 0;
  let mountCompletionCount = 0;
  let recoveryCompletionCount = 0;
  const authorityRuntime = createIsolatedProviderAuthorityRuntimeCandidate({
    verifyOperation: (capability: unknown) => {
      assert.equal(capability, managementCapability);
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
      });
    },
    inspectActiveMount: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return Object.freeze({
        status: "active",
        grantRef: "PHMGRANT-123456",
        provider: "claude",
        profileId: "PROFILE-123456",
        operationId: "OP-123456",
        providerHomeMountGrantIssued: true,
        providerHomeMounted: true,
      });
    },
    loadActivatedAuthority: () =>
      Object.freeze({
        profile: Object.freeze({}),
        bundle: Object.freeze({}),
        scopeId: "SCOPE-123456",
      }),
    reverify: (_profile: unknown, _bundle: unknown, context: unknown) => {
      const current = context as Record<string, string>;
      return Object.freeze({
        status: "candidate" as const,
        reason: "runtime_file_bundle_path_acl_and_activation_required",
        verification: Object.freeze({
          profileHash: "1".repeat(64),
          registryId: "AUTHREG-123456",
          registryRevision: 1,
          registryHash: "2".repeat(64),
          grantRef: "AUTH-123456",
          grantRevision: 1,
          provider: current.provider as string,
          profileId: current.profileId as string,
          operationId: current.operationId as string,
          scopeId: current.scopeId as string,
          providerHomeMountGrantRef:
            current.providerHomeMountGrantRef as string,
          providerHomeMountGrantIssued: false,
          providerHomeMountGrantVerification: "runtime_capability_required",
          bundleId: "AUTHBUNDLE-123456",
          bundleRevision: 1,
          bundleHash: "3".repeat(64),
          trustPolicyId: "AUTHPOL-123456",
          trustPolicyRevision: 1,
          trustPolicyHash: "4".repeat(64),
          evaluatedAt: "2026-08-24T00:00:00.000Z",
          validUntil: "2026-08-25T00:00:00.000Z",
          prelaunchCheckedAt: "2026-08-24T00:00:00.000Z",
        }),
        runtimeCapabilityIssued: false,
      });
    },
    wallNow: () => 1_000,
    monotonicNow: () => 2_000,
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
  });
  const selectionRuntime =
    createIsolatedDelegationSelectionGrantRuntimeCandidate({
      verifyOperation: (candidate: unknown) => {
        assert.equal(candidate, managementCapability);
        return Object.freeze({
          operationId: "OP-123456",
          createdAt: "2026-08-24T00:00:00.000Z",
        });
      },
      observeProviderEligibility: () =>
        Object.freeze([
          Object.freeze({
            provider: "codex" as const,
            status: "eligible" as const,
            reason: "ready" as const,
          }),
          Object.freeze({
            provider: "claude" as const,
            status: "eligible" as const,
            reason: "ready" as const,
          }),
        ]),
      resolveModelProfile: (request) =>
        Object.freeze({
          provider: request.provider,
          profileId: "PROFILE-123456",
          exactModelId: "claude-opus-test-profile",
          family: request.family,
          modelTier: request.modelTier,
          speedMode: "normal" as const,
          billingMode: "subscription_oauth" as const,
        }),
      wallNow: () => 1_000,
      monotonicNow: () => 2_000,
      randomBytes: (size: number) => {
        randomValue += 1;
        return Buffer.alloc(size, randomValue);
      },
    });
  const issued = selectionRuntime.issue(managementCapability, {
    frontProvider: "codex",
    delegationNeed: "beneficial",
    delegationReason: "specialized_executor_benefit",
    requestedExecutorProvider: "auto",
    subjectProvider: null,
    requiresIndependentProvider: false,
    role: "executor",
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
    operationId: "OP-123456",
    parentOperationId: null,
    ancestorOperationIds: [],
    delegationDepth: 0,
  });
  assert.equal(issued.status, "issued");
  assert.equal(issued.route, "front_codex__executor_claude");
  assert.match(issued.selectionNotice ?? "", /経路選定理由/);

  const completeMount = (active: unknown, management: unknown) => {
    assert.equal(active, activeMountCapability);
    assert.equal(management, managementCapability);
    mountCompletionCount += 1;
    return Object.freeze({ status: "completed" });
  };
  const adapter = createIsolatedClaudeDockerRuntimeAdapterCandidate({
    verifyOperationMount: (management: unknown, mount: unknown) => {
      assert.equal(management, managementCapability);
      assert.equal(mount, mountCapability);
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
        mounts: Object.freeze({
          workspace: "C:\\crdd\\operation\\workspace",
          providerHome: "C:\\crdd\\operation\\provider-home",
          tmp: "C:\\crdd\\operation\\tmp",
          events: "C:\\crdd\\operation\\events",
          projection: "C:\\crdd\\operation\\projection",
          management: "C:\\crdd\\operation\\management",
        }),
      });
    },
    activateMount: (authorization: unknown, management: unknown) => {
      assert.equal(authorization, mountAuthorizationCapability);
      assert.equal(management, managementCapability);
      return Object.freeze({
        status: "activated",
        grant: Object.freeze({
          grantRef: "PHMGRANT-123456",
          provider: "claude",
          profileId: "PROFILE-123456",
          operationId: "OP-123456",
          providerHomeIdentityHash: "c".repeat(64),
        }),
        activeMountCapability,
      });
    },
    borrowMountSource: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude";
    },
    completeMount,
    wallNow: () => 1_000,
    monotonicNow: () => 2_000,
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeModelSelection: (useCapability: unknown, management: unknown) =>
      selectionRuntime.consume(useCapability, management),
    issueProviderAuthority: (management: unknown, active: unknown) =>
      authorityRuntime.issue(management, active),
    revokeProviderAuthority: (control: unknown, management: unknown) =>
      authorityRuntime.revoke(control, management),
  });
  const prepared = adapter.prepare(
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    issued.useCapability,
  );
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "claude-opus-test-profile");
  assert.equal(prepared.selectedEffort, "low");

  const purposes: string[] = [];
  const controller = createIsolatedDockerProcessControllerCandidate({
    effectExecutorAvailable: true,
    verifyRevision: () => Object.freeze({ revisionCurrent: true }),
    consumePreparedPlan: (candidate: unknown, management: unknown) =>
      adapter.consumeForProcessController(candidate, management),
    beginRecovery: () =>
      Object.freeze({
        recoveryId: "docker.runtime.RECOVERY-123456",
        recoveryCapability,
      }),
    startCommand: (command) => {
      purposes.push(command.purpose);
      return Object.freeze({
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout:
              command.purpose === "start_provider_attached"
                ? `${JSON.stringify({
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    num_turns: 2,
                    total_cost_usd: 0.04699,
                    structured_output: { status: true },
                  })}\n`
                : command.purpose === "start_subscription_auth_probe_attached"
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
      });
    },
    cleanupOwnedResources: async () =>
      Object.freeze({
        confirmed: true,
        processTreeTerminated: true,
        containersAbsent: true,
        networksAbsent: true,
      }),
    completeMount,
    completeRecovery: (capability: unknown, management: unknown) => {
      assert.equal(capability, recoveryCapability);
      assert.equal(management, managementCapability);
      recoveryCompletionCount += 1;
      return Object.freeze({ status: "completed" });
    },
    consumeProviderAuthority: (
      use: unknown,
      active: unknown,
      management: unknown,
    ) => authorityRuntime.consume(use, active, management),
  });
  const started = controller.start(
    prepared.preparedCapability,
    managementCapability,
  );
  assert.equal(started.status, "started");
  assert.ok(started.completion);
  const result = await started.completion;
  assert.equal(result.status, "completed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.selectionRecordId, issued.selectionRecordId);
  assert.equal(mountCompletionCount, 1);
  assert.equal(recoveryCompletionCount, 1);
  assert.deepEqual(purposes, [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ]);
});
