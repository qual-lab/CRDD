/**
 * 認証済みProject運営者をAcceptance Decision Authorityへ結合する。
 *
 * @responsibility Transportで検証済みのPrincipalだけをexactなAcceptance Decision Bindingへ許可する。
 * @trace ARCH-000005
 */
import type { ProjectRuntimeAcceptanceDecisionAuthorityPort } from "../../../project-runtime/src/index.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * 認証済みPrincipalへ限定したAcceptance Decision Authority Adapterを構築する。
 *
 * @responsibility 認証境界で確定したPrincipalと判断要求のPrincipalをexact比較する。
 * @trace ARCH-000005
 * @input authenticatedPrincipalId: Transportが検証したPrincipal Identity。
 * @returns ProjectRuntimeAcceptanceDecisionAuthorityPortを返す。
 * @precondition PrincipalはRuntime-owned認証境界で検証済みである。
 * @postcondition 同じPrincipal、SPEC-000002および有効な対象Bindingだけを許可する。
 * @effect N/A: Authorityの比較だけを行い、CapabilityやEffectを発行しない。
 * @failure 不正PrincipalまたはBindingはfalseへ閉じる。
 * @invariant 読取り投影、Task完了またはProvider結果からAuthorityを生成しない。
 * @boundary Runtime-owned認証PrincipalとProject Runtime Authority Portの境界。
 * @security Principalを拡張せず、秘密値を生成・保存・公開しない。
 * @concurrency N/A: 不変値の同期比較だけを行う。
 */
export function createProjectRuntimeAcceptanceAuthorityAdapter(
  authenticatedPrincipalId: string,
): ProjectRuntimeAcceptanceDecisionAuthorityPort {
  if (!ID.test(authenticatedPrincipalId))
    throw new Error("project_runtime_acceptance_principal_invalid");
  return Object.freeze({
    verify: (binding) =>
      binding.sourceSpecId === "SPEC-000002" &&
      binding.principalId === authenticatedPrincipalId &&
      ID.test(binding.projectId) &&
      ID.test(binding.milestoneId) &&
      ID.test(binding.targetId),
  });
}
