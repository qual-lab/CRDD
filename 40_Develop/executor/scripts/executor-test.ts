/**
 * 外部AIを使わないPackage間試験の既存組立てを公開Rootから分離する。
 * @packageDocumentation
 * @responsibility 有限代役と内部検査だけを試験へ接続し製品の入口を増やさない。
 * @trace ARCH-000008
 * @boundary scripts/tests専用。実行許可や本番構成ではない。
 */
export {
  createExecutionRuntime as createExecutorLifecycleTestRuntime,
  createAttemptPreparation,
  createPreparationFailure,
} from "../src/attempt/preparation.ts";
import { createProviderAttemptRuntime } from "../src/attempt/execute.ts";
import type { RuntimeDependencies } from "../src/attempt/types.ts";
export { PREPARATION_LIFETIME_MS } from "../src/attempt/execute.ts";
export type { ExecutorHost } from "../src/attempt/preparation.ts";
export type {
  PreparationHost,
  AttemptPreparation,
  PreparedAttempt,
} from "../src/attempt/types.ts";
export {
  bindIsolationRuntime,
  describeIsolationContract,
} from "../src/attempt/isolation.ts";
export {
  projectAttemptStartResult,
  projectAttemptResult,
} from "../tests/support/result-validation.ts";
export { isAttemptFailureReason } from "../src/result/validation.ts";

/**
 * 本番と状態を共有しない有限代役の試験Runtimeを作る。
 * @responsibility 外部AIなしの試験へ同じLifecycleを接続する。
 * @trace ARCH-000008
 * @input 試験が所有する有限操作。
 * @returns 開始・取消を持つ試験候補。
 * @precondition 試験側が代役の終了と清掃を所有する。
 * @postcondition productionAuthorityは常にfalse。
 * @effect 構築時はメモリだけ。実Effectは試験側の操作に依存する。
 * @failure 無効な開始は既存のblockedへ閉じる。
 * @invariant 本番OwnerのMapやAuthorityを借りない。
 * @boundary Package内の検証接続。
 * @security この候補を本番資格として受理しない。
 * @concurrency 同じControlへ取消とcompletionを結合する。
 */
export function createExecutorTestCandidate(dependencies: RuntimeDependencies) {
  return createProviderAttemptRuntime(dependencies, false);
}
