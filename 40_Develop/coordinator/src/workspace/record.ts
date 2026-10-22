/**
 * Workspaceの現在記録とQueue対象参照を定義する。
 * @responsibility 継続作業と短命のGit処置を既存Snapshotへ閉じる。
 * @trace ARCH-000004
 * @boundary Coordinatorの保存値。Task一覧やGit技術操作は所有しない。
 */

import type {
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
} from "../../../version-control/src/index.ts";
import {
  validWorkspaceDisplayName,
  validWorkspaceCandidateRequest,
} from "../../../version-control/src/index.ts";

/**
 * 一つの固定候補の意図と結果を既存Workspace記録へ結合する。
 * @responsibility 固定・採用・Ref回収の同操作再入場。
 * @trace ARCH-000004
 * @shape 固定要求、段階、候補OID、取込先、結果と採否。
 * @invariant 候補固定と採用を別操作とし名前は固定時の値を保持。
 * @boundary 既存state.jsonのみ。
 * @security 現在認可への再結合なしでEffectを許可しない。
 * @compatibility 新形式のみ、旧記録を補完しない。
 */
export type CoordinatorWorkspaceCandidate = Readonly<{
  request: WorkspaceCandidateRequest;
  phase: "freezing" | "fixed" | "merging" | "merged" | "removing";
  candidateCommit: string | null;
  target: Readonly<{ targetBranch: string; expectedTargetHead: string }> | null;
  mergeCommit: string | null;
  disposition: "adopted" | "rejected" | null;
  lastResult: WorkspaceCandidateResult | null;
  primaryFailure: string | null;
  cleanupFailure: string | null;
}>;

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
export type CoordinatorWorkspace = Readonly<{
  workspaceId: string;
  name: string | null;
  candidate: CoordinatorWorkspaceCandidate | null;
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
export function validCoordinatorWorkspace(
  value: unknown,
): value is CoordinatorWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
    "baseCommit,candidate,generation,head,holdUntil,lastResult,name,pending,phase,primaryFailure,workspaceId"
  )
    return false;
  if (!validWorkspaceDisplayName(record.name)) return false;
  if (
    record.candidate !== null &&
    !validCandidateRecord(record.candidate, record.workspaceId)
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

/**
 * 固定候補の閉じた保存形式と段階相関を検査する。
 * @responsibility 欠落・余剰・別Workspace・不正結果の拒否。
 * @trace ARCH-000004
 * @input value: JSON値、workspaceId: 所属ID。
 * @returns 有効な現在記録か。
 * @precondition JSON decode後。
 * @postcondition 形式検査を認可・実Git観測と同一視しない。
 * @effect N/A: 値検査。
 * @failure 不正はfalse。
 * @invariant 不明を固定済みに補完しない。
 * @boundary 保存codec。
 * @security 同じWorkspaceへ閉じる。
 * @concurrency N/A: 局所処理。
 */
function validCandidateRecord(value: unknown, workspaceId: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (
    Object.keys(c).sort().join(",") !==
      "candidateCommit,cleanupFailure,disposition,lastResult,mergeCommit,phase,primaryFailure,request,target" ||
    !["freezing", "fixed", "merging", "merged", "removing"].includes(
      String(c.phase),
    )
  )
    return false;
  const hash = (v: unknown) =>
    typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(v);
  if (
    !(c.candidateCommit === null || hash(c.candidateCommit)) ||
    !(c.mergeCommit === null || hash(c.mergeCommit)) ||
    ![null, "adopted", "rejected"].includes(c.disposition as null) ||
    (!["freezing", "removing"].includes(String(c.phase)) &&
      c.candidateCommit === null)
  )
    return false;
  const r = c.request;
  if (!validWorkspaceCandidateRequest(r) || r.workspaceId !== workspaceId)
    return false;
  if (
    (typeof c.candidateCommit === "string" &&
      c.candidateCommit.length !== r.baseCommit.length) ||
    (typeof c.mergeCommit === "string" &&
      c.mergeCommit.length !== r.baseCommit.length)
  )
    return false;
  if (
    !(
      c.primaryFailure === null ||
      (typeof c.primaryFailure === "string" &&
        /^(candidate|worktree)_[a-z_]+$/u.test(c.primaryFailure))
    )
  )
    return false;
  if (
    !(
      c.cleanupFailure === null ||
      (typeof c.cleanupFailure === "string" &&
        /^(candidate|worktree)_[a-z_]+$/u.test(c.cleanupFailure))
    )
  )
    return false;
  if (
    ["freezing", "fixed"].includes(String(c.phase)) &&
    (c.target !== null || c.disposition !== null || c.mergeCommit !== null)
  )
    return false;
  if (c.phase === "merged" && c.disposition !== "adopted") return false;
  if (c.phase === "merging" && c.disposition === "rejected") return false;
  if (
    c.phase === "removing" &&
    c.candidateCommit === null &&
    c.disposition !== "rejected"
  )
    return false;
  if (c.target !== null) {
    const target = c.target as Record<string, unknown>;
    if (
      !target ||
      typeof target !== "object" ||
      Object.keys(target).sort().join(",") !==
        "expectedTargetHead,targetBranch" ||
      typeof target.targetBranch !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(target.targetBranch) ||
      !hash(target.expectedTargetHead)
    )
      return false;
  }
  if (["fixed", "merged"].includes(String(c.phase)) && c.lastResult === null)
    return false;
  if (["merging", "merged"].includes(String(c.phase)) && c.target === null)
    return false;
  if (c.phase === "removing" && c.disposition === null) return false;
  if (c.lastResult !== null) {
    const result = c.lastResult as Record<string, unknown>;
    if (
      !result ||
      typeof result !== "object" ||
      Object.keys(result).sort().join(",") !==
        "candidateCommit,candidateRef,changedPaths,cleanupConfirmed,effectIssued,mergeCommit,reason,status,temporary" ||
      !["completed", "blocked"].includes(String(result.status)) ||
      typeof result.reason !== "string" ||
      !/^(candidate|worktree)_[a-z_]+$/u.test(result.reason) ||
      !(result.candidateCommit === null || hash(result.candidateCommit)) ||
      !(result.mergeCommit === null || hash(result.mergeCommit)) ||
      !(
        result.candidateRef === null ||
        result.candidateRef ===
          `refs/heads/crdd/candidate/${workspaceId}/${r.operationId}`
      ) ||
      typeof result.cleanupConfirmed !== "boolean" ||
      typeof result.effectIssued !== "boolean" ||
      !Array.isArray(result.changedPaths) ||
      result.changedPaths.length > 1000 ||
      result.changedPaths.some((p) => typeof p !== "string")
    )
      return false;
    if (result.temporary !== null) {
      const temporary = result.temporary as Record<string, unknown>;
      const prefix = `.crdd/workspaces/${workspaceId}/candidate-index-`;
      if (
        !temporary ||
        typeof temporary !== "object" ||
        Object.keys(temporary).sort().join(",") !== "identity,relativePath" ||
        typeof temporary.relativePath !== "string" ||
        !temporary.relativePath.startsWith(prefix) ||
        !/^[A-Za-z0-9]{6}$/u.test(
          temporary.relativePath.slice(prefix.length),
        ) ||
        !(
          temporary.identity === null ||
          (typeof temporary.identity === "string" &&
            /^[a-f0-9]{64}$/u.test(temporary.identity))
        ) ||
        result.cleanupConfirmed !== false
      )
        return false;
    } else if (result.cleanupConfirmed !== true) return false;
    if (
      result.candidateCommit !== null &&
      result.candidateCommit !== c.candidateCommit
    )
      return false;
    if (result.mergeCommit !== null && result.mergeCommit !== c.mergeCommit)
      return false;
    if (
      c.phase === "fixed" &&
      (result.status !== "completed" ||
        result.cleanupConfirmed !== true ||
        !["candidate_fixed", "candidate_fixed_existing"].includes(
          String(result.reason),
        ) ||
        result.candidateCommit !== c.candidateCommit)
    )
      return false;
    if (
      c.phase === "merged" &&
      (result.status !== "completed" ||
        result.cleanupConfirmed !== true ||
        ![
          "candidate_merged",
          "candidate_merge_existing",
          "candidate_already_integrated",
        ].includes(String(result.reason)) ||
        result.candidateCommit !== c.candidateCommit ||
        (result.mergeCommit === null &&
          result.reason !== "candidate_already_integrated"))
    )
      return false;
  }
  return true;
}
