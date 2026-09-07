import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createDockerRestartHandoffRecord } from "../../src/security/docker-restart-handoff-record.ts";
import {
  createDockerRestartRecord,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "../../src/security/docker-restart-record.ts";

// Execute the production preparation body with observed read/write seams. This
// does not substitute for signed Windows integration or confer capabilities.
const source = fs.readFileSync(
  new URL(
    "../../src/security/docker-recovery-runtime-internal.ts",
    import.meta.url,
  ),
  "utf8",
);
const start = source.indexOf(
  "export function prepareRuntimeOwnedDockerRestart(",
);
const end = source.indexOf(
  "export function verifyRuntimeOwnedDockerRestartPreparation(",
  start,
);
assert.ok(start >= 0 && end > start);
const body = stripTypeScriptTypes(
  source.slice(start, end).replace("export function", "function"),
);
function runPreparation(isHistoryValid: boolean) {
  const h = "a".repeat(64);
  const token = `docker-task.${h}.${h}.${h}`;
  const root = {
    rootPath: path.resolve("fixture-root"),
    runtimeStateIdentityHash: h,
    runtimeStateProtectionHash: h,
    stableLogicalHomeBindingHash: h,
    localUserBindingHash: h,
  };
  const binding = {
    recoveryId: token,
    operationNonce: h,
    runtimeExecutionIdentitySha256: h,
    localUserBindingHash: h,
    runtimeStateIdentityHash: h,
    runtimeStateProtectionHash: h,
    stableLogicalHomeBindingHash: h,
    pendingSubmissionSha256: h,
  };
  const origin = createDockerRestartRecord(binding, "stop_intent");
  let writes = 0;
  let releases = 0;
  const lock = () => ({
    assertLive: () => true,
    release: () => {
      releases++;
      return true;
    },
  });
  const context = {
    Buffer,
    path,
    Object,
    Error,
    parseDockerTaskRecoveryId: () => ({
      token,
      operationNonce: h,
      stableLogicalHomeBindingHash: h,
      baseHash: h,
    }),
    verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => ({
      status: "candidate",
      runtimeOwnedReleaseTrustConfirmed: true,
      runtimeExecutionIdentityRuntimeOwned: true,
      crddDistributionConfirmed: true,
      runtimeExecutionIdentitySha256: "b".repeat(64),
      platformAccessArtifact: null,
    }),
    observeRuntimeStateRootFromWindows: () => root,
    restartPathIdentity: () => "fixed",
    discoverRecoveryHostBinding: () => ({ hostRoot: "host", hostNonce: h }),
    acquireRuntimeOwnedHostOperationKernelLock: lock,
    acquireRuntimeOwnedLogicalProviderHomeKernelLock: lock,
    acquireRuntimeOwnedDockerRuntimeStateKernelLock: lock,
    inspectDockerRecoveryRootSnapshot: () => ({
      status: "completed",
      dockerRecoveryIds: [token],
      activeStableLogicalHomeBindingHashes: [],
    }),
    discoverRecoveryRuntimeStateBinding: () => ({
      runtimeStateIdentityHash: h,
      runtimeStateProtectionHash: h,
      runtimeStateBindingHash: h,
    }),
    inventoryOperationDirectory: () => [
      "submission-create_subscription_auth_probe.json",
      "engine-restart-00.json",
    ],
    readExactJson: (name: string) => ({
      hash: h,
      serialized: name.endsWith("engine-restart-00.json")
        ? origin.toString()
        : "{}\n",
    }),
    parseDockerRestartRecord,
    validateDockerRestartRecordChain,
    createDockerRestartHandoffRecord,
    loadHistoricalReleaseManifestEnvelopeForVerification: () => ({
      envelope: {},
    }),
    getPinnedPlatformProvisionerReleaseSignerSpkiDer: () => null,
    verifyHistoricalPlatformProvisionerManifestCandidate: () =>
      isHistoryValid
        ? {
            historicalSignatureVerified: true,
            payload: { runtimeExecutionIdentitySha256: h },
          }
        : null,
    ensureDockerTaskSessionHandoff: () => {
      writes++;
    },
    dockerRestartPreparations: new WeakMap(),
  };
  const result = runInNewContext(
    `${body}\nprepareRuntimeOwnedDockerRestart("id", ${JSON.stringify(path.resolve("old-release"))});`,
    context,
  );
  return { result, writes, releases };
}
test("invalid historical signature blocks before protected-root session handoff", () => {
  const { result, writes, releases } = runPreparation(false);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_origin_unverified");
  assert.equal(writes, 0);
  assert.equal(releases, 3);
});
test("fresh continuation keeps historical stop intent distinct from current phase", () => {
  const { result, writes } = runPreparation(true);
  assert.equal(result.status, "prepared");
  assert.equal(result.currentPhase, null);
  assert.equal(result.handoffPending, true);
  assert.equal(result.historicalStopIntent, true);
  assert.equal(writes, 1);
});

test("restart revalidation consumes validated record inventory, not publication companions", () => {
  const verifierEnd = source.indexOf(
    "export function persistRuntimeOwnedDockerRestartPhase(",
    end,
  );
  assert.ok(verifierEnd > end);
  const verifierBody = stripTypeScriptTypes(
    source.slice(end, verifierEnd).replace("export function", "function"),
  );
  const hash = "a".repeat(64);
  const token = `docker-task.${hash}.${hash}.${hash}`;
  const capability = {};
  const directory = path.resolve("fixture-root", `docker-task-${hash}`);
  const record = {
    closed: false,
    persistenceFailed: false,
    locks: [{ assertLive: () => true }],
    root: { rootPath: path.dirname(directory) },
    rootIdentity: "fixed",
    directory,
    directoryIdentity: "fixed",
    submissionName: "submission-create_subscription_auth_probe.json",
    binding: { recoveryId: token, pendingSubmissionSha256: hash },
    continuation: true,
    originRecords: [Buffer.from("origin\n")],
    handoffs: [Buffer.from("handoff\n")],
    records: [],
  };
  const recordNames = [
    record.submissionName,
    "engine-restart-00.json",
    "engine-handoff-00.json",
  ];
  let inventoryReads = 0;
  let isInventoryValid = true;
  const context = {
    Buffer,
    path,
    capability,
    dockerRestartPreparations: new WeakMap([[capability, record]]),
    restartPathIdentity: () => "fixed",
    parseDockerTaskRecoveryId: () => ({
      token,
      operationNonce: hash,
      baseHash: hash,
    }),
    fs: {
      readdirSync: () =>
        recordNames.flatMap((name) => [name, `${name}.crdd-commit.json`]),
    },
    inventoryOperationDirectory: (...args: string[]) => {
      inventoryReads++;
      assert.deepEqual(args, [directory, token, hash, hash]);
      if (!isInventoryValid) throw new Error("invalid durable publication");
      return recordNames;
    },
    inspectDockerRecoveryRootSnapshot: () => ({
      status: "completed",
      dockerRecoveryIds: [token],
    }),
    readExactJson: (name: string) => ({
      hash,
      serialized: name.endsWith("engine-restart-00.json")
        ? "origin\n"
        : "handoff\n",
    }),
  };
  const verify = () =>
    runInNewContext(
      `${verifierBody}\nverifyRuntimeOwnedDockerRestartPreparation(capability);`,
      context,
    );
  assert.equal(verify(), true);
  assert.equal(inventoryReads, 1);
  isInventoryValid = false;
  assert.equal(verify(), false);
  assert.equal(inventoryReads, 2);
});
