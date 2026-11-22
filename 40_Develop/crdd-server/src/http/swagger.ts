/**
 * OpenAPIとSwagger UIの開発用固定資産を公開する。
 * @responsibility 明示localhost起動で、仕様書と同一Originの固定資産だけを配信する。
 * @trace ARCH-000012
 * @boundary 開発者ブラウザとHTTP API参照。Runtimeの認可や実行は所有しない。
 * @security 外部配信元、任意File、資格保存、UIからの操作送信を使用しない。
 */
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { openApiDocument } from "./openapi.ts";
import { setResponseHeaders } from "./security.ts";

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRDD Server API</title><link rel="stylesheet" href="/docs/swagger-ui.css"></head><body><div id="swagger-ui"></div><script defer src="/docs/swagger-ui-bundle.js"></script><script defer src="/docs/swagger-initializer.js"></script></body></html>`;
const initializer = `SwaggerUIBundle({
  dom_id: "#swagger-ui",
  url: "/openapi.json",
  validatorUrl: null,
  supportedSubmitMethods: [],
  persistAuthorization: false,
  queryConfigEnabled: false
});`;

/** 固定仕様とSwagger UIを起動時に読み込む。欠落時は待受を始めない。 @trace ARCH-000012 */
export async function createApiDocumentation() {
  const require = createRequire(import.meta.url);
  const [css, script] = await Promise.all([
    readFile(require.resolve("swagger-ui-dist/swagger-ui.css")),
    readFile(require.resolve("swagger-ui-dist/swagger-ui-bundle.js")),
  ]);
  const assets = new Map<string, readonly [string, Buffer]>([
    [
      "/openapi.json",
      [
        "application/json; charset=utf-8",
        Buffer.from(JSON.stringify(openApiDocument)),
      ],
    ],
    ["/docs", ["text/html; charset=utf-8", Buffer.from(html)]],
    ["/docs/swagger-ui.css", ["text/css; charset=utf-8", css]],
    ["/docs/swagger-ui-bundle.js", ["text/javascript; charset=utf-8", script]],
    [
      "/docs/swagger-initializer.js",
      ["text/javascript; charset=utf-8", Buffer.from(initializer)],
    ],
  ]);

  return (request: IncomingMessage, response: ServerResponse): boolean => {
    const asset = assets.get(request.url ?? "");
    if (!asset) return false;
    setResponseHeaders(response);
    const port = request.socket.localPort;
    if (
      request.socket.remoteAddress !== "127.0.0.1" ||
      typeof port !== "number" ||
      ![
        `127.0.0.1:${port}`,
        `localhost:${port}`,
        ...(port === 80 ? ["127.0.0.1", "localhost"] : []),
      ].includes(request.headers.host ?? "") ||
      request.rawHeaders.filter(
        (header, index) => index % 2 === 0 && header.toLowerCase() === "host",
      ).length !== 1 ||
      [
        "forwarded",
        "x-forwarded-host",
        "x-forwarded-proto",
        "x-forwarded-for",
      ].some((key) => request.headers[key] !== undefined) ||
      request.headers["sec-fetch-site"] === "cross-site"
    ) {
      response.statusCode = 403;
      response.end();
      return true;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD");
      response.end();
      return true;
    }
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    response.statusCode = 200;
    response.setHeader("Content-Type", asset[0]);
    response.setHeader("Content-Length", asset[1].byteLength);
    response.end(request.method === "GET" ? asset[1] : undefined);
    return true;
  };
}
