/**
 * 配布CLIから配送されたOrchestrator業務操作を実行する。
 *
 * @responsibility Project受付・新品初期化の入力、取消、公開結果と終了コードを所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import { runProjectRuntimePublicObjective } from "../task/public-adapter.ts";
import { initializeProjectRuntimeSnapshot } from "../storage/index.ts";
import {
  UsageError,
  readBoundedTaskRequestFromStdin,
} from "../../../coordinator/src/cli/request-input.ts";
import { printCommandReport } from "../../../coordinator/src/cli/command-report.ts";
import { bindTaskCliCancellationSignals } from "../../../coordinator/src/cli/task-cli-cancellation.ts";

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
      const result = initializeProjectRuntimeSnapshot(root, binding);
      process.stdout.write(
        `${JSON.stringify({ command: "project initialize", ...result })}\n`,
      );
      process.exitCode = result.status === "completed" ? 0 : 2;
    } catch {
      process.stdout.write(
        `${JSON.stringify({ command: "project initialize", status: "blocked", reason: "project_runtime_repository_root_not_verified" })}\n`,
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
