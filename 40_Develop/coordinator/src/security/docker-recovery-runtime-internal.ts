import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createWindowsDockerCliEnvironment } from "../core/windows-child-environment.ts";
import {
  acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  acquireRuntimeOwnedLogicalProviderHomeKernelLock,
} from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  borrowRuntimeOwnedDevelopmentNativeObservation,
  inspectRuntimeOwnedDevelopmentOperationContext,
} from "./development-measurement-session.ts";
import { observeRuntimeOwnedDockerDesktopRepairPolicy } from "./docker-desktop-repair-policy.ts";
import {
  inspectDockerDesktopRepairHistoricalOperation,
  parseDockerDesktopRepairDirectoryName,
} from "./docker-desktop-repair-record-store.ts";
import { validateDockerHostTransitionLineage } from "./docker-host-transition-state.ts";
import { parseDockerTaskRecoveryId } from "./docker-recovery-identity.ts";
import {
  discoverDockerRecoveryJournalJsonForRecovery,
  dockerRecoveryCommitName,
  hasDockerRecoveryJournalIntentForRecovery,
  inspectDockerRecoveryJournalDirectory,
  inspectDockerRecoveryMoveJournalForRecovery,
  isDockerRecoveryJournalIntentName,
  isDockerRecoveryJournalTemporaryName,
  moveCommittedDockerRecoveryJson,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  removeDockerRecoveryCleanupDirectory,
  removeExactUncommittedDockerRecoveryJson,
  resumeDockerRecoveryJournalDirectory,
  resumeDockerRecoveryJournalDirectoryForRecovery,
  writeCommittedDockerRecoveryJson,
  writeOrResumeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";
import { createDockerRecoveryRuntimeStateLockController } from "./docker-recovery-lock-controller.ts";
import { releaseRecoverySynchronizations } from "./docker-recovery-state-machine.ts";
import { isExactDockerRuntimeStateMutationBoundary } from "./docker-runtime-state-binding.ts";
import {
  acquireHostOperationRecoveryGenerationByIdentity,
  beginOwnedDockerSubmissionRecovery,
  completeOwnedDockerSubmissionRecovery,
  confirmOwnedDockerAbsenceForRecovery,
  consumeOwnedHostRecoveryIdForCleanup,
  getOwnedHostRecoveryIdByManagementCapability,
  issueOwnedHostCleanupCapability,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";
import { parseExternalSendConsentActiveEntryName } from "./external-send-consent-record.ts";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "./host-recovery-record.ts";
import { loadHistoricalReleaseManifestEnvelopeForVerification } from "./platform-provisioner-manifest-loader.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "./provider-home-windows-adapter.ts";

export const DOCKER_RECOVERY_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-recovery-runtime";
export const DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION = 25;

const HEX64 = /^[a-f0-9]{64}$/u;
const COMPLETED_DOCKER_RECOVERY_RECEIPT =
  /^completed-docker-recovery-([a-f0-9]{64})\.json$/u;
const ACKNOWLEDGED_DOCKER_RECOVERY_RECEIPT =
  /^acknowledged-docker-recovery-([a-f0-9]{64})\.json$/u;
const MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS = 64;
const DOCKER_TASK_SESSION_HANDOFF =
  /^docker-task-session-handoff-([a-f0-9]{64})-([0-9]{2})\.json$/u;
const MAX_DOCKER_TASK_SESSION_HANDOFFS = 8;
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
  recoveryCorrelationId?: string | null;
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
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
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
  runtimeStateBindingHash: string;
  initialHostRecoveryId: string;
  hostActiveBindingPath: string;
  hostRootPath: string;
  hostMarkerPath: string;
  logicalHomeLease: Readonly<{ release: () => boolean }>;
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null;
}>;

type VerifiedRuntimeStateRoot = Readonly<{
  rootPath: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
}>;

type VerifiedProviderHome = Readonly<{
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
}>;

type RuntimeStateBindingEvidence = Readonly<{
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
}>;

const durableRecords = new WeakMap<object, DurableRecord>();
const dockerHostCleanupCapabilities = new WeakMap<object, object>();
const releasedLogicalHomeLeases = new WeakSet<object>();
type VerifiedDockerEngineRestartFence = Readonly<{
  recoveryId: string;
  repairId: string;
  repairRecordSha256: string;
}>;

function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function runtimeStateBindingEvidence(
  root: VerifiedRuntimeStateRoot,
): RuntimeStateBindingEvidence {
  return Object.freeze({
    runtimeStateIdentityHash: root.runtimeStateIdentityHash,
    runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    localUserBindingHash: root.localUserBindingHash,
    runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
  });
}

function validRuntimeStateBindingEvidence(
  value: unknown,
): value is RuntimeStateBindingEvidence {
  return (
    exactRecordKeys(value, [
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
    ]) &&
    Object.values(value as Record<string, unknown>).every(
      (item) => typeof item === "string" && HEX64.test(item),
    )
  );
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

function completedDockerRecoveryReceiptName(recoveryId: string) {
  return `completed-docker-recovery-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}.json`;
}

function acknowledgedDockerRecoveryReceiptName(recoveryId: string) {
  return `acknowledged-docker-recovery-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}.json`;
}

function inspectAcknowledgedDockerRecoveryReceipt(
  rootPath: string,
  recoveryId: string,
) {
  const name = acknowledgedDockerRecoveryReceiptName(recoveryId);
  const location = path.join(rootPath, name);
  if (!recoveryPathPresent(location)) return null;
  const record = readExactJson(location, name);
  const value = record.value as Record<string, unknown>;
  if (
    !exactRecordKeys(value, [
      "schema",
      "recoveryId",
      "runtimeStateBinding",
      "receiptContentHash",
      "receiptContentIdentity",
    ]) ||
    value.schema !== "crdd-coordinator-docker-recovery-acknowledgement/v1" ||
    value.recoveryId !== recoveryId ||
    !validRuntimeStateBindingEvidence(value.runtimeStateBinding) ||
    typeof value.receiptContentHash !== "string" ||
    !HEX64.test(value.receiptContentHash) ||
    typeof value.receiptContentIdentity !== "string" ||
    value.receiptContentIdentity.length < 1 ||
    value.receiptContentIdentity.length > 256
  )
    throw new Error("docker_task_recovery_acknowledgement_tombstone_invalid");
  return Object.freeze({
    name,
    runtimeStateBinding:
      value.runtimeStateBinding as RuntimeStateBindingEvidence,
    receiptContentHash: value.receiptContentHash as string,
    receiptContentIdentity: value.receiptContentIdentity as string,
  });
}

function inspectCompletedDockerRecoveryReceipt(
  rootPath: string,
  recoveryId: string,
) {
  const name = completedDockerRecoveryReceiptName(recoveryId);
  const location = path.join(rootPath, name);
  if (!recoveryPathPresent(location)) return null;
  const record = readExactJson(location, name);
  const value = record.value as Record<string, unknown>;
  if (
    !exactRecordKeys(value, ["schema", "recoveryId", "runtimeStateBinding"]) ||
    value.schema !== "crdd-coordinator-docker-recovery-completion/v1" ||
    value.recoveryId !== recoveryId ||
    !validRuntimeStateBindingEvidence(value.runtimeStateBinding)
  )
    throw new Error("docker_task_recovery_completion_receipt_invalid");
  return Object.freeze({
    name,
    runtimeStateBinding:
      value.runtimeStateBinding as RuntimeStateBindingEvidence,
    receiptContentHash: record.hash,
    receiptContentIdentity: record.identityText,
  });
}

function ensureCompletedDockerRecoveryReceipt(
  rootPath: string,
  recoveryId: string,
  runtimeStateBinding: RuntimeStateBindingEvidence,
) {
  const existing = inspectCompletedDockerRecoveryReceipt(rootPath, recoveryId);
  if (existing) {
    if (
      JSON.stringify(existing.runtimeStateBinding) !==
      JSON.stringify(runtimeStateBinding)
    )
      throw new Error("docker_task_recovery_completion_receipt_mismatch");
    return;
  }
  const count = fs
    .readdirSync(rootPath)
    .filter((name) => COMPLETED_DOCKER_RECOVERY_RECEIPT.test(name)).length;
  if (count >= MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS)
    throw new Error("docker_task_recovery_completion_receipt_limit_exceeded");
  const name = completedDockerRecoveryReceiptName(recoveryId);
  writeDurableJson(rootPath, name, {
    schema: "crdd-coordinator-docker-recovery-completion/v1",
    recoveryId,
    runtimeStateBinding,
  });
  inspectCompletedDockerRecoveryReceipt(rootPath, recoveryId);
}

type DockerTaskSessionHandoffState = Readonly<{
  currentLocalUserBindingHash: string;
  tipSha256: string;
  count: number;
}>;

function dockerTaskSessionHandoffPrefix(recoveryId: string) {
  return `docker-task-session-handoff-${createHash("sha256")
    .update(recoveryId)
    .digest("hex")}-`;
}

function inspectDockerTaskSessionHandoffs(
  rootPath: string,
  recoveryId: string,
  durableBinding: RuntimeStateBindingEvidence,
): DockerTaskSessionHandoffState {
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  if (!parsed) throw new Error("docker_task_recovery_id_invalid");
  const prefix = dockerTaskSessionHandoffPrefix(recoveryId);
  const names = fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.name.startsWith(prefix) &&
        !entry.name.endsWith(".crdd-commit.json"),
    );
  if (
    names.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    names.length > MAX_DOCKER_TASK_SESSION_HANDOFFS
  )
    throw new Error("docker_task_session_handoff_invalid");
  const orderedItems = names.map((entry) => entry.name).sort();
  let currentLocalUserBindingHash = durableBinding.localUserBindingHash;
  let tipSha256 = parsed.baseHash;
  const visited = new Set([currentLocalUserBindingHash]);
  for (let index = 0; index < orderedItems.length; index += 1) {
    const name = orderedItems[index];
    const matched = DOCKER_TASK_SESSION_HANDOFF.exec(name ?? "");
    const record = readExactJson(path.join(rootPath, name ?? ""), name)
      .value as Record<string, unknown>;
    if (
      !matched ||
      Number(matched[2]) !== index ||
      createHash("sha256").update(recoveryId).digest("hex") !== matched[1] ||
      !exactRecordKeys(record, [
        "schema",
        "recoveryId",
        "sequence",
        "previousHandoffSha256",
        "fromLocalUserBindingHash",
        "toLocalUserBindingHash",
        "runtimeStateIdentityHash",
        "runtimeStateProtectionHash",
        "runtimeStateBindingHash",
        "operationNonce",
        "baseHash",
      ]) ||
      record.schema !== "crdd-coordinator/docker-task-session-handoff/v1" ||
      record.recoveryId !== recoveryId ||
      record.sequence !== index ||
      record.previousHandoffSha256 !== tipSha256 ||
      record.fromLocalUserBindingHash !== currentLocalUserBindingHash ||
      typeof record.toLocalUserBindingHash !== "string" ||
      !HEX64.test(record.toLocalUserBindingHash) ||
      record.toLocalUserBindingHash === currentLocalUserBindingHash ||
      visited.has(record.toLocalUserBindingHash) ||
      record.runtimeStateIdentityHash !==
        durableBinding.runtimeStateIdentityHash ||
      record.runtimeStateProtectionHash !==
        durableBinding.runtimeStateProtectionHash ||
      record.runtimeStateBindingHash !==
        durableBinding.runtimeStateBindingHash ||
      record.operationNonce !== parsed.operationNonce ||
      record.baseHash !== parsed.baseHash
    )
      throw new Error("docker_task_session_handoff_invalid");
    currentLocalUserBindingHash = record.toLocalUserBindingHash;
    visited.add(currentLocalUserBindingHash);
    tipSha256 = readExactJson(path.join(rootPath, name ?? ""), name).hash;
  }
  return Object.freeze({
    currentLocalUserBindingHash,
    tipSha256,
    count: orderedItems.length,
  });
}

function ensureDockerTaskSessionHandoff(
  root: VerifiedRuntimeStateRoot,
  recoveryId: string,
  durableBinding: RuntimeStateBindingEvidence,
) {
  const current = inspectDockerTaskSessionHandoffs(
    root.rootPath,
    recoveryId,
    durableBinding,
  );
  if (current.currentLocalUserBindingHash === root.localUserBindingHash)
    return current;
  if (current.count >= MAX_DOCKER_TASK_SESSION_HANDOFFS)
    throw new Error("docker_task_session_handoff_limit_exceeded");
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  if (!parsed) throw new Error("docker_task_recovery_id_invalid");
  const name = `${dockerTaskSessionHandoffPrefix(recoveryId)}${String(
    current.count,
  ).padStart(2, "0")}.json`;
  writeDurableJson(root.rootPath, name, {
    schema: "crdd-coordinator/docker-task-session-handoff/v1",
    recoveryId,
    sequence: current.count,
    previousHandoffSha256: current.tipSha256,
    fromLocalUserBindingHash: current.currentLocalUserBindingHash,
    toLocalUserBindingHash: root.localUserBindingHash,
    runtimeStateIdentityHash: durableBinding.runtimeStateIdentityHash,
    runtimeStateProtectionHash: durableBinding.runtimeStateProtectionHash,
    runtimeStateBindingHash: durableBinding.runtimeStateBindingHash,
    operationNonce: parsed.operationNonce,
    baseHash: parsed.baseHash,
  });
  const rebound = inspectDockerTaskSessionHandoffs(
    root.rootPath,
    recoveryId,
    durableBinding,
  );
  if (rebound.currentLocalUserBindingHash !== root.localUserBindingHash)
    throw new Error("docker_task_session_handoff_write_unknown");
  return rebound;
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
    recordBefore: loaded.record,
  });
}

function validateHostTransitionLineage(
  intent: Record<string, unknown>,
  requiredNextState?: string,
) {
  return validateDockerHostTransitionLineage(intent, requiredNextState);
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
  const { currentToken, expectedToken, current, expected } =
    validateHostTransitionLineage(intent);
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
      loaded.marker !== (intent.markerPath ?? loaded.marker) ||
      loaded.record.state !== intent.nextState
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
    if (
      path.join(loaded.parent, loaded.parsed.rootName) !== expectedRoot ||
      loaded.record.state !== intent.currentState
    )
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

/**
 * @internal Package-private engine. The production wrapper is the only
 * caller that derives these candidates from native Windows observation.
 */
function beginRuntimeOwnedDockerRecoveryFromVerifiedCandidatesInternal(
  plan: ProductionPlan,
  managementCapability: unknown,
  providerHome: VerifiedProviderHome,
  root: VerifiedRuntimeStateRoot,
  afterPendingBaseCommit: ((recoveryId: string) => void) | null,
  beforeHostBeginEffect: ((recoveryId: string) => void) | null,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null,
) {
  if (
    !validProductionPlan(plan) ||
    !managementCapability ||
    typeof managementCapability !== "object"
  )
    throw new Error("docker_recovery_plan_invalid");
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== plan.operationId)
    throw new Error("docker_recovery_operation_binding_invalid");
  if (
    !providerHome ||
    providerHome.providerHomeIdentityHash !== plan.providerHomeIdentityHash ||
    providerHome.providerHomeProtectionHash !==
      plan.providerHomeProtectionHash ||
    providerHome.localUserBindingHash !== plan.localUserBindingHash ||
    providerHome.stableLogicalHomeBindingHash !==
      plan.stableLogicalHomeBindingHash
  )
    throw new Error("docker_recovery_provider_home_binding_invalid");
  if (
    !root ||
    !HEX64.test(root.stableLogicalHomeBindingHash) ||
    root.localUserBindingHash !== plan.localUserBindingHash
  )
    throw new Error("docker_recovery_runtime_state_binding_invalid");
  const lock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    plan.stableLogicalHomeBindingHash,
  );
  if (!lock) throw new Error("docker_recovery_provider_home_lock_unavailable");
  const runtimeStateLockController =
    createDockerRecoveryRuntimeStateLockController(
      root.stableLogicalHomeBindingHash,
    );
  if (!runtimeStateLockController) {
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => lock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
    ]);
    throw new Error(
      releaseFailure ?? "docker_recovery_runtime_state_lock_unavailable",
    );
  }
  let leaseTransferred = false;
  let recoverableId: string | null = null;
  let issuedRecoveryCapability: object | null = null;
  try {
    const rootBefore = fs.lstatSync(root.rootPath, { bigint: true });
    const reboundRoot = runtimeStateLockController.outsideLock(
      observeRuntimeStateRoot,
    );
    const rootAfter = fs.lstatSync(root.rootPath, { bigint: true });
    if (
      !reboundRoot ||
      reboundRoot.rootPath !== root.rootPath ||
      reboundRoot.runtimeStateIdentityHash !== root.runtimeStateIdentityHash ||
      reboundRoot.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      reboundRoot.localUserBindingHash !== root.localUserBindingHash ||
      reboundRoot.stableLogicalHomeBindingHash !==
        root.stableLogicalHomeBindingHash ||
      rootBefore.dev !== rootAfter.dev ||
      rootBefore.ino !== rootAfter.ino ||
      rootBefore.birthtimeNs !== rootAfter.birthtimeNs
    )
      throw new Error("docker_recovery_runtime_state_binding_changed");
    const recoveryInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    const rootAfterInventory = fs.lstatSync(root.rootPath, { bigint: true });
    if (
      recoveryInventory.status !== "completed" ||
      rootAfter.dev !== rootAfterInventory.dev ||
      rootAfter.ino !== rootAfterInventory.ino ||
      rootAfter.birthtimeNs !== rootAfterInventory.birthtimeNs ||
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
      runtimeStateBinding: runtimeStateBindingEvidence(root),
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
      ...(plan.recoveryCorrelationId
        ? { recoveryCorrelationId: plan.recoveryCorrelationId }
        : {}),
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
    recoverableId = recoveryId;
    afterPendingBaseCommit?.(recoveryId);
    const pendingCommit = writeDurableJson(
      root.rootPath,
      `pending-docker-task-${operationNonce}.commit.json`,
      Object.freeze({
        schema: "crdd-coordinator-task-docker-base-commit/v1",
        operationNonce,
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        baseHash: pendingBase.hash,
        recoveryId,
        ...(plan.recoveryCorrelationId
          ? { recoveryCorrelationId: plan.recoveryCorrelationId }
          : {}),
      }),
      "base-commit.json",
    );
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
    beforeHostBeginEffect?.(recoveryId);
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
    issuedRecoveryCapability = recoveryCapability;
    durableRecords.set(
      recoveryCapability,
      Object.freeze({
        rootPath: root.rootPath,
        runtimeStateIdentityHash: root.runtimeStateIdentityHash,
        runtimeStateProtectionHash: root.runtimeStateProtectionHash,
        localUserBindingHash: root.localUserBindingHash,
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
        runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
        initialHostRecoveryId,
        hostActiveBindingPath,
        hostRootPath: path.join(
          loadedInitialHost.parent,
          loadedInitialHost.parsed.rootName,
        ),
        hostMarkerPath: loadedInitialHost.marker,
        logicalHomeLease: lock,
        observeRuntimeStateRoot,
      }),
    );
    leaseTransferred = true;
    return Object.freeze({
      status: "ready" as const,
      recoveryId,
      recoveryCapability,
    });
  } catch (error) {
    return recoverableId
      ? Object.freeze({
          status: "blocked" as const,
          recoveryId: recoverableId,
          reason: safeRecoveryReason(
            error,
            "docker_recovery_initialization_failed_closed",
          ),
        })
      : Object.freeze({
          status: "blocked" as const,
          recoveryId: null,
          manualRecoveryRequired: true as const,
          reason: safeRecoveryReason(
            error,
            "docker_recovery_initialization_failed_closed",
          ),
        });
  } finally {
    const runtimeReleaseFailure = releaseRecoverySynchronizations([
      {
        release: () => runtimeStateLockController.close(),
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
      },
    ]);
    if (runtimeReleaseFailure && leaseTransferred) {
      if (issuedRecoveryCapability)
        durableRecords.delete(issuedRecoveryCapability);
      leaseTransferred = false;
    }
    const homeReleaseFailure = leaseTransferred
      ? null
      : releaseRecoverySynchronizations([
          {
            release: () => lock.release(),
            reason: "docker_task_recovery_home_lock_release_unconfirmed",
          },
        ]);
    const releaseFailure = runtimeReleaseFailure ?? homeReleaseFailure;
    if (releaseFailure)
      // biome-ignore lint/correctness/noUnsafeFinally: release failure must override a provisional ready result.
      return recoverableId
        ? Object.freeze({
            status: "blocked" as const,
            recoveryId: recoverableId,
            reason: releaseFailure,
          })
        : Object.freeze({
            status: "blocked" as const,
            recoveryId: null,
            manualRecoveryRequired: true as const,
            reason: releaseFailure,
          });
  }
}

function beginRuntimeOwnedDockerRecoveryFromVerifiedCandidates(
  plan: ProductionPlan,
  managementCapability: unknown,
  providerHome: VerifiedProviderHome,
  root: VerifiedRuntimeStateRoot,
) {
  return beginRuntimeOwnedDockerRecoveryFromVerifiedCandidatesInternal(
    plan,
    managementCapability,
    providerHome,
    root,
    null,
    null,
    observeRuntimeStateRootFromWindows,
  );
}

/** @internal Package-private process-crash contract seam. */
export function beginRuntimeOwnedDockerRecoveryWithHostBeginObserver(
  plan: ProductionPlan,
  managementCapability: unknown,
  providerHome: VerifiedProviderHome,
  root: VerifiedRuntimeStateRoot,
  beforeHostBeginEffect: (recoveryId: string) => void,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null = observeRuntimeStateRootFromWindows,
) {
  return beginRuntimeOwnedDockerRecoveryFromVerifiedCandidatesInternal(
    plan,
    managementCapability,
    providerHome,
    root,
    null,
    beforeHostBeginEffect,
    observeRuntimeStateRoot,
  );
}

/** @internal Package-private earliest process-crash contract seam. */
export function beginRuntimeOwnedDockerRecoveryWithPendingBaseObserver(
  plan: ProductionPlan,
  managementCapability: unknown,
  providerHome: VerifiedProviderHome,
  root: VerifiedRuntimeStateRoot,
  afterPendingBaseCommit: (recoveryId: string) => void,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null = observeRuntimeStateRootFromWindows,
) {
  return beginRuntimeOwnedDockerRecoveryFromVerifiedCandidatesInternal(
    plan,
    managementCapability,
    providerHome,
    root,
    afterPendingBaseCommit,
    null,
    observeRuntimeStateRoot,
  );
}

/** @internal Package-private native-boundary contract seam. */
export function beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
  plan: ProductionPlan,
  managementCapability: unknown,
  providerHome: VerifiedProviderHome,
  root: VerifiedRuntimeStateRoot,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null,
) {
  return beginRuntimeOwnedDockerRecoveryFromVerifiedCandidatesInternal(
    plan,
    managementCapability,
    providerHome,
    root,
    null,
    null,
    observeRuntimeStateRoot,
  );
}

function beginProductionRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
) {
  const development =
    inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
  if (development && !development.checkNewWork()) return null;
  const providerHomeObservation =
    inspectRuntimeOwnedWindowsProviderHomeCandidate(
      plan.provider,
      new Date().toISOString(),
      development?.newWorkContext,
    );
  const providerHome = consumeRuntimeOwnedProviderHomeObservationCapability(
    providerHomeObservation.observationCapability,
  );
  if (providerHomeObservation.status !== "candidate" || !providerHome)
    return null;
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    true,
    new Date().toISOString(),
    development?.newWorkContext,
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  if (observation.status !== "candidate" || !root) return null;
  if (development) {
    if (!development.checkNewWork()) return null;
    return beginRuntimeOwnedDockerRecoveryFromVerifiedCandidatesInternal(
      plan,
      managementCapability,
      providerHome,
      root,
      null,
      null,
      () => observeRuntimeStateRootFromWindows(development.cleanupContext),
    );
  }
  return beginRuntimeOwnedDockerRecoveryFromVerifiedCandidates(
    plan,
    managementCapability,
    providerHome,
    root,
  );
}

function durableRecord(capability: unknown) {
  return capability && typeof capability === "object"
    ? (durableRecords.get(capability) ?? null)
    : null;
}

export function verifyRuntimeOwnedDockerRecoveryBinding(
  recoveryCapability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  stableLogicalHomeBindingHash: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    record !== null &&
    typeof recoveryId === "string" &&
    record.recoveryId === recoveryId &&
    record.managementCapability === managementCapability &&
    typeof stableLogicalHomeBindingHash === "string" &&
    record.stableLogicalHomeBindingHash === stableLogicalHomeBindingHash
  );
}

function withDurableRuntimeStateLock<T>(
  record: DurableRecord,
  operation: () => T,
) {
  const rootBefore = fs.lstatSync(record.rootPath, { bigint: true });
  const observedRoot = record.observeRuntimeStateRoot();
  const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
    record.runtimeStateBindingHash,
  );
  if (!lock)
    throw new Error("docker_task_runtime_state_generation_active_or_unknown");
  let operationResult: T | undefined;
  let operationError: unknown;
  let didOperationThrow = false;
  try {
    const rootAfter = fs.lstatSync(record.rootPath, { bigint: true });
    if (
      rootBefore.dev !== rootAfter.dev ||
      rootBefore.ino !== rootAfter.ino ||
      rootBefore.birthtimeNs !== rootAfter.birthtimeNs
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    verifyObservedRuntimeStateMutationBoundary(
      record,
      record.recoveryId,
      observedRoot,
    );
    operationResult = operation();
  } catch (error) {
    didOperationThrow = true;
    operationError = error;
  }
  if (!lock.release())
    throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
  if (didOperationThrow) throw operationError;
  return operationResult as T;
}

function observeRuntimeStateRootFromWindows(developmentContext?: unknown) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    false,
    new Date().toISOString(),
    developmentContext,
  );
  const current = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" && current ? current : null;
}

function verifyObservedRuntimeStateMutationBoundary(
  expected: Readonly<{
    rootPath: string;
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>,
  recoveryId: string,
  current: VerifiedRuntimeStateRoot | null,
) {
  if (!current) throw new Error("docker_task_runtime_state_binding_changed");
  const inventory = inspectDockerRecoveryRootSnapshot(current.rootPath);
  if (
    inventory.status !== "completed" ||
    !isExactDockerRuntimeStateMutationBoundary(
      expected,
      Object.freeze({
        rootPath: current.rootPath,
        runtimeStateIdentityHash: current.runtimeStateIdentityHash,
        runtimeStateProtectionHash: current.runtimeStateProtectionHash,
        localUserBindingHash: current.localUserBindingHash,
        runtimeStateBindingHash: current.stableLogicalHomeBindingHash,
      }),
      inventory.dockerRecoveryIds,
      recoveryId,
    )
  )
    throw new Error("docker_task_runtime_state_audit_failed");
}

function withFreshHomeAndRuntimeStateLock<T>(
  record: DurableRecord,
  operation: () => T,
) {
  const homeLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    record.stableLogicalHomeBindingHash,
  );
  if (!homeLock)
    throw new Error("docker_task_recovery_home_generation_active_or_unknown");
  let operationResult: T | undefined;
  let operationError: unknown;
  let didOperationThrow = false;
  try {
    operationResult = withDurableRuntimeStateLock(record, operation);
  } catch (error) {
    didOperationThrow = true;
    operationError = error;
  }
  if (!homeLock.release())
    throw new Error("docker_task_recovery_home_lock_release_unconfirmed");
  if (didOperationThrow) throw operationError;
  return operationResult as T;
}

export function markRuntimeOwnedDockerResourceSubmission(
  recoveryCapability: unknown,
  purpose: unknown,
) {
  try {
    const record = durableRecord(recoveryCapability);
    if (!record || typeof purpose !== "string" || !CREATE_PURPOSES.has(purpose))
      return false;
    withDurableRuntimeStateLock(record, () =>
      writeDurableJson(
        record.operationDirectory,
        `submission-${purpose}.json`,
        Object.freeze({
          schema: "crdd-coordinator-docker-resource-submission/v1",
          purpose,
          recoveryId: record.recoveryId,
        }),
      ),
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
    withDurableRuntimeStateLock(record, () => {
      if (
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
        throw new Error("docker_task_recovery_submission_invalid");
      writeDurableJson(
        record.operationDirectory,
        `receipt-${purpose}.json`,
        Object.freeze({
          schema: "crdd-coordinator-docker-resource-receipt/v2",
          purpose,
          dockerId,
          recoveryId: record.recoveryId,
          source: "docker_create_result",
        }),
      );
    });
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
    return withDurableRuntimeStateLock(record, () => {
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
        const submitted = recoveryPathPresent(submission);
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
        if (!submitted && recoveryPathPresent(receipt)) return null;
        let dockerId: string | null = null;
        if (recoveryPathPresent(receipt)) {
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
    });
  } catch {
    return null;
  }
}

export function recordRuntimeOwnedDockerAbsence(recoveryCapability: unknown) {
  try {
    const record = durableRecord(recoveryCapability);
    if (!record) return false;
    withDurableRuntimeStateLock(record, () =>
      writeDurableJson(
        record.operationDirectory,
        "docker-absence.json",
        Object.freeze({
          schema: "crdd-coordinator-docker-absence/v1",
          recoveryId: record.recoveryId,
          allExactResourcesAbsent: true,
        }),
      ),
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
    withDurableRuntimeStateLock(record, () =>
      writeDurableJson(
        record.operationDirectory,
        "mount-completion.json",
        Object.freeze({
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: record.recoveryId,
          evidence: "process_local_capability_completed",
        }),
      ),
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
    !observeRecoveryFile(
      path.join(record.operationDirectory, "docker-absence.json"),
    ) ||
    !observeRecoveryFile(
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
    withDurableRuntimeStateLock(record, () =>
      writeDurableJson(
        record.operationDirectory,
        "host-complete-intent.json",
        hostComplete,
      ),
    );
    const successor = completeOwnedDockerSubmissionRecovery(
      managementCapability,
      current,
    );
    if (successor !== hostComplete.expectedToken)
      return Object.freeze({ status: "blocked" as const });
    withDurableRuntimeStateLock(record, () => {
      const persistedIntent = readExactJson(
        path.join(record.operationDirectory, "host-complete-intent.json"),
      ).value as Record<string, unknown>;
      validateHostTransitionLineage(persistedIntent, "host_only");
      writeDurableJson(
        record.operationDirectory,
        "host-complete-receipt.json",
        Object.freeze({ previous: current, observed: successor }),
      );
      const closure = verifyActiveBindingAndPointerClosure(
        record.hostActiveBindingPath,
        record.pointerPath,
        expectedHostActiveBinding(
          record.recoveryId,
          record.baseHash,
          record.operationNonce,
        ),
        {
          stableLogicalHomeBindingHash: record.stableLogicalHomeBindingHash,
          operationNonce: record.operationNonce,
          recoveryId: record.recoveryId,
          baseHash: record.baseHash,
        },
      );
      if (
        closure.activeState !== "committed" ||
        closure.pointerRecord === null ||
        closure.pointerRecord.hash !== record.pointerHash ||
        closure.pointerRecord.identity !== record.pointerIdentity
      )
        throw new Error("docker_task_recovery_active_run_mismatch");
      if (!removeCommittedDockerRecoveryJson(record.hostActiveBindingPath))
        throw new Error("docker_task_recovery_active_run_mismatch");
      if (observeRecoveryFile(record.hostActiveBindingPath))
        throw new Error("docker_task_recovery_active_run_mismatch");
      if (!removeCommittedDockerRecoveryJson(record.pointerPath))
        throw new Error("docker_task_recovery_pointer_invalid");
      commitDirectoryMutationBoundary(record.rootPath);
      writeDurableJson(
        record.operationDirectory,
        "lease-release-receipt.json",
        Object.freeze({
          schema: "crdd-coordinator-provider-home-lease-release/v1",
          recoveryId: record.recoveryId,
          pointerAbsent: !observeRecoveryFile(record.pointerPath),
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
    });
    if (!record.logicalHomeLease.release())
      return Object.freeze({ status: "blocked" as const });
    releasedLogicalHomeLeases.add(recoveryCapability as object);
    const cleanupCapability = issueOwnedHostCleanupCapability(
      managementCapability,
      recoveryCapability,
    );
    dockerHostCleanupCapabilities.set(
      recoveryCapability as object,
      cleanupCapability,
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
      observeRecoveryFile(record.pointerPath) ||
      !observeRecoveryFile(
        path.join(record.operationDirectory, "host-cleanup-receipt.json"),
      )
    )
      return Object.freeze({ status: "blocked" as const });
    const parsed = parseDockerTaskRecoveryId(record.recoveryId);
    if (!parsed) return Object.freeze({ status: "blocked" as const });
    withFreshHomeAndRuntimeStateLock(record, () => {
      if (
        observeRecoveryFile(record.pointerPath) ||
        !observeRecoveryFile(
          path.join(record.operationDirectory, "host-cleanup-receipt.json"),
        )
      )
        throw new Error("docker_task_recovery_finalization_invalid");
      removeRecoveryOperationDirectory(
        record.operationDirectory,
        record.recoveryId,
        parsed.operationNonce,
        record.baseHash,
        record.stableLogicalHomeBindingHash,
        Object.freeze({
          runtimeStateIdentityHash: record.runtimeStateIdentityHash,
          runtimeStateProtectionHash: record.runtimeStateProtectionHash,
          localUserBindingHash: record.localUserBindingHash,
          runtimeStateBindingHash: record.runtimeStateBindingHash,
        }),
      );
      commitDirectoryMutationBoundary(record.rootPath);
    });
    durableRecords.delete(recoveryFinalizationCapability as object);
    dockerHostCleanupCapabilities.delete(
      recoveryFinalizationCapability as object,
    );
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
      !recoveryPathPresent(
        path.join(record.operationDirectory, "normal-run-complete.json"),
      )
    )
      return null;
    const cleanupCapability = dockerHostCleanupCapabilities.get(
      recoveryFinalizationCapability as object,
    );
    if (!cleanupCapability) return null;
    const currentHostRecoveryId = consumeOwnedHostRecoveryIdForCleanup(
      cleanupCapability,
      recoveryFinalizationCapability,
    );
    dockerHostCleanupCapabilities.delete(
      recoveryFinalizationCapability as object,
    );
    const intentPath = path.join(
      record.operationDirectory,
      "host-cleanup-intent.json",
    );
    return withFreshHomeAndRuntimeStateLock(record, () => {
      if (recoveryPathPresent(intentPath)) {
        const intent = readExactJson(intentPath).value as Record<
          string,
          unknown
        >;
        if (
          intent.schema !== "crdd-coordinator-host-cleanup-intent/v1" ||
          intent.recoveryId !== record.recoveryId ||
          intent.currentHostRecoveryId !== currentHostRecoveryId
        )
          throw new Error("docker_task_recovery_host_cleanup_intent_invalid");
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
    });
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
      !recoveryPathPresent(
        path.join(record.operationDirectory, "host-cleanup-intent.json"),
      ) ||
      recoveryPathPresent(record.hostRootPath) ||
      recoveryPathPresent(record.hostMarkerPath)
    )
      return false;
    return withFreshHomeAndRuntimeStateLock(record, () => {
      if (
        recoveryPathPresent(record.hostRootPath) ||
        recoveryPathPresent(record.hostMarkerPath)
      )
        throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
      const receiptPath = path.join(
        record.operationDirectory,
        "host-cleanup-receipt.json",
      );
      if (recoveryPathPresent(receiptPath)) {
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
    });
  } catch {
    return false;
  }
}

export function abandonRuntimeOwnedDockerRecovery(recoveryCapability: unknown) {
  const record = durableRecord(recoveryCapability);
  if (!record) return false;
  dockerHostCleanupCapabilities.delete(recoveryCapability as object);
  if (releasedLogicalHomeLeases.has(recoveryCapability as object)) return true;
  const released = record.logicalHomeLease.release();
  if (released) releasedLogicalHomeLeases.add(recoveryCapability as object);
  return released;
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
  /^(?:base|base-commit|host-(?:begin|complete|crash-absence|cleanup)-(?:intent|receipt)|host-precleanup-finalization-intent|submission-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|receipt-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|restart-fence-(?:create_subscription_auth_probe|create_internal_network|create_egress_network|create_proxy|create_provider)|docker-absence(?:-crash)?|mount-(?:completion|crash-absence)|lease-release-receipt|normal-run-complete)\.json$/u;

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
  const record = value as Record<string, unknown>;
  const baseKeys = [
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
    "runtimeStateBinding",
    "ownershipLabel",
    "resources",
    "images",
    "operationMode",
    "workspaceMountMode",
    "initialHostRecoveryId",
    "initialHostRecovery",
    "hostPaths",
  ];
  const hasCorrelation = Object.hasOwn(record ?? {}, "recoveryCorrelationId");
  if (
    !exactRecordKeys(
      value,
      hasCorrelation ? [...baseKeys, "recoveryCorrelationId"] : baseKeys,
    )
  )
    return false;
  const base = value as Record<string, unknown>;
  const resources = base.resources;
  const images = base.images;
  const hostPaths = base.hostPaths;
  const runtimeStateBinding = base.runtimeStateBinding;
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
    validRuntimeStateBindingEvidence(runtimeStateBinding) &&
    (runtimeStateBinding as RuntimeStateBindingEvidence)
      .localUserBindingHash === base.localUserBindingHash &&
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
    (!hasCorrelation ||
      (typeof base.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          base.recoveryCorrelationId,
        ))) &&
    validateHostSnapshot(base.initialHostRecovery, initialToken) &&
    exactRecordKeys(hostPaths, ["root", "marker"]) &&
    typeof (hostPaths as Record<string, unknown>).root === "string" &&
    typeof (hostPaths as Record<string, unknown>).marker === "string"
  );
}

function validateDockerRecoveryBaseCommit(
  value: unknown,
  nonce: string,
  baseHash: string,
  recoveryId: string,
) {
  const record = value as Record<string, unknown>;
  const keys = [
    "schema",
    "operationNonce",
    "stableLogicalHomeBindingHash",
    "baseHash",
    "recoveryId",
  ];
  const hasCorrelation = Object.hasOwn(record ?? {}, "recoveryCorrelationId");
  return (
    exactRecordKeys(
      value,
      hasCorrelation ? [...keys, "recoveryCorrelationId"] : keys,
    ) &&
    record.schema === "crdd-coordinator-task-docker-base-commit/v1" &&
    record.operationNonce === nonce &&
    record.baseHash === baseHash &&
    record.recoveryId === recoveryId &&
    (!hasCorrelation ||
      (typeof record.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          record.recoveryCorrelationId,
        )))
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
    return validateDockerRecoveryBaseCommit(value, nonce, baseHash, recoveryId);
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
  if (/^receipt-/u.test(name)) {
    const record = value as Record<string, unknown>;
    const commonMatches =
      record.recoveryId === recoveryId &&
      CREATE_PURPOSES.has(String(record.purpose)) &&
      name === `receipt-${String(record.purpose)}.json` &&
      HEX64.test(String(record.dockerId));
    const legacyMatches =
      exactRecordKeys(value, ["schema", "purpose", "dockerId", "recoveryId"]) &&
      record.schema === "crdd-coordinator-docker-resource-receipt/v1";
    const currentMatches =
      exactRecordKeys(value, [
        "schema",
        "purpose",
        "dockerId",
        "recoveryId",
        "source",
      ]) &&
      record.schema === "crdd-coordinator-docker-resource-receipt/v2" &&
      ["docker_create_result", "runtime_reconciliation"].includes(
        String(record.source),
      );
    return commonMatches && (legacyMatches || currentMatches);
  }
  if (/^restart-fence-/u.test(name))
    return (
      exactRecordKeys(value, [
        "schema",
        "purpose",
        "recoveryId",
        "repairId",
        "repairRecordSha256",
        "exactResourceAbsent",
      ]) &&
      (value as Record<string, unknown>).schema ===
        "crdd-coordinator-docker-engine-restart-fence/v1" &&
      (value as Record<string, unknown>).recoveryId === recoveryId &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(
        String((value as Record<string, unknown>).repairId),
      ) &&
      HEX64.test(
        String((value as Record<string, unknown>).repairRecordSha256),
      ) &&
      (value as Record<string, unknown>).exactResourceAbsent === true &&
      CREATE_PURPOSES.has(String((value as Record<string, unknown>).purpose)) &&
      name ===
        `restart-fence-${String((value as Record<string, unknown>).purpose)}.json`
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
        "recordBefore",
      ]) &&
      typeof record.currentToken === "string" &&
      typeof record.expectedToken === "string" &&
      typeof record.rootName === "string" &&
      typeof record.nonce === "string" &&
      record.recordBefore !== null &&
      typeof record.recordBefore === "object" &&
      !Array.isArray(record.recordBefore)
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
  if (name === "host-precleanup-finalization-intent.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "operationNonce",
        "baseHash",
        "stableLogicalHomeBindingHash",
        "initialHostRecoveryId",
        "hostRootAbsent",
        "hostMarkerAbsent",
        "submissionAbsent",
      ]) &&
      record.schema ===
        "crdd-coordinator-host-precleanup-finalization-intent/v1" &&
      record.recoveryId === recoveryId &&
      record.operationNonce === nonce &&
      record.baseHash === baseHash &&
      typeof record.stableLogicalHomeBindingHash === "string" &&
      HEX64.test(String(record.stableLogicalHomeBindingHash)) &&
      typeof record.initialHostRecoveryId === "string" &&
      record.hostRootAbsent === true &&
      record.hostMarkerAbsent === true &&
      record.submissionAbsent === true
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
  splitMoveRecords: ReadonlyMap<
    string,
    Readonly<{ value: unknown }>
  > = new Map(),
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
      (!names.has(dockerRecoveryCommitName(entry.name)) &&
        !splitMoveRecords.has(entry.name))
    )
      throw new Error("docker_task_recovery_unknown_entry");
    dataNames.push(entry.name);
  }
  for (const name of dataNames) {
    const record =
      splitMoveRecords.get(name) ??
      readExactJson(path.join(operationDirectory, name));
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
    const requiredNextState =
      phase === "begin"
        ? "docker_submission_started"
        : phase === "complete"
          ? "host_only"
          : "docker_absent_confirmed";
    validateHostTransitionLineage(intent, requiredNextState);
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
  if (
    recoveryPathPresent(hostPaths.root) ||
    recoveryPathPresent(hostPaths.marker)
  )
    throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
  const receiptPath = path.join(
    operationDirectory,
    "host-cleanup-receipt.json",
  );
  if (recoveryPathPresent(receiptPath)) {
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

function expectedHostActiveBinding(
  recoveryId: string,
  baseHash: string,
  operationNonce: string,
) {
  return Object.freeze({
    schema: "crdd-coordinator-host-active-docker-task/v1",
    recoveryId,
    baseHash,
    operationNonce,
  });
}

function validateHostActiveBinding(
  value: unknown,
  expected: ReturnType<typeof expectedHostActiveBinding>,
) {
  if (
    !exactRecordKeys(value, [
      "schema",
      "recoveryId",
      "baseHash",
      "operationNonce",
    ]) ||
    (value as Record<string, unknown>).schema !== expected.schema ||
    (value as Record<string, unknown>).recoveryId !== expected.recoveryId ||
    (value as Record<string, unknown>).baseHash !== expected.baseHash ||
    (value as Record<string, unknown>).operationNonce !==
      expected.operationNonce
  )
    throw new Error("docker_task_recovery_active_run_mismatch");
}

function validateActiveLeasePointer(
  value: unknown,
  expected: Readonly<{
    stableLogicalHomeBindingHash: string;
    operationNonce: string;
    recoveryId: string;
    baseHash: string;
  }>,
) {
  if (
    !exactRecordKeys(value, [
      "schema",
      "stableLogicalHomeBindingHash",
      "operationName",
      "recoveryId",
      "baseHash",
    ]) ||
    (value as Record<string, unknown>).schema !==
      "crdd-coordinator-provider-home-active-lease/v1" ||
    (value as Record<string, unknown>).stableLogicalHomeBindingHash !==
      expected.stableLogicalHomeBindingHash ||
    (value as Record<string, unknown>).operationName !==
      `docker-task-${expected.operationNonce}` ||
    (value as Record<string, unknown>).recoveryId !== expected.recoveryId ||
    (value as Record<string, unknown>).baseHash !== expected.baseHash
  )
    throw new Error("docker_task_recovery_pointer_mismatch");
}

function observeRecoveryPath(target: string) {
  try {
    return fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw new Error("docker_task_recovery_record_observation_unknown");
  }
}

function recoveryPathPresent(target: string) {
  return observeRecoveryPath(target) !== null;
}

function observeRecoveryFile(target: string) {
  const metadata = observeRecoveryPath(target);
  if (metadata === null) return false;
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("docker_task_recovery_record_observation_unknown");
  return true;
}

function verifyActiveBindingAndPointerClosure(
  activeBindingPath: string,
  pointerPath: string,
  expectedActive: ReturnType<typeof expectedHostActiveBinding>,
  expectedPointer: Readonly<{
    stableLogicalHomeBindingHash: string;
    operationNonce: string;
    recoveryId: string;
    baseHash: string;
  }>,
) {
  const activeCommitPath = path.join(
    path.dirname(activeBindingPath),
    dockerRecoveryCommitName(path.basename(activeBindingPath)),
  );
  const pointerCommitPath = path.join(
    path.dirname(pointerPath),
    dockerRecoveryCommitName(path.basename(pointerPath)),
  );
  const activePresent = observeRecoveryFile(activeBindingPath);
  const activeCommitPresent = observeRecoveryFile(activeCommitPath);
  const pointerPresent = observeRecoveryFile(pointerPath);
  const pointerCommitPresent = observeRecoveryFile(pointerCommitPath);
  if (!activePresent) {
    if (activeCommitPresent)
      throw new Error("docker_task_recovery_active_run_mismatch");
    if (pointerPresent !== pointerCommitPresent)
      throw new Error("docker_task_recovery_pointer_mismatch");
    if (!pointerPresent)
      return Object.freeze({
        activeState: "absent" as const,
        pointerState: "absent" as const,
        pointerRecord: null,
      });
    const pointerRecord = readExactJson(pointerPath);
    validateActiveLeasePointer(pointerRecord.value, expectedPointer);
    return Object.freeze({
      activeState: "absent" as const,
      pointerState: "committed" as const,
      pointerRecord,
    });
  }
  if (!pointerPresent || !pointerCommitPresent)
    throw new Error("docker_task_recovery_pointer_mismatch");
  const activeValue = activeCommitPresent
    ? readExactJson(activeBindingPath).value
    : JSON.parse(fs.readFileSync(activeBindingPath, "utf8"));
  validateHostActiveBinding(activeValue, expectedActive);
  const pointerRecord = readExactJson(pointerPath);
  validateActiveLeasePointer(pointerRecord.value, expectedPointer);
  return Object.freeze({
    activeState: activeCommitPresent
      ? ("committed" as const)
      : ("uncommitted" as const),
    pointerState: "committed" as const,
    pointerRecord,
  });
}

function removeRecoveryOperationDirectory(
  operationDirectory: string,
  recoveryId: string,
  nonce: string,
  baseHash: string,
  stableLogicalHomeBindingHash: string,
  runtimeStateBinding: RuntimeStateBindingEvidence,
  shouldPersistCompletionReceipt = false,
) {
  inventoryOperationDirectory(operationDirectory, recoveryId, nonce, baseHash);
  const cleanupDirectory = path.join(
    path.dirname(operationDirectory),
    `cleanup-docker-task-${stableLogicalHomeBindingHash}-${nonce}-${baseHash}`,
  );
  if (recoveryPathPresent(cleanupDirectory))
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
    runtimeStateBinding,
    originalEntries: Object.freeze(originalEntries),
  });
  verifyRecoveryCleanupManifest(operationDirectory, recoveryId);
  if (shouldPersistCompletionReceipt)
    ensureCompletedDockerRecoveryReceipt(
      path.dirname(operationDirectory),
      recoveryId,
      runtimeStateBinding,
    );
  fs.renameSync(operationDirectory, cleanupDirectory);
  commitDirectoryMutationBoundary(path.dirname(operationDirectory));
  verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
  removeDockerRecoveryCleanupDirectory(
    path.dirname(cleanupDirectory),
    cleanupDirectory,
    recoveryId,
    runtimeStateBinding,
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
      "runtimeStateBinding",
      "originalEntries",
    ]) ||
    manifest.schema !== "crdd-coordinator-recovery-cleanup-manifest/v1" ||
    manifest.recoveryId !== recoveryId ||
    typeof manifest.sourceDirectoryIdentity !== "string" ||
    typeof manifest.cleanupName !== "string" ||
    !validRuntimeStateBindingEvidence(manifest.runtimeStateBinding) ||
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
  return Object.freeze({
    runtimeStateBinding:
      manifest.runtimeStateBinding as RuntimeStateBindingEvidence,
  });
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
  const manifest = verifyRecoveryCleanupManifest(cleanupDirectory, recoveryId);
  return removeDockerRecoveryCleanupDirectory(
    path.dirname(cleanupDirectory),
    cleanupDirectory,
    recoveryId,
    manifest.runtimeStateBinding,
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
    if (!observeRecoveryFile(basePath)) return false;
    const base = readExactJson(basePath).value as Record<string, unknown>;
    if (hostPathsFromBase(base).root !== hostRoot) continue;
    const normalComplete = observeRecoveryFile(
      path.join(directory, "normal-run-complete.json"),
    );
    const crashComplete =
      directory === targetOperationDirectory &&
      observeRecoveryFile(path.join(directory, "docker-absence-crash.json")) &&
      observeRecoveryFile(path.join(directory, "mount-crash-absence.json"));
    if (!normalComplete && !crashComplete) return false;
    const stable = base.stableLogicalHomeBindingHash;
    if (
      typeof stable !== "string" ||
      !HEX64.test(stable) ||
      observeRecoveryFile(
        path.join(runtimeStateRoot, `active-lease-${stable}.json`),
      )
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
    if (!recoveryPathPresent(basePath)) continue;
    const base = readExactJson(basePath).value as Record<string, unknown>;
    if (hostPathsFromBase(base).root !== hostRoot) continue;
    for (const [name, key] of [
      ["normal-run-complete.json", "hostSuccessor"],
      ["host-crash-absence-receipt.json", "observed"],
      ["host-complete-receipt.json", "observed"],
      ["host-begin-receipt.json", "observed"],
    ] as const) {
      const file = path.join(directory, name);
      if (!recoveryPathPresent(file)) continue;
      const value = readExactJson(file).value as Record<string, unknown>;
      if (typeof value[key] === "string") candidates.add(String(value[key]));
    }
  }
  const currentRecoveryIds = [...candidates].filter((candidate) => {
    try {
      loadHostRecoveryRecordByToken(candidate);
      return true;
    } catch {
      return false;
    }
  });
  return currentRecoveryIds.length === 1 ? currentRecoveryIds[0] : null;
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
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_recovery_environment_unavailable");
  const result = spawnSync(
    DOCKER_EXECUTABLE,
    ["--host", DOCKER_ENGINE, "--config", configDirectory, ...argv],
    {
      windowsHide: true,
      shell: false,
      env: environment,
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

type RecoveryDockerResult = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: Error | null;
}>;

/** @internal Package-private exact resource verifier used by production recovery. */
export function recoverExactDockerResourceWithRunner(
  runDocker: (argv: readonly string[]) => RecoveryDockerResult,
  kind: "container" | "network",
  dockerId: string,
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  shouldBeInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task",
  workspaceMountMode: "read_write" | "read_only" | null,
  options: Readonly<{
    allowAlreadyAbsent?: boolean;
    removeAfterVerification?: boolean;
  }> = Object.freeze({}),
) {
  const exactNameAbsent = () => {
    const named = runDocker(
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
  const listed = runDocker(listArgs);
  if (
    listed.status !== 0 ||
    listed.signal ||
    listed.error ||
    listed.stderr.length
  )
    return false;
  const ids = listed.stdout.trim() ? listed.stdout.trim().split(/\r?\n/u) : [];
  if (ids.length === 0)
    return options.allowAlreadyAbsent !== false && exactNameAbsent();
  if (ids.length !== 1 || ids[0] !== dockerId) return false;
  const inspected = runDocker(
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
    const droppedCapabilities = Array.isArray(hostConfig?.CapDrop)
      ? hostConfig.CapDrop.map(String)
      : [];
    const capAdd = hostConfig?.CapAdd;
    const securityOptions = Array.isArray(hostConfig?.SecurityOpt)
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
      droppedCapabilities.length === 1 &&
      droppedCapabilities[0]?.toUpperCase() === "ALL" &&
      (capAdd === null || (Array.isArray(capAdd) && capAdd.length === 0)) &&
      securityOptions.some((option) =>
        option.startsWith("no-new-privileges"),
      ) &&
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
    (kind === "network" && value.Internal !== shouldBeInternal) ||
    !configurationMatches
  )
    return false;
  if (options.removeAfterVerification === false) return true;
  const removed = runDocker(
    kind === "container"
      ? ["container", "rm", "--force", dockerId]
      : ["network", "rm", dockerId],
  );
  if (removed.status !== 0 || removed.signal || removed.error) return false;
  const absent = runDocker(listArgs);
  return (
    absent.status === 0 &&
    !absent.signal &&
    !absent.error &&
    absent.stderr.length === 0 &&
    absent.stdout.trim() === "" &&
    exactNameAbsent()
  );
}

/**
 * Resolve the crash window after an exact create submission was durably
 * recorded but before Docker's returned ID could be persisted. The
 * operation-owned name and operation-unique ownership label must identify the
 * same single resource. Empty observations do not settle an already submitted
 * create because the original Docker CLI or daemon request may still complete
 * after the observation. A foreign, ambiguous, partially observed, or absent
 * resource is never adopted or removed.
 *
 * @internal Package-private verifier used by production recovery.
 */
export function recoverUnknownDockerCreateOutcomeWithRunner(
  runDocker: (argv: readonly string[]) => RecoveryDockerResult,
  kind: "container" | "network",
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  shouldBeInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task",
  workspaceMountMode: "read_write" | "read_only" | null,
) {
  const list = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  const ids = (result: RecoveryDockerResult) => {
    if (
      result.status !== 0 ||
      result.signal ||
      result.error ||
      result.stderr.length !== 0
    )
      return null;
    const values = result.stdout.trim()
      ? result.stdout.trim().split(/\r?\n/u)
      : [];
    return values.length <= 1 && values.every((value) => HEX64.test(value))
      ? values
      : null;
  };
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const labelFilter = `label=${ownershipLabel}`;
  const byNameItems = ids(list(nameFilter));
  const byOwnershipItems = ids(list(nameFilter, labelFilter));
  if (!byNameItems || !byOwnershipItems) return null;
  if (byNameItems.length === 0 && byOwnershipItems.length === 0) return null;
  if (
    byNameItems.length !== 1 ||
    byOwnershipItems.length !== 1 ||
    byNameItems[0] !== byOwnershipItems[0]
  )
    return null;
  return recoverExactDockerResourceWithRunner(
    runDocker,
    kind,
    byNameItems[0] as string,
    expectedName,
    ownershipLabel,
    expectedImage,
    shouldBeInternal,
    purpose,
    expectedNetworks,
    operationMode,
    workspaceMountMode,
    Object.freeze({
      allowAlreadyAbsent: false,
      removeAfterVerification: false,
    }),
  )
    ? (byNameItems[0] as string)
    : null;
}

function observeSubmittedDockerResourceAbsentWithRunner(
  runDocker: (argv: readonly string[]) => RecoveryDockerResult,
  kind: "container" | "network",
  expectedName: string,
  ownershipLabel: string,
) {
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const executeRecoveryOperation = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  return [
    executeRecoveryOperation(nameFilter),
    executeRecoveryOperation(nameFilter, `label=${ownershipLabel}`),
  ].every(
    (result) =>
      result.status === 0 &&
      !result.signal &&
      !result.error &&
      result.stderr.length === 0 &&
      result.stdout.trim() === "",
  );
}

function recoverExactDockerResource(
  configDirectory: string,
  configIdentity: string,
  kind: "container" | "network",
  dockerId: string,
  expectedName: string,
  ownershipLabel: string,
  expectedImage: string | null,
  shouldBeInternal: boolean | null,
  purpose: string,
  expectedNetworks: readonly string[],
  operationMode: "boolean_probe" | "isolated_task",
  workspaceMountMode: "read_write" | "read_only" | null,
) {
  return recoverExactDockerResourceWithRunner(
    (argv) => runRecoveryDocker(configDirectory, configIdentity, argv),
    kind,
    dockerId,
    expectedName,
    ownershipLabel,
    expectedImage,
    shouldBeInternal,
    purpose,
    expectedNetworks,
    operationMode,
    workspaceMountMode,
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
    | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
    | null = null;
  for (const candidate of [operationBase, pendingBase]) {
    if (!recoveryPathPresent(candidate)) continue;
    try {
      record = readCommittedDockerRecoveryJson(candidate, "base.json");
      break;
    } catch {
      // A move intent can temporarily split the exact pair. Its fsynced anchor
      // remains the only discovery authority until locks are acquired.
    }
  }
  record ??= discoverDockerRecoveryJournalJsonForRecovery(
    rootPath,
    "base.json",
    parsed.token,
  );
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

function discoverRecoveryRuntimeStateBinding(
  rootPath: string,
  parsed: NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>,
) {
  const completionReceipt = inspectCompletedDockerRecoveryReceipt(
    rootPath,
    parsed.token,
  );
  if (completionReceipt) return completionReceipt.runtimeStateBinding;
  const cleanupIntent = inspectDockerRecoveryJournalDirectory(rootPath).find(
    (intent) =>
      intent.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
      intent.recoveryId === parsed.token,
  );
  if (cleanupIntent?.runtimeStateBinding) {
    if (!validRuntimeStateBindingEvidence(cleanupIntent.runtimeStateBinding))
      throw new Error("docker_task_runtime_state_binding_evidence_invalid");
    return cleanupIntent.runtimeStateBinding;
  }
  const cleanupDirectory = path.join(
    rootPath,
    `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
  );
  if (recoveryPathPresent(cleanupDirectory))
    return verifyRecoveryCleanupManifest(cleanupDirectory, parsed.token)
      .runtimeStateBinding;
  const operationDirectory = path.join(
    rootPath,
    `docker-task-${parsed.operationNonce}`,
  );
  if (
    recoveryPathPresent(path.join(operationDirectory, "cleanup-manifest.json"))
  )
    return verifyRecoveryCleanupManifest(operationDirectory, parsed.token)
      .runtimeStateBinding;
  const operationBase = path.join(operationDirectory, "base.json");
  const pendingBase = path.join(
    rootPath,
    `pending-docker-task-${parsed.operationNonce}.json`,
  );
  let record:
    | ReturnType<typeof readCommittedDockerRecoveryJson>
    | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
    | null = null;
  for (const candidate of [operationBase, pendingBase]) {
    if (!recoveryPathPresent(candidate)) continue;
    try {
      record = readCommittedDockerRecoveryJson(candidate, "base.json");
      break;
    } catch {
      // A durable move intent remains the read-only authority until resume.
    }
  }
  record ??= discoverDockerRecoveryJournalJsonForRecovery(
    rootPath,
    "base.json",
    parsed.token,
  );
  if (
    !record ||
    record.hash !== parsed.baseHash ||
    !validateDockerRecoveryBase(record.value, parsed.operationNonce)
  )
    return null;
  const base = record.value as Record<string, unknown>;
  if (base.stableLogicalHomeBindingHash !== parsed.stableLogicalHomeBindingHash)
    throw new Error("docker_task_recovery_base_mismatch");
  return base.runtimeStateBinding as RuntimeStateBindingEvidence;
}

/**
 * @internal Package-private engine. The production wrapper supplies the native
 * observer; contract tests may supply an exact fixed observation.
 */
export function recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
  token: unknown,
  root: VerifiedRuntimeStateRoot,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null,
  recoveryDockerRunner:
    | ((argv: readonly string[]) => RecoveryDockerResult)
    | null = null,
  restartFence: VerifiedDockerEngineRestartFence | null = null,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_id_invalid",
      recoveryId: null,
    });
  if (restartFence && restartFence.recoveryId !== parsed.token)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_restart_fence_mismatch",
      recoveryId: parsed.token,
    });
  let durableRuntimeStateBinding: RuntimeStateBindingEvidence | null;
  try {
    durableRuntimeStateBinding = discoverRecoveryRuntimeStateBinding(
      root.rootPath,
      parsed,
    );
    if (!durableRuntimeStateBinding)
      throw new Error("docker_task_recovery_evidence_missing");
    if (
      durableRuntimeStateBinding.runtimeStateIdentityHash !==
        root.runtimeStateIdentityHash ||
      durableRuntimeStateBinding.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      durableRuntimeStateBinding.runtimeStateBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_runtime_state_binding_changed");
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_runtime_state_binding_evidence_invalid",
      ),
      recoveryId: parsed.token,
    });
  }
  const preliminaryInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
  const recoveryStillPresent =
    preliminaryInventory.status === "completed" &&
    preliminaryInventory.dockerRecoveryIds.some(
      (value: unknown) => value === parsed.token,
    );
  if (!recoveryStillPresent) {
    const completionReceipt = inspectCompletedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (preliminaryInventory.status === "completed" && completionReceipt) {
      const homeLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
        parsed.stableLogicalHomeBindingHash,
      );
      const stateLock = homeLock
        ? createDockerRecoveryRuntimeStateLockController(
            root.stableLogicalHomeBindingHash,
          )
        : null;
      if (homeLock && stateLock) {
        let isReplaySucceeded = false;
        let replayFailureReason = "docker_task_runtime_state_audit_failed";
        try {
          ensureDockerTaskSessionHandoff(
            root,
            parsed.token,
            durableRuntimeStateBinding,
          );
          const observed = observeRuntimeStateRoot();
          if (
            !observed ||
            observed.runtimeStateIdentityHash !==
              root.runtimeStateIdentityHash ||
            observed.runtimeStateProtectionHash !==
              root.runtimeStateProtectionHash ||
            observed.localUserBindingHash !== root.localUserBindingHash ||
            observed.stableLogicalHomeBindingHash !==
              root.stableLogicalHomeBindingHash
          )
            throw new Error("docker_task_runtime_state_binding_changed");
          isReplaySucceeded = true;
        } catch (error) {
          replayFailureReason = safeRecoveryReason(
            error,
            "docker_task_runtime_state_audit_failed",
          );
        }
        const releaseFailure = releaseRecoverySynchronizations([
          {
            release: () => stateLock.close(),
            reason: "docker_task_runtime_state_lock_release_unconfirmed",
          },
          {
            release: () => homeLock.release(),
            reason: "docker_task_recovery_home_lock_release_unconfirmed",
          },
        ]);
        if (releaseFailure)
          return Object.freeze({
            status: "blocked" as const,
            reason: releaseFailure,
            recoveryId: parsed.token,
          });
        if (isReplaySucceeded)
          return Object.freeze({
            status: "recovered" as const,
            reason: "docker_task_recovery_completion_replayed",
            recoveryId: null,
          });
        return Object.freeze({
          status: "blocked" as const,
          reason: replayFailureReason,
          recoveryId: parsed.token,
        });
      } else if (homeLock && !homeLock.release())
        return Object.freeze({
          status: "blocked" as const,
          reason: "docker_task_recovery_home_lock_release_unconfirmed",
          recoveryId: parsed.token,
        });
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_runtime_state_audit_failed",
      recoveryId: parsed.token,
    });
  }
  const cleanupDirectoryCandidate = path.join(
    root.rootPath,
    `cleanup-docker-task-${parsed.stableLogicalHomeBindingHash}-${parsed.operationNonce}-${parsed.baseHash}`,
  );
  const cleanupIntentPresent = inspectDockerRecoveryJournalDirectory(
    root.rootPath,
  ).some((intent) => intent.recoveryId === parsed.token);
  let hostOperationGeneration: object | null = null;
  let hostOperationGenerationIdentity: Readonly<{
    hostRoot: string;
    hostNonce: string;
  }> | null = null;
  if (
    !recoveryPathPresent(cleanupDirectoryCandidate) &&
    !cleanupIntentPresent
  ) {
    try {
      const discovered = discoverRecoveryHostBinding(root.rootPath, parsed);
      hostOperationGenerationIdentity = Object.freeze({
        hostRoot: discovered.hostRoot,
        hostNonce: discovered.hostNonce,
      });
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
    const releaseFailure = releaseRecoverySynchronizations(
      hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : [],
    );
    return Object.freeze({
      status: "blocked" as const,
      reason:
        releaseFailure ?? "docker_task_process_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  }
  const runtimeStateLockController =
    createDockerRecoveryRuntimeStateLockController(
      root.stableLogicalHomeBindingHash,
    );
  if (!runtimeStateLockController) {
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => processAbsenceLock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
      ...(hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : []),
    ]);
    return Object.freeze({
      status: "blocked" as const,
      reason:
        releaseFailure ??
        "docker_task_runtime_state_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  }
  const outsideHostOperationGenerationLock = <T>(effect: () => T) => {
    if (!hostOperationGeneration || !hostOperationGenerationIdentity)
      return effect();
    const hostRootBefore = recoveryPathPresent(
      hostOperationGenerationIdentity.hostRoot,
    )
      ? fs.lstatSync(hostOperationGenerationIdentity.hostRoot, {
          bigint: true,
        })
      : null;
    const generationToRelease = hostOperationGeneration;
    hostOperationGeneration = null;
    if (!releaseHostOperationRecoveryGeneration(generationToRelease))
      throw new Error("docker_task_recovery_host_lock_release_unconfirmed");
    let effectResult: T | null = null;
    let effectError: unknown = null;
    try {
      effectResult = effect();
    } catch (error) {
      effectError = error;
    }
    hostOperationGeneration = acquireHostOperationRecoveryGenerationByIdentity(
      hostOperationGenerationIdentity.hostRoot,
      hostOperationGenerationIdentity.hostNonce,
    );
    if (!hostOperationGeneration)
      throw new Error(
        "docker_task_host_operation_generation_active_or_unknown",
      );
    const hostRootAfter = recoveryPathPresent(
      hostOperationGenerationIdentity.hostRoot,
    )
      ? fs.lstatSync(hostOperationGenerationIdentity.hostRoot, {
          bigint: true,
        })
      : null;
    if (
      Boolean(hostRootBefore) !== Boolean(hostRootAfter) ||
      (hostRootBefore &&
        hostRootAfter &&
        (hostRootBefore.dev !== hostRootAfter.dev ||
          hostRootBefore.ino !== hostRootAfter.ino ||
          hostRootBefore.birthtimeNs !== hostRootAfter.birthtimeNs))
    )
      throw new Error("docker_task_recovery_host_binding_changed");
    if (effectError) throw effectError;
    return effectResult as T;
  };
  let sessionHandoff: DockerTaskSessionHandoffState;
  try {
    const currentBeforeHandoff = runtimeStateLockController.outsideLock(() =>
      outsideHostOperationGenerationLock(observeRuntimeStateRoot),
    );
    if (
      !currentBeforeHandoff ||
      currentBeforeHandoff.runtimeStateIdentityHash !==
        root.runtimeStateIdentityHash ||
      currentBeforeHandoff.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      currentBeforeHandoff.localUserBindingHash !== root.localUserBindingHash ||
      currentBeforeHandoff.stableLogicalHomeBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    sessionHandoff = ensureDockerTaskSessionHandoff(
      root,
      parsed.token,
      durableRuntimeStateBinding,
    );
  } catch (error) {
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => runtimeStateLockController.close(),
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
      },
      {
        release: () => processAbsenceLock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
      ...(hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : []),
    ]);
    return Object.freeze({
      status: "blocked" as const,
      reason:
        releaseFailure ??
        safeRecoveryReason(error, "docker_task_session_handoff_failed_closed"),
      recoveryId: parsed.token,
    });
  }
  const runtimeStateBinding = Object.freeze({
    rootPath: root.rootPath,
    ...durableRuntimeStateBinding,
    // The durable record keeps the issuing session. Mutations after a verified
    // handoff are authorized only by the fresh current-session observation.
    localUserBindingHash: sessionHandoff.currentLocalUserBindingHash,
  });
  const recoverySessionLocalUserBindingHash: string | null =
    sessionHandoff.currentLocalUserBindingHash;
  const outsideRecoveryGenerationLocks = <T>(effect: () => T) => {
    const reboundDurableBinding = discoverRecoveryRuntimeStateBinding(
      root.rootPath,
      parsed,
    );
    if (
      !reboundDurableBinding ||
      reboundDurableBinding.runtimeStateIdentityHash !==
        durableRuntimeStateBinding.runtimeStateIdentityHash ||
      reboundDurableBinding.runtimeStateProtectionHash !==
        durableRuntimeStateBinding.runtimeStateProtectionHash ||
      reboundDurableBinding.runtimeStateBindingHash !==
        durableRuntimeStateBinding.runtimeStateBindingHash ||
      !recoverySessionLocalUserBindingHash
    )
      throw new Error("docker_task_runtime_state_user_binding_changed");
    const reboundHandoff = inspectDockerTaskSessionHandoffs(
      root.rootPath,
      parsed.token,
      durableRuntimeStateBinding,
    );
    if (
      reboundHandoff.currentLocalUserBindingHash !==
        recoverySessionLocalUserBindingHash ||
      recoverySessionLocalUserBindingHash !== root.localUserBindingHash
    )
      throw new Error("docker_task_runtime_state_user_binding_changed");
    const rootBefore = fs.lstatSync(root.rootPath, { bigint: true });
    let observedRoot: VerifiedRuntimeStateRoot | null = null;
    const effectResult = runtimeStateLockController.outsideLock(() =>
      outsideHostOperationGenerationLock(() => {
        const result = effect();
        observedRoot = observeRuntimeStateRoot();
        return result;
      }),
    );
    const rootAfter = fs.lstatSync(root.rootPath, { bigint: true });
    if (
      rootBefore.dev !== rootAfter.dev ||
      rootBefore.ino !== rootAfter.ino ||
      rootBefore.birthtimeNs !== rootAfter.birthtimeNs
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    verifyObservedRuntimeStateMutationBoundary(
      runtimeStateBinding,
      parsed.token,
      observedRoot,
    );
    return effectResult;
  };
  const verifyRecoveryRuntimeStateBoundary = () =>
    outsideRecoveryGenerationLocks(() => undefined);
  const outsideRuntimeStateAndHostOperationLocks = <T>(effect: () => T) =>
    outsideRecoveryGenerationLocks(effect);
  const outsideRuntimeStateLock = <T>(effect: () => T) => {
    const effectResult = runtimeStateLockController.outsideLock(effect);
    verifyRecoveryRuntimeStateBoundary();
    return effectResult;
  };
  try {
    verifyRecoveryRuntimeStateBoundary();
    const initialInventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (initialInventory.status !== "completed")
      throw new Error(initialInventory.reason);
    if (
      !initialInventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      )
    )
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      });
    resumeDockerRecoveryJournalDirectoryForRecovery(
      root.rootPath,
      parsed.token,
      durableRuntimeStateBinding,
    );
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (inventory.status !== "completed") throw new Error(inventory.reason);
    if (
      !inventory.dockerRecoveryIds.some(
        (value: unknown) => value === parsed.token,
      )
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
    if (recoveryPathPresent(cleanupDirectory)) {
      if (recoveryPathPresent(operationDirectory))
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
    if (recoveryPathPresent(operationCleanupManifest)) {
      const cleanupManifest = verifyRecoveryCleanupManifest(
        operationDirectory,
        parsed.token,
      );
      if (recoveryPathPresent(cleanupDirectory))
        throw new Error("docker_task_recovery_cleanup_tombstone_conflict");
      fs.renameSync(operationDirectory, cleanupDirectory);
      commitDirectoryMutationBoundary(root.rootPath);
      verifyRecoveryCleanupManifest(cleanupDirectory, parsed.token);
      removeDockerRecoveryCleanupDirectory(
        root.rootPath,
        cleanupDirectory,
        parsed.token,
        cleanupManifest.runtimeStateBinding,
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
    if (
      !recoveryPathPresent(basePath) &&
      recoveryPathPresent(pendingBasePath) &&
      !recoveryPathPresent(pendingCommitPath)
    ) {
      const pendingBase = readCommittedDockerRecoveryJson(
        pendingBasePath,
        "base.json",
      );
      const pendingBaseValue = pendingBase.value as Record<string, unknown>;
      if (
        pendingBase.hash !== parsed.baseHash ||
        !validateDockerRecoveryBase(pendingBaseValue, parsed.operationNonce) ||
        pendingBaseValue.stableLogicalHomeBindingHash !==
          parsed.stableLogicalHomeBindingHash
      )
        throw new Error("docker_task_recovery_base_mismatch");
      writeDurableJson(
        root.rootPath,
        path.basename(pendingCommitPath),
        Object.freeze({
          schema: "crdd-coordinator-task-docker-base-commit/v1",
          operationNonce: parsed.operationNonce,
          stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
          baseHash: parsed.baseHash,
          recoveryId: parsed.token,
          ...(typeof pendingBaseValue.recoveryCorrelationId === "string"
            ? {
                recoveryCorrelationId: pendingBaseValue.recoveryCorrelationId,
              }
            : {}),
        }),
        "base-commit.json",
      );
      const reconstructedInventory = inspectDockerRecoveryRootSnapshot(
        root.rootPath,
      );
      if (
        reconstructedInventory.status !== "completed" ||
        !reconstructedInventory.dockerRecoveryIds.some(
          (value: unknown) => value === parsed.token,
        )
      )
        throw new Error("docker_task_runtime_state_audit_failed");
    }
    if (!recoveryPathPresent(basePath)) {
      if (
        !recoveryPathPresent(pendingBasePath) ||
        !recoveryPathPresent(pendingCommitPath)
      )
        throw new Error("docker_task_recovery_base_missing");
      if (!recoveryPathPresent(operationDirectory))
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
    } else if (recoveryPathPresent(pendingBasePath)) {
      throw new Error("docker_task_recovery_duplicate_base");
    }
    if (!recoveryPathPresent(baseCommitPath)) {
      if (!recoveryPathPresent(pendingCommitPath))
        throw new Error("docker_task_recovery_base_commit_missing");
      moveCommittedDockerRecoveryJson(
        readCommittedDockerRecoveryJson(pendingCommitPath, "base-commit.json"),
        baseCommitPath,
      );
    } else if (recoveryPathPresent(pendingCommitPath)) {
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
      !validateDockerRecoveryBaseCommit(
        baseCommit,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.token,
      ) ||
      baseCommit.stableLogicalHomeBindingHash !==
        parsed.stableLogicalHomeBindingHash ||
      baseCommit.baseHash !== parsed.baseHash
    )
      throw new Error("docker_task_recovery_base_commit_mismatch");
    const base = baseFile.value as Record<string, unknown>;
    if (
      !validateDockerRecoveryBase(base, parsed.operationNonce) ||
      base.stableLogicalHomeBindingHash !== parsed.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_recovery_base_mismatch");
    if (
      String(base.localUserBindingHash ?? "") !==
      durableRuntimeStateBinding.localUserBindingHash
    )
      throw new Error("docker_task_recovery_base_session_binding_mismatch");
    const recoveryRuntimeStateBinding =
      base.runtimeStateBinding as RuntimeStateBindingEvidence;
    verifyRecoveryRuntimeStateBoundary();
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
    const hostRootPresent = recoveryPathPresent(hostPaths.root);
    const hostMarkerPresent = recoveryPathPresent(hostPaths.marker);
    if (hostRootPresent !== hostMarkerPresent)
      throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
    const isHostStateAlreadyClean = !hostRootPresent && !hostMarkerPresent;
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
    if (recoveryPathPresent(hostManagementDirectory))
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
      !observeRecoveryFile(hostCompleteReceiptPath) &&
      observeRecoveryFile(hostCompleteIntentPath)
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
      !observeRecoveryFile(normalRunCompletePath) &&
      observeRecoveryFile(hostCompleteReceiptPath)
    ) {
      if (
        !observeRecoveryFile(
          path.join(operationDirectory, "docker-absence.json"),
        ) ||
        !observeRecoveryFile(
          path.join(operationDirectory, "mount-completion.json"),
        )
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
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      const closure = verifyActiveBindingAndPointerClosure(
        activeHostBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        {
          stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
          operationNonce: parsed.operationNonce,
          recoveryId: parsed.token,
          baseHash: parsed.baseHash,
        },
      );
      if (closure.activeState === "committed") {
        if (!removeCommittedDockerRecoveryJson(activeHostBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      } else if (closure.activeState !== "absent") {
        throw new Error("docker_task_recovery_active_run_mismatch");
      }
      if (closure.pointerState === "committed") {
        if (!removeCommittedDockerRecoveryJson(pointerPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
      }
      if (
        !observeRecoveryFile(
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
    if (observeRecoveryFile(normalRunCompletePath)) {
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
        observeRecoveryFile(pointerPath) ||
        observeRecoveryFile(activeHostBindingPath) ||
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
      if (!recoveryPathPresent(cleanupIntentPath))
        writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: parsed.token,
          currentHostRecoveryId: hostSuccessor,
        });
      if (
        recoveryPathPresent(hostPaths.root) ||
        recoveryPathPresent(hostPaths.marker)
      ) {
        const currentHostToken = currentHostRecoveryTokenForInventory(
          root.rootPath,
          hostPaths.root,
        );
        if (!currentHostToken)
          throw new Error("docker_task_recovery_host_lineage_unknown");
        const hostRecovery = outsideRuntimeStateLock(() =>
          recoverOwnedOperationDirectories(
            currentHostToken,
            hostOperationGeneration,
          ),
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
        recoveryRuntimeStateBinding,
        true,
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
    if (recoveryPathPresent(existingCrashReceiptPath)) {
      const crashReceipt = readExactJson(existingCrashReceiptPath)
        .value as Record<string, unknown>;
      const dockerAbsentHostToken = String(crashReceipt.observed ?? "");
      const hostIdentity = parseHostRecoveryToken(dockerAbsentHostToken);
      if (hostIdentity.nonce !== initialHostIdentity.nonce)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      if (
        !recoveryPathPresent(
          path.join(operationDirectory, "docker-absence-crash.json"),
        )
      )
        throw new Error("docker_task_recovery_crash_evidence_missing");
      const activeHostBindingPath = path.join(
        hostPaths.root,
        managementDirectoryName,
        "active-docker-task-v1.json",
      );
      const pointerPath = path.join(
        root.rootPath,
        `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
      );
      const closure = verifyActiveBindingAndPointerClosure(
        activeHostBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        {
          stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
          operationNonce: parsed.operationNonce,
          recoveryId: parsed.token,
          baseHash: parsed.baseHash,
        },
      );
      if (closure.activeState === "committed") {
        if (!removeCommittedDockerRecoveryJson(activeHostBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      } else if (closure.activeState !== "absent") {
        throw new Error("docker_task_recovery_active_run_mismatch");
      }
      const mountCrashPath = path.join(
        operationDirectory,
        "mount-crash-absence.json",
      );
      if (!recoveryPathPresent(mountCrashPath))
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
      if (closure.pointerState === "committed") {
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
        !recoveryPathPresent(
          path.join(operationDirectory, "host-cleanup-intent.json"),
        )
      )
        writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
          schema: "crdd-coordinator-host-cleanup-intent/v1",
          recoveryId: parsed.token,
          currentHostRecoveryId: dockerAbsentHostToken,
        });
      if (
        recoveryPathPresent(hostPaths.root) ||
        recoveryPathPresent(hostPaths.marker)
      ) {
        const currentHostToken = currentHostRecoveryTokenForInventory(
          root.rootPath,
          hostPaths.root,
        );
        if (!currentHostToken)
          throw new Error("docker_task_recovery_host_lineage_unknown");
        const recovered = outsideRuntimeStateLock(() =>
          recoverOwnedOperationDirectories(
            currentHostToken,
            hostOperationGeneration,
          ),
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
        recoveryRuntimeStateBinding,
        true,
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
    const hostBeginIntentPresent = recoveryPathPresent(hostBeginIntentPath);
    if (!hostBeginIntentPresent && isHostStateAlreadyClean)
      throw new Error("docker_task_recovery_evidence_missing");
    if (!hostBeginIntentPresent)
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
    const hasSubmission = [...CREATE_PURPOSES].some((purpose) =>
      recoveryPathPresent(
        path.join(operationDirectory, `submission-${purpose}.json`),
      ),
    );
    let hostSubmissionStarted = true;
    let hostReceipt: Record<string, string>;
    if (recoveryPathPresent(hostBeginReceiptPath)) {
      hostReceipt = readExactJson(hostBeginReceiptPath).value as Record<
        string,
        string
      >;
    } else if (isHostStateAlreadyClean) {
      if (hasSubmission)
        throw new Error("docker_task_recovery_host_begin_mismatch");
      hostSubmissionStarted = false;
      hostReceipt = {
        previous: hostBeginCurrentToken,
        observed: hostBeginCurrentToken,
      };
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
    const host = isHostStateAlreadyClean
      ? null
      : loadHostRecoveryRecordByToken(submissionHostToken);
    const managementName = host
      ? (host.record.childIdentities as Record<string, { pathName: string }>)
          .management?.pathName
      : managementDirectoryName;
    if (!managementName) throw new Error("docker_task_recovery_host_mismatch");
    const hostRoot = host
      ? path.join(host.parent, host.parsed.rootName)
      : hostPaths.root;
    const hostActiveBindingPath = path.join(
      hostRoot,
      managementName,
      "active-docker-task-v1.json",
    );
    const pointerPath = path.join(
      root.rootPath,
      `active-lease-${parsed.stableLogicalHomeBindingHash}.json`,
    );
    const expectedPointer = Object.freeze({
      stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
      operationNonce: parsed.operationNonce,
      recoveryId: parsed.token,
      baseHash: parsed.baseHash,
    });
    const hostPrecleanupFinalizationIntentPath = path.join(
      operationDirectory,
      "host-precleanup-finalization-intent.json",
    );
    const expectedHostPrecleanupFinalizationIntent = Object.freeze({
      schema: "crdd-coordinator-host-precleanup-finalization-intent/v1",
      recoveryId: parsed.token,
      operationNonce: parsed.operationNonce,
      baseHash: parsed.baseHash,
      stableLogicalHomeBindingHash: parsed.stableLogicalHomeBindingHash,
      initialHostRecoveryId,
      hostRootAbsent: true,
      hostMarkerAbsent: true,
      submissionAbsent: true,
    });
    let hostPrecleanupFinalizationIntentPresent = recoveryPathPresent(
      hostPrecleanupFinalizationIntentPath,
    );
    if (hostPrecleanupFinalizationIntentPresent) {
      const observedIntent = readExactJson(
        hostPrecleanupFinalizationIntentPath,
      ).value;
      if (
        canonical(observedIntent) !==
          canonical(expectedHostPrecleanupFinalizationIntent) ||
        !isHostStateAlreadyClean ||
        hasSubmission
      )
        throw new Error("docker_task_recovery_host_precleanup_intent_mismatch");
    }
    let activePointerClosure = verifyActiveBindingAndPointerClosure(
      hostActiveBindingPath,
      pointerPath,
      expectedHostActiveBinding(
        parsed.token,
        parsed.baseHash,
        parsed.operationNonce,
      ),
      expectedPointer,
    );
    if (
      isHostStateAlreadyClean &&
      activePointerClosure.pointerState !== "committed" &&
      !(
        hostPrecleanupFinalizationIntentPresent &&
        activePointerClosure.pointerState === "absent"
      )
    )
      throw new Error("docker_task_recovery_pointer_mismatch");
    if (activePointerClosure.activeState === "uncommitted") {
      if (hostSubmissionStarted)
        throw new Error("docker_task_recovery_active_run_mismatch");
      removeExactUncommittedDockerRecoveryJson(
        hostActiveBindingPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
      );
      commitDirectoryMutationBoundary(path.dirname(hostActiveBindingPath));
      activePointerClosure = verifyActiveBindingAndPointerClosure(
        hostActiveBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        expectedPointer,
      );
    }
    if (
      isHostStateAlreadyClean &&
      !hasSubmission &&
      !hostPrecleanupFinalizationIntentPresent
    ) {
      if (
        activePointerClosure.activeState !== "absent" ||
        activePointerClosure.pointerState !== "committed"
      )
        throw new Error("docker_task_recovery_host_precleanup_intent_unsafe");
      writeDurableJson(
        operationDirectory,
        "host-precleanup-finalization-intent.json",
        expectedHostPrecleanupFinalizationIntent,
      );
      hostPrecleanupFinalizationIntentPresent = true;
    }
    if (
      activePointerClosure.activeState === "absent" &&
      hostSubmissionStarted &&
      activePointerClosure.pointerState !== "committed" &&
      !(
        hostPrecleanupFinalizationIntentPresent &&
        activePointerClosure.pointerState === "absent"
      )
    ) {
      throw new Error("docker_task_recovery_active_run_missing");
    }
    const configDirectory = path.join(
      operationDirectory,
      "recovery-docker-cli-config",
    );
    const releasePointer = () => {
      if (!observeRecoveryFile(pointerPath)) {
        const pointerCommitPath = path.join(
          path.dirname(pointerPath),
          dockerRecoveryCommitName(path.basename(pointerPath)),
        );
        if (observeRecoveryFile(pointerCommitPath))
          throw new Error("docker_task_recovery_pointer_mismatch");
        return;
      }
      const pointer = readExactJson(pointerPath).value as Record<
        string,
        unknown
      >;
      validateActiveLeasePointer(pointer, expectedPointer);
      if (!removeCommittedDockerRecoveryJson(pointerPath))
        throw new Error("docker_task_recovery_pointer_mismatch");
      commitDirectoryMutationBoundary(root.rootPath);
    };
    if (!hostSubmissionStarted) {
      if (activePointerClosure.activeState === "committed")
        if (!removeCommittedDockerRecoveryJson(hostActiveBindingPath))
          throw new Error("docker_task_recovery_active_run_mismatch");
      releasePointer();
      if (isHostStateAlreadyClean) {
        writeDurableJson(operationDirectory, "docker-absence-crash.json", {
          schema: "crdd-coordinator-docker-absence/v1",
          recoveryId: parsed.token,
          allExactResourcesAbsent: true,
          evidence: "crash_recovery_exact_id_and_configuration",
        });
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
        ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
        removeRecoveryOperationDirectory(
          operationDirectory,
          parsed.token,
          parsed.operationNonce,
          parsed.baseHash,
          parsed.stableLogicalHomeBindingHash,
          recoveryRuntimeStateBinding,
          true,
        );
        commitDirectoryMutationBoundary(root.rootPath);
        return Object.freeze({
          status: "recovered" as const,
          reason: "docker_task_recovery_completed_after_host_precleanup",
          recoveryId: null,
        });
      }
      writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
        schema: "crdd-coordinator-host-cleanup-intent/v1",
        recoveryId: parsed.token,
        currentHostRecoveryId: submissionHostToken,
      });
      const hostRecovery = outsideRuntimeStateLock(() =>
        recoverOwnedOperationDirectories(
          submissionHostToken,
          hostOperationGeneration,
        ),
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
        recoveryRuntimeStateBinding,
        true,
      );
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      });
    }
    if (!recoveryPathPresent(configDirectory))
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
    for (const [purpose, kind, name, image, isInternal] of specs) {
      const hasSubmissionMarker = recoveryPathPresent(
        path.join(operationDirectory, `submission-${purpose}.json`),
      );
      const receiptPath = path.join(
        operationDirectory,
        `receipt-${purpose}.json`,
      );
      const restartFencePath = path.join(
        operationDirectory,
        `restart-fence-${purpose}.json`,
      );
      if (!hasSubmissionMarker) {
        if (recoveryPathPresent(receiptPath))
          throw new Error("docker_task_recovery_receipt_without_submission");
        continue;
      }
      if (!recoveryPathPresent(receiptPath)) {
        if (recoveryPathPresent(restartFencePath)) {
          if (
            !validateOperationRecord(
              `restart-fence-${purpose}.json`,
              readExactJson(restartFencePath).value,
              parsed.token,
              parsed.operationNonce,
              parsed.baseHash,
            )
          )
            throw new Error("docker_task_recovery_restart_fence_invalid");
          continue;
        }
        const expectedNetworks =
          purpose === "create_subscription_auth_probe"
            ? ["none"]
            : purpose === "create_proxy"
              ? [String(resources.internal)]
              : kind === "container"
                ? [String(resources.internal)]
                : [];
        const discoveredDockerId = outsideRuntimeStateAndHostOperationLocks(
          () =>
            recoveryDockerRunner
              ? recoverUnknownDockerCreateOutcomeWithRunner(
                  recoveryDockerRunner,
                  kind,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  expectedNetworks,
                  operationMode,
                  workspaceMountMode,
                )
              : recoverUnknownDockerCreateOutcomeWithRunner(
                  (argv) =>
                    runRecoveryDocker(configDirectory, configIdentity, argv),
                  kind,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  expectedNetworks,
                  operationMode,
                  workspaceMountMode,
                ),
        );
        if (!discoveredDockerId) {
          const exactResourceAbsent =
            restartFence !== null &&
            outsideRuntimeStateAndHostOperationLocks(() =>
              observeSubmittedDockerResourceAbsentWithRunner(
                recoveryDockerRunner
                  ? recoveryDockerRunner
                  : (argv) =>
                      runRecoveryDocker(configDirectory, configIdentity, argv),
                kind,
                name,
                String(base.ownershipLabel),
              ),
            );
          if (!exactResourceAbsent || !restartFence)
            throw new Error("docker_task_recovery_create_outcome_unknown");
          writeDurableJson(
            operationDirectory,
            `restart-fence-${purpose}.json`,
            Object.freeze({
              schema: "crdd-coordinator-docker-engine-restart-fence/v1",
              purpose,
              recoveryId: parsed.token,
              repairId: restartFence.repairId,
              repairRecordSha256: restartFence.repairRecordSha256,
              exactResourceAbsent: true,
            }),
          );
          continue;
        }
        writeDurableJson(
          operationDirectory,
          `receipt-${purpose}.json`,
          Object.freeze({
            schema: "crdd-coordinator-docker-resource-receipt/v2",
            purpose,
            dockerId: discoveredDockerId,
            recoveryId: parsed.token,
            source: "runtime_reconciliation",
          }),
        );
      }
      const receipt = readExactJson(receiptPath).value as Record<
        string,
        string
      >;
      const dockerId = receipt.dockerId ?? "";
      if (
        receipt.purpose !== purpose ||
        receipt.recoveryId !== parsed.token ||
        !HEX64.test(dockerId) ||
        !outsideRuntimeStateAndHostOperationLocks(() => {
          const expectedNetworks =
            purpose === "create_subscription_auth_probe"
              ? ["none"]
              : purpose === "create_proxy"
                ? [String(resources.internal)]
                : kind === "container"
                  ? [String(resources.internal)]
                  : [];
          const recoverWithNetworks = (networks: readonly string[]) =>
            recoveryDockerRunner
              ? recoverExactDockerResourceWithRunner(
                  recoveryDockerRunner,
                  kind,
                  dockerId,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  networks,
                  operationMode,
                  workspaceMountMode,
                )
              : recoverExactDockerResource(
                  configDirectory,
                  configIdentity,
                  kind,
                  dockerId,
                  name,
                  String(base.ownershipLabel),
                  image,
                  isInternal,
                  purpose,
                  networks,
                  operationMode,
                  workspaceMountMode,
                );
          if (recoverWithNetworks(expectedNetworks)) return true;
          return (
            purpose === "create_proxy" &&
            recoverWithNetworks([
              String(resources.internal),
              String(resources.egress),
            ])
          );
        })
      )
        throw new Error("docker_task_recovery_resource_mismatch");
    }
    if (recoveryConfigIdentity(configDirectory) !== configIdentity)
      throw new Error("docker_task_recovery_config_untrusted");
    fs.rmdirSync(configDirectory);
    if (
      !recoveryPathPresent(
        path.join(operationDirectory, "docker-absence-crash.json"),
      )
    ) {
      writeDurableJson(operationDirectory, "docker-absence-crash.json", {
        schema: "crdd-coordinator-docker-absence/v1",
        recoveryId: parsed.token,
        allExactResourcesAbsent: true,
        evidence: "crash_recovery_exact_id_and_configuration",
      });
    }
    if (isHostStateAlreadyClean) {
      const finalClosure = verifyActiveBindingAndPointerClosure(
        hostActiveBindingPath,
        pointerPath,
        expectedHostActiveBinding(
          parsed.token,
          parsed.baseHash,
          parsed.operationNonce,
        ),
        expectedPointer,
      );
      if (finalClosure.activeState !== "absent")
        throw new Error("docker_task_recovery_active_run_mismatch");
      const mountCrashPath = path.join(
        operationDirectory,
        "mount-crash-absence.json",
      );
      if (!recoveryPathPresent(mountCrashPath))
        writeDurableJson(operationDirectory, "mount-crash-absence.json", {
          schema: "crdd-coordinator-provider-home-mount-completion/v1",
          recoveryId: parsed.token,
          evidence: "process_generation_absent_plus_exact_docker_absent",
        });
      releasePointer();
      ensureHostCleanupReceipt(operationDirectory, parsed.token, hostPaths);
      removeRecoveryOperationDirectory(
        operationDirectory,
        parsed.token,
        parsed.operationNonce,
        parsed.baseHash,
        parsed.stableLogicalHomeBindingHash,
        recoveryRuntimeStateBinding,
        true,
      );
      commitDirectoryMutationBoundary(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_completed_after_host_precleanup",
        recoveryId: null,
      });
    }
    const crashIntentPath = path.join(
      operationDirectory,
      "host-crash-absence-intent.json",
    );
    const crashIntent = recoveryPathPresent(crashIntentPath)
      ? (readExactJson(crashIntentPath).value as Record<string, string>)
      : expectedHostSuccessor(submissionHostToken, "docker_absent_confirmed");
    if (!recoveryPathPresent(crashIntentPath))
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
      dockerAbsentHostToken = outsideRuntimeStateLock(() =>
        confirmOwnedDockerAbsenceForRecovery(
          submissionHostToken,
          hostOperationGeneration,
        ),
      );
    }
    if (dockerAbsentHostToken !== crashIntent.expectedToken)
      throw new Error("docker_task_recovery_host_successor_mismatch");
    const crashReceiptPath = path.join(
      operationDirectory,
      "host-crash-absence-receipt.json",
    );
    if (!recoveryPathPresent(crashReceiptPath))
      writeDurableJson(operationDirectory, "host-crash-absence-receipt.json", {
        previous: submissionHostToken,
        observed: dockerAbsentHostToken,
      });
    const finalClosure = verifyActiveBindingAndPointerClosure(
      hostActiveBindingPath,
      pointerPath,
      expectedHostActiveBinding(
        parsed.token,
        parsed.baseHash,
        parsed.operationNonce,
      ),
      expectedPointer,
    );
    if (finalClosure.activeState === "committed") {
      if (!removeCommittedDockerRecoveryJson(hostActiveBindingPath))
        throw new Error("docker_task_recovery_active_run_mismatch");
    } else if (finalClosure.activeState !== "absent") {
      throw new Error("docker_task_recovery_active_run_mismatch");
    }
    const mountCrashPath = path.join(
      operationDirectory,
      "mount-crash-absence.json",
    );
    if (!recoveryPathPresent(mountCrashPath))
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
    if (
      !recoveryPathPresent(
        path.join(operationDirectory, "host-cleanup-intent.json"),
      )
    )
      writeDurableJson(operationDirectory, "host-cleanup-intent.json", {
        schema: "crdd-coordinator-host-cleanup-intent/v1",
        recoveryId: parsed.token,
        currentHostRecoveryId: dockerAbsentHostToken,
      });
    const hostRecovery = outsideRuntimeStateLock(() =>
      recoverOwnedOperationDirectories(
        dockerAbsentHostToken,
        hostOperationGeneration,
      ),
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
      recoveryRuntimeStateBinding,
      true,
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
    const releaseFailure = releaseRecoverySynchronizations([
      {
        release: () => runtimeStateLockController.close(),
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
      },
      {
        release: () => processAbsenceLock.release(),
        reason: "docker_task_recovery_home_lock_release_unconfirmed",
      },
      ...(hostOperationGeneration
        ? [
            {
              release: () =>
                releaseHostOperationRecoveryGeneration(hostOperationGeneration),
              reason: "docker_task_recovery_host_lock_release_unconfirmed",
            },
          ]
        : []),
    ]);
    if (releaseFailure)
      // biome-ignore lint/correctness/noUnsafeFinally: release failure must override a provisional success.
      return Object.freeze({
        status: "blocked" as const,
        reason: releaseFailure,
        recoveryId: parsed.token,
      });
  }
}

/** @internal Package-private engine; production supplies native observation. */
function recoverRuntimeOwnedDockerTaskFromVerifiedRoot(
  token: unknown,
  root: VerifiedRuntimeStateRoot,
) {
  return recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
    token,
    root,
    observeRuntimeStateRootFromWindows,
  );
}

function recoverRuntimeOwnedDockerTaskInternal(token: unknown) {
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
  return recoverRuntimeOwnedDockerTaskFromVerifiedRoot(parsed.token, root);
}

export function recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart(
  token: unknown,
  repairId: unknown,
  repairReleaseRoot: unknown,
  developmentContext?: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  let phase = "input";
  try {
    if (
      !parsed ||
      typeof repairId !== "string" ||
      !/^docker-desktop-repair\.[a-f0-9]{32}$/u.test(repairId) ||
      typeof repairReleaseRoot !== "string" ||
      !path.isAbsolute(repairReleaseRoot)
    )
      throw new Error("docker_task_recovery_restart_fence_input_invalid");
    phase = "authority";
    const development =
      developmentContext !== undefined &&
      developmentContext !== null &&
      typeof developmentContext === "object"
        ? borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext,
            false,
          )
        : null;
    if (developmentContext !== undefined && !development)
      throw new Error("docker_task_recovery_restart_fence_authority_invalid");
    const verification =
      development?.verification ??
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime: new Date().toISOString(),
      });
    const releaseSequence =
      "releaseSequence" in verification
        ? verification.releaseSequence
        : development?.expectedRelease.releaseSequence;
    if (
      verification.status !== "candidate" ||
      typeof verification.manifestHash !== "string" ||
      !Number.isSafeInteger(releaseSequence) ||
      typeof verification.runtimeExecutionIdentitySha256 !== "string"
    )
      throw new Error("docker_task_recovery_restart_fence_authority_invalid");
    phase = "runtime_state";
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      false,
      new Date().toISOString(),
      developmentContext,
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    phase = "repair_policy";
    const policy = observeRuntimeOwnedDockerDesktopRepairPolicy();
    if (observation.status !== "candidate" || !root || !policy)
      throw new Error("docker_task_recovery_restart_fence_boundary_invalid");
    let localAppData = root.rootPath;
    for (const expected of ["RuntimeState", "CRDD", "Qual-Lab"]) {
      if (
        path.win32.basename(localAppData).toLocaleLowerCase("en-US") !==
        expected.toLocaleLowerCase("en-US")
      )
        throw new Error("docker_task_recovery_restart_fence_boundary_invalid");
      localAppData = path.win32.dirname(localAppData);
    }
    phase = "historical_manifest";
    const originManifest =
      loadHistoricalReleaseManifestEnvelopeForVerification(
        repairReleaseRoot,
      ).envelope;
    phase = "historical_repair";
    const repair = inspectDockerDesktopRepairHistoricalOperation(
      {
        runtimeStateRoot: root.rootPath,
        runtimeStateIdentityHash: root.runtimeStateIdentityHash,
        runtimeStateProtectionHash: root.runtimeStateProtectionHash,
        localUserBindingHash: root.localUserBindingHash,
        runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
        dockerPolicySha256: policy.policySha256,
        crddManifestHash: verification.manifestHash,
        crddReleaseSequence: releaseSequence as number,
        runtimeExecutionIdentitySha256:
          verification.runtimeExecutionIdentitySha256,
        localAppData,
      },
      repairId,
      originManifest,
    );
    if (
      !repair ||
      ![
        "closed_retained",
        "closed_no_stale_known_effect_retained",
        "closed_historical_effect_unknown_retained",
      ].includes(repair.stage) ||
      repair.ledger.engineReady !== true ||
      repair.ledger.hostSafety !== "safe" ||
      repair.ledger.evidenceState !== "preserved" ||
      !repair.ledger.liveRunIdentity ||
      !repair.ledger.processEffects.some(
        (entry) =>
          [
            "official_shutdown",
            "native_termination",
            "wsl_termination",
          ].includes(entry.action) &&
          entry.phase === "settled" &&
          entry.issued === true &&
          entry.confirmation === "confirmed",
      )
    )
      throw new Error("docker_task_recovery_restart_fence_unverified");
    phase = "pending_submission";
    const operationDirectory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const pendingSubmissionNames = fs
      .readdirSync(operationDirectory, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          /^submission-.+\.json$/u.test(entry.name) &&
          !fs.existsSync(
            path.join(
              operationDirectory,
              entry.name.replace(/^submission-/u, "receipt-"),
            ),
          ),
      )
      .map((entry) => entry.name);
    if (pendingSubmissionNames.length === 0)
      throw new Error("docker_task_recovery_restart_fence_not_needed");
    phase = "ordering";
    const firstRepairRecord = path.join(
      repair.operationDirectory,
      "repair-00-prepared.json",
    );
    const repairStartedAt = fs.lstatSync(firstRepairRecord, { bigint: true });
    if (
      BigInt(repair.ledger.liveRunIdentity.birthtimeNs) <=
        repairStartedAt.birthtimeNs ||
      pendingSubmissionNames.some(
        (name) =>
          fs.lstatSync(path.join(operationDirectory, name), { bigint: true })
            .birthtimeNs >= repairStartedAt.birthtimeNs,
      )
    )
      throw new Error("docker_task_recovery_restart_fence_order_invalid");
    const restartFence = Object.freeze({
      recoveryId: parsed.token,
      repairId,
      repairRecordSha256: repair.previousRecordSha256,
    });
    phase = "task_recovery";
    const result = recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
      parsed.token,
      root,
      () => observeRuntimeStateRootFromWindows(developmentContext),
      null,
      restartFence,
    );
    return Object.freeze({
      ...result,
      manualRecoveryRequired: result.status === "blocked",
      restartFenceVerified: true,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        `docker_task_recovery_restart_fence_${phase}_failed`,
      ),
      recoveryId: parsed?.token ?? null,
      manualRecoveryRequired: Boolean(parsed),
      restartFenceVerified: false,
    });
  }
}

export function classifyRuntimeOwnedDockerRecoveryEvidence(
  inventory: unknown,
  recoveryId: string,
) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory))
    return "unknown" as const;
  const record = inventory as Readonly<Record<string, unknown>>;
  if (record.status !== "completed" || !Array.isArray(record.dockerRecoveryIds))
    return "unknown" as const;
  return (record.dockerRecoveryIds as readonly unknown[]).includes(recoveryId)
    ? ("preserved" as const)
    : ("not_preserved" as const);
}

export function recoverRuntimeOwnedDockerTask(token: unknown) {
  const parsed = parseDockerTaskRecoveryId(token);
  try {
    const result = recoverRuntimeOwnedDockerTaskInternal(token);
    const inventory =
      result.status === "blocked" && parsed
        ? inspectRuntimeOwnedDockerTaskRecoveryState()
        : null;
    const evidenceState = classifyRuntimeOwnedDockerRecoveryEvidence(
      inventory,
      parsed?.token ?? "",
    );
    return Object.freeze({
      ...result,
      recoveryId: evidenceState === "not_preserved" ? null : result.recoveryId,
      manualRecoveryRequired: result.status === "blocked" && Boolean(parsed),
      evidenceState,
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(error, "docker_task_recovery_failed_closed"),
      recoveryId: parsed?.token ?? null,
      manualRecoveryRequired: Boolean(parsed),
      evidenceState: "unknown" as const,
    });
  }
}

/**
 * Acknowledge a Docker recovery completion only after the Project Runtime has
 * durably recorded the matching obligation as settled.  The receipt is a
 * replay fence, not a permanent history record; removing its committed pair
 * closes that resource lifecycle and prevents the bounded Runtime root from
 * filling with already-consumed fences.
 */
/** @internal Testable engine; caller must already own a verified Runtime root. */
export function acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot(
  token: unknown,
  root: VerifiedRuntimeStateRoot,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_id_invalid",
    });
  try {
    const expectedBinding = runtimeStateBindingEvidence(root);
    const beforeResumeReceipt = inspectCompletedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (
      beforeResumeReceipt &&
      JSON.stringify(beforeResumeReceipt.runtimeStateBinding) !==
        JSON.stringify(expectedBinding)
    )
      throw new Error("docker_task_recovery_completion_binding_mismatch");
    if (hasDockerRecoveryJournalIntentForRecovery(root.rootPath, parsed.token))
      resumeDockerRecoveryJournalDirectoryForRecovery(
        root.rootPath,
        parsed.token,
        expectedBinding,
      );
    const receipt = inspectCompletedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (!receipt) {
      const acknowledged = inspectAcknowledgedDockerRecoveryReceipt(
        root.rootPath,
        parsed.token,
      );
      if (
        !acknowledged ||
        JSON.stringify(acknowledged.runtimeStateBinding) !==
          JSON.stringify(expectedBinding)
      )
        throw new Error("docker_task_recovery_completion_receipt_missing");
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_recovery_completion_already_acknowledged",
        acknowledgement: Object.freeze({
          runtimeStateBinding: acknowledged.runtimeStateBinding,
          receiptContentHash: acknowledged.receiptContentHash,
          receiptContentIdentity: acknowledged.receiptContentIdentity,
        }),
      });
    }
    if (
      JSON.stringify(receipt.runtimeStateBinding) !==
      JSON.stringify(expectedBinding)
    )
      throw new Error("docker_task_recovery_completion_binding_mismatch");
    const acknowledgedName = acknowledgedDockerRecoveryReceiptName(
      parsed.token,
    );
    const acknowledgementValue = Object.freeze({
      schema: "crdd-coordinator-docker-recovery-acknowledgement/v1",
      recoveryId: parsed.token,
      runtimeStateBinding: expectedBinding,
      receiptContentHash: receipt.receiptContentHash,
      receiptContentIdentity: receipt.receiptContentIdentity,
    });
    const isExistingAcknowledged = recoveryPathPresent(
      path.join(root.rootPath, acknowledgedName),
    );
    if (!isExistingAcknowledged) {
      const acknowledgementCount = fs
        .readdirSync(root.rootPath)
        .filter((name) =>
          ACKNOWLEDGED_DOCKER_RECOVERY_RECEIPT.test(name),
        ).length;
      if (acknowledgementCount >= MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS)
        throw new Error(
          "docker_task_recovery_acknowledgement_tombstone_limit_exceeded",
        );
    }
    writeOrResumeCommittedDockerRecoveryJson(
      root.rootPath,
      acknowledgedName,
      acknowledgedName,
      acknowledgementValue,
    );
    commitDirectoryMutationBoundary(root.rootPath);
    const acknowledged = inspectAcknowledgedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (
      !acknowledged ||
      JSON.stringify(acknowledged.runtimeStateBinding) !==
        JSON.stringify(expectedBinding) ||
      acknowledged.receiptContentHash !== receipt.receiptContentHash ||
      acknowledged.receiptContentIdentity !== receipt.receiptContentIdentity
    )
      throw new Error("docker_task_recovery_acknowledgement_unknown");
    const location = path.join(root.rootPath, receipt.name);
    if (!removeCommittedDockerRecoveryJson(location, receipt.name))
      throw new Error("docker_task_recovery_completion_acknowledgement_failed");
    commitDirectoryMutationBoundary(root.rootPath);
    if (
      recoveryPathPresent(location) ||
      recoveryPathPresent(dockerRecoveryCommitName(location))
    )
      throw new Error(
        "docker_task_recovery_completion_acknowledgement_unknown",
      );
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_completion_acknowledged",
      acknowledgement: Object.freeze({
        runtimeStateBinding: acknowledged.runtimeStateBinding,
        receiptContentHash: acknowledged.receiptContentHash,
        receiptContentIdentity: acknowledged.receiptContentIdentity,
      }),
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_completion_acknowledgement_failed",
      ),
    });
  }
}

/** @internal GC engine. The public facade must first verify Project ack state. */
export function finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRoot(
  token: unknown,
  acknowledgement: unknown,
  root: VerifiedRuntimeStateRoot,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  if (!parsed || !acknowledgement || typeof acknowledgement !== "object")
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_acknowledgement_gc_authority_invalid",
    });
  try {
    const expectedBinding = runtimeStateBindingEvidence(root);
    const expected = acknowledgement as Readonly<Record<string, unknown>>;
    if (
      !exactRecordKeys(expected, [
        "runtimeStateBinding",
        "receiptContentHash",
        "receiptContentIdentity",
      ]) ||
      !validRuntimeStateBindingEvidence(expected.runtimeStateBinding) ||
      JSON.stringify(expected.runtimeStateBinding) !==
        JSON.stringify(expectedBinding) ||
      typeof expected.receiptContentHash !== "string" ||
      !HEX64.test(expected.receiptContentHash) ||
      typeof expected.receiptContentIdentity !== "string"
    )
      throw new Error(
        "docker_task_recovery_acknowledgement_gc_authority_invalid",
      );
    if (hasDockerRecoveryJournalIntentForRecovery(root.rootPath, parsed.token))
      resumeDockerRecoveryJournalDirectoryForRecovery(
        root.rootPath,
        parsed.token,
        expectedBinding,
      );
    const tombstone = inspectAcknowledgedDockerRecoveryReceipt(
      root.rootPath,
      parsed.token,
    );
    if (!tombstone) {
      const staleReceipt = inspectCompletedDockerRecoveryReceipt(
        root.rootPath,
        parsed.token,
      );
      if (staleReceipt)
        throw new Error("docker_task_recovery_acknowledgement_gc_mismatch");
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_recovery_acknowledgement_already_collected",
      });
    }
    if (
      JSON.stringify(tombstone.runtimeStateBinding) !==
        JSON.stringify(expectedBinding) ||
      tombstone.receiptContentHash !== expected.receiptContentHash ||
      tombstone.receiptContentIdentity !== expected.receiptContentIdentity
    )
      throw new Error("docker_task_recovery_acknowledgement_gc_mismatch");
    const location = path.join(root.rootPath, tombstone.name);
    if (!removeCommittedDockerRecoveryJson(location, tombstone.name))
      throw new Error("docker_task_recovery_acknowledgement_gc_failed");
    commitDirectoryMutationBoundary(root.rootPath);
    if (
      recoveryPathPresent(location) ||
      recoveryPathPresent(dockerRecoveryCommitName(location))
    )
      throw new Error("docker_task_recovery_acknowledgement_gc_unknown");
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_acknowledgement_collected",
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_acknowledgement_gc_failed",
      ),
    });
  }
}

export function acknowledgeRuntimeOwnedDockerRecoveryCompletion(
  token: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      false,
      new Date().toISOString(),
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_runtime_state_unavailable");
    const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!lock) throw new Error("docker_task_runtime_state_lock_unavailable");
    let result: ReturnType<
      typeof acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot
    >;
    try {
      result = acknowledgeRuntimeOwnedDockerRecoveryCompletionFromVerifiedRoot(
        token,
        root,
      );
    } catch (error) {
      const released = lock.release();
      if (!released)
        throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
      throw error;
    }
    if (!lock.release())
      throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
    return result;
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_completion_acknowledgement_failed",
      ),
    });
  }
}

export function finalizeRuntimeOwnedDockerRecoveryAcknowledgement(
  token: unknown,
  acknowledgement: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      false,
      new Date().toISOString(),
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_runtime_state_unavailable");
    const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!lock) throw new Error("docker_task_runtime_state_lock_unavailable");
    let result: ReturnType<
      typeof finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRoot
    >;
    try {
      result =
        finalizeRuntimeOwnedDockerRecoveryAcknowledgementFromVerifiedRoot(
          token,
          acknowledgement,
          root,
        );
    } catch (error) {
      const released = lock.release();
      if (!released)
        throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
      throw error;
    }
    if (!lock.release())
      throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
    return result;
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_acknowledgement_gc_failed",
      ),
    });
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
    const sortedEntries = [...entries].sort((left, right) =>
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
        pendingBaseSource?: "required" | "absent" | "journal";
        pendingCommitSource?: "required" | "absent" | "journal";
        pointerEligible?: boolean;
      }>
    >();
    const pendingBaseNames = new Set<string>();
    const pendingCommitNames = new Set<string>();
    const entryNames = new Set(entries.map((entry) => entry.name));
    const pointers: Array<
      Readonly<{ name: string; value: Record<string, unknown> }>
    > = [];
    const externalSendConsentRecordNames = new Set<string>();
    const completedDockerRecoveryReceiptNames = new Set<string>();
    const acknowledgedDockerRecoveryReceiptNames = new Set<string>();
    const sessionHandoffRecoveryIds = new Set<string>();
    const journalIntents = inspectDockerRecoveryJournalDirectory(rootPath);
    const journalIntentRecoveryIds = new Set(
      journalIntents
        .map((intent) => intent.recoveryId)
        .filter((value): value is string => value !== null),
    );
    const journalPairNames = new Set(
      journalIntents.flatMap((intent) =>
        [intent.pairContentName, intent.pairCommitName].filter(
          (value): value is string => value !== null,
        ),
      ),
    );
    const recoveryIdForNonce = (nonce: string) => {
      const matches = [...journalIntentRecoveryIds].filter(
        (recoveryId) =>
          parseDockerTaskRecoveryId(recoveryId)?.operationNonce === nonce,
      );
      if (matches.length > 1)
        throw new Error("docker_task_runtime_state_base_invalid");
      return matches[0] ?? null;
    };
    const readRootRecord = (
      file: string,
      logicalKey: string,
      recoveryId: string | null,
    ):
      | ReturnType<typeof readExactJson>
      | (ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery> &
          object)
      | ReturnType<typeof inspectDockerRecoveryMoveJournalForRecovery> => {
      try {
        return readExactJson(file, logicalKey);
      } catch (error) {
        if (!recoveryId) throw error;
        if (recoveryPathPresent(file))
          return inspectDockerRecoveryMoveJournalForRecovery(
            rootPath,
            recoveryId,
            logicalKey,
            path.dirname(file),
            path.basename(file),
          );
        const discovered = discoverDockerRecoveryJournalJsonForRecovery(
          rootPath,
          logicalKey,
          recoveryId,
        );
        if (discovered) return discovered;
        throw error;
      }
    };
    type BootstrapRecord = ReturnType<typeof readRootRecord>;
    type BootstrapPairState =
      | "absent"
      | "move_content"
      | "move_commit"
      | "complete";
    type BootstrapPairInspection = Readonly<{
      state: BootstrapPairState;
      hasIntent: boolean;
    }>;
    const pendingSourceExpectation = (
      inspection: BootstrapPairInspection,
    ): "required" | "absent" | "journal" =>
      inspection.hasIntent
        ? "journal"
        : inspection.state === "absent"
          ? "required"
          : "absent";
    const sameBootstrapRecord = (
      left: BootstrapRecord,
      right: BootstrapRecord,
    ) =>
      left.logicalKey === right.logicalKey &&
      left.serialized === right.serialized &&
      left.hash === right.hash &&
      left.identityText === right.identityText;
    const inspectBootstrapPairState = (
      directory: string,
      recoveryId: string,
      logicalKey: "base.json" | "base-commit.json",
      record: BootstrapRecord,
    ): BootstrapPairInspection => {
      const target = path.join(directory, logicalKey);
      const targetCommit = path.join(
        directory,
        dockerRecoveryCommitName(logicalKey),
      );
      const matchingIntents = journalIntents.filter(
        (intent) =>
          intent.schema === "crdd-coordinator-durable-json-move/v1" &&
          intent.recoveryId === recoveryId &&
          intent.pairLogicalKey === logicalKey &&
          intent.targetContentName === logicalKey &&
          intent.targetCommitName === dockerRecoveryCommitName(logicalKey),
      );
      if (matchingIntents.length > 1)
        throw new Error("docker_task_runtime_state_base_invalid");
      if (matchingIntents.length === 1) {
        const inspected = inspectDockerRecoveryMoveJournalForRecovery(
          rootPath,
          recoveryId,
          logicalKey,
          directory,
          logicalKey,
        );
        if (!sameBootstrapRecord(record, inspected))
          throw new Error("docker_task_runtime_state_base_invalid");
        return Object.freeze({ state: inspected.moveState, hasIntent: true });
      }
      const targetPresent = recoveryPathPresent(target);
      const targetCommitPresent = recoveryPathPresent(targetCommit);
      if (!targetPresent && !targetCommitPresent)
        return Object.freeze({ state: "absent" as const, hasIntent: false });
      if (!targetPresent || !targetCommitPresent)
        throw new Error("docker_task_runtime_state_base_invalid");
      const inspected = readExactJson(target, logicalKey);
      if (!sameBootstrapRecord(record, inspected))
        throw new Error("docker_task_runtime_state_base_invalid");
      return Object.freeze({ state: "complete" as const, hasIntent: false });
    };
    const inventoryBootstrapOperationDirectory = (
      directory: string,
      recoveryId: string,
      base: BootstrapRecord,
      commit: BootstrapRecord,
    ) => {
      const before = fs.lstatSync(directory, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error("docker_task_runtime_state_entry_replaced");
      const baseState = inspectBootstrapPairState(
        directory,
        recoveryId,
        "base.json",
        base,
      );
      const commitState = inspectBootstrapPairState(
        directory,
        recoveryId,
        "base-commit.json",
        commit,
      );
      if (
        (baseState.state !== "complete" && commitState.state !== "absent") ||
        (baseState.hasIntent && commitState.state !== "absent")
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      if (baseState.state === "complete" && commitState.state === "complete") {
        const after = fs.lstatSync(directory, { bigint: true });
        if (
          before.dev !== after.dev ||
          before.ino !== after.ino ||
          before.birthtimeNs !== after.birthtimeNs
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        return Object.freeze({
          baseState: baseState.state,
          commitState: commitState.state,
          pendingBaseSource: pendingSourceExpectation(baseState),
          pendingCommitSource: pendingSourceExpectation(commitState),
        });
      }
      const allowed = new Set<string>();
      for (const [name, state] of [
        ["base.json", baseState.state],
        ["base-commit.json", commitState.state],
      ] as const) {
        if (state === "move_commit" || state === "complete") allowed.add(name);
        if (state === "complete") allowed.add(dockerRecoveryCommitName(name));
      }
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      if (entries.length > 8)
        throw new Error("docker_task_recovery_operation_entry_limit_exceeded");
      if (
        entries.length !== allowed.size ||
        entries.some(
          (entry) =>
            !allowed.has(entry.name) ||
            !entry.isFile() ||
            entry.isSymbolicLink(),
        )
      )
        throw new Error("docker_task_runtime_state_unknown_entry");
      const after = fs.lstatSync(directory, { bigint: true });
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.birthtimeNs !== after.birthtimeNs
      )
        throw new Error("docker_task_runtime_state_entry_replaced");
      return Object.freeze({
        baseState: baseState.state,
        commitState: commitState.state,
        pendingBaseSource: pendingSourceExpectation(baseState),
        pendingCommitSource: pendingSourceExpectation(commitState),
      });
    };
    const addRecord = (
      basePath: string,
      commitPath: string,
      nonce: string,
      expectedRecoveryId: string | null = recoveryIdForNonce(nonce),
    ) => {
      const base = readRootRecord(basePath, "base.json", expectedRecoveryId);
      const commitRecord = readRootRecord(
        commitPath,
        "base-commit.json",
        expectedRecoveryId,
      );
      const commit = commitRecord.value as Record<string, unknown>;
      const value = base.value as Record<string, unknown>;
      const stable = value.stableLogicalHomeBindingHash;
      if (
        !validateDockerRecoveryBase(value, nonce) ||
        !validateDockerRecoveryBaseCommit(
          commit,
          nonce,
          base.hash,
          String(commit.recoveryId ?? ""),
        ) ||
        value.operationNonce !== nonce ||
        commit.operationNonce !== nonce ||
        typeof stable !== "string" ||
        !HEX64.test(stable) ||
        commit.stableLogicalHomeBindingHash !== stable ||
        commit.baseHash !== base.hash
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      const token = `docker-task.${stable}.${nonce}.${base.hash}`;
      if (
        (expectedRecoveryId !== null && token !== expectedRecoveryId) ||
        commit.recoveryId !== token ||
        records.has(nonce)
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      const directory = path.join(rootPath, `docker-task-${nonce}`);
      let pendingBaseSource: "required" | "absent" | "journal" = "required";
      let pendingCommitSource: "required" | "absent" | "journal" = "required";
      let pointerEligible = false;
      if (recoveryPathPresent(directory)) {
        const bootstrap = inventoryBootstrapOperationDirectory(
          directory,
          token,
          base,
          commitRecord,
        );
        pendingBaseSource = bootstrap.pendingBaseSource;
        pendingCommitSource = bootstrap.pendingCommitSource;
        if (
          bootstrap.baseState === "complete" &&
          bootstrap.commitState === "complete" &&
          bootstrap.pendingBaseSource === "absent" &&
          bootstrap.pendingCommitSource === "absent"
        ) {
          if (
            recoveryPathPresent(path.join(directory, "cleanup-manifest.json"))
          )
            verifyRecoveryCleanupManifest(directory, token);
          else {
            const names = inventoryOperationDirectory(
              directory,
              token,
              nonce,
              base.hash,
            );
            const pointerReleaseStarted = [
              "lease-release-receipt.json",
              "normal-run-complete.json",
              "host-cleanup-intent.json",
              "host-cleanup-receipt.json",
            ].some((name) => names.includes(name));
            if (
              names.includes("host-begin-intent.json") &&
              !pointerReleaseStarted
            ) {
              const intent = readExactJson(
                path.join(directory, "host-begin-intent.json"),
              ).value as Record<string, unknown>;
              const lineage = validateHostTransitionLineage(
                intent,
                "docker_submission_started",
              );
              if (lineage.currentToken !== value.initialHostRecoveryId)
                throw new Error(
                  "docker_task_recovery_host_transition_mismatch",
                );
              pointerEligible = true;
            }
          }
        }
      }
      records.set(
        nonce,
        Object.freeze({
          token,
          stable,
          nonce,
          cleanup: false,
          pendingBaseSource,
          pendingCommitSource,
          pointerEligible,
        }),
      );
    };
    const addPendingBaseOnlyRecord = (basePath: string, nonce: string) => {
      const base = readExactJson(basePath, "base.json");
      const value = base.value as Record<string, unknown>;
      const stable = value.stableLogicalHomeBindingHash;
      if (
        !validateDockerRecoveryBase(value, nonce) ||
        value.operationNonce !== nonce ||
        typeof stable !== "string" ||
        !HEX64.test(stable) ||
        records.has(nonce) ||
        recoveryIdForNonce(nonce) !== null
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      records.set(
        nonce,
        Object.freeze({
          token: `docker-task.${stable}.${nonce}.${base.hash}`,
          stable,
          nonce,
          cleanup: false,
          pendingBaseSource: "required" as const,
          pendingCommitSource: "absent" as const,
        }),
      );
    };
    for (const entry of sortedEntries) {
      if (parseDockerDesktopRepairDirectoryName(entry.name)) {
        // Desktop repair owns this subtree. Recognizing its namespace does not
        // validate its records or authorize repair, close, or deletion here.
        const directory = path.join(rootPath, entry.name);
        const metadata = fs.lstatSync(directory);
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          !metadata.isDirectory() ||
          metadata.isSymbolicLink() ||
          fs.realpathSync(directory) !== directory
        )
          throw new Error("docker_task_runtime_state_entry_replaced");
        continue;
      }
      const externalSendConsentEntry = parseExternalSendConsentActiveEntryName(
        entry.name,
      );
      if (externalSendConsentEntry) {
        if (!entry.isFile() || entry.isSymbolicLink())
          throw new Error("docker_task_runtime_state_entry_replaced");
        externalSendConsentRecordNames.add(externalSendConsentEntry.recordName);
        if (externalSendConsentRecordNames.size > 1)
          throw new Error("docker_task_runtime_state_unknown_entry");
        continue;
      }
      if (isDockerRecoveryJournalIntentName(entry.name)) continue;
      if (isDockerRecoveryJournalTemporaryName(entry.name))
        throw new Error("docker_task_runtime_state_orphan_temporary");
      const sessionHandoffMatch = DOCKER_TASK_SESSION_HANDOFF.exec(entry.name);
      if (sessionHandoffMatch?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_session_handoff_invalid");
        const handoff = readExactJson(
          path.join(rootPath, entry.name),
          entry.name,
        ).value as Record<string, unknown>;
        if (
          typeof handoff.recoveryId !== "string" ||
          createHash("sha256").update(handoff.recoveryId).digest("hex") !==
            sessionHandoffMatch[1]
        )
          throw new Error("docker_task_session_handoff_invalid");
        sessionHandoffRecoveryIds.add(handoff.recoveryId);
        continue;
      }
      const completedReceiptMatch = COMPLETED_DOCKER_RECOVERY_RECEIPT.exec(
        entry.name,
      );
      if (completedReceiptMatch?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error("docker_task_recovery_completion_receipt_invalid");
        const receipt = readExactJson(
          path.join(rootPath, entry.name),
          entry.name,
        ).value as Record<string, unknown>;
        if (
          !exactRecordKeys(receipt, [
            "schema",
            "recoveryId",
            "runtimeStateBinding",
          ]) ||
          receipt.schema !== "crdd-coordinator-docker-recovery-completion/v1" ||
          typeof receipt.recoveryId !== "string" ||
          createHash("sha256").update(receipt.recoveryId).digest("hex") !==
            completedReceiptMatch[1] ||
          !validRuntimeStateBindingEvidence(receipt.runtimeStateBinding)
        )
          throw new Error("docker_task_recovery_completion_receipt_invalid");
        completedDockerRecoveryReceiptNames.add(entry.name);
        if (
          completedDockerRecoveryReceiptNames.size >
          MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS
        )
          throw new Error(
            "docker_task_recovery_completion_receipt_limit_exceeded",
          );
        continue;
      }
      const acknowledgedReceiptMatch =
        ACKNOWLEDGED_DOCKER_RECOVERY_RECEIPT.exec(entry.name);
      if (acknowledgedReceiptMatch?.[1]) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          !entryNames.has(dockerRecoveryCommitName(entry.name))
        )
          throw new Error(
            "docker_task_recovery_acknowledgement_tombstone_invalid",
          );
        const acknowledged = readExactJson(
          path.join(rootPath, entry.name),
          entry.name,
        ).value as Record<string, unknown>;
        if (
          !exactRecordKeys(acknowledged, [
            "schema",
            "recoveryId",
            "runtimeStateBinding",
            "receiptContentHash",
            "receiptContentIdentity",
          ]) ||
          acknowledged.schema !==
            "crdd-coordinator-docker-recovery-acknowledgement/v1" ||
          typeof acknowledged.recoveryId !== "string" ||
          createHash("sha256").update(acknowledged.recoveryId).digest("hex") !==
            acknowledgedReceiptMatch[1] ||
          !validRuntimeStateBindingEvidence(acknowledged.runtimeStateBinding) ||
          typeof acknowledged.receiptContentHash !== "string" ||
          !HEX64.test(acknowledged.receiptContentHash) ||
          typeof acknowledged.receiptContentIdentity !== "string" ||
          acknowledged.receiptContentIdentity.length < 1 ||
          acknowledged.receiptContentIdentity.length > 256
        )
          throw new Error(
            "docker_task_recovery_acknowledgement_tombstone_invalid",
          );
        acknowledgedDockerRecoveryReceiptNames.add(entry.name);
        if (
          acknowledgedDockerRecoveryReceiptNames.size >
          MAX_COMPLETED_DOCKER_RECOVERY_RECEIPTS
        )
          throw new Error(
            "docker_task_recovery_acknowledgement_tombstone_limit_exceeded",
          );
        continue;
      }
      if (entry.name.endsWith(".crdd-commit.json")) {
        const dataName = entry.name.slice(0, -".crdd-commit.json".length);
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          (!entryNames.has(dataName) && !journalPairNames.has(entry.name))
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
          if (!journalIntentRecoveryIds.has(cleanupRecoveryId))
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
          recoveryPathPresent(directoryBase)
            ? directoryBase
            : path.join(rootPath, `pending-docker-task-${match[1]}.json`),
          recoveryPathPresent(directoryCommit)
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
    for (const journalRecoveryId of journalIntentRecoveryIds) {
      const parsedJournal = parseDockerTaskRecoveryId(journalRecoveryId);
      if (!parsedJournal || records.has(parsedJournal.operationNonce)) continue;
      const hasCleanupIntent = journalIntents.some(
        (intent) =>
          intent.recoveryId === journalRecoveryId &&
          intent.schema === "crdd-coordinator-recovery-cleanup-delete/v1",
      );
      if (hasCleanupIntent) {
        records.set(
          parsedJournal.operationNonce,
          Object.freeze({
            token: journalRecoveryId,
            stable: parsedJournal.stableLogicalHomeBindingHash,
            nonce: parsedJournal.operationNonce,
            cleanup: true,
          }),
        );
        continue;
      }
      addRecord(
        path.join(
          rootPath,
          `docker-task-${parsedJournal.operationNonce}`,
          "base.json",
        ),
        path.join(
          rootPath,
          `docker-task-${parsedJournal.operationNonce}`,
          "base-commit.json",
        ),
        parsedJournal.operationNonce,
        journalRecoveryId,
      );
    }
    const pendingNonces = new Set([...pendingBaseNames, ...pendingCommitNames]);
    for (const nonce of pendingNonces) {
      if (records.has(nonce)) continue;
      if (pendingBaseNames.has(nonce) && !pendingCommitNames.has(nonce)) {
        addPendingBaseOnlyRecord(
          path.join(rootPath, `pending-docker-task-${nonce}.json`),
          nonce,
        );
        continue;
      }
      if (!pendingBaseNames.has(nonce) || !pendingCommitNames.has(nonce))
        throw new Error("docker_task_runtime_state_pending_incomplete");
      addRecord(
        path.join(rootPath, `pending-docker-task-${nonce}.json`),
        path.join(rootPath, `pending-docker-task-${nonce}.commit.json`),
        nonce,
        recoveryIdForNonce(nonce),
      );
    }
    for (const record of records.values()) {
      if (record.cleanup) continue;
      for (const [expectation, present] of [
        [record.pendingBaseSource, pendingBaseNames.has(record.nonce)],
        [record.pendingCommitSource, pendingCommitNames.has(record.nonce)],
      ] as const) {
        if (
          (expectation === "required" && !present) ||
          (expectation === "absent" && present)
        )
          throw new Error("docker_task_runtime_state_base_invalid");
      }
    }
    for (const recoveryId of sessionHandoffRecoveryIds) {
      const parsed = parseDockerTaskRecoveryId(recoveryId);
      const record = parsed ? records.get(parsed.operationNonce) : null;
      const completion = inspectCompletedDockerRecoveryReceipt(
        rootPath,
        recoveryId,
      );
      if ((!record || record.token !== recoveryId) && !completion)
        throw new Error("docker_task_session_handoff_orphaned");
      const durableBinding = discoverRecoveryRuntimeStateBinding(
        rootPath,
        parsed as NonNullable<ReturnType<typeof parseDockerTaskRecoveryId>>,
      );
      if (!durableBinding)
        throw new Error("docker_task_session_handoff_invalid");
      inspectDockerTaskSessionHandoffs(rootPath, recoveryId, durableBinding);
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
            record.pointerEligible === true &&
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
    for (const record of records.values()) {
      if (pointerTokens.has(record.token) || record.cleanup) continue;
      const pointer = discoverDockerRecoveryJournalJsonForRecovery(
        rootPath,
        `active-lease-${record.stable}.json`,
        record.token,
      );
      if (!pointer) continue;
      if (record.pointerEligible !== true)
        throw new Error("docker_task_runtime_state_orphan_pointer");
      const value = pointer.value as Record<string, unknown>;
      if (
        !exactRecordKeys(value, [
          "schema",
          "stableLogicalHomeBindingHash",
          "operationName",
          "recoveryId",
          "baseHash",
        ]) ||
        value.schema !== "crdd-coordinator-provider-home-active-lease/v1" ||
        value.recoveryId !== record.token ||
        value.stableLogicalHomeBindingHash !== record.stable ||
        value.operationName !== `docker-task-${record.nonce}` ||
        value.baseHash !== record.token.split(".")[3]
      )
        throw new Error("docker_task_runtime_state_orphan_pointer");
      pointerTokens.add(record.token);
      activeStableLogicalHomeBindingHashes.add(record.stable);
    }
    const recoveryIds = [...records.values()]
      .sort((left, right) => {
        const activeOrder =
          Number(pointerTokens.has(right.token)) -
          Number(pointerTokens.has(left.token));
        return activeOrder || left.token.localeCompare(right.token);
      })
      .map((record) => record.token);
    if (recoveryIds.length === 0) {
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_runtime_state_clean",
        manualRecoveryRequired: false,
        dockerRecoveryId: null,
        dockerRecoveryIds: Object.freeze([]),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      });
    }
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

/** @internal Closed contract engine; production supplies the kernel lock. */
export function inspectDockerRecoveryRootSnapshotWithLock(
  root: VerifiedRuntimeStateRoot,
  acquireRuntimeStateLock: (runtimeStateBindingHash: string) => Readonly<{
    release: () => boolean;
  }> | null = acquireRuntimeOwnedDockerRuntimeStateKernelLock,
) {
  try {
    const runtimeStateLock = acquireRuntimeStateLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!runtimeStateLock)
      throw new Error("docker_task_runtime_state_generation_active_or_unknown");
    let result: ReturnType<typeof inspectDockerRecoveryRootSnapshot>;
    let released = false;
    try {
      result = inspectDockerRecoveryRootSnapshot(root.rootPath);
    } finally {
      try {
        released = runtimeStateLock.release();
      } catch {
        released = false;
      }
    }
    if (!released) {
      const verifiedRecoveryIds =
        result.status === "completed" ? result.dockerRecoveryIds : [];
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
        manualRecoveryRequired: true,
        dockerRecoveryId:
          verifiedRecoveryIds.length === 1 ? verifiedRecoveryIds[0] : null,
        dockerRecoveryIds: Object.freeze([...verifiedRecoveryIds]),
        activeStableLogicalHomeBindingHashes:
          result.status === "completed"
            ? result.activeStableLogicalHomeBindingHashes
            : Object.freeze([]),
      });
    }
    return result;
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

export function inspectRuntimeOwnedDockerTaskRecoveryState(
  developmentContext?: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      true,
      new Date().toISOString(),
      developmentContext,
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
    return inspectDockerRecoveryRootSnapshotWithLock(root);
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

/**
 * Resolve Project-owned correlation identities to exact Runtime-owned Docker
 * recovery identifiers. Correlation is durable in the signed Docker base
 * record and is not a Recovery Authority. Ambiguous or missing matches never
 * fall back to inventory order or a caller-provided identifier.
 */
export function resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserver(
  correlationIds: readonly string[],
  root: VerifiedRuntimeStateRoot,
  observeRuntimeStateRoot: () => VerifiedRuntimeStateRoot | null = () => root,
) {
  let release: (() => boolean) | null = null;
  try {
    if (
      !Array.isArray(correlationIds) ||
      correlationIds.length === 0 ||
      correlationIds.length > 5 ||
      new Set(correlationIds).size !== correlationIds.length ||
      correlationIds.some(
        (id) =>
          typeof id !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id),
      )
    )
      throw new Error("docker_task_recovery_correlation_input_invalid");
    const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
      root.stableLogicalHomeBindingHash,
    );
    if (!lock)
      throw new Error("docker_task_runtime_state_generation_active_or_unknown");
    release = lock.release;
    const observedRoot = observeRuntimeStateRoot();
    if (
      !observedRoot ||
      observedRoot.rootPath !== root.rootPath ||
      observedRoot.runtimeStateIdentityHash !== root.runtimeStateIdentityHash ||
      observedRoot.runtimeStateProtectionHash !==
        root.runtimeStateProtectionHash ||
      observedRoot.localUserBindingHash !== root.localUserBindingHash ||
      observedRoot.stableLogicalHomeBindingHash !==
        root.stableLogicalHomeBindingHash
    )
      throw new Error("docker_task_runtime_state_binding_changed");
    const inventory = inspectDockerRecoveryRootSnapshot(root.rootPath);
    if (inventory.status !== "completed")
      throw new Error("docker_task_runtime_state_audit_failed");
    const matches = new Map<string, string>();
    for (const recoveryId of inventory.dockerRecoveryIds) {
      const parsed = parseDockerTaskRecoveryId(recoveryId);
      if (!parsed) throw new Error("docker_task_recovery_identity_invalid");
      const operationBase = path.join(
        root.rootPath,
        `docker-task-${parsed.operationNonce}`,
        "base.json",
      );
      const operationCommit = path.join(
        root.rootPath,
        `docker-task-${parsed.operationNonce}`,
        "base-commit.json",
      );
      const pendingBase = path.join(
        root.rootPath,
        `pending-docker-task-${parsed.operationNonce}.json`,
      );
      const pendingCommit = path.join(
        root.rootPath,
        `pending-docker-task-${parsed.operationNonce}.commit.json`,
      );
      let baseRecord:
        | ReturnType<typeof readCommittedDockerRecoveryJson>
        | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
        | null = null;
      for (const candidate of [operationBase, pendingBase]) {
        if (!recoveryPathPresent(candidate)) continue;
        try {
          baseRecord = readCommittedDockerRecoveryJson(candidate, "base.json");
          break;
        } catch {}
      }
      baseRecord ??= discoverDockerRecoveryJournalJsonForRecovery(
        root.rootPath,
        "base.json",
        parsed.token,
      );
      if (
        !baseRecord ||
        baseRecord.hash !== parsed.baseHash ||
        !validateDockerRecoveryBase(baseRecord.value, parsed.operationNonce)
      )
        throw new Error("docker_task_recovery_base_mismatch");
      let commitRecord:
        | ReturnType<typeof readCommittedDockerRecoveryJson>
        | ReturnType<typeof discoverDockerRecoveryJournalJsonForRecovery>
        | null = null;
      for (const candidate of [operationCommit, pendingCommit]) {
        if (!recoveryPathPresent(candidate)) continue;
        try {
          commitRecord = readCommittedDockerRecoveryJson(
            candidate,
            "base-commit.json",
          );
          break;
        } catch {}
      }
      commitRecord ??= discoverDockerRecoveryJournalJsonForRecovery(
        root.rootPath,
        "base-commit.json",
        parsed.token,
      );
      if (
        commitRecord &&
        !validateDockerRecoveryBaseCommit(
          commitRecord.value,
          parsed.operationNonce,
          parsed.baseHash,
          parsed.token,
        )
      )
        throw new Error("docker_task_recovery_base_commit_mismatch");
      const correlationId =
        (baseRecord.value as Record<string, unknown>).recoveryCorrelationId ??
        (commitRecord?.value as Record<string, unknown> | undefined)
          ?.recoveryCorrelationId;
      if (typeof correlationId !== "string") continue;
      if (!correlationIds.includes(correlationId)) continue;
      if (matches.has(correlationId))
        throw new Error("docker_task_recovery_correlation_ambiguous");
      matches.set(correlationId, recoveryId);
    }
    const bindings = correlationIds
      .filter((correlationId) => matches.has(correlationId))
      .map((correlationId) =>
        Object.freeze({
          correlationId,
          recoveryId: matches.get(correlationId) as string,
        }),
      );
    const absentCorrelationIds = correlationIds.filter(
      (correlationId) => !matches.has(correlationId),
    );
    if (!release())
      throw new Error("docker_task_runtime_state_lock_release_unknown");
    release = null;
    return Object.freeze({
      status: "completed" as const,
      bindings: Object.freeze(bindings),
      absentCorrelationIds: Object.freeze(absentCorrelationIds),
    });
  } catch (error) {
    let released = true;
    if (release) {
      try {
        released = release();
      } catch {
        released = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: released
        ? safeRecoveryReason(error, "docker_task_recovery_correlation_failed")
        : "docker_task_runtime_state_lock_release_unknown",
      manualRecoveryRequired: true,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
    });
  }
}

export function resolveRuntimeOwnedDockerTaskRecoveryCorrelations(
  correlationIds: readonly string[],
  developmentContext?: unknown,
) {
  try {
    const observation = inspectRuntimeOwnedWindowsRuntimeState(
      true,
      new Date().toISOString(),
      developmentContext,
    );
    const root = consumeRuntimeOwnedRuntimeStateRootCapability(
      observation.rootCapability,
    );
    if (observation.status !== "candidate" || !root)
      throw new Error("docker_task_runtime_state_unavailable");
    return resolveRuntimeOwnedDockerTaskRecoveryCorrelationsFromVerifiedRootWithObserver(
      correlationIds,
      root,
      () => observeRuntimeStateRootFromWindows(developmentContext),
    );
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_correlation_failed",
      ),
      manualRecoveryRequired: true,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
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
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_begin_failed_closed",
      ),
      recoveryId: null,
      manualRecoveryRequired: true,
    });
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
    runtimeStateRevalidation:
      "native_root_identity_protection_and_selected_user_observed_outside_the_runtime_state_lock_then_same_root_filesystem_identity_and_full_inventory_verified_after_reacquisition_before_each_mutation_and_after_effect",
    runtimeStateCreationBinding:
      "base_cleanup_manifest_and_root_cleanup_anchor_bind_creation_identity_protection_selected_user_and_runtime_state_hash",
    logicalHomeLease:
      "stable_sid_provider_namespace_kernel_lock_and_durable_active_pointer",
    resourceJournal:
      "file_fsync_base_commit_pointer_identity_host_active_binding_then_exact_docker_id_receipt",
    rootJournalResume:
      "exact_recovery_id_and_creation_binding_with_non_target_byte_identity_preservation",
    completionEvidence:
      "exact_durable_evidence_required_and_empty_root_is_not_a_receipt",
    offlineRecovery:
      "receipt_missing_empty_observation_remains_manual_discovered_exact_id_requires_full_configuration_and_durable_reconciled_receipt_before_removal",
    hostFinalization:
      "host_generation_owner_and_inventory_then_cleanup_intent_receipt_and_exact_removal",
    synchronizationRelease:
      "runtime_state_home_and_host_generation_release_confirmed_before_success",
    productionFacade:
      "native_observation_only_with_internal_contract_engine_excluded_by_package_exports",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
}
