/**
 * Record本文と操作結果をWorkbench表示へ縮小する。
 *
 * @packageDocumentation
 * @responsibility 認可済みPageの本文・Relation読取りと、処置済み結果の非秘密表示変換を所有する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 当該要求のDomain読取り・結果とBrowser表示DTO。
 * @effect 明示されたPageの本文とRelationを注入Readerで読む。結果変換自体は同期計算だけ。
 * @security 認可集合を広げず、Root・資格・生鍵を表示へ追加しない。
 */
import type { TopicMeetingPage } from "../../../../domain-model/src/index.ts";
import type { TopicMeetingListQuery } from "../../../../domain-model/src/index.ts";
import type {
  WorkbenchRecordDocumentView,
  WorkbenchTopicMeetingResultView,
} from "../../shared/view/types.ts";
import type {
  TopicMeetingActionResult,
  WorkbenchTopicMeetingDocumentReader,
} from "../topic-meeting/action.ts";

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
  reader: WorkbenchTopicMeetingDocumentReader,
): readonly WorkbenchRecordDocumentView[] {
  const values: WorkbenchRecordDocumentView[] = [];
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
): WorkbenchTopicMeetingResultView | null {
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
export function readWorkbenchRecordQuery(
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
