/**
 * CRDD Serverが既に提供するHTTPインターフェースを記述する。
 * @responsibility 既存のURL、搬送形式、認証条件、失敗の意味をOpenAPIとして公開する。
 * @trace ARCH-000012
 * @boundary 外部のHTTP契約と各Routeの実行・入力検査。
 * @security 実資格、Host情報、非公開Path、MCP Toolの入出力は含めない。
 */

import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import {
  decisionRequestSchema,
  definitionReadFields,
  definitionWriteFields,
  executionDecisionTools,
  executionDefinitionResources,
  objectiveCancellationSchema,
  objectiveRequestSchema,
} from "../service/execution.ts";
import { RESOURCE_ID } from "../service/identity.ts";
import { workspaceInputSchema } from "../service/workspace-request.ts";
import { matchesRequestHost, setResponseHeaders } from "./api-http.ts";
import {
  aiRequestReadRoutes,
  aiRequestWriteRoutes,
  aiSelectionRoute,
  artifactResources,
  executionActivityRoute,
  executionStateRoute,
  executionWriteRoutes,
  projectContextRoutes,
  repositoryFilesRoutes,
  repositoryWriteRoutes,
  topicMeetingResources,
  workbenchContextPath,
  workspaceResources,
} from "./api-server.ts";
import {
  EXECUTION_ACTIVITY_TOOL,
  getTopicMeetingToolDefinitions,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
  MCP_WORKSPACE_TOOLS,
} from "./mcp-server.ts";
import { objectiveRunTools } from "./mcp-types.ts";

const string = { type: "string" } as const;
const operationForTool = (tool: `crdd.${string}`) => tool.slice("crdd.".length);
const localAccess = [] as const;
const json = {
  description: "既存操作の結果。HTTP成功だけで保存・実行の成功を示さない。",
  content: { "application/json": { schema: { type: "object" } } },
};
const readResponses = {
  "200": json,
  default: {
    description: "現在の対象・認可・入力を確認できない場合は結果を返さない。",
  },
};
const headResponses = {
  ...readResponses,
  "200": { description: "取得可能。本文なし。" },
};
const writeErrors = {
  "400": { description: "入力又は要求の受理条件が不成立。" },
  "403": { description: "現在のアクセス条件又は搬送条件が不成立。" },
  "503": {
    description: "結果の確定又は安全な返却が不能。再送許可を意味しない。",
  },
  default: { description: "操作固有の拒否又は内部失敗。" },
};
const writeResponses = { "200": json, ...writeErrors };

/** Git書込みは実ルートのメソッド・URLと同じ粒度で公開する。 */
const repositoryWriteDocumentation = repositoryWriteRoutes.reduce<
  Record<string, Record<string, object>>
>((paths, { method, path, operation }) => {
  const fields =
    operation === "prepare" || operation === "unprepare"
      ? { path: string }
      : operation === "create_revision"
        ? { message: string }
        : {
            destination: string,
            branch: string,
            humanConfirmed: { const: true },
          };
  const ids = {
    prepare: "stageRepositoryPath",
    unprepare: "unstageRepositoryPath",
    create_revision: "createRepositoryRevision",
    publish_revision: "publishRepositoryRevision",
  };
  const summaries = {
    prepare: "指定ファイルをステージ",
    unprepare: "指定ファイルのステージを解除",
    create_revision: "ステージ済み変更をコミット",
    publish_revision: "確認済みのコミットを送信",
  };
  const key = path.replace(/:(\w+)/gu, "{$1}");
  paths[key] ??= {};
  paths[key][method] = {
    operationId: ids[operation],
    summary: summaries[operation],
    security: localAccess,
    parameters: [
      ...[...path.matchAll(/:(\w+)/gu)].map(([, name]) => ({
        name,
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern:
            name === "revision"
              ? "^(?:[0-9a-f]{40}|[0-9a-f]{64})$"
              : RESOURCE_ID.source,
        },
      })),
      {
        name: "X-CRDD-Action-Token",
        in: "header",
        required: true,
        schema: string,
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: false,
            required: Object.keys(fields),
            properties: fields,
          },
        },
      },
    },
    responses: writeResponses,
  };
  return paths;
}, {});

/** 実際のAI依頼経路と同じ操作別入力を公開する。 */
function aiRequestWriteOperation(route: (typeof aiRequestWriteRoutes)[number]) {
  const { operation, path } = route;
  const start = operation === "start";
  const requestId = {
    type: "string",
    pattern: RESOURCE_ID.source,
  };
  const nullableString = { anyOf: [string, { type: "null" }] };
  return {
    operationId: start
      ? "startAiRequest"
      : operation === "select"
        ? "selectAiRequest"
        : "cancelAiRequest",
    summary: start
      ? "AI依頼を開始"
      : operation === "select"
        ? "元の依頼を現在表示に選ぶ"
        : "AI依頼の取消を要求",
    security: localAccess,
    parameters: [
      ...[...path.matchAll(/:(\w+)/gu)].map(([, name]) => ({
        name,
        in: "path",
        required: true,
        schema: requestId,
      })),
      {
        name: "X-CRDD-Action-Token",
        in: "header",
        required: true,
        schema: string,
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: false,
            required: start
              ? ["requestId", "mode", "prompt"]
              : operation === "select"
                ? ["requestId"]
                : [],
            properties: start
              ? {
                  requestId,
                  mode: { enum: ["read_only_advice", "workspace_edit"] },
                  prompt: string,
                  workType: nullableString,
                  workspaceId: nullableString,
                  allowedPaths: nullableString,
                  choice: { type: "object" },
                }
              : operation === "select"
                ? { requestId }
                : {},
          },
        },
      },
    },
    responses: start
      ? {
          "201": json,
          "409": { ...json, description: "開始は受理されなかった。" },
          ...writeErrors,
        }
      : writeResponses,
  };
}

const recordPaths: Record<string, Record<string, unknown>> = {};
const recordTools = getTopicMeetingToolDefinitions("required");
const recordAccessResponses = {
  "401": { description: "共有の接続資格を確認できない。" },
  "404": { description: "指定した対象はこの接続から利用できない。" },
};
for (const { method, path, kind, operation } of topicMeetingResources) {
  const pathname = path.replace(/:(\w+)/gu, "{$1}");
  const toolName: `crdd.${string}` =
    operation === "treat-outcome"
      ? "crdd.treat_meeting_outcome"
      : `crdd.${operation}_${kind}${operation === "list" ? "s" : ""}`;
  const definition = recordTools.find(({ name }) => name === toolName);
  if (!definition) throw new Error("record_openapi_tool_missing");
  const { properties, required, ...schema } = definition.inputSchema;
  const pathFields = [...path.matchAll(/:(\w+)/gu)].map(
    (match) => match[1] as string,
  );
  const schemaFields: Record<string, unknown> = properties;
  const idField = `${kind}Id`;
  const parameters: object[] = pathFields.map((name) => ({
    name,
    in: "path",
    required: true,
    schema:
      schemaFields[name] ??
      (name === idField ? schemaFields.id : undefined) ??
      string,
  }));
  const excluded = new Set(pathFields);
  if (excluded.has(idField)) excluded.add("id");
  const bodyProperties = Object.fromEntries(
    Object.entries(properties).filter(([field]) => !excluded.has(field)),
  );
  if (method === "get")
    for (const [name, field] of Object.entries(bodyProperties)) {
      if (!field || typeof field !== "object")
        throw new Error("record_openapi_field_invalid");
      parameters.push(query(name, false, field));
    }
  recordPaths[pathname] ??= {};
  recordPaths[pathname][method] = {
    operationId: operationForTool(toolName),
    summary: definition.title,
    description:
      operation === "get"
        ? `${definition.description} 応答のrepositoryIdは本文の情報源、writableは現在の操作可否の表示用であり、書込み時は再認可する。`
        : definition.description,
    security: localAccess,
    parameters,
    ...(method === "get"
      ? {}
      : {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  ...schema,
                  properties: bodyProperties,
                  required: required.filter((name) => !excluded.has(name)),
                },
              },
            },
          },
        }),
    responses:
      method === "get"
        ? {
            ...readResponses,
            ...recordAccessResponses,
            "503": { description: "現在の文書や公開条件を確認できない。" },
          }
        : {
            ...writeErrors,
            ...recordAccessResponses,
            [operation === "create" ? "201" : "200"]: json,
            "409": { description: "保存条件または現在の改訂が一致しない。" },
            "415": { description: "JSON以外は受付しない。" },
          },
  };
}

const workspacePaths: Record<string, Record<string, unknown>> = {};
for (const { method, path, operation } of workspaceResources) {
  const pathname = path.replace(/:(\w+)/gu, "{$1}");
  const schema = workspaceInputSchema(operation);
  const parameters: object[] = [];
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(schema.properties)) {
    if (pathname.includes(`{${name}}`)) {
      parameters.push({ name, in: "path", required: true, schema: field });
      continue;
    }
    if (method === "get") {
      parameters.push(
        query(
          name,
          !["cursor", "limit"].includes(name),
          name === "cursor"
            ? string
            : name === "limit"
              ? { ...field, default: 20 }
              : field,
        ),
      );
      continue;
    }
    properties[name] = field;
    if (schema.required.includes(name)) required.push(name);
  }
  workspacePaths[pathname] ??= {};
  workspacePaths[pathname][method] = {
    operationId: operationForTool(MCP_WORKSPACE_TOOLS[operation]),
    summary: `Workspace: ${operation}`,
    security: localAccess,
    parameters,
    ...(method === "get"
      ? {}
      : {
          description:
            "同一OriginのJSON受付。対象と操作はURLとHTTPメソッドで指定する。",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required,
                  properties,
                },
              },
            },
          },
        }),
    responses:
      operation === "create"
        ? {
            ...writeResponses,
            "200": { ...json, description: "作成完了が確定しなかった操作結果" },
            "201": { ...json, description: "作成済みのWorkspace" },
          }
        : method === "get"
          ? readResponses
          : writeResponses,
  };
}

const definitionFields = { ...definitionReadFields, ...definitionWriteFields };
const definitionPaths: Record<string, Record<string, unknown>> = {};
const definitionId = {
  type: "string",
  pattern: RESOURCE_ID.source,
};
const definitionHash = { type: "string", pattern: "^[a-f0-9]{64}$" };
for (const [key, route] of Object.entries(executionDefinitionResources)) {
  const operation = key as keyof typeof definitionFields;
  const pathname = route.path.replace(/:(\w+)/gu, "{$1}");
  const parameters = [...pathname.matchAll(/\{(\w+)\}/gu)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: definitionId,
  }));
  const read = route.method === "get";
  const bodyFields = definitionFields[operation].filter(
    (field) => !pathname.includes(`{${field}}`),
  );
  const properties: Record<string, object> = {
    expectedAbsence: { const: true },
    expected: {
      type: "object",
      additionalProperties: false,
      required: ["revision", "payloadSha256"],
      properties: {
        revision: { type: "integer", minimum: 0 },
        payloadSha256: definitionHash,
      },
    },
    expectedDefinitionHash:
      operation === "plan.save"
        ? { anyOf: [definitionHash, { type: "null" }] }
        : definitionHash,
    definition: { type: "object" },
  };
  definitionPaths[pathname] ??= {};
  definitionPaths[pathname][route.method] = {
    operationId: operationForTool(route.tool),
    summary: `実行定義: ${operation}`,
    security: localAccess,
    parameters:
      operation === "tasks"
        ? [...parameters, query("queueId", false, definitionId)]
        : parameters,
    ...(!read && {
      description: "同一オリジンのJSONを受け付ける。要求は実行を開始しない。",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: bodyFields,
              properties: Object.fromEntries(
                bodyFields.map((name) => [name, properties[name]]),
              ),
            },
          },
        },
      },
    }),
    responses: read
      ? readResponses
      : {
          ...writeResponses,
          "413": { description: "要求本文が上限を超えた。" },
          ...(operation === "initialize" && {
            "201": { ...json, description: "実行定義を作成した。" },
          }),
        },
  };
}

/** 指定されたHTTPクエリーを記述する。実際の検証は各Routeで行う。 @trace ARCH-000012 */
function query(name: string, required = false, schema: object = string) {
  return { name, in: "query", required, schema };
}

const projectListParameters = [
  query("repositoryId"),
  query("q"),
  query("state", false, {
    type: "string",
    enum: ["complete", "partial", "conflicting"],
  }),
  query("cursor"),
  query("limit", false, { type: "integer", minimum: 1, maximum: 50 }),
];
const activityParameters = [
  { name: "repositoryId", in: "path", required: true, schema: string },
  query("cursor"),
  query("limit", false, {
    type: "integer",
    minimum: 1,
    maximum: 50,
    default: 20,
  }),
];

// HTTPの通信契約。操作別の業務入力・認可・保存条件は実装Ownerに残す。
const openApiDocument = {
  openapi: "3.1.1",
  info: {
    title: "CRDD Server HTTP API",
    version: "0.22",
    description:
      "単体loopback配置のHTTP操作の開発用参照。共有のログイン・管理操作、BrowserのHTML・静的資産、MCP JSON-RPCは対象外。AI実行は文書を有効にするだけでは利用できない。",
  },
  servers: [{ url: "/", description: "単体loopback配置（--docs）" }],
  paths: {
    "/.well-known/crdd-workbench-health": {
      get: {
        operationId: "readWorkbenchHealth",
        summary: "HTTP入口の稼働状態を取得",
        description:
          "疎通結果であり、AI・Repository・復旧状態の正常性を証明しない。",
        security: [],
        responses: readResponses,
      },
    },
    [projectContextRoutes.list]: {
      get: {
        operationId: operationForTool(MCP_PROJECT_CONTEXT_LIST_TOOL),
        summary: "認可されたProjectの一覧を取得",
        description:
          "現在許可された情報源のIDと状態を返す。検索・ページ指定があるときは継続位置も返す。Project Contextの本文は詳細リソースで取得する。",
        security: localAccess,
        parameters: projectListParameters,
        responses: readResponses,
      },
      head: {
        operationId: "headProjectList",
        summary: "認可されたProjectの一覧を本文なしで確認",
        security: localAccess,
        parameters: projectListParameters,
        responses: headResponses,
      },
    },
    [projectContextRoutes.project.replace(/:(\w+)/gu, "{$1}")]: {
      get: {
        operationId: "get_project",
        summary: "Projectの認可された情報源を取得",
        security: localAccess,
        parameters: [
          { name: "projectId", in: "path", required: true, schema: string },
        ],
        responses: readResponses,
      },
    },
    [projectContextRoutes.detail.replace(/:(\w+)/gu, "{$1}")]: {
      get: {
        operationId: operationForTool(MCP_PROJECT_CONTEXT_GET_TOOL),
        summary: "指定リポジトリのProject Contextを取得",
        security: localAccess,
        parameters: ["repositoryId", "projectId"].map((name) => ({
          name,
          in: "path",
          required: true,
          schema: string,
        })),
        responses: readResponses,
      },
    },
    [artifactResources.change.replace(/:(\w+)/gu, "{$1}")]: {
      get: {
        operationId: "get_change_document",
        summary: "指定リポジトリの変更正本文書を取得",
        security: localAccess,
        parameters: ["repositoryId", "changeId"].map((name) => ({
          name,
          in: "path",
          required: true,
          schema: string,
        })),
        responses: readResponses,
      },
    },
    [artifactResources.owner.replace(/:(\w+)/gu, "{$1}")]: {
      get: {
        operationId: "get_owner_artifact",
        summary: "指定リポジトリの公開対象文書を取得",
        security: localAccess,
        parameters: [
          { name: "repositoryId", in: "path", required: true, schema: string },
          query("path", true),
        ],
        responses: readResponses,
      },
    },
    [workbenchContextPath]: {
      get: {
        operationId: "readWorkbenchContext",
        summary: "Workbench共通の起動先またはログイン案内を取得",
        description: "概要・リポジトリ一覧・文書本文は含まない。",
        security: localAccess,
        responses: readResponses,
      },
    },
    "/api/workbench/overview": {
      get: {
        operationId: "readWorkbenchOverview",
        summary: "現在表示可能なWorkbench投影を取得",
        description: "共通画面または指定リポジトリの概要を取得する。",
        security: localAccess,
        parameters: [
          ...["repositoryId", "topicCursor", "meetingCursor"].map((name) =>
            query(name),
          ),
        ],
        responses: {
          ...readResponses,
          "200": {
            ...json,
            description:
              "画面応答のcontractはcrdd/workbench/view/v1。mainはprojectData、accessは接続画面の情報を返す。実行活動・作業ツリーの一覧と差分・各詳細・書込み結果は専用リソースで取得する。",
          },
        },
      },
    },
    ...definitionPaths,
    ...recordPaths,
    ...Object.fromEntries(
      [
        ...Object.entries(aiRequestReadRoutes).map(([kind, path]) => [
          path.replace(/:(\w+)/gu, "{$1}"),
          {
            get: {
              operationId:
                kind === "current" ? "readCurrentAiRequest" : "getAiRequest",
              summary:
                kind === "current"
                  ? "指定リポジトリの現在のAI依頼を取得"
                  : "指定したAI依頼を取得",
              description:
                "画面再構築や新たな依頼の開始・取消は行わない。共有では現在許可された接続の既存実行先のみを照会する。",
              security: localAccess,
              parameters: [...path.matchAll(/:(\w+)/gu)].map(([, name]) => ({
                name,
                in: "path",
                required: true,
                schema: string,
              })),
              responses: {
                ...readResponses,
                "403": { description: "現在の接続から対象を利用できない。" },
              },
            },
          },
        ]),
        ...aiRequestWriteRoutes
          .filter(({ operation }) => operation !== "select")
          .map((route) => [
            route.path.replace(/:(\w+)/gu, "{$1}"),
            { post: aiRequestWriteOperation(route) },
          ]),
      ].map(([path, item]) => {
        const selection = aiRequestWriteRoutes.find(
          (route) => route.operation === "select",
        );
        return [
          path,
          selection && selection.path.replace(/:(\w+)/gu, "{$1}") === path
            ? { ...(item as object), put: aiRequestWriteOperation(selection) }
            : item,
        ];
      }),
    ),
    [aiSelectionRoute.replace(/:(\w+)/gu, "{$1}")]: {
      parameters: [
        { name: "repositoryId", in: "path", required: true, schema: string },
      ],
      get: {
        operationId: "readAiSelection",
        summary: "RepositoryのAI選定設定を取得",
        security: localAccess,
        responses: readResponses,
      },
      head: {
        operationId: "probeAiSelection",
        summary: "RepositoryのAI選定設定を本文なしで照会",
        security: localAccess,
        responses: {
          "200": { description: "取得を確認した。応答本文は返さない。" },
          "403": { description: "照会条件が成立しない。応答本文は返さない。" },
        },
      },
      put: {
        operationId: "saveAiSelection",
        summary: "RepositoryのAI選定設定を保存",
        description:
          "期待値と現在認可を検査する。初回はexpectedIdentityにnullを指定する。本文に対象リポジトリを指定しない。",
        security: localAccess,
        parameters: [
          {
            name: "X-CRDD-Action-Token",
            in: "header",
            required: true,
            schema: string,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedIdentity", "config"],
                properties: {
                  expectedIdentity: {
                    anyOf: [
                      { type: "null" },
                      { type: "string", pattern: "^[a-f0-9]{64}$" },
                    ],
                  },
                  config: { type: "object", description: "CRDDのAI選定設定。" },
                },
              },
            },
          },
        },
        responses: writeResponses,
      },
    },
    [executionActivityRoute.replace(/:(\w+)/gu, "{$1}")]: {
      get: {
        operationId: operationForTool(EXECUTION_ACTIVITY_TOOL),
        summary: "対象リポジトリの実行活動を取得",
        security: localAccess,
        parameters: activityParameters,
        responses: writeResponses,
      },
      head: {
        operationId: "headExecutionActivity",
        summary: "対象リポジトリの実行活動を本文なしで確認",
        security: localAccess,
        parameters: activityParameters,
        responses: { ...writeResponses, "200": headResponses["200"] },
      },
    },
    [executionStateRoute.replace(/:(\w+)/gu, "{$1}")]: {
      get: {
        operationId: operationForTool(objectiveRunTools.state),
        summary: "対象リポジトリの実行状態を取得",
        description:
          "認可済みProjectの実行状態を照会する。分離WorkspaceのQueueを明示した場合は、そのQueueの受付時改訂を指定する。Queueを省略して複数Graphが該当する場合は一つを推定しない。取消済みQueueを実行可能とは表示しない。同じサーバーが所有する実行の場合は、所有者にだけ現在の起動識別子 launchId を返す。",
        security: localAccess,
        parameters: [
          { name: "repositoryId", in: "path", required: true, schema: string },
          { name: "requestId", in: "path", required: true, schema: string },
          query("projectId", true),
          query("repositoryRevision", true),
          query("queueId", false, {
            type: "string",
            pattern: RESOURCE_ID.source,
          }),
        ],
        responses: writeResponses,
      },
    },
    ...Object.fromEntries(
      executionWriteRoutes.map((route) => {
        const { path, summary } = route;
        const tool =
          route.operation === "decision"
            ? executionDecisionTools[route.action]
            : route.operation === "cancel"
              ? objectiveRunTools.cancel
              : objectiveRunTools[route.action];
        const pathFields = [...path.matchAll(/:(\w+)/gu)].map(
          (match) => match[1] as string,
        );
        return [
          path.replace(/:(\w+)/gu, "{$1}"),
          {
            post: {
              operationId: operationForTool(tool),
              summary,
              description:
                "同一OriginのJSON受付。URLに含む識別子とoperationは本文に指定しない。",
              security: localAccess,
              parameters: [
                ...pathFields.map((name) => ({
                  name,
                  in: "path",
                  required: true,
                  schema: string,
                })),
                {
                  name: "X-CRDD-Action-Token",
                  in: "header",
                  required: true,
                  schema: string,
                },
              ],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema:
                      route.operation === "objective"
                        ? objectiveRequestSchema(pathFields)
                        : route.operation === "cancel"
                          ? objectiveCancellationSchema(pathFields)
                          : decisionRequestSchema(route.action, pathFields),
                  },
                },
              },
              responses:
                route.operation === "cancel"
                  ? {
                      "202": {
                        description:
                          "取消を要求した。実行や回収の終了を保証しない。",
                        content: {
                          "application/json": {
                            schema: {
                              type: "object",
                              additionalProperties: false,
                              required: ["status"],
                              properties: {
                                status: { const: "cancellation_requested" },
                              },
                            },
                          },
                        },
                      },
                      "400": writeResponses["400"],
                      "403": writeResponses["403"],
                      "503": writeResponses["503"],
                      "415": { description: "JSON以外は受付しない。" },
                    }
                  : {
                      ...writeResponses,
                      "415": { description: "JSON以外は受付しない。" },
                    },
            },
          },
        ];
      }),
    ),
    ...workspacePaths,
    [repositoryFilesRoutes.tree.replace(/:(\w+)/gu, "{$1}")]: {
      parameters: [
        { name: "repositoryId", in: "path", required: true, schema: string },
        query("directory"),
        query("cursor"),
      ],
      get: {
        operationId: "readRepositoryTree",
        summary: "対象リポジトリの作業ツリーを取得",
        responses: readResponses,
      },
      head: {
        operationId: "headRepositoryTree",
        summary: "対象リポジトリの作業ツリーを本文なしで確認",
        responses: headResponses,
      },
    },
    [repositoryFilesRoutes.diff.replace(/:(\w+)/gu, "{$1}")]: {
      parameters: [
        { name: "repositoryId", in: "path", required: true, schema: string },
        query("path", true),
      ],
      get: {
        operationId: "readRepositoryFileDiff",
        summary: "対象リポジトリのファイル差分を取得",
        responses: readResponses,
      },
      head: {
        operationId: "headRepositoryFileDiff",
        summary: "対象リポジトリのファイル差分を本文なしで確認",
        responses: headResponses,
      },
    },
    ...repositoryWriteDocumentation,
  },
} as const;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRDD Server API</title><link rel="stylesheet" href="/docs/swagger-ui.css"></head><body><div id="swagger-ui"></div><script defer src="/docs/swagger-ui-bundle.js"></script><script defer src="/docs/swagger-initializer.js"></script></body></html>`;
const initializer = `SwaggerUIBundle({
  dom_id: "#swagger-ui",
  url: "/openapi.json",
  validatorUrl: null,
  supportedSubmitMethods: [],
  persistAuthorization: false,
  queryConfigEnabled: false
});`;

/** 固定仕様とSwagger UIを起動時に読み込む。欠落時は待受を始めない。 @trace ARCH-000012 */
export async function createApiDocumentation() {
  const require = createRequire(import.meta.url);
  const [css, script] = await Promise.all([
    readFile(require.resolve("swagger-ui-dist/swagger-ui.css")),
    readFile(require.resolve("swagger-ui-dist/swagger-ui-bundle.js")),
  ]);
  const assets = new Map<string, readonly [string, Buffer]>([
    [
      "/openapi.json",
      [
        "application/json; charset=utf-8",
        Buffer.from(JSON.stringify(openApiDocument)),
      ],
    ],
    ["/docs", ["text/html; charset=utf-8", Buffer.from(html)]],
    ["/docs/swagger-ui.css", ["text/css; charset=utf-8", css]],
    ["/docs/swagger-ui-bundle.js", ["text/javascript; charset=utf-8", script]],
    [
      "/docs/swagger-initializer.js",
      ["text/javascript; charset=utf-8", Buffer.from(initializer)],
    ],
  ]);

  return (request: IncomingMessage, response: ServerResponse): boolean => {
    const asset = assets.get(request.url ?? "");
    if (!asset) return false;
    setResponseHeaders(response);
    const port = request.socket.localPort;
    if (
      request.socket.remoteAddress !== "127.0.0.1" ||
      typeof port !== "number" ||
      ![
        `127.0.0.1:${port}`,
        `localhost:${port}`,
        ...(port === 80 ? ["127.0.0.1", "localhost"] : []),
      ].some((host) => matchesRequestHost(request, host)) ||
      [
        "forwarded",
        "x-forwarded-host",
        "x-forwarded-proto",
        "x-forwarded-for",
      ].some((key) => request.headers[key] !== undefined) ||
      request.headers["sec-fetch-site"] === "cross-site"
    ) {
      response.statusCode = 403;
      response.end();
      return true;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD");
      response.end();
      return true;
    }
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    response.statusCode = 200;
    response.setHeader("Content-Type", asset[0]);
    response.setHeader("Content-Length", asset[1].byteLength);
    response.end(request.method === "GET" ? asset[1] : undefined);
    return true;
  };
}
