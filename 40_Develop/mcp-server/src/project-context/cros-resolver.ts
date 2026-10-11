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
import { createPortfolioProjection } from "../../../domain-model/src/index.ts";
import type {
  ProjectOperationRecordKind,
  TopicMeetingAccess,
  TopicMeetingRelation,
} from "../../../domain-model/src/index.ts";

import { routeMcpRequest } from "../request/route.ts";
import type { AiProfileCatalogAdministration } from "../../../ai-adapter/src/index.ts";
import type { McpAuthenticatedRequestHandlerResolver } from "../transport/types.ts";

/**
 * CROS許可済みProject ContextのMCP Compositionで使用するAuthorizedTopicMeetingAccessの構造を固定する。
 *
 * @responsibility CROS許可済みProject ContextのMCP Compositionが受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000005
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type AuthorizedTopicMeetingAccess = Readonly<{
  repository: CrosRepository;
  application: TopicMeetingAccess;
}>;

/**
 * 一つのOwner Repository Applicationへ、許可済みProject内Relation解決を合成する。
 *
 * @responsibility Source本文を複製せず、Relation対象を現在Principalが参照できるOwner Repositoryへ解決する。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000013
 * @input sourceに操作対象、authorizedに同じProjectの許可済みApplication集合を受け取る。
 * @returns 書込みはSourceへ限定し、Relation読取りだけをFederationしたApplicationを返す。
 * @precondition authorizedは同じSession、Exposure SnapshotおよびLogical Projectから構築済みである。
 * @postcondition Relationは一意なOwner Repository、競合または非観測を区別する。
 * @effect Relation解決は読取りだけを行い、書込みOperationはSource Applicationへ一回だけ委譲する。
 * @failure 0件をunavailable、複数件をconflictingとして返し、非許可Repositoryの存在を示さない。
 * @invariant Owner Artifact本文、Identityまたは書込みAuthorityを別Repositoryへ複製しない。
 * @boundary CROS Authorized Repository集合とProject Operation Relation Navigationの境界。
 * @security 現在Sessionで解決済みのRepositoryだけを探索し、Grant外Repositoryを入力にも結果にも含めない。
 * @concurrency 一Requestで固定したApplication集合だけを使用する。
 */
function federateTopicMeetingRelations(
  source: AuthorizedTopicMeetingAccess,
  authorizedAccess: readonly AuthorizedTopicMeetingAccess[],
): TopicMeetingAccess {
  /**
   * 認可済み集合だけで固定種別のRelationを解決する。
   *
   * @responsibility 既存の一意・非観測・競合判定を両公開面へ同じ規則で適用する。
   * @trace ARCH-000013
   * @input kind: 固定種別、id: Source成果物ID。
   * @returns 許可済みOwnerだけを参照するRelation集合。
   * @precondition Application集合は同じRequestの認可済みSnapshotである。
   * @postcondition 非許可Repositoryを結果へ含めない。
   * @effect Relation対象の存在を読取るだけで書込みを発行しない。
   * @failure 所有者不存在はunavailable、複数はconflictingとして保持する。
   * @invariant Source本文と書込み先を変更しない。
   * @boundary CROS認可集合とDomain Model読取り境界。
   * @security 許可集合外の対象を探索しない。
   * @concurrency 同じRequest固定集合だけを利用する。
   */
  const relations = (
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[] =>
    Object.freeze(
      source.application[kind].relations(id).map((relation) => {
        const owners = authorizedAccess.filter((candidate) =>
          candidate.application[kind].hasRelationTarget(
            relation.kind,
            relation.id,
          ),
        );
        if (owners.length === 1)
          return Object.freeze({
            ...relation,
            state: "available" as const,
            ownerRepositoryId: owners[0]?.repository.repositoryId ?? "",
          });
        return Object.freeze({
          ...relation,
          state:
            owners.length === 0
              ? ("unavailable" as const)
              : ("conflicting" as const),
        });
      }),
    );
  return Object.freeze({
    topic: Object.freeze({
      ...source.application.topic,
      relations: (id: string) => relations("topic", id),
    }),
    meeting: Object.freeze({
      ...source.application.meeting,
      relations: (id: string) => relations("meeting", id),
    }),
  });
}

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
                    source,
                    authorizedTopicMeetingAccess.filter(
                      (candidate) =>
                        candidate.repository.projectId ===
                        source.repository.projectId,
                    ),
                  );
                },
              }),
        },
        signal,
      );
  };
}
