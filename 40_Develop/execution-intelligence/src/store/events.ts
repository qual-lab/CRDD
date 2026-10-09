/**
 * execution-intelligence-storeに属する責務をまとめる。
 *
 * @responsibility ExecutionIntelligencePublicationResultを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { snapshotPlainRecord } from "../input/plain-data-snapshot.ts";

import {
  inspectExecutionIntelligenceEvent,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
} from "../record/event-and-summary.ts";
import {
  resolveVerifiedExecutionRepositoryRoot,
  type VerifiedExecutionRepositoryRoot,
} from "./verify-repository-root.ts";
import { ensureRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import {
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
  observeRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import { readExecutionIntelligenceConfig } from "../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository/location.ts";

const MAXIMUM_EVENTS = 10_000;
const MAXIMUM_TOTAL_BYTES = 32 * 1024 * 1024;
const LOCK_ATTEMPTS = 200;
const LOCK_RETRY_MS = 10;
const waitArray = new Int32Array(new SharedArrayBuffer(4));
/**
 * 不存在と観測不能を区別してDirectory Entryを観測する。
 * @responsibility ENOENTだけを不存在とし、権限不足やI/O障害を空状態へ畳まない。
 * @trace ARCH-000007
 * @input target: 検証済みRoot内の固定Path。
 * @returns 観測した存在の真偽。
 * @precondition 呼出し側がRootとPathの境界を検証済みである。
 * @postcondition 不明をfalseへ補完しない。
 * @effect Filesystem metadataを読み取る。書込みEffectは0。
 * @failure ENOENT以外の観測障害を呼出し側へ伝播する。
 * @invariant broken linkも存在として検査側へ渡す。
 * @boundary StoreとFilesystem metadataの境界。
 * @security 任意Pathを公開入力から受け取らない。
 * @concurrency 原子的なlstat一回の観測だけを表し将来の不存在を保証しない。
 */
function entryExists(target: string): boolean {
  try {
    fs.lstatSync(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * 読取り期間の半開区間を定義する。
 * @responsibility 保存・物理保持とは独立した期間抽出条件を所有する。
 * @trace ARCH-000007
 * @shape ISO日時のfromInclusive以上、toExclusive未満。
 * @invariant 全履歴の安全検査を期間抽出によって省略しない。
 * @boundary N/A: 値契約だけを定義する。
 * @security 任意PathやProvider本文を受け取らない。
 * @compatibility 未指定では全件を返す。
 */
export type ExecutionIntelligenceReadOptions = Readonly<{
  period: Readonly<{ fromInclusive: string; toExclusive: string }>;
}>;

/**
 * execution-intelligence-storeで使用するExecution Intelligence Publication 結果の値契約を定義する。
 *
 * @responsibility Execution Intelligence Publication 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligencePublicationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligencePublicationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligencePublicationResultの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligencePublicationResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligencePublicationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionIntelligencePublicationResult =
  | Readonly<{
      status: "completed";
      reason: "execution_event_recorded" | "execution_event_already_recorded";
      eventId: string;
      effectState: "settled";
      effectIssued: true;
      effectStateUnknown: false;
      cleanupConfirmed: true;
      retryAllowed: false;
      manualRecoveryRequired: false;
      residualArtifactIds: readonly [];
      recoveryReference: null;
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      effectState: "no_effect" | "settled" | "unknown";
      effectIssued: boolean;
      effectStateUnknown: boolean;
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      manualRecoveryRequired: boolean;
      residualArtifactIds: readonly string[];
      recoveryReference: string | null;
    }>;

/**
 * execution-intelligence-storeで使用するStore Layoutの値契約を定義する。
 *
 * @responsibility Store LayoutのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape StoreLayoutが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoreLayoutで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoreLayoutの宣言は外部境界を開かない。
 * @security N/A: StoreLayoutはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility StoreLayoutの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StoreLayout = Readonly<{
  executionDirectory: string;
  boundaryIdentity: string | null;
  history: string;
  pending: string;
  lock: string;
}>;

/**
 * execution-intelligence-storeで使用するMutation Lockの値契約を定義する。
 *
 * @responsibility Mutation LockのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape MutationLockが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MutationLockで宣言した値と責務の対応を維持する。
 * @boundary N/A: MutationLockの宣言は外部境界を開かない。
 * @security N/A: MutationLockはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility MutationLockの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MutationLock = Readonly<{
  owner: string;
  identity: string;
}>;

/**
 * execution-intelligence-storeで使用するRuntime Data Area Resolverの値契約を定義する。
 *
 * @responsibility Runtime Data Area ResolverのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape RuntimeDataAreaResolverが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDataAreaResolverで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDataAreaResolverの宣言は外部境界を開かない。
 * @security N/A: RuntimeDataAreaResolverはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeDataAreaResolverの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDataAreaResolver = typeof ensureRepositoryRuntimeDataArea;

/**
 * MutationBoundaryErrorが担う状態と操作を提供する。
 *
 * @responsibility MutationBoundaryErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000007
 * @construction MutationBoundaryErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle MutationBoundaryErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: MutationBoundaryErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: MutationBoundaryErrorの宣言自体は実行時失敗を所有しない。
 * @invariant MutationBoundaryErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: MutationBoundaryErrorの宣言は外部境界を開かない。
 * @security N/A: MutationBoundaryErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: MutationBoundaryErrorは共有非同期状態を持たない同期処理である。
 */
class MutationBoundaryError extends Error {
  readonly residualArtifactIds: readonly string[];

  constructor(reason: string, residualArtifactIds: readonly string[]) {
    super(reason);
    this.name = "MutationBoundaryError";
    this.residualArtifactIds = Object.freeze([...residualArtifactIds]);
  }
}

/**
 * sha256を決定する。
 *
 * @responsibility sha256の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input bytes: string | Buffer
 * @returns sha256の計算結果を返す。
 * @precondition 「bytes: string | Buffer」がsha256の入力契約を満たす。
 * @postcondition sha256の責務を完了した結果だけを返す。
 * @effect N/A: sha256は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha256は独自の失敗分岐を所有しない。
 * @invariant sha256は入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: sha256はAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sha256は共有非同期状態を持たない同期処理である。
 */
function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Pathが同一かを判定する。
 *
 * @responsibility Pathの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000007
 * @input left: string、right: string
 * @returns booleanを返す。
 * @precondition 「left: string、right: string」がsamePathの入力契約を満たす。
 * @postcondition samePathの責務を完了した結果だけを返す。
 * @effect samePathは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: samePathは独自の失敗分岐を所有しない。
 * @invariant samePathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: samePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: samePathは共有非同期状態を持たない同期処理である。
 */
function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

/**
 * Directoryを安全条件の下で処理する。
 *
 * @responsibility Directoryの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000007
 * @input directory: string
 * @returns booleanを返す。
 * @precondition 「directory: string」がsafeDirectoryの入力契約を満たす。
 * @postcondition safeDirectoryの責務を完了した結果だけを返す。
 * @effect safeDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: safeDirectoryは独自の失敗分岐を所有しない。
 * @invariant safeDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: safeDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: safeDirectoryは共有非同期状態を持たない同期処理である。
 */
function safeDirectory(directory: string): boolean {
  const metadata = fs.lstatSync(directory);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    samePath(fs.realpathSync.native(directory), path.resolve(directory))
  );
}

/**
 * Directoryが成立する状態を確保する。
 *
 * @responsibility Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000007
 * @input directory: string
 * @returns N/A: ensureDirectoryは戻り値を返さない。
 * @precondition 「directory: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: ensureDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureDirectory(directory: string): void {
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!safeDirectory(directory))
    throw new Error("execution_store_link_or_type_rejected");
}

/**
 * store Layoutを決定する。
 *
 * @responsibility store Layoutの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input rootCapability: VerifiedExecutionRepositoryRoot、shouldCreate: boolean、resolveArea: RuntimeDataAreaResolver
 * @returns StoreLayout | nullを返す。
 * @precondition 「rootCapability: VerifiedExecutionRepositoryRoot、shouldCreate: boolean、resolveArea: RuntimeDataAreaResolver」がstoreLayoutの入力契約を満たす。
 * @postcondition storeLayoutの責務を完了した結果だけを返す。
 * @effect storeLayoutはFilesystemの読取りまたは書込みを実行する。
 * @failure storeLayoutは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant storeLayoutは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: storeLayoutはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: storeLayoutは共有非同期状態を持たない同期処理である。
 */
function storeLayout(
  rootCapability: VerifiedExecutionRepositoryRoot,
  shouldCreate: boolean,
  resolveArea: RuntimeDataAreaResolver = ensureRepositoryRuntimeDataArea,
): StoreLayout | null {
  const repositoryRoot = resolveVerifiedExecutionRepositoryRoot(rootCapability);
  if (repositoryRoot === null)
    throw new Error("execution_store_root_capability_invalid");
  if (!shouldCreate) {
    const area = observeRepositoryRuntimeDataArea(
      rootCapability,
      "execution-intelligence",
    );
    if (area.status === "not_observed") return null;
    if (area.status === "blocked")
      throw new MutationBoundaryError(area.reason, []);
    if (area.repositoryRoot !== repositoryRoot)
      throw new Error("execution_store_root_capability_invalid");
    return Object.freeze({
      executionDirectory: area.directory,
      boundaryIdentity: area.boundaryIdentity,
      history: path.join(area.directory, "history.jsonl"),
      pending: path.join(area.directory, "history.pending.jsonl"),
      lock: path.join(area.directory, "history.lock"),
    });
  }
  let observedArea = resolveArea(
    rootCapability as VerifiedRepositoryRoot,
    "execution-intelligence",
  );
  for (
    let attempt = 0;
    observedArea?.status === "blocked" &&
    observedArea.retryAllowed &&
    attempt < LOCK_ATTEMPTS;
    attempt += 1
  ) {
    Atomics.wait(waitArray, 0, 0, LOCK_RETRY_MS);
    observedArea = resolveArea(
      rootCapability as VerifiedRepositoryRoot,
      "execution-intelligence",
    );
  }
  const area = requireReadyRepositoryRuntimeDataArea(
    observedArea,
    "execution_store_root_capability_invalid",
  );
  if (area.repositoryRoot !== repositoryRoot)
    throw new Error("execution_store_root_capability_invalid");
  const executionDirectory = area.directory;
  for (const directory of [executionDirectory]) {
    if (!entryExists(directory)) {
      if (!shouldCreate) return null;
      ensureDirectory(directory);
    } else if (!safeDirectory(directory))
      throw new Error("execution_store_link_or_type_rejected");
  }
  return Object.freeze({
    executionDirectory,
    boundaryIdentity: null,
    history: path.join(executionDirectory, "history.jsonl"),
    pending: path.join(executionDirectory, "history.pending.jsonl"),
    lock: path.join(executionDirectory, "history.lock"),
  });
}

/**
 * Mutation Lockを取得する。
 *
 * @responsibility Mutation Lockの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000007
 * @input layout: StoreLayout
 * @returns MutationLock | nullを返す。
 * @precondition 「layout: StoreLayout」がacquireMutationLockの入力契約を満たす。
 * @postcondition acquireMutationLockの責務を完了した結果だけを返す。
 * @effect acquireMutationLockはFilesystemの読取りまたは書込みを実行する。
 * @failure acquireMutationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireMutationLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: acquireMutationLockはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Root全体のhistory.lockをwxで排他的に取得し、未所有Lockを自動奪取しない。
 */
function acquireMutationLock(layout: StoreLayout): MutationLock | null {
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    let descriptor: number;
    try {
      descriptor = fs.openSync(layout.lock, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      Atomics.wait(waitArray, 0, 0, LOCK_RETRY_MS);
      continue;
    }
    const identity = randomUUID();
    try {
      try {
        fs.writeFileSync(
          descriptor,
          `${JSON.stringify({
            contract: "crdd/execution-store-lock/v2",
            identity,
          })}\n`,
          "utf8",
        );
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      return Object.freeze({ owner: layout.lock, identity });
    } catch {
      let isCleanupConfirmed = false;
      try {
        fs.unlinkSync(layout.lock);
        isCleanupConfirmed = !entryExists(layout.lock);
      } catch {
        isCleanupConfirmed = false;
      }
      throw new MutationBoundaryError(
        "execution_store_lock_initialization_failed",
        isCleanupConfirmed ? [] : ["history.lock"],
      );
    }
  }
  return null;
}

/**
 * Mutation Lockを解放する。
 *
 * @responsibility Mutation Lockの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000007
 * @input lock: MutationLock
 * @returns booleanを返す。
 * @precondition 「lock: MutationLock」がreleaseMutationLockの入力契約を満たす。
 * @postcondition releaseMutationLockの責務を完了した結果だけを返す。
 * @effect releaseMutationLockはFilesystemの読取りまたは書込みを実行する。
 * @failure releaseMutationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseMutationLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: releaseMutationLockはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency exactな所有Identityが一致するLockだけを解放する。
 */
function releaseMutationLock(lock: MutationLock): boolean {
  try {
    const status = fs.lstatSync(lock.owner);
    if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1)
      return false;
    const parsed = JSON.parse(fs.readFileSync(lock.owner, "utf8")) as {
      identity?: unknown;
      contract?: unknown;
    };
    if (
      parsed.contract !== "crdd/execution-store-lock/v2" ||
      parsed.identity !== lock.identity
    )
      return false;
    fs.unlinkSync(lock.owner);
    return !entryExists(lock.owner);
  } catch {
    return false;
  }
}

/**
 * Publicationを停止結果として構築する。
 *
 * @responsibility Publicationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000007
 * @input reason: string、effectState: "no_effect" | "settled" | "unknown"、cleanupConfirmed: boolean、residualArtifactIds: readonly string[]、retryAllowed、boundary: Readonly<{ effectIssued?: boolean; effectStateUnknown?: boolean; recoveryReference?: string | null; }>
 * @returns ExecutionIntelligencePublicationResultを返す。
 * @precondition 「reason: string、effectState: "no_effect" | "settled" | "unknown"、cleanupConfirmed: boolean、residualArtifactIds: readonly string[]、retryAllowed、boundary: Readonly<{ effectIssued?: boolean; effectStateUnknown?: boolean; recoveryReference?: string | null; }>」がblockedPublicationの入力契約を満たす。
 * @postcondition blockedPublicationの責務を完了した結果だけを返す。
 * @effect N/A: blockedPublicationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedPublicationは独自の失敗分岐を所有しない。
 * @invariant blockedPublicationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: blockedPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedPublicationは共有非同期状態を持たない同期処理である。
 */
function blockedPublication(
  reason: string,
  effectState: "no_effect" | "settled" | "unknown",
  cleanupConfirmed: boolean,
  residualArtifactIds: readonly string[],
  retryAllowed = false,
  boundary: Readonly<{
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    recoveryReference?: string | null;
  }> = {},
): Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }> {
  const isEffectStateUnknown =
    boundary.effectStateUnknown ?? effectState === "unknown";
  const recoveryReference = boundary.recoveryReference ?? null;
  return Object.freeze({
    status: "blocked" as const,
    reason,
    effectState,
    effectIssued: boundary.effectIssued ?? effectState !== "no_effect",
    effectStateUnknown: isEffectStateUnknown,
    cleanupConfirmed,
    retryAllowed,
    manualRecoveryRequired:
      isEffectStateUnknown || !cleanupConfirmed || recoveryReference !== null,
    residualArtifactIds: Object.freeze([...residualArtifactIds]),
    recoveryReference,
  });
}

/**
 * existing Publicationを決定する。
 *
 * @responsibility existing Publicationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input target: string、expected: Buffer、eventId: string
 * @returns ExecutionIntelligencePublicationResultを返す。
 * @precondition 「target: string、expected: Buffer、eventId: string」がexistingPublicationの入力契約を満たす。
 * @postcondition existingPublicationの責務を完了した結果だけを返す。
 * @effect existingPublicationはFilesystemの読取りまたは書込みを実行する。
 * @failure 完成bytes不一致または読取り失敗をthrowし、呼出し側が公開後Effect不明として閉じる。
 * @invariant existingPublicationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: existingPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: existingPublicationは共有非同期状態を持たない同期処理である。
 */
function existingPublication(
  target: string,
  expected: Buffer,
  eventId: string,
): ExecutionIntelligencePublicationResult {
  const existing = fs.readFileSync(target);
  if (!existing.equals(expected))
    throw new Error("execution_store_publication_readback_mismatch");
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_event_already_recorded" as const,
    eventId,
    effectState: "settled" as const,
    effectIssued: true as const,
    effectStateUnknown: false as const,
    cleanupConfirmed: true as const,
    retryAllowed: false as const,
    manualRecoveryRequired: false as const,
    residualArtifactIds: Object.freeze([]) as readonly [],
    recoveryReference: null,
  });
}

/**
 * Execution Intelligence Event With Runtime Data Areaを書き込む。
 *
 * @responsibility Execution Intelligence Event With Runtime Data Areaの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000007
 * @input rootCapability: VerifiedExecutionRepositoryRoot、value: unknown、resolveArea: RuntimeDataAreaResolver
 * @returns ExecutionIntelligencePublicationResultを返す。
 * @precondition 「rootCapability: VerifiedExecutionRepositoryRoot、value: unknown、resolveArea: RuntimeDataAreaResolver」がwriteExecutionIntelligenceEventWithRuntimeDataAreaの入力契約を満たす。
 * @postcondition writeExecutionIntelligenceEventWithRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect writeExecutionIntelligenceEventWithRuntimeDataAreaはFilesystemの読取りまたは書込みを実行する。
 * @failure writeExecutionIntelligenceEventWithRuntimeDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeExecutionIntelligenceEventWithRuntimeDataAreaは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeExecutionIntelligenceEventWithRuntimeDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Root全体のLockで設定取得・読取り・保持整理・原子的公開を直列化する。
 */
export function writeExecutionIntelligenceEventWithRuntimeDataArea(
  rootCapability: VerifiedExecutionRepositoryRoot,
  value: unknown,
  resolveArea: RuntimeDataAreaResolver,
  clock: () => number = Date.now,
): ExecutionIntelligencePublicationResult {
  const event = inspectExecutionIntelligenceEvent(value);
  if (!event)
    return blockedPublication("execution_event_invalid", "no_effect", true, []);
  let layout: StoreLayout | null = null,
    lock: MutationLock | null = null;
  let isPendingOwned = false,
    wasPublicationAttempted = false;
  let expected: Buffer | null = null;
  let result: ExecutionIntelligencePublicationResult | null = null;
  try {
    layout = storeLayout(rootCapability, true, resolveArea);
    if (!layout) throw new Error("execution_store_directory_missing");
    lock = acquireMutationLock(layout);
    if (!lock)
      return blockedPublication(
        "execution_store_lock_unavailable",
        "no_effect",
        false,
        ["history.lock"],
        true,
      );
    if (entryExists(layout.pending))
      throw new MutationBoundaryError("execution_store_pending_unresolved", [
        "history.pending.jsonl",
      ]);
    const now = clock();
    if (!Number.isFinite(now)) throw new Error("execution_store_clock_invalid");
    const settings = readExecutionIntelligenceConfig(rootCapability);
    if (settings.status === "blocked")
      throw new MutationBoundaryError(settings.reason, []);
    const cutoff =
      now - settings.config.historyRetentionDays * 24 * 60 * 60 * 1000;
    const protectedEvent = (entry: ExecutionIntelligenceEvent) =>
      !entry.outcome.cleanupConfirmed ||
      entry.outcome.manualRecoveryRequired ||
      entry.outcome.processRestartRequired ||
      entry.outcome.effectState === "unknown";
    if (Date.parse(event.occurredAt) < cutoff && !protectedEvent(event)) {
      result = blockedPublication(
        "execution_event_retention_expired",
        "no_effect",
        true,
        [],
      );
    } else {
      const history = readFromExecutionDirectory(layout.executionDirectory);
      const existing = history.events.find(
        (entry) => entry.eventId === event.eventId,
      );
      if (existing && JSON.stringify(existing) !== JSON.stringify(event))
        result = blockedPublication(
          "execution_event_identity_conflict",
          "no_effect",
          true,
          [],
        );
      else {
        const retainedEvents = history.events.filter(
          (entry) =>
            Date.parse(entry.occurredAt) >= cutoff || protectedEvent(entry),
        );
        if (!existing) retainedEvents.push(event);
        if (retainedEvents.length > MAXIMUM_EVENTS)
          throw new MutationBoundaryError(
            "execution_store_event_limit_exceeded",
            [],
          );
        expected = Buffer.from(
          retainedEvents.map((entry) => `${JSON.stringify(entry)}\n`).join(""),
          "utf8",
        );
        if (expected.length > MAXIMUM_TOTAL_BYTES)
          throw new MutationBoundaryError(
            "execution_store_byte_limit_exceeded",
            [],
          );
        const descriptor = fs.openSync(layout.pending, "wx", 0o600);
        isPendingOwned = true;
        try {
          fs.writeFileSync(descriptor, expected);
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }
        if (!fs.readFileSync(layout.pending).equals(expected))
          throw new Error("execution_store_pending_readback_mismatch");
        wasPublicationAttempted = true;
        fs.renameSync(layout.pending, layout.history);
        if (entryExists(layout.pending))
          throw new Error("execution_store_publication_incomplete");
        isPendingOwned = false;
        result = existingPublication(layout.history, expected, event.eventId);
        if (result.status === "completed")
          result = Object.freeze({
            ...result,
            reason: existing
              ? ("execution_event_already_recorded" as const)
              : ("execution_event_recorded" as const),
          });
      }
    }
  } catch (error) {
    const failure =
      error instanceof RepositoryRuntimeDataAreaBlockedError ? error : null;
    const effectState: "no_effect" | "settled" | "unknown" =
      wasPublicationAttempted ? "unknown" : "no_effect";
    const residuals =
      error instanceof MutationBoundaryError ? error.residualArtifactIds : [];
    result = blockedPublication(
      failure?.reason ??
        (error instanceof MutationBoundaryError
          ? error.message
          : "execution_event_store_unavailable"),
      failure?.effectStateUnknown
        ? "unknown"
        : failure?.effectIssued
          ? "settled"
          : effectState,
      failure?.cleanupConfirmed ?? (!isPendingOwned && residuals.length === 0),
      [...(isPendingOwned ? ["history.pending.jsonl"] : []), ...residuals],
      failure?.retryAllowed ?? false,
      failure
        ? {
            effectIssued: failure.effectIssued,
            effectStateUnknown: failure.effectStateUnknown,
            recoveryReference: failure.recoveryReference,
          }
        : { recoveryReference: wasPublicationAttempted ? event.eventId : null },
    );
  } finally {
    if (isPendingOwned && layout) {
      try {
        fs.unlinkSync(layout.pending);
        isPendingOwned = entryExists(layout.pending);
      } catch {
        isPendingOwned = true;
      }
    }
    const released = lock === null || releaseMutationLock(lock);
    if (!released || isPendingOwned)
      result = blockedPublication(
        "execution_event_store_cleanup_unknown",
        result?.effectState ?? "unknown",
        false,
        [
          ...(isPendingOwned ? ["history.pending.jsonl"] : []),
          ...(released ? [] : ["history.lock"]),
        ],
        false,
        {
          effectIssued: result?.effectIssued ?? wasPublicationAttempted,
          effectStateUnknown: result?.effectStateUnknown ?? true,
          recoveryReference:
            result?.recoveryReference ??
            (wasPublicationAttempted ? event.eventId : null),
        },
      );
    else if (
      result?.status === "blocked" &&
      result.reason === "execution_event_store_unavailable"
    )
      result = blockedPublication(
        result.reason,
        result.effectState,
        true,
        [],
        false,
        {
          effectIssued: result.effectIssued,
          effectStateUnknown: result.effectStateUnknown,
          recoveryReference: result.recoveryReference,
        },
      );
  }
  return (
    result ??
    blockedPublication(
      "execution_event_store_observation_unknown",
      "unknown",
      false,
      ["history.lock"],
    )
  );
}

/**
 * Execution Intelligence Eventを書き込む。
 *
 * @responsibility Execution Intelligence Eventの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000007
 * @input rootCapability: VerifiedExecutionRepositoryRoot、value: unknown
 * @returns ExecutionIntelligencePublicationResultを返す。
 * @precondition 「rootCapability: VerifiedExecutionRepositoryRoot、value: unknown」がwriteExecutionIntelligenceEventの入力契約を満たす。
 * @postcondition writeExecutionIntelligenceEventの責務を完了した結果だけを返す。
 * @effect Repository-local履歴領域を作成し、history.lockの排他取得、pending書込み、履歴のatomic置換と保持期間整理を実行する。
 * @failure 入力不正、保存・観測・排他・回収の失敗を下位保存Ownerの結果として返し、Effect不明を未発行へ畳まない。
 * @invariant 検証済みRoot内の履歴だけを変更し、同じEvent IDの内容不変と未解決記録の保持を守る。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security 検証済みRootの宣言領域へ書込みを限定し、未所有Lockやpendingを自動回収しない。
 * @concurrency history.lockを排他的に取得し、保存確定と読戻し後に所有Lockの解放結果を確認する。
 */
export function writeExecutionIntelligenceEvent(
  rootCapability: VerifiedExecutionRepositoryRoot,
  value: unknown,
): ExecutionIntelligencePublicationResult {
  return writeExecutionIntelligenceEventWithRuntimeDataArea(
    rootCapability,
    value,
    ensureRepositoryRuntimeDataArea,
  );
}

/**
 * From Execution Directoryを読み取る。
 *
 * @responsibility From Execution Directoryの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000007
 * @input directory: string
 * @returns readFromExecutionDirectoryの計算結果を返す。
 * @precondition 「directory: string」がreadFromExecutionDirectoryの入力契約を満たす。
 * @postcondition readFromExecutionDirectoryの責務を完了した結果だけを返す。
 * @effect readFromExecutionDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure readFromExecutionDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readFromExecutionDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readFromExecutionDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readFromExecutionDirectoryは共有非同期状態を持たない同期処理である。
 */
function readFromExecutionDirectory(directory: string) {
  const history = path.join(directory, "history.jsonl");
  const events: ExecutionIntelligenceEvent[] = [];
  const hashes: Record<string, string> = Object.create(null);
  const allowed = new Set([
    "history.jsonl",
    "history.pending.jsonl",
    "history.lock",
  ]);
  if (fs.readdirSync(directory).some((name) => !allowed.has(name)))
    throw new Error("execution_store_filename_invalid");
  const historyExists = entryExists(history);
  if (historyExists) {
    const status = fs.lstatSync(history);
    if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1)
      throw new Error("execution_store_entry_type_invalid");
    if (status.size > MAXIMUM_TOTAL_BYTES)
      throw new MutationBoundaryError(
        "execution_store_byte_limit_exceeded",
        [],
      );
    const descriptor = fs.openSync(history, "r");
    let bytes: Buffer;
    try {
      const actual = fs.fstatSync(descriptor);
      if (
        !actual.isFile() ||
        actual.nlink !== 1 ||
        actual.size > MAXIMUM_TOTAL_BYTES
      )
        throw new Error("execution_store_entry_type_invalid");
      bytes = Buffer.alloc(actual.size);
      let offset = 0;
      while (offset < bytes.length) {
        const count = fs.readSync(
          descriptor,
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (count === 0) throw new Error("execution_store_read_incomplete");
        offset += count;
      }
    } finally {
      fs.closeSync(descriptor);
    }
    const source = bytes.toString("utf8");
    if (!Buffer.from(source, "utf8").equals(bytes))
      throw new Error("execution_store_encoding_invalid");
    if (source && !source.endsWith("\n"))
      throw new Error("execution_store_incomplete_record");
    for (const line of source ? source.slice(0, -1).split("\n") : []) {
      if (events.length >= MAXIMUM_EVENTS)
        throw new MutationBoundaryError(
          "execution_store_event_limit_exceeded",
          [],
        );
      const event = inspectExecutionIntelligenceEvent(JSON.parse(line));
      if (!event || Object.hasOwn(hashes, event.eventId))
        throw new Error("execution_store_content_invalid");
      events.push(event);
      hashes[event.eventId] = sha256(Buffer.from(`${line}\n`));
    }
  }
  const summary = summarizeExecutionIntelligence(events);
  if (!summary) throw new Error("execution_summary_invalid");
  return Object.freeze({
    status: "completed" as const,
    reason: (historyExists
      ? "execution_events_observed"
      : "execution_events_not_observed") as
      | "execution_events_observed"
      | "execution_events_not_observed",
    observationState: (historyExists ? "observed" : "not_observed") as
      | "observed"
      | "not_observed",
    events: Object.freeze(events),
    hashes: Object.freeze(hashes),
    summary,
    period: null as ExecutionIntelligenceReadOptions["period"] | null,
  });
}

/**
 * Execution Intelligence With Runtime Data Areaを読み取る。
 *
 * @responsibility Execution Intelligence With Runtime Data Areaの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000007
 * @input rootCapability: VerifiedExecutionRepositoryRoot、resolveArea: RuntimeDataAreaResolver
 * @returns | ReturnType<typeof readFromExecutionDirectory> | Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }>を返す。
 * @precondition 「rootCapability: VerifiedExecutionRepositoryRoot、resolveArea: RuntimeDataAreaResolver」がreadExecutionIntelligenceWithRuntimeDataAreaの入力契約を満たす。
 * @postcondition readExecutionIntelligenceWithRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect Filesystemを読み取る。Lock、設定、Directoryの作成・変更Effectは0。
 * @failure readExecutionIntelligenceWithRuntimeDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExecutionIntelligenceWithRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readExecutionIntelligenceWithRuntimeDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Lock／pendingを読取り前後に観測し、原子的に公開した完全なhistory snapshotだけを返す。
 */
export function readExecutionIntelligenceWithRuntimeDataArea(
  rootCapability: VerifiedExecutionRepositoryRoot,
  resolveArea: RuntimeDataAreaResolver,
  options?: ExecutionIntelligenceReadOptions,
):
  | ReturnType<typeof readFromExecutionDirectory>
  | Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }> {
  try {
    let period: { fromInclusive: number; toExclusive: number } | null = null;
    let requestedPeriod: ExecutionIntelligenceReadOptions["period"] | null =
      null;
    if (options !== undefined) {
      const parsed = snapshotPlainRecord(options, new Set(["period"]));
      const range =
        parsed &&
        snapshotPlainRecord(
          parsed.period,
          new Set(["fromInclusive", "toExclusive"]),
        );
      if (
        !range ||
        typeof range.fromInclusive !== "string" ||
        typeof range.toExclusive !== "string"
      )
        return blockedPublication(
          "execution_period_invalid",
          "no_effect",
          true,
          [],
        );
      const fromInclusive = Date.parse(range.fromInclusive),
        toExclusive = Date.parse(range.toExclusive);
      if (
        !Number.isFinite(fromInclusive) ||
        !Number.isFinite(toExclusive) ||
        fromInclusive >= toExclusive
      )
        return blockedPublication(
          "execution_period_invalid",
          "no_effect",
          true,
          [],
        );
      period = { fromInclusive, toExclusive };
      requestedPeriod = Object.freeze({
        fromInclusive: range.fromInclusive,
        toExclusive: range.toExclusive,
      });
    }
    const layout = storeLayout(rootCapability, false, resolveArea);
    if (!layout) {
      const summary = summarizeExecutionIntelligence([]);
      if (!summary) throw new Error("execution_summary_invalid");
      return Object.freeze({
        status: "completed" as const,
        reason: "execution_events_not_observed" as const,
        observationState: "not_observed" as const,
        events: Object.freeze([]),
        hashes: Object.freeze({}),
        summary,
        period: requestedPeriod,
      });
    }
    const unsettled = () =>
      [layout.lock, layout.pending]
        .filter((target) => entryExists(target))
        .map((target) => path.basename(target));
    let residuals = unsettled();
    if (residuals.length)
      return blockedPublication(
        "execution_store_publication_pending",
        "unknown",
        false,
        residuals,
        true,
        { effectIssued: false },
      );
    const result = readFromExecutionDirectory(layout.executionDirectory);
    const finalArea = observeRepositoryRuntimeDataArea(
      rootCapability,
      "execution-intelligence",
    );
    if (
      finalArea.status !== "ready" ||
      finalArea.boundaryIdentity !== layout.boundaryIdentity ||
      finalArea.repositoryRoot !==
        resolveVerifiedExecutionRepositoryRoot(rootCapability)
    )
      return blockedPublication(
        "execution_store_boundary_changed",
        "no_effect",
        true,
        [],
      );
    residuals = unsettled();
    if (residuals.length)
      return blockedPublication(
        "execution_store_publication_pending",
        "unknown",
        false,
        residuals,
        true,
        { effectIssued: false },
      );
    if (!period) return result;
    const events = result.events.filter(
      (event) =>
        Date.parse(event.occurredAt) >= period.fromInclusive &&
        Date.parse(event.occurredAt) < period.toExclusive,
    );
    const summary = summarizeExecutionIntelligence(events);
    if (!summary) throw new Error("execution_summary_invalid");
    const hashes = Object.fromEntries(
      events.map((event) => {
        const hash = result.hashes[event.eventId];
        if (typeof hash !== "string") throw new Error("execution_hash_missing");
        return [event.eventId, hash] as const;
      }),
    );
    return Object.freeze({
      ...result,
      events: Object.freeze(events),
      hashes: Object.freeze(hashes),
      summary,
      period: requestedPeriod,
    });
  } catch (error) {
    return blockedPublication(
      error instanceof MutationBoundaryError
        ? error.message
        : "execution_event_store_observation_failed",
      "no_effect",
      true,
      [],
    );
  }
}

/**
 * Execution Intelligenceを読み取る。
 *
 * @responsibility Execution Intelligenceの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000007
 * @input rootCapability: VerifiedExecutionRepositoryRoot
 * @returns readExecutionIntelligenceの計算結果を返す。
 * @precondition 「rootCapability: VerifiedExecutionRepositoryRoot」がreadExecutionIntelligenceの入力契約を満たす。
 * @postcondition readExecutionIntelligenceの責務を完了した結果だけを返す。
 * @effect Filesystemを読み取る。Lock、設定、Directoryの作成・変更Effectは0。
 * @failure N/A: readExecutionIntelligenceは独自の失敗分岐を所有しない。
 * @invariant readExecutionIntelligenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readExecutionIntelligenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readExecutionIntelligenceは共有非同期状態を持たない同期処理である。
 */
export function readExecutionIntelligence(
  rootCapability: VerifiedExecutionRepositoryRoot,
  options?: ExecutionIntelligenceReadOptions,
) {
  return readExecutionIntelligenceWithRuntimeDataArea(
    rootCapability,
    ensureRepositoryRuntimeDataArea,
    options,
  );
}
