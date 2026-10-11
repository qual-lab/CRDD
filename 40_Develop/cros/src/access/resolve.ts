/**
 * 認証済みRequestの参照範囲をTransportに依存せず解決する。
 *
 * @responsibility 同じ公開範囲SnapshotとSessionから許可Repository集合を一度だけ構成する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 */
import { randomBytes } from "node:crypto";

import type {
  ProjectContextSource,
  RepositoryProjectContext,
} from "../../../domain-model/src/index.ts";
import { resolveAuthorizedRepositories } from "./resolve-repositories.ts";
import type { RequestAccessContext } from "./credential.ts";
import { createCrosSession } from "./session-context.ts";
import type { CrosExposureSnapshot } from "./types.ts";

/**
 * 認証済みAccessから一Requestの参照範囲を解決する。
 *
 * @responsibility 公開範囲の一回観測、Session生成と許可集合の解決を共通Ownerへ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input accessは現在Requestで認証済みのAccess、readExposureSnapshotは公開範囲Reader。
 * @returns Snapshot、Session、許可Repository集合を返す。Session生成失敗だけnull。
 * @precondition 呼出し元は現在Credentialを検証済みであり、Request間でAccessを再利用しない。
 * @postcondition すべてのContent操作が同じSnapshotと許可集合を利用できる。
 * @effect Readerを一回呼び、Process内の不変Sessionを生成する。永続化しない。
 * @failure Reader例外と空改訂は例外、Session生成失敗はnullとして入口別の既存処置へ戻す。
 * @invariant 管理権限からContent Grantを生成せず、Snapshot改訂とCredential改訂を混同しない。
 * @boundary 認証済みAccessとRepository公開範囲の境界。
 * @security Tokenを受け取らず、内部SnapshotをそのままProtocol応答へ公開しない。
 * @concurrency 一Requestに一Sessionを生成し、Request間で共有しない。
 */
export function resolveCrosRequestScope(
  access: RequestAccessContext,
  readExposureSnapshot: () => CrosExposureSnapshot,
) {
  const snapshot = readExposureSnapshot();
  if (!snapshot.revision)
    throw new Error("cros_exposure_snapshot_revision_invalid");
  const session = createCrosSession(
    randomBytes(16).toString("hex"),
    {
      credentialId: access.credentialId,
      workspaceIds: access.workspaceIds,
      systemAdmin: access.systemAdmin,
      revoked: false,
    },
    snapshot.revision,
  );
  if (session === null) return null;
  const authorizedRepositories = resolveAuthorizedRepositories(
    session,
    snapshot.exposures,
    snapshot.repositories,
  );
  const projectContextSources: readonly ProjectContextSource[] = Object.freeze(
    authorizedRepositories.map((repository) =>
      Object.freeze({
        projectId: repository.projectId,
        repositoryId: repository.repositoryId,
        revision: repository.revision,
        context:
          (repository.content.projectContext as
            | RepositoryProjectContext
            | undefined) ?? null,
      }),
    ),
  );
  return Object.freeze({
    snapshot,
    session,
    authorizedRepositories,
    projectContextSources,
  });
}
