/**
 * 実行側が使う作業領域の状態と受入条件を扱う。
 * @responsibility 実行先と既存の採用結果を現在の状態に照合する。
 * @trace ARCH-000004, ARCH-000005
 */
import path from "node:path";
import { readState } from "../../../execution-model/src/index.ts";
import {
  getRepository,
  getWorktree,
} from "../../../version-control/src/index.ts";
import { resolveExecutionStorageDirectory } from "./host.ts";
import type { PreparedWorkspaceTarget } from "./types.ts";
import { snapshotPlainRecord } from "./validation.ts";

/** 待機を跨ぐ実行先を、同一Processから受け取ったデータ値だけで固定する。 @trace ARCH-000005 */
export function capturePreparedWorkspaceTarget(
  value: unknown,
): PreparedWorkspaceTarget | null {
  const target = snapshotPlainRecord(
    value,
    new Set([
      "workspaceId",
      "ownerRepositoryRoot",
      "executionTree",
      "baseCommit",
      "worktree",
    ]),
  );
  if (
    !target ||
    typeof target.workspaceId !== "string" ||
    typeof target.ownerRepositoryRoot !== "string" ||
    typeof target.executionTree !== "string" ||
    typeof target.baseCommit !== "string"
  )
    return null;
  const worktree = snapshotPlainRecord(
    target.worktree,
    new Set(["relativePath", "branch"]),
  );
  if (
    !worktree ||
    typeof worktree.relativePath !== "string" ||
    typeof worktree.branch !== "string"
  )
    return null;
  return Object.freeze({
    workspaceId: target.workspaceId,
    ownerRepositoryRoot: target.ownerRepositoryRoot,
    executionTree: target.executionTree,
    baseCommit: target.baseCommit,
    worktree: Object.freeze({
      relativePath: worktree.relativePath,
      branch: worktree.branch,
    }),
  });
}

/**
 * 計画の品質受入に必要な既存Git採用記録を再観測する。
 * @responsibility 元計画・Queue・Workspace・固定候補・取込HEADを結合する。
 * @trace ARCH-000005
 * @trace ARCH-000004
 * @input 所属Root、Repository結合、Project／Milestone、元計画Revision、現在HEAD。
 * @returns Direct又は同じ計画の明示採用を確認できた場合だけtrue。
 * @effect 既存Snapshotの読取りのみ。Git変更・Task開始なし。
 * @failure 欠測・別対象・採用前・別HEADはfalse。
 * @invariant 候補Refの現存を要求せず、Git採用を品質受入へ昇格しない。
 */
export function workspacePlanReadyForAcceptance(
  root: string,
  binding: string,
  projectId: string,
  milestoneId: string,
  planRevision: string,
  currentHead: string,
): boolean {
  const read = readState(
    resolveExecutionStorageDirectory(root),
    binding,
    "workspace",
  );
  if (read.status !== "completed" || !read.value) return false;
  const plan = read.value.projects.find(
    (p) => p.projectId === projectId && p.milestoneId === milestoneId,
  );
  if (!plan || plan.repositoryRevision !== planRevision) return false;
  const queues = read.value.queueEntries.filter(
    (q) =>
      q.projectId === projectId &&
      q.milestoneId === milestoneId &&
      q.state === "integration_pending",
  );
  if (queues.length !== 1) return false;
  const queue = queues[0];
  if (!queue || queue.ownerGeneration !== null) return false;
  if (queue.workspaceId == null) return currentHead === planRevision;
  const adopted = read.value.results.filter((entry) => {
    if (
      entry.kind !== "adoption" ||
      entry.repositoryBindingId !== binding ||
      entry.projectId !== projectId ||
      entry.milestoneId !== milestoneId ||
      entry.queueId !== queue.queueId
    )
      return false;
    const value = entry.value as Record<string, unknown> | null;
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).sort().join(",") !==
        "candidateCommit,disposition,mergeCommit,primaryFailure,recordKind,request,target" ||
      value.recordKind !== "workspace-candidate" ||
      value.disposition !== "adopted" ||
      value.mergeCommit !== currentHead ||
      typeof value.candidateCommit !== "string" ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value.candidateCommit) ||
      !value.request ||
      typeof value.request !== "object" ||
      Array.isArray(value.request)
    )
      return false;
    const request = value.request as Record<string, unknown>;
    if (
      typeof request.workspaceId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
        request.workspaceId,
      ) ||
      typeof request.operationId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
        request.operationId,
      ) ||
      typeof request.baseCommit !== "string" ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(request.baseCommit)
    )
      return false;
    const target = value.target as Record<string, unknown> | null;
    return (
      request.workspaceId === queue.workspaceId &&
      request.baseCommit === planRevision &&
      entry.identity === `workspace-candidate-${request.operationId}` &&
      target !== null &&
      typeof target === "object" &&
      Object.keys(target).sort().join(",") ===
        "expectedTargetHead,targetBranch" &&
      typeof target.targetBranch === "string" &&
      typeof target.expectedTargetHead === "string" &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(target.expectedTargetHead)
    );
  });
  return adopted.length === 1;
}

/**
 * Queueの現在対象から保存Rootと実行Treeを分離して返す。
 * @responsibility Lease取得後・Task搬送前のfreshなWorkspace照合。
 * @trace ARCH-000004
 * @input 所属Root、Repository結合、Queue ID。
 * @returns 内部用の対象投影又は拒否。
 * @precondition 呼出し元が実行用の既存Leaseを保持する。
 * @postcondition 不明・処置中・保留のWorkspaceへ実行を渡さない。
 * @effect Git／Snapshot読取りのみ。
 * @failure 別Branch、対象消失、未接続は停止。
 * @invariant 保存RootをWorktreeへ変えない。
 * @boundary 保存OwnerとTask搬送。
 * @security Host Pathは内部入力専用、Surfaceへ直接公開しない。
 * @concurrency 結果は再利用せずTaskごとに観測する。
 */
export function confirmPreparedWorkspaceTarget(
  ownerRepositoryRoot: string,
  binding: string,
  queueId: string,
  prepared?: PreparedWorkspaceTarget | null,
) {
  const failed = (reason: string) => ({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
  const snapshot = readState(
    resolveExecutionStorageDirectory(ownerRepositoryRoot),
    binding,
    "workspace",
  );
  if (snapshot.status !== "completed" || !snapshot.value)
    return failed(snapshot.reason);
  const queue = snapshot.value.queueEntries.find(
    (entry) => entry.queueId === queueId,
  );
  if (!queue) return failed("coordinator_workspace_queue_missing");
  if (["completed", "cancelled"].includes(queue.state))
    return failed("coordinator_workspace_queue_closed");
  if (queue.workspaceId == null) {
    if (prepared?.workspaceId != null)
      return failed("coordinator_workspace_target_changed");
    return {
      status: "completed" as const,
      reason: "coordinator_direct_target",
      value: {
        workspaceId: null,
        ownerRepositoryRoot,
        executionTree: ownerRepositoryRoot,
        baseCommit: null,
        head: null,
      },
    };
  }
  const record = snapshot.value.workspaces.find(
    (entry) => entry.workspaceId === queue.workspaceId,
  );
  if (
    record?.phase !== "ready" ||
    record.holdUntil !== null ||
    (record.candidate && !["fixed", "merged"].includes(record.candidate.phase))
  )
    return failed("coordinator_workspace_not_ready");
  if (
    !prepared ||
    prepared.ownerRepositoryRoot !== ownerRepositoryRoot ||
    prepared.workspaceId !== record.workspaceId ||
    prepared.baseCommit !== record.baseCommit ||
    prepared.worktree.relativePath !== record.lastResult?.relativePath ||
    prepared.worktree.branch !== record.lastResult?.branch
  )
    return failed("coordinator_workspace_target_changed");
  const verified = getRepository(ownerRepositoryRoot);
  if (verified.status !== "completed")
    return failed("coordinator_workspace_root_invalid");
  const git = getWorktree(verified.capability, prepared.worktree, "target");
  if (
    git.status !== "completed" ||
    git.relativePath === null ||
    git.observation?.registered !== true ||
    !git.observation.directoryPresent ||
    git.observation.locked ||
    git.observation.prunable ||
    path.join(ownerRepositoryRoot, git.relativePath) !==
      prepared.executionTree ||
    git.observation.head === null ||
    git.observation.branchHead !== git.observation.head
  )
    return failed("coordinator_workspace_target_changed");
  return {
    status: "completed" as const,
    reason: "coordinator_isolated_target",
    value: {
      workspaceId: prepared.workspaceId,
      ownerRepositoryRoot: prepared.ownerRepositoryRoot,
      executionTree: prepared.executionTree,
      baseCommit: prepared.baseCommit,
      head: git.observation.head,
    },
  };
}
