/**
 * Topicの書込み受付と、Topic／Meetingの関連文書を扱う操作の構成を担当する。
 * @responsibility 認可済み集合を既存の関連評価に渡し、Topicの書込みだけをここで配送する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 各通信の受付とDocument ModelのTopic操作。
 */
import type {
  MeetingOutcomeCommandResult,
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "@qual-lab/crdd-document-model";

import type { AuthorizedRepository } from "@qual-lab/crdd-access-management";
import {
  createMeetingOperations,
  createTopicOperations,
  federateTopicMeetingRelations,
  type TopicMeetingAccess,
} from "@qual-lab/crdd-document-model";

/** TopicとMeetingが共用する種別確定済みの書込み入力。 @trace ARCH-000006 */
export type RecordWriteCommand =
  | Readonly<{
      operation: "create";
      input: Parameters<TopicMeetingAccess["topic"]["create"]>[0];
    }>
  | Readonly<{
      operation: "update";
      input: Parameters<TopicMeetingAccess["topic"]["update"]>[0];
    }>
  | Readonly<{
      operation: "delete";
      input: Parameters<TopicMeetingAccess["topic"]["delete"]>[0];
    }>;

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
export function resolveTopicMeetingAccess(
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
      return {
        repositoryId: entry.repositoryId,
        projectId: entry.manifest.projectId,
        application: {
          topic: createTopicOperations(entry.root, entry.manifest.projectId),
          meeting: createMeetingOperations(
            entry.root,
            entry.manifest.projectId,
          ),
        },
      };
    });
  if (signal.aborted) throw new Error(unavailableReason);
  return federateTopicMeetingRelations(repositoryId, sources);
}

type TopicPromotionAction = Readonly<{
  operation: "promote";
  input: Parameters<TopicMeetingAccess["topic"]["promoteTopic"]>[0];
}>;

/** 作成・更新・削除・昇格を既存のTopic操作で行う。 @trace ARCH-000006 */
export function executeTopicAction(
  topic: TopicMeetingAccess["topic"],
  command: RecordWriteCommand,
): ReturnType<TopicMeetingAccess["topic"]["create"]>;
export function executeTopicAction(
  topic: TopicMeetingAccess["topic"],
  command: TopicPromotionAction,
): ReturnType<TopicMeetingAccess["topic"]["promoteTopic"]>;
export function executeTopicAction(
  topic: TopicMeetingAccess["topic"],
  command: RecordWriteCommand | TopicPromotionAction,
) {
  switch (command.operation) {
    case "create":
      return topic.create(command.input);
    case "update":
      return topic.update(command.input);
    case "delete":
      return topic.delete(command.input);
    case "promote":
      return topic.promoteTopic(command.input);
  }
}

/**
 * Topic／Meetingの保存・昇格・Outcome処置が返す既存結果。
 * @responsibility 操作結果と保存済みRelationを表示への縮小前に保持する。
 * @trace ARCH-000006
 * @shape 通常保存または昇格・Outcome処置の結果とrelationPaths。
 * @invariant 元のstatus・reason・recordを変更せず、表示結果を処置完了の代替にしない。
 * @boundary Domain操作結果とWorkbenchの要求・表示処理。
 * @security 資格・Root・保存Authorityを含めない。
 * @compatibility 既存Domain操作結果の合成型であり、新しい通信・保存Schemaではない。
 */
export type TopicMeetingActionResult =
  | TopicMeetingWriteResult
  | ((MeetingOutcomeCommandResult | TopicPromotionCommandResult) & {
      relationPaths: readonly string[];
    });

/**
 * Topic／Meeting本文とRelationを表示へ渡す同期Reader契約。
 * @responsibility 認可済みDomain操作の読取り形だけを共有する。
 * @trace ARCH-000006
 * @shape 種別とIDを受ける本文・Relationの二読取り。
 * @invariant 資格・Root・通信・保存を所有しない。
 * @boundary Domainの読取りとWorkbench表示。
 * @security Callerの現在認可済み操作だけを構成し、Rootや資格を公開しない。
 * @compatibility 現行Domain結果のみ。旧MCP搬送を含めない。
 */
export type RecordDocumentReader = Readonly<{
  getDocument(
    kind: ProjectOperationRecordKind,
    id: string,
  ): TopicMeetingDocument | null;
  relations(
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[];
}>;

/**
 * 当該PageのRecord本文とRelationを表示用に取得する。
 * @responsibility 現在一覧に含まれるRecordだけを注入Readerから読む。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input Topic／Meetingの有界Pageと、現在認可した同期本文・Relation Reader。
 * @returns 取得できた本文の不変表示一覧。
 * @precondition Callerが当該要求のRepository・内容認可と一覧取得を完了している。
 * @postcondition Page外のIDを読まず、元の本文とRelationを保持する。
 * @effect 注入Readerを通した本文とRelationの読取り。
 * @failure Reader例外をCallerへ伝播する。本文未取得nullのRecordは一覧へ補完しない。
 * @invariant 変換だけから認可・保存・完全観測の成立を生成しない。
 * @boundary 認可済み本文Readerと表示DTO。
 * @security 本文をHTMLとして実行せず、資格・物理Rootを追加しない。
 * @concurrency 同じ要求内の同期Readerだけを使い、次要求へ保持しない。
 */
export function createRecordDocumentViews(
  topicPage: TopicMeetingPage,
  meetingPage: TopicMeetingPage,
  reader: RecordDocumentReader,
): readonly RecordDocumentView[] {
  const values: RecordDocumentView[] = [];
  for (const [kind, page] of [
    ["topic", topicPage],
    ["meeting", meetingPage],
  ] as const) {
    for (const record of page.records) {
      const id = "topicId" in record ? record.topicId : record.meetingId;
      const document = reader.getDocument(kind, id);
      if (document === null) continue;
      values.push(
        Object.freeze({
          kind,
          id,
          document,
          relations: Object.freeze([...reader.relations(kind, id)]),
        }),
      );
    }
  }
  return Object.freeze(values);
}

/**
 * Topic／Meetingの表示検索を同じ固定入力へ変換する。
 * @responsibility 単体とCROSで検索・並び順・ページ条件の意味を揃える。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input URL検索値と対象Record種別。
 * @returns 既存Domain一覧へ渡す非Authorityの検索条件。
 * @precondition Repository認可は別途要求ごとに行う。
 * @postcondition 空値を省略し未知sortを既存既定値へ戻す。
 * @effect N/A: 同期入力変換だけ。
 * @failure 不正検索の最終判定はDomain一覧が所有する。
 * @invariant 検索値からRoot・権限・保存操作を生成しない。
 * @boundary HTTP表示入力とDomain一覧。
 * @security 任意Pathや資格を条件へ追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function readRecordQuery(
  parameters: URLSearchParams,
  kind: "topic" | "meeting",
): TopicMeetingListQuery {
  const result: Record<string, unknown> = {};
  for (const [field, suffix] of [
    ["query", "Query"],
    ["relation", "Relation"],
    ...(kind === "topic"
      ? [["owner", "Owner"]]
      : [
          ["occurredFrom", "From"],
          ["occurredTo", "To"],
        ]),
  ]) {
    const value = parameters.get(`${kind}${suffix}`)?.trim();
    if (value && field !== undefined) result[field] = value;
  }
  const state = parameters.get(`${kind}State`)?.trim();
  if (state) result.states = [state];
  const sort = parameters.get(`${kind}Sort`)?.trim();
  result.sort =
    kind === "topic"
      ? sort === "title_asc" || sort === "state_asc"
        ? sort
        : "id_asc"
      : sort === "id_asc" || sort === "title_asc"
        ? sort
        : "occurred_desc";
  if (kind === "meeting" && parameters.get("meetingPending") === "true")
    result.pendingOnly = true;
  return Object.freeze(result) as TopicMeetingListQuery;
}

/**
 * 選択済みRepositoryのTopic・Meeting一覧を順に取得する。
 * @responsibility 単体と共有で検索・Cursor・ページ幅・本文Readerの構成を揃える。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 同じ要求内の認可済み操作へ接続し、再認可・応答は受付が所有する。
 */
export function readRecordPages(
  access: TopicMeetingAccess,
  parameters: URLSearchParams,
) {
  const topicCursor = parameters.get("topicCursor");
  const meetingCursor = parameters.get("meetingCursor");
  const topicQuery = readRecordQuery(parameters, "topic");
  const meetingQuery = readRecordQuery(parameters, "meeting");
  const topicPage = access.topic.list({
    ...(topicCursor === null ? {} : { cursor: topicCursor }),
    limit: 20,
    query: topicQuery,
  });
  const meetingPage = access.meeting.list({
    ...(meetingCursor === null ? {} : { cursor: meetingCursor }),
    limit: 20,
    query: meetingQuery,
  });
  const reader: RecordDocumentReader = {
    getDocument: (kind, id) => access[kind].getDocument(id),
    relations: (kind, id) => access[kind].relations(id),
  };
  return { topicQuery, meetingQuery, topicPage, meetingPage, reader };
}

/**
 * Record操作の結果を非秘密の表示値へ縮小する。
 * @responsibility status・reason・Relation PathとRecord種別だけを保持する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input Domain保存・昇格・Outcome処置の結果または未処置null。
 * @returns 表示用結果またはnull。
 * @precondition 操作の処置状態と失敗は元Ownerが判定済みである。
 * @postcondition 元のstatus・reasonを維持し、本文・内部保存情報を複製しない。
 * @effect N/A: 当該結果の不変値変換だけ。
 * @failure N/A: 型付き既存結果を変換し、失敗判定を新設しない。
 * @invariant 未処置を成功へ、表示済みを採用済みへ変換しない。
 * @boundary 操作結果とBrowser表示DTO。
 * @security 生鍵・Root・実行Authorityを追加しない。
 * @concurrency N/A: 共有状態を持たない同期変換。
 */
export function createTopicMeetingResultView(
  result: TopicMeetingActionResult | null,
): RecordActionView | null {
  if (result === null) return null;
  return Object.freeze({
    status: result.status,
    reason: result.reason,
    relationPaths: Object.freeze([...result.relationPaths]),
    recordKind:
      result.record === null
        ? null
        : "topicId" in result.record
          ? "topic"
          : "meeting",
  });
}

/**
 * Browserへ公開できる一件のTopic／Meeting本文とRelation。
 * @responsibility 本文とRelationを同一Record Identityで表示する。
 * @trace ARCH-000012
 * @shape kind、id、documentおよびrelationsで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition Serverで公開可能性を確定済みである。
 * @postcondition Browserは読取り表示値だけを受け取る。
 * @effect N/A: 型宣言である。
 * @failure N/A: 失敗はServer応答で表す。
 * @invariant Record正本を所有しない。
 * @boundary Project OperationとBrowser表示の境界。
 * @security Serverが許可した内容だけを含む。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type RecordDocumentView = Readonly<{
  kind: ProjectOperationRecordKind;
  id: string;
  document: TopicMeetingDocument;
  relations: readonly TopicMeetingRelation[];
}>;

/**
 * Topic／Meeting操作の表示結果。
 * @responsibility 直前操作の成否とRelationを一回表示する。
 * @trace ARCH-000012
 * @shape status、reason、relationPathsおよびrecordKindで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition Serverが操作結果を確定済みである。
 * @postcondition Effect Authorityを含まない。
 * @effect N/A: 型宣言である。
 * @failure blockedをcompletedに変換しない。
 * @invariant 表示結果は永続正本ではない。
 * @boundary Server Effect結果とBrowser表示の境界。
 * @security 非秘密の結果値だけを含む。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type RecordActionView = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  relationPaths: readonly string[];
  recordKind: ProjectOperationRecordKind | null;
}>;

/**
 * 観測済みの記録と操作可否から詳細表示を構築する。
 * @responsibility 単体と共有で結果形状を統一する。
 * @trace ARCH-000012
 * @boundary 記録の取得、対象認可、操作可否の判定は呼出し側に残す。
 */
export function createRecordDetailResponse(
  actionToken: string,
  repositoryId: string | null,
  recordActionsConfigured: boolean,
  record: RecordDocumentView,
): RecordDetailResponse {
  return {
    contract: "crdd/workbench/view/v1",
    view: "record-detail",
    actionToken,
    repositoryId,
    recordActionsConfigured,
    record,
  };
}

/**
 * Topic／MeetingのCanonical本文と許可済み処置を表示するRead Model。
 * @responsibility Record Detailと明示POSTに必要な用途限定値を運ぶ。
 * @trace ARCH-000012
 * @shape contract、view、actionToken、repositoryIdおよびrecordで構成する。
 * @invariant viewはrecord-detailである。
 * @boundary Project Operation RecordとRecord Detail ScreenのJSON境界。
 * @security actionTokenは同一Originの明示POST検証だけに使用する。
 * @compatibility contract `crdd/workbench/view/v1`のrecord-detail variantである。
 */
export type RecordDetailResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "record-detail";
  actionToken: string;
  repositoryId: string | null;
  record: RecordDocumentView;
  recordActionsConfigured: boolean;
}>;
