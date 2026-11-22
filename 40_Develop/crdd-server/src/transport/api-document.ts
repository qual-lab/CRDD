/**
 * CRDD Serverが既に提供するHTTPインターフェースを記述する。
 * @responsibility 既存のURL、搬送形式、認証条件、失敗の意味をOpenAPIとして公開する。
 * @trace ARCH-000012
 * @boundary 外部のHTTP契約と各Routeの実行・入力検査。
 * @security 実資格、Host情報、非公開Path、MCP Toolの入出力は含めない。
 */

import { readFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { executionHttpPaths, setResponseHeaders } from "./api-server.ts";

const string = { type: "string" } as const;
const bearer = [{ bearerAuth: [] }];
const localAccess: typeof bearer = [];
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
const writeResponses = {
  "200": json,
  "400": { description: "入力又は要求の受理条件が不成立。" },
  "403": { description: "現在のアクセス条件又は搬送条件が不成立。" },
  "503": {
    description: "結果の確定又は安全な返却が不能。再送許可を意味しない。",
  },
  default: { description: "操作固有の拒否又は内部失敗。" },
};

/** 指定されたHTTPクエリーを記述する。実際の検証は各Routeで行う。 @trace ARCH-000012 */
function query(name: string, required = false, schema: object = string) {
  return { name, in: "query", required, schema };
}

/** 既存の同一Origin用Formと処置結果を記述する。 @trace ARCH-000012 */
function action(
  operationId: string,
  summary: string,
  description: string,
  fields: readonly string[],
  options: Readonly<{
    required?: readonly string[];
    security?: typeof bearer;
    redirect?: boolean;
    errorStatuses?: readonly ("400" | "403" | "503")[];
  }> = {},
) {
  const {
    required = [],
    security = localAccess,
    redirect = false,
    errorStatuses = ["400", "503"],
  } = options;
  const properties = Object.fromEntries(
    fields.map((name) => [
      name,
      name === "workspaceIds"
        ? { type: "array", items: string }
        : name === "token"
          ? { ...string, writeOnly: true }
          : string,
    ]),
  );
  return {
    operationId,
    summary,
    description:
      "同一Originと取得済みの操作トークンが必要。Formの必須項目は配置と操作種別によって異なる。 " +
      description,
    security,
    requestBody: {
      required: true,
      content: {
        "application/x-www-form-urlencoded": {
          schema: {
            type: "object",
            properties: {
              actionToken: { type: "string", writeOnly: true },
              ...properties,
            },
            required: ["actionToken", ...required],
          },
        },
      },
    },
    responses: {
      "200": json,
      ...(redirect
        ? { "303": { description: "画面の再読取りへ遷移する。" } }
        : {}),
      ...Object.fromEntries(
        errorStatuses.map((status) => [status, writeResponses[status]]),
      ),
      default: writeResponses.default,
    },
  };
}

// HTTPの通信契約。操作別の業務入力・認可・保存条件は実装Ownerに残す。
export const openApiDocument = {
  openapi: "3.1.1",
  info: {
    title: "CRDD Server HTTP API",
    version: "0.22",
    description:
      "単体loopback配置のHTTP操作の開発用参照。共有配置の認証契約ではない。鍵・管理・AI等の機能は、文書を有効にするだけでは利用可能にならない。BrowserのHTML・静的資産、退役Route、MCP JSON-RPCは対象外。",
  },
  servers: [{ url: "/", description: "単体loopback配置（--docs）" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "管理機能の接続が構成済みの場合に、現在のAccess Management資格を使用する。リポジトリの公開・内容権限を代替しない。",
      },
    },
  },
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
    "/api/workbench/view": {
      get: {
        operationId: "readWorkbenchView",
        summary: "現在表示可能なWorkbench投影を取得",
        description:
          "起動リポジトリの表示を取得する。選択した成果物の対象が一致しない場合は開示しない。",
        security: localAccess,
        parameters: [
          ...[
            "route",
            "id",
            "repositoryId",
            "path",
            "topicCursor",
            "meetingCursor",
            "treeDirectory",
            "treeCursor",
            "diffPath",
            "activityCursor",
          ].map((name) => query(name)),
        ],
        responses: {
          ...readResponses,
          "200": {
            ...json,
            description:
              "画面応答のcontractはcrdd/workbench/view/v1。viewで種別を区別する。mainはprojectData（Project表示データ）、executionActivity（実行の進行と履歴）、recordActionResult（記録操作結果）を返す。",
          },
        },
      },
    },
    [executionHttpPaths.definition]: {
      get: {
        operationId: "getExecutionDefinition",
        summary: "実行計画またはObjective・Task定義を取得",
        description: "起動リポジトリのProjectとMilestoneを指定する。",
        security: localAccess,
        parameters: [
          query("operation", true, {
            type: "string",
            enum: ["plan", "objectives", "tasks"],
          }),
          query("projectId", true),
          query("milestoneId", true),
        ],
        responses: readResponses,
      },
      post: action(
        "manageExecutionDefinition",
        "実行定義を初期化・更新",
        "commandはJSON文字列。初期化、計画保存、Objective・Taskの登録・更新・削除に限定する。実行は開始しない。",
        ["command"],
        { required: ["command"], errorStatuses: ["400", "403", "503"] },
      ),
    },
    "/api/ai-request": {
      get: {
        operationId: "readCurrentAiRequest",
        summary: "現在のAI依頼の進行・結果だけを取得",
        description:
          "起動リポジトリの現在の依頼だけを照会する。画面や実行履歴を再構築せず、起動・取消も行わない。",
        security: localAccess,
        responses: readResponses,
      },
      post: action(
        "applyAiRequest",
        "AI依頼を明示受付・取消",
        "起動時に接続された既存実行Ownerが必要。操作種別によって入力項目が異なる。",
        [
          "operation",
          "requestId",
          "mode",
          "workType",
          "choice",
          "prompt",
          "allowedPaths",
          "workspaceId",
        ],
        { required: ["operation"], redirect: true },
      ),
    },
    "/api/ai-selection": {
      get: {
        operationId: "readAiSelection",
        summary: "RepositoryのAI選定設定を取得",
        security: localAccess,
        responses: readResponses,
      },
      post: action(
        "saveAiSelection",
        "RepositoryのAI選定設定を保存",
        "configはJSON文字列。期待する同一性と現在認可を検査する。",
        ["expectedIdentity", "config"],
        {
          required: ["expectedIdentity", "config"],
          errorStatuses: ["400", "403", "503"],
        },
      ),
    },
    [executionHttpPaths.state]: {
      get: {
        operationId: "getExecutionState",
        summary: "対象リポジトリの実行状態を取得",
        description: "起動リポジトリの実行状態を照会する。",
        security: localAccess,
        parameters: [
          query("requestId", true),
          query("projectId", true),
          query("repositoryRevision", true),
        ],
        responses: writeResponses,
      },
    },
    [executionHttpPaths.objective]: {
      post: action(
        "runObjective",
        "Objectiveの実行を開始または再開",
        "commandは起動リポジトリに対するObjective実行入力のJSON文字列。",
        ["command"],
        {
          required: ["command"],
          errorStatuses: ["400", "403", "503"],
        },
      ),
    },
    [executionHttpPaths.decision]: {
      post: action(
        "submitDecision",
        "実行に関する判断を送信",
        "commandは起動リポジトリに対する判断操作入力のJSON文字列。",
        ["command"],
        {
          required: ["command"],
          errorStatuses: ["400", "403", "503"],
        },
      ),
    },
    "/api/access": {
      get: {
        operationId: "readAccess",
        summary: "現在のアクセス・管理状態を取得",
        description:
          "管理接続が構成済みの場合だけ、現在資格と操作別の認可に従って結果を返す。HEADはGETと同じ操作ではない。",
        security: bearer,
        parameters: [
          query("view", true, {
            type: "string",
            enum: ["current", "users", "roles", "repositories", "exposure"],
          }),
        ],
        responses: readResponses,
      },
      post: action(
        "manageAccess",
        "アクセス管理を明示更新",
        "管理操作別の入力と改訂契約を使用する。",
        [
          "operation",
          "operationId",
          "expectedRevision",
          "userId",
          "username",
          "plannedRole",
          "currentRole",
          "nextRole",
          "targetRole",
          "workspaceIds",
          "repositoryId",
          "repositoryRoot",
        ],
        {
          required: ["operation", "operationId", "expectedRevision"],
          security: bearer,
        },
      ),
    },
    "/api/workspace": {
      post: action(
        "manageWorkspace",
        "Workspaceの明示操作",
        "commandは操作別JSON文字列で、現在の対象と認可を検査する。",
        ["repositoryId", "command"],
        { required: ["repositoryId", "command"] },
      ),
    },
    "/api/repository": {
      post: action(
        "manageRepository",
        "Repositoryの明示操作",
        "起動リポジトリへの操作。種別ごとに受付項目が異なる。",
        [
          "operation",
          "repositoryId",
          "path",
          "message",
          "destination",
          "branch",
          "revisionIdentity",
          "humanConfirmed",
        ],
        { required: ["operation"], redirect: true },
      ),
    },
    "/api/records": {
      post: action(
        "manageRecord",
        "Topic・Meetingを明示更新",
        "操作別に本文、改訂、関係付けや完了条件を指定する。",
        [
          "kind",
          "operation",
          "repositoryId",
          "id",
          "expectedRevision",
          "markdown",
          "confirmed",
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
          "changeId",
          "reason",
          "remainingResponsibility",
        ],
        { redirect: true },
      ),
    },
    "/api/access/credentials": {
      post: action(
        "manageCredential",
        "接続資格を明示処置",
        "管理認可と既存の発行・失効・交換条件を検査する。秘密値の実例は掲載しない。",
        [
          "operation",
          "credentialId",
          "userId",
          "expectedRevision",
          "displayedOldCredentialIds",
          "confirmed",
          "previousRecoveryId",
        ],
        {
          required: ["operation", "userId", "expectedRevision"],
          security: bearer,
        },
      ),
    },
    "/api/access/connection": {
      post: action(
        "manageConnection",
        "ブラウザ接続を開始・解除",
        "管理接続が構成済みの場合は現在の資格を検査する。認証情報をサーバー設定として保存する操作ではない。",
        ["operation", "token"],
        { required: ["operation"], errorStatuses: ["400"] },
      ),
    },
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
      ].includes(request.headers.host ?? "") ||
      request.rawHeaders.filter(
        (header, index) => index % 2 === 0 && header.toLowerCase() === "host",
      ).length !== 1 ||
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
