export const PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/project-runtime-single-task-adapter" as const;
export const PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION = 2;

export type ProjectRuntimeSingleTaskAttemptInput = Readonly<{
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  runtimeExecutionCapability: object;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
}>;

export type ProjectRuntimeSingleTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

export type ProjectRuntimeSingleTaskResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  repositoryRevision: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
}>;

export type ProjectRuntimeExecutionPort = Readonly<{
  runSingleTaskAttempt: (
    input: ProjectRuntimeSingleTaskAttemptInput,
  ) => Promise<ProjectRuntimeSingleTaskResult>;
}>;
