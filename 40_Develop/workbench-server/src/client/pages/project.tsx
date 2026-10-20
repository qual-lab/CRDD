/**
 * WorkbenchのProjectDetailを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import { EmptyState } from "../components/elements.ts";
import type { WorkbenchProjectDetailViewModel } from "../../shared/view/types.ts";
import { ProjectScene } from "../components/project-context.tsx";

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
export function ProjectDetail({
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
          許可済みRepository
          Sourceごとの五場面を表示します。Source間の欠測・競合を一つの完全状態へ統合しません。
        </p>
      </article>
      {model.project.sources.map((source) => (
        <section className="portfolio-source" key={source.repositoryId}>
          <header>
            <div>
              <p className="eyebrow">Repository source</p>
              <h2>{source.repositoryId}</h2>
            </div>
            <span>
              {
                {
                  complete: "確認済み",
                  missing: "文書未提供",
                  unavailable: "文書未確認",
                  conflicting: "文書競合",
                }[source.state]
              }
            </span>
          </header>
          <p>
            {source.repositoryRole ?? "役割未確認"} /{" "}
            {source.revision === null ? "版未確認" : `版 ${source.revision}`}
          </p>
          {source.context === null ? (
            <EmptyState>
              このSourceのProject Contextは利用できません。
            </EmptyState>
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
