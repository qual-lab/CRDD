import assert from "node:assert/strict";
import test from "node:test";

import {
  createIsolatedCoordinatorRuntimeCandidate,
  describeCoordinatorRuntimeContract,
  startRuntimeOwnedCoordinatorOperation,
} from "../src/security/coordinator-runtime.ts";

const DOCKER_RECOVERY_ID = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;

function request(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function fixture(overrides: Record<string, unknown> = {}) {
  const owned = Object.freeze({});
  const mountCapability = Object.freeze({});
  const managementCapability = Object.freeze({});
  const selectionControl = Object.freeze({});
  const selectionUse = Object.freeze({});
  const mountControl = Object.freeze({});
  const mountUse = Object.freeze({});
  const firstObservation = Object.freeze({});
  const secondObservation = Object.freeze({});
  const mountAuthorization = Object.freeze({});
  const preparedCapability = Object.freeze({});
  const processControl = Object.freeze({});
  let observationCount = 0;
  let cleanupCount = 0;
  let selectionRevokeCount = 0;
  let mountRevokeCount = 0;
  let cancelCount = 0;
  const calls: string[] = [];
  const dependencies = {
    inspectRepository: () => {
      calls.push("inspect_repository");
      return Object.freeze({
        status: "candidate",
        runtimeSupported: true,
      });
    },
    createOperation: () => {
      calls.push("create_operation");
      return Object.freeze({
        owned,
        mountCapability,
        managementCapability,
        operationId: "OP-123456",
        hostRecoveryId: "host.fixture.operation",
      });
    },
    cleanupOperation: (candidate: object) => {
      assert.equal(candidate, owned);
      calls.push("cleanup_operation");
      cleanupCount += 1;
    },
    bindRepository: (management: object, repositoryRoot: string) => {
      assert.equal(management, managementCapability);
      assert.equal(repositoryRoot, "C:\\repository");
      calls.push("bind_repository");
      return Object.freeze({ repositoryBound: true as const });
    },
    issueSelection: (management: object, candidate: unknown) => {
      assert.equal(management, managementCapability);
      assert.equal(
        (candidate as { operationId: string }).operationId,
        "OP-123456",
      );
      assert.deepEqual(
        (candidate as { ancestorOperationIds: unknown }).ancestorOperationIds,
        [],
      );
      calls.push("issue_selection");
      return Object.freeze({
        status: "issued",
        executorProvider: "claude",
        profileId: "PROFILE-200001",
        selectionNotice: "経路選定理由: bounded implementation",
        controlCapability: selectionControl,
        useCapability: selectionUse,
      });
    },
    revokeSelection: (control: object, management: object) => {
      assert.equal(control, selectionControl);
      assert.equal(management, managementCapability);
      calls.push("revoke_selection");
      selectionRevokeCount += 1;
      return Object.freeze({ status: "revoked" });
    },
    observeProviderHome: () => {
      observationCount += 1;
      calls.push(`observe_${observationCount}`);
      return Object.freeze({
        status: "candidate",
        observationCapability:
          observationCount === 1 ? firstObservation : secondObservation,
      });
    },
    issueMountGrant: (
      management: object,
      observation: object,
      profileId: string,
    ) => {
      assert.equal(management, managementCapability);
      assert.equal(observation, firstObservation);
      assert.equal(profileId, "PROFILE-200001");
      calls.push("issue_mount");
      return Object.freeze({
        status: "issued",
        controlCapability: mountControl,
        useCapability: mountUse,
      });
    },
    consumeMountGrant: (
      use: object,
      management: object,
      observation: object,
    ) => {
      assert.equal(use, mountUse);
      assert.equal(management, managementCapability);
      assert.equal(observation, secondObservation);
      calls.push("consume_mount");
      return Object.freeze({
        status: "consumed",
        mountAuthorizationCapability: mountAuthorization,
      });
    },
    revokeMountGrant: (control: object, management: object) => {
      assert.equal(control, mountControl);
      assert.equal(management, managementCapability);
      calls.push("revoke_mount");
      mountRevokeCount += 1;
      return Object.freeze({ status: "revoked" });
    },
    prepareProvider: (
      provider: "codex" | "claude",
      management: object,
      mount: object,
      authorization: object,
      selection: object,
    ) => {
      assert.equal(provider, "claude");
      assert.equal(management, managementCapability);
      assert.equal(mount, mountCapability);
      assert.equal(authorization, mountAuthorization);
      assert.equal(selection, selectionUse);
      calls.push("prepare_provider");
      return Object.freeze({
        status: "prepared",
        preparedCapability,
        selectionNotice: "経路選定理由: bounded implementation",
      });
    },
    startProcess: (
      prepared: object,
      management: object,
      registerRecoveryHandoff: (
        capability: unknown,
        recoveryId: unknown,
      ) => boolean,
    ) => {
      assert.equal(prepared, preparedCapability);
      assert.equal(management, managementCapability);
      const recoveryCapability = Object.freeze({});
      assert.equal(
        registerRecoveryHandoff(recoveryCapability, DOCKER_RECOVERY_ID),
        true,
      );
      calls.push("start_process");
      return Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: processControl,
        completion: Promise.resolve(
          Object.freeze({
            status: "completed",
            reason: "completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            normalizedResult: Object.freeze({ status: true }),
            recoveryFinalizationCapability: recoveryCapability,
          }),
        ),
      });
    },
    cancelProcess: async (control: object, management: object) => {
      assert.equal(control, processControl);
      assert.equal(management, managementCapability);
      cancelCount += 1;
      return Object.freeze({ status: "requested" });
    },
    abandonDockerRecovery: () => true,
    prepareDockerHostCleanup: () => "host.fixture.recovery",
    recordDockerHostCleanupReceipt: () => true,
    finalizeDockerRecovery: () => Object.freeze({ status: "completed" }),
    ...overrides,
  };
  const runtime = createIsolatedCoordinatorRuntimeCandidate(
    dependencies as Parameters<
      typeof createIsolatedCoordinatorRuntimeCandidate
    >[0],
  );
  return {
    runtime,
    owned,
    managementCapability,
    selectionControl,
    mountControl,
    calls,
    getCleanupCount: () => cleanupCount,
    getSelectionRevokeCount: () => selectionRevokeCount,
    getMountRevokeCount: () => mountRevokeCount,
    getCancelCount: () => cancelCount,
  };
}

test("RepositoryからClaude Resultまでを理由付き選定と全cleanupへ縦結合する", async () => {
  const h = fixture();
  const started = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(started.status, "started");
  assert.ok(started.controlCapability);
  assert.ok(started.completion);
  const result = (await started.completion) as {
    normalizedResult: unknown;
    cleanupConfirmed: boolean;
    operationRootRemoved: boolean;
    rawOutputReported: boolean;
  };
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.operationRootRemoved, true);
  assert.equal(result.rawOutputReported, false);
  assert.equal(h.getCleanupCount(), 1);
  assert.deepEqual(h.calls, [
    "inspect_repository",
    "create_operation",
    "bind_repository",
    "issue_selection",
    "observe_1",
    "issue_mount",
    "observe_2",
    "consume_mount",
    "prepare_provider",
    "start_process",
    "cleanup_operation",
  ]);
  assert.equal(
    ((await h.runtime.cancel(started.controlCapability)) as { status: string })
      .status,
    "blocked",
  );
});

test("未対応Repository Object FormatはOperation作成前に専用理由で停止する", () => {
  let inspectCount = 0;
  const h = fixture({
    inspectRepository: () => {
      inspectCount += 1;
      return Object.freeze({
        status: "candidate",
        runtimeSupported: false,
      });
    },
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_runtime_git_object_format_unsupported",
  );
  assert.equal(inspectCount, 1);
  assert.deepEqual(h.calls, []);
  assert.equal(h.getCleanupCount(), 0);
});

test("Repository Object Format判定不能はOperation作成前にpreflight failureへ閉じる", () => {
  let inspectCount = 0;
  const h = fixture({
    inspectRepository: () => {
      inspectCount += 1;
      return null;
    },
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_runtime_repository_preflight_failed",
  );
  assert.equal(inspectCount, 1);
  assert.deepEqual(h.calls, []);
  assert.equal(h.getCleanupCount(), 0);
});

test("Front ClaudeからCodex Executorも同じCoordinator仲介で起動する", async () => {
  const h = fixture({
    issueSelection: () =>
      Object.freeze({
        status: "issued",
        executorProvider: "codex",
        profileId: "PROFILE-100001",
        selectionNotice: "cross_provider_route_selected",
        controlCapability: Object.freeze({}),
        useCapability: Object.freeze({}),
      }),
    issueMountGrant: () =>
      Object.freeze({
        status: "issued",
        controlCapability: Object.freeze({}),
        useCapability: Object.freeze({}),
      }),
    consumeMountGrant: () =>
      Object.freeze({
        status: "consumed",
        mountAuthorizationCapability: Object.freeze({}),
      }),
    prepareProvider: (provider: "codex" | "claude") => {
      assert.equal(provider, "codex");
      return Object.freeze({
        status: "prepared",
        preparedCapability: Object.freeze({}),
        selectionNotice: "cross_provider_route_selected",
      });
    },
    startProcess: (
      _prepared: object,
      _management: object,
      registerRecoveryHandoff: (
        capability: unknown,
        recoveryId: unknown,
      ) => boolean,
    ) => {
      const recoveryCapability = Object.freeze({});
      assert.equal(
        registerRecoveryHandoff(recoveryCapability, DOCKER_RECOVERY_ID),
        true,
      );
      return Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: Object.freeze({}),
        completion: Promise.resolve(
          Object.freeze({
            status: "completed",
            reason: "completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            normalizedResult: Object.freeze({ status: true }),
            recoveryFinalizationCapability: recoveryCapability,
          }),
        ),
      });
    },
  });
  const started = h.runtime.start(
    request({ frontProvider: "claude" }),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(started.status, "started");
  const result = (await started.completion) as {
    normalizedResult: unknown;
    cleanupConfirmed: boolean;
  };
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.cleanupConfirmed, true);
});

test("実行中取消をopaque Coordinator CapabilityからProcess Controllerへだけ渡す", async () => {
  let finish: (value: unknown) => void = () => {
    throw new Error("completion resolver unavailable");
  };
  const h = fixture({
    startProcess: () =>
      Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: Object.freeze({}),
        completion: new Promise((resolve) => {
          finish = resolve;
        }),
      }),
    cancelProcess: async () => {
      return Object.freeze({ status: "requested" });
    },
  });
  const started = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(started.status, "started");
  assert.equal(
    ((await h.runtime.cancel(started.controlCapability)) as { status: string })
      .status,
    "requested",
  );
  assert.equal(
    ((await h.runtime.cancel(Object.freeze({}))) as { status: string }).status,
    "blocked",
  );
  finish(
    Object.freeze({
      status: "cancelled",
      reason: "cancelled",
      cleanupConfirmed: true,
      normalizedResult: null,
    }),
  );
  await started.completion;
});

test("Mount Grant consume失敗は未使用Grantを両方失効してEffect前に回収する", () => {
  const h = fixture({
    consumeMountGrant: () =>
      Object.freeze({ status: "blocked", mountAuthorizationCapability: null }),
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_runtime_mount_grant_consume_failed");
  assert.equal(result.providerEffectStarted, false);
  assert.equal(h.getMountRevokeCount(), 1);
  assert.equal(h.getSelectionRevokeCount(), 1);
  assert.equal(h.getCleanupCount(), 1);
});

test("Effect前cleanup失敗はexact Host Recoveryを保持する", () => {
  const h = fixture({
    consumeMountGrant: () =>
      Object.freeze({ status: "blocked", mountAuthorizationCapability: null }),
    cleanupOperation: () => {
      throw new Error("fixture_cleanup_failed");
    },
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_runtime_pre_effect_cleanup_unconfirmed",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.operation");
  assert.deepEqual(result.dockerRecoveryIds, []);
});

test("Docker cleanup不明ならOperation Rootを削除せずmanual Recoveryへ保持する", async () => {
  const h = fixture({
    startProcess: () =>
      Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: Object.freeze({}),
        completion: Promise.resolve(
          Object.freeze({
            status: "blocked",
            reason: "cleanup_unconfirmed",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            normalizedResult: null,
          }),
        ),
      }),
  });
  const started = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  const result = (await started.completion) as {
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
  };
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(h.getCleanupCount(), 0);
});

test("Process Controller起動失敗のcleanupが不明ならOperation Rootを保持する", () => {
  const h = fixture({
    startProcess: () =>
      Object.freeze({
        status: "blocked",
        reason: "start_failed_closed",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        controlCapability: null,
        completion: null,
      }),
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "start_failed_closed");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.hostRecoveryId, "host.fixture.operation");
  assert.equal(h.getCleanupCount(), 0);
});

test("Process Controller起動失敗がexact Docker Recoveryを返したらHost Rootを削除しない", () => {
  const h = fixture({
    startProcess: (
      _prepared: object,
      _management: object,
      _registerRecoveryHandoff: (
        _capability: unknown,
        _recoveryId: unknown,
      ) => boolean,
    ) =>
      Object.freeze({
        status: "blocked",
        reason: "start_failed_after_durable_handoff",
        cleanupConfirmed: true,
        manualRecoveryRequired: true,
        recoveryId: DOCKER_RECOVERY_ID,
        controlCapability: null,
        completion: null,
      }),
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.operation");
  assert.equal(result.dockerRecoveryId, DOCKER_RECOVERY_ID);
  assert.deepEqual(result.dockerRecoveryIds, [DOCKER_RECOVERY_ID]);
  assert.equal(h.getCleanupCount(), 0);
});

test("Process Controllerの不正Recovery IDは公開せずHost Recoveryだけを保持する", () => {
  const h = fixture({
    startProcess: () =>
      Object.freeze({
        status: "blocked",
        reason: "start_failed_after_malformed_recovery",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        recoveryId: "docker.invalid",
        controlCapability: null,
        completion: null,
      }),
  });
  const result = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.operation");
  assert.equal(result.dockerRecoveryId, null);
  assert.deepEqual(result.dockerRecoveryIds, []);
  assert.equal(h.getCleanupCount(), 0);
});

test("Process completionがmanual Recoveryを返したらcleanup trueでもexact IDsを保持する", async () => {
  const recoveryCapability = Object.freeze({});
  const h = fixture({
    startProcess: (
      _prepared: object,
      _management: object,
      registerRecoveryHandoff: (
        capability: unknown,
        recoveryId: unknown,
      ) => boolean,
    ) => {
      assert.equal(
        registerRecoveryHandoff(recoveryCapability, DOCKER_RECOVERY_ID),
        true,
      );
      return Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: Object.freeze({}),
        completion: Promise.resolve(
          Object.freeze({
            status: "blocked",
            reason: "completion_recovery_required",
            cleanupConfirmed: true,
            manualRecoveryRequired: true,
            normalizedResult: null,
            recoveryFinalizationCapability: recoveryCapability,
          }),
        ),
      });
    },
  });
  const started = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  const result = (await started.completion) as Record<string, unknown>;
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.operation");
  assert.equal(result.dockerRecoveryId, DOCKER_RECOVERY_ID);
  assert.deepEqual(result.dockerRecoveryIds, [DOCKER_RECOVERY_ID]);
  assert.equal(h.getCleanupCount(), 0);
});

test("Host cleanup失敗はHostとDockerのexact Recoveryを保持する", async () => {
  const h = fixture({
    cleanupOperation: () => {
      throw new Error("fixture_host_cleanup_failed");
    },
  });
  const started = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  const result = (await started.completion) as Record<string, unknown>;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_runtime_operation_cleanup_unconfirmed",
  );
  assert.equal(result.hostRecoveryId, "host.fixture.operation");
  assert.equal(result.dockerRecoveryId, DOCKER_RECOVERY_ID);
  assert.deepEqual(result.dockerRecoveryIds, [DOCKER_RECOVERY_ID]);
});

test("Host cleanup後のDocker finalize失敗はDocker Recoveryだけを保持する", async () => {
  const h = fixture({
    finalizeDockerRecovery: () => Object.freeze({ status: "blocked" }),
  });
  const started = h.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  const result = (await started.completion) as Record<string, unknown>;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_runtime_recovery_finalize_failed");
  assert.equal(result.operationRootRemoved, true);
  assert.equal(result.hostRecoveryId, null);
  assert.equal(result.dockerRecoveryId, DOCKER_RECOVERY_ID);
  assert.deepEqual(result.dockerRecoveryIds, [DOCKER_RECOVERY_ID]);
  assert.equal(h.getCleanupCount(), 1);
});

test("動的入力とsource checkoutのProduction入口はProvider Effect前に閉じる", () => {
  let getterExecuted = false;
  const dynamic = request();
  Object.defineProperty(dynamic, "frontProvider", {
    enumerable: true,
    get() {
      getterExecuted = true;
      return "codex";
    },
  });
  assert.equal(
    fixture().runtime.start(
      dynamic,
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).reason,
    "coordinator_runtime_request_invalid",
  );
  assert.equal(getterExecuted, false);
  const production = startRuntimeOwnedCoordinatorOperation(
    request(),
    process.cwd(),
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(production.status, "blocked");
  assert.equal(production.providerEffectStarted, false);
  assert.equal(production.hostPathReported, false);
});

test("公開契約はSubscription probeと非canonical Effect境界を固定する", () => {
  const contract = describeCoordinatorRuntimeContract();
  assert.equal(contract.contractRevision, 8);
  assert.equal(
    contract.currentVerticalSlice,
    "codex_and_claude_subscription_boolean_probe",
  );
  assert.equal(contract.directProviderSpawnAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.rawOutputReported, false);
  assert.equal(contract.hostPathReported, false);
  assert.equal(contract.credentialReported, false);
});
