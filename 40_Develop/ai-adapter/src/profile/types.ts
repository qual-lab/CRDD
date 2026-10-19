/**
 * Profile実行照合の値契約を定義する。
 *
 * @responsibility exact実行Identityを保持し、選定・認証・実行Authorityを所有しない。
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
