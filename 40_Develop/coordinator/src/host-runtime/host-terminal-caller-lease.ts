/**
 * Host終端記録のcaller保存を同一Processで排他する。
 *
 * @responsibility Repositoryごとの短い保存区間をWindows named pipeへ結合する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { createServer, type Socket } from "node:net";
import { resolveRepositoryRuntimeDataPaths } from "../../../domain-model/src/repository/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import {
  createIsolatedHostOperationInProcessLeaseCandidate,
  type HostOperationLeaseCandidate,
  type HostOperationLeaseEvent,
} from "./host-operation-inprocess-lease-internal.ts";

/**
 * 検証済みRepositoryのcaller保存排他を取得する。
 *
 * @responsibility 取得・取消・後着通知・socket終端を同じProcessのOwnerへ接続する。
 * @trace ARCH-000008
 * @input 検証済みRepository capabilityと呼出し側の取消Signal。
 * @returns 取得結果、同期保持確認と一回のTransport解放結果。
 * @precondition Windowsで、Runtime Dataが同じRepository capabilityを解決できる。
 * @postcondition 失敗・取消後の保持を返さず、別Supervisorを作らない。
 * @effect Repository由来の固定named pipeをlistenし、接続は通信せず閉じる。
 * @failure 不正Root、非Windows、取得競合、期限または終了不明を成功にしない。
 * @invariant named pipeは排他だけであり、対象の非使用・削除Authorityを表さない。
 * @boundary Coordinatorと同じProcessが所有するWindows IPC境界。
 * @security 任意pipe名・Path・メッセージ・Providerを受け付けない。
 * @concurrency listening後の保存は同期区間に閉じ、await中の保持を保存許可にしない。
 */
export function acquireHostTerminalCallerLease(
  repository: VerifiedRepositoryRoot,
  signal: AbortSignal,
): HostOperationLeaseCandidate {
  const paths = resolveRepositoryRuntimeDataPaths(repository);
  if (process.platform !== "win32" || !paths)
    throw new Error("host_terminal_caller_lease_boundary_invalid");
  const hash = createHash("sha256")
    .update("crdd/host-terminal-caller-mutation/v1\0", "utf8")
    .update(paths.repositoryRoot.toLowerCase(), "utf8")
    .digest("hex");
  const pipe = `\\\\.\\pipe\\crdd-host-terminal-caller-${hash}`;
  const server = createServer();
  const sockets = new Set<Socket>();
  let listener: ((event: HostOperationLeaseEvent) => void) | null = null;
  /**
   * 取得のlistening通知を同じOwnerへ渡す。
   *
   * @responsibility 取得通知だけを生成し、取消の解釈は状態機械へ委ねる。
   * @trace ARCH-000008
   * @input N/A: Node Serverのlistening eventだけを受ける。
   * @returns N/A: 内部Ownerへ通知する。
   * @precondition ServerがこのProcessのlisten要求を所有する。
   * @postcondition 後着取得も購読中の同じOwnerへ渡す。
   * @effect N/A: 内部通知だけで外部処置を発行しない。
   * @failure Owner不在なら通知を送らず取得成功を生成しない。
   * @invariant listeningだけから保存許可・Authorityを作らない。
   * @boundary Node Server eventと取得状態機械。
   * @security 削除許可、非使用証明やProvider操作を生成しない。
   * @concurrency 同じevent loopから同期通知する。
   */
  const listening = () => listener?.({ kind: "listening" });
  /**
   * Server／socket失敗を同じOwnerへ渡す。
   *
   * @responsibility 資源失敗を保持中判定と終端追跡へ結合する。
   * @trace ARCH-000008
   * @input N/A: Serverまたは受理socketのerror event。
   * @returns N/A: 固定listen_failed通知を送る。
   * @precondition 該当資源はこのAdapterが取得したものである。
   * @postcondition 状態機械が失敗を単調に保持する。
   * @effect N/A: 生のErrorやPathを通知へ複製しない。
   * @failure 購読解除後の通知から成功を作らない。
   * @invariant 生の外部出力と失敗分類を分離する。
   * @boundary Node error eventと内部失敗状態。
   * @security 削除許可、非使用証明やProvider操作を生成しない。
   * @concurrency listen／socket失敗の複合順序を同じOwnerへ渡す。
   */
  const failed = () => listener?.({ kind: "listen_failed" });
  /**
   * Serverのclose eventを終端Ownerへ渡す。
   *
   * @responsibility close callbackの完了と実close通知を区別する。
   * @trace ARCH-000008
   * @input N/A: 所有Serverのclose event。
   * @returns N/A: server_closedだけを送る。
   * @precondition close要求または取得失敗を同じ状態機械が追跡している。
   * @postcondition 全socket終端の判定は状態機械に保持する。
   * @effect N/A: 観測通知だけで追加closeを発行しない。
   * @failure 通知喪失は期限による未確認として残す。
   * @invariant close eventをOperation全体の清掃へ昇格しない。
   * @boundary Node Server終端通知と内部結果。
   * @security 削除許可、非使用証明やProvider操作を生成しない。
   * @concurrency 取得の後着通知を先行closeで無効化しない。
   */
  const closed = () => listener?.({ kind: "server_closed" });
  /**
   * 受理したsocketを同じOwnerの終端対象へ結合する。
   *
   * @responsibility socket参照、close通知と破棄要求を一つの集合で追跡する。
   * @trace ARCH-000008
   * @input Node Serverが受理したSocket。
   * @returns N/A: 通信せず受理socketをdestroyする。
   * @precondition ServerがこのAdapterでlisten済みである。
   * @postcondition close eventで集合を減らし同じsocketをOwnerへ通知する。
   * @effect error／close listenerを付け、受理socketへdestroyを発行する。
   * @failure socket errorは失敗通知へ渡し、close前に不存在へ畳まない。
   * @invariant データ・要求・Authorityをpipeで交換しない。
   * @boundary 受理socketと同一Processの終端集合。
   * @security 削除許可、非使用証明やProvider操作を生成しない。
   * @concurrency 後着受理とcloseも同じsocket Identityへ結合する。
   */
  const connected = (socket: Socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
      listener?.({ kind: "socket_closed", socket });
    });
    socket.on("error", failed);
    listener?.({ kind: "socket_opened", socket });
    // このpipeは接続による要求・Authority・データを受け付けない。
    socket.destroy();
  };
  return createIsolatedHostOperationInProcessLeaseCandidate(
    {
      /**
       * 内部Ownerの通知購読を登録・解除する。
       *
       * @responsibility Server listenerと購読先の一意な所有を保持する。
       * @trace ARCH-000008
       * @input 同じ状態機械の通知関数。
       * @returns socketが終端した後だけ実行できる購読解除関数。
       * @precondition このAdapterの最初の購読である。
       * @postcondition 解除時はServer listenerと購読参照を除去する。
       * @effect Serverへ四listenerを登録し、終了後だけ解除する。
       * @failure socket残存時は解除を拒否し、Ownerを失わない。
       * @invariant listener解除を未終端socketの回収根拠にしない。
       * @boundary 状態機械とNode Serverのevent購読。
       * @security 削除許可、非使用証明やProvider操作を生成しない。
       * @concurrency closeと受理socket終端後に解除する。
       */
      subscribe: (next) => {
        listener = next;
        server.on("listening", listening);
        server.on("error", failed);
        server.on("close", closed);
        server.on("connection", connected);
        return () => {
          if (sockets.size !== 0)
            throw new Error("host_terminal_caller_sockets_pending");
          server.off("listening", listening);
          server.off("error", failed);
          server.off("close", closed);
          server.off("connection", connected);
          listener = null;
        };
      },
      /**
       * 固定named pipeの取得を一回要求する。
       *
       * @responsibility caller保存の排他を同じNode Processで開始する。
       * @trace ARCH-000008
       * @input N/A: 検証済みRepository由来の固定pipe名を閉包で使う。
       * @returns Node Serverの取得要求返値。
       * @precondition 取得前取消は上位状態機械が拒否済みである。
       * @postcondition 取得成立は後続listening eventでだけ通知する。
       * @effect 固定pipeへexclusive listenを発行する。
       * @failure 競合やOS失敗はerror／同期例外で状態機械へ戻す。
       * @invariant 要求返値だけを取得成功にしない。
       * @boundary Node netとWindows IPCの取得境界。
       * @security 削除許可、非使用証明やProvider操作を生成しない。
       * @concurrency 取得中の取消と後着listeningを追跡する。
       */
      listen: () => server.listen({ path: pipe, exclusive: true }),
      /**
       * 所有Serverのcloseを一回要求する。
       *
       * @responsibility callbackとclose eventを分離して実終端を待つ。
       * @trace ARCH-000008
       * @input N/A: このAdapterのServerだけを閉じる。
       * @returns N/A: Server close要求を発行する。
       * @precondition 要求の一回性と取得settlementは状態機械が所有する。
       * @postcondition close eventが返るまで終端確認を作らない。
       * @effect 所有Serverへcloseを発行し、callback自体は成功根拠にしない。
       * @failure 同期例外や通知不足を未確認へ保持する。
       * @invariant 別Serverや未知pipeへcloseを広げない。
       * @boundary 状態機械からNode Serverへの終端要求。
       * @security 削除許可、非使用証明やProvider操作を生成しない。
       * @concurrency listen失敗時もServer close eventを同じOwnerが待つ。
       */
      close: () => {
        // listen失敗時もclose eventを待つ。callbackだけから終了を作らない。
        server.close(() => {});
      },
      /**
       * 所有集合のsocketだけへ終端を要求する。
       *
       * @responsibility 未知参照の破棄を拒否し受理socketを終端追跡へ戻す。
       * @trace ARCH-000008
       * @input 内部Ownerが渡すsocket参照。
       * @returns N/A: 同じSocketへdestroyを要求する。
       * @precondition 参照はこのAdapterの受理集合にある。
       * @postcondition close eventが集合と内部Ownerを更新する。
       * @effect 対象Socketへdestroyを発行する。
       * @failure 未知参照は固定理由で拒否する。
       * @invariant destroy要求をclose確認にしない。
       * @boundary 内部終端Ownerと受理Socket。
       * @security 削除許可、非使用証明やProvider操作を生成しない。
       * @concurrency 重複要求の管理は状態機械へ委ねる。
       */
      closeSocket: (socket) => {
        if (!(socket instanceof Object) || !sockets.has(socket as Socket))
          throw new Error("host_terminal_caller_socket_unknown");
        (socket as Socket).destroy();
      },
      /**
       * 取得・解放の期限と解除責任を登録する。
       *
       * @responsibility 各二秒の期限を同じ状態機械へ渡す。
       * @trace ARCH-000008
       * @input 状態機械が所有する期限通知関数。
       * @returns このtimerだけを解除する関数。
       * @precondition 登録と反復解除の管理は状態機械が所有する。
       * @postcondition 解除後は対象timerから新しい期限通知を送らない。
       * @effect 二秒timerを登録し、返す解除関数がclearTimeoutする。
       * @failure 期限は終端未確認を保持し、追加取得や再試行をしない。
       * @invariant 期限満了を資源不存在へ変換しない。
       * @boundary 内部待機Ownerと同じProcessのtimer。
       * @security 削除許可、非使用証明やProvider操作を生成しない。
       * @concurrency 取得後と解放後の解除、後着通知を状態機械へ結合する。
       */
      scheduleDeadline: (callback) => {
        const timer = setTimeout(callback, 2_000);
        return () => clearTimeout(timer);
      },
    },
    signal,
  );
}
