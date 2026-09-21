import { type SpawnOptions, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, type WorkerOptions } from "node:worker_threads";

const DISTRIBUTION_MODULE_PATH =
  "40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts";

/**
 * RuntimeLocalTypeScriptChildRoleが扱う値の構造を表す。
 *
 * @responsibility RuntimeLocalTypeScriptChildRoleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape RuntimeLocalTypeScriptChildRoleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeLocalTypeScriptChildRoleで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeLocalTypeScriptChildRoleの宣言は外部境界を開かない。
 * @security N/A: RuntimeLocalTypeScriptChildRoleはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeLocalTypeScriptChildRoleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RuntimeLocalTypeScriptChildRole =
  | "interactive_console_reader"
  | "candidate_store_lock_worker"
  | "host_operation_lock_supervisor"
  | "signed_recovery_matrix_child";

/**
 * RuntimeLocalTypeScriptChildKindが扱う値の構造を表す。
 *
 * @responsibility RuntimeLocalTypeScriptChildKindに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape RuntimeLocalTypeScriptChildKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeLocalTypeScriptChildKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeLocalTypeScriptChildKindの宣言は外部境界を開かない。
 * @security N/A: RuntimeLocalTypeScriptChildKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeLocalTypeScriptChildKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeLocalTypeScriptChildKind = "worker" | "spawn";

/**
 * RuntimeLocalTypeScriptChildEntrypointが扱う値の構造を表す。
 *
 * @responsibility RuntimeLocalTypeScriptChildEntrypointに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape RuntimeLocalTypeScriptChildEntrypointが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeLocalTypeScriptChildEntrypointで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeLocalTypeScriptChildEntrypointの宣言は外部境界を開かない。
 * @security N/A: RuntimeLocalTypeScriptChildEntrypointはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeLocalTypeScriptChildEntrypointの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeLocalTypeScriptChildEntrypoint = Readonly<{
  role: RuntimeLocalTypeScriptChildRole;
  kind: RuntimeLocalTypeScriptChildKind;
  distributionRelativePath: string;
  relativePath: string;
  filePath: string;
}>;

/**
 * declareLocalTypeScriptChildEntrypointの処理を実行する。
 *
 * @responsibility declareLocalTypeScriptChildEntrypointに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input role: RuntimeLocalTypeScriptChildRole、kind: RuntimeLocalTypeScriptChildKind、relativePath: string、baseUrl: string
 * @returns RuntimeLocalTypeScriptChildEntrypointを返す。
 * @precondition 「role: RuntimeLocalTypeScriptChildRole、kind: RuntimeLocalTypeScriptChildKind、relativePath: string、baseUrl: string」がdeclareLocalTypeScriptChildEntrypointの入力契約を満たす。
 * @postcondition declareLocalTypeScriptChildEntrypointの責務を完了した結果だけを返す。
 * @effect N/A: declareLocalTypeScriptChildEntrypointは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: declareLocalTypeScriptChildEntrypointは独自の失敗分岐を所有しない。
 * @invariant declareLocalTypeScriptChildEntrypointは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: declareLocalTypeScriptChildEntrypointはProcess内の同一Subsystemで完結する。
 * @security N/A: declareLocalTypeScriptChildEntrypointはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: declareLocalTypeScriptChildEntrypointは共有非同期状態を持たない同期処理である。
 */
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

/**
 * entrypointForの処理を実行する。
 *
 * @responsibility entrypointForに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input role: RuntimeLocalTypeScriptChildRole、kind: RuntimeLocalTypeScriptChildKind
 * @returns entrypointForの計算結果を返す。
 * @precondition 「role: RuntimeLocalTypeScriptChildRole、kind: RuntimeLocalTypeScriptChildKind」がentrypointForの入力契約を満たす。
 * @postcondition entrypointForの責務を完了した結果だけを返す。
 * @effect N/A: entrypointForは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure entrypointForは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant entrypointForは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: entrypointForはProcess内の同一Subsystemで完結する。
 * @security N/A: entrypointForはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: entrypointForは共有非同期状態を持たない同期処理である。
 */
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
/**
 * runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverの処理を実行する。
 *
 * @responsibility runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がruntimeLocalTypeScriptChildRegistrySnapshotForPackageObserverの入力契約を満たす。
 * @postcondition runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverの責務を完了した結果だけを返す。
 * @effect N/A: runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverは独自の失敗分岐を所有しない。
 * @invariant runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverはProcess内の同一Subsystemで完結する。
 * @security N/A: runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserverは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createRuntimeLocalTypeScriptWorkerの処理を実行する。
 *
 * @responsibility createRuntimeLocalTypeScriptWorkerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input role: RuntimeLocalTypeScriptChildRole、options: WorkerOptions
 * @returns createRuntimeLocalTypeScriptWorkerの計算結果を返す。
 * @precondition 「role: RuntimeLocalTypeScriptChildRole、options: WorkerOptions」がcreateRuntimeLocalTypeScriptWorkerの入力契約を満たす。
 * @postcondition createRuntimeLocalTypeScriptWorkerの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeLocalTypeScriptWorkerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeLocalTypeScriptWorkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeLocalTypeScriptWorkerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeLocalTypeScriptWorkerはProcess内の同一Subsystemで完結する。
 * @security N/A: createRuntimeLocalTypeScriptWorkerはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRuntimeLocalTypeScriptWorkerは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeLocalTypeScriptWorker(
  role: RuntimeLocalTypeScriptChildRole,
  options: WorkerOptions,
) {
  if (options.eval === true)
    throw new Error("runtime_local_typescript_child_worker_eval_forbidden");
  const entrypoint = entrypointFor(role, "worker");
  return new Worker(new URL(entrypoint.relativePath, import.meta.url), options);
}

/**
 * spawnRuntimeLocalTypeScriptChildの処理を実行する。
 *
 * @responsibility spawnRuntimeLocalTypeScriptChildに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input role: RuntimeLocalTypeScriptChildRole、args: readonly string[]、options: SpawnOptions
 * @returns spawnRuntimeLocalTypeScriptChildの計算結果を返す。
 * @precondition 「role: RuntimeLocalTypeScriptChildRole、args: readonly string[]、options: SpawnOptions」がspawnRuntimeLocalTypeScriptChildの入力契約を満たす。
 * @postcondition spawnRuntimeLocalTypeScriptChildの責務を完了した結果だけを返す。
 * @effect spawnRuntimeLocalTypeScriptChildは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure spawnRuntimeLocalTypeScriptChildは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant spawnRuntimeLocalTypeScriptChildは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: spawnRuntimeLocalTypeScriptChildはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: spawnRuntimeLocalTypeScriptChildは共有非同期状態を持たない同期処理である。
 */
export function spawnRuntimeLocalTypeScriptChild(
  role: RuntimeLocalTypeScriptChildRole,
  args: readonly string[],
  options: SpawnOptions,
) {
  if (options.shell === true || typeof options.shell === "string")
    throw new Error("runtime_local_typescript_child_spawn_shell_forbidden");
  const entrypoint = entrypointFor(role, "spawn");
  return spawn(process.execPath, [entrypoint.filePath, ...args], options);
}
