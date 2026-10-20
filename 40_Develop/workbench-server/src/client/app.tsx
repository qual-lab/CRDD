/**
 * WorkbenchのWorkbenchAppを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import type { WorkbenchClientModel } from "../shared/view/types.ts";
import { MainWorkbench } from "./pages/overview.tsx";
import { ProjectDetail } from "./pages/project.tsx";
import { RecordDetail } from "./pages/record.tsx";
import { ArtifactDocument } from "./pages/artifact.tsx";
import { AccessWorkbench } from "./pages/access.tsx";
import type { ReplaceDeletedRecord } from "./api/record.ts";

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
export function WorkbenchApp({
  model,
  replaceDeletedRecord,
}: {
  model: WorkbenchClientModel;
  replaceDeletedRecord: ReplaceDeletedRecord;
}): ReactElement {
  if (model.view === "access") return <AccessWorkbench initialModel={model} />;
  if (model.view === "project-detail") return <ProjectDetail model={model} />;
  if (model.view === "record-detail")
    return (
      <RecordDetail model={model} replaceDeletedRecord={replaceDeletedRecord} />
    );
  if (model.view === "artifact") return <ArtifactDocument model={model} />;
  return <MainWorkbench model={model} />;
}
