/**
 * launchに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { fileURLToPath } from "node:url";
import {
  coordinatorLaunchFailureMessage,
  resolveCoordinatorLaunch,
} from "../src/cli/launch.ts";

const args = process.argv.slice(2);
if (
  args.length === 0 ||
  (args[0] &&
    ["task", "doctor", "capabilities", "candidate", "help", "-h"].includes(
      args[0],
    ))
) {
  // Preserve the existing direct command contract, including optional JSON output.
  await import("../src/cli/command.ts");
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
    const target = new URL(plan.entryRelativePath, import.meta.url);
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
          await import("../src/cli/command.ts");
          break;
        case "verify-routes":
          await import("../scripts/verify-signed-route-matrix.ts");
          break;
        case "verify-recovery":
          await import("../scripts/verify-signed-recovery-matrix.ts");
          break;
        case "authenticate-claude":
          await import("../scripts/authenticate-claude-subscription.ts");
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
