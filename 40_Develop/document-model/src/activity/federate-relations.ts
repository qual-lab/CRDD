/**
 * 認可済み同Project集合内のTopic／Meeting Relationを解決する。
 * @responsibility 認可と通信から独立した所有者判定を提供する。
 * @trace ARCH-000006
 * @trace ARCH-000013
 */
import type {
  ProjectOperationRecordKind,
  TopicMeetingAccess,
  TopicMeetingRelation,
} from "./types.ts";

/**
 * 呼出し側が認可したRepositoryの操作と宣言Identityを搬送する。
 * @responsibility 秘密・Root・認可状態を含めずRelation判定の入力を固定する。
 * @trace ARCH-000006
 * @shape repositoryId、projectId、applicationの不変組。
 * @invariant 認可済みであることは呼出し側の保証であり、型自体は認可能力ではない。
 * @boundary 認可済み構成とDomain所有者判定の境界。
 * @security Credential・Binding・Filesystem Pathを含めない。
 * @compatibility 既存Topic／Meeting公開操作をそのまま使用する。
 */
export type TopicMeetingRelationSource = Readonly<{
  repositoryId: string;
  projectId: string;
  application: TopicMeetingAccess;
}>;

/**
 * 集合内のSourceへRelation読取りだけを合成する。
 * @responsibility 書込み先を変えず一意・非観測・競合を判定する。
 * @trace ARCH-000006
 * @trace ARCH-000013
 * @input sourceRepositoryIdと現在要求で認可済みの同Project集合。
 * @returns Source操作を保持しRelationだけ置き換えた公開操作。
 * @precondition 呼出し側が認可と集合選定を完了している。
 * @postcondition 一意OwnerだけrepositoryIdを返し、部分結果を返さない。
 * @effect Relation呼出しで既存公開読取りを行う。構成時はI/Oなし。
 * @failure Source不在・重複・異Projectは固定例外。読取り故障は利用側へ伝播する。
 * @invariant Sourceは集合から導出し、書込み先を差し替えない。
 * @boundary 認可済み集合からDomain Relation解決への境界。
 * @security 集合整合検査は認可証明ではない。集合外を探索しない。
 * @concurrency 要求専用の集合をSnapshot化し他要求へ共有しない。
 */
export function federateTopicMeetingRelations(
  sourceRepositoryId: string,
  authorizedAccess: readonly TopicMeetingRelationSource[],
): TopicMeetingAccess {
  const sources = authorizedAccess.map((source) =>
    Object.freeze({ ...source }),
  );
  const matches = sources.filter(
    (candidate) => candidate.repositoryId === sourceRepositoryId,
  );
  const source = matches[0];
  if (
    matches.length !== 1 ||
    source === undefined ||
    new Set(sources.map((candidate) => candidate.repositoryId)).size !==
      sources.length ||
    sources.some((candidate) => candidate.projectId !== source.projectId)
  )
    throw new Error("topic_meeting_relation_sources_invalid");

  /**
   * 同Projectの現在集合からRelation Ownerを判定する。
   * @responsibility 全Owner観測後に限定した結果fieldだけを返す。
   * @trace ARCH-000006
   * @input 固定種別とSource成果物ID。
   * @returns 一意Owner、非観測または競合のRelation配列。
   * @precondition 集合整合検査が完了している。
   * @postcondition Ownerは一意の場合だけ公開し、既存Owner値を流用しない。
   * @effect 各Sourceの既存読取りだけを呼ぶ。
   * @failure 読取り例外では配列を返さず部分成功にしない。
   * @invariant Relation順序・ID・種別を保持する。
   * @boundary Domain公開読取りと所有者投影の境界。
   * @security 非許可集合を探索しない。
   * @concurrency 同じ要求のSnapshotだけを使用する。
   */
  const relations = (
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[] =>
    Object.freeze(
      source.application[kind].relations(id).map((relation) => {
        const owners = sources.filter((candidate) =>
          candidate.application[kind].hasRelationTarget(
            relation.kind,
            relation.id,
          ),
        );
        const owner = owners.length === 1 ? owners[0] : undefined;
        if (owner !== undefined)
          return Object.freeze({
            id: relation.id,
            kind: relation.kind,
            state: "available" as const,
            ownerRepositoryId: owner.repositoryId,
          });
        return Object.freeze({
          id: relation.id,
          kind: relation.kind,
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
