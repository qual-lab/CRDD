import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import {
  isSupportedCoordinatorNodeRuntime,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";
import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../src/security/candidate-bundle-store.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  isCanonicalCrddGitObjectId,
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import {
  evaluateSignedRunnerSafetyObservation,
  salvageSignedRunnerNullableRecovery,
  salvageSignedRunnerRecoveryPair,
} from "../src/security/signed-runner-safety-observation.ts";

export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-general-task-verification";
export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION = 14;

const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const PRODUCTION_CANCEL_ACK_TIMEOUT_MS = 10_000;
const PRODUCTION_CANCEL_COMPLETION_TIMEOUT_MS = 240_000;
const PRODUCTION_ORPHANED_START_OBSERVATION_TIMEOUT_MS = 240_000;
const INTRINSIC_PROMISE_THEN = Promise.prototype.then;
const CANCELLATION_RECEIPT_KEYS = Object.freeze([
  "status",
  "reason",
  "cancellationRequested",
  "processTerminationObserved",
]);
const TASK_SAFETY_SCHEMA = Object.freeze({
  booleanFields: Object.freeze([
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "canonicalRepositoryChanged",
    "rawOutputReported",
    "hostPathReported",
    "untrustedProviderTextReported",
  ]),
  nullableRecoveryFields: Object.freeze([
    Object.freeze({ field: "hostRecoveryId", kind: "host" as const }),
    Object.freeze({
      field: "candidateRecoveryId",
      kind: "candidate" as const,
    }),
    Object.freeze({
      field: "candidateStoreRecoveryId",
      kind: "candidate_store" as const,
    }),
  ]),
  recoveryPairs: Object.freeze([
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
      kind: "docker" as const,
    }),
  ]),
});

type RuntimeRecord = Readonly<Record<string, unknown>>;
export type SignedGeneralTaskVerificationResult = RuntimeRecord &
  Readonly<{
    status: "completed" | "blocked";
    reason: string;
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    effectStateUnknown?: boolean;
    hostRecoveryId: string | null;
    hostRecoveryIds: readonly string[];
    dockerRecoveryId: string | null;
    dockerRecoveryIds: readonly string[];
    candidateRecoveryId: string | null;
    candidateRecoveryIds: readonly string[];
    candidateStoreRecoveryId: string | null;
    candidateStoreRecoveryIds: readonly string[];
    canonicalRepositoryChanged: boolean | null;
    rawProviderOutputReported: boolean;
    hostPathReported: boolean;
    credentialReported: boolean;
    exactCandidateContentVerified?: boolean;
    candidateDiscarded?: boolean;
    changedPaths?: readonly string[];
    crddCommit?: string;
    crddTree?: string;
    requestedRouteProfile?: SignedGeneralTaskRouteProfile;
    route?: string;
    requestedFrontProvider?: "codex" | "claude";
    observedFrontProvider?: null;
    frontIdentityVerified?: boolean;
    executorProvider?: "codex" | "claude" | null;
    reviewerProvider?: "codex" | "claude" | null;
    reviewerIndependence?: string;
  }>;
export type SignedGeneralTaskRouteProfile =
  | "forward"
  | "reverse"
  | "same-codex"
  | "same-claude";
type RouteExpectation = Readonly<{
  profile: SignedGeneralTaskRouteProfile;
  frontProvider: "codex" | "claude";
  executorProvider: "codex" | "claude";
  reviewerProvider: "codex" | "claude";
  route: string;
}>;
type ReleaseIdentity = RuntimeRecord &
  Readonly<{
    manifestHash: string;
    packageContentRootSha256: string;
    crddVersion: string;
    releaseSequence: number;
    crddCommit: string;
    crddTree: string;
  }>;
type CancellationBinding = Readonly<{
  unbind: () => void;
  requested: () => boolean;
  requestedPromise: Promise<void>;
}>;
type CancellationSignalSource = Readonly<{
  on: (signal: "SIGINT" | "SIGTERM", listener: () => void) => unknown;
  removeListener: (
    signal: "SIGINT" | "SIGTERM",
    listener: () => void,
  ) => unknown;
}>;
type VerificationDependencies = Readonly<{
  issuePackageCapability: (
    input: Readonly<{ evaluationTime: string }>,
  ) => Readonly<{ verification: unknown; capability: unknown }>;
  startTask: (
    request: RuntimeRecord,
    repositoryRoot: string,
    verifiedPackageCapability: unknown,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
  readCandidate: (candidateId: string) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
  now: () => string;
  runtimeVersion: () => string;
  bindCancellation: (
    controlCapability: object,
    cancel: (controlCapability: object) => unknown,
  ) => CancellationBinding;
  isolatedSettlementTiming?: Readonly<{
    cancelAckTimeoutMs: number;
    cancelCompletionTimeoutMs: number;
    orphanedStartObservationTimeoutMs: number;
  }>;
}>;

export function bindSignedGeneralTaskCancellation(
  signalSource: CancellationSignalSource,
  _controlCapability: object,
  _cancel: (controlCapability: object) => unknown,
): CancellationBinding {
  let isRequested = false;
  let resolveRequested: (() => void) | null = null;
  const requestedPromise = new Promise<void>((resolve) => {
    resolveRequested = resolve;
  });
  const requestCancellation = () => {
    if (isRequested) return;
    isRequested = true;
    resolveRequested?.();
    resolveRequested = null;
  };
  try {
    signalSource.on("SIGINT", requestCancellation);
    signalSource.on("SIGTERM", requestCancellation);
  } catch {
    let rollbackFailed = false;
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      try {
        signalSource.removeListener(signal, requestCancellation);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(
      rollbackFailed
        ? "signed_general_task_cancellation_binding_cleanup_unknown"
        : "signed_general_task_cancellation_binding_failed",
    );
  }
  let isBound = true;
  return Object.freeze({
    unbind: () => {
      if (!isBound) return;
      isBound = false;
      let unbindFailed = false;
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        try {
          signalSource.removeListener(signal, requestCancellation);
        } catch {
          unbindFailed = true;
        }
      }
      if (unbindFailed)
        throw new Error(
          "signed_general_task_cancellation_unbind_cleanup_unknown",
        );
    },
    requested: () => isRequested,
    requestedPromise,
  });
}

const productionDependencies: VerificationDependencies = Object.freeze({
  issuePackageCapability: issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  startTask: startRuntimeOwnedCoordinatorTask,
  cancelTask: cancelRuntimeOwnedCoordinatorTask,
  readCandidate: readRuntimeOwnedCandidateBundle,
  discardCandidate: discardRuntimeOwnedCandidateBundle,
  now: () => new Date().toISOString(),
  runtimeVersion: () => process.versions.node,
  bindCancellation: (controlCapability, cancel) =>
    bindSignedGeneralTaskCancellation(process, controlCapability, cancel),
});

function settlementTiming(dependencies: VerificationDependencies) {
  const production = Object.freeze({
    cancelAckTimeoutMs: PRODUCTION_CANCEL_ACK_TIMEOUT_MS,
    cancelCompletionTimeoutMs: PRODUCTION_CANCEL_COMPLETION_TIMEOUT_MS,
    orphanedStartObservationTimeoutMs:
      PRODUCTION_ORPHANED_START_OBSERVATION_TIMEOUT_MS,
  });
  if (dependencies === productionDependencies) return production;
  const isolated = dependencies.isolatedSettlementTiming;
  return isolated &&
    Number.isSafeInteger(isolated.cancelAckTimeoutMs) &&
    isolated.cancelAckTimeoutMs > 0 &&
    Number.isSafeInteger(isolated.cancelCompletionTimeoutMs) &&
    isolated.cancelCompletionTimeoutMs > 0 &&
    Number.isSafeInteger(isolated.orphanedStartObservationTimeoutMs) &&
    isolated.orphanedStartObservationTimeoutMs > 0
    ? Object.freeze({ ...isolated })
    : production;
}

function plainRecord(value: unknown): RuntimeRecord | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    ) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotStartedTask(value: unknown) {
  let controlCapability: object | null = null;
  let completionObservation: ReturnType<typeof observeNativeCompletion> | null =
    null;
  let completionObserverUnknown = false;
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return Object.freeze({
        controlCapability,
        completionObservation,
        completionObserverUnknown,
      });
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      return Object.freeze({
        controlCapability,
        completionObservation,
        completionObserverUnknown,
      });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const control = descriptors.controlCapability;
    if (
      control &&
      Object.hasOwn(control, "value") &&
      control.get === undefined &&
      control.set === undefined &&
      control.enumerable === true &&
      control.value &&
      typeof control.value === "object" &&
      !utilTypes.isProxy(control.value)
    )
      controlCapability = control.value;
    const observedCompletion = descriptors.completion;
    if (
      observedCompletion &&
      Object.hasOwn(observedCompletion, "value") &&
      observedCompletion.get === undefined &&
      observedCompletion.set === undefined &&
      observedCompletion.enumerable === true &&
      observedCompletion.value &&
      typeof observedCompletion.value === "object" &&
      !utilTypes.isProxy(observedCompletion.value) &&
      utilTypes.isPromise(observedCompletion.value) &&
      Object.getPrototypeOf(observedCompletion.value) === Promise.prototype &&
      Object.getOwnPropertyDescriptor(observedCompletion.value, "then") ===
        undefined
    ) {
      try {
        completionObservation = observeNativeCompletion(
          observedCompletion.value as Promise<RuntimeRecord>,
        );
      } catch {
        completionObserverUnknown = true;
      }
    }
  } catch {
    // Partially observed control remains available only for bounded cancel.
    completionObserverUnknown = true;
  }
  return Object.freeze({
    controlCapability,
    completionObservation,
    completionObserverUnknown,
  });
}

function observeNativeCompletion(completion: Promise<RuntimeRecord>) {
  return INTRINSIC_PROMISE_THEN.call(
    completion,
    (value) => Object.freeze({ status: "fulfilled" as const, value }),
    () => Object.freeze({ status: "rejected" as const, value: null }),
  ) as Promise<
    Readonly<
      | { status: "fulfilled"; value: RuntimeRecord }
      | { status: "rejected"; value: null }
    >
  >;
}

function exactCancellationReceipt(value: unknown) {
  const receipt = plainRecord(value);
  if (
    !receipt ||
    Reflect.ownKeys(receipt).length !== CANCELLATION_RECEIPT_KEYS.length ||
    CANCELLATION_RECEIPT_KEYS.some((key) => !Object.hasOwn(receipt, key)) ||
    receipt.status !== "requested" ||
    receipt.cancellationRequested !== true ||
    typeof receipt.processTerminationObserved !== "boolean" ||
    (receipt.processTerminationObserved === true &&
      receipt.reason !== "provider_cancellation_requested") ||
    (receipt.processTerminationObserved === false &&
      receipt.reason !== "provider_cancellation_grace_exceeded")
  )
    return null;
  return Object.freeze({
    processTerminationObserved: receipt.processTerminationObserved,
  });
}

function exactStringArray(value: unknown, expectedValues: readonly string[]) {
  const snapshot = snapshotPlainArray<unknown>(value, expectedValues.length);
  return (
    snapshot.status === "ok" &&
    snapshot.value.length === expectedValues.length &&
    expectedValues.every((item, index) => snapshot.value[index] === item)
  );
}

function safeReason(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-z0-9_]+$/u.test(value)
    ? value
    : fallback;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function boundedRecoveryIds(
  results: readonly (RuntimeRecord | null)[],
  singularField: string,
  kind: "host" | "docker" | "candidate" | "candidate_store",
  pluralField?: string,
) {
  const ids: string[] = [];
  let ambiguous = false;
  for (const result of results) {
    if (!result) continue;
    const hasSingular = Object.getOwnPropertyDescriptor(result, singularField);
    const hasPlural = pluralField
      ? Object.getOwnPropertyDescriptor(result, pluralField)
      : null;
    if (!hasSingular && !hasPlural) continue;
    if (pluralField) {
      const recovered = salvageSignedRunnerRecoveryPair(result, {
        singularField,
        pluralField,
        kind,
      });
      ids.push(...recovered.plural);
      if (recovered.ambiguous) ambiguous = true;
    } else {
      const recovered = salvageSignedRunnerNullableRecovery(
        result,
        singularField,
        kind,
      );
      if (recovered.id) ids.push(recovered.id);
      if (recovered.ambiguous) ambiguous = true;
    }
  }
  const unique = [...new Set(ids)];
  if (unique.length > 128) ambiguous = true;
  return Object.freeze({
    ids: Object.freeze(unique.slice(0, 128)),
    ambiguous,
  });
}

function recoveryProjection(...results: readonly (RuntimeRecord | null)[]) {
  const sources = results.filter((result) => result !== null);
  if (
    sources.some((result) => result?.processRestartRequired === true) &&
    !isRuntimeProcessPoisoned()
  )
    ensureRuntimeProcessPoisoned();
  const hostRecovery = boundedRecoveryIds(sources, "hostRecoveryId", "host");
  const dockerRecovery = boundedRecoveryIds(
    sources,
    "dockerRecoveryId",
    "docker",
    "dockerRecoveryIds",
  );
  const candidateRecovery = boundedRecoveryIds(
    sources,
    "candidateRecoveryId",
    "candidate",
    "candidateRecoveryIds",
  );
  const candidateStoreRecovery = boundedRecoveryIds(
    sources,
    "candidateStoreRecoveryId",
    "candidate_store",
    "candidateStoreRecoveryIds",
  );
  const hostRecoveryIds = hostRecovery.ids;
  const dockerRecoveryIds = dockerRecovery.ids;
  const candidateRecoveryIds = candidateRecovery.ids;
  const candidateStoreRecoveryIds = candidateStoreRecovery.ids;
  return Object.freeze({
    cleanupConfirmed:
      sources.length > 0 &&
      sources.every((result) => result?.cleanupConfirmed === true),
    manualRecoveryRequired: sources.some(
      (result) => result?.manualRecoveryRequired === true,
    ),
    processRestartRequired:
      isRuntimeProcessPoisoned() ||
      sources.some((result) => result?.processRestartRequired === true),
    hostRecoveryId:
      hostRecoveryIds.length === 1 ? (hostRecoveryIds[0] ?? null) : null,
    hostRecoveryIds,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
    dockerRecoveryIds,
    candidateRecoveryId:
      candidateRecoveryIds.length === 1
        ? (candidateRecoveryIds[0] ?? null)
        : null,
    candidateRecoveryIds,
    candidateStoreRecoveryId:
      candidateStoreRecoveryIds.length === 1
        ? (candidateStoreRecoveryIds[0] ?? null)
        : null,
    candidateStoreRecoveryIds,
    recoveryIdentityAmbiguous:
      hostRecovery.ambiguous ||
      dockerRecovery.ambiguous ||
      candidateRecovery.ambiguous ||
      candidateStoreRecovery.ambiguous ||
      hostRecoveryIds.length > 1 ||
      candidateRecoveryIds.length > 1 ||
      candidateStoreRecoveryIds.length > 1,
  });
}

function blocked(
  reason: string,
  source: RuntimeRecord | null = null,
  extra: RuntimeRecord = Object.freeze({}),
  additionalRecoverySources: readonly (RuntimeRecord | null)[] = Object.freeze(
    [],
  ),
) {
  const wasCanonicalRepositoryChanged =
    source?.canonicalRepositoryChanged === true
      ? true
      : source?.canonicalRepositoryChanged === false
        ? false
        : typeof extra.canonicalRepositoryChanged === "boolean"
          ? extra.canonicalRepositoryChanged
          : null;
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    ...recoveryProjection(source, ...additionalRecoverySources),
    ...extra,
    canonicalRepositoryChanged: wasCanonicalRepositoryChanged,
    effectStateUnknown:
      typeof extra.effectStateUnknown === "boolean"
        ? extra.effectStateUnknown
        : wasCanonicalRepositoryChanged === null,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

function ensureRuntimeProcessPoisoned() {
  poisonRuntimeProcessAfterCleanupUnknown();
  if (!isRuntimeProcessPoisoned())
    throw new Error("runtime_process_poison_transition_failed");
}

async function boundedSettlement<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise.then(
        (value) => Object.freeze({ status: "fulfilled" as const, value }),
        () => Object.freeze({ status: "rejected" as const, value: null }),
      ),
      new Promise<Readonly<{ status: "timeout"; value: null }>>((resolve) => {
        timeout = setTimeout(
          () => resolve(Object.freeze({ status: "timeout", value: null })),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function postStartUnknownBlocked(
  reason: string,
  taskResult: RuntimeRecord | null,
  discarded: RuntimeRecord | null,
  candidateDiscarded: boolean,
) {
  ensureRuntimeProcessPoisoned();
  const projected = blocked(
    reason,
    taskResult,
    Object.freeze({ candidateDiscarded }),
    Object.freeze([discarded]),
  );
  return Object.freeze({
    ...projected,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    effectStateUnknown: true,
    recoveryIdentityAmbiguous: true,
  });
}

const ROUTE_EXPECTATIONS: Readonly<
  Record<SignedGeneralTaskRouteProfile, RouteExpectation>
> = Object.freeze({
  forward: Object.freeze({
    profile: "forward",
    frontProvider: "codex",
    executorProvider: "claude",
    reviewerProvider: "codex",
    route: "front_codex__executor_claude__reviewer_codex",
  }),
  reverse: Object.freeze({
    profile: "reverse",
    frontProvider: "claude",
    executorProvider: "codex",
    reviewerProvider: "claude",
    route: "front_claude__executor_codex__reviewer_claude",
  }),
  "same-codex": Object.freeze({
    profile: "same-codex",
    frontProvider: "codex",
    executorProvider: "codex",
    reviewerProvider: "claude",
    route: "front_codex__executor_codex__reviewer_claude",
  }),
  "same-claude": Object.freeze({
    profile: "same-claude",
    frontProvider: "claude",
    executorProvider: "claude",
    reviewerProvider: "codex",
    route: "front_claude__executor_claude__reviewer_codex",
  }),
});

export function createSignedGeneralTaskVerificationRequest(
  routeProfile: SignedGeneralTaskRouteProfile = "forward",
) {
  const route = ROUTE_EXPECTATIONS[routeProfile];
  return Object.freeze({
    frontProvider: route.frontProvider,
    objective: "Create the one bounded verification marker file.",
    acceptanceCriteria: Object.freeze([
      `The visible candidate marker is located at ${TARGET_PATH}; the runtime and signed runner separately verify that no other path changed.`,
      `The visible file content is the single marker ${JSON.stringify(EXPECTED_CONTENT.trimEnd())}; the signed runner separately verifies exact UTF-8 bytes and one trailing LF.`,
    ]),
    allowedPaths: Object.freeze([TARGET_PATH]),
    readPaths: Object.freeze(["tools/coordinator/README.md", TARGET_PATH]),
    workClass:
      routeProfile === "same-codex" || routeProfile === "same-claude"
        ? "bounded_verification"
        : "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

function verifiedPackage(
  release: RuntimeRecord | null,
): release is ReleaseIdentity {
  return (
    release?.status === "candidate" &&
    release.stableFilesystemIdentityObserved === true &&
    release.runtimeOwnedPackageRoot === true &&
    sha256(release.manifestHash) &&
    sha256(release.packageContentRootSha256) &&
    isCanonicalCrddVersion(release.crddVersion) &&
    Number.isSafeInteger(release.releaseSequence) &&
    Number(release.releaseSequence) >= 1 &&
    isCanonicalCrddGitObjectId(release.crddCommit) &&
    isCanonicalCrddGitObjectId(release.crddTree) &&
    release.qualLabManifestCryptographicMatch === true &&
    release.runtimeOwnedReleaseTrustConfirmed === true &&
    release.releaseIdentityRuntimeOwned === true &&
    release.crddDistributionConfirmed === true
  );
}

function taskResultContractMismatch(
  result: RuntimeRecord | null,
  release: ReleaseIdentity,
  route: RouteExpectation,
) {
  const candidateRevision = plainRecord(result?.candidateRevision);
  const reviewerResult = plainRecord(result?.reviewerResult);
  if (result?.status !== "completed") return "status";
  if (result.reason !== "coordinator_task_candidate_approved") return "reason";
  if (result.cleanupConfirmed !== true) return "cleanup_confirmed";
  if (result.manualRecoveryRequired !== false)
    return "manual_recovery_required";
  if (result.processRestartRequired !== false)
    return "process_restart_required";
  if (result.executorProvider !== route.executorProvider)
    return "executor_provider";
  if (result.reviewerProvider !== route.reviewerProvider)
    return "reviewer_provider";
  if (result.reviewerIndependence !== "provider_independent")
    return "reviewer_independence";
  if (
    result.externalSendAuthorizationMode !== "interactive_initial_consent" &&
    result.externalSendAuthorizationMode !== "reused_initial_consent"
  )
    return "external_send_authorization_mode";
  if (typeof result.remediationPerformed !== "boolean")
    return "remediation_performed";
  if (!candidateRevision) return "candidate_revision";
  if (candidateRevision.baseCommit !== release.crddCommit)
    return "candidate_base_commit";
  if (candidateRevision.baseTree !== release.crddTree)
    return "candidate_base_tree";
  if (!sha256(candidateRevision.patchHash)) return "candidate_patch_hash";
  if (!sha256(candidateRevision.contentManifestHash))
    return "candidate_content_manifest_hash";
  if (!sha256(candidateRevision.allowedPathsHash))
    return "candidate_allowed_paths_hash";
  if (reviewerResult?.decision !== "approved") return "reviewer_decision";
  if (reviewerResult.findingCount !== 0) return "reviewer_finding_count";
  if (result.canonicalRepositoryChanged !== false)
    return "canonical_repository_changed";
  if (result.rawOutputReported !== false) return "raw_output_reported";
  if (result.hostPathReported !== false) return "host_path_reported";
  if (result.untrustedProviderTextReported !== false)
    return "untrusted_provider_text_reported";
  if (result.hostRecoveryId !== null) return "host_recovery_id";
  if (result.dockerRecoveryId !== null) return "docker_recovery_id";
  if (!exactStringArray(result.dockerRecoveryIds, []))
    return "docker_recovery_ids";
  if (result.candidateRecoveryId !== null) return "candidate_recovery_id";
  if (result.candidateStoreRecoveryId !== null)
    return "candidate_store_recovery_id";
  if (typeof result.candidateId !== "string") return "candidate_id";
  return null;
}

function verifiedCandidate(
  candidate: RuntimeRecord | null,
  candidateId: string,
  taskResult: RuntimeRecord | null,
) {
  const bundle = plainRecord(candidate?.bundle);
  const candidateRevision = plainRecord(taskResult?.candidateRevision);
  const entries = snapshotPlainArray<unknown>(bundle?.entries, 1);
  const entry =
    entries.status === "ok" && entries.value.length === 1
      ? plainRecord(entries.value[0])
      : null;
  const contentBase64 = entry?.contentBase64;
  if (
    candidate?.status !== "exported" ||
    candidate.candidateId !== candidateId ||
    bundle?.schema !== "crdd-coordinator-candidate-bundle/v1" ||
    !isCanonicalCrddGitObjectId(bundle.baseCommit) ||
    !isCanonicalCrddGitObjectId(bundle.baseTree) ||
    !sha256(bundle.baseManifestHash) ||
    !sha256(bundle.patchHash) ||
    !sha256(bundle.contentManifestHash) ||
    !sha256(bundle.allowedPathsHash) ||
    bundle.baseCommit !== candidateRevision?.baseCommit ||
    bundle.baseTree !== candidateRevision.baseTree ||
    bundle.patchHash !== candidateRevision.patchHash ||
    bundle.contentManifestHash !== candidateRevision.contentManifestHash ||
    bundle.allowedPathsHash !== candidateRevision.allowedPathsHash ||
    !exactStringArray(bundle.changedPaths, [TARGET_PATH]) ||
    !entry ||
    entry.relativePath !== TARGET_PATH ||
    entry.operation !== "upsert" ||
    typeof contentBase64 !== "string" ||
    typeof entry.byteLength !== "number" ||
    typeof entry.sha256 !== "string"
  ) {
    return false;
  }
  const expectedPatchHash = createHash("sha256")
    .update("crdd-candidate-revision-v1\0")
    .update(bundle.baseCommit)
    .update("\0")
    .update(bundle.baseTree)
    .update("\0")
    .update(bundle.baseManifestHash)
    .update("\0")
    .update(bundle.contentManifestHash)
    .update("\0")
    .update(bundle.allowedPathsHash)
    .update("\0")
    .update(TARGET_PATH)
    .digest("hex");
  const content = Buffer.from(contentBase64, "base64");
  return (
    bundle.patchHash === expectedPatchHash &&
    content.toString("base64") === contentBase64 &&
    content.equals(Buffer.from(EXPECTED_CONTENT, "utf8")) &&
    entry.byteLength === content.byteLength &&
    entry.sha256 === createHash("sha256").update(content).digest("hex")
  );
}

export async function runSignedGeneralTaskVerification(
  repositoryRoot: string,
  dependencies: VerificationDependencies = productionDependencies,
  routeProfile: SignedGeneralTaskRouteProfile = "forward",
): Promise<SignedGeneralTaskVerificationResult> {
  if (
    routeProfile !== "forward" &&
    routeProfile !== "reverse" &&
    routeProfile !== "same-codex" &&
    routeProfile !== "same-claude"
  ) {
    return blocked(
      "signed_general_task_verification_arguments_invalid",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  const route = ROUTE_EXPECTATIONS[routeProfile];
  if (!path.isAbsolute(repositoryRoot)) {
    return blocked(
      "signed_general_task_repository_root_invalid",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let isSupportedRuntime = false;
  try {
    isSupportedRuntime = isSupportedCoordinatorNodeRuntime(
      dependencies.runtimeVersion(),
    );
  } catch {
    // The explicit prerequisites remain unconfirmed.
  }
  if (!isSupportedRuntime) {
    return blocked(
      "signed_general_task_node_version_unsupported",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let release: RuntimeRecord | null = null;
  let verifiedPackageCapability: unknown = null;
  try {
    const issued = dependencies.issuePackageCapability({
      evaluationTime: dependencies.now(),
    });
    release = plainRecord(issued.verification);
    verifiedPackageCapability = issued.capability;
  } catch {
    // The package verifier result remains unavailable and cannot open the gate.
  }
  if (isRuntimeProcessPoisoned()) {
    return blocked(
      "signed_general_task_process_restart_required",
      release,
      Object.freeze({
        canonicalRepositoryChanged: false,
        manualRecoveryRequired: true,
        processRestartRequired: isRuntimeProcessPoisoned(),
      }),
    );
  }
  if (
    !verifiedPackage(release) ||
    !verifiedPackageCapability ||
    typeof verifiedPackageCapability !== "object"
  ) {
    return blocked(
      "signed_general_task_release_verification_failed",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  if (
    !isSupportedCrddRuntimeGitObjectId(release.crddCommit) ||
    !isSupportedCrddRuntimeGitObjectId(release.crddTree)
  ) {
    return blocked(
      "signed_general_task_git_object_format_unsupported",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let rawStarted: unknown;
  try {
    rawStarted = dependencies.startTask(
      createSignedGeneralTaskVerificationRequest(routeProfile),
      repositoryRoot,
      verifiedPackageCapability,
    );
  } catch {
    ensureRuntimeProcessPoisoned();
    return blocked(
      "signed_general_task_start_failed_closed",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  const started = snapshotStartedTask(rawStarted);
  const controlCapability = started.controlCapability;
  const completionObservation = started.completionObservation;
  const completionObserverUnknown = started.completionObserverUnknown;
  const timing = settlementTiming(dependencies);
  let cancelAttempted = false;
  let cancelCompletion: Promise<unknown> | null = null;
  const requestCancellation = () => {
    if (cancelAttempted) return cancelCompletion;
    cancelAttempted = true;
    if (!controlCapability) return null;
    try {
      cancelCompletion = Promise.resolve(
        dependencies.cancelTask(controlCapability),
      ).then(
        (value) => value,
        () => null,
      );
    } catch {
      cancelCompletion = Promise.resolve(null);
    }
    return cancelCompletion;
  };
  let cancellationBinding: CancellationBinding | null = null;
  let taskResult: RuntimeRecord | null = null;
  let discarded: RuntimeRecord | null = null;
  let candidateDiscarded = false;
  let cancellationRequested = false;
  let postStartUnknown = false;
  let postStartUnknownReason =
    "signed_general_task_post_start_observation_unknown";
  let knownOutcome: SignedGeneralTaskVerificationResult | null = null;
  let cancellationReceipt: Readonly<{
    processTerminationObserved: boolean;
  }> | null = null;
  const SIGNAL_CANCELLATION = Symbol("signedGeneralTaskSignalCancellation");
  try {
    if (!controlCapability || !completionObservation) {
      postStartUnknown = true;
      postStartUnknownReason = !controlCapability
        ? "signed_general_task_started_task_observation_unknown"
        : completionObserverUnknown
          ? "signed_general_task_completion_observer_unknown"
          : "signed_general_task_started_task_completion_unknown";
      if (controlCapability) requestCancellation();
    } else {
      cancellationBinding = dependencies.bindCancellation(
        controlCapability,
        () => undefined,
      );
      const first = await Promise.race([
        completionObservation.then((outcome) =>
          Object.freeze({ kind: "completion" as const, outcome }),
        ),
        cancellationBinding.requestedPromise.then(() =>
          Object.freeze({ kind: "cancellation" as const, outcome: null }),
        ),
      ]);
      if (first.kind === "cancellation") {
        cancellationRequested = true;
        requestCancellation();
        throw SIGNAL_CANCELLATION;
      }
      if (first.outcome.status !== "fulfilled") {
        postStartUnknownReason = "signed_general_task_completion_rejected";
        throw new Error(postStartUnknownReason);
      }
      taskResult = plainRecord(first.outcome.value);

      if (!taskResult) {
        postStartUnknownReason = "signed_general_task_result_contract_mismatch";
        throw new Error(postStartUnknownReason);
      }

      const safety = evaluateSignedRunnerSafetyObservation(
        taskResult,
        TASK_SAFETY_SCHEMA,
      );
      if (safety.status !== "exact") {
        postStartUnknownReason =
          "signed_general_task_safety_observation_unknown";
        throw new Error(postStartUnknownReason);
      }
      if (
        taskResult.processRestartRequired === true &&
        !isRuntimeProcessPoisoned()
      )
        ensureRuntimeProcessPoisoned();

      const candidateId = taskResult.candidateId;
      let isCandidateVerified = false;
      if (typeof candidateId === "string") {
        try {
          const candidate = plainRecord(
            dependencies.readCandidate(candidateId),
          );
          isCandidateVerified = verifiedCandidate(
            candidate,
            candidateId,
            taskResult,
          );
        } catch {
          isCandidateVerified = false;
        }
        try {
          discarded = plainRecord(dependencies.discardCandidate(candidateId));
        } catch {
          discarded = null;
        }
        candidateDiscarded = discarded?.status === "discarded";
        if (discarded?.status !== "discarded") {
          knownOutcome = blocked(
            "signed_general_task_candidate_discard_failed",
            taskResult,
            Object.freeze({
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              candidateIdForManualDiscard: candidateId,
              canonicalRepositoryChanged:
                taskResult.canonicalRepositoryChanged === true
                  ? true
                  : taskResult.canonicalRepositoryChanged === false
                    ? false
                    : null,
            }),
            Object.freeze([discarded]),
          );
        }
      }

      if (knownOutcome) {
        // Candidate cleanup result is already the authoritative outcome.
      } else if (
        taskResultContractMismatch(taskResult, release, route) !== null
      ) {
        const resultContractMismatch = taskResultContractMismatch(
          taskResult,
          release,
          route,
        );
        knownOutcome = blocked(
          taskResult?.status === "blocked"
            ? safeReason(
                taskResult.reason,
                "signed_general_task_result_contract_mismatch",
              )
            : "signed_general_task_result_contract_mismatch",
          taskResult,
          Object.freeze({
            candidateDiscarded: discarded?.status === "discarded",
            resultContractMismatch,
          }),
        );
      } else if (typeof candidateId !== "string") {
        knownOutcome = blocked(
          "signed_general_task_candidate_id_missing",
          taskResult,
        );
      } else if (!isCandidateVerified) {
        knownOutcome = blocked(
          "signed_general_task_candidate_content_mismatch",
          taskResult,
          Object.freeze({ candidateDiscarded: true }),
        );
      } else {
        knownOutcome = Object.freeze({
          contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
          contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
          status: "completed" as const,
          reason: "signed_general_task_verification_completed",
          manifestHash: release.manifestHash,
          packageContentRootSha256: release.packageContentRootSha256,
          crddVersion: release.crddVersion,
          releaseSequence: release.releaseSequence,
          crddCommit: release.crddCommit,
          crddTree: release.crddTree,
          requestedRouteProfile: routeProfile,
          route: route.route,
          requestedFrontProvider: route.frontProvider,
          observedFrontProvider: null,
          frontIdentityVerified: false,
          executorProvider: route.executorProvider,
          reviewerProvider: route.reviewerProvider,
          reviewerIndependence: "provider_independent" as const,
          externalSendAuthorizationMode:
            taskResult.externalSendAuthorizationMode ===
            "interactive_initial_consent"
              ? ("interactive_initial_consent" as const)
              : ("reused_initial_consent" as const),
          remediationPerformed: taskResult.remediationPerformed as boolean,
          changedPaths: Object.freeze([TARGET_PATH]),
          exactCandidateContentVerified: true,
          candidateDiscarded: true,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          effectStateUnknown: false,
          hostRecoveryId: null,
          hostRecoveryIds: Object.freeze([]),
          dockerRecoveryId: null,
          dockerRecoveryIds: Object.freeze([]),
          candidateRecoveryId: null,
          candidateRecoveryIds: Object.freeze([]),
          candidateStoreRecoveryId: null,
          candidateStoreRecoveryIds: Object.freeze([]),
          recoveryIdentityAmbiguous: false,
          canonicalRepositoryChanged: false,
          rawProviderOutputReported: false,
          hostPathReported: false,
          credentialReported: false,
        });
      }
    }
  } catch (error) {
    if (error !== SIGNAL_CANCELLATION) {
      postStartUnknown = true;
      requestCancellation();
    }
  } finally {
    if (cancellationBinding) {
      try {
        cancellationBinding.unbind();
      } catch {
        postStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_unbind_unknown";
      }
      try {
        cancellationRequested = cancellationBinding.requested();
      } catch {
        postStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_observation_unknown";
      }
    }
    if (cancellationRequested) requestCancellation();
    if (postStartUnknown) requestCancellation();
    if (cancelCompletion) {
      const cancelSettlement = await boundedSettlement(
        cancelCompletion,
        timing.cancelAckTimeoutMs,
      );
      cancellationReceipt =
        cancelSettlement.status === "fulfilled"
          ? exactCancellationReceipt(cancelSettlement.value)
          : null;
      if (!cancellationReceipt) {
        postStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_completion_unknown";
      }
    }
    if (
      completionObservation &&
      (postStartUnknown || cancellationRequested) &&
      taskResult === null
    ) {
      const completionSettlement = await boundedSettlement(
        completionObservation,
        controlCapability
          ? timing.cancelCompletionTimeoutMs
          : timing.orphanedStartObservationTimeoutMs,
      );
      if (
        completionSettlement.status === "fulfilled" &&
        completionSettlement.value.status === "fulfilled"
      )
        taskResult = plainRecord(completionSettlement.value.value);
      else {
        postStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_completion_settlement_unknown";
      }
    }
    if (taskResult && (postStartUnknown || cancellationRequested)) {
      const safety = evaluateSignedRunnerSafetyObservation(
        taskResult,
        TASK_SAFETY_SCHEMA,
      );
      if (safety.status !== "exact") {
        postStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_safety_observation_unknown";
      } else if (
        taskResult.processRestartRequired === true &&
        !isRuntimeProcessPoisoned()
      ) {
        ensureRuntimeProcessPoisoned();
      }
      if (
        cancellationReceipt?.processTerminationObserved === false &&
        taskResult.cleanupConfirmed !== true
      ) {
        postStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_cleanup_unknown";
      }
    }
    if ((postStartUnknown || cancellationRequested) && taskResult) {
      const candidateId = taskResult.candidateId;
      if (typeof candidateId === "string" && !candidateDiscarded) {
        try {
          discarded = plainRecord(dependencies.discardCandidate(candidateId));
          candidateDiscarded = discarded?.status === "discarded";
        } catch {
          discarded = null;
        }
      }
    }
  }
  if (postStartUnknown)
    return postStartUnknownBlocked(
      postStartUnknownReason,
      taskResult,
      discarded,
      candidateDiscarded,
    );
  if (cancellationRequested)
    return blocked(
      "signed_general_task_cancelled",
      taskResult,
      Object.freeze({ candidateDiscarded }),
      Object.freeze([discarded]),
    );
  if (isRuntimeProcessPoisoned())
    return blocked(
      "signed_general_task_process_restart_required",
      taskResult,
      Object.freeze({ candidateDiscarded }),
      Object.freeze([discarded]),
    );
  if (!knownOutcome)
    return postStartUnknownBlocked(
      "signed_general_task_final_outcome_unknown",
      taskResult,
      discarded,
      candidateDiscarded,
    );
  return knownOutcome;
}

export function describeSignedGeneralTaskVerificationContract() {
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    invocation: "direct_repository_owned_node_entrypoint",
    minimumNodeVersion: MINIMUM_COORDINATOR_NODE_VERSION,
    nodeSelection: "absolute_preverified_executable_only",
    availabilityOnlyConsolePreflightAllowed: false,
    interactiveConsoleGate:
      "runtime_owned_initial_consent_confirmation_only_reused_consent_requires_no_console",
    packageCapabilityUse:
      "runtime_local_nonserializable_nonexported_passed_once_to_task_runtime_after_release_verification",
    requestConstruction: "fixed_public_request_constructed_in_process",
    requestShellTransportAllowed: false,
    powershellTextPipelineAllowed: false,
    temporaryRequestFileAllowed: false,
    longShellCommandReconstructionAllowed: false,
    normalTaskStdinContractChanged: false,
    interactiveBoundary:
      "runtime_owned_console_challenge_for_external_send_only",
    providerRoutes: Object.freeze([
      ROUTE_EXPECTATIONS.forward.route,
      ROUTE_EXPECTATIONS.reverse.route,
      ROUTE_EXPECTATIONS["same-codex"].route,
      ROUTE_EXPECTATIONS["same-claude"].route,
    ]),
    defaultRouteProfile: "forward",
    routeArgumentGrammar:
      "no_arguments_or_exact_--route_reverse_or_--route_same-codex_or_--route_same-claude",
    frontIdentityBinding:
      "not_claimed_by_runner_result_requires_separate_fixed_run_evidence",
    candidateDisposition: "exact_content_verify_then_discard",
    boundedRemediation:
      "zero_or_one_runtime_owned_remediation_then_same_independent_reviewer_approval_required",
    resultMismatchDiagnostic:
      "fixed_contract_field_identifier_only_no_provider_text_path_or_credential",
    processRestartProjection:
      "task_started_completion_or_restart_observation_unknown_irreversibly_poisons_shared_process_before_return_and_exact_false_plus_unpoisoned_state_required_for_success",
    cancellationSettlement: Object.freeze({
      acknowledgmentTimeoutMs: PRODUCTION_CANCEL_ACK_TIMEOUT_MS,
      completionTimeoutMs: PRODUCTION_CANCEL_COMPLETION_TIMEOUT_MS,
      orphanedStartObservationTimeoutMs:
        PRODUCTION_ORPHANED_START_OBSERVATION_TIMEOUT_MS,
      ordering: "acknowledgment_then_completion",
      productionOverrideAllowed: false,
    }),
    canonicalRepositoryEffectAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (
    !(
      args.length === 0 ||
      (args.length === 2 &&
        args[0] === "--route" &&
        (args[1] === "reverse" ||
          args[1] === "same-codex" ||
          args[1] === "same-claude"))
    )
  ) {
    throw new Error("signed_general_task_verification_arguments_invalid");
  }
  const routeProfile: SignedGeneralTaskRouteProfile =
    args.length === 0 ? "forward" : (args[1] as SignedGeneralTaskRouteProfile);
  const result = await runSignedGeneralTaskVerification(
    process.cwd(),
    productionDependencies,
    routeProfile,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error: unknown) {
    const reason = safeReason(
      error instanceof Error ? error.message : null,
      "signed_general_task_verification_failed_closed",
    );
    process.stdout.write(
      `${JSON.stringify(
        blocked(
          reason,
          null,
          Object.freeze({ canonicalRepositoryChanged: false }),
        ),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
  }
}
