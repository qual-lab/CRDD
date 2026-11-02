/**
 * AIツール認証の技術入力・通知・終了結果を定義する。
 * @responsibility 認証実行と資源回収を表し、保存・Home選定・Task判断を含めない。
 * @trace ARCH-000010
 */
import type {
  AiProvider,
  ProviderAuthenticationResult,
} from "../../../ai-adapter/src/index.ts";
import type { ResourceSnapshot } from "../../../docker-isolation/src/index.ts";
import type { CompletionCallbacks } from "../lifecycle/callbacks.ts";

/**
 * 認証の技術構成入力。
 * @responsibility 選択済みHomeと固定用途をExecutorへ渡す。
 * @trace ARCH-000010
 * @shape Provider、status/login、Home、安定suffixとlogin時の短命Proxy token。
 * @invariant Repository・Workspace・任意CLIを受け取らない。
 * @boundary 上位の許可・選定と固定認証構成。
 * @security Providerの認証値を読み取らず、Proxy tokenを通知しない。
 * @compatibility 固定Imageと既存認証条件を維持する。
 */
/**
 * 認証の同期必須通知と受動完了通知を定義する。
 * @responsibility 用途に実在する通知引数と完了条件だけを所有する。
 * @trace ARCH-000008
 * @shape 共通完了通知と用途固有のイベントハンドラー。
 * @invariant 必須通知の失敗後は後続Effectを停止する。
 * @boundary 技術実行と上位の記録・観測。
 * @security Credential・生出力を通知へ追加しない。
 * @compatibility 必須通知の既存同期性と任意完了通知の非待機を維持する。
 */
export interface AuthenticationCallbacks
  extends CompletionCallbacks<AuthenticationCompletionResult>,
    DockerAuthenticationCleanupCallbacks {
  onResourceCreated?(
    receipt: Readonly<{ name: string; dockerId: string }>,
  ): void;
}

/** 選定済みの認証構成。kindで他用途から区別する。 */
export type AuthenticationRequest = Readonly<{
  kind: "authentication";
  provider: AiProvider;
  action: "status" | "login";
  providerHomeSourcePath: string;
  suffix: string;
  proxyToken: string | null;
}>;

/** 上位が排他を保持し、start前に実体を用意する借用管理領域。 */
export type AuthenticationOptions = Readonly<{ managementDirectory: string }>;

/**
 * 上位記録に必要な認証資源の投影。
 * @responsibility 固定資源名と所有相関だけを公開する。
 * @trace ARCH-000010
 * @shape Provider、操作、所有Label、順序付き資源名・種類。
 * @invariant Command・Proxy token・保存先を返さない。
 * @boundary Executor準備と上位Recovery記録。
 * @security 投影値自体は処置権限ではない。
 * @compatibility 既存の資源順序と記録Schemaを維持する。
 */
export type AuthenticationProjection = Readonly<{
  provider: AiProvider;
  action: "status" | "login";
  ownershipLabel: string;
  resources: DockerAuthenticationResources;
}>;

/**
 * 認証実行の非秘密な技術結果。
 * @responsibility 認証三値、一次理由、発行観測とProcess終了を分離する。
 * @trace ARCH-000010
 * @shape reason、authenticationStatus、確認フラグと技術終了。
 * @invariant 正規未ログインを成功扱いするのはstatusだけ。
 * @boundary AI Adapterの結果解析と上位の進行判断。
 * @security stdout・stderr・認証値を返さない。
 * @compatibility 既存理由とunknownを維持し自動再試行しない。
 */
export type AuthenticationResult = Readonly<{
  reason: string;
  authenticationStatus: ProviderAuthenticationResult["status"];
  authenticationConfirmed: boolean;
  providerEffectIssued: boolean;
  processCompletionConfirmed: boolean;
}>;

/** 認証の明示取消。必要な保存は上位が通知先で完了する。 */
export type AuthenticationStartContext = Readonly<{
  signal?: AbortSignal;
}>;

/** 認証の観測事実と、同じ実行の清掃結果。上位保存の完了とは区別する。 */
export type AuthenticationCompletionResult = AuthenticationResult &
  Readonly<{
    kind: "authentication";
    status: "completed" | "blocked" | "cancelled";
    cleanupConfirmed: boolean;
    resourceSnapshot: ResourceSnapshot | null;
  }>;

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
  resourceSnapshot?: ResourceSnapshot;
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
