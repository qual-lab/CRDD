/**
 * docker-runtime-state-bindingに属する責務をまとめる。
 *
 * @responsibility RuntimeStateBindingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
/**
 * docker-runtime-state-bindingで使用するRuntime 状態 Bindingの値契約を定義する。
 *
 * @responsibility Runtime 状態 BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateBindingの宣言は外部境界を開かない。
 * @security RuntimeStateBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeStateBinding = Readonly<{
  rootPath: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
}>;

/**
 * Exact Docker Runtime 状態 Mutation Boundaryかを判定する。
 *
 * @responsibility Exact Docker Runtime 状態 Mutation Boundaryの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input expected: RuntimeStateBinding、current: RuntimeStateBinding、recoveryIds: readonly string[]、recoveryId: string
 * @returns isExactDockerRuntimeStateMutationBoundaryの計算結果を返す。
 * @precondition 「expected: RuntimeStateBinding、current: RuntimeStateBinding、recoveryIds: readonly string[]、recoveryId: string」がisExactDockerRuntimeStateMutationBoundaryの入力契約を満たす。
 * @postcondition isExactDockerRuntimeStateMutationBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: isExactDockerRuntimeStateMutationBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExactDockerRuntimeStateMutationBoundaryは独自の失敗分岐を所有しない。
 * @invariant isExactDockerRuntimeStateMutationBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExactDockerRuntimeStateMutationBoundaryはProcess内の同一Subsystemで完結する。
 * @security isExactDockerRuntimeStateMutationBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isExactDockerRuntimeStateMutationBoundaryは共有非同期状態を持たない同期処理である。
 */
export function isExactDockerRuntimeStateMutationBoundary(
  expected: RuntimeStateBinding,
  current: RuntimeStateBinding,
  recoveryIds: readonly string[],
  recoveryId: string,
) {
  return (
    current.rootPath === expected.rootPath &&
    current.runtimeStateIdentityHash === expected.runtimeStateIdentityHash &&
    current.runtimeStateProtectionHash ===
      expected.runtimeStateProtectionHash &&
    current.localUserBindingHash === expected.localUserBindingHash &&
    current.runtimeStateBindingHash === expected.runtimeStateBindingHash &&
    recoveryIds.some((candidate) => candidate === recoveryId)
  );
}
