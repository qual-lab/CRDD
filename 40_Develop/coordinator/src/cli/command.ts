#!/usr/bin/env node
/**
 * coordinatorに属する責務をまとめる。
 *
 * @responsibility UsageErrorを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

import { types as utilTypes } from "node:util";
import path from "node:path";
import {
  UsageError,
  readBoundedTaskRequestFromStdin,
} from "./request-input.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  parseCandidateArguments,
  parseDoctorArguments,
  parseTaskArguments,
} from "./options.ts";
import { printCommandReport } from "./command-report.ts";
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
import { repairRuntimeOwnedDockerRuntime } from "../diagnostics/runtime-repair.ts";
import { recoverDockerIsolationProbe } from "../diagnostics/isolation-probe.ts";
import {
  inspectRuntimeOwnedDockerTaskAdmission,
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
} from "../task/recovery.ts";
import { restartRuntimeOwnedDockerForRecovery } from "../diagnostics/runtime-restart.ts";
import { recoverOwnedOperationDirectories } from "../host-execution/operation-workspace-lifecycle.ts";
import { readRuntimeOwnedCoordinatorRecoverySnapshot } from "../state-storage/settlement-store.ts";

/**
 * 現在Repositoryの単一操作から回復読取りのRootを解決する。
 * @responsibility tokenだけのOS tmp探索を廃止し、現在操作に結合した所在だけを返す。
 * @trace ARCH-000008
 * @input recoveryId: 明示指定されたHostまたはProbeのexact参照。
 * @returns 対応する単一操作のRoot、またはnull。
 * @precondition CLIの現在Repositoryを検証し、現在SchemaのReaderだけを使用する。
 * @postcondition 欠測・複数・不正値からRootを推測しない。
 * @effect Git Rootと現在stateの読取り、既存短期排他のみ。
 * @failure 未登録・不正参照・読取り／解放不明はnull。
 * @invariant Root値は処置Authorityではなく、下位が実世代・記録・実体を照合する。
 * @boundary CLIの現在RepositoryとHost／Probeの固定読取りscope。
 * @security Rootや内部記録を公開出力へ含めず、旧世代の広域探索を行わない。
 * @concurrency fresh Readerの排他解放後に所在を返す。
 */
function currentRecoveryOperationRoot(recoveryId: string): string | null {
  try {
    const match =
      /^(host|docker)\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\./u.exec(
        recoveryId,
      );
    if (!match?.[2]) return null;
    const root = verifyRepositoryRoot(
      resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
    );
    if (root.status !== "completed") return null;
    const current = readRuntimeOwnedCoordinatorRecoverySnapshot(
      root.capability,
    );
    if (
      current.status !== "completed" ||
      !current.lockReleased ||
      !current.value
    )
      return null;
    const matches = current.value.snapshot.operations.filter((operation) => {
      if (operation.kind !== "docker_task") return false;
      const identity = JSON.parse(operation.identityJson);
      return (
        typeof identity.hostPaths.root === "string" &&
        path.isAbsolute(identity.hostPaths.root) &&
        path.basename(identity.hostPaths.root) === match[2] &&
        (match[1] === "host"
          ? operation.host.currentToken === recoveryId
          : identity.operationMode === "boolean_probe")
      );
    });
    if (matches.length !== 1 || !matches[0]) return null;
    return JSON.parse(matches[0].identityJson).hostPaths.root;
  } catch {
    return null;
  }
}

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
    `  coordinator doctor --restart-docker-for-recovery <docker-task-recovery-id> [--json]\n`,
  );
  process.stdout.write(
    `    現在のRepository状態とexact回復参照へ結合します。通常再起動に署名配布候補は指定しません。\n`,
  );
  process.stdout.write(
    `  coordinator doctor --repair-docker-desktop-runtime [--json]\n`,
  );
  process.stdout.write(
    `  coordinator doctor --retain-docker-runtime-repair <docker-runtime-repair-id> [--json]  # 明示的な保持判断。終了整理・Task回復は別途確認\n`,
  );
  process.stdout.write(
    `    明示修復だけを現在Repositoryへ結合します。新しい修復IDは --recover-isolation で再確認できます。保持物は自動削除しません。\n`,
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
  let started: ReturnType<typeof startRuntimeOwnedCoordinatorTask>;
  try {
    started = startRuntimeOwnedCoordinatorTask(
      taskRequest,
      resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
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
 * 明示修復CLIを現在Root・取消・固定診断へ接続する。
 * @responsibility 表示とCLI取消解除を修復の技術・保存結果から分離する。
 * @trace ARCH-000008
 * @input json: 出力形式、recoveryId: exact再入場または新規null、purpose: 明示修復または明示保持。
 * @returns N/A: 固定表示と終了コードを設定する。
 * @precondition 引数分類済みのdoctor分岐からだけ呼ぶ。
 * @postcondition 取消解除を試行した後に表示し、表示失敗で修復を再実行しない。
 * @effect 現在Root読取りと下位修復、取消listener、標準出力。
 * @failure Root・binding不明は下位0。解除不明は一次理由を保持しexit2。
 * @invariant CLIはOS・Docker Desktop・署名・保存Pathを判定しない。
 * @boundary CLIと環境中立の修復composition。
 * @security 固定fieldだけを投影し内部Root・Scope・checkpointを公開しない。
 * @concurrency 取消は下位signalへ伝播しfinallyでlistenerを解除する。
 */
async function runRuntimeRepairDoctorCommand(
  json: boolean,
  recoveryId: string | null,
  purpose: "repair" | "retain",
) {
  const controller = new AbortController();
  const binding = bindTaskCliCancellationSignals(async () =>
    controller.abort(),
  );
  let result: unknown = {
    status: "blocked",
    reason: "runtime_repair_cancellation_binding_failed",
    recoveryId,
    finalCheckpointConfirmed: false,
    outcomeConfirmed: false,
    retentionConfirmed: false,
    retentionReviewAfter: null,
    historyConfirmed: false,
    completionConfirmed: false,
    nativeCleanupConfirmed: false,
  };
  let cliCleanupConfirmed = false;
  try {
    if (
      binding.status === "bound" &&
      purpose === "retain" &&
      controller.signal.aborted
    ) {
      result = {
        status: "blocked",
        reason: "runtime_repair_cancelled",
        recoveryId,
        finalCheckpointConfirmed: false,
        outcomeConfirmed: false,
        retentionConfirmed: false,
        retentionReviewAfter: null,
        historyConfirmed: false,
        completionConfirmed: false,
        nativeCleanupConfirmed: false,
      };
    } else if (binding.status === "bound") {
      try {
        const currentRoot = verifyRepositoryRoot(
          resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
        );
        result =
          currentRoot.status === "completed"
            ? await repairRuntimeOwnedDockerRuntime(
                currentRoot.capability,
                controller.signal,
                recoveryId,
                purpose,
              )
            : {
                status: "blocked",
                reason: "runtime_repair_boundary_unavailable",
                recoveryId,
                finalCheckpointConfirmed: false,
                outcomeConfirmed: false,
                retentionConfirmed: false,
                retentionReviewAfter: null,
                historyConfirmed: false,
                completionConfirmed: false,
                nativeCleanupConfirmed: false,
              };
      } catch {
        result = {
          status: "blocked",
          reason: "runtime_repair_boundary_unavailable",
          recoveryId,
          finalCheckpointConfirmed: false,
          outcomeConfirmed: false,
          retentionConfirmed: false,
          retentionReviewAfter: null,
          historyConfirmed: false,
          completionConfirmed: false,
          nativeCleanupConfirmed: false,
        };
      }
    }
  } finally {
    try {
      cliCleanupConfirmed = binding.unbind().status === "released";
    } catch {
      cliCleanupConfirmed = false;
    }
  }
  const value = plainRecord(result);
  const safe = Object.fromEntries(
    [
      "status",
      "reason",
      "recoveryId",
      "finalCheckpointConfirmed",
      "outcomeConfirmed",
      "retentionConfirmed",
      "retentionReviewAfter",
      "historyConfirmed",
      "completionConfirmed",
      "nativeCleanupConfirmed",
    ].map((key) => [
      key,
      value
        ? (Object.getOwnPropertyDescriptor(value, key)?.value ?? null)
        : null,
    ]),
  );
  if (recoveryId !== null && safe.recoveryId !== recoveryId) {
    safe.status = "blocked";
    safe.reason = "runtime_repair_boundary_unavailable";
    safe.recoveryId = recoveryId;
    for (const field of [
      "finalCheckpointConfirmed",
      "outcomeConfirmed",
      "retentionConfirmed",
      "historyConfirmed",
      "completionConfirmed",
      "nativeCleanupConfirmed",
    ])
      safe[field] = false;
    safe.retentionReviewAfter = null;
  }
  const rendered = renderDockerRecoveryDoctorReport(
    {
      ...safe,
      contract: "crdd-coordinator/current-runtime-repair",
      cliCleanupConfirmed,
      cliCleanupReason: cliCleanupConfirmed
        ? null
        : "runtime_repair_cli_cleanup_unconfirmed",
    },
    json,
  );
  process.stdout.write(rendered.stdout);
  process.exitCode = rendered.exitCode;
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
      typeof options.repairDockerDesktopRuntime !== "boolean"
    ) {
      throw new UsageError("doctor_arguments_invalid");
    }
    let recoveryId: string | null;
    if (recoveryIdValue === null) recoveryId = null;
    else if (typeof recoveryIdValue === "string") recoveryId = recoveryIdValue;
    else throw new UsageError("doctor_arguments_invalid");
    const isCurrentRuntimeRepair =
      options.repairDockerDesktopRuntime ||
      recoveryId?.startsWith("docker-runtime-repair.") === true ||
      typeof options.retainDockerRuntimeRepairId === "string";
    if (isCurrentRuntimeRepair) {
      await runRuntimeRepairDoctorCommand(
        options.json,
        typeof options.retainDockerRuntimeRepairId === "string"
          ? options.retainDockerRuntimeRepairId
          : recoveryId,
        typeof options.retainDockerRuntimeRepairId === "string"
          ? "retain"
          : "repair",
      );
    } else if (typeof options.restartDockerForRecoveryId === "string") {
      const controller = new AbortController();
      const binding = bindTaskCliCancellationSignals(async () =>
        controller.abort(),
      );
      let restart: unknown;
      let released: ReturnType<typeof binding.unbind>;
      try {
        const currentRoot = verifyRepositoryRoot(
          resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
        );
        restart =
          binding.status === "bound" && currentRoot.status === "completed"
            ? await restartRuntimeOwnedDockerForRecovery(
                options.restartDockerForRecoveryId,
                controller.signal,
                currentRoot.capability,
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
    } else if (recoveryId?.startsWith("docker-task.")) {
      const controller = new AbortController();
      const binding = bindTaskCliCancellationSignals(async () =>
        controller.abort(),
      );
      let result: Awaited<
        ReturnType<typeof recoverRuntimeOwnedDockerTaskForCurrentConsumer>
      > = {
        contract: "crdd-coordinator/current-task-recovery",
        status: "blocked",
        reason: "docker_task_recovery_cancellation_binding_failed",
        recoveryId,
        dockerCleanupConfirmed: false,
        hostCleanupConfirmed: false,
        locksReleased: true,
        historyConfirmed: false,
        deliveryPending: false,
        operationRetained: null,
        operationRemovalConfirmed: false,
        taskRecoveryCompleted: false,
        cleanupReason: null,
      };
      let cliCleanupConfirmed = false;
      try {
        if (binding.status === "bound" && controller.signal.aborted) {
          result = { ...result, reason: "docker_task_recovery_cancelled" };
        } else if (binding.status === "bound") {
          const currentRoot = verifyRepositoryRoot(
            resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
          );
          result =
            currentRoot.status === "completed"
              ? await recoverRuntimeOwnedDockerTaskForCurrentConsumer(
                  recoveryId,
                  currentRoot.capability,
                  controller.signal,
                )
              : {
                  ...result,
                  reason: "coordinator_recovery_current_repository_unconfirmed",
                };
        }
      } finally {
        try {
          cliCleanupConfirmed = binding.unbind().status === "released";
        } catch {
          cliCleanupConfirmed = false;
        }
      }
      const rendered = renderDockerRecoveryDoctorReport(
        {
          contract: result.contract,
          status: result.status,
          reason: result.reason,
          recoveryId: result.recoveryId,
          dockerCleanupConfirmed: result.dockerCleanupConfirmed,
          hostCleanupConfirmed: result.hostCleanupConfirmed,
          locksReleased: result.locksReleased,
          historyConfirmed: result.historyConfirmed,
          deliveryPending: result.deliveryPending,
          operationRetained: result.operationRetained,
          operationRemovalConfirmed: result.operationRemovalConfirmed,
          taskRecoveryCompleted: result.taskRecoveryCompleted,
          cleanupReason: result.cleanupReason,
          cliCleanupConfirmed,
          cliCleanupReason: cliCleanupConfirmed
            ? null
            : "docker_task_recovery_cli_cleanup_unconfirmed",
        },
        options.json,
      );
      process.stdout.write(rendered.stdout);
      process.exitCode = rendered.exitCode;
    } else {
      const operationRoot =
        recoveryId !== null && !recoveryId.startsWith("docker-task.")
          ? currentRecoveryOperationRoot(recoveryId)
          : null;
      const report: unknown =
        recoveryId !== null &&
        !recoveryId.startsWith("docker-task.") &&
        operationRoot === null
          ? Object.freeze({
              status: "blocked",
              reason: "coordinator_recovery_current_operation_unconfirmed",
              recoveryId,
              hostCleanupCompleted: false,
            })
          : recoveryId !== null
            ? recoveryId.startsWith("host.")
              ? recoverOwnedOperationDirectories(
                  recoveryId,
                  null,
                  operationRoot,
                )
              : recoverDockerIsolationProbe(recoveryId, operationRoot)
            : (() => {
                const currentRoot =
                  resolveVerifiedRepositoryRootFromWorkingDirectory(
                    process.cwd(),
                  );
                return Object.freeze({
                  ...runDoctor({
                    activeIsolation: options.activeIsolation,
                    cwd: currentRoot,
                  }),
                  dockerTaskRecovery:
                    inspectRuntimeOwnedDockerTaskAdmission(currentRoot),
                });
              })();
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
