/**
 * WorkbenchのMainWorkbenchを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import {
  useCallback,
  Fragment,
  type ReactElement,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { renderWorkbenchAiRequest } from "../components/ai-request-panel.tsx";
import { WorkbenchShell } from "../components/shell.ts";
import { WorkbenchPanel } from "../components/elements.ts";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";
import { inspectWorkbenchClientModel } from "../../shared/view/validation.ts";
import { createSelectedWorkbenchViewUrl } from "../api/view.ts";
import { readWorkbenchQuery } from "../api/queries.ts";
import { requestWorkbenchMutation } from "../api/mutations.ts";
import { ManagementPanel } from "../components/management-panel.tsx";
import { ProfileManagementPanel } from "../components/profile-management-panel.tsx";
import { RecordOperationPanel } from "../components/record-operation-panel.tsx";
import { RepositoryOperationPanel } from "../components/repository-operation-panel.tsx";
import { WorkspacePanel } from "../components/workspace-panel.tsx";
import { requestWorkbench } from "../api/connection.ts";
import {
  renderWorkbenchProjectPlan,
  renderWorkbenchQuality,
} from "../components/projection-panels.tsx";
import { ProjectScene } from "../components/project-context.tsx";
import { RecordCollection } from "../components/records.tsx";
import { OwnerArtifacts } from "../components/records.tsx";
import { Connection } from "../components/credentials.tsx";
import { Credentials } from "../components/credentials.tsx";
import { Portfolio } from "../components/portfolio-panel.tsx";
import { Repository } from "../components/repository-panel.tsx";
import { RuntimeActivity } from "../components/activity-panel.tsx";
import { AiProfiles } from "../components/ai-profiles.tsx";

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
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
  const [model, setModel] = useState(initialModel);
  const [aiActionNotice, setAiActionNotice] = useState("");
  const aiActionPending = useRef(false);
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
    async (signal: AbortSignal): Promise<void> => {
      const selectedId = model.selectedRepositoryId;
      const currentUrl = window.location.href;
      const target = createSelectedWorkbenchViewUrl(
        new URL(currentUrl),
        selectedId,
      );
      const next = await readWorkbenchQuery("view", signal, async (signal) => {
        const response = await requestWorkbench(target, {
          cache: "no-store",
          credentials: "same-origin",
          signal,
        });
        if (!response.ok) throw new Error("workbench_view_unavailable");
        return inspectWorkbenchClientModel(await response.json());
      });
      if (
        next.view !== "main" ||
        next.selectedRepositoryId !== selectedId ||
        signal.aborted ||
        window.location.href !== currentUrl
      )
        throw new Error("workbench_view_unavailable");
      setModel(next);
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
  const context = model.surface.context;
  useEffect(() => {
    if (
      !model.aiRequest.snapshot?.requestId ||
      !["accepted", "running"].includes(model.aiRequest.snapshot?.status ?? "")
    )
      return;
    const controller = new AbortController();
    let reading = false;
    const timer = window.setInterval(() => {
      if (reading) return;
      reading = true;
      void refreshReadModel(controller.signal)
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
        model.connection.state === "repository"
          ? "Repository mode"
          : "CROS connected"
      }
      topicsLabel={capabilityLabel(
        model.topic.collection.state,
        model.topic.page.records.length,
      )}
      topicsDetail={model.selectedRepositoryId ?? "未構成と0件を区別します"}
      meetingsLabel={capabilityLabel(
        model.meeting.collection.state,
        model.meeting.page.records.length,
      )}
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
          {model.connection.state === "repository" ? (
            <>
              <RecordCollection model={model} kind="topic" />
              <RecordCollection model={model} kind="meeting" />
            </>
          ) : model.recordActionsConfigured &&
            model.selectedRepositoryId !== null ? (
            <RecordOperationPanel
              key={`${model.selectedRepositoryId}:${model.actionToken}`}
              repositoryId={model.selectedRepositoryId}
              actionToken={model.actionToken}
              refresh={refreshReadModel}
            >
              <RecordCollection model={model} kind="topic" />
              <RecordCollection model={model} kind="meeting" />
            </RecordOperationPanel>
          ) : (
            <fieldset disabled style={{ display: "contents" }}>
              <p role="status" style={{ gridColumn: "1 / -1" }}>
                この接続の内容保存は未接続です。現在は閲覧のみです。
              </p>
              <RecordCollection model={model} kind="topic" />
              <RecordCollection model={model} kind="meeting" />
            </fieldset>
          )}
          {renderWorkbenchProjectPlan(
            model.surface.plan,
            model.surface.ownerArtifacts,
          )}
          {renderWorkbenchQuality(
            model.surface.quality,
            model.surface.ownerArtifacts,
          )}
          <OwnerArtifacts model={model} />
          <RuntimeActivity model={model} />
          <WorkspacePanel
            key={`workspace:${model.selectedRepositoryId}:${model.actionToken}`}
            repositoryId={
              model.selectedRepositoryId ?? model.surface.context.repositoryId
            }
            projectId={model.surface.context.projectId}
            actionToken={model.actionToken}
            initialHead={
              model.surface.repository.publicationTarget?.revisionIdentity ?? ""
            }
            initialBranch={
              model.surface.repository.publicationTarget?.branch ?? ""
            }
          />
          {model.connection.state === "repository" ? (
            <Repository model={model} />
          ) : model.repositoryActionsConfigured &&
            model.selectedRepositoryId !== null ? (
            <RepositoryOperationPanel
              key={`${model.selectedRepositoryId}:${model.actionToken}`}
              repositoryId={model.selectedRepositoryId}
              actionToken={model.actionToken}
              refresh={refreshReadModel}
            >
              <Repository model={model} />
            </RepositoryOperationPanel>
          ) : (
            <fieldset disabled style={{ display: "contents" }}>
              <Repository model={model} />
            </fieldset>
          )}
          {model.connection.state === "repository" ? (
            <Connection />
          ) : (
            <WorkbenchPanel
              id="connection"
              eyebrow="Local CROS"
              title="接続"
              status="Connected"
            >
              <a href="/?repositoryId=">接続とProject一覧へ戻る</a>
            </WorkbenchPanel>
          )}
          <ManagementPanel
            actionToken={model.actionToken}
            refreshReadModel={refreshReadModel}
          />
          <Credentials model={model} />
          <AiProfiles model={model} />
          <ProfileManagementPanel
            actionToken={model.actionToken}
            owner={model.aiProfileAdministration.owner}
            initialSnapshot={model.aiProfileAdministration.snapshot}
            initialResult={model.aiProfileAdministration.result}
            refreshReadModel={refreshReadModel}
          />
          <div
            onSubmit={
              model.connection.state === "cros_available"
                ? (event: FormEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    if (
                      aiActionPending.current ||
                      !(event.target instanceof HTMLFormElement)
                    )
                      return;
                    const form = new URLSearchParams();
                    for (const [key, value] of new FormData(event.target))
                      if (typeof value === "string") form.append(key, value);
                    form.set(
                      "repositoryId",
                      model.selectedRepositoryId ??
                        model.surface.context.repositoryId,
                    );
                    const selectedUrl = window.location.href;
                    aiActionPending.current = true;
                    void (async () => {
                      try {
                        const response = await requestWorkbenchMutation(
                          "/ai-request/action",
                          {
                            method: "POST",
                            headers: {
                              "content-type":
                                "application/x-www-form-urlencoded",
                            },
                            body: form,
                          },
                        );
                        if (!response.ok)
                          throw new Error("ai_action_unconfirmed");
                        if (window.location.href !== selectedUrl) return;
                        setAiActionNotice(
                          "操作結果を取得しました。現在状態を確認します。",
                        );
                        await refreshReadModel(new AbortController().signal);
                      } catch {
                        setAiActionNotice(
                          "操作結果を確認できません。自動再送せず、現在状態を確認してください。",
                        );
                      } finally {
                        aiActionPending.current = false;
                      }
                    })();
                  }
                : undefined
            }
          >
            {aiActionNotice ? <p role="status">{aiActionNotice}</p> : null}
            {renderWorkbenchAiRequest(
              model.actionToken,
              model.aiProfiles,
              model.aiRequest.configured,
              model.aiRequest.snapshot,
              model.aiRequest.notice,
            )}
          </div>
        </Fragment>
      }
    />
  );
}
