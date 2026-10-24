/**
 * 環境診断・回復のCLI受付を正式APIへ接続する。
 * @responsibility 引数、現在Root、取消Listenerと安全な表示を所有する。
 * @trace ARCH-000004 ARCH-000008
 */
import {
  diagnoseEnvironment,
  recoverExecution,
  restartDockerForRecovery,
  repairDockerRuntime,
  retainRepair,
} from "../api.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { parseDoctorArguments, UsageError } from "./options.ts";
import {
  renderDockerRecoveryDoctorReport,
  renderDoctorCommandFailure,
} from "./recovery-report.ts";
import { bindTaskCliCancellationSignals } from "./cancellation.ts";

/**
 * 診断・回復Commandを一回実行し、取消解除後に結果を表示する。
 * @responsibility CLIの接続条件だけを検査し、回復種別の判断と処置は正式APIへ委譲する。
 * @trace ARCH-000004 ARCH-000008
 * @input arguments_: 対象、操作、任意のexact参照と--json。
 * @returns 終了値を設定して完了する。
 * @precondition 共通受付でNode版を確認済み。
 * @postcondition 一回の操作を待機しListener解除を確認してから一回表示する。
 * @effect 診断は局所観測用の一時領域を作る場合があり、厳密なEffect 0ではない。
 * @failure 入力拒否64、操作失敗2。解除失敗で一次理由を上書きしない。
 * @invariant 表示失敗による再実行や自動再起動をしない。
 * @boundary 端末と正式API。内部のRoot・Scope・checkpointを追加公開しない。
 * @security Rootは現在Repositoryから検証し、任意Pathを受け取らない。
 * @concurrency 取消を同じSignalへ伝え、finallyでListenerを解除する。
 */
export async function runDoctorCommand(
  arguments_: readonly string[],
): Promise<void> {
  const json = arguments_.includes("--json");
  try {
    const parsed = parseDoctorArguments(arguments_, undefined);
    if (parsed.status !== "ok" || !parsed.value)
      throw new UsageError(parsed.reason ?? "doctor_arguments_invalid");
    const options = parsed.value;
    const verified = verifyRepositoryRoot(
      resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
    );
    if (verified.status !== "completed")
      throw new Error("coordinator_repository_root_not_verified");
    const context = { rootCapability: verified.capability };
    let report: Readonly<Record<string, unknown>>;
    let cliCleanupConfirmed = true;
    if (options.action === "check" || options.action === "isolation") {
      report = diagnoseEnvironment(
        { activeIsolation: options.action === "isolation" },
        context,
      );
    } else {
      const recoveryId = options.recoveryId;
      const repair =
        options.action === "repair-docker" ||
        options.action === "retain-repair" ||
        recoveryId?.startsWith("docker-runtime-repair.") === true;
      if (
        ["resume", "restart-docker", "retain-repair"].includes(
          options.action,
        ) &&
        recoveryId === null
      )
        throw new UsageError("doctor_arguments_invalid");
      const controller = new AbortController();
      const binding = bindTaskCliCancellationSignals(async () =>
        controller.abort(),
      );
      let result: Readonly<Record<string, unknown>> = {
        status: "blocked",
        reason: repair
          ? "runtime_repair_cancellation_binding_failed"
          : "coordinator_cli_cancellation_binding_failed",
        recoveryId,
        cleanupConfirmed: false,
        restartCompleted: false,
        taskRecoveryCompleted: false,
        ...(repair
          ? {
              finalCheckpointConfirmed: false,
              outcomeConfirmed: false,
              retentionConfirmed: false,
              retentionReviewAfter: null,
              historyConfirmed: false,
              completionConfirmed: false,
              nativeCleanupConfirmed: false,
            }
          : {}),
      };
      cliCleanupConfirmed = false;
      try {
        if (binding.status === "bound") {
          if (options.action === "resume" && recoveryId !== null)
            result = await recoverExecution(
              { recoveryId },
              context,
              controller.signal,
            );
          else if (options.action === "restart-docker" && recoveryId !== null)
            result = await restartDockerForRecovery(
              { recoveryId },
              context,
              controller.signal,
            );
          else if (options.action === "retain-repair" && recoveryId !== null)
            result = await retainRepair(
              { recoveryId },
              context,
              controller.signal,
            );
          else
            result = await repairDockerRuntime(
              null,
              context,
              controller.signal,
            );
        }
      } finally {
        try {
          cliCleanupConfirmed = binding.unbind().status === "released";
        } catch {
          cliCleanupConfirmed = false;
        }
      }
      report = {
        ...result,
        ...(repair
          ? { contract: "crdd-coordinator/current-runtime-repair" }
          : options.action === "restart-docker"
            ? { contract: "crdd-coordinator/docker-restart-for-recovery" }
            : {}),
        cliCleanupConfirmed,
        cliCleanupReason: cliCleanupConfirmed
          ? null
          : repair
            ? "runtime_repair_cli_cleanup_unconfirmed"
            : "docker_task_recovery_cli_cleanup_unconfirmed",
      };
    }
    const rendered = renderDockerRecoveryDoctorReport(report, json);
    process.stdout.write(rendered.stdout);
    process.exitCode = cliCleanupConfirmed ? rendered.exitCode : 2;
  } catch (error) {
    const failure = renderDoctorCommandFailure(error);
    (json ? process.stdout : process.stderr).write(
      json ? failure.json : failure.human,
    );
    process.exitCode = error instanceof UsageError ? 64 : failure.exitCode;
  }
}
