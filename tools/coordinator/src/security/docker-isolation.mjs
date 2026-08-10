import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  verifyOwnedMountCapability
} from "./execution-environment.mjs";
import { formatHostRecoveryToken, loadHostRecoveryRecordByToken } from "./host-recovery-record.mjs";

const PROBE_IMAGE = "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
const MAX_OUTPUT_BYTES = 64 * 1024;
const PROBE_MARKER = "crdd-coordinator-isolation-v1";
const OWNERSHIP_LABEL = "crdd.coordinator.probe";
const DOCKER_DESKTOP_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const CONTAINER_IDENTITIES = new WeakMap();
const CLI_IDENTITIES = new WeakMap();
const ABSENCE_CAPABILITIES = new WeakMap();
const RECOVERY_FILE = "docker-probe-recovery-v1.json";
const OPERATION_PREFIX = "crdd-coordinator-doctor-";

export const DOCKER_CLI_POLICY = Object.freeze({
  installRoot: "C:\\Program Files\\Docker\\Docker\\resources\\bin",
  executableName: "docker.exe",
  sha256: "C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610",
  trustBasis: "valid_authenticode_docker_inc_then_human_selected_runtime_policy",
  updateBehavior: "block_until_reapproved"
});

const PROBE_SOURCE = String.raw`
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

function filesystemIdentity(target, expectedType) {
  const metadata = fs.lstatSync(target, { bigint: true });
  const typeValid = expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (!typeValid || metadata.isSymbolicLink() || metadata.dev <= 0n || metadata.ino <= 0n || metadata.birthtimeNs <= 0n) {
    throw new Error("docker_cli_untrusted");
  }
  return Object.freeze({ dev: metadata.dev, ino: metadata.ino, birthtimeNs: metadata.birthtimeNs });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.birthtimeNs === right.birthtimeNs;
}

function serializableIdentity(target, expectedType = "directory") {
  const identity = filesystemIdentity(target, expectedType);
  return { dev: identity.dev.toString(), ino: identity.ino.toString(), birthtimeNs: identity.birthtimeNs.toString() };
}

function identityMatchesRecord(target, record, expectedType = "directory") {
  try {
    const identity = filesystemIdentity(target, expectedType);
    return identity.dev === BigInt(record.dev) && identity.ino === BigInt(record.ino) && identity.birthtimeNs === BigInt(record.birthtimeNs);
  } catch { return false; }
}

function fileSha256(target) {
  return createHash("sha256").update(fs.readFileSync(target)).digest("hex").toUpperCase();
}

export function evaluateDockerCliCandidateForFixture(policy) {
  try {
    const root = fs.realpathSync(policy.installRoot);
    const executable = path.join(root, policy.executableName);
    const realExecutable = fs.realpathSync(executable);
    if (path.dirname(realExecutable) !== root || path.basename(realExecutable) !== policy.executableName) return false;
    filesystemIdentity(root, "directory");
    filesystemIdentity(realExecutable, "file");
    return fileSha256(realExecutable) === policy.sha256;
  } catch { return false; }
}

function createTrustedDockerCliCapability() {
  if (process.platform !== "win32") throw new Error("docker_backend_platform_unsupported");
  if (!evaluateDockerCliCandidateForFixture(DOCKER_CLI_POLICY)) throw new Error("docker_cli_untrusted");
  const root = fs.realpathSync(DOCKER_CLI_POLICY.installRoot);
  const executable = path.join(root, DOCKER_CLI_POLICY.executableName);
  const realExecutable = fs.realpathSync(executable);
  if (root !== DOCKER_CLI_POLICY.installRoot || path.dirname(realExecutable) !== root || path.basename(realExecutable) !== DOCKER_CLI_POLICY.executableName) {
    throw new Error("docker_cli_untrusted");
  }
  const snapshot = Object.freeze({
    root,
    executable: realExecutable,
    rootIdentity: filesystemIdentity(root, "directory"),
    executableIdentity: filesystemIdentity(realExecutable, "file"),
    sha256: fileSha256(realExecutable)
  });
  if (snapshot.sha256 !== DOCKER_CLI_POLICY.sha256) throw new Error("docker_cli_untrusted");
  const capability = Object.freeze({ kind: "trusted_docker_cli" });
  CLI_IDENTITIES.set(capability, snapshot);
  return capability;
}

function verifyTrustedDockerCliCapability(capability) {
  const snapshot = CLI_IDENTITIES.get(capability);
  if (!snapshot) throw new Error("docker_cli_untrusted");
  const realRoot = fs.realpathSync(snapshot.root);
  const realExecutable = fs.realpathSync(snapshot.executable);
  if (
    realRoot !== snapshot.root || realExecutable !== snapshot.executable ||
    path.dirname(realExecutable) !== realRoot ||
    !sameIdentity(filesystemIdentity(realRoot, "directory"), snapshot.rootIdentity) ||
    !sameIdentity(filesystemIdentity(realExecutable, "file"), snapshot.executableIdentity) ||
    fileSha256(realExecutable) !== snapshot.sha256
  ) throw new Error("docker_cli_untrusted");
  return snapshot.executable;
}

function bindMount(source, destination) {
  if (source.includes(",")) throw new Error("docker_mount_path_unsupported");
  return `type=bind,src=${source},dst=${destination}`;
}

function containerName(probeId) {
  return `crdd-coordinator-probe-${probeId}`;
}

export function dockerCreateArgumentsForFixture(mounts, probeId = "fixture") {
  return [
    "-H", DOCKER_DESKTOP_ENGINE,
    "create", "--pull=never", "--network=none", "--read-only",
    "--name", containerName(probeId),
    "--label", `${OWNERSHIP_LABEL}=${probeId}`,
    "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=64",
    "--user=65532:65532", "--workdir=/operation/workspace",
    "--env", "HOME=/operation/provider-home", "--env", "TMPDIR=/operation/tmp",
    "--mount", bindMount(mounts.workspace, "/operation/workspace"),
    "--mount", bindMount(mounts.providerHome, "/operation/provider-home"),
    "--mount", bindMount(mounts.tmp, "/operation/tmp"),
    "--entrypoint", "python", PROBE_IMAGE, "-c", PROBE_SOURCE
  ];
}

export function normalizeDockerIsolationResult(execution) {
  if (execution.error || execution.status !== 0 || typeof execution.stdout !== "string") return { status: "blocked", reason: "docker_isolation_probe_failed" };
  if (Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES) return { status: "blocked", reason: "docker_isolation_probe_output_too_large" };
  let parsed;
  try { parsed = JSON.parse(execution.stdout.trim()); } catch { return { status: "blocked", reason: "docker_isolation_probe_invalid_output" }; }
  const valid = parsed?.marker === PROBE_MARKER && parsed?.allowed_writes?.workspace === true && parsed?.allowed_writes?.["provider-home"] === true && parsed?.allowed_writes?.tmp === true && parsed?.runtime_paths_absent === true && parsed?.credential_names_absent === true && parsed?.network_blocked === true && parsed?.home_isolated === true && parsed?.tmp_isolated === true;
  return valid ? { status: "confirmed", reason: "docker_fake_provider_isolation_confirmed" } : { status: "blocked", reason: "docker_isolation_probe_assertion_failed" };
}

function dockerEnvironment(management) {
  const dockerConfig = path.join(management, "docker-config");
  const dockerHome = path.join(management, "docker-home");
  fs.mkdirSync(dockerConfig, { recursive: true });
  fs.mkdirSync(dockerHome, { recursive: true });
  const environment = { DOCKER_CONFIG: dockerConfig, HOME: dockerHome, USERPROFILE: dockerHome };
  for (const name of ["SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE"]) {
    if (typeof process.env[name] === "string") environment[name] = process.env[name];
  }
  return environment;
}

function recoveryToken(rootName, probeId, nonce, recordHash) {
  return `docker.${rootName}.${probeId}.${nonce}.${recordHash}`;
}

function transitionHostRecoveryState(hostRecoveryId, expectedState, nextState) {
  const loaded = loadHostRecoveryRecordByToken(hostRecoveryId);
  if (loaded.record.state !== expectedState) throw new Error("host_recovery_state_invalid");
  const updated = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updated)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, loaded.marker);
  return formatHostRecoveryToken(loaded.parsed.rootName, loaded.parsed.nonce, recordHash);
}

function beginDockerSubmission(hostRecoveryId) {
  return transitionHostRecoveryState(hostRecoveryId, "host_only", "docker_submission_started");
}

function cancelDockerSubmissionBeforeCreate(hostRecoveryId) {
  return transitionHostRecoveryState(hostRecoveryId, "docker_submission_started", "host_only");
}

function confirmDockerAbsence(hostRecoveryId, capability, expected) {
  const observation = capability && typeof capability === "object" ? ABSENCE_CAPABILITIES.get(capability) : null;
  if (
    !observation || observation.hostRecoveryId !== hostRecoveryId || observation.probeId !== expected.probeId ||
    observation.containerId !== expected.id || observation.rootName !== expected.rootName || observation.cli !== expected.cli
  ) throw new Error("docker_absence_capability_required");
  const updated = transitionHostRecoveryState(hostRecoveryId, "docker_submission_started", "docker_absent_confirmed");
  ABSENCE_CAPABILITIES.delete(capability);
  return updated;
}

function recoveryRecordPath(management) {
  return path.join(management, RECOVERY_FILE);
}

function writeRecoveryRecord(mounts, probeId, nonce, hostRecoveryId, containerId = null) {
  const root = path.dirname(mounts.management);
  const rootName = path.basename(root);
  if (!rootName.startsWith(OPERATION_PREFIX) || fs.realpathSync(path.dirname(root)) !== fs.realpathSync(os.tmpdir())) throw new Error("docker_recovery_boundary_failed");
  const record = {
    schema: "crdd-coordinator-docker-recovery/v1",
    probeId,
    nonceHash: createHash("sha256").update(nonce).digest("hex"),
    rootName,
    rootIdentity: serializableIdentity(root),
    childIdentities: Object.fromEntries([
      ["workspace", mounts.workspace], ["provider-home", mounts.providerHome], ["tmp", mounts.tmp],
      ["events", mounts.events], ["projection", mounts.projection], ["management", mounts.management]
    ].map(([name, target]) => [name, serializableIdentity(target)])),
    container: { id: containerId, name: containerName(probeId), label: `${OWNERSHIP_LABEL}=${probeId}` },
    engine: "docker_desktop_linux_named_pipe",
    image: PROBE_IMAGE,
    hostRecoveryId,
    createdAt: new Date().toISOString()
  };
  const target = recoveryRecordPath(mounts.management);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  fs.writeFileSync(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, target);
  if (!identityMatchesRecord(target, serializableIdentity(target, "file"), "file")) throw new Error("docker_recovery_record_failed");
  return recoveryToken(rootName, probeId, nonce, recordHash);
}

function removeRecoveryRecord(mounts) {
  const target = recoveryRecordPath(mounts.management);
  if (fs.existsSync(target)) {
    const metadata = fs.lstatSync(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("docker_recovery_record_replaced");
    fs.rmSync(target);
  }
}

function executeDocker(cliCapability, args, environment, timeout = 10_000) {
  const executable = verifyTrustedDockerCliCapability(cliCapability);
  return spawnSync(executable, args, { encoding: "utf8", windowsHide: true, timeout, maxBuffer: MAX_OUTPUT_BYTES, env: environment });
}

function dockerCommand(cli, environment, args, timeout) {
  return executeDocker(cli, ["-H", DOCKER_DESKTOP_ENGINE, ...args], environment, timeout);
}

function normalizeFailure(error, fallback = "docker_isolation_probe_failed") {
  const known = new Set([
    "docker_backend_platform_unsupported", "docker_cli_untrusted", "docker_mount_path_unsupported",
    "owned_operation_mount_identity_required", "owned_operation_mount_capability_required", "owned_operation_mount_replaced"
  ]);
  return known.has(error?.message) ? error.message : fallback;
}

function validContainerId(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value.trim());
}

export function normalizeContainerCreation(execution) {
  if (execution?.error || execution?.status !== 0 || !validContainerId(execution?.stdout)) {
    return { status: "blocked", reason: "docker_container_identity_unknown" };
  }
  return { status: "confirmed", id: execution.stdout.trim() };
}

function normalizedIdSet(execution) {
  if (execution?.error || execution?.status !== 0 || typeof execution?.stdout !== "string" || Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES) return null;
  const lines = execution.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => !validContainerId(line)) || new Set(lines).size !== lines.length) return null;
  return new Set(lines);
}

export function normalizeContainerAbsence(idExecution, nameExecution, labelExecution) {
  const sets = [idExecution, nameExecution, labelExecution].map(normalizedIdSet);
  const confirmed = sets.every((set) => set instanceof Set && set.size === 0);
  return confirmed
    ? { status: "confirmed", reason: "docker_probe_absence_confirmed" }
    : { status: "blocked", reason: "docker_probe_absence_unconfirmed" };
}

function readInspect(execution) {
  if (execution.error || execution.status !== 0 || typeof execution.stdout !== "string" || Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES) return null;
  try {
    const parsed = JSON.parse(execution.stdout);
    return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  } catch { return null; }
}

function expectedMounts(mounts) {
  return new Map([
    ["/operation/workspace", mounts.workspace],
    ["/operation/provider-home", mounts.providerHome],
    ["/operation/tmp", mounts.tmp]
  ]);
}

export function validateContainerInspect(inspect, expected) {
  if (!inspect || inspect.Id !== expected.id || inspect.Name !== `/${containerName(expected.probeId)}`) return false;
  if (inspect.Config?.Labels?.[OWNERSHIP_LABEL] !== expected.probeId || inspect.Config?.Image !== PROBE_IMAGE) return false;
  if (inspect.Config?.User !== "65532:65532" || inspect.Config?.Entrypoint?.length !== 1 || inspect.Config.Entrypoint[0] !== "python") return false;
  if (!Array.isArray(inspect.Config?.Cmd) || inspect.Config.Cmd.length !== 2 || inspect.Config.Cmd[0] !== "-c" || inspect.Config.Cmd[1] !== PROBE_SOURCE) return false;
  const host = inspect.HostConfig;
  if (!host || host.NetworkMode !== "none" || host.ReadonlyRootfs !== true || host.Privileged !== false || Number(host.PidsLimit) !== 64) return false;
  if (!Array.isArray(host.CapDrop) || host.CapDrop.length !== 1 || host.CapDrop[0] !== "ALL") return false;
  if ((host.CapAdd?.length ?? 0) !== 0 || (host.Devices?.length ?? 0) !== 0 || !host.SecurityOpt?.includes("no-new-privileges")) return false;
  const wanted = expectedMounts(expected.mounts);
  if (!Array.isArray(inspect.Mounts) || inspect.Mounts.length !== wanted.size) return false;
  for (const mount of inspect.Mounts) {
    const source = wanted.get(mount.Destination);
    if (!source || mount.Type !== "bind" || mount.RW !== true) return false;
    try { if (fs.realpathSync(mount.Source) !== source) return false; } catch { return false; }
    wanted.delete(mount.Destination);
  }
  return wanted.size === 0;
}

function inspectOwnedContainer(cli, environment, capability, mounts) {
  const identity = CONTAINER_IDENTITIES.get(capability);
  if (!identity) return null;
  const execution = dockerCommand(cli, environment, ["container", "inspect", identity.id]);
  const inspect = readInspect(execution);
  return validateContainerInspect(inspect, { ...identity, mounts }) ? inspect : null;
}

function observeContainerAbsence(cli, environment, identity, hostRecoveryId, rootName) {
  const common = ["container", "ls", "--all", "--quiet", "--no-trunc"];
  const id = dockerCommand(cli, environment, [...common, "--filter", `id=${identity.id}`]);
  const name = dockerCommand(cli, environment, [...common, "--filter", `name=^/${containerName(identity.probeId)}$`]);
  const label = dockerCommand(cli, environment, [...common, "--filter", `label=${OWNERSHIP_LABEL}=${identity.probeId}`]);
  if (normalizeContainerAbsence(id, name, label).status !== "confirmed") return null;
  const capability = Object.freeze({ kind: "docker_absence" });
  ABSENCE_CAPABILITIES.set(capability, Object.freeze({
    probeId: identity.probeId,
    containerId: identity.id,
    hostRecoveryId,
    rootName,
    cli
  }));
  return capability;
}

function cleanupOwnedContainer(cli, environment, capability, mounts, hostRecoveryId) {
  const identity = CONTAINER_IDENTITIES.get(capability);
  if (!identity) return { confirmed: false, reason: "docker_container_identity_unknown" };
  if (!inspectOwnedContainer(cli, environment, capability, mounts)) return { confirmed: false, reason: "docker_container_identity_mismatch" };
  const removal = dockerCommand(cli, environment, ["container", "rm", "--force", identity.id]);
  const absenceCapability = removal.error || removal.status !== 0
    ? null
    : observeContainerAbsence(cli, environment, identity, hostRecoveryId, path.basename(path.dirname(mounts.management)));
  if (!absenceCapability) return { confirmed: false, reason: "docker_probe_cleanup_failed" };
  CONTAINER_IDENTITIES.delete(capability);
  return { confirmed: true, reason: "docker_probe_absence_confirmed", absenceCapability };
}

function verifyLocalLinuxEngine(cli, environment) {
  const execution = dockerCommand(cli, environment, ["version", "--format", "{{.Server.Os}}"]);
  return !execution.error && execution.status === 0 && execution.stdout.trim() === "linux";
}

function blocked(reason, probeId = null, retainOperationDirectories = false, recoveryId = null, manualRecoveryRequired = false) {
  return {
    status: "blocked",
    reason,
    probeId,
    retainOperationDirectories,
    hostCleanupCompleted: false,
    recoveryId,
    manualRecoveryRequired,
    cleanup: retainOperationDirectories ? "unconfirmed" : "not_required_or_confirmed"
  };
}

export function normalizeDockerProbeFailure(error, probeId, state) {
  if (state.rollbackFailed === true) {
    return blocked("docker_submission_rollback_failed", probeId, true, null, true);
  }
  return blocked(
    normalizeFailure(error),
    probeId,
    state.submissionStarted,
    state.submissionStarted ? state.recoveryId : state.hostRecoveryId
  );
}

function finishHostRecovery(hostRecoveryId, baseResult, probeId) {
  const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
  return normalizeHostCleanupResult(recovered, hostRecoveryId, baseResult, probeId);
}

export function normalizeHostCleanupResult(recovered, hostRecoveryId, baseResult = {}, probeId = null) {
  return recovered?.status === "recovered"
    ? { ...baseResult, hostCleanupCompleted: true, retainOperationDirectories: false, recoveryId: null, cleanup: "confirmed" }
    : { ...blocked(recovered?.reason ?? "host_recovery_failed", probeId, true, hostRecoveryId) };
}

function finishPreSubmissionCleanup(owned, hostRecoveryId, baseResult, probeId) {
  try {
    cleanupOwnedOperationDirectories(owned);
    return { ...baseResult, hostCleanupCompleted: true, retainOperationDirectories: false, recoveryId: null, cleanup: "confirmed" };
  } catch {
    return { ...blocked("host_operation_cleanup_failed", probeId, true, hostRecoveryId) };
  }
}

export function runDockerIsolationProbe(owned) {
  const probeId = randomUUID();
  let cli;
  let mountCapability;
  let mounts;
  let environment;
  let containerCapability = null;
  let containerIdentity = null;
  let recoveryId = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let submissionStarted = false;
  let rollbackFailed = false;
  const recoveryNonce = randomUUID();
  let result = blocked("docker_isolation_probe_failed");
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
      submissionStarted = true;
      try {
        recoveryId = writeRecoveryRecord(mounts, probeId, recoveryNonce, hostRecoveryId, null);
      } catch (error) {
        try {
          hostRecoveryId = cancelDockerSubmissionBeforeCreate(hostRecoveryId);
          submissionStarted = false;
        } catch {
          rollbackFailed = true;
        }
        throw error;
      }
      const creation = dockerCommand(cli, environment, dockerCreateArgumentsForFixture(mounts, probeId).slice(2), 30_000);
      const normalizedCreation = normalizeContainerCreation(creation);
      if (normalizedCreation.status !== "confirmed") {
        result = blocked("docker_container_identity_unknown", probeId, true, recoveryId);
      } else {
        const identity = Object.freeze({ id: normalizedCreation.id, probeId });
        containerIdentity = identity;
        containerCapability = Object.freeze({ kind: "owned_docker_probe" });
        CONTAINER_IDENTITIES.set(containerCapability, identity);
        recoveryId = writeRecoveryRecord(mounts, probeId, recoveryNonce, hostRecoveryId, identity.id);
        mounts = verifyOwnedMountCapability(mountCapability);
        if (!inspectOwnedContainer(cli, environment, containerCapability, mounts)) {
          result = blocked("docker_container_security_profile_mismatch", probeId, true, recoveryId);
        } else {
          mounts = verifyOwnedMountCapability(mountCapability);
          const execution = dockerCommand(cli, environment, ["start", "--attach", identity.id], 30_000);
          result = normalizeDockerIsolationResult(execution);
          mounts = verifyOwnedMountCapability(mountCapability);
        }
      }
    }
  } catch (error) {
    result = normalizeDockerProbeFailure(error, probeId, {
      submissionStarted,
      recoveryId,
      hostRecoveryId,
      rollbackFailed
    });
  } finally {
    if (containerCapability && cli && environment && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(cli, environment, containerCapability, mounts, hostRecoveryId);
        if (!cleanup.confirmed) result = blocked(cleanup.reason, probeId, true, recoveryId);
        else {
          hostRecoveryId = confirmDockerAbsence(hostRecoveryId, cleanup.absenceCapability, {
            probeId,
            id: containerIdentity.id,
            rootName: path.basename(path.dirname(mounts.management)),
            cli
          });
          result = finishHostRecovery(hostRecoveryId, result, probeId);
        }
      } catch {
        result = blocked("docker_probe_cleanup_failed", probeId, true, recoveryId);
      }
    } else if (!submissionStarted) {
      result = finishPreSubmissionCleanup(owned, hostRecoveryId, result, probeId);
    }
  }
  return result;
}

function parseRecoveryToken(token) {
  const match = /^docker\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(token ?? "");
  if (!match) throw new Error("docker_recovery_token_invalid");
  return { rootName: match[1], probeId: match[2], nonce: match[3], recordHash: match[4] };
}

function loadRecoveryRecord(token) {
  const parsed = parseRecoveryToken(token);
  const parent = fs.realpathSync(os.tmpdir());
  const root = path.join(parent, parsed.rootName);
  if (path.dirname(root) !== parent || fs.realpathSync(root) !== root || fs.lstatSync(root).isSymbolicLink()) throw new Error("docker_recovery_boundary_failed");
  const management = path.join(root, "management");
  const marker = path.join(management, RECOVERY_FILE);
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink()) throw new Error("docker_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash) throw new Error("docker_recovery_record_mismatch");
  const record = JSON.parse(serialized);
  if (record.schema !== "crdd-coordinator-docker-recovery/v1" || record.rootName !== parsed.rootName || record.probeId !== parsed.probeId || record.nonceHash !== createHash("sha256").update(parsed.nonce).digest("hex")) throw new Error("docker_recovery_record_mismatch");
  if (!identityMatchesRecord(root, record.rootIdentity)) throw new Error("docker_recovery_root_replaced");
  const { children, present } = classifyRecoveryChildren(root, record.childIdentities);
  if (!present.includes("management")) throw new Error("docker_recovery_management_missing");
  return { parsed, record, root, children, marker, present: new Set(present) };
}

export function classifyRecoveryChildren(root, childIdentities) {
  const children = {
    workspace: path.join(root, "workspace"), providerHome: path.join(root, "provider-home"), tmp: path.join(root, "tmp"),
    events: path.join(root, "events"), projection: path.join(root, "projection"), management: path.join(root, "management")
  };
  const byRecordName = {
    workspace: children.workspace, "provider-home": children.providerHome, tmp: children.tmp,
    events: children.events, projection: children.projection, management: children.management
  };
  const knownNames = new Set(Object.keys(byRecordName));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!knownNames.has(entry.name)) throw new Error("docker_recovery_unknown_child");
  }
  const present = new Set();
  for (const [name, target] of Object.entries(byRecordName)) {
    try {
      const metadata = fs.lstatSync(target);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync(target) !== target ||
        path.dirname(target) !== root ||
        !identityMatchesRecord(target, childIdentities?.[name])
      ) throw new Error("docker_recovery_child_replaced");
      present.add(name);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
  }
  return { children, present: [...present].sort() };
}

function recoveryMounts(recovery) {
  for (const name of ["workspace", "provider-home", "tmp", "management"]) {
    if (!recovery.present.has(name)) throw new Error("docker_recovery_mount_missing");
  }
  return recovery.children;
}

export function recoverDockerIsolationProbe(token) {
  let activeRecoveryId = token;
  try {
    const recovery = loadRecoveryRecord(token);
    const cli = createTrustedDockerCliCapability();
    const environment = dockerEnvironment(recovery.children.management);
    const identity = { id: recovery.record.container.id, probeId: recovery.record.probeId };
    let absenceCapability = null;
    if (identity.id) {
      absenceCapability = observeContainerAbsence(cli, environment, identity, recovery.record.hostRecoveryId, recovery.record.rootName);
      if (!absenceCapability) {
        const mounts = recoveryMounts(recovery);
        const capability = Object.freeze({ kind: "recovered_docker_probe" });
        CONTAINER_IDENTITIES.set(capability, Object.freeze(identity));
        const inspect = inspectOwnedContainer(cli, environment, capability, mounts);
        if (!inspect) return { status: "blocked", reason: "docker_recovery_container_mismatch", recoveryId: token };
        const cleanup = cleanupOwnedContainer(cli, environment, capability, mounts, recovery.record.hostRecoveryId);
        if (!cleanup.confirmed) return { status: "blocked", reason: cleanup.reason, recoveryId: token };
        absenceCapability = cleanup.absenceCapability;
      }
    } else {
      return { status: "blocked", reason: "docker_recovery_container_identity_unknown", recoveryId: token };
    }
    const hostRecoveryId = confirmDockerAbsence(recovery.record.hostRecoveryId, absenceCapability, {
      probeId: identity.probeId,
      id: identity.id,
      rootName: recovery.record.rootName,
      cli
    });
    activeRecoveryId = hostRecoveryId;
    const recovered = recoverOwnedOperationDirectories(hostRecoveryId);
    const normalized = normalizeHostCleanupResult(recovered, hostRecoveryId, {
      status: "recovered",
      reason: "docker_probe_recovery_completed"
    });
    return normalized.hostCleanupCompleted
      ? normalized
      : { ...normalized, status: "blocked" };
  } catch (error) {
    return { status: "blocked", reason: normalizeFailure(error, "docker_probe_recovery_failed"), recoveryId: activeRecoveryId, hostCleanupCompleted: false };
  }
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  backend: "docker_desktop_linux",
  endpoint: "local_named_pipe",
  dockerCliPinnedByHash: true,
  imagePinnedByDigest: true,
  networkMode: "none",
  providerProcessesExecuted: false
});
