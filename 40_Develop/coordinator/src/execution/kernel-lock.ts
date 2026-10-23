/**
 * kernel-lockに属する責務をまとめる。
 *
 * @responsibility HostOperationSupervisorCleanupを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */

import { createHash } from "node:crypto";
import {
  acquireNamedPipeKernelLock,
  acquireNamedPipeKernelLockOutcome,
  type InteractiveConsoleKernelLockOutcome,
  acquireNamedPipeSupervisorLock,
  type HostOperationSupervisorLockOutcome,
  observeProcessLiveness,
} from "../../../platform-access/src/index.ts";

/**
 * Coordinator保存用の専用OS排他を取得する。
 *
 * @responsibility 他のRuntime排他から分離した名前空間を所有する。
 * @trace ARCH-000004
 * @input repositoryRootHash: 検証済みRootから上位が導出した64桁Hash。
 * @returns 保持確認・解放handle、または取得不能のnull。
 * @precondition Root実体の確認は上位境界が行う。
 * @postcondition 既存State／Provider／Docker排他のIdentityを変更しない。
 * @effect Workerを生成しWindows Named Pipeを排他的に保持する。
 * @failure 非Windows、不正Hash、競合と取得確認不能は取得handleを返さない。
 * @invariant 取得は保存、移行または既存Writer停止の証明ではない。
 * @boundary TypeScript WorkerからWindows OS排他への境界。
 * @security Hash自体をRepository実体やAuthorityとみなさない。
 * @concurrency 同じRootのWriterを排除し、保持中はassertLiveで確認する。
 */
export function acquireRuntimeOwnedProjectStateKernelLock(
  repositoryRootHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof repositoryRootHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(repositoryRootHash)
  )
    return null;
  const identity = createHash("sha256")
    .update("crdd-orchestrator-state-kernel-lock-v1\0")
    .update(repositoryRootHash)
    .digest("hex")
    .slice(0, 32);
  return acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.CoordinatorState.${identity}`,
  );
}

const SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS = 5_000;

/**
 * Coordinatorの現在状態更新用に、既存OS排他の専用名前空間を取得する。
 * @responsibility Repositoryごとの短期Writerを、Project・Home・Dockerの既存排他から分離する。
 * @trace ARCH-000008
 * @input repositoryRootHash: 現在検証したRepository Rootへ結合する64桁Hash。
 * @returns 保持観測・解放handle、または取得不能のnull。
 * @precondition Rootと操作Ownerの実体確認は保存Ownerが行う。
 * @postcondition 他の既存排他の名前空間を変更せず、新しいLock Frameworkを作らない。
 * @effect 既存Workerを起動し、Windows Named Pipeを排他的に保持する。
 * @failure 非Windows、不正Hash、競合、取得観測失敗ではhandleを返さない。
 * @invariant state.lockの存在やHashだけを実効排他の証明にしない。
 * @boundary Coordinator保存Ownerから既存Windows OS排他primitiveへの境界。
 * @security Lockは保存・削除・Provider操作のAuthorityを発行しない。
 * @concurrency 同じRootの同時取得を拒否し、Writerが保持・解放確認を所有する。
 */
export function acquireRuntimeOwnedCoordinatorStateKernelLock(
  repositoryRootHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof repositoryRootHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(repositoryRootHash)
  )
    return null;
  const identity = createHash("sha256")
    .update("crdd-coordinator-state-kernel-lock-v1\0")
    .update(repositoryRootHash)
    .digest("hex")
    .slice(0, 32);
  return acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.CurrentState.${identity}`,
  );
}

const HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS = 1_000;

const LOCK_RELEASE_TIMEOUT_MS = 5_000;

const INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS = 1_000;

const HOST_SUPERVISOR_RELEASE_TIMEOUT_MS = 1_000;

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
 * @effect 対象・世代・待機値を検査し、HashとPipe名を局所的に導出する。OS要求は行わない。
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
  if (!bindingHash) return null;
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  return Object.freeze({ pipeName, timing });
}

/**
 * 共通Kernel Lock 契約の公開契約を記述する。
 *
 * @responsibility 共通Kernel Lock 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeKernelLockContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeKernelLockContractの入力契約を満たす。
 * @postcondition describeKernelLockContractの責務を完了した結果だけを返す。
 * @effect describeKernelLockContractは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: describeKernelLockContractは独自の失敗分岐を所有しない。
 * @invariant describeKernelLockContractは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeKernelLockContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeKernelLockContractは共有非同期状態を持たない同期処理である。
 */
export function describeKernelLockContract() {
  return Object.freeze({
    implementation: "windows_named_pipe_kernel_object",
    identity: "owner_identity_and_exact_binding_hash_domain_separated",
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

/**
 * Interactive Console Kernel Lock Requestを実行前候補として準備する。
 *
 * @responsibility Interactive Console Kernel Lock Requestの準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns prepareInteractiveConsoleKernelLockRequestの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がprepareInteractiveConsoleKernelLockRequestの入力契約を満たす。
 * @postcondition prepareInteractiveConsoleKernelLockRequestの責務を完了した結果だけを返す。
 * @effect 固定用途のHashとPipe名を局所的に導出する。OS要求・共有状態生成は行わない。
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
  return Object.freeze({
    pipeName: `\\\\.\\pipe\\CRDD.Coordinator.InteractiveConsole.${lockIdentity}`,
  });
}

/**
 * 既存の対話端末namespaceを技術排他へ接続する。
 * @responsibility 用途別Hashと取得結果を上位に保つ。
 * @trace ARCH-000015
 * @input N/A: 入力なし。
 * @returns 対話排他の取得・回収状態。
 * @precondition 実行許可と取得順は呼出し側が所有する。
 * @postcondition PAの結果を変更せず返す。
 * @effect PAの固定Worker起動。
 * @failure 不正対象・非対応環境は非取得とする。
 * @invariant 取得は同意・回復許可ではない。
 * @boundary 用途別IdentityとOS排他。
 * @security 任意Pathを受け取らない。
 * @concurrency 保持と解放は返したhandleが所有する。
 */
export function acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome() {
  const request = prepareInteractiveConsoleKernelLockRequest();
  return request
    ? acquireNamedPipeKernelLockOutcome(request.pipeName)
    : Promise.resolve(
        Object.freeze({
          status: "unavailable",
          lock: null,
        }) as InteractiveConsoleKernelLockOutcome,
      );
}

/**
 * Host操作の検査済み要求を技術Supervisorへ接続する。
 * @responsibility 世代・namespaceを上位に保ち、起動・終了をPAへ委譲する。
 * @trace ARCH-000015
 * @input rootName: 対象Root名。nonce: 世代。
 * @returns Supervisorの取得・回収結果。
 * @precondition Rootの実体確認は上位が行う。
 * @postcondition PAの結果を変更せず返す。
 * @effect 固定Supervisor子をPAで起動する。
 * @failure 検査不成立は取得しない。
 * @invariant 同意・永続状態の判断を追加しない。
 * @boundary 用途別要求とOS排他。
 * @security 既存namespaceと環境契約を維持する。
 * @concurrency ready・解放・子終了はPAが所有する。
 */
export function acquireRuntimeOwnedHostOperationSupervisorLock(
  rootName: unknown,
  nonce: unknown,
) {
  const request = prepareHostOperationSupervisorLockRequest(rootName, nonce);
  return request
    ? acquireNamedPipeSupervisorLock(request)
    : Promise.resolve(
        Object.freeze({
          status: "unavailable",
          lock: null,
        }) as HostOperationSupervisorLockOutcome,
      );
}

/**
 * windows-platform-adapterで使用するCoordinator Windows Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Coordinator Windows Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorWindowsLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorWindowsLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorWindowsLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security CoordinatorWindowsLeaseOwnerObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorWindowsLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorWindowsLeaseOwnerObservation = Readonly<{
  status: "alive" | "absent" | "unknown";
  ownerProcessId: number;
  ownerGeneration: string;
}>;

/**
 * Lease 所有者を観測する。
 *
 * @responsibility Lease 所有者の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawOwner: unknown
 * @returns CoordinatorWindowsLeaseOwnerObservationを返す。
 * @precondition 「rawOwner: unknown」がobserveLeaseOwnerの入力契約を満たす。
 * @postcondition observeLeaseOwnerの責務を完了した結果だけを返す。
 * @effect observeLeaseOwnerは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure observeLeaseOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeLeaseOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security observeLeaseOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeLeaseOwnerは共有非同期状態を持たない同期処理である。
 */
export function observeLeaseOwner(
  rawOwner: unknown,
): CoordinatorWindowsLeaseOwnerObservation {
  const invalid = Object.freeze({
    status: "unknown" as const,
    ownerProcessId: 0,
    ownerGeneration: "invalid",
  });
  if (
    !rawOwner ||
    typeof rawOwner !== "object" ||
    Array.isArray(rawOwner) ||
    Object.getPrototypeOf(rawOwner) !== Object.prototype
  )
    return invalid;
  const owner = rawOwner as Readonly<Record<string, unknown>>;
  if (
    Object.keys(owner).sort().join("\0") !==
      ["ownerGeneration", "ownerProcessId"].sort().join("\0") ||
    !Number.isSafeInteger(owner.ownerProcessId) ||
    Number(owner.ownerProcessId) < 1 ||
    typeof owner.ownerGeneration !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(owner.ownerGeneration)
  )
    return invalid;
  const ownerProcessId = Number(owner.ownerProcessId);
  const ownerGeneration = owner.ownerGeneration;
  return Object.freeze({
    status: observeProcessLiveness(ownerProcessId),
    ownerProcessId,
    ownerGeneration,
  });
}
