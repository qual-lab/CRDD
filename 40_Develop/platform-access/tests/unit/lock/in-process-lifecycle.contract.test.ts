/**
 * 同一Processのpipe排他における通知・取消・終了を検証する。
 * @packageDocumentation
 * @responsibility 実資源を使わず既存通知状態機械の失敗・遅延・解放を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope platform-access、in-process-pipe、通知と終端
 * @boundary PRL-UT-006=Direct Boundary: 合成通知→PA排他Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { acquireHostTerminalCallerPipeLease } from "../../../src/index.ts";
import {
  createInProcessPipeLease,
  type InProcessPipeLeaseDependencies,
  type InProcessPipeLeaseEvent,
} from "../../../src/lock/in-process-lifecycle.ts";

/**
 * caller専用namespace以外のpipeを取得前に拒否する。
 * @responsibility 新しい公開技術入口の対象拡張を反証する。
 * @trace PRL-UT-006
 * @precondition 実pipeを作成せず、不正名だけを使用する。
 * @stimulus 別用途、Hash長・大小文字・suffixの差を渡す。
 * @observation 同期の境界拒否。
 * @oracle すべて既存の境界理由で拒否しOwnerを返さない。
 * @cleanup N/A: Server生成前の拒否のみ。
 * @boundary PA公開入口の固定IPC名文法。
 */
test("caller pipeは固定namespaceと64桁小文字Hash以外を拒否する", () => {
  const prefix = String.raw`\\.\pipe\crdd-host-terminal-caller-`;
  for (const name of [
    "",
    "other",
    `${prefix}${"a".repeat(63)}`,
    `${prefix}${"a".repeat(65)}`,
    `${prefix}${"A".repeat(64)}`,
    `${prefix}${"a".repeat(64)}-extra`,
    String.raw`\\.\pipe\other-${"a".repeat(64)}`,
  ]) {
    assert.throws(
      () =>
        acquireHostTerminalCallerPipeLease(name, new AbortController().signal),
      /host_terminal_caller_lease_boundary_invalid/,
    );
  }
});

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
  onSubscribe?: (listener: (event: InProcessPipeLeaseEvent) => void) => void,
) {
  const state = {
    listener: null as ((event: InProcessPipeLeaseEvent) => void) | null,
    calls: [] as string[],
    deadlines: new Set<() => void>(),
  };
  const dependencies: InProcessPipeLeaseDependencies = {
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
  const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(
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
    const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(fixture.dependencies, signal.signal);
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
  for (const isBeforeSubscribe of [true, false]) {
    const signal = new AbortController();
    if (isBeforeSubscribe) signal.abort();
    const fixture = createLeaseNotificationFixture("none", () =>
      signal.abort(),
    );
    const owner = createInProcessPipeLease(fixture.dependencies, signal.signal);
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
  const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(fixture.dependencies, signal.signal);
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
  const owner = createInProcessPipeLease(
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
    const owner = createInProcessPipeLease(
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
  const owner = createInProcessPipeLease(
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
    const owner = createInProcessPipeLease(
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
    const owner = createInProcessPipeLease(
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
