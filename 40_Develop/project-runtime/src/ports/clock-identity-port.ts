export type ProjectRuntimeClockReading = Readonly<{
  monotonicMs: number;
  iso: string;
}>;

/** Host-supplied clock and deterministic identity operations. */
export type ProjectRuntimeClockIdentityPort = Readonly<{
  now: () => ProjectRuntimeClockReading;
  createStableId: (prefix: string, parts: readonly string[]) => string;
}>;
