/**
 * 非鍵管理のMCP要求をAccess Managementへ直接委譲する。
 * @responsibility 閉入力・取消・非秘密の結果投影を所有し、認可と保存をAMに残す。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary HTTP要求の認証ContextとAM公開API。
 * @security 資格は要求Contextだけに保持し、結果・例外へ転記しない。
 */
import {
  authenticateNormalConnection,
  readManagementState,
  registerUser,
  updateUserName,
  changeUserRole,
  updateRoleContentAccess,
  unregisterRepository,
  updateExposure,
  type UserRoleManagementResult,
  type RepositoryExposureManagementResult,
} from "../../../access-management/src/index.ts";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../request/snapshot.ts";
import {
  callKeys,
  inspectProtocolRequest,
  inspectMcpEnvelope,
  protocolComplete,
  protocolError,
  type JsonRpcId,
  type McpResponse,
} from "../orchestrator/protocol.ts";
import {
  MCP_ACCESS_MANAGEMENT_TOOLS,
  getMcpAccessManagementToolDefinitions,
} from "./protocol.ts";

/**
 * 当該要求だけに結合した管理Context。
 * @responsibility 構成済みRootとHeader資格を入力値から分離する。
 * @trace ARCH-000013
 * @shape rootとtokenのみ。
 * @invariant Role・許可結果をcacheしない。
 * @boundary MCP要求closureの内部構成。
 * @security JSON・永続状態・ログへ公開しない。
 * @compatibility 初回限定・stdio固定依存へ構成しない。
 */
export type McpAccessManagementContext = Readonly<{
  root: FilesystemStoreRoot;
  token: string;
}>;

/**
 * 現在管理主体にだけ管理Toolを一覧表示する。
 * @responsibility 古いRoleを使わず、実行許可と一覧表示を区別する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 当該要求の管理Context。
 * @returns manager／administratorなら十Tool、developerなら空配列。
 * @precondition 通常接続の要求で構成されている。
 * @postcondition 一覧のRoleを後続保存のAuthorityへ渡さない。
 * @effect AMの現在本人認証・既存短期Lock。
 * @failure 認証・状態不明は固定例外で一覧を停止する。
 * @invariant 管理一覧から内容閲覧を付与しない。
 * @boundary AM現在認証とMCP一覧。
 * @security 本人Snapshot・Root・資格を返さない。
 * @concurrency 各一覧でfresh認証し、後続callでも再評価する。
 */
export function listMcpAccessManagementTools(
  context: McpAccessManagementContext,
) {
  const actor = authenticateNormalConnection(context.root, context.token);
  if (actor.status !== "completed")
    throw new Error("access_management_unavailable");
  return actor.snapshot.role === "developer"
    ? []
    : getMcpAccessManagementToolDefinitions();
}

/**
 * 閉Schemaの入力構造を実行前に固定する。
 * @responsibility 不正field・型・配列・相関をAM呼出し前に拒否する。
 * @trace ARCH-000012
 * @input Tool名と未検査arguments。
 * @returns 所有済み入力、拒否ならnull。
 * @precondition N/A: 任意入力を受ける。
 * @postcondition usernameの意味検査と現在対象判定をAMへ残す。
 * @effect N/A: メモリ内の構造検査のみ。
 * @failure 不正構造はnull。
 * @invariant 書換え・normalize・既定Role補完をしない。
 * @boundary MCP入力と同期AM API。
 * @security accessor・Proxy・未知fieldを透過しない。
 * @concurrency N/A: 同期で値を固定する。
 */
function parseManagementArguments(name: string, value: unknown) {
  const definition = getMcpAccessManagementToolDefinitions().find(
    (tool) => tool.name === name,
  );
  if (!definition) return null;
  const required = definition.inputSchema.required;
  const args = snapshotPlainRecord(value, new Set(required));
  if (!args || required.some((key) => !Object.hasOwn(args, key))) return null;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
  const owned: Record<string, unknown> = { ...args };
  for (const key of required) {
    const field = args[key];
    if (key === "expectedRevision") {
      if (!Number.isSafeInteger(field) || Number(field) < 1) return null;
    } else if (key === "operationId" || key === "userId") {
      if (typeof field !== "string" || !uuid.test(field)) return null;
    } else if (key === "repositoryId") {
      if (
        typeof field !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(field)
      )
        return null;
    } else if (key === "username") {
      if (typeof field !== "string") return null;
    } else if (key === "workspaceIds") {
      const array = snapshotPlainArray<string>(field, 2);
      if (
        array.status !== "ok" ||
        array.value.some(
          (item) => item !== "development" && item !== "management",
        ) ||
        new Set(array.value).size !== array.value.length
      )
        return null;
      owned[key] = array.value;
    } else if (
      field !== "developer" &&
      field !== "manager" &&
      field !== "administrator"
    )
      return null;
  }
  return Object.freeze(owned);
}

/**
 * 通常保存結果を固定した非秘密Unionへ写す。
 * @responsibility 最初の失敗分類と既知出版・清掃の事実を保持する。
 * @trace ARCH-000012
 * @input AMの通常管理Result。
 * @returns 閉じたMCP管理結果。
 * @precondition AM公開入口が生成した値だけを受ける。
 * @postcondition 内部理由・Path・secondaryを転記しない。
 * @effect N/A: 値の投影のみ。
 * @failure 未列挙理由はstorage_unavailableへ閉じる。
 * @invariant 既知publicationをrollbackや成功へ変えない。
 * @boundary AM内部結果とMCP公開結果。
 * @security 自由文字列理由・秘密・回復参照を含めない。
 * @concurrency N/A: 同期の結果を一回投影する。
 */
function projectManagementMutation(
  result: UserRoleManagementResult | RepositoryExposureManagementResult,
) {
  if (result.status === "completed") {
    return {
      status: "completed",
      operationId: result.operationId,
      expectedRevision: result.expectedRevision,
      revision: result.revision,
      ...("userId" in result
        ? { userId: result.userId }
        : { repositoryId: result.repositoryId }),
      publication: result.publication,
      cleanupConfirmed: result.cleanupConfirmed,
    };
  }
  if (result.reason === "management_operation_rejected")
    return { status: "rejected", reason: "management_request_rejected" };
  const reasons: Readonly<Record<string, string>> = {
    state_store_previous_pending_settled: "previous_materials_settled",
    state_store_pending_failed: "previous_materials_unavailable",
    state_store_capacity_exceeded: "capacity_exceeded",
    state_store_identity_failed: "identity_generation_failed",
    state_store_candidate_failed: "candidate_invalid",
    state_store_repository_binding_failed: "repository_validation_failed",
    state_store_prepare_failed: "prepare_failed",
    state_store_publish_failed: "publication_failed",
    state_store_read_back_failed: "readback_failed",
    state_store_cleanup_failed: "cleanup_failed",
    state_store_lock_unknown: "release_unknown",
    filesystem_store_lock_operation_completed_cleanup_unknown:
      "release_unknown",
  };
  return {
    status: "unavailable",
    reason: "management_operation_unavailable",
    primaryFailure: Object.hasOwn(reasons, result.primaryFailure)
      ? reasons[result.primaryFailure]
      : "storage_unavailable",
    operationId: result.operationId,
    expectedRevision: result.expectedRevision,
    observedRevision: result.observedRevision,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 管理結果を標準Tool応答と固定上限へ接続する。
 * @responsibility 閉UnionをstructuredContentに置き、部分結果を返さない。
 * @trace ARCH-000012
 * @input 元Request IDと投影済み非秘密結果。
 * @returns 通常Tool応答、上限超過なら固定未取得。
 * @precondition 値は本Adapterの閉投影で生成する。
 * @postcondition 説明textへ入力・理由・状態を複製しない。
 * @effect N/A: メモリ内serializeのみ。
 * @failure 16 MiB超過は全体未取得。
 * @invariant 保存や認可を再実行しない。
 * @boundary MCP Tool結果とJSON-RPC搬送。
 * @security Path・秘密を追加しない。
 * @concurrency N/A: 完了済み結果の同期投影だけ。
 */
function completeManagementResponse(
  id: JsonRpcId,
  result: Readonly<Record<string, unknown>>,
): McpResponse {
  const response = protocolComplete(id, {
    content: [{ type: "text", text: "アクセス管理結果を取得しました。" }],
    structuredContent: result,
    isError: result.status !== "completed",
  });
  return Buffer.byteLength(JSON.stringify(response), "utf8") <= 16_777_216
    ? response
    : protocolComplete(id, {
        content: [{ type: "text", text: "アクセス管理結果を取得できません。" }],
        structuredContent: {
          status: "unavailable",
          reason: "management_response_too_large",
        },
        isError: true,
      });
}

/**
 * 管理要求を現在AM APIへ一度だけ委譲する。
 * @responsibility 完全入力・取消・結果公開を同期保存の前後へ接続する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input rawRequest、当該Header Context、signal。
 * @returns 非秘密管理結果、入力拒否、取消または固定内部故障。
 * @precondition 通常認証が完了した要求専用Contextである。
 * @postcondition AM処理は最大一回、応答喪失で自動再送しない。
 * @effect 既存AMの現在認可・読取りまたは明示保存。
 * @failure 不正入力-32602、取消-32800、例外-32603。
 * @invariant 保存開始後取消は終了待ち・公開抑止でありrollbackではない。
 * @boundary MCP要求からAM保存と公開応答。
 * @security Root・Token・内部理由を例外へ透過しない。
 * @concurrency 期待改訂を保持し、各AM APIのfresh認可を使う。
 */
export async function handleMcpAccessManagementRequest(
  rawRequest: unknown,
  context: McpAccessManagementContext,
  signal: AbortSignal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(rawRequest);
  if (request?.method !== "tools/call")
    return protocolError(request?.id ?? null, -32600, "Invalid Request");
  const params = snapshotPlainRecord(request.params, callKeys);
  if (
    !params ||
    typeof params.name !== "string" ||
    !inspectMcpEnvelope(params._meta)
  )
    return protocolError(request.id, -32602, "Invalid params");
  const args = parseManagementArguments(params.name, params.arguments);
  if (!args) return protocolError(request.id, -32602, "Invalid params");
  if (signal.aborted)
    return protocolError(request.id, -32800, "Request cancelled");
  const readKinds = {
    [MCP_ACCESS_MANAGEMENT_TOOLS.listUsers]: "users",
    [MCP_ACCESS_MANAGEMENT_TOOLS.listRoleContentAccess]: "roleContentAccess",
    [MCP_ACCESS_MANAGEMENT_TOOLS.listRepositories]: "registeredRepositories",
    [MCP_ACCESS_MANAGEMENT_TOOLS.listExposure]: "exposure",
  } as const;
  try {
    let projected: Readonly<Record<string, unknown>>;
    const kind = readKinds[params.name as keyof typeof readKinds];
    const actor = authenticateNormalConnection(context.root, context.token);
    if (signal.aborted)
      return protocolError(request.id, -32800, "Request cancelled");
    if (
      actor.status === "unavailable" &&
      actor.reason !== "credential_authentication_rejected"
    )
      return protocolError(request.id, -32603, "Access management unavailable");
    if (actor.status !== "completed" || actor.snapshot.role === "developer")
      return completeManagementResponse(request.id, {
        status: kind === undefined ? "rejected" : "unavailable",
        reason:
          kind === undefined
            ? "management_request_rejected"
            : "management_read_rejected",
      });
    if (kind !== undefined) {
      const result = readManagementState(context.root, context.token, kind);
      if (result.status === "unavailable") {
        projected = {
          status: "unavailable",
          reason:
            result.reason === "management_state_read_rejected" ||
            result.reason === "management_state_authentication_rejected"
              ? "management_read_rejected"
              : "management_read_unavailable",
        };
      } else {
        const snapshot = result.snapshot;
        projected = {
          status: "completed",
          revision: snapshot.revision,
          ...(snapshot.kind === "users"
            ? {
                users: snapshot.users.map(({ userId, username, role }) => ({
                  userId,
                  username,
                  role,
                })),
              }
            : snapshot.kind === "roleContentAccess"
              ? {
                  roles: snapshot.roles.map(({ role, workspaceIds }) => ({
                    role,
                    workspaceIds: [...workspaceIds],
                  })),
                }
              : snapshot.kind === "registeredRepositories"
                ? {
                    repositories: snapshot.repositories.map(
                      ({ repositoryId }) => ({ repositoryId }),
                    ),
                  }
                : {
                    repositories: snapshot.repositories.map(
                      ({ repositoryId, workspaceIds }) => ({
                        repositoryId,
                        workspaceIds:
                          workspaceIds === null ? null : [...workspaceIds],
                      }),
                    ),
                  }),
        };
      }
    } else {
      const { root, token } = context;
      const revision = args.expectedRevision as number;
      const operationId = args.operationId as string;
      let result: UserRoleManagementResult | RepositoryExposureManagementResult;
      switch (params.name) {
        case MCP_ACCESS_MANAGEMENT_TOOLS.registerUser:
          result = registerUser(
            root,
            token,
            revision,
            operationId,
            args.username as string,
            args.plannedRole,
          );
          break;
        case MCP_ACCESS_MANAGEMENT_TOOLS.updateUserName:
          result = updateUserName(
            root,
            token,
            revision,
            operationId,
            args.userId as string,
            args.username as string,
          );
          break;
        case MCP_ACCESS_MANAGEMENT_TOOLS.changeUserRole:
          result = changeUserRole(
            root,
            token,
            revision,
            operationId,
            args.userId as string,
            args.currentRole,
            args.nextRole,
          );
          break;
        case MCP_ACCESS_MANAGEMENT_TOOLS.updateRoleContentAccess:
          result = updateRoleContentAccess(
            root,
            token,
            revision,
            operationId,
            args.targetRole,
            args.workspaceIds,
          );
          break;
        case MCP_ACCESS_MANAGEMENT_TOOLS.unregisterRepository:
          result = unregisterRepository(
            root,
            token,
            revision,
            operationId,
            args.repositoryId,
          );
          break;
        case MCP_ACCESS_MANAGEMENT_TOOLS.updateExposure:
          result = updateExposure(
            root,
            token,
            revision,
            operationId,
            args.repositoryId,
            args.workspaceIds,
          );
          break;
        default:
          return protocolError(request.id, -32602, "Invalid params");
      }
      projected = projectManagementMutation(result);
    }
    // 同期AM処理を終えてから、届いたTransport取消を処置する機会を設ける。
    // 切断の到着や保存の取消を保証する待機ではない。
    await yieldToTransport(0);
    if (signal.aborted)
      return protocolError(request.id, -32800, "Request cancelled");
    return completeManagementResponse(request.id, projected);
  } catch {
    return protocolError(
      request.id,
      signal.aborted ? -32800 : -32603,
      signal.aborted ? "Request cancelled" : "Access management unavailable",
    );
  }
}
