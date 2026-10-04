/**
 * 同一Processで所有するHost排他の通知と終端を処置する。
 *
 * @responsibility 取得、取消、後着通知とTransport終端を一つの内部状態機械へ収束させる。
 * @trace ARCH-000008
 */

/**
 * 排他Adapterが渡す資源通知を定義する。
 *
 * @responsibility Server通知と個別socketのIdentityを区別する。
 * @trace ARCH-000008
 * @shape listening、listen_failed、server_closed、socket_opened、socket_closedの閉集合。
 * @invariant socket通知は同じ参照Identityへ結合する。
 * @boundary 内部状態機械と固定caller保存のOS Adapterの境界。
 * @security 通知は削除Authorityや非使用証明を含まない。
 * @compatibility 未知通知を成功として受理しない。
 */
export type HostOperationLeaseEvent =
  | Readonly<{ kind: "listening" | "listen_failed" | "server_closed" }>
  | Readonly<{
      kind: "socket_opened" | "socket_closed";
      socket: object;
    }>;

/**
 * 内部排他候補の資源依存を定義する。
 *
 * @responsibility 通知、要求、期限の所有を状態機械から分離する。
 * @trace ARCH-000008
 * @shape subscribe、listen、close、closeSocketと解除可能な期限。
 * @invariant 依存が保持する資源を通知前に不存在へ畳まない。
 * @boundary 局所試験用依存と固定caller保存のOS Adapterだけが利用する。
 * @security 任意Path、削除操作、Providerまたは公開Capabilityを受け取らない。
 * @compatibility caller保存の私有Adapterへ接続する。通常Host処置の公開Factoryにはしない。
 */
export type HostOperationLeaseDependencies = Readonly<{
  subscribe: (listener: (event: HostOperationLeaseEvent) => void) => () => void;
  listen: () => void;
  close: () => void;
  closeSocket: (socket: object) => void;
  scheduleDeadline: (callback: () => void) => () => void;
}>;

/**
 * Transport通知上の終端結果を定義する。
 *
 * @responsibility 通知終端、失敗と未確認を区別する。
 * @trace ARCH-000008
 * @shape not_started、closed、closed_after_failureまたはunconfirmedと観測field。
 * @invariant この結果からOperation全体のcleanupConfirmedを生成しない。
 * @boundary 内部候補の呼出し側だけが通知処置に利用する。
 * @security OS資源不存在、Root処置Authorityまたは回復Tokenを発行しない。
 * @compatibility closedはnative endgame完了を意味しない。
 */
export type HostOperationLeaseEnd = Readonly<{
  status: "not_started" | "closed" | "closed_after_failure" | "unconfirmed";
  serverCloseObserved: boolean;
  socketsPending: number;
}>;

/**
 * 未接続候補のOwnerと取得結果を定義する。
 *
 * @responsibility 未確認時にも通知所有者を失わず、二重解放を防ぐ。
 * @trace ARCH-000008
 * @shape acquired、not_acquired、unconfirmed、OwnerのisHeldとrelease。
 * @invariant 取得前取消以外は同じOwner参照を返す。
 * @boundary 内部候補の状態所有境界。
 * @security OwnerはFilesystem、Task再開または削除Capabilityではない。
 * @compatibility ProductionのSupervisor結果へ暗黙変換しない。
 */
export type HostOperationLeaseCandidate = Readonly<{
  acquired: Promise<
    Readonly<{
      status: "acquired" | "not_acquired" | "unconfirmed";
    }>
  >;
  isHeld: () => boolean;
  release: () => Promise<HostOperationLeaseEnd>;
}>;

/**
 * 同一Process排他候補の通知処置を開始する。
 *
 * @responsibility 取得と取消、後着資源、重複通知および終端未確認を同じOwnerで処置する。
 * @trace ARCH-000008
 * @input 内部資源依存と呼出し側が所有する取消Signal。
 * @returns 保持中判定、取得結果と一回の解放結果を持つ内部Owner。
 * @precondition 依存は同じ資源の通知と要求を所有し、caller保存の固定OS Adapterまたは局所試験に限定する。
 * @postcondition 取消・失敗後は保持中を返さず、不明結果と後着資源のOwnerを失わない。
 * @effect 依存へlisten、close、受理socket終端要求と通知・期限登録を発行する。
 * @failure 依存例外、重複通知、期限または観測不能を未取得・失敗・終端未確認へ区別する。
 * @invariant close要求と結果確定は一回。通知上の終端をOS全体の清掃へ昇格しない。
 * @boundary Coordinator内部候補の通知処置。Root、marker、Docker、Providerには未接続。
 * @security Authority、回復Token、任意Pathまたは対象外資源への操作を発行しない。
 * @concurrency 取消・listening・error・closeの複合順序とsocket Identityを一つのOwnerが保持する。
 */
export function createIsolatedHostOperationInProcessLeaseCandidate(
  dependencies: HostOperationLeaseDependencies,
  signal: AbortSignal,
): HostOperationLeaseCandidate {
  let resolveAcquire!: (
    result: Readonly<{
      status: "acquired" | "not_acquired" | "unconfirmed";
    }>,
  ) => void;
  let resolveEnd!: (result: HostOperationLeaseEnd) => void;
  const acquired = new Promise<
    Readonly<{
      status: "acquired" | "not_acquired" | "unconfirmed";
    }>
  >((resolve) => {
    resolveAcquire = resolve;
  });
  const end = new Promise<HostOperationLeaseEnd>((resolve) => {
    resolveEnd = resolve;
  });
  let acquireSettled = false;
  let endSettled = false;
  let listenStarted = false;
  let isListenPending = false;
  let isListening = false;
  let isCancelled = signal.aborted;
  let hasFailed = false;
  let isClosing = false;
  let closeRequested = false;
  let isServerClosed = false;
  let disposeSubscription: (() => void) | null = null;
  let isDisposingSubscription = false;
  let clearDeadline: (() => void) | null = null;
  let isRegisteringDeadline = false;
  const sockets = new Set<object>();
  const seenSockets = new Set<object>();
  const requestedSockets = new Set<object>();
  const settleAcquire = (
    status: "acquired" | "not_acquired" | "unconfirmed",
  ) => {
    if (acquireSettled) return;
    acquireSettled = true;
    resolveAcquire(Object.freeze({ status }));
  };
  const settleEnd = (status: HostOperationLeaseEnd["status"]) => {
    if (endSettled) return;
    endSettled = true;
    resolveEnd(
      Object.freeze({
        status,
        serverCloseObserved: isServerClosed,
        socketsPending: sockets.size,
      }),
    );
  };
  const stopDeadline = () => {
    const current = clearDeadline;
    clearDeadline = null;
    try {
      current?.();
      return true;
    } catch {
      hasFailed = true;
      return false;
    }
  };
  const markUnknown = () => {
    hasFailed = true;
    isClosing = true;
    settleAcquire("unconfirmed");
    settleEnd("unconfirmed");
    stopDeadline();
  };
  const finishObservedEnd = () => {
    if (
      isListenPending ||
      !isServerClosed ||
      sockets.size !== 0 ||
      isDisposingSubscription
    )
      return;
    isClosing = true;
    if (!stopDeadline()) {
      markUnknown();
      return;
    }
    signal.removeEventListener("abort", cancel);
    try {
      isDisposingSubscription = true;
      disposeSubscription?.();
      disposeSubscription = null;
      isDisposingSubscription = false;
    } catch {
      markUnknown();
      return;
    }
    if (sockets.size !== 0) {
      markUnknown();
      return;
    }
    settleAcquire("not_acquired");
    settleEnd(hasFailed ? "closed_after_failure" : "closed");
  };
  const finishNotStarted = () => {
    isClosing = true;
    signal.removeEventListener("abort", cancel);
    if (!stopDeadline()) {
      markUnknown();
      return;
    }
    try {
      isDisposingSubscription = true;
      disposeSubscription?.();
      disposeSubscription = null;
      isDisposingSubscription = false;
    } catch {
      markUnknown();
      return;
    }
    settleAcquire("not_acquired");
    settleEnd("not_started");
  };
  const ensureDeadline = () => {
    if (clearDeadline || isRegisteringDeadline || endSettled) return;
    isRegisteringDeadline = true;
    try {
      clearDeadline = dependencies.scheduleDeadline(() => {
        markUnknown();
        requestClose();
      });
      if (endSettled) stopDeadline();
    } catch {
      markUnknown();
    } finally {
      isRegisteringDeadline = false;
    }
  };
  const requestClose = () => {
    isClosing = true;
    ensureDeadline();
    for (const socket of sockets) {
      if (requestedSockets.has(socket)) continue;
      requestedSockets.add(socket);
      try {
        dependencies.closeSocket(socket);
      } catch {
        markUnknown();
      }
    }
    // 公開結果がunknownでも、取得要求のsettlement前にはcloseを先行しない。
    if (!listenStarted || isListenPending || closeRequested || isServerClosed)
      return;
    closeRequested = true;
    try {
      dependencies.close();
    } catch {
      markUnknown();
    }
  };
  const cancel = () => {
    isCancelled = true;
    requestClose();
  };
  const onEvent = (event: HostOperationLeaseEvent) => {
    // 登録中の通知を取得成功にしない。要求前に通知された資源は不明として保持する。
    if (!listenStarted) markUnknown();
    switch (event.kind) {
      case "listening":
        isListenPending = false;
        if (isListening || isServerClosed) hasFailed = true;
        isListening = true;
        if (signal.aborted) isCancelled = true;
        if (isCancelled || isClosing || hasFailed) requestClose();
        else if (stopDeadline()) {
          // 期限解除中の同期取消も、取得結果の公開直前に再確認する。
          if (isCancelled || isClosing || hasFailed || signal.aborted)
            requestClose();
          else settleAcquire("acquired");
        } else {
          markUnknown();
          requestClose();
        }
        break;
      case "listen_failed":
        isListenPending = false;
        hasFailed = true;
        requestClose();
        break;
      case "server_closed":
        if (isListenPending) {
          // 取得要求より先のcloseを、後着取得の終端根拠へ使わない。
          markUnknown();
          break;
        }
        if (isServerClosed || !closeRequested) hasFailed = true;
        isServerClosed = true;
        isClosing = true;
        requestClose();
        finishObservedEnd();
        break;
      case "socket_opened":
        if (isServerClosed) markUnknown();
        if (seenSockets.has(event.socket)) {
          hasFailed = true;
          requestClose();
          break;
        }
        seenSockets.add(event.socket);
        sockets.add(event.socket);
        if (isClosing || isCancelled || hasFailed) requestClose();
        break;
      case "socket_closed":
        if (!sockets.delete(event.socket)) {
          hasFailed = true;
          requestClose();
        }
        finishObservedEnd();
        break;
      default:
        hasFailed = true;
        requestClose();
    }
  };
  const owner = Object.freeze({
    acquired,
    /**
     * 通知上の取得状態を確認する。
     *
     * @responsibility 取消・失敗・解放後を保持中へ戻さない。
     * @trace ARCH-000008
     * @input N/A: Owner内の現在状態だけを読む。
     * @returns isListening後かつ取消・失敗・解放開始前だけtrue。
     * @precondition 同じ内部Ownerから呼び出す。
     * @postcondition 状態や資源を変更しない。
     * @effect N/A: Owner内の状態を読むだけである。
     * @failure N/A: 外部観測や要求を行わない。
     * @invariant trueはOSの全資源・対象の非使用を証明しない。
     * @boundary Process内の通知状態。
     * @security 結果を削除Authorityへ変換しない。
     * @concurrency 同じevent loop内の現在状態を同期で読む。
     */
    isHeld: () =>
      isListening &&
      !isCancelled &&
      !hasFailed &&
      !isClosing &&
      !isServerClosed,
    /**
     * 同じOwnerの解放を一回要求する。
     *
     * @responsibility 重複呼出しへ同じ終端結果を返す。
     * @trace ARCH-000008
     * @input N/A: 所有する同じ排他だけを対象とする。
     * @returns Transport通知上の終端、失敗または未確認。
     * @precondition 同じ内部Ownerを保持している。
     * @postcondition 後着通知とsocket終端を同じOwnerで保持する。
     * @effect 未発行のcloseと受理socketの終端を依存へ要求する。
     * @failure close例外、期限または通知不整合を成功へ畳まない。
     * @invariant 二回目も同じPromiseを返し、新しい資源を取得しない。
     * @boundary 内部Ownerから資源依存への解放要求。
     * @security Root・marker・Providerを操作しない。
     * @concurrency 結果確定後の後着通知でも確定済み結果を変更しない。
     */
    release: () => {
      requestClose();
      finishObservedEnd();
      return end;
    },
  });
  if (isCancelled) {
    settleAcquire("not_acquired");
    settleEnd("not_started");
    return owner;
  }
  try {
    disposeSubscription = dependencies.subscribe(onEvent);
    // subscribe内の同期通知より後に返された解除責任も同じOwnerへ回収する。
    if (isServerClosed) finishObservedEnd();
    if (endSettled) return owner;
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) isCancelled = true;
    if (isCancelled) {
      finishNotStarted();
      return owner;
    }
    ensureDeadline();
    if (endSettled) return owner;
    if (signal.aborted) isCancelled = true;
    if (isCancelled || isClosing || hasFailed) {
      finishNotStarted();
      return owner;
    }
    listenStarted = true;
    isListenPending = true;
    dependencies.listen();
  } catch {
    markUnknown();
    requestClose();
  }
  return owner;
}
