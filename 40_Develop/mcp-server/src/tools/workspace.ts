/**
 * Workspaceの二つの明示ToolをCoordinatorへ直接接続する。
 * @responsibility 閉入力・遅延認可解決・取消とOwner結果の搬送。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary MCP ProtocolとWorkspace Owner。
 */
import { snapshotPlainRecord } from "../request/snapshot.ts";
import {
  callKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  protocolComplete,
  protocolError,
} from "../request/validation.ts";

/**
 * 要求内だけの現在Workspaceアクセス解決を定義する。
 * @responsibility Host指定をClientから受けずServerに限定する。
 * @trace ARCH-000013
 * @shape Root・Projectとfresh認可callback又は非開示null。
 * @invariant 次要求へ再利用しない。
 * @boundary 信頼したServer構成内部。
 * @security Root・関数はwireに載せない。
 * @compatibility AMの内容領域とGit Workspaceを分離する。
 */
export type WorkspaceAccessResolver = (repositoryId: string) => Readonly<{
  ownerRoot: string;
  projectId: string;
  authorize: () => boolean;
}> | null;

export const MCP_WORKSPACE_READ_TOOL = "crdd.get_workspace" as const;
export const MCP_WORKSPACE_MANAGE_TOOL = "crdd.manage_workspace" as const;

/**
 * Tool一覧の操作別閉Schemaを返す。
 * @responsibility 読取りと明示書込みをClientへ区別する。
 * @trace ARCH-000012
 * @input N/A: 固定契約。
 * @returns 二Toolの記述。
 * @precondition N/A: 外部状態なし。
 * @postcondition 任意Root・callback・参照解放申告はSchemaにない。
 * @effect N/A: 値構築。
 * @failure N/A: 外部処理なし。
 * @invariant 自動採用や自動再送を案内しない。
 * @boundary MCP Tool一覧。
 * @security SchemaはAuthorityを発行しない。
 * @concurrency N/A: 局所値。
 */
export function getMcpWorkspaceToolDefinitions() {
  return [MCP_WORKSPACE_READ_TOOL, MCP_WORKSPACE_MANAGE_TOOL].map((name) => ({
    name,
    title:
      name === MCP_WORKSPACE_READ_TOOL
        ? "作業領域と変更を確認"
        : "作業領域を明示操作",
    description:
      "人間が指定した対象・内容だけを扱います。固定と採用は別操作です。Task完了から固定・採用・破棄を自動発行せず、失敗時も自動再送しません。",
    annotations: {
      readOnlyHint: name === MCP_WORKSPACE_READ_TOOL,
      destructiveHint: name === MCP_WORKSPACE_MANAGE_TOOL,
      idempotentHint: false,
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["repositoryId", "command"],
      properties: {
        repositoryId: {
          type: "string",
          pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
        },
        command: workspaceCommandSchema(name === MCP_WORKSPACE_READ_TOOL),
      },
    },
  }));
}

/**
 * 操作ごとの必須fieldを閉じたSchemaへ写す。
 * @responsibility 任意JSON操作を公開しない。
 * @trace ARCH-000012
 * @input readOnly: 読取りToolか。
 * @returns 操作ごとのoneOf。
 * @precondition 固定Tool集合のみ。
 * @postcondition 実値はOwnerの共通検査でも確認する。
 * @effect N/A: 値構築。
 * @failure N/A: 外部状態なし。
 * @invariant commandは任意Shellではない。
 * @boundary MCP Schema。
 * @security 既知fieldだけを受ける。
 * @concurrency N/A: 局所値。
 */
function workspaceCommandSchema(readOnly: boolean) {
  const actions: Record<string, string[]> = readOnly
    ? {
        list: ["cursor", "limit"],
        get: [],
        inspect: ["path"],
        "candidate-diff": ["path"],
      }
    : {
        create: ["baseCommit", "name"],
        select: [],
        rename: ["name"],
        hold: ["until"],
        discard: ["expectedHead", "discardChanges"],
        freeze: [
          "operationId",
          "baseCommit",
          "expectedHead",
          "selection",
          "candidateName",
          "relatedChangeIds",
        ],
        adopt: ["candidateCommit", "targetBranch", "expectedTargetHead"],
        "close-candidate": ["expectedCommit", "disposition"],
      };
  return {
    oneOf: Object.entries(actions).map(([operation, extra]) => {
      const keys = [
        "operation",
        "projectId",
        ...(operation === "list" ? [] : ["queueId", "workspaceId"]),
        ...(!readOnly ? ["expectedGeneration"] : []),
        ...extra,
      ];
      const properties = Object.fromEntries(
        keys.map((key) => [
          key,
          key === "operation"
            ? { const: operation }
            : key === "expectedGeneration"
              ? { type: "integer", minimum: 0 }
              : key === "limit"
                ? { type: "integer", minimum: 1, maximum: 50 }
                : key === "discardChanges"
                  ? { type: "boolean" }
                  : key === "relatedChangeIds"
                    ? {
                        type: "array",
                        maxItems: 20,
                        items: { type: "string", pattern: "^CHG-[0-9]{6}$" },
                      }
                    : key === "selection"
                      ? {
                          type: "array",
                          minItems: 1,
                          maxItems: 1000,
                          items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["path", "blobId", "mode"],
                            properties: {
                              path: { type: "string" },
                              blobId: { type: ["string", "null"] },
                              mode: { enum: ["100644", "100755", null] },
                            },
                          },
                        }
                      : [
                            "cursor",
                            "name",
                            "until",
                            "candidateName",
                            "expectedCommit",
                          ].includes(key)
                        ? { type: ["string", "null"] }
                        : { type: "string" },
        ]),
      );
      return {
        type: "object",
        additionalProperties: false,
        required: keys,
        properties,
      };
    }),
  };
}

/**
 * 閉入力を現在のRepository解決後に一回実行する。
 * @responsibility 入力不正・非許可・Owner故障・取消を混同しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input MCP要求、要求専用Resolver、Signal。
 * @returns MCP構造化結果又は固定エラー。
 * @precondition ResolverはServer構成が所有する。
 * @postcondition 待機後の取消・現在許可もOwnerが確認する。
 * @effect 明示されたOwner操作だけ。
 * @failure 不正は-32602、非開示拒否・Owner不明は-32603、開始前取消は-32800。
 * @invariant 発行後エラーをEffect 0へ補完しない。
 * @boundary MCP→Coordinator。
 * @security 生例外・Root・内部Snapshotを返さない。
 * @concurrency 同期Owner終了後に応答し自動再送しない。
 */
export async function handleMcpWorkspaceRequest(
  raw: unknown,
  resolve: WorkspaceAccessResolver,
  signal: AbortSignal,
) {
  const request = inspectProtocolRequest(raw);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = snapshotPlainRecord(request.params, callKeys);
  const args =
    params &&
    snapshotPlainRecord(params.arguments, new Set(["repositoryId", "command"]));
  const command = args && inspectWorkspaceCommand(args.command);
  if (
    !params ||
    !inspectMcpEnvelope(params._meta) ||
    !args ||
    typeof args.repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(args.repositoryId) ||
    !command ||
    ![MCP_WORKSPACE_READ_TOOL, MCP_WORKSPACE_MANAGE_TOOL].includes(
      params.name as never,
    ) ||
    ["list", "get", "inspect", "candidate-diff"].includes(command.operation) !==
      (params.name === MCP_WORKSPACE_READ_TOOL)
  )
    return protocolError(request.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  try {
    const access = resolve(args.repositoryId);
    if (!access) throw new Error("workspace_access_unavailable");
    const { executeWorkspace } = await import(
      "../../../coordinator/src/index.ts"
    );
    if (signal.aborted)
      return protocolError(request.id, -32800, "Request cancelled");
    if (!access.authorize()) throw new Error("workspace_access_unavailable");
    const result = executeWorkspace(
      access.ownerRoot,
      access.projectId,
      command,
      access.authorize,
      signal,
    );
    if (signal.aborted)
      return protocolError(request.id, -32603, "Workspace outcome unavailable");
    return protocolComplete(request.id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch {
    return protocolError(request.id, -32603, "Workspace outcome unavailable");
  }
}

import { inspectWorkspaceCommand } from "../../../domain-model/src/index.ts";
