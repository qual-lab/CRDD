/**
 * Workspaceの現在記録とQueue対象参照を定義する。
 * @responsibility 継続作業と短命のGit処置を既存Snapshotへ閉じる。
 * @trace ARCH-000004
 * @boundary Orchestratorの保存値。Task一覧やGit技術操作は所有しない。
 */
import type { RepositoryWorktreeResult } from "../../../version-control/src/index.ts";

/**
 * Isolated Workspaceの現在値を表す。
 * @responsibility 同UUIDの作成・利用・破棄途中と現在世代を保持する。
 * @trace ARCH-000004
 * @shape ID、世代、Base、HEAD、状態、保留、処置、技術結果。
 * @invariant Task終端で自動除去しない。Task一覧を重複保持しない。
 * @boundary 同じRepositoryのstate.json。
 * @security この記録だけで実行・削除を許可しない。
 * @compatibility 新Snapshot専用。旧形式の補完なし。
 */
export type OrchestratorWorkspace = Readonly<{
  workspaceId: string;
  generation: number;
  baseCommit: string;
  head: string;
  phase: "creating" | "ready" | "discarding";
  holdUntil: string | null;
  pending: Readonly<{
    operationId: string;
    kind: "create" | "discard";
    expectedHead: string;
    discardChanges: boolean;
  }> | null;
  lastResult: RepositoryWorktreeResult | null;
  primaryFailure: string | null;
}>;

/**
 * Workspace現在値の閉じた保存形式を検査する。
 * @responsibility 旧値・欠落・追加項目・不正相関を拒否する。
 * @trace ARCH-000004
 * @input value: 未検証JSON値。
 * @returns 新形式として有効か。
 * @precondition JSONをdecodeした値だけを渡す。
 * @postcondition 形式検査をGit実状態の成立にしない。
 * @effect N/A: 値検査のみ。
 * @failure 不正値はfalse。
 * @invariant unknownを成功に補完しない。
 * @boundary Snapshotのcodec。
 * @security 外部Authorityを作らない。
 * @concurrency N/A: 局所処理。
 */
export function validOrchestratorWorkspace(
  value: unknown,
): value is OrchestratorWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
    "baseCommit,generation,head,holdUntil,lastResult,pending,phase,primaryFailure,workspaceId"
  )
    return false;
  if (
    !(
      record.primaryFailure === null ||
      (typeof record.primaryFailure === "string" &&
        /^worktree_[a-z_]+$/u.test(record.primaryFailure))
    )
  )
    return false;
  if (
    typeof record.workspaceId !== "string" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
      record.workspaceId,
    ) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    ![record.baseCommit, record.head].every(
      (item) =>
        typeof item === "string" &&
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(item),
    ) ||
    !["creating", "ready", "discarding"].includes(String(record.phase)) ||
    !(
      record.holdUntil === null ||
      (typeof record.holdUntil === "string" &&
        Number.isFinite(Date.parse(record.holdUntil)))
    )
  )
    return false;
  if (record.phase === "ready" && record.pending !== null) return false;
  if (record.pending !== null) {
    if (typeof record.pending !== "object" || Array.isArray(record.pending))
      return false;
    const pending = record.pending as Record<string, unknown>;
    if (
      Object.keys(pending).sort().join(",") !==
        "discardChanges,expectedHead,kind,operationId" ||
      typeof pending.operationId !== "string" ||
      !/^[a-f0-9-]{36}$/u.test(pending.operationId) ||
      pending.kind !== (record.phase === "creating" ? "create" : "discard") ||
      pending.expectedHead !== record.head ||
      typeof pending.discardChanges !== "boolean"
    )
      return false;
  } else if (record.phase !== "ready") return false;
  if (record.lastResult !== null) {
    if (
      typeof record.lastResult !== "object" ||
      Array.isArray(record.lastResult)
    )
      return false;
    const result = record.lastResult as Record<string, unknown>;
    if (
      Object.keys(result).sort().join(",") !==
        "branch,branchRemoved,effectIssued,expectedCommit,observation,reason,relativePath,status,workspaceDirectoryRetained,workspaceId,worktreeRemoved" ||
      result.workspaceId !== record.workspaceId ||
      !["completed", "blocked"].includes(String(result.status)) ||
      typeof result.reason !== "string" ||
      !/^worktree_[a-z_]+$/u.test(result.reason) ||
      !(
        result.relativePath === null ||
        result.relativePath ===
          `.crdd/workspaces/${record.workspaceId}/worktree`
      ) ||
      !(
        result.branch === null ||
        result.branch === `crdd/workspace/${record.workspaceId}`
      ) ||
      !(
        result.expectedCommit === null ||
        (typeof result.expectedCommit === "string" &&
          /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(result.expectedCommit))
      ) ||
      typeof result.effectIssued !== "boolean" ||
      ![
        result.worktreeRemoved,
        result.branchRemoved,
        result.workspaceDirectoryRetained,
      ].every((item) => item === null || typeof item === "boolean")
    )
      return false;
    if (result.observation !== null) {
      if (
        !result.observation ||
        typeof result.observation !== "object" ||
        Array.isArray(result.observation)
      )
        return false;
      const observation = result.observation as Record<string, unknown>;
      if (
        Object.keys(observation).sort().join(",") !==
          "branchHead,directoryPresent,dirty,head,locked,prunable,registered" ||
        ![
          observation.registered,
          observation.directoryPresent,
          observation.locked,
          observation.prunable,
        ].every((item) => typeof item === "boolean") ||
        ![observation.head, observation.branchHead].every(
          (item) =>
            item === null ||
            (typeof item === "string" &&
              /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(item)),
        ) ||
        !(observation.dirty === null || typeof observation.dirty === "boolean")
      )
        return false;
    }
  }
  return true;
}
