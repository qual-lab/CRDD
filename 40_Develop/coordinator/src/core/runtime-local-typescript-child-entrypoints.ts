import type { SpawnOptions } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, type WorkerOptions } from "node:worker_threads";

const DISTRIBUTION_MODULE_PATH =
  "40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts";

export type RuntimeLocalTypeScriptChildRole =
  | "interactive_console_reader"
  | "candidate_store_lock_worker"
  | "host_operation_lock_supervisor"
  | "signed_recovery_matrix_child";

type RuntimeLocalTypeScriptChildKind = "worker" | "spawn";

type RuntimeLocalTypeScriptChildEntrypoint = Readonly<{
  role: RuntimeLocalTypeScriptChildRole;
  kind: RuntimeLocalTypeScriptChildKind;
  distributionRelativePath: string;
  relativePath: string;
  filePath: string;
}>;

function declareLocalTypeScriptChildEntrypoint(
  role: RuntimeLocalTypeScriptChildRole,
  kind: RuntimeLocalTypeScriptChildKind,
  relativePath: string,
  baseUrl: string,
): RuntimeLocalTypeScriptChildEntrypoint {
  const url = new URL(relativePath, baseUrl);
  const distributionRelativePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(DISTRIBUTION_MODULE_PATH), relativePath),
  );
  return Object.freeze({
    role,
    kind,
    distributionRelativePath,
    relativePath,
    filePath: fileURLToPath(url),
  });
}

const runtimeLocalTypeScriptChildEntrypoints = Object.freeze([
  declareLocalTypeScriptChildEntrypoint(
    "interactive_console_reader",
    "spawn",
    "./interactive-console-reader.ts",
    import.meta.url,
  ),
  declareLocalTypeScriptChildEntrypoint(
    "candidate_store_lock_worker",
    "worker",
    "../security/candidate-store-lock-worker.ts",
    import.meta.url,
  ),
  declareLocalTypeScriptChildEntrypoint(
    "host_operation_lock_supervisor",
    "spawn",
    "../security/host-operation-lock-supervisor.ts",
    import.meta.url,
  ),
  declareLocalTypeScriptChildEntrypoint(
    "signed_recovery_matrix_child",
    "spawn",
    "../../scripts/verify-signed-recovery-matrix.ts",
    import.meta.url,
  ),
]);

const registeredRoles = new Set<RuntimeLocalTypeScriptChildRole>();
const registeredPaths = new Set<string>();
for (const entrypoint of runtimeLocalTypeScriptChildEntrypoints) {
  if (
    registeredRoles.has(entrypoint.role) ||
    registeredPaths.has(entrypoint.distributionRelativePath)
  )
    throw new Error("runtime_local_typescript_child_entrypoint_duplicate");
  registeredRoles.add(entrypoint.role);
  registeredPaths.add(entrypoint.distributionRelativePath);
}

function entrypointFor(
  role: RuntimeLocalTypeScriptChildRole,
  kind: RuntimeLocalTypeScriptChildKind,
) {
  const entrypoint = runtimeLocalTypeScriptChildEntrypoints.find(
    (candidate) => candidate.role === role,
  );
  if (!entrypoint)
    throw new Error("runtime_local_typescript_child_entrypoint_unknown");
  if (entrypoint.kind !== kind)
    throw new Error("runtime_local_typescript_child_entrypoint_kind_mismatch");
  return entrypoint;
}

// Internal read projection for the package observer. The observer rejects
// imports of this function from every other runtime consumer.
export function runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver() {
  return Object.freeze(
    runtimeLocalTypeScriptChildEntrypoints.map((entrypoint) =>
      Object.freeze({
        role: entrypoint.role,
        kind: entrypoint.kind,
        distributionRelativePath: entrypoint.distributionRelativePath,
      }),
    ),
  );
}

export function createRuntimeLocalTypeScriptWorker(
  role: RuntimeLocalTypeScriptChildRole,
  options: WorkerOptions,
) {
  if (options.eval === true)
    throw new Error("runtime_local_typescript_child_worker_eval_forbidden");
  const entrypoint = entrypointFor(role, "worker");
  return new Worker(new URL(entrypoint.relativePath, import.meta.url), options);
}

export function spawnRuntimeLocalTypeScriptChild<T>(
  spawnFactory: (
    executable: string,
    args: readonly string[],
    options: SpawnOptions,
  ) => T,
  role: RuntimeLocalTypeScriptChildRole,
  args: readonly string[],
  options: SpawnOptions,
) {
  if (options.shell === true || typeof options.shell === "string")
    throw new Error("runtime_local_typescript_child_spawn_shell_forbidden");
  const entrypoint = entrypointFor(role, "spawn");
  return spawnFactory(
    process.execPath,
    [entrypoint.filePath, ...args],
    options,
  );
}
