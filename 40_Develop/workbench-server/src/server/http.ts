/**
 * WorkbenchのHTTP受付と要求・接続の終了を所有する。
 *
 * @packageDocumentation
 * @responsibility 操作別Handlerへ要求を渡し、切断を同じ要求の取消へ結合し、終了時にSocketと保留要求をjoinする。
 * @trace ARCH-000012
 * @boundary Browser接続とWorkbench要求HandlerのHTTP lifecycle境界。
 * @effect HTTP Serverを構成し、当該Serverの接続だけを終了する。
 * @security 資格・Domain状態・Route選択を所有せず、同じ要求の取消と終了だけを保持する。
 */
import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { setResponseHeaders } from "./security.ts";

/**
 * HTTP要求の取消・終了とHandler接続を構成する。
 * @responsibility HTTP接続と保留要求を追跡し、取消通知と実際の処理終了を分離する。
 * @trace ARCH-000012
 * @input N/A: 所有するServerと要求集合を新規構成する。
 * @returns 未listenのNode HTTP Server、Handler接続関数、その接続・要求をjoinする終了操作。
 * @precondition Handlerは要求ごとの認証・入力検査をEffect前に行い、実処理の終了まで待つ。
 * @postcondition close成功後は所有Socketが閉じ、登録済み要求の処理がsettledしている。
 * @effect HTTP Serverを構成し、close時にはそのSocketだけを終了する。
 * @failure 要求例外は非秘密の固定500へ変換し、close失敗はjoin後に再送出する。
 * @invariant Signal発火を保存rollback・Provider終了・Owner closeの証明にしない。
 * @boundary Node HTTP・Express・既存Workbench要求処理。
 * @security Body解析・静的配信・信頼Proxy・Session保存を追加しない。未送信時だけ共通保護Headerを設定し、切断・取消済み要求へ失敗応答を送らない。
 * @concurrency 要求専用Controllerを使い、接続終了後も全保留処理をjoinして監視を解除する。
 */
export function createWorkbenchHttpServer() {
  const connections = new Set<Socket>();
  const pendingRequests = new Set<Promise<void>>();
  const server = createServer();
  /**
   * 操作別Handlerを当該HTTP Ownerの取消・joinへ接続する。
   * @responsibility 要求前段と操作本体のPromiseを同じ保留集合へ一回だけ登録する。
   * @trace ARCH-000012
   * @input 未読の要求・応答・要求専用Signalを受ける非同期Handler。
   * @returns Expressへ直接登録できるNode HTTP要求Listener。
   * @precondition Handlerは前段から実処理の終了まで一つのPromiseで待つ。
   * @postcondition 完了・例外・取消後に保留登録と当該要求の監視を解除する。
   * @effect 要求専用Controllerと監視を構成し、同じ処理のPromiseだけを追跡する。
   * @failure 同期throwと非同期拒否を固定500へ変換し、取消・切断済みの応答は抑止する。
   * @invariant 応答終了からOwner終了を推定せず、Handlerのsettlementを待つ。
   * @boundary Expressの要求ListenerとWorkbench非同期処理。
   * @security 資格・URL・自由なError本文を記録せず、別要求の取消へ触れない。
   * @concurrency 各要求で一回生成し、Listenerを使う複数要求のControllerを混在させない。
   */
  const handleRequest =
    (
      handler: (
        incoming: IncomingMessage,
        response: ServerResponse,
        signal: AbortSignal,
      ) => Promise<void>,
    ): RequestListener =>
    (incoming, response) => {
      const controller = new AbortController();
      /**
       * 未完了の要求Stream終了を当該要求の取消へ結合する。
       * @responsibility 当該要求だけへ中断を通知する。
       * @trace ARCH-000012
       * @input N/A: 所有IncomingMessageのaborted通知。
       * @returns N/A: 所有Controllerを更新する。
       * @precondition 要求専用Controllerを生成済みである。
       * @postcondition 待機後に同じSignalで取消を観測できる。
       * @effect 当該要求のSignalをabortする。
       * @failure N/A: AbortControllerの同期通知だけ。
       * @invariant 通知からEffect取消や処理終了を推定しない。
       * @boundary HTTP要求Streamと要求Handler。
       * @security 他要求の資格や状態を変更しない。
       * @concurrency 重複通知は冪等、要求settlement後に監視を解除する。
       */
      const requestAborted = () => controller.abort();
      /**
       * 応答未完了の接続終了だけを要求取消へ結合する。
       * @responsibility 正常な応答終了と途中切断を区別する。
       * @trace ARCH-000012
       * @input N/A: 所有ServerResponseのclose通知。
       * @returns N/A: 必要時だけControllerを更新する。
       * @precondition Responseと要求Controllerを一対一で保持する。
       * @postcondition 完了済み応答では取消を発行しない。
       * @effect 未完了の場合だけ要求Signalをabortする。
       * @failure N/A: 同期状態確認だけ。
       * @invariant 切断を保存rollback完了へ変換しない。
       * @boundary HTTP応答と当該要求の処理。
       * @security 別要求や別Ownerへ取消を発行しない。
       * @concurrency 要求settlement後に監視を解除する。
       */
      const responseClosed = () => {
        if (!response.writableFinished) controller.abort();
      };
      incoming.once("aborted", requestAborted);
      response.once("close", responseClosed);
      const pending = (async () => {
        await handler(incoming, response, controller.signal);
      })().catch(() => {
        if (!response.destroyed && !controller.signal.aborted) {
          if (!response.headersSent) setResponseHeaders(response);
          response.statusCode = 500;
          response.end("workbench_request_failed\n");
        }
      });
      pendingRequests.add(pending);
      void pending.finally(() => {
        pendingRequests.delete(pending);
        incoming.removeListener("aborted", requestAborted);
        response.removeListener("close", responseClosed);
      });
    };
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
  return Object.freeze({
    server,
    handleRequest,
    /**
     * 所有接続を閉じてから保留要求の終了を待つ。
     * @responsibility Listener停止と要求joinを同じHTTP Ownerの終了へ結合する。
     * @trace ARCH-000012
     * @input N/A: 生成したServer・Socket・保留要求集合だけを使用する。
     * @returns 全登録要求のsettlement確認後に完了するPromise。
     * @precondition 起動Ownerが新規受付の終了を指示する。
     * @postcondition 正常完了ではListener・Socketが閉じ、保留要求がsettledする。
     * @effect 所有Serverとその接続だけを終了する。
     * @failure Listener close失敗は保留要求join後に再送出する。
     * @invariant 下位AI OwnerのcloseとEffect確定は上位Ownerが別に確認する。
     * @boundary HTTP基盤と起動Ownerの終了契約。
     * @security 他Listener・Docker・Repositoryを操作しない。
     * @concurrency 公開Workbench Handleが一つの終了Promiseへ直列化する。
     */
    close: async () => {
      let primaryFailure: unknown = null;
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) =>
            error === undefined ? resolve() : reject(error),
          );
          for (const connection of connections) connection.destroy();
        });
      } catch (error) {
        primaryFailure = error;
      }
      await Promise.allSettled([...pendingRequests]);
      if (primaryFailure !== null) throw primaryFailure;
    },
  });
}
