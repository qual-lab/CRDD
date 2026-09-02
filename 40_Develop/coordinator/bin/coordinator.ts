#!/usr/bin/env node

import fs from "node:fs";
import { types as utilTypes } from "node:util";
import {
  parseCandidateArguments,
  parseDoctorArguments,
  parseTaskArguments,
} from "../src/core/cli-options.ts";
import {
  renderSafeHumanCommandReport,
  type SafeCommandReport,
} from "../src/core/command-report.ts";
import { renderDoctorCommandFailure, runDoctor } from "../src/core/doctor.ts";
import { dispatchDockerDesktopRepairDoctorCommand } from "../src/core/docker-desktop-repair-doctor-dispatch.ts";
import { renderDockerRecoveryDoctorReport } from "../src/core/docker-recovery-command-report.ts";
import { isSupportedCoordinatorNodeRuntime } from "../src/core/node-runtime-version.ts";
import {
  bindTaskCliCancellationSignals,
  projectTaskCliCancellationFailure,
} from "../src/core/task-cli-cancellation.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
  recoverRuntimeOwnedCandidateStore,
  runRuntimeOwnedCandidateStoreStartupGc,
} from "../src/security/candidate-bundle-store.ts";
import { parseUnambiguousJsonDocument } from "../src/security/claude-structured-result.ts";
import { runMcpProjectRuntimeStdio } from "../src/security/mcp-project-runtime-stdio.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
} from "../src/security/project-runtime-public-runtime.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../src/security/project-runtime-windows-decision-store.ts";
import { recoverDockerIsolationProbe } from "../src/security/docker-isolation.ts";
import {
  closeRuntimeOwnedWindowsDockerDesktopRepair,
  adoptRuntimeOwnedWindowsDockerDesktopRepair,
  repairRuntimeOwnedWindowsDockerDesktopRuntime,
} from "../src/security/docker-desktop-runtime-repair.ts";
import {
  inspectRuntimeOwnedDockerTaskRecoveryState,
  recoverRuntimeOwnedDockerTask,
  recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart,
} from "../src/security/docker-recovery-runtime.ts";
import { recoverOwnedOperationDirectories } from "../src/security/execution-environment.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../src/security/repository-root-resolution.ts";

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

function printHelp() {
  process.stdout.write(`Coordinator Runtime 1.0\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(
    `  coordinator task --request-stdin [--json]  # verifies prerequisites per operation\n`,
  );
  process.stdout.write(`  coordinator capabilities --json\n`);
  process.stdout.write(
    `  coordinator mcp --stdio  # v0.19 development candidate\n`,
  );
  process.stdout.write(`  coordinator doctor [--json] [--isolation]\n`);
  process.stdout.write(
    `  coordinator doctor --recover-isolation <recovery-id> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --recover-isolation <docker-task-recovery-id> --after-docker-desktop-repair <repair-id> --from-release <absolute-root> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --repair-docker-desktop-runtime [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --close-docker-desktop-runtime-repair <repair-id> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --adopt-docker-desktop-repair <repair-id> --from-release <absolute-root> [--json]\n`,
  );
  process.stdout.write(
    `    Windows only; explicit last-resort repair for the fixed known Docker Desktop failure. Never an automatic fallback and never deletes the retained run directory.\n`,
  );
  process.stdout.write(
    `  coordinator candidate export --candidate-id <opaque-id> --json\n`,
  );
  process.stdout.write(
    `  coordinator candidate discard --candidate-id <candidate-or-recovery-id> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator candidate recover-store --recovery-id <store-recovery-id> --confirm [--json]\n`,
  );
  process.stdout.write(`\nNormal Task use starts with task.\n`);
}

function runCapabilitiesCommand(args: readonly string[]) {
  if (args.length !== 1 || args[0] !== "--json") {
    process.stderr.write("Usage: coordinator capabilities --json\n");
    process.exitCode = 64;
    return;
  }
  process.stdout.write(
    `${JSON.stringify({
      contract: "crdd-coordinator/capabilities",
      contractRevision: 2,
      profile: "local_personal",
      commands: Object.freeze([
        Object.freeze({
          command: "task",
          availability: "available",
          invocation: "task --request-stdin --json",
        }),
        Object.freeze({ command: "doctor", availability: "available" }),
        Object.freeze({ command: "candidate", availability: "available" }),
        Object.freeze({
          command: "project",
          availability: "development_candidate",
          invocation: "project --request-stdin --json",
        }),
        Object.freeze({
          command: "mcp",
          availability: "development_candidate",
          invocation: "mcp --stdio",
          operations: Object.freeze([
            "crdd.run_objective",
            "crdd.submit_decision",
          ]),
        }),
      ]),
    })}\n`,
  );
  process.exitCode = 0;
}

async function runProjectCommand(args: readonly string[]) {
  if (
    args.length !== 2 ||
    args[0] !== "--request-stdin" ||
    args[1] !== "--json"
  ) {
    printCommandReport(
      Object.freeze({
        command: "project",
        status: "blocked",
        reason: "project_arguments_invalid",
      }),
      true,
    );
    process.exitCode = 64;
    return;
  }
  let request: unknown;
  try {
    request = readBoundedTaskRequestFromStdin();
  } catch (rawError) {
    printCommandReport(
      Object.freeze({
        command: "project",
        status: "blocked",
        reason:
          rawError instanceof UsageError
            ? rawError.message
            : "project_request_invalid",
      }),
      true,
    );
    process.exitCode = rawError instanceof UsageError ? 64 : 2;
    return;
  }
  const controller = new AbortController();
  const binding = bindTaskCliCancellationSignals(async () =>
    controller.abort(),
  );
  let result: Awaited<ReturnType<typeof runProjectRuntimePublicObjective>>;
  let released: ReturnType<typeof binding.unbind> | undefined;
  try {
    result = await runProjectRuntimePublicObjective(request, controller.signal);
  } finally {
    released = binding.unbind();
  }
  if (binding.status !== "bound" || released.status !== "released") {
    printCommandReport(
      Object.freeze({
        command: "project",
        status: "blocked",
        reason: "project_cli_cancellation_binding_failed",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      }),
      true,
    );
    process.exitCode = 2;
    return;
  }
  process.stdout.write(
    `${JSON.stringify({ command: "project", ...result })}\n`,
  );
  process.exitCode = result.status === "completed" ? 0 : 2;
}

async function runMcpCommand(args: readonly string[]) {
  if (args.length !== 1 || args[0] !== "--stdio") {
    process.stderr.write("Usage: coordinator mcp --stdio\n");
    process.exitCode = 64;
    return;
  }
  const result = await runMcpProjectRuntimeStdio(
    {
      authenticateClient: () => {
        const observed = openRuntimeOwnedWindowsProjectDecisionStore();
        return observed.status === "completed"
          ? Object.freeze({
              status: "verified",
              principalId: observed.principalId,
            })
          : Object.freeze({ status: "unknown" });
      },
      runObjective: (request, signal, authentication) =>
        runProjectRuntimePublicObjective(
          request,
          signal,
          process.cwd(),
          authentication,
        ),
      submitDecision: async (request, authentication) =>
        runProjectRuntimePublicDecision(request, process.cwd(), authentication),
    },
    process.stdin,
    process.stdout,
  );
  process.exitCode = result.status === "completed" ? 0 : 2;
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
  let taskRequest: unknown;
  try {
    taskRequest = readBoundedTaskRequestFromStdin();
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
  const packageVerification =
    issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
      evaluationTime: new Date().toISOString(),
    });
  if (!packageVerification.capability) {
    printCommandReport(
      Object.freeze({
        command: "task",
        status: "blocked",
        reason: "coordinator_task_release_verification_required",
      }),
      options.json,
    );
    process.exitCode = 2;
    return;
  }
  let started: ReturnType<typeof startRuntimeOwnedCoordinatorTask>;
  try {
    started = startRuntimeOwnedCoordinatorTask(
      taskRequest,
      resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
      packageVerification.capability,
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
  let result: Awaited<typeof started.completion>;
  let releaseStatus:
    | Readonly<{
        status: "released" | "failed";
        failedSignals: readonly ("SIGINT" | "SIGTERM")[];
      }>
    | undefined;
  const cancellationBinding = bindTaskCliCancellationSignals(() =>
    cancelRuntimeOwnedCoordinatorTask(started.controlCapability),
  );
  try {
    result = await started.completion;
  } finally {
    releaseStatus = cancellationBinding.unbind();
  }
  if (
    cancellationBinding.status !== "bound" ||
    releaseStatus?.status !== "released"
  ) {
    const failureReport = projectTaskCliCancellationFailure(
      result,
      cancellationBinding.status !== "bound"
        ? "task_cli_cancellation_signal_binding_failed"
        : "task_cli_cancellation_signal_release_failed",
    );
    printCommandReport(failureReport, options.json);
    process.exitCode = 2;
    return;
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ command: "task", ...result })}\n`);
  } else {
    printCommandReport(
      Object.freeze({
        command: "task",
        ...result,
      }),
      false,
    );
  }
  process.exitCode = result.status === "completed" ? 0 : 2;
}

function runCandidateCommand(args: readonly string[]) {
  const parsed = parseCandidateArguments(args);
  const options = plainRecord(parsed.value);
  if (
    parsed.status !== "ok" ||
    !options ||
    (options.action !== "export" &&
      options.action !== "discard" &&
      options.action !== "recover-store") ||
    (options.action === "recover-store"
      ? typeof options.recoveryId !== "string"
      : typeof options.candidateId !== "string") ||
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
  const startupGc =
    options.action === "export"
      ? runRuntimeOwnedCandidateStoreStartupGc()
      : Object.freeze({ status: "completed" as const });
  if (startupGc.status !== "completed") {
    printCommandReport(
      Object.freeze({
        command: `candidate ${options.action}`,
        ...startupGc,
      }),
      options.json,
    );
    process.exitCode = 2;
    return;
  }
  const result =
    options.action === "export"
      ? readRuntimeOwnedCandidateBundle(options.candidateId)
      : options.action === "discard"
        ? discardRuntimeOwnedCandidateBundle(options.candidateId)
        : recoverRuntimeOwnedCandidateStore(options.recoveryId);
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
        ...result,
        command: `candidate ${options.action}`,
        status,
        reason:
          status === "exported"
            ? "candidate_exported"
            : status === "discarded"
              ? "candidate_discarded"
              : status === "recovered"
                ? "candidate_store_recovered"
                : typeof resultRecord?.reason === "string"
                  ? resultRecord.reason
                  : "candidate_not_available_or_integrity_unconfirmed",
      }),
      false,
    );
  }
  process.exitCode = ["exported", "discarded", "recovered"].includes(status)
    ? 0
    : 2;
}

function printCommandReport(
  report: SafeCommandReport,
  shouldOutputJson: boolean,
) {
  if (shouldOutputJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderSafeHumanCommandReport(report));
  }
}

const [, , command, ...args] = process.argv;

if (!isSupportedCoordinatorNodeRuntime(process.versions.node)) {
  const report = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_node_version_unsupported",
  });
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } else {
    process.stderr.write(
      "Coordinator Runtime requires a preverified Node.js 24.12.0 or newer executable.\n",
    );
  }
  process.exitCode = 2;
} else if (
  !command ||
  command === "help" ||
  command === "--help" ||
  command === "-h"
) {
  printHelp();
  process.exitCode = 0;
} else if (command === "task") {
  await runTaskCommand(args);
} else if (command === "project") {
  await runProjectCommand(args);
} else if (command === "mcp") {
  await runMcpCommand(args);
} else if (command === "capabilities") {
  runCapabilitiesCommand(args);
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
      typeof options.activeIsolation !== "boolean" ||
      typeof options.repairDockerDesktopRuntime !== "boolean" ||
      (options.closeDockerDesktopRepairId !== null &&
        typeof options.closeDockerDesktopRepairId !== "string")
    ) {
      throw new UsageError("doctor_arguments_invalid");
    }
    let recoveryId: string | null;
    if (recoveryIdValue === null) recoveryId = null;
    else if (typeof recoveryIdValue === "string") recoveryId = recoveryIdValue;
    else throw new UsageError("doctor_arguments_invalid");
    const dockerRepair = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json: options.json,
        repairDockerDesktopRuntime: options.repairDockerDesktopRuntime,
        closeDockerDesktopRepairId: options.closeDockerDesktopRepairId,
        ...(typeof options.adoptDockerDesktopRepairId === "string" &&
        typeof options.historicalReleaseRoot === "string"
          ? {
              adoptDockerDesktopRepairId: options.adoptDockerDesktopRepairId,
              historicalReleaseRoot: options.historicalReleaseRoot,
            }
          : {}),
      },
      {
        repair: repairRuntimeOwnedWindowsDockerDesktopRuntime,
        close: closeRuntimeOwnedWindowsDockerDesktopRepair,
        adopt: adoptRuntimeOwnedWindowsDockerDesktopRepair,
      },
    );
    if (dockerRepair) {
      process.stdout.write(dockerRepair.stdout);
      process.exitCode = dockerRepair.exitCode;
    } else {
      const report: unknown =
        recoveryId !== null
          ? recoveryId.startsWith("host.")
            ? recoverOwnedOperationDirectories(recoveryId)
            : recoveryId.startsWith("docker-task.")
              ? typeof options.afterDockerDesktopRepairId === "string" &&
                typeof options.historicalReleaseRoot === "string"
                ? recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart(
                    recoveryId,
                    options.afterDockerDesktopRepairId,
                    options.historicalReleaseRoot,
                  )
                : recoverRuntimeOwnedDockerTask(recoveryId)
              : recoverDockerIsolationProbe(recoveryId)
          : Object.freeze({
              ...runDoctor({
                activeIsolation: options.activeIsolation,
                cwd: resolveVerifiedRepositoryRootFromWorkingDirectory(
                  process.cwd(),
                ),
              }),
              dockerTaskRecovery: inspectRuntimeOwnedDockerTaskRecoveryState(),
            });
      const rendered = renderDockerRecoveryDoctorReport(report, options.json);
      process.stdout.write(rendered.stdout);
      process.exitCode = rendered.exitCode;
    }
  } catch (rawError) {
    const doctorFailure = renderDoctorCommandFailure(rawError);
    if (args.includes("--json")) {
      process.stdout.write(doctorFailure.json);
    } else {
      process.stderr.write(doctorFailure.human);
    }
    process.exitCode =
      rawError instanceof UsageError ? 64 : doctorFailure.exitCode;
  }
} else {
  process.stderr.write(`Unknown command\n`);
  printHelp();
  process.exitCode = 64;
}
