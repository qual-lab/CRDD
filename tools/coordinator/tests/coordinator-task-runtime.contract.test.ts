import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import test from "node:test";
import { types as utilTypes } from "node:util";

import {
  createIsolatedCoordinatorTaskRuntimeCandidate,
  describeCoordinatorTaskRuntimeContract,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import { inspectRepositoryObjectFormatCandidate } from "../src/security/repository-operation-runtime.ts";
import {
  assertRuntimeTraceCase,
  type RuntimeTraceCase,
} from "./runtime-trace-case.ts";

type TraceSnapshot = Readonly<{
  state: string;
  provider: number;
  host: number;
  cleanup: number;
  resources: Readonly<Record<string, string>>;
}>;

const TRANSITION_BY_EDGE = new Map<string, string>([
  ["STATE-ADMISSION>STATE-OPERATION-READY", "TRANS-ADMISSION-TO-OPERATION"],
  [
    "STATE-OPERATION-READY>STATE-TASK-AUTHORIZED",
    "TRANS-OPERATION-TO-AUTHORIZED",
  ],
  [
    "STATE-TASK-AUTHORIZED>STATE-EXECUTOR-CLEAN",
    "TRANS-AUTHORIZED-TO-EXECUTOR-CLEAN",
  ],
  [
    "STATE-EXECUTOR-CLEAN>STATE-CANDIDATE-CAPTURED",
    "TRANS-EXECUTOR-TO-CANDIDATE",
  ],
  [
    "STATE-CANDIDATE-CAPTURED>STATE-REVIEWER-CLEAN",
    "TRANS-CANDIDATE-TO-REVIEWER-CLEAN",
  ],
  [
    "STATE-REVIEWER-CLEAN>STATE-REMEDIATION-AUTHORIZED",
    "TRANS-REVIEWER-TO-REMEDIATION",
  ],
  [
    "STATE-REMEDIATION-AUTHORIZED>STATE-REMEDIATION-EXECUTOR-CLEAN",
    "TRANS-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN",
  ],
  [
    "STATE-REMEDIATION-EXECUTOR-CLEAN>STATE-REMEDIATION-CANDIDATE-CAPTURED",
    "TRANS-REMEDIATION-EXECUTOR-TO-CANDIDATE",
  ],
  [
    "STATE-REMEDIATION-CANDIDATE-CAPTURED>STATE-REMEDIATION-REVIEWER-CLEAN",
    "TRANS-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN",
  ],
  ["STATE-REVIEWER-CLEAN>STATE-CANDIDATE-STAGED", "TRANS-REVIEWER-TO-STAGED"],
  [
    "STATE-REMEDIATION-REVIEWER-CLEAN>STATE-CANDIDATE-STAGED",
    "TRANS-REMEDIATION-REVIEWER-TO-STAGED",
  ],
  ["STATE-CANDIDATE-STAGED>STATE-HOST-CLEAN", "TRANS-STAGED-TO-HOST-CLEAN"],
  ["STATE-HOST-CLEAN>STATE-RESULT-PUBLISHED", "TRANS-HOST-CLEAN-TO-RESULT"],
]);

const EDGE_BY_LIFECYCLE_CASE = new Map<string, string>([
  [
    "CASE-NORMAL-ADMISSION-TO-OPERATION",
    "STATE-ADMISSION>STATE-OPERATION-READY",
  ],
  [
    "CASE-NORMAL-OPERATION-TO-AUTHORIZED",
    "STATE-OPERATION-READY>STATE-TASK-AUTHORIZED",
  ],
  [
    "CASE-NORMAL-AUTHORIZED-TO-EXECUTOR-CLEAN",
    "STATE-TASK-AUTHORIZED>STATE-EXECUTOR-CLEAN",
  ],
  [
    "CASE-NORMAL-EXECUTOR-TO-CANDIDATE",
    "STATE-EXECUTOR-CLEAN>STATE-CANDIDATE-CAPTURED",
  ],
  [
    "CASE-NORMAL-CANDIDATE-TO-REVIEWER-CLEAN",
    "STATE-CANDIDATE-CAPTURED>STATE-REVIEWER-CLEAN",
  ],
  [
    "CASE-NORMAL-REVIEWER-TO-STAGED",
    "STATE-REVIEWER-CLEAN>STATE-CANDIDATE-STAGED",
  ],
  [
    "CASE-NORMAL-STAGED-TO-HOST-CLEAN",
    "STATE-CANDIDATE-STAGED>STATE-HOST-CLEAN",
  ],
  [
    "CASE-NORMAL-HOST-CLEAN-TO-RESULT",
    "STATE-HOST-CLEAN>STATE-RESULT-PUBLISHED",
  ],
  [
    "CASE-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN",
    "STATE-TASK-AUTHORIZED>STATE-EXECUTOR-CLEAN",
  ],
  [
    "CASE-REMEDIATION-EXECUTOR-TO-CANDIDATE",
    "STATE-EXECUTOR-CLEAN>STATE-CANDIDATE-CAPTURED",
  ],
  [
    "CASE-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN",
    "STATE-CANDIDATE-CAPTURED>STATE-REVIEWER-CLEAN",
  ],
  [
    "CASE-REMEDIATION-REVIEWER-TO-AUTHORIZED",
    "STATE-REVIEWER-CLEAN>STATE-REMEDIATION-AUTHORIZED",
  ],
  [
    "CASE-REMEDIATION-AUTHORIZED-TO-SECOND-EXECUTOR-CLEAN",
    "STATE-REMEDIATION-AUTHORIZED>STATE-REMEDIATION-EXECUTOR-CLEAN",
  ],
  [
    "CASE-REMEDIATION-SECOND-EXECUTOR-TO-CANDIDATE",
    "STATE-REMEDIATION-EXECUTOR-CLEAN>STATE-REMEDIATION-CANDIDATE-CAPTURED",
  ],
  [
    "CASE-REMEDIATION-SECOND-CANDIDATE-TO-REVIEWER-CLEAN",
    "STATE-REMEDIATION-CANDIDATE-CAPTURED>STATE-REMEDIATION-REVIEWER-CLEAN",
  ],
  [
    "CASE-REMEDIATION-SECOND-REVIEWER-TO-STAGED",
    "STATE-REMEDIATION-REVIEWER-CLEAN>STATE-CANDIDATE-STAGED",
  ],
]);

const RESOURCES_BY_TRANSITION = new Map<string, readonly string[]>([
  ["TRANS-ADMISSION-TO-OPERATION", ["RES-HOST-GENERATION", "RES-TASK-CONTROL"]],
  [
    "TRANS-OPERATION-TO-AUTHORIZED",
    ["RES-INTERACTIVE-CONSOLE", "RES-OPERATION-WORKSPACE"],
  ],
  [
    "TRANS-AUTHORIZED-TO-EXECUTOR-CLEAN",
    [
      "RES-LOGICAL-HOME-LOCK",
      "RES-RUNTIME-STATE-LOCK",
      "RES-MOUNT-GRANT",
      "RES-DOCKER-OWNED",
    ],
  ],
  ["TRANS-EXECUTOR-TO-CANDIDATE", []],
  [
    "TRANS-CANDIDATE-TO-REVIEWER-CLEAN",
    [
      "RES-LOGICAL-HOME-LOCK",
      "RES-RUNTIME-STATE-LOCK",
      "RES-MOUNT-GRANT",
      "RES-DOCKER-OWNED",
    ],
  ],
  ["TRANS-REVIEWER-TO-REMEDIATION", []],
  [
    "TRANS-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN",
    [
      "RES-LOGICAL-HOME-LOCK",
      "RES-RUNTIME-STATE-LOCK",
      "RES-MOUNT-GRANT",
      "RES-DOCKER-OWNED",
    ],
  ],
  ["TRANS-REMEDIATION-EXECUTOR-TO-CANDIDATE", []],
  [
    "TRANS-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN",
    [
      "RES-LOGICAL-HOME-LOCK",
      "RES-RUNTIME-STATE-LOCK",
      "RES-MOUNT-GRANT",
      "RES-DOCKER-OWNED",
    ],
  ],
  ["TRANS-REVIEWER-TO-STAGED", ["RES-CANDIDATE-ENTRY"]],
  ["TRANS-REMEDIATION-REVIEWER-TO-STAGED", ["RES-CANDIDATE-ENTRY"]],
  [
    "TRANS-STAGED-TO-HOST-CLEAN",
    ["RES-HOST-GENERATION", "RES-OPERATION-WORKSPACE"],
  ],
  ["TRANS-HOST-CLEAN-TO-RESULT", ["RES-CANDIDATE-ENTRY", "RES-TASK-CONTROL"]],
]);

const TERMINAL_RESOURCES = Object.freeze([
  "RES-HOST-GENERATION",
  "RES-INTERACTIVE-CONSOLE",
  "RES-LOGICAL-HOME-LOCK",
  "RES-RUNTIME-STATE-LOCK",
  "RES-MOUNT-GRANT",
  "RES-DOCKER-OWNED",
  "RES-OPERATION-WORKSPACE",
  "RES-CANDIDATE-ENTRY",
  "RES-TASK-CONTROL",
]);

const TASK_TRACE_ASSERTIONS: Readonly<
  Record<string, typeof assertRuntimeTraceCase>
> = Object.freeze({
  "CASE-NORMAL-ADMISSION-TO-OPERATION": assertRuntimeTraceCase,
  "CASE-NORMAL-OPERATION-TO-AUTHORIZED": assertRuntimeTraceCase,
  "CASE-NORMAL-AUTHORIZED-TO-EXECUTOR-CLEAN": assertRuntimeTraceCase,
  "CASE-NORMAL-EXECUTOR-TO-CANDIDATE": assertRuntimeTraceCase,
  "CASE-NORMAL-CANDIDATE-TO-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-NORMAL-REVIEWER-TO-STAGED": assertRuntimeTraceCase,
  "CASE-NORMAL-STAGED-TO-HOST-CLEAN": assertRuntimeTraceCase,
  "CASE-NORMAL-HOST-CLEAN-TO-RESULT": assertRuntimeTraceCase,
  "CASE-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN": assertRuntimeTraceCase,
  "CASE-REMEDIATION-EXECUTOR-TO-CANDIDATE": assertRuntimeTraceCase,
  "CASE-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-REMEDIATION-REVIEWER-TO-AUTHORIZED": assertRuntimeTraceCase,
  "CASE-REMEDIATION-AUTHORIZED-TO-SECOND-EXECUTOR-CLEAN":
    assertRuntimeTraceCase,
  "CASE-REMEDIATION-SECOND-EXECUTOR-TO-CANDIDATE": assertRuntimeTraceCase,
  "CASE-REMEDIATION-SECOND-CANDIDATE-TO-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-REMEDIATION-SECOND-REVIEWER-TO-STAGED": assertRuntimeTraceCase,
  "CASE-BLOCKED-ADMISSION": assertRuntimeTraceCase,
  "CASE-BLOCKED-OPERATION-READY": assertRuntimeTraceCase,
  "CASE-BLOCKED-TASK-AUTHORIZED": assertRuntimeTraceCase,
  "CASE-BLOCKED-EXECUTOR-CLEAN": assertRuntimeTraceCase,
  "CASE-BLOCKED-CANDIDATE-CAPTURED": assertRuntimeTraceCase,
  "CASE-BLOCKED-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-BLOCKED-REMEDIATION-AUTHORIZED": assertRuntimeTraceCase,
  "CASE-BLOCKED-REMEDIATION-EXECUTOR-CLEAN": assertRuntimeTraceCase,
  "CASE-BLOCKED-REMEDIATION-CANDIDATE-CAPTURED": assertRuntimeTraceCase,
  "CASE-BLOCKED-REMEDIATION-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-BLOCKED-HOST-CLEAN": assertRuntimeTraceCase,
  "CASE-RECOVERY-ADMISSION": assertRuntimeTraceCase,
  "CASE-RECOVERY-OPERATION-READY": assertRuntimeTraceCase,
  "CASE-RECOVERY-TASK-AUTHORIZED": assertRuntimeTraceCase,
  "CASE-RECOVERY-EXECUTOR-CLEAN": assertRuntimeTraceCase,
  "CASE-RECOVERY-CANDIDATE-CAPTURED": assertRuntimeTraceCase,
  "CASE-RECOVERY-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-RECOVERY-REMEDIATION-AUTHORIZED": assertRuntimeTraceCase,
  "CASE-RECOVERY-REMEDIATION-EXECUTOR-CLEAN": assertRuntimeTraceCase,
  "CASE-RECOVERY-REMEDIATION-CANDIDATE-CAPTURED": assertRuntimeTraceCase,
  "CASE-RECOVERY-REMEDIATION-REVIEWER-CLEAN": assertRuntimeTraceCase,
  "CASE-RECOVERY-CANDIDATE-STAGED": assertRuntimeTraceCase,
  "CASE-RECOVERY-HOST-CLEAN": assertRuntimeTraceCase,
});

function selectResourcePostconditions(
  snapshot: TraceSnapshot,
  resources: readonly string[],
) {
  return Object.fromEntries(
    resources.map((resource) => {
      assert.ok(
        Object.hasOwn(snapshot.resources, resource),
        `missing observed resource ${resource}`,
      );
      return [resource, snapshot.resources[resource] as string];
    }),
  );
}

function assertTerminalRuntimeTraceCase(
  caseId: string,
  harness: ReturnType<typeof fixture>,
  _result: Readonly<Record<string, unknown>>,
) {
  const terminal = harness.lifecycleSnapshots.at(-1);
  const source = harness.lifecycleSnapshots.at(-2);
  assert.ok(source && terminal);
  assert.match(terminal.state, /^STATE-(?:BLOCKED-CLEAN|RECOVERY-REQUIRED)$/u);
  const recovering = terminal.state === "STATE-RECOVERY-REQUIRED";
  const observed: RuntimeTraceCase = {
    id: caseId,
    transitionId: recovering
      ? "TRANS-ACTIVE-TO-RECOVERY"
      : "TRANS-ACTIVE-TO-BLOCKED-CLEAN",
    fromState: source.state,
    outcome: "taken",
    expectedEndState: terminal.state,
    effectObservations: {
      provider: terminal.provider - source.provider,
      host: terminal.host - source.host,
      cleanup: terminal.cleanup - source.cleanup,
    },
    expectedStatus: recovering ? "recovery_required" : "blocked",
    resourcePostconditions: selectResourcePostconditions(
      terminal,
      TERMINAL_RESOURCES,
    ),
  };
  const assertion = TASK_TRACE_ASSERTIONS[caseId];
  assert.ok(assertion, `unregistered trace assertion: ${caseId}`);
  assertion(caseId, observed);
}

function assertLifecycleRuntimeTraceCases(
  caseIds: readonly string[],
  harness: ReturnType<typeof fixture>,
) {
  for (const caseId of caseIds) {
    const edge = EDGE_BY_LIFECYCLE_CASE.get(caseId);
    assert.ok(edge, `unregistered lifecycle case: ${caseId}`);
    const fromIndex = harness.lifecycleSnapshots.findIndex(
      (snapshot, index) =>
        `${snapshot.state}>${harness.lifecycleSnapshots[index + 1]?.state}` ===
        edge,
    );
    assert.notEqual(fromIndex, -1, `unobserved lifecycle edge: ${caseId}`);
    const from = harness.lifecycleSnapshots[fromIndex] as NonNullable<
      (typeof harness.lifecycleSnapshots)[number]
    >;
    const to = harness.lifecycleSnapshots[fromIndex + 1] as typeof from;
    const transitionId = TRANSITION_BY_EDGE.get(`${from.state}>${to.state}`);
    assert.ok(transitionId, `unknown observed lifecycle edge: ${caseId}`);
    const expectedStatus =
      to.state === "STATE-OPERATION-READY" ||
      to.state === "STATE-TASK-AUTHORIZED" ||
      to.state === "STATE-REMEDIATION-AUTHORIZED"
        ? "authorized"
        : to.state === "STATE-CANDIDATE-STAGED"
          ? "staged"
          : "completed";
    const assertion = TASK_TRACE_ASSERTIONS[caseId];
    assert.ok(assertion, `unregistered trace assertion: ${caseId}`);
    assertion(caseId, {
      id: caseId,
      transitionId,
      fromState: from.state,
      outcome: "taken",
      expectedEndState: to.state,
      effectObservations: {
        provider: to.provider - from.provider,
        host: to.host - from.host,
        cleanup: to.cleanup - from.cleanup,
      },
      expectedStatus,
      resourcePostconditions: selectResourcePostconditions(
        to,
        RESOURCES_BY_TRANSITION.get(transitionId) ?? [],
      ),
    });
  }
}

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
    cleanupProtocolFailure?: boolean;
    completionRejectRole?: "executor" | "reviewer";
    candidateVerificationFails?: boolean;
    candidatePersistenceFails?: boolean;
    candidatePersistenceNeedsRecovery?: boolean;
    candidatePersistenceNeedsStoreRecovery?: boolean;
    candidatePersistenceAllowed?: boolean;
    candidateStoreUnavailable?: boolean;
    candidateSecretAtCapture?: 1 | 2;
    remediationPacketSecretBlocked?: boolean;
    workspaceSecretBlocked?: boolean;
    externalSendDenied?: boolean;
    externalSendReason?: string;
    pauseExternalAuthorization?: boolean;
    pauseOperationCreation?: boolean;
    pauseOperationCleanup?: boolean;
    pauseRole?: "executor" | "reviewer";
    hostGenerationLoss?: "cleanup_confirmed_failure" | "cleanup_unknown";
    cancellationTerminationObserved?: boolean;
    cancellationReceiptInvalid?: boolean;
    cancellationReceiptNever?: boolean;
    cleanupOutcomeUnverified?: boolean;
    discardFails?: boolean;
    discardThrows?: boolean;
    publishFails?: boolean;
    publishThrows?: boolean;
    publishNeedsStoreRecovery?: boolean;
    processStartFailureRole?: "executor" | "reviewer";
    processStartFailureOccurrence?: number;
    processCleanFailureRole?: "executor" | "reviewer";
    processCleanFailureOccurrence?: number;
    processCleanupFailureRole?: "executor" | "reviewer";
    processCleanupFailureOccurrence?: number;
    processFailureRecoveryMode?: "canonical" | "missing" | "empty" | "foreign";
    hostCleanupWal?: boolean;
    dockerIntentFailsAt?: number;
    dockerReceiptFailsAt?: number;
    dockerFinalizeFailsAt?: number;
    slateExecutorProvider?: "codex" | "claude";
    slateReviewerProvider?: "codex" | "claude";
    reviewerIndependence?:
      | "provider_independent"
      | "execution_context_independent";
    slateUnavailable?: boolean;
    admissionRecovery?: boolean;
    admissionRecoveryReason?: string;
    lifecycleObserverThrows?: boolean;
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
  const cleanupCompleted = Object.freeze({});
  const cleanupProtocolFailure = Object.freeze({});
  const packetAssignments = new WeakMap<
    object,
    Readonly<{
      role: "executor" | "reviewer";
      provider: "codex" | "claude";
    }>
  >();
  const preparedRoles = new WeakMap<object, "executor" | "reviewer">();
  const selectionRequests: Array<Record<string, unknown>> = [];
  const selectionNotices: Array<Record<string, unknown>> = [];
  const authorizedProviderSets: Array<readonly ("codex" | "claude")[]> = [];
  const events: string[] = [];
  const lifecycleStates: string[] = [];
  const lifecycleSnapshots: TraceSnapshot[] = [];
  let cleanupCount = 0;
  let hostCleanupConfirmedCount = 0;
  let providerCleanupConfirmedCount = 0;
  let selectionCount = 0;
  let discardCount = 0;
  let externalAuthorizationCount = 0;
  let dockerFinalizeCount = 0;
  let dockerReceiptCount = 0;
  let dockerIntentCount = 0;
  let abandonOperationCount = 0;
  let operationCreateCount = 0;
  let candidateStorePrepareCount = 0;
  let workspaceMaterializeCount = 0;
  let processStartCount = 0;
  let candidateCaptureCount = 0;
  let candidateEntryState:
    | "unacquired"
    | "present"
    | "preserved"
    | "transferred"
    | "absent" = "unacquired";
  let releasePausedProcess: (() => void) | null = null;
  let releaseExternalAuthorization: (() => void) | null = null;
  let releaseOperationCreation: (() => void) | null = null;
  let releaseOperationCleanup: (() => void) | null = null;
  let resolveHostGenerationLoss:
    | ((outcome: "cleanup_confirmed_failure" | "cleanup_unknown") => void)
    | null = null;
  let resolveHostGenerationFailureDetected: (() => void) | null = null;
  let cancelProcessCount = 0;
  let poisonProcessCount = 0;
  let releaseDrainCount = 0;
  let externalCancellationSignal: AbortSignal | null = null;
  const processCounts = new Map<"executor" | "reviewer", number>();
  const processStartCounts = new Map<"executor" | "reviewer", number>();
  const currentResourceSnapshot = (state: string) => {
    const terminal =
      state === "STATE-RESULT-PUBLISHED" ||
      state === "STATE-BLOCKED-CLEAN" ||
      state === "STATE-RECOVERY-REQUIRED";
    const recoveryTerminal = state === "STATE-RECOVERY-REQUIRED";
    const outstandingProvider =
      processStartCount > providerCleanupConfirmedCount;
    const operationAcquired = operationCreateCount > 0;
    const hostPresent = operationCreateCount > hostCleanupConfirmedCount;
    const workspaceAcquired = workspaceMaterializeCount > 0;
    const workspacePresent =
      workspaceAcquired && hostCleanupConfirmedCount === 0;
    return Object.freeze({
      "RES-HOST-GENERATION": hostPresent
        ? state === "STATE-RECOVERY-REQUIRED"
          ? "preserved"
          : "present"
        : "absent",
      "RES-INTERACTIVE-CONSOLE": "absent",
      "RES-LOGICAL-HOME-LOCK": outstandingProvider ? "preserved" : "absent",
      "RES-RUNTIME-STATE-LOCK": outstandingProvider ? "preserved" : "absent",
      "RES-MOUNT-GRANT": outstandingProvider ? "preserved" : "absent",
      "RES-DOCKER-OWNED": outstandingProvider
        ? "preserved"
        : processStartCount === 0
          ? options.admissionRecovery
            ? "preserved"
            : recoveryTerminal
              ? "unacquired"
              : "absent"
          : "absent",
      "RES-OPERATION-WORKSPACE": workspacePresent
        ? state === "STATE-RECOVERY-REQUIRED"
          ? "preserved"
          : "present"
        : workspaceAcquired || operationAcquired
          ? "absent"
          : recoveryTerminal
            ? "unacquired"
            : "absent",
      "RES-CANDIDATE-ENTRY":
        recoveryTerminal && candidateEntryState === "present"
          ? "preserved"
          : candidateEntryState === "unacquired" && !recoveryTerminal
            ? "absent"
            : candidateEntryState,
      "RES-TASK-CONTROL": terminal ? "absent" : "present",
    });
  };
  const dependencies = {
    observeLifecycleState: (state: string) => {
      lifecycleStates.push(state);
      lifecycleSnapshots.push({
        state,
        provider: processStartCount,
        host: operationCreateCount + hostCleanupConfirmedCount,
        cleanup: providerCleanupConfirmedCount + hostCleanupConfirmedCount,
        resources: currentResourceSnapshot(state),
      });
      if (options.lifecycleObserverThrows)
        throw new Error("fixture_lifecycle_observer_failure");
    },
    ...(options.admissionRecovery
      ? {
          prepareDockerRecoveryState: () =>
            Object.freeze({
              status: "blocked",
              reason:
                options.admissionRecoveryReason ??
                "docker_process_controller_recovery_conflict",
              dockerRecoveryId: "docker.fixture.admission.recovery",
              manualRecoveryRequired: true,
            }),
        }
      : {}),
    isolatedCancellationAckTimeoutMs: 50,
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
    createOperation: async () => {
      operationCreateCount += 1;
      if (options.pauseOperationCreation)
        await new Promise<void>((resolve) => {
          releaseOperationCreation = resolve;
        });
      return Object.freeze({
        owned,
        mountCapability,
        managementCapability,
        operationId: "OP-123456",
        hostRecoveryId: "host.fixture.recovery.record",
        ...(options.hostGenerationLoss
          ? {
              hostGenerationFailureDetected: new Promise<void>((resolve) => {
                resolveHostGenerationFailureDetected = resolve;
              }),
              hostGenerationLoss: new Promise<
                "cleanup_confirmed_failure" | "cleanup_unknown"
              >((resolve) => {
                resolveHostGenerationLoss = resolve;
              }),
              releaseHostGenerationDrain: () => {
                releaseDrainCount += 1;
                return true;
              },
            }
          : {}),
      });
    },
    cleanupOperation: async (candidate: object) => {
      assert.equal(candidate, owned);
      if (options.hostCleanupWal) events.push("host-cleanup");
      cleanupCount += 1;
      if (options.pauseOperationCleanup)
        await new Promise<void>((resolve) => {
          releaseOperationCleanup = resolve;
        });
      if (options.cleanupThrows) throw new Error("cleanup_failed");
      hostCleanupConfirmedCount += 1;
      return options.cleanupProtocolFailure
        ? cleanupProtocolFailure
        : cleanupCompleted;
    },
    classifyOperationCleanup: (outcome: unknown) =>
      options.cleanupOutcomeUnverified
        ? null
        : outcome === cleanupCompleted
          ? ("completed" as const)
          : outcome === cleanupProtocolFailure
            ? ("protocol_failure_cleanup_confirmed" as const)
            : null,
    abandonOperation: async () => {
      abandonOperationCount += 1;
      return "released" as const;
    },
    poisonProcessAfterCleanupUnknown: () => {
      poisonProcessCount += 1;
    },
    isProcessPoisoned: () => poisonProcessCount > 0,
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
    preflightSlate: () =>
      options.slateUnavailable
        ? Object.freeze({
            status: "blocked",
            reason: "delegation_slate_reviewer_unavailable",
            providerEffectAllowed: false,
          })
        : Object.freeze({
            status: "candidate",
            executorProvider: options.slateExecutorProvider ?? "claude",
            reviewerProvider: options.slateReviewerProvider ?? "codex",
            reviewerIndependence:
              options.reviewerIndependence ?? "provider_independent",
            providerEffectAllowed: false,
          }),
    materializeWorkspace: () => {
      workspaceMaterializeCount += 1;
      return options.workspaceSecretBlocked
        ? Object.freeze({
            status: "blocked",
            reason: "repository_read_projection_recognized_secret_rejected",
          })
        : Object.freeze({ status: "materialized", workspaceCapability });
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
      providers: readonly ("codex" | "claude")[],
      cancellationSignal: AbortSignal,
    ) => {
      externalAuthorizationCount += 1;
      authorizedProviderSets.push(Object.freeze([...providers]));
      externalCancellationSignal = cancellationSignal;
      if (options.externalSendReason?.includes("cleanup_unknown"))
        poisonProcessCount += 1;
      const authorization = options.externalSendReason
        ? Object.freeze({
            status: "blocked",
            reason: options.externalSendReason,
            manualRecoveryRequired:
              options.externalSendReason.includes("cleanup_unknown") ||
              options.externalSendReason.includes("manual_recovery_required"),
          })
        : options.externalSendDenied
          ? null
          : Object.freeze({
              status: "issued",
              capability: externalSendGrantCapability,
              authorizationMode: "reused_initial_consent",
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
      provider: "codex" | "claude",
      taskRole: "executor" | "reviewer",
      taskAttempt: 0 | 1,
      externalSendGrant: object,
      _remediationCapability: object | null,
    ) => {
      assert.equal(externalSendGrant, externalSendGrantCapability);
      if (
        options.remediationPacketSecretBlocked &&
        taskRole === "executor" &&
        taskAttempt === 1
      ) {
        return Object.freeze({
          status: "blocked",
          reason: "provider_task_packet_recognized_secret_rejected",
          pathReported: false,
          secretMaterialReported: false,
        });
      }
      const useCapability = Object.freeze({});
      packetAssignments.set(
        useCapability,
        Object.freeze({ role: taskRole, provider }),
      );
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
      const assignment = packetAssignments.get(taskUse);
      assert.ok(assignment);
      const role = assignment.role;
      assert.equal(provider, assignment.provider);
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
      const roleStartCount = (processStartCounts.get(role) ?? 0) + 1;
      processStartCounts.set(role, roleStartCount);
      if (
        options.processStartFailureRole === role &&
        (options.processStartFailureOccurrence ?? 1) === roleStartCount
      ) {
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
      const cleanupFails =
        options.processCleanupFailureRole === role &&
        (options.processCleanupFailureOccurrence ?? 1) === processCount;
      const cleanFailure =
        options.processCleanFailureRole === role &&
        (options.processCleanFailureOccurrence ?? 1) === processCount;
      const completedResultFields: Record<string, unknown> = {
        status: cleanupFails || cleanFailure ? "blocked" : "completed",
        reason: cleanupFails
          ? "fixture_cleanup_failed"
          : cleanFailure
            ? "fixture_provider_failed"
            : "completed",
        cleanupConfirmed: !cleanupFails,
        recoveryId:
          cleanupFails && options.processFailureRecoveryMode === "empty"
            ? ""
            : cleanupFails && options.processFailureRecoveryMode === "foreign"
              ? "docker.fixture.foreign"
              : cleanupFails
                ? activeRecoveryId
                : null,
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
      };
      if (cleanupFails && options.processFailureRecoveryMode === "missing")
        delete completedResultFields.recoveryId;
      const completedResult = Object.freeze(completedResultFields);
      const rawCompletion =
        options.completionRejectRole === role
          ? Promise.reject(new Error("unexpected_completion_rejection"))
          : options.pauseRole === role
            ? new Promise<typeof completedResult>((resolve) => {
                releasePausedProcess = () => resolve(completedResult);
              })
            : Promise.resolve(completedResult);
      const completion = rawCompletion.then((value) => {
        if (value.cleanupConfirmed === true) providerCleanupConfirmedCount += 1;
        return value;
      });
      return Object.freeze({
        status: "started",
        reason: "started",
        controlCapability: Object.freeze({}),
        recoveryId: activeRecoveryId,
        completion,
      });
    },
    cancelProcess: async () => {
      cancelProcessCount += 1;
      if (options.cancellationReceiptNever)
        return new Promise<never>(() => undefined);
      if (options.cancellationReceiptInvalid)
        return Object.freeze({ status: "requested" });
      const processTerminationObserved =
        options.cancellationTerminationObserved !== false;
      return Object.freeze({
        status: "requested",
        reason: processTerminationObserved
          ? "provider_cancellation_requested"
          : "provider_cancellation_grace_exceeded",
        cancellationRequested: true,
        processTerminationObserved,
      });
    },
    captureCandidate: () => {
      candidateCaptureCount += 1;
      return options.candidateSecretAtCapture === candidateCaptureCount
        ? Object.freeze({
            status: "blocked",
            reason: "candidate_recognized_secret_rejected",
          })
        : Object.freeze({
            status: "candidate",
            candidateCapability,
            changedPaths: Object.freeze(["fixture.txt"]),
          });
    },
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
    persistCandidate: () => {
      const outcome = options.candidatePersistenceFails
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
              });
      if (outcome?.status === "staged") candidateEntryState = "present";
      else if (outcome?.manualRecoveryRequired === true)
        candidateEntryState = "preserved";
      return outcome;
    },
    discardCandidate: () => {
      discardCount += 1;
      if (options.discardThrows) throw new Error("fixture_discard_failure");
      const outcome = Object.freeze({
        status: options.discardFails ? "blocked" : "discarded",
      });
      if (outcome.status === "discarded") candidateEntryState = "absent";
      return outcome;
    },
    publishCandidate: () => {
      if (options.publishThrows) throw new Error("fixture_publish_failure");
      const outcome = options.publishFails
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
      if (outcome?.status === "published") candidateEntryState = "transferred";
      else if (outcome?.manualRecoveryRequired === true)
        candidateEntryState = "preserved";
      return outcome;
    },
    ...(options.hostCleanupWal
      ? {
          prepareDockerHostCleanup: () => {
            events.push("docker-host-cleanup-intent");
            dockerIntentCount += 1;
            if (options.dockerIntentFailsAt === dockerIntentCount) return null;
            return "host.fixture.cleanup.intent";
          },
          recordDockerHostCleanupReceipt: () => {
            events.push("docker-host-cleanup-receipt");
            dockerReceiptCount += 1;
            return options.dockerReceiptFailsAt !== dockerReceiptCount;
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
    authorizedProviderSets,
    events,
    lifecycleStates,
    lifecycleSnapshots,
    effectCounts: () => ({
      provider: processStartCount,
      host: operationCreateCount + hostCleanupConfirmedCount,
      cleanup: providerCleanupConfirmedCount + hostCleanupConfirmedCount,
    }),
    cleanupCount: () => cleanupCount,
    discardCount: () => discardCount,
    externalAuthorizationCount: () => externalAuthorizationCount,
    operationCreateCount: () => operationCreateCount,
    candidateStorePrepareCount: () => candidateStorePrepareCount,
    workspaceMaterializeCount: () => workspaceMaterializeCount,
    processStartCount: () => processStartCount,
    candidateCaptureCount: () => candidateCaptureCount,
    cancelProcessCount: () => cancelProcessCount,
    poisonProcessCount: () => poisonProcessCount,
    releaseDrainCount: () => releaseDrainCount,
    abandonOperationCount: () => abandonOperationCount,
    dockerIntentCount: () => dockerIntentCount,
    dockerReceiptCount: () => dockerReceiptCount,
    dockerFinalizeCount: () => dockerFinalizeCount,
    externalCancellationSignal: () => externalCancellationSignal,
    releaseExternalAuthorization: () => {
      assert.ok(releaseExternalAuthorization);
      releaseExternalAuthorization();
    },
    releaseOperationCreation: () => {
      assert.ok(releaseOperationCreation);
      releaseOperationCreation();
    },
    releaseOperationCleanup: () => {
      assert.ok(releaseOperationCleanup);
      releaseOperationCleanup();
    },
    releasePausedProcess: () => {
      assert.ok(releasePausedProcess);
      releasePausedProcess();
    },
    triggerHostGenerationLoss: () => {
      assert.ok(resolveHostGenerationFailureDetected);
      assert.ok(resolveHostGenerationLoss);
      assert.ok(options.hostGenerationLoss);
      resolveHostGenerationFailureDetected();
      resolveHostGenerationLoss(options.hostGenerationLoss);
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

test("認証秘密を示すTask PathはOperationと外部送信前に安全な理由で停止する", async () => {
  const harness = fixture();
  const result = await harness.runtime.start(
    request({ allowedPaths: [".env"], readPaths: [".env"] }),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_scope_recognized_secret_rejected",
  );
  assert.equal(harness.operationCreateCount(), 0);
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 0);
});

test("読取投影の認証秘密はProvider Effect前に安全な理由で停止する", async () => {
  const harness = fixture({ workspaceSecretBlocked: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_read_projection_recognized_secret_rejected",
  );
  assert.equal(harness.workspaceMaterializeCount(), 1);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 1);
});

test("Executorが生成した認証秘密はReviewerへ渡さず安全な理由で停止する", async () => {
  const harness = fixture({ candidateSecretAtCapture: 1 });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_candidate_recognized_secret_rejected",
  );
  assert.deepEqual(harness.events, ["notice:executor", "start:executor"]);
  assert.equal(harness.processStartCount(), 1);
  assert.equal(harness.cleanupCount(), 1);
});

test("是正Executorが生成した認証秘密も再Reviewerへ渡さず停止する", async () => {
  const harness = fixture({
    reviewerDecision: "changes_requested",
    candidateSecretAtCapture: 2,
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_candidate_recognized_secret_rejected",
  );
  assert.deepEqual(harness.events, [
    "notice:executor",
    "start:executor",
    "notice:reviewer",
    "start:reviewer",
    "notice:executor",
    "start:executor",
  ]);
  assert.equal(harness.processStartCount(), 3);
  assert.equal(harness.cleanupCount(), 1);
});

test("Codex frontからClaude Executorと独立Codex Reviewerを隔離Candidateへ接続する", async () => {
  const traceCaseIds = [
    "CASE-NORMAL-ADMISSION-TO-OPERATION",
    "CASE-NORMAL-OPERATION-TO-AUTHORIZED",
    "CASE-NORMAL-AUTHORIZED-TO-EXECUTOR-CLEAN",
    "CASE-NORMAL-EXECUTOR-TO-CANDIDATE",
    "CASE-NORMAL-CANDIDATE-TO-REVIEWER-CLEAN",
    "CASE-NORMAL-REVIEWER-TO-STAGED",
    "CASE-NORMAL-STAGED-TO-HOST-CLEAN",
    "CASE-NORMAL-HOST-CLEAN-TO-RESULT",
  ] as const;
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
  assertLifecycleRuntimeTraceCases(traceCaseIds, harness);
});

test("lifecycle observer例外はRuntime状態・Authority・Effect・結果を変更しない", async () => {
  const baseline = fixture();
  const throwing = fixture({ lifecycleObserverThrows: true });
  const [baselineResult, throwingResult] = await Promise.all([
    baseline.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion,
    throwing.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion,
  ]);
  assert.deepEqual(throwingResult, baselineResult);
  assert.deepEqual(throwing.effectCounts(), baseline.effectCounts());
  assert.deepEqual(throwing.lifecycleStates, baseline.lifecycleStates);
});

test("両Front×両Executorの4経路をEffect前Slateと独立Reviewerへ接続する", async () => {
  const cases = [
    ["codex", "claude", "codex"],
    ["codex", "codex", "claude"],
    ["claude", "codex", "claude"],
    ["claude", "claude", "codex"],
  ] as const;
  for (const [frontProvider, executorProvider, reviewerProvider] of cases) {
    const harness = fixture({
      slateExecutorProvider: executorProvider,
      slateReviewerProvider: reviewerProvider,
    });
    const started = harness.runtime.start(
      request({ frontProvider }),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    );
    const result = await started.completion;
    assert.equal(result.status, "completed");
    assert.equal(result.executorProvider, executorProvider);
    assert.equal(result.reviewerProvider, reviewerProvider);
    assert.equal(result.reviewerIndependence, "provider_independent");
    assert.equal(harness.processStartCount(), 2);
    assert.equal(
      harness.selectionRequests[0]?.requestedExecutorProvider,
      executorProvider,
    );
    assert.equal(
      harness.selectionRequests[1]?.requestedExecutorProvider,
      reviewerProvider,
    );
    assert.equal(
      harness.selectionRequests[1]?.requiresIndependentProvider,
      true,
    );
  }
});

test("同一Provider Reviewerは低リスクSlateが指定した別実行Contextだけを使う", async () => {
  for (const provider of ["codex", "claude"] as const) {
    const harness = fixture({
      slateExecutorProvider: provider,
      slateReviewerProvider: provider,
      reviewerIndependence: "execution_context_independent",
    });
    const started = harness.runtime.start(
      request({ frontProvider: provider }),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    );
    const result = await started.completion;
    assert.equal(result.status, "completed");
    assert.equal(result.executorProvider, provider);
    assert.equal(result.reviewerProvider, provider);
    assert.equal(result.reviewerIndependence, "execution_context_independent");
    assert.notEqual(harness.selectionRequests[0], harness.selectionRequests[1]);
    assert.equal(
      harness.selectionRequests[1]?.requestedExecutorProvider,
      provider,
    );
    assert.equal(
      harness.selectionRequests[1]?.requiresIndependentProvider,
      false,
    );
    assert.equal(harness.processStartCount(), 2);
    assert.deepEqual(harness.authorizedProviderSets, [[provider]]);
  }
});

test("完遂可能なExecution SlateがなければExternal SendとExecutor Effect前に停止する", async () => {
  const harness = fixture({ slateUnavailable: true });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_execution_slate_unavailable");
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.candidateStorePrepareCount(), 0);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
  assert.equal(harness.cleanupCount(), 1);
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

test("finalizable Docker handoffは0／1／2件で同じcleanup DAGへ進む", async () => {
  const zero = fixture({ externalSendDenied: true, hostCleanupWal: true });
  const zeroResult = await zero.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(zeroResult.processRestartRequired, false);
  assert.equal(zero.cleanupCount(), 1);

  const one = fixture({ hostCleanupWal: true, candidateSecretAtCapture: 1 });
  const oneResult = await one.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(oneResult.status, "blocked");
  assert.equal(oneResult.manualRecoveryRequired, false);
  assert.deepEqual(oneResult.dockerRecoveryIds, []);
  assert.equal(one.cleanupCount(), 1);
  assert.deepEqual(one.events.slice(-4), [
    "docker-host-cleanup-intent",
    "host-cleanup",
    "docker-host-cleanup-receipt",
    "docker-finalize",
  ]);

  const two = fixture({ hostCleanupWal: true });
  const twoResult = await two.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(twoResult.status, "completed");
  assert.deepEqual(twoResult.dockerRecoveryIds, []);
  assert.equal(two.cleanupCount(), 1);
  assert.equal(
    two.events.filter((event) => event === "docker-finalize").length,
    2,
  );
});

test("managed handoffとraw Docker IDの混在はHost cleanup前に全件保持する", async () => {
  const harness = fixture({
    hostCleanupWal: true,
    processStartFailureRole: "reviewer",
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker.fixture.reviewer.start",
    "docker.fixture.executor.active",
  ]);
  assert.equal(harness.cleanupCount(), 0);
  assert.equal(harness.events.includes("docker-host-cleanup-intent"), false);
});

test("各Stageのraw Docker欠落・empty・foreignは表示補完前にcleanup Authorityを閉じる", async () => {
  const cases = [
    {
      harness: fixture({
        hostCleanupWal: true,
        processCleanupFailureRole: "executor",
        processFailureRecoveryMode: "missing",
      }),
      expected: ["docker.fixture.executor.active"],
    },
    {
      harness: fixture({
        hostCleanupWal: true,
        processCleanupFailureRole: "reviewer",
        processFailureRecoveryMode: "empty",
      }),
      expected: [
        "docker.fixture.executor.active",
        "docker.fixture.reviewer.active",
      ],
    },
    {
      harness: fixture({
        hostCleanupWal: true,
        reviewerDecision: "changes_requested",
        finalReviewerDecision: "approved",
        processCleanupFailureRole: "executor",
        processCleanupFailureOccurrence: 2,
        processFailureRecoveryMode: "foreign",
      }),
      expected: [
        "docker.fixture.foreign",
        "docker.fixture.executor.active",
        "docker.fixture.reviewer.active",
        "docker.fixture.executor.active-2",
      ],
    },
  ];
  for (const { harness, expected } of cases) {
    const result = await harness.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.manualRecoveryRequired, true);
    assert.deepEqual(result.dockerRecoveryIds, expected);
    assert.equal(harness.dockerIntentCount(), 0);
    assert.equal(harness.dockerReceiptCount(), 0);
    assert.equal(harness.dockerFinalizeCount(), 0);
    assert.equal(harness.cleanupCount(), 0);
    assert.equal(harness.abandonOperationCount(), 1);
  }
});

test("複数Docker intentの途中失敗はHost cleanupへ進まず未解決集合を保持する", async () => {
  const harness = fixture({ hostCleanupWal: true, dockerIntentFailsAt: 2 });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(
    result.reason,
    "coordinator_task_host_cleanup_intent_unconfirmed",
  );
  assert.equal(result.hostRecoveryId, "host.fixture.cleanup.intent");
  assert.deepEqual([...result.dockerRecoveryIds].sort(), [
    "docker.fixture.executor.active",
    "docker.fixture.reviewer.active",
  ]);
  assert.equal(harness.cleanupCount(), 0);
  assert.equal(
    harness.events.filter((event) => event === "docker-host-cleanup-intent")
      .length,
    2,
  );
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
  assert.equal(result.hostRecoveryId, null);
  assert.equal(harness.abandonOperationCount(), 0);
});

test("Host cleanup後のDocker receipt失敗は無効なHost IDを再公開しない", async () => {
  const harness = fixture({ hostCleanupWal: true, dockerReceiptFailsAt: 1 });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_host_cleanup_receipt_unconfirmed",
  );
  assert.equal(result.hostRecoveryId, null);
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker.fixture.executor.active",
    "docker.fixture.reviewer.active",
  ]);
  assert.equal(harness.abandonOperationCount(), 0);
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
  const traceCaseIds = [
    "CASE-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN",
    "CASE-REMEDIATION-EXECUTOR-TO-CANDIDATE",
    "CASE-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN",
    "CASE-REMEDIATION-REVIEWER-TO-AUTHORIZED",
    "CASE-REMEDIATION-AUTHORIZED-TO-SECOND-EXECUTOR-CLEAN",
    "CASE-REMEDIATION-SECOND-EXECUTOR-TO-CANDIDATE",
    "CASE-REMEDIATION-SECOND-CANDIDATE-TO-REVIEWER-CLEAN",
    "CASE-REMEDIATION-SECOND-REVIEWER-TO-STAGED",
  ] as const;
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
  assertLifecycleRuntimeTraceCases(traceCaseIds, harness);
});

test("Reviewer由来Secret Pathは是正Executor Process前に安全な理由で停止する", async () => {
  const harness = fixture({
    reviewerDecision: "changes_requested",
    remediationPacketSecretBlocked: true,
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_remediation_recognized_secret_rejected",
  );
  assert.deepEqual(harness.events, [
    "notice:executor",
    "start:executor",
    "notice:reviewer",
    "start:reviewer",
    "notice:executor",
  ]);
  assert.equal(harness.processStartCount(), 2);
  assert.equal(harness.cleanupCount(), 1);
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
  assert.equal(result.processRestartRequired, true);
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
  assert.equal(combined.processRestartRequired, true);
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

test("Host Supervisor protocol失敗後の確認済みcleanupは成功公開も手動Recoveryも行わない", async () => {
  const harness = fixture({ cleanupProtocolFailure: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
  );
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.hostRecoveryId, null);
  assert.equal(result.candidateRecoveryId, null);
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(harness.discardCount(), 1);
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
  assert.equal(result.processRestartRequired, false);
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

test("Candidate Storeだけのmanual recoveryはHostとDocker cleanupを保留しない", async () => {
  const harness = fixture({
    hostCleanupWal: true,
    candidatePersistenceNeedsStoreRecovery: true,
  });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.hostRecoveryId, null);
  assert.deepEqual(result.dockerRecoveryIds, []);
  assert.match(
    result.candidateStoreRecoveryId ?? "",
    /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  );
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(
    harness.events.filter((event) => event === "docker-finalize").length,
    2,
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
  assert.equal(result.hostRecoveryId, null);
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
  assert.equal(result.hostRecoveryId, null);
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
  const firstCancellation = harness.runtime.cancel(started.controlCapability);
  const duplicateCancellation = harness.runtime.cancel(
    started.controlCapability,
  );
  assert.strictEqual(duplicateCancellation, firstCancellation);
  const cancelled = await firstCancellation;
  assert.deepEqual(cancelled, {
    status: "requested",
    reason: "provider_cancellation_requested",
    cancellationRequested: true,
    processTerminationObserved: true,
  });
  const duplicate = await duplicateCancellation;
  assert.strictEqual(duplicate, cancelled);
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

test("不正なlower取消receiptも同じlive Operationでは同じcached rejectionへ閉じる", async () => {
  const harness = fixture({
    pauseRole: "executor",
    cancellationReceiptInvalid: true,
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  await new Promise((resolve) => setImmediate(resolve));
  const firstCancellation = harness.runtime.cancel(started.controlCapability);
  const duplicateCancellation = harness.runtime.cancel(
    started.controlCapability,
  );
  assert.strictEqual(duplicateCancellation, firstCancellation);
  await assert.rejects(
    firstCancellation,
    /coordinator_task_cancellation_receipt_invalid/u,
  );
  await assert.rejects(
    duplicateCancellation,
    /coordinator_task_cancellation_receipt_invalid/u,
  );
  assert.equal(harness.cancelProcessCount(), 1);
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.processRestartRequired, true);
});

test("never取消receiptはack上限後にcleanupを続けて不可逆poisonへ閉じる", async () => {
  const harness = fixture({
    pauseRole: "executor",
    cancellationReceiptNever: true,
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  await new Promise((resolve) => setImmediate(resolve));
  void harness.runtime.cancel(started.controlCapability);
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
  );
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processRestartRequired, true);
  assert.equal(harness.cancelProcessCount(), 1);
  assert.ok(harness.poisonProcessCount() >= 1);
});

test("取消protocol failureと資源cleanup unknownは依存順を守り全actionable Recoveryを保持する", async () => {
  const harness = fixture({
    pauseRole: "reviewer",
    cancellationReceiptInvalid: true,
    processCleanupFailureRole: "reviewer",
    cleanupThrows: true,
    hostCleanupWal: true,
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.processStartCount() < 2)
    await new Promise((resolve) => setImmediate(resolve));
  void harness.runtime.cancel(started.controlCapability);
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_cancellation_protocol_failed_cleanup_unknown",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.processRestartRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker.fixture.executor.active",
    "docker.fixture.reviewer.active",
  ]);
  assert.equal(result.candidateRecoveryId, null);
  assert.equal(result.candidateStoreRecoveryId, null);
  assert.equal(harness.cancelProcessCount(), 1);
  assert.equal(harness.cleanupCount(), 0);
  assert.equal(harness.discardCount(), 0);
  assert.equal(harness.dockerReceiptCount(), 0);
  assert.equal(harness.dockerFinalizeCount(), 0);
  assert.equal(harness.candidateCaptureCount(), 1);
  assert.ok(harness.poisonProcessCount() >= 1);
  assert.deepEqual(harness.events, [
    "notice:executor",
    "start:executor",
    "notice:reviewer",
    "start:reviewer",
  ]);
});

test("ready後のHost Supervisor喪失は実行中Providerを取消して成功公開を拒否する", async () => {
  const harness = fixture({
    pauseRole: "executor",
    hostGenerationLoss: "cleanup_confirmed_failure",
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.processStartCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.triggerHostGenerationLoss();
  while (harness.cancelProcessCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
  );
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.hostRecoveryId, null);
  assert.equal(harness.cancelProcessCount(), 1);
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(harness.poisonProcessCount(), 0);
  assert.equal(harness.releaseDrainCount(), 1);
});

test("ready後喪失のcleanup不明は取消より優先してexact Host Recoveryへ閉じる", async () => {
  const harness = fixture({
    pauseRole: "executor",
    hostGenerationLoss: "cleanup_unknown",
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.processStartCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.triggerHostGenerationLoss();
  while (harness.cancelProcessCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
  assert.equal(harness.cancelProcessCount(), 1);
  assert.equal(harness.cleanupCount(), 0);
  assert.ok(harness.poisonProcessCount() >= 1);
  assert.equal(harness.releaseDrainCount(), 1);
});

test("Host confirmedとProvider cleanup unknownの合成は全actionable Recovery IDを保持する", async () => {
  const harness = fixture({
    pauseRole: "executor",
    processCleanupFailureRole: "executor",
    hostGenerationLoss: "cleanup_confirmed_failure",
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.processStartCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.triggerHostGenerationLoss();
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker.fixture.executor.active",
  ]);
  assert.equal(result.processRestartRequired, true);
  assert.ok(harness.poisonProcessCount() >= 1);
});

test("Candidate staged後のHost confirmed lossはpublishせずdiscardしてcleanup confirmedへ閉じる", async () => {
  const harness = fixture({
    pauseOperationCleanup: true,
    hostGenerationLoss: "cleanup_confirmed_failure",
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.cleanupCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.triggerHostGenerationLoss();
  harness.releaseOperationCleanup();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.candidateRecoveryId, null);
  assert.equal(harness.discardCount(), 1);
  assert.equal(harness.poisonProcessCount(), 0);
});

test("Host confirmedでもProvider取消終了不明ならunknownへ昇格してpoisonする", async () => {
  const harness = fixture({
    pauseRole: "executor",
    hostGenerationLoss: "cleanup_confirmed_failure",
    cancellationTerminationObserved: false,
  });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.processStartCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  harness.triggerHostGenerationLoss();
  harness.releasePausedProcess();
  const result = await started.completion;
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.processRestartRequired, true);
  assert.ok(harness.poisonProcessCount() >= 1);
});

test("分類不能なopaque cleanup outcomeはcleanup unknownへ閉じる", async () => {
  const harness = fixture({ cleanupOutcomeUnverified: true });
  const result = await harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  ).completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.hostRecoveryId, "host.fixture.recovery.record");
});

test("Operation作成待機中の取消は最初の後続Effect前にcleanupへ閉じる", async () => {
  const harness = fixture({ pauseOperationCreation: true });
  const started = harness.runtime.start(
    request(),
    "C:\\repo",
    "2026-08-27T00:00:00Z",
  );
  assert.equal(started.status, "started");
  while (harness.operationCreateCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await harness.runtime.cancel(started.controlCapability), {
    status: "requested",
    reason: "provider_cancellation_requested",
    cancellationRequested: true,
    processTerminationObserved: true,
  });
  harness.releaseOperationCreation();
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_cancelled_during_operation_creation",
  );
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(harness.cleanupCount(), 1);
  assert.equal(harness.selectionRequests.length, 0);
  assert.equal(harness.candidateStorePrepareCount(), 0);
  assert.equal(harness.externalAuthorizationCount(), 0);
  assert.equal(harness.workspaceMaterializeCount(), 0);
  assert.equal(harness.processStartCount(), 0);
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
    reason: "provider_cancellation_requested",
    cancellationRequested: true,
    processTerminationObserved: true,
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

test("不正controlの取消はexact blockedかつEffect 0へ閉じる", async () => {
  const harness = fixture();
  for (const control of [null, Object.freeze({})])
    assert.deepEqual(await harness.runtime.cancel(control), {
      status: "blocked",
      reason: "coordinator_task_control_invalid",
    });
  assert.equal(harness.cancelProcessCount(), 0);
});

test("Task producerはRunnerが安全に観測できるexact native completionを返す", async () => {
  const harness = fixture();
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(utilTypes.isProxy(started.completion), false);
  assert.equal(utilTypes.isPromise(started.completion), true);
  assert.strictEqual(
    Object.getPrototypeOf(started.completion),
    Promise.prototype,
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(started.completion, "then"),
    undefined,
  );
  await started.completion;
});

test("別Runtimeのlive controlは両RuntimeのEffect 0でforeignへ閉じる", async () => {
  const source = fixture({ pauseRole: "executor" });
  const target = fixture();
  const started = source.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  await new Promise((resolve) => setImmediate(resolve));
  const sourceBefore = Object.freeze({
    cancels: source.cancelProcessCount(),
    cleanups: source.cleanupCount(),
    poison: source.poisonProcessCount(),
  });
  const targetBefore = Object.freeze({
    cancels: target.cancelProcessCount(),
    cleanups: target.cleanupCount(),
    poison: target.poisonProcessCount(),
  });
  const blocked = await target.runtime.cancel(started.controlCapability);
  assert.deepEqual(blocked, {
    status: "blocked",
    reason: "coordinator_task_control_invalid",
  });
  assert.equal(Object.isFrozen(blocked), true);
  assert.deepEqual(
    {
      cancels: source.cancelProcessCount(),
      cleanups: source.cleanupCount(),
      poison: source.poisonProcessCount(),
    },
    sourceBefore,
  );
  assert.deepEqual(
    {
      cancels: target.cancelProcessCount(),
      cleanups: target.cleanupCount(),
      poison: target.poisonProcessCount(),
    },
    targetBefore,
  );
  source.releasePausedProcess();
  await started.completion;
});

test("正常completion後の失効controlは追加Effect 0へ閉じる", async () => {
  const harness = fixture();
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  await started.completion;
  const before = Object.freeze({
    cancels: harness.cancelProcessCount(),
    cleanups: harness.cleanupCount(),
    poison: harness.poisonProcessCount(),
    abandons: harness.abandonOperationCount(),
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const blocked = await harness.runtime.cancel(started.controlCapability);
    assert.deepEqual(blocked, {
      status: "blocked",
      reason: "coordinator_task_control_invalid",
    });
    assert.equal(Object.isFrozen(blocked), true);
  }
  assert.deepEqual(
    {
      cancels: harness.cancelProcessCount(),
      cleanups: harness.cleanupCount(),
      poison: harness.poisonProcessCount(),
      abandons: harness.abandonOperationCount(),
    },
    before,
  );
});

test("外周cleanup中の重複取消はliveな同じPromiseへ収束しcleanupを妨げない", async () => {
  const harness = fixture({ pauseOperationCleanup: true });
  const started = harness.runtime.start(
    request(),
    "C:\\repository",
    "2026-08-25T00:00:00.000Z",
  );
  while (harness.cleanupCount() === 0)
    await new Promise((resolve) => setImmediate(resolve));
  const first = harness.runtime.cancel(started.controlCapability);
  const duplicate = harness.runtime.cancel(started.controlCapability);
  assert.strictEqual(duplicate, first);
  assert.strictEqual(await duplicate, await first);
  harness.releaseOperationCleanup();
  await started.completion;
  assert.equal(harness.cleanupCount(), 1);
});

test("公開契約は4経路、独立Reviewer、stdin、非canonical Effectを固定する", () => {
  const contract = describeCoordinatorTaskRuntimeContract();
  assert.equal(contract.contractRevision, 21);
  assert.equal(contract.routes.length, 4);
  assert.equal(
    contract.executionSlate,
    "executor_and_reviewer_preflighted_together_before_external_send_or_provider_effect",
  );
  assert.equal(
    contract.independentReview.providerIndependent,
    "preferred_subject_provider_excluded",
  );
  assert.equal(contract.independentReview.highRiskSameProviderAllowed, false);
  assert.equal(contract.taskTransport, "opaque_single_use_provider_stdin_only");
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.directProviderToProviderSpawnAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(
    contract.processPoisonGate,
    "before_package_consume_operation_console_store_workspace_provider_and_network",
  );
  assert.equal(
    contract.processRestartProjection,
    "runtime_owned_final_irreversible_process_poison_boolean_independent_from_recovery_identifiers_manual_recovery_reason_and_temporary_drain",
  );
  assert.deepEqual(contract.cancellation, {
    liveControlReceipt:
      "exact_status_reason_cancellation_requested_process_termination_observed",
    reasonCorrelation:
      "termination_true_requested_or_termination_false_grace_exceeded",
    duplicateLiveOperation:
      "same_cancellation_effect_same_promise_same_frozen_receipt",
    invalidForeignOrExpiredControl:
      "exact_blocked_control_invalid_with_zero_effect",
    legacyReceiptFallbackAllowed: false,
    acknowledgmentTimeoutMs: 10_000,
    protocolFailure:
      "irreversible_process_poison_joined_before_completion_projection_while_resource_cleanup_continues",
    liveControlLifetime:
      "from_started_return_until_outer_completion_final_settlement_including_cleanup",
  });
  assert.equal(
    contract.completionOwnership,
    "production_producer_returns_exact_native_promise_and_owns_settlement_non_native_completion_is_not_runner_authority",
  );
  assert.equal(
    contract.hostOperationGenerationReadiness,
    "dedicated_supervisor_process_round_trip_then_same_generation_and_durable_record_file_hash_state_root_children_reconfirmation_before_any_following_effect",
  );
  assert.equal(
    contract.hostOperationSupervisorOutcomes,
    "acquired_unavailable_cleanup_confirmed_failure_or_cleanup_unknown_with_exact_recovery_and_process_poison",
  );
  assert.equal(
    contract.operationCreationCancellation,
    "rechecked_after_async_creation_before_repository_policy_slate_store_console_or_provider_effect",
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

test("Task terminal Traceは開始状態ごとの実scenarioと資源後条件を分離する", async (t) => {
  await t.test("CASE-BLOCKED-ADMISSION", async () => {
    const harness = fixture({
      inspectRepository: inspectRepositoryObjectFormatCandidate,
    });
    const result = await harness.runtime.start(
      request(),
      sha256Repository(t),
      "2026-08-25T00:00:00.000Z",
    ).completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.manualRecoveryRequired, false);
    assert.equal(harness.operationCreateCount(), 0);
    assert.equal(harness.processStartCount(), 0);
    assert.equal(harness.cleanupCount(), 0);
    assert.equal(harness.lifecycleStates.at(-2), "STATE-ADMISSION");
    assert.equal(harness.lifecycleStates.at(-1), "STATE-BLOCKED-CLEAN");
    assertTerminalRuntimeTraceCase("CASE-BLOCKED-ADMISSION", harness, result);
  });

  await t.test("CASE-RECOVERY-ADMISSION", async () => {
    const harness = fixture({ admissionRecovery: true });
    const result = await harness.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.dockerRecoveryId, "docker.fixture.admission.recovery");
    assert.equal(harness.operationCreateCount(), 0);
    assert.equal(harness.processStartCount(), 0);
    assert.equal(harness.lifecycleStates.at(-2), "STATE-ADMISSION");
    assert.equal(harness.lifecycleStates.at(-1), "STATE-RECOVERY-REQUIRED");
    assertTerminalRuntimeTraceCase("CASE-RECOVERY-ADMISSION", harness, result);
  });

  await t.test("CASE-BLOCKED-TASK-AUTHORIZED", async () => {
    const harness = fixture({ pauseRole: "executor" });
    const started = harness.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    );
    while (harness.processStartCount() === 0)
      await new Promise((resolve) => setImmediate(resolve));
    void harness.runtime.cancel(started.controlCapability);
    harness.releasePausedProcess();
    const result = await started.completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.manualRecoveryRequired, false);
    assert.equal(harness.operationCreateCount(), 1);
    assert.equal(harness.processStartCount(), 1);
    assert.equal(harness.candidateCaptureCount(), 0);
    assert.equal(harness.cleanupCount(), 1);
    assert.equal(harness.lifecycleStates.at(-2), "STATE-TASK-AUTHORIZED");
    assert.equal(harness.lifecycleStates.at(-1), "STATE-BLOCKED-CLEAN");
    assertTerminalRuntimeTraceCase(
      "CASE-BLOCKED-TASK-AUTHORIZED",
      harness,
      result,
    );
  });

  const cases = [
    {
      id: "CASE-BLOCKED-OPERATION-READY",
      options: { externalSendDenied: true },
      terminal: "clean",
      source: "STATE-OPERATION-READY",
      process: 0,
      candidate: 0,
    },
    {
      id: "CASE-BLOCKED-EXECUTOR-CLEAN",
      options: { executorChangedPaths: [] },
      terminal: "clean",
      source: "STATE-EXECUTOR-CLEAN",
      process: 1,
      candidate: 1,
    },
    {
      id: "CASE-BLOCKED-CANDIDATE-CAPTURED",
      options: { processCleanFailureRole: "reviewer" as const },
      terminal: "clean",
      source: "STATE-CANDIDATE-CAPTURED",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-BLOCKED-REVIEWER-CLEAN",
      options: { candidateVerificationFails: true },
      terminal: "clean",
      source: "STATE-REVIEWER-CLEAN",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-BLOCKED-REMEDIATION-AUTHORIZED",
      options: {
        reviewerDecision: "changes_requested" as const,
        remediationPacketSecretBlocked: true,
      },
      terminal: "clean",
      source: "STATE-REMEDIATION-AUTHORIZED",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-BLOCKED-REMEDIATION-EXECUTOR-CLEAN",
      options: {
        reviewerDecision: "changes_requested" as const,
        candidateSecretAtCapture: 2 as const,
      },
      terminal: "clean",
      source: "STATE-REMEDIATION-EXECUTOR-CLEAN",
      process: 3,
      candidate: 2,
    },
    {
      id: "CASE-BLOCKED-REMEDIATION-CANDIDATE-CAPTURED",
      options: {
        reviewerDecision: "changes_requested" as const,
        processCleanFailureRole: "reviewer" as const,
        processCleanFailureOccurrence: 2,
      },
      terminal: "clean",
      source: "STATE-REMEDIATION-CANDIDATE-CAPTURED",
      process: 4,
      candidate: 2,
    },
    {
      id: "CASE-BLOCKED-REMEDIATION-REVIEWER-CLEAN",
      options: {
        reviewerDecision: "changes_requested" as const,
        finalReviewerDecision: "approved" as const,
        candidatePersistenceFails: true,
      },
      terminal: "clean",
      source: "STATE-REMEDIATION-REVIEWER-CLEAN",
      process: 4,
      candidate: 2,
    },
    {
      id: "CASE-BLOCKED-HOST-CLEAN",
      options: { cleanupProtocolFailure: true },
      terminal: "clean",
      source: "STATE-HOST-CLEAN",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-RECOVERY-OPERATION-READY",
      options: {
        externalSendReason:
          "external_send_confirmation_cleanup_unknown_process_restart_required",
      },
      terminal: "recovery",
      source: "STATE-OPERATION-READY",
      process: 0,
      candidate: 0,
    },
    {
      id: "CASE-RECOVERY-TASK-AUTHORIZED",
      options: { processStartFailureRole: "executor" as const },
      terminal: "recovery",
      source: "STATE-TASK-AUTHORIZED",
      process: 1,
      candidate: 0,
    },
    {
      id: "CASE-RECOVERY-EXECUTOR-CLEAN",
      options: { executorChangedPaths: [], cleanupThrows: true },
      terminal: "recovery",
      source: "STATE-EXECUTOR-CLEAN",
      process: 1,
      candidate: 1,
    },
    {
      id: "CASE-RECOVERY-CANDIDATE-CAPTURED",
      options: {
        processCleanupFailureRole: "reviewer" as const,
      },
      terminal: "recovery",
      source: "STATE-CANDIDATE-CAPTURED",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-RECOVERY-REVIEWER-CLEAN",
      options: { candidateVerificationFails: true, cleanupThrows: true },
      terminal: "recovery",
      source: "STATE-REVIEWER-CLEAN",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-RECOVERY-REMEDIATION-AUTHORIZED",
      options: {
        reviewerDecision: "changes_requested" as const,
        remediationPacketSecretBlocked: true,
        cleanupThrows: true,
      },
      terminal: "recovery",
      source: "STATE-REMEDIATION-AUTHORIZED",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-RECOVERY-REMEDIATION-EXECUTOR-CLEAN",
      options: {
        reviewerDecision: "changes_requested" as const,
        candidateSecretAtCapture: 2 as const,
        cleanupThrows: true,
      },
      terminal: "recovery",
      source: "STATE-REMEDIATION-EXECUTOR-CLEAN",
      process: 3,
      candidate: 2,
    },
    {
      id: "CASE-RECOVERY-REMEDIATION-CANDIDATE-CAPTURED",
      options: {
        reviewerDecision: "changes_requested" as const,
        processCleanupFailureRole: "reviewer" as const,
        processCleanupFailureOccurrence: 2,
      },
      terminal: "recovery",
      source: "STATE-REMEDIATION-CANDIDATE-CAPTURED",
      process: 4,
      candidate: 2,
    },
    {
      id: "CASE-RECOVERY-REMEDIATION-REVIEWER-CLEAN",
      options: {
        reviewerDecision: "changes_requested" as const,
        finalReviewerDecision: "approved" as const,
        candidatePersistenceNeedsStoreRecovery: true,
      },
      terminal: "recovery",
      source: "STATE-REMEDIATION-REVIEWER-CLEAN",
      process: 4,
      candidate: 2,
    },
    {
      id: "CASE-RECOVERY-CANDIDATE-STAGED",
      options: { hostCleanupWal: true, dockerIntentFailsAt: 1 },
      terminal: "recovery",
      source: "STATE-CANDIDATE-STAGED",
      process: 2,
      candidate: 1,
    },
    {
      id: "CASE-RECOVERY-HOST-CLEAN",
      options: { publishFails: true },
      terminal: "recovery",
      source: "STATE-HOST-CLEAN",
      process: 2,
      candidate: 1,
    },
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.id, async () => {
      const harness = fixture(scenario.options);
      const result = await harness.runtime.start(
        request(),
        "C:\\repository",
        "2026-08-25T00:00:00.000Z",
      ).completion;
      assert.equal(result.status, "blocked");
      assert.equal(harness.operationCreateCount(), 1);
      assert.equal(harness.processStartCount(), scenario.process);
      assert.equal(harness.candidateCaptureCount(), scenario.candidate);
      assert.equal(harness.lifecycleStates.at(-2), scenario.source);
      assert.equal(
        harness.lifecycleStates.at(-1),
        scenario.terminal === "clean"
          ? "STATE-BLOCKED-CLEAN"
          : "STATE-RECOVERY-REQUIRED",
      );
      const cleanupUnknown = new Set([
        "CASE-RECOVERY-TASK-AUTHORIZED",
        "CASE-RECOVERY-CANDIDATE-CAPTURED",
        "CASE-RECOVERY-REMEDIATION-CANDIDATE-CAPTURED",
        "CASE-RECOVERY-CANDIDATE-STAGED",
      ]).has(scenario.id);
      assert.equal(harness.cleanupCount(), cleanupUnknown ? 0 : 1);
      if (scenario.terminal === "clean") {
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(result.manualRecoveryRequired, false);
        assert.equal(result.hostRecoveryId, null);
        assert.deepEqual(result.dockerRecoveryIds, []);
        assert.equal(result.candidateRecoveryId, null);
        assert.equal(result.candidateStoreRecoveryId, null);
      } else {
        assert.equal(
          result.manualRecoveryRequired || result.processRestartRequired,
          true,
        );
      }
      assertTerminalRuntimeTraceCase(scenario.id, harness, result);
    });
  }
});

test("Docker Recoveryの公開理由分類をTask結果へ変更せず投影する", async () => {
  for (const reason of [
    "docker_process_controller_recovery_conflict",
    "docker_process_controller_recovery_partial_state",
    "docker_process_controller_recovery_identity_mismatch",
    "docker_process_controller_recovery_observation_unknown",
    "docker_process_controller_recovery_unavailable",
  ]) {
    const harness = fixture({
      admissionRecovery: true,
      admissionRecoveryReason: reason,
    });
    const result = await harness.runtime.start(
      request(),
      "C:\\repository",
      "2026-08-25T00:00:00.000Z",
    ).completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.dockerRecoveryId, "docker.fixture.admission.recovery");
    assert.equal(harness.operationCreateCount(), 0);
    assert.equal(harness.processStartCount(), 0);
  }
});
