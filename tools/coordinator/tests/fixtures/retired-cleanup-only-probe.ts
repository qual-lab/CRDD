import assert from "node:assert/strict";
import fs from "node:fs";

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
  createIsolatedOwnedHostOperationGenerationActivatorCandidate,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  observeOwnedHostOperationGenerationLoss,
  verifyOwnedOperationManagementCapability,
} from "../../src/security/execution-environment.ts";
import { loadHostRecoveryRecordByToken } from "../../src/security/host-recovery-record.ts";

function verifiedRoot(rootPath: string) {
  return Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "4".repeat(64),
    runtimeStateProtectionHash: "5".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: "7".repeat(64),
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
    stableLogicalHomeBindingHash: "f".repeat(64),
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

async function setupRetired(
  rootPath: string,
  outcome: "cleanup_confirmed_failure" | "cleanup_unknown",
) {
  const root = verifiedRoot(rootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  let detect!: () => void;
  let resolveLoss!: (
    value: "cleanup_confirmed_failure" | "cleanup_unknown",
  ) => void;
  const failureDetected = new Promise<void>((resolve) => {
    detect = resolve;
  });
  const loss = new Promise<"cleanup_confirmed_failure" | "cleanup_unknown">(
    (resolve) => {
      resolveLoss = resolve;
    },
  );
  const listeners = new Set<() => void>();
  void failureDetected.then(() => {
    for (const listener of listeners) listener();
  });
  const activator =
    createIsolatedOwnedHostOperationGenerationActivatorCandidate(async () =>
      Object.freeze({
        status: "acquired" as const,
        lock: Object.freeze({
          assertLive: () => true,
          onFailureDetected: (listener: () => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          failureDetected,
          loss,
          confirmReady: async () => "ready" as const,
          release: async () => "released" as const,
        }),
      }),
    );
  assert.equal(await activator.activate(management), "activated");
  const generationLoss = observeOwnedHostOperationGenerationLoss(management);
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
  assert.equal(
    completeRuntimeOwnedDockerRecovery(begun.recoveryCapability, management)
      .status,
    "completed",
  );
  detect();
  resolveLoss(outcome);
  assert.equal(await generationLoss.outcome, outcome);
  return Object.freeze({
    root,
    owned,
    recoveryId: begun.recoveryId,
    recoveryCapability: begun.recoveryCapability,
  });
}

const [mode, rootPath, encodedRoot] = process.argv.slice(2);
if (!mode || !rootPath)
  throw new Error("retired_cleanup_only_probe_args_invalid");
if (mode === "unknown") {
  const setup = await setupRetired(rootPath, "cleanup_unknown");
  const host = loadHostRecoveryRecordByToken(setup.owned.hostRecoveryId);
  const before = fs.readdirSync(rootPath).sort();
  assert.equal(
    prepareRuntimeOwnedDockerHostCleanup(setup.recoveryCapability),
    null,
  );
  assert.deepEqual(fs.readdirSync(rootPath).sort(), before);
  assert.equal(fs.existsSync(setup.owned.root), true);
  fs.rmSync(setup.owned.root, { recursive: true, force: true });
  fs.rmSync(host.marker, { force: true });
  process.stdout.write(`${JSON.stringify({ status: "verified" })}\n`);
} else if (mode === "receipt-failure-setup") {
  const setup = await setupRetired(rootPath, "cleanup_confirmed_failure");
  assert.equal(
    typeof prepareRuntimeOwnedDockerHostCleanup(setup.recoveryCapability),
    "string",
  );
  await cleanupOwnedOperationDirectoriesAsync(setup.owned);
  process.stdout.write(
    `${JSON.stringify({ recoveryId: setup.recoveryId, root: setup.root })}\n`,
  );
} else if (mode === "fresh-recovery") {
  if (!encodedRoot) throw new Error("retired_cleanup_only_probe_root_missing");
  const root = JSON.parse(
    Buffer.from(encodedRoot, "base64url").toString("utf8"),
  );
  const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
    rootPath,
    root,
    () => root,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
} else {
  throw new Error("retired_cleanup_only_probe_mode_invalid");
}
