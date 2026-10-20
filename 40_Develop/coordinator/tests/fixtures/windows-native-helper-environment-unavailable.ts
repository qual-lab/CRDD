/**
 * Native Helper環境を取得できない状態を模擬する。
 *
 * @packageDocumentation
 * @responsibility PA公開失敗結果を上位へ渡しCapability非発行を確認する。環境欠測の検出はPA試験が所有する。
 * @trace EST-ST-003
 * @level ST
 * @scope Native Helper環境の観測不能
 * @boundary PA公開結果の代役→上位の拒否・Capability境界。PA内部の検出や実Native操作は主張しない。
 */
import assert from "node:assert/strict";
import { mock } from "node:test";
import { describeProviderHomeObservationContract } from "../../../platform-access/src/index.ts";

let spawnCalls = 0;

await mock.module(
  new URL("../../src/task/development-measurement-session.ts", import.meta.url)
    .href,
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
  new URL("../../../platform-access/src/index.ts", import.meta.url).href,
  {
    namedExports: {
      WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE:
        "fixed_test_environment_unavailable",
      describeProviderHomeObservationContract,
      observeWindowsProviderHome: () => ({
        status: "blocked",
        reason: "environment_unavailable",
        processEffectIssued: false,
        helperExitConfirmed: false,
      }),
      observeWindowsRuntimeState: () => ({
        status: "blocked",
        reason: "environment_unavailable",
        processEffectIssued: false,
        helperExitConfirmed: false,
      }),
    },
  },
);

const providerAdapter = await import(
  "../../src/provider/home-windows-adapter.ts"
);
const candidateAdapter = await import(
  "../../src/platform-access/protected-root-windows-adapter.ts"
);
const providerOutcome =
  providerAdapter.inspectRuntimeOwnedWindowsProviderHomeCandidate("codex");
const candidateOutcomes = [
  candidateAdapter.inspectRuntimeOwnedWindowsRuntimeState(false),
  candidateAdapter.inspectRuntimeOwnedWindowsRuntimeState(true),
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
