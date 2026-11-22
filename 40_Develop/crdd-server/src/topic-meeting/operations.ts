/**
 * 現在許可されたTopic／MeetingのDomain操作を構成する。
 * @packageDocumentation
 * @responsibility HTTPとMCPへ同じ要求内の対象とRelation集合を渡す。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 検査済みAM集合→Version Control Root→既存文書操作。
 */
import type { AuthorizedRepository } from "../../../access-management/src/index.ts";
import {
  createTopicOperations,
  createMeetingOperations,
  federateTopicMeetingRelations,
  type TopicMeetingAccess,
} from "../../../document-model/src/index.ts";
import { resolveVerifiedRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * 今回の許可集合から指定先のTopic／Meeting操作を構成する。
 * @responsibility Relationと保存Ownerを同じ認可集合へ結合する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 今回AM確認済み集合、明示ID、所有Signal、既存入口の固定拒否理由。
 * @returns 指定先のDomain操作またはnull。
 * @precondition 各入口が現在の許可集合を得て、用途固有の最終確認を行う。
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
  unavailableReason:
    | "workbench_local_records_unavailable"
    | "topic_meeting_access_unavailable",
): TopicMeetingAccess | null {
  const selected = repositories.find(
    (entry) => entry.repositoryId === repositoryId,
  );
  if (!selected) return null;
  const sources = repositories
    .filter((entry) => entry.manifest.projectId === selected.manifest.projectId)
    .map((entry) => {
      if (signal.aborted) throw new Error(unavailableReason);
      const root = resolveVerifiedRepositoryRoot(entry.root);
      if (root === null) throw new Error(unavailableReason);
      return {
        repositoryId: entry.repositoryId,
        projectId: entry.manifest.projectId,
        application: {
          topic: createTopicOperations(root, entry.manifest.projectId),
          meeting: createMeetingOperations(root, entry.manifest.projectId),
        },
      };
    });
  if (signal.aborted) throw new Error(unavailableReason);
  return federateTopicMeetingRelations(repositoryId, sources);
}
