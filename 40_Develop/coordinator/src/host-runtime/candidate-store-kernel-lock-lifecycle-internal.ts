/**
 * candidate-store-kernel-lock-lifecycle-internalに属する責務をまとめる。
 *
 * @responsibility HostOperationSupervisorCleanupを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";

const HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS = 1_000;
const INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS = 1_000;

/**
 * candidate-store-kernel-lock-lifecycle-internalで使用するHost Operation Supervisor 清掃の値契約を定義する。
 *
 * @responsibility Host Operation Supervisor 清掃のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape HostOperationSupervisorCleanupが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostOperationSupervisorCleanupで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostOperationSupervisorCleanupの宣言は外部境界を開かない。
 * @security HostOperationSupervisorCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostOperationSupervisorCleanupの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostOperationSupervisorCleanup =
  | "released"
  | "cleanup_confirmed_failure"
  | "cleanup_unknown";
/**
 * candidate-store-kernel-lock-lifecycle-internalで使用するHost Operation Lock Supervisorの値契約を定義する。
 *
 * @responsibility Host Operation Lock SupervisorのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape HostOperationLockSupervisorが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostOperationLockSupervisorで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostOperationLockSupervisorの宣言は外部境界を開かない。
 * @security HostOperationLockSupervisorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostOperationLockSupervisorの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type HostOperationLockSupervisor = Readonly<{
  assertLive: () => boolean;
  onFailureDetected: (listener: () => void) => () => void;
  failureDetected: Promise<void>;
  loss: Promise<Exclude<HostOperationSupervisorCleanup, "released">>;
  confirmReady: () => Promise<
    "ready" | "cleanup_confirmed_failure" | "cleanup_unknown"
  >;
  release: () => Promise<HostOperationSupervisorCleanup>;
}>;
/**
 * candidate-store-kernel-lock-lifecycle-internalで使用するHost Operation Supervisor Lock Outcomeの値契約を定義する。
 *
 * @responsibility Host Operation Supervisor Lock OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape HostOperationSupervisorLockOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostOperationSupervisorLockOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostOperationSupervisorLockOutcomeの宣言は外部境界を開かない。
 * @security HostOperationSupervisorLockOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostOperationSupervisorLockOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type HostOperationSupervisorLockOutcome = Readonly<{
  status:
    | "acquired"
    | "unavailable"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown";
  lock: HostOperationLockSupervisor | null;
}>;

/**
 * candidate-store-kernel-lock-lifecycle-internalで使用するInteractive Console Lock Workerの値契約を定義する。
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
 * candidate-store-kernel-lock-lifecycle-internalで使用するInteractive Console Kernel Lock Outcomeの値契約を定義する。
 *
 * @responsibility Interactive Console Kernel Lock OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape InteractiveConsoleKernelLockOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InteractiveConsoleKernelLockOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InteractiveConsoleKernelLockOutcomeの宣言は外部境界を開かない。
 * @security InteractiveConsoleKernelLockOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InteractiveConsoleKernelLockOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type InteractiveConsoleKernelLockOutcome = Readonly<{
  status: "acquired" | "unavailable" | "cleanup_unknown";
  lock: Readonly<{
    release: () => Promise<"released" | "cleanup_unknown">;
  }> | null;
}>;

/**
 * For 状態を完了まで待機する。
 *
 * @responsibility For 状態の待機条件、完了観測、Timeout境界を所有する。
 * @trace ARCH-000015
 * @input state: Int32Array、expected: number、timeoutMs: number
 * @returns waitForStateの計算結果を返す。
 * @precondition 「state: Int32Array、expected: number、timeoutMs: number」がwaitForStateの入力契約を満たす。
 * @postcondition waitForStateの責務を完了した結果だけを返す。
 * @effect N/A: waitForStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: waitForStateは独自の失敗分岐を所有しない。
 * @invariant waitForStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security waitForStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: waitForStateは共有非同期状態を持たない同期処理である。
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
 * bounded Worker Exitを決定する。
 *
 * @responsibility bounded Worker Exitの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input worker: InteractiveConsoleLockWorker
 * @returns boundedWorkerExitの計算結果を返す。
 * @precondition 「worker: InteractiveConsoleLockWorker」がboundedWorkerExitの入力契約を満たす。
 * @postcondition boundedWorkerExitの責務を完了した結果だけを返す。
 * @effect N/A: boundedWorkerExitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: boundedWorkerExitは独自の失敗分岐を所有しない。
 * @invariant boundedWorkerExitは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security boundedWorkerExitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency boundedWorkerExitは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function boundedWorkerExit(worker: InteractiveConsoleLockWorker) {
  return new Promise<"exited" | "error">((resolve) => {
    let isSettled = false;
    const settle = (status: "exited" | "error") => {
      if (isSettled) return;
      isSettled = true;
      resolve(status);
    };
    worker.once("error", () => settle("error"));
    worker.once("exit", () => settle("exited"));
  });
}

/**
 * Timeoutが許容範囲内か判定する。
 *
 * @responsibility Timeoutの範囲条件、境界値、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input promise: Promise<T>、timeoutMs: number
 * @returns withinTimeoutの計算結果を返す。
 * @precondition 「promise: Promise<T>、timeoutMs: number」がwithinTimeoutの入力契約を満たす。
 * @postcondition withinTimeoutの責務を完了した結果だけを返す。
 * @effect N/A: withinTimeoutは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: withinTimeoutは独自の失敗分岐を所有しない。
 * @invariant withinTimeoutは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security withinTimeoutはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency withinTimeoutは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function withinTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<Readonly<{ completed: boolean; value: T | null }>>(
    (resolve) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        resolve(Object.freeze({ completed: false, value: null }));
      }, timeoutMs);
      timer.unref();
      promise.then(
        (value) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          resolve(Object.freeze({ completed: true, value }));
        },
        () => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          resolve(Object.freeze({ completed: false, value: null }));
        },
      );
    },
  );
}

/**
 * And Confirm Interactive Console Lock Workerを終了させる。
 *
 * @responsibility And Confirm Interactive Console Lock Workerの終了Authority、対象Process、終了確認境界を所有する。
 * @trace ARCH-000015
 * @input worker: InteractiveConsoleLockWorker、exit: Promise<"exited" | "error">
 * @returns terminateAndConfirmInteractiveConsoleLockWorkerの計算結果を返す。
 * @precondition 「worker: InteractiveConsoleLockWorker、exit: Promise<"exited" | "error">」がterminateAndConfirmInteractiveConsoleLockWorkerの入力契約を満たす。
 * @postcondition terminateAndConfirmInteractiveConsoleLockWorkerの責務を完了した結果だけを返す。
 * @effect N/A: terminateAndConfirmInteractiveConsoleLockWorkerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: terminateAndConfirmInteractiveConsoleLockWorkerは独自の失敗分岐を所有しない。
 * @invariant terminateAndConfirmInteractiveConsoleLockWorkerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security terminateAndConfirmInteractiveConsoleLockWorkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency terminateAndConfirmInteractiveConsoleLockWorkerは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function terminateAndConfirmInteractiveConsoleLockWorker(
  worker: InteractiveConsoleLockWorker,
  exit: Promise<"exited" | "error">,
) {
  const termination = await withinTimeout(
    worker.terminate(),
    INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
  );
  const exitResult = await withinTimeout(
    exit,
    INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
  );
  return (
    termination.completed &&
    exitResult.completed &&
    exitResult.value === "exited"
  );
}

/**
 * Interactive Console Kernel Lock Requestを実行前候補として準備する。
 *
 * @responsibility Interactive Console Kernel Lock Requestの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns prepareInteractiveConsoleKernelLockRequestの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がprepareInteractiveConsoleKernelLockRequestの入力契約を満たす。
 * @postcondition prepareInteractiveConsoleKernelLockRequestの責務を完了した結果だけを返す。
 * @effect prepareInteractiveConsoleKernelLockRequestは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: prepareInteractiveConsoleKernelLockRequestは独自の失敗分岐を所有しない。
 * @invariant prepareInteractiveConsoleKernelLockRequestは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security prepareInteractiveConsoleKernelLockRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareInteractiveConsoleKernelLockRequestは共有非同期状態を持たない同期処理である。
 */
export function prepareInteractiveConsoleKernelLockRequest() {
  if (process.platform !== "win32") return null;
  const lockIdentity = createHash("sha256")
    .update("crdd-interactive-console-kernel-lock-v1\0")
    .digest("hex")
    .slice(0, 32);
  const sharedState = new SharedArrayBuffer(4);
  return Object.freeze({
    pipeName: `\\\\.\\pipe\\CRDD.Coordinator.InteractiveConsole.${lockIdentity}`,
    sharedState,
  });
}

/**
 * Interactive Console Kernel Lock Lifecycleを実行する。
 *
 * @responsibility Interactive Console Kernel Lock Lifecycleの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000015
 * @input worker: InteractiveConsoleLockWorker、sharedState: SharedArrayBuffer
 * @returns Promise<InteractiveConsoleKernelLockOutcome>を返す。
 * @precondition 「worker: InteractiveConsoleLockWorker、sharedState: SharedArrayBuffer」がrunInteractiveConsoleKernelLockLifecycleの入力契約を満たす。
 * @postcondition runInteractiveConsoleKernelLockLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: runInteractiveConsoleKernelLockLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runInteractiveConsoleKernelLockLifecycleは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runInteractiveConsoleKernelLockLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security runInteractiveConsoleKernelLockLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runInteractiveConsoleKernelLockLifecycleは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runInteractiveConsoleKernelLockLifecycle(
  worker: InteractiveConsoleLockWorker,
  sharedState: SharedArrayBuffer,
): Promise<InteractiveConsoleKernelLockOutcome> {
  const state = new Int32Array(sharedState);
  const exit = boundedWorkerExit(worker);
  if (!waitForState(state, 0, HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS)) {
    await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
    return Object.freeze({ status: "cleanup_unknown", lock: null });
  }
  if (Atomics.load(state, 0) !== 1) {
    const isTerminated = await terminateAndConfirmInteractiveConsoleLockWorker(
      worker,
      exit,
    );
    return Object.freeze({
      status: isTerminated ? "unavailable" : "cleanup_unknown",
      lock: null,
    });
  }
  let isReleased = false;
  return Object.freeze({
    status: "acquired",
    lock: Object.freeze({
      release: async () => {
        if (isReleased) return "cleanup_unknown" as const;
        isReleased = true;
        try {
          worker.postMessage("release");
        } catch {
          await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
          return "cleanup_unknown" as const;
        }
        if (
          !waitForState(state, 1, INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS) ||
          Atomics.load(state, 0) !== 2
        ) {
          await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
          return "cleanup_unknown" as const;
        }
        const exitResult = await withinTimeout(
          exit,
          INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
        );
        return exitResult.completed && exitResult.value === "exited"
          ? ("released" as const)
          : ("cleanup_unknown" as const);
      },
    }),
  });
}

/**
 * candidate-store-kernel-lock-lifecycle-internalで使用するSupervisor Childの値契約を定義する。
 *
 * @responsibility Supervisor ChildのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape SupervisorChildが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SupervisorChildで宣言した値と責務の対応を維持する。
 * @boundary N/A: SupervisorChildの宣言は外部境界を開かない。
 * @security SupervisorChildはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SupervisorChildの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SupervisorChild = ChildProcess;
/**
 * candidate-store-kernel-lock-lifecycle-internalで使用するSupervisor Observationの値契約を定義する。
 *
 * @responsibility Supervisor ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape SupervisorObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SupervisorObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: SupervisorObservationの宣言は外部境界を開かない。
 * @security SupervisorObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SupervisorObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SupervisorObservation =
  | "expected"
  | "unavailable"
  | "protocol_failure"
  | "error"
  | "exit"
  | "timeout";

/**
 * Supervisor Statusが完全一致するか判定する。
 *
 * @responsibility Supervisor Statusの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input message: unknown
 * @returns exactSupervisorStatusの計算結果を返す。
 * @precondition 「message: unknown」がexactSupervisorStatusの入力契約を満たす。
 * @postcondition exactSupervisorStatusの責務を完了した結果だけを返す。
 * @effect N/A: exactSupervisorStatusは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactSupervisorStatusは独自の失敗分岐を所有しない。
 * @invariant exactSupervisorStatusは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactSupervisorStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactSupervisorStatusは共有非同期状態を持たない同期処理である。
 */
function exactSupervisorStatus(message: unknown) {
  if (
    typeof message !== "object" ||
    message === null ||
    Object.getPrototypeOf(message) !== Object.prototype ||
    Reflect.ownKeys(message).length !== 1
  )
    return null;
  const status = Reflect.get(message, "status");
  return [
    "acquired",
    "ready",
    "release-ready",
    "released",
    "unavailable",
  ].includes(String(status))
    ? String(status)
    : null;
}

/**
 * For Supervisor Statusを完了まで待機する。
 *
 * @responsibility For Supervisor Statusの待機条件、完了観測、Timeout境界を所有する。
 * @trace ARCH-000015
 * @input child: SupervisorChild、expected: "acquired" | "ready" | "release-ready" | "released"、timeoutMs: number
 * @returns waitForSupervisorStatusの計算結果を返す。
 * @precondition 「child: SupervisorChild、expected: "acquired" | "ready" | "release-ready" | "released"、timeoutMs: number」がwaitForSupervisorStatusの入力契約を満たす。
 * @postcondition waitForSupervisorStatusの責務を完了した結果だけを返す。
 * @effect N/A: waitForSupervisorStatusは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: waitForSupervisorStatusは独自の失敗分岐を所有しない。
 * @invariant waitForSupervisorStatusは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security waitForSupervisorStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency waitForSupervisorStatusは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function waitForSupervisorStatus(
  child: SupervisorChild,
  expected: "acquired" | "ready" | "release-ready" | "released",
  timeoutMs: number,
) {
  return new Promise<SupervisorObservation>((resolve) => {
    let settled = false;
    const settle = (value: SupervisorObservation) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("message", onMessage);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
      resolve(value);
    };
    const onMessage = (message: unknown) => {
      const status = exactSupervisorStatus(message);
      if (status === expected) settle("expected");
      else if (expected === "acquired" && status === "unavailable")
        settle("unavailable");
      else settle("protocol_failure");
    };
    const onError = () => settle("error");
    const onExit = () => settle("exit");
    const timeout = setTimeout(() => settle("timeout"), timeoutMs);
    timeout.unref();
    child.once("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

/**
 * Supervisor Handlesを解放する。
 *
 * @responsibility Supervisor Handlesの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000015
 * @input child: SupervisorChild
 * @returns N/A: releaseSupervisorHandlesは戻り値を返さない。
 * @precondition 「child: SupervisorChild」がreleaseSupervisorHandlesの入力契約を満たす。
 * @postcondition releaseSupervisorHandlesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: releaseSupervisorHandlesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: releaseSupervisorHandlesは独自の失敗分岐を所有しない。
 * @invariant releaseSupervisorHandlesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security releaseSupervisorHandlesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseSupervisorHandlesは共有非同期状態を持たない同期処理である。
 */
function releaseSupervisorHandles(child: SupervisorChild) {
  child.removeAllListeners();
  child.unref();
  child.channel?.unref();
}

/**
 * Supervisorを終了させる。
 *
 * @responsibility Supervisorの終了Authority、対象Process、終了確認境界を所有する。
 * @trace ARCH-000015
 * @input child: SupervisorChild、timeoutMs: number
 * @returns terminateSupervisorの計算結果を返す。
 * @precondition 「child: SupervisorChild、timeoutMs: number」がterminateSupervisorの入力契約を満たす。
 * @postcondition terminateSupervisorの責務を完了した結果だけを返す。
 * @effect N/A: terminateSupervisorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure terminateSupervisorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant terminateSupervisorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security terminateSupervisorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency terminateSupervisorは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function terminateSupervisor(child: SupervisorChild, timeoutMs: number) {
  if (child.exitCode !== null || child.signalCode !== null) {
    releaseSupervisorHandles(child);
    return true;
  }
  const exit = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
  try {
    child.kill();
  } catch {
    releaseSupervisorHandles(child);
    return false;
  }
  const hasExited = await exit;
  releaseSupervisorHandles(child);
  return hasExited;
}

/**
 * unresolved Supervisor Lockを決定する。
 *
 * @responsibility unresolved Supervisor Lockの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input child: SupervisorChild
 * @returns unresolvedSupervisorLockの計算結果を返す。
 * @precondition 「child: SupervisorChild」がunresolvedSupervisorLockの入力契約を満たす。
 * @postcondition unresolvedSupervisorLockの責務を完了した結果だけを返す。
 * @effect N/A: unresolvedSupervisorLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: unresolvedSupervisorLockは独自の失敗分岐を所有しない。
 * @invariant unresolvedSupervisorLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security unresolvedSupervisorLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency unresolvedSupervisorLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function unresolvedSupervisorLock(child: SupervisorChild) {
  releaseSupervisorHandles(child);
  return Object.freeze({
    assertLive: () => false,
    onFailureDetected: (listener: () => void) => {
      listener();
      return () => undefined;
    },
    failureDetected: Promise.resolve(),
    loss: Promise.resolve("cleanup_unknown" as const),
    confirmReady: async () => "cleanup_unknown" as const,
    release: async () => "cleanup_unknown" as const,
  });
}

/**
 * Host Operation Supervisor Lifecycleを実行する。
 *
 * @responsibility Host Operation Supervisor Lifecycleの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000015
 * @input request: Readonly<{ pipeName: string; environment: NodeJS.ProcessEnv; timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>; }>、child: SupervisorChild
 * @returns Promise<HostOperationSupervisorLockOutcome>を返す。
 * @precondition 「request: Readonly<{ pipeName: string; environment: NodeJS.ProcessEnv; timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>; }>、child: SupervisorChild」がrunHostOperationSupervisorLifecycleの入力契約を満たす。
 * @postcondition runHostOperationSupervisorLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: runHostOperationSupervisorLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runHostOperationSupervisorLifecycleは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runHostOperationSupervisorLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security runHostOperationSupervisorLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runHostOperationSupervisorLifecycleは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runHostOperationSupervisorLifecycle(
  request: Readonly<{
    pipeName: string;
    environment: NodeJS.ProcessEnv;
    timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>;
  }>,
  child: SupervisorChild,
): Promise<HostOperationSupervisorLockOutcome> {
  const { timing } = request;
  const acquired = await waitForSupervisorStatus(
    child,
    "acquired",
    timing.acquireTimeoutMs,
  );
  if (
    acquired !== "expected" ||
    child.exitCode !== null ||
    child.signalCode !== null ||
    !child.connected
  ) {
    const terminated = await terminateSupervisor(
      child,
      timing.releaseTimeoutMs,
    );
    if (!terminated)
      return Object.freeze({
        status: "cleanup_unknown",
        lock: unresolvedSupervisorLock(child),
      });
    return Object.freeze({
      status:
        acquired === "unavailable"
          ? "unavailable"
          : "cleanup_confirmed_failure",
      lock: null,
    });
  }
  let state: "acquired" | "ready" | "closing" | "closed" = "acquired";
  let terminal: HostOperationSupervisorCleanup | null = null;
  let finalizer: Promise<
    Exclude<HostOperationSupervisorCleanup, "released">
  > | null = null;
  let isClosureExpected = false;
  let resolveLoss!: (
    outcome: Exclude<HostOperationSupervisorCleanup, "released">,
  ) => void;
  const loss = new Promise<Exclude<HostOperationSupervisorCleanup, "released">>(
    (resolve) => {
      resolveLoss = resolve;
    },
  );
  let resolveFailureDetected!: () => void;
  let wasFailureDetected = false;
  const failureListeners = new Set<() => void>();
  const failureDetected = new Promise<void>((resolve) => {
    resolveFailureDetected = resolve;
  });
  const detectFailure = () => {
    if (wasFailureDetected) return;
    wasFailureDetected = true;
    for (const listener of failureListeners) {
      try {
        listener();
      } catch {
        // Detection is monotonic; one observer cannot suppress another.
      }
    }
    failureListeners.clear();
    resolveFailureDetected();
  };
  const finalizeFailure = () => {
    if (terminal === "cleanup_unknown")
      return Promise.resolve("cleanup_unknown" as const);
    if (terminal === "cleanup_confirmed_failure")
      return Promise.resolve("cleanup_confirmed_failure" as const);
    if (finalizer) return finalizer;
    detectFailure();
    isClosureExpected = true;
    state = "closing";
    finalizer = (async () => {
      const terminated = await terminateSupervisor(
        child,
        timing.releaseTimeoutMs,
      );
      const outcome = terminated
        ? ("cleanup_confirmed_failure" as const)
        : ("cleanup_unknown" as const);
      terminal = outcome;
      state = terminated ? "closed" : "closing";
      resolveLoss(outcome);
      return outcome;
    })();
    return finalizer;
  };
  const unexpectedLoss = () => {
    if (!isClosureExpected && terminal === null) {
      detectFailure();
      void finalizeFailure();
    }
  };
  const unexpectedMessage = () => unexpectedLoss();
  child.on("error", unexpectedLoss);
  child.on("exit", unexpectedLoss);
  child.on("disconnect", unexpectedLoss);
  child.on("message", unexpectedMessage);
  const assertLive = () => {
    const isLive =
      terminal === null &&
      finalizer === null &&
      (state === "acquired" || state === "ready") &&
      child.exitCode === null &&
      child.signalCode === null &&
      child.connected;
    if (!isLive) unexpectedLoss();
    return isLive;
  };
  const lock: HostOperationLockSupervisor = Object.freeze({
    assertLive,
    onFailureDetected: (listener) => {
      if (wasFailureDetected) {
        listener();
        return () => undefined;
      }
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },
    failureDetected,
    loss,
    confirmReady: async () => {
      if (state !== "acquired" || !assertLive()) return finalizeFailure();
      child.removeListener("message", unexpectedMessage);
      const ready = waitForSupervisorStatus(
        child,
        "ready",
        timing.acquireTimeoutMs,
      );
      try {
        child.send("confirm-ready");
      } catch {
        return finalizeFailure();
      }
      const observed = await ready;
      if (observed === "expected") {
        state = "ready";
        child.on("message", unexpectedMessage);
        if (!assertLive()) return finalizeFailure();
        return "ready" as const;
      }
      return finalizeFailure();
    },
    release: async () => {
      if (terminal) return terminal;
      if (finalizer) return finalizer;
      if (state === "closed") return "cleanup_confirmed_failure" as const;
      if (state === "closing") return finalizeFailure();
      child.removeListener("message", unexpectedMessage);
      isClosureExpected = true;
      state = "closing";
      const releaseReady = waitForSupervisorStatus(
        child,
        "release-ready",
        timing.releaseTimeoutMs,
      );
      try {
        child.send("release");
      } catch {
        return finalizeFailure();
      }
      if ((await releaseReady) !== "expected") return finalizeFailure();
      const releaseStatus = waitForSupervisorStatus(
        child,
        "released",
        timing.releaseTimeoutMs,
      );
      const exit = new Promise<number | null>((resolve) => {
        if (child.exitCode !== null) return resolve(child.exitCode);
        const timeout = setTimeout(
          () => resolve(null),
          timing.releaseTimeoutMs,
        );
        timeout.unref();
        child.once("exit", (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
      });
      try {
        child.send("confirm-release");
      } catch {
        return finalizeFailure();
      }
      const [reported, exitCode] = await Promise.all([releaseStatus, exit]);
      if (reported === "expected" && exitCode === 0) {
        terminal = "released";
        state = "closed";
        releaseSupervisorHandles(child);
        return "released" as const;
      }
      return finalizeFailure();
    },
  });
  return Object.freeze({ status: "acquired", lock });
}
