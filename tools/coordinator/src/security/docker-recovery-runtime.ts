import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  beginOwnedDockerSubmissionRecovery,
  completeOwnedDockerSubmissionRecovery,
  getOwnedHostRecoveryIdByManagementCapability,
  confirmOwnedDockerAbsenceForRecovery,
  recoverOwnedOperationDirectories,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";
import {
  loadHostRecoveryRecordByToken,
  parseHostRecoveryToken,
} from "./host-recovery-record.ts";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "./provider-home-windows-adapter.ts";

export const DOCKER_RECOVERY_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-recovery-runtime";
export const DOCKER_RECOVERY_RUNTIME_CONTRACT_REVISION = 2;

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
  recoveryId: string;
  baseHash: string;
  baseIdentity: Readonly<{ dev: bigint; ino: bigint; birthtimeNs: bigint }>;
  managementCapability: object;
  operationId: string;
  stableLogicalHomeBindingHash: string;
  initialHostRecoveryId: string;
  logicalHomeLease: Readonly<{ release: () => boolean }>;
}>;

const durableRecords = new WeakMap<object, DurableRecord>();

function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function flushDirectory(directory: string) {
  const handle = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function writeDurableJson(directory: string, name: string, value: unknown) {
  const target = path.join(directory, name);
  const serialized = canonical(value);
  const handle = fs.openSync(target, "wx", 0o600);
  try {
    fs.writeFileSync(handle, serialized, "utf8");
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  flushDirectory(directory);
  const before = fs.lstatSync(target, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink())
    throw new Error("docker_recovery_record_invalid");
  const observed = fs.readFileSync(target, "utf8");
  const after = fs.lstatSync(target, { bigint: true });
  if (
    observed !== serialized ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.birthtimeNs !== after.birthtimeNs
  ) {
    throw new Error("docker_recovery_record_changed");
  }
  return Object.freeze({
    target,
    serialized,
    hash: createHash("sha256").update(serialized).digest("hex"),
    identity: Object.freeze({
      dev: before.dev,
      ino: before.ino,
      birthtimeNs: before.birthtimeNs,
    }),
  });
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
    !HEX64.test(root.stableLogicalHomeBindingHash)
  )
    return null;
  const lock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    plan.stableLogicalHomeBindingHash,
  );
  if (!lock) return null;
  let leaseTransferred = false;
  try {
    const operationNonce = randomBytes(32).toString("hex");
    const operationName = `docker-task-${operationNonce}`;
    const operationDirectory = path.join(root.rootPath, operationName);
    fs.mkdirSync(operationDirectory, { mode: 0o700 });
    flushDirectory(root.rootPath);
    const operationMetadata = fs.lstatSync(operationDirectory);
    if (!operationMetadata.isDirectory() || operationMetadata.isSymbolicLink())
      throw new Error("docker_recovery_operation_directory_invalid");
    const initialHostRecoveryId =
      getOwnedHostRecoveryIdByManagementCapability(managementCapability);
    const initialHostRecovery = hostRecoveryIdentity(initialHostRecoveryId);
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
    });
    const baseFile = writeDurableJson(operationDirectory, "base.json", base);
    const recoveryId = `docker-task.${plan.stableLogicalHomeBindingHash}.${operationNonce}.${baseFile.hash}`;
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
        recoveryId,
        baseHash: baseFile.hash,
        baseIdentity: baseFile.identity,
        managementCapability,
        operationId: operation.operationId,
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        initialHostRecoveryId,
        logicalHomeLease: lock,
      }),
    );
    leaseTransferred = true;
    return Object.freeze({ recoveryId, recoveryCapability });
  } finally {
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
      !fs.existsSync(
        path.join(record.operationDirectory, `submission-${purpose}.json`),
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
      if (!submitted && fs.existsSync(receipt)) return null;
      let dockerId: string | null = null;
      if (fs.existsSync(receipt)) {
        const metadata = fs.lstatSync(receipt);
        if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
        const value = JSON.parse(fs.readFileSync(receipt, "utf8"));
        if (
          !value ||
          typeof value !== "object" ||
          value.schema !== "crdd-coordinator-docker-resource-receipt/v1" ||
          value.purpose !== purpose ||
          value.recoveryId !== record.recoveryId ||
          !HEX64.test(value.dockerId)
        )
          return null;
        dockerId = value.dockerId;
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
    const pointer = fs.lstatSync(record.pointerPath, { bigint: true });
    if (!pointer.isFile() || pointer.isSymbolicLink())
      return Object.freeze({ status: "blocked" as const });
    fs.rmSync(record.pointerPath);
    flushDirectory(record.rootPath);
    if (!record.logicalHomeLease.release())
      return Object.freeze({ status: "blocked" as const });
    writeDurableJson(
      record.operationDirectory,
      "lease-release-receipt.json",
      Object.freeze({
        schema: "crdd-coordinator-provider-home-lease-release/v1",
        recoveryId: record.recoveryId,
        pointerAbsent: !fs.existsSync(record.pointerPath),
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
    if (!record || fs.existsSync(record.pointerPath))
      return Object.freeze({ status: "blocked" as const });
    const allowed =
      /^(?:base|host-(?:begin|complete)-(?:intent|receipt)|submission-[a-z_]+|receipt-[a-z_]+|docker-absence|mount-completion|lease-release-receipt)\.json$/u;
    const entries = fs.readdirSync(record.operationDirectory);
    if (entries.length > 32 || entries.some((entry) => !allowed.test(entry)))
      return Object.freeze({ status: "blocked" as const });
    for (const entry of entries) {
      const target = path.join(record.operationDirectory, entry);
      const metadata = fs.lstatSync(target);
      if (!metadata.isFile() || metadata.isSymbolicLink())
        return Object.freeze({ status: "blocked" as const });
      fs.rmSync(target);
    }
    fs.rmdirSync(record.operationDirectory);
    flushDirectory(record.rootPath);
    durableRecords.delete(recoveryFinalizationCapability as object);
    return Object.freeze({ status: "completed" as const });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
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

function readExactJson(file: string) {
  const metadata = fs.lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("docker_task_recovery_record_invalid");
  const serialized = fs.readFileSync(file, "utf8");
  const value = JSON.parse(serialized);
  if (canonical(value) !== serialized)
    throw new Error("docker_task_recovery_record_noncanonical");
  return Object.freeze({ value, serialized });
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

function runRecoveryDocker(configDirectory: string, argv: readonly string[]) {
  verifyRecoveryDockerCli();
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
  const listed = runRecoveryDocker(configDirectory, listArgs);
  if (
    listed.status !== 0 ||
    listed.signal ||
    listed.error ||
    listed.stderr.length
  )
    return false;
  const ids = listed.stdout.trim() ? listed.stdout.trim().split(/\r?\n/u) : [];
  if (ids.length === 0) return true;
  if (ids.length !== 1 || ids[0] !== dockerId) return false;
  const inspected = runRecoveryDocker(
    configDirectory,
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
    kind === "container"
      ? ["container", "rm", "--force", dockerId]
      : ["network", "rm", dockerId],
  );
  if (removed.status !== 0 || removed.signal || removed.error) return false;
  const absent = runRecoveryDocker(configDirectory, listArgs);
  return (
    absent.status === 0 &&
    !absent.signal &&
    !absent.error &&
    absent.stderr.length === 0 &&
    absent.stdout.trim() === ""
  );
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
  const processAbsenceLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    parsed.stableLogicalHomeBindingHash,
  );
  if (!processAbsenceLock)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_process_generation_active_or_unknown",
      recoveryId: parsed.token,
    });
  try {
    const operationDirectory = path.join(
      root.rootPath,
      `docker-task-${parsed.operationNonce}`,
    );
    const baseFile = readExactJson(path.join(operationDirectory, "base.json"));
    if (
      createHash("sha256").update(baseFile.serialized).digest("hex") !==
      parsed.baseHash
    )
      throw new Error("docker_task_recovery_base_mismatch");
    const base = baseFile.value as Record<string, unknown>;
    if (
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
    const hostBeginIntent = readExactJson(
      path.join(operationDirectory, "host-begin-intent.json"),
    ).value as Record<string, string>;
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
      try {
        loadHostRecoveryRecordByToken(hostBeginExpectedToken);
        hostReceipt = {
          previous: hostBeginCurrentToken,
          observed: hostBeginExpectedToken,
        };
        writeDurableJson(
          operationDirectory,
          "host-begin-receipt.json",
          hostReceipt,
        );
      } catch {
        loadHostRecoveryRecordByToken(hostBeginCurrentToken);
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
    const configDirectory = path.join(
      hostRoot,
      managementName,
      "docker-cli-config",
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
      fs.rmSync(pointerPath);
      flushDirectory(root.rootPath);
    };
    if (!hostSubmissionStarted) {
      releasePointer();
      if (!processAbsenceLock.release())
        throw new Error("docker_task_recovery_lock_release_unconfirmed");
      const hostRecovery =
        recoverOwnedOperationDirectories(submissionHostToken);
      if (hostRecovery.status !== "recovered")
        return Object.freeze({
          status: "blocked" as const,
          reason: hostRecovery.reason,
          recoveryId: parsed.token,
        });
      for (const entry of fs.readdirSync(operationDirectory))
        fs.rmSync(path.join(operationDirectory, entry));
      fs.rmdirSync(operationDirectory);
      flushDirectory(root.rootPath);
      return Object.freeze({
        status: "recovered" as const,
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      });
    }
    let createdConfig = false;
    if (!fs.existsSync(configDirectory)) {
      fs.mkdirSync(configDirectory, { mode: 0o700 });
      createdConfig = true;
    }
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
    if (createdConfig) fs.rmdirSync(configDirectory);
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
      dockerAbsentHostToken =
        confirmOwnedDockerAbsenceForRecovery(submissionHostToken);
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
    if (!processAbsenceLock.release())
      throw new Error("docker_task_recovery_lock_release_unconfirmed");
    const hostRecovery = recoverOwnedOperationDirectories(
      dockerAbsentHostToken,
    );
    if (hostRecovery.status !== "recovered")
      return Object.freeze({
        status: "blocked" as const,
        reason: hostRecovery.reason,
        recoveryId: parsed.token,
      });
    for (const entry of fs.readdirSync(operationDirectory)) {
      const target = path.join(operationDirectory, entry);
      const metadata = fs.lstatSync(target);
      if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new Error("docker_task_recovery_unknown_entry");
      fs.rmSync(target);
    }
    fs.rmdirSync(operationDirectory);
    flushDirectory(root.rootPath);
    return Object.freeze({
      status: "recovered" as const,
      reason: "docker_task_recovery_completed",
      recoveryId: null,
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "docker_task_recovery_failed";
    return Object.freeze({
      status: "blocked" as const,
      reason,
      recoveryId: parsed.token,
    });
  } finally {
    processAbsenceLock.release();
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
      });
    const entries = fs.readdirSync(root.rootPath, { withFileTypes: true });
    if (entries.length > 128)
      throw new Error("docker_task_runtime_state_entry_limit_exceeded");
    const directories = entries.filter((entry) =>
      /^docker-task-[a-f0-9]{64}$/u.test(entry.name),
    );
    const pointers = entries.filter((entry) =>
      /^active-lease-[a-f0-9]{64}\.json$/u.test(entry.name),
    );
    if (directories.length + pointers.length !== entries.length)
      throw new Error("docker_task_runtime_state_unknown_entry");
    if (entries.length === 0)
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_runtime_state_clean",
        manualRecoveryRequired: false,
        dockerRecoveryId: null,
      });
    for (const directory of directories) {
      if (!directory.isDirectory() || directory.isSymbolicLink())
        throw new Error("docker_task_runtime_state_entry_replaced");
      const operationNonce = directory.name.slice("docker-task-".length);
      const base = readExactJson(
        path.join(root.rootPath, directory.name, "base.json"),
      );
      const baseHash = createHash("sha256")
        .update(base.serialized)
        .digest("hex");
      const value = base.value as Record<string, unknown>;
      const stable = value.stableLogicalHomeBindingHash;
      if (
        value.operationNonce !== operationNonce ||
        typeof stable !== "string" ||
        !HEX64.test(stable)
      )
        throw new Error("docker_task_runtime_state_base_invalid");
      return Object.freeze({
        status: "blocked" as const,
        reason: "docker_task_recovery_required",
        manualRecoveryRequired: true,
        dockerRecoveryId: `docker-task.${stable}.${operationNonce}.${baseHash}`,
      });
    }
    throw new Error("docker_task_runtime_state_orphan_pointer");
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof Error
          ? error.message
          : "docker_task_runtime_state_audit_failed",
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
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
      "submission_marker_before_create_then_exact_docker_id_receipt",
    offlineRecovery:
      "exact_id_and_configuration_only_unknown_create_outcome_never_adopted",
    hostFinalization:
      "operation_record_retained_until_host_cleanup_then_exact_removal",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
}
