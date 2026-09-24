/**
 * repository-revisionに属する責務をまとめる。
 *
 * @responsibility RepositoryRevisionObservationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

/**
 * repository-revisionで使用するRepository Revision Observationの値契約を定義する。
 *
 * @responsibility Repository Revision ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryRevisionObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRevisionObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRevisionObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryRevisionObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRevisionObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRevisionObservation = Readonly<{
  repositoryIdentity: string;
  repositoryInstanceIdentity: string;
  repositoryForm: "primary" | "linked" | "embedded";
  revisionIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * repository-revisionで使用するRepository Revision Adapterの値契約を定義する。
 *
 * @responsibility Repository Revision AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryRevisionAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRevisionAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRevisionAdapterの宣言は外部境界を開かない。
 * @security N/A: RepositoryRevisionAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRevisionAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRevisionAdapter = (
  repositoryRoot: string,
) => RepositoryRevisionObservation | null;

/**
 * repository-revisionで使用するRepository Format Adapterの値契約を定義する。
 *
 * @responsibility Repository Format AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryFormatAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryFormatAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryFormatAdapterの宣言は外部境界を開かない。
 * @security N/A: RepositoryFormatAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryFormatAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryFormatAdapter = (
  repositoryRoot: string,
) => Readonly<{ objectFormat: "sha1" | "sha256" }> | null;

/**
 * Repository Revisionを観測する。
 *
 * @responsibility Repository Revisionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、adapter: RepositoryRevisionAdapter
 * @returns RepositoryRevisionObservation | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、adapter: RepositoryRevisionAdapter」がobserveRepositoryRevisionの入力契約を満たす。
 * @postcondition observeRepositoryRevisionの責務を完了した結果だけを返す。
 * @effect N/A: observeRepositoryRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeRepositoryRevisionは独自の失敗分岐を所有しない。
 * @invariant observeRepositoryRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeRepositoryRevisionはProcess内の同一Subsystemで完結する。
 * @security observeRepositoryRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRepositoryRevisionは共有非同期状態を持たない同期処理である。
 */
export function observeRepositoryRevision(
  capability: VerifiedRepositoryRoot,
  adapter: RepositoryRevisionAdapter,
): RepositoryRevisionObservation | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null ? null : adapter(repositoryRoot);
}

/**
 * Repository Formatを観測する。
 *
 * @responsibility Repository Formatの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input repositoryRoot: unknown、adapter: RepositoryFormatAdapter
 * @returns inspectRepositoryFormatの計算結果を返す。
 * @precondition 「repositoryRoot: unknown、adapter: RepositoryFormatAdapter」がinspectRepositoryFormatの入力契約を満たす。
 * @postcondition inspectRepositoryFormatの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryFormatは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRepositoryFormatは独自の失敗分岐を所有しない。
 * @invariant inspectRepositoryFormatは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryFormatはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRepositoryFormatはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRepositoryFormatは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryFormat(
  repositoryRoot: unknown,
  adapter: RepositoryFormatAdapter,
) {
  return typeof repositoryRoot === "string" ? adapter(repositoryRoot) : null;
}
