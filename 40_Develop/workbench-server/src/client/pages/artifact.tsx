/**
 * WorkbenchのArtifactDocumentを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import type { WorkbenchArtifactViewModel } from "../../shared/view/types.ts";

/**
 * 選択Repositoryの成果物原文をtextとして表示する。
 * @responsibility 原文を加工せず、出所と同じRepositoryへの戻り先を示す。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input 検査済みartifact Model。
 * @returns 原文表示と戻るリンク。
 * @precondition Serverが現在Rootと読取り範囲を確認済み。
 * @postcondition Markdown／HTMLを実行せず、原文を第二正本として保存しない。
 * @effect 明示戻るリンクの同Origin GETのみ。
 * @failure 観測不能の表示は上位取得Ownerが担当する。
 * @invariant Browserは本文からAuthorityや追加リンクを生成しない。
 * @boundary 正本文字列とReact DOM。
 * @security React text escapingとpre表示だけを使う。
 * @concurrency 取得・世代・取消は既存navigation Ownerが管理する。
 */
export function ArtifactDocument({
  model,
}: {
  model: WorkbenchArtifactViewModel;
}): ReactElement {
  return (
    <main
      className="record-detail"
      id="artifact-detail"
      data-repository-id={model.repositoryId}
    >
      <a
        className="page-link"
        href={
          model.selectedRepositoryId === null
            ? "/"
            : `/?repositoryId=${encodeURIComponent(model.selectedRepositoryId)}`
        }
      >
        ← 同じRepositoryへ戻る
      </a>
      <article className="panel">
        <header>
          <h1>
            {model.artifact.kind === "change" ? "変更成果物" : "Owner成果物"} —{" "}
            {model.artifact.identity}
          </h1>
        </header>
        <p>
          出所: <code>{model.repositoryId}</code>
        </p>
        <pre className="canonical-markdown">{model.artifact.markdown}</pre>
      </article>
    </main>
  );
}
