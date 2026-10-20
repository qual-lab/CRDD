/** Topic／Meeting共通ApplicationをMCP Tool Callへ接続する。
 * @responsibility Topic／Meeting MCP Adapter境界の公開Protocolと検証境界を所有する。
 * @trace ARCH-000005
 */
import { types as utilTypes } from "node:util";

import {
  parseTopicMarkdown,
  parseMeetingMarkdown,
  type TopicMeetingAccess,
  validateTopicMeetingListInput,
} from "../../../domain-model/src/index.ts";

import {
  callKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../request/validation.ts";

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
export type TopicMeetingAccessResolver = (
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
export async function handleMcpRoutedTopicMeetingRequest(
  rawRequest: unknown,
  resolveTopicMeetingAccess: TopicMeetingAccessResolver,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = plain(request.params) ? request.params : null;
  const args = params && plain(params.arguments) ? params.arguments : null;
  if (
    !params ||
    !args ||
    typeof args.repositoryId !== "string" ||
    args.repositoryId.length === 0 ||
    args.repositoryId.length > 128
  )
    return protocolError(request.id, -32602, "Invalid params");
  const repositoryId = args.repositoryId;
  const { repositoryId: ignoredRepositoryId, ...localArguments } = args;
  return handleMcpTopicMeetingRequest(
    Object.freeze({
      jsonrpc: "2.0",
      id: request.id,
      method: request.method,
      params: Object.freeze({
        ...params,
        arguments: Object.freeze(localArguments),
      }),
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
      !utilTypes.isProxy(value) &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Object.values(Object.getOwnPropertyDescriptors(value)).every(
        (descriptor) => "value" in descriptor,
      ),
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
  const request = inspectProtocolRequest(rawRequest);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = plain(request.params) ? request.params : null;
  if (
    !params ||
    Object.keys(params).some((key) => !callKeys.has(key as never)) ||
    !inspectMcpEnvelope(params._meta) ||
    typeof params.name !== "string" ||
    !MCP_TOPIC_MEETING_TOOLS.includes(params.name as never) ||
    !plain(params.arguments)
  )
    return protocolError(request.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
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
    return protocolError(request.id, -32602, "Invalid params");
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
    return protocolError(request.id, -32602, "Invalid params");
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
        return protocolError(request.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const result = application.topic.promoteTopic({
        topicId: args.topicId as string,
        expectedRevision: args.expectedRevision as number,
        changeId: args.changeId as string,
        reason: args.reason as string,
        remainingResponsibility: args.remainingResponsibility as string,
      });
      return protocolComplete(request.id, {
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
        return protocolError(request.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const result = application.meeting.treatMeetingOutcome({
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
      });
      return protocolComplete(request.id, {
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
        return protocolError(request.id, -32602, "Invalid params");
      if (args.cursor !== undefined && typeof args.cursor !== "string")
        return protocolError(request.id, -32602, "Invalid params");
      if (
        args.limit !== undefined &&
        (typeof args.limit !== "number" ||
          !Number.isSafeInteger(args.limit) ||
          (args.limit as number) < 1 ||
          (args.limit as number) > 100)
      )
        return protocolError(request.id, -32602, "Invalid params");
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
        return protocolError(request.id, -32602, "Invalid params");
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
      try {
        validateTopicMeetingListInput(kind, listInput);
      } catch {
        return protocolError(request.id, -32602, "Invalid params");
      }
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const page = application[kind].list(listInput);
      return protocolComplete(request.id, {
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
        return protocolError(request.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const document = application[kind].getDocument(args.id);
      const record = document?.record ?? null;
      const relations =
        record === null
          ? Object.freeze([])
          : application[kind].relations(args.id);
      return protocolComplete(request.id, {
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
    if (
      [MCP_TOPIC_CREATE_TOOL, MCP_MEETING_CREATE_TOOL].includes(
        params.name as never,
      )
    ) {
      if (!exactKeys(args, ["markdown"]) || typeof args.markdown !== "string")
        return protocolError(request.id, -32602, "Invalid params");
      try {
        if (kind === "topic") parseTopicMarkdown(args.markdown);
        else parseMeetingMarkdown(args.markdown);
      } catch {
        return protocolError(request.id, -32602, "Invalid params");
      }
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const result = application[kind].create(args.markdown);
      return protocolComplete(request.id, {
        content: Object.freeze([{ type: "text", text: result.reason }]),
        structuredContent: result,
        isError: result.status !== "completed",
      });
    }
    if (
      [MCP_TOPIC_UPDATE_TOOL, MCP_MEETING_UPDATE_TOOL].includes(
        params.name as never,
      )
    ) {
      if (
        !exactKeys(args, ["id", "expectedRevision", "markdown"]) ||
        typeof args.id !== "string" ||
        !Number.isSafeInteger(args.expectedRevision) ||
        typeof args.markdown !== "string"
      )
        return protocolError(request.id, -32602, "Invalid params");
      try {
        if (kind === "topic") parseTopicMarkdown(args.markdown);
        else parseMeetingMarkdown(args.markdown);
      } catch {
        return protocolError(request.id, -32602, "Invalid params");
      }
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const result = application[kind].update({
        id: args.id,
        expectedRevision: args.expectedRevision as number,
        markdown: args.markdown,
      });
      return protocolComplete(request.id, {
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
        return protocolError(request.id, -32602, "Invalid params");
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      const application = typeof access === "function" ? access() : access;
      accessResolved = true;
      if (signal.aborted)
        return protocolError(request.id, -32800, "Request cancelled");
      if (application === null)
        return protocolError(request.id, -32602, "Invalid params");
      const result = application[kind].delete({
        id: args.id,
        expectedRevision: args.expectedRevision as number,
        confirmed: args.confirmed,
        reason: "mistaken_registration",
      });
      return protocolComplete(request.id, {
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
      return protocolError(request.id, -32602, "Invalid params");
    return protocolError(request.id, -32603, "Internal error");
  }
  return protocolError(request.id, -32601, "Method not found");
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

function tool(
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
export function getMcpTopicMeetingToolDefinitions(
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
    tool(
      MCP_TOPIC_LIST_TOOL,
      "Topic一覧",
      "TopicをID順に取得します。",
      required([]),
      page,
    ),
    tool(
      MCP_TOPIC_GET_TOOL,
      "Topic取得",
      "Topicを一件取得します。",
      required(["id"]),
      { ...record, id: TOPIC_ID_SCHEMA },
    ),
    tool(
      MCP_TOPIC_CREATE_TOOL,
      "Topic登録",
      "固定Markdownを検証してTopicを登録します。",
      required(["markdown"]),
      create,
    ),
    tool(
      MCP_TOPIC_UPDATE_TOOL,
      "Topic編集",
      "期待改訂と次改訂を検証してTopicを更新します。",
      required(["id", "expectedRevision", "markdown"]),
      { ...update, id: TOPIC_ID_SCHEMA },
    ),
    tool(
      MCP_TOPIC_DELETE_TOOL,
      "Topic削除",
      "Relation影響と明示確認を検証して誤登録Topicを削除します。",
      required(["id", "expectedRevision", "confirmed", "reason"]),
      { ...remove, id: TOPIC_ID_SCHEMA },
    ),
    tool(
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
    tool(
      MCP_MEETING_LIST_TOOL,
      "Meeting一覧",
      "MeetingをID順に取得します。",
      required([]),
      page,
    ),
    tool(
      MCP_MEETING_GET_TOOL,
      "Meeting取得",
      "Meetingを一件取得します。",
      required(["id"]),
      { ...record, id: MEETING_ID_SCHEMA },
    ),
    tool(
      MCP_MEETING_CREATE_TOOL,
      "Meeting登録",
      "固定Markdownを検証してMeetingを登録します。",
      required(["markdown"]),
      create,
    ),
    tool(
      MCP_MEETING_UPDATE_TOOL,
      "Meeting編集",
      "期待改訂と次改訂を検証してMeetingを更新します。",
      required(["id", "expectedRevision", "markdown"]),
      { ...update, id: MEETING_ID_SCHEMA },
    ),
    tool(
      MCP_MEETING_DELETE_TOOL,
      "Meeting削除",
      "Relation影響と明示確認を検証して誤登録Meetingを削除します。",
      required(["id", "expectedRevision", "confirmed", "reason"]),
      { ...remove, id: MEETING_ID_SCHEMA },
    ),
    tool(
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
