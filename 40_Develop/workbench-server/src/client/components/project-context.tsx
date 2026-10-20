/**
 * WorkbenchのProjectSceneを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";

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
export function ProjectScene({
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
