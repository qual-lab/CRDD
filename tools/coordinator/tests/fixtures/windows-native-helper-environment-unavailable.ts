import assert from "node:assert/strict";
import { mock } from "node:test";

const artifact = Object.freeze({
  relativePath:
    "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
  target: "x86_64-pc-windows-msvc",
  protocolRevision: 3,
  rustToolchain: "1.94.1-x86_64-pc-windows-msvc",
  byteLength: 1,
  sha256: "1".repeat(64),
});
let spawnCalls = 0;

await mock.module(
  new URL(
    "../../src/security/development-measurement-session.ts",
    import.meta.url,
  ).href,
  {
    namedExports: {
      borrowRuntimeOwnedDevelopmentNativeObservation: () => null,
    },
  },
);
await mock.module("node:child_process", {
  namedExports: {
    spawnSync: () => {
      spawnCalls += 1;
      throw new Error("native_helper_spawn_must_not_occur");
    },
  },
});
await mock.module(
  new URL("../../src/core/windows-child-environment.ts", import.meta.url).href,
  {
    namedExports: {
      createWindowsNativeHelperEnvironment: () => null,
      WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE:
        "fixed_test_environment_unavailable",
    },
  },
);
await mock.module(
  new URL(
    "../../src/security/platform-provisioner-package-filesystem.ts",
    import.meta.url,
  ).href,
  {
    namedExports: {
      inspectVerifiedNativeDistributionCandidate: () => ({ status: "blocked" }),
      verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => ({
        status: "candidate",
        runtimeOwnedReleaseTrustConfirmed: true,
        releaseIdentityRuntimeOwned: true,
        crddDistributionConfirmed: true,
        platformAccessArtifact: artifact,
      }),
    },
  },
);
await mock.module(
  new URL("../../src/security/platform-access-release.ts", import.meta.url)
    .href,
  {
    namedExports: {
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: artifact.relativePath,
      observePlatformAccessReleaseArtifactCandidate: () => ({
        status: "candidate",
        artifact,
      }),
      beginPlatformAccessArtifactSigningObservation: () => ({
        artifact,
        token: Object.freeze({}),
      }),
      verifyPlatformAccessArtifactSigningObservation: () => true,
    },
  },
);

const providerAdapter = await import(
  "../../src/security/provider-home-windows-adapter.ts"
);
const candidateAdapter = await import(
  "../../src/security/candidate-store-windows-adapter.ts"
);
const now = new Date().toISOString();
const providerOutcome =
  providerAdapter.inspectRuntimeOwnedWindowsProviderHomeCandidate("codex", now);
const candidateOutcomes = [
  candidateAdapter.inspectRuntimeOwnedWindowsCandidateStore(false, now),
  candidateAdapter.inspectRuntimeOwnedWindowsCandidateStore(true, now),
  candidateAdapter.inspectRuntimeOwnedWindowsRuntimeState(false, now),
  candidateAdapter.inspectRuntimeOwnedWindowsRuntimeState(true, now),
];
const outcomes = [providerOutcome, ...candidateOutcomes];

for (const outcome of outcomes) {
  assert.equal(outcome.status, "blocked");
  assert.match(outcome.reason, /_environment_unavailable$/u);
  assert.equal(outcome.helperSpawnAttempts, 0);
  assert.equal(outcome.processEffectIssued, false);
  assert.equal(outcome.filesystemEffectIssued, false);
  assert.equal(outcome.networkEffectIssued, false);
  assert.equal(outcome.runtimeAuthorityIssued, false);
  assert.equal(outcome.pathReported, false);
  assert.equal(outcome.principalReported, false);
  assert.equal(outcome.aclReported, false);
}
assert.equal(providerOutcome.observationCapability, null);
assert.equal(providerOutcome.helperSpawned, false);
assert.equal(providerOutcome.runtimeOwnedObservationCapabilityIssued, false);
assert.equal(providerOutcome.mountGrantIssued, false);
assert.equal(providerOutcome.operationCapabilityIssued, false);
assert.equal(providerOutcome.manualRecoveryRequired, false);
for (const outcome of candidateOutcomes) {
  assert.equal(outcome.rootCapability, null);
  assert.equal(outcome.manualRecoveryRequired, false);
}
assert.equal(spawnCalls, 0);

const isCapabilityIssued =
  providerOutcome.observationCapability !== null ||
  providerOutcome.runtimeOwnedObservationCapabilityIssued ||
  providerOutcome.mountGrantIssued ||
  providerOutcome.operationCapabilityIssued ||
  candidateOutcomes.some((outcome) => outcome.rootCapability !== null);
const isManualRecoveryRequired = outcomes.some(
  (outcome) => outcome.manualRecoveryRequired,
);
const isFilesystemEffectIssued = outcomes.some(
  (outcome) => outcome.filesystemEffectIssued,
);
const isNetworkEffectIssued = outcomes.some(
  (outcome) => outcome.networkEffectIssued,
);
const isAuthorityIssued = outcomes.some(
  (outcome) => outcome.runtimeAuthorityIssued,
);

process.stdout.write(
  `${JSON.stringify({
    outcomes: outcomes.length,
    spawnCalls,
    filesystemEffectIssued: isFilesystemEffectIssued,
    networkEffectIssued: isNetworkEffectIssued,
    authorityIssued: isAuthorityIssued,
    capabilityIssued: isCapabilityIssued,
    manualRecoveryRequired: isManualRecoveryRequired,
  })}\n`,
);
