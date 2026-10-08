/**
 * 固定Codex入口をCoordinator共通Docker準備Runtimeへ接続する。
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

export const CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/codex-docker-runtime-adapter";
export const CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION = 8;

const productionAdapter = getRuntimeOwnedProviderDockerAdapter("codex");

/**
 * Runtime 所有 Codex Docker 候補を実行前候補として準備する。
 *
 * @responsibility Runtime 所有 Codex Docker 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown
 * @returns prepareRuntimeOwnedCodexDockerCandidateの計算結果を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown」がprepareRuntimeOwnedCodexDockerCandidateの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedCodexDockerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedCodexDockerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareRuntimeOwnedCodexDockerCandidateは独自の失敗分岐を所有しない。
 * @invariant prepareRuntimeOwnedCodexDockerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareRuntimeOwnedCodexDockerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedCodexDockerCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedCodexDockerCandidate(
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
 * Runtime 所有 Codex Docker Task 候補を実行前候補として準備する。
 *
 * @responsibility Runtime 所有 Codex Docker Task 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown
 * @returns prepareRuntimeOwnedCodexDockerTaskCandidateの計算結果を返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown、mountAuthorizationCapability: unknown、selectionUseCapability: unknown、taskPacketUseCapability: unknown、recoveryCorrelationId: unknown」がprepareRuntimeOwnedCodexDockerTaskCandidateの入力契約を満たす。
 * @postcondition prepareRuntimeOwnedCodexDockerTaskCandidateの責務を完了した結果だけを返す。
 * @effect N/A: prepareRuntimeOwnedCodexDockerTaskCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: prepareRuntimeOwnedCodexDockerTaskCandidateは独自の失敗分岐を所有しない。
 * @invariant prepareRuntimeOwnedCodexDockerTaskCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security prepareRuntimeOwnedCodexDockerTaskCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareRuntimeOwnedCodexDockerTaskCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareRuntimeOwnedCodexDockerTaskCandidate(
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
 * @responsibility 一回消費PacketをRepository非共有のCodex実行Planへ結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input 管理、Mount、Model Selection、Advice Packetの各Capability。
 * @returns 準備済み候補またはEffect 0のblocked結果。
 * @precondition Advice Packetは同じOperation、ProfileおよびProviderへ固定されている。
 * @postcondition preparedの場合だけworkbench_advice Planを一回消費できる。
 * @effect Provider Effectは発行せず、Provider Home Leaseと短期Authorityだけを準備する。
 * @failure Capability、IdentityまたはCommand不一致をEffect前に拒否する。
 * @invariant Repository／WorkspaceをMountしない。
 * @boundary Workbench助言Packetと署名Codex Docker Runtimeの間。
 * @security Packet所有Capabilityと利用Capabilityの両方を要求する。
 * @concurrency 準備結果は一回消費Capabilityで直列化する。
 */
export function prepareRuntimeOwnedCodexDockerAdviceCandidate(
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
 * Runtime 所有 Codex Docker 候補を取り消す。
 *
 * @responsibility Runtime 所有 Codex Docker 候補の取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000015
 * @input preparedCapability: unknown、managementCapability: unknown
 * @returns cancelRuntimeOwnedCodexDockerCandidateの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown」がcancelRuntimeOwnedCodexDockerCandidateの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedCodexDockerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedCodexDockerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedCodexDockerCandidateは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedCodexDockerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelRuntimeOwnedCodexDockerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedCodexDockerCandidateは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedCodexDockerCandidate(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  return productionAdapter.cancel(preparedCapability, managementCapability);
}

/**
 * Runtime 所有 Codex Docker Plan For Process Controllerを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Codex Docker Plan For Process Controllerの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input preparedCapability: unknown、managementCapability: unknown
 * @returns consumeRuntimeOwnedCodexDockerPlanForProcessControllerの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown」がconsumeRuntimeOwnedCodexDockerPlanForProcessControllerの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedCodexDockerPlanForProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedCodexDockerPlanForProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeRuntimeOwnedCodexDockerPlanForProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeRuntimeOwnedCodexDockerPlanForProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security consumeRuntimeOwnedCodexDockerPlanForProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedCodexDockerPlanForProcessControllerは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedCodexDockerPlanForProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  return productionAdapter.consumeForProcessController(
    preparedCapability,
    managementCapability,
  );
}

/**
 * Isolated Codex Docker Runtime Adapter 候補を構築する。
 *
 * @responsibility Isolated Codex Docker Runtime Adapter 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000015
 * @input dependencies: ProviderDockerRuntimeDependencies<"codex">
 * @returns createIsolatedCodexDockerRuntimeAdapterCandidateの計算結果を返す。
 * @precondition dependenciesはCodex準備の固定操作群を満たし、Storeを持ち込まない。
 * @postcondition createIsolatedCodexDockerRuntimeAdapterCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCodexDockerRuntimeAdapterCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedCodexDockerRuntimeAdapterCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedCodexDockerRuntimeAdapterCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createIsolatedCodexDockerRuntimeAdapterCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCodexDockerRuntimeAdapterCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCodexDockerRuntimeAdapterCandidate(
  dependencies: ProviderDockerRuntimeDependencies<"codex">,
) {
  return createProviderDockerRuntimeAdapterCandidate("codex", dependencies);
}
/**
 * Codex Docker Runtime Adapter 契約の公開契約を記述する。
 *
 * @responsibility Codex Docker Runtime Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCodexDockerRuntimeAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCodexDockerRuntimeAdapterContractの入力契約を満たす。
 * @postcondition describeCodexDockerRuntimeAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCodexDockerRuntimeAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCodexDockerRuntimeAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeCodexDockerRuntimeAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeCodexDockerRuntimeAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCodexDockerRuntimeAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeCodexDockerRuntimeAdapterContract() {
  return Object.freeze({
    contract: CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT,
    contractRevision: CODEX_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION,
    provider: "codex",
    subscriptionOffering: "chatgpt_subscription_oauth",
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
    providerProxyEnvironment: Object.freeze([
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "ALL_PROXY",
      "NO_PROXY_EMPTY",
    ]),
    proxyNetworks: Object.freeze(["internal", "egress"]),
    proxyAuthentication: "runtime_random_256_bit_operation_local",
    proxyHostnameAllowlist: Object.freeze(["auth.openai.com", "chatgpt.com"]),
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
