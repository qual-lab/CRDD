/**
 * 認可済みRuntime活動をMCPへ搬送する。
 *
 * @responsibility 固定Toolの入力と公開結果をCROS観測契約へ接続する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000012
 */
import {
  parseCrosRuntimeActivityObservation,
  type CrosRemoteRuntimeActivityObservation,
} from "../../../cros/src/index.ts";
import {
  snapshotPlainRecord,
  snapshotOpenPlainRecord,
} from "../request/snapshot.ts";
import {
  callKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../orchestrator/protocol.ts";

export const MCP_RUNTIME_ACTIVITY_TOOL = "crdd.get_runtime_activity" as const;

/**
 * 認可適用済みの活動読取り依存を定義する。
 *
 * @responsibility MCPがRepository探索と認可を再実装しない読取り境界を固定する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape readはProjectとページから観測または非開示nullを返す。
 * @invariant Reader完了を待ち、nullとunknownを混同しない。
 * @boundary MCP入力とCROS活動Ownerの境界。
 * @security 許可集合外のRepositoryを参照しない依存だけを渡す。
 * @compatibility CROSの観測型を直接利用し、同型DTOを作らない。
 */
export type McpRuntimeActivityDependencies = Readonly<{
  read(
    query: Readonly<{ projectId: string; cursor?: string; limit: number }>,
  ): Promise<CrosRemoteRuntimeActivityObservation | null>;
}>;

/**
 * Runtime活動Toolの固定Schemaを返す。
 *
 * @responsibility 一覧とCallで同じ入力契約を公開する。
 * @trace ARCH-000012
 * @input N/A: 引数を受け取らない。
 * @returns 一つのTool記述。
 * @precondition N/A: 固定契約だけを構築する。
 * @postcondition projectIdを必須とし、余剰入力を許可しない。
 * @effect N/A: 値だけを構築する。
 * @failure N/A: 外部処理を行わない。
 * @invariant ページ上限は50、既定20である。
 * @boundary MCP Tool一覧の境界。
 * @security Schemaから未許可Projectを開示しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function getMcpRuntimeActivityToolDefinitions() {
  return Object.freeze([
    Object.freeze({
      name: MCP_RUNTIME_ACTIVITY_TOOL,
      title: "実行状況と履歴を取得",
      description:
        "現在参照可能なProjectの実行状況とページ単位の履歴を取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze(["projectId"]),
        properties: Object.freeze({
          projectId: Object.freeze({
            type: "string",
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
          }),
          cursor: Object.freeze({ type: "string" }),
          limit: Object.freeze({
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 20,
          }),
        }),
      }),
    }),
  ]);
}

/**
 * 固定したRuntime活動Toolを処理する。
 *
 * @responsibility 入力拒否、非開示、観測故障と取消を別のMCP結果へ搬送する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input rawRequest、認可適用済みdependenciesと取消signal。
 * @returns 検査済み観測または非開示・入力拒否・故障・取消応答。
 * @precondition 依存は現在Requestの認可Scopeへ固定済み。
 * @postcondition 正常応答はCROSの閉じた観測型だけを持つ。
 * @effect 有効入力でreadを最大一回呼ぶ。
 * @failure 入力不正は-32602、読取り故障は-32603、取消は-32800。
 * @invariant 非許可と不在を区別せず、unknownを成功空集合へ変えない。
 * @boundary MCP搬送とCROS活動観測の境界。
 * @security Token・Path・内部Snapshotを応答へ追加しない。
 * @concurrency 開始後のreadをjoinし、完了後に取消状態を再確認する。
 */
export async function handleMcpRuntimeActivityRequest(
  rawRequest: unknown,
  dependencies: McpRuntimeActivityDependencies,
  signal: AbortSignal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = snapshotPlainRecord(request.params, callKeys);
  if (
    !params ||
    !inspectMcpEnvelope(params._meta) ||
    params.name !== MCP_RUNTIME_ACTIVITY_TOOL
  )
    return protocolError(request.id, -32602, "Invalid params");
  const args = snapshotOpenPlainRecord(params.arguments);
  if (
    !args ||
    Object.keys(args).some(
      (key) => !["projectId", "cursor", "limit"].includes(key),
    ) ||
    typeof args.projectId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(args.projectId) ||
    (Object.hasOwn(args, "cursor") && typeof args.cursor !== "string") ||
    (Object.hasOwn(args, "limit") &&
      (!Number.isInteger(args.limit) ||
        typeof args.limit !== "number" ||
        args.limit < 1 ||
        args.limit > 50))
  )
    return protocolError(request.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  let observation: CrosRemoteRuntimeActivityObservation | null;
  try {
    observation = await dependencies.read({
      projectId: args.projectId,
      ...(typeof args.cursor === "string" ? { cursor: args.cursor } : {}),
      limit: typeof args.limit === "number" ? args.limit : 20,
    });
  } catch {
    return signal.aborted
      ? protocolError(request.id, -32800, "Request cancelled")
      : protocolError(request.id, -32603, "Runtime activity unavailable");
  }
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  const ownedObservation =
    observation === null
      ? null
      : parseCrosRuntimeActivityObservation(observation);
  if (observation !== null && ownedObservation === null)
    return protocolError(request.id, -32603, "Runtime activity unavailable");
  return protocolComplete(request.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text:
          observation === null
            ? "指定したProjectの実行状況は現在の接続から取得できません。"
            : "実行状況を取得しました。",
      }),
    ]),
    structuredContent:
      ownedObservation ??
      Object.freeze({
        status: "unavailable",
        reason: "cros_runtime_activity_unavailable",
      }),
    isError: observation === null,
  });
}
