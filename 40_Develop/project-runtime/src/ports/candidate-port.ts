/**
 * candidate-portに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeIntegrationCandidateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { ProjectRuntimeState } from "../core/project-runtime-state.ts";

/**
 * candidate-portで使用するProject Runtime Integration 候補の値契約を定義する。
 *
 * @responsibility Project Runtime Integration 候補のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeIntegrationCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeIntegrationCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeIntegrationCandidateの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeIntegrationCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeIntegrationCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeIntegrationCandidate = Readonly<{
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
 * candidate-portで使用するProject Runtime 候補 Adoption Receiptの値契約を定義する。
 *
 * @responsibility Project Runtime 候補 Adoption ReceiptのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeCandidateAdoptionReceiptが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeCandidateAdoptionReceiptで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeCandidateAdoptionReceiptの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeCandidateAdoptionReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeCandidateAdoptionReceiptの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeCandidateAdoptionReceipt = Readonly<{
  status: "completed";
  receiptId: string;
  beforeRevision: string;
  afterRevision: string;
  changedPaths: readonly string[];
  cleanupConfirmed: boolean;
}>;

/**
 * candidate-portで使用するProject Runtime 候補 Portの値契約を定義する。
 *
 * @responsibility Project Runtime 候補 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeCandidatePortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeCandidatePortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeCandidatePortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeCandidatePortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeCandidatePortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeCandidatePort = Readonly<{
  createCandidate: (
    input: Readonly<{
      state: ProjectRuntimeState;
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
