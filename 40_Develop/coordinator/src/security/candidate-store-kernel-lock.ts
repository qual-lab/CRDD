/**
 * candidate-store-kernel-lockに属する責務をまとめる。
 *
 * @responsibility HostOperationSupervisorCleanupを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createRuntimeLocalTypeScriptWorker,
  spawnRuntimeLocalTypeScriptChild,
} from "../core/runtime-local-typescript-child-entrypoints.ts";
import { createWindowsHostOperationSupervisorEnvironment } from "../core/windows-child-environment.ts";
import {
  prepareInteractiveConsoleKernelLockRequest,
  runHostOperationSupervisorLifecycle,
  runInteractiveConsoleKernelLockLifecycle,
} from "./candidate-store-kernel-lock-lifecycle-internal.ts";

const SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS = 1_000;
const LOCK_RELEASE_TIMEOUT_MS = 5_000;
const INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS = 1_000;
const HOST_SUPERVISOR_RELEASE_TIMEOUT_MS = 1_000;
/**
 * candidate-store-kernel-lockで使用するHost Operation Supervisor 清掃の値契約を定義する。
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
 * candidate-store-kernel-lockで使用するHost Operation Lock Supervisorの値契約を定義する。
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
 * candidate-store-kernel-lockで使用するHost Operation Supervisor Lock Outcomeの値契約を定義する。
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
 * candidate-store-kernel-lockで使用するInteractive Console Lock Workerの値契約を定義する。
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
 * candidate-store-kernel-lockで使用するInteractive Console Kernel Lock Outcomeの値契約を定義する。
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
 * Named Pipe Kernel Lockを取得する。
 *
 * @responsibility Named Pipe Kernel Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input pipeName: string
 * @returns acquireNamedPipeKernelLockの計算結果を返す。
 * @precondition 「pipeName: string」がacquireNamedPipeKernelLockの入力契約を満たす。
 * @postcondition acquireNamedPipeKernelLockの責務を完了した結果だけを返す。
 * @effect N/A: acquireNamedPipeKernelLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: acquireNamedPipeKernelLockは独自の失敗分岐を所有しない。
 * @invariant acquireNamedPipeKernelLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireNamedPipeKernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireNamedPipeKernelLockは共有非同期状態を持たない同期処理である。
 */
function acquireNamedPipeKernelLock(pipeName: string) {
  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  const worker = createRuntimeLocalTypeScriptWorker(
    "candidate_store_lock_worker",
    {
      env: {},
      workerData: Object.freeze({ pipeName, state: sharedState }),
    },
  );
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
 * Runtime 所有 候補 Store Kernel Lockを取得する。
 *
 * @responsibility Runtime 所有 候補 Store Kernel Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input candidateStoreProtectionHash: unknown
 * @returns acquireRuntimeOwnedCandidateStoreKernelLockの計算結果を返す。
 * @precondition 「candidateStoreProtectionHash: unknown」がacquireRuntimeOwnedCandidateStoreKernelLockの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedCandidateStoreKernelLockの責務を完了した結果だけを返す。
 * @effect acquireRuntimeOwnedCandidateStoreKernelLockは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: acquireRuntimeOwnedCandidateStoreKernelLockは独自の失敗分岐を所有しない。
 * @invariant acquireRuntimeOwnedCandidateStoreKernelLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireRuntimeOwnedCandidateStoreKernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireRuntimeOwnedCandidateStoreKernelLockは共有非同期状態を持たない同期処理である。
 */
export function acquireRuntimeOwnedCandidateStoreKernelLock(
  candidateStoreProtectionHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof candidateStoreProtectionHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidateStoreProtectionHash)
  ) {
    return null;
  }
  const lockIdentity = createHash("sha256")
    .update("crdd-candidate-store-kernel-lock-v1\0")
    .update(candidateStoreProtectionHash)
    .digest("hex")
    .slice(0, 32);
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.CandidateStore.${lockIdentity}`;
  return acquireNamedPipeKernelLock(pipeName);
}

/**
 * Runtime 所有 Logical Provider Home Kernel Lockを取得する。
 *
 * @responsibility Runtime 所有 Logical Provider Home Kernel Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input stableLogicalHomeBindingHash: unknown
 * @returns acquireRuntimeOwnedLogicalProviderHomeKernelLockの計算結果を返す。
 * @precondition 「stableLogicalHomeBindingHash: unknown」がacquireRuntimeOwnedLogicalProviderHomeKernelLockの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedLogicalProviderHomeKernelLockの責務を完了した結果だけを返す。
 * @effect acquireRuntimeOwnedLogicalProviderHomeKernelLockは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: acquireRuntimeOwnedLogicalProviderHomeKernelLockは独自の失敗分岐を所有しない。
 * @invariant acquireRuntimeOwnedLogicalProviderHomeKernelLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireRuntimeOwnedLogicalProviderHomeKernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireRuntimeOwnedLogicalProviderHomeKernelLockは共有非同期状態を持たない同期処理である。
 */
export function acquireRuntimeOwnedLogicalProviderHomeKernelLock(
  stableLogicalHomeBindingHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof stableLogicalHomeBindingHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(stableLogicalHomeBindingHash)
  ) {
    return null;
  }
  const lockIdentity = createHash("sha256")
    .update("crdd-logical-provider-home-kernel-lock-v1\0")
    .update(stableLogicalHomeBindingHash)
    .digest("hex")
    .slice(0, 32);
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.ProviderHome.${lockIdentity}`;
  return acquireNamedPipeKernelLock(pipeName);
}

/**
 * Runtime 所有 Docker Runtime 状態 Kernel Lockを取得する。
 *
 * @responsibility Runtime 所有 Docker Runtime 状態 Kernel Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input runtimeStateBindingHash: unknown
 * @returns acquireRuntimeOwnedDockerRuntimeStateKernelLockの計算結果を返す。
 * @precondition 「runtimeStateBindingHash: unknown」がacquireRuntimeOwnedDockerRuntimeStateKernelLockの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedDockerRuntimeStateKernelLockの責務を完了した結果だけを返す。
 * @effect acquireRuntimeOwnedDockerRuntimeStateKernelLockは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: acquireRuntimeOwnedDockerRuntimeStateKernelLockは独自の失敗分岐を所有しない。
 * @invariant acquireRuntimeOwnedDockerRuntimeStateKernelLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireRuntimeOwnedDockerRuntimeStateKernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireRuntimeOwnedDockerRuntimeStateKernelLockは共有非同期状態を持たない同期処理である。
 */
export function acquireRuntimeOwnedDockerRuntimeStateKernelLock(
  runtimeStateBindingHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof runtimeStateBindingHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(runtimeStateBindingHash)
  )
    return null;
  const lockIdentity = createHash("sha256")
    .update("crdd-docker-runtime-state-kernel-lock-v1\0")
    .update(runtimeStateBindingHash)
    .digest("hex")
    .slice(0, 32);
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.DockerRuntimeState.${lockIdentity}`;
  return acquireNamedPipeKernelLock(pipeName);
}

/**
 * Runtime 所有 Interactive Console Kernel Lock Outcomeを取得する。
 *
 * @responsibility Runtime 所有 Interactive Console Kernel Lock Outcomeの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がacquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency acquireRuntimeOwnedInteractiveConsoleKernelLockOutcomeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome() {
  const request = prepareInteractiveConsoleKernelLockRequest();
  if (!request)
    return Promise.resolve(
      Object.freeze({
        status: "unavailable",
        lock: null,
      }) as InteractiveConsoleKernelLockOutcome,
    );
  let worker: InteractiveConsoleLockWorker;
  try {
    worker = createRuntimeLocalTypeScriptWorker("candidate_store_lock_worker", {
      env: {},
      workerData: Object.freeze({
        pipeName: request.pipeName,
        state: request.sharedState,
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
  return runInteractiveConsoleKernelLockLifecycle(worker, request.sharedState);
}

/**
 * host Operation Generation Binding Hashを決定する。
 *
 * @responsibility host Operation Generation Binding Hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input rootName: unknown、nonce: unknown
 * @returns hostOperationGenerationBindingHashの計算結果を返す。
 * @precondition 「rootName: unknown、nonce: unknown」がhostOperationGenerationBindingHashの入力契約を満たす。
 * @postcondition hostOperationGenerationBindingHashの責務を完了した結果だけを返す。
 * @effect N/A: hostOperationGenerationBindingHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hostOperationGenerationBindingHashは独自の失敗分岐を所有しない。
 * @invariant hostOperationGenerationBindingHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hostOperationGenerationBindingHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostOperationGenerationBindingHashは共有非同期状態を持たない同期処理である。
 */
export function hostOperationGenerationBindingHash(
  rootName: unknown,
  nonce: unknown,
) {
  if (
    typeof rootName !== "string" ||
    !/^crdd-coordinator-doctor-[A-Za-z0-9_-]{6,64}$/u.test(rootName) ||
    typeof nonce !== "string" ||
    !/^[a-f0-9-]{32,48}$/u.test(nonce)
  )
    return null;
  return createHash("sha256")
    .update("crdd-host-operation-generation-v1\0")
    .update(rootName)
    .update("\0")
    .update(nonce)
    .digest("hex");
}

/**
 * Runtime 所有 Host Operation Kernel Lockを取得する。
 *
 * @responsibility Runtime 所有 Host Operation Kernel Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input rootName: unknown、nonce: unknown
 * @returns acquireRuntimeOwnedHostOperationKernelLockの計算結果を返す。
 * @precondition 「rootName: unknown、nonce: unknown」がacquireRuntimeOwnedHostOperationKernelLockの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedHostOperationKernelLockの責務を完了した結果だけを返す。
 * @effect acquireRuntimeOwnedHostOperationKernelLockは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: acquireRuntimeOwnedHostOperationKernelLockは独自の失敗分岐を所有しない。
 * @invariant acquireRuntimeOwnedHostOperationKernelLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireRuntimeOwnedHostOperationKernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireRuntimeOwnedHostOperationKernelLockは共有非同期状態を持たない同期処理である。
 */
export function acquireRuntimeOwnedHostOperationKernelLock(
  rootName: unknown,
  nonce: unknown,
) {
  if (process.platform !== "win32") return null;
  const bindingHash = hostOperationGenerationBindingHash(rootName, nonce);
  if (!bindingHash) return null;
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  return acquireNamedPipeKernelLock(pipeName);
}

/**
 * Host Operation Supervisor Lock Requestを実行前候補として準備する。
 *
 * @responsibility Host Operation Supervisor Lock Requestの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input rootName: unknown、nonce: unknown、timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number; }>
 * @returns Readonly<{ pipeName: string; environment: NodeJS.ProcessEnv; timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>; }> | nullを返す。
 * @precondition 「rootName: unknown、nonce: unknown、timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number; }>」がprepareHostOperationSupervisorLockRequestの入力契約を満たす。
 * @postcondition prepareHostOperationSupervisorLockRequestの責務を完了した結果だけを返す。
 * @effect prepareHostOperationSupervisorLockRequestは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: prepareHostOperationSupervisorLockRequestは独自の失敗分岐を所有しない。
 * @invariant prepareHostOperationSupervisorLockRequestは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security prepareHostOperationSupervisorLockRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: prepareHostOperationSupervisorLockRequestは共有非同期状態を持たない同期処理である。
 */
export function prepareHostOperationSupervisorLockRequest(
  rootName: unknown,
  nonce: unknown,
  timing: Readonly<{
    acquireTimeoutMs: number;
    releaseTimeoutMs: number;
  }> = Object.freeze({
    acquireTimeoutMs: HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: HOST_SUPERVISOR_RELEASE_TIMEOUT_MS,
  }),
): Readonly<{
  pipeName: string;
  environment: NodeJS.ProcessEnv;
  timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>;
}> | null {
  if (process.platform !== "win32") return null;
  if (
    !Number.isSafeInteger(timing.acquireTimeoutMs) ||
    timing.acquireTimeoutMs < 1 ||
    timing.acquireTimeoutMs > HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS ||
    !Number.isSafeInteger(timing.releaseTimeoutMs) ||
    timing.releaseTimeoutMs < 1 ||
    timing.releaseTimeoutMs > LOCK_RELEASE_TIMEOUT_MS
  )
    return null;
  const bindingHash = hostOperationGenerationBindingHash(rootName, nonce);
  const environment = createWindowsHostOperationSupervisorEnvironment();
  if (!bindingHash || !environment) return null;
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  return Object.freeze({ pipeName, environment, timing });
}

/**
 * Runtime 所有 Host Operation Supervisor Lockを取得する。
 *
 * @responsibility Runtime 所有 Host Operation Supervisor Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000015
 * @input rootName: unknown、nonce: unknown
 * @returns acquireRuntimeOwnedHostOperationSupervisorLockの計算結果を返す。
 * @precondition 「rootName: unknown、nonce: unknown」がacquireRuntimeOwnedHostOperationSupervisorLockの入力契約を満たす。
 * @postcondition acquireRuntimeOwnedHostOperationSupervisorLockの責務を完了した結果だけを返す。
 * @effect acquireRuntimeOwnedHostOperationSupervisorLockは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure acquireRuntimeOwnedHostOperationSupervisorLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireRuntimeOwnedHostOperationSupervisorLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireRuntimeOwnedHostOperationSupervisorLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency acquireRuntimeOwnedHostOperationSupervisorLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function acquireRuntimeOwnedHostOperationSupervisorLock(
  rootName: unknown,
  nonce: unknown,
) {
  const request = prepareHostOperationSupervisorLockRequest(rootName, nonce);
  if (!request)
    return Promise.resolve(
      Object.freeze({
        status: "unavailable",
        lock: null,
      }) as HostOperationSupervisorLockOutcome,
    );
  let child: ChildProcess;
  try {
    child = spawnRuntimeLocalTypeScriptChild(
      "host_operation_lock_supervisor",
      [request.pipeName],
      {
        cwd: fileURLToPath(new URL(".", import.meta.url)),
        env: request.environment,
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
  return runHostOperationSupervisorLifecycle(request, child);
}

/**
 * 候補 Store Kernel Lock 契約の公開契約を記述する。
 *
 * @responsibility 候補 Store Kernel Lock 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCandidateStoreKernelLockContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCandidateStoreKernelLockContractの入力契約を満たす。
 * @postcondition describeCandidateStoreKernelLockContractの責務を完了した結果だけを返す。
 * @effect describeCandidateStoreKernelLockContractは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: describeCandidateStoreKernelLockContractは独自の失敗分岐を所有しない。
 * @invariant describeCandidateStoreKernelLockContractは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeCandidateStoreKernelLockContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCandidateStoreKernelLockContractは共有非同期状態を持たない同期処理である。
 */
export function describeCandidateStoreKernelLockContract() {
  return Object.freeze({
    implementation: "windows_named_pipe_kernel_object",
    identity:
      "selected_user_sid_store_identity_and_exact_protection_hash_domain_separated",
    abandonedOwnerHandling: "kernel_release_on_process_termination",
    staleFileDeletion: false,
    dockerRuntimeStateInventorySerialized: true,
    arbitraryPathAccepted: false,
    acquireTimeoutMs: SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS,
    hostSupervisorAcquireTimeoutMs: HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: LOCK_RELEASE_TIMEOUT_MS,
    interactiveConsoleCleanupTimeoutMs: INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
    hostSupervisorReleaseTimeoutMs: HOST_SUPERVISOR_RELEASE_TIMEOUT_MS,
    interactiveConsoleLock:
      "dedicated_async_acquire_and_release_with_state_and_worker_exit_confirmation",
    interactiveConsoleWorkerKeepsProcessAliveUntilRelease: true,
    interactiveConsoleOutcomes: Object.freeze([
      "acquired",
      "unavailable",
      "cleanup_unknown_process_restart_required",
    ]),
    commonSynchronousLockMeaningChanged: false,
    hostOperationCrossBoundaryReadiness:
      "dedicated_supervisor_process_round_trip_and_exit_confirmed_release_before_console_or_child_process",
    hostOperationSupervisorEnvironment:
      "runtime_owned_windows_node_child_profile_parent_environment_not_authority",
    hostOperationSupervisorOutcomes: Object.freeze([
      "acquired",
      "unavailable",
      "cleanup_confirmed_failure",
      "cleanup_unknown_process_restart_required",
    ]),
  });
}
