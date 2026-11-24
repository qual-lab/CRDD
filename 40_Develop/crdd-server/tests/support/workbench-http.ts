/**
 * Workbenchの公開HTTPを変換せず観測する試験補助。
 * @packageDocumentation
 * @responsibility HTTPのStatus・Header・本文と、元のRequest Targetを保持する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary loopback HTTPの試験だけ。製品入口では使わない。
 */
import { request } from "node:http";

/**
 * WorkbenchへRaw HTTP Requestを送信する。
 *
 * @responsibility 固定Routeと拒否RouteのResponseをURL正規化前のRequest Targetで観測する。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition baseUrlが起動済みWorkbenchを指す。
 * @stimulus methodとrequestPathをNode HTTP Clientから送信する。
 * @observation Status、Headerおよび本文bytesを取得する。
 * @oracle 呼出し側が配信・拒否・Security Headerを判定できる。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
export async function requestTransport(
  baseUrl: string,
  requestPath: string,
  method = "GET",
  body?: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<
  Readonly<{
    status: number;
    headers: NodeJS.Dict<string | string[]>;
    body: Buffer;
  }>
> {
  const url = new URL(baseUrl);
  return await new Promise((resolve, reject) => {
    const outgoing = request(
      {
        hostname: url.hostname,
        port: url.port,
        method,
        path: requestPath,
        headers: {
          ...(body === undefined
            ? {}
            : {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
              }),
          ...headers,
        },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("end", () =>
          resolve(
            Object.freeze({
              status: incoming.statusCode ?? 0,
              headers: incoming.headers,
              body: Buffer.concat(chunks),
            }),
          ),
        );
      },
    );
    outgoing.once("error", reject);
    outgoing.end(body);
  });
}

/**
 * HTTP Responseを加工せず取得する。
 *
 * @responsibility Header、Statusおよび生本文を必要とする契約試験へResponseを渡す。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition baseUrlが起動済みWorkbenchを指す。
 * @stimulus 指定method、pathおよび任意bodyを送信する。
 * @observation HTTP Responseを変換せず取得する。
 * @oracle 呼出し側が配信Headerと拒否本文を判定できる。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: Raw HTTP Request→Raw HTTP Response
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
export async function requestRaw(
  baseUrl: string,
  requestPath: string,
  method = "GET",
  body?: string,
): Promise<
  Readonly<{
    status: number;
    headers: NodeJS.Dict<string | string[]>;
    body: Buffer;
  }>
> {
  return await requestTransport(baseUrl, requestPath, method, body);
}
