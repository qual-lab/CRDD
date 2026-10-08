/**
 * Project Context候補への明示判断を評価する。
 *
 * @packageDocumentation
 * @responsibility 候補のAuthority・状態・改訂を検証し、採否の次状態を返す。
 * @trace ARCH-000006
 * @trace ARCH-000016
 * @boundary 候補記録と所有正本への判断境界。
 * @effect N/A: 判断結果だけを構築し、正本への書込みは実行しない。
 * @security 明示Authorityのない判断を採用へ変換しない。
 */
import type {
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
} from "./types.ts";

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
