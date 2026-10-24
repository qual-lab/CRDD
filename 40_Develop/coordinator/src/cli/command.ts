#!/usr/bin/env node
/**
 * Coordinatorの対象・操作を正式APIに接続するCLIへ配送する。
 * @responsibility 引数と出力用途の受付だけを所有し、業務判断・保存・回復を持たない。
 * @trace ARCH-000004
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCapabilities, isSupportedNodeRuntime } from "../api.ts";
import { runAuthenticationCommand } from "./authentication.ts";
import { runDoctorCommand } from "./doctor.ts";
import { runProjectCommand, runSingleTaskCommand } from "./request.ts";

/**
 * CLI起動時に観測した実行環境の値を定義する。
 * @responsibility Node版と端末・出力可否をAuthorityと分離する。
 * @trace ARCH-000004
 * @shape Node版、stdin/stdoutのTTY、stdout書込み可否。
 * @invariant 観測値は実行権限を発行しない。
 * @boundary CLI受付内。
 * @security 秘密値・Pathを含まない。
 * @compatibility 正式APIのRequestとは独立したCLI内契約。
 */
type LaunchObservation = Readonly<{
  nodeVersion: string;
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
  stdoutWritable: boolean;
}>;

/**
 * 通常Commandの文法と端末条件を実行前に確認する。
 * @responsibility 起動モードの別名を持たず、対象・操作を一意に解決する。
 * @trace ARCH-000004
 * @input args: 対象・操作・引数、observation: 現在の実行環境。
 * @returns readyと同じ引数、または有限理由のblocked。
 * @precondition 観測値は呼出し元が現在Processから取得する。
 * @postcondition 不正な文法・Node版・出力条件では操作を配送しない。
 * @effect N/A: 入力値だけの同期検査。
 * @failure 不明・旧モードは拒否する。
 * @invariant CLI受付はAuthorityや送信同意を与えない。
 * @boundary CLI内の純粋な配送判断。
 * @security 引数本文を拒否理由へ複製しない。
 * @concurrency N/A: 共有状態なし。
 */
export function resolveCoordinatorLaunch(
  args: readonly string[],
  observation: LaunchObservation,
) {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (!isSupportedNodeRuntime(observation.nodeVersion))
    return blocked("coordinator_node_version_unsupported");
  if (
    args.length > 16 ||
    args.some(
      (a) =>
        typeof a !== "string" ||
        !a.length ||
        a.length > 4096 ||
        /[\u0000-\u001f\u007f]/u.test(a),
    )
  )
    return blocked("coordinator_launch_arguments_invalid");
  const [target, action, ...tail] = args;
  if (
    !target ||
    ![
      "task",
      "project",
      "doctor",
      "recovery",
      "maintenance",
      "auth",
      "capabilities",
      "help",
      "--help",
      "-h",
    ].includes(target)
  )
    return blocked("coordinator_launch_mode_invalid");
  if (!observation.stdoutWritable)
    return blocked("coordinator_launch_terminal_output_required");
  if (target === "task" || target === "project") {
    const init = target === "project" && action === "init";
    if (
      init
        ? tail.length !== 1 || tail[0] !== "--json"
        : action !== "run" ||
          tail.length !== 2 ||
          tail[0] !== "--request-stdin" ||
          tail[1] !== "--json"
    )
      return blocked("coordinator_launch_arguments_invalid");
    if (!init && observation.stdoutIsTty)
      return blocked("coordinator_launch_machine_output_required");
  }
  if (
    target === "auth" &&
    action === "login" &&
    (!observation.stdinIsTty || !observation.stdoutIsTty)
  )
    return blocked("coordinator_launch_terminal_input_required");
  return Object.freeze({
    status: "ready" as const,
    forwardedArgs: Object.freeze([...args]),
  });
}

/**
 * 起動拒否を秘密情報を含まない説明へ変換する。
 * @responsibility 有限理由を短い人間向け案内へ変換する。
 * @trace ARCH-000004
 * @input reason: 受付の有限理由。
 * @returns 人間向け案内。
 * @precondition 秘密本文を渡さない。
 * @postcondition 引数・Pathを出力しない。
 * @effect N/A: 文字列変換のみ。
 * @failure 未知理由は実行・回収未確認とする。
 * @invariant 失敗を成功化しない。
 * @boundary CLI内。
 * @security 秘密値を含まない。
 * @concurrency N/A: 同期処理。
 */
export function coordinatorLaunchFailureMessage(reason: string) {
  if (reason === "coordinator_node_version_unsupported")
    return "対応するNode.jsで起動してください。実処理は開始していません。";
  if (reason === "coordinator_launch_machine_output_required")
    return "機械向け結果はパイプ等へ接続してください。実処理は開始していません。";
  if (reason === "coordinator_launch_terminal_input_required")
    return "公式ログインは入出力を直接接続した端末で行ってください。";
  if (reason.startsWith("coordinator_launch_"))
    return "対象と操作、引数または出力先を確認してください。--helpで一覧を表示できます。";
  return "実行状態と資源回収は未確認です。自動再試行せず記録を確認してください。";
}

/**
 * 通常CLIを一回配送し、同じ操作の完了を待つ。
 * @responsibility help・能力表示と専門CLIへの有限配送。
 * @trace ARCH-000004
 * @input arguments_: 省略時は現在のProcess引数。
 * @returns 表示と終了値を設定する。
 * @precondition 一回のCLI起動として呼ぶ。
 * @postcondition 専門操作と取消解除を待機する。
 * @effect 専門API、標準入出力。受付拒否では下位操作なし。
 * @failure 受付拒否64、開始後の不明失敗2。
 * @invariant Shell・子Process・cwd・環境を書き換えない。
 * @boundary CLIと専門操作。
 * @security ログイン・機械出力の端末条件を実行前に確認する。
 * @concurrency 一つの操作をawaitし、自動再送しない。
 */
export async function runCoordinatorCommand(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const args = arguments_.length ? arguments_ : ["help"];
  const plan = resolveCoordinatorLaunch(args, {
    nodeVersion: process.versions.node,
    stdinIsTty: process.stdin.isTTY === true,
    stdoutIsTty: process.stdout.isTTY === true,
    stdoutWritable: !process.stdout.destroyed && process.stdout.writable,
  });
  if (plan.status !== "ready") {
    process.stderr.write(
      coordinatorLaunchFailureMessage(plan.reason) + "\n" + plan.reason + "\n",
    );
    process.exitCode = 64;
    return;
  }
  try {
    const [target, ...rest] = plan.forwardedArgs;
    if (target && ["help", "--help", "-h"].includes(target)) {
      if (rest.length) {
        process.exitCode = 64;
        return;
      }
      process.stdout.write(
        "Coordinator — 対象と操作\n" +
          getCapabilities()
            .commands.map((c) => "  coordinator " + c.invocation)
            .join("\n") +
          "\n",
      );
      process.exitCode = 0;
    } else if (target === "capabilities") {
      if (rest.length !== 1 || rest[0] !== "--json") {
        process.stderr.write("Usage: coordinator capabilities --json\n");
        process.exitCode = 64;
        return;
      }
      process.stdout.write(JSON.stringify(getCapabilities()) + "\n");
      process.exitCode = 0;
    } else if (target === "auth") await runAuthenticationCommand(rest);
    else if (target === "project") await runProjectCommand(rest);
    else if (target === "task") await runSingleTaskCommand(rest);
    else await runDoctorCommand(plan.forwardedArgs);
  } catch {
    process.stderr.write(
      coordinatorLaunchFailureMessage("entry_failed") +
        "\ncoordinator_launch_entry_failed\n",
    );
    process.exitCode = 2;
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runCoordinatorCommand();
