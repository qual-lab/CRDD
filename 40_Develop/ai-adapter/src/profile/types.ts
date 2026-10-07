/**
 * Provider利用可能性とProfile実行照合の値契約を定義する。
 *
 * @responsibility 観測軸とexact実行Identityを型として保持し、実観測やAuthorityを発行しない。
 * @trace ARCH-000010
 */
import type {
  AiReasoningEffort,
  ResolvedAiProfileIdentity,
} from "../catalog/types.ts";

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
 * provider-eligibility-runtimeで使用するObservation 状態の値契約を定義する。
 *
 * @responsibility Observation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape ObservationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ObservationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ObservationStateの宣言は外部境界を開かない。
 * @security ObservationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ObservationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ObservationState =
  | "confirmed"
  | "runtime_preflight_required"
  | "bounded_request_check"
  | "unavailable"
  | "unknown";
/**
 * provider-eligibility-runtimeで使用するProvider Observationの値契約を定義する。
 *
 * @responsibility Provider ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape ProviderObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderObservationの宣言は外部境界を開かない。
 * @security ProviderObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProviderObservation = Readonly<{
  requiredCapability: ObservationState;
  subscriptionAuth: ObservationState;
  subscriptionQuota: ObservationState;
  officialDistribution: ObservationState;
  policy: ObservationState;
}>;
