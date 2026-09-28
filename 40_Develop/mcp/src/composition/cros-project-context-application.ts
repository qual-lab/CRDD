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
import { randomBytes } from "node:crypto";

import {
  authenticateConnectionCredential,
  createCrosSession,
  createPortfolioProjection,
  resolveAuthorizedRepositories,
  resolveRepository,
  type ConnectionCredentialRegistry,
  type CrosExposureSnapshot,
  type CrosRepository,
} from "../../../cros/src/index.ts";
import type {
  ProjectOperationRecordKind,
  TopicMeetingApplication,
  TopicMeetingRelation,
} from "../../../project-operation/src/index.ts";

import { handleMcpApplicationRequest } from "../adapters/application-adapter.ts";
import type { McpAuthenticatedRequestHandlerResolver } from "../transports/request-handler.ts";

/**
 * CROS許可済みProject ContextのMCP Compositionで使用するAuthorizedTopicMeetingApplicationの構造を固定する。
 *
 * @responsibility CROS許可済みProject ContextのMCP Compositionが受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000005
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type AuthorizedTopicMeetingApplication = Readonly<{
  repository: CrosRepository;
  application: TopicMeetingApplication;
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
  source: AuthorizedTopicMeetingApplication,
  authorizedApplications: readonly AuthorizedTopicMeetingApplication[],
): TopicMeetingApplication {
  return Object.freeze({
    ...source.application,
    relations: (
      kind: ProjectOperationRecordKind,
      id: string,
    ): readonly TopicMeetingRelation[] =>
      Object.freeze(
        source.application.relations(kind, id).map((relation) => {
          const owners = authorizedApplications.filter((candidate) =>
            candidate.application.hasRelationTarget(relation.kind, relation.id),
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
      ),
  });
}

/**
 * CROS Project Context MCP Resolverを作成する。
 *
 * @responsibility 有効Credentialだけを、許可済みPortfolioへ固定したMCP Handlerへ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Credential RegistryとExposure Snapshot Readerを受け取る。
 * @returns Request単位の認証済みHandler Resolverを返す。
 * @precondition Snapshot ReaderはExposureとRepositoryを同じ観測単位で返す。
 * @postcondition 認証成功時のHandlerは許可済みProject Context Toolだけを公開する。
 * @effect RegistryとSnapshotを一回ずつ読取る。
 * @failure 無効・失効Credentialはnullで非開示拒否する。
 * @invariant systemAdminだけからContent Accessを生成しない。
 * @boundary Bearer Credential→Workspace Grant→Portfolio→MCP。
 * @security TokenをSession、Portfolio、応答またはErrorへ含めない。
 * @concurrency Request間でSessionまたはPortfolioを共有しない。
 */
export function createCrosProjectContextMcpResolver(input: {
  registry: ConnectionCredentialRegistry;
  readExposureSnapshot(): CrosExposureSnapshot;
  resolveTopicMeetingApplication?(
    repository: CrosRepository,
  ): TopicMeetingApplication | null;
}): McpAuthenticatedRequestHandlerResolver {
  return (token) => {
    const authentication = authenticateConnectionCredential(
      input.registry,
      token,
    );
    if (authentication.status !== "available") return null;
    const snapshot = input.readExposureSnapshot();
    if (!snapshot.revision)
      throw new Error("cros_exposure_snapshot_revision_invalid");
    const session = createCrosSession(
      randomBytes(16).toString("hex"),
      {
        credentialId: authentication.access.credentialId,
        workspaceIds: authentication.access.workspaceIds,
        systemAdmin: authentication.access.systemAdmin,
        revoked: false,
      },
      snapshot.revision,
    );
    if (session === null) return null;
    const portfolio = createPortfolioProjection(
      resolveAuthorizedRepositories(
        session,
        snapshot.exposures,
        snapshot.repositories,
      ),
    );
    const authorizedRepositories = resolveAuthorizedRepositories(
      session,
      snapshot.exposures,
      snapshot.repositories,
    );
    const authorizedTopicMeetingApplications =
      input.resolveTopicMeetingApplication === undefined
        ? Object.freeze([])
        : Object.freeze(
            authorizedRepositories.flatMap((repository) => {
              const application =
                input.resolveTopicMeetingApplication?.(repository);
              return application === null || application === undefined
                ? []
                : [Object.freeze({ repository, application })];
            }),
          );
    return (request, signal) =>
      handleMcpApplicationRequest(
        request,
        {
          projectContext: { readPortfolio: async () => portfolio },
          ...(input.resolveTopicMeetingApplication === undefined
            ? {}
            : {
                topicMeetingRepositoryResolver: (repositoryId: string) => {
                  const resolved = resolveRepository(
                    session,
                    repositoryId,
                    snapshot.exposures,
                    snapshot.repositories,
                  );
                  if (resolved.status !== "available") return null;
                  const source = authorizedTopicMeetingApplications.find(
                    (candidate) =>
                      candidate.repository.repositoryId === repositoryId,
                  );
                  if (source === undefined) return null;
                  return federateTopicMeetingRelations(
                    source,
                    authorizedTopicMeetingApplications.filter(
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
