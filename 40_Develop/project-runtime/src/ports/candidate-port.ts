import type { ProjectRuntimeState } from "../core/project-runtime-state.ts";

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

export type ProjectRuntimeCandidateAdoptionReceipt = Readonly<{
  status: "completed";
  receiptId: string;
  beforeRevision: string;
  afterRevision: string;
  changedPaths: readonly string[];
  cleanupConfirmed: boolean;
}>;

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
