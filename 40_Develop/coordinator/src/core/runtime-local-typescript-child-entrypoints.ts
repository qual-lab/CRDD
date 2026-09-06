import type { SpawnOptions } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, type WorkerOptions } from "node:worker_threads";

const DISTRIBUTION_MODULE_PATH =
  "40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts";

export type RuntimeLocalTypeScriptChildRole =
  | "interactive_console_reader"
  | "candidate_store_lock_worker"
  | "host_operation_lock_supervisor";

export type RuntimeLocalTypeScriptChildEntrypoint = Readonly<{
  role: RuntimeLocalTypeScriptChildRole;
  distributionRelativePath: string;
  url: URL;
  filePath: string;
}>;

function declareLocalTypeScriptChildEntrypoint(
  role: RuntimeLocalTypeScriptChildRole,
  relativePath: string,
  baseUrl: string,
): RuntimeLocalTypeScriptChildEntrypoint {
  const url = new URL(relativePath, baseUrl);
  const distributionRelativePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(DISTRIBUTION_MODULE_PATH), relativePath),
  );
  return Object.freeze({
    role,
    distributionRelativePath,
    url,
    filePath: fileURLToPath(url),
  });
}

export const RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS = Object.freeze([
  declareLocalTypeScriptChildEntrypoint(
    "interactive_console_reader",
    "./interactive-console-reader.ts",
    import.meta.url,
  ),
  declareLocalTypeScriptChildEntrypoint(
    "candidate_store_lock_worker",
    "../security/candidate-store-lock-worker.ts",
    import.meta.url,
  ),
  declareLocalTypeScriptChildEntrypoint(
    "host_operation_lock_supervisor",
    "../security/host-operation-lock-supervisor.ts",
    import.meta.url,
  ),
]);

export function runtimeLocalTypeScriptChildEntrypoint(
  role: RuntimeLocalTypeScriptChildRole,
) {
  const entrypoint = RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS.find(
    (candidate) => candidate.role === role,
  );
  if (!entrypoint)
    throw new Error("runtime_local_typescript_child_entrypoint_unknown");
  return entrypoint;
}

export function createRuntimeLocalTypeScriptWorker(
  entrypoint: RuntimeLocalTypeScriptChildEntrypoint,
  options: WorkerOptions,
) {
  return new Worker(entrypoint.url, options);
}

export function spawnRuntimeLocalTypeScriptChild<T>(
  spawnFactory: (
    executable: string,
    args: readonly string[],
    options: SpawnOptions,
  ) => T,
  entrypoint: RuntimeLocalTypeScriptChildEntrypoint,
  args: readonly string[],
  options: SpawnOptions,
) {
  return spawnFactory(
    process.execPath,
    [entrypoint.filePath, ...args],
    options,
  );
}
