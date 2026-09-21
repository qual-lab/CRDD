import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";
import { createHash } from "node:crypto";

export const REPOSITORY_LOCAL_IGNORE_CONTRACT =
  "crdd-version-control/repository-local-ignore/v1";
export const REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION = 1;

/**
 * RepositoryLocalIgnoreAdapterResultが扱う値の構造を表す。
 *
 * @responsibility RepositoryLocalIgnoreAdapterResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape RepositoryLocalIgnoreAdapterResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryLocalIgnoreAdapterResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryLocalIgnoreAdapterResultの宣言は外部境界を開かない。
 * @security N/A: RepositoryLocalIgnoreAdapterResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryLocalIgnoreAdapterResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryLocalIgnoreAdapterResult =
  | Readonly<{
      status: "completed";
      changed: boolean;
      beforeContentIdentity: string;
      afterContentIdentity: string;
      effectIssued: boolean;
      effectConfirmation: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_local_ignore_update_blocked";
      effectIssued: boolean;
      effectConfirmation: "not_issued" | "unknown";
      cleanupConfirmed: boolean;
    }>;

/**
 * RepositoryLocalIgnoreAdapterが扱う値の構造を表す。
 *
 * @responsibility RepositoryLocalIgnoreAdapterに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape RepositoryLocalIgnoreAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryLocalIgnoreAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryLocalIgnoreAdapterの宣言は外部境界を開かない。
 * @security N/A: RepositoryLocalIgnoreAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryLocalIgnoreAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryLocalIgnoreAdapter = (
  repositoryRoot: string,
  entry: string,
) => RepositoryLocalIgnoreAdapterResult;

/**
 * registerRepositoryLocalIgnoreの処理を実行する。
 *
 * @responsibility registerRepositoryLocalIgnoreに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、entry: unknown、adapter: RepositoryLocalIgnoreAdapter
 * @returns registerRepositoryLocalIgnoreの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、entry: unknown、adapter: RepositoryLocalIgnoreAdapter」がregisterRepositoryLocalIgnoreの入力契約を満たす。
 * @postcondition registerRepositoryLocalIgnoreの責務を完了した結果だけを返す。
 * @effect N/A: registerRepositoryLocalIgnoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure registerRepositoryLocalIgnoreは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant registerRepositoryLocalIgnoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: registerRepositoryLocalIgnoreはProcess内の同一Subsystemで完結する。
 * @security registerRepositoryLocalIgnoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: registerRepositoryLocalIgnoreは共有非同期状態を持たない同期処理である。
 */
export function registerRepositoryLocalIgnore(
  capability: VerifiedRepositoryRoot,
  entry: unknown,
  adapter: RepositoryLocalIgnoreAdapter,
) {
  if (
    typeof entry !== "string" ||
    entry.length === 0 ||
    entry.length > 1_024 ||
    entry.includes("\\") ||
    entry.startsWith("/") ||
    /[\u0000-\u001f\u007f]/u.test(entry) ||
    entry
      .split("/")
      .some(
        (segment, index, segments) =>
          (segment === "" && index !== segments.length - 1) ||
          segment === "." ||
          segment === "..",
      )
  )
    throw new Error("repository_local_ignore_entry_invalid");
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  const result = adapter(repositoryRoot, entry);
  return result.status === "completed"
    ? Object.freeze({
        contract: REPOSITORY_LOCAL_IGNORE_CONTRACT,
        contractRevision: REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION,
        status: "registered" as const,
        changed: result.changed,
        beforeContentIdentity: result.beforeContentIdentity,
        afterContentIdentity: result.afterContentIdentity,
        effectIssued: result.effectIssued,
        effectConfirmation: result.effectConfirmation,
        cleanupConfirmed: result.cleanupConfirmed,
        registrationVerified: true as const,
        repositoryPathReported: false as const,
      })
    : Object.freeze({
        contract: REPOSITORY_LOCAL_IGNORE_CONTRACT,
        contractRevision: REPOSITORY_LOCAL_IGNORE_CONTRACT_REVISION,
        status: "blocked" as const,
        reason: result.reason,
        effectIssued: result.effectIssued,
        effectConfirmation: result.effectConfirmation,
        effectStateUnknown: result.effectConfirmation === "unknown",
        cleanupConfirmed: result.cleanupConfirmed,
        retryAllowed:
          result.effectConfirmation === "not_issued" && result.cleanupConfirmed,
        recoveryReference:
          result.effectConfirmation === "unknown" || !result.cleanupConfirmed
            ? `repository-local-ignore.${createHash("sha256")
                .update(repositoryRoot)
                .update("\0")
                .update(entry)
                .digest("hex")}`
            : null,
        repositoryPathReported: false as const,
      });
}
