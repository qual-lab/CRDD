#!/usr/bin/env node

import { runDoctor } from "../src/core/doctor.mjs";

function printHelp() {
  process.stdout.write(`Coordinator Runtime 1.0 (implementation candidate)\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  coordinator doctor [--json]\n`);
}

const [, , command, ...args] = process.argv;

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exitCode = 0;
} else if (command === "doctor") {
  const report = runDoctor();
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Coordinator environment: ${report.status}\n`);
    for (const [name, provider] of Object.entries(report.providers)) {
      const state = provider.gate.ready ? "ready" : "blocked";
      process.stdout.write(`- ${name}: ${state}`);
      if (provider.gate.blockers.length > 0) {
        process.stdout.write(` (${provider.gate.blockers.join(", ")})`);
      }
      process.stdout.write("\n");
    }
    process.stdout.write(`- credential values recorded: no\n`);
    process.stdout.write(`- filesystem enforcement: ${report.filesystem.enforcement}\n`);
    process.stdout.write(`- provider egress allowlist: ${report.egress.providerAllowlist}\n`);
  }
  process.exitCode = report.status === "ready" ? 0 : 2;
} else {
  process.stderr.write(`Unknown command: ${command}\n`);
  printHelp();
  process.exitCode = 64;
}
