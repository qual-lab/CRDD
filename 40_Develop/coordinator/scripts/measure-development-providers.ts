/**
 * measure-development-providersに属する責務をまとめる。
 *
 * @responsibility Dependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  ensureRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
} from "../../runtime-data/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../version-control/src/repository-location.ts";
import { assertSupportedCoordinatorNodeRuntime } from "../src/core/node-runtime-version.ts";
import { startRuntimeOwnedDevelopmentCoordinatorTask } from "../src/security/coordinator-task-runtime.ts";
import {
  cancelRuntimeOwnedDevelopmentMeasurementSession,
  inspectRuntimeOwnedDevelopmentMeasurementSession,
  readRuntimeOwnedDevelopmentMeasurementTasks,
  requestRuntimeOwnedDevelopmentMeasurementSession,
} from "../src/security/development-measurement-session.ts";

/**
 * measure-development-providersで使用するDependenciesの値契約を定義する。
 *
 * @responsibility DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Dependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Dependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: Dependenciesの宣言は外部境界を開かない。
 * @security N/A: DependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Dependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Dependencies = Readonly<{
  request: typeof requestRuntimeOwnedDevelopmentMeasurementSession;
  tasks: typeof readRuntimeOwnedDevelopmentMeasurementTasks;
  inspect: typeof inspectRuntimeOwnedDevelopmentMeasurementSession;
  cancel: typeof cancelRuntimeOwnedDevelopmentMeasurementSession;
  start: typeof startRuntimeOwnedDevelopmentCoordinatorTask;
  now: () => number;
}>;

const productionDependencies: Dependencies = Object.freeze({
  request: requestRuntimeOwnedDevelopmentMeasurementSession,
  tasks: readRuntimeOwnedDevelopmentMeasurementTasks,
  inspect: inspectRuntimeOwnedDevelopmentMeasurementSession,
  cancel: cancelRuntimeOwnedDevelopmentMeasurementSession,
  start: startRuntimeOwnedDevelopmentCoordinatorTask,
  now: () => performance.now(),
});

/**
 * Measurementを実行する。
 *
 * @responsibility Measurementの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input configuration: unknown、repositoryRoot: string、signal: AbortSignal、dependencies: Dependencies
 * @returns executeMeasurementの計算結果を返す。
 * @precondition 「configuration: unknown、repositoryRoot: string、signal: AbortSignal、dependencies: Dependencies」がexecuteMeasurementの入力契約を満たす。
 * @postcondition executeMeasurementの責務を完了した結果だけを返す。
 * @effect N/A: executeMeasurementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeMeasurementは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeMeasurementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeMeasurementはProcess内の同一Subsystemで完結する。
 * @security N/A: executeMeasurementはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency executeMeasurementは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeMeasurement(
  configuration: unknown,
  repositoryRoot: string,
  signal: AbortSignal,
  dependencies: Dependencies,
) {
  const admission = await dependencies.request(configuration, signal);
  if (admission.status !== "authorized" || !admission.capability)
    return admission;
  const capability = admission.capability;
  const results: unknown[] = [];
  let completedCount = 0;
  let cleanupConfirmed = true;
  let processRestartRequired = false;
  let manualRecoveryRequired = false;
  let failureReason: string | null = null;
  let incompleteTaskTiming: unknown = null;
  try {
    const tasks = dependencies.tasks(capability);
    if (tasks?.length !== 2) throw new Error("measurement_tasks_unavailable");
    for (const task of tasks) {
      if (signal.aborted) {
        failureReason = "measurement_cancelled";
        break;
      }
      const startedAt = dependencies.now();
      const started = dependencies.start(task, repositoryRoot, capability);
      let result: Awaited<typeof started.completion>;
      try {
        result = await started.completion;
      } finally {
        // Pure snapshot: does not repeat identity checks or acquire authority.
        incompleteTaskTiming = started.readExecutionTiming();
      }
      results.push(
        Object.freeze({
          executorProvider: task.requestedExecutorProvider,
          elapsedMs: Math.max(0, dependencies.now() - startedAt),
          result,
        }),
      );
      incompleteTaskTiming = null;
      if (result.status === "completed") completedCount += 1;
      cleanupConfirmed = result.cleanupConfirmed === true;
      processRestartRequired =
        result.taskResult.processRestartRequired === true;
      manualRecoveryRequired = result.manualRecoveryRequired === true;
      if (
        !cleanupConfirmed ||
        result.manualRecoveryRequired ||
        processRestartRequired
      ) {
        failureReason = "measurement_recovery_or_restart_required";
        break;
      }
      // No Task retry. A clean failure may still be compared with the other
      // preapproved route, subject to the same session's remaining authority.
    }
  } catch {
    failureReason = "measurement_execution_failed_closed";
    cleanupConfirmed = false;
    manualRecoveryRequired = true;
    processRestartRequired = true;
  } finally {
    dependencies.cancel(capability);
  }
  return Object.freeze({
    contract: "crdd-coordinator/development-provider-measurement",
    contractRevision: 2,
    status: completedCount === 2 && cleanupConfirmed ? "completed" : "blocked",
    reason:
      failureReason ??
      (completedCount === 2
        ? "measurement_completed"
        : "measurement_tasks_not_completed"),
    executionSourceKind: "fixed_development_candidate",
    releaseAuthorityConferred: false,
    completedCount,
    results: Object.freeze(results),
    incompleteTaskTiming,
    invocationAccounting: dependencies.inspect(capability),
    cleanupConfirmed,
    manualRecoveryRequired: manualRecoveryRequired || !cleanupConfirmed,
    processRestartRequired,
    taskRetryAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    // Duration is time to runtime result, not human acceptance or a quality score.
    timeToHumanAcceptedResultMeasured: false,
  });
}

/**
 * Development Provider Measurementを実行する。
 *
 * @responsibility Development Provider Measurementの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input configuration: unknown、repositoryRoot: string、signal: AbortSignal
 * @returns runDevelopmentProviderMeasurementの計算結果を返す。
 * @precondition 「configuration: unknown、repositoryRoot: string、signal: AbortSignal」がrunDevelopmentProviderMeasurementの入力契約を満たす。
 * @postcondition runDevelopmentProviderMeasurementの責務を完了した結果だけを返す。
 * @effect N/A: runDevelopmentProviderMeasurementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runDevelopmentProviderMeasurementは独自の失敗分岐を所有しない。
 * @invariant runDevelopmentProviderMeasurementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDevelopmentProviderMeasurementはProcess内の同一Subsystemで完結する。
 * @security N/A: runDevelopmentProviderMeasurementはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runDevelopmentProviderMeasurementは共有非同期状態を持たない同期処理である。
 */
export function runDevelopmentProviderMeasurement(
  configuration: unknown,
  repositoryRoot: string,
  signal: AbortSignal,
) {
  return executeMeasurement(
    configuration,
    repositoryRoot,
    signal,
    productionDependencies,
  );
}

/**
 * Isolated Development Provider Measurement 候補を構築する。
 *
 * @responsibility Isolated Development Provider Measurement 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createIsolatedDevelopmentProviderMeasurementCandidateの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateIsolatedDevelopmentProviderMeasurementCandidateの入力契約を満たす。
 * @postcondition createIsolatedDevelopmentProviderMeasurementCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDevelopmentProviderMeasurementCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedDevelopmentProviderMeasurementCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedDevelopmentProviderMeasurementCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDevelopmentProviderMeasurementCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: createIsolatedDevelopmentProviderMeasurementCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createIsolatedDevelopmentProviderMeasurementCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDevelopmentProviderMeasurementCandidate(
  dependencies: Dependencies,
) {
  return Object.freeze({
    productionAuthority: false,
    run: (
      configuration: unknown,
      repositoryRoot: string,
      signal: AbortSignal,
    ) =>
      executeMeasurement(configuration, repositoryRoot, signal, dependencies),
  });
}

/**
 * Development Measurement Entry 失敗を公開結果へ投影する。
 *
 * @responsibility Development Measurement Entry 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns projectDevelopmentMeasurementEntryFailureの計算結果を返す。
 * @precondition 「error: unknown」がprojectDevelopmentMeasurementEntryFailureの入力契約を満たす。
 * @postcondition projectDevelopmentMeasurementEntryFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectDevelopmentMeasurementEntryFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDevelopmentMeasurementEntryFailureは独自の失敗分岐を所有しない。
 * @invariant projectDevelopmentMeasurementEntryFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDevelopmentMeasurementEntryFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: projectDevelopmentMeasurementEntryFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectDevelopmentMeasurementEntryFailureは共有非同期状態を持たない同期処理である。
 */
export function projectDevelopmentMeasurementEntryFailure(error: unknown) {
  return Object.freeze(
    error instanceof RepositoryRuntimeDataAreaBlockedError
      ? {
          status: "blocked" as const,
          reason: error.reason,
          effectIssued: error.effectIssued,
          effectStateUnknown: error.effectStateUnknown,
          cleanupConfirmed: error.cleanupConfirmed,
          retryAllowed: error.retryAllowed,
          recoveryReference: error.recoveryReference,
        }
      : {
          status: "blocked" as const,
          reason: "measurement_entry_failed_closed",
          effectIssued: false,
          effectStateUnknown: true,
          cleanupConfirmed: false,
          retryAllowed: false,
          recoveryReference: null,
        },
  );
}

/**
 * measure-development-providersのCommand処理を開始する。
 *
 * @responsibility measure-development-providersの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainはFilesystemの読取りまたは書込みを実行する。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  assertSupportedCoordinatorNodeRuntime(process.versions.node);
  if (process.argv.length !== 2)
    throw new Error("measurement_arguments_invalid");
  const root = resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd());
  const verifiedRuntimeRoot = verifyRepositoryRoot(root);
  if (verifiedRuntimeRoot.status !== "completed")
    throw new Error("measurement_runtime_data_path_invalid");
  const testsArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(verifiedRuntimeRoot.capability, "tests"),
    "measurement_runtime_data_path_invalid",
  );
  const directory = path.join(testsArea.directory, "development-measurement");
  const identities = [];
  for (const target of [directory]) {
    const metadata = fs.lstatSync(target);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("measurement_directory_invalid");
    identities.push({
      target,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeMs: metadata.birthtimeMs,
    });
  }
  const inputPath = path.join(
    directory,
    "development-measurement-request.json",
  );
  const metadata = fs.lstatSync(inputPath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > 131_072
  )
    throw new Error("measurement_request_invalid");
  const configuration: unknown = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const result = await runDevelopmentProviderMeasurement(
      configuration,
      root,
      abort.signal,
    );
    for (const identity of identities) {
      const current = fs.lstatSync(identity.target);
      if (
        current.isSymbolicLink() ||
        !current.isDirectory() ||
        current.dev !== identity.dev ||
        current.ino !== identity.ino ||
        current.birthtimeMs !== identity.birthtimeMs ||
        fs.realpathSync.native(identity.target) !== identity.target
      )
        throw new Error("measurement_output_directory_changed");
    }
    fs.writeFileSync(
      path.join(
        directory,
        `development-measurement-result-${Date.now()}-${process.pid}.json`,
      ),
      `${JSON.stringify(result, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === "completed" ? 0 : 2;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify(projectDevelopmentMeasurementEntryFailure(error))}\n`,
    );
    process.exitCode = 2;
  }
}
