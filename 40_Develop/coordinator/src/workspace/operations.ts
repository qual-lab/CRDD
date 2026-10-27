/**
 * 既存Queueの操作区間からWorkspace保存とGit処置を接続する。
 * @responsibility 意図保存、VC呼出し、結果保存、既存Lease解放。
 * @trace ARCH-000004
 * @boundary 所属Repositoryの保存Rootと独立した実行Tree。
 */
import type { CoordinatorWorkspace } from "../../../domain-model/src/index.ts";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
  RepositoryWorktreeResult,
  WorkspaceCandidateResult,
  WorkspaceCandidateSelection,
} from "../../../version-control/src/index.ts";
import {
  createRepositoryWorktree,
  disposeRepositoryWorktree,
  freezeWorkspaceCandidate,
  inspectGitRepositoryLayoutCandidate,
  mergeWorkspaceCandidate,
  observeRepositoryWorktree,
  removeWorkspaceCandidate,
  validWorkspaceDisplayName,
  validWorkspaceCandidateRequest,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { acquireCoordinatorSnapshotLease } from "../execution/lease.ts";
import { readCoordinatorSnapshot } from "../storage/state.ts";
import {
  writeCoordinatorWorkspaceRecord,
  createCoordinatorSnapshotIntegrationRecordPort,
} from "./commands.ts";

import type { CoordinatorLease } from "../state/persistence.ts";

/**
 * 計画の品質受入に必要な既存Git採用記録を再観測する。
 * @responsibility 元計画・Queue・Workspace・固定候補・取込HEADを結合する。
 * @trace ARCH-000005 ARCH-000004
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
  const read = readCoordinatorSnapshot(root, binding);
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
      !validWorkspaceCandidateRequest(value.request)
    )
      return false;
    const request = value.request;
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
 * 既存Queueに結合したWorkspace操作入力。
 * @responsibility 任意Pathと暗黙作成を受け付けない。
 * @trace ARCH-000004
 * @shape 所属Root・Repository／Project／Queue・UUIDと明示操作。
 * @invariant 採用済みという申告だけでは削除しない。
 * @boundary 内部Package API。Surfaceの認可は呼出し元。
 * @security Root文字列は検証後にだけ使用する。
 * @compatibility 新しい独立Serverや入口は追加しない。
 */
export type CoordinatorWorkspaceRequest = Readonly<{
  ownerRepositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  workspaceId: string;
  expectedGeneration?: number;
  authorize?: () => boolean;
}> &
  (
    | { operation: "create"; baseCommit: string; name?: string }
    | { operation: "rename"; name: string | null }
    | {
        operation: "freeze";
        operationId: string;
        baseCommit: string;
        expectedHead: string;
        selection: readonly WorkspaceCandidateSelection[];
        candidateName: string | null;
        relatedChangeIds: readonly string[];
        authorize: () => boolean;
      }
    | {
        operation: "adopt";
        candidateCommit: string;
        targetBranch: string;
        expectedTargetHead: string;
        authorize: () => boolean;
      }
    | {
        operation: "close-candidate";
        expectedCommit: string | null;
        disposition: "adopted" | "rejected";
        referencesReleased: boolean;
        authorize: () => boolean;
      }
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
 * @boundary Coordinator→VC公開APIと既存Writer。
 * @security Directの通常Treeを削除しない。
 * @concurrency 既存binding-wide操作Leaseを維持する。
 */
export function manageCoordinatorWorkspace(
  request: CoordinatorWorkspaceRequest,
) {
  const result = {
    status: "blocked" as "completed" | "blocked",
    reason: "orchestrator_workspace_input_invalid",
    workspaceId: request.workspaceId,
    workspace: null as CoordinatorWorkspace | null,
    gitResult: null as RepositoryWorktreeResult | null,
    candidateResult: null as WorkspaceCandidateResult | null,
    leaseReleased: null as boolean | null,
    manualRecoveryRequired: false,
    recoveryId: null as string | null,
    releaseFailure: null as string | null,
    releaseRecoveryId: null as string | null,
    adoptionReleaseFailure: null as string | null,
    adoptionReleaseRecoveryId: null as string | null,
  };
  let adoptionLease: CoordinatorLease | null = null;
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
  const initial = readCoordinatorSnapshot(
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
  const lease = acquireCoordinatorSnapshotLease(
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
    const observed = readCoordinatorSnapshot(
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
    if (
      request.expectedGeneration !== undefined &&
      request.expectedGeneration !== (record?.generation ?? 0)
    )
      throw new Error("orchestrator_workspace_generation_conflict");
    if (request.authorize && !request.authorize())
      throw new Error("orchestrator_candidate_not_authorized");
    const save = (next: CoordinatorWorkspace | null) => {
      const saved = writeCoordinatorWorkspaceRecord(
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
    const operationQueue = observed.value.queueEntries.find(
      (entry) => entry.queueId === request.queueId,
    );
    if (
      !operationQueue ||
      operationQueue.projectId !== request.projectId ||
      (record &&
        !observed.value.queueEntries.some(
          (entry) =>
            entry.projectId === request.projectId &&
            entry.workspaceId === request.workspaceId,
        ))
    )
      throw new Error("orchestrator_workspace_target_mismatch");
    const operationResults = observed.value.results;
    /**
     * Candidateの採否と固定Identityを既存の不変結果Portへ保存する。
     * @responsibility Ref回収より先に判断結果を確定する。
     * @trace ARCH-000004
     * @input candidate: 同じWorkspaceの確定した採否。
     * @returns N/A: 保存確定だけ正常終了。
     * @precondition 既存操作Leaseを保持。
     * @postcondition 同Identity・同内容だけ再送可能。
     * @effect 既存Snapshotの結果保存。
     * @failure 保存不明はRef回収前に停止。
     * @invariant Git成功を品質成立へ変換しない。
     * @boundary 既存結果Port。
     * @security 名前・結果をAuthorityにしない。
     * @concurrency 新しい排他を追加しない。
     */
    const recordDisposition = (
      candidate: NonNullable<CoordinatorWorkspace["candidate"]>,
    ) => {
      const queue = operationQueue;
      if (!queue || candidate.disposition === null)
        throw new Error("orchestrator_candidate_disposition_invalid");
      const recorded = createCoordinatorSnapshotIntegrationRecordPort({
        workingDirectory: request.ownerRepositoryRoot,
        repositoryBindingId: request.repositoryBindingId,
        projectId: request.projectId,
        queueId: request.queueId,
        milestoneId: queue.milestoneId,
      }).write({
        kind: "adoption",
        identity: `workspace-candidate-${candidate.request.operationId}`,
        value: {
          recordKind: "workspace-candidate",
          request: candidate.request,
          candidateCommit: candidate.candidateCommit,
          target: candidate.target,
          mergeCommit: candidate.mergeCommit,
          disposition: candidate.disposition,
          primaryFailure: candidate.primaryFailure,
        },
      });
      if (recorded.status !== "completed")
        throw new Error("orchestrator_candidate_record_unconfirmed");
    };
    /**
     * 採否と分離したRef回収終端を既存結果Portへ確定する。
     * @responsibility 元採否の不変性と回収失敗の保持を両立する。
     * @trace ARCH-000004
     * @input candidate: 回収中の同候補。
     * @returns 保存確認時だけ正常終了。
     * @precondition 技術結果でRef・一時物の不存在を確認済み。
     * @postcondition 確定前にcandidateを消さない。
     * @effect 既存結果保存のみ。
     * @failure 保存不明は既存現在値を保持。
     * @invariant 同Identity・同本文だけ再送する。
     * @boundary 既存Snapshot。
     * @security 採用Authorityを新設しない。
     * @concurrency 既存操作Lease下。
     */
    const recordCandidateClosure = (
      candidate: NonNullable<CoordinatorWorkspace["candidate"]>,
    ) => {
      if (!operationQueue)
        throw new Error("orchestrator_candidate_disposition_invalid");
      const identity = `workspace-candidate-close-${candidate.request.operationId}`;
      const existing = operationResults.find(
        (entry) => entry.kind === "adoption" && entry.identity === identity,
      );
      let value: unknown = {
        recordKind: "workspace-candidate-close",
        workspaceId: candidate.request.workspaceId,
        operationId: candidate.request.operationId,
        candidateCommit: candidate.candidateCommit,
        disposition: candidate.disposition,
        cleanupFailure: candidate.cleanupFailure,
        refAbsent: true,
      };
      if (existing) {
        const prior = existing.value as Record<string, unknown>;
        if (
          existing.repositoryBindingId !== request.repositoryBindingId ||
          existing.projectId !== request.projectId ||
          existing.queueId !== request.queueId ||
          existing.milestoneId !== operationQueue.milestoneId ||
          !prior ||
          typeof prior !== "object" ||
          Object.keys(prior).sort().join(",") !==
            "candidateCommit,cleanupFailure,disposition,operationId,recordKind,refAbsent,workspaceId" ||
          prior.recordKind !== "workspace-candidate-close" ||
          prior.workspaceId !== candidate.request.workspaceId ||
          prior.operationId !== candidate.request.operationId ||
          prior.candidateCommit !== candidate.candidateCommit ||
          prior.disposition !== candidate.disposition ||
          prior.refAbsent !== true ||
          !(
            prior.cleanupFailure === null ||
            (typeof prior.cleanupFailure === "string" &&
              /^(candidate|worktree)_[a-z_]+$/u.test(prior.cleanupFailure))
          )
        )
          throw new Error("orchestrator_candidate_closure_mismatch");
        value = existing.value;
      }
      const saved = createCoordinatorSnapshotIntegrationRecordPort({
        workingDirectory: request.ownerRepositoryRoot,
        repositoryBindingId: request.repositoryBindingId,
        projectId: request.projectId,
        queueId: request.queueId,
        milestoneId: operationQueue.milestoneId,
      }).write({
        kind: "adoption",
        identity,
        value,
      });
      if (saved.status !== "completed")
        throw new Error("orchestrator_candidate_closure_unconfirmed");
    };
    if (request.operation === "create") {
      if (record) throw new Error("orchestrator_workspace_already_recorded");
      save({
        workspaceId: request.workspaceId,
        name: request.name ?? null,
        candidate: null,
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
      if (request.authorize && !request.authorize())
        throw new Error("orchestrator_candidate_not_authorized");
      result.gitResult = createRepositoryWorktree(verified.capability, {
        workspaceId: request.workspaceId,
        baseCommit: request.baseCommit,
      });
    } else {
      if (!record) throw new Error("orchestrator_workspace_not_found");
      if (request.operation === "rename") {
        if (
          record.phase !== "ready" ||
          !validWorkspaceDisplayName(request.name)
        )
          throw new Error("orchestrator_workspace_name_invalid");
        save({
          ...record,
          generation: record.generation + 1,
          name: request.name,
        });
      } else if (
        ["freeze", "adopt", "close-candidate"].includes(request.operation)
      ) {
        if (record.phase !== "ready" || record.holdUntil !== null)
          throw new Error("orchestrator_workspace_not_ready");
        if (request.operation === "freeze") {
          const intent = {
            workspaceId: record.workspaceId,
            operationId: request.operationId,
            baseCommit: request.baseCommit,
            expectedWorkspaceHead: request.expectedHead,
            selection: request.selection,
            workspaceName: record.candidate
              ? record.candidate.request.workspaceName
              : record.name,
            candidateName: request.candidateName,
            relatedChangeIds: request.relatedChangeIds,
          };
          if (
            record.candidate &&
            (!["freezing", "fixed"].includes(record.candidate.phase) ||
              !isDeepStrictEqual(record.candidate.request, intent))
          )
            throw new Error("orchestrator_candidate_pending");
          if (!validWorkspaceCandidateRequest(intent))
            throw new Error("orchestrator_candidate_input_invalid");
          if (record.head !== request.expectedHead || !request.authorize())
            throw new Error("orchestrator_candidate_not_authorized");
          for (const id of request.relatedChangeIds) {
            if (!/^CHG-\d{6}$/u.test(id))
              throw new Error("orchestrator_candidate_change_invalid");
            const file = path.join(
              request.ownerRepositoryRoot,
              "99_Roadmap",
              "Changes",
              id,
              "change.md",
            );
            // 登録されたCHG参照だけを表示へ載せる。内容・採否は読み替えない。
            if (!existsSync(file) || lstatSync(file).isSymbolicLink())
              throw new Error("orchestrator_candidate_change_not_found");
          }
          const previousCommit = record.candidate?.candidateCommit ?? null;
          const primaryFailure = record.candidate?.primaryFailure ?? null;
          const previousResult = record.candidate?.lastResult ?? null;
          save({
            ...record,
            generation: record.generation + 1,
            candidate: {
              request: intent,
              phase: "freezing",
              candidateCommit: previousCommit,
              target: null,
              mergeCommit: null,
              disposition: null,
              lastResult: previousResult,
              primaryFailure,
              cleanupFailure: null,
            },
          });
          if (!request.authorize())
            throw new Error("orchestrator_candidate_not_authorized");
          result.candidateResult = freezeWorkspaceCandidate(
            verified.capability,
            intent,
            previousCommit,
            previousResult?.temporary ?? null,
          );
        } else if (request.operation === "adopt") {
          const c = record.candidate;
          if (
            !c ||
            !["fixed", "merging", "merged"].includes(c.phase) ||
            c.candidateCommit !== request.candidateCommit
          )
            throw new Error("orchestrator_candidate_mismatch");
          const target = {
            targetBranch: request.targetBranch,
            expectedTargetHead: request.expectedTargetHead,
          };
          if (c.target && !isDeepStrictEqual(c.target, target))
            throw new Error("orchestrator_candidate_target_mismatch");
          if (!request.authorize())
            throw new Error("orchestrator_candidate_not_authorized");
          const acquired = acquireCoordinatorSnapshotLease(
            request.ownerRepositoryRoot,
            request.repositoryBindingId,
            request.projectId,
            "canonical",
            "canonical-adoption",
          );
          if (acquired.status !== "completed") {
            result.manualRecoveryRequired = acquired.manualRecoveryRequired;
            result.recoveryId = acquired.recoveryId;
            throw new Error(acquired.reason);
          }
          adoptionLease = acquired.value;
          save({
            ...record,
            generation: record.generation + 1,
            candidate: { ...c, phase: "merging", target },
          });
          if (!request.authorize())
            throw new Error("orchestrator_candidate_not_authorized");
          result.candidateResult = mergeWorkspaceCandidate(
            verified.capability,
            c.request,
            { ...target, candidateCommit: request.candidateCommit },
          );
        } else if (request.operation === "close-candidate") {
          const c = record.candidate;
          if (
            !c ||
            c.candidateCommit !== request.expectedCommit ||
            !request.referencesReleased ||
            observed.value.queueEntries.some(
              (entry) =>
                entry.workspaceId === record?.workspaceId &&
                entry.queueId !== request.queueId &&
                !["completed", "cancelled"].includes(entry.state),
            ) ||
            !request.authorize() ||
            (c.phase === "removing" && c.disposition !== request.disposition) ||
            (request.disposition === "adopted" &&
              c.disposition !== "adopted") ||
            (request.disposition === "rejected" &&
              !["freezing", "fixed", "removing"].includes(c.phase))
          )
            throw new Error("orchestrator_candidate_removal_not_authorized");
          save({
            ...record,
            generation: record.generation + 1,
            candidate: {
              ...c,
              phase: "removing",
              disposition: request.disposition,
            },
          });
          recordDisposition({ ...c, disposition: request.disposition });
          if (!request.authorize())
            throw new Error("orchestrator_candidate_not_authorized");
          result.candidateResult = removeWorkspaceCandidate(
            verified.capability,
            c.request,
            request.expectedCommit,
            c.lastResult?.temporary ?? null,
          );
        }
        if (result.candidateResult && record?.candidate) {
          const technical = result.candidateResult;
          const c = record.candidate;
          const completed =
            technical.status === "completed" && technical.cleanupConfirmed;
          if (completed && request.operation === "adopt")
            recordDisposition({
              ...c,
              mergeCommit: technical.mergeCommit ?? c.mergeCommit,
              disposition: "adopted",
            });
          if (completed && request.operation === "close-candidate")
            recordCandidateClosure(c);
          save({
            ...record,
            generation: record.generation + 1,
            candidate:
              completed && request.operation === "close-candidate"
                ? null
                : {
                    ...c,
                    phase: completed
                      ? request.operation === "freeze"
                        ? "fixed"
                        : request.operation === "adopt"
                          ? "merged"
                          : c.phase
                      : c.phase,
                    candidateCommit:
                      technical.candidateCommit ?? c.candidateCommit,
                    mergeCommit: technical.mergeCommit ?? c.mergeCommit,
                    disposition:
                      completed && request.operation === "adopt"
                        ? "adopted"
                        : c.disposition,
                    lastResult: technical,
                    primaryFailure:
                      c.primaryFailure ??
                      (technical.status === "blocked" &&
                      request.operation !== "close-candidate"
                        ? technical.reason
                        : null),
                    cleanupFailure:
                      c.cleanupFailure ??
                      (technical.status === "blocked" &&
                      request.operation === "close-candidate"
                        ? technical.reason
                        : null),
                  },
          });
          if (!completed) throw new Error(technical.reason);
        }
      } else if (request.operation === "hold") {
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
        if (record.candidate)
          throw new Error("orchestrator_candidate_still_referenced");
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
        if (request.authorize && !request.authorize())
          throw new Error("orchestrator_candidate_not_authorized");
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
    if (adoptionLease) {
      try {
        const released = adoptionLease.release();
        if (released.status !== "completed") {
          if (result.status === "completed") result.reason = released.reason;
          result.adoptionReleaseFailure = released.reason;
          result.adoptionReleaseRecoveryId = released.recoveryId;
          result.manualRecoveryRequired ||= released.manualRecoveryRequired;
          result.recoveryId ??= released.recoveryId;
          result.status = "blocked";
        }
      } catch {
        if (result.status === "completed")
          result.reason = "orchestrator_adoption_lease_release_unconfirmed";
        result.adoptionReleaseFailure =
          "orchestrator_adoption_lease_release_unconfirmed";
        result.manualRecoveryRequired = true;
        result.status = "blocked";
      }
    }
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
export function resolveCoordinatorWorkspaceTaskTarget(
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
  const snapshot = readCoordinatorSnapshot(ownerRepositoryRoot, binding);
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
  if (
    record?.phase !== "ready" ||
    record.holdUntil !== null ||
    (record.candidate && !["fixed", "merged"].includes(record.candidate.phase))
  )
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
    git.workspaceId !== record.workspaceId ||
    git.relativePath === null ||
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
      executionTree: path.join(ownerRepositoryRoot, git.relativePath),
      baseCommit: record.baseCommit,
      head: record.head,
    },
  };
}
