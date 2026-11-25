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
import type { Readable, Writable } from "node:stream";
import {
  createMcpServerFactory,
  type McpCoordinatorDependencies,
  type McpServerDependencies,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  type McpResponse,
  runMcpStdio,
  startMcpStreamableHttp,
} from "../../src/transport/mcp-server.ts";
import type { McpRequestSource } from "../../src/transport/mcp-types.ts";

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
  const request =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const id =
    typeof request?.id === "string" || typeof request?.id === "number"
      ? request.id
      : null;
  if (typeof source === "function")
    throw new Error("sdk_request_fixture_requires_factory");
  const pending: Promise<McpResponse>[] = [];
  let server: Awaited<ReturnType<typeof source.createServer>>;
  try {
    server = await source.createServer(raw, signal, (operation) => {
      pending.push(operation);
    });
  } catch (error) {
    const failure =
      error instanceof ProtocolError
        ? { code: error.code, message: error.message }
        : { code: -32603, message: "Internal error" };
    return { jsonrpc: "2.0", id, error: failure };
  }
  const sdk = createMcpHandler(() => server, { legacy: "reject" });
  try {
    const params =
      request?.params && typeof request.params === "object"
        ? (request.params as Record<string, unknown>)
        : null;
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
          "mcp-method":
            typeof request?.method === "string" ? request.method : "",
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

/** 実行Toolの公開SDK経路へ試験用Coordinatorだけを接続する。 @trace PRL-IT-012 */
export function invokeMcpCoordinatorRequest(
  raw: unknown,
  coordinator: McpCoordinatorDependencies,
  signal?: AbortSignal,
): Promise<McpResponse> {
  return invokeMcpRequest(raw, { coordinator }, signal);
}

/** SDKの実HTTPと合成の実行依存を試験内だけで組み合わせる。 @trace EST-ST-003 */
export function startCoordinatorHttpFixture(
  coordinator: McpCoordinatorDependencies,
  options: Parameters<typeof startMcpStreamableHttp>[1],
) {
  return startMcpStreamableHttp(
    createMcpServerFactory({ coordinator }),
    options,
  );
}

/** SDKの実stdioと合成の実行依存を試験内だけで組み合わせる。 @trace EST-ST-012 */
export function runCoordinatorStdioFixture(
  coordinator: McpCoordinatorDependencies,
  input: Readable,
  output: Writable,
) {
  return runMcpStdio(createMcpServerFactory({ coordinator }), input, output);
}
