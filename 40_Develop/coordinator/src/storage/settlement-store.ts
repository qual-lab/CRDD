/**
 * Coordinatorの最新現在状態をRepositoryへ保存する。
 * @responsibility 既存のRoot観測・排他・bounded読取りを用いた固定二Fileの保存確定とSnapshot再入場分類を所有する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import { dockerRuntimeRepairDisposalIsSettled } from "../../../docker-isolation/src/index.ts";
import { readCoordinatorConfig } from "../../../domain-model/src/index.ts";
import { observeRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import {
  createCoordinatorRuntimeDataArea,
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  readStableBoundedFileSnapshot,
  type StableFileIdentity,
  sameStableFileIdentity,
} from "../../../domain-model/src/index.ts";
import {
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  borrowRuntimeOwnedDockerTerminalObservations,
  verifyRuntimeOwnedDockerUnissuedNotice,
} from "../execution/provider-observation.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import { acquireRuntimeOwnedCoordinatorStateKernelLock } from "../execution/kernel-lock.ts";
import { isDockerRestartCheckpointSettled } from "../execution/restart-checkpoint.ts";
import { captureOwnedOperationCleanupVerification } from "../execution/operation.ts";
import {
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  borrowRuntimeOwnedCoordinatorStorageRepository,
  borrowRuntimeOwnedCoordinatorSettlementRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
} from "../execution/repository-binding.ts";
import {
  coordinatorConsumerCompletionPolicy,
  classifyCoordinatorSnapshotReentry,
  coordinatorTaskResourcesAreSettled,
  type CoordinatorStateSnapshot,
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  type CoordinatorStateTaskOperation,
  decodeCoordinatorHistoryRows,
  decodeCoordinatorStateSnapshot,
  decodeCoordinatorUnifiedSnapshot,
  projectCoordinatorTaskSnapshot,
  prepareCoordinatorUnifiedTaskSections,
  validateCoordinatorUnifiedTransition,
  COORDINATOR_STATE_SCHEMA,
  type CoordinatorSnapshot,
  validCoordinatorSnapshot,
  encodeCoordinatorStateValue,
  MAX_COORDINATOR_STATE_BYTES,
  prepareCoordinatorHistoryRetention,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorRepairHistorySummary,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateRestartSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  validateCoordinatorStateTransition,
  validateCoordinatorStateRepairSessionTransition,
  validateCoordinatorStateRepairRetentionHandoffTransition,
  validateCoordinatorStateRepairDisposalTransition,
  classifyCoordinatorRepairPublication,
  classifyCoordinatorResourcePublication,
} from "./model.ts";

/**
 * 同じ短期排他を読取りと保存確定で借用する私有Owner。
 * @responsibility 現在Repository結合とKernel保持を一つの実発行値へ結合する。
 * @trace ARCH-000004、ARCH-000008
 * @shape Root、物理結合、生存照合、解放操作。
 * @invariant JSONや同じProperty値からOwnerを再構成しない。
 * @boundary storage内の取得済みOwner借用。Package公開APIではない。
 * @security このOwnerはProvider実行・Docker処置のAuthorityを持たない。
 * @compatibility 既存Kernel primitiveと名前空間を使う。
 */
export type CoordinatorStorageOwner = Readonly<{
  repositoryRoot: string;
  repositoryBinding: string;
  repositoryRootHash: string;
  assertLive: () => boolean;
  release: () => boolean;
}>;

const storageOwners = new WeakMap<
  object,
  Readonly<{
    repository: NonNullable<
      ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
    >;
    lock: NonNullable<
      ReturnType<typeof acquireRuntimeOwnedCoordinatorStateKernelLock>
    >;
  }>
>();

/**
 * 検証済みRootの既存短期Kernel排他を取得する。
 * @responsibility 保存Ownerの実発行、同Root再観測と解放を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory: 選択Repository内の起動位置。
 * @returns 保持中Owner、又はnull。
 * @precondition 呼出し側が短期処理後の解放を所有する。
 * @postcondition Root・Git Identity・Kernel保持を結合し、保存領域を初期化しない。
 * @effect Repository読取りと既存Kernel Lock取得。
 * @failure Root不正・観測不能・競合はnull。解放不明はfalse。
 * @invariant 新しいLock、Registry、永続状態を作らない。
 * @boundary 既存Root検証と保存短期排他。
 * @security 任意HashやCaller supplied handleを受け付けない。
 * @concurrency このOwnerの内部借用ではKernelを再取得しない。
 */
export function acquireCoordinatorStorageOwner(
  workingDirectory: string,
): CoordinatorStorageOwner | null {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  const repository =
    verified.status === "completed"
      ? borrowRuntimeOwnedCoordinatorStorageRepository(verified.capability)
      : null;
  return repository
    ? acquireCoordinatorStorageOwnerForRepository(repository)
    : null;
}

/**
 * 検証済み内部Repository結合へ保存排他を実発行する。
 * @responsibility 通常Reader・Writerと借用Ownerの取得経路を共有する。
 * @trace ARCH-000004、ARCH-000008
 * @input repository: 既存Ownerから取得したRoot・結合・現在照合。
 * @returns 保持中Owner、又はnull。
 * @precondition 外部入力を直接渡さず内部の検証済み借用だけを使う。
 * @postcondition 同じKernel名前空間・取得方法・生存条件を維持する。
 * @effect 既存Kernel排他の取得とRoot読取り。
 * @failure 不正Root、観測不能、競合はnull。
 * @invariant 新しいLock・永続Registry・保存資格を作らない。
 * @boundary 私有Repository結合と短期保存排他。
 * @security このOwnerだけでは候補の書込みを許可しない。
 * @concurrency 取得したOwnerの解放は呼出し側が所有する。
 */
function acquireCoordinatorStorageOwnerForRepository(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  >,
): CoordinatorStorageOwner | null {
  if (!repository) return null;
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock) return null;
  const owner: CoordinatorStorageOwner = Object.freeze({
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
  return owner;
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
function borrowCoordinatorStorageOwner(
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
export function isLiveCoordinatorStorageOwner(
  owner: unknown,
): owner is CoordinatorStorageOwner {
  const binding =
    owner && typeof owner === "object" ? storageOwners.get(owner) : null;
  return (
    !!binding && !!borrowCoordinatorStorageOwner(owner, binding.repository)
  );
}

/**
 * 修復保存の用途を既存更新と後続回収へ限定する。
 * @responsibility 未知用途を通常checkpointへ代用しない。
 * @trace ARCH-000008
 * @shape checkpoint、session_begin、retention_handoff、回収判断と固定三用途。
 * @invariant 用途値から処置Authorityを発行しない。
 * @boundary 私有保存Contextと完全候補検査。
 * @security 任意操作・Pathを含めない。
 * @compatibility 現在の明示用途だけ。
 */
type RepairWritePurpose =
  | "checkpoint"
  | "session_begin"
  | "retention_handoff"
  | "disposal_decision"
  | "disposal_primary"
  | "disposal_failed"
  | "disposal_auxiliary";

/**
 * 修復の保存用途を同じ純粋な候補検査へ明示的に接続する。
 * @responsibility 外側・Kernel内で同じ用途別の完全再導出を行う。
 * @trace ARCH-000008
 * @input before、candidate: 元版と候補、recoveryId: exact参照、purpose: 閉じた保存用途、binding: Repository結合。
 * @returns 用途固有の検査が成立する場合だけtrue。
 * @precondition 保存Ownerと物理元版は呼出し側が再確認する。
 * @postcondition 通常更新へ専用変更をfallbackしない。
 * @effect N/A: メモリ検査だけ。
 * @failure 未知用途・不正候補・用途違いはfalse。
 * @invariant 同値進捗の純粋成立を物理保存完了と同一視しない。
 * @boundary 専用保存入口と既存値モデル。
 * @security 用途も保存値も実資源処置を許可しない。
 * @concurrency 元版CASと排他の保証は既存物理Writerが所有する。
 */
function validateRepairWriteCandidate(
  before: unknown,
  candidate: unknown,
  recoveryId: string,
  purpose: unknown,
  binding: string,
): boolean {
  switch (purpose) {
    case "checkpoint":
      return validateCoordinatorStateTransition(before, candidate, binding);
    case "session_begin":
      return validateCoordinatorStateRepairSessionTransition(
        before,
        candidate,
        recoveryId,
        binding,
      );
    case "retention_handoff":
      return validateCoordinatorStateRepairRetentionHandoffTransition(
        before,
        candidate,
        recoveryId,
        binding,
      );
    case "disposal_decision":
    case "disposal_primary":
    case "disposal_failed":
    case "disposal_auxiliary":
      return validateCoordinatorStateRepairDisposalTransition(
        before,
        candidate,
        recoveryId,
        purpose.slice("disposal_".length),
        binding,
      );
    default:
      return false;
  }
}

/**
 * 新しい認証unknown不存在の生成・変更を一般保存から識別する。
 * @responsibility 保存済み専用値の同値保全と新しい終了辺を区別する。
 * @trace ARCH-000008
 * @input before、after: 復号済み元Snapshotと保存候補。
 * @returns 専用Contextを要する資源差分があればtrue。
 * @precondition 両Snapshotは現在codecで検査済み。
 * @postcondition 操作除去や同値保全を新しい不存在観測に数えない。
 * @effect N/A: 同期値比較だけ。
 * @failure 元操作・元資源欠落は新しい辺として拒否対象にする。
 * @invariant 複合更新でも資源差分の検査を省略しない。
 * @boundary 一般Writerと専用の一回保存Context。
 * @security 保存値・Hashだけから専用保存を許可しない。
 * @concurrency 保存排他の外側と内側で同じ差分を確認する。
 */
function authenticationUnknownAbsenceChanged(
  before: CoordinatorStateSnapshot | null,
  after: CoordinatorStateSnapshot,
): boolean {
  return after.operations.some(
    (operation) =>
      operation.kind === "docker_task" &&
      operation.resources.some((resource) => {
        if (resource.request !== "unknown" || resource.observation !== "absent")
          return false;
        const previous = before?.operations.find(
          (item) =>
            item.kind === "docker_task" &&
            item.recoveryId === operation.recoveryId,
        );
        const priorResource =
          previous?.kind === "docker_task"
            ? previous.resources.find(
                (item) => item.purpose === resource.purpose,
              )
            : null;
        return (
          !priorResource ||
          encodeCoordinatorStateValue(priorResource) !==
            encodeCoordinatorStateValue(resource)
        );
      }),
  );
}

/**
 * 専用観測済みauth不存在候補を同じ現在Writerで一回保存する。
 * @responsibility 元版・候補・保持Ownerを私有Contextへ固定し一般保存の迂回を拒否する。
 * @trace ARCH-000008
 * @input repository、recoveryId、before、observations: 私有回収Ownerの固定値。assertOwner: 同期生存確認。
 * @returns 保存・読戻し・排他解放を個別に示す既存Writer結果。
 * @precondition 外部観測は全長期排他を保持したまま保存排他の外で完了している。
 * @postcondition 未発行・Provider成功・Task全体完了へ変換しない。
 * @effect 同じstate.jsonの専用一版だけ。Docker要求なし。
 * @failure 元版差・別候補・失効・観測欠測・Context再使用は停止する。
 * @invariant 一次失敗・元結果・他操作を保全し新Mapを追加しない。
 * @boundary 私有回収Ownerと既存の短期Writer。
 * @security Package公開入口から任意観測やContextを受け付けない。
 * @concurrency 同期保存中もRootと全長期排他を再照合し、終端でContextを破棄する。
 */
export function writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  before: Buffer,
  observations: unknown,
  assertOwner: () => boolean,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  if (
    !Buffer.isBuffer(before) ||
    typeof assertOwner !== "function" ||
    types.isAsyncFunction(assertOwner)
  )
    return blocked();
  let active = true;
  const context = Object.freeze({});
  try {
    if (assertOwner() !== true || !repository.revalidate()) return blocked();
    const fixedBefore = Buffer.from(before);
    const fixedObservations: unknown = JSON.parse(
      encodeCoordinatorStateValue(observations),
    );
    const candidate = prepareCoordinatorAuthenticationUnknownClosureSnapshot(
      fixedBefore,
      recoveryId,
      fixedObservations,
      repository.repositoryBinding,
    );
    if (!candidate) return blocked();
    const beforeTasks = decodeCoordinatorStateSnapshot(
      fixedBefore,
      repository.repositoryBinding,
    )?.snapshot.operations.filter(
      (item) => item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const candidateTasks = decodeCoordinatorStateSnapshot(
      candidate,
      repository.repositoryBinding,
    )?.snapshot.operations.filter(
      (item) => item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      beforeTasks?.length !== 1 ||
      candidateTasks?.length !== 1 ||
      beforeTasks[0]?.identityJson !== candidateTasks[0]?.identityJson ||
      JSON.parse(beforeTasks[0]?.identityJson ?? "null")?.operationId !==
        repository.operationId ||
      JSON.parse(candidateTasks[0]?.identityJson ?? "null")?.operationId !==
        repository.operationId
    )
      return blocked();
    const binding = {
      kind: "authentication_unknown_closure" as const,
      repository,
      recoveryId,
      before: fixedBefore,
      candidate,
      observations: fixedObservations,
      assertOwner: () =>
        active && assertOwner() === true && repository.revalidate(),
      used: false,
    };
    settlements.set(context, binding);
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: () =>
          active &&
          settlements.get(context) === binding &&
          binding.used &&
          binding.assertOwner(),
      },
      candidate,
      null,
      undefined,
      undefined,
      context,
    );
  } catch {
    return blocked();
  } finally {
    active = false;
    settlements.delete(context);
  }
}

const settlements = new WeakMap<
  object,
  | {
      kind: "authentication_unknown_closure";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
      > & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      observations: unknown;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "runtime_repair";
      purpose: RepairWritePurpose;
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
      > & { operationId: string };
      recoveryId: string;
      before: Buffer | null;
      candidate: Buffer;
      assertOwner: () => boolean;
      used: boolean;
      publication?: Readonly<{
        boundaryIdentity: string;
        files: ReadonlyMap<
          string,
          Readonly<{ bytes: Buffer; identity: StableFileIdentity }>
        >;
      }>;
    }
  | {
      kind: "current_completion";
      operationKind: "docker_task" | "runtime_repair";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
      > & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "current_delivery";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
      > & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "current_history";
      operationKind: "docker_task" | "runtime_repair";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
      > & { operationId: string };
      recoveryId: string;
      before: Buffer;
      candidate: Buffer;
      stage: "checkpoint" | "publish" | "confirmed";
      historyFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      pendingHistoryFile: Readonly<{
        bytes: Buffer;
        identity: StableFileIdentity;
      }> | null;
      retentionDays: number | null;
      assertOwner: () => boolean;
      used: boolean;
    }
  | {
      kind: "live";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorSettlementRepository>
      >;
      recoveryId: string;
      managementCapability: unknown;
      consumer: "coordinator_cli" | "orchestrator" | "workbench";
      completion?: { before: Buffer; candidate: Buffer };
      originalInputs?: { cleanupOutcome: unknown; dockerCompletion: unknown };
      verifyCleanup: NonNullable<
        ReturnType<typeof captureOwnedOperationCleanupVerification>
      >;
    }
>();

/**
 * 元の実行Ownerに結合した終端Contextだけを取得する。
 * @responsibility 保存済み終端の結合を真正な清掃・Controller観測の代用品にしない。
 * @trace ARCH-000008
 * @input context: 内部終端Context。
 * @returns live結合、またはnull。
 * @precondition Contextは既存の私有Mapで管理する。
 * @postcondition 新Process用Contextを元Ownerの入口へ流さない。
 * @effect N/A: 私有Mapの読取りだけ。
 * @failure コピー、不正値、別種Contextはnull。
 * @invariant 保存値から実行Capabilityを復元しない。
 * @boundary Process内の終端結合。
 * @security Contextの内部値を公開しない。
 * @concurrency N/A: 同期のMap読取りだけ。
 */
function readLiveSettlement(context: unknown) {
  const value =
    context && typeof context === "object" ? settlements.get(context) : null;
  return value?.kind === "live" ? value : null;
}

/**
 * 同じ操作Ownerの開始Identityを最新現在状態へ保存する。
 * @responsibility 初回領域の作成と既存版への追加を同じWriterへ接続する。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner、identityJson: Runtimeが生成した固定開始Identity。
 * @returns 保存・読戻し・排他解放の結果と対象の非Authority回復参照。
 * @precondition 呼出し元が同じProvider Home Leaseと初期Hostを確認している。
 * @postcondition 成功結果の前に開始Identityをstate.jsonへ確定する。
 * @effect Repository-local初回領域、state.jsonと既存の短命保存物だけ。
 * @failure 不正Identity、重複、読取り不明、競合、既存領域の新品扱いを拒否する。
 * @invariant 読取り失敗だけから新品を推定せず、保存結果からDocker要求Authorityを発行しない。
 * @boundary Runtimeの開始Ownerから同じRepositoryの現在状態Writer。
 * @security 呼出し元Pathを受けず、他操作のIdentityを保存しない。
 * @concurrency 元版を固定し、更新排他内で再照合する。競合を盲目的に再試行しない。
 */
export function saveRuntimeOwnedCoordinatorOperationStart(
  managementCapability: unknown,
  identityJson: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  let recoveryId: string | null = null;
  if (!repository)
    return Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      recoveryId,
    });
  const initialBytes = prepareCoordinatorStateOperationSnapshot(
    null,
    identityJson,
    repository.repositoryBinding,
  );
  const initialCandidate = initialBytes
    ? decodeCoordinatorStateSnapshot(initialBytes, repository.repositoryBinding)
    : null;
  const initialOperation = initialCandidate?.snapshot.operations[0];
  if (
    !initialBytes ||
    !initialOperation ||
    JSON.parse(initialOperation.identityJson).operationId !==
      repository.operationId
  )
    return Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      recoveryId,
    });
  recoveryId = initialOperation.recoveryId;
  const current = readCoordinatorStateSnapshot(repository, null);
  if (!current.lockReleased)
    return Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      reason: current.reason,
      lockReleased: false,
      recoveryId,
    });
  const candidateBytes = current.value
    ? prepareCoordinatorStateOperationSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(current.value.snapshot)}\n`),
        identityJson,
        repository.repositoryBinding,
      )
    : initialBytes;
  const candidate = candidateBytes
    ? decodeCoordinatorStateSnapshot(
        candidateBytes,
        repository.repositoryBinding,
      )
    : null;
  const added = candidate?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.identityJson === identityJson,
  );
  if (
    !candidateBytes ||
    !added ||
    JSON.parse(added.identityJson).operationId !== repository.operationId
  )
    return Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      recoveryId,
    });
  recoveryId = added.recoveryId;
  let initializationEffectIssued = false;
  if (!current.value) {
    // 新品の証明は既存の排他的領域作成だけが所有する。Readerのblockedは証明ではない。
    const initial = prepareRuntimeOwnedCoordinatorStateInitialization(
      managementCapability,
      candidateBytes,
    );
    initializationEffectIssued = initial.effectIssued;
    if (initial.status !== "prepared")
      return Object.freeze({
        ...writeCoordinatorStateSnapshot(null, null, null, null),
        reason: "coordinator_state_initialization_unconfirmed",
        recoveryId,
        filesystemEffectIssued: initial.effectIssued,
        lockReleased: initial.lockReleased,
      });
  }
  const saved = writeRuntimeOwnedCoordinatorStateSnapshot(
    managementCapability,
    candidateBytes,
  );
  return Object.freeze({
    ...saved,
    filesystemEffectIssued:
      initializationEffectIssued || saved.filesystemEffectIssued,
    recoveryId,
  });
}

/**
 * 清掃前の同じ操作を終端保存だけへ固定する。
 * @responsibility 既存Repository結合と真正清掃結果の照合を保存Contextへ保持する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner、recoveryId: 保存済みexact参照、consumer: 本番組立てが固定する利用側。
 * @returns 内部の終端保存Context、またはnull。
 * @precondition 同じ操作の初回Snapshotを保存済みでHost清掃前である。
 * @postcondition Contextから新操作・Provider起動Authorityを発行しない。
 * @effect 現在Snapshotの短期読取りだけ。
 * @failure Owner・参照・保存読取り不一致はnull。
 * @invariant 旧Capabilityを清掃後に復活させない。
 * @boundary 操作Ownerから同じWriterの終端限定更新。
 * @security Contextは内部WeakMapだけで検証し、任意Pathを受けない。
 * @concurrency 読取り排他を解放してからContextを返す。
 */
export function prepareRuntimeOwnedCoordinatorSettlement(
  managementCapability: unknown,
  recoveryId: unknown,
  consumer: unknown,
) {
  const policy = coordinatorConsumerCompletionPolicy(consumer);
  if (policy === null) return null;
  const repository =
    borrowRuntimeOwnedCoordinatorSettlementRepository(managementCapability);
  const verifyCleanup =
    captureOwnedOperationCleanupVerification(managementCapability);
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  if (
    !repository ||
    !verifyCleanup ||
    !operation ||
    JSON.parse(operation.identityJson).consumer !== consumer ||
    current.status !== "completed" ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return null;
  const context = Object.freeze({});
  settlements.set(context, {
    kind: "live",
    repository,
    verifyCleanup,
    recoveryId: operation.recoveryId,
    managementCapability,
    consumer: consumer as "coordinator_cli" | "orchestrator" | "workbench",
  });
  return context;
}

/**
 * Host清掃後の同じ操作だけを共用Writerで更新する。
 * @responsibility 終端限定差分と真正Host結果の相関を物理保存へ接続する。
 * @trace ARCH-000008
 * @input context: 清掃前Context、candidateBytes: 次Snapshot、cleanupOutcome: 真正Host結果、dockerCompletion: 資源変更時の元の本番Controller結果。
 * @returns 既存Writerと同じ保存・排他・Effect別の結果。
 * @precondition Contextは同じRuntimeが清掃前に取得した。
 * @postcondition 新操作、資源要求、他操作変更と未証明削除を拒否する。
 * @effect 既存Writerの固定Snapshot保存だけ。
 * @failure 偽Context、別結果、差分・Root・元版不一致はblocked。
 * @invariant 清掃不明も保持し、資源変更は同じ本番Controllerの観測と候補導出の両方へ照合する。Host清掃だけからDocker終端を推定しない。
 * @boundary Host終端とRepository-local現在状態。
 * @security Provider起動や一般書込みの入口にはならない。
 * @concurrency 通常更新と同じ短期排他・元版照合を使う。
 */
export function writeRuntimeOwnedCoordinatorSettlement(
  context: unknown,
  candidateBytes: unknown,
  cleanupOutcome: unknown,
  dockerCompletion?: unknown,
) {
  const settlement = readLiveSettlement(context);
  return writeCoordinatorStateSnapshot(
    null,
    settlement?.repository ?? null,
    candidateBytes,
    settlement
      ? {
          ...settlement,
          cleanupStatus: settlement.verifyCleanup(cleanupOutcome),
          dockerTerminal: borrowRuntimeOwnedDockerTerminalObservations(
            dockerCompletion,
            settlement.managementCapability,
            settlement.repository.operationId,
            settlement.recoveryId,
          ),
        }
      : null,
  );
}

const initializations = new WeakMap<
  object,
  {
    repositoryBinding: string;
    boundaryIdentity: string;
    payloadSha256: string;
    publicationIssued: boolean;
  }
>();

/**
 * 真正な終了入力を同じ終了Contextへ固定する。
 * @responsibility 保存失敗後も元HostとController結果を再入場へ結合する。
 * @trace ARCH-000008
 * @input context: 元終了Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果。
 * @returns 同じ真正入力だけtrue。
 * @precondition 清掃前にContextが同じ操作へ結合されている。
 * @postcondition 不正入力は固定せず、固定後は別objectへの差替えを拒否する。
 * @effect 既存私有Context内の元入力保持のみ。
 * @failure Context・真正観測・元入力相関不一致ではfalse。
 * @invariant 保存成功や清掃Authorityをこの結果から推定しない。
 * @boundary 本番終了Ownerと既存終了Context。
 * @security Caller supplied成功値を真正結果として採用しない。
 * @concurrency N/A: 同期照合とProcess内保持のみ。
 */
export function captureRuntimeOwnedCoordinatorSettlementInputs(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
): boolean {
  const settlement = readLiveSettlement(context);
  if (!settlement) return false;
  if (settlement.originalInputs)
    return (
      settlement.originalInputs.cleanupOutcome === cleanupOutcome &&
      settlement.originalInputs.dockerCompletion === dockerCompletion
    );
  const terminal = borrowRuntimeOwnedDockerTerminalObservations(
    dockerCompletion,
    settlement.managementCapability,
    settlement.repository.operationId,
    settlement.recoveryId,
  );
  if (!terminal || !settlement.verifyCleanup(cleanupOutcome)) return false;
  settlement.originalInputs = { cleanupOutcome, dockerCompletion };
  return true;
}

/**
 * 元の実行結果を終了保存と用途別配送へ接続する。
 * @responsibility 清掃・結果・履歴・受理の順序を既存保存Ownerで閉じる。
 * @trace ARCH-000008
 * @input context: 清掃前Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果。
 * @returns 保存確認・累積Filesystem Effect・配送待ちと非Authority結果参照。
 * @precondition 同じ操作の元観測を利用し、実行評価は発生点で保存されている。
 * @postcondition transientは終了整理、durable未受理は配送参照を保持して返す。
 * @effect 既存state.jsonとhistory.jsonlの保存だけ。
 * @failure 元観測欠落、診断差、保存・排他・履歴不明は後続処置を停止する。
 * @invariant ACK待ちを清掃失敗へ戻さず、再入場でProviderを再実行しない。
 * @boundary 元終端Ownerから現在状態・履歴・Consumer受理へ接続する。
 * @security 任意の結果本文・ID・PathやCaller supplied成功booleanを受けない。
 * @concurrency 元版照合を各既存Writerで行い、固定済み要約を再改訂しない。
 */
export function settleRuntimeOwnedCoordinatorResult(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  let filesystemEffectIssued = false;
  /**
   * 後続処置を停止して元の保存失敗と累積Effectを返す。
   * @responsibility 各段階の失敗理由と排他・保存確認を失わず返却する。
   * @trace ARCH-000008
   * @input failure: 元の保存結果。未取得なら既定拒否。
   * @returns 配送未完了の保存結果。
   * @precondition 同じ終了処理内の結果だけを渡す。
   * @postcondition 後続保存を行わず、元の失敗fieldを保持する。
   * @effect N/A: 結果の組立てだけ。
   * @failure N/A: 元の失敗をそのまま搬送する。
   * @invariant 発行済みFilesystem Effectをfalseへ戻さない。
   * @boundary 終了処理と呼出し側の失敗搬送。
   * @security 秘密値や結果本文を追加しない。
   * @concurrency N/A: 同期の結果組立てだけ。
   */
  const refused = (
    failure: Partial<ReturnType<typeof writeCoordinatorStateSnapshot>> = {},
  ) =>
    Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      ...failure,
      filesystemEffectIssued:
        filesystemEffectIssued || failure.filesystemEffectIssued === true,
      recoveryId: settlement?.recoveryId ?? null,
      deliveryPending: false,
      result: null,
    });
  if (!settlement) return refused();
  if (
    !captureRuntimeOwnedCoordinatorSettlementInputs(
      context,
      cleanupOutcome,
      dockerCompletion,
    )
  )
    return refused();
  const terminal = borrowRuntimeOwnedDockerTerminalObservations(
    dockerCompletion,
    settlement.managementCapability,
    settlement.repository.operationId,
    settlement.recoveryId,
  );
  const cleanupStatus = settlement.verifyCleanup(cleanupOutcome);
  if (!terminal || !cleanupStatus) return refused();
  if (settlement.completion) {
    const completed = completeRuntimeOwnedCoordinatorSettlement(
      context,
      cleanupOutcome,
      dockerCompletion,
    );
    return Object.freeze({
      ...completed,
      recoveryId: settlement.recoveryId,
      deliveryPending: false,
      result: null,
    });
  }
  // WeakMap借用が同じ凍結結果を確認してから固定fieldを読む。
  const original = dockerCompletion as Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    cleanupConfirmed: boolean;
  }>;
  const outcome = {
    status: original.status,
    reason: original.reason,
    cleanupConfirmed: original.cleanupConfirmed,
  };
  let current = readRuntimeOwnedCoordinatorSettlementSnapshot(context);
  if (current.status !== "completed" || !current.value)
    return refused({
      reason: current.reason,
      lockReleased: current.lockReleased,
    });
  let operation = current.value.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === settlement.recoveryId,
  );
  if (!operation) return refused();
  if (operation.summarySha256 === null) {
    const before = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const cleanedBytes = prepareCoordinatorStateCleanupSnapshot(
      before,
      settlement.recoveryId,
      terminal.resources,
      settlement.repository.repositoryBinding,
    );
    const cleaned = cleanedBytes
      ? decodeCoordinatorStateSnapshot(
          cleanedBytes,
          settlement.repository.repositoryBinding,
        )
      : null;
    if (!cleaned) return refused();
    const candidate = {
      ...cleaned.snapshot,
      operations: cleaned.snapshot.operations.map((item) =>
        item.kind !== "docker_task" || item.recoveryId !== settlement.recoveryId
          ? item
          : {
              ...item,
              phase: item.phase === "executing" ? "settling" : item.phase,
              host: { ...item.host, cleanup: "confirmed" },
              lease: terminal.homeLeaseReleased ? "released" : item.lease,
              execution: { ...item.execution, ownerEffect: "disabled" },
              primaryFailure: terminal.primaryFailure,
              outcome,
            },
      ),
    };
    const saved = writeRuntimeOwnedCoordinatorSettlement(
      context,
      Buffer.from(`${encodeCoordinatorStateValue(candidate)}\n`),
      cleanupOutcome,
      dockerCompletion,
    );
    filesystemEffectIssued ||= saved.filesystemEffectIssued;
    if (saved.status !== "completed" || !saved.lockReleased)
      return Object.freeze({
        ...saved,
        filesystemEffectIssued,
        recoveryId: settlement.recoveryId,
        deliveryPending: false,
        result: null,
      });
  } else {
    const observed = prepareCoordinatorStateCleanupSnapshot(
      Buffer.from(`${encodeCoordinatorStateValue(current.value.snapshot)}\n`),
      settlement.recoveryId,
      terminal.resources,
      settlement.repository.repositoryBinding,
    );
    const observedOperation = observed
      ? decodeCoordinatorStateSnapshot(
          observed,
          settlement.repository.repositoryBinding,
        )?.snapshot.operations.find(
          (item): item is CoordinatorStateTaskOperation =>
            item.kind === "docker_task" &&
            item.recoveryId === settlement.recoveryId,
        )
      : null;
    if (
      !observedOperation ||
      observedOperation.resources.some((resource, index) => {
        const previous = operation?.resources[index];
        return (
          !previous ||
          resource.request !== previous.request ||
          resource.dockerId !== previous.dockerId ||
          resource.observation !== previous.observation
        );
      }) ||
      encodeCoordinatorStateValue(operation.primaryFailure) !==
        encodeCoordinatorStateValue(terminal.primaryFailure) ||
      encodeCoordinatorStateValue(operation.outcome) !==
        encodeCoordinatorStateValue(outcome) ||
      operation.host.cleanup !== "confirmed" ||
      operation.lease !== "released" ||
      !terminal.homeLeaseReleased ||
      !terminal.mountLeaseReleased ||
      !terminal.recoveryCompleted ||
      operation.execution.ownerEffect !== "disabled"
    )
      return refused();
  }
  current = readRuntimeOwnedCoordinatorSettlementSnapshot(context);
  operation = current.value?.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === settlement.recoveryId,
  );
  if (current.status !== "completed" || !operation)
    return refused({
      reason: current.reason,
      lockReleased: current.lockReleased,
    });
  if (!operation.history) {
    const fixed = writeRuntimeOwnedCoordinatorHistoryCheckpoint(
      context,
      cleanupOutcome,
      dockerCompletion,
    );
    filesystemEffectIssued ||= fixed.filesystemEffectIssued;
    if (fixed.status !== "completed" || !fixed.lockReleased)
      return refused(fixed);
  }
  if (!operation.history?.confirmed) {
    const published = publishRuntimeOwnedCoordinatorHistory(
      context,
      cleanupOutcome,
      dockerCompletion,
    );
    filesystemEffectIssued ||= published.filesystemEffectIssued;
    if (published.status !== "completed" || !published.lockReleased)
      return refused(published);
  }
  const isDurable =
    coordinatorConsumerCompletionPolicy(settlement.consumer) === "durable";
  const registered = registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
    context,
    cleanupOutcome,
    dockerCompletion,
    isDurable ? ["orchestrator"] : [],
  );
  filesystemEffectIssued ||= registered.filesystemEffectIssued;
  if (registered.status !== "completed" || !registered.lockReleased)
    return refused(registered);
  if (isDurable) {
    const result = readRuntimeOwnedCoordinatorSettlementResult(
      context,
      "orchestrator",
    );
    if (result.status !== "completed" || !result.lockReleased)
      return refused({
        reason: result.reason,
        lockReleased: result.lockReleased,
      });
    // 上位がまだ結果を受領していない段階でACKを要求しない。
    return Object.freeze({
      ...registered,
      filesystemEffectIssued,
      recoveryId: settlement.recoveryId,
      deliveryPending: true,
      result: result.value,
    });
  }
  const completed = completeRuntimeOwnedCoordinatorSettlement(
    context,
    cleanupOutcome,
    dockerCompletion,
  );
  return Object.freeze({
    ...completed,
    filesystemEffectIssued:
      filesystemEffectIssued || completed.filesystemEffectIssued,
    recoveryId: settlement.recoveryId,
    deliveryPending: false,
    result: null,
  });
}

/**
 * 同じ回収Ownerから、現在終端の履歴を一段だけ保存する。
 * @responsibility stage・時刻・候補を保存材料から導出し、既存Writerへ短命Contextを結合する。
 * @trace ARCH-000008
 * @input repository、recoveryId: 固定対象。assertOwner: 同じ解放済み回収Ownerの同期確認。
 * @returns 保存・読戻し・排他終了と履歴確認状態を分けた結果。
 * @precondition 元OwnerのEffect無効、資源・Host清掃と全外側排他解放が確認済み。
 * @postcondition 一段完了後の再Readerを要求し、旧実行Capabilityを復元しない。
 * @effect 固定state／historyとその短命Fileだけを既存Writerで保存する。
 * @failure Owner失効、元版差、交差候補、履歴・設定差、観測不能は停止する。
 * @invariant 履歴確認をTask成功・配送・受領ACKへ昇格しない。
 * @boundary 現在回収OwnerとRepository-local履歴出版。
 * @security 任意Path・stage・consumer・時刻をCallerから受け取らない。
 * @concurrency 既存短期排他と各I/O前後の同Owner確認を使用する。
 */
export function advanceRuntimeOwnedCoordinatorRecoveryHistory(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
) {
  return advanceCoordinatorCurrentHistory(
    repository,
    recoveryId,
    assertOwner,
    "docker_task",
  );
}

/**
 * 同じ修復保存Ownerから修復履歴だけを一段確定する。
 * @responsibility 修復種別を固定し、Task配送へ代替しない既存履歴Writerを使う。
 * @trace ARCH-000008
 * @input repository、recoveryId、assertOwner: 現在のexact修復保存Owner。
 * @returns 保存・排他解放・履歴確認を分けた結果。
 * @precondition Rootと改訂版が現在も有効で修復の技術処置が終了している。
 * @postcondition 履歴確認から実行許可や保持物の削除許可を生成しない。
 * @effect Repository内の既存state／historyと短命保存物だけ。
 * @failure 不一致・観測不能・Owner失効時は後続保存しない。
 * @invariant Taskの配送・ACKへfallbackしない。
 * @boundary 修復の保存Ownerと既存Kernel排他。
 * @security JSONだけからOwner資格を復元しない。
 * @concurrency 同じOwnerの各I/O前後確認と既存単一Writerを使う。
 */
export function advanceRuntimeOwnedCoordinatorRepairHistory(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
) {
  return advanceCoordinatorCurrentHistory(
    repository,
    recoveryId,
    assertOwner,
    "runtime_repair",
  );
}

/**
 * 固定された種別の履歴保存を既存の短命Contextへ結合する。
 * @responsibility 種別・exact操作・現在OwnerをReaderとWriterの間で保持する。
 * @trace ARCH-000008
 * @input repository、recoveryId、assertOwner、operationKind: Package内部の固定入口。
 * @returns 一段の保存結果。
 * @precondition 公開Wrapperが種別を固定する。
 * @postcondition Contextは呼出し終了時に失効する。
 * @effect 既存のRepository-local保存だけ。
 * @failure Reader・保存・排他解放不明は停止する。
 * @invariant RepairはTask配送へ移行しない。
 * @boundary Package内部の履歴保存。
 * @security 任意の保存Path・候補・時刻を受け取らない。
 * @concurrency 既存Kernel排他と単一Writerを用いる。
 */
function advanceCoordinatorCurrentHistory(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
  operationKind: "docker_task" | "runtime_repair",
) {
  const refused = () =>
    Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      historyConfirmed: false,
    });
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused();
    const observed = readCoordinatorStateSnapshot(
      repository,
      recoveryId,
      null,
      recoveryId,
      null,
      null,
      operationKind,
    );
    if (
      operationKind === "docker_task" &&
      observed.status !== "completed" &&
      observed.lockReleased
    ) {
      const delivery = readCoordinatorStateSnapshot(
        repository,
        recoveryId,
        null,
        null,
        recoveryId,
      );
      if (
        delivery.status === "completed" &&
        delivery.value &&
        delivery.lockReleased &&
        delivery.currentDeliveryPublication &&
        assertOwner() === true
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_snapshot_confirmed",
          revision: delivery.value.snapshot.revision,
          payloadSha256: delivery.value.payloadSha256,
          snapshotConfirmed: true,
          lockReleased: true,
          filesystemEffectIssued: false,
          historyConfirmed: true,
        });
      return Object.freeze({
        ...refused(),
        reason: delivery.reason,
        lockReleased: delivery.lockReleased,
      });
    }
    const publication = observed.currentHistoryPublication;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      !publication ||
      assertOwner() !== true
    )
      return Object.freeze({
        ...refused(),
        reason: observed.reason,
        lockReleased: observed.lockReleased,
      });
    if (!publication.needsWrite)
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_snapshot_confirmed",
        revision: observed.value.snapshot.revision,
        payloadSha256: observed.value.payloadSha256,
        snapshotConfirmed: true,
        lockReleased: true,
        filesystemEffectIssued: false,
        historyConfirmed: true,
      });
    const context = Object.freeze({});
    let active = true;
    const binding = {
      kind: "current_history" as const,
      operationKind: publication.operationKind,
      repository,
      recoveryId,
      before: Buffer.from(publication.before),
      candidate: Buffer.from(publication.candidate),
      stage: publication.stage,
      historyFile:
        publication.historyFile === null
          ? null
          : {
              bytes: Buffer.from(publication.historyFile.bytes),
              identity: publication.historyFile.identity,
            },
      pendingHistoryFile:
        publication.pendingHistoryFile === null
          ? null
          : {
              bytes: Buffer.from(publication.pendingHistoryFile.bytes),
              identity: publication.pendingHistoryFile.identity,
            },
      retentionDays: publication.retentionDays,
      used: false,
      assertOwner: () =>
        active &&
        settlements.get(context) === binding &&
        binding.used &&
        assertOwner() === true &&
        repository.revalidate(),
    };
    settlements.set(context, binding);
    try {
      const saved = writeCoordinatorStateSnapshot(
        null,
        { ...repository, revalidate: binding.assertOwner },
        binding.candidate,
        {
          recoveryId,
          cleanupStatus: null,
          dockerTerminal: null,
          currentHistory: context,
        },
      );
      return Object.freeze({
        ...saved,
        historyConfirmed:
          saved.status === "completed" && binding.stage !== "checkpoint",
      });
    } finally {
      active = false;
      settlements.delete(context);
    }
  } catch {
    return refused();
  }
}

/**
 * 保存済み利用形態から必要な耐久配送だけを登録する。
 * @responsibility 現在回収Ownerとexact登録候補を既存Writerへ短命に結合する。
 * @trace ARCH-000008
 * @input repository、recoveryId: 固定回収対象。assertOwner: 同じ解放済みOwnerの同期確認。
 * @returns 保存確認、排他解放、EffectとCoordinator配送待ちを分けた結果。
 * @precondition 資源・Host終端と履歴確認済みで旧OwnerのEffectは無効。
 * @postcondition CLI／Workbenchの操作は除去せず、耐久ACKを合成しない。
 * @effect 同じstate.jsonと既存短命保存物だけ。履歴の更新は行わない。
 * @failure 元版・候補・履歴実体・Owner不一致は後続保存を停止する。
 * @invariant 必要な利用側は保存Identityだけから導出する。
 * @boundary 現在回収と結果配送のRepository-local保存。
 * @security Callerから利用側、結果本文、Path、受領Hashを受け取らない。
 * @concurrency 同じ短期Kernel排他と各I/O前のOwner確認を使う。
 */
export function registerRuntimeOwnedCoordinatorRecoveryResultDelivery(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  assertOwner: () => boolean,
) {
  const refused = Object.freeze({
    ...writeCoordinatorStateSnapshot(null, null, null, null),
    deliveryPending: false,
  });
  let context: object | null = null;
  let active = true;
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused;
    const observed = readCoordinatorStateSnapshot(
      repository,
      recoveryId,
      null,
      null,
      recoveryId,
    );
    const publication = observed.currentDeliveryPublication;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      !publication ||
      assertOwner() !== true
    )
      return Object.freeze({
        ...refused,
        reason: observed.reason,
        lockReleased: observed.lockReleased,
      });
    if (!publication.needsWrite)
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_snapshot_confirmed",
        revision: observed.value.snapshot.revision,
        payloadSha256: observed.value.payloadSha256,
        snapshotConfirmed: true,
        lockReleased: true,
        filesystemEffectIssued: false,
        deliveryPending: publication.deliveryPending,
      });
    context = Object.freeze({});
    const key = context;
    const binding = {
      kind: "current_delivery" as const,
      repository,
      recoveryId,
      before: Buffer.from(publication.before),
      candidate: Buffer.from(publication.candidate),
      historyFile:
        publication.historyFile === null
          ? null
          : {
              bytes: Buffer.from(publication.historyFile.bytes),
              identity: publication.historyFile.identity,
            },
      assertOwner: () =>
        active &&
        settlements.get(key) === binding &&
        binding.used &&
        assertOwner() === true &&
        repository.revalidate(),
      used: false,
    };
    settlements.set(key, binding);
    const saved = writeCoordinatorStateSnapshot(
      null,
      { ...repository, revalidate: binding.assertOwner },
      binding.candidate,
      {
        recoveryId,
        cleanupStatus: null,
        dockerTerminal: null,
        currentDelivery: key,
      },
    );
    return Object.freeze({
      ...saved,
      deliveryPending:
        saved.status === "completed" &&
        saved.snapshotConfirmed &&
        saved.lockReleased &&
        publication.deliveryPending,
    });
  } catch {
    return refused;
  } finally {
    active = false;
    if (context) settlements.delete(context);
  }
}

const historyAttempts = new WeakMap<
  object,
  Map<
    string,
    {
      lineSha256: string;
      issued: boolean;
      pending: null | {
        before: Buffer;
        after: Buffer;
        beforeIdentity: StableFileIdentity | null;
        stateCandidate: Buffer;
        retentionDays: number;
        now: string;
      };
    }
  >
>();

/**
 * 真正な正常終端へ結合した履歴の未確定checkpointだけを保存する。
 * @responsibility 要約・初回時刻の固定を同じ操作の実終端根拠へ接続する。
 * @trace ARCH-000008
 * @input context: 清掃前Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果。
 * @returns Snapshot保存と排他終了の結果。履歴行の保存完了は表さない。
 * @precondition 正常終端の五資源、Host、HomeLease、Mount、回復を実確認している。
 * @postcondition 対象一件の未確認要約だけを固定し、時刻を再試行で更新しない。
 * @effect 既存Writerによるstate.jsonの限定更新だけ。
 * @failure 偽Context、根拠不足、元版競合、既確認checkpointは保存前に拒否する。
 * @invariant unknown Createを固定せず、confirmed trueや操作除去を許可しない。
 * @boundary 正常終端Ownerと終了履歴の保存前相関。
 * @security 任意の要約本文、時刻、Pathを入力として受けない。
 * @concurrency 読取り排他を解放し、更新排他内で候補を再導出する。
 */
export function writeRuntimeOwnedCoordinatorHistoryCheckpoint(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  const dockerTerminal = settlement
    ? borrowRuntimeOwnedDockerTerminalObservations(
        dockerCompletion,
        settlement.managementCapability,
        settlement.repository.operationId,
        settlement.recoveryId,
      )
    : null;
  const cleanupStatus = settlement?.verifyCleanup(cleanupOutcome) ?? null;
  if (
    !settlement ||
    !cleanupStatus ||
    !dockerTerminal?.homeLeaseReleased ||
    !dockerTerminal.mountLeaseReleased ||
    !dockerTerminal.recoveryCompleted
  )
    return writeCoordinatorStateSnapshot(null, null, null, null);
  const current = readCoordinatorStateSnapshot(
    settlement.repository,
    settlement.recoveryId,
  );
  const operation = current.value?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" &&
      value.recoveryId === settlement.recoveryId,
  );
  const candidate =
    current.value && operation
      ? prepareCoordinatorStateHistorySnapshot(
          Buffer.from(
            `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
          ),
          settlement.recoveryId,
          operation.history?.occurredAt ?? new Date().toISOString(),
          false,
          settlement.repository.repositoryBinding,
        )
      : null;
  return writeCoordinatorStateSnapshot(null, settlement.repository, candidate, {
    ...settlement,
    cleanupStatus,
    dockerTerminal,
    historyInitial: true,
  });
}

/**
 * 真正終端Ownerから固定結果と必要搬送先を現在状態へ登録する。
 *
 * @responsibility 終端要約Hashだけを結果IDに使い、清掃後も同じ操作の結果を搬送可能にする。
 * @trace ARCH-000008
 * @input context: 清掃前Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果、consumers: 必要搬送先。
 * @returns 保存・排他解放・Effect別の結果。
 * @precondition 同じ実Host清掃・五資源・HomeLease・Mountの終端と要約固定を確認済みである。
 * @postcondition 実終端との共同照合後にだけ未受理結果を登録する。
 * @effect 既存Writerのstate.json更新と短命state.lockの作成・回収。再登録ではstate.jsonを変更しない。
 * @failure 偽Context・コピー結果、未終端・未固定、空集合・別結果・改訂競合は拒否する。
 * @invariant 同じ登録の再入場で結果ID・必要集合・受理状態を変更しない。
 * @boundary 清掃後の本番結果OwnerとRepository-local現在状態。
 * @security 任意結果ID・本文・Path・受理Hashを受け付けない。
 * @concurrency 短期読取り後、更新排他内で同じ候補を再導出し真正終端を照合する。
 */
export function registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
  consumers: unknown,
) {
  const settlement = readLiveSettlement(context);
  const dockerTerminal = settlement
    ? borrowRuntimeOwnedDockerTerminalObservations(
        dockerCompletion,
        settlement.managementCapability,
        settlement.repository.operationId,
        settlement.recoveryId,
      )
    : null;
  const cleanupStatus = settlement?.verifyCleanup(cleanupOutcome) ?? null;
  if (
    !settlement ||
    !cleanupStatus ||
    !dockerTerminal?.homeLeaseReleased ||
    !dockerTerminal.mountLeaseReleased ||
    !dockerTerminal.recoveryCompleted
  )
    return writeCoordinatorStateSnapshot(null, null, null, null);
  const current = readCoordinatorStateSnapshot(
    settlement.repository,
    settlement.recoveryId,
  );
  if (current.status !== "completed" || !current.value)
    return Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      reason: current.reason,
      lockReleased: current.lockReleased,
    });
  const candidate = prepareCoordinatorStateResultDeliverySnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(current.value.snapshot)}\n`),
    settlement.recoveryId,
    consumers,
    settlement.repository.repositoryBinding,
  );
  return writeCoordinatorStateSnapshot(null, settlement.repository, candidate, {
    ...settlement,
    cleanupStatus,
    dockerTerminal,
    deliveryRegistration: consumers,
  });
}

/**
 * 耐久受理と履歴確認を終えた同じ操作だけを現在状態から整理する。
 * @responsibility 真正終端・固定上位受理・履歴相関を更新排他内で再確認する。
 * @trace ARCH-000008
 * @input context: 元終端Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果。
 * @returns 保存・排他解放・Filesystem処置を分離した結果。
 * @precondition 必要搬送の受理と終了要約の保存確認が完了している。
 * @postcondition 対象一操作と同じ回復・搬送参照だけを除去する。
 * @effect 既存state.json・短命保存Fileの更新と履歴読取り。
 * @failure 未接続Consumer、未受理、根拠消失、元版競合と観測不能では保存物を保持する。
 * @invariant 一般Writerの除去拒否を緩和せず、不存在だけから成功を作らない。
 * @boundary 上位耐久受理・下位終端・現在状態・通常履歴。
 * @security 任意本文・削除対象・Path・Hashを入力で受け付けない。
 * @concurrency 共用Writerの同じ短期排他を使い、新Lockや恒久回復Fileを追加しない。
 */
export function completeRuntimeOwnedCoordinatorSettlement(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  const dockerTerminal = settlement
    ? borrowRuntimeOwnedDockerTerminalObservations(
        dockerCompletion,
        settlement.managementCapability,
        settlement.repository.operationId,
        settlement.recoveryId,
      )
    : null;
  const cleanupStatus = settlement?.verifyCleanup(cleanupOutcome) ?? null;
  if (
    !settlement ||
    coordinatorConsumerCompletionPolicy(settlement.consumer) !== "transient" ||
    !cleanupStatus ||
    !dockerTerminal?.homeLeaseReleased ||
    !dockerTerminal.mountLeaseReleased ||
    !dockerTerminal.recoveryCompleted
  )
    return writeCoordinatorStateSnapshot(null, null, null, null);
  let completion = settlement.completion;
  if (!completion) {
    const current = readCoordinatorStateSnapshot(
      settlement.repository,
      settlement.recoveryId,
    );
    if (current.status !== "completed" || !current.value)
      return Object.freeze({
        ...writeCoordinatorStateSnapshot(null, null, null, null),
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    const before = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const candidate = prepareCoordinatorStateCompletionSnapshot(
      before,
      settlement.recoveryId,
      settlement.repository.repositoryBinding,
    );
    if (!candidate)
      return writeCoordinatorStateSnapshot(null, null, null, null);
    completion = { before, candidate };
  }
  const previous = decodeCoordinatorStateSnapshot(
    completion.before,
    settlement.repository.repositoryBinding,
  )?.snapshot.operations.find(
    (operation): operation is CoordinatorStateTaskOperation =>
      operation.kind === "docker_task" &&
      operation.recoveryId === settlement.recoveryId,
  );
  if (
    !previous ||
    JSON.parse(previous.identityJson).consumer !== settlement.consumer
  )
    return writeCoordinatorStateSnapshot(null, null, null, null);
  const saved = writeCoordinatorStateSnapshot(
    null,
    settlement.repository,
    completion.candidate,
    {
      ...settlement,
      cleanupStatus,
      dockerTerminal,
      completion,
    },
  );
  if (saved.filesystemEffectIssued) settlement.completion = completion;
  return saved;
}

/**
 * 固定済みの終了要約を履歴へ保存し、読戻し後にだけ確認済みにする。
 * @responsibility 実終端相関と履歴・Snapshotの確定順序を既存Writerへ接続する。
 * @trace ARCH-000008
 * @input context: 清掃前Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果。
 * @returns Snapshot保存・排他解放・Effectの結果。
 * @precondition 同じ操作の未確認要約を固定済みである。
 * @postcondition 固定時刻を維持し、操作・搬送参照を除去しない。
 * @effect 固定history.jsonlとstate.jsonの短命File経由の保存だけ。
 * @failure 根拠不足、未固定、初回追加根拠喪失、本文・版・設定競合はblocked。
 * @invariant 不明を成功へ変更せず、既存行欠落を未保存と推定しない。
 * @boundary 終端Ownerと現在状態・終了履歴。
 * @security 任意Path・本文・判定時刻をCallerから受けない。
 * @concurrency 更新排他内で全本文を照合し、公開Writerを再帰呼出ししない。
 */
export function publishRuntimeOwnedCoordinatorHistory(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  const terminal = settlement
    ? borrowRuntimeOwnedDockerTerminalObservations(
        dockerCompletion,
        settlement.managementCapability,
        settlement.repository.operationId,
        settlement.recoveryId,
      )
    : null;
  const cleanupStatus = settlement?.verifyCleanup(cleanupOutcome) ?? null;
  if (
    !settlement ||
    !cleanupStatus ||
    !terminal?.homeLeaseReleased ||
    !terminal.mountLeaseReleased ||
    !terminal.recoveryCompleted
  )
    return writeCoordinatorStateSnapshot(null, null, null, null);
  const current = readCoordinatorStateSnapshot(
    settlement.repository,
    settlement.recoveryId,
  );
  const operation = current.value?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" &&
      value.recoveryId === settlement.recoveryId,
  );
  if (
    current.value &&
    operation?.history?.confirmed &&
    ![
      ...current.value.snapshot.pendingDeliveries,
      ...current.value.snapshot.unresolvedRecoveries,
    ].some((item) => item.recoveryId === settlement.recoveryId)
  )
    return writeRuntimeOwnedCoordinatorSettlement(
      context,
      Buffer.from(`${encodeCoordinatorStateValue(current.value.snapshot)}\n`),
      cleanupOutcome,
      dockerCompletion,
    );
  const owner = settlement.managementCapability;
  const resume =
    owner && typeof owner === "object"
      ? historyAttempts.get(owner)?.get(settlement.recoveryId)?.pending
          ?.stateCandidate
      : null;
  const candidate =
    current.value && operation?.history
      ? operation.history.confirmed
        ? Buffer.from(
            `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
          )
        : prepareCoordinatorStateHistorySnapshot(
            Buffer.from(
              `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
            ),
            settlement.recoveryId,
            operation.history.occurredAt,
            true,
            settlement.repository.repositoryBinding,
          )
      : (resume ?? null);
  return writeCoordinatorStateSnapshot(null, settlement.repository, candidate, {
    ...settlement,
    cleanupStatus,
    dockerTerminal: terminal,
    historyPublish: true,
  });
}

/**
 * 保存確定済みの最新Snapshotを現在の操作Ownerへ返す。
 * @responsibility 保存途中・不存在・観測不能を成功へ畳まず、版と本文Hashを取得する。
 * @trace ARCH-000008
 * @input managementCapability: 検証済みRepositoryへ結合した現在操作Owner。
 * @returns 確認済みSnapshotと本文Hash、または値を持たないblocked結果。
 * @precondition Repository操作Ownerが有効である。
 * @postcondition 排他解放と読取り確認の両方が成立した場合だけ値を返す。
 * @effect 固定領域・Fileの読取りと短期OS排他だけ。保存物を作成・修復しない。
 * @failure Root不一致、保存途中、本文不正、解放不明は停止する。
 * @invariant 不在を新品状態と解釈せず、読取りからRecovery完了を推定しない。
 * @boundary Repository-local現在状態と操作Owner。
 * @security 呼出し元Pathや旧形式から保存先を選ばない。
 * @concurrency Writerと同じ短期排他下で取得し、上位待機へLockを搬送しない。
 */
export function readRuntimeOwnedCoordinatorStateSnapshot(
  managementCapability: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  return readCoordinatorStateSnapshot(repository, null);
}

/**
 * 新Processの検証済みRootから現在状態を読み取る。
 * @responsibility 管理Ownerを復元せず通常と同じ読取り・排他契約を使用する。
 * @trace ARCH-000008
 * @input rootCapability: 呼出し組立てが固定した検証済みRepository Root。
 * @returns 内部Snapshot、または値なしblocked。
 * @precondition 公開投影と実資源処置は別の既存Ownerが所有する。
 * @postcondition pending・欠落・不正・解放不明を空状態へ変更しない。
 * @effect 固定現在状態の読取りと既存短期排他だけ。
 * @failure Rootまたは保存結合の不一致と観測不能はblocked。
 * @invariant 旧AppDataへfallbackせず、読取りから回復完了を推定しない。
 * @boundary 新ProcessのRepository Rootと現在状態Reader。
 * @security Snapshotをそのまま外部公開せず、書込みAuthorityを生成しない。
 * @concurrency 通常Writerと同じLockを取得・解放する。
 */
export function readRuntimeOwnedCoordinatorRecoverySnapshot(
  rootCapability: unknown,
) {
  return readCoordinatorStateSnapshot(
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability),
    null,
  );
}

/**
 * exact資源Receiptの保存中断だけを新Processから読み取る。
 * @responsibility 通常Readerのpending拒否を維持し、完全再導出したpairだけを返す。
 * @trace ARCH-000008
 * @input rootCapability: 検証済みRoot、recoveryId: 元のexact回復参照。
 * @returns 現在本文と資源出版pair、または値なしblocked。
 * @precondition 処置Ownerの排他・失効確認は呼出し側が行う。
 * @postcondition 読取りを保存・回収完了へ昇格しない。
 * @effect 既存Readerの固定File読取りと短期排他だけ。
 * @failure 別対象・不正pair・実体差・解放不明は拒否する。
 * @invariant 旧Ownerや管理Capabilityを復元しない。
 * @boundary 現在Repositoryと資源Receipt出版途中。
 * @security 本文を外部公開せず、書込みAuthorityを生成しない。
 * @concurrency 同じKernel Lock内で前後を再確認する。
 */
export function readRuntimeOwnedCoordinatorResourcePublicationSnapshot(
  rootCapability: unknown,
  recoveryId: string,
) {
  return readCoordinatorStateSnapshot(
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability),
    null,
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    false,
    recoveryId,
  );
}

/**
 * fresh回収Ownerが同じ資源Receiptの保存だけを既存Writerへ再接続する。
 * @responsibility 元版・完全候補・Ownerを保存直前とKernel内で再確認する。
 * @trace ARCH-000008
 * @input repository: 回収Owner結合、recoveryId: 元参照、before／candidate: 固定pair、assertOwner: 保持中排他の再確認。
 * @returns 既存Writerの保存・読戻し・短命排他解放結果。
 * @precondition 元Owner失効とHost／Home／Runtime排他をfresh回収Ownerが確認済み。
 * @postcondition 資源起動・作成・削除・Task再実行を行わない。
 * @effect 固定state.jsonの出版と同じpending／marker回収だけ。
 * @failure 失効、別pair、他操作差、保存・解放不明は停止する。
 * @invariant Receipt保存から実資源不存在や清掃成功を推定しない。
 * @boundary 保持中の回収Ownerと既存保存Owner。
 * @security Root Readerや候補JSONだけで書込みを許可しない。
 * @concurrency 外側排他を保持し、既存WriterのKernel内でもOwnerを再確認する。
 */
export function resumeRuntimeOwnedCoordinatorResourcePublication(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  before: Buffer,
  candidate: Buffer,
  assertOwner: () => boolean,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  try {
    if (
      typeof assertOwner !== "function" ||
      assertOwner() !== true ||
      !classifyCoordinatorResourcePublication(
        before,
        candidate,
        recoveryId,
        repository.repositoryBinding,
      )
    )
      return blocked();
    const current = readCoordinatorStateSnapshot(
      repository,
      null,
      null,
      null,
      null,
      null,
      "docker_task",
      "docker_task",
      false,
      recoveryId,
    );
    if (
      current.status !== "completed" ||
      !current.lockReleased ||
      !current.resourcePublication?.before.equals(before) ||
      !current.resourcePublication.candidate.equals(candidate) ||
      assertOwner() !== true
    )
      return Object.freeze({
        ...blocked(),
        lockReleased: current.lockReleased,
      });
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: () => assertOwner() === true && repository.revalidate(),
      },
      candidate,
      null,
    );
  } catch {
    return blocked();
  }
}

/**
 * Task入場専用に現在本文または厳密な未初期化を観測する。
 * @responsibility 通常Readerの不在拒否を変えず初回入場だけを区別する。
 * @trace ARCH-000008
 * @input rootCapability: 呼出し元が検証したRepository Root。
 * @returns 通常Snapshot、専用の未初期化理由、または停止結果。
 * @precondition 入場結果から初期化や実行Authorityを発行しない。
 * @postcondition 未初期化の結果にもRootと排他解放の確認を要求する。
 * @effect 既存ReaderとKernel排他による読取りだけ。
 * @failure pending・未知物・不正本文・Root変化・解放不明は拒否する。
 * @invariant 空領域や観測不能を未初期化へ変換しない。
 * @boundary 検証済みRepositoryと現在状態の初回入場。
 * @security 内部結果は入場投影だけが利用し、処置資格にしない。
 * @concurrency 通常Readerと同じ短期排他を解放してから返す。
 */
export function readRuntimeOwnedCoordinatorAdmissionSnapshot(
  rootCapability: unknown,
) {
  return readCoordinatorStateSnapshot(
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability),
    null,
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    true,
  );
}

/**
 * 出版済み現在状態に残ったRepository結合markerだけを回収する。
 * @responsibility Taskや受領の根拠を使わず、同じ保存本文を保全して短命markerだけを除去する。
 * @trace ARCH-000008
 * @input rootCapability: 明示検証済みの現在Repository Root。
 * @returns markerの処置・不存在、保存内容保全と排他解放の個別確認。
 * @precondition 正規currentが既に出版済みで、pendingや未知Fileが存在しない。
 * @postcondition Task結果・履歴・配送・実行Authorityを生成せず、処置不明を完了にしない。
 * @effect 既存Kernel排他、固定三Fileの読取りとexact state.lockへのunlink一回だけ。
 * @failure 不正・置換・観測不能は停止し、unlinkや解放の例外を自動再試行しない。
 * @invariant 通常ReaderやTask Writerの成立条件を緩めない。
 * @boundary 現在Repositoryの保存領域と短命出版marker。
 * @security 任意Path・Task ID・Consumer・成功値を入力に受け取らない。
 * @concurrency 既存短期排他と前後の実体・全文照合を使い、非協調Processとの原子性を主張しない。
 */
export function cleanupRuntimeOwnedCoordinatorStateMarker(
  rootCapability: unknown,
) {
  let markerRemoved = false,
    markerAbsentConfirmed = false,
    storageConfirmed = false,
    filesystemEffectIssued = false,
    lockReleased = true;
  let reason = "coordinator_state_marker_cleanup_unconfirmed";
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  let lock: ReturnType<typeof acquireRuntimeOwnedCoordinatorStateKernelLock> =
    null;
  try {
    if (!repository) throw new Error("root");
    lockReleased = false;
    lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
      repository.repositoryBinding,
    );
    if (!lock) throw new Error("lock");
    let boundary: string | null = null;
    let originalNames: string[] = [];
    const original = new Map<
      string,
      ReturnType<typeof readStableBoundedFileSnapshot>
    >();
    // 取得、処置直前、処置後の三観測。同じ本文でも別実体は拒否する。
    for (let pass = 0; pass < 3; pass++) {
      if (!repository.revalidate() || !lock.assertLive())
        throw new Error("owner");
      const verified = verifyRepositoryRoot(repository.repositoryRoot);
      if (verified.status !== "completed") throw new Error("root");
      const area = observeRepositoryRuntimeDataArea(
        verified.capability,
        "coordinator",
      );
      if (
        area.status !== "ready" ||
        area.repositoryRoot !== repository.repositoryRoot ||
        (boundary !== null && area.boundaryIdentity !== boundary)
      )
        throw new Error("area");
      boundary = area.boundaryIdentity;
      const names = fs.readdirSync(area.directory).sort();
      if (
        !names.includes("state.json") ||
        names.some(
          (name) =>
            !["state.json", "history.jsonl", "state.lock"].includes(name),
        )
      )
        throw new Error("pending_or_unknown");
      if (pass === 0) originalNames = names;
      else {
        const expected =
          pass === 2
            ? originalNames.filter((name) => name !== "state.lock")
            : originalNames;
        if (JSON.stringify(names) !== JSON.stringify(expected))
          throw new Error("names_changed");
      }
      for (const name of names) {
        const file = path.join(area.directory, name);
        const metadata = fs.lstatSync(file, { bigint: true });
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1n
        )
          throw new Error("file");
        const observed = readStableBoundedFileSnapshot(
          file,
          name === "state.lock" ? 1024 : MAX_COORDINATOR_STATE_BYTES,
        );
        const final = fs.lstatSync(file, { bigint: true });
        if (
          final.nlink !== 1n ||
          !sameStableFileIdentity(observed.identity, final)
        )
          throw new Error("file_changed");
        if (
          (name === "state.json" &&
            !decodeCoordinatorStateSnapshot(
              observed.bytes,
              repository.repositoryBinding,
            )) ||
          (name === "history.jsonl" &&
            !decodeCoordinatorHistoryRows(observed.bytes)) ||
          (name === "state.lock" &&
            !observed.bytes.equals(
              Buffer.from(
                `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
              ),
            ))
        )
          throw new Error("content");
        if (pass === 0) original.set(name, observed);
        else {
          const before = original.get(name);
          if (
            !before ||
            !sameStableFileIdentity(before.identity, observed.identity) ||
            !before.bytes.equals(observed.bytes)
          )
            throw new Error("changed");
        }
      }
      if (
        !repository.revalidate() ||
        !lock.assertLive() ||
        JSON.stringify(fs.readdirSync(area.directory).sort()) !==
          JSON.stringify(names)
      )
        throw new Error("changed");
      const currentArea = observeRepositoryRuntimeDataArea(
        verified.capability,
        "coordinator",
      );
      if (
        currentArea.status !== "ready" ||
        currentArea.directory !== area.directory ||
        currentArea.boundaryIdentity !== boundary
      )
        throw new Error("area_changed");
      for (const name of names) {
        const file = path.join(area.directory, name);
        const current = readStableBoundedFileSnapshot(
          file,
          name === "state.lock" ? 1024 : MAX_COORDINATOR_STATE_BYTES,
        );
        const before = original.get(name);
        if (
          !before ||
          fs.lstatSync(file, { bigint: true }).nlink !== 1n ||
          !sameStableFileIdentity(before.identity, current.identity) ||
          !before.bytes.equals(current.bytes)
        )
          throw new Error("changed_before_effect");
      }
      if (pass === 1 && names.includes("state.lock")) {
        const marker = path.join(area.directory, "state.lock");
        filesystemEffectIssued = true;
        try {
          fs.unlinkSync(marker);
          markerRemoved = true;
        } catch {
          try {
            fs.lstatSync(marker);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              markerRemoved = true;
              markerAbsentConfirmed = true;
            }
          }
          throw new Error("unlink_unconfirmed");
        }
      }
      if (pass === 2) {
        markerAbsentConfirmed = true;
        storageConfirmed = true;
      }
    }
    reason = markerRemoved
      ? "coordinator_state_marker_cleanup_confirmed"
      : "coordinator_state_marker_absent";
  } catch {
    // 一次失敗と、既に確認できた処置事実を保持する。
  } finally {
    if (lock) {
      try {
        lockReleased = lock.release();
      } catch {
        lockReleased = false;
      }
    }
  }
  return Object.freeze({
    status:
      storageConfirmed && markerAbsentConfirmed && lockReleased
        ? ("completed" as const)
        : ("blocked" as const),
    reason:
      storageConfirmed && !lockReleased
        ? "coordinator_state_lock_release_unconfirmed"
        : reason,
    markerRemoved,
    markerAbsentConfirmed,
    storageConfirmed,
    filesystemEffectIssued,
    lockReleased,
    cleanupReason: lockReleased
      ? null
      : "coordinator_state_lock_release_unconfirmed",
  });
}

/**
 * 履歴出版途中の有限形を現在Rootとexact操作だけから読む。
 * @responsibility 固定候補との全文一致を確認し、通常Readerの拒否を緩めない。
 * @trace ARCH-000008
 * @input rootCapability、recoveryId: 検証済みRootとexact回復参照。
 * @returns 現在本文と履歴候補、または値なしblocked。
 * @precondition 保存Owner・Host／Home排他は別に確認する。
 * @postcondition 読取りからWriterや資源処置Authorityを発行しない。
 * @effect 固定五Fileと設定の読取り・既存短期排他だけ。
 * @failure 不正材料・別操作・不一致・観測不能は停止する。
 * @invariant 旧Reader／AppDataへfallbackしない。
 * @boundary 現在Repositoryと履歴出版の有限形。
 * @security 取得内容をそのまま外部公開しない。
 * @concurrency Kernel排他とFile実体・設定の前後照合を使う。
 */
export function readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
      ? borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
  );
}

/**
 * 修復履歴の保存途中を現在Rootから読み取る。
 * @responsibility 修復種別とexact参照を固定し、Taskの配送経路と分離する。
 * @trace ARCH-000008
 * @input rootCapability、recoveryId: 現在Rootと修復のexact参照。
 * @returns publicationの有限候補、履歴未開始のtechnical_state、または値なしblocked。
 * @precondition 保存Ownerの生存は更新入口で別途確認する。
 * @postcondition technical_stateは履歴領域の正常性だけを示し、Writer・Native資格を発行しない。
 * @effect 固定state／historyの読取りと既存短期排他だけ。
 * @failure 種別・Identity・候補・実体不一致は停止する。
 * @invariant 履歴確認を修復成功へ読み替えない。
 * @boundary 現在Repositoryの修復履歴。
 * @security 任意PathとTask回復参照は受け付けない。
 * @concurrency File実体と現在Rootを排他内で再確認する。
 */
export function readRuntimeOwnedCoordinatorRepairHistorySnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  const validId =
    typeof recoveryId === "string" &&
    /^docker-runtime-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(recoveryId);
  return readCoordinatorStateSnapshot(
    validId
      ? borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    validId ? recoveryId : null,
    null,
    null,
    "runtime_repair",
  );
}

/**
 * Host清掃確定の保存途中だけを同じ現在Rootから読み取る。
 * @responsibility 通常Readerの拒否を維持し、exact操作の固定候補だけを再確定へ渡す。
 * @trace ARCH-000008
 * @input rootCapability: 現在Root。recoveryId: 同じTask回復参照。
 * @returns 現在本文と固定候補・有限形、または値なしblocked。
 * @precondition 書込みOwner・Host世代・両不存在は呼出し側が別に取得する。
 * @postcondition 読取りから清掃・回復成功や実行Authorityを発行しない。
 * @effect 同じstate／pending／lockの読取りと既存短期排他だけ。
 * @failure 別候補・別対象・不正実体・観測不明・排他解放不明は停止する。
 * @invariant 旧形式探索や未発行意図の復元を行わない。
 * @boundary 現在保存途中とPackage内部のHost清掃再確定。
 * @security 任意Path・候補本文・上位ACKを受け取らない。
 * @concurrency 元版・候補・途中形を更新時に再照合する。
 */
export function readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
      ? borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability)
      : null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
  );
}

/**
 * 現在回収の耐久配送登録だけを同じRootから再構成する。
 * @responsibility ACK前のexact登録候補を通常Readerから分離する。
 * @trace ARCH-000008
 * @input rootCapability: 検証済みRoot。recoveryId: exact回復参照。
 * @returns 現在本文と内部登録候補、または値なし停止。
 * @precondition 書込みOwnerと現在資源不存在は別に確認する。
 * @postcondition 読取りだけでは配送・ACK・操作除去を発行しない。
 * @effect 固定state／history／短命保存物と既存短期排他の読取り。
 * @failure 未終端、未確認履歴、交差候補、未知Fileと観測不明は停止する。
 * @invariant 保存済み利用側以外の配送を追加しない。
 * @boundary 現在Repositoryと耐久配送登録の有限形。
 * @security 任意Root Path、候補、利用側を受け取らない。
 * @concurrency 同じKernel排他と実体の前後照合を使う。
 */
export function readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
      ? borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
  );
}

/**
 * 中断後のtransient操作だけの終了出版候補を読む。
 * @responsibility 表示受領を要求せず、真正回収Ownerへ同じ終了候補を渡す。
 * @trace ARCH-000008
 * @input rootCapability: 現在Root、recoveryId: exact対象参照。
 * @returns 現在操作と終了候補、または値なし停止。
 * @precondition 実資源・Host・Ownerの終了観測は回収Ownerが別に所有する。
 * @postcondition 読取りだけで操作除去・Task成功・受領を主張しない。
 * @effect 固定state／history／保存途中材料と短期排他の読取りだけ。
 * @failure durable、未終端、未確認履歴、別候補と不明は拒否する。
 * @invariant 通常Reader、durable ACK、通常live経路を変更しない。
 * @boundary 現在Repositoryとtransient終了出版の有限形。
 * @security 任意consumer、候補本文、受領値を受け取らない。
 * @concurrency 元本文・候補・File実体をReaderとWriterで再照合する。
 */
export function readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" && parseDockerTaskRecoveryId(recoveryId)
      ? borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
  );
}

/**
 * exact修復の終了候補または履歴に相関した除去済み状態を読む。
 * @responsibility TaskのACK条件を修復へ流用せず既存Readerを種別固定する。
 * @trace ARCH-000008
 * @input rootCapability: 現在Root、recoveryId: exact修復参照。
 * @returns 本文・候補・除去観測と排他解放、またはblocked。
 * @precondition 現在Repositoryの保存Ownerから呼ぶ。
 * @postcondition 読取りだけでは除去や技術処置を許可しない。
 * @effect 固定state／historyと短期排他の読取りだけ。
 * @failure 別種・未終端・不明・別pendingは拒否する。
 * @invariant 履歴欠測から過去の完了を推定しない。
 * @boundary 修復終了と既存保存Reader。
 * @security 任意Path・候補・Consumerを受け取らない。
 * @concurrency Kernel排他下でFile実体と元本文を確認する。
 */
export function readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  return readCoordinatorStateSnapshot(
    typeof recoveryId === "string" &&
      /^docker-runtime-repair\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(recoveryId)
      ? borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability)
      : null,
    null,
    null,
    null,
    null,
    typeof recoveryId === "string" ? recoveryId : null,
    "docker_task",
    "runtime_repair",
  );
}

/**
 * 技術回収済みのtransient操作を表示非依存で一回終了保存する。
 * @responsibility 既存Completion候補とWriterを真正回収Ownerへ限定して接続する。
 * @trace ARCH-000008
 * @input rootCapability、recoveryId: 同じ現在対象。assertOwner: 内部回収Ownerのfresh確認。
 * @returns 保存・読戻し・排他解放とEffectの個別結果。
 * @precondition 上位が資源・Host・Lease・必要成果物の終端を確認している。
 * @postcondition 他操作、履歴本文、durable配送を変更しない。
 * @effect 既存の現在状態Writerによる対象操作の除去だけ。
 * @failure 所有者、元版、候補、履歴、保存不明では同じ参照を保持して停止する。
 * @invariant 表示Receipt、再送、Provider再実行、Task成功を生成しない。
 * @boundary genuine回収Ownerと既存保存Owner。
 * @security 内部Contextは一回だけ使用し、任意consumerや成功booleanは受け取らない。
 * @concurrency 同じKernel排他と元本文の完全一致を保存直前に確認する。
 */
export function completeRuntimeOwnedCoordinatorCurrentRecovery(
  rootCapability: unknown,
  recoveryId: unknown,
  assertOwner: unknown,
) {
  return completeCoordinatorCurrentRecovery(
    rootCapability,
    recoveryId,
    assertOwner,
    "docker_task",
  );
}

/**
 * 退避物不存在の修復だけを既存completion保存へ接続する。
 * @responsibility 修復用途を固定しTaskの実行資格を生成しない。
 * @trace ARCH-000008
 * @input rootCapability、recoveryId、assertOwner: 同じ現在修復の結合。
 * @returns 保存・読戻し・解放・Effectの個別結果。
 * @precondition 呼出しOwnerが修復結果と履歴を確認している。
 * @postcondition 非対象操作・履歴・配送を変更しない。
 * @effect 既存Writerによる現在操作の除去だけ。
 * @failure 現在Owner・共同終端・元版・履歴不明は停止する。
 * @invariant 保持物削除やNative取得を行わない。
 * @boundary 修復compositionと既存保存Owner。
 * @security 任意の候補や種別を受け取らない。
 * @concurrency 既存KernelとCASを使う。
 */
export function completeRuntimeOwnedCoordinatorRepair(
  rootCapability: unknown,
  recoveryId: unknown,
  assertOwner: unknown,
) {
  return completeCoordinatorCurrentRecovery(
    rootCapability,
    recoveryId,
    assertOwner,
    "runtime_repair",
  );
}

/**
 * 種別固定wrapperの終了候補を同じ物理Writerへ渡す。
 * @responsibility 私有Contextの寿命と保存対象を一回へ限定する。
 * @trace ARCH-000008
 * @input rootCapability、recoveryId、assertOwner、operationKind: 固定wrapperの結合。
 * @returns 保存・読戻し・排他終了の観測。
 * @precondition 種別は内部wrapperが固定する。
 * @postcondition Contextを返却後に破棄する。
 * @effect 既存completion Writerだけ。
 * @failure Reader・Owner・対象・候補不一致は拒否する。
 * @invariant Taskと修復の候補や履歴関数を混同しない。
 * @boundary 種別別呼出しと共通保存骨格。
 * @security 新Store・Lock・永続資格なし。
 * @concurrency 元版とFile実体は排他内でも再照合する。
 */
function completeCoordinatorCurrentRecovery(
  rootCapability: unknown,
  recoveryId: unknown,
  assertOwner: unknown,
  operationKind: "docker_task" | "runtime_repair",
) {
  const refused = writeCoordinatorStateSnapshot(null, null, null, null);
  let context: object | null = null;
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return refused;
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    const observed = (
      operationKind === "runtime_repair"
        ? readRuntimeOwnedCoordinatorRepairCompletionSnapshot
        : readRuntimeOwnedCoordinatorCurrentCompletionSnapshot
    )(rootCapability, recoveryId);
    const publication = observed.currentCompletionPublication;
    const target = observed.value?.snapshot.operations.find(
      (item) => item.kind === operationKind && item.recoveryId === recoveryId,
    );
    if (observed.status !== "completed" || !observed.lockReleased)
      return Object.freeze({
        ...refused,
        reason: observed.reason,
        lockReleased: observed.lockReleased,
      });
    if (
      !repository ||
      !publication ||
      !target ||
      typeof recoveryId !== "string" ||
      assertOwner() !== true
    )
      return refused;
    const identity = JSON.parse(target.identityJson);
    if (
      operationKind === "docker_task" &&
      coordinatorConsumerCompletionPolicy(identity.consumer) !== "transient"
    )
      return refused;
    context = Object.freeze({});
    const bound = Object.freeze({
      ...repository,
      operationId: identity.operationId,
    });
    settlements.set(context, {
      kind: "current_completion",
      operationKind,
      repository: bound,
      recoveryId,
      before: Buffer.from(publication.before),
      candidate: Buffer.from(publication.candidate),
      historyFile: publication.historyFile,
      assertOwner: assertOwner as () => boolean,
      used: false,
    });
    return writeCoordinatorStateSnapshot(null, bound, publication.candidate, {
      recoveryId,
      cleanupStatus: null,
      dockerTerminal: null,
      currentCompletion: context,
    });
  } catch {
    return refused;
  } finally {
    if (context) settlements.delete(context);
  }
}

/**
 * 同じ操作の資源作成要求を最新現在状態から回収処理へ投影する。
 * @responsibility 未要求と結果不明を区別し、保存済みのexact Docker IDを保持する。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner、recoveryId: 同じ操作の回復参照。
 * @returns 固定五資源の不変な要求情報、または観測不能を表すnull。
 * @precondition 呼出し元は所有Processの停止後に最新情報を取得する。
 * @postcondition 読取りと排他解放を確認した同じ操作の情報だけを返す。
 * @effect 固定state.jsonの読取りと既存の短期排他だけ。
 * @failure Owner、Repository、操作、回復参照、保存形式または排他解放の不一致はnull。
 * @invariant 保存情報から現在の資源不存在や清掃完了を推定しない。
 * @boundary Repository-local現在状態とDocker回収Owner。
 * @security 旧保存物、資源名による検索または空情報へfallbackしない。
 * @concurrency Writerと同じReaderを使い、排他解放後に投影を返す。
 */
export function readRuntimeOwnedCoordinatorResourceRequests(
  managementCapability: unknown,
  recoveryId: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  if (
    !repository ||
    current.status !== "completed" ||
    !current.value ||
    !current.lockReleased ||
    !repository.revalidate()
  )
    return null;
  const operation = current.value.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  if (
    !operation ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return null;
  return Object.freeze(
    Object.fromEntries(
      operation.resources.map((resource) => [
        resource.purpose,
        Object.freeze({
          submitted: !["not_requested", "not_issued"].includes(
            resource.request,
          ),
          dockerId: resource.dockerId,
        }),
      ]),
    ) as Readonly<
      Record<
        (typeof operation.resources)[number]["purpose"],
        Readonly<{ submitted: boolean; dockerId: string | null }>
      >
    >,
  );
}

/**
 * 同じControllerが同期確認した未発行取消を現在状態へ確定する。
 * @responsibility 元予定を消さず、真正な要求前通知だけを再要求不可の終端へ保存する。
 * @trace ARCH-000008
 * @input managementCapability: 元操作Owner、recoveryId: exact参照、purpose: 元用途、notice: 元通知、recoveryCapability: 元回復Owner。
 * @returns 同じ資源の保存結果。失敗時は元予定と回復参照を保持する。
 * @precondition 本番Controllerの未発行保存callback中であり要求呼出し前である。
 * @postcondition intent_savedだけをnot_issuedへ変え、他資源・Host・履歴を保持する。
 * @effect 固定state.jsonの読取り・既存排他・次版保存だけ。
 * @failure 偽通知、別対象、失効、既発行、結果不明または保存不明は停止する。
 * @invariant Docker ID欠落や過去unknownから未発行を推論しない。
 * @boundary 本番Controllerの元同期通知と現在状態Writer。
 * @security 一般Writerや通常資源checkpointへ未発行確定の許可を渡さない。
 * @concurrency 保存排他下でも同じ元通知を再照合し、callback外へ持ち出さない。
 */
export function checkpointRuntimeOwnedCoordinatorResourceNotIssued(
  managementCapability: unknown,
  recoveryId: unknown,
  purpose: unknown,
  notice: unknown,
  recoveryCapability: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  const resource = operation?.resources.find(
    (value) => value.purpose === purpose,
  );
  if (
    !repository ||
    current.status !== "completed" ||
    !current.lockReleased ||
    !current.value ||
    !operation ||
    !resource ||
    typeof recoveryId !== "string" ||
    typeof purpose !== "string" ||
    resource.request !== "intent_saved" ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId ||
    !verifyRuntimeOwnedDockerUnissuedNotice(
      notice,
      recoveryCapability,
      managementCapability,
      purpose,
      repository.operationId,
      recoveryId,
    )
  )
    return Object.freeze({
      ...writeCoordinatorStateSnapshot(null, null, null, null),
      lockReleased: current.lockReleased,
    });
  const next = prepareCoordinatorStateResourceSnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(current.value.snapshot)}\n`),
    recoveryId,
    { ...resource, request: "not_issued", observation: "unobserved" },
    repository.repositoryBinding,
  );
  return writeCoordinatorStateSnapshot(
    managementCapability,
    repository,
    next,
    null,
    { notice, recoveryCapability, recoveryId, purpose },
  );
}

/**
 * 清掃前に固定した同じ操作の終端Snapshotを読み戻す。
 * @responsibility 失効済み通常Ownerを復活させず結果受理後の元版取得へ接続する。
 * @trace ARCH-000008
 * @input context: 清掃前に取得した内部終端Context。
 * @returns 対象操作を保持する確認済みSnapshot、または値なしblocked。
 * @precondition Contextは同じRuntimeの内部WeakMapへ登録済みである。
 * @postcondition Provider起動・新しい操作・回収許可を発行しない。
 * @effect 通常Readerと同じ固定Snapshot読取りと短期排他だけ。
 * @failure 偽Context、対象欠落、Repository置換と観測不能は停止する。
 * @invariant Snapshot読戻しから実清掃・結果受理の成立を推定しない。
 * @boundary Host清掃後の終端OwnerとRepository-local現在状態。
 * @security 呼出し元Pathや任意Recovery IDを受け取らない。
 * @concurrency 既存Readerを共有し排他解放後に値を返す。
 */
export function readRuntimeOwnedCoordinatorSettlementSnapshot(
  context: unknown,
) {
  const settlement = readLiveSettlement(context);
  return readCoordinatorStateSnapshot(
    settlement?.repository ?? null,
    settlement?.recoveryId ?? null,
  );
}

/**
 * 同じ終端操作の登録済み結果参照を上位受理へ渡す。
 *
 * @responsibility 固定結果IDと登録済み搬送先だけを保存読戻しから投影する。
 * @trace ARCH-000008
 * @input context: 清掃前の内部終端Context、consumer: 対象搬送先。
 * @returns 非Authorityの結果参照、または値なしblockedと排他解放確認。
 * @precondition 同じ操作の終端要約と必要搬送先は保存済みである。
 * @postcondition 未登録・別結果・保存途中の参照を上位へ返さない。
 * @effect 既存Readerによる固定state.json読取りと短期排他だけ。
 * @failure 偽Context、未登録Consumer、要約不一致、観測・排他解放不明を拒否する。
 * @invariant 結果参照の取得を上位耐久受理やTask全体の成功へ昇格しない。
 * @boundary 清掃後の操作Ownerと上位の耐久受理処理。
 * @security 任意結果ID・Pathを受け付けず、Host PathやSnapshot全体を返さない。
 * @concurrency 排他解放後に参照を返し、受理更新では元の保存値を再照合する。
 */
export function readRuntimeOwnedCoordinatorSettlementResult(
  context: unknown,
  consumer: unknown,
) {
  const settlement = readLiveSettlement(context);
  const observed = readCoordinatorStateSnapshot(
    settlement?.repository ?? null,
    settlement?.recoveryId ?? null,
  );
  const operation = observed.value?.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === settlement?.recoveryId,
  );
  const identity = operation ? JSON.parse(operation.identityJson) : null;
  if (
    !settlement ||
    identity?.operationId !== settlement.repository.operationId ||
    identity?.consumer !== settlement.consumer
  )
    return projectRegisteredCoordinatorResult(observed, null, null, consumer);
  return projectRegisteredCoordinatorResult(
    observed,
    settlement.recoveryId,
    settlement.repository.repositoryBinding,
    consumer,
  );
}

/**
 * 新Processから保存済みの耐久配送参照だけを読み戻す。
 * @responsibility 現在Rootとexact回復参照を固定し、登録済み結果の共通投影へ接続する。
 * @trace ARCH-000008
 * @input rootCapability: 検証済み現在Root、recoveryId: 対象のexact回復参照。
 * @returns 固定五項目参照と排他解放確認、または値なしblocked。
 * @precondition 上位組立てが対象Repositoryを固定している。
 * @postcondition 私有Context、操作Capabilityや清掃結果を復元しない。
 * @effect 固定state.json読取りと既存の短命Lock取得・解放だけ。
 * @failure 別Root・対象欠落・未登録・不正終端・保存途中・解放不明は停止する。
 * @invariant 結果読取りをACK成立・履歴確定・回復完了へ昇格しない。
 * @boundary 新Processの検証済みRepositoryと内部結果搬送。
 * @security Consumerはorchestrator固定。公開barrelや外部RequestへAuthorityを追加しない。
 * @concurrency 通常と同じReader・短期排他を使い、解放後に参照だけを返す。
 */
export function readRuntimeOwnedCoordinatorRecoveryResult(
  rootCapability: unknown,
  recoveryId: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  const observed = readCoordinatorStateSnapshot(repository, null);
  return projectRegisteredCoordinatorResult(
    observed,
    typeof recoveryId === "string" ? recoveryId : null,
    repository?.repositoryBinding ?? null,
    "orchestrator",
  );
}

/**
 * 保存済み単発依頼のexact参照を終了履歴へ再結合する。
 * @responsibility 現在操作除去と新要約の利用元・上位相関を同じ既存Readerで照合する。
 * @trace ARCH-000008
 * @input 現在Repository、元回復ID、元上位操作ID、二種に限定した利用側。
 * @returns 終了確認または未確定。本文・Path・Authorityは返さない。
 * @precondition 上位Ownerが元依頼の主体とRepositoryを認可済み。
 * @postcondition 過去のTask成功や回答再送を主張しない。
 * @effect 既存state/history読取りと短期排他だけ。
 * @failure 旧要約、欠測、別相関、pending、操作残存は拒否する。
 * @invariant 履歴不存在から終了を推定しない。
 * @boundary 単発依頼とCoordinatorの終了履歴。
 * @security 任意Pathや未知のconsumerは受け取らず、保存側と利用側を一致させる。
 * @concurrency 同じKernel排他で元版・履歴実体を再確認する。
 */
export function observeRuntimeOwnedTransientTaskCompletion(
  rootCapability: unknown,
  recoveryId: unknown,
  correlationId: unknown,
  consumer: "workbench" | "coordinator_cli" = "workbench",
) {
  if (
    (consumer !== "workbench" && consumer !== "coordinator_cli") ||
    typeof recoveryId !== "string" ||
    !parseDockerTaskRecoveryId(recoveryId) ||
    typeof correlationId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(correlationId)
  )
    return Object.freeze({
      completionConfirmed: false,
      reason: "coordinator_completion_input_invalid",
    });
  const observed = readCoordinatorStateSnapshot(
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability),
    null,
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    false,
    null,
    { recoveryId, correlationId, consumer },
  );
  return Object.freeze({
    completionConfirmed:
      observed.status === "completed" &&
      observed.lockReleased &&
      observed.deliveryAbsent,
    reason: observed.reason,
  });
}

/**
 * 読戻し確認済みSnapshotから登録済み結果参照だけを投影する。
 * @responsibility 同Processと新Processの終端要約・必要搬送集合の検査を共通化する。
 * @trace ARCH-000008
 * @input observed: 既存Reader結果、recoveryId: exact参照、repositoryBinding: 現在結合、consumer: 固定利用側。
 * @returns 登録済み五項目参照、または値なしblocked。
 * @precondition 操作ID照合など各入口固有の条件は呼出し元が保持する。
 * @postcondition 候補生成だけで未登録結果を登録済みと扱わない。
 * @effect N/A: 同期の値検査だけで保存や外部要求を発行しない。
 * @failure 対象・Consumer・元要約・集合・排他確認不一致は値なし停止。
 * @invariant 受理済み参照も読取り可能だが、除去済み操作は履歴から復元しない。
 * @boundary 固定Snapshotと非Authorityの結果参照。
 * @security 内部Snapshot本文やPathを返さない。
 * @concurrency N/A: 確認済みReader結果から純粋に投影する。
 */
function projectRegisteredCoordinatorResult(
  observed: ReturnType<typeof readCoordinatorStateSnapshot>,
  recoveryId: string | null,
  repositoryBinding: string | null,
  consumer: unknown,
) {
  const rejected = {
    status: "blocked" as const,
    reason:
      observed.status === "blocked"
        ? observed.reason
        : "coordinator_state_result_not_available",
    value: null,
    lockReleased: observed.lockReleased,
  };
  if (
    !recoveryId ||
    !repositoryBinding ||
    observed.status !== "completed" ||
    !observed.lockReleased ||
    !observed.value
  )
    return Object.freeze(rejected);
  const current = observed.value.snapshot;
  const deliveries = current.pendingDeliveries.filter(
    (item) => item.recoveryId === recoveryId,
  );
  const target = deliveries.find((item) => item.consumer === consumer);
  if (!target) return Object.freeze(rejected);
  const operation = current.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  if (!operation) return Object.freeze(rejected);
  const identity = JSON.parse(operation.identityJson);
  if (
    identity.repositoryBinding !== repositoryBinding ||
    identity.consumer !== consumer
  )
    return Object.freeze(rejected);
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(current)}\n`);
  const fixed = prepareCoordinatorStateResultDeliverySnapshot(
    bytes,
    recoveryId,
    deliveries.map((item) => item.consumer),
    repositoryBinding,
  );
  if (!fixed?.equals(bytes)) return Object.freeze(rejected);
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_state_result_observed",
    value: Object.freeze({
      repositoryBinding,
      operationId: identity.recoveryCorrelationId ?? identity.operationId,
      recoveryId: target.recoveryId,
      resultId: target.resultId,
      consumer: target.consumer,
    }),
    lockReleased: observed.lockReleased,
  });
}

/**
 * 検証済み保存結合のSnapshotを共通経路で取得する。
 * @responsibility 通常と終端の同じRoot・File・版・排他観測を所有する。
 * @trace ARCH-000008
 * @input repository: 内部保存結合、recoveryId: 対象参照。用途別の固定参照は専用再入場、allowUninitializedは初期化、storageOwnerは同じ短期排他の借用に限定する。
 * @returns 確認済みSnapshotまたは値を持たないblocked。
 * @precondition 保存結合は現在Owner、検証済みRootまたは登録済み終端Contextから得る。
 * @postcondition 排他解放不明の本文を利用側へ渡さない。
 * @effect 現在Rootと固定Fileの読取り、既存短期排他だけ。
 * @failure Root・File・対象操作不一致、通常Readerの保存途中、限定準備の別候補、解放不明は停止する。
 * @invariant 読取りは処置Authorityや初期化Writer資格を作らず、入場用の不存在観測をそれらの代わりにしない。
 * @boundary Repository-local現在状態と内部利用側。
 * @security 任意Pathや旧記録を保存先選択へ使用しない。
 * @concurrency 通常Writerと同じKernel Lockを短期間だけ保持する。
 */
function readCoordinatorStateSnapshot(
  repository:
    | (Pick<
        NonNullable<
          ReturnType<typeof borrowRuntimeOwnedCoordinatorStateRepository>
        >,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  recoveryId: string | null,
  hostCleanupRecoveryId: string | null = null,
  currentHistoryRecoveryId: string | null = null,
  currentDeliveryRecoveryId: string | null = null,
  currentCompletionRecoveryId: string | null = null,
  currentHistoryKind: "docker_task" | "runtime_repair" = "docker_task",
  currentCompletionKind: "docker_task" | "runtime_repair" = "docker_task",
  allowUninitialized = false,
  resourcePublicationRecoveryId: string | null = null,
  completedTransientTask: Readonly<{
    recoveryId: string;
    correlationId: string;
    consumer: "workbench" | "coordinator_cli";
  }> | null = null,
  storageOwner: CoordinatorStorageOwner | null = null,
  taskPublicationRead: boolean | "history" = false,
) {
  /**
   * 未確認の読取り結果を値なしで返す。
   * @responsibility 拒否理由と排他終了を保持し、未確認本文を搬送しない。
   * @trace ARCH-000008
   * @input reason: 拒否理由、lockReleased: 排他終了の観測。
   * @returns 固定blocked結果。
   * @precondition 呼出し元が原因と排他観測を確定している。
   * @postcondition valueは常にnullとなる。
   * @effect N/A: 局所結果の構築だけ。
   * @failure N/A: 独自のI/Oを発行しない。
   * @invariant blockedを新品・正常状態へ変換しない。
   * @boundary N/A: Process内の値構築だけ。
   * @security 本文・Path・Authorityを含めない。
   * @concurrency N/A: 同期の値構築だけ。
   */
  const blocked = (reason: string, lockReleased: boolean) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      lockReleased,
      value: null,
      deliveryAbsent: false,
      hostCleanupPublication: null,
      currentHistoryPublication: null,
      repairHistoryState: null,
      currentDeliveryPublication: null,
      currentCompletionPublication: null,
      repairCompletionAbsent: false,
      repairRetentionReviewAfter: null,
      resourcePublication: null,
    });
  if (!repository) return blocked("coordinator_state_owner_invalid", true);
  const borrowedOwner = storageOwner
    ? borrowCoordinatorStorageOwner(storageOwner, repository)
    : null;
  if (storageOwner && !borrowedOwner)
    return blocked("coordinator_state_owner_invalid", false);
  const ownedOwner = borrowedOwner
    ? null
    : acquireCoordinatorStorageOwnerForRepository(repository);
  const lock =
    borrowedOwner?.lock ??
    (ownedOwner ? storageOwners.get(ownedOwner)?.lock : null);
  if (!lock) return blocked("coordinator_state_lock_unavailable", false);
  let value: ReturnType<typeof decodeCoordinatorStateSnapshot> = null;
  let resourcePublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
  }> | null = null;
  let hostCleanupPublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
    mode: "A" | "B" | "C";
  }> | null = null;
  let reason = "coordinator_state_read_unconfirmed";
  let currentDeliveryPublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
    needsWrite: boolean;
    deliveryPending: boolean;
    historyFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
  }> | null = null;
  let currentCompletionPublication: Readonly<{
    before: Buffer;
    candidate: Buffer;
    historyFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
  }> | null = null;
  let currentHistoryPublication: Readonly<{
    operationKind: "docker_task" | "runtime_repair";
    before: Buffer;
    candidate: Buffer;
    stage: "checkpoint" | "publish" | "confirmed";
    needsWrite: boolean;
    historyFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
    pendingHistoryFile: Readonly<{
      bytes: Buffer;
      identity: StableFileIdentity;
    }> | null;
    retentionDays: number | null;
  }> | null = null;
  let repairHistoryState: "technical_state" | "publication" | null = null;
  let recoveryHistory: ReturnType<typeof readStableBoundedFileSnapshot> | null =
    null;
  let recoveryHistoryPending: ReturnType<
    typeof readStableBoundedFileSnapshot
  > | null = null;
  let recoveryRetentionDays: number | null = null;
  let deliveryAbsent = false;
  let repairCompletionAbsent = false;
  let repairRetentionReviewAfter: string | null = null;
  try {
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (
      verified.status !== "completed" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("owner");
    const initial = observeRepositoryRuntimeDataArea(
      verified.capability,
      "coordinator",
    );
    if (allowUninitialized && initial.status === "not_observed") {
      const fresh = observeRepositoryRuntimeDataArea(
        verified.capability,
        "coordinator",
      );
      if (
        fresh.status === "not_observed" &&
        repository.revalidate() &&
        lock.assertLive()
      )
        reason = "coordinator_state_uninitialized";
      throw new Error("admission_area_not_ready");
    }
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const names = fs.readdirSync(initial.directory);
    const allowedNames =
      taskPublicationRead === "history"
        ? ["state.json", "history.jsonl", "history.pending.jsonl"]
        : currentHistoryRecoveryId !== null
          ? [
              "state.json",
              "history.jsonl",
              "state.pending.json",
              "state.lock",
              "history.pending.jsonl",
            ]
          : taskPublicationRead ||
              resourcePublicationRecoveryId !== null ||
              hostCleanupRecoveryId !== null ||
              currentDeliveryRecoveryId !== null ||
              currentCompletionRecoveryId !== null
            ? [
                "state.json",
                "history.jsonl",
                "state.pending.json",
                "state.lock",
              ]
            : ["state.json", "history.jsonl"];
    if (names.some((name) => !allowedNames.includes(name))) {
      reason = "coordinator_state_reentry_required";
      throw new Error("pending_or_unknown_content");
    }
    const file = path.join(initial.directory, "state.json");
    const metadata = fs.lstatSync(file);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
      throw new Error("file");
    const observed = readStableBoundedFileSnapshot(
      file,
      MAX_COORDINATOR_STATE_BYTES,
    );
    const decoded = decodeCoordinatorStateSnapshot(
      observed.bytes,
      repository.repositoryBinding,
    );
    if (!decoded) throw new Error("content");
    let completedHistory: ReturnType<
      typeof readStableBoundedFileSnapshot
    > | null = null;
    const completedHistoryFile = path.join(initial.directory, "history.jsonl");
    if (completedTransientTask) {
      const target = completedTransientTask.recoveryId;
      const parsed = parseDockerTaskRecoveryId(target);
      if (
        !parsed ||
        [
          decoded.snapshot.operations,
          decoded.snapshot.unresolvedRecoveries,
          decoded.snapshot.pendingDeliveries,
        ].some((entries) =>
          entries.some(
            (entry) =>
              entry.recoveryId === target ||
              parseDockerTaskRecoveryId(entry.recoveryId)?.operationNonce ===
                parsed.operationNonce,
          ),
        )
      )
        throw new Error("completion_target_present");
      const metadata = fs.lstatSync(completedHistoryFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("completion_history_file");
      completedHistory = readStableBoundedFileSnapshot(
        completedHistoryFile,
        MAX_COORDINATOR_STATE_BYTES,
      );
      const rows = decodeCoordinatorHistoryRows(completedHistory.bytes);
      const row = rows?.find((entry) => entry.recoveryId === target);
      const summary = row ? JSON.parse(row.line).summary : null;
      if (
        !row ||
        summary.schema !== "crdd-coordinator/operation-summary/v4" ||
        summary.consumer !== completedTransientTask.consumer ||
        summary.recoveryCorrelationId !== completedTransientTask.correlationId
      )
        throw new Error("completion_history_unconfirmed");
      deliveryAbsent = true;
    }
    let pending: ReturnType<typeof readStableBoundedFileSnapshot> | null = null;
    let marker: ReturnType<typeof readStableBoundedFileSnapshot> | null = null;
    const markerFile = path.join(initial.directory, "state.lock");
    if (
      (resourcePublicationRecoveryId !== null ||
        hostCleanupRecoveryId !== null ||
        currentHistoryRecoveryId !== null ||
        currentDeliveryRecoveryId !== null ||
        currentCompletionRecoveryId !== null) &&
      names.includes("state.lock")
    ) {
      const metadata = fs.lstatSync(markerFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("marker_file");
      marker = readStableBoundedFileSnapshot(markerFile, 1024);
      const expected = Buffer.from(
        `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
      );
      if (!marker.bytes.equals(expected)) throw new Error("marker_binding");
    }
    const pendingFile = path.join(initial.directory, "state.pending.json");
    if (resourcePublicationRecoveryId !== null) {
      if (!marker || !names.includes("state.pending.json"))
        throw new Error("resource_publication_pair_required");
      const metadata = fs.lstatSync(pendingFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("pending_file");
      pending = readStableBoundedFileSnapshot(
        pendingFile,
        MAX_COORDINATOR_STATE_BYTES,
      );
      if (
        !classifyCoordinatorResourcePublication(
          observed.bytes,
          pending.bytes,
          resourcePublicationRecoveryId,
          repository.repositoryBinding,
        )
      )
        throw new Error("resource_publication_candidate_mismatch");
      resourcePublication = Object.freeze({
        before: Buffer.from(observed.bytes),
        candidate: Buffer.from(pending.bytes),
      });
    }
    if (hostCleanupRecoveryId !== null) {
      if (!marker) throw new Error("host_cleanup_reentry_marker_required");
      const operation = decoded.snapshot.operations.find(
        (item): item is CoordinatorStateTaskOperation =>
          item.kind === "docker_task" &&
          item.recoveryId === hostCleanupRecoveryId,
      );
      if (
        !operation ||
        operation.lease === "released" ||
        operation.outcome?.cleanupConfirmed === true ||
        operation.history !== null ||
        !["pending", "unknown", "confirmed"].includes(operation.host.cleanup) ||
        operation.host.pendingTransitionJson !== null ||
        operation.execution.ownerEffect !== "disabled" ||
        !coordinatorTaskResourcesAreSettled(operation)
      )
        throw new Error("host_cleanup_reentry_target_invalid");
      const current = Buffer.from(
        `${encodeCoordinatorStateValue(decoded.snapshot)}\n`,
      );
      const candidate =
        operation.host.cleanup === "confirmed"
          ? current
          : prepareCoordinatorStateHostSnapshot(
              current,
              hostCleanupRecoveryId,
              { ...operation.host, cleanup: "confirmed" },
              repository.repositoryBinding,
            );
      if (!candidate) throw new Error("host_cleanup_reentry_candidate_invalid");
      if (names.includes("state.pending.json")) {
        const metadata = fs.lstatSync(pendingFile);
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1
        )
          throw new Error("pending_file");
        pending = readStableBoundedFileSnapshot(
          pendingFile,
          MAX_COORDINATOR_STATE_BYTES,
        );
        if (
          operation.host.cleanup === "confirmed" ||
          !pending.bytes.equals(candidate)
        )
          throw new Error("host_cleanup_reentry_candidate_mismatch");
      }
      hostCleanupPublication = Object.freeze({
        before: current,
        candidate: Buffer.from(candidate),
        mode:
          operation.host.cleanup === "confirmed" ? "C" : pending ? "B" : "A",
      });
    }
    const currentPublicationRecoveryId =
      currentHistoryRecoveryId ??
      currentDeliveryRecoveryId ??
      currentCompletionRecoveryId;
    if (
      currentCompletionRecoveryId !== null &&
      currentCompletionKind === "runtime_repair" &&
      !decoded.snapshot.operations.some(
        (item) => item.recoveryId === currentCompletionRecoveryId,
      )
    ) {
      if (
        hostCleanupRecoveryId !== null ||
        currentHistoryRecoveryId !== null ||
        currentDeliveryRecoveryId !== null ||
        names.includes("state.pending.json")
      )
        throw new Error("repair_completion_absence_scope_invalid");
      const nonce = currentCompletionRecoveryId.split(".")[1];
      if (
        [
          decoded.snapshot.operations,
          decoded.snapshot.unresolvedRecoveries,
          decoded.snapshot.pendingDeliveries,
        ].some((entries) =>
          entries.some(
            (item) =>
              item.recoveryId === currentCompletionRecoveryId ||
              ("identityJson" in item
                ? JSON.parse(item.identityJson).operationNonce
                : item.operationNonce) === nonce,
          ),
        )
      )
        throw new Error("repair_completion_reference_present");
      const historyFile = path.join(initial.directory, "history.jsonl");
      const metadata = fs.lstatSync(historyFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("repair_completion_history_invalid");
      recoveryHistory = readStableBoundedFileSnapshot(
        historyFile,
        MAX_COORDINATOR_STATE_BYTES,
      );
      const rows = decodeCoordinatorHistoryRows(recoveryHistory.bytes);
      const row = rows?.find(
        (item) => item.recoveryId === currentCompletionRecoveryId,
      );
      const summary = row ? JSON.parse(row.line).summary : null;
      if (
        !rows ||
        !summary ||
        summary.schema !== "crdd-coordinator/repair-summary/v1" ||
        summary.outcome.status !== "recovered" ||
        summary.outcome.reason !== "runtime_repair_recovered" ||
        summary.outcome.cleanupConfirmed !== true ||
        summary.primaryFailure !== null ||
        summary.technical.engine !== "ready" ||
        summary.technical.hostSafety !== "safe" ||
        summary.technical.cleanup !== "confirmed" ||
        summary.technical.cleanupFailure !== null ||
        !(
          (summary.technical.stale === "absent" &&
            summary.disposition === "not_applicable") ||
          (summary.technical.stale === "retained" &&
            summary.disposition === "discard" &&
            summary.disposal &&
            dockerRuntimeRepairDisposalIsSettled(
              summary.disposal.checkpoint,
            )) ||
          (summary.technical.stale === "retained" &&
            summary.disposition === "retained_by_human_decision" &&
            summary.retention !== undefined)
        ) ||
        (repository.operationId !== undefined &&
          summary.operationId !== repository.operationId)
      )
        throw new Error("repair_completion_history_missing_or_mismatched");
      repairCompletionAbsent = true;
      repairRetentionReviewAfter =
        row && "reviewAfter" in row && typeof row.reviewAfter === "string"
          ? row.reviewAfter
          : null;
    }
    if (currentPublicationRecoveryId !== null && !repairCompletionAbsent) {
      if (
        hostCleanupRecoveryId !== null ||
        [
          currentHistoryRecoveryId,
          currentDeliveryRecoveryId,
          currentCompletionRecoveryId,
        ].filter((value) => value !== null).length !== 1
      )
        throw new Error("history_reentry_mode_conflict");
      const expectedKind =
        currentHistoryRecoveryId !== null
          ? currentHistoryKind
          : currentCompletionRecoveryId !== null
            ? currentCompletionKind
            : "docker_task";
      const operation = decoded.snapshot.operations.find(
        (item) =>
          item.kind === expectedKind &&
          item.recoveryId === currentPublicationRecoveryId,
      );
      const technicalState =
        operation?.kind === "runtime_repair" &&
        ((operation.phase === "repairing" && operation.outcome === null) ||
          (currentHistoryRecoveryId !== null &&
            currentHistoryKind === "runtime_repair" &&
            operation.outcome?.status === "recovered" &&
            operation.primaryFailure === null &&
            ((operation.phase === "awaiting_disposition" &&
              operation.disposition === "pending_human_decision" &&
              operation.disposal === null) ||
              (operation.phase === "settling" &&
                operation.disposition === "discard" &&
                operation.disposal !== null &&
                !dockerRuntimeRepairDisposalIsSettled(
                  operation.disposal.checkpoint,
                ))))) &&
        operation.summarySha256 === null &&
        operation.history === null;
      if (
        !operation ||
        (operation.kind === "runtime_repair"
          ? (!technicalState &&
              !prepareCoordinatorRepairHistorySummary(
                observed.bytes,
                operation.recoveryId,
                repository.repositoryBinding,
              )) ||
            (repository.operationId !== undefined &&
              JSON.parse(operation.identityJson).operationId !==
                repository.operationId)
          : operation.phase === "executing" ||
            operation.lease !== "released" ||
            operation.execution.ownerEffect !== "disabled" ||
            !operation.outcome?.cleanupConfirmed ||
            operation.host.cleanup !== "confirmed" ||
            operation.host.pendingTransitionJson !== null ||
            !coordinatorTaskResourcesAreSettled(operation) ||
            !isDockerRestartCheckpointSettled(operation.dockerRestart))
      )
        throw new Error("history_terminal_unconfirmed");
      for (const name of [
        "history.jsonl",
        "history.pending.jsonl",
        "state.pending.json",
      ] as const) {
        if (!names.includes(name)) continue;
        const target = path.join(initial.directory, name),
          metadata = fs.lstatSync(target);
        if (
          !metadata.isFile() ||
          metadata.isSymbolicLink() ||
          metadata.nlink !== 1
        )
          throw new Error("history_file");
        const contents = readStableBoundedFileSnapshot(
          target,
          MAX_COORDINATOR_STATE_BYTES,
        );
        if (name === "history.jsonl") recoveryHistory = contents;
        else if (name === "history.pending.jsonl")
          recoveryHistoryPending = contents;
        else pending = contents;
      }
      const before = Buffer.from(
        `${encodeCoordinatorStateValue(decoded.snapshot)}\n`,
      );
      let candidate: Buffer | null = null;
      let stage: "checkpoint" | "publish" | "confirmed" | null = null;
      if (technicalState) {
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        if (
          !rows ||
          rows.some((row) => row.recoveryId === operation.recoveryId) ||
          recoveryHistoryPending
        )
          throw new Error("repair_technical_history_invalid");
        repairHistoryState = "technical_state";
        // この分類は履歴領域の健全性だけで、pendingの採用は既存修復publisherが判断する。
      } else if (currentCompletionRecoveryId !== null) {
        if (operation.kind !== currentCompletionKind)
          throw new Error("current_completion_kind_invalid");
        const identity = JSON.parse(operation.identityJson);
        const line = (
          currentCompletionKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryLine
            : prepareCoordinatorStateHistoryLine
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentCompletionRecoveryId,
        );
        candidate = (
          currentCompletionKind === "runtime_repair"
            ? prepareCoordinatorStateRepairCompletionSnapshot
            : prepareCoordinatorStateCompletionSnapshot
        )(before, currentCompletionRecoveryId, repository.repositoryBinding);
        if (
          (currentCompletionKind === "docker_task" &&
            coordinatorConsumerCompletionPolicy(identity.consumer) !==
              "transient") ||
          !operation.history?.confirmed ||
          !line ||
          !rows ||
          (currentCompletionKind === "runtime_repair" && !row) ||
          (row && !Buffer.from(row.line).equals(line)) ||
          createHash("sha256").update(line).digest("hex") !==
            operation.history.lineSha256 ||
          recoveryHistoryPending ||
          !candidate ||
          (pending && (!marker || !pending.bytes.equals(candidate)))
        )
          throw new Error("current_completion_target_invalid");
        if (currentCompletionKind === "runtime_repair")
          repairRetentionReviewAfter =
            row && "reviewAfter" in row && typeof row.reviewAfter === "string"
              ? row.reviewAfter
              : null;
        stage = "confirmed";
        currentCompletionPublication = Object.freeze({
          before,
          candidate: Buffer.from(candidate),
          historyFile:
            recoveryHistory === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistory.bytes),
                  identity: recoveryHistory.identity,
                },
        });
      } else if (currentDeliveryRecoveryId !== null) {
        if (operation.kind !== "docker_task")
          throw new Error("current_delivery_kind_invalid");
        const identity = JSON.parse(operation.identityJson);
        const policy = coordinatorConsumerCompletionPolicy(identity.consumer);
        const line = prepareCoordinatorStateHistoryLine(
          before,
          currentDeliveryRecoveryId,
          repository.repositoryBinding,
        );
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentDeliveryRecoveryId,
        );
        if (
          !policy ||
          !operation.history?.confirmed ||
          !line ||
          !rows ||
          createHash("sha256").update(line).digest("hex") !==
            operation.history.lineSha256 ||
          (row && !Buffer.from(row.line).equals(line)) ||
          recoveryHistoryPending ||
          decoded.snapshot.resultReceipts.some(
            (item) => item.recoveryId === currentDeliveryRecoveryId,
          ) ||
          (pending && !marker) ||
          (policy === "transient" && (pending || marker))
        )
          throw new Error("current_delivery_target_invalid");
        candidate = prepareCoordinatorStateResultDeliverySnapshot(
          before,
          currentDeliveryRecoveryId,
          policy === "durable" ? ["orchestrator"] : [],
          repository.repositoryBinding,
        );
        stage = "confirmed";
        if (!candidate || (pending && !pending.bytes.equals(candidate)))
          throw new Error("current_delivery_candidate_invalid");
        if (pending && candidate.equals(before))
          throw new Error("current_delivery_already_published_pending");
        currentDeliveryPublication = Object.freeze({
          before,
          candidate: Buffer.from(candidate),
          needsWrite: !candidate.equals(before) || marker !== null,
          deliveryPending: policy === "durable",
          historyFile:
            recoveryHistory === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistory.bytes),
                  identity: recoveryHistory.identity,
                },
        });
      } else if (operation.history === null) {
        if (recoveryHistoryPending || (pending && !marker))
          throw new Error("history_checkpoint_pending_invalid");
        const priorRows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        if (
          !priorRows ||
          priorRows.some((row) => row.recoveryId === currentHistoryRecoveryId)
        )
          throw new Error("history_checkpoint_prior_line_invalid");
        const pendingState = pending
          ? decodeCoordinatorStateSnapshot(
              pending.bytes,
              repository.repositoryBinding,
            )
          : null;
        const target = pendingState?.snapshot.operations.find(
          (item) =>
            item.kind === expectedKind &&
            item.recoveryId === currentHistoryRecoveryId,
        );
        if (pending && (!target?.history || target.history.confirmed))
          throw new Error("history_checkpoint_target_invalid");
        candidate = (
          operation.kind === "runtime_repair"
            ? prepareCoordinatorRepairHistorySnapshot
            : prepareCoordinatorStateHistorySnapshot
        )(
          before,
          currentHistoryRecoveryId,
          target?.history?.occurredAt ??
            (operation.kind === "runtime_repair"
              ? operation.retention?.decidedAt
              : undefined) ??
            new Date().toISOString(),
          false,
          repository.repositoryBinding,
        );
        stage = "checkpoint";
      } else if (!operation.history.confirmed) {
        const configuration = readCoordinatorConfig(verified.capability);
        if (configuration.status !== "ready")
          throw new Error("history_config_invalid");
        recoveryRetentionDays = configuration.config.historyRetentionDays;
        const publication = (
          operation.kind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryPublication
            : prepareCoordinatorRecoveredHistoryPublication
        )(
          before,
          currentHistoryRecoveryId,
          recoveryHistory?.bytes ?? Buffer.alloc(0),
          recoveryHistoryPending?.bytes ?? null,
          recoveryRetentionDays,
          repository.repositoryBinding,
        );
        candidate = publication?.snapshotBytes ?? null;
        stage = "publish";
        if (
          pending &&
          (!marker ||
            recoveryHistoryPending ||
            publication?.historyChanged !== false)
        )
          throw new Error("history_state_pending_order_invalid");
      } else {
        if (pending || recoveryHistoryPending)
          throw new Error("history_confirmed_pending_invalid");
        const line = (
          operation.kind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryLine
            : prepareCoordinatorStateHistoryLine
        )(before, currentHistoryRecoveryId, repository.repositoryBinding);
        const rows = decodeCoordinatorHistoryRows(
          recoveryHistory?.bytes ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === currentHistoryRecoveryId,
        );
        if (
          !line ||
          !rows ||
          (!row &&
            [
              ...decoded.snapshot.pendingDeliveries,
              ...decoded.snapshot.unresolvedRecoveries,
            ].some((item) => item.recoveryId === operation.recoveryId)) ||
          (row && !Buffer.from(row.line).equals(line))
        )
          throw new Error("history_confirmed_line_invalid");
        candidate = before;
        stage = "confirmed";
      }
      if (
        !technicalState &&
        (!candidate || (pending && !pending.bytes.equals(candidate)))
      )
        throw new Error("history_reentry_candidate_mismatch");
      if (
        currentHistoryRecoveryId !== null &&
        !technicalState &&
        candidate &&
        stage
      ) {
        if (operation.kind === "runtime_repair")
          repairHistoryState = "publication";
        currentHistoryPublication = Object.freeze({
          operationKind: operation.kind,
          before,
          candidate: Buffer.from(candidate),
          stage,
          needsWrite: stage !== "confirmed" || marker !== null,
          historyFile:
            recoveryHistory === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistory.bytes),
                  identity: recoveryHistory.identity,
                },
          pendingHistoryFile:
            recoveryHistoryPending === null
              ? null
              : {
                  bytes: Buffer.from(recoveryHistoryPending.bytes),
                  identity: recoveryHistoryPending.identity,
                },
          retentionDays: recoveryRetentionDays,
        });
      }
    }
    if (recoveryId !== null) {
      const operation = decoded.snapshot.operations.find(
        (value) =>
          value.kind ===
            (currentHistoryRecoveryId !== null
              ? currentHistoryKind
              : "docker_task") && value.recoveryId === recoveryId,
      );
      if (
        !operation ||
        typeof repository.operationId !== "string" ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      ) {
        reason = "coordinator_state_settlement_target_invalid";
        throw new Error("settlement_target");
      }
    }
    const finalFile = fs.lstatSync(file, { bigint: true });
    const freshRoot = verifyRepositoryRoot(repository.repositoryRoot);
    if (freshRoot.status !== "completed") throw new Error("root");
    const fresh = observeRepositoryRuntimeDataArea(
      freshRoot.capability,
      "coordinator",
    );
    if (
      !repository.revalidate() ||
      !lock.assertLive() ||
      (
        [
          ["history.jsonl", recoveryHistory],
          ["history.pending.jsonl", recoveryHistoryPending],
        ] as const
      ).some(
        ([name, entry]) =>
          entry !== null &&
          (!sameStableFileIdentity(
            entry.identity,
            fs.lstatSync(path.join(initial.directory, name), { bigint: true }),
          ) ||
            fs.lstatSync(path.join(initial.directory, name), { bigint: true })
              .nlink !== 1n),
      ) ||
      (currentPublicationRecoveryId !== null &&
        (names.includes("history.jsonl") !==
          fs.readdirSync(initial.directory).includes("history.jsonl") ||
          names.includes("history.pending.jsonl") !==
            fs
              .readdirSync(initial.directory)
              .includes("history.pending.jsonl") ||
          (recoveryRetentionDays !== null &&
            (() => {
              const config = readCoordinatorConfig(freshRoot.capability);
              return (
                config.status !== "ready" ||
                config.config.historyRetentionDays !== recoveryRetentionDays
              );
            })()))) ||
      !sameStableFileIdentity(observed.identity, finalFile) ||
      finalFile.nlink !== 1n ||
      fresh.status !== "ready" ||
      fresh.directory !== initial.directory ||
      fresh.boundaryIdentity !== initial.boundaryIdentity ||
      (completedHistory !== null &&
        (!sameStableFileIdentity(
          completedHistory.identity,
          fs.lstatSync(completedHistoryFile, { bigint: true }),
        ) ||
          fs.lstatSync(completedHistoryFile, { bigint: true }).nlink !== 1n)) ||
      (marker !== null &&
        (!sameStableFileIdentity(
          marker.identity,
          fs.lstatSync(markerFile, { bigint: true }),
        ) ||
          fs.lstatSync(markerFile, { bigint: true }).nlink !== 1n)) ||
      names.includes("state.lock") !==
        fs.readdirSync(initial.directory).includes("state.lock") ||
      (pending !== null &&
        (!sameStableFileIdentity(
          pending.identity,
          fs.lstatSync(pendingFile, { bigint: true }),
        ) ||
          fs.lstatSync(pendingFile, { bigint: true }).nlink !== 1n)) ||
      names.includes("state.pending.json") !==
        fs.readdirSync(initial.directory).includes("state.pending.json") ||
      fs
        .readdirSync(initial.directory)
        .some((name) => !allowedNames.includes(name))
    )
      throw new Error("changed");
    value = decoded;
  } catch {
    value = null;
  }
  let lockReleased = false;
  if (!borrowedOwner) {
    try {
      lockReleased = ownedOwner?.release() === true;
    } catch {
      lockReleased = false;
    }
  } else if (!borrowCoordinatorStorageOwner(storageOwner, repository)) {
    return blocked("coordinator_state_owner_invalid", false);
  }
  if (!borrowedOwner && !lockReleased)
    return blocked("coordinator_state_lock_release_unconfirmed", false);
  if (!value)
    return borrowedOwner
      ? Object.freeze({ ...blocked(reason, false), ownerHeld: true as const })
      : blocked(reason, true);
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_state_read_confirmed",
    lockReleased,
    ...(borrowedOwner ? { ownerHeld: true as const } : {}),
    value,
    deliveryAbsent,
    hostCleanupPublication,
    currentHistoryPublication,
    repairHistoryState,
    currentDeliveryPublication,
    currentCompletionPublication,
    repairCompletionAbsent,
    repairRetentionReviewAfter,
    resourcePublication,
  });
}

/**
 * 同じ保存Ownerのまま現在本文を読み取る。
 * @responsibility Kernel再取得・解放なしの読取りを通常Readerの実体検査へ接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: このModuleが発行した保持中Owner。
 * @returns 読取り結果。借用時はownerHeld=true、lockReleased=false。
 * @precondition 呼出し元が同じOwnerの解放を必ず行う。
 * @postcondition 取得済みOwnerを入れ替えず、読取りで初期化しない。
 * @effect 検証済みRootと固定Fileの読取りだけ。
 * @failure 偽造・解放済み・別結合・観測不能は値なしの停止。
 * @invariant ownerHeldと解放済みを同一視しない。
 * @boundary 同じ短期排他内の保存利用側と現在Reader。
 * @security 入力OwnerのPropertyや関数を信用しない。
 * @concurrency 下位Readerは同じKernelを借用し再取得しない。
 */
export function readCoordinatorStorageSnapshotOwned(
  owner: unknown,
  taskPublicationRead: boolean | "history" = false,
) {
  const binding =
    owner && typeof owner === "object" ? storageOwners.get(owner) : null;
  if (!binding) return readCoordinatorStateSnapshot(null, null);
  return readCoordinatorStateSnapshot(
    binding.repository,
    null,
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    true,
    null,
    null,
    owner as CoordinatorStorageOwner,
    taskPublicationRead,
  );
}

/**
 * 取得済みOwnerでTask区画を既存の物理Writerへ渡す。
 * @responsibility 業務候補の固定・初期作成・同版再入場と単一CASを接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 真正保存Owner、viewValue: 業務View、expectedRevision: 元保存改訂、factsValue: 明示結果事実。
 * @returns 保存確認と保持中Ownerを区別した結果。
 * @precondition 呼出し側が同Owner内で業務遷移・Lease・履歴を照合している。
 * @postcondition 既存の固定I/Oだけを利用し、内部で排他を解放しない。
 * @effect 新品の明示初期化又は既存stateのpending・rename・読戻し。
 * @failure 不正候補・元版差・保存不明は同じ記録を保持する。
 * @invariant 第三Writer・旧形式変換・自動再実行を追加しない。
 * @boundary 業務処理から単一物理Writer。
 * @security 任意Path・偽Owner・外部callbackを受け付けない。
 * @concurrency 呼出し元が外側の一回解放を所有する。
 */
export function writeCoordinatorStorageTaskSnapshotOwned(
  owner: unknown,
  viewValue: unknown,
  expectedRevision: number,
  factsValue: unknown = [],
) {
  let filesystemEffectIssued = false;
  const rejected = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      filesystemEffectIssued,
      snapshotConfirmed: false,
      lockReleased: false,
      ownerHeld: true as const,
      value: null as CoordinatorSnapshot | null,
    });
  const binding =
    owner && typeof owner === "object" ? storageOwners.get(owner) : null;
  if (!binding || !isLiveCoordinatorStorageOwner(owner))
    return rejected("coordinator_state_owner_invalid");
  const issued = owner as CoordinatorStorageOwner;
  try {
    const view: unknown = JSON.parse(encodeCoordinatorStateValue(viewValue));
    const facts: unknown = JSON.parse(encodeCoordinatorStateValue(factsValue));
    if (
      !view ||
      typeof view !== "object" ||
      !validCoordinatorSnapshot(
        view,
        String((view as Record<string, unknown>).repositoryBindingId),
        issued.repositoryRootHash,
      ) ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      view.snapshotRevision !== expectedRevision + 1 ||
      !Array.isArray(facts) ||
      !facts.every(
        (fact, index) =>
          fact &&
          typeof fact === "object" &&
          JSON.stringify(Object.keys(fact).sort()) ===
            JSON.stringify(
              [
                "projectId",
                "taskId",
                "attemptId",
                "operationId",
                "recoveryUnresolved",
              ].sort(),
            ) &&
          typeof fact.recoveryUnresolved === "boolean" &&
          !facts
            .slice(0, index)
            .some(
              (prior) =>
                prior.projectId === fact.projectId &&
                prior.taskId === fact.taskId,
            ) &&
          view.projects.some(
            (project) =>
              project.projectId === fact.projectId &&
              project.tasks.some(
                (task) =>
                  task.definition.id === fact.taskId &&
                  task.attemptId !== null &&
                  task.attemptId === fact.attemptId &&
                  task.operationId !== null &&
                  task.operationId === fact.operationId,
              ),
          ),
      )
    )
      return rejected("coordinator_task_publication_input_invalid");
    const observed = readCoordinatorStorageSnapshotOwned(owner, true);
    let before: Buffer | null = null,
      initialBoundary: string | null = null;
    let bytes: Buffer | null = null;
    if (observed.status === "completed" && observed.value) {
      before = Buffer.from(
        `${encodeCoordinatorStateValue(observed.value.snapshot)}\n`,
      );
      const currentTask = decodeCoordinatorUnifiedSnapshot(
        before,
        issued.repositoryBinding,
      );
      if (!currentTask)
        return rejected("coordinator_task_publication_input_invalid");
      if (
        observed.value.snapshot.revision === view.snapshotRevision &&
        encodeCoordinatorStateValue(
          projectCoordinatorTaskSnapshot(
            currentTask,
            issued.repositoryRootHash,
          ),
        ) === encodeCoordinatorStateValue(view)
      )
        bytes = before;
      else if (observed.value.snapshot.revision === expectedRevision)
        bytes = prepareCoordinatorUnifiedTaskSections(
          before,
          view,
          issued.repositoryBinding,
          issued.repositoryRootHash,
          facts,
        );
    } else if (
      observed.reason === "coordinator_state_uninitialized" &&
      expectedRevision === 0 &&
      Object.values(view)
        .filter(Array.isArray)
        .every((values) => values.length === 0) &&
      facts.length === 0
    ) {
      const verified = verifyRepositoryRoot(issued.repositoryRoot);
      if (
        verified.status !== "completed" ||
        !isLiveCoordinatorStorageOwner(owner)
      )
        return rejected("coordinator_state_owner_invalid");
      const {
        schema: _schema,
        schemaRevision: _schemaRevision,
        snapshotRevision: _revision,
        repositoryRootHash: _hash,
        ...sections
      } = view;
      bytes = Buffer.from(
        `${encodeCoordinatorStateValue({
          ...sections,
          schema: COORDINATOR_STATE_SCHEMA,
          revision: 1,
          previous: null,
          repositoryBinding: issued.repositoryBinding,
          operations: [],
          unresolvedRecoveries: [],
          pendingDeliveries: [],
          resultReceipts: [],
        })}\n`,
      );
      if (!decodeCoordinatorUnifiedSnapshot(bytes, issued.repositoryBinding))
        return rejected("coordinator_task_publication_input_invalid");
      filesystemEffectIssued = true;
      const temporary = requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataArea(verified.capability, "tmp"),
        "coordinator_state_initialization_unconfirmed",
      );
      if (
        temporary?.status !== "ready" ||
        !isLiveCoordinatorStorageOwner(owner)
      )
        return rejected("coordinator_state_initialization_unconfirmed");
      const created = createCoordinatorRuntimeDataArea(verified.capability);
      filesystemEffectIssued ||= created.effectIssued;
      if (created.status !== "created")
        return rejected("coordinator_state_initialization_unconfirmed");
      initialBoundary = created.observation.boundaryIdentity;
    }
    const candidate = bytes
      ? decodeCoordinatorStateSnapshot(bytes, issued.repositoryBinding)
      : null;
    if (!bytes || !candidate)
      return rejected("coordinator_task_publication_revision_conflict");
    const result = commitCoordinatorStateSnapshotOwned({
      repository: binding.repository,
      candidate,
      bytes: Buffer.from(bytes),
      settlement: null,
      unissued: undefined,
      hostCleanupPublication: undefined,
      managementCapability: null,
      currentRepair: null,
      currentAuthenticationClosure: null,
      initializationOwner: owner,
      currentHistory: null,
      currentDelivery: null,
      currentCompletion: null,
      attempt: {
        revision: candidate.snapshot.revision,
        payloadSha256: candidate.payloadSha256,
        recoveryIds: Object.freeze(
          candidate.snapshot.operations.map((o) => o.recoveryId),
        ),
      },
      storageOwner: issued,
      lock: binding.lock,
      taskPublication: {
        before,
        view,
        facts,
        rootHash: issued.repositoryRootHash,
        initialBoundary,
      },
    });
    filesystemEffectIssued ||= result.filesystemEffectIssued;
    if (!result.snapshotConfirmed || !isLiveCoordinatorStorageOwner(owner))
      return rejected(result.reason);
    return Object.freeze({
      status: "completed" as const,
      reason: result.reason,
      filesystemEffectIssued,
      snapshotConfirmed: true,
      ownerHeld: true as const,
      lockReleased: false,
      value: view,
    });
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError) throw error;
    return rejected("coordinator_task_publication_unconfirmed");
  }
}

/**
 * 新規Coordinator領域の初回保存を一つの本文へ結合する。
 * @responsibility 領域の排他的作成と同じOwner・本文の初期化証拠を所有する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner、candidateBytes: 初回Snapshot本文。
 * @returns 準備結果、Effect情報と排他終了結果。
 * @precondition .crdd親は既存Ownerが正常作成済み。
 * @postcondition 既存の空領域を再利用しない。
 * @effect Runtime Data Ownerを通して新品coordinator領域だけを作成する。
 * @failure 既存領域、不一致、観測不能、解放失敗では停止する。
 * @invariant 失敗後の証拠を別本文へ転用せず、公開後は初回作成に使わない。
 * @boundary 操作Owner、Runtime Dataの領域作成と現在状態Writer。
 * @security 証拠は内部WeakMapだけに保持し、AuthorityやPathを公開しない。
 * @concurrency 同じCoordinator保存用の短期排他を用いる。
 */
export function prepareRuntimeOwnedCoordinatorStateInitialization(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  return prepareCoordinatorStateInitialization(
    managementCapability,
    repository,
    candidateBytes,
  );
}

/**
 * 現在呼出しの種別へ結合した初期本文を準備する。
 * @responsibility Taskと修復の資格を混同せず同じ領域作成・排他を再利用する。
 * @trace ARCH-000008
 * @input managementCapability: 私有の初期化Owner、repository: 検証済み結合、candidateBytes: 固定本文。
 * @returns 新規領域作成・準備・解放の観測。
 * @precondition 公開内部wrapperが種別別の真正Ownerを結合済み。
 * @postcondition 既存の空領域を初期化資格にしない。
 * @effect 既存Domain Ownerを通した固定領域作成だけ。
 * @failure Root・本文・Owner・解放不明は停止。
 * @invariant Task管理Capabilityを修復用に偽造しない。
 * @boundary 種別別保存Ownerと共通初期化I/O。
 * @security Repository借用だけで呼べる公開APIにしない。
 * @concurrency 既存の短期Kernel排他下で領域を作成する。
 */
function prepareCoordinatorStateInitialization(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<
          ReturnType<typeof borrowRuntimeOwnedCoordinatorStateRepository>
        >,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
) {
  const candidate = repository
    ? decodeCoordinatorStateSnapshot(
        candidateBytes,
        repository.repositoryBinding,
      )
    : null;
  if (
    !repository ||
    !candidate ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !validateCoordinatorStateTransition(
      null,
      candidateBytes,
      repository.repositoryBinding,
    ) ||
    initializations.has(managementCapability) ||
    candidate.snapshot.operations.some(
      (operation) =>
        JSON.parse(operation.identityJson).operationId !==
        repository.operationId,
    ) ||
    [
      ...candidate.snapshot.unresolvedRecoveries,
      ...candidate.snapshot.pendingDeliveries,
    ].some((item) => {
      const operation = candidate.snapshot.operations.find(
        (value): value is CoordinatorStateTaskOperation =>
          value.kind === "docker_task" && value.recoveryId === item.recoveryId,
      );
      return (
        !operation ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: true,
    });
  const storageOwner = acquireCoordinatorStorageOwnerForRepository(repository);
  const lock = storageOwner ? storageOwners.get(storageOwner)?.lock : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: false,
    });
  let effectIssued = false;
  let isPrepared = false;
  try {
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (
      verified.status !== "completed" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("owner");
    const created = createCoordinatorRuntimeDataArea(verified.capability);
    effectIssued = created.effectIssued;
    if (
      created.status !== "created" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("created");
    initializations.set(managementCapability, {
      repositoryBinding: repository.repositoryBinding,
      boundaryIdentity: created.observation.boundaryIdentity,
      payloadSha256: candidate.payloadSha256,
      publicationIssued: false,
    });
    isPrepared = true;
  } catch {
    isPrepared = false;
  }
  let lockReleased = false;
  try {
    lockReleased = storageOwner.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) initializations.delete(managementCapability);
  return Object.freeze({
    status: isPrepared && lockReleased ? "prepared" : "blocked",
    effectIssued,
    lockReleased,
  });
}

/**
 * 最新現在状態の保存と同じpendingへの再入場を処置する。
 * @responsibility 保存確定と排他終了を別結果で返し、部分成功を隠さない。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner、candidateBytes: 次Snapshotの正規本文。
 * @returns status、保存確認、排他終了、Effect発行、試行版とHash、exact回復参照。
 * @precondition 操作OwnerとRepository結合を確認済み。
 * @postcondition 失敗・観測不能を成功や不存在にしない。
 * @effect 固定state.lock/pending/stateの作成・置換・短命物回収だけ。
 * @failure 不一致やI/O失敗は例外で上位へ返す。
 * @invariant 本番Producerの全面切替やHost回収成立をこの保存だけから主張しない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意Pathや過去JSONから保存先を選択しない。
 * @concurrency 同じRepositoryの短期排他下で処置する。
 */
export function writeRuntimeOwnedCoordinatorStateSnapshot(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  return writeCoordinatorStateSnapshot(
    managementCapability,
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability),
    candidateBytes,
    null,
  );
}

/**
 * 現在Ownerがexact修復の短命出版だけを既存Writerへ結合する。
 * @responsibility 旧初期化Ownerを復元せず、保存途中の同じ本文だけを確定する。
 * @trace ARCH-000008
 * @input rootCapability: 検証Root、recoveryId: exact参照、assertInvocation: 現在呼出し確認。
 * @returns no_pending、または保存・Effect・排他確認を分離したWriter結果。
 * @precondition 明示修復入口内だけから呼び、技術再開は別に確認する。
 * @postcondition 観測不明をpending不存在へ変更しない。
 * @effect 固定保存物の読取り、既存Kernel排他、同じpendingの出版／回収だけ。
 * @failure 不正・実体差・Owner失効・解放不明は停止し再試行しない。
 * @invariant 通常初期化の新品証明・WeakMapを変更しない。
 * @boundary 修復compositionと現在Repositoryの保存途中材料。
 * @security 任意Path・候補本文・初期化許可boolを受け取らない。
 * @concurrency 読取りとWriterの両排他下で実体・全文を再照合する。
 */
export function resumeRuntimeOwnedCoordinatorRepairPublication(
  rootCapability: unknown,
  recoveryId: string,
  assertInvocation: () => unknown,
) {
  const refused = () => writeCoordinatorStateSnapshot(null, null, null, null);
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  /**
   * metadata出版の現在Ownerだけを再確認する。
   * @responsibility 取消と保存Ownerを分離する。
   * @trace ARCH-000008
   * @input N/A: 現在Rootと同期確認を捕捉済み。
   * @returns 両方が同期trueの場合だけtrue。
   * @precondition 内部明示修復呼出し。
   * @postcondition JSONから旧Ownerを復元しない。
   * @effect Root／Revision観測と同期確認。
   * @failure 非同期・Proxy・例外・失効はfalse。
   * @invariant 出版許可は技術処置許可ではない。
   * @boundary 呼出しと保存Owner。
   * @security 未信頼thenableを実行しない。
   * @concurrency 同期確認。
   */
  const assertOwner = () => {
    try {
      if (
        !repository ||
        typeof assertInvocation !== "function" ||
        types.isProxy(assertInvocation) ||
        types.isAsyncFunction(assertInvocation)
      )
        return false;
      const value = assertInvocation();
      if (types.isPromise(value))
        void Promise.prototype.then.call(
          value,
          () => undefined,
          () => undefined,
        );
      return value === true && repository.revalidate();
    } catch {
      return false;
    }
  };
  if (!assertOwner() || !repository) return refused();
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock) return { ...refused(), lockReleased: false };
  let files: Map<
    string,
    ReturnType<typeof readStableBoundedFileSnapshot>
  > | null = null;
  let boundaryIdentity: string | null = null;
  let publication: ReturnType<typeof classifyCoordinatorRepairPublication> =
    null;
  let noPending = false;
  let lockReleased = false;
  try {
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (verified.status !== "completed" || !assertOwner() || !lock.assertLive())
      throw new Error("owner");
    const area = observeRepositoryRuntimeDataArea(
      verified.capability,
      "coordinator",
    );
    if (
      area.status !== "ready" ||
      area.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    boundaryIdentity = area.boundaryIdentity;
    const names = fs.readdirSync(area.directory).sort();
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "state.lock",
            "history.jsonl",
          ].includes(name),
      )
    )
      throw new Error("names");
    files = new Map();
    for (const name of names) {
      const file = path.join(area.directory, name);
      const stat = fs.lstatSync(file, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n)
        throw new Error("file");
      const value = readStableBoundedFileSnapshot(
        file,
        name === "state.lock" ? 1024 : MAX_COORDINATOR_STATE_BYTES,
      );
      if (!sameStableFileIdentity(value.identity, stat))
        throw new Error("changed");
      files.set(name, value);
    }
    const current = files.get("state.json")?.bytes ?? null;
    const pending = files.get("state.pending.json")?.bytes ?? null;
    if (
      current &&
      !decodeCoordinatorStateSnapshot(current, repository.repositoryBinding)
    )
      throw new Error("current");
    const history = files.get("history.jsonl");
    if (history && !decodeCoordinatorHistoryRows(history.bytes))
      throw new Error("history");
    const marker = files.get("state.lock")?.bytes ?? null;
    const expectedMarker = Buffer.from(
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
    );
    if (marker && !marker.equals(expectedMarker)) throw new Error("marker");
    if (pending) {
      if (!marker) throw new Error("marker_absent");
      publication = classifyCoordinatorRepairPublication(
        current,
        pending,
        recoveryId,
        repository.repositoryBinding,
      );
      if (
        !publication ||
        (publication.mode === "initial_publication" &&
          names.join("|") !== "state.lock|state.pending.json")
      )
        throw new Error("publication");
    } else {
      if (!current) throw new Error("current_absent");
      noPending = true;
    }
    for (const [name, previous] of files) {
      const file = path.join(area.directory, name);
      const value = readStableBoundedFileSnapshot(
        file,
        name === "state.lock" ? 1024 : MAX_COORDINATOR_STATE_BYTES,
      );
      if (
        !sameStableFileIdentity(previous.identity, value.identity) ||
        !previous.bytes.equals(value.bytes) ||
        fs.lstatSync(file, { bigint: true }).nlink !== 1n
      )
        throw new Error("changed");
    }
    const final = observeRepositoryRuntimeDataArea(
      verified.capability,
      "coordinator",
    );
    if (
      !assertOwner() ||
      !lock.assertLive() ||
      final.status !== "ready" ||
      final.boundaryIdentity !== boundaryIdentity ||
      JSON.stringify(fs.readdirSync(area.directory).sort()) !==
        JSON.stringify(names)
    )
      throw new Error("changed");
  } catch {
    files = null;
    publication = null;
    noPending = false;
  } finally {
    try {
      lockReleased = lock.release();
    } catch {
      lockReleased = false;
    }
  }
  if (!files || !boundaryIdentity || !lockReleased || !assertOwner())
    return { ...refused(), lockReleased };
  if (noPending)
    return {
      status: "no_pending" as const,
      snapshotConfirmed: false,
      filesystemEffectIssued: false,
      lockReleased: true,
    };
  if (!publication) return refused();
  const target = decodeCoordinatorStateSnapshot(
    publication.candidate,
    repository.repositoryBinding,
  )?.snapshot.operations.find((item) => item.recoveryId === recoveryId);
  if (target?.kind !== "runtime_repair") return refused();
  const context = Object.freeze({});
  const bound = Object.freeze({
    ...repository,
    operationId: JSON.parse(target.identityJson).operationId as string,
    revalidate: assertOwner,
  });
  settlements.set(context, {
    kind: "runtime_repair",
    purpose:
      publication.mode === "initial_publication" ||
      publication.mode === "identity" ||
      publication.mode === "remove_pending"
        ? "checkpoint"
        : publication.mode,
    repository: bound,
    recoveryId,
    before: publication.before,
    candidate: publication.candidate,
    assertOwner,
    used: false,
    publication: { boundaryIdentity, files },
  });
  try {
    return writeCoordinatorStateSnapshot(
      null,
      bound,
      publication.candidate,
      null,
      undefined,
      undefined,
      context,
    );
  } finally {
    settlements.delete(context);
  }
}

/**
 * 明示修復呼出しの一保存を同じ物理Writerへ結合する。
 * @responsibility Root借用に加えて呼出しOwner・exact対象・元版を私有Contextへ固定する。
 * @trace ARCH-000008
 * @input rootCapability: 検証Root、recoveryId: exact修復、before: 元版、candidateBytes: 次版、assertInvocation: 同じ呼出しの現在確認、purpose: 通常更新または新Session準備。
 * @returns 既存Writerの保存確認・解放・Effectを分けた結果。
 * @precondition 内部の明示介入compositionがDIの準備・通知と呼出し生存を結合済み。
 * @postcondition Task管理Capabilityを要求せず、対象以外を変更しない。
 * @effect 初回の固定領域作成と既存状態Writerだけ。
 * @failure 偽Root、失効、別対象、元版差、不正遷移、保存不明は停止。
 * @invariant 保存JSON・主体Hashだけを実修復許可へ昇格しない。
 * @boundary 明示修復compositionと私有保存Context。
 * @security Package Rootから公開せず、任意Path／Task資格を受けない。
 * @concurrency 同期の一保存へ限定し、物理I/Oは既存Kernel排他を使う。
 */
export function writeRuntimeOwnedCoordinatorRepairSnapshot(
  rootCapability: unknown,
  recoveryId: string,
  before: Buffer | null,
  candidateBytes: Buffer,
  assertInvocation: () => unknown,
  purpose: RepairWritePurpose,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  let initializationEffectIssued = false;
  try {
    if (
      typeof assertInvocation !== "function" ||
      types.isAsyncFunction(assertInvocation) ||
      ![
        "checkpoint",
        "session_begin",
        "retention_handoff",
        "disposal_decision",
        "disposal_primary",
        "disposal_failed",
        "disposal_auxiliary",
      ].includes(purpose)
    )
      return blocked();
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    if (!repository) return blocked();
    /**
     * 同じ修復呼出しとRootだけを再確認する。
     * @responsibility 非同期値と例外を保存資格にしない。
     * @trace ARCH-000008
     * @input N/A: 捕捉した呼出し確認と検証Root。
     * @returns 同期trueかつRoot再確認成功だけtrue。
     * @precondition 明示介入composition内でだけ有効。
     * @postcondition Native生存や修復成功を代わりに判定しない。
     * @effect Root・Revision読取りと用途固定の呼出し確認。
     * @failure false・例外・Promiseはfalse。
     * @invariant 取消後の事実記録と新技術Effectの許可を区別する。
     * @boundary 修復呼出しと状態保存。
     * @security 任意のthenableを実行しない。
     * @concurrency 同期確認のみ。
     */
    const assertOwner = () => {
      try {
        const result = assertInvocation();
        if (types.isPromise(result))
          void Promise.prototype.then.call(
            result,
            () => undefined,
            () => undefined,
          );
        return result === true && repository.revalidate();
      } catch {
        return false;
      }
    };
    if (!assertOwner() || (before !== null && !Buffer.isBuffer(before)))
      return blocked();
    const candidate = decodeCoordinatorStateSnapshot(
      candidateBytes,
      repository.repositoryBinding,
    );
    const previous =
      before === null
        ? null
        : decodeCoordinatorStateSnapshot(before, repository.repositoryBinding);
    const target = candidate?.snapshot.operations.find(
      (operation) =>
        operation.kind === "runtime_repair" &&
        operation.recoveryId === recoveryId,
    );
    const previousTarget = previous?.snapshot.operations.find(
      (operation) => operation.recoveryId === recoveryId,
    );
    if (
      !candidate ||
      !target ||
      target.summarySha256 !== (previousTarget?.summarySha256 ?? null) ||
      encodeCoordinatorStateValue(target.history) !==
        encodeCoordinatorStateValue(previousTarget?.history ?? null) ||
      (before !== null && !previous) ||
      encodeCoordinatorStateValue(
        previous?.snapshot.operations.filter(
          (operation) => operation.recoveryId !== recoveryId,
        ) ?? [],
      ) !==
        encodeCoordinatorStateValue(
          candidate.snapshot.operations.filter(
            (operation) => operation.recoveryId !== recoveryId,
          ),
        ) ||
      encodeCoordinatorStateValue(
        previous?.snapshot.unresolvedRecoveries ?? [],
      ) !==
        encodeCoordinatorStateValue(candidate.snapshot.unresolvedRecoveries) ||
      encodeCoordinatorStateValue(
        previous?.snapshot.pendingDeliveries ?? [],
      ) !== encodeCoordinatorStateValue(candidate.snapshot.pendingDeliveries) ||
      !validateRepairWriteCandidate(
        before,
        candidateBytes,
        recoveryId,
        purpose,
        repository.repositoryBinding,
      )
    )
      return blocked();
    const operationId = JSON.parse(target.identityJson).operationId as string;
    const bound = Object.freeze({
      ...repository,
      operationId,
      revalidate: assertOwner,
    });
    if (
      ["disposal_primary", "disposal_failed", "disposal_auxiliary"].includes(
        purpose,
      ) &&
      before !== null &&
      candidateBytes.equals(before)
    ) {
      // Reader自身のKernel内で同値を再観測する。物理Writer／marker生成へ入らない。
      const observed = readCoordinatorStateSnapshot(bound, null);
      const confirmed =
        observed.status === "completed" &&
        observed.value !== null &&
        observed.lockReleased &&
        observed.value.payloadSha256 === previous?.payloadSha256 &&
        Buffer.from(
          `${encodeCoordinatorStateValue(observed.value.snapshot)}\n`,
        ).equals(before) &&
        observed.value.snapshot.operations.filter(
          (item) =>
            item.kind === "runtime_repair" && item.recoveryId === recoveryId,
        ).length === 1 &&
        assertOwner();
      return Object.freeze({
        revision: candidate.snapshot.revision,
        payloadSha256: candidate.payloadSha256,
        recoveryIds: Object.freeze(
          candidate.snapshot.operations.map((item) => item.recoveryId),
        ),
        status: confirmed ? "completed" : "blocked",
        reason: confirmed
          ? "coordinator_state_snapshot_confirmed"
          : "coordinator_state_read_unconfirmed",
        snapshotConfirmed: confirmed,
        filesystemEffectIssued: false,
        lockReleased: observed.lockReleased,
      });
    }
    const context = Object.freeze({});
    settlements.set(context, {
      kind: "runtime_repair",
      purpose,
      repository: bound,
      recoveryId,
      before: before === null ? null : Buffer.from(before),
      candidate: Buffer.from(candidateBytes),
      assertOwner,
      used: false,
    });
    try {
      if (before === null) {
        const initialized = prepareCoordinatorStateInitialization(
          context,
          bound,
          candidateBytes,
        );
        initializationEffectIssued ||= initialized.effectIssued;
        if (initialized.status !== "prepared" || !initialized.lockReleased) {
          return Object.freeze({
            ...blocked(),
            reason: "coordinator_state_initialization_unconfirmed",
            filesystemEffectIssued: initializationEffectIssued,
            lockReleased: initialized.lockReleased,
          });
        }
      }
      const saved = writeCoordinatorStateSnapshot(
        null,
        bound,
        candidateBytes,
        null,
        undefined,
        undefined,
        context,
      );
      return Object.freeze({
        ...saved,
        filesystemEffectIssued:
          initializationEffectIssued || saved.filesystemEffectIssued,
      });
    } finally {
      settlements.delete(context);
      initializations.delete(context);
    }
  } catch {
    return Object.freeze({
      ...blocked(),
      filesystemEffectIssued: initializationEffectIssued,
    });
  }
}

/**
 * 通常保存と終端限定保存の候補・用途・短期排他を準備する。
 * @responsibility 検証済み結合、限定差分と元版を固定し、取得済み排他をOwned確定へ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 通常初期化Ownerまたはnull、repository: 検証済み借用、candidateBytes: 次本文、settlement: 終端制約またはnull。
 * @returns 取得前の停止結果、又は検証済み入力と取得済み排他の私有組。
 * @precondition 公開内部wrapperが借用を検証している。
 * @postcondition 終端経路から初期化・新要求・他操作変更を発行しない。
 * @effect 固定現在状態の読取りと既存短期排他の取得。候補の出版は行わない。
 * @failure 結合、差分、元版、保存または排他不明はblocked。
 * @invariant 旧形式fallbackと二重Writerを作らない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意PathやCaller supplied借用を受けない。
 * @concurrency 既存Repository単位排他を短期保持する。
 */
function prepareCoordinatorStateWrite(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<
          ReturnType<typeof borrowRuntimeOwnedCoordinatorStateRepository>
        >,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
  settlement: {
    recoveryId: string;
    cleanupStatus: string | null;
    dockerTerminal: ReturnType<
      typeof borrowRuntimeOwnedDockerTerminalObservations
    >;
    historyInitial?: true;
    historyPublish?: true;
    currentHistory?: object;
    currentDelivery?: object;
    currentCompletion?: object;
    deliveryRegistration?: unknown;
    consumer?: "coordinator_cli" | "orchestrator" | "workbench";
    completion?: { before: Buffer; candidate: Buffer };
    managementCapability?: unknown;
  } | null,
  unissued?: Readonly<{
    notice: unknown;
    recoveryCapability: unknown;
    recoveryId: string;
    purpose: string;
  }>,
  hostCleanupPublication?: NonNullable<
    ReturnType<
      typeof readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot
    >["hostCleanupPublication"]
  >,
  repairContext?: object,
) {
  const repairBinding = repairContext ? settlements.get(repairContext) : null;
  const currentRepair =
    repairBinding?.kind === "runtime_repair" ? repairBinding : null;
  const currentAuthenticationClosure =
    repairBinding?.kind === "authentication_unknown_closure"
      ? repairBinding
      : null;
  const initializationOwner = repairContext ?? managementCapability;
  const historyBinding = settlement?.currentHistory
    ? settlements.get(settlement.currentHistory)
    : null;
  const currentHistory =
    historyBinding?.kind === "current_history" ? historyBinding : null;
  const deliveryBinding = settlement?.currentDelivery
    ? settlements.get(settlement.currentDelivery)
    : null;
  const currentDelivery =
    deliveryBinding?.kind === "current_delivery" ? deliveryBinding : null;
  const completionBinding = settlement?.currentCompletion
    ? settlements.get(settlement.currentCompletion)
    : null;
  const currentCompletion =
    completionBinding?.kind === "current_completion" ? completionBinding : null;
  const candidate = repository
    ? decodeCoordinatorStateSnapshot(
        candidateBytes,
        repository.repositoryBinding,
      )
    : null;
  const bytes = candidate
    ? Buffer.from(`${encodeCoordinatorStateValue(candidate.snapshot)}\n`)
    : null;
  const attempt = {
    revision: candidate?.snapshot.revision ?? null,
    payloadSha256: candidate?.payloadSha256 ?? null,
    recoveryIds: Object.freeze(
      candidate?.snapshot.operations.map((operation) => operation.recoveryId) ??
        [],
    ),
  };
  if (
    !repository ||
    !candidate ||
    !bytes ||
    (repairContext &&
      ((!currentRepair && !currentAuthenticationClosure) ||
        currentRepair?.used ||
        currentAuthenticationClosure?.used ||
        settlement !== null)) ||
    (settlement?.currentHistory && (!currentHistory || currentHistory.used)) ||
    (settlement?.currentDelivery &&
      (!currentDelivery || currentDelivery.used)) ||
    (settlement?.currentCompletion &&
      (!currentCompletion || currentCompletion.used)) ||
    [currentHistory, currentDelivery, currentCompletion].filter(
      (value) => value !== null,
    ).length > 1
  )
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_input_invalid",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: true,
    });
  if (
    !currentAuthenticationClosure &&
    candidate.snapshot.operations.some(
      (operation) =>
        operation.kind === "docker_task" &&
        operation.resources.some(
          (resource) =>
            resource.request === "unknown" && resource.observation === "absent",
        ),
    )
  ) {
    // 私有pairは差分の基準であり保存資格ではない。元版・実体・Ownerは
    // 主Kernel内で必ず再検査する。一般入口だけは通常Readerを用いる。
    const fixedPairs = [
      currentHistory,
      currentDelivery,
      currentCompletion,
      currentRepair,
      settlement?.completion,
      hostCleanupPublication,
    ].filter((pair) => pair !== null && pair !== undefined);
    let previousSnapshot: CoordinatorStateSnapshot | null = null;
    let previousLockReleased = true;
    if (fixedPairs.length === 1) {
      const fixed = fixedPairs[0];
      if (fixed?.candidate.equals(bytes))
        previousSnapshot =
          decodeCoordinatorStateSnapshot(
            fixed.before,
            repository.repositoryBinding,
          )?.snapshot ?? null;
    } else if (fixedPairs.length === 0) {
      const previous = readCoordinatorStateSnapshot(repository, null);
      previousLockReleased = previous.lockReleased;
      if (previous.status === "completed" && previous.value)
        previousSnapshot = previous.value.snapshot;
    }
    if (
      !previousSnapshot ||
      !previousLockReleased ||
      authenticationUnknownAbsenceChanged(previousSnapshot, candidate.snapshot)
    )
      return Object.freeze({
        ...attempt,
        status: "blocked",
        reason: "coordinator_state_authentication_closure_owner_required",
        filesystemEffectIssued: false,
        snapshotConfirmed: false,
        lockReleased: previousLockReleased,
      });
  }
  const storageOwner = acquireCoordinatorStorageOwnerForRepository(repository);
  const lock = storageOwner ? storageOwners.get(storageOwner)?.lock : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_lock_unavailable",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: false,
    });
  return {
    repository,
    candidate,
    bytes,
    settlement,
    unissued,
    hostCleanupPublication,
    managementCapability,
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentDelivery,
    currentCompletion,
    attempt,
    storageOwner,
    lock,
  };
}

/**
 * 取得済み保存排他の中で候補を一箇所から物理確定する。
 * @responsibility 固定I/O、境界照合、pending、rename、読戻しを既存順で所有する。
 * @trace ARCH-000008
 * @input prepared: このModuleが検査・取得した私有準備結果。
 * @returns 保存Effect・本文確認・理由と履歴の確定値。排他解放は含めない。
 * @precondition 既存短期排他を保持し、呼出し側が解放を所有する。
 * @postcondition File確認と排他解放を別の事実として返す。
 * @effect 固定State・履歴Fileと短命Fileの既存I/O。
 * @failure 途中失敗は候補と元参照を保全し保存未確認を返す。
 * @invariant Contextの消費順と生存照合を変更しない。
 * @boundary 同じOwner内の保存確定。新Writerや同期層は作らない。
 * @security 私有準備結果・任意Path・外部callbackを公開しない。
 * @concurrency Lockを再取得・解放せず、保持中の固定I/Oだけを行う。
 */
function commitCoordinatorStateSnapshotOwned(
  prepared: Extract<
    ReturnType<typeof prepareCoordinatorStateWrite>,
    { lock: unknown }
  > & {
    taskPublication?: Readonly<{
      before: Buffer | null;
      view: unknown;
      facts: readonly Record<string, unknown>[];
      rootHash: string;
      initialBoundary: string | null;
    }>;
  },
) {
  const {
    repository,
    candidate,
    bytes,
    settlement,
    unissued,
    hostCleanupPublication,
    managementCapability,
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentDelivery,
    currentCompletion,
    taskPublication,
    lock,
  } = prepared;
  if (currentHistory) currentHistory.used = true;
  if (currentDelivery) currentDelivery.used = true;
  if (currentCompletion) currentCompletion.used = true;
  if (currentRepair) currentRepair.used = true;
  if (currentAuthenticationClosure) currentAuthenticationClosure.used = true;
  let filesystemEffectIssued = false;
  let snapshotConfirmed = false;
  let reason = "coordinator_state_storage_unconfirmed";
  let initialHistoryLine: string | null = null;
  let historyAlreadyConfirmed = false;
  try {
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (verified.status !== "completed") throw new Error("root");
    const initial = observeRepositoryRuntimeDataArea(
      verified.capability,
      "coordinator",
    );
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const directory = initial.directory;
    const fileIdentities = new Map<string, StableFileIdentity>();
    /**
     * 保存I/Oの前後で同じ操作Ownerと領域を再確認する。
     * @responsibility Rootと.crddとcoordinator領域の置換を拒否する。
     * @trace ARCH-000008
     * @input N/A: 閉包のOwnerと固定境界。
     * @returns N/A: 一致しなければ例外。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 現在Rootと領域metadataの読取り。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant LockだけをRoot実体の証明にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const assertBoundary = () => {
      if (!repository.revalidate() || !lock.assertLive())
        throw new Error("owner");
      if (currentRepair && currentRepair.assertOwner() !== true)
        throw new Error("repair_owner");
      if (currentCompletion && currentCompletion.assertOwner() !== true)
        throw new Error("current_completion_owner");
      if (currentHistory && currentHistory.retentionDays !== null) {
        const configuration = readCoordinatorConfig(verified.capability);
        if (
          configuration.status !== "ready" ||
          configuration.config.historyRetentionDays !==
            currentHistory.retentionDays
        )
          throw new Error("current_history_config_changed");
      }
      const fresh = verifyRepositoryRoot(repository.repositoryRoot);
      if (fresh.status !== "completed") throw new Error("root");
      const observed = observeRepositoryRuntimeDataArea(
        fresh.capability,
        "coordinator",
      );
      if (
        observed.status !== "ready" ||
        observed.directory !== directory ||
        observed.boundaryIdentity !== initial.boundaryIdentity
      )
        throw new Error("boundary");
    };
    /**
     * 固定Fileの明示不存在と安定本文を区別する。
     * @responsibility 通常File・nlink1・bounded本文と前後境界を照合する。
     * @trace ARCH-000008
     * @input name: 固定された保存File名。
     * @returns 安定byte列、または明示不存在のnull。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileの読取りだけ。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 観測不能や途中消失を不存在にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const read = (
      name:
        | "state.json"
        | "state.pending.json"
        | "state.lock"
        | "history.jsonl"
        | "history.pending.jsonl",
    ) => {
      assertBoundary();
      const file = path.join(directory, name);
      let metadata: fs.Stats;
      try {
        metadata = fs.lstatSync(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        if (fileIdentities.has(name)) throw new Error("file_disappeared");
        assertBoundary();
        return null;
      }
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("file");
      const observed = readStableBoundedFileSnapshot(
        file,
        MAX_COORDINATOR_STATE_BYTES,
      );
      const expectedIdentity = fileIdentities.get(name);
      if (
        expectedIdentity &&
        !sameStableFileIdentity(expectedIdentity, observed.identity)
      )
        throw new Error("file_replaced");
      fileIdentities.set(name, observed.identity);
      if (fs.lstatSync(file).nlink !== 1) throw new Error("links");
      assertBoundary();
      return observed.bytes;
    };
    /**
     * 固定の短命Fileを排他的に作成してflushする。
     * @responsibility 既存File非上書きと保存途中の残存保持を所有する。
     * @trace ARCH-000008
     * @input name: pendingまたはlock、content: 確定本文。
     * @returns N/A: 作成とflushを実行する。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileのwx作成、書込み、fsync、close。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 失敗後にpendingを自動削除しない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const create = (
      name: "state.pending.json" | "state.lock" | "history.pending.jsonl",
      content: Buffer,
    ) => {
      assertBoundary();
      filesystemEffectIssued = true;
      const fd = fs.openSync(path.join(directory, name), "wx", 0o600);
      try {
        fs.writeFileSync(fd, content);
        fs.fsyncSync(fd);
        fileIdentities.set(name, fs.fstatSync(fd, { bigint: true }));
      } finally {
        fs.closeSync(fd);
      }
      const saved = read(name);
      if (!saved?.equals(content)) throw new Error("readback");
    };
    assertBoundary();
    const names = fs.readdirSync(directory);
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "state.lock",
            "history.jsonl",
            "history.pending.jsonl",
          ].includes(name),
      )
    )
      throw new Error("unknown_content");
    const marker = Buffer.from(
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
    );
    const oldMarker = read("state.lock");
    if (oldMarker !== null && !oldMarker.equals(marker))
      throw new Error("marker");
    let currentBytes = read("state.json");
    let current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(
            currentBytes,
            repository.repositoryBinding,
          );
    if (currentBytes !== null && !current) throw new Error("current");
    if (currentAuthenticationClosure) {
      const bound = currentAuthenticationClosure;
      const beforeTasks = current?.snapshot.operations.filter(
        (item) =>
          item.kind === "docker_task" && item.recoveryId === bound.recoveryId,
      );
      const candidateTasks = candidate.snapshot.operations.filter(
        (item) =>
          item.kind === "docker_task" && item.recoveryId === bound.recoveryId,
      );
      const expected = prepareCoordinatorAuthenticationUnknownClosureSnapshot(
        bound.before,
        bound.recoveryId,
        bound.observations,
        repository.repositoryBinding,
      );
      if (
        bound.repository.repositoryRoot !== repository.repositoryRoot ||
        bound.repository.repositoryBinding !== repository.repositoryBinding ||
        bound.repository.operationId !== repository.operationId ||
        beforeTasks?.length !== 1 ||
        candidateTasks.length !== 1 ||
        beforeTasks[0]?.identityJson !== candidateTasks[0]?.identityJson ||
        JSON.parse(beforeTasks[0]?.identityJson ?? "null")?.operationId !==
          repository.operationId ||
        JSON.parse(candidateTasks[0]?.identityJson ?? "null")?.operationId !==
          repository.operationId ||
        !currentBytes?.equals(bound.before) ||
        !bytes.equals(bound.candidate) ||
        !expected?.equals(bytes) ||
        bound.assertOwner() !== true
      )
        throw new Error("authentication_closure_context");
    } else if (
      authenticationUnknownAbsenceChanged(
        current?.snapshot ?? null,
        candidate.snapshot,
      )
    ) {
      throw new Error("authentication_closure_owner_required");
    }
    let repairPublication: ReturnType<
      typeof classifyCoordinatorRepairPublication
    > = null;
    if (currentRepair?.publication) {
      const observed = currentRepair.publication;
      if (
        initial.boundaryIdentity !== observed.boundaryIdentity ||
        JSON.stringify([...observed.files.keys()].sort()) !==
          JSON.stringify([...names].sort())
      )
        throw new Error("publication_boundary");
      for (const [name, previous] of observed.files) {
        const value = read(
          name as
            | "state.json"
            | "state.pending.json"
            | "state.lock"
            | "history.jsonl",
        );
        const identity = fileIdentities.get(name);
        if (
          !value?.equals(previous.bytes) ||
          !identity ||
          !sameStableFileIdentity(previous.identity, identity)
        )
          throw new Error("publication_file_changed");
      }
      const pending = read("state.pending.json");
      if (!pending || !oldMarker?.equals(marker))
        throw new Error("publication_missing");
      repairPublication = classifyCoordinatorRepairPublication(
        currentBytes,
        pending,
        currentRepair.recoveryId,
        repository.repositoryBinding,
      );
      if (
        !repairPublication?.candidate.equals(bytes) ||
        (!["initial_publication", "identity", "remove_pending"].includes(
          repairPublication.mode,
        ) &&
          repairPublication.mode !== currentRepair.purpose) ||
        (repairPublication.mode === "initial_publication" &&
          names.sort().join("|") !== "state.lock|state.pending.json")
      )
        throw new Error("publication_invalid");
    }
    if (currentRepair) {
      const target = candidate.snapshot.operations.find(
        (operation) => operation.recoveryId === currentRepair.recoveryId,
      );
      const beforeTarget = current?.snapshot.operations.find(
        (operation) => operation.recoveryId === currentRepair.recoveryId,
      );
      if (
        currentRepair.repository.repositoryRoot !== repository.repositoryRoot ||
        currentRepair.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentRepair.repository.operationId !== repository.operationId ||
        !bytes.equals(currentRepair.candidate) ||
        (currentRepair.before === null
          ? currentBytes !== null
          : !currentBytes?.equals(currentRepair.before)) ||
        target?.kind !== "runtime_repair" ||
        (beforeTarget && beforeTarget.kind !== "runtime_repair") ||
        target.summarySha256 !== (beforeTarget?.summarySha256 ?? null) ||
        encodeCoordinatorStateValue(target.history) !==
          encodeCoordinatorStateValue(beforeTarget?.history ?? null) ||
        JSON.parse(target.identityJson).operationId !==
          repository.operationId ||
        (beforeTarget && beforeTarget.identityJson !== target.identityJson) ||
        encodeCoordinatorStateValue(
          current?.snapshot.operations.filter(
            (operation) => operation.recoveryId !== currentRepair.recoveryId,
          ) ?? [],
        ) !==
          encodeCoordinatorStateValue(
            candidate.snapshot.operations.filter(
              (operation) => operation.recoveryId !== currentRepair.recoveryId,
            ),
          ) ||
        encodeCoordinatorStateValue(
          current?.snapshot.unresolvedRecoveries ?? [],
        ) !==
          encodeCoordinatorStateValue(
            candidate.snapshot.unresolvedRecoveries,
          ) ||
        encodeCoordinatorStateValue(
          current?.snapshot.pendingDeliveries ?? [],
        ) !==
          encodeCoordinatorStateValue(candidate.snapshot.pendingDeliveries) ||
        currentRepair.assertOwner() !== true
      )
        throw new Error("repair_writer_scope_invalid");
    }
    let completionConfirmed = false;
    let savedTerminalConfirmed = false;
    let repairHistoryScopeConfirmed = false;
    if (taskPublication) {
      const same = currentBytes?.equals(bytes) === true;
      const expected =
        same || taskPublication.before === null
          ? bytes
          : prepareCoordinatorUnifiedTaskSections(
              taskPublication.before,
              taskPublication.view,
              repository.repositoryBinding,
              taskPublication.rootHash,
              taskPublication.facts,
            );
      if (
        !expected?.equals(bytes) ||
        (!same &&
          (taskPublication.before === null
            ? currentBytes !== null ||
              taskPublication.initialBoundary !== initial.boundaryIdentity ||
              candidate.snapshot.operations.length !== 0 ||
              candidate.snapshot.projects.length !== 0 ||
              candidate.snapshot.queueEntries.length !== 0 ||
              candidate.snapshot.resultReceipts.length !== 0
            : !currentBytes?.equals(taskPublication.before))) ||
        (!same &&
          !validateCoordinatorUnifiedTransition(
            currentBytes,
            bytes,
            repository.repositoryBinding,
          ))
      )
        throw new Error("task_publication_scope_invalid");
      const taskDecoded = decodeCoordinatorUnifiedSnapshot(
        bytes,
        repository.repositoryBinding,
      );
      if (!taskDecoded) throw new Error("task_publication_scope_invalid");
      const projected = projectCoordinatorTaskSnapshot(
        taskDecoded,
        taskPublication.rootHash,
      );
      if (
        encodeCoordinatorStateValue(projected) !==
        encodeCoordinatorStateValue(taskPublication.view)
      )
        throw new Error("task_publication_view_invalid");
      for (const fact of taskPublication.facts) {
        const task = candidate.snapshot.projects
          .find((p) => p.projectId === fact.projectId)
          ?.tasks.find(
            (t) =>
              t.definition.id === fact.taskId &&
              t.attemptId === fact.attemptId &&
              t.operationId === fact.operationId,
          );
        if (
          !task ||
          (task.settlement.kind === "operations"
            ? task.settlement.resultUnresolved
            : task.settlement.kind === "executor_result"
              ? task.settlement.recoveryUnresolved
              : false) !== fact.recoveryUnresolved
        )
          throw new Error("task_result_fact_invalid");
      }
      for (const receipt of candidate.snapshot.resultReceipts) {
        if (
          current?.snapshot.resultReceipts.some(
            (r) => r.recoveryId === receipt.recoveryId,
          )
        )
          continue;
        const line = currentBytes
          ? prepareCoordinatorStateHistoryLine(
              currentBytes,
              receipt.recoveryId,
              repository.repositoryBinding,
            )
          : null;
        const rows = decodeCoordinatorHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        if (
          !line ||
          !rows?.some(
            (row) =>
              row.recoveryId === receipt.recoveryId &&
              Buffer.from(row.line).equals(line),
          )
        )
          throw new Error("task_receipt_history_unconfirmed");
      }
      completionConfirmed = true;
      savedTerminalConfirmed = true;
    }
    if (currentCompletion) {
      const history = read("history.jsonl"),
        expectedHistory = currentCompletion.historyFile;
      const historyIdentity = fileIdentities.get("history.jsonl") ?? null;
      if (
        !settlement ||
        currentCompletion.repository.repositoryRoot !==
          repository.repositoryRoot ||
        currentCompletion.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentCompletion.repository.operationId !== repository.operationId ||
        currentCompletion.recoveryId !== settlement.recoveryId ||
        !current ||
        !currentBytes?.equals(currentCompletion.before) ||
        !bytes.equals(currentCompletion.candidate) ||
        currentCompletion.assertOwner() !== true ||
        settlement.currentHistory ||
        settlement.currentDelivery ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined ||
        settlement.managementCapability ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        read("history.pending.jsonl") !== null ||
        (expectedHistory === null
          ? history !== null
          : !history ||
            !historyIdentity ||
            !history.equals(expectedHistory.bytes) ||
            !sameStableFileIdentity(expectedHistory.identity, historyIdentity))
      )
        throw new Error("current_completion_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item) =>
          item.kind === currentCompletion.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      const identity = operation ? JSON.parse(operation.identityJson) : null;
      const expected = (
        currentCompletion.operationKind === "runtime_repair"
          ? prepareCoordinatorStateRepairCompletionSnapshot
          : prepareCoordinatorStateCompletionSnapshot
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const line = (
        currentCompletion.operationKind === "runtime_repair"
          ? prepareCoordinatorRepairHistoryLine
          : prepareCoordinatorStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const rows = decodeCoordinatorHistoryRows(history ?? Buffer.alloc(0));
      const row = rows?.find(
        (item) => item.recoveryId === settlement.recoveryId,
      );
      if (
        !operation?.history?.confirmed ||
        identity?.operationId !== repository.operationId ||
        (currentCompletion.operationKind === "docker_task" &&
          coordinatorConsumerCompletionPolicy(identity.consumer) !==
            "transient") ||
        !expected?.equals(bytes) ||
        !line ||
        !rows ||
        (currentCompletion.operationKind === "runtime_repair" && !row) ||
        createHash("sha256").update(line).digest("hex") !==
          operation.history.lineSha256 ||
        (row && !Buffer.from(row.line).equals(line)) ||
        (read("state.pending.json") !== null && oldMarker === null) ||
        currentCompletion.assertOwner() !== true
      )
        throw new Error("current_completion_candidate_invalid");
      completionConfirmed = true;
      savedTerminalConfirmed = true;
    } else if (currentDelivery) {
      const history = read("history.jsonl"),
        identity = fileIdentities.get("history.jsonl") ?? null;
      const expectedHistory = currentDelivery.historyFile;
      if (
        (expectedHistory === null
          ? history !== null
          : !history ||
            !identity ||
            !history.equals(expectedHistory.bytes) ||
            !sameStableFileIdentity(expectedHistory.identity, identity)) ||
        currentDelivery.repository.repositoryRoot !==
          repository.repositoryRoot ||
        currentDelivery.repository.repositoryBinding !==
          repository.repositoryBinding ||
        currentDelivery.repository.operationId !== repository.operationId ||
        currentDelivery.recoveryId !== settlement?.recoveryId ||
        !currentBytes?.equals(currentDelivery.before) ||
        !bytes.equals(currentDelivery.candidate) ||
        !current ||
        currentDelivery.assertOwner() !== true ||
        settlement.currentHistory ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined ||
        settlement.managementCapability ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("current_delivery_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item): item is CoordinatorStateTaskOperation =>
          item.kind === "docker_task" &&
          item.recoveryId === settlement.recoveryId,
      );
      const sourceIdentity = operation
        ? JSON.parse(operation.identityJson)
        : null;
      const line = prepareCoordinatorStateHistoryLine(
        currentBytes,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeCoordinatorHistoryRows(history ?? Buffer.alloc(0));
      const row = rows?.find(
        (item) => item.recoveryId === settlement.recoveryId,
      );
      const expected = prepareCoordinatorStateResultDeliverySnapshot(
        currentBytes,
        settlement.recoveryId,
        ["orchestrator"],
        repository.repositoryBinding,
      );
      if (
        !operation?.history?.confirmed ||
        sourceIdentity?.consumer !== "orchestrator" ||
        sourceIdentity.operationId !== repository.operationId ||
        !line ||
        !rows ||
        createHash("sha256").update(line).digest("hex") !==
          operation.history.lineSha256 ||
        (row && !Buffer.from(row.line).equals(line)) ||
        current.snapshot.resultReceipts.some(
          (item) => item.recoveryId === settlement.recoveryId,
        ) ||
        !expected?.equals(bytes) ||
        (read("state.pending.json") !== null && oldMarker === null) ||
        currentDelivery.assertOwner() !== true
      )
        throw new Error("current_delivery_candidate_invalid");
      if (
        read("state.pending.json") !== null &&
        expected?.equals(currentBytes ?? Buffer.alloc(0))
      )
        throw new Error("current_delivery_already_published_pending");
      savedTerminalConfirmed = true;
    } else if (currentHistory) {
      for (const [name, expected] of [
        ["history.jsonl", currentHistory.historyFile],
        ["history.pending.jsonl", currentHistory.pendingHistoryFile],
      ] as const) {
        const actual = read(name),
          identity = fileIdentities.get(name) ?? null;
        if (
          expected === null
            ? actual !== null
            : actual === null ||
              identity === null ||
              !actual.equals(expected.bytes) ||
              !sameStableFileIdentity(expected.identity, identity)
        )
          throw new Error("current_history_file_changed");
      }
      if (
        !settlement ||
        settlement.recoveryId !== currentHistory.recoveryId ||
        repository.repositoryRoot !==
          currentHistory.repository.repositoryRoot ||
        repository.repositoryBinding !==
          currentHistory.repository.repositoryBinding ||
        repository.operationId !== currentHistory.repository.operationId ||
        settlement.cleanupStatus !== null ||
        settlement.dockerTerminal !== null ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined ||
        settlement.managementCapability ||
        currentHistory.assertOwner() !== true ||
        !currentBytes?.equals(currentHistory.before) ||
        !bytes.equals(currentHistory.candidate) ||
        !current
      )
        throw new Error("current_history_scope_invalid");
      const operation = current.snapshot.operations.find(
        (item) =>
          item.kind === currentHistory.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      const target = candidate.snapshot.operations.find(
        (item) =>
          item.kind === currentHistory.operationKind &&
          item.recoveryId === settlement.recoveryId,
      );
      if (
        !operation ||
        !target ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId ||
        JSON.parse(target.identityJson).operationId !== repository.operationId
      )
        throw new Error("current_history_operation_invalid");
      let expected: Buffer | null = null;
      if (currentHistory.stage === "checkpoint") {
        if (
          operation?.history !== null ||
          !target?.history ||
          target.history.confirmed
        )
          throw new Error("current_history_checkpoint_invalid");
        expected = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistorySnapshot
            : prepareCoordinatorStateHistorySnapshot
        )(
          currentBytes,
          settlement.recoveryId,
          target.history.occurredAt,
          false,
          repository.repositoryBinding,
        );
        if (read("history.pending.jsonl") !== null)
          throw new Error("current_history_checkpoint_order_invalid");
      } else if (currentHistory.stage === "publish") {
        const config = readCoordinatorConfig(verified.capability);
        if (config.status !== "ready")
          throw new Error("current_history_config_invalid");
        const publication = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryPublication
            : prepareCoordinatorRecoveredHistoryPublication
        )(
          currentBytes,
          settlement.recoveryId,
          read("history.jsonl") ?? Buffer.alloc(0),
          read("history.pending.jsonl"),
          config.config.historyRetentionDays,
          repository.repositoryBinding,
        );
        if (
          read("state.pending.json") !== null &&
          publication?.historyChanged !== false
        )
          throw new Error("current_history_state_pending_order_invalid");
        expected = publication?.snapshotBytes ?? null;
      } else {
        if (
          !operation?.history?.confirmed ||
          read("history.pending.jsonl") !== null ||
          read("state.pending.json") !== null
        )
          throw new Error("current_history_confirmed_invalid");
        const line = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryLine
            : prepareCoordinatorStateHistoryLine
        )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
        const rows = decodeCoordinatorHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        const row = rows?.find(
          (item) => item.recoveryId === settlement.recoveryId,
        );
        if (!line || !rows || (row && !Buffer.from(row.line).equals(line)))
          throw new Error("current_history_line_invalid");
        expected = currentBytes;
      }
      if (!expected?.equals(bytes) || currentHistory.assertOwner() !== true)
        throw new Error("current_history_candidate_invalid");
      repairHistoryScopeConfirmed =
        currentHistory.operationKind === "runtime_repair";
      savedTerminalConfirmed = true;
    } else if (settlement?.completion) {
      const before = decodeCoordinatorStateSnapshot(
        settlement.completion.before,
        repository.repositoryBinding,
      );
      const previous = before?.snapshot.operations.find(
        (operation): operation is CoordinatorStateTaskOperation =>
          operation.kind === "docker_task" &&
          operation.recoveryId === settlement.recoveryId,
      );
      const expected = prepareCoordinatorStateCompletionSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const savedConsumer = previous
        ? JSON.parse(previous.identityJson).consumer
        : null;
      const completionPolicy =
        coordinatorConsumerCompletionPolicy(savedConsumer);
      if (
        !before ||
        !previous ||
        !completionPolicy ||
        savedConsumer !== settlement.consumer ||
        JSON.parse(previous.identityJson).operationId !==
          repository.operationId ||
        !expected?.equals(bytes) ||
        !settlement.completion.candidate.equals(bytes) ||
        !(
          currentBytes?.equals(settlement.completion.before) ||
          currentBytes?.equals(bytes)
        ) ||
        !settlement.cleanupStatus ||
        !settlement.dockerTerminal?.homeLeaseReleased ||
        !settlement.dockerTerminal.mountLeaseReleased ||
        !settlement.dockerTerminal.recoveryCompleted ||
        completionPolicy !== "transient" ||
        settlement.deliveryRegistration !== undefined ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        before.snapshot.pendingDeliveries.some(
          (delivery) =>
            delivery.recoveryId === settlement.recoveryId &&
            delivery.consumer !== "orchestrator",
        )
      )
        throw new Error("completion_scope_unconfirmed");
      const observed = prepareCoordinatorStateCleanupSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        settlement.dockerTerminal.resources,
        repository.repositoryBinding,
      );
      const observedOperation = observed
        ? decodeCoordinatorStateSnapshot(
            observed,
            repository.repositoryBinding,
          )?.snapshot.operations.find(
            (operation): operation is CoordinatorStateTaskOperation =>
              operation.kind === "docker_task" &&
              operation.recoveryId === settlement.recoveryId,
          )
        : null;
      if (
        !observedOperation ||
        observedOperation.resources.some((resource, index) => {
          const saved = previous.resources[index];
          return (
            !saved ||
            resource.request !== saved.request ||
            resource.dockerId !== saved.dockerId ||
            resource.observation !== saved.observation
          );
        })
      )
        throw new Error("completion_terminal_or_acceptance_unconfirmed");
      const fixedLine = prepareCoordinatorStateHistoryLine(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeCoordinatorHistoryRows(
        read("history.jsonl") ?? Buffer.alloc(0),
      );
      const row = rows?.find(
        (entry) => entry.recoveryId === settlement.recoveryId,
      );
      if (
        !fixedLine ||
        !previous.history?.confirmed ||
        !rows ||
        createHash("sha256").update(fixedLine).digest("hex") !==
          previous.history.lineSha256 ||
        (row !== undefined && !Buffer.from(row.line).equals(fixedLine)) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("completion_history_unconfirmed");
      completionConfirmed = true;
    }
    historyAlreadyConfirmed =
      settlement?.historyPublish === true &&
      currentBytes?.equals(bytes) === true &&
      ![
        ...(current?.snapshot.pendingDeliveries ?? []),
        ...(current?.snapshot.unresolvedRecoveries ?? []),
      ].some((item) => item.recoveryId === settlement.recoveryId) &&
      current?.snapshot.operations.some(
        (operation) =>
          operation.recoveryId === settlement.recoveryId &&
          operation.history?.confirmed === true,
      ) === true;
    const pendingBytes = read("state.pending.json");
    if (
      hostCleanupPublication &&
      (!currentBytes?.equals(hostCleanupPublication.before) ||
        !bytes.equals(hostCleanupPublication.candidate) ||
        !oldMarker?.equals(marker) ||
        (hostCleanupPublication.mode === "B"
          ? !pendingBytes?.equals(bytes)
          : pendingBytes !== null))
    )
      throw new Error("host_cleanup_publication_changed");
    if (pendingBytes !== null && !pendingBytes.equals(bytes))
      throw new Error("other_pending");
    const isInitialRoot =
      currentBytes === null &&
      (taskPublication?.initialBoundary === initial.boundaryIdentity ||
        (initializationOwner !== null &&
          typeof initializationOwner === "object" &&
          initializations.get(initializationOwner)?.repositoryBinding ===
            repository.repositoryBinding &&
          initializations.get(initializationOwner)?.boundaryIdentity ===
            initial.boundaryIdentity &&
          initializations.get(initializationOwner)?.payloadSha256 ===
            candidate.payloadSha256 &&
          initializations.get(initializationOwner)?.publicationIssued ===
            false)) &&
      names.every((name) =>
        ["state.pending.json", "state.lock"].includes(name),
      );
    const isInitialRepairPublication =
      repairPublication?.mode === "initial_publication";
    if (pendingBytes !== null) {
      const pending = decodeCoordinatorStateSnapshot(
        pendingBytes,
        repository.repositoryBinding,
      );
      if (!pending) throw new Error("pending");
      const treatment = classifyCoordinatorSnapshotReentry(
        current
          ? {
              status: "present",
              revision: current.snapshot.revision,
              repositoryBinding: repository.repositoryBinding,
              payloadSha256: current.payloadSha256,
            }
          : { status: "absent" },
        { ...pending.snapshot, payloadSha256: pending.payloadSha256 },
        repository.repositoryBinding,
        isInitialRoot || isInitialRepairPublication ? "new" : "existing",
      );
      if (treatment === "blocked") throw new Error("pending_conflict");
      if (
        treatment === "publish_pending" &&
        !completionConfirmed &&
        !(currentRepair
          ? validateRepairWriteCandidate(
              currentBytes,
              pendingBytes,
              currentRepair.recoveryId,
              currentRepair.purpose,
              repository.repositoryBinding,
            )
          : validateCoordinatorStateTransition(
              currentBytes,
              pendingBytes,
              repository.repositoryBinding,
            ))
      )
        throw new Error("transition");
    } else if (
      !currentBytes?.equals(bytes) &&
      !completionConfirmed &&
      (!(currentRepair
        ? validateRepairWriteCandidate(
            currentBytes,
            bytes,
            currentRepair.recoveryId,
            currentRepair.purpose,
            repository.repositoryBinding,
          )
        : validateCoordinatorStateTransition(
            currentBytes,
            bytes,
            repository.repositoryBinding,
          )) ||
        (currentBytes === null && !isInitialRoot))
    )
      throw new Error("transition");
    if (
      !taskPublication &&
      settlement?.deliveryRegistration === undefined &&
      !currentDelivery &&
      encodeCoordinatorStateValue(current?.snapshot.pendingDeliveries ?? []) !==
        encodeCoordinatorStateValue(candidate.snapshot.pendingDeliveries)
    )
      throw new Error("delivery_owner_required");
    if (settlement && !savedTerminalConfirmed) {
      if (!current) throw new Error("settlement_current_missing");
      if (
        !completionConfirmed &&
        (!current ||
          current.snapshot.operations.length !==
            candidate.snapshot.operations.length ||
          encodeCoordinatorStateValue(current.snapshot.unresolvedRecoveries) !==
            encodeCoordinatorStateValue(
              candidate.snapshot.unresolvedRecoveries,
            ) ||
          (settlement.deliveryRegistration === undefined &&
            current.snapshot.pendingDeliveries.length !==
              candidate.snapshot.pendingDeliveries.length))
      )
        throw new Error("settlement_scope");
      if (settlement.deliveryRegistration !== undefined) {
        const expected = prepareCoordinatorStateResultDeliverySnapshot(
          currentBytes,
          settlement.recoveryId,
          settlement.deliveryRegistration,
          repository.repositoryBinding,
        );
        if (!expected?.equals(bytes))
          throw new Error("settlement_result_registration_invalid");
      }
      for (const previous of current.snapshot.operations) {
        if (previous.kind !== "docker_task") {
          const retained = candidate.snapshot.operations.find(
            (value) => value.recoveryId === previous.recoveryId,
          );
          if (
            encodeCoordinatorStateValue(retained) !==
            encodeCoordinatorStateValue(previous)
          )
            throw new Error("repair_state_changed_by_task_settlement");
          continue;
        }
        const next = candidate.snapshot.operations.find(
          (value): value is CoordinatorStateTaskOperation =>
            value.kind === "docker_task" &&
            value.recoveryId === previous.recoveryId,
        );
        if (!next) {
          if (
            completionConfirmed &&
            previous.recoveryId === settlement.recoveryId
          )
            continue;
          throw new Error("settlement_removal");
        }
        if (previous.recoveryId !== settlement.recoveryId) {
          if (
            encodeCoordinatorStateValue(previous) !==
            encodeCoordinatorStateValue(next)
          )
            throw new Error("settlement_other_operation");
          continue;
        }
        if (
          encodeCoordinatorStateValue(previous.resources) !==
          encodeCoordinatorStateValue(next.resources)
        ) {
          const observedBytes = settlement.dockerTerminal
            ? prepareCoordinatorStateCleanupSnapshot(
                currentBytes,
                settlement.recoveryId,
                settlement.dockerTerminal.resources,
                repository.repositoryBinding,
              )
            : null;
          const observedOperation = observedBytes
            ? decodeCoordinatorStateSnapshot(
                observedBytes,
                repository.repositoryBinding,
              )?.snapshot.operations.find(
                (value): value is CoordinatorStateTaskOperation =>
                  value.kind === "docker_task" &&
                  value.recoveryId === settlement.recoveryId,
              )
            : null;
          if (
            !observedOperation ||
            encodeCoordinatorStateValue(observedOperation.resources) !==
              encodeCoordinatorStateValue(next.resources)
          )
            throw new Error("settlement_resource_observation_invalid");
        }
        const nextPrimaryFailure = encodeCoordinatorStateValue(
          next.primaryFailure,
        );
        if (
          settlement.dockerTerminal
            ? nextPrimaryFailure !==
              encodeCoordinatorStateValue(
                settlement.dockerTerminal.primaryFailure,
              )
            : nextPrimaryFailure !==
              encodeCoordinatorStateValue(previous.primaryFailure)
        )
          throw new Error("settlement_primary_failure_unconfirmed");
        if (
          next.phase === "executing" ||
          next.execution.ownerEffect === "active" ||
          previous.host.currentToken !== next.host.currentToken ||
          previous.host.pendingTransitionJson !==
            next.host.pendingTransitionJson ||
          (next.host.cleanup === "confirmed" && !settlement.cleanupStatus)
        )
          throw new Error("settlement_effect");
        if (
          next.lease !== previous.lease &&
          next.lease === "released" &&
          settlement.dockerTerminal?.homeLeaseReleased !== true
        )
          throw new Error("settlement_lease_observation_invalid");
        if (
          next.outcome?.cleanupConfirmed &&
          (next.host.cleanup !== "confirmed" ||
            next.lease !== "released" ||
            settlement.dockerTerminal?.homeLeaseReleased !== true ||
            settlement.dockerTerminal?.mountLeaseReleased !== true ||
            settlement.dockerTerminal?.recoveryCompleted !== true ||
            !coordinatorTaskResourcesAreSettled(next))
        )
          throw new Error("settlement_cleanup_unconfirmed");
      }
      for (const previous of current.snapshot.pendingDeliveries) {
        if (
          completionConfirmed &&
          previous.recoveryId === settlement.recoveryId
        )
          continue;
        const next = candidate.snapshot.pendingDeliveries.find(
          (value) =>
            value.recoveryId === previous.recoveryId &&
            value.consumer === previous.consumer,
        );
        if (
          !next ||
          (previous.recoveryId !== settlement.recoveryId &&
            encodeCoordinatorStateValue(previous) !==
              encodeCoordinatorStateValue(next))
        )
          throw new Error("settlement_delivery");
      }
    }
    // 保存対象を変更する操作だけを現在のOwnerへ結合する。
    const previousOperations = new Map(
      current?.snapshot.operations.map((operation) => [
        operation.recoveryId,
        operation,
      ]) ?? [],
    );
    for (const operation of candidate.snapshot.operations) {
      const previous = previousOperations.get(operation.recoveryId);
      if (operation.kind !== "docker_task") {
        if (
          (!previous ||
            encodeCoordinatorStateValue(previous) !==
              encodeCoordinatorStateValue(operation)) &&
          currentRepair?.recoveryId !== operation.recoveryId &&
          !(
            repairHistoryScopeConfirmed &&
            currentHistory?.recoveryId === operation.recoveryId
          )
        )
          throw new Error("repair_writer_unconnected");
        continue;
      }
      if (previous && previous.kind !== "docker_task")
        throw new Error("operation_kind_changed");
      for (const resource of operation.resources) {
        const before = previous?.resources.find(
          (value) => value.purpose === resource.purpose,
        );
        if (
          resource.request === "not_issued" &&
          before?.request !== "not_issued" &&
          (!unissued ||
            before?.request !== "intent_saved" ||
            unissued.recoveryId !== operation.recoveryId ||
            unissued.purpose !== resource.purpose ||
            !verifyRuntimeOwnedDockerUnissuedNotice(
              unissued.notice,
              unissued.recoveryCapability,
              managementCapability,
              resource.purpose,
              repository.operationId,
              operation.recoveryId,
            ))
        )
          throw new Error("resource_not_issued_proof_missing");
      }
      if (
        !currentHistory &&
        (((settlement?.historyInitial || settlement?.historyPublish) &&
          operation.recoveryId === settlement.recoveryId) ||
          encodeCoordinatorStateValue(operation.history) !==
            encodeCoordinatorStateValue(previous?.history ?? null))
      ) {
        if (
          (!settlement?.historyInitial && !settlement?.historyPublish) ||
          settlement.recoveryId !== operation.recoveryId ||
          !currentBytes ||
          !previous ||
          !operation.history ||
          (settlement.historyPublish
            ? !operation.history.confirmed || !previous.history
            : operation.history.confirmed || previous.history?.confirmed) ||
          !settlement.cleanupStatus ||
          settlement.dockerTerminal?.homeLeaseReleased !== true ||
          settlement.dockerTerminal.mountLeaseReleased !== true ||
          settlement.dockerTerminal.recoveryCompleted !== true
        )
          throw new Error("history_checkpoint_unconnected");
        const observedBytes = prepareCoordinatorStateCleanupSnapshot(
          currentBytes,
          operation.recoveryId,
          settlement.dockerTerminal.resources,
          repository.repositoryBinding,
        );
        const observedOperation = observedBytes
          ? decodeCoordinatorStateSnapshot(
              observedBytes,
              repository.repositoryBinding,
            )?.snapshot.operations.find(
              (value): value is CoordinatorStateTaskOperation =>
                value.kind === "docker_task" &&
                value.recoveryId === operation.recoveryId,
            )
          : null;
        if (
          !observedOperation ||
          observedOperation.resources.some((value, index) => {
            const saved = previous.resources[index];
            return (
              !saved ||
              value.request !== saved.request ||
              value.dockerId !== saved.dockerId ||
              value.observation !== saved.observation
            );
          })
        )
          throw new Error("history_resource_observation_invalid");
        const expected = prepareCoordinatorStateHistorySnapshot(
          currentBytes,
          operation.recoveryId,
          operation.history.occurredAt,
          settlement.historyPublish === true,
          repository.repositoryBinding,
        );
        if (
          !expected?.equals(bytes) &&
          !(
            settlement.historyPublish &&
            previous.history?.confirmed &&
            currentBytes.equals(bytes)
          )
        )
          throw new Error("history_checkpoint_difference_invalid");
        if (settlement.historyInitial && previous.history === null)
          initialHistoryLine = operation.history.lineSha256;
      }
      if (
        (!previous ||
          encodeCoordinatorStateValue(previous) !==
            encodeCoordinatorStateValue(operation)) &&
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      )
        throw new Error("operation_owner");
    }
    for (const collection of [
      "unresolvedRecoveries",
      "pendingDeliveries",
    ] as const) {
      for (const item of candidate.snapshot[collection]) {
        const previous = current?.snapshot[collection].find(
          (value) =>
            value.operationNonce === item.operationNonce &&
            (collection !== "pendingDeliveries" ||
              ("consumer" in value &&
                "consumer" in item &&
                value.consumer === item.consumer)),
        );
        if (
          !previous ||
          encodeCoordinatorStateValue(previous) !==
            encodeCoordinatorStateValue(item)
        ) {
          const operation = candidate.snapshot.operations.find(
            (value): value is CoordinatorStateTaskOperation =>
              value.kind === "docker_task" &&
              value.recoveryId === item.recoveryId,
          );
          if (
            !operation ||
            JSON.parse(operation.identityJson).operationId !==
              repository.operationId
          )
            throw new Error("reference_owner");
        }
      }
    }
    if (
      settlement &&
      ((settlement.historyPublish && !historyAlreadyConfirmed) ||
        currentHistory?.stage === "publish")
    ) {
      if (!currentBytes || !current) throw new Error("history_current_missing");
      const line = (
        currentHistory?.operationKind === "runtime_repair"
          ? prepareCoordinatorRepairHistoryLine
          : prepareCoordinatorStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const target = current.snapshot.operations.find(
        (value) =>
          value.kind === (currentHistory?.operationKind ?? "docker_task") &&
          value.recoveryId === settlement.recoveryId,
      );
      if (!line || !target?.history) throw new Error("history_unfixed");
      const priorHistory = read("history.jsonl");
      const before = priorHistory ?? Buffer.alloc(0);
      const rows = decodeCoordinatorHistoryRows(before);
      if (!rows) throw new Error("history_invalid");
      const sameRow = rows.find(
        (row) => row.recoveryId === settlement.recoveryId,
      );
      if (sameRow && !Buffer.from(sameRow.line).equals(line))
        throw new Error("history_row_conflict");
      const owner = settlement.managementCapability;
      const admission =
        owner && typeof owner === "object"
          ? historyAttempts.get(owner)?.get(settlement.recoveryId)
          : null;
      const pendingHistory = read("history.pending.jsonl");
      if (!sameRow && target.history.confirmed)
        throw new Error("history_confirmed_row_absent");
      if (!sameRow && !admission && !currentHistory)
        throw new Error("history_initial_proof_missing");
      if (admission && admission.lineSha256 !== target.history.lineSha256)
        throw new Error("history_proof_conflict");
      const configuration = readCoordinatorConfig(verified.capability);
      if (configuration.status !== "ready")
        throw new Error("history_config_invalid");
      const days = configuration.config.historyRetentionDays;
      const now = currentHistory
        ? target.history.occurredAt
        : (admission?.pending?.now ?? new Date().toISOString());
      let after: Buffer;
      if (currentHistory) {
        const publication = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareCoordinatorRepairHistoryPublication
            : prepareCoordinatorRecoveredHistoryPublication
        )(
          currentBytes,
          settlement.recoveryId,
          before,
          pendingHistory,
          days,
          repository.repositoryBinding,
        );
        if (
          !publication?.snapshotBytes.equals(bytes) ||
          currentHistory.assertOwner() !== true
        )
          throw new Error("current_history_publication_invalid");
        after = publication.historyBytes;
        if (pendingHistory === null && !before.equals(after))
          create("history.pending.jsonl", after);
      } else if (pendingHistory !== null) {
        const binding = admission?.pending;
        const originalIdentity = fileIdentities.get("history.jsonl") ?? null;
        if (
          !binding?.before.equals(before) ||
          !binding.after.equals(pendingHistory) ||
          binding.retentionDays !== days ||
          (binding.beforeIdentity === null
            ? originalIdentity !== null
            : !originalIdentity ||
              !sameStableFileIdentity(binding.beforeIdentity, originalIdentity))
        )
          throw new Error("history_pending_unbound");
        after = binding.after;
      } else {
        if (!sameRow && admission?.issued)
          throw new Error("history_prior_attempt_unknown");
        const joined = sameRow ? before : Buffer.concat([before, line]);
        const retained = prepareCoordinatorHistoryRetention(
          currentBytes,
          joined,
          now,
          days,
          repository.repositoryBinding,
        );
        if (!retained) throw new Error("history_retention_invalid");
        after = retained;
        if (admission) {
          admission.pending = {
            before,
            after,
            beforeIdentity: fileIdentities.get("history.jsonl") ?? null,
            stateCandidate: bytes,
            retentionDays: days,
            now,
          };
          admission.issued = true;
        }
        if (!before.equals(after)) create("history.pending.jsonl", after);
      }
      if (!before.equals(after)) {
        if (
          !read("history.pending.jsonl")?.equals(after) ||
          !(read("history.jsonl") ?? Buffer.alloc(0)).equals(before) ||
          !read("state.json")?.equals(currentBytes)
        )
          throw new Error("history_changed");
        const freshConfig = readCoordinatorConfig(verified.capability);
        if (
          freshConfig.status !== "ready" ||
          freshConfig.config.historyRetentionDays !== days
        )
          throw new Error("history_config_changed");
        assertBoundary();
        const historyFd = fs.openSync(
          path.join(directory, "history.pending.jsonl"),
          "r+",
        );
        try {
          const expected = fileIdentities.get("history.pending.jsonl");
          if (
            !expected ||
            !sameStableFileIdentity(
              expected,
              fs.fstatSync(historyFd, { bigint: true }),
            )
          )
            throw new Error("history_pending_replaced");
          filesystemEffectIssued = true;
          fs.fsyncSync(historyFd);
        } finally {
          fs.closeSync(historyFd);
        }
        if (!read("history.pending.jsonl")?.equals(after))
          throw new Error("history_pending_changed");
        assertBoundary();
        filesystemEffectIssued = true;
        const pendingIdentity = fileIdentities.get("history.pending.jsonl");
        fs.renameSync(
          path.join(directory, "history.pending.jsonl"),
          path.join(directory, "history.jsonl"),
        );
        fileIdentities.delete("history.pending.jsonl");
        fileIdentities.delete("history.jsonl");
        const saved = read("history.jsonl");
        const savedIdentity = fileIdentities.get("history.jsonl");
        if (
          !saved?.equals(after) ||
          !pendingIdentity ||
          !savedIdentity ||
          pendingIdentity.dev !== savedIdentity.dev ||
          pendingIdentity.ino !== savedIdentity.ino
        )
          throw new Error("history_publication_unconfirmed");
      } else if (currentHistory && pendingHistory !== null) {
        if (
          !read("history.pending.jsonl")?.equals(after) ||
          !read("history.jsonl")?.equals(before) ||
          !read("state.json")?.equals(currentBytes)
        )
          throw new Error("current_history_pending_changed");
        assertBoundary();
        filesystemEffectIssued = true;
        fs.unlinkSync(path.join(directory, "history.pending.jsonl"));
        fileIdentities.delete("history.pending.jsonl");
      }
      const historyIdentity = fileIdentities.get("history.jsonl");
      const canonicalHistoryFd = fs.openSync(
        path.join(directory, "history.jsonl"),
        "r+",
      );
      try {
        if (
          !historyIdentity ||
          !sameStableFileIdentity(
            historyIdentity,
            fs.fstatSync(canonicalHistoryFd, { bigint: true }),
          )
        )
          throw new Error("history_canonical_replaced");
        assertBoundary();
        filesystemEffectIssued = true;
        fs.fsyncSync(canonicalHistoryFd);
      } finally {
        fs.closeSync(canonicalHistoryFd);
      }
      const savedRows = decodeCoordinatorHistoryRows(read("history.jsonl"));
      if (
        !savedRows?.some(
          (row) =>
            row.recoveryId === settlement.recoveryId &&
            Buffer.from(row.line).equals(line),
        ) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("history_readback_unconfirmed");
    }
    if (oldMarker === null) create("state.lock", marker);
    if (!currentBytes?.equals(bytes)) {
      if (pendingBytes === null) {
        try {
          create("state.pending.json", bytes);
        } catch (error) {
          // Task保存でpendingを作れなかった場合だけ、自分のmarkerを戻す。
          // 部分作成・既存marker・元本文差・観測不能では残存を保持する。
          if (
            taskPublication &&
            oldMarker === null &&
            read("state.pending.json") === null &&
            read("history.pending.jsonl") === null &&
            read("state.lock")?.equals(marker) &&
            (currentBytes === null
              ? read("state.json") === null
              : read("state.json")?.equals(currentBytes))
          ) {
            assertBoundary();
            if (
              read("state.pending.json") !== null ||
              read("history.pending.jsonl") !== null ||
              !read("state.lock")?.equals(marker) ||
              (currentBytes === null
                ? read("state.json") !== null
                : !read("state.json")?.equals(currentBytes))
            )
              throw error;
            fs.unlinkSync(path.join(directory, "state.lock"));
            fileIdentities.delete("state.lock");
            if (
              read("state.lock") !== null ||
              read("state.pending.json") !== null ||
              read("history.pending.jsonl") !== null ||
              (currentBytes === null
                ? read("state.json") !== null
                : !read("state.json")?.equals(currentBytes))
            )
              throw new Error("failed_task_marker_cleanup_unconfirmed");
            assertBoundary();
          }
          throw error;
        }
      }
      const samePending = read("state.pending.json");
      const sameCurrent = read("state.json");
      if (
        !samePending?.equals(bytes) ||
        (currentBytes === null
          ? sameCurrent !== null
          : !sameCurrent?.equals(currentBytes))
      )
        throw new Error("changed");
      assertBoundary();
      const fd = fs.openSync(path.join(directory, "state.pending.json"), "r+");
      try {
        const expected = fileIdentities.get("state.pending.json");
        if (
          !expected ||
          !sameStableFileIdentity(expected, fs.fstatSync(fd, { bigint: true }))
        )
          throw new Error("pending_replaced");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (!read("state.pending.json")?.equals(bytes))
        throw new Error("pending_changed");
      const target = read("state.json");
      if (
        currentBytes === null ? target !== null : !target?.equals(currentBytes)
      )
        throw new Error("target_changed");
      filesystemEffectIssued = true;
      const publishedIdentity = fileIdentities.get("state.pending.json");
      if (
        initializationOwner !== null &&
        typeof initializationOwner === "object"
      ) {
        const proof = initializations.get(initializationOwner);
        if (proof) proof.publicationIssued = true;
      }
      fs.renameSync(
        path.join(directory, "state.pending.json"),
        path.join(directory, "state.json"),
      );
      fileIdentities.delete("state.json");
      fileIdentities.delete("state.pending.json");
      currentBytes = read("state.json");
      const published = fileIdentities.get("state.json");
      if (
        !publishedIdentity ||
        !published ||
        published.dev !== publishedIdentity.dev ||
        published.ino !== publishedIdentity.ino
      )
        throw new Error("published_replaced");
      current =
        currentBytes === null
          ? null
          : decodeCoordinatorStateSnapshot(
              currentBytes,
              repository.repositoryBinding,
            );
    } else if (pendingBytes !== null) {
      if (
        !read("state.pending.json")?.equals(bytes) ||
        !read("state.json")?.equals(bytes)
      )
        throw new Error("changed");
      assertBoundary();
      filesystemEffectIssued = true;
      fs.unlinkSync(path.join(directory, "state.pending.json"));
      fileIdentities.delete("state.pending.json");
    }
    if (
      !currentBytes?.equals(bytes) ||
      !current ||
      read("state.pending.json") !== null
    )
      throw new Error("final");
    if (
      settlement &&
      ((settlement.historyPublish && !historyAlreadyConfirmed) ||
        currentHistory?.stage === "publish")
    ) {
      const finalLine = (
        currentHistory?.operationKind === "runtime_repair"
          ? prepareCoordinatorRepairHistoryLine
          : prepareCoordinatorStateHistoryLine
      )(bytes, settlement.recoveryId, repository.repositoryBinding);
      const finalRows = decodeCoordinatorHistoryRows(read("history.jsonl"));
      if (
        !finalLine ||
        !finalRows?.some(
          (row) =>
            row.recoveryId === settlement.recoveryId &&
            Buffer.from(row.line).equals(finalLine),
        ) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("history_final_readback_unconfirmed");
    }
    if (currentDelivery) {
      const history = read("history.jsonl");
      if (
        currentDelivery.historyFile === null
          ? history !== null
          : !history?.equals(currentDelivery.historyFile.bytes)
      )
        throw new Error("current_delivery_history_changed");
    }
    if (currentCompletion) {
      const history = read("history.jsonl");
      if (
        currentCompletion.historyFile === null
          ? history !== null
          : !history?.equals(currentCompletion.historyFile.bytes)
      )
        throw new Error("current_completion_history_changed");
    }
    // 排他markerは完了時に回収する。履歴やoperation記録を削除しない。
    if (!read("state.lock")?.equals(marker)) throw new Error("marker");
    assertBoundary();
    filesystemEffectIssued = true;
    fs.unlinkSync(path.join(directory, "state.lock"));
    fileIdentities.delete("state.lock");
    if (read("state.lock") !== null || !read("state.json")?.equals(bytes))
      throw new Error("final");
    snapshotConfirmed = true;
    if (initializationOwner !== null && typeof initializationOwner === "object")
      initializations.delete(initializationOwner);
    reason = "coordinator_state_snapshot_confirmed";
  } catch {
    reason = "coordinator_state_storage_unconfirmed";
  }
  return {
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  };
}

/**
 * 保存準備・Owned確定・排他解放を既存Writer入口で結合する。
 * @responsibility 保存確認と解放確認の両方が揃った場合だけ完了を返す。
 * @trace ARCH-000008
 * @input input: 既存の操作Owner、固定候補と用途別保存入力。
 * @returns 保存Effect・Snapshot確認・解放確認を分離した結果。
 * @precondition 外側の用途別入口が既存の借用を検証する。
 * @postcondition 取得済みContextを一度だけ確定し、解放失敗を成功へ畳まない。
 * @effect 既存短期排他と固定保存FileのI/O。
 * @failure 取得前・保存途中・解放失敗は既存のblocked結果。
 * @invariant 新しい保存方式・Authority・第三Writerを追加しない。
 * @boundary 保存公開Wrapperと私有確定処理。
 * @security 任意Pathや外部callbackを受け付けない。
 * @concurrency 短期排他の取得と解放をこの入口が所有する。
 */
function writeCoordinatorStateSnapshot(
  ...input: Parameters<typeof prepareCoordinatorStateWrite>
) {
  const prepared = prepareCoordinatorStateWrite(...input);
  if (!("lock" in prepared)) return prepared;
  const { storageOwner, initializationOwner, settlement, attempt } = prepared;
  let {
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  } = commitCoordinatorStateSnapshotOwned(prepared);
  let lockReleased = false;
  try {
    lockReleased = storageOwner.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) {
    if (initializationOwner !== null && typeof initializationOwner === "object")
      initializations.delete(initializationOwner);
    reason = "coordinator_state_lock_release_unconfirmed";
  }
  if (
    snapshotConfirmed &&
    lockReleased &&
    initialHistoryLine &&
    settlement?.managementCapability &&
    typeof settlement.managementCapability === "object"
  ) {
    let attempts = historyAttempts.get(settlement.managementCapability);
    if (!attempts) {
      attempts = new Map();
      historyAttempts.set(settlement.managementCapability, attempts);
    }
    if (!attempts.has(settlement.recoveryId))
      attempts.set(settlement.recoveryId, {
        lineSha256: initialHistoryLine,
        issued: false,
        pending: null,
      });
  }
  return Object.freeze({
    ...attempt,
    status: snapshotConfirmed && lockReleased ? "completed" : "blocked",
    reason,
    filesystemEffectIssued,
    snapshotConfirmed,
    lockReleased,
  });
}

/**
 * 同じ操作の指定checkpointを既存Writerで確定する。
 *
 * @responsibility 短期読取り、exact操作照合、次版構築と元版照合保存を一つの呼出しへ接続する。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner。recoveryId: exact回復参照。resourceValue: 現在評価。kind: 資源・全回収・Host・実行終端・参照集合の固定種別。
 * @returns 保存結果。snapshotConfirmedとlockReleasedを独立して保持する。
 * @precondition 呼出し側が観測と要求発行事実を取得し、初回Snapshotを確定済みである。
 * @postcondition 同じ操作の資源更新だけを保存し、失敗時は既発行Effectを未発行に戻さない。
 * @effect 固定Snapshotの読取りと既存Writerの短命保存だけ。Docker要求は発行しない。
 * @failure Owner、本文、遷移、改訂競合または排他終了不明はblockedを返す。
 * @invariant 古い候補の盲目的な再試行、二重書込み、旧Directory記録へのfallbackを行わない。
 * @boundary 操作OwnerとRepository-local現在状態。
 * @security 他操作の回復参照やPathを新しい操作Authorityにしない。
 * @concurrency 読取りLockを解放してからWriterを呼び、保存Lock内で元版を再照合する。
 */
function checkpointRuntimeOwnedCoordinatorValue(
  managementCapability: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  kind:
    | "resource"
    | "cleanup"
    | "host"
    | "lifecycle"
    | "references"
    | "restart",
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const blocked = Object.freeze({
    status: "blocked" as const,
    reason:
      current.status === "blocked"
        ? current.reason
        : "coordinator_state_input_invalid",
    revision: null,
    payloadSha256: null,
    recoveryIds: Object.freeze([] as string[]),
    filesystemEffectIssued: false,
    snapshotConfirmed: false,
    lockReleased: current.lockReleased,
  });
  if (
    !repository ||
    current.status !== "completed" ||
    !current.value ||
    !repository.revalidate()
  )
    return blocked;
  const operation = current.value.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  if (
    !operation ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return blocked;
  const currentBytes = Buffer.from(
    `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
  );
  const prepare = {
    resource: prepareCoordinatorStateResourceSnapshot,
    cleanup: prepareCoordinatorStateCleanupSnapshot,
    host: prepareCoordinatorStateHostSnapshot,
    lifecycle: prepareCoordinatorStateLifecycleSnapshot,
    references: prepareCoordinatorStateReferencesSnapshot,
    restart: prepareCoordinatorStateRestartSnapshot,
  }[kind];
  const next = prepare(
    currentBytes,
    recoveryId,
    resourceValue,
    repository.repositoryBinding,
  );
  if (!next) return blocked;
  if (kind === "references") {
    const candidate = decodeCoordinatorStateSnapshot(
      next,
      repository.repositoryBinding,
    );
    if (
      !candidate ||
      encodeCoordinatorStateValue(candidate.snapshot.pendingDeliveries) !==
        encodeCoordinatorStateValue(current.value.snapshot.pendingDeliveries)
    )
      return blocked;
  }
  return writeRuntimeOwnedCoordinatorStateSnapshot(managementCapability, next);
}

/**
 * 同じ操作の単一再起動要求を既存Writerへ保存する。
 * @responsibility 元操作・Repository・改訂と要求相関を照合する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId、checkpoint: 元Ownerと固定評価。
 * @returns 保存確定、元版相関、排他解放を区別した結果。
 * @precondition 現在許可とHost-wide排他は再起動Ownerが保持する。
 * @postcondition 他操作と元Taskの一次失敗・結果を保持する。
 * @effect Repository内現在状態の読取りと既存Writerへの保存。
 * @failure 別Owner・別要求・不正遷移・保存不明はblocked。
 * @invariant この保存入口はDocker要求やHost排他を発行しない。
 * @boundary 再起動OwnerとRepository-local現在状態。
 * @security 保存値を実行許可や元要求の受付証明にしない。
 * @concurrency 更新Writerの短期排他と元版照合だけを使用する。
 */
export function checkpointRuntimeOwnedCoordinatorRestart(
  managementCapability: unknown,
  recoveryId: unknown,
  checkpoint: unknown,
) {
  return checkpointRuntimeOwnedCoordinatorValue(
    managementCapability,
    recoveryId,
    checkpoint,
    "restart",
  );
}

/**
 * 同じ再起動Ownerの固定対象だけを既存現在状態Writerへ保存する。
 * @responsibility Root ReaderをWriterへ昇格せず、既存準備Ownerの現在排他と元版を再確認する。
 * @trace ARCH-000008
 * @input repository: 準備Ownerの固定Repository・操作結合、recoveryId: exact対象、before: 元版、checkpoint: 同要求の次値、assertOwner: 同要求Ownerの同期確認。
 * @returns 保存・読戻し・排他解放を分けた既存結果。
 * @precondition Package内部の再起動準備Mapだけが固定引数と確認closureを結合する。通常は保持中排他、終端は同じclosed Ownerの一回試行へ限定し、Root実体を同期確認する。状態Lockを再取得しない。
 * @postcondition 対象の再起動欄以外を変更せず、保存不明を要求発行許可にしない。
 * @effect 同じRepositoryの固定現在状態の読取り・短命Writer・読戻しだけ。
 * @failure Owner失効、別操作、元版競合、不正遷移または排他終了不明は停止する。
 * @invariant Root Capabilityや保存JSONだけから書込みOwnerを生成しない。
 * @boundary 不透明な再起動準備OwnerとRepository-local現在状態。
 * @security Root公開入口・任意Path・新しいAuthorityを追加しない。
 * @concurrency 通常更新は保持中排他、終端更新は解放済み同Ownerの一回性を確認し、どちらも既存の短期状態排他だけを使う。
 */
export function writeRuntimeOwnedCoordinatorRestartCheckpoint(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  before: Buffer,
  checkpoint: unknown,
  assertOwner: () => boolean,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return blocked();
    const current = readCoordinatorStateSnapshot(repository, recoveryId);
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased
    )
      return Object.freeze({
        ...blocked(),
        reason:
          current.status === "blocked"
            ? current.reason
            : "coordinator_state_read_unconfirmed",
        lockReleased: current.lockReleased,
      });
    const bytes = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !Buffer.isBuffer(before) ||
      !bytes.equals(before) ||
      !operation ||
      JSON.parse(operation.identityJson).operationId !==
        repository.operationId ||
      assertOwner() !== true
    )
      return blocked();
    const candidate = prepareCoordinatorStateRestartSnapshot(
      bytes,
      recoveryId,
      checkpoint,
      repository.repositoryBinding,
    );
    if (!candidate) return blocked();
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: () => assertOwner() === true && repository.revalidate(),
      },
      candidate,
      null,
    );
  } catch {
    return blocked();
  }
}

/**
 * 全解放済みの同じ回収Ownerが、固定終了結果だけを保存する。
 * @responsibility 既知資源終了・Host清掃と元版を照合し、元結果と一次失敗を保つ。
 * @trace ARCH-000008
 * @input repository、recoveryId、before: 私有Ownerの固定結合。assertOwner: 解放済みOwnerの一回試行確認。
 * @returns 既存Writerの保存・読戻し・短期排他解放結果。
 * @precondition 呼出し側がHost両不存在と外側排他の全解放を確認済み。
 * @postcondition 結果欠測だけ固定blockedへ閉じ、履歴・配送と他操作は変更しない。
 * @effect Repository-localの固定現在状態保存だけ。
 * @failure 不明資源・Host未確定・生存Owner・元版差・保存不明は拒否する。
 * @invariant 清掃成功をTask成功へ変えず、一次診断を合成しない。
 * @boundary 私有回収Ownerと既存物理Writer。
 * @security 保存JSONから処置Authorityを発行しない。
 * @concurrency 解放済みOwnerの一回性と短期Writerによる元版CASを共同使用する。
 */
export function writeRuntimeOwnedCoordinatorRecoveryTerminal(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  before: Buffer,
  assertOwner: () => boolean,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return blocked();
    let current = readCoordinatorStateSnapshot(repository, recoveryId);
    if (current.status !== "completed" && current.lockReleased)
      current = readCoordinatorStateSnapshot(
        repository,
        recoveryId,
        null,
        recoveryId,
      );
    if (current.status !== "completed" && current.lockReleased)
      current = readCoordinatorStateSnapshot(
        repository,
        recoveryId,
        null,
        null,
        recoveryId,
      );
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased
    )
      return Object.freeze({
        ...blocked(),
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    const bytes = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !Buffer.isBuffer(before) ||
      !bytes.equals(before) ||
      !operation ||
      JSON.parse(operation.identityJson).operationId !==
        repository.operationId ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.execution.ownerEffect !== "disabled" ||
      operation.phase === "awaiting_delivery" ||
      !coordinatorTaskResourcesAreSettled(operation) ||
      !isDockerRestartCheckpointSettled(operation.dockerRestart) ||
      assertOwner() !== true
    )
      return blocked();
    if (
      operation.lease === "released" &&
      operation.outcome?.cleanupConfirmed === true
    )
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_snapshot_confirmed",
        revision: current.value.snapshot.revision,
        payloadSha256: current.value.payloadSha256,
        recoveryIds: Object.freeze([recoveryId]),
        snapshotConfirmed: true,
        lockReleased: true,
        filesystemEffectIssued: false,
      });
    const candidate = prepareCoordinatorStateLifecycleSnapshot(
      bytes,
      recoveryId,
      {
        phase: "settling",
        lease: "released",
        execution: operation.execution,
        primaryFailure: operation.primaryFailure,
        outcome:
          operation.outcome === null
            ? {
                status: "blocked",
                reason: "docker_process_controller_execution_failed_closed",
                cleanupConfirmed: true,
              }
            : { ...operation.outcome, cleanupConfirmed: true },
        summarySha256: operation.summarySha256,
      },
      repository.repositoryBinding,
    );
    if (!candidate) return blocked();
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: () => assertOwner() === true && repository.revalidate(),
      },
      candidate,
      null,
    );
  } catch {
    return blocked();
  }
}

/**
 * 保持中の回収Ownerが固定した途中checkpointだけを既存Writerへ保存する。
 * @responsibility exact操作・元本文・保持確認と更新欄を共同照合する。
 * @trace ARCH-000008
 * @input repository、recoveryId、before: 私有Ownerの固定結合。kind、value: 固定途中評価。assertOwner: 同じOwnerの保持確認。
 * @returns 既存Writerの保存・読戻し・排他解放結果。
 * @precondition package内部の回収OwnerがHost世代・Home・Runtime排他を保持する。
 * @postcondition 他操作、一次失敗、確定結果と配送集合を保持する。
 * @effect 同じRepositoryの固定state更新だけ。Docker／Host処置なし。
 * @failure 不正Owner、元版差、不正遷移、Host終端・Lease解放・新完了結果の要求は拒否する。
 * @invariant marker存続中の途中保存と、削除後の真正終端保存を混同しない。
 * @boundary 私有回収Ownerと既存Repository-local Writer。
 * @security Root Reader、任意candidate、旧managementからWriterを復元しない。
 * @concurrency Writer内でも既存排他・元版を再確認する。
 */
export function writeRuntimeOwnedCoordinatorRecoveryCheckpoint(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  before: Buffer,
  kind: "resource" | "cleanup" | "host" | "lifecycle",
  value: unknown,
  assertOwner: () => boolean,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  try {
    if (typeof assertOwner !== "function" || assertOwner() !== true)
      return blocked();
    const current = readCoordinatorStateSnapshot(repository, recoveryId);
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased
    )
      return Object.freeze({
        ...blocked(),
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    const bytes = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !Buffer.isBuffer(before) ||
      !bytes.equals(before) ||
      !operation ||
      JSON.parse(operation.identityJson).operationId !==
        repository.operationId ||
      !assertOwner()
    )
      return blocked();
    const update = JSON.parse(encodeCoordinatorStateValue(value));
    if (kind === "host" && update.cleanup === "confirmed") return blocked();
    if (
      kind === "host" &&
      update.currentToken !== operation.host.currentToken
    ) {
      const pending =
        operation.host.pendingTransitionJson === null
          ? null
          : JSON.parse(operation.host.pendingTransitionJson);
      if (
        !pending ||
        pending.currentToken !== operation.host.currentToken ||
        pending.currentState !== "docker_submission_started" ||
        pending.nextState !== "docker_absent_confirmed" ||
        update.currentToken !== pending.expectedToken ||
        update.pendingTransitionJson !== null ||
        update.cleanup !== operation.host.cleanup ||
        operation.execution.ownerEffect !== "disabled" ||
        !coordinatorTaskResourcesAreSettled(operation)
      )
        return blocked();
    }
    if (
      kind === "lifecycle" &&
      (update.lease !== operation.lease ||
        encodeCoordinatorStateValue(update.outcome) !==
          encodeCoordinatorStateValue(operation.outcome) ||
        update.summarySha256 !== operation.summarySha256)
    )
      return blocked();
    const prepare =
      kind === "resource"
        ? prepareCoordinatorStateResourceSnapshot
        : kind === "cleanup"
          ? prepareCoordinatorStateCleanupSnapshot
          : kind === "host"
            ? prepareCoordinatorStateHostSnapshot
            : kind === "lifecycle"
              ? prepareCoordinatorStateLifecycleSnapshot
              : null;
    const candidate = prepare?.(
      bytes,
      recoveryId,
      update,
      repository.repositoryBinding,
    );
    if (!candidate) return blocked();
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: () => assertOwner() === true && repository.revalidate(),
      },
      candidate,
      null,
    );
  } catch {
    return blocked();
  }
}

/**
 * 物理清掃後のHost一欄だけを現在状態へ確定する。
 * @responsibility 保持中世代と現在不存在の確認を、元版一致と固定差分へ結合する。
 * @trace ARCH-000008
 * @input repository、recoveryId、before: 私有回収Ownerの固定値。assertAbsentOwner: 同Ownerと両不存在の同期確認。
 * @returns 既存Writerの保存・全読戻し・短命排他解放結果。
 * @precondition 同じHost／Home／Runtime排他を保持し、物理清掃は確認済みである。
 * @postcondition Host cleanupだけをpending／unknownからconfirmedへ変更する。
 * @effect 同じstate.jsonの固定更新だけ。資源処置なし。
 * @failure 元版差、別操作、Owner不明、未終端資源またはpending遷移は拒否する。
 * @invariant 一次失敗、元結果、Lease、資源、配送と履歴を保持する。
 * @boundary 清掃後の私有回収Ownerと既存状態Writer。
 * @security 任意本文や任意処置を受け取らず、一般checkpointの制限を緩めない。
 * @concurrency 更新排他下でも同じOwnerと不存在を再確認する。
 */
export function writeRuntimeOwnedCoordinatorRecoveredHostCleanup(
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string },
  recoveryId: string,
  before: Buffer,
  assertAbsentOwner: () => boolean,
  publication: ReturnType<
    typeof readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot
  >["hostCleanupPublication"] = null,
) {
  const blocked = () => writeCoordinatorStateSnapshot(null, null, null, null);
  try {
    if (typeof assertAbsentOwner !== "function" || assertAbsentOwner() !== true)
      return blocked();
    const current = readCoordinatorStateSnapshot(
      repository,
      recoveryId,
      publication ? recoveryId : null,
    );
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased
    )
      return Object.freeze({
        ...blocked(),
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    const bytes = Buffer.from(
      `${encodeCoordinatorStateValue(current.value.snapshot)}\n`,
    );
    const operation = current.value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      publication &&
      (!current.hostCleanupPublication ||
        current.hostCleanupPublication.mode !== publication.mode ||
        !current.hostCleanupPublication.before.equals(publication.before) ||
        !current.hostCleanupPublication.candidate.equals(publication.candidate))
    )
      return blocked();
    if (
      !Buffer.isBuffer(before) ||
      !bytes.equals(before) ||
      !operation ||
      JSON.parse(operation.identityJson).operationId !==
        repository.operationId ||
      !(operation.host.cleanup === "confirmed"
        ? publication?.mode === "C"
        : ["pending", "unknown"].includes(operation.host.cleanup)) ||
      operation.host.pendingTransitionJson !== null ||
      operation.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation) ||
      assertAbsentOwner() !== true
    )
      return blocked();
    const candidate =
      operation.host.cleanup === "confirmed"
        ? bytes
        : prepareCoordinatorStateHostSnapshot(
            bytes,
            recoveryId,
            { ...operation.host, cleanup: "confirmed" },
            repository.repositoryBinding,
          );
    if (
      !candidate ||
      (publication &&
        (!publication.before.equals(bytes) ||
          !publication.candidate.equals(candidate)))
    )
      return blocked();
    return writeCoordinatorStateSnapshot(
      null,
      {
        ...repository,
        revalidate: () =>
          assertAbsentOwner() === true && repository.revalidate(),
      },
      candidate,
      null,
      undefined,
      publication ?? undefined,
    );
  } catch {
    return blocked();
  }
}

/**
 * 一資源の現在評価を同じ操作へ保存する。
 *
 * @responsibility 要求・応答checkpointを現在Ownerと元版へ結合する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner。recoveryId: exact参照。resourceValue: 一資源評価。
 * @returns 保存確定、排他解放とFilesystem Effectを区別した結果。
 * @precondition 初回Snapshotが確定し、評価は実行境界から取得している。
 * @postcondition 同じ操作・資源だけを次版へ保存する。
 * @effect Repository-local現在状態の短期読取りと固定Writerへの保存。
 * @failure 結合、遷移、元版または排他不明はblocked。
 * @invariant 競合時に盲目的な再試行や旧保存fallbackを行わない。
 * @boundary 実行Ownerと現在状態Writer。
 * @security 保存値だけからAuthorityや実不存在を推定しない。
 * @concurrency 短期読取り排他を解放し、Writer排他下で元版を再確認する。
 */
export function checkpointRuntimeOwnedCoordinatorResource(
  managementCapability: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
) {
  return checkpointRuntimeOwnedCoordinatorValue(
    managementCapability,
    recoveryId,
    resourceValue,
    "resource",
  );
}

/**
 * 五資源の回収観測を一つのSnapshot改訂で保存する。
 *
 * @responsibility 資源間で改訂を分割せず、exact相関と元版照合を同じWriterへ接続する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner。recoveryId: exact参照。observations: 固定五資源結果。
 * @returns 保存確定、排他解放とFilesystem Effectを区別した結果。
 * @precondition 本番回収Ownerが現在の観測を取得し、元Snapshotを確定している。
 * @postcondition 全五資源の評価が一つの次版へ保存されるか、拒否される。
 * @effect 固定state.jsonへの既存Writer処理だけ。Docker要求は発行しない。
 * @failure 欠測、別操作、別ID、遷移・改訂競合または排他不明はblocked。
 * @invariant ID未確定の不存在を通常回収成功へ昇格しない。
 * @boundary 回収OwnerとRepository-local保存。
 * @security 資源観測をAuthority発行や履歴の成功書換えへ利用しない。
 * @concurrency 読取りと保存の間の競合は元版照合で拒否し、再試行しない。
 */
export function checkpointRuntimeOwnedCoordinatorCleanup(
  managementCapability: unknown,
  recoveryId: unknown,
  observations: unknown,
) {
  return checkpointRuntimeOwnedCoordinatorValue(
    managementCapability,
    recoveryId,
    observations,
    "cleanup",
  );
}

/**
 * Hostの処置前記録と観測済み世代を現在状態へ保存する。
 *
 * @responsibility 既存Host Ownerの評価を現在操作と元版へ結合する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner。recoveryId: exact参照。hostValue: Host現在評価。
 * @returns 保存確定、排他解放とFilesystem Effectを区別した結果。
 * @precondition Host実体と処置結果は既存Host Ownerが確認している。
 * @postcondition 同じ操作のHostだけを次版へ保存し、他操作・資源・結果を保持する。
 * @effect 既存Snapshot Writerの固定File更新だけ。Host処置は発行しない。
 * @failure 結合、lineage、元版または排他不明はblocked。
 * @invariant 処置前記録を省略した世代変更、意図だけからの完了推定を行わない。
 * @boundary Host OwnerとRepository-local現在状態。
 * @security 保存Tokenを新しい処置Authorityへ変換しない。
 * @concurrency Writer排他下で元版を再確認し、古い候補を再試行しない。
 */
export function checkpointRuntimeOwnedCoordinatorHost(
  managementCapability: unknown,
  recoveryId: unknown,
  hostValue: unknown,
) {
  return checkpointRuntimeOwnedCoordinatorValue(
    managementCapability,
    recoveryId,
    hostValue,
    "host",
  );
}

/**
 * 実行と終端評価を同じ操作の現在状態へ保存する。
 *
 * @responsibility Lease・Effect・一次失敗・最終結果の現在評価を同じWriterへ接続する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner。recoveryId: exact参照。lifecycleValue: 固定六fieldの現在評価。
 * @returns 保存確定・排他解放・Filesystem Effectを区別した結果。
 * @precondition 評価は実行、Leaseと結果搬送の各Ownerが確認している。
 * @postcondition 固定情報、資源・Hostを保持し、不許可更新は保存しない。
 * @effect 固定Snapshot Writerの現在状態更新だけ。ProviderやLeaseの操作は行わない。
 * @failure 未評価field、不正遷移、元版・Ownerまたは排他不明はblocked。
 * @invariant 後続回収は一次失敗を上書きせず、unknownを未発行へ丸めない。
 * @boundary 実行OwnerとRepository-local現在状態。
 * @security 保存確定を実終端やAuthority失効の証明へ昇格しない。
 * @concurrency 短期排他と元版照合を共用し、古い候補を再試行しない。
 */
export function checkpointRuntimeOwnedCoordinatorLifecycle(
  managementCapability: unknown,
  recoveryId: unknown,
  lifecycleValue: unknown,
) {
  return checkpointRuntimeOwnedCoordinatorValue(
    managementCapability,
    recoveryId,
    lifecycleValue,
    "lifecycle",
  );
}

/**
 * 同じ操作の回収義務を保存し、搬送集合を維持する。
 *
 * @responsibility exact参照集合の更新を現在Ownerと元版に結合する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner。recoveryId: exact参照。referencesValue: recoveryとdeliveries。
 * @returns 保存確定・排他解放・Filesystem Effectを区別した結果。
 * @precondition 義務は本番の回収Ownerが取得し、既存搬送集合は変更しない。
 * @postcondition 他操作を変更せず、既知結果の変更と不許可除去を拒否する。
 * @effect 既存Snapshot Writerの固定File更新だけ。結果搬送は発行しない。
 * @failure 搬送・受理Hash更新、他操作、別結果、不正遷移、改訂競合または排他不明はblocked。
 * @invariant 未確定の回収義務・未受理結果を黙って消さない。
 * @boundary 回収・Consumer Ownerと現在状態Writer。
 * @security 受理Hashを操作Authorityや回復許可へ昇格しない。
 * @concurrency 既存短期排他と元版照合を共用し、盲目的に再試行しない。
 */
export function checkpointRuntimeOwnedCoordinatorReferences(
  managementCapability: unknown,
  recoveryId: unknown,
  referencesValue: unknown,
) {
  return checkpointRuntimeOwnedCoordinatorValue(
    managementCapability,
    recoveryId,
    referencesValue,
    "references",
  );
}
