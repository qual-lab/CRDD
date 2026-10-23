/**
 * Workbenchの明示読取りをTanStack Queryへ接続する。
 * @packageDocumentation
 * @responsibility 毎回のfresh取得と取消だけを所有し、表示や資格の正本を持たない。
 * @trace ARCH-000012
 * @boundary Router・表示部品と既存HTTP読取り。
 * @security Query keyは固定用途名と一回限りの非秘密要求IDだけとし、資格・Form・自由な例外本文を保存しない。
 */
import { QueryClient } from "@tanstack/react-query";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      retry: false,
      networkMode: "always",
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
});

/**
 * 一つの用途の現在値を一回取得する。
 * @responsibility 旧要求を共有せず、CallerとQuery双方の取消を既存通信へ渡す。
 * @trace ARCH-000012
 * @input 固定用途名、所有Signal、検査済み非秘密値を返す読取り。
 * @returns 今回の検査済み値。
 * @precondition readは資格・未検査本文を結果へ含めない。
 * @postcondition 成功・失敗とも今回QueryをCacheから除去する。
 * @effect 明示読取り一回のみ。
 * @failure 固定例外へ縮小し、自動再送しない。
 * @invariant 同一用途の取消済みPromiseを次要求へ再利用しない。
 * @boundary Router／Componentの要求とTanStack Query。
 * @security Callerの入力や資格をkey・meta・Errorへ複製しない。
 * @concurrency 同用途でも別Callerの要求を共有せず、各finallyは自分のQueryだけを消す。
 */
export async function readWorkbenchQuery<T>(
  name: "view" | "management" | "ai-selection" | "credentials-view",
  signal: AbortSignal,
  read: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (signal.aborted) throw new Error("workbench_query_unavailable");
  const queryKey = ["workbench", name, crypto.randomUUID()];
  const result = client.fetchQuery({
    queryKey,
    queryFn: async ({ signal: querySignal }) => {
      const owned = AbortSignal.any([signal, querySignal]);
      try {
        const value = await read(owned);
        if (owned.aborted) throw new Error("workbench_query_unavailable");
        return value;
      } catch {
        throw new Error("workbench_query_unavailable");
      }
    },
  });
  const query = client.getQueryCache().find({ queryKey, exact: true });
  try {
    const value = await result;
    if (signal.aborted) throw new Error("workbench_query_unavailable");
    return value;
  } finally {
    if (
      query &&
      client.getQueryCache().find({ queryKey, exact: true }) === query
    )
      client.getQueryCache().remove(query);
  }
}

/**
 * 接続切替・Document終了時に旧Queryを破棄する。
 * @responsibility 旧主体の進行中取得とCacheを次主体へ渡さない。
 * @trace ARCH-000013
 * @input N/A: 接続Ownerからの明示通知。
 * @returns N/A: Query所有の取消を発行する。
 * @precondition 資格の設定・解放またはDocument終了に接続する。
 * @postcondition Cacheは空で、旧QueryのSignalは取消済み。
 * @effect Query破棄と取消通知のみ。
 * @failure N/A: 保存・業務Effectは発行しない。
 * @invariant 通信や業務Effectのrollback完了を主張しない。
 * @boundary 接続寿命と読取り要求。
 * @security 資格値を引数に取らない。
 * @concurrency 既存requestWorkbenchの待機後世代確認も維持する。
 */
export function clearWorkbenchQueries(): void {
  client.clear();
}
