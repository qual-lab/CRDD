/**
 * Providerの準備候補を既存Mount・Packet・Authorityへ結合する。
 *
 * @responsibility 受理検査、lease回収、Authority発行と候補保存の共通順序を所有する。
 * @trace ARCH-000015
 */
import type {
  ProviderDockerPreparationState,
  ProviderDockerPreparationCallbacks,
} from "./types.ts";

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
    selectedModelTier: null,
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
            null,
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
 * @postcondition 候補のAuthorityと操作・Home・Profileが一致し、同じ管理参照へ保存される。
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
      authority.profileId !== activation.grant.profileId ||
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
