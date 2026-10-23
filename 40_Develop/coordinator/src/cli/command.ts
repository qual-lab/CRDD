#!/usr/bin/env node
/**
 * Coordinatorの起動用途・通常Commandの受付と結果表示を所有する。
 *
 * @responsibility import時には操作せず、明示受付から検査済みの既存操作・固定Scriptへ配送する。
 * @trace ARCH-000004
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  parseDoctorArguments,
  UsageError,
  readBoundedTaskRequestFromStdin,
} from "./options.ts";
import {
  renderDockerRecoveryDoctorReport,
  renderDoctorCommandFailure,
} from "./recovery-report.ts";
import { runDoctor } from "../execution/diagnostics.ts";
import { isSupportedCoordinatorNodeRuntime } from "../execution/diagnostics.ts";
import { bindTaskCliCancellationSignals } from "./cancellation.ts";
import { repairRuntimeOwnedDockerRuntime } from "../execution/recovery.ts";
import { recoverDockerIsolationProbe } from "../execution/diagnostics.ts";
import {
  inspectRuntimeOwnedDockerTaskAdmission,
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedCurrentRecoveryOperationRoot,
} from "../execution/recovery.ts";
import { restartRuntimeOwnedDockerForRecovery } from "../execution/recovery.ts";
import { recoverOwnedOperationDirectories } from "../execution/operation.ts";
import { createHash } from "node:crypto";
import {
  parseRepositoryProjectContextMarkdown,
  readStableBoundedFileSnapshot,
} from "../../../domain-model/src/index.ts";
import { createRepositoryAiProfileCatalogStore } from "../../../ai-adapter/src/index.ts";
import {
  createRepositoryTaskRequests,
  inspectSingleTaskCommand,
} from "../task/requests.ts";
import { runCoordinatorPublicObjective } from "../objective/public-operation.ts";
import { initializeCoordinatorSnapshot } from "../storage/current-state.ts";

/**
 * Coordinator CLI自身の引数エラーを区別する。
 * @responsibility 業務CLIの入力型へ依存せず、doctor等の受付失敗を終了コード64へ分類する。
 * @trace ARCH-000004
 * @construction メッセージは既存の有限理由を受け取る。
 * @lifecycle 一回のCLI受付に閉じる。
 * @effect N/A: Error値の生成だけ。
 * @failure N/A: 独自資源を取得しない。
 * @invariant 入力失敗から実行成功を導かない。
 * @boundary Coordinator CLI内。
 * @security 秘密入力を保持しない。
 * @concurrency N/A: 共有状態なし。
 */
class CommandUsageError extends Error {
  readonly usage = true;
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
    `  node template/tools/crdd-coordinator.ts task --request-stdin --json  # Task受付が明示Workspaceを解決\n`,
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
      ]),
    })}\n`,
  );
  process.exitCode = 0;
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

export const COORDINATOR_LAUNCH_ENTRIES = Object.freeze({
  task: "../src/cli/command.ts",
  interactive: "../src/cli/command.ts",
  automation: "../src/cli/command.ts",
  "verify-routes": "../scripts/verify-route-matrix.ts",
  "verify-recovery": "../scripts/verify-recovery-matrix.ts",
  "authenticate-claude": "../scripts/authenticate-claude-subscription.ts",
});

/**
 * coordinator-launchで使用するLaunch Modeの値契約を定義する。
 *
 * @responsibility Launch ModeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LaunchModeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LaunchModeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LaunchModeの宣言は外部境界を開かない。
 * @security N/A: LaunchModeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LaunchModeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LaunchMode = keyof typeof COORDINATOR_LAUNCH_ENTRIES;
/**
 * coordinator-launchで使用するLaunch Observationの値契約を定義する。
 *
 * @responsibility Launch ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LaunchObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LaunchObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: LaunchObservationの宣言は外部境界を開かない。
 * @security N/A: LaunchObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LaunchObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LaunchObservation = Readonly<{
  nodeVersion: string;
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
  stdoutWritable: boolean;
}>;

// A routing plan, not execution authority. Each target retains its own gates.
/**
 * Coordinator Launchを一意に解決する。
 *
 * @responsibility Coordinator Launchの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]、observation: LaunchObservation
 * @returns resolveCoordinatorLaunchの計算結果を返す。
 * @precondition 「args: readonly string[]、observation: LaunchObservation」がresolveCoordinatorLaunchの入力契約を満たす。
 * @postcondition resolveCoordinatorLaunchの責務を完了した結果だけを返す。
 * @effect N/A: resolveCoordinatorLaunchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveCoordinatorLaunchは独自の失敗分岐を所有しない。
 * @invariant resolveCoordinatorLaunchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveCoordinatorLaunchはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveCoordinatorLaunchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveCoordinatorLaunchは共有非同期状態を持たない同期処理である。
 */
export function resolveCoordinatorLaunch(
  args: readonly string[],
  observation: LaunchObservation,
) {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (!isSupportedCoordinatorNodeRuntime(observation.nodeVersion)) {
    return blocked("coordinator_node_version_unsupported");
  }
  const mode = args[0];
  if (!mode || !Object.hasOwn(COORDINATOR_LAUNCH_ENTRIES, mode)) {
    return blocked("coordinator_launch_mode_invalid");
  }
  const suppliedArgs = args.slice(1);
  const forwardedArgs =
    mode === "task" ? ["task", ...suppliedArgs] : suppliedArgs;
  if (
    forwardedArgs.some((arg) => arg.includes("\0")) ||
    ((mode === "verify-routes" || mode === "verify-recovery") &&
      forwardedArgs.length !== 0) ||
    (mode === "authenticate-claude" && forwardedArgs.length !== 0) ||
    (mode === "automation" && !forwardedArgs.includes("--json")) ||
    (mode === "task" &&
      (!suppliedArgs.includes("--request-stdin") ||
        !suppliedArgs.includes("--json")))
  ) {
    return blocked("coordinator_launch_arguments_invalid");
  }
  if (
    (mode === "interactive" ||
      mode === "verify-routes" ||
      mode === "authenticate-claude") &&
    (!observation.stdoutIsTty || !observation.stdoutWritable)
  ) {
    return blocked("coordinator_launch_terminal_output_required");
  }
  if (mode === "authenticate-claude" && !observation.stdinIsTty) {
    return blocked("coordinator_launch_terminal_input_required");
  }
  if ((mode === "automation" || mode === "task") && observation.stdoutIsTty) {
    return blocked("coordinator_launch_machine_output_required");
  }
  return Object.freeze({
    status: "ready" as const,
    mode: mode as LaunchMode,
    entryRelativePath: COORDINATOR_LAUNCH_ENTRIES[mode as LaunchMode],
    forwardedArgs: Object.freeze(forwardedArgs),
  });
}

/**
 * coordinator Launch 失敗 Messageを決定する。
 *
 * @responsibility coordinator Launch 失敗 Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns coordinatorLaunchFailureMessageの計算結果を返す。
 * @precondition 「reason: string」がcoordinatorLaunchFailureMessageの入力契約を満たす。
 * @postcondition coordinatorLaunchFailureMessageの責務を完了した結果だけを返す。
 * @effect N/A: coordinatorLaunchFailureMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: coordinatorLaunchFailureMessageは独自の失敗分岐を所有しない。
 * @invariant coordinatorLaunchFailureMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: coordinatorLaunchFailureMessageはProcess内の同一Subsystemで完結する。
 * @security N/A: coordinatorLaunchFailureMessageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: coordinatorLaunchFailureMessageは共有非同期状態を持たない同期処理である。
 */
export function coordinatorLaunchFailureMessage(reason: string) {
  switch (reason) {
    case "coordinator_node_version_unsupported":
      return "対応するNode.jsで起動してください。実処理は開始していません。";
    case "coordinator_launch_mode_invalid":
      return "起動用途を確認してください。--helpで一覧を表示できます。";
    case "coordinator_launch_arguments_invalid":
      return "起動用途と引数が一致しません。実処理は開始していません。";
    case "coordinator_launch_terminal_output_required":
      return "画面へ表示できる端末から直接起動してください。出力のファイル転送やパイプ接続は使えません。実処理は開始していません。";
    case "coordinator_launch_terminal_input_required":
      return "秘密入力を受け付ける端末から直接起動してください。実処理は開始していません。";
    case "coordinator_launch_machine_output_required":
      return "自動処理の結果は機械向けの接続へ渡してください。端末で操作する場合はinteractiveを使ってください。実処理は開始していません。";
    default:
      return "実行入口で予期しない失敗が発生しました。実行状態と資源回収は未確認です。自動再試行せず、対象の記録を確認してください。";
  }
}

/**
 * Coordinatorの起動用途と通常Commandを一つの受付で分配する。
 * @responsibility binと配布入口が共有する用途判定・固定配送を所有する。
 * @trace ARCH-000004
 * @input arguments_: Process引数。省略時は現在のargvを使用する。
 * @returns 配送した既存入口の完了。
 * @precondition 一回のCLI起動として呼び出し、配送後のargvを再利用しない。
 * @postcondition 拒否時は対象操作を開始せず、受理時は選択した既存入口を待機する。
 * @effect 同じProcess内で通常Commandまたは固定Scriptを実行する。
 * @failure 起動拒否は64、開始後の例外は実行・回収未確認の2を返す。
 * @invariant shell・子Process・env・cwd・stdinの差替えを行わない。
 * @boundary TTYと機械出力の用途境界を実処理前に検査する。
 * @security 起動用途はAuthorityを与えず、引数や秘密値を失敗表示へ複製しない。
 * @concurrency 一回のCLI受付をawaitし、専門操作の取消契約を維持する。
 */
export async function runCoordinatorCommand(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const args = arguments_;
  const isDirectProject = args[0] === "project" || args[0] === "task";
  const isRoutedProject =
    (args[0] === "interactive" || args[0] === "automation") &&
    (args[1] === "project" || args[1] === "task");
  if (isDirectProject || isRoutedProject) {
    if (
      isDirectProject &&
      !isSupportedCoordinatorNodeRuntime(process.versions.node)
    ) {
      if (args.includes("--json")) {
        process.stdout.write(
          `${JSON.stringify({ status: "blocked", reason: "coordinator_node_version_unsupported" })}\n`,
        );
      } else {
        process.stderr.write(
          "Coordinator Runtime requires a preverified Node.js 24.12.0 or newer executable.\n",
        );
      }
      process.exitCode = 2;
    } else {
      const plan = isRoutedProject
        ? resolveCoordinatorLaunch(args, {
            nodeVersion: process.versions.node,
            stdinIsTty: process.stdin.isTTY === true,
            stdoutIsTty: process.stdout.isTTY === true,
            stdoutWritable:
              !process.stdout.destroyed && process.stdout.writable,
          })
        : null;
      if (plan?.status === "blocked") {
        process.stderr.write(
          `${coordinatorLaunchFailureMessage(plan.reason)}\n${plan.reason}\n`,
        );
        process.exitCode = 64;
      } else {
        const forwardedArgs =
          plan?.status === "ready" ? plan.forwardedArgs : args;
        try {
          if (forwardedArgs[0] === "task") {
            await runSingleTaskCommand(forwardedArgs.slice(1));
          } else {
            await runProjectCommand(forwardedArgs.slice(1));
          }
        } catch {
          process.stderr.write(
            `${coordinatorLaunchFailureMessage("entry_failed")}\ncoordinator_launch_entry_failed\n`,
          );
          process.exitCode = 2;
        }
      }
    }
  } else if (
    args.length === 0 ||
    (args[0] &&
      ["doctor", "capabilities", "candidate", "help", "-h"].includes(args[0]))
  ) {
    // Preserve the existing direct command contract, including optional JSON output.
    await runRuntimeCommand(args);
  } else if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(
      [
        "Coordinatorの共通起動入口",
        "task --request-stdin --json : 採用Repositoryで一般Taskを実行する推奨入口。有効化操作は不要",
        "interactive <CLI引数> : 人向け操作。出力は端末へ直接表示",
        "automation <CLI引数と--json> : 自動処理。既存同意が必要な操作で同意がなければ停止",
        "verify-routes : 固定Taskの4経路E2E。出力は端末へ直接表示",
        "verify-recovery : 固定Workerの復旧検証。端末不要",
        "authenticate-claude : 人がClaude Maxの専用Provider Homeを再認証。Repositoryは接続しない",
        "同じCheckoutの既存入口へ接続します。起動用途の選択は実行許可を与えません。",
        "通常Taskは必要な実行条件をOperationごとに検証します。",
        "入出力・環境・作業Directoryは変更しません。秘密入力の記録や自動入力は行いません。",
        "",
      ].join("\n"),
    );
  } else {
    const plan = resolveCoordinatorLaunch(args, {
      nodeVersion: process.versions.node,
      stdinIsTty: process.stdin.isTTY === true,
      stdoutIsTty: process.stdout.isTTY === true,
      stdoutWritable: !process.stdout.destroyed && process.stdout.writable,
    });
    if (plan.status === "blocked") {
      if (plan.reason === "coordinator_launch_mode_invalid")
        process.stderr.write("Unknown command\n");
      process.stderr.write(
        `${coordinatorLaunchFailureMessage(plan.reason)}\n${plan.reason}\n`,
      );
      process.exitCode = 64;
    } else {
      // One-shot CLI only: preserve the target's existing main guard and argv.
      // No shell, child process, output interception, env or cwd mutation.
      const target = new URL(
        plan.entryRelativePath,
        new URL("../../bin/coordinator.ts", import.meta.url),
      );
      process.argv = [
        process.execPath,
        fileURLToPath(target),
        ...plan.forwardedArgs,
      ];
      try {
        switch (plan.mode) {
          case "task":
          case "interactive":
          case "automation":
            await runRuntimeCommand(plan.forwardedArgs);
            break;
          case "verify-routes":
            await import("../../scripts/verify-route-matrix.ts");
            break;
          case "verify-recovery":
            await import("../../scripts/verify-recovery-matrix.ts");
            break;
          case "authenticate-claude":
            await import("../../scripts/authenticate-claude-subscription.ts");
            break;
        }
      } catch {
        // The target may already have issued effects. Do not invent cleanup.
        process.stderr.write(
          `${coordinatorLaunchFailureMessage("entry_failed")}\ncoordinator_launch_entry_failed\n`,
        );
        process.exitCode = 2;
      }
    }
  }
}

// 既存の直接受付を維持する。importだけでは操作を開始しない。
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCoordinatorCommand(process.argv.slice(2));
}

/**
 * 起動用途判定後の通常Commandを実行する。
 * @responsibility 既存Commandの検査、専門操作への接続と結果表示を所有する。
 * @trace ARCH-000004
 * @input arguments_: 通常Commandと引数。
 * @returns 操作と既存の結果表示の完了。
 * @precondition 明示受付または既存の直接実行から呼び出す。
 * @postcondition 選択した処理の結果・取消・回収確認に対応する終了値を設定する。
 * @effect 選択した既存診断・回復処理だけを実行する。
 * @failure 既存の拒否理由・終了値・回収不明を維持する。
 * @invariant 直Taskから実行対象を推測せず、上位入口への案内だけを返す。
 * @boundary 通常Command受付と診断・回復の専門操作。
 * @security 専門操作の許可検査を省略しない。
 * @concurrency 既存分岐の取消待機とSignal解除を維持する。
 */
async function runRuntimeCommand(arguments_: readonly string[]): Promise<void> {
  const [command, ...args] = arguments_;

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
  } else if (command === "capabilities") {
    runCapabilitiesCommand(args);
  } else if (command === "doctor") {
    try {
      const parsed = parseDoctorArguments(
        args,
        process.env.CRDD_COORDINATOR_ROOT,
      );
      if (parsed.status !== "ok") {
        throw new CommandUsageError(
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
        throw new CommandUsageError("doctor_arguments_invalid");
      }
      let recoveryId: string | null;
      if (recoveryIdValue === null) recoveryId = null;
      else if (typeof recoveryIdValue === "string")
        recoveryId = recoveryIdValue;
      else throw new CommandUsageError("doctor_arguments_invalid");
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
          {
            ...report,
            contract: "crdd-coordinator/docker-restart-for-recovery",
          },
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
                    reason:
                      "coordinator_recovery_current_repository_unconfirmed",
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
        let operationRoot: string | null = null;
        if (recoveryId !== null && !recoveryId.startsWith("docker-task.")) {
          try {
            const currentRoot = verifyRepositoryRoot(
              resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
            );
            if (currentRoot.status === "completed") {
              operationRoot = resolveRuntimeOwnedCurrentRecoveryOperationRoot(
                recoveryId,
                currentRoot.capability,
              );
            }
          } catch {
            operationRoot = null;
          }
        }
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
        rawError instanceof CommandUsageError ? 64 : doctorFailure.exitCode;
    }
  } else {
    process.stderr.write(`Unknown command\n`);
    printHelp();
    process.exitCode = 64;
  }
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
export async function runProjectCommand(args: readonly string[]) {
  if (args.length === 2 && args[0] === "--initialize" && args[1] === "--json") {
    try {
      const root = resolveVerifiedRepositoryRootFromWorkingDirectory(
        process.cwd(),
      );
      const binding = `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`;
      const result = initializeCoordinatorSnapshot(root, binding);
      process.stdout.write(
        `${JSON.stringify({ command: "project initialize", ...result })}\n`,
      );
      process.exitCode = result.status === "completed" ? 0 : 2;
    } catch {
      process.stdout.write(
        `${JSON.stringify({ command: "project initialize", status: "blocked", reason: "orchestrator_repository_root_not_verified" })}\n`,
      );
      process.exitCode = 2;
    }
    return;
  }
  if (
    args.length !== 2 ||
    args[0] !== "--request-stdin" ||
    args[1] !== "--json"
  ) {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          status: "blocked",
          reason: "project_arguments_invalid",
        }),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 64;
    return;
  }
  let request: unknown;
  try {
    request = readBoundedTaskRequestFromStdin();
  } catch (rawError) {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          status: "blocked",
          reason:
            rawError instanceof UsageError
              ? rawError.message
              : "project_request_invalid",
        }),
        null,
        2,
      )}\n`,
    );
    process.exitCode = rawError instanceof UsageError ? 64 : 2;
    return;
  }
  const controller = new AbortController();
  const binding = bindTaskCliCancellationSignals(async () =>
    controller.abort(),
  );
  let result: Awaited<ReturnType<typeof runCoordinatorPublicObjective>>;
  let released: ReturnType<typeof binding.unbind> | undefined;
  try {
    result = await runCoordinatorPublicObjective(request, controller.signal);
  } finally {
    released = binding.unbind();
  }
  if (binding.status !== "bound" || released.status !== "released") {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          status: "blocked",
          reason: "project_cli_cancellation_binding_failed",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        }),
        null,
        2,
      )}\n`,
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
 * 通常Task CLIを共通の単発Ownerと上位の対象解決へ接続する。
 * @responsibility 明示Workspace、既存Profile、取消joinと結果公開。
 * @trace ARCH-000004 ARCH-000012
 * @input --request-stdin --jsonと共通SingleTaskCommand。
 * @returns 終端を一回出力する。
 * @effect 既存Ownerの受付・保存・AI実行。入力拒否では開始しない。
 * @failure 対象省略、旧Task形式、Root／Context不明は開始前停止。
 * @invariant Workspace選択をCoordinatorへ委譲せず、未指定をDirect化しない。
 * @boundary 配布CLIからCoordinator。新しい台帳・Lock・Recoveryなし。
 */
export async function runSingleTaskCommand(args: readonly string[]) {
  if (
    args.length !== 2 ||
    args[0] !== "--request-stdin" ||
    args[1] !== "--json"
  ) {
    process.stdout.write(
      `${JSON.stringify({ command: "task", status: "blocked", reason: "task_arguments_invalid" }, null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
  let owner: ReturnType<typeof createRepositoryTaskRequests> | null = null;
  let cancellation: ReturnType<typeof bindTaskCliCancellationSignals> | null =
    null;
  const controller = new AbortController();
  let report: Record<string, unknown> = {
    command: "task",
    status: "blocked",
    reason: "task_entry_unconfirmed",
  };
  try {
    const command = inspectSingleTaskCommand(readBoundedTaskRequestFromStdin());
    if (command?.mode !== "workspace_edit")
      throw new UsageError("task_workspace_request_required");
    const root = resolveVerifiedRepositoryRootFromWorkingDirectory(
      process.cwd(),
    );
    const verified = verifyRepositoryRoot(root);
    const profiles = createRepositoryAiProfileCatalogStore(root);
    if (verified.status !== "completed" || profiles.status !== "ready")
      throw new UsageError("task_repository_configuration_unavailable");
    const context = parseRepositoryProjectContextMarkdown(
      readStableBoundedFileSnapshot(
        path.join(root, "PROJECT_CONTEXT.md"),
        1048576,
      ).bytes.toString("utf8"),
    );
    owner = createRepositoryTaskRequests(
      verified.capability,
      profiles.store,
      context.projectId,
      "local-cli-user",
      () => resolveVerifiedRepositoryRootFromWorkingDirectory(root) === root,
      "coordinator_cli",
    );
    cancellation = bindTaskCliCancellationSignals(async () =>
      controller.abort(),
    );
    if (cancellation.status !== "bound")
      throw new UsageError("task_cancellation_binding_failed");
    const started = await owner.start(command, controller.signal);
    report = { command: "task", ...started };
    if (started.status === "accepted" && started.requestId) {
      report = { command: "task", ...(await owner.wait(started.requestId)) };
    }
  } catch (error) {
    report = {
      ...report,
      command: "task",
      status: typeof report.requestId === "string" ? "unknown" : "blocked",
      cleanupConfirmed: false,
      reason:
        error instanceof UsageError ? error.message : "task_entry_unconfirmed",
    };
  } finally {
    try {
      await owner?.close();
    } catch {
      report = {
        ...report,
        status: "unknown",
        cleanupConfirmed: false,
        secondaryFailures: [
          ...(Array.isArray(report.secondaryFailures)
            ? report.secondaryFailures
            : []),
          "task_owner_join_unconfirmed",
        ],
      };
    }
    if (cancellation && cancellation.unbind().status !== "released") {
      report = {
        ...report,
        status: "unknown",
        secondaryFailures: [
          ...(Array.isArray(report.secondaryFailures)
            ? report.secondaryFailures
            : []),
          "task_cancellation_release_unconfirmed",
        ],
      };
    }
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode =
    report.status === "completed" && report.cleanupConfirmed === true ? 0 : 2;
}
