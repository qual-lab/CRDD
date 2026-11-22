/**
 * process-signal-shutdownに属する責務をまとめる。
 *
 * @responsibility McpProcessSignalSourceを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */
/**
 * process-signal-shutdownで使用するMcp Process Signal Sourceの値契約を定義する。
 *
 * @responsibility Mcp Process Signal SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpProcessSignalSourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpProcessSignalSourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpProcessSignalSourceの宣言は外部境界を開かない。
 * @security N/A: McpProcessSignalSourceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpProcessSignalSourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpProcessSignalSource = Readonly<{
  on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}>;

/**
 * process-signal-shutdownで使用するMcp Http Server Close Boundaryの値契約を定義する。
 *
 * @responsibility Mcp Http Server Close BoundaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpHttpServerCloseBoundaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpHttpServerCloseBoundaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpHttpServerCloseBoundaryの宣言は外部境界を開かない。
 * @security N/A: McpHttpServerCloseBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpHttpServerCloseBoundaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpHttpServerCloseBoundary = Readonly<{
  close(): Promise<Readonly<{ status: "completed"; cleanupConfirmed: true }>>;
}>;

/**
 * Retain ownership of both process signals until HTTP shutdown settles.
 *
 * @responsibility Mcp Http On Process Signalの終了条件、資源解放、終了不能時の境界を所有する。
 * @trace ARCH-000012
 * @input server: McpHttpServerCloseBoundary、signalSource: McpProcessSignalSource
 * @returns closeMcpHttpOnProcessSignalの計算結果を返す。
 * @precondition 「server: McpHttpServerCloseBoundary、signalSource: McpProcessSignalSource」がcloseMcpHttpOnProcessSignalの入力契約を満たす。
 * @postcondition closeMcpHttpOnProcessSignalの責務を完了した結果だけを返す。
 * @effect N/A: closeMcpHttpOnProcessSignalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: closeMcpHttpOnProcessSignalは独自の失敗分岐を所有しない。
 * @invariant closeMcpHttpOnProcessSignalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: closeMcpHttpOnProcessSignalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency closeMcpHttpOnProcessSignalは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
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
