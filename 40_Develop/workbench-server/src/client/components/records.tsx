/**
 * WorkbenchのRecordOperationFields・RecordActions・RecordCollection・OwnerArtifactsを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement, ReactNode } from "react";
import { ActionTokenInput, EmptyState, WorkbenchPanel } from "./elements.ts";
import type {
  WorkbenchMainViewModel,
  WorkbenchRecordDocumentView,
} from "../../shared/view/types.ts";

/**
 * Topic／Meeting Formが共有する固定Hidden Fieldを返す。
 * @responsibility Record Identity、改訂およびRepositoryをPOSTへ損失なく運ぶ。
 * @trace ARCH-000012
 * @input documentとrepositoryIdを受け取る。
 * @returns 固定Hidden InputのReact要素列を返す。
 * @precondition documentは表示中の同一Recordである。
 * @postcondition POSTに必要なIdentityを明示送信できる。
 * @effect N/A: Form要素の構築だけを行う。
 * @failure Repository未選択ではrepositoryIdを送らない。
 * @invariant Recordの本文やAuthorityを付加しない。
 * @boundary Browser FormとTopic／Meeting Applicationの境界。
 * @security Server確定済みIdentityだけを運ぶ。
 * @concurrency 表示時のexpectedRevisionを保持する。
 */
export function RecordOperationFields({
  actionToken,
  repositoryId,
  document,
  operation,
}: Readonly<{
  actionToken: string;
  repositoryId: string | null;
  document: WorkbenchRecordDocumentView;
  operation: string;
}>): ReactElement {
  return (
    <>
      <ActionTokenInput value={actionToken} />
      {repositoryId === null ? null : (
        <input type="hidden" name="repositoryId" value={repositoryId} />
      )}
      <input type="hidden" name="kind" value={document.kind} />
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="id" value={document.id} />
      <input
        type="hidden"
        name="expectedRevision"
        value={document.document.record.revision}
      />
    </>
  );
}

/**
 * Topic／Meetingの明示的な編集・削除操作を描画する。
 * @responsibility Record種別ごとの許可操作と確認条件を表示する。
 * @trace ARCH-000012
 * @input actionToken、repositoryId、documentを受け取る。
 * @returns 明示POST FormのReact要素を返す。
 * @precondition documentは現在表示中のRecordである。
 * @postcondition 削除・Close等の破壊的操作は確認を要求する。
 * @effect 利用者の送信時だけPOSTを発行する。
 * @failure Server拒否をClientで成功へ変換しない。
 * @invariant Authority判定はServerに残す。
 * @boundary Browser操作とTopic／Meeting Commandの境界。
 * @security Process限定Action Tokenと明示確認を使用する。
 * @concurrency expectedRevisionで表示後競合を検出できる。
 */
export function RecordActions({
  actionToken,
  repositoryId,
  document,
}: Readonly<{
  actionToken: string;
  repositoryId: string | null;
  document: WorkbenchRecordDocumentView;
}>): ReactElement {
  return (
    <details className="record-editor">
      <summary>処置・編集・削除</summary>
      {document.kind === "meeting" ? (
        <form method="post" action="/topic-meeting/action">
          <RecordOperationFields
            actionToken={actionToken}
            repositoryId={repositoryId}
            document={document}
            operation="treat-outcome"
          />
          <h4>Outcomeを処置</h4>
          <label>
            Outcome ID
            <input required name="outcomeId" pattern="OUT-[0-9]{3,}" />
          </label>
          <label>
            処置
            <select required name="disposition">
              <option value="completed">完了</option>
              <option value="transferred">移管</option>
              <option value="promoted">昇格</option>
              <option value="rejected">理由付き不採用</option>
            </select>
          </label>
          <label>
            Owner
            <input required name="owner" />
          </label>
          <label>
            期限／再評価契機
            <input required name="reviewTrigger" />
          </label>
          <label>
            追跡先
            <input required name="targetReference" defaultValue="N/A: 完了" />
          </label>
          <label>
            処置
            <input required name="treatment" />
          </label>
          <label>
            完了条件
            <input required name="completionCondition" />
          </label>
          <label>
            結果
            <input required name="result" />
          </label>
          <label>
            追跡先の種別
            <select required name="targetKind">
              <option value="none">なし</option>
              <option value="topic">Topic</option>
              <option value="change">CHG</option>
              <option value="owner">責任主体／所有正本</option>
            </select>
          </label>
          <label className="confirm">
            <input type="checkbox" name="closeMeeting" value="true" />
            この処置後にpending Outcomeが0件ならMeetingを閉じる
          </label>
          <button type="submit">Outcomeを処置</button>
        </form>
      ) : (
        <form method="post" action="/topic-meeting/action">
          <RecordOperationFields
            actionToken={actionToken}
            repositoryId={repositoryId}
            document={document}
            operation="promote-topic"
          />
          <h4>採用済み変更へ接続</h4>
          <label>
            既存CHG ID
            <input required name="changeId" pattern="CHG-[0-9]{6}" />
          </label>
          <label>
            採用理由
            <input required name="reason" />
          </label>
          <label>
            Topicに残る責務
            <input required name="remainingResponsibility" />
          </label>
          <button type="submit">実在CHGを確認して昇格</button>
        </form>
      )}
      <form method="post" action="/topic-meeting/action">
        <RecordOperationFields
          actionToken={actionToken}
          repositoryId={repositoryId}
          document={document}
          operation="update"
        />
        <label>
          Canonical Markdown
          <textarea
            required
            name="markdown"
            rows={14}
            defaultValue={document.document.markdown}
          />
        </label>
        <button type="submit">更新</button>
      </form>
      <form method="post" action="/topic-meeting/action">
        <RecordOperationFields
          actionToken={actionToken}
          repositoryId={repositoryId}
          document={document}
          operation="delete"
        />
        <label className="confirm">
          <input required type="checkbox" name="confirmed" value="true" />
          Relation影響を確認し、誤登録Recordだけを削除します
        </label>
        <button type="submit">削除影響を確認して実行</button>
      </form>
    </details>
  );
}

/**
 * Topic／Meeting一覧を状態と操作を保ったPanelとして描画する。
 * @responsibility Record種別ごとの検索語彙、並び順、本文導線と操作結果を保つ。
 * @trace ARCH-000012
 * @input modelとkindを受け取る。
 * @returns TopicまたはMeeting Panelを返す。
 * @precondition kindはtopicまたはmeetingである。
 * @postcondition Meetingはtopicと異なる状態・並び順語彙を保つ。
 * @effect Form送信時だけGETまたはPOSTを発行する。
 * @failure 未構成・不明・0件を同一視しない。
 * @invariant ServerのQuery検証を代替しない。
 * @boundary Record Collection Read ModelとBrowser操作の境界。
 * @security 固定語彙とReactのText escapingを使用する。
 * @concurrency CursorとQueryの拘束を維持する。
 */
export function RecordCollection({
  model,
  kind,
}: Readonly<{
  model: WorkbenchMainViewModel;
  kind: "topic" | "meeting";
}>): ReactElement {
  const source = kind === "topic" ? model.topic : model.meeting;
  const collection = source.collection;
  const records = source.page.records;
  const label = kind === "topic" ? "Topic" : "Meeting";
  const documentById = new Map(
    model.recordDocuments
      .filter((document) => document.kind === kind)
      .map((document) => [document.id, document] as const),
  );
  const prefix = kind === "topic" ? "topic" : "meeting";
  const next = new URLSearchParams();
  if (source.query.query !== undefined)
    next.set(`${prefix}Query`, source.query.query);
  if (source.query.states?.[0] !== undefined)
    next.set(`${prefix}State`, source.query.states[0]);
  if (source.query.owner !== undefined)
    next.set(`${prefix}Owner`, source.query.owner);
  if (source.query.relation !== undefined)
    next.set(`${prefix}Relation`, source.query.relation);
  if (kind === "meeting" && source.query.occurredFrom !== undefined)
    next.set("meetingFrom", source.query.occurredFrom);
  if (kind === "meeting" && source.query.occurredTo !== undefined)
    next.set("meetingTo", source.query.occurredTo);
  if (kind === "meeting" && source.query.pendingOnly === true)
    next.set("meetingPending", "true");
  if (source.query.sort !== undefined)
    next.set(`${prefix}Sort`, source.query.sort);
  if (source.page.nextCursor !== null)
    next.set(`${prefix}Cursor`, source.page.nextCursor);
  if (model.selectedRepositoryId !== null)
    next.set("repositoryId", model.selectedRepositoryId);
  const content: ReactNode =
    collection.state === "not_configured" ? (
      <EmptyState>
        {kind === "topic" ? "22_Topics" : "23_Meetings"}
        は未構成です。0件として扱いません。
      </EmptyState>
    ) : collection.state === "unknown" ? (
      <EmptyState>
        {label}正本を完全に観測できません。部分一覧は表示しません。
      </EmptyState>
    ) : records.length === 0 ? (
      <EmptyState>構成済みです。現在の{label}は0件です。</EmptyState>
    ) : (
      <ul>
        {records.map((record) => {
          const id = "topicId" in record ? record.topicId : record.meetingId;
          const document = documentById.get(id);
          return (
            <li key={id}>
              <strong>
                <a
                  href={`/${kind}?id=${encodeURIComponent(id)}${model.selectedRepositoryId === null ? "" : `&repositoryId=${encodeURIComponent(model.selectedRepositoryId)}`}`}
                >
                  {id} — {record.title}
                </a>
              </strong>
              <p>{record.summary}</p>
              <small>
                {"occurredAt" in record
                  ? `${record.state} / ${record.occurredAt} / pending ${record.pendingOutcomeCount}`
                  : `${record.state} / ${record.owner}`}
              </small>
              {document === undefined ? null : (
                <RecordActions
                  actionToken={model.actionToken}
                  repositoryId={model.selectedRepositoryId}
                  document={document}
                />
              )}
            </li>
          );
        })}
      </ul>
    );
  return (
    <WorkbenchPanel
      id={kind === "topic" ? "topics" : "meetings"}
      eyebrow={kind === "topic" ? "Topics" : "Meetings"}
      title={kind === "topic" ? "継続して扱う論点" : "会議と処置状態"}
      status={
        collection.state === "available"
          ? `${records.length} items`
          : collection.state === "not_configured"
            ? "Not configured"
            : "Unknown"
      }
    >
      <form className="collection-controls" method="get" action="/">
        {model.selectedRepositoryId === null ? null : (
          <input
            type="hidden"
            name="repositoryId"
            value={model.selectedRepositoryId}
          />
        )}
        <label>
          検索
          <input
            name={`${prefix}Query`}
            defaultValue={source.query.query ?? ""}
            placeholder="ID・名称・要約"
          />
        </label>
        <label>
          状態
          <select
            name={`${prefix}State`}
            defaultValue={source.query.states?.[0] ?? ""}
          >
            <option value="">すべて</option>
            {(kind === "topic"
              ? ["open", "waiting", "promoted", "closed"]
              : ["recorded", "closed", "corrected"]
            ).map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Owner
          <input
            name={`${prefix}Owner`}
            defaultValue={source.query.owner ?? ""}
          />
        </label>
        <label>
          Relation
          <input
            name={`${prefix}Relation`}
            defaultValue={source.query.relation ?? ""}
            placeholder="CHG-000001"
          />
        </label>
        {kind === "meeting" ? (
          <>
            <label>
              開催日From
              <input
                type="date"
                name="meetingFrom"
                defaultValue={source.query.occurredFrom ?? ""}
              />
            </label>
            <label>
              開催日To
              <input
                type="date"
                name="meetingTo"
                defaultValue={source.query.occurredTo ?? ""}
              />
            </label>
            <label className="confirm">
              <input
                type="checkbox"
                name="meetingPending"
                value="true"
                defaultChecked={source.query.pendingOnly === true}
              />
              未処置Outcomeあり
            </label>
          </>
        ) : null}
        <label>
          並び順
          <select
            name={`${prefix}Sort`}
            defaultValue={
              source.query.sort ??
              (kind === "meeting" ? "occurred_desc" : "id_asc")
            }
          >
            <option value="id_asc">ID順</option>
            <option value="title_asc">名称順</option>
            {kind === "topic" ? (
              <option value="state_asc">状態順</option>
            ) : (
              <option value="occurred_desc">開催日の新しい順</option>
            )}
          </select>
        </label>
        <button type="submit">絞り込む</button>
      </form>
      {model.topicMeetingResult === null ||
      (model.topicMeetingResult.recordKind !== null &&
        model.topicMeetingResult.recordKind !== kind) ? null : (
        <div
          className="operation-result"
          data-status={model.topicMeetingResult.status}
        >
          <strong>{model.topicMeetingResult.reason}</strong>
        </div>
      )}
      {content}
      {source.page.nextCursor === null ? null : (
        <a
          className="page-link"
          href={`/?${next.toString()}#${kind === "topic" ? "topics" : "meetings"}`}
        >
          次の{label}
        </a>
      )}
      <details className="record-editor">
        <summary>{label}を登録</summary>
        <form method="post" action="/topic-meeting/action">
          <ActionTokenInput value={model.actionToken} />
          {model.selectedRepositoryId === null ? null : (
            <input
              type="hidden"
              name="repositoryId"
              value={model.selectedRepositoryId}
            />
          )}
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="operation" value="create" />
          <label>
            Canonical Markdown
            <textarea required name="markdown" rows={14} />
          </label>
          <button type="submit">登録</button>
        </form>
      </details>
    </WorkbenchPanel>
  );
}

/**
 * Owner Artifactの検証済みCatalogを表示する。
 * @responsibility 表示用結論からOwner正本の対象Sectionへ戻れる導線を保つ。
 * @trace ARCH-000012
 * @input modelにOwner Artifact投影を受け取る。
 * @returns Documentation Panelを返す。
 * @precondition LinkはServerのCatalogで検証済みである。
 * @postcondition タイトル・Path・起点Sectionを表示する。
 * @effect N/A: 表示要素の構築だけを行う。
 * @failure 欠落Linkを推測生成しない。
 * @invariant Artifactの正本を所有しない。
 * @boundary Owner Artifact CatalogとBrowser表示の境界。
 * @security 検証済みRepository内Linkだけを使用する。
 * @concurrency N/A: 不変Snapshotを描画する。
 */
export function OwnerArtifacts({
  model,
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
  const catalog = model.surface.ownerArtifacts;
  const normalizedQuery = model.documentQuery.toLocaleLowerCase("ja-JP");
  const artifacts = catalog.artifacts.filter(
    (artifact) =>
      normalizedQuery.length === 0 ||
      artifact.title.toLocaleLowerCase("ja-JP").includes(normalizedQuery) ||
      artifact.relativePath
        .toLocaleLowerCase("ja-JP")
        .includes(normalizedQuery),
  );
  return (
    <WorkbenchPanel
      id="documentation"
      eyebrow="Owner artifacts"
      title="Documentation and Relations"
      status={
        catalog.state === "available" ? `${artifacts.length} items` : "Unknown"
      }
    >
      <form className="document-search" method="get" action="/">
        <label>
          TitleまたはPathで検索
          <input name="documentQuery" defaultValue={model.documentQuery} />
        </label>
        <button type="submit">検索</button>
      </form>
      {catalog.state === "unknown" ? (
        <EmptyState>
          Owner Artifactを完全に観測できません。部分一覧は表示しません。
        </EmptyState>
      ) : (
        <ul className="owner-artifact-list">
          {artifacts.map((artifact) => (
            <li key={artifact.relativePath}>
              <a
                href={`/owner-artifact?path=${encodeURIComponent(artifact.relativePath)}`}
              >
                <strong>{artifact.title}</strong>
                <small>{artifact.relativePath}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WorkbenchPanel>
  );
}
