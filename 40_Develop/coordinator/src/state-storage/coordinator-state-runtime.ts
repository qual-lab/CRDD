/**
 * Coordinatorの最新現在状態をRepositoryへ保存する。
 * @responsibility 既存のRoot観測・排他・bounded読取りを用いた固定二Fileの保存確定を所有する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readCoordinatorConfig } from "../../../domain-model/src/configuration/index.ts";
import { observeRepositoryRuntimeDataArea } from "../../../domain-model/src/repository/index.ts";
import {
  createCoordinatorRuntimeDataArea,
  readStableBoundedFileSnapshot,
  type StableFileIdentity,
  sameStableFileIdentity,
} from "../../../domain-model/src/storage/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import { verifyRuntimeOwnedDockerCleanupOutcome } from "../docker-runtime/docker-effect-runtime.ts";
import {
  borrowRuntimeOwnedDockerTerminalObservations,
  verifyRuntimeOwnedDockerUnissuedNotice,
} from "../docker-runtime/docker-process-controller.ts";
import { parseDockerTaskRecoveryId } from "../docker-runtime/docker-recovery-identity.ts";
import { classifyCoordinatorSnapshotReentry } from "../docker-runtime/docker-recovery-state-machine.ts";
import { acquireRuntimeOwnedCoordinatorStateKernelLock } from "../host-runtime/candidate-store-kernel-lock.ts";
import {
  beginOwnedDockerSubmissionRecovery,
  borrowOwnedHostRecoverySnapshot,
  captureOwnedOperationCleanupVerification,
  completeOwnedDockerSubmissionRecovery,
} from "../host-runtime/execution-environment.ts";
import { parseHostRecoveryToken } from "../host-runtime/host-recovery-record.ts";
import { verifyRuntimeOwnedProviderHomeMountCompletion } from "../provider/provider-home-mount-grant-runtime.ts";
import {
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  borrowRuntimeOwnedCoordinatorSettlementRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
} from "../repository-operation/repository-operation-runtime.ts";
import {
  coordinatorConsumerCompletionPolicy,
  decodeCoordinatorHistoryRows,
  decodeCoordinatorProjectAcceptance,
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  MAX_COORDINATOR_STATE_BYTES,
  prepareCoordinatorHistoryRetention,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateProjectAcceptanceSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  validateCoordinatorStateTransition,
} from "./coordinator-state-model.ts";

const settlements = new WeakMap<
  object,
  | {
      kind: "live";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorSettlementRepository>
      >;
      recoveryId: string;
      managementCapability: unknown;
      consumer: "coordinator_cli" | "project_runtime" | "workbench";
      readProjectAcceptance?: () => unknown;
      projectAcceptanceCandidate?: Buffer;
      completion?: { before: Buffer; candidate: Buffer };
      originalInputs?: { cleanupOutcome: unknown; dockerCompletion: unknown };
      verifyCleanup: NonNullable<
        ReturnType<typeof captureOwnedOperationCleanupVerification>
      >;
    }
  | {
      kind: "recovered";
      repository: NonNullable<
        ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
      > & { operationId: string };
      recoveryId: string;
      consumer: "project_runtime";
      readProjectAcceptance: () => unknown;
      before: Buffer;
      acceptance?: { before: Buffer; candidate: Buffer };
      completion?: { before: Buffer; candidate: Buffer };
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
    (value) => value.identityJson === identityJson,
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
 * @input managementCapability: 現在Owner、recoveryId: 保存済みexact参照、consumer: 本番組立てが固定する利用側、readProjectAcceptance: 耐久利用側の同期上位Reader。
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
  readProjectAcceptance?: () => unknown,
) {
  const policy = coordinatorConsumerCompletionPolicy(consumer);
  if (
    policy === null ||
    (readProjectAcceptance !== undefined &&
      (typeof readProjectAcceptance !== "function" || policy !== "durable"))
  )
    return null;
  const repository =
    borrowRuntimeOwnedCoordinatorSettlementRepository(managementCapability);
  const verifyCleanup =
    captureOwnedOperationCleanupVerification(managementCapability);
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (value) => value.recoveryId === recoveryId,
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
    consumer: consumer as "coordinator_cli" | "project_runtime" | "workbench",
    ...(readProjectAcceptance ? { readProjectAcceptance } : {}),
  });
  return context;
}

/**
 * 同じ終端Contextへ本番組立ての上位受理Readerを一度だけ結合する。
 * @responsibility 清掃前に保持したContextを再作成せず、耐久受領の読戻しだけを接続する。
 * @trace ARCH-000008
 * @input context: 元の私有Context、recoveryId: 同じexact参照、readProjectAcceptance: 固定組立ての同期Reader。
 * @returns 同じ結合が確定している場合だけtrue。
 * @precondition RequestからReaderを受け取らず、Orchestrator組立てが保持する関数を渡す。
 * @postcondition 一度結合したReaderを別関数で置換しない。
 * @effect 既存Context内のReader参照保持のみ。保存、Docker、上位Reader呼出しは行わない。
 * @failure 偽Context、別参照、一時返却Consumer、非関数とReader差替えを拒否する。
 * @invariant 結合成功はACK受理、清掃成功または操作除去の証明ではない。
 * @boundary Orchestrator組立てと同じ操作の終端限定Context。
 * @security Contextは既存WeakMapで確認し、任意Path・結果Hash・新Authorityを受け付けない。
 * @concurrency 同期で一度だけ固定し、同じ関数の再入場だけを許可する。
 */
export function bindRuntimeOwnedCoordinatorProjectAcceptanceReader(
  context: unknown,
  recoveryId: unknown,
  readProjectAcceptance: unknown,
): boolean {
  const settlement = readLiveSettlement(context);
  if (
    settlement?.consumer !== "project_runtime" ||
    settlement.recoveryId !== recoveryId ||
    typeof readProjectAcceptance !== "function" ||
    (settlement.readProjectAcceptance !== undefined &&
      settlement.readProjectAcceptance !== readProjectAcceptance)
  )
    return false;
  settlement.readProjectAcceptance = readProjectAcceptance as () => unknown;
  return true;
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
    (item) => item.recoveryId === settlement.recoveryId,
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
        item.recoveryId !== settlement.recoveryId
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
          (item) => item.recoveryId === settlement.recoveryId,
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
    (item) => item.recoveryId === settlement.recoveryId,
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
  const durable =
    coordinatorConsumerCompletionPolicy(settlement.consumer) === "durable";
  const registered = registerRuntimeOwnedCoordinatorSettlementResultDeliveries(
    context,
    cleanupOutcome,
    dockerCompletion,
    durable ? ["project_runtime"] : [],
  );
  filesystemEffectIssued ||= registered.filesystemEffectIssued;
  if (registered.status !== "completed" || !registered.lockReleased)
    return refused(registered);
  if (durable) {
    const result = readRuntimeOwnedCoordinatorSettlementResult(
      context,
      "project_runtime",
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
    (value) => value.recoveryId === settlement.recoveryId,
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
 * 固定した上位Readerの耐久受理を同じ結果搬送へ保存する。
 * @responsibility 上位読戻しと下位更新排他内の再照合を既存Writerへ接続する。
 * @trace ARCH-000008
 * @input context: 清掃前に上位Readerを固定したContext、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller終端結果。
 * @returns 保存・排他解放・Effect別の結果。
 * @precondition 上位Writerは保存Lockを解放済みで、Readerは同じAttemptの保存ACKだけを返す。
 * @postcondition fresh受理本文と固定結果が一致した一搬送だけを更新する。
 * @effect 既存の上位読取りと固定state.json・短命state.lockの保存だけ。
 * @failure 偽Context、Reader欠落・例外・非同期値、不正ACK、元版と再読戻しの不一致は拒否する。
 * @invariant 一般Writerの任意受理拒否を緩和せず、同じ受理の再入場でもReaderを省略しない。
 * @boundary 上位耐久受理とCoordinatorの現在結果搬送。
 * @security Request・JSONからcallback、任意Hash、Pathを受け付けない。
 * @concurrency 上位保存Lock解放後に入り、下位更新Lockから短期上位読取りだけを行う。
 */
export function acceptRuntimeOwnedCoordinatorProjectResult(
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
    !settlement?.readProjectAcceptance ||
    !cleanupStatus ||
    !dockerTerminal?.homeLeaseReleased ||
    !dockerTerminal.mountLeaseReleased ||
    !dockerTerminal.recoveryCompleted
  )
    return writeCoordinatorStateSnapshot(null, null, null, null);
  if (settlement.projectAcceptanceCandidate) {
    const resumed = writeCoordinatorStateSnapshot(
      null,
      settlement.repository,
      settlement.projectAcceptanceCandidate,
      {
        ...settlement,
        cleanupStatus,
        dockerTerminal,
        projectAcceptanceReader: settlement.readProjectAcceptance,
      },
    );
    if (resumed.status === "completed")
      delete settlement.projectAcceptanceCandidate;
    return resumed;
  }
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
  let candidate: Buffer | null = null;
  try {
    candidate = prepareCoordinatorStateProjectAcceptanceSnapshot(
      Buffer.from(`${encodeCoordinatorStateValue(current.value.snapshot)}\n`),
      settlement.readProjectAcceptance(),
      settlement.repository.repositoryBinding,
    );
  } catch {
    // 上位の例外は受理証明にならず、元の回復参照を保持する。
  }
  const saved = writeCoordinatorStateSnapshot(
    null,
    settlement.repository,
    candidate,
    {
      ...settlement,
      cleanupStatus,
      dockerTerminal,
      projectAcceptanceReader: settlement.readProjectAcceptance,
    },
  );
  if (candidate && saved.status !== "completed" && saved.filesystemEffectIssued)
    settlement.projectAcceptanceCandidate = candidate;
  return saved;
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
    (coordinatorConsumerCompletionPolicy(settlement.consumer) === "durable"
      ? !settlement.readProjectAcceptance
      : settlement.readProjectAcceptance !== undefined) ||
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
    (operation) => operation.recoveryId === settlement.recoveryId,
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
      ...(settlement.readProjectAcceptance
        ? { projectAcceptanceReader: settlement.readProjectAcceptance }
        : {}),
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
    (value) => value.recoveryId === settlement.recoveryId,
  );
  if (current.value && operation?.history?.confirmed)
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
      ? prepareCoordinatorStateHistorySnapshot(
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
    (item) => item.recoveryId === recoveryId,
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
    (value) => value.recoveryId === recoveryId,
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
    (item) => item.recoveryId === settlement?.recoveryId,
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
 * @security Consumerはproject_runtime固定。公開barrelや外部RequestへAuthorityを追加しない。
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
    "project_runtime",
  );
}

/**
 * 保存済み終端の耐久配送だけに限定した新Process用結合を準備する。
 * @responsibility 現在Root・exact参照・登録済み結果・履歴確認と固定Readerを結合する。
 * @trace ARCH-000008
 * @input rootCapability: 現在Rootの真正な結合、recoveryId: exact参照、readProjectAcceptance: 本番上位Reader。
 * @returns 終了限定の不透明Context、またはnull。
 * @precondition 資源・Host清掃とLease解放は保存済み終端で確認済みである。
 * @postcondition 元の管理CapabilityやController結果を復元しない。
 * @effect 現在Snapshotの読取りと既存短期排他、Process内の結合保持だけ。
 * @failure 非終端、未登録、履歴未確認、Root・対象・要約不一致、別の保存候補は拒否する。
 * @invariant 準備成功はACK保存・操作整理・実資源回復の成功ではない。
 * @boundary 検証済みRepositoryと保存済み終端配送。
 * @security 任意Path、呼出し元本文、実行Authorityを受け取らない。
 * @concurrency 読取り時の排他解放を確認し、更新時には元版を再照合する。
 */
export function prepareRuntimeOwnedCoordinatorRecoveredSettlement(
  rootCapability: unknown,
  recoveryId: unknown,
  readProjectAcceptance: unknown,
) {
  if (
    typeof recoveryId !== "string" ||
    typeof readProjectAcceptance !== "function"
  )
    return null;
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  const observed = readCoordinatorStateSnapshot(repository, null, {
    recoveryId,
    readProjectAcceptance: readProjectAcceptance as () => unknown,
  });
  const result = projectRegisteredCoordinatorResult(
    observed,
    recoveryId,
    repository?.repositoryBinding ?? null,
    "project_runtime",
  );
  const operation = observed.value?.snapshot.operations.find(
    (value) => value.recoveryId === recoveryId,
  );
  if (
    !repository ||
    result.status !== "completed" ||
    !observed.value ||
    !operation?.history?.confirmed
  )
    return null;
  const before = Buffer.from(
    `${encodeCoordinatorStateValue(observed.value.snapshot)}\n`,
  );
  const line = prepareCoordinatorStateHistoryLine(
    before,
    recoveryId,
    repository.repositoryBinding,
  );
  if (
    !line ||
    createHash("sha256").update(line).digest("hex") !==
      operation.history.lineSha256
  )
    return null;
  const context = Object.freeze({});
  settlements.set(context, {
    kind: "recovered",
    repository: Object.freeze({
      ...repository,
      operationId: JSON.parse(operation.identityJson).operationId,
    }),
    recoveryId,
    consumer: "project_runtime",
    readProjectAcceptance: readProjectAcceptance as () => unknown,
    before,
    ...(observed.reentry?.mode === "accept"
      ? { acceptance: { before, candidate: observed.reentry.candidate } }
      : observed.reentry?.mode === "complete"
        ? { completion: { before, candidate: observed.reentry.candidate } }
        : {}),
  });
  return context;
}

/**
 * 保存済み終端の上位受理と操作整理を既存Writerへ接続する。
 * @responsibility 受理保存確認後にだけ整理し、応答不明でも同じ元版と候補を保持する。
 * @trace ARCH-000008
 * @input context: 現在Rootと保存済み終端へ結合した不透明Context。
 * @returns 保存・排他解放・Effectを分けた終了結果。
 * @precondition 上位Ownerが同じ結果の耐久ACKを保存済みである。
 * @postcondition 対象配送の受理と対象一操作の除去以外は変更しない。
 * @effect 既存Writerの固定state保存・短期排他と固定上位Reader読取りだけ。
 * @failure 偽Context、元版競合、Reader不一致・例外、履歴不整合は保持して停止する。
 * @invariant 元実行Capabilityを復元せず、Provider要求・Task再実行・資源回収を発行しない。
 * @boundary 保存済み終端配送と上位耐久受理。
 * @security 任意本文、Path、処置種別、callbackの差替えを入力から受けない。
 * @concurrency 各保存Lock内で元版・候補とfresh ACKを再確認する。
 */
export function completeRuntimeOwnedCoordinatorRecoveredSettlement(
  context: unknown,
) {
  const settlement =
    context && typeof context === "object" ? settlements.get(context) : null;
  if (settlement?.kind !== "recovered")
    return writeCoordinatorStateSnapshot(null, null, null, null);
  let completion = settlement.completion;
  if (!completion) {
    let acceptance = settlement.acceptance;
    if (!acceptance) {
      let candidate: Buffer | null = null;
      try {
        candidate = prepareCoordinatorStateProjectAcceptanceSnapshot(
          settlement.before,
          settlement.readProjectAcceptance(),
          settlement.repository.repositoryBinding,
        );
      } catch {
        // Reader例外は耐久受理の根拠にならず、元版を維持する。
      }
      if (!candidate)
        return writeCoordinatorStateSnapshot(null, null, null, null);
      acceptance = { before: settlement.before, candidate };
    }
    const accepted = writeCoordinatorStateSnapshot(
      null,
      settlement.repository,
      acceptance.candidate,
      {
        recoveryId: settlement.recoveryId,
        consumer: settlement.consumer,
        cleanupStatus: null,
        dockerTerminal: null,
        projectAcceptanceReader: settlement.readProjectAcceptance,
        savedTerminal: { ...acceptance, mode: "accept" },
      },
    );
    if (accepted.filesystemEffectIssued) settlement.acceptance = acceptance;
    if (
      accepted.status !== "completed" ||
      !accepted.snapshotConfirmed ||
      !accepted.lockReleased
    )
      return accepted;
    settlement.before = acceptance.candidate;
    delete settlement.acceptance;
    const candidate = prepareCoordinatorStateCompletionSnapshot(
      settlement.before,
      settlement.recoveryId,
      settlement.repository.repositoryBinding,
    );
    if (!candidate)
      return writeCoordinatorStateSnapshot(null, null, null, null);
    completion = { before: settlement.before, candidate };
  }
  const saved = writeCoordinatorStateSnapshot(
    null,
    settlement.repository,
    completion.candidate,
    {
      recoveryId: settlement.recoveryId,
      consumer: settlement.consumer,
      cleanupStatus: null,
      dockerTerminal: null,
      projectAcceptanceReader: settlement.readProjectAcceptance,
      savedTerminal: { ...completion, mode: "complete" },
    },
  );
  if (saved.filesystemEffectIssued) settlement.completion = completion;
  return saved;
}

/**
 * 整理後の上位確定中断に対し、現在の配送残件不存在だけを確認する。
 * @responsibility 固定上位ACK・現在参照不存在・既存終端履歴を同じ読取り排他で照合する。
 * @trace ARCH-000008
 * @input rootCapability: 現在Root、recoveryId: exact参照、readProjectAcceptance: 固定上位Reader。
 * @returns 配送残件不存在の確認と排他解放、またはblocked。
 * @precondition 上位Ownerが同じAttemptのACKを耐久保存している。
 * @postcondition Task成功・過去ACK保存・実資源清掃を新しく証明しない。
 * @effect 現在Root・状態・履歴の読取りと既存短期排他だけ。
 * @failure 対象残存・ACK不一致・履歴欠測・保存途中・観測変更・解放不明は停止。
 * @invariant 操作を履歴から復元せず、Provider要求・Task再実行・保存を発行しない。
 * @boundary 現在Repositoryと上位耐久配送の終了確認。
 * @security 任意Pathや呼出し元の履歴本文を受け取らない。
 * @concurrency 状態・履歴・上位ACKを同じ既存Kernel Lock内で確認する。
 */
export function observeRuntimeOwnedCoordinatorCompletedDelivery(
  rootCapability: unknown,
  recoveryId: unknown,
  readProjectAcceptance: unknown,
) {
  if (
    typeof recoveryId !== "string" ||
    typeof readProjectAcceptance !== "function"
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_delivery_observation_input_invalid",
      deliveryAbsentObserved: false,
      lockReleased: true,
    });
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  const observed = readCoordinatorStateSnapshot(
    repository,
    null,
    null,
    typeof recoveryId === "string" &&
      typeof readProjectAcceptance === "function"
      ? {
          recoveryId,
          readProjectAcceptance: readProjectAcceptance as () => unknown,
        }
      : null,
  );
  const completed =
    typeof recoveryId === "string" &&
    typeof readProjectAcceptance === "function" &&
    observed.status === "completed" &&
    observed.lockReleased &&
    observed.deliveryAbsent;
  return Object.freeze({
    status: completed ? ("completed" as const) : ("blocked" as const),
    reason: completed
      ? "coordinator_delivery_remaining_absent"
      : observed.status === "blocked"
        ? observed.reason
        : "coordinator_delivery_absence_unconfirmed",
    deliveryAbsentObserved: completed,
    lockReleased: observed.lockReleased,
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
    (item) => item.recoveryId === recoveryId,
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
 * @input repository: 内部保存結合、recoveryId: 対象参照、recoveredDelivery: 終了限定準備、completedDelivery: 整理済み不存在観測の固定上位Reader結合。
 * @returns 確認済みSnapshotまたは値を持たないblocked。
 * @precondition 保存結合は現在Ownerまたは登録済み終端Contextから得る。
 * @postcondition 排他解放不明の本文を利用側へ渡さない。
 * @effect 現在Rootと固定Fileの読取り、既存短期排他だけ。
 * @failure Root・File・対象操作不一致、通常Readerの保存途中、限定準備の別候補、解放不明は停止する。
 * @invariant 読取りは処置Authorityと新品証明を作らない。
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
  recoveredDelivery: Readonly<{
    recoveryId: string;
    readProjectAcceptance: () => unknown;
  }> | null = null,
  completedDelivery: Readonly<{
    recoveryId: string;
    readProjectAcceptance: () => unknown;
  }> | null = null,
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
      reentry: null,
      deliveryAbsent: false,
    });
  if (!repository) return blocked("coordinator_state_owner_invalid", true);
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock) return blocked("coordinator_state_lock_unavailable", false);
  let value: ReturnType<typeof decodeCoordinatorStateSnapshot> = null;
  let reentry: Readonly<{
    mode: "accept" | "complete";
    candidate: Buffer;
  }> | null = null;
  let reason = "coordinator_state_read_unconfirmed";
  let deliveryAbsent = false;
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
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const names = fs.readdirSync(initial.directory);
    const allowedNames = recoveredDelivery
      ? ["state.json", "history.jsonl", "state.pending.json", "state.lock"]
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
    if (completedDelivery) {
      const acknowledgement = decodeCoordinatorProjectAcceptance(
        completedDelivery.readProjectAcceptance(),
        repository.repositoryBinding,
      );
      const recovery = parseDockerTaskRecoveryId(completedDelivery.recoveryId);
      const targets = [
        decoded.snapshot.operations,
        decoded.snapshot.unresolvedRecoveries,
        decoded.snapshot.pendingDeliveries,
      ];
      if (
        !acknowledgement ||
        !recovery ||
        acknowledgement.recoveryId !== completedDelivery.recoveryId ||
        targets.some((entries) =>
          entries.some(
            (entry) =>
              entry.recoveryId === completedDelivery.recoveryId ||
              parseDockerTaskRecoveryId(entry.recoveryId)?.operationNonce ===
                recovery.operationNonce,
          ),
        )
      )
        throw new Error("delivery_target_present_or_unconfirmed");
      const metadata = fs.lstatSync(completedHistoryFile);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("delivery_history_file");
      completedHistory = readStableBoundedFileSnapshot(
        completedHistoryFile,
        MAX_COORDINATOR_STATE_BYTES,
      );
      const rows = decodeCoordinatorHistoryRows(completedHistory.bytes);
      const row = rows?.find(
        (entry) => entry.recoveryId === completedDelivery.recoveryId,
      );
      if (!row || row.summarySha256 !== acknowledgement.resultId)
        throw new Error("delivery_history_missing_or_mismatched");
      deliveryAbsent = true;
    }
    let pending: ReturnType<typeof readStableBoundedFileSnapshot> | null = null;
    let marker: ReturnType<typeof readStableBoundedFileSnapshot> | null = null;
    const markerFile = path.join(initial.directory, "state.lock");
    if (recoveredDelivery && names.includes("state.lock")) {
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
    if (recoveredDelivery && names.includes("state.pending.json")) {
      const pendingMetadata = fs.lstatSync(pendingFile);
      if (
        !pendingMetadata.isFile() ||
        pendingMetadata.isSymbolicLink() ||
        pendingMetadata.nlink !== 1
      )
        throw new Error("pending_file");
      pending = readStableBoundedFileSnapshot(
        pendingFile,
        MAX_COORDINATOR_STATE_BYTES,
      );
      const current = Buffer.from(
        `${encodeCoordinatorStateValue(decoded.snapshot)}\n`,
      );
      const acknowledgement = JSON.parse(
        encodeCoordinatorStateValue(recoveredDelivery.readProjectAcceptance()),
      );
      if (acknowledgement?.recoveryId !== recoveredDelivery.recoveryId)
        throw new Error("pending_delivery_target_mismatch");
      const accepted = prepareCoordinatorStateProjectAcceptanceSnapshot(
        current,
        acknowledgement,
        repository.repositoryBinding,
      );
      const completion = accepted?.equals(current)
        ? prepareCoordinatorStateCompletionSnapshot(
            current,
            recoveredDelivery.recoveryId,
            repository.repositoryBinding,
          )
        : null;
      if (accepted && pending.bytes.equals(accepted))
        reentry = { mode: "accept", candidate: Buffer.from(accepted) };
      else if (completion && pending.bytes.equals(completion))
        reentry = { mode: "complete", candidate: Buffer.from(completion) };
      else {
        reason = "coordinator_state_reentry_required";
        throw new Error("pending_delivery_candidate_mismatch");
      }
    }
    if (recoveryId !== null) {
      const operation = decoded.snapshot.operations.find(
        (value) => value.recoveryId === recoveryId,
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
  try {
    lockReleased = lock.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased)
    return blocked("coordinator_state_lock_release_unconfirmed", false);
  if (!value) return blocked(reason, true);
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_state_read_confirmed",
    lockReleased: true,
    value,
    reentry,
    deliveryAbsent,
  });
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
        (value) => value.recoveryId === item.recoveryId,
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
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock)
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: false,
    });
  let effectIssued = false;
  let prepared = false;
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
    prepared = true;
  } catch {
    prepared = false;
  }
  let lockReleased = false;
  try {
    lockReleased = lock.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) initializations.delete(managementCapability);
  return Object.freeze({
    status: prepared && lockReleased ? "prepared" : "blocked",
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
 * 通常保存と終端限定保存の固定I/Oを単一所有する。
 * @responsibility 検証済み結合、限定差分、元版照合と保存確定を共用する。
 * @trace ARCH-000008
 * @input managementCapability: 通常初期化Ownerまたはnull、repository: 検証済み借用、candidateBytes: 次本文、settlement: 終端制約またはnull。
 * @returns 保存確認・排他解放・Effectを分けた結果。
 * @precondition 公開内部wrapperが借用を検証している。
 * @postcondition 終端経路から初期化・新要求・他操作変更を発行しない。
 * @effect 固定現在状態の読取り・短命保存・置換だけ。
 * @failure 結合、差分、元版、保存または排他不明はblocked。
 * @invariant 旧形式fallbackと二重Writerを作らない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意PathやCaller supplied借用を受けない。
 * @concurrency 既存Repository単位排他を短期保持する。
 */
function writeCoordinatorStateSnapshot(
  managementCapability: unknown,
  repository: Pick<
    NonNullable<
      ReturnType<typeof borrowRuntimeOwnedCoordinatorStateRepository>
    >,
    "repositoryRoot" | "repositoryBinding" | "operationId" | "revalidate"
  > | null,
  candidateBytes: unknown,
  settlement: {
    recoveryId: string;
    cleanupStatus: string | null;
    dockerTerminal: ReturnType<
      typeof borrowRuntimeOwnedDockerTerminalObservations
    >;
    historyInitial?: true;
    historyPublish?: true;
    deliveryRegistration?: unknown;
    projectAcceptanceReader?: () => unknown;
    consumer?: "coordinator_cli" | "project_runtime" | "workbench";
    completion?: { before: Buffer; candidate: Buffer };
    managementCapability?: unknown;
    savedTerminal?: {
      before: Buffer;
      candidate: Buffer;
      mode: "accept" | "complete";
    };
  } | null,
  unissued?: Readonly<{
    notice: unknown;
    recoveryCapability: unknown;
    recoveryId: string;
    purpose: string;
  }>,
) {
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
  if (!repository || !candidate || !bytes)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_input_invalid",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: true,
    });
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_lock_unavailable",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: false,
    });
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
    let completionConfirmed = false;
    let savedTerminalConfirmed = false;
    if (settlement?.savedTerminal) {
      const fixed = settlement.savedTerminal;
      const before = decodeCoordinatorStateSnapshot(
        fixed.before,
        repository.repositoryBinding,
      );
      const previous = before?.snapshot.operations.find(
        (value) => value.recoveryId === settlement.recoveryId,
      );
      const identity = previous ? JSON.parse(previous.identityJson) : null;
      const deliveries = before?.snapshot.pendingDeliveries.filter(
        (value) => value.recoveryId === settlement.recoveryId,
      );
      const registered = prepareCoordinatorStateResultDeliverySnapshot(
        fixed.before,
        settlement.recoveryId,
        deliveries?.map((value) => value.consumer),
        repository.repositoryBinding,
      );
      if (
        !previous ||
        identity?.operationId !== repository.operationId ||
        identity?.consumer !== "project_runtime" ||
        settlement.consumer !== "project_runtime" ||
        !previous.history?.confirmed ||
        !registered?.equals(fixed.before) ||
        !fixed.candidate.equals(bytes) ||
        !(currentBytes?.equals(fixed.before) || currentBytes?.equals(bytes)) ||
        !settlement.projectAcceptanceReader ||
        settlement.dockerTerminal !== null ||
        settlement.cleanupStatus !== null ||
        settlement.completion ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        settlement.deliveryRegistration !== undefined
      )
        throw new Error("saved_terminal_scope_unconfirmed");
      const acknowledgement = JSON.parse(
        encodeCoordinatorStateValue(settlement.projectAcceptanceReader()),
      );
      if (acknowledgement?.recoveryId !== settlement.recoveryId)
        throw new Error("saved_terminal_acceptance_target_mismatch");
      const accepted = prepareCoordinatorStateProjectAcceptanceSnapshot(
        fixed.before,
        acknowledgement,
        repository.repositoryBinding,
      );
      const expected =
        fixed.mode === "accept"
          ? accepted
          : prepareCoordinatorStateCompletionSnapshot(
              fixed.before,
              settlement.recoveryId,
              repository.repositoryBinding,
            );
      if (
        !expected?.equals(bytes) ||
        (fixed.mode === "complete" && !accepted?.equals(fixed.before))
      )
        throw new Error("saved_terminal_acceptance_unconfirmed");
      const line = prepareCoordinatorStateHistoryLine(
        fixed.before,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const rows = decodeCoordinatorHistoryRows(
        read("history.jsonl") ?? Buffer.alloc(0),
      );
      const row = rows?.find(
        (value) => value.recoveryId === settlement.recoveryId,
      );
      if (
        !line ||
        !rows ||
        createHash("sha256").update(line).digest("hex") !==
          previous.history.lineSha256 ||
        (row !== undefined && !Buffer.from(row.line).equals(line)) ||
        read("history.pending.jsonl") !== null
      )
        throw new Error("saved_terminal_history_unconfirmed");
      savedTerminalConfirmed = true;
      completionConfirmed = fixed.mode === "complete";
    } else if (settlement?.completion) {
      const before = decodeCoordinatorStateSnapshot(
        settlement.completion.before,
        repository.repositoryBinding,
      );
      const previous = before?.snapshot.operations.find(
        (operation) => operation.recoveryId === settlement.recoveryId,
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
        (completionPolicy === "durable"
          ? !settlement.projectAcceptanceReader
          : settlement.projectAcceptanceReader !== undefined) ||
        settlement.deliveryRegistration !== undefined ||
        settlement.historyInitial ||
        settlement.historyPublish ||
        before.snapshot.pendingDeliveries.some(
          (delivery) =>
            delivery.recoveryId === settlement.recoveryId &&
            delivery.consumer !== "project_runtime",
        )
      )
        throw new Error("completion_scope_unconfirmed");
      const accepted =
        completionPolicy === "durable" && settlement.projectAcceptanceReader
          ? prepareCoordinatorStateProjectAcceptanceSnapshot(
              settlement.completion.before,
              settlement.projectAcceptanceReader(),
              repository.repositoryBinding,
            )
          : settlement.completion.before;
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
            (operation) => operation.recoveryId === settlement.recoveryId,
          )
        : null;
      if (
        !accepted?.equals(settlement.completion.before) ||
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
      current?.snapshot.operations.some(
        (operation) =>
          operation.recoveryId === settlement.recoveryId &&
          operation.history?.confirmed === true,
      ) === true;
    const pendingBytes = read("state.pending.json");
    if (pendingBytes !== null && !pendingBytes.equals(bytes))
      throw new Error("other_pending");
    const initialRoot =
      currentBytes === null &&
      managementCapability !== null &&
      typeof managementCapability === "object" &&
      initializations.get(managementCapability)?.repositoryBinding ===
        repository.repositoryBinding &&
      initializations.get(managementCapability)?.boundaryIdentity ===
        initial.boundaryIdentity &&
      initializations.get(managementCapability)?.payloadSha256 ===
        candidate.payloadSha256 &&
      initializations.get(managementCapability)?.publicationIssued === false &&
      names.every((name) =>
        ["state.pending.json", "state.lock"].includes(name),
      );
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
        initialRoot ? "new" : "existing",
      );
      if (treatment === "blocked") throw new Error("pending_conflict");
      if (
        treatment === "publish_pending" &&
        !completionConfirmed &&
        !validateCoordinatorStateTransition(
          currentBytes,
          pendingBytes,
          repository.repositoryBinding,
        )
      )
        throw new Error("transition");
    } else if (
      !currentBytes?.equals(bytes) &&
      !completionConfirmed &&
      (!validateCoordinatorStateTransition(
        currentBytes,
        bytes,
        repository.repositoryBinding,
      ) ||
        (currentBytes === null && !initialRoot))
    )
      throw new Error("transition");
    if (
      settlement?.deliveryRegistration === undefined &&
      settlement?.projectAcceptanceReader === undefined &&
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
      if (
        settlement.projectAcceptanceReader !== undefined &&
        !completionConfirmed
      ) {
        if (settlement.deliveryRegistration !== undefined)
          throw new Error("settlement_delivery_modes_conflict");
        const expected = prepareCoordinatorStateProjectAcceptanceSnapshot(
          currentBytes,
          settlement.projectAcceptanceReader(),
          repository.repositoryBinding,
        );
        if (!expected?.equals(bytes))
          throw new Error("settlement_project_acceptance_unconfirmed");
      }
      for (const previous of current.snapshot.operations) {
        const next = candidate.snapshot.operations.find(
          (value) => value.recoveryId === previous.recoveryId,
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
                (value) => value.recoveryId === settlement.recoveryId,
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
            next.resources.some(
              (resource) =>
                resource.request !== "not_requested" &&
                resource.request !== "not_issued" &&
                (resource.request !== "identified" ||
                  resource.observation !== "absent"),
            ))
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
        ((settlement?.historyInitial || settlement?.historyPublish) &&
          operation.recoveryId === settlement.recoveryId) ||
        encodeCoordinatorStateValue(operation.history) !==
          encodeCoordinatorStateValue(previous?.history ?? null)
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
              (value) => value.recoveryId === operation.recoveryId,
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
            (value) => value.recoveryId === item.recoveryId,
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
    if (settlement?.historyPublish && !historyAlreadyConfirmed) {
      if (!currentBytes || !current) throw new Error("history_current_missing");
      const line = prepareCoordinatorStateHistoryLine(
        currentBytes,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
      const target = current.snapshot.operations.find(
        (value) => value.recoveryId === settlement.recoveryId,
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
      if (!sameRow && !admission)
        throw new Error("history_initial_proof_missing");
      if (admission && admission.lineSha256 !== target.history.lineSha256)
        throw new Error("history_proof_conflict");
      const configuration = readCoordinatorConfig(verified.capability);
      if (configuration.status !== "ready")
        throw new Error("history_config_invalid");
      const days = configuration.config.historyRetentionDays;
      const now = admission?.pending?.now ?? new Date().toISOString();
      let after: Buffer;
      if (pendingHistory !== null) {
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
        managementCapability !== null &&
        typeof managementCapability === "object"
      ) {
        const proof = initializations.get(managementCapability);
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
    if (settlement?.historyPublish && !historyAlreadyConfirmed) {
      const finalLine = prepareCoordinatorStateHistoryLine(
        bytes,
        settlement.recoveryId,
        repository.repositoryBinding,
      );
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
    // 排他markerは完了時に回収する。履歴やoperation記録を削除しない。
    if (!read("state.lock")?.equals(marker)) throw new Error("marker");
    assertBoundary();
    filesystemEffectIssued = true;
    fs.unlinkSync(path.join(directory, "state.lock"));
    fileIdentities.delete("state.lock");
    if (read("state.lock") !== null || !read("state.json")?.equals(bytes))
      throw new Error("final");
    snapshotConfirmed = true;
    if (
      managementCapability !== null &&
      typeof managementCapability === "object"
    )
      initializations.delete(managementCapability);
    reason = "coordinator_state_snapshot_confirmed";
  } catch {
    reason = "coordinator_state_storage_unconfirmed";
  }
  let lockReleased = false;
  try {
    lockReleased = lock.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) {
    if (
      managementCapability !== null &&
      typeof managementCapability === "object"
    )
      initializations.delete(managementCapability);
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
  kind: "resource" | "cleanup" | "host" | "lifecycle" | "references",
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
    (item) => item.recoveryId === recoveryId,
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
 * Host開始の予定保存・実遷移・結果保存を同じ操作へ接続する。
 *
 * @responsibility Docker要求前にHost開始を現在状態へ確定し、中断後も同じ予定へ再入場する。
 * @trace ARCH-000008
 * @input managementCapability: 同じ実Host Owner、recoveryId: 保存済み操作のexact参照。
 * @returns 保存・排他解放・Host要求と確認を分けた結果と同じ回復参照。
 * @precondition 開始Identityが確定済みで、Home Leaseは開始Ownerが保持している。
 * @postcondition 予定保存後だけHostを遷移させ、実token照合後だけ予定を解消する。
 * @effect 同じRepositoryのstate.jsonと、所有済みHost記録の開始遷移のみ。
 * @failure 別操作、実Host不一致、保存・解放不明、遷移例外は予定と回復参照を保持して停止する。
 * @invariant Host開始確認をDocker受理・Provider開始・回復完了へ昇格しない。
 * @boundary 本番開始Owner、現在状態Writerと同じHost Owner。
 * @security 任意Path・予測token・Caller supplied遷移本文を受け付けない。
 * @concurrency 同期Host遷移の前後を実Ownerで再観測し、各保存は元版照合する。
 */
export function beginRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
) {
  return transitionRuntimeOwnedCoordinatorHostSubmission(
    managementCapability,
    recoveryId,
    false,
  );
}

/**
 * 実Hostの開始または通常復帰を同じ予定保存経路で確定する。
 * @responsibility 処置前保存と実Ownerの前後観測を共通化する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId: 対象。complete: 内部で固定した遷移方向。
 * @returns 保存と実遷移の確認を分けた結果。
 * @precondition 通常復帰の呼出し側は実清掃とMount結果を照合済み。
 * @postcondition 後継tokenを観測できた場合だけ予定を解消する。
 * @effect 同じ操作のHost記録とstate.jsonのみ。
 * @failure 不一致・保存不明・応答喪失は予定とexact参照を保持する。
 * @invariant 保存tokenからAuthorityを作らず、後継観測時に処置を再発行しない。
 * @boundary 同じHost OwnerとRepository内の状態保存。
 * @security 任意PathとCaller supplied予定を受け付けない。
 * @concurrency 既存Writer排他と同期Host前後観測を用いる。
 */
function transitionRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
  complete: boolean,
) {
  const currentState = complete ? "docker_submission_started" : "host_only";
  const nextState = complete ? "host_only" : "docker_submission_started";
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const blocked = {
    status: "blocked" as const,
    reason: "coordinator_host_submission_invalid",
    revision: null as number | null,
    payloadSha256: null as string | null,
    recoveryIds: Object.freeze([] as string[]),
    recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    filesystemEffectIssued: false,
    snapshotConfirmed: false,
    lockReleased: current.lockReleased,
    hostTransitionRequested: false,
    hostTransitionConfirmed: false,
  };
  if (!repository || current.status !== "completed" || !current.value)
    return Object.freeze({
      ...blocked,
      reason: current.status === "blocked" ? current.reason : blocked.reason,
    });
  const operation = current.value.snapshot.operations.find(
    (item) => item.recoveryId === recoveryId,
  );
  if (
    operation?.phase !== "executing" ||
    operation.host.cleanup !== "not_requested" ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return Object.freeze(blocked);
  let saved = blocked;
  let hostTransitionRequested = false;
  try {
    const host = borrowOwnedHostRecoverySnapshot(managementCapability);
    let transition: {
      currentToken: string;
      expectedToken: string;
      currentState: string;
      nextState: string;
    };
    if (operation.host.pendingTransitionJson === null) {
      if (
        host.snapshot.record.state !== currentState ||
        host.snapshot.token !== operation.host.currentToken
      )
        return Object.freeze(blocked);
      const parsed = parseHostRecoveryToken(host.snapshot.token);
      const nextHash = createHash("sha256")
        .update(
          `${JSON.stringify({ ...host.snapshot.record, state: nextState })}\n`,
        )
        .digest("hex");
      const intent = {
        currentToken: host.snapshot.token,
        expectedToken: `host.${parsed.rootName}.${parsed.nonce}.${nextHash}`,
        rootName: parsed.rootName,
        nonce: parsed.nonce,
        currentState,
        nextState,
        recordBefore: host.snapshot.record,
      };
      transition = intent;
      const intentSaved = checkpointRuntimeOwnedCoordinatorHost(
        managementCapability,
        recoveryId,
        {
          ...operation.host,
          pendingTransitionJson: `${JSON.stringify(intent)}\n`,
        },
      );
      if (intentSaved.status !== "completed")
        return Object.freeze({ ...blocked, ...intentSaved });
      saved = { ...blocked, ...intentSaved, status: "blocked" };
    } else {
      transition = JSON.parse(operation.host.pendingTransitionJson);
      if (
        transition.currentState !== currentState ||
        transition.nextState !== nextState
      )
        return Object.freeze(blocked);
    }
    const before = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (before.snapshot.token === transition.currentToken) {
      hostTransitionRequested = true;
      const observed = complete
        ? completeOwnedDockerSubmissionRecovery(
            managementCapability,
            transition.currentToken,
          )
        : beginOwnedDockerSubmissionRecovery(
            managementCapability,
            repository.operationId,
          );
      if (observed !== transition.expectedToken)
        throw new Error("coordinator_host_submission_unconfirmed");
    } else if (before.snapshot.token !== transition.expectedToken) {
      throw new Error("coordinator_host_submission_unconfirmed");
    }
    const after = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (
      after.snapshot.token !== transition.expectedToken ||
      after.snapshot.record.state !== nextState
    )
      throw new Error("coordinator_host_submission_unconfirmed");
    const confirmed = checkpointRuntimeOwnedCoordinatorHost(
      managementCapability,
      recoveryId,
      {
        currentToken: transition.expectedToken,
        pendingTransitionJson: null,
        cleanup: operation.host.cleanup,
      },
    );
    return Object.freeze({
      ...blocked,
      ...confirmed,
      hostTransitionRequested,
      hostTransitionConfirmed: confirmed.status === "completed",
    });
  } catch {
    return Object.freeze({
      ...saved,
      reason: "coordinator_host_submission_unconfirmed",
      snapshotConfirmed: false,
      filesystemEffectIssued:
        saved.filesystemEffectIssued || hostTransitionRequested,
      hostTransitionRequested,
    });
  }
}

/**
 * 実資源回収とMount完了を照合してHostを通常状態へ戻す。
 * @responsibility 最終Controller結果に依存せず実終了根拠をHost復帰へ接続する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId、plan、recoveryCapability: 元対象。cleanupOutcome、mountCompletion: 各Ownerの元結果。
 * @returns 現在状態保存とHost実遷移の確認結果。
 * @precondition 元Docker清掃とMount終了が同じ本番Ownerから返却されている。
 * @postcondition exact五資源の回収を保存し、Host後継観測後だけ復帰予定を解消する。
 * @effect 同じRepositoryのstate.jsonと所有Host記録だけ。
 * @failure コピー・別対象・欠測・ID不明・保存不明はHost復帰前に拒否する。
 * @invariant Home Lease解放・Host領域清掃・結果受理は別条件として維持する。
 * @boundary 本番清掃・Mount・Hostの各Ownerと同じ操作の保存。
 * @security 任意の成功booleanや保存値を実終了根拠にしない。
 * @concurrency 各保存を既存排他で確定し、Host再入場では元結果を再照合する。
 */
export function completeRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
  plan: Parameters<typeof verifyRuntimeOwnedDockerCleanupOutcome>[1] &
    Readonly<{ consumer: "coordinator_cli" | "project_runtime" | "workbench" }>,
  recoveryCapability: unknown,
  cleanupOutcome: unknown,
  mountCompletion: unknown,
) {
  let cleanupEffectIssued = false;
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const blocked = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_host_completion_invalid",
    recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    snapshotConfirmed: false,
    filesystemEffectIssued: false,
    lockReleased: current.lockReleased,
    hostTransitionRequested: false,
    hostTransitionConfirmed: false,
  });
  try {
    const operation = current.value?.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    if (
      current.status !== "completed" ||
      !operation ||
      !repository ||
      operation.phase !== "executing"
    )
      return blocked;
    const identity = JSON.parse(operation.identityJson);
    if (
      !plan ||
      plan.operationId !== repository.operationId ||
      identity.operationId !== plan.operationId ||
      [
        "provider",
        "consumer",
        "grantRef",
        "profileId",
        "stableLogicalHomeBindingHash",
        "providerHomeIdentityHash",
        "providerHomeProtectionHash",
        "localUserBindingHash",
        "ownershipLabel",
        "operationMode",
      ].some(
        (key) =>
          identity[key] !== (plan as unknown as Record<string, unknown>)[key],
      ) ||
      (
        [
          ["auth", "authContainerName"],
          ["provider", "providerContainerName"],
          ["proxy", "proxyContainerName"],
          ["internal", "internalNetworkName"],
          ["egress", "egressNetworkName"],
        ] as const
      ).some(
        ([key, field]) =>
          identity.resources[key] !==
          (plan as unknown as Record<string, unknown>)[field],
      ) ||
      identity.images.provider !== plan.providerImageDigest ||
      identity.images.proxy !== plan.proxyImageDigest
    )
      return blocked;
    const host = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (operation.host.pendingTransitionJson === null) {
      if (
        host.snapshot.record.state !== "docker_submission_started" ||
        host.snapshot.token !== operation.host.currentToken
      )
        return blocked;
    } else {
      const pending = JSON.parse(operation.host.pendingTransitionJson);
      if (
        pending.currentState !== "docker_submission_started" ||
        pending.nextState !== "host_only"
      )
        return blocked;
    }
    const observations = verifyRuntimeOwnedDockerCleanupOutcome(
      cleanupOutcome,
      plan,
      recoveryCapability,
      managementCapability,
    );
    if (
      observations?.length !== 5 ||
      observations.some(
        (item) =>
          item.observation !== "not_requested" && item.observation !== "absent",
      ) ||
      !verifyRuntimeOwnedProviderHomeMountCompletion(
        mountCompletion,
        managementCapability,
        plan.activeMountCapability,
        plan.operationId,
        plan.stableLogicalHomeBindingHash,
      )
    )
      return blocked;
    const cleanup = cleanupOutcome as Readonly<Record<string, unknown>>;
    if (
      cleanup.confirmed !== true ||
      cleanup.processTreeTerminated !== true ||
      cleanup.containersAbsent !== true ||
      cleanup.networksAbsent !== true
    )
      return blocked;
    const saved = checkpointRuntimeOwnedCoordinatorCleanup(
      managementCapability,
      recoveryId,
      observations,
    );
    cleanupEffectIssued = saved.filesystemEffectIssued;
    if (saved.status !== "completed")
      return Object.freeze({ ...blocked, ...saved });
    const transition = transitionRuntimeOwnedCoordinatorHostSubmission(
      managementCapability,
      recoveryId,
      true,
    );
    return Object.freeze({
      ...transition,
      filesystemEffectIssued:
        cleanupEffectIssued || transition.filesystemEffectIssued,
    });
  } catch {
    return Object.freeze({
      ...blocked,
      filesystemEffectIssued: cleanupEffectIssued,
    });
  }
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
