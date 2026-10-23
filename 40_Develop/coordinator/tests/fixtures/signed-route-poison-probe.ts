/**
 * 署名Route検証のPoison拒否を模擬する。
 *
 * @packageDocumentation
 * @responsibility Task開始・送信Grant・Package Capabilityを差し替えて、Poison後のRoute開始拒否を観測する。
 * @trace AIT-ST-004
 * @level ST
 * @scope 署名Route検証の停止境界
 * @boundary 模擬操作→Route検証Tool。実Provider依頼や署名を発行するFixtureではない。
 */
import { requestRuntimeOwnedExternalSendGrant } from "../../src/decision/external-send-grant.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/execution/controller.ts";
import { isRuntimeProcessPoisoned } from "../../src/execution/process-safety-state.ts";
import { runSignedRouteMatrixVerification } from "../../scripts/verify-route-matrix.ts";
import {
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "../../scripts/verify-general-task.ts";

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
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "completed",
    reason: "signed_general_task_verification_completed",
    sourceScope: "crdd-development-source-snapshot/v2",
    sourceSha256: "b".repeat(64),
    sourceObservationStatus: "matched",
    signatureRequired: false,
    crddCommit: "c".repeat(40),
    crddTree: "d".repeat(40),
    executionCommit: "e".repeat(40),
    executionTree: "f".repeat(40),
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
      "40_Develop/coordinator/tests/fixtures/general-task-verification.txt",
    ]),
    exactCandidateContentVerified: true,
    candidateDiscarded: true,
    candidateDisposition: "discarded",
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
}) as typeof import("../../scripts/verify-general-task.ts").runSignedGeneralTaskVerification);
const secondMatrix = await runSignedRouteMatrixVerification(process.cwd());

let taskReads = 0;
const taskProbe = new Proxy(Object.create(null), {
  get: () => {
    taskReads += 1;
    throw new Error("poisoned_input_read");
  },
  ownKeys: () => {
    taskReads += 1;
    throw new Error("poisoned_input_enumerated");
  },
  getOwnPropertyDescriptor: () => {
    taskReads += 1;
    throw new Error("poisoned_input_inspected");
  },
});
let taskReason = "task_not_blocked";
try {
  startRuntimeOwnedCoordinatorTask(taskProbe, null);
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
    taskReads,
    taskReason,
    grantReason:
      grant && "reason" in grant && typeof grant.reason === "string"
        ? grant.reason
        : null,
    grantReads,
  })}\n`,
);
