/**
 * CROS WorkbenchのClient-side React Application。
 *
 * @packageDocumentation
 * @responsibility 検証済みJSON Read ModelからWorkbench全画面を描画し、表示構造の唯一の所有者になる。
 * @trace ARCH-000012
 * @boundary Workbench JSON Read ModelとBrowser DOMの境界。
 * @effect Form送信とNavigation以外の外部Effectを発行しない。
 * @security ReactのText escapingを維持し、HTML文字列を解釈しない。
 */
import {
  Fragment,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { renderWorkbenchAiRequest } from "../src/ai-request.ts";
import { WorkbenchShell } from "../src/presentation/workbench-shell.ts";
import {
  ActionTokenInput,
  EmptyState,
  WorkbenchPanel,
} from "../src/presentation/workbench-components.ts";
import type {
  WorkbenchClientModel,
  WorkbenchMainViewModel,
  WorkbenchProjectDetailViewModel,
  WorkbenchRecordDocumentView,
  WorkbenchRecordDetailViewModel,
} from "../src/presentation/workbench-client-model.ts";
import { renderWorkbenchProjectPlan } from "../src/project-plan-surface.ts";
import { renderWorkbenchQuality } from "../src/quality-surface.ts";

/**
 * Project Contextの一場面を表示する。
 * @responsibility Server確定済みの結論・根拠・参照を一つの場面に保つ。
 * @trace ARCH-000012
 * @input sceneに一場面の表示値を受け取る。
 * @returns Project ContextのReact要素を返す。
 * @precondition sceneはServerで検証済みである。
 * @postcondition 結論から根拠とOwner参照へ辿れる。
 * @effect N/A: 表示要素の構築だけを行う。
 * @failure N/A: 入力を再分類しない。
 * @invariant Contextの正本を所有しない。
 * @boundary Project Context Read ModelとBrowser DOMの境界。
 * @security ReactのText escapingを使用する。
 * @concurrency N/A: 同期純粋表示である。
 */
function ProjectScene({
  scene,
}: Readonly<{
  scene: WorkbenchMainViewModel["surface"]["context"]["scenes"][number];
}>): ReactElement {
  return (
    <article className="panel context-scene" id={scene.key}>
      <header>
        <div>
          <p className="eyebrow">Project context</p>
          <h2>{scene.title}</h2>
        </div>
        <span>{scene.table.rows.length} items</span>
      </header>
      {scene.summary === null ? null : (
        <p className="scene-summary">{scene.summary}</p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {scene.table.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scene.table.rows.map((row, rowIndex) => (
              <tr key={`${scene.key}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

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
function RecordOperationFields({
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
        <input
          type="hidden"
          name="repositoryId"
          value={repositoryId}
        />
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
function RecordActions({
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
          <label>Outcome ID<input required name="outcomeId" pattern="OUT-[0-9]{3,}" /></label>
          <label>処置<select required name="disposition"><option value="completed">完了</option><option value="transferred">移管</option><option value="promoted">昇格</option><option value="rejected">理由付き不採用</option></select></label>
          <label>Owner<input required name="owner" /></label>
          <label>期限／再評価契機<input required name="reviewTrigger" /></label>
          <label>追跡先<input required name="targetReference" defaultValue="N/A: 完了" /></label>
          <label>処置<input required name="treatment" /></label>
          <label>完了条件<input required name="completionCondition" /></label>
          <label>結果<input required name="result" /></label>
          <label>追跡先の種別<select required name="targetKind"><option value="none">なし</option><option value="topic">Topic</option><option value="change">CHG</option><option value="owner">責任主体／所有正本</option></select></label>
          <label className="confirm"><input type="checkbox" name="closeMeeting" value="true" />この処置後にpending Outcomeが0件ならMeetingを閉じる</label>
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
          <label>既存CHG ID<input required name="changeId" pattern="CHG-[0-9]{6}" /></label>
          <label>採用理由<input required name="reason" /></label>
          <label>Topicに残る責務<input required name="remainingResponsibility" /></label>
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
function RecordCollection({
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
  if (source.query.query !== undefined) next.set(`${prefix}Query`, source.query.query);
  if (source.query.states?.[0] !== undefined) next.set(`${prefix}State`, source.query.states[0]);
  if (source.query.owner !== undefined) next.set(`${prefix}Owner`, source.query.owner);
  if (source.query.relation !== undefined) next.set(`${prefix}Relation`, source.query.relation);
  if (kind === "meeting" && source.query.occurredFrom !== undefined) next.set("meetingFrom", source.query.occurredFrom);
  if (kind === "meeting" && source.query.occurredTo !== undefined) next.set("meetingTo", source.query.occurredTo);
  if (kind === "meeting" && source.query.pendingOnly === true) next.set("meetingPending", "true");
  if (source.query.sort !== undefined) next.set(`${prefix}Sort`, source.query.sort);
  if (source.page.nextCursor !== null) next.set(`${prefix}Cursor`, source.page.nextCursor);
  if (model.selectedRepositoryId !== null) next.set("repositoryId", model.selectedRepositoryId);
  const content: ReactNode =
    collection.state === "not_configured" ? (
      <EmptyState>
        {kind === "topic" ? "22_Topics" : "23_Meetings"}は未構成です。0件として扱いません。
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
        {model.selectedRepositoryId === null ? null : <input type="hidden" name="repositoryId" value={model.selectedRepositoryId} />}
        <label>検索<input name={`${prefix}Query`} defaultValue={source.query.query ?? ""} placeholder="ID・名称・要約" /></label>
        <label>状態<select name={`${prefix}State`} defaultValue={source.query.states?.[0] ?? ""}><option value="">すべて</option>{(kind === "topic" ? ["open", "waiting", "promoted", "closed"] : ["recorded", "closed", "corrected"]).map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <label>Owner<input name={`${prefix}Owner`} defaultValue={source.query.owner ?? ""} /></label>
        <label>Relation<input name={`${prefix}Relation`} defaultValue={source.query.relation ?? ""} placeholder="CHG-000001" /></label>
        {kind === "meeting" ? <><label>開催日From<input type="date" name="meetingFrom" defaultValue={source.query.occurredFrom ?? ""} /></label><label>開催日To<input type="date" name="meetingTo" defaultValue={source.query.occurredTo ?? ""} /></label><label className="confirm"><input type="checkbox" name="meetingPending" value="true" defaultChecked={source.query.pendingOnly === true} />未処置Outcomeあり</label></> : null}
        <label>並び順<select name={`${prefix}Sort`} defaultValue={source.query.sort ?? (kind === "meeting" ? "occurred_desc" : "id_asc")}><option value="id_asc">ID順</option><option value="title_asc">名称順</option>{kind === "topic" ? <option value="state_asc">状態順</option> : <option value="occurred_desc">開催日の新しい順</option>}</select></label>
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
      {source.page.nextCursor === null ? null : <a className="page-link" href={`/?${next.toString()}#${kind === "topic" ? "topics" : "meetings"}`}>次の{label}</a>}
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
function OwnerArtifacts({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const catalog = model.surface.ownerArtifacts;
  const normalizedQuery = model.documentQuery.toLocaleLowerCase("ja-JP");
  const artifacts = catalog.artifacts.filter(
    (artifact) =>
      normalizedQuery.length === 0 ||
      artifact.title.toLocaleLowerCase("ja-JP").includes(normalizedQuery) ||
      artifact.relativePath.toLocaleLowerCase("ja-JP").includes(normalizedQuery),
  );
  return (
    <WorkbenchPanel
      id="documentation"
      eyebrow="Owner artifacts"
      title="Documentation and Relations"
      status={catalog.state === "available" ? `${artifacts.length} items` : "Unknown"}
    >
      <form className="document-search" method="get" action="/">
        <label>TitleまたはPathで検索<input name="documentQuery" defaultValue={model.documentQuery} /></label>
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

/**
 * Remote CROS接続をToken非反射のFormとして描画する。
 * @responsibility 接続・更新・切断を別操作として表示する。
 * @trace ARCH-000012
 * @input modelに接続状態と非秘密結果を受け取る。
 * @returns Connection Panelを返す。
 * @precondition Remote接続Bearerはmodelに含まれない。
 * @postcondition 入力Tokenを再表示しない。
 * @effect 利用者の送信時だけ接続CommandをPOSTする。
 * @failure unavailableを接続済みと表示しない。
 * @invariant Remote AuthorityはNode Serverに残す。
 * @boundary Browserの一回入力とRemote CROS接続の境界。
 * @security Tokenをvalue、URL、noticeへ反射しない。
 * @concurrency 現在Processの接続状態だけを表示する。
 */
function Connection({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const connection = model.connection;
  return (
    <WorkbenchPanel
      id="connection"
      eyebrow="Remote CROS"
      title="接続"
      status={
        connection.state === "repository"
          ? "Repository mode"
          : connection.state === "cros_available"
            ? "Connected"
            : "Unavailable"
      }
    >
      {connection.notice === null ? null : (
        <p
          className="operation-result"
          data-status={connection.notice.status}
        >
          {connection.notice.message}
        </p>
      )}
      {connection.endpoint === null ? (
        <EmptyState>
          CredentialなしでRepository単体利用を継続できます。Remote CROSを使う場合だけ接続してください。
        </EmptyState>
      ) : (
        <>
          <p>
            Endpoint: <code>{connection.endpoint}</code>
          </p>
          <div className="connection-actions">
            {(["refresh", "disconnect"] as const).map((operation) => (
              <form key={operation} method="post" action="/connection/action">
                <ActionTokenInput value={model.actionToken} />
                <button name="operation" value={operation} type="submit">
                  {operation === "refresh" ? "Refresh projection" : "Disconnect"}
                </button>
              </form>
            ))}
          </div>
        </>
      )}
      <form
        className="remote-connection-form"
        method="post"
        action="/connection/action"
        autoComplete="off"
      >
        <ActionTokenInput value={model.actionToken} />
        <input type="hidden" name="operation" value="connect" />
        <label>
          Endpoint
          <input required type="url" name="baseUrl" autoComplete="off" />
        </label>
        <label>
          Credential
          <input
            required
            type="password"
            name="token"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit">Connect</button>
      </form>
    </WorkbenchPanel>
  );
}

/**
 * Credential管理の安全なMetadataと一回表示結果を描画する。
 * @responsibility Profile別発行・更新・失効と生Tokenの一回表示を分ける。
 * @trace ARCH-000013
 * @input modelにCredential Metadataと直前結果を受け取る。
 * @returns Credential Administration Panelを返す。
 * @precondition 管理Contextの有無はServerで確定済みである。
 * @postcondition 生Tokenは対象操作直後の結果だけに表示する。
 * @effect 明示送信時だけCredential CommandをPOSTする。
 * @failure 未構成・利用不可を空一覧として扱わない。
 * @invariant Registryのverifier、salt、Authorityを受け取らない。
 * @boundary Credential Applicationと管理者Browserの境界。
 * @security 生Tokenを永続・再取得・URL反射しない。
 * @concurrency 更新は同一Credential Identityの最新結果だけを表示する。
 */
function Credentials({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const view = model.credentials;
  return (
    <WorkbenchPanel
      id="credential-administration"
      eyebrow="CROS administration"
      title="接続資格の管理"
      status={
        view.state === "available"
          ? `${view.credentials.length} credentials`
          : view.state === "not_configured"
            ? "Not configured"
            : "Unavailable"
      }
    >
      {view.result?.token === null || view.result === null ? null : (
        <div className="one-time-token">
          <span>このTokenは今回だけ表示されます。</span>
          <code>{view.result.token}</code>
        </div>
      )}
      {view.state !== "available" ? (
        <EmptyState>
          {view.state === "not_configured"
            ? "Repository単体利用ではCredentialは不要です。"
            : "現在の接続資格にはCredential管理Capabilityがありません。"}
        </EmptyState>
      ) : (
        <>
        <form className="credential-issue" method="post" action="/connection-credentials/action">
          <ActionTokenInput value={model.actionToken} />
          <input type="hidden" name="operation" value="issue" />
          <label>Profile<select name="profile"><option value="developer">Developer</option><option value="management">Management</option><option value="administrator">Administrator</option></select></label>
          <p>Profileは発行時の初期値です。実効権限は保存されたWorkspace GrantとSystem Adminで決まります。</p>
          <button type="submit">Issue credential</button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Credential</th>
                <th>Profile</th>
                <th>Workspaces</th>
                <th>Admin</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {view.credentials.map((credential) => (
                <tr key={credential.credentialId}>
                  <td>
                    <code>{credential.credentialId}</code>
                  </td>
                  <td>{credential.profile}</td>
                  <td>{credential.workspaceIds.join(", ") || "N/A"}</td>
                  <td>{credential.systemAdmin ? "Yes" : "No"}</td>
                  <td>{credential.revoked ? "Revoked" : "Active"}</td>
                  <td>
                    <form method="post" action="/connection-credentials/action">
                      <ActionTokenInput value={model.actionToken} />
                      <input type="hidden" name="credentialId" value={credential.credentialId} />
                      <label>Workspaces<input name="workspaceIds" defaultValue={credential.workspaceIds.join(", ")} /></label>
                      <label className="confirm"><input type="checkbox" name="systemAdmin" value="true" defaultChecked={credential.systemAdmin} />System admin</label>
                      <button name="operation" value="update_access" type="submit">Update</button>
                      <button name="operation" value="rotate" type="submit" disabled={credential.revoked}>Rotate</button>
                      <button name="operation" value="revoke" type="submit" disabled={credential.revoked}>Revoke</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </WorkbenchPanel>
  );
}

/**
 * Repository単体またはCROS PortfolioのProject入口を表示する。
 * @responsibility 検索・状態・CursorとSource別Project導線を表示する。
 * @trace ARCH-000012
 * @input modelに許可済みPortfolio投影を受け取る。
 * @returns Portfolio Panelを返す。
 * @precondition Project集合はServerでExposure確定済みである。
 * @postcondition 欠測Sourceを完全状態に畳まない。
 * @effect Form送信時だけGET Navigationを発行する。
 * @failure 不正CursorはServerの拒否結果を維持する。
 * @invariant BrowserでProjectを追加・除外しない。
 * @boundary Federated PortfolioとProject選択の境界。
 * @security 開示済みProjectだけを表示する。
 * @concurrency Queryに拘束したCursorを維持する。
 */
function Portfolio({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const portfolio = model.portfolio;
  const projects = portfolio?.projects ?? [];
  return (
    <WorkbenchPanel
      id="portfolio"
      eyebrow="Project portfolio"
      title="Projectを選ぶ"
      status={portfolio === null ? "Repository mode" : "CROS federation"}
    >
      {portfolio === null ? (
        <ul>
          <li>
            <strong>{model.surface.context.projectId}</strong>
            <p>
              {model.surface.context.repositoryId} / {model.surface.context.repositoryRole}
            </p>
            <small>現在のRepository Contextだけを表示</small>
          </li>
        </ul>
      ) : (
        <>
          <form className="collection-controls" method="get" action="/">
            <label>
              Project検索
              <input
                name="portfolioQuery"
                defaultValue={model.portfolioQuery.query}
              />
            </label>
            <label>
              状態
              <select
                name="portfolioState"
                defaultValue={model.portfolioQuery.state}
              >
                <option value="">すべて</option>
                <option value="complete">complete</option>
                <option value="partial">partial</option>
                <option value="conflicting">conflicting</option>
              </select>
            </label>
            <button type="submit">絞り込む</button>
          </form>
          {model.portfolioPage.cursorInvalid ? <EmptyState>検索条件と継続位置が一致しません。先頭から絞り込み直してください。</EmptyState> : null}
          {projects.length === 0 ? (
            <EmptyState>
              現在の接続資格から表示できるProjectはありません。非開示Projectの存在や件数は表示しません。
            </EmptyState>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project.projectId}>
                  <strong>
                    <a href={`/project?id=${encodeURIComponent(project.projectId)}`}>
                      {project.projectId}
                    </a>
                  </strong>
                  <p>
                    {project.sources
                      .map((source) => `${source.repositoryId}: ${source.state}`)
                      .join(" / ")}
                  </p>
                  <small>
                    {project.state} / {project.sources.length} visible sources
                  </small>
                </li>
              ))}
            </ul>
          )}
          {model.portfolioPage.nextCursor === null ? null : <a className="page-link" href={`/?portfolioQuery=${encodeURIComponent(model.portfolioQuery.query)}&portfolioState=${encodeURIComponent(model.portfolioQuery.state)}&portfolioCursor=${encodeURIComponent(model.portfolioPage.nextCursor)}#portfolio`}>次のProject</a>}
        </>
      )}
    </WorkbenchPanel>
  );
}

/**
 * Repositoryの現在差分と許可済み操作を表示する。
 * @responsibility Tree、Prepared／Working DiffとStage／Unstage／Commit／Push入口を分ける。
 * @trace ARCH-000012
 * @input modelにServer観測済みWorktreeを受け取る。
 * @returns Repository Panelを返す。
 * @precondition Pathと差分はVersion Control Adapterで検証済みである。
 * @postcondition PreparedとWorkingを視覚的に区別する。
 * @effect 明示送信時だけVersion Control CommandをPOSTする。
 * @failure 観測不能を差分0と表示しない。
 * @invariant Force・暗黙Commit・暗黙Pushを追加しない。
 * @boundary Browser操作とVersion Control Portの境界。
 * @security 検証済みRepository相対Pathだけを送る。
 * @concurrency 送信時の再観測とServer競合判定を維持する。
 */
function Repository({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const repository = model.surface.repository;
  if (repository.state === "unknown" || repository.changeSet === null)
    return (
      <WorkbenchPanel
        id="repository"
        eyebrow="Repository"
        title="作業ツリー"
        status="Unknown"
      >
        <EmptyState>
          Gitの現在状態を完全に観測できません。Cleanとして扱いません。
        </EmptyState>
      </WorkbenchPanel>
    );
  const groups = [
    ["Staged", "unprepare", repository.changeSet.preparedChanges],
    ["Working", "prepare", repository.changeSet.workingChanges],
    ["Untracked", "prepare", repository.changeSet.unregisteredPaths],
  ] as const;
  const count = groups.reduce((sum, [, , paths]) => sum + paths.length, 0);
  const target = repository.publicationTarget;
  const tree = model.worktree.tree;
  const diff = model.worktree.diff;
  return (
    <WorkbenchPanel
      id="repository"
      eyebrow="Repository"
      title="作業ツリー"
      status={`${count} changes`}
    >
      {model.repositoryResult === null ? null : (
        <p
          className="operation-result"
          data-status={model.repositoryResult.status}
        >
          <strong>{model.repositoryResult.status}</strong>{" "}
          {model.repositoryResult.reason}
        </p>
      )}
      <section className="repository-browser">
        <h3>Repository Tree／Diff</h3>
        {model.worktree.state === "unknown" || tree === null ? (
          <EmptyState>TreeまたはDiffを完全に観測できません。空Repositoryとして扱いません。</EmptyState>
        ) : (
          <>
            <nav className="repository-breadcrumb">
              {tree.directory.length === 0 ? <strong>Repository root</strong> : <><a href={`/?treeDirectory=${encodeURIComponent(tree.directory.includes("/") ? tree.directory.slice(0, tree.directory.lastIndexOf("/")) : "")}#repository`}>← Repository root</a><strong>{tree.directory}</strong></>}
            </nav>
            {tree.entries.length === 0 ? <EmptyState>このDirectoryの表示対象は0件です。</EmptyState> : <ul className="repository-tree">{tree.entries.map((entry) => <li key={entry.path}><a href={entry.kind === "directory" ? `/?treeDirectory=${encodeURIComponent(entry.path)}#repository` : `/?treeDirectory=${encodeURIComponent(tree.directory)}&diffPath=${encodeURIComponent(entry.path)}#repository`}><span aria-hidden="true">{entry.kind === "directory" ? "▸" : "·"}</span><code>{entry.name}</code></a><small>{[entry.prepared ? "staged" : "", entry.working ? "working" : "", entry.unregistered ? "untracked" : ""].filter(Boolean).join(" / ") || "unchanged"}</small></li>)}</ul>}
            {tree.nextCursor === null ? null : <a className="page-link" href={`/?treeDirectory=${encodeURIComponent(tree.directory)}&treeCursor=${encodeURIComponent(tree.nextCursor)}#repository`}>次のEntry</a>}
            {diff === null ? <EmptyState>Fileを選択するとPrepared／Working差分を表示します。</EmptyState> : <section className="repository-diff"><h4><code>{diff.path}</code></h4>{diff.unregistered ? <EmptyState>未追跡Fileの内容は自動読取りしません。Stage後にPrepared差分として確認してください。</EmptyState> : null}<h5>Prepared</h5><pre>{diff.preparedPatch || "差分なし"}</pre>{diff.preparedTruncated ? <small>表示上限で切り詰めました。</small> : null}<h5>Working</h5><pre>{diff.workingPatch || "差分なし"}</pre>{diff.workingTruncated ? <small>表示上限で切り詰めました。</small> : null}</section>}
          </>
        )}
      </section>
      {groups.map(([label, operation, paths]) => (
        <section className="repository-group" key={label}>
          <h3>
            {label} <span>{paths.length}</span>
          </h3>
          {paths.length === 0 ? (
            <EmptyState>0 files</EmptyState>
          ) : (
            <ul>
              {paths.map((entry) => (
                <li key={entry}>
                  <code>{entry}</code>
                  <form method="post" action="/repository/action">
                    <ActionTokenInput value={model.actionToken} />
                    <input type="hidden" name="operation" value={operation} />
                    <input type="hidden" name="path" value={entry} />
                    <button type="submit">
                      {operation === "prepare" ? "Stage" : "Unstage"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <form method="post" action="/repository/action">
        <ActionTokenInput value={model.actionToken} />
        <input type="hidden" name="operation" value="create_revision" />
        <label>
          Commit message
          <input required maxLength={4096} name="message" />
        </label>
        <button type="submit">Commit staged changes</button>
      </form>
      {target?.status === "available" && target.destination !== null && target.branch !== null && target.revisionIdentity !== null ? (
        <form method="post" action="/repository/action">
          <ActionTokenInput value={model.actionToken} />
          <input type="hidden" name="operation" value="publish_revision" />
          <input type="hidden" name="destination" value={target.destination} />
          <input type="hidden" name="branch" value={target.branch} />
          <input type="hidden" name="revisionIdentity" value={target.revisionIdentity} />
          <dl className="publication-target"><div><dt>Remote</dt><dd>{target.destination}</dd></div><div><dt>Branch</dt><dd>{target.branch}</dd></div><div><dt>Commit</dt><dd><code>{target.revisionIdentity}</code></dd></div></dl>
          <label className="confirm"><input required type="checkbox" name="humanConfirmed" value="true" />表示したRemote・Branch・Commitを確認しました</label>
          <button type="submit">Normal push</button>
        </form>
      ) : <section className="publication-unavailable"><h3>Normal push</h3><EmptyState>公開先を確認できません（{target?.reason ?? "publication_target_observation_failed"}）。RemoteやBranchを推測して公開しません。</EmptyState></section>}
    </WorkbenchPanel>
  );
}

/**
 * Project Runtimeの現在状態とEventを成功・不在・不明の区別付きで表示する。
 * @responsibility Runtime Activityの状態、Eventと回復参照を一貫表示する。
 * @trace ARCH-000012
 * @input modelにRuntime Activity Snapshotを受け取る。
 * @returns Runtime Panelを返す。
 * @precondition EventはProject範囲と上限をServerで確定済みである。
 * @postcondition 観測不能と0件を区別する。
 * @effect N/A: 表示要素の構築だけを行う。
 * @failure unknownをidleまたはcompletedへ畳まない。
 * @invariant Runtime AuthorityをBrowserで所有しない。
 * @boundary Runtime Activity Read ModelとBrowser表示の境界。
 * @security Host Path、Credential、生Provider出力を表示しない。
 * @concurrency Serverが確定したSnapshot順序を保つ。
 */
function RuntimeActivity({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const observation = model.runtimeActivity;
  return (
    <WorkbenchPanel
      id="runtime-activity"
      eyebrow="Runtime activity"
      title="現在の実行状況"
      status={observation?.state ?? "Not connected"}
    >
      {observation === null ? (
        <EmptyState>Project Runtime観測は未接続です。</EmptyState>
      ) : observation.state !== "observed" || observation.projection === null ? (
        <EmptyState>
          Runtime状態を現在値として観測できません: {observation.reason}
        </EmptyState>
      ) : (
        <>
          <dl className="quality-facts">
            <div>
              <dt>Milestone</dt>
              <dd>{observation.projection.milestoneId}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{observation.projection.milestoneState}</dd>
            </div>
            <div>
              <dt>Work progress</dt>
              <dd>{observation.projection.workProgress}</dd>
            </div>
            <div>
              <dt>Next action</dt>
              <dd>{observation.projection.nextAction}</dd>
            </div>
          </dl>
          {observation.eventState !== "observed" ? (
            <EmptyState>
              実行履歴を完全に観測できません: {observation.eventReason}
            </EmptyState>
          ) : (
            <ul>
              {observation.events.map((event) => (
                <li key={event.eventId}>
                  <strong>{event.status}</strong> {event.reason}
                  <small>
                    {event.occurredAt} / {event.objectiveId} / {event.taskId}
                  </small>
                </li>
              ))}
            </ul>
          )}
          {observation.eventContinuation === null ? null : (
            <a
              className="page-link"
              href={`/?runtimeCursor=${encodeURIComponent(observation.eventContinuation)}#runtime-activity`}
            >
              次の実行履歴
            </a>
          )}
        </>
      )}
    </WorkbenchPanel>
  );
}

/**
 * AI Profile設定と現在観測を別の列で表示する。
 * @responsibility ConfiguredとAvailableを混同せずProfile別に示す。
 * @trace ARCH-000010
 * @input modelにCatalogと利用可能性観測を受け取る。
 * @returns AI Profile Panelを返す。
 * @precondition CatalogはAI Runtimeで検証済みである。
 * @postcondition 未観測軸をunknownと表示する。
 * @effect N/A: 表示要素の構築だけを行う。
 * @failure 設定済みを実行可能へ変換しない。
 * @invariant Profile Identityとexact Modelを再解釈しない。
 * @boundary AI Profile CatalogとBrowser表示の境界。
 * @security Credential・Provider Home・Host Pathを表示しない。
 * @concurrency N/A: 不変Snapshotを描画する。
 */
function AiProfiles({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const observations = new Map(
    model.aiProfiles.observations.map((entry) => [entry.profileId, entry.availability]),
  );
  return (
    <WorkbenchPanel
      id="ai-profiles"
      eyebrow="AI configuration"
      title="AI Profiles"
      status={`${model.aiProfiles.catalog.profiles.length} configured`}
    >
      <p className="scene-summary">Configuredは実行可能を意味しません。Adapter登録、Host利用可能性、認証および実行Authorityを別々に表示します。</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Adapter</th>
              <th>Model</th>
              <th>Reasoning</th>
              <th>Availability axes</th>
            </tr>
          </thead>
          <tbody>
            {model.aiProfiles.catalog.profiles.map((profile) => {
              const availability = observations.get(profile.profileId);
              return (
                <tr key={profile.profileId}>
                  <td>
                    <code>{profile.profileId}</code>
                  </td>
                  <td>{profile.adapterId}</td>
                  <td>{profile.exactModelId}</td>
                  <td>{profile.defaultReasoningEffort}</td>
                  <td>
                    {availability === undefined
                      ? "unknown"
                      : `adapter=${String(availability.adapterRegistered)}, host=${String(availability.hostAvailable)}, auth=${String(availability.authenticated)}, authority=${String(availability.executionAuthorized)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </WorkbenchPanel>
  );
}

/**
 * Owner別AI Profileの作成・更新入口を描画する。
 * @responsibility RepositoryまたはCROS OwnerのCatalog変更を改訂付きFormで表示する。
 * @trace ARCH-000010
 * @input modelにOwner別Snapshotと直前結果を受け取る。
 * @returns AI Profile Administration Panelまたはnullを返す。
 * @precondition 管理SnapshotのOwnerはServerで確定済みである。
 * @postcondition 登録済みAdapter／Model語彙だけを候補にする。
 * @effect 明示送信時だけProfile CommandをPOSTする。
 * @failure 未接続時は管理入口を作らない。
 * @invariant OwnerをBrowser側で切り替えない。
 * @boundary AI Profile AdministrationとBrowser Formの境界。
 * @security Credential・Path・任意実行引数を入力できない。
 * @concurrency expectedRevisionでCatalog競合を検出できる。
 */
function AiProfileAdministration({
  model,
}: {
  model: WorkbenchMainViewModel;
}): ReactElement | null {
  const { snapshot, owner, result } = model.aiProfileAdministration;
  if (snapshot === null) return null;
  const efforts = [...new Set(snapshot.catalog.adapters.flatMap((adapter) => adapter.allowedReasoningEfforts))];
  return (
    <WorkbenchPanel
      id="ai-profile-administration"
      eyebrow={`${owner} configuration`}
      title="AI Profile管理"
      status={`revision ${snapshot.revision}`}
    >
      {result === null ? null : (
        <p className="operation-result">
          <strong>{result.status}</strong> — {result.reason}
        </p>
      )}
      <form
        className="ai-profile-administration-form"
        method="post"
        action="/ai-profiles/action"
      >
        <ActionTokenInput value={model.actionToken} />
        <input
          type="hidden"
          name="expectedRevision"
          value={snapshot.revision}
        />
        <label>
          操作
          <select name="operation" required>
            <option value="create">新規作成</option>
            <option value="update">既存を更新</option>
          </select>
        </label>
        <label>
          Profile ID
          <input name="profileId" pattern="PROFILE-[0-9]{6,}" required />
        </label>
        <label>
          Adapter / Model
          <select name="adapterModel" required>
            {snapshot.catalog.adapters.flatMap((adapter) =>
              adapter.allowedModelIds.map((modelId) => (
                <option
                  key={`${adapter.adapterId}|${modelId}`}
                  value={`${adapter.adapterId}|${modelId}`}
                >
                  {adapter.adapterId} / {modelId}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          Family
          <input name="family" pattern="[a-z][a-z0-9._-]{1,63}" required />
        </label>
        <fieldset><legend>利用Role</legend>{["coordinator", "executor", "independent_reviewer", "result_integration"].map((role) => <label key={role} className="confirm"><input type="checkbox" name="selectionRole" value={role} />{role}</label>)}</fieldset>
        <fieldset><legend>Model Tier</legend>{["preferred", "upper_allowed"].map((tier) => <label key={tier} className="confirm"><input type="checkbox" name="modelTier" value={tier} />{tier}</label>)}</fieldset>
        <label>既定Reasoning<select name="defaultReasoningEffort" required>{efforts.map((effort) => <option key={effort} value={effort}>{effort}</option>)}</select></label>
        <label>互換理由（不要なら空欄）<input name="compatibilityReason" /></label>
        <button type="submit">Catalog候補を検証して保存</button>
      </form>
      <div className="table-scroll"><table><thead><tr><th>Profile</th><th>Adapter / Model</th><th>Actions</th></tr></thead><tbody>{snapshot.catalog.profiles.map((profile) => <tr key={profile.profileId}><td><code>{profile.profileId}</code></td><td>{profile.adapterId} / {profile.exactModelId}</td><td><form method="post" action="/ai-profiles/action"><ActionTokenInput value={model.actionToken} /><input type="hidden" name="operation" value="delete" /><input type="hidden" name="expectedRevision" value={snapshot.revision} /><input type="hidden" name="profileId" value={profile.profileId} /><label className="confirm"><input type="checkbox" name="confirmed" value="true" required />このProfileだけを削除する</label><button type="submit">削除</button></form></td></tr>)}</tbody></table></div>
    </WorkbenchPanel>
  );
}

/**
 * Main View Modelを既存15画面のReact Treeへ変換する。
 * @responsibility 主画面のCompositionとHash NavigationのActive状態を所有する。
 * @trace ARCH-000012
 * @input modelに閉じたMain View Modelを受け取る。
 * @returns Workbench MainのReact Treeを返す。
 * @precondition modelはRuntime Inspectorで必須外形を検査済みである。
 * @postcondition 15 Logical Screenと現在HashのActive Navigationを表示する。
 * @effect hashchange Listenerをmount中だけ登録する。
 * @failure 不明Hashは業務状態へ反映せず、次の正常Hashで回復できる。
 * @invariant ビジネス状態・Authority・EffectをBrowserで生成しない。
 * @boundary Main JSON ModelとBrowser DOM・URL Hashの境界。
 * @security HashをAuthorityまたはRepository入力として使用しない。
 * @concurrency Listenerをcleanupし、現在Hashの最新値だけを反映する。
 */
function MainWorkbench({ model }: { model: WorkbenchMainViewModel }): ReactElement {
  const [activeSection, setActiveSection] = useState(() =>
    window.location.hash.replace(/^#/u, "") || "overview",
  );
  useEffect(() => {
    const synchronizeActiveSection = () =>
      setActiveSection(window.location.hash.replace(/^#/u, "") || "overview");
    window.addEventListener("hashchange", synchronizeActiveSection);
    return () => window.removeEventListener("hashchange", synchronizeActiveSection);
  }, []);
  const context = model.surface.context;
  const capabilityLabel = (state: "available" | "not_configured" | "unknown", count: number): string =>
    state === "available" ? `${count} items` : state === "not_configured" ? "Not configured" : "Unknown";
  const refresh =
    model.connection.endpoint === null ? (
      <button type="button" disabled>
        Refresh projection
      </button>
    ) : (
      <form method="post" action="/connection/action">
        <ActionTokenInput value={model.actionToken} />
        <button name="operation" value="refresh" type="submit">
          Refresh projection
        </button>
      </form>
    );
  return (
    <WorkbenchShell
      projectId={context.projectId}
      repositoryId={context.repositoryId}
      repositoryRole={context.repositoryRole}
      connectionLabel={
        model.connection.state === "repository"
          ? "Repository mode"
          : model.connection.state === "cros_available"
            ? "Remote CROS connected"
            : "Remote CROS unavailable"
      }
      topicsLabel={capabilityLabel(model.topic.collection.state, model.topic.page.records.length)}
      topicsDetail={model.selectedRepositoryId ?? "未構成と0件を区別します"}
      meetingsLabel={capabilityLabel(model.meeting.collection.state, model.meeting.page.records.length)}
      meetingsDetail={model.selectedRepositoryId ?? "未構成と0件を区別します"}
      logoPath={model.logoPath}
      activeSection={activeSection}
      clientReady={true}
      refresh={refresh}
      content={
        <Fragment>
          <Portfolio model={model} />
          {context.scenes.map((scene) => (
            <ProjectScene key={scene.key} scene={scene} />
          ))}
          <RecordCollection model={model} kind="topic" />
          <RecordCollection model={model} kind="meeting" />
          {renderWorkbenchProjectPlan(model.surface.plan, model.surface.ownerArtifacts)}
          {renderWorkbenchQuality(model.surface.quality, model.surface.ownerArtifacts)}
          <OwnerArtifacts model={model} />
          <RuntimeActivity model={model} />
          <Repository model={model} />
          <Connection model={model} />
          <Credentials model={model} />
          <AiProfiles model={model} />
          <AiProfileAdministration model={model} />
          {renderWorkbenchAiRequest(
            model.actionToken,
            model.aiProfiles,
            model.aiRequest.configured,
            model.aiRequest.snapshot,
            model.aiRequest.candidateConfigured,
            model.aiRequest.candidateReview,
            model.aiRequest.candidateAction,
            model.aiRequest.notice,
          )}
        </Fragment>
      }
    />
  );
}

/**
 * Federated ProjectをSourceごとの五場面へ展開する。
 * @responsibility Project DetailのCoverageと欠測をSourceごとに示す。
 * @trace ARCH-000012
 * @input modelに一件の許可済みFederated Projectを受け取る。
 * @returns Project DetailのReact要素を返す。
 * @precondition Projectは現在PrincipalのExposure内である。
 * @postcondition Source別の五場面と観測境界を表示する。
 * @effect N/A: 表示要素の構築だけを行う。
 * @failure 欠測を「なし」へ畳まない。
 * @invariant Project Contextの正本を所有しない。
 * @boundary Federated Project Read ModelとBrowser表示の境界。
 * @security 開示済みSourceだけを表示する。
 * @concurrency N/A: 不変Snapshotを描画する。
 */
function ProjectDetail({
  model,
}: {
  model: WorkbenchProjectDetailViewModel;
}): ReactElement {
  return (
    <main className="record-detail">
      <a className="page-link" href="/#portfolio">
        ← Project Portfolioへ戻る
      </a>
      <article className="panel">
        <header>
          <div>
            <p className="eyebrow">Federated project</p>
            <h1>{model.project.projectId}</h1>
          </div>
          <span>{model.project.state}</span>
        </header>
        <p>
          許可済みRepository Sourceごとの五場面を表示します。Source間の欠測・競合を一つの完全状態へ統合しません。
        </p>
      </article>
      {model.project.sources.map((source) => (
        <section className="portfolio-source" key={source.repositoryId}>
          <header>
            <div>
              <p className="eyebrow">Repository source</p>
              <h2>{source.repositoryId}</h2>
            </div>
            <span>{source.state}</span>
          </header>
          <p>
            {source.repositoryRole ?? "Role unavailable"} / revision {source.revision}
          </p>
          {source.context === null ? (
            <EmptyState>このSourceのProject Contextは利用できません。</EmptyState>
          ) : (
            source.context.scenes.map((scene) => (
              <ProjectScene key={scene.key} scene={scene} />
            ))
          )}
        </section>
      ))}
    </main>
  );
}

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
function RecordDetail({
  model,
}: {
  model: WorkbenchRecordDetailViewModel;
}): ReactElement {
  const { document, relations } = model.record;
  const record = document.record;
  const identity = "topicId" in record ? record.topicId : record.meetingId;
  return (
    <main className="record-detail" id={`${model.record.kind}-detail`}>
      <a
        className="page-link"
        href={`${model.repositoryId === null ? "/" : `/?repositoryId=${encodeURIComponent(model.repositoryId)}`}#${model.record.kind === "topic" ? "topics" : "meetings"}`}
      >
        ← {model.record.kind === "topic" ? "Topics" : "Meetings"}へ戻る
      </a>
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
                    <a href={relation.kind === "topic" || relation.kind === "meeting" ? `/${relation.kind}?id=${encodeURIComponent(relation.id)}${relation.ownerRepositoryId === null || relation.ownerRepositoryId === undefined ? "" : `&repositoryId=${encodeURIComponent(relation.ownerRepositoryId)}`}` : `/change?id=${encodeURIComponent(relation.id)}`}><code>{relation.id}</code></a>
                  ) : <code>{relation.id}</code>} <span>{relation.state === "available" ? relation.kind : relation.state === "conflicting" ? "参照先が競合" : relation.state === "unavailable" ? "参照可否を確認できません" : "参照先なし"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Canonical Markdown</h2>
          <pre className="canonical-markdown">{document.markdown}</pre>
        </section>
        <RecordActions
          actionToken={model.actionToken}
          repositoryId={model.repositoryId}
          document={model.record}
        />
      </article>
    </main>
  );
}

/**
 * Client ModelのView判別後に唯一のWorkbench Appを返す。
 * @responsibility 検査済みDiscriminantを対応するTop-level Screenへ一意に接続する。
 * @trace ARCH-000012
 * @input modelに検査済みWorkbench Client Modelを受け取る。
 * @returns viewに対応するReact要素を返す。
 * @precondition modelのcontractとviewはRuntime検査済みである。
 * @postcondition 一つのViewだけを描画する。
 * @effect N/A: 要素選択だけを行う。
 * @failure 未知viewはInspectorで事前拒否される。
 * @invariant View判別で業務状態を変更しない。
 * @boundary Client Model UnionとTop-level React Screenの境界。
 * @security 任意Component名やHTMLを入力から解決しない。
 * @concurrency N/A: 同期純粋分岐である。
 */
export function WorkbenchApp({ model }: { model: WorkbenchClientModel }): ReactElement {
  if (model.view === "project-detail") return <ProjectDetail model={model} />;
  if (model.view === "record-detail") return <RecordDetail model={model} />;
  return <MainWorkbench model={model} />;
}
