/**
 * Providerの準備・取消・一回消費を同じ実行Ownerへ結合する。
 *
 * @responsibility 独立Store、本番固定依存、具体計画と既存準備Lifecycleを同じOwnerで組み立てる。
 * @trace ARCH-000015
 */
import { evaluateProviderTaskScope } from "../../../ai-adapter/src/index.ts";
import { PROVIDER_PREPARATION_LIFETIME_MS } from "./provider-preparation-lifecycle.ts";
import { buildProviderDockerExecutionPlan } from "./provider-plan.ts";
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
} from "./provider-types.ts";
import type { ProviderAdvicePacket } from "./provider-packet.ts";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { verifyOwnedOperationManagementMountBinding } from "./operation.ts";
import { readBorrowedExecutionBinding } from "./borrowed-tree.ts";
import { consumeRuntimeOwnedDelegationSelectionGrant } from "./delegation-selection-grant.ts";
import {
  issueRuntimeOwnedProviderAuthority,
  revokeRuntimeOwnedProviderAuthority,
} from "./authority-grant.ts";
import {
  activateRuntimeOwnedProviderHomeMount,
  borrowRuntimeOwnedActiveProviderHomeMountSource,
  completeRuntimeOwnedProviderHomeMount,
} from "./provider-home-mount-authorization.ts";
import { consumeRuntimeOwnedProviderTaskPacket } from "./task-packet.ts";
import { consumeRuntimeOwnedProviderAdvicePacket } from "./provider-packet.ts";

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
 * 固定二Providerの本番準備依存を取得する。
 *
 * @responsibility 共通の本番操作を同じ関数参照で提供し、準備Storeとは分離する。
 * @trace ARCH-000015
 * @input N/A: 外部入力または接続先指定を受け取らない。
 * @returns 凍結した本番依存の組。
 * @precondition Coordinatorの同じ改訂版から呼ぶ。
 * @postcondition Mount、Packet、選定、Authorityと二時計を既存Ownerへ接続する。
 * @effect N/A: 関数参照の組立てだけを行い、取得・消費・発行を実行しない。
 * @failure N/A: 動的な解決やfallbackを行わない。
 * @invariant ProviderごとのStoreと管理対応を共有・生成しない。
 * @boundary Coordinator内の共通組立てと既存資源Ownerの間。
 * @security Capability、秘密値または任意の接続先を公開しない。
 * @concurrency N/A: 同期組立てであり可変状態を追加しない。
 */
export function createProviderDockerRuntimeDependencies() {
  return Object.freeze({
    verifyOperationMount: (management: unknown, mount: unknown) => {
      const binding = verifyOwnedOperationManagementMountBinding(
        management,
        mount,
      );
      const borrowed = readBorrowedExecutionBinding(management as object, true);
      return borrowed
        ? {
            ...binding,
            mounts: {
              ...binding.mounts,
              workspace: borrowed.target.executionTree,
            },
            workspaceProtection: borrowed.protection,
          }
        : binding;
    },
    activateMount: activateRuntimeOwnedProviderHomeMount,
    borrowMountSource: borrowRuntimeOwnedActiveProviderHomeMountSource,
    completeMount: completeRuntimeOwnedProviderHomeMount,
    wallNow: Date.now,
    monotonicNow: performance.now.bind(performance),
    randomBytes,
    consumeModelSelection: consumeRuntimeOwnedDelegationSelectionGrant,
    consumeTaskPacket: consumeRuntimeOwnedProviderTaskPacket,
    consumeAdvicePacket: consumeRuntimeOwnedProviderAdvicePacket,
    issueProviderAuthority: issueRuntimeOwnedProviderAuthority,
    revokeProviderAuthority: revokeRuntimeOwnedProviderAuthority,
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

/**
 * 共通準備Adapterの契約をProvider差を保持して説明する。
 * @responsibility 同じ準備Ownerの固定契約とProvider別fieldを記述する。
 * @trace ARCH-000015
 * @input provider: 内部で固定した二Provider。
 * @returns 既存のProvider別契約・版・field集合を持つ凍結値。
 * @precondition 呼出し側は固定Providerの型契約を満たす。
 * @postcondition ClaudeにCodex専用fieldを追加せず、既存契約値を保持する。
 * @effect N/A: 説明値だけを組み立て、準備や外部要求を実行しない。
 * @failure N/A: 外部観測・動的Provider解決を行わない。
 * @invariant 記述の存在だけで実資源・安全保証の成立を主張しない。
 * @boundary Coordinator内部の契約説明と利用側検査。
 * @security command、Host Path、秘密値、Authorityを返さない。
 * @concurrency N/A: 局所的な同期値生成のみ。
 */
export function describeProviderDockerRuntimeAdapterContract(
  provider: "codex" | "claude",
) {
  return Object.freeze({
    contract: `crdd-coordinator/${provider}-docker-runtime-adapter`,
    contractRevision: provider === "codex" ? 8 : 7,
    provider,
    subscriptionOffering:
      provider === "codex" ? "chatgpt_subscription_oauth" : "claude_max",
    modelSelection:
      "runtime_owned_selection_grant_consumer_connected_with_preflight_deferred_eligibility",
    coordinatorPrelaunchModelSelectionAllowed: true,
    providerAutomaticModelSwitchingAllowed: false,
    midExecutionModelSwitchingAllowed: false,
    speedMode: "normal_only",
    highCostSelection: "decisive_reason_required",
    fallbackModelArgumentAllowed: false,
    operationBinding:
      "same_runtime_owned_management_and_mount_capability_generation",
    providerHomeBinding:
      "consumed_mount_authorization_and_native_known_folder_source_hash",
    providerAuthority:
      "runtime_owned_short_lived_use_capability_required_in_prepared_plan",
    preparedLifetimeMs: PROVIDER_PREPARATION_LIFETIME_MS,
    providerImage: "fixed_digest_only_pull_never",
    proxyImage: "fixed_digest_only_pull_never",
    parentEnvironmentInherited: false,
    apiKeyEnvironmentAllowed: false,
    providerNetwork: "internal_only",
    providerDirectEgress: false,
    ...(provider === "codex"
      ? {
          providerProxyEnvironment: Object.freeze([
            "HTTPS_PROXY",
            "HTTP_PROXY",
            "ALL_PROXY",
            "NO_PROXY_EMPTY",
          ]),
        }
      : {}),
    proxyNetworks: Object.freeze(["internal", "egress"]),
    proxyAuthentication: "runtime_random_256_bit_operation_local",
    proxyHostnameAllowlist: Object.freeze(
      provider === "codex"
        ? ["auth.openai.com", "chatgpt.com"]
        : ["api.anthropic.com", "claude.ai", "platform.claude.com"],
    ),
    rootFilesystem: "read_only",
    linuxUser: "65534:65534",
    capabilities: "all_dropped",
    noNewPrivileges: true,
    processLimit: 64,
    providerHomeMount: "read_write_rprivate_dedicated_home",
    providerHomeCrossProcessLease:
      "docker_global_provider_home_identity_container_name_fail_closed",
    subscriptionAuthentication:
      "network_none_read_only_provider_home_probe_before_provider_request",
    operationTmpMount: "read_write_rprivate_owned_operation_tmp",
    repositoryMounted: false,
    isolatedWorkspace:
      "runtime_owned_exact_commit_executor_read_write_reviewer_read_only",
    taskPacket: "opaque_single_use_prompt_to_provider_stdin_only",
    workbenchAdvice:
      "opaque_single_use_packet_provider_stdin_only_without_repository_or_workspace_mount",
    shellInvocation: false,
    pathLookup: false,
    commandPlanReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued:
      "runtime_owned_short_lived_provider_authority_connected",
    operationCapabilityIssued: false,
    processController:
      "production_runtime_owned_controller_and_fixed_docker_effect_connected",
  });
}
