/**
 * WorkbenchのRecordDetailを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import { type ReactElement, useState } from "react";
import { EmptyState } from "../components/elements.ts";
import type {
  WorkbenchRecordDetailViewModel,
  WorkbenchTopicMeetingResultView,
} from "../../shared/view/types.ts";
import { inspectWorkbenchClientModel } from "../../shared/view/validation.ts";
import { createSelectedWorkbenchViewUrl } from "../api/view.ts";
import { RecordOperationPanel } from "../components/record-operation-panel.tsx";
import { requestWorkbench } from "../api/connection.ts";
import { RecordActions } from "../components/records.tsx";
import { readWorkbenchQuery } from "../api/queries.ts";
import type { ReplaceDeletedRecord } from "../api/record.ts";

/**
 * Topic／MeetingのCanonical DetailをCSRで描画する。
 * @responsibility 本文、Relation、改訂および許可済み操作を同一Detailに保つ。
 * @trace ARCH-000012
 * @input modelに一件のRecord Detailを受け取る。
 * @returns Record DetailのReact要素を返す。
 * @precondition RecordとRelationは同じServer Snapshotから導出される。
 * @postcondition Canonical MarkdownとRelation先へ辿れる。
 * @effect 利用者の送信時だけRecord CommandをPOSTする。
 * @failure 対象不在はServerの404を保つ。
 * @invariant BrowserでMarkdownまたはRelationを書き換えない。
 * @boundary Canonical RecordとBrowser Detailの境界。
 * @security MarkdownをHTMLとして解釈せずpre Textで表示する。
 * @concurrency expectedRevisionで競合検出可能にする。
 */
export function RecordDetail({
  model: initialModel,
  replaceDeletedRecord,
}: {
  model: WorkbenchRecordDetailViewModel;
  replaceDeletedRecord: ReplaceDeletedRecord;
}): ReactElement {
  const [model, setModel] = useState(initialModel);
  /**
   * 操作後に同じRepositoryの本文、削除後は一覧を取得する。
   * @responsibility 不存在になったDetailを現在本文として残さない。
   * @trace ARCH-000006
   * @trace ARCH-000012
   * @input 所有Signalと検査済み結果。
   * @returns fresh表示の処置完了。
   * @precondition 共有Detailの現在Modelを所有する。
   * @postcondition 通常更新は同じDetailを確認し、削除は確定通知と次取得をRouterへ引き渡す。
   * @effect 通常更新はGET一回、削除はRouter replaceによる一覧GET一回。
   * @failure 取得失敗で旧本文を現在値へ補完しない。
   * @invariant 保存要求は再送しない。
   * @boundary Detail表示と同Origin Read Model。
   * @security URLへ資格・Rootを追加しない。
   * @concurrency 通常更新はSignal・URL・返却Identityを待機後に確認する。削除は引渡し前にSignalを検査し、以後Routerが取得を所有する。
   */
  async function refreshRecord(
    signal: AbortSignal,
    result: WorkbenchTopicMeetingResultView | null,
  ): Promise<void> {
    const originalUrl = window.location.href;
    const target = new URL(originalUrl);
    const deleted =
      result?.status === "completed" && result.reason === "record_deleted";
    if (deleted) {
      target.pathname = "/";
      target.searchParams.delete("id");
      target.hash = model.record.kind === "topic" ? "topics" : "meetings";
      if (
        signal.aborted ||
        window.location.href !== originalUrl ||
        result === null
      )
        throw new Error("workbench_view_unavailable");
      await replaceDeletedRecord(target, model.repositoryId, result);
      return;
    }
    const next = await readWorkbenchQuery("view", signal, async (signal) => {
      const response = await requestWorkbench(
        createSelectedWorkbenchViewUrl(target, model.repositoryId),
        { signal, cache: "no-store" },
      );
      if (!response.ok) throw new Error("workbench_view_unavailable");
      return inspectWorkbenchClientModel(await response.json());
    });
    if (
      signal.aborted ||
      window.location.href !== originalUrl ||
      next.view !== "record-detail" ||
      next.repositoryId !== model.repositoryId ||
      next.record.kind !== model.record.kind ||
      next.record.id !== model.record.id
    )
      throw new Error("workbench_view_unavailable");
    if (next.view === "record-detail") setModel(next);
  }
  const { document, relations } = model.record;
  const record = document.record;
  const identity = "topicId" in record ? record.topicId : record.meetingId;
  const content = (
    <article className="panel">
      <header>
        <div>
          <p className="eyebrow">
            {model.record.kind === "topic" ? "Topic detail" : "Meeting detail"}
          </p>
          <h1>{record.title}</h1>
        </div>
        <span>{record.state}</span>
      </header>
      <dl className="detail-metadata">
        <div>
          <dt>ID</dt>
          <dd>
            <code>{identity}</code>
          </dd>
        </div>
        <div>
          <dt>Project</dt>
          <dd>{record.projectId}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{record.owner}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{record.revision}</dd>
        </div>
        {model.record.kind === "meeting" && "occurredAt" in record ? (
          <>
            <div>
              <dt>開催日時</dt>
              <dd>{record.occurredAt}</dd>
            </div>
            <div>
              <dt>未処置Outcome</dt>
              <dd>{record.pendingOutcomeCount}</dd>
            </div>
          </>
        ) : null}
      </dl>
      <section>
        <h2>現在要約</h2>
        <p>{record.summary}</p>
      </section>
      <section>
        <h2>Relation</h2>
        {relations.length === 0 ? (
          <EmptyState>明示Relationはありません。</EmptyState>
        ) : (
          <ul className="relation-list">
            {relations.map((relation) => (
              <li key={`${relation.kind}-${relation.id}`}>
                {relation.state === "available" ? (
                  <a
                    href={
                      relation.kind === "topic" || relation.kind === "meeting"
                        ? `/${relation.kind}?id=${encodeURIComponent(relation.id)}${relation.ownerRepositoryId === null || relation.ownerRepositoryId === undefined ? "" : `&repositoryId=${encodeURIComponent(relation.ownerRepositoryId)}`}`
                        : `/change?id=${encodeURIComponent(relation.id)}`
                    }
                  >
                    <code>{relation.id}</code>
                  </a>
                ) : (
                  <code>{relation.id}</code>
                )}{" "}
                <span>
                  {relation.state === "available"
                    ? relation.kind
                    : relation.state === "conflicting"
                      ? "参照先が競合"
                      : relation.state === "unavailable"
                        ? "参照可否を確認できません"
                        : "参照先なし"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Canonical Markdown</h2>
        <pre className="canonical-markdown">{document.markdown}</pre>
      </section>
      {model.repositoryId === null || model.recordActionsConfigured ? (
        <RecordActions
          actionToken={model.actionToken}
          repositoryId={model.repositoryId}
          document={model.record}
        />
      ) : (
        <fieldset disabled>
          <p role="status">
            この接続の内容保存は未接続です。現在は閲覧のみです。
          </p>
          <RecordActions
            actionToken={model.actionToken}
            repositoryId={model.repositoryId}
            document={model.record}
          />
        </fieldset>
      )}
    </article>
  );
  return (
    <main className="record-detail" id={`${model.record.kind}-detail`}>
      <a
        className="page-link"
        href={`${model.repositoryId === null ? "/" : `/?repositoryId=${encodeURIComponent(model.repositoryId)}`}#${model.record.kind === "topic" ? "topics" : "meetings"}`}
      >
        ← {model.record.kind === "topic" ? "Topics" : "Meetings"}へ戻る
      </a>
      {model.repositoryId !== null && model.recordActionsConfigured ? (
        <RecordOperationPanel
          key={`${model.repositoryId}:${model.actionToken}`}
          repositoryId={model.repositoryId}
          actionToken={model.actionToken}
          refresh={refreshRecord}
        >
          {content}
        </RecordOperationPanel>
      ) : (
        content
      )}
    </main>
  );
}
