import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelRuntimeOwnedClaudeDockerCandidate,
  createIsolatedClaudeDockerRuntimeAdapterCandidate,
  describeClaudeDockerRuntimeAdapterContract,
  prepareRuntimeOwnedClaudeDockerCandidate,
} from "../src/security/claude-docker-runtime-adapter.ts";

const MODEL_SELECTION = Object.freeze({
  selectionRecordId: "MODELSEL-12345678",
  profileId: "PROFILE-123456",
  model: "claude-opus-test-profile",
  basis: Object.freeze({
    provider: "claude" as const,
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
});

function createFixture(
  overrides: Partial<
    Parameters<typeof createIsolatedClaudeDockerRuntimeAdapterCandidate>[0]
  > = {},
) {
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  let wallClockMs = 1_000;
  let monotonicMs = 2_000;
  let completionCount = 0;
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
          provider: "claude",
          profileId: "PROFILE-123456",
          operationId: "OP-123456",
        }),
        activeMountCapability,
      });
    },
    borrowMountSource: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude";
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
    modelSelection: MODEL_SELECTION,
    ...overrides,
  };
  const adapter =
    createIsolatedClaudeDockerRuntimeAdapterCandidate(dependencies);
  return {
    adapter,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    getCompletionCount: () => completionCount,
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
  );
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "claude-opus-test-profile");
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
  assert.equal(plan.selectionRecordId, "MODELSEL-12345678");
  const purposes = plan.commands.map((candidate) => candidate.purpose);
  assert.deepEqual(purposes, [
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_internal",
    "connect_proxy_egress",
    "create_provider",
    "connect_provider_internal",
    "start_proxy",
    "start_provider_attached",
  ]);
  const internalNetwork = plan.commands[0]?.argv ?? [];
  assert.equal(internalNetwork.includes("--internal"), true);
  const provider = plan.commands.find(
    (candidate) => candidate.purpose === "create_provider",
  );
  assert.ok(provider);
  assert.equal(provider.argv.includes("--pull=never"), true);
  assert.equal(provider.argv.includes("--network=none"), true);
  assert.equal(provider.argv.includes("--read-only"), true);
  assert.equal(provider.argv.includes("--fallback-model"), false);
  const modelIndex = provider.argv.indexOf("--model");
  const effortIndex = provider.argv.indexOf("--effort");
  assert.equal(provider.argv[modelIndex + 1], "claude-opus-test-profile");
  assert.equal(provider.argv[effortIndex + 1], "low");
  assert.equal(
    provider.argv.some((value) => value.startsWith("ANTHROPIC_API_KEY=")),
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
  );
  const cancelled = fixture.adapter.cancel(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(fixture.getCompletionCount(), 1);
  assert.equal(
    fixture.adapter.cancel(
      prepared.preparedCapability,
      fixture.managementCapability,
    ).status,
    "blocked",
  );
});

test("期限切れprepared planはProvider EffectなしでMount leaseを回収する", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
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
    modelSelection: Object.freeze({
      ...MODEL_SELECTION,
      profileId: "PROFILE-DIFFERENT",
    }),
  });
  const prepared = fixture.adapter.prepare(
    fixture.managementCapability,
    fixture.mountCapability,
    fixture.mountAuthorizationCapability,
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "claude_docker_runtime_plan_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

test("production adapterは未発行のCapabilityと未接続Selection Grantを拒否する", () => {
  const prepared = prepareRuntimeOwnedClaudeDockerCandidate({}, {}, {});
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.providerRequestIssued, false);
  assert.equal(
    cancelRuntimeOwnedClaudeDockerCandidate({}, {}).status,
    "blocked",
  );
});

test("公開契約はCoordinator選定とProvider fallbackを分離する", () => {
  const contract = describeClaudeDockerRuntimeAdapterContract();
  assert.equal(contract.coordinatorPrelaunchModelSelectionAllowed, true);
  assert.equal(contract.providerAutomaticModelSwitchingAllowed, false);
  assert.equal(contract.midExecutionModelSwitchingAllowed, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.highCostSelection, "decisive_reason_required");
  assert.equal(contract.fallbackModelArgumentAllowed, false);
  assert.equal(contract.providerDirectEgress, false);
  assert.equal(contract.commandPlanReported, false);
  assert.equal(contract.processController, "not_implemented_step_4");
});
