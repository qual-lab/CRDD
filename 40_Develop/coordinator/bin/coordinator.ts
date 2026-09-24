#!/usr/bin/env node
/**
 * coordinatorに属する責務をまとめる。
 *
 * @responsibility UsageErrorを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

import fs from "node:fs";
import { types as utilTypes } from "node:util";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/repository-location.ts";
import { runProjectRuntimePublicObjective } from "../src/composition/project-runtime-composition-root.ts";
import {
  parseCandidateArguments,
  parseDoctorArguments,
  parseTaskArguments,
} from "../src/core/cli-options.ts";
import {
  renderSafeHumanCommandReport,
  type SafeCommandReport,
} from "../src/core/command-report.ts";
import { dispatchDockerDesktopRepairDoctorCommand } from "../src/core/docker-desktop-repair-doctor-dispatch.ts";
import { renderDockerRecoveryDoctorReport } from "../src/core/docker-recovery-command-report.ts";
import { renderDoctorCommandFailure, runDoctor } from "../src/core/doctor.ts";
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
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import {
  adoptRuntimeOwnedWindowsDockerDesktopRepair,
  closeRuntimeOwnedWindowsDockerDesktopRepair,
  repairRuntimeOwnedWindowsDockerDesktopRuntime,
} from "../src/security/docker-desktop-runtime-repair.ts";
import { recoverDockerIsolationProbe } from "../src/security/docker-isolation.ts";
import {
  inspectRuntimeOwnedDockerTaskRecoveryState,
  recoverRuntimeOwnedDockerTask,
  recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart,
  recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart,
} from "../src/security/docker-recovery-runtime.ts";
import { restartRuntimeOwnedDockerForRecovery } from "../src/security/docker-restart-runtime.ts";
import { recoverOwnedOperationDirectories } from "../src/security/execution-environment.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";

/**
 * UsageErrorが担う状態と操作を提供する。
 *
 * @responsibility UsageErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000004
 * @construction UsageErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle UsageErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: UsageErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: UsageErrorの宣言自体は実行時失敗を所有しない。
 * @invariant UsageErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: UsageErrorの宣言は外部境界を開かない。
 * @security N/A: UsageErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: UsageErrorは共有非同期状態を持たない同期処理である。
 */
class UsageError extends Error {
  readonly usage = true;
}

const MAXIMUM_TASK_REQUEST_BYTES = 128 * 1024;

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
        Object.freeze({
          command: "project",
          availability: "development_candidate",
          invocation: "project --request-stdin --json",
        }),
      ]),
    })}\n`,
  );
  process.exitCode = 0;
}

/**
 * Project Commandを実行する。
 *
 * @responsibility Project Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns runProjectCommandの計算結果を返す。
 * @precondition 「args: readonly string[]」がrunProjectCommandの入力契約を満たす。
 * @postcondition runProjectCommandの責務を完了した結果だけを返す。
 * @effect runProjectCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runProjectCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runProjectCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runProjectCommandは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Bounded Task Request From Stdinを読み取る。
 *
 * @responsibility Bounded Task Request From Stdinの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns readBoundedTaskRequestFromStdinの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がreadBoundedTaskRequestFromStdinの入力契約を満たす。
 * @postcondition readBoundedTaskRequestFromStdinの責務を完了した結果だけを返す。
 * @effect readBoundedTaskRequestFromStdinはFilesystemの読取りまたは書込みを実行する。
 * @failure readBoundedTaskRequestFromStdinは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readBoundedTaskRequestFromStdinは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readBoundedTaskRequestFromStdinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readBoundedTaskRequestFromStdinは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Command Reportを人間向け表示へ出力する。
 *
 * @responsibility Command Reportの表示内容、機密除外、出力先境界を所有する。
 * @trace ARCH-000004
 * @input report: SafeCommandReport、shouldOutputJson: boolean
 * @returns N/A: printCommandReportは戻り値を返さない。
 * @precondition 「report: SafeCommandReport、shouldOutputJson: boolean」がprintCommandReportの入力契約を満たす。
 * @postcondition printCommandReportの責務を完了して呼出し元へ制御を戻す。
 * @effect printCommandReportは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: printCommandReportは独自の失敗分岐を所有しない。
 * @invariant printCommandReportは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: printCommandReportはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: printCommandReportは共有非同期状態を持たない同期処理である。
 */
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
