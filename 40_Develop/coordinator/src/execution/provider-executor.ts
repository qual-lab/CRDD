/**
 * 単段Executorを既存のHost・保存・回復Ownerへ一度だけ接続する。
 * @responsibility 同じ本番Runtimeの開始・取消・同期証拠照合だけを上位へ渡す。
 * @trace ARCH-000008
 * @boundary CoordinatorのHost管理とExecutorの技術生涯の間。
 */
import { createExecutor } from "../../../executor/src/index.ts";
import {
  completeRuntimeOwnedProviderHomeMount,
  consumeRuntimeOwnedProviderAuthority,
} from "./authority.ts";
import {
  verifyRuntimeOwnedRepositoryOperation,
  borrowOwnedDockerExecutionPaths,
} from "./operation.ts";
import { getRuntimeOwnedProviderDockerAdapter } from "./preparation.ts";
import { createRuntimeOwnedLifecycleNoticeReporter } from "./controller.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  bindRuntimeOwnedDockerInitializationFailure,
  completeRuntimeOwnedDockerRecovery,
  inspectRuntimeOwnedDockerResourceReceipts,
  markRuntimeOwnedDockerResourceSubmission,
  recordRuntimeOwnedDockerProviderSubmission,
  registerRuntimeOwnedReviewFindings,
  recordRuntimeOwnedDockerTerminalObservation,
  recordRuntimeOwnedDockerResourceNotIssued,
  recordRuntimeOwnedDockerResourceReceipt,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedNormalMountCompletion,
  verifyRuntimeOwnedDockerHomeLeaseRelease,
  verifyRuntimeOwnedDockerRecoveryBinding,
} from "./recovery.ts";

const executor = createExecutor({
  verifyRevision: verifyRuntimeOwnedRepositoryOperation,
  consumePreparedPlan: (prepared, management) =>
    getRuntimeOwnedProviderDockerAdapter("claude").consume(
      prepared,
      management,
    ) ??
    getRuntimeOwnedProviderDockerAdapter("codex").consume(prepared, management),
  beginRecovery: beginRuntimeOwnedDockerRecovery,
  bindInitializationFailure: bindRuntimeOwnedDockerInitializationFailure,
  abandonRecovery: abandonRuntimeOwnedDockerRecovery,
  verifyRecoveryBinding: verifyRuntimeOwnedDockerRecoveryBinding,
  completeMount: completeRuntimeOwnedProviderHomeMount,
  completeRecovery: completeRuntimeOwnedDockerRecovery,
  verifyHomeLeaseRelease: verifyRuntimeOwnedDockerHomeLeaseRelease,
  markResourceSubmission: markRuntimeOwnedDockerResourceSubmission,
  recordProviderSubmission: recordRuntimeOwnedDockerProviderSubmission,
  registerReviewFindings: registerRuntimeOwnedReviewFindings,
  recordTerminalObservation: recordRuntimeOwnedDockerTerminalObservation,
  recordResourceNotIssued: recordRuntimeOwnedDockerResourceNotIssued,
  recordResourceReceipt: recordRuntimeOwnedDockerResourceReceipt,
  recordDockerAbsence: recordRuntimeOwnedDockerAbsence,
  recordMountCompletion: recordRuntimeOwnedNormalMountCompletion,
  consumeProviderAuthority: consumeRuntimeOwnedProviderAuthority,
  borrowPaths: borrowOwnedDockerExecutionPaths,
  inspectReceipts: inspectRuntimeOwnedDockerResourceReceipts,
  reportProviderProcessStarted: createRuntimeOwnedLifecycleNoticeReporter(
    process.stderr,
  ),
  reportProviderBoundaryDiagnostic: createRuntimeOwnedLifecycleNoticeReporter(
    process.stderr,
  ),
});

// Host開始保存と実行調停の相互参照では、初期化中にRuntimeを呼ばない。
// 関数宣言だけを束縛し、実呼出しは同じ一つのExecutorへ委譲する。
/**
 * 単段の開始を同じ固定Executorへ渡す。
 * @responsibility Host準備値を新Taskや新Runtimeへ読み替えず配送する。
 * @trace ARCH-000008
 * @input args: 元準備・管理参照・同期回復引渡しと既存制限。
 * @returns 同じExecutorの開始結果とcompletion。
 * @precondition 元Ownerの準備と同意が成立している。
 * @postcondition Task全体の順序を変更しない。
 * @effect Executorの開始・元回復保存と下位実行へ委譲する。
 * @failure 元のblocked／unknownをそのまま返す。
 * @invariant 本番Runtimeを呼出しごとに作らない。
 * @boundary Coordinatorの段階調停と単段実行。
 * @security 任意CLI／Processを追加注入しない。
 * @concurrency 返されたcompletionは上位が終了まで管理する。
 */
export function startRuntimeOwnedDockerProcessController(
  ...args: Parameters<typeof executor.start>
) {
  return executor.start(...args);
}
/**
 * 元の制御参照の取消を同じExecutorへ渡す。
 * @responsibility 取消要求を開始時と同じControlへ結合する。
 * @trace ARCH-000008
 * @input args: 元Controlと管理参照。
 * @returns 元の取消・終了観測結果。
 * @precondition Controlは同じ本番Executorが発行したもの。
 * @postcondition 他OwnerのControlを取り消さない。
 * @effect 同じ下位Sessionへ取消を要求する。
 * @failure 参照不一致は元の拒否結果となる。
 * @invariant 要求成功だけで全資源回収済みとしない。
 * @boundary Task取消と単段Session。
 * @security exact管理参照を補完しない。
 * @concurrency completionの終了責任を取消で切り離さない。
 */
export function cancelRuntimeOwnedDockerProcessController(
  ...args: Parameters<typeof executor.cancel>
) {
  return executor.cancel(...args);
}
/**
 * 固定DI Runtimeの元清掃結果だけを照合する。
 * @responsibility 同じ固定実体が観測した清掃と計画・回復を照合する。
 * @trace ARCH-000008
 * @input args: 元清掃結果・計画・回復と管理参照。
 * @returns 元資源観測又は拒否null。
 * @precondition 下位清掃を同じRuntimeで実行済み。
 * @postcondition 未観測資源の不存在を補完しない。
 * @effect N/A: 下位の元証拠照合だけ。
 * @failure 別Runtime・複製・相関差は拒否する。
 * @invariant Host清掃とDocker清掃を同一視しない。
 * @boundary 下位資源観測とHost遷移確定。
 * @security 状態値だけで清掃真正性を認定しない。
 * @concurrency 同じ元結果を同期照合する。
 */
export function verifyRuntimeOwnedDockerCleanupOutcome(
  ...args: Parameters<typeof executor.verifyCleanupOutcome>
) {
  return executor.verifyCleanupOutcome(...args);
}
