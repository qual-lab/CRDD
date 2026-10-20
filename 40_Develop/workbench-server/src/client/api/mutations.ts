/**
 * 非鍵業務操作の一回送信をTanStack Mutationへ接続する。
 * @packageDocumentation
 * @responsibility 再送・オフライン再開を無効にし、応答は既存の操作別検査へ直接返す。
 * @trace ARCH-000012
 * @boundary 明示Formと既存同Origin通信。
 * @security 鍵操作は対象外。Form・応答をMutation variables／data／metaへ保存しない。
 */
import { QueryClient } from "@tanstack/react-query";
import { requestWorkbench } from "./connection.ts";

const client = new QueryClient();
const routes = new Set([
  "/access-management/action",
  "/ai-profiles/action",
  "/topic-meeting/action",
  "/repository/action",
  "/workspace/action",
  "/ai-request/action",
]);

/**
 * 許可済み業務POSTを再送せず実行する。
 * @responsibility Mutation結果にHTTP応答やFormを保存せず、既存Callerへ搬送する。
 * @trace ARCH-000012
 * @input 固定の非鍵業務Pathと既存要求構成。
 * @returns 同じ接続世代のHTTP応答。意味検査は操作Ownerが行う。
 * @precondition Callerが二重送信・操作認可・結果検査を維持する。
 * @postcondition Mutationは成功・失敗ともCacheから除去される。
 * @effect POST一回のみ。自動再送・復帰時再開なし。
 * @failure 接続不明を固定例外にし、未処置やrollbackを主張しない。
 * @invariant 通信取消を業務Effectの取消完了にしない。
 * @boundary 明示操作とTanStack Mutation／既存通信。
 * @security 接続鍵・発行鍵の専用APIを受け付けない。
 * @concurrency 既存CallerのSignalと待機後世代確認を維持する。
 */
export async function requestWorkbenchMutation(
  input: string,
  options: RequestInit,
): Promise<Response> {
  if (!routes.has(input) || options.method !== "POST")
    throw new Error("workbench_mutation_rejected");
  let response: Response | undefined;
  const mutation = client.getMutationCache().build(client, {
    retry: false,
    gcTime: 0,
    networkMode: "always",
    mutationFn: async () => {
      try {
        response = await requestWorkbench(input, options);
      } catch {
        throw new Error("workbench_mutation_unavailable");
      }
    },
  });
  try {
    await mutation.execute(undefined);
    if (response === undefined)
      throw new Error("workbench_mutation_unavailable");
    return response;
  } finally {
    client.getMutationCache().remove(mutation);
  }
}
