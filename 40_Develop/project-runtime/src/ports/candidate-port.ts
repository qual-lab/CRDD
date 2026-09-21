import type { ProjectRuntimeState } from "../core/project-runtime-state.ts";

/**
 * ProjectRuntimeIntegrationCandidateが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeIntegrationCandidateに必要な値と制約を一つの型契約として保持する。
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
 * ProjectRuntimeCandidateAdoptionReceiptが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeCandidateAdoptionReceiptに必要な値と制約を一つの型契約として保持する。
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
 * ProjectRuntimeCandidatePortが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeCandidatePortに必要な値と制約を一つの型契約として保持する。
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
