/** Normalize a bounded repository-relative path without consulting the Host filesystem. */
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
