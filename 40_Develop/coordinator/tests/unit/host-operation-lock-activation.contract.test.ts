/**
 * Host Lockの後着取得、内部lease候補と共有回復Directoryの初期化失敗を検証する。
 *
 * @packageDocumentation
 * @responsibility 非Authority依存で本番settlementの後着・失効・回収不明と共有Directory非削除を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope coordinator、host-operation-lock、activation、inprocess-lease、shared-host-recovery-directory
 * @boundary PRL-UT-006=Direct Boundary: Test→Host Lock取得settlement
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedHostOperationInProcessLeaseCandidate,
  type HostOperationLeaseDependencies,
  type HostOperationLeaseEvent,
} from "../../src/security/host-operation-inprocess-lease-internal.ts";
import {
  createIsolatedHostOperationLockActivationCandidate,
  createIsolatedSharedHostRecoveryDirectoryCandidate,
} from "../../src/security/execution-environment.ts";

/**
 * 実資源を持たない通知依存を構築する。
 *
 * @responsibility 同じ内部状態機械へ要求履歴、通知順序と解除可能な期限を与える。
 * @trace PRL-UT-006
 * @precondition OS、Filesystem、Docker、Providerには接続しない。
 * @stimulus 呼出し側が通知、取消または指定した依存例外を発生させる。
 * @observation 要求履歴、登録listenerと未解除の期限callbackを保持する。
 * @oracle 記録値を通知終端以外の資源不存在証明として使わない。
 * @cleanup N/A: callbackと局所値だけを保持し、timerや実handleを生成しない。
 * @boundary PRL-UT-006=Direct Boundary: Test依存→未接続lease候補
 */
function createLeaseNotificationFixture(
  fault:
    | "none"
    | "subscribe"
    | "listen"
    | "close"
    | "closeSocket"
    | "deadline"
    | "clearDeadline"
    | "unsubscribe" = "none",
  onSubscribe?: (listener: (event: HostOperationLeaseEvent) => void) => void,
) {
  const state = {
    listener: null as ((event: HostOperationLeaseEvent) => void) | null,
    calls: [] as string[],
    deadlines: new Set<() => void>(),
  };
  const dependencies: HostOperationLeaseDependencies = {
    subscribe: (listener) => {
      state.calls.push("subscribe");
      if (fault === "subscribe") throw new Error("subscribe_unknown");
      state.listener = listener;
      onSubscribe?.(listener);
      return () => {
        state.calls.push("unsubscribe");
        if (fault === "unsubscribe") throw new Error("unsubscribe_unknown");
        state.listener = null;
      };
    },
    listen: () => {
      state.calls.push("listen");
      if (fault === "listen") throw new Error("listen_unknown");
    },
    close: () => {
      state.calls.push("close");
      if (fault === "close") throw new Error("close_unknown");
    },
    closeSocket: () => {
      state.calls.push("closeSocket");
      if (fault === "closeSocket") throw new Error("socket_close_unknown");
    },
    scheduleDeadline: (callback) => {
      state.calls.push("deadline");
      if (fault === "deadline") throw new Error("deadline_unknown");
      state.deadlines.add(callback);
      return () => {
        state.calls.push("clearDeadline");
        if (fault === "clearDeadline")
          throw new Error("deadline_clear_unknown");
        state.deadlines.delete(callback);
      };
    },
  };
  return { state, dependencies };
}

/**
 * 期限登録中の取消が二重登録と取消後listenを発生させない。
 *
 * @responsibility 期限登録の同期再入で解除責任を上書きしない。
 * @trace PRL-UT-006
 * @precondition 登録依存が取消後に同じ期限の解除関数を返す。
 * @stimulus scheduleDeadline中にSignalを取消する。
 * @observation 期限登録一回、解除一回、listen0と購読解除。
 * @oracle not_started、not_acquiredであり解除責任を失わない。
 * @cleanup 局所期限と購読は解除する。実timerやOS資源はない。
 * @boundary PRL-UT-006=Direct Boundary: 期限登録中取消→内部lease候補
 */
test("同一Process lease候補は期限登録中取消でも再登録・listenしない", async () => {
  const fixture = createLeaseNotificationFixture();
  const signal = new AbortController();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    {
      ...fixture.dependencies,
      scheduleDeadline: (callback) => {
        const dispose = fixture.dependencies.scheduleDeadline(callback);
        signal.abort();
        return dispose;
      },
    },
    signal.signal,
  );
  assert.equal((await owner.acquired).status, "not_acquired");
  assert.equal((await owner.release()).status, "not_started");
  assert.equal(
    fixture.state.calls.filter((call) => call === "deadline").length,
    1,
  );
  assert.equal(
    fixture.state.calls.filter((call) => call === "clearDeadline").length,
    1,
  );
  assert.equal(fixture.state.calls.includes("listen"), false);
  assert.equal(fixture.state.calls.includes("close"), false);
  assert.equal(fixture.state.deadlines.size, 0);
  assert.equal(fixture.state.listener, null);
});

/**
 * 取得保留中の先行close通知で後着通知所有者を失わない。
 *
 * @responsibility 公開済み未知結果と取得要求のsettlementを分離する。
 * @trace PRL-UT-006
 * @precondition listen発行済み・取得未通知のOwnerを保持する。
 * @stimulus 期限、先行Server close、後着listening、対応Server closeを与える。
 * @observation 購読残存、先行close要求0、後着後一回closeと解除。
 * @oracle 最初のunconfirmed結果は同じまま、対応終端以前に購読を外さない。
 * @cleanup 対応する後続終端で局所購読を解除する。
 * @boundary PRL-UT-006=Direct Boundary: 先行終端／後着取得→内部lease候補
 */
test("同一Process lease候補は保留中closeで後着取得の購読を失わない", async () => {
  const fixture = createLeaseNotificationFixture();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    new AbortController().signal,
  );
  const deadline = [...fixture.state.deadlines][0];
  assert.ok(deadline);
  deadline();
  const firstEnd = await owner.release();
  assert.equal(firstEnd.status, "unconfirmed");
  assert.equal(fixture.state.calls.includes("close"), false);
  fixture.state.listener?.({ kind: "server_closed" });
  assert.notEqual(fixture.state.listener, null);
  fixture.state.listener?.({ kind: "listening" });
  assert.notEqual(fixture.state.listener, null);
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
  assert.equal(owner.isHeld(), false);
  assert.equal(await owner.release(), firstEnd);
  fixture.state.listener?.({ kind: "server_closed" });
  assert.equal(fixture.state.listener, null);
  assert.equal(await owner.release(), firstEnd);
});

/**
 * listen例外を取得要求の不存在証明にしない。
 *
 * @responsibility 例外後の後着取得も同じOwnerで回収する。
 * @trace PRL-UT-006
 * @precondition listen依存が結果不明の例外を発生させる。
 * @stimulus 例外後にlisteningとServer closeを与える。
 * @observation unknown結果、購読残存、一回closeと最終解除。
 * @oracle 先行close0、後着後close1、旧結果は同一のunconfirmed。
 * @cleanup 後着した対応終端で局所購読を解除する。
 * @boundary PRL-UT-006=Direct Boundary: listen例外／後着通知→内部lease候補
 */
test("同一Process lease候補はlisten例外後も後着取得を処置する", async () => {
  const fixture = createLeaseNotificationFixture("listen");
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    new AbortController().signal,
  );
  const firstEnd = await owner.release();
  assert.equal(firstEnd.status, "unconfirmed");
  assert.notEqual(fixture.state.listener, null);
  assert.equal(fixture.state.calls.includes("close"), false);
  fixture.state.listener?.({ kind: "listening" });
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
  fixture.state.listener?.({ kind: "server_closed" });
  assert.equal(fixture.state.listener, null);
  assert.equal(await owner.release(), firstEnd);
});

/**
 * 取得期限の解除中に発生した取消を成功公開前に再確認する。
 *
 * @responsibility 依存処置と取得結果の間の取消窓を閉じる。
 * @trace PRL-UT-006
 * @precondition 期限解除依存だけが同じSignalを同期取消する。
 * @stimulus listen要求後にlisteningとServer closeを通知する。
 * @observation 保持中false、close一回とnot_acquired。
 * @oracle 取消済みの取得をacquiredとして公開しない。
 * @cleanup 通知終端で局所登録を解除する。実timer・handleはない。
 * @boundary PRL-UT-006=Direct Boundary: 期限解除中取消→内部lease候補
 */
test("同一Process lease候補は期限解除中の取消後に取得を公開しない", async () => {
  const fixture = createLeaseNotificationFixture();
  const signal = new AbortController();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    {
      ...fixture.dependencies,
      scheduleDeadline: (callback) => {
        const dispose = fixture.dependencies.scheduleDeadline(callback);
        return () => {
          dispose();
          signal.abort();
        };
      },
    },
    signal.signal,
  );
  fixture.state.listener?.({ kind: "listening" });
  assert.equal(owner.isHeld(), false);
  fixture.state.listener?.({ kind: "server_closed" });
  assert.equal((await owner.acquired).status, "not_acquired");
  assert.equal((await owner.release()).status, "closed");
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
});

/**
 * 通知解除中の同期再入でも終端処置を二重化しない。
 *
 * @responsibility 再入closeと終端後の不正socketを正常終端へ畳まない。
 * @trace PRL-UT-006
 * @precondition 取得後の同じOwnerで購読解除時に一回通知を再入させる。
 * @stimulus 解放とServer closeを与え、解除中に重複closeまたはsocket openを通知する。
 * @observation 解除回数、close回数、結果、後着socket終端要求。
 * @oracle 解除一回であり、不正socketはunconfirmed、重複closeはclosed_after_failure。
 * @cleanup 局所fixtureだけを破棄する。実資源・timerはない。
 * @boundary PRL-UT-006=Direct Boundary: 解除時再入通知→内部lease候補
 */
test("同一Process lease候補は購読解除時の再入を二重処置しない", async () => {
  for (const kind of ["server_closed", "socket_opened"] as const) {
    const fixture = createLeaseNotificationFixture();
    let disposals = 0;
    const owner = createIsolatedHostOperationInProcessLeaseCandidate(
      {
        ...fixture.dependencies,
        subscribe: (listener) => {
          fixture.dependencies.subscribe(listener);
          return () => {
            disposals += 1;
            if (kind === "server_closed") listener({ kind });
            else listener({ kind, socket: {} });
          };
        },
      },
      new AbortController().signal,
    );
    fixture.state.listener?.({ kind: "listening" });
    owner.release();
    fixture.state.listener?.({ kind: "server_closed" });
    assert.equal(disposals, 1);
    assert.equal(owner.isHeld(), false);
    assert.equal(
      (await owner.release()).status,
      kind === "socket_opened" ? "unconfirmed" : "closed_after_failure",
    );
    assert.equal(
      fixture.state.calls.filter((call) => call === "close").length,
      1,
    );
    if (kind === "socket_opened")
      assert.equal(
        fixture.state.calls.filter((call) => call === "closeSocket").length,
        1,
      );
  }
});

/**
 * 同期期限通知でも新しいlistenを発行しない。
 *
 * @responsibility scheduleDeadline内の再入と後着した解除責任を処置する。
 * @trace PRL-UT-006
 * @precondition 期限依存が登録中にcallbackを実行する。
 * @stimulus 同じ候補へ同期期限依存を渡す。
 * @observation 取得／終端結果、listen履歴と期限解除。
 * @oracle 未確認を保持しlisten0、後着の解除責任を一回処置する。
 * @cleanup 局所期限は解除する。実timer・handleは生成しない。
 * @boundary PRL-UT-006=Direct Boundary: 同期期限通知→内部lease候補
 */
test("同一Process lease候補は期限登録中の同期通知でもlistenしない", async () => {
  const fixture = createLeaseNotificationFixture();
  let disposed = 0;
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    {
      ...fixture.dependencies,
      scheduleDeadline: (callback) => {
        callback();
        return () => {
          disposed += 1;
        };
      },
    },
    new AbortController().signal,
  );
  assert.equal((await owner.acquired).status, "unconfirmed");
  assert.equal((await owner.release()).status, "unconfirmed");
  assert.equal(disposed, 1);
  assert.equal(fixture.state.calls.includes("listen"), false);
});

/**
 * 取得後取消と解放開始後の新接続を処置する。
 *
 * @responsibility 取消後も通知所有者を保持し、後着socketを未処置にしない。
 * @trace PRL-UT-006
 * @precondition 取得通知後のOwnerと未接続局所依存を使う。
 * @stimulus 取消後にsocket open、Server close、socket closeを与える。
 * @observation 保持中false、close一回、後着socketのclose要求と終端待機。
 * @oracle 取消後に保持中へ戻らず全socket通知後だけclosed。
 * @cleanup 通知終端でlistenerと期限を解除する。
 * @boundary PRL-UT-006=Direct Boundary: 取得後取消／後着socket→内部lease候補
 */
test("同一Process lease候補は取得後取消と後着socketを処置する", async () => {
  const fixture = createLeaseNotificationFixture();
  const signal = new AbortController();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    signal.signal,
  );
  fixture.state.listener?.({ kind: "listening" });
  assert.equal((await owner.acquired).status, "acquired");
  signal.abort();
  const socket = {};
  fixture.state.listener?.({ kind: "socket_opened", socket });
  assert.equal(owner.isHeld(), false);
  assert.equal(
    fixture.state.calls.filter((call) => call === "closeSocket").length,
    1,
  );
  fixture.state.listener?.({ kind: "server_closed" });
  fixture.state.listener?.({ kind: "socket_closed", socket });
  assert.equal((await owner.release()).status, "closed");
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
  assert.equal(fixture.state.listener, null);
});

/**
 * 取得前取消と登録中取消が新しいlistenを発行しないことを確認する。
 *
 * @responsibility 通知登録と取消の間を成功・資源終端へ既定化しない。
 * @trace PRL-UT-006
 * @precondition 実OS資源を持たない依存を使う。
 * @stimulus 開始前またはsubscribe中に取消し、同じOwnerを二回解放する。
 * @observation 取得結果、通知観測field、要求履歴と同じ解放Promise。
 * @oracle not_started、serverCloseObserved=false、listen／close要求0。
 * @cleanup 局所listenerは登録中取消で解除し、開始前取消では登録しない。
 * @boundary PRL-UT-006=Direct Boundary: Signal→内部lease候補
 */
test("同一Process lease候補は取得前・登録中取消でlistenを発行しない", async () => {
  for (const beforeSubscribe of [true, false]) {
    const signal = new AbortController();
    if (beforeSubscribe) signal.abort();
    const fixture = createLeaseNotificationFixture("none", () =>
      signal.abort(),
    );
    const owner = createIsolatedHostOperationInProcessLeaseCandidate(
      fixture.dependencies,
      signal.signal,
    );
    assert.deepEqual(await owner.acquired, { status: "not_acquired" });
    assert.equal(owner.isHeld(), false);
    assert.equal(owner.release(), owner.release());
    assert.deepEqual(await owner.release(), {
      status: "not_started",
      serverCloseObserved: false,
      socketsPending: 0,
    });
    assert.equal(fixture.state.listener, null);
    assert.equal(fixture.state.calls.includes("listen"), false);
    assert.equal(fixture.state.calls.includes("close"), false);
    assert.equal(fixture.state.deadlines.size, 0);
  }
});

/**
 * 正常取得から解放までを同じOwnerで処置する。
 *
 * @responsibility 取得期限を解放期限と分け、二重closeを拒否する。
 * @trace PRL-UT-006
 * @precondition 依存のlisten要求後だけlistening通知を与える。
 * @stimulus listening、二重release、server_closedを順に与える。
 * @observation 保持中の変化、期限集合、close回数、解除と終端結果。
 * @oracle close一回、同じPromise、通知終端後だけclosedを返す。
 * @cleanup 通知終端でlistenerと局所期限を解除する。
 * @boundary PRL-UT-006=Direct Boundary: Test通知→内部lease候補
 */
test("同一Process lease候補は取得期限を解除し二重解放を一回へ収束する", async () => {
  const fixture = createLeaseNotificationFixture();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    new AbortController().signal,
  );
  assert.equal(owner.isHeld(), false);
  assert.equal(fixture.state.deadlines.size, 1);
  fixture.state.listener?.({ kind: "listening" });
  assert.deepEqual(await owner.acquired, { status: "acquired" });
  assert.equal(owner.isHeld(), true);
  assert.equal(fixture.state.deadlines.size, 0);
  const end = owner.release();
  assert.equal(end, owner.release());
  assert.equal(owner.isHeld(), false);
  assert.equal(fixture.state.deadlines.size, 1);
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
  fixture.state.listener?.({ kind: "server_closed" });
  assert.deepEqual(await end, {
    status: "closed",
    serverCloseObserved: true,
    socketsPending: 0,
  });
  assert.equal(fixture.state.listener, null);
  assert.equal(fixture.state.deadlines.size, 0);
});

/**
 * 取得待機中の取消を後着listeningの処置へ接続する。
 *
 * @responsibility 取得通知が遅れても公開せず、同じOwnerが終端を待つ。
 * @trace PRL-UT-006
 * @precondition listen発行済みでlistening未通知。
 * @stimulus Signal取消後にlisteningとserver_closedを与える。
 * @observation 取消前後のclose要求、保持中、取得結果と終端結果。
 * @oracle 後着前close0、後着後close1、not_acquiredとclosed。
 * @cleanup 同じOwnerが通知と期限を解除する。
 * @boundary PRL-UT-006=Direct Boundary: 取消／後着通知→内部lease候補
 */
test("同一Process lease候補は取消後の後着取得を公開せず解放する", async () => {
  const fixture = createLeaseNotificationFixture();
  const signal = new AbortController();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    signal.signal,
  );
  signal.abort();
  assert.equal(fixture.state.calls.includes("close"), false);
  fixture.state.listener?.({ kind: "listening" });
  assert.equal(owner.isHeld(), false);
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
  fixture.state.listener?.({ kind: "server_closed" });
  assert.deepEqual(await owner.acquired, { status: "not_acquired" });
  assert.equal((await owner.release()).status, "closed");
});

/**
 * Server通知だけではsocket終端を完了扱いしない。
 *
 * @responsibility 受理socketをIdentity単位で一回閉じ、全通知まで待機する。
 * @trace PRL-UT-006
 * @precondition 実socketではなく二つの参照Identityを使う。
 * @stimulus 取得後socket二つを通知し、release、Server close、各socket closeを与える。
 * @observation closeSocket回数、Promise確定有無とlistener／期限の残存。
 * @oracle socket一件でも保留なら未確定、二件終端後にclosed。
 * @cleanup 終端通知後に局所登録を解除する。
 * @boundary PRL-UT-006=Direct Boundary: socket通知→内部lease候補
 */
test("同一Process lease候補はServer close後も個別socketの終端を待つ", async () => {
  const fixture = createLeaseNotificationFixture();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    new AbortController().signal,
  );
  const first = {};
  const second = {};
  fixture.state.listener?.({ kind: "listening" });
  fixture.state.listener?.({ kind: "socket_opened", socket: first });
  fixture.state.listener?.({ kind: "socket_opened", socket: second });
  let settled = false;
  const end = owner.release();
  void end.then(() => {
    settled = true;
  });
  owner.release();
  assert.equal(
    fixture.state.calls.filter((call) => call === "closeSocket").length,
    2,
  );
  fixture.state.listener?.({ kind: "server_closed" });
  fixture.state.listener?.({ kind: "socket_closed", socket: first });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.notEqual(fixture.state.listener, null);
  fixture.state.listener?.({ kind: "socket_closed", socket: second });
  assert.equal((await end).status, "closed");
  assert.equal(settled, true);
  assert.equal(fixture.state.deadlines.size, 0);
});

/**
 * 通知失敗を保持中へ戻さず、成功との差を保つ。
 *
 * @responsibility bind失敗、重複取得と不正socket通知の反例を処置する。
 * @trace PRL-UT-006
 * @precondition listen要求後の局所通知だけを与える。
 * @stimulus 各失敗通知を与え、Server終端まで処置する。
 * @observation close一回、保持中falseとclosed_after_failure。
 * @oracle 通知不整合を正常closedへ畳まない。
 * @cleanup 全局所caseでlistenerと期限を解除する。
 * @boundary PRL-UT-006=Direct Boundary: 不正通知→内部lease候補
 */
test("同一Process lease候補は通知不整合を正常終端へ畳まない", async () => {
  for (const kind of [
    "listen_failed",
    "duplicate_listening",
    "unknown_socket",
    "duplicate_socket",
  ] as const) {
    const fixture = createLeaseNotificationFixture();
    const owner = createIsolatedHostOperationInProcessLeaseCandidate(
      fixture.dependencies,
      new AbortController().signal,
    );
    if (kind === "listen_failed")
      fixture.state.listener?.({ kind: "listen_failed" });
    else {
      fixture.state.listener?.({ kind: "listening" });
      if (kind === "duplicate_listening")
        fixture.state.listener?.({ kind: "listening" });
      else if (kind === "unknown_socket")
        fixture.state.listener?.({ kind: "socket_closed", socket: {} });
      else {
        const socket = {};
        fixture.state.listener?.({ kind: "socket_opened", socket });
        fixture.state.listener?.({ kind: "socket_opened", socket });
        fixture.state.listener?.({ kind: "socket_closed", socket });
      }
    }
    assert.equal(owner.isHeld(), false);
    fixture.state.listener?.({ kind: "server_closed" });
    assert.equal((await owner.release()).status, "closed_after_failure");
    assert.equal(
      fixture.state.calls.filter((call) => call === "close").length,
      1,
    );
    assert.equal(fixture.state.deadlines.size, 0);
  }
});

/**
 * 解放期限を超えても後着資源を所有し続ける。
 *
 * @responsibility 未確認結果を後着成功で上書きせず、通知解除は後着終端で処置する。
 * @trace PRL-UT-006
 * @precondition 取得保留中のOwnerと局所期限callbackを保持する。
 * @stimulus 期限callback、後着listening、後着Server closeを順に与える。
 * @observation 確定したunconfirmed、close回数と通知解除。
 * @oracle 終端後も同じPromiseのunconfirmedを維持し、新しい取得を発行しない。
 * @cleanup 後着終端で局所listenerと期限を解除する。
 * @boundary PRL-UT-006=Direct Boundary: 期限／後着通知→内部lease候補
 */
test("同一Process lease候補は期限不明の結果を後着終端で上書きしない", async () => {
  const fixture = createLeaseNotificationFixture();
  const owner = createIsolatedHostOperationInProcessLeaseCandidate(
    fixture.dependencies,
    new AbortController().signal,
  );
  const timeout = [...fixture.state.deadlines][0];
  assert.ok(timeout);
  timeout();
  assert.deepEqual(await owner.acquired, { status: "unconfirmed" });
  const end = owner.release();
  const before = await end;
  assert.equal(before.status, "unconfirmed");
  assert.equal(owner.isHeld(), false);
  fixture.state.listener?.({ kind: "listening" });
  fixture.state.listener?.({ kind: "server_closed" });
  assert.equal(await owner.release(), before);
  assert.equal(fixture.state.listener, null);
  assert.equal(
    fixture.state.calls.filter((call) => call === "listen").length,
    1,
  );
  assert.equal(
    fixture.state.calls.filter((call) => call === "close").length,
    1,
  );
});

/**
 * 依存例外を成功へ既定化しない。
 *
 * @responsibility 通知登録、開始、期限、解放と登録解除の不明を保持する。
 * @trace PRL-UT-006
 * @precondition 各caseは一つの局所依存だけをthrowへ変える。
 * @stimulus 取得または解放を例外地点まで進める。
 * @observation unconfirmed、保持中false、一回のclose要求と同じ結果。
 * @oracle 例外後にacquired／closedを新規公開せず、再取得しない。
 * @cleanup 未解除の局所callbackはfixtureごとに破棄する。実資源・timerは存在しない。
 * @boundary PRL-UT-006=Direct Boundary: 依存例外→内部lease候補
 */
test("同一Process lease候補は依存例外を終端未確認として保持する", async () => {
  for (const fault of [
    "subscribe",
    "listen",
    "close",
    "closeSocket",
    "deadline",
    "clearDeadline",
    "unsubscribe",
  ] as const) {
    const fixture = createLeaseNotificationFixture(fault);
    const owner = createIsolatedHostOperationInProcessLeaseCandidate(
      fixture.dependencies,
      new AbortController().signal,
    );
    if (
      ["close", "closeSocket", "clearDeadline", "unsubscribe"].includes(fault)
    ) {
      fixture.state.listener?.({ kind: "listening" });
      if (fault === "closeSocket")
        fixture.state.listener?.({ kind: "socket_opened", socket: {} });
      owner.release();
      if (fault === "unsubscribe")
        fixture.state.listener?.({ kind: "server_closed" });
    }
    assert.equal(owner.isHeld(), false);
    const end = owner.release();
    assert.equal(end, owner.release());
    assert.equal((await end).status, "unconfirmed");
    assert.ok(
      fixture.state.calls.filter((call) => call === "close").length <= 1,
    );
  }
});

/**
 * 要求前の同期通知を取得成功へ読み替えない。
 *
 * @responsibility subscribeの再入通知と解除責任の後着を照合する。
 * @trace PRL-UT-006
 * @precondition subscribe中に通知を発生させる不正な局所依存。
 * @stimulus listeningまたはServer closeをlisten要求前に渡す。
 * @observation 取得／終端未確認、listen0と後着した登録解除。
 * @oracle 不正通知から保持中や正常終端を返さない。
 * @cleanup Server終端を通知したcaseでは後着の解除責任も回収する。
 * @boundary PRL-UT-006=Direct Boundary: subscribe再入通知→内部lease候補
 */
test("同一Process lease候補は要求前通知を成功にしない", async () => {
  for (const kind of ["listening", "server_closed"] as const) {
    const fixture = createLeaseNotificationFixture("none", (listener) =>
      listener({ kind }),
    );
    const owner = createIsolatedHostOperationInProcessLeaseCandidate(
      fixture.dependencies,
      new AbortController().signal,
    );
    assert.equal((await owner.acquired).status, "unconfirmed");
    assert.equal(owner.isHeld(), false);
    assert.equal((await owner.release()).status, "unconfirmed");
    assert.equal(fixture.state.calls.includes("listen"), false);
    if (kind === "server_closed") assert.equal(fixture.state.listener, null);
  }
});

/**
 * 共有Directoryの初期化と不明分類を局所依存で確認する。
 *
 * @responsibility mkdirだけのEEXIST合流、fresh検証、全失敗の保持を確認する。
 * @trace PRL-UT-006
 * @precondition 実Filesystem・Process・本番Capabilityを使わない。
 * @stimulus 存在観測、mkdir、検証の各段階へ成功・競合・失敗を与える。
 * @observation 依存呼出し順、返却Identity、InitializationFailure分類を記録する。
 * @oracle 検証済み結果だけを返し、不明時は清掃未確認・回復IDなしを保持する。
 * @cleanup N/A: 同期局所値だけであり、削除依存・I/O・handleを持たない。
 * @boundary PRL-UT-006=Direct Boundary: Test依存→本番共有初期化settlement
 */
test("共有回復DirectoryはOperation失敗で削除せず、競合後もfresh検証する", async (t) => {
  const existsError = Object.assign(new Error("exists"), { code: "EEXIST" });
  const cases: ReadonlyArray<{
    name: string;
    before: "present" | "confirmed_absent" | "unknown";
    observationError?: Error;
    creationError?: Error;
    validationError?: Error;
    succeeds: boolean;
    calls: string[];
  }> = [
    {
      name: "既存の検証成功",
      before: "present",
      succeeds: true,
      calls: ["observe", "validate"],
    },
    {
      name: "作成後の検証成功",
      before: "confirmed_absent",
      succeeds: true,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "mkdir存在競合後の検証成功",
      before: "confirmed_absent",
      creationError: existsError,
      succeeds: true,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "初期観測unknown",
      before: "unknown",
      succeeds: false,
      calls: ["observe"],
    },
    {
      name: "初期観測throw",
      before: "present",
      observationError: new Error("observation_failed"),
      succeeds: false,
      calls: ["observe"],
    },
    {
      name: "mkdir結果不明",
      before: "confirmed_absent",
      creationError: new Error("create_unknown"),
      succeeds: false,
      calls: ["observe", "create"],
    },
    {
      name: "mkdir後Identity取得throw",
      before: "confirmed_absent",
      validationError: new Error("identity_unknown"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "既存Directory検証失敗",
      before: "present",
      validationError: new Error("untrusted_directory"),
      succeeds: false,
      calls: ["observe", "validate"],
    },
    {
      name: "EEXIST後のPath不一致",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("path_mismatch"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "EEXIST後のreparse拒否",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("reparse_rejected"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "EEXIST後Identity取得throw",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("identity_unknown"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "EEXIST後の検証unknown",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("validation_unknown"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "検証で発生したEEXISTは合流しない",
      before: "present",
      validationError: existsError,
      succeeds: false,
      calls: ["observe", "validate"],
    },
  ];
  for (const condition of cases) {
    /**
     * 指定した共有初期化条件の結果と呼出し順を確認する。
     *
     * @responsibility 存在通知だけの成功化と、失敗時の清掃確認trueへの既定化を拒否する。
     * @trace PRL-UT-006
     * @precondition 各conditionが成功または一つの失敗段階を指定する。
     * @stimulus 同じ本番settlementへ非Authority依存を一回渡す。
     * @observation 呼出し順、同じ返却Identity、清掃未確認とnull回復ID。
     * @oracle conditionの固定期待値と一致し、削除・marker・Root依存が存在しない。
     * @cleanup N/A: 局所同期値だけであり、実資源を生成しない。
     * @boundary PRL-UT-006=Direct Boundary: Test依存→共有初期化settlement
     */
    await t.test(condition.name, () => {
      const calls: string[] = [];
      const directory = Object.freeze({
        directory: "non-authority-fixture",
        identity: Object.freeze({ dev: 1n, ino: 2n, birthtimeNs: 3n }),
      });
      const candidate = createIsolatedSharedHostRecoveryDirectoryCandidate({
        observe: () => {
          calls.push("observe");
          if (condition.observationError) throw condition.observationError;
          return condition.before;
        },
        create: () => {
          calls.push("create");
          if (condition.creationError) throw condition.creationError;
        },
        validate: () => {
          calls.push("validate");
          if (condition.validationError) throw condition.validationError;
          return directory;
        },
      });
      assert.equal(candidate.productionAuthority, false);
      if (condition.succeeds) {
        assert.equal(candidate.initialize(), directory);
      } else {
        let failure: unknown = null;
        assert.throws(
          () => {
            try {
              candidate.initialize();
            } catch (error) {
              failure = error;
              throw error;
            }
          },
          { message: "host_recovery_initialization_failed" },
        );
        assert.deepEqual(candidate.classifyFailure(failure), {
          cleanupConfirmed: false,
          hostRecoveryId: null,
        });
      }
      assert.deepEqual(calls, condition.calls);
    });
  }
});

/**
 * 後着取得を制御する非Authorityのfixtureを構築する。
 *
 * @responsibility 取得、再検証、公開、解放、停止の回数と順序を観測する。
 * @trace PRL-UT-006
 * @precondition OS Process・Filesystem・本番Capabilityを使わない。
 * @stimulus 取得を保留し、現在性と解放結果を変更してから結果を渡す。
 * @observation 取得Lockの公開・保持・解放とprocess停止の呼出しを記録する。
 * @oracle 呼出し元が同じLockの一回搬送または一回回収を判定する。
 * @cleanup 保留した取得・解放Promiseを終端化する。未使用通知PromiseのstubはI/O・handleを持たない。
 * @boundary PRL-UT-006=Direct Boundary: Test依存→本番settlement
 */
function createLockActivationFixture() {
  const events: string[] = [];
  let shouldFailValidation = false;
  let releaseResult:
    | "released"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown" = "released";
  let shouldFailRelease = false;
  let finishRelease: (() => void) | null = null;
  let releaseBarrier: Promise<void> | null = null;
  const lock = Object.freeze({
    assertLive: () => true,
    onFailureDetected: () => () => undefined,
    failureDetected: new Promise<void>(() => {}),
    loss: new Promise<"cleanup_confirmed_failure" | "cleanup_unknown">(
      () => {},
    ),
    confirmReady: async () => "ready" as const,
    release: async () => {
      events.push("release");
      if (releaseBarrier) await releaseBarrier;
      if (shouldFailRelease) throw new Error("release_failed");
      events.push("release_settled");
      return releaseResult;
    },
  });
  let existingReleaseCount = 0;
  const existingLock = Object.freeze({
    ...lock,
    release: async () => {
      existingReleaseCount += 1;
      return "released" as const;
    },
  });
  const before = Object.freeze({
    binding: {},
    identity: {},
    generation: {},
    recordHash: "original_hash",
    retired: false,
    lock: null,
  });
  let current: Readonly<{
    binding: object;
    identity: object;
    generation: object;
    recordHash: string;
    retired: boolean;
    lock: typeof lock | null;
  }> = before;
  /**
   * 非Authority fixtureで搬送する取得結果を定義する。
   *
   * @responsibility 取得状態と試験Lockの有無を保持する。
   * @trace PRL-UT-006
   * @shape 固定statusと局所Lockまたはnullを持つ。
   * @invariant 本番のOS Lockを含めない。
   * @boundary PRL-UT-006=Direct Boundary: fixture→取得settlement
   * @security 回復Authorityを発行しない。
   * @compatibility 本番Supervisorの状態語彙を使う。
   */
  type Outcome = Readonly<{
    status:
      | "acquired"
      | "unavailable"
      | "cleanup_confirmed_failure"
      | "cleanup_unknown";
    lock: typeof lock | null;
  }>;
  let complete: (value: Outcome) => void = () => {
    throw new Error("not_initialized");
  };
  let reject: (error: Error) => void = () => {
    throw new Error("not_initialized");
  };
  const acquisition = new Promise<Outcome>((resolve, rejectPromise) => {
    complete = resolve;
    reject = rejectPromise;
  });
  const candidate = createIsolatedHostOperationLockActivationCandidate({
    before,
    acquire: () => acquisition,
    readCurrent: () => {
      events.push("revalidate");
      if (shouldFailValidation) throw new Error("observation_unknown");
      return current;
    },
    publish: (actual) => {
      assert.equal(actual, lock);
      events.push("publish");
    },
    retainUnknown: (actual) => {
      assert.ok(actual === lock || actual === null);
      events.push(actual === null ? "retire_without_lock" : "retain_unknown");
    },
    poison: () => {
      events.push("poison");
    },
  });
  return {
    candidate,
    events,
    lock,
    complete,
    reject,
    /**
     * 現在世代へ単独の不一致を与える。
     *
     * @responsibility 指定した現在性の反例だけを設定する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 失効または参照・Hash・Lockの差分を与える。
     * @observation 次のreadCurrentが返すsnapshot。
     * @oracle 捕捉値は変えずcurrentだけ変更する。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    invalidate: (
      kind:
        | "retired"
        | "replacement"
        | "identity"
        | "generation"
        | "record_hash_changed"
        | "existing_lock" = "retired",
    ) => {
      if (kind === "retired") current = { ...current, retired: true };
      if (kind === "replacement") current = { ...current, binding: {} };
      if (kind === "identity") current = { ...current, identity: {} };
      if (kind === "generation") current = { ...current, generation: {} };
      if (kind === "record_hash_changed")
        current = { ...current, recordHash: "changed_hash" };
      if (kind === "existing_lock")
        current = { ...current, lock: existingLock };
    },
    /**
     * 既存Lockへの解放回数を読む。
     *
     * @responsibility 新取得Lockと既存Lockの操作を区別する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus カウンタを同期取得する。
     * @observation 既存Lockのrelease呼出し回数。
     * @oracle 正常な拒否処理では0である。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    readExistingReleaseCount: () => existingReleaseCount,
    /**
     * 現在世代の再観測を失敗させる。
     *
     * @responsibility 観測不能を一致と誤認させない反例を作る。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 次のreadCurrentでthrowする。
     * @observation revalidateイベントと公開・回収結果。
     * @oracle 失敗を現在性成立へ畳まない。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    failValidation: () => {
      shouldFailValidation = true;
    },
    /**
     * 新取得Lockの解放結果を指定する。
     *
     * @responsibility 回収確認と不明の分類を準備する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 固定されたrelease結果を設定する。
     * @observation releaseの返すstatus。
     * @oracle 本番と同じ状態語彙以外を作らない。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    setRelease: (result: typeof releaseResult) => {
      releaseResult = result;
    },
    /**
     * 新取得Lockの解放を例外終了させる。
     *
     * @responsibility 回収要求と回収完了を分離する反例を作る。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus releaseをthrowさせる。
     * @observation releaseイベントとpoison。
     * @oracle 例外を解放成功と扱わない。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    failRelease: () => {
      shouldFailRelease = true;
    },
    /**
     * 新取得Lockの解放終端を保留する。
     *
     * @responsibility 実終端前にactivateが完了しないことを準備する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 局所releaseBarrierを設定する。
     * @observation releaseイベントと保留Promise。
     * @oracle 外部資源なしで終端を保留する。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    pauseRelease: () => {
      releaseBarrier = new Promise<void>((resolve) => {
        finishRelease = resolve;
      });
    },
    /**
     * 保留した新取得Lockの解放を終端化する。
     *
     * @responsibility 試験が保留した局所Promiseを解決する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 保持したresolveを一回呼ぶ。
     * @observation release_settledとactivateの終端。
     * @oracle 保留解除後にだけactivateが終わる。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    finishRelease: () => {
      assert.ok(finishRelease);
      finishRelease();
    },
  };
}

/**
 * 後着取得の有限な成立・拒否・観測不能の母集団を検証する。
 *
 * @responsibility 公開一回、後着回収一回、回収実終端待ち、unknown停止を判定する。
 * @trace PRL-UT-006
 * @precondition 非Authority fixtureだけを使用し、既存Root・Processには操作しない。
 * @stimulus 現在性、取得結果、再検証throw、解放結果、遅延解放を組み合わせる。
 * @observation events、公開結果、保留中のPromise状態を観測する。
 * @oracle 不一致では公開・保持0。回収不明はpoison。実終端前には返却しない。
 * @cleanup 保留した取得・解放Promiseを全て終端させる。
 * @boundary PRL-UT-006=Direct Boundary: Test→本番取得settlement
 */
test("Host Lockの後着取得を再検証し、新取得Lockだけを回収する", async (t) => {
  /**
   * 取得成功を現在世代へ一回だけ搬送する。
   *
   * @responsibility 取得成功を現在世代へ一回だけ搬送する。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus 未変更世代へacquiredを返す。
   * @observation revalidateとpublishの順序。
   * @oracle 公開一回、解放・停止0。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("同じ現在世代へ一回だけ公開する", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    assert.equal(h.candidate.productionAuthority, false);
    h.complete({ status: "acquired", lock: h.lock });
    assert.equal(await result, "activated");
    assert.deepEqual(h.events, ["revalidate", "publish"]);
  });
  for (const invalidation of [
    "retired",
    "replacement",
    "identity",
    "generation",
    "record_hash_changed",
    "existing_lock",
  ] as const) {
    /**
     * 六種類の失効差分を個別に拒否する。
     *
     * @responsibility 六種類の失効差分を個別に拒否する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 取得待機中に現在snapshotを変更する。
     * @observation release回数、公開回数、既存Lock操作。
     * @oracle 新Lock一回解放、公開0、既存Lock操作0。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(`${invalidation}: 待機中の失効後は公開しない`, async () => {
      const h = createLockActivationFixture();
      const result = h.candidate.activate();
      h.invalidate(invalidation);
      h.complete({ status: "acquired", lock: h.lock });
      assert.equal(await result, "cleanup_confirmed_failure");
      assert.deepEqual(h.events, ["revalidate", "release", "release_settled"]);
      assert.equal(h.readExistingReleaseCount(), 0);
    });
  }
  /**
   * 観測不能な後着取得を公開しない。
   *
   * @responsibility 観測不能な後着取得を公開しない。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus readCurrentをthrowさせる。
   * @observation 公開とreleaseのイベント。
   * @oracle 新取得Lockだけを回収する。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("再検証の観測不能も後着Lockを回収する", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    h.failValidation();
    h.complete({ status: "acquired", lock: h.lock });
    assert.equal(await result, "cleanup_confirmed_failure");
    assert.deepEqual(h.events, ["revalidate", "release", "release_settled"]);
  });
  for (const outcome of ["unavailable", "cleanup_confirmed_failure"] as const) {
    /**
     * 既知の非取得分類を保持する。
     *
     * @responsibility 既知の非取得分類を保持する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus Lockなしで非取得結果を返す。
     * @observation 返却statusとイベント。
     * @oracle 元分類を維持し状態変更0。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(`${outcome}: Lockなしの元分類を保持する`, async () => {
      const h = createLockActivationFixture();
      const result = h.candidate.activate();
      h.complete({ status: outcome, lock: null });
      assert.equal(await result, outcome);
      assert.deepEqual(h.events, []);
    });
  }
  for (const failure of ["unknown", "throw"] as const) {
    /**
     * 解放不明またはthrowを停止へ収束する。
     *
     * @responsibility 解放不明またはthrowを停止へ収束する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 失効後の解放結果を不明にする。
     * @observation release回数、poison、公開有無。
     * @oracle 一回回収要求、公開0、poison。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(
      `${failure}: 後着Lock回収不明はprocessを停止対象にする`,
      async () => {
        const h = createLockActivationFixture();
        const result = h.candidate.activate();
        h.invalidate();
        if (failure === "unknown") h.setRelease("cleanup_unknown");
        else h.failRelease();
        h.complete({ status: "acquired", lock: h.lock });
        assert.equal(await result, "cleanup_unknown");
        assert.equal(h.events.filter((event) => event === "release").length, 1);
        assert.equal(h.events.at(-1), "poison");
        assert.equal(h.events.includes("publish"), false);
      },
    );
  }
  for (const isCurrentGeneration of [true, false]) {
    /**
     * Lockを伴う不明結果の保持先を再照合する。
     *
     * @responsibility Lockを伴う不明結果の保持先を再照合する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 現在または失効世代へ不明結果を返す。
     * @observation 保持・解放・停止の順序。
     * @oracle 現在だけ保持、staleは新Lockだけ回収。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(
      `Lockを伴うcleanup_unknown: 現在性=${isCurrentGeneration}`,
      async () => {
        const h = createLockActivationFixture();
        const result = h.candidate.activate();
        if (!isCurrentGeneration) h.invalidate();
        h.complete({ status: "cleanup_unknown", lock: h.lock });
        assert.equal(await result, "cleanup_unknown");
        assert.deepEqual(
          h.events,
          isCurrentGeneration
            ? ["revalidate", "retain_unknown", "poison"]
            : ["revalidate", "release", "release_settled", "poison"],
        );
      },
    );
  }

  for (const acquisitionKind of ["unknown_result", "throw"] as const) {
    for (const generationState of [
      "current",
      "retired",
      "replacement",
      "identity",
      "generation",
      "record_hash_changed",
      "existing_lock",
      "unobservable",
    ] as const) {
      /**
       * Lockなし不明でも現在世代の失効を維持する。
       *
       * @responsibility Lockなし不明でも現在世代の失効を維持する。
       * @trace PRL-UT-006
       * @precondition 非Authority fixtureを使い、OS資源を作成しない。
       * @stimulus 不明結果または取得throwに八種類の現在性を与える。
       * @observation retire_without_lock、poison、既存Lock操作。
       * @oracle 現在だけ失効、他は状態変更0、全件停止。
       * @cleanup 保留した取得・解放Promiseを終端まで処置する。
       * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
       */
      await t.test(
        `${acquisitionKind}: Lockなし不明・現在性=${generationState}`,
        async () => {
          const h = createLockActivationFixture();
          const result = h.candidate.activate();
          if (generationState === "unobservable") h.failValidation();
          else if (generationState !== "current") h.invalidate(generationState);
          if (acquisitionKind === "throw")
            h.reject(new Error("acquisition_unknown"));
          else h.complete({ status: "cleanup_unknown", lock: null });
          assert.equal(await result, "cleanup_unknown");
          assert.deepEqual(
            h.events,
            generationState === "current"
              ? ["revalidate", "retire_without_lock", "poison"]
              : ["revalidate", "poison"],
          );
          assert.equal(h.readExistingReleaseCount(), 0);
        },
      );
    }
  }
  /**
   * 確認付き失敗を回収不明へ強めない。
   *
   * @responsibility 確認付き失敗を回収不明へ強めない。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus releaseがcleanup_confirmed_failureを返す。
   * @observation 返却statusとrelease終端。
   * @oracle 元の失敗分類を保ちpoison0。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("後着Lockの回収確認付き失敗分類を保持する", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    h.invalidate();
    h.setRelease("cleanup_confirmed_failure");
    h.complete({ status: "acquired", lock: h.lock });
    assert.equal(await result, "cleanup_confirmed_failure");
    assert.deepEqual(h.events, ["revalidate", "release", "release_settled"]);
    assert.equal(h.readExistingReleaseCount(), 0);
  });
  /**
   * 取得例外時もfreshな現在世代を失効させる。
   *
   * @responsibility 取得例外時もfreshな現在世代を失効させる。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus 取得Promiseをrejectする。
   * @observation 再照合、失効、poisonの順序。
   * @oracle 現在世代の失効と停止を維持する。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("取得Promise例外を正常・非取得へ畳まない", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    h.reject(new Error("acquisition_outcome_unknown"));
    assert.equal(await result, "cleanup_unknown");
    assert.deepEqual(h.events, ["revalidate", "retire_without_lock", "poison"]);
  });
  /**
   * 後着Lockの実終端待機を保持する。
   *
   * @responsibility 後着Lockの実終端待機を保持する。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus 取得後のreleaseを保留する。
   * @observation activateの保留とrelease_settled。
   * @oracle 実終端前に結果を返さない。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test(
    "呼出側の待機が終わっても後着回収の実終端まで処理を保持する",
    async () => {
      const h = createLockActivationFixture();
      h.pauseRelease();
      let activationSettled = false;
      const result = h.candidate.activate().then((value) => {
        activationSettled = true;
        return value;
      });
      h.invalidate();
      h.complete({ status: "acquired", lock: h.lock });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(activationSettled, false);
      assert.deepEqual(h.events, ["revalidate", "release"]);
      h.finishRelease();
      assert.equal(await result, "cleanup_confirmed_failure");
    },
  );
});
