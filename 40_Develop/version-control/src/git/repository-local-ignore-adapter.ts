/**
 * repository-local-ignore-adapterに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import type { RepositoryLocalIgnoreAdapter } from "../repository-local-ignore.ts";
import {
  resolveRepositoryGitLayout,
  writeRepositoryLocalExclude,
} from "./repository-layout.ts";

export const gitRepositoryLocalIgnoreAdapter: RepositoryLocalIgnoreAdapter = (
  repositoryRoot,
  entry,
) => {
  try {
    return writeRepositoryLocalExclude(
      resolveRepositoryGitLayout(repositoryRoot),
      entry,
    );
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_local_ignore_update_blocked" as const,
      effectIssued: false,
      effectConfirmation: "not_issued" as const,
      cleanupConfirmed: true,
    });
  }
};
