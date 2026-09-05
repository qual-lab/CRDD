export type ProjectRuntimeDecisionRecord = Readonly<{
  recordId: string;
  decisionId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  principalId: string;
  allowedOptions: readonly ("resume" | "cancel")[];
  capabilityHash: string;
  expiresAtEpochMs: number;
  disposition:
    | "pending"
    | "prepared"
    | "finalized"
    | "invalidated"
    | "expired"
    | "recovery_required";
  applicationId: string | null;
  selectedOption: "resume" | "cancel" | null;
  newGeneration: number | null;
  replacementRequestId: string | null;
}>;

export type ProjectRuntimeDecisionStore = Readonly<{
  create: (record: ProjectRuntimeDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecord,
    next: ProjectRuntimeDecisionRecord,
  ) => unknown;
}>;

export type ProjectRuntimeDecisionRecoveryIntent = Readonly<{
  recoveryId: string;
  recordId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  applicationId: string | null;
  expectedGeneration: number;
  newGeneration: number | null;
  observedDisposition: ProjectRuntimeDecisionRecord["disposition"] | "unknown";
  unknownBoundary: string;
  disposition: "required" | "settled";
}>;

export type ProjectRuntimeDecisionRecoveryStore = Readonly<{
  create: (intent: ProjectRuntimeDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecoveryIntent,
    next: ProjectRuntimeDecisionRecoveryIntent,
  ) => unknown;
}>;

export type ProjectRuntimeDecisionPort = Readonly<{
  store: ProjectRuntimeDecisionStore;
  recoveryStore?: ProjectRuntimeDecisionRecoveryStore;
}>;
