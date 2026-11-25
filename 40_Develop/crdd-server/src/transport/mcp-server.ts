/**
 * MCPの公開入口と要求別の公式SDK Serverを構成する。
 * @responsibility 定義とOwnerの対応、現在の一覧、元入力と取消の搬送を所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary 専門Package依存と公式SDKのProtocol受付。
 * @security 認可をcacheせず、要求別Serverを再利用しない。
 */
import {
  confirmInitialConnection,
  resolveConnectionAuthentication,
  resolveRepositoryAccessCollection,
  sameAccessCollection,
  type FilesystemStoreRoot,
  type InitialConnectionBinding,
  authenticateNormalConnection,
  readCurrentAccess,
  readManagementState,
} from "../../../access-management/src/index.ts";
import { resolveSharedDefinitionAccess } from "../service/execution.ts";
import { resolveSharedDevelopmentAccess } from "../service/access.ts";
import { executeMeetingAction } from "../service/meeting.ts";
import {
  executeTopicAction,
  type RecordWriteCommand,
} from "../service/topic.ts";
import {
  resolveTopicMeetingAccess,
  readAuthorizedPortfolio,
  readAuthorizedExecutionActivity,
  executeCoordinatorOperation,
  prepareWorkspaceOperation,
  type CoordinatorExecutionConfiguration,
  type CoordinatorExecutionDependencies,
  validateExecutionDefinitionCommand,
  executeDefinitionOperation,
  definitionReadFields,
  definitionWriteFields,
} from "../service/entry.ts";
import { readServerConnectionConfiguration } from "../service/configuration.ts";
import {
  Server,
  ProtocolError,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/server";
import {
  type TopicMeetingAccess,
  type PortfolioProjection,
  parseMeetingMarkdown,
  parseTopicMarkdown,
  readTopicMeetingList,
} from "../../../document-model/src/index.ts";
import type {
  McpRequestHandler,
  McpServerFactory,
  McpAuthenticatedRequestHandlerResolver,
} from "./mcp-types.ts";
import type { DefinitionAccess } from "../service/execution.ts";
import type { ExecutionActivityObservation } from "../../../coordinator/src/index.ts";
import { setTimeout } from "node:timers/promises";
import {
  executeManagementOperation,
  type ManagementWriteOperation,
} from "../service/access.ts";
import type { JsonRpcId, McpResponse } from "./mcp-types.ts";
import {
  handleMcpDiscoverRequest,
  MCP_SERVER_NAME,
  readRequestRecord,
  inspectMcpToolParameters,
  inspectMcpEnvelope,
  protocolError,
  protocolComplete,
  inspectProtocolRequest,
  listKeys,
  listKeysNoCursor,
  callKeys,
} from "./mcp-protocol.ts";

export { MCP_COORDINATOR_PROTOCOL_VERSION } from "./mcp-protocol.ts";
export {
  MCP_COORDINATOR_STREAMABLE_HTTP_CONTRACT,
  createMcpHttpRequestHandler,
  startMcpStreamableHttp,
  startMcpAuthenticatedStreamableHttp,
  describeMcpCoordinatorStreamableHttpContract,
  closeMcpHttpOnProcessSignal,
} from "./mcp-http.ts";
export {
  MCP_COORDINATOR_STDIO_CONTRACT,
  runMcpStdio,
  describeMcpCoordinatorStdioContract,
} from "./mcp-stdio.ts";
export type {
  McpResponse,
  McpCoordinatorHttpOptions,
  McpAuthenticatedHttpOptions,
  McpHttpServerCloseBoundary,
  McpProcessSignalSource,
} from "./mcp-types.ts";

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
  coordinator?: McpCoordinatorConfiguration;
  workspace?: WorkspaceAccessResolver;
  projectContext?: McpProjectContextDependencies;
  executionActivity?: ExecutionActivityReader;
  accessManagement?: McpAccessManagementContext;
  topicMeeting?: TopicMeetingAccess;
  topicMeetingRepositoryResolver?: TopicMeetingAccessResolver;
  runtimeDefinition?: RuntimeContentAccessResolver;
}>;

/** SDK登録で一度受理したTool呼出し。 @trace ARCH-000012 */
type McpToolCall = Readonly<{
  id: JsonRpcId;
  name: string;
  arguments: unknown;
}>;

/** 公開ハンドラーを直接使う場合も同じTool外枠を受理する。 @trace ARCH-000012 */
function readDirectToolCall(
  raw: unknown,
  plainParams = false,
): McpToolCall | McpResponse {
  const request = inspectProtocolRequest(raw);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const input = request.params;
  const params = plainParams
    ? plain(input) &&
      Object.keys(input).every((key) => callKeys.has(key as never)) &&
      inspectMcpEnvelope(input._meta)
      ? input
      : null
    : inspectMcpToolParameters(input);
  if (typeof params?.name !== "string")
    return protocolError(request.id, -32602, "Invalid params");
  return { id: request.id, name: params.name, arguments: params.arguments };
}

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
    coordinator,
    projectContext,
    accessManagement,
    executionActivity,
    topicMeeting,
    topicMeetingRepositoryResolver,
    runtimeDefinition,
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
        ? (readRequestRecord(request.params, listKeysNoCursor) ??
          readRequestRecord(request.params, listKeys))
        : readRequestRecord(request.params, callKeys);
      if (
        isList &&
        (!params ||
          !inspectMcpEnvelope(params._meta) ||
          (Object.hasOwn(params, "cursor") && params.cursor !== null))
      )
        throw new ProtocolError(-32602, "Invalid params");
      if (isList && signal.aborted)
        throw new ProtocolError(-32800, "Request cancelled");
      if (signal.aborted) throw new ProtocolError(-32800, "Request cancelled");
      const toolName = params?.name;
      const toolArguments = params?.arguments;
      const toolMetadata = params?._meta;
      const sharedExecution =
        coordinator && "scope" in coordinator && coordinator.scope === "shared";
      const bindings: {
        definitions: readonly { name: string }[];
        invoke: (
          call: McpToolCall,
          signal: AbortSignal,
        ) => Promise<McpResponse>;
      }[] = [];
      if (runtimeDefinition)
        bindings.push({
          definitions: getExecutionDefinitionToolDefinitions(),
          invoke: (call, current) =>
            dispatchExecutionDefinitionTool(call, runtimeDefinition, current),
        });
      if (workspace)
        bindings.push({
          definitions: getWorkspaceToolDefinitions(),
          invoke: (call, current) =>
            dispatchWorkspaceTool(call, workspace, current),
        });
      if (coordinator)
        bindings.push({
          definitions: getExecutionToolDefinitions(sharedExecution === true),
          invoke: (call, current) =>
            dispatchExecutionTool(call, coordinator, current),
        });
      if (projectContext)
        bindings.push({
          definitions: getProjectToolDefinitions(),
          invoke: (call, current) =>
            dispatchProjectTool(call, projectContext, current),
        });
      if (accessManagement) {
        let definitions: ReturnType<typeof listMcpAccessTools>;
        try {
          definitions = isList
            ? listMcpAccessTools(accessManagement)
            : [
                MCP_CURRENT_ACCESS_TOOL_DEFINITION,
                ...getAccessToolDefinitions(),
              ];
        } catch {
          throw new ProtocolError(-32603, "Access management unavailable");
        }
        bindings.push({
          definitions,
          invoke: (call, current) =>
            dispatchAccessTool(call, accessManagement, current),
        });
      }
      if (executionActivity)
        bindings.push({
          definitions: getExecutionActivityToolDefinitions(),
          invoke: (call, current) =>
            dispatchActivityTool(call, executionActivity, current),
        });
      if (topicMeetingRepositoryResolver || topicMeeting)
        bindings.push({
          definitions: getTopicMeetingToolDefinitions(
            topicMeetingRepositoryResolver ? "required" : "implicit",
          ),
          invoke: (call, current) =>
            topicMeetingRepositoryResolver
              ? dispatchRoutedTopicMeetingCall(
                  call,
                  topicMeetingRepositoryResolver,
                  current,
                )
              : dispatchTopicMeetingCall(
                  call,
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
        if (!params || !inspectMcpEnvelope(toolMetadata))
          throw new ProtocolError(-32602, "Invalid params");
        const binding = bindings.find((item) =>
          item.definitions.some((definition) => definition.name === toolName),
        );
        if (!binding || typeof toolName !== "string") {
          if (coordinator && !sharedExecution)
            throw new ProtocolError(-32602, "Invalid params");
          throw new ProtocolError(-32601, "Method not found");
        }
        if (
          (toolName === MCP_PROJECT_CONTEXT_LIST_TOOL ||
            toolName === MCP_PROJECT_CONTEXT_GET_TOOL ||
            MCP_TOPIC_MEETING_TOOLS.includes(toolName as never)) &&
          Object.getPrototypeOf(request.params) !== Object.prototype
        )
          throw new ProtocolError(-32602, "Invalid params");
        const call = {
          id: request.id,
          name: toolName,
          arguments: toolArguments,
        };
        const combined = AbortSignal.any([signal, context.mcpReq.signal]);
        const pending = Promise.resolve().then(() =>
          binding.invoke(call, combined),
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
 * 現在資格から初回限定または通常内容の要求専用Handlerを作る。
 * @responsibility 管理能力から内容を生成せず、公開Callで現在集合を取り直す。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 内部構成が検証した管理Root。
 * @returns 初回候補はdiscover専用Handler、通常本人は内容Handler、拒否はnull。
 * @precondition HTTP Transportは要求毎にResolverを呼び、Handlerを要求終了後に共有しない。
 * @postcondition Portfolioは現在集合を公開前に再確認し文書不完全性を保持する。Topic／Meetingは現在許可対象だけを操作する。
 * @effect 既存AM認証とLock、許可後のDomain読取りと明示CRUD。新StoreやSessionは作らない。
 * @failure 認証不成立はnull、内容認可・本文取得不成立は既存の固定MCPエラー。
 * @invariant 空認可だけ正常空集合。文書不明はunavailableとnull本文／版で示し、完全成功やmissingにしない。
 * @boundary AM内部RootからProject ContextとTopic／MeetingのMCP構成へ渡す。
 * @security Bearerを要求closureにだけ保持し、Root・Path・Binding・管理改訂を返さない。文字列消去は保証しない。
 * @concurrency 各HTTP要求が再認証・再認可する。同期Reader開始後は終了を待って取消結果の公開を止める。
 */
export function createAccessMcpResolver(
  root: FilesystemStoreRoot,
): McpAuthenticatedRequestHandlerResolver {
  return (token) => {
    const authentication = resolveConnectionAuthentication(root, token);
    if (authentication.status === "unavailable") return null;
    if (authentication.status === "initial")
      return createMcpServerFactory({
        initialConnection: createInitialConnectionHandler(
          root,
          token,
          authentication.binding,
        ),
      });
    return {
      async createServer(request, signal, observe) {
        return createMcpServerFactory({
          accessManagement: { root, token },
          coordinator: {
            scope: "shared",
            credentials: { root, token },
          },
          runtimeDefinition: (repositoryId, currentSignal) =>
            resolveSharedDefinitionAccess(
              root,
              token,
              repositoryId,
              currentSignal,
            ),
          workspace: (repositoryId) =>
            resolveSharedDevelopmentAccess(root, token, repositoryId, signal),
          executionActivity: {
            /**
             * 現在許可された同Projectの実保存活動を読む。
             * @responsibility 各Callの現在認可を活動Ownerへ最小入力で接続する。
             * @trace ARCH-000005
             * @trace ARCH-000012
             * @trace ARCH-000013
             * @input Projectとページ要求。
             * @returns 同Projectの観測、許可対象がない場合だけnull。
             * @precondition 入力検査と開始前取消確認が完了している。
             * @postcondition 許可対象全件を渡し、部分集合へ後退しない。
             * @effect 現在認可、Root観測、実保存読取り。書込みは行わない。
             * @failure 集合・Root不明は固定例外、Owner故障はAdapterが非開示にする。
             * @invariant 各Callで再認可し、認証を観測型の正しさで代替しない。
             * @boundary AM現在集合からCoordinator活動Owner。
             * @security Token・AM Binding・RoleをOwnerや応答へ渡さない。
             * @concurrency 開始したReaderを待ち、Adapterが取消後の公開を止める。
             */
            read: async (query) => {
              if (signal.aborted)
                throw new Error("runtime_activity_unavailable");
              const collection = resolveRepositoryAccessCollection(root, token);
              if (collection.status !== "completed")
                throw new Error("runtime_activity_unavailable");
              const selected = collection.repositories.filter(
                (repository) =>
                  repository.manifest.projectId === query.projectId,
              );
              if (selected.length === 0) return null;
              if (signal.aborted)
                throw new Error("runtime_activity_unavailable");
              return readAuthorizedExecutionActivity(
                query,
                selected,
                () =>
                  sameAccessCollection(
                    collection,
                    resolveRepositoryAccessCollection(root, token),
                  ),
                signal,
              );
            },
          },
          /**
           * 現在許可対象の操作と同ProjectのRelation集合を構成する。
           * @responsibility 未許可対象・異Project探索・部分集合への後退を防ぐ。
           * @trace ARCH-000006
           * @trace ARCH-000013
           * @input 完全Schema検査後の明示Repository ID。
           * @returns 指定対象のDomain操作、非許可時はnull。
           * @precondition 通常認証済みで、入力検査と開始前取消確認が完了している。
           * @postcondition 同Project全対象を検証し、書込み先は指定Repositoryだけに固定する。
           * @effect 現在AM集合とRootを観測し、Domain操作を構成する。構成時の保存はない。
           * @failure 集合・Root・構成不明は固定例外で全体停止する。
           * @invariant 各Tool Callで再認可し、他要求へ操作や集合を共有しない。
           * @boundary AM現在認可→Version Control Root→Domain操作／Relation。
           * @security Bearer、Root、Bindingを公開結果へ渡さない。
           * @concurrency 同期構成後に既存Adapterが取消を再確認する。保存開始後のrollbackは保証しない。
           */
          topicMeetingRepositoryResolver: (repositoryId) => {
            if (signal.aborted)
              throw new Error("topic_meeting_access_unavailable");
            const collection = resolveRepositoryAccessCollection(root, token);
            if (collection.status !== "completed")
              throw new Error("topic_meeting_access_unavailable");
            return resolveTopicMeetingAccess(
              collection.repositories,
              repositoryId,
              signal,
              "topic_meeting_access_unavailable",
            );
          },
          projectContext: {
            /**
             * 内容Callの現在認可と実本文を一つのPortfolioへ閉じる。
             * @responsibility 非許可読取りを防ぎ、文書未確認・競合を認可済みSourceへ限定して表示する。
             * @trace ARCH-000005
             * @trace ARCH-000013
             * @input N/A: 当該要求のBearerと取消Signalだけを使用する。
             * @returns Domainが集約した非秘密Portfolio。
             * @precondition 通常Header認証が完了し、Tool入力は既存Adapterが検査済み。
             * @postcondition 認可・実体・全集合の再確認が成功した場合だけ、不完全性を保持した結果を返す。
             * @effect 現在許可集合の再取得と各固定本文の同期読取り。
             * @failure 取消・集合不明・Root不成立・公開前集合差は全体拒否。本文不成立はSourceの未確認・競合。
             * @invariant SourceはProject・Repository・読取り状態・本文版・解析Contextの5項目だけ。非completeは本文・版なし。
             * @boundary AM現在認可→Domain本文／集約→既存MCP Adapter。
             * @security Token・技術的Root・下位例外を結果へ透過しない。
             * @concurrency cacheせず呼出し毎に現在認可する。同期I/Oの中断保証はしない。
             */
            readPortfolio: async () => {
              if (signal.aborted)
                throw new Error("project_context_unavailable");
              const collection = resolveRepositoryAccessCollection(root, token);
              if (collection.status !== "completed")
                throw new Error("project_context_unavailable");
              const portfolio = readAuthorizedPortfolio(
                collection.repositories,
                signal,
              );
              if (
                !sameAccessCollection(
                  collection,
                  resolveRepositoryAccessCollection(root, token),
                ) ||
                signal.aborted
              )
                throw new Error("project_context_unavailable");
              return portfolio;
            },
          },
        }).createServer(request, signal, observe);
      },
    };
  };
}

/**
 * 初回限定相関を完全要求検査後の確認保存へ渡す。
 * @responsibility 成功応答を保存・清掃・Lock終了後だけに限定する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 検証済みRoot、当該要求のBearer、非Authority初回相関。
 * @returns 要求専用Handler。通常HandlerやTool依存を受け取らない。
 * @precondition Resolverが同Lockの用途判定でinitialを返した当該要求だけ。
 * @postcondition 不正／開始前取消はconfirm0、正規要求だけfresh保存後に非秘密応答。
 * @effect 有効discoverだけ既存AM確認保存を一回呼ぶ。
 * @failure AM拒否・失効・状態故障は一つの固定非開示error。
 * @invariant 同要求へ通常Authorityを発行せず、初期化・鍵管理を公開しない。
 * @boundary 完全MCP要求→AM同期保存→応答前取消再確認。
 * @security BearerとBindingは要求closureだけ。応答・Error・永続記録へ透過しない。
 * @concurrency 保存前Signalを確認し、同期保存終了後にも確認して成功公開を止める。
 */
function createInitialConnectionHandler(
  root: FilesystemStoreRoot,
  token: string,
  binding: InitialConnectionBinding,
): McpRequestHandler {
  return async (request, signal) => {
    const response = handleMcpDiscoverRequest(request);
    if (response.error) return response;
    if (signal.aborted)
      return protocolError(response.id, -32800, "Request cancelled");
    const confirmed = confirmInitialConnection(root, token, binding, signal);
    if (signal.aborted)
      return protocolError(response.id, -32800, "Request cancelled");
    return confirmed.status === "completed"
      ? response
      : protocolError(response.id, -32603, "Initial connection unavailable");
  };
}

export type {
  McpAuthenticatedRequestHandlerResolver,
  McpRequestHandler,
  McpServerFactory,
  McpRequestSource,
} from "./mcp-types.ts";

/** 明示CROS起動時に既存の非秘密設定を一回読む。 @trace ARCH-000012 */
export function readMcpServerConfiguration(workingDirectory: string) {
  return readServerConnectionConfiguration(workingDirectory, "mcp");
}

/**
 * adapterで使用するMcp Coordinator Dependenciesの値契約を定義する。
 *
 * @responsibility Mcp Coordinator DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpCoordinatorDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpCoordinatorDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpCoordinatorDependenciesの宣言は外部境界を開かない。
 * @security N/A: McpCoordinatorDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpCoordinatorDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpCoordinatorDependencies = CoordinatorExecutionDependencies;
type McpCoordinatorConfiguration = CoordinatorExecutionConfiguration;

/**
 * Mcp Coordinator Requestを処理する。
 *
 * @responsibility Mcp Coordinator Requestの受付条件、処理結果、失敗時の戻り境界を所有する。
 * @trace ARCH-000012
 * @input rawRequest: unknown、dependencies: McpCoordinatorDependencies、signal: AbortSignal
 * @returns Promise<McpResponse>を返す。
 * @precondition 「rawRequest: unknown、dependencies: McpCoordinatorDependencies、signal: AbortSignal」がhandleMcpCoordinatorRequestの入力契約を満たす。
 * @postcondition handleMcpCoordinatorRequestの責務を完了した結果だけを返す。
 * @effect 選択された実行系ToolでだけCoordinatorを読み、認証後に既存の操作へ委譲する。
 * @failure handleMcpCoordinatorRequestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant handleMcpCoordinatorRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: handleMcpCoordinatorRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency handleMcpCoordinatorRequestは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function dispatchExecutionTool(
  params: McpToolCall,
  dependencies: McpCoordinatorConfiguration,
  signal: AbortSignal,
): Promise<McpResponse> {
  const shared = "scope" in dependencies && dependencies.scope === "shared";
  const operation =
    params.name === MCP_COORDINATOR_OBJECTIVE_TOOL
      ? "objective"
      : params.name === MCP_COORDINATOR_DECISION_TOOL
        ? "decision"
        : "state";
  const outcome = await executeCoordinatorOperation(
    operation,
    params.arguments,
    dependencies,
    signal,
  );
  if (outcome.kind === "invalid")
    return protocolError(params.id, -32602, "Invalid params");
  if (outcome.kind === "cancelled")
    return protocolError(params.id, -32800, "Request cancelled");
  if (outcome.kind === "unavailable")
    return protocolError(params.id, -32603, "Coordinator unavailable");
  if (outcome.kind === "publication_denied")
    return protocolError(params.id, -32603, "Coordinator target unavailable");
  const denied = outcome.kind === "access_denied";
  const result =
    outcome.kind === "result"
      ? outcome.value
      : denied
        ? {
            status: "blocked",
            reason: shared
              ? "mcp_execution_access_unavailable"
              : "mcp_client_not_authenticated",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            effectState: "no_effect",
          }
        : {
            status: "blocked",
            reason: "mcp_coordinator_result_invalid",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          };
  const isError = result.status !== "completed";
  return protocolComplete(params.id, {
    content: [
      {
        type: "text",
        text: denied
          ? shared
            ? "実行対象を確認できないため、処理を開始していません。"
            : "利用者を確認できないため、処理を開始していません。"
          : isError
            ? "処理は完了していません。構造化された理由を確認してください。"
            : "処理が完了しました。",
      },
    ],
    structuredContent: result,
    isError,
  });
}

const MCP_COORDINATOR_OBJECTIVE_TOOL = "crdd.run_objective" as const;
const MCP_COORDINATOR_DECISION_TOOL = "crdd.submit_decision" as const;
const MCP_COORDINATOR_STATE_TOOL = "crdd.get_execution_state" as const;

const objectiveKeys = new Set([
  "operation",
  "plan",
  "taskInputs",
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
  "workType",
  "choice",
  "workspaceId",
] as const);
const stateQueryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);

/**
 * toolを決定する。
 *
 * @responsibility toolの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000012
 * @input name: string、title: string、description: string、properties: object、requiredItems: readonly string[]
 * @returns toolの計算結果を返す。
 * @precondition 「name: string、title: string、description: string、properties: object、requiredItems: readonly string[]」がtoolの入力契約を満たす。
 * @postcondition toolの責務を完了した結果だけを返す。
 * @effect N/A: toolは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: toolは独自の失敗分岐を所有しない。
 * @invariant toolは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: toolはProcess内の同一Subsystemで完結する。
 * @security N/A: toolはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: toolは共有非同期状態を持たない同期処理である。
 */
function tool(
  name: string,
  title: string,
  description: string,
  properties: object,
  requiredItems: readonly string[],
) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...requiredItems]),
      properties: Object.freeze(properties),
    }),
  });
}

/**
 * Objective起動・判断提出・実行状態照会のMCP定義を組み立てる。
 * @responsibility 起動形態に応じてRepository指定を含め、実行操作の受付Schemaを公開する。
 * @trace ARCH-000012
 * @boundary MCPのツール一覧。定義の生成時に実行・認可は行わない。
 */
function getExecutionToolDefinitions(requireRepositoryId = false) {
  const id = Object.freeze({
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  });
  const rev = Object.freeze({ type: "string", pattern: "^[0-9a-f]{40,64}$" });
  const targetFields = requireRepositoryId ? { repositoryId: id } : {};
  const list = (maximum: number) =>
    Object.freeze({
      type: "array",
      minItems: 1,
      maxItems: maximum,
      items: Object.freeze({ type: "string" }),
    });
  const decisionBase = {
    ...targetFields,
    operation: { enum: ["request", "answer", "apply", "close"] },
    decisionId: id,
    projectId: id,
    milestoneId: id,
    generation: { type: "integer", minimum: 1 },
    repositoryRevision: rev,
  };
  const decisionVariants = {
    request: {
      blockerId: id,
      queueId: id,
      question: { type: "string", minLength: 1, maxLength: 8192 },
      allowedOptions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
        items: { enum: ["resume", "cancel"] },
      },
    },
    answer: {
      selectedOption: { enum: ["resume", "cancel"] },
      comment: { type: "string", maxLength: 1024 },
    },
    apply: {},
    close: {
      status: { enum: ["invalidated"] },
      reason: { type: "string", minLength: 1, maxLength: 1024 },
    },
  };
  return Object.freeze([
    tool(
      MCP_COORDINATOR_OBJECTIVE_TOOL,
      "CRDD Objectiveを実行",
      "検証済みProjectへObjectiveを登録し、Coordinatorで実行します。",
      {
        ...targetFields,
        operation: { type: "string", enum: ["start", "resume"] },
        plan: {
          type: "object",
          additionalProperties: false,
          required: ["milestoneAcceptanceCriteria", "objectives", "tasks"],
          properties: {
            milestoneAcceptanceCriteria: list(128),
            objectives: {
              type: "array",
              minItems: 1,
              maxItems: 128,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "acceptanceCriteria"],
                properties: { id, acceptanceCriteria: list(128) },
              },
            },
            tasks: {
              type: "array",
              minItems: 1,
              maxItems: 1024,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "id",
                  "objectiveId",
                  "dependencies",
                  "allowedPaths",
                  "conflictKeys",
                ],
                properties: {
                  id,
                  objectiveId: id,
                  dependencies: { ...list(128), minItems: 0 },
                  allowedPaths: list(128),
                  conflictKeys: { ...list(128), minItems: 0 },
                },
              },
            },
          },
        },
        taskInputs: {
          type: "array",
          minItems: 1,
          maxItems: 1024,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "taskId",
              "objective",
              "acceptanceCriteria",
              "readPaths",
            ],
            properties: {
              taskId: id,
              objective: { type: "string", minLength: 1, maxLength: 16_384 },
              acceptanceCriteria: list(128),
              readPaths: list(128),
            },
          },
        },
        requestId: id,
        projectId: id,
        milestoneId: id,
        repositoryRevision: rev,
        objective: Object.freeze({ type: "string", maxLength: 16_384 }),
        acceptanceCriteria: list(128),
        allowedPaths: list(128),
        readPaths: list(128),
        maximumConcurrency: Object.freeze({
          type: "integer",
          minimum: 1,
          maximum: 5,
        }),
        maximumReplans: Object.freeze({
          type: "integer",
          minimum: 0,
          maximum: 32,
        }),
        originLane: Object.freeze({
          enum: Object.freeze(["interactive", "scheduled"]),
        }),
        adoptResult: Object.freeze({ type: "boolean" }),
        workType: Object.freeze({
          type: "string",
          pattern: "^[a-z0-9][a-z0-9._-]*$",
        }),
        choice: Object.freeze({
          type: "object",
          additionalProperties: false,
          required: Object.freeze(["provider", "model", "effort"]),
          properties: Object.freeze({
            provider: Object.freeze({
              enum: Object.freeze(["codex", "claude"]),
            }),
            model: Object.freeze({
              type: "string",
              maxLength: 128,
              pattern: "^[a-z0-9][a-z0-9._-]{0,127}$",
            }),
            effort: Object.freeze({
              enum: Object.freeze(["low", "medium", "high", "xhigh", "max"]),
            }),
          }),
        }),
        workspaceId: Object.freeze({
          type: "string",
          pattern: "^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$",
        }),
      },
      [
        ...Object.keys(targetFields),
        ...[...objectiveKeys].filter(
          (key) =>
            key !== "workType" && key !== "choice" && key !== "workspaceId",
        ),
      ],
    ),
    Object.freeze({
      ...tool(
        MCP_COORDINATOR_DECISION_TOOL,
        "CRDDの判断を処理",
        "認証済みの同じ利用者が継続判断を要求・回答・明示適用・閉鎖します。回答だけでAIを再実行しません。",
        Object.assign({}, decisionBase, ...Object.values(decisionVariants)),
        Object.keys(decisionBase),
      ),
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        properties: Object.assign(
          {},
          decisionBase,
          ...Object.values(decisionVariants),
        ),
        required: Object.keys(decisionBase),
        oneOf: Object.entries(decisionVariants).map(
          ([operation, properties]) => ({
            type: "object",
            additionalProperties: false,
            properties: {
              ...decisionBase,
              operation: { const: operation },
              ...properties,
            },
            required: [
              ...Object.keys(decisionBase),
              ...Object.keys(properties).filter((key) => key !== "comment"),
            ],
          }),
        ),
      }),
    }),
    tool(
      MCP_COORDINATOR_STATE_TOOL,
      "CRDDのTask実行状態を取得",
      "Taskの実行状態を、Project Contextとは別の読取り専用投影として取得します。",
      {
        ...targetFields,
        requestId: id,
        projectId: id,
        repositoryRevision: rev,
      },
      [...Object.keys(targetFields), ...stateQueryKeys],
    ),
  ]);
}

export const GET_EXECUTION_DEFINITION_TOOL =
  "crdd.get_execution_definition" as const;
export const MANAGE_EXECUTION_DEFINITION_TOOL =
  "crdd.manage_execution_definition" as const;

/**
 * 当該RepositoryのCore操作を現在認可へ結ぶ。
 * @responsibility Host構成からだけRootと主体を渡す。
 * @trace ARCH-000013
 * @shape Repository IDと要求Signalからサーバーが認可した定義操作又はnull。
 * @invariant 要求間cache、JSONからのContext復元、暗黙実行なし。
 * @boundary Transport構成と内容認可Owner。
 * @security 拒否時は対象の存在を開示しない。
 * @compatibility 既存development権限だけを利用する。
 */
export type RuntimeContentAccessResolver = (
  repositoryId: string,
  signal: AbortSignal,
) => DefinitionAccess | null;

/**
 * 読取りと定義変更の固定Tool集合を返す。
 * @responsibility 一覧と実受付の操作名・必須fieldを一致させる。
 * @trace ARCH-000012
 * @input N/A: 固定した操作集合。
 * @returns 二つのToolと操作別の閉Schema。
 * @precondition 個別定義の意味検査はDomainが所有する。
 * @postcondition 承認・AI開始・Queue投入は一覧に含まない。
 * @effect N/A: 値構築だけ。
 * @failure N/A: 外部状態を参照しない。
 * @invariant CAS値を自動補完しない。
 * @boundary MCP Tool一覧とCore CRUD。
 * @security 任意Root・callback・資格入力なし。
 * @concurrency N/A: 共有可変状態なし。
 */
function getExecutionDefinitionToolDefinitions() {
  const id = { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" };
  const properties: Record<string, unknown> = {
    projectId: id,
    milestoneId: id,
    objectiveId: id,
    taskId: id,
    expectedAbsence: { const: true },
    expected: {
      type: "object",
      additionalProperties: false,
      required: ["revision", "payloadSha256"],
      properties: {
        revision: { type: "integer", minimum: 0 },
        payloadSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
    },
    expectedDefinitionHash: {
      anyOf: [{ type: "string", pattern: "^[a-f0-9]{64}$" }, { type: "null" }],
    },
    definition: {
      type: "object",
      description:
        "Domain定義。Plan/Objectives/Taskの閉形式・DAG・PathはDomainが検査します。",
    },
  };
  return (
    [
      [GET_EXECUTION_DEFINITION_TOOL, definitionReadFields],
      [MANAGE_EXECUTION_DEFINITION_TOOL, definitionWriteFields],
    ] as const
  ).map(([name, fields]) => ({
    name,
    title:
      name === GET_EXECUTION_DEFINITION_TOOL
        ? "実行依頼の定義を確認"
        : "実行依頼の定義を明示編集",
    description:
      "Coreの定義保存だけを行います。CRDD文書の更新、AI起動、承認、Queue投入は行いません。保存不明・競合時は自動再送しません。",
    annotations: {
      readOnlyHint: name === GET_EXECUTION_DEFINITION_TOOL,
      destructiveHint: name === MANAGE_EXECUTION_DEFINITION_TOOL,
      idempotentHint: false,
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["repositoryId", "command"],
      properties: {
        repositoryId: id,
        command: {
          oneOf: Object.entries(fields).map(([operation, extra]) => {
            const keys = ["projectId", "milestoneId", ...extra];
            return {
              type: "object",
              additionalProperties: false,
              required: ["operation", ...keys],
              properties: {
                operation: { const: operation },
                ...Object.fromEntries(
                  keys.map((key) => [
                    key,
                    key === "expectedDefinitionHash" &&
                    operation !== "plan.save"
                      ? { type: "string", pattern: "^[a-f0-9]{64}$" }
                      : properties[key],
                  ]),
                ),
              },
            };
          }),
        },
      },
    },
  }));
}

/**
 * 当該要求のCore定義操作を一度だけDomainへ渡す。
 * @responsibility Tool種別・入力閉集合・開始前取消を確認し、Owner結果を再解釈せず返す。
 * @trace ARCH-000008
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input raw、resolve、signal: 元Protocol要求と信頼した現在認可解決。
 * @returns Domainの型付き結果、又は非開示Protocol拒否。
 * @precondition ContextはHostが現在権限とRootへ結合する。
 * @postcondition 保存のunknownと回復参照、競合、不存在を維持する。
 * @effect 明示した一つの一般CRUD／Queryだけ。
 * @failure 入力不正は-32602、開始前取消は-32800、認可・構成不明は-32603。
 * @invariant 保存後の通信取消・応答喪失を未保存又はrollbackに変換しない。
 * @boundary MCP→現在内容認可→Domain共有Writer。
 * @security 生例外・Root・Token・内部Snapshotを公開しない。
 * @concurrency 同期保存をjoinして結果を返す。新Worker・再送を作らない。
 */
async function dispatchExecutionDefinitionTool(
  params: McpToolCall,
  resolve: RuntimeContentAccessResolver,
  signal: AbortSignal,
): Promise<McpResponse> {
  const args = readRequestRecord(
    params.arguments,
    new Set(["repositoryId", "command"]),
  );
  if (
    !args ||
    typeof args.repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(args.repositoryId)
  )
    return protocolError(params.id, -32602, "Invalid params");
  const mode =
    params.name === GET_EXECUTION_DEFINITION_TOOL
      ? "read"
      : params.name === MANAGE_EXECUTION_DEFINITION_TOOL
        ? "write"
        : null;
  const command =
    mode === null
      ? null
      : validateExecutionDefinitionCommand(args.command, mode);
  if (!command) return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  try {
    const access = resolve(args.repositoryId, signal);
    if (!access) throw new Error("runtime_content_access_unavailable");
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    const result = executeDefinitionOperation(access, command);
    return protocolComplete(params.id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch {
    return protocolError(
      params.id,
      -32603,
      "Runtime definition outcome unavailable",
    );
  }
}

/**
 * 要求内だけの現在Workspaceアクセス解決を定義する。
 * @responsibility Host指定をClientから受けずServerに限定する。
 * @trace ARCH-000013
 * @shape Root・Projectとfresh認可callback又は非開示null。
 * @invariant 次要求へ再利用しない。
 * @boundary 信頼したServer構成内部。
 * @security Root・関数はwireに載せない。
 * @compatibility AMの内容領域とGit Workspaceを分離する。
 */
export type WorkspaceAccessResolver = (repositoryId: string) => Readonly<{
  ownerRoot: string;
  projectId: string;
  authorize: () => boolean;
}> | null;

export const MCP_WORKSPACE_READ_TOOL = "crdd.get_workspace" as const;
export const MCP_WORKSPACE_MANAGE_TOOL = "crdd.manage_workspace" as const;

/**
 * Tool一覧の操作別閉Schemaを返す。
 * @responsibility 読取りと明示書込みをClientへ区別する。
 * @trace ARCH-000012
 * @input N/A: 固定契約。
 * @returns 二Toolの記述。
 * @precondition N/A: 外部状態なし。
 * @postcondition 任意Root・callback・参照解放申告はSchemaにない。
 * @effect N/A: 値構築。
 * @failure N/A: 外部処理なし。
 * @invariant 自動採用や自動再送を案内しない。
 * @boundary MCP Tool一覧。
 * @security SchemaはAuthorityを発行しない。
 * @concurrency N/A: 局所値。
 */
export function getWorkspaceToolDefinitions() {
  return [MCP_WORKSPACE_READ_TOOL, MCP_WORKSPACE_MANAGE_TOOL].map((name) => ({
    name,
    title:
      name === MCP_WORKSPACE_READ_TOOL
        ? "作業領域と変更を確認"
        : "作業領域を明示操作",
    description:
      "人間が指定した対象・内容だけを扱います。固定と採用は別操作です。Task完了から固定・採用・破棄を自動発行せず、失敗時も自動再送しません。",
    annotations: {
      readOnlyHint: name === MCP_WORKSPACE_READ_TOOL,
      destructiveHint: name === MCP_WORKSPACE_MANAGE_TOOL,
      idempotentHint: false,
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["repositoryId", "command"],
      properties: {
        repositoryId: {
          type: "string",
          pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
        },
        command: workspaceCommandSchema(name === MCP_WORKSPACE_READ_TOOL),
      },
    },
  }));
}

/**
 * 操作ごとの必須fieldを閉じたSchemaへ写す。
 * @responsibility 任意JSON操作を公開しない。
 * @trace ARCH-000012
 * @input readOnly: 読取りToolか。
 * @returns 操作ごとのoneOf。
 * @precondition 固定Tool集合のみ。
 * @postcondition 実値はOwnerの共通検査でも確認する。
 * @effect N/A: 値構築。
 * @failure N/A: 外部状態なし。
 * @invariant commandは任意Shellではない。
 * @boundary MCP Schema。
 * @security 既知fieldだけを受ける。
 * @concurrency N/A: 局所値。
 */
function workspaceCommandSchema(readOnly: boolean) {
  const actions: Record<string, string[]> = readOnly
    ? {
        list: ["cursor", "limit"],
        get: [],
        inspect: ["path"],
        "candidate-diff": ["path"],
      }
    : {
        create: [
          "baseBranch",
          "baseCommit",
          "name",
          "acceptUncommittedChangesExcluded",
        ],
        select: [],
        rename: ["name"],
        hold: ["until"],
        discard: ["expectedHead", "discardChanges"],
        freeze: [
          "operationId",
          "baseCommit",
          "expectedHead",
          "selection",
          "candidateName",
          "relatedChangeIds",
        ],
        adopt: ["candidateCommit", "targetBranch", "expectedTargetHead"],
        "close-candidate": ["expectedCommit", "disposition"],
      };
  return {
    oneOf: Object.entries(actions).map(([operation, extra]) => {
      const keys = [
        "operation",
        "projectId",
        ...(operation === "list" ? [] : ["queueId", "workspaceId"]),
        ...(!readOnly ? ["expectedGeneration"] : []),
        ...extra,
      ];
      const properties = Object.fromEntries(
        keys.map((key) => [
          key,
          key === "operation"
            ? { const: operation }
            : key === "expectedGeneration"
              ? { type: "integer", minimum: 0 }
              : key === "limit"
                ? { type: "integer", minimum: 1, maximum: 50 }
                : key === "acceptUncommittedChangesExcluded"
                  ? {
                      type: "boolean",
                      description:
                        "未コミット変更は引き継がれないことを利用者が了承した場合だけtrue。変更があり未了承ならworkspace_creation_confirmation_requiredで作成前に停止します。",
                    }
                  : key === "discardChanges"
                    ? { type: "boolean" }
                    : key === "relatedChangeIds"
                      ? {
                          type: "array",
                          maxItems: 20,
                          items: { type: "string", pattern: "^CHG-[0-9]{6}$" },
                        }
                      : key === "selection"
                        ? {
                            type: "array",
                            minItems: 1,
                            maxItems: 1000,
                            items: {
                              type: "object",
                              additionalProperties: false,
                              required: ["path", "blobId", "mode"],
                              properties: {
                                path: { type: "string" },
                                blobId: {
                                  anyOf: [{ type: "string" }, { type: "null" }],
                                },
                                mode: { enum: ["100644", "100755", null] },
                              },
                            },
                          }
                        : [
                              "cursor",
                              "name",
                              "until",
                              "candidateName",
                              "expectedCommit",
                            ].includes(key)
                          ? { anyOf: [{ type: "string" }, { type: "null" }] }
                          : { type: "string" },
        ]),
      );
      return {
        type: "object",
        additionalProperties: false,
        required: keys.filter(
          (key) => key !== "acceptUncommittedChangesExcluded",
        ),
        properties,
      };
    }),
  };
}

/**
 * 閉入力を現在のRepository解決後に一回実行する。
 * @responsibility 入力不正・非許可・Owner故障・取消を混同しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input MCP要求、要求専用Resolver、Signal。
 * @returns MCP構造化結果又は固定エラー。
 * @precondition ResolverはServer構成が所有する。
 * @postcondition 待機後の取消・現在許可もOwnerが確認する。
 * @effect 明示されたOwner操作だけ。
 * @failure 不正は-32602、非開示拒否・Owner不明は-32603、開始前取消は-32800。
 * @invariant 発行後エラーをEffect 0へ補完しない。
 * @boundary MCP→Coordinator。
 * @security 生例外・Root・内部Snapshotを返さない。
 * @concurrency 同期Owner終了後に応答し自動再送しない。
 */
export async function handleMcpWorkspaceRequest(
  raw: unknown,
  resolve: WorkspaceAccessResolver,
  signal: AbortSignal,
) {
  const call = readDirectToolCall(raw);
  if ("jsonrpc" in call) return call;
  return dispatchWorkspaceTool(call, resolve, signal);
}

async function dispatchWorkspaceTool(
  params: McpToolCall,
  resolve: WorkspaceAccessResolver,
  signal: AbortSignal,
): Promise<McpResponse> {
  const args = readRequestRecord(
    params.arguments,
    new Set(["repositoryId", "command"]),
  );
  if (
    !args ||
    typeof args.repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(args.repositoryId) ||
    ![MCP_WORKSPACE_READ_TOOL, MCP_WORKSPACE_MANAGE_TOOL].includes(
      params.name as never,
    )
  )
    return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const input = readRequestRecord(args.command);
  if (!input) return protocolError(params.id, -32602, "Invalid params");
  const repositoryId = args.repositoryId;
  const captured: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "selection" || key === "relatedChangeIds") {
      if (!Array.isArray(value))
        return protocolError(params.id, -32602, "Invalid params");
      const values: unknown[] = [];
      for (const item of value) {
        if (key === "relatedChangeIds") {
          if (typeof item !== "string")
            return protocolError(params.id, -32602, "Invalid params");
          values.push(item);
        } else {
          const row = readRequestRecord(
            item,
            new Set(["path", "blobId", "mode"]),
          );
          if (
            !row ||
            Object.values(row).some(
              (entry) => entry !== null && typeof entry !== "string",
            )
          )
            return protocolError(params.id, -32602, "Invalid params");
          const { path, blobId, mode } = row;
          values.push({ path, blobId, mode });
        }
      }
      Object.defineProperty(captured, key, {
        value: Object.freeze(values),
        enumerable: true,
      });
    } else {
      if (
        value !== null &&
        !["string", "number", "boolean"].includes(typeof value)
      )
        return protocolError(params.id, -32602, "Invalid params");
      Object.defineProperty(captured, key, { value, enumerable: true });
    }
  }
  Object.freeze(captured);
  let prepared: Awaited<ReturnType<typeof prepareWorkspaceOperation>>;
  try {
    prepared = await prepareWorkspaceOperation(captured, signal);
  } catch {
    return signal.aborted
      ? protocolError(params.id, -32800, "Request cancelled")
      : protocolError(params.id, -32603, "Workspace outcome unavailable");
  }
  try {
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (
      !prepared ||
      ["list", "get", "inspect", "candidate-diff"].includes(
        prepared.command.operation,
      ) !==
        (params.name === MCP_WORKSPACE_READ_TOOL)
    )
      return protocolError(params.id, -32602, "Invalid params");
    const { command, executeWorkspace } = prepared;
    const access = resolve(repositoryId);
    if (!access) throw new Error("workspace_access_unavailable");
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (!access.authorize()) throw new Error("workspace_access_unavailable");
    const result = executeWorkspace(
      access.ownerRoot,
      access.projectId,
      command,
      access.authorize,
      signal,
    );
    if (signal.aborted)
      return protocolError(params.id, -32603, "Workspace outcome unavailable");
    return protocolComplete(params.id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch {
    return protocolError(params.id, -32603, "Workspace outcome unavailable");
  }
}

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
  const call = readDirectToolCall(rawRequest, true);
  if ("jsonrpc" in call) return call;
  if (
    call.name !== MCP_PROJECT_CONTEXT_LIST_TOOL &&
    call.name !== MCP_PROJECT_CONTEXT_GET_TOOL
  )
    return protocolError(call.id, -32602, "Invalid params");
  return dispatchProjectTool(call, dependencies, signal);
}

async function dispatchProjectTool(
  params: McpToolCall,
  dependencies: McpProjectContextDependencies,
  signal: AbortSignal,
): Promise<McpResponse> {
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
    return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const requestedProjectId = args.projectId;
  let portfolio: PortfolioProjection;
  try {
    portfolio = await dependencies.readPortfolio();
  } catch {
    return protocolError(params.id, -32603, "Project Context unavailable");
  }
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  if (params.name === MCP_PROJECT_CONTEXT_LIST_TOOL)
    return protocolComplete(params.id, {
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
    ({ projectId }) => projectId === requestedProjectId,
  );
  if (!project)
    return protocolComplete(params.id, {
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
  return protocolComplete(params.id, {
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

export const MCP_PROJECT_CONTEXT_LIST_TOOL = "crdd.list_projects" as const;
export const MCP_PROJECT_CONTEXT_GET_TOOL = "crdd.get_project_context" as const;

/**
 * Project Context Tool Definitionsを取得する。
 *
 * @responsibility Project Contextの一覧・取得入力を固定Schemaとして公開する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns Project Context用MCP Tool記述を返す。
 * @precondition N/A: 固定契約だけを使用する。
 * @postcondition 一覧と取得の二Toolを固定順で返す。
 * @effect N/A: 入力、FilesystemまたはNetworkを変更しない。
 * @failure N/A: 固定値の構築に独自の失敗分岐を持たない。
 * @invariant Coordinator状態ToolとProject Context Toolを同一名にしない。
 * @boundary MCP Clientへ公開するTool Schema境界。
 * @security Project ID以外のRepository IdentityやAuthority入力を要求しない。
 * @concurrency N/A: 同期的な純粋構築である。
 */
export function getProjectToolDefinitions() {
  const projectId = Object.freeze({
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  });
  return Object.freeze([
    Object.freeze({
      name: MCP_PROJECT_CONTEXT_LIST_TOOL,
      title: "参照できるProjectの一覧を取得",
      description:
        "現在の接続から参照できるProject Contextだけを一覧として取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze([]),
        properties: Object.freeze({}),
      }),
    }),
    Object.freeze({
      name: MCP_PROJECT_CONTEXT_GET_TOOL,
      title: "Project Contextを取得",
      description:
        "指定Projectの五場面とSource Coverageを、保存済み投影から取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze(["projectId"]),
        properties: Object.freeze({ projectId }),
      }),
    }),
  ]);
}

export const EXECUTION_ACTIVITY_TOOL = "crdd.get_execution_activity" as const;

/**
 * 認可適用済みの活動読取り依存を定義する。
 *
 * @responsibility MCPがRepository探索と認可を再実装しない読取り境界を固定する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape readはProjectとページから観測または非開示nullを返す。
 * @invariant Reader完了を待ち、nullとunknownを混同しない。
 * @boundary MCP入力とCoordinator活動Ownerの境界。
 * @security 許可集合外のRepositoryを参照しない依存だけを渡す。
 * @compatibility Coordinatorの観測型を直接利用し、同型DTOを作らない。
 */
export type ExecutionActivityReader = Readonly<{
  read(
    query: Readonly<{ projectId: string; cursor?: string; limit: number }>,
  ): Promise<ExecutionActivityObservation | null>;
}>;

/**
 * 実行状況と履歴を取得するToolの固定Schemaを返す。
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
export function getExecutionActivityToolDefinitions() {
  return Object.freeze([
    Object.freeze({
      name: EXECUTION_ACTIVITY_TOOL,
      title: "実行状況と履歴を取得",
      description:
        "現在参照可能なProjectの保存済み実行状況とページ単位の履歴を取得します。改訂と次の手順は保存済み状態の情報であり、現在の実行許可ではありません。",
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
 * @postcondition 正常応答は要求Projectと一致するCoordinator観測型だけを持つ。
 * @effect 有効入力でreadを最大一回呼ぶ。
 * @failure 入力不正は-32602、読取り故障は-32603、取消は-32800。
 * @invariant 非許可と不在を区別せず、unknownを成功空集合へ変えない。
 * @boundary MCP搬送とCoordinator活動観測の境界。
 * @security Token・Path・内部Snapshotを応答へ追加しない。
 * @concurrency 開始後のreadをjoinし、完了後に取消状態を再確認する。
 */
export async function handleExecutionActivityTool(
  rawRequest: unknown,
  dependencies: ExecutionActivityReader,
  signal: AbortSignal,
): Promise<McpResponse> {
  const call = readDirectToolCall(rawRequest);
  if ("jsonrpc" in call) return call;
  if (call.name !== EXECUTION_ACTIVITY_TOOL)
    return protocolError(call.id, -32602, "Invalid params");
  return dispatchActivityTool(call, dependencies, signal);
}

async function dispatchActivityTool(
  params: McpToolCall,
  dependencies: ExecutionActivityReader,
  signal: AbortSignal,
): Promise<McpResponse> {
  const args = readRequestRecord(params.arguments);
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
    return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const requestedProjectId = args.projectId;
  const input = {
    projectId: requestedProjectId,
    ...(typeof args.cursor === "string" ? { cursor: args.cursor } : {}),
    limit: typeof args.limit === "number" ? args.limit : 20,
  };
  let observation: ExecutionActivityObservation | null;
  let ownedObservation: ExecutionActivityObservation | null;
  try {
    const { parseExecutionActivityObservation } = await import(
      "../../../coordinator/src/index.ts"
    );
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    observation = await dependencies.read(input);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    ownedObservation =
      observation === null
        ? null
        : parseExecutionActivityObservation(observation);
  } catch {
    return signal.aborted
      ? protocolError(params.id, -32800, "Request cancelled")
      : protocolError(params.id, -32603, "Runtime activity unavailable");
  }
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  if (
    observation !== null &&
    (ownedObservation === null ||
      ownedObservation.projectId !== requestedProjectId)
  )
    return protocolError(params.id, -32603, "Runtime activity unavailable");
  return protocolComplete(params.id, {
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

/**
 * Repository Identityから許可済みTopic／Meeting Applicationを解決するPort。
 *
 * @responsibility Remote Requestの明示Targetを現在SessionのContent AccessとRepository Bindingへ接続する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @shape repositoryIdを受け、許可済みApplicationまたは非開示拒否のnullを返す。
 * @invariant ID提示だけでApplicationを返さない。
 * @boundary MCP Topic／Meeting AdapterとCROS Repository Resolverの境界。
 * @security Grant外、Exposure外、改訂不一致および未登録を同じnullへ閉じる。
 * @compatibility ResolverはRequestごとの現在Snapshotへ固定できる。
 */
type TopicMeetingAccessResolver = (
  repositoryId: string,
) => TopicMeetingAccess | null;

/**
 * CROS Tool Callの明示Repositoryを解決し、Repository単体契約へ縮約する。
 *
 * @responsibility Target Keyを除いた共通入力の完全検査・取消確認後だけ現在Repositoryを解決する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input rawRequest: Remote MCP要求、resolveTopicMeetingAccess: 要求専用の遅延Resolver、signal: 取消Signal。
 * @returns 共通Topic／Meeting Adapterの応答、または非開示Protocol Error。
 * @precondition Resolverは現在Credential、Workspace、ExposureおよびRepository Revisionを同じSnapshotで検証する。
 * @postcondition 不正入力と開始前取消はResolver 0回、正常入力は一回だけ解決し操作前に取消を再確認する。
 * @effect 許可済みApplicationが発行する一操作だけを許容する。
 * @failure Target欠落、不正、Grant外またはBinding不在を同じInvalid paramsへ閉じる。
 * @invariant Repository Identityを暗黙選択または別RepositoryへFallbackしない。
 * @boundary Remote CROS MCP→Repository Access Resolver→Project Operation Application。
 * @security 拒否結果へRepositoryの存在、Role、WorkspaceまたはBindingを含めない。
 * @concurrency 一Requestで解決したApplicationだけを同じCallに使用する。
 */
async function dispatchRoutedTopicMeetingCall(
  call: McpToolCall,
  resolveTopicMeetingAccess: TopicMeetingAccessResolver,
  signal: AbortSignal,
): Promise<McpResponse> {
  const args = plain(call.arguments) ? call.arguments : null;
  if (
    !args ||
    typeof args.repositoryId !== "string" ||
    args.repositoryId.length === 0 ||
    args.repositoryId.length > 128
  )
    return protocolError(call.id, -32602, "Invalid params");
  const repositoryId = args.repositoryId;
  const { repositoryId: ignoredRepositoryId, ...localArguments } = args;
  return dispatchTopicMeetingCall(
    Object.freeze({
      ...call,
      arguments: Object.freeze(localArguments),
    }),
    () => resolveTopicMeetingAccess(repositoryId),
    signal,
  );
}

/**
 * Topic／Meeting MCP Adapter境界におけるplainの処理境界を固定する。
 *
 * @responsibility Topic／Meeting MCP Adapter境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000005
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function plain(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
}

/**
 * Topic／Meeting MCP Adapter境界におけるexactKeysの処理境界を固定する。
 *
 * @responsibility Topic／Meeting MCP Adapter境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000005
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function exactKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  return (
    requiredKeys.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

/**
 * Topic／Meeting Tool Callを検証し、共通Applicationへ一回だけ渡す。
 *
 * @responsibility MCP Envelope、Tool名、引数Schemaおよび取消を検証して対応Application操作へ限定配送する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼MCP要求、access: 許可済み操作または要求内の遅延Resolver、signal: 取消Signal。
 * @returns MCP Protocolの完了またはError応答。
 * @precondition accessは許可済み操作、または現在要求だけで解決するResolverである。
 * @postcondition 一つのTool Callを高々一つのApplication操作へ渡す。
 * @effect Create、Update、Delete、Promote、Outcome処置だけが対応Toolで発行され得る。
 * @failure Envelope、Tool名、引数、取消またはApplication失敗をProtocol Errorへ閉じる。
 * @invariant Tool間Fallbackと暗黙Repository選択を行わない。
 * @boundary MCP Tool CallとProject Operation Applicationの境界。
 * @security 追加Property、未許可Targetおよび未検証Markdownを受理しない。
 * @concurrency 一CallのsignalとApplication Promiseを同じLifecycleで扱う。
 */
export async function handleMcpTopicMeetingRequest(
  rawRequest: unknown,
  access: TopicMeetingAccess | (() => TopicMeetingAccess | null),
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const call = readDirectToolCall(rawRequest, true);
  if ("jsonrpc" in call) return call;
  return dispatchTopicMeetingCall(call, access, signal);
}

/** 単体・共有の正規呼出しを、JSON-RPCの再構築なしで同じTool処理へ渡す。 @trace ARCH-000012 */
async function dispatchTopicMeetingCall(
  params: McpToolCall,
  access: TopicMeetingAccess | (() => TopicMeetingAccess | null),
  signal: AbortSignal,
): Promise<McpResponse> {
  if (
    !MCP_TOPIC_MEETING_TOOLS.includes(params.name as never) ||
    !plain(params.arguments)
  )
    return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const args = params.arguments;
  const kind = params.name.includes("meeting") ? "meeting" : "topic";
  const recordId = args.id ?? args.topicId ?? args.meetingId;
  if (
    (recordId !== undefined &&
      (typeof recordId !== "string" ||
        !new RegExp(
          kind === "topic" ? "^TOPIC-\\d{6}$" : "^MTG-\\d{6}$",
          "u",
        ).test(recordId))) ||
    (args.expectedRevision !== undefined &&
      (!Number.isSafeInteger(args.expectedRevision) ||
        (args.expectedRevision as number) < 1))
  )
    return protocolError(params.id, -32602, "Invalid params");
  if (
    (params.name === MCP_TOPIC_PROMOTE_TOOL &&
      (typeof args.changeId !== "string" ||
        !/^CHG-\d{6}$/u.test(args.changeId))) ||
    (params.name === MCP_MEETING_TREAT_OUTCOME_TOOL &&
      ((args.targetKind === "topic" &&
        (typeof args.targetReference !== "string" ||
          !/^TOPIC-\d{6}$/u.test(args.targetReference))) ||
        (args.targetKind === "change" &&
          (typeof args.targetReference !== "string" ||
            !/^CHG-\d{6}$/u.test(args.targetReference)))))
  )
    return protocolError(params.id, -32602, "Invalid params");
  let accessResolved = false;
  try {
    if (params.name === MCP_TOPIC_PROMOTE_TOOL) {
      const required = [
        "topicId",
        "expectedRevision",
        "changeId",
        "reason",
        "remainingResponsibility",
      ] as const;
      if (
        !exactKeys(args, required) ||
        !Number.isSafeInteger(args.expectedRevision) ||
        !required
          .filter((key) => key !== "expectedRevision")
          .every((key) => typeof args[key] === "string")
      )
        return protocolError(params.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(params.id, -32602, "Invalid params");
      const result = executeTopicAction(application.topic, {
        operation: "promote",
        input: {
          topicId: args.topicId as string,
          expectedRevision: args.expectedRevision as number,
          changeId: args.changeId as string,
          reason: args.reason as string,
          remainingResponsibility: args.remainingResponsibility as string,
        },
      });
      return protocolComplete(params.id, {
        content: Object.freeze([{ type: "text", text: result.reason }]),
        structuredContent: result,
        isError: result.status !== "completed",
      });
    }
    if (params.name === MCP_MEETING_TREAT_OUTCOME_TOOL) {
      const required = [
        "meetingId",
        "expectedRevision",
        "outcomeId",
        "disposition",
        "owner",
        "reviewTrigger",
        "targetKind",
        "targetReference",
        "treatment",
        "completionCondition",
        "result",
        "closeMeeting",
      ] as const;
      if (
        !exactKeys(args, required) ||
        !Number.isSafeInteger(args.expectedRevision) ||
        typeof args.closeMeeting !== "boolean" ||
        !required
          .filter((key) => key !== "expectedRevision" && key !== "closeMeeting")
          .every((key) => typeof args[key] === "string") ||
        !["completed", "transferred", "promoted", "rejected"].includes(
          args.disposition as string,
        ) ||
        !["topic", "change", "owner", "none"].includes(
          args.targetKind as string,
        )
      )
        return protocolError(params.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(params.id, -32602, "Invalid params");
      const result = executeMeetingAction(application.meeting, {
        operation: "treat-outcome",
        input: {
          meetingId: args.meetingId as string,
          expectedRevision: args.expectedRevision as number,
          outcomeId: args.outcomeId as string,
          disposition: args.disposition as
            | "completed"
            | "transferred"
            | "promoted"
            | "rejected",
          owner: args.owner as string,
          reviewTrigger: args.reviewTrigger as string,
          target: {
            kind: args.targetKind as "topic" | "change" | "owner" | "none",
            reference: args.targetReference as string,
          },
          treatment: args.treatment as string,
          completionCondition: args.completionCondition as string,
          result: args.result as string,
          closeMeeting: args.closeMeeting,
        },
      });
      return protocolComplete(params.id, {
        content: Object.freeze([{ type: "text", text: result.reason }]),
        structuredContent: result,
        isError: result.status !== "completed",
      });
    }
    if (
      [MCP_TOPIC_LIST_TOOL, MCP_MEETING_LIST_TOOL].includes(
        params.name as never,
      )
    ) {
      if (
        !exactKeys(
          args,
          [],
          [
            "cursor",
            "limit",
            "query",
            "states",
            "owner",
            "relation",
            "occurredFrom",
            "occurredTo",
            "pendingOnly",
            "sort",
          ],
        )
      )
        return protocolError(params.id, -32602, "Invalid params");
      if (args.cursor !== undefined && typeof args.cursor !== "string")
        return protocolError(params.id, -32602, "Invalid params");
      if (
        args.limit !== undefined &&
        (typeof args.limit !== "number" ||
          !Number.isSafeInteger(args.limit) ||
          (args.limit as number) < 1 ||
          (args.limit as number) > 100)
      )
        return protocolError(params.id, -32602, "Invalid params");
      if (
        [
          "query",
          "owner",
          "relation",
          "occurredFrom",
          "occurredTo",
          "sort",
        ].some(
          (key) => args[key] !== undefined && typeof args[key] !== "string",
        ) ||
        (args.states !== undefined &&
          (!Array.isArray(args.states) ||
            args.states.length > 4 ||
            !args.states.every((state) => typeof state === "string"))) ||
        (args.pendingOnly !== undefined &&
          typeof args.pendingOnly !== "boolean")
      )
        return protocolError(params.id, -32602, "Invalid params");
      const query = {
        ...(args.query === undefined ? {} : { query: args.query as string }),
        ...(args.states === undefined
          ? {}
          : { states: args.states as readonly string[] }),
        ...(args.owner === undefined ? {} : { owner: args.owner as string }),
        ...(args.relation === undefined
          ? {}
          : { relation: args.relation as string }),
        ...(args.occurredFrom === undefined
          ? {}
          : { occurredFrom: args.occurredFrom as string }),
        ...(args.occurredTo === undefined
          ? {}
          : { occurredTo: args.occurredTo as string }),
        ...(args.pendingOnly === undefined
          ? {}
          : { pendingOnly: args.pendingOnly as boolean }),
        ...(args.sort === undefined ? {} : { sort: args.sort as never }),
      };
      const listInput = {
        ...(args.cursor === undefined ? {} : { cursor: args.cursor as string }),
        ...(args.limit === undefined ? {} : { limit: args.limit as number }),
        ...(Object.keys(query).length === 0 ? {} : { query }),
      };

      const result = readTopicMeetingList(
        { kind, ...listInput },
        () => {
          const application = typeof access === "function" ? access() : access;
          accessResolved = true;
          return application;
        },
        signal,
      );
      if (result.status === "cancelled")
        return protocolError(params.id, -32800, "Request cancelled");
      if (result.status !== "complete")
        return protocolError(params.id, -32602, "Invalid params");
      const page = result.page;
      return protocolComplete(params.id, {
        content: Object.freeze([
          { type: "text", text: `${page.records.length}件を取得しました。` },
        ]),
        structuredContent: page,
        isError: false,
      });
    }
    if (
      [MCP_TOPIC_GET_TOOL, MCP_MEETING_GET_TOOL].includes(params.name as never)
    ) {
      if (!exactKeys(args, ["id"]) || typeof args.id !== "string")
        return protocolError(params.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(params.id, -32602, "Invalid params");
      const document = application[kind].getDocument(args.id);
      const record = document?.record ?? null;
      const relations =
        record === null
          ? Object.freeze([])
          : application[kind].relations(args.id);
      return protocolComplete(params.id, {
        content: Object.freeze([
          {
            type: "text",
            text: record
              ? `${args.id}を取得しました。`
              : `${args.id}は見つかりません。`,
          },
        ]),
        structuredContent: Object.freeze({
          status: record ? "completed" : "not_found",
          record,
          markdown: document?.markdown ?? null,
          relations,
        }),
        isError: record === null,
      });
    }
    const create =
      params.name === MCP_TOPIC_CREATE_TOOL ||
      params.name === MCP_MEETING_CREATE_TOOL;
    const update =
      params.name === MCP_TOPIC_UPDATE_TOOL ||
      params.name === MCP_MEETING_UPDATE_TOOL;
    if (create || update) {
      const { id, expectedRevision, markdown } = args;
      const existing =
        update &&
        typeof id === "string" &&
        typeof expectedRevision === "number" &&
        Number.isSafeInteger(expectedRevision)
          ? { id, expectedRevision }
          : null;
      if (
        typeof markdown !== "string" ||
        (create
          ? !exactKeys(args, ["markdown"])
          : !existing ||
            !exactKeys(args, ["id", "expectedRevision", "markdown"]))
      )
        return protocolError(params.id, -32602, "Invalid params");
      try {
        if (kind === "topic") parseTopicMarkdown(markdown);
        else parseMeetingMarkdown(markdown);
      } catch {
        return protocolError(params.id, -32602, "Invalid params");
      }
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(params.id, -32602, "Invalid params");
      const write: RecordWriteCommand = existing
        ? { operation: "update", input: { ...existing, markdown } }
        : { operation: "create", input: markdown };
      const result =
        kind === "topic"
          ? executeTopicAction(application.topic, write)
          : executeMeetingAction(application.meeting, write);
      return protocolComplete(params.id, {
        content: Object.freeze([{ type: "text", text: result.reason }]),
        structuredContent: result,
        isError: result.status !== "completed",
      });
    }
    if (
      [MCP_TOPIC_DELETE_TOOL, MCP_MEETING_DELETE_TOOL].includes(
        params.name as never,
      )
    ) {
      if (
        !exactKeys(args, ["id", "expectedRevision", "confirmed", "reason"]) ||
        typeof args.id !== "string" ||
        !Number.isSafeInteger(args.expectedRevision) ||
        typeof args.confirmed !== "boolean" ||
        args.reason !== "mistaken_registration"
      )
        return protocolError(params.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(params.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(params.id, -32602, "Invalid params");
      const write: RecordWriteCommand = {
        operation: "delete",
        input: {
          id: args.id,
          expectedRevision: args.expectedRevision as number,
          confirmed: args.confirmed,
          reason: "mistaken_registration",
        },
      };
      const result =
        kind === "topic"
          ? executeTopicAction(application.topic, write)
          : executeMeetingAction(application.meeting, write);
      return protocolComplete(params.id, {
        content: Object.freeze([{ type: "text", text: result.reason }]),
        structuredContent: result,
        isError: result.status !== "completed",
      });
    }
  } catch (error) {
    if (
      accessResolved &&
      [MCP_TOPIC_LIST_TOOL, MCP_MEETING_LIST_TOOL].includes(
        params.name as never,
      ) &&
      error instanceof Error &&
      [
        "project_operation_list_limit_invalid",
        "project_operation_list_query_invalid",
        "project_operation_list_cursor_invalid",
      ].includes(error.message)
    )
      return protocolError(params.id, -32602, "Invalid params");
    return protocolError(params.id, -32603, "Internal error");
  }
  return protocolError(params.id, -32601, "Method not found");
}

export const MCP_TOPIC_LIST_TOOL = "crdd.list_topics" as const;
export const MCP_TOPIC_GET_TOOL = "crdd.get_topic" as const;
export const MCP_TOPIC_CREATE_TOOL = "crdd.create_topic" as const;
export const MCP_TOPIC_UPDATE_TOOL = "crdd.update_topic" as const;
export const MCP_TOPIC_DELETE_TOOL = "crdd.delete_topic" as const;
export const MCP_TOPIC_PROMOTE_TOOL = "crdd.promote_topic" as const;
export const MCP_MEETING_LIST_TOOL = "crdd.list_meetings" as const;
export const MCP_MEETING_GET_TOOL = "crdd.get_meeting" as const;
export const MCP_MEETING_CREATE_TOOL = "crdd.create_meeting" as const;
export const MCP_MEETING_UPDATE_TOOL = "crdd.update_meeting" as const;
export const MCP_MEETING_DELETE_TOOL = "crdd.delete_meeting" as const;
export const MCP_MEETING_TREAT_OUTCOME_TOOL =
  "crdd.treat_meeting_outcome" as const;

export const MCP_TOPIC_MEETING_TOOLS = Object.freeze([
  MCP_TOPIC_LIST_TOOL,
  MCP_TOPIC_GET_TOOL,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_UPDATE_TOOL,
  MCP_TOPIC_DELETE_TOOL,
  MCP_TOPIC_PROMOTE_TOOL,
  MCP_MEETING_LIST_TOOL,
  MCP_MEETING_GET_TOOL,
  MCP_MEETING_CREATE_TOOL,
  MCP_MEETING_UPDATE_TOOL,
  MCP_MEETING_DELETE_TOOL,
  MCP_MEETING_TREAT_OUTCOME_TOOL,
]);

const TEXT_SCHEMA = Object.freeze({ type: "string" });
const TOPIC_ID_SCHEMA = Object.freeze({
  type: "string",
  pattern: "^TOPIC-\\d{6}$",
});
const MEETING_ID_SCHEMA = Object.freeze({
  type: "string",
  pattern: "^MTG-\\d{6}$",
});
const POSITIVE_INTEGER_SCHEMA = Object.freeze({ type: "integer", minimum: 1 });

/**
 * Topic／Meeting MCP Protocol境界におけるtoolの処理境界を固定する。
 *
 * @responsibility Topic／Meeting MCP Protocol境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000005
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function defineTopicMeetingTool(
  name: (typeof MCP_TOPIC_MEETING_TOOLS)[number],
  title: string,
  description: string,
  requiredKeys: readonly string[],
  properties: Readonly<Record<string, unknown>>,
  constraints: Readonly<Record<string, unknown>> = {},
) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: Object.freeze({
      ...constraints,
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...requiredKeys]),
      properties: Object.freeze(properties),
    }),
  });
}

/**
 * Topic／Meeting CRUD Tool Definitionsを固定順で返す。
 *
 * @responsibility Repository単体の暗黙TargetとRemote CROSの明示Targetを同じTool意味のSchema差として生成する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input repositoryTarget: Repository対象を入口で暗黙化するか、各Callで必須にするかを指定する。
 * @returns 固定順のTopic／Meeting Tool Definition集合。
 * @precondition requiredはCROS側がRequestごとにExposureを再検証する場合だけ使用する。
 * @postcondition required時は全ToolのrequiredとpropertiesへrepositoryIdを一回だけ追加する。
 * @effect N/A: 不変Schema Objectを生成するだけである。
 * @failure N/A: 閉じた列挙値だけを受け取る。
 * @invariant Tool名とTopic／Meeting操作意味をTarget方式で変更しない。
 * @boundary MCP Tool DiscoveryとRepository Routing Adapterの境界。
 * @security 明示Repository IDだけでContent Accessを許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function getTopicMeetingToolDefinitions(
  repositoryTarget: "implicit" | "required" = "implicit",
) {
  const target =
    repositoryTarget === "required"
      ? Object.freeze({ repositoryId: TEXT_SCHEMA })
      : Object.freeze({});
  /**
   * Target方式に応じたrequired Key集合を生成する。
   *
   * @responsibility Remote CROS時だけrepositoryIdを各Toolの必須入力へ追加する。
   * @trace ARCH-000005
   * @trace ARCH-000013
   * @input keys: Repository単体Toolが本来要求するKey集合。
   * @returns Target方式を反映した重複のないKey集合。
   * @precondition keysは各Tool固有の固定Keyである。
   * @postcondition 入力順を維持し、Remote時はrepositoryIdを先頭に置く。
   * @effect N/A: 配列を生成するだけである。
   * @failure N/A: 閉じた文字列配列だけを扱う。
   * @invariant Repository単体時のrequired集合を変更しない。
   * @boundary N/A: Tool Schema生成内部で完結する。
   * @security repositoryIdをAuthorityとして扱わない。
   * @concurrency N/A: 共有状態を持たない同期処理である。
   */
  const required = (keys: readonly string[]) =>
    repositoryTarget === "required"
      ? Object.freeze(["repositoryId", ...keys])
      : Object.freeze([...keys]);
  const page = Object.freeze({
    ...target,
    cursor: TEXT_SCHEMA,
    limit: Object.freeze({ type: "integer", minimum: 1, maximum: 100 }),
    query: TEXT_SCHEMA,
    states: Object.freeze({
      type: "array",
      maxItems: 4,
      items: TEXT_SCHEMA,
    }),
    owner: TEXT_SCHEMA,
    relation: TEXT_SCHEMA,
    occurredFrom: TEXT_SCHEMA,
    occurredTo: TEXT_SCHEMA,
    pendingOnly: Object.freeze({ type: "boolean" }),
    sort: TEXT_SCHEMA,
  });
  const record = Object.freeze({ ...target, id: TEXT_SCHEMA });
  const create = Object.freeze({ ...target, markdown: TEXT_SCHEMA });
  const update = Object.freeze({
    ...target,
    id: TEXT_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    markdown: TEXT_SCHEMA,
  });
  const remove = Object.freeze({
    ...target,
    id: TEXT_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    confirmed: Object.freeze({ type: "boolean" }),
    reason: Object.freeze({ type: "string", const: "mistaken_registration" }),
  });
  const treatOutcome = Object.freeze({
    ...target,
    meetingId: MEETING_ID_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    outcomeId: TEXT_SCHEMA,
    disposition: Object.freeze({
      type: "string",
      enum: Object.freeze(["completed", "transferred", "promoted", "rejected"]),
    }),
    owner: TEXT_SCHEMA,
    reviewTrigger: TEXT_SCHEMA,
    targetKind: Object.freeze({
      type: "string",
      enum: Object.freeze(["topic", "change", "owner", "none"]),
    }),
    targetReference: TEXT_SCHEMA,
    treatment: TEXT_SCHEMA,
    completionCondition: TEXT_SCHEMA,
    result: TEXT_SCHEMA,
    closeMeeting: Object.freeze({ type: "boolean" }),
  });
  const promoteTopic = Object.freeze({
    ...target,
    topicId: TOPIC_ID_SCHEMA,
    expectedRevision: POSITIVE_INTEGER_SCHEMA,
    changeId: Object.freeze({ type: "string", pattern: "^CHG-\\d{6}$" }),
    reason: TEXT_SCHEMA,
    remainingResponsibility: TEXT_SCHEMA,
  });
  return Object.freeze([
    defineTopicMeetingTool(
      MCP_TOPIC_LIST_TOOL,
      "Topic一覧",
      "TopicをID順に取得します。",
      required([]),
      page,
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_GET_TOOL,
      "Topic取得",
      "Topicを一件取得します。",
      required(["id"]),
      { ...record, id: TOPIC_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_CREATE_TOOL,
      "Topic登録",
      "固定Markdownを検証してTopicを登録します。",
      required(["markdown"]),
      create,
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_UPDATE_TOOL,
      "Topic編集",
      "期待改訂と次改訂を検証してTopicを更新します。",
      required(["id", "expectedRevision", "markdown"]),
      { ...update, id: TOPIC_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_DELETE_TOOL,
      "Topic削除",
      "Relation影響と明示確認を検証して誤登録Topicを削除します。",
      required(["id", "expectedRevision", "confirmed", "reason"]),
      { ...remove, id: TOPIC_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_TOPIC_PROMOTE_TOOL,
      "Topic昇格",
      "実在する採用済みCHGへTopicを接続し、状態・Relation・改訂を同時更新します。",
      required([
        "topicId",
        "expectedRevision",
        "changeId",
        "reason",
        "remainingResponsibility",
      ]),
      promoteTopic,
    ),
    defineTopicMeetingTool(
      MCP_MEETING_LIST_TOOL,
      "Meeting一覧",
      "MeetingをID順に取得します。",
      required([]),
      page,
    ),
    defineTopicMeetingTool(
      MCP_MEETING_GET_TOOL,
      "Meeting取得",
      "Meetingを一件取得します。",
      required(["id"]),
      { ...record, id: MEETING_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_MEETING_CREATE_TOOL,
      "Meeting登録",
      "固定Markdownを検証してMeetingを登録します。",
      required(["markdown"]),
      create,
    ),
    defineTopicMeetingTool(
      MCP_MEETING_UPDATE_TOOL,
      "Meeting編集",
      "期待改訂と次改訂を検証してMeetingを更新します。",
      required(["id", "expectedRevision", "markdown"]),
      { ...update, id: MEETING_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_MEETING_DELETE_TOOL,
      "Meeting削除",
      "Relation影響と明示確認を検証して誤登録Meetingを削除します。",
      required(["id", "expectedRevision", "confirmed", "reason"]),
      { ...remove, id: MEETING_ID_SCHEMA },
    ),
    defineTopicMeetingTool(
      MCP_MEETING_TREAT_OUTCOME_TOOL,
      "Meeting Outcome処置",
      "一つのOutcomeを完了・移管・昇格・不採用として処置し、全件処置済みの場合だけMeetingを閉じます。",
      required([
        "meetingId",
        "expectedRevision",
        "outcomeId",
        "disposition",
        "owner",
        "reviewTrigger",
        "targetKind",
        "targetReference",
        "treatment",
        "completionCondition",
        "result",
        "closeMeeting",
      ]),
      treatOutcome,
      {
        anyOf: [
          {
            properties: {
              targetKind: { const: "topic" },
              targetReference: TOPIC_ID_SCHEMA,
            },
          },
          {
            properties: {
              targetKind: { const: "change" },
              targetReference: { type: "string", pattern: "^CHG-\\d{6}$" },
            },
          },
          { properties: { targetKind: { enum: ["owner", "none"] } } },
        ],
      },
    ),
  ]);
}

/**
 * 当該要求だけに結合した管理Context。
 * @responsibility 構成済みRootとHeader資格を入力値から分離する。
 * @trace ARCH-000013
 * @shape rootとtokenのみ。
 * @invariant Role・許可結果をcacheしない。
 * @boundary MCP要求closureの内部構成。
 * @security JSON・永続状態・ログへ公開しない。
 * @compatibility 初回限定・stdio固定依存へ構成しない。
 */
type McpAccessManagementContext = Readonly<{
  root: FilesystemStoreRoot;
  token: string;
}>;

/**
 * 通常本人Toolと現在主体に許可された管理Toolを一覧表示する。
 * @responsibility 本人表示と管理一覧を分離し、実行許可と一覧表示を区別する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 当該要求の管理Context。
 * @returns 全Roleの本人一Tool、manager／administratorには管理十Toolを追加。
 * @precondition 通常接続の要求で構成されている。
 * @postcondition 一覧のRoleを後続保存のAuthorityへ渡さない。
 * @effect AMの現在本人認証・既存短期Lock。
 * @failure 認証・状態不明は固定例外で一覧を停止する。
 * @invariant 管理一覧から内容閲覧を付与しない。
 * @boundary AM現在認証とMCP一覧。
 * @security 本人Snapshot・Root・資格を返さない。
 * @concurrency 各一覧でfresh認証し、後続callでも再評価する。
 */
function listMcpAccessTools(context: McpAccessManagementContext) {
  const actor = authenticateNormalConnection(context.root, context.token);
  if (actor.status !== "completed")
    throw new Error("access_management_unavailable");
  return actor.snapshot.role === "developer"
    ? [MCP_CURRENT_ACCESS_TOOL_DEFINITION]
    : [MCP_CURRENT_ACCESS_TOOL_DEFINITION, ...getAccessToolDefinitions()];
}

/**
 * 閉Schemaの入力構造を実行前に固定する。
 * @responsibility 不正field・型・配列・相関をAM呼出し前に拒否する。
 * @trace ARCH-000012
 * @input Tool名と未検査arguments。
 * @returns 所有済み入力、拒否ならnull。
 * @precondition N/A: 任意入力を受ける。
 * @postcondition usernameの意味検査と現在対象判定をAMへ残す。
 * @effect N/A: メモリ内の構造検査のみ。
 * @failure 不正構造はnull。
 * @invariant 書換え・normalize・既定Role補完をしない。
 * @boundary MCP入力と同期AM API。
 * @security 未知fieldを透過しない。
 * @concurrency N/A: 同期で値を固定する。
 */
function parseManagementArguments(name: string, value: unknown) {
  if (name === MCP_CURRENT_ACCESS_TOOL)
    return readRequestRecord(value, new Set<string>());
  const definition = getAccessToolDefinitions().find(
    (tool) => tool.name === name,
  );
  if (!definition) return null;
  const required = definition.inputSchema.required;
  const args = readRequestRecord(value, new Set(required));
  if (!args || required.some((key) => !Object.hasOwn(args, key))) return null;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
  const owned: Record<string, unknown> = { ...args };
  for (const key of required) {
    const field = args[key];
    if (key === "expectedRevision") {
      if (!Number.isSafeInteger(field) || Number(field) < 1) return null;
    } else if (key === "operationId" || key === "userId") {
      if (typeof field !== "string" || !uuid.test(field)) return null;
    } else if (key === "repositoryId") {
      if (
        typeof field !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(field)
      )
        return null;
    } else if (key === "username") {
      if (typeof field !== "string") return null;
    } else if (key === "workspaceIds") {
      if (
        !Array.isArray(field) ||
        field.length > 2 ||
        [...field].some(
          (item) => item !== "development" && item !== "management",
        ) ||
        new Set(field).size !== field.length
      )
        return null;
      owned[key] = [...field];
    } else if (
      field !== "developer" &&
      field !== "manager" &&
      field !== "administrator"
    )
      return null;
  }
  return Object.freeze(owned);
}

/**
 * 管理結果を標準Tool応答へ全量接続する。
 * @responsibility 閉UnionをstructuredContentに置き、部分結果を返さない。
 * @trace ARCH-000012
 * @input 元Request IDと投影済み非秘密結果。
 * @returns 閉じた管理結果を保持した通常Tool応答。
 * @precondition 値は本Adapterの閉投影で生成する。
 * @postcondition 説明textへ入力・理由・状態を複製しない。
 * @effect N/A: メモリ内serializeのみ。
 * @failure 下位結果の失敗分類を保持し、出力量だけでは結果を置換しない。
 * @invariant 保存や認可を再実行しない。
 * @boundary MCP Tool結果とJSON-RPC搬送。
 * @security Path・秘密を追加しない。
 * @concurrency N/A: 完了済み結果の同期投影だけ。
 */
function completeManagementResponse(
  id: JsonRpcId,
  result: Readonly<Record<string, unknown>>,
): McpResponse {
  return protocolComplete(id, {
    content: [{ type: "text", text: "アクセス管理結果を取得しました。" }],
    structuredContent: result,
    isError: result.status !== "completed",
  });
}

/**
 * 管理要求を現在AM APIへ一度だけ委譲する。
 * @responsibility 完全入力・取消・結果公開を同期保存の前後へ接続する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input rawRequest、当該Header Context、signal。
 * @returns 非秘密管理結果、入力拒否、取消または固定内部故障。
 * @precondition 通常認証が完了した要求専用Contextである。
 * @postcondition AM処理は最大一回、応答喪失で自動再送しない。
 * @effect 既存AMの現在認可・読取りまたは明示保存。
 * @failure 不正入力-32602、取消-32800、例外-32603。
 * @invariant 保存開始後取消は終了待ち・公開抑止でありrollbackではない。
 * @boundary MCP要求からAM保存と公開応答。
 * @security Root・Token・内部理由を例外へ透過しない。
 * @concurrency 期待改訂を保持し、各AM APIのfresh認可を使う。
 */
async function dispatchAccessTool(
  params: McpToolCall,
  context: McpAccessManagementContext,
  signal: AbortSignal,
): Promise<McpResponse> {
  const args = parseManagementArguments(params.name, params.arguments);
  if (!args) return protocolError(params.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(params.id, -32800, "Request cancelled");
  const readKinds = {
    [MCP_ACCESS_MANAGEMENT_TOOLS.listUsers]: "users",
    [MCP_ACCESS_MANAGEMENT_TOOLS.listRoleContentAccess]: "roleContentAccess",
    [MCP_ACCESS_MANAGEMENT_TOOLS.listRepositories]: "registeredRepositories",
    [MCP_ACCESS_MANAGEMENT_TOOLS.listExposure]: "exposure",
  } as const;
  try {
    if (params.name === MCP_CURRENT_ACCESS_TOOL) {
      const projected = readCurrentAccess(context.root, context.token);
      await setTimeout(0);
      return signal.aborted
        ? protocolError(params.id, -32800, "Request cancelled")
        : completeManagementResponse(params.id, projected);
    }
    let projected: Readonly<Record<string, unknown>>;
    const kind = readKinds[params.name as keyof typeof readKinds];
    const actor = authenticateNormalConnection(context.root, context.token);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    if (
      actor.status === "unavailable" &&
      actor.reason !== "credential_authentication_rejected"
    )
      return protocolError(params.id, -32603, "Access management unavailable");
    if (actor.status !== "completed" || actor.snapshot.role === "developer")
      return completeManagementResponse(params.id, {
        status: kind === undefined ? "rejected" : "unavailable",
        reason:
          kind === undefined
            ? "management_request_rejected"
            : "management_read_rejected",
      });
    if (kind !== undefined) {
      const result = readManagementState(context.root, context.token, kind);
      projected = result;
    } else {
      const operation = Object.hasOwn(writeOperations, params.name)
        ? writeOperations[params.name as keyof typeof writeOperations]
        : undefined;
      if (!operation) return protocolError(params.id, -32602, "Invalid params");
      projected = executeManagementOperation(
        context,
        operation,
        args,
        args.expectedRevision as number,
        args.operationId as string,
      );
    }
    // 同期AM処理を終えてから、届いたTransport取消を処置する機会を設ける。
    // 切断の到着や保存の取消を保証する待機ではない。
    await setTimeout(0);
    if (signal.aborted)
      return protocolError(params.id, -32800, "Request cancelled");
    return completeManagementResponse(params.id, projected);
  } catch {
    return protocolError(
      params.id,
      signal.aborted ? -32800 : -32603,
      signal.aborted ? "Request cancelled" : "Access management unavailable",
    );
  }
}

/**
 * 独立先行できる非鍵管理Tool名を固定する。
 * @responsibility 一覧とdispatchの操作Identityを共有する。
 * @trace ARCH-000012
 */
export const MCP_ACCESS_MANAGEMENT_TOOLS = Object.freeze({
  listUsers: "crdd.list_access_users",
  listRoleContentAccess: "crdd.list_role_content_access",
  listRepositories: "crdd.list_registered_repositories",
  listExposure: "crdd.list_repository_exposure",
  registerUser: "crdd.register_user",
  updateUserName: "crdd.update_user_name",
  updateUserRole: "crdd.update_user_role",
  updateRoleContentAccess: "crdd.update_role_content_access",
  unregisterRepository: "crdd.unregister_repository",
  updateExposure: "crdd.update_repository_exposure",
} as const);

const writeOperations = {
  [MCP_ACCESS_MANAGEMENT_TOOLS.registerUser]: "registerUser",
  [MCP_ACCESS_MANAGEMENT_TOOLS.updateUserName]: "updateUserName",
  [MCP_ACCESS_MANAGEMENT_TOOLS.updateUserRole]: "updateUserRole",
  [MCP_ACCESS_MANAGEMENT_TOOLS.updateRoleContentAccess]:
    "updateRoleContentAccess",
  [MCP_ACCESS_MANAGEMENT_TOOLS.unregisterRepository]: "unregisterRepository",
  [MCP_ACCESS_MANAGEMENT_TOOLS.updateExposure]: "updateExposure",
} as const satisfies Record<
  string,
  Exclude<ManagementWriteOperation, "registerRepository">
>;

/**
 * 通常本人readの操作名を管理操作から分離する。
 * @responsibility 全Roleに提供する本人操作Identityを固定する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
export const MCP_CURRENT_ACCESS_TOOL = "crdd.get_current_access" as const;
/**
 * 本人readの空閉入力を定義する。
 * @responsibility 資格・管理Root・他User指定を受け取らない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
const MCP_CURRENT_ACCESS_TOOL_DEFINITION = Object.freeze({
  name: MCP_CURRENT_ACCESS_TOOL,
  title: "接続している本人と利用範囲",
  description:
    "本人と内容利用範囲を現在観測します。管理能力やToolの提供可否を示すものではありません。",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: [],
    properties: {},
  },
});

/**
 * 管理Toolの構造Schemaだけを生成する。
 * @responsibility 操作固有入力と共通相関を閉じ、値の業務判定をAMに残す。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input N/A: 固定した十操作を生成する。
 * @returns 非鍵管理Toolの固定名・表示名・入力Schema。
 * @precondition Consumerは現在manager／administratorの一覧認可を別に確認する。
 * @postcondition 未知fieldを拒否するSchemaだけを返す。
 * @effect N/A: メモリ内の値を構成するだけ。
 * @failure N/A: 外部観測・保存を行わない。
 * @invariant 一覧表示は実行Authorityや最終Tool集合の完成ではない。
 * @boundary MCP SchemaとAMの現在値検査。
 * @security 秘密とHost Pathを入力へ追加しない。
 * @concurrency N/A: 共有する現在状態を読まない。
 */
function getAccessToolDefinitions() {
  const role = {
    type: "string",
    enum: ["developer", "manager", "administrator"],
  };
  const userId = {
    type: "string",
    pattern:
      "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
  };
  const repositoryId = {
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  };
  const workspaceIds = {
    type: "array",
    uniqueItems: true,
    maxItems: 2,
    items: { type: "string", enum: ["development", "management"] },
  };
  const definitions = [
    ["listUsers", "ユーザー一覧", {}],
    ["listRoleContentAccess", "Role内容範囲一覧", {}],
    ["listRepositories", "登録Repository一覧", {}],
    ["listExposure", "Repository公開範囲一覧", {}],
    [
      "registerUser",
      "ユーザー登録",
      { username: { type: "string" }, plannedRole: role },
    ],
    [
      "updateUserName",
      "ユーザー表示名変更",
      { userId, username: { type: "string" } },
    ],
    [
      "updateUserRole",
      "ユーザーRole変更",
      { userId, currentRole: role, nextRole: role },
    ],
    [
      "updateRoleContentAccess",
      "Role内容範囲変更",
      { targetRole: role, workspaceIds },
    ],
    ["unregisterRepository", "Repository登録解除", { repositoryId }],
    [
      "updateExposure",
      "Repository公開範囲変更",
      { repositoryId, workspaceIds },
    ],
  ] as const;
  return Object.freeze(
    definitions.map(([operation, title, fields]) => {
      const mutation = Object.keys(fields).length !== 0;
      const properties = mutation
        ? {
            operationId: userId,
            expectedRevision: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            ...fields,
          }
        : {};
      return Object.freeze({
        name: MCP_ACCESS_MANAGEMENT_TOOLS[operation],
        title,
        description:
          "現在の管理権限で操作します。管理許可は内容閲覧や鍵操作の許可ではありません。",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(properties),
          properties,
        },
      });
    }),
  );
}
