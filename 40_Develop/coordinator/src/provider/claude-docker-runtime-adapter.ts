/**
 * 固定Claude入口をCoordinator共通Docker準備Runtimeへ接続する。
 *
 * @responsibility 既存公開関数と契約値を保持し、準備・取消・消費を同じOwnerへ配送する。
 * @trace ARCH-000015
 */
import {
  createProviderDockerRuntimeAdapterCandidate,
  getRuntimeOwnedProviderDockerAdapter,
} from "../docker-runtime/provider-docker-runtime.ts";
import { PROVIDER_PREPARATION_LIFETIME_MS } from "../docker-runtime/provider-preparation-lifecycle.ts";
import type { ProviderDockerRuntimeDependencies } from "../docker-runtime/types.ts";

export const CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/claude-docker-runtime-adapter";
export const CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION = 7;

const productionAdapter = getRuntimeOwnedProviderDockerAdapter("claude");

/**
 * Runtime 所有 Claude Docker 候補を実行前候補として準備する。
 *
 * @responsibility Runtime 所有 Claude Docker 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown
 * @returns prepareRuntimeOwnedClaudeDockerCandidateの計算結果を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown」がprepareRuntimeOwnedClaudeDockerCandidateの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedClaudeDockerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedClaudeDockerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareRuntimeOwnedClaudeDockerCandidateは独自の失敗分岐を所有しない。
 * @invariant prepareRuntimeOwnedClaudeDockerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareRuntimeOwnedClaudeDockerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedClaudeDockerCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedClaudeDockerCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
) {
  return productionAdapter.prepare(
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
  );
}

/**
 * Runtime 所有 Claude Docker Task 候補を実行前候補として準備する。
 *
 * @responsibility Runtime 所有 Claude Docker Task 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown
 * @returns prepareRuntimeOwnedClaudeDockerTaskCandidateの計算結果を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown」がprepareRuntimeOwnedClaudeDockerTaskCandidateの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedClaudeDockerTaskCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedClaudeDockerTaskCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareRuntimeOwnedClaudeDockerTaskCandidateは独自の失敗分岐を所有しない。
 * @invariant prepareRuntimeOwnedClaudeDockerTaskCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareRuntimeOwnedClaudeDockerTaskCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedClaudeDockerTaskCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedClaudeDockerTaskCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  taskPacketUseCapability: unknown,
  recoveryCorrelationId: unknown = null,
) {
  return productionAdapter.prepareTask(
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    taskPacketUseCapability,
    recoveryCorrelationId,
  );
}

/**
 * Runtime所有のWorkbench読取り助言候補を実行前に準備する。
 *
 * @responsibility 一回消費PacketをRepository非共有のClaude実行Planへ結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 管理、Mount、Model Selection、Advice Packetの各Capability。
 * @returns 準備済み候補またはEffect 0のblocked結果。
 * @precondition Advice Packetは同じOperation、ProfileおよびProviderへ固定されている。
 * @postcondition preparedの場合だけworkbench_advice Planを一回消費できる。
 * @effect Provider Effectは発行せず、Provider Home Leaseと短期Authorityだけを準備する。
 * @failure Capability、IdentityまたはCommand不一致をEffect前に拒否する。
 * @invariant Repository／WorkspaceをMountしない。
 * @boundary Workbench助言Packetと署名Claude Docker Runtimeの間。
 * @security Packet所有Capabilityと利用Capabilityの両方を要求する。
 * @concurrency 準備結果は一回消費Capabilityで直列化する。
 */
export function prepareRuntimeOwnedClaudeDockerAdviceCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
  advicePacketUseCapability: unknown,
  advicePacketOwnerCapability: unknown,
) {
  return productionAdapter.prepareAdvice(
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    advicePacketUseCapability,
    advicePacketOwnerCapability,
  );
}

/**
 * Runtime 所有 Claude Docker 候補を取り消す。
 *
 * @responsibility Runtime 所有 Claude Docker 候補の取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000015
 * @input preparedCapability: unknown、managementCapability: unknown
 * @returns cancelRuntimeOwnedClaudeDockerCandidateの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown」がcancelRuntimeOwnedClaudeDockerCandidateの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedClaudeDockerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedClaudeDockerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedClaudeDockerCandidateは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedClaudeDockerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelRuntimeOwnedClaudeDockerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedClaudeDockerCandidateは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedClaudeDockerCandidate(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  return productionAdapter.cancel(preparedCapability, managementCapability);
}

/**
 * Runtime 所有 Claude Docker Plan For Process Controllerを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Claude Docker Plan For Process Controllerの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input preparedCapability: unknown、managementCapability: unknown
 * @returns consumeRuntimeOwnedClaudeDockerPlanForProcessControllerの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown」がconsumeRuntimeOwnedClaudeDockerPlanForProcessControllerの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedClaudeDockerPlanForProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedClaudeDockerPlanForProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeRuntimeOwnedClaudeDockerPlanForProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeRuntimeOwnedClaudeDockerPlanForProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security consumeRuntimeOwnedClaudeDockerPlanForProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedClaudeDockerPlanForProcessControllerは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedClaudeDockerPlanForProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  return productionAdapter.consumeForProcessController(
    preparedCapability,
    managementCapability,
  );
}

/**
 * Isolated Claude Docker Runtime Adapter 候補を構築する。
 *
 * @responsibility Isolated Claude Docker Runtime Adapter 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input dependencies: ProviderDockerRuntimeDependencies<"claude">
 * @returns createIsolatedClaudeDockerRuntimeAdapterCandidateの計算結果を返す。
 * @precondition dependenciesはClaude準備の固定操作群を満たし、Storeを持ち込まない。
 * @postcondition createIsolatedClaudeDockerRuntimeAdapterCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedClaudeDockerRuntimeAdapterCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedClaudeDockerRuntimeAdapterCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedClaudeDockerRuntimeAdapterCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createIsolatedClaudeDockerRuntimeAdapterCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedClaudeDockerRuntimeAdapterCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedClaudeDockerRuntimeAdapterCandidate(
  dependencies: ProviderDockerRuntimeDependencies<"claude">,
) {
  return createProviderDockerRuntimeAdapterCandidate("claude", dependencies);
}
/**
 * Claude Docker Runtime Adapter 契約の公開契約を記述する。
 *
 * @responsibility Claude Docker Runtime Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeClaudeDockerRuntimeAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeClaudeDockerRuntimeAdapterContractの入力契約を満たす。
 * @postcondition describeClaudeDockerRuntimeAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeClaudeDockerRuntimeAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeClaudeDockerRuntimeAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeClaudeDockerRuntimeAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeClaudeDockerRuntimeAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeClaudeDockerRuntimeAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeClaudeDockerRuntimeAdapterContract() {
  return Object.freeze({
    contract: CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT,
    contractRevision: CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION,
    provider: "claude",
    subscriptionOffering: "claude_max",
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
    proxyNetworks: Object.freeze(["internal", "egress"]),
    proxyAuthentication: "runtime_random_256_bit_operation_local",
    proxyHostnameAllowlist: Object.freeze([
      "api.anthropic.com",
      "claude.ai",
      "platform.claude.com",
    ]),
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
