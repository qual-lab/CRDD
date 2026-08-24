import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  beginOwnedDockerSubmissionRecovery,
  acquireHostOperationRecoveryGenerationByIdentity,
  completeOwnedDockerSubmissionRecovery,
  getOwnedHostRecoveryIdByManagementCapability,
  confirmOwnedDockerAbsenceForRecovery,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "./host-recovery-record.ts";
import {
  acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  acquireRuntimeOwnedLogicalProviderHomeKernelLock,
} from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "./provider-home-windows-adapter.ts";
import {
  dockerRecoveryCommitName,
  discoverDockerRecoveryJournalJson,
  isDockerRecoveryJournalTemporaryName,
  isDockerRecoveryJournalIntentName,
  inspectDockerRecoveryJournalDirectory,
  moveCommittedDockerRecoveryJson,
  readCommittedDockerRecoveryJson,
  removeDockerRecoveryCleanupDirectory,
  removeCommittedDockerRecoveryJson,
  resumeDockerRecoveryJournalDirectory,
  writeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";

export const DOCKER_RECOVERY_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-recovery-runtime";
export const DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION = 4;

const HEX64 = /^[a-f0-9]{64}$/u;
const SAFE_RESOURCE =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;
const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);
const DOCKER_EXECUTABLE =
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const DOCKER_EXECUTABLE_BYTES = 41_631_088;
const DOCKER_EXECUTABLE_SHA256 =
  "C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610";
const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";

type ProductionPlan = Readonly<{
  provider: "codex" | "claude";
  operationId: string;
  grantRef: string;
  profileId: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  operationMode: "boolean_probe" | "isolated_task";
  workspaceMountMode: "read_write" | "read_only" | null;
}>;

type DurableRecord = Readonly<{
  rootPath: string;
  operationDirectory: string;
  pointerPath: string;
  pointerHash: string;
  pointerIdentity: string;
  recoveryId: string;
  baseHash: string;
  baseIdentity: Readonly<{ dev: bigint; ino: bigint; birthtimeNs: bigint }>;
  managementCapability: object;
  operationId: string;
  operationNonce: string;
  stableLogicalHomeBindingHash: string;
  initialHostRecoveryId: string;
  hostActiveBindingPath: string;
  hostRootPath: string;
  hostMarkerPath: string;
  logicalHomeLease: Readonly<{ release: () => boolean }>;
}>;

const durableRecords = new WeakMap<object, DurableRecord>();
const releasedLogicalHomeLeases = new WeakSet<object>();

function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function commitDirectoryMutationBoundary(directory: string) {
  if (process.platform === "win32") {
    // Node.js 24 opens a Windows directory but fsyncSync returns EPERM. The
    // Local Personal v1 contract therefore guarantees process-crash recovery
    // from file-fsynced commit records and stable rereads; it does not claim
    // power-loss durability for directory metadata.
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("docker_recovery_directory_invalid");
    return;
  }
  const handle = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function moveDurableFile(
  source: string,
  target: string,
  expected: Readonly<{
    serialized: string;
    hash: string;
    identity: Readonly<{ dev: bigint; ino: bigint; birthtimeNs: bigint }>;
    identityText: string;
    logicalKey: string;
    target: string;
    commit: string;
    value: unknown;
  }>,
) {
  if (source !== expected.target)
    throw new Error("docker_recovery_record_changed");
  return moveCommittedDockerRecoveryJson(expected, target);
}

function writeDurableJson(
  directory: string,
  name: string,
  value: unknown,
  logicalKey = name,
) {
  const record = writeCommittedDockerRecoveryJson(
    directory,
    name,
    logicalKey,
    value,
  );
  commitDirectoryMutationBoundary(directory);
  return record;
}

function validProductionPlan(plan: ProductionPlan) {
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
    [
      plan.providerHomeIdentityHash,
      plan.providerHomeProtectionHash,
      plan.localUserBindingHash,
      plan.stableLogicalHomeBindingHash,
    ].every((value) => HEX64.test(value)) &&
    [
      plan.authContainerName,
      plan.providerContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].every((value) => SAFE_RESOURCE.test(value)) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(plan.ownershipLabel) &&
    /^sha256:[a-f0-9]{64}$/u.test(plan.providerImageDigest) &&
    /^sha256:[a-f0-9]{64}$/u.test(plan.proxyImageDigest) &&
    (plan.operationMode === "boolean_probe" ||
      plan.operationMode === "isolated_task") &&
    (plan.workspaceMountMode === null ||
      plan.workspaceMountMode === "read_write" ||
      plan.workspaceMountMode === "read_only")
  );
}

function expectedHostSuccessor(currentToken: string, nextState: string) {
  const loaded = loadHostRecoveryRecordByToken(currentToken);
  const serialized = canonical({ ...loaded.record, state: nextState });
  const hash = createHash("sha256").update(serialized).digest("hex");
  return Object.freeze({
    currentToken,
    expectedToken: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${hash}`,
    rootName: loaded.parsed.rootName,
    nonce: loaded.parsed.nonce,
    currentState: loaded.record.state,
    nextState,
  });
}

function hostRecoveryIdentity(token: string) {
  const loaded = loadHostRecoveryRecordByToken(token);
  const directory = fs.lstatSync(loaded.directory, { bigint: true });
  const marker = fs.lstatSync(loaded.marker, { bigint: true });
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    !marker.isFile() ||
    marker.isSymbolicLink()
  )
    throw new Error("docker_recovery_host_identity_invalid");
  return Object.freeze({
    token,
    recordHash: loaded.parsed.recordHash,
    directoryIdentity: `${directory.dev}:${directory.ino}:${directory.birthtimeNs}`,
    markerIdentity: `${marker.dev}:${marker.ino}:${marker.birthtimeNs}`,
    record: loaded.record,
  });
}

function classifyHostMarkerTransition(
  intent: Record<string, unknown>,
  expectedRoot: string,
  expectedNonce: string,
) {
  const currentToken = String(intent.currentToken ?? "");
  const expectedToken = String(intent.expectedToken ?? "");
  const current = parseHostRecoveryToken(currentToken);
  const expected = parseHostRecoveryToken(expectedToken);
  if (
    current.rootName !== path.basename(expectedRoot) ||
    expected.rootName !== current.rootName ||
    current.nonce !== expectedNonce ||
    expected.nonce !== expectedNonce
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  try {
    const loaded = loadHostRecoveryRecordByToken(expectedToken);
    if (
      path.join(loaded.parent, loaded.parsed.rootName) !== expectedRoot ||
      loaded.marker !== (intent.markerPath ?? loaded.marker)
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    return Object.freeze({
      state: "expected" as const,
      currentToken,
      expectedToken,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "docker_task_recovery_host_transition_mismatch"
    )
      throw error;
  }
  try {
    const loaded = loadHostRecoveryRecordByToken(currentToken);
    if (path.join(loaded.parent, loaded.parsed.rootName) !== expectedRoot)
      throw new Error("docker_task_recovery_host_transition_mismatch");
    return Object.freeze({
      state: "previous" as const,
      currentToken,
      expectedToken,
    });
  } catch {
    throw new Error("docker_task_recovery_host_transition_third_state");
  }
}

function beginProductionRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
) {
  if (
    !validProductionPlan(plan) ||
    !managementCapability ||
    typeof managementCapability !== "object"
  )
    return null;
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== plan.operationId) return null;
  const providerHomeObservation =
    inspectRuntimeOwnedWindowsProviderHomeCandidate(
      plan.provider,
      new Date().toISOString(),
    );
  const providerHome = consumeRuntimeOwnedProviderHomeObservationCapability(
    providerHomeObservation.observationCapability,
  );
  if (
    providerHomeObservation.status !== "candidate" ||
    !providerHome ||
    providerHome.providerHomeIdentityHash !== plan.providerHomeIdentityHash ||
    providerHome.providerHomeProtectionHash !==
      plan.providerHomeProtectionHash ||
    providerHome.localUserBindingHash !== plan.localUserBindingHash ||
    providerHome.stableLogicalHomeBindingHash !==
      plan.stableLogicalHomeBindingHash
  )
    return null;
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    true,
    new Date().toISOString(),
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  if (
    observation.status !== "candidate" ||
    !root ||
    !HEX64.test(root.stableLogicalHomeBindingHash) ||
    root.localUserBindingHash !== plan.localUserBindingHash
  )
    return null;
  const lock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    plan.stableLogicalHomeBindingHash,
  );
  if (!lock) return null;
  const runtimeStateLock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
    root.stableLogicalHomeBindingHash,
  );
  if (!runtimeStateLock) {
    void lock.release();
    return null;
  }
  let leaseTransferred = false;
  let recoverableId: string | null = null;
  try {
    const rootBefore = fs.lstatSync(root.rootPath, { bigint: true });
    const recoveryInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    const rootAfter = fs.lstatSync(root.rootPath, { bigint: true });
    if (
      recoveryInventory.status !== "completed" ||
      rootBefore.dev !== rootAfter.dev ||
      rootBefore.ino !== rootAfter.ino ||
      rootBefore.birthtimeNs !== rootAfter.birthtimeNs ||
      recoveryInventory.activeStableLogicalHomeBindingHashes.some(
        (value: unknown) => value === plan.stableLogicalHomeBindingHash,
      )
    )
      throw new Error("docker_recovery_runtime_state_conflict");
    const operationNonce = randomBytes(32).toString("hex");
    const operationName = `docker-task-${operationNonce}`;
    const operationDirectory = path.join(root.rootPath, operationName);
    const initialHostRecoveryId =
      getOwnedHostRecoveryIdByManagementCapability(managementCapability);
    const initialHostRecovery = hostRecoveryIdentity(initialHostRecoveryId);
    const loadedInitialHost = loadHostRecoveryRecordByToken(
      initialHostRecoveryId,
    );
    const managementName = (
      loadedInitialHost.record.childIdentities as Record<
        string,
        { pathName: string }
      >
    ).management?.pathName;
    if (!managementName)
      throw new Error("docker_recovery_host_identity_invalid");
    const hostActiveBindingPath = path.join(
      loadedInitialHost.parent,
      loadedInitialHost.parsed.rootName,
      managementName,
      "active-docker-task-v1.json",
    );
    const hostBegin = expectedHostSuccessor(
      initialHostRecoveryId,
      "docker_submission_started",
    );
    const base = Object.freeze({
      schema: "crdd-coordinator-task-docker-recovery/v1",
      operationNonce,
      provider: plan.provider,
      operationId: plan.operationId,
      grantRef: plan.grantRef,
      profileId: plan.profileId,
      stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
      providerHomeIdentityHash: plan.providerHomeIdentityHash,
      providerHomeProtectionHash: plan.providerHomeProtectionHash,
      localUserBindingHash: plan.localUserBindingHash,
      ownershipLabel: plan.ownershipLabel,
      resources: Object.freeze({
        auth: plan.authContainerName,
        provider: plan.providerContainerName,
        proxy: plan.proxyContainerName,
        internal: plan.internalNetworkName,
        egress: plan.egressNetworkName,
      }),
      images: Object.freeze({
        provider: plan.providerImageDigest,
        proxy: plan.proxyImageDigest,
      }),
      operationMode: plan.operationMode,
      workspaceMountMode: plan.workspaceMountMode,
      initialHostRecoveryId,
      initialHostRecovery,
      hostPaths: Object.freeze({
        root: path.join(
          loadedInitialHost.parent,
          loadedInitialHost.parsed.rootName,
        ),
        marker: loadedInitialHost.marker,
      }),
    });
    const pendingBase = writeDurableJson(
      root.rootPath,
      `pending-docker-task-${operationNonce}.json`,
      base,
      "base.json",
    );
    const recoveryId = `docker-task.${plan.stableLogicalHomeBindingHash}.${operationNonce}.${pendingBase.hash}`;
    const pendingCommit = writeDurableJson(
      root.rootPath,
      `pending-docker-task-${operationNonce}.commit.json`,
      Object.freeze({
        schema: "crdd-coordinator-task-docker-base-commit/v1",
        operationNonce,
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        baseHash: pendingBase.hash,
        recoveryId,
      }),
      "base-commit.json",
    );
    recoverableId = recoveryId;
    fs.mkdirSync(operationDirectory, { mode: 0o700 });
    const operationMetadata = fs.lstatSync(operationDirectory);
    if (!operationMetadata.isDirectory() || operationMetadata.isSymbolicLink())
      throw new Error("docker_recovery_operation_directory_invalid");
    const baseFile = moveDurableFile(
      pendingBase.target,
      path.join(operationDirectory, "base.json"),
      pendingBase,
    );
    moveDurableFile(
      pendingCommit.target,
      path.join(operationDirectory, "base-commit.json"),
      pendingCommit,
    );
    writeDurableJson(operationDirectory, "host-begin-intent.json", hostBegin);
    const pointerPath = path.join(
      root.rootPath,
      `active-lease-${plan.stableLogicalHomeBindingHash}.json`,
    );
    const pointer = writeDurableJson(
      root.rootPath,
      path.basename(pointerPath),
      Object.freeze({
        schema: "crdd-coordinator-provider-home-active-lease/v1",
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        operationName,
        recoveryId,
        baseHash: baseFile.hash,
      }),
    );
    if (pointer.target !== pointerPath)
      throw new Error("docker_recovery_pointer_invalid");
    writeDurableJson(
      path.dirname(hostActiveBindingPath),
      path.basename(hostActiveBindingPath),
      Object.freeze({
        schema: "crdd-coordinator-host-active-docker-task/v1",
        recoveryId,
        baseHash: baseFile.hash,
        operationNonce,
      }),
    );
    const startedHostRecoveryId = beginOwnedDockerSubmissionRecovery(
      managementCapability,
      operation.operationId,
    );
    if (startedHostRecoveryId !== hostBegin.expectedToken)
      throw new Error("docker_recovery_host_successor_mismatch");
    writeDurableJson(
      operationDirectory,
      "host-begin-receipt.json",
      Object.freeze({
        previous: hostBegin.currentToken,
        observed: startedHostRecoveryId,
      }),
    );
    const recoveryCapability = Object.freeze({});
    durableRecords.set(
      recoveryCapability,
      Object.freeze({
        rootPath: root.rootPath,
        operationDirectory,
        pointerPath,
        pointerHash: pointer.hash,
        pointerIdentity: `${pointer.identity.dev}:${pointer.identity.ino}:${pointer.identity.birthtimeNs}`,
        recoveryId,
        baseHash: baseFile.hash,
        baseIdentity: baseFile.identity,
        managementCapability,
        operationId: operation.operationId,
        operationNonce,
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        initialHostRecoveryId,
        hostActiveBindingPath,
        hostRootPath: path.join(
          loadedInitialHost.parent,
          loadedInitialHost.parsed.rootName,
        ),
        hostMarkerPath: loadedInitialHost.marker,
        logicalHomeLease: lock,
      }),
    );
    leaseTransferred = true;
    return Object.freeze({
      status: "ready" as const,
      recoveryId,
      recoveryCapability,
    });
  } catch {
    return recoverableId
      ? Object.freeze({
          status: "blocked" as const,
          recoveryId: recoverableId,
        })
      : Object.freeze({
          status: "blocked" as const,
          recoveryId: null,
          manualRecoveryRequired: true as const,
        });
  } finally {
    void runtimeStateLock.release();
    if (!leaseTransferred) void lock.release();
  }
}

function durableRecord(capability: unknown) {
  return capability && typeof capability === "object"
    ? (durableRecords.get(capability) ?? null)
    : null;
}

export function markRuntimeOwnedDockerResourceSubmission(
  recoveryCapability: unknown,
  purpose: unknown,
) {
  try {
    const record = durableRecord(recoveryCapability);
    if (!record || typeof purpose !== "string" || !CREATE_PURPOSES.has(purpose))
      return false;
    writeDurableJson(
      record.operationDirectory,
      `submission-${purpose}.json`,
      Object.freeze({
        schema: "crdd-coordinator-docker-resource-submission/v1",
        purpose,
        recoveryId: record.recoveryId,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function recordRuntimeOwnedDockerResourceReceipt(
  recoveryCapability: unknown,
  purpose: unknown,
  rawDockerId: unknown,
) {
  try {
    const record = durableRecord(recoveryCapability);
    const dockerId = typeof rawDockerId === "string" ? rawDockerId.trim() : "";
    if (
      !record ||
      typeof purpose !== "string" ||
      !CREATE_PURPOSES.has(purpose) ||
      !HEX64.test(dockerId) ||
      !validateOperationRecord(
        `submission-${purpose}.json`,
        readExactJson(
          path.join(record.operationDirectory, `submission-${purpose}.json`),
        ).value,
        record.recoveryId,
        record.operationNonce,
        record.baseHash,
      )
    )
      return false;
    writeDurableJson(
      record.operationDirectory,
      `receipt-${purpose}.json`,
      Object.freeze({
        schema: "crdd-coordinator-docker-resource-receipt/v1",
        purpose,
        dockerId,
        recoveryId: record.recoveryId,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function inspectRuntimeOwnedDockerResourceReceipts(
  recoveryCapability: unknown,
) {
  try {
    const record = durableRecord(recoveryCapability);
    if (!record) return null;
    const resources: Record<
      string,
      Readonly<{ submitted: boolean; dockerId: string | null }>
    > = {};
    for (const purpose of CREATE_PURPOSES) {
      const submission = path.join(
        record.operationDirectory,
        `submission-${purpose}.json`,
      );
      const receipt = path.join(
        record.operationDirectory,
        `receipt-${purpose}.json`,
      );
      const submitted = fs.existsSync(submission);
      if (
        submitted &&
        !validateOperationRecord(
          `submission-${purpose}.json`,
          readExactJson(submission).value,
          record.recoveryId,
          record.operationNonce,
          record.baseHash,
        )
      )
        return null;
      if (!submitted && fs.existsSync(receipt)) return null;
      let dockerId: string | null = null;
      if (fs.existsSync(receipt)) {
        const value = readExactJson(receipt).value;
        if (
          !validateOperationRecord(
            `receipt-${purpose}.json`,
            value,
            record.recoveryId,
            record.operationNonce,
            record.baseHash,
          )
        )
          return null;
        dockerId = (value as Record<string, unknown>).dockerId as string;
      }
      resources[purpose] = Object.freeze({ submitted, dockerId });
    }
    return Object.freeze(resources);
  } catch {
    return null;
  }
}

export function recordRuntimeOwnedDockerAbsence(recoveryCapability: unknown) {
  try {
    const record = durableRecord(recoveryCapability);
    if (!record) return false;
    writeDurableJson(
      record.operationDirectory,
      "docker-absence.json",
      Object.freeze({
        schema: "crdd-coordinator-docker-absence/v1",
        recoveryId: record.recoveryId,
        allExactResourcesAbsent: true,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function recordRuntimeOwnedNormalMountCompletion(
  recoveryCapability: unknown,
) {
  try {
    const record = durableRecord(recoveryCapability);
    if (!record) return false;
    writeDurableJson(
      record.operationDirectory,
      "mount-completion.json",
      Object.freeze({
        schema: "crdd-coordinator-provider-home-mount-completion/v1",
        recoveryId: record.recoveryId,
        evidence: "process_local_capability_completed",
      }),
    );
    return true;
  } catch {
    return false;
  }
}

function completeProductionRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || record.managementCapability !== managementCapability)
    return Object.freeze({ status: "blocked" as const });
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== record.operationId)
    return Object.freeze({ status: "blocked" as const });
  if (
    !fs.existsSync(
      path.join(record.operationDirectory, "docker-absence.json"),
    ) ||
    !fs.existsSync(
      path.join(record.operationDirectory, "mount-completion.json"),
    )
  )
    return Object.freeze({ status: "blocked" as const });
  try {
    const current =
      getOwnedHostRecoveryIdByManagementCapability(managementCapability);
    const hostComplete = expectedHostSuccessor(current, "host_only");
    if (hostComplete.currentState !== "docker_submission_started")
      return Object.freeze({ status: "blocked" as const });
    writeDurableJson(
      record.operationDirectory,
      "host-complete-intent.json",
      hostComplete,
    );
    const successor = completeOwnedDockerSubmissionRecovery(
      managementCapability,
      current,
    );
    if (successor !== hostComplete.expectedToken)
      return Object.freeze({ status: "blocked" as const });
    writeDurableJson(
      record.operationDirectory,
      "host-complete-receipt.json",
      Object.freeze({ previous: current, observed: successor }),
    );
    const activeHostBinding = readExactJson(record.hostActiveBindingPath)
      .value as Record<string, unknown>;
    if (
      activeHostBinding.schema !==
        "crdd-coordinator-host-active-docker-task/v1" ||
      activeHostBinding.recoveryId !== record.recoveryId ||
      activeHostBinding.baseHash !== record.baseHash
    )
      return Object.freeze({ status: "blocked" as const });
    if (!removeCommittedDockerRecoveryJson(record.hostActiveBindingPath))
      return Object.freeze({ status: "blocked" as const });
    if (fs.existsSync(record.hostActiveBindingPath))
      return Object.freeze({ status: "blocked" as const });
    const pointer = readExactJson(record.pointerPath);
    const pointerValue = pointer.value as Record<string, unknown>;
    if (
      pointer.hash !== record.pointerHash ||
      pointer.identity !== record.pointerIdentity ||
      pointerValue.schema !==
        "crdd-coordinator-provider-home-active-lease/v1" ||
      pointerValue.recoveryId !== record.recoveryId ||
      pointerValue.baseHash !== record.baseHash
    )
      return Object.freeze({ status: "blocked" as const });
    if (!removeCommittedDockerRecoveryJson(record.pointerPath))
      return Object.freeze({ status: "blocked" as const });
    commitDirectoryMutationBoundary(record.rootPath);
    if (!record.logicalHomeLease.release())
      return Object.freeze({ status: "blocked" as const });
    releasedLogicalHomeLeases.add(recoveryCapability as object);
    writeDurableJson(
      record.operationDirectory,
      "lease-release-receipt.json",
      Object.freeze({
        schema: "crdd-coordinator-provider-home-lease-release/v1",
        recoveryId: record.recoveryId,
        pointerAbsent: !fs.existsSync(record.pointerPath),
      }),
    );
    writeDurableJson(
      record.operationDirectory,
      "normal-run-complete.json",
      Object.freeze({
        schema: "crdd-coordinator-docker-run-completion/v1",
        recoveryId: record.recoveryId,
        hostSuccessor: successor,
      }),
    );
    return Object.freeze({
      status: "completed" as const,
      recoveryFinalizationCapability: recoveryCapability as object,
    });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

export function finalizeRuntimeOwnedDockerRecovery(
  recoveryFinalizationCapability: unknown,
) {
  try {
    const record = durableRecord(recoveryFinalizationCapability);
    if (
      !record ||
      fs.existsSync(record.pointerPath) ||
      !fs.existsSync(
        path.join(record.operationDirectory, "host-cleanup-receipt.json"),
      )
    )
      return Object.freeze({ status: "blocked" as const });
    const parsed = parseDockerTaskRecoveryId(record.recoveryId);
    if (!parsed) return Object.freeze({ status: "blocked" as const });
    removeRecoveryOperationDirectory(
      record.operationDirectory,
      record.recoveryId,
      parsed.operationNonce,
      record.baseHash,
      record.stableLogicalHomeBindingHash,
    );
    commitDirectoryMutationBoundary(record.rootPath);
    durableRecords.delete(recoveryFinalizationCapability as object);
    return Object.freeze({ status: "completed" as const });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

export function prepareRuntimeOwnedDockerHostCleanup(
  recoveryFinalizationCapability: unknown,
) {
  try {
    const record = durableRecord(recoveryFinalizationCapability);
    if (
      !record ||
      !fs.existsSync(
        path.join(record.operationDirectory, "normal-run-complete.json"),
      )
    )
      return null;
    const currentHostRecoveryId = getOwnedHostRecoveryIdByManagementCapability(
      record.managementCapability,
    );
    const intentPath = path.join(
      record.operationDirectory,
      "host-cleanup-intent.json",
    );
    if (fs.existsSync(intentPath)) {
      const intent = readExactJson(intentPath).value as Record<string, unknown>;
      if (
        intent.schema !== "crdd-coordinator-host-cleanup-intent/v1" ||
        intent.recoveryId !== record.recoveryId ||
        intent.currentHostRecoveryId !== currentHostRecoveryId
      )
        return null;
    } else {
      writeDurableJson(
        record.operationDirectory,
        "host-cleanup-intent.json",
        Object.freeze({
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: record.recoveryId,
          currentHostRecoveryId,
        }),
      );
    }
    return currentHostRecoveryId;
  } catch {
    return null;
  }
}

export function recordRuntimeOwnedDockerHostCleanupReceipt(
  recoveryFinalizationCapability: unknown,
) {
  try {
    const record = durableRecord(recoveryFinalizationCapability);
    if (
      !record ||
      !fs.existsSync(
        path.join(record.operationDirectory, "host-cleanup-intent.json"),
      ) ||
      fs.existsSync(record.hostRootPath) ||
      fs.existsSync(record.hostMarkerPath)
    )
      return false;
    const receiptPath = path.join(
      record.operationDirectory,
      "host-cleanup-receipt.json",
    );
    if (fs.existsSync(receiptPath)) {
      const receipt = readExactJson(receiptPath).value as Record<
        string,
        unknown
      >;
      return (
        receipt.schema === "crdd-coordinator-host-cleanup-receipt/v1" &&
        receipt.recoveryId === record.recoveryId &&
        receipt.hostRootAbsent === true &&
        receipt.hostMarkerAbsent === true
      );
    }
    writeDurableJson(
      record.operationDirectory,
      "host-cleanup-receipt.json",
      Object.freeze({
        schema: "crdd-coordinator-host-cleanup-receipt/v1",
        recoveryId: record.recoveryId,
        hostRootAbsent: true,
        hostMarkerAbsent: true,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function abandonRuntimeOwnedDockerRecovery(recoveryCapability: unknown) {
  const record = durableRecord(recoveryCapability);
  if (!record) return false;
  if (releasedLogicalHomeLeases.has(recoveryCapability as object)) return true;
  const released = record.logicalHomeLease.release();
  if (released) releasedLogicalHomeLeases.add(recoveryCapability as object);
  return released;
}

function parseDockerTaskRecoveryId(token: unknown) {
  if (typeof token !== "string") return null;
  const match =
    /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u.exec(
      token,
    );
  return match?.[1] && match[2] && match[3]
    ? Object.freeze({
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      })
    : null;
}

function readExactJson(file: string, logicalKey = path.basename(file)) {
  const record = readCommittedDockerRecoveryJson(file, logicalKey);
  return Object.freeze({
    ...record,
    identity: record.identityText,
  });
}

function exactRecordKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

const OPERATION_RECORD_NAME =
  /^(?:base|base-commit|host-(?:begin|complete|crash-absence|cleanup)-(?:intent|receipt)|submission-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|receipt-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|docker-absence(?:-crash)?|mount-(?:completion|crash-absence)|lease-release-receipt|normal-run-complete)\.json$/u;

function validateHostSnapshot(value: unknown, initialToken: string) {
  if (
    !exactRecordKeys(value, [
      "token",
      "recordHash",
      "directoryIdentity",
      "markerIdentity",
      "record",
    ])
  )
    return false;
  const snapshot = value as Record<string, unknown>;
  const parsed = parseHostRecoveryToken(initialToken);
  const record = snapshot.record;
  const hostRecord = record as Record<string, unknown>;
  const rootIdentity = hostRecord?.rootIdentity;
  const childIdentities = hostRecord?.childIdentities;
  const identityValid = (identity: unknown, isChild: boolean) =>
    exactRecordKeys(
      identity,
      isChild
        ? ["pathName", "dev", "ino", "birthtimeNs"]
        : ["dev", "ino", "birthtimeNs"],
    ) &&
    ["dev", "ino", "birthtimeNs"].every(
      (key) =>
        typeof (identity as Record<string, unknown>)[key] === "string" &&
        /^\d+$/u.test(String((identity as Record<string, unknown>)[key])),
    ) &&
    (!isChild ||
      (typeof (identity as Record<string, unknown>).pathName === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/u.test(
          String((identity as Record<string, unknown>).pathName),
        )));
  return (
    snapshot.token === initialToken &&
    snapshot.recordHash === parsed.recordHash &&
    typeof snapshot.directoryIdentity === "string" &&
    /^\d+:\d+:\d+$/u.test(snapshot.directoryIdentity) &&
    typeof snapshot.markerIdentity === "string" &&
    /^\d+:\d+:\d+$/u.test(snapshot.markerIdentity) &&
    exactRecordKeys(record, [
      "schema",
      "state",
      "rootName",
      "rootIdentity",
      "childIdentities",
      "createdAt",
    ]) &&
    hostRecord.schema === "crdd-coordinator-host-recovery/v1" &&
    hostRecord.rootName === parsed.rootName &&
    ["host_only", "docker_submission_started"].includes(
      String(hostRecord.state),
    ) &&
    typeof hostRecord.createdAt === "string" &&
    identityValid(rootIdentity, false) &&
    childIdentities !== null &&
    typeof childIdentities === "object" &&
    !Array.isArray(childIdentities) &&
    Object.keys(childIdentities as Record<string, unknown>).length <= 8 &&
    Object.values(childIdentities as Record<string, unknown>).every(
      (identity) => identityValid(identity, true),
    ) &&
    Object.hasOwn(childIdentities as Record<string, unknown>, "management")
  );
}

function validateDockerRecoveryBase(value: unknown, nonce: string) {
  if (
    !exactRecordKeys(value, [
      "schema",
      "operationNonce",
      "provider",
      "operationId",
      "grantRef",
      "profileId",
      "stableLogicalHomeBindingHash",
      "providerHomeIdentityHash",
      "providerHomeProtectionHash",
      "localUserBindingHash",
      "ownershipLabel",
      "resources",
      "images",
      "operationMode",
      "workspaceMountMode",
      "initialHostRecoveryId",
      "initialHostRecovery",
      "hostPaths",
    ])
  )
    return false;
  const base = value as Record<string, unknown>;
  const resources = base.resources;
  const images = base.images;
  const hostPaths = base.hostPaths;
  const initialToken = String(base.initialHostRecoveryId ?? "");
  try {
    parseHostRecoveryToken(initialToken);
  } catch {
    return false;
  }
  return (
    base.schema === "crdd-coordinator-task-docker-recovery/v1" &&
    base.operationNonce === nonce &&
    (base.provider === "codex" || base.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(String(base.operationId ?? "")) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(String(base.grantRef ?? "")) &&
    /^PROFILE-[0-9]{6,}$/u.test(String(base.profileId ?? "")) &&
    [
      base.stableLogicalHomeBindingHash,
      base.providerHomeIdentityHash,
      base.providerHomeProtectionHash,
      base.localUserBindingHash,
    ].every((item) => typeof item === "string" && HEX64.test(item)) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
      String(base.ownershipLabel ?? ""),
    ) &&
    exactRecordKeys(resources, [
      "auth",
      "provider",
      "proxy",
      "internal",
      "egress",
    ]) &&
    Object.values(resources as Record<string, unknown>).every(
      (item) => typeof item === "string" && SAFE_RESOURCE.test(item),
    ) &&
    exactRecordKeys(images, ["provider", "proxy"]) &&
    Object.values(images as Record<string, unknown>).every(
      (item) => typeof item === "string" && /^sha256:[a-f0-9]{64}$/u.test(item),
    ) &&
    (base.operationMode === "boolean_probe" ||
      base.operationMode === "isolated_task") &&
    (base.workspaceMountMode === null ||
      base.workspaceMountMode === "read_only" ||
      base.workspaceMountMode === "read_write") &&
    validateHostSnapshot(base.initialHostRecovery, initialToken) &&
    exactRecordKeys(hostPaths, ["root", "marker"]) &&
    typeof (hostPaths as Record<string, unknown>).root === "string" &&
    typeof (hostPaths as Record<string, unknown>).marker === "string"
  );
}

function validateOperationRecord(
  name: string,
  value: unknown,
  recoveryId: string,
  nonce: string,
  baseHash: string,
) {
  if (name === "base.json") return validateDockerRecoveryBase(value, nonce);
  if (name === "base-commit.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "operationNonce",
        "stableLogicalHomeBindingHash",
        "baseHash",
        "recoveryId",
      ]) &&
      (value as Record<string, unknown>).schema ===
        "crdd-coordinator-task-docker-base-commit/v1" &&
      (value as Record<string, unknown>).operationNonce === nonce &&
      (value as Record<string, unknown>).baseHash === baseHash &&
      (value as Record<string, unknown>).recoveryId === recoveryId
    );
  if (/^submission-/u.test(name))
    return (
      exactRecordKeys(value, ["schema", "purpose", "recoveryId"]) &&
      (value as Record<string, unknown>).schema ===
        "crdd-coordinator-docker-resource-submission/v1" &&
      (value as Record<string, unknown>).recoveryId === recoveryId &&
      CREATE_PURPOSES.has(String((value as Record<string, unknown>).purpose)) &&
      name ===
        `submission-${String((value as Record<string, unknown>).purpose)}.json`
    );
  if (/^receipt-/u.test(name))
    return (
      exactRecordKeys(value, ["schema", "purpose", "dockerId", "recoveryId"]) &&
      (value as Record<string, unknown>).schema ===
        "crdd-coordinator-docker-resource-receipt/v1" &&
      (value as Record<string, unknown>).recoveryId === recoveryId &&
      CREATE_PURPOSES.has(String((value as Record<string, unknown>).purpose)) &&
      name ===
        `receipt-${String((value as Record<string, unknown>).purpose)}.json` &&
      HEX64.test(String((value as Record<string, unknown>).dockerId))
    );
  const record = value as Record<string, unknown>;
  if (name === "docker-absence.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "allExactResourcesAbsent",
      ]) &&
      record.schema === "crdd-coordinator-docker-absence/v1" &&
      record.recoveryId === recoveryId &&
      record.allExactResourcesAbsent === true
    );
  if (name === "docker-absence-crash.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "allExactResourcesAbsent",
        "evidence",
      ]) &&
      record.schema === "crdd-coordinator-docker-absence/v1" &&
      record.recoveryId === recoveryId &&
      record.allExactResourcesAbsent === true &&
      record.evidence === "crash_recovery_exact_id_and_configuration"
    );
  if (name === "mount-completion.json" || name === "mount-crash-absence.json")
    return (
      exactRecordKeys(value, ["schema", "recoveryId", "evidence"]) &&
      record.schema === "crdd-coordinator-provider-home-mount-completion/v1" &&
      record.recoveryId === recoveryId &&
      record.evidence ===
        (name === "mount-completion.json"
          ? "process_local_capability_completed"
          : "process_generation_absent_plus_exact_docker_absent")
    );
  if (/^host-(?:begin|complete|crash-absence)-intent\.json$/u.test(name))
    return (
      exactRecordKeys(value, [
        "currentToken",
        "expectedToken",
        "rootName",
        "nonce",
        "currentState",
        "nextState",
      ]) &&
      typeof record.currentToken === "string" &&
      typeof record.expectedToken === "string" &&
      typeof record.rootName === "string" &&
      typeof record.nonce === "string"
    );
  if (/^host-(?:begin|complete|crash-absence)-receipt\.json$/u.test(name))
    return (
      exactRecordKeys(value, ["previous", "observed"]) &&
      typeof record.previous === "string" &&
      typeof record.observed === "string"
    );
  if (name === "host-cleanup-intent.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "currentHostRecoveryId",
      ]) &&
      record.schema === "crdd-coordinator-host-cleanup-intent/v1" &&
      record.recoveryId === recoveryId &&
      typeof record.currentHostRecoveryId === "string"
    );
  if (name === "host-cleanup-receipt.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "hostRootAbsent",
        "hostMarkerAbsent",
      ]) &&
      record.schema === "crdd-coordinator-host-cleanup-receipt/v1" &&
      record.recoveryId === recoveryId &&
      record.hostRootAbsent === true &&
      record.hostMarkerAbsent === true
    );
  if (name === "lease-release-receipt.json")
    return (
      exactRecordKeys(value, ["schema", "recoveryId", "pointerAbsent"]) &&
      record.schema === "crdd-coordinator-provider-home-lease-release/v1" &&
      record.recoveryId === recoveryId &&
      record.pointerAbsent === true
    );
  if (name === "normal-run-complete.json")
    return (
      exactRecordKeys(value, ["schema", "recoveryId", "hostSuccessor"]) &&
      record.schema === "crdd-coordinator-docker-run-completion/v1" &&
      record.recoveryId === recoveryId &&
      typeof record.hostSuccessor === "string"
    );
  return false;
}

function inventoryOperationDirectory(
  operationDirectory: string,
  recoveryId: string,
  nonce: string,
  baseHash: string,
) {
  const entries = fs.readdirSync(operationDirectory, { withFileTypes: true });
  if (entries.length > 96)
    throw new Error("docker_task_recovery_operation_entry_limit_exceeded");
  const names = new Set(entries.map((entry) => entry.name));
  const dataNames: string[] = [];
  for (const entry of entries) {
    const target = path.join(operationDirectory, entry.name);
    if (entry.name === "recovery-docker-cli-config") {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0
      )
        throw new Error("docker_task_recovery_config_untrusted");
      continue;
    }
    if (isDockerRecoveryJournalTemporaryName(entry.name))
      throw new Error("docker_task_recovery_orphan_temporary");
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error("docker_task_recovery_unknown_entry");
    if (entry.name.endsWith(".crdd-commit.json")) {
      const dataName = entry.name.slice(0, -".crdd-commit.json".length);
      if (!names.has(dataName) || !OPERATION_RECORD_NAME.test(dataName))
        throw new Error("docker_task_recovery_orphan_commit");
      continue;
    }
    if (
      !OPERATION_RECORD_NAME.test(entry.name) ||
      !names.has(dockerRecoveryCommitName(entry.name))
    )
      throw new Error("docker_task_recovery_unknown_entry");
    dataNames.push(entry.name);
  }
  for (const name of dataNames) {
    const record = readExactJson(path.join(operationDirectory, name));
    if (
      !validateOperationRecord(name, record.value, recoveryId, nonce, baseHash)
    )
      throw new Error("docker_task_recovery_record_invalid");
  }
  for (const phase of ["begin", "complete", "crash-absence"] as const) {
    const intentName = `host-${phase}-intent.json`;
    const receiptName = `host-${phase}-receipt.json`;
    const hasIntent = dataNames.includes(intentName);
    const hasReceipt = dataNames.includes(receiptName);
    if (hasReceipt && !hasIntent)
      throw new Error("docker_task_recovery_host_transition_mismatch");
    if (!hasIntent) continue;
    const intent = readExactJson(path.join(operationDirectory, intentName))
      .value as Record<string, unknown>;
    const current = parseHostRecoveryToken(String(intent.currentToken ?? ""));
    const expected = parseHostRecoveryToken(String(intent.expectedToken ?? ""));
    const requiredNextState =
      phase === "begin"
        ? "docker_submission_started"
        : phase === "complete"
          ? "host_only"
          : "docker_absent_confirmed";
    if (
      current.rootName !== intent.rootName ||
      expected.rootName !== intent.rootName ||
      current.nonce !== intent.nonce ||
      expected.nonce !== intent.nonce ||
      intent.nextState !== requiredNextState ||
      typeof intent.currentState !== "string" ||
      intent.currentToken === intent.expectedToken
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    if (hasReceipt) {
      const receipt = readExactJson(path.join(operationDirectory, receiptName))
        .value as Record<string, unknown>;
      if (
        receipt.previous !== intent.currentToken ||
        receipt.observed !== intent.expectedToken
      )
        throw new Error("docker_task_recovery_host_transition_mismatch");
    }
  }
  if (
    !dataNames.includes("base.json") ||
    !dataNames.includes("base-commit.json")
  )
    throw new Error("docker_task_recovery_base_invalid");
  return Object.freeze([...dataNames].sort());
}

function ensureHostCleanupReceipt(
  operationDirectory: string,
  recoveryId: string,
  hostPaths: Readonly<{ root: string; marker: string }>,
) {
  if (fs.existsSync(hostPaths.root) || fs.existsSync(hostPaths.marker))
    throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
  const receiptPath = path.join(
    operationDirectory,
    "host-cleanup-receipt.json",
  );
  if (fs.existsSync(receiptPath)) {
    const receipt = readExactJson(receiptPath).value;
    if (
      !exactRecordKeys(receipt, [
        "schema",
        "recoveryId",
        "hostRootAbsent",
        "hostMarkerAbsent",
      ]) ||
      (receipt as Record<string, unknown>).schema !==
        "crdd-coordinator-host-cleanup-receipt/v1" ||
      (receipt as Record<string, unknown>).recoveryId !== recoveryId ||
      (receipt as Record<string, unknown>).hostRootAbsent !== true ||
      (receipt as Record<string, unknown>).hostMarkerAbsent !== true
    )
      throw new Error("docker_task_recovery_host_cleanup_receipt_invalid");
    return;
  }
  writeDurableJson(operationDirectory, "host-cleanup-receipt.json", {
    schema: "crdd-coordinator-host-cleanup-receipt/v1",
    recoveryId,
    hostRootAbsent: true,
    hostMarkerAbsent: true,
  });
}

function safeRecoveryReason(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return /^(?:docker_task|host_recovery)_[a-z0-9_]{1,120}$/u.test(message)
    ? message
    : fallback;
}

function hostPathsFromBase(base: Record<string, unknown>) {
  const paths = base.hostPaths;
  if (
    !exactRecordKeys(paths, ["root", "marker"]) ||
    typeof (paths as Record<string, unknown>).root !== "string" ||
    typeof (paths as Record<string, unknown>).marker !== "string"
  )
    throw new Error("docker_task_recovery_base_mismatch");
  const root = String((paths as Record<string, unknown>).root);
  const marker = String((paths as Record<string, unknown>).marker);
  if (
    !path.isAbsolute(root) ||
    !path.isAbsolute(marker) ||
    !path.basename(root).startsWith("crdd-coordinator-doctor-") ||
    !/^host-[a-f0-9]{64}\.json$/u.test(path.basename(marker))
  )
    throw new Error("docker_task_recovery_base_mismatch");
  return Object.freeze({ root, marker });
}

function managementDirectoryNameFromBase(base: Record<string, unknown>) {
  const snapshot = base.initialHostRecovery as Record<string, unknown>;
  const hostRecord = snapshot?.record as Record<string, unknown>;
  const childIdentities = hostRecord?.childIdentities as Record<
    string,
    unknown
  >;
  const management = childIdentities?.management as Record<string, unknown>;
  const name = management?.pathName;
  if (
    typeof name !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/u.test(name) ||
    path.basename(name) !== name
  )
    throw new Error("docker_task_recovery_base_mismatch");
  return name;
}

function removeRecoveryOperationDirectory(
  operationDirectory: string,
  recoveryId: string,
  nonce: string,
  baseHash: string,
  stableLogicalHomeBindingHash: string,
) {
  inventoryOperationDirectory(operationDirectory, recoveryId, nonce, baseHash);
  const cleanupDirectory = path.join(
    path.dirname(operationDirectory),
    `cleanup-docker-task-${stableLogicalHomeBindingHash}-${nonce}-${baseHash}`,
  );
  if (fs.existsSync(cleanupDirectory))
    throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
  const operationMetadata = fs.lstatSync(operationDirectory, { bigint: true });
  const originalEntries = fs
    .readdirSync(operationDirectory, { withFileTypes: true })
    .map((entry) => {
      const target = path.join(operationDirectory, entry.name);
      const metadata = fs.lstatSync(target, { bigint: true });
      const identity = `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
      if (entry.name === "recovery-docker-cli-config") {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          fs.readdirSync(target).length !== 0
        )
          throw new Error("docker_task_recovery_config_untrusted");
        return Object.freeze({
          name: entry.name,
          type: "empty_directory" as const,
          hash: createHash("sha256").update("").digest("hex"),
          identity,
          bytes: 0,
        });
      }
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error("docker_task_recovery_cleanup_unknown_entry");
      const bytes = fs.readFileSync(target);
      const after = fs.lstatSync(target, { bigint: true });
      if (
        metadata.dev !== after.dev ||
        metadata.ino !== after.ino ||
        metadata.birthtimeNs !== after.birthtimeNs ||
        metadata.size !== after.size
      )
        throw new Error("docker_task_recovery_record_changed");
      return Object.freeze({
        name: entry.name,
        type: "file" as const,
        hash: createHash("sha256").update(bytes).digest("hex"),
        identity,
        bytes: bytes.byteLength,
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  writeDurableJson(operationDirectory, "cleanup-manifest.json", {
    schema: "crdd-coordinator-recovery-cleanup-manifest/v1",
    recoveryId,
    sourceDirectoryIdentity: `${operationMetadata.dev}:${operationMetadata.ino}:${operationMetadata.birthtimeNs}`,
    cleanupName: path.basename(cleanupDirectory),
    originalEntries: Object.freeze(originalEntries),
  });
  verifyRecoveryCleanupManifest(operationDirectory, recoveryId);
  fs.renameSync(operationDirectory, cleanupDirectory);
  commitDirectoryMutationBoundary(path.dirname(operationDirectory));
  verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
  removeDockerRecoveryCleanupDirectory(
    path.dirname(cleanupDirectory),
    cleanupDirectory,
    recoveryId,
  );
}

function verifyRecoveryCleanupManifest(
  cleanupDirectory: string,
  recoveryId: string,
) {
  const manifestRecord = readExactJson(
    path.join(cleanupDirectory, "cleanup-manifest.json"),
  );
  const manifest = manifestRecord.value as Record<string, unknown>;
  if (
    !exactRecordKeys(manifest, [
      "schema",
      "recoveryId",
      "sourceDirectoryIdentity",
      "cleanupName",
      "originalEntries",
    ]) ||
    manifest.schema !== "crdd-coordinator-recovery-cleanup-manifest/v1" ||
    manifest.recoveryId !== recoveryId ||
    typeof manifest.sourceDirectoryIdentity !== "string" ||
    typeof manifest.cleanupName !== "string" ||
    !Array.isArray(manifest.originalEntries) ||
    manifest.originalEntries.length > 96
  )
    throw new Error("docker_task_recovery_cleanup_manifest_invalid");
  const metadata = fs.lstatSync(cleanupDirectory, { bigint: true });
  if (
    `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}` !==
      manifest.sourceDirectoryIdentity ||
    ![
      `docker-task-${parseDockerTaskRecoveryId(recoveryId)?.operationNonce}`,
      manifest.cleanupName,
    ].includes(path.basename(cleanupDirectory))
  )
    throw new Error("docker_task_recovery_cleanup_manifest_invalid");
  const expected = new Map<string, Record<string, unknown>>();
  for (const raw of manifest.originalEntries) {
    if (!exactRecordKeys(raw, ["name", "type", "hash", "identity", "bytes"]))
      throw new Error("docker_task_recovery_cleanup_manifest_invalid");
    const entry = raw as Record<string, unknown>;
    if (
      typeof entry.name !== "string" ||
      path.basename(entry.name) !== entry.name ||
      (entry.type !== "file" && entry.type !== "empty_directory") ||
      typeof entry.hash !== "string" ||
      !HEX64.test(entry.hash) ||
      typeof entry.identity !== "string" ||
      !Number.isSafeInteger(entry.bytes) ||
      expected.has(entry.name)
    )
      throw new Error("docker_task_recovery_cleanup_manifest_invalid");
    expected.set(entry.name, entry);
  }
  const allowed = new Set([
    ...expected.keys(),
    "cleanup-manifest.json",
    dockerRecoveryCommitName("cleanup-manifest.json"),
  ]);
  const observedNames = fs.readdirSync(cleanupDirectory);
  if (
    observedNames.length !== allowed.size ||
    observedNames.some((name) => !allowed.has(name))
  )
    throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
  for (const entry of expected.values()) {
    const target = path.join(cleanupDirectory, String(entry.name));
    const observed = fs.lstatSync(target, { bigint: true });
    if (
      `${observed.dev}:${observed.ino}:${observed.birthtimeNs}` !==
      entry.identity
    )
      throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
    if (entry.type === "empty_directory") {
      if (
        !observed.isDirectory() ||
        observed.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0 ||
        entry.bytes !== 0
      )
        throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
    } else {
      if (!observed.isFile() || observed.isSymbolicLink())
        throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
      const bytes = fs.readFileSync(target);
      if (
        bytes.byteLength !== entry.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== entry.hash
      )
        throw new Error("docker_task_recovery_cleanup_manifest_mismatch");
    }
  }
  return true;
}

function inventoryRecoveryCleanupTombstone(
  cleanupDirectory: string,
  recoveryId: string,
) {
  return verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
}

function removeRecoveryCleanupTombstone(
  cleanupDirectory: string,
  recoveryId: string,
) {
  verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
  return removeDockerRecoveryCleanupDirectory(
    path.dirname(cleanupDirectory),
    cleanupDirectory,
    recoveryId,
  );
}

function hostRecoveryInventoryReady(
  runtimeStateRoot: string,
  hostRoot: string,
  targetOperationDirectory: string,
) {
  const audited = inspectDockerRecoveryRootSnapshot(runtimeStateRoot);
  if (audited.status !== "completed") return false;
  const entries = fs.readdirSync(runtimeStateRoot, { withFileTypes: true });
  if (entries.length > 128) return false;
  for (const entry of entries) {
    if (/^pending-docker-task-[a-f0-9]{64}\.json$/u.test(entry.name)) {
      if (!entry.isFile() || entry.isSymbolicLink()) return false;
      const pendingBase = readExactJson(path.join(runtimeStateRoot, entry.name))
        .value as Record<string, unknown>;
      if (hostPathsFromBase(pendingBase).root === hostRoot) return false;
      continue;
    }
    if (
      !/^docker-task-[a-f0-9]{64}$/u.test(entry.name) ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    )
      continue;
    const directory = path.join(runtimeStateRoot, entry.name);
    const basePath = path.join(directory, "base.json");
    if (!fs.existsSync(basePath)) return false;
    const base = readExactJson(basePath).value as Record<string, unknown>;
    if (hostPathsFromBase(base).root !== hostRoot) continue;
    const normalComplete = fs.existsSync(
      path.join(directory, "normal-run-complete.json"),
    );
    const crashComplete =
      directory === targetOperationDirectory &&
      fs.existsSync(path.join(directory, "docker-absence-crash.json")) &&
      fs.existsSync(path.join(directory, "mount-crash-absence.json"));
    if (!normalComplete && !crashComplete) return false;
    const stable = base.stableLogicalHomeBindingHash;
    if (
      typeof stable !== "string" ||
      !HEX64.test(stable) ||
      fs.existsSync(path.join(runtimeStateRoot, `active-lease-${stable}.json`))
    )
      return false;
  }
  return true;
}

function currentHostRecoveryTokenForInventory(
  runtimeStateRoot: string,
  hostRoot: string,
) {
  const candidates = new Set<string>();
  for (const entry of fs.readdirSync(runtimeStateRoot, {
    withFileTypes: true,
  })) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !/^docker-task-[a-f0-9]{64}$/u.test(entry.name)
    )
      continue;
    const directory = path.join(runtimeStateRoot, entry.name);
    const basePath = path.join(directory, "base.json");
    if (!fs.existsSync(basePath)) continue;
    const base = readExactJson(basePath).value as Record<string, unknown>;
    if (hostPathsFromBase(base).root !== hostRoot) continue;
    for (const [name, key] of [
      ["normal-run-complete.json", "hostSuccessor"],
      ["host-crash-absence-receipt.json", "observed"],
      ["host-complete-receipt.json", "observed"],
      ["host-begin-receipt.json", "observed"],
    ] as const) {
      const file = path.join(directory, name);
      if (!fs.existsSync(file)) continue;
      const value = readExactJson(file).value as Record<string, unknown>;
      if (typeof value[key] === "string") candidates.add(String(value[key]));
    }
  }
  const current = [...candidates].filter((candidate) => {
    try {
      loadHostRecoveryRecordByToken(candidate);
      return true;
    } catch {
      return false;
    }
  });
  return current.length === 1 ? current[0] : null;
}

function verifyRecoveryDockerCli() {
  const metadata = fs.lstatSync(DOCKER_EXECUTABLE);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size !== DOCKER_EXECUTABLE_BYTES ||
    fs.realpathSync(DOCKER_EXECUTABLE) !== DOCKER_EXECUTABLE ||
    createHash("sha256")
      .update(fs.readFileSync(DOCKER_EXECUTABLE))
      .digest("hex")
      .toUpperCase() !== DOCKER_EXECUTABLE_SHA256
  )
    throw new Error("docker_task_recovery_cli_untrusted");
}

function recoveryConfigIdentity(configDirectory: string) {
  const metadata = fs.lstatSync(configDirectory, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync(configDirectory) !== configDirectory ||
    fs.readdirSync(configDirectory).length !== 0
  )
    throw new Error("docker_task_recovery_config_untrusted");
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

function runRecoveryDocker(
  configDirectory: string,
  configIdentity: string,
  argv: readonly string[],
) {
  verifyRecoveryDockerCli();
  if (recoveryConfigIdentity(configDirectory) !== configIdentity)
    throw new Error("docker_task_recovery_config_untrusted");
  const result = spawnSync(
    DOCKER_EXECUTABLE,
    ["--host", DOCKER_ENGINE, "--config", configDirectory, ...argv],
    {
      windowsHide: true,
      shell: false,
      env: {
        SystemRoot: "C:\\Windows",
        WINDIR: "C:\\Windows",
        SystemDrive: "C:",
        DOCKER_CLI_HINTS: "false",
      },
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1_048_576,
    },
  );
  return Object.freeze({
    status: result.status,
    signal: result.signal,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    error: result.error ?? null,
  });
}

function recoverExactDockerResource(
  configDirectory: string,
  configIdentity: string,
  kind: "container" | "network",
  dockerId: string,
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  expectedInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task",
  workspaceMountMode: "read_write" | "read_only" | null,
) {
  const exactNameAbsent = () => {
    const named = runRecoveryDocker(
      configDirectory,
      configIdentity,
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            "--filter",
            `name=^/${expectedName}$`,
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            "--filter",
            `name=^${expectedName}$`,
            "--format",
            "{{.ID}}",
          ],
    );
    return (
      named.status === 0 &&
      !named.signal &&
      !named.error &&
      named.stderr.length === 0 &&
      named.stdout.trim() === ""
    );
  };
  const listArgs =
    kind === "container"
      ? [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ]
      : [
          "network",
          "ls",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ];
  const listed = runRecoveryDocker(configDirectory, configIdentity, listArgs);
  if (
    listed.status !== 0 ||
    listed.signal ||
    listed.error ||
    listed.stderr.length
  )
    return false;
  const ids = listed.stdout.trim() ? listed.stdout.trim().split(/\r?\n/u) : [];
  if (ids.length === 0) return exactNameAbsent();
  if (ids.length !== 1 || ids[0] !== dockerId) return false;
  const inspected = runRecoveryDocker(
    configDirectory,
    configIdentity,
    kind === "container"
      ? ["container", "inspect", dockerId]
      : ["network", "inspect", dockerId],
  );
  if (
    inspected.status !== 0 ||
    inspected.signal ||
    inspected.error ||
    inspected.stderr.length
  )
    return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(inspected.stdout);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) return false;
  const value = parsed[0] as Record<string, unknown>;
  const config = value.Config as Record<string, unknown> | undefined;
  const labels = (kind === "container" ? config?.Labels : value.Labels) as
    | Record<string, unknown>
    | undefined;
  const rawName = value.Name;
  const name =
    kind === "container" &&
    typeof rawName === "string" &&
    rawName.startsWith("/")
      ? rawName.slice(1)
      : rawName;
  const configurationMatches = (() => {
    if (kind === "network")
      return value.Driver === "bridge" && value.Scope === "local";
    const hostConfig = value.HostConfig as Record<string, unknown> | undefined;
    const networkSettings = value.NetworkSettings as
      | Record<string, unknown>
      | undefined;
    const networks = networkSettings?.Networks;
    const networkNames =
      networks && typeof networks === "object" && !Array.isArray(networks)
        ? Object.keys(networks as Record<string, unknown>).sort()
        : [];
    const capDrop = Array.isArray(hostConfig?.CapDrop)
      ? hostConfig.CapDrop.map(String)
      : [];
    const capAdd = hostConfig?.CapAdd;
    const securityOpt = Array.isArray(hostConfig?.SecurityOpt)
      ? hostConfig.SecurityOpt.map(String)
      : [];
    const bindMounts = Array.isArray(value.Mounts)
      ? (value.Mounts as Array<Record<string, unknown>>).filter(
          (mount) => mount.Type === "bind",
        )
      : [];
    const expectedMounts =
      purpose === "create_subscription_auth_probe"
        ? [{ destination: "/provider-home", readWrite: false }]
        : purpose === "create_provider"
          ? [
              { destination: "/provider-home", readWrite: true },
              { destination: "/tmp", readWrite: true },
              ...(operationMode === "isolated_task"
                ? [
                    {
                      destination: "/work",
                      readWrite: workspaceMountMode !== "read_only",
                    },
                  ]
                : []),
            ]
          : [];
    const observedMounts = bindMounts
      .map((mount) => ({
        destination: mount.Destination,
        readWrite: mount.RW,
        propagation: mount.Propagation,
      }))
      .sort((left, right) =>
        String(left.destination).localeCompare(String(right.destination)),
      );
    expectedMounts.sort((left, right) =>
      left.destination.localeCompare(right.destination),
    );
    const mountsMatch =
      observedMounts.length === expectedMounts.length &&
      observedMounts.every(
        (mount, index) =>
          mount.destination === expectedMounts[index]?.destination &&
          mount.readWrite === expectedMounts[index]?.readWrite &&
          mount.propagation === "rprivate",
      );
    const tmpfs = hostConfig?.Tmpfs;
    const proxyTmpfsMatches =
      purpose !== "create_proxy" ||
      (tmpfs !== null &&
        typeof tmpfs === "object" &&
        !Array.isArray(tmpfs) &&
        Object.keys(tmpfs as Record<string, unknown>).length === 1 &&
        typeof (tmpfs as Record<string, unknown>)["/tmp"] === "string" &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes("noexec") &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes("nosuid") &&
        String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
          "size=16777216",
        ));
    return (
      config?.User === "65534:65534" &&
      hostConfig?.ReadonlyRootfs === true &&
      hostConfig?.Privileged === false &&
      capDrop.length === 1 &&
      capDrop[0]?.toUpperCase() === "ALL" &&
      (capAdd === null || (Array.isArray(capAdd) && capAdd.length === 0)) &&
      securityOpt.some((option) => option.startsWith("no-new-privileges")) &&
      hostConfig?.PidsLimit ===
        (purpose === "create_subscription_auth_probe" ? 32 : 64) &&
      networkNames.length === expectedNetworks.length &&
      networkNames.every(
        (networkName, index) =>
          networkName === [...expectedNetworks].sort()[index],
      ) &&
      mountsMatch &&
      proxyTmpfsMatches
    );
  })();
  if (
    value.Id !== dockerId ||
    name !== expectedName ||
    labels?.["crdd.coordinator.runtime"] !== ownershipLabel.split("=")[1] ||
    (kind === "container" && config?.Image !== expectedImage) ||
    (kind === "network" && value.Internal !== expectedInternal) ||
    !configurationMatches
  )
    return false;
  const removed = runRecoveryDocker(
    configDirectory,
    configIdentity,
    kind === "container"
      ? ["container", "rm", "--force", dockerId]
      : ["network", "rm", dockerId],
  );
  if (removed.status !== 0 || removed.signal || removed.error) return false;
  const absent = runRecoveryDocker(configDirectory, configIdentity, listArgs);
  return (
    absent.status === 0 &&
    !absent.signal &&
    !absent.error &&
    absent.stderr.length === 0 &&
    absent.stdout.trim() === "" &&
    exactNameAbsent()
  );
}

function discoverRecoveryHostBinding(
  rootPath: string,
  parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>,
) {
  const operationBase = path.join(
    rootPath,
    `docker-task-${parsed.operationNonce}`,
    "base.json",
  );
  const pendingBase = path.join(
    rootPath,
    `pending-docker-task-${parsed.operationNonce}.json`,
  );
  let record:
    | ReturnType<typeof readCommittedDockerRecoveryJson>
    | ReturnType<typeof discoverDockerRecoveryJournalJson>
    | null = null;
  for (const candidate of [operationBase, pendingBase]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      record = readCommittedDockerRecoveryJson(candidate, "base.json");
      break;
    } catch {
      // A move intent can temporarily split the exact pair. Its fsynced anchor
      // remains the only discovery authority until locks are acquired.
    }
  }
  record ??= discoverDockerRecoveryJournalJson(rootPath, "base.json");
  if (
    !record ||
    record.hash !== parsed.baseHash ||
    !validateDockerRecoveryBase(record.value, parsed.operationNonce)
  )
    throw new Error("docker_task_recovery_base_mismatch");
  const base = record.value as Record<string, unknown>;
  if (base.stableLogicalHomeBindingHash !== parsed.stableLogicalHomeBindingHash)
    throw new Error("docker_task_recovery_base_mismatch");
  const hostPaths = hostPathsFromBase(base);
  const initialHostRecoveryId = String(base.initialHostRecoveryId ?? "");
  const initialHostIdentity = parseHostRecoveryToken(initialHostRecoveryId);
  return Object.freeze({
    hostRoot: hostPaths.root,
    hostNonce: initialHostIdentity.nonce,
  });
}

export function recoverRuntimeOwnedDockerTask(token: unknown) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_id_invalid",
      recoveryId: null,
    });
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    false,
    new Date().toISOString(),
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  if (observation.status !== "candidate" || !root)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_runtime_state_unavailable",
      recoveryId: parsed.token,
    });
  const cleanupDirectoryCandidate = path.join(
    root.rootPath,
    `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
  );
  const cleanupIntentPresent = inspectDockerRecoveryJournalDirectory(
    root.rootPath,
  ).some((intent) => intent.recoveryId === parsed.token);
  let hostOperationGeneration: object | null = null;
  if (!fs.existsSync(cleanupDirectoryCandidate) && !cleanupIntentPresent) {
    try {
      const discovered = discoverRecoveryHostBinding(root.rootPath, parsed);
      hostOperationGeneration =
        acquireHostOperationRecoveryGenerationByIdentity(
          discovered.hostRoot,
          discovered.hostNonce,
        );
    } catch {
      hostOperationGeneration = null;
    }
    if (!hostOperationGeneration)
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_host_operation_generation_active_or_unknown",
        recoveryId: parsed.token,
      });
  }
  const processAbsenceLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    parsed.stableLogicalHomeBindingHash,
  );
  if (!processAbsenceLock) {
    if (hostOperationGeneration)
      void releaseHostOperationRecoveryGeneration(hostOperationGeneration);
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_process_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  }
  const runtimeStateLock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
    root.stableLogicalHomeBindingHash,
  );
  if (!runtimeStateLock) {
    void processAbsenceLock.release();
    if (hostOperationGeneration)
      void releaseHostOperationRecoveryGeneration(hostOperationGeneration);
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_runtime_state_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  }
  try {
    resumeDockerRecoveryJournalDirectory(root.rootPath);
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (
      inventory.status !== "completed" ||
      (!inventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      ) &&
        fs.readdirSync(root.rootPath).length !== 0)
    )
      throw new Error("docker_task_runtime_state_audit_failed");
    if (
      !inventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      ) &&
      fs.readdirSync(root.rootPath).length === 0
    )
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    const operationDirectory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const cleanupDirectory = path.join(
      root.rootPath,
      `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
    );
    if (fs.existsSync(cleanupDirectory)) {
      if (fs.existsSync(operationDirectory))
        throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
      removeRecoveryCleanupTombstone(cleanupDirectory, parsed.token);
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    }
    const operationCleanupManifest = path.join(
      operationDirectory,
      "cleanup-manifest.json",
    );
    if (fs.existsSync(operationCleanupManifest)) {
      verifyRecoveryCleanupManifest(operationDirectory, parsed.token);
      if (fs.existsSync(cleanupDirectory))
        throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
      fs.renameSync(operationDirectory, cleanupDirectory);
      commitDirectoryMutationBoundary(root.rootPath);
      verifyRecoveryCleanupManifest(cleanupDirectory, parsed.token);
      removeDockerRecoveryCleanupDirectory(
        root.rootPath,
        cleanupDirectory,
        parsed.token,
      );
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    }
    const pendingBasePath = path.join(
      root.rootPath,
      `pending-docker-task-${parsed.operationNonce}.json`,
    );
    const pendingCommitPath = path.join(
      root.rootPath,
      `pending-docker-task-${parsed.operationNonce}.commit.json`,
    );
    const basePath = path.join(operationDirectory, "base.json");
    const baseCommitPath = path.join(operationDirectory, "base-commit.json");
    if (!fs.existsSync(basePath)) {
      if (!fs.existsSync(pendingBasePath) || !fs.existsSync(pendingCommitPath))
        throw new Error("docker_task_recovery_base_missing");
      if (!fs.existsSync(operationDirectory))
        fs.mkdirSync(operationDirectory, { mode: 0o700 });
      const operationMetadata = fs.lstatSync(operationDirectory);
      if (
        !operationMetadata.isDirectory() ||
        operationMetadata.isSymbolicLink() ||
        fs.readdirSync(operationDirectory).length !== 0
      )
        throw new Error("docker_task_recovery_operation_invalid");
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingBasePath, "base.json"),
        basePath,
      );
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingCommitPath, "base-commit.json"),
        baseCommitPath,
      );
    } else if (fs.existsSync(pendingBasePath)) {
      throw new Error("docker_task_recovery_duplicate_base");
    }
    if (!fs.existsSync(baseCommitPath)) {
      if (!fs.existsSync(pendingCommitPath))
        throw new Error("docker_task_recovery_base_commit_missing");
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingCommitPath, "base-commit.json"),
        baseCommitPath,
      );
    } else if (fs.existsSync(pendingCommitPath)) {
      throw new Error("docker_task_recovery_duplicate_base_commit");
    }
    const baseFile = readExactJson(basePath);
    if (
      createHash("sha256").update(baseFile.serialized).digest("hex") !==
      parsed.baseHash
    )
      throw new Error("docker_task_recovery_base_mismatch");
    const baseCommit = readExactJson(baseCommitPath).value as Record<
      string,
      unknown
    >;
    if (
      !exactRecordKeys(baseCommit, [
        "schema",
        "operationNonce",
        "stableLogicalHomeBindingHash",
        "baseHash",
        "recoveryId",
      ]) ||
      baseCommit.schema !== "crdd-coordinator-task-docker-base-commit/v1" ||
      baseCommit.operationNonce !== parsed.operationNonce ||
      baseCommit.stableLogicalHomeBindingHash !==
        parsed.stableLogicalHomeBindingHash ||
      baseCommit.baseHash !== parsed.baseHash ||
      baseCommit.recoveryId !== parsed.token
    )
      throw new Error("docker_task_recovery_base_commit_mismatch");
    const base = baseFile.value as Record<string, unknown>;
    if (
      !exactRecordKeys(base, [
        "schema",
        "operationNonce",
        "provider",
        "operationId",
        "grantRef",
        "profileId",
        "stableLogicalHomeBindingHash",
        "providerHomeIdentityHash",
        "providerHomeProtectionHash",
        "localUserBindingHash",
        "ownershipLabel",
        "resources",
        "images",
        "operationMode",
        "workspaceMountMode",
        "initialHostRecoveryId",
        "initialHostRecovery",
        "hostPaths",
      ]) ||
      base.schema !== "crdd-coordinator-task-docker-recovery/v1" ||
      base.operationNonce !== parsed.operationNonce ||
      base.stableLogicalHomeBindingHash !==
        parsed.stableLogicalHomeBindingHash ||
      base.ownershipLabel === undefined
    )
      throw new Error("docker_task_recovery_base_mismatch");
    const resources = base.resources as Record<string, string>;
    const images = base.images as Record<string, string>;
    const operationMode = base.operationMode;
    const workspaceMountMode = base.workspaceMountMode;
    if (
      !resources ||
      !images ||
      !exactRecordKeys(resources, [
        "auth",
        "provider",
        "proxy",
        "internal",
        "egress",
      ]) ||
      !exactRecordKeys(images, ["provider", "proxy"]) ||
      [
        resources.provider,
        resources.auth,
        resources.proxy,
        resources.internal,
        resources.egress,
      ].some(
        (value) => typeof value !== "string" || !SAFE_RESOURCE.test(value),
      ) ||
      !/^sha256:[a-f0-9]{64}$/u.test(images.provider ?? "") ||
      !/^sha256:[a-f0-9]{64}$/u.test(images.proxy ?? "") ||
      (operationMode !== "boolean_probe" &&
        operationMode !== "isolated_task") ||
      (workspaceMountMode !== null &&
        workspaceMountMode !== "read_write" &&
        workspaceMountMode !== "read_only") ||
      !/^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
        String(base.ownershipLabel),
      )
    )
      throw new Error("docker_task_recovery_base_mismatch");
    const hostPaths = hostPathsFromBase(base);
    const managementDirectoryName = managementDirectoryNameFromBase(base);
    const initialHostRecoveryId = String(base.initialHostRecoveryId ?? "");
    const initialHostIdentity = parseHostRecoveryToken(initialHostRecoveryId);
    if (!hostOperationGeneration)
      throw new Error(
        "docker_task_host_operation_generation_active_or_unknown",
      );
    resumeDockerRecoveryJournalDirectory(operationDirectory);
    const hostManagementDirectory = path.join(
      hostPaths.root,
      managementDirectoryName,
    );
    if (fs.existsSync(hostManagementDirectory))
      resumeDockerRecoveryJournalDirectory(hostManagementDirectory);
    inventoryOperationDirectory(
      operationDirectory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
    );
    const normalRunCompletePath = path.join(
      operationDirectory,
      "normal-run-complete.json",
    );
    const hostCompleteIntentPath = path.join(
      operationDirectory,
      "host-complete-intent.json",
    );
    const hostCompleteReceiptPath = path.join(
      operationDirectory,
      "host-complete-receipt.json",
    );
    if (
      !fs.existsSync(hostCompleteReceiptPath) &&
      fs.existsSync(hostCompleteIntentPath)
    ) {
      const intent = readExactJson(hostCompleteIntentPath).value as Record<
        string,
        unknown
      >;
      const transition = classifyHostMarkerTransition(
        intent,
        hostPaths.root,
        initialHostIdentity.nonce,
      );
      if (transition.state === "expected")
        writeDurableJson(operationDirectory, "host-complete-receipt.json", {
          previous: transition.currentToken,
          observed: transition.expectedToken,
        });
    }
    if (
      !fs.existsSync(normalRunCompletePath) &&
      fs.existsSync(hostCompleteReceiptPath)
    ) {
      if (
        !fs.existsSync(path.join(operationDirectory, "docker-absence.json")) ||
        !fs.existsSync(path.join(operationDirectory, "mount-completion.json"))
      )
        throw new Error("docker_task_recovery_normal_evidence_missing");
      const receipt = readExactJson(hostCompleteReceiptPath).value as Record<
        string,
        unknown
      >;
      const observedHostSuccessor = String(receipt.observed ?? "");
      parseHostRecoveryToken(observedHostSuccessor);
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      if (fs.existsSync(activeHostBindingPath)) {
        const active = readExactJson(activeHostBindingPath).value as Record<
          string,
          unknown
        >;
        if (active.recoveryId !== parsed.token)
          throw new Error("docker_task_recovery_active_run_mismatch");
        if (!removeCommittedDockerRecoveryJson(activeHostBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      }
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      if (fs.existsSync(pointerPath)) {
        const pointer = readExactJson(pointerPath).value as Record<
          string,
          unknown
        >;
        if (pointer.recoveryId !== parsed.token)
          throw new Error("docker_task_recovery_pointer_mismatch");
        if (!removeCommittedDockerRecoveryJson(pointerPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
      }
      if (
        !fs.existsSync(
          path.join(operationDirectory, "lease-release-receipt.json"),
        )
      )
        writeDurableJson(operationDirectory, "lease-release-receipt.json", {
          schema: "crdd-coordinator-provider-home-lease-release/v1",
          recoveryId: parsed.token,
          pointerAbsent: true,
        });
      writeDurableJson(operationDirectory, "normal-run-complete.json", {
        schema: "crdd-coordinator-docker-run-completion/v1",
        recoveryId: parsed.token,
        hostSuccessor: observedHostSuccessor,
      });
    }
    if (fs.existsSync(normalRunCompletePath)) {
      const normalRun = readExactJson(normalRunCompletePath).value as Record<
        string,
        unknown
      >;
      const hostSuccessor = String(normalRun.hostSuccessor ?? "");
      const hostIdentity = parseHostRecoveryToken(hostSuccessor);
      if (hostIdentity.nonce !== initialHostIdentity.nonce)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      if (!hostOperationGeneration)
        throw new Error(
          "docker_task_host_operation_generation_active_or_unknown",
        );
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      if (
        fs.existsSync(pointerPath) ||
        fs.existsSync(activeHostBindingPath) ||
        !hostRecoveryInventoryReady(
          root.rootPath,
          hostPaths.root,
          operationDirectory,
        )
      )
        throw new Error("docker_task_recovery_host_inventory_incomplete");
      const cleanupIntentPath = path.join(
        operationDirectory,
        "host-cleanup-intent.json",
      );
      if (!fs.existsSync(cleanupIntentPath))
        writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: parsed.token,
          currentHostRecoveryId: hostSuccessor,
        });
      if (fs.existsSync(hostPaths.root) || fs.existsSync(hostPaths.marker)) {
        const currentHostToken = currentHostRecoveryTokenForInventory(
          root.rootPath,
          hostPaths.root,
        );
        if (!currentHostToken)
          throw new Error("docker_task_recovery_host_lineage_unknown");
        const hostRecovery = recoverOwnedOperationDirectories(
          currentHostToken,
          hostOperationGeneration,
        );
        if (hostRecovery.status !== "recovered")
          throw new Error(hostRecovery.reason);
      }
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
      );
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_finalization_completed",
        recoveryId: null,
      });
    }
    const existingCrashReceiptPath = path.join(
      operationDirectory,
      "host-crash-absence-receipt.json",
    );
    if (fs.existsSync(existingCrashReceiptPath)) {
      const crashReceipt = readExactJson(existingCrashReceiptPath)
        .value as Record<string, unknown>;
      const dockerAbsentHostToken = String(crashReceipt.observed ?? "");
      const hostIdentity = parseHostRecoveryToken(dockerAbsentHostToken);
      if (hostIdentity.nonce !== initialHostIdentity.nonce)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      if (
        !fs.existsSync(
          path.join(operationDirectory, "docker-absence-crash.json"),
        )
      )
        throw new Error("docker_task_recovery_crash_evidence_missing");
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      if (fs.existsSync(activeHostBindingPath)) {
        const active = readExactJson(activeHostBindingPath).value as Record<
          string,
          unknown
        >;
        if (active.recoveryId !== parsed.token)
          throw new Error("docker_task_recovery_active_run_mismatch");
        if (!removeCommittedDockerRecoveryJson(activeHostBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      }
      const mountCrashPath = path.join(
        operationDirectory,
        "mount-crash-absence.json",
      );
      if (!fs.existsSync(mountCrashPath))
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      if (fs.existsSync(pointerPath)) {
        const pointer = readExactJson(pointerPath).value as Record<
          string,
          unknown
        >;
        if (pointer.recoveryId !== parsed.token)
          throw new Error("docker_task_recovery_pointer_mismatch");
        if (!removeCommittedDockerRecoveryJson(pointerPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
      }
      if (
        !hostRecoveryInventoryReady(
          root.rootPath,
          hostPaths.root,
          operationDirectory,
        )
      )
        throw new Error("docker_task_recovery_host_inventory_incomplete");
      if (
        !fs.existsSync(
          path.join(operationDirectory, "host-cleanup-intent.json"),
        )
      )
        writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: parsed.token,
          currentHostRecoveryId: dockerAbsentHostToken,
        });
      if (fs.existsSync(hostPaths.root) || fs.existsSync(hostPaths.marker)) {
        const currentHostToken = currentHostRecoveryTokenForInventory(
          root.rootPath,
          hostPaths.root,
        );
        if (!currentHostToken)
          throw new Error("docker_task_recovery_host_lineage_unknown");
        const recovered = recoverOwnedOperationDirectories(
          currentHostToken,
          hostOperationGeneration,
        );
        if (recovered.status !== "recovered") throw new Error(recovered.reason);
      }
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
      );
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_crash_finalization_completed",
        recoveryId: null,
      });
    }
    const hostBeginIntentPath = path.join(
      operationDirectory,
      "host-begin-intent.json",
    );
    if (!fs.existsSync(hostBeginIntentPath))
      writeDurableJson(
        operationDirectory,
        "host-begin-intent.json",
        expectedHostSuccessor(
          initialHostRecoveryId,
          "docker_submission_started",
        ),
      );
    const hostBeginIntent = readExactJson(hostBeginIntentPath).value as Record<
      string,
      string
    >;
    const hostBeginCurrentToken = hostBeginIntent.currentToken ?? "";
    const hostBeginExpectedToken = hostBeginIntent.expectedToken ?? "";
    parseHostRecoveryToken(hostBeginCurrentToken);
    parseHostRecoveryToken(hostBeginExpectedToken);
    const hostBeginReceiptPath = path.join(
      operationDirectory,
      "host-begin-receipt.json",
    );
    let hostSubmissionStarted = true;
    let hostReceipt: Record<string, string>;
    if (fs.existsSync(hostBeginReceiptPath)) {
      hostReceipt = readExactJson(hostBeginReceiptPath).value as Record<
        string,
        string
      >;
    } else {
      const transition = classifyHostMarkerTransition(
        hostBeginIntent,
        hostPaths.root,
        initialHostIdentity.nonce,
      );
      if (transition.state === "expected") {
        hostReceipt = {
          previous: hostBeginCurrentToken,
          observed: hostBeginExpectedToken,
        };
        writeDurableJson(
          operationDirectory,
          "host-begin-receipt.json",
          hostReceipt,
        );
      } else {
        const hasSubmission = [...CREATE_PURPOSES].some((purpose) =>
          fs.existsSync(
            path.join(operationDirectory, `submission-${purpose}.json`),
          ),
        );
        if (hasSubmission)
          throw new Error("docker_task_recovery_host_begin_mismatch");
        hostSubmissionStarted = false;
        hostReceipt = {
          previous: hostBeginCurrentToken,
          observed: hostBeginCurrentToken,
        };
      }
    }
    if (
      hostReceipt.previous !== hostBeginCurrentToken ||
      (hostSubmissionStarted && hostReceipt.observed !== hostBeginExpectedToken)
    )
      throw new Error("docker_task_recovery_host_begin_mismatch");
    const submissionHostToken = hostReceipt.observed ?? "";
    parseHostRecoveryToken(submissionHostToken);
    const host = loadHostRecoveryRecordByToken(submissionHostToken);
    const managementName = (
      host.record.childIdentities as Record<string, { pathName: string }>
    ).management?.pathName;
    if (!managementName) throw new Error("docker_task_recovery_host_mismatch");
    const hostRoot = path.join(host.parent, host.parsed.rootName);
    const hostActiveBindingPath = path.join(
      hostRoot,
      managementName,
      "active-docker-task-v1.json",
    );
    if (fs.existsSync(hostActiveBindingPath)) {
      const activeBinding = readExactJson(hostActiveBindingPath)
        .value as Record<string, unknown>;
      if (
        activeBinding.schema !==
          "crdd-coordinator-host-active-docker-task/v1" ||
        activeBinding.recoveryId !== parsed.token ||
        activeBinding.baseHash !== parsed.baseHash
      )
        throw new Error("docker_task_recovery_active_run_mismatch");
    } else if (hostSubmissionStarted) {
      throw new Error("docker_task_recovery_active_run_missing");
    }
    const configDirectory = path.join(
      operationDirectory,
      "recovery-docker-cli-config",
    );
    const pointerPath = path.join(
      root.rootPath,
      `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
    );
    const releasePointer = () => {
      if (!fs.existsSync(pointerPath)) return;
      const pointer = readExactJson(pointerPath).value as Record<
        string,
        unknown
      >;
      if (
        pointer.recoveryId !== parsed.token ||
        pointer.baseHash !== parsed.baseHash
      )
        throw new Error("docker_task_recovery_pointer_mismatch");
      if (!removeCommittedDockerRecoveryJson(pointerPath))
        throw new Error("docker_task_recovery_pointer_mismatch");
      commitDirectoryMutationBoundary(root.rootPath);
    };
    if (!hostSubmissionStarted) {
      if (fs.existsSync(hostActiveBindingPath))
        if (!removeCommittedDockerRecoveryJson(hostActiveBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      releasePointer();
      if (!processAbsenceLock.release())
        throw new Error("docker_task_recovery_lock_release_unconfirmed");
      writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
        schema: "crdd-coordinator-host-cleanup-intent/v1",
        recoveryId: parsed.token,
        currentHostRecoveryId: submissionHostToken,
      });
      const hostRecovery = recoverOwnedOperationDirectories(
        submissionHostToken,
        hostOperationGeneration,
      );
      if (hostRecovery.status !== "recovered")
        return Object.freeze({
          status: "blocked" as const,
          reason: hostRecovery.reason,
          recoveryId: parsed.token,
        });
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
      );
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      });
    }
    if (!fs.existsSync(configDirectory))
      fs.mkdirSync(configDirectory, { mode: 0o700 });
    const configIdentity = recoveryConfigIdentity(configDirectory);
    const specs = [
      [
        "create_provider",
        "container",
        String(resources.provider),
        String(images.provider),
        null,
      ],
      [
        "create_subscription_auth_probe",
        "container",
        String(resources.auth),
        String(images.provider),
        null,
      ],
      [
        "create_proxy",
        "container",
        String(resources.proxy),
        String(images.proxy),
        null,
      ],
      [
        "create_internal_network",
        "network",
        String(resources.internal),
        null,
        true,
      ],
      [
        "create_egress_network",
        "network",
        String(resources.egress),
        null,
        false,
      ],
    ] as const;
    for (const [purpose, kind, name, image, internal] of specs) {
      const submission = fs.existsSync(
        path.join(operationDirectory, `submission-${purpose}.json`),
      );
      const receiptPath = path.join(
        operationDirectory,
        `receipt-${purpose}.json`,
      );
      if (!submission) {
        if (fs.existsSync(receiptPath))
          throw new Error("docker_task_recovery_receipt_without_submission");
        continue;
      }
      if (!fs.existsSync(receiptPath))
        throw new Error("docker_task_recovery_create_outcome_unknown");
      const receipt = readExactJson(receiptPath).value as Record<
        string,
        string
      >;
      const dockerId = receipt.dockerId ?? "";
      if (
        receipt.purpose !== purpose ||
        receipt.recoveryId !== parsed.token ||
        !HEX64.test(dockerId) ||
        !recoverExactDockerResource(
          configDirectory,
          configIdentity,
          kind,
          dockerId,
          name,
          String(base.ownershipLabel),
          image,
          internal,
          purpose,
          purpose === "create_subscription_auth_probe"
            ? []
            : purpose === "create_proxy"
              ? [String(resources.internal), String(resources.egress)]
              : kind === "container"
                ? [String(resources.internal)]
                : [],
          operationMode,
          workspaceMountMode,
        )
      )
        throw new Error("docker_task_recovery_resource_mismatch");
    }
    if (recoveryConfigIdentity(configDirectory) !== configIdentity)
      throw new Error("docker_task_recovery_config_untrusted");
    fs.rmdirSync(configDirectory);
    if (
      !fs.existsSync(path.join(operationDirectory, "docker-absence-crash.json"))
    ) {
      writeDurableJson(operationDirectory, "docker-absence-crash.json", {
        schema: "crdd-coordinator-docker-absence/v1",
        recoveryId: parsed.token,
        allExactResourcesAbsent: true,
        evidence: "crash_recovery_exact_id_and_configuration",
      });
    }
    const crashIntentPath = path.join(
      operationDirectory,
      "host-crash-absence-intent.json",
    );
    const crashIntent = fs.existsSync(crashIntentPath)
      ? (readExactJson(crashIntentPath).value as Record<string, string>)
      : expectedHostSuccessor(submissionHostToken, "docker_absent_confirmed");
    if (!fs.existsSync(crashIntentPath))
      writeDurableJson(
        operationDirectory,
        "host-crash-absence-intent.json",
        crashIntent,
      );
    let dockerAbsentHostToken: string;
    try {
      loadHostRecoveryRecordByToken(crashIntent.expectedToken);
      dockerAbsentHostToken = crashIntent.expectedToken;
    } catch {
      dockerAbsentHostToken = confirmOwnedDockerAbsenceForRecovery(
        submissionHostToken,
        hostOperationGeneration,
      );
    }
    if (dockerAbsentHostToken !== crashIntent.expectedToken)
      throw new Error("docker_task_recovery_host_successor_mismatch");
    const crashReceiptPath = path.join(
      operationDirectory,
      "host-crash-absence-receipt.json",
    );
    if (!fs.existsSync(crashReceiptPath))
      writeDurableJson(operationDirectory, "host-crash-absence-receipt.json", {
        previous: submissionHostToken,
        observed: dockerAbsentHostToken,
      });
    if (fs.existsSync(hostActiveBindingPath)) {
      const activeBinding = readExactJson(hostActiveBindingPath)
        .value as Record<string, unknown>;
      if (activeBinding.recoveryId !== parsed.token)
        throw new Error("docker_task_recovery_active_run_mismatch");
      if (!removeCommittedDockerRecoveryJson(hostActiveBindingPath))
        throw new Error("docker_task_recovery_active_run_mismatch");
    }
    const mountCrashPath = path.join(
      operationDirectory,
      "mount-crash-absence.json",
    );
    if (!fs.existsSync(mountCrashPath))
      writeDurableJson(operationDirectory, "mount-crash-absence.json", {
        schema: "crdd-coordinator-provider-home-mount-completion/v1",
        recoveryId: parsed.token,
        evidence: "process_generation_absent_plus_exact_docker_absent",
      });
    releasePointer();
    if (
      !hostRecoveryInventoryReady(root.rootPath, hostRoot, operationDirectory)
    )
      throw new Error("docker_task_recovery_host_inventory_incomplete");
    if (!processAbsenceLock.release())
      throw new Error("docker_task_recovery_lock_release_unconfirmed");
    if (
      !fs.existsSync(path.join(operationDirectory, "host-cleanup-intent.json"))
    )
      writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
        schema: "crdd-coordinator-host-cleanup-intent/v1",
        recoveryId: parsed.token,
        currentHostRecoveryId: dockerAbsentHostToken,
      });
    const hostRecovery = recoverOwnedOperationDirectories(
      dockerAbsentHostToken,
      hostOperationGeneration,
    );
    if (hostRecovery.status !== "recovered")
      return Object.freeze({
        status: "blocked" as const,
        reason: hostRecovery.reason,
        recoveryId: parsed.token,
      });
    ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
    removeRecoveryOperationDirectory(
      operationDirectory,
      parsed.token,
      parsed.operationNonce,
      parsed.baseHash,
      parsed.stableLogicalHomeBindingHash,
    );
    commitDirectoryMutationBoundary(root.rootPath);
    return Object.freeze({
      status: "recovered" as const,
      reason: "docker_task_recovery_completed",
      recoveryId: null,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(error, "docker_task_recovery_failed_closed"),
      recoveryId: parsed.token,
    });
  } finally {
    void runtimeStateLock.release();
    processAbsenceLock.release();
    if (hostOperationGeneration)
      void releaseHostOperationRecoveryGeneration(hostOperationGeneration);
  }
}

function inspectDockerRecoveryRootSnapshot(rootPath: unknown) {
  try {
    if (typeof rootPath !== "string" || !path.isAbsolute(rootPath))
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_unavailable",
        manualRecoveryRequired: true,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    const rootMetadata = fs.lstatSync(rootPath);
    if (
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync(rootPath) !== rootPath
    )
      throw new Error("docker_task_runtime_state_root_replaced");
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    if (entries.length > 256)
      throw new Error("docker_task_runtime_state_entry_limit_exceeded");
    const sorted = [...entries].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    if (entries.length === 0)
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_runtime_state_clean",
        manualRecoveryRequired: false,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    const records = new Map<
      string,
      Readonly<{
        token: string;
        stable: string;
        nonce: string;
        cleanup: boolean;
      }>
    >();
    const pendingBaseNames = new Set<string>();
    const pendingCommitNames = new Set<string>();
    const entryNames = new Set(entries.map((entry) => entry.name));
    const pointers: Array<
      Readonly<{ name: string; value: Record<string, unknown> }>
    > = [];
    const journalIntents = inspectDockerRecoveryJournalDirectory(rootPath);
    const cleanupIntentRecoveryIds = new Set(
      journalIntents
        .map((intent) => intent.recoveryId)
        .filter((value): value is string => value !== null),
    );
    if (
      journalIntents.some(
        (intent) =>
          intent.schema !== "crdd-coordinator-recovery-cleanup-delete/v1",
      )
    )
      throw new Error("docker_task_runtime_state_journal_pending");
    const addRecord = (basePath: string, commitPath: string, nonce: string) => {
      const base = readExactJson(basePath, "base.json");
      const commit = readExactJson(commitPath, "base-commit.json")
        .value as Record<string, unknown>;
      const value = base.value as Record<string, unknown>;
      const stable = value.stableLogicalHomeBindingHash;
      if (
        !validateDockerRecoveryBase(value, nonce) ||
        !exactRecordKeys(commit, [
          "schema",
          "operationNonce",
          "stableLogicalHomeBindingHash",
          "baseHash",
          "recoveryId",
        ]) ||
        commit.schema !== "crdd-coordinator-task-docker-base-commit/v1" ||
        value.operationNonce !== nonce ||
        commit.operationNonce !== nonce ||
        typeof stable !== "string" ||
        !HEX64.test(stable) ||
        commit.stableLogicalHomeBindingHash !== stable ||
        commit.baseHash !== base.hash
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      const token = `docker-task.${stable}.${nonce}.${base.hash}`;
      if (commit.recoveryId !== token || records.has(nonce))
        throw new Error("docker_task_runtime_state_base_invalid");
      records.set(
        nonce,
        Object.freeze({ token, stable, nonce, cleanup: false }),
      );
      const directory = path.join(rootPath, `docker-task-${nonce}`);
      if (
        fs.existsSync(path.join(directory, "base.json")) &&
        fs.existsSync(path.join(directory, "base-commit.json"))
      )
        if (fs.existsSync(path.join(directory, "cleanup-manifest.json")))
          verifyRecoveryCleanupManifest(directory, token);
        else inventoryOperationDirectory(directory, token, nonce, base.hash);
    };
    for (const entry of sorted) {
      if (isDockerRecoveryJournalIntentName(entry.name)) continue;
      if (isDockerRecoveryJournalTemporaryName(entry.name))
        throw new Error("docker_task_runtime_state_orphan_temporary");
      if (entry.name.endsWith(".crdd-commit.json")) {
        const dataName = entry.name.slice(0, -".crdd-commit.json".length);
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dataName)
        )
          throw new Error("docker_task_runtime_state_orphan_commit");
        continue;
      }
      let match =
        /^cleanup-docker-task-([a-f0-9]{64})-([a-f0-9]{64})-([a-f0-9]{64})$/u.exec(
          entry.name,
        );
      if (match?.[1] && match[2] && match[3]) {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          records.has(match[2])
        )
          throw new Error("docker_task_runtime_state_cleanup_replaced");
        const cleanupRecoveryId = `docker-task.${match[1]}.${match[2]}.${match[3]}`;
        try {
          inventoryRecoveryCleanupTombstone(
            path.join(rootPath, entry.name),
            cleanupRecoveryId,
          );
        } catch {
          if (!cleanupIntentRecoveryIds.has(cleanupRecoveryId))
            throw new Error("docker_task_runtime_state_cleanup_replaced");
        }
        records.set(
          match[2],
          Object.freeze({
            token: `docker-task.${match[1]}.${match[2]}.${match[3]}`,
            stable: match[1],
            nonce: match[2],
            cleanup: true,
          }),
        );
        continue;
      }
      match = /^docker-task-([a-f0-9]{64})$/u.exec(entry.name);
      if (match?.[1]) {
        if (!entry.isDirectory() || entry.isSymbolicLink())
          throw new Error("docker_task_runtime_state_entry_replaced");
        const directoryBase = path.join(rootPath, entry.name, "base.json");
        const directoryCommit = path.join(
          rootPath,
          entry.name,
          "base-commit.json",
        );
        addRecord(
          fs.existsSync(directoryBase)
            ? directoryBase
            : path.join(rootPath, `pending-docker-task-${match[1]}.json`),
          fs.existsSync(directoryCommit)
            ? directoryCommit
            : path.join(
                rootPath,
                `pending-docker-task-${match[1]}.commit.json`,
              ),
          match[1],
        );
        continue;
      }
      match = /^pending-docker-task-([a-f0-9]{64})\.json$/u.exec(entry.name);
      if (match?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        pendingBaseNames.add(match[1]);
        continue;
      }
      match = /^pending-docker-task-([a-f0-9]{64})\.commit\.json$/u.exec(
        entry.name,
      );
      if (match?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        pendingCommitNames.add(match[1]);
        continue;
      }
      if (/^active-lease-[a-f0-9]{64}\.json$/u.test(entry.name)) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        pointers.push(
          Object.freeze({
            name: entry.name,
            value: readExactJson(path.join(rootPath, entry.name))
              .value as Record<string, unknown>,
          }),
        );
        continue;
      }
      throw new Error("docker_task_runtime_state_unknown_entry");
    }
    for (const cleanupRecoveryId of cleanupIntentRecoveryIds) {
      const parsedCleanup = parseDockerTaskRecoveryId(cleanupRecoveryId);
      if (!parsedCleanup || records.has(parsedCleanup.operationNonce)) continue;
      records.set(
        parsedCleanup.operationNonce,
        Object.freeze({
          token: cleanupRecoveryId,
          stable: parsedCleanup.stableLogicalHomeBindingHash,
          nonce: parsedCleanup.operationNonce,
          cleanup: true,
        }),
      );
    }
    const pendingNonces = new Set([...pendingBaseNames, ...pendingCommitNames]);
    for (const nonce of pendingNonces) {
      if (records.has(nonce)) continue;
      if (!pendingBaseNames.has(nonce) || !pendingCommitNames.has(nonce))
        throw new Error("docker_task_runtime_state_pending_incomplete");
      addRecord(
        path.join(rootPath, `pending-docker-task-${nonce}.json`),
        path.join(rootPath, `pending-docker-task-${nonce}.commit.json`),
        nonce,
      );
    }
    const pointerTokens = new Set<string>();
    const activeStableLogicalHomeBindingHashes = new Set<string>();
    for (const pointerRecord of pointers) {
      const pointer = pointerRecord.value;
      const filenameHash = /^active-lease-([a-f0-9]{64})\.json$/u.exec(
        pointerRecord.name,
      )?.[1];
      if (
        !exactRecordKeys(pointer, [
          "schema",
          "stableLogicalHomeBindingHash",
          "operationName",
          "recoveryId",
          "baseHash",
        ]) ||
        pointer.schema !== "crdd-coordinator-provider-home-active-lease/v1" ||
        filenameHash !== pointer.stableLogicalHomeBindingHash ||
        typeof pointer.baseHash !== "string" ||
        typeof pointer.recoveryId !== "string" ||
        ![...records.values()].some(
          (record) =>
            record.token === pointer.recoveryId &&
            record.cleanup === false &&
            record.stable === pointer.stableLogicalHomeBindingHash &&
            `docker-task-${record.nonce}` === pointer.operationName &&
            record.token.endsWith(`.${pointer.baseHash}`),
        ) ||
        pointerTokens.has(pointer.recoveryId)
      )
        throw new Error("docker_task_runtime_state_orphan_pointer");
      pointerTokens.add(pointer.recoveryId);
      activeStableLogicalHomeBindingHashes.add(
        String(pointer.stableLogicalHomeBindingHash),
      );
    }
    const recoveryIds = [...records.values()]
      .sort((left, right) => {
        const activeOrder =
          Number(pointerTokens.has(right.token)) -
          Number(pointerTokens.has(left.token));
        return activeOrder || left.token.localeCompare(right.token);
      })
      .map((record) => record.token);
    if (recoveryIds.length === 0)
      throw new Error("docker_task_runtime_state_orphan_pointer");
    return Object.freeze({
      status: "completed" as const,
      reason:
        recoveryIds.length === 1
          ? "docker_task_recovery_inventory_available"
          : "docker_task_multiple_recovery_inventory_available",
      manualRecoveryRequired: true,
      dockerRecoveryId: recoveryIds.length === 1 ? recoveryIds[0] : null,
      dockerRecoveryIds: Object.freeze(recoveryIds),
      activeStableLogicalHomeBindingHashes: Object.freeze(
        [...activeStableLogicalHomeBindingHashes].sort(),
      ),
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_runtime_state_audit_failed",
      ),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      activeStableLogicalHomeBindingHashes: Object.freeze([]),
    });
  }
}

export function inspectRuntimeOwnedDockerTaskRecoveryState() {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      true,
      new Date().toISOString(),
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_unavailable",
        manualRecoveryRequired: true,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    const runtimeStateLock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!runtimeStateLock)
      throw new Error("docker_task_runtime_state_generation_active_or_unknown");
    try {
      return inspectDockerRecoveryRootSnapshot(root.rootPath);
    } finally {
      void runtimeStateLock.release();
    }
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_runtime_state_audit_failed",
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      activeStableLogicalHomeBindingHashes: Object.freeze([]),
    });
  }
}

type RecoveryRecord = Readonly<{
  managementCapability: object;
  operationId: string;
  recoveryId: string;
}>;
type RuntimeDependencies = Readonly<{
  verifyOperation: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string }>;
  beginDurableRecovery: (
    managementCapability: unknown,
    operationId: unknown,
  ) => string;
  completeDurableRecovery: (
    managementCapability: unknown,
    recoveryId: unknown,
  ) => string;
}>;
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  records: WeakMap<object, RecoveryRecord>;
}>;

function createRuntimeState(dependencies: RuntimeDependencies): RuntimeState {
  return Object.freeze({
    dependencies: Object.freeze(dependencies),
    records: new WeakMap(),
  });
}

function beginRecovery(
  state: RuntimeState,
  plan: Readonly<{ operationId: string }>,
  managementCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !/^OP-[0-9]{6,}$/u.test(plan.operationId)
  ) {
    return null;
  }
  const operation = state.dependencies.verifyOperation(managementCapability);
  if (operation.operationId !== plan.operationId) return null;
  const recoveryId = state.dependencies.beginDurableRecovery(
    managementCapability,
    operation.operationId,
  );
  parseHostRecoveryToken(recoveryId);
  const recoveryCapability = Object.freeze({});
  state.records.set(
    recoveryCapability,
    Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      recoveryId,
    }),
  );
  return Object.freeze({ recoveryId, recoveryCapability });
}

function completeRecovery(
  state: RuntimeState,
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  if (!recoveryCapability || typeof recoveryCapability !== "object") {
    return Object.freeze({ status: "blocked" as const });
  }
  const record = state.records.get(recoveryCapability);
  if (!record || record.managementCapability !== managementCapability) {
    return Object.freeze({ status: "blocked" as const });
  }
  const operation = state.dependencies.verifyOperation(managementCapability);
  if (operation.operationId !== record.operationId) {
    return Object.freeze({ status: "blocked" as const });
  }
  const completedRecoveryId = state.dependencies.completeDurableRecovery(
    managementCapability,
    record.recoveryId,
  );
  parseHostRecoveryToken(completedRecoveryId);
  if (completedRecoveryId === record.recoveryId) {
    return Object.freeze({ status: "blocked" as const });
  }
  state.records.delete(recoveryCapability);
  return Object.freeze({ status: "completed" as const });
}

export function beginRuntimeOwnedDockerRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
) {
  try {
    return beginProductionRecovery(plan, managementCapability);
  } catch {
    return null;
  }
}

export function completeRuntimeOwnedDockerRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return completeProductionRecovery(recoveryCapability, managementCapability);
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

export function createIsolatedDockerRecoveryRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    begin: (
      plan: Readonly<{ operationId: string }>,
      managementCapability: unknown,
    ) => {
      try {
        return beginRecovery(state, plan, managementCapability);
      } catch {
        return null;
      }
    },
    complete: (recoveryCapability: unknown, managementCapability: unknown) => {
      try {
        return completeRecovery(
          state,
          recoveryCapability,
          managementCapability,
        );
      } catch {
        return Object.freeze({ status: "blocked" as const });
      }
    },
  });
}

export function describeDockerRecoveryRuntimeContract() {
  return Object.freeze({
    contract: DOCKER_RECOVERY_RUNTIME_CONTRACT,
    contractRevision: DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION,
    durableStateBeforeDockerEffect: "docker_submission_started",
    durableStateAfterCleanup: "host_only",
    capability: "opaque_process_local_single_completion",
    crashRecovery: "durable_recovery_id_returned_for_manual_recovery",
    runtimeStateRoot:
      "selected_user_runtime_owned_fixed_known_folder_protected_root",
    logicalHomeLease:
      "stable_sid_provider_namespace_kernel_lock_and_durable_active_pointer",
    resourceJournal:
      "file_fsync_base_commit_pointer_identity_host_active_binding_then_exact_docker_id_receipt",
    offlineRecovery:
      "exact_id_and_configuration_only_unknown_create_outcome_never_adopted",
    hostFinalization:
      "host_generation_owner_and_inventory_then_cleanup_intent_receipt_and_exact_removal",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
}
