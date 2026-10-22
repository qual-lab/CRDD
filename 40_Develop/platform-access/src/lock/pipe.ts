/**
 * 固定Windows Named Pipeの技術的な取得・保持・解放を所有する。
 * @responsibility 固定Worker／Supervisorと既存の終了観測を接続する。
 * @trace ARCH-000015 ARCH-000004
 */
import type { ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createWindowsHostOperationSupervisorEnvironment } from "../process/environment.ts";
import {
  createRuntimeLocalTypeScriptWorker,
  spawnRuntimeLocalTypeScriptChild,
} from "../process/child.ts";
import {
  runInteractiveConsoleKernelLockLifecycle,
  runHostOperationSupervisorLifecycle,
  type InteractiveConsoleKernelLockOutcome,
  type HostOperationSupervisorLockOutcome,
} from "./lifecycle.ts";
const SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const LOCK_RELEASE_TIMEOUT_MS = 5_000;
/**
 * For 状態を完了まで待機する。
 *
 * @responsibility For 状態の待機条件、完了観測、Timeout境界を所有する。
 * @trace ARCH-000015
 * @input state: Int32Array、expected: number、timeoutMs: number
 * @returns waitForStateの計算結果を返す。
 * @precondition 「state: Int32Array、expected: number、timeoutMs: number」がwaitForStateの入力契約を満たす。
 * @postcondition waitForStateの責務を完了した結果だけを返す。
 * @effect 共有Atomicsを観測し、有界の同期待機を行う。
 * @failure N/A: waitForStateは独自の失敗分岐を所有しない。
 * @invariant 上位の同意・poison・保存判断を追加せず、既存の結果と終了不明を保持する。
 * @boundary OS端末・Process／Worker・IPCまたは共有状態の技術境界。
 * @security waitForStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 所有する待機・通知・終了条件を維持し、要求と完了観測を同一視しない。
 */
function waitForState(state: Int32Array, expected: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Atomics.load(state, 0) === expected) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    Atomics.wait(state, 0, expected, remaining);
  }
  return true;
}

/**
 * Named Pipe Kernel Lockを取得する。
 *
 * @responsibility Named Pipe Kernel Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input pipeName: string
 * @returns acquireNamedPipeKernelLockの計算結果を返す。
 * @precondition 「pipeName: string」がacquireNamedPipeKernelLockの入力契約を満たす。
 * @postcondition acquireNamedPipeKernelLockの責務を完了した結果だけを返す。
 * @effect 固定WorkerとNamed Pipeを取得し、共有状態で保持・解放を観測する。
 * @failure N/A: acquireNamedPipeKernelLockは独自の失敗分岐を所有しない。
 * @invariant 上位の同意・poison・保存判断を追加せず、既存の結果と終了不明を保持する。
 * @boundary OS端末・Process／Worker・IPCまたは共有状態の技術境界。
 * @security acquireNamedPipeKernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 所有する待機・通知・終了条件を維持し、要求と完了観測を同一視しない。
 */
export function acquireNamedPipeKernelLock(pipeName: string) {
  if (
    process.platform !== "win32" ||
    !/^\\\\\.\\pipe\\CRDD\.Coordinator\.(?:CoordinatorState|CurrentState|ProviderHome|DockerRuntimeState|HostOperation|InteractiveConsole)\.[0-9a-f]{32}$/u.test(
      pipeName,
    )
  )
    return null;

  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  const worker = createRuntimeLocalTypeScriptWorker("kernel_lock_worker", {
    env: {},
    workerData: Object.freeze({ pipeName, state: sharedState }),
  });
  worker.unref();
  let isWorkerLost = false;
  worker.once("error", () => {
    isWorkerLost = true;
  });
  worker.once("exit", () => {
    isWorkerLost = true;
  });
  if (!waitForState(state, 0, SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS)) {
    void worker.terminate();
    return null;
  }
  if (Atomics.load(state, 0) !== 1) {
    void worker.terminate();
    return null;
  }
  let isReleased = false;
  return Object.freeze({
    assertLive: () =>
      !isReleased &&
      !isWorkerLost &&
      worker.threadId > 0 &&
      Atomics.load(state, 0) === 1,
    release: () => {
      if (isReleased) return false;
      isReleased = true;
      worker.postMessage("release");
      if (!waitForState(state, 1, LOCK_RELEASE_TIMEOUT_MS)) {
        void worker.terminate();
        return false;
      }
      return Atomics.load(state, 0) === 2;
    },
  });
}

/**
 * kernel-lockで使用するInteractive Console Lock Workerの値契約を定義する。
 *
 * @responsibility Interactive Console Lock WorkerのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape InteractiveConsoleLockWorkerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleLockWorkerで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleLockWorkerの宣言は外部境界を開かない。
 * @security InteractiveConsoleLockWorkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InteractiveConsoleLockWorkerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InteractiveConsoleLockWorker = Readonly<{
  unref: () => void;
  postMessage: (value: string) => void;
  terminate: () => Promise<number>;
  once: (
    event: "error" | "exit",
    listener: ((error: Error) => void) | ((code: number) => void),
  ) => unknown;
}>;

/**
 * 固定用途Named Pipeを非同期に取得し終了を確認する。
 * @responsibility Worker起動・取得・解放・終了を所有する。
 * @trace ARCH-000015
 * @input pipeName: 上位の検査済み用途別Pipe名。
 * @returns 取得結果と解放handle。
 * @precondition 用途別Identity・取得順は上位が所有する。
 * @postcondition Worker終了不明を取得成功へ変換しない。
 * @effect 固定Worker・共有状態・Named Pipeを使用する。
 * @failure 非Windows・不正Pipeは非取得、生成不明はcleanup_unknown。
 * @invariant 永続状態・同意・poisonは判断しない。
 * @boundary WorkerとOS排他資源。
 * @security 固定用途のPipe名だけを許可する。
 * @concurrency 解放と終了を同じWorkerへ結合する。
 */
export function acquireNamedPipeKernelLockOutcome(
  pipeName: string,
): Promise<InteractiveConsoleKernelLockOutcome> {
  if (
    process.platform !== "win32" ||
    !/^\\\\\.\\pipe\\CRDD\.Coordinator\.(?:CoordinatorState|CurrentState|ProviderHome|DockerRuntimeState|HostOperation|InteractiveConsole)\.[0-9a-f]{32}$/u.test(
      pipeName,
    )
  )
    return Promise.resolve(
      Object.freeze({ status: "unavailable", lock: null }),
    );

  const sharedState = new SharedArrayBuffer(4);
  let worker: InteractiveConsoleLockWorker;
  try {
    worker = createRuntimeLocalTypeScriptWorker("kernel_lock_worker", {
      env: {},
      workerData: Object.freeze({
        pipeName: pipeName,
        state: sharedState,
      }),
    });
  } catch {
    return Promise.resolve(
      Object.freeze({
        status: "cleanup_unknown",
        lock: null,
      }) as InteractiveConsoleKernelLockOutcome,
    );
  }
  return runInteractiveConsoleKernelLockLifecycle(worker, sharedState);
}

/**
 * 検査済みHostOperation Pipeの固定Supervisorを起動する。
 * @responsibility 固定環境・IPC・ready往復と終了確認を所有する。
 * @trace ARCH-000015
 * @input request: 既存HostOperation Pipe・有界待機値。環境はPA内部で生成する。
 * @returns 取得・既知失敗・終了不明とhandle。
 * @precondition 対象Rootと世代の検査は上位が行う。
 * @postcondition 子の終了確認と取得を区別する。
 * @effect 固定Supervisor子とNamed Pipeを使用する。
 * @failure 生成前例外はcleanup_confirmed_failure、終了不明を成功にしない。
 * @invariant 同意・回復許可・永続状態は変更しない。
 * @boundary 固定子・IPC・OS排他。
 * @security 任意実行物・shellは受け取らない。
 * @concurrency ready・release・子終了を同じ子へ結合する。
 */
export function acquireNamedPipeSupervisorLock(
  request: Pick<
    Parameters<typeof runHostOperationSupervisorLifecycle>[0],
    "pipeName" | "timing"
  >,
): Promise<HostOperationSupervisorLockOutcome> {
  if (
    process.platform !== "win32" ||
    !Number.isSafeInteger(request.timing.acquireTimeoutMs) ||
    request.timing.acquireTimeoutMs < 1 ||
    request.timing.acquireTimeoutMs > 1_000 ||
    !Number.isSafeInteger(request.timing.releaseTimeoutMs) ||
    request.timing.releaseTimeoutMs < 1 ||
    request.timing.releaseTimeoutMs > 5_000 ||
    !/^\\\\\.\\pipe\\CRDD\.Coordinator\.HostOperation\.[0-9a-f]{32}$/u.test(
      request.pipeName,
    )
  )
    return Promise.resolve(
      Object.freeze({ status: "unavailable", lock: null }),
    );
  const environment = createWindowsHostOperationSupervisorEnvironment();
  if (!environment)
    return Promise.resolve(
      Object.freeze({ status: "unavailable", lock: null }),
    );
  const fixedRequest = Object.freeze({
    pipeName: request.pipeName,
    timing: request.timing,
    environment,
  });
  let child: ChildProcess;
  try {
    child = spawnRuntimeLocalTypeScriptChild(
      "host_operation_lock_supervisor",
      [request.pipeName],
      {
        cwd: fileURLToPath(new URL(".", import.meta.url)),
        env: environment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
  } catch {
    return Promise.resolve(
      Object.freeze({
        status: "cleanup_confirmed_failure",
        lock: null,
      }) as HostOperationSupervisorLockOutcome,
    );
  }
  return runHostOperationSupervisorLifecycle(fixedRequest, child);
}
