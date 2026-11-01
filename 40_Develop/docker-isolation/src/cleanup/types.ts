/**
 * Docker技術資源の回収入力と観測結果を定義する。
 * @responsibility 上位の保存形式やTask判断を持たず、元構成とReceiptを表す。
 * @trace ARCH-000008
 */

import type {
  DockerResourceReceipts,
  DockerResourceCleanupObservation,
} from "../execution/execute.ts";
import type { DockerResourceExpectation } from "./plan.ts";

/**
 * 元技術構成から得た回収順と構成候補。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 五つの作成purposeと同用途の技術期待値列。
 * @invariant 元実IDはReceiptから結合し、期待値だけで資源存在や処置許可を示さない。
 * @boundary 通常Session／再入場とDI共通回収。
 * @security 任意コマンド・保存API・上位Ownerを搬送しない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export type DockerResourceExpectationSet = readonly Readonly<{
  purpose: keyof DockerResourceReceipts;
  expectations: readonly Omit<DockerResourceExpectation, "dockerId">[];
}>[];

/**
 * 認証資源回収と同じ技術Processの終了観測。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape confirmedとprocessCompletionConfirmedを分離した結果。
 * @invariant 終了不明を不存在や成功へ補完しない。
 * @boundary DI技術回収からExecutorの結果集約。
 * @security 保存・Home解放・Task完了の成立を含めない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export type AuthenticationCleanupResult = Readonly<{
  confirmed: boolean;
  processCompletionConfirmed: boolean;
}>;

/**
 * 認証回収の固定技術要求前後を通知する。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 同期voidの操作前通知と操作完了通知。
 * @invariant 必要処理完了後にreturnし、例外・誤Promiseは後続Effectを停止する。
 * @boundary DI技術要求と上位の記録通知。
 * @security 許可Query・保存ACK・認証値を受け取らない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export interface DockerAuthenticationCleanupCallbacks {
  onCommandSubmitting?(purpose: string): void;
  onCommandCompleted?(): void;
}

/**
 * 通常実行と再入場の資源観測通知。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 同期voidの観測開始・実ID発見と、void／Promise<void>の資源終了・回収完了。
 * @invariant 必要な同期性は利用契約で固定し、通知発行だけを回収成功にしない。
 * @boundary DIの技術事実からExecutorと上位記録。
 * @security 保存方法・許可を返す操作ではなく、生出力も渡さない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
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
 * 認証で作成した資源の順序・名前と受領済み実ID。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape container／network、固定名、64桁実ID又はnullの不変列。
 * @invariant 元計画と順序・種類・名前を照合し、ID欠測を削除許可にしない。
 * @boundary 認証実行と同じDI通常／単独回収。
 * @security accessor・Proxy・別資源のID混入を拒否する。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export type DockerAuthenticationResources = readonly Readonly<{
  kind: "container" | "network";
  name: string;
  dockerId: string | null;
}>[];

/**
 * 元実行から保存へ搬送する非秘密の技術構成。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 五資源名・所有Label・固定Image・実行／Mount方式。
 * @invariant Task状態・保存場所・過去Effectの成否を定義しない。
 * @boundary DIの元構成、Executor投影、上位保存と再入場。
 * @security この投影は処置権限でなく、実資源との照合が別に必要。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export type DockerResourceProjection = Readonly<{
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
}>;

/**
 * 上位が選定した一つの技術資源集合の回収対象。
 * @responsibility 保存Schemaを持たず、既存技術投影と取消Signalだけを借用する。
 * @trace ARCH-000008
 * @shape resource_set種別、元ID、技術投影、Receipt、config領域と取消Signal。
 * @invariant IDだけで処置を許可せず、明示取消後は新しい処置を開始しない。
 * @boundary 上位で選定済みの対象とExecutor資源API。
 * @security 生の削除Path・権限発行・保存操作を公開しない。
 * @compatibility kindはAPI内の分岐だけで、保存Schemaへ加えない。
 */
export type ResourceTarget = Readonly<{
  kind: "resource_set";
  operationId: string;
  recoveryId: string;
  projection: DockerResourceProjection &
    Readonly<{
      workspaceProtected?: boolean;
      workspaceProtection?: Readonly<{
        gitSourcePath: string;
        internalSourcePath: string;
      }>;
    }>;
  receipts: DockerResourceReceipts;
  previouslyAbsent?: readonly (keyof DockerResourceReceipts)[];
  managementDirectory: string | null;
  signal?: AbortSignal;
}>;

/**
 * 診断だけで得た技術資源の観測。
 * @responsibility 存在・不存在・不明とconfig終了を区別する。
 * @trace ARCH-000008
 * @shape 元ID、資源別観測、理由とconfig終了確認。
 * @invariant 診断の成功を削除許可・保存確定へ昇格しない。
 * @boundary 同期のAttempt観測結果から上位判断。
 * @security 認証内容・生出力・操作権限を含めない。
 * @compatibility 既存Attempt観測の値と同期返却を維持する。
 */
export type ResourceInspection = Readonly<{
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  configCleanupConfirmed: boolean;
  resources: readonly Readonly<{
    purpose: keyof DockerResourceReceipts;
    plannedResourceName: string;
    dockerId: string | null;
    observation: "not_requested" | "present" | "absent" | "unknown";
    absenceObservations: readonly ("absent" | "unknown")[];
  }>[];
}>;

/**
 * Attempt資源の技術回収結果。
 * @responsibility 資源別観測とconfig終了を元のAttemptへ結合して返す。
 * @trace ARCH-000008
 * @shape 元ID、技術回収とconfig終了の個別結果、資源観測。
 * @invariant Docker回収とTask完了・Host清掃・履歴確定を混同しない。
 * @boundary 非同期の資源回収から上位保存・判断。
 * @security 元参照を削除権限へ昇格しない。
 * @compatibility Directory結果のために既存fieldや意味を変更しない。
 */
export type ResourceCleanupResult = Readonly<{
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  dockerCleanupConfirmed: boolean;
  configCleanupConfirmed: boolean;
  resources: readonly DockerResourceCleanupObservation[];
}>;
