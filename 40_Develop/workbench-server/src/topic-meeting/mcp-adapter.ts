/**
 * Topic／Meeting操作をRemote CROS MCPへ接続し、結果をWorkbench用Snapshotへ変換する。
 *
 * @packageDocumentation
 * @responsibility 明示Repositoryを持つMCP Callだけを発行し、一覧・本文・Relation・書込み結果をWorkbenchへ搬送する。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary WorkbenchとRemote CROS MCPのHTTP境界。
 * @effect Bearer認証付きHTTP Requestを発行し、書込みTool選択時だけ選択RepositoryへEffectを要求する。
 * @security CredentialをURL、本文、結果またはErrorへ複製せず、暗黙RepositoryやLocal fallbackを許可しない。
 */
import type {
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
} from "../../../domain-model/src/index.ts";

import {
  MCP_MEETING_CREATE_TOOL,
  MCP_MEETING_DELETE_TOOL,
  MCP_MEETING_GET_TOOL,
  MCP_MEETING_LIST_TOOL,
  MCP_MEETING_TREAT_OUTCOME_TOOL,
  MCP_MEETING_UPDATE_TOOL,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_DELETE_TOOL,
  MCP_TOPIC_GET_TOOL,
  MCP_TOPIC_LIST_TOOL,
  MCP_TOPIC_PROMOTE_TOOL,
  MCP_TOPIC_UPDATE_TOOL,
} from "../../../mcp-server/src/index.ts";

export type WorkbenchTopicMeetingDocumentReader = Readonly<{
  getDocument(
    kind: ProjectOperationRecordKind,
    id: string,
  ): TopicMeetingDocument | null;
  relations(
    kind: ProjectOperationRecordKind,
    id: string,
  ): readonly TopicMeetingRelation[];
}>;

export type RemoteTopicMeetingPage = Readonly<{
  page: TopicMeetingPage;
  reader: WorkbenchTopicMeetingDocumentReader;
}>;

export type RemoteTopicMeetingAction = Readonly<
  | {
      operation: "create";
      kind: ProjectOperationRecordKind;
      markdown: string;
    }
  | {
      operation: "update";
      kind: ProjectOperationRecordKind;
      id: string;
      expectedRevision: number;
      markdown: string;
    }
  | {
      operation: "delete";
      kind: ProjectOperationRecordKind;
      id: string;
      expectedRevision: number;
      confirmed: boolean;
    }
  | {
      operation: "promote-topic";
      kind: "topic";
      id: string;
      expectedRevision: number;
      changeId: string;
      reason: string;
      remainingResponsibility: string;
    }
  | {
      operation: "treat-outcome";
      kind: "meeting";
      id: string;
      expectedRevision: number;
      outcomeId: string;
      disposition: "completed" | "transferred" | "promoted" | "rejected";
      owner: string;
      reviewTrigger: string;
      targetKind: "topic" | "change" | "owner" | "none";
      targetReference: string;
      treatment: string;
      completionCondition: string;
      result: string;
      closeMeeting: boolean;
    }
>;

type McpToolResult = Readonly<{
  structuredContent: unknown;
  isError: boolean;
}>;

/**
 * Remote MCP Toolを一回呼び出す。
 *
 * @responsibility MCP HTTP HeaderとJSON-RPC Envelopeを固定し、Tool結果だけを未信頼値として返す。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input baseUrl、Bearer token、Tool名および引数を受け取る。
 * @returns 検証済みの最小Tool結果を返す。
 * @precondition baseUrlは利用者が明示したCROS Endpoint、tokenはProcess memory内の現在Credentialである。
 * @postcondition HTTP・JSON-RPC・Tool Errorを成功値へ変換しない。
 * @effect Remote MCPへ一Requestを発行する。
 * @failure 認証、Network、ProtocolまたはTool失敗をworkbench_remote_topic_meeting_unavailableで拒否する。
 * @invariant tokenをURL、Request bodyまたは返却値へ含めない。
 * @boundary Workbench Remote AdapterとMCP Streamable HTTP Transportの境界。
 * @security Bearer tokenはAuthorization Headerだけへ配置する。
 * @concurrency 一Callは一Responseへ収束し、自動Retryしない。
 */
async function callRemoteTopicMeetingTool(
  baseUrl: string,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<McpToolResult> {
  const response = await fetch(`${baseUrl.replace(/\/$/u, "")}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_ORCHESTRATOR_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !plain(payload))
    throw new Error("workbench_remote_topic_meeting_unavailable");
  const result = plain(payload.result) ? payload.result : null;
  if (
    result === null ||
    !Object.hasOwn(result, "structuredContent") ||
    typeof result.isError !== "boolean"
  )
    throw new Error("workbench_remote_topic_meeting_unavailable");
  return Object.freeze({
    structuredContent: result.structuredContent,
    isError: result.isError,
  });
}

/**
 * 値が通常Objectかを判定する。
 *
 * @responsibility Remote JSONを配列・nullと区別する。
 * @trace ARCH-000012
 * @input valueに未信頼JSON値を受け取る。
 * @returns 通常Objectの場合trueを返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition nullと配列をfalseにする。
 * @effect N/A: 値を観測するだけである。
 * @failure N/A: 真偽値へ閉じる。
 * @invariant 入力を変更しない。
 * @boundary Remote JSONとWorkbench型の境界。
 * @security Prototypeを実行しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Project Operation RecordのIdentityを返す。
 *
 * @responsibility TopicとMeetingの判別Unionから安定IDを取得する。
 * @trace ARCH-000006
 * @input recordに検証済みRecordを受け取る。
 * @returns Topic IDまたはMeeting IDを返す。
 * @precondition recordはTopicまたはMeetingである。
 * @postcondition 元RecordのIdentityを変更しない。
 * @effect N/A: Propertyを読むだけである。
 * @failure N/A: 判別Unionは必ずIdentityを持つ。
 * @invariant IDを再採番しない。
 * @boundary Remote RecordとSnapshot Mapの境界。
 * @security N/A: 公開Identityだけを扱う。
 * @concurrency N/A: 同期純粋処理である。
 */
function recordId(record: ProjectOperationRecord): string {
  return "topicId" in record ? record.topicId : record.meetingId;
}

/**
 * Remote Topic／Meeting詳細を取得する。
 *
 * @responsibility 明示Repositoryの一Record本文とFederated Relation状態を同じMCP応答から取得する。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Endpoint、Credential、repositoryId、kind、idを受け取る。
 * @returns Recordが存在する場合DocumentとRelation、存在しない場合nullを返す。
 * @precondition repositoryIdはPortfolioで明示選択した許可候補である。
 * @postcondition 別Repository本文を複製せず、RelationのownerRepositoryIdだけを保持する。
 * @effect Remote MCPへ読取りRequestを発行する。
 * @failure 不正ResponseまたはTool Errorを例外として返す。
 * @invariant Local Repositoryへfallbackしない。
 * @boundary WorkbenchとCROS Topic／Meeting MCPの境界。
 * @security Grant外Repositoryの存在をError差分から推測しない。
 * @concurrency 一詳細につき一Requestを発行する。
 */
export async function readRemoteTopicMeetingDocument(
  baseUrl: string,
  token: string,
  repositoryId: string,
  kind: ProjectOperationRecordKind,
  id: string,
): Promise<Readonly<{
  document: TopicMeetingDocument;
  relations: readonly TopicMeetingRelation[];
}> | null> {
  const result = await callRemoteTopicMeetingTool(
    baseUrl,
    token,
    kind === "topic" ? MCP_TOPIC_GET_TOOL : MCP_MEETING_GET_TOOL,
    Object.freeze({ repositoryId, id }),
  );
  if (!plain(result.structuredContent))
    throw new Error("workbench_remote_topic_meeting_response_invalid");
  if (result.structuredContent.status === "not_found") return null;
  const record = result.structuredContent.record;
  const markdown = result.structuredContent.markdown;
  const relations = result.structuredContent.relations;
  if (
    !plain(record) ||
    typeof markdown !== "string" ||
    !Array.isArray(relations)
  )
    throw new Error("workbench_remote_topic_meeting_response_invalid");
  return Object.freeze({
    document: Object.freeze({
      record: record as ProjectOperationRecord,
      markdown,
    }),
    relations: Object.freeze(relations as TopicMeetingRelation[]),
  });
}

/**
 * Remote Topic／Meeting一覧と表示に必要な本文Snapshotを取得する。
 *
 * @responsibility 一覧のPageと、そのPage内Recordだけの本文・Relationを一つの読取りSnapshotへ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Endpoint、Credential、明示Repository、kind、PaginationおよびQueryを受け取る。
 * @returns Pageと同期描画用Readerを返す。
 * @precondition repositoryIdは利用者がPortfolio Sourceから選択した値である。
 * @postcondition Page外Recordを先読みせず、取得不能を空集合へ変換しない。
 * @effect Remote MCPへ一覧一回とPage内Record数までの読取りRequestを発行する。
 * @failure 一部詳細取得失敗をPage成功として表示せず全体を拒否する。
 * @invariant 一覧と本文を別Repositoryへ跨がせない。
 * @boundary Workbench Collection UIとCROS MCPの境界。
 * @security Credentialと非開示Repository情報をSnapshotへ含めない。
 * @concurrency Page内詳細は並行取得し、全件成功後だけ公開する。
 */
export async function readRemoteTopicMeetingPage(input: {
  baseUrl: string;
  token: string;
  repositoryId: string;
  kind: ProjectOperationRecordKind;
  cursor?: string;
  limit: number;
  query: TopicMeetingListQuery;
}): Promise<RemoteTopicMeetingPage> {
  const result = await callRemoteTopicMeetingTool(
    input.baseUrl,
    input.token,
    input.kind === "topic" ? MCP_TOPIC_LIST_TOOL : MCP_MEETING_LIST_TOOL,
    Object.freeze({
      repositoryId: input.repositoryId,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      limit: input.limit,
      ...input.query,
    }),
  );
  if (!plain(result.structuredContent))
    throw new Error("workbench_remote_topic_meeting_response_invalid");
  const candidate = result.structuredContent;
  if (
    !["available", "not_configured"].includes(String(candidate.status)) ||
    !Array.isArray(candidate.records) ||
    (candidate.nextCursor !== null && typeof candidate.nextCursor !== "string")
  )
    throw new Error("workbench_remote_topic_meeting_response_invalid");
  const page = Object.freeze({
    status: candidate.status as TopicMeetingPage["status"],
    records: Object.freeze(candidate.records as ProjectOperationRecord[]),
    nextCursor: candidate.nextCursor as string | null,
  });
  const loaded = await Promise.all(
    page.records.map(async (record) => {
      const id = recordId(record);
      const detail = await readRemoteTopicMeetingDocument(
        input.baseUrl,
        input.token,
        input.repositoryId,
        input.kind,
        id,
      );
      if (detail === null)
        throw new Error("workbench_remote_topic_meeting_snapshot_changed");
      return Object.freeze({ id, ...detail });
    }),
  );
  const byId = new Map(loaded.map((entry) => [entry.id, entry] as const));
  return Object.freeze({
    page,
    reader: Object.freeze({
      getDocument: (_kind: ProjectOperationRecordKind, id: string) =>
        byId.get(id)?.document ?? null,
      relations: (_kind: ProjectOperationRecordKind, id: string) =>
        byId.get(id)?.relations ?? Object.freeze([]),
    }),
  });
}

/**
 * Remote Topic／Meeting書込みActionを実行する。
 *
 * @responsibility Workbench Formの閉じたActionを一つのMCP Tool Callへ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Endpoint、Credential、明示Repositoryおよび検証済みActionを受け取る。
 * @returns Project Operation公開結果をそのまま返す。
 * @precondition Form Tokenと入力形状はWorkbench Serverが検証済みである。
 * @postcondition 一Actionにつき一Toolだけを呼び出す。
 * @effect 選択Repositoryへ一書込みEffectを要求できる。
 * @failure Tool Errorまたは不正結果を例外として返す。
 * @invariant Repositoryを自動選択、再試行またはLocal fallbackしない。
 * @boundary Workbench CommandとRemote CROS MCP Toolの境界。
 * @security repositoryIdはAuthorityではなくCredential Grantで毎Request再検証されるTargetである。
 * @concurrency expectedRevision競合を上書きせず結果として返す。
 */
export async function executeRemoteTopicMeetingAction(
  baseUrl: string,
  token: string,
  repositoryId: string,
  action: RemoteTopicMeetingAction,
): Promise<unknown> {
  let name: string;
  let args: Readonly<Record<string, unknown>>;
  if (action.operation === "create") {
    name =
      action.kind === "topic" ? MCP_TOPIC_CREATE_TOOL : MCP_MEETING_CREATE_TOOL;
    args = Object.freeze({ repositoryId, markdown: action.markdown });
  } else if (action.operation === "update") {
    name =
      action.kind === "topic" ? MCP_TOPIC_UPDATE_TOOL : MCP_MEETING_UPDATE_TOOL;
    args = Object.freeze({
      repositoryId,
      id: action.id,
      expectedRevision: action.expectedRevision,
      markdown: action.markdown,
    });
  } else if (action.operation === "delete") {
    name =
      action.kind === "topic" ? MCP_TOPIC_DELETE_TOOL : MCP_MEETING_DELETE_TOOL;
    args = Object.freeze({
      repositoryId,
      id: action.id,
      expectedRevision: action.expectedRevision,
      confirmed: action.confirmed,
      reason: "mistaken_registration",
    });
  } else if (action.operation === "promote-topic") {
    name = MCP_TOPIC_PROMOTE_TOOL;
    args = Object.freeze({
      repositoryId,
      topicId: action.id,
      expectedRevision: action.expectedRevision,
      changeId: action.changeId,
      reason: action.reason,
      remainingResponsibility: action.remainingResponsibility,
    });
  } else {
    name = MCP_MEETING_TREAT_OUTCOME_TOOL;
    args = Object.freeze({
      repositoryId,
      meetingId: action.id,
      expectedRevision: action.expectedRevision,
      outcomeId: action.outcomeId,
      disposition: action.disposition,
      owner: action.owner,
      reviewTrigger: action.reviewTrigger,
      targetKind: action.targetKind,
      targetReference: action.targetReference,
      treatment: action.treatment,
      completionCondition: action.completionCondition,
      result: action.result,
      closeMeeting: action.closeMeeting,
    });
  }
  const result = await callRemoteTopicMeetingTool(baseUrl, token, name, args);
  if (!plain(result.structuredContent))
    throw new Error("workbench_remote_topic_meeting_response_invalid");
  return Object.freeze({ ...result.structuredContent });
}
