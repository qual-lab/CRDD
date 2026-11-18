/**
 * Docker実行環境の観測・通常起動・再起動・修復の共通技術入口。
 * @responsibility 現在環境の観測と明示した環境操作を技術Owner内で束ねる。
 * @trace ARCH-000008
 * @boundary 上位の現在判断と下位の固定環境操作。
 */

import { setTimeout } from "node:timers/promises";
import { types } from "node:util";
import type { IsolationSettings } from "../docker-cli/environment.ts";
import { captureIsolationSettings } from "../docker-cli/environment.ts";
import { observeBackendState } from "./backend.ts";
import { acquireDesktopOperations } from "./command.ts";
import type { EngineObservation } from "./engine.ts";
import { observeDockerEngine } from "./engine.ts";
import { runRepairSession } from "./repair-session.ts";
import { restartDesktop } from "./restart.ts";
import type {
  DesktopAcquisition,
  DesktopOperations,
  DockerEnvironmentRequest,
  DockerEnvironmentResult,
  DockerEnvironmentStatus,
  EnvironmentStartRequest,
  EnvironmentStartResult,
} from "./types.ts";

/**
 * 停止処理を発行せず、必要な場合だけDesktopを一度起動する。
 * @responsibility 起動受理とEngine応答・元Process終了を区別する。
 * @trace ARCH-000008
 * @input 現在境界・取消と固定したIsolation設定。
 * @returns Engine readyとcleanupが共同成立した場合だけready。
 * @precondition 上位が停止確認時の通常起動を許可している。
 * @postcondition stop・restart・repair・Container作成を発行しない。
 * @effect 固定Desktop status/start、Engine読取りと既存wx排他。
 * @failure 不明・取消・境界失効・期限・終了不明をblockedへ保持する。
 * @invariant 起動中又は不明時に起動要求を重ねない。
 * @boundary 上位の許可とDocker Desktop技術操作。
 * @security 任意Command・Path・環境を入力に含めない。
 * @concurrency 90秒／2秒で再観測し、取消時は待機timerも解放する。
 */
export function startDockerEnvironment(
  input: EnvironmentStartRequest,
  settings: IsolationSettings,
): Promise<EnvironmentStartResult> {
  const owned = captureIsolationSettings(settings);
  return startDockerEnvironmentUsing(input, {
    acquire: (signal) => acquireDesktopOperations(owned, signal),
    observe: () => observeDockerEngine(owned),
    now: () => performance.now(),
    wait: (signal) => setTimeout(2_000, undefined, { signal }),
  });
}

/**
 * 通常起動の実順序を固定し、技術境界だけを有限試験へ分離する。
 * @responsibility 既存Desktop Ownerの取得・一回発行・観測・終了を調停する。
 * @trace ARCH-000008
 * @input 上位要求とPackage内部の固定技術接続。
 * @returns 一次理由と各確認値。生のOwnerを返さない。
 * @effect 接続された技術操作だけ。
 * @security 入力descriptorとSignal brandをEffect前に確認する。
 */
async function startDockerEnvironmentUsing(
  input: EnvironmentStartRequest,
  dependencies: Readonly<{
    acquire: (signal: AbortSignal) => DesktopAcquisition;
    observe: () => EngineObservation;
    now: () => number;
    wait: (signal: AbortSignal) => Promise<void>;
  }>,
): Promise<EnvironmentStartResult> {
  const invalid: EnvironmentStartResult = Object.freeze({
    status: "blocked",
    reason: "docker_environment_start_input_invalid",
    requestState: "not_issued",
    engineReady: false,
    cleanupConfirmed: true,
  });
  let signal: AbortSignal, verify: () => unknown;
  try {
    if (!input || typeof input !== "object" || types.isProxy(input))
      return invalid;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (
      Reflect.ownKeys(input).length !== 2 ||
      !descriptors.signal ||
      !("value" in descriptors.signal) ||
      !descriptors.verifyBoundary ||
      !("value" in descriptors.verifyBoundary)
    )
      return invalid;
    signal = descriptors.signal.value;
    Object.getOwnPropertyDescriptor(
      AbortSignal.prototype,
      "aborted",
    )?.get?.call(signal);
    verify = descriptors.verifyBoundary.value;
    if (
      typeof verify !== "function" ||
      types.isProxy(verify) ||
      types.isAsyncFunction(verify)
    )
      return invalid;
  } catch {
    return invalid;
  }
  let requestState: EnvironmentStartResult["requestState"] = "not_issued";
  let engineReady = false,
    cleanupConfirmed = true;
  let reason: string | null = null;
  let desktop: DesktopOperations | null = null;
  const live = (withDesktop = true) => {
    try {
      if (signal.aborted) return false;
      const checked = verify();
      if (types.isPromise(checked))
        void Promise.prototype.then.call(
          checked,
          () => {},
          () => {},
        );
      return checked === true && (!withDesktop || !desktop || desktop.verify());
    } catch {
      return false;
    }
  };
  const observe = () => {
    if (!live()) return "unknown";
    const observed = dependencies.observe();
    cleanupConfirmed &&= observed.cleanup === "confirmed";
    return observed.state;
  };
  const run = async () => {
    if (!live()) {
      reason = "docker_environment_start_boundary_unconfirmed";
      return;
    }
    const initial = observe();
    if (initial === "ready") {
      engineReady = true;
      return;
    }
    if (initial !== "known_unavailable" || !cleanupConfirmed) {
      reason = "docker_environment_start_observation_unknown";
      return;
    }
    const acquisition = dependencies.acquire(signal);
    cleanupConfirmed &&= acquisition.cleanupConfirmed;
    desktop = acquisition.operations;
    if (!desktop || !cleanupConfirmed || !live()) {
      reason = "docker_environment_start_unavailable";
      return;
    }
    const status = await desktop.command("status");
    cleanupConfirmed &&= status.cleanupConfirmed;
    if (
      !live() ||
      !cleanupConfirmed ||
      !status.completed ||
      status.status === "unknown"
    ) {
      reason = "docker_environment_start_observation_unknown";
      return;
    }
    const current = observe();
    if (current === "ready") {
      engineReady = true;
      return;
    }
    if (current !== "known_unavailable" || !cleanupConfirmed) {
      reason = "docker_environment_start_observation_unknown";
      return;
    }
    if (status.status === "stopped") {
      if (!live()) {
        reason = "docker_environment_start_boundary_unconfirmed";
        return;
      }
      requestState = "unknown";
      const started = await desktop.command("start");
      requestState =
        started.issued === true
          ? "issued"
          : started.issued === false
            ? "not_issued"
            : "unknown";
      cleanupConfirmed &&= started.cleanupConfirmed;
      if (
        started.issued !== true ||
        !started.completed ||
        !cleanupConfirmed ||
        !live()
      ) {
        reason = "docker_environment_start_request_unconfirmed";
        return;
      }
    }
    const deadline = dependencies.now() + 90_000;
    while (live()) {
      const state = observe();
      if (state === "ready") {
        engineReady = true;
        return;
      }
      if (state !== "known_unavailable" || !cleanupConfirmed) {
        reason = "docker_environment_start_observation_unknown";
        return;
      }
      if (dependencies.now() >= deadline) {
        reason = "docker_environment_start_timeout";
        return;
      }
      await dependencies.wait(signal);
    }
    reason = "docker_environment_start_boundary_unconfirmed";
  };
  try {
    await run();
  } catch {
    reason = "docker_environment_start_observation_unknown";
  } finally {
    // run内で取得したOwnerは、失敗理由と無関係に必ず終了へ渡す。
    const owner = desktop as DesktopOperations | null;
    if (owner) {
      try {
        const closed = await owner.close();
        cleanupConfirmed &&= closed;
      } catch {
        cleanupConfirmed = false;
      }
    }
  }
  if (!reason && signal.aborted) reason = "docker_environment_start_cancelled";
  if (!reason && !cleanupConfirmed)
    reason = "docker_environment_start_cleanup_unconfirmed";
  if (!reason && !live(false))
    reason = "docker_environment_start_boundary_unconfirmed";
  return Object.freeze({
    status: !reason && engineReady && cleanupConfirmed ? "ready" : "blocked",
    reason: reason ?? "docker_environment_ready",
    requestState,
    engineReady,
    cleanupConfirmed,
  });
}

/**
 * 現在のbackendとEngineを逐次観測する。
 * @responsibility 観測不能と観測資源の終了未確認を変換せず返す。
 * @trace ARCH-000008
 * @input N/A: 固定の現在環境を観測する。
 * @returns backendとEngineそれぞれの技術結果。
 * @precondition 呼出し元が環境読取りを許可している。
 * @postcondition 起動・再起動・修復・Container作成は発行しない。
 * @effect 既存DIの有界なOS一覧・Engine読取りとその観測資源の終了。
 * @failure 下位のunknown・cleanup未確認を保持する。
 * @invariant readyを全資源停止・過去要求の成功・操作許可へ昇格しない。
 * @boundary Host全体の環境観測と上位判断。
 * @security Repository・認証情報・任意コマンドを受け取らない。
 * @concurrency 逐次観測はatomicではない。新しい待機や再試行を追加しない。
 */
export function inspectDockerEnvironment(
  settings: IsolationSettings,
): DockerEnvironmentStatus {
  return Object.freeze({
    backend: observeBackendState(settings),
    engine: observeDockerEngine(settings),
  });
}

/**
 * 上位が選んだ一要求を既存の環境再起動へ渡す。
 * @responsibility 現在許可・通知・取消・技術結果をそのまま搬送する。
 * @trace ARCH-000008
 * @input request: 同じ要求ID、Signal、現在境界確認と同期通知。
 * @returns DIの元Promiseと技術結果・通知配送結果。
 * @precondition 上位が影響・現在の許可・必要な排他と保存を所有する。
 * @postcondition 補助資源の終了を含む既存DIの一操作を返す。
 * @effect DIの固定Docker Desktop停止・起動・観測・回収。
 * @failure 未発行・unknown・取消・回収未確認・配送未確認を保持する。
 * @invariant 診断の先行実行を必須にせず、各Effect前の現在確認を省略しない。
 * @boundary 上位の判断・保存と下位技術操作。
 * @security IDだけで処置を許可せず、既存verifyBoundaryとIntent通知を維持する。
 * @concurrency 新しいOwner・Lock・State・自動再送は作らない。
 */

export function restartDockerEnvironment(
  request: DockerEnvironmentRequest<"restart">,
  settings: IsolationSettings,
): Promise<DockerEnvironmentResult<"restart">>;
export function restartDockerEnvironment(
  request: DockerEnvironmentRequest<"repair">,
  settings: IsolationSettings,
): Promise<DockerEnvironmentResult<"repair">>;
export function restartDockerEnvironment(
  request: DockerEnvironmentRequest,
  settings: IsolationSettings,
): Promise<DockerEnvironmentResult>;
export function restartDockerEnvironment(
  request: DockerEnvironmentRequest,
  settings: IsolationSettings,
): Promise<DockerEnvironmentResult> {
  if (
    !request ||
    typeof request !== "object" ||
    types.isProxy(request) ||
    Reflect.ownKeys(request).length !== 2
  )
    throw Error("docker_environment_mode_invalid");
  const mode = Object.getOwnPropertyDescriptor(request, "mode");
  const input = Object.getOwnPropertyDescriptor(request, "input");
  if (!mode || !("value" in mode) || !input || !("value" in input))
    throw Error("docker_environment_mode_invalid");
  if (mode.value === "restart") return restartDesktop(input.value, settings);
  if (mode.value === "repair") return runRepairSession(input.value, settings);
  throw Error("docker_environment_mode_invalid");
}
