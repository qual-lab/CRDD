import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import {
  interactiveConsoleAvailabilityOutcome,
  type InteractiveConsoleAvailabilityOutcome,
} from "../src/core/interactive-console.ts";
import {
  isSupportedCoordinatorNodeRuntime,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";
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

export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-general-task-verification";
export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION = 4;

const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";

type RuntimeRecord = Readonly<Record<string, unknown>>;
export type SignedGeneralTaskRouteProfile =
  | "forward"
  | "reverse"
  | "same-codex";
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
type StartedTask = Readonly<{
  controlCapability: object;
  completion: Promise<RuntimeRecord>;
}>;
type CancellationBinding = Readonly<{
  unbind: () => void;
  requested: () => boolean;
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
  ) => StartedTask;
  cancelTask: (controlCapability: object) => unknown;
  readCandidate: (candidateId: string) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
  now: () => string;
  runtimeVersion: () => string;
  inspectInteractiveConsole: () =>
    | boolean
    | InteractiveConsoleAvailabilityOutcome;
  bindCancellation: (
    controlCapability: object,
    cancel: (controlCapability: object) => unknown,
  ) => CancellationBinding;
}>;

export function bindSignedGeneralTaskCancellation(
  signalSource: CancellationSignalSource,
  controlCapability: object,
  cancel: (controlCapability: object) => unknown,
): CancellationBinding {
  let isRequested = false;
  let hasCancellationStarted = false;
  const requestCancellation = () => {
    isRequested = true;
    if (hasCancellationStarted) return;
    hasCancellationStarted = true;
    try {
      void cancel(controlCapability);
    } catch {
      // The final task and cleanup result remains the recovery authority.
    }
  };
  signalSource.on("SIGINT", requestCancellation);
  signalSource.on("SIGTERM", requestCancellation);
  let isBound = true;
  return Object.freeze({
    unbind: () => {
      if (!isBound) return;
      isBound = false;
      signalSource.removeListener("SIGINT", requestCancellation);
      signalSource.removeListener("SIGTERM", requestCancellation);
    },
    requested: () => isRequested,
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
  inspectInteractiveConsole: interactiveConsoleAvailabilityOutcome,
  bindCancellation: (controlCapability, cancel) =>
    bindSignedGeneralTaskCancellation(process, controlCapability, cancel),
});

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
  pluralField?: string,
) {
  const ids: string[] = [];
  for (const result of results) {
    const singular = result?.[singularField];
    if (typeof singular === "string") ids.push(singular);
    if (!pluralField) continue;
    const plural = snapshotPlainArray<unknown>(result?.[pluralField], 128);
    if (plural.status !== "ok") continue;
    for (const value of plural.value) {
      if (typeof value === "string") ids.push(value);
    }
  }
  // Each of the two bounded result sources may contribute one singular ID and
  // at most 128 plural IDs. Preserve the complete composite recovery set.
  return Object.freeze([...new Set(ids)].slice(0, 260));
}

function recoveryProjection(...results: readonly (RuntimeRecord | null)[]) {
  const sources = results.filter((result) => result !== null);
  const hostRecoveryIds = boundedRecoveryIds(sources, "hostRecoveryId");
  const dockerRecoveryIds = boundedRecoveryIds(
    sources,
    "dockerRecoveryId",
    "dockerRecoveryIds",
  );
  const candidateRecoveryIds = boundedRecoveryIds(
    sources,
    "candidateRecoveryId",
    "candidateRecoveryIds",
  );
  const candidateStoreRecoveryIds = boundedRecoveryIds(
    sources,
    "candidateStoreRecoveryId",
    "candidateStoreRecoveryIds",
  );
  return Object.freeze({
    cleanupConfirmed:
      sources.length > 0 &&
      sources.every((result) => result?.cleanupConfirmed === true),
    manualRecoveryRequired: sources.some(
      (result) => result?.manualRecoveryRequired === true,
    ),
    hostRecoveryId: hostRecoveryIds.length === 1 ? hostRecoveryIds[0] : null,
    hostRecoveryIds,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
    dockerRecoveryIds,
    candidateRecoveryId:
      candidateRecoveryIds.length === 1 ? candidateRecoveryIds[0] : null,
    candidateRecoveryIds,
    candidateStoreRecoveryId:
      candidateStoreRecoveryIds.length === 1
        ? candidateStoreRecoveryIds[0]
        : null,
    candidateStoreRecoveryIds,
    recoveryIdentityAmbiguous:
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
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
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
});

export function createSignedGeneralTaskVerificationRequest(
  routeProfile: SignedGeneralTaskRouteProfile = "forward",
) {
  const route = ROUTE_EXPECTATIONS[routeProfile];
  return Object.freeze({
    frontProvider: route.frontProvider,
    objective:
      "Create the one bounded verification file with the exact required content.",
    acceptanceCriteria: Object.freeze([
      `The only changed path is ${TARGET_PATH}.`,
      `The file contains exactly ${JSON.stringify(EXPECTED_CONTENT)} as UTF-8 bytes.`,
    ]),
    allowedPaths: Object.freeze([TARGET_PATH]),
    readPaths: Object.freeze(["tools/coordinator/README.md", TARGET_PATH]),
    workClass:
      routeProfile === "same-codex"
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

function verifiedTaskResult(
  result: RuntimeRecord | null,
  release: ReleaseIdentity,
  route: RouteExpectation,
) {
  const candidateRevision = plainRecord(result?.candidateRevision);
  const executorResult = plainRecord(result?.executorResult);
  const reviewerResult = plainRecord(result?.reviewerResult);
  if (!candidateRevision) return false;
  return (
    result?.status === "completed" &&
    result.reason === "coordinator_task_candidate_approved" &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.executorProvider === route.executorProvider &&
    result.reviewerProvider === route.reviewerProvider &&
    result.reviewerIndependence === "provider_independent" &&
    result.remediationPerformed === false &&
    candidateRevision?.baseCommit === release?.crddCommit &&
    candidateRevision.baseTree === release.crddTree &&
    sha256(candidateRevision.patchHash) &&
    sha256(candidateRevision.contentManifestHash) &&
    sha256(candidateRevision.allowedPathsHash) &&
    exactStringArray(candidateRevision?.changedPaths, [TARGET_PATH]) &&
    exactStringArray(executorResult?.changedPaths, [TARGET_PATH]) &&
    reviewerResult?.decision === "approved" &&
    reviewerResult.findingCount === 0 &&
    result.canonicalRepositoryChanged === false &&
    result.rawOutputReported === false &&
    result.hostPathReported === false &&
    result.untrustedProviderTextReported === false &&
    result.hostRecoveryId === null &&
    result.dockerRecoveryId === null &&
    exactStringArray(result.dockerRecoveryIds, []) &&
    result.candidateRecoveryId === null &&
    result.candidateStoreRecoveryId === null &&
    typeof result.candidateId === "string"
  );
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
) {
  if (
    routeProfile !== "forward" &&
    routeProfile !== "reverse" &&
    routeProfile !== "same-codex"
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
  if (release?.reason === "platform_provisioner_process_restart_required") {
    return blocked(
      "signed_general_task_process_restart_required",
      release,
      Object.freeze({
        canonicalRepositoryChanged: false,
        manualRecoveryRequired: true,
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
  let consoleStatus: InteractiveConsoleAvailabilityOutcome["status"] =
    "unavailable";
  try {
    const observed = dependencies.inspectInteractiveConsole();
    consoleStatus =
      typeof observed === "boolean"
        ? observed
          ? "available"
          : "unavailable"
        : observed.status;
  } catch {
    // The console prerequisite remains unconfirmed.
  }
  if (consoleStatus === "cleanup_unknown") {
    return blocked(
      "signed_general_task_process_restart_required",
      release,
      Object.freeze({
        canonicalRepositoryChanged: false,
        manualRecoveryRequired: true,
      }),
    );
  }
  if (consoleStatus !== "available") {
    return blocked(
      "signed_general_task_interactive_console_required",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }

  let started: StartedTask;
  try {
    started = dependencies.startTask(
      createSignedGeneralTaskVerificationRequest(routeProfile),
      repositoryRoot,
      verifiedPackageCapability,
    );
  } catch {
    return blocked(
      "signed_general_task_start_failed_closed",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  const unbindCancellation = dependencies.bindCancellation(
    started.controlCapability,
    dependencies.cancelTask,
  );
  let taskResult: RuntimeRecord | null = null;
  try {
    try {
      taskResult = plainRecord(await started.completion);
    } catch {
      return blocked(
        "signed_general_task_completion_failed_closed",
        null,
        Object.freeze({ manualRecoveryRequired: true }),
      );
    }

    if (!taskResult) {
      return blocked(
        "signed_general_task_result_contract_mismatch",
        null,
        Object.freeze({ manualRecoveryRequired: true }),
      );
    }

    const candidateId = taskResult.candidateId;
    let isCandidateVerified = false;
    let discarded: RuntimeRecord | null = null;
    if (typeof candidateId === "string") {
      try {
        const candidate = plainRecord(dependencies.readCandidate(candidateId));
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
      if (discarded?.status !== "discarded") {
        return blocked(
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

    if (!verifiedTaskResult(taskResult, release, route)) {
      return blocked(
        taskResult?.status === "blocked"
          ? safeReason(
              taskResult.reason,
              "signed_general_task_result_contract_mismatch",
            )
          : "signed_general_task_result_contract_mismatch",
        taskResult,
        Object.freeze({
          candidateDiscarded: discarded?.status === "discarded",
        }),
      );
    }
    if (typeof candidateId !== "string") {
      return blocked("signed_general_task_candidate_id_missing", taskResult);
    }
    if (!isCandidateVerified) {
      return blocked(
        "signed_general_task_candidate_content_mismatch",
        taskResult,
        Object.freeze({ candidateDiscarded: true }),
      );
    }
    if (unbindCancellation.requested()) {
      return blocked(
        "signed_general_task_cancelled",
        taskResult,
        Object.freeze({ candidateDiscarded: true }),
      );
    }

    return Object.freeze({
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
      remediationPerformed: false,
      changedPaths: Object.freeze([TARGET_PATH]),
      exactCandidateContentVerified: true,
      candidateDiscarded: true,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      hostRecoveryId: null,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      candidateRecoveryId: null,
      candidateStoreRecoveryId: null,
      canonicalRepositoryChanged: false,
      rawProviderOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  } finally {
    unbindCancellation.unbind();
  }
}

export function describeSignedGeneralTaskVerificationContract() {
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    invocation: "direct_repository_owned_node_entrypoint",
    minimumNodeVersion: MINIMUM_COORDINATOR_NODE_VERSION,
    nodeSelection: "absolute_preverified_executable_only",
    interactiveConsolePreflight:
      "required_after_release_and_repository_format_verification_before_task_effects",
    interactiveConsoleCleanupUnknown:
      "process_restart_required_manual_recovery_without_recovery_id",
    unconsumedPackageCapability:
      "runtime_local_nonserializable_nonexported_not_reusable_after_preflight_failure",
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
    ]),
    defaultRouteProfile: "forward",
    routeArgumentGrammar:
      "no_arguments_or_exact_--route_reverse_or_--route_same-codex",
    frontIdentityBinding:
      "not_claimed_by_runner_result_requires_separate_fixed_run_evidence",
    candidateDisposition: "exact_content_verify_then_discard",
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
        (args[1] === "reverse" || args[1] === "same-codex"))
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
  main().catch((error: unknown) => {
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
  });
}
