import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../src/security/candidate-bundle-store.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "../src/security/platform-provisioner-package-filesystem.ts";

export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-general-task-verification";
export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION = 1;

const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";

type RuntimeRecord = Readonly<Record<string, unknown>>;
type StartedTask = Readonly<{
  controlCapability: object;
  completion: Promise<RuntimeRecord>;
}>;
type VerificationDependencies = Readonly<{
  verifyPackage: (input: Readonly<{ evaluationTime: string }>) => RuntimeRecord;
  startTask: (request: RuntimeRecord, repositoryRoot: string) => StartedTask;
  cancelTask: (controlCapability: object) => unknown;
  readCandidate: (candidateId: string) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
  now: () => string;
  bindCancellation: (
    controlCapability: object,
    cancel: (controlCapability: object) => unknown,
  ) => () => void;
}>;

const productionDependencies: VerificationDependencies = Object.freeze({
  verifyPackage: verifyBundledCoordinatorPackageFromFixedManifestCandidate,
  startTask: startRuntimeOwnedCoordinatorTask,
  cancelTask: cancelRuntimeOwnedCoordinatorTask,
  readCandidate: readRuntimeOwnedCandidateBundle,
  discardCandidate: discardRuntimeOwnedCandidateBundle,
  now: () => new Date().toISOString(),
  bindCancellation: (controlCapability, cancel) => {
    const requestCancellation = () => {
      void cancel(controlCapability);
    };
    process.on("SIGINT", requestCancellation);
    process.on("SIGTERM", requestCancellation);
    return () => {
      process.removeListener("SIGINT", requestCancellation);
      process.removeListener("SIGTERM", requestCancellation);
    };
  },
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

function exactStringArray(value: unknown, expected: readonly string[]) {
  const snapshot = snapshotPlainArray<unknown>(value, expected.length);
  return (
    snapshot.status === "ok" &&
    snapshot.value.length === expected.length &&
    expected.every((item, index) => snapshot.value[index] === item)
  );
}

function safeReason(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-z0-9_]+$/u.test(value)
    ? value
    : fallback;
}

function recoveryProjection(result: RuntimeRecord | null) {
  const recoveryIds = snapshotPlainArray<unknown>(
    result?.dockerRecoveryIds,
    128,
  );
  const dockerRecoveryIds =
    recoveryIds.status === "ok"
      ? recoveryIds.value.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  return Object.freeze({
    cleanupConfirmed: result?.cleanupConfirmed === true,
    manualRecoveryRequired: result?.manualRecoveryRequired === true,
    hostRecoveryId:
      typeof result?.hostRecoveryId === "string" ? result.hostRecoveryId : null,
    dockerRecoveryId:
      typeof result?.dockerRecoveryId === "string"
        ? result.dockerRecoveryId
        : null,
    dockerRecoveryIds: Object.freeze([...new Set(dockerRecoveryIds)]),
    candidateRecoveryId:
      typeof result?.candidateRecoveryId === "string"
        ? result.candidateRecoveryId
        : null,
    candidateStoreRecoveryId:
      typeof result?.candidateStoreRecoveryId === "string"
        ? result.candidateStoreRecoveryId
        : null,
  });
}

function blocked(
  reason: string,
  source: RuntimeRecord | null = null,
  extra: RuntimeRecord = Object.freeze({}),
) {
  const canonicalRepositoryChanged =
    source?.canonicalRepositoryChanged === true
      ? true
      : source?.canonicalRepositoryChanged === false
        ? false
        : extra.canonicalRepositoryChanged === false
          ? false
          : null;
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    ...recoveryProjection(source),
    ...extra,
    canonicalRepositoryChanged,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

export function createSignedGeneralTaskVerificationRequest() {
  return Object.freeze({
    frontProvider: "codex",
    objective:
      "Create the one bounded verification file with the exact required content.",
    acceptanceCriteria: Object.freeze([
      `The only changed path is ${TARGET_PATH}.`,
      `The file contains exactly ${JSON.stringify(EXPECTED_CONTENT)} as UTF-8 bytes.`,
    ]),
    allowedPaths: Object.freeze([TARGET_PATH]),
    readPaths: Object.freeze(["tools/coordinator/README.md", TARGET_PATH]),
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

function verifiedPackage(release: RuntimeRecord | null) {
  return (
    release?.status === "candidate" &&
    release.qualLabManifestCryptographicMatch === true &&
    release.runtimeOwnedReleaseTrustConfirmed === true &&
    release.releaseIdentityRuntimeOwned === true &&
    release.crddDistributionConfirmed === true
  );
}

function verifiedTaskResult(result: RuntimeRecord | null) {
  const candidateRevision = plainRecord(result?.candidateRevision);
  const executorResult = plainRecord(result?.executorResult);
  const reviewerResult = plainRecord(result?.reviewerResult);
  return (
    result?.status === "completed" &&
    result.reason === "coordinator_task_candidate_approved" &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.executorProvider === "claude" &&
    result.reviewerProvider === "codex" &&
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
) {
  const bundle = plainRecord(candidate?.bundle);
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
  const content = Buffer.from(contentBase64, "base64");
  return (
    content.toString("base64") === contentBase64 &&
    content.equals(Buffer.from(EXPECTED_CONTENT, "utf8")) &&
    entry.byteLength === content.byteLength &&
    entry.sha256 === createHash("sha256").update(content).digest("hex")
  );
}

export async function runSignedGeneralTaskVerification(
  repositoryRoot: string,
  dependencies: VerificationDependencies = productionDependencies,
) {
  if (!path.isAbsolute(repositoryRoot)) {
    return blocked(
      "signed_general_task_repository_root_invalid",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  const release = plainRecord(
    dependencies.verifyPackage({ evaluationTime: dependencies.now() }),
  );
  if (!verifiedPackage(release)) {
    return blocked(
      "signed_general_task_release_verification_failed",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }

  let started: StartedTask;
  try {
    started = dependencies.startTask(
      createSignedGeneralTaskVerificationRequest(),
      repositoryRoot,
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
    taskResult = plainRecord(await started.completion);
  } catch {
    return blocked(
      "signed_general_task_completion_failed_closed",
      null,
      Object.freeze({ manualRecoveryRequired: true }),
    );
  } finally {
    unbindCancellation();
  }
  if (!verifiedTaskResult(taskResult)) {
    return blocked(
      taskResult?.status === "blocked"
        ? safeReason(
            taskResult.reason,
            "signed_general_task_result_contract_mismatch",
          )
        : "signed_general_task_result_contract_mismatch",
      taskResult,
    );
  }

  const candidateId = taskResult?.candidateId;
  if (typeof candidateId !== "string") {
    return blocked("signed_general_task_candidate_id_missing", taskResult);
  }
  const candidate = plainRecord(dependencies.readCandidate(candidateId));
  const candidateVerified = verifiedCandidate(candidate, candidateId);
  const discarded = plainRecord(dependencies.discardCandidate(candidateId));
  if (discarded?.status !== "discarded") {
    return blocked(
      "signed_general_task_candidate_discard_failed",
      discarded,
      Object.freeze({
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        candidateIdForManualDiscard: candidateId,
        canonicalRepositoryChanged: false,
      }),
    );
  }
  if (!candidateVerified) {
    return blocked(
      "signed_general_task_candidate_content_mismatch",
      taskResult,
    );
  }

  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "completed" as const,
    reason: "signed_general_task_verification_completed",
    crddVersion:
      typeof release?.crddVersion === "string" ? release.crddVersion : null,
    releaseSequence:
      Number.isSafeInteger(release?.releaseSequence) &&
      Number(release?.releaseSequence) >= 1
        ? release?.releaseSequence
        : null,
    executorProvider: "claude" as const,
    reviewerProvider: "codex" as const,
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
}

export function describeSignedGeneralTaskVerificationContract() {
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    invocation: "direct_repository_owned_node_entrypoint",
    requestConstruction: "fixed_public_request_constructed_in_process",
    requestShellTransportAllowed: false,
    powershellTextPipelineAllowed: false,
    temporaryRequestFileAllowed: false,
    longShellCommandReconstructionAllowed: false,
    normalTaskStdinContractChanged: false,
    interactiveBoundary:
      "runtime_owned_console_challenge_for_external_send_only",
    providerRoute: "front_codex_to_claude_executor_to_codex_reviewer",
    candidateDisposition: "exact_content_verify_then_discard",
    canonicalRepositoryEffectAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("signed_general_task_verification_arguments_invalid");
  }
  const result = await runSignedGeneralTaskVerification(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const reason = safeReason(
      error instanceof Error ? error.message : null,
      "signed_general_task_verification_failed_closed",
    );
    process.stdout.write(`${JSON.stringify(blocked(reason), null, 2)}\n`);
    process.exitCode = 2;
  });
}
