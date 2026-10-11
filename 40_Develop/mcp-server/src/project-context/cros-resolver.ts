/**
 * CROS Connection CredentialをProject Context MCPへ接続する。
 *
 * @packageDocumentation
 * @responsibility RequestごとのCredential検証、Workspace解決およびMCP Handler生成を一つのComposition Rootへ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary CROS Request Access ContextとMCP Applicationの合成境界。
 * @effect Credential RegistryとExposure Snapshotを読取るが正本を変更しない。
 * @concurrency Requestごとに現在Credentialと一つのExposure Snapshotを使用する。
 * @security Grant外Repositoryの存在をHandlerへ渡さず、生Tokenを保持しない。
 */
import {
  authenticateConnectionCredential,
  readCrosRuntimeActivity,
  resolveCrosAiProfileAdministration,
  resolveCrosRequestScope,
  resolveRepository,
  type ConnectionCredentialRegistry,
  type CrosExposureSnapshot,
  type CrosRepository,
  type CrosRuntimeActivityReader,
} from "../../../cros/src/index.ts";
import {
  createPortfolioProjection,
  federateTopicMeetingRelations,
  type TopicMeetingAccess,
} from "../../../domain-model/src/index.ts";

import { routeMcpRequest } from "../request/route.ts";
import type { AiProfileCatalogAdministration } from "../../../ai-adapter/src/index.ts";
import type { McpAuthenticatedRequestHandlerResolver } from "../transport/types.ts";

/**
 * CROS Project Context MCP Resolverを作成する。
 *
 * @responsibility 現在CredentialからContent遅延解決と構成済みProfile管理を権限別Handlerへ接続する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Credential Registry、Content Snapshot Readerおよび構成済み活動・Profile管理を受け取る。
 * @returns Request単位の認証済みHandler Resolverを返す。
 * @precondition Snapshot ReaderはExposureとRepositoryを同じ観測単位で返す。
 * @postcondition Handlerは許可Content操作と管理権限で選択したProfile管理だけを公開する。
 * @effect Registryを一回読み、Content操作時だけExposure Snapshotを一回読む。管理操作は既存Catalog Ownerへ委譲する。
 * @failure 無効・失効Credentialはnullで非開示拒否する。
 * @invariant systemAdminだけからContent Accessを生成しない。
 * @boundary Bearer Credential→Content Grantまたは管理権限→MCP。
 * @security TokenをSession、Portfolio、応答またはErrorへ含めない。
 * @concurrency Request間でSessionまたはPortfolioを共有しない。
 */
export function createCrosProjectContextMcpResolver(input: {
  registry: ConnectionCredentialRegistry;
  readExposureSnapshot(): CrosExposureSnapshot;
  runtimeActivityReader?: CrosRuntimeActivityReader;
  aiProfileAdministration?: AiProfileCatalogAdministration;
  resolveTopicMeetingAccess?(
    repository: CrosRepository,
  ): TopicMeetingAccess | null;
}): McpAuthenticatedRequestHandlerResolver {
  return (token) => {
    const authentication = authenticateConnectionCredential(
      input.registry,
      token,
    );
    if (authentication.status !== "available") return null;
    let scope: ReturnType<typeof resolveCrosRequestScope> | undefined;
    /**
     * Content操作が必要なときだけ現在Scopeを一回解決する。
     *
     * @responsibility Profile管理へContent観測を要求せず、Content操作には同一Snapshotを渡す。
     * @trace ARCH-000005
     * @trace ARCH-000013
     * @input N/A: 認証済みRequestの構成を使用する。
     * @returns 当該Requestの現在Scope。
     * @precondition Credential検証が完了している。
     * @postcondition Readerは一回だけ呼ばれる。
     * @effect 初回だけExposure Snapshotを読む。
     * @failure Scope解決不能は例外で内部故障へ搬送する。
     * @invariant 管理能力からContentを生成しない。
     * @boundary CROS認証とContent解決の境界。
     * @security 未許可RepositoryをConsumerへ渡さない。
     * @concurrency Request内だけで結果を保持する。
     */
    const contentScope = () => {
      if (scope === undefined)
        scope = resolveCrosRequestScope(authentication.access, () =>
          input.readExposureSnapshot(),
        );
      if (scope === null) throw new Error("cros_request_scope_unavailable");
      return scope;
    };
    const administration = resolveCrosAiProfileAdministration(
      authentication.access,
      input.aiProfileAdministration,
    );
    return (request, signal) =>
      routeMcpRequest(
        request,
        {
          projectContext: {
            readPortfolio: async () =>
              createPortfolioProjection(contentScope().projectContextSources),
          },
          ...(administration === null
            ? {}
            : { aiProfileAdministration: administration }),
          ...(input.runtimeActivityReader === undefined
            ? {}
            : {
                runtimeActivity: {
                  read: (query) =>
                    readCrosRuntimeActivity(
                      contentScope().authorizedRepositories,
                      query,
                      input.runtimeActivityReader,
                    ),
                },
              }),
          ...(input.resolveTopicMeetingAccess === undefined
            ? {}
            : {
                topicMeetingRepositoryResolver: (repositoryId: string) => {
                  const { snapshot, session, authorizedRepositories } =
                    contentScope();
                  const authorizedTopicMeetingAccess =
                    authorizedRepositories.flatMap((repository) => {
                      const application =
                        input.resolveTopicMeetingAccess?.(repository);
                      return application == null
                        ? []
                        : [Object.freeze({ repository, application })];
                    });
                  const resolved = resolveRepository(
                    session,
                    repositoryId,
                    snapshot.exposures,
                    snapshot.repositories,
                  );
                  if (resolved.status !== "available") return null;
                  const source = authorizedTopicMeetingAccess.find(
                    (candidate) =>
                      candidate.repository.repositoryId === repositoryId,
                  );
                  if (source === undefined) return null;
                  return federateTopicMeetingRelations(
                    repositoryId,
                    authorizedTopicMeetingAccess
                      .filter(
                        (candidate) =>
                          candidate.repository.projectId ===
                          source.repository.projectId,
                      )
                      .map((candidate) => ({
                        repositoryId: candidate.repository.repositoryId,
                        projectId: candidate.repository.projectId,
                        application: candidate.application,
                      })),
                  );
                },
              }),
        },
        signal,
      );
  };
}
