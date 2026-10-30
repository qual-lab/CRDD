/**
 * Provider利用前の観測状態と固定環境変数を検査する。
 *
 * @responsibility 渡された情報を検証し、利用可能性候補と固定CLI環境の拒否条件を保持する。
 * @trace ARCH-000010
 * @boundary 上位が取得した観測・設定とProvider実行計画の間。
 * @effect N/A: 同期の値検査だけで、実観測・設定保存・Process起動を行わない。
 * @security 検査の成功から認証成立・実行Authority・隔離成立を推定しない。
 */

import type { AiProvider } from "./types.ts";

import { snapshotPlainRecord } from "./input.ts";
import { CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES } from "../claude/plan.ts";
import { CODEX_FORBIDDEN_ENVIRONMENT_NAMES } from "../codex/plan.ts";

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

/**
 * Providerの現在の利用可能性と確認待ちを返す。
 * @responsibility 利用不可・未観測・直前確認待ちを分離する。
 * @trace ARCH-000010
 * @shape Provider、状態、閉じた理由の不変値。
 * @invariant 確認待ちは利用可能または実行許可ではない。
 * @boundary 観測入力と公開評価結果。
 * @security Authority・秘密値を返さない。
 * @compatibility 旧候補語彙への搬送はCoordinatorが所有する。
 */
export type ProviderAvailability = Readonly<
  {
    provider: AiProvider;
  } & (
    | { status: "available"; reason: "ready" }
    | { status: "preflight_required"; reason: "runtime_preflight_required" }
    | { status: "unknown"; reason: "observation_unavailable" }
    | {
        status: "unavailable";
        reason:
          | "required_capability_unavailable"
          | "subscription_auth_unavailable"
          | "subscription_quota_unavailable"
          | "provider_distribution_unavailable"
          | "policy_blocked";
      }
  )
>;

/**
 * 検証した環境値または拒否結果を表す。
 * @responsibility 空の正常環境と拒否を区別する。
 * @trace ARCH-000010
 * @shape readyでは値組、blockedでは固定理由を返す。
 * @invariant 拒否時に部分環境を返さない。
 * @boundary 固定計画と環境搬送。
 * @security 禁止変数を受理しない。
 * @compatibility 検査・値取得順序を維持する。
 */
export type ProviderEnvironmentResult =
  | Readonly<{
      status: "ready";
      entries: readonly (readonly [string, string])[];
    }>
  | Readonly<{ status: "blocked"; reason: "provider_environment_invalid" }>;

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
 * @returns available／unavailable／unknown／preflight_requiredと固定理由の不変値。
 * @precondition 観測の各fieldは既存の状態語彙に限定されている。
 * @postcondition 不正・欠落・unknownをreadyへ昇格しない。
 * @effect N/A: 入力又は固定値の同期評価だけで、保存・Process・通信を行わない。
 * @failure null観測はobservation_unavailable、利用不可は該当軸の優先理由を返す。
 * @invariant preflight_requiredを認証成立・実行許可とみなさない。
 * @boundary Coordinatorが取得する観測とProviderの純粋な意味判定の間。
 * @security 秘密値・Host Path・実行Authorityを返さない。
 * @concurrency N/A: 共有状態を更新しない同期処理。
 */
function createAvailability(
  provider: AiProvider,
  observation: ProviderObservation | null,
): ProviderAvailability {
  if (!observation) {
    return Object.freeze({
      provider,
      status: "unknown" as const,
      reason: "observation_unavailable" as const,
    });
  }
  if (observation.requiredCapability === "unavailable") {
    return Object.freeze({
      provider,
      status: "unavailable" as const,
      reason: "required_capability_unavailable" as const,
    });
  }
  if (observation.subscriptionAuth === "unavailable") {
    return Object.freeze({
      provider,
      status: "unavailable" as const,
      reason: "subscription_auth_unavailable" as const,
    });
  }
  if (observation.subscriptionQuota === "unavailable") {
    return Object.freeze({
      provider,
      status: "unavailable" as const,
      reason: "subscription_quota_unavailable" as const,
    });
  }
  if (observation.officialDistribution === "unavailable") {
    return Object.freeze({
      provider,
      status: "unavailable" as const,
      reason: "provider_distribution_unavailable" as const,
    });
  }
  if (observation.policy === "unavailable") {
    return Object.freeze({
      provider,
      status: "unavailable" as const,
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
      status: "preflight_required" as const,
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
      status: "unknown" as const,
      reason: "observation_unavailable" as const,
    });
  }
  return Object.freeze({
    provider,
    status: "available" as const,
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
export function evaluateProviderAvailability(
  provider: AiProvider,
  rawObservation: unknown,
): ProviderAvailability {
  return createAvailability(
    provider,
    snapshotProviderObservation(rawObservation),
  );
}

const codexForbiddenEnvironmentNames = new Set(
  CODEX_FORBIDDEN_ENVIRONMENT_NAMES,
);
const claudeForbiddenEnvironmentNames = new Set(
  CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES,
);

/**
 * 固定Provider環境の一回Snapshotを検査し、元の順序で返す。
 *
 * @responsibility Provider別禁止環境名、文字列以外の値およびNULを拒否する。
 * @trace ARCH-000010
 * @input provider: 計画のProvider。environment: 固定CLI計画から取得した環境値。
 * @returns readyと取得順の名前・値組、またはblockedと固定拒否理由。
 * @precondition 呼出し側は固定CLI計画を選択済みで、任意環境を実行へ昇格しない。
 * @postcondition 入力を変更せず、一回取得した同じ値を利用側へ返す。
 * @effect N/A: 環境Snapshotを検査するだけでProcessへ設定しない。
 * @failure 禁止名、文字列以外またはNULをblockedで拒否する。取得例外は呼出し側の既存準備失敗境界へ伝播する。
 * @invariant Proxy認証値、Docker引数、MountまたはAuthorityを生成しない。
 * @boundary AI Adapterの固定計画とCoordinatorの環境搬送の間。
 * @security API KeyとProvider接続先の上書きを既存禁止集合で拒否する。
 * @concurrency N/A: 共有集合を変更しない同期検査である。
 */
export function prepareProviderEnvironment(
  provider: AiProvider,
  environment: Readonly<Record<string, string>>,
): ProviderEnvironmentResult {
  const forbiddenNames =
    provider === "codex"
      ? codexForbiddenEnvironmentNames
      : claudeForbiddenEnvironmentNames;
  const entries = Object.entries(environment);
  if (
    entries.some(
      ([name, value]) =>
        forbiddenNames.has(name) ||
        typeof value !== "string" ||
        value.includes("\0"),
    )
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_environment_invalid",
    });
  return Object.freeze({ status: "ready", entries });
}

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
 * @boundary Model選定とProvider CLI計画の間。
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
 * Model ID構文の確認値と拒否理由を表す。
 * @responsibility 無変換の構文検査を登録・提供・認証の確認と区別する。
 * @trace ARCH-000010
 * @shape validは入力文字列、blockedは値欠測と固定理由を持つ直和型。
 * @invariant 大小文字補正、空白除去、別Modelへの置換をしない。
 * @boundary Model構文検査とProvider計画の値契約。
 * @security Path、秘密値、任意引数、Authorityを発行しない。
 * @compatibility 旧構文の受理集合を維持し、内部結果形だけを変更する。
 */
export type ProviderModelIdValidationResult = Readonly<
  | { status: "valid"; value: string; error: null }
  | { status: "blocked"; value: null; error: "provider_model_id_invalid" }
>;
