/**
 * 固定九目的Sessionの要求・取消・清掃を検証する。
 * @packageDocumentation
 * @responsibility 実Session本文と注入Handleの境界を反証し、実Dockerの成立とは分ける。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope 固定技術順序、同期Gate、元Handle終端と清掃。
 * @boundary ERB-IT-002=Adjacent 1 Block: Session→模擬Handle。ERB-IT-004=Direct Boundary: Session→模擬清掃Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  startDockerCommandSessionCandidate,
  describeDockerCommandSessionContract,
  type DockerExecutionHooks,
  type DockerIsolationCommand,
  type CommandObservation,
} from "../../src/index.ts";

const PURPOSES = [
  "create_subscription_auth_probe",
  "start_subscription_auth_probe_attached",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_egress",
  "create_provider",
  "start_proxy",
  "start_provider_attached",
] as const;
/**
 * 模擬Handleへ渡せる固定用途。
 * @responsibility 本番と同じ閉じた用途だけを試験で使用する。
 * @trace ERB-IT-004
 * @shape 九目的の文字列union。
 * @invariant 任意コマンド名へ拡張しない。
 * @boundary 模擬Session入力。
 * @security 型を実行許可へ昇格しない。
 * @compatibility 本番の固定purpose型へ一致させる。
 */
type Purpose = DockerIsolationCommand["purpose"];

/**
 * 試験の待機点を明示的に解放する。
 * @responsibility 実時間sleepではなく同じPromiseへ観測を接続する。
 * @trace ERB-IT-004
 * @precondition 試験が必ず元Promiseを解放する。
 * @stimulus 値をresolveする。
 * @observation 元のPromiseだけを待つ。
 * @oracle 別の待機で完了を代用しない。
 * @cleanup 保留を試験終了前に解放する。
 * @boundary 同一Processの試験待機。
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

/**
 * 元Sessionにだけ作用するHandleと清掃を構築する。
 * @responsibility 各要求・終端・清掃・通知の回数と順序を独立観測する。
 * @trace ERB-IT-004
 * @precondition 本番primitiveやDockerを使用しない。
 * @stimulus 固定計画と局所の待機・失敗を接続する。
 * @observation event列、wait期限、終端数と元結果を返す。
 * @oracle 既発生のEffectと取消要求・清掃を別々に判定できる。
 * @cleanup 保留Handle／清掃を解放して元completionを待つ。
 * @boundary Sessionと注入した模擬操作。
 */
function sessionFixture(
  options: Readonly<{
    hooks?: Partial<DockerExecutionHooks>;
    blocked?: Purpose;
    startConfirmed?: boolean;
    waitThrows?: boolean;
    cleanupBlocked?: boolean;
    cleanupThrows?: boolean;
    terminationConfirmed?: boolean;
    terminationThrows?: boolean;
  }> = {},
) {
  const events: string[] = [];
  const waits: Array<{ purpose: Purpose; timeout: number }> = [];
  const blocked = deferred<void>();
  const released = deferred<CommandObservation | null>();
  const cleanupEntered = deferred<void>();
  const cleanupReleased = deferred<void>();
  let terminations = 0;
  let cleanups = 0;
  let notifications = 0;
  const cleanup = Object.freeze({
    confirmed: true,
    processTreeTerminated: true,
    containersAbsent: true,
    networksAbsent: true,
    resourceObservations: Object.freeze([]),
  });
  const result = Object.freeze({
    status: 0,
    signal: null,
    stdout: "a".repeat(64),
    stderr: "",
    outputExceeded: false,
  });
  const session = startDockerCommandSessionCandidate(
    PURPOSES,
    {
      startCommand: (purpose) => {
        events.push(`start:${purpose}`);
        return {
          started: async () => options.startConfirmed ?? true,
          wait: async (timeout) => {
            waits.push({ purpose, timeout });
            if (options.waitThrows && purpose === "start_provider_attached")
              throw new Error("fixed_wait_failure");
            if (purpose === options.blocked) {
              blocked.resolve();
              return released.promise;
            }
            return result;
          },
          terminateAndWait: async () => {
            terminations++;
            events.push(`terminate:${purpose}`);
            if (options.terminationThrows)
              throw new Error("fixed_termination_failure");
            if (options.terminationConfirmed === false) return false;
            released.resolve(result);
            return true;
          },
        };
      },
      cleanup: async () => {
        cleanups++;
        events.push("cleanup");
        cleanupEntered.resolve();
        if (options.cleanupBlocked) await cleanupReleased.promise;
        if (options.cleanupThrows) throw new Error("fixed_cleanup_failure");
        return cleanup;
      },
      verifyCleanup: (value) =>
        value === cleanup ? cleanup.resourceObservations : null,
    },
    {
      allowCommand: () => true,
      recordSubmission: () => true,
      recordNotIssued: () => {
        events.push("not-issued");
        return true;
      },
      recordExecutionSubmission: () => true,
      recordReceipt: (purpose) => {
        events.push(`receipt:${purpose}`);
        return true;
      },
      acceptCommandResult: () => true,
      acceptOutput: () => true,
      onExecutionStarted: () => {
        notifications++;
        events.push("started");
      },
      onFailure: (failure) => {
        events.push(`failure:${failure.gate ?? failure.stage}`);
      },
      ...options.hooks,
    },
  );
  return {
    session,
    events,
    waits,
    blocked: blocked.promise,
    release: () => released.resolve(result),
    rejectWait: () => released.reject(new Error("EPIPE")),
    cleanupEntered: cleanupEntered.promise,
    releaseCleanup: () => cleanupReleased.resolve(),
    cleanup,
    counts: () => ({ terminations, cleanups, notifications }),
  };
}

/**
 * 返却前の非発行と固定順序・期限を確認する。
 * @responsibility 技術生涯を一回へ閉じ、終了後の再取消を無害にする。
 * @trace ERB-IT-004
 * @precondition 全模擬操作が正常完了する。
 * @stimulus Candidateの生成、元completion、終了後取消を実行する。
 * @observation 九要求、各待機期限、元清掃、登録解放と処置数。
 * @oracle 返却前0、正しい順序、清掃一回、終了後追加要求0。
 * @cleanup 元completionを待つ。実資源なし。
 * @boundary ERB-IT-004=Direct Boundary: Session→Handle／清掃。
 */
test("Sessionは返却後だけ固定九要求を実行し元清掃と期限を搬送する", async () => {
  const fixture = sessionFixture();
  assert.equal(fixture.session.productionAuthority, false);
  assert.deepEqual(fixture.events, [] as string[]);
  const result = await fixture.session.completion;
  assert.deepEqual(
    fixture.events.filter((value) => value.startsWith("start:")),
    PURPOSES.map((purpose) => `start:${purpose}`),
  );
  assert.deepEqual(
    fixture.waits.map((value) => value.timeout),
    [...Array(8).fill(10_000), 300_000],
  );
  assert.equal(
    describeDockerCommandSessionContract().providerDeadlineOrigin,
    "execution_started_observed",
  );
  assert.equal(result.failure, null);
  assert.equal(result.cleanup, fixture.cleanup);
  assert.equal(result.callbackRegistrationReleased, true);
  assert.equal(result.notificationDeliveryConfirmed, true);
  assert.equal(result.processTreeTerminationConfirmed, true);
  assert.deepEqual(fixture.counts(), {
    terminations: 0,
    cleanups: 1,
    notifications: 1,
  });
  await fixture.session.cancel();
  await fixture.session.cancel();
  assert.deepEqual(fixture.counts(), {
    terminations: 0,
    cleanups: 1,
    notifications: 1,
  });
});

/**
 * 全同期Gateの拒否種別を反証する。
 * @responsibility Promiseを同期保存成功へ丸めず後続要求を止める。
 * @trace ERB-IT-002
 * @precondition 各Gateだけを一つずつ不成立にする。
 * @stimulus false、throw、Promiseを返す。
 * @observation 最初のGate、拒否種別と清掃回数。
 * @oracle 元拒否が残り、清掃は一回。
 * @cleanup 全元completionを待つ。
 * @boundary ERB-IT-002=Direct Boundary: 同期Gateと技術発行。
 */
test("同期Gateのfalse・throw・Promiseは固定停止点として清掃へ戻る", async () => {
  for (const name of [
    "allowCommand",
    "recordSubmission",
    "recordExecutionSubmission",
    "recordReceipt",
    "acceptCommandResult",
    "acceptOutput",
  ] as const) {
    for (const mode of ["false", "throw", "promise"] as const) {
      const reject = (() => {
        if (mode === "throw") throw new Error("fixed_gate_failure");
        return mode === "promise" ? Promise.resolve(true) : false;
      }) as unknown as DockerExecutionHooks[typeof name];
      const fixture = sessionFixture({ hooks: { [name]: reject } });
      const result = await fixture.session.completion;
      assert.equal(result.failure?.gate, name);
      assert.equal(
        result.failure?.kind,
        mode === "false"
          ? "rejected"
          : mode === "throw"
            ? "threw"
            : "invalid_return",
      );
      assert.equal(fixture.counts().cleanups, 1);
      assert.equal(result.executionCompleted, false);
    }
  }
});

/**
 * intent後の再入取消を未発行保存へ接続する。
 * @responsibility 保存済みでもDocker要求前なら要求0を維持する。
 * @trace ERB-IT-002
 * @precondition 最初の予定保存中に同じ取消を要求する。
 * @stimulus 未発行保存を成功／拒否にする。
 * @observation start0、未発行保存一回、清掃一回。
 * @oracle 拒否は成功化せず元Gateを保持する。
 * @cleanup 元completionを待つ。
 * @boundary ERB-IT-002=Direct Boundary: 同期保存内の再入取消。
 */
test("intent保存中の取消は未発行を保存しDocker要求を一つも開始しない", async () => {
  for (const accepted of [true, false]) {
    let fixture!: ReturnType<typeof sessionFixture>;
    fixture = sessionFixture({
      hooks: {
        recordSubmission: () => {
          void fixture.session.cancel();
          return true;
        },
        recordNotIssued: () => {
          fixture.events.push("not-issued");
          return accepted;
        },
      },
    });
    const result = await fixture.session.completion;
    assert.equal(
      fixture.events.filter((value) => value.startsWith("start:")).length,
      0,
    );
    assert.equal(
      fixture.events.filter((value) => value === "not-issued").length,
      1,
    );
    assert.equal(
      result.failure?.gate ?? null,
      accepted ? null : "recordNotIssued",
    );
    assert.equal(fixture.counts().cleanups, 1);
  }
});

/**
 * 全五CREATEの取消競合でReceiptを先に残す。
 * @responsibility 元IDを失わず後続purposeを止める。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 対象CREATEの待機を保留する。
 * @stimulus 元Sessionを取り消し、終端が応答を確定する。
 * @observation 元Receipt、最後の要求と清掃順。
 * @oracle Receiptが清掃より前、次要求0、終端一回。
 * @cleanup 元completionを待つ。
 * @boundary ERB-IT-002=Direct Boundary: 取消→Handle終端。ERB-IT-004=Direct Boundary: Receipt→清掃。
 */
test("五CREATEの取消は成功Receipt保存を清掃より先に確定する", async () => {
  for (const purpose of [
    "create_subscription_auth_probe",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "create_provider",
  ] as const) {
    const fixture = sessionFixture({ blocked: purpose });
    await fixture.blocked;
    await fixture.session.cancel();
    const result = await fixture.session.completion;
    assert.equal(result.cancellationRequested, true);
    assert.equal(result.failure, null);
    assert.equal(
      fixture.events.filter((event) => event === `receipt:${purpose}`).length,
      1,
    );
    assert.equal(
      fixture.events.filter((event) => event === "cleanup").length,
      1,
    );
    assert.ok(fixture.events.indexOf(`receipt:${purpose}`) >= 0);
    assert.ok(fixture.events.indexOf("cleanup") >= 0);
    assert.ok(
      fixture.events.indexOf(`receipt:${purpose}`) <
        fixture.events.indexOf("cleanup"),
    );
    assert.equal(
      fixture.events.filter((event) => event.startsWith("start:")).at(-1),
      `start:${purpose}`,
    );
    assert.equal(fixture.counts().terminations, 1);
    assert.equal(fixture.counts().cleanups, 1);
  }
});

/**
 * 開始失敗と取消・待機失敗の競合を反証する。
 * @responsibility 元Handleの終端を二重発行せず一次失敗を残す。
 * @trace ERB-IT-002
 * @precondition 開始未確認または待機例外を注入する。
 * @stimulus 同時取消、清掃例外を発生させる。
 * @observation 通知数、終端数、元段階と清掃結果。
 * @oracle 開始未確認は通知0、競合は終端一回、清掃失敗でも一次段階維持。
 * @cleanup 全元completionを待つ。
 * @boundary ERB-IT-002=Direct Boundary: 開始／取消／終端競合。
 */
test("開始未確認と取消・失敗の競合は元停止点と終端一回を保持する", async () => {
  const notStarted = sessionFixture({ startConfirmed: false });
  const first = await notStarted.session.completion;
  assert.equal(first.failure?.kind, "start_unconfirmed");
  assert.equal(notStarted.counts().notifications, 0);
  assert.equal(notStarted.counts().terminations, 1);
  let fixture!: ReturnType<typeof sessionFixture>;
  fixture = sessionFixture({
    waitThrows: true,
    cleanupThrows: true,
    hooks: {
      onExecutionStarted: () => {
        void fixture.session.cancel();
      },
    },
  });
  const result = await fixture.session.completion;
  assert.equal(result.failure?.stage, "command_wait");
  assert.equal(result.failure?.kind, "threw");
  assert.equal(fixture.counts().terminations, 1);
  assert.equal(fixture.counts().cleanups, 1);
  assert.equal(result.cleanup.confirmed, false);
});

/**
 * 清掃中と終端後の取消を同じ生涯へ閉じる。
 * @responsibility 遅い取消で通知や処置を再発行しない。
 * @trace ERB-IT-004
 * @precondition 清掃の元Promiseを保留する。
 * @stimulus 清掃中の取消と解放後の重複取消を実行する。
 * @observation 取消flag、清掃数、通知数と登録解放。
 * @oracle 取消を失わず、元清掃以外の処置0。
 * @cleanup 保留清掃を解放して元completionを待つ。
 * @boundary ERB-IT-004=Direct Boundary: 清掃待機と取消。
 */
test("清掃中取消を保持し終端後の重複取消は追加処置を発行しない", async () => {
  const fixture = sessionFixture({ cleanupBlocked: true });
  await fixture.cleanupEntered;
  await fixture.session.cancel();
  fixture.releaseCleanup();
  const result = await fixture.session.completion;
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.callbackRegistrationReleased, true);
  const before = { ...fixture.counts() };
  await fixture.session.cancel();
  await fixture.session.cancel();
  assert.deepEqual(fixture.counts(), before);
});

/**
 * 開始通知の例外と非同期返却を受領済みにしない。
 * @responsibility 同期通知の破損後に追加callbackや重複Provider待機を発行しない。
 * @trace ERB-IT-002 ERB-IT-004
 * @precondition 通知だけが例外または拒否Promiseを返す。
 * @stimulus 固定九目的を開始して元完了を待つ。
 * @observation 配送確認、Provider待機、終端、清掃、後続callback数。
 * @oracle 配送未確認・通知前待機一回300秒・終端1・清掃1。拒否Promiseを未処理にしない。
 * @cleanup 元completionで回収する。実資源なし。
 * @boundary ERB-IT-002=Direct Boundary: 同期開始通知。ERB-IT-004=Direct Boundary: 通知失敗後清掃。
 */
test("開始通知の例外とPromise返却は後続通知なしで回収する", async () => {
  for (const mode of ["throw", "promise"] as const) {
    let failures = 0;
    let fixture!: ReturnType<typeof sessionFixture>;
    fixture = sessionFixture({
      hooks: {
        onExecutionStarted: () => {
          assert.deepEqual(fixture.waits.at(-1), {
            purpose: "start_provider_attached",
            timeout: 300_000,
          });
          if (mode === "throw") throw new Error("fixed_notification_failure");
          return Promise.reject(new Error("fixed_notification_rejection"));
        },
        onFailure: () => {
          failures++;
        },
      },
    });
    const result = await fixture.session.completion;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(result.notificationDeliveryConfirmed, false);
    assert.equal(failures, 0);
    assert.equal(
      fixture.waits.filter(
        (entry) => entry.purpose === "start_provider_attached",
      ).length,
      1,
    );
    assert.equal(fixture.counts().terminations, 1);
    assert.equal(fixture.counts().cleanups, 1);
    assert.equal(result.callbackRegistrationReleased, true);
  }
});

/**
 * 認証拒否後の残目的を実行しない。
 * @responsibility DIが認証意味を解釈せず、有限受理Gateの拒否で止まることを確認する。
 * @trace ERB-IT-004
 * @precondition 認証Probeまでは模擬正常完了する。
 * @stimulus 認証用途の出力受理だけを拒否する。
 * @observation 最後の発行目的、失敗Gate、清掃数。
 * @oracle 認証Probeが最後で、Network・Providerの要求0、清掃1。
 * @cleanup 元completionを待つ。実資源なし。
 * @boundary ERB-IT-004=Direct Boundary: 上位認証受理と後続技術要求。
 */
test("認証出力の拒否後は残る技術要求を発行しない", async () => {
  const fixture = sessionFixture({
    hooks: {
      acceptOutput: (purpose) =>
        purpose !== "start_subscription_auth_probe_attached",
    },
  });
  const result = await fixture.session.completion;
  assert.equal(result.failure?.gate, "acceptOutput");
  assert.deepEqual(
    fixture.events.filter((event) => event.startsWith("start:")),
    [
      "start:create_subscription_auth_probe",
      "start:start_subscription_auth_probe_attached",
    ],
  );
  assert.equal(fixture.counts().cleanups, 1);
});

/**
 * 通知破損と終端不明でも元清掃へ進む。
 * @responsibility 未解決waitを新しい管理状態にせず、後着settlementのEffectを発生させない。
 * @trace ERB-IT-002 ERB-IT-004
 * @precondition Provider待機を保留し、通知と終端へ独立した故障を注入する。
 * @stimulus 通知throw／Promise、終端false／throw後に元waitを成功／拒否へ解放する。
 * @observation wait解放前の清掃、元結果、後着後イベント列と処置数。
 * @oracle wait解放前に回収一回・Session終了。後着settlementは通知・処置・結果を変えない。
 * @cleanup 必ず保留waitを解放する。実Process・Dockerは使用しない。
 * @boundary ERB-IT-002=Direct Boundary: 保留waitと終端。ERB-IT-004=Direct Boundary: 清掃と後着観測。
 */
test("通知破損と終端不明は300秒待ちを追加せず後着Effectを発行しない", async (t) => {
  for (const notification of ["throw", "promise"] as const) {
    for (const termination of ["false", "throw"] as const) {
      for (const late of ["success", "reject"] as const) {
        const fixture = sessionFixture({
          blocked: "start_provider_attached",
          terminationConfirmed: false,
          terminationThrows: termination === "throw",
          hooks: {
            onExecutionStarted: () => {
              if (notification === "throw")
                throw new Error("fixed_notice_failure");
              return Promise.reject(new Error("fixed_notice_rejection"));
            },
          },
        });
        t.after(fixture.release);
        await fixture.cleanupEntered;
        const result = await fixture.session.completion;
        assert.equal(result.notificationDeliveryConfirmed, false);
        assert.equal(result.callbackRegistrationReleased, true);
        assert.equal(fixture.counts().terminations, 1);
        assert.equal(fixture.counts().cleanups, 1);
        const events = [...fixture.events];
        const counts = { ...fixture.counts() };
        if (late === "success") fixture.release();
        else fixture.rejectWait();
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.deepEqual(fixture.events, events);
        assert.deepEqual(fixture.counts(), counts);
        assert.equal(await fixture.session.completion, result);
      }
    }
  }
});
