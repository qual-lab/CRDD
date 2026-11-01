/**
 * 合成隔離Probeの技術要求・通知・終了結果を定義する。
 * @packageDocumentation
 * @responsibility Provider実行と別の固定Probe契約を所有し、保存・Task判断を持たない。
 * @trace ARCH-000008
 */

import type { DockerProbeExecutionFacts } from "../../../docker-isolation/src/index.ts";
import type { CompletionCallbacks } from "../lifecycle/callbacks.ts";

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
/**
 * 固定Probeの同期必須通知と受動完了通知を定義する。
 * @responsibility 用途に実在する通知引数と完了条件だけを所有する。
 * @trace ARCH-000008
 * @shape 共通完了通知と用途固有のイベントハンドラー。
 * @invariant 必須通知の失敗後は後続Effectを停止する。
 * @boundary 技術実行と上位の記録・観測。
 * @security Credential・生出力を通知へ追加しない。
 * @compatibility 必須通知の既存同期性と任意完了通知の非待機を維持する。
 */
export interface IsolationProbeCallbacks
  extends CompletionCallbacks<IsolationProbeResult> {
  onCommandSubmitting?(purpose: string): void;
  onResourceCreated?(dockerId: string): void;
}

/** 固定Probe要求。任意ScriptやProvider指定を受け取らない。 */
export type IsolationProbeRequest = Readonly<{
  kind: "isolation_probe";
  probeId: string;
}>;
/**
 * 上位が利用許可を確認した、同じ操作の固定所在。
 * @responsibility 通知と不変の構成値を分ける。
 * @trace ARCH-000008
 * @shape managementと三Mountの固定所在。
 * @invariant 後発変更を新しい許可として採用しない。
 * @boundary Host所有確認と技術操作。
 * @security 保存Writer・Root権限・認証値を含めない。
 * @compatibility 既存Hostの四所在と実体確認を利用する。
 */
export type IsolationProbeMounts = Readonly<{
  management: string;
  workspace: string;
  providerHome: string;
  tmp: string;
}>;

/** 上位が利用許可を確認した固定四所在。 */
export type IsolationProbeOptions = Readonly<{
  mounts: IsolationProbeMounts;
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
  kind: "isolation_probe";
  status: "completed" | "blocked" | "cancelled";
  reason: string | null;
  creationAttempted: boolean;
  containerId: string | null;
  facts: DockerProbeExecutionFacts | null;
  cleanupConfirmed: boolean;
  processCompletionConfirmed: boolean;
  cancelled: boolean;
}>;
