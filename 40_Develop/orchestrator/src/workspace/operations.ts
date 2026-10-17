/**
 * 既存Queueの操作区間からWorkspace保存とGit処置を接続する。
 * @responsibility 意図保存、VC呼出し、結果保存、既存Lease解放。
 * @trace ARCH-000004
 * @boundary 所属Repositoryの保存Rootと独立した実行Tree。
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createRepositoryWorktree,
  disposeRepositoryWorktree,
  observeRepositoryWorktree,
  inspectGitRepositoryLayoutCandidate,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import type { RepositoryWorktreeResult } from "../../../version-control/src/index.ts";
import {
  acquireOrchestratorSnapshotLease,
  readOrchestratorSnapshot,
  writeOrchestratorWorkspaceRecord,
} from "../storage/current-state.ts";
import type { OrchestratorWorkspace } from "./record.ts";

/**
 * 既存Queueに結合したWorkspace操作入力。
 * @responsibility 任意Pathと暗黙作成を受け付けない。
 * @trace ARCH-000004
 * @shape 所属Root・Repository／Project／Queue・UUIDと明示操作。
 * @invariant 採用済みという申告だけでは削除しない。
 * @boundary 内部Package API。Surfaceの認可は呼出し元。
 * @security Root文字列は検証後にだけ使用する。
 * @compatibility 新しい独立Serverや入口は追加しない。
 */
export type OrchestratorWorkspaceRequest = Readonly<{
  ownerRepositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  workspaceId: string;
}> &
  (
    | { operation: "create"; baseCommit: string }
    | { operation: "observe" }
    | { operation: "discard"; expectedHead: string; discardChanges?: boolean }
    | { operation: "hold"; until: string | null }
    | { operation: "adopted" }
  );

/**
 * 同じSnapshotと既存操作Leaseを用いてWorkspaceを処置する。
 * @responsibility Git結果と保存結果を分離し、同IDの再入場情報を返す。
 * @trace ARCH-000004
 * @input request: 実在するProject／Queueの明示操作。
 * @returns 一次理由、現在値、Git段階とLease解放結果。
 * @precondition 上位が認可・破棄の決定権限を確認する。
 * @postcondition 未確定保存を成功にせず、Task終端だけでは削除しない。
 * @effect 既存stateと専用Worktree／Refの更新。
 * @failure 採用証拠未接続・使用中・保留・不明は停止。
 * @invariant 新Lock／台帳なし、Git中は短期Snapshot排他を解放する。
 * @boundary Orchestrator→VC公開APIと既存Writer。
 * @security Directの通常Treeを削除しない。
 * @concurrency 既存binding-wide操作Leaseを維持する。
 */
export function manageOrchestratorWorkspace(
  request: OrchestratorWorkspaceRequest,
) {
  const result = {
    status: "blocked" as "completed" | "blocked",
    reason: "orchestrator_workspace_input_invalid",
    workspaceId: request.workspaceId,
    workspace: null as OrchestratorWorkspace | null,
    gitResult: null as RepositoryWorktreeResult | null,
    leaseReleased: null as boolean | null,
    manualRecoveryRequired: false,
    recoveryId: null as string | null,
    releaseFailure: null as string | null,
    releaseRecoveryId: null as string | null,
  };
  if (request.operation === "adopted")
    return {
      ...result,
      reason: "orchestrator_workspace_adoption_not_connected",
    };
  const verified = verifyRepositoryRoot(request.ownerRepositoryRoot);
  const layout = inspectGitRepositoryLayoutCandidate({
    repositoryRoot: request.ownerRepositoryRoot,
  });
  if (
    verified.status !== "completed" ||
    layout.status !== "candidate" ||
    layout.layout?.kind === "linked_worktree"
  )
    return result;
  const initial = readOrchestratorSnapshot(
    request.ownerRepositoryRoot,
    request.repositoryBindingId,
  );
  if (initial.status !== "completed" || !initial.value)
    return {
      ...result,
      reason: initial.reason,
      manualRecoveryRequired:
        initial.status === "blocked" && initial.manualRecoveryRequired,
      recoveryId: initial.status === "blocked" ? initial.recoveryId : null,
    };
  const lease = acquireOrchestratorSnapshotLease(
    request.ownerRepositoryRoot,
    request.repositoryBindingId,
    request.projectId,
    request.queueId,
    "project-operation",
  );
  if (lease.status !== "completed")
    return {
      ...result,
      reason: lease.reason,
      manualRecoveryRequired: lease.manualRecoveryRequired,
      recoveryId: lease.recoveryId,
    };
  try {
    const observed = readOrchestratorSnapshot(
      request.ownerRepositoryRoot,
      request.repositoryBindingId,
    );
    if (observed.status !== "completed" || !observed.value) {
      result.manualRecoveryRequired =
        observed.status === "blocked" && observed.manualRecoveryRequired;
      result.recoveryId =
        observed.status === "blocked" ? observed.recoveryId : null;
      throw new Error(observed.reason);
    }
    let record =
      observed.value.workspaces.find(
        (entry) => entry.workspaceId === request.workspaceId,
      ) ?? null;
    const save = (next: OrchestratorWorkspace | null) => {
      const saved = writeOrchestratorWorkspaceRecord(
        request.ownerRepositoryRoot,
        request.repositoryBindingId,
        request.projectId,
        request.queueId,
        lease.value.ownerGeneration,
        request.workspaceId,
        record?.generation ?? 0,
        next,
      );
      if (saved.status !== "completed") {
        result.manualRecoveryRequired = saved.manualRecoveryRequired;
        result.recoveryId = saved.recoveryId;
        throw new Error(saved.reason);
      }
      record = saved.value;
      result.workspace = record;
    };
    if (request.operation === "create") {
      if (record) throw new Error("orchestrator_workspace_already_recorded");
      save({
        workspaceId: request.workspaceId,
        generation: 1,
        baseCommit: request.baseCommit,
        head: request.baseCommit,
        phase: "creating",
        holdUntil: null,
        pending: {
          operationId: randomUUID(),
          kind: "create",
          expectedHead: request.baseCommit,
          discardChanges: false,
        },
        lastResult: null,
        primaryFailure: null,
      });
      result.gitResult = createRepositoryWorktree(verified.capability, {
        workspaceId: request.workspaceId,
        baseCommit: request.baseCommit,
      });
    } else {
      if (!record) throw new Error("orchestrator_workspace_not_found");
      if (request.operation === "hold") {
        if (
          record.phase !== "ready" ||
          (request.until !== null &&
            !Number.isFinite(Date.parse(request.until)))
        )
          throw new Error("orchestrator_workspace_hold_invalid");
        save({
          ...record,
          generation: record.generation + 1,
          holdUntil: request.until,
        });
      } else if (request.operation === "discard") {
        if (record.holdUntil !== null)
          throw new Error("orchestrator_workspace_held");
        if (
          record.head !== request.expectedHead ||
          (record.pending?.kind === "discard" &&
            record.pending.discardChanges !== (request.discardChanges === true))
        )
          throw new Error("orchestrator_workspace_discard_mismatch");
        save({
          ...record,
          generation: record.generation + 1,
          phase: "discarding",
          pending:
            record.pending?.kind === "discard"
              ? record.pending
              : {
                  operationId: randomUUID(),
                  kind: "discard",
                  expectedHead: request.expectedHead,
                  discardChanges: request.discardChanges === true,
                },
        });
        result.gitResult = disposeRepositoryWorktree(verified.capability, {
          workspaceId: request.workspaceId,
          expectedHead: request.expectedHead,
          discardChanges: request.discardChanges === true,
        });
      } else
        result.gitResult = observeRepositoryWorktree(
          verified.capability,
          request.workspaceId,
        );
    }
    if (result.gitResult && record) {
      const gitResult = result.gitResult;
      const git = gitResult.observation;
      const ready =
        request.operation !== "discard" &&
        record.phase !== "discarding" &&
        gitResult.status === "completed" &&
        git?.registered === true &&
        git.directoryPresent &&
        git.head !== null &&
        git.head === git.branchHead &&
        (record.phase !== "creating" ||
          (git.head === record.baseCommit &&
            git.head === record.pending?.expectedHead &&
            git.dirty === false &&
            !git.locked &&
            !git.prunable));
      save({
        ...record,
        generation: record.generation + 1,
        head: ready && git?.head ? git.head : record.head,
        phase: ready ? "ready" : record.phase,
        pending: ready ? null : record.pending,
        lastResult: gitResult,
        primaryFailure:
          record.primaryFailure ??
          (gitResult.status === "blocked" ? gitResult.reason : null),
      });
      if (request.operation === "discard" && gitResult.status === "completed") {
        if (gitResult.workspaceDirectoryRetained)
          throw new Error("orchestrator_workspace_materials_retained");
        save(null);
      }
      if (gitResult.status !== "completed") throw new Error(gitResult.reason);
      if (record?.phase === "creating")
        throw new Error("orchestrator_workspace_creation_unconfirmed");
    }
    result.status = "completed";
    result.reason = "orchestrator_workspace_operation_completed";
    result.workspace = record;
  } catch (error) {
    result.reason =
      error instanceof Error && /^[a-z_]+$/u.test(error.message)
        ? error.message
        : "orchestrator_workspace_operation_unconfirmed";
    // 返却値が未確定でも、保存された同UUIDの意図は消さない。
  } finally {
    try {
      const released = lease.value.release();
      result.leaseReleased = released.status === "completed";
      if (released.status !== "completed") {
        if (result.status === "completed") result.reason = released.reason;
        result.releaseFailure = released.reason;
        result.releaseRecoveryId = released.recoveryId;
        result.manualRecoveryRequired ||= released.manualRecoveryRequired;
        result.recoveryId ??= released.recoveryId;
        result.status = "blocked";
      }
    } catch {
      if (result.status === "completed")
        result.reason = "orchestrator_workspace_lease_release_unconfirmed";
      result.releaseFailure =
        "orchestrator_workspace_lease_release_unconfirmed";
      result.leaseReleased = false;
      result.manualRecoveryRequired = true;
      result.status = "blocked";
    }
  }
  return result;
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
 * @failure 別HEAD・対象消失・未接続は停止。
 * @invariant 保存RootをWorktreeへ変えない。
 * @boundary 保存OwnerとTask搬送。
 * @security Host Pathは内部入力専用、Surfaceへ直接公開しない。
 * @concurrency 結果は再利用せずTaskごとに観測する。
 */
export function resolveOrchestratorWorkspaceTaskTarget(
  ownerRepositoryRoot: string,
  binding: string,
  queueId: string,
) {
  const failed = (reason: string) => ({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
  const snapshot = readOrchestratorSnapshot(ownerRepositoryRoot, binding);
  if (snapshot.status !== "completed" || !snapshot.value)
    return failed(snapshot.reason);
  const queue = snapshot.value.queueEntries.find(
    (entry) => entry.queueId === queueId,
  );
  if (!queue) return failed("orchestrator_workspace_queue_missing");
  if (["completed", "cancelled"].includes(queue.state))
    return failed("orchestrator_workspace_queue_closed");
  if (queue.workspaceId == null)
    return {
      status: "completed" as const,
      reason: "orchestrator_direct_target",
      value: {
        workspaceId: null,
        ownerRepositoryRoot,
        executionTree: ownerRepositoryRoot,
        baseCommit: null,
        head: null,
      },
    };
  const record = snapshot.value.workspaces.find(
    (entry) => entry.workspaceId === queue.workspaceId,
  );
  if (record?.phase !== "ready" || record.holdUntil !== null)
    return failed("orchestrator_workspace_not_ready");
  const verified = verifyRepositoryRoot(ownerRepositoryRoot);
  if (verified.status !== "completed")
    return failed("orchestrator_workspace_root_invalid");
  const git = observeRepositoryWorktree(
    verified.capability,
    record.workspaceId,
  );
  if (
    git.status !== "completed" ||
    git.observation?.registered !== true ||
    !git.observation.directoryPresent ||
    git.observation.locked ||
    git.observation.prunable ||
    git.observation.head !== record.head ||
    git.observation.branchHead !== record.head
  )
    return failed("orchestrator_workspace_target_changed");
  return {
    status: "completed" as const,
    reason: "orchestrator_isolated_target",
    value: {
      workspaceId: record.workspaceId,
      ownerRepositoryRoot,
      executionTree: path.join(
        ownerRepositoryRoot,
        ".crdd",
        "workspaces",
        record.workspaceId,
        "worktree",
      ),
      baseCommit: record.baseCommit,
      head: record.head,
    },
  };
}
