/**
 * 構成済みToolを要求別の公式SDK Serverへ登録する。
 * @responsibility 定義とOwnerの対応、現在の一覧、元入力と取消の搬送を所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary 専門Package依存と公式SDKのProtocol受付。
 * @security 認可をcacheせず、要求別Serverを再利用しない。
 */
import {
  Server,
  ProtocolError,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/server";
import type { AiProfileCatalogAdministration } from "../../../ai-adapter/src/index.ts";
import type { TopicMeetingAccess } from "../../../domain-model/src/index.ts";
import { snapshotPlainRecord } from "./snapshot.ts";
import { handleMcpDiscoverRequest } from "./discover.ts";
import {
  callKeys,
  MCP_SERVER_NAME,
  listKeys,
  listKeysNoCursor,
  inspectProtocolRequest,
  inspectMcpEnvelope,
  type McpResponse,
} from "./validation.ts";
import type {
  McpRequestHandler,
  McpServerFactory,
  McpRequestSource,
} from "../transport/types.ts";
import {
  getMcpWorkspaceToolDefinitions,
  handleMcpWorkspaceRequest,
  type WorkspaceAccessResolver,
} from "../tools/workspace.ts";
import {
  getMcpCoordinatorToolDefinitions,
  handleMcpCoordinatorRequest,
  type McpCoordinatorDependencies,
} from "../tools/task.ts";
import {
  getMcpProjectContextToolDefinitions,
  handleMcpProjectContextRequest,
  type McpProjectContextDependencies,
} from "../tools/project-context.ts";
import {
  listMcpAccessTools,
  getMcpAccessManagementToolDefinitions,
  MCP_CURRENT_ACCESS_TOOL_DEFINITION,
  handleMcpAccessRequest,
  type McpAccessManagementContext,
} from "../tools/access-management.ts";
import {
  getMcpAiProfileToolDefinitions,
  handleMcpAiProfileRequest,
} from "../tools/ai-profile.ts";
import {
  getMcpExecutionStatusToolDefinitions,
  handleMcpExecutionStatusRequest,
  type McpExecutionStatusDependencies,
} from "../tools/execution-status.ts";
import {
  getMcpTopicMeetingToolDefinitions,
  handleMcpRoutedTopicMeetingRequest,
  handleMcpTopicMeetingRequest,
  type TopicMeetingAccessResolver,
} from "../tools/topic-meeting.ts";

/**
 * Toolの専門Owner依存を構成する。
 * @responsibility 初回限定接続と通常の専門機能を混同しない。
 * @trace ARCH-000012
 * @shape 専門機能の任意依存と初回限定Handler。
 * @invariant 初回接続へ通常Tool依存を付与しない。
 * @boundary 起動構成と要求別Server。
 * @security Credentialの存在から内容閲覧権を推定しない。
 * @compatibility 専門Ownerの契約を直接利用する。
 */
export type McpServerDependencies = Readonly<{
  initialConnection?: McpRequestHandler;
  orchestrator?: McpCoordinatorDependencies;
  workspace?: WorkspaceAccessResolver;
  projectContext?: McpProjectContextDependencies;
  runtimeActivity?: McpExecutionStatusDependencies;
  aiProfileAdministration?: AiProfileCatalogAdministration;
  aiProfileAdministrationResolver?: () => AiProfileCatalogAdministration | null;
  accessManagement?: McpAccessManagementContext;
  topicMeeting?: TopicMeetingAccess;
  topicMeetingRepositoryResolver?: TopicMeetingAccessResolver;
}>;

/**
 * 専門Ownerを公式SDKへ接続する要求別Factoryを作る。
 * @responsibility Protocolのmethod受付をSDKへ委譲し、Toolの固定構成だけを結合する。
 * @trace ARCH-000012
 * @input 各専門Ownerの依存。
 * @returns 要求ごとにSDK Serverを生成するFactory。
 * @precondition 依存は現在認可を評価するOwnerへ接続されている。
 * @postcondition 入力不正ではOwnerを呼ばず、開始済みPromiseを観測先へ渡す。
 * @effect 選択ToolのOwnerだけが既存契約に従いEffectを発行する。
 * @failure 閉入力・未構成Tool・構成故障・Owner故障をProtocol errorへ分離する。
 * @invariant 一覧とCallの名前は同じ定義集合から得る。永続Registryを作らない。
 * @boundary 現在認証の構成と公式SDK登録。
 * @security SDKの正規化前の元入力をOwnerへ渡し、未知field拒否を維持する。
 * @concurrency HTTPとstdio内部接続の一要求ごとに新規生成する。
 */
export function createMcpServerFactory(
  dependencies: McpServerDependencies,
): McpServerFactory {
  const {
    workspace,
    orchestrator,
    projectContext,
    accessManagement,
    runtimeActivity,
    topicMeeting,
    topicMeetingRepositoryResolver,
    aiProfileAdministration,
    aiProfileAdministrationResolver,
  } = dependencies;
  return {
    async createServer(rawRequest, signal, observe) {
      const request = inspectProtocolRequest(rawRequest);
      if (!request) throw new ProtocolError(-32600, "Invalid Request");
      if (
        !["server/discover", "tools/list", "tools/call"].includes(
          request.method,
        )
      )
        throw new ProtocolError(-32601, "Method not found");
      if (
        aiProfileAdministration !== undefined &&
        aiProfileAdministrationResolver !== undefined
      )
        throw new ProtocolError(-32603, "Invalid Profile configuration");
      if (
        dependencies.initialConnection &&
        Object.keys(dependencies).length !== 1
      )
        throw new ProtocolError(-32603, "Invalid initial configuration");
      if (
        dependencies.initialConnection ||
        request.method === "server/discover"
      ) {
        const checked = dependencies.initialConnection
          ? await dependencies.initialConnection(rawRequest, signal)
          : handleMcpDiscoverRequest(rawRequest);
        if (checked.error)
          throw new ProtocolError(checked.error.code, checked.error.message);
      }
      const isList = request.method === "tools/list";
      const params: Readonly<Record<string, unknown>> | null = isList
        ? (snapshotPlainRecord(request.params, listKeysNoCursor) ??
          snapshotPlainRecord(request.params, listKeys))
        : snapshotPlainRecord(request.params, callKeys);
      if (
        isList &&
        (!params ||
          !inspectMcpEnvelope(params._meta) ||
          (Object.hasOwn(params, "cursor") && params.cursor !== null))
      )
        throw new ProtocolError(-32602, "Invalid params");
      if (isList && signal.aborted)
        throw new ProtocolError(-32800, "Request cancelled");
      const bindings: {
        definitions: readonly { name: string }[];
        invoke: McpRequestHandler;
      }[] = [];
      if (workspace)
        bindings.push({
          definitions: getMcpWorkspaceToolDefinitions(),
          invoke: (raw, current) =>
            handleMcpWorkspaceRequest(raw, workspace, current),
        });
      if (orchestrator)
        bindings.push({
          definitions: getMcpCoordinatorToolDefinitions(),
          invoke: (raw, current) =>
            handleMcpCoordinatorRequest(raw, orchestrator, current),
        });
      if (projectContext)
        bindings.push({
          definitions: getMcpProjectContextToolDefinitions(),
          invoke: (raw, current) =>
            handleMcpProjectContextRequest(raw, projectContext, current),
        });
      if (accessManagement) {
        let definitions: ReturnType<typeof listMcpAccessTools>;
        try {
          definitions = isList
            ? listMcpAccessTools(accessManagement)
            : [
                MCP_CURRENT_ACCESS_TOOL_DEFINITION,
                ...getMcpAccessManagementToolDefinitions(),
              ];
        } catch {
          throw new ProtocolError(-32603, "Access management unavailable");
        }
        bindings.push({
          definitions,
          invoke: (raw, current) =>
            handleMcpAccessRequest(raw, accessManagement, current),
        });
      }
      let profileAvailable =
        aiProfileAdministration !== undefined ||
        aiProfileAdministrationResolver !== undefined;
      if (isList) {
        try {
          profileAvailable =
            (aiProfileAdministrationResolver
              ? aiProfileAdministrationResolver()
              : (aiProfileAdministration ?? null)) !== null;
        } catch {
          throw new ProtocolError(
            -32603,
            "AI Profile administration unavailable",
          );
        }
      }
      if (profileAvailable)
        bindings.push({
          definitions: getMcpAiProfileToolDefinitions(),
          invoke: (raw, current) =>
            handleMcpAiProfileRequest(
              raw,
              aiProfileAdministrationResolver ??
                (aiProfileAdministration as AiProfileCatalogAdministration),
              current,
            ),
        });
      if (runtimeActivity)
        bindings.push({
          definitions: getMcpExecutionStatusToolDefinitions(),
          invoke: (raw, current) =>
            handleMcpExecutionStatusRequest(raw, runtimeActivity, current),
        });
      if (topicMeetingRepositoryResolver || topicMeeting)
        bindings.push({
          definitions: getMcpTopicMeetingToolDefinitions(
            topicMeetingRepositoryResolver ? "required" : "implicit",
          ),
          invoke: (raw, current) =>
            topicMeetingRepositoryResolver
              ? handleMcpRoutedTopicMeetingRequest(
                  raw,
                  topicMeetingRepositoryResolver,
                  current,
                )
              : handleMcpTopicMeetingRequest(
                  raw,
                  topicMeeting as TopicMeetingAccess,
                  current,
                ),
        });
      const server = new Server(
        { name: MCP_SERVER_NAME, version: "0.20.0-development" },
        {
          capabilities: { tools: {} },
          cacheHints: {
            "server/discover": { ttlMs: 0, cacheScope: "private" },
          },
        },
      );
      server.setRequestHandler("tools/list", async (_request, context) => {
        if (signal.aborted || context.mcpReq.signal.aborted)
          throw new ProtocolError(-32800, "Request cancelled");
        return {
          tools: bindings.flatMap((binding) => binding.definitions),
          ttlMs: 0,
          cacheScope: "private",
        } as unknown as ListToolsResult;
      });
      server.setRequestHandler("tools/call", async (_request, context) => {
        if (!params || !inspectMcpEnvelope(params._meta))
          throw new ProtocolError(-32602, "Invalid params");
        const binding = bindings.find((item) =>
          item.definitions.some(
            (definition) => definition.name === params.name,
          ),
        );
        const invoke =
          binding?.invoke ??
          (orchestrator
            ? (raw: unknown, current: AbortSignal) =>
                handleMcpCoordinatorRequest(raw, orchestrator, current)
            : null);
        if (!invoke) throw new ProtocolError(-32601, "Method not found");
        const combined = AbortSignal.any([signal, context.mcpReq.signal]);
        const pending = Promise.resolve().then(() =>
          invoke(rawRequest, combined),
        );
        observe?.(pending, context.mcpReq.signal);
        let result: McpResponse;
        try {
          result = await pending;
        } catch {
          throw new ProtocolError(-32603, "Internal error");
        }
        if (result.error)
          throw new ProtocolError(result.error.code, result.error.message);
        if (!result.result) throw new ProtocolError(-32603, "Internal error");
        return result.result as CallToolResult;
      });
      return server;
    },
  };
}

/**
 * 本番Factoryまたは限定Handlerを同じ要求別SDK Serverへ接続する。
 * @responsibility Transportに重複したTool dispatchを持たせない。
 * @trace ARCH-000012
 * @input 現在の接続、元入力、取消、開始済みOwnerの観測。
 * @returns この一要求だけを処理するSDK Server。
 * @precondition raw本文の完全性・容量は入口で検査する。
 * @postcondition discoverの初回確認をSDK自動応答より先に実行する。
 * @effect Handlerまたは専門Ownerの契約に従う。
 * @failure 内部例外を固定Protocol errorへ閉じる。
 * @invariant Serverと現在認可を後続要求へ再利用しない。
 * @boundary Transportの構成とSDK登録。
 * @security 正規化前の元入力をOwnerへ渡す。
 * @concurrency 開始済みPromiseを呼出し側へ渡してjoin可能にする。
 */
export async function createMcpRequestServer(
  source: McpRequestSource,
  rawRequest: unknown,
  signal: AbortSignal,
  observe: (pending: Promise<McpResponse>, sdkSignal: AbortSignal) => void,
): Promise<Server> {
  if (typeof source !== "function")
    return source.createServer(rawRequest, signal, observe);
  const request = inspectProtocolRequest(rawRequest);
  if (!request) throw new ProtocolError(-32600, "Invalid Request");
  if (request.method === "server/discover") {
    const result = await source(rawRequest, signal);
    if (result.error)
      throw new ProtocolError(result.error.code, result.error.message);
  }
  const server = new Server(
    { name: MCP_SERVER_NAME, version: "0.20.0-development" },
    {
      capabilities: { tools: {} },
      cacheHints: { "server/discover": { ttlMs: 0, cacheScope: "private" } },
    },
  );
  const invoke = async (sdkSignal: AbortSignal) => {
    const pending = Promise.resolve().then(() =>
      source(rawRequest, AbortSignal.any([signal, sdkSignal])),
    );
    observe(pending, sdkSignal);
    let result: McpResponse;
    try {
      result = await pending;
    } catch {
      throw new ProtocolError(-32603, "Internal error");
    }
    if (result.error)
      throw new ProtocolError(result.error.code, result.error.message);
    if (!result.result) throw new ProtocolError(-32603, "Internal error");
    return result.result;
  };
  server.setRequestHandler(
    "tools/list",
    async (_request, context) =>
      (await invoke(context.mcpReq.signal)) as ListToolsResult,
  );
  server.setRequestHandler(
    "tools/call",
    async (_request, context) =>
      (await invoke(context.mcpReq.signal)) as CallToolResult,
  );
  return server;
}
