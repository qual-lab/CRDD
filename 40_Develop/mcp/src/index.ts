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
  runMcpProjectRuntimeStdio,
} from "./transports/stdio-transport.ts";
export {
  MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT,
  describeMcpProjectRuntimeStreamableHttpContract,
  startMcpProjectRuntimeStreamableHttp,
  type McpProjectRuntimeHttpOptions,
} from "./transports/streamable-http-transport.ts";
export {
  closeMcpHttpOnProcessSignal,
  type McpHttpServerCloseBoundary,
  type McpProcessSignalSource,
} from "./transports/process-signal-shutdown.ts";
