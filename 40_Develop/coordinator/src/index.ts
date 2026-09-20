/**
 * Coordinatorが外部利用者へ公開するProject Runtime操作境界。
 * @packageDocumentation
 * @responsibility 認証済み主体の要求を公開Contractへ接続する。
 * @trace ARCH-000004
 * @boundary 利用者入口とCoordinator Runtimeの境界。
 * @effect 許可されたProject Runtime操作から状態更新または外部実行を発行し得る。
 * @security 観測済み主体と許可されたOperationだけをRuntimeへ接続する。
 */
export {
  observeRuntimeOwnedProjectClientPrincipal,
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
  runProjectRuntimePublicStateQuery,
} from "./composition/project-runtime-public-adapter.ts";

export { isSupportedCoordinatorNodeRuntime } from "./core/node-runtime-version.ts";
