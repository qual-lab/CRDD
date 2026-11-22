/**
 * Node HTTPの接続・終了、要求取消、Origin・Form受付、共通応答を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 */
import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";

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
export function createApiServer() {
  const connections = new Set<Socket>();
  const pendingRequests = new Set<Promise<void>>();
  const controllers = new Set<AbortController>();
  let closing = false;
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
      if (closing) {
        incoming.destroy();
        return;
      }
      const controller = new AbortController();
      controllers.add(controller);
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
        controllers.delete(controller);
        incoming.removeListener("aborted", requestAborted);
        response.removeListener("close", responseClosed);
      });
    };
  server.on("connection", (socket) => {
    if (closing) {
      socket.destroy();
      return;
    }
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
      closing = true;
      let primaryFailure: unknown = null;
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) =>
            error === undefined ? resolve() : reject(error),
          );
          for (const controller of controllers) controller.abort();
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

/**
 * 当該HTTP要求の切断だけを取消へ伝え、処理後に両監視を解除する。
 * @responsibility 通常管理と鍵操作で実体確認・出版の処理順を変えず、同じ通知を扱う。
 * @trace ARCH-000013
 * @boundary 各入口が監視を始める時点と終了待機を決める。
 */
export function observeConnectionCancellation(
  incoming: IncomingMessage,
  response: ServerResponse,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const responseClosed = () => {
    if (!response.writableFinished) abort();
  };
  incoming.once("aborted", abort);
  response.once("close", responseClosed);
  return {
    signal: controller.signal,
    dispose: () => {
      incoming.removeListener("aborted", abort);
      response.removeListener("close", responseClosed);
    },
  };
}

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
 * 完成済みHTTP応答を、既存の保護Headerと正しいバイト数で返す。
 * @responsibility HEADでも本文の長さを保ち、本文自体は送らない。
 * @trace ARCH-000012
 * @boundary 応答の認可・取消は呼出し元が確定してから送る。
 */
export function sendResponseBody(
  response: ServerResponse,
  contentType: string,
  body: string | Buffer,
  head = false,
  status = 200,
): void {
  setResponseHeaders(response);
  response.statusCode = status;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(head ? undefined : body);
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
