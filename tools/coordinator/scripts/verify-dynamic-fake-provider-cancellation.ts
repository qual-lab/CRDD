import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runDynamicFakeProviderCancellationVerification } from "../src/security/docker-isolation.ts";
import { createOwnedOperationDirectories } from "../src/security/execution-environment.ts";

export async function verifyDynamicFakeProviderCancellation() {
  const owned = createOwnedOperationDirectories();
  const result = await runDynamicFakeProviderCancellationVerification(owned);
  const isRootRemoved = !fs.existsSync(owned.root);
  if (
    result.status !== "verified" ||
    result.reason !== "dynamic_fake_provider_cancellation_verified" ||
    result.cancellationRequested !== true ||
    result.cancellationSignalRequested !== "SIGTERM" ||
    result.readyObserved !== true ||
    result.cancellationAcknowledged !== true ||
    result.processTerminationObserved !== true ||
    result.containerAbsenceVerified !== true ||
    result.hostCleanupVerified !== true ||
    result.cleanup !== "confirmed" ||
    result.retainOperationDirectories !== false ||
    result.recoveryId !== null ||
    result.manualRecoveryRequired !== false ||
    result.diagnosticDockerContainerEffectIssued !== true ||
    result.diagnosticFilesystemEffectIssued !== true ||
    result.providerNetworkEffectIssued !== false ||
    result.runtimeAuthorityIssued !== false ||
    result.operationCapabilityIssued !== false ||
    result.realProviderReadiness !== false ||
    !isRootRemoved
  )
    throw new Error("dynamic Fake Provider cancellation verification failed");
  return Object.freeze({
    contract:
      "crdd-coordinator/dynamic-fake-provider-cancellation-verification",
    contractRevision: 1,
    status: result.status,
    reason: result.reason,
    cancellationSignalRequested: result.cancellationSignalRequested,
    readyObserved: result.readyObserved,
    cancellationAcknowledged: result.cancellationAcknowledged,
    processTerminationObserved: result.processTerminationObserved,
    containerAbsenceVerified: result.containerAbsenceVerified,
    hostCleanupVerified: result.hostCleanupVerified,
    cleanup: result.cleanup,
    graceElapsedMs: result.graceElapsedMs,
    stdoutBytes: result.stdoutBytes,
    stderrBytes: result.stderrBytes,
    exitCode: result.exitCode,
    diagnosticDockerContainerEffectIssued:
      result.diagnosticDockerContainerEffectIssued,
    diagnosticFilesystemEffectIssued: result.diagnosticFilesystemEffectIssued,
    providerNetworkEffectIssued: result.providerNetworkEffectIssued,
    runtimeAuthorityIssued: result.runtimeAuthorityIssued,
    operationCapabilityIssued: result.operationCapabilityIssued,
    realProviderReadiness: result.realProviderReadiness,
    residualOperationDirectory: !isRootRemoved,
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    `${JSON.stringify(await verifyDynamicFakeProviderCancellation())}\n`,
  );
}
