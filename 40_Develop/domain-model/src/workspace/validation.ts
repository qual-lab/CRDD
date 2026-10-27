/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { CoordinatorWorkspace } from "./types.ts";
import type { CoordinatorResultRecord } from "./types.ts";
import { createHash } from "node:crypto";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import type { WorkspaceCandidateRequest } from "./types.ts";

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
 * 公開結果の閉じた保存値を確認する。
 * @responsibility 旧入力と統合保存で同じ結果契約を検証する。
 * @trace ARCH-000005
 * @input value: JSONから復号した値。
 * @returns 既存結果Recordとして有効か。
 * @precondition getterやtoJSONを持たないJSON値を渡す。
 * @postcondition 結合ID、kind、Identity、内容Hashを確認する。
 * @effect N/A: 値の検証のみ。
 * @failure 不正形状はfalse。
 * @invariant 結果Recordの受理を実適用や既読へ読み替えない。
 * @boundary 保存JSONと既存結果契約。
 * @security Authorityを生成しない。
 * @concurrency N/A: 同期の純粋検証。
 */
export function validCoordinatorResultRecord(
  value: unknown,
): value is CoordinatorResultRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    JSON.stringify(Object.keys(record).sort()) ===
      JSON.stringify(
        [
          "contract",
          "kind",
          "repositoryBindingId",
          "projectId",
          "milestoneId",
          "queueId",
          "identity",
          "contentHash",
          "value",
        ].sort(),
      ) &&
    record.contract === COORDINATOR_INTEGRATION_CONTRACT &&
    (record.kind === "integration" || record.kind === "adoption") &&
    typeof record.identity === "string" &&
    INTEGRATION_RECORD_IDENTITY.test(record.identity) &&
    [record.repositoryBindingId, record.projectId, record.queueId].every(
      (id) => typeof id === "string" && INTEGRATION_BINDING_IDENTITY.test(id),
    ) &&
    ((typeof record.milestoneId === "string" &&
      INTEGRATION_BINDING_IDENTITY.test(record.milestoneId)) ||
      (record.milestoneId === null &&
        record.kind === "adoption" &&
        record.value !== null &&
        typeof record.value === "object" &&
        ["workspace-candidate", "workspace-candidate-close"].includes(
          String((record.value as Record<string, unknown>).recordKind),
        ))) &&
    record.contentHash ===
      createHash("sha256")
        .update(encodeRuntimeStateValue(record.value))
        .digest("hex")
  );
}

/**
 * 説明用の一行名を検査する。
 * @responsibility 制御文字・空名・過大入力をMessageへ流さない。
 * @trace ARCH-000009
 * @input value: 任意表示名。
 * @returns 説明用として有効か。
 * @precondition N/A: 未検証値も受け付ける。
 * @postcondition Identity・認可判定は変えない。
 * @effect N/A: 値検査。
 * @failure 不正値はfalse。
 * @invariant nullは名前省略。
 * @boundary 同一Process。
 * @security Shell・Ref用の安全性を意味しない。
 * @concurrency N/A: 状態なし。
 */
export function validWorkspaceDisplayName(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.trim() === value &&
      value.length > 0 &&
      [...value].length <= 120 &&
      !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
  );
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
export function validCandidateRecord(
  value: unknown,
  workspaceId: unknown,
): boolean {
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

export const COORDINATOR_INTEGRATION_CONTRACT =
  "crdd-coordinator/orchestrator-integration/v1" as const;

export const INTEGRATION_RECORD_IDENTITY =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/u;

export const INTEGRATION_BINDING_IDENTITY =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

/**
 * 固定要求の閉じた値契約を保存前とGit発行前で共用する。
 * @responsibility 管理Path・重複・欠測と明示削除の混同を拒否する。
 * @trace ARCH-000009
 * @input value: 未検証JSON値。
 * @returns 固定要求として有効か。
 * @precondition N/A: 未検証値を受け付ける。
 * @postcondition 内容実測・認可・Git実体確認は別に残す。
 * @effect N/A: 値検査。
 * @failure 不正はfalse。
 * @invariant 形式成立をEffect許可にしない。
 * @boundary VC／既存Snapshot codec。
 * @security Directory・glob・管理Pathを拒否。
 * @concurrency N/A: 局所値だけ。
 */
export function validWorkspaceCandidateRequest(
  value: unknown,
): value is WorkspaceCandidateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).sort().join(",") !==
      "baseCommit,candidateName,expectedWorkspaceHead,operationId,relatedChangeIds,selection,workspaceId,workspaceName" ||
    typeof r.operationId !== "string" ||
    !uuid.test(r.operationId) ||
    typeof r.workspaceId !== "string" ||
    !uuid.test(r.workspaceId) ||
    typeof r.baseCommit !== "string" ||
    !oid.test(r.baseCommit) ||
    typeof r.expectedWorkspaceHead !== "string" ||
    !oid.test(r.expectedWorkspaceHead) ||
    r.baseCommit.length !== r.expectedWorkspaceHead.length ||
    !validWorkspaceDisplayName(r.workspaceName) ||
    !validWorkspaceDisplayName(r.candidateName) ||
    !Array.isArray(r.relatedChangeIds) ||
    r.relatedChangeIds.length > 20 ||
    r.relatedChangeIds.some(
      (id) => typeof id !== "string" || !/^CHG-\d{6}$/u.test(id),
    ) ||
    new Set(r.relatedChangeIds).size !== r.relatedChangeIds.length ||
    !Array.isArray(r.selection) ||
    r.selection.length < 1 ||
    r.selection.length > 1000
  )
    return false;
  const selected = new Set<string>();
  for (const item of r.selection) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).sort().join(",") !== "blobId,mode,path" ||
      typeof item.path !== "string" ||
      item.path.length > 1000 ||
      item.path
        .split("/")
        .some(
          (segment: string) =>
            !segment ||
            segment === "." ||
            segment === ".." ||
            segment.trim() !== segment ||
            /[. ]$/u.test(segment) ||
            /^\.(?:git|crdd)$/iu.test(segment) ||
            /[\\:\x00-\x1f\x7f*?[\]]/u.test(segment),
        ) ||
      !(
        (item.blobId === null && item.mode === null) ||
        (typeof item.blobId === "string" &&
          oid.test(item.blobId) &&
          item.blobId.length === r.baseCommit.length &&
          ["100644", "100755"].includes(item.mode))
      )
    )
      return false;
    const key = item.path.toLowerCase();
    if (selected.has(key)) return false;
    selected.add(key);
  }
  return true;
}

export const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

/**
 * Workspaceの固定Commit ID文法を検査する。
 * @responsibility SHA-1／SHA-256の既存閉形式だけを判定する。
 * @trace ARCH-000004
 * @input value: 未信頼のCommit ID候補。
 * @returns 固定文法に一致する文字列だけtrue。
 * @precondition N/A: 任意値を拒否できる。
 * @postcondition 検査に使う可変実体を利用側へ返さない。
 * @effect N/A: 純粋な値検査。
 * @failure 不正値はfalse。
 * @invariant 文法一致からCommitの存在・採用・権限を推定しない。
 * @boundary Domainの値とVersion Controlの技術操作。
 * @security 正規表現の変更口を公開しない。
 * @concurrency N/A: 共有可変状態を更新しない。
 */
export function isWorkspaceCommitId(value: unknown): value is string {
  return typeof value === "string" && oid.test(value);
}
