import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createOperationDirectories,
  createProbeRoot,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy
} from "../security/execution-environment.mjs";

function commandLocator(platform) {
  return platform === "win32" ? "where.exe" : "which";
}

export function probeCommand(command, options = {}) {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const runner = options.runner ?? spawnSync;
  const locate = runner(commandLocator(platform), [command], {
    encoding: "utf8",
    env: environment,
    windowsHide: true
  });

  if (locate.status !== 0) {
    return {
      command,
      located: false,
      runnable: false,
      path: null,
      version: null,
      reason: "command_not_found"
    };
  }

  const locatedPath = String(locate.stdout ?? "")
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find(Boolean) ?? null;

  const version = runner(command, ["--version"], {
    encoding: "utf8",
    env: environment,
    windowsHide: true,
    timeout: options.timeout ?? 10_000
  });

  const versionText = `${version.stdout ?? ""}\n${version.stderr ?? ""}`.trim();
  return {
    command,
    located: true,
    runnable: version.status === 0,
    path: locatedPath,
    version: version.status === 0 ? versionText : null,
    reason: version.status === 0 ? null : version.error?.code ?? `exit_${version.status}`
  };
}

function probeGitRepository(cwd, runner = spawnSync) {
  const execute = (args) => runner("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  const commit = execute(["rev-parse", "HEAD"]);
  const tree = execute(["rev-parse", "HEAD^{tree}"]);
  const status = execute(["status", "--porcelain=v1", "-z"]);

  return {
    available: commit.status === 0 && tree.status === 0 && status.status === 0,
    headCommit: commit.status === 0 ? commit.stdout.trim() : null,
    headTree: tree.status === 0 ? tree.stdout.trim() : null,
    workingState: status.status === 0 && status.stdout.length === 0 ? "clean" : "dirty_or_unknown"
  };
}

function makeFilesystemPolicyReportable(policy, probeRoot) {
  const relative = (value) => path.relative(probeRoot, value).replaceAll("\\", "/");
  return {
    coordinatorRuntime: {
      write: policy.coordinatorRuntime.write.map(relative)
    },
    repositoryAdapter: {
      write: policy.repositoryAdapter.write.map(relative)
    },
    providerProcess: {
      write: policy.providerProcess.write.map(relative),
      deny: policy.providerProcess.deny.map(relative)
    },
    credentialBroker: policy.credentialBroker
  };
}

export function evaluateProviderGate(provider, enforcement) {
  const blockers = [];
  if (!provider.located) blockers.push("command_not_found");
  if (provider.located && !provider.runnable) blockers.push("command_not_runnable_in_isolated_home");
  if (!enforcement.filesystem) blockers.push("filesystem_boundary_not_enforced");
  if (!enforcement.credentials) blockers.push("credential_isolation_not_enforced");
  if (!enforcement.providerEgress) blockers.push("provider_egress_allowlist_not_enforced");

  return {
    ready: blockers.length === 0,
    blockers
  };
}

export function runDoctor(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const baseEnvironment = options.environment ?? process.env;
  const runner = options.runner ?? spawnSync;
  const probeRoot = options.probeRoot ?? createProbeRoot();
  const directories = createOperationDirectories(probeRoot);
  const providerEnvironment = createProviderEnvironment(baseEnvironment, directories);
  const filesystemPolicy = describeFilesystemPolicy(directories);
  const exposedCredentialNames = credentialEnvironmentNamesPresent(baseEnvironment);
  const forwardedCredentialNames = credentialEnvironmentNamesPresent(providerEnvironment);

  const enforcement = options.enforcement ?? {
    filesystem: false,
    credentials: false,
    providerEgress: false
  };

  const providers = {};
  for (const command of ["codex", "claude"]) {
    const probe = probeCommand(command, {
      environment: providerEnvironment,
      platform: options.platform,
      runner,
      timeout: options.timeout
    });
    providers[command] = {
      ...probe,
      gate: evaluateProviderGate(probe, enforcement)
    };
  }

  const report = {
    reportVersion: 1,
    status: Object.values(providers).every((provider) => provider.gate.ready) ? "ready" : "blocked",
    platform: options.platform ?? process.platform,
    node: process.version,
    repository: probeGitRepository(cwd, runner),
    credentials: {
      detectedNames: exposedCredentialNames,
      forwardedNames: forwardedCredentialNames,
      valuesRecorded: false,
      environmentFiltered: forwardedCredentialNames.length === 0,
      enforcement: enforcement.credentials ? "enforced" : "not_implemented"
    },
    filesystem: {
      probeRoot,
      policy: makeFilesystemPolicyReportable(filesystemPolicy, probeRoot),
      enforcement: enforcement.filesystem ? "enforced" : "not_implemented"
    },
    egress: {
      providerAllowlist: enforcement.providerEgress ? "enforced" : "not_implemented"
    },
    providers
  };

  if (options.retainProbeRoot !== true) {
    fs.rmSync(probeRoot, { recursive: true, force: true });
    report.filesystem.probeRoot = null;
  }

  return report;
}
