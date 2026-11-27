/**
 * 直接試験を本番と同じFactory・公式SDKへ接続する。
 * @packageDocumentation
 * @responsibility 別の意味dispatchを作らず、合成要求とSDK応答を搬送する。
 * @trace EST-IT-002
 * @level IT
 * @scope 専門Toolの同一Factory接続。
 * @boundary 試験入力と公式SDKのメモリ内HTTP受付。
 */

import type { Readable, Writable } from "node:stream";
import { createMcpHandler, ProtocolError } from "@modelcontextprotocol/server";
import {
  inspectProtocolRequest,
  acceptMcpRequest,
  isMcpPublicRequest,
  MCP_COORDINATOR_PROTOCOL_VERSION,
} from "../../src/transport/mcp-protocol.ts";
import {
  createMcpServerFactory,
  type McpCoordinatorDependencies,
  type McpServerDependencies,
} from "../../src/transport/mcp-server.ts";
import { runMcpStdio } from "../../src/transport/mcp-stdio.ts";
import type {
  McpResponse,
  McpServerFactory,
} from "../../src/transport/mcp-types.ts";
import {
  asMcpFixtureFactory,
  type McpFixtureSource,
} from "../support/mcp-factory.ts";
import {
  readFixtureMcpAuth,
  startMcpAuthenticatedStreamableHttp,
} from "../support/mcp-http-listener.ts";

/**
 * 構成済み接続を公式SDKで一回処理する。
 * @responsibility 元入力の検査とSDK正規化を分け、開始済みOwnerをjoinする。
 * @trace EST-IT-002
 * @precondition 合成依存だけを渡す。
 * @stimulus 元入力でFactoryを構成し、安全な搬送包絡をSDKへ渡す。
 * @observation SDK応答とOwner完了を待つ。
 * @oracle JSON相当の試験入力はSDKの検査を経てOwnerへ渡る。
 * @cleanup SDKのcloseと開始済みPromiseのjoin。
 * @boundary 試験と本番共通SDK登録。
 */
export async function invokeMcpSource(
  source: McpServerFactory,
  raw: unknown,
  signal: AbortSignal,
): Promise<McpResponse>;
export async function invokeMcpSource(
  source: McpServerFactory,
  raw: unknown,
  signal: AbortSignal,
  sdkSignal: AbortSignal,
): Promise<McpResponse | null>;
export async function invokeMcpSource(
  source: McpServerFactory,
  raw: unknown,
  signal: AbortSignal,
  sdkSignal?: AbortSignal,
): Promise<McpResponse | null> {
  const request =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const id =
    typeof request?.id === "string" || typeof request?.id === "number"
      ? request.id
      : null;
  const pending: Promise<McpResponse>[] = [];
  const auth = readFixtureMcpAuth(source);
  let server: Awaited<ReturnType<typeof source.createServer>>;
  try {
    const inspected = inspectProtocolRequest(raw);
    if (!inspected) throw new ProtocolError(-32600, "Invalid Request");
    if (!isMcpPublicRequest(inspected))
      throw new ProtocolError(-32601, "Method not found");
    server = await source.createServer(
      acceptMcpRequest(inspected),
      signal,
      (operation) => {
        pending.push(operation);
      },
      auth,
    );
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
        _meta: params?._meta,
        ...(request?.method === "tools/call"
          ? {
              name: typeof params?.name === "string" ? params.name : "",
              arguments: params?.arguments,
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
        ...(sdkSignal ? { signal: sdkSignal } : {}),
      }),
      auth ? { authInfo: auth } : undefined,
    );
    const bodyText = await response.text();
    if (sdkSignal?.aborted && bodyText === "") return null;
    return JSON.parse(bodyText) as McpResponse;
  } finally {
    await Promise.allSettled(pending);
    await sdk.close();
  }
}

/** SDKの公開Tool失敗と、通信層エラーを区別する試験用述語。 */
export function mcpToolErrorText(response: McpResponse): string | undefined {
  const result = response.result as
    | {
        isError?: boolean;
        content?: { type: string; text?: string }[];
      }
    | undefined;
  return result?.isError === true &&
    result.content?.length === 1 &&
    result.content[0]?.type === "text"
    ? result.content[0].text
    : undefined;
}

export function isMcpInvalidArguments(response: McpResponse, _tool: string) {
  return mcpToolErrorText(response) === "Invalid arguments";
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

/** 合成資格による要求別の解決を本番のHTTP搬送へ接続する。 @trace EST-ST-003 */
export function startMcpHttpFixture(
  source: McpFixtureSource,
  {
    bearerToken,
    ...options
  }: Parameters<typeof startMcpAuthenticatedStreamableHttp>[1] & {
    bearerToken: string;
  },
) {
  const factory = asMcpFixtureFactory(source);
  return startMcpAuthenticatedStreamableHttp(
    (observed) => (observed === bearerToken ? factory : null),
    options,
  );
}

/** SDKの実HTTPと合成の実行依存を試験内だけで組み合わせる。 @trace EST-ST-003 */
export function startCoordinatorHttpFixture(
  coordinator: McpCoordinatorDependencies,
  options: Parameters<typeof startMcpHttpFixture>[1],
) {
  return startMcpHttpFixture(createMcpServerFactory({ coordinator }), options);
}

/** SDKの実stdioと合成の実行依存を試験内だけで組み合わせる。 @trace EST-ST-012 */
export function runCoordinatorStdioFixture(
  coordinator: McpCoordinatorDependencies,
  input: Readable,
  output: Writable,
) {
  return runMcpStdio(createMcpServerFactory({ coordinator }), input, output);
}
