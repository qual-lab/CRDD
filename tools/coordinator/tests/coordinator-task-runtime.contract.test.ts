import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  createIsolatedCoordinatorTaskRuntimeCandidate,
  describeCoordinatorTaskRuntimeContract,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import { inspectRepositoryObjectFormatCandidate } from "../src/security/repository-operation-runtime.ts";

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
    finalReviewerDecision?: "approved" | "changes_requested";
    executorChangedPaths?: readonly string[];
    cleanupThrows?: boolean;
    completionRejectRole?: "executor" | "reviewer";
    candidateVerificationFails?: boolean;
    candidatePersistenceFails?: boolean;
    candidatePersistenceNeedsRecovery?: boolean;
    candidatePersistenceNeedsStoreRecovery?: boolean;
    candidatePersistenceAllowed?: boolean;
    candidateStoreUnavailable?: boolean;
    externalSendDenied?: boolean;
    externalSendReason?: string;
    pauseExternalAuthorization?: boolean;
    pauseRole?: "executor" | "reviewer";
    discardFails?: boolean;
    discardThrows?: boolean;
    publishFails?: boolean;
    publishThrows?: boolean;
    publishNeedsStoreRecovery?: boolean;
    processStartFailureRole?: "executor" | "reviewer";
    processCleanupFailureRole?: "executor" | "reviewer";
    hostCleanupWal?: boolean;
    dockerFinalizeFailsAt?: number;
    inspectRepository?: typeof inspectRepositoryObjectFormatCandidate;
  } = {},
) {
  const owned = Object.freeze({});
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const repositoryBindingCapability = Object.freeze({});
  const workspaceCapability = Object.freeze({});
  const candidateCapability = Object.freeze({});
  const externalSendGrantCapability = Object.freeze({});
  const externalSendPolicyCapability = Object.freeze({});
  const packetRoles = new WeakMap<object, "executor" | "reviewer">();
  const preparedRoles = new WeakMap<object, "executor" | "reviewer">();
  const selectionRequests: Array<Record<string, unknown>> = [];
  const selectionNotices: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  let cleanupCount = 0;
  let selectionCount = 0;
  let discardCount = 0;
  let externalAuthorizationCount = 0;
  let dockerFinalizeCount = 0;
  let operationCreateCount = 0;
  let candidateStorePrepareCount = 0;
  let workspaceMaterializeCount = 0;
  let processStartCount = 0;
  let releasePausedProcess: (() => void) | null = null;
  let releaseExternalAuthorization: (() => void) | null = null;
  let externalCancellationSignal: AbortSignal | null = null;
  const processCounts = new Map<"executor" | "reviewer", number>();
  const dependencies = {
    inspectRepository:
      options.inspectRepository ??
      (() =>
        Object.freeze({
          status: "candidate" as const,
          objectFormat: "sha1",
          runtimeSupported: true,
          revisionReported: false,
          repositoryPathReported: false,
        })),
    createOperation: () => {
      operationCreateCount += 1;
      return Object.freeze({
        owned,
        mountCapability,
        managementCapability,
        operationId: "OP-123456",
        hostRecoveryId: "host.fixture.recovery.record",
      });
    },
    cleanupOperation: (candidate: object) => {
      assert.equal(candidate, owned);
      if (options.hostCleanupWal) events.push("host-cleanup");
      cleanupCount += 1;
      if (options.cleanupThrows) throw new Error("cleanup_failed");
    },
    bindRepository: () =>
      Object.freeze({
        repositoryBound: true,
        repositoryBindingCapability,
      }),
    resolveExternalSendPolicy: () =>
      Object.freeze({
        status: "resolved",
        capability: externalSendPolicyCapability,
        candidatePersistenceAllowed:
          options.candidatePersistenceAllowed !== false,
        candidateRetentionHours: 24,
        informationClassification: "public",
        candidatePhysicalDeletion:
          "next_safe_runtime_entry_after_expiry_or_explicit_discard",
      }),
    prepareCandidateStore: () => {
      candidateStorePrepareCount += 1;
      return options.candidateStoreUnavailable
        ? Object.freeze({
            status: "blocked",
            reason: "candidate_store_damaged_entry",
            candidateStoreRecoveryId: `candidate-store-recovery.${"8".repeat(64)}`,
            manualRecoveryRequired: true,
          })
        : Object.freeze({ status: "completed" });
    },
    reportSelectionNotice: (notice: Record<string, unknown>) => {
      selectionNotices.push(notice);
      events.push(`notice:${String(notice.taskRole)}`);
      return true;
    },
    materializeWorkspace: () => {
      workspaceMaterializeCount += 1;
      return Object.freeze({ status: "materialized", workspaceCapability });
    },
    issueSelection: (
      _management: object,
      selection: Record<string, unknown>,
    ) => {
      selectionCount += 1;
      selectionRequests.push(selection);
      const requested = selection.requestedExecutorProvider;
      const executor =
        requested === "claude" || requested === "codex"
          ? requested
          : selectionCount === 1
            ? "claude"
            : "codex";
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
    authorizeExternalSend: (
      _management: object,
      _repository: object,
      _policy: object,
      _scope: Record<string, unknown>,
      _providers: readonly ("codex" | "claude")[],
      cancellationSignal: AbortSignal,
    ) => {
      externalAuthorizationCount += 1;
      externalCancellationSignal = cancellationSignal;
      const authorization = options.externalSendReason
        ? Object.freeze({
            status: "blocked",
            reason: options.externalSendReason,
          })
        : options.externalSendDenied
          ? null
          : Object.freeze({
              status: "issued",
              capability: externalSendGrantCapability,
            });
      return options.pauseExternalAuthorization
        ? new Promise<typeof authorization>((resolve) => {
            releaseExternalAuthorization = () => resolve(authorization);
          })
        : authorization;
    },
    issueTaskPacket: (
      _management: object,
      _repository: object,
      _provider: "codex" | "claude",
      taskRole: "executor" | "reviewer",
      _taskAttempt: 0 | 1,
      externalSendGrant: object,
      _remediationCapability: object | null,
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
    startProcess: (
      preparedCapability: object,
      _managementCapability: object,
      registerRecoveryHandoff: (
        capability: unknown,
        recoveryId: unknown,
      ) => boolean,
    ) => {
      processStartCount += 1;
      const role = preparedRoles.get(preparedCapability);
      assert.ok(role);
      events.push(`start:${role}`);
      if (options.processStartFailureRole === role) {
        return Object.freeze({
          status: "blocked",
          reason: "fixture_start_failed",
          cleanupConfirmed: false,
          recoveryId: `docker.fixture.${role}.start`,
        });
      }
      const reviewerDecision = options.reviewerDecision ?? "approved";
      const recoveryCapability = Object.freeze({ role });
      const processCount = (processCounts.get(role) ?? 0) + 1;
      processCounts.set(role, processCount);
      const activeRecoveryId = `docker.fixture.${role}.active${processCount === 1 ? "" : `-${processCount}`}`;
      assert.equal(
        registerRecoveryHandoff(recoveryCapability, activeRecoveryId),
        true,
      );
      const reviewerAttempt = selectionCount > 3 ? 1 : 0;
      const effectiveReviewerDecision =
        role === "reviewer" && reviewerAttempt === 1
          ? (options.finalReviewerDecision ?? reviewerDecision)
          : reviewerDecision;
      const cleanupFails = options.processCleanupFailureRole === role;
      const completedResult = Object.freeze({
        status: cleanupFails ? "blocked" : "completed",
        reason: cleanupFails ? "fixture_cleanup_failed" : "completed",
        cleanupConfirmed: !cleanupFails,
        recoveryId: cleanupFails ? activeRecoveryId : null,
        ...(options.hostCleanupWal
          ? { recoveryFinalizationCapability: recoveryCapability }
          : {}),
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
                decision: effectiveReviewerDecision,
                findingCount: effectiveReviewerDecision === "approved" ? 0 : 1,
                remediationCapability:
                  effectiveReviewerDecision === "changes_requested"
                    ? Object.freeze({})
                    : null,
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
        recoveryId: activeRecoveryId,
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
        : options.candidatePersistenceNeedsStoreRecovery
          ? Object.freeze({
              status: "blocked",
              reason: "candidate_store_damaged_entry",
              candidateRecoveryId: null,
              candidateStoreRecoveryId: `candidate-store-recovery.${"8".repeat(64)}`,
              manualRecoveryRequired: true,
            })
          : options.candidatePersistenceNeedsRecovery
            ? Object.freeze({
                status: "blocked",
                reason: "candidate_store_persist_recovery_required",
                candidateRecoveryId: `candidate-recovery.${"6".repeat(64)}.${"7".repeat(64)}`,
                manualRecoveryRequired: true,
              })
            : Object.freeze({
                status: "staged",
                candidateRecoveryId: `candidate-recovery.${"6".repeat(64)}.${"7".repeat(64)}`,
              }),
    discardCandidate: () => {
      discardCount += 1;
      if (options.discardThrows) throw new Error("fixture_discard_failure");
      return Object.freeze({
        status: options.discardFails ? "blocked" : "discarded",
      });
    },
    publishCandidate: () => {
      if (options.publishThrows) throw new Error("fixture_publish_failure");
      return options.publishFails
        ? null
        : options.publishNeedsStoreRecovery
          ? Object.freeze({
              status: "blocked",
              candidateRecoveryId: `candidate-recovery.${"6".repeat(64)}.${"7".repeat(64)}`,
              candidateStoreRecoveryId: `candidate-store-recovery.${"8".repeat(64)}`,
              manualRecoveryRequired: true,
            })
          : Object.freeze({
              status: "published",
              candidateId: `candidate.${"6".repeat(64)}.${"7".repeat(64)}`,
              expiresAtMs: 1_800_000_000_000,
            });
    },
    ...(options.hostCleanupWal
      ? {
          prepareDockerHostCleanup: () => {
            events.push("docker-host-cleanup-intent");
            return "host.fixture.cleanup.intent";
          },
          recordDockerHostCleanupReceipt: () => {
            events.push("docker-host-cleanup-receipt");
            return true;
          },
          finalizeDockerRecovery: () => {
            events.push("docker-finalize");
            dockerFinalizeCount += 1;
            return Object.freeze({
              status:
                options.dockerFinalizeFailsAt === dockerFinalizeCount
                  ? "blocked"
                  : "completed",
            });
          },
        }
      : {}),
  };
  const runtime = createIsolatedCoordinatorTaskRuntimeCandidate(
    dependencies as Parameters<
      typeof createIsolatedCoordinatorTaskRuntimeCandidate
    >[0],
  );
  return {
    runtime,
    selectionRequests,
    selectionNotices,
    events,
    cleanupCount: () => cleanupCount,
    discardCount: () => discardCount,
    externalAuthorizationCount: () => externalAuthorizationCount,
    operationCreateCount: () => operationCreateCount,
    candidateStorePrepareCount: () => candidateStorePrepareCount,
    workspaceMaterializeCount: () => workspaceMaterializeCount,
    processStartCount: () => processStartCount,
    externalCancellationSignal: () => externalCancellationSignal,
    releaseExternalAuthorization: () => {
      assert.ok(releaseExternalAuthorization);
      releaseExternalAuthorization();
    },
    releasePausedProcess: () => {
      assert.ok(releasePausedProcess);
      releasePausedProcess();
    },
  };
}

function sha256Repository(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-sha256-task-"));
  const git = path.join(root, ".git");
  fs.mkdirSync(git, { recursive: true });
  fs.writeFileSync(path.join(git, "HEAD"), `${"a".repeat(64)}\n`, "utf8");
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\n\trepositoryformatversion = 1\n\tbare = false\n[extensions]\n\tobjectformat = sha256\n",
    "utf8",
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function mismatchedRepository(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-mismatched-task-"));
  const git = path.join(root, ".git");
  fs.mkdirSync(git, { recursive: true });
  fs.writeFileSync(path.join(git, "HEAD"), `${"a".repeat(64)}\n`, "utf8");
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function junctionRefRepository(t: TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-junction-ref-task-"),
  );
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-junction-ref-external-"),
  );
  const git = path.join(root, ".git");
  fs.mkdirSync(git, { recursive: true });
  fs.mkdirSync(external, { recursive: true });
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
  fs.writeFileSync(path.join(external, "main"), `${"a".repeat(40)}\n`, "utf8");
  fs.mkdirSync(path.join(git, "refs"));
  fs.symlinkSync(
    external,
    path.join(git, "refs", "heads"),
    process.platform === "win32" ? "junction" : "dir",
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  return root;
}

test("対象SHA-256 RepositoryはOperation／Grant／Store／Workspace／Processより前に専用停止する", async (t) => {
  const harness = fixture({
    inspectRepository: inspectRepositoryObjectFormatCandidate,
  });
  const started = harness.runtime.start(
    request(),
    sha256Repository(t),
    "2026-08-25T00:00:00.000Z",
  );
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_git_object_format_unsupported");
  assert.equal(harness.operationCreateCount(), 0);
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.candidateStorePrepareCount(), 0);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 0);
});

test("宣言FormatとRevision幅の不一致は全Effect前にpreflight failureへ閉じる", async (t) => {
  const harness = fixture({
    inspectRepository: inspectRepositoryObjectFormatCandidate,
  });
  const result = await harness.runtime.start(
    request(),
    mismatchedRepository(t),
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_repository_preflight_failed");
  assert.equal(harness.operationCreateCount(), 0);
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.candidateStorePrepareCount(), 0);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 0);
});

test("loose refの中間junctionは全Effect前にpreflight failureへ閉じる", async (t) => {
  const harness = fixture({
    inspectRepository: inspectRepositoryObjectFormatCandidate,
  });
  const result = await harness.runtime.start(
    request(),
    junctionRefRepository(t),
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_repository_preflight_failed");
  assert.equal(harness.operationCreateCount(), 0);
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.candidateStorePrepareCount(), 0);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 0);
});

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
  assert.equal(result.expiresAtMs, 1_800_000_000_000);
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(harness.selectionRequests.length, 2);
  assert.equal(harness.selectionRequests[1]?.role, "independent_reviewer");
  assert.equal(harness.selectionRequests[1]?.subjectProvider, "claude");
  assert.equal(harness.selectionRequests[1]?.requiresIndependentProvider, true);
});

test("Docker回復記録はHost cleanup intentと不存在receiptの後だけfinalizeする", async () => {
  const harness = fixture({ hostCleanupWal: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "completed");
  assert.deepEqual(harness.events.slice(-7), [
    "docker-host-cleanup-intent",
    "docker-host-cleanup-intent",
    "host-cleanup",
    "docker-host-cleanup-receipt",
    "docker-host-cleanup-receipt",
    "docker-finalize",
    "docker-finalize",
  ]);
});

test("先にfinalize済みのDocker IDを後続finalize失敗の未解決集合へ再混入しない", async () => {
  const harness = fixture({ hostCleanupWal: true, dockerFinalizeFailsAt: 2 });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_docker_recovery_finalization_unconfirmed",
  );
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker.fixture.reviewer.active",
  ]);
  assert.equal(result.dockerRecoveryId, "docker.fixture.reviewer.active");
});

test("全Docker handoff finalize後のCandidate永続化失敗はDocker IDを返さない", async () => {
  const harness = fixture({
    hostCleanupWal: true,
    candidatePersistenceFails: true,
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_candidate_persistence_failed");
  assert.deepEqual(result.dockerRecoveryIds, []);
  assert.equal(result.dockerRecoveryId, null);
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

test("Reviewer指摘を一回だけ同一Executorへ戻し、同一独立Reviewerの再承認へ接続する", async () => {
  const harness = fixture({
    reviewerDecision: "changes_requested",
    finalReviewerDecision: "approved",
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "completed");
  assert.equal(result.remediationPerformed, true);
  assert.equal(harness.selectionRequests.length, 4);
  assert.equal(
    harness.selectionRequests[2]?.requestedExecutorProvider,
    "claude",
  );
  assert.equal(
    harness.selectionRequests[3]?.requestedExecutorProvider,
    "codex",
  );
  assert.equal(harness.selectionNotices.length, 4);
});

test("選定理由は各Provider Effectより前に安全なCoordinator eventへ出す", async () => {
  const harness = fixture();
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "completed");
  assert.deepEqual(harness.events, [
    "notice:executor",
    "start:executor",
    "notice:reviewer",
    "start:reviewer",
  ]);
  assert.equal(
    harness.selectionNotices[0]?.inputBasis,
    "caller_declared_task_attributes_plus_runtime_owned_preselection_candidate_with_deferred_provider_preflight",
  );
});

test("Candidate保存禁止Policyは外部送信とProvider Effect前に停止する", async () => {
  const harness = fixture({ candidatePersistenceAllowed: false });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_candidate_persistence_not_authorized",
  );
  assert.deepEqual(harness.events, []);
});

test("Candidate Storeを安全に準備できなければ外部送信Authority前に停止する", async () => {
  const harness = fixture({ candidateStoreUnavailable: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_candidate_store_unavailable");
  assert.equal(result.manualRecoveryRequired, true);
  assert.match(
    result.candidateStoreRecoveryId ?? "",
    /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  );
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.selectionRequests.length, 0);
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

test("対話cleanup不明はProcess再起動を要求しOperation cleanupを独立して処置する", async () => {
  const reason =
    "external_send_confirmation_cleanup_unknown_process_restart_required";
  const harness = fixture({ externalSendReason: reason });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(
    result.reason,
    "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required",
  );
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, null);
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.externalAuthorizationCount(), 1);
  assert.equal(harness.selectionRequests.length, 0);

  const cleanupFailure = fixture({
    externalSendReason: reason,
    cleanupThrows: true,
  });
  const combined = await cleanupFailure.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(
    combined.reason,
    "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_and_operation_recovery_required",
  );
  assert.equal(combined.manualRecoveryRequired, true);
  assert.equal(combined.hostRecoveryId, "host.fixture.recovery.record");
  assert.equal(cleanupFailure.cleanupCount(), 1);
  assert.equal(cleanupFailure.workspaceMaterializeCount(), 0);
  assert.equal(cleanupFailure.processStartCount(), 0);
  assert.equal(cleanupFailure.selectionRequests.length, 0);
});

test("External Send拒否状態はTaskの理由・回復・Effect 0へ完全投影する", async () => {
  for (const status of [
    "declined_invalid",
    "cancelled",
    "timeout",
    "unavailable",
    "reader_failed",
    "cleanup_unknown_process_restart_required",
  ] as const) {
    const externalReason = `external_send_confirmation_${status}`;
    const harness = fixture({ externalSendReason: externalReason });
    const result = await harness.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion;
    assert.equal(result.reason, `coordinator_task_${externalReason}`);
    assert.equal(
      result.manualRecoveryRequired,
      status === "cleanup_unknown_process_restart_required",
    );
    const projected = result as Readonly<Record<string, unknown>>;
    assert.equal(projected.hostRecoveryId, null);
    assert.deepEqual(projected.dockerRecoveryIds, []);
    assert.equal(harness.cleanupCount(), 1);
    assert.equal(harness.workspaceMaterializeCount(), 0);
    assert.equal(harness.processStartCount(), 0);
  }
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

test("Operation cleanupとCandidate discardが共に失敗してもdiscard専用Recovery IDを失わない", async () => {
  const harness = fixture({ cleanupThrows: true, discardFails: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
  assert.match(
    result.candidateRecoveryId ?? "",
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
  assert.equal(result.candidateId, null);
});

test("Candidate publish失敗はexport不能なRecovery IDだけを返す", async () => {
  const harness = fixture({ publishFails: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.hostRecoveryId, null);
  assert.match(
    result.candidateRecoveryId ?? "",
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
});

test("Candidate publishとStore障害を同時に観測しても二つのRecovery IDを保持する", async () => {
  const harness = fixture({ publishNeedsStoreRecovery: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
  assert.match(
    result.candidateRecoveryId ?? "",
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
  assert.match(
    result.candidateStoreRecoveryId ?? "",
    /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  );
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

test("Candidate Store障害はCandidate IDと分離したStore Recovery IDを返す", async () => {
  const harness = fixture({ candidatePersistenceNeedsStoreRecovery: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.candidateRecoveryId, null);
  assert.equal(result.manualRecoveryRequired, true);
  assert.match(
    result.candidateStoreRecoveryId ?? "",
    /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  );
});

test("Candidate永続化の中間障害はcleanup後にRecovery IDで自動破棄する", async () => {
  const harness = fixture({ candidatePersistenceNeedsRecovery: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_candidate_persistence_failed");
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.candidateRecoveryId, null);
  assert.equal(harness.discardCount(), 1);
  assert.equal(harness.cleanupCount(), 1);
});

test("全Docker finalize後のCandidate publish例外へ削除済みDocker IDを再投影しない", async () => {
  const harness = fixture({ hostCleanupWal: true, publishThrows: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.dockerRecoveryId, null);
  assert.deepEqual(result.dockerRecoveryIds, []);
});

test("先行finalize済みIDはCandidate discard例外後のcatchへ残さない", async () => {
  const harness = fixture({
    hostCleanupWal: true,
    candidatePersistenceNeedsRecovery: true,
    discardThrows: true,
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.dockerRecoveryId, null);
  assert.deepEqual(result.dockerRecoveryIds, []);
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
  assert.equal(result.dockerRecoveryId, "docker.fixture.executor.active");
  assert.equal(harness.cleanupCount(), 0);
});

test("Provider start／completion cleanup不明はHostとDockerのRecovery IDを分離する", async () => {
  for (const [options, expectedIds] of [
    [
      { processStartFailureRole: "executor" as const },
      ["docker.fixture.executor.start"],
    ],
    [
      { processCleanupFailureRole: "executor" as const },
      ["docker.fixture.executor.active"],
    ],
    [
      { processCleanupFailureRole: "reviewer" as const },
      ["docker.fixture.reviewer.active"],
    ],
  ] as const) {
    const harness = fixture(options);
    const result = await harness.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
    assert.equal(
      result.dockerRecoveryId,
      expectedIds.length === 1 ? expectedIds[0] : null,
    );
    assert.deepEqual(result.dockerRecoveryIds, expectedIds);
    assert.equal(harness.cleanupCount(), 0);
  }
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

test("外部送信承認中の取消は同じSignalへ伝播しWorkspace前に停止する", async () => {
  const harness = fixture({ pauseExternalAuthorization: true });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(harness.externalCancellationSignal()?.aborted, false);
  assert.deepEqual(await harness.runtime.cancel(started.controlCapability), {
    status: "requested",
  });
  assert.equal(harness.externalCancellationSignal()?.aborted, true);
  harness.releaseExternalAuthorization();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_cancelled_during_external_send_authorization",
  );
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 1);
});

test("Production入口はPackage Capability欠落を全Effect前に拒否する", () => {
  assert.throws(
    () =>
      startRuntimeOwnedCoordinatorTask(
        request(),
        "not-an-absolute-repository",
        Object.freeze({}),
      ),
    /coordinator_task_release_verification_required/u,
  );
});

test("公開契約は4経路、独立Reviewer、stdin、非canonical Effectを固定する", () => {
  const contract = describeCoordinatorTaskRuntimeContract();
  assert.equal(contract.contractRevision, 11);
  assert.equal(contract.routes.length, 4);
  assert.equal(contract.independentReview, "subject_provider_excluded");
  assert.equal(contract.taskTransport, "opaque_single_use_provider_stdin_only");
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.directProviderToProviderSpawnAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(
    contract.processPoisonGate,
    "before_package_consume_operation_console_store_workspace_provider_and_network",
  );
  assert.equal(
    contract.interactiveCleanupRecovery,
    "restart_only_without_operation_recovery_id_unless_operation_cleanup_also_fails",
  );
  assert.equal(
    contract.approvedCandidateTransfer,
    "policy_bounded_staged_bundle_published_only_after_operation_cleanup",
  );
  assert.equal(
    contract.boundedRemediation,
    "maximum_one_same_executor_then_same_independent_reviewer",
  );
});
