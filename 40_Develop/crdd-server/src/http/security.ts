/**
 * WorkbenchのHTTP応答保護と有界Form読取り。
 *
 * @packageDocumentation
 * @responsibility 共通応答Headerと16KiB以内の操作Form搬送を所有する。認証認可と操作別fieldの意味は所有しない。
 * @trace ARCH-000012
 * @boundary Browser HTTPとWorkbenchの要求・応答境界。
 * @effect 要求Streamを消費し、当該応答のHeaderだけを設定する。
 * @security JSON・Multipart・過大Bodyを受け付けず、秘密やHost Pathを応答へ追加しない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * 共有配置の公開Origin境界をraw Headerから確認する。
 * @responsibility Host・転送案内・Originの重複と不一致を資格・Body観測前に拒否する。
 * @trace ARCH-000012
 * @input 当該HTTP要求と、起動時に検査した公開Originまたは単体配置null。
 * @returns 現行の配置Header条件を満たす場合だけtrue。
 * @precondition publicOriginは既存構成Readerで検査済みである。
 * @postcondition 正規化で重複Headerを消さず、POSTではOriginの一致を必須にする。
 * @effect N/A: 要求Headerの同期検査だけ。
 * @failure 不一致・重複・欠測をfalseで返し、認証不成立と混同しない。
 * @invariant trueを利用者認証・内容認可・実TLS終端の証明へ変換しない。
 * @boundary 公開Origin配置案内とHTTP前段。
 * @security Body・資格保存・Domain Ownerを観測せず、raw Headerを照合する。
 * @concurrency 当該要求の同期入力だけを使用する。
 */
export function validatePublicOriginRequest(
  incoming: IncomingMessage,
  publicOrigin: URL | null,
): boolean {
  if (publicOrigin === null) return true;
  const expected = [
    ["host", publicOrigin.host],
    ["x-forwarded-proto", "https"],
    ["x-forwarded-host", publicOrigin.host],
  ];
  return !(
    expected.some(
      ([name, value]) =>
        incoming.headers[name as string] !== value ||
        incoming.rawHeaders.filter(
          (field, index) => index % 2 === 0 && field.toLowerCase() === name,
        ).length !== 1,
    ) ||
    incoming.rawHeaders.filter(
      (field, index) => index % 2 === 0 && field.toLowerCase() === "origin",
    ).length > 1 ||
    (incoming.headers.origin !== undefined &&
      incoming.headers.origin !== publicOrigin.origin) ||
    ((incoming.method ?? "") === "POST" &&
      incoming.headers.origin !== publicOrigin.origin)
  );
}

/**
 * Workbench Responseへ共通Security Headerを付ける。
 *
 * @responsibility localhost ResponseのCache、MIME解釈、Frame埋込みおよびReferrerを制約する。
 * @trace ARCH-000012
 * @input responseに未送信のHTTP Responseを受け取る。
 * @returns N/A: Responseを直接更新するため戻り値を持たない。
 * @precondition Headerがまだ送信されていない。
 * @postcondition 共通Security Headerが設定される。
 * @effect HTTP Response Headerを変更する。
 * @failure N/A: Nodeの同期Header設定だけを行う。
 * @invariant Credential、Host Pathおよび内部実装情報を追加しない。
 * @boundary Workbench ServerとBrowserのHTTP境界。
 * @security CSP、nosniff、deny frame、no-referrerおよびno-storeを設定する。
 * @concurrency RequestごとのResponseだけを変更する。
 */
export function setResponseHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

/**
 * Workbench操作Formを上限付きで読取る。
 *
 * @responsibility localhost HTTP Bodyを固定上限内のURL encoded Formへ変換し、過大入力を拒否する。
 * @trace ARCH-000012
 * @input incomingに未読のHTTP Request、maxBytesに用途別の固定上限を受け取る。
 * @returns URLSearchParamsを返すPromiseを返す。
 * @precondition Content-Typeはapplication/x-www-form-urlencodedである。
 * @postcondition Body全体が指定上限（通常16KiB）以下の場合だけ解析済みFormを返す。
 * @effect Request streamを終端まで消費する。
 * @failure 過大Body、Stream失敗または不正Content-TypeをErrorで拒否する。
 * @invariant 部分BodyからRepository Effectを開始しない。
 * @boundary Browser HTTP RequestとWorkbench Application入力の境界。
 * @security 入力上限を固定し、Multipart、JSONおよび任意Binaryを受け付けない。
 * @concurrency RequestごとのStreamだけを所有する。
 */
export async function readActionForm(
  incoming: IncomingMessage,
  maxBytes = 16 * 1_024,
): Promise<URLSearchParams> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new Error("workbench_action_body_limit_invalid");
  if (
    incoming.headers["content-type"]?.split(";", 1)[0] !==
    "application/x-www-form-urlencoded"
  )
    throw new Error("workbench_action_content_type_invalid");
  const declaredLength = incoming.headers["content-length"];
  if (declaredLength !== undefined && Number(declaredLength) > maxBytes)
    throw new Error("workbench_action_body_too_large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of incoming) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) throw new Error("workbench_action_body_too_large");
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}
