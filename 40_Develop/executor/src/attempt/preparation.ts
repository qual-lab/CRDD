/**
 * Provider別の準備と一回消費を同じOwnerで管理する。
 * @packageDocumentation
 * @responsibility Task進行・保存を持たず、元Capabilityの消費と技術構成だけを扱う。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import { evaluateProviderTaskScope } from "../../../ai-adapter/src/index.ts";
import type {
  ProviderAdvicePacket,
  ProviderPreparedPlanLifecycle,
  ProviderPreparationLifecycleState,
  ProviderDockerPreparationState,
  ProviderDockerPreparedPlan,
  ProviderDockerConsumedModelSelection,
  ProviderDockerConsumedTaskPacket,
  ProviderDockerRuntimeDependencies,
  ProviderDockerPreparedResult,
  ProviderDockerPreparationCallbacks,
} from "./types.ts";
import { buildProviderDockerExecutionPlan } from "./plan.ts";

/**
 * 一つのProvider準備Ownerの独立した状態を構築する。
 *
 * @responsibility 候補と管理参照の二StoreをOwnerごとに一度生成する。
 * @trace ARCH-000015
 * @input dependencies: 固定Providerの準備依存。Storeは入力に含めない。
 * @returns 具体Provider型を保持した凍結済み状態。
 * @precondition dependenciesは本番固定組立てまたは用途限定の局所試験から渡す。
 * @postcondition 呼出しごとに独立した二WeakMapを保持する。
 * @effect Process内の二WeakMapを生成する。資源取得やAuthority発行は実行しない。
 * @failure N/A: 入力を動的な外部接続先として解決しない。
 * @invariant Storeの合成・複製・Provider間共有を行わない。
 * @boundary 共通準備状態と固定Providerの呼出し側の間。
 * @security 候補・管理参照を外部へ公開または永続化しない。
 * @concurrency 準備・取消・消費は既存の同期Store操作で直列化する。
 */
export function createProviderDockerRuntimeState<P extends "codex" | "claude">(
  dependencies: ProviderDockerRuntimeDependencies<P>,
) {
  return Object.freeze({
    prepared: new WeakMap<object, ProviderDockerPreparedPlan<P>>(),
    managementCapabilities: new WeakMap<object, object>(),
    ...dependencies,
  });
}

/**
 * Providerで識別した独立準備Runtimeを構築する。
 *
 * @responsibility 固定Provider、独立Store、共通計画と既存公開結果を結合する。
 * @trace ARCH-000015
 * @input provider: 固定二Provider。dependencies: 同じProviderの既存準備操作。
 * @returns probe・Task・助言の準備、取消、一回消費を持つ凍結済みRuntime。
 * @precondition 呼出し側は内部固定組立てか用途限定の局所試験であり、外部入力から依存を解決しない。
 * @postcondition 各OwnerのStoreを独立させ、Provider別の具体計画型・結果fieldを保持する。
 * @effect FactoryはProcess内Storeだけを生成する。返す操作は既存Mount、Packet、AuthorityとStoreを変更する。
 * @failure 準備・取消例外は固定理由の拒否へ、消費例外はnullへ搬送する。
 * @invariant Docker要求、Provider送信や新しい回復状態を追加しない。
 * @boundary Coordinatorの共通準備Ownerと本番・局所試験組立ての間。
 * @security 結果にPath、command、秘密または内部Authorityを複製しない。
 * @concurrency 既存の同期準備順序と二WeakMapによる一回消費を維持する。
 */
export function createProviderDockerRuntimeAdapterCandidate<
  P extends "codex" | "claude",
>(provider: P, dependencies: ProviderDockerRuntimeDependencies<P>) {
  const state = createProviderDockerRuntimeState<P>(dependencies);
  /**
   * 同じProviderの計画とAuthorityを準備候補へ結合する。
   *
   * @responsibility 共通準備の検査・取得・発行・保存順序へ固定計画と結果生成を接続する。
   * @trace ARCH-000015
   * @input 同じ操作の管理、Mount、選定、Taskまたは助言、回復相関の不透明参照。
   * @returns 既存拒否結果または具体Providerのprepared結果。
   * @precondition stateは現在Runtimeだけに属する。
   * @postcondition Authority照合とStore保存が成立した場合だけpreparedを返す。
   * @effect 既存Mount有効化、Packet消費、乱数・Seccomp読取り、Authority発行と回収を行う。
   * @failure 共通準備の拒否・失効・Lease回収と例外処置を維持する。
   * @invariant 回復参照と操作・Providerの相関を変更しない。
   * @boundary 共通Runtime内の計画・準備・公開結果の接続境界。
   * @security 準備結果へ内部計画をそのまま公開しない。
   * @concurrency 同期操作でStoreと管理対応を連続更新する。
   */
  function prepare(
    management: unknown,
    mount: unknown,
    authorization: unknown,
    selection: unknown,
    task: unknown = null,
    recovery: unknown = null,
    advice: unknown = null,
    owner: unknown = null,
    consumer: unknown = null,
  ) {
    return prepareProviderDockerCandidate<
      ProviderDockerConsumedModelSelection,
      ProviderDockerConsumedTaskPacket<P>,
      ProviderAdvicePacket,
      Omit<
        ProviderDockerPreparedPlan<P>,
        "authorityUseCapability" | "authorityControlCapability"
      >,
      ReturnType<typeof createProviderDockerBlockedResult>,
      ProviderDockerPreparedResult<P>
    >(
      state,
      provider,
      {
        blockedResult: createProviderDockerBlockedResult,
        ...(provider === "claude"
          ? {
              validateTask: (packet: {
                taskRole: "executor" | "reviewer";
                taskWorkload?: unknown;
              }) => {
                const budget = evaluateProviderTaskScope(
                  "claude",
                  packet.taskRole,
                  packet.taskWorkload,
                );
                return budget.status === "candidate" ? null : budget.reason;
              },
            }
          : {}),
        buildPlan: (...args) => {
          const plan = buildProviderDockerExecutionPlan(
            provider,
            state,
            ...args,
          );
          // 固定Providerの実行時照合後だけ具体型へ結合する。計画fieldを補完しない。
          return plan?.provider === provider
            ? (plan as Omit<
                ProviderDockerPreparedPlan<P>,
                "authorityUseCapability" | "authorityControlCapability"
              >)
            : null;
        },
        preparedResult: (plan, capability, binding, activation) => {
          const result = Object.freeze({
            ...createProviderDockerBlockedResult(
              `${provider}_docker_runtime_prepared`,
            ),
            status: "prepared" as const,
            reason: `${provider}_docker_runtime_prepared`,
            preparedCapability: capability,
            operationId: binding.operationId,
            grantRef: activation.grant.grantRef,
            selectionRecordId: plan.selectionRecordId,
            selectedModel: plan.selectedModel,
            selectedEffort: plan.selectedEffort,
            ...(provider === "claude"
              ? {
                  taskWorkload:
                    "taskWorkload" in plan ? plan.taskWorkload : null,
                }
              : {}),
            selectionNotice: plan.selectionNotice,
            providerHomeMountLeaseActive: true as const,
          });
          return result as ProviderDockerPreparedResult<P>;
        },
      },
      management,
      mount,
      authorization,
      selection,
      task,
      recovery,
      advice,
      owner,
      consumer,
    );
  }
  return createIsolatedProviderDockerPreparationAdapter(provider, {
    prepare,
    blocked: createProviderDockerBlockedResult,
    cancel: (prepared, management) =>
      cancelProviderDockerPreparation(
        state,
        provider,
        createProviderDockerBlockedResult,
        prepared,
        management,
      ),
    consume: (prepared, management) =>
      consumeProviderDockerPreparation(state, prepared, management),
  });
}

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

/**
 * Blocked 結果を構築する。
 *
 * @responsibility Blocked 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input reason: string
 * @returns createProviderDockerBlockedResultの計算結果を返す。
 * @precondition 「reason: string」がcreateProviderDockerBlockedResultの入力契約を満たす。
 * @postcondition createProviderDockerBlockedResultの責務を完了した結果だけを返す。
 * @effect N/A: createProviderDockerBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProviderDockerBlockedResultは独自の失敗分岐を所有しない。
 * @invariant createProviderDockerBlockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProviderDockerBlockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProviderDockerBlockedResultは共有非同期状態を持たない同期処理である。
 */
export function createProviderDockerBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    preparedCapability: null,
    operationId: null,
    grantRef: null,
    selectionRecordId: null,
    selectedModel: null,
    selectedEffort: null,
    selectionNotice: null,
    providerHomeMountLeaseActive: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * 二Providerの局所検証用準備入口を同じ固定操作へ接続する。
 *
 * @responsibility probe・Task・助言の引数搬送、失敗分類、取消と一回消費の検証入口をまとめる。
 * @trace ARCH-000015
 * @input provider: 固定Provider。callbacks: 呼出し側の準備状態へ結合済みの同期操作。
 * @returns 本番Authorityを持たない凍結済み検証用Adapter。
 * @precondition callbacksはCoordinator内の固定二実装からのみ渡す。
 * @postcondition Taskと助言を混在させず、既存の引数順序とProvider別理由値を保持する。
 * @effect 呼出し後の準備・取消操作は既存状態を変更し得る。Factory自体は外部要求を発行しない。
 * @failure 準備・取消例外は既存blocked結果へ、消費例外はnullへ搬送する。
 * @invariant productionAuthorityはfalseであり、検証入口から本番権限を発行しない。
 * @boundary Coordinator内部の検証用準備入口と既存状態Ownerの間。
 * @security 任意の外部command、Pluginまたは新Capabilityを受け付けない。
 * @concurrency 既存の同期操作と二WeakMapによる一回消費を維持する。
 */
export function createIsolatedProviderDockerPreparationAdapter<R, B, C, P>(
  provider: "codex" | "claude",
  callbacks: Readonly<{
    prepare: (...args: unknown[]) => R;
    blocked: (reason: string) => B;
    cancel: (prepared: unknown, management: unknown) => C;
    consume: (prepared: unknown, management: unknown) => P | null;
  }>,
) {
  /**
   * 検証用操作の例外を既存の拒否結果へ変換する。
   *
   * @responsibility 操作結果の具体型を保持し、例外時だけProvider別拒否を返す。
   * @trace ARCH-000015
   * @input reason: 固定理由。action: 同期準備または取消。
   * @returns 操作結果または既存blocked結果。
   * @precondition actionは現在Adapterの状態へ結合されている。
   * @postcondition 正常結果を変更せず、例外本文を公開しない。
   * @effect actionが所有する既存準備・取消Effectだけを実行する。
   * @failure 例外は固定理由のblocked結果へ変換する。
   * @invariant 失敗結果を正常結果へ変換しない。
   * @boundary 検証用Adapter内の同期操作境界。
   * @security 例外本文、Pathと秘密を結果へ複製しない。
   * @concurrency N/A: 同期操作を一回だけ呼ぶ。
   */
  const safely = <T>(reason: string, action: () => T) => {
    try {
      return action();
    } catch {
      return callbacks.blocked(reason);
    }
  };
  return Object.freeze({
    productionAuthority: false as const,
    prepare: (
      management: unknown,
      mount: unknown,
      authorization: unknown,
      selection: unknown,
    ) =>
      safely(`${provider}_docker_runtime_preparation_failed_closed`, () =>
        callbacks.prepare(
          management,
          mount,
          authorization,
          selection,
          null,
          null,
          null,
          null,
          "coordinator_cli",
        ),
      ),
    prepareTask: (
      management: unknown,
      mount: unknown,
      authorization: unknown,
      selection: unknown,
      packet: unknown,
      recovery: unknown = null,
      consumer: unknown = "coordinator_cli",
    ) =>
      safely(`${provider}_docker_runtime_task_preparation_failed_closed`, () =>
        callbacks.prepare(
          management,
          mount,
          authorization,
          selection,
          packet,
          recovery,
          null,
          null,
          consumer,
        ),
      ),
    prepareAdvice: (
      management: unknown,
      mount: unknown,
      authorization: unknown,
      selection: unknown,
      packet: unknown,
      owner: unknown,
      recovery: unknown = null,
    ) =>
      safely(
        `${provider}_docker_runtime_advice_preparation_failed_closed`,
        () =>
          callbacks.prepare(
            management,
            mount,
            authorization,
            selection,
            null,
            recovery,
            packet,
            owner,
            "workbench",
          ),
      ),
    cancel: (prepared: unknown, management: unknown) =>
      safely(`${provider}_docker_runtime_cancellation_failed_closed`, () =>
        callbacks.cancel(prepared, management),
      ),
    consumeForProcessController: (prepared: unknown, management: unknown) => {
      try {
        return callbacks.consume(prepared, management);
      } catch {
        return null;
      }
    },
  });
}

/**
 * 両Providerの準備候補を同じ資源・権限順序で構築する。
 *
 * @responsibility modeと回復参照を検査し、既存MountとPacketを照合した候補だけを保存する。
 * @trace ARCH-000015
 * @input state: 既存Owner状態。providerとcallbacks: 内部固定接続。残り: 同じ操作の不透明参照。
 * @returns 既存Provider別blocked結果またはprepared結果。
 * @precondition callbackは二Providerの固定実装であり外部入力から選ばない。
 * @postcondition 候補のAuthorityと操作・Home・固定選定が一致し、同じ管理参照へ保存される。
 * @effect 既存Mount有効化、Packet消費、Authority発行・失効、Mount解放とStore保存を所有する。
 * @failure 不正mode、回復参照、Mount、Packet、計画、Authorityを区別する。例外時は失効とlease解放を要求して再throwする。
 * @invariant 既存の検査・取得・発行・回収順序を変更せず、Docker要求を発行しない。
 * @boundary Coordinator内の準備・Home・Packet・Authority Ownerの間。
 * @security Authority照合が成立する前にprepared結果を返さない。
 * @concurrency 同期処理で二WeakMapの候補と管理対応を連続保存する。
 */
export function prepareProviderDockerCandidate<M, T, A, P extends object, B, R>(
  state: ProviderDockerPreparationState<M, T, A, P>,
  provider: "codex" | "claude",
  callbacks: ProviderDockerPreparationCallbacks<M, T, A, P, B, R>,
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  taskPacketUseCapability: unknown = null,
  recoveryCorrelationId: unknown = null,
  advicePacketUseCapability: unknown = null,
  advicePacketOwnerCapability: unknown = null,
  consumer: unknown = null,
) {
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "orchestrator"
  )
    return callbacks.blockedResult(
      `${provider}_docker_runtime_consumer_invalid`,
    );
  if (
    (advicePacketUseCapability === null) !==
      (advicePacketOwnerCapability === null) ||
    (taskPacketUseCapability !== null && advicePacketUseCapability !== null)
  )
    return callbacks.blockedResult(
      `${provider}_docker_runtime_input_mode_ambiguous`,
    );
  if (
    recoveryCorrelationId !== null &&
    (typeof recoveryCorrelationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(recoveryCorrelationId))
  )
    return callbacks.blockedResult(
      `${provider}_docker_runtime_recovery_correlation_invalid`,
    );
  const binding = state.verifyOperationMount(
    managementCapability,
    mountCapability,
  );
  const activation = state.activateMount(
    mountAuthorizationCapability,
    managementCapability,
  );
  if (
    activation.status !== "activated" ||
    !activation.grant ||
    !activation.activeMountCapability
  ) {
    return callbacks.blockedResult(
      `${provider}_docker_runtime_mount_authorization_invalid`,
    );
  }
  const activeMountCapability = activation.activeMountCapability;
  let issuedAuthorityControlCapability: object | null = null;
  const activatedMount = Object.freeze({
    grant: activation.grant,
    activeMountCapability,
  });
  if (
    activation.grant.provider !== provider ||
    activation.grant.operationId !== binding.operationId
  ) {
    state.completeMount(activeMountCapability, managementCapability);
    return callbacks.blockedResult(
      `${provider}_docker_runtime_mount_authorization_invalid`,
    );
  }
  try {
    const consumedModelSelection = state.consumeModelSelection(
      selectionUseCapability,
      managementCapability,
    );
    if (!consumedModelSelection) {
      state.completeMount(activeMountCapability, managementCapability);
      return callbacks.blockedResult(
        `${provider}_docker_runtime_model_selection_invalid`,
      );
    }
    const taskPacket =
      taskPacketUseCapability === null
        ? null
        : (state.consumeTaskPacket?.(
            taskPacketUseCapability,
            managementCapability,
          ) ?? null);
    if (taskPacketUseCapability !== null && !taskPacket) {
      state.completeMount(activeMountCapability, managementCapability);
      return callbacks.blockedResult(
        `${provider}_docker_runtime_task_packet_invalid`,
      );
    }
    const advicePacket =
      advicePacketUseCapability === null
        ? null
        : (state.consumeAdvicePacket?.(
            advicePacketUseCapability,
            advicePacketOwnerCapability,
          ) ?? null);
    if (advicePacketUseCapability !== null && !advicePacket) {
      state.completeMount(activeMountCapability, managementCapability);
      return callbacks.blockedResult(
        `${provider}_docker_runtime_advice_packet_invalid`,
      );
    }
    if (taskPacket && callbacks.validateTask) {
      const taskFailure = callbacks.validateTask(taskPacket);
      if (taskFailure !== null) {
        state.completeMount(activeMountCapability, managementCapability);
        return callbacks.blockedResult(taskFailure);
      }
    }
    const providerHomeSourcePath = state.borrowMountSource(
      activeMountCapability,
      managementCapability,
    );
    const preparedWallClockMs = state.wallNow();
    const preparedMonotonicMs = state.monotonicNow();
    const planCandidate =
      typeof providerHomeSourcePath === "string" &&
      Number.isFinite(preparedWallClockMs) &&
      Number.isFinite(preparedMonotonicMs) &&
      preparedWallClockMs >= 0 &&
      preparedMonotonicMs >= 0
        ? callbacks.buildPlan(
            binding,
            activatedMount,
            consumedModelSelection,
            providerHomeSourcePath,
            preparedWallClockMs,
            preparedMonotonicMs,
            taskPacket,
            advicePacket,
            recoveryCorrelationId,
            consumer,
          )
        : null;
    if (!planCandidate) {
      state.completeMount(activeMountCapability, managementCapability);
      return callbacks.blockedResult(`${provider}_docker_runtime_plan_invalid`);
    }
    const authority = state.issueProviderAuthority(
      managementCapability,
      activeMountCapability,
    );
    if (authority.status === "issued" && authority.controlCapability) {
      issuedAuthorityControlCapability = authority.controlCapability;
    }
    if (
      authority.status !== "issued" ||
      !authority.useCapability ||
      !authority.controlCapability ||
      authority.operationId !== binding.operationId ||
      authority.provider !== provider ||
      authority.providerHomeMountGrantRef !== activation.grant.grantRef ||
      authority.runtimeAuthorityIssued !== true
    ) {
      if (issuedAuthorityControlCapability) {
        state.revokeProviderAuthority(
          issuedAuthorityControlCapability,
          managementCapability,
        );
        issuedAuthorityControlCapability = null;
      }
      state.completeMount(activeMountCapability, managementCapability);
      return callbacks.blockedResult(
        `${provider}_docker_runtime_authority_invalid`,
      );
    }
    const plan = Object.freeze({
      ...planCandidate,
      authorityUseCapability: authority.useCapability,
      authorityControlCapability: authority.controlCapability,
    });
    const preparedCapability = Object.freeze({});
    state.prepared.set(preparedCapability, plan);
    state.managementCapabilities.set(
      preparedCapability,
      managementCapability as object,
    );
    return callbacks.preparedResult(
      plan,
      preparedCapability,
      binding,
      activatedMount,
    );
  } catch (error) {
    if (issuedAuthorityControlCapability) {
      state.revokeProviderAuthority(
        issuedAuthorityControlCapability,
        managementCapability,
      );
    }
    state.completeMount(activeMountCapability, managementCapability);
    throw error;
  }
}
