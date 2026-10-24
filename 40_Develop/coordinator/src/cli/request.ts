/**
 * Project／Taskの機械向け受付を提供する。
 * @responsibility CLIの入力・出力と取消Listenerだけを所有し、正式APIへ接続する。
 * @trace ARCH-000004
 */

import path from "node:path";
import {
  initializeProject,
  runObjective,
  runTask,
  inspectSingleTaskCommand,
} from "../api.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  parseRepositoryProjectContextMarkdown,
  readStableBoundedFileSnapshot,
} from "../../../domain-model/src/index.ts";
import { UsageError, readBoundedTaskRequestFromStdin } from "./options.ts";
import { bindTaskCliCancellationSignals } from "./cancellation.ts";
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
  if (args.length === 2 && args[0] === "init" && args[1] === "--json") {
    try {
      const result = initializeProject();
      process.stdout.write(
        `${JSON.stringify({ command: "project init", ...result })}\n`,
      );
      process.exitCode = result.status === "completed" ? 0 : 2;
    } catch {
      process.stdout.write(
        `${JSON.stringify({ command: "project init", status: "blocked", reason: "coordinator_repository_root_not_verified" })}\n`,
      );
      process.exitCode = 2;
    }
    return;
  }
  if (
    args.length !== 3 ||
    args[0] !== "run" ||
    args[1] !== "--request-stdin" ||
    args[2] !== "--json"
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
  let result:
    | Awaited<ReturnType<typeof runObjective>>
    | Readonly<{ status: "blocked"; reason: string }>;
  let released: ReturnType<typeof binding.unbind> | undefined;
  try {
    result =
      binding.status === "bound"
        ? await runObjective(request, controller.signal)
        : {
            status: "blocked",
            reason: "project_cli_cancellation_binding_failed",
          };
  } finally {
    try {
      released = binding.unbind();
    } catch {
      released = undefined;
    }
  }
  if (binding.status !== "bound" || released?.status !== "released") {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          ...result,
          status: "unknown",
          cliCleanupConfirmed: false,
          cliReason: "project_cli_cancellation_binding_failed",
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
 * @responsibility 明示Workspace、Repository別の固定選定、取消joinと結果公開。
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
    args.length !== 3 ||
    args[0] !== "run" ||
    args[1] !== "--request-stdin" ||
    args[2] !== "--json"
  ) {
    process.stdout.write(
      `${JSON.stringify({ command: "task", status: "blocked", reason: "task_arguments_invalid" }, null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
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
    if (verified.status !== "completed")
      throw new UsageError("task_repository_configuration_unavailable");
    const context = parseRepositoryProjectContextMarkdown(
      readStableBoundedFileSnapshot(
        path.join(root, "PROJECT_CONTEXT.md"),
        1048576,
      ).bytes.toString("utf8"),
    );
    cancellation = bindTaskCliCancellationSignals(async () =>
      controller.abort(),
    );
    if (cancellation.status !== "bound")
      throw new UsageError("task_cancellation_binding_failed");
    report = {
      command: "task",
      ...(await runTask(
        {
          rootCapability: verified.capability,
          projectId: context.projectId,
          principalId: "local-cli-user",
          authorize: () =>
            resolveVerifiedRepositoryRootFromWorkingDirectory(root) === root,
          consumer: "coordinator_cli",
        },
        command,
        controller.signal,
      )),
    };
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
    let released = cancellation === null;
    try {
      released =
        cancellation === null || cancellation.unbind().status === "released";
    } catch {
      released = false;
    }
    if (!released) {
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
