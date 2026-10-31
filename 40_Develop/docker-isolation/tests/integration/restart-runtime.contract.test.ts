/**
 * 固定再起動運用の取得・受付・通知・取消・回収を同じ実Machineで検証する。
 * @packageDocumentation
 * @responsibility 本番の運用順序とMachineを維持し、Native／保存／許可の外部境界だけを置換する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 一要求のcheckpoint、Native受付、直列通知と終了後のcallback不存在。
 * @boundary ERB-IT-014=Related 2 Blocks: 固定運用→実Machine→合成Native Session。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type createDockerRestartMachine,
  createDockerRestartMachineForVerification,
} from "../../src/docker-desktop/restart-state.ts";
import {
  restartDockerRuntimeForVerification,
  type DockerRuntimeRestartEvent,
  type DockerRuntimeRestartInput,
} from "../../src/docker-desktop/restart.ts";

/**
 * 不正な公開入力をGetter評価や外部取得より前に拒否する。
 * @responsibility 入力の一回捕捉が不正Objectの実行経路にならないことを確認する。
 * @trace ERB-IT-014
 * @precondition 合成依存だけを使用する。
 * @stimulus null、Proxy、Accessor、余分Field、Symbol Field、不正型を渡す。
 * @observation 固定理由、取得・確認・Getter・Proxy呼出し件数。
 * @oracle input_invalid、not_issued、全Effectと入力Getter評価0。
 * @cleanup N/A: 実資源を取得しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 公開入力検査→固定運用の取得拒否。
 */
test("不正入力はdata property捕捉前に固定拒否する", async () => {
  const f = fixture();
  let reads = 0;
  const accessor = Object.defineProperty({ ...f.input }, "requestId", {
    get() {
      reads++;
      throw new Error("private input detail");
    },
    enumerable: true,
  });
  const proxy = new Proxy(f.input, {
    ownKeys() {
      reads++;
      throw new Error("private proxy detail");
    },
    get() {
      reads++;
      throw new Error("private proxy detail");
    },
  });
  for (const invalid of [
    null,
    proxy,
    accessor,
    { ...f.input, extra: true },
    { ...f.input, [Symbol("extra")]: true },
    { ...f.input, signal: {} },
    { ...f.input, onRequesting: null },
    { ...f.input, onEvent: true },
  ]) {
    const result = await restartDockerRuntimeForVerification(
      invalid as unknown as DockerRuntimeRestartInput,
      f.dependencies,
    );
    assert.equal(result.reason, "docker_restart_input_invalid");
    assert.equal(result.primaryFailure, "docker_restart_input_invalid");
    assert.equal(result.request, "not_issued");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.delivery, "not_requested");
  }
  assert.equal(reads, 0);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.events, []);
});

/**
 * 実Machineへ接続する合成Native境界を作る。
 * @responsibility 停止・起動・回収の独立した呼出しを観測可能にする。
 * @trace ERB-IT-014
 * @precondition faultは固定試験条件だけ。
 * @stimulus 元Protocolの成功・不明・取消・許可喪失を注入する。
 * @observation 呼出し列、イベント列、受理callbackとAbortSignal。
 * @oracle 本番driverとMachineが新Effect停止・一次結果・資源終端を区別する。
 * @cleanup 合成Sessionのみ。Filesystem・Docker・外部AIのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 実運用／実Machine→合成Native観測。
 */
function fixture(
  fault:
    | "normal"
    | "stop_unknown"
    | "stop_unknown_cleanup"
    | "cleanup_unknown"
    | "cleanup_throw"
    | "helper_unavailable"
    | "helper_cleanup_unknown"
    | "permission_after_stop"
    | "cancel_after_stop" = "normal",
) {
  const controller = new AbortController();
  const calls: string[] = [];
  const events: DockerRuntimeRestartEvent[] = [];
  let permission = true;
  let processes = true;
  let backend = true;
  let ready = true;
  let accepted: (() => void) | undefined;
  const session = {
    assertLive: () => true,
    verifyArtifacts: async () => "verified" as const,
    inspectClientProcesses: async () => "absent" as const,
    inspectProcesses: async () =>
      processes ? ("verified" as const) : ("absent" as const),
    stopDesktop: async () => {
      calls.push("stop");
      if (fault === "stop_unknown" || fault === "stop_unknown_cleanup")
        return "outcome_unknown" as const;
      processes = false;
      backend = false;
      ready = false;
      if (fault === "permission_after_stop") permission = false;
      if (fault === "cancel_after_stop") controller.abort();
      return "command_completed" as const;
    },
    launchDesktop: async () => {
      calls.push("start");
      processes = true;
      backend = true;
      ready = true;
      return "started" as const;
    },
    terminateProcesses: async () => {
      throw new Error("legacy forced stop forbidden");
    },
    abort: async () => {
      calls.push("abort");
      return {
        cleanup: "confirmed" as const,
        protocol: "not_applicable" as const,
      };
    },
    release: async () => {
      calls.push("release");
      if (fault === "cleanup_throw") throw new Error("private cleanup detail");
      return {
        cleanup:
          fault === "cleanup_unknown" || fault === "stop_unknown_cleanup"
            ? ("unknown" as const)
            : ("confirmed" as const),
        protocol: "completed" as const,
      };
    },
    failureDetected: new Promise<void>(() => {}),
    onFailureDetected: () => () => {},
  };
  const input: DockerRuntimeRestartInput = {
    requestId: "a".repeat(64),
    signal: controller.signal,
    verifyBoundary: () => permission,
    onRequesting: () => {
      calls.push("checkpoint");
    },
    onEvent: (event) => {
      events.push(event);
    },
  };
  const dependencies = {
    platform: "win32",
    acquire: async () => {
      calls.push("acquire");
      return fault === "helper_unavailable" ||
        fault === "helper_cleanup_unknown"
        ? {
            status:
              fault === "helper_unavailable"
                ? ("unavailable" as const)
                : ("cleanup_unknown" as const),
            session: null,
          }
        : { status: "acquired" as const, session };
    },
    createMachine: (
      current: Parameters<typeof createDockerRestartMachine>[0],
      boundary: () => boolean,
      signal: AbortSignal,
      onAccepted?: () => void,
      onAttempted?: () => void,
    ) => {
      assert.equal(current, session);
      accepted = onAccepted;
      return createDockerRestartMachineForVerification({
        session,
        boundary,
        signal,
        ...(onAccepted ? { onRequestAccepted: onAccepted } : {}),
        ...(onAttempted ? { onRequestAttempted: onAttempted } : {}),
        observeEngine: () => (ready ? "ready" : "known_unavailable"),
        observeBackend: () => (backend ? "running" : "stopped"),
        containersAbsent: () => true,
        now: () => 0,
        wait: async () => {},
      });
    },
    now: (() => {
      let now = 0;
      return () => (now += 11);
    })(),
  };
  return {
    input,
    dependencies,
    calls,
    events,
    controller,
    session,
    lateAcceptance: () => accepted?.(),
  };
}

/**
 * 一回の固定運用で全処置と回収を閉じる。
 * @responsibility 上位へOS Sessionを返さず、通知と返却を同じ終端観測へ結合することを確認する。
 * @trace ERB-IT-014
 * @precondition checkpointと現在許可が同期成功する。
 * @stimulus 同じ実Machineを用いて停止、起動、Native releaseまで実行する。
 * @observation 相関、直列イベント、呼出し列、参考時間と最終結果。
 * @oracle checkpoint→acquire→stop→start→release、受付通知一回、同じ不変終端、返却後通知0。
 * @cleanup 合成境界のみ。実Docker・Native helper・外部AIのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 固定運用→Machine→Native Session。
 */
test("固定再起動は受付から回収まで閉じた観測だけを返す", async () => {
  const f = fixture();
  const result = await restartDockerRuntimeForVerification(
    f.input,
    f.dependencies,
  );
  assert.deepEqual(f.calls, [
    "checkpoint",
    "acquire",
    "stop",
    "start",
    "release",
  ]);
  assert.equal(result.status, "completed");
  assert.equal(result.request, "confirmed");
  assert.equal(result.primaryFailure, null);
  assert.equal(result.startFailure, null);
  assert.equal(result.stopFailure, null);
  assert.equal(result.cleanupFailure, null);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.delivery, "confirmed");
  assert.equal(result.startupElapsedMs, 11);
  assert.deepEqual(
    f.events.map((event) => event.event),
    ["request_accepted", "settled"],
  );
  const terminal = f.events.at(-1);
  assert.ok(terminal?.event === "settled");
  const { delivery: _delivery, ...observation } = result;
  assert.deepEqual(terminal.observation, observation);
  assert.equal(Object.isFrozen(terminal.observation), true);
  f.lateAcceptance();
  f.controller.abort();
  assert.equal(f.events.length, 2);
  assert.equal(f.calls.filter((call) => call === "release").length, 1);
  assert.equal(f.calls.includes("abort"), false);
  assert.equal(Object.hasOwn(result, "session"), false);
  assert.equal(Object.hasOwn(result, "phase"), false);
});

for (const stage of ["verifyBoundary", "onRequesting"] as const) {
  for (const failure of [
    "false",
    "throw",
    "value",
    "promise",
    "async",
    "thenable",
  ] as const) {
    /**
     * 確認の拒否・不正値では補助資源すら取得しない。
     * @responsibility 同期の許可とcheckpointを非同期成功やtruthy値で代替しないことを確認する。
     * @trace ERB-IT-014
     * @precondition 確認二種のうち対象だけを故障させる。
     * @stimulus false・throw・数値・Promise・async関数・thenableを返す。
     * @observation acquire・stop・start件数とthen評価件数。
     * @oracle 対象の固定拒否理由、要求not_issued、取得と新Effect 0、then評価0。
     * @cleanup 合成境界のみ。拒否した既知Promiseは未処理拒否を残さない。
     * @boundary ERB-IT-014=Related 2 Blocks: 上位確認→固定再起動運用。
     */
    test(`再起動の ${stage} は ${failure} を成功にしない`, async () => {
      const f = fixture();
      let thenReads = 0;
      let asyncCalls = 0;
      const result = await restartDockerRuntimeForVerification(
        {
          ...f.input,
          [stage]:
            failure === "async"
              ? async () => {
                  asyncCalls++;
                  return true;
                }
              : () => {
                  if (failure === "throw")
                    throw new Error("private confirm detail");
                  if (failure === "promise")
                    return Promise.reject(new Error("private promise detail"));
                  if (failure === "value") return 1;
                  if (failure === "thenable")
                    return {
                      // biome-ignore lint/suspicious/noThenProperty: thenable拒否とgetter評価0を検査する意図的な不正入力。
                      get then() {
                        thenReads++;
                        throw new Error("must not evaluate then");
                      },
                    };
                  return false;
                },
        },
        f.dependencies,
      );
      assert.equal(result.status, "blocked");
      assert.equal(
        result.primaryFailure,
        stage === "verifyBoundary"
          ? "docker_restart_boundary_unconfirmed"
          : "docker_restart_record_unconfirmed",
      );
      assert.equal(result.cleanupFailure, null);
      assert.equal(result.request, "not_issued");
      assert.equal(f.calls.includes("acquire"), false);
      assert.equal(f.calls.includes("stop"), false);
      assert.equal(f.calls.includes("start"), false);
      assert.equal(thenReads, 0);
      assert.equal(asyncCalls, 0);
      assert.equal(JSON.stringify(result).includes("private"), false);
    });
  }
}

for (const fault of [
  "stop_unknown",
  "stop_unknown_cleanup",
  "cleanup_unknown",
  "cleanup_throw",
  "helper_unavailable",
  "helper_cleanup_unknown",
  "permission_after_stop",
  "cancel_after_stop",
] as const) {
  /**
   * 実受付・取消・許可喪失と回収不明を個別に保持する。
   * @responsibility 単なるSession取得や現在readyを実受付・全体完成へ昇格しないことを確認する。
   * @trace ERB-IT-014
   * @precondition 同じMachineと固定故障条件を使用する。
   * @stimulus Native応答不明、回収不明、取得失敗、停止後許可喪失または取消。
   * @observation 要求状態、一次／cleanup理由、後続開始とrelease／abort件数。
   * @oracle 不明は保持し、許可喪失・取消後開始0、全資源の回収結果を別に返す。
   * @cleanup 合成境界のみ。未終了の実ProcessやDocker資源なし。
   * @boundary ERB-IT-014=Related 2 Blocks: 実Machine→合成Native受付と回収。
   */
  test(`固定再起動は ${fault} を全体成功にしない`, async () => {
    const f = fixture(fault);
    const result = await restartDockerRuntimeForVerification(
      f.input,
      f.dependencies,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.restartCompleted, false);
    const cleanupFailed =
      fault === "cleanup_unknown" ||
      fault === "stop_unknown_cleanup" ||
      fault === "cleanup_throw" ||
      fault === "helper_cleanup_unknown";
    assert.equal(result.cleanupConfirmed, !cleanupFailed);
    assert.equal(
      result.cleanupFailure,
      cleanupFailed ? "docker_restart_cleanup_unconfirmed" : null,
    );
    assert.equal(
      f.calls.filter((call) => call === "release" || call === "abort").length,
      fault.startsWith("helper_") ? 0 : 1,
    );
    if (fault === "stop_unknown" || fault === "stop_unknown_cleanup")
      assert.equal(result.request, "unknown");
    if (fault.startsWith("helper_")) assert.equal(result.request, "not_issued");
    if (
      fault === "stop_unknown" ||
      fault === "stop_unknown_cleanup" ||
      fault.startsWith("helper_")
    ) {
      const primary =
        fault === "stop_unknown" || fault === "stop_unknown_cleanup"
          ? "docker_restart_stop_unconfirmed"
          : "docker_restart_helper_unavailable";
      assert.equal(result.primaryFailure, primary);
      assert.equal(
        result.reason,
        cleanupFailed ? "docker_restart_cleanup_unconfirmed" : primary,
      );
    }
    assert.equal(
      result.stopFailure,
      fault === "stop_unknown" || fault === "stop_unknown_cleanup"
        ? "stop_request_unconfirmed"
        : fault === "permission_after_stop" || fault === "cancel_after_stop"
          ? "boundary_unconfirmed"
          : null,
    );
    const terminal = f.events.at(-1);
    assert.ok(terminal?.event === "settled");
    const { delivery: _delivery, ...observation } = result;
    assert.deepEqual(terminal.observation, observation);
    if (fault === "permission_after_stop" || fault === "cancel_after_stop") {
      assert.equal(result.request, "issued");
      assert.equal(f.calls.includes("start"), false);
      assert.equal(
        result.primaryFailure,
        fault === "cancel_after_stop"
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    }
    if (fault === "cleanup_unknown" || fault === "cleanup_throw")
      assert.equal(result.primaryFailure, null);
  });
}

for (const failure of ["throw", "value", "promise", "async"] as const) {
  /**
   * 通知配送が不成立でも元の技術結果と資源終端を消さない。
   * @responsibility 同期以外の通知を成功とせず、不成立後の新Effectとcallbackを停止する。
   * @trace ERB-IT-014
   * @precondition 受付時の上位通知だけを不成立にする。
   * @stimulus throw、非undefined、Promiseまたはasync通知。
   * @observation 配送状態、一次結果、開始件数、回収件数と返却後callback。
   * @oracle delivery unknown、新開始0、元一次成功null、回収一回、通知以後0。
   * @cleanup 合成境界だけ。実Native・Docker・外部AIのEffectなし。
   * @boundary ERB-IT-014=Related 2 Blocks: Native受付→同期通知→上位状態更新。
   */
  test(`受付通知 ${failure} 後も資源終端を待つ`, async () => {
    const f = fixture();
    let calls = 0;
    const result = await restartDockerRuntimeForVerification(
      {
        ...f.input,
        onEvent:
          failure === "async"
            ? async () => {
                calls++;
              }
            : () => {
                calls++;
                if (failure === "throw")
                  throw new Error("private notification detail");
                if (failure === "promise")
                  return Promise.reject(
                    new Error("private notification promise"),
                  );
                return true;
              },
      },
      f.dependencies,
    );
    assert.equal(result.delivery, "unknown");
    assert.equal(result.status, "blocked");
    assert.equal(result.primaryFailure, null);
    assert.equal(result.reason, "docker_restart_notification_unconfirmed");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.cleanupFailure, null);
    assert.equal(f.calls.includes("start"), false);
    assert.equal(f.calls.filter((call) => call === "release").length, 1);
    assert.equal(calls, failure === "async" ? 0 : 1);
    f.lateAcceptance();
    assert.equal(calls, failure === "async" ? 0 : 1);
  });
}

/**
 * 取得待機中の取消でも、取得結果と元Sessionの終端を待つ。
 * @responsibility awaitの途中を取消完了とせず、遅れて取得した補助資源を回収する。
 * @trace ERB-IT-014
 * @precondition Native取得だけを制御可能なPromiseで保留する。
 * @stimulus 取得開始後に取消し、まだ待機中であることを確認してから取得結果を返す。
 * @observation 結果返却時点、stop／start／abort回数と最終結果。
 * @oracle 取得結果前は未返却、停止開始0、元Session abort一回とcleanup確認後だけ返却する。
 * @cleanup 合成Sessionだけ。実Process・Docker・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 取消→保留Native取得→元資源終端。
 */
test("取得待機中の取消は遅れて得たSessionを終端してから返る", async () => {
  const f = fixture();
  let continueAcquisition: (() => void) | undefined;
  let enteredAcquisition: (() => void) | undefined;
  const entered = new Promise<void>((resolve) => {
    enteredAcquisition = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    continueAcquisition = resolve;
  });
  let returned = false;
  const resultPromise = restartDockerRuntimeForVerification(f.input, {
    ...f.dependencies,
    acquire: async () => {
      const acquired = await f.dependencies.acquire();
      enteredAcquisition?.();
      await pending;
      return acquired;
    },
  }).then((result) => {
    returned = true;
    return result;
  });
  await entered;
  f.controller.abort();
  assert.equal(returned, false);
  assert.deepEqual(f.calls, ["checkpoint", "acquire"]);
  continueAcquisition?.();
  const result = await resultPromise;
  assert.equal(result.primaryFailure, "docker_restart_cancelled");
  assert.equal(result.request, "not_issued");
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(f.calls, ["checkpoint", "acquire", "abort"]);
  assert.deepEqual(
    f.events.map((event) => event.event),
    ["settled"],
  );
});

for (const first of ["stop", "abort"] as const) {
  /**
   * 停止待機中の取消でも元要求とabortの両終端を待つ。
   * @responsibility 取消通知やabort開始だけを資源回収完了へ読み替えないことを確認する。
   * @trace ERB-IT-014
   * @precondition 停止要求とabort応答を個別に保留する合成Session。
   * @stimulus 停止開始後に取消し、元要求とabortの応答順を両方向で解放する。
   * @observation 各待機点の返却有無、停止・起動・abort件数と終端通知。
   * @oracle 両終端まで未返却、stop1・start0・abort1、取消理由と確認済み回収。
   * @cleanup 合成Promiseを全て解放する。実Docker・Process・FilesystemのEffectなし。
   * @boundary ERB-IT-014=Related 2 Blocks: 固定運用→実Machine→保留Native応答。
   */
  test(`停止保留中の取消は${first}先行でも両終端を待つ`, async () => {
    const f = fixture();
    let notifyStop!: () => void;
    let notifyAbort!: () => void;
    let finishStop!: () => void;
    let finishAbort!: () => void;
    const enteredStop = new Promise<void>((resolve) => {
      notifyStop = resolve;
    });
    const enteredAbort = new Promise<void>((resolve) => {
      notifyAbort = resolve;
    });
    const stop = new Promise<void>((resolve) => {
      finishStop = resolve;
    });
    const abort = new Promise<void>((resolve) => {
      finishAbort = resolve;
    });
    f.session.stopDesktop = async () => {
      f.calls.push("stop");
      notifyStop();
      await stop;
      return "command_completed";
    };
    f.session.abort = async () => {
      f.calls.push("abort");
      notifyAbort();
      await abort;
      return { cleanup: "confirmed", protocol: "not_applicable" };
    };
    let returned = false;
    const pending = restartDockerRuntimeForVerification(
      f.input,
      f.dependencies,
    ).then((result) => {
      returned = true;
      return result;
    });
    await enteredStop;
    f.controller.abort();
    await enteredAbort;
    assert.equal(returned, false);
    if (first === "stop") finishStop();
    else finishAbort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(returned, false);
    if (first === "stop") finishAbort();
    else finishStop();
    const result = await pending;
    assert.equal(result.primaryFailure, "docker_restart_cancelled");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.cleanupFailure, null);
    assert.equal(result.restartCompleted, false);
    assert.deepEqual(f.calls, ["checkpoint", "acquire", "stop", "abort"]);
    assert.equal(
      f.events.filter((event) => event.event === "settled").length,
      1,
    );
    const terminal = f.events.at(-1);
    assert.ok(terminal?.event === "settled");
    const { delivery: _delivery, ...observation } = result;
    assert.deepEqual(terminal.observation, observation);
    const eventCount = f.events.length;
    f.lateAcceptance();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.events.length, eventCount);
    assert.deepEqual(f.calls, ["checkpoint", "acquire", "stop", "abort"]);
  });
}

for (const fault of ["permission_after_stop", "cancel_after_stop"] as const) {
  /**
   * 取得後の一次失敗と回収失敗を同時に保持する。
   * @responsibility cleanupの最終理由で元の取消・許可喪失を消さないことを確認する。
   * @trace ERB-IT-014
   * @precondition 停止後だけ取消または現在許可喪失を発火する。
   * @stimulus 許可喪失とrelease不明、または取消とabort例外を組み合わせる。
   * @observation 全結果field、終端通知、停止・開始・回収呼出し列。
   * @oracle 元一次理由を維持しcleanup失敗を別記、start0・回収1、通知と返却全文一致。
   * @cleanup 合成Sessionだけ。実資源・秘密・外部AIのEffectなし。
   * @boundary ERB-IT-014=Related 2 Blocks: 実Machine→合成Native回収→上位通知。
   */
  test(`停止後の ${fault} と回収失敗を別々に保持する`, async () => {
    const f = fixture(fault);
    const cancelled = fault === "cancel_after_stop";
    if (cancelled) {
      f.session.abort = async () => {
        f.calls.push("abort");
        throw new Error("private abort detail");
      };
    } else {
      f.session.release = async () => {
        f.calls.push("release");
        return { cleanup: "unknown", protocol: "completed" };
      };
    }
    const result = await restartDockerRuntimeForVerification(
      f.input,
      f.dependencies,
    );
    assert.deepEqual(result, {
      requestId: f.input.requestId,
      status: "blocked",
      reason: "docker_restart_cleanup_unconfirmed",
      request: "issued",
      primaryFailure: cancelled
        ? "docker_restart_cancelled"
        : "docker_restart_boundary_unconfirmed",
      stopFailure: "boundary_unconfirmed",
      startFailure: null,
      cleanupFailure: "docker_restart_cleanup_unconfirmed",
      cleanupConfirmed: false,
      restartCompleted: false,
      effectOutcomeUnknown: true,
      startupElapsedMs: null,
      delivery: "confirmed",
    });
    assert.deepEqual(f.calls, [
      "checkpoint",
      "acquire",
      "stop",
      cancelled ? "abort" : "release",
    ]);
    assert.deepEqual(
      f.events.map((event) => event.event),
      ["request_accepted", "settled"],
    );
    const terminal = f.events.at(-1);
    assert.ok(terminal?.event === "settled");
    const { delivery: _delivery, ...observation } = result;
    assert.deepEqual(terminal.observation, observation);
    f.lateAcceptance();
    f.controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.events.length, 2);
    assert.equal(f.calls.length, 4);
  });
}

/**
 * 終端通知の失敗を技術結果や回収の失敗へ変換しない。
 * @responsibility 技術完成と上位配送の成否を別々に保持する。
 * @trace ERB-IT-014
 * @precondition 停止・起動・回収は正常で、終端通知だけが失敗する。
 * @stimulus request_acceptedは受領し、settledで例外を返す。
 * @observation 同じ最終観測、配送状態、一次／cleanupとcallback回数。
 * @oracle 技術completed・cleanup確認を維持しdelivery unknown、一次／cleanup理由null、返却後callback 0。
 * @cleanup 合成Sessionのrelease一回。実Docker・外部AIのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 技術終端→上位結果配送。
 */
test("終端通知の失敗は技術結果と回収結果を上書きしない", async () => {
  const f = fixture();
  const result = await restartDockerRuntimeForVerification(
    {
      ...f.input,
      onEvent: (event) => {
        f.events.push(event);
        if (event.event === "settled")
          throw new Error("private consumer save detail");
      },
    },
    f.dependencies,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "docker_restart_settled");
  assert.equal(result.request, "confirmed");
  assert.equal(result.delivery, "unknown");
  assert.equal(result.primaryFailure, null);
  assert.equal(result.cleanupFailure, null);
  assert.equal(result.cleanupConfirmed, true);
  const event = f.events.at(-1);
  assert.ok(event?.event === "settled");
  const { delivery: _delivery, ...observation } = result;
  assert.deepEqual(event.observation, observation);
  f.lateAcceptance();
  assert.equal(f.events.length, 2);
});

/**
 * 未対応環境と初回取消を新処置前に拒否する。
 * @responsibility OS選択を上位へ委ねず、未対応のfallbackを作らない。
 * @trace ERB-IT-014
 * @precondition 固定環境選択または初回Signalだけを拒否条件にする。
 * @stimulus 未対応platform、初回取消、未知要求IDを渡す。
 * @observation checkpoint・acquire・Native操作の件数。
 * @oracle 初回拒否の固定理由、要求not_issued、全取得・処置0。
 * @cleanup 未取得なので資源なし。実環境のOSは変更しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 固定環境選択→新実行拒否。
 */
test("未対応環境・開始前取消・不正IDはcheckpoint前に拒否する", async () => {
  for (const failure of ["environment", "cancel", "id"] as const) {
    const f = fixture();
    if (failure === "cancel") f.controller.abort();
    const result = await restartDockerRuntimeForVerification(
      {
        ...f.input,
        requestId: failure === "id" ? "invalid" : f.input.requestId,
      },
      {
        ...f.dependencies,
        platform: failure === "environment" ? "linux" : "win32",
      },
    );
    assert.equal(
      result.primaryFailure,
      {
        environment: "docker_restart_environment_unsupported",
        cancel: "docker_restart_cancelled",
        id: "docker_restart_id_invalid",
      }[failure],
    );
    assert.equal(result.request, "not_issued");
    assert.equal(result.cleanupConfirmed, true);
    assert.deepEqual(f.calls, []);
  }
});

/**
 * 呼出し元の入力Objectの変更で元要求と確認先を差し替えない。
 * @responsibility 一操作の相関、Signalと確認closureを開始時の値へ固定する。
 * @trace ERB-IT-014
 * @precondition 上位checkpointが自身の入力Objectを別要求用へ更新する反例。
 * @stimulus checkpoint中に要求ID・Signal・確認functionを置換する。
 * @observation 最終要求ID、通知ID、処置列と取消件数。
 * @oracle 元要求と元Signal・元確認でだけ処理し、通知と返却の相関不変。
 * @cleanup 合成境界だけ。呼出し元Objectは自己生成fixture。
 * @boundary ERB-IT-014=Related 2 Blocks: 上位の可変入力→下位一操作の固定結合。
 */
test("上位入力Objectの変更で元要求を再結合しない", async () => {
  const f = fixture();
  const foreign = new AbortController();
  foreign.abort();
  const input: DockerRuntimeRestartInput = {
    ...f.input,
    onRequesting: () => {
      Object.assign(input, {
        requestId: "b".repeat(64),
        signal: foreign.signal,
        verifyBoundary: () => false,
        onRequesting: () => {
          throw new Error("must not rebind checkpoint");
        },
      });
      return f.input.onRequesting();
    },
  };
  const result = await restartDockerRuntimeForVerification(
    input,
    f.dependencies,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.requestId, f.input.requestId);
  assert.equal(f.events[0]?.event, "request_accepted");
  const first = f.events[0];
  assert.ok(first?.event === "request_accepted");
  assert.equal(first.requestId, f.input.requestId);
  assert.deepEqual(f.calls, [
    "checkpoint",
    "acquire",
    "stop",
    "start",
    "release",
  ]);
});
