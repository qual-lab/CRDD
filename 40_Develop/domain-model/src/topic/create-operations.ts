/**
 * Topicの保存操作を生成する公開入口実装。
 *
 * @responsibility 共通CRUD実体へ固定種別で接続し、Topic昇格だけを専用操作として公開する。
 * @trace ARCH-000006
 */
import { createTopicMeetingOperations } from "../activity/operations.ts";
import { createTopicMeetingRepository } from "../storage/topic-meeting-store.ts";
import type { TopicOperations } from "./types.ts";
import type { TopicMeetingRepository } from "../activity/types.ts";

/**
 * 同じRepositoryに対するTopic専用の操作集合を生成する。
 *
 * @responsibility 種別の選択を生成時に固定し、共通処理の複製なしでTopicの操作を公開する。
 * @trace ARCH-000006
 * @input repositoryRoot: 選定済みRoot、または同じRepositoryに限定した保存契約。
 * @returns Topicの一覧・CRUD・RelationとTopic昇格の操作集合。
 * @precondition 対象Repositoryの選定・認可は利用側が確認済みである。
 * @postcondition 操作対象種別はtopicに固定され、反対種別の専用操作は存在しない。
 * @effect 生成時は既存Rootを確認し、書込みは個別CRUD呼出し時だけ発行する。
 * @failure Root不正は生成時に拒否し、操作時の競合・不正入力は共通実体の結果を保持する。
 * @invariant 改訂確認、Relation評価、削除確認およびFilesystem Effect件数を変更しない。
 * @boundary Topic公開面とDomain Model共通保存実装の境界。
 * @security 外部Repositoryへの権限を生成せず、公開結果へRootやPathを露出しない。
 * @concurrency 共通Repository実装の改訂照合と保存排他に従う。
 */
export function createTopicOperations(
  repositoryRoot: string | TopicMeetingRepository,
): TopicOperations {
  const application = createTopicMeetingOperations(
    typeof repositoryRoot === "string"
      ? createTopicMeetingRepository(repositoryRoot)
      : repositoryRoot,
  );
  const scoped: TopicOperations = {
    list: (input) => application.list({ ...input, kind: "topic" }),
    get: (id) => application.get("topic", id),
    getDocument: (id) => application.getDocument("topic", id),
    relations: (id) => application.relations("topic", id),
    hasRelationTarget: application.hasRelationTarget,
    create: (markdown) => application.create("topic", markdown),
    update: (input) => application.update({ ...input, kind: "topic" }),
    inspectDeletion: (id) => application.inspectDeletion("topic", id),
    delete: (input) => application.delete({ ...input, kind: "topic" }),
    promoteTopic: application.promoteTopic,
  };
  return Object.freeze(scoped);
}
