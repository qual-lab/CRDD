import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";

/**
 * VerifiedExecutionRepositoryRootが扱う値の構造を表す。
 *
 * @responsibility VerifiedExecutionRepositoryRootに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000007
 * @shape VerifiedExecutionRepositoryRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedExecutionRepositoryRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedExecutionRepositoryRootの宣言は外部境界を開かない。
 * @security N/A: VerifiedExecutionRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility VerifiedExecutionRepositoryRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerifiedExecutionRepositoryRoot = VerifiedRepositoryRoot;

/**
 * verifyExecutionIntelligenceRepositoryRootの処理を実行する。
 *
 * @responsibility verifyExecutionIntelligenceRepositoryRootに対応する入力処理と結果生成を所有する。
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
 * resolveVerifiedExecutionRepositoryRootの処理を実行する。
 *
 * @responsibility resolveVerifiedExecutionRepositoryRootに対応する入力処理と結果生成を所有する。
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
