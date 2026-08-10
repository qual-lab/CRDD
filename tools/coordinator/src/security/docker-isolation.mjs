import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PROBE_IMAGE = "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
const MAX_OUTPUT_BYTES = 64 * 1024;
const PROBE_MARKER = "crdd-coordinator-isolation-v1";
const DOCKER_DESKTOP_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";

const PROBE_SOURCE = String.raw`
import json, os, pathlib, socket, sys

result = {
    "marker": "${PROBE_MARKER}",
    "allowed_writes": {},
    "runtime_paths_absent": True,
    "credential_names_absent": True,
    "network_blocked": False,
    "home_isolated": False,
    "tmp_isolated": False,
}

for name in ("workspace", "provider-home", "tmp"):
    target = pathlib.Path("/operation") / name / ".coordinator-probe"
    try:
        target.write_text(name, encoding="utf-8")
        result["allowed_writes"][name] = target.read_text(encoding="utf-8") == name
        target.unlink()
    except Exception:
        result["allowed_writes"][name] = False

result["runtime_paths_absent"] = all(
    not pathlib.Path("/runtime", name).exists()
    for name in ("events", "projection", "management")
)

credential_names = {
    "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "CODEX_API_KEY",
    "CODEX_ACCESS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "GIT_ASKPASS",
    "OPENAI_API_KEY", "SSH_AUTH_SOCK"
}
result["credential_names_absent"] = credential_names.isdisjoint(os.environ)
result["home_isolated"] = os.environ.get("HOME") == "/operation/provider-home"
result["tmp_isolated"] = os.environ.get("TMPDIR") == "/operation/tmp"

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(0.5)
try:
    sock.connect(("1.1.1.1", 443))
except OSError:
    result["network_blocked"] = True
finally:
    sock.close()

print(json.dumps(result, separators=(",", ":")))
sys.exit(0 if all(result["allowed_writes"].values()) and all([
    result["runtime_paths_absent"], result["credential_names_absent"],
    result["network_blocked"], result["home_isolated"], result["tmp_isolated"]
]) else 3)
`;

function pathEntries(environment) {
  return (environment.PATH ?? environment.Path ?? "").split(path.delimiter).filter(Boolean);
}

function locateDockerExecutable(environment = process.env) {
  const names = process.platform === "win32" ? ["docker.exe"] : ["docker"];
  const candidates = [];
  for (const directory of pathEntries(environment)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      try {
        const metadata = fs.lstatSync(candidate);
        if (!metadata.isFile() || metadata.isSymbolicLink()) continue;
        if (process.platform !== "win32" && (metadata.mode & 0o111) === 0) continue;
        candidates.push(fs.realpathSync(candidate));
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) {
          throw new Error("docker_discovery_failed");
        }
      }
    }
  }
  const unique = [...new Set(candidates)];
  if (unique.length === 0) throw new Error("docker_not_found");
  if (unique.length !== 1) throw new Error("docker_command_ambiguous");
  return unique[0];
}

function bindMount(source, destination) {
  const realSource = fs.realpathSync(source);
  if (realSource.includes(",")) throw new Error("docker_mount_path_unsupported");
  return `type=bind,src=${realSource},dst=${destination}`;
}

export function dockerIsolationArguments(directories, probeId = "fixture") {
  return [
    "-H", DOCKER_DESKTOP_ENGINE,
    "run", "--rm", "--pull=never", "--network=none", "--read-only",
    "--name", `crdd-coordinator-probe-${probeId}`,
    "--label", `crdd.coordinator.probe=${probeId}`,
    "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=64",
    "--user=65532:65532", "--workdir=/operation/workspace",
    "--env", "HOME=/operation/provider-home",
    "--env", "TMPDIR=/operation/tmp",
    "--mount", bindMount(directories.workspace, "/operation/workspace"),
    "--mount", bindMount(directories.providerHome, "/operation/provider-home"),
    "--mount", bindMount(directories.tmp, "/operation/tmp"),
    "--entrypoint", "python", PROBE_IMAGE, "-c", PROBE_SOURCE
  ];
}

export function normalizeDockerIsolationResult(execution) {
  if (execution.error || execution.status !== 0 || typeof execution.stdout !== "string") {
    return { status: "blocked", reason: "docker_isolation_probe_failed" };
  }
  if (Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES) {
    return { status: "blocked", reason: "docker_isolation_probe_output_too_large" };
  }
  let parsed;
  try {
    parsed = JSON.parse(execution.stdout.trim());
  } catch {
    return { status: "blocked", reason: "docker_isolation_probe_invalid_output" };
  }
  const valid = parsed?.marker === PROBE_MARKER &&
    parsed?.allowed_writes?.workspace === true &&
    parsed?.allowed_writes?.["provider-home"] === true &&
    parsed?.allowed_writes?.tmp === true &&
    parsed?.runtime_paths_absent === true &&
    parsed?.credential_names_absent === true &&
    parsed?.network_blocked === true &&
    parsed?.home_isolated === true &&
    parsed?.tmp_isolated === true;
  return valid
    ? { status: "confirmed", reason: "docker_fake_provider_isolation_confirmed" }
    : { status: "blocked", reason: "docker_isolation_probe_assertion_failed" };
}

function dockerEnvironment(directories) {
  const dockerConfig = path.join(directories.management, "docker-config");
  const dockerHome = path.join(directories.management, "docker-home");
  fs.mkdirSync(dockerConfig, { recursive: true });
  fs.mkdirSync(dockerHome, { recursive: true });
  return {
    PATH: process.env.PATH ?? process.env.Path ?? "",
    Path: process.env.Path ?? process.env.PATH ?? "",
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    COMSPEC: process.env.COMSPEC,
    DOCKER_CONFIG: dockerConfig,
    HOME: dockerHome,
    USERPROFILE: dockerHome
  };
}

function executeDocker(docker, args, environment, timeout = 10_000) {
  return spawnSync(docker, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: MAX_OUTPUT_BYTES,
    env: environment
  });
}

function verifyLocalLinuxEngine(docker, environment) {
  const execution = executeDocker(
    docker,
    ["-H", DOCKER_DESKTOP_ENGINE, "version", "--format", "{{.Server.Os}}"],
    environment
  );
  return execution.error == null && execution.status === 0 && execution.stdout.trim() === "linux";
}

function cleanupProbeContainer(docker, environment, probeId) {
  const name = `crdd-coordinator-probe-${probeId}`;
  const listing = executeDocker(docker, [
    "-H", DOCKER_DESKTOP_ENGINE, "container", "ls", "--all",
    "--filter", `name=^/${name}$`, "--format", "{{.ID}}|{{.Label \"crdd.coordinator.probe\"}}"
  ], environment);
  if (listing.error || listing.status !== 0) return false;
  const value = listing.stdout.trim();
  if (value.length === 0) return true;
  const [id, label, ...extra] = value.split("|");
  if (!id || label !== probeId || extra.length > 0) return false;
  const removal = executeDocker(
    docker,
    ["-H", DOCKER_DESKTOP_ENGINE, "container", "rm", "--force", id],
    environment
  );
  return removal.error == null && removal.status === 0;
}

export function runDockerIsolationProbe(directories) {
  const docker = locateDockerExecutable();
  const environment = dockerEnvironment(directories);
  if (!verifyLocalLinuxEngine(docker, environment)) {
    return { status: "blocked", reason: "local_docker_desktop_linux_engine_required" };
  }
  const probeId = randomUUID();
  const execution = executeDocker(docker, dockerIsolationArguments(directories, probeId), environment, 30_000);
  const normalized = normalizeDockerIsolationResult(execution);
  if (!cleanupProbeContainer(docker, environment, probeId)) {
    return { status: "blocked", reason: "docker_probe_cleanup_failed" };
  }
  return normalized;
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  backend: "docker_desktop_linux",
  endpoint: "local_named_pipe",
  imagePinnedByDigest: true,
  networkMode: "none",
  providerProcessesExecuted: false
});
