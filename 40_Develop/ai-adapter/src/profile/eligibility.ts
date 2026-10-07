/**
 * Provider利用可能性の純粋な判定を所有する。
 *
 * @packageDocumentation
 * @responsibility 明示された観測値の意味を判定し、観測・認証・実行Authorityを発行しない。
 * @trace ARCH-000010
 * @boundary Coordinatorから明示的に渡された観測値と利用可能性候補の間。
 */
import { snapshotPlainRecord } from "../../../domain-model/src/plain-data/index.ts";
import type { AiProvider } from "../catalog/types.ts";
import type { ProviderObservation, ObservationState } from "./types.ts";

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
 * Provider Observationを所有Snapshotへ変換する。
 *
 * @responsibility Provider Observationの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000010
 * @input rawObservation: unknown
 * @returns snapshotProviderObservationの計算結果を返す。
 * @precondition 「rawObservation: unknown」がsnapshotProviderObservationの入力契約を満たす。
 * @postcondition snapshotProviderObservationの責務を完了した結果だけを返す。
 * @effect N/A: snapshotProviderObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotProviderObservationは独自の失敗分岐を所有しない。
 * @invariant snapshotProviderObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotProviderObservationはProcess内の同一Subsystemで完結する。
 * @security snapshotProviderObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotProviderObservationは共有非同期状態を持たない同期処理である。
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
    requiredCapability: observation.requiredCapability as ObservationState,
    subscriptionAuth: observation.subscriptionAuth as ObservationState,
    subscriptionQuota: observation.subscriptionQuota as ObservationState,
    officialDistribution: observation.officialDistribution as ObservationState,
    policy: observation.policy as ObservationState,
  });
}

/**
 * Eligibilityを構築する。
 *
 * @responsibility Eligibilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input provider: Provider、observation: ProviderObservation | null
 * @returns createEligibilityの計算結果を返す。
 * @precondition 「provider: Provider、observation: ProviderObservation | null」がcreateEligibilityの入力契約を満たす。
 * @postcondition createEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: createEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createEligibilityは独自の失敗分岐を所有しない。
 * @invariant createEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createEligibilityはProcess内の同一Subsystemで完結する。
 * @security createEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createEligibilityは共有非同期状態を持たない同期処理である。
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
