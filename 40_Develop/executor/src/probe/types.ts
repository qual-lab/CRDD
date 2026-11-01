/**
 * 合成隔離Probeの技術要求・通知・終了結果を定義する。
 * @packageDocumentation
 * @responsibility Provider実行と別の固定Probe契約を所有し、保存・Task判断を持たない。
 * @trace ARCH-000008
 */

import type { DockerProbeExecutionFacts } from "../../../docker-isolation/src/index.ts";
import type { IsolationProbeCallbacks } from "../lifecycle/callbacks.ts";

/**
 * 固定合成Probeの相関。Provider・Model・任意Scriptを指定しない。
 * @responsibility 合成診断とProviderへ送信するProbeの要求を分離する。
 * @trace ARCH-000008
 * @shape 固定kindとUUID v4のProbe ID。
 * @invariant IDは対象識別であり実行許可ではない。
 * @boundary 上位の診断選択とExecutor。
 * @security 任意Script・Image・Credentialを受け取らない。
 * @compatibility 通常AttemptRequestの形式は変えない。
 */
export type IsolationProbeRequest = Readonly<{
  kind: "isolation_probe";
  probeId: string;
}>;
/**
 * 上位が現在Ownerを確認して返す、同じ操作の借用所在。
 * @responsibility 通知と現在所在の読取りQueryを分ける。
 * @trace ARCH-000008
 * @shape managementと三Mount所在の同期Query。
 * @invariant 後発変更を新しい許可として採用しない。
 * @boundary Host所有確認と技術操作。
 * @security 保存Writer・Root権限・認証値を含めない。
 * @compatibility 既存Hostの四所在と実体確認を利用する。
 */
export type IsolationProbeOptions = Readonly<{
  readMounts: () => Readonly<{
    management: string;
    workspace: string;
    providerHome: string;
    tmp: string;
  }>;
}>;

/**
 * 技術観測と回収の結果。Host清掃・最終判断を含まない。
 * @responsibility 作成要求・実ID・技術事実・close・回収を分けて搬送する。
 * @trace ARCH-000008
 * @shape 固定理由、要求事実、nullable実ID／DI事実と独立した終了観測。
 * @invariant cleanupConfirmedからHost清掃やTask成功を推測しない。
 * @boundary 技術結果と上位の保存・最終判断。
 * @security Provider本文や例外本文は公開しない。
 * @compatibility DIの既存事実型を再利用し、上位保存Schemaは変えない。
 */
export type IsolationProbeResult = Readonly<{
  reason: string | null;
  creationAttempted: boolean;
  containerId: string | null;
  facts: DockerProbeExecutionFacts | null;
  cleanupConfirmed: boolean;
  processCompletionConfirmed: boolean;
  cancelled: boolean;
}>;
/**
 * 一回の開始と、同じ生涯へ届く取消。完了は技術回収までを含む。
 * @responsibility 一回の技術生涯と終了待機を公開する。
 * @trace ARCH-000008
 * @shape startのcompletionと、同じSignalへ届くcancel。
 * @invariant Task計画・再試行・保存・永続状態を持たない。
 * @boundary 既存createExecutorの合成Probe overload。
 * @security 任意Processや下位実装を注入する入口を公開しない。
 * @compatibility 通常Provider Attemptの開始・取消契約は変更しない。
 */
export interface IsolationProbeExecutor {
  start(
    callbacks?: IsolationProbeCallbacks,
  ): Readonly<{ completion: Promise<IsolationProbeResult> }>;
  cancel(): void;
}
