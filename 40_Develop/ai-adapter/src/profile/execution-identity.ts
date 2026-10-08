/**
 * 解決済みProfileの実行条件とexact Identityを照合する。
 *
 * @responsibility ProviderとOffering、Role、Modelおよび推論強度の純粋な整合検査を所有する。
 * @trace ARCH-000010
 */
import type {
  AiSelectionRole,
  ResolvedAiProfileIdentity,
} from "../catalog/types.ts";
import type { ProviderProfileExecutionIdentity } from "./types.ts";

/**
 * exact Model IDが固定CLIへ搬送できる構文か確認する。
 *
 * @responsibility 小文字識別子と128文字以内の既存構文を変更せず検証する。
 * @trace ARCH-000010
 * @input model: 解決済みModel ID。
 * @returns 構文が一致した入力自身、またはnull。
 * @precondition 入力は文字列であり、Catalog対応の確認は呼出し側が所有する。
 * @postcondition trim、大小文字変換および別Modelへの置換を行わない。
 * @effect N/A: 文字列検査だけを行う。
 * @failure 不正文字、空値または上限超過をnullで拒否する。
 * @invariant 構文受理をModel提供・実行権限の成立としない。
 * @boundary Profile解決と固定Provider CLI計画の間。
 * @security 空白、制御文字およびCLI引数区切りを受理しない。
 * @concurrency N/A: 共有状態を持たない同期検査である。
 */
export function normalizeProviderExactModelId(model: string): string | null {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/.test(model) ? model : null;
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
