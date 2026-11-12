/**
 * Workspaceの配置規約とGit技術結果の保存投影を所有する。
 * @responsibility VCへ業務IDを渡さず、既存Path・Branch・DTOを保持する。
 * @trace ARCH-000004
 * @trace ARCH-000009
 */
import fs from "node:fs";
import path from "node:path";
import {
  type RepositoryWorktreeResult,
  validWorkspaceCandidateRequest,
  type WorkspaceCandidateRequest,
  type WorkspaceCandidateResult,
} from "../../../execution-model/src/index.ts";
import { resolveRepositoryRuntimeDataPaths } from "../configuration/runtime-data.ts";
import {
  type CommitTemporary,
  createCommit,
  createReference,
  getRepository,
  mergeCommit,
  type Repository,
  readCommitDiff,
  readRepositoryRevision,
  removeReference,
  resolveVerifiedRepositoryRoot,
  type WorktreeResult,
  type WorktreeTarget,
} from "../../../version-control/src/index.ts";

/** 検証したWorkspace UUIDから上位所有の配置とBranchを導く。Git操作は行わない。 */
export function workspaceWorktreeTarget(workspaceId: string): WorktreeTarget {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(workspaceId))
    throw new Error("worktree_id_invalid");
  return {
    relativePath: `.crdd/workspaces/${workspaceId}/worktree`,
    branch: `crdd/workspace/${workspaceId}`,
  };
}

/** exactなRepositoryの名前付き領域から既存Workspace親を得る。作成はしない。 */
function workspaceDirectory(root: string, workspaceId: string): string {
  workspaceWorktreeTarget(workspaceId);
  const repository = getRepository(root);
  const paths =
    repository.status === "completed"
      ? resolveRepositoryRuntimeDataPaths(repository.capability)
      : null;
  if (paths === null) throw Error("workspace_directory_boundary_invalid");
  return path.join(paths.workspaces, workspaceId);
}

/** 新しいWorkspaceが既存の専用親を引き継がないことを上位で保証する。 */
export function assertWorkspaceDirectoryAvailable(
  root: string,
  workspaceId: string,
): void {
  workspaceWorktreeTarget(workspaceId);
  try {
    fs.lstatSync(workspaceDirectory(root, workspaceId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("worktree_target_exists");
}

/** 既存保存形状へ投影する。廃棄成功時だけ既知のWorkspace親を再照合する。 */
export function workspaceWorktreeResult(
  root: string,
  workspaceId: string,
  value: WorktreeResult,
  removeParent = false,
): RepositoryWorktreeResult {
  let retained = value.parentDirectoryRetained;
  let reason = value.reason;
  let status = value.status;
  if (
    removeParent &&
    status === "completed" &&
    value.worktreeRemoved &&
    value.branchRemoved
  ) {
    const expected = workspaceWorktreeTarget(workspaceId);
    try {
      const parent = workspaceDirectory(root, workspaceId);
      if (
        value.relativePath !== expected.relativePath ||
        value.branch !== expected.branch
      )
        throw new Error();
      let cursor = root;
      for (const segment of path.relative(root, parent).split(path.sep)) {
        cursor = path.join(cursor, segment);
        const info = fs.lstatSync(cursor);
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          fs.realpathSync.native(cursor) !== cursor
        )
          throw new Error();
      }
      if (fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
      try {
        fs.lstatSync(parent);
        retained = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        retained = false;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") retained = false;
      else {
        status = "blocked";
        reason = "worktree_parent_cleanup_unconfirmed";
        retained = null;
      }
    }
  }
  const { parentDirectoryRetained: _parent, ...result } = value;
  return {
    ...result,
    status,
    reason,
    workspaceId,
    workspaceDirectoryRetained: retained,
  };
}

/** 業務IntentをGit技術要求へ投影し、Commit直後に同期CASで保持Refを確保する。 */
export function freezeWorkspaceCandidate(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  previousCommit: string | null = null,
  previousTemporary: CommitTemporary | null = null,
): WorkspaceCandidateResult {
  const reference = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
  let result: WorkspaceCandidateResult = {
    status: "blocked",
    reason: "candidate_input_invalid",
    candidateRef: reference,
    candidateCommit: previousCommit,
    mergeCommit: null,
    effectIssued: false,
    cleanupConfirmed: previousTemporary === null,
    temporary: previousTemporary,
    changedPaths: [],
  };
  if (!validWorkspaceCandidateRequest(request)) return result;
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null)
    return { ...result, reason: "worktree_repository_invalid" };
  const held = readRepositoryRevision(repository, { reference });
  if (held.status !== "completed")
    return {
      ...result,
      reason:
        held.reason === "reference_not_direct"
          ? "candidate_ref_not_direct"
          : "candidate_ref_unavailable",
    };
  if (
    held.present &&
    previousCommit !== null &&
    held.commitId !== previousCommit
  )
    return { ...result, reason: "candidate_ref_mismatch" };
  const fixedCommit = held.commitId ?? previousCommit;
  const target = workspaceWorktreeTarget(request.workspaceId);
  const technical = createCommit(repository, {
    worktree: target,
    baseCommit: request.baseCommit,
    expectedHead: request.expectedWorkspaceHead,
    selection: request.selection,
    message: `Candidate: ${request.candidateName ?? request.operationId}`,
    temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
    previousCommit: fixedCommit,
    temporary: previousTemporary,
  });
  result = {
    ...result,
    status: technical.status,
    reason: technical.reason,
    candidateCommit: technical.commitId ?? fixedCommit,
    effectIssued: technical.effectIssued,
    cleanupConfirmed: technical.cleanupConfirmed,
    temporary: technical.temporary,
    changedPaths: technical.changedPaths,
  };
  // 保存やawaitを挟まず、既知OIDの保持を確保する。保存成功だけでGC保護を主張しない。
  if (technical.commitId !== null) {
    const bound = createReference(repository, {
      name: reference,
      commitId: technical.commitId,
    });
    result = {
      ...result,
      effectIssued: result.effectIssued || bound.effectIssued,
    };
    if (bound.status !== "completed")
      return {
        ...result,
        status: "blocked",
        reason:
          technical.status === "blocked"
            ? technical.reason
            : bound.reason === "reference_update_rejected"
              ? "candidate_git_failed"
              : "candidate_ref_unconfirmed",
      };
  }
  return result;
}

/** 明示的な候補終了を、期待OID付きRef削除と既知の短命Index回収へ投影する。 */
export function removeWorkspaceCandidate(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  expectedCommit: string | null,
  previousTemporary: CommitTemporary | null = null,
): WorkspaceCandidateResult {
  const reference = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
  const result: WorkspaceCandidateResult = {
    status: "blocked",
    reason: "candidate_input_invalid",
    candidateRef: reference,
    candidateCommit: expectedCommit,
    mergeCommit: null,
    effectIssued: false,
    cleanupConfirmed: previousTemporary === null,
    temporary: previousTemporary,
    changedPaths: [],
  };
  if (!validWorkspaceCandidateRequest(request)) return result;
  if (expectedCommit !== null) {
    const verified = createCommit(repository, {
      baseCommit: request.baseCommit,
      expectedHead: request.expectedWorkspaceHead,
      selection: request.selection,
      message: `Candidate: ${request.candidateName ?? request.operationId}`,
      temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
      previousCommit: expectedCommit,
      temporary: previousTemporary,
    });
    if (verified.status !== "completed")
      return {
        ...result,
        reason: verified.reason,
        cleanupConfirmed: verified.cleanupConfirmed,
        temporary: verified.temporary,
      };
    previousTemporary = verified.temporary;
  }
  const removed = removeReference(repository, {
    name: reference,
    expectedCommitId: expectedCommit,
    ...(previousTemporary
      ? {
          temporaryIndex: {
            directory: `.crdd/workspaces/${request.workspaceId}`,
            value: previousTemporary,
          },
        }
      : {}),
  });
  const failureReasons: Readonly<Record<string, string>> = {
    reference_commit_changed: "candidate_ref_mismatch",
    reference_checked_out: "candidate_ref_in_use",
    reference_update_rejected: "candidate_ref_removal_unconfirmed",
    reference_result_unconfirmed: "candidate_ref_removal_unconfirmed",
    reference_not_direct: "candidate_ref_not_direct",
    reference_temporary_cleanup_unconfirmed:
      "commit_temporary_cleanup_unconfirmed",
  };
  return {
    ...result,
    status: removed.status === "completed" ? "completed" : "blocked",
    reason:
      removed.status === "completed"
        ? removed.effectIssued
          ? "candidate_ref_removed"
          : "candidate_ref_absent"
        : (failureReasons[removed.reason] ?? "candidate_ref_unavailable"),
    effectIssued: removed.effectIssued,
    cleanupConfirmed: removed.cleanupConfirmed,
    temporary: removed.temporary,
  };
}

/** 既存採用Intentの内容確認・保持Ref確認を終え、現在RepositoryへMergeを依頼する。 */
export function mergeWorkspaceCandidate(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  target: Readonly<{
    candidateCommit: string;
    targetBranch: string;
    expectedTargetHead: string;
  }>,
): WorkspaceCandidateResult {
  const reference = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
  const result: WorkspaceCandidateResult = {
    status: "blocked",
    reason: "candidate_input_invalid",
    candidateRef: reference,
    candidateCommit: target.candidateCommit,
    mergeCommit: null,
    effectIssued: false,
    cleanupConfirmed: true,
    temporary: null,
    changedPaths: [],
  };
  if (!validWorkspaceCandidateRequest(request)) return result;
  const held = readRepositoryRevision(repository, { reference });
  if (held.status !== "completed")
    return {
      ...result,
      reason:
        held.reason === "reference_not_direct"
          ? "candidate_ref_not_direct"
          : "candidate_ref_unavailable",
    };
  if (held.commitId !== target.candidateCommit)
    return { ...result, reason: "candidate_ref_mismatch" };
  const fixed = createCommit(repository, {
    baseCommit: request.baseCommit,
    expectedHead: request.expectedWorkspaceHead,
    selection: request.selection,
    message: `Candidate: ${request.candidateName ?? request.operationId}`,
    temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
    previousCommit: target.candidateCommit,
  });
  if (fixed.status !== "completed") return { ...result, reason: fixed.reason };
  const message = [
    `Merge Candidate: ${request.candidateName ?? request.operationId}`,
    "",
    ...(request.workspaceName ? [`Workspace: ${request.workspaceName}`] : []),
    `Workspace-ID: ${request.workspaceId}`,
    `Base-Commit: ${request.baseCommit}`,
    `Candidate-Commit: ${target.candidateCommit}`,
    ...request.relatedChangeIds.map((id) => `Related-CHG: ${id}`),
  ].join("\n");
  const merged = mergeCommit(repository, {
    baseCommit: request.baseCommit,
    sourceCommit: target.candidateCommit,
    targetBranch: target.targetBranch,
    expectedHead: target.expectedTargetHead,
    message,
  });
  return {
    ...result,
    status: merged.status,
    reason: merged.reason,
    mergeCommit: merged.commitId,
    effectIssued: merged.effectIssued,
    changedPaths: fixed.changedPaths,
  };
}

/** 保存済み候補の選択相関を確認してから、固定Objectの差分だけを返す。 */
export function readWorkspaceCandidatePatch(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  commit: string,
  selectedPath: string,
) {
  if (!validWorkspaceCandidateRequest(request))
    throw Error("candidate_input_invalid");
  const selection = request.selection.find(
    (item) => item.path === selectedPath,
  );
  if (!selection) throw Error("candidate_path_invalid");
  const verified = createCommit(repository, {
    baseCommit: request.baseCommit,
    expectedHead: request.expectedWorkspaceHead,
    selection: request.selection,
    message: `Candidate: ${request.candidateName ?? request.operationId}`,
    temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
    previousCommit: commit,
  });
  if (verified.status !== "completed") throw Error(verified.reason);
  const diff = readCommitDiff(repository, {
    baseCommit: request.baseCommit,
    commitId: commit,
    path: selectedPath,
  });
  return {
    baseCommit: diff.baseCommit,
    head: commit,
    candidateCommit: commit,
    selection,
    content: null,
    binary: diff.binary,
    patch: diff.patch,
  };
}
