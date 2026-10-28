/**
 * Coreの実行依頼定義をDomainの一般CRUDへ直接接続する。
 * @packageDocumentation
 * @responsibility 閉じたTool入力、要求内認可、CASとDomain結果の搬送を所有する。
 * @trace ARCH-000008
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary MCPとDomainの一般定義操作。Coordinatorを読み込まない。
 * @security Root・認可関数・実行AuthorityはClientから受け取らない。
 */
import {
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  initializeRuntimeState,
  queryObjectives,
  queryPlan,
  queryTasks,
  savePlan,
  snapshotPlainRecord,
  updateObjective,
  updateTask,
  type RuntimeAccess,
} from "../../../domain-model/src/index.ts";
import {
  callKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../request/validation.ts";

export const MCP_RUNTIME_READ_TOOL = "crdd.get_runtime_definition" as const;
export const MCP_RUNTIME_MANAGE_TOOL =
  "crdd.manage_runtime_definition" as const;

/**
 * 当該RepositoryのCore操作を現在認可へ結ぶ。
 * @responsibility Host構成からだけRootと主体を渡す。
 * @trace ARCH-000013
 * @shape Repository IDと要求SignalからRuntimeAccess又はnull。
 * @invariant 要求間cache、JSONからのContext復元、暗黙実行なし。
 * @boundary Transport構成と内容認可Owner。
 * @security 拒否時は対象の存在を開示しない。
 * @compatibility 既存development権限だけを利用する。
 */
export type RuntimeContentAccessResolver = (
  repositoryId: string,
  signal: AbortSignal,
) => RuntimeAccess | null;

const READ_FIELDS = {
  plan: [],
  objectives: [],
  tasks: [],
} as const;
const WRITE_FIELDS = {
  initialize: ["expectedAbsence"],
  "plan.save": ["expected", "definition", "expectedDefinitionHash"],
  "objective.create": ["expected", "definition"],
  "objective.update": [
    "expected",
    "objectiveId",
    "definition",
    "expectedDefinitionHash",
  ],
  "objective.delete": ["expected", "objectiveId", "expectedDefinitionHash"],
  "task.create": ["expected", "definition"],
  "task.update": ["expected", "taskId", "definition", "expectedDefinitionHash"],
  "task.delete": ["expected", "taskId", "expectedDefinitionHash"],
} as const;

/**
 * 読取りと定義変更の固定Tool集合を返す。
 * @responsibility 一覧と実受付の操作名・必須fieldを一致させる。
 * @trace ARCH-000012
 * @input N/A: 固定した操作集合。
 * @returns 二つのToolと操作別の閉Schema。
 * @precondition 個別定義の意味検査はDomainが所有する。
 * @postcondition 承認・AI開始・Queue投入は一覧に含まない。
 * @effect N/A: 値構築だけ。
 * @failure N/A: 外部状態を参照しない。
 * @invariant CAS値を自動補完しない。
 * @boundary MCP Tool一覧とCore CRUD。
 * @security 任意Root・callback・資格入力なし。
 * @concurrency N/A: 共有可変状態なし。
 */
export function getMcpRuntimeToolDefinitions() {
  const id = { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" };
  const properties: Record<string, unknown> = {
    projectId: id,
    milestoneId: id,
    objectiveId: id,
    taskId: id,
    expectedAbsence: { const: true },
    expected: {
      type: "object",
      additionalProperties: false,
      required: ["revision", "payloadSha256"],
      properties: {
        revision: { type: "integer", minimum: 0 },
        payloadSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
    },
    expectedDefinitionHash: {
      type: ["string", "null"],
      pattern: "^[a-f0-9]{64}$",
    },
    definition: {
      type: "object",
      description:
        "Domain定義。Plan/Objectives/Taskの閉形式・DAG・PathはDomainが検査します。",
    },
  };
  return (
    [
      [MCP_RUNTIME_READ_TOOL, READ_FIELDS],
      [MCP_RUNTIME_MANAGE_TOOL, WRITE_FIELDS],
    ] as const
  ).map(([name, fields]) => ({
    name,
    title:
      name === MCP_RUNTIME_READ_TOOL
        ? "実行依頼の定義を確認"
        : "実行依頼の定義を明示編集",
    description:
      "Coreの定義保存だけを行います。CRDD文書の更新、AI起動、承認、Queue投入は行いません。保存不明・競合時は自動再送しません。",
    annotations: {
      readOnlyHint: name === MCP_RUNTIME_READ_TOOL,
      destructiveHint: name === MCP_RUNTIME_MANAGE_TOOL,
      idempotentHint: false,
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["repositoryId", "command"],
      properties: {
        repositoryId: id,
        command: {
          oneOf: Object.entries(fields).map(([operation, extra]) => {
            const keys = ["projectId", "milestoneId", ...extra];
            return {
              type: "object",
              additionalProperties: false,
              required: ["operation", ...keys],
              properties: {
                operation: { const: operation },
                ...Object.fromEntries(
                  keys.map((key) => [
                    key,
                    key === "expectedDefinitionHash" &&
                    operation !== "plan.save"
                      ? { type: "string", pattern: "^[a-f0-9]{64}$" }
                      : properties[key],
                  ]),
                ),
              },
            };
          }),
        },
      },
    },
  }));
}

/**
 * 当該要求のCore定義操作を一度だけDomainへ渡す。
 * @responsibility Tool種別・入力閉集合・開始前取消を確認し、Owner結果を再解釈せず返す。
 * @trace ARCH-000008
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input raw、resolve、signal: 元Protocol要求と信頼した現在認可解決。
 * @returns Domainの型付き結果、又は非開示Protocol拒否。
 * @precondition ContextはHostが現在権限とRootへ結合する。
 * @postcondition 保存のunknownと回復参照、競合、不存在を維持する。
 * @effect 明示した一つの一般CRUD／Queryだけ。
 * @failure 入力不正は-32602、開始前取消は-32800、認可・構成不明は-32603。
 * @invariant 保存後の通信取消・応答喪失を未保存又はrollbackに変換しない。
 * @boundary MCP→現在内容認可→Domain共有Writer。
 * @security 生例外・Root・Token・内部Snapshotを公開しない。
 * @concurrency 同期保存をjoinして結果を返す。新Worker・再送を作らない。
 */
export async function handleMcpRuntimeRequest(
  raw: unknown,
  resolve: RuntimeContentAccessResolver,
  signal: AbortSignal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(raw);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = snapshotPlainRecord(request.params, callKeys);
  const args =
    params &&
    snapshotPlainRecord(params.arguments, new Set(["repositoryId", "command"]));
  if (
    !params ||
    !inspectMcpEnvelope(params._meta) ||
    !args ||
    typeof args.repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(args.repositoryId)
  )
    return protocolError(request.id, -32602, "Invalid params");
  const fields =
    params.name === MCP_RUNTIME_READ_TOOL
      ? READ_FIELDS
      : params.name === MCP_RUNTIME_MANAGE_TOOL
        ? WRITE_FIELDS
        : null;
  const operation =
    fields &&
    Object.keys(fields).find(
      (name) =>
        snapshotPlainRecord(
          args.command,
          new Set([
            "operation",
            "projectId",
            "milestoneId",
            ...fields[name as keyof typeof fields],
          ]),
        )?.operation === name,
    );
  if (!fields || !operation)
    return protocolError(request.id, -32602, "Invalid params");
  const command = snapshotPlainRecord(
    args.command,
    new Set([
      "operation",
      "projectId",
      "milestoneId",
      ...fields[operation as keyof typeof fields],
    ]),
  );
  if (!command) return protocolError(request.id, -32602, "Invalid params");
  const { operation: ignoredOperation, ...input } = command;
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  try {
    const access = resolve(args.repositoryId, signal);
    if (!access) throw new Error("runtime_content_access_unavailable");
    if (signal.aborted)
      return protocolError(request.id, -32800, "Request cancelled");
    // 型castは検証ではない。Domain自身の閉形式・認可・CAS検査を省略せず呼ぶ。
    let result: unknown;
    switch (operation) {
      case "initialize":
        result = initializeRuntimeState(
          access,
          input as Parameters<typeof initializeRuntimeState>[1],
        );
        break;
      case "plan.save":
        result = savePlan(access, input as Parameters<typeof savePlan>[1]);
        break;
      case "objective.create":
        result = createObjective(
          access,
          input as Parameters<typeof createObjective>[1],
        );
        break;
      case "objective.update":
        result = updateObjective(
          access,
          input as Parameters<typeof updateObjective>[1],
        );
        break;
      case "objective.delete":
        result = deleteObjective(
          access,
          input as Parameters<typeof deleteObjective>[1],
        );
        break;
      case "task.create":
        result = createTask(access, input as Parameters<typeof createTask>[1]);
        break;
      case "task.update":
        result = updateTask(access, input as Parameters<typeof updateTask>[1]);
        break;
      case "task.delete":
        result = deleteTask(access, input as Parameters<typeof deleteTask>[1]);
        break;
      case "plan":
        result = queryPlan(access, input as Parameters<typeof queryPlan>[1]);
        break;
      case "objectives":
        result = queryObjectives(
          access,
          input as Parameters<typeof queryObjectives>[1],
        );
        break;
      case "tasks":
        result = queryTasks(access, input as Parameters<typeof queryTasks>[1]);
        break;
      default:
        return protocolError(request.id, -32602, "Invalid params");
    }
    return protocolComplete(request.id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch {
    return protocolError(
      request.id,
      -32603,
      "Runtime definition outcome unavailable",
    );
  }
}
