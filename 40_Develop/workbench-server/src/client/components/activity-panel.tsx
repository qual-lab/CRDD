/**
 * WorkbenchのRuntimeActivityを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import { EmptyState, WorkbenchPanel } from "./elements.ts";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";

/**
 * Orchestratorの現在状態とEventを成功・不在・不明の区別付きで表示する。
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
export function RuntimeActivity({
  model,
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
  const observation = model.runtimeActivity;
  return (
    <WorkbenchPanel
      id="runtime-activity"
      eyebrow="Runtime activity"
      title="現在の実行状況"
      status={observation?.state ?? "Not connected"}
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
      {observation === null ? (
        <EmptyState>Orchestrator観測は未接続です。</EmptyState>
      ) : observation.state !== "observed" ||
        observation.projection === null ? (
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
