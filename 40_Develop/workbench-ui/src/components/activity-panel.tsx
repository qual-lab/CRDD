/**
 * WorkbenchのExecutionActivityを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ExecutionActivityObservation } from "@qual-lab/crdd-server";
import { type ReactElement, useEffect, useState } from "react";
import { readExecutionActivityPage } from "../api/view.ts";
import { EmptyState, WorkbenchPanel } from "./elements.ts";

/** 明示の画面更新・対象・履歴ページごとに活動だけを取り直す。 */
export function RepositoryExecutionActivity({
  repositoryId,
  projectId,
  browserSession,
  cursor,
  refresh,
}: {
  repositoryId: string;
  projectId: string;
  browserSession: boolean;
  cursor: string;
  refresh: string;
}): ReactElement {
  const scope = JSON.stringify([
    repositoryId,
    projectId,
    browserSession,
    cursor,
    refresh,
  ]);
  const [observed, setObserved] = useState<{
    scope: string;
    value: ExecutionActivityObservation | null;
  } | null>(null);
  useEffect(() => {
    const owner = new AbortController();
    const publish = (value: ExecutionActivityObservation | null) => {
      if (!owner.signal.aborted) setObserved({ scope, value });
    };
    void readExecutionActivityPage(
      repositoryId,
      projectId,
      cursor,
      owner.signal,
      browserSession,
    ).then(publish, () => publish(null));
    return () => owner.abort();
  }, [repositoryId, projectId, browserSession, cursor, scope]);
  const current = observed?.scope === scope ? observed : null;
  return (
    <ExecutionActivity
      observation={current?.value ?? null}
      waiting={current === null}
      repositoryId={browserSession ? repositoryId : null}
    />
  );
}

/**
 * Coordinatorの現在状態とEventを成功・不在・不明の区別付きで表示する。
 * @responsibility Runtime Activityの状態、Eventと回復参照を一貫表示する。
 * @trace ARCH-000012
 * @input 専用APIから受理した活動データと、取得中かどうか。
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
export function ExecutionActivity({
  observation,
  waiting = false,
  repositoryId = null,
}: {
  observation: ExecutionActivityObservation | null;
  waiting?: boolean;
  repositoryId?: string | null;
}): ReactElement {
  const graphs = observation?.graphs ?? [];
  const [selection, setSelection] = useState("");
  const graphKey = (graph: (typeof graphs)[number]) =>
    JSON.stringify([graph.repositoryId, graph.queueId]);
  const selected =
    graphs.find((graph) => graphKey(graph) === selection) ??
    (selection === "" && graphs.length === 1 ? graphs[0] : undefined);
  const choosingGraph = selection !== "" || graphs.length > 0;
  const progress = choosingGraph ? selected?.progress : observation?.projection;
  const milestoneId = choosingGraph
    ? selected?.milestoneId
    : observation?.projection?.milestoneId;
  return (
    <WorkbenchPanel
      id="runtime-activity"
      eyebrow="Runtime activity"
      title="現在の実行状況"
      status={
        graphs.length > 0
          ? selected
            ? (progress?.milestoneState ?? "観測不能")
            : "実行を選択"
          : (observation?.state ?? (waiting ? "取得中" : "観測不能"))
      }
    >
      {(observation?.singleTasks ?? []).length ? (
        <section>
          <h3>単発のAI依頼</h3>
          <ul>
            {observation?.singleTasks?.map((task) => (
              <li key={`${task.repositoryId}:${task.requestId}`}>
                {task.mode === "read_only_advice" ? "助言" : "Workspace編集"}:{" "}
                {task.phase} / {task.status} —{" "}
                {task.cleanupConfirmed ? "回収確認済み" : "回収未確認"}
                {task.recoveryRequired ? "（回復待ち）" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {graphs.length > 0 && (
        <label>
          実行
          <select
            value={selected ? graphKey(selected) : ""}
            onChange={(event) => setSelection(event.target.value)}
          >
            {(graphs.length > 1 || !selected) && (
              <option value="">実行を選択</option>
            )}
            {graphs.map((graph) => (
              <option key={graphKey(graph)} value={graphKey(graph)}>
                {graph.milestoneId} / {graph.workspaceId ?? "Workspace未指定"} /{" "}
                {graph.repositoryId} / {graph.queueId}
              </option>
            ))}
          </select>
        </label>
      )}
      {observation === null ? (
        <EmptyState>
          {waiting
            ? "実行活動を取得しています。"
            : "実行活動を確認できません。"}
        </EmptyState>
      ) : choosingGraph && !selected ? (
        <EmptyState>
          {graphs.length > 0
            ? "状態を表示する実行を選択してください。"
            : "選択した実行は現在の一覧にありません。"}
        </EmptyState>
      ) : !progress ? (
        <EmptyState>
          {selected
            ? "選択した実行の状態を確認できません。"
            : `実行状態を現在値として観測できません: ${observation.reason}`}
        </EmptyState>
      ) : (
        <dl className="quality-facts">
          <div>
            <dt>Milestone</dt>
            <dd>{milestoneId}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{progress.milestoneState}</dd>
          </div>
          <div>
            <dt>Work progress</dt>
            <dd>{progress.workProgress}</dd>
          </div>
          <div>
            <dt>Next action</dt>
            <dd>{progress.nextAction}</dd>
          </div>
        </dl>
      )}
      {observation && (
        <section>
          <h3>Project全体の実行履歴</h3>
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
              href={`/?${new URLSearchParams({ ...(repositoryId !== null && { repositoryId }), activityCursor: observation.eventContinuation })}#runtime-activity`}
            >
              次の実行履歴
            </a>
          )}
        </section>
      )}
    </WorkbenchPanel>
  );
}
