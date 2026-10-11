/**
 * 現在のAccess ManagementからProject Context専用MCPを構成する。
 * @packageDocumentation
 * @responsibility 要求内認証・内容認可・実本文読取りを既存Ownerへ委譲する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 通常認証→現在許可集合→Domain本文→MCP応答。
 * @security Bearerは要求専用closure内だけに保持し、永続化・共有・応答・Errorへ渡さない。
 */
import {
  authenticateNormalConnection,
  resolveRepositoryAccessCollection,
} from "../../../access-management/src/index.ts";
import {
  createPortfolioProjection,
  readRepositoryProjectContext,
  type FilesystemStoreRoot,
  type ProjectContextSource,
} from "../../../domain-model/src/index.ts";
import { routeMcpRequest } from "../request/route.ts";
import type { McpAuthenticatedRequestHandlerResolver } from "../transport/types.ts";

/**
 * 初回完了後の現在資格から要求専用の読取りHandlerを作る。
 * @responsibility 管理能力から内容を生成せず、公開Callで現在集合を取り直す。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 内部構成が検証した用途限定の管理Root。
 * @returns 通常認証成功時の要求専用Handler、拒否時はnullを返すResolver。
 * @precondition HTTP Transportは要求毎にResolverを呼び、Handlerを要求終了後に共有しない。
 * @postcondition 許可対象の本文が全て取得できた場合だけPortfolioを公開する。
 * @effect 既存AM認証とLock、許可後の固定本文読取り。新StoreやSessionは作らない。
 * @failure 認証不成立はnull、内容認可・本文取得不成立は既存の固定MCPエラー。
 * @invariant 空認可だけ正常空集合。本文不明をnull／missingや部分成功にしない。
 * @boundary AM内部RootからProject Context専用のMCP構成へ渡す。
 * @security Bearerを要求closureにだけ保持し、Root・Path・Binding・管理改訂を返さない。文字列消去は保証しない。
 * @concurrency 各HTTP要求が再認証・再認可する。同期Reader開始後は終了を待って取消結果の公開を止める。
 */
export function createAccessProjectContextMcpResolver(
  root: FilesystemStoreRoot,
): McpAuthenticatedRequestHandlerResolver {
  return (token) => {
    if (authenticateNormalConnection(root, token).status !== "completed")
      return null;
    return (request, signal) =>
      routeMcpRequest(
        request,
        {
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
