import fs from "node:fs";

import { runSignedGeneralTaskVerification } from "../../scripts/verify-signed-general-task.ts";
import { interactiveConsoleAvailabilityOutcome } from "../../src/core/interactive-console.ts";
import { isRuntimeProcessPoisoned } from "../../src/core/runtime-process-safety-state.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/security/coordinator-task-runtime.ts";
import { requestRuntimeOwnedExternalSendGrant } from "../../src/security/external-send-grant-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../../src/security/platform-provisioner-package-filesystem.ts";

const isInitiallyPoisoned = isRuntimeProcessPoisoned();
const originalOpen = fs.openSync;
const originalClose = fs.closeSync;
let preflightStatus = "not_started";
try {
  fs.openSync = ((_path: string, flags: string) =>
    flags === "r" ? 101 : 102) as typeof fs.openSync;
  fs.closeSync = (() => {
    throw new Error("fixture_descriptor_close_failed");
  }) as typeof fs.closeSync;
  preflightStatus = interactiveConsoleAvailabilityOutcome().status;
} finally {
  fs.openSync = originalOpen;
  fs.closeSync = originalClose;
}

let packageInputReadCount = 0;
const packageInput = new Proxy(Object.create(null), {
  get: () => {
    packageInputReadCount += 1;
    throw new Error("package_input_must_not_be_read_after_process_poison");
  },
  ownKeys: () => {
    packageInputReadCount += 1;
    throw new Error(
      "package_input_must_not_be_enumerated_after_process_poison",
    );
  },
});
const issued =
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability(packageInput);

let taskReason = "task_did_not_stop";
try {
  startRuntimeOwnedCoordinatorTask(null, null, null);
} catch (error) {
  taskReason = error instanceof Error ? error.message : "unknown_task_error";
}

const grant = await requestRuntimeOwnedExternalSendGrant(
  null,
  null,
  null,
  null,
  null,
  new AbortController().signal,
);
const runner = await runSignedGeneralTaskVerification(process.cwd());

process.stdout.write(
  `${JSON.stringify({
    initialPoisonState: isInitiallyPoisoned,
    preflightStatus,
    finalPoisonState: isRuntimeProcessPoisoned(),
    packageReason:
      issued.verification && typeof issued.verification === "object"
        ? (issued.verification as Readonly<Record<string, unknown>>).reason
        : null,
    packageCapabilityIsNull: issued.capability === null,
    packageInputReadCount,
    taskReason,
    grantIsNull: grant === null,
    runnerStatus: runner.status,
    runnerReason: runner.reason,
    runnerManualRecoveryRequired: runner.manualRecoveryRequired,
    runnerHostRecoveryId: runner.hostRecoveryId,
  })}\n`,
);
