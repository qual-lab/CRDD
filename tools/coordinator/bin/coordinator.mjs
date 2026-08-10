#!/usr/bin/env node

import { runDoctor } from "../src/core/doctor.mjs";
import { recoverDockerIsolationProbe } from "../src/security/docker-isolation.mjs";
import { recoverOwnedOperationDirectories } from "../src/security/execution-environment.mjs";

function printHelp() {
  process.stdout.write(`Coordinator Runtime 1.0 (implementation candidate)\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  coordinator doctor [--json] [--isolation]\n`);
  process.stdout.write(`  coordinator doctor --recover-isolation <recovery-id> [--json]\n`);
}

const [, , command, ...args] = process.argv;

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exitCode = 0;
} else if (command === "doctor") {
  try {
    const recoveryIndex = args.indexOf("--recover-isolation");
    const report = recoveryIndex >= 0
      ? String(args[recoveryIndex + 1] ?? "").startsWith("host.")
        ? recoverOwnedOperationDirectories(args[recoveryIndex + 1])
        : recoverDockerIsolationProbe(args[recoveryIndex + 1])
      : runDoctor({ activeIsolation: args.includes("--isolation") });
    if (args.includes("--json")) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`Coordinator environment: ${report.status}\n`);
      for (const [name, provider] of Object.entries(report.providers ?? {})) {
        process.stdout.write(`- ${name}: ${provider.located ? "located" : "not found"}; active probe not executed\n`);
      }
      if (report.credentials) process.stdout.write(`- credential values recorded: no\n`);
      if (report.filesystem) process.stdout.write(`- filesystem enforcement: ${report.filesystem.enforcement}\n`);
      if (report.egress) process.stdout.write(`- provider egress allowlist: ${report.egress.providerAllowlist}\n`);
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
    process.exitCode = 2;
  }
} else {
  process.stderr.write(`Unknown command: ${command}\n`);
  printHelp();
  process.exitCode = 64;
}
