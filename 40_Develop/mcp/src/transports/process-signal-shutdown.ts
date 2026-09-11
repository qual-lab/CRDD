export type McpProcessSignalSource = Readonly<{
  on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}>;

export type McpHttpServerCloseBoundary = Readonly<{
  close(): Promise<Readonly<{ status: "completed"; cleanupConfirmed: true }>>;
}>;

/**
 * Retain ownership of both process signals until HTTP shutdown settles.
 * Repeated signals only latch the same shutdown request and never restore the
 * operating-system default termination path while resources are being joined.
 */
export async function closeMcpHttpOnProcessSignal(
  server: McpHttpServerCloseBoundary,
  signalSource: McpProcessSignalSource = process,
) {
  let requestStop: (() => void) | null = null;
  let isStopRequested = false;
  const stopRequested = new Promise<void>((resolve) => {
    requestStop = () => {
      if (isStopRequested) return;
      isStopRequested = true;
      resolve();
    };
  });
  const stop = () => requestStop?.();
  let isSigintOwned = false;
  let isSigtermOwned = false;
  try {
    signalSource.on("SIGINT", stop);
    isSigintOwned = true;
    signalSource.on("SIGTERM", stop);
    isSigtermOwned = true;
    await stopRequested;
    return await server.close();
  } finally {
    if (isSigintOwned) signalSource.removeListener("SIGINT", stop);
    if (isSigtermOwned) signalSource.removeListener("SIGTERM", stop);
  }
}
