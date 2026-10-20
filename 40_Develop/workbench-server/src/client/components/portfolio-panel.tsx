/**
 * WorkbenchのPortfolioを描画する。
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
export function Portfolio({
  model,
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
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
              {model.surface.context.repositoryId} /{" "}
              {model.surface.context.repositoryRole}
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
          {model.portfolioPage.cursorInvalid ? (
            <EmptyState>
              検索条件と継続位置が一致しません。先頭から絞り込み直してください。
            </EmptyState>
          ) : null}
          {projects.length === 0 ? (
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
          {model.portfolioPage.nextCursor === null ? null : (
            <a
              className="page-link"
              href={`/?portfolioQuery=${encodeURIComponent(model.portfolioQuery.query)}&portfolioState=${encodeURIComponent(model.portfolioQuery.state)}&portfolioCursor=${encodeURIComponent(model.portfolioPage.nextCursor)}#portfolio`}
            >
              次のProject
            </a>
          )}
        </>
      )}
    </WorkbenchPanel>
  );
}
