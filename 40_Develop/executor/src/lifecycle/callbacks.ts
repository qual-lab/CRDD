/**
 * 共通Lifecycleと用途固有の通知だけを定義する。
 * @responsibility 通知は必要処理を完了してreturnし、判断API・保存APIと区別する。
 * @trace ARCH-000008
 * @boundary 同期認証・Probeと、非同期完了を許すAttemptの既存契約を維持する。
 */
import type {
  DockerIsolationCommand,
  DockerResourceReceipts,
} from "../../../docker-isolation/src/index.ts";
import type {
  AttemptDiagnosticNotice,
  AttemptTerminalObservation,
  CompletionResult,
  ProcessStartedNotice,
} from "../attempt/types.ts";
/**
 * 通常実行と回収で観測した技術資源の事実を上位へ通知する。
 * @responsibility 資源観測と全技術処理終了を区別し、保存方法やACKを所有しない。
 * @trace ARCH-000008
 * @shape Docker用途・実ID通知と二段階終了通知。観測payloadは型引数で指定する。
 * @invariant 同期回収APIでは通知のPromise返却を拒否し、保存未完了で削除へ進まない。
 * @boundary 通常実行のonResourcesClosedは全終了確認後。回収APIではunknownを含む観測集合も通知する。
 * @security 通知発行自体は不存在・Home解放・回収成功の保証ではない。最終段階通知も成功保証ではない。
 * @compatibility Attempt通知だけに使用し、Directory処置へ用途を拡張しない。
 */
export interface ResourceCleanupCallbacks<Observation> {
  onResourceInspecting?(purpose: keyof DockerResourceReceipts): void;
  onResourceIdentified?(
    purpose: keyof DockerResourceReceipts,
    dockerId: string,
  ): void;
  onResourcesClosed?(observation: Observation): void | Promise<void>;
  onCleanupCompleted?(observation: Observation): void | Promise<void>;
}

/**
 * 必要保存は正常return前に完了する。返値ACKは持たない。
 * @responsibility Create予定と確定した実IDを上位へ通知する。
 * @trace ARCH-000008
 * @shape 任意の同期voidハンドラー二つ。
 * @invariant 必須保存の購読は上位が構成し、throw時は次Effectへ進まない。
 * @boundary 技術生涯と保存Owner。
 * @security 生出力・所在・Credentialを通知しない。
 * @compatibility 既存のCreate前・実ID確定後の保存順序を維持する。
 */
export interface IsolationProbeCallbacks {
  onSubmitting?(): void;
  onCreated?(containerId: string): void;
}

/**
 * 各認証操作の前後を伝える同期通知。
 * @responsibility 必須保存の完了を正常returnで伝え、失敗は例外で停止させる。
 * @trace ARCH-000010
 * @shape 用途の開始、作成Receipt、操作終了の通知。
 * @invariant Boolean ACK・生出力・保存関数を通知値へ含めない。
 * @boundary Executorから上位の保存Owner。
 * @security 未完了通知の後に次Effectを発行しない。
 * @compatibility inspect/remove/absenceも既存と同じ順序で通知する。
 */
export interface AuthenticationCallbacks {
  onCommandSubmitting?(purpose: string): void;
  onResourceCreated?(
    receipt: Readonly<{ name: string; dockerId: string }>,
  ): void;
  onCommandCompleted?(): void;
}

/**
 * 単発実行の通知を共通の資源回収通知へ追加する。
 * @responsibility 同じ試行の開始・診断・結果だけを通知する。
 * @trace ARCH-000008
 * @invariant 必要通知は完了後だけ継続し、任意通知は実行結果を変更しない。
 */
export interface ExecutorCallbacks
  extends ResourceCleanupCallbacks<AttemptTerminalObservation> {
  onCommandSubmitting?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onCommandNotIssued?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onProviderSubmitting?(): void | Promise<void>;
  onResourceCreated?(
    purpose: DockerIsolationCommand["purpose"],
    dockerId: string,
  ): void | Promise<void>;
  onStarted?(notice: ProcessStartedNotice): void | Promise<void>;
  onCompleted?(
    result: CompletionResult,
    observation: AttemptTerminalObservation,
  ): void | Promise<void>;
  onDiagnostic?(notice: AttemptDiagnosticNotice): void | Promise<void>;
}
