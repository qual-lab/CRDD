/**
 * 初回候補だけに完全discoverと確認保存を接続する。
 * @responsibility 通常Tool／管理依存なしの要求専用Handlerを所有する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
import {
  confirmInitialConnection,
  type InitialConnectionBinding,
} from "../../../access-management/src/index.ts";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { protocolError } from "../orchestrator/protocol.ts";
import type { McpRequestHandler } from "../transport/types.ts";
import { handleMcpDiscoverRequest } from "./discover.ts";

/**
 * 初回限定相関を完全要求検査後の確認保存へ渡す。
 * @responsibility 成功応答を保存・清掃・Lock終了後だけに限定する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 検証済みRoot、当該要求のBearer、非Authority初回相関。
 * @returns 要求専用Handler。通常HandlerやTool依存を受け取らない。
 * @precondition Resolverが同Lockの用途判定でinitialを返した当該要求だけ。
 * @postcondition 不正／開始前取消はconfirm0、正規要求だけfresh保存後に非秘密応答。
 * @effect 有効discoverだけ既存AM確認保存を一回呼ぶ。
 * @failure AM拒否・失効・状態故障は一つの固定非開示error。
 * @invariant 同要求へ通常Authorityを発行せず、初期化・鍵管理を公開しない。
 * @boundary 完全MCP要求→AM同期保存→応答前取消再確認。
 * @security BearerとBindingは要求closureだけ。応答・Error・永続記録へ透過しない。
 * @concurrency 保存前Signalを確認し、同期保存終了後にも確認して成功公開を止める。
 */
export function createInitialConnectionHandler(
  root: FilesystemStoreRoot,
  token: string,
  binding: InitialConnectionBinding,
): McpRequestHandler {
  return async (request, signal) => {
    const response = handleMcpDiscoverRequest(request);
    if (response.error) return response;
    if (signal.aborted)
      return protocolError(response.id, -32800, "Request cancelled");
    const confirmed = confirmInitialConnection(root, token, binding, signal);
    if (signal.aborted)
      return protocolError(response.id, -32800, "Request cancelled");
    return confirmed.status === "completed"
      ? response
      : protocolError(response.id, -32603, "Initial connection unavailable");
  };
}
