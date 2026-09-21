/**
 * Toolを利用する公開入口を定義する。
 *
 * @responsibility Human CLI、MCP、CoordinatorおよびWorkbenchの入口Identityを閉集合にする。
 * @trace ARCH-000010
 * @shape 四つの公開Surfaceを表す。
 * @invariant Surfaceは実装IdentityまたはAuthorityを変更しない。
 * @boundary 公開入口とTool Registryの境界。
 * @security Surface名だけで実行を許可しない。
 * @compatibility 新Surface追加時は全入口同等性を再評価する。
 */
export type ToolSurface = "human_cli" | "mcp" | "coordinator" | "workbench";

/**
 * Tool Registryの登録項目を定義する。
 *
 * @responsibility 登録、公開、Host可用性、処理許可および共有実装Identityを独立状態として保持する。
 * @trace ARCH-000010
 * @shape Tool Identity、状態軸および実装関数を表す。
 * @invariant 公開済みだけではHost可用・許可済みを意味しない。
 * @boundary Registryと各公開Surfaceの境界。
 * @security authorize=falseでは実装関数を呼び出さない。
 * @compatibility 同じtoolIdは一つのimplementationIdへ結合する。
 */
export type RegisteredTool = Readonly<{
  toolId: string;
  implementationId: string;
  published: boolean;
  hostAvailable: boolean;
  execute: (input: string, signal: AbortSignal) => Promise<string>;
}>;

/**
 * Tool実行要求を定義する。
 *
 * @responsibility Surface、Tool、入力および処理許可を明示入力へ固定する。
 * @trace ARCH-000010
 * @shape surface、toolId、inputおよびauthorizedを表す。
 * @invariant Registry照会からauthorizedを生成しない。
 * @boundary 公開SurfaceとTool実行Use Caseの境界。
 * @security authorizedは上流Authority Gateの観測結果である。
 * @compatibility 入力意味はSurface間で変えない。
 */
export type ToolExecutionRequest = Readonly<{
  surface: ToolSurface;
  toolId: string;
  input: string;
  authorized: boolean;
}>;

/**
 * 登録Toolの現在状態を照会する。
 *
 * @responsibility 未登録、非公開、Host不可および利用可能を混同せず返す。
 * @trace ARCH-000010
 * @input toolId: 対象Tool Identity、registeredTools: 登録集合。
 * @returns 状態と、利用可能な場合だけ共有implementationIdを返す。
 * @precondition Registryは同じRevisionのSnapshotである。
 * @postcondition 照会だけでは実行AuthorityまたはEffectを発行しない。
 * @effect N/A: Registry Snapshotを読むだけである。
 * @failure 未登録・非公開・Host不可を個別状態で返す。
 * @invariant 状態軸をavailableへ暗黙統合しない。
 * @boundary Tool Registry→公開Surface。
 * @security 非公開ToolのimplementationIdを返さない。
 * @concurrency N/A: 不変Snapshotの同期照会である。
 */
export function inspectRegisteredTool(
  toolId: string,
  registeredTools: readonly RegisteredTool[],
): Readonly<{
  state: "unregistered" | "unpublished" | "host_unavailable" | "available";
  implementationId: string | null;
}> {
  const tool = registeredTools.find((entry) => entry.toolId === toolId);
  if (!tool)
    return Object.freeze({ state: "unregistered", implementationId: null });
  if (!tool.published)
    return Object.freeze({ state: "unpublished", implementationId: null });
  if (!tool.hostAvailable)
    return Object.freeze({
      state: "host_unavailable",
      implementationId: tool.implementationId,
    });
  return Object.freeze({
    state: "available",
    implementationId: tool.implementationId,
  });
}

/**
 * 公開Surfaceから登録Toolの共有実装を実行する。
 *
 * @responsibility 全Surfaceを同じ登録状態・Authority・取消・清掃契約へ接続する。
 * @trace ARCH-000010
 * @input request: 実行要求、registeredTools: 登録集合、signal: 取消Signal。
 * @returns 構造化した状態、実装Identity、出力および残存資源数。
 * @precondition request.surfaceは閉集合、signalは呼出し側lifecycleに属する。
 * @postcondition completed、blocked、cancelledの全経路でresidualResources=0となる。
 * @effect authorizedかつavailableな場合だけ共有実装を一回呼ぶ。
 * @failure 未登録、非公開、Host不可、未許可、取消をEffect 0または安全な取消へ閉じる。
 * @invariant Surfaceごとに別実装や別結果意味を作らない。
 * @boundary Human CLI／MCP／Coordinator／Workbench→Tool Registry→共有実装。
 * @security 未許可要求では共有実装を呼ばない。
 * @concurrency AbortSignalを同じ実行へ渡し、完了後の資源所有を残さない。
 */
export async function executeRegisteredTool(
  request: ToolExecutionRequest,
  registeredTools: readonly RegisteredTool[],
  signal: AbortSignal,
): Promise<
  Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    implementationId: string | null;
    output: string | null;
    effectIssued: boolean;
    residualResources: 0;
  }>
> {
  const observation = inspectRegisteredTool(request.toolId, registeredTools);
  if (observation.state !== "available" || !request.authorized)
    return Object.freeze({
      status: "blocked",
      reason: request.authorized
        ? `tool_${observation.state}`
        : "tool_not_authorized",
      implementationId: observation.implementationId,
      output: null,
      effectIssued: false,
      residualResources: 0,
    });
  if (signal.aborted)
    return Object.freeze({
      status: "cancelled",
      reason: "tool_cancelled",
      implementationId: observation.implementationId,
      output: null,
      effectIssued: false,
      residualResources: 0,
    });
  try {
    const output = await registeredTools
      .find((entry) => entry.toolId === request.toolId)
      ?.execute(request.input, signal);
    if (signal.aborted)
      return Object.freeze({
        status: "cancelled",
        reason: "tool_cancelled",
        implementationId: observation.implementationId,
        output: null,
        effectIssued: false,
        residualResources: 0,
      });
    return Object.freeze({
      status: "completed",
      reason: "tool_completed",
      implementationId: observation.implementationId,
      output: output ?? "",
      effectIssued: true,
      residualResources: 0,
    });
  } catch (error) {
    if (signal.aborted)
      return Object.freeze({
        status: "cancelled",
        reason: "tool_cancelled",
        implementationId: observation.implementationId,
        output: null,
        effectIssued: false,
        residualResources: 0,
      });
    throw error;
  }
}
