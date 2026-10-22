/**
 * 直接試験を本番と同じFactory・公式SDKへ接続する。
 * @packageDocumentation
 * @responsibility 別の意味dispatchを作らず、合成要求とSDK応答を搬送する。
 * @trace EST-IT-002
 * @level IT
 * @scope 専門Toolの同一Factory接続。
 * @boundary 試験入力と公式SDKのメモリ内HTTP受付。
 */
import { createMcpHandler, ProtocolError } from "@modelcontextprotocol/server";
import {
  createMcpRequestServer,
  createMcpServerFactory,
  type McpServerDependencies,
} from "../../src/request/server.ts";
import {
  inspectProtocolRequest,
  protocolError,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  type McpResponse,
} from "../../src/request/validation.ts";
import { snapshotOpenPlainRecord } from "../../src/request/snapshot.ts";
import type { McpRequestSource } from "../../src/transport/types.ts";

/**
 * 構成済み接続を公式SDKで一回処理する。
 * @responsibility 元入力の検査とSDK正規化を分け、開始済みOwnerをjoinする。
 * @trace EST-IT-002
 * @precondition 合成依存だけを渡す。
 * @stimulus 元入力でFactoryを構成し、安全な搬送包絡をSDKへ渡す。
 * @observation SDK応答とOwner完了を待つ。
 * @oracle 元入力はOwnerへそのまま渡り、getter等をJSON変換で実行しない。
 * @cleanup SDKのcloseと開始済みPromiseのjoin。
 * @boundary 試験と本番共通SDK登録。
 */
export async function invokeMcpSource(
  source: McpRequestSource,
  raw: unknown,
  signal: AbortSignal,
): Promise<McpResponse> {
  const request = inspectProtocolRequest(raw);
  const pending: Promise<McpResponse>[] = [];
  let server: Awaited<ReturnType<typeof createMcpRequestServer>>;
  try {
    server = await createMcpRequestServer(source, raw, signal, (operation) => {
      pending.push(operation);
    });
  } catch (error) {
    return error instanceof ProtocolError
      ? protocolError(request?.id ?? null, error.code, error.message)
      : protocolError(request?.id ?? null, -32603, "Internal error");
  }
  const sdk = createMcpHandler(() => server, { legacy: "reject" });
  try {
    const params = snapshotOpenPlainRecord(request?.params);
    const body = {
      jsonrpc: "2.0",
      id: request?.id,
      method: request?.method,
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_COORDINATOR_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
        ...(request?.method === "tools/call"
          ? {
              name: typeof params?.name === "string" ? params.name : "",
              arguments: {},
            }
          : {}),
      },
    };
    const response = await sdk.fetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
          "mcp-method": request?.method ?? "",
          ...(request?.method === "tools/call"
            ? {
                "mcp-name": typeof params?.name === "string" ? params.name : "",
              }
            : {}),
        },
        body: JSON.stringify(body),
      }),
    );
    return (await response.json()) as McpResponse;
  } finally {
    await Promise.allSettled(pending);
    await sdk.close();
  }
}

/**
 * 専門依存を同じ本番Factoryへ組み立てて処理する。
 * @responsibility 旧Router試験を独立dispatchなしでSDK接続へ移す。
 * @trace EST-IT-002
 * @precondition 合成依存と要求を渡す。
 * @stimulus 一要求のSDK受付を実行する。
 * @observation Protocol結果を返す。
 * @oracle 同じFactoryが一覧と実行を所有する。
 * @cleanup 呼出し先のSDK closeとjoin。
 * @boundary Tool契約試験と公式SDK。
 */
export async function invokeMcpRequest(
  raw: unknown,
  dependencies: McpServerDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  return invokeMcpSource(createMcpServerFactory(dependencies), raw, signal);
}
