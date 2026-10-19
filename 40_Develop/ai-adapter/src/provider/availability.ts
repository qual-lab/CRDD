/**
 * Provider利用可能性の純粋な判定を所有する。
 *
 * @responsibility 明示された観測値の意味を判定し、観測・認証・実行Authorityを発行しない。
 * @trace ARCH-000010
 * @boundary Coordinatorから明示的に渡された観測値と利用可能性候補の間。
 */
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import type { AiProvider } from "../catalog/types.ts";

/**
 * Provider観測の確認段階を区別する。
 *
 * @responsibility 確認済み、直前確認候補、要求時確認、利用不可と未観測を別の値にする。
 * @trace ARCH-000010
 * @shape 既存の五つの観測状態からなるliteral union。
 * @invariant unknownとunavailableをconfirmedへ補正しない。
 * @boundary このFileの五軸評価だけで利用する非公開型。
 * @security 状態値自身は実行許可や認証情報を持たない。
 * @compatibility 観測入力の既存文字列値を変更しない。
 */
type ProviderObservationState =
  | "confirmed"
  | "runtime_preflight_required"
  | "bounded_request_check"
  | "unavailable"
  | "unknown";

/**
 * Provider実行候補の五つの観測軸を保持する。
 *
 * @responsibility Capability・認証・利用量・公式配布・方針の状態を別々に扱う。
 * @trace ARCH-000010
 * @shape 各軸はProviderObservationStateを持つ。
 * @invariant 一つの軸の成功から他の軸を確認済みにしない。
 * @boundary 観測Snapshotの検査と利用可能性の純粋評価の間。
 * @security Host Path、秘密値とCapability本体を持たない。
 * @compatibility 既存の五fieldと状態値を維持するFile内型。
 */
type ProviderObservation = Readonly<{
  requiredCapability: ProviderObservationState;
  subscriptionAuth: ProviderObservationState;
  subscriptionQuota: ProviderObservationState;
  officialDistribution: ProviderObservationState;
  policy: ProviderObservationState;
}>;

const OBSERVATION_KEYS = new Set([
  "requiredCapability",
  "subscriptionAuth",
  "subscriptionQuota",
  "officialDistribution",
  "policy",
]);
const OBSERVATION_STATES = new Set([
  "confirmed",
  "runtime_preflight_required",
  "bounded_request_check",
  "unavailable",
  "unknown",
]);

/**
 * Provider観測を実行可能Propertyのない五軸Snapshotへ固定する。
 *
 * @responsibility 五fieldの状態語彙を検証し、所有済みの値だけを返す。
 * @trace ARCH-000010
 * @input 未信頼のrawObservation。
 * @returns 有効な五軸観測、又は不正のnull。
 * @precondition N/A: 任意の未信頼値を受け付ける。
 * @postcondition 元Objectの参照・Getterを後続判定へ持ち込まない。
 * @effect N/A: 入力又は固定値の同期評価だけで、保存・Process・通信を行わない。
 * @failure 未知field、accessor、Proxy、不正状態又は欠落を拒否する。
 * @invariant 実観測を実施せず、入力の確認段階を保持する。
 * @boundary Coordinatorが取得する観測とProviderの純粋な意味判定の間。
 * @security 秘密値・Host Path・実行Authorityを返さない。
 * @concurrency N/A: 共有状態を更新しない同期処理。
 */
function snapshotProviderObservation(rawObservation: unknown) {
  const observation = snapshotPlainRecord(rawObservation, OBSERVATION_KEYS);
  if (
    !observation ||
    !OBSERVATION_STATES.has(observation.requiredCapability as string) ||
    !OBSERVATION_STATES.has(observation.subscriptionAuth as string) ||
    !OBSERVATION_STATES.has(observation.subscriptionQuota as string) ||
    !OBSERVATION_STATES.has(observation.officialDistribution as string) ||
    !OBSERVATION_STATES.has(observation.policy as string)
  ) {
    return null;
  }
  return Object.freeze({
    requiredCapability:
      observation.requiredCapability as ProviderObservationState,
    subscriptionAuth: observation.subscriptionAuth as ProviderObservationState,
    subscriptionQuota:
      observation.subscriptionQuota as ProviderObservationState,
    officialDistribution:
      observation.officialDistribution as ProviderObservationState,
    policy: observation.policy as ProviderObservationState,
  });
}

/**
 * 五軸観測からProviderの利用可能性候補を決める。
 *
 * @responsibility 利用不可の理由優先順と、未観測・実行直前確認候補を区別する。
 * @trace ARCH-000010
 * @input 対象Providerと検査済み観測又はnull。
 * @returns eligible／ineligibleと固定理由の不変値。
 * @precondition 観測の各fieldは既存の状態語彙に限定されている。
 * @postcondition 不正・欠落・unknownをreadyへ昇格しない。
 * @effect N/A: 入力又は固定値の同期評価だけで、保存・Process・通信を行わない。
 * @failure null観測はobservation_unavailable、利用不可は該当軸の優先理由を返す。
 * @invariant 直前確認候補のeligibleを認証成立・実行許可とみなさない。
 * @boundary Coordinatorが取得する観測とProviderの純粋な意味判定の間。
 * @security 秘密値・Host Path・実行Authorityを返さない。
 * @concurrency N/A: 共有状態を更新しない同期処理。
 */
function createEligibility(
  provider: AiProvider,
  observation: ProviderObservation | null,
) {
  if (!observation) {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "observation_unavailable" as const,
    });
  }
  if (observation.requiredCapability === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "required_capability_unavailable" as const,
    });
  }
  if (observation.subscriptionAuth === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "subscription_auth_unavailable" as const,
    });
  }
  if (observation.subscriptionQuota === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "subscription_quota_unavailable" as const,
    });
  }
  if (observation.officialDistribution === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "provider_distribution_unavailable" as const,
    });
  }
  if (observation.policy === "unavailable") {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "policy_blocked" as const,
    });
  }
  if (
    observation.requiredCapability === "confirmed" &&
    ["confirmed", "runtime_preflight_required"].includes(
      observation.officialDistribution,
    ) &&
    ["confirmed", "runtime_preflight_required"].includes(observation.policy) &&
    ["confirmed", "runtime_preflight_required"].includes(
      observation.subscriptionAuth,
    ) &&
    ["confirmed", "bounded_request_check"].includes(
      observation.subscriptionQuota,
    ) &&
    (observation.subscriptionAuth === "runtime_preflight_required" ||
      observation.subscriptionQuota === "bounded_request_check" ||
      observation.officialDistribution === "runtime_preflight_required" ||
      observation.policy === "runtime_preflight_required")
  ) {
    return Object.freeze({
      provider,
      status: "eligible" as const,
      reason: "runtime_preflight_required" as const,
    });
  }
  if (
    observation.requiredCapability !== "confirmed" ||
    observation.subscriptionAuth !== "confirmed" ||
    observation.subscriptionQuota !== "confirmed" ||
    observation.officialDistribution !== "confirmed" ||
    observation.policy !== "confirmed"
  ) {
    return Object.freeze({
      provider,
      status: "ineligible" as const,
      reason: "observation_unavailable" as const,
    });
  }
  return Object.freeze({
    provider,
    status: "eligible" as const,
    reason: "ready" as const,
  });
}

/**
 * 明示観測からProviderの利用可能性候補を判定する。
 *
 * @responsibility 五つの独立した観測軸と未観測・実行直前確認の意味を保持する。
 * @trace ARCH-000010
 * @input provider: 対象Provider、rawObservation: 未信頼な観測Snapshot。
 * @returns eligible／ineligibleと固定理由を持つ不変な候補。
 * @precondition Providerは呼出し側が選択したCodexまたはClaudeである。
 * @postcondition 不明・不正観測を確認済みへ昇格しない。
 * @effect N/A: 入力Snapshotの純粋判定だけを行う。
 * @failure 不正形・欠落はobservation_unavailableとして拒否する。
 * @invariant runtime_preflight_requiredは認証または実行Authority成立を意味しない。
 * @boundary 観測を所有するCoordinatorと意味を判定するAI Adapterの間。
 * @security 秘密値・Host Path・Capabilityを返さない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function evaluateProviderEligibility(
  provider: AiProvider,
  rawObservation: unknown,
) {
  return createEligibility(
    provider,
    snapshotProviderObservation(rawObservation),
  );
}
