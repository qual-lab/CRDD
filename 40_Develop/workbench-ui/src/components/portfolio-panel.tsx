/**
 * WorkbenchのPortfolioを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ProjectPageResponse } from "@qual-lab/crdd-server";
import { type ReactElement, useEffect, useState } from "react";
import type { MainViewResponse } from "../api/response.ts";
import { readProjectPage } from "../api/view.ts";
import { EmptyState, WorkbenchPanel } from "./elements.ts";

/**
 * 単体または共有のProject一覧を表示する。
 * @responsibility 検索・状態・CursorとSource別Project導線を表示する。
 * @trace ARCH-000012
 * @input 概要の表示可否と、一覧を読む選択リポジトリおよび検索条件。
 * @returns Portfolio Panelを返す。
 * @precondition 表示する一覧は、Serverが現在の認可で取得できたProjectに限る。
 * @postcondition 欠測Sourceを完全状態に畳まない。
 * @effect 選択範囲・検索条件ごとにProject一覧のGETを発行する。
 * @failure 不正CursorはServerの拒否結果を維持する。
 * @invariant BrowserでProjectを追加・除外しない。
 * @boundary Federated PortfolioとProject選択の境界。
 * @security 開示済みProjectだけを表示する。
 * @concurrency Queryに拘束したCursorを維持する。
 */
export function Portfolio({
  model,
  query,
  refreshGeneration,
}: {
  model: MainViewResponse;
  query: Readonly<{ query: string; state: string; cursor: string }>;
  refreshGeneration: number;
}): ReactElement {
  const { portfolioAvailable, selectedRepositoryId } = model;
  const { query: search, state, cursor } = query;
  const selection = JSON.stringify([
    refreshGeneration,
    selectedRepositoryId,
    search,
    state,
    cursor,
  ]);
  const [observed, setObserved] = useState<{
    selection: string;
    page: ProjectPageResponse | null;
  } | null>(null);
  useEffect(() => {
    if (!portfolioAvailable) return;
    const owner = new AbortController();
    const publish = (page: ProjectPageResponse | null) => {
      if (!owner.signal.aborted) setObserved({ selection, page });
    };
    void readProjectPage(
      selectedRepositoryId,
      { query: search, state, cursor },
      owner.signal,
    ).then(publish, () => publish(null));
    return () => owner.abort();
  }, [
    portfolioAvailable,
    selectedRepositoryId,
    search,
    state,
    cursor,
    selection,
  ]);
  const current = observed?.selection === selection ? observed : null;
  const page = current?.page;
  const projects = page?.projects ?? [];
  const next = new URLSearchParams({
    portfolioQuery: search,
    portfolioState: state,
    portfolioCursor: page?.nextCursor ?? "",
  });
  if (selectedRepositoryId) next.set("repositoryId", selectedRepositoryId);
  return (
    <WorkbenchPanel
      id="portfolio"
      eyebrow="Project portfolio"
      title="Projectを選ぶ"
      status={portfolioAvailable ? "Project一覧" : "Repository mode"}
    >
      {!portfolioAvailable ? (
        <ul>
          <li>
            <strong>{model.projectData.context.projectId}</strong>
            <p>
              {model.projectData.context.repositoryId} /{" "}
              {model.projectData.context.repositoryRole}
            </p>
            <small>現在のRepository Contextだけを表示</small>
          </li>
        </ul>
      ) : (
        <>
          <form className="collection-controls" method="get" action="/">
            {selectedRepositoryId && (
              <input
                type="hidden"
                name="repositoryId"
                value={selectedRepositoryId}
              />
            )}
            <label>
              Project検索
              <input name="portfolioQuery" defaultValue={query.query} />
            </label>
            <label>
              状態
              <select name="portfolioState" defaultValue={query.state}>
                <option value="">すべて</option>
                <option value="complete">complete</option>
                <option value="partial">partial</option>
                <option value="conflicting">conflicting</option>
              </select>
            </label>
            <button type="submit">絞り込む</button>
          </form>
          {page?.cursorInvalid ? (
            <EmptyState>
              検索条件と継続位置が一致しません。先頭から絞り込み直してください。
            </EmptyState>
          ) : null}
          {current === null ? (
            <EmptyState>Project一覧を取得しています。</EmptyState>
          ) : page === null ? (
            <EmptyState>現在のProject一覧を確認できません。</EmptyState>
          ) : projects.length === 0 ? (
            <EmptyState>
              現在の接続資格から表示できるProjectはありません。非開示Projectの存在や件数は表示しません。
            </EmptyState>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project.projectId}>
                  <strong>
                    <a
                      href={`/project?id=${encodeURIComponent(project.projectId)}`}
                    >
                      {project.projectId}
                    </a>
                  </strong>
                  <p>
                    {project.sources
                      .map(
                        (source) => `${source.repositoryId}: ${source.state}`,
                      )
                      .join(" / ")}
                  </p>
                  <small>
                    {project.state} / {project.sources.length} visible sources
                  </small>
                </li>
              ))}
            </ul>
          )}
          {!page?.nextCursor ? null : (
            <a className="page-link" href={`/?${next}#portfolio`}>
              次のProject
            </a>
          )}
        </>
      )}
    </WorkbenchPanel>
  );
}
