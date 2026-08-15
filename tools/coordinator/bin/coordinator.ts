#!/usr/bin/env node

import { types as utilTypes } from "node:util";

import { runDoctor } from "../src/core/doctor.ts";
import {
  parseActivateArguments,
  parseDisableArguments,
  parseDoctorArguments,
  parseProvisionArguments,
} from "../src/core/cli-options.ts";
import { selectAuthorityRootCandidate } from "../src/security/authority-root-profile.ts";
import { recoverDockerIsolationProbe } from "../src/security/docker-isolation.ts";
import { recoverOwnedOperationDirectories } from "../src/security/execution-environment.ts";
import { selectRuntimeRootCandidate } from "../src/security/runtime-root-profile.ts";

type EffectCommand = "activate" | "disable";
type CommandReport = Readonly<{
  command: string;
  status: string;
  reason: string;
}>;

class UsageError extends Error {
  readonly usage = true;
}

function plainRecord(raw: unknown): Readonly<Record<string, unknown>> | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    utilTypes.isProxy(raw)
  )
    return null;
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== "string") return null;
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !descriptor.enumerable
    )
      return null;
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

function plainArray(raw: unknown): readonly unknown[] {
  if (
    !Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Array.prototype
  )
    return Object.freeze([]);
  const length = Object.getOwnPropertyDescriptor(raw, "length");
  if (
    !length ||
    !Object.hasOwn(length, "value") ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0
  )
    return Object.freeze([]);
  const result: unknown[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !descriptor.enumerable
    )
      return Object.freeze([]);
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function printHelp() {
  process.stdout.write(
    `Coordinator Runtime 1.0 (implementation candidate)\n\n`,
  );
  process.stdout.write(`Usage:\n`);
  process.stdout.write(
    `  coordinator doctor [--json] [--isolation] [--enable-runtime [--runtime-root <absolute-path>]]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --recover-isolation <recovery-id> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator activate [--runtime-root <absolute-path>] [--authority-root <absolute-path>] [--json]\n`,
  );
  process.stdout.write(
    `  coordinator disable [--runtime-root <absolute-path>] [--json]\n`,
  );
  process.stdout.write(`  coordinator provision [--json]\n`);
  process.stdout.write(
    `\n--enable-runtime requests a diagnostic candidate; it does not activate the Runtime.\n`,
  );
  process.stdout.write(
    `provision, activate, and disable command grammar is available, but their filesystem effects are not implemented.\n`,
  );
  process.stdout.write(
    `CRDD_COORDINATOR_ROOT is used by doctor --enable-runtime, activate, and disable; --runtime-root wins.\n`,
  );
  process.stdout.write(
    `CRDD_COORDINATOR_AUTHORITY_ROOT has no OS default and is used only by activate.\n`,
  );
}

function printCommandReport(report: CommandReport, json: boolean) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Coordinator ${report.command}: ${report.status}\n`);
    process.stdout.write(`- reason: ${report.reason}\n`);
    process.stdout.write(`- filesystem effect issued: no\n`);
  }
}

function runInactiveEffectCommand(
  command: EffectCommand,
  args: readonly string[],
) {
  const parsed =
    command === "activate"
      ? parseActivateArguments(
          args,
          process.env.CRDD_COORDINATOR_ROOT,
          process.env.CRDD_COORDINATOR_AUTHORITY_ROOT,
        )
      : parseDisableArguments(args, process.env.CRDD_COORDINATOR_ROOT);
  if (parsed.status !== "ok") {
    const reason =
      typeof parsed.reason === "string"
        ? parsed.reason
        : `${command}_arguments_invalid`;
    const report = Object.freeze({
      status: "blocked",
      command,
      reason,
      filesystemEffectIssued: false,
      runtimeCapabilityIssued: false,
    });
    printCommandReport(report, parsed.jsonRequested);
    process.exitCode = parsed.usageError ? 64 : 2;
    return;
  }
  const parsedValue = plainRecord(parsed.value);
  if (!parsedValue || typeof parsedValue.json !== "boolean") {
    throw new Error(`${command}_arguments_invalid`);
  }
  let selectionValid = false;
  try {
    const runtimeRoot = selectRuntimeRootCandidate({
      repositoryRoot: process.cwd(),
      ...plainRecord(parsedValue.runtimeRootRequest),
    });
    const authorityRoot =
      command === "activate"
        ? selectAuthorityRootCandidate(parsedValue.authorityRootRequest)
        : null;
    selectionValid =
      runtimeRoot.status === "candidate" &&
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
      runtimeCapabilityIssued: false,
    });
    printCommandReport(report, parsedValue.json);
    process.exitCode = 2;
    return;
  }
  const report = Object.freeze({
    status: "blocked",
    command,
    reason:
      command === "activate"
        ? "runtime_activation_effect_not_implemented"
        : "runtime_disable_effect_not_implemented",
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false,
  });
  printCommandReport(report, parsedValue.json);
  process.exitCode = 2;
}

const [, , command, ...args] = process.argv;

if (
  !command ||
  command === "help" ||
  command === "--help" ||
  command === "-h"
) {
  printHelp();
  process.exitCode = 0;
} else if (command === "activate" || command === "disable") {
  runInactiveEffectCommand(command, args);
} else if (command === "provision") {
  const parsed = parseProvisionArguments(args);
  const parsedValue = plainRecord(parsed.value);
  const parsedOk =
    parsed.status === "ok" &&
    parsedValue &&
    typeof parsedValue.json === "boolean";
  const report = Object.freeze({
    status: "blocked",
    command,
    reason: parsedOk
      ? "platform_provisioner_crdd_bundle_trust_and_effect_not_implemented"
      : typeof parsed.reason === "string"
        ? parsed.reason
        : "provision_arguments_invalid",
    dryRunOnly: true,
    crddDistributionConfirmed: false,
    packageFilesystemIdentityConfirmed: false,
    qualLabManifestTrustConfirmed: false,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false,
  });
  const jsonRequested =
    parsedOk && typeof parsedValue.json === "boolean"
      ? parsedValue.json
      : parsed.jsonRequested;
  printCommandReport(report, jsonRequested);
  process.exitCode = parsedOk ? 2 : 64;
} else if (command === "doctor") {
  try {
    const parsed = parseDoctorArguments(
      args,
      process.env.CRDD_COORDINATOR_ROOT,
    );
    if (parsed.status !== "ok") {
      throw new UsageError(
        typeof parsed.reason === "string"
          ? parsed.reason
          : "doctor_arguments_invalid",
      );
    }
    const options = plainRecord(parsed.value);
    const recoveryIdValue = options?.recoveryId;
    if (
      !options ||
      typeof options.json !== "boolean" ||
      typeof options.activeIsolation !== "boolean"
    ) {
      throw new UsageError("doctor_arguments_invalid");
    }
    let recoveryId: string | null;
    if (recoveryIdValue === null) recoveryId = null;
    else if (typeof recoveryIdValue === "string") recoveryId = recoveryIdValue;
    else throw new UsageError("doctor_arguments_invalid");
    const report: unknown =
      recoveryId !== null
        ? recoveryId.startsWith("host.")
          ? recoverOwnedOperationDirectories(recoveryId)
          : recoverDockerIsolationProbe(recoveryId)
        : runDoctor({
            activeIsolation: options.activeIsolation,
            cwd: process.cwd(),
            runtimeRootRequest: options.runtimeRootRequest,
          });
    const reportValue = plainRecord(report);
    if (!reportValue || typeof reportValue.status !== "string") {
      throw new Error("diagnostic_failed");
    }
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`Coordinator environment: ${reportValue.status}\n`);
      const providers = plainRecord(reportValue.providers);
      for (const [name, providerValue] of Object.entries(providers ?? {})) {
        const provider = plainRecord(providerValue);
        process.stdout.write(
          `- ${name}: ${provider?.located === true ? "located" : "not found"}; active probe not executed\n`,
        );
      }
      if (reportValue.credentials)
        process.stdout.write(`- credential values recorded: no\n`);
      const filesystem = plainRecord(reportValue.filesystem);
      if (typeof filesystem?.enforcement === "string") {
        process.stdout.write(
          `- filesystem enforcement: ${filesystem.enforcement}\n`,
        );
      }
      const egress = plainRecord(reportValue.egress);
      if (typeof egress?.providerAllowlist === "string") {
        process.stdout.write(
          `- provider egress allowlist: ${egress.providerAllowlist}\n`,
        );
      }
      const runtimeRootEvaluation = plainRecord(
        reportValue.runtimeRootEvaluation,
      );
      if (typeof runtimeRootEvaluation?.status === "string") {
        process.stdout.write(
          `- runtime root request: ${runtimeRootEvaluation.status}; activation not performed\n`,
        );
      }
      const recovery = plainRecord(reportValue.recovery);
      if (recovery?.manualRecoveryRequired === true) {
        const recoveryReason =
          typeof recovery.reason === "string" ? recovery.reason : "unknown";
        process.stdout.write(
          `- recovery: automatic recovery ID unavailable; manual safety action required (${recoveryReason})\n`,
        );
      } else if (
        recovery?.required === true &&
        typeof recovery.recoveryId === "string"
      ) {
        process.stdout.write(
          `- recovery: run doctor --recover-isolation with the returned recovery ID\n`,
        );
      }
      const blockers = plainArray(reportValue.blockers);
      process.stdout.write(`- blockers: ${blockers.length}\n`);
      for (const blockerValue of blockers) {
        const blocker = plainRecord(blockerValue);
        if (
          typeof blocker?.id === "string" &&
          typeof blocker.reason === "string"
        ) {
          process.stdout.write(`  - ${blocker.id}: ${blocker.reason}\n`);
        }
      }
    }
    process.exitCode = ["ready", "recovered"].includes(reportValue.status)
      ? 0
      : 2;
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : undefined;
    const reason =
      typeof message === "string" && /^[a-z0-9_]+$/u.test(message)
        ? message
        : "diagnostic_failed";
    if (args.includes("--json")) {
      process.stdout.write(
        `${JSON.stringify({ status: "blocked", reason })}\n`,
      );
    } else {
      process.stderr.write(`Coordinator diagnostic failed: ${reason}\n`);
    }
    process.exitCode = rawError instanceof UsageError ? 64 : 2;
  }
} else {
  process.stderr.write(`Unknown command\n`);
  printHelp();
  process.exitCode = 64;
}
