/**
 * Local CROSのTopic／Meeting操作を現在許可対象へ結合する。
 * @responsibility 起動Rootを使わず、同Projectの現在集合を既存Domain操作へ渡す。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
import {
  resolveRepositoryAccessCollection,
  type AuthorizedRepository,
} from "../../../access-management/src/index.ts";
import {
  createTopicOperations,
  createMeetingOperations,
  federateTopicMeetingRelations,
  type TopicMeetingAccess,
} from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import type { CredentialAdministration } from "../credential/administration.ts";

/**
 * 明示対象の操作と同ProjectのRelation集合を要求ごとに構成する。
 * @responsibility 内容の現在認可とDomainの所有者判定を分離する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Host管理Context、明示Repository ID、要求専用Signal。
 * @returns 当該要求だけのDomain操作、非許可／未登録はnull。
 * @precondition 呼出し元は入力搬送完了後に呼び、返却操作を次要求へcacheしない。
 * @postcondition 書込み先は指定Repository、Relationは同Project許可集合だけ。
 * @effect AM現在集合とRoot観測。構成時の本文読取り・保存はない。
 * @failure 取消・集合／Root不明は固定例外で停止する。
 * @invariant 管理Roleや起動Repositoryから内容対象を生成しない。
 * @boundary AM現在認可→Domain操作とRelation構成→Workbench。
 * @security Root・資格・Bindingを外部結果へ返さない。
 * @concurrency 保存開始後の取消からrollbackを主張しない。
 */
export function resolveAccessTopicMeeting(
  context: CredentialAdministration,
  repositoryId: string,
  signal: AbortSignal,
): TopicMeetingAccess | null {
  if (signal.aborted) throw new Error("workbench_local_records_unavailable");
  if (
    typeof repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId)
  )
    return null;
  const collection = resolveRepositoryAccessCollection(
    context.root,
    context.token,
  );
  if (collection.status !== "completed")
    throw new Error("workbench_local_records_unavailable");
  return composeAuthorizedTopicMeeting(
    collection.repositories,
    repositoryId,
    signal,
  );
}

/**
 * 今回の許可集合から指定先のTopic／Meeting操作を構成する。
 * @responsibility Relationと保存Ownerを同じ認可集合へ結合する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 今回AM確認済み集合、明示ID、所有Signal。
 * @returns 指定先のDomain操作またはnull。
 * @precondition 利用側は公開直前の全許可集合一致を確認する。
 * @postcondition Relationは同Projectの今回許可対象だけ。
 * @effect 検証済みRootから既存Domain操作を構成する。
 * @failure 取消・Root不明は固定例外。
 * @invariant 操作構成を次要求の認可証明として保持しない。
 * @boundary 今回のAM集合と既存Domain操作。
 * @security Root・資格を公開結果へ渡さない。
 * @concurrency AMを再取得せず同じ短命集合を使う。
 */
export function composeAuthorizedTopicMeeting(
  repositories: readonly AuthorizedRepository[],
  repositoryId: string,
  signal: AbortSignal,
): TopicMeetingAccess | null {
  const selected = repositories.find(
    (entry) => entry.repositoryId === repositoryId,
  );
  if (!selected) return null;
  const sources = repositories
    .filter((entry) => entry.manifest.projectId === selected.manifest.projectId)
    .map((entry) => {
      if (signal.aborted)
        throw new Error("workbench_local_records_unavailable");
      const root = resolveVerifiedRepositoryRoot(entry.root);
      if (root === null) throw new Error("workbench_local_records_unavailable");
      return {
        repositoryId: entry.repositoryId,
        projectId: entry.manifest.projectId,
        application: {
          topic: createTopicOperations(root, entry.manifest.projectId),
          meeting: createMeetingOperations(root, entry.manifest.projectId),
        },
      };
    });
  if (signal.aborted) throw new Error("workbench_local_records_unavailable");
  return federateTopicMeetingRelations(repositoryId, sources);
}
