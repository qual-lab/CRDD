/**
 * 検証済みRepositoryから固定Project Context本文を読む。
 * @responsibility 読取り・解析・三Identity照合を閉じ、本文やPathを失敗結果へ返さない。
 * @trace ARCH-000005
 * @boundary 技術的Repository RootとProject Context読取り。
 * @effect 固定本文の読取りだけ。
 * @security 認可やRepository探索を行わず、呼出し元の今回要求範囲に限定する。
 */
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import type { RepositoryManifest } from "../configuration/types.ts";
import { createFilesystemRepositoryObservationPort } from "../repository/create-observer.ts";
import { parseRepositoryProjectContextMarkdown } from "./parse-context.ts";
import type { RepositoryProjectContextReadResult } from "./types.ts";

/**
 * 固定本文を上限付きで読み、今回の期待Identityと照合する。
 * @responsibility 観測不能を欠測や成功へ変換せず、解析済みContextだけを返す。
 * @trace ARCH-000005
 * @input 技術的Root能力と今回要求で検証済みの期待manifest。
 * @returns completedのContext、または固定理由だけのunavailable。
 * @precondition 呼出し元が今回要求の認可を済ませ、能力を再利用しない。
 * @postcondition Project・Repository・役割の完全一致時だけContextを返す。
 * @effect PROJECT_CONTEXT.mdを最大1MiBで同期読取りする。
 * @failure 読取り不能・解析不正・三Identity不一致・下位例外はunavailable。
 * @invariant Context不存在と観測不能を区別したとは主張せず、nullやmissingを生成しない。
 * @boundary 既存Root内観測→Markdown解析→同Processの内容Consumer。
 * @security 任意Path・生Markdown・Root・manifest・下位例外を結果へ透過しない。
 * @concurrency 単一本文の安定読取り。期待manifestとの複数File原子性や再読取りは保証しない。
 */
export function readRepositoryProjectContext(
  root: VerifiedRepositoryRoot,
  expectedManifest: RepositoryManifest,
): RepositoryProjectContextReadResult {
  try {
    const observed = createFilesystemRepositoryObservationPort(
      root,
      1_048_576,
    ).observeFile("PROJECT_CONTEXT.md");
    if (observed.status !== "resolved")
      return Object.freeze({
        status: "unavailable",
        reason: "project_context_observation_unavailable",
      });
    const context = parseRepositoryProjectContextMarkdown(observed.source);
    if (
      context.projectId !== expectedManifest.projectId ||
      context.repositoryId !== expectedManifest.repositoryId ||
      context.repositoryRole !== expectedManifest.repositoryRole
    )
      return Object.freeze({
        status: "unavailable",
        reason: "project_context_identity_mismatch",
      });
    return Object.freeze({ status: "completed", context });
  } catch {
    return Object.freeze({
      status: "unavailable",
      reason: "project_context_read_unavailable",
    });
  }
}
