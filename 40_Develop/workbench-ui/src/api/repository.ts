/**
 * WorkbenchのGitフォームと結果表示を結び付ける。
 * @packageDocumentation
 * @responsibility 現在画面の明示送信と、同じ要求への非秘密表示値を確定する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary 同一Origin HTTPとWorkbenchの表示。Gitの許可・結果の意味判定はServerが所有する。
 */
export type RepositoryOperationDisplay = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string;
}>;

/**
 * 現在の画面で生成できる一件の入力だけを送信対象にする。
 * @trace ARCH-000009
 * @security 他の画面の選択値や不用意に混入した欄を送信しない。Gitの入力検査・認可はServerで行う。
 */
export function readRepositorySubmission(
  form: URLSearchParams,
  repositoryId: string,
  actionToken: string,
): Readonly<{
  publicationRevision: string | null;
  completedReason: string;
  completionHasRevision: boolean;
  request: Readonly<{
    path: string;
    method: "POST" | "DELETE";
    body: string;
    token: string;
  }>;
}> {
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
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId) ||
    form.get("repositoryId") !== repositoryId ||
    form.get("actionToken") !== actionToken ||
    (operation === "publish_revision" && form.get("humanConfirmed") !== "true")
  )
    throw new Error("repository_form_selection_invalid");
  const publication = operation === "publish_revision";
  const revision = publication ? form.get("revisionIdentity") : null;
  if (publication && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(revision ?? ""))
    throw new Error("repository_form_selection_invalid");
  const base = `/api/repositories/${repositoryId}`;
  const path = publication
    ? `${base}/revisions/${revision}/publication`
    : operation === "create_revision"
      ? `${base}/revisions`
      : `${base}/staging`;
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
      path,
      method: operation === "unprepare" ? "DELETE" : "POST",
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
  submission: ReturnType<typeof readRepositorySubmission>,
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
