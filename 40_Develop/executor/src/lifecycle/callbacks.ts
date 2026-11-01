/**
 * 共通の受動完了通知と用途別通知の対応を定義する。
 * @responsibility 通知の完了条件を用途別Ownerへ残し、不要Propertyを合成しない。
 * @trace ARCH-000008
 * @boundary 技術実行と上位の観測・保存。
 */
import type { DockerResourceReceipts } from "../../../docker-isolation/src/index.ts";
import type { AttemptCallbacks } from "../attempt/types.ts";
import type { AuthenticationCallbacks } from "../authentication/types.ts";
import type { IsolationProbeCallbacks } from "../probe/types.ts";
import type { ExecutionKind } from "./types.ts";

/**
 * 結果固定後の任意通知。必須終端保存にはcompletionの結果を使う。
 * @responsibility 同じ確定結果を通知し、通知失敗で結果を変えない。
 * @trace ARCH-000008
 * @shape 結果と用途に実在する補足引数。
 * @invariant 通知のreturnは上位保存確定を意味しない。
 * @boundary 単発実行から受動利用側。
 * @security 生出力や新しい権限を追加しない。
 * @compatibility 同期例外と非同期Rejectを捕捉し、待機しない。
 */
export interface CompletionCallbacks<
  TResult,
  TObservation extends unknown[] = [],
> {
  onCompleted?(
    result: TResult,
    ...observation: TObservation
  ): void | Promise<void>;
}

/**
 * 通常実行と回収で観測した技術資源を通知する。
 * @responsibility 同期回収APIと通常実行の既存通知順序を維持する。
 * @trace ARCH-000008
 * @shape 実IDと二段階終了観測。
 * @invariant 回収APIの同期通知は保存完了後にreturnする。
 * @boundary 技術回収と上位保存Owner。
 * @security 通知だけで不存在・Home解放を証明しない。
 * @compatibility 通常実行の終了通知はPromise完了を待つ。
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
 * 各用途が所有する通知interfaceの対応。
 * @responsibility 同じ公開名から用途の通知契約を選ぶ。
 * @trace ARCH-000008
 * @shape 用途Kと既存引数・同期性を持つinterface。
 * @invariant 非該当Propertyをneverで削る方式を使わない。
 * @boundary 公開型と各用途の通知Owner。
 * @security 必須保存通知を受動通知へ変えない。
 * @compatibility 公開型引数と既存通知名を維持する。
 */
export type ExecutorCallbacks<K extends ExecutionKind = ExecutionKind> =
  Callbacks[K];
interface Callbacks {
  attempt: AttemptCallbacks;
  authentication: AuthenticationCallbacks;
  isolation_probe: IsolationProbeCallbacks;
}
