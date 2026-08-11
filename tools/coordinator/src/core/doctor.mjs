import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  cleanupOwnedOperationDirectories,
  createOwnedOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
  getOwnedHostRecoveryId
} from "../security/execution-environment.mjs";
import {
  DOCKER_ISOLATION_PROFILE,
  runDockerIsolationProbe
} from "../security/docker-isolation.mjs";
import { describeProviderIsolationContract } from "../security/provider-isolation-profile.mjs";
import { describeEgressProxyTopology } from "../security/egress-proxy-policy.mjs";
import { describeAuthorityGrantVerifierContract } from "../security/authority-grant-verifier.mjs";
import { describeAuthorityTrustLoaderContract } from "../security/authority-trust-loader.mjs";

export const CHECK_STATUS = Object.freeze([
  "confirmed",
  "blocked",
  "not_implemented",
  "unknown"
]);

const PROVIDERS = Object.freeze(["codex", "claude"]);
const PROVIDER_CHECKS = Object.freeze([
  "discovery",
  "authentication",
  "active_probe",
  "auto_update",
  "telemetry",
  "session_resume",
  "timeout",
  "cancel",
  "process_tree_termination"
]);

function requiredCheckIds() {
  const ids = [
    "runtime.node",
    "repository.git",
    "repository.identity",
    "operation.directories",
    "execution.filesystem",
    "execution.credential_environment",
    "execution.credential_isolation",
    "execution.egress"
  ];
  for (const provider of PROVIDERS) {
    for (const check of PROVIDER_CHECKS) {
      ids.push(`provider.${provider}.${check}`);
    }
  }
  return ids;
}

export const REQUIRED_CHECK_IDS = Object.freeze(requiredCheckIds());

function check(id, status, reason, followUp = null) {
  return { id, status, reason, followUp };
}

export function evaluateReadiness(checks) {
  const expected = new Set(REQUIRED_CHECK_IDS);
  const seen = new Set();
  const blockers = [];

  for (const item of checks) {
    if (!item || typeof item.id !== "string" || !expected.has(item.id)) {
      blockers.push({ id: item?.id ?? null, reason: "unknown_check" });
      continue;
    }
    if (seen.has(item.id)) {
      blockers.push({ id: item.id, reason: "duplicate_check" });
      continue;
    }
    seen.add(item.id);
    if (!CHECK_STATUS.includes(item.status)) {
      blockers.push({ id: item.id, reason: "invalid_status" });
      continue;
    }
    if (item.status !== "confirmed") {
      blockers.push({ id: item.id, reason: item.reason ?? item.status });
    }
  }

  for (const id of REQUIRED_CHECK_IDS) {
    if (!seen.has(id)) blockers.push({ id, reason: "missing_check" });
  }

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers
  };
}

function pathValue(environment) {
  return environment.PATH ?? environment.Path ?? "";
}

function candidateExtensions(platform, environment) {
  if (platform !== "win32") return [""];
  const configured = environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  return configured.split(";").filter(Boolean).map((value) => value.toLowerCase());
}

function commandFormat(candidate) {
  const extension = path.extname(candidate).toLowerCase().replace(/^\./u, "");
  return extension || "native";
}

export function discoverCommand(command, options = {}) {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const fileSystem = options.fileSystem ?? fs;
  const candidates = [];

  for (const directory of pathValue(environment).split(path.delimiter).filter(Boolean)) {
    for (const extension of candidateExtensions(platform, environment)) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        const metadata = fileSystem.lstatSync(candidate);
        if (!metadata.isFile() || metadata.isSymbolicLink()) continue;
        if (platform !== "win32" && (metadata.mode & 0o111) === 0) continue;
        candidates.push({ format: commandFormat(candidate) });
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
          return { located: false, candidateCount: 0, formats: [], reason: "discovery_failed" };
        }
      }
    }
  }

  return {
    located: candidates.length > 0,
    candidateCount: candidates.length,
    formats: [...new Set(candidates.map((candidate) => candidate.format))].sort(),
    reason: candidates.length > 0 ? null : "command_not_found"
  };
}

function probeGitRepository(cwd) {
  const execute = (args) => spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000
  });
  const commit = execute(["rev-parse", "HEAD"]);
  const tree = execute(["rev-parse", "HEAD^{tree}"]);
  const status = execute(["status", "--porcelain=v1", "-z"]);

  return {
    gitAvailable: commit.error == null,
    identityAvailable: commit.status === 0 && tree.status === 0 && status.status === 0,
    headCommit: commit.status === 0 ? commit.stdout.trim() : null,
    headTree: tree.status === 0 ? tree.stdout.trim() : null,
    workingState: status.status === 0 && status.stdout.length === 0 ? "clean" : "dirty_or_unknown"
  };
}

function nodeSupported() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  return Number.isInteger(major) && major >= 22;
}

function providerChecks(name, discovery) {
  return [
    check(
      `provider.${name}.discovery`,
      discovery.located ? "confirmed" : "blocked",
      discovery.reason,
      discovery.located ? null : "install_or_select_provider_outside_runtime"
    ),
    check(`provider.${name}.authentication`, "unknown", "authentication_not_evaluated"),
    check(`provider.${name}.active_probe`, "not_implemented", "isolation_required_before_provider_spawn"),
    check(`provider.${name}.auto_update`, "not_implemented", "provider_lifecycle_probe_not_implemented"),
    check(`provider.${name}.telemetry`, "not_implemented", "provider_lifecycle_probe_not_implemented"),
    check(`provider.${name}.session_resume`, "not_implemented", "provider_lifecycle_probe_not_implemented"),
    check(`provider.${name}.timeout`, "not_implemented", "provider_lifecycle_probe_not_implemented"),
    check(`provider.${name}.cancel`, "not_implemented", "provider_lifecycle_probe_not_implemented"),
    check(`provider.${name}.process_tree_termination`, "not_implemented", "provider_lifecycle_probe_not_implemented")
  ];
}

function reportableFilesystemPolicy(policy, root) {
  const relative = (value) => path.relative(root, value).replaceAll("\\", "/");
  return {
    coordinatorRuntime: { write: policy.coordinatorRuntime.write.map(relative) },
    repositoryAdapter: { write: policy.repositoryAdapter.write.map(relative) },
    providerProcess: {
      write: policy.providerProcess.write.map(relative),
      deny: policy.providerProcess.deny.map(relative)
    },
    credentialBroker: policy.credentialBroker
  };
}

export function runDoctor(options = {}) {
  const activeIsolation = options.activeIsolation === true;
  const owned = createOwnedOperationDirectories();
  const initialHostRecoveryId = getOwnedHostRecoveryId(owned);
  let retainOperationDirectories = false;
  try {
    const providerEnvironment = createProviderEnvironment(process.env, owned.directories);
    const credentialNames = credentialEnvironmentNamesPresent(process.env);
    const forwardedCredentialNames = credentialEnvironmentNamesPresent(providerEnvironment);
    const repository = probeGitRepository(process.cwd());
    const providers = Object.fromEntries(
      PROVIDERS.map((name) => [name, discoverCommand(name)])
    );

    const isolation = activeIsolation
      ? runDockerIsolationProbe(owned)
      : { status: "not_implemented", reason: "filesystem_boundary_not_enforced" };
    retainOperationDirectories = activeIsolation
      ? isolation.hostCleanupCompleted !== true
      : false;
    const checks = [
      check("runtime.node", nodeSupported() ? "confirmed" : "blocked", nodeSupported() ? null : "node_22_or_newer_required"),
      check("repository.git", repository.gitAvailable ? "confirmed" : "blocked", repository.gitAvailable ? null : "git_unavailable"),
      check("repository.identity", repository.identityAvailable ? "confirmed" : "blocked", repository.identityAvailable ? null : "repository_identity_unavailable"),
      check("operation.directories", "confirmed", "owned_operation_directories_created"),
      check("execution.filesystem", isolation.status, isolation.reason),
      check(
        "execution.credential_environment",
        forwardedCredentialNames.length === 0 ? "confirmed" : "blocked",
        forwardedCredentialNames.length === 0 ? null : "credential_environment_filter_failed"
      ),
      check(
        "execution.credential_isolation",
        activeIsolation && isolation.status === "confirmed" ? "confirmed" : "not_implemented",
        activeIsolation && isolation.status === "confirmed" ? "credential_paths_not_mounted_in_fake_probe" : "credential_store_isolation_not_enforced"
      ),
      check(
        "execution.egress",
        activeIsolation && isolation.status === "confirmed" ? "blocked" : "not_implemented",
        activeIsolation && isolation.status === "confirmed" ? "provider_endpoint_allowlist_not_configured" : "provider_egress_allowlist_not_enforced"
      ),
      ...providerChecks("codex", providers.codex),
      ...providerChecks("claude", providers.claude)
    ];
    const readiness = evaluateReadiness(checks);

    const report = {
      reportVersion: 2,
      diagnosticMode: activeIsolation ? "docker_fake_provider_probe" : "passive_preflight",
      status: readiness.status,
      platform: process.platform,
      node: { version: process.version, supported: nodeSupported() },
      repository,
      credentials: {
        detectedNames: credentialNames,
        forwardedNames: forwardedCredentialNames,
        valuesRecorded: false,
        environmentFiltered: forwardedCredentialNames.length === 0,
        isolationEnforcement: activeIsolation && isolation.status === "confirmed"
          ? "confirmed_for_fake_probe"
          : "not_implemented"
      },
      filesystem: {
        policy: reportableFilesystemPolicy(describeFilesystemPolicy(owned.directories), owned.root),
        enforcement: isolation.status,
        profile: activeIsolation ? DOCKER_ISOLATION_PROFILE : null
      },
      egress: {
        providerAllowlist: "not_implemented",
        fakeProbeNetwork: activeIsolation && isolation.status === "confirmed" ? "blocked" : "not_evaluated",
        isolationProfileContract: describeProviderIsolationContract(),
        authorityVerifier: describeAuthorityGrantVerifierContract(),
        authorityTrustLoader: describeAuthorityTrustLoaderContract(),
        proxyTopology: describeEgressProxyTopology(),
        activation: "blocked",
        activationReason: "runtime_trust_policy_activation_prelaunch_reverification_proxy_and_credential_broker_not_implemented"
      },
      recovery: retainOperationDirectories
        ? {
            required: true,
            recoveryId: isolation.recoveryId ?? null,
            reason: isolation.reason,
            manualRecoveryRequired: isolation.manualRecoveryRequired === true
          }
        : { required: false },
      providers,
      checks,
      blockers: readiness.blockers
    };
    if (!activeIsolation) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        const filesystemCheck = report.checks.find((item) => item.id === "execution.filesystem");
        filesystemCheck.status = "blocked";
        filesystemCheck.reason = "host_operation_cleanup_failed";
        const cleanupReadiness = evaluateReadiness(report.checks);
        report.status = "blocked";
        report.blockers = cleanupReadiness.blockers;
        report.recovery = {
          required: true,
          recoveryId: initialHostRecoveryId,
          reason: "host_operation_cleanup_failed"
        };
      }
    }
    return report;
  } catch (error) {
    if (!activeIsolation && !retainOperationDirectories) {
      try { cleanupOwnedOperationDirectories(owned); } catch { /* recovery marker remains external */ }
    }
    throw error;
  }
}
