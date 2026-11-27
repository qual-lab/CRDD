/**
 * WorkbenchのRepositoryを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { RepositoryFilesResponse } from "@qual-lab/crdd-server";
import { type ReactElement, useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  readRepositoryFileSelection,
  readRepositoryFiles,
  repositoryFilesLocation,
} from "../api/repository.ts";
import type { MainViewResponse } from "../api/response.ts";
import { ActionTokenInput, EmptyState, WorkbenchPanel } from "./elements.ts";

/**
 * Repositoryの現在差分と許可済み操作を表示する。
 * @responsibility Tree、Prepared／Working DiffとStage／Unstage／Commit／Push入口を分ける。
 * @trace ARCH-000012
 * @input modelにServer観測済みWorktreeを受け取る。
 * @returns Repository Panelを返す。
 * @precondition Pathと差分はVersion Control Adapterで検証済みである。
 * @postcondition PreparedとWorkingを視覚的に区別する。
 * @effect 明示送信時だけVersion Control CommandをPOSTする。
 * @failure 観測不能を差分0と表示しない。
 * @invariant Force・暗黙Commit・暗黙Pushを追加しない。
 * @boundary Browser操作とVersion Control Portの境界。
 * @security 検証済みRepository相対Pathだけを送る。
 * @concurrency 送信時の再観測とServer競合判定を維持する。
 */
export function Repository({
  model,
  refresh,
}: {
  model: MainViewResponse;
  refresh: number;
}): ReactElement {
  const { search } = useLocation();
  const selectedFiles = readRepositoryFileSelection(search);
  const repository = model.projectData.repository;
  const repositoryId =
    model.selectedRepositoryId ?? model.projectData.context.repositoryId;
  if (repository.state === "unknown" || repository.changeSet === null)
    return (
      <WorkbenchPanel
        id="repository"
        eyebrow="Repository"
        title="作業ツリー"
        status="Unknown"
      >
        <EmptyState>
          Gitの現在状態を完全に観測できません。Cleanとして扱いません。
        </EmptyState>
      </WorkbenchPanel>
    );
  const groups = [
    ["Staged", "unprepare", repository.changeSet.preparedChanges],
    ["Working", "prepare", repository.changeSet.workingChanges],
    ["Untracked", "prepare", repository.changeSet.unregisteredPaths],
  ] as const;
  const count = groups.reduce((sum, [, , paths]) => sum + paths.length, 0);
  const target = repository.publicationTarget;
  return (
    <WorkbenchPanel
      id="repository"
      eyebrow="Repository"
      title="作業ツリー"
      status={`${count} changes`}
    >
      <RepositoryFiles
        repositoryId={repositoryId}
        browserSession={model.workspaceAccess !== undefined}
        search={search}
        directory={selectedFiles.directory}
        cursor={selectedFiles.cursor}
        file={selectedFiles.diff}
        refresh={refresh}
      />
      {groups.map(([label, operation, paths]) => (
        <section className="repository-group" key={label}>
          <h3>
            {label} <span>{paths.length}</span>
          </h3>
          {paths.length === 0 ? (
            <EmptyState>0 files</EmptyState>
          ) : (
            <ul>
              {paths.map((entry) => (
                <li key={entry}>
                  <code>{entry}</code>
                  {model.repositoryActions.includes(operation) ? (
                    <form method="post" data-repository-action>
                      <ActionTokenInput value={model.actionToken} />
                      <input
                        type="hidden"
                        name="repositoryId"
                        value={repositoryId}
                      />
                      <input type="hidden" name="operation" value={operation} />
                      <input type="hidden" name="path" value={entry} />
                      <button type="submit">
                        {operation === "prepare" ? "Stage" : "Unstage"}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {model.repositoryActions.includes("create_revision") ? (
        <form method="post" data-repository-action>
          <ActionTokenInput value={model.actionToken} />
          <input type="hidden" name="repositoryId" value={repositoryId} />
          <input type="hidden" name="operation" value="create_revision" />
          <label>
            Commit message
            <input required maxLength={4096} name="message" />
          </label>
          <button type="submit">Commit staged changes</button>
        </form>
      ) : null}
      {!model.repositoryActions.includes(
        "publish_revision",
      ) ? null : target?.status === "available" &&
        target.destination !== null &&
        target.branch !== null &&
        target.revisionIdentity !== null ? (
        <form method="post" data-repository-action>
          <ActionTokenInput value={model.actionToken} />
          <input type="hidden" name="repositoryId" value={repositoryId} />
          <input type="hidden" name="operation" value="publish_revision" />
          <input type="hidden" name="destination" value={target.destination} />
          <input type="hidden" name="branch" value={target.branch} />
          <input
            type="hidden"
            name="revisionIdentity"
            value={target.revisionIdentity}
          />
          <dl className="publication-target">
            <div>
              <dt>Remote</dt>
              <dd>{target.destination}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{target.branch}</dd>
            </div>
            <div>
              <dt>Commit</dt>
              <dd>
                <code>{target.revisionIdentity}</code>
              </dd>
            </div>
          </dl>
          <label className="confirm">
            <input
              required
              type="checkbox"
              name="humanConfirmed"
              value="true"
            />
            表示したRemote・Branch・Commitを確認しました
          </label>
          <button type="submit">Normal push</button>
        </form>
      ) : (
        <section className="publication-unavailable">
          <h3>Normal push</h3>
          <EmptyState>
            公開先を確認できません（
            {target?.reason ?? "publication_target_observation_failed"}
            ）。RemoteやBranchを推測して公開しません。
          </EmptyState>
        </section>
      )}
    </WorkbenchPanel>
  );
}

function RepositoryFiles({
  repositoryId,
  browserSession,
  search,
  directory,
  cursor,
  file,
  refresh,
}: {
  repositoryId: string;
  browserSession: boolean;
  search: string;
  directory: string;
  cursor: string;
  file: string;
  refresh: number;
}) {
  const treeResult = useRepositoryFiles(
    "tree",
    repositoryId,
    directory,
    cursor,
    browserSession,
    refresh,
  );
  const diffResult = useRepositoryFiles(
    "diff",
    repositoryId,
    file,
    "",
    browserSession,
    refresh,
  );
  const tree = treeResult?.tree;
  const diff = diffResult?.diff;
  const location = (directory: string, cursor = "", file = "") =>
    repositoryFilesLocation(search, directory, cursor, file);
  return (
    <section className="repository-browser">
      <h3>Repository Tree／Diff</h3>
      {tree ? (
        <>
          <nav className="repository-breadcrumb">
            {tree.directory ? (
              <>
                <a
                  href={location(
                    tree.directory.slice(
                      0,
                      Math.max(0, tree.directory.lastIndexOf("/")),
                    ),
                  )}
                >
                  ← 親フォルダ
                </a>
                <strong>{tree.directory}</strong>
              </>
            ) : (
              <strong>Repository root</strong>
            )}
          </nav>
          {tree.entries.length === 0 ? (
            <EmptyState>このフォルダの表示対象は0件です。</EmptyState>
          ) : (
            <ul className="repository-tree">
              {tree.entries.map((entry) => (
                <li key={entry.path}>
                  <a
                    href={
                      entry.kind === "directory"
                        ? location(entry.path)
                        : location(directory, cursor, entry.path)
                    }
                  >
                    <span aria-hidden="true">
                      {entry.kind === "directory" ? "▸" : "·"}
                    </span>
                    <code>{entry.name}</code>
                  </a>
                  <small>
                    {[
                      entry.prepared ? "staged" : "",
                      entry.working ? "working" : "",
                      entry.unregistered ? "untracked" : "",
                    ]
                      .filter(Boolean)
                      .join(" / ") || "unchanged"}
                  </small>
                </li>
              ))}
            </ul>
          )}
          {tree.nextCursor !== null && (
            <a
              className="page-link"
              href={location(directory, tree.nextCursor)}
            >
              次の項目
            </a>
          )}
        </>
      ) : (
        <EmptyState>
          {treeResult === null
            ? "作業ツリーを観測できません。空として扱いません。"
            : "作業ツリーを取得中です。"}
        </EmptyState>
      )}
      {!file ? (
        <EmptyState>
          ファイルを選ぶとステージ済みと作業中の差分を表示します。
        </EmptyState>
      ) : diff ? (
        <section className="repository-diff">
          <h4>
            <code>{diff.path}</code>
          </h4>
          {diff.unregistered && (
            <EmptyState>
              未追跡ファイルの本文は表示しません。ステージしてから差分を確認してください。
            </EmptyState>
          )}
          <h5>Prepared</h5>
          <pre>{diff.preparedPatch || "差分なし"}</pre>
          <h5>Working</h5>
          <pre>{diff.workingPatch || "差分なし"}</pre>
        </section>
      ) : (
        <EmptyState>
          {diffResult === null
            ? "差分を観測できません。"
            : "差分を取得中です。"}
        </EmptyState>
      )}
    </section>
  );
}

function useRepositoryFiles<K extends RepositoryFilesResponse["kind"]>(
  kind: K,
  repositoryId: string,
  target: string,
  cursor: string,
  browserSession: boolean,
  refresh: number,
) {
  type Result = Extract<RepositoryFilesResponse, { kind: K }>;
  const scope = JSON.stringify([
    kind,
    repositoryId,
    target,
    cursor,
    browserSession,
    refresh,
  ]);
  const [observed, setObserved] = useState<{
    scope: string;
    result: Result | null;
  }>();
  useEffect(() => {
    if (kind === "diff" && !target) return;
    const pending = new AbortController();
    const publish = (result: Result | null) => {
      if (!pending.signal.aborted) setObserved({ scope, result });
    };
    void readRepositoryFiles(
      kind,
      repositoryId,
      target,
      cursor,
      pending.signal,
      browserSession,
    ).then(publish, () => publish(null));
    return () => pending.abort();
  }, [kind, repositoryId, target, cursor, browserSession, scope]);
  return observed?.scope === scope ? observed.result : undefined;
}
