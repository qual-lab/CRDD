/**
 * Normalize a bounded repository-relative path without consulting the Host filesystem.
 *
 * @responsibility normalizeRepositoryRelativePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns string | nullを返す。
 * @precondition 「value: unknown」がnormalizeRepositoryRelativePathの入力契約を満たす。
 * @postcondition normalizeRepositoryRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: normalizeRepositoryRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeRepositoryRelativePathは独自の失敗分岐を所有しない。
 * @invariant normalizeRepositoryRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeRepositoryRelativePathはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizeRepositoryRelativePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeRepositoryRelativePathは共有非同期状態を持たない同期処理である。
 */
export function normalizeRepositoryRelativePath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    return null;
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:($|\/)/u.test(normalized) ||
    normalized
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return null;
  return normalized;
}

/**
 * repositoryPathWithinの処理を実行する。
 *
 * @responsibility repositoryPathWithinに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input candidate: string、roots: readonly string[]
 * @returns repositoryPathWithinの計算結果を返す。
 * @precondition 「candidate: string、roots: readonly string[]」がrepositoryPathWithinの入力契約を満たす。
 * @postcondition repositoryPathWithinの責務を完了した結果だけを返す。
 * @effect N/A: repositoryPathWithinは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: repositoryPathWithinは独自の失敗分岐を所有しない。
 * @invariant repositoryPathWithinは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: repositoryPathWithinはProcess内の同一Subsystemで完結する。
 * @security N/A: repositoryPathWithinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: repositoryPathWithinは共有非同期状態を持たない同期処理である。
 */
export function repositoryPathWithin(
  candidate: string,
  roots: readonly string[],
) {
  const normalizedCandidate = normalizeRepositoryRelativePath(candidate);
  if (normalizedCandidate === null) return false;
  const candidateKey = normalizedCandidate.toUpperCase();
  return roots.some((rootValue) => {
    const root = normalizeRepositoryRelativePath(rootValue);
    if (root === null) return false;
    const rootKey = root.toUpperCase();
    return candidateKey === rootKey || candidateKey.startsWith(`${rootKey}/`);
  });
}
