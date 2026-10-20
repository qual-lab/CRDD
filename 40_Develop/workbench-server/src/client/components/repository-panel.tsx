/**
 * WorkbenchのRepositoryを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import { ActionTokenInput, EmptyState, WorkbenchPanel } from "./elements.ts";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";

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
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
  const repository = model.surface.repository;
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
  const tree = model.worktree.tree;
  const diff = model.worktree.diff;
  return (
    <WorkbenchPanel
      id="repository"
      eyebrow="Repository"
      title="作業ツリー"
      status={`${count} changes`}
    >
      {model.repositoryResult === null ? null : (
        <p
          className="operation-result"
          data-status={model.repositoryResult.status}
        >
          <strong>{model.repositoryResult.status}</strong>{" "}
          {model.repositoryResult.reason}
        </p>
      )}
      <section className="repository-browser">
        <h3>Repository Tree／Diff</h3>
        {model.worktree.state === "unknown" || tree === null ? (
          <EmptyState>
            TreeまたはDiffを完全に観測できません。空Repositoryとして扱いません。
          </EmptyState>
        ) : (
          <>
            <nav className="repository-breadcrumb">
              {tree.directory.length === 0 ? (
                <strong>Repository root</strong>
              ) : (
                <>
                  <a
                    href={`/?treeDirectory=${encodeURIComponent(tree.directory.includes("/") ? tree.directory.slice(0, tree.directory.lastIndexOf("/")) : "")}#repository`}
                  >
                    ← Repository root
                  </a>
                  <strong>{tree.directory}</strong>
                </>
              )}
            </nav>
            {tree.entries.length === 0 ? (
              <EmptyState>このDirectoryの表示対象は0件です。</EmptyState>
            ) : (
              <ul className="repository-tree">
                {tree.entries.map((entry) => (
                  <li key={entry.path}>
                    <a
                      href={
                        entry.kind === "directory"
                          ? `/?treeDirectory=${encodeURIComponent(entry.path)}#repository`
                          : `/?treeDirectory=${encodeURIComponent(tree.directory)}&diffPath=${encodeURIComponent(entry.path)}#repository`
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
            {tree.nextCursor === null ? null : (
              <a
                className="page-link"
                href={`/?treeDirectory=${encodeURIComponent(tree.directory)}&treeCursor=${encodeURIComponent(tree.nextCursor)}#repository`}
              >
                次のEntry
              </a>
            )}
            {diff === null ? (
              <EmptyState>
                Fileを選択するとPrepared／Working差分を表示します。
              </EmptyState>
            ) : (
              <section className="repository-diff">
                <h4>
                  <code>{diff.path}</code>
                </h4>
                {diff.unregistered ? (
                  <EmptyState>
                    未追跡Fileの内容は自動読取りしません。Stage後にPrepared差分として確認してください。
                  </EmptyState>
                ) : null}
                <h5>Prepared</h5>
                <pre>{diff.preparedPatch || "差分なし"}</pre>
                {diff.preparedTruncated ? (
                  <small>表示上限で切り詰めました。</small>
                ) : null}
                <h5>Working</h5>
                <pre>{diff.workingPatch || "差分なし"}</pre>
                {diff.workingTruncated ? (
                  <small>表示上限で切り詰めました。</small>
                ) : null}
              </section>
            )}
          </>
        )}
      </section>
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
                  <form method="post" action="/repository/action">
                    <ActionTokenInput value={model.actionToken} />
                    {model.selectedRepositoryId === null ? null : (
                      <input
                        type="hidden"
                        name="repositoryId"
                        value={model.selectedRepositoryId}
                      />
                    )}
                    <input type="hidden" name="operation" value={operation} />
                    <input type="hidden" name="path" value={entry} />
                    <button type="submit">
                      {operation === "prepare" ? "Stage" : "Unstage"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <form method="post" action="/repository/action">
        <ActionTokenInput value={model.actionToken} />
        {model.selectedRepositoryId === null ? null : (
          <input
            type="hidden"
            name="repositoryId"
            value={model.selectedRepositoryId}
          />
        )}
        <input type="hidden" name="operation" value="create_revision" />
        <label>
          Commit message
          <input required maxLength={4096} name="message" />
        </label>
        <button type="submit">Commit staged changes</button>
      </form>
      {target?.status === "available" &&
      target.destination !== null &&
      target.branch !== null &&
      target.revisionIdentity !== null ? (
        <form method="post" action="/repository/action">
          <ActionTokenInput value={model.actionToken} />
          {model.selectedRepositoryId === null ? null : (
            <input
              type="hidden"
              name="repositoryId"
              value={model.selectedRepositoryId}
            />
          )}
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
