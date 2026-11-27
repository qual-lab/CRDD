/**
 * WorkbenchのMainWorkbenchを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import {
  type FormEvent,
  Fragment,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import { requestWorkbench } from "../api/connection.ts";
import { requestAiRequestAction } from "../api/mutations.ts";
import { readWorkbenchQuery } from "../api/queries.ts";
import type {
  AiRequestSnapshot,
  MainViewResponse,
  RecordActionView,
} from "../api/response.ts";
import { validateViewResponse } from "../api/response.ts";
import {
  composeWorkbenchRecordDisplay,
  createSelectedWorkbenchViewUrl,
  readCurrentAiRequest,
  readWorkbenchDisplayQuery,
} from "../api/view.ts";
import { RepositoryExecutionActivity } from "../components/activity-panel.tsx";
import { renderWorkbenchAiRequest } from "../components/ai-request-panel.tsx";
import { AiSelection } from "../components/ai-selection.tsx";
import { AiSelectionManagementPanel } from "../components/ai-selection-management-panel.tsx";
import { Connection, GitHostConnections } from "../components/connection.tsx";
import { WorkbenchPanel } from "../components/elements.ts";
import { Portfolio } from "../components/portfolio-panel.tsx";
import { ProjectScene } from "../components/project-context.tsx";
import {
  renderWorkbenchProjectPlan,
  renderWorkbenchQuality,
} from "../components/projection-panels.tsx";
import { RecordOperationPanel } from "../components/record-operation-panel.tsx";
import { OwnerArtifacts, RecordCollection } from "../components/records.tsx";
import { RepositoryOperationPanel } from "../components/repository-operation-panel.tsx";
import { Repository } from "../components/repository-panel.tsx";
import { WorkbenchShell } from "../components/shell.ts";
import { WorkspacePanel } from "../components/workspace-panel.tsx";

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
export function MainWorkbench({
  model: initialModel,
  deletedRecord: initialDeletedRecord,
}: {
  model: MainViewResponse;
  deletedRecord: RecordActionView | null;
}): ReactElement {
  const [model, setModel] = useState(initialModel);
  const [overviewRefresh, setOverviewRefresh] = useState(0);
  const [deletedRecord, setDeletedRecord] = useState(initialDeletedRecord);
  const displayQuery = readWorkbenchDisplayQuery(useLocation().search);
  const [aiActionNotice, setAiActionNotice] = useState("");
  const aiActionPending = useRef(false);
  const aiActionGeneration = useRef(0);
  const aiAction = useRef<AbortController | null>(null);
  useEffect(() => () => aiAction.current?.abort(), []);
  /**
   * 管理更新後に画面全体の現在Read Modelを取り直す。
   * @responsibility 鍵管理を含む過去の投影を新しい管理改訂へ更新する。
   * @trace ARCH-000013
   * @input 管理画面が所有する取消Signal。
   * @returns N/A: 不変Modelを置換する。
   * @precondition 管理操作の結果は別表示で保持される。
   * @postcondition 既知保存結果を観測失敗へ上書きしない。
   * @effect 通常GET一回。
   * @failure 現在Model不明は固定例外。
   * @invariant 新AuthorityやStoreを生成しない。
   * @boundary CSRと通常Read Model。
   * @security 秘密応答を再取得しない。
   * @concurrency 完全main Modelを取得した場合だけ置換する。
   */
  const refreshReadModel = useCallback(
    async (
      signal: AbortSignal,
      progress?: {
        requestId: string;
        snapshot: AiRequestSnapshot;
        generation: number;
      },
    ): Promise<void> => {
      const selectedId = model.selectedRepositoryId;
      const currentUrl = window.location.href;
      const target = createSelectedWorkbenchViewUrl(
        new URL(currentUrl),
        selectedId,
      );
      const next = await readWorkbenchQuery("view", signal, async (signal) => {
        const response = await requestWorkbench(
          target,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal,
          },
          true,
        );
        if (!response.ok) throw new Error("workbench_view_unavailable");
        return validateViewResponse(await response.json());
      });
      if (
        next.view !== "main" ||
        next.selectedRepositoryId !== selectedId ||
        signal.aborted ||
        window.location.href !== currentUrl
      )
        throw new Error("workbench_view_unavailable");
      if (progress === undefined) {
        setDeletedRecord(null);
        setModel(next);
        setOverviewRefresh((generation) => generation + 1);
        return;
      }
      if (next.aiRequest.snapshot === null)
        throw new Error("workbench_view_selection_changed");
      setModel((current) =>
        !signal.aborted &&
        window.location.href === currentUrl &&
        !aiActionPending.current &&
        aiActionGeneration.current === progress.generation &&
        current.selectedRepositoryId === selectedId &&
        current.aiRequest.snapshot?.requestId === progress.requestId &&
        ["accepted", "running"].includes(current.aiRequest.snapshot.status)
          ? progress.snapshot.requestId === progress.requestId &&
            next.aiRequest.snapshot?.requestId === progress.requestId
            ? {
                ...next,
                aiRequest: { ...next.aiRequest, snapshot: progress.snapshot },
              }
            : next
          : current,
      );
    },
    [model.selectedRepositoryId],
  );
  const [activeSection, setActiveSection] = useState(
    () => window.location.hash.replace(/^#/u, "") || "overview",
  );
  useEffect(() => {
    const synchronizeActiveSection = () =>
      setActiveSection(window.location.hash.replace(/^#/u, "") || "overview");
    window.addEventListener("hashchange", synchronizeActiveSection);
    return () =>
      window.removeEventListener("hashchange", synchronizeActiveSection);
  }, []);
  const context = model.projectData.context;
  const topics = composeWorkbenchRecordDisplay(model, "topic");
  const meetings = composeWorkbenchRecordDisplay(model, "meeting");
  const browserSession = model.workspaceAccess !== undefined;
  useEffect(() => {
    const requestId = model.aiRequest.snapshot?.requestId;
    const repositoryId = model.selectedRepositoryId;
    const targetId =
      repositoryId ??
      (model.connection.state === "repository" ? context.repositoryId : null);
    if (
      !requestId ||
      !targetId ||
      !["accepted", "running"].includes(model.aiRequest.snapshot?.status ?? "")
    )
      return;
    const controller = new AbortController();
    let reading = false;
    const timer = window.setInterval(() => {
      if (reading || aiActionPending.current) return;
      reading = true;
      const requestedLocation = window.location.href;
      const generation = aiActionGeneration.current;
      void readCurrentAiRequest(targetId, controller.signal, browserSession)
        .then(async (snapshot) => {
          if (
            controller.signal.aborted ||
            aiActionPending.current ||
            aiActionGeneration.current !== generation ||
            window.location.href !== requestedLocation
          )
            return;
          if (
            snapshot.requestId !== requestId ||
            ["completed", "blocked", "cancelled"].includes(snapshot.status)
          ) {
            // 終了結果や別タブで始まった依頼は現在の画面データと同期する。
            try {
              await refreshReadModel(controller.signal, {
                snapshot,
                generation,
                requestId,
              });
              return;
            } catch {
              // 画面の再観測失敗で、取得済みの依頼結果を捨てない。
              if (snapshot.requestId !== requestId) return;
            }
          }
          setModel((current) =>
            !controller.signal.aborted &&
            !aiActionPending.current &&
            aiActionGeneration.current === generation &&
            window.location.href === requestedLocation &&
            current.selectedRepositoryId === repositoryId &&
            current.aiRequest.snapshot?.requestId === requestId &&
            ["accepted", "running"].includes(current.aiRequest.snapshot.status)
              ? { ...current, aiRequest: { ...current.aiRequest, snapshot } }
              : current,
          );
        })
        .catch(() => {})
        .finally(() => {
          reading = false;
        });
    }, 1500);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [
    model.aiRequest.snapshot?.requestId,
    model.aiRequest.snapshot?.status,
    model.selectedRepositoryId,
    model.connection.state,
    browserSession,
    context.repositoryId,
    refreshReadModel,
  ]);
  const capabilityLabel = (
    state: "available" | "not_configured" | "unknown",
    count: number,
  ): string =>
    state === "available"
      ? `${count} items`
      : state === "not_configured"
        ? "Not configured"
        : "Unknown";
  const refresh = (
    <button type="button" disabled>
      Refresh projection
    </button>
  );
  return (
    <WorkbenchShell
      projectId={context.projectId}
      repositoryId={context.repositoryId}
      repositoryRole={context.repositoryRole}
      connectionLabel={
        model.connection.state === "repository" ? "単体リポジトリ" : "共有接続"
      }
      topicsLabel={capabilityLabel(
        topics.collection.state,
        topics.page.records.length,
      )}
      topicsDetail={model.selectedRepositoryId ?? "未構成と0件を区別します"}
      meetingsLabel={capabilityLabel(
        meetings.collection.state,
        meetings.page.records.length,
      )}
      meetingsDetail={model.selectedRepositoryId ?? "未構成と0件を区別します"}
      activeSection={activeSection}
      clientReady={true}
      refresh={refresh}
      content={
        <Fragment>
          {model.connection.state !== "repository" && <GitHostConnections />}
          <Portfolio
            refreshGeneration={overviewRefresh}
            model={model}
            query={displayQuery.portfolio}
          />
          {context.scenes.map((scene) => (
            <ProjectScene key={scene.key} scene={scene} />
          ))}
          {model.recordActionsConfigured &&
          (model.connection.state === "repository" ||
            model.selectedRepositoryId !== null) ? (
            <RecordOperationPanel
              key={`${model.selectedRepositoryId}:${model.actionToken}`}
              repositoryId={model.selectedRepositoryId ?? context.repositoryId}
              refresh={(signal) => refreshReadModel(signal)}
            >
              <RecordCollection
                model={model}
                kind="topic"
                deletedRecord={deletedRecord}
              />
              <RecordCollection
                model={model}
                kind="meeting"
                deletedRecord={deletedRecord}
              />
            </RecordOperationPanel>
          ) : (
            <Fragment>
              <p role="status" style={{ gridColumn: "1 / -1" }}>
                この接続の内容保存は未接続です。現在は閲覧のみです。
              </p>
              <RecordCollection
                model={model}
                kind="topic"
                deletedRecord={deletedRecord}
              />
              <RecordCollection
                model={model}
                kind="meeting"
                deletedRecord={deletedRecord}
              />
            </Fragment>
          )}
          {renderWorkbenchProjectPlan(
            model.projectData.plan,
            model.projectData.ownerArtifacts,
          )}
          {renderWorkbenchQuality(
            model.projectData.quality,
            model.projectData.ownerArtifacts,
          )}
          <OwnerArtifacts model={model} query={displayQuery.document} />
          <RepositoryExecutionActivity
            key={`${context.projectId}:${context.repositoryId}`}
            projectId={context.projectId}
            repositoryId={context.repositoryId}
            browserSession={browserSession}
            cursor={displayQuery.activityCursor}
            refresh={JSON.stringify([
              overviewRefresh,
              model.aiRequest.snapshot?.requestId,
              model.aiRequest.snapshot?.status,
            ])}
          />
          {model.workspaceAccess === "unavailable" ? null : (
            <WorkspacePanel
              key={`workspace:${model.selectedRepositoryId}:${model.actionToken}:${model.workspaceAccess}`}
              repositoryId={
                model.selectedRepositoryId ??
                model.projectData.context.repositoryId
              }
              projectId={model.projectData.context.projectId}
              initialHead={
                model.projectData.repository.publicationTarget
                  ?.revisionIdentity ?? ""
              }
              initialBranch={
                model.projectData.repository.publicationTarget?.branch ?? ""
              }
              initialBaseBranch={
                model.projectData.repository.publicationTarget?.localBranch ??
                ""
              }
              readOnly={model.workspaceAccess === "read"}
              browserSession={model.workspaceAccess !== undefined}
            />
          )}
          {model.connection.state === "repository" ||
          (model.repositoryActions.length !== 0 &&
            model.selectedRepositoryId !== null) ? (
            <RepositoryOperationPanel
              key={`${model.selectedRepositoryId}:${model.actionToken}`}
              repositoryId={
                model.selectedRepositoryId ??
                model.projectData.context.repositoryId
              }
              actionToken={model.actionToken}
              browserSession={model.workspaceAccess !== undefined}
              refresh={refreshReadModel}
            >
              <Repository model={model} refresh={overviewRefresh} />
            </RepositoryOperationPanel>
          ) : (
            <Repository model={model} refresh={overviewRefresh} />
          )}
          {model.connection.state === "repository" ? (
            <Connection />
          ) : (
            <WorkbenchPanel
              id="connection"
              eyebrow="共有接続"
              title="接続"
              status="Connected"
            >
              <a href="/?repositoryId=">接続とProject一覧へ戻る</a>
            </WorkbenchPanel>
          )}
          <AiSelection model={model} />
          <AiSelectionManagementPanel
            key={`ai-selection:${model.selectedRepositoryId}:${model.actionToken}:${model.aiSelectionManagement.allowed}`}
            actionToken={model.actionToken}
            browserSession={model.workspaceAccess !== undefined}
            repositoryId={
              model.selectedRepositoryId ??
              (model.connection.state === "repository"
                ? context.repositoryId
                : null)
            }
            allowed={model.aiSelectionManagement.allowed}
            initialRead={model.aiSelection?.selection ?? null}
            catalog={model.aiSelection?.catalog ?? null}
            initialResult={model.aiSelectionManagement.result}
            refreshReadModel={refreshReadModel}
          />
          <div
            key={`ai-request:${model.selectedRepositoryId}:${model.actionToken}`}
            onSubmit={(event: FormEvent<HTMLDivElement>) => {
              if (
                !(event.target instanceof HTMLFormElement) ||
                !event.target.hasAttribute("data-ai-request-action")
              )
                return;
              event.preventDefault();
              const repositoryId =
                model.selectedRepositoryId ??
                (model.connection.state === "repository"
                  ? context.repositoryId
                  : null);
              if (
                aiActionPending.current ||
                !repositoryId ||
                !model.aiRequest.configured
              )
                return;
              const form = new FormData(event.target);
              const owned = new AbortController();
              aiAction.current = owned;
              const selectedUrl = window.location.href;
              const generation = ++aiActionGeneration.current;
              aiActionPending.current = true;
              void (async () => {
                const current = () =>
                  !owned.signal.aborted &&
                  aiActionGeneration.current === generation &&
                  window.location.href === selectedUrl;
                let confirmed = false;
                try {
                  const outcome = await requestAiRequestAction(
                    repositoryId,
                    form,
                    owned.signal,
                    browserSession,
                  );
                  if (!current()) return;
                  confirmed = true;
                  setAiActionNotice(
                    outcome === "blocked"
                      ? "依頼は開始されませんでした。現在状態を確認します。"
                      : "操作結果を取得しました。現在状態を確認します。",
                  );
                  await refreshReadModel(owned.signal);
                } catch {
                  if (current())
                    setAiActionNotice(
                      confirmed
                        ? "操作の応答は取得済みですが、現在状態を確認できません。再送していません。"
                        : "操作結果を確認できません。自動再送せず、現在状態を確認してください。",
                    );
                } finally {
                  if (aiAction.current === owned) {
                    aiAction.current = null;
                    aiActionPending.current = false;
                  }
                }
              })();
            }}
          >
            {aiActionNotice ? <p role="status">{aiActionNotice}</p> : null}
            {renderWorkbenchAiRequest(
              model.actionToken,
              model.aiSelection,
              model.aiRequest.configured,
              model.aiRequest.snapshot,
              model.aiRequest.notice,
              model.aiRequest.additionalHosts,
            )}
          </div>
        </Fragment>
      }
    />
  );
}
