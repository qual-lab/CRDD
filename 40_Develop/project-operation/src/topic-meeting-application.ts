/**
 * Topic／Meetingの共通Application契約。
 *
 * @packageDocumentation
 * @responsibility 一覧のCursor PaginationとCRUD Commandを、MCP／Workbenchに依存しない形で提供する。
 * @trace ARCH-000006
 * @boundary Project OperationのRepository Portと利用者入口Adapterの境界。
 * @effect 書込みCommandだけが注入されたRepository PortのEffectを発行する。
 * @security Repository RootやFilesystem Pathを公開結果へ含めない。
 */
import type {
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingRepository,
} from "./topic-meeting-repository.ts";
import {
  applyMeetingOutcomeTreatment,
  applyTopicPromotion,
  type MeetingOutcomeDisposition,
} from "./topic-meeting.ts";

/**
 * Meeting Outcomeの追跡先種別と参照を定義する。
 *
 * @responsibility Topic、CHG、責任主体および追跡不要を型で区別する。
 * @trace ARCH-000006
 * @shape kindと文字列referenceを持つ判別Union。
 * @invariant 処置状態との許可組合せはApplicationが検証する。
 * @boundary Workbench／MCP入力とProject Operation Applicationの境界。
 * @security 非開示Repositoryや別Projectの存在を補完しない。
 * @compatibility kind追加時は全入口とRelation検証を同時更新する。
 */
export type MeetingOutcomeTarget = Readonly<
  | { kind: "topic"; reference: string }
  | { kind: "change"; reference: string }
  | { kind: "owner"; reference: string }
  | { kind: "none"; reference: string }
>;

/**
 * Meeting Outcome処置の公開結果を定義する。
 *
 * @responsibility 完了とEffect 0拒否を理由、現在RecordおよびEffect件数と相関させる。
 * @trace ARCH-000006
 * @shape status、reason、record、filesystemEffectCountを持つ閉じた結果。
 * @invariant blocked結果のFilesystem Effect件数は0である。
 * @boundary Project Operation ApplicationとWorkbench／MCPの結果境界。
 * @security Filesystem Pathや非開示Relation内容を含めない。
 * @compatibility reason追加時は表示入口と契約試験を再評価する。
 */
export type MeetingOutcomeCommandResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "meeting_outcome_treated"
    | "record_not_found"
    | "record_revision_conflict"
    | "meeting_outcome_target_invalid"
    | "meeting_outcome_target_not_found"
    | "meeting_outcome_target_project_mismatch"
    | "meeting_outcome_invalid";
  record: ProjectOperationRecord | null;
  filesystemEffectCount: 0 | 1;
}>;

/**
 * Topic昇格接続の公開結果を定義する。
 *
 * @responsibility 完了とEffect 0拒否を理由、現在RecordおよびEffect件数と相関させる。
 * @trace ARCH-000006
 * @shape status、reason、record、filesystemEffectCountを持つ閉じた結果。
 * @invariant blocked結果のFilesystem Effect件数は0である。
 * @boundary Project Operation ApplicationとWorkbench／MCPの結果境界。
 * @security CHG本文やFilesystem Pathを含めない。
 * @compatibility reason追加時は全入口と契約試験を再評価する。
 */
export type TopicPromotionCommandResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "topic_promoted"
    | "record_not_found"
    | "record_revision_conflict"
    | "topic_promotion_target_not_found"
    | "topic_promotion_invalid";
  record: ProjectOperationRecord | null;
  filesystemEffectCount: 0 | 1;
}>;

export type TopicMeetingPage = Readonly<{
  status: "available" | "not_configured";
  records: readonly ProjectOperationRecord[];
  nextCursor: string | null;
}>;

/**
 * Topic／Meeting本文から解決した安定ID Relationを定義する。
 *
 * @responsibility Relationの識別子、種別および現在Repository内の解決状態を一つの値へ閉じる。
 * @trace ARCH-000006
 * @shape id、kind、stateを持つ不変値。
 * @invariant availableは同じRepository内のCanonical RecordまたはCHG正本が現在存在する場合だけである。
 * @boundary Project Operation Canonical MarkdownとWorkbench／MCP Navigationの型境界。
 * @security 任意Pathや非開示RepositoryをRelationへ変換しない。
 * @compatibility 新しいRelation種別はOwner正本と安全な解決契約が確定した後だけ追加する。
 */
export type TopicMeetingRelation = Readonly<{
  id: string;
  kind: "topic" | "meeting" | "change";
  state: "available" | "not_found" | "unavailable" | "conflicting";
  ownerRepositoryId?: string;
}>;

/**
 * Topic／Meeting一覧の検索・絞込み・並び順を定義する。
 *
 * @responsibility Collection UIとMCPが共有する検索、状態、Owner、Relation、期間、未処置およびSortの語彙を固定する。
 * @trace ARCH-000006
 * @shape 全Record共通条件とMeeting限定条件を表す。
 * @invariant 未指定条件を暗黙Filterへ変換しない。
 * @boundary Workbench／MCP入力とProject Operation Applicationの型境界。
 * @security Relationは安定IDだけを受け、任意Pathまたは正規表現を実行しない。
 * @compatibility 条件追加時はCursor署名と全Consumerを同時更新する。
 */
export type TopicMeetingListQuery = Readonly<{
  query?: string;
  states?: readonly string[];
  owner?: string;
  relation?: string;
  occurredFrom?: string;
  occurredTo?: string;
  pendingOnly?: boolean;
  sort?: "id_asc" | "title_asc" | "state_asc" | "occurred_desc";
}>;

export type TopicMeetingApplication = Readonly<{
  list(input: {
    kind: ProjectOperationRecordKind;
    cursor?: string;
    limit?: number;
    query?: TopicMeetingListQuery;
  }): TopicMeetingPage;
  get(
    kind: ProjectOperationRecordKind,
    id: string,
  ): ProjectOperationRecord | null;
  getDocument: TopicMeetingRepository["getDocument"];
  relations(
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[];
  hasRelationTarget(kind: TopicMeetingRelation["kind"], id: string): boolean;
  create(
    kind: ProjectOperationRecordKind,
    markdown: string,
  ): ReturnType<TopicMeetingRepository["create"]>;
  update(input: {
    kind: ProjectOperationRecordKind;
    id: string;
    expectedRevision: number;
    markdown: string;
  }): ReturnType<TopicMeetingRepository["update"]>;
  inspectDeletion(
    kind: ProjectOperationRecordKind,
    id: string,
  ): ReturnType<TopicMeetingRepository["inspectDeletion"]>;
  delete(
    input: Parameters<TopicMeetingRepository["delete"]>[0],
  ): ReturnType<TopicMeetingRepository["delete"]>;
  promoteTopic(input: {
    topicId: string;
    expectedRevision: number;
    changeId: string;
    reason: string;
    remainingResponsibility: string;
  }): TopicPromotionCommandResult;
  treatMeetingOutcome(input: {
    meetingId: string;
    expectedRevision: number;
    outcomeId: string;
    disposition: MeetingOutcomeDisposition;
    owner: string;
    reviewTrigger: string;
    target: MeetingOutcomeTarget;
    treatment: string;
    completionCondition: string;
    result: string;
    closeMeeting: boolean;
  }): MeetingOutcomeCommandResult;
}>;

function identity(record: ProjectOperationRecord): string {
  return "topicId" in record ? record.topicId : record.meetingId;
}

/**
 * 一覧条件を検証して安定した比較用Snapshotへ変換する。
 *
 * @responsibility 種別別の許可条件、文字数、状態、日付およびSortをEffect前に検証する。
 * @trace ARCH-000006
 * @input kindと未信頼Query候補を受け取る。
 * @returns Property順序を固定したTopicMeetingListQueryを返す。
 * @precondition kindはtopicまたはmeetingである。
 * @postcondition TopicへMeeting限定条件を残さず、文字列をtrimした不変値を返す。
 * @effect N/A: 入力値を検証・正規化するだけである。
 * @failure 不正条件はproject_operation_list_query_invalidで拒否する。
 * @invariant 空文字を有効Filterとして保持しない。
 * @boundary Consumer入力とProject Operation Collection Queryの境界。
 * @security 任意正規表現、Pathまたは式を受理しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function normalizeQuery(
  kind: ProjectOperationRecordKind,
  query: TopicMeetingListQuery | undefined,
): TopicMeetingListQuery {
  const text = query?.query?.trim();
  const owner = query?.owner?.trim();
  const relation = query?.relation?.trim();
  if (
    [text, owner, relation].some(
      (value) => value !== undefined && value.length > 128,
    ) ||
    (relation !== undefined &&
      !/^(?:TOPIC|MTG|CHG|REQ|UX|IA|UI|SPEC|ARCH|QA)-\d{6}$/u.test(relation))
  )
    throw new Error("project_operation_list_query_invalid");
  const allowedStates =
    kind === "topic"
      ? new Set(["open", "waiting", "promoted", "closed"])
      : new Set(["recorded", "closed", "corrected"]);
  const states = Object.freeze(
    [...new Set(query?.states ?? [])].sort((left, right) =>
      left.localeCompare(right),
    ),
  );
  if (!states.every((state) => allowedStates.has(state)))
    throw new Error("project_operation_list_query_invalid");
  const date = /^\d{4}-\d{2}-\d{2}$/u;
  if (
    kind === "topic" &&
    (query?.occurredFrom !== undefined ||
      query?.occurredTo !== undefined ||
      query?.pendingOnly !== undefined)
  )
    throw new Error("project_operation_list_query_invalid");
  if (
    (query?.occurredFrom !== undefined && !date.test(query.occurredFrom)) ||
    (query?.occurredTo !== undefined && !date.test(query.occurredTo)) ||
    (query?.occurredFrom !== undefined &&
      query.occurredTo !== undefined &&
      query.occurredFrom > query.occurredTo)
  )
    throw new Error("project_operation_list_query_invalid");
  const sort = query?.sort ?? (kind === "meeting" ? "occurred_desc" : "id_asc");
  const allowedSort =
    kind === "topic"
      ? ["id_asc", "title_asc", "state_asc"]
      : ["id_asc", "title_asc", "state_asc", "occurred_desc"];
  if (!allowedSort.includes(sort))
    throw new Error("project_operation_list_query_invalid");
  return Object.freeze({
    ...(text ? { query: text } : {}),
    ...(states.length > 0 ? { states } : {}),
    ...(owner ? { owner } : {}),
    ...(relation ? { relation } : {}),
    ...(query?.occurredFrom === undefined
      ? {}
      : { occurredFrom: query.occurredFrom }),
    ...(query?.occurredTo === undefined
      ? {}
      : { occurredTo: query.occurredTo }),
    ...(query?.pendingOnly === undefined
      ? {}
      : { pendingOnly: query.pendingOnly }),
    sort,
  });
}

/**
 * 一覧Recordが指定条件を満たすか判定する。
 *
 * @responsibility Record MetadataとCanonical Markdown Relationを同じ条件集合で絞り込む。
 * @trace ARCH-000006
 * @input kind、record、Canonical Markdownおよび正規化済みQueryを受け取る。
 * @returns 全条件を満たす場合trueを返す。
 * @precondition documentはrecordと同じIdentityの現在Revisionである。
 * @postcondition 未指定条件は判定へ影響しない。
 * @effect N/A: Snapshotを読むだけである。
 * @failure N/A: 入力契約内では真偽値を返す。
 * @invariant RelationはCanonical Markdown内の安定ID一致だけで判定する。
 * @boundary Repository Record／DocumentとCollection Queryの境界。
 * @security Queryを正規表現またはMarkupとして実行しない。
 * @concurrency 一回のRepository list Snapshot内で同期評価する。
 */
function matchesQuery(
  kind: ProjectOperationRecordKind,
  record: ProjectOperationRecord,
  markdown: string,
  query: TopicMeetingListQuery,
): boolean {
  const candidate = [
    identity(record),
    record.title,
    record.summary,
    record.owner,
  ]
    .join("\n")
    .toLocaleLowerCase("ja");
  if (
    query.query !== undefined &&
    !candidate.includes(query.query.toLocaleLowerCase("ja"))
  )
    return false;
  if (query.states !== undefined && !query.states.includes(record.state))
    return false;
  if (query.owner !== undefined && record.owner !== query.owner) return false;
  if (
    query.relation !== undefined &&
    !markdown.includes(`\`${query.relation}\``) &&
    !markdown.includes(query.relation)
  )
    return false;
  if (kind === "meeting" && "meetingId" in record) {
    const date = record.occurredAt.slice(0, 10);
    if (query.occurredFrom !== undefined && date < query.occurredFrom)
      return false;
    if (query.occurredTo !== undefined && date > query.occurredTo) return false;
    if (query.pendingOnly === true && record.pendingOutcomeCount === 0)
      return false;
  }
  return true;
}

/**
 * RecordのSort Keyを取得する。
 *
 * @responsibility 許可した並び順を安定Identity付きの比較Keyへ変換する。
 * @trace ARCH-000006
 * @input recordと正規化済みsortを受け取る。
 * @returns 比較用文字列を返す。
 * @precondition sortはkindに許可された値である。
 * @postcondition 同じ主KeyはIdentityで一意に並べられる。
 * @effect N/A: 値を読むだけである。
 * @failure N/A: 許可済みsortは必ずKeyを持つ。
 * @invariant occurred_desc以外は昇順比較に使う。
 * @boundary Project Operation RecordとCollection順序の境界。
 * @security N/A: 公開Record Metadataだけを扱う。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function sortKey(record: ProjectOperationRecord, sort: string): string {
  if (sort === "title_asc") return record.title.toLocaleLowerCase("ja");
  if (sort === "state_asc") return record.state;
  if (sort === "occurred_desc" && "meetingId" in record)
    return record.occurredAt;
  return identity(record);
}

type CollectionCursor = readonly [string, string, string, string];

/**
 * Filter付き一覧の継続位置を符号化する。
 *
 * @responsibility Sort、主Key、IdentityおよびQuery Snapshotを不透明Cursorへ結合する。
 * @trace ARCH-000006
 * @input record、sortおよびquerySignatureを受け取る。
 * @returns URL安全なCursorを返す。
 * @precondition recordは現在Pageの最後の要素である。
 * @postcondition Cursor再利用時にFilter／Sort変更を検出できる。
 * @effect N/A: 固定JSONを符号化するだけである。
 * @failure N/A: 検証済み値だけを入力とする。
 * @invariant Filesystem Pathまたは本文をCursorへ含めない。
 * @boundary Project Operation CollectionとConsumer継続Requestの境界。
 * @security 公開MetadataとQuery Signatureだけを含む。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function encodeCursor(
  record: ProjectOperationRecord,
  sort: string,
  querySignature: string,
): string {
  return Buffer.from(
    JSON.stringify([
      sort,
      sortKey(record, sort),
      identity(record),
      querySignature,
    ]),
    "utf8",
  ).toString("base64url");
}

/**
 * 不透明Cursorを現在Queryの継続位置として検証する。
 *
 * @responsibility Cursorの構造、長さ、SortおよびQuery Signature一致をEffect前に検証する。
 * @trace ARCH-000006
 * @input cursor、sortおよびquerySignatureを受け取る。
 * @returns 検証済みCollectionCursorを返す。
 * @precondition cursorはBrowser／MCP由来の未信頼文字列である。
 * @postcondition 現在Queryへだけ再利用できる四要素Cursorを返す。
 * @effect N/A: 文字列を解析するだけである。
 * @failure 不正または別QueryのCursorを拒否する。
 * @invariant Cursor変更から条件を推測・補正しない。
 * @boundary Consumer CursorとProject Operation Collection Queryの境界。
 * @security CursorをPathまたは任意Objectとして解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function decodeCursor(
  cursor: string,
  sort: string,
  querySignature: string,
): CollectionCursor {
  if (cursor.length === 0 || cursor.length > 1_024)
    throw new Error("project_operation_list_cursor_invalid");
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("project_operation_list_cursor_invalid");
  }
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((entry) => typeof entry === "string") ||
    value[0] !== sort ||
    value[3] !== querySignature
  )
    throw new Error("project_operation_list_cursor_invalid");
  return Object.freeze(value as string[]) as CollectionCursor;
}

/**
 * Topic／Meeting Repositoryを共通Applicationへ接続する。
 *
 * @responsibility 全入口で同じPagination、改訂競合および削除確認を使用させる。
 * @trace ARCH-000006
 * @input repositoryに検証済みRepository Rootへ接続済みのCRUD Portを受け取る。
 * @returns Topic／Meetingの共通Application Portを返す。
 * @precondition repositoryは一つのRepository境界だけを所有する。
 * @postcondition 一覧はID昇順で最大limit件を返し、続きがある場合だけnextCursorを返す。
 * @effect create、update、deleteだけがRepository PortのEffectを発行する。
 * @failure Cursor、limitまたはID不正をEffect 0のErrorとして拒否する。
 * @invariant Cursorは最後に返した安定IDであり、Offsetを永続Identityとして扱わない。
 * @boundary Project Operation ApplicationとRepository Portの境界。
 * @security 任意Path、Cascade Deleteまたは確認省略を追加しない。
 * @concurrency RevisionとRecord LockはRepository Portの契約を維持する。
 */
export function createTopicMeetingApplication(
  repository: TopicMeetingRepository,
): TopicMeetingApplication {
  /**
   * 現在RepositoryにRelation対象が存在するか確認する。
   *
   * @responsibility Topic、MeetingおよびCHGの異なる保存境界を一つの存在確認へ縮約する。
   * @trace ARCH-000006
   * @input kindに対象種別、idに安定IDを受け取る。
   * @returns 現在RepositoryにCanonical対象が存在する場合trueを返す。
   * @precondition kindとidは解析済みRelationから得た値である。
   * @postcondition 対象本文やFilesystem Pathを公開しない。
   * @effect N/A: Repositoryの現在Snapshotを読取るだけである。
   * @failure N/A: 不在をfalseとして返す。
   * @invariant 別Repositoryの存在を推測しない。
   * @boundary Project Operation ApplicationとRepository内Owner Artifactの境界。
   * @security 存在判定はApplicationを取得済みの利用側だけへ公開する。
   * @concurrency 呼出しごとにRepositoryの現在Snapshotを確認する。
   */
  const hasRelationTarget = (
    kind: TopicMeetingRelation["kind"],
    id: string,
  ): boolean =>
    kind === "change"
      ? repository.hasChange(id)
      : repository.get(kind, id) !== null;
  return Object.freeze({
    list: ({ kind, cursor, limit = 20, query }) => {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new Error("project_operation_list_limit_invalid");
      const normalized = normalizeQuery(kind, query);
      const sort = normalized.sort ?? "id_asc";
      const signature = JSON.stringify(normalized);
      const result = repository.list(kind);
      const filtered = result.records
        .filter((record) => {
          const document = repository.getDocument(kind, identity(record));
          return (
            document !== null &&
            matchesQuery(kind, record, document.markdown, normalized)
          );
        })
        .sort((left, right) => {
          const keyOrder = sortKey(left, sort).localeCompare(
            sortKey(right, sort),
          );
          const stable =
            keyOrder || identity(left).localeCompare(identity(right));
          return sort === "occurred_desc" ? -stable : stable;
        });
      let remaining = filtered;
      if (cursor !== undefined) {
        const legacy = new RegExp(
          `^${kind === "topic" ? "TOPIC" : "MTG"}-\\d{6}$`,
          "u",
        );
        if (legacy.test(cursor) && query === undefined) {
          remaining = filtered.filter((record) => identity(record) > cursor);
        } else {
          const decoded = decodeCursor(cursor, sort, signature);
          remaining = filtered.filter((record) => {
            const keyOrder = sortKey(record, sort).localeCompare(decoded[1]);
            const stable =
              keyOrder || identity(record).localeCompare(decoded[2]);
            return sort === "occurred_desc" ? stable < 0 : stable > 0;
          });
        }
      }
      const records = Object.freeze(remaining.slice(0, limit));
      return Object.freeze({
        status: result.status,
        records,
        nextCursor:
          remaining.length > records.length && records.length > 0
            ? query === undefined && sort === "id_asc"
              ? identity(records.at(-1) as ProjectOperationRecord)
              : encodeCursor(
                  records.at(-1) as ProjectOperationRecord,
                  sort,
                  signature,
                )
            : null,
      });
    },
    get: (kind, id) => repository.get(kind, id),
    getDocument: (kind, id) => repository.getDocument(kind, id),
    relations: (kind, id) => {
      const document = repository.getDocument(kind, id);
      if (document === null) return Object.freeze([]);
      const ownId = identity(document.record);
      const relationIds = [
        ...new Set(
          [...document.markdown.matchAll(/\b(?:TOPIC|MTG|CHG)-\d{6}\b/gu)]
            .map((match) => match[0])
            .filter((relationId) => relationId !== ownId),
        ),
      ].sort();
      return Object.freeze(
        relationIds.map((relationId): TopicMeetingRelation => {
          const relationKind = relationId.startsWith("TOPIC-")
            ? ("topic" as const)
            : relationId.startsWith("MTG-")
              ? ("meeting" as const)
              : ("change" as const);
          const available = hasRelationTarget(relationKind, relationId);
          return Object.freeze({
            id: relationId,
            kind: relationKind,
            state: available ? ("available" as const) : ("not_found" as const),
          });
        }),
      );
    },
    hasRelationTarget,
    create: (kind, markdown) => repository.create(kind, markdown),
    update: ({ kind, id, expectedRevision, markdown }) =>
      repository.update(kind, id, expectedRevision, markdown),
    inspectDeletion: (kind, id) => repository.inspectDeletion(kind, id),
    delete: (input) => repository.delete(input),
    promoteTopic: (input) => {
      const current = repository.getDocument("topic", input.topicId);
      const blocked = (
        reason: TopicPromotionCommandResult["reason"],
      ): TopicPromotionCommandResult =>
        Object.freeze({
          status: "blocked" as const,
          reason,
          record: current?.record ?? null,
          filesystemEffectCount: 0 as const,
        });
      if (current === null) return blocked("record_not_found");
      if (current.record.revision !== input.expectedRevision)
        return blocked("record_revision_conflict");
      if (!repository.hasChange(input.changeId))
        return blocked("topic_promotion_target_not_found");
      try {
        const markdown = applyTopicPromotion(current.markdown, {
          changeId: input.changeId,
          reason: input.reason,
          remainingResponsibility: input.remainingResponsibility,
        });
        const updated = repository.update(
          "topic",
          input.topicId,
          input.expectedRevision,
          markdown,
        );
        return Object.freeze({
          status: updated.status,
          reason:
            updated.status === "completed"
              ? ("topic_promoted" as const)
              : updated.reason === "record_revision_conflict"
                ? ("record_revision_conflict" as const)
                : ("topic_promotion_invalid" as const),
          record: updated.record,
          filesystemEffectCount: updated.filesystemEffectCount,
        });
      } catch {
        return blocked("topic_promotion_invalid");
      }
    },
    treatMeetingOutcome: (input) => {
      const current = repository.getDocument("meeting", input.meetingId);
      const blocked = (
        reason: MeetingOutcomeCommandResult["reason"],
      ): MeetingOutcomeCommandResult =>
        Object.freeze({
          status: "blocked" as const,
          reason,
          record: current?.record ?? null,
          filesystemEffectCount: 0 as const,
        });
      if (current === null) return blocked("record_not_found");
      if (current.record.revision !== input.expectedRevision)
        return blocked("record_revision_conflict");

      const allowedTarget =
        (input.disposition === "completed" ||
          input.disposition === "rejected") &&
        input.target.kind === "none"
          ? true
          : input.disposition === "transferred" &&
              ["topic", "owner"].includes(input.target.kind)
            ? true
            : input.disposition === "promoted" &&
              ["change", "owner"].includes(input.target.kind);
      if (!allowedTarget) return blocked("meeting_outcome_target_invalid");
      if (input.target.kind === "topic") {
        const target = repository.get("topic", input.target.reference);
        if (target === null) return blocked("meeting_outcome_target_not_found");
        if (target.projectId !== current.record.projectId)
          return blocked("meeting_outcome_target_project_mismatch");
      }
      if (
        input.target.kind === "change" &&
        !repository.hasChange(input.target.reference)
      )
        return blocked("meeting_outcome_target_not_found");

      try {
        const markdown = applyMeetingOutcomeTreatment(current.markdown, {
          outcomeId: input.outcomeId,
          disposition: input.disposition,
          owner: input.owner,
          reviewTrigger: input.reviewTrigger,
          targetReference: input.target.reference,
          treatment: input.treatment,
          completionCondition: input.completionCondition,
          result: input.result,
          closeMeeting: input.closeMeeting,
        });
        const updated = repository.update(
          "meeting",
          input.meetingId,
          input.expectedRevision,
          markdown,
        );
        return Object.freeze({
          status: updated.status,
          reason:
            updated.status === "completed"
              ? ("meeting_outcome_treated" as const)
              : updated.reason === "record_revision_conflict"
                ? ("record_revision_conflict" as const)
                : ("meeting_outcome_invalid" as const),
          record: updated.record,
          filesystemEffectCount: updated.filesystemEffectCount,
        });
      } catch {
        return blocked("meeting_outcome_invalid");
      }
    },
  });
}
