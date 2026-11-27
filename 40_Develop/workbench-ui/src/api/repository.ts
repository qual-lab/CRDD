/**
 * WorkbenchのGitフォームと結果表示を結び付ける。
 * @packageDocumentation
 * @responsibility 現在画面の明示送信と、同じ要求への非秘密表示値を確定する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary 同一Origin HTTPとWorkbenchの表示。Gitの許可・結果の意味判定はServerが所有する。
 */
import type { RepositoryFilesResponse } from "@qual-lab/crdd-server";
import { requestWorkbench } from "./connection.ts";
import { RESOURCE_ID, workbenchPath, workbenchRequest } from "./path.ts";

export function readRepositoryFileSelection(search: string) {
  const parameters = new URLSearchParams(search);
  return {
    directory: parameters.get("treeDirectory") ?? "",
    cursor: parameters.get("treeCursor") ?? "",
    diff: parameters.get("diffPath") ?? "",
  };
}

export function repositoryFilesLocation(
  currentSearch: string,
  directory: string,
  cursor = "",
  diff = "",
) {
  const parameters = new URLSearchParams(currentSearch);
  for (const [name, value] of [
    ["treeDirectory", directory],
    ["treeCursor", cursor],
    ["diffPath", diff],
  ] as const) {
    if (value) parameters.set(name, value);
    else parameters.delete(name);
  }
  const search = parameters.toString();
  return `${search ? `?${search}` : "?"}#repository`;
}

/** ツリー／差分を別々に一度読取り、要求した対象と一致する結果だけを採用する。 */
export async function readRepositoryFiles<
  K extends RepositoryFilesResponse["kind"],
>(
  kind: K,
  repositoryId: string,
  target: string,
  cursor: string,
  signal: AbortSignal,
  browserSession: boolean,
): Promise<Extract<RepositoryFilesResponse, { kind: K }>> {
  const tree = kind === "tree";
  const route = tree
    ? "/api/repositories/:repositoryId/worktree/tree"
    : "/api/repositories/:repositoryId/worktree/diff";
  const path = workbenchPath(["GET", route], { repositoryId });
  const parameters = new URLSearchParams(
    tree ? { directory: target } : { path: target },
  );
  if (tree && cursor) parameters.set("cursor", cursor);
  const reply = await requestWorkbench(
    `${path}?${parameters}`,
    { signal },
    browserSession,
  );
  if (!reply.ok || signal.aborted)
    throw new Error("repository_files_response_invalid");
  const value: unknown = await reply.json();
  if (
    signal.aborted ||
    !isRepositoryFilesRecord(value) ||
    Object.keys(value).sort().join(",") !==
      (tree ? "kind,repositoryId,tree" : "diff,kind,repositoryId") ||
    value.repositoryId !== repositoryId ||
    value.kind !== kind ||
    !(tree
      ? validRepositoryTree(value.tree, target)
      : validRepositoryDiff(value.diff, target))
  )
    throw new Error("repository_files_response_invalid");
  return value as Extract<RepositoryFilesResponse, { kind: K }>;
}

function isRepositoryFilesRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRepositoryTree(value: unknown, directory: string) {
  return (
    isRepositoryFilesRecord(value) &&
    Object.keys(value).sort().join(",") === "directory,entries,nextCursor" &&
    value.directory === directory &&
    (value.nextCursor === null || typeof value.nextCursor === "string") &&
    Array.isArray(value.entries) &&
    value.entries.every(
      (entry: unknown) =>
        isRepositoryFilesRecord(entry) &&
        Object.keys(entry).sort().join(",") ===
          "kind,name,path,prepared,unregistered,working" &&
        typeof entry.name === "string" &&
        entry.name.length !== 0 &&
        !/[\\/]/u.test(entry.name) &&
        entry.path ===
          (directory ? `${directory}/${entry.name}` : entry.name) &&
        (entry.kind === "directory" || entry.kind === "file") &&
        typeof entry.prepared === "boolean" &&
        typeof entry.working === "boolean" &&
        typeof entry.unregistered === "boolean",
    )
  );
}

function validRepositoryDiff(value: unknown, path: string) {
  return (
    isRepositoryFilesRecord(value) &&
    Object.keys(value).sort().join(",") ===
      "path,preparedPatch,unregistered,workingPatch" &&
    value.path === path &&
    typeof value.preparedPatch === "string" &&
    typeof value.workingPatch === "string" &&
    typeof value.unregistered === "boolean"
  );
}

export type RepositoryOperationDisplay = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string;
}>;

/** 一回の送信と、その結果を照合するための画面側の条件。 @trace ARCH-000009 */
export interface RepositorySubmission {
  readonly publicationRevision: string | null;
  readonly completedReason: string;
  readonly completionHasRevision: boolean;
  readonly request: Readonly<{
    path: string;
    method: "POST" | "DELETE";
    body: string;
    token: string;
  }>;
}

/**
 * 現在の画面で生成できる一件の入力だけを送信対象にする。
 * @trace ARCH-000009
 * @security 他の画面の選択値や不用意に混入した欄を送信しない。Gitの入力検査・認可はServerで行う。
 */
export function readRepositorySubmission(
  form: URLSearchParams,
  repositoryId: string,
  actionToken: string,
): RepositorySubmission {
  const operation = form.get("operation");
  const fields =
    operation === "prepare" || operation === "unprepare"
      ? ["path"]
      : operation === "create_revision"
        ? ["message"]
        : operation === "publish_revision"
          ? ["destination", "branch", "revisionIdentity", "humanConfirmed"]
          : null;
  if (fields === null) throw new Error("repository_form_selection_invalid");
  const keys = ["operation", "repositoryId", "actionToken", ...fields];
  if (
    [...form.keys()].some((key) => !keys.includes(key)) ||
    keys.some((key) => form.getAll(key).length !== 1) ||
    !RESOURCE_ID.test(repositoryId) ||
    form.get("repositoryId") !== repositoryId ||
    form.get("actionToken") !== actionToken ||
    (operation === "publish_revision" && form.get("humanConfirmed") !== "true")
  )
    throw new Error("repository_form_selection_invalid");
  const publication = operation === "publish_revision";
  const revision = publication ? form.get("revisionIdentity") : null;
  if (publication && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(revision ?? ""))
    throw new Error("repository_form_selection_invalid");
  const route = publication
    ? workbenchRequest(
        [
          "POST",
          "/api/repositories/:repositoryId/revisions/:revision/publication",
        ],
        { repositoryId, revision: revision ?? "" },
      )
    : operation === "create_revision"
      ? workbenchRequest(
          ["POST", "/api/repositories/:repositoryId/revisions"],
          { repositoryId },
        )
      : workbenchRequest(
          [
            operation === "unprepare" ? "DELETE" : "POST",
            "/api/repositories/:repositoryId/staging",
          ],
          { repositoryId },
        );
  return {
    publicationRevision: revision,
    completedReason:
      operation === "publish_revision"
        ? "publication_confirmed"
        : operation === "create_revision"
          ? "revision_created"
          : `${operation}_completed`,
    completionHasRevision:
      operation === "publish_revision" || operation === "create_revision",
    request: {
      ...route,
      body: JSON.stringify(
        Object.fromEntries(
          fields
            .filter((name) => name !== "revisionIdentity")
            .map((name) => [
              name,
              name === "humanConfirmed" ? true : form.get(name),
            ]),
        ),
      ),
      token: actionToken,
    },
  };
}

/**
 * 同じ送信の応答から、画面で使う状態と固定理由だけを取り出す。
 * @trace ARCH-000009
 * @boundary 公開済みの結果JSONと表示。理由とGitの処置効果の対応はServerが検査する。
 */
export function readRepositoryOperationDisplay(
  submission: RepositorySubmission,
  value: unknown,
): RepositoryOperationDisplay {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("repository_outcome_unconfirmed");
  const result = value as Record<string, unknown>;
  const { status, reason, revisionIdentity } = result;
  if (
    Object.keys(result).sort().join(",") !==
      "automaticRetryIssued,effectConfirmed,effectIssued,forcePublicationIssued,reason,revisionIdentity,status" ||
    (status !== "completed" && status !== "blocked" && status !== "unknown") ||
    typeof reason !== "string" ||
    !/^[a-z][a-z0-9_]*$/u.test(reason) ||
    result.automaticRetryIssued !== false ||
    result.forcePublicationIssued !== false ||
    typeof result.effectIssued !== "boolean" ||
    result.effectConfirmed !== (status === "completed") ||
    ((status === "completed" || status === "unknown") &&
      !result.effectIssued) ||
    (status === "completed" &&
      (reason !== submission.completedReason ||
        (revisionIdentity !== null) !== submission.completionHasRevision)) ||
    (revisionIdentity !== null &&
      (typeof revisionIdentity !== "string" ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(revisionIdentity))) ||
    (submission.publicationRevision !== null &&
      ((revisionIdentity !== null &&
        revisionIdentity !== submission.publicationRevision) ||
        (status === "completed" && revisionIdentity === null)))
  )
    throw new Error("repository_outcome_unconfirmed");
  return { status, reason };
}
