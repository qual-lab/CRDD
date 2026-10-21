/**
 * 一般Task検証が所有する独立Worktreeを既存Git操作へ接続する。
 * @responsibility 上位Toolだけが作成・成果読取り・明示終了を所有する。
 * @trace ARCH-000004 ARCH-000009
 * @boundary 自己生成するRepository-local Worktree。Providerの実行・回収は所有しない。
 */
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, lstatSync } from "node:fs";
import path from "node:path";
import { resolveRepositoryRuntimeDataPaths } from "../../domain-model/src/index.ts";
import {
  verifyRepositoryRoot,
  createRepositoryWorktree,
  disposeRepositoryWorktree,
  inspectWorkspaceFile,
} from "../../version-control/src/index.ts";
import type { BorrowedExecutionTarget } from "../src/execution/borrowed-tree.ts";

/** 一回の検証Toolが所有する作成結果。新しい永続台帳ではない。 */
export type VerificationWorkspacePreparation = Readonly<{
  target: BorrowedExecutionTarget;
  prepared: boolean;
  cleanupConfirmed: boolean;
}>;

/**
 * 各検証経路へ異なるUUIDと固定BaseのWorktreeを用意する。
 * @responsibility 共有dirtyを複製せず、作成結果不明でも同じ対象を返す。
 * @trace ARCH-000004 ARCH-000009
 * @input 所属Root、固定Base Commit。
 * @returns 解決済み対象と作成・不存在確認の状態。
 * @effect VC標準APIによる専用WorktreeとBranchの作成。
 * @failure 失敗時は対象UUIDを保持し、再作成しない。
 * @invariant CoordinatorへWorkspace管理を渡さない。
 */
export function prepareVerificationWorkspace(
  root: string,
  baseCommit: string,
): VerificationWorkspacePreparation {
  const workspaceId = randomUUID();
  const verified = verifyRepositoryRoot(root);
  if (verified.status !== "completed")
    throw new Error("verification_workspace_root_invalid");
  const paths = resolveRepositoryRuntimeDataPaths(verified.capability);
  if (!paths) throw new Error("verification_workspace_root_invalid");
  const target = Object.freeze({
    workspaceId,
    ownerRepositoryRoot: root,
    executionTree: path.join(paths.workspaces, workspaceId, "worktree"),
    baseCommit,
    head: baseCommit,
  });
  const created = createRepositoryWorktree(verified.capability, {
    workspaceId,
    baseCommit,
  });
  return {
    target,
    prepared: created.status === "completed",
    cleanupConfirmed: false,
  };
}

/**
 * 固定Pathの実内容とGit観測を同じ解決済み対象から読む。
 * @responsibility Bundle化や永続保存をせず、実Byteを検証側へ返す。
 * @trace ARCH-000004 ARCH-000009
 * @input 上位で作った対象、固定相対Path、Taskの変更観測。
 * @returns 内容を含むTool内部の短命な観測。公開結果へ本文を渡さない。
 * @effect 既存VCによるGit読取りと固定File読取り。
 * @failure link・差替え・別HEAD・欠測はthrow。
 * @invariant この観測だけで採用・回収成功を判断しない。
 */
export function readVerificationWorkspaceOutput(
  target: BorrowedExecutionTarget,
  relativePath: string,
  result: Readonly<Record<string, unknown>>,
) {
  if (target.workspaceId === null || target.baseCommit === null)
    throw new Error("verification_workspace_target_invalid");
  const verified = verifyRepositoryRoot(target.ownerRepositoryRoot);
  if (verified.status !== "completed")
    throw new Error("verification_workspace_root_invalid");
  const observed = inspectWorkspaceFile(
    verified.capability,
    target.workspaceId,
    target.baseCommit,
    relativePath,
  );
  if (
    observed.head !== target.head ||
    observed.binary ||
    observed.content === null
  )
    throw new Error("verification_workspace_output_unobserved");
  const file = path.join(target.executionTree, ...relativePath.split("/"));
  const before = lstatSync(file);
  const bytes = readFileSync(file);
  const after = lstatSync(file);
  if (
    !after.isFile() ||
    after.isSymbolicLink() ||
    after.nlink !== 1 ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    after.size !== bytes.length ||
    !Buffer.from(observed.content, "utf8").equals(bytes)
  )
    throw new Error("verification_workspace_output_changed");
  const workspace = result.workspaceResult as Readonly<
    Record<string, unknown>
  > | null;
  return Object.freeze({
    status: "observed",
    workspaceId: target.workspaceId,
    baseCommit: observed.baseCommit,
    head: observed.head,
    changedPaths: workspace?.changedPaths ?? null,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
  });
}

/**
 * 技術回収を確認したTaskの自己生成Worktreeだけを明示終了する。
 * @responsibility Provider回収とGit作業領域回収を混同しない。
 * @trace ARCH-000004 ARCH-000009
 * @input 元対象と同Taskの確定結果。
 * @returns Git登録・専用Branch・Directoryの終了確認、又は保持。
 * @effect 成立条件を満たす場合だけ既存VCの明示破棄を一回呼ぶ。
 * @failure Task終了又は対象が不明なら処置しない。
 * @invariant 借用対象の回収をCoordinatorへ持たせない。
 */
export function closeVerificationWorkspace(
  target: BorrowedExecutionTarget,
  result: Readonly<Record<string, unknown>>,
) {
  if (
    target.workspaceId === null ||
    target.head === null ||
    (result.status !== "completed" && result.status !== "blocked") ||
    result.cleanupConfirmed !== true ||
    result.manualRecoveryRequired !== false ||
    result.processRestartRequired !== false ||
    result.canonicalRepositoryChanged !== false ||
    result.processTerminationObserved === false ||
    result.hostRecoveryId !== null ||
    result.dockerRecoveryId !== null ||
    result.candidateRecoveryId !== null ||
    result.candidateStoreRecoveryId !== null ||
    !Array.isArray(result.dockerRecoveryIds) ||
    result.dockerRecoveryIds.length !== 0 ||
    !result.workspaceResult ||
    typeof result.workspaceResult !== "object" ||
    (result.workspaceResult as Record<string, unknown>).workspaceId !==
      target.workspaceId ||
    (result.workspaceResult as Record<string, unknown>)
      .workspaceDeletionIssued !== false ||
    (result.workspaceResult as Record<string, unknown>)
      .canonicalRepositoryChanged !== false
  )
    return Object.freeze({ status: "retained", cleanupConfirmed: false });
  const verified = verifyRepositoryRoot(target.ownerRepositoryRoot);
  if (verified.status !== "completed")
    return Object.freeze({ status: "retained", cleanupConfirmed: false });
  const closed = disposeRepositoryWorktree(verified.capability, {
    workspaceId: target.workspaceId,
    expectedHead: target.head,
    discardChanges: true,
  });
  const removed =
    closed.status === "completed" &&
    closed.worktreeRemoved === true &&
    closed.branchRemoved === true &&
    closed.workspaceDirectoryRetained === false;
  return Object.freeze({
    status: removed ? "discarded" : "retained",
    cleanupConfirmed: removed,
  });
}
