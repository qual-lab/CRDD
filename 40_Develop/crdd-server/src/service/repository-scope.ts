/**
 * 共有リポジトリを運用者が許可した実ディレクトリの配下に限定する。
 * @packageDocumentation
 * @trace ARCH-000012
 */
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export type RepositoryScope = (directory: string) => boolean;

function isFullyQualified(directory: string): boolean {
  // WindowsのisAbsoluteは現在のドライブに依存する「\folder」も受け入れる。
  return (
    path.isAbsolute(directory) &&
    (process.platform !== "win32" || path.parse(directory).root.length > 1)
  );
}

function directoryIdentity(directory: string) {
  const stat = lstatSync(directory, { bigint: true });
  return stat.isDirectory() && !stat.isSymbolicLink() && stat.ino !== 0n
    ? `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`
    : null;
}

/** 起動時に運用者の許可ルートを固定し、利用時に同じ実体の配下だけを許可する。 */
export function createRepositoryScope(
  inputs: readonly string[],
): RepositoryScope {
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 32)
    throw new Error("shared_repository_roots_invalid");

  const roots = inputs.map((input) => {
    if (typeof input !== "string" || !isFullyQualified(input))
      throw new Error("shared_repository_roots_invalid");
    try {
      const root = realpathSync.native(input);
      const identity = directoryIdentity(root);
      if (path.relative(path.parse(root).root, root) && identity !== null)
        return { root, identity };
    } catch {
      // 設定元のパスをエラー応答へ転送しない。
    }
    throw new Error("shared_repository_roots_invalid");
  });
  return (directory) => {
    if (!isFullyQualified(directory)) return false;
    try {
      const resolved = realpathSync.native(directory);
      return roots.some(({ root, identity }) => {
        const relative = path.relative(root, resolved);
        if (
          relative === "" ||
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative) ||
          path.join(root, relative) !== resolved
        )
          return false;
        return (
          realpathSync.native(root) === root &&
          directoryIdentity(root) === identity
        );
      });
    } catch {
      return false;
    }
  };
}
