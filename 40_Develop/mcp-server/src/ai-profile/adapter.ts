/**
 * CROS OwnerのAI Profile管理をMCPへ搬送する。
 *
 * @responsibility 固定四Toolの入力と結果を既存Catalog契約へ接続する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import {
  validateAiProfileCatalog,
  parseAiProfileCatalogMutation,
  validateAiProfileMutationResult,
  type AiProfileCatalogAdministration,
  type AiProfileCatalogMutationResult,
  type AiProfileCatalogSnapshot,
} from "../../../ai-adapter/src/index.ts";
import {
  callKeys,
  inspectProtocolRequest,
  inspectMcpEnvelope,
  protocolError,
  protocolComplete,
  type McpResponse,
} from "../orchestrator/protocol.ts";

export const MCP_AI_PROFILE_TOOLS = Object.freeze({
  list: "crdd.list_ai_profiles",
  create: "crdd.create_ai_profile",
  update: "crdd.update_ai_profile",
  delete: "crdd.delete_ai_profile",
});

/**
 * Profile管理四Toolの固定入力を定義する。
 *
 * @responsibility 一覧とCallで同じ操作集合を使用する。
 * @trace ARCH-000012
 * @input N/A: 固定契約を返す。
 * @returns 固定四Toolの記述。
 * @precondition 管理権限を確認した依存がある場合だけ公開する。
 * @postcondition 操作はTool名が固定し入力operationを受けない。
 * @effect N/A: 値だけを構築する。
 * @failure N/A: 外部処理は行わない。
 * @invariant Model／Role語彙をMCPへ複製しない。
 * @boundary MCP一覧とProfile構造Validatorの境界。
 * @security Tokenと任意Pathを入力Schemaへ含めない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function getMcpAiProfileToolDefinitions() {
  return Object.freeze(
    Object.entries(MCP_AI_PROFILE_TOOLS).map(([operation, name]) =>
      Object.freeze({
        name,
        title: `AI Profile${operation === "list" ? "一覧" : operation === "create" ? "登録" : operation === "update" ? "更新" : "削除"}`,
        description: "CROS管理権限でAI Profile Catalogを操作します。",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required:
            operation === "list"
              ? []
              : operation === "delete"
                ? ["expectedRevision", "profileId", "confirmed"]
                : ["expectedRevision", "profile"],
          properties:
            operation === "list"
              ? {}
              : {
                  expectedRevision: { type: "integer", minimum: 0 },
                  ...(operation === "delete"
                    ? {
                        profileId: {
                          type: "string",
                          pattern: "^PROFILE-[0-9]{6,}$",
                        },
                        confirmed: { type: "boolean" },
                      }
                    : {
                        profile: {
                          type: "object",
                          description:
                            "AI Adapterの閉じたProfile定義。未知fieldと未登録Modelは拒否します。",
                        },
                      }),
                },
        },
      }),
    ),
  );
}

/**
 * Catalog Snapshotの公開値を固定する。
 *
 * @responsibility 改訂とCatalogを既存AI Adapterの意味検査へ接続する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @input value: 管理操作が返したSnapshot候補。
 * @returns 所有済みSnapshot、不正ならnull。
 * @precondition 型だけを成功根拠にしない。
 * @postcondition 改訂とCatalogだけを返す。
 * @effect N/A: 局所検査のみ。
 * @failure 不正改訂またはCatalogはnull。
 * @invariant Model登録を応答側で補完しない。
 * @boundary Catalog OwnerとMCP応答の境界。
 * @security 余剰Snapshot fieldを拒否する。
 * @concurrency N/A: 同期取得する。
 */
function parseCatalogSnapshot(value: unknown): AiProfileCatalogSnapshot | null {
  const record = snapshotPlainRecord(value, new Set(["revision", "catalog"]));
  if (
    !record ||
    !Number.isSafeInteger(record.revision) ||
    Number(record.revision) < 0
  )
    return null;
  const catalog = validateAiProfileCatalog(record.catalog);
  return catalog === null
    ? null
    : Object.freeze({ revision: Number(record.revision), catalog });
}

/**
 * 認可済みProfile管理を一回だけ実行する。
 *
 * @responsibility 入力拒否と内部故障を分け、採用済み変更を取消で巻き戻さない。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input rawRequest、認可済み静的administrationまたは要求時Resolver、signal。
 * @returns Snapshotまたは管理結果、入力拒否・内部故障・取消応答。
 * @precondition 静的依存は旧／Local用途。新AM経路は現在認可Resolverを使用する。
 * @postcondition executeは最大一回、応答故障で再試行しない。
 * @effect 作成・更新・削除は既存Catalog Ownerへ一回委譲する。
 * @failure 入力不正-32602、内部故障-32603、取消-32800。
 * @invariant 採用後取消は保存取消を意味せず、結果は再観測する。
 * @boundary MCP入力／応答と同期Catalog操作の境界。
 * @security 内部例外、秘密値、Pathを応答へ透過しない。
 * @concurrency expectedRevisionを維持し、競合を自動再送しない。
 */
export async function handleMcpAiProfileRequest(
  rawRequest: unknown,
  administration:
    | AiProfileCatalogAdministration
    | (() => AiProfileCatalogAdministration | null),
  signal: AbortSignal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = snapshotPlainRecord(request.params, callKeys);
  const operation = Object.entries(MCP_AI_PROFILE_TOOLS).find(
    ([, name]) => name === params?.name,
  )?.[0];
  if (!params || !operation || !inspectMcpEnvelope(params._meta))
    return protocolError(request.id, -32602, "Invalid params");
  const args = snapshotPlainRecord(
    params.arguments,
    new Set(
      operation === "list"
        ? []
        : operation === "delete"
          ? ["expectedRevision", "profileId", "confirmed"]
          : ["expectedRevision", "profile"],
    ),
  );
  if (!args) return protocolError(request.id, -32602, "Invalid params");
  const mutation =
    operation === "list"
      ? null
      : parseAiProfileCatalogMutation({ ...args, operation });
  if (operation !== "list" && mutation === null)
    return protocolError(request.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  try {
    const current =
      typeof administration === "function" ? administration() : administration;
    if (signal.aborted)
      return protocolError(request.id, -32800, "Request cancelled");
    if (current === null)
      return protocolError(request.id, -32601, "Method not found");
    let result: AiProfileCatalogSnapshot | AiProfileCatalogMutationResult;
    if (mutation === null) {
      const snapshot = parseCatalogSnapshot(current.snapshot());
      if (snapshot === null) throw new Error("profile_snapshot_invalid");
      result = snapshot;
    } else {
      const rawResult = current.execute(mutation);
      const validated = validateAiProfileMutationResult(mutation, rawResult);
      if (!validated) throw new Error("profile_result_invalid");
      result = validated;
    }
    if (signal.aborted)
      return protocolError(request.id, -32800, "Request cancelled");
    return protocolComplete(request.id, {
      content: [{ type: "text", text: "AI Profile管理結果を取得しました。" }],
      structuredContent: result,
      isError: "status" in result && result.status === "rejected",
    });
  } catch {
    return signal.aborted
      ? protocolError(request.id, -32800, "Request cancelled")
      : protocolError(
          request.id,
          -32603,
          "AI Profile administration unavailable",
        );
  }
}
