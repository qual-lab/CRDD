/**
 * 固定Providerの準備・取消・一回消費を共通Runtimeへ結合する。
 *
 * @responsibility 独立Store、具体計画、公開結果と既存準備Lifecycleの組立てを所有する。
 * @trace ARCH-000015
 */
import { planClaudeTaskTurnBudget } from "../../../ai-adapter/src/index.ts";
import { buildProviderDockerExecutionPlan } from "./provider-execution-plan.ts";
import {
  createProviderDockerRuntimeState,
  createProviderDockerRuntimeDependencies,
} from "./provider-composition.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "../provider/codex-executor-seccomp.ts";
import {
  createProviderDockerBlockedResult,
  createIsolatedProviderDockerPreparationAdapter,
  prepareProviderDockerCandidate,
} from "./provider-preparation.ts";
import {
  cancelProviderDockerPreparation,
  consumeProviderDockerPreparation,
} from "./provider-preparation-lifecycle.ts";
import type {
  ProviderDockerConsumedModelSelection,
  ProviderDockerConsumedTaskPacket,
  ProviderDockerRuntimeDependencies,
  ProviderDockerPreparedPlan,
  ProviderDockerPreparedResult,
} from "./types.ts";
import type { WorkbenchAiAdviceRuntimePacket } from "../workbench-ai/advice-packet.ts";

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
      WorkbenchAiAdviceRuntimePacket,
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
                const budget = planClaudeTaskTurnBudget(
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
            selectedModelTier: plan.selectedModelTier,
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

const productionAdapters = Object.freeze({
  codex: createProviderDockerRuntimeAdapterCandidate("codex", {
    ...createProviderDockerRuntimeDependencies(),
    verifyExecutorSeccompProfile: resolveFixedCodexExecutorSeccompProfile,
  }),
  claude: createProviderDockerRuntimeAdapterCandidate("claude", {
    ...createProviderDockerRuntimeDependencies(),
  }),
});

/**
 * 固定Providerの同じ本番準備Ownerを取得する。
 *
 * @responsibility 準備・取消・消費の全利用側を同じProvider別Storeへ結合する。
 * @trace ARCH-000015
 * @input provider: 内部契約で照合済みの固定Provider。
 * @returns 同じProviderの凍結済み本番Adapter。
 * @precondition 呼出し側は固定二Providerの型契約を満たす。
 * @postcondition 取得ごとにStoreを再生成せず、他Providerの候補を混ぜない。
 * @effect N/A: 既存Ownerの参照だけを取得する。
 * @failure N/A: 任意Providerの動的解決やfallbackを行わない。
 * @invariant 一回消費と管理参照のIdentityを保持する。
 * @boundary Coordinator内部の本番利用側と準備Owner。
 * @security Storeや依存差替えを外部へ公開しない。
 * @concurrency 同期取得であり待機や新しいLockを導入しない。
 */
export function getRuntimeOwnedProviderDockerAdapter<
  P extends "codex" | "claude",
>(provider: P) {
  return productionAdapters[provider];
}
