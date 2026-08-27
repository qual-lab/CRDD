import { createHash } from "node:crypto";

import { runSignedGeneralTaskVerification } from "../../scripts/verify-signed-general-task.ts";
import { isRuntimeProcessPoisoned } from "../../src/core/runtime-process-safety-state.ts";
import { requestRuntimeOwnedExternalSendGrant } from "../../src/security/external-send-grant-runtime.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/security/coordinator-task-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../../src/security/platform-provisioner-package-filesystem.ts";

const scenario = process.argv[2] ?? "completed_true";
const targetPath = "tools/coordinator/runtime/general-task-verification.txt";
const expectedContent = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const candidateId = `candidate.${"1".repeat(64)}.${"2".repeat(64)}`;
const baseCommit = "a".repeat(40);
const baseTree = "b".repeat(40);
const baseManifestHash = "c".repeat(64);
const contentManifestHash = "d".repeat(64);
const allowedPathsHash = "e".repeat(64);
const patchHash = createHash("sha256")
  .update("crdd-candidate-revision-v1\0")
  .update(baseCommit)
  .update("\0")
  .update(baseTree)
  .update("\0")
  .update(baseManifestHash)
  .update("\0")
  .update(contentManifestHash)
  .update("\0")
  .update(allowedPathsHash)
  .update("\0")
  .update(targetPath)
  .digest("hex");

const release = Object.freeze({
  status: "candidate",
  stableFilesystemIdentityObserved: true,
  runtimeOwnedPackageRoot: true,
  manifestHash: "f".repeat(64),
  packageContentRootSha256: "0".repeat(64),
  qualLabManifestCryptographicMatch: true,
  runtimeOwnedReleaseTrustConfirmed: true,
  releaseIdentityRuntimeOwned: true,
  crddDistributionConfirmed: true,
  crddVersion: "v0.18.0",
  releaseSequence: 1,
  crddCommit: baseCommit,
  crddTree: baseTree,
});

const result: Record<string, unknown> = {
  status: "completed",
  reason: "coordinator_task_candidate_approved",
  cleanupConfirmed: true,
  manualRecoveryRequired: false,
  processRestartRequired: false,
  executorProvider: "claude",
  reviewerProvider: "codex",
  reviewerIndependence: "provider_independent",
  externalSendAuthorizationMode: "interactive_initial_consent",
  remediationPerformed: false,
  candidateRevision: Object.freeze({
    baseCommit,
    baseTree,
    patchHash,
    contentManifestHash,
    allowedPathsHash,
    changedPaths: Object.freeze([targetPath]),
  }),
  executorResult: Object.freeze({ changedPaths: Object.freeze([targetPath]) }),
  reviewerResult: Object.freeze({ decision: "approved", findingCount: 0 }),
  canonicalRepositoryChanged: false,
  rawOutputReported: false,
  hostPathReported: false,
  untrustedProviderTextReported: false,
  hostRecoveryId: null,
  dockerRecoveryId: null,
  dockerRecoveryIds: Object.freeze([]),
  candidateRecoveryId: null,
  candidateStoreRecoveryId: null,
  candidateId,
};
if (scenario === "completed_true") result.processRestartRequired = true;
if (scenario === "completed_missing") delete result.processRestartRequired;
if (scenario === "completed_null") result.processRestartRequired = null;
if (scenario === "bind_throw_recovery") {
  result.status = "blocked";
  result.reason = "coordinator_task_cleanup_unconfirmed";
  result.cleanupConfirmed = false;
  result.manualRecoveryRequired = true;
  result.hostRecoveryId = "host.fixed.recovery";
}
if (scenario.startsWith("missing:")) delete result[scenario.slice(8)];
if (scenario.startsWith("null:")) result[scenario.slice(5)] = null;
if (scenario.startsWith("string:")) result[scenario.slice(7)] = "invalid";

const bytes = Buffer.from(expectedContent, "utf8");
const candidate = Object.freeze({
  status: "exported",
  candidateId,
  bundle: Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit,
    baseTree,
    baseManifestHash,
    patchHash,
    contentManifestHash,
    allowedPathsHash,
    changedPaths: Object.freeze([targetPath]),
    entries: Object.freeze([
      Object.freeze({
        relativePath: targetPath,
        operation: "upsert",
        byteLength: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        contentBase64: bytes.toString("base64"),
      }),
    ]),
  }),
});

let cancelAttempts = 0;
const runnerResult = await runSignedGeneralTaskVerification(process.cwd(), {
  issuePackageCapability: () =>
    Object.freeze({ verification: release, capability: Object.freeze({}) }),
  startTask: () => {
    if (scenario === "start_throw") throw new Error("fixed_start_throw");
    const getterResult = Object.create(null);
    Object.defineProperty(getterResult, "status", {
      enumerable: true,
      get: () => {
        throw new Error("fixed_result_getter");
      },
    });
    return Object.freeze({
      controlCapability: Object.freeze({}),
      completion:
        scenario === "bind_throw_completion_never"
          ? new Promise<Record<string, unknown>>(() => undefined)
          : scenario === "completion_reject"
            ? Promise.reject(new Error("fixed_completion_reject"))
            : Promise.resolve(
                scenario === "result_getter"
                  ? getterResult
                  : Object.freeze(result),
              ),
    });
  },
  cancelTask: () => {
    cancelAttempts += 1;
    if (scenario === "cancel_reject")
      return Promise.reject(new Error("fixed_cancel_reject"));
    if (scenario === "cancel_never")
      return new Promise<Record<string, unknown>>(() => undefined);
    return Object.freeze({ status: "requested" });
  },
  readCandidate: () => candidate,
  discardCandidate: () =>
    scenario === "discard_true"
      ? Object.freeze({
          status: "blocked",
          reason: "candidate_bundle_discard_recovery_required",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          candidateRecoveryId: `candidate-recovery.${"3".repeat(64)}.${"4".repeat(64)}`,
          candidateStoreRecoveryId: null,
        })
      : Object.freeze({ status: "discarded" }),
  now: () => "2026-08-27T00:00:00.000Z",
  runtimeVersion: () => "24.19.0",
  bindCancellation: () => {
    if (
      scenario === "bind_throw" ||
      scenario === "bind_throw_recovery" ||
      scenario === "bind_throw_completion_never" ||
      scenario === "cancel_reject" ||
      scenario === "cancel_never"
    )
      throw new Error("fixed_bind_throw");
    return Object.freeze({
      unbind: () => {
        if (scenario === "unbind_throw") throw new Error("fixed_unbind_throw");
      },
      requested: () => {
        if (scenario === "requested_throw")
          throw new Error("fixed_requested_throw");
        return false;
      },
    });
  },
});

let packageReads = 0;
const packageProbe = new Proxy(Object.create(null), {
  get: () => {
    packageReads += 1;
    throw new Error("package_input_read");
  },
  ownKeys: () => {
    packageReads += 1;
    throw new Error("package_input_enumerated");
  },
});
const issued =
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability(packageProbe);
let taskReason = "task_not_blocked";
try {
  startRuntimeOwnedCoordinatorTask(null, null, null);
} catch (error) {
  taskReason = error instanceof Error ? error.message : "unknown";
}
let grantReads = 0;
const grantProbe = new Proxy(Object.create(null), {
  get: () => {
    grantReads += 1;
    throw new Error("grant_input_read");
  },
  ownKeys: () => {
    grantReads += 1;
    throw new Error("grant_input_enumerated");
  },
});
const grant = await requestRuntimeOwnedExternalSendGrant(
  grantProbe,
  grantProbe,
  grantProbe,
  grantProbe,
  grantProbe,
  grantProbe as AbortSignal,
);

process.stdout.write(
  `${JSON.stringify({
    runnerResult,
    poisoned: isRuntimeProcessPoisoned(),
    packageReason: issued.verification.reason,
    packageReads,
    taskReason,
    grantReason:
      grant && "reason" in grant && typeof grant.reason === "string"
        ? grant.reason
        : null,
    grantReads,
    cancelAttempts,
  })}\n`,
);
