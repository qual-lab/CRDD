/**
 * execution-intelligence-storeに属する責務をまとめる。
 *
 * @responsibility ExecutionIntelligencePublicationResultを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  inspectExecutionIntelligenceEvent,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
} from "../core/execution-intelligence.ts";
import {
  resolveVerifiedExecutionRepositoryRoot,
  type VerifiedExecutionRepositoryRoot,
} from "./verified-repository-root.ts";
import {
  ensureRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-location.ts";

const MAXIMUM_EVENTS = 10_000;
const MAXIMUM_TOTAL_BYTES = 32 * 1024 * 1024;
const LOCK_ATTEMPTS = 200;
const LOCK_RETRY_MS = 10;
const waitArray = new Int32Array(new SharedArrayBuffer(4));

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
  operationDirectory: string | null;
  eventsDirectory: string | null;
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
  directory: string;
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
 * @input rootCapability: VerifiedExecutionRepositoryRoot、shouldCreate: boolean、operationId: string | null、resolveArea: RuntimeDataAreaResolver
 * @returns StoreLayout | nullを返す。
 * @precondition 「rootCapability: VerifiedExecutionRepositoryRoot、shouldCreate: boolean、operationId: string | null、resolveArea: RuntimeDataAreaResolver」がstoreLayoutの入力契約を満たす。
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
  operationId: string | null = null,
  resolveArea: RuntimeDataAreaResolver = ensureRepositoryRuntimeDataArea,
): StoreLayout | null {
  const repositoryRoot = resolveVerifiedExecutionRepositoryRoot(rootCapability);
  if (repositoryRoot === null)
    throw new Error("execution_store_root_capability_invalid");
  let observedArea = resolveArea(
    rootCapability as VerifiedRepositoryRoot,
    "execution",
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
      "execution",
    );
  }
  const area = requireReadyRepositoryRuntimeDataArea(
    observedArea,
    "execution_store_root_capability_invalid",
  );
  if (area.repositoryRoot !== repositoryRoot)
    throw new Error("execution_store_root_capability_invalid");
  const executionDirectory = area.directory;
  const operationDirectory =
    operationId === null ? null : path.join(executionDirectory, operationId);
  const eventsDirectory =
    operationDirectory === null
      ? null
      : path.join(operationDirectory, "events");
  for (const directory of [
    executionDirectory,
    operationDirectory,
    eventsDirectory,
  ].filter((value): value is string => value !== null)) {
    if (!fs.existsSync(directory)) {
      if (!shouldCreate) return null;
      ensureDirectory(directory);
    } else if (!safeDirectory(directory))
      throw new Error("execution_store_link_or_type_rejected");
  }
  return Object.freeze({
    executionDirectory,
    operationDirectory,
    eventsDirectory,
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
 * @concurrency N/A: acquireMutationLockは共有非同期状態を持たない同期処理である。
 */
function acquireMutationLock(layout: StoreLayout): MutationLock | null {
  if (layout.operationDirectory === null)
    throw new Error("execution_store_operation_directory_missing");
  const directory = path.join(layout.operationDirectory, ".mutation-lock");
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      if (!safeDirectory(directory))
        throw new Error("execution_store_lock_boundary_invalid");
      Atomics.wait(waitArray, 0, 0, LOCK_RETRY_MS);
      continue;
    }

    const identity = randomUUID();
    const owner = path.join(directory, "owner.json");
    try {
      const descriptor = fs.openSync(owner, "wx", 0o600);
      try {
        fs.writeFileSync(
          descriptor,
          `${JSON.stringify({ contract: "crdd/execution-store-lock/v1", identity })}\n`,
          "utf8",
        );
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      return Object.freeze({ directory, owner, identity });
    } catch {
      let cleanupConfirmed = false;
      try {
        if (fs.existsSync(owner)) fs.unlinkSync(owner);
        if (fs.existsSync(directory)) fs.rmdirSync(directory);
        cleanupConfirmed = !fs.existsSync(directory);
      } catch {
        cleanupConfirmed = false;
      }
      throw new MutationBoundaryError(
        "execution_store_lock_initialization_failed",
        cleanupConfirmed ? [] : ["execution-store-mutation-lock"],
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
 * @concurrency N/A: releaseMutationLockは共有非同期状態を持たない同期処理である。
 */
function releaseMutationLock(lock: MutationLock): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(lock.owner, "utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { identity?: unknown }).identity !== lock.identity
    )
      return false;
    fs.unlinkSync(lock.owner);
    fs.rmdirSync(lock.directory);
    return !fs.existsSync(lock.directory);
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
): ExecutionIntelligencePublicationResult {
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
 * @failure N/A: existingPublicationは独自の失敗分岐を所有しない。
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
  return existing.equals(expected)
    ? Object.freeze({
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
      })
    : blockedPublication(
        "execution_event_identity_conflict",
        "no_effect",
        true,
        [],
      );
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
 * @concurrency N/A: writeExecutionIntelligenceEventWithRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function writeExecutionIntelligenceEventWithRuntimeDataArea(
  rootCapability: VerifiedExecutionRepositoryRoot,
  value: unknown,
  resolveArea: RuntimeDataAreaResolver,
): ExecutionIntelligencePublicationResult {
  const event = inspectExecutionIntelligenceEvent(value);
  if (!event)
    return blockedPublication("execution_event_invalid", "no_effect", true, []);
  let lock: MutationLock | null = null;
  let temporary: string | null = null;
  let target: string | null = null;
  let expected: Buffer | null = null;
  let result: ExecutionIntelligencePublicationResult | null = null;
  let lockReleased = true;
  try {
    const layout = storeLayout(
      rootCapability,
      true,
      event.identity.operationId,
      resolveArea,
    );
    if (!layout) throw new Error("execution_store_directory_missing");
    if (layout.eventsDirectory === null)
      throw new Error("execution_store_events_directory_missing");
    lock = acquireMutationLock(layout);
    if (!lock)
      return blockedPublication(
        "execution_store_lock_unavailable",
        "no_effect",
        false,
        ["execution-store-mutation-lock"],
        true,
      );
    target = path.join(layout.eventsDirectory, `${event.eventId}.json`);
    expected = Buffer.from(`${JSON.stringify(event)}\n`, "utf8");
    if (fs.existsSync(target))
      result = existingPublication(target, expected, event.eventId);
    else {
      const temporaryIdentity = `execution-pending-${randomUUID()}`;
      temporary = path.join(layout.eventsDirectory, `.${temporaryIdentity}`);
      const descriptor = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, expected);
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      try {
        fs.linkSync(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      result = existingPublication(target, expected, event.eventId);
      fs.unlinkSync(temporary);
      temporary = null;
      if (result.status === "completed")
        result = Object.freeze({
          ...result,
          reason: "execution_event_recorded" as const,
        });
    }
  } catch (error) {
    let effectState: "no_effect" | "settled" | "unknown" = "no_effect";
    if (target !== null && expected !== null) {
      try {
        if (fs.existsSync(target) && fs.readFileSync(target).equals(expected))
          effectState = "settled";
      } catch {
        effectState = "unknown";
      }
    }
    const runtimeDataFailure =
      error instanceof RepositoryRuntimeDataAreaBlockedError ? error : null;
    const boundaryResiduals =
      error instanceof MutationBoundaryError
        ? error.residualArtifactIds
        : Object.freeze([]);
    result = blockedPublication(
      runtimeDataFailure?.reason ??
        (error instanceof MutationBoundaryError
          ? error.message
          : "execution_event_store_unavailable"),
      runtimeDataFailure?.effectStateUnknown
        ? "unknown"
        : runtimeDataFailure?.effectIssued
          ? "settled"
          : effectState,
      runtimeDataFailure?.cleanupConfirmed ??
        (temporary === null && boundaryResiduals.length === 0),
      [
        ...(temporary === null ? [] : [path.basename(temporary)]),
        ...boundaryResiduals,
      ],
      runtimeDataFailure?.retryAllowed ?? false,
      runtimeDataFailure
        ? {
            effectIssued: runtimeDataFailure.effectIssued,
            effectStateUnknown: runtimeDataFailure.effectStateUnknown,
            recoveryReference: runtimeDataFailure.recoveryReference,
          }
        : {},
    );
  } finally {
    if (temporary !== null) {
      try {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        temporary = null;
      } catch {
        // The closed result below preserves the residual identity.
      }
    }
    if (lock !== null) {
      lockReleased = releaseMutationLock(lock);
      if (!lockReleased || temporary !== null)
        result = blockedPublication(
          "execution_event_store_cleanup_unknown",
          result?.effectState ?? "unknown",
          false,
          [
            ...(temporary === null ? [] : [path.basename(temporary)]),
            ...(lockReleased ? [] : ["execution-store-mutation-lock"]),
          ],
        );
    }
  }
  if (
    result?.status === "blocked" &&
    temporary === null &&
    lockReleased &&
    result.reason === "execution_event_store_unavailable"
  )
    result = blockedPublication(result.reason, result.effectState, true, []);
  return (
    result ??
    blockedPublication(
      "execution_event_store_observation_unknown",
      "unknown",
      false,
      ["execution-store-mutation-lock"],
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
 * @effect N/A: writeExecutionIntelligenceEventは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeExecutionIntelligenceEventは独自の失敗分岐を所有しない。
 * @invariant writeExecutionIntelligenceEventは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeExecutionIntelligenceEventはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeExecutionIntelligenceEventは共有非同期状態を持たない同期処理である。
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
  const events: ExecutionIntelligenceEvent[] = [];
  const hashes: Record<string, string> = {};
  let totalBytes = 0;
  for (const operationId of fs.readdirSync(directory).sort()) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(operationId))
      throw new Error("execution_store_operation_directory_invalid");
    const operationDirectory = path.join(directory, operationId);
    if (!safeDirectory(operationDirectory))
      throw new Error("execution_store_operation_directory_invalid");
    const names = fs.readdirSync(operationDirectory).sort();
    if (names.length !== 1 || names[0] !== "events")
      throw new Error("execution_store_operation_shape_invalid");
    const eventsDirectory = path.join(operationDirectory, "events");
    if (!safeDirectory(eventsDirectory))
      throw new Error("execution_store_event_directory_invalid");
    for (const name of fs.readdirSync(eventsDirectory).sort()) {
      if (!/^execution-[0-9a-f]{64}\.json$/u.test(name))
        throw new Error("execution_store_filename_invalid");
      const target = path.join(eventsDirectory, name);
      const status = fs.lstatSync(target);
      if (!status.isFile() || status.isSymbolicLink())
        throw new Error("execution_store_entry_type_invalid");
      totalBytes += status.size;
      if (events.length >= MAXIMUM_EVENTS)
        throw new Error("execution_store_event_limit_exceeded");
      if (totalBytes > MAXIMUM_TOTAL_BYTES)
        throw new Error("execution_store_byte_limit_exceeded");
      const bytes = fs.readFileSync(target);
      const event = inspectExecutionIntelligenceEvent(
        JSON.parse(bytes.toString("utf8")),
      );
      if (
        !event ||
        `${event.eventId}.json` !== name ||
        event.identity.operationId !== operationId
      )
        throw new Error("execution_store_content_invalid");
      events.push(event);
      hashes[event.eventId] = sha256(bytes);
    }
  }
  const summary = summarizeExecutionIntelligence(events);
  if (!summary) throw new Error("execution_summary_invalid");
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_events_observed" as const,
    events: Object.freeze(events),
    hashes: Object.freeze(hashes),
    summary,
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
 * @effect N/A: readExecutionIntelligenceWithRuntimeDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readExecutionIntelligenceWithRuntimeDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExecutionIntelligenceWithRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readExecutionIntelligenceWithRuntimeDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readExecutionIntelligenceWithRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function readExecutionIntelligenceWithRuntimeDataArea(
  rootCapability: VerifiedExecutionRepositoryRoot,
  resolveArea: RuntimeDataAreaResolver,
):
  | ReturnType<typeof readFromExecutionDirectory>
  | Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }> {
  try {
    const layout = storeLayout(rootCapability, false, null, resolveArea);
    if (layout === null) {
      const emptySummary = summarizeExecutionIntelligence([]);
      if (!emptySummary) throw new Error("execution_empty_summary_invalid");
      return Object.freeze({
        status: "completed" as const,
        reason: "execution_events_observed" as const,
        events: Object.freeze([]),
        hashes: Object.freeze({}),
        summary: emptySummary,
      });
    }
    return readFromExecutionDirectory(layout.executionDirectory);
  } catch (error) {
    const runtimeDataFailure =
      error instanceof RepositoryRuntimeDataAreaBlockedError ? error : null;
    return blockedPublication(
      runtimeDataFailure?.reason ?? "execution_event_store_observation_failed",
      runtimeDataFailure?.effectStateUnknown
        ? "unknown"
        : runtimeDataFailure?.effectIssued
          ? "settled"
          : "no_effect",
      runtimeDataFailure?.cleanupConfirmed ?? true,
      [],
      runtimeDataFailure?.retryAllowed ?? false,
      runtimeDataFailure
        ? {
            effectIssued: runtimeDataFailure.effectIssued,
            effectStateUnknown: runtimeDataFailure.effectStateUnknown,
            recoveryReference: runtimeDataFailure.recoveryReference,
          }
        : {},
    ) as Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }>;
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
 * @effect N/A: readExecutionIntelligenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readExecutionIntelligenceは独自の失敗分岐を所有しない。
 * @invariant readExecutionIntelligenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readExecutionIntelligenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readExecutionIntelligenceは共有非同期状態を持たない同期処理である。
 */
export function readExecutionIntelligence(
  rootCapability: VerifiedExecutionRepositoryRoot,
) {
  return readExecutionIntelligenceWithRuntimeDataArea(
    rootCapability,
    ensureRepositoryRuntimeDataArea,
  );
}
