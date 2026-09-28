/**
 * MCP経由でProject Runtimeを利用する公開境界。
 * @packageDocumentation
 * @responsibility MCP Protocol、Transport、Project Runtime Adapterを明示的に公開する。
 * @trace ARCH-000012
 * @boundary MCP ClientとProject Runtimeの境界。
 * @effect stdioまたはlocalhost HTTPの接続、応答、終了処理を発行し得る。
 * @concurrency 複数RequestとServer終了を独立管理し、終了時に取消とjoinを行う。
 * @security 認証済みClient Principalを持つ要求だけを意味処理へ渡す。
 */
export {
  MCP_PROJECT_RUNTIME_ADAPTER_CONTRACT,
  describeMcpProjectRuntimeAdapterContract,
  handleMcpProjectRuntimeRequest,
  inspectMcpProjectRuntimeObjectiveResult,
  type McpProjectRuntimeDependencies,
} from "./adapters/project-runtime-adapter.ts";
export {
  handleMcpProjectContextRequest,
  type McpProjectContextDependencies,
} from "./adapters/project-context-adapter.ts";
export {
  handleMcpApplicationRequest,
  type McpApplicationDependencies,
} from "./adapters/application-adapter.ts";
export { createCrosProjectContextMcpResolver } from "./composition/cros-project-context-application.ts";
export {
  startCrosSharedServer,
  type CrosSharedServerHandle,
  type CrosSharedServerInput,
} from "./composition/cros-shared-server.ts";
export {
  getMcpProjectContextToolDefinitions,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
} from "./protocol/project-context-protocol.ts";
export {
  getMcpTopicMeetingToolDefinitions,
  MCP_MEETING_CREATE_TOOL,
  MCP_MEETING_DELETE_TOOL,
  MCP_MEETING_GET_TOOL,
  MCP_MEETING_LIST_TOOL,
  MCP_MEETING_TREAT_OUTCOME_TOOL,
  MCP_MEETING_UPDATE_TOOL,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_DELETE_TOOL,
  MCP_TOPIC_GET_TOOL,
  MCP_TOPIC_LIST_TOOL,
  MCP_TOPIC_MEETING_TOOLS,
  MCP_TOPIC_PROMOTE_TOOL,
  MCP_TOPIC_UPDATE_TOOL,
} from "./protocol/topic-meeting-protocol.ts";
export { handleMcpTopicMeetingRequest } from "./adapters/topic-meeting-adapter.ts";
export {
  MCP_PROJECT_RUNTIME_DECISION_TOOL,
  MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  MCP_PROJECT_RUNTIME_STATE_TOOL,
  callKeys,
  decisionKeys,
  decisionKeysNoComment,
  discoverKeys,
  getMcpProjectRuntimeToolDefinitions,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  listKeys,
  listKeysNoCursor,
  objectiveKeys,
  protocolComplete,
  protocolError,
  requestKeys,
  stateQueryKeys,
  validJsonRpcId,
  type JsonRpcId,
  type McpResponse,
} from "./protocol/project-runtime-protocol.ts";
export {
  MCP_PROJECT_RUNTIME_STDIO_CONTRACT,
  describeMcpProjectRuntimeStdioContract,
  runMcpStdio,
  runMcpProjectRuntimeStdio,
} from "./transports/stdio-transport.ts";
export {
  MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT,
  describeMcpProjectRuntimeStreamableHttpContract,
  startMcpAuthenticatedStreamableHttp,
  startMcpStreamableHttp,
  startMcpProjectRuntimeStreamableHttp,
  type McpAuthenticatedHttpOptions,
  type McpProjectRuntimeHttpOptions,
} from "./transports/streamable-http-transport.ts";
export {
  closeMcpHttpOnProcessSignal,
  type McpHttpServerCloseBoundary,
  type McpProcessSignalSource,
} from "./transports/process-signal-shutdown.ts";
export type {
  McpAuthenticatedRequestHandlerResolver,
  McpRequestHandler,
} from "./transports/request-handler.ts";
