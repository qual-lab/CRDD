/**
 * candidate-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorIntegrationCandidateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { OrchestratorState } from "../state/transitions.ts";

/**
 * candidate-portで使用するOrchestrator Integration 候補の値契約を定義する。
 *
 * @responsibility Orchestrator Integration 候補のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorIntegrationCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorIntegrationCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorIntegrationCandidateの宣言は外部境界を開かない。
 * @security N/A: OrchestratorIntegrationCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorIntegrationCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorIntegrationCandidate = Readonly<{
  status: "candidate";
  candidateId: string;
  candidateHash: string;
  baseRevision: string;
  changedPaths: readonly string[];
  objectiveEvidence: Readonly<Record<string, readonly string[]>>;
  milestoneEvidence: readonly string[];
  conflicts: readonly string[];
  cleanupConfirmed: boolean;
}>;

/**
 * candidate-portで使用するOrchestrator 候補 Adoption Receiptの値契約を定義する。
 *
 * @responsibility Orchestrator 候補 Adoption ReceiptのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorCandidateAdoptionReceiptが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorCandidateAdoptionReceiptで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorCandidateAdoptionReceiptの宣言は外部境界を開かない。
 * @security N/A: OrchestratorCandidateAdoptionReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorCandidateAdoptionReceiptの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorCandidateAdoptionReceipt = Readonly<{
  status: "completed";
  receiptId: string;
  beforeRevision: string;
  afterRevision: string;
  changedPaths: readonly string[];
  cleanupConfirmed: boolean;
}>;

/**
 * candidate-portで使用するOrchestrator 候補 Portの値契約を定義する。
 *
 * @responsibility Orchestrator 候補 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorCandidatePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorCandidatePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorCandidatePortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorCandidatePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorCandidatePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorCandidatePort = Readonly<{
  createCandidate: (
    input: Readonly<{
      state: OrchestratorState;
      taskCandidateIds: readonly string[];
    }>,
  ) => Promise<unknown>;
  observeCanonicalRepository: () => unknown;
  observeLeaseOwner?: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  adoptCandidate: (
    input: Readonly<{
      candidateId: string;
      candidateHash: string;
      baseRevision: string;
      changedPaths: readonly string[];
    }>,
  ) => Promise<unknown>;
}>;
