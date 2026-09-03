import { fileURLToPath } from "node:url";
import {
  coordinatorLaunchFailureMessage,
  resolveCoordinatorLaunch,
} from "../src/core/coordinator-launch.ts";

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  process.stdout.write(
    [
      "Coordinatorの共通起動入口",
      "task --request-stdin --json : 採用Repositoryで一般Taskを実行する推奨入口。有効化操作は不要",
      "interactive <CLI引数> : 人向け操作。出力は端末へ直接表示",
      "automation <CLI引数と--json> : 自動処理。既存同意が必要な操作で同意がなければ停止",
      "verify-routes : 署名済み4経路E2E。出力は端末へ直接表示",
      "verify-recovery : 署名済み復旧E2E。端末不要",
      "sign-release <署名引数> : 配布担当用。端末で秘密入力",
      "promote-release --distribution-root <署名済みstaging> : 署名Manifestをbyte-for-byteでSource Aへ昇格",
      "同じ配布物の既存入口へ接続します。起動用途の選択は実行許可や署名検証を代替しません。",
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
          await import("./coordinator.ts");
          break;
        case "verify-routes":
          await import("../scripts/verify-signed-route-matrix.ts");
          break;
        case "verify-recovery":
          await import("../scripts/verify-signed-recovery-matrix.ts");
          break;
        case "sign-release":
          await import("../scripts/sign-release-manifest.ts");
          break;
        case "promote-release":
          await import("../scripts/promote-release-manifest.ts");
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
