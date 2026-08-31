import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS,
  expectedDynamicFakeProviderFailureReason,
  runDynamicFakeProviderFailureScenario,
} from "../src/security/docker-isolation.ts";
import { createOwnedOperationDirectories } from "../src/security/execution-environment.ts";

export function verifyDynamicFakeProviderFailures() {
  const results = DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS.map((scenario) => {
    const owned = createOwnedOperationDirectories();
    const result = runDynamicFakeProviderFailureScenario(owned, scenario);
    const expectedReason = expectedDynamicFakeProviderFailureReason(scenario);
    const isRootRemoved = !fs.existsSync(owned.root);
    const isPassed =
      result.status === "blocked" &&
      result.reason === expectedReason &&
      result.hostCleanupCompleted === true &&
      result.retainOperationDirectories === false &&
      result.recoveryId === null &&
      result.manualRecoveryRequired === false &&
      result.cleanup === "confirmed" &&
      result.fakeProviderLifecycle.status === "blocked" &&
      result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued ===
        true &&
      result.fakeProviderLifecycle.diagnosticFilesystemEffectIssued === true &&
      result.fakeProviderLifecycle.providerNetworkEffectIssued === false &&
      result.fakeProviderLifecycle.runtimeAuthorityIssued === false &&
      result.fakeProviderLifecycle.operationCapabilityIssued === false &&
      result.fakeProviderLifecycle.realProviderReadiness === false &&
      isRootRemoved;
    if (!isPassed)
      throw new Error(`dynamic failure scenario failed: ${scenario}`);
    return Object.freeze({
      scenario,
      status: result.status,
      reason: result.reason,
      cleanup: result.cleanup,
      containerEffectIssued:
        result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued,
      filesystemEffectIssued:
        result.fakeProviderLifecycle.diagnosticFilesystemEffectIssued,
      providerNetworkEffectIssued:
        result.fakeProviderLifecycle.providerNetworkEffectIssued,
      runtimeAuthorityIssued:
        result.fakeProviderLifecycle.runtimeAuthorityIssued,
      operationCapabilityIssued:
        result.fakeProviderLifecycle.operationCapabilityIssued,
      realProviderReadiness: result.fakeProviderLifecycle.realProviderReadiness,
      residualOperationDirectory: !isRootRemoved,
    });
  });
  return Object.freeze({
    contract: "crdd-coordinator/dynamic-fake-provider-failure-verification",
    contractRevision: 1,
    status: "verified",
    scenarios: Object.freeze(results),
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    `${JSON.stringify(verifyDynamicFakeProviderFailures())}\n`,
  );
}
