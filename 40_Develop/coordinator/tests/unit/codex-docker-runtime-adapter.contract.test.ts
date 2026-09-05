import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelRuntimeOwnedCodexDockerCandidate,
  createIsolatedCodexDockerRuntimeAdapterCandidate,
  describeCodexDockerRuntimeAdapterContract,
  prepareRuntimeOwnedCodexDockerCandidate,
} from "../../src/security/codex-docker-runtime-adapter.ts";
import { createIsolatedDelegationSelectionGrantRuntimeCandidate } from "../../src/security/delegation-selection-grant-runtime.ts";

const MODEL_SELECTION = Object.freeze({
  selectionRecordId: "MODELSEL-12345678",
  operationId: "OP-123456",
  frontProvider: "claude" as const,
  executorProvider: "codex" as const,
  route: "front_claude__executor_codex",
  profileId: "PROFILE-100001",
  model: "gpt-5.6-sol",
  basis: Object.freeze({
    provider: "codex" as const,
    role: "executor" as const,
    workClass: "bounded_implementation" as const,
    planState: "complete" as const,
    risk: "low" as const,
    difficulty: "low" as const,
    decisionImpact: "limited" as const,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  }),
  effort: "low" as const,
  modelTier: "preferred",
  speedMode: "normal" as const,
  selectionNotice:
    "[委譲経路選定] front=codex executor=codex\n選定理由=complete_bounded_local_plan\n高コスト選択=no",
  delegationDepth: 1,
});
const taskModelSelection = Object.freeze({
  ...MODEL_SELECTION,
  profileId: "PROFILE-100003",
  model: "gpt-5.5",
});

function createFixture(
  overrides: Partial<
    Parameters<typeof createIsolatedCodexDockerRuntimeAdapterCandidate>[0]
  > = {},
  isTaskMode = false,
) {
  const profileId = isTaskMode ? "PROFILE-100003" : "PROFILE-100001";
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const selectionUseCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const authorityControlCapability = Object.freeze({});
  let wallClockMs = 1_000;
  let monotonicMs = 2_000;
  let completionCount = 0;
  let revocationCount = 0;
  let randomValue = 0;
  const dependencies = {
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
          provider: "codex",
          profileId,
          operationId: "OP-123456",
          providerHomeIdentityHash: "b".repeat(64),
          providerHomeProtectionHash: "e".repeat(64),
          localUserBindingHash: "f".repeat(64),
          stableLogicalHomeBindingHash: "1".repeat(64),
        }),
        activeMountCapability,
      });
    },
    borrowMountSource: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\codex";
    },
    completeMount: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      completionCount += 1;
      return Object.freeze({ status: "completed" });
    },
    wallNow: () => wallClockMs,
    monotonicNow: () => monotonicMs,
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeModelSelection: (selection: unknown, management: unknown) => {
      assert.equal(selection, selectionUseCapability);
      assert.equal(management, managementCapability);
      return isTaskMode ? taskModelSelection : MODEL_SELECTION;
    },
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole: "executor" as const,
        taskPacketHash: "a".repeat(64),
        prompt: "Implement the bounded local candidate.",
        promptTransport: "provider_stdin_only" as const,
      }),
    issueProviderAuthority: (management: unknown, active: unknown) => {
      assert.equal(management, managementCapability);
      assert.equal(active, activeMountCapability);
      return Object.freeze({
        status: "issued",
        useCapability: authorityUseCapability,
        controlCapability: authorityControlCapability,
        operationId: "OP-123456",
        provider: "codex",
        profileId,
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true,
      });
    },
    revokeProviderAuthority: (control: unknown, management: unknown) => {
      assert.equal(control, authorityControlCapability);
      assert.equal(management, managementCapability);
      revocationCount += 1;
      return Object.freeze({ status: "revoked" });
    },
    ...overrides,
  };
  const adapter =
    createIsolatedCodexDockerRuntimeAdapterCandidate(dependencies);
  return {
    adapter,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    getCompletionCount: () => completionCount,
    getRevocationCount: () => revocationCount,
    advanceBeyondLifetime: () => {
      wallClockMs += 30_000;
      monotonicMs += 30_000;
    },
  };
}

test("説明可能な低推論選定を固定Docker command planへ一度だけ結合する", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "gpt-5.6-sol");
  assert.equal(prepared.selectedEffort, "low");
  assert.equal(prepared.selectedModelTier, "preferred");
  assert.match(prepared.selectionNotice ?? "", /選定理由/);
  assert.match(prepared.selectionNotice ?? "", /高コスト選択=no/);
  const publicJson = JSON.stringify(prepared);
  assert.doesNotMatch(publicJson, /Users\\\\person/);
  assert.doesNotMatch(publicJson, /CRDD_PROXY_AUTH/);
  assert.doesNotMatch(publicJson, /create_provider/);

  const plan = fixture.adapter.consumeForProcessController(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  assert.equal(plan.providerContainerName, `crdd-codex-${"b".repeat(16)}`);
  assert.equal(plan.selectionRecordId, "MODELSEL-12345678");
  const purposes = plan.commands.map((candidate) => candidate.purpose);
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
  const authProbe = plan.commands[0];
  assert.equal(authProbe?.purpose, "create_subscription_auth_probe");
  assert.deepEqual(
    authProbe?.argv.filter((value) => value.startsWith("--network")),
    ["--network=none"],
  );
  const internalNetworkArguments = plan.commands[2]?.argv ?? [];
  assert.equal(internalNetworkArguments.includes("--internal"), true);
  const provider = plan.commands.find(
    (candidate) => candidate.purpose === "create_provider",
  );
  assert.ok(provider);
  assert.equal(provider.argv.includes("--pull=never"), true);
  assert.equal(provider.argv.includes("--network=none"), false);
  assert.match(
    provider.argv[provider.argv.indexOf("--network") + 1] ?? "",
    /^crdd-internal-/u,
  );
  assert.equal(provider.argv.includes("--read-only"), true);
  assert.equal(provider.argv.includes("--fallback-model"), false);
  const modelIndex = provider.argv.indexOf("--model");
  assert.equal(provider.argv[modelIndex + 1], "gpt-5.6-sol");
  assert.equal(provider.argv.includes('model_reasoning_effort="low"'), true);
  const proxyUrl = provider.argv
    .find((value) => value.startsWith("HTTPS_PROXY="))
    ?.slice("HTTPS_PROXY=".length);
  assert.match(proxyUrl ?? "", /^http:\/\/crdd:[a-f0-9]{64}@proxy:8080$/u);
  assert.equal(provider.argv.includes(`HTTP_PROXY=${proxyUrl}`), true);
  assert.equal(provider.argv.includes(`ALL_PROXY=${proxyUrl}`), true);
  assert.equal(provider.argv.includes("NO_PROXY="), true);
  assert.equal(
    provider.argv.some((value) => value.startsWith("OPENAI_API_KEY=")),
    false,
  );
  assert.equal(
    fixture.adapter.consumeForProcessController(
      prepared.preparedCapability,
      fixture.managementCapability,
    ),
    null,
  );
});

test("cancelはMount leaseを完了しprepared capabilityを再利用不能にする", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  const cancelled = fixture.adapter.cancel(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(fixture.getCompletionCount(), 1);
  assert.equal(fixture.getRevocationCount(), 1);
  assert.equal(
    fixture.adapter.cancel(
      prepared.preparedCapability,
      fixture.managementCapability,
    ).status,
    "blocked",
  );
});

test("Task Packetをstdin専用入力と隔離workspace RW mountへ結合する", () => {
  const fixture = createFixture({}, true);
  const prepared = fixture.adapter.prepareTask(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
    Object.freeze({}),
  );
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "gpt-5.5");
  const plan = fixture.adapter.consumeForProcessController(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  assert.equal(plan.operationMode, "isolated_task");
  assert.equal(plan.taskRole, "executor");
  assert.equal(plan.workspaceMountMode, "read_write");
  assert.equal(plan.providerInput, "Implement the bounded local candidate.");
  const argv = plan.commands.flatMap((command) => command.argv);
  assert.equal(argv.includes(plan.providerInput), false);
  assert.equal(argv.includes("--interactive"), true);
  assert.equal(
    argv.some(
      (value) => value.includes("dst=/work") && !value.includes("readonly"),
    ),
    true,
  );
});

test("期限切れprepared planはProvider EffectなしでMount leaseを回収する", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  fixture.advanceBeyondLifetime();
  assert.equal(
    fixture.adapter.consumeForProcessController(
      prepared.preparedCapability,
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.getCompletionCount(), 1);
});

test("Profile不一致または高コスト根拠不正ではplanを作らずleaseを回収する", () => {
  const fixture = createFixture({
    consumeModelSelection: () =>
      Object.freeze({
        ...MODEL_SELECTION,
        profileId: "PROFILE-DIFFERENT",
      }),
  });
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_plan_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

test("Selection Grantのopaque use aliasをCodex adapterへ一回だけ接続する", () => {
  let randomValue = 40;
  const selectionRuntime =
    createIsolatedDelegationSelectionGrantRuntimeCandidate({
      verifyOperation: () =>
        Object.freeze({
          operationId: "OP-123456",
          createdAt: "2026-08-24T00:00:00.000Z",
        }),
      observeProviderEligibility: () =>
        Object.freeze([
          Object.freeze({
            provider: "claude",
            status: "eligible",
            reason: "ready",
          }),
          Object.freeze({
            provider: "codex",
            status: "eligible",
            reason: "ready",
          }),
        ]),
      resolveModelProfile: (request) =>
        Object.freeze({
          provider: request.provider,
          profileId: "PROFILE-100003",
          exactModelId: "gpt-5.5",
          family: request.family,
          selectionRole: request.role,
          modelTier: request.modelTier,
          speedMode: "normal",
          billingMode: "subscription_oauth",
          compatibilityReason:
            "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
        }),
      wallNow: () => 1_000,
      monotonicNow: () => 2_000,
      randomBytes: (size: number) => {
        randomValue += 1;
        return Buffer.alloc(size, randomValue);
      },
    });
  const fixture = createFixture(
    {
      consumeModelSelection: (selection, management) =>
        selectionRuntime.consume(selection, management),
    },
    true,
  );
  const issued = selectionRuntime.issue(fixture.managementCapability, {
    frontProvider: "claude",
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

  const prepared = fixture.adapter.prepareTask(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    issued.useCapability,
    Object.freeze({}),
  );
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectionRecordId, issued.selectionRecordId);
  assert.equal(prepared.selectedModel, issued.selectedModel);
  assert.equal(
    selectionRuntime.consume(
      issued.useCapability,
      fixture.managementCapability,
    ),
    null,
  );
});

test("Selection GrantをconsumeできなければMount leaseだけ回収して停止する", () => {
  const fixture = createFixture({
    consumeModelSelection: () => null,
  });
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_model_selection_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

test("Provider Authorityを発行できなければMount leaseを返しPlanを作らない", () => {
  const fixture = createFixture({
    issueProviderAuthority: () =>
      Object.freeze({
        status: "blocked",
        useCapability: null,
        controlCapability: null,
        operationId: null,
        provider: null,
        profileId: null,
        providerHomeMountGrantRef: null,
        runtimeAuthorityIssued: false,
      }),
  });
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_authority_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

test("不一致の発行済みProvider Authorityは失効してMount leaseを返す", () => {
  let revocations = 0;
  const fixture = createFixture({
    issueProviderAuthority: () =>
      Object.freeze({
        status: "issued",
        useCapability: Object.freeze({}),
        controlCapability: Object.freeze({}),
        operationId: "OP-123456",
        provider: "codex",
        profileId: "PROFILE-DIFFERENT",
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true,
      }),
    revokeProviderAuthority: () => {
      revocations += 1;
      return Object.freeze({ status: "revoked" });
    },
  });
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_authority_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
  assert.equal(revocations, 1);
});

test("prepared取消はAuthority失効とMount解放の両方を要求する", () => {
  const fixture = createFixture({
    revokeProviderAuthority: () => Object.freeze({ status: "blocked" }),
  });
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
    fixture.selectionUseCapability,
  );
  assert.equal(prepared.status, "prepared");
  const cancelled = fixture.adapter.cancel(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(cancelled.status, "blocked");
  assert.equal(
    cancelled.reason,
    "codex_docker_runtime_authority_revoke_invalid",
  );
  assert.equal(fixture.getCompletionCount(), 1);
});

test("production adapterは未発行のCapabilityと未接続Selection Grantを拒否する", () => {
  const prepared = prepareRuntimeOwnedCodexDockerCandidate({}, {}, {}, {});
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.providerRequestIssued, false);
  assert.equal(
    cancelRuntimeOwnedCodexDockerCandidate({}, {}).status,
    "blocked",
  );
});

test("公開契約はCoordinator選定とProvider fallbackを分離する", () => {
  const contract = describeCodexDockerRuntimeAdapterContract();
  assert.equal(contract.contractRevision, 6);
  assert.equal(
    contract.providerHomeCrossProcessLease,
    "docker_global_provider_home_identity_container_name_fail_closed",
  );
  assert.equal(contract.coordinatorPrelaunchModelSelectionAllowed, true);
  assert.equal(contract.providerAutomaticModelSwitchingAllowed, false);
  assert.equal(contract.midExecutionModelSwitchingAllowed, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.highCostSelection, "decisive_reason_required");
  assert.equal(contract.fallbackModelArgumentAllowed, false);
  assert.equal(contract.subscriptionOffering, "chatgpt_subscription_oauth");
  assert.equal(contract.providerDirectEgress, false);
  assert.deepEqual(contract.providerProxyEnvironment, [
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "NO_PROXY_EMPTY",
  ]);
  assert.equal(contract.commandPlanReported, false);
  assert.match(contract.providerAuthority, /short_lived/u);
  assert.equal(
    contract.processController,
    "production_runtime_owned_controller_and_fixed_docker_effect_connected",
  );
});
