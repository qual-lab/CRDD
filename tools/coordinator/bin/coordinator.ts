#!/usr/bin/env node

import fs from "node:fs";
import { types as utilTypes } from "node:util";

import { runDoctor } from "../src/core/doctor.ts";
import {
  parseActivateArguments,
  parseCandidateArguments,
  parseDisableArguments,
  parseDoctorArguments,
  parseProvisionArguments,
  parseTaskArguments,
} from "../src/core/cli-options.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../src/security/candidate-bundle-store.ts";
import { parseUnambiguousJsonDocument } from "../src/security/claude-structured-result.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import { selectAuthorityRootCandidate } from "../src/security/authority-root-profile.ts";
import { recoverDockerIsolationProbe } from "../src/security/docker-isolation.ts";
import { recoverOwnedOperationDirectories } from "../src/security/execution-environment.ts";
import { runPlatformProvisionerEffect } from "../src/security/platform-provisioner-effect.ts";
import { selectRuntimeRootCandidate } from "../src/security/runtime-root-profile.ts";

type EffectCommand = "activate" | "disable";
type CommandReport = Readonly<{
  command: string;
  status: string;
  reason: string;
  filesystemEffectIssued?: boolean;
}>;

class UsageError extends Error {
  readonly usage = true;
}

const MAXIMUM_TASK_REQUEST_BYTES = 128 * 1024;

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
  const snapshotValues: unknown[] = [];
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
    snapshotValues.push(descriptor.value);
  }
  return Object.freeze(snapshotValues);
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
    `  coordinator task --request-stdin [--json]  # repository is the current directory\n`,
  );
  process.stdout.write(
    `  coordinator candidate export --candidate-id <opaque-id> --json\n`,
  );
  process.stdout.write(
    `  coordinator candidate discard --candidate-id <candidate-or-recovery-id> [--json]\n`,
  );
  process.stdout.write(
    `\n--enable-runtime requests a diagnostic candidate; it does not activate the Runtime.\n`,
  );
  process.stdout.write(
    `provision command grammar is an implementation candidate; the Provision Effect is not implemented and is blocked before distribution reads, time access, path resolution, or filesystem effects. activate and disable effects are not implemented.\n`,
  );
  process.stdout.write(
    `CRDD_COORDINATOR_ROOT is used by doctor --enable-runtime, activate, and disable; --runtime-root wins.\n`,
  );
  process.stdout.write(
    `CRDD_COORDINATOR_AUTHORITY_ROOT has no OS default and is used only by activate.\n`,
  );
}

function readBoundedTaskRequestFromStdin() {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const buffer = Buffer.alloc(8 * 1024);
  for (;;) {
    const readBytes = fs.readSync(0, buffer, 0, buffer.length, null);
    if (readBytes === 0) break;
    totalBytes += readBytes;
    if (totalBytes > MAXIMUM_TASK_REQUEST_BYTES) {
      throw new UsageError("task_request_too_large");
    }
    chunks.push(Buffer.from(buffer.subarray(0, readBytes)));
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, totalBytes),
    );
  } catch {
    throw new UsageError("task_request_invalid_utf8");
  }
  const parsed = parseUnambiguousJsonDocument(source);
  if (!parsed) throw new UsageError("task_request_invalid_json");
  return parsed;
}

async function runTaskCommand(args: readonly string[]) {
  const parsed = parseTaskArguments(args);
  const options = plainRecord(parsed.value);
  if (
    parsed.status !== "ok" ||
    !options ||
    options.requestFromStdin !== true ||
    typeof options.json !== "boolean"
  ) {
    const report = Object.freeze({
      command: "task",
      status: "blocked",
      reason: parsed.reason ?? "task_arguments_invalid",
    });
    printCommandReport(report, parsed.jsonRequested);
    process.exitCode = parsed.usageError ? 64 : 2;
    return;
  }
  let started: ReturnType<typeof startRuntimeOwnedCoordinatorTask>;
  try {
    started = startRuntimeOwnedCoordinatorTask(
      readBoundedTaskRequestFromStdin(),
      process.cwd(),
    );
  } catch (rawError) {
    const reason =
      rawError instanceof UsageError
        ? rawError.message
        : "coordinator_task_start_failed_closed";
    printCommandReport(
      Object.freeze({ command: "task", status: "blocked", reason }),
      options.json,
    );
    process.exitCode = rawError instanceof UsageError ? 64 : 2;
    return;
  }
  const cancel = () => {
    void cancelRuntimeOwnedCoordinatorTask(started.controlCapability);
  };
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const result = await started.completion;
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ command: "task", ...result })}\n`,
      );
    } else {
      printCommandReport(
        Object.freeze({
          command: "task",
          status: result.status,
          reason: result.reason,
        }),
        false,
      );
    }
    process.exitCode = result.status === "completed" ? 0 : 2;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}

function runCandidateCommand(args: readonly string[]) {
  const parsed = parseCandidateArguments(args);
  const options = plainRecord(parsed.value);
  if (
    parsed.status !== "ok" ||
    !options ||
    (options.action !== "export" && options.action !== "discard") ||
    typeof options.candidateId !== "string" ||
    typeof options.json !== "boolean"
  ) {
    printCommandReport(
      Object.freeze({
        command: "candidate",
        status: "blocked",
        reason: parsed.reason ?? "candidate_arguments_invalid",
      }),
      parsed.jsonRequested,
    );
    process.exitCode = parsed.usageError ? 64 : 2;
    return;
  }
  const result =
    options.action === "export"
      ? readRuntimeOwnedCandidateBundle(options.candidateId)
      : discardRuntimeOwnedCandidateBundle(options.candidateId);
  if (!result) {
    printCommandReport(
      Object.freeze({
        command: `candidate ${options.action}`,
        status: "blocked",
        reason: "candidate_not_available_or_integrity_unconfirmed",
      }),
      options.json,
    );
    process.exitCode = 2;
    return;
  }
  const resultRecord = plainRecord(result);
  const status =
    typeof resultRecord?.status === "string" ? resultRecord.status : "blocked";
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        command: `candidate ${options.action}`,
        ...result,
        candidateContentUntrusted: options.action === "export",
        credentialAbsenceVerified: false,
      })}\n`,
    );
  } else {
    printCommandReport(
      Object.freeze({
        command: `candidate ${options.action}`,
        status,
        reason:
          status === "discarded"
            ? "candidate_discarded"
            : "candidate_not_available_or_integrity_unconfirmed",
      }),
      false,
    );
  }
  process.exitCode = ["exported", "discarded"].includes(status) ? 0 : 2;
}

function printCommandReport(report: CommandReport, shouldOutputJson: boolean) {
  if (shouldOutputJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Coordinator ${report.command}: ${report.status}\n`);
    process.stdout.write(`- reason: ${report.reason}\n`);
    process.stdout.write(
      `- filesystem effect issued: ${report.filesystemEffectIssued === true ? "yes" : "no"}\n`,
    );
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
  let isSelectionValid = false;
  try {
    const runtimeRoot = selectRuntimeRootCandidate({
      repositoryRoot: process.cwd(),
      ...plainRecord(parsedValue.runtimeRootRequest),
    });
    const authorityRoot =
      command === "activate"
        ? selectAuthorityRootCandidate(parsedValue.authorityRootRequest)
        : null;
    isSelectionValid =
      runtimeRoot.status === "candidate" &&
      (authorityRoot === null || authorityRoot.status === "candidate");
  } catch {
    isSelectionValid = false;
  }
  if (!isSelectionValid) {
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
  const isParsed =
    parsed.status === "ok" &&
    parsedValue &&
    typeof parsedValue.json === "boolean";
  const effect = isParsed ? runPlatformProvisionerEffect() : null;
  const report = Object.freeze(
    effect
      ? { command, ...effect }
      : {
          status: "blocked",
          command,
          reason:
            typeof parsed.reason === "string"
              ? parsed.reason
              : "provision_arguments_invalid",
          crddDistributionConfirmed: false,
          qualLabManifestTrustConfirmed: false,
          filesystemEffectIssued: false,
          runtimeCapabilityIssued: false,
        },
  );
  const isJsonRequested =
    isParsed && typeof parsedValue.json === "boolean"
      ? parsedValue.json
      : parsed.jsonRequested;
  printCommandReport(report, isJsonRequested);
  process.exitCode = !isParsed ? 64 : 2;
} else if (command === "task") {
  await runTaskCommand(args);
} else if (command === "candidate") {
  runCandidateCommand(args);
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
