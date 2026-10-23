/**
 * WorkbenchのExpress構成と操作別Routeを組み立てる。
 *
 * @packageDocumentation
 * @responsibility 公開Origin検査を先行し、従来と同じURL解釈から明示Routeと未移管の処理へ接続する。
 * @trace ARCH-000012
 * @boundary HTTP前段・Express Route・既存Workbench要求処理。
 * @effect 解析済みURLを絶対URLとして保持し、Pathの再解釈を避けて許可されたHandlerへ一回渡す。
 * @security Body解析・認可Cache・Session・静的fallbackを追加せず、未知入力は既存の拒否へ接続する。
 */
import type { RequestListener } from "node:http";
import express from "express";
import { setResponseHeaders, validatePublicOriginRequest } from "./security.ts";
import { LOGO_PATH, CLIENT_ASSET_PATH } from "./assets.ts";

/**
 * 既存の要求前段を保つ操作別Express Applicationを構成する。
 * @responsibility Routeの選択だけを所有し、管理・Workspace・Repository・Record・AI・鍵操作の意味は専用Handlerへ委譲する。
 * @trace ARCH-000012
 * @input HTTP終了Ownerへ接続済みの操作別Handler、既存処理用fallback、検査済み公開Origin。
 * @returns 生Header・URL前段から固定Express Routeへ接続するHTTP要求Listener。
 * @precondition 各Handlerが同じ要求前段・取消・joinを経由し、Listener開始前に登録する。
 * @postcondition 公開Origin検査の後にURL解釈し、管理HEADをGETへ暗黙変換しない。
 * @effect ExpressのRouteを構成し、要求時は当該URLのpathname・searchを照合に使用する。
 * @failure 公開配置拒否は421、URL解釈失敗は非秘密の固定500、その他は既存fallbackへ委譲する。
 * @invariant 未移管のfallbackを移行完了とは扱わず、処理済み要求を別Handlerへ流さない。
 * @boundary Node HTTPからExpressとWorkbench要求Ownerへの接続。
 * @security 生Header検査をBody・資格観測より先に行い、Express情報・etag・自動Body解析を追加しない。
 * @concurrency 同期前段後に一つのlifecycle付きHandlerだけを呼び、要求Contextを持ち越さない。
 */
export function createWorkbenchApplication(
  handlers: Readonly<{
    workspace: RequestListener;
    repository: RequestListener;
    record: RequestListener;
    aiSelection: RequestListener;
    aiRequest: RequestListener;
    management: RequestListener;
    credentials: RequestListener;
    view: RequestListener;
    fallback: RequestListener;
  }>,
  publicOrigin: URL | null,
): RequestListener {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", false);
  app.set("trust proxy", false);
  app.enable("case sensitive routing");
  app.enable("strict routing");
  app.post("/workspace/action", handlers.workspace);
  app.post("/repository/action", handlers.repository);
  app.post("/topic-meeting/action", handlers.record);
  app.post("/ai-selection/action", handlers.aiSelection);
  app.post("/ai-request/action", handlers.aiRequest);
  app.head("/api/access-management", handlers.fallback);
  app.get("/api/access-management", handlers.management);
  app.post("/access-management/action", handlers.management);
  app.post("/connection-credentials/action", handlers.credentials);
  app.post("/local-connection/action", handlers.fallback);
  app.post("/candidate/action", handlers.fallback);
  for (const path of [
    "/",
    "/index.html",
    "/project",
    "/topic",
    "/meeting",
    "/change",
    "/owner-artifact",
    "/api/workbench-view",
    "/api/ai-selection",
    "/workbench.css",
    LOGO_PATH,
    CLIENT_ASSET_PATH,
    "/.well-known/crdd-workbench-health",
  ]) {
    app.head(path, handlers.view);
    app.get(path, handlers.view);
  }
  app.use(handlers.fallback);
  return (incoming, response) => {
    if (!validatePublicOriginRequest(incoming, publicOrigin)) {
      setResponseHeaders(response);
      response.statusCode = 421;
      response.end("workbench_tls_boundary_invalid\n");
      return;
    }
    try {
      const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
      incoming.url = url.href;
    } catch {
      setResponseHeaders(response);
      response.statusCode = 500;
      response.end("workbench_request_failed\n");
      return;
    }
    app(incoming, response);
  };
}
