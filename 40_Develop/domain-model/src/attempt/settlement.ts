/**
 * 元実行Ownerの正常終了・結果受領と保存手順を調整する。
 * @responsibility 元Host／Controller入力、Consumerの終了方式、一つの正常終了Contextを所有する。
 * @trace ARCH-000008
 * @security 保存済み値から実行・回復Authorityを復元しない。
 */

import type { CoordinatorStateTaskOperation } from "../attempt/types.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import {
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
} from "../state/crud.ts";
import { decodeRuntimeDomainSnapshot as decodeCoordinatorStateSnapshot } from "../state/validation.ts";
import {
  observeRuntimeSettlementStorageAccess as borrowRuntimeOwnedCoordinatorSettlementRepository,
  observeRuntimeTerminalForStorage as borrowRuntimeOwnedDockerTerminalObservations,
  captureRuntimeCleanupVerification as captureOwnedOperationCleanupVerification,
  runtimeStorageOperationIdentity,
} from "../storage/runtime-repository.ts";
import {
  projectRegisteredCoordinatorResult,
  readCoordinatorHistoryResumeCandidate,
  readCoordinatorStateSnapshot,
  readRuntimeOwnedCoordinatorStateSnapshot,
  writeCoordinatorStateSnapshot,
} from "../storage/runtime-store.ts";
import { coordinatorConsumerCompletionPolicy } from "../task/validation.ts";

const liveSettlements = new WeakMap<
  object,
  {
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
    context && typeof context === "object"
      ? liveSettlements.get(context)
      : null;
  return value?.kind === "live" ? value : null;
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
  liveSettlements.set(context, {
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
      `${encodeRuntimeStateValue(current.value.snapshot)}\n`,
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
      Buffer.from(`${encodeRuntimeStateValue(candidate)}\n`),
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
      Buffer.from(`${encodeRuntimeStateValue(current.value.snapshot)}\n`),
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
      encodeRuntimeStateValue(operation.primaryFailure) !==
        encodeRuntimeStateValue(terminal.primaryFailure) ||
      encodeRuntimeStateValue(operation.outcome) !==
        encodeRuntimeStateValue(outcome) ||
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
          Buffer.from(`${encodeRuntimeStateValue(current.value.snapshot)}\n`),
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
    Buffer.from(`${encodeRuntimeStateValue(current.value.snapshot)}\n`),
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
      `${encodeRuntimeStateValue(current.value.snapshot)}\n`,
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
      Buffer.from(`${encodeRuntimeStateValue(current.value.snapshot)}\n`),
      cleanupOutcome,
      dockerCompletion,
    );
  const owner = settlement.managementCapability;
  const resume = readCoordinatorHistoryResumeCandidate(
    runtimeStorageOperationIdentity(owner),
    settlement.recoveryId,
  );
  const candidate =
    current.value && operation?.history
      ? operation.history.confirmed
        ? Buffer.from(`${encodeRuntimeStateValue(current.value.snapshot)}\n`)
        : prepareCoordinatorStateHistorySnapshot(
            Buffer.from(`${encodeRuntimeStateValue(current.value.snapshot)}\n`),
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
