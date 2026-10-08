/** Topic／Meeting共通ApplicationをMCP Tool Callへ接続する。
 * @responsibility Topic／Meeting MCP Adapter境界の公開Protocolと検証境界を所有する。
 * @trace ARCH-000005
 */
import { types as utilTypes } from "node:util";

import type { TopicMeetingAccess } from "../../../domain-model/src/index.ts";

import {
  callKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../orchestrator/protocol.ts";
import {
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
} from "./protocol.ts";

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
 * @responsibility repositoryIdをApplication Resolverへ一回渡し、許可済みCallだけからTarget Keyを除いて共通Adapterへ渡す。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input rawRequest: Remote MCP要求、resolveTopicMeetingAccess: Request固定Resolver、signal: 取消Signal。
 * @returns 共通Topic／Meeting Adapterの応答、または非開示Protocol Error。
 * @precondition Resolverは現在Credential、Workspace、ExposureおよびRepository Revisionを同じSnapshotで検証する。
 * @postcondition 共通ApplicationはrepositoryIdを含まないRepository単体契約だけを受け取る。
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
  const application = resolveTopicMeetingAccess(args.repositoryId);
  if (application === null)
    return protocolError(request.id, -32602, "Invalid params");
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
    application,
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
 * @input rawRequest: 未信頼MCP要求、application: 許可済みApplication、signal: 取消Signal。
 * @returns MCP Protocolの完了またはError応答。
 * @precondition applicationは現在RepositoryまたはRequest固定Resolverから解決済みである。
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
  application: TopicMeetingAccess,
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
        throw new Error();
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
        throw new Error();
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
        throw new Error();
      if (args.cursor !== undefined && typeof args.cursor !== "string")
        throw new Error();
      if (args.limit !== undefined && typeof args.limit !== "number")
        throw new Error();
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
            !args.states.every((state) => typeof state === "string"))) ||
        (args.pendingOnly !== undefined &&
          typeof args.pendingOnly !== "boolean")
      )
        throw new Error();
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
      const page = application[kind].list({
        ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
        ...(args.limit === undefined ? {} : { limit: args.limit }),
        ...(Object.keys(query).length === 0 ? {} : { query }),
      });
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
        throw new Error();
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
        throw new Error();
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
        throw new Error();
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
        throw new Error();
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
  } catch {
    return protocolError(request.id, -32602, "Invalid params");
  }
  return protocolError(request.id, -32601, "Method not found");
}
