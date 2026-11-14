/**
 * 単一State Writer・初期化・保存途中の再入場を所有する。
 * @responsibility 短命証拠の生成・一回消費・失効と物理保存を同じOwnerへ結合する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import { getRepository } from "../../../version-control/src/index.ts";
import type {
  ExecutionOperationRecord,
  RepairWritePurpose,
} from "../attempt/types.ts";
import { areTaskResourcesSettled } from "../attempt/validation.ts";
import { decodeHistoryRows } from "../history/validation.ts";
import { prepareExecutionDefinitionChange } from "../objective/validation.ts";
import type { readRecoveryState } from "../state/crud.ts";
import type { ExecutionStateSnapshot } from "../state/types.ts";
import {
  authenticationUnknownAbsenceChanged,
  classifyRepairPublication,
  decodeStateSnapshot,
  prepareAuthenticationUnknownClosureSnapshot,
  prepareHistoryRetention,
  prepareRecoveredHistoryPublication,
  prepareRepairHistoryLine,
  prepareRepairHistoryPublication,
  prepareRepairHistorySnapshot,
  prepareStateCleanupSnapshot,
  prepareStateCompletionSnapshot,
  prepareStateHistoryLine,
  prepareStateHistorySnapshot,
  prepareStateRepairCompletionSnapshot,
  validateRepairWriteCandidate,
  validateStateTransition,
  validateUnifiedTransition,
} from "../state/validation.ts";
import { encodeStateValue } from "../state/value.ts";
import {
  prepareUnifiedTaskSections,
  projectTaskSnapshot,
} from "../task/validation.ts";
import type {
  ExecutionTerminalStorageObservation,
  StorageOwner,
} from "./lock.ts";
import {
  acquireExecutionStateLock,
  acquireStorageOwnerForRepository,
  executionStorageOperationIdentity,
  isLiveStorageOwner,
  observeExecutionRecoveryRepository,
  observeOperationRepository,
  readHistoryRetentionDays,
  readStorageOwnerBinding,
  storageLockFailure,
} from "./lock.ts";
import type { StableFileIdentity, StorageRepository } from "./store.ts";
import {
  assertExecutionStateInitializationBoundary,
  classifyExecutionSnapshotReentry,
  createExecutionDataArea,
  createExecutionStatePendingFile,
  flushExecutionStateFile,
  observeRepositoryExecutionDataArea,
  readExecutionStateFile,
  readStableFileSnapshot,
  readStateSnapshot,
  sameStableFileIdentity,
} from "./store.ts";

const settlements = new WeakMap<
  object,
  | {
      kind: "authentication_unknown_closure";
      repository: StorageRepository & { operationId: string };
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
      repository: StorageRepository & { operationId: string };
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
      repository: StorageRepository & { operationId: string };
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
      repository: StorageRepository & { operationId: string };
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
      assertOwner: (expectedHistoryRetentionDays?: number) => boolean;
      used: boolean;
    }
>();

const initializations = new WeakMap<
  object,
  {
    repositoryBinding: string;
    boundaryIdentity: string;
    payloadSha256: string;
    publicationIssued: boolean;
  }
>();

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
export function prepareOwnedStateInitialization(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  const repository = observeOperationRepository(managementCapability);
  return prepareStateInitialization(
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
function prepareStateInitialization(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeOperationRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
) {
  const initializationOwner =
    managementCapability &&
    typeof managementCapability === "object" &&
    settlements.get(managementCapability)?.kind === "runtime_repair"
      ? managementCapability
      : executionStorageOperationIdentity(managementCapability);
  const candidate = repository
    ? decodeStateSnapshot(candidateBytes, repository.repositoryBinding)
    : null;
  if (
    !repository ||
    !candidate ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !initializationOwner ||
    !validateStateTransition(
      null,
      candidateBytes,
      repository.repositoryBinding,
    ) ||
    initializations.has(initializationOwner) ||
    candidate.snapshot.operations.some(
      (operation) =>
        JSON.parse(operation.identityJson).operationId !==
        repository.operationId,
    ) ||
    [...candidate.snapshot.unresolvedRecoveries].some((item) => {
      const operation = candidate.snapshot.operations.find(
        (value): value is ExecutionOperationRecord =>
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
  const acquisition = acquireStorageOwnerForRepository(repository);
  const storageOwner =
    acquisition.status === "completed" ? acquisition.value : null;
  const lock = storageOwner
    ? readStorageOwnerBinding(storageOwner)?.lock
    : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: false,
    });
  let effectIssued = false;
  let isPrepared = false;
  try {
    const verified = getRepository(repository.repositoryRoot);
    if (
      verified.status !== "completed" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("owner");
    const created = createExecutionDataArea(verified.capability);
    effectIssued = created.effectIssued;
    if (
      created.status !== "created" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("created");
    initializations.set(initializationOwner, {
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
  if (!lockReleased) initializations.delete(initializationOwner);
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
 * @effect 固定pending/stateの作成・置換・短命物回収だけ。
 * @failure 不一致やI/O失敗は例外で上位へ返す。
 * @invariant 本番Producerの全面切替やHost回収成立をこの保存だけから主張しない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意Pathや過去JSONから保存先を選択しない。
 * @concurrency 同じRepositoryの短期排他下で処置する。
 */
export function writeOwnedStateSnapshot(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  return writeStateSnapshot(
    managementCapability,
    observeOperationRepository(managementCapability),
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
export function resumeRepairRecordSave(
  rootCapability: unknown,
  recoveryId: string,
  assertInvocation: () => unknown,
) {
  const refused = () => writeStateSnapshot(null, null, null, null);
  const repository = observeExecutionRecoveryRepository(rootCapability);
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
  const acquisition = acquireExecutionStateLock(
    repository.repositoryBinding,
    repository.repositoryRoot,
  );
  if (acquisition.status !== "acquired")
    return {
      ...refused(),
      reason: storageLockFailure(acquisition).reason,
      lockReleased: false,
    };
  const lock = acquisition.lock;
  let files: Map<string, ReturnType<typeof readStableFileSnapshot>> | null =
    null;
  let boundaryIdentity: string | null = null;
  let publication: ReturnType<typeof classifyRepairPublication> = null;
  let noPending = false;
  let lockReleased = false;
  try {
    const verified = getRepository(repository.repositoryRoot);
    if (verified.status !== "completed" || !assertOwner() || !lock.assertLive())
      throw new Error("owner");
    const area = observeRepositoryExecutionDataArea(
      verified.capability,
      "domain-model",
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
          !["state.json", "state.pending.json", "history.jsonl"].includes(name),
      )
    )
      throw new Error("names");
    files = new Map();
    for (const name of names) {
      const file = path.join(area.directory, name);
      const stat = fs.lstatSync(file, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n)
        throw new Error("file");
      const value = readStableFileSnapshot(file);
      if (!sameStableFileIdentity(value.identity, stat))
        throw new Error("changed");
      files.set(name, value);
    }
    const current = files.get("state.json")?.bytes ?? null;
    const pending = files.get("state.pending.json")?.bytes ?? null;
    if (current && !decodeStateSnapshot(current, repository.repositoryBinding))
      throw new Error("current");
    const history = files.get("history.jsonl");
    if (history && !decodeHistoryRows(history.bytes))
      throw new Error("history");
    if (pending) {
      publication = classifyRepairPublication(
        current,
        pending,
        recoveryId,
        repository.repositoryBinding,
      );
      if (
        !publication ||
        (publication.mode === "initial_publication" &&
          names.join("|") !== "state.pending.json")
      )
        throw new Error("publication");
    } else {
      if (!current) throw new Error("current_absent");
      noPending = true;
    }
    for (const [name, previous] of files) {
      const file = path.join(area.directory, name);
      const value = readStableFileSnapshot(file);
      if (
        !sameStableFileIdentity(previous.identity, value.identity) ||
        !previous.bytes.equals(value.bytes) ||
        fs.lstatSync(file, { bigint: true }).nlink !== 1n
      )
        throw new Error("changed");
    }
    const final = observeRepositoryExecutionDataArea(
      verified.capability,
      "domain-model",
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
  const target = decodeStateSnapshot(
    publication.candidate,
    repository.repositoryBinding,
  )?.snapshot.operations.find((item) => item.recoveryId === recoveryId);
  if (target?.kind !== "runtime_repair") return refused();
  const bound = Object.freeze({
    ...repository,
    operationId: JSON.parse(target.identityJson).operationId as string,
    revalidate: assertOwner,
  });
  return publishRecoveryState({
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
    publication: { boundaryIdentity, files },
  });
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
function prepareStateWrite(
  managementCapability: unknown,
  repository:
    | (Pick<
        NonNullable<ReturnType<typeof observeOperationRepository>>,
        "repositoryRoot" | "repositoryBinding" | "revalidate"
      > & { operationId?: string })
    | null,
  candidateBytes: unknown,
  settlement: {
    recoveryId: string;
    cleanupStatus: string | null;
    dockerTerminal: ExecutionTerminalStorageObservation | null;
    historyInitial?: true;
    historyPublish?: true;
    currentHistory?: object;
    currentCompletion?: object;
    consumer?: string;
    completion?: { before: Buffer; candidate: Buffer };
    managementCapability?: unknown;
  } | null,
  unissued?: Readonly<{
    recoveryId: string;
    purpose: string;
  }>,
  hostCleanupPublication?: NonNullable<
    ReturnType<typeof readRecoveryState>["hostCleanupPublication"]
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
  const initializationOwner =
    repairContext ?? executionStorageOperationIdentity(managementCapability);
  const historyBinding = settlement?.currentHistory
    ? settlements.get(settlement.currentHistory)
    : null;
  const currentHistory =
    historyBinding?.kind === "current_history" ? historyBinding : null;
  const completionBinding = settlement?.currentCompletion
    ? settlements.get(settlement.currentCompletion)
    : null;
  const currentCompletion =
    completionBinding?.kind === "current_completion" ? completionBinding : null;
  const candidate = repository
    ? decodeStateSnapshot(candidateBytes, repository.repositoryBinding)
    : null;
  const bytes = candidate
    ? Buffer.from(`${encodeStateValue(candidate.snapshot)}\n`)
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
    (settlement?.currentCompletion &&
      (!currentCompletion || currentCompletion.used)) ||
    [currentHistory, currentCompletion].filter((value) => value !== null)
      .length > 1
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
        (operation.resources?.checkpoints ?? []).some(
          (resource) =>
            resource.submission === "intent_saved" &&
            resource.receiptSource === null &&
            resource.observation === "absent",
        ),
    )
  ) {
    // 私有pairは差分の基準であり保存資格ではない。元版・実体・Ownerは
    // 主Kernel内で必ず再検査する。一般入口だけは通常Readerを用いる。
    const fixedPairs = [
      currentHistory,
      currentCompletion,
      currentRepair,
      settlement?.completion,
      hostCleanupPublication,
    ].filter((pair) => pair !== null && pair !== undefined);
    let previousSnapshot: ExecutionStateSnapshot | null = null;
    let previousLockReleased = true;
    if (fixedPairs.length === 1) {
      const fixed = fixedPairs[0];
      if (fixed?.candidate.equals(bytes))
        previousSnapshot =
          decodeStateSnapshot(fixed.before, repository.repositoryBinding)
            ?.snapshot ?? null;
    } else if (fixedPairs.length === 0) {
      const previous = readStateSnapshot(repository, null);
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
  const acquisition = acquireStorageOwnerForRepository(repository);
  const storageOwner =
    acquisition.status === "completed" ? acquisition.value : null;
  const lock = storageOwner
    ? readStorageOwnerBinding(storageOwner)?.lock
    : null;
  if (!storageOwner || !lock)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason:
        acquisition.status === "blocked"
          ? acquisition.reason
          : "coordinator_state_lock_unavailable",
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
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentCompletion,
    attempt,
    storageOwner,
    lock,
    managementCapability,
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
function commitStateSnapshotOwned(
  prepared: Extract<ReturnType<typeof prepareStateWrite>, { lock: unknown }> & {
    corePublication?: Readonly<{
      before: Buffer;
      kind: Parameters<typeof prepareExecutionDefinitionChange>[1];
      request: unknown;
      revision: string;
    }>;
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
    currentRepair,
    currentAuthenticationClosure,
    initializationOwner,
    currentHistory,
    currentCompletion,
    taskPublication,
    corePublication,
    lock,
  } = prepared;
  if (currentHistory) currentHistory.used = true;
  if (currentCompletion) currentCompletion.used = true;
  if (currentRepair) currentRepair.used = true;
  if (currentAuthenticationClosure) currentAuthenticationClosure.used = true;
  let filesystemEffectIssued = false;
  let snapshotConfirmed = false;
  let reason = "coordinator_state_storage_unconfirmed";
  let initialHistoryLine: string | null = null;
  let historyAlreadyConfirmed = false;
  try {
    const verified = getRepository(repository.repositoryRoot);
    if (verified.status !== "completed") throw new Error("root");
    const initial = observeRepositoryExecutionDataArea(
      verified.capability,
      "domain-model",
    );
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const directory = initial.directory;
    const fileIdentities = new Map<string, StableFileIdentity>();
    let initializationBoundaryRequired = false;
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
        const configuration = readHistoryRetentionDays(repository);
        if (
          configuration === null ||
          configuration !== currentHistory.retentionDays
        )
          throw new Error("current_history_config_changed");
      }
      const fresh = getRepository(repository.repositoryRoot);
      if (fresh.status !== "completed") throw new Error("root");
      if (initializationBoundaryRequired)
        assertExecutionStateInitializationBoundary(fresh.capability);
      const observed = observeRepositoryExecutionDataArea(
        fresh.capability,
        "domain-model",
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
        | "history.jsonl"
        | "history.pending.jsonl",
    ) => {
      return readExecutionStateFile(
        directory,
        name,
        fileIdentities,
        assertBoundary,
      );
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
      name: "state.pending.json" | "history.pending.jsonl",
      content: Buffer,
    ) => {
      createExecutionStatePendingFile(
        directory,
        name,
        content,
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
    };
    assertBoundary();
    const names = fs.readdirSync(directory);
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "history.jsonl",
            "history.pending.jsonl",
          ].includes(name),
      )
    )
      throw new Error("unknown_content");
    let currentBytes = read("state.json");
    initializationBoundaryRequired = currentBytes === null;
    if (initializationBoundaryRequired) assertBoundary();
    let current =
      currentBytes === null
        ? null
        : decodeStateSnapshot(currentBytes, repository.repositoryBinding);
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
      const expected = prepareAuthenticationUnknownClosureSnapshot(
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
    let repairPublication: ReturnType<typeof classifyRepairPublication> = null;
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
          name as "state.json" | "state.pending.json" | "history.jsonl",
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
      if (!pending) throw new Error("publication_missing");
      repairPublication = classifyRepairPublication(
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
          names.sort().join("|") !== "state.pending.json")
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
        encodeStateValue(target.history) !==
          encodeStateValue(beforeTarget?.history ?? null) ||
        JSON.parse(target.identityJson).operationId !==
          repository.operationId ||
        (beforeTarget && beforeTarget.identityJson !== target.identityJson) ||
        encodeStateValue(
          current?.snapshot.operations.filter(
            (operation) => operation.recoveryId !== currentRepair.recoveryId,
          ) ?? [],
        ) !==
          encodeStateValue(
            candidate.snapshot.operations.filter(
              (operation) => operation.recoveryId !== currentRepair.recoveryId,
            ),
          ) ||
        encodeStateValue(current?.snapshot.unresolvedRecoveries ?? []) !==
          encodeStateValue(candidate.snapshot.unresolvedRecoveries) ||
        currentRepair.assertOwner() !== true
      )
        throw new Error("repair_writer_scope_invalid");
    }
    if (corePublication) {
      const expected = prepareExecutionDefinitionChange(
        corePublication.before,
        corePublication.kind,
        corePublication.request,
        repository.repositoryBinding,
        corePublication.revision,
      );
      if (
        taskPublication ||
        settlement ||
        currentRepair ||
        currentHistory ||
        currentCompletion ||
        !currentBytes?.equals(corePublication.before) ||
        expected.status !== "prepared" ||
        !expected.bytes.equals(bytes) ||
        !validateUnifiedTransition(
          currentBytes,
          bytes,
          repository.repositoryBinding,
        )
      )
        throw new Error("core_publication_scope_invalid");
    }
    let completionConfirmed = false;
    let savedTerminalConfirmed = false;
    let repairHistoryScopeConfirmed = false;
    if (taskPublication) {
      const same = currentBytes?.equals(bytes) === true;
      const expected =
        same || taskPublication.before === null
          ? bytes
          : prepareUnifiedTaskSections(
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
              candidate.snapshot.queueEntries.length !== 0
            : !currentBytes?.equals(taskPublication.before))) ||
        (!same &&
          !validateUnifiedTransition(
            currentBytes,
            bytes,
            repository.repositoryBinding,
          ))
      )
        throw new Error("task_publication_scope_invalid");
      const taskDecoded = decodeStateSnapshot(
        bytes,
        repository.repositoryBinding,
      );
      if (!taskDecoded) throw new Error("task_publication_scope_invalid");
      const projected = projectTaskSnapshot(
        taskDecoded,
        taskPublication.rootHash,
      );
      if (
        encodeStateValue(projected) !== encodeStateValue(taskPublication.view)
      )
        throw new Error("task_publication_view_invalid");
      for (const fact of taskPublication.facts) {
        const task = candidate.snapshot.managedExecutions
          .find((p) => p.projectId === fact.projectId)
          ?.tasks.find(
            (t) =>
              t.taskId === fact.taskId &&
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
      for (const operation of current?.snapshot.operations ?? []) {
        if (
          candidate.snapshot.operations.some(
            (o) => o.recoveryId === operation.recoveryId,
          )
        )
          continue;
        const line = currentBytes
          ? prepareStateHistoryLine(
              currentBytes,
              operation.recoveryId,
              repository.repositoryBinding,
            )
          : null;
        const rows = decodeHistoryRows(
          read("history.jsonl") ?? Buffer.alloc(0),
        );
        if (
          !line ||
          !rows?.some(
            (row) =>
              row.recoveryId === operation.recoveryId &&
              Buffer.from(row.line).equals(line),
          )
        )
          throw new Error("task_operation_history_unconfirmed");
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
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
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
          ? prepareStateRepairCompletionSnapshot
          : prepareStateCompletionSnapshot
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const line = (
        currentCompletion.operationKind === "runtime_repair"
          ? prepareRepairHistoryLine
          : prepareStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const rows = decodeHistoryRows(history ?? Buffer.alloc(0));
      const row = rows?.find(
        (item) => item.recoveryId === settlement.recoveryId,
      );
      if (
        !operation?.history?.confirmed ||
        identity?.operationId !== repository.operationId ||
        !expected?.equals(bytes) ||
        !line ||
        !rows ||
        (currentCompletion.operationKind === "runtime_repair" && !row) ||
        createHash("sha256").update(line).digest("hex") !==
          operation.history.lineSha256 ||
        (row && !Buffer.from(row.line).equals(line)) ||
        currentCompletion.assertOwner() !== true
      )
        throw new Error("current_completion_candidate_invalid");
      completionConfirmed = true;
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
            ? prepareRepairHistorySnapshot
            : prepareStateHistorySnapshot
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
        const config = readHistoryRetentionDays(repository);
        if (config === null) throw new Error("current_history_config_invalid");
        const publication = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareRepairHistoryPublication
            : prepareRecoveredHistoryPublication
        )(
          currentBytes,
          settlement.recoveryId,
          read("history.jsonl") ?? Buffer.alloc(0),
          read("history.pending.jsonl"),
          config,
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
            ? prepareRepairHistoryLine
            : prepareStateHistoryLine
        )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
        const rows = decodeHistoryRows(
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
      const before = decodeStateSnapshot(
        settlement.completion.before,
        repository.repositoryBinding,
      );
      const previous = before?.snapshot.operations.find(
        (operation): operation is ExecutionOperationRecord =>
          operation.kind === "docker_task" &&
          operation.recoveryId === settlement.recoveryId,
      );
      const expected = prepareStateCompletionSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      if (
        !before ||
        !previous ||
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
        settlement.historyInitial ||
        settlement.historyPublish
      )
        throw new Error("completion_scope_unconfirmed");
      const observed = prepareStateCleanupSnapshot(
        settlement.completion.before,
        settlement.recoveryId,
        {
          snapshot: settlement.dockerTerminal.resourceSnapshot,
          observations: settlement.dockerTerminal.resources,
        },
        repository.repositoryBinding,
      );
      const observedOperation = observed
        ? decodeStateSnapshot(
            observed,
            repository.repositoryBinding,
          )?.snapshot.operations.find(
            (operation): operation is ExecutionOperationRecord =>
              operation.kind === "docker_task" &&
              operation.recoveryId === settlement.recoveryId,
          )
        : null;
      if (
        !observedOperation ||
        encodeStateValue(observedOperation.resources) !==
          encodeStateValue(previous.resources)
      )
        throw new Error("completion_terminal_or_acceptance_unconfirmed");
      const fixedLine = prepareStateHistoryLine(
        settlement.completion.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeHistoryRows(read("history.jsonl") ?? Buffer.alloc(0));
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
      ![...(current?.snapshot.unresolvedRecoveries ?? [])].some(
        (item) => item.recoveryId === settlement.recoveryId,
      ) &&
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
      names.every((name) => name === "state.pending.json");
    const isInitialRepairPublication =
      repairPublication?.mode === "initial_publication";
    if (pendingBytes !== null) {
      const pending = decodeStateSnapshot(
        pendingBytes,
        repository.repositoryBinding,
      );
      if (!pending) throw new Error("pending");
      const treatment = classifyExecutionSnapshotReentry(
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
        !corePublication &&
        !(currentRepair
          ? validateRepairWriteCandidate(
              currentBytes,
              pendingBytes,
              currentRepair.recoveryId,
              currentRepair.purpose,
              repository.repositoryBinding,
            )
          : validateStateTransition(
              currentBytes,
              pendingBytes,
              repository.repositoryBinding,
            ))
      )
        throw new Error("transition");
    } else if (
      !currentBytes?.equals(bytes) &&
      !completionConfirmed &&
      !corePublication &&
      (!(currentRepair
        ? validateRepairWriteCandidate(
            currentBytes,
            bytes,
            currentRepair.recoveryId,
            currentRepair.purpose,
            repository.repositoryBinding,
          )
        : validateStateTransition(
            currentBytes,
            bytes,
            repository.repositoryBinding,
          )) ||
        (currentBytes === null && !isInitialRoot))
    )
      throw new Error("transition");

    if (settlement && !savedTerminalConfirmed) {
      if (!current) throw new Error("settlement_current_missing");
      if (
        !completionConfirmed &&
        (!current ||
          current.snapshot.operations.length !==
            candidate.snapshot.operations.length ||
          encodeStateValue(current.snapshot.unresolvedRecoveries) !==
            encodeStateValue(candidate.snapshot.unresolvedRecoveries))
      )
        throw new Error("settlement_scope");
      for (const previous of current.snapshot.operations) {
        if (previous.kind !== "docker_task") {
          const retained = candidate.snapshot.operations.find(
            (value) => value.recoveryId === previous.recoveryId,
          );
          if (encodeStateValue(retained) !== encodeStateValue(previous))
            throw new Error("repair_state_changed_by_task_settlement");
          continue;
        }
        const next = candidate.snapshot.operations.find(
          (value): value is ExecutionOperationRecord =>
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
          if (encodeStateValue(previous) !== encodeStateValue(next))
            throw new Error("settlement_other_operation");
          continue;
        }
        if (
          encodeStateValue(previous.resources) !==
          encodeStateValue(next.resources)
        ) {
          const observedBytes = settlement.dockerTerminal
            ? prepareStateCleanupSnapshot(
                currentBytes,
                settlement.recoveryId,
                {
                  snapshot: settlement.dockerTerminal.resourceSnapshot,
                  observations: settlement.dockerTerminal.resources,
                },
                repository.repositoryBinding,
              )
            : null;
          const observedOperation = observedBytes
            ? decodeStateSnapshot(
                observedBytes,
                repository.repositoryBinding,
              )?.snapshot.operations.find(
                (value): value is ExecutionOperationRecord =>
                  value.kind === "docker_task" &&
                  value.recoveryId === settlement.recoveryId,
              )
            : null;
          if (
            !observedOperation ||
            encodeStateValue(observedOperation.resources) !==
              encodeStateValue(next.resources)
          )
            throw new Error("settlement_resource_observation_invalid");
        }
        const nextPrimaryFailure = encodeStateValue(next.primaryFailure);
        if (
          settlement.dockerTerminal
            ? nextPrimaryFailure !==
              encodeStateValue(settlement.dockerTerminal.primaryFailure)
            : nextPrimaryFailure !== encodeStateValue(previous.primaryFailure)
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
            !areTaskResourcesSettled(next))
        )
          throw new Error("settlement_cleanup_unconfirmed");
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
            encodeStateValue(previous) !== encodeStateValue(operation)) &&
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
      for (const resource of operation.resources?.checkpoints ?? []) {
        const before = previous?.resources?.checkpoints.find(
          (value) => value.key === resource.key,
        );
        if (
          resource.submission === "not_issued" &&
          before?.submission !== "not_issued" &&
          (!unissued ||
            before?.submission !== "intent_saved" ||
            unissued.recoveryId !== operation.recoveryId ||
            unissued.purpose !== resource.key)
        )
          throw new Error("resource_not_issued_proof_missing");
      }
      if (
        !currentHistory &&
        (((settlement?.historyInitial || settlement?.historyPublish) &&
          operation.recoveryId === settlement.recoveryId) ||
          encodeStateValue(operation.history) !==
            encodeStateValue(previous?.history ?? null))
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
        const observedBytes = prepareStateCleanupSnapshot(
          currentBytes,
          operation.recoveryId,
          {
            snapshot: settlement.dockerTerminal.resourceSnapshot,
            observations: settlement.dockerTerminal.resources,
          },
          repository.repositoryBinding,
        );
        const observedOperation = observedBytes
          ? decodeStateSnapshot(
              observedBytes,
              repository.repositoryBinding,
            )?.snapshot.operations.find(
              (value): value is ExecutionOperationRecord =>
                value.kind === "docker_task" &&
                value.recoveryId === operation.recoveryId,
            )
          : null;
        if (
          !observedOperation ||
          encodeStateValue(observedOperation.resources) !==
            encodeStateValue(previous.resources)
        )
          throw new Error("history_resource_observation_invalid");
        const expected = prepareStateHistorySnapshot(
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
          encodeStateValue(previous) !== encodeStateValue(operation)) &&
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      )
        throw new Error("operation_owner");
    }
    for (const collection of ["unresolvedRecoveries"] as const) {
      for (const item of candidate.snapshot[collection]) {
        const previous = current?.snapshot[collection].find(
          (value) => value.operationNonce === item.operationNonce,
        );
        if (
          !previous ||
          encodeStateValue(previous) !== encodeStateValue(item)
        ) {
          const operation = candidate.snapshot.operations.find(
            (value): value is ExecutionOperationRecord =>
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
          ? prepareRepairHistoryLine
          : prepareStateHistoryLine
      )(currentBytes, settlement.recoveryId, repository.repositoryBinding);
      const target = current.snapshot.operations.find(
        (value) =>
          value.kind === (currentHistory?.operationKind ?? "docker_task") &&
          value.recoveryId === settlement.recoveryId,
      );
      if (!line || !target?.history) throw new Error("history_unfixed");
      const priorHistory = read("history.jsonl");
      const before = priorHistory ?? Buffer.alloc(0);
      const rows = decodeHistoryRows(before);
      if (!rows) throw new Error("history_invalid");
      const sameRow = rows.find(
        (row) => row.recoveryId === settlement.recoveryId,
      );
      if (sameRow && !Buffer.from(sameRow.line).equals(line))
        throw new Error("history_row_conflict");
      const owner = executionStorageOperationIdentity(
        settlement.managementCapability,
      );
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
      const configuration = readHistoryRetentionDays(repository);
      if (configuration === null) throw new Error("history_config_invalid");
      const days = configuration;
      const now = currentHistory
        ? target.history.occurredAt
        : (admission?.pending?.now ?? new Date().toISOString());
      let after: Buffer;
      if (currentHistory) {
        const publication = (
          currentHistory.operationKind === "runtime_repair"
            ? prepareRepairHistoryPublication
            : prepareRecoveredHistoryPublication
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
        const retained = prepareHistoryRetention(
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
        const freshConfig = readHistoryRetentionDays(repository);
        if (freshConfig === null || freshConfig !== days)
          throw new Error("history_config_changed");
        flushExecutionStateFile(
          directory,
          "history.pending.jsonl",
          fileIdentities,
          assertBoundary,
          () => {
            filesystemEffectIssued = true;
          },
        );
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
      flushExecutionStateFile(
        directory,
        "history.jsonl",
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
      const savedRows = decodeHistoryRows(read("history.jsonl"));
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
    if (!currentBytes?.equals(bytes)) {
      if (pendingBytes === null) create("state.pending.json", bytes);
      const samePending = read("state.pending.json");
      const sameCurrent = read("state.json");
      if (
        !samePending?.equals(bytes) ||
        (currentBytes === null
          ? sameCurrent !== null
          : !sameCurrent?.equals(currentBytes))
      )
        throw new Error("changed");
      flushExecutionStateFile(
        directory,
        "state.pending.json",
        fileIdentities,
        assertBoundary,
        () => {
          filesystemEffectIssued = true;
        },
      );
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
          : decodeStateSnapshot(currentBytes, repository.repositoryBinding);
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
          ? prepareRepairHistoryLine
          : prepareStateHistoryLine
      )(bytes, settlement.recoveryId, repository.repositoryBinding);
      const finalRows = decodeHistoryRows(read("history.jsonl"));
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
    if (currentCompletion) {
      const history = read("history.jsonl");
      if (
        currentCompletion.historyFile === null
          ? history !== null
          : !history?.equals(currentCompletion.historyFile.bytes)
      )
        throw new Error("current_completion_history_changed");
    }
    assertBoundary();
    if (!read("state.json")?.equals(bytes)) throw new Error("final");
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
export function writeStateSnapshot(
  ...input: Parameters<typeof prepareStateWrite>
) {
  const prepared = prepareStateWrite(...input);
  if (!("lock" in prepared)) return prepared;
  const { storageOwner, initializationOwner, settlement, attempt } = prepared;
  let {
    filesystemEffectIssued,
    snapshotConfirmed,
    reason,
    initialHistoryLine,
  } = commitStateSnapshotOwned(prepared);
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
    let attempts = historyAttempts.get(
      executionStorageOperationIdentity(
        settlement.managementCapability,
      ) as object,
    );
    if (!attempts) {
      attempts = new Map();
      historyAttempts.set(
        executionStorageOperationIdentity(
          settlement.managementCapability,
        ) as object,
        attempts,
      );
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
 * 同じ操作の履歴出版で既に固定した再入場候補を参照する。
 * @responsibility 初回出版の証拠を複製せず、正常終了の再入場へ同じ候補を渡す。
 * @trace ARCH-000008
 * @input owner: 元実行Owner、recoveryId: exact回復参照。
 * @returns 固定済み候補、又はnull。
 * @precondition 呼出し側が正常終了Contextの真正性を確認する。
 * @postcondition 新しい証拠・Authorityを生成しない。
 * @effect N/A: 私有Map読取りだけ。
 * @failure 未登録又は不正Ownerではnull。
 * @invariant 候補参照は保存許可や履歴完了を表さない。
 * @boundary 正常終了Ownerと履歴出版証拠。
 * @security 可変Mapや証拠recordを返さない。
 * @concurrency 元の一回出版証拠を同じ寿命で参照する。
 */
export function readHistoryResumeCandidate(owner: unknown, recoveryId: string) {
  return owner && typeof owner === "object"
    ? historyAttempts.get(owner)?.get(recoveryId)?.pending?.stateCandidate
    : null;
}
type RecoveryPublication = (
  typeof settlements extends WeakMap<object, infer T>
    ? T
    : never
) extends infer T
  ? T extends { used: boolean }
    ? Omit<T, "used">
    : never
  : never;

/**
 * 検査済み回復候補を一回保存し、短命証拠を全終了経路で失効する。
 * @responsibility 証拠生成・初期化・一回保存・失効を物理Writerへ閉じる。
 * @trace ARCH-000008
 * @input request: 閉じた用途別候補と現在Owner。
 * @returns 保存、初期化Effect、排他解放の観測。
 * @precondition 意味側のReaderと候補検査を通過している。
 * @postcondition 私有Contextを返さず破棄する。
 * @effect 初回領域作成と既存Writerだけ。
 * @failure 不明用途・失効・元版差・保存不明は停止する。
 * @invariant 証拠消費と履歴試行登録の既存順序を維持する。
 * @boundary 意味側候補とStorageの保存。
 * @security Root公開せず、Map操作の汎用APIを作らない。
 * @concurrency 既存の短期排他を利用する。
 */
export function publishRecoveryState(request: RecoveryPublication) {
  const refused = () => writeStateSnapshot(null, null, null, null);
  if (
    !request ||
    ![
      "runtime_repair",
      "current_completion",
      "current_history",
      "authentication_unknown_closure",
    ].includes(request.kind) ||
    (request.kind === "runtime_repair" &&
      ![
        "checkpoint",
        "session_begin",
        "retention_handoff",
        "disposal_decision",
        "disposal_primary",
        "disposal_failed",
        "disposal_auxiliary",
      ].includes(request.purpose)) ||
    ((request.kind === "current_completion" ||
      request.kind === "current_history") &&
      request.operationKind !== "docker_task" &&
      request.operationKind !== "runtime_repair") ||
    (request.kind === "current_history" &&
      !["checkpoint", "publish", "confirmed"].includes(request.stage)) ||
    (request.kind !== "runtime_repair" &&
      ("purpose" in request || "publication" in request)) ||
    (request.kind !== "current_history" &&
      ("stage" in request || "pendingHistoryFile" in request))
  )
    return refused();
  const context = Object.freeze({});
  let active = true;
  let initializationEffectIssued = false;
  const repository = request.repository;
  const binding = { ...request, used: false };
  if (binding.kind === "current_history") {
    binding.assertOwner = (days?: number) =>
      active &&
      settlements.get(context) === binding &&
      binding.used &&
      request.assertOwner() === true &&
      repository.revalidate(days);
  } else if (binding.kind === "authentication_unknown_closure") {
    binding.assertOwner = () =>
      active && request.assertOwner() === true && repository.revalidate();
  }
  settlements.set(context, binding);
  try {
    if (
      binding.kind === "runtime_repair" &&
      binding.before === null &&
      !binding.publication
    ) {
      const initialized = prepareStateInitialization(
        context,
        repository,
        binding.candidate,
      );
      initializationEffectIssued ||= initialized.effectIssued;
      if (initialized.status !== "prepared" || !initialized.lockReleased)
        return Object.freeze({
          ...refused(),
          reason: "coordinator_state_initialization_unconfirmed",
          filesystemEffectIssued: initializationEffectIssued,
          lockReleased: initialized.lockReleased,
        });
    }
    const bound =
      binding.kind === "authentication_unknown_closure"
        ? {
            ...repository,
            revalidate: (days?: number) =>
              active &&
              settlements.get(context) === binding &&
              binding.used &&
              binding.assertOwner() &&
              repository.revalidate(days),
          }
        : binding.kind === "current_history"
          ? { ...repository, revalidate: binding.assertOwner }
          : repository;
    const saved = writeStateSnapshot(
      null,
      bound,
      binding.candidate,
      binding.kind === "current_history" ||
        binding.kind === "current_completion"
        ? {
            recoveryId: binding.recoveryId,
            cleanupStatus: null,
            dockerTerminal: null,
            ...(binding.kind === "current_history"
              ? { currentHistory: context }
              : { currentCompletion: context }),
          }
        : null,
      undefined,
      undefined,
      binding.kind === "runtime_repair" ||
        binding.kind === "authentication_unknown_closure"
        ? context
        : undefined,
    );
    return Object.freeze({
      ...saved,
      filesystemEffectIssued:
        initializationEffectIssued || saved.filesystemEffectIssued,
    });
  } catch {
    return Object.freeze({
      ...refused(),
      filesystemEffectIssued: initializationEffectIssued,
    });
  } finally {
    active = false;
    settlements.delete(context);
    initializations.delete(context);
  }
}

type OwnedPublication =
  | Readonly<
      { kind: "task" } & NonNullable<
        Parameters<typeof commitStateSnapshotOwned>[0]["taskPublication"]
      >
    >
  | Readonly<{
      kind: "definition";
      operation: Parameters<typeof prepareExecutionDefinitionChange>[1];
      before: Buffer;
      request: unknown;
      revision: string;
    }>;

/**
 * 取得済みOwnerでTask又は定義候補を同じWriterへ渡す。
 * @responsibility 私有commit入力の構築を物理保存Ownerへ閉じる。
 * @trace ARCH-000008
 * @input owner: 取得済みOwner、bytes: 候補、publication: 閉じた保存用途。
 * @returns 既存Writerの保存観測。
 * @precondition 同じOwner内で現在版と意味の遷移を確認済み。
 * @postcondition Ownerを再取得・解放しない。
 * @effect 既存のpending・rename・読戻しだけ。
 * @failure 偽Owner・不明用途・候補不正はEffect前に拒否する。
 * @invariant 呼出し元が一回だけOwnerを解放する。
 * @boundary 意味側候補と単一Writer。
 * @security preparedやMapを返さない。
 * @concurrency 元Ownerの保持区間を分割しない。
 */
export function publishStateOwned(
  owner: StorageOwner,
  bytes: Buffer,
  publication: OwnedPublication,
) {
  const binding = readStorageOwnerBinding(owner);
  const candidate = binding
    ? decodeStateSnapshot(bytes, binding.repository.repositoryBinding)
    : null;
  if (
    !binding ||
    !candidate ||
    !isLiveStorageOwner(owner) ||
    (publication.kind !== "task" && publication.kind !== "definition")
  )
    return {
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      reason: "coordinator_state_storage_unconfirmed",
      initialHistoryLine: null,
    };
  return commitStateSnapshotOwned({
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
    currentCompletion: null,
    attempt: {
      revision: candidate.snapshot.revision,
      payloadSha256: candidate.payloadSha256,
      recoveryIds: Object.freeze(
        candidate.snapshot.operations.map((o) => o.recoveryId),
      ),
    },
    storageOwner: owner,
    lock: binding.lock,
    ...(publication.kind === "task"
      ? {
          taskPublication: {
            before: publication.before,
            view: publication.view,
            facts: publication.facts,
            rootHash: publication.rootHash,
            initialBoundary: publication.initialBoundary,
          },
        }
      : {
          corePublication: {
            before: publication.before,
            kind: publication.operation,
            request: publication.request,
            revision: publication.revision,
          },
        }),
  });
}
