/**
 * 共通Lifecycleと用途固有の通知だけを定義する。
 * @responsibility 通知は必要処理を完了してreturnし、判断API・保存APIと区別する。
 * @trace ARCH-000008
 * @boundary 同期認証・Probeと、非同期完了を許すAttemptの既存契約を維持する。
 */
import type {
  DockerAuthenticationExecution,
  DockerIsolationCommand,
  DockerResourceReceipts,
} from "../../../docker-isolation/src/index.ts";
import type {
  AttemptDiagnosticNotice,
  AttemptTerminalObservation,
  ProcessStartedNotice,
} from "../attempt/types.ts";
import type { CompletionResult, ExecutionKind } from "./types.ts";
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

/** 用途ごとに通知の同期性と既存引数を保持する。 */
interface ResourceCreatedArguments {
  attempt: [purpose: DockerIsolationCommand["purpose"], dockerId: string];
  authentication: [
    receipt: NonNullable<DockerAuthenticationExecution["resourceReceipt"]>,
  ];
  isolation_probe: [dockerId: string];
}

/**
 * 全用途の通知。保存依頼や判断値ではなく、用途に対応する観測を渡す。
 * @responsibility 必須通知の完了と、任意通知の失敗捕捉を区別する。
 * @trace ARCH-000008
 */
export interface ExecutorCallbacks<K extends ExecutionKind = "attempt">
  extends ResourceCleanupCallbacks<AttemptTerminalObservation> {
  onResourceInspecting?: K extends "attempt"
    ? NonNullable<
        ResourceCleanupCallbacks<AttemptTerminalObservation>["onResourceInspecting"]
      >
    : never;
  onResourceIdentified?: K extends "attempt"
    ? NonNullable<
        ResourceCleanupCallbacks<AttemptTerminalObservation>["onResourceIdentified"]
      >
    : never;
  onResourcesClosed?: K extends "attempt"
    ? NonNullable<
        ResourceCleanupCallbacks<AttemptTerminalObservation>["onResourcesClosed"]
      >
    : never;
  onCleanupCompleted?: K extends "attempt"
    ? NonNullable<
        ResourceCleanupCallbacks<AttemptTerminalObservation>["onCleanupCompleted"]
      >
    : never;
  onCommandSubmitting?: K extends "attempt"
    ? (purpose: DockerIsolationCommand["purpose"]) => void | Promise<void>
    : (purpose: string) => void;
  onCommandNotIssued?: K extends "attempt"
    ? (purpose: DockerIsolationCommand["purpose"]) => void | Promise<void>
    : never;
  onProviderSubmitting?: K extends "attempt"
    ? () => void | Promise<void>
    : never;
  onCommandCompleted?: K extends "authentication" ? () => void : never;
  onResourceCreated?: K extends "attempt"
    ? (...args: ResourceCreatedArguments[K]) => void | Promise<void>
    : (...args: ResourceCreatedArguments[K]) => void;
  onStarted?: K extends "attempt"
    ? (notice: ProcessStartedNotice) => void | Promise<void>
    : never;
  onCompleted?(
    result: CompletionResult<K>,
    ...observation: K extends "attempt" ? [AttemptTerminalObservation] : []
  ): void | Promise<void>;
  onDiagnostic?: K extends "attempt"
    ? (notice: AttemptDiagnosticNotice) => void | Promise<void>
    : never;
}
