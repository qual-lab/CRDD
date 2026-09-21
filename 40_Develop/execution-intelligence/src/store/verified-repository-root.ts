/**
 * verified-repository-rootに属する責務をまとめる。
 *
 * @responsibility VerifiedExecutionRepositoryRootを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";

/**
 * verified-repository-rootで使用するVerified Execution Repository Rootの値契約を定義する。
 *
 * @responsibility Verified Execution Repository RootのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape VerifiedExecutionRepositoryRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedExecutionRepositoryRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedExecutionRepositoryRootの宣言は外部境界を開かない。
 * @security N/A: VerifiedExecutionRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility VerifiedExecutionRepositoryRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerifiedExecutionRepositoryRoot = VerifiedRepositoryRoot;

/**
 * Execution Intelligence Repository Rootを検証する。
 *
 * @responsibility Execution Intelligence Repository Rootの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000007
 * @input candidate: string
 * @returns | Readonly<{ status: "completed"; reason: "execution_repository_root_verified"; root: VerifiedExecutionRepositoryRoot; }> | Readonly<{ status: "blocked"; reason: "execution_repository_root_invalid"; }>を返す。
 * @precondition 「candidate: string」がverifyExecutionIntelligenceRepositoryRootの入力契約を満たす。
 * @postcondition verifyExecutionIntelligenceRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: verifyExecutionIntelligenceRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyExecutionIntelligenceRepositoryRootは独自の失敗分岐を所有しない。
 * @invariant verifyExecutionIntelligenceRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyExecutionIntelligenceRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyExecutionIntelligenceRepositoryRootは共有非同期状態を持たない同期処理である。
 */
export function verifyExecutionIntelligenceRepositoryRoot(candidate: string):
  | Readonly<{
      status: "completed";
      reason: "execution_repository_root_verified";
      root: VerifiedExecutionRepositoryRoot;
    }>
  | Readonly<{
      status: "blocked";
      reason: "execution_repository_root_invalid";
    }> {
  const verified = verifyRepositoryRoot(candidate);
  if (verified.status === "blocked")
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_repository_root_invalid" as const,
    });
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_repository_root_verified" as const,
    root: verified.capability,
  });
}

/**
 * Verified Execution Repository Rootを一意に解決する。
 *
 * @responsibility Verified Execution Repository Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000007
 * @input capability: VerifiedExecutionRepositoryRoot
 * @returns string | nullを返す。
 * @precondition 「capability: VerifiedExecutionRepositoryRoot」がresolveVerifiedExecutionRepositoryRootの入力契約を満たす。
 * @postcondition resolveVerifiedExecutionRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveVerifiedExecutionRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveVerifiedExecutionRepositoryRootは独自の失敗分岐を所有しない。
 * @invariant resolveVerifiedExecutionRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resolveVerifiedExecutionRepositoryRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveVerifiedExecutionRepositoryRootは共有非同期状態を持たない同期処理である。
 */
export function resolveVerifiedExecutionRepositoryRoot(
  capability: VerifiedExecutionRepositoryRoot,
): string | null {
  return resolveVerifiedRepositoryRoot(capability);
}
