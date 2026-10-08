#!/usr/bin/env node

/**
 * 配布RepositoryからCoordinatorを起動する。
 *
 * @responsibility 配布入口を同じCRDD改訂版のCoordinator起動境界へ接続する。
 * @trace ARCH-000004
 */

// CRDDをcloneまたはsubmoduleで導入した利用者向けの安定したCoordinator入口。
// 実行契約と署名対象の本体は、同じCRDD改訂版に含まれる共通起動入口が所有する。
import {
  coordinatorLaunchFailureMessage,
  resolveCoordinatorLaunch,
} from "../../40_Develop/coordinator/src/cli/coordinator-launch.ts";
import { isSupportedCoordinatorNodeRuntime } from "../../40_Develop/coordinator/src/host-runtime/node-runtime-version.ts";

const args = process.argv.slice(2);
const directProject = args[0] === "project";
const routedProject =
  (args[0] === "interactive" || args[0] === "automation") &&
  args[1] === "project";
if (directProject || routedProject) {
  if (
    directProject &&
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
    const plan = routedProject
      ? resolveCoordinatorLaunch(args, {
          nodeVersion: process.versions.node,
          stdinIsTty: process.stdin.isTTY === true,
          stdoutIsTty: process.stdout.isTTY === true,
          stdoutWritable: !process.stdout.destroyed && process.stdout.writable,
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
        const { runProjectCommand } = await import(
          "../../40_Develop/orchestrator/src/cli/project-command.ts"
        );
        await runProjectCommand(forwardedArgs.slice(1));
      } catch {
        process.stderr.write(
          `${coordinatorLaunchFailureMessage("entry_failed")}\ncoordinator_launch_entry_failed\n`,
        );
        process.exitCode = 2;
      }
    }
  }
} else {
  await import("../../40_Develop/coordinator/bin/coordinator.ts");
}
