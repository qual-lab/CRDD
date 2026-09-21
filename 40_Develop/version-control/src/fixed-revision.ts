import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export const FIXED_REVISION_IDENTITY_CONTRACT =
  "crdd-version-control/fixed-revision-identity/v1";
export const FIXED_REVISION_IDENTITY_CONTRACT_REVISION = 1;

/**
 * FixedRevisionIdentityが扱う値の構造を表す。
 *
 * @responsibility FixedRevisionIdentityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape FixedRevisionIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedRevisionIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedRevisionIdentityの宣言は外部境界を開かない。
 * @security N/A: FixedRevisionIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedRevisionIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedRevisionIdentity = Readonly<{
  contract: typeof FIXED_REVISION_IDENTITY_CONTRACT;
  contractRevision: typeof FIXED_REVISION_IDENTITY_CONTRACT_REVISION;
  status: "observed";
  repositoryIdentity: string;
  repositoryInstanceIdentity: string;
  repositoryForm: "primary" | "linked" | "embedded";
  revisionIdentity: string;
  snapshotIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * FixedRevisionIdentityAdapterが扱う値の構造を表す。
 *
 * @responsibility FixedRevisionIdentityAdapterに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape FixedRevisionIdentityAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedRevisionIdentityAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedRevisionIdentityAdapterの宣言は外部境界を開かない。
 * @security N/A: FixedRevisionIdentityAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedRevisionIdentityAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedRevisionIdentityAdapter = (
  repositoryRoot: string,
) => FixedRevisionIdentity | null;

/**
 * observeFixedRevisionIdentityの処理を実行する。
 *
 * @responsibility observeFixedRevisionIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、adapter: FixedRevisionIdentityAdapter
 * @returns FixedRevisionIdentity | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、adapter: FixedRevisionIdentityAdapter」がobserveFixedRevisionIdentityの入力契約を満たす。
 * @postcondition observeFixedRevisionIdentityの責務を完了した結果だけを返す。
 * @effect N/A: observeFixedRevisionIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeFixedRevisionIdentityは独自の失敗分岐を所有しない。
 * @invariant observeFixedRevisionIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeFixedRevisionIdentityはProcess内の同一Subsystemで完結する。
 * @security observeFixedRevisionIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeFixedRevisionIdentityは共有非同期状態を持たない同期処理である。
 */
export function observeFixedRevisionIdentity(
  capability: VerifiedRepositoryRoot,
  adapter: FixedRevisionIdentityAdapter,
): FixedRevisionIdentity | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null ? null : adapter(repositoryRoot);
}
