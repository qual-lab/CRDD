/**
 * Docker実行環境の再起動を取得から回収まで一操作で所有する。
 * @packageDocumentation
 * @responsibility 上位の現在許可と保存確認だけを受け、OS固有の補助資源と停止・起動を内部に閉じる。
 * @trace ARCH-000008
 * @boundary 現在許可・相関済みcheckpointと、用途固定Native／Docker操作。
 */
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import { describeDockerRuntimeArtifactTrustContract } from "../docker-cli/trust.ts";
import { observePlatformAccessArtifactCandidate } from "../../../platform-access/src/index.ts";
import {
  startDockerDesktopRestartHelper,
  type DockerDesktopRestartNativeHelperOutcome,
} from "../../../platform-access/src/index.ts";
import {
  createDockerRestartMachine,
  type DockerRestartStopFailure,
  type DockerRestartStartFailure,
} from "./restart-state.ts";

/**
 * 環境共通の再起動観測。実行AuthorityやOS別phaseを含めない。
 * @responsibility 元要求、技術結果、一次失敗と回収結果を別々に表す。
 * @trace ARCH-000008
 * @shape 固定要求相関、要求状態、結果、失敗分類と参考起動時間。
 * @invariant 現在のreadyを過去のunknownの成功へ変換しない。
 * @boundary 下位の一操作から上位の状態Ownerへの値搬送。
 * @security Path・Session・生出力・署名資格を返さない。
 * @compatibility Machine phaseは非公開。停止・起動失敗位置は固定診断として返し、処置許可へ使わない。
 */
export type DockerRuntimeRestartObservation = Readonly<{
  requestId: string;
  status: "completed" | "blocked";
  reason: string;
  request: "not_issued" | "unknown" | "issued" | "confirmed";
  primaryFailure: string | null;
  stopFailure: DockerRestartStopFailure | null;
  startFailure: DockerRestartStartFailure | null;
  cleanupFailure: "docker_restart_cleanup_unconfirmed" | null;
  cleanupConfirmed: boolean;
  restartCompleted: boolean;
  effectOutcomeUnknown: boolean;
  startupElapsedMs: number | null;
}>;

/**
 * 元要求へ結合した受付または終端の通知。
 * @responsibility 下位の実観測だけを同じ相関で直列搬送する。
 * @trace ARCH-000008
 * @shape 要求受付、または最終技術観測を持つ二種の不変値。
 * @invariant 通知と返却の技術結果は同じ観測である。
 * @boundary 同期の用途限定通知。
 * @security callbackは上位StoreやPackageを下位へ公開しない。
 * @compatibility 配送確認は技術観測とは別に返す。
 */
export type DockerRuntimeRestartEvent =
  | Readonly<{
      event: "request_accepted";
      requestId: string;
      request: "issued";
    }>
  | Readonly<{
      event: "settled";
      observation: DockerRuntimeRestartObservation;
    }>;

/**
 * 上位の現在境界観測と発行予定・結果通知を結合する入力。
 * @responsibility 任意OS処置や保存実装を下位へ持ち込まない。
 * @trace ARCH-000008
 * @shape 要求ID、取消、現在境界の同期確認とvoidの同期通知。
 * @invariant Hashだけでは許可・排他・保存成立とみなさない。
 * @boundary 上位Ownerの用途限定closure。
 * @security argv・環境・実行物Path・生Sessionは指定できない。
 * @compatibility 現在境界は同期boolean、通知は同期voidとして用途を区別する。
 */
export interface DockerRuntimeRestartCallbacks {
  onRequesting(): void;
  onEvent?(event: DockerRuntimeRestartEvent): void;
}

/**
 * 一要求の相関・取消・借用境界と通知を結合する。
 * @responsibility Effect直前の生存観測とvoid通知を区別する。
 * @trace ARCH-000008
 * @shape requestId、Signal、verifyBoundaryと同期通知。
 * @invariant 通知は保存成功や新Authorityを返さない。
 * @boundary 上位Ownerと固定再起動処理。
 * @security 任意argv・OS処置・保存操作を受け取らない。
 * @compatibility 元要求ID・取消・回収条件は維持する。
 */
export type DockerRuntimeRestartInput = Readonly<{
  requestId: string;
  signal: AbortSignal;
  verifyBoundary: () => unknown;
}> &
  DockerRuntimeRestartCallbacks;

/**
 * 同期の確認だけをbooleanとして消費する。
 * @responsibility 非同期確認を待機や実行許可へ変換しない。
 * @trace ARCH-000008
 * @input confirm: 借用元の現在Owner・Scope・取消の確認。
 * @returns 同期trueだけ。その他はfalse。
 * @precondition 実処置前の閉じた確認にだけ使用する。
 * @postcondition 拒否したPromiseを保存成功や許可へ昇格しない。
 * @effect 同期確認を呼ぶ。既知async関数は呼ばない。
 * @failure throw・不正型・Promiseはfalse。
 * @invariant 不正戻り値のthenを評価せず、既知Promiseの拒否だけを消費する。
 * @boundary 上位closureから下位のEffect前確認。
 * @security 任意のthenableや例外本文を実行・公開しない。
 * @concurrency Promiseをawaitせず、後続Host Effectを0にする。
 */
function confirmSynchronousRestartBoundary(confirm: () => unknown) {
  try {
    if (typeof confirm !== "function" || types.isAsyncFunction(confirm))
      return false;
    const result = confirm();
    if (types.isPromise(result))
      void Promise.prototype.then.call(
        result,
        () => undefined,
        () => undefined,
      );
    return result === true;
  } catch {
    return false;
  }
}

/**
 * 本番の用途固定取得とMachineだけを内部で結合する。
 * @responsibility 試験の任意AdapterをRoot入力へ公開しない。
 * @trace ARCH-000008
 * @input input: 元要求と上位の同期確認・通知。
 * @returns 技術観測と通知配送の個別評価。
 * @precondition 上位Ownerが現在の人間許可、Scopeと既存排他を確認する。
 * @postcondition 補助Processの終了確認まで待ってから一度だけ結果を返す。
 * @effect 固定Native補助ProcessとDocker停止・起動・観測・回収。
 * @failure 未対応環境、確認拒否、取消、実処置不明と回収不明を区別する。
 * @invariant 通常Runtime署名、過去phaseや現在readyから許可を生成しない。
 * @boundary 上位の相関済み状態と下位技術運用。
 * @security 現在Artifactの同一性・Hashと固定Publisher条件を下位で照合する。
 * @concurrency 上位の既存排他を各Effect前に再確認し、取消後の資源joinを省略しない。
 */
export function restartDockerRuntime(input: DockerRuntimeRestartInput) {
  return restartDockerRuntimeForVerification(input, {
    platform: process.platform,
    acquire: async () => {
      const root = fileURLToPath(new URL("../../../..", import.meta.url));
      const observed = observePlatformAccessArtifactCandidate(root);
      return observed.status === "candidate"
        ? startDockerDesktopRestartHelper(
            observed.artifact,
            describeDockerRuntimeArtifactTrustContract().policySha256,
          )
        : Object.freeze({ status: "unavailable" as const, session: null });
    },
    createMachine: createDockerRestartMachine,
    now: () => performance.now(),
  });
}

/**
 * 固定再起動操作の外部境界だけを試験へ置換する。
 * @responsibility 受付・処置・通知・回収の同じ本番順序を反証可能にする。
 * @trace ARCH-000008
 * @input input: 固定上位入力。dependencies: Package内部の技術試験境界。
 * @returns 技術観測と配送確認。生の補助Sessionを返さない。
 * @precondition 本番Rootは固定Adapterだけを結合し、この試験入口を公開しない。
 * @postcondition 全通知試行と所有資源の終了待機を完了し、参照を破棄して返す。
 * @effect 本番では固定停止・起動、試験では注入境界だけ。
 * @failure boolean以外、throw、取消と通知不成立では後続Effectを停止する。
 * @invariant 一次失敗と回収結果を通知失敗で上書きしない。
 * @boundary 下位固定運用と技術試験Adapter。
 * @security 上位の任意argv・OS処置・保存Pathを受け取らない。
 * @concurrency 通知を同期直列で呼び、終了後callback 0とする。
 */
export async function restartDockerRuntimeForVerification(
  input: DockerRuntimeRestartInput,
  dependencies: Readonly<{
    platform: string;
    acquire: () => Promise<DockerDesktopRestartNativeHelperOutcome>;
    createMachine: typeof createDockerRestartMachine;
    now: () => number;
  }>,
): Promise<
  DockerRuntimeRestartObservation &
    Readonly<{
      delivery: "not_requested" | "confirmed" | "unknown";
    }>
> {
  let captured: DockerRuntimeRestartInput;
  try {
    if (!input || typeof input !== "object" || types.isProxy(input))
      throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Object.keys(descriptors);
    if (
      keys.some(
        (key) =>
          ![
            "requestId",
            "signal",
            "verifyBoundary",
            "onRequesting",
            "onEvent",
          ].includes(key),
      ) ||
      Reflect.ownKeys(input).length !== keys.length ||
      keys.some((key) => {
        const descriptor = descriptors[key];
        return !descriptor || !("value" in descriptor);
      })
    )
      throw new Error();
    const requestId = descriptors.requestId?.value;
    const signal = descriptors.signal?.value;
    const verifyBoundary = descriptors.verifyBoundary?.value;
    const onRequesting = descriptors.onRequesting?.value;
    const onEvent = descriptors.onEvent?.value;
    if (
      typeof requestId !== "string" ||
      types.isProxy(signal) ||
      !(signal instanceof AbortSignal) ||
      typeof verifyBoundary !== "function" ||
      typeof onRequesting !== "function" ||
      (onEvent !== undefined && typeof onEvent !== "function")
    )
      throw new Error();
    captured = {
      requestId,
      signal,
      verifyBoundary,
      onRequesting,
      ...(onEvent ? { onEvent } : {}),
    };
  } catch {
    return Object.freeze({
      requestId: "",
      status: "blocked" as const,
      reason: "docker_restart_input_invalid",
      request: "not_issued" as const,
      primaryFailure: "docker_restart_input_invalid",
      stopFailure: null,
      startFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: true,
      restartCompleted: false,
      effectOutcomeUnknown: false,
      startupElapsedMs: null,
      delivery: "not_requested" as const,
    });
  }
  const { requestId, signal, verifyBoundary, onRequesting } = captured;
  let request: DockerRuntimeRestartObservation["request"] = "not_issued";
  let primaryFailure: string | null = null;
  let stopFailure: DockerRestartStopFailure | null = null;
  let startFailure: DockerRestartStartFailure | null = null;
  let cleanupFailure: "docker_restart_cleanup_unconfirmed" | null = null;
  let cleanupConfirmed = true;
  let restartCompleted = false;
  let effectOutcomeUnknown = false;
  let startupElapsedMs: number | null = null;
  let notification = captured.onEvent;
  let delivery: "not_requested" | "confirmed" | "unknown" = notification
    ? "confirmed"
    : "not_requested";
  let session: DockerDesktopRestartNativeHelperOutcome["session"] = null;
  let machine: ReturnType<typeof createDockerRestartMachine> | null = null;
  let closed = false;
  let reason = "docker_restart_execution_failed";
  /**
   * 現在許可を同期booleanだけで再確認する。
   * @responsibility 取消・配送停止・上位の許可喪失後の新Effectを拒否する。
   * @trace ARCH-000008
   * @input N/A: 元inputと操作内配送状態だけ。
   * @returns 同期確認trueかつ未取消の場合だけtrue。
   * @precondition 各技術Effect前とawait後に呼ぶ。
   * @postcondition Promiseや不正値を許可へ変換しない。
   * @effect 上位の固定確認closureを呼ぶ。保存・OS処置は発行しない。
   * @failure throw・false・非booleanはfalse。
   * @invariant 初回確認を後続Effectの許可へ流用しない。
   * @boundary 上位Ownerの現在許可。
   * @security 下位は上位の秘密・Storeを読まない。
   * @concurrency 同じ操作の取消と通知不成立を直前に評価する。
   */
  const live = () => {
    try {
      return (
        !closed &&
        !signal.aborted &&
        delivery !== "unknown" &&
        confirmSynchronousRestartBoundary(verifyBoundary)
      );
    } catch {
      return false;
    }
  };
  /**
   * 不変の技術観測を同期通知し、配送不成立後の通知を止める。
   * @responsibility 例外や不正戻り値を技術結果と別の配送評価へ保持する。
   * @trace ARCH-000008
   * @input event: 同じ要求へ相関した閉じた不変値。
   * @returns N/A: 配送状態だけを操作内へ保持する。
   * @precondition 同じ処理から直列にだけ呼ぶ。
   * @postcondition 不成立後のcallback参照を破棄する。
   * @effect 上位通知closureを同期呼出しする。
   * @failure throwまたはundefined以外でunknown。
   * @invariant 通知失敗で一次結果やcleanupを消さない。
   * @boundary 下位技術観測と上位状態更新。
   * @security Promiseやthenableをawaitせず完了根拠にしない。
   * @concurrency callback終了前に次通知や結果返却を行わない。
   */
  const notify = (event: DockerRuntimeRestartEvent) => {
    if (!notification) return;
    try {
      if (!types.isAsyncFunction(notification)) {
        const result = notification(Object.freeze(event));
        if (types.isPromise(result))
          void Promise.prototype.then.call(
            result,
            () => undefined,
            () => undefined,
          );
        if (result === undefined) return;
      }
    } catch {
      // 配送の失敗は技術結果とは別に保持する。
    }
    delivery = "unknown";
    notification = undefined;
  };
  /**
   * Nativeの停止受理または起動受理を同じ要求へ一回だけ通知する。
   * @responsibility 補助Processの準備完了から要求受理を推定しない。
   * @trace ARCH-000008
   * @input N/A: Nativeの実受付後にMachineが呼ぶ。
   * @returns N/A: 要求状態と固定通知を更新する。
   * @precondition command_completedまたはstartedのNative応答を確認済み。
   * @postcondition 停止と起動の両応答が来ても受付通知は一回。
   * @effect 同期通知closureだけ。新しいHost要求を発行しない。
   * @failure 配送不成立は通知Ownerが別に保持する。
   * @invariant readyやSession取得だけでissuedへ進めない。
   * @boundary Native受付の技術事実から上位相関への搬送。
   * @security 受付は実行完了・Task成功・新しい許可を意味しない。
   * @concurrency 同じMachineから同期直列で呼ぶ。
   */
  const accepted = () => {
    if (closed || request === "issued") return;
    request = "issued";
    notify({
      event: "request_accepted",
      requestId: requestId,
      request: "issued",
    });
  };
  try {
    if (!/^[a-f0-9]{64}$/u.test(requestId))
      throw new Error("docker_restart_id_invalid");
    if (dependencies.platform !== "win32")
      throw new Error("docker_restart_environment_unsupported");
    if (!live())
      throw new Error(
        signal.aborted
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    if (types.isAsyncFunction(onRequesting))
      throw new Error("docker_restart_record_unconfirmed");
    try {
      const requesting: unknown = onRequesting();
      if (types.isPromise(requesting))
        void Promise.prototype.then.call(
          requesting,
          undefined,
          () => undefined,
        );
      if (requesting !== undefined) throw new Error();
    } catch {
      throw new Error("docker_restart_record_unconfirmed");
    }
    if (!live())
      throw new Error(
        signal.aborted
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    const acquired = await dependencies.acquire();
    session = acquired.session;
    cleanupConfirmed = acquired.status !== "cleanup_unknown" && !session;
    if (acquired.status !== "acquired" || !session)
      throw new Error("docker_restart_helper_unavailable");
    if (!live())
      throw new Error(
        signal.aborted
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    machine = dependencies.createMachine(
      session,
      live,
      signal,
      accepted,
      () => {
        if (!closed && request === "not_issued") request = "unknown";
      },
    );
    const stopped = await machine.stop();
    if (stopped !== "stopped") stopFailure = machine.getStopFailure();
    if (!live())
      throw new Error(
        signal.aborted
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    if (stopped !== "stopped")
      throw new Error("docker_restart_stop_unconfirmed");
    const startedAt = dependencies.now();
    const started = await machine.start();
    if (started !== "ready") startFailure = machine.getStartFailure();
    if (!live())
      throw new Error(
        signal.aborted
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    if (started !== "ready")
      throw new Error("docker_restart_start_unconfirmed");
    const elapsed = dependencies.now() - startedAt;
    startupElapsedMs =
      Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed) : null;
    if (!live())
      throw new Error(
        signal.aborted
          ? "docker_restart_cancelled"
          : "docker_restart_boundary_unconfirmed",
      );
    restartCompleted = true;
    request = "confirmed";
    reason = "docker_restart_settled";
  } catch (error) {
    const fixedReasons = new Set([
      "docker_restart_id_invalid",
      "docker_restart_environment_unsupported",
      "docker_restart_cancelled",
      "docker_restart_boundary_unconfirmed",
      "docker_restart_record_unconfirmed",
      "docker_restart_helper_unavailable",
      "docker_restart_stop_unconfirmed",
      "docker_restart_start_unconfirmed",
    ]);
    // Native受付のcallbackが変更した操作内状態を再読取りする。
    if (
      (delivery as "not_requested" | "confirmed" | "unknown") === "unknown" &&
      !signal.aborted
    ) {
      reason = "docker_restart_notification_unconfirmed";
    } else {
      primaryFailure =
        error instanceof Error && fixedReasons.has(error.message)
          ? error.message
          : "docker_restart_execution_failed";
      reason = primaryFailure;
    }
  } finally {
    effectOutcomeUnknown = machine?.getEffectOutcomeUnknown() ?? false;
    if (session) {
      try {
        const released = machine
          ? await machine.release()
          : signal.aborted
            ? await session.abort()
            : await session.release();
        cleanupConfirmed = released.cleanup === "confirmed";
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (!cleanupConfirmed) {
      cleanupFailure = "docker_restart_cleanup_unconfirmed";
      reason = cleanupFailure;
    }
    session = null;
    machine = null;
  }
  const observation: DockerRuntimeRestartObservation = Object.freeze({
    requestId: requestId,
    status: restartCompleted && cleanupConfirmed ? "completed" : "blocked",
    reason,
    request,
    primaryFailure,
    stopFailure,
    startFailure,
    cleanupFailure,
    cleanupConfirmed,
    restartCompleted: restartCompleted && cleanupConfirmed,
    effectOutcomeUnknown,
    startupElapsedMs,
  });
  notify({ event: "settled", observation });
  closed = true;
  notification = undefined;
  return Object.freeze({ ...observation, delivery });
}
/**
 * 一要求の相関・取消・借用境界と通知を結合する。
 * @responsibility Effect直前の生存観測とvoid通知を区別する。
 * @trace ARCH-000008
 * @shape requestId、Signal、verifyBoundaryと同期通知。
 * @invariant 通知は保存成功や新Authorityを返さない。
 * @boundary 上位Ownerと固定再起動処理。
 * @security 任意argv・OS処置・保存操作を受け取らない。
 * @compatibility 元要求ID・取消・回収条件は維持する。
 */
