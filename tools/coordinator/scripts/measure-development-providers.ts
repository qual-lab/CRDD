import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { assertSupportedCoordinatorNodeRuntime } from "../src/core/node-runtime-version.ts";

import { startRuntimeOwnedDevelopmentCoordinatorTask } from "../src/security/coordinator-task-runtime.ts";
import {
  cancelRuntimeOwnedDevelopmentMeasurementSession,
  inspectRuntimeOwnedDevelopmentMeasurementSession,
  readRuntimeOwnedDevelopmentMeasurementTasks,
  requestRuntimeOwnedDevelopmentMeasurementSession,
} from "../src/security/development-measurement-session.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../src/security/repository-root-resolution.ts";

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

async function main() {
  assertSupportedCoordinatorNodeRuntime(process.versions.node);
  if (process.argv.length !== 2)
    throw new Error("measurement_arguments_invalid");
  const root = resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd());
  const directory = path.join(root, ".crdd", "dogfooding");
  const identities = [];
  for (const target of [path.join(root, ".crdd"), directory]) {
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
  } catch {
    process.stdout.write(
      `${JSON.stringify({ status: "blocked", reason: "measurement_entry_failed_closed" })}\n`,
    );
    process.exitCode = 2;
  }
}
