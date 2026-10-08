/**
 * MCP経由でOrchestratorを利用する公開境界。
 * @packageDocumentation
 * @responsibility MCP Protocol、Transport、Orchestrator Adapterを明示的に公開する。
 * @trace ARCH-000012
 * @boundary MCP ClientとOrchestratorの境界。
 * @effect stdioまたはlocalhost HTTPの接続、応答、終了処理を発行し得る。
 * @concurrency 複数RequestとServer終了を独立管理し、終了時に取消とjoinを行う。
 * @security 認証済みClient Principalを持つ要求だけを意味処理へ渡す。
 */
export {
  MCP_ORCHESTRATOR_ADAPTER_CONTRACT,
  describeMcpOrchestratorAdapterContract,
  handleMcpOrchestratorRequest,
  inspectMcpOrchestratorObjectiveResult,
  type McpOrchestratorDependencies,
} from "./orchestrator/adapter.ts";
export {
  handleMcpProjectContextRequest,
  type McpProjectContextDependencies,
} from "./project-context/adapter.ts";
export {
  routeMcpRequest,
  type McpRequestRoutingDependencies,
} from "./request/route.ts";
export { createCrosProjectContextMcpResolver } from "./project-context/cros-resolver.ts";
export {
  startCrosSharedServer,
  type CrosSharedServerHandle,
  type CrosSharedServerInput,
} from "./shared-host/server.ts";
export {
  getMcpProjectContextToolDefinitions,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
} from "./project-context/protocol.ts";
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
} from "./topic-meeting/protocol.ts";
export { handleMcpTopicMeetingRequest } from "./topic-meeting/adapter.ts";
export {
  MCP_ORCHESTRATOR_DECISION_TOOL,
  MCP_ORCHESTRATOR_OBJECTIVE_TOOL,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  MCP_ORCHESTRATOR_STATE_TOOL,
  callKeys,
  decisionKeys,
  decisionKeysNoComment,
  discoverKeys,
  getMcpOrchestratorToolDefinitions,
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
} from "./orchestrator/protocol.ts";
export {
  MCP_ORCHESTRATOR_STDIO_CONTRACT,
  describeMcpOrchestratorStdioContract,
  runMcpStdio,
  runMcpOrchestratorStdio,
} from "./transport/stdio.ts";
export {
  MCP_ORCHESTRATOR_STREAMABLE_HTTP_CONTRACT,
  describeMcpOrchestratorStreamableHttpContract,
  startMcpAuthenticatedStreamableHttp,
  startMcpStreamableHttp,
  startMcpOrchestratorStreamableHttp,
  type McpAuthenticatedHttpOptions,
  type McpOrchestratorHttpOptions,
} from "./transport/streamable-http.ts";
export {
  closeMcpHttpOnProcessSignal,
  type McpHttpServerCloseBoundary,
  type McpProcessSignalSource,
} from "./transport/process-signal-shutdown.ts";
export type {
  McpAuthenticatedRequestHandlerResolver,
  McpRequestHandler,
} from "./transport/types.ts";
