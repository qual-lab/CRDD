/**
 * 明示的な実行環境修復を既存のRepository状態保存へ結合する。
 * @packageDocumentation
 * @responsibility 技術修復と同じ呼出しの保存Ownerを接続する。
 * @trace ARCH-000008
 * @boundary Docker／OSの技術判断はDocker Isolationが所有する。
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { observeRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  runDockerRuntimeRepairSession,
  disposeDockerRuntimeRepairDirectory,
  observeDockerRuntimeRepairRetention,
  dockerRuntimeRepairDisposalIsSettled,
  type DockerRuntimeRepairCheckpoint,
  dockerRuntimeRepairCheckpointIsSettled,
} from "../../../docker-isolation/src/index.ts";
import { borrowRuntimeOwnedCoordinatorRecoveryRepository } from "../workspace/binding.ts";
import {
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  prepareCoordinatorStateRepairSnapshot,
  prepareCoordinatorStateRepairCheckpointSnapshot,
  prepareCoordinatorStateRepairSessionSnapshot,
  prepareCoordinatorStateRepairRetentionHandoffSnapshot,
  prepareCoordinatorStateRepairDisposalDecisionSnapshot,
  prepareCoordinatorStateRepairDisposalProgressSnapshot,
  prepareCoordinatorRepairHistorySummary,
  type CoordinatorStateRepairOperation,
} from "../storage/model.ts";
import {
  cleanupRuntimeOwnedCoordinatorStateMarker,
  resumeRuntimeOwnedCoordinatorRepairPublication,
  readRuntimeOwnedCoordinatorRecoverySnapshot,
  writeRuntimeOwnedCoordinatorRepairSnapshot,
  readRuntimeOwnedCoordinatorRepairHistorySnapshot,
  advanceRuntimeOwnedCoordinatorRepairHistory,
  readRuntimeOwnedCoordinatorRepairCompletionSnapshot,
  completeRuntimeOwnedCoordinatorRepair,
} from "../storage/settlement-store.ts";

/**
 * 同じRoot・Revision・修復Identityで技術処置と保存を直列化する。
 * @responsibility 準備保存・各checkpoint・join後の最終保存を既存Writerへ渡す。
 * @trace ARCH-000008
 * @input rootCapability: 検証済みRoot、signal: 取消、requestedRecoveryId: 再入場時のexact参照、purpose: 明示修復または明示保持。
 * @returns 保存確認とNative回収確認を分けた局所結果。
 * @precondition 明示修復を許可したCLI組立てから呼ぶ。Repository-local親領域は既存配置。
 * @postcondition 保存拒否後の新処置と返却後の保存通知を拒否する。
 * @effect 修復用途だけ固定DI修復。共通して既存state／history Writerと短命保存物の限定清掃。
 * @failure 不明・競合・失効は停止し、旧保存内容を成功へ補完しない。
 * @invariant 保存JSONからRoot・実行許可・Native生存を復元しない。
 * @boundary 呼出しOwner、状態保存、下位の技術Session。
 * @security 任意Path・Command・OS種別・署名を入力に持たない。
 * @concurrency 短期保存排他は既存Writer、技術排他はDIが所有する。
 */
export async function repairRuntimeOwnedDockerRuntime(
  rootCapability: unknown,
  signal: AbortSignal,
  requestedRecoveryId: string | null = null,
  purpose: "repair" | "retain" = "repair",
) {
  let recoveryId: string | null = requestedRecoveryId;
  let ownerAlive = true;
  let storageFailed = false;
  let prepared = false;
  let preparedCalls = 0;
  let bytes: Buffer | null = null;
  let target: CoordinatorStateRepairOperation | null = null;
  let nativeCleanupConfirmed = false;
  let finalCheckpointConfirmed = false;
  let outcomeConfirmed = false;
  let retentionConfirmed = false;
  let retentionReviewAfter: string | null = null;
  let historyConfirmed = false;
  let historyEffectIssued: boolean | null = false;
  let historyLockReleased: boolean | null = null;
  let completionConfirmed = false;
  let completionEffectIssued: boolean | null = false;
  let completionLockReleased: boolean | null = null;
  let stateMarkerCleanup: ReturnType<
    typeof cleanupRuntimeOwnedCoordinatorStateMarker
  > | null = null;
  let statePublication: ReturnType<
    typeof resumeRuntimeOwnedCoordinatorRepairPublication
  > | null = null;
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  /**
   * 保存不成立を技術成功と分けて返す。
   * @responsibility exact参照とNative回収事実を保持する。
   * @trace ARCH-000008
   * @input reason: 閉じた停止理由。
   * @returns 保存未確認のblocked結果。
   * @precondition 呼出し内で観測済みの事実だけを使う。
   * @postcondition 最終保存成功を主張しない。
   * @effect N/A: 値の構築のみ。
   * @failure N/A: 新しいI/Oなし。
   * @invariant Native回収成功と保存成功を同一視しない。
   * @boundary 内部呼出しと後続CLI投影。
   * @security 生Path・秘密・実行許可を返さない。
   * @concurrency N/A: 同期構築。
   */
  const stopped = (
    reason = target?.primaryFailure?.reason ??
      (target?.outcome && target.outcome.status !== "recovered"
        ? target.outcome.reason
        : "runtime_repair_state_unavailable"),
  ) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      recoveryId,
      finalCheckpointConfirmed,
      outcomeConfirmed,
      retentionConfirmed,
      retentionReviewAfter,
      historyConfirmed,
      historyEffectIssued,
      historyLockReleased,
      completionConfirmed,
      completionEffectIssued,
      completionLockReleased,
      nativeCleanupConfirmed,
      stateMarkerCleanup,
      statePublication,
    });
  /**
   * 同じ私有呼出しと現在Repository結合を確認する。
   * @responsibility 取消と保存Owner失効を区別する。
   * @trace ARCH-000008
   * @input N/A: 捕捉済みRoot・Revision・生存・保存状態。
   * @returns 生存する同じOwnerだけtrue。
   * @precondition 呼出し開始時に既存Root Ownerへ借用済み。
   * @postcondition 保存失敗後やfinally後にはfalse。
   * @effect RootとGitの現在観測だけ。
   * @failure 例外と観測不能はfalse。
   * @invariant signal取消だけでは既発生事実の保存資格を失わない。
   * @boundary 呼出しと既存Root Owner。
   * @security 保存値を現在Ownerの代用にしない。
   * @concurrency 同期確認。
   */
  const currentOwner = () => {
    try {
      return ownerAlive && !storageFailed && repository?.revalidate() === true;
    } catch {
      return false;
    }
  };
  /**
   * 一つの固定次版を同じWriterで保存・読戻し確認する。
   * @responsibility 確認済み元版だけを次のCAS元版へ進める。
   * @trace ARCH-000008
   * @input candidate: 純粋モデルの次版、purpose: 通常またはSession開始。
   * @returns 保存確認と排他解放が共同成立した場合だけtrue。
   * @precondition 同exact回復参照と現在Ownerが確定済み。
   * @postcondition 不明保存後のcallback再利用を拒否する。
   * @effect 既存の状態Writerと短期排他。
   * @failure 拒否・不明・例外はsticky停止。
   * @invariant 元版・対象外操作を推測または復元しない。
   * @boundary 保存候補と物理Writer。
   * @security 新Store・Lock・Pathを作らない。
   * @concurrency 元版全文のCASは既存Writerへ委譲する。
   */
  const save = (
    candidate: Buffer | null,
    purpose: Parameters<typeof writeRuntimeOwnedCoordinatorRepairSnapshot>[5],
  ) => {
    if (!candidate || !repository || !recoveryId || !currentOwner()) {
      storageFailed = true;
      return false;
    }
    try {
      const result = writeRuntimeOwnedCoordinatorRepairSnapshot(
        rootCapability,
        recoveryId,
        bytes,
        candidate,
        currentOwner,
        purpose,
      );
      if (
        result.status !== "completed" ||
        !result.snapshotConfirmed ||
        !result.lockReleased
      ) {
        storageFailed = true;
        return false;
      }
      const decoded = decodeCoordinatorStateSnapshot(
        candidate,
        repository.repositoryBinding,
      );
      const next = decoded?.snapshot.operations.find(
        (item): item is CoordinatorStateRepairOperation =>
          item.kind === "runtime_repair" && item.recoveryId === recoveryId,
      );
      if (!next) {
        storageFailed = true;
        return false;
      }
      bytes = Buffer.from(candidate);
      target = next;
      return true;
    } catch {
      storageFailed = true;
      return false;
    }
  };
  /**
   * 技術checkpointだけを対象修復の次版へ結合する。
   * @responsibility 保持物とdispositionの相関を維持する。
   * @trace ARCH-000008
   * @input checkpoint: 同じDIからの技術値。
   * @returns 同じWriterの確認結果。
   * @precondition 初回Identityと準備checkpointを保存済み。
   * @postcondition 他操作・一次失敗・outcomeを変更しない。
   * @effect 対象修復の単調な状態保存だけ。
   * @failure 未準備・失効・不正遷移はfalse。
   * @invariant 技術観測から人間の保持承認を生成しない。
   * @boundary DI通知と上位保存。
   * @security 保存済みflagは技術準備前の許可条件にしない。
   * @concurrency 同期保存通知。
   */
  const checkpoint = (
    value: DockerRuntimeRepairCheckpoint,
    primaryFailure: CoordinatorStateRepairOperation["primaryFailure"] = null,
  ) => {
    if (!prepared || !target || !repository) return false;
    return save(
      prepareCoordinatorStateRepairCheckpointSnapshot(
        bytes,
        recoveryId,
        {
          phase: target.phase,
          checkpoint: value,
          disposition:
            value.stale === "retained"
              ? target.disposition === "retained_by_human_decision"
                ? target.disposition
                : "pending_human_decision"
              : "not_applicable",
          primaryFailure: target.primaryFailure ?? primaryFailure,
          outcome: target.outcome,
        },
        repository.repositoryBinding,
      ),
      "checkpoint",
    );
  };
  /**
   * 元修復を変えず、固定三用途を意図保存と実回収へ直列接続する。
   * @responsibility 不確かな要求窓を保持し、前用途の不明後に処置を広げない。
   * @trace ARCH-000008
   * @input N/A: 同呼出しのexact操作・現在本文・既存Writer。
   * @returns 三用途の保存済み不存在だけを確認し、履歴・完了は確定しない。
   * @precondition 初回技術終了またはexact IDの専用再入場。
   * @postcondition 元checkpoint・outcome・一次失敗・他操作を保全する。
   * @effect 専用用途の既存Writer／ReaderとDIの固定一用途回収。
   * @failure 保存・読戻し・解放・現在Owner・回収不明はそこで停止。
   * @invariant 新Session・Store・Lockを作らず、過去のissued／unknownを変更しない。
   * @boundary Coordinatorの保存OwnerとDIの物理処置。
   * @security callbackの保存確認をWriterのKernel内へ流用しない。
   * @concurrency 各Effect前は既存Readerで同じ保存本文と現在Ownerを再確認する。
   */
  const settleDisposal = async () => {
    if (
      !repository ||
      !target ||
      !bytes ||
      !recoveryId ||
      !currentOwner() ||
      signal.aborted
    )
      return false;
    if (
      target.phase === "awaiting_disposition" &&
      target.disposition === "pending_human_decision"
    ) {
      if (
        !save(
          prepareCoordinatorStateRepairDisposalDecisionSnapshot(
            bytes,
            recoveryId,
            new Date().toISOString(),
            repository.repositoryBinding,
          ),
          "disposal_decision",
        )
      )
        return false;
    }
    if (
      target.phase !== "settling" ||
      target.disposition !== "discard" ||
      !target.disposal ||
      !target.checkpoint ||
      target.outcome?.status !== "recovered" ||
      target.primaryFailure !== null
    )
      return false;
    const identityJson = target.identityJson;
    const identity = JSON.parse(identityJson) as {
      operationNonce: string;
      ownerBindingSha256: string;
      scopeSha256: string;
    };
    const writes = {
      primary: "disposal_primary",
      failed: "disposal_failed",
      auxiliary: "disposal_auxiliary",
    } as const;
    for (const purpose of ["primary", "failed", "auxiliary"] as const) {
      if (
        !target?.disposal ||
        !target.checkpoint ||
        signal.aborted ||
        !currentOwner()
      )
        return false;
      let item = target.disposal.checkpoint.directories[purpose];
      if (item.absence === "confirmed_absent") continue;
      const freshIntent = item.intent === "not_saved";
      const intent = {
        ...target.disposal.checkpoint,
        directories: {
          ...target.disposal.checkpoint.directories,
          [purpose]: freshIntent
            ? { intent: "saved", request: "not_issued", absence: "unobserved" }
            : item.request === "not_issued"
              ? { intent: "saved", request: "unknown", absence: "unknown" }
              : item,
        },
      };
      if (
        !save(
          prepareCoordinatorStateRepairDisposalProgressSnapshot(
            bytes,
            recoveryId,
            purpose,
            intent,
            repository.repositoryBinding,
          ),
          writes[purpose],
        )
      )
        return false;
      if (!target?.disposal || !target.checkpoint || !bytes) return false;
      const expectedBytes = Buffer.from(bytes);
      const decidedAt = target.disposal.decidedAt;
      item = target.disposal.checkpoint.directories[purpose];
      /**
       * 保存確認と現在の処置許可を、Writer排他の外で共同確認する。
       * @responsibility 同exact操作・判断・用途意図の変更後に処置しない。
       * @trace ARCH-000008
       * @input N/A: 直前確認した本文と同呼出しOwner。
       * @returns 保存済み本文が現在も一致する場合だけtrue。
       * @precondition 専用Writerの保存・読戻し・解放が成立済み。
       * @postcondition current本文や捕捉値を書き換えない。
       * @effect 既存Readerの同期読取りと短期排他。
       * @failure 欠測・差・解放不明・取消ではfalse。
       * @invariant このcallbackをWriterのassertOwnerへ渡さない。
       * @boundary 保存意図とDI Effect。
       * @security 生Path・保存内容を外部へ返さない。
       * @concurrency DIの待機後にも呼ぶ。
       */
      const canDispose = () => {
        if (signal.aborted || !currentOwner()) return false;
        const read =
          readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
        if (
          read.status !== "completed" ||
          !read.lockReleased ||
          !read.value ||
          !currentOwner() ||
          signal.aborted ||
          !Buffer.from(
            `${encodeCoordinatorStateValue(read.value.snapshot)}\n`,
          ).equals(expectedBytes)
        )
          return false;
        const matches = read.value.snapshot.operations.filter(
          (operation): operation is CoordinatorStateRepairOperation =>
            operation.kind === "runtime_repair" &&
            operation.recoveryId === recoveryId,
        );
        return (
          matches.length === 1 &&
          matches[0]?.identityJson === identityJson &&
          matches[0].disposition === "discard" &&
          matches[0].disposal?.decidedAt === decidedAt &&
          encodeCoordinatorStateValue(
            matches[0].disposal.checkpoint.directories[purpose],
          ) === encodeCoordinatorStateValue(item)
        );
      };
      if (!canDispose()) return false;
      const result = await disposeDockerRuntimeRepairDirectory({
        operationNonce: identity.operationNonce,
        ownerBindingSha256: identity.ownerBindingSha256,
        scopeSha256: identity.scopeSha256,
        checkpoint: target.checkpoint,
        purpose,
        signal,
        canIssueEffect: canDispose,
      });
      if (!currentOwner() || !target.disposal) return false;
      const prior = target.disposal.checkpoint.directories[purpose];
      const progress = {
        ...target.disposal.checkpoint,
        directories: {
          ...target.disposal.checkpoint.directories,
          [purpose]: {
            intent: "saved",
            request:
              prior.request === "not_issued" ? result.request : prior.request,
            absence: result.absence,
          },
        },
      };
      if (
        !save(
          prepareCoordinatorStateRepairDisposalProgressSnapshot(
            bytes,
            recoveryId,
            purpose,
            progress,
            repository.repositoryBinding,
          ),
          writes[purpose],
        ) ||
        result.absence !== "confirmed_absent"
      )
        return false;
    }
    return (
      target?.disposal !== null &&
      dockerRuntimeRepairDisposalIsSettled(target?.disposal?.checkpoint)
    );
  };
  /**
   * 確定済み技術結果の履歴だけを同じ保存Ownerで二段以内に確定する。
   * @responsibility 各保存後のfresh読取りを要求し、技術処置と履歴確認を分離する。
   * @trace ARCH-000008
   * @input initial: 同呼出しで取得した専用Reader結果、または未取得。
   * @returns 正常な確認済み履歴と保存後条件が揃う場合だけtrue。
   * @precondition exact操作と現在Root／Revisionの保存Ownerが生存する。
   * @postcondition 失敗後の保存・技術再取得を停止し、既保存結果を消さない。
   * @effect 既存履歴Writerの最大二段と各段後のfresh読取り。
   * @failure 別対象、Owner失効、段階不変、保存・読取り・排他不明はsticky停止。
   * @invariant 保存済みoperationIdをNative資格へ変換しない。
   * @boundary 修復compositionとRepository-local履歴保存。
   * @security Task配送・任意Path・任意候補へfallbackしない。
   * @concurrency 既存Kernel排他を使い、待機後も同じ現在Ownerを照合する。
   */
  const settleHistory = (
    initial?: ReturnType<
      typeof readRuntimeOwnedCoordinatorRepairHistorySnapshot
    >,
  ) => {
    let nextStage: "publish" | "confirmed" | null = null;
    let writing = false;
    try {
      for (let step = 0; step <= 2; step++) {
        if (!repository || !recoveryId || !currentOwner()) break;
        const read =
          step === 0 && initial
            ? initial
            : readRuntimeOwnedCoordinatorRepairHistorySnapshot(
                rootCapability,
                recoveryId,
              );
        historyLockReleased = read.lockReleased;
        const publication = read.currentHistoryPublication;
        const operation = read.value?.snapshot.operations.find(
          (item): item is CoordinatorStateRepairOperation =>
            item.kind === "runtime_repair" && item.recoveryId === recoveryId,
        );
        if (
          read.status !== "completed" ||
          !read.lockReleased ||
          read.repairHistoryState !== "publication" ||
          !publication ||
          !read.value ||
          !operation ||
          !currentOwner() ||
          (nextStage !== null && publication.stage !== nextStage)
        )
          break;
        if (
          target &&
          (target.identityJson !== operation.identityJson ||
            target.identitySha256 !== operation.identitySha256)
        )
          break;
        const canonical = Buffer.from(
          `${encodeCoordinatorStateValue(read.value.snapshot)}\n`,
        );
        if (
          !prepareCoordinatorRepairHistorySummary(
            canonical,
            recoveryId,
            repository.repositoryBinding,
          )
        )
          break;
        bytes = canonical;
        target = operation;
        retentionConfirmed =
          operation.disposition === "retained_by_human_decision" &&
          operation.retention !== undefined;
        const recordedDeadline = operation.retention?.reviewAfter ?? null;
        if (
          retentionReviewAfter !== null &&
          retentionReviewAfter !== recordedDeadline
        )
          break;
        retentionReviewAfter = recordedDeadline;
        outcomeConfirmed = true;
        finalCheckpointConfirmed = operation.checkpoint !== null;
        nativeCleanupConfirmed =
          nativeCleanupConfirmed ||
          operation.checkpoint?.cleanup === "confirmed";
        if (!publication.needsWrite) {
          historyConfirmed = operation.history?.confirmed === true;
          if (historyConfirmed) return true;
          break;
        }
        if (step === 2) break;
        writing = true;
        const saved = advanceRuntimeOwnedCoordinatorRepairHistory(
          {
            ...repository,
            operationId: JSON.parse(operation.identityJson).operationId,
          },
          recoveryId,
          currentOwner,
        );
        writing = false;
        historyLockReleased = saved.lockReleased;
        if (saved.filesystemEffectIssued) historyEffectIssued = true;
        if (
          saved.status !== "completed" ||
          !saved.snapshotConfirmed ||
          !saved.lockReleased ||
          !currentOwner()
        )
          break;
        nextStage =
          publication.stage === "checkpoint" ? "publish" : "confirmed";
      }
    } catch {
      if (writing && historyEffectIssued !== true) historyEffectIssued = null;
      historyLockReleased = null;
    }
    storageFailed = true;
    return false;
  };
  /**
   * 履歴確認済みで既存completion契約を満たす修復を現在状態から終了整理する。
   * @responsibility 除去保存・marker清掃・fresh不存在の共同成立を確認する。
   * @trace ARCH-000008
   * @input initial: exact終了前置Readerの任意の確認済み結果。
   * @returns 全終了条件を確認できた場合だけtrue。
   * @precondition 現在保存Ownerが有効で、検証済みreceipt付き保持を含む既存completion契約を満たす。
   * @postcondition 失敗後に技術処置や履歴保存へ戻らない。
   * @effect 既存completion Writerとmarker限定清掃。
   * @failure Reader・Writer・清掃・解放・Owner不明はsticky停止。
   * @invariant 履歴からNative回収やcheckpoint詳細を復元しない。
   * @boundary 修復compositionと既存現在状態の終了保存。
   * @security 新Store・Lock・任意Path・Docker要求なし。
   * @concurrency 各境界後に同じ現在Ownerを確認する。
   */
  const settleCompletion = (
    initial?: ReturnType<
      typeof readRuntimeOwnedCoordinatorRepairCompletionSnapshot
    >,
  ) => {
    let writing = false;
    try {
      if (!recoveryId || !currentOwner()) throw new Error("completion_owner");
      completionLockReleased = null;
      const observed =
        initial ??
        readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
          rootCapability,
          recoveryId,
        );
      completionLockReleased = observed.lockReleased;
      if (
        observed.status !== "completed" ||
        !observed.lockReleased ||
        (retentionReviewAfter !== null &&
          observed.repairRetentionReviewAfter !== retentionReviewAfter) ||
        (purpose === "retain" &&
          observed.repairRetentionReviewAfter === null) ||
        !currentOwner()
      )
        throw new Error("completion_read");
      retentionReviewAfter = observed.repairRetentionReviewAfter;
      retentionConfirmed = retentionReviewAfter !== null;
      if (!observed.repairCompletionAbsent) {
        const operation = observed.value?.snapshot.operations.find(
          (item): item is CoordinatorStateRepairOperation =>
            item.kind === "runtime_repair" && item.recoveryId === recoveryId,
        );
        if (
          !observed.currentCompletionPublication ||
          !operation ||
          !(
            operation.disposition === "not_applicable" ||
            (operation.disposition === "discard" &&
              dockerRuntimeRepairDisposalIsSettled(
                operation.disposal?.checkpoint,
              )) ||
            (operation.disposition === "retained_by_human_decision" &&
              operation.retention?.reviewAfter === retentionReviewAfter)
          ) ||
          (target && target.identityJson !== operation.identityJson)
        )
          throw new Error("completion_target");
        // 現在操作が読める場合だけ、既確定結果の個別事実を投影する。
        outcomeConfirmed = true;
        finalCheckpointConfirmed = true;
        nativeCleanupConfirmed = true;
        historyConfirmed = true;
        writing = true;
        completionLockReleased = null;
        const saved = completeRuntimeOwnedCoordinatorRepair(
          rootCapability,
          recoveryId,
          currentOwner,
        );
        writing = false;
        completionLockReleased = saved.lockReleased;
        if (saved.filesystemEffectIssued) completionEffectIssued = true;
        if (
          saved.status !== "completed" ||
          !saved.snapshotConfirmed ||
          !saved.lockReleased ||
          !currentOwner()
        )
          throw new Error("completion_save");
      }
      stateMarkerCleanup = null;
      stateMarkerCleanup =
        cleanupRuntimeOwnedCoordinatorStateMarker(rootCapability);
      if (
        stateMarkerCleanup.status !== "completed" ||
        !stateMarkerCleanup.storageConfirmed ||
        !stateMarkerCleanup.markerAbsentConfirmed ||
        !stateMarkerCleanup.lockReleased ||
        !currentOwner()
      )
        throw new Error("completion_marker");
      completionLockReleased = null;
      const fresh = readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
        rootCapability,
        recoveryId,
      );
      completionLockReleased = fresh.lockReleased;
      if (
        fresh.status !== "completed" ||
        !fresh.lockReleased ||
        !fresh.repairCompletionAbsent ||
        fresh.repairRetentionReviewAfter !== retentionReviewAfter ||
        !currentOwner()
      )
        throw new Error("completion_fresh");
      historyConfirmed = true;
      completionConfirmed = true;
      return true;
    } catch {
      if (writing && completionEffectIssued !== true)
        completionEffectIssued = null;
      storageFailed = true;
      return false;
    }
  };
  try {
    if (
      (purpose !== "repair" && purpose !== "retain") ||
      (purpose === "retain" && requestedRecoveryId === null)
    )
      return stopped("runtime_repair_boundary_unavailable");
    if (!repository || !currentOwner())
      return stopped("runtime_repair_boundary_unavailable");
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (verified.status !== "completed" || !currentOwner())
      return stopped("runtime_repair_boundary_unavailable");
    const area = observeRepositoryRuntimeDataArea(
      verified.capability,
      "coordinator",
    );
    if (area.status === "ready") {
      if (!currentOwner()) return stopped();
      if (requestedRecoveryId !== null) {
        {
          const completion =
            readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
              rootCapability,
              requestedRecoveryId,
            );
          completionLockReleased = completion.lockReleased;
          if (!completion.lockReleased || !currentOwner()) return stopped();
          if (
            completion.status === "completed" &&
            (completion.currentCompletionPublication ||
              completion.repairCompletionAbsent)
          ) {
            if (
              purpose === "retain" &&
              completion.repairRetentionReviewAfter === null
            )
              return stopped();
            if (!settleCompletion(completion)) return stopped();
            return Object.freeze({
              ...stopped(),
              status: "observed" as const,
              reason: "runtime_repair_recovered",
              technicalStatus: null,
            });
          }
          {
            let history = readRuntimeOwnedCoordinatorRepairHistorySnapshot(
              rootCapability,
              requestedRecoveryId,
            );
            historyLockReleased = history.lockReleased;
            if (!history.lockReleased || !currentOwner()) return stopped();
            if (history.status !== "completed") {
              // 技術fallbackではなく、既存の有限metadata出版だけを一度試す。
              statePublication = resumeRuntimeOwnedCoordinatorRepairPublication(
                rootCapability,
                requestedRecoveryId,
                currentOwner,
              );
              if (
                statePublication.status !== "completed" ||
                !statePublication.snapshotConfirmed ||
                !statePublication.lockReleased ||
                !currentOwner()
              )
                return stopped();
              history = readRuntimeOwnedCoordinatorRepairHistorySnapshot(
                rootCapability,
                requestedRecoveryId,
              );
              historyLockReleased = history.lockReleased;
              if (
                history.status !== "completed" ||
                !history.lockReleased ||
                !currentOwner()
              )
                return stopped();
            }
            if (history.repairHistoryState === "publication") {
              if (purpose === "retain") {
                const retained = history.value?.snapshot.operations.find(
                  (operation) =>
                    operation.kind === "runtime_repair" &&
                    operation.recoveryId === requestedRecoveryId,
                );
                if (
                  retained?.kind !== "runtime_repair" ||
                  retained.retention === undefined
                )
                  return stopped();
                retentionReviewAfter = retained.retention.reviewAfter;
              }
              if (!settleHistory(history)) return stopped();
              const recorded = target as CoordinatorStateRepairOperation | null;
              if (
                recorded?.outcome?.status === "recovered" &&
                (recorded.disposition === "not_applicable" ||
                  recorded.disposition === "discard" ||
                  recorded.retention !== undefined) &&
                !settleCompletion()
              )
                return stopped();
              return Object.freeze({
                ...stopped(),
                status: "observed" as const,
                reason:
                  recorded?.outcome?.reason ??
                  "runtime_repair_state_unavailable",
                technicalStatus: null,
              });
            }
            if (history.repairHistoryState !== "technical_state")
              return stopped();
          }
        }
        if (statePublication === null)
          statePublication = resumeRuntimeOwnedCoordinatorRepairPublication(
            rootCapability,
            requestedRecoveryId,
            currentOwner,
          );
        if (
          (statePublication.status !== "completed" &&
            statePublication.status !== "no_pending") ||
          !statePublication.lockReleased ||
          (statePublication.status === "completed" &&
            !statePublication.snapshotConfirmed) ||
          !currentOwner()
        )
          return stopped();
      }
      stateMarkerCleanup =
        cleanupRuntimeOwnedCoordinatorStateMarker(rootCapability);
      if (
        stateMarkerCleanup.status !== "completed" ||
        !stateMarkerCleanup.storageConfirmed ||
        !stateMarkerCleanup.markerAbsentConfirmed ||
        !stateMarkerCleanup.lockReleased ||
        !currentOwner()
      )
        return stopped();
      const read = readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
      if (
        read.status !== "completed" ||
        !read.lockReleased ||
        !read.value ||
        !currentOwner()
      )
        return stopped();
      bytes = Buffer.from(
        `${encodeCoordinatorStateValue(read.value.snapshot)}\n`,
      );
      const repairs = read.value.snapshot.operations.filter(
        (item): item is CoordinatorStateRepairOperation =>
          item.kind === "runtime_repair",
      );
      if (requestedRecoveryId !== null) {
        target =
          repairs.find((item) => item.recoveryId === requestedRecoveryId) ??
          null;
        if (purpose === "retain") {
          if (!target || !currentOwner()) return stopped();
          if (target.retention === undefined) {
            if (
              target.phase !== "awaiting_disposition" ||
              target.disposition !== "pending_human_decision" ||
              !target.checkpoint ||
              signal.aborted
            )
              return stopped();
            const identity = JSON.parse(target.identityJson);
            const targets = observeDockerRuntimeRepairRetention({
              operationNonce: identity.operationNonce,
              ownerBindingSha256: identity.ownerBindingSha256,
              scopeSha256: identity.scopeSha256,
              checkpoint: target.checkpoint,
              signal,
              canObserve: currentOwner,
            });
            if (!targets || signal.aborted || !currentOwner()) return stopped();
            const decidedAt = new Date().toISOString();
            const reviewAfter = new Date(
              Date.parse(decidedAt) + 604800000,
            ).toISOString();
            if (
              !save(
                prepareCoordinatorStateRepairRetentionHandoffSnapshot(
                  bytes,
                  requestedRecoveryId,
                  { decidedAt, reviewAfter, targets },
                  repository.repositoryBinding,
                ),
                "retention_handoff",
              )
            )
              return stopped();
          }
          if (
            !target.retention ||
            target.disposition !== "retained_by_human_decision"
          )
            return stopped();
          retentionReviewAfter = target.retention.reviewAfter;
          retentionConfirmed = true;
          outcomeConfirmed = true;
          finalCheckpointConfirmed = true;
          nativeCleanupConfirmed = true;
          if (!settleHistory() || !settleCompletion()) return stopped();
          return Object.freeze({
            ...stopped(),
            status: "observed" as const,
            reason: "runtime_repair_recovered" as const,
            technicalStatus: null,
          });
        }
        if (
          target?.outcome?.status === "recovered" &&
          (target.disposition === "discard" ||
            target.disposition === "pending_human_decision")
        ) {
          outcomeConfirmed = true;
          finalCheckpointConfirmed = target.checkpoint !== null;
          nativeCleanupConfirmed = target.checkpoint?.cleanup === "confirmed";
          if (
            !(await settleDisposal()) ||
            !settleHistory() ||
            !settleCompletion()
          )
            return stopped();
          return Object.freeze({
            ...stopped(),
            status: "observed" as const,
            reason: target.outcome.reason,
            technicalStatus: null,
          });
        }
        if (target?.phase !== "repairing" || target.outcome !== null) {
          if (target?.outcome) {
            outcomeConfirmed = true;
            finalCheckpointConfirmed = target.checkpoint !== null;
            nativeCleanupConfirmed = target.checkpoint?.cleanup === "confirmed";
            if (
              prepareCoordinatorRepairHistorySummary(
                bytes,
                recoveryId,
                repository.repositoryBinding,
              ) &&
              settleHistory() &&
              (target.outcome.status !== "recovered" ||
                (target.disposition !== "not_applicable" &&
                  target.disposition !== "discard" &&
                  target.retention === undefined) ||
                settleCompletion())
            )
              return Object.freeze({
                ...stopped(),
                status: "observed" as const,
                reason: target.outcome.reason,
                technicalStatus: null,
              });
          }
          return stopped();
        }
        if (target.primaryFailure !== null) {
          const savedFailure = target.primaryFailure;
          const savedCheckpoint = target.checkpoint;
          if (
            savedFailure.stage !== "repair" ||
            savedFailure.reason !== "runtime_repair_effect_unknown" ||
            !savedCheckpoint ||
            !["confirmed", "unknown"].includes(savedCheckpoint.cleanup) ||
            repairs.filter((item) => item.recoveryId === requestedRecoveryId)
              .length !== 1 ||
            repairs.some(
              (item) => item !== target && item.phase !== "awaiting_delivery",
            ) ||
            read.value.snapshot.unresolvedRecoveries.some(
              (item) => item.recoveryId === requestedRecoveryId,
            ) ||
            read.value.snapshot.pendingDeliveries.some(
              (item) => item.recoveryId === requestedRecoveryId,
            )
          )
            return stopped();
          // 記録の確定だけであり、新しいNative／Docker処置を開始しない。
          nativeCleanupConfirmed = savedCheckpoint.cleanup === "confirmed";
          finalCheckpointConfirmed = true;
          if (
            !save(
              prepareCoordinatorStateRepairCheckpointSnapshot(
                bytes,
                recoveryId,
                {
                  phase: "settling",
                  checkpoint: savedCheckpoint,
                  disposition: target.disposition,
                  primaryFailure: savedFailure,
                  outcome: {
                    status: "blocked",
                    reason: savedFailure.reason,
                    cleanupConfirmed: nativeCleanupConfirmed,
                  },
                },
                repository.repositoryBinding,
              ),
              "checkpoint",
            )
          )
            return stopped();
          outcomeConfirmed = true;
          if (
            target.disposition !== "pending_human_decision" &&
            !settleHistory()
          )
            return stopped();
          return Object.freeze({
            status: "observed" as const,
            reason: savedFailure.reason,
            recoveryId,
            finalCheckpointConfirmed: true,
            outcomeConfirmed: true,
            retentionConfirmed,
            retentionReviewAfter,
            historyConfirmed,
            historyEffectIssued,
            historyLockReleased,
            nativeCleanupConfirmed,
            completionConfirmed,
            completionEffectIssued,
            completionLockReleased,
            stateMarkerCleanup,
            statePublication,
            technicalStatus: null,
          });
        }
      } else if (repairs.some((item) => item.phase !== "awaiting_delivery"))
        return stopped();
    } else if (
      area.status !== "not_observed" ||
      requestedRecoveryId !== null ||
      !currentOwner()
    )
      return stopped();
    if (signal.aborted) return stopped("runtime_repair_boundary_unavailable");
    const previousIdentity =
      target === null
        ? null
        : (JSON.parse(target.identityJson) as {
            operationNonce: string;
            operationId: string;
            ownerBindingSha256: string;
            scopeSha256: string;
          });
    const nonce =
      previousIdentity?.operationNonce ?? randomBytes(32).toString("hex");
    const operationId =
      previousIdentity?.operationId ??
      `OP-${BigInt(`0x${randomUUID().replaceAll("-", "")}`)
        .toString(10)
        .padStart(6, "0")}`;
    const result = await runDockerRuntimeRepairSession({
      operationNonce: nonce,
      signal,
      resume:
        target?.checkpoint && previousIdentity
          ? {
              ownerBindingSha256: previousIdentity.ownerBindingSha256,
              scopeSha256: previousIdentity.scopeSha256,
              checkpoint: target.checkpoint,
            }
          : null,
      canIssueEffect: () => !signal.aborted && currentOwner(),
      canRecordCheckpoint: currentOwner,
      onPrepared: (value) => {
        preparedCalls++;
        if (preparedCalls !== 1 || !currentOwner() || signal.aborted)
          return false;
        if (
          previousIdentity &&
          (previousIdentity.ownerBindingSha256 !== value.ownerBindingSha256 ||
            previousIdentity.scopeSha256 !== value.scopeSha256)
        )
          return false;
        if (target === null) {
          const identityJson = `${JSON.stringify({ schema: "crdd-coordinator/runtime-repair-identity/v1", kind: "runtime_repair", operationNonce: nonce, operationId, repositoryBinding: repository.repositoryBinding, ownerBindingSha256: value.ownerBindingSha256, scopeSha256: value.scopeSha256, consumer: "coordinator_cli" })}\n`;
          recoveryId = `docker-runtime-repair.${nonce}.${createHash("sha256").update(identityJson).digest("hex")}`;
          if (
            !save(
              prepareCoordinatorStateRepairSnapshot(
                bytes,
                identityJson,
                repository.repositoryBinding,
              ),
              "checkpoint",
            )
          )
            return false;
        }
        if (!target) return false;
        if (target.checkpoint !== null) {
          const candidate = prepareCoordinatorStateRepairSessionSnapshot(
            bytes,
            recoveryId,
            repository.repositoryBinding,
          );
          const preparedTarget = candidate
            ? decodeCoordinatorStateSnapshot(
                candidate,
                repository.repositoryBinding,
              )?.snapshot.operations.find(
                (item): item is CoordinatorStateRepairOperation =>
                  item.kind === "runtime_repair" &&
                  item.recoveryId === recoveryId,
              )
            : null;
          if (
            !preparedTarget ||
            encodeCoordinatorStateValue(preparedTarget.checkpoint) !==
              encodeCoordinatorStateValue(value.checkpoint) ||
            !save(candidate, "session_begin")
          )
            return false;
        } else {
          prepared = true;
          if (!checkpoint(value.checkpoint)) {
            prepared = false;
            return false;
          }
        }
        prepared = true;
        return true;
      },
      onCheckpoint: checkpoint,
    });
    nativeCleanupConfirmed = result.lifecycle?.cleanup.cleanup === "confirmed";
    const primaryFailure = result.machine?.primaryFailure
      ? { stage: "repair" as const, reason: result.machine.primaryFailure }
      : null;
    if (
      !prepared ||
      !result.checkpoint ||
      !checkpoint(result.checkpoint, primaryFailure) ||
      !target ||
      !currentOwner()
    )
      return stopped();
    finalCheckpointConfirmed = true;
    const technical = result.machine;
    const lifecycle = result.lifecycle;
    const clean =
      result.checkpoint.cleanup === "confirmed" &&
      result.checkpoint.cleanupFailure === null &&
      lifecycle?.cleanup.protocol === "completed";
    const complete =
      technical?.status === "recovered" &&
      result.checkpoint.engine === "ready" &&
      result.checkpoint.hostSafety === "safe" &&
      result.checkpoint.stale !== "unknown" &&
      dockerRuntimeRepairCheckpointIsSettled(result.checkpoint);
    let outcome: CoordinatorStateRepairOperation["outcome"] = null;
    if (technical?.status === "recovered") {
      outcome =
        complete &&
        clean &&
        (lifecycle?.failure === null || lifecycle?.failure === "cancelled")
          ? {
              status: "recovered",
              reason: "runtime_repair_recovered",
              cleanupConfirmed: true,
            }
          : {
              status: "blocked",
              reason:
                lifecycle?.failure && lifecycle.failure !== "cancelled"
                  ? "runtime_repair_boundary_unavailable"
                  : !clean
                    ? "runtime_repair_cleanup_unknown"
                    : "runtime_repair_failed_closed",
              cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
            };
    } else if (technical?.primaryFailure) {
      outcome = {
        status: "blocked",
        reason: technical.primaryFailure,
        cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
      };
    } else if (lifecycle?.failure === "cancelled") {
      outcome = {
        status: "cancelled",
        reason: "runtime_repair_cancelled",
        cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
      };
    } else if (lifecycle?.failure) {
      outcome = {
        status: "blocked",
        reason: "runtime_repair_boundary_unavailable",
        cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
      };
    }
    if (
      outcome !== null &&
      !save(
        prepareCoordinatorStateRepairCheckpointSnapshot(
          bytes,
          recoveryId,
          {
            phase:
              outcome.status === "recovered" &&
              target.disposition === "pending_human_decision"
                ? "awaiting_disposition"
                : "settling",
            checkpoint: target.checkpoint,
            disposition: target.disposition,
            primaryFailure: target.primaryFailure,
            outcome,
          },
          repository.repositoryBinding,
        ),
        "checkpoint",
      )
    )
      return stopped();
    outcomeConfirmed = outcome !== null;
    if (
      outcome?.status === "recovered" &&
      target.disposition === "pending_human_decision"
    ) {
      if (!(await settleDisposal()) || !settleHistory() || !settleCompletion())
        return stopped();
      return Object.freeze({
        ...stopped(),
        status: "observed" as const,
        reason: outcome.reason,
        technicalStatus: result.machine?.status ?? null,
      });
    }
    if (
      outcome !== null &&
      target.disposition !== "pending_human_decision" &&
      !settleHistory()
    )
      return stopped();
    if (
      outcome?.status === "recovered" &&
      (target.disposition === "not_applicable" ||
        target.disposition === "discard") &&
      !settleCompletion()
    )
      return stopped();
    return Object.freeze({
      status: "observed" as const,
      reason:
        outcome?.reason ??
        result.machine?.reason ??
        "runtime_repair_boundary_unavailable",
      recoveryId,
      finalCheckpointConfirmed: true,
      outcomeConfirmed,
      retentionConfirmed,
      retentionReviewAfter,
      historyConfirmed,
      historyEffectIssued,
      historyLockReleased,
      completionConfirmed,
      completionEffectIssued,
      completionLockReleased,
      nativeCleanupConfirmed,
      stateMarkerCleanup,
      statePublication,
      technicalStatus: result.machine?.status ?? null,
    });
  } catch {
    return stopped();
  } finally {
    ownerAlive = false;
  }
}
