/**
 * Providerに共通するDocker準備候補の取消と一回消費を所有する。
 *
 * @responsibility 管理Capability一致、二時計期限、権限失効とHome Lease解放を同じ順序で適用する。
 * @trace ARCH-000015
 */
import type {
  ProviderPreparationLifecycleState,
  ProviderPreparedPlanLifecycle,
} from "./types.ts";

export const PROVIDER_PREPARATION_LIFETIME_MS = 30_000;

/**
 * 同じ管理Capabilityへ結合した準備計画だけを取得する。
 *
 * @responsibility 二WeakMapの参照一致と具体計画の取得を所有する。
 * @trace ARCH-000015
 * @input state: 既存準備状態。preparedCapability: 候補参照。managementCapability: 管理参照。
 * @returns 一致する具体計画、またはnull。
 * @precondition stateはProvider準備Ownerが保持する既存Storeである。
 * @postcondition 他Providerや別管理者の計画を返さない。
 * @effect N/A: 二Storeの読取りだけを行う。
 * @failure 不正参照、未登録または管理不一致をnullで拒否する。
 * @invariant objectの内容や名前からCapabilityを再構成しない。
 * @boundary Coordinator内の不透明参照と準備Storeの間。
 * @security 管理Capabilityは値でなく参照Identityで照合する。
 * @concurrency N/A: 同一Process内の同期検査である。
 */
function findProviderPreparedPlan<T extends ProviderPreparedPlanLifecycle>(
  state: ProviderPreparationLifecycleState<T>,
  preparedCapability: unknown,
  managementCapability: unknown,
): T | null {
  if (!preparedCapability || typeof preparedCapability !== "object")
    return null;
  const plan = state.prepared.get(preparedCapability);
  const management = state.managementCapabilities.get(preparedCapability);
  if (!plan || management !== managementCapability) return null;
  return plan;
}

/**
 * 準備候補の二時計期限を確認する。
 *
 * @responsibility 両時計が有限で逆行せず30秒未満の場合だけ新鮮と判定する。
 * @trace ARCH-000015
 * @input state: 時計Owner。plan: 準備時刻を持つ具体計画。
 * @returns 両時計条件が成立する場合だけtrue。
 * @precondition planは同じOwnerのStoreから取得済みである。
 * @postcondition 一方の時計だけで期限を延長しない。
 * @effect N/A: 時計の読取りだけを行う。
 * @failure 非有限値、逆行、30秒以上をfalseとして扱う。
 * @invariant 既存の30秒境界と二時計判定を維持する。
 * @boundary 準備時刻と消費・取消時刻の間。
 * @security 時計不明を有効なCapabilityへ補正しない。
 * @concurrency N/A: 同期判定であり待機しない。
 */
function providerPreparedPlanIsFresh<T extends ProviderPreparedPlanLifecycle>(
  state: ProviderPreparationLifecycleState<T>,
  plan: T,
): boolean {
  const wallAge = state.wallNow() - plan.preparedWallClockMs;
  const monotonicAge = state.monotonicNow() - plan.preparedMonotonicMs;
  return !(
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge >= PROVIDER_PREPARATION_LIFETIME_MS ||
    monotonicAge >= PROVIDER_PREPARATION_LIFETIME_MS
  );
}

/**
 * 対象準備候補の二Store参照を除去する。
 *
 * @responsibility 一回消費または所定回収後に同じ候補を再利用不能にする。
 * @trace ARCH-000015
 * @input state: 準備Owner。preparedCapability: 照合済み候補参照。
 * @returns N/A: Store更新だけを行う。
 * @precondition 呼出し側が管理一致と所定の削除条件を確認済みである。
 * @postcondition 対象候補の計画と管理対応が両方不存在になる。
 * @effect 呼出し側所有の二WeakMapから対象参照を削除する。
 * @failure N/A: WeakMap.deleteは未登録参照にも同じ終了状態を返す。
 * @invariant 別候補や別ProviderのStoreを変更しない。
 * @boundary 共通Lifecycleと既存準備状態の間。
 * @security 名前や操作IDだけを削除根拠にしない。
 * @concurrency 同期操作として二Storeを連続更新する。
 */
function removeProviderPreparedPlan<T extends ProviderPreparedPlanLifecycle>(
  state: ProviderPreparationLifecycleState<T>,
  preparedCapability: object,
): void {
  state.prepared.delete(preparedCapability);
  state.managementCapabilities.delete(preparedCapability);
}

/**
 * 準備候補を取消し、失効とHome Lease解放を確認する。
 *
 * @responsibility 既存回収順序とProvider別公開理由を共通に適用する。
 * @trace ARCH-000015
 * @input state: 準備状態。provider: 固定Provider。blockedResult: 既存結果生成。preparedCapabilityとmanagementCapability: 不透明参照。
 * @returns 既存blocked結果、または操作・Grant参照付きcancelled／expired結果。
 * @precondition Providerと結果生成は同じ準備Ownerが固定する。
 * @postcondition Mount解放未確認ではStoreを残し、解放確認後だけ対象参照を除去する。
 * @effect 既存Authority失効、Mount解放と対象Store除去を発行する。
 * @failure 不正Capability、Mount解放未確認、失効不成立を区別する。依存例外は既存呼出し側境界へ伝播する。
 * @invariant 失効→Mount解放→Store除去→失効結果確認の既存順序を変えない。
 * @boundary 共通取消とCoordinatorのAuthority・Mount Ownerの間。
 * @security Provider Effectや新しいAuthorityを発行しない。
 * @concurrency 同期回収と参照除去により候補の再利用を止める。
 */
export function cancelProviderDockerPreparation<
  T extends ProviderPreparedPlanLifecycle,
  B extends Readonly<{
    status: "blocked";
    reason: string;
    operationId: null;
    grantRef: null;
  }>,
>(
  state: ProviderPreparationLifecycleState<T>,
  provider: "codex" | "claude",
  blockedResult: (reason: string) => B,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  const plan = findProviderPreparedPlan(
    state,
    preparedCapability,
    managementCapability,
  );
  if (!plan || !preparedCapability || typeof preparedCapability !== "object")
    return blockedResult(
      `${provider}_docker_runtime_prepared_capability_invalid`,
    );
  const revoked = state.revokeProviderAuthority(
    plan.authorityControlCapability,
    managementCapability,
  );
  const completed = state.completeMount(
    plan.activeMountCapability,
    managementCapability,
  );
  if (completed.status !== "completed")
    return blockedResult(
      `${provider}_docker_runtime_mount_release_unconfirmed`,
    );
  removeProviderPreparedPlan(state, preparedCapability);
  if (revoked.status !== "revoked")
    return blockedResult(`${provider}_docker_runtime_authority_revoke_invalid`);
  const isExpired = !providerPreparedPlanIsFresh(state, plan);
  const reason = isExpired
    ? `${provider}_docker_runtime_preparation_expired`
    : `${provider}_docker_runtime_preparation_cancelled`;
  return Object.freeze({
    ...blockedResult(reason),
    status: isExpired ? ("expired" as const) : ("cancelled" as const),
    reason,
    operationId: plan.operationId,
    grantRef: plan.grantRef,
  });
}

/**
 * 有効な準備計画を一回だけ実行Ownerへ渡す。
 *
 * @responsibility 期限切れ回収と、新鮮候補の一回消費を同じ条件で適用する。
 * @trace ARCH-000015
 * @input state: 準備状態。preparedCapabilityとmanagementCapability: 不透明参照。
 * @returns 同じ具体型の計画、またはnull。
 * @precondition 実行Ownerが後続のAuthority確認とProcess Lifecycleを所有する。
 * @postcondition 新鮮候補は二Storeから除去され、二回目は取得できない。
 * @effect 期限切れではAuthority失効とMount解放を要求し、解放確認後だけStoreを除去する。
 * @failure 不正・期限切れをnullで拒否する。依存例外は既存呼出し側へ伝播する。
 * @invariant 計画返却をProvider Effect成立や資源回収の実測としない。
 * @boundary Coordinator準備StoreとProcess実行Ownerの間。
 * @security 不明なMount解放で候補の回収参照を消さない。
 * @concurrency 新鮮候補は返却前に同期除去し再利用を防ぐ。
 */
export function consumeProviderDockerPreparation<
  T extends ProviderPreparedPlanLifecycle,
>(
  state: ProviderPreparationLifecycleState<T>,
  preparedCapability: unknown,
  managementCapability: unknown,
): T | null {
  const plan = findProviderPreparedPlan(
    state,
    preparedCapability,
    managementCapability,
  );
  if (!plan || !preparedCapability || typeof preparedCapability !== "object")
    return null;
  if (!providerPreparedPlanIsFresh(state, plan)) {
    state.revokeProviderAuthority(
      plan.authorityControlCapability,
      managementCapability,
    );
    const completed = state.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    if (completed.status === "completed")
      removeProviderPreparedPlan(state, preparedCapability);
    return null;
  }
  removeProviderPreparedPlan(state, preparedCapability);
  return plan;
}
