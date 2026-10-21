/**
 * 配布CLIから配送されたOrchestrator業務操作を実行する。
 *
 * @responsibility Project受付・新品初期化の入力、取消、公開結果と終了コードを所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  parseRepositoryProjectContextMarkdown,
  readStableBoundedFileSnapshot,
} from "../../../domain-model/src/index.ts";
import { createRepositoryAiProfileCatalogStore } from "../../../ai-adapter/src/index.ts";
import { createRepositoryTaskRequests } from "../task/request-composition.ts";
import { inspectSingleTaskCommand } from "../task/requests.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { runOrchestratorPublicObjective } from "../index.ts";
import { initializeOrchestratorSnapshot } from "../storage/current-state.ts";
import {
  UsageError,
  readBoundedTaskRequestFromStdin,
} from "./request-input.ts";
import { printCommandReport } from "./command-report.ts";
import { bindTaskCliCancellationSignals } from "../../../coordinator/src/cli/task-cancellation.ts";

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
      const result = initializeOrchestratorSnapshot(root, binding);
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
  let result: Awaited<ReturnType<typeof runOrchestratorPublicObjective>>;
  let released: ReturnType<typeof binding.unbind> | undefined;
  try {
    result = await runOrchestratorPublicObjective(request, controller.signal);
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
 * 通常Task CLIを共通の単発Ownerと上位の対象解決へ接続する。
 * @responsibility 明示Workspace、既存Profile、取消joinと結果公開。
 * @trace ARCH-000004 ARCH-000012
 * @input --request-stdin --jsonと共通SingleTaskCommand。
 * @returns 終端を一回出力する。
 * @effect 既存Ownerの受付・保存・AI実行。入力拒否では開始しない。
 * @failure 対象省略、旧Task形式、Root／Context不明は開始前停止。
 * @invariant Workspace選択をCoordinatorへ委譲せず、未指定をDirect化しない。
 * @boundary 配布CLIからOrchestrator。新しい台帳・Lock・Recoveryなし。
 */
export async function runSingleTaskCommand(args: readonly string[]) {
  if (
    args.length !== 2 ||
    args[0] !== "--request-stdin" ||
    args[1] !== "--json"
  ) {
    printCommandReport(
      { command: "task", status: "blocked", reason: "task_arguments_invalid" },
      true,
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
