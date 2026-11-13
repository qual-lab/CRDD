/**
 * 保存操作の排他と保持Ownerを管理する。
 * @responsibility 保存操作の排他と保持Ownerを管理する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import type { Lock, LockResult } from "../../../lock/src/index.ts";
import { acquireLock } from "../../../lock/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  getRepositoryFromWorkingDirectory,
  readRepositoryRevision,
  readRepositoryStorageIdentity,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

/** Rootを再検証し、保存OwnerとしてRepository内の固定Lock所在を準備する。 */
export function acquireExecutionStateLock(
  repositoryRootHash: unknown,
  repositoryRoot: string,
): LockResult {
  const refused: LockResult = Object.freeze({
    status: "blocked",
    reason: "lock_input_invalid",
    reference: null,
    cleanupConfirmed: true,
    descriptorClosed: true,
  });
  if (
    typeof repositoryRootHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(repositoryRootHash) ||
    typeof repositoryRoot !== "string" ||
    !path.isAbsolute(repositoryRoot)
  )
    return refused;
  try {
    const root = fs.lstatSync(repositoryRoot);
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot
    )
      return refused;
    const directory = path.join(repositoryRoot, ".crdd");
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "EEXIST"
      )
        return refused;
    }
    const result = acquireLock({
      directory,
      name: `current-state.${repositoryRootHash}.lock`,
      identity: `current-state:${repositoryRootHash}`,
    });
    return result;
  } catch {
    return refused;
  }
}

/**
 * 同じ短期排他を読取りと保存確定で借用する私有Owner。
 * @responsibility 現在Repository結合とwx保持を一つの実発行値へ結合する。
 * @trace ARCH-000004、ARCH-000008
 * @shape Root、物理結合、生存照合、解放操作。
 * @invariant JSONや同じProperty値からOwnerを再構成しない。
 * @boundary storage内の取得済みOwner借用。Package公開APIではない。
 * @security このOwnerはProvider実行・Docker処置のAuthorityを持たない。
 * @compatibility CurrentStateのReader・Writerと同じwx Scopeを使う。
 */
export type StorageOwner = Readonly<{
  repositoryRoot: string;
  repositoryBinding: string;
  repositoryRootHash: string;
  assertLive: () => boolean;
  release: () => boolean;
}>;

const storageOwners = new WeakMap<
  object,
  Readonly<{
    repository: Pick<
      NonNullable<ReturnType<typeof observeExecutionRecoveryRepository>>,
      "repositoryRoot" | "repositoryBinding" | "revalidate"
    >;
    lock: Lock;
  }>
>();

/**
 * 実発行した保存Ownerの内部結合だけを取得する。
 * @responsibility 私有Mapを外へ渡さず、保存処理の既存照合点へ同じ記録を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 既存保存Ownerの候補。
 * @returns 実発行記録、又はundefined。
 * @precondition 生存・Root再照合は呼出し側の既存検査点で行う。
 * @postcondition 値が等しいだけのObjectを受け入れない。
 * @effect N/A: 私有Mapの同期読取りだけ。
 * @failure 未発行・解放済みではundefined。
 * @invariant 記録の取得だけを現在保持や書込み許可としない。
 * @boundary 保存処理内の私有Owner参照。
 * @security 入力のPropertyやcallbackを評価しない。
 * @concurrency 取得・消費・解放の順序は変更しない。
 */
export function readStorageOwnerBinding(owner: object) {
  return storageOwners.get(owner);
}

/**
 * 検証済みRootの短期wx排他を取得する。
 * @responsibility 保存Ownerの実発行、同Root再観測と解放を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory: 選択Repository内の起動位置。
 * @returns 保持中Owner、又は取得失敗と回復参照を持つ結果。
 * @precondition 呼出し側が短期処理後の解放を所有する。
 * @postcondition Root・Git Identity・wx保持を結合し、保存領域を初期化しない。
 * @effect Repository読取りと共通wx Lock取得。
 * @failure Root不正・観測不能・競合を拒否し、初期化失敗とdescriptor終了不明を区別する。
 * @invariant 新しいLock、Registry、永続状態を作らない。
 * @boundary 既存Root検証と保存短期排他。
 * @security 任意HashやCaller supplied handleを受け付けない。
 * @concurrency このOwnerの内部借用ではLockを再取得しない。
 */
export function acquireStorageOwner(
  workingDirectory: string | Repository | HistoryRepositoryInput,
): StoreResult<StorageOwner> {
  const verified =
    typeof workingDirectory === "string"
      ? getRepositoryFromWorkingDirectory(workingDirectory)
      : null;
  const repository =
    typeof workingDirectory !== "string"
      ? observeExecutionStorageRepository(workingDirectory)
      : verified?.status === "completed"
        ? observeExecutionStorageRepository(verified.capability)
        : null;
  return repository
    ? acquireStorageOwnerForRepository(repository)
    : blocked("coordinator_state_owner_invalid");
}

/**
 * 検証済み内部Repository結合へ保存排他を実発行する。
 * @responsibility 通常Reader・Writerと借用Ownerの取得経路を共有する。
 * @trace ARCH-000004、ARCH-000008
 * @input repository: 既存Ownerから取得したRoot・結合・現在照合。
 * @returns 保持中Owner、又は取得失敗と回復参照を持つ結果。
 * @precondition 外部入力を直接渡さず内部の検証済み借用だけを使う。
 * @postcondition 同じwx Scopeと保持区間を維持する。
 * @effect 共通wx排他の取得とRoot読取り。
 * @failure 不正Root・競合と、新規残存・descriptor終了不明を区別する。
 * @invariant 新しいLock・永続Registry・保存資格を作らない。
 * @boundary 私有Repository結合と短期保存排他。
 * @security このOwnerだけでは候補の書込みを許可しない。
 * @concurrency 取得したOwnerの解放は呼出し側が所有する。
 */
export function acquireStorageOwnerForRepository(
  repository: Pick<
    NonNullable<ReturnType<typeof observeExecutionRecoveryRepository>>,
    "repositoryRoot" | "repositoryBinding" | "revalidate"
  >,
): StoreResult<StorageOwner> {
  if (!repository) return blocked("coordinator_state_owner_invalid");
  const acquisition = acquireExecutionStateLock(
    repository.repositoryBinding,
    repository.repositoryRoot,
  );
  if (acquisition.status !== "acquired") return storageLockFailure(acquisition);
  const lock = acquisition.lock;
  const owner: StorageOwner = Object.freeze({
    repositoryRoot: repository.repositoryRoot,
    repositoryBinding: repository.repositoryBinding,
    repositoryRootHash: repository.repositoryBinding,
    assertLive() {
      try {
        return (
          storageOwners.has(owner) &&
          repository.revalidate() &&
          lock.assertLive()
        );
      } catch {
        return false;
      }
    },
    release() {
      if (!storageOwners.delete(owner)) return false;
      try {
        return lock.release();
      } catch {
        return false;
      }
    },
  });
  storageOwners.set(owner, { repository, lock });
  return completed("coordinator_state_lock_acquired", owner);
}

/**
 * 借用Ownerの実発行・結合・現在保持を内部で照合する。
 * @responsibility 同値の偽造、解放済み、別Rootへの借用を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 借用候補、repository: 呼出し先の検証済みRootと結合。
 * @returns 同じ実発行の内部結合、又はnull。
 * @precondition 値だけを生存根拠にしない。
 * @postcondition 入力側の関数を呼ばず真正な内部Ownerだけを照合する。
 * @effect 現在RepositoryとKernel保持の読取り。
 * @failure 不正値、別結合、Owner喪失はnull。
 * @invariant 借用だけで新しい資格やLockを発行しない。
 * @boundary 私有Ownerと保存処理。
 * @security 任意ObjectのGetterやcallbackを実行しない。
 * @concurrency 同じ保持中Kernelを再取得しない。
 */
export function borrowStorageOwner(
  owner: unknown,
  repository: Readonly<{ repositoryRoot: string; repositoryBinding: string }>,
) {
  if (!owner || typeof owner !== "object") return null;
  const binding = storageOwners.get(owner);
  try {
    return binding &&
      binding.repository.repositoryRoot === repository.repositoryRoot &&
      binding.repository.repositoryBinding === repository.repositoryBinding &&
      binding.repository.revalidate() &&
      binding.lock.assertLive()
      ? binding
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存Ownerの実発行と現在保持を利用側へ確認する。
 * @responsibility 構造が同じだけの値と解放済みOwnerを拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 内部Owner候補。
 * @returns 真正かつ現在保持中だけtrue。
 * @precondition 値からOwnerを再構成しない。
 * @postcondition 入力のPropertyやcallbackを実行しない。
 * @effect 同じRootとKernel保持の読取り。
 * @failure 観測不能はfalse。
 * @invariant 新しい排他・保存資格を発行しない。
 * @boundary 保存Ownerと業務処理。
 * @security Owner自体は業務認可ではない。
 * @concurrency 同じ取得済み排他だけを確認する。
 */
export function isLiveStorageOwner(owner: unknown): owner is StorageOwner {
  const binding =
    owner && typeof owner === "object" ? storageOwners.get(owner) : null;
  return !!binding && !!borrowStorageOwner(owner, binding.repository);
}

/**
 * 検証済みRepositoryに結合した保存試行用排他を取得する。
 *
 * @responsibility 起動Directoryから同じRootのOS排他へ接続する。
 * @trace ARCH-000004
 * @input workingDirectory: 対象Repository内の起動Directory。
 * @returns 保持確認・解放handle、または停止結果。
 * @precondition WindowsのRepositoryとして一意に解決できる。
 * @postcondition native realpathが取れなければ文字列Pathへfallbackしない。
 * @effect Filesystemを読み、WorkerとOS排他を取得する。保存Fileは作らない。
 * @failure Root不正、観測不能、競合と取得確認不能では停止する。
 * @invariant 排他取得だけで保存・移行・旧Writer停止を主張しない。
 * @boundary Repository検証からWindows短期排他への境界。
 * @security 呼出し元から任意のRoot Hashを受け取らない。
 * @concurrency 同Rootのcase差と配下起動を同じ排他へ結合する。
 */
export function acquireSnapshotPilotLock(
  workingDirectory: string | Repository | HistoryRepositoryInput,
): StoreResult<SnapshotOwner> {
  const result = acquireStorageOwner(workingDirectory);
  return result.status === "completed"
    ? completed("orchestrator_snapshot_lock_acquired", result.value)
    : result.reason === "coordinator_state_lock_unavailable"
      ? blocked("orchestrator_snapshot_lock_unavailable", false)
      : result;
}

/**
 * 取得済み排他Ownerの値契約を定義する。
 * @responsibility 保存の内部処置へRoot結合と生存確認を渡す。
 * @trace ARCH-000004
 * @shape OS排他handle、repositoryRoot、repositoryRootHash。
 * @invariant 呼出し元指定のHashを取得済みOwnerとして扱わない。
 * @boundary 保存処置のProcess内境界。
 * @security JSONから構築せず検証済み取得結果だけを用いる。
 * @compatibility 既存の短期排他取得結果と同じ値契約。
 */
export type SnapshotOwner = StorageOwner;

/**
 * 借用する保存Ownerの実発行と生存を確認する。
 * @responsibility 値が同じだけの偽造handleを拒否する。
 * @trace ARCH-000004
 * @input owner: 未検証handle。
 * @returns 発行済みで現在保持中ならtrue。
 * @precondition 同じModuleの発行集合を用いる。
 * @postcondition 解放済みと偽造値を拒否する。
 * @effect Rootの読取りだけを行う。
 * @failure 観測不能はfalse。
 * @invariant JSONや構造的な型から排他を生成しない。
 * @boundary 保存Ownerと履歴借用入口。
 * @security Root以外の書込み許可を与えない。
 * @concurrency 取得・解放は呼出し側が所有する。
 */
export function isLiveSnapshotOwner(owner: unknown): owner is SnapshotOwner {
  return isLiveStorageOwner(owner);
}

/** 取得失敗を公開可能な固定理由と非Authority参照へ投影し、PathやRecordを返さない。 */
export function storageLockFailure<T>(result: LockResult): StoreResult<T> {
  if (result.status === "acquired")
    throw Error("storage_lock_failure_requires_blocked");
  const retained = result.reference !== null || !result.cleanupConfirmed;
  return blocked(
    !result.descriptorClosed
      ? "coordinator_state_lock_descriptor_close_unconfirmed"
      : result.reason === "lock_initialization_failed"
        ? "coordinator_state_lock_initialization_failed"
        : "coordinator_state_lock_unavailable",
    retained,
    result.reference
      ? `current-state-lock.${result.reference.generation}`
      : null,
  );
}

/** 履歴枝だけが消費する値と、既存現在性検査の拡張。設定Readerは持ち込まない。 */
export type HistoryRepositoryInput = Readonly<{
  root: Repository;
  historyRetentionDays: number | null;
  revalidate: (expectedHistoryRetentionDays?: number) => boolean;
}>;

/** 保持日数とその現在性を履歴Effectの元の境界で検査する。 */
export function readHistoryRetentionDays(
  repository:
    | {
        historyRetentionDays?: number | null;
        revalidate: (expectedHistoryRetentionDays?: number) => boolean;
      }
    | undefined,
): number | null {
  const days = repository?.historyRetentionDays;
  if (
    typeof days !== "number" ||
    !Number.isSafeInteger(days) ||
    days < 1 ||
    !Number.isSafeInteger(days * 86_400_000)
  )
    return null;
  return repository?.revalidate(days) === true ? days : null;
}

/**
 * 同じ操作Ownerが構成する通常保存の有限入力。
 * @responsibility 既存の操作相関キーとfresh Repository借用を別に保持する。
 * @trace ARCH-000008
 * @shape opaque相関キー、通常Repository観測、元の未発行通知照合。
 * @invariant identityだけをOwner証明とせず、観測と候補検査を別に行う。
 * @boundary 信頼したHost構成だけ。外部JSONへ搬送しない。
 * @security 観測callbackを登録・永続化せず、生WriterやKernelを渡さない。
 * @compatibility 元の操作Mapと六値の通知相関を維持する。
 */
export type OperationStorageAccess = Readonly<{
  identity: object;
  observeRepository: () => Readonly<{
    purpose: "execution";
    root: Repository;
    operationId: string;
    revalidate: () => boolean;
  }> | null;
}>;

/**
 * 同じ実体に限る終端保存のHost観測。
 * @responsibility 終了済みの実行Ownerを復活させず、終端保存先の実体だけを再確認する。
 * @trace ARCH-000008
 * @shape 元Root、operationId、終端用途と同期再検証。
 * @invariant 通常実行・業務保存・回復読取りのContextと混用しない。
 * @boundary 元の回復又は終了Ownerから固定終端入口だけ。
 * @security この値自体から実行・回復Authorityを発行しない。
 * @compatibility 元の終端処理と一回使用証拠を別に要求する。
 */
export type SettlementStorageAccess = Readonly<{
  purpose: "settlement";
  root: Repository;
  operationId: string;
  revalidate: () => boolean;
}>;

/**
 * own data propertyだけを読む。
 * @responsibility Proxyとaccessorを評価せずHost入力を取り出す。
 * @trace ARCH-000008
 * @input value: 候補、name: 固定field。
 * @returns data値、又はundefined。
 * @precondition N/A: 不正入力の拒否を所有する。
 * @postcondition Getterやthenを呼ばない。
 * @effect N/A: 値の構造検査だけ。
 * @failure Proxy・非object・accessorはundefined。
 * @invariant 構造の一致をAuthority証明にしない。
 * @boundary 保存内部のHost入力。
 * @security 未検証Propertyを直接評価しない。
 * @concurrency N/A: 同期の局所検査。
 */
function data(value: unknown, name: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value))
    return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/**
 * 同期観測の返却値を限定して得る。
 * @responsibility 非同期値を待たず拒否し、通常関数が返した拒否Promiseも未処理にしない。
 * @trace ARCH-000008
 * @input callback: 用途固定観測、args: 元の有限引数。
 * @returns 同期値、又はundefined。
 * @precondition 呼出し側が結果の用途と値を再検査する。
 * @postcondition then getterを読まず、Promiseの完了を成功へ扱わない。
 * @effect 既存の同期観測を一回呼ぶ。
 * @failure throw・Proxy関数・async関数・Promiseはundefined。
 * @invariant 観測の失敗を不存在へ変換しない。
 * @boundary Host現在性と保存検査。
 * @security callbackを保存又は登録しない。
 * @concurrency 待機・新Worker・Queueを作らない。
 */
function synchronous(callback: unknown, ...args: unknown[]): unknown {
  if (
    typeof callback !== "function" ||
    types.isProxy(callback) ||
    types.isAsyncFunction(callback)
  )
    return undefined;
  try {
    const value: unknown = callback(...args);
    if (types.isPromise(value)) {
      Promise.prototype.then.call(value, undefined, () => undefined);
      return undefined;
    }
    if (value && typeof value === "object") {
      if (types.isProxy(value)) return undefined;
      const prototype = Object.getPrototypeOf(value);
      if (
        (prototype !== Object.prototype && prototype !== null) ||
        "then" in value
      )
        return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

/**
 * 検証済みRootの保存実体結合を導く。
 * @responsibility Rootの私有Capabilityと現在Storage Identityだけから元のHashを再現する。
 * @trace ARCH-000008
 * @input root: 既存Version Controlの検証済みRoot。
 * @returns 保存Root、結合、実体観測と再検証、又はnull。
 * @precondition この観測だけを実行Ownerの証明にしない。
 * @postcondition 元のdomainと符号化順を維持する。
 * @effect Repository配置とStorage Identityの読取り。
 * @failure 不正Root・実体観測不能はnull。
 * @invariant Path又はHashからCapabilityを再発行しない。
 * @boundary Version Controlと保存内部。
 * @security Root Capabilityを返却DTO・JSONへ複製しない。
 * @concurrency 再検証は元のI/O境界で呼ぶ。
 */
export function observeExecutionStorageRepository(
  input: Repository | HistoryRepositoryInput,
  historyInput: unknown = input,
) {
  const root = (
    data(input, "historyRetentionDays") !== undefined
      ? data(input, "root")
      : input
  ) as Repository;
  try {
    const repositoryRoot = resolveVerifiedRepositoryRoot(root);
    const observed = readRepositoryStorageIdentity(root);
    if (!repositoryRoot || !observed) return null;
    return Object.freeze({
      repositoryRoot,
      repositoryBinding: createHash("sha256")
        .update("crdd-coordinator-repository-state-binding-v1\0")
        .update(
          JSON.stringify([
            repositoryRoot,
            observed.repositoryIdentity,
            observed.repositoryInstanceIdentity,
          ]),
          "utf8",
        )
        .digest("hex"),
      historyRetentionDays:
        typeof data(historyInput, "historyRetentionDays") === "number"
          ? (data(historyInput, "historyRetentionDays") as number)
          : null,
      revalidate(expectedHistoryRetentionDays?: number) {
        const fresh = readRepositoryStorageIdentity(root);
        return (
          (expectedHistoryRetentionDays === undefined ||
            synchronous(
              data(historyInput, "revalidate"),
              expectedHistoryRetentionDays,
            ) === true) &&
          fresh !== null &&
          fresh.repositoryForm === observed.repositoryForm &&
          fresh.repositoryIdentity === observed.repositoryIdentity &&
          fresh.repositoryInstanceIdentity ===
            observed.repositoryInstanceIdentity
        );
      },
    });
  } catch {
    return null;
  }
}

/**
 * 通常実行のfresh借用を保存内部へ変換する。
 * @responsibility 元の操作Owner観測を呼び、真正Rootから同じ物理結合を導く。
 * @trace ARCH-000008
 * @input access: Host構成の通常実行保存入力。
 * @returns 元operationIdと再検証を保つ内部結合、又はnull。
 * @precondition identityは元のopaque相関キーとして別に使用する。
 * @postcondition 回復・業務・終端用途を通常用途へ昇格しない。
 * @effect 既存Owner観測とRoot実体の読取り。
 * @failure 不正Context・用途・Root・非同期観測はnull。
 * @invariant 現在性callback単独をAuthorityにしない。
 * @boundary 元の操作Ownerと単一Writer。
 * @security 生Path・任意bindingをCallerから受けない。
 * @concurrency 借用を呼出し間でcacheしない。
 */
export function observeOperationRepository(access: unknown) {
  const context = synchronous(data(access, "observeRepository"));
  const root = data(context, "root") as Repository;
  const operationId = data(context, "operationId");
  const revalidate = data(context, "revalidate");
  if (
    data(context, "purpose") !== "execution" ||
    typeof operationId !== "string" ||
    !operationId ||
    typeof revalidate !== "function"
  )
    return null;
  const repository = observeExecutionStorageRepository(root, context);
  return repository
    ? Object.freeze({
        ...repository,
        operationId,
        revalidate: (expectedHistoryRetentionDays?: number) =>
          repository.revalidate() &&
          (expectedHistoryRetentionDays === undefined
            ? synchronous(revalidate)
            : synchronous(revalidate, expectedHistoryRetentionDays)) === true,
      })
    : null;
}

/**
 * 通常保存の元相関キーを取り出す。
 * @responsibility 毎回のHost Contextを新しい一回証拠のkeyにしない。
 * @trace ARCH-000008
 * @input access: 通常実行のHost入力。
 * @returns 元object、又はnull。
 * @precondition 現在性と用途は通常借用が別に検査する。
 * @postcondition 新しいMap・資格を発行しない。
 * @effect N/A: own data値だけを取得する。
 * @failure 不正値はnull。
 * @invariant keyの存在だけを保存許可としない。
 * @boundary 既存一回MapとHost入力。
 * @security 元Capabilityを保存JSONへ含めない。
 * @concurrency 元keyの取得・消費順を変更しない。
 */
export function executionStorageOperationIdentity(access: unknown) {
  const value = data(access, "identity");
  return value && typeof value === "object" && !types.isProxy(value)
    ? value
    : null;
}

/**
 * 検証済みRootの現在Revisionを回復読取りへ固定する。
 * @responsibility 操作Authorityを復元せず、同じ実体と捕捉RevisionをReaderへ結合する。
 * @trace ARCH-000008
 * @input root: Version Controlが発行したRoot。
 * @returns 再入場読取り用の内部結合、又はnull。
 * @precondition 固定読取り入口からだけ使用する。
 * @postcondition 書込み・回復Authorityを発行しない。
 * @effect Root配置とGit Revisionを読む。
 * @failure 偽Root・実体又はRevision差・観測不能はnull又はfalse。
 * @invariant 記録からRootや旧Ownerを復元しない。
 * @boundary Root検証と回復Reader。
 * @security 元の未知を不存在へ補完しない。
 * @concurrency Readerの元の前後観測点で再検証する。
 */
export function observeExecutionRecoveryRepository(input: unknown) {
  const root = (
    data(input, "historyRetentionDays") !== undefined
      ? data(input, "root")
      : input
  ) as Repository;
  try {
    const repositoryRoot = resolveVerifiedRepositoryRoot(root);
    const initial = readRepositoryRevision(root);
    if (!repositoryRoot || !initial) return null;
    return Object.freeze({
      repositoryRoot,
      repositoryBinding: createHash("sha256")
        .update("crdd-coordinator-repository-state-binding-v1\0")
        .update(
          JSON.stringify([
            repositoryRoot,
            initial.repositoryIdentity,
            initial.repositoryInstanceIdentity,
          ]),
          "utf8",
        )
        .digest("hex"),
      historyRetentionDays:
        typeof data(input, "historyRetentionDays") === "number"
          ? (data(input, "historyRetentionDays") as number)
          : null,
      revalidate(expectedHistoryRetentionDays?: number) {
        try {
          if (
            resolveVerifiedRepositoryRoot(root) !== repositoryRoot ||
            (expectedHistoryRetentionDays !== undefined &&
              synchronous(
                data(input, "revalidate"),
                expectedHistoryRetentionDays,
              ) !== true)
          )
            return false;
          const fresh = readRepositoryRevision(root);
          return (
            fresh !== null &&
            fresh.repositoryForm === initial.repositoryForm &&
            fresh.repositoryIdentity === initial.repositoryIdentity &&
            fresh.repositoryInstanceIdentity ===
              initial.repositoryInstanceIdentity &&
            fresh.revisionIdentity === initial.revisionIdentity
          );
        } catch {
          return false;
        }
      },
    });
  } catch {
    return null;
  }
}

/**
 * 元実体に限る終端保存の借用を検証する。
 * @responsibility 終了後の現在性を通常実行のRevision条件へ戻さない。
 * @trace ARCH-000008
 * @input access: Hostが元Ownerへ結合した終端用途。
 * @returns operationIdと元の同期現在性を保つ内部結合、又はnull。
 * @precondition 用途別の一回証拠・assertOwnerをWriterが別に検査する。
 * @postcondition 通常用途・回復読取り・業務保存を終端保存へ昇格しない。
 * @effect Root実体の読取りだけ。
 * @failure 用途・Root・操作相関・同期観測の不正は拒否する。
 * @invariant Contextの形だけで処置許可を成立させない。
 * @boundary 元終了Ownerと固定終端保存入口。
 * @security Path・binding・生Kernelを入力にしない。
 * @concurrency 元のI/O前後の照合位置を維持する。
 */
export function observeExecutionSettlementRepository(access: unknown) {
  const root = data(access, "root") as Repository;
  const operationId = data(access, "operationId");
  const revalidate = data(access, "revalidate");
  if (
    data(access, "purpose") !== "settlement" ||
    typeof operationId !== "string" ||
    !operationId ||
    typeof revalidate !== "function"
  )
    return null;
  const repository = observeExecutionStorageRepository(root, access);
  return repository
    ? Object.freeze({
        ...repository,
        operationId,
        revalidate: (expectedHistoryRetentionDays?: number) =>
          repository.revalidate() &&
          (expectedHistoryRetentionDays === undefined
            ? synchronous(revalidate)
            : synchronous(revalidate, expectedHistoryRetentionDays)) === true,
      })
    : null;
}

/**
 * 同じ実行Ownerが照合した有限の終端観測を表す。
 * @responsibility Docker型への依存なしに元の終了事実だけを保存へ渡す。
 * @trace ARCH-000008
 * @shape 資源観測、一次失敗、Home・Mount・回復の終了観測。
 * @invariant この構造自体を実終了の証明にしない。
 * @boundary 元の観測Ownerと保存内の相関検査。
 * @security 実行又は回復Authorityを含めない。
 * @compatibility 元のWriterが検査するfieldを維持する。
 */
export type ExecutionTerminalStorageObservation = Readonly<{
  resourceSnapshot:
    | import("../../../docker-isolation/src/index.ts").ResourceSnapshot
    | null;
  resources: readonly unknown[];
  primaryFailure: unknown;
  homeLeaseReleased: boolean;
  mountLeaseReleased: boolean;
  recoveryCompleted: boolean;
}>;

/**
 * 通常Ownerが固定した終端用途Rootを照合する。
 * @responsibility 実資源観測を捏造せず元のHost照合を保存へ接続する。
 * @trace ARCH-000008
 * @input access: 元の有限観測入力。
 * @returns 固定用途の同期観測、又はnull。
 * @precondition Hostは既存Ownerの照合だけを渡す。
 * @postcondition 型一致だけを終了Authorityとしない。
 * @effect 元の同期照合だけ。
 * @failure 不正Context・非同期・例外・Proxyを拒否する。
 * @invariant 元の相関とunknownを維持する。
 * @boundary Domain保存と実行Owner。
 * @security 観測を登録・永続化しない。
 * @concurrency 新しい待機・Map・排他を作らない。
 */
export function observeExecutionSettlementStorageAccess(access: unknown) {
  const context = synchronous(data(access, "observeSettlementRepository"));
  return observeExecutionSettlementRepository(context);
}

/**
 * 元の清掃Owner照合を同期の有限観測として捕捉する。
 * @responsibility 実資源観測を捏造せず元のHost照合を保存へ接続する。
 * @trace ARCH-000008
 * @input access: 元の有限観測入力。
 * @returns 固定用途の同期観測、又はnull。
 * @precondition Hostは既存Ownerの照合だけを渡す。
 * @postcondition 型一致だけを終了Authorityとしない。
 * @effect 元の同期照合だけ。
 * @failure 不正Context・非同期・例外・Proxyを拒否する。
 * @invariant 元の相関とunknownを維持する。
 * @boundary Domain保存と実行Owner。
 * @security 観測を登録・永続化しない。
 * @concurrency 新しい待機・Map・排他を作らない。
 */
export function captureExecutionCleanupVerification(access: unknown) {
  const verify = synchronous(data(access, "captureCleanupVerification"));
  if (typeof verify !== "function" || types.isProxy(verify)) return null;
  return (outcome: unknown) => {
    const value = synchronous(verify, outcome);
    return typeof value === "string" ? value : null;
  };
}

/**
 * 元の終端観測Ownerへ結果とexact相関を照合する。
 * @responsibility 実資源観測を捏造せず元のHost照合を保存へ接続する。
 * @trace ARCH-000008
 * @input result、access、operationId、recoveryId: 元の有限観測入力。
 * @returns 固定用途の同期観測、又はnull。
 * @precondition Hostは既存Ownerの照合だけを渡す。
 * @postcondition 型一致だけを終了Authorityとしない。
 * @effect 元の同期照合だけ。
 * @failure 不正Context・非同期・例外・Proxyを拒否する。
 * @invariant 元の相関とunknownを維持する。
 * @boundary Domain保存と実行Owner。
 * @security 観測を登録・永続化しない。
 * @concurrency 新しい待機・Map・排他を作らない。
 */
export function observeExecutionTerminalForStorage(
  result: unknown,
  access: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  const value = synchronous(
    data(access, "observeTerminal"),
    result,
    operationId,
    recoveryId,
  );
  const resources = data(value, "resources");
  if (
    !Array.isArray(resources) ||
    types.isProxy(resources) ||
    ["homeLeaseReleased", "mountLeaseReleased", "recoveryCompleted"].some(
      (key) => typeof data(value, key) !== "boolean",
    )
  )
    return null;
  return value as ExecutionTerminalStorageObservation;
}

/**
 * 一般CRUDのRootと既存内容認可を現在の保存実体へ結合する。
 * @responsibility 入口と各I/O境界で同期認可を再照合する。
 * @trace ARCH-000008
 * @input access: Host接続、operation: 固定用途、target: 対象ID。
 * @returns 現在の認可済み保存観測、又はnull。
 * @precondition 呼出し元は用途を固定し外部要求から操作名を生成しない。
 * @postcondition 非同期・例外・不正Rootを拒否する。
 * @effect 現在Rootと既存の同期認可だけ。
 * @failure 拒否・不明はnull。
 * @invariant 新しい主体・権限・Registryを作らない。
 * @boundary Host認可と一般保存。
 * @security 生Pathや任意HashからContextを発行しない。
 * @concurrency この呼出し限り。callbackを登録しない。
 */
export function observeExecutionContentRepository(
  access: unknown,
  operation: Parameters<
    import("../state/types.ts").ExecutionModelAccess["revalidate"]
  >[0],
  target: Readonly<{ projectId: string; milestoneId: string }>,
) {
  const root = data(access, "root") as Repository;
  const principal = data(access, "principalId");
  const revalidate = data(access, "revalidate");
  if (
    typeof principal !== "string" ||
    !principal ||
    synchronous(revalidate, operation, target) !== true
  )
    return null;
  const repository = observeExecutionStorageRepository(root, access);
  return repository
    ? Object.freeze({
        ...repository,
        revalidate: (expectedHistoryRetentionDays?: number) =>
          repository.revalidate() &&
          (expectedHistoryRetentionDays === undefined
            ? synchronous(revalidate, operation, target)
            : synchronous(
                revalidate,
                operation,
                target,
                expectedHistoryRetentionDays,
              )) === true,
      })
    : null;
}

/**
 * port-resultで使用するCoordinator Port 結果の値契約を定義する。
 *
 * @responsibility Coordinator Port 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PortResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PortResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: PortResultの宣言は外部境界を開かない。
 * @security N/A: PortResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PortResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PortResult<T> = Readonly<
  | { status: "completed"; reason: string; value: T }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: string | null;
    }
>;

/**
 * durable-foundationで使用するStore 結果の値契約を定義する。
 *
 * @responsibility Store 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StoreResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoreResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoreResultの宣言は外部境界を開かない。
 * @security StoreResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoreResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StoreResult<T> = PortResult<T>;

/**
 * completedを決定する。
 *
 * @responsibility completedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、value: T
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、value: T」がcompletedの入力契約を満たす。
 * @postcondition completedの責務を完了した結果だけを返す。
 * @effect N/A: completedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedは独自の失敗分岐を所有しない。
 * @invariant completedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completedはProcess内の同一Subsystemで完結する。
 * @security completedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedは共有非同期状態を持たない同期処理である。
 */
export function completed<T>(reason: string, value: T): StoreResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

/**
 * durable-foundationを停止結果として構築する。
 *
 * @responsibility durable-foundationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、manualRecoveryRequired、recoveryId: string | null
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、manualRecoveryRequired、recoveryId: string | null」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
export function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
): StoreResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}
