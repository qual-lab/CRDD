/** Runtime-process recovery operations supplied by the owning Host Adapter. */
export type ProjectRuntimeProcessSafetyPort = Readonly<{
  getProcessInstanceIdentity: () => string;
  createRecoveryIdentity: (attemptId: string, operationId: string) => string;
  inspectRecoveryIdentity: (
    value: unknown,
    attemptId: string,
    operationId: string,
  ) => Readonly<{ processIdentity: string; recoveryId: string }> | null;
  poisonAfterCleanupUnknown: () => void;
}>;
