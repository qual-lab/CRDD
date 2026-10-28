/**
 * 既存Hostの有限操作を、固定の単段Executorへ接続する。
 * @packageDocumentation
 * @responsibility 本番ではDocker primitiveを注入せず、同一の開始・取消・完了・証拠Ownerを生成する。
 * @trace ARCH-000008
 * @boundary Hostの相関・保存と単段の技術実行の間。
 */
import { createDockerIsolationRuntime } from "../../../docker-isolation/src/index.ts";
import { bindDockerIsolationRuntime } from "./isolation.ts";
import {
  createProviderAttemptRuntime,
  type RuntimeDependencies,
} from "./controller.ts";

/**
 * 上位Hostが所有する検査・保存だけを搬送する。
 * @responsibility 元操作の相関・保存と下位実行の注入境界を分ける。
 * @trace ARCH-000008
 * @shape 元の有限Host操作とPath／Receiptの借用。Process primitiveは含めない。
 * @invariant 一試行へ同じ管理参照・回復参照を結合する。
 * @boundary Coordinator等のHostと固定Executor。
 * @security 任意Command実装・生保存Ownerを渡さない。
 * @compatibility 既存Host操作の引数・返却値を維持する。
 */
export type ProviderExecutorHost = Omit<
  RuntimeDependencies,
  | "effectExecutorAvailable"
  | "startCommand"
  | "startExecution"
  | "cleanupOwnedResources"
  | "verifyCleanupOutcome"
> &
  Parameters<typeof createDockerIsolationRuntime>[0];

/**
 * 固定DIを使う一つのExecutorを構成する。
 * @responsibility controlsと通知二Mapを同じRuntimeに束縛し、上位の実行順序は所有しない。
 * @trace ARCH-000008
 * @input host: 元Owner検査と用途固定の保存操作。
 * @returns 同一試行の開始・取消と、同期通知・終端の照合操作。
 * @precondition Hostは同じ生涯で同じ元Capabilityを管理する。
 * @postcondition 自由なCommand・Process・Platformを本番入力として受け取らない。
 * @effect 構築時はProcess内状態だけを生成する。実操作は明示start後のみ。
 * @failure 下位構成が不正なら例外で停止し、代替Runtimeを起動しない。
 * @invariant 結果・取消・照合は同じRuntimeに属し、Mapを上位へ返さない。
 * @boundary Hostの元操作と固定Docker実行。
 * @security 生出力・秘密値・Mapを返さず、元結果の同一性を維持する。
 * @concurrency 一つのControlの完了待ちを切り離さず、取消は同じsessionへ配送する。
 */
export function createProviderExecutor(host: ProviderExecutorHost) {
  const isolation = bindDockerIsolationRuntime(
    createDockerIsolationRuntime({
      borrowPaths: host.borrowPaths,
      inspectReceipts: host.inspectReceipts,
    }),
    host.borrowPaths,
  );
  const runtime = createProviderAttemptRuntime(
    {
      ...host,
      effectExecutorAvailable: true,
      startExecution: isolation.startExecution,
      cleanupOwnedResources: isolation.cleanupOwnedResources,
      verifyCleanupOutcome: isolation.verifyCleanupOutcome,
    },
    true,
  );
  return Object.freeze({
    start: runtime.start,
    cancel: runtime.cancel,
    verifyProviderSubmissionNotice: runtime.verifyProviderSubmissionNotice,
    verifyUnissuedNotice: runtime.verifyUnissuedNotice,
    borrowTerminalObservations: runtime.borrowTerminalObservations,
    verifyCleanupOutcome: isolation.verifyCleanupOutcome,
  });
}

/**
 * 本番Mapを共有しない有限試験候補を構成する。
 * @responsibility 既存の模擬Process操作を本番AuthorityなしのRuntimeへ閉じる。
 * @trace ARCH-000008
 * @input dependencies: 試験が所有する開始・終了・証拠の有限操作。
 * @returns 開始・取消・元通知・元結果照合を持つ分離Runtime。
 * @precondition 呼出し側が試験資源と各代役の終了を所有する。
 * @postcondition controlsと通知Mapを本番・別候補から分離する。
 * @effect N/A: 構築時はメモリだけで、依存操作はstart後に限る。
 * @failure 無効な開始は既存のblocked結果へ閉じる。
 * @invariant productionAuthorityは常にfalse。
 * @boundary 試験代役と同じ単段Controller実装。
 * @security この候補の結果を本番Verifierは受理しない。
 * @concurrency 取消と終了は同じControlを使用する。
 */
export function createIsolatedDockerProcessControllerCandidate(
  dependencies: RuntimeDependencies,
) {
  return createProviderAttemptRuntime(dependencies, false);
}
