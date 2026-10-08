/**
 * Repository単体とCROS Federationを同じ意味で公開するProject Context Adapter。
 *
 * @packageDocumentation
 * @responsibility 許可済みPortfolio ProjectionをProject一覧・五場面取得へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Context ProjectionとMCP応答の境界。
 * @effect Read Portfolio依存を呼び出すが、Project Context正本を変更しない。
 * @concurrency 一Requestにつき一つの不変Portfolio Snapshotを使用する。
 * @security 入力ProjectionにないProject、Repositoryまたは期待Contextを補完しない。
 */
import { types as utilTypes } from "node:util";

import type { PortfolioProjection } from "../../../cros/src/index.ts";
import {
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
} from "./protocol.ts";
import {
  callKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../orchestrator/protocol.ts";

/**
 * Project Context Adapterの外部依存を定義する。
 *
 * @responsibility Authority適用後のPortfolio Snapshot取得Portを所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape readPortfolioだけを持つ読取り専用依存を表す。
 * @invariant AdapterはRepository探索やWorkspace Grant判定を再実装しない。
 * @boundary MCP AdapterとRepository Reader／CROS Federationの境界。
 * @security readPortfolioは呼出し主体へ開示可能なSourceだけを返す。
 * @compatibility PortfolioProjectionの公開契約変更時はAdapterを再評価する。
 */
export type McpProjectContextDependencies = Readonly<{
  readPortfolio: () => Promise<PortfolioProjection>;
}>;

/**
 * 値がAccessor等を持たないPlain Objectか判定する。
 *
 * @responsibility Tool引数の安全なObject境界を判定する。
 * @trace ARCH-000012
 * @input valueに外部入力を受け取る。
 * @returns Plain Objectならtrueを返す。
 * @precondition N/A: unknownを受け取る。
 * @postcondition GetterやProxyを評価しない。
 * @effect N/A: 入力を変更しない。
 * @failure N/A: 判定不能値はfalseへ閉じる。
 * @invariant Object.prototypeを持つ非配列だけを受理する。
 * @boundary 外部JSON値とProcess内Objectの境界。
 * @security ProxyとAccessorを拒否する。
 * @concurrency N/A: 同期判定である。
 */
function plain(value: unknown): value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return Object.values(
    Object.getOwnPropertyDescriptors(value as Record<string, unknown>),
  ).every((descriptor) => "value" in descriptor);
}

/**
 * Project Context Tool Callを処理する。
 *
 * @responsibility 一覧・取得要求を検証し、一つのPortfolio Snapshotから応答する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input rawRequest、dependenciesおよび取消Signalを受け取る。
 * @returns MCP応答を返す。
 * @precondition 呼出し元がProject Context Tool名だけをRoutingする。
 * @postcondition 取得結果は五場面を含む保存済みContextか、非開示なNot Foundとなる。
 * @effect readPortfolioを一回だけ呼び出す。
 * @failure 入力不正、読取失敗、取消または未検出を構造化Errorへ閉じる。
 * @invariant 一覧と取得で同じPortfolio Snapshot契約を使用する。
 * @boundary MCP Tool CallとProject Context Consumer Read Modelの境界。
 * @security 未検出時にGrant外Sourceの存在や件数を返さない。
 * @concurrency Request間でSnapshotや認証状態を共有しない。
 */
export async function handleMcpProjectContextRequest(
  rawRequest: unknown,
  dependencies: McpProjectContextDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = plain(request.params) ? request.params : null;
  if (
    !params ||
    Object.keys(params).some((key) => !callKeys.has(key as never)) ||
    !inspectMcpEnvelope(params._meta) ||
    (params.name !== MCP_PROJECT_CONTEXT_LIST_TOOL &&
      params.name !== MCP_PROJECT_CONTEXT_GET_TOOL)
  )
    return protocolError(request.id, -32602, "Invalid params");
  const args = plain(params.arguments) ? params.arguments : null;
  const keys = args ? Object.keys(args) : [];
  if (
    !args ||
    (params.name === MCP_PROJECT_CONTEXT_LIST_TOOL && keys.length !== 0) ||
    (params.name === MCP_PROJECT_CONTEXT_GET_TOOL &&
      (keys.length !== 1 ||
        !Object.hasOwn(args, "projectId") ||
        typeof args.projectId !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(args.projectId)))
  )
    return protocolError(request.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  let portfolio: PortfolioProjection;
  try {
    portfolio = await dependencies.readPortfolio();
  } catch {
    return protocolError(request.id, -32603, "Project Context unavailable");
  }
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  if (params.name === MCP_PROJECT_CONTEXT_LIST_TOOL)
    return protocolComplete(request.id, {
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text: `${portfolio.projects.length}件のProject Contextを取得しました。`,
        }),
      ]),
      structuredContent: Object.freeze({
        projects: Object.freeze(
          portfolio.projects.map(({ projectId, state, sources }) =>
            Object.freeze({
              projectId,
              state,
              sourceCount: sources.length,
            }),
          ),
        ),
        retainedAsSourceOfTruth: false,
      }),
      isError: false,
    });
  const project = portfolio.projects.find(
    ({ projectId }) => projectId === args.projectId,
  );
  if (!project)
    return protocolComplete(request.id, {
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text: "指定したProject Contextは現在の接続から取得できません。",
        }),
      ]),
      structuredContent: Object.freeze({
        status: "unavailable",
        reason: "project_context_not_available",
      }),
      isError: true,
    });
  return protocolComplete(request.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text: `${project.projectId}のProject Contextを取得しました。`,
      }),
    ]),
    structuredContent: Object.freeze({
      status: "completed",
      project,
      retainedAsSourceOfTruth: false,
    }),
    isError: false,
  });
}
