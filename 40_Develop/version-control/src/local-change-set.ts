/**
 * local-change-setに属する責務をまとめる。
 *
 * @responsibility LocalChangeSetを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export const LOCAL_CHANGE_SET_CONTRACT =
  "crdd-version-control/local-change-set/v1";
export const LOCAL_CHANGE_SET_CONTRACT_REVISION = 1;

/**
 * local-change-setで使用するLocal Change Setの値契約を定義する。
 *
 * @responsibility Local Change SetのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape LocalChangeSetが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LocalChangeSetで宣言した値と責務の対応を維持する。
 * @boundary N/A: LocalChangeSetの宣言は外部境界を開かない。
 * @security N/A: LocalChangeSetはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LocalChangeSetの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LocalChangeSet = Readonly<{
  contract: typeof LOCAL_CHANGE_SET_CONTRACT;
  contractRevision: typeof LOCAL_CHANGE_SET_CONTRACT_REVISION;
  revisionChanges: readonly string[];
  preparedChanges: readonly string[];
  workingChanges: readonly string[];
  unregisteredPaths: readonly string[];
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * local-change-setで使用するLocal Change Set Observationの値契約を定義する。
 *
 * @responsibility Local Change Set ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape LocalChangeSetObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LocalChangeSetObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: LocalChangeSetObservationの宣言は外部境界を開かない。
 * @security N/A: LocalChangeSetObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LocalChangeSetObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LocalChangeSetObservation = Readonly<{
  revisionChanges: readonly string[];
  preparedChanges: readonly string[];
  workingChanges: readonly string[];
  unregisteredPaths: readonly string[];
}>;

/**
 * local-change-setで使用するLocal Change Set Adapterの値契約を定義する。
 *
 * @responsibility Local Change Set AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape LocalChangeSetAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LocalChangeSetAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: LocalChangeSetAdapterの宣言は外部境界を開かない。
 * @security N/A: LocalChangeSetAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LocalChangeSetAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LocalChangeSetAdapter = (
  repositoryRoot: string,
  comparisonBase: string,
) => LocalChangeSetObservation;

/**
 * Comparison Baseの契約を検証する。
 *
 * @responsibility Comparison Baseの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000002
 * @input value: unknown
 * @returns asserts value is stringを返す。
 * @precondition 「value: unknown」がvalidateComparisonBaseの入力契約を満たす。
 * @postcondition validateComparisonBaseの責務を完了した結果だけを返す。
 * @effect N/A: validateComparisonBaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateComparisonBaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateComparisonBaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateComparisonBaseはProcess内の同一Subsystemで完結する。
 * @security N/A: validateComparisonBaseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateComparisonBaseは共有非同期状態を持たない同期処理である。
 */
function validateComparisonBase(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_024 ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    value.startsWith("-")
  )
    throw new Error("change_comparison_base_invalid");
}

/**
 * Pathsの契約を検証する。
 *
 * @responsibility Pathsの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000002
 * @input paths: readonly string[]、phase: string
 * @returns N/A: validatePathsは戻り値を返さない。
 * @precondition 「paths: readonly string[]、phase: string」がvalidatePathsの入力契約を満たす。
 * @postcondition validatePathsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: validatePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validatePathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validatePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatePathsはProcess内の同一Subsystemで完結する。
 * @security N/A: validatePathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validatePathsは共有非同期状態を持たない同期処理である。
 */
function validatePaths(paths: readonly string[], phase: string): void {
  if (
    paths.some(
      (entry) =>
        entry.length === 0 ||
        entry.includes("\\") ||
        entry.startsWith("/") ||
        /^[A-Za-z]:/u.test(entry) ||
        entry
          .split("/")
          .some(
            (segment) => segment === "" || segment === "." || segment === "..",
          ),
    )
  )
    throw new Error(`local_change_set_observation_invalid:${phase}`);
}

/**
 * Sortedを重複のない順序へ正規化する。
 *
 * @responsibility Sortedの重複判定、順序規則、結果集合境界を所有する。
 * @trace ARCH-000002
 * @input groups: readonly (readonly string[])[]
 * @returns readonly string[]を返す。
 * @precondition 「groups: readonly (readonly string[])[]」がuniqueSortedの入力契約を満たす。
 * @postcondition uniqueSortedの責務を完了した結果だけを返す。
 * @effect N/A: uniqueSortedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uniqueSortedは独自の失敗分岐を所有しない。
 * @invariant uniqueSortedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uniqueSortedはProcess内の同一Subsystemで完結する。
 * @security N/A: uniqueSortedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: uniqueSortedは共有非同期状態を持たない同期処理である。
 */
function uniqueSorted(
  groups: readonly (readonly string[])[],
): readonly string[] {
  return Object.freeze(
    [...new Set(groups.flat())].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

/**
 * Local Change Setを観測する。
 *
 * @responsibility Local Change Setの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、comparisonBase: unknown、adapter: LocalChangeSetAdapter
 * @returns LocalChangeSetを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、comparisonBase: unknown、adapter: LocalChangeSetAdapter」がobserveLocalChangeSetの入力契約を満たす。
 * @postcondition observeLocalChangeSetの責務を完了した結果だけを返す。
 * @effect N/A: observeLocalChangeSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeLocalChangeSetは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLocalChangeSetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeLocalChangeSetはProcess内の同一Subsystemで完結する。
 * @security observeLocalChangeSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLocalChangeSetは共有非同期状態を持たない同期処理である。
 */
export function observeLocalChangeSet(
  capability: VerifiedRepositoryRoot,
  comparisonBase: unknown,
  adapter: LocalChangeSetAdapter,
): LocalChangeSet {
  validateComparisonBase(comparisonBase);
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  const observed = adapter(repositoryRoot, comparisonBase);
  validatePaths(observed.revisionChanges, "revision_changes");
  validatePaths(observed.preparedChanges, "prepared_changes");
  validatePaths(observed.workingChanges, "working_changes");
  validatePaths(observed.unregisteredPaths, "unregistered_paths");
  return Object.freeze({
    contract: LOCAL_CHANGE_SET_CONTRACT,
    contractRevision: LOCAL_CHANGE_SET_CONTRACT_REVISION,
    revisionChanges: uniqueSorted([observed.revisionChanges]),
    preparedChanges: uniqueSorted([observed.preparedChanges]),
    workingChanges: uniqueSorted([observed.workingChanges]),
    unregisteredPaths: uniqueSorted([observed.unregisteredPaths]),
    observationComplete: true,
    repositoryPathReported: false,
  });
}

/**
 * changed Pathsを決定する。
 *
 * @responsibility changed Pathsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input changeSet: LocalChangeSet
 * @returns readonly string[]を返す。
 * @precondition 「changeSet: LocalChangeSet」がchangedPathsの入力契約を満たす。
 * @postcondition changedPathsの責務を完了した結果だけを返す。
 * @effect N/A: changedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: changedPathsは独自の失敗分岐を所有しない。
 * @invariant changedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: changedPathsはProcess内の同一Subsystemで完結する。
 * @security N/A: changedPathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: changedPathsは共有非同期状態を持たない同期処理である。
 */
export function changedPaths(changeSet: LocalChangeSet): readonly string[] {
  return uniqueSorted([
    changeSet.revisionChanges,
    changeSet.preparedChanges,
    changeSet.workingChanges,
    changeSet.unregisteredPaths,
  ]);
}
