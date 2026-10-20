/**
 * docker-restart-machineに属する責務をまとめる。
 *
 * @responsibility Sessionを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { spawnSync } from "node:child_process";

import { createDockerCliEnvironment } from "../execution/cli-environment.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "../execution/cli-trust.ts";
import type { DockerDesktopRestartNativeHelperOutcome } from "../../../platform-access/src/index.ts";
import {
  type DockerRuntimeEngineState,
  type DockerRuntimeEngineObservation,
  observeDockerRuntimeEngine,
} from "./engine-state.ts";
import {
  type DockerRuntimeBackendState,
  observeDockerRuntimeBackendState,
} from "./backend-state.ts";

/**
 * docker-restart-machineで使用するSessionの値契約を定義する。
 *
 * @responsibility SessionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Sessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sessionの宣言は外部境界を開かない。
 * @security SessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Session = NonNullable<DockerDesktopRestartNativeHelperOutcome["session"]>;
/**
 * 停止処理がunknownを返した位置だけを表す非Authorityの診断。
 * @responsibility 観測不能を資源の存在・不存在へ読み替えない固定語彙を所有する。
 * @trace ARCH-000008
 * @shape stopの終端失敗箇所。成功と未実施はnullで別表現する。
 * @invariant 処置許可・再試行・回復判定に使わない。
 * @boundary Machine内部と同じRuntime結果。
 * @security Path・Process ID・生例外を含まない。
 * @compatibility 既存reasonとprimaryFailureを置換しない。
 */
export type DockerRestartStopFailure =
  | "initial_trust_unconfirmed"
  | "client_processes_unconfirmed"
  | "desktop_processes_unconfirmed"
  | "backend_unconfirmed"
  | "engine_unconfirmed"
  | "containers_absence_unconfirmed"
  | "boundary_unconfirmed"
  | "request_trust_unconfirmed"
  | "stop_request_unconfirmed"
  | "stop_wait_unconfirmed"
  | "stopped_state_unconfirmed"
  | "exception";
/**
 * 起動確認が止まった位置を表す非Authorityの診断。
 * @responsibility 起動前の拒否と要求後の確認失敗を固定語彙で区別する。
 * @trace ARCH-000008
 * @shape 成功・未実施はnull、失敗は最初の確認位置。
 * @invariant 再試行・回復・処置許可の判定には使わない。
 * @boundary 同じRuntimeの結果へだけ搬送する。
 * @security Path・Process ID・生例外を含めない。
 * @compatibility reason・Primary Failure・Effect不明状態は変更しない。
 */
export type DockerRestartStartFailure =
  | "stop_not_confirmed"
  | "initial_trust_unconfirmed"
  | "client_processes_unconfirmed"
  | "desktop_processes_unconfirmed"
  | "engine_unconfirmed"
  | "backend_unconfirmed"
  | "final_trust_unconfirmed"
  | "boundary_unconfirmed"
  | "launch_request_unconfirmed"
  | "readiness_trust_unconfirmed"
  | "readiness_timeout"
  | "exception";
/**
 * docker-restart-machineで使用するMachine Portsの値契約を定義する。
 *
 * @responsibility Machine PortsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape MachinePortsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MachinePortsで宣言した値と責務の対応を維持する。
 * @boundary N/A: MachinePortsの宣言は外部境界を開かない。
 * @security MachinePortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MachinePortsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MachinePorts = Readonly<{
  session: Session;
  observeBackend: () => DockerRuntimeBackendState;
  observeEngine: () =>
    | DockerRuntimeEngineState
    | DockerRuntimeEngineObservation;
  containersAbsent: () => boolean;
  now: () => number;
  wait: () => Promise<void>;
  boundary?: () => boolean;
  signal?: AbortSignal;
  onRequestAccepted?: () => void;
  onRequestAttempted?: () => void;
}>;

/**
 * Machineを構築する。
 *
 * @responsibility Machineの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input ports: MachinePorts
 * @returns createMachineの計算結果を返す。
 * @precondition 「ports: MachinePorts」がcreateMachineの入力契約を満たす。
 * @postcondition createMachineの責務を完了した結果だけを返す。
 * @effect N/A: createMachineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createMachineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createMachineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createMachineはProcess内の同一Subsystemで完結する。
 * @security createMachineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createMachineは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createMachine(ports: MachinePorts) {
  const { session } = ports;
  let stopConfirmed = false;
  let stopFailure: DockerRestartStopFailure | null = null;
  let startFailure: DockerRestartStartFailure | null = null;
  let isEffectOutcomeUnknown = false;
  let isEngineObservationCleanupUnknown = false;
  let abortOutcome: ReturnType<Session["abort"]> | null = null;
  let releaseOutcome: ReturnType<Session["release"]> | null = null;
  const cancel = () => {
    if (abortOutcome || releaseOutcome) return;
    // Start asynchronously so synchronous adapter failures are joined as well.
    abortOutcome = Promise.resolve()
      .then(() => session.abort())
      .catch(() => ({
        cleanup: "unknown" as const,
        protocol: "failed" as const,
      }));
  };
  ports.signal?.addEventListener("abort", cancel, { once: true });
  if (ports.signal?.aborted) cancel();
  const live = () =>
    !ports.signal?.aborted &&
    (ports.boundary?.() ?? true) &&
    session.assertLive();
  const trusted = async () =>
    live() && (await session.verifyArtifacts()) === "verified" && live();
  const observeEngine = () => {
    const observed = ports.observeEngine();
    if (typeof observed === "string") return observed;
    if (observed.cleanup === "unknown")
      isEngineObservationCleanupUnknown = true;
    return observed.state;
  };
  const stopped = async (diagnoseStart = false) => {
    const refuse = (failure: DockerRestartStartFailure) => {
      if (diagnoseStart) startFailure = failure;
      return false;
    };
    if (!(await trusted())) return refuse("initial_trust_unconfirmed");
    if ((await session.inspectClientProcesses()) !== "absent")
      return refuse("client_processes_unconfirmed");
    if ((await session.inspectProcesses()) !== "absent")
      return refuse("desktop_processes_unconfirmed");
    if (observeEngine() !== "known_unavailable")
      return refuse("engine_unconfirmed");
    if (ports.observeBackend() !== "stopped")
      return refuse("backend_unconfirmed");
    if (!(await trusted())) return refuse("final_trust_unconfirmed");
    return true;
  };
  return Object.freeze({
    getEffectOutcomeUnknown: () => isEffectOutcomeUnknown,
    getStopFailure: () => stopFailure,
    getStartFailure: () => startFailure,
    observeStopped: async () => {
      stopConfirmed = await stopped();
      return stopConfirmed;
    },
    observeReady: async () =>
      (await trusted()) && observeEngine() === "ready" && (await trusted()),
    observeBackendState: () => ports.observeBackend(),
    stop: async (): Promise<"stopped" | "unknown"> => {
      stopConfirmed = false;
      stopFailure = null;
      isEffectOutcomeUnknown = false;
      try {
        if (!(await trusted())) {
          stopFailure = "initial_trust_unconfirmed";
          return "unknown";
        }
        if ((await session.inspectClientProcesses()) !== "absent") {
          stopFailure = "client_processes_unconfirmed";
          return "unknown";
        }
        const processes = await session.inspectProcesses();
        if (processes === "unknown") {
          stopFailure = "desktop_processes_unconfirmed";
          return "unknown";
        }
        if (!live()) {
          stopFailure = "boundary_unconfirmed";
          return "unknown";
        }
        const beforeBackend = ports.observeBackend();
        const beforeEngine = observeEngine();
        if (beforeBackend === "unknown" || beforeEngine === "unknown") {
          stopFailure =
            beforeBackend === "unknown"
              ? "backend_unconfirmed"
              : "engine_unconfirmed";
          return "unknown";
        }
        if (
          (beforeEngine === "ready" ||
            beforeBackend === "running" ||
            processes === "verified") &&
          !ports.containersAbsent()
        ) {
          stopFailure = "containers_absence_unconfirmed";
          return "unknown";
        }
        if (!live()) {
          stopFailure = "boundary_unconfirmed";
          return "unknown";
        }
        if (processes === "verified" || beforeBackend === "running") {
          if (!(await trusted())) {
            stopFailure = "request_trust_unconfirmed";
            return "unknown";
          }
          isEffectOutcomeUnknown = true;
          ports.onRequestAttempted?.();
          const result = await session.stopDesktop();
          if (result === "command_completed") ports.onRequestAccepted?.();
          if (result === "not_issued") isEffectOutcomeUnknown = false;
          if (result !== "command_completed") {
            stopFailure = "stop_request_unconfirmed";
            return "unknown";
          }
          if (!live()) {
            stopFailure = "boundary_unconfirmed";
            return "unknown";
          }
          // CLI completion can precede Desktop process exit. Observe, never infer it.
          const deadline = ports.now() + 30_000;
          for (let attempt = 0; attempt < 30; attempt += 1) {
            if (!live()) {
              stopFailure = "boundary_unconfirmed";
              return "unknown";
            }
            stopConfirmed = await stopped();
            if (stopConfirmed) {
              isEffectOutcomeUnknown = false;
              return "stopped";
            }
            const boundaryConfirmed = live();
            if (
              !boundaryConfirmed ||
              ports.now() >= deadline ||
              attempt === 29
            ) {
              stopFailure = boundaryConfirmed
                ? "stop_wait_unconfirmed"
                : "boundary_unconfirmed";
              return "unknown";
            }
            await ports.wait();
          }
        }
        stopConfirmed = await stopped();
        if (stopConfirmed) isEffectOutcomeUnknown = false;
        else stopFailure = "stopped_state_unconfirmed";
        return stopConfirmed ? "stopped" : "unknown";
      } catch {
        stopFailure = "exception";
        return "unknown";
      }
    },
    start: async (): Promise<"ready" | "unknown"> => {
      isEffectOutcomeUnknown = false;
      startFailure = null;
      try {
        if (!stopConfirmed) {
          startFailure = "stop_not_confirmed";
          return "unknown";
        }
        if (!(await stopped(true))) return "unknown";
        if (!live()) {
          startFailure = "boundary_unconfirmed";
          return "unknown";
        }
        isEffectOutcomeUnknown = true;
        ports.onRequestAttempted?.();
        if ((await session.launchDesktop()) !== "started") {
          startFailure = "launch_request_unconfirmed";
          return "unknown";
        }
        ports.onRequestAccepted?.();
        const deadline = ports.now() + 90_000;
        for (
          let attempt = 0;
          attempt < 45 && ports.now() < deadline;
          attempt += 1
        ) {
          if (!(await trusted())) {
            startFailure = "readiness_trust_unconfirmed";
            return "unknown";
          }
          if (observeEngine() === "ready" && (await trusted())) {
            isEffectOutcomeUnknown = false;
            return "ready";
          }
          await ports.wait();
        }
        startFailure = "readiness_timeout";
        return "unknown";
      } catch {
        startFailure = "exception";
        return "unknown";
      }
    },
    release: () => {
      if (releaseOutcome) return releaseOutcome;
      ports.signal?.removeEventListener("abort", cancel);
      const underlying =
        abortOutcome ?? Promise.resolve().then(() => session.release());
      releaseOutcome = Promise.resolve(underlying).then((outcome) =>
        isEngineObservationCleanupUnknown
          ? Object.freeze({ ...outcome, cleanup: "unknown" as const })
          : outcome,
      );
      return releaseOutcome;
    },
  });
}

/**
 * Containers Absentを検索する。
 *
 * @responsibility Containers Absentの検索条件、参照範囲、未検出結果境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns queryContainersAbsentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がqueryContainersAbsentの入力契約を満たす。
 * @postcondition queryContainersAbsentの責務を完了した結果だけを返す。
 * @effect queryContainersAbsentは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure queryContainersAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant queryContainersAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security queryContainersAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: queryContainersAbsentは共有非同期状態を持たない同期処理である。
 */
function queryContainersAbsent() {
  try {
    const cli = observeTrustedDockerCli();
    const env = createDockerCliEnvironment({
      dockerConfig: null,
      dockerHome: null,
    });
    if (!env) return false;
    const result = spawnSync(
      cli.executablePath,
      [
        "--host",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        "container",
        "ls",
        "--quiet",
        "--no-trunc",
      ],
      {
        env,
        shell: false,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 16_384,
        encoding: "utf8",
      },
    );
    verifyTrustedDockerCliSnapshot(cli);
    return (
      result.status === 0 &&
      result.signal === null &&
      !result.error &&
      result.stdout === "" &&
      result.stderr === ""
    );
  } catch {
    return false;
  }
}

/**
 * 下位の固定運用内で、取得済みSessionと現在の許可確認を結合する。
 *
 * @responsibility Docker Restart Machineの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input session: 取得済みSession、boundary: 現在確認、signal: 取消、onRequestAccepted: Native実受付、onRequestAttempted: Native要求試行直前の内部通知。
 * @returns createDockerRestartMachineの計算結果を返す。
 * @precondition 「session: Session、boundary: () => boolean、signal: AbortSignal」がcreateDockerRestartMachineの入力契約を満たす。
 * @postcondition createDockerRestartMachineの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartMachineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerRestartMachineは独自の失敗分岐を所有しない。
 * @invariant createDockerRestartMachineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartMachineはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartMachineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createDockerRestartMachineは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createDockerRestartMachine(
  session: Session,
  boundary: () => boolean,
  signal: AbortSignal,
  onRequestAccepted?: () => void,
  onRequestAttempted?: () => void,
) {
  return createMachine({
    session,
    boundary,
    signal,
    ...(onRequestAccepted ? { onRequestAccepted } : {}),
    ...(onRequestAttempted ? { onRequestAttempted } : {}),
    observeBackend: observeDockerRuntimeBackendState,
    observeEngine: observeDockerRuntimeEngine,
    containersAbsent: queryContainersAbsent,
    now: Date.now,
    wait: () => new Promise((resolve) => setTimeout(resolve, 1_000)),
  });
}

/**
 * Injected ports cannot obtain production preparation or issue production authority.
 *
 * @responsibility Docker Restart Machine For Verificationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input ports: MachinePorts
 * @returns createDockerRestartMachineForVerificationの計算結果を返す。
 * @precondition 「ports: MachinePorts」がcreateDockerRestartMachineForVerificationの入力契約を満たす。
 * @postcondition createDockerRestartMachineForVerificationの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRestartMachineForVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerRestartMachineForVerificationは独自の失敗分岐を所有しない。
 * @invariant createDockerRestartMachineForVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRestartMachineForVerificationはProcess内の同一Subsystemで完結する。
 * @security createDockerRestartMachineForVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRestartMachineForVerificationは共有非同期状態を持たない同期処理である。
 */
export function createDockerRestartMachineForVerification(ports: MachinePorts) {
  return createMachine(ports);
}
