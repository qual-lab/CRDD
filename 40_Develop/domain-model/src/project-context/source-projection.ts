/**
 * Project ContextのSource投影と候補判断を実行する。
 *
 * @packageDocumentation
 * @responsibility 不完全なSource状態を保持し、明示された候補判断だけを次状態へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000016
 * @boundary 正本Sourceと投影・候補判断の境界。
 * @effect N/A: 入力値だけを変換する。
 * @security 制限されたSourceやAuthorityを補完しない。
 */
import type {
  ProjectOperationSource,
  ProjectOperationProjectionItem,
  ProjectOperationProjection,
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
} from "./types.ts";

/**
 * 部分Source集合から根拠付きProject Viewを生成する。
 *
 * @responsibility 不完全状態を個別に保持し、restricted Sourceの詳細を除去した読取りProjectionを返す。
 * @trace ARCH-000005
 * @input projectId: 対象Project、projectionId: 投影Identity、sources: Source観測集合。
 * @returns 完全性と項目別状態を持つProjectOperationProjection。
 * @precondition Project、Projectionおよびfield Identityが空でなく、fieldIdが重複しない。
 * @postcondition 入力順を保ち、complete以外を完全状態へ畳まない。
 * @effect N/A: 入力値から新しい読取り値を構築するだけである。
 * @failure 不正Identityまたは重複fieldIdは例外で拒否し、部分Projectionを返さない。
 * @invariant restricted項目からSource、Revision、時点および値を公開しない。
 * @boundary 複数Source ReaderとProject Management Projectionの直接境界。
 * @security 非開示SourceのIdentity、Revision、値を結果へ含めない。
 * @concurrency N/A: 不変Snapshotの同期変換だけを行う。
 */
export function projectProjectOperationSources(
  projectId: string,
  projectionId: string,
  sources: readonly ProjectOperationSource[],
): ProjectOperationProjection {
  if (!projectId || !projectionId || sources.some((source) => !source.fieldId))
    throw new Error("project_operation_projection_input_invalid");
  if (new Set(sources.map((source) => source.fieldId)).size !== sources.length)
    throw new Error("project_operation_projection_field_duplicate");
  const items = sources.map((source): ProjectOperationProjectionItem => {
    const isRestricted = source.state === "restricted";
    return Object.freeze({
      fieldId: source.fieldId,
      state: source.state,
      sourceId: isRestricted ? null : (source.sourceId ?? null),
      sourceRevision: isRestricted ? null : (source.sourceRevision ?? null),
      observedAt: isRestricted ? null : (source.observedAt ?? null),
      value: isRestricted ? null : (source.value ?? null),
    });
  });
  return Object.freeze({
    projectId,
    projectionId,
    status: items.every((item) => item.state === "complete")
      ? "complete"
      : "partial",
    items: Object.freeze(items),
  });
}

/**
 * 人間判断を候補へ適用し、所有正本Effectの可否を決定する。
 *
 * @responsibility Authority、出所、Owner、状態およびRevisionを検証し、明示adoptだけを一回の正本Effectへ変換する。
 * @trace ARCH-000006
 * @input candidate: Candidate Store記録、decision: Authority境界で検証済みの判断入力。
 * @returns 候補状態、Effect有無および次Revisionを持つ決定結果。
 * @precondition Candidateと判断は同じ固定Snapshotから取得される。
 * @postcondition reject／hold／blockedは正本Effect 0、adoptだけが次Revisionを一つ進める。
 * @effect adopt成功時だけ所有正本Writerへ一回のEffectを許可する結果を返す。
 * @failure Authority不足、出所・Owner不足、競合Revisionまたは決定済み候補をblockedへ閉じる。
 * @invariant 媒体表示名の一致または結果受領だけでadoptしない。
 * @boundary Candidate Store→Authority Gate→所有正本Writerの境界。
 * @security authorityVerifiedがfalseの判断では正本Effectを許可しない。
 * @concurrency observedOwnerRevisionとexpectedOwnerRevisionの一致で競合更新を拒否する。
 */
export function applyProjectOperationCandidateDecision(
  candidate: ProjectOperationCandidate,
  decision: ProjectOperationCandidateDecision,
): ProjectOperationCandidateDecisionResult {
  if (
    !candidate.candidateId ||
    !candidate.sourceId ||
    !candidate.sourceRevision ||
    !candidate.targetOwner
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_invalid",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (!decision.authorityVerified || !decision.principalId)
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_authority_invalid",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (candidate.state === "adopted" || candidate.state === "rejected")
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_already_decided",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (decision.observedOwnerRevision !== candidate.expectedOwnerRevision)
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_revision_conflict",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (decision.decision === "reject")
    return Object.freeze({
      status: "completed",
      reason: "project_operation_candidate_rejected",
      candidateState: "rejected",
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (decision.decision === "hold")
    return Object.freeze({
      status: "completed",
      reason: "project_operation_candidate_held",
      candidateState: "held",
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  return Object.freeze({
    status: "completed",
    reason: "project_operation_candidate_adopted",
    candidateState: "adopted",
    ownerEffectIssued: true,
    nextOwnerRevision: candidate.expectedOwnerRevision + 1,
  });
}
