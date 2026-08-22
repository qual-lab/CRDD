import { spawn, spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  adoptOwnedHostRecoveryRecordTransition,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  transitionOwnedDockerSubmissionState,
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
type DockerExecution = Partial<
  Pick<
    SpawnSyncReturns<string>,
    "error" | "signal" | "status" | "stderr" | "stdout"
  >
>;
type AsyncDockerExecution = DockerExecution &
  Readonly<{ outputExceeded: boolean }>;
type ContainerIdentity = Readonly<{
  id: string;
  probeId: string;
  source?: string;
}>;
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
type PendingDynamicFakeProviderLifecycle = Readonly<{
  observation: DynamicFakeProviderLifecycleObservation;
  probeId: string;
  containerId: string;
  mountCapability: object;
  hostRecoveryId: string;
}>;
type DynamicFakeProviderFinalization = Readonly<{
  pendingCapability: object;
  probeId: string;
  containerId: string;
  mountCapability: object;
  absenceCapability: object;
  hostCleanupCapability: object;
}>;
type DynamicFakeProviderAbsence = Readonly<{
  probeId: string;
  containerId: string;
  initialHostRecoveryId: string;
  confirmedHostRecoveryId: string;
}>;
type DynamicFakeProviderHostCleanup = Readonly<{
  probeId: string;
  confirmedHostRecoveryId: string;
  absenceCapability: object;
}>;
const pendingDynamicLifecycleObservations = new WeakMap<
  object,
  PendingDynamicFakeProviderLifecycle
>();
const dynamicLifecycleFinalizations = new WeakMap<
  object,
  DynamicFakeProviderFinalization
>();
const dynamicLifecycleAbsences = new WeakMap<
  object,
  DynamicFakeProviderAbsence
>();
const dynamicLifecycleHostCleanups = new WeakMap<
  object,
  DynamicFakeProviderHostCleanup
>();
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
  fakeProviderLifecycle: DynamicFakeProviderLifecycleObservation;
}>;

type DynamicFakeProviderLifecycleObservation = Readonly<{
  status: "verified" | "candidate" | "blocked" | "not_evaluated";
  reason: string;
  provenance:
    | "repository_owned_docker_fake_provider"
    | "untrusted_execution_fixture";
  fakeProviderStartAttempted: boolean;
  fakeProviderExecuted: boolean;
  resultNormalizationVerified: boolean;
  containerAbsenceVerified: boolean;
  processTreeAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  elapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancellationRequested: false;
  cancellationObservation: "not_implemented";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

export type DynamicFakeProviderCancellationResult = Readonly<{
  status: "verified" | "candidate" | "blocked";
  reason: string;
  cancellationRequested: boolean;
  cancellationSignalRequested: "SIGTERM" | null;
  readyObserved: boolean;
  cancellationAcknowledged: boolean;
  processTerminationObserved: boolean;
  attachProcessTerminationObserved: boolean;
  attachProcessTerminationRequestCount: number;
  containerAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  graceElapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  retainOperationDirectories: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

export const OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS = Object.freeze([
  "never_ready",
  "ready_then_never_complete",
  "output_overflow",
] as const);
export type OwnedAttachTerminationFixtureScenario =
  (typeof OWNED_ATTACH_TERMINATION_FIXTURE_SCENARIOS)[number];

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

export const DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS = Object.freeze([
  "timeout",
  "output_limit",
  "invalid_output",
  "nonzero_exit",
] as const);
export type DynamicFakeProviderFailureScenario =
  (typeof DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS)[number];

const FAILURE_SCENARIO_SPECS = Object.freeze({
  timeout: Object.freeze({
    source: "import time; time.sleep(2)",
    timeoutMs: 250,
    expectedReason: "docker_isolation_probe_timeout",
  }),
  output_limit: Object.freeze({
    source: "print('x'*70000)",
    timeoutMs: 10_000,
    expectedReason: "docker_isolation_probe_output_too_large",
  }),
  invalid_output: Object.freeze({
    source: "print('not-json')",
    timeoutMs: 10_000,
    expectedReason: "docker_isolation_probe_invalid_output",
  }),
  nonzero_exit: Object.freeze({
    source: "import sys; sys.exit(7)",
    timeoutMs: 10_000,
    expectedReason: "docker_isolation_probe_failed",
  }),
} satisfies Readonly<
  Record<
    DynamicFakeProviderFailureScenario,
    Readonly<{ source: string; timeoutMs: number; expectedReason: string }>
  >
>);

const CANCELLATION_READY_OUTPUT =
  '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}';
const CANCELLATION_ACKNOWLEDGED_OUTPUT =
  '{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}';
const CANCELLATION_SOURCE = `
import json, signal, sys, time
marker="crdd-coordinator-cancellation-v1"
def cancelled(_signal,_frame):
    print(json.dumps({"marker":marker,"state":"cancelled"},separators=(",",":")),flush=True)
    sys.exit(42)
signal.signal(signal.SIGTERM,cancelled)
print(json.dumps({"marker":marker,"state":"ready"},separators=(",",":")),flush=True)
while True: time.sleep(0.05)
`;

const repositoryOwnedProbeSources = Object.freeze(
  new Set([
    PROBE_SOURCE,
    ...Object.values(FAILURE_SCENARIO_SPECS).map(
      (specification) => specification.source,
    ),
    CANCELLATION_SOURCE,
  ]),
);

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

function dockerCreateArguments(
  mounts: DockerMounts,
  probeId: string,
  source: string,
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
    source,
  ];
}

export function dockerCreateArgumentsForFixture(
  mounts: DockerMounts,
  probeId = "fixture",
): string[] {
  return dockerCreateArguments(mounts, probeId, PROBE_SOURCE);
}

export function dockerCreateArgumentsForFailureVerificationFixture(
  mounts: DockerMounts,
  scenario: DynamicFakeProviderFailureScenario,
  probeId = "fixture",
): string[] {
  return dockerCreateArguments(
    mounts,
    probeId,
    FAILURE_SCENARIO_SPECS[scenario].source,
  );
}

export function dockerCreateArgumentsForCancellationVerificationFixture(
  mounts: DockerMounts,
  probeId = "fixture",
): string[] {
  return dockerCreateArguments(mounts, probeId, CANCELLATION_SOURCE);
}

export function normalizeDockerIsolationResult(
  execution: DockerExecution,
): Readonly<{ status: "confirmed" | "blocked"; reason: string }> {
  if (errorCodeEquals(execution.error, "ETIMEDOUT"))
    return { status: "blocked", reason: "docker_isolation_probe_timeout" };
  if (errorCodeEquals(execution.error, "ENOBUFS"))
    return {
      status: "blocked",
      reason: "docker_isolation_probe_output_too_large",
    };
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

function errorCodeEquals(error: unknown, expected: string): boolean {
  return errorCode(error) === expected;
}

function dynamicFakeLifecycleBlocked(
  reason: string,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    status: "blocked",
    reason,
    provenance: "repository_owned_docker_fake_provider",
    fakeProviderStartAttempted: false,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    containerAbsenceVerified: false,
    processTreeAbsenceVerified: false,
    hostCleanupVerified: false,
    elapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    cancellationRequested: false,
    cancellationObservation: "not_implemented",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

export function normalizeDynamicFakeProviderLifecycleForFixture(
  execution: DockerExecution,
  elapsedMs: number,
): DynamicFakeProviderLifecycleObservation {
  const stdoutBytes =
    typeof execution.stdout === "string"
      ? Buffer.byteLength(execution.stdout, "utf8")
      : 0;
  const stderrBytes =
    typeof execution.stderr === "string"
      ? Buffer.byteLength(execution.stderr, "utf8")
      : 0;
  const hasTimedOut = errorCodeEquals(execution.error, "ETIMEDOUT");
  const hasOutputExceeded = errorCodeEquals(execution.error, "ENOBUFS");
  const hasValidElapsed =
    Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 30_000;
  const hasExactExecutionEnvelope =
    !execution.error &&
    execution.status === 0 &&
    (execution.signal === null || execution.signal === undefined) &&
    typeof execution.stdout === "string" &&
    typeof execution.stderr === "string" &&
    stdoutBytes <= MAX_OUTPUT_BYTES &&
    stderrBytes <= MAX_OUTPUT_BYTES;
  const normalized = normalizeDockerIsolationResult(execution);
  const reason = hasTimedOut
    ? "dynamic_fake_provider_deadline_exceeded"
    : hasOutputExceeded
      ? "dynamic_fake_provider_output_limit_exceeded"
      : !hasValidElapsed
        ? "dynamic_fake_provider_elapsed_invalid"
        : !hasExactExecutionEnvelope
          ? "dynamic_fake_provider_execution_envelope_invalid"
          : normalized.status === "confirmed"
            ? "dynamic_fake_provider_result_observed"
            : normalized.reason;
  return Object.freeze({
    ...dynamicFakeLifecycleBlocked(reason),
    status:
      hasValidElapsed &&
      hasExactExecutionEnvelope &&
      normalized.status === "confirmed"
        ? "candidate"
        : "blocked",
    provenance: "untrusted_execution_fixture",
    fakeProviderStartAttempted: true,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    elapsedMs: hasValidElapsed ? elapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
    timedOut: hasTimedOut,
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
  });
}

function cancellationBlocked(
  reason: string,
): DynamicFakeProviderCancellationResult {
  return Object.freeze({
    status: "blocked",
    reason,
    cancellationRequested: false,
    cancellationSignalRequested: null,
    readyObserved: false,
    cancellationAcknowledged: false,
    processTerminationObserved: false,
    attachProcessTerminationObserved: false,
    attachProcessTerminationRequestCount: 0,
    containerAbsenceVerified: false,
    hostCleanupVerified: false,
    graceElapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    retainOperationDirectories: false,
    recoveryId: null,
    manualRecoveryRequired: false,
    cleanup: "not_required_or_confirmed",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

function normalizeCancellationFailure(error: unknown): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_container_identity_unknown",
    "docker_container_security_profile_mismatch",
    "dynamic_fake_provider_cancellation_ready_unconfirmed",
    "dynamic_fake_provider_cancellation_not_requested",
    "dynamic_fake_provider_cancellation_grace_exceeded",
    "dynamic_fake_provider_cancellation_acknowledgement_invalid",
    "dynamic_fake_provider_cancellation_termination_invalid",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = errorMessage(error);
  return message && known.has(message)
    ? message
    : "dynamic_fake_provider_cancellation_verification_failed";
}

export function normalizeDynamicFakeProviderCancellationForFixture(
  execution: DockerExecution,
  graceElapsedMs: number,
  isCancellationRequested: boolean,
): DynamicFakeProviderCancellationResult {
  const stdout = typeof execution.stdout === "string" ? execution.stdout : "";
  const stderr = typeof execution.stderr === "string" ? execution.stderr : "";
  const stdoutBytes = Buffer.byteLength(stdout, "utf8");
  const stderrBytes = Buffer.byteLength(stderr, "utf8");
  const hasValidGrace =
    Number.isSafeInteger(graceElapsedMs) &&
    graceElapsedMs >= 0 &&
    graceElapsedMs <= 5_000;
  const hasExactOutput =
    stdout ===
      `${CANCELLATION_READY_OUTPUT}\n${CANCELLATION_ACKNOWLEDGED_OUTPUT}\n` &&
    stderr === "" &&
    stdoutBytes <= MAX_OUTPUT_BYTES &&
    stderrBytes <= MAX_OUTPUT_BYTES;
  const hasExactTermination =
    !execution.error &&
    execution.status === 42 &&
    (execution.signal === null || execution.signal === undefined);
  const isCandidate =
    isCancellationRequested &&
    hasValidGrace &&
    hasExactOutput &&
    hasExactTermination;
  return Object.freeze({
    ...cancellationBlocked(
      isCandidate
        ? "dynamic_fake_provider_cancellation_candidate"
        : !isCancellationRequested
          ? "dynamic_fake_provider_cancellation_not_requested"
          : !hasValidGrace
            ? "dynamic_fake_provider_cancellation_grace_exceeded"
            : !hasExactOutput
              ? "dynamic_fake_provider_cancellation_acknowledgement_invalid"
              : "dynamic_fake_provider_cancellation_termination_invalid",
    ),
    status: isCandidate ? "candidate" : "blocked",
    cancellationRequested: isCancellationRequested,
    cancellationSignalRequested: isCancellationRequested ? "SIGTERM" : null,
    readyObserved: stdout.startsWith(`${CANCELLATION_READY_OUTPUT}\n`),
    cancellationAcknowledged: isCandidate,
    processTerminationObserved: isCandidate,
    graceElapsedMs: hasValidGrace ? graceElapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
  });
}

function createDynamicFakeProviderLifecycleCapability(
  execution: DockerExecution,
  elapsedMs: number,
  context: Readonly<{
    probeId: string;
    containerId: string;
    mountCapability: object;
    hostRecoveryId: string;
  }>,
): Readonly<{ kind: "dynamic_fake_provider_lifecycle" }> {
  const normalized = normalizeDynamicFakeProviderLifecycleForFixture(
    execution,
    elapsedMs,
  );
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_lifecycle" as const,
  });
  pendingDynamicLifecycleObservations.set(
    capability,
    Object.freeze({
      observation: Object.freeze({
        ...normalized,
        provenance: "repository_owned_docker_fake_provider",
        fakeProviderExecuted: false,
        resultNormalizationVerified: false,
        diagnosticDockerContainerEffectIssued: true,
        diagnosticFilesystemEffectIssued: true,
      }),
      ...context,
    }),
  );
  return capability;
}

type DynamicFakeProviderFinalizationEligibility = Readonly<{
  hasRepositoryOwnedProvenance: boolean;
  hasExactResult: boolean;
  hasValidElapsed: boolean;
  hasPostRunMountIdentity: boolean;
  hasContainerAbsence: boolean;
  hasHostCleanup: boolean;
  hasMatchingRunIdentity: boolean;
}>;

function evaluateDynamicFakeProviderFinalization(
  input: DynamicFakeProviderFinalizationEligibility,
) {
  const isEligible =
    input.hasRepositoryOwnedProvenance &&
    input.hasExactResult &&
    input.hasValidElapsed &&
    input.hasPostRunMountIdentity &&
    input.hasContainerAbsence &&
    input.hasHostCleanup &&
    input.hasMatchingRunIdentity;
  return Object.freeze({
    status: isEligible ? ("candidate" as const) : ("blocked" as const),
    reason: isEligible
      ? "dynamic_fake_provider_finalization_candidate"
      : "dynamic_fake_provider_finalization_incomplete",
    observationAuthority: false,
  });
}

export function evaluateDynamicFakeProviderFinalizationForFixture(
  input: DynamicFakeProviderFinalizationEligibility,
) {
  return evaluateDynamicFakeProviderFinalization(input);
}

function createDynamicFakeProviderFinalizationCapability(
  pendingCapability: object,
  context: Omit<DynamicFakeProviderFinalization, "pendingCapability">,
): Readonly<{ kind: "dynamic_fake_provider_finalization" }> {
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_finalization" as const,
  });
  dynamicLifecycleFinalizations.set(
    capability,
    Object.freeze({ pendingCapability, ...context }),
  );
  return capability;
}

function invalidateDynamicFakeProviderLifecycle(capability: object | null) {
  if (capability) pendingDynamicLifecycleObservations.delete(capability);
}

function finalizeDynamicFakeProviderLifecycle(
  pendingCapability: object,
  finalizationCapability: object,
): DynamicFakeProviderLifecycleObservation {
  const pending = pendingDynamicLifecycleObservations.get(pendingCapability);
  const finalization = dynamicLifecycleFinalizations.get(
    finalizationCapability,
  );
  pendingDynamicLifecycleObservations.delete(pendingCapability);
  dynamicLifecycleFinalizations.delete(finalizationCapability);
  const absence = finalization
    ? dynamicLifecycleAbsences.get(finalization.absenceCapability)
    : null;
  const hostCleanup = finalization
    ? dynamicLifecycleHostCleanups.get(finalization.hostCleanupCapability)
    : null;
  if (finalization) {
    dynamicLifecycleAbsences.delete(finalization.absenceCapability);
    dynamicLifecycleHostCleanups.delete(finalization.hostCleanupCapability);
  }
  if (!pending || !finalization || !absence || !hostCleanup)
    return dynamicFakeLifecycleBlocked(
      "dynamic_fake_provider_provenance_unverified",
    );
  const eligibility = evaluateDynamicFakeProviderFinalization({
    hasRepositoryOwnedProvenance:
      pending.observation.provenance ===
      "repository_owned_docker_fake_provider",
    hasExactResult: pending.observation.status === "candidate",
    hasValidElapsed:
      typeof pending.observation.elapsedMs === "number" &&
      Number.isSafeInteger(pending.observation.elapsedMs) &&
      pending.observation.elapsedMs >= 0 &&
      pending.observation.elapsedMs <= 30_000,
    hasPostRunMountIdentity:
      pending.mountCapability === finalization.mountCapability,
    hasContainerAbsence:
      absence.probeId === pending.probeId &&
      absence.containerId === pending.containerId &&
      absence.initialHostRecoveryId === pending.hostRecoveryId &&
      absence.confirmedHostRecoveryId !== absence.initialHostRecoveryId,
    hasHostCleanup:
      hostCleanup.probeId === pending.probeId &&
      hostCleanup.confirmedHostRecoveryId === absence.confirmedHostRecoveryId &&
      hostCleanup.absenceCapability === finalization.absenceCapability,
    hasMatchingRunIdentity:
      finalization.pendingCapability === pendingCapability &&
      pending.probeId === finalization.probeId &&
      pending.containerId === finalization.containerId,
  });
  if (eligibility.status !== "candidate")
    return Object.freeze({
      ...pending.observation,
      status: "blocked",
      reason: eligibility.reason,
    });
  return Object.freeze({
    ...pending.observation,
    status: "verified",
    fakeProviderExecuted: true,
    resultNormalizationVerified: true,
    containerAbsenceVerified: true,
    processTreeAbsenceVerified: true,
    hostCleanupVerified: true,
  });
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
  mountCapability: unknown,
): string {
  if (
    expectedState === "host_only" &&
    nextState === "docker_submission_started"
  )
    return transitionOwnedDockerSubmissionState(
      mountCapability,
      hostRecoveryId,
      "begin",
    );
  if (
    expectedState === "docker_submission_started" &&
    nextState === "host_only"
  )
    return transitionOwnedDockerSubmissionState(
      mountCapability,
      hostRecoveryId,
      "cancel",
    );
  if (
    expectedState !== "docker_submission_started" ||
    nextState !== "docker_absent_confirmed"
  )
    throw new Error("host_recovery_state_invalid");
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
  const updatedToken = formatHostRecoveryToken(
    loaded.parsed.rootName,
    loaded.parsed.nonce,
    recordHash,
  );
  if (mountCapability !== null)
    adoptOwnedHostRecoveryRecordTransition(
      mountCapability,
      hostRecoveryId,
      updatedToken,
    );
  return updatedToken;
}

function beginDockerSubmission(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "host_only",
    "docker_submission_started",
    mountCapability,
  );
}

function cancelDockerSubmissionBeforeCreate(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "host_only",
    mountCapability,
  );
}

function confirmDockerAbsence(
  hostRecoveryId: string,
  mountCapability: unknown,
  capability: unknown,
  expected: Readonly<{
    probeId: string;
    id: string;
    rootName: string;
    cli: object;
  }>,
): Readonly<{
  hostRecoveryId: string;
  lifecycleAbsenceCapability: object;
}> {
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
    mountCapability,
  );
  if (isObject(capability)) absenceCapabilities.delete(capability);
  const lifecycleAbsenceCapability = Object.freeze({
    kind: "dynamic_fake_provider_absence",
  });
  dynamicLifecycleAbsences.set(
    lifecycleAbsenceCapability,
    Object.freeze({
      probeId: expected.probeId,
      containerId: expected.id,
      initialHostRecoveryId: hostRecoveryId,
      confirmedHostRecoveryId: updated,
    }),
  );
  return Object.freeze({
    hostRecoveryId: updated,
    lifecycleAbsenceCapability,
  });
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

type OwnedAttachedProcess = Readonly<{
  started: Promise<boolean>;
  ready: Promise<boolean>;
  completion: Promise<AsyncDockerExecution>;
  terminateAndWait: () => Promise<AsyncDockerExecution | null>;
  isClosed: () => boolean;
  getTerminationRequestCount: () => number;
}>;

function startOwnedAttachedProcess(
  executable: string,
  args: readonly string[],
  environment: DockerEnvironment,
  readyPrefix: string,
): Readonly<{
  started: Promise<boolean>;
  ready: Promise<boolean>;
  completion: Promise<AsyncDockerExecution>;
  terminateAndWait: () => Promise<AsyncDockerExecution | null>;
  isClosed: () => boolean;
  getTerminationRequestCount: () => number;
}> {
  const child = spawn(executable, args, {
    windowsHide: true,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let hasOutputExceeded = false;
  let hasStartedSettled = false;
  let hasReadySettled = false;
  let hasClosed = false;
  let hasTerminationRequested = false;
  let terminationRequestCount = 0;
  let settleStarted: (isStarted: boolean) => void = () => undefined;
  let settleReady: (isReady: boolean) => void = () => undefined;
  const started = new Promise<boolean>((resolve) => {
    settleStarted = resolve;
  });
  const ready = new Promise<boolean>((resolve) => {
    settleReady = resolve;
  });
  const finishStarted = (isStarted: boolean) => {
    if (hasStartedSettled) return;
    hasStartedSettled = true;
    settleStarted(isStarted);
  };
  const finishReady = (isReady: boolean) => {
    if (hasReadySettled) return;
    hasReadySettled = true;
    settleReady(isReady);
  };
  const append = (
    chunks: Buffer[],
    chunk: Buffer | string,
    isStdout: boolean,
  ) => {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const nextBytes = (isStdout ? stdoutBytes : stderrBytes) + value.length;
    if (isStdout) stdoutBytes = nextBytes;
    else stderrBytes = nextBytes;
    if (nextBytes > MAX_OUTPUT_BYTES) {
      hasOutputExceeded = true;
      void terminateAndWait();
      return;
    }
    chunks.push(value);
    if (
      isStdout &&
      Buffer.concat(chunks).toString("utf8").startsWith(readyPrefix)
    )
      finishReady(true);
  };
  child.stdout.on("data", (chunk: Buffer | string) =>
    append(stdoutChunks, chunk, true),
  );
  child.stderr.on("data", (chunk: Buffer | string) =>
    append(stderrChunks, chunk, false),
  );
  const completion = new Promise<AsyncDockerExecution>((resolve) => {
    let hasSettled = false;
    const finish = (execution: AsyncDockerExecution) => {
      if (hasSettled) return;
      hasSettled = true;
      finishReady(false);
      resolve(execution);
    };
    child.once("error", (error) => {
      finishStarted(false);
      finish({
        error,
        status: null,
        signal: null,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        outputExceeded: hasOutputExceeded,
      });
    });
    child.once("spawn", () => finishStarted(true));
    child.once("close", (status, signal) => {
      hasClosed = true;
      finishStarted(false);
      finish({
        status,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        outputExceeded: hasOutputExceeded,
      });
    });
  });
  async function terminateAndWait(): Promise<AsyncDockerExecution | null> {
    if (!hasClosed && !hasTerminationRequested) {
      hasTerminationRequested = true;
      terminationRequestCount += 1;
      child.kill();
    }
    const execution = await boundedPromise(completion, 5_000, null);
    return hasClosed ? execution : null;
  }
  return Object.freeze({
    started,
    ready,
    completion,
    terminateAndWait,
    isClosed: () => hasClosed,
    getTerminationRequestCount: () => terminationRequestCount,
  });
}

function startAttachedDockerCommand(
  cliCapability: object,
  environment: DockerEnvironment,
  args: readonly string[],
): OwnedAttachedProcess {
  const executable = verifyTrustedDockerCliCapability(cliCapability);
  return startOwnedAttachedProcess(
    executable,
    ["-H", DOCKER_DESKTOP_ENGINE, ...args],
    environment,
    `${CANCELLATION_READY_OUTPUT}\n`,
  );
}

async function boundedPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const OWNED_ATTACH_FIXTURE_READY = "crdd-owned-attach-ready\n";
const OWNED_ATTACH_FIXTURE_SOURCES = Object.freeze({
  never_ready: "setInterval(() => undefined, 1000);",
  ready_then_never_complete:
    'process.stdout.write("crdd-owned-attach-ready\\n"); setInterval(() => undefined, 1000);',
  output_overflow: `process.stdout.write("x".repeat(${MAX_OUTPUT_BYTES + 1})); setInterval(() => undefined, 1000);`,
} satisfies Readonly<Record<OwnedAttachTerminationFixtureScenario, string>>);

export async function verifyOwnedAttachTerminationForFixture(
  scenario: OwnedAttachTerminationFixtureScenario,
): Promise<
  Readonly<{
    status: "verified" | "blocked";
    reason: string;
    scenario: OwnedAttachTerminationFixtureScenario;
    readyObserved: boolean;
    outputExceeded: boolean;
    terminationRequestCount: number;
    attachProcessTerminationObserved: boolean;
  }>
> {
  const environment: DockerEnvironment = {};
  for (const name of ["SYSTEMROOT", "WINDIR", "SYSTEMDRIVE"]) {
    if (typeof process.env[name] === "string")
      environment[name] = process.env[name];
  }
  const controller = startOwnedAttachedProcess(
    process.execPath,
    ["-e", OWNED_ATTACH_FIXTURE_SOURCES[scenario]],
    environment,
    OWNED_ATTACH_FIXTURE_READY,
  );
  const isStarted = await boundedPromise(controller.started, 5_000, false);
  const isReady =
    scenario === "ready_then_never_complete" && isStarted
      ? await boundedPromise(controller.ready, 5_000, false)
      : false;
  if (scenario === "output_overflow" && isStarted) {
    await boundedPromise(controller.completion, 5_000, null);
  }
  if (scenario !== "output_overflow" || !controller.isClosed()) {
    await controller.terminateAndWait();
  }
  const execution = await controller.terminateAndWait();
  const hasClosed = controller.isClosed() && execution !== null;
  const hasExpectedReady =
    isReady === (scenario === "ready_then_never_complete");
  const hasExpectedOverflow =
    execution?.outputExceeded === (scenario === "output_overflow");
  const hasExactTerminationRequest =
    controller.getTerminationRequestCount() === 1;
  const isVerified =
    isStarted &&
    hasClosed &&
    hasExpectedReady &&
    hasExpectedOverflow &&
    hasExactTerminationRequest;
  return Object.freeze({
    status: isVerified ? "verified" : "blocked",
    reason: isVerified
      ? "owned_attach_process_termination_verified"
      : "owned_attach_process_termination_unconfirmed",
    scenario,
    readyObserved: isReady,
    outputExceeded: execution?.outputExceeded === true,
    terminationRequestCount: controller.getTerminationRequestCount(),
    attachProcessTerminationObserved: hasClosed,
  });
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
    typeof command[1] !== "string" ||
    (expected.source
      ? command[1] !== expected.source
      : !repositoryOwnedProbeSources.has(command[1]))
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

function inspectedContainerIsRunning(inspect: unknown): boolean {
  if (!isObject(inspect)) return false;
  const state = ownValue(inspect, "State");
  return isObject(state) && ownValue(state, "Running") === true;
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
    fakeProviderLifecycle: dynamicFakeLifecycleBlocked(reason),
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
  lifecycleAbsenceCapability: object,
): Readonly<{
  result: DockerProbeResult;
  lifecycleHostCleanupCapability: object | null;
}> {
  const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
  const result = normalizeHostCleanupResult(
    recovered,
    hostRecoveryId,
    baseResult,
    probeId,
  );
  if (!result.hostCleanupCompleted)
    return Object.freeze({ result, lifecycleHostCleanupCapability: null });
  const lifecycleHostCleanupCapability = Object.freeze({
    kind: "dynamic_fake_provider_host_cleanup",
  });
  dynamicLifecycleHostCleanups.set(
    lifecycleHostCleanupCapability,
    Object.freeze({
      probeId,
      confirmedHostRecoveryId: hostRecoveryId,
      absenceCapability: lifecycleAbsenceCapability,
    }),
  );
  return Object.freeze({ result, lifecycleHostCleanupCapability });
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

function runDockerIsolationScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario | null,
): DockerProbeResult {
  const specification = scenario ? FAILURE_SCENARIO_SPECS[scenario] : null;
  const source = specification?.source ?? PROBE_SOURCE;
  const executionTimeoutMs = specification?.timeoutMs ?? 30_000;
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
  let hasContainerCreateAttempted = false;
  let hasRollbackFailed = false;
  const recoveryNonce = randomUUID();
  let result: DockerProbeResult = blocked("docker_isolation_probe_failed");
  let dynamicLifecycleCapability: Readonly<{
    kind: "dynamic_fake_provider_lifecycle";
  }> | null = null;
  try {
    cli = createTrustedDockerCliCapability();
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    environment = dockerEnvironment(mounts.management);
    if (!verifyLocalLinuxEngine(cli, environment)) {
      result = blocked("local_docker_desktop_linux_engine_required", probeId);
    } else {
      mounts = verifyOwnedMountCapability(mountCapability);
      hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
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
          hostRecoveryId = cancelDockerSubmissionBeforeCreate(
            hostRecoveryId,
            mountCapability,
          );
          hasSubmissionStarted = false;
        } catch {
          hasRollbackFailed = true;
        }
        throw error;
      }
      hasContainerCreateAttempted = true;
      const creation = dockerCommand(
        cli,
        environment,
        dockerCreateArguments(mounts, probeId, source).slice(2),
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
        const identity = Object.freeze({
          id: normalizedCreation.id,
          probeId,
          source,
        });
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
          const lifecycleStartedAt = performance.now();
          const execution = dockerCommand(
            cli,
            environment,
            ["start", "--attach", identity.id],
            executionTimeoutMs,
          );
          const lifecycleElapsedMs = Math.max(
            0,
            Math.round(performance.now() - lifecycleStartedAt),
          );
          const normalized = normalizeDockerIsolationResult(execution);
          result = {
            ...blocked(normalized.reason, probeId),
            status: normalized.status === "confirmed" ? "confirmed" : "blocked",
            fakeProviderLifecycle: dynamicFakeLifecycleBlocked(
              "dynamic_fake_provider_absence_unconfirmed",
            ),
          };
          mounts = verifyOwnedMountCapability(mountCapability);
          dynamicLifecycleCapability =
            createDynamicFakeProviderLifecycleCapability(
              execution,
              lifecycleElapsedMs,
              {
                probeId,
                containerId: identity.id,
                mountCapability,
                hostRecoveryId,
              },
            );
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
        if (!cleanup.confirmed) {
          invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
          result = blocked(cleanup.reason, probeId, true, recoveryId);
        } else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity?.id ?? "",
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const hostCleanup = finishHostRecovery(
            hostRecoveryId,
            result,
            probeId,
            absence.lifecycleAbsenceCapability,
          );
          result = hostCleanup.result;
          if (
            dynamicLifecycleCapability &&
            mountCapability &&
            containerIdentity &&
            result.status === "confirmed" &&
            result.hostCleanupCompleted &&
            hostCleanup.lifecycleHostCleanupCapability
          ) {
            const finalizationCapability =
              createDynamicFakeProviderFinalizationCapability(
                dynamicLifecycleCapability,
                {
                  probeId,
                  containerId: containerIdentity.id,
                  mountCapability,
                  absenceCapability: absence.lifecycleAbsenceCapability,
                  hostCleanupCapability:
                    hostCleanup.lifecycleHostCleanupCapability,
                },
              );
            const lifecycle = finalizeDynamicFakeProviderLifecycle(
              dynamicLifecycleCapability,
              finalizationCapability,
            );
            result = {
              ...result,
              status:
                lifecycle.status === "verified" ? result.status : "blocked",
              reason:
                lifecycle.status === "verified"
                  ? result.reason
                  : lifecycle.reason,
              fakeProviderLifecycle: lifecycle,
            };
          } else {
            invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
            const failureReason =
              result.status === "blocked"
                ? result.reason
                : "dynamic_fake_provider_finalization_incomplete";
            result = {
              ...result,
              status: "blocked",
              reason: failureReason,
              fakeProviderLifecycle: dynamicFakeLifecycleBlocked(failureReason),
            };
          }
        }
      } catch {
        invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
        result = blocked(
          "docker_probe_cleanup_failed",
          probeId,
          true,
          recoveryId,
        );
      }
    } else if (!hasSubmissionStarted) {
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
      result = finishPreSubmissionCleanup(
        owned,
        hostRecoveryId,
        result,
        probeId,
      );
    }
    if (hasSubmissionStarted && !containerCapability)
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
  }
  return {
    ...result,
    fakeProviderLifecycle: Object.freeze({
      ...result.fakeProviderLifecycle,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
    }),
  };
}

export function runDockerIsolationProbe(owned: unknown): DockerProbeResult {
  return runDockerIsolationScenario(owned, null);
}

export function runDynamicFakeProviderFailureScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario,
): DockerProbeResult {
  return runDockerIsolationScenario(owned, scenario);
}

export async function runDynamicFakeProviderCancellationVerification(
  owned: unknown,
): Promise<DynamicFakeProviderCancellationResult> {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let cli: Readonly<{ kind: "trusted_docker_cli" }> | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let environment: DockerEnvironment | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let recoveryId: string | null = null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasPostRunMountVerified = false;
  let hasAttachProcessTerminationObserved = false;
  let attachProcessTerminationRequestCount = 0;
  let attachedController: OwnedAttachedProcess | null = null;
  let base = cancellationBlocked(
    "dynamic_fake_provider_cancellation_verification_failed",
  );
  try {
    cli = createTrustedDockerCliCapability();
    mountCapability = createOwnedMountCapability(owned);
    mounts = verifyOwnedMountCapability(mountCapability);
    environment = dockerEnvironment(mounts.management);
    if (!verifyLocalLinuxEngine(cli, environment))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
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
        hostRecoveryId = cancelDockerSubmissionBeforeCreate(
          hostRecoveryId,
          mountCapability,
        );
        hasSubmissionStarted = false;
      } catch {
        hasSubmissionStarted = true;
      }
      throw error;
    }
    hasContainerCreateAttempted = true;
    const creation = dockerCommand(
      cli,
      environment,
      dockerCreateArguments(mounts, probeId, CANCELLATION_SOURCE).slice(2),
      30_000,
    );
    const normalizedCreation = normalizeContainerCreation(creation);
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    containerIdentity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      source: CANCELLATION_SOURCE,
    });
    containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, containerIdentity);
    recoveryId = writeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      containerIdentity.id,
    );
    mounts = verifyOwnedMountCapability(mountCapability);
    if (!inspectOwnedContainer(cli, environment, containerCapability, mounts))
      throw new Error("docker_container_security_profile_mismatch");

    attachedController = startAttachedDockerCommand(cli, environment, [
      "start",
      "--attach",
      containerIdentity.id,
    ]);
    const isReady = await boundedPromise(
      attachedController.ready,
      5_000,
      false,
    );
    if (!isReady) {
      await attachedController.terminateAndWait();
      throw new Error("dynamic_fake_provider_cancellation_ready_unconfirmed");
    }
    mounts = verifyOwnedMountCapability(mountCapability);
    const runningInspect = inspectOwnedContainer(
      cli,
      environment,
      containerCapability,
      mounts,
    );
    if (!inspectedContainerIsRunning(runningInspect))
      throw new Error("dynamic_fake_provider_cancellation_ready_unconfirmed");

    const cancellationStartedAt = performance.now();
    const cancellation = dockerCommand(
      cli,
      environment,
      ["container", "kill", "--signal", "SIGTERM", containerIdentity.id],
      5_000,
    );
    const execution = await boundedPromise<AsyncDockerExecution>(
      attachedController.completion,
      5_000,
      {
        error: Object.assign(new Error("cancellation timeout"), {
          code: "ETIMEDOUT",
        }),
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        outputExceeded: false,
      },
    );
    if (
      errorCodeEquals(execution.error, "ETIMEDOUT") ||
      execution.outputExceeded
    )
      await attachedController.terminateAndWait();
    const graceElapsedMs = Math.max(
      0,
      Math.round(performance.now() - cancellationStartedAt),
    );
    base = normalizeDynamicFakeProviderCancellationForFixture(
      execution,
      graceElapsedMs,
      true,
    );
    if (
      cancellation.error ||
      cancellation.status !== 0 ||
      execution.outputExceeded ||
      base.status !== "candidate"
    )
      throw new Error(base.reason);
    mounts = verifyOwnedMountCapability(mountCapability);
    if (!inspectOwnedContainer(cli, environment, containerCapability, mounts))
      throw new Error("owned_operation_mount_replaced");
    hasPostRunMountVerified = true;
  } catch (error) {
    base = Object.freeze({
      ...base,
      status: "blocked",
      reason: normalizeCancellationFailure(error),
    });
  } finally {
    if (attachedController) {
      const attachExecution = await attachedController.terminateAndWait();
      hasAttachProcessTerminationObserved =
        attachExecution !== null && attachedController.isClosed();
      attachProcessTerminationRequestCount =
        attachedController.getTerminationRequestCount();
      if (!hasAttachProcessTerminationObserved)
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason:
            "dynamic_fake_provider_attach_process_termination_unconfirmed",
          attachProcessTerminationObserved: false,
        });
    }
    if (
      containerCapability &&
      containerIdentity &&
      cli &&
      environment &&
      mounts
    ) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          environment,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed)
          base = Object.freeze({
            ...base,
            status: "blocked",
            reason: cleanup.reason,
            retainOperationDirectories: true,
            recoveryId,
            manualRecoveryRequired: true,
            cleanup: "unconfirmed",
          });
        else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity.id,
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
          const isHostCleanupVerified = recovered.status === "recovered";
          const isVerified =
            base.status === "candidate" &&
            hasPostRunMountVerified &&
            hasAttachProcessTerminationObserved &&
            isHostCleanupVerified;
          base = Object.freeze({
            ...base,
            status: isVerified ? "verified" : "blocked",
            reason: isVerified
              ? "dynamic_fake_provider_cancellation_verified"
              : isHostCleanupVerified
                ? base.reason
                : recovered.reason,
            containerAbsenceVerified: true,
            attachProcessTerminationObserved:
              hasAttachProcessTerminationObserved,
            hostCleanupVerified: isHostCleanupVerified,
            retainOperationDirectories: !isHostCleanupVerified,
            recoveryId: isHostCleanupVerified ? null : hostRecoveryId,
            manualRecoveryRequired: !isHostCleanupVerified,
            cleanup: isHostCleanupVerified ? "confirmed" : "unconfirmed",
          });
        }
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "docker_probe_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
        base = Object.freeze({
          ...base,
          hostCleanupVerified: true,
          cleanup: "confirmed",
        });
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "host_operation_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId: hostRecoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else {
      base = Object.freeze({
        ...base,
        status: "blocked",
        retainOperationDirectories: true,
        recoveryId,
        manualRecoveryRequired: true,
        cleanup: "unconfirmed",
      });
    }
  }
  return Object.freeze({
    ...base,
    attachProcessTerminationObserved: hasAttachProcessTerminationObserved,
    attachProcessTerminationRequestCount,
    diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
    diagnosticFilesystemEffectIssued: true,
  });
}

export function expectedDynamicFakeProviderFailureReason(
  scenario: DynamicFakeProviderFailureScenario,
): string {
  return FAILURE_SCENARIO_SPECS[scenario].expectedReason;
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
    const absence = confirmDockerAbsence(
      recovery.record.hostRecoveryId,
      null,
      absenceCapability,
      {
        probeId: identity.probeId,
        id: identity.id,
        rootName: recovery.record.rootName,
        cli,
      },
    );
    activeRecoveryId = absence.hostRecoveryId;
    const recovered = recoverOwnedOperationDirectories(absence.hostRecoveryId);
    const normalized = normalizeHostCleanupResult(
      recovered,
      absence.hostRecoveryId,
      {
        status: "recovered",
        reason: "docker_probe_recovery_completed",
      },
    );
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
  dynamicFakeProviderProcessImplemented: true,
  realProviderProcessesExecuted: false,
});
