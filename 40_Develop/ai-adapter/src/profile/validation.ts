/**
 * Profileの観測値、実行条件とexact Identityを検査する。
 *
 * @responsibility ProviderとOffering、Role、Modelおよび推論強度の純粋な整合検査を所有する。
 * @trace ARCH-000010
 */
import type { AiReasoningEffort } from "../provider/types.ts";
import type {
  AiSelectionRole,
  ResolvedAiProfileIdentity,
  AiProfileAvailability,
  AiProfileAvailabilityObservation,
} from "./types.ts";

/**
 * exact Model IDが固定CLIへ搬送できる構文か確認する。
 *
 * @responsibility 小文字識別子と128文字以内の既存構文を変更せず検証する。
 * @trace ARCH-000010
 * @input model: 解決済みModel ID。
 * @returns validの入力文字列又はblockedの固定拒否理由。
 * @precondition 入力は文字列であり、Catalog対応の確認は呼出し側が所有する。
 * @postcondition trim、大小文字変換および別Modelへの置換を行わない。
 * @effect N/A: 文字列検査だけを行う。
 * @failure 不正文字、空値または上限超過をblockedで拒否する。
 * @invariant 構文受理をModel提供・実行権限の成立としない。
 * @boundary Profile解決と固定Provider CLI計画の間。
 * @security 空白、制御文字およびCLI引数区切りを受理しない。
 * @concurrency N/A: 共有状態を持たない同期検査である。
 */
export function validateProviderModelId(
  model: string,
): ProviderModelIdValidationResult {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/.test(model)
    ? Object.freeze({ status: "valid", value: model, error: null })
    : Object.freeze({
        status: "blocked",
        value: null,
        error: "provider_model_id_invalid",
      });
}

/**
 * 解決済みProfileが指定RoleでSubscription実行の候補になれるか判定する。
 *
 * @responsibility Provider別Offering、Modelの存在および既定推論強度の許可集合を確認する。
 * @trace ARCH-000010
 * @input profile: 解決済みProfile。requiredRole: 呼出し側が要求する選択Role。
 * @returns 全条件が成立する場合だけtrue。
 * @precondition profileはCatalogから解決済みの型契約に従う。
 * @postcondition trueでも認証、送信Authorityまたは実行成立を主張しない。
 * @effect N/A: Profileの読取りだけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant Model、推論強度およびOfferingを補完・変更しない。
 * @boundary AI AdapterのProfileと実行を所有するConsumerの間。
 * @security API Key fallbackや別Offeringへの暗黙切替を認めない。
 * @concurrency N/A: 共有状態を持たない同期検査である。
 */
export function providerProfileSupportsExecution(
  profile: ResolvedAiProfileIdentity,
  requiredRole: AiSelectionRole,
): boolean {
  return (
    profile.selectionRoles.includes(requiredRole) &&
    profile.exactModelId.length > 0 &&
    profile.allowedReasoningEfforts.includes(profile.defaultReasoningEffort) &&
    ((profile.provider === "codex" &&
      profile.offering === "chatgpt_subscription_oauth") ||
      (profile.provider === "claude" && profile.offering === "claude_max"))
  );
}

/**
 * 明示された実行Identityが解決済みProfileへ完全一致するか判定する。
 *
 * @responsibility Profile ID、Provider、Model、推論強度およびOfferingの変更を検出する。
 * @trace ARCH-000010
 * @input profile: 解決済みProfile。identity: Consumerが搬送する実行Identity。
 * @returns 五項目が一致し、推論強度が許可集合に含まれる場合だけtrue。
 * @precondition 両入力は公開型契約に従い、TaskやCatalog改訂の確認はConsumerが所有する。
 * @postcondition Identityの一致だけを返し、実行条件やAuthorityの成立を主張しない。
 * @effect N/A: 入力の比較だけを行う。
 * @failure 不一致または許可集合外の推論強度をfalseとして返す。
 * @invariant Provider、Modelおよび推論強度をcoerceしない。
 * @boundary Profile解決とConsumerの実行計画の間。
 * @security Prompt、秘密値、PathおよびTask Authorityを入力へ含めない。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
export function providerProfileMatchesExecutionIdentity(
  profile: ResolvedAiProfileIdentity,
  identity: ProviderProfileExecutionIdentity,
): boolean {
  return (
    profile.profileId === identity.profileId &&
    profile.provider === identity.provider &&
    profile.exactModelId === identity.exactModelId &&
    profile.defaultReasoningEffort === identity.reasoningEffort &&
    profile.offering === identity.offering &&
    profile.allowedReasoningEfforts.includes(identity.reasoningEffort)
  );
}

/**
 * Consumerが搬送するProfile実行Identityの値契約。
 *
 * @responsibility 解決済みProfileとの比較に必要な五項目だけを保持する。
 * @trace ARCH-000010
 * @shape Profile ID、Provider、Model、Offeringと推論強度の閉じた値。
 * @invariant Task、Prompt、PathまたはAuthorityを持たない。
 * @boundary AI Adapterと実行計画Consumerの型境界。
 * @security 秘密値や実行Capabilityを表さない。
 * @compatibility Profile Identityの既存値と完全一致で比較する。
 */
export type ProviderProfileExecutionIdentity = Readonly<
  Pick<
    ResolvedAiProfileIdentity,
    "profileId" | "provider" | "exactModelId" | "offering"
  > & {
    reasoningEffort: AiReasoningEffort;
  }
>;

/**
 * Profileの四つの利用可能性軸を一つの表示状態へ投影する。
 *
 * @responsibility 登録、Host、認証、実行Authorityを混同せず状態と理由を返す。
 * @trace ARCH-000010
 * @input observation: 各利用可能性軸の観測結果。
 * @returns available、unavailable、unknownの投影。
 * @precondition nullは未観測でありfalseへ畳まない。
 * @postcondition falseが一つでもあればunavailable、falseがなくnullがあればunknownになる。
 * @effect N/A: 観測値の投影だけを行う。
 * @failure N/A: 閉じたBoolean/null契約を処理する。
 * @invariant 未観測を利用可能として表示しない。
 * @boundary Runtime観測とWorkbench等の表示利用側の境界。
 * @security 認証状態からCredential値を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function evaluateAiProfileAvailability(
  observation: AiProfileAvailabilityObservation,
): AiProfileAvailability {
  const entries = Object.entries(observation) as [
    keyof AiProfileAvailabilityObservation,
    boolean | null,
  ][];
  const unavailableAxes = entries
    .filter(([, isAvailable]) => isAvailable === false)
    .map(([key]) => key);
  const unknownAxes = entries
    .filter(([, isAvailable]) => isAvailable === null)
    .map(([key]) => key);
  return Object.freeze({
    ...observation,
    status:
      unavailableAxes.length > 0
        ? "unavailable"
        : unknownAxes.length > 0
          ? "unknown"
          : "available",
    reasons: Object.freeze(
      unavailableAxes.length > 0 ? unavailableAxes : unknownAxes,
    ),
  });
}

/**
 * Model ID構文の確認値と拒否理由を表す。
 * @responsibility 無変換の構文検査を登録・提供・認証の確認と区別する。
 * @trace ARCH-000010
 * @shape validは入力文字列、blockedは値欠測と固定理由を持つ直和型。
 * @invariant 大小文字補正、空白除去、別Modelへの置換をしない。
 * @boundary Profile検証とProvider計画の値契約。
 * @security Path、秘密値、任意引数、Authorityを発行しない。
 * @compatibility 旧構文の受理集合を維持し、内部結果形だけを変更する。
 */
export type ProviderModelIdValidationResult = Readonly<
  | { status: "valid"; value: string; error: null }
  | { status: "blocked"; value: null; error: "provider_model_id_invalid" }
>;
