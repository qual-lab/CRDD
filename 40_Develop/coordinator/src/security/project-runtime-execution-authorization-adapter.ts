/**
 * project-runtime-execution-authorization-adapterに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeExecutionAuthorizationAdapterDependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { types as utilTypes } from "node:util";

import type {
  ProjectRuntimeExecutionAuthorizationPort,
  ProjectRuntimeExecutionAuthorizationRequest,
} from "../../../project-runtime/src/index.ts";

/**
 * project-runtime-execution-authorization-adapterで使用するProject Runtime Execution Authorization Adapter Dependenciesの値契約を定義する。
 *
 * @responsibility Project Runtime Execution Authorization Adapter DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeExecutionAuthorizationAdapterDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionAuthorizationAdapterDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionAuthorizationAdapterDependenciesの宣言は外部境界を開かない。
 * @security ProjectRuntimeExecutionAuthorizationAdapterDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeExecutionAuthorizationAdapterDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeExecutionAuthorizationAdapterDependencies = Readonly<{
  issueRuntimeCapability: () => object | null;
  revokeRuntimeCapability?: (capability: object) => boolean;
}>;

/**
 * Opaque Capabilityかを判定する。
 *
 * @responsibility Opaque Capabilityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisOpaqueCapabilityの入力契約を満たす。
 * @postcondition isOpaqueCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: isOpaqueCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isOpaqueCapabilityは独自の失敗分岐を所有しない。
 * @invariant isOpaqueCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isOpaqueCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isOpaqueCapabilityは共有非同期状態を持たない同期処理である。
 */
function isOpaqueCapability(value: unknown): value is object {
  return (
    typeof value === "object" && value !== null && !utilTypes.isProxy(value)
  );
}

/**
 * Identityが有効か判定する。
 *
 * @responsibility Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns validIdentityの計算結果を返す。
 * @precondition 「value: string」がvalidIdentityの入力契約を満たす。
 * @postcondition validIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdentityは独自の失敗分岐を所有しない。
 * @invariant validIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security validIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIdentityは共有非同期状態を持たない同期処理である。
 */
function validIdentity(value: string) {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Requestが有効か判定する。
 *
 * @responsibility Requestの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input request: ProjectRuntimeExecutionAuthorizationRequest
 * @returns validRequestの計算結果を返す。
 * @precondition 「request: ProjectRuntimeExecutionAuthorizationRequest」がvalidRequestの入力契約を満たす。
 * @postcondition validRequestの責務を完了した結果だけを返す。
 * @effect N/A: validRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRequestは独自の失敗分岐を所有しない。
 * @invariant validRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security validRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRequestは共有非同期状態を持たない同期処理である。
 */
function validRequest(request: ProjectRuntimeExecutionAuthorizationRequest) {
  return (
    validIdentity(request.projectId) &&
    validIdentity(request.milestoneId) &&
    validIdentity(request.taskId) &&
    validIdentity(request.attemptId) &&
    validIdentity(request.operationId) &&
    validIdentity(request.authorityBindingId) &&
    /^[0-9a-f]{40,64}$/u.test(request.repositoryRevision)
  );
}

/**
 * Bind the Project Runtime authorization Port to the signed package gate.
 *
 * @responsibility Project Runtime Execution Authorization Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: ProjectRuntimeExecutionAuthorizationAdapterDependencies
 * @returns ProjectRuntimeExecutionAuthorizationPortを返す。
 * @precondition 「dependencies: ProjectRuntimeExecutionAuthorizationAdapterDependencies」がcreateProjectRuntimeExecutionAuthorizationAdapterの入力契約を満たす。
 * @postcondition createProjectRuntimeExecutionAuthorizationAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeExecutionAuthorizationAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProjectRuntimeExecutionAuthorizationAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeExecutionAuthorizationAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProjectRuntimeExecutionAuthorizationAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeExecutionAuthorizationAdapterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeExecutionAuthorizationAdapter(
  dependencies: ProjectRuntimeExecutionAuthorizationAdapterDependencies,
): ProjectRuntimeExecutionAuthorizationPort {
  return Object.freeze({
    /**
     * project-runtime-execution-authorization-adapterを発行する。
     *
     * @responsibility project-runtime-execution-authorization-adapterの発行条件、Identity、非発行時のEffect 0境界を所有する。
     * @trace ARCH-000004
     * @input request
     * @returns issueの計算結果を返す。
     * @precondition 「request」がissueの入力契約を満たす。
     * @postcondition issueの責務を完了した結果だけを返す。
     * @effect N/A: issueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure issueは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant issueは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security issueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: issueは共有非同期状態を持たない同期処理である。
     */
    issue(request) {
      let isValid = false;
      try {
        isValid = validRequest(request);
      } catch {
        isValid = false;
      }
      if (!isValid)
        return Object.freeze({
          status: "blocked" as const,
          reason: "project_runtime_execution_authorization_request_invalid",
          value: null,
          manualRecoveryRequired: false,
          recoveryId: null,
        });
      try {
        const capability = dependencies.issueRuntimeCapability();
        return isOpaqueCapability(capability)
          ? Object.freeze({
              status: "completed" as const,
              reason: "project_runtime_execution_authorization_issued",
              value: capability,
            })
          : Object.freeze({
              status: "blocked" as const,
              reason: "project_runtime_execution_authorization_not_issued",
              value: null,
              manualRecoveryRequired: false,
              recoveryId: null,
            });
      } catch {
        return Object.freeze({
          status: "blocked" as const,
          reason: "project_runtime_execution_authorization_issue_unknown",
          value: null,
          manualRecoveryRequired: true,
          recoveryId: null,
        });
      }
    },
    /**
     * Unusedを失効させる。
     *
     * @responsibility Unusedの失効Authority、対象Identity、再利用防止境界を所有する。
     * @trace ARCH-000004
     * @input capability
     * @returns revokeUnusedの計算結果を返す。
     * @precondition 「capability」がrevokeUnusedの入力契約を満たす。
     * @postcondition revokeUnusedの責務を完了した結果だけを返す。
     * @effect N/A: revokeUnusedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure revokeUnusedは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant revokeUnusedは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security revokeUnusedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: revokeUnusedは共有非同期状態を持たない同期処理である。
     */
    revokeUnused(capability) {
      try {
        return isOpaqueCapability(capability) &&
          dependencies.revokeRuntimeCapability?.(capability) === true
          ? Object.freeze({
              status: "completed" as const,
              reason: "project_runtime_execution_authorization_revoked",
              value: null,
            })
          : Object.freeze({
              status: "blocked" as const,
              reason: "project_runtime_execution_authorization_revoke_unknown",
              value: null,
              manualRecoveryRequired: true,
              recoveryId: null,
            });
      } catch {
        return Object.freeze({
          status: "blocked" as const,
          reason: "project_runtime_execution_authorization_revoke_unknown",
          value: null,
          manualRecoveryRequired: true,
          recoveryId: null,
        });
      }
    },
  });
}
