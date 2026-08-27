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
const hostRecoveryA = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
const dockerRecoveryA = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
const dockerRecoveryB = `docker-task.${"4".repeat(64)}.${"5".repeat(64)}.${"6".repeat(64)}`;
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
  result.hostRecoveryId = hostRecoveryA;
}
if (scenario.startsWith("missing:")) delete result[scenario.slice(8)];
if (scenario.startsWith("null:")) result[scenario.slice(5)] = null;
if (scenario.startsWith("string:")) result[scenario.slice(7)] = "invalid";
if (scenario === "docker_pair_mismatch") {
  result.cleanupConfirmed = false;
  result.manualRecoveryRequired = true;
  result.dockerRecoveryId = dockerRecoveryA;
  result.dockerRecoveryIds = Object.freeze([dockerRecoveryB]);
}
if (scenario === "control_missing_completion_recovery") {
  result.status = "blocked";
  result.reason = "coordinator_task_cleanup_unconfirmed";
  result.cleanupConfirmed = false;
  result.manualRecoveryRequired = true;
  result.hostRecoveryId = hostRecoveryA;
}
if (scenario === "signal_cleanup_unknown_cancel_unobserved") {
  result.status = "blocked";
  result.reason = "coordinator_task_cleanup_unconfirmed";
  result.cleanupConfirmed = false;
  result.manualRecoveryRequired = true;
  result.hostRecoveryId = hostRecoveryA;
}

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
let lateRequested = false;
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
    const completion =
      scenario === "bind_throw_completion_never" ||
      scenario.startsWith("signal_completion_never") ||
      scenario === "control_missing_completion_never"
        ? new Promise<Record<string, unknown>>(() => undefined)
        : scenario === "completion_reject" ||
            scenario === "control_missing_completion_reject"
          ? Promise.reject(new Error("fixed_completion_reject"))
          : Promise.resolve(
              scenario === "result_getter"
                ? getterResult
                : Object.freeze(result),
            );
    const started = Object.freeze({
      controlCapability: Object.freeze({}),
      completion,
    });
    if (scenario === "started_proxy") return new Proxy(started, {});
    if (
      scenario === "completion_subclass" ||
      scenario === "completion_subclass_reject"
    ) {
      class ThrowingThenPromise<T> extends Promise<T> {
        // biome-ignore lint/suspicious/noThenProperty: the hostile then override is the contract-test input.
        override then(): never {
          throw new Error("fixed_inherited_then_throw");
        }
      }
      return Object.freeze({
        controlCapability: started.controlCapability,
        completion: new ThrowingThenPromise<Record<string, unknown>>(
          (resolve, reject) =>
            scenario === "completion_subclass_reject"
              ? reject(new Error("fixed_subclass_rejection"))
              : resolve(Object.freeze(result)),
        ),
      });
    }
    if (scenario.startsWith("control_missing_completion_"))
      return Object.freeze({ completion });
    if (scenario === "completion_proxy")
      return Object.freeze({
        controlCapability: started.controlCapability,
        completion: new Proxy(completion, {}),
      });
    if (scenario === "completion_getter") {
      const withGetter = Object.create(null);
      Object.defineProperty(withGetter, "controlCapability", {
        enumerable: true,
        value: started.controlCapability,
      });
      Object.defineProperty(withGetter, "completion", {
        enumerable: true,
        get: () => completion,
      });
      return withGetter;
    }
    return started;
  },
  cancelTask: () => {
    cancelAttempts += 1;
    if (
      scenario === "cancel_reject" ||
      scenario === "signal_completion_never_cancel_reject"
    )
      return Promise.reject(new Error("fixed_cancel_reject"));
    if (
      scenario === "cancel_never" ||
      scenario === "signal_completion_never_cancel_never"
    )
      return new Promise<Record<string, unknown>>(() => undefined);
    if (scenario === "signal_completion_never_cancel_malformed")
      return Object.freeze({ status: "blocked" });
    if (scenario === "signal_cleanup_unknown_cancel_unobserved")
      return Object.freeze({
        status: "requested",
        reason: "provider_cancellation_grace_exceeded",
        cancellationRequested: true,
        processTerminationObserved: false,
      });
    return Object.freeze({
      status: "requested",
      reason: "provider_cancellation_requested",
      cancellationRequested: true,
      processTerminationObserved: true,
    });
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
        if (scenario === "unbind_requests") lateRequested = true;
      },
      requested: () => {
        if (scenario === "requested_throw")
          throw new Error("fixed_requested_throw");
        return scenario.startsWith("signal_") || lateRequested;
      },
      requestedPromise: scenario.startsWith("signal_")
        ? Promise.resolve()
        : new Promise<void>(() => undefined),
    });
  },
  isolatedSettlementTiming: Object.freeze({
    cancelAckTimeoutMs: 50,
    cancelCompletionTimeoutMs: 50,
    orphanedStartObservationTimeoutMs: 50,
  }),
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

await new Promise<void>((resolve) => setImmediate(resolve));

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
