/**
 * 現在のAccess Managementから内容操作のMCPを構成する。
 * @packageDocumentation
 * @responsibility 要求内認証・内容認可・実本文読取りを既存Ownerへ委譲する。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 通常認証→現在許可集合→Domain本文→MCP応答。
 * @security Bearerは要求専用closure内だけに保持し、永続化・共有・応答・Errorへ渡さない。
 */
import {
  authenticateNormalConnection,
  resolveAiProfileManagementAccess,
  resolveRepositoryAccessCollection,
} from "../../../access-management/src/index.ts";
import type { AiProfileCatalogAdministration } from "../../../ai-adapter/src/index.ts";
import {
  createPortfolioProjection,
  createTopicOperations,
  createMeetingOperations,
  federateTopicMeetingRelations,
  readRepositoryProjectContext,
  type FilesystemStoreRoot,
  type ProjectContextSource,
} from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import { readAuthorizedRuntimeActivity } from "../../../orchestrator/src/index.ts";
import { routeMcpRequest } from "./route.ts";
import type { McpAuthenticatedRequestHandlerResolver } from "../transport/types.ts";

/**
 * 初回完了後の現在資格から要求専用の内容Handlerを作る。
 * @responsibility 管理能力から内容を生成せず、公開Callで現在集合を取り直す。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 内部構成が検証した管理Rootと任意のCROS Owner Profile管理操作。
 * @returns 通常認証成功時の要求専用Handler、拒否時はnullを返すResolver。
 * @precondition HTTP Transportは要求毎にResolverを呼び、Handlerを要求終了後に共有しない。
 * @postcondition Portfolioは全本文成功時だけ、Topic／Meetingは現在許可対象だけを操作する。
 * @effect 既存AM認証とLock、許可後のDomain読取りと明示CRUD。新StoreやSessionは作らない。
 * @failure 認証不成立はnull、内容認可・本文取得不成立は既存の固定MCPエラー。
 * @invariant 空認可だけ正常空集合。本文不明をnull／missingや部分成功にしない。
 * @boundary AM内部RootからProject ContextとTopic／MeetingのMCP構成へ渡す。
 * @security Bearerを要求closureにだけ保持し、Root・Path・Binding・管理改訂を返さない。文字列消去は保証しない。
 * @concurrency 各HTTP要求が再認証・再認可する。同期Reader開始後は終了を待って取消結果の公開を止める。
 */
export function createAccessMcpResolver(
  root: FilesystemStoreRoot,
  profileAdministration?: AiProfileCatalogAdministration,
): McpAuthenticatedRequestHandlerResolver {
  return (token) => {
    if (authenticateNormalConnection(root, token).status !== "completed")
      return null;
    return (request, signal) =>
      routeMcpRequest(
        request,
        {
          ...(profileAdministration === undefined
            ? {}
            : {
                /**
                 * 現在Profile管理許可に限り既存Catalog操作を結合する。
                 * @responsibility AM判定とCatalog保存Ownerを分離し、認可不明を非公開エラーへ閉じる。
                 * @trace ARCH-000010
                 * @trace ARCH-000013
                 * @input N/A: 当該要求のRootとBearerをclosureで保持する。
                 * @returns 現在許可時だけ注入済み操作、developer拒否はnull。
                 * @precondition MCPが完全入力検査と開始前取消を確認済み。
                 * @postcondition AM Lock解放後だけ操作を返し、Catalogを読まない。
                 * @effect 既存AM現在認証だけ。Catalog操作は後続Adapterが所有する。
                 * @failure 認証・初回・状態不明は固定例外で停止する。
                 * @invariant 旧systemAdmin・内容Grantへfallbackしない。
                 * @boundary AM現在認可→AI Adapterの管理操作結合。
                 * @security Token・Role・Root・改訂・Store存在を返さない。
                 * @concurrency 各一覧／Callで再観測し、Catalog中にAM Lockを保持しない。
                 */
                aiProfileAdministrationResolver: () => {
                  const access = resolveAiProfileManagementAccess(root, token);
                  if (access === "unavailable")
                    throw new Error("profile_management_unavailable");
                  return access === "allowed" ? profileAdministration : null;
                },
              }),
          runtimeActivity: {
            /**
             * 現在許可された同Projectの実保存活動を読む。
             * @responsibility 各Callの現在認可を活動Ownerへ最小入力で接続する。
             * @trace ARCH-000005
             * @trace ARCH-000012
             * @trace ARCH-000013
             * @input Projectとページ要求。
             * @returns 同Projectの観測、許可対象がない場合だけnull。
             * @precondition 入力検査と開始前取消確認が完了している。
             * @postcondition 許可対象全件を渡し、部分集合へ後退しない。
             * @effect 現在認可、Root観測、実保存読取り。書込みは行わない。
             * @failure 集合・Root不明は固定例外、Owner故障はAdapterが非開示にする。
             * @invariant 各Callで再認可し、認証を観測型の正しさで代替しない。
             * @boundary AM現在集合からOrchestrator活動Owner。
             * @security Token・AM Binding・RoleをOwnerや応答へ渡さない。
             * @concurrency 開始したReaderを待ち、Adapterが取消後の公開を止める。
             */
            read: async (query) => {
              if (signal.aborted)
                throw new Error("runtime_activity_unavailable");
              const collection = resolveRepositoryAccessCollection(root, token);
              if (collection.status !== "completed")
                throw new Error("runtime_activity_unavailable");
              const selected = collection.repositories.filter(
                (repository) =>
                  repository.manifest.projectId === query.projectId,
              );
              if (selected.length === 0) return null;
              const repositories = selected.map((repository) => {
                if (signal.aborted)
                  throw new Error("runtime_activity_unavailable");
                const verifiedRoot = resolveVerifiedRepositoryRoot(
                  repository.root,
                );
                if (verifiedRoot === null)
                  throw new Error("runtime_activity_unavailable");
                return {
                  projectId: repository.manifest.projectId,
                  repositoryId: repository.repositoryId,
                  root: repository.root,
                };
              });
              if (signal.aborted)
                throw new Error("runtime_activity_unavailable");
              return readAuthorizedRuntimeActivity(
                { ...query, repositories },
                signal,
              );
            },
          },
          /**
           * 現在許可対象の操作と同ProjectのRelation集合を構成する。
           * @responsibility 未許可対象・異Project探索・部分集合への後退を防ぐ。
           * @trace ARCH-000006
           * @trace ARCH-000013
           * @input 完全Schema検査後の明示Repository ID。
           * @returns 指定対象のDomain操作、非許可時はnull。
           * @precondition 通常認証済みで、入力検査と開始前取消確認が完了している。
           * @postcondition 同Project全対象を検証し、書込み先は指定Repositoryだけに固定する。
           * @effect 現在AM集合とRootを観測し、Domain操作を構成する。構成時の保存はない。
           * @failure 集合・Root・構成不明は固定例外で全体停止する。
           * @invariant 各Tool Callで再認可し、他要求へ操作や集合を共有しない。
           * @boundary AM現在認可→Version Control Root→Domain操作／Relation。
           * @security Bearer、Root、Bindingを公開結果へ渡さない。
           * @concurrency 同期構成後に既存Adapterが取消を再確認する。保存開始後のrollbackは保証しない。
           */
          topicMeetingRepositoryResolver: (repositoryId) => {
            if (signal.aborted)
              throw new Error("topic_meeting_access_unavailable");
            const collection = resolveRepositoryAccessCollection(root, token);
            if (collection.status !== "completed")
              throw new Error("topic_meeting_access_unavailable");
            const selected = collection.repositories.find(
              (repository) => repository.repositoryId === repositoryId,
            );
            if (selected === undefined) return null;
            const sources = collection.repositories
              .filter(
                (repository) =>
                  repository.manifest.projectId === selected.manifest.projectId,
              )
              .map((repository) => {
                if (signal.aborted)
                  throw new Error("topic_meeting_access_unavailable");
                const repositoryRoot = resolveVerifiedRepositoryRoot(
                  repository.root,
                );
                if (repositoryRoot === null)
                  throw new Error("topic_meeting_access_unavailable");
                return {
                  repositoryId: repository.repositoryId,
                  projectId: repository.manifest.projectId,
                  application: {
                    topic: createTopicOperations(
                      repositoryRoot,
                      repository.manifest.projectId,
                    ),
                    meeting: createMeetingOperations(
                      repositoryRoot,
                      repository.manifest.projectId,
                    ),
                  },
                };
              });
            if (signal.aborted)
              throw new Error("topic_meeting_access_unavailable");
            return federateTopicMeetingRelations(repositoryId, sources);
          },
          projectContext: {
            /**
             * 内容Callの現在認可と実本文を一つのPortfolioへ閉じる。
             * @responsibility 非許可読取りと部分公開を防ぐ。
             * @trace ARCH-000005
             * @trace ARCH-000013
             * @input N/A: 当該要求のBearerと取消Signalだけを使用する。
             * @returns Domainが集約した非秘密Portfolio。
             * @precondition 通常Header認証が完了し、Tool入力は既存Adapterが検査済み。
             * @postcondition 全本文成功または認証済み空集合だけを返す。
             * @effect 現在許可集合の再取得と各固定本文の同期読取り。
             * @failure 取消・集合不明・本文不明は固定例外を既存Adapterで非開示エラーへ変換する。
             * @invariant SourceはProject・Repository・本文版・解析Contextの4項目だけ。
             * @boundary AM現在認可→Domain本文／集約→既存MCP Adapter。
             * @security Token・技術的Root・下位例外を結果へ透過しない。
             * @concurrency cacheせず呼出し毎に現在認可する。同期I/Oの中断保証はしない。
             */
            readPortfolio: async () => {
              if (signal.aborted)
                throw new Error("project_context_unavailable");
              const collection = resolveRepositoryAccessCollection(root, token);
              if (collection.status !== "completed")
                throw new Error("project_context_unavailable");
              const sources: ProjectContextSource[] = [];
              for (const repository of collection.repositories) {
                if (signal.aborted)
                  throw new Error("project_context_unavailable");
                const read = readRepositoryProjectContext(
                  repository.root,
                  repository.manifest,
                );
                if (read.status !== "completed")
                  throw new Error("project_context_unavailable");
                sources.push({
                  projectId: repository.manifest.projectId,
                  repositoryId: repository.repositoryId,
                  revision: read.revision,
                  context: read.context,
                });
              }
              if (signal.aborted)
                throw new Error("project_context_unavailable");
              return createPortfolioProjection(sources);
            },
          },
        },
        signal,
      );
  };
}
