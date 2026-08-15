#!/usr/bin/env node

import { runDoctor } from "../src/core/doctor.mjs";
import {
  parseActivateArguments,
  parseDisableArguments,
  parseDoctorArguments,
  parseProvisionArguments
} from "../src/core/cli-options.mjs";
import { selectAuthorityRootCandidate } from "../src/security/authority-root-profile.mjs";
import { recoverDockerIsolationProbe } from "../src/security/docker-isolation.mjs";
import { recoverOwnedOperationDirectories } from "../src/security/execution-environment.mjs";
import { selectRuntimeRootCandidate } from "../src/security/runtime-root-profile.mjs";

function printHelp() {
  process.stdout.write(`Coordinator Runtime 1.0 (implementation candidate)\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  coordinator doctor [--json] [--isolation] [--enable-runtime [--runtime-root <absolute-path>]]\n`);
  process.stdout.write(`  coordinator doctor --recover-isolation <recovery-id> [--json]\n`);
  process.stdout.write(`  coordinator activate [--runtime-root <absolute-path>] [--authority-root <absolute-path>] [--json]\n`);
  process.stdout.write(`  coordinator disable [--runtime-root <absolute-path>] [--json]\n`);
  process.stdout.write(`  coordinator provision [--json]\n`);
  process.stdout.write(`\n--enable-runtime requests a diagnostic candidate; it does not activate the Runtime.\n`);
  process.stdout.write(`provision, activate, and disable command grammar is available, but their filesystem effects are not implemented.\n`);
  process.stdout.write(`CRDD_COORDINATOR_ROOT is used by doctor --enable-runtime, activate, and disable; --runtime-root wins.\n`);
  process.stdout.write(`CRDD_COORDINATOR_AUTHORITY_ROOT has no OS default and is used only by activate.\n`);
}

function printCommandReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Coordinator ${report.command}: ${report.status}\n`);
    process.stdout.write(`- reason: ${report.reason}\n`);
    process.stdout.write(`- filesystem effect issued: no\n`);
  }
}

function runInactiveEffectCommand(command, args) {
  const parsed = command === "activate"
    ? parseActivateArguments(
        args,
        process.env.CRDD_COORDINATOR_ROOT,
        process.env.CRDD_COORDINATOR_AUTHORITY_ROOT
      )
    : parseDisableArguments(args, process.env.CRDD_COORDINATOR_ROOT);
  if (parsed.status !== "ok") {
    const report = Object.freeze({
      status: "blocked",
      command,
      reason: parsed.reason,
      filesystemEffectIssued: false,
      runtimeCapabilityIssued: false
    });
    printCommandReport(report, parsed.jsonRequested);
    process.exitCode = parsed.usageError ? 64 : 2;
    return;
  }
  let selectionValid = false;
  try {
    const runtimeRoot = selectRuntimeRootCandidate({
      repositoryRoot: process.cwd(),
      ...parsed.value.runtimeRootRequest
    });
    const authorityRoot = command === "activate"
      ? selectAuthorityRootCandidate(parsed.value.authorityRootRequest)
      : null;
    selectionValid = runtimeRoot.status === "candidate" &&
      (authorityRoot === null || authorityRoot.status === "candidate");
  } catch {
    selectionValid = false;
  }
  if (!selectionValid) {
    const report = Object.freeze({
      status: "blocked",
      command,
      reason: `${command}_request_invalid`,
      filesystemEffectIssued: false,
      runtimeCapabilityIssued: false
    });
    printCommandReport(report, parsed.value.json);
    process.exitCode = 2;
    return;
  }
  const report = Object.freeze({
    status: "blocked",
    command,
    reason: command === "activate"
      ? "runtime_activation_effect_not_implemented"
      : "runtime_disable_effect_not_implemented",
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false
  });
  printCommandReport(report, parsed.value.json);
  process.exitCode = 2;
}

const [, , command, ...args] = process.argv;

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exitCode = 0;
} else if (command === "activate" || command === "disable") {
  runInactiveEffectCommand(command, args);
} else if (command === "provision") {
  const parsed = parseProvisionArguments(args);
  const report = Object.freeze({
    status: "blocked",
    command,
    reason: parsed.status === "ok"
      ? "platform_provisioner_package_trust_and_effect_not_implemented"
      : parsed.reason,
    dryRunOnly: true,
    npmRegistrySignatureConfirmed: false,
    npmProvenanceConfirmed: false,
    packageFilesystemIdentityConfirmed: false,
    qualLabManifestTrustConfirmed: false,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false
  });
  printCommandReport(report, parsed.status === "ok" ? parsed.value.json : parsed.jsonRequested);
  process.exitCode = parsed.status === "ok" ? 2 : 64;
} else if (command === "doctor") {
  try {
    const parsed = parseDoctorArguments(args, process.env.CRDD_COORDINATOR_ROOT);
    if (parsed.status !== "ok") {
      const error = new Error(parsed.reason);
      error.usage = true;
      throw error;
    }
    const options = parsed.value;
    const report = options.recoveryId !== null
      ? options.recoveryId.startsWith("host.")
        ? recoverOwnedOperationDirectories(options.recoveryId)
        : recoverDockerIsolationProbe(options.recoveryId)
      : runDoctor({
          activeIsolation: options.activeIsolation,
          cwd: process.cwd(),
          runtimeRootRequest: options.runtimeRootRequest
        });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`Coordinator environment: ${report.status}\n`);
      for (const [name, provider] of Object.entries(report.providers ?? {})) {
        process.stdout.write(`- ${name}: ${provider.located ? "located" : "not found"}; active probe not executed\n`);
      }
      if (report.credentials) process.stdout.write(`- credential values recorded: no\n`);
      if (report.filesystem) process.stdout.write(`- filesystem enforcement: ${report.filesystem.enforcement}\n`);
      if (report.egress) process.stdout.write(`- provider egress allowlist: ${report.egress.providerAllowlist}\n`);
      if (report.runtimeRootEvaluation) {
        process.stdout.write(`- runtime root request: ${report.runtimeRootEvaluation.status}; activation not performed\n`);
      }
      if (report.recovery?.manualRecoveryRequired === true) {
        process.stdout.write(`- recovery: automatic recovery ID unavailable; manual safety action required (${report.recovery.reason})\n`);
      } else if (report.recovery?.required === true && report.recovery.recoveryId) {
        process.stdout.write(`- recovery: run doctor --recover-isolation with the returned recovery ID\n`);
      }
      process.stdout.write(`- blockers: ${(report.blockers ?? []).length}\n`);
      for (const blocker of report.blockers ?? []) {
        process.stdout.write(`  - ${blocker.id}: ${blocker.reason}\n`);
      }
    }
    process.exitCode = ["ready", "recovered"].includes(report.status) ? 0 : 2;
  } catch (error) {
    const reason = typeof error?.message === "string" && /^[a-z0-9_]+$/u.test(error.message)
      ? error.message
      : "diagnostic_failed";
    if (args.includes("--json")) {
      process.stdout.write(`${JSON.stringify({ status: "blocked", reason })}\n`);
    } else {
      process.stderr.write(`Coordinator diagnostic failed: ${reason}\n`);
    }
    process.exitCode = error?.usage === true ? 64 : 2;
  }
} else {
  process.stderr.write(`Unknown command\n`);
  printHelp();
  process.exitCode = 64;
}
