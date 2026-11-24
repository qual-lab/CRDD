/**
 * 検証済みRepositoryから固定Project Context本文を読む。
 * @responsibility 読取り・解析・三Identity照合を閉じ、本文やPathを失敗結果へ返さない。
 * @trace ARCH-000005
 * @boundary 技術的Repository RootとProject Context読取り。
 * @effect 固定本文の読取りだけ。
 * @security 認可やRepository探索を行わず、呼出し元の今回要求範囲に限定する。
 */
import { createHash } from "node:crypto";
import {
  createFilesystemRepositoryObservationPort,
  observeDocumentRoot,
} from "../repository/create-observer.ts";
import { parseRepositoryProjectContextMarkdown } from "./parse.ts";
import type {
  RepositoryProjectContext,
  RepositoryProjectContextReadResult,
} from "./types.ts";

/**
 * 固定本文を読み、今回の三つの期待Identityと照合する。
 * @responsibility 観測不能を欠測や成功へ変換せず、解析済みContextだけを返す。
 * @trace ARCH-000005
 * @input 呼出し側が選定した絶対DirectoryとProject・Repository・役割の三期待値。
 * @returns completedのContextとUTF-8本文相関revision、またはRoot不成立・文書競合・未確認の固定理由。
 * @precondition 呼出し元が今回要求の対象選定と認可を済ませている。
 * @postcondition Project・Repository・役割の完全一致時だけContextを返す。
 * @effect 固定PROJECT_CONTEXT.mdを同期読取りする。独自の容量上限を追加しない。
 * @failure Root不成立はblocked、三Identity不一致はconflicting、文書取得・解析不成立はunavailable。
 * @invariant revisionは解析したtextの相関値で、Git／管理改訂・生byte同一性・認可証明ではない。失敗をnullやmissingにしない。
 * @boundary 既存Root内観測→Markdown解析→同Processの内容Consumer。
 * @security 任意Path・生Markdown・Root・期待Identity・下位例外を結果へ透過しない。
 * @concurrency 単一本文の安定読取り。期待manifestとの複数File原子性や再読取りは保証しない。
 */
export function readRepositoryProjectContext(
  root: string | null,
  expectedIdentity: Pick<
    RepositoryProjectContext,
    "projectId" | "repositoryId" | "repositoryRole"
  >,
): RepositoryProjectContextReadResult {
  const initial = observeDocumentRoot(root);
  const sameRoot = () => {
    const current = observeDocumentRoot(root);
    return (
      initial !== null &&
      current !== null &&
      initial.dev === current.dev &&
      initial.ino === current.ino &&
      initial.birthtimeNs === current.birthtimeNs
    );
  };
  try {
    if (initial === null)
      return Object.freeze({
        status: "blocked",
        reason: "project_context_repository_unavailable",
      });
    const observed =
      createFilesystemRepositoryObservationPort(root).observeFile(
        "PROJECT_CONTEXT.md",
      );
    if (!sameRoot())
      return Object.freeze({
        status: "blocked",
        reason: "project_context_repository_unavailable",
      });
    if (observed.status !== "resolved")
      return Object.freeze({
        status: "unavailable",
        reason: "project_context_observation_unavailable",
      });
    const contextIntake = parseRepositoryProjectContextMarkdown(
      observed.source,
    );
    const context = contextIntake.result;
    if (context === null)
      throw new Error(
        contextIntake.issues.find(
          (issue) =>
            issue.kind === "artifact.project-context.projection-model-invalid",
        )?.reason ?? "project_context_scene_invalid",
      );
    if (
      context.projectId !== expectedIdentity.projectId ||
      context.repositoryId !== expectedIdentity.repositoryId ||
      context.repositoryRole !== expectedIdentity.repositoryRole
    )
      return Object.freeze({
        status: "conflicting",
        reason: "project_context_identity_mismatch",
      });
    return Object.freeze({
      status: "completed",
      context,
      revision: `context-text-sha256:${createHash("sha256").update(observed.source, "utf8").digest("hex")}`,
    });
  } catch {
    if (!sameRoot())
      return Object.freeze({
        status: "blocked",
        reason: "project_context_repository_unavailable",
      });
    return Object.freeze({
      status: "unavailable",
      reason: "project_context_read_unavailable",
    });
  }
}
