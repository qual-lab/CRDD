/**
 * Workbenchの同Origin HTTP要求と応答の世代を管理する。
 * @responsibility 別Originへの送信と、無効化した世代の応答採用を拒否する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary Browser memoryとWorkbench HTTP API。
 * @security URL・Storage・Model・logへ鍵を保存せず、redirectを追従しない。
 */
import { clearWorkbenchQueries } from "./queries.ts";

let generation = 0;

/**
 * 非秘密の現在接続世代を参照する。
 * @responsibility 画面遷移中の通知を別の接続へ渡さない。
 * @trace ARCH-000013
 * @input N/A: 現在タブの接続世代。
 * @returns 単調更新されるmemory上の世代値。
 * @precondition Browser内部の表示相関だけに用いる。
 * @postcondition 資格そのものを返さない。
 * @effect N/A: 同期読取りだけ。
 * @failure N/A: 永続I/Oを行わない。
 * @invariant 値をServer認可やAuthorityに使用しない。
 * @boundary 接続OwnerとRouterの非秘密相関。
 * @security Credential・主体Identityを開示しない。
 * @concurrency 待機後にも現在世代と比較する。
 */
export function readWorkbenchConnectionGeneration(): number {
  return generation;
}

/** 画面終了やログアウト前に、未完了の応答・通知を現在の画面から切り離す。 @trace ARCH-000013 */
export function invalidateWorkbenchRequests(): void {
  generation += 1;
  clearWorkbenchQueries();
}

/**
 * 同じWorkbenchのAPIへ一要求だけ送信する。
 * @responsibility 応答本文の読取り後にも接続世代を確認し、遅延応答を別主体へ渡さない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 同Originの相対API URLと要求構成。
 * @returns 当該接続世代の上限内応答。Callerが業務JSONを検査する。
 * @precondition Browserの現在OriginがWorkbench配置先である。
 * @postcondition 呼出側が指定したAuthorizationは送信しない。
 * @effect 一回のfetchと応答本文読取り。再送なし。
 * @failure Origin差・Caller資格指定・取消・接続世代差は固定例外。
 * @invariant 接続材料は認可結果ではなく、Serverが毎要求認可する。
 * @boundary Browser HTTPと現在表示の間。
 * @security same-origin限定、redirect追従0、共有セッションにだけCookieを使用、no-store。
 * @concurrency 待機後の切断／切替とSignalを再確認し、古い応答を返さない。
 */
export async function requestWorkbench(
  input: string,
  options: RequestInit = {},
  allowBrowserSession = false,
): Promise<Response> {
  const expectedGeneration = generation;
  const url = new URL(input, globalThis.location.origin);
  const headers = new Headers(options.headers);
  if (
    url.origin !== globalThis.location.origin ||
    url.username ||
    url.password ||
    headers.has("authorization") ||
    options.signal?.aborted
  )
    throw new Error("workbench_request_rejected");
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      mode: "same-origin",
      credentials: allowBrowserSession ? "same-origin" : "omit",
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted)
      throw new Error("workbench_response_unavailable");
    throw error;
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (reader) {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (expectedGeneration !== generation || options.signal?.aborted) {
          await reader.cancel();
          throw new Error("workbench_response_unavailable");
        }
        chunks.push(chunk.value);
      }
    }
  } catch (error) {
    if (options.signal?.aborted)
      throw new Error("workbench_response_unavailable");
    throw error;
  } finally {
    reader?.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (
    response.status === 0 ||
    expectedGeneration !== generation ||
    options.signal?.aborted
  )
    throw new Error("workbench_response_unavailable");
  return new Response(
    [204, 205, 304].includes(response.status) ? null : bytes,
    {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    },
  );
}
