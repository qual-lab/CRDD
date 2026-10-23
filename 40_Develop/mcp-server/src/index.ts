/**
 * MCP経由でCoordinatorを利用する公開境界。
 * @packageDocumentation
 * @responsibility MCP Protocol、Transport、Coordinator Adapterを明示的に公開する。
 * @trace ARCH-000012
 * @boundary MCP ClientとCoordinatorの境界。
 * @effect stdioまたはlocalhost HTTPの接続、応答、終了処理を発行し得る。
 * @concurrency 複数RequestとServer終了を独立管理し、終了時に取消とjoinを行う。
 * @security 認証済みClient Principalを持つ要求だけを意味処理へ渡す。
 */

export {
  MCP_ACCESS_MANAGEMENT_TOOLS,
  MCP_CURRENT_ACCESS_TOOL,
} from "./tools/access-management.ts";
export {
  describeMcpCoordinatorAdapterContract,
  handleMcpCoordinatorRequest,
  inspectMcpCoordinatorObjectiveResult,
  MCP_COORDINATOR_ADAPTER_CONTRACT,
  type McpCoordinatorDependencies,
  getMcpCoordinatorToolDefinitions,
  MCP_COORDINATOR_DECISION_TOOL,
  MCP_COORDINATOR_OBJECTIVE_TOOL,
  MCP_COORDINATOR_STATE_TOOL,
} from "./tools/task.ts";
export {
  MCP_COORDINATOR_PROTOCOL_VERSION,
  type McpResponse,
} from "./request/validation.ts";
export {
  handleMcpProjectContextRequest,
  type McpProjectContextDependencies,
  getMcpProjectContextToolDefinitions,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
} from "./tools/project-context.ts";
export { createAccessMcpResolver } from "./request/authentication.ts";
export {
  type McpServerDependencies,
  createMcpServerFactory,
} from "./request/server.ts";
export {
  getMcpExecutionStatusToolDefinitions,
  handleMcpExecutionStatusRequest,
  MCP_EXECUTION_STATUS_TOOL,
  type McpExecutionStatusDependencies,
} from "./tools/execution-status.ts";
export {
  handleMcpTopicMeetingRequest,
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
} from "./tools/topic-meeting.ts";
export { readMcpServerConfiguration } from "./transport/configuration.ts";
export {
  closeMcpHttpOnProcessSignal,
  type McpHttpServerCloseBoundary,
  type McpProcessSignalSource,
} from "./transport/shutdown.ts";
export {
  describeMcpCoordinatorStdioContract,
  MCP_COORDINATOR_STDIO_CONTRACT,
  runMcpCoordinatorStdio,
  runMcpStdio,
} from "./transport/stdio.ts";
export {
  describeMcpCoordinatorStreamableHttpContract,
  MCP_COORDINATOR_STREAMABLE_HTTP_CONTRACT,
  type McpAuthenticatedHttpOptions,
  type McpCoordinatorHttpOptions,
  startMcpAuthenticatedStreamableHttp,
  startMcpCoordinatorStreamableHttp,
  startMcpStreamableHttp,
} from "./transport/http.ts";
export type {
  McpAuthenticatedRequestHandlerResolver,
  McpRequestHandler,
  McpServerFactory,
  McpRequestSource,
} from "./transport/types.ts";
export {
  getMcpWorkspaceToolDefinitions,
  handleMcpWorkspaceRequest,
  MCP_WORKSPACE_MANAGE_TOOL,
  MCP_WORKSPACE_READ_TOOL,
  type WorkspaceAccessResolver,
} from "./tools/workspace.ts";
