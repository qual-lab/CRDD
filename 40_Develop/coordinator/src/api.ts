/**
 * Coordinatorの正式操作を利用側へ接続する。
 * @packageDocumentation
 * @responsibility 公開要求を既存Ownerへ接続し、状態・保存・再試行を追加しない。
 * @trace ARCH-000004
 * @boundary CLI／Workbench／MCP等と内部実行Owner。
 * @security Provider Homeの所在・認証情報を公開要求や結果へ含めない。
 */
import { types as utilTypes } from "node:util";
import {
  authenticateProvider as runProviderAuthentication,
  consumeRuntimeOwnedProviderHomeMountSourceCapability,
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
  readProviderAuthenticationCancellation,
} from "./execution/authority.ts";

/**
 * 認証対象だけを指定する公開要求。
 * @responsibility Provider固有引数と秘密Pathを利用側へ要求しない。
 * @trace ARCH-000004
 * @shape 対応Provider一項目。
 * @invariant Repository・追加通信先・CLI引数を含めない。
 * @boundary 公開認証操作。
 * @security 認証値を搬送しない。
 * @compatibility 新形式だけを受理する。
 */
export type AuthenticationRequest = Readonly<{ provider: "codex" | "claude" }>;

/**
 * 認証要求を検査し、現在Userの専用Homeへ接続する。
 * @responsibility 公開要求から内部のHome観測と認証Lifecycleを一度だけ接続する。
 * @trace ARCH-000004
 * @input action: 固定操作、request: Providerだけの要求、signal: 呼出し元の取消。
 * @returns 秘密値を含まない操作結果。
 * @precondition 実認証前に旧記録の移行確認をフロントAIが完了する。
 * @postcondition 不正要求・取消ではHome観測・Docker操作を発行しない。
 * @effect 検査後だけ既存Home観測と認証操作を呼ぶ。
 * @failure Home不明は停止し、別Provider・Host認証へfallbackしない。
 * @invariant 設定・State・Lock・Retryを新設しない。
 * @boundary 公開要求と現在Userの保護Home。
 * @security Proxy／accessorを実行しない。Host Pathを結果へ複製しない。
 * @concurrency 実行中の排他・取消・終了待機は既存Ownerが所有する。
 */
async function runAuthentication(
  action: "status" | "login",
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  const descriptors =
    request &&
    typeof request === "object" &&
    !utilTypes.isProxy(request) &&
    Object.getPrototypeOf(request) === Object.prototype
      ? Object.getOwnPropertyDescriptors(request)
      : null;
  const property = descriptors?.provider;
  const provider = property && "value" in property ? property.value : null;
  if (
    !descriptors ||
    Reflect.ownKeys(descriptors).length !== 1 ||
    !property?.enumerable ||
    (provider !== "codex" && provider !== "claude")
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_input_invalid",
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  const cancellation = readProviderAuthenticationCancellation(signal);
  if (cancellation === null)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_signal_invalid",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  if (cancellation)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_cancelled",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  const observed = inspectRuntimeOwnedWindowsProviderHomeCandidate(provider);
  if (observed.status !== "candidate")
    return Object.freeze({
      status: "blocked",
      reason: observed.reason,
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: observed.helperExitConfirmed === true,
      manualRecoveryRequired: observed.helperExitConfirmed !== true,
      providerEffectIssued: false,
    });
  const consumed = consumeRuntimeOwnedProviderHomeObservationCapability(
    observed.observationCapability,
  );
  const source = consumed
    ? consumeRuntimeOwnedProviderHomeMountSourceCapability(
        consumed.providerHomeMountSourceCapability,
        provider,
      )
    : null;
  if (!consumed || !source)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_provider_home_unavailable",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  return runProviderAuthentication(
    provider,
    action,
    source,
    consumed.stableLogicalHomeBindingHash,
    undefined,
    signal,
  );
}

/**
 * Providerの現在認証状態を隔離環境で確認する。
 * @responsibility 状態確認要求を既存の非対話Lifecycleへ渡す。
 * @trace ARCH-000004
 * @input request: Provider、signal: 取消。
 * @returns 認証済み・未認証・不明と回収結果。
 * @precondition 固定Imageと検証済みHomeが利用可能。
 * @postcondition ログイン・外部通信・認証情報の変更を行わない。
 * @effect 既存Home観測と読取り専用の使い捨てContainerを使用する。
 * @failure 観測不能を未認証へ丸めない。
 * @invariant 状態確認からログインを自動実行しない。
 * @boundary 公開APIと認証実行Owner。
 * @security 認証本文・生出力・Pathを返さない。
 * @concurrency 同じHomeの既存排他へ従う。
 */
export function getAuthenticationStatus(
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  return runAuthentication("status", request, signal);
}

/**
 * Providerの公式対話認証を明示実行する。
 * @responsibility ログイン要求を既存の対話Lifecycleへ渡す。
 * @trace ARCH-000004
 * @input request: Provider、signal: 取消。
 * @returns 認証確認と回収を区別した操作結果。
 * @precondition 呼出し元が対話端末と人間の明示操作を確保する。
 * @postcondition 完了には認証確認・Process終了・資源不存在・保存・Lock解放が必要。
 * @effect 公式認証通信と専用HomeのOAuth更新を既存Ownerへ委譲する。
 * @failure 失敗を再試行せず同じ回復参照を返す。
 * @invariant APIキー・別Offeringへfallbackしない。
 * @boundary 公開APIと認証実行Owner。
 * @security 秘密入力を取得・記録・再表示しない。
 * @concurrency 同じHomeの既存排他へ従う。
 */
export function authenticateProvider(
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  return runAuthentication("login", request, signal);
}
