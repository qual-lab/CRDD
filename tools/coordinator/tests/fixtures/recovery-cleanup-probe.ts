import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { removeCommittedDockerRecoveryJson } from "../../src/security/docker-recovery-journal.ts";

import {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver,
  completeRuntimeOwnedDockerRecovery,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedNormalMountCompletion,
  recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver,
} from "../../src/security/docker-recovery-runtime-internal.ts";
import {
  abandonOwnedHostOperationGenerationLock,
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

async function setupBegunRecovery(rootPath: string) {
  const root = verifiedRoot(rootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  let recoveryCapability: object | null = null;
  try {
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
    recoveryCapability = begun.recoveryCapability;
    assert.equal(recordRuntimeOwnedDockerAbsence(recoveryCapability), true);
    assert.equal(
      recordRuntimeOwnedNormalMountCompletion(recoveryCapability),
      true,
    );
    return Object.freeze({
      root,
      owned,
      management,
      hostMarker,
      hostRecoveryId,
      recoveryId: begun.recoveryId,
      recoveryCapability,
    });
  } catch (error) {
    if (recoveryCapability) {
      try {
        completeRuntimeOwnedDockerRecovery(recoveryCapability, management);
      } catch {
        // Continue exact fixture cleanup below.
      }
      try {
        abandonRuntimeOwnedDockerRecovery(recoveryCapability);
      } catch {
        // Continue exact fixture cleanup below.
      }
    }
    try {
      await abandonOwnedHostOperationGenerationLock(management);
    } catch {
      // Continue exact fixture cleanup below.
    }
    try {
      await cleanupOwnedOperationDirectoriesAsync(owned);
    } catch {
      // The parent test treats any remaining fixture state as a failure.
    }
    throw error;
  }
}

async function setupRecovery(rootPath: string) {
  const setup = await setupBegunRecovery(rootPath);
  try {
    assert.equal(
      completeRuntimeOwnedDockerRecovery(
        setup.recoveryCapability,
        setup.management,
      ).status,
      "completed",
    );
    return setup;
  } catch (error) {
    try {
      abandonRuntimeOwnedDockerRecovery(setup.recoveryCapability);
    } catch {
      // Continue exact fixture cleanup below.
    }
    try {
      await abandonOwnedHostOperationGenerationLock(setup.management);
    } catch {
      // Continue exact fixture cleanup below.
    }
    try {
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        setup.recoveryId,
        setup.root,
        () => setup.root,
      );
    } catch {
      // The parent test treats any remaining fixture state as a failure.
    }
    throw error;
  }
}

async function recoverFailedHandoff(
  setup: Awaited<ReturnType<typeof setupBegunRecovery>>,
) {
  try {
    abandonRuntimeOwnedDockerRecovery(setup.recoveryCapability);
  } catch {
    // Recovery below is the authoritative closure check.
  }
  try {
    await abandonOwnedHostOperationGenerationLock(setup.management);
  } catch {
    // Recovery below is the authoritative closure check.
  }
  const recoveredProcess = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      import.meta.filename,
      "fresh-recovery",
      setup.recoveryId,
      Buffer.from(JSON.stringify(setup.root), "utf8").toString("base64url"),
    ],
    { encoding: "utf8", timeout: 15_000, windowsHide: true },
  );
  if (recoveredProcess.status !== 0)
    throw new Error("recovery_cleanup_probe_recovery_failed");
  const recovered = JSON.parse(recoveredProcess.stdout) as { status?: unknown };
  if (recovered.status !== "recovered")
    throw new Error("recovery_cleanup_probe_recovery_failed");
}

const [mode, rootPath, encodedRoot] = process.argv.slice(2);
if (!mode || !rootPath) throw new Error("recovery_cleanup_probe_args_invalid");
if (mode === "receipt-failure-setup") {
  const setup = await setupRecovery(rootPath);
  let handedOff = false;
  try {
    assert.equal(
      typeof prepareRuntimeOwnedDockerHostCleanup(setup.recoveryCapability),
      "string",
    );
    await cleanupOwnedOperationDirectoriesAsync(setup.owned);
    const handoff = Buffer.from(
      `${JSON.stringify({ recoveryId: setup.recoveryId, root: setup.root, hostRoot: setup.owned.root, hostMarker: setup.hostMarker, hostRecoveryId: setup.hostRecoveryId, setupPid: process.pid })}\n`,
      "utf8",
    );
    assert.equal(fs.writeSync(1, handoff), handoff.byteLength);
    handedOff = true;
  } finally {
    if (!handedOff) await recoverFailedHandoff(setup);
  }
} else if (
  mode === "active-deleted-pointer-setup" ||
  mode === "active-deleted-pointer-handoff-failure"
) {
  const setup = await setupBegunRecovery(rootPath);
  let handedOff = false;
  try {
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
    if (mode === "active-deleted-pointer-handoff-failure")
      throw new Error("fixture_handoff_write_failed");
    const handoff = Buffer.from(
      `${JSON.stringify({ recoveryId: setup.recoveryId, root: setup.root, hostRoot: setup.owned.root, hostMarker: setup.hostMarker, hostRecoveryId: setup.hostRecoveryId, setupPid: process.pid })}\n`,
      "utf8",
    );
    assert.equal(fs.writeSync(1, handoff), handoff.byteLength);
    handedOff = true;
  } finally {
    if (!handedOff) await recoverFailedHandoff(setup);
  }
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
