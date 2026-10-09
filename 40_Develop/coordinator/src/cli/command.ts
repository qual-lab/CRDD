#!/usr/bin/env node
/**
 * coordinatorに属する責務をまとめる。
 *
 * @responsibility UsageErrorを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

import { types as utilTypes } from "node:util";
import {
  UsageError,
  readBoundedTaskRequestFromStdin,
} from "./request-input.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  parseCandidateArguments,
  parseDoctorArguments,
  parseTaskArguments,
} from "./options.ts";
import { printCommandReport } from "./command-report.ts";
import { dispatchDockerDesktopRepairDoctorCommand } from "../diagnostics/docker-desktop-repair-doctor-dispatch.ts";
import { renderDockerRecoveryDoctorReport } from "../diagnostics/docker-recovery-command-report.ts";
import {
  renderDoctorCommandFailure,
  runDoctor,
} from "../diagnostics/doctor.ts";
import { isSupportedCoordinatorNodeRuntime } from "../host-execution/node-runtime-version.ts";
import {
  bindTaskCliCancellationSignals,
  projectTaskCliCancellationFailure,
} from "./task-cancellation.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
  recoverRuntimeOwnedCandidateStore,
  runRuntimeOwnedCandidateStoreStartupGc,
} from "../candidate/bundle-store.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../task/execution.ts";
import {
  adoptRuntimeOwnedWindowsDockerDesktopRepair,
  closeRuntimeOwnedWindowsDockerDesktopRepair,
  repairRuntimeOwnedWindowsDockerDesktopRuntime,
} from "../docker-desktop/repair.ts";
import { recoverDockerIsolationProbe } from "../docker-execution/isolation-probe.ts";
import {
  inspectRuntimeOwnedDockerTaskRecoveryState,
  recoverRuntimeOwnedDockerTask,
  recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart,
  recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart,
} from "../docker-execution/recovery-lifecycle.ts";
import { restartRuntimeOwnedDockerForRecovery } from "../docker-desktop/restart-recovery.ts";
import { recoverOwnedOperationDirectories } from "../host-execution/operation-workspace-lifecycle.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../platform-access/package-verification.ts";

/**
 * 記録をPlain Dataとして検証する。
 *
 * @responsibility 記録の許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「raw: unknown」がplainRecordの入力契約を満たす。
 * @postcondition plainRecordの責務を完了した結果だけを返す。
 * @effect N/A: plainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainRecordは独自の失敗分岐を所有しない。
 * @invariant plainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: plainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainRecordは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Helpを人間向け表示へ出力する。
 *
 * @responsibility Helpの表示内容、機密除外、出力先境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: printHelpは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がprintHelpの入力契約を満たす。
 * @postcondition printHelpの責務を完了して呼出し元へ制御を戻す。
 * @effect printHelpは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: printHelpは独自の失敗分岐を所有しない。
 * @invariant printHelpは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: printHelpはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: printHelpは共有非同期状態を持たない同期処理である。
 */
function printHelp() {
  process.stdout.write(`Coordinator Runtime 1.0\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(
    `  coordinator task --request-stdin [--json]  # verifies prerequisites per operation\n`,
  );
  process.stdout.write(`  coordinator capabilities --json\n`);
  process.stdout.write(`  coordinator doctor [--json] [--isolation]\n`);
  process.stdout.write(
    `  coordinator doctor --recover-isolation <recovery-id> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --restart-docker-for-recovery <docker-task-recovery-id> [--restart-origin-release-root <absolute-root>] [--json]\n`,
  );
  process.stdout.write(
    `    --restart-origin-release-root supplies a task-origin distribution candidate for verification; the path itself grants no authority and is not --repair-release-root.\n`,
  );
  process.stdout.write(
    `  coordinator doctor --recover-isolation <docker-task-recovery-id> --after-recorded-docker-restart [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --recover-isolation <docker-task-recovery-id> --after-docker-desktop-repair <repair-id> --repair-release-root <absolute-root> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --repair-docker-desktop-runtime [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --close-docker-desktop-runtime-repair <repair-id> [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --adopt-docker-desktop-repair <repair-id> --repair-release-root <absolute-root> [--json]\n`,
  );
  process.stdout.write(
    `    --repair-release-root is the signed distribution root that issued the named Docker Desktop repair record; it is not the Docker task origin.\n`,
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

/**
 * Capabilities Commandを実行する。
 *
 * @responsibility Capabilities Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns runCapabilitiesCommandの計算結果を返す。
 * @precondition 「args: readonly string[]」がrunCapabilitiesCommandの入力契約を満たす。
 * @postcondition runCapabilitiesCommandの責務を完了した結果だけを返す。
 * @effect runCapabilitiesCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runCapabilitiesCommandは独自の失敗分岐を所有しない。
 * @invariant runCapabilitiesCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runCapabilitiesCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runCapabilitiesCommandは共有非同期状態を持たない同期処理である。
 */
function runCapabilitiesCommand(args: readonly string[]) {
  if (args.length !== 1 || args[0] !== "--json") {
    process.stderr.write("Usage: coordinator capabilities --json\n");
    process.exitCode = 64;
    return;
  }
  process.stdout.write(
    `${JSON.stringify({
      contract: "crdd-coordinator/capabilities",
      contractRevision: 4,
      profile: "local_personal",
      commands: Object.freeze([
        Object.freeze({
          command: "task",
          availability: "available",
          invocation: "task --request-stdin --json",
        }),
        Object.freeze({ command: "doctor", availability: "available" }),
        Object.freeze({ command: "candidate", availability: "available" }),
      ]),
    })}\n`,
  );
  process.exitCode = 0;
}

/**
 * Task Commandを実行する。
 *
 * @responsibility Task Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns runTaskCommandの計算結果を返す。
 * @precondition 「args: readonly string[]」がrunTaskCommandの入力契約を満たす。
 * @postcondition runTaskCommandの責務を完了した結果だけを返す。
 * @effect runTaskCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runTaskCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runTaskCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runTaskCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runTaskCommandは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * 候補 Commandを実行する。
 *
 * @responsibility 候補 Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns runCandidateCommandの計算結果を返す。
 * @precondition 「args: readonly string[]」がrunCandidateCommandの入力契約を満たす。
 * @postcondition runCandidateCommandの責務を完了した結果だけを返す。
 * @effect runCandidateCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runCandidateCommandは独自の失敗分岐を所有しない。
 * @invariant runCandidateCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runCandidateCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runCandidateCommandは共有非同期状態を持たない同期処理である。
 */
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
        typeof options.repairReleaseRoot === "string"
          ? {
              adoptDockerDesktopRepairId: options.adoptDockerDesktopRepairId,
              repairReleaseRoot: options.repairReleaseRoot,
            }
          : {}),
      },
      {
        repair: repairRuntimeOwnedWindowsDockerDesktopRuntime,
        close: closeRuntimeOwnedWindowsDockerDesktopRepair,
        adopt: adoptRuntimeOwnedWindowsDockerDesktopRepair,
      },
    );
    if (typeof options.restartDockerForRecoveryId === "string") {
      const controller = new AbortController();
      const binding = bindTaskCliCancellationSignals(async () =>
        controller.abort(),
      );
      let restart: unknown;
      let released: ReturnType<typeof binding.unbind>;
      try {
        restart =
          binding.status === "bound"
            ? await restartRuntimeOwnedDockerForRecovery(
                options.restartDockerForRecoveryId,
                controller.signal,
                typeof options.restartOriginReleaseRoot === "string"
                  ? options.restartOriginReleaseRoot
                  : undefined,
              )
            : {
                status: "blocked",
                reason: "docker_restart_cancellation_binding_failed",
                cleanupConfirmed: true,
                restartCompleted: false,
                taskRecoveryCompleted: false,
              };
      } finally {
        released = binding.unbind();
      }
      const result = plainRecord(restart);
      const report =
        released.status === "released" && result
          ? result
          : {
              status: "blocked",
              reason: "docker_restart_cancellation_cleanup_unconfirmed",
              cleanupConfirmed: false,
              restartCompleted: false,
              taskRecoveryCompleted: false,
            };
      const rendered = renderDockerRecoveryDoctorReport(
        { ...report, contract: "crdd-coordinator/docker-restart-for-recovery" },
        options.json,
      );
      process.stdout.write(rendered.stdout);
      process.exitCode = rendered.exitCode;
    } else if (dockerRepair) {
      process.stdout.write(dockerRepair.stdout);
      process.exitCode = dockerRepair.exitCode;
    } else {
      const report: unknown =
        recoveryId !== null
          ? recoveryId.startsWith("host.")
            ? recoverOwnedOperationDirectories(recoveryId)
            : recoveryId.startsWith("docker-task.")
              ? options.afterRecordedDockerRestart === true
                ? recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart(
                    recoveryId,
                  )
                : typeof options.afterDockerDesktopRepairId === "string" &&
                    typeof options.repairReleaseRoot === "string"
                  ? recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart(
                      recoveryId,
                      options.afterDockerDesktopRepairId,
                      options.repairReleaseRoot,
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
