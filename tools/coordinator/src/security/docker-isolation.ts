import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  verifyOwnedMountCapability,
} from "./execution-environment.ts";
import {
  formatHostRecoveryToken,
  loadHostRecoveryRecordByToken,
} from "./host-recovery-record.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const PROBE_IMAGE =
  "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
const MAX_OUTPUT_BYTES = 64 * 1024;
const PROBE_MARKER = "crdd-coordinator-isolation-v1";
const OWNERSHIP_LABEL = "crdd.coordinator.probe";
const DOCKER_DESKTOP_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
type EntityType = "file" | "directory";
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;
type DockerMounts = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;
type DockerEnvironment = Record<string, string>;
type DockerExecution = Pick<
  SpawnSyncReturns<string>,
  "error" | "status" | "stdout"
>;
type ContainerIdentity = Readonly<{ id: string; probeId: string }>;
type CliSnapshot = Readonly<{
  root: string;
  executable: string;
  rootIdentity: FilesystemIdentity;
  executableIdentity: FilesystemIdentity;
  sha256: string;
}>;
type AbsenceObservation = Readonly<{
  probeId: string;
  containerId: string;
  hostRecoveryId: string;
  rootName: string;
  cli: object;
}>;
type DockerCliPolicy = Readonly<{
  installRoot: string;
  executableName: string;
  sha256: string;
  trustBasis: string;
  updateBehavior: string;
}>;
type DockerProbeFailureState = Readonly<{
  submissionStarted: boolean;
  recoveryId: string | null;
  hostRecoveryId: string;
  rollbackFailed: boolean;
}>;
type DockerRecoveryRecord = Readonly<{
  schema: "crdd-coordinator-docker-recovery/v1";
  probeId: string;
  nonceHash: string;
  rootName: string;
  rootIdentity: SerializableIdentity;
  childIdentities: Readonly<Record<string, SerializableIdentity>>;
  container: Readonly<{ id: string | null; name: string; label: string }>;
  engine: string;
  image: string;
  hostRecoveryId: string;
  createdAt: string;
}>;
type LoadedDockerRecovery = Readonly<{
  parsed: Readonly<{
    rootName: string;
    probeId: string;
    nonce: string;
    recordHash: string;
  }>;
  record: DockerRecoveryRecord;
  root: string;
  children: DockerMounts;
  marker: string;
  present: ReadonlySet<string>;
}>;

const containerIdentities = new WeakMap<object, ContainerIdentity>();
const cliIdentities = new WeakMap<object, CliSnapshot>();
const absenceCapabilities = new WeakMap<object, AbsenceObservation>();
const RECOVERY_FILE = "docker-probe-recovery-v1.json";
const OPERATION_PREFIX = "crdd-coordinator-doctor-";

type DockerProbeResult = Readonly<{
  status: "confirmed" | "blocked" | "recovered";
  reason: string;
  probeId: string | null;
  retainOperationDirectories: boolean;
  hostCleanupCompleted: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
}>;

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

function ownString(value: unknown, key: string): string | null {
  const candidate = isObject(value) ? ownValue(value, key) : undefined;
  return typeof candidate === "string" ? candidate : null;
}

function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

function normalizeSerializableIdentity(value: unknown): SerializableIdentity {
  if (!isObject(value)) throw new Error("docker_recovery_record_mismatch");
  const dev = ownString(value, "dev");
  const ino = ownString(value, "ino");
  const birthtimeNs = ownString(value, "birthtimeNs");
  if (!dev || !ino || !birthtimeNs)
    throw new Error("docker_recovery_record_mismatch");
  return Object.freeze({ dev, ino, birthtimeNs });
}

function normalizeDockerRecoveryRecord(value: unknown): DockerRecoveryRecord {
  if (!isObject(value)) throw new Error("docker_recovery_record_mismatch");
  const schema = ownString(value, "schema");
  const probeId = ownString(value, "probeId");
  const nonceHash = ownString(value, "nonceHash");
  const rootName = ownString(value, "rootName");
  const hostRecoveryId = ownString(value, "hostRecoveryId");
  const createdAt = ownString(value, "createdAt");
  const engine = ownString(value, "engine");
  const image = ownString(value, "image");
  const childrenValue = ownValue(value, "childIdentities");
  const containerValue = ownValue(value, "container");
  if (
    schema !== "crdd-coordinator-docker-recovery/v1" ||
    !probeId ||
    !nonceHash ||
    !rootName ||
    !hostRecoveryId ||
    !createdAt ||
    !engine ||
    !image ||
    !isObject(childrenValue) ||
    !isObject(containerValue)
  )
    throw new Error("docker_recovery_record_mismatch");
  const childIdentities: Record<string, SerializableIdentity> = {};
  for (const key of Object.keys(childrenValue)) {
    childIdentities[key] = normalizeSerializableIdentity(
      ownValue(childrenValue, key),
    );
  }
  const idValue = ownValue(containerValue, "id");
  const id = typeof idValue === "string" ? idValue : null;
  const name = ownString(containerValue, "name");
  const label = ownString(containerValue, "label");
  if ((idValue !== null && id === null) || !name || !label) {
    throw new Error("docker_recovery_record_mismatch");
  }
  return Object.freeze({
    schema,
    probeId,
    nonceHash,
    rootName,
    rootIdentity: normalizeSerializableIdentity(
      ownValue(value, "rootIdentity"),
    ),
    childIdentities: Object.freeze(childIdentities),
    container: Object.freeze({ id, name, label }),
    engine,
    image,
    hostRecoveryId,
    createdAt,
  });
}

export const DOCKER_CLI_POLICY = Object.freeze({
  installRoot: "C:\\Program Files\\Docker\\Docker\\resources\\bin",
  executableName: "docker.exe",
  sha256: "C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610",
  trustBasis:
    "valid_authenticode_docker_inc_then_human_selected_runtime_policy",
  updateBehavior: "block_until_reapproved",
});

const PROBE_SOURCE = `
import json, os, pathlib, socket, sys
result={"marker":"${PROBE_MARKER}","allowed_writes":{},"runtime_paths_absent":True,"credential_names_absent":True,"network_blocked":False,"home_isolated":False,"tmp_isolated":False}
for name in ("workspace","provider-home","tmp"):
    target=pathlib.Path("/operation")/name/".coordinator-probe"
    try:
        target.write_text(name,encoding="utf-8"); result["allowed_writes"][name]=target.read_text(encoding="utf-8")==name; target.unlink()
    except Exception: result["allowed_writes"][name]=False
result["runtime_paths_absent"]=all(not pathlib.Path("/runtime",name).exists() for name in ("events","projection","management"))
credential_names={"ANTHROPIC_API_KEY","CLAUDE_CODE_OAUTH_TOKEN","CODEX_API_KEY","CODEX_ACCESS_TOKEN","GH_TOKEN","GITHUB_TOKEN","GIT_ASKPASS","OPENAI_API_KEY","SSH_AUTH_SOCK"}
result["credential_names_absent"]=credential_names.isdisjoint(os.environ)
result["home_isolated"]=os.environ.get("HOME")=="/operation/provider-home"
result["tmp_isolated"]=os.environ.get("TMPDIR")=="/operation/tmp"
sock=socket.socket(socket.AF_INET,socket.SOCK_STREAM); sock.settimeout(0.5)
try: sock.connect(("1.1.1.1",443))
except OSError: result["network_blocked"]=True
finally: sock.close()
print(json.dumps(result,separators=(",",":")))
sys.exit(0 if all(result["allowed_writes"].values()) and all([result["runtime_paths_absent"],result["credential_names_absent"],result["network_blocked"],result["home_isolated"],result["tmp_isolated"]]) else 3)
`;

function filesystemIdentity(
  target: string,
  expectedType: EntityType,
): FilesystemIdentity {
  const metadata = fs.lstatSync(target, { bigint: true });
  const isTypeValid =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isTypeValid ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_cli_untrusted");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

function sameIdentity(
  left: FilesystemIdentity,
  right: FilesystemIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function serializableIdentity(
  target: string,
  expectedType: EntityType = "directory",
): SerializableIdentity {
  const identity = filesystemIdentity(target, expectedType);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
  expectedType: EntityType = "directory",
): boolean {
  try {
    const identity = filesystemIdentity(target, expectedType);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

function fileSha256(target: string): string {
  return createHash("sha256")
    .update(fs.readFileSync(target))
    .digest("hex")
    .toUpperCase();
}

export function evaluateDockerCliCandidateForFixture(
  policy: Pick<DockerCliPolicy, "installRoot" | "executableName" | "sha256">,
): boolean {
  try {
    const root = fs.realpathSync(policy.installRoot);
    const executable = path.join(root, policy.executableName);
    const realExecutable = fs.realpathSync(executable);
    if (
      path.dirname(realExecutable) !== root ||
      path.basename(realExecutable) !== policy.executableName
    )
      return false;
    filesystemIdentity(root, "directory");
    filesystemIdentity(realExecutable, "file");
    return fileSha256(realExecutable) === policy.sha256;
  } catch {
    return false;
  }
}

function createTrustedDockerCliCapability(): Readonly<{
  kind: "trusted_docker_cli";
}> {
  if (process.platform !== "win32")
    throw new Error("docker_backend_platform_unsupported");
  if (!evaluateDockerCliCandidateForFixture(DOCKER_CLI_POLICY))
    throw new Error("docker_cli_untrusted");
  const root = fs.realpathSync(DOCKER_CLI_POLICY.installRoot);
  const executable = path.join(root, DOCKER_CLI_POLICY.executableName);
  const realExecutable = fs.realpathSync(executable);
  if (
    root !== DOCKER_CLI_POLICY.installRoot ||
    path.dirname(realExecutable) !== root ||
    path.basename(realExecutable) !== DOCKER_CLI_POLICY.executableName
  ) {
    throw new Error("docker_cli_untrusted");
  }
  const snapshot = Object.freeze({
    root,
    executable: realExecutable,
    rootIdentity: filesystemIdentity(root, "directory"),
    executableIdentity: filesystemIdentity(realExecutable, "file"),
    sha256: fileSha256(realExecutable),
  });
  if (snapshot.sha256 !== DOCKER_CLI_POLICY.sha256)
    throw new Error("docker_cli_untrusted");
  const capability = Object.freeze({ kind: "trusted_docker_cli" });
  cliIdentities.set(capability, snapshot);
  return capability;
}

function verifyTrustedDockerCliCapability(capability: object): string {
  const snapshot = cliIdentities.get(capability);
  if (!snapshot) throw new Error("docker_cli_untrusted");
  const realRoot = fs.realpathSync(snapshot.root);
  const realExecutable = fs.realpathSync(snapshot.executable);
  if (
    realRoot !== snapshot.root ||
    realExecutable !== snapshot.executable ||
    path.dirname(realExecutable) !== realRoot ||
    !sameIdentity(
      filesystemIdentity(realRoot, "directory"),
      snapshot.rootIdentity,
    ) ||
    !sameIdentity(
      filesystemIdentity(realExecutable, "file"),
      snapshot.executableIdentity,
    ) ||
    fileSha256(realExecutable) !== snapshot.sha256
  )
    throw new Error("docker_cli_untrusted");
  return snapshot.executable;
}

function bindMount(source: string, destination: string): string {
  if (source.includes(",")) throw new Error("docker_mount_path_unsupported");
  return `type=bind,src=${source},dst=${destination}`;
}

function containerName(probeId: string): string {
  return `crdd-coordinator-probe-${probeId}`;
}

export function dockerCreateArgumentsForFixture(
  mounts: DockerMounts,
  probeId = "fixture",
): string[] {
  return [
    "-H",
    DOCKER_DESKTOP_ENGINE,
    "create",
    "--pull=never",
    "--network=none",
    "--read-only",
    "--name",
    containerName(probeId),
    "--label",
    `${OWNERSHIP_LABEL}=${probeId}`,
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=64",
    "--user=65532:65532",
    "--workdir=/operation/workspace",
    "--env",
    "HOME=/operation/provider-home",
    "--env",
    "TMPDIR=/operation/tmp",
    "--mount",
    bindMount(mounts.workspace, "/operation/workspace"),
    "--mount",
    bindMount(mounts.providerHome, "/operation/provider-home"),
    "--mount",
    bindMount(mounts.tmp, "/operation/tmp"),
    "--entrypoint",
    "python",
    PROBE_IMAGE,
    "-c",
    PROBE_SOURCE,
  ];
}

export function normalizeDockerIsolationResult(
  execution: DockerExecution,
): Readonly<{ status: "confirmed" | "blocked"; reason: string }> {
  if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string"
  )
    return { status: "blocked", reason: "docker_isolation_probe_failed" };
  if (Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES)
    return {
      status: "blocked",
      reason: "docker_isolation_probe_output_too_large",
    };
  let parsed: unknown;
  try {
    parsed = JSON.parse(execution.stdout.trim());
  } catch {
    return {
      status: "blocked",
      reason: "docker_isolation_probe_invalid_output",
    };
  }
  const result = snapshotPlainRecord(
    parsed,
    new Set([
      "marker",
      "allowed_writes",
      "runtime_paths_absent",
      "credential_names_absent",
      "network_blocked",
      "home_isolated",
      "tmp_isolated",
    ]),
  );
  const allowedWrites = result
    ? snapshotPlainRecord(
        result.allowed_writes,
        new Set(["workspace", "provider-home", "tmp"]),
      )
    : null;
  const isValid =
    result?.marker === PROBE_MARKER &&
    allowedWrites?.workspace === true &&
    allowedWrites?.["provider-home"] === true &&
    allowedWrites?.tmp === true &&
    result.runtime_paths_absent === true &&
    result.credential_names_absent === true &&
    result.network_blocked === true &&
    result.home_isolated === true &&
    result.tmp_isolated === true;
  return isValid
    ? {
        status: "confirmed",
        reason: "docker_fake_provider_isolation_confirmed",
      }
    : { status: "blocked", reason: "docker_isolation_probe_assertion_failed" };
}

function dockerEnvironment(management: string): DockerEnvironment {
  const dockerConfig = path.join(management, "docker-config");
  const dockerHome = path.join(management, "docker-home");
  fs.mkdirSync(dockerConfig, { recursive: true });
  fs.mkdirSync(dockerHome, { recursive: true });
  const environment: DockerEnvironment = {
    DOCKER_CONFIG: dockerConfig,
    HOME: dockerHome,
    USERPROFILE: dockerHome,
  };
  for (const name of ["SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE"]) {
    if (typeof process.env[name] === "string")
      environment[name] = process.env[name];
  }
  return environment;
}

function recoveryToken(
  rootName: string,
  probeId: string,
  nonce: string,
  recordHash: string,
): string {
  return `docker.${rootName}.${probeId}.${nonce}.${recordHash}`;
}

function transitionHostRecoveryState(
  hostRecoveryId: string,
  expectedState: string,
  nextState: string,
): string {
  const loaded = loadHostRecoveryRecordByToken(hostRecoveryId);
  if (loaded.record.state !== expectedState)
    throw new Error("host_recovery_state_invalid");
  const updated = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updated)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, loaded.marker);
  return formatHostRecoveryToken(
    loaded.parsed.rootName,
    loaded.parsed.nonce,
    recordHash,
  );
}

function beginDockerSubmission(hostRecoveryId: string): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "host_only",
    "docker_submission_started",
  );
}

function cancelDockerSubmissionBeforeCreate(hostRecoveryId: string): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "host_only",
  );
}

function confirmDockerAbsence(
  hostRecoveryId: string,
  capability: unknown,
  expected: Readonly<{
    probeId: string;
    id: string;
    rootName: string;
    cli: object;
  }>,
): string {
  const observation = isObject(capability)
    ? (absenceCapabilities.get(capability) ?? null)
    : null;
  if (
    !observation ||
    observation.hostRecoveryId !== hostRecoveryId ||
    observation.probeId !== expected.probeId ||
    observation.containerId !== expected.id ||
    observation.rootName !== expected.rootName ||
    observation.cli !== expected.cli
  )
    throw new Error("docker_absence_capability_required");
  const updated = transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "docker_absent_confirmed",
  );
  if (isObject(capability)) absenceCapabilities.delete(capability);
  return updated;
}

function recoveryRecordPath(management: string): string {
  return path.join(management, RECOVERY_FILE);
}

function writeRecoveryRecord(
  mounts: DockerMounts,
  probeId: string,
  nonce: string,
  hostRecoveryId: string,
  containerId: string | null = null,
): string {
  const root = path.dirname(mounts.management);
  const rootName = path.basename(root);
  if (
    !rootName.startsWith(OPERATION_PREFIX) ||
    fs.realpathSync(path.dirname(root)) !== fs.realpathSync(os.tmpdir())
  )
    throw new Error("docker_recovery_boundary_failed");
  const record = {
    schema: "crdd-coordinator-docker-recovery/v1",
    probeId,
    nonceHash: createHash("sha256").update(nonce).digest("hex"),
    rootName,
    rootIdentity: serializableIdentity(root),
    childIdentities: {
      workspace: serializableIdentity(mounts.workspace),
      "provider-home": serializableIdentity(mounts.providerHome),
      tmp: serializableIdentity(mounts.tmp),
      events: serializableIdentity(mounts.events),
      projection: serializableIdentity(mounts.projection),
      management: serializableIdentity(mounts.management),
    },
    container: {
      id: containerId,
      name: containerName(probeId),
      label: `${OWNERSHIP_LABEL}=${probeId}`,
    },
    engine: "docker_desktop_linux_named_pipe",
    image: PROBE_IMAGE,
    hostRecoveryId,
    createdAt: new Date().toISOString(),
  };
  const target = recoveryRecordPath(mounts.management);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, target);
  if (
    !identityMatchesRecord(target, serializableIdentity(target, "file"), "file")
  )
    throw new Error("docker_recovery_record_failed");
  return recoveryToken(rootName, probeId, nonce, recordHash);
}

function executeDocker(
  cliCapability: object,
  args: readonly string[],
  environment: DockerEnvironment,
  timeout = 10_000,
): SpawnSyncReturns<string> {
  const executable = verifyTrustedDockerCliCapability(cliCapability);
  return spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: MAX_OUTPUT_BYTES,
    env: environment,
  });
}

function dockerCommand(
  cli: object,
  environment: DockerEnvironment,
  args: readonly string[],
  timeout = 10_000,
): SpawnSyncReturns<string> {
  return executeDocker(
    cli,
    ["-H", DOCKER_DESKTOP_ENGINE, ...args],
    environment,
    timeout,
  );
}

function normalizeFailure(
  error: unknown,
  fallback = "docker_isolation_probe_failed",
): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_mount_path_unsupported",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = errorMessage(error);
  return message && known.has(message) ? message : fallback;
}

function validContainerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value.trim());
}

export function normalizeContainerCreation(execution: DockerExecution):
  | Readonly<{ status: "confirmed"; id: string }>
  | Readonly<{
      status: "blocked";
      reason: "docker_container_identity_unknown";
    }> {
  if (
    execution?.error ||
    execution?.status !== 0 ||
    !validContainerId(execution?.stdout)
  ) {
    return { status: "blocked", reason: "docker_container_identity_unknown" };
  }
  return { status: "confirmed", id: execution.stdout.trim() };
}

function normalizedIdSet(execution: DockerExecution): Set<string> | null {
  if (
    execution?.error ||
    execution?.status !== 0 ||
    typeof execution?.stdout !== "string" ||
    Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES
  )
    return null;
  const lines = execution.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.some((line) => !validContainerId(line)) ||
    new Set(lines).size !== lines.length
  )
    return null;
  return new Set(lines);
}

export function normalizeContainerAbsence(
  idExecution: DockerExecution,
  nameExecution: DockerExecution,
  labelExecution: DockerExecution,
) {
  const sets = [idExecution, nameExecution, labelExecution].map(
    normalizedIdSet,
  );
  const isConfirmed = sets.every((set) => set instanceof Set && set.size === 0);
  return isConfirmed
    ? { status: "confirmed", reason: "docker_probe_absence_confirmed" }
    : { status: "blocked", reason: "docker_probe_absence_unconfirmed" };
}

function readInspect(execution: DockerExecution): unknown | null {
  if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string" ||
    Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(execution.stdout);
    return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  } catch {
    return null;
  }
}

function expectedMounts(mounts: DockerMounts): Map<string, string> {
  return new Map([
    ["/operation/workspace", mounts.workspace],
    ["/operation/provider-home", mounts.providerHome],
    ["/operation/tmp", mounts.tmp],
  ]);
}

export function validateContainerInspect(
  inspect: unknown,
  expected: ContainerIdentity & Readonly<{ mounts: DockerMounts }>,
): boolean {
  if (!isObject(inspect)) return false;
  if (
    ownValue(inspect, "Id") !== expected.id ||
    ownValue(inspect, "Name") !== `/${containerName(expected.probeId)}`
  )
    return false;
  const config = ownValue(inspect, "Config");
  const host = ownValue(inspect, "HostConfig");
  if (!isObject(config) || !isObject(host)) return false;
  const labels = ownValue(config, "Labels");
  const entrypoint = ownValue(config, "Entrypoint");
  const command = ownValue(config, "Cmd");
  if (
    !isObject(labels) ||
    ownValue(labels, OWNERSHIP_LABEL) !== expected.probeId
  )
    return false;
  if (
    ownValue(config, "Image") !== PROBE_IMAGE ||
    ownValue(config, "User") !== "65532:65532"
  )
    return false;
  if (
    !Array.isArray(entrypoint) ||
    entrypoint.length !== 1 ||
    entrypoint[0] !== "python"
  )
    return false;
  if (
    !Array.isArray(command) ||
    command.length !== 2 ||
    command[0] !== "-c" ||
    command[1] !== PROBE_SOURCE
  )
    return false;
  if (
    ownValue(host, "NetworkMode") !== "none" ||
    ownValue(host, "ReadonlyRootfs") !== true ||
    ownValue(host, "Privileged") !== false ||
    Number(ownValue(host, "PidsLimit")) !== 64
  )
    return false;
  const capDrop = ownValue(host, "CapDrop");
  const capAdd = ownValue(host, "CapAdd");
  const devices = ownValue(host, "Devices");
  const securityOptions = ownValue(host, "SecurityOpt");
  if (!Array.isArray(capDrop) || capDrop.length !== 1 || capDrop[0] !== "ALL")
    return false;
  if (
    (capAdd != null && (!Array.isArray(capAdd) || capAdd.length !== 0)) ||
    (devices != null && (!Array.isArray(devices) || devices.length !== 0)) ||
    !Array.isArray(securityOptions) ||
    !securityOptions.includes("no-new-privileges")
  )
    return false;
  const wanted = expectedMounts(expected.mounts);
  const inspectMounts = ownValue(inspect, "Mounts");
  if (!Array.isArray(inspectMounts) || inspectMounts.length !== wanted.size)
    return false;
  for (const mount of inspectMounts) {
    if (!isObject(mount)) return false;
    const destination = ownValue(mount, "Destination");
    const sourcePath = ownValue(mount, "Source");
    if (typeof destination !== "string" || typeof sourcePath !== "string")
      return false;
    const source = wanted.get(destination);
    if (
      !source ||
      ownValue(mount, "Type") !== "bind" ||
      ownValue(mount, "RW") !== true
    )
      return false;
    try {
      if (fs.realpathSync(sourcePath) !== source) return false;
    } catch {
      return false;
    }
    wanted.delete(destination);
  }
  return wanted.size === 0;
}

function inspectOwnedContainer(
  cli: object,
  environment: DockerEnvironment,
  capability: object,
  mounts: DockerMounts,
): unknown | null {
  const identity = containerIdentities.get(capability);
  if (!identity) return null;
  const execution = dockerCommand(cli, environment, [
    "container",
    "inspect",
    identity.id,
  ]);
  const inspect = readInspect(execution);
  return validateContainerInspect(inspect, { ...identity, mounts })
    ? inspect
    : null;
}

function observeContainerAbsence(
  cli: object,
  environment: DockerEnvironment,
  identity: ContainerIdentity,
  hostRecoveryId: string,
  rootName: string,
): Readonly<{ kind: "docker_absence" }> | null {
  const containerListArguments = [
    "container",
    "ls",
    "--all",
    "--quiet",
    "--no-trunc",
  ];
  const id = dockerCommand(cli, environment, [
    ...containerListArguments,
    "--filter",
    `id=${identity.id}`,
  ]);
  const name = dockerCommand(cli, environment, [
    ...containerListArguments,
    "--filter",
    `name=^/${containerName(identity.probeId)}$`,
  ]);
  const label = dockerCommand(cli, environment, [
    ...containerListArguments,
    "--filter",
    `label=${OWNERSHIP_LABEL}=${identity.probeId}`,
  ]);
  if (normalizeContainerAbsence(id, name, label).status !== "confirmed")
    return null;
  const capability = Object.freeze({ kind: "docker_absence" });
  absenceCapabilities.set(
    capability,
    Object.freeze({
      probeId: identity.probeId,
      containerId: identity.id,
      hostRecoveryId,
      rootName,
      cli,
    }),
  );
  return capability;
}

function cleanupOwnedContainer(
  cli: object,
  environment: DockerEnvironment,
  capability: object,
  mounts: DockerMounts,
  hostRecoveryId: string,
) {
  const identity = containerIdentities.get(capability);
  if (!identity)
    return { confirmed: false, reason: "docker_container_identity_unknown" };
  if (!inspectOwnedContainer(cli, environment, capability, mounts))
    return { confirmed: false, reason: "docker_container_identity_mismatch" };
  const removal = dockerCommand(cli, environment, [
    "container",
    "rm",
    "--force",
    identity.id,
  ]);
  const absenceCapability =
    removal.error || removal.status !== 0
      ? null
      : observeContainerAbsence(
          cli,
          environment,
          identity,
          hostRecoveryId,
          path.basename(path.dirname(mounts.management)),
        );
  if (!absenceCapability)
    return { confirmed: false, reason: "docker_probe_cleanup_failed" };
  containerIdentities.delete(capability);
  return {
    confirmed: true,
    reason: "docker_probe_absence_confirmed",
    absenceCapability,
  };
}

function verifyLocalLinuxEngine(
  cli: object,
  environment: DockerEnvironment,
): boolean {
  const execution = dockerCommand(cli, environment, [
    "version",
    "--format",
    "{{.Server.Os}}",
  ]);
  return (
    !execution.error &&
    execution.status === 0 &&
    execution.stdout.trim() === "linux"
  );
}

function blocked(
  reason: string,
  probeId: string | null = null,
  shouldRetainOperationDirectories = false,
  recoveryId: string | null = null,
  isManualRecoveryRequired = false,
): DockerProbeResult {
  return {
    status: "blocked",
    reason,
    probeId,
    retainOperationDirectories: shouldRetainOperationDirectories,
    hostCleanupCompleted: false,
    recoveryId,
    manualRecoveryRequired: isManualRecoveryRequired,
    cleanup: shouldRetainOperationDirectories
      ? "unconfirmed"
      : "not_required_or_confirmed",
  };
}

export function normalizeDockerProbeFailure(
  error: unknown,
  probeId: string,
  state: DockerProbeFailureState,
): DockerProbeResult {
  if (state.rollbackFailed === true) {
    return blocked(
      "docker_submission_rollback_failed",
      probeId,
      true,
      null,
      true,
    );
  }
  return blocked(
    normalizeFailure(error),
    probeId,
    state.submissionStarted,
    state.submissionStarted ? state.recoveryId : state.hostRecoveryId,
  );
}

function finishHostRecovery(
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
): DockerProbeResult {
  const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
  return normalizeHostCleanupResult(
    recovered,
    hostRecoveryId,
    baseResult,
    probeId,
  );
}

export function normalizeHostCleanupResult(
  recovered: Readonly<{ status: string; reason: string }>,
  hostRecoveryId: string,
  baseResult: Partial<DockerProbeResult> = {},
  probeId: string | null = null,
): DockerProbeResult {
  return recovered?.status === "recovered"
    ? {
        ...blocked(
          typeof baseResult.reason === "string"
            ? baseResult.reason
            : "host_cleanup_recovered",
          typeof baseResult.probeId === "string" ? baseResult.probeId : probeId,
        ),
        ...baseResult,
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      }
    : blocked(
        recovered?.reason ?? "host_recovery_failed",
        probeId,
        true,
        hostRecoveryId,
      );
}

function finishPreSubmissionCleanup(
  owned: unknown,
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
): DockerProbeResult {
  try {
    cleanupOwnedOperationDirectories(owned);
    return {
      ...baseResult,
      hostCleanupCompleted: true,
      retainOperationDirectories: false,
      recoveryId: null,
      cleanup: "confirmed",
    };
  } catch {
    return {
      ...blocked(
        "host_operation_cleanup_failed",
        probeId,
        true,
        hostRecoveryId,
      ),
    };
  }
}

export function runDockerIsolationProbe(owned: unknown): DockerProbeResult {
  const probeId = randomUUID();
  let cli: Readonly<{ kind: "trusted_docker_cli" }> | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let environment: DockerEnvironment | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let hasSubmissionStarted = false;
  let hasRollbackFailed = false;
  const recoveryNonce = randomUUID();
  let result: DockerProbeResult = blocked("docker_isolation_probe_failed");
  try {
    cli = createTrustedDockerCliCapability();
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    environment = dockerEnvironment(mounts.management);
    if (!verifyLocalLinuxEngine(cli, environment)) {
      result = blocked("local_docker_desktop_linux_engine_required", probeId);
    } else {
      mounts = verifyOwnedMountCapability(mountCapability);
      hostRecoveryId = beginDockerSubmission(hostRecoveryId);
      hasSubmissionStarted = true;
      try {
        recoveryId = writeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          null,
        );
      } catch (error) {
        try {
          hostRecoveryId = cancelDockerSubmissionBeforeCreate(hostRecoveryId);
          hasSubmissionStarted = false;
        } catch {
          hasRollbackFailed = true;
        }
        throw error;
      }
      const creation = dockerCommand(
        cli,
        environment,
        dockerCreateArgumentsForFixture(mounts, probeId).slice(2),
        30_000,
      );
      const normalizedCreation = normalizeContainerCreation(creation);
      if (normalizedCreation.status !== "confirmed") {
        result = blocked(
          "docker_container_identity_unknown",
          probeId,
          true,
          recoveryId,
        );
      } else {
        const identity = Object.freeze({ id: normalizedCreation.id, probeId });
        containerIdentity = identity;
        containerCapability = Object.freeze({ kind: "owned_docker_probe" });
        containerIdentities.set(containerCapability, identity);
        recoveryId = writeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          identity.id,
        );
        mounts = verifyOwnedMountCapability(mountCapability);
        if (
          !inspectOwnedContainer(cli, environment, containerCapability, mounts)
        ) {
          result = blocked(
            "docker_container_security_profile_mismatch",
            probeId,
            true,
            recoveryId,
          );
        } else {
          mounts = verifyOwnedMountCapability(mountCapability);
          const execution = dockerCommand(
            cli,
            environment,
            ["start", "--attach", identity.id],
            30_000,
          );
          const normalized = normalizeDockerIsolationResult(execution);
          result = {
            ...blocked(normalized.reason, probeId),
            status: normalized.status === "confirmed" ? "confirmed" : "blocked",
          };
          mounts = verifyOwnedMountCapability(mountCapability);
        }
      }
    }
  } catch (error) {
    result = normalizeDockerProbeFailure(error, probeId, {
      submissionStarted: hasSubmissionStarted,
      recoveryId,
      hostRecoveryId,
      rollbackFailed: hasRollbackFailed,
    });
  } finally {
    if (containerCapability && cli && environment && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          environment,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed)
          result = blocked(cleanup.reason, probeId, true, recoveryId);
        else {
          hostRecoveryId = confirmDockerAbsence(
            hostRecoveryId,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity?.id ?? "",
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
            },
          );
          result = finishHostRecovery(hostRecoveryId, result, probeId);
        }
      } catch {
        result = blocked(
          "docker_probe_cleanup_failed",
          probeId,
          true,
          recoveryId,
        );
      }
    } else if (!hasSubmissionStarted) {
      result = finishPreSubmissionCleanup(
        owned,
        hostRecoveryId,
        result,
        probeId,
      );
    }
  }
  return result;
}

function parseRecoveryToken(token: unknown): Readonly<{
  rootName: string;
  probeId: string;
  nonce: string;
  recordHash: string;
}> {
  if (typeof token !== "string")
    throw new Error("docker_recovery_token_invalid");
  const match =
    /^docker\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(
      token,
    );
  if (!match) throw new Error("docker_recovery_token_invalid");
  const rootName = match[1];
  const probeId = match[2];
  const nonce = match[3];
  const recordHash = match[4];
  if (!rootName || !probeId || !nonce || !recordHash)
    throw new Error("docker_recovery_token_invalid");
  return { rootName, probeId, nonce, recordHash };
}

function loadRecoveryRecord(token: unknown): LoadedDockerRecovery {
  const parsed = parseRecoveryToken(token);
  const parent = fs.realpathSync(os.tmpdir());
  const root = path.join(parent, parsed.rootName);
  if (
    path.dirname(root) !== parent ||
    fs.realpathSync(root) !== root ||
    fs.lstatSync(root).isSymbolicLink()
  )
    throw new Error("docker_recovery_boundary_failed");
  const management = path.join(root, "management");
  const marker = path.join(management, RECOVERY_FILE);
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    throw new Error("docker_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (
    createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash
  )
    throw new Error("docker_recovery_record_mismatch");
  const record = normalizeDockerRecoveryRecord(JSON.parse(serialized));
  if (
    record.schema !== "crdd-coordinator-docker-recovery/v1" ||
    record.rootName !== parsed.rootName ||
    record.probeId !== parsed.probeId ||
    record.nonceHash !== createHash("sha256").update(parsed.nonce).digest("hex")
  )
    throw new Error("docker_recovery_record_mismatch");
  if (!identityMatchesRecord(root, record.rootIdentity))
    throw new Error("docker_recovery_root_replaced");
  const { children, present: presentChildren } = classifyRecoveryChildren(
    root,
    record.childIdentities,
  );
  if (!presentChildren.includes("management"))
    throw new Error("docker_recovery_management_missing");
  return {
    parsed,
    record,
    root,
    children,
    marker,
    present: new Set(presentChildren),
  };
}

export function classifyRecoveryChildren(
  root: string,
  childIdentities: Readonly<Record<string, SerializableIdentity>>,
) {
  const children = {
    workspace: path.join(root, "workspace"),
    providerHome: path.join(root, "provider-home"),
    tmp: path.join(root, "tmp"),
    events: path.join(root, "events"),
    projection: path.join(root, "projection"),
    management: path.join(root, "management"),
  };
  const byRecordName = {
    workspace: children.workspace,
    "provider-home": children.providerHome,
    tmp: children.tmp,
    events: children.events,
    projection: children.projection,
    management: children.management,
  };
  const knownNames = new Set(Object.keys(byRecordName));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!knownNames.has(entry.name))
      throw new Error("docker_recovery_unknown_child");
  }
  const present = new Set<string>();
  for (const [name, target] of Object.entries(byRecordName)) {
    try {
      const metadata = fs.lstatSync(target);
      const recordedIdentity = childIdentities[name];
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync(target) !== target ||
        path.dirname(target) !== root ||
        !recordedIdentity ||
        !identityMatchesRecord(target, recordedIdentity)
      )
        throw new Error("docker_recovery_child_replaced");
      present.add(name);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      throw error;
    }
  }
  return { children, present: [...present].sort() };
}

function recoveryMounts(recovery: LoadedDockerRecovery): DockerMounts {
  for (const name of ["workspace", "provider-home", "tmp", "management"]) {
    if (!recovery.present.has(name))
      throw new Error("docker_recovery_mount_missing");
  }
  return recovery.children;
}

export function recoverDockerIsolationProbe(token: unknown) {
  let activeRecoveryId = token;
  try {
    const recovery = loadRecoveryRecord(token);
    const cli = createTrustedDockerCliCapability();
    const environment = dockerEnvironment(recovery.children.management);
    const containerId = recovery.record.container.id;
    if (!containerId) {
      return {
        status: "blocked",
        reason: "docker_recovery_container_identity_unknown",
        recoveryId: token,
      };
    }
    const identity: ContainerIdentity = {
      id: containerId,
      probeId: recovery.record.probeId,
    };
    let absenceCapability = null;
    if (identity.id) {
      absenceCapability = observeContainerAbsence(
        cli,
        environment,
        identity,
        recovery.record.hostRecoveryId,
        recovery.record.rootName,
      );
      if (!absenceCapability) {
        const mounts = recoveryMounts(recovery);
        const capability = Object.freeze({ kind: "recovered_docker_probe" });
        containerIdentities.set(capability, Object.freeze(identity));
        const inspect = inspectOwnedContainer(
          cli,
          environment,
          capability,
          mounts,
        );
        if (!inspect)
          return {
            status: "blocked",
            reason: "docker_recovery_container_mismatch",
            recoveryId: token,
          };
        const cleanup = cleanupOwnedContainer(
          cli,
          environment,
          capability,
          mounts,
          recovery.record.hostRecoveryId,
        );
        if (!cleanup.confirmed)
          return {
            status: "blocked",
            reason: cleanup.reason,
            recoveryId: token,
          };
        absenceCapability = cleanup.absenceCapability;
      }
    }
    const hostRecoveryId = confirmDockerAbsence(
      recovery.record.hostRecoveryId,
      absenceCapability,
      {
        probeId: identity.probeId,
        id: identity.id,
        rootName: recovery.record.rootName,
        cli,
      },
    );
    activeRecoveryId = hostRecoveryId;
    const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
    const normalized = normalizeHostCleanupResult(recovered, hostRecoveryId, {
      status: "recovered",
      reason: "docker_probe_recovery_completed",
    });
    return normalized.hostCleanupCompleted
      ? normalized
      : { ...normalized, status: "blocked" };
  } catch (error) {
    return {
      status: "blocked",
      reason: normalizeFailure(error, "docker_probe_recovery_failed"),
      recoveryId: activeRecoveryId,
      hostCleanupCompleted: false,
    };
  }
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  backend: "docker_desktop_linux",
  endpoint: "local_named_pipe",
  dockerCliPinnedByHash: true,
  imagePinnedByDigest: true,
  networkMode: "none",
  providerProcessesExecuted: false,
});
