import assert from "node:assert/strict";
import test from "node:test";

import {
  createIsolatedCoordinatorTaskRuntimeCandidate,
  describeCoordinatorTaskRuntimeContract,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";

function request(overrides: Record<string, unknown> = {}) {
  return {
    frontProvider: "codex",
    objective: "Update the bounded fixture.",
    acceptanceCriteria: ["The fixture contains the expected value."],
    allowedPaths: ["fixture.txt"],
    readPaths: ["fixture.txt"],
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

function fixture(
  options: {
    reviewerDecision?: "approved" | "changes_requested";
    executorChangedPaths?: readonly string[];
    cleanupThrows?: boolean;
    completionRejectRole?: "executor" | "reviewer";
    candidateVerificationFails?: boolean;
    candidatePersistenceFails?: boolean;
    externalSendDenied?: boolean;
    pauseRole?: "executor" | "reviewer";
  } = {},
) {
  const owned = Object.freeze({});
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const repositoryBindingCapability = Object.freeze({});
  const workspaceCapability = Object.freeze({});
  const candidateCapability = Object.freeze({});
  const externalSendGrantCapability = Object.freeze({});
  const packetRoles = new WeakMap<object, "executor" | "reviewer">();
  const preparedRoles = new WeakMap<object, "executor" | "reviewer">();
  const selectionRequests: Array<Record<string, unknown>> = [];
  let cleanupCount = 0;
  let selectionCount = 0;
  let discardCount = 0;
  let releasePausedProcess: (() => void) | null = null;
  const dependencies = {
    createOperation: () =>
      Object.freeze({
        owned,
        mountCapability,
        managementCapability,
        operationId: "OP-123456",
        hostRecoveryId: "host.fixture.recovery.record",
      }),
    cleanupOperation: (candidate: object) => {
      assert.equal(candidate, owned);
      cleanupCount += 1;
      if (options.cleanupThrows) throw new Error("cleanup_failed");
    },
    bindRepository: () =>
      Object.freeze({
        repositoryBound: true,
        repositoryBindingCapability,
      }),
    materializeWorkspace: () =>
      Object.freeze({ status: "materialized", workspaceCapability }),
    issueSelection: (
      _management: object,
      selection: Record<string, unknown>,
    ) => {
      selectionCount += 1;
      selectionRequests.push(selection);
      const executor = selectionCount === 1 ? "claude" : "codex";
      return Object.freeze({
        status: "issued",
        executorProvider: executor,
        profileId: executor === "claude" ? "PROFILE-200001" : "PROFILE-100001",
        selectionNotice: `selection-${selectionCount}`,
        controlCapability: Object.freeze({}),
        useCapability: Object.freeze({}),
      });
    },
    revokeSelection: () => Object.freeze({ status: "revoked" }),
    observeProviderHome: () =>
      Object.freeze({
        status: "candidate",
        observationCapability: Object.freeze({}),
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
    revokeMountGrant: () => Object.freeze({ status: "revoked" }),
    authorizeExternalSend: () =>
      options.externalSendDenied
        ? null
        : Object.freeze({
            status: "issued",
            capability: externalSendGrantCapability,
          }),
    issueTaskPacket: (
      _management: object,
      _repository: object,
      _provider: "codex" | "claude",
      taskRole: "executor" | "reviewer",
      externalSendGrant: object,
    ) => {
      assert.equal(externalSendGrant, externalSendGrantCapability);
      const useCapability = Object.freeze({});
      packetRoles.set(useCapability, taskRole);
      return Object.freeze({
        status: "issued",
        controlCapability: Object.freeze({}),
        useCapability,
      });
    },
    revokeTaskPacket: () => Object.freeze({ status: "revoked" }),
    prepareProvider: (
      provider: "codex" | "claude",
      _management: object,
      _mount: object,
      _authorization: object,
      _selection: object,
      taskUse: object,
    ) => {
      const role = packetRoles.get(taskUse);
      assert.ok(role);
      assert.equal(provider, role === "executor" ? "claude" : "codex");
      const preparedCapability = Object.freeze({});
      preparedRoles.set(preparedCapability, role);
      return Object.freeze({
        status: "prepared",
        preparedCapability,
        selectionNotice: `${role}-selection-notice`,
      });
    },
    startProcess: (preparedCapability: object) => {
      const role = preparedRoles.get(preparedCapability);
      assert.ok(role);
      const reviewerDecision = options.reviewerDecision ?? "approved";
      const completedResult = Object.freeze({
        status: "completed",
        reason: "completed",
        cleanupConfirmed: true,
        normalizedResult:
          role === "executor"
            ? Object.freeze({
                status: "completed",
                changedPaths: Object.freeze([
                  ...(options.executorChangedPaths ?? ["fixture.txt"]),
                ]),
                verificationCount: 1,
              })
            : Object.freeze({
                decision: reviewerDecision,
                findingCount: reviewerDecision === "approved" ? 0 : 1,
              }),
      });
      const completion =
        options.completionRejectRole === role
          ? Promise.reject(new Error("unexpected_completion_rejection"))
          : options.pauseRole === role
            ? new Promise<typeof completedResult>((resolve) => {
                releasePausedProcess = () => resolve(completedResult);
              })
            : Promise.resolve(completedResult);
      return Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: Object.freeze({}),
        completion,
      });
    },
    cancelProcess: async () => Object.freeze({ status: "requested" }),
    captureCandidate: () =>
      Object.freeze({
        status: "candidate",
        candidateCapability,
        changedPaths: Object.freeze(["fixture.txt"]),
      }),
    verifyCandidate: () =>
      Object.freeze({
        status: options.candidateVerificationFails ? "blocked" : "verified",
        baseCommit: "1".repeat(40),
        baseTree: "2".repeat(40),
        patchHash: "3".repeat(64),
        contentManifestHash: "4".repeat(64),
        allowedPathsHash: "5".repeat(64),
        changedPaths: Object.freeze(["fixture.txt"]),
      }),
    persistCandidate: () =>
      options.candidatePersistenceFails
        ? null
        : Object.freeze({
            status: "persisted",
            candidateId: `candidate.${"6".repeat(64)}.${"7".repeat(64)}`,
          }),
    discardCandidate: () => {
      discardCount += 1;
      return Object.freeze({ status: "discarded" });
    },
  };
  const runtime = createIsolatedCoordinatorTaskRuntimeCandidate(
    dependencies as Parameters<
      typeof createIsolatedCoordinatorTaskRuntimeCandidate
    >[0],
  );
  return {
    runtime,
    selectionRequests,
    cleanupCount: () => cleanupCount,
    discardCount: () => discardCount,
    releasePausedProcess: () => {
      assert.ok(releasePausedProcess);
      releasePausedProcess();
    },
  };
}

test("Codex frontからClaude Executorと独立Codex Reviewerを隔離Candidateへ接続する", async () => {
  const harness = fixture();
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(started.status, "started");
  const result = await started.completion;
  assert.equal(result.status, "completed");
  assert.equal(result.executorProvider, "claude");
  assert.equal(result.reviewerProvider, "codex");
  assert.equal(result.canonicalRepositoryChanged, false);
  assert.deepEqual(result.candidateRevision?.changedPaths, ["fixture.txt"]);
  assert.equal(
    result.candidateId,
    `candidate.${"6".repeat(64)}.${"7".repeat(64)}`,
  );
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(harness.selectionRequests.length, 2);
  assert.equal(harness.selectionRequests[1]?.role, "independent_reviewer");
  assert.equal(harness.selectionRequests[1]?.subjectProvider, "claude");
  assert.equal(harness.selectionRequests[1]?.requiresIndependentProvider, true);
});

test("Reviewerがchanges_requestedならCandidateを承認済みResultへ昇格しない", async () => {
  const harness = fixture({ reviewerDecision: "changes_requested" });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_independent_review_not_approved",
  );
  assert.equal(result.candidateRevision, null);
  assert.equal(harness.cleanupCount(), 1);
});

test("対話的External Send Grantが無ければWorkspaceとProvider Effect前に停止する", async () => {
  const harness = fixture({ externalSendDenied: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_external_send_not_authorized");
  assert.equal(harness.selectionRequests.length, 0);
  assert.equal(harness.cleanupCount(), 1);
});

test("Executor自己申告と実Candidate差またはOperation cleanup不明を成功にしない", async () => {
  const mismatch = fixture({ executorChangedPaths: [] });
  const mismatchResult = await mismatch.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(mismatchResult.status, "blocked");
  assert.equal(
    mismatchResult.reason,
    "coordinator_task_candidate_revision_invalid",
  );

  const cleanupFailure = fixture({ cleanupThrows: true });
  const cleanupResult = await cleanupFailure.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(cleanupResult.status, "blocked");
  assert.equal(
    cleanupResult.reason,
    "coordinator_task_operation_cleanup_unconfirmed",
  );
  assert.equal(cleanupResult.manualRecoveryRequired, true);
  assert.equal(cleanupResult.hostRecoveryId, "host.fixture.recovery.record");
  assert.equal(cleanupFailure.discardCount(), 1);
});

test("承認済みCandidateを永続化できない場合はIDを公開せずFail Closedする", async () => {
  const harness = fixture({ candidatePersistenceFails: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_candidate_persistence_failed");
  assert.equal(result.candidateId, null);
  assert.equal(harness.cleanupCount(), 1);
});

test("Provider completion rejectは取消を試みOperation RootをRecovery用に保持する", async () => {
  const harness = fixture({ completionRejectRole: "executor" });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_process_completion_unconfirmed",
  );
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
  assert.equal(harness.cleanupCount(), 0);
});

test("独立Reviewer実行中のCandidate差替えを承認済みResultへ昇格しない", async () => {
  const harness = fixture({ candidateVerificationFails: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_independent_review_not_approved",
  );
  assert.equal(result.candidateRevision, null);
  assert.equal(harness.cleanupCount(), 1);
});

test("実行中取消はProvider完了後もCandidateを公開せずexactly onceに閉じる", async () => {
  const harness = fixture({ pauseRole: "executor" });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  await new Promise((resolve) => setImmediate(resolve));
  const cancelled = await harness.runtime.cancel(started.controlCapability);
  assert.deepEqual(cancelled, { status: "requested" });
  const duplicate = await harness.runtime.cancel(started.controlCapability);
  assert.deepEqual(duplicate, { status: "blocked" });
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_cancelled_after_provider_cleanup",
  );
  assert.equal(result.candidateRevision, null);
  assert.equal(harness.cleanupCount(), 1);
});

test("Production入口は偽RepositoryとCapabilityをProvider Effect前に拒否する", async () => {
  const result = await startRuntimeOwnedCoordinatorTask(
    request(),
    "not-an-absolute-repository",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.rawOutputReported, false);
});

test("公開契約は4経路、独立Reviewer、stdin、非canonical Effectを固定する", () => {
  const contract = describeCoordinatorTaskRuntimeContract();
  assert.equal(contract.contractRevision, 2);
  assert.equal(contract.routes.length, 4);
  assert.equal(contract.independentReview, "subject_provider_excluded");
  assert.equal(contract.taskTransport, "opaque_single_use_provider_stdin_only");
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.directProviderToProviderSpawnAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(
    contract.approvedCandidateTransfer,
    "opaque_id_local_transient_bundle_explicit_export_and_discard",
  );
});
