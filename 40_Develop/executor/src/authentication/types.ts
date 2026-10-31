/**
 * AIツール認証の技術入力・通知・終了結果を定義する。
 * @responsibility 認証実行と資源回収を表し、保存・Home選定・Task判断を含めない。
 * @trace ARCH-000010
 */
import type {
  AiProvider,
  ProviderAuthenticationResult,
} from "../../../ai-adapter/src/index.ts";
import type { DockerAuthenticationCommand } from "../../../docker-isolation/src/index.ts";

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
export type AuthenticationRequest = Readonly<{
  provider: AiProvider;
  action: "status" | "login";
  providerHomeSourcePath: string;
  suffix: string;
  proxyToken: string | null;
}>;

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
  resources: readonly Readonly<{
    kind: "container" | "network";
    name: string;
    dockerId: string | null;
  }>[];
}>;

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

/**
 * 認証資源の回収結果。
 * @responsibility 資源不存在とProcess終了を共同評価する。
 * @trace ARCH-000010
 * @shape confirmedとprocessCompletionConfirmed。
 * @invariant 保存・Home解放・上位完了を保証しない。
 * @boundary 技術回収から上位確定。
 * @security 不明なProcessの後に追加Docker操作を発行しない。
 * @compatibility 既存の二軸結果を維持する。
 */
export type AuthenticationCleanupResult = Readonly<{
  confirmed: boolean;
  processCompletionConfirmed: boolean;
}>;

/**
 * 一つの認証構成に結び付いた実行・回収。
 * @responsibility 同じDI Runtimeと終了不明のsticky拒否を維持する。
 * @trace ARCH-000010
 * @shape 資源投影、実行、資源照会付き回収と終了観測。
 * @invariant 保存・権限発行・Home Lockの取得解放を所有しない。
 * @boundary Coordinatorと固定認証技術処理。
 * @security readResourcesは現在記録の読取りQueryで、通知や保存依頼ではない。
 * @compatibility 使い捨てContainerを維持し、通常Attemptと同居・再利用しない。
 */
export interface Authentication {
  readonly projection: AuthenticationProjection;
  execute(
    signal: AbortSignal | undefined,
    assertOwner: () => boolean,
    callbacks?: AuthenticationCallbacks,
  ): Promise<AuthenticationResult>;
  cleanup(
    readResources: () => AuthenticationProjection["resources"] | null,
    assertOwner: () => boolean,
    callbacks?: AuthenticationCallbacks,
  ): Promise<AuthenticationCleanupResult>;
  isProcessCompletionConfirmed(): boolean;
}

/**
 * DIに結合する内部固定Plan。
 * @responsibility 認証条件と元Commandの相関をExecutor内へ閉じる。
 * @trace ARCH-000010
 * @shape Provider、操作、Home、Image、所有Labelと固定操作列。
 * @invariant 公開RootからCommandを渡さない。
 * @boundary 内部準備とDI認証Runtime。
 * @security Workspaceや任意コマンドを許可しない。
 * @compatibility 既存の固定Planと同じ技術値。
 */
export type AuthenticationPlan<
  A extends "status" | "login" = "status" | "login",
> = Readonly<{
  provider: AiProvider;
  action: A;
  providerHomeSourcePath: string;
  providerImageDigest: string;
  ownershipLabel: string;
  probeContainerName: string;
  commands: readonly DockerAuthenticationCommand[];
  ownershipCommands: readonly DockerAuthenticationCommand[];
  cleanupCommands: readonly DockerAuthenticationCommand[];
  absenceCommands: readonly DockerAuthenticationCommand[];
}> &
  (A extends "login"
    ? Readonly<{
        proxyImageDigest: string;
        internalNetworkName: string;
        egressNetworkName: string;
        proxyContainerName: string;
        loginContainerName: string;
      }>
    : object);
