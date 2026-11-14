/**
 * Attemptの資源記録・回復結果の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import {
  prepareOwnedStateInitialization,
  readHistoryResumeCandidate,
  readOperationStateStage,
  type readRecoveryState,
  saveAuthenticationClosure,
  writeOwnedStateSnapshot,
  writeStateSnapshot,
} from "../state/crud.ts";
import {
  classifyResourcePublication,
  decodeStateSnapshot,
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
  prepareStateCleanupSnapshot,
  prepareStateCompletionSnapshot,
  prepareStateHistorySnapshot,
  prepareStateHostSnapshot,
  prepareStateLifecycleSnapshot,
  prepareStateOperationSnapshot,
  prepareStateResourceSnapshot,
  prepareStateRestartSnapshot,
  snapshotStateRecord,
} from "../state/validation.ts";
import {
  captureExecutionCleanupVerification,
  executionStorageOperationIdentity,
  observeExecutionRecoveryRepository,
  observeExecutionSettlementStorageAccess,
  observeExecutionTerminalForStorage,
  observeOperationRepository,
} from "../storage/lock.ts";
import type { StorageRepository } from "../storage/store.ts";
import { readStateSnapshot } from "../storage/store.ts";
import type { ExecutionOperationRecord, OperationResources } from "./types.ts";
import {
  areTaskResourcesSettled,
  isDockerRestartCheckpointSettled,
  parseDockerTaskRecoveryId,
  validateResourceBook,
  validateResourceBookTransition,
} from "./validation.ts";

/**
 * 初期Snapshotと最初のIntent、又は同じ資源の後続観測を適用する。
 * @responsibility 通知の保存断面だけを扱い、ID欠測や成功から未発行を推測しない。
 * @trace ARCH-000008
 * @input previous: 元資源記録。value: 発行前・Receipt・発見・正式未発行のイベント。
 * @returns 検査済み次値、又はnull。nullは更新拒否であり不存在ではない。
 * @effect N/A: 値変換だけ。
 */
export function applyResourceEvent(
  previous: OperationResources | null,
  value: unknown,
): OperationResources | null {
  try {
    const event = JSON.parse(encodeStateValue(value));
    if (
      !validateResourceBook(previous) ||
      typeof event.key !== "string" ||
      !["submission", "receipt", "identified", "not_issued"].includes(
        event.event,
      ) ||
      !hasExecutionStateRecordKeys(
        event,
        event.event === "not_issued"
          ? ["event", "key"]
          : ["event", "key", "snapshot", "cleanup"],
      )
    )
      return null;
    if (!previous && event.event !== "submission") return null;
    const snapshot =
      event.event === "not_issued" ? previous?.snapshot : event.snapshot;
    const cleanup =
      event.event === "not_issued" ? previous?.cleanup : event.cleanup;
    if (!snapshot || !Array.isArray(snapshot.resources)) return null;
    const checkpoints =
      previous?.checkpoints ??
      snapshot.resources.map((item: { key: string }) => ({
        key: item.key,
        submission: "none",
        receiptSource: null,
        observation: "unobserved",
        absenceEvidenceSha256: null,
      }));
    const prior = checkpoints.find(
      (item: { key: string }) => item.key === event.key,
    );
    const resource = snapshot.resources.find(
      (item: { key: string }) => item.key === event.key,
    );
    if (!prior || !resource) return null;
    let checkpoint: OperationResources["checkpoints"][number];
    if (event.event === "submission") {
      if (prior.submission !== "none" || resource.identity.dockerId !== null)
        return null;
      checkpoint = { ...prior, submission: "intent_saved" };
    } else if (event.event === "not_issued") {
      if (
        prior.submission !== "intent_saved" ||
        resource.identity.dockerId !== null ||
        resource.request !== "not_issued"
      )
        return null;
      checkpoint = { ...prior, submission: "not_issued" };
    } else {
      if (
        prior.submission !== "intent_saved" ||
        !isSha256Hex(resource.identity.dockerId)
      )
        return null;
      checkpoint = {
        ...prior,
        receiptSource:
          event.event === "receipt"
            ? "docker_create_result"
            : "runtime_reconciliation",
        observation:
          event.event === "identified" ? "present" : prior.observation,
        absenceEvidenceSha256: null,
      };
    }
    const book = {
      snapshot,
      cleanup,
      checkpoints: checkpoints.map((item: { key: string }) =>
        item.key === event.key ? checkpoint : item,
      ),
    };
    return validateResourceBook(book) &&
      validateResourceBookTransition(previous, book)
      ? book
      : null;
  } catch {
    return null;
  }
}

/**
 * 元Snapshotとkey別の終了観測を同じ記録へ結合する。
 * @responsibility 観測の相関だけを保存値にし、物理的不存在の観測を実行しない。
 * @trace ARCH-000008
 * @input previous: 元記録。snapshotValue・observationsValue: 同じ技術Ownerの元結果。evidence: 元版と回復参照。
 * @returns 次の資源記録、又は相関不成立のnull。
 * @effect N/A: 値と相関Hashの構築だけ。
 * @invariant IDの差替えを拒否するが現在構成の更新は許可する。
 */
export function applyResourceCleanup(
  previous: OperationResources,
  snapshotValue: unknown,
  observationsValue: unknown,
  evidence: Readonly<{ recoveryId: string; previousPayloadSha256: string }>,
): OperationResources | null {
  try {
    const snapshot = JSON.parse(
      encodeStateValue(snapshotValue),
    ) as OperationResources["snapshot"];
    const observations = JSON.parse(encodeStateValue(observationsValue));
    if (
      !validateResourceBook(previous) ||
      !snapshot ||
      !Array.isArray(snapshot.resources) ||
      !Array.isArray(observations) ||
      observations.length !== previous.checkpoints.length ||
      new Set(observations.map((item: { key: unknown }) => item.key)).size !==
        previous.checkpoints.length
    )
      return null;
    const checkpoints = previous.checkpoints.map((checkpoint) => {
      const observed = observations.find(
        (item: { key: unknown }) => item.key === checkpoint.key,
      );
      const resource = snapshot.resources.find(
        (item) => item.key === checkpoint.key,
      );
      if (
        !hasExecutionStateRecordKeys(observed, ["key", "observation"]) ||
        !resource ||
        !["not_requested", "absent", "unknown"].includes(observed.observation)
      )
        throw Error("resource_observation_invalid");
      const original = previous.snapshot.resources.find(
        (item) => item.key === checkpoint.key,
      );
      if (
        !original ||
        original.identity.dockerId !== resource.identity.dockerId
      )
        throw Error("resource_receipt_required");
      if (observed.observation === "not_requested") {
        if (
          resource.identity.dockerId !== null ||
          resource.request !== "not_issued" ||
          checkpoint.submission === "intent_saved"
        )
          throw Error("resource_observation_invalid");
        return checkpoint;
      }
      if (checkpoint.submission !== "intent_saved")
        throw Error("resource_observation_invalid");
      return {
        ...checkpoint,
        receiptSource: checkpoint.receiptSource,
        observation: observed.observation,
        absenceEvidenceSha256:
          observed.observation === "absent"
            ? checkpoint.observation === "absent" &&
              checkpoint.absenceEvidenceSha256 !== null
              ? checkpoint.absenceEvidenceSha256
              : createHash("sha256")
                  .update(
                    encodeStateValue({
                      ...evidence,
                      observation: observed,
                    }),
                  )
                  .digest("hex")
            : null,
      };
    });
    const book = { ...previous, snapshot, checkpoints };
    return validateResourceBook(book) &&
      validateResourceBookTransition(previous, book)
      ? book
      : null;
  } catch {
    return null;
  }
}

const liveSettlements = new WeakMap<
  object,
  {
    kind: "live";
    repository: NonNullable<
      ReturnType<typeof observeExecutionSettlementStorageAccess>
    >;
    recoveryId: string;
    managementCapability: unknown;
    consumer: string;
    completion?: { before: Buffer; candidate: Buffer };
    originalInputs?: { cleanupOutcome: unknown; dockerCompletion: unknown };
    verifyCleanup: NonNullable<
      ReturnType<typeof captureExecutionCleanupVerification>
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
export function prepareOperationCompletion(
  managementCapability: unknown,
  recoveryId: unknown,
  consumer: unknown,
) {
  const validConsumer =
    typeof consumer === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(consumer);
  const invalid = {
    context: null as object | null,
    reason: "docker_recovery_settlement_binding_invalid",
    lockReleased: true,
  };
  if (!validConsumer) return Object.freeze(invalid);
  const repository =
    observeExecutionSettlementStorageAccess(managementCapability);
  const verifyCleanup =
    captureExecutionCleanupVerification(managementCapability);
  const current = readOperationStateStage(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (value): value is ExecutionOperationRecord =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  if (
    !repository ||
    !verifyCleanup ||
    !operation ||
    JSON.parse(operation.identityJson).consumer !== consumer ||
    current.status !== "completed" ||
    !current.lockReleased ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return Object.freeze({
      ...invalid,
      reason: current.status === "blocked" ? current.reason : invalid.reason,
      lockReleased: current.lockReleased,
    });
  const context = Object.freeze({});
  liveSettlements.set(context, {
    kind: "live",
    repository,
    verifyCleanup,
    recoveryId: operation.recoveryId,
    managementCapability,
    consumer: consumer as string,
  });
  return Object.freeze({ context, reason: null, lockReleased: true });
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
export function writeOwnedSettlement(
  context: unknown,
  candidateBytes: unknown,
  cleanupOutcome: unknown,
  dockerCompletion?: unknown,
) {
  const settlement = readLiveSettlement(context);
  return writeStateSnapshot(
    null,
    settlement?.repository ?? null,
    candidateBytes,
    settlement
      ? {
          ...settlement,
          cleanupStatus: settlement.verifyCleanup(cleanupOutcome),
          dockerTerminal: observeExecutionTerminalForStorage(
            dockerCompletion,
            settlement.managementCapability,
            settlement.repository.operationId,
            settlement.recoveryId,
          ),
        }
      : null,
  );
} /**
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
function captureOperationCompletionInputs(
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
  const terminal = observeExecutionTerminalForStorage(
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
 * 元の実行結果を技術終端と履歴の保存へ接続する。
 * @responsibility 清掃・結果・履歴・受理の順序を既存保存Ownerで閉じる。
 * @trace ARCH-000008
 * @input context: 清掃前Context、cleanupOutcome: 元Host結果、dockerCompletion: 元Controller結果。
 * @returns 保存確認・累積Filesystem Effectと非Authority回復参照。
 * @precondition 同じ操作の元観測を利用し、実行評価は発生点で保存されている。
 * @postcondition Task非関連は終了整理し、Task関連はTask終端と同じ保存まで記録を保持する。
 * @effect 既存state.jsonとhistory.jsonlの保存だけ。
 * @failure 元観測欠落、診断差、保存・排他・履歴不明は後続処置を停止する。
 * @invariant Taskの未終端を清掃失敗へ戻さず、再入場でProviderを再実行しない。
 * @boundary 元終端Ownerから現在状態・履歴・Task終端へ接続する。
 * @security 任意の結果本文・ID・PathやCaller supplied成功booleanを受けない。
 * @concurrency 元版照合を各既存Writerで行い、固定済み要約を再改訂しない。
 */
export function completeOperation(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  let filesystemEffectIssued = false;
  let inputAccepted = false;
  /**
   * 後続処置を停止して元の保存失敗と累積Effectを返す。
   * @responsibility 各段階の失敗理由と排他・保存確認を失わず返却する。
   * @trace ARCH-000008
   * @input failure: 元の保存結果。未取得なら既定拒否。
   * @returns 終了保存が未確認の結果。
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
    failure: Partial<ReturnType<typeof writeStateSnapshot>> = {},
  ) =>
    Object.freeze({
      inputAccepted,
      ...writeStateSnapshot(null, null, null, null),
      ...failure,
      filesystemEffectIssued:
        filesystemEffectIssued || failure.filesystemEffectIssued === true,
      recoveryId: settlement?.recoveryId ?? null,
    });
  if (!settlement) return refused();
  if (
    !captureOperationCompletionInputs(context, cleanupOutcome, dockerCompletion)
  )
    return refused();
  inputAccepted = true;
  try {
    const terminal = observeExecutionTerminalForStorage(
      dockerCompletion,
      settlement.managementCapability,
      settlement.repository.operationId,
      settlement.recoveryId,
    );
    const cleanupStatus = settlement.verifyCleanup(cleanupOutcome);
    if (!terminal || !cleanupStatus) return refused();
    if (settlement.completion) {
      const completed = completeOwnedSettlement(
        context,
        cleanupOutcome,
        dockerCompletion,
      );
      return Object.freeze({
        inputAccepted,
        ...completed,
        recoveryId: settlement.recoveryId,
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
    let current = readOwnedSettlementSnapshot(context);
    if (current.status !== "completed" || !current.value)
      return refused({
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    let operation = current.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" &&
        item.recoveryId === settlement.recoveryId,
    );
    if (!operation) return refused();
    if (operation.summarySha256 === null) {
      const before = Buffer.from(
        `${encodeStateValue(current.value.snapshot)}\n`,
      );
      const cleanedBytes = prepareStateCleanupSnapshot(
        before,
        settlement.recoveryId,
        {
          snapshot: terminal.resourceSnapshot,
          observations: terminal.resources,
        },
        settlement.repository.repositoryBinding,
      );
      const cleaned = cleanedBytes
        ? decodeStateSnapshot(
            cleanedBytes,
            settlement.repository.repositoryBinding,
          )
        : null;
      if (!cleaned) return refused();
      const candidate = {
        ...cleaned.snapshot,
        // Cleanupがno-opでも、終了結果の保存は読取り元から一改訂だけ進める。
        revision: current.value.snapshot.revision + 1,
        previous: {
          revision: current.value.snapshot.revision,
          payloadSha256: current.value.payloadSha256,
        },
        operations: cleaned.snapshot.operations.map((item) =>
          item.kind !== "docker_task" ||
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
      const saved = writeOwnedSettlement(
        context,
        Buffer.from(`${encodeStateValue(candidate)}\n`),
        cleanupOutcome,
        dockerCompletion,
      );
      filesystemEffectIssued ||= saved.filesystemEffectIssued;
      if (saved.status !== "completed" || !saved.lockReleased)
        return Object.freeze({
          inputAccepted,
          ...saved,
          filesystemEffectIssued,
          recoveryId: settlement.recoveryId,
        });
    } else {
      const observed = prepareStateCleanupSnapshot(
        Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`),
        settlement.recoveryId,
        {
          snapshot: terminal.resourceSnapshot,
          observations: terminal.resources,
        },
        settlement.repository.repositoryBinding,
      );
      const observedOperation = observed
        ? decodeStateSnapshot(
            observed,
            settlement.repository.repositoryBinding,
          )?.snapshot.operations.find(
            (item): item is ExecutionOperationRecord =>
              item.kind === "docker_task" &&
              item.recoveryId === settlement.recoveryId,
          )
        : null;
      if (
        !observedOperation ||
        encodeStateValue(observedOperation.resources) !==
          encodeStateValue(operation.resources) ||
        encodeStateValue(operation.primaryFailure) !==
          encodeStateValue(terminal.primaryFailure) ||
        encodeStateValue(operation.outcome) !== encodeStateValue(outcome) ||
        operation.host.cleanup !== "confirmed" ||
        operation.lease !== "released" ||
        !terminal.homeLeaseReleased ||
        !terminal.mountLeaseReleased ||
        !terminal.recoveryCompleted ||
        operation.execution.ownerEffect !== "disabled"
      )
        return refused();
    }
    current = readOwnedSettlementSnapshot(context);
    operation = current.value?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" &&
        item.recoveryId === settlement.recoveryId,
    );
    if (current.status !== "completed" || !operation)
      return refused({
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    if (!operation.history) {
      const fixed = writeOwnedHistoryCheckpoint(
        context,
        cleanupOutcome,
        dockerCompletion,
      );
      filesystemEffectIssued ||= fixed.filesystemEffectIssued;
      if (fixed.status !== "completed" || !fixed.lockReleased)
        return refused(fixed);
    }
    if (!operation.history?.confirmed) {
      const published = publishOwnedHistory(
        context,
        cleanupOutcome,
        dockerCompletion,
      );
      filesystemEffectIssued ||= published.filesystemEffectIssued;
      if (published.status !== "completed" || !published.lockReleased)
        return refused(published);
    }
    const observed = readOwnedSettlementSnapshot(context);
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased
    )
      return refused(observed);
    const related = observed.value.snapshot.managedExecutions.some((p) =>
      p.tasks.some(
        (t) =>
          t.settlement.kind === "operations" &&
          t.settlement.recoveryIds.includes(settlement.recoveryId),
      ),
    );
    if (related)
      return Object.freeze({
        inputAccepted,
        status: "completed" as const,
        reason: "operation_terminal_recorded",
        snapshotConfirmed: true,
        lockReleased: true,
        filesystemEffectIssued,
        recoveryId: settlement.recoveryId,
        operationRetained: true,
      });
    const completed = completeOwnedSettlement(
      context,
      cleanupOutcome,
      dockerCompletion,
    );
    return Object.freeze({
      inputAccepted,
      ...completed,
      filesystemEffectIssued:
        filesystemEffectIssued || completed.filesystemEffectIssued,
      recoveryId: settlement.recoveryId,
    });
  } catch {
    return refused();
  }
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
export function writeOwnedHistoryCheckpoint(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  const dockerTerminal = settlement
    ? observeExecutionTerminalForStorage(
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
    return writeStateSnapshot(null, null, null, null);
  const current = readStateSnapshot(
    settlement.repository,
    settlement.recoveryId,
  );
  const operation = current.value?.snapshot.operations.find(
    (value): value is ExecutionOperationRecord =>
      value.kind === "docker_task" &&
      value.recoveryId === settlement.recoveryId,
  );
  const candidate =
    current.value && operation
      ? prepareStateHistorySnapshot(
          Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`),
          settlement.recoveryId,
          operation.history?.occurredAt ?? new Date().toISOString(),
          false,
          settlement.repository.repositoryBinding,
        )
      : null;
  return writeStateSnapshot(null, settlement.repository, candidate, {
    ...settlement,
    cleanupStatus,
    dockerTerminal,
    historyInitial: true,
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
export function completeOwnedSettlement(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  const dockerTerminal = settlement
    ? observeExecutionTerminalForStorage(
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
    return writeStateSnapshot(null, null, null, null);
  let completion = settlement.completion;
  if (!completion) {
    const current = readStateSnapshot(
      settlement.repository,
      settlement.recoveryId,
    );
    if (current.status !== "completed" || !current.value)
      return Object.freeze({
        ...writeStateSnapshot(null, null, null, null),
        reason: current.reason,
        lockReleased: current.lockReleased,
      });
    const before = Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`);
    const candidate = prepareStateCompletionSnapshot(
      before,
      settlement.recoveryId,
      settlement.repository.repositoryBinding,
    );
    if (!candidate) return writeStateSnapshot(null, null, null, null);
    completion = { before, candidate };
  }
  const previous = decodeStateSnapshot(
    completion.before,
    settlement.repository.repositoryBinding,
  )?.snapshot.operations.find(
    (operation): operation is ExecutionOperationRecord =>
      operation.kind === "docker_task" &&
      operation.recoveryId === settlement.recoveryId,
  );
  if (
    !previous ||
    JSON.parse(previous.identityJson).consumer !== settlement.consumer
  )
    return writeStateSnapshot(null, null, null, null);
  const saved = writeStateSnapshot(
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
export function publishOwnedHistory(
  context: unknown,
  cleanupOutcome: unknown,
  dockerCompletion: unknown,
) {
  const settlement = readLiveSettlement(context);
  const terminal = settlement
    ? observeExecutionTerminalForStorage(
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
    return writeStateSnapshot(null, null, null, null);
  const current = readStateSnapshot(
    settlement.repository,
    settlement.recoveryId,
  );
  const operation = current.value?.snapshot.operations.find(
    (value): value is ExecutionOperationRecord =>
      value.kind === "docker_task" &&
      value.recoveryId === settlement.recoveryId,
  );
  if (
    current.value &&
    operation?.history?.confirmed &&
    ![...current.value.snapshot.unresolvedRecoveries].some(
      (item) => item.recoveryId === settlement.recoveryId,
    )
  )
    return writeOwnedSettlement(
      context,
      Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`),
      cleanupOutcome,
      dockerCompletion,
    );
  const owner = settlement.managementCapability;
  const resume = readHistoryResumeCandidate(
    executionStorageOperationIdentity(owner),
    settlement.recoveryId,
  );
  const candidate =
    current.value && operation?.history
      ? operation.history.confirmed
        ? Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`)
        : prepareStateHistorySnapshot(
            Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`),
            settlement.recoveryId,
            operation.history.occurredAt,
            true,
            settlement.repository.repositoryBinding,
          )
      : (resume ?? null);
  return writeStateSnapshot(null, settlement.repository, candidate, {
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
export function readOwnedSettlementSnapshot(context: unknown) {
  const settlement = readLiveSettlement(context);
  return readStateSnapshot(
    settlement?.repository ?? null,
    settlement?.recoveryId ?? null,
  );
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
export function saveOperationStart(
  managementCapability: unknown,
  identityJson: unknown,
) {
  const repository = observeOperationRepository(managementCapability);
  let recoveryId: string | null = null;
  if (!repository)
    return Object.freeze({
      startSaved: false,
      completionContext: null as object | null,
      ...writeStateSnapshot(null, null, null, null),
      recoveryId,
    });
  const initialBytes = prepareStateOperationSnapshot(
    null,
    identityJson,
    repository.repositoryBinding,
  );
  const initialCandidate = initialBytes
    ? decodeStateSnapshot(initialBytes, repository.repositoryBinding)
    : null;
  const initialOperation = initialCandidate?.snapshot.operations[0];
  if (
    !initialBytes ||
    !initialOperation ||
    JSON.parse(initialOperation.identityJson).operationId !==
      repository.operationId
  )
    return Object.freeze({
      startSaved: false,
      completionContext: null as object | null,
      ...writeStateSnapshot(null, null, null, null),
      recoveryId,
    });
  recoveryId = initialOperation.recoveryId;
  const current = readStateSnapshot(repository, null);
  if (!current.lockReleased)
    return Object.freeze({
      startSaved: false,
      completionContext: null as object | null,
      ...writeStateSnapshot(null, null, null, null),
      reason: current.reason,
      lockReleased: false,
      recoveryId,
    });
  const candidateBytes = current.value
    ? prepareStateOperationSnapshot(
        Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`),
        identityJson,
        repository.repositoryBinding,
      )
    : initialBytes;
  const candidate = candidateBytes
    ? decodeStateSnapshot(candidateBytes, repository.repositoryBinding)
    : null;
  const added = candidate?.snapshot.operations.find(
    (value): value is ExecutionOperationRecord =>
      value.kind === "docker_task" && value.identityJson === identityJson,
  );
  if (
    !candidateBytes ||
    !added ||
    JSON.parse(added.identityJson).operationId !== repository.operationId
  )
    return Object.freeze({
      startSaved: false,
      completionContext: null as object | null,
      ...writeStateSnapshot(null, null, null, null),
      recoveryId,
    });
  recoveryId = added.recoveryId;
  let initializationEffectIssued = false;
  if (!current.value) {
    // 新品の証明は既存の排他的領域作成だけが所有する。Readerのblockedは証明ではない。
    const initial = prepareOwnedStateInitialization(
      managementCapability,
      candidateBytes,
    );
    initializationEffectIssued = initial.effectIssued;
    if (initial.status !== "prepared")
      return Object.freeze({
        startSaved: false,
        completionContext: null as object | null,
        ...writeStateSnapshot(null, null, null, null),
        reason: "coordinator_state_initialization_unconfirmed",
        recoveryId,
        filesystemEffectIssued: initial.effectIssued,
        lockReleased: initial.lockReleased,
      });
  }
  const saved = writeOwnedStateSnapshot(managementCapability, candidateBytes);
  const startSaved = saved.snapshotConfirmed;
  let completionContext: object | null = null;
  let completionLockReleased = saved.lockReleased;
  let completionReason = "docker_recovery_settlement_binding_invalid";
  if (
    saved.status === "completed" &&
    saved.snapshotConfirmed &&
    saved.lockReleased
  ) {
    try {
      const prepared = prepareOperationCompletion(
        managementCapability,
        recoveryId,
        JSON.parse(added.identityJson).consumer,
      );
      completionContext = prepared.context;
      completionLockReleased = prepared.lockReleased;
      completionReason = prepared.reason ?? completionReason;
    } catch {
      // 開始保存は既に成立している。準備例外でも同じ参照と発行済みEffectを返す。
      completionLockReleased = false;
    }
  }
  return Object.freeze({
    ...saved,
    status:
      saved.status === "completed" && !completionContext
        ? ("blocked" as const)
        : saved.status,
    reason:
      saved.status === "completed" && !completionContext
        ? completionReason
        : saved.reason,
    lockReleased: saved.lockReleased && completionLockReleased,
    startSaved,
    completionContext,
    filesystemEffectIssued:
      initializationEffectIssued || saved.filesystemEffectIssued,
    recoveryId,
  });
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
export function resumeResourcePublication(
  repository: StorageRepository & { operationId: string },
  recoveryId: string,
  before: Buffer,
  candidate: Buffer,
  assertOwner: () => boolean,
) {
  const blocked = () => writeStateSnapshot(null, null, null, null);
  try {
    if (
      typeof assertOwner !== "function" ||
      assertOwner() !== true ||
      !classifyResourcePublication(
        before,
        candidate,
        recoveryId,
        repository.repositoryBinding,
      )
    )
      return blocked();
    const current = readStateSnapshot(
      repository,
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
    return writeStateSnapshot(
      null,
      {
        ...repository,
        revalidate: (expectedHistoryRetentionDays?: number) =>
          assertOwner() === true &&
          repository.revalidate(expectedHistoryRetentionDays),
      },
      candidate,
      null,
    );
  } catch {
    return blocked();
  }
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
export function readOperationCompletion(
  rootCapability: unknown,
  recoveryId: unknown,
  correlationId: unknown,
) {
  if (
    typeof recoveryId !== "string" ||
    !parseDockerTaskRecoveryId(recoveryId) ||
    typeof correlationId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(correlationId)
  )
    return Object.freeze({
      completionConfirmed: false,
      reason: "coordinator_completion_input_invalid",
    });
  const observed = readStateSnapshot(
    observeExecutionRecoveryRepository(rootCapability),
    null,
    null,
    null,
    null,
    "docker_task",
    "docker_task",
    false,
    null,
    { recoveryId, correlationId },
  );
  return Object.freeze({
    completionConfirmed:
      observed.status === "completed" &&
      observed.lockReleased &&
      observed.operationCompletionConfirmed,
    reason: observed.reason,
  });
}

/**
 * 回収Ownerが指定した途中・再起動・終端・Host清掃の保存を既存Writerへ接続する。
 * @responsibility 種別ごとにexact操作・元本文と保持又は不存在の証拠を共同照合する。
 * @trace ARCH-000008
 * @input repository、recoveryId、before: 元版の固定結合。request: 更新値とOwner確認、又はHost不存在確認とexact出版候補。
 * @returns 既存Writerの保存・読戻し・排他解放結果。
 * @precondition 途中更新は元の回収Ownerが排他を保持し、Host清掃確定は元Ownerと資源の不存在を確認済みである。
 * @postcondition 他操作、一次失敗、確定結果とTask相関を保持する。
 * @effect 同じRepositoryの固定state更新だけ。Docker／Host処置なし。
 * @failure 不正Owner、元版差、不正遷移、異種証拠や出版候補の交差、新しい完了結果の合成は拒否する。
 * @invariant marker存続中の途中保存と、削除後の真正終端保存を混同しない。
 * @boundary 私有回収Ownerと既存Repository-local Writer。
 * @security Root Reader、任意candidate、旧managementからWriterを復元しない。
 * @concurrency Writer内でも既存排他・元版を再確認する。
 */
export function saveRecoveryCheckpoint(
  authority: unknown,
  recoveryId: unknown,
  before: null,
  request: Extract<RecoveryCheckpointRequest, { kind: "resource_not_issued" }>,
): ReturnType<typeof writeStateSnapshot>;
export function saveRecoveryCheckpoint(
  authority: unknown,
  recoveryId: string,
  before: unknown,
  request: Extract<
    RecoveryCheckpointRequest,
    { kind: "host_cleanup_preparation" }
  >,
): ReturnType<typeof writeStateSnapshot>;
export function saveRecoveryCheckpoint(
  repository: StorageRepository & { operationId: string },
  recoveryId: string,
  before: Buffer,
  request: Exclude<
    RecoveryCheckpointRequest,
    { kind: "resource_not_issued" | "host_cleanup_preparation" }
  >,
): ReturnType<typeof writeStateSnapshot>;
export function saveRecoveryCheckpoint(
  ...args:
    | [
        authority: unknown,
        recoveryId: unknown,
        before: null,
        request: Extract<
          RecoveryCheckpointRequest,
          { kind: "resource_not_issued" }
        >,
      ]
    | [
        authority: unknown,
        recoveryId: string,
        before: unknown,
        request: Extract<
          RecoveryCheckpointRequest,
          { kind: "host_cleanup_preparation" }
        >,
      ]
    | [
        repository: StorageRepository & { operationId: string },
        recoveryId: string,
        before: Buffer,
        request: Exclude<
          RecoveryCheckpointRequest,
          { kind: "resource_not_issued" | "host_cleanup_preparation" }
        >,
      ]
): ReturnType<typeof writeStateSnapshot>;
export function saveRecoveryCheckpoint(
  authority: unknown,
  recoveryReference: unknown,
  rawBefore: unknown,
  request: RecoveryCheckpointRequest,
): ReturnType<typeof writeStateSnapshot> {
  const captured =
    snapshotStateRecord(request, new Set(["kind", "value", "assertOwner"])) ??
    snapshotStateRecord(request, new Set(["kind", "assertOwner"])) ??
    snapshotStateRecord(
      request,
      new Set(["kind", "assertAbsentOwner", "publication"]),
    ) ??
    snapshotStateRecord(request, new Set(["kind", "purpose"])) ??
    snapshotStateRecord(request, new Set(["kind"])) ??
    snapshotStateRecord(
      request,
      new Set(["kind", "observations", "assertOwner"]),
    );
  if (!captured) return writeStateSnapshot(null, null, null, null);
  const repository = authority as StorageRepository & { operationId: string };
  const recoveryId = recoveryReference as string;
  const before = rawBefore as Buffer;
  switch (captured.kind) {
    case "resource_not_issued": {
      if (rawBefore !== null || !Object.hasOwn(captured, "purpose"))
        return writeStateSnapshot(null, null, null, null);
      const managementCapability = authority,
        purpose = captured.purpose;
      const recoveryId = recoveryReference;

      const repository = observeOperationRepository(managementCapability);
      const current = readOperationStateStage(managementCapability);
      const operation = current.value?.snapshot.operations.find(
        (value): value is ExecutionOperationRecord =>
          value.kind === "docker_task" && value.recoveryId === recoveryId,
      );
      const resource = operation?.resources?.checkpoints.find(
        (value) => value.key === purpose,
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
        resource.submission !== "intent_saved" ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      )
        return Object.freeze({
          ...writeStateSnapshot(null, null, null, null),
          lockReleased: current.lockReleased,
        });
      const next = prepareStateResourceSnapshot(
        Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`),
        recoveryId,
        { event: "not_issued", key: purpose },
        repository.repositoryBinding,
      );
      return writeStateSnapshot(managementCapability, repository, next, null, {
        recoveryId,
        purpose,
      });
    }
    case "host_cleanup_preparation": {
      if (Reflect.ownKeys(captured).length !== 1)
        return writeStateSnapshot(null, null, null, null);
      const managementCapability = authority,
        beforeBytes = rawBefore;

      const repository = observeOperationRepository(managementCapability);
      const before = repository
        ? decodeStateSnapshot(beforeBytes, repository.repositoryBinding)
        : null;
      const operation = before?.snapshot.operations.find(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" && item.recoveryId === recoveryId,
      );
      const candidate =
        repository &&
        before &&
        operation &&
        operation.host.cleanup === "not_requested" &&
        operation.lease === "released" &&
        JSON.parse(operation.identityJson).operationId ===
          repository.operationId
          ? prepareStateHostSnapshot(
              beforeBytes,
              recoveryId,
              { ...operation.host, cleanup: "pending" },
              repository.repositoryBinding,
            )
          : null;
      if (!candidate || !repository || !before)
        return Object.freeze({
          status: "blocked",
          reason: "coordinator_state_input_invalid",
          revision: null,
          payloadSha256: null,
          recoveryIds: Object.freeze([] as string[]),
          filesystemEffectIssued: false,
          snapshotConfirmed: false,
          lockReleased: true,
        });
      const current = readStateSnapshot(repository, null);
      if (!current.lockReleased)
        return Object.freeze({
          status: "blocked",
          reason: current.reason,
          revision: null,
          payloadSha256: null,
          recoveryIds: Object.freeze([recoveryId]),
          filesystemEffectIssued: false,
          snapshotConfirmed: false,
          lockReleased: false,
        });
      if (
        current.status === "completed" &&
        current.value &&
        Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`).equals(
          candidate,
        )
      )
        return Object.freeze({
          status: "completed",
          reason: "coordinator_state_snapshot_confirmed",
          revision: current.value.snapshot.revision,
          payloadSha256: current.value.payloadSha256,
          recoveryIds: Object.freeze(
            current.value.snapshot.operations.map((item) => item.recoveryId),
          ),
          filesystemEffectIssued: false,
          snapshotConfirmed: true,
          lockReleased: true,
        });
      if (
        current.status === "completed" &&
        current.value &&
        !Buffer.from(`${encodeStateValue(current.value.snapshot)}\n`).equals(
          Buffer.from(`${encodeStateValue(before.snapshot)}\n`),
        )
      )
        return Object.freeze({
          status: "blocked",
          reason: "coordinator_state_input_invalid",
          revision: null,
          payloadSha256: null,
          recoveryIds: Object.freeze([recoveryId]),
          filesystemEffectIssued: false,
          snapshotConfirmed: false,
          lockReleased: true,
        });
      return writeStateSnapshot(
        managementCapability,
        repository,
        candidate,
        null,
      );
    }
    case "authentication_unknown_closure": {
      if (
        !Object.hasOwn(captured, "observations") ||
        !Object.hasOwn(captured, "assertOwner")
      )
        return writeStateSnapshot(null, null, null, null);
      return saveAuthenticationClosure(
        repository,
        recoveryId,
        before,
        captured.observations,
        captured.assertOwner as () => boolean,
      );
    }
    case "resource":
    case "cleanup":
    case "host":
    case "lifecycle": {
      if (
        !Object.hasOwn(captured, "value") ||
        !Object.hasOwn(captured, "assertOwner")
      )
        return writeStateSnapshot(null, null, null, null);
      const kind = captured.kind,
        value = captured.value;
      const assertOwner = captured.assertOwner as () => boolean;

      const blocked = () => writeStateSnapshot(null, null, null, null);
      try {
        if (typeof assertOwner !== "function" || assertOwner() !== true)
          return blocked();
        const current = readStateSnapshot(repository, recoveryId);
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
          `${encodeStateValue(current.value.snapshot)}\n`,
        );
        const operation = current.value.snapshot.operations.find(
          (item): item is ExecutionOperationRecord =>
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
        const update = JSON.parse(encodeStateValue(value));
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
            !areTaskResourcesSettled(operation)
          )
            return blocked();
        }
        if (
          kind === "lifecycle" &&
          (update.lease !== operation.lease ||
            encodeStateValue(update.outcome) !==
              encodeStateValue(operation.outcome) ||
            update.summarySha256 !== operation.summarySha256)
        )
          return blocked();
        const prepare =
          kind === "resource"
            ? prepareStateResourceSnapshot
            : kind === "cleanup"
              ? prepareStateCleanupSnapshot
              : kind === "host"
                ? prepareStateHostSnapshot
                : kind === "lifecycle"
                  ? prepareStateLifecycleSnapshot
                  : null;
        const candidate = prepare?.(
          bytes,
          recoveryId,
          update,
          repository.repositoryBinding,
        );
        if (!candidate) return blocked();
        return writeStateSnapshot(
          null,
          {
            ...repository,
            revalidate: (expectedHistoryRetentionDays?: number) =>
              assertOwner() === true &&
              repository.revalidate(expectedHistoryRetentionDays),
          },
          candidate,
          null,
        );
      } catch {
        return blocked();
      }
    }
    case "restart": {
      if (
        !Object.hasOwn(captured, "value") ||
        !Object.hasOwn(captured, "assertOwner")
      )
        return writeStateSnapshot(null, null, null, null);
      const checkpoint = captured.value,
        assertOwner = captured.assertOwner as () => boolean;

      const blocked = () => writeStateSnapshot(null, null, null, null);
      try {
        if (typeof assertOwner !== "function" || assertOwner() !== true)
          return blocked();
        const current = readStateSnapshot(repository, recoveryId);
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
          `${encodeStateValue(current.value.snapshot)}\n`,
        );
        const operation = current.value.snapshot.operations.find(
          (item): item is ExecutionOperationRecord =>
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
        const candidate = prepareStateRestartSnapshot(
          bytes,
          recoveryId,
          checkpoint,
          repository.repositoryBinding,
        );
        if (!candidate) return blocked();
        return writeStateSnapshot(
          null,
          {
            ...repository,
            revalidate: (expectedHistoryRetentionDays?: number) =>
              assertOwner() === true &&
              repository.revalidate(expectedHistoryRetentionDays),
          },
          candidate,
          null,
        );
      } catch {
        return blocked();
      }
    }
    case "terminal": {
      if (
        !Object.hasOwn(captured, "assertOwner") ||
        Reflect.ownKeys(captured).length !== 2
      )
        return writeStateSnapshot(null, null, null, null);
      const assertOwner = captured.assertOwner as () => boolean;

      const blocked = () => writeStateSnapshot(null, null, null, null);
      try {
        if (typeof assertOwner !== "function" || assertOwner() !== true)
          return blocked();
        let current = readStateSnapshot(repository, recoveryId);
        if (current.status !== "completed" && current.lockReleased)
          current = readStateSnapshot(repository, recoveryId, null, recoveryId);
        if (current.status !== "completed" && current.lockReleased)
          current = readStateSnapshot(repository, recoveryId, null, null);
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
          `${encodeStateValue(current.value.snapshot)}\n`,
        );
        const operation = current.value.snapshot.operations.find(
          (item): item is ExecutionOperationRecord =>
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
          operation.phase === "terminal" ||
          !areTaskResourcesSettled(operation) ||
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
        const candidate = prepareStateLifecycleSnapshot(
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
        return writeStateSnapshot(
          null,
          {
            ...repository,
            revalidate: (expectedHistoryRetentionDays?: number) =>
              assertOwner() === true &&
              repository.revalidate(expectedHistoryRetentionDays),
          },
          candidate,
          null,
        );
      } catch {
        return blocked();
      }
    }
    case "host_cleanup": {
      if (
        !Object.hasOwn(captured, "assertAbsentOwner") ||
        !Object.hasOwn(captured, "publication")
      )
        return writeStateSnapshot(null, null, null, null);
      const assertAbsentOwner = captured.assertAbsentOwner as () => boolean;
      const publication = captured.publication as ReturnType<
        typeof readRecoveryState
      >["hostCleanupPublication"];

      const blocked = () => writeStateSnapshot(null, null, null, null);
      try {
        if (
          typeof assertAbsentOwner !== "function" ||
          assertAbsentOwner() !== true
        )
          return blocked();
        const current = readStateSnapshot(
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
          `${encodeStateValue(current.value.snapshot)}\n`,
        );
        const operation = current.value.snapshot.operations.find(
          (item): item is ExecutionOperationRecord =>
            item.kind === "docker_task" && item.recoveryId === recoveryId,
        );
        if (
          publication &&
          (!current.hostCleanupPublication ||
            current.hostCleanupPublication.mode !== publication.mode ||
            !current.hostCleanupPublication.before.equals(publication.before) ||
            !current.hostCleanupPublication.candidate.equals(
              publication.candidate,
            ))
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
          !areTaskResourcesSettled(operation) ||
          assertAbsentOwner() !== true
        )
          return blocked();
        const candidate =
          operation.host.cleanup === "confirmed"
            ? bytes
            : prepareStateHostSnapshot(
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
        return writeStateSnapshot(
          null,
          {
            ...repository,
            revalidate: (expectedHistoryRetentionDays?: number) =>
              assertAbsentOwner() === true &&
              repository.revalidate(expectedHistoryRetentionDays),
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
    default:
      return writeStateSnapshot(null, null, null, null);
  }
}

import type { RecoveryCheckpointRequest } from "./types.ts";
