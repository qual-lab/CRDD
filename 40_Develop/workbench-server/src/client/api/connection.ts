/**
 * Workbenchの同Origin APIへタブ内の接続資格を搬送する。
 * @responsibility 非永続の鍵と要求世代を所有し、別Originや旧接続の応答へ資格を流用しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary Browser memoryとWorkbench HTTP API。
 * @security URL・Storage・Model・logへ鍵を保存せず、redirectを追従しない。
 */
import { clearWorkbenchQueries } from "./queries.ts";

let credential: string | null = null;
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

/**
 * 明示接続の確認後にタブ内だけの現在鍵を設定する。
 * @responsibility 接続切替前の応答を次の利用者へ渡さない。
 * @trace ARCH-000013
 * @input 接続専用POSTで確認した鍵。
 * @returns N/A: 当該タブのmemory参照を更新する。
 * @precondition Callerが接続成功を確認済みである。
 * @postcondition 過去要求の応答は採用不能になる。
 * @effect タブ内memoryだけを更新する。
 * @failure 空値・空白・過大値は固定例外で拒否する。
 * @invariant 保存・資格発行・認可判定を行わない。
 * @boundary 接続Formと同Origin要求。
 * @security 値を返さず、永続化・表示・log出力しない。
 * @concurrency 切替ごとに旧応答を無効化する。
 */
export function setWorkbenchCredential(value: string): void {
  if (!value || value.length > 4096 || /\s/u.test(value))
    throw new Error("workbench_credential_input_invalid");
  credential = value;
  generation += 1;
  clearWorkbenchQueries();
}

/**
 * 当該タブの接続資格を解放する。
 * @responsibility 他BrowserやHost資格を失効させず、旧応答の採用だけを止める。
 * @trace ARCH-000013
 * @input N/A: 明示切断または画面終了で呼ぶ。
 * @returns N/A: memory参照を解放する。
 * @precondition N/A: 未接続でも呼べる。
 * @postcondition 後続要求には鍵を添付しない。
 * @effect 当該タブのmemoryだけを変更する。
 * @failure N/A: 外部I/Oを行わない。
 * @invariant 実行中Effectの取消・rollback・他Browser切断を意味しない。
 * @boundary Browser接続lifecycle。
 * @security stringの物理消去を保証せず参照を解放する。
 * @concurrency 旧要求の応答採用を世代差で拒否する。
 */
export function clearWorkbenchCredential(): void {
  credential = null;
  generation += 1;
  clearWorkbenchQueries();
}

/**
 * 同じWorkbenchのAPIへ現在鍵を一要求だけ搬送する。
 * @responsibility 応答本文の読取り後にも接続世代を確認し、遅延応答を別主体へ渡さない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 同Originの相対API URLと要求構成。
 * @returns 当該接続世代の上限内応答。Callerが業務JSONを検査する。
 * @precondition Browserの現在OriginがWorkbench配置先である。
 * @postcondition Header資格をURL・応答・例外へ複製しない。
 * @effect 一回のfetchと応答本文読取り。再送なし。
 * @failure Origin差・Caller資格指定・容量超過・取消・接続世代差は固定例外。
 * @invariant 接続材料は認可結果ではなく、Serverが毎要求認可する。
 * @boundary Browser HTTPと現在表示の間。
 * @security same-origin限定、redirect追従0、Cookie資格の新設0、no-store。
 * @concurrency 待機後の切断／切替とSignalを再確認し、古い応答を返さない。
 */
export async function requestWorkbench(
  input: string,
  options: RequestInit = {},
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
  if (credential !== null) headers.set("authorization", `Bearer ${credential}`);
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      mode: "same-origin",
      credentials: "omit",
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
        if (
          size > 16777216 ||
          expectedGeneration !== generation ||
          options.signal?.aborted
        ) {
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
