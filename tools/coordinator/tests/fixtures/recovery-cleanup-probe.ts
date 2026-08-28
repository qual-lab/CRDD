import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { removeCommittedDockerRecoveryJson } from "../../src/security/docker-recovery-journal.ts";

import {
  beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver,
  completeRuntimeOwnedDockerRecovery,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedNormalMountCompletion,
  recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver,
} from "../../src/security/docker-recovery-runtime-internal.ts";
import {
  cleanupOwnedOperationDirectoriesAsync,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryIdByManagementCapability,
  verifyOwnedOperationManagementCapability,
} from "../../src/security/execution-environment.ts";
import { loadHostRecoveryRecordByToken } from "../../src/security/host-recovery-record.ts";

function verifiedRoot(rootPath: string) {
  return Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "4".repeat(64),
    runtimeStateProtectionHash: "5".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: "f".repeat(64),
  });
}

function plan(operationId: string) {
  return Object.freeze({
    provider: "claude" as const,
    operationId,
    grantRef: "PHMGRANT-123456",
    profileId: "PROFILE-123456",
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: "7".repeat(64),
    authContainerName: "crdd-auth-0123456789abcdef",
    providerContainerName: "crdd-claude-0123456789abcdef",
    proxyContainerName: "crdd-proxy-0123456789abcdef",
    internalNetworkName: "crdd-internal-0123456789abcdef",
    egressNetworkName: "crdd-egress-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    operationMode: "isolated_task" as const,
    workspaceMountMode: "read_write" as const,
  });
}

function home(candidate: ReturnType<typeof plan>) {
  return Object.freeze({
    providerHomeIdentityHash: candidate.providerHomeIdentityHash,
    providerHomeProtectionHash: candidate.providerHomeProtectionHash,
    localUserBindingHash: candidate.localUserBindingHash,
    stableLogicalHomeBindingHash: candidate.stableLogicalHomeBindingHash,
  });
}

function setupBegunRecovery(rootPath: string) {
  const root = verifiedRoot(rootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const hostRecoveryId =
    getOwnedHostRecoveryIdByManagementCapability(management);
  const hostMarker = loadHostRecoveryRecordByToken(hostRecoveryId).marker;
  const candidate = plan(operation.operationId);
  const begun = beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
    candidate,
    management,
    home(candidate),
    root,
    () => root,
  );
  assert.ok(begun && begun.status === "ready");
  assert.equal(recordRuntimeOwnedDockerAbsence(begun.recoveryCapability), true);
  assert.equal(
    recordRuntimeOwnedNormalMountCompletion(begun.recoveryCapability),
    true,
  );
  return Object.freeze({
    root,
    owned,
    management,
    hostMarker,
    recoveryId: begun.recoveryId,
    recoveryCapability: begun.recoveryCapability,
  });
}

function setupRecovery(rootPath: string) {
  const setup = setupBegunRecovery(rootPath);
  assert.equal(
    completeRuntimeOwnedDockerRecovery(
      setup.recoveryCapability,
      setup.management,
    ).status,
    "completed",
  );
  return setup;
}

const [mode, rootPath, encodedRoot] = process.argv.slice(2);
if (!mode || !rootPath) throw new Error("recovery_cleanup_probe_args_invalid");
if (mode === "receipt-failure-setup") {
  const setup = setupRecovery(rootPath);
  assert.equal(
    typeof prepareRuntimeOwnedDockerHostCleanup(setup.recoveryCapability),
    "string",
  );
  await cleanupOwnedOperationDirectoriesAsync(setup.owned);
  process.stdout.write(
    `${JSON.stringify({ recoveryId: setup.recoveryId, root: setup.root, hostRoot: setup.owned.root, hostMarker: setup.hostMarker, setupPid: process.pid })}\n`,
  );
} else if (mode === "active-deleted-pointer-setup") {
  const setup = setupBegunRecovery(rootPath);
  const activePath = fs
    .readdirSync(setup.owned.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.join(setup.owned.root, entry.name, "active-docker-task-v1.json"),
    )
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(activePath);
  assert.equal(removeCommittedDockerRecoveryJson(activePath), true);
  assert.equal(fs.existsSync(activePath), false);
  assert.equal(
    fs.readdirSync(rootPath).some((name) => name.startsWith("active-lease-")),
    true,
  );
  process.stdout.write(
    `${JSON.stringify({ recoveryId: setup.recoveryId, root: setup.root, hostRoot: setup.owned.root, hostMarker: setup.hostMarker, setupPid: process.pid })}\n`,
  );
} else if (mode === "fresh-recovery") {
  if (!encodedRoot) throw new Error("recovery_cleanup_probe_root_missing");
  const root = JSON.parse(
    Buffer.from(encodedRoot, "base64url").toString("utf8"),
  );
  const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
    rootPath,
    root,
    () => root,
  );
  process.stdout.write(
    `${JSON.stringify({ ...result, probePid: process.pid })}\n`,
  );
} else {
  throw new Error("recovery_cleanup_probe_mode_invalid");
}
