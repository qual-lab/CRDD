/**
 * Meetingの保存操作を生成する公開入口実装。
 *
 * @responsibility 共通CRUD実体へ固定種別で接続し、Meeting Outcome処置だけを専用操作として公開する。
 * @trace ARCH-000006
 */
import { createTopicMeetingApplication } from "../storage/topic-meeting-application.ts";
import { createTopicMeetingRepository } from "../storage/topic-meeting-repository.ts";
import type { MeetingApplication } from "./types.ts";
import type { TopicMeetingRepository } from "../storage/types.ts";

/**
 * 同じRepositoryに対するMeeting専用の操作集合を生成する。
 *
 * @responsibility 種別の選択を生成時に固定し、共通処理の複製なしでMeetingの操作を公開する。
 * @trace ARCH-000006
 * @input repositoryRoot: 選定済みRoot、または同じRepositoryに限定した保存契約。
 * @returns Meetingの一覧・CRUD・RelationとMeeting Outcome処置の操作集合。
 * @precondition 対象Repositoryの選定・認可は利用側が確認済みである。
 * @postcondition 操作対象種別はmeetingに固定され、反対種別の専用操作は存在しない。
 * @effect 生成時は既存Rootを確認し、書込みは個別CRUD呼出し時だけ発行する。
 * @failure Root不正は生成時に拒否し、操作時の競合・不正入力は共通実体の結果を保持する。
 * @invariant 改訂確認、Relation評価、削除確認およびFilesystem Effect件数を変更しない。
 * @boundary Meeting公開面とDomain Model共通保存実装の境界。
 * @security 外部Repositoryへの権限を生成せず、公開結果へRootやPathを露出しない。
 * @concurrency 共通Repository実装の改訂照合と保存排他に従う。
 */
export function createMeetingApplication(
  repositoryRoot: string | TopicMeetingRepository,
): MeetingApplication {
  const application = createTopicMeetingApplication(
    typeof repositoryRoot === "string"
      ? createTopicMeetingRepository(repositoryRoot)
      : repositoryRoot,
  );
  const scoped: MeetingApplication = {
    list: (input) => application.list({ ...input, kind: "meeting" }),
    get: (id) => application.get("meeting", id),
    getDocument: (id) => application.getDocument("meeting", id),
    relations: (id) => application.relations("meeting", id),
    hasRelationTarget: application.hasRelationTarget,
    create: (markdown) => application.create("meeting", markdown),
    update: (input) => application.update({ ...input, kind: "meeting" }),
    inspectDeletion: (id) => application.inspectDeletion("meeting", id),
    delete: (input) => application.delete({ ...input, kind: "meeting" }),
    treatMeetingOutcome: application.treatMeetingOutcome,
  };
  return Object.freeze(scoped);
}
