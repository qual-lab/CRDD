/**
 * CRDD Serverが既に提供するHTTPインターフェースを記述する。
 * @responsibility 既存のURL、搬送形式、認証条件、失敗の意味をOpenAPIとして公開する。
 * @trace ARCH-000012
 * @boundary 外部のHTTP契約と各Routeの実行・入力検査。
 * @security 実資格、Host情報、非公開Path、MCP Toolの入出力は含めない。
 */

const string = { type: "string" } as const;
const bearer = [{ bearerAuth: [] }];
const localOrBearer = [{}, ...bearer];
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
    security = localOrBearer,
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
      "既存HTTP操作の開発用参照。BrowserのHTML・静的資産、退役Route、MCP JSON-RPCは対象外。配置や認可を変更しない。",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "共有接続で現在のAccess Management資格を使用する。リポジトリの公開・内容権限を代替しない。",
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
    "/api/workbench-view": {
      get: {
        operationId: "readWorkbenchView",
        summary: "現在表示可能なWorkbench投影を取得",
        description:
          "共有モードの未認証応答は接続用表示であり、Repository内容は含まない。対象指定により非開示拒否となる。",
        security: localOrBearer,
        parameters: [
          ...[
            "route",
            "id",
            "repositoryId",
            "path",
            "documentQuery",
            "portfolioQuery",
            "portfolioState",
            "portfolioCursor",
            "topicCursor",
            "meetingCursor",
            "treeDirectory",
            "treeCursor",
            "diffPath",
            "runtimeCursor",
          ].map((name) => query(name)),
        ],
        responses: readResponses,
      },
    },
    "/api/runtime-definition": {
      get: {
        operationId: "readRuntimeDefinition",
        summary: "実行計画またはObjective・Task定義を取得",
        description:
          "共有モードではrepositoryIdと資格が必要。Repository単体モードではrepositoryIdを送らない。",
        security: localOrBearer,
        parameters: [
          query("operation", true, {
            type: "string",
            enum: ["plan", "objectives", "tasks"],
          }),
          query("projectId", true),
          query("milestoneId", true),
          query("repositoryId"),
        ],
        responses: readResponses,
      },
      post: action(
        "writeRuntimeDefinition",
        "実行定義を初期化・更新",
        "commandはJSON文字列。初期化、計画保存、Objective・Taskの登録・更新・削除に限定する。実行は開始しない。共有モードではrepositoryIdが必要。",
        ["repositoryId", "command"],
        { required: ["command"], errorStatuses: ["400", "403", "503"] },
      ),
    },
    "/api/ai-selection": {
      get: {
        operationId: "readAiSelection",
        summary: "RepositoryのAI選定設定を取得",
        security: localOrBearer,
        parameters: [query("repositoryId")],
        responses: readResponses,
      },
    },
    "/api/access-management": {
      get: {
        operationId: "readAccessManagement",
        summary: "現在のアクセス・管理状態を取得",
        description:
          "共有接続の現在資格と操作別の認可に従う。管理用のHEADはGETと同じ操作ではない。",
        security: bearer,
        parameters: [
          query("view", true, {
            type: "string",
            enum: ["current", "users", "roles", "repositories", "exposure"],
          }),
        ],
        responses: readResponses,
      },
    },
    "/workspace/action": {
      post: action(
        "applyWorkspaceAction",
        "Workspaceの明示操作",
        "commandは操作別JSON文字列で、現在の対象と認可を検査する。",
        ["repositoryId", "command"],
        { required: ["repositoryId", "command"] },
      ),
    },
    "/repository/action": {
      post: action(
        "applyRepositoryAction",
        "Repositoryの明示操作",
        "種別ごとに受付項目が異なり、局所表示と共有接続で応答が異なる。",
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
    "/topic-meeting/action": {
      post: action(
        "applyTopicMeetingAction",
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
    "/ai-selection/action": {
      post: action(
        "saveAiSelection",
        "RepositoryのAI選定設定を保存",
        "configはJSON文字列。期待する同一性と現在認可を検査する。",
        ["repositoryId", "expectedIdentity", "config"],
        {
          required: ["expectedIdentity", "config"],
          errorStatuses: ["400", "403", "503"],
        },
      ),
    },
    "/ai-request/action": {
      post: action(
        "applyAiRequest",
        "AI依頼を明示受付・取消",
        "起動時に接続された既存実行Ownerが必要。操作種別によって入力項目が異なる。",
        [
          "operation",
          "repositoryId",
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
    "/access-management/action": {
      post: action(
        "applyAccessManagementAction",
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
    "/connection-credentials/action": {
      post: action(
        "applyConnectionCredentialAction",
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
    "/local-connection/action": {
      post: action(
        "applyLocalConnection",
        "ブラウザ接続を開始・解除",
        "共有モードの接続時には現在の資格が必要。認証情報をサーバー設定として保存する操作ではない。",
        ["operation", "token"],
        { required: ["operation"], errorStatuses: ["400"] },
      ),
    },
  },
} as const;
