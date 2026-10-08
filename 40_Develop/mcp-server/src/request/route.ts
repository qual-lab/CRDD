/**
 * MCPで公開する複数Capabilityを一つのProtocol入口へ合成する。
 *
 * @packageDocumentation
 * @responsibility OrchestratorとProject ContextのTool一覧・Routingを所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary MCP Protocolと専門Adapter群の合成境界。
 * @effect 選択した専門AdapterのEffect契約に従う。
 * @concurrency Requestごとに一つの専門Adapterだけを呼び出す。
 * @security Tool名だけでRoutingし、専門AdapterのAuthority判断を迂回しない。
 */
import { snapshotPlainRecord } from "./snapshot.ts";
import {
  handleMcpProjectContextRequest,
  type McpProjectContextDependencies,
} from "../project-context/adapter.ts";
import {
  handleMcpOrchestratorRequest,
  type McpOrchestratorDependencies,
} from "../orchestrator/adapter.ts";
import {
  getMcpProjectContextToolDefinitions,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
} from "../project-context/protocol.ts";
import {
  callKeys,
  discoverKeys,
  getMcpOrchestratorToolDefinitions,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  listKeys,
  listKeysNoCursor,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../orchestrator/protocol.ts";
import type { TopicMeetingAccess } from "../../../domain-model/src/index.ts";

import {
  handleMcpRoutedTopicMeetingRequest,
  handleMcpTopicMeetingRequest,
  type TopicMeetingAccessResolver,
} from "../topic-meeting/adapter.ts";
import {
  getMcpTopicMeetingToolDefinitions,
  MCP_TOPIC_MEETING_TOOLS,
} from "../topic-meeting/protocol.ts";

/**
 * 合成MCP Applicationの依存を定義する。
 *
 * @responsibility 専門Adapterごとの依存を混同せず同じComposition Rootへ渡す。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape orchestratorとprojectContextを表す。
 * @invariant Project Context ReaderをOrchestrator状態取得として扱わない。
 * @boundary MCP Composition Rootと専門Adapterの型境界。
 * @security 各依存は担当AdapterのAuthority契約を維持する。
 * @compatibility 専門Adapter追加時はTool一覧とRoutingの全数性を再評価する。
 */
export type McpRequestRoutingDependencies = Readonly<{
  orchestrator?: McpOrchestratorDependencies;
  projectContext: McpProjectContextDependencies;
  topicMeeting?: TopicMeetingAccess;
  topicMeetingRepositoryResolver?: TopicMeetingAccessResolver;
}>;

/**
 * 合成MCP Requestを処理する。
 *
 * @responsibility Discovery、Tool一覧およびTool Callを正しい専門AdapterへRoutingする。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input rawRequest、dependenciesおよび取消Signalを受け取る。
 * @returns MCP応答を返す。
 * @precondition dependenciesはRuntimeとContextの有効な公開依存を含む。
 * @postcondition 一Requestは最大一つの専門Adapterへ渡される。
 * @effect 選択した専門AdapterのEffectだけを発行する。
 * @failure 不正Method、MetadataまたはTool名をProtocol Errorへ閉じる。
 * @invariant Tool一覧とRouting対象の集合を一致させる。
 * @boundary MCP Transportと専門Adapter群の境界。
 * @security Project ContextとOrchestratorのAuthorityを相互流用しない。
 * @concurrency Request間で依存、応答または認証状態を共有しない。
 */
export async function routeMcpRequest(
  rawRequest: unknown,
  dependencies: McpRequestRoutingDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (!request) return protocolError(null, -32600, "Invalid Request");
  if (request.method === "server/discover") {
    const params = snapshotPlainRecord(request.params, discoverKeys);
    return !params || !inspectMcpEnvelope(params._meta)
      ? protocolError(request.id, -32602, "Invalid params")
      : protocolComplete(request.id, {
          supportedVersions: Object.freeze([MCP_ORCHESTRATOR_PROTOCOL_VERSION]),
          capabilities: Object.freeze({ tools: Object.freeze({}) }),
          ttlMs: 0,
          cacheScope: "private",
        });
  }
  if (request.method === "tools/list") {
    const params =
      snapshotPlainRecord(request.params, listKeysNoCursor) ??
      snapshotPlainRecord(request.params, listKeys);
    const paramsRecord: Readonly<Record<string, unknown>> | null = params;
    return !params ||
      !inspectMcpEnvelope(params._meta) ||
      (Object.hasOwn(params, "cursor") && paramsRecord?.cursor !== null)
      ? protocolError(request.id, -32602, "Invalid params")
      : protocolComplete(request.id, {
          tools: Object.freeze([
            ...(dependencies.orchestrator === undefined
              ? []
              : getMcpOrchestratorToolDefinitions()),
            ...getMcpProjectContextToolDefinitions(),
            ...(dependencies.topicMeeting === undefined &&
            dependencies.topicMeetingRepositoryResolver === undefined
              ? []
              : getMcpTopicMeetingToolDefinitions(
                  dependencies.topicMeetingRepositoryResolver === undefined
                    ? "implicit"
                    : "required",
                )),
          ]),
          ttlMs: 0,
          cacheScope: "private",
        });
  }
  if (request.method !== "tools/call")
    return protocolError(request.id, -32601, "Method not found");
  const params = snapshotPlainRecord(request.params, callKeys);
  if (!params || !inspectMcpEnvelope(params._meta))
    return protocolError(request.id, -32602, "Invalid params");
  if (MCP_TOPIC_MEETING_TOOLS.includes(params.name as never))
    return dependencies.topicMeetingRepositoryResolver !== undefined
      ? handleMcpRoutedTopicMeetingRequest(
          rawRequest,
          dependencies.topicMeetingRepositoryResolver,
          signal,
        )
      : dependencies.topicMeeting === undefined
        ? protocolError(request.id, -32601, "Method not found")
        : handleMcpTopicMeetingRequest(
            rawRequest,
            dependencies.topicMeeting,
            signal,
          );
  if (
    params.name !== MCP_PROJECT_CONTEXT_LIST_TOOL &&
    params.name !== MCP_PROJECT_CONTEXT_GET_TOOL &&
    dependencies.orchestrator === undefined
  )
    return protocolError(request.id, -32601, "Method not found");
  return params.name === MCP_PROJECT_CONTEXT_LIST_TOOL ||
    params.name === MCP_PROJECT_CONTEXT_GET_TOOL
    ? handleMcpProjectContextRequest(
        rawRequest,
        dependencies.projectContext,
        signal,
      )
    : handleMcpOrchestratorRequest(
        rawRequest,
        dependencies.orchestrator as McpOrchestratorDependencies,
        signal,
      );
}
