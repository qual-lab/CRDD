/** Runtime-process recovery operations supplied by the owning Host Adapter. */
export type ProjectRuntimeProcessSafetyPort = Readonly<{
  createRecoveryIdentity: (attemptId: string, operationId: string) => string;
  poisonAfterCleanupUnknown: () => void;
}>;
