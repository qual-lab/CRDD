/**
 * WorkbenchのAccessWorkbenchを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import { type ReactElement, useState, useRef, type FormEvent } from "react";
import {
  ActionTokenInput,
  EmptyState,
  WorkbenchPanel,
} from "../components/elements.ts";
import type { WorkbenchAccessViewModel } from "../../shared/view/types.ts";
import { inspectWorkbenchClientModel } from "../../shared/view/validation.ts";
import { ManagementPanel } from "../components/management-panel.tsx";
import { ProfileManagementPanel } from "../components/profile-management-panel.tsx";
import {
  requestWorkbench,
  setWorkbenchCredential,
  clearWorkbenchCredential,
} from "../api/connection.ts";
import { Credentials } from "../components/credentials.tsx";
import { readWorkbenchQuery } from "../api/queries.ts";

/**
 * 内容未選択のLocal CROS接続と既存管理Panelを描画する。
 * @responsibility 未認証時にProject／Git／Topic情報を作らず、鍵は専用POSTへ渡す。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 検査済み非秘密Access Model。
 * @returns 接続・現在許可Project・管理・資格PanelのCSR要素。
 * @precondition Serverが通常Repository内容を含まないModelを返す。
 * @postcondition 未認証では接続Formだけ、認証後は現在投影だけ表示する。
 * @effect 明示Form送信と管理後の同Origin読取りだけ。
 * @failure 読取り不明は旧Modelを成功として再公開しない。
 * @invariant 仮Project IDや0件を未観測の代わりに表示しない。
 * @boundary 接続専用JSONとBrowser表示。
 * @security 鍵をReact Model・URL・Storageへ保存しない。
 * @concurrency 管理Panelが渡す所有Signalで再読取りする。
 */
export function AccessWorkbench({
  initialModel,
}: {
  initialModel: WorkbenchAccessViewModel;
}): ReactElement {
  const [model, setModel] = useState(initialModel);
  const [unknown, setUnknown] = useState(false);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  /**
   * 管理操作後の現在接続投影を再読取りする。
   * @responsibility 失敗時は旧内容を隠し、未知Viewを推測しない。
   * @trace ARCH-000012
   * @trace ARCH-000013
   * @input 管理Panelが所有する取消Signal。
   * @returns 検査済みaccess投影への更新完了。
   * @precondition 同Originの接続画面から実行する。
   * @postcondition 新Modelだけを表示し、失敗は未確認へ分離する。
   * @effect 同Origin GET一回とReact表示更新。
   * @failure HTTP不正・解析・取消は旧内容を隠して例外を返す。
   * @invariant 保存操作や自動再送を行わない。
   * @boundary Workbench接続GETとCSR状態。
   * @security 鍵を入力・保存・出力しない。
   * @concurrency Signal中断後にModelを採用しない。
   */
  const refreshReadModel = async (signal: AbortSignal): Promise<void> => {
    try {
      const next = await readWorkbenchQuery("view", signal, async (signal) => {
        const response = await requestWorkbench("/api/workbench-view", {
          signal,
        });
        if (!response.ok) throw new Error("workbench_access_unavailable");
        return inspectWorkbenchClientModel(await response.json());
      });
      if (signal.aborted || next.view !== "access")
        throw new Error("workbench_access_unavailable");
      setModel(next);
      setUnknown(false);
    } catch (error) {
      setUnknown(true);
      throw error;
    }
  };
  /**
   * 接続専用POSTの確認後だけタブ内資格で現在表示を取得する。
   * @responsibility 切断時に旧表示を直ちに隠し、鍵をServer Sessionへ保存しない。
   * @trace ARCH-000013
   * @input 当該接続Formの明示送信。
   * @returns 接続要求と次GETの処置完了。
   * @precondition 同Originの検査済みAccess Modelから操作する。
   * @postcondition 鍵入力を消去し、成功した現在Modelだけを表示する。
   * @effect 専用POST一回、後続GET一回、タブmemory更新。
   * @failure 拒否・不明は資格参照と旧投影を破棄し、保存取消を推定しない。
   * @invariant 二重送信・自動再発行・自動再送をしない。
   * @boundary Browser接続FormとAM接続確認。
   * @security 生鍵をModel・Storage・URL・logへ含めない。
   * @concurrency refで同一Formの並行送信を拒否し、旧接続応答は要求Ownerが拒否する。
   */
  const submitConnection = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const form = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") form.append(key, value);
    }
    const token = form.get("token");
    event.currentTarget.reset();
    try {
      if (form.get("operation") === "disconnect") {
        clearWorkbenchCredential();
        setModel({
          ...model,
          authenticated: false,
          portfolio: null,
          credentials: { state: "not_configured", snapshot: null },
          notice: null,
        });
      }
      const response = await requestWorkbench("/local-connection/action", {
        method: "POST",
        body: form,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.startsWith("application/json")
      )
        throw new Error("workbench_connection_unavailable");
      const confirmation: unknown = await response.json();
      if (
        confirmation === null ||
        typeof confirmation !== "object" ||
        Array.isArray(confirmation) ||
        Object.keys(confirmation).length !== 1 ||
        !("status" in confirmation) ||
        confirmation.status !== "completed"
      )
        throw new Error("workbench_connection_unavailable");
      if (form.get("operation") === "connect")
        setWorkbenchCredential(token ?? "");
      await refreshReadModel(new AbortController().signal);
    } catch {
      clearWorkbenchCredential();
      setModel({
        ...model,
        authenticated: false,
        portfolio: null,
        credentials: { state: "not_configured", snapshot: null },
        notice: "接続を確認できません。鍵を確認して再接続してください。",
      });
      setUnknown(true);
    } finally {
      form.delete("token");
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <img src={model.logoPath} width="36" height="36" alt="CRDD" />
          <span>
            CROS Workbench<small>接続と管理</small>
          </span>
        </a>
      </header>
      <main style={{ gridColumn: "1 / -1" }}>
        <WorkbenchPanel
          id="connection"
          eyebrow="Local CROS"
          title="接続"
          status={model.authenticated ? "Connected" : "未接続"}
        >
          {model.notice === null ? null : (
            <p className="operation-result">{model.notice}</p>
          )}
          <form
            method="post"
            action="/local-connection/action"
            autoComplete="off"
            onSubmit={submitConnection}
          >
            <ActionTokenInput value={model.actionToken} />
            <input
              type="hidden"
              name="operation"
              value={model.authenticated ? "disconnect" : "connect"}
            />
            {model.authenticated ? null : (
              <label>
                接続用の鍵
                <input
                  type="password"
                  name="token"
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            )}
            <button type="submit" disabled={busy}>
              {model.authenticated ? "切断" : "接続"}
            </button>
          </form>
        </WorkbenchPanel>
        {unknown ? (
          <p role="alert">
            現在の情報を確認できません。古い内容は表示していません。
          </p>
        ) : model.authenticated ? (
          <>
            <WorkbenchPanel
              id="projects"
              eyebrow="Current access"
              title="利用できるProject"
              status={model.portfolio === null ? "未確認" : "現在の許可範囲"}
            >
              {model.portfolio === null ? (
                <EmptyState>現在の内容を確認できません。</EmptyState>
              ) : model.portfolio.projects.length === 0 ? (
                <EmptyState>現在許可されたRepositoryはありません。</EmptyState>
              ) : (
                model.portfolio.projects.map((project) => (
                  <div key={project.projectId}>
                    <h3>
                      {project.projectId} —{" "}
                      {
                        {
                          complete: "確認済み",
                          partial: "一部未確認",
                          conflicting: "競合あり",
                        }[project.state]
                      }
                    </h3>
                    {project.sources.map((source) => (
                      <div key={source.repositoryId}>
                        {source.state === "complete" ? (
                          <a
                            href={`/?repositoryId=${encodeURIComponent(source.repositoryId)}`}
                          >
                            {source.repositoryId}
                          </a>
                        ) : (
                          <span>{source.repositoryId}</span>
                        )}{" "}
                        —{" "}
                        {
                          {
                            complete: "確認済み",
                            missing: "文書未提供",
                            unavailable: "文書未確認",
                            conflicting: "文書競合",
                          }[source.state]
                        }
                      </div>
                    ))}
                  </div>
                ))
              )}
            </WorkbenchPanel>
            <ManagementPanel
              actionToken={model.actionToken}
              refreshReadModel={refreshReadModel}
            />
            <ProfileManagementPanel
              actionToken={model.actionToken}
              owner="CROS"
              refreshReadModel={refreshReadModel}
            />
            <Credentials model={model} />
          </>
        ) : null}
      </main>
    </div>
  );
}
