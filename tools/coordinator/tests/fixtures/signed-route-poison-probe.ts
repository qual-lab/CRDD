import { requestRuntimeOwnedExternalSendGrant } from "../../src/security/external-send-grant-runtime.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/security/coordinator-task-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../../src/security/platform-provisioner-package-filesystem.ts";
import { isRuntimeProcessPoisoned } from "../../src/core/runtime-process-safety-state.ts";
import { runSignedRouteMatrixVerification } from "../../scripts/verify-signed-route-matrix.ts";
import type { SignedGeneralTaskRouteProfile } from "../../scripts/verify-signed-general-task.ts";

const scenario = process.argv[2] ?? "runner_exception";
const routes = {
  forward: [
    "codex",
    "claude",
    "codex",
    "front_codex__executor_claude__reviewer_codex",
  ],
  reverse: [
    "claude",
    "codex",
    "claude",
    "front_claude__executor_codex__reviewer_claude",
  ],
  "same-codex": [
    "codex",
    "codex",
    "claude",
    "front_codex__executor_codex__reviewer_claude",
  ],
  "same-claude": [
    "claude",
    "claude",
    "codex",
    "front_claude__executor_claude__reviewer_codex",
  ],
} as const;

function completed(
  route: SignedGeneralTaskRouteProfile,
  authorizationMode: string,
) {
  const expected = routes[route];
  return Object.freeze({
    contract: "crdd-coordinator/signed-general-task-verification",
    contractRevision: 13,
    status: "completed",
    reason: "signed_general_task_verification_completed",
    manifestHash: "a".repeat(64),
    packageContentRootSha256: "b".repeat(64),
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "c".repeat(40),
    crddTree: "d".repeat(40),
    requestedRouteProfile: route,
    route: expected[3],
    requestedFrontProvider: expected[0],
    observedFrontProvider: null,
    frontIdentityVerified: false,
    executorProvider: expected[1],
    reviewerProvider: expected[2],
    reviewerIndependence: "provider_independent",
    externalSendAuthorizationMode: authorizationMode,
    remediationPerformed: false,
    changedPaths: Object.freeze([
      "tools/coordinator/runtime/general-task-verification.txt",
    ]),
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

let attempts = 0;
const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
  _root,
  _dependencies,
  route,
) => {
  attempts += 1;
  if (scenario === "runner_exception" && attempts === 2)
    throw new Error("fixed_runner_exception");
  const value: Record<string, unknown> = {
    ...completed(
      route ?? "forward",
      attempts === 1 ? "interactive_initial_consent" : "reused_initial_consent",
    ),
  };
  if (scenario.startsWith("missing:")) delete value[scenario.slice(8)];
  if (scenario.startsWith("null:")) value[scenario.slice(5)] = null;
  if (scenario.startsWith("string:")) value[scenario.slice(7)] = "invalid";
  if (scenario === "child_true") value.processRestartRequired = true;
  if (scenario === "recovery_pair_mismatch") {
    value.cleanupConfirmed = false;
    value.manualRecoveryRequired = true;
    value.hostRecoveryId = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
    value.hostRecoveryIds = Object.freeze([
      `host.crdd-coordinator-doctor-b.12345678-1234-4234-8234-123456789abc.${"b".repeat(64)}`,
    ]);
  }
  if (scenario === "recovery_overlong_mixed") {
    const valid = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
    value.cleanupConfirmed = false;
    value.manualRecoveryRequired = true;
    value.hostRecoveryId = valid;
    value.hostRecoveryIds = Object.freeze([valid, "x".repeat(1_025)]);
  }
  if (scenario === "result_getter") {
    const getterResult = Object.create(null);
    Object.defineProperty(getterResult, "status", {
      enumerable: true,
      get: () => {
        throw new Error("fixed_route_result_getter");
      },
    });
    return getterResult;
  }
  if (scenario === "result_proxy")
    return new Proxy(value, {
      ownKeys: () => {
        throw new Error("fixed_route_result_proxy");
      },
    });
  return Object.freeze(value);
}) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
const secondMatrix = await runSignedRouteMatrixVerification(process.cwd());

let packageReads = 0;
const poisonProbe = new Proxy(Object.create(null), {
  get: () => {
    packageReads += 1;
    throw new Error("poisoned_input_read");
  },
  ownKeys: () => {
    packageReads += 1;
    throw new Error("poisoned_input_enumerated");
  },
});
const issued =
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability(poisonProbe);
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
    result,
    secondMatrix,
    attempts,
    poisoned: isRuntimeProcessPoisoned(),
    packageReason: issued.verification.reason,
    packageReads,
    taskReason,
    grantReason:
      grant && "reason" in grant && typeof grant.reason === "string"
        ? grant.reason
        : null,
    grantReads,
  })}\n`,
);
