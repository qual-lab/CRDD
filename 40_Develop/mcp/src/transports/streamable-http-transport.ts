import { timingSafeEqual } from "node:crypto";
import http, {
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { types as utilTypes } from "node:util";

import {
  handleMcpProjectRuntimeRequest,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  type McpProjectRuntimeDependencies,
} from "../adapters/project-runtime-adapter.ts";
import { parseUnambiguousJsonDocument } from "../internal/unambiguous-json.ts";

export const MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT =
  "crdd-mcp/streamable-http-transport/v1" as const;
const ENDPOINT = "/mcp";
const MAXIMUM_REQUEST_BYTES = 128 * 1024;

export type McpProjectRuntimeHttpOptions = Readonly<{
  port: number;
  bearerToken: string;
  allowedOrigins?: readonly string[];
}>;

function plain(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !utilTypes.isProxy(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
}

function validToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 512 &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function authorized(headers: IncomingHttpHeaders, expected: Buffer) {
  const header = headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const candidate = header.slice("Bearer ".length);
  if (!validToken(candidate)) return false;
  const bytes = Buffer.from(candidate, "utf8");
  return (
    bytes.byteLength === expected.byteLength && timingSafeEqual(bytes, expected)
  );
}

function jsonError(code: number, message: string) {
  return Object.freeze({
    jsonrpc: "2.0",
    id: null,
    error: Object.freeze({ code, message }),
  });
}

function respondJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(bytes.byteLength),
    "cache-control": "no-store",
  });
  response.end(bytes);
}

function acceptsRequiredRepresentations(headers: IncomingHttpHeaders) {
  const accept = headers.accept;
  if (typeof accept !== "string") return false;
  const values = accept
    .split(",")
    .map((value) => value.split(";", 1)[0]?.trim().toLowerCase());
  return (
    values.includes("application/json") && values.includes("text/event-stream")
  );
}

function requestMetadata(value: unknown) {
  if (!plain(value)) return null;
  const params = value.params;
  if (!plain(params) || !plain(params._meta)) return null;
  const protocol = params._meta["io.modelcontextprotocol/protocolVersion"];
  const name = typeof params.name === "string" ? params.name : null;
  return typeof value.method === "string" && typeof protocol === "string"
    ? Object.freeze({ method: value.method, protocol, name })
    : null;
}

function headersMatch(headers: IncomingHttpHeaders, body: unknown) {
  const metadata = requestMetadata(body);
  if (!metadata) return false;
  if (
    headers["mcp-protocol-version"] !== metadata.protocol ||
    metadata.protocol !== MCP_PROJECT_RUNTIME_PROTOCOL_VERSION ||
    headers["mcp-method"] !== metadata.method
  )
    return false;
  const headerName = headers["mcp-name"];
  return metadata.method === "tools/call"
    ? typeof headerName === "string" && headerName === metadata.name
    : headerName === undefined;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAXIMUM_REQUEST_BYTES) return null;
    chunks.push(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
  } catch {
    return null;
  }
}

/**
 * Start the stateless 2026-07-28 Streamable HTTP binding. Authentication is
 * mandatory, the listener is fixed to IPv4 localhost, and no session or GET
 * compatibility surface is created.
 */
export async function startMcpProjectRuntimeStreamableHttp(
  dependencies: McpProjectRuntimeDependencies,
  options: McpProjectRuntimeHttpOptions,
) {
  if (
    !Number.isInteger(options.port) ||
    options.port < 0 ||
    options.port > 65_535 ||
    !validToken(options.bearerToken) ||
    (options.allowedOrigins ?? []).some(
      (origin) =>
        typeof origin !== "string" ||
        !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/u.test(
          origin,
        ),
    )
  )
    throw new Error("project_runtime_mcp_http_configuration_invalid");
  const expectedToken = Buffer.from(options.bearerToken, "utf8");
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const active = new Set<Promise<void>>();
  const controllers = new Set<AbortController>();
  const server = http.createServer((request, response) => {
    const operation = (async () => {
      const controller = new AbortController();
      controllers.add(controller);
      const abortOnDisconnect = () => {
        if (!response.writableFinished) controller.abort();
      };
      response.once("close", abortOnDisconnect);
      try {
        const origin = request.headers.origin;
        if (typeof origin === "string" && !allowedOrigins.has(origin)) {
          respondJson(response, 403, jsonError(-32000, "Origin not allowed"));
          return;
        }
        if (request.url !== ENDPOINT) {
          respondJson(response, 404, jsonError(-32601, "Method not found"));
          return;
        }
        if (request.method !== "POST") {
          response.setHeader("allow", "POST");
          respondJson(response, 405, jsonError(-32600, "POST required"));
          return;
        }
        if (!authorized(request.headers, expectedToken)) {
          response.setHeader("www-authenticate", "Bearer");
          respondJson(
            response,
            401,
            jsonError(-32001, "Authentication required"),
          );
          return;
        }
        if (
          request.headers["content-type"]
            ?.split(";", 1)[0]
            ?.trim()
            .toLowerCase() !== "application/json" ||
          !acceptsRequiredRepresentations(request.headers)
        ) {
          respondJson(response, 400, jsonError(-32600, "Invalid HTTP headers"));
          return;
        }
        const source = await readBody(request);
        const body =
          source === null ? null : parseUnambiguousJsonDocument(source);
        if (!body) {
          respondJson(response, 400, jsonError(-32700, "Parse error"));
          return;
        }
        if (!headersMatch(request.headers, body)) {
          respondJson(response, 400, jsonError(-32020, "Header mismatch"));
          return;
        }
        const result = await handleMcpProjectRuntimeRequest(
          body,
          dependencies,
          controller.signal,
        );
        if (!controller.signal.aborted)
          respondJson(
            response,
            result.error?.code === -32601 ? 404 : 200,
            result,
          );
      } catch {
        if (!response.headersSent)
          respondJson(response, 500, jsonError(-32603, "Internal error"));
        else response.destroy();
      } finally {
        response.removeListener("close", abortOnDisconnect);
        controllers.delete(controller);
      }
    })();
    active.add(operation);
    operation.finally(() => active.delete(operation)).catch(() => undefined);
  });
  await new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => reject(error);
    server.once("error", failed);
    server.listen(options.port, "127.0.0.1", () => {
      server.removeListener("error", failed);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("project_runtime_mcp_http_address_unavailable");
  }
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT,
    host: "127.0.0.1" as const,
    port: address.port,
    endpoint: ENDPOINT,
    close: async () => {
      for (const controller of controllers) controller.abort();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Promise.allSettled([...active]);
      return Object.freeze({
        status: "completed" as const,
        cleanupConfirmed: true,
      });
    },
  });
}

export function describeMcpProjectRuntimeStreamableHttpContract() {
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT,
    protocolVersion: MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
    endpoint: ENDPOINT,
    binding: "127.0.0.1_only",
    authentication: "mandatory_bearer",
    origin: "absent_or_explicit_local_allowlist",
    session: "none_2026_07_28",
    cancellation: "response_disconnect_aborts_request",
    transportAuthority: "none",
  });
}
