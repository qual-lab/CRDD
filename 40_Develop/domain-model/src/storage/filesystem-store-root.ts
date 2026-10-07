/**
 * Filesystem Storeへ書き込める検証済みRoot Capabilityを提供する。
 *
 * @packageDocumentation
 * @responsibility 任意Path文字列を、検証済みRootと安全な相対Pathの組合せへ置き換える。
 * @trace ARCH-000009
 * @boundary Application StoreとFilesystemの書込み境界。
 * @effect Capability作成時は読取りだけを行い、Path解決は外部Effectを発行しない。
 * @security Root外、絶対Path、親移動、Symbolic LinkおよびJunctionを拒否する。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";

const STORE_ROOT_BRAND: unique symbol = Symbol("filesystem-store-root");
const LOCK_OWNER_ABSENCE_PROOF_BRAND: unique symbol = Symbol(
  "filesystem-store-lock-owner-absence-proof",
);
const issuedStoreRoots = new WeakSet<object>();
const issuedLockOwnerAbsenceProofs = new WeakSet<object>();
const issuedCleanupRecoveryScopes = new Set<string>();
const KERNEL_LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const KERNEL_LOCK_RELEASE_TIMEOUT_MS = 5_000;

/**
 * 同一Process用cleanup再入場をStore Identityへ結合する。
 *
 * @responsibility Recovery IDだけで別Rootまたは別Lock Pathの回復Authorityを流用できないようにする。
 * @trace ARCH-000009
 * @input root、lockRelativePath、recoveryId、ownerPid。
 * @returns 完全なStore Identityを表すProcess-local key。
 * @precondition rootは検証済みCapabilityのcanonical rootである。
 * @postcondition 四要素のいずれかが異なるIdentityは異なるkeyとなる。
 * @effect N/A: 純粋な文字列生成であり外部Effectを持たない。
 * @failure N/A: 検証済み内部値だけを受け取る。
 * @invariant Recovery ID単独をcleanup Authorityとして扱わない。
 * @boundary Filesystem Store Identity→Process-local cleanup Authority。
 * @security 別Root、別Pathまたは別Owner PIDへのAuthority横展開を拒否する。
 * @concurrency keyの登録と失効は同じNode Processの同期区間で行う。
 */
function createCleanupRecoveryScopeKey(
  root: string,
  lockRelativePath: string,
  recoveryId: string,
  ownerPid: number,
): string {
  return JSON.stringify([root, lockRelativePath, recoveryId, ownerPid]);
}

/**
 * Filesystem Lock targetをOS上で一意なRoot相対Identityへ正規化する。
 *
 * @responsibility 同じFilesystem targetの別表記を一つのKernel endpoint、Proofおよびcleanup scopeへ結合する。
 * @trace ARCH-000009
 * @input root: canonical Store Root、lockFile: 解決済み絶対Lock Path。
 * @returns slash区切りのcanonical Root相対Lock Identity。
 * @precondition lockFileはresolveFilesystemStorePathでroot配下へ検証済みである。
 * @postcondition dot segment、separator差およびWindowsのcase差を同じIdentityへ畳む。
 * @effect N/A: Path文字列の純粋変換である。
 * @failure N/A: 検証済み内部Pathだけを受け取る。
 * @invariant 同じFilesystem Lock Recordは一つのKernel Identityだけを持つ。
 * @boundary Filesystem Path→Kernel／Recovery Identity。
 * @security Path aliasによる排他境界またはRecovery Authorityの分離を許さない。
 * @concurrency 全WriterがKernel Lock取得前に同じ変換を適用する。
 */
function createCanonicalLockIdentity(root: string, lockFile: string): string {
  const relative = path.relative(root, lockFile).split(path.sep).join("/");
  return process.platform === "win32" ? relative.toLowerCase() : relative;
}

/**
 * Filesystem StoreのKernel Lock解放境界を表す。
 *
 * @responsibility 同じStore IdentityのOS Endpointを一度だけ解放し、解放確認結果を返す。
 * @trace ARCH-000009
 * @shape release操作だけを持つ読取り専用値である。
 * @invariant releaseは一度だけ成功できる。
 * @boundary Filesystem Store所有権遷移→OS Kernel Endpoint。
 * @security Endpoint実値やWorker Handleを利用側へ公開しない。
 * @compatibility 利用側はbooleanの確認結果を必ず処置する。
 */
type FilesystemStoreKernelLock = Readonly<{
  release(): boolean;
}>;

/**
 * Filesystem StoreのKernel Lock取得結果を表す。
 *
 * @responsibility 取得成功、競合および観測不能を混同せず搬送する。
 * @trace ARCH-000009
 * @shape acquired時だけ解放可能なLockを持つ閉じたUnionである。
 * @invariant observation_unknownをunavailableへ畳まない。
 * @boundary OS Kernel Endpoint観測→Filesystem Store所有権遷移。
 * @security 取得確認前にLock Capabilityを発行しない。
 * @compatibility 利用側は全statusを明示的に処置する。
 */
type FilesystemStoreKernelLockOutcome =
  | Readonly<{ status: "acquired"; lock: FilesystemStoreKernelLock }>
  | Readonly<{ status: "unavailable" | "observation_unknown" }>;

/**
 * Filesystem Storeの所有権遷移をOS Kernel Lockへ直列化する。
 *
 * @responsibility Lock Recordの生成、観測および回復対象の確定を直列化し、解放後cleanupをObligationで保護する境界を作る。
 * @trace ARCH-000009
 * @input root: 検証済みRoot Path、lockRelativePath: Root相対Lock Path。
 * @returns Kernel Lockまたは取得不能・観測不能の区分。
 * @precondition 同じStore Lockを扱う全Writerが同じRootと相対Pathを使用する。
 * @postcondition acquired時はreleaseまで同じIdentityの所有権遷移を他Processが開始できない。
 * @effect Worker内でWindows Named PipeまたはLinux Abstract Unix Socketを一つlistenする。
 * @failure 競合はunavailable、Worker状態を確定できない場合はobservation_unknownへ閉じる。
 * @invariant Filesystem上のLock RecordをKernel Lockそのものとして扱わない。
 * @boundary Filesystem Store Writer→OS Kernel排他境界。
 * @security Root実値をEndpointへ公開せずSHA-256導出値だけを使用する。
 * @concurrency Workerがlistenしている間だけ同じIdentityの所有者を一つに限定する。
 */
function acquireFilesystemStoreKernelLock(
  root: string,
  lockRelativePath: string,
): FilesystemStoreKernelLockOutcome {
  if (process.platform !== "win32" && process.platform !== "linux")
    return Object.freeze({ status: "observation_unknown" as const });
  const identity = createHash("sha256")
    .update("crdd-filesystem-store-kernel-lock-v1\0")
    .update(root)
    .update("\0")
    .update(lockRelativePath)
    .digest("hex");
  const endpoint =
    process.platform === "win32"
      ? `\\\\.\\pipe\\CRDD.FilesystemStore.${identity.slice(0, 32)}`
      : `\0crdd.filesystem-store.${identity}`;
  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  const worker = new Worker(
    new URL("./filesystem-store-kernel-lock-worker.ts", import.meta.url),
    { workerData: Object.freeze({ endpoint, state: sharedState }) },
  );
  worker.unref();
  const deadline = Date.now() + KERNEL_LOCK_ACQUIRE_TIMEOUT_MS;
  while (Atomics.load(state, 0) === 0) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      void worker.terminate();
      return Object.freeze({ status: "observation_unknown" as const });
    }
    Atomics.wait(state, 0, 0, remaining);
  }
  if (Atomics.load(state, 0) !== 1) {
    void worker.terminate();
    return Object.freeze({
      status:
        Atomics.load(state, 0) === -1
          ? ("unavailable" as const)
          : ("observation_unknown" as const),
    });
  }
  let released = false;
  return Object.freeze({
    status: "acquired" as const,
    lock: Object.freeze({
      release: () => {
        if (released) return false;
        released = true;
        try {
          worker.postMessage("release");
        } catch {
          void worker.terminate();
          return false;
        }
        const releaseDeadline = Date.now() + KERNEL_LOCK_RELEASE_TIMEOUT_MS;
        while (Atomics.load(state, 0) === 1) {
          const remaining = releaseDeadline - Date.now();
          if (remaining <= 0) {
            void worker.terminate();
            return false;
          }
          Atomics.wait(state, 0, 1, remaining);
        }
        return Atomics.load(state, 0) === 2;
      },
    }),
  });
}

/**
 * Filesystem Store Lock Recordを検証して読み取る。
 *
 * @responsibility Durable Recordからexact Recovery IdentityとOwner PIDだけを取得する。
 * @trace ARCH-000009
 * @input lockFile: 検証済みStore Root配下のLock Record Path。
 * @returns 構造検証済みRecord。不在・不完全・不正時はnull。
 * @precondition lockFileはresolveFilesystemStorePathでRoot配下へ閉じている。
 * @postcondition 非null結果はRecovery Identity書式と正の安全整数PIDを満たす。
 * @effect Lock Recordを読取るだけである。
 * @failure 不在、読取り失敗、JSON不正または項目不正をnullへ閉じる。
 * @invariant 不完全RecordからRecovery Authorityを生成しない。
 * @boundary Filesystem Lock Record→検証済みRuntime値。
 * @security 任意文字列や不正PIDをRecovery Identityへ昇格しない。
 * @concurrency 呼出し側が同じKernel Lock内で世代整合を保証する。
 */
function readFilesystemStoreLockRecord(lockFile: string): Readonly<{
  recoveryId: string;
  ownerPid: number;
}> | null {
  try {
    const observed = JSON.parse(fs.readFileSync(lockFile, "utf8")) as {
      recoveryId?: unknown;
      ownerPid?: unknown;
    };
    if (
      typeof observed.recoveryId !== "string" ||
      !/^filesystem-store-lock\.[A-Za-z0-9._-]{1,128}$/u.test(
        observed.recoveryId,
      ) ||
      !Number.isSafeInteger(observed.ownerPid) ||
      (observed.ownerPid as number) <= 0
    )
      return null;
    return Object.freeze({
      recoveryId: observed.recoveryId,
      ownerPid: observed.ownerPid as number,
    });
  } catch {
    return null;
  }
}

/**
 * exact Recovery Identityの耐久Obligationを原子的に保存する。
 *
 * @responsibility Cleanup不明時も再入場できるRecovery Identityを元Recordとは別に耐久保持する。
 * @trace ARCH-000009
 * @input obligationFile: Root配下の義務Path、recoveryId: exact Identity、ownerPid: 元Owner PID。
 * @returns 同じIdentityのObligationが耐久化済みならtrue。
 * @precondition 呼出し側が同じStore IdentityのKernel Lockを保持する。
 * @postcondition trueの場合は検証可能な完全RecordがCanonical Pathに存在する。
 * @effect 一時Fileを作成・fsyncし、Canonical Obligation Pathへrenameする。
 * @failure 既存別Identity、不完全RecordまたはFilesystem失敗をfalseへ閉じる。
 * @invariant 不完全な一時FileをCanonical Obligationとして公開しない。
 * @boundary Filesystem Store Recovery→耐久Recovery Obligation。
 * @security 呼出し側が固定したexact Identity以外へ既存義務を上書きしない。
 * @concurrency 同じKernel Lock内で既存照合からrenameまで直列化する。
 */
function persistFilesystemStoreRecoveryObligation(
  obligationFile: string,
  recoveryId: string,
  ownerPid: number,
): boolean {
  if (fs.existsSync(obligationFile)) {
    const existing = readFilesystemStoreLockRecord(obligationFile);
    return (
      existing?.recoveryId === recoveryId && existing.ownerPid === ownerPid
    );
  }
  const pendingObligationFile = `${obligationFile}.pending-${process.pid}-${randomUUID()}`;
  try {
    const descriptor = fs.openSync(pendingObligationFile, "wx", 0o600);
    try {
      fs.writeFileSync(
        descriptor,
        `${JSON.stringify({ recoveryId, ownerPid })}\n`,
        "utf8",
      );
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(pendingObligationFile, obligationFile);
    return true;
  } catch {
    return false;
  } finally {
    if (fs.existsSync(pendingObligationFile))
      fs.rmSync(pendingObligationFile, { force: true });
  }
}

/**
 * 検証済みFilesystem Store Root Capabilityを定義する。
 *
 * @responsibility 許可済みRootの絶対Pathを偽造不能な型へ閉じる。
 * @trace ARCH-000009
 * @shape Brandと正規化済みRootを持つ読取り専用値である。
 * @invariant Brandは本Moduleだけが発行し、Rootは絶対Pathである。
 * @boundary Application StoreとFilesystem Path解決の境界。
 * @security 任意文字列をRoot Capabilityとして受理しない。
 * @compatibility 利用側は公開生成関数を介して取得する。
 */
export type FilesystemStoreRoot = Readonly<{
  [STORE_ROOT_BRAND]: true;
  root: string;
}>;

/**
 * Filesystem Lock Ownerの不存在を独立観測した証明を定義する。
 *
 * @responsibility exact Lock世代とOwner Process不存在の観測結果を偽造不能な値へ閉じる。
 * @trace ARCH-000009
 * @shape Root、Lock Path、Recovery IdentityおよびOwner PIDを持つ読取り専用値である。
 * @invariant 本ModuleのProcess観測だけが発行し、呼出し側は構築できない。
 * @boundary Process観測→Filesystem Lock Recovery Authority。
 * @security 裸のbooleanや呼出し側自己申告をOwner不存在証明として受理しない。
 * @compatibility ProofはProcess内だけで有効であり、永続化・搬送しない。
 */
export type FilesystemStoreLockOwnerAbsenceProof = Readonly<{
  [LOCK_OWNER_ABSENCE_PROOF_BRAND]: true;
  root: string;
  lockRelativePath: string;
  recoveryId: string;
  ownerPid: number;
}>;

/**
 * 既存の通常DirectoryをFilesystem Store Rootとして検証する。
 *
 * @responsibility Root自身と既存親chainがLinkでなく、実Pathと一致することを確認する。
 * @trace ARCH-000009
 * @input root: Store専用として呼出し側が許可した絶対Directory。
 * @returns 検証済みCapability。条件不成立時はnull。
 * @precondition rootは呼出し側が所有する用途限定Root候補である。
 * @postcondition 成功時は不変の絶対RootだけをCapabilityへ保持する。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 相対Path、不在、非Directory、Linkまたは実Path不一致をnullで拒否する。
 * @invariant Capabilityは本関数以外から構築できない。
 * @boundary Caller Authority→Filesystem Root Capability。
 * @security Link経由で別RootへAuthorityを拡張しない。
 * @concurrency 検証後の置換は防げないため、利用時にも既存chainを再検証する。
 */
export function createFilesystemStoreRoot(
  root: string,
): FilesystemStoreRoot | null {
  if (!path.isAbsolute(root)) return null;
  const resolved = path.resolve(root);
  try {
    const metadata = fs.lstatSync(resolved);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    if (fs.realpathSync.native(resolved) !== resolved) return null;
    const capability = Object.freeze({
      [STORE_ROOT_BRAND]: true as const,
      root: resolved,
    });
    issuedStoreRoots.add(capability);
    return capability;
  } catch {
    return null;
  }
}

/**
 * 既存Path chainがRootへ直接到達することを確認する。
 *
 * @responsibility TargetからRootまでの既存要素でLinkまたは実Path差替えを拒否する。
 * @trace ARCH-000009
 * @input 検証済みRoot Pathと確認対象Target Path。
 * @returns N/A: 条件成立時に復帰する。
 * @precondition TargetはRoot配下へ字句正規化済みである。
 * @postcondition 既存chainの全要素がRootへ直接接続することを確認済みとなる。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure Link、Root外またはRootへ到達しないchainを例外で拒否する。
 * @invariant 不在suffixは最初の既存親から評価する。
 * @boundary 正規化PathとFilesystem実体の境界。
 * @security Link経由のRoot逸脱を許可しない。
 * @concurrency 観測後の置換は利用側Effect直前の再解決で再確認する。
 */
function assertExistingChainIsDirect(root: string, target: string): void {
  let cursor = target;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error("filesystem_store_path_invalid");
    cursor = parent;
  }
  while (true) {
    const metadata = fs.lstatSync(cursor);
    if (metadata.isSymbolicLink())
      throw new Error("filesystem_store_path_link_forbidden");
    if (fs.realpathSync.native(cursor) !== path.resolve(cursor))
      throw new Error("filesystem_store_path_link_forbidden");
    if (cursor === root) return;
    const parent = path.dirname(cursor);
    if (parent === cursor)
      throw new Error("filesystem_store_path_outside_root");
    cursor = parent;
  }
}

/**
 * Capability内の相対Pathを安全な絶対Pathへ解決する。
 *
 * @responsibility 書込み先をCapability Root配下へ閉じ、既存Link chainを拒否する。
 * @trace ARCH-000009
 * @input capability: 検証済みRoot、relativePath: Root相対Path。
 * @returns Root配下の正規化済み絶対Path。
 * @precondition relativePathは用途側が定義したFile名または下位Pathである。
 * @postcondition 戻り値はRoot自身ではなくRoot配下にある。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 空、絶対Path、親移動、Root外またはLink chainを例外で拒否する。
 * @invariant 文字列prefixでなくpath.relativeで包含を判定する。
 * @boundary Filesystem Store Capability→具体File Path。
 * @security Capabilityが許可しないRootへPathを拡張しない。
 * @concurrency 利用側はEffect直前に本関数を呼び、同じPathを使用する。
 */
export function resolveFilesystemStorePath(
  capability: FilesystemStoreRoot,
  relativePath: string,
): string {
  if (
    typeof capability !== "object" ||
    capability === null ||
    !issuedStoreRoots.has(capability)
  )
    throw new Error("filesystem_store_root_capability_invalid");
  if (!relativePath || path.isAbsolute(relativePath))
    throw new Error("filesystem_store_relative_path_required");
  const target = path.resolve(capability.root, relativePath);
  const relative = path.relative(capability.root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("filesystem_store_path_outside_root");
  assertExistingChainIsDirect(capability.root, target);
  return target;
}

/**
 * Capability内の一回性Lock Fileを使って同期操作を排他的に実行する。
 *
 * @responsibility 複数Processのread-check-writeを同じKernel排他へ閉じる。
 * @trace ARCH-000009
 * @input capability: Store Root、lockRelativePath: Lock File、operation: 排他対象の同期操作。
 * @returns Lock取得可否と、取得時の操作結果。
 * @precondition operationは同期的で、同じStoreのWriterは同じLockを利用する。
 * @postcondition cleanup確認時だけ自世代のLock Recordを削除し、不明時は同じIdentityの回復義務を残す。
 * @effect OS Kernel Lockを取得し、Lock Recordを作成・削除してoperationが宣言するEffectを実行する。
 * @failure 生存Ownerとの競合、残存Lock回復義務、観測不能を分け、その他のFilesystem失敗は例外で返す。
 * @invariant Lock未取得時はoperationを呼ばない。
 * @boundary Store Writer→OS Kernel Lock→Filesystem Record境界。
 * @security Lock Pathも同じRoot Capabilityからだけ解決する。
 * @concurrency Hash導出Endpointで所有権遷移を直列化し、解放後の削除はObligation再確認で別世代を保護する。
 */
export function withFilesystemStoreLock<T>(
  capability: FilesystemStoreRoot,
  lockRelativePath: string,
  operation: () => T,
):
  | Readonly<{
      acquired: false;
      reason: "filesystem_store_lock_recovery_required";
      recoveryId: string;
    }>
  | Readonly<{
      acquired: false;
      reason:
        | "filesystem_store_lock_unavailable"
        | "filesystem_store_lock_observation_unknown";
    }>
  | Readonly<{ acquired: true; cleanupConfirmed: true; value: T }>
  | Readonly<{
      acquired: true;
      cleanupConfirmed: false;
      operationCompleted: true;
      reason: "filesystem_store_lock_operation_completed_cleanup_unknown";
      recoveryId: string;
      value: T;
    }>
  | Readonly<{
      acquired: true;
      cleanupConfirmed: false;
      operationCompleted: false;
      reason: "filesystem_store_lock_operation_failed_cleanup_unknown";
      recoveryId: string;
      error: unknown;
    }> {
  const lockFile = resolveFilesystemStorePath(capability, lockRelativePath);
  const lockIdentity = createCanonicalLockIdentity(capability.root, lockFile);
  fs.mkdirSync(path.dirname(lockFile), { recursive: true, mode: 0o700 });
  const kernel = acquireFilesystemStoreKernelLock(
    capability.root,
    lockIdentity,
  );
  if (kernel.status !== "acquired")
    return Object.freeze({
      acquired: false as const,
      reason:
        kernel.status === "unavailable"
          ? ("filesystem_store_lock_unavailable" as const)
          : ("filesystem_store_lock_observation_unknown" as const),
    });
  const recoveryObligationFile = `${lockFile}.recovery-obligation`;
  if (fs.existsSync(recoveryObligationFile)) {
    const obligation = readFilesystemStoreLockRecord(recoveryObligationFile);
    void kernel.lock.release();
    if (obligation === null)
      return Object.freeze({
        acquired: false as const,
        reason: "filesystem_store_lock_observation_unknown" as const,
      });
    return Object.freeze({
      acquired: false as const,
      reason: "filesystem_store_lock_recovery_required" as const,
      recoveryId: obligation.recoveryId,
    });
  }
  let descriptor: number;
  try {
    descriptor = fs.openSync(lockFile, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const observed = readFilesystemStoreLockRecord(lockFile);
      void kernel.lock.release();
      if (observed === null)
        return Object.freeze({
          acquired: false as const,
          reason: "filesystem_store_lock_observation_unknown" as const,
        });
      return Object.freeze({
        acquired: false as const,
        reason: "filesystem_store_lock_recovery_required" as const,
        recoveryId: observed.recoveryId,
      });
    }
    void kernel.lock.release();
    throw error;
  }
  const recoveryId = `filesystem-store-lock.${randomUUID()}`;
  let outcome:
    | Readonly<{ status: "completed"; value: T }>
    | Readonly<{ status: "failed"; error: unknown }>;
  try {
    fs.writeFileSync(
      descriptor,
      `${JSON.stringify({ recoveryId, ownerPid: process.pid })}\n`,
      "utf8",
    );
    fs.fsyncSync(descriptor);
    outcome = Object.freeze({
      status: "completed" as const,
      value: operation(),
    });
  } catch (error) {
    outcome = Object.freeze({ status: "failed" as const, error });
  }
  try {
    fs.closeSync(descriptor);
  } catch (error) {
    if (outcome.status === "completed")
      outcome = Object.freeze({ status: "failed" as const, error });
  }
  const isObligationPersisted = persistFilesystemStoreRecoveryObligation(
    recoveryObligationFile,
    recoveryId,
    process.pid,
  );
  const initialReleaseConfirmed = kernel.lock.release();
  if (!isObligationPersisted || !initialReleaseConfirmed) {
    issuedCleanupRecoveryScopes.add(
      createCleanupRecoveryScopeKey(
        capability.root,
        lockIdentity,
        recoveryId,
        process.pid,
      ),
    );
    return outcome.status === "completed"
      ? Object.freeze({
          acquired: true as const,
          cleanupConfirmed: false as const,
          operationCompleted: true as const,
          reason:
            "filesystem_store_lock_operation_completed_cleanup_unknown" as const,
          recoveryId,
          value: outcome.value,
        })
      : Object.freeze({
          acquired: true as const,
          cleanupConfirmed: false as const,
          operationCompleted: false as const,
          reason:
            "filesystem_store_lock_operation_failed_cleanup_unknown" as const,
          recoveryId,
          error: outcome.error,
        });
  }
  const cleanupKernel = acquireFilesystemStoreKernelLock(
    capability.root,
    lockIdentity,
  );
  const observed = readFilesystemStoreLockRecord(lockFile);
  const isCleanupReady =
    cleanupKernel.status === "acquired" &&
    observed?.recoveryId === recoveryId &&
    observed.ownerPid === process.pid &&
    readFilesystemStoreLockRecord(recoveryObligationFile)?.recoveryId ===
      recoveryId;
  const cleanupReleaseConfirmed =
    cleanupKernel.status === "acquired" ? cleanupKernel.lock.release() : false;
  if (!isCleanupReady || !cleanupReleaseConfirmed) {
    issuedCleanupRecoveryScopes.add(
      createCleanupRecoveryScopeKey(
        capability.root,
        lockIdentity,
        recoveryId,
        process.pid,
      ),
    );
    return outcome.status === "completed"
      ? Object.freeze({
          acquired: true as const,
          cleanupConfirmed: false as const,
          operationCompleted: true as const,
          reason:
            "filesystem_store_lock_operation_completed_cleanup_unknown" as const,
          recoveryId,
          value: outcome.value,
        })
      : Object.freeze({
          acquired: true as const,
          cleanupConfirmed: false as const,
          operationCompleted: false as const,
          reason:
            "filesystem_store_lock_operation_failed_cleanup_unknown" as const,
          recoveryId,
          error: outcome.error,
        });
  }
  try {
    const finalRecord = readFilesystemStoreLockRecord(lockFile);
    const finalObligation = readFilesystemStoreLockRecord(
      recoveryObligationFile,
    );
    if (
      finalRecord?.recoveryId !== recoveryId ||
      finalRecord.ownerPid !== process.pid ||
      finalObligation?.recoveryId !== recoveryId ||
      finalObligation.ownerPid !== process.pid
    )
      throw new Error("filesystem_store_lock_cleanup_identity_mismatch");
    fs.rmSync(lockFile);
    fs.rmSync(recoveryObligationFile);
  } catch (error) {
    issuedCleanupRecoveryScopes.add(
      createCleanupRecoveryScopeKey(
        capability.root,
        lockIdentity,
        recoveryId,
        process.pid,
      ),
    );
    return outcome.status === "completed"
      ? Object.freeze({
          acquired: true as const,
          cleanupConfirmed: false as const,
          operationCompleted: true as const,
          reason:
            "filesystem_store_lock_operation_completed_cleanup_unknown" as const,
          recoveryId,
          value: outcome.value,
        })
      : Object.freeze({
          acquired: true as const,
          cleanupConfirmed: false as const,
          operationCompleted: false as const,
          reason:
            "filesystem_store_lock_operation_failed_cleanup_unknown" as const,
          recoveryId,
          error,
        });
  }
  if (outcome.status === "failed") throw outcome.error;
  return Object.freeze({
    acquired: true as const,
    cleanupConfirmed: true as const,
    value: outcome.value,
  });
}

/**
 * exact Lock世代のOwner Process不存在を観測する。
 *
 * @responsibility Lock RecordとProcess状態を結合し、回復にだけ使える偽造不能Proofを発行する。
 * @trace ARCH-000009
 * @input capability、lockRelativePath、expectedRecoveryId。
 * @returns 不存在確認済みProof、または観測を完了できない理由。
 * @precondition expectedRecoveryIdはLock競合結果から得たexact Identityである。
 * @postcondition confirmedの場合だけ本Process内で検証可能なProofを返す。
 * @effect Lock RecordとOwner Process状態を読取るだけである。
 * @failure Owner稼働中、Identity不一致、壊れたRecordまたは観測不能をblockedへ閉じる。
 * @invariant PIDや経過時間だけでなく、同じRecordのRecovery Identityを必ず照合する。
 * @boundary Filesystem Lock Record→OS Process観測→Recovery Proof。
 * @security 呼出し側がOwner不存在を自己申告する入口を公開しない。
 * @concurrency Proof発行時と回復時に同じKernel Lockを取得し、解放後cleanupはObligationのexact再照合で別世代を保護する。
 */
export function observeFilesystemStoreLockOwnerAbsence(
  capability: FilesystemStoreRoot,
  lockRelativePath: string,
  expectedRecoveryId: string,
):
  | Readonly<{
      status: "confirmed";
      proof: FilesystemStoreLockOwnerAbsenceProof;
    }>
  | Readonly<{ status: "blocked"; reason: string }> {
  const lockFile = resolveFilesystemStorePath(capability, lockRelativePath);
  const lockIdentity = createCanonicalLockIdentity(capability.root, lockFile);
  const kernel = acquireFilesystemStoreKernelLock(
    capability.root,
    lockIdentity,
  );
  if (kernel.status !== "acquired")
    return Object.freeze({
      status: "blocked" as const,
      reason:
        kernel.status === "unavailable"
          ? "filesystem_store_lock_owner_present"
          : "filesystem_store_lock_owner_observation_unknown",
    });
  const recoveryObligationFile = `${lockFile}.recovery-obligation`;
  let outcome:
    | Readonly<{
        status: "confirmed";
        proof: FilesystemStoreLockOwnerAbsenceProof;
      }>
    | Readonly<{ status: "blocked"; reason: string }>;
  try {
    const observedFile = fs.existsSync(lockFile)
      ? lockFile
      : recoveryObligationFile;
    const observed = readFilesystemStoreLockRecord(observedFile);
    if (observed === null)
      outcome = Object.freeze({
        status: "blocked" as const,
        reason: fs.existsSync(observedFile)
          ? "filesystem_store_lock_owner_observation_unknown"
          : "filesystem_store_lock_recovery_identity_mismatch",
      });
    else if (observed.recoveryId !== expectedRecoveryId)
      outcome = Object.freeze({
        status: "blocked" as const,
        reason: "filesystem_store_lock_recovery_identity_mismatch",
      });
    else {
      try {
        process.kill(observed.ownerPid, 0);
        if (
          observed.ownerPid === process.pid &&
          issuedCleanupRecoveryScopes.has(
            createCleanupRecoveryScopeKey(
              capability.root,
              lockIdentity,
              expectedRecoveryId,
              observed.ownerPid,
            ),
          )
        ) {
          const proof = Object.freeze({
            [LOCK_OWNER_ABSENCE_PROOF_BRAND]: true as const,
            root: capability.root,
            lockRelativePath: lockIdentity,
            recoveryId: expectedRecoveryId,
            ownerPid: observed.ownerPid,
          });
          issuedLockOwnerAbsenceProofs.add(proof);
          outcome = Object.freeze({ status: "confirmed" as const, proof });
        } else
          outcome = Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_owner_present",
          });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH")
          outcome = Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_owner_observation_unknown",
          });
        else {
          const proof = Object.freeze({
            [LOCK_OWNER_ABSENCE_PROOF_BRAND]: true as const,
            root: capability.root,
            lockRelativePath: lockIdentity,
            recoveryId: expectedRecoveryId,
            ownerPid: observed.ownerPid,
          });
          issuedLockOwnerAbsenceProofs.add(proof);
          outcome = Object.freeze({ status: "confirmed" as const, proof });
        }
      }
    }
  } catch {
    outcome = Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_observation_unknown",
    });
  }
  if (!kernel.lock.release())
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_owner_observation_unknown",
    });
  return outcome;
}

/**
 * 残存Lockをexact Recovery IdentityとOwner不存在Proofに基づき回復する。
 *
 * @responsibility Process異常終了後のLockを競合と同一視せず、同じ世代の確認済みLockだけ削除する。
 * @trace ARCH-000009
 * @input capability、lockRelativePath、ownerAbsenceProof。
 * @returns 回復完了可否と理由。
 * @precondition Proofは同じRootとLock Pathに対して本Moduleが発行済みである。
 * @postcondition completedの場合だけ対象Lock世代が不存在となる。
 * @effect ProofとRecordのIdentity一致時だけLock Fileを削除する。
 * @failure Proof偽造、Identity不一致、壊れたRecordまたは不存在を理由付きblockedへ閉じる。
 * @invariant PID名、経過時間または裸のbooleanだけでは削除しない。
 * @boundary Runtime Recovery Authority→Filesystem Lock。
 * @security 同じRoot Capability外または別Recovery IdentityのLockを削除しない。
 * @concurrency Kernel Lockで所有権遷移を直列化し、解放後のObligation再確認で別世代を保護する。
 */
export function recoverFilesystemStoreLock(
  capability: FilesystemStoreRoot,
  lockRelativePath: string,
  ownerAbsenceProof: FilesystemStoreLockOwnerAbsenceProof,
): Readonly<{
  status: "completed" | "blocked";
  reason: string;
  recoveryId?: string;
}> {
  const lockFile = resolveFilesystemStorePath(capability, lockRelativePath);
  const lockIdentity = createCanonicalLockIdentity(capability.root, lockFile);
  const recoveryObligationFile = `${lockFile}.recovery-obligation`;
  if (
    typeof ownerAbsenceProof !== "object" ||
    ownerAbsenceProof === null ||
    !issuedLockOwnerAbsenceProofs.has(ownerAbsenceProof) ||
    ownerAbsenceProof.root !== capability.root ||
    ownerAbsenceProof.lockRelativePath !== lockIdentity
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_owner_absence_proof_invalid",
    });
  const kernel = acquireFilesystemStoreKernelLock(
    capability.root,
    lockIdentity,
  );
  if (kernel.status !== "acquired")
    return Object.freeze({
      status: "blocked" as const,
      reason:
        kernel.status === "unavailable"
          ? "filesystem_store_lock_owner_present"
          : "filesystem_store_lock_observation_unknown",
    });
  let isObligationPersisted = false;
  try {
    const obligationExists = fs.existsSync(recoveryObligationFile);
    const obligation = obligationExists
      ? readFilesystemStoreLockRecord(recoveryObligationFile)
      : null;
    if (obligationExists && obligation === null) {
      const released = kernel.lock.release();
      return released
        ? Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_observation_unknown",
          })
        : Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_recovery_cleanup_unknown",
            recoveryId: ownerAbsenceProof.recoveryId,
          });
    }
    if (
      obligationExists &&
      obligation !== null &&
      (obligation.recoveryId !== ownerAbsenceProof.recoveryId ||
        obligation.ownerPid !== ownerAbsenceProof.ownerPid)
    ) {
      const released = kernel.lock.release();
      return released
        ? Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_recovery_identity_mismatch",
          })
        : Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_recovery_cleanup_unknown",
            recoveryId: ownerAbsenceProof.recoveryId,
          });
    }
    isObligationPersisted = obligationExists;
    const lockExists = fs.existsSync(lockFile);
    const observed = lockExists
      ? readFilesystemStoreLockRecord(lockFile)
      : null;
    if (lockExists && observed === null) {
      const released = kernel.lock.release();
      return released
        ? Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_observation_unknown",
          })
        : Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_recovery_cleanup_unknown",
            recoveryId: ownerAbsenceProof.recoveryId,
          });
    }
    if (
      observed !== null &&
      (observed.recoveryId !== ownerAbsenceProof.recoveryId ||
        observed.ownerPid !== ownerAbsenceProof.ownerPid)
    ) {
      const released = kernel.lock.release();
      return released
        ? Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_recovery_identity_mismatch",
          })
        : Object.freeze({
            status: "blocked" as const,
            reason: "filesystem_store_lock_recovery_cleanup_unknown",
            recoveryId: ownerAbsenceProof.recoveryId,
          });
    }
    if (!obligationExists) {
      if (observed === null) {
        const released = kernel.lock.release();
        return released
          ? Object.freeze({
              status: "blocked" as const,
              reason: "filesystem_store_lock_recovery_identity_mismatch",
            })
          : Object.freeze({
              status: "blocked" as const,
              reason: "filesystem_store_lock_recovery_cleanup_unknown",
              recoveryId: ownerAbsenceProof.recoveryId,
            });
      }
      isObligationPersisted = persistFilesystemStoreRecoveryObligation(
        recoveryObligationFile,
        ownerAbsenceProof.recoveryId,
        ownerAbsenceProof.ownerPid,
      );
      if (!isObligationPersisted)
        throw new Error("filesystem_store_recovery_obligation_write_failed");
    }
    if (observed !== null) fs.rmSync(lockFile);
  } catch {
    const durableObligation = readFilesystemStoreLockRecord(
      recoveryObligationFile,
    );
    const released = kernel.lock.release();
    if (
      isObligationPersisted ||
      durableObligation?.recoveryId === ownerAbsenceProof.recoveryId ||
      !released
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "filesystem_store_lock_recovery_cleanup_unknown",
        recoveryId: ownerAbsenceProof.recoveryId,
      });
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_observation_unknown",
    });
  }
  if (!kernel.lock.release())
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_recovery_cleanup_unknown",
      recoveryId: ownerAbsenceProof.recoveryId,
    });
  const cleanupKernel = acquireFilesystemStoreKernelLock(
    capability.root,
    lockIdentity,
  );
  if (cleanupKernel.status !== "acquired")
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_recovery_cleanup_unknown",
      recoveryId: ownerAbsenceProof.recoveryId,
    });
  const obligation = readFilesystemStoreLockRecord(recoveryObligationFile);
  const isCleanupReady =
    obligation?.recoveryId === ownerAbsenceProof.recoveryId &&
    obligation.ownerPid === ownerAbsenceProof.ownerPid &&
    !fs.existsSync(lockFile);
  if (!cleanupKernel.lock.release() || !isCleanupReady)
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_recovery_cleanup_unknown",
      recoveryId: ownerAbsenceProof.recoveryId,
    });
  try {
    const finalObligation = readFilesystemStoreLockRecord(
      recoveryObligationFile,
    );
    if (
      finalObligation?.recoveryId !== ownerAbsenceProof.recoveryId ||
      finalObligation.ownerPid !== ownerAbsenceProof.ownerPid
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "filesystem_store_lock_recovery_cleanup_unknown",
        recoveryId: ownerAbsenceProof.recoveryId,
      });
    fs.rmSync(recoveryObligationFile);
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "filesystem_store_lock_recovery_cleanup_unknown",
      recoveryId: ownerAbsenceProof.recoveryId,
    });
  }
  issuedCleanupRecoveryScopes.delete(
    createCleanupRecoveryScopeKey(
      capability.root,
      lockIdentity,
      ownerAbsenceProof.recoveryId,
      ownerAbsenceProof.ownerPid,
    ),
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "filesystem_store_lock_recovered",
  });
}
