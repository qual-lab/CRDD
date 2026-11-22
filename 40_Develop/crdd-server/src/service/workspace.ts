/**
 * Workspaceの受付と、単体接続の対象Repository照合を担当する。
 * @responsibility 既存CoordinatorのWorkspace操作へ接続し、状態・保存規則を複製しない。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @boundary 通信別の受付とCoordinator・検証済みRepositoryの間。
 */
import { readRepositoryManifest } from "../../../configuration-model/src/index.ts";
import {
  getRepository,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

/** HTTPとMCPのWorkspace受付を、同じCoordinator検査と操作へ接続する。 @trace ARCH-000012 */
export async function prepareWorkspaceOperation(
  input: unknown,
  signal: AbortSignal,
) {
  const { inspectWorkspaceCommand, executeWorkspace } = await import(
    "../../../coordinator/src/index.ts"
  );
  if (signal.aborted) return null;
  const command = inspectWorkspaceCommand(input);
  return command ? { command, executeWorkspace } : null;
}

/**
 * 単体接続を起動時のRepositoryと現在のManifestへ結合する。
 * @responsibility 指定IDが起動対象と一致し、処置前後に同じ実体を認識できる場合だけ許可する。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @boundary 単体の起動構成とCoordinatorのWorkspace操作。
 */
export function resolveLocalWorkspaceAccess(
  repositoryRoot: string,
  repositoryId: string,
  signal: AbortSignal,
) {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed") return null;
  const initial = readRepositoryManifest(verified.capability);
  if (
    initial.status !== "ready" ||
    initial.manifest.repositoryId !== repositoryId
  )
    return null;
  return {
    ownerRoot: repositoryRoot,
    projectId: initial.manifest.projectId,
    authorize: () => {
      const fresh = readRepositoryManifest(verified.capability);
      return (
        !signal.aborted &&
        resolveVerifiedRepositoryRoot(verified.capability) === repositoryRoot &&
        fresh.status === "ready" &&
        fresh.identity === initial.identity
      );
    },
  };
}
