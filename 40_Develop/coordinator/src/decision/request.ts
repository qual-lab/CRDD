/**
 * decision-requestに属する責務をまとめる。
 *
 * @responsibility CoordinatorDecisionRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

import type { CoordinatorAcceptanceDecisionAuthorityPort } from "./types.ts";
import type {
  CoordinatorAcceptanceTarget,
  CoordinatorAcceptanceDecision,
} from "../../../domain-model/src/index.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * 認証済みPrincipalへ限定したAcceptance Decision Authority Adapterを構築する。
 *
 * @responsibility 認証境界で確定したPrincipalと判断要求のPrincipalをexact比較する。
 * @trace ARCH-000005
 * @input authenticatedPrincipalId: Transportが検証したPrincipal Identity。
 * @returns CoordinatorAcceptanceDecisionAuthorityPortを返す。
 * @precondition PrincipalはRuntime-owned認証境界で検証済みである。
 * @postcondition 同じPrincipal、SPEC-000002および有効な対象Bindingだけを許可する。
 * @effect N/A: Authorityの比較だけを行い、CapabilityやEffectを発行しない。
 * @failure 不正PrincipalまたはBindingはfalseへ閉じる。
 * @invariant 読取り投影、Task完了またはProvider結果からAuthorityを生成しない。
 * @boundary Runtime-owned認証PrincipalとCoordinator Authority Portの境界。
 * @security Principalを拡張せず、秘密値を生成・保存・公開しない。
 * @concurrency N/A: 不変値の同期比較だけを行う。
 */
export function createCoordinatorAcceptanceAuthorityAdapter(
  authenticatedPrincipalId: string,
): CoordinatorAcceptanceDecisionAuthorityPort {
  if (!ID.test(authenticatedPrincipalId))
    throw new Error("orchestrator_acceptance_principal_invalid");
  return Object.freeze({
    verify: (binding) =>
      binding.sourceSpecId === "SPEC-000002" &&
      binding.principalId === authenticatedPrincipalId &&
      ID.test(binding.projectId) &&
      ID.test(binding.milestoneId) &&
      ID.test(binding.targetId),
  });
}

export const COORDINATOR_ACCEPTANCE_DECISION_CONTRACT =
  "crdd-coordinator/orchestrator-acceptance-decision/v1" as const;

const recordAcceptanceID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * 受入判断Applicationの入力を定義する。
 *
 * @responsibility Source、対象、世代、判断、根拠および認証済みPrincipalを一つの要求へ結合する。
 * @trace ARCH-000005
 * @shape 受入判断に必要な入力Propertyを表す。
 * @invariant `SPEC-000002`だけをSourceとして許可し、Projection由来Sourceを受理しない。
 * @boundary Public Application入力とCoordinator Coreの境界。
 * @security 秘密値を入力として受けず、認証済みPrincipalのIdentityだけをAuthority検証へ渡す。
 * @compatibility 利用側はContract Revision 1の宣言済みPropertyだけへ依存する。
 */
export type CoordinatorAcceptanceDecisionRequest = Readonly<{
  contract: typeof COORDINATOR_ACCEPTANCE_DECISION_CONTRACT;
  decisionId: string;
  sourceSpecId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: CoordinatorAcceptanceTarget;
  targetId: string;
  decision: CoordinatorAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
  principalId: string;
}>;

/**
 * 受入判断要求の構造と固定語彙を検証する。
 *
 * @responsibility 不正Source、Identity、世代、判断、根拠およびPrincipalをEffect前に拒否する。
 * @trace ARCH-000005
 * @input input: CoordinatorAcceptanceDecisionRequest
 * @returns 有効な要求なら`true`、それ以外は`false`を返す。
 * @precondition 未信頼のTransport入力を型境界の内側で再検証する。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検証する。
 * @failure 不正入力は例外へ変えず`false`へ閉じる。
 * @invariant Projection用SPEC-000006／000007を受入判断Sourceへ昇格しない。
 * @boundary Transport入力とCoordinator Applicationの境界。
 * @security 認証済みPrincipalのIdentity以外のAuthority情報を出力または記録しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function validRequest(
  input: unknown,
): input is CoordinatorAcceptanceDecisionRequest {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return false;
  const candidate = input as Partial<CoordinatorAcceptanceDecisionRequest>;
  return (
    candidate.contract === COORDINATOR_ACCEPTANCE_DECISION_CONTRACT &&
    candidate.sourceSpecId === "SPEC-000002" &&
    [
      candidate.decisionId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.targetId,
      candidate.principalId,
    ].every(
      (value) => typeof value === "string" && recordAcceptanceID.test(value),
    ) &&
    typeof candidate.repositoryRevision === "string" &&
    REVISION.test(candidate.repositoryRevision) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    Number(candidate.expectedGeneration) >= 1 &&
    (candidate.target === "objective" || candidate.target === "milestone") &&
    (candidate.decision === "accept" ||
      candidate.decision === "return" ||
      candidate.decision === "wait") &&
    Array.isArray(candidate.criterionEvidenceIds) &&
    candidate.criterionEvidenceIds.every(
      (value) => typeof value === "string" && recordAcceptanceID.test(value),
    ) &&
    new Set(candidate.criterionEvidenceIds).size ===
      candidate.criterionEvidenceIds.length
  );
}
