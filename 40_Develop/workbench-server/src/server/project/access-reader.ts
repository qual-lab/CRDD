/**
 * Local CROSの現在許可集合からPortfolioを直接読む。
 * @responsibility Host管理状態と内容Rootを分離し、MCP通信を介さず既存Ownerへ接続する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
import {
  resolveRepositoryAccessCollection,
  type AuthorizedRepository,
} from "../../../../access-management/src/index.ts";
import {
  createPortfolioProjection,
  readRepositoryProjectContext,
  type ProjectContextSource,
  type PortfolioProjection,
} from "../../../../domain-model/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";

/**
 * 今回の明示Repository IDを現在許可集合へ結合する。
 * @responsibility 起動Repositoryや前要求のRootへfallbackしない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Host管理Context、明示Repository ID、要求専用Signal。
 * @returns 今回だけの許可対象、非許可／未登録は同じnull。
 * @precondition 利用側は返却Rootを公開・永続化・次要求へ再利用しない。
 * @postcondition 管理Roleから内容対象を生成せず、空IDを暗黙選択へ変換しない。
 * @effect 現在AM認可と許可対象の実Root／manifest観測。
 * @failure 取消・集合観測不明は固定例外。
 * @invariant 技術Rootは後続要求の認可証明ではない。
 * @boundary Workbench要求のRepository選択とAM現在内容範囲。
 * @security 拒否で対象存在・Host Root・資格を開示しない。
 * @concurrency 各呼出しで現在Role・Exposure・Bindingを取り直す。
 */
export function resolveAccessRepository(
  context: CredentialAdministration,
  repositoryId: string,
  signal: AbortSignal,
): AuthorizedRepository | null {
  if (signal.aborted) throw new Error("workbench_local_repository_unavailable");
  if (
    typeof repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId)
  )
    return null;
  const collection = resolveRepositoryAccessCollection(
    context.root,
    context.token,
  );
  if (collection.status !== "completed" || signal.aborted)
    throw new Error("workbench_local_repository_unavailable");
  return (
    collection.repositories.find(
      (repository) => repository.repositoryId === repositoryId,
    ) ?? null
  );
}

/**
 * 今回の認可済みRepository本文だけをPortfolioへ投影する。
 * @responsibility 管理権限から内容を生成せず、認可不明の全体停止と文書未確認の部分表示を分ける。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Host管理Rootと資格の要求Context、所有AbortSignal。
 * @returns 認可済みSourceの完全・未確認・競合を保持した読取り専用Portfolio。
 * @precondition 呼出し元がLocal CROS modeと資格入力を確認している。
 * @postcondition 許可集合が空の場合だけ正常空Portfolioを返す。
 * @effect 現在AM認可と登録実体、許可後のDomain本文を同期読取りする。
 * @failure 取消・認証・集合・Rootの不明は固定例外。文書不成立はSource単位の未確認・競合。
 * @invariant 集合やRootを次要求の認可証明としてcacheしない。
 * @boundary AM現在許可集合→Domain固定本文／Portfolio→Workbench。
 * @security 資格・Host Root・Binding・管理改訂を結果へ含めない。
 * @concurrency 各呼出しで現在認可し、同期読取り中の強制中断を保証しない。
 */
export function readAccessPortfolio(
  context: CredentialAdministration,
  signal: AbortSignal,
): PortfolioProjection {
  if (signal.aborted) throw new Error("workbench_local_portfolio_unavailable");
  const collection = resolveRepositoryAccessCollection(
    context.root,
    context.token,
  );
  if (collection.status !== "completed")
    throw new Error("workbench_local_portfolio_unavailable");
  return readAuthorizedPortfolio(collection.repositories, signal);
}

/**
 * 今回の許可集合から読取り状態を保持してPortfolioを投影する。
 * @responsibility 同じ要求の認可済み集合を変えず、Domain本文だけを読む。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 今回AMが確認したRepository集合と所有Signal。
 * @returns 認可済みの読めた本文と未確認・競合SourceのPortfolio。
 * @precondition 利用側は公開直前に同じ全集合の現在一致を確認する。
 * @postcondition 非complete Sourceに本文・Role・推測版を付けず、全体completeにしない。
 * @effect 許可済みRootの固定Context本文を読む。
 * @failure 取消・Root不成立は固定例外。文書取得・解析不能と識別情報競合は区別して保持する。
 * @invariant この投影は後続要求の認可証明ではない。
 * @boundary 今回のAM集合とDomain本文投影。
 * @security Root・Binding・資格を公開しない。
 * @concurrency AMを再取得せず同じ短命集合を使う。
 */
export function readAuthorizedPortfolio(
  repositories: readonly AuthorizedRepository[],
  signal: AbortSignal,
): PortfolioProjection {
  const sources: ProjectContextSource[] = [];
  for (const repository of repositories) {
    if (signal.aborted)
      throw new Error("workbench_local_portfolio_unavailable");
    const read = readRepositoryProjectContext(
      repository.root,
      repository.manifest,
    );
    if (read.status === "blocked")
      throw new Error("workbench_local_portfolio_unavailable");
    sources.push(
      read.status === "completed"
        ? {
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            state: "complete",
            revision: read.revision,
            context: read.context,
          }
        : {
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            state:
              read.status === "conflicting" ? "conflicting" : "unavailable",
            revision: null,
            context: null,
          },
    );
  }
  if (signal.aborted) throw new Error("workbench_local_portfolio_unavailable");
  return createPortfolioProjection(sources);
}
