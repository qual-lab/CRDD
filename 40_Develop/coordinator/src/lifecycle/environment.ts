/**
 * 実行環境の設定・観測・診断と、技術資源の記録・回復を所有する。
 *
 * @responsibility DIの起動設定、Provider Homeの観測、通常試行・隔離Probe・復旧の技術資源を元の操作記録へ結び付ける。処置はExecutor、保存は実行モデルに委譲する。
 * @trace ARCH-000004, ARCH-000008, ARCH-000010
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual, types } from "node:util";
import {
  getAuthenticationDefinition,
  getBillingPolicy,
} from "../../../ai-adapter/src/index.ts";
import {
  describeIsolationConfiguration,
  initializeIsolation,
  type IsolationSettings,
} from "../../../docker-isolation/src/index.ts";
import {
  completeExecution,
  createExecution,
  type ExecutionCompleteInput,
  type WriteResult,
} from "../../../execution-intelligence/src/index.ts";
import {
  applyResourceEvent,
  applyResourceCleanup,
  completeOperation,
  completeRecovery,
  ExecutionStorageBlockedError,
  type ExecutionOperationRecord,
  type ExecutionSelection,
  type ExecutionStateSnapshot,
  type OperationRecord,
  parseDockerTaskRecoveryId,
  inspectExecutionSelection,
  type RestartCheckpoint,
  type RepairCheckpoint,
  type RepairOperationRecord,
  type RepairSaveRequest,
  readState,
  resumeRepairRecordSave,
  type StateVersion,
  saveRecoveryHistory,
  saveRecoveryCheckpoint,
  saveRepairRecord,
  saveOperationCheckpoint,
  saveOperationStart,
} from "../../../execution-model/src/index.ts";
import {
  type CompletionResult,
  type DockerEnvironmentRestartEvent,
  type DockerEnvironmentResult,
  type ResourceCleanupResult as ExecutorResourceCleanupResult,
  type StartResult,
  cleanupResources,
  createExecutor,
  type Executor,
  type ExecutorRequest,
  type IsolationProbeFacts,
  type IsolationProbeOptions,
  inspectResources,
  restartDockerEnvironment,
  startDockerEnvironment,
  type ResourceTarget,
} from "../../../executor/src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "../../../version-control/src/index.ts";
import {
  safeRecoveryReason,
  snapshotPlainRecord,
  snapshotJsonValue,
  snapshotPlainArray,
} from "./validation.ts";
import type {
  CoordinatorExecutionPublicationObservation,
  ProviderExecutionOutcome,
  ProviderExecutionRecording,
  AttemptCleanupInput,
  HostCompletionTarget,
  RecordedAttemptObservation,
  RecoveryPlan,
  RecoveryStartFailureDiagnostic,
  ResourceCleanupResult,
} from "./types.ts";
import {
  getExecutionIntelligenceStore,
  historyRepositoryInput,
  observeRepositoryExecutionDataArea,
  RepositoryDataBlockedError,
  withHistoryRetention,
  poisonRuntimeProcessAfterCleanupUnknown,
  acquireHostOperationRecoveryGeneration,
  acquireExecutionStateLock,
  acquireHostOperationLock,
  acquireProviderHomeLock,
  abandonOwnedHostOperationGenerationLock,
  borrowRuntimeOwnedCoordinatorStateRepository,
  operationStartInput,
  operationStateInput,
  verifyOwnedOperationManagementCapability,
  verifyOwnedOperationCleanupOutcome,
  isHostOperationRootAbsent,
  resolveRepositoryExecutionDataPaths,
  verifyHostOperationRecoveryGeneration,
  borrowHostRecoveryManagementDirectory,
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  classifyOwnedCoordinatorOperationCreationFailure,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationManagementCapability,
  createRuntimeOwnedCoordinatorOperation,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  readOwnedHostOperation,
  recordOwnedHostResources,
  readHostRecoveryOperation,
  observeHostRecoveryRoot,
  type ProductionOperationFailure,
  type HostOperationRecording,
  recordHostRecoveryResources,
  verifyOwnedMountCapability,
} from "./host.ts";

const isolationSettings = (() => {
  try {
    return initializeIsolation({
      windowsDirectory: process.env.SystemRoot ?? "",
      userHomeDirectory: os.userInfo().homedir,
      ...(process.env.LOCALAPPDATA
        ? { desktop: { userDataDirectory: process.env.LOCALAPPDATA } }
        : {}),
    });
  } catch {
    return null;
  }
})();

/** 初期化不成立時はDocker要求を発行せず停止する。操作中の再取得はしない。 */
export function getIsolationSettings(): IsolationSettings {
  if (!isolationSettings) throw Error("isolation_settings_unavailable");
  return isolationSettings;
}

const LIFECYCLE_NOTICE_TIMEOUT_MS = 5_000;

/**
 * Runtime 所有 Lifecycle Notice Reporterを構築する。
 *
 * @responsibility Runtime 所有 Lifecycle Notice Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input stream: Writable、prefix: Lifecycle／選定／送信案内の固定表示prefix。
 * @returns write完了でresolve、error／close／既存期限でrejectする通知関数。
 * @precondition 「stream: Writable」がcreateRuntimeOwnedLifecycleNoticeReporterの入力契約を満たす。
 * @postcondition createRuntimeOwnedLifecycleNoticeReporterの責務を完了した結果だけを返す。
 * @effect 呼出し時だけ既存streamへ非秘密通知を書き、同じ要求のListener／Timerを解除する。
 * @failure createRuntimeOwnedLifecycleNoticeReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeOwnedLifecycleNoticeReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createRuntimeOwnedLifecycleNoticeReporterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createRuntimeOwnedLifecycleNoticeReporterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createRuntimeOwnedLifecycleNoticeReporter(
  stream: Writable,
  prefix:
    | "[Coordinator lifecycle]"
    | "[Coordinator selection]"
    | "[Coordinator authorization]" = "[Coordinator lifecycle]",
) {
  return (notice: Readonly<Record<string, unknown>>): Promise<void> => {
    if (!stream.writable || stream.destroyed)
      return Promise.reject(Error("lifecycle_notice_unavailable"));
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(
        () => settle(false),
        LIFECYCLE_NOTICE_TIMEOUT_MS,
      );
      const settle = (isValue: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stream.off("error", onFailure);
        stream.off("close", onFailure);
        if (isValue) resolve();
        else reject(Error("lifecycle_notice_unavailable"));
      };
      const onFailure = () => settle(false);
      stream.once("error", onFailure);
      stream.once("close", onFailure);
      try {
        stream.write(
          `${prefix} ${JSON.stringify(notice)}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle(true);
          },
        );
      } catch {
        settle(false);
      }
    });
  };
}

/**
 * 開始済みの実行へ取消を搬送し、元の完了通知を待つ。
 *
 * @responsibility 取消搬送、完了待機と監視解除を一つの呼出しへ収束させる。
 * @trace ARCH-000004
 * @input 検証済みの制御参照、完了Promise、固定取消操作と取消Signal。
 * @returns 完了の観測結果。Promise拒否はunknownと元Errorを内部で返す。
 * @precondition 呼出し側が開始結果と各入力の形を検証済みである。
 * @postcondition 元の完了待機が終端し、登録したabort監視を解除する。
 * @effect 同じ実行へ取消要求を渡す。新しい実行やProvider要求は作らない。
 * @failure 取消の失敗で完了待機を切り離さず、完了拒否は未観測として保持する。
 * @invariant Signalによる取消搬送は一度だけで、取消の応答をcleanupの根拠にしない。
 * @boundary 開始済みのTask、Advice、Doctor診断の制御参照と完了通知のProcess内境界。
 * @security 制御参照や未検証の完了値を公開結果・ログへ出さない。
 * @concurrency 登録前の同期取消も確認し、元のPromiseを必ず待つ。
 */
export async function observeExecutionCompletion<T>(
  started: Readonly<{
    controlCapability: object;
    completion: Promise<T>;
  }>,
  cancelExecution: (controlCapability: object) => unknown,
  cancellationSignal: AbortSignal,
): Promise<ExecutionCompletionObservation<T>> {
  let cancellationTransferred = false;
  /**
   * 同じ実行へSignal取消を一度だけ転送する。
   *
   * @responsibility 取消搬送の重複と未処理rejectionを防ぎ、元の完了待機を維持する。
   * @trace ARCH-000004
   * @input N/A: 閉包内の制御参照と搬送状態を使用する。
   * @returns N/A: 完了結果を返さない。
   * @precondition 開始結果の制御参照が検証済みである。
   * @postcondition 取消搬送済みの事実を保持し、再呼出しで重複搬送しない。
   * @effect 同じ実行の固定取消操作へ要求を渡す。
   * @failure 同期例外とPromise拒否を処置し、完了待機へ委ねる。
   * @invariant 取消搬送をcleanup成立として扱わない。
   * @boundary Process内の取消Signalと開始済み実行の制御操作。
   * @security 新しいAuthorityや実行を作らない。
   * @concurrency 搬送済みフラグを取消呼出し前に確定する。
   */
  const forwardCancellation = () => {
    if (cancellationTransferred) return;
    cancellationTransferred = true;
    try {
      const settlement = cancelExecution(started.controlCapability);
      if (settlement instanceof Promise) settlement.catch(() => {});
    } catch {
      // 取消入口の失敗で元の完了待機を切り離さない。
    }
  };
  cancellationSignal.addEventListener("abort", forwardCancellation, {
    once: true,
  });
  if (cancellationSignal.aborted) forwardCancellation();
  try {
    const rawCompletion = await started.completion;
    return { status: "observed", rawCompletion, cancellationTransferred };
  } catch (error) {
    return { status: "unknown", error };
  } finally {
    cancellationSignal.removeEventListener("abort", forwardCancellation);
  }
}

/**
 * 完了Promiseの観測結果を表す。
 *
 * @responsibility 未検証の完了値と取消搬送事実、完了拒否を区別する。
 * @trace ARCH-000004
 * @shape observedはrawCompletionとcancellationTransferred、unknownは観測不能と元の拒否値を内部で保持する。
 * @invariant observedは実行成功や資源回収の成立を意味しない。
 * @boundary Process内の完了観測と上位結果検証の境界。
 * @security rawCompletionと拒否Errorを公開結果やログへ直接搬送しない。
 * @compatibility 利用側はstatusで分岐し、未検証値を正式な実行結果として扱わない。
 */
type ExecutionCompletionObservation<T = unknown> =
  | Readonly<{
      status: "observed";
      rawCompletion: T;
      cancellationTransferred: boolean;
    }>
  | Readonly<{ status: "unknown"; error: unknown }>;

/**
 * 通常実行の環境を起動し、現在の許可を再確認できた場合だけHostを作成する。
 * @responsibility TaskとAdviceの通常起動、待機後の再照合、Host作成への進行を共有する。
 * @trace ARCH-000008
 * @boundary 技術的な起動はExecutorへ委譲する。明示修復・再起動・認証は対象外。
 * @failure 起動不成立ではHostを作成しない。作成で回収が不明なら既存の用途別条件で新規実行を止め、呼出し側へ失敗事実を返す。
 * @concurrency 許可の再照合から同期Host作成まで別の待機を挟まない。
 */
export async function openExecutionHost(
  signal: AbortSignal,
  current: () => boolean,
  input: HostOperationRecording &
    (
      | Readonly<{ purpose: "task" }>
      | Readonly<{ purpose: "advice"; executionCurrent: () => boolean }>
    ),
) {
  const verifyBoundary = () => {
    try {
      return !signal.aborted && current() === true;
    } catch {
      return false;
    }
  };
  const startup = await startDockerEnvironment(
    { signal, verifyBoundary },
    getIsolationSettings(),
  );
  if (startup.status === "ready" && verifyBoundary()) {
    try {
      return {
        status: "opened" as const,
        operation: createRuntimeOwnedCoordinatorOperation({
          root: input.root,
          purpose: input.purpose,
          recordingCurrent: input.recordingCurrent,
          signal,
          executionCurrent:
            input.purpose === "task" ? current : input.executionCurrent,
        }),
      };
    } catch (error) {
      const failure = classifyOwnedCoordinatorOperationCreationFailure(error);
      if (!failure && input.purpose === "task") throw error;
      if (!failure?.cleanupConfirmed) poisonRuntimeProcessAfterCleanupUnknown();
      return { status: "creation_failed" as const, failure };
    }
  }
  return {
    status: "startup_failed" as const,
    failure: {
      reason:
        startup.status === "ready"
          ? "docker_environment_start_boundary_unconfirmed"
          : startup.reason,
      hostRecoveryId: null,
      cleanupConfirmed: startup.cleanupConfirmed,
      manualRecoveryRequired:
        !startup.cleanupConfirmed || startup.requestState !== "not_issued",
    } satisfies ProductionOperationFailure,
  };
}

type RepairOperationState = Extract<
  NonNullable<ReturnType<typeof readState>["value"]>["operationStates"][number],
  { kind: "runtime_repair" }
>;

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
  let version: StateVersion | null = null;
  let target: RepairOperationRecord | null = null;
  let checkpointSettled = false;
  let disposalSettled = false;
  let operationCleanupConfirmed = false;
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
  let statePublication: ReturnType<typeof resumeRepairRecordSave> | null = null;
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
      operationCleanupConfirmed,
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
   * 修復の論理更新をモデルへ渡して確定結果を受け取る。
   * @responsibility Snapshotを構築せず、保存確認済みの改訂だけを次のCAS元版へ進める。
   * @trace ARCH-000008
   * @input change: 技術観測または保持・廃棄判断に基づく固定更新。
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
  const save = (change: RepairSaveRequest["change"]) => {
    if (!repository || !recoveryId || !currentOwner()) {
      storageFailed = true;
      return false;
    }
    try {
      const result = saveRepairRecord(
        rootCapability,
        recoveryId,
        { expected: version, change },
        currentOwner,
      );
      if (
        result.status !== "completed" ||
        !result.snapshotConfirmed ||
        !result.lockReleased ||
        !result.value
      ) {
        storageFailed = true;
        return false;
      }
      version = result.value.version;
      target = result.value.operation;
      checkpointSettled = result.value.checkpointSettled;
      disposalSettled = result.value.disposalSettled;
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
    value: RepairCheckpoint,
    primaryFailure: RepairOperationRecord["primaryFailure"] = null,
  ) => {
    if (!prepared || !target || !repository) return false;
    return save({
      kind: "checkpoint",
      update: {
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
    });
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
      !version ||
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
        !save({
          kind: "disposal_decision",
          decidedAt: new Date().toISOString(),
        })
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
    };
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
        !save({
          kind: "disposal_progress",
          purpose: purpose,
          checkpoint: intent,
        })
      )
        return false;
      if (!target?.disposal || !target.checkpoint || !version) return false;
      const expectedVersion = version;
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
        const read = readState(rootCapability, { scope: "recovery" });
        if (
          read.status !== "completed" ||
          !read.lockReleased ||
          !read.value ||
          !currentOwner() ||
          signal.aborted ||
          read.value.snapshot.revision !== expectedVersion.revision ||
          read.value.payloadSha256 !== expectedVersion.payloadSha256
        )
          return false;
        const matches = read.value.snapshot.operations.filter(
          (operation): operation is RepairOperationRecord =>
            operation.kind === "runtime_repair" &&
            operation.recoveryId === recoveryId,
        );
        return (
          matches.length === 1 &&
          matches[0]?.identityJson === identityJson &&
          matches[0].disposition === "discard" &&
          matches[0].disposal?.decidedAt === decidedAt &&
          isDeepStrictEqual(
            snapshotJsonValue(
              matches[0].disposal.checkpoint.directories[purpose],
            ),
            snapshotJsonValue(item),
          )
        );
      };
      if (!canDispose()) return false;
      const result = await cleanupResources(
        {
          kind: "docker_runtime_directory",
          input: {
            operationNonce: identity.operationNonce,
            checkpoint: target.checkpoint,
            purpose,
            signal,
            canIssueEffect: canDispose,
          },
        },
        getIsolationSettings(),
      );
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
        !save({
          kind: "disposal_progress",
          purpose: purpose,
          checkpoint: progress,
        }) ||
        result.absence !== "confirmed_absent"
      )
        return false;
    }
    return target?.disposal !== null && disposalSettled;
  };
  /**
   * 確定済み技術結果の履歴保存を一回依頼し、前後の業務事実を確認する。
   * @responsibility EMが検査済みの事実を保持し、技術処置と履歴確認を分離する。
   * @trace ARCH-000008
   * @input initial: 同呼出しで取得した専用Reader結果、または未取得。
   * @returns 正常な確認済み履歴と保存後条件が揃う場合だけtrue。
   * @precondition exact操作と現在Root／Revisionの保存Ownerが生存する。
   * @postcondition 失敗後の保存・技術再取得を停止し、既保存結果を消さない。
   * @effect 既存の完成履歴保存と前後のfresh読取り。
   * @failure 別対象、Owner失効、保存・読取り・排他不明はsticky停止。
   * @invariant 保存済みoperationIdをNative資格へ変換しない。
   * @boundary 修復compositionとRepository-local履歴保存。
   * @security Task配送・任意Path・任意候補へfallbackしない。
   * @concurrency 既存Kernel排他を使い、待機後も同じ現在Ownerを照合する。
   */
  const settleHistory = (initial?: ReturnType<typeof readState>) => {
    let writing = false;
    const accept = (read: ReturnType<typeof readState>) => {
      historyLockReleased = read.lockReleased;
      const publication = read.currentHistoryPublication;
      const operation = read.value?.snapshot.operations.find(
        (item): item is RepairOperationRecord =>
          item.kind === "runtime_repair" && item.recoveryId === recoveryId,
      );
      if (
        read.status !== "completed" ||
        !read.lockReleased ||
        read.repairHistoryState !== "publication" ||
        !publication ||
        !read.value ||
        !operation ||
        !currentOwner()
      )
        return false;
      if (
        target &&
        (target.identityJson !== operation.identityJson ||
          target.identitySha256 !== operation.identitySha256)
      )
        return false;
      // 同じ版の履歴Readerが要約・終端条件を確認済み。値検査を再実行しない。
      version = {
        revision: read.value.snapshot.revision,
        payloadSha256: read.value.payloadSha256,
      };
      target = operation;
      disposalSettled =
        read.value.operationStates.find(
          (state): state is RepairOperationState =>
            state.kind === "runtime_repair" && state.operation === operation,
        )?.disposalSettled === true;
      retentionConfirmed =
        operation.disposition === "retained_by_human_decision" &&
        operation.retention !== undefined;
      const recordedDeadline = operation.retention?.reviewAfter ?? null;
      if (
        retentionReviewAfter !== null &&
        retentionReviewAfter !== recordedDeadline
      )
        return false;
      retentionReviewAfter = recordedDeadline;
      outcomeConfirmed = true;
      finalCheckpointConfirmed = operation.checkpoint !== null;
      operationCleanupConfirmed =
        operationCleanupConfirmed ||
        operation.checkpoint?.cleanup === "confirmed";

      historyConfirmed = operation.history?.confirmed === true;
      return true;
    };
    const observe = () => {
      historyLockReleased = null;
      return readState(historyRepositoryInput(rootCapability), {
        scope: "recovery",
        input: { kind: "repair_history", recoveryId },
      });
    };
    try {
      if (!repository || !recoveryId || !currentOwner())
        throw new Error("history_owner");
      if (!accept(initial ?? observe())) throw new Error("history_read");
      if (historyConfirmed) return true;
      if (!target) throw new Error("history_target");
      writing = true;
      const saved = saveRecoveryHistory(
        {
          ...repository,
          ...withHistoryRetention(repository, rootCapability),
          operationId: JSON.parse(target.identityJson).operationId,
        },
        recoveryId,
        currentOwner,
        "runtime_repair",
      );
      writing = false;
      historyLockReleased = saved.lockReleased;
      if (saved.filesystemEffectIssued === true) historyEffectIssued = true;
      else if (
        saved.filesystemEffectIssued === null &&
        historyEffectIssued !== true
      )
        historyEffectIssued = null;
      if (
        saved.status !== "completed" ||
        !saved.snapshotConfirmed ||
        !saved.lockReleased ||
        !saved.historyConfirmed ||
        !currentOwner()
      )
        throw new Error("history_save");
      if (!accept(observe()) || !historyConfirmed)
        throw new Error("history_confirm");
      return true;
    } catch {
      if (writing && historyEffectIssued !== true) historyEffectIssued = null;
      if (writing) historyLockReleased = null;
    }
    storageFailed = true;
    return false;
  };
  /**
   * 履歴確認済みで既存completion契約を満たす修復を現在状態から終了整理する。
   * @responsibility 除去保存・履歴照合・fresh不存在の共同成立を確認する。
   * @trace ARCH-000008
   * @input initial: exact終了前置Readerの任意の確認済み結果。
   * @returns 全終了条件を確認できた場合だけtrue。
   * @precondition 現在保存Ownerが有効で、検証済みreceipt付き保持を含む既存completion契約を満たす。
   * @postcondition 失敗後に技術処置や履歴保存へ戻らない。
   * @effect 既存completion Writerとfresh読取り。
   * @failure Reader・Writer・清掃・解放・Owner不明はsticky停止。
   * @invariant 履歴からNative回収やcheckpoint詳細を復元しない。
   * @boundary 修復compositionと既存現在状態の終了保存。
   * @security 新Store・Lock・任意Path・Docker要求なし。
   * @concurrency 各境界後に同じ現在Ownerを確認する。
   */
  const settleCompletion = (initial?: ReturnType<typeof readState>) => {
    let writing = false;
    try {
      if (!recoveryId || !currentOwner()) throw new Error("completion_owner");
      completionLockReleased = null;
      const observed =
        initial ??
        readState(rootCapability, {
          scope: "recovery",
          input: {
            kind: "repair_completion",
            recoveryId: recoveryId,
          },
        });
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
          (item): item is RepairOperationRecord =>
            item.kind === "runtime_repair" && item.recoveryId === recoveryId,
        );
        if (
          !observed.currentCompletionPublication ||
          !operation ||
          !(
            operation.disposition === "not_applicable" ||
            (operation.disposition === "discard" &&
              observed.value?.operationStates.find(
                (state): state is RepairOperationState =>
                  state.kind === "runtime_repair" &&
                  state.operation === operation,
              )?.disposalSettled === true) ||
            (operation.disposition === "retained_by_human_decision" &&
              operation.retention?.reviewAfter === retentionReviewAfter)
          ) ||
          (target && target.identityJson !== operation.identityJson)
        )
          throw new Error("completion_target");
        // 現在操作が読める場合だけ、既確定結果の個別事実を投影する。
        outcomeConfirmed = true;
        finalCheckpointConfirmed = true;
        operationCleanupConfirmed = true;
        historyConfirmed = true;
        writing = true;
        completionLockReleased = null;
        const saved = completeRecovery(
          rootCapability,
          recoveryId,
          currentOwner,
          "runtime_repair",
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
      completionLockReleased = null;
      const fresh = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "repair_completion",
          recoveryId: recoveryId,
        },
      });
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
    const verified = getRepository(repository.repositoryRoot);
    if (verified.status !== "completed" || !currentOwner())
      return stopped("runtime_repair_boundary_unavailable");
    const area = observeRepositoryExecutionDataArea(
      verified.capability,
      "domain-model",
    );
    if (area.status === "ready") {
      if (!currentOwner()) return stopped();
      if (requestedRecoveryId !== null) {
        {
          const completion = readState(rootCapability, {
            scope: "recovery",
            input: {
              kind: "repair_completion",
              recoveryId: requestedRecoveryId,
            },
          });
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
            let history = readState(historyRepositoryInput(rootCapability), {
              scope: "recovery",
              input: {
                kind: "repair_history",
                recoveryId: requestedRecoveryId,
              },
            });
            historyLockReleased = history.lockReleased;
            if (!history.lockReleased || !currentOwner()) return stopped();
            if (history.status !== "completed") {
              // 技術fallbackではなく、既存の有限metadata出版だけを一度試す。
              statePublication = resumeRepairRecordSave(
                historyRepositoryInput(rootCapability),
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
              history = readState(historyRepositoryInput(rootCapability), {
                scope: "recovery",
                input: {
                  kind: "repair_history",
                  recoveryId: requestedRecoveryId,
                },
              });
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
              const recorded = target as RepairOperationRecord | null;
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
          statePublication = resumeRepairRecordSave(
            historyRepositoryInput(rootCapability),
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
      const read = readState(rootCapability, {
        scope: "recovery",
        input: { kind: "history" },
      });
      if (
        read.status !== "completed" ||
        !read.lockReleased ||
        !read.value ||
        !currentOwner()
      )
        return stopped();
      version = {
        revision: read.value.snapshot.revision,
        payloadSha256: read.value.payloadSha256,
      };
      const repairs = read.value.snapshot.operations.filter(
        (item): item is RepairOperationRecord => item.kind === "runtime_repair",
      );
      if (requestedRecoveryId !== null) {
        target =
          repairs.find((item) => item.recoveryId === requestedRecoveryId) ??
          null;
        disposalSettled =
          read.value.operationStates.find(
            (state): state is RepairOperationState =>
              state.kind === "runtime_repair" && state.operation === target,
          )?.disposalSettled === true;
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
            const targets = inspectResources(
              {
                kind: "docker_runtime_directory",
                input: {
                  operationNonce: identity.operationNonce,
                  checkpoint: target.checkpoint,
                  signal,
                  canObserve: currentOwner,
                },
              },
              getIsolationSettings(),
            );
            if (!targets || signal.aborted || !currentOwner()) return stopped();
            const decidedAt = new Date().toISOString();
            const reviewAfter = new Date(
              Date.parse(decidedAt) + 604800000,
            ).toISOString();
            if (
              !save({
                kind: "retention_handoff",
                receipt: { decidedAt, reviewAfter, targets },
              })
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
          operationCleanupConfirmed = true;
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
          operationCleanupConfirmed =
            target.checkpoint?.cleanup === "confirmed";
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
            operationCleanupConfirmed =
              target.checkpoint?.cleanup === "confirmed";
            if (
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
              (item) => item !== target && item.phase !== "terminal",
            ) ||
            read.value.snapshot.unresolvedRecoveries.some(
              (item) => item.recoveryId === requestedRecoveryId,
            )
          )
            return stopped();
          // 記録の確定だけであり、新しいNative／Docker処置を開始しない。
          operationCleanupConfirmed = savedCheckpoint.cleanup === "confirmed";
          finalCheckpointConfirmed = true;
          if (
            !save({
              kind: "checkpoint",
              update: {
                phase: "settling",
                checkpoint: savedCheckpoint,
                disposition: target.disposition,
                primaryFailure: savedFailure,
                outcome: {
                  status: "blocked",
                  reason: savedFailure.reason,
                  cleanupConfirmed: operationCleanupConfirmed,
                },
              },
            })
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
            operationCleanupConfirmed,
            completionConfirmed,
            completionEffectIssued,
            completionLockReleased,
            statePublication,
            technicalStatus: null,
          });
        }
      } else if (repairs.some((item) => item.phase !== "terminal"))
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
          });
    const nonce =
      previousIdentity?.operationNonce ?? randomBytes(32).toString("hex");
    const operationId =
      previousIdentity?.operationId ??
      `OP-${BigInt(`0x${randomUUID().replaceAll("-", "")}`)
        .toString(10)
        .padStart(6, "0")}`;
    const result = await restartDockerEnvironment(
      {
        mode: "repair",
        input: {
          operationNonce: nonce,
          signal,
          resume: target?.checkpoint ?? null,
          canIssueEffect: () => !signal.aborted && currentOwner(),
          onPrepared: (value) => {
            preparedCalls++;
            if (preparedCalls !== 1 || !currentOwner() || signal.aborted)
              throw new Error("docker_repair_record_unconfirmed");
            if (target === null) {
              const identityJson = `${JSON.stringify({ schema: "crdd-coordinator/runtime-repair-identity/v2", kind: "runtime_repair", operationNonce: nonce, operationId, repositoryBinding: repository.repositoryBinding, consumer: "coordinator_cli" })}\n`;
              recoveryId = `docker-runtime-repair.${nonce}.${createHash("sha256").update(identityJson).digest("hex")}`;
              if (!save({ kind: "create", identityJson: identityJson }))
                throw new Error("docker_repair_record_unconfirmed");
            }
            if (!target) throw new Error("docker_repair_record_unconfirmed");
            if (target.checkpoint !== null) {
              if (!save({ kind: "session_begin", checkpoint: value }))
                throw new Error("docker_repair_record_unconfirmed");
            } else {
              prepared = true;
              if (!checkpoint(value)) {
                prepared = false;
                throw new Error("docker_repair_record_unconfirmed");
              }
            }
            prepared = true;
            return;
          },
          onCheckpoint: (value) => {
            if (!checkpoint(value))
              throw new Error("docker_repair_record_unconfirmed");
          },
        },
      },
      getIsolationSettings(),
    );
    operationCleanupConfirmed = result.lifecycle?.cleanupConfirmed === true;
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
      lifecycle?.cleanupConfirmed === true;
    const complete =
      technical?.status === "recovered" &&
      result.checkpoint.engine === "ready" &&
      result.checkpoint.hostSafety === "safe" &&
      result.checkpoint.stale !== "unknown" &&
      checkpointSettled;
    let outcome: RepairOperationRecord["outcome"] = null;
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
      !save({
        kind: "checkpoint",
        update: {
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
      })
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
      operationCleanupConfirmed,
      statePublication,
      technicalStatus: result.machine?.status ?? null,
    });
  } catch {
    return stopped();
  } finally {
    ownerAlive = false;
  }
}

/**
 * 修復Ownerの観測を公開可能な結果だけへ縮約する。
 * @responsibility CLIで行っていた固定field投影を共通操作へ移す。
 * @trace ARCH-000008
 * @input result: 既存修復Ownerの結果、expectedRecoveryId: exact再入場又は新規null。
 * @returns 状態・元参照・保存／回収／保持の確認値だけ。
 * @precondition 入力は同じProcessの既存Ownerが生成した値。
 * @postcondition 内部publication・marker・checkpointを含めない。
 * @effect N/A: 結果の縮約だけ。
 * @failure exact参照不一致は元参照だけを保持し、全確認値falseの固定拒否へ閉じる。
 * @invariant 別操作の成立を要求元の修復成功へ転用しない。
 * @boundary 内部修復結果と正式API／CLI。
 * @security Host Path・内部権限・保存本文を公開しない。
 * @concurrency 同期の値投影。
 */
export function projectRuntimeRepairObservation(
  result: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>,
  expectedRecoveryId: string | null,
) {
  if (expectedRecoveryId !== null && result.recoveryId !== expectedRecoveryId)
    return Object.freeze({
      status: "blocked" as const,
      reason: "runtime_repair_boundary_unavailable" as const,
      recoveryId: expectedRecoveryId,
      finalCheckpointConfirmed: false,
      outcomeConfirmed: false,
      retentionConfirmed: false,
      retentionReviewAfter: null,
      historyConfirmed: false,
      completionConfirmed: false,
      operationCleanupConfirmed: false,
    });
  return Object.freeze({
    status: result.status,
    reason: result.reason,
    recoveryId: result.recoveryId,
    finalCheckpointConfirmed: result.finalCheckpointConfirmed,
    outcomeConfirmed: result.outcomeConfirmed,
    retentionConfirmed: result.retentionConfirmed,
    retentionReviewAfter: result.retentionReviewAfter,
    historyConfirmed: result.historyConfirmed,
    completionConfirmed: result.completionConfirmed,
    operationCleanupConfirmed: result.operationCleanupConfirmed,
  });
}

/** 起動元の値を現在の候補として読み、既存Windows Path文法で確認する。 */
function readConfiguredLocalAppDataDirectory(): string | null {
  const directory = process.env.LOCALAPPDATA;
  return isSupportedWindowsAbsolutePathCandidate(directory) &&
    path.win32.normalize(directory) === directory
    ? directory
    : null;
}

/** 起動元が指定したLocal AppDataから既存の固定Runtime保存先を組み立てる。OSの独立証明ではない。 */
export function runtimeStateDirectoryCandidate() {
  const localAppData = readConfiguredLocalAppDataDirectory();
  if (localAppData === null) return null;
  const rootPath = path.win32.join(
    localAppData,
    "Qual-Lab",
    "CRDD",
    "RuntimeState",
  );
  return isSupportedWindowsAbsolutePathCandidate(rootPath) ? rootPath : null;
}

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT =
  "crdd-coordinator/provider-home-windows-adapter";

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION = 10;

/** 上位の既存設定から共有Homeの親所在を求める。作成・権限付与はしない。 */
export function providerHomesDirectoryCandidate(): string | null {
  const localAppData = readConfiguredLocalAppDataDirectory();
  if (localAppData === null) return null;
  return path.win32.join(localAppData, ...PROVIDER_HOME_ROOT_SEGMENTS);
}

/** 同じ設定の共有Home候補。実体・保護の確認は既存の観測Ownerが行う。 */
function runtimeOwnedProviderHomeMountSourceCandidate(provider: unknown) {
  if (provider !== "codex" && provider !== "claude") return null;
  const root = providerHomesDirectoryCandidate();
  const source = root ? path.win32.join(root, provider) : null;
  return source && !source.includes(",") ? source : null;
}

/**
 * provider-home-windows-adapterを停止結果として構築する。
 *
 * @responsibility provider-home-windows-adapterの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000010
 * @input reason: Node読取り観測の停止理由。
 * @returns blockedの計算結果を返す。
 * @precondition 子Process・Filesystem変更を行わない観測からだけ呼ぶ。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Node読取り観測の拒否分類と受付結果。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function providerHomeWindowsAdapterBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    providerHomeIdentityHash: null,
    stableLogicalHomeBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    providerHome: null,
    manualRecoveryRequired: false,
  });
}

/**
 * Runtime 所有 Windows Provider Home 候補を観測する。
 *
 * @responsibility Runtime 所有 Windows Provider Home 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input provider: codexまたはclaude。所在は上位設定から選定する。
 * @returns inspectRuntimeOwnedWindowsProviderHomeCandidateの計算結果を返す。
 * @precondition Windowsローカル単一ユーザー運用。Home基点は上位設定済みで新旧方式を並走しない。
 * @postcondition inspectRuntimeOwnedWindowsProviderHomeCandidateの責務を完了した結果だけを返す。
 * @effect NodeのDirectory・実体読取りのみ。許可tokenや子Processは生成しない。
 * @failure 不明実体・Link・Path差・旧Lock・観測例外は候補を発行せず停止する。
 * @invariant inspectRuntimeOwnedWindowsProviderHomeCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary 上位確定HomeとNode Filesystem。SID・Token・厳密DACLの独立検証は行わない。
 * @security inspectRuntimeOwnedWindowsProviderHomeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsProviderHomeCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedWindowsProviderHomeCandidate(
  provider: unknown,
) {
  if (
    process.platform !== "win32" ||
    (provider !== "codex" && provider !== "claude")
  )
    return providerHomeWindowsAdapterBlocked(
      "provider_home_node_input_invalid",
    );
  const source = runtimeOwnedProviderHomeMountSourceCandidate(provider);
  if (!source)
    return providerHomeWindowsAdapterBlocked(
      "provider_home_location_unavailable",
    );
  try {
    const read = () => {
      const stat = fs.lstatSync(source, { bigint: true });
      const canonical = fs.realpathSync.native(source);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.dev <= 0n ||
        stat.ino <= 0n ||
        stat.birthtimeNs <= 0n ||
        path.win32.normalize(canonical).toLocaleLowerCase("en-US") !==
          source.toLocaleLowerCase("en-US")
      )
        throw new Error("provider_home_identity_unknown");
      return stat;
    };
    const first = read();
    const canonical = fs.realpathSync.native(source);
    const parent = path.win32.dirname(canonical);
    const binding = (kind: string) =>
      createHash("sha256")
        .update("crdd-provider-home-resource-v2\0")
        .update(kind)
        .update("\0")
        .update(path.win32.join(parent, kind).toLocaleLowerCase("en-US"))
        .digest("hex");
    const knownLocks = new Set(
      ["codex", "claude"].map(
        (kind) => `executor.provider-home.${binding(kind)}.lock`,
      ),
    );
    if (
      fs
        .readdirSync(parent)
        .some(
          (name) =>
            name.toLowerCase().startsWith("executor.provider-home.") &&
            !knownLocks.has(name.toLowerCase()),
        )
    )
      return providerHomeWindowsAdapterBlocked(
        "provider_home_prior_lock_unresolved",
      );
    const second = read();
    if (
      first.dev !== second.dev ||
      first.ino !== second.ino ||
      first.birthtimeNs !== second.birthtimeNs
    )
      return providerHomeWindowsAdapterBlocked(
        "provider_home_identity_changed",
      );
    const observation = Object.freeze({
      provider,
      providerHomeIdentityHash: createHash("sha256")
        .update("crdd-provider-home-node-identity-v1\0")
        .update(provider)
        .update("\0")
        .update(String(first.dev))
        .update("\0")
        .update(String(first.ino))
        .update("\0")
        .update(String(first.birthtimeNs))
        .digest("hex"),
      stableLogicalHomeBindingHash: binding(provider),
      stableIdentityObserved: true,
      pathReported: false,
      principalReported: false,
      aclReported: false,
      credentialContentRead: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
    });
    return Object.freeze({
      ...observation,
      status: "candidate" as const,
      reason: "runtime_owned_node_provider_home_observed_candidate",
      executionSourceKind: "node_filesystem",
      processEffectIssued: false,
      manualRecoveryRequired: false,
      providerHome: Object.freeze({
        provider,
        providerHomeSourcePath: canonical,
        providerHomeIdentityHash: observation.providerHomeIdentityHash,
        stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
      }),
    });
  } catch {
    return providerHomeWindowsAdapterBlocked(
      "provider_home_node_observation_unavailable",
    );
  }
}

/**
 * Provider Home Windows Adapter 契約の公開契約を記述する。
 *
 * @responsibility Provider Home Windows Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeWindowsAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeWindowsAdapterContractの入力契約を満たす。
 * @postcondition describeProviderHomeWindowsAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeWindowsAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeWindowsAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeWindowsAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeProviderHomeWindowsAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeWindowsAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeWindowsAdapterContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT,
    contractRevision: PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION,
    platform: "windows",
    providers: Object.freeze(["codex", "claude"]),
    locationSource: "upper_configuration",
    observation: "node_lstat_realpath_and_physical_identity_twice",
    nativePolicyVerification: false,
    osPrincipalVerification: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}

export const PROVIDER_HOME_CONTRACT = "crdd-coordinator/provider-home";

export const PROVIDER_HOME_CONTRACT_REVISION = 8;

export const PROVIDER_HOME_ROOT_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "ProviderHomes",
]);

const providerHomePROVIDERS = Object.freeze(["codex", "claude"] as const);

const providerDirectoryNames = Object.freeze({
  codex: getAuthenticationDefinition("codex").homeDirectoryName,
  claude: getAuthenticationDefinition("claude").homeDirectoryName,
});

/**
 * Provider Home 契約の公開契約を記述する。
 *
 * @responsibility Provider Home 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeContractの入力契約を満たす。
 * @postcondition describeProviderHomeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderHomeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderHomeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeContract() {
  const windowsAdapter = describeProviderHomeWindowsAdapterContract();
  return Object.freeze({
    contract: PROVIDER_HOME_CONTRACT,
    contractRevision: PROVIDER_HOME_CONTRACT_REVISION,
    platform: "windows_local_user_target_only",
    providers: providerHomePROVIDERS,
    requiredEffectRootSource: "upper_configured_provider_home_parent",
    rootSegments: PROVIDER_HOME_ROOT_SEGMENTS,
    providerDirectoryNames: providerDirectoryNames,
    scope: "canonical_provider_home_resource",
    persistentAcrossOperations: true,
    sharedAcrossRepositoriesForSameHome: true,
    hostDefaultHomeImportAllowed: false,
    hostCredentialImportAllowed: false,
    operationTemporaryHomeImportAllowed: false,
    otherProviderHomeSharingAllowed: false,
    operationCleanupOwned: false,
    symbolicLinkOrNoncanonicalPathAllowed: false,
    stableRootIdentityRequired: true,
    selectedLocalUserBindingRequired: false,
    ownerAndDaclVerificationRequired: false,
    osPermissions: "operator_precondition",
    providerRefreshWriteTarget: "provider_specific_home_only",
    tokenSessionOrPathReported: false,
    bootstrapEntry: "explicit_login_only_target",
    protectionEffect: "not_implemented",
    protectionObservation:
      "node_physical_directory_observation_no_acl_verification",
    selectedLocalUserBinder: "not_performed",
    windowsAdapter,
    authSessionProbe: "not_implemented",
    logoutRevocationAndDeletion: "not_implemented_separate_bootstrap_lifecycle",
    callerPathConfersAuthority: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}

export const AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES = 4_096;

const WINDOWS_RESERVED_BASENAME =
  /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])$/u;

const RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS = Object.freeze([
  Object.freeze(["ß", "SS"] as const),
  Object.freeze(["ı", "I"] as const),
  Object.freeze(["ſ", "S"] as const),
  Object.freeze(["K", "K"] as const),
  Object.freeze(["ﬀ", "FF"] as const),
  Object.freeze(["ﬁ", "FI"] as const),
  Object.freeze(["ﬂ", "FL"] as const),
  Object.freeze(["ﬃ", "FFI"] as const),
  Object.freeze(["ﬄ", "FFL"] as const),
  Object.freeze(["ﬅ", "ST"] as const),
  Object.freeze(["ﬆ", "ST"] as const),
]);

const reservedNameSpecialUppercaseMapping = new Map<string, string>(
  RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS,
);

/**
 * reserved Name Limited Uppercaseを決定する。
 *
 * @responsibility reserved Name Limited Uppercaseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns reservedNameLimitedUppercaseの計算結果を返す。
 * @precondition 「value: string」がreservedNameLimitedUppercaseの入力契約を満たす。
 * @postcondition reservedNameLimitedUppercaseの責務を完了した結果だけを返す。
 * @effect N/A: reservedNameLimitedUppercaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reservedNameLimitedUppercaseは独自の失敗分岐を所有しない。
 * @invariant reservedNameLimitedUppercaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reservedNameLimitedUppercaseはProcess内の同一Subsystemで完結する。
 * @security reservedNameLimitedUppercaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reservedNameLimitedUppercaseは共有非同期状態を持たない同期処理である。
 */
function reservedNameLimitedUppercase(value: string) {
  let normalized = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0x61 && codePoint <= 0x7a) {
      normalized += String.fromCodePoint(codePoint - 0x20);
      continue;
    }
    normalized +=
      reservedNameSpecialUppercaseMapping.get(character) ?? character;
  }
  return normalized;
}

/**
 * Supported Common Path Bytesが存在するかを判定する。
 *
 * @responsibility Supported Common Path Bytesの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がhasSupportedCommonPathBytesの入力契約を満たす。
 * @postcondition hasSupportedCommonPathBytesの責務を完了した結果だけを返す。
 * @effect N/A: hasSupportedCommonPathBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasSupportedCommonPathBytesは独自の失敗分岐を所有しない。
 * @invariant hasSupportedCommonPathBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasSupportedCommonPathBytesはProcess内の同一Subsystemで完結する。
 * @security hasSupportedCommonPathBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasSupportedCommonPathBytesは共有非同期状態を持たない同期処理である。
 */
function hasSupportedCommonPathBytes(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\uD800-\uDFFF]/u.test(value) &&
    Buffer.byteLength(value, "utf8") <=
      AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Supported Windows Absolute Path 候補かを判定する。
 *
 * @responsibility Supported Windows Absolute Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedWindowsAbsolutePathCandidateの入力契約を満たす。
 * @postcondition isSupportedWindowsAbsolutePathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedWindowsAbsolutePathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedWindowsAbsolutePathCandidateは独自の失敗分岐を所有しない。
 * @invariant isSupportedWindowsAbsolutePathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedWindowsAbsolutePathCandidateはProcess内の同一Subsystemで完結する。
 * @security isSupportedWindowsAbsolutePathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedWindowsAbsolutePathCandidateは共有非同期状態を持たない同期処理である。
 */
export function isSupportedWindowsAbsolutePathCandidate(
  value: unknown,
): value is string {
  if (
    !hasSupportedCommonPathBytes(value) ||
    !/^[A-Z]:\\/u.test(value) ||
    value.includes("/") ||
    path.win32.normalize(value) !== value
  )
    return false;
  const root = path.win32.parse(value).root;
  if (value === root) return true;
  if (value.endsWith("\\")) return false;
  const segments = value.slice(root.length).split("\\");
  return segments.every((segment) => {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      /[<>:"|?*]/u.test(segment) ||
      /[. ]$/u.test(segment)
    )
      return false;
    const basenameCandidate = segment.split(".", 1)[0];
    if (basenameCandidate === undefined) return false;
    const basename = reservedNameLimitedUppercase(
      basenameCandidate.replace(/[. ]+$/u, ""),
    );
    return !WINDOWS_RESERVED_BASENAME.test(basename);
  });
}

/**
 * Supported Posix Absolute Path 候補かを判定する。
 *
 * @responsibility Supported Posix Absolute Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedPosixAbsolutePathCandidateの入力契約を満たす。
 * @postcondition isSupportedPosixAbsolutePathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedPosixAbsolutePathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedPosixAbsolutePathCandidateは独自の失敗分岐を所有しない。
 * @invariant isSupportedPosixAbsolutePathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedPosixAbsolutePathCandidateはProcess内の同一Subsystemで完結する。
 * @security isSupportedPosixAbsolutePathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedPosixAbsolutePathCandidateは共有非同期状態を持たない同期処理である。
 */
export function isSupportedPosixAbsolutePathCandidate(
  value: unknown,
): value is string {
  return (
    hasSupportedCommonPathBytes(value) &&
    path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value &&
    (value === "/" || !value.endsWith("/"))
  );
}

/**
 * 現在実装した公開操作とCLI相当だけを返す。
 * @responsibility 能力の表示と今回の操作許可を区別する。
 * @trace ARCH-000004
 * @input N/A: 外部入力を受けない。
 * @returns 自身を除く完成操作とCLI呼出し例の不変集合。要求・結果の補助受付は含めない。
 * @precondition 固定候補で全操作の接続を検証する。
 * @postcondition 未接続のinspect・候補CLIを一覧へ含めない。
 * @effect N/A: 固定記述の生成のみ。
 * @failure N/A: 観測やI/Oを行わない。
 * @invariant 一覧表示からAuthorityを発行しない。
 * @boundary 正式APIと利用者向け能力表示。
 * @security 秘密・Root・認証状態を含めない。
 * @concurrency 不変の局所値。
 */
export function getCapabilities() {
  return Object.freeze({
    contract: "crdd-coordinator/capabilities",
    contractRevision: 11,
    profile: "local_personal",
    commands: Object.freeze(
      [
        "run task --request-stdin --json --principal-id <local.email.address>",
        "run objective --request-stdin --json --principal-id <local.email.address>",
        "run advice --request-stdin --json --principal-id <local.email.address>",
        "doctor [--isolation] [--json]",
        "recovery resume <id> [--restart-docker] [--json]",
        "recovery inspect <id> [--json]",
        "maintenance repair [--retain <id>] [--json]",
        "auth status codex|claude [--json]",
        "auth login codex|claude",
        "capabilities --json",
      ].map((invocation) =>
        Object.freeze({
          command: invocation
            .split(" ")
            .slice(0, /^(capabilities|doctor) /u.test(invocation) ? 1 : 2)
            .join(" "),
          availability: "available",
          invocation,
        }),
      ),
    ),
    operations: Object.freeze([
      "runObjective",
      "runTask",
      "openTaskSession",
      "submitDecision",
      "acceptResult",
      "executeWorkspace",
      "queryState",
      "queryActivity",
      "readRepositoryNetworkHosts",
      "diagnoseEnvironment",
      "recoverExecution",
      "readRecovery",
      "restartDockerForRecovery",
      "repairDockerRuntime",
      "retainRepair",
      "getAuthenticationStatus",
      "authenticateProvider",
    ]),
    executionAuthorityIssued: false,
  });
}
export const CHECK_STATUS = Object.freeze([
  "confirmed",
  "blocked",
  "not_implemented",
  "unknown",
] as const);

/**
 * doctorで使用するDoctor Operation Initialization 失敗の値契約を定義する。
 *
 * @responsibility Doctor Operation Initialization 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DoctorOperationInitializationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DoctorOperationInitializationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: DoctorOperationInitializationFailureの宣言は外部境界を開かない。
 * @security N/A: DoctorOperationInitializationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DoctorOperationInitializationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DoctorOperationInitializationFailure = Readonly<{
  reason: "doctor_operation_initialization_cleanup_unknown";
  manualRecoveryRequired: true;
  hostRecoveryId: string | null;
}>;

const doctorOperationInitializationFailures = new WeakMap<
  object,
  DoctorOperationInitializationFailure
>();

/**
 * Doctor Operation Initialization 失敗を分類する。
 *
 * @responsibility Doctor Operation Initialization 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns classifyDoctorOperationInitializationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyDoctorOperationInitializationFailureの入力契約を満たす。
 * @postcondition classifyDoctorOperationInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyDoctorOperationInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyDoctorOperationInitializationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyDoctorOperationInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyDoctorOperationInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: classifyDoctorOperationInitializationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: classifyDoctorOperationInitializationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyDoctorOperationInitializationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (doctorOperationInitializationFailures.get(error) ?? null)
    : null;
}

/**
 * throw Doctor Operation Initialization 失敗を決定する。
 *
 * @responsibility throw Doctor Operation Initialization 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input cause: unknown、hostRecoveryId: string | null
 * @returns neverを返す。
 * @precondition 「cause: unknown、hostRecoveryId: string | null」がthrowDoctorOperationInitializationFailureの入力契約を満たす。
 * @postcondition throwDoctorOperationInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwDoctorOperationInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwDoctorOperationInitializationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwDoctorOperationInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwDoctorOperationInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: throwDoctorOperationInitializationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: throwDoctorOperationInitializationFailureは共有非同期状態を持たない同期処理である。
 */
function throwDoctorOperationInitializationFailure(
  cause: unknown,
  hostRecoveryId: string | null,
): never {
  const error = new Error("doctor_operation_initialization_cleanup_unknown", {
    cause,
  });
  doctorOperationInitializationFailures.set(
    error,
    Object.freeze({
      reason: "doctor_operation_initialization_cleanup_unknown",
      manualRecoveryRequired: true,
      hostRecoveryId,
    }),
  );
  throw error;
}

/**
 * Doctor Operation Creation 失敗を公開結果へ投影する。
 *
 * @responsibility Doctor Operation Creation 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns neverを返す。
 * @precondition 「error: unknown」がprojectDoctorOperationCreationFailureの入力契約を満たす。
 * @postcondition projectDoctorOperationCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectDoctorOperationCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectDoctorOperationCreationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectDoctorOperationCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDoctorOperationCreationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: projectDoctorOperationCreationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectDoctorOperationCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function projectDoctorOperationCreationFailure(error: unknown): never {
  const creation = classifyOwnedCoordinatorOperationCreationFailure(error);
  if (creation && !creation.cleanupConfirmed)
    throwDoctorOperationInitializationFailure(error, creation.hostRecoveryId);
  throw error;
}

/**
 * doctorで使用するCheck Statusの値契約を定義する。
 *
 * @responsibility Check StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CheckStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckStatusの宣言は外部境界を開かない。
 * @security N/A: CheckStatusはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CheckStatus = "confirmed" | "blocked" | "not_implemented" | "unknown";

/**
 * doctorで使用するDiagnostic Checkの値契約を定義する。
 *
 * @responsibility Diagnostic CheckのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DiagnosticCheckが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiagnosticCheckで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiagnosticCheckの宣言は外部境界を開かない。
 * @security N/A: DiagnosticCheckはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DiagnosticCheckの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DiagnosticCheck = {
  id: string;
  status: CheckStatus;
  reason: string | null;
  followUp: string | null;
};

/**
 * doctorで使用するDiscovery 結果の値契約を定義する。
 *
 * @responsibility Discovery 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DiscoveryResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiscoveryResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiscoveryResultの宣言は外部境界を開かない。
 * @security N/A: DiscoveryResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DiscoveryResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DiscoveryResult = Readonly<{
  located: boolean;
  candidateCount: number;
  formats: readonly string[];
  reason: string | null;
}>;

/**
 * doctorで使用するDoctor Optionsの値契約を定義する。
 *
 * @responsibility Doctor OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DoctorOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DoctorOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DoctorOptionsの宣言は外部境界を開かない。
 * @security N/A: DoctorOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DoctorOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DoctorOptions = Readonly<{
  activeIsolation: boolean;
  cwd: string;
}>;

/**
 * doctorで使用するDiscovery Optionsの値契約を定義する。
 *
 * @responsibility Discovery OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DiscoveryOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiscoveryOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiscoveryOptionsの宣言は外部境界を開かない。
 * @security N/A: DiscoveryOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DiscoveryOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DiscoveryOptions = Readonly<{
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  fileSystem?: typeof fs;
}>;

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security N/A: isObjectはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security N/A: ownValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: errorCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  if (!isObject(error)) return null;
  const value = ownValue(error, "code");
  return typeof value === "string" ? value : null;
}

/**
 * doctorを検査する。
 *
 * @responsibility doctorの検査条件、違反分類、検査結果境界を所有する。
 * @trace ARCH-000004
 * @input id: string、status: CheckStatus、reason: string | null、followUp: string | null
 * @returns DiagnosticCheckを返す。
 * @precondition 「id: string、status: CheckStatus、reason: string | null、followUp: string | null」がcheckの入力契約を満たす。
 * @postcondition checkの責務を完了した結果だけを返す。
 * @effect N/A: checkは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: checkは独自の失敗分岐を所有しない。
 * @invariant checkは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: checkはProcess内の同一Subsystemで完結する。
 * @security N/A: checkはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: checkは共有非同期状態を持たない同期処理である。
 */
function check(
  id: string,
  status: CheckStatus,
  reason: string | null,
  followUp: string | null = null,
): DiagnosticCheck {
  return { id, status, reason, followUp };
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security N/A: errorMessageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export const REQUIRED_CHECK_IDS = Object.freeze([
  "runtime.node",
  "repository.git",
  "repository.identity",
  "operation.directories",
  "execution.filesystem",
  "execution.credential_isolation",
  "execution.egress",
  "provider.codex.discovery",
  "provider.codex.authentication",
  "provider.codex.active_probe",
  "provider.codex.auto_update",
  "provider.codex.telemetry",
  "provider.codex.session_resume",
  "provider.codex.timeout",
  "provider.codex.cancel",
  "provider.codex.process_tree_termination",
  "provider.claude.discovery",
  "provider.claude.authentication",
  "provider.claude.active_probe",
  "provider.claude.auto_update",
  "provider.claude.telemetry",
  "provider.claude.session_resume",
  "provider.claude.timeout",
  "provider.claude.cancel",
  "provider.claude.process_tree_termination",
]);

/**
 * Readinessを評価する。
 *
 * @responsibility Readinessの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input checks: unknown
 * @returns evaluateReadinessの計算結果を返す。
 * @precondition 「checks: unknown」がevaluateReadinessの入力契約を満たす。
 * @postcondition evaluateReadinessの責務を完了した結果だけを返す。
 * @effect N/A: evaluateReadinessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateReadinessは独自の失敗分岐を所有しない。
 * @invariant evaluateReadinessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateReadinessはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateReadinessはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateReadinessは共有非同期状態を持たない同期処理である。
 */
export function evaluateReadiness(checks: unknown) {
  const expected = new Set(REQUIRED_CHECK_IDS);
  const seen = new Set<string>();
  const blockers: Array<{ id: string | null; reason: string }> = [];
  const checkSnapshot = snapshotPlainArray<unknown>(
    checks,
    REQUIRED_CHECK_IDS.length + 1,
  );
  const entries = checkSnapshot.status === "ok" ? checkSnapshot.value : [];

  for (const item of entries) {
    if (item === null || typeof item !== "object") {
      blockers.push({ id: null, reason: "unknown_check" });
      continue;
    }
    const id = Reflect.get(item, "id");
    const status = Reflect.get(item, "status");
    const reason = Reflect.get(item, "reason");
    if (typeof id !== "string" || !expected.has(id)) {
      blockers.push({
        id: typeof id === "string" ? id : null,
        reason: "unknown_check",
      });
      continue;
    }
    if (seen.has(id)) {
      blockers.push({ id, reason: "duplicate_check" });
      continue;
    }
    seen.add(id);
    if (
      typeof status !== "string" ||
      !CHECK_STATUS.some((candidate) => candidate === status)
    ) {
      blockers.push({ id, reason: "invalid_status" });
      continue;
    }
    if (status !== "confirmed") {
      blockers.push({
        id,
        reason: typeof reason === "string" ? reason : status,
      });
    }
  }

  for (const id of REQUIRED_CHECK_IDS) {
    if (!seen.has(id)) blockers.push({ id, reason: "missing_check" });
  }

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}

/**
 * path Valueを決定する。
 *
 * @responsibility path Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input environment: NodeJS.ProcessEnv
 * @returns stringを返す。
 * @precondition 「environment: NodeJS.ProcessEnv」がpathValueの入力契約を満たす。
 * @postcondition pathValueの責務を完了した結果だけを返す。
 * @effect N/A: pathValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathValueは独自の失敗分岐を所有しない。
 * @invariant pathValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathValueはProcess内の同一Subsystemで完結する。
 * @security N/A: pathValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathValueは共有非同期状態を持たない同期処理である。
 */
function pathValue(environment: NodeJS.ProcessEnv): string {
  return environment.PATH ?? environment.Path ?? "";
}

/**
 * candidate Extensionsを決定する。
 *
 * @responsibility candidate Extensionsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input platform: NodeJS.Platform、environment: NodeJS.ProcessEnv
 * @returns string[]を返す。
 * @precondition 「platform: NodeJS.Platform、environment: NodeJS.ProcessEnv」がcandidateExtensionsの入力契約を満たす。
 * @postcondition candidateExtensionsの責務を完了した結果だけを返す。
 * @effect N/A: candidateExtensionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: candidateExtensionsは独自の失敗分岐を所有しない。
 * @invariant candidateExtensionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: candidateExtensionsはProcess内の同一Subsystemで完結する。
 * @security N/A: candidateExtensionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: candidateExtensionsは共有非同期状態を持たない同期処理である。
 */
function candidateExtensions(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): string[] {
  if (platform !== "win32") return [""];
  const configured = environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  return configured
    .split(";")
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

/**
 * command Formatを決定する。
 *
 * @responsibility command Formatの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns stringを返す。
 * @precondition 「candidate: string」がcommandFormatの入力契約を満たす。
 * @postcondition commandFormatの責務を完了した結果だけを返す。
 * @effect N/A: commandFormatは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: commandFormatは独自の失敗分岐を所有しない。
 * @invariant commandFormatは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: commandFormatはProcess内の同一Subsystemで完結する。
 * @security N/A: commandFormatはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: commandFormatは共有非同期状態を持たない同期処理である。
 */
function commandFormat(candidate: string): string {
  const extension = path.extname(candidate).toLowerCase().replace(/^\./u, "");
  return extension || "native";
}

/**
 * Commandを探索する。
 *
 * @responsibility Commandの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000004
 * @input command: string、options: DiscoveryOptions
 * @returns DiscoveryResultを返す。
 * @precondition 「command: string、options: DiscoveryOptions」がdiscoverCommandの入力契約を満たす。
 * @postcondition discoverCommandの責務を完了した結果だけを返す。
 * @effect discoverCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure discoverCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: discoverCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: discoverCommandは共有非同期状態を持たない同期処理である。
 */
export function discoverCommand(
  command: string,
  options: DiscoveryOptions = {},
): DiscoveryResult {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const fileSystem = options.fileSystem ?? fs;
  const candidates = [];

  for (const directory of pathValue(environment)
    .split(path.delimiter)
    .filter(Boolean)) {
    for (const extension of candidateExtensions(platform, environment)) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        const metadata = fileSystem.lstatSync(candidate);
        if (!metadata.isFile() || metadata.isSymbolicLink()) continue;
        if (platform !== "win32" && (metadata.mode & 0o111) === 0) continue;
        candidates.push({ format: commandFormat(candidate) });
      } catch (error) {
        if (errorCode(error) !== "ENOENT" && errorCode(error) !== "ENOTDIR") {
          return {
            located: false,
            candidateCount: 0,
            formats: [],
            reason: "discovery_failed",
          };
        }
      }
    }
  }

  return {
    located: candidates.length > 0,
    candidateCount: candidates.length,
    formats: [
      ...new Set(candidates.map((candidate) => candidate.format)),
    ].sort(),
    reason: candidates.length > 0 ? null : "command_not_found",
  };
}

/**
 * probe Git Repositoryを決定する。
 *
 * @responsibility probe Git Repositoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input cwd: string
 * @returns probeGitRepositoryの計算結果を返す。
 * @precondition 「cwd: string」がprobeGitRepositoryの入力契約を満たす。
 * @postcondition probeGitRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: probeGitRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: probeGitRepositoryは独自の失敗分岐を所有しない。
 * @invariant probeGitRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: probeGitRepositoryはProcess内の同一Subsystemで完結する。
 * @security N/A: probeGitRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: probeGitRepositoryは共有非同期状態を持たない同期処理である。
 */
function probeGitRepository(cwd: string) {
  const identity = readRepositorySnapshot(getRepository(cwd).capability);

  return {
    gitAvailable: identity?.status === "observed",
    identityAvailable: identity?.status === "observed",
    headCommit: identity?.revisionIdentity ?? null,
    headTree: identity?.snapshotIdentity ?? null,
    workingState: "not_observed",
    externalGitCliUsed: false,
  };
}

/**
 * provider Checksを決定する。
 *
 * @responsibility provider Checksの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input name: string、discovery: DiscoveryResult
 * @returns DiagnosticCheck[]を返す。
 * @precondition 「name: string、discovery: DiscoveryResult」がproviderChecksの入力契約を満たす。
 * @postcondition providerChecksの責務を完了した結果だけを返す。
 * @effect N/A: providerChecksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerChecksは独自の失敗分岐を所有しない。
 * @invariant providerChecksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: providerChecksはProcess内の同一Subsystemで完結する。
 * @security N/A: providerChecksはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: providerChecksは共有非同期状態を持たない同期処理である。
 */
function providerChecks(
  name: string,
  discovery: DiscoveryResult,
): DiagnosticCheck[] {
  return [
    check(
      `provider.${name}.discovery`,
      discovery.located ? "confirmed" : "blocked",
      discovery.reason,
      discovery.located ? null : "install_or_select_provider_outside_runtime",
    ),
    check(
      `provider.${name}.authentication`,
      "unknown",
      "subscription_oauth_explicit_login_not_evaluated",
    ),
    check(
      `provider.${name}.active_probe`,
      "not_implemented",
      "provider_egress_auth_and_fixed_image_binding_required_before_spawn",
    ),
    check(
      `provider.${name}.auto_update`,
      "not_implemented",
      "provider_fixed_image_and_auto_update_enforcement_not_implemented",
    ),
    check(
      `provider.${name}.telemetry`,
      "not_implemented",
      "provider_telemetry_policy_not_implemented",
    ),
    check(
      `provider.${name}.session_resume`,
      "not_implemented",
      "provider_session_resume_prohibited_but_not_enforced",
    ),
    check(
      `provider.${name}.timeout`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
    check(
      `provider.${name}.cancel`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
    check(
      `provider.${name}.process_tree_termination`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
  ];
}

/**
 * reportable Filesystem Policyを決定する。
 *
 * @responsibility reportable Filesystem Policyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input policy: ReturnType<typeof describeFilesystemPolicy>、root: string
 * @returns reportableFilesystemPolicyの計算結果を返す。
 * @precondition 「policy: ReturnType<typeof describeFilesystemPolicy>、root: string」がreportableFilesystemPolicyの入力契約を満たす。
 * @postcondition reportableFilesystemPolicyの責務を完了した結果だけを返す。
 * @effect N/A: reportableFilesystemPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reportableFilesystemPolicyは独自の失敗分岐を所有しない。
 * @invariant reportableFilesystemPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reportableFilesystemPolicyはProcess内の同一Subsystemで完結する。
 * @security N/A: reportableFilesystemPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: reportableFilesystemPolicyは共有非同期状態を持たない同期処理である。
 */
function reportableFilesystemPolicy(
  policy: ReturnType<typeof describeFilesystemPolicy>,
  root: string,
) {
  const relative = (value: string) =>
    path.relative(root, value).replaceAll("\\", "/");
  return {
    coordinatorRuntime: {
      write: policy.coordinatorRuntime.write.map(relative),
    },
    repositoryAdapter: { write: policy.repositoryAdapter.write.map(relative) },
    providerProcess: {
      write: policy.providerProcess.write.map(relative),
      deny: policy.providerProcess.deny.map(relative),
    },
    credentialBroker: policy.credentialBroker,
  };
}

const DOCTOR_OPTION_KEYS = new Set(["activeIsolation", "cwd"]);

/**
 * Doctor Optionsを固定Schemaへ正規化する。
 *
 * @responsibility Doctor Optionsの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawOptions: unknown
 * @returns DoctorOptionsを返す。
 * @precondition 「rawOptions: unknown」がnormalizeDoctorOptionsの入力契約を満たす。
 * @postcondition normalizeDoctorOptionsの責務を完了した結果だけを返す。
 * @effect normalizeDoctorOptionsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure normalizeDoctorOptionsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeDoctorOptionsは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: normalizeDoctorOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeDoctorOptionsは共有非同期状態を持たない同期処理である。
 */
function normalizeDoctorOptions(rawOptions: unknown): DoctorOptions {
  try {
    if (
      !rawOptions ||
      typeof rawOptions !== "object" ||
      types.isProxy(rawOptions) ||
      Array.isArray(rawOptions)
    ) {
      throw new Error("doctor_options_invalid");
    }
    const prototype = Object.getPrototypeOf(rawOptions);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("doctor_options_invalid");
    const descriptors = Object.getOwnPropertyDescriptors(rawOptions);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.some(
        (key) => typeof key !== "string" || !DOCTOR_OPTION_KEYS.has(key),
      )
    ) {
      throw new Error("doctor_options_invalid");
    }
    const value = (key: string, fallback: unknown): unknown => {
      const descriptor = descriptors[key];
      if (!descriptor) return fallback;
      if (
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        throw new Error("doctor_options_invalid");
      return descriptor.value;
    };
    const isIsolationActive = value("activeIsolation", false);
    const cwd = value("cwd", process.cwd());
    if (
      typeof isIsolationActive !== "boolean" ||
      typeof cwd !== "string" ||
      !path.isAbsolute(cwd) ||
      /[\u0000-\u001f\u007f]/u.test(cwd)
    ) {
      throw new Error("doctor_options_invalid");
    }
    return Object.freeze({
      activeIsolation: isIsolationActive,
      cwd,
    });
  } catch (error) {
    if (errorMessage(error) === "doctor_options_invalid") throw error;
    throw new Error("doctor_options_invalid");
  }
}

/**
 * Doctorを実行する。
 *
 * @responsibility Doctorの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input options: unknown
 * @returns runDoctorの計算結果を返す。
 * @precondition 「options: unknown」がrunDoctorの入力契約を満たす。
 * @postcondition runDoctorの責務を完了した結果だけを返す。
 * @effect runDoctorは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runDoctorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runDoctorは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security 秘密値はReportへ含めず、取得済みOperationの所有境界を維持する。診断成功から実Providerの成立を推定しない。
 * @concurrency 同じOperationの隔離試験・終了整理を待機してから結果を返す。
 */
export async function runDoctor(options: unknown = {}, signal?: AbortSignal) {
  const normalizedOptions = normalizeDoctorOptions(options);
  const isIsolationActive = normalizedOptions.activeIsolation;
  const cwd = normalizedOptions.cwd;
  const repositoryLocation = getRepositoryFromWorkingDirectory(cwd);
  let operation: ReturnType<
    typeof createRuntimeOwnedCoordinatorOperation
  > | null = null;
  if (isIsolationActive) {
    try {
      if (repositoryLocation.status !== "completed")
        throw Error("repository_identity_unavailable");
      const repository = repositoryLocation.capability;
      const root = resolveVerifiedRepositoryRoot(repository);
      if (!root) throw Error("repository_identity_unavailable");
      operation = createRuntimeOwnedCoordinatorOperation({
        root: repository,
        purpose: "isolation_probe",
        recordingCurrent: () =>
          resolveVerifiedRepositoryRoot(repository) === root,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      projectDoctorOperationCreationFailure(error);
    }
  }
  const operationDirectories = operation?.owned.directories ?? null;
  if (operation && !operationDirectories)
    throw new Error("owned_operation_directory_identity_required");
  const credentialNames = credentialEnvironmentNamesPresent(process.env);
  const repository = probeGitRepository(cwd);
  const providers = Object.freeze({
    codex: discoverCommand("codex"),
    claude: discoverCommand("claude"),
  });

  const isolation = operation
    ? await runDockerIsolationProbe(operation.owned, signal)
    : Object.freeze({
        status: "not_implemented",
        reason: "filesystem_boundary_not_enforced",
        hostCleanupCompleted: false,
        recoveryId: null,
        manualRecoveryRequired: false,
        fakeProviderLifecycle: Object.freeze({
          status: "not_evaluated",
          reason: "dynamic_fake_provider_not_requested",
          provenance: "repository_owned_docker_fake_provider",
          fakeProviderStartAttempted: false,
          fakeProviderExecuted: false,
          resultNormalizationVerified: false,
          containerAbsenceVerified: false,
          processTreeAbsenceVerified: false,
          hostCleanupVerified: false,
          elapsedMs: null,
          stdoutBytes: 0,
          stderrBytes: 0,
          exitCode: null,
          signal: null,
          timedOut: false,
          cancellationRequested: false,
          cancellationObservation: "not_implemented",
          diagnosticDockerContainerEffectIssued: false,
          diagnosticFilesystemEffectIssued: false,
          providerNetworkEffectIssued: false,
          runtimeAuthorityIssued: false,
          operationCapabilityIssued: false,
          realProviderReadiness: false,
        }),
      });
  const shouldRetainOperationDirectories =
    operation !== null && isolation.hostCleanupCompleted !== true;
  const isolationCheckStatus: CheckStatus =
    isolation.status === "confirmed"
      ? "confirmed"
      : isolation.status === "not_implemented"
        ? "not_implemented"
        : "blocked";
  const checks = [
    check(
      "runtime.node",
      isSupportedNodeRuntime(process.versions.node) ? "confirmed" : "blocked",
      isSupportedNodeRuntime(process.versions.node)
        ? null
        : "node_24_12_or_newer_required",
    ),
    check(
      "repository.git",
      repository.gitAvailable ? "confirmed" : "blocked",
      repository.gitAvailable ? null : "git_unavailable",
    ),
    check(
      "repository.identity",
      repository.identityAvailable ? "confirmed" : "blocked",
      repository.identityAvailable ? null : "repository_identity_unavailable",
    ),
    check(
      "operation.directories",
      operation ? "confirmed" : "not_implemented",
      operation
        ? "owned_operation_directories_created"
        : "owned_operation_directories_not_requested",
    ),
    check("execution.filesystem", isolationCheckStatus, isolation.reason),
    check(
      "execution.credential_isolation",
      isIsolationActive && isolation.status === "confirmed"
        ? "confirmed"
        : "not_implemented",
      isIsolationActive && isolation.status === "confirmed"
        ? "credential_paths_not_mounted_in_fake_probe"
        : "credential_store_isolation_not_enforced",
    ),
    check(
      "execution.egress",
      isIsolationActive && isolation.status === "confirmed"
        ? "blocked"
        : "not_implemented",
      isIsolationActive && isolation.status === "confirmed"
        ? "provider_endpoint_allowlist_not_configured"
        : "provider_egress_allowlist_not_enforced",
    ),
    ...providerChecks("codex", providers.codex),
    ...providerChecks("claude", providers.claude),
  ];
  const readiness = evaluateReadiness(checks);

  const report = {
    reportVersion: 17,
    diagnosticMode: isIsolationActive
      ? "docker_fake_provider_probe"
      : "passive_preflight",
    status: readiness.status,
    platform: process.platform,
    node: {
      version: process.version,
      supported: isSupportedNodeRuntime(process.versions.node),
    },
    repository,
    credentials: {
      detectedNames: credentialNames,
      valuesRecorded: false,
      isolationEnforcement:
        isIsolationActive && isolation.status === "confirmed"
          ? "confirmed_for_fake_probe"
          : "not_implemented",
    },
    filesystem: {
      policy:
        operation && operationDirectories
          ? reportableFilesystemPolicy(
              describeFilesystemPolicy(operationDirectories),
              operation.owned.root,
            )
          : null,
      enforcement: isolation.status,
      profile: isIsolationActive ? DOCKER_ISOLATION_PROFILE : null,
    },
    repositoryLocation: {
      status: repositoryLocation.status,
      contract: repositoryLocation.capability?.contract ?? null,
      pathReported: false,
    },
    providerLifecycle: describeProviderLifecycleContract(),
    fakeProviderLifecycle: isolation.fakeProviderLifecycle,
    egress: {
      providerAllowlist: "not_implemented",
      fakeProbeNetwork:
        isIsolationActive && isolation.status === "confirmed"
          ? "blocked"
          : "not_evaluated",
      proxyTopology: describeIsolationConfiguration("claude").proxy,
    },
    recovery: shouldRetainOperationDirectories
      ? {
          required: true,
          recoveryId: isolation.recoveryId ?? null,
          reason: isolation.reason,
          manualRecoveryRequired: isolation.manualRecoveryRequired === true,
        }
      : { required: false },
    providers,
    checks,
    blockers: readiness.blockers,
  };
  return report;
}

/**
 * docker-isolationで使用するDocker Probe 結果の値契約を定義する。
 *
 * @responsibility Docker Probe 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeResultの宣言は外部境界を開かない。
 * @security DockerProbeResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeResult = Readonly<{
  status: "confirmed" | "blocked" | "recovered";
  reason: string;
  probeId: string | null;
  retainOperationDirectories: boolean;
  hostCleanupCompleted: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  fakeProviderLifecycle: DynamicFakeProviderLifecycleObservation;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Lifecycle Observationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderLifecycleObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderLifecycleObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderLifecycleObservationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderLifecycleObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderLifecycleObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderLifecycleObservation = Readonly<{
  status: "verified" | "candidate" | "blocked" | "not_evaluated";
  reason: string;
  provenance:
    | "repository_owned_docker_fake_provider"
    | "untrusted_execution_fixture";
  fakeProviderStartAttempted: boolean;
  fakeProviderExecuted: boolean;
  resultNormalizationVerified: boolean;
  containerAbsenceVerified: boolean;
  processTreeAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  elapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancellationRequested: false;
  cancellationObservation: "not_implemented";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * dynamic Fake Lifecycle Blockedを決定する。
 *
 * @responsibility dynamic Fake Lifecycle Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「reason: string」がdynamicFakeLifecycleBlockedの入力契約を満たす。
 * @postcondition dynamicFakeLifecycleBlockedの責務を完了した結果だけを返す。
 * @effect N/A: dynamicFakeLifecycleBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dynamicFakeLifecycleBlockedは独自の失敗分岐を所有しない。
 * @invariant dynamicFakeLifecycleBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dynamicFakeLifecycleBlockedはProcess内の同一Subsystemで完結する。
 * @security dynamicFakeLifecycleBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dynamicFakeLifecycleBlockedは共有非同期状態を持たない同期処理である。
 */
function dynamicFakeLifecycleBlocked(
  reason: string,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    status: "blocked",
    reason,
    provenance: "repository_owned_docker_fake_provider",
    fakeProviderStartAttempted: false,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    containerAbsenceVerified: false,
    processTreeAbsenceVerified: false,
    hostCleanupVerified: false,
    elapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    cancellationRequested: false,
    cancellationObservation: "not_implemented",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * DIの閉じた実行事実を既存lifecycle表示へ投影する。
 * @responsibility 技術分類を再解釈せず上位の公開fieldへ対応付ける。
 * @trace ARCH-000008
 * @input facts: DIの同じ要求から返された実行事実。
 * @returns 未確定の既存lifecycle観測。
 * @precondition 回収やHost清掃の成立は別途確認する。
 * @postcondition 候補をverifiedへ昇格しない。
 * @effect N/A: 局所値の投影だけ。
 * @failure 下位のblocked理由を維持する。
 * @invariant 生出力やProcess Handleを受け取らない。
 * @boundary DI技術事実とCoordinatorの公開意味。
 * @security この投影からAuthorityを発行しない。
 * @concurrency 同期投影だけ。
 */
function projectProbeExecutionFacts(
  facts: IsolationProbeFacts,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    ...dynamicFakeLifecycleBlocked(facts.lifecycleReason),
    status: facts.lifecycleStatus,
    provenance: "untrusted_execution_fixture",
    fakeProviderStartAttempted: true,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    elapsedMs: facts.elapsedMs,
    stdoutBytes: facts.stdoutBytes,
    stderrBytes: facts.stderrBytes,
    exitCode: facts.exitCode,
    signal: facts.signal,
    timedOut: facts.timedOut,
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
  });
}

/**
 * 失敗を固定Schemaへ正規化する。
 *
 * @responsibility 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、fallback
 * @returns stringを返す。
 * @precondition 「error: unknown、fallback」がnormalizeFailureの入力契約を満たす。
 * @postcondition normalizeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeFailure(
  error: unknown,
  fallback = "docker_isolation_probe_failed",
): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_mount_path_unsupported",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
    "docker_probe_checkpoint_unconfirmed",
    "docker_probe_cleanup_failed",
    "docker_probe_receipt_mismatch",
    "docker_recovery_container_identity_unknown",
    "docker_recovery_boundary_failed",
    "docker_recovery_host_generation_active_or_unknown",
  ]);
  const message =
    error instanceof Error
      ? error.message
      : isObject(error)
        ? ownValue(error, "message")
        : undefined;
  return typeof message === "string" && known.has(message) ? message : fallback;
}

/**
 * docker-isolationを停止結果として構築する。
 *
 * @responsibility docker-isolationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired
 * @returns DockerProbeResultを返す。
 * @precondition 「reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function isolationProbeBlocked(
  reason: string,
  probeId: string | null = null,
  shouldRetainOperationDirectories = false,
  recoveryId: string | null = null,
  isManualRecoveryRequired = false,
): DockerProbeResult {
  return {
    status: "blocked",
    reason,
    probeId,
    retainOperationDirectories: shouldRetainOperationDirectories,
    hostCleanupCompleted: false,
    recoveryId,
    manualRecoveryRequired: isManualRecoveryRequired,
    cleanup: shouldRetainOperationDirectories
      ? "unconfirmed"
      : "not_required_or_confirmed",
    fakeProviderLifecycle: dynamicFakeLifecycleBlocked(reason),
  };
}

/**
 * Pre Submission 清掃を終了状態へ収束させる。
 *
 * @responsibility Pre Submission 清掃の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string」がfinishPreSubmissionCleanupの入力契約を満たす。
 * @postcondition finishPreSubmissionCleanupの責務を完了した結果だけを返す。
 * @effect N/A: finishPreSubmissionCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure finishPreSubmissionCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant finishPreSubmissionCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishPreSubmissionCleanupはProcess内の同一Subsystemで完結する。
 * @security finishPreSubmissionCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishPreSubmissionCleanupは共有非同期状態を持たない同期処理である。
 */
function finishPreSubmissionCleanup(
  owned: unknown,
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
): DockerProbeResult {
  try {
    cleanupOwnedOperationDirectories(owned);
    return {
      ...baseResult,
      hostCleanupCompleted: true,
      retainOperationDirectories: false,
      recoveryId: null,
      cleanup: "confirmed",
    };
  } catch {
    return {
      ...isolationProbeBlocked(
        "host_operation_cleanup_failed",
        probeId,
        true,
        hostRecoveryId,
      ),
    };
  }
}

/**
 * DIの同じ実行結果とEMの資源記録を閉じてからHostを回収する。
 * @responsibility Intent・Receiptの必須保存と、技術終了・実体清掃の共同成立を所有する。
 * @boundary Doctorは正式Executorを使用する。開発用検証だけが固定故障Probeを明示する。
 * @concurrency 同じExecutorの完了と取消Listener解除を待ち、Host終了判断まで返却しない。
 * @trace ARCH-000008
 * @effect DI固定Probeの実行、EM更新、元Hostの清掃。
 * @failure 保存・ID・終了・回収の不明は同じ回復参照で保持する。
 */
export async function runDockerIsolationProbe(
  owned: unknown,
  signal?: AbortSignal,
  create: (
    request: ExecutorRequest<"isolation_probe">,
    options: IsolationProbeOptions,
  ) => Executor<"isolation_probe"> | null = createExecutor,
): Promise<DockerProbeResult> {
  const probeId = randomUUID();
  const recoveryId = getOwnedHostRecoveryId(owned);
  let executor: Executor<"isolation_probe"> | null = null;
  let outcome: CompletionResult<"isolation_probe"> | null = null;
  let submitted = false;
  let receiptId: string | null = null;
  let notificationFailed = false;
  let result = isolationProbeBlocked(
    "docker_isolation_probe_failed",
    probeId,
    true,
    recoveryId,
  );
  try {
    const mount = createOwnedMountCapability(owned);
    const context = createOwnedOperationContextCapability(owned);
    const management = createOwnedOperationManagementCapability(context, mount);
    const mounts = verifyOwnedMountCapability(mount);
    const saveEvent = (
      event: "submission" | "receipt",
      target: ResourceTarget<"snapshot", "cleanup">,
    ) => {
      try {
        verifyOwnedMountCapability(mount);
        if (
          target.managementDirectory !== mounts.management ||
          target.unreceiptedAbsence !== "retain"
        )
          throw Error("docker_probe_recovery_boundary_failed");
        const {
          managementDirectory: _directory,
          resources: snapshot,
          previouslyAbsent: _absent,
          ...cleanup
        } = target;
        const current = readOwnedHostOperation(management);
        const next = applyResourceEvent(current.record.resources, {
          event,
          key: "probe",
          snapshot,
          cleanup,
        });
        if (!next) throw Error("docker_probe_checkpoint_unconfirmed");
        recordOwnedHostResources(management, next);
      } catch (error) {
        notificationFailed = true;
        throw error;
      }
    };
    executor = create(
      { kind: "isolation_probe", probeId },
      {
        settings: getIsolationSettings(),
        mounts: {
          management: mounts.management,
          workspace: mounts.workspace,
          providerHome: mounts.providerHome,
          tmp: mounts.tmp,
        },
      },
    );
    if (!executor) throw Error("docker_isolation_probe_failed");
    const started = executor.start({
      callbacks: {
        onCommandSubmitting: (purpose, target) => {
          if (purpose !== "create_isolation_probe")
            throw Error("docker_probe_profile_invalid");
          saveEvent("submission", target);
          submitted = true;
        },
        onResourceCreated: (id, target) => {
          if (
            target.resources.resources.find((r) => r.key === "probe")?.identity
              .dockerId !== id
          )
            throw Error("docker_probe_receipt_mismatch");
          saveEvent("receipt", target);
          receiptId = id;
        },
      },
    });
    if (started.status !== "started") throw Error(started.reason);
    if (signal) {
      const startedExecutor = executor;
      const observed = await observeExecutionCompletion(
        { controlCapability: startedExecutor, completion: started.completion },
        () => startedExecutor.cancel(),
        signal,
      );
      if (observed.status !== "observed") throw observed.error;
      outcome = observed.rawCompletion as CompletionResult<"isolation_probe">;
    } else outcome = await started.completion;
    if (notificationFailed) throw Error("docker_probe_checkpoint_unconfirmed");
    const facts = outcome.facts;
    result = isolationProbeBlocked(
      outcome.reason ?? "docker_isolation_probe_failed",
      probeId,
      true,
      recoveryId,
    );
    const isolationConfirmed =
      facts !== null &&
      outcome.reason === facts.isolation.reason &&
      facts.isolation.status === "confirmed" &&
      !outcome.cancelled &&
      outcome.processCompletionConfirmed;

    // 元Completionが明示した未発行だけを保存する。通知の開始やReceipt欠測からは推測しない。
    if (
      submitted &&
      !outcome.creationAttempted &&
      outcome.processCompletionConfirmed &&
      outcome.cleanupConfirmed &&
      outcome.resourceSnapshot?.resources.length === 1 &&
      outcome.resourceSnapshot.resources[0]?.key === "probe" &&
      outcome.resourceSnapshot.resources[0].request === "not_issued" &&
      outcome.resourceSnapshot.resources[0].identity.dockerId === null
    ) {
      const current = readOwnedHostOperation(management);
      const book = applyResourceEvent(current.record.resources, {
        event: "not_issued",
        key: "probe",
      });
      if (!book) throw Error("docker_probe_checkpoint_unconfirmed");
      recordOwnedHostResources(management, book);
      cleanupOwnedOperationDirectories(owned);
      result = {
        ...result,
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      };
    }

    // Receipt欠測や終了不明を、Cleanupの成功だけで不存在へ変換しない。
    if (
      receiptId &&
      outcome.containerId === receiptId &&
      outcome.resourceSnapshot &&
      outcome.processCompletionConfirmed &&
      outcome.cleanupConfirmed
    ) {
      verifyOwnedMountCapability(mount);
      const current = readOwnedHostOperation(management);
      if (!current.record.resources)
        throw Error("docker_probe_checkpoint_unconfirmed");
      const book = applyResourceCleanup(
        current.record.resources,
        outcome.resourceSnapshot,
        [{ key: "probe", observation: "absent" }],
        { recoveryId, previousPayloadSha256: current.payloadSha256 },
      );
      if (!book?.checkpoints.every((c) => c.observation === "absent"))
        throw Error("docker_probe_cleanup_failed");
      recordOwnedHostResources(management, book);
      cleanupOwnedOperationDirectories(owned);
      result = {
        ...result,
        status: isolationConfirmed ? "confirmed" : "blocked",
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      };
      if (facts) {
        const observed = projectProbeExecutionFacts(facts);
        const verified =
          result.status === "confirmed" &&
          facts.lifecycleStatus === "candidate" &&
          typeof facts.elapsedMs === "number" &&
          Number.isSafeInteger(facts.elapsedMs) &&
          facts.elapsedMs >= 0 &&
          facts.elapsedMs <= 30_000;
        result = {
          ...result,
          status: verified ? result.status : "blocked",
          reason: verified ? result.reason : facts.lifecycleReason,
          fakeProviderLifecycle: Object.freeze({
            ...observed,
            provenance: "repository_owned_docker_fake_provider",
            status: verified ? "verified" : "blocked",
            fakeProviderExecuted: verified,
            resultNormalizationVerified: verified,
            containerAbsenceVerified: true,
            processTreeAbsenceVerified: true,
            hostCleanupVerified: true,
          }),
        };
      }
    }
  } catch (error) {
    result = isolationProbeBlocked(
      normalizeFailure(error, "docker_isolation_probe_failed"),
      probeId,
      true,
      recoveryId,
    );
  } finally {
    if (!submitted && !outcome?.creationAttempted)
      result = finishPreSubmissionCleanup(owned, recoveryId, result, probeId);
  }
  return {
    ...result,
    fakeProviderLifecycle: Object.freeze({
      ...result.fakeProviderLifecycle,
      diagnosticDockerContainerEffectIssued:
        outcome?.creationAttempted === true,
      diagnosticFilesystemEffectIssued: true,
    }),
  };
}
/**
 * 元Host記録のSnapshotを同じDI回収契約へ渡す。
 * @responsibility 同じRepository・操作・実LockとReceiptを照合し、資源の終了保存後だけHostを回収する。
 * @trace ARCH-000008
 * @effect 明示要求されたProbe資源の回収とEMの同一記録更新。
 * @failure ID欠測・観測不能・保存失敗では同じ参照を保持する。
 */
export async function recoverDockerIsolationProbe(
  recoveryId: string,
  repository: Repository,
  recordingCurrent: () => boolean,
  signal?: AbortSignal,
) {
  let generation: object | null = null;
  let result: Readonly<{
    status: string;
    reason: string;
    recoveryId: string | null;
    hostCleanupCompleted: boolean;
  }> = {
    status: "blocked",
    reason: "docker_probe_recovery_failed",
    recoveryId,
    hostCleanupCompleted: false,
  };
  try {
    signal?.throwIfAborted();
    generation = acquireHostOperationRecoveryGeneration(
      repository,
      recoveryId,
      recordingCurrent,
    );
    if (!generation)
      throw Error("docker_recovery_host_generation_active_or_unknown");
    const initial = readHostRecoveryOperation(generation);
    if (initial?.record.purpose !== "isolation_probe")
      throw Error("docker_recovery_boundary_failed");
    const resources = initial.record.resources;
    const savedResourcesSettled = resources?.checkpoints.every(
      (c) =>
        c.submission === "none" ||
        c.submission === "not_issued" ||
        (c.receiptSource !== null && c.observation === "absent"),
    );
    const closedRootAbsent =
      savedResourcesSettled && observeHostRecoveryRoot(generation) === "absent";
    if (resources && !closedRootAbsent) {
      // Receiptなしで構成や名前から自動的に対象を採用しない。
      if (
        resources.checkpoints.some(
          (c) => c.submission === "intent_saved" && c.receiptSource === null,
        )
      )
        throw Error("docker_recovery_container_identity_unknown");
      const borrowed = borrowHostRecoveryManagementDirectory(
        recoveryId,
        generation,
      );
      if (!borrowed) throw Error("docker_recovery_boundary_failed");
      const target: ResourceTarget<"snapshot"> = {
        ...resources.cleanup,
        managementDirectory: borrowed.directory,
        resources: resources.snapshot,
        previouslyAbsent: resources.checkpoints
          .filter((c) => c.observation === "absent")
          .map((c) => c.key),
      };
      let closedSaved = false;
      const execution = cleanupResources(target, getIsolationSettings(), {
        onCleanupSubmitting: () => {
          signal?.throwIfAborted();
          if (!borrowed.assertCurrent() || !recordingCurrent())
            throw Error("docker_recovery_boundary_failed");
        },
        onResourcesClosed: (snapshot, observations) => {
          if (!borrowed.assertCurrent() || !recordingCurrent())
            throw Error("docker_recovery_boundary_failed");
          const current = readHostRecoveryOperation(generation);
          if (!current?.record.resources)
            throw Error("docker_probe_checkpoint_unconfirmed");
          const book = applyResourceCleanup(
            current.record.resources,
            snapshot,
            observations.map((o) => ({
              key: o.key,
              observation: o.observation,
            })),
            { recoveryId, previousPayloadSha256: current.payloadSha256 },
          );
          if (!book) throw Error("docker_probe_checkpoint_unconfirmed");
          recordHostRecoveryResources(generation, book);
          closedSaved = book.checkpoints.every(
            (c) => c.observation === "absent" || c.submission === "not_issued",
          );
        },
      });
      const cancel = () => {
        void execution.cancel();
      };
      signal?.addEventListener("abort", cancel, { once: true });
      let completion: Awaited<typeof execution.completion>;
      try {
        if (signal?.aborted) cancel();
        completion = await execution.completion;
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
      if (
        !closedSaved ||
        !completion.processTerminationConfirmed ||
        !completion.cleanup.confirmed
      )
        throw Error("docker_probe_cleanup_failed");
    }
    const recovered = recoverOwnedOperationDirectories(recoveryId, generation);
    result = {
      ...recovered,
      recoveryId: recovered.status === "recovered" ? null : recoveryId,
      hostCleanupCompleted: recovered.status === "recovered",
    };
  } catch (error) {
    result = {
      status: "blocked",
      reason: normalizeFailure(error, "docker_probe_recovery_failed"),
      recoveryId,
      hostCleanupCompleted: false,
    };
  } finally {
    if (generation && !releaseHostOperationRecoveryGeneration(generation))
      result = {
        status: "blocked",
        reason: "docker_recovery_host_generation_release_unconfirmed",
        recoveryId,
        hostCleanupCompleted: false,
      };
  }
  return result;
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  ...describeIsolationConfiguration().runtimeProfile,
  dynamicFakeProviderProcessImplemented: true,
  realProviderProcessesExecuted: false,
});

export const PROVIDER_LIFECYCLE_CONTRACT =
  "crdd-coordinator/provider-lifecycle";

export const PROVIDER_LIFECYCLE_CONTRACT_REVISION = 8;

const PROVIDERS = Object.freeze(["codex", "claude"] as const);

const MODES = Object.freeze(["login", "run"] as const);

const billingPolicy = getBillingPolicy();

/**
 * Provider Lifecycle 契約の公開契約を記述する。
 *
 * @responsibility Provider Lifecycle 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderLifecycleContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderLifecycleContractの入力契約を満たす。
 * @postcondition describeProviderLifecycleContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderLifecycleContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderLifecycleContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderLifecycleContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderLifecycleContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderLifecycleContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderLifecycleContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderLifecycleContract() {
  return Object.freeze({
    contract: PROVIDER_LIFECYCLE_CONTRACT,
    contractRevision: PROVIDER_LIFECYCLE_CONTRACT_REVISION,
    implementationState: "repository_owned_docker_fake_observation",
    providers: PROVIDERS,
    modes: MODES,
    authPolicies: Object.freeze({
      codex: getAuthenticationDefinition("codex").policy,
      claude: getAuthenticationDefinition("claude").policy,
    }),
    authenticationPolicyState: "approved_policy_only",
    dedicatedProviderHome: describeProviderHomeContract(),
    limits: null,
    fixedDigestImageRequired: true,
    fixedDigestImageConfigured: false,
    providerAutoUpdateAllowed: false,
    providerSessionResumeAllowed: false,
    telemetryDecision: "not_implemented",
    realProviderSpawn: "blocked_before_spawn",
    realProviderEgress: "not_implemented",
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    billingPolicy: billingPolicy,
    rawAuthOutputRecorded: false,
    oauthTokenReadByRuntime: false,
    syntheticFakeObservationState: "retired",
    dynamicFakeProviderObservation: Object.freeze({
      implementationState: "implemented_for_doctor_isolation_success_probe",
      provenance: "repository_owned_docker_fake_provider",
      normalExecution: "implemented_candidate",
      exactResultNormalization: "implemented_candidate",
      containerAndProcessTreeAbsence:
        "implemented_candidate_after_owned_cleanup",
      timeoutAndOutputLimitClassification: "implemented",
      inFlightCancellation: "not_implemented",
      actualFailureScenarioVerification: "not_verified",
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
      realProviderReadiness: false,
    }),
    fakeProviderExecution: "implemented_for_doctor_isolation_success_probe",
    fakeProviderConfersRealProviderReadiness: false,
    operationCapabilityIssued: false,
  });
}

export const MINIMUM_COORDINATOR_NODE_VERSION = "24.12.0";

const MINIMUM = Object.freeze({ major: 24, minor: 12, patch: 0 });

/**
 * Supported Coordinator Node Runtimeかを判定する。
 *
 * @responsibility Supported Coordinator Node Runtimeの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns isSupportedNodeRuntimeの計算結果を返す。
 * @precondition 「value: unknown」がisSupportedNodeRuntimeの入力契約を満たす。
 * @postcondition isSupportedNodeRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedNodeRuntimeは独自の失敗分岐を所有しない。
 * @invariant isSupportedNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: isSupportedNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSupportedNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function isSupportedNodeRuntime(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value);
  if (!match) return false;
  const [major, minor, patch] = match
    .slice(1)
    .map((part) => Number.parseInt(part ?? "", 10));
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  return (
    (major ?? -1) > MINIMUM.major ||
    ((major ?? -1) === MINIMUM.major &&
      ((minor ?? -1) > MINIMUM.minor ||
        ((minor ?? -1) === MINIMUM.minor && (patch ?? -1) >= MINIMUM.patch)))
  );
}

/**
 * Supported Coordinator Node Runtimeを表明どおりか検査する。
 *
 * @responsibility Supported Coordinator Node Runtimeの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns N/A: assertSupportedCoordinatorNodeRuntimeは戻り値を返さない。
 * @precondition 「value: unknown」がassertSupportedCoordinatorNodeRuntimeの入力契約を満たす。
 * @postcondition assertSupportedCoordinatorNodeRuntimeの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertSupportedCoordinatorNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertSupportedCoordinatorNodeRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertSupportedCoordinatorNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertSupportedCoordinatorNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: assertSupportedCoordinatorNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertSupportedCoordinatorNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function assertSupportedCoordinatorNodeRuntime(value: unknown) {
  if (!isSupportedNodeRuntime(value)) {
    throw new Error("coordinator_node_version_unsupported");
  }
}

export const COORDINATOR_RECOVERY_LIFECYCLE_PREFIX =
  "[Coordinator recovery] " as const;

export const COORDINATOR_EXECUTION_INTELLIGENCE_PREFIX =
  "[Coordinator execution intelligence] " as const;

const COORDINATOR_DIAGNOSTIC_TIMEOUT_MS = 5_000;

/** stderrの診断書込みの終端を区別する。 @trace ARCH-000004 */
type CoordinatorDiagnosticOutcome =
  | "success"
  | "callback_error"
  | "stream_error"
  | "stream_close"
  | "timeout"
  | "unavailable"
  | "throw";

/**
 * 回復または実行分析の診断を、固定語彙で同じWritableへ直列出力する。
 * @responsibility 診断ごとのEvent名を固定し、書込みの終端と停止を所有する。
 * @trace ARCH-000004
 * @input Writable、診断の用途、既存の書込み期限。
 * @returns 診断送信と監視解除。用途ごとに独立した寿命を持つ。
 * @effect 監視の登録と、report呼出し時だけの直列書込み。
 * @failure callback・error・close・期限・例外を区別し、失敗後の書込みを止める。
 * @concurrency 同じWriter内で競合する完了通知のうち最初だけを採用する。
 */
export function createCoordinatorDiagnosticReporter(
  stream: Writable,
  kind: "recovery" | "execution_intelligence",
  timeoutMs = COORDINATOR_DIAGNOSTIC_TIMEOUT_MS,
) {
  const prefix =
    kind === "recovery"
      ? COORDINATOR_RECOVERY_LIFECYCLE_PREFIX
      : COORDINATOR_EXECUTION_INTELLIGENCE_PREFIX;
  const eventName =
    kind === "recovery"
      ? "coordinator_recovery_transition"
      : "coordinator_execution_intelligence_publication";
  let isUnavailable = !stream.writable || stream.destroyed;
  let isDisposed = false;
  let pending: ((outcome: CoordinatorDiagnosticOutcome) => void) | null = null;
  let tail = Promise.resolve();
  const onError = () => {
    isUnavailable = true;
    pending?.("stream_error");
  };
  const onClose = () => {
    isUnavailable = true;
    pending?.("stream_close");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  stream.on("error", onError);
  stream.on("close", onClose);

  const writeOne = (event: object) =>
    new Promise<CoordinatorDiagnosticOutcome>((resolve) => {
      if (isDisposed || isUnavailable || !stream.writable || stream.destroyed) {
        resolve("unavailable");
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (
        outcome: CoordinatorDiagnosticOutcome,
        isDisable = false,
      ) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        if (isDisable) isUnavailable = true;
        resolve(outcome);
      };
      pending = (outcome) => settle(outcome, true);
      timer = setTimeout(() => settle("timeout", true), timeoutMs);
      try {
        stream.write(
          `${prefix}${JSON.stringify({
            ...event,
            event: eventName,
          })}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle("success");
            else settle("callback_error", true);
          },
        );
      } catch {
        settle("throw", true);
      }
    });

  const report = (event: object) => {
    const result = tail.then(() => writeOne(event));
    tail = result.then(() => undefined);
    return result;
  };
  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;
    isUnavailable = true;
    pending?.("unavailable");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  return Object.freeze({ report, dispose });
}

const productionRecoveryDiagnosticReporter =
  createCoordinatorDiagnosticReporter(process.stderr, "recovery");

const productionExecutionIntelligenceDiagnosticReporter =
  createCoordinatorDiagnosticReporter(process.stderr, "execution_intelligence");

/**
 * 回復遷移の凍結コピーを既存Reporterへ渡す。
 * @responsibility 診断の成否と回復の進行を分離する。
 * @trace ARCH-000004
 * @effect 非待機の既存診断出力だけを開始する。
 * @failure 同期例外と後着拒否を回復へ返さない。
 * @boundary Objective回復と受動診断。
 */
export function writeCoordinatorRecoveryDiagnostic(event: object): void {
  try {
    void Promise.resolve(
      productionRecoveryDiagnosticReporter.report(Object.freeze({ ...event })),
    ).catch(() => {});
  } catch {
    // 診断の失敗では回復を停止・再実行しない。
  }
}

/**
 * Coordinator Execution Intelligence Diagnosticを書き込む。
 *
 * @responsibility Coordinator Execution Intelligence Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input observation: CoordinatorExecutionPublicationObservation
 * @returns 戻り値なし。書込み完了は呼出し側へ返さない。
 * @precondition 「observation: CoordinatorExecutionPublicationObservation」がwriteCoordinatorExecutionIntelligenceDiagnosticの入力契約を満たす。
 * @postcondition completed観測は出力せず、それ以外をReporterへ委譲して即時復帰する。
 * @effect 既存Singleton Reporterへ診断値を渡し、指定Writableへ書き込む。
 * @failure N/A: writeCoordinatorExecutionIntelligenceDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeCoordinatorExecutionIntelligenceDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 内部診断値→Singleton Reporter→指定Writableの出力境界へ接続する。
 * @security N/A: writeCoordinatorExecutionIntelligenceDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 呼出し側は書込みを待たない。直列化と失敗後停止はReporterが所有する。
 */
function writeCoordinatorExecutionIntelligenceDiagnostic(
  observation: CoordinatorExecutionPublicationObservation,
) {
  if (observation.status === "completed") return;
  void productionExecutionIntelligenceDiagnosticReporter.report(observation);
}

/** 任意記録の失敗を必須Recovery通知へ投げず、既存の受動診断に閉じる。 */
export function reportExecutionRecording(result: WriteResult) {
  try {
    if (result.status === "completed")
      writeCoordinatorExecutionIntelligenceDiagnostic({
        status: "completed",
        reason: result.reason,
        eventId: result.recordId,
        effectState: "settled",
        cleanupConfirmed: true,
        retryAllowed: false,
        manualRecoveryRequired: false,
        residualArtifactIds: [],
      });
    else
      writeCoordinatorExecutionIntelligenceDiagnostic({
        ...result,
        status: "blocked",
      });
  } catch {
    /* 診断失敗は実行結果を変更しない。 */
  }
}
/** 不明でも同じ記録IDを保持し、再送や実行停止のAuthorityへ変えない。 */
export function reportExecutionRecordingUnavailable(
  recordId: string,
  cause?: unknown,
): void {
  if (
    cause instanceof ExecutionStorageBlockedError ||
    cause instanceof RepositoryDataBlockedError
  ) {
    const observation = {
      status: "blocked" as const,
      reason: cause.reason,
      recordId,
      effectState: cause.effectStateUnknown
        ? ("unknown" as const)
        : cause.effectIssued
          ? ("settled" as const)
          : ("no_effect" as const),
      effectIssued: cause.effectIssued,
      effectStateUnknown: cause.effectStateUnknown,
      cleanupConfirmed: cause.cleanupConfirmed,
      retryAllowed: cause.retryAllowed,
      manualRecoveryRequired:
        cause.effectStateUnknown ||
        !cause.cleanupConfirmed ||
        cause.recoveryReference !== null,
      residualArtifactIds: [],
      recoveryReference: cause.recoveryReference,
    };
    try {
      writeCoordinatorExecutionIntelligenceDiagnostic(observation);
    } catch {
      /* 任意診断は実行を停止しない。 */
    }
    return;
  }
  reportExecutionRecording({
    status: "blocked",
    reason: "execution_intelligence_recording_unavailable",
    recordId,
    effectState: "unknown",
    effectIssued: false,
    effectStateUnknown: true,
    cleanupConfirmed: false,
    retryAllowed: false,
    manualRecoveryRequired: true,
    residualArtifactIds: [],
    recoveryReference: recordId,
  });
}

/** AI要求直前に同じOperation IDで任意の開始記録を一度だけ試す。 */
export function beginProviderExecutionRecording(
  repository: Repository,
  operationId: string,
  provider: string,
  metadata: Readonly<Record<string, string>> = {},
  selection?: Readonly<{ modelIdentifier: string; reasoningEffort?: string }>,
): ProviderExecutionRecording | null {
  const executionId = `execution-${operationId}`;
  try {
    const store = getExecutionIntelligenceStore(repository, true);
    if (!store) return null;
    const startedMonotonicMs = performance.now();
    const result = createExecution(store, {
      executionId,
      ...(metadata.groupId ? { groupId: metadata.groupId } : {}),
      application: "CRDD",
      operation: metadata.operation ?? "provider_execution",
      ...(metadata.role ? { role: metadata.role } : {}),
      ...(metadata.workType ? { workType: metadata.workType } : {}),
      startedAt: new Date().toISOString(),
      configuration: {
        ...(selection
          ? {
              model: {
                state: "observed" as const,
                value: selection.modelIdentifier,
                source: "executor_request_selection",
              },
            }
          : {}),
        ...(selection?.reasoningEffort
          ? {
              reasoningEffort: {
                state: "observed" as const,
                value: selection.reasoningEffort,
                source: "executor_request_selection",
              },
            }
          : {}),
        provider: {
          state: "observed",
          value: provider,
          source: "executor_request_selection",
        },
      },
      metadata: { ...metadata, operationId },
    });
    reportExecutionRecording(result);
    // 保存不明で自動再送せず、Execution IDは診断に保持する。
    return result.status === "completed"
      ? {
          store,
          executionId,
          startedMonotonicMs,
          observation: null,
          settlementAttempted: false,
        }
      : null;
  } catch (error) {
    reportExecutionRecordingUnavailable(executionId, error);
    return null;
  }
}
/** 下位AIの終了事実だけを固定し、上位清掃後まで保存確定を待つ。 */
export function captureProviderExecutionCompletion(
  recording: ProviderExecutionRecording | null,
  result: ProviderExecutionOutcome,
): void {
  if (
    !recording ||
    recording.observation !== null ||
    recording.settlementAttempted
  )
    return;
  try {
    const elapsed = performance.now() - recording.startedMonotonicMs;
    recording.observation = {
      endedAt: new Date().toISOString(),
      elapsedMs:
        Number.isFinite(elapsed) && elapsed >= 0
          ? {
              state: "observed",
              value: elapsed,
              source: "provider_submission_to_executor_completion",
            }
          : { state: "not_observed", reason: "monotonic_clock_invalid" },
      result: {
        status: result.status,
        reason: result.reason,
        cleanupConfirmed: result.cleanupConfirmed,
        manualRecoveryRequired: result.manualRecoveryRequired,
        ...(result.processRestartRequired !== undefined
          ? { processRestartRequired: result.processRestartRequired }
          : {}),
        ...(["no_effect", "settled", "unknown"].includes(
          result.effectState as string,
        )
          ? { effectState: result.effectState }
          : {}),
      },
    };
  } catch {
    reportExecutionRecordingUnavailable(recording.executionId);
  }
}
/** 終了した用途の記録を一回だけ確定する。Provider結果と上位結果は別に保持する。 */
export function finishProviderExecutionRecordings(
  recordings: ProviderExecutionRecording[],
  finalResult: ProviderExecutionOutcome,
): void {
  for (const recording of recordings.splice(0)) {
    if (recording.settlementAttempted) continue;
    recording.settlementAttempted = true;
    const observation = recording.observation;
    if (!observation) {
      reportExecutionRecordingUnavailable(recording.executionId);
      continue;
    }
    try {
      const result = observation.result;
      const status: ExecutionCompleteInput["outcome"]["status"] = [
        "completed",
        "failed",
        "blocked",
        "cancelled",
      ].includes(result.status)
        ? (result.status as "completed" | "failed" | "blocked" | "cancelled")
        : "unknown";
      const cleanupConfirmed =
        result.cleanupConfirmed && finalResult.cleanupConfirmed;
      const manualRecoveryRequired =
        result.manualRecoveryRequired || finalResult.manualRecoveryRequired;
      const processRestartRequired =
        result.processRestartRequired === true ||
        finalResult.processRestartRequired === true
          ? true
          : finalResult.processRestartRequired === false
            ? false
            : null;
      reportExecutionRecording(
        completeExecution(recording.store, recording.executionId, {
          endedAt: observation.endedAt,
          elapsedMs: observation.elapsedMs,
          providerDurationMs: {
            state: "not_observed",
            reason: "provider_start_end_timing_not_exposed",
          },
          outcome: { status, reason: result.reason },
          diagnostic: {
            cleanupConfirmed,
            manualRecoveryRequired,
            processRestartRequired,
            providerCleanupConfirmed: result.cleanupConfirmed,
            taskCleanupConfirmed: finalResult.cleanupConfirmed,
            providerManualRecoveryRequired: result.manualRecoveryRequired,
            taskManualRecoveryRequired: finalResult.manualRecoveryRequired,
            effectState: ["no_effect", "settled", "unknown"].includes(
              finalResult.effectState as string,
            )
              ? (finalResult.effectState as string)
              : ["no_effect", "settled", "unknown"].includes(
                    result.effectState as string,
                  )
                ? (result.effectState as string)
                : null,
            taskStatus: finalResult.status,
            taskReason: finalResult.reason,
          },
          retention:
            !cleanupConfirmed ||
            manualRecoveryRequired ||
            processRestartRequired !== false ||
            status === "unknown" ||
            finalResult.status === "unknown" ||
            finalResult.effectState === "unknown" ||
            result.effectState === "unknown"
              ? "unresolved"
              : "standard",
        }),
      );
    } catch {
      reportExecutionRecordingUnavailable(recording.executionId);
    }
  }
}

/**
 * 明示再起動の準備と現在の所有者を表す。
 *
 * @responsibility Docker Restart PreparationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartPreparationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartPreparationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartPreparationの宣言は外部境界を開かない。
 * @security DockerRestartPreparationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartPreparationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerRestartPreparation = Readonly<{
  kind: "restart";
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string };
  rootCapability: unknown;
  recoveryId: string;
  requestId: string;
  scopeSha256: string;
  recoveryIds: readonly string[];
  locks: readonly Readonly<{
    assertLive: () => boolean;
    release: () => boolean;
  }>[];
}> & {
  closed: boolean;
  persistenceFailed: boolean;
  cleanupUnknown: boolean;
  releaseAttempted: boolean;
  releaseConfirmed: boolean;
  finalizationAttempted: boolean;
  before: Buffer;
  checkpoint: RestartCheckpoint | null;
};

/**
 * 現在操作の回収だけに限定した短命Owner。
 * @responsibility 元Repository・操作・Host世代・保持排他と元本文を共同保持する。
 * @trace ARCH-000008
 * @shape 回復種別、固定結合、Host marker、取得済み排他と保存失効状態。
 * @invariant 元management、署名Root、旧Journalを復元しない。
 * @boundary 現在状態Readerと既存Host／Home／Runtime排他。
 * @security 保存値だけでOwnerを生成せず、公開Rootへ内部値を出さない。
 * @compatibility 最新Schemaだけを扱う。
 */
type ExecutionOperationState = Extract<
  NonNullable<ReturnType<typeof readState>["value"]>["operationStates"][number],
  { kind: "docker_task" }
>;

type DockerTaskRecoveryPreparation = {
  kind: "recovery";
  repository: DockerRestartPreparation["repository"];
  rootCapability: unknown;
  recoveryId: string;
  hostGeneration: object;
  hostRoot: string;
  locks: DockerRestartPreparation["locks"];
  before: Buffer;
  /** beforeと同じ版。保存・fresh Readerの相関確認後にだけ一緒に更新する。 */
  snapshot: ExecutionStateSnapshot;
  operationStates: NonNullable<
    ReturnType<typeof readState>["value"]
  >["operationStates"];
  closed: boolean;
  persistenceFailed: boolean;
  cleanupUnknown: boolean;
  releaseAttempted: boolean;
  releaseConfirmed: boolean;
  finalizationAttempted: boolean;
  completionAttempted: boolean;
  completionPending: boolean;
  hostCleanup: "present" | "absent" | "unknown";
};

const dockerRecoveryPreparations = new WeakMap<
  object,
  DockerRestartPreparation | DockerTaskRecoveryPreparation
>();

/** 私有準備のkeyに使えるObjectだけを受付する。 @trace ARCH-000008 */
function isRecoveryCapability(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

/**
 * 回収Ownerの保持状態と同じHost markerを再確認する。
 * @responsibility 私有Mapの真正性、既存排他、RepositoryとHost世代を共同確認する。
 * @trace ARCH-000008
 * @input capability: 私有準備キー、record: 同キーの回復結合。
 * @returns 同じ生存Ownerの場合だけtrue。
 * @precondition 元版照合は呼出し側のReaderとWriterが別に行う。
 * @postcondition markerや排他欠測から書込み可能と推定しない。
 * @effect Repository・Host marker・既存排他の読取りのみ。
 * @failure 不一致、失効、例外はfalse。
 * @invariant 元managementや旧Journalを復元しない。
 * @boundary 同一Processの回収OwnerとHost／Repository観測。
 * @security 私有Mapへの結合なしに任意callbackを受理しない。
 * @concurrency 各Writer直前とWriter内部で再確認する。
 */
function assertCurrentRecoveryOwner(
  capability: object,
  record: DockerTaskRecoveryPreparation,
): boolean {
  try {
    if (
      dockerRecoveryPreparations.get(capability) !== record ||
      record.closed ||
      !record.repository.revalidate()
    )
      return false;
    try {
      for (const lock of record.locks) {
        if (lock.assertLive() !== true) {
          record.cleanupUnknown = true;
          return false;
        }
      }
      verifyHostOperationRecoveryGeneration(
        record.hostGeneration,
        record.hostRoot,
        record.repository.operationId,
      );
    } catch {
      record.cleanupUnknown = true;
      return false;
    }
    if (record.hostCleanup === "unknown") return false;
    return (
      observeHostRecoveryRoot(record.hostGeneration) === record.hostCleanup
    );
  } catch {
    return false;
  }
}

/**
 * 現在Repositoryのexact操作に限定したfresh回収Ownerを取得する。
 * @responsibility 現在本文と既存Host世代・Home・Runtime排他を共同保持する。
 * @trace ARCH-000008
 * @input token: 現在Taskのexact回復参照、rootCapability: 検証済みRepository。
 * @returns 短命な回収準備、または元参照・一次拒否と回収確認を持つblocked。
 * @precondition 現在Schemaを使い、旧Ownerの排他が終了している。
 * @postcondition 取得成功をDocker不存在・Host清掃・Lease解放へ昇格しない。
 * @effect 現在state／marker読取りと既存三種排他の取得だけ。
 * @failure 対象欠落、現在値不明、競合、marker差、排他欠測を固定拒否する。
 * @invariant raw Host Lockを二重取得せず、旧AppData・署名・Journalへfallbackしない。
 * @boundary 現在Readerと既存Host／Home／Runtimeの保持境界。
 * @security Root Readerや保存JSONだけから書込みOwnerを生成しない。
 * @concurrency 決定順取得、全元版再照合、部分失敗時の全逆順解放を行う。
 */
export function prepareRuntimeOwnedDockerTaskRecovery(
  token: unknown,
  rootCapability: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<{ assertLive: () => boolean; release: () => boolean }> =
    [];
  let cleanupConfirmed = true;
  let acquisitionPending = false;
  let reason = "docker_task_recovery_preparation_unconfirmed";
  try {
    if (!parsed) {
      reason = "docker_task_recovery_id_invalid";
      throw new Error(reason);
    }
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    let initial = readState(rootCapability, { scope: "recovery" });
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "resource_publication",
          recoveryId: parsed.token,
        },
      });
    const savedTerminal =
      initial.value?.snapshot.operations.some(
        (item) =>
          item.kind === "docker_task" &&
          item.recoveryId === parsed.token &&
          item.lease === "released" &&
          item.outcome?.cleanupConfirmed === true,
      ) === true;
    if (savedTerminal)
      initial = readState(historyRepositoryInput(rootCapability), {
        scope: "recovery",
        input: {
          kind: "execution_history",
          recoveryId: parsed.token,
        },
      });
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readState(historyRepositoryInput(rootCapability), {
        scope: "recovery",
        input: {
          kind: "execution_history",
          recoveryId: parsed.token,
        },
      });
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "execution_completion",
          recoveryId: parsed.token,
        },
      });
    cleanupConfirmed = initial.lockReleased;
    if (
      !repository ||
      initial.status !== "completed" ||
      !initial.value ||
      !initial.lockReleased
    )
      throw new Error(reason);
    const targets = initial.value.snapshot.operations.filter(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === parsed.token,
    );
    const target = targets[0];
    const targetState = initial.value.operationStates.find(
      (state): state is ExecutionOperationState =>
        state.kind === "docker_task" && state.operation === target,
    );
    if (
      targets.length !== 1 ||
      !target ||
      targetState?.kind !== "docker_task"
    ) {
      reason = "docker_task_recovery_current_operation_unconfirmed";
      throw new Error(reason);
    }
    const identity = JSON.parse(target.identityJson);
    const hosts = initial.value.snapshot.operations.filter(
      (r): r is Extract<OperationRecord, { kind: "host_operation" }> =>
        r.kind === "host_operation" && r.operationId === identity.operationId,
    );
    const host = hosts.length === 1 ? hosts[0] : null;
    if (!host || host.purpose === "isolation_probe")
      throw Error("docker_task_recovery_host_binding_invalid");
    const paths = resolveRepositoryExecutionDataPaths(repository.root);
    if (!paths) throw Error("docker_task_recovery_host_binding_invalid");
    const hostRoot = path.join(paths.operations, host.operationId);
    acquisitionPending = true;
    const generation = acquireHostOperationRecoveryGeneration(
      repository.root,
      host.recoveryId,
      repository.revalidate,
      initial.resourcePublication
        ? { kind: "resource_publication", recoveryId: parsed.token }
        : initial.currentHistoryPublication
          ? {
              kind: "execution_history",
              recoveryId: parsed.token,
              history: historyRepositoryInput(repository.root),
            }
          : initial.currentCompletionPublication
            ? { kind: "execution_completion", recoveryId: parsed.token }
            : undefined,
    );
    if (!generation) {
      reason = "docker_task_recovery_host_active_or_unknown";
      throw Error(reason);
    }
    locks.push({
      assertLive: () => {
        verifyHostOperationRecoveryGeneration(
          generation,
          hostRoot,
          host.operationId,
        );
        return true;
      },
      release: () => releaseHostOperationRecoveryGeneration(generation),
    });
    acquisitionPending = false;
    const hostCleanup = observeHostRecoveryRoot(generation);
    if (
      hostCleanup === "unknown" ||
      (host.cleanup === "confirmed" && hostCleanup !== "absent")
    )
      throw Error("docker_task_recovery_host_observation_unknown");
    acquisitionPending = true;
    const home = acquireProviderHomeLock(
      parsed.stableLogicalHomeBindingHash,
      providerHomesDirectoryCandidate(),
    );
    if (home.status !== "acquired") {
      cleanupConfirmed &&= home.cleanupConfirmed;
      if (!home.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
      reason =
        home.reason === "lock_initialization_failed"
          ? "docker_task_recovery_home_lock_initialization_failed"
          : "docker_task_recovery_home_active_or_unknown";
      throw new Error(reason);
    }
    locks.push(home.lock);
    const runtime = acquireExecutionStateLock(runtimeStateDirectoryCandidate());
    if (runtime.status !== "acquired") {
      cleanupConfirmed &&= runtime.cleanupConfirmed;
      if (!runtime.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
      reason =
        runtime.reason === "lock_initialization_failed"
          ? "docker_task_recovery_runtime_lock_initialization_failed"
          : "docker_task_recovery_runtime_active_or_unknown";
      throw new Error(reason);
    }
    locks.push(runtime.lock);
    acquisitionPending = false;
    let current = initial.resourcePublication
      ? readState(rootCapability, {
          scope: "recovery",
          input: {
            kind: "resource_publication",
            recoveryId: parsed.token,
          },
        })
      : initial.currentHistoryPublication
        ? readState(historyRepositoryInput(rootCapability), {
            scope: "recovery",
            input: {
              kind: "execution_history",
              recoveryId: parsed.token,
            },
          })
        : initial.currentCompletionPublication
          ? readState(rootCapability, {
              scope: "recovery",
              input: {
                kind: "execution_completion",
                recoveryId: parsed.token,
              },
            })
          : readState(rootCapability, { scope: "recovery" });
    cleanupConfirmed &&= current.lockReleased;
    let before = Buffer.from(initial.value.sourceText, "utf8");
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(before) ||
      (initial.resourcePublication &&
        (!current.resourcePublication?.before.equals(
          initial.resourcePublication.before,
        ) ||
          !current.resourcePublication.candidate.equals(
            initial.resourcePublication.candidate,
          )))
    ) {
      reason = "docker_task_recovery_boundary_changed";
      throw new Error(reason);
    }
    if (initial.resourcePublication) {
      const resumed = saveRecoveryCheckpoint(
        { ...repository, operationId: identity.operationId },
        parsed.token,
        null,
        {
          kind: "resource_publication",
          publication: initial.resourcePublication,
          assertOwner: () => {
            if (
              !repository.revalidate() ||
              locks.some((lock) => lock.assertLive() !== true)
            )
              return false;
            verifyHostOperationRecoveryGeneration(
              generation,
              hostRoot,
              host.operationId,
            );
            if (observeHostRecoveryRoot(generation) !== hostCleanup)
              return false;
            return true;
          },
        },
      );
      cleanupConfirmed &&= resumed.lockReleased;
      if (
        resumed.status !== "completed" ||
        !resumed.snapshotConfirmed ||
        !resumed.lockReleased
      ) {
        reason = "docker_task_recovery_resource_publication_unconfirmed";
        throw new Error(reason);
      }
      current = readState(rootCapability, { scope: "recovery" });
      cleanupConfirmed &&= current.lockReleased;
      if (
        current.status !== "completed" ||
        !current.value ||
        !current.lockReleased ||
        !Buffer.from(current.value.sourceText, "utf8").equals(
          initial.resourcePublication.candidate,
        )
      ) {
        reason = "docker_task_recovery_resource_publication_unconfirmed";
        throw new Error(reason);
      }
      before = Buffer.from(initial.resourcePublication.candidate);
    }
    const capability = Object.freeze({});
    const record: DockerTaskRecoveryPreparation = {
      kind: "recovery",
      repository: Object.freeze(
        Object.defineProperty(
          { ...repository, operationId: identity.operationId },
          "root",
          { value: repository.root },
        ),
      ),
      rootCapability,
      recoveryId: target.recoveryId,
      hostGeneration: generation,
      hostRoot,
      locks: Object.freeze(locks),
      before,
      snapshot: current.value.snapshot,
      operationStates: current.value.operationStates,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup,
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
      completionAttempted: false,
      completionPending: Boolean(initial.currentCompletionPublication),
    };
    dockerRecoveryPreparations.set(capability, record);
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.closed = true;
      throw new Error(reason);
    }
    return Object.freeze({
      status: "prepared" as const,
      capability,
      recoveryId: target.recoveryId,
      cleanupConfirmed: true,
    });
  } catch {
    if (acquisitionPending) cleanupConfirmed = false;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      recoveryId: parsed?.token ?? null,
      reason,
      cleanupConfirmed,
    });
  }
}

/** 同じ回収Ownerと元版に結び付く技術評価だけを保存する。 @trace ARCH-000008 */
export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
  capability: unknown,
  kind: "resource" | "cleanup" | "lifecycle",
  value: unknown,
): boolean {
  if (!isRecoveryCapability(capability)) return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup === "unknown" ||
    (record.hostCleanup === "absent" && kind !== "lifecycle")
  )
    return false;
  record.persistenceFailed = true;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind,
        value,
        assertOwner: () => assertCurrentRecoveryOwner(capability, record),
      },
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const current = readState(record.rootCapability, { scope: "recovery" });
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      current.value.snapshot.revision !== saved.revision ||
      current.value.payloadSha256 !== saved.payloadSha256
    )
      return false;
    record.before = Buffer.from(current.value.sourceText, "utf8");
    record.snapshot = current.value.snapshot;
    record.operationStates = current.value.operationStates;
    const confirmed = assertCurrentRecoveryOwner(capability, record);
    record.persistenceFailed = !confirmed;
    return confirmed;
  } catch {
    return false;
  }
}

/**
 * 現在の三排他を保持する回収Ownerから旧実行Ownerの退役だけを保存する。
 * @responsibility 既存の実行評価を保持し、新規要求不能の確定を資源清掃から分離する。
 * @trace ARCH-000008
 * @input capability: 同じProcessの私有回収準備。
 * @returns 元版照合と必要な保存・読戻しが成立した場合だけtrue。
 * @precondition 同Root・Host世代とHost／Home／Runtime排他を保持する。
 * @postcondition 既にdisabledなら書込み0。新規退役では他の評価と結果を変更しない。
 * @effect 既存stateのphaseとownerEffectだけを更新する。Docker／Host操作なし。
 * @failure 偽造・元版差・排他不明・後期状態・保存不明では後段を拒否する。
 * @invariant disabledは孤立CLI終了・遅延create無害化・資源不存在を意味しない。
 * @boundary 現在回収Ownerと既存lifecycle Writer。
 * @security 任意の候補値や外部の成功申告を受け取らない。
 * @concurrency fresh全文と実効排他を保存前後で照合する。
 */
function retireRuntimeOwnedDockerTaskExecutionOwner(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      return false;
    }
    let current =
      record.completionPending === true
        ? readState(record.rootCapability, {
            scope: "recovery",
            input: {
              kind: "execution_completion",
              recoveryId: record.recoveryId,
            },
          })
        : readState(record.rootCapability, { scope: "recovery" });
    if (
      current.status === "blocked" &&
      current.lockReleased === true &&
      record.completionPending === false &&
      record.hostCleanup === "absent"
    )
      current = readState(historyRepositoryInput(record.rootCapability), {
        scope: "recovery",
        input: { kind: "execution_history", recoveryId: record.recoveryId },
      });
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    ) {
      record.persistenceFailed = true;
      return false;
    }
    const operation = current.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (!operation || !assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      return false;
    }
    if (operation.execution.ownerEffect === "disabled") return true;
    if (
      record.completionPending === true ||
      operation.phase === "terminal" ||
      record.hostCleanup !== "present"
    ) {
      record.persistenceFailed = true;
      return false;
    }
    return persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
      capability,
      "lifecycle",
      {
        phase: "settling",
        lease: operation.lease,
        execution: { ...operation.execution, ownerEffect: "disabled" },
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      },
    );
  } catch {
    record.persistenceFailed = true;
    return false;
  }
}

/**
 * 現在回収準備を閉じ、取得済み排他を全逆順で一度解放する。
 * @responsibility false／例外でも残りの解放を省略しない。
 * @trace ARCH-000008
 * @input capability: 私有回収準備。
 * @returns 過去不明なし・全解放確認の場合だけtrue。
 * @precondition 取得済み排他はこのOwnerが所有する。
 * @postcondition 解放後・二度目使用・コピーからWriterを発行しない。
 * @effect 既存排他の解放だけ。Docker・Provider・保存処置なし。
 * @failure 偽造・別種別・再使用・解放不明はfalse。
 * @invariant 過去回収不明を後着の成功で消さない。
 * @boundary 回収Ownerと取得済み実効排他。
 * @security 新しい実行許可や回復先を生成しない。
 * @concurrency 閉鎖を先に固定して全解放を試行する。
 */
export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "recovery" || record.closed) return false;
  record.closed = true;
  record.releaseAttempted = true;
  let confirmed = !record.cleanupUnknown;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  record.cleanupUnknown ||= !confirmed;
  record.releaseConfirmed = confirmed;
  return confirmed;
}

/**
 * 全排他解放後に、同じ回収操作の終了保存を一度だけ試行する。
 * @responsibility 解放済みOwnerを新しい処置へ復活させず、固定終端Writerだけへ結合する。
 * @trace ARCH-000008
 * @input capability: 元回収準備Mapのキー。
 * @returns 保存・読戻し・短期Lock解放を区別した固定結果。
 * @precondition Host両不存在と外側排他の全解放が確認済み。
 * @postcondition 成否にかかわらず同Ownerで二度目の終端保存を発行しない。
 * @effect 同じRepository・exact操作の終了保存だけ。Docker／Host処置なし。
 * @failure コピー、別種別、未解放・解放不明、元版競合と保存不明は拒否する。
 * @invariant 一次失敗を保持し、清掃からTask成功を推定しない。
 * @boundary 解放済み私有Ownerと既存現在状態Writer。
 * @security Rootと保存JSONだけで終了保存Ownerを作らない。
 * @concurrency 試行前に一回性を固定し、保存中は元OwnerとRootを同期再確認する。
 */
export function finalizeRuntimeOwnedDockerTaskRecoveryPreparation(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    snapshotConfirmed: false,
    lockReleased: true,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent"
  )
    return refused;
  record.finalizationAttempted = true;
  let writing = true;
  try {
    const operation = record.snapshot.operations.find(
      (item) =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    const repository =
      operation?.kind === "docker_task" &&
      operation.history !== null &&
      !operation.history.confirmed
        ? {
            ...record.repository,
            ...withHistoryRetention(record.repository, record.rootCapability),
          }
        : record.repository;
    const saved = saveRecoveryCheckpoint(
      repository,
      record.recoveryId,
      record.before,
      {
        kind: "terminal",
        assertOwner: () => {
          if (
            !writing ||
            dockerRecoveryPreparations.get(capability) !== record ||
            !record.closed ||
            !record.releaseAttempted ||
            !record.releaseConfirmed ||
            !record.finalizationAttempted ||
            record.persistenceFailed ||
            record.cleanupUnknown ||
            !record.repository.revalidate()
          )
            return false;
          return isHostOperationRootAbsent(
            record.repository.root,
            record.repository.operationId,
          );
        },
      },
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    ) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return saved;
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    writing = false;
  }
}

/**
 * 終了保存後の同じ回収Ownerで、履歴の完成保存を依頼する。
 * @responsibility 完成保存の成否と現在Hostの不存在を結合し、失敗後の同Owner再発行を止める。
 * @trace ARCH-000008
 * @input capability: 全排他解放と終了保存試行を終えた私有準備キー。
 * @returns 保存・排他終了と履歴確認を区別した結果。
 * @precondition 現在資源とHostが終了済みで、旧OwnerのEffectが無効。
 * @postcondition 履歴confirmedまでに限定し、配送・ACK・操作除去は行わない。
 * @effect 固定現在状態と履歴の保存だけ。Docker／Host処置なし。
 * @failure 失効、不明、元版差、保存失敗は同IDを保持して停止する。
 * @invariant 旧Controller結果・実行Authorityを合成しない。
 * @boundary 解放済みOwnerと既存履歴Writer。
 * @security 各Writer境界で同じRootとHost両不存在を再確認する。
 * @concurrency 保存段階はEMが所有し、呼出し後は借用Ownerを失効させる。
 */
export function completeRuntimeOwnedDockerTaskRecoveryHistory(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_state_owner_invalid",
    snapshotConfirmed: false,
    lockReleased: true,
    historyConfirmed: false,
    filesystemEffectIssued: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    !record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent"
  )
    return refused;
  let active = true;
  let filesystemEffectIssued: boolean | null = false;
  let writing = false;
  let lockReleased = true;
  try {
    writing = true;
    lockReleased = false;
    const saved = saveRecoveryHistory(
      {
        ...record.repository,
        ...withHistoryRetention(record.repository, record.rootCapability),
      },
      record.recoveryId,
      () => {
        if (
          !active ||
          dockerRecoveryPreparations.get(capability) !== record ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        return isHostOperationRootAbsent(
          record.repository.root,
          record.repository.operationId,
        );
      },
      "docker_task",
    );
    writing = false;
    lockReleased = saved.lockReleased;
    filesystemEffectIssued = saved.filesystemEffectIssued;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased ||
      !saved.historyConfirmed
    ) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
      return Object.freeze({
        ...saved,
        status: "blocked" as const,
        filesystemEffectIssued,
      });
    }
    return Object.freeze({ ...saved, filesystemEffectIssued });
  } catch {
    if (writing && filesystemEffectIssued !== true)
      filesystemEffectIssued = null;
    record.persistenceFailed = true;
    record.cleanupUnknown ||= !lockReleased;
    return Object.freeze({ ...refused, filesystemEffectIssued, lockReleased });
  } finally {
    active = false;
  }
}

/**
 * 現在保存値をAttempt回収の技術入力へ投影する。
 * @responsibility Domainの意味検査と用途結合だけを所有する。
 * @trace ARCH-000008
 * @input operation: 復号・現在Owner確認済みの操作。directory: 用途限定借用所在。
 * @returns 保存Schemaを含まないExecutor入力。
 * @effect N/A: 同期投影だけ。
 * @failure 五用途欠測は停止。
 * @invariant Docker期待値や回収順序を上位で構築しない。
 */
function projectResourceTarget(
  operation: ExecutionOperationRecord,
  directory: string | null,
): ResourceTarget<"snapshot"> {
  const book = operation.resources;
  if (!book || !directory) throw Error("docker_task_recovery_resource_missing");
  return Object.freeze({
    managementDirectory: directory,
    ...book.cleanup,
    resources: Object.freeze({
      resources: Object.freeze(
        book.snapshot.resources.map((resource) => {
          const checkpoint = book.checkpoints.find(
            (item) => item.key === resource.key,
          );
          if (!checkpoint) throw Error("docker_task_recovery_resource_missing");
          return Object.freeze({
            ...resource,
            request:
              checkpoint.submission !== "intent_saved"
                ? ("not_issued" as const)
                : resource.identity.dockerId === null
                  ? ("unknown" as const)
                  : ("issued" as const),
          });
        }),
      ),
    }),
    previouslyAbsent: Object.freeze(
      book.checkpoints
        .filter(
          (item) =>
            item.observation === "absent" && item.receiptSource !== null,
        )
        .map((item) => item.key),
    ),
  });
}

/**
 * 現在Repositoryの上位相関を現在操作の回復参照へ解決する。
 * @responsibility 完全な現在観測だけを要求集合へ重複なく対応付ける。
 * @trace ARCH-000008
 * @input correlationIds: 上位相関の固定集合、rootCapability: 検証済みRepository。
 * @returns exact一致と明示不存在、または全体停止。
 * @precondition 呼出し元が認証済み上位要求と固定Repositoryを所有する。
 * @postcondition 不存在から元Task成功やProvider未発行を主張しない。
 * @effect 現在stateの読取りと既存短期排他だけ。
 * @failure 不正入力・重複・別consumer・読取／解放不明はabsence0で停止する。
 * @invariant 内部Operation IDへのfallbackと旧AppData探索を行わない。
 * @boundary 上位相関集合と現在Repositoryの固定Snapshot。
 * @security Resolver結果は処置Authorityではなく、保存済み上位義務の照合入力である。
 * @concurrency Readerの全数観測・Root再確認・排他解放を共同条件とする。
 */
export function resolveRuntimeOwnedDockerTaskCurrentCorrelations(
  correlationIds: readonly string[],
  rootCapability: unknown,
  consumer: "orchestrator" | "workbench" | "coordinator_cli" = "orchestrator",
) {
  let lockReleased = true;
  /**
   * 相関観測失敗を既知解放事実と空の対応集合へ限定する。
   * @responsibility 未観測の不存在・一致を失敗結果へ混ぜない。
   * @trace ARCH-000008
   * @input reason: 固定停止理由。
   * @returns 値だけの停止診断。
   * @precondition lockReleasedは下位Readerの返却からだけ更新する。
   * @postcondition 停止時のmatched／absenceは共に空集合。
   * @effect N/A: 値構築だけ。
   * @failure N/A: 外部処置を発行しない。
   * @invariant この診断から回復完了や処置Authorityを発行しない。
   * @boundary N/A: 同期の局所値変換。
   * @security 固定理由とboolean以外の内部情報を返さない。
   * @concurrency N/A: 外部共有状態を変更しない。
   */
  const refused = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      lockReleased,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
    });
  try {
    if (
      types.isProxy(correlationIds) ||
      !Array.isArray(correlationIds) ||
      Object.getPrototypeOf(correlationIds) !== Array.prototype ||
      correlationIds.length === 0 ||
      correlationIds.length > 5
    )
      return refused("docker_task_recovery_correlation_input_invalid");
    const requested: string[] = [];
    for (let index = 0; index < correlationIds.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(
        correlationIds,
        String(index),
      );
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(descriptor.value) ||
        requested.includes(descriptor.value)
      )
        return refused("docker_task_recovery_correlation_input_invalid");
      requested.push(descriptor.value);
    }
    const observed = readState(rootCapability, { scope: "recovery" });
    lockReleased = observed.lockReleased;
    if (observed.status !== "completed" || !observed.value || !lockReleased)
      return refused("docker_task_recovery_correlation_current_unconfirmed");
    const matches = new Map<string, string>();
    const recoveries = new Set<string>();
    for (const operation of observed.value.snapshot.operations) {
      if (operation.kind !== "docker_task") continue;
      const identity = JSON.parse(operation.identityJson);
      const correlation = identity.recoveryCorrelationId;
      if (correlation === undefined && identity.consumer !== consumer) continue;
      if (
        typeof correlation !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(correlation) ||
        matches.has(correlation) ||
        recoveries.has(operation.recoveryId) ||
        (requested.includes(correlation) && identity.consumer !== consumer)
      )
        return refused("docker_task_recovery_correlation_ambiguous");
      matches.set(correlation, operation.recoveryId);
      recoveries.add(operation.recoveryId);
    }
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_correlations_observed",
      lockReleased,
      bindings: Object.freeze(
        requested.flatMap((correlationId) => {
          const recoveryId = matches.get(correlationId);
          return recoveryId === undefined
            ? []
            : [Object.freeze({ correlationId, recoveryId })];
        }),
      ),
      absentCorrelationIds: Object.freeze(
        requested.filter((id) => !matches.has(id)),
      ),
    });
  } catch {
    return refused("docker_task_recovery_correlation_current_unconfirmed");
  }
}

/**
 * 現在回復をOperationの終了条件まで接続し、公開診断だけを返す。
 * @responsibility 技術回収の共同成立と実WriterのTask関連有無を公開結果へ対応付ける。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 現在Repository、signal: 入口の取消。
 * @returns 内部準備キー・Path・本文を含まない固定診断。
 * @precondition 入口がRepositoryと取消の所有者を検証している。
 * @postcondition 単独Operationは整理し、Task関連OperationはTask原子保存まで保持する。
 * @effect 既存技術回収と終了Writerだけ。
 * @failure 技術欠測・保存不明は元参照と既知事実を保持して停止する。
 * @invariant Provider再実行・旧形式fallback・表示Receiptを追加しない。
 * @boundary 現在回復OwnerとCLI向け診断。
 * @security 実Writerの結果を使い、準備キーを外へ返さない。
 * @concurrency 同期技術回収完了後の取消で確認済み終了を巻き戻さない。
 */
export async function recoverRuntimeOwnedDockerTaskForCurrentConsumer(
  token: unknown,
  rootCapability: unknown,
  signal?: AbortSignal,
) {
  const technical = await recoverRuntimeOwnedDockerTaskFromCurrentRepository(
    token,
    rootCapability,
    signal,
  );
  const report = {
    contract: "crdd-coordinator/current-task-recovery" as const,
    status: "blocked" as "blocked" | "recovered" | "completed",
    reason: technical.reason,
    recoveryId: technical.recoveryId,
    dockerCleanupConfirmed: technical.dockerCleanupConfirmed,
    hostCleanupConfirmed: technical.hostCleanupConfirmed,
    locksReleased: technical.locksReleased,
    historyConfirmed: technical.historyConfirmed,
    operationRetained:
      technical.status === "completed" ? true : (null as boolean | null),
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: technical.cleanupReason,
  };
  if (
    technical.status !== "completed" ||
    !technical.dockerCleanupConfirmed ||
    !technical.hostCleanupConfirmed ||
    !technical.locksReleased ||
    !technical.historyConfirmed ||
    technical.cleanupReason !== null ||
    !technical.preparation
  )
    return Object.freeze(report);
  try {
    const completion = completeRuntimeOwnedDockerTaskRecovery(
      technical.preparation,
    );
    if (
      completion.status === "completed" &&
      "operationRetained" in completion &&
      completion.operationRetained === true
    )
      return Object.freeze({
        ...report,
        status: "completed" as const,
        reason: "docker_task_recovery_terminal_confirmed",
        operationRetained: true,
        operationRemovalConfirmed: false,
        taskRecoveryCompleted: false,
      });
    const completed =
      completion.status === "completed" &&
      completion.snapshotConfirmed &&
      completion.lockReleased &&
      completion.operationRemovalConfirmed &&
      completion.taskRecoveryCompleted;
    return Object.freeze({
      ...report,
      status: completed ? ("recovered" as const) : ("blocked" as const),
      reason: completed ? "docker_task_recovery_completed" : completion.reason,
      locksReleased: report.locksReleased && completion.lockReleased,
      cleanupReason: completion.lockReleased
        ? null
        : "docker_task_recovery_release_unconfirmed",
      operationRetained: completed ? false : null,
      operationRemovalConfirmed: completed,
      taskRecoveryCompleted: completed,
    });
  } catch {
    return Object.freeze({
      ...report,
      reason: "docker_task_recovery_completion_unconfirmed",
      operationRetained: null,
    });
  }
}

/**
 * 現在Repositoryのexact回復を、既存Ownerの順序で結果登録まで接続する。
 * @responsibility 技術回収・全解放・終了保存・履歴を直列化する。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 明示検証済みRoot、signal: 呼出しOwnerの取消。
 * @returns 技術回収の各確認と内部準備キー。操作は保持し、利用者への返却完了は主張しない。
 * @precondition 呼出し元が現在Repositoryと取消の所有者を固定する。
 * @postcondition 成否にかかわらず取得済み排他を一度解放し、失敗後の後続処置を止める。
 * @effect 既存DI資源回収・Host回収と現在状態／履歴の保存だけ。
 * @failure 各段の不明は同じ参照を保持し、元の失敗を解放結果で上書きしない。
 * @invariant Task再実行、Provider要求、Docker再起動、旧AppData探索を行わない。
 * @boundary 現在Rootの回収OwnerからDI／Host／保存Ownerへの固定組立て。
 * @security 内部準備キーを公開reportへ展開せず、署名資格やCallerの成功値を使わない。
 * @concurrency 同期下位要求の終了後に取消を処理し、次段の新Effectを開始しない。
 */
export async function recoverRuntimeOwnedDockerTaskFromCurrentRepository(
  token: unknown,
  rootCapability: unknown,
  signal?: AbortSignal,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const base = Object.freeze({
    status: "blocked" as const,
    reason: "docker_task_recovery_preparation_unconfirmed",
    recoveryId: parsed?.token ?? null,
    dockerCleanupConfirmed: false,
    hostCleanupConfirmed: false,
    locksReleased: true,
    historyConfirmed: false,
    operationRetained: true,
    taskRecoveryCompleted: false,
    cleanupReason: null as string | null,
    preparation: null as object | null,
  });
  if (!parsed)
    return Object.freeze({
      ...base,
      reason: "docker_task_recovery_id_invalid",
    });
  if (
    signal !== undefined &&
    (types.isProxy(signal) || !(signal instanceof AbortSignal))
  )
    return Object.freeze({
      ...base,
      reason: "docker_task_recovery_cancellation_invalid",
    });
  if (signal?.aborted)
    return Object.freeze({ ...base, reason: "docker_task_recovery_cancelled" });
  const prepared = prepareRuntimeOwnedDockerTaskRecovery(
    parsed.token,
    rootCapability,
  );
  if (prepared.status !== "prepared")
    return Object.freeze({
      ...base,
      reason: prepared.reason,
      locksReleased: prepared.cleanupConfirmed,
      cleanupReason: prepared.cleanupConfirmed
        ? null
        : "docker_task_recovery_release_unconfirmed",
    });
  const capability = prepared.capability;
  const record = dockerRecoveryPreparations.get(capability);
  let reason = "docker_task_recovery_owner_unconfirmed";
  let dockerCleanupConfirmed = false,
    hostCleanupConfirmed = false,
    released = false,
    settled = false;
  try {
    if (record?.kind !== "recovery") throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    reason = "docker_task_recovery_owner_retirement_unconfirmed";
    if (!retireRuntimeOwnedDockerTaskExecutionOwner(capability))
      throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    if (record.hostCleanup === "present") {
      const resources = await recoverRuntimeOwnedDockerTaskResources(
        capability,
        signal,
      );
      reason = resources.reason;
      if (
        resources.status !== "completed" ||
        !resources.dockerCleanupConfirmed ||
        !resources.configCleanupConfirmed
      )
        throw new Error(reason);
      dockerCleanupConfirmed = true;
      await setImmediate();
      if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    } else if (record.hostCleanup === "absent") {
      // prepareが既知終端の五資源と現在Host両不存在を照合済み。
      dockerCleanupConfirmed = true;
    } else throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    reason = "docker_task_recovery_host_cleanup_unconfirmed";
    if (!cleanupRuntimeOwnedDockerTaskHost(capability)) throw Error(reason);
    hostCleanupConfirmed = true;
    settled = true;
  } catch (error) {
    reason = safeRecoveryReason(error, "docker_task_recovery_failed_closed");
  } finally {
    try {
      released = releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability);
    } catch {
      released = false;
    }
  }
  const state = {
    ...base,
    reason,
    dockerCleanupConfirmed,
    hostCleanupConfirmed,
    locksReleased: released,
  };
  if (!settled || !released)
    return Object.freeze({
      ...state,
      reason: settled ? "docker_task_recovery_release_unconfirmed" : reason,
      cleanupReason: released
        ? null
        : "docker_task_recovery_release_unconfirmed",
    });
  if (record?.kind === "recovery" && record.completionPending)
    return Object.freeze({
      ...state,
      status: "completed" as const,
      reason: "docker_task_recovery_runtime_state_settled",
      historyConfirmed: true,
      preparation: capability,
    });
  let historyConfirmed = false;
  let finalizationReason = "docker_task_recovery_terminal_unconfirmed";
  try {
    await setImmediate();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_cancelled",
      });
    const terminal =
      finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability);
    if (
      terminal.status !== "completed" ||
      !terminal.snapshotConfirmed ||
      !terminal.lockReleased
    )
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_terminal_unconfirmed",
        locksReleased: terminal.lockReleased,
        cleanupReason: terminal.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    await setImmediate();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_cancelled",
      });
    finalizationReason = "docker_task_recovery_history_unconfirmed";
    const history = completeRuntimeOwnedDockerTaskRecoveryHistory(capability);
    historyConfirmed = history.historyConfirmed;
    if (
      history.status !== "completed" ||
      !history.historyConfirmed ||
      !history.lockReleased
    )
      return Object.freeze({
        ...state,
        reason: history.reason,
        locksReleased: history.lockReleased,
        historyConfirmed,
        cleanupReason: history.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    await setImmediate();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        historyConfirmed: true,
        reason: "docker_task_recovery_cancelled",
      });
    return Object.freeze({
      ...state,
      status: "completed" as const,
      reason: "docker_task_recovery_runtime_state_settled",
      historyConfirmed: true,
      preparation: capability,
    });
  } catch {
    if (record?.kind === "recovery") record.persistenceFailed = true;
    return Object.freeze({
      ...state,
      reason: finalizationReason,
      historyConfirmed,
    });
  }
}

/**
 * 真正な技術回収済みOwnerからOperationの終了を保存する。
 * @responsibility 表示受付を回復条件へ加えず、現在の終了Writerへ一回接続する。
 * @trace ARCH-000008
 * @input capability: 現在回収組立てが保持する内部準備キー。
 * @returns 対象操作の整理保存、排他解放と保持状態。
 * @precondition 同Ownerの技術回収・全解放・終端保存が完了している。
 * @postcondition Task関連は原子保存まで保持し、元Task成功や回答の再配送を生成しない。
 * @effect 既存State Writerによる単独Operationの除去又はTask関連Operationの保持。
 * @failure 偽Owner、再試行、不明、保存失敗では同じ参照を保持して停止する。
 * @invariant Provider要求・Docker再起動・新しい表示Receiptを発行しない。
 * @boundary 現在回収Ownerと保存Ownerの終了処理。
 * @security Root＋IDやCaller成功値だけから終了を許可しない。
 * @concurrency 試行前に一回性を固定し、各Writer確認でRoot・Host両不存在を再観測する。
 */
export function completeRuntimeOwnedDockerTaskRecovery(capability: unknown) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "docker_task_recovery_completion_unconfirmed",
    snapshotConfirmed: false,
    lockReleased: true,
    filesystemEffectIssued: false,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    (!record.finalizationAttempted && !record.completionPending) ||
    record.completionAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent"
  )
    return refused;
  record.completionAttempted = true;
  let active = true;
  try {
    const saved = completeRecovery(
      record.rootCapability,
      record.recoveryId,
      () => {
        if (
          !active ||
          dockerRecoveryPreparations.get(capability) !== record ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        return isHostOperationRootAbsent(
          record.repository.root,
          record.repository.operationId,
        );
      },
      "docker_task",
    );
    const completed =
      saved.status === "completed" &&
      saved.snapshotConfirmed &&
      saved.lockReleased;
    if (!completed) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return Object.freeze({
      ...saved,
      status: completed ? "completed" : "blocked",
      reason:
        completed || saved.status !== "completed"
          ? saved.reason
          : "docker_task_recovery_completion_unconfirmed",
      cleanupReason: saved.lockReleased
        ? null
        : "docker_task_recovery_release_unconfirmed",
      operationRetained:
        "operationRetained" in saved && saved.operationRetained === true,
      operationRemovalConfirmed:
        completed &&
        !("operationRetained" in saved && saved.operationRetained === true),
      taskRecoveryCompleted:
        completed &&
        !("operationRetained" in saved && saved.operationRetained === true),
    });
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    active = false;
  }
}

/**
 * 現在Ownerの保存とExecutorの技術回収を接続する。
 * @responsibility 資源要求の保存遷移・読戻し・認証不明閉鎖を所有する。
 * @trace ARCH-000008
 * @input capability: genuine回収Owner。cleanup／inspect: 固定Executor API、試験では同契約の代役。
 * @returns 同じ回復参照と技術回収・config終了の結果。
 * @precondition Owner・元版・用途限定Host借用が成立している。
 * @postcondition Host清掃・Lease・Task完了をこの処理では確定しない。
 * @effect Domain保存とExecutor操作だけ。
 * @failure 保存・Owner・技術観測不明は同IDで停止。
 * @invariant 発見ID保存・読戻し前に削除へ進めない。
 * @boundary Coordinator保存OwnerとExecutor公開API。
 * @security Docker argv・期待値・config手順を組み立てない。
 * @concurrency 各通知とQueryで元版・現在Ownerをfresh確認する。
 */
export async function recoverRuntimeOwnedDockerTaskResources(
  capability: unknown,
  signal?: AbortSignal,
) {
  const record =
    capability && typeof capability === "object"
      ? dockerRecoveryPreparations.get(capability)
      : null;
  const result = (
    confirmed: boolean,
    reason: string,
    configCleanupConfirmed = !record?.cleanupUnknown,
    dockerCleanupConfirmed = confirmed,
  ) =>
    Object.freeze({
      status: confirmed ? ("completed" as const) : ("blocked" as const),
      recoveryId: record?.kind === "recovery" ? record.recoveryId : null,
      dockerCleanupConfirmed,
      configCleanupConfirmed,
      reason,
    });
  if (
    !capability ||
    typeof capability !== "object" ||
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return result(false, "docker_task_recovery_owner_unconfirmed");
  const current = () => {
    if (record.persistenceFailed || record.cleanupUnknown)
      throw Error("docker_task_recovery_owner_unconfirmed");
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      throw Error("docker_task_recovery_owner_unconfirmed");
    }
    const read = readState(record.rootCapability, { scope: "recovery" });
    if (!read.lockReleased) record.cleanupUnknown = true;
    if (
      read.status !== "completed" ||
      !read.value ||
      !read.lockReleased ||
      !Buffer.from(read.value.sourceText, "utf8").equals(record.before)
    ) {
      record.persistenceFailed = true;
      throw Error("docker_task_recovery_boundary_changed");
    }
    const state = read.value.operationStates.find(
      (value) =>
        value.kind === "docker_task" &&
        value.operation.recoveryId === record.recoveryId,
    );
    if (state?.kind !== "docker_task")
      throw Error("docker_task_recovery_resource_missing");
    return state;
  };

  try {
    const initialState = current();
    const initial = initialState.operation;
    const requested =
      initial.resources?.checkpoints.some(
        (value) => value.submission === "intent_saved",
      ) ?? false;
    const borrowed = requested
      ? borrowHostRecoveryManagementDirectory(
          "host-operation." + record.repository.operationId,
          record.hostGeneration,
        )
      : null;
    if (requested && !borrowed) {
      record.persistenceFailed = true;
      return result(false, "docker_task_recovery_host_borrow_unconfirmed");
    }
    const owner = () => {
      current();
      return borrowed ? borrowed.assertCurrent() : true;
    };
    if (!owner()) throw Error("docker_task_recovery_host_borrow_unconfirmed");
    signal?.throwIfAborted();
    if (!requested && initialState.resourcesSettled)
      return result(true, "docker_task_recovery_resources_clean");
    const target = projectResourceTarget(initial, borrowed?.directory ?? null);
    let authenticationClosureConfirmed = false;
    let inspectionConfigConfirmed = true;
    const execution = cleanupResources(target, getIsolationSettings(), {
      onCleanupSubmitting: () => {
        current();
      },
      onResourceIdentified: (key, snapshot) => {
        const book = current().operation.resources;
        if (
          !book ||
          !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
            capability,
            "resource",
            { event: "identified", key, snapshot, cleanup: book.cleanup },
          )
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        current();
      },
      onResourcesClosed: (snapshot, observations) => {
        const operationState = current();
        const requiresAuthenticationClosure =
          operationState.authenticationClosureAllowed;
        if (
          !requiresAuthenticationClosure &&
          !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
            capability,
            "cleanup",
            { snapshot, observations },
          )
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        const closureState = current();
        if (!closureState.authenticationClosureAllowed) return;
        const closureOperation = closureState.operation;
        const inspection = inspectResources(
          (() => {
            const full = projectResourceTarget(
              closureOperation,
              borrowed?.directory ?? null,
            );
            return {
              ...full,
              resources: {
                resources: full.resources.resources.filter(
                  (r) => r.key === "create_subscription_auth_probe",
                ),
              },
              cleanupOrder: ["create_subscription_auth_probe"],
              previouslyAbsent: [],
            };
          })(),
          getIsolationSettings(),
          { stopOnUnknownAbsence: true, ...(signal ? { signal } : {}) },
        );
        inspectionConfigConfirmed = inspection.configCleanupConfirmed;
        if (!inspectionConfigConfirmed) record.cleanupUnknown = true;
        const authentication = inspection.resources.find(
          (value) => value.key === "create_subscription_auth_probe",
        );
        if (
          inspection.status !== "completed" ||
          !authentication ||
          authentication.absenceObservations.length !== 2 ||
          authentication.absenceObservations.some((value) => value !== "absent")
        )
          throw Error(
            "docker_task_recovery_authentication_absence_unconfirmed",
          );
        current();
        const rounds = authentication.absenceObservations.map(
          (_value, index) => ({
            round: index + 1,
            name: "absent",
            name_label: "absent",
          }),
        );
        record.persistenceFailed = true;
        const saved = saveRecoveryCheckpoint(
          record.repository,
          record.recoveryId,
          record.before,
          {
            kind: "authentication_unknown_closure",
            observations: rounds,
            assertOwner: () =>
              !record.cleanupUnknown &&
              assertCurrentRecoveryOwner(capability, record),
          },
        );
        if (!saved.lockReleased) record.cleanupUnknown = true;
        if (
          saved.status !== "completed" ||
          !saved.snapshotConfirmed ||
          !saved.lockReleased
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        const read = readState(record.rootCapability, { scope: "recovery" });
        if (!read.lockReleased) record.cleanupUnknown = true;
        if (
          read.status !== "completed" ||
          !read.value ||
          !read.lockReleased ||
          read.value.snapshot.revision !== saved.revision ||
          read.value.payloadSha256 !== saved.payloadSha256
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        record.before = Buffer.from(read.value.sourceText, "utf8");
        record.snapshot = read.value.snapshot;
        record.operationStates = read.value.operationStates;
        record.persistenceFailed = !assertCurrentRecoveryOwner(
          capability,
          record,
        );
        if (record.persistenceFailed)
          throw Error("docker_task_recovery_owner_unconfirmed");
        authenticationClosureConfirmed = true;
      },
    });
    const abort = () => {
      void execution.cancel().catch(() => {});
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    let technical: ExecutorResourceCleanupResult<"snapshot">;
    try {
      technical = await execution.completion;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
    const recovered = {
      configCleanupConfirmed: technical.cleanup.configCleanupConfirmed,
      dockerCleanupConfirmed:
        technical.cleanup.confirmed && technical.processTerminationConfirmed,
      status:
        technical.cleanup.confirmed && technical.processTerminationConfirmed
          ? "completed"
          : "blocked",
      reason:
        technical.failure?.reason ??
        (technical.cleanup.confirmed
          ? "docker_task_recovery_resources_clean"
          : "docker_task_recovery_resource_unconfirmed"),
    };
    if (!owner()) throw Error("docker_task_recovery_host_borrow_unconfirmed");
    record.cleanupUnknown ||=
      !recovered.configCleanupConfirmed || !inspectionConfigConfirmed;
    if (
      recovered.status === "blocked" &&
      recovered.reason !== "docker_task_recovery_resource_unconfirmed"
    )
      record.persistenceFailed = true;
    const configConfirmed =
      recovered.configCleanupConfirmed && inspectionConfigConfirmed;
    const confirmed =
      configConfirmed &&
      ((recovered.status === "completed" && recovered.dockerCleanupConfirmed) ||
        (authenticationClosureConfirmed &&
          recovered.reason === "docker_task_recovery_resource_unconfirmed"));
    return result(
      confirmed,
      confirmed ? "docker_task_recovery_resources_clean" : recovered.reason,
      configConfirmed,
      recovered.dockerCleanupConfirmed || authenticationClosureConfirmed,
    );
  } catch {
    record.persistenceFailed = true;
    return result(
      false,
      "docker_task_recovery_execution_unconfirmed",
      !record.cleanupUnknown,
    );
  }
}

/** 子の技術終結・元Lease解放を保存し、同じHost Ownerで実体を回収する。 @trace ARCH-000008 */
export function cleanupRuntimeOwnedDockerTaskHost(
  capability: unknown,
): boolean {
  if (!isRecoveryCapability(capability)) return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const current = readState(
      record.rootCapability,
      record.completionPending
        ? {
            scope: "recovery",
            input: {
              kind: "execution_completion",
              recoveryId: record.recoveryId,
            },
          }
        : { scope: "recovery" },
    );
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    )
      return false;
    const state = current.value.operationStates.find(
      (r) =>
        r.kind === "docker_task" &&
        r.operation.recoveryId === record.recoveryId,
    );
    if (
      state?.kind !== "docker_task" ||
      !state.resourcesSettled ||
      !state.restartSettled ||
      state.operation.execution.ownerEffect !== "disabled"
    )
      return false;
    const operation = state.operation;
    if (record.completionPending) {
      // Hostは既に終結済み。途中保存の同じ断面を観測するだけで再清掃しない。
      if (
        record.hostCleanup !== "absent" ||
        operation.lease !== "released" ||
        JSON.parse(operation.identityJson).operationId !==
          record.repository.operationId ||
        current.value.snapshot.operations.filter(
          (item) =>
            item.kind === "docker_task" &&
            item.recoveryId === record.recoveryId,
        ).length !== 1
      )
        return false;
      const host = readHostRecoveryOperation(record.hostGeneration);
      const hosts = current.value.snapshot.operations.filter(
        (item) =>
          item.kind === "host_operation" &&
          item.operationId === record.repository.operationId,
      );
      if (
        !host ||
        hosts.length !== 1 ||
        host.record.phase !== "terminal" ||
        host.record.cleanup !== "confirmed" ||
        !isDeepStrictEqual(host.record, hosts[0]) ||
        !isDeepStrictEqual(host.snapshot, current.value.snapshot) ||
        host.payloadSha256 !== current.value.payloadSha256 ||
        observeHostRecoveryRoot(record.hostGeneration) !== "absent"
      )
        return false;
      return assertCurrentRecoveryOwner(capability, record);
    }
    if (
      operation.lease !== "released" &&
      !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        capability,
        "lifecycle",
        {
          phase: "settling",
          lease: "released",
          execution: operation.execution,
          primaryFailure: operation.primaryFailure,
          outcome: operation.outcome,
          summarySha256: operation.summarySha256,
        },
      )
    )
      return false;
    const recovered = recoverOwnedOperationDirectories(
      "host-operation." + record.repository.operationId,
      record.hostGeneration,
    );
    if (
      recovered.status !== "recovered" ||
      observeHostRecoveryRoot(record.hostGeneration) !== "absent"
    ) {
      record.hostCleanup = "unknown";
      return false;
    }
    record.hostCleanup = "absent";
    const after = readState(record.rootCapability, { scope: "recovery" });
    if (!after.lockReleased) record.cleanupUnknown = true;
    if (
      after.status !== "completed" ||
      !after.value ||
      !after.lockReleased ||
      !after.value.snapshot.operations.some(
        (r) =>
          r.kind === "host_operation" &&
          r.operationId === record.repository.operationId &&
          r.cleanup === "confirmed" &&
          r.phase === "terminal",
      )
    )
      return false;
    record.before = Buffer.from(after.value.sourceText, "utf8");
    record.snapshot = after.value.snapshot;
    record.operationStates = after.value.operationStates;
    return assertCurrentRecoveryOwner(capability, record);
  } catch {
    record.cleanupUnknown = true;
    return false;
  }
}

/**
 * Docker再起動境界で使用する文字列集合を決定順へ正規化する。
 *
 * @responsibility Recovery一覧と論理Home一覧を重複のない決定順へ正規化する。
 * @trace ARCH-000008
 * @input values: readonly string[]
 * @returns 重複を除き昇順に整列した文字列配列を返す。
 * @precondition valuesは観測済みの文字列配列である。
 * @postcondition 入力順に依存せず、同じ集合から同じ配列を返す。
 * @effect N/A: 入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 文字列配列以外の入力は型境界で拒否される。
 * @invariant 入力配列を変更せず、値の追加または推測を行わない。
 * @boundary N/A: Process内の同一Subsystemで完結する。
 * @security Recovery Identityを新設、短縮または外部公開しない。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
function normalizeDockerRestartScope(values: readonly string[]) {
  return Object.freeze([...new Set(values)].sort());
}

/**
 * 実行資源の義務が残る操作だけを再起動Scopeへ含める。
 * @responsibility 配送待ちだけの清掃済み操作と実行義務を区別する。
 * @trace ARCH-000008
 * @input operation: 検証済み現在操作。
 * @returns 実行義務が残る場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect N/A: 純粋な現在値評価だけ。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
function restartScopeIncludes(
  operation: OperationRecord,
  resourcesSettled: boolean,
  operations: readonly OperationRecord[],
): operation is ExecutionOperationRecord {
  if (operation.kind !== "docker_task") return false;
  return (
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    !operations.some(
      (r) =>
        r.kind === "host_operation" &&
        r.operationId === JSON.parse(operation.identityJson).operationId &&
        r.cleanup === "confirmed",
    ) ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.execution.providerStart === "unknown" ||
    operation.execution.externalSend === "unknown" ||
    operation.execution.sharedWrite === "unknown" ||
    !resourcesSettled
  );
}

/**
 * 現在のRepository・exact操作・全Scopeを既存排他へ結合する。
 * @responsibility 不透明な準備Mapだけへ現在書込みOwnerを保持する。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 検証済みRepository Root。
 * @returns 固定要求IDと不透明な準備、または一次／解放失敗の分離結果。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 既存Host／Home／Runtime排他の取得と現在状態の読取り。Docker要求なし。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function prepareRuntimeOwnedDockerRestart(
  token: unknown,
  rootCapability: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<
    Readonly<{ assertLive: () => boolean; release: () => boolean }>
  > = [];
  let observationCleanupConfirmed = true;
  try {
    if (!parsed) throw new Error("docker_restart_id_invalid");
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    const initial = readState(rootCapability, { scope: "recovery" });
    observationCleanupConfirmed = initial.lockReleased;
    if (
      !repository ||
      initial.status !== "completed" ||
      !initial.value ||
      !initial.lockReleased
    )
      throw new Error("docker_restart_root_unverified");
    const initialValue = initial.value;
    const scoped = initialValue.snapshot.operations.filter(
      (operation): operation is ExecutionOperationRecord => {
        const state = initialValue.operationStates.find(
          (value) => value.operation === operation,
        );
        if (!state || state.kind !== operation.kind)
          throw new Error("docker_restart_boundary_changed");
        return (
          state.kind === "docker_task" &&
          restartScopeIncludes(
            state.operation,
            state.resourcesSettled,
            initialValue.snapshot.operations,
          )
        );
      },
    );
    const target = scoped.find(
      (operation) => operation.recoveryId === parsed.token,
    );
    if (!target) throw new Error("docker_restart_scope_conflict");
    const recoveryIds = normalizeDockerRestartScope(
      scoped.map((operation) => operation.recoveryId),
    );
    const identities = scoped
      .map((operation) => {
        const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
        if (!recovery) throw new Error("docker_restart_scope_conflict");
        return {
          recoveryId: operation.recoveryId,
          identitySha256: operation.identitySha256,
          home: recovery.stableLogicalHomeBindingHash,
          host: JSON.parse(operation.identityJson).operationId as string,
        };
      })
      .sort((left, right) => left.recoveryId.localeCompare(right.recoveryId));
    const scopeSha256 = createHash("sha256")
      .update(
        JSON.stringify({
          schema: "crdd-coordinator/docker-restart-scope/v2",
          repositoryBinding: repository.repositoryBinding,
          identities,
        }),
      )
      .digest("hex");
    for (const host of [...new Set(identities.map((i) => i.host))].sort()) {
      const acquired = acquireHostOperationLock(repository.root, host);
      if (acquired.status !== "acquired") {
        observationCleanupConfirmed &&= acquired.cleanupConfirmed;
        if (!acquired.descriptorClosed)
          poisonRuntimeProcessAfterCleanupUnknown();
        throw Error("docker_restart_host_active_or_unknown");
      }
      locks.push(acquired.lock);
    }
    for (const home of normalizeDockerRestartScope(
      identities.map((identity) => identity.home),
    )) {
      const lock = acquireProviderHomeLock(
        home,
        providerHomesDirectoryCandidate(),
      );
      if (lock.status !== "acquired") {
        observationCleanupConfirmed &&= lock.cleanupConfirmed;
        if (!lock.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
        throw Error(
          lock.reason === "lock_initialization_failed"
            ? "docker_restart_home_lock_initialization_failed"
            : "docker_restart_home_active_or_unknown",
        );
      }
      locks.push(lock.lock);
    }
    const state = acquireExecutionStateLock(runtimeStateDirectoryCandidate());
    if (state.status !== "acquired") {
      observationCleanupConfirmed &&= state.cleanupConfirmed;
      if (!state.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
      throw Error(
        state.reason === "lock_initialization_failed"
          ? "docker_restart_state_lock_initialization_failed"
          : "docker_restart_state_active_or_unknown",
      );
    }
    locks.push(state.lock);
    const current = readState(rootCapability, {
      scope: "recovery",
      input: {
        kind: "restart_preparation",
        recoveryId: target.recoveryId,
        scopeSha256,
      },
    });
    observationCleanupConfirmed &&= current.lockReleased;
    const before = Buffer.from(initial.value.sourceText, "utf8");
    if (
      !locks.every((lock) => lock.assertLive()) ||
      !repository.revalidate() ||
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(before)
    )
      throw new Error("docker_restart_boundary_changed");
    if (!("restartPreparation" in current) || !current.restartPreparation)
      throw new Error("docker_restart_scope_conflict");
    const requestId = current.restartPreparation.requestId;
    const capability = Object.freeze({});
    dockerRecoveryPreparations.set(capability, {
      kind: "restart",
      repository: Object.freeze({
        ...repository,
        operationId: JSON.parse(target.identityJson).operationId,
      }),
      rootCapability,
      recoveryId: target.recoveryId,
      requestId,
      scopeSha256,
      recoveryIds,
      locks: Object.freeze(locks),
      before,
      checkpoint: target.dockerRestart,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
    });
    return Object.freeze({
      status: "prepared" as const,
      capability,
      recoveryId: target.recoveryId,
      requestId,
      scopeSha256,
      alreadyRequested:
        target.dockerRestart !== null &&
        (target.dockerRestart.request !== "not_issued" ||
          target.dockerRestart.result !== null),
      checkpointInitialized: target.dockerRestart !== null,
      primaryFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: false,
    });
  } catch (error) {
    const fixed = new Set([
      "docker_restart_home_lock_initialization_failed",
      "docker_restart_state_lock_initialization_failed",
      "docker_restart_host_lock_initialization_failed",
      "docker_restart_id_invalid",
      "docker_restart_root_unverified",
      "docker_restart_scope_conflict",
      "docker_restart_host_active_or_unknown",
      "docker_restart_home_active_or_unknown",
      "docker_restart_state_active_or_unknown",
      "docker_restart_boundary_changed",
    ]);
    const primaryFailure =
      error instanceof Error && fixed.has(error.message)
        ? error.message
        : "docker_restart_preparation_unconfirmed";
    let cleanupConfirmed = observationCleanupConfirmed;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: cleanupConfirmed
        ? primaryFailure
        : "docker_restart_cleanup_unconfirmed",
      primaryFailure,
      cleanupFailure: cleanupConfirmed
        ? null
        : ("docker_restart_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryId: parsed?.token ?? null,
    });
  }
}

/**
 * 取得済み準備Ownerの排他と現在本文を再確認する。
 * @responsibility 保存値の相関だけで実行許可を推定しない。
 * @trace ARCH-000008
 * @input capability: 既存準備Mapの不透明キー。
 * @returns 同じOwner・Scope・元版の場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 現在状態Readerと既存排他の観測。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function verifyRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "restart" || record.closed || record.persistenceFailed)
    return false;
  try {
    if (
      !record.locks.every((lock) => lock.assertLive()) ||
      !record.repository.revalidate()
    )
      return false;
    const current = readState(record.rootCapability, { scope: "recovery" });
    if (!current.lockReleased) record.cleanupUnknown = true;
    return (
      current.status === "completed" &&
      !!current.value &&
      current.lockReleased &&
      Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    );
  } catch {
    return false;
  }
}

/**
 * 同じ準備Ownerの一要求checkpointを現在状態へ保存する。
 * @responsibility 元版競合と保存不明後の追加要求を止める。
 * @trace ARCH-000008
 * @input capability: 準備Mapキー、checkpoint: 同要求の次値。
 * @returns 保存・読戻し・更新排他解放を確認した場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 対象再起動欄だけの既存Writer更新。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function persistRuntimeOwnedDockerRestartCheckpoint(
  capability: unknown,
  checkpoint: RestartCheckpoint,
): boolean {
  if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) return false;
  const record = dockerRecoveryPreparations.get(capability as object);
  if (
    record?.kind !== "restart" ||
    checkpoint.requestId !== record.requestId ||
    checkpoint.scopeSha256 !== record.scopeSha256
  )
    return false;
  record.persistenceFailed = true;
  try {
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind: "restart",
        value: checkpoint,
        assertOwner: () =>
          !record.closed &&
          record.locks.every((lock) => lock.assertLive()) &&
          record.repository.revalidate(),
      },
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const observed = readState(record.rootCapability, { scope: "recovery" });
    if (!observed.lockReleased) record.cleanupUnknown = true;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      observed.value.snapshot.revision !== saved.revision ||
      observed.value.payloadSha256 !== saved.payloadSha256
    )
      return false;
    const operation = observed.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !operation ||
      !isDeepStrictEqual(
        snapshotJsonValue(operation.dockerRestart),
        snapshotJsonValue(checkpoint),
      )
    )
      return false;
    record.before = Buffer.from(observed.value.sourceText, "utf8");
    record.checkpoint = operation.dockerRestart;
    record.persistenceFailed = false;
    return verifyRuntimeOwnedDockerRestartPreparation(capability);
  } catch {
    return false;
  }
}

/**
 * 既存準備Ownerを閉じて全排他を逆順に解放する。
 * @responsibility 一つの解放失敗でも後続解放を省略しない。
 * @trace ARCH-000008
 * @input capability: 準備Mapキー。
 * @returns 全解放が確認できた場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 取得済み排他の解放だけ。Docker要求なし。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function releaseRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "restart" || record.closed) return false;
  record.closed = true;
  record.releaseAttempted = true;
  let confirmed = !record.cleanupUnknown;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  record.releaseConfirmed = confirmed;
  return confirmed;
}

/**
 * 外側排他の解放結果を同じ要求の終端値へ一度だけ確定する。
 * @responsibility 下位技術結果と全Scope解放を、元Ownerのexact要求へ耐久反映する。
 * @trace ARCH-000008
 * @input capability: 元準備Mapキー、result: 同要求のDI返却結果。
 * @returns 終端保存確認と再起動資源Scopeのcleanup確認を別に返す。
 * @precondition 全Scopeの逆順解放を試行済み。同じMap以外からWriterを発行しない。
 * @postcondition 保存拒否・不明でもNative要求・終端保存を再発行しない。
 * @effect 固定現在状態の対象要求だけの既存Writer更新。Docker処置なし。
 * @failure 別要求、元版競合、再使用、解放不明と保存不明を完成へ畳まない。
 * @invariant 一次結果と過去unknownを消さず、短期Writer排他を再起動cleanupへ循環参入させない。
 * @boundary 解放済み元準備Ownerと同じRepositoryの終端保存。
 * @security closed Ownerは新処置・別対象更新のAuthorityを復活させない。
 * @concurrency 試行前に一回性を固定し、Writer内ではRoot実体だけを再確認する。
 */
export function finalizeRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
  result: DockerEnvironmentResult<"restart">,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    snapshotConfirmed: false,
    lockReleased: true,
    cleanupConfirmed: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "restart" ||
    !record.closed ||
    !record.releaseAttempted ||
    record.finalizationAttempted ||
    result.requestId !== record.requestId
  )
    return refused;
  record.finalizationAttempted = true;
  const cleanupConfirmed = result.cleanupConfirmed && record.releaseConfirmed;
  if (record.checkpoint === null)
    return Object.freeze({ ...refused, cleanupConfirmed });
  if (record.persistenceFailed)
    return Object.freeze({ ...refused, cleanupConfirmed });
  const completed =
    result.status === "completed" &&
    result.restartCompleted &&
    result.delivery !== "unknown" &&
    result.primaryFailure === null &&
    cleanupConfirmed;
  const checkpoint: RestartCheckpoint = Object.freeze({
    ...record.checkpoint,
    cleanup:
      record.checkpoint.request === "not_issued"
        ? "not_required"
        : cleanupConfirmed
          ? "confirmed"
          : "unknown",
    result: Object.freeze({
      status: completed ? ("completed" as const) : ("blocked" as const),
      request: result.request,
      effectOutcomeUnknown: result.effectOutcomeUnknown,
      reason: !cleanupConfirmed
        ? "docker_restart_cleanup_unconfirmed"
        : result.delivery === "unknown"
          ? "docker_restart_record_unconfirmed"
          : result.reason,
    }),
  });
  let writing = true;
  try {
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind: "restart",
        value: checkpoint,
        assertOwner: () =>
          writing &&
          dockerRecoveryPreparations.get(capability) === record &&
          record.closed &&
          record.releaseAttempted &&
          record.finalizationAttempted &&
          record.repository.revalidate(),
      },
    );
    return Object.freeze({ ...saved, cleanupConfirmed });
  } catch {
    return Object.freeze({ ...refused, cleanupConfirmed });
  } finally {
    writing = false;
  }
}

/**
 * exact回復対象の一要求だけを下位の公開固定操作へ渡す。
 * @responsibility 要求前の保存と受付・終端保存を、同じ準備Ownerへ結合する。
 * @trace ARCH-000008
 * @input recoveryId: exact参照、signal: 取消、rootCapability: 検証済み現在Repository。
 * @returns 再起動技術結果、保存・配送と外側排他解放の個別評価。
 * @precondition 呼出し元は人間が承認した同じ回復対象とRepositoryを固定する。
 * @postcondition 元Taskの再実行・復旧完了を主張しない。
 * @effect 現在状態保存とDI固定再起動への一回委譲、取得済み排他の解放。
 * @failure 一次失敗・保存不明・下位cleanupと外側排他解放を区別する。
 * @invariant 過去unknownを未発行へ戻さず、旧phase・署名chainから再発行しない。
 * @boundary 現在許可・保存OwnerとDI公開操作。
 * @security 生Session・Machine・argv・OS指定・保存Pathを下位へ渡さない。
 * @concurrency 同期の保存確認と通知だけを渡し、下位終端後に外側排他を解放する。
 */
export async function restartRuntimeOwnedDockerForRecovery(
  recoveryId: unknown,
  signal: AbortSignal,
  rootCapability: unknown,
) {
  if (signal.aborted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_restart_cancelled",
      primaryFailure: "docker_restart_cancelled",
      stopFailure: null,
      startFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: true,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const preparation = prepareRuntimeOwnedDockerRestart(
    recoveryId,
    rootCapability,
  );
  if (preparation.status !== "prepared")
    return Object.freeze({
      ...preparation,
      stopFailure: null,
      startFailure: null,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const context = preparation.capability;
  let lockCleanupConfirmed = false;
  let result: DockerEnvironmentResult<"restart"> | null = null;
  let failure: string | null = null;
  let checkpointInitialized = preparation.checkpointInitialized;
  let checkpoint: RestartCheckpoint = Object.freeze({
    requestId: preparation.requestId,
    scopeSha256: preparation.scopeSha256,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  });
  /**
   * 同じOwnerから同じ一要求の次値だけを保存する。
   * @responsibility 保存不明後の追加Effectと別要求への書換えを拒否する。
   * @trace ARCH-000008
   * @input value: 同要求の固定checkpoint。
   * @returns 保存・読戻し・排他解放の全確認だけtrue。
   * @precondition 同期callback内の同じ準備Ownerを使用する。
   * @postcondition 成功した元値だけを操作内へ保持する。
   * @effect 現在状態の対象再起動欄だけ。
   * @failure false・throw・Owner失効は固定保存不明。
   * @invariant 下位not_issuedから耐久unknownを巻き戻さない。
   * @boundary 下位通知と上位の現在保存。
   * @security 任意本文・Path・新Authorityを受け取らない。
   * @concurrency callback内で同期確定し、保存Lockを解放して戻る。
   */
  const save = (value: RestartCheckpoint) => {
    if (
      !verifyRuntimeOwnedDockerRestartPreparation(context) ||
      !persistRuntimeOwnedDockerRestartCheckpoint(context, value)
    ) {
      failure = "docker_restart_record_unconfirmed";
      return false;
    }
    checkpoint = value;
    checkpointInitialized = true;
    return true;
  };
  try {
    if (preparation.alreadyRequested) {
      failure = "docker_restart_existing_attempt_requires_recovery";
    } else {
      result = await restartDockerEnvironment(
        {
          mode: "restart",
          input: {
            requestId: preparation.requestId,
            signal,
            verifyBoundary: () =>
              failure === null &&
              verifyRuntimeOwnedDockerRestartPreparation(context),
            onRequesting: () => {
              if (!preparation.checkpointInitialized && !save(checkpoint))
                throw new Error("docker_restart_record_unconfirmed");
              if (
                !save(
                  Object.freeze({
                    ...checkpoint,
                    request: "unknown",
                    cleanup: "pending",
                  }),
                )
              )
                throw new Error("docker_restart_record_unconfirmed");
            },
            onEvent: (event: DockerEnvironmentRestartEvent) => {
              if (event.event === "settled" && !checkpointInitialized) return;
              const saved =
                event.event === "request_accepted"
                  ? save(
                      Object.freeze({
                        ...checkpoint,
                        request: "issued",
                        cleanup: "pending",
                      }),
                    )
                  : save(
                      Object.freeze({
                        ...checkpoint,
                        request:
                          event.observation.request === "not_issued"
                            ? checkpoint.request
                            : event.observation.request,
                        cleanup:
                          checkpoint.request === "not_issued"
                            ? "not_required"
                            : "pending",
                        result: null,
                      }),
                    );
              if (!saved) throw new Error("docker_restart_record_unconfirmed");
            },
          },
        },
        getIsolationSettings(),
      );
    }
  } catch {
    failure ??= "docker_restart_execution_unconfirmed";
  } finally {
    try {
      lockCleanupConfirmed =
        releaseRuntimeOwnedDockerRestartPreparation(context);
    } catch {
      lockCleanupConfirmed = false;
    }
  }
  const finalized =
    result && checkpointInitialized
      ? finalizeRuntimeOwnedDockerRestartPreparation(context, result)
      : null;
  if (
    finalized &&
    (finalized.status !== "completed" ||
      !finalized.snapshotConfirmed ||
      !finalized.lockReleased)
  )
    failure ??= "docker_restart_record_unconfirmed";
  const cleanupConfirmed =
    (result?.cleanupConfirmed ?? true) && lockCleanupConfirmed;
  const primaryFailure = result?.primaryFailure ?? failure;
  const cleanupFailure = cleanupConfirmed
    ? null
    : ("docker_restart_cleanup_unconfirmed" as const);
  const completed =
    result?.status === "completed" &&
    result.restartCompleted &&
    result.primaryFailure === null &&
    result.delivery !== "unknown" &&
    failure === null &&
    cleanupConfirmed;
  return Object.freeze({
    ...(result ?? {}),
    status: completed ? ("completed" as const) : ("blocked" as const),
    reason:
      cleanupFailure ??
      failure ??
      result?.reason ??
      "docker_restart_execution_unconfirmed",
    primaryFailure,
    stopFailure: result?.stopFailure ?? null,
    startFailure: result?.startFailure ?? null,
    cleanupFailure,
    cleanupConfirmed,
    restartCompleted: completed,
    taskRecoveryCompleted: false,
    recoveryRequired: !completed,
    recoveryId: preparation.recoveryId,
  });
}

/**
 * 現在Repositoryの状態をTask入場前に観測する。
 * @responsibility 安定した読取りと初回不存在だけを入場可へ投影する。
 * @trace ARCH-000008
 * @input repositoryRoot: 同じTaskまたは診断が検査するRoot。
 * @returns 入場可否、固定理由、排他解放の観測だけ。
 * @precondition 操作間の衝突は後続beginが実Homeに対して判定する。
 * @postcondition 未解決や配送を含む安定Snapshotを全域拒否しない。
 * @effect Root検証と現在状態Readerによる読取りだけ。
 * @failure Root不正、部分保存、観測不能、解放不明はblocked。
 * @invariant 入場可能から初期化資格・処置許可・資源不存在を推定しない。
 * @boundary Task／診断入口とRepository-local現在状態。
 * @security Snapshot、内部ID、Home Hash、生Pathを返さない。
 * @concurrency Kernel解放確認後にだけavailableを返す。
 */
export function inspectRuntimeOwnedDockerTaskAdmission(
  repositoryRoot: unknown,
) {
  let lockReleased = false;
  try {
    const root = getRepository(repositoryRoot);
    if (root.status !== "completed")
      return Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_current_admission_unconfirmed" as const,
        lockReleased: true,
      });
    const observed = readState(root.capability, {
      scope: "recovery",
      input: { kind: "admission" },
    });
    lockReleased = observed.lockReleased;
    if (
      lockReleased &&
      ((observed.status === "completed" && observed.value !== null) ||
        (observed.status === "blocked" &&
          observed.reason === "coordinator_state_uninitialized"))
    )
      return Object.freeze({
        status: "available" as const,
        reason: "coordinator_current_admission_available" as const,
        lockReleased: true as const,
      });
  } catch {
    // 未観測は入場可へ変換しない。
  }
  return Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_current_admission_unconfirmed" as const,
    lockReleased,
  });
}

const HEX64 = /^[a-f0-9]{64}$/u;

const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);

/**
 * docker-recovery-runtime-internalで使用するProduction Planの値契約を定義する。
 *
 * @responsibility Production PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProductionPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProductionPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProductionPlanの宣言は外部境界を開かない。
 * @security ProductionPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProductionPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProductionPlan = Readonly<{
  provider: "codex" | "claude";
  consumer: "coordinator_cli" | "workbench" | "orchestrator";
  operationId: string;
  recoveryCorrelationId?: string | null;
  executionSelection: ExecutionSelection;
  taskAttempt: 0 | 1;
  providerHomeIdentityHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
}>;

/**
 * docker-recovery-runtime-internalで使用するDurable 記録の値契約を定義する。
 *
 * @responsibility Durable 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DurableRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DurableRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: DurableRecordの宣言は外部境界を開かない。
 * @security DurableRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DurableRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DurableRecord = {
  executor?: Executor<"attempt">;
  executorControl?: object;
  capability: object;
  recoveryId: string;
  managementCapability: object;
  operationId: string;
  operationNonce: string;
  stableLogicalHomeBindingHash: string;
  homeLeaseReleased: boolean;
  settlementContext: object | null;
  initializationReady: boolean;
  initializationIdentityJson: string;
  initializationResult?: ReturnType<typeof saveOperationStart>;
  initializationFailure?: string;
  initializationLeaseReleaseConfirmed?: boolean;
  consumer: ProductionPlan["consumer"];
  hostCleanupOutcome?: unknown;
  dockerCompletion?: unknown;
  terminalObservation?: RecordedAttemptObservation;
  cleanupCheckpoint?: Readonly<{ revision: number; payloadSha256: string }>;
  completedPlan?: ProductionPlan;
};

const durableRecords = new WeakMap<object, DurableRecord>();

/**
 * 保存済みの元記録へ試行専用Executorと開始Controlを寿命結合する。
 * @responsibility 取消の配送先だけを保持し、Controlを回復Authorityへ昇格しない。
 * @trace ARCH-000008
 * @effect 既存のdurableRecordsだけへ元Controlのaliasを登録し、終端で削除する。
 * @failure 保存・Owner・元参照の不一致又は再結合はfalse。
 * @invariant 保存前・未開始ではControlを登録せず、元completionと結果を置換しない。
 */
export function bindRuntimeOwnedExecutorAttempt(
  capability: object,
  management: object,
  executor: Executor<"attempt">,
  started?: StartResult<"attempt">,
): boolean {
  const record = durableRecord(capability);
  if (
    !record ||
    record.managementCapability !== management ||
    (record.executor !== undefined && record.executor !== executor)
  )
    return false;
  if (started === undefined) {
    record.executor = executor;
    return true;
  }
  if (
    started.status !== "started" ||
    started.recoveryId !== record.recoveryId ||
    record.executor !== executor ||
    record.executorControl !== undefined ||
    started.controlCapability === capability ||
    durableRecords.has(started.controlCapability)
  )
    return false;
  const control = started.controlCapability;
  record.executorControl = control;
  durableRecords.set(control, record);
  const close = (result?: CompletionResult<"attempt">) => {
    if (record.executorControl !== control) return;
    durableRecords.delete(control);
    delete record.executorControl;
    if (result?.homeLeaseReleased) delete record.executor;
  };
  void started.completion.then(close, () => close());
  return true;
}

/**
 * 元Controlだけを保存時と同じExecutorへ取消配送する。
 * @responsibility 回復検索とは別のexact Control・管理Owner照合を行う。
 * @trace ARCH-000008
 * @effect 成立時だけ同じExecutorのcancelを呼ぶ。
 * @invariant コピーControl・回復Capability・終端aliasを取消に使わない。
 */
export async function cancelRuntimeOwnedExecutorAttempt(
  control: unknown,
  management: unknown,
) {
  const record =
    control && typeof control === "object" ? durableRecords.get(control) : null;
  if (
    !record?.initializationReady ||
    !record.executor ||
    record.executorControl !== control ||
    record.capability === control ||
    record.managementCapability !== management
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "invalid" as const,
    });
  return record.executor.cancel({
    controlCapability: control,
    managementCapability: management,
  });
}

/**
 * 元の回復参照から試行の終了を依頼し、成立しなければ記録済みのHome解放を確認する。
 * @responsibility TaskとAdviceの終了経路で、元Executorへの依頼と記録済み事実の読取りを区別する。
 * @trace ARCH-000008
 * @effect 管理参照が一致する場合だけ同じExecutorのabandonを呼ぶ。
 * @invariant Home解放の結果をHost回収・保存完了の証明にしない。Control aliasは受け付けない。
 */
function abandonRuntimeOwnedAttemptRecovery(
  capability: unknown,
  management: unknown,
): boolean {
  const record = durableRecord(capability, false);
  if (
    record &&
    record.managementCapability === management &&
    record.executor?.abandon({
      recoveryCapability: capability,
      managementCapability: management,
    }) === true
  )
    return true;
  return abandonRuntimeOwnedDockerRecovery(capability);
}

/**
 * Production Planが有効か判定する。
 *
 * @responsibility Production Planの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input plan: ProductionPlan
 * @returns validProductionPlanの計算結果を返す。
 * @precondition 「plan: ProductionPlan」がvalidProductionPlanの入力契約を満たす。
 * @postcondition validProductionPlanの責務を完了した結果だけを返す。
 * @effect N/A: validProductionPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validProductionPlanは独自の失敗分岐を所有しない。
 * @invariant validProductionPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validProductionPlanはProcess内の同一Subsystemで完結する。
 * @security validProductionPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validProductionPlanは共有非同期状態を持たない同期処理である。
 */
function validProductionPlan(plan: ProductionPlan) {
  return (
    plan !== null &&
    typeof plan === "object" &&
    [
      plan.authContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
      plan.proxyContainerName,
      plan.providerContainerName,
      plan.ownershipLabel,
      plan.providerImageDigest,
      plan.proxyImageDigest,
    ].every((value) => typeof value === "string") &&
    ["workbench", "coordinator_cli", "orchestrator"].includes(plan.consumer) &&
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    inspectExecutionSelection(plan.executionSelection)?.provider ===
      plan.provider &&
    (plan.taskAttempt === 0 || plan.taskAttempt === 1) &&
    [plan.providerHomeIdentityHash, plan.stableLogicalHomeBindingHash].every(
      (value) => HEX64.test(value),
    ) &&
    (plan.operationMode === "boolean_probe" ||
      plan.operationMode === "isolated_task" ||
      plan.operationMode === "workbench_advice") &&
    (plan.workspaceMountMode === null ||
      plan.workspaceMountMode === "read_write" ||
      plan.workspaceMountMode === "read_only")
  );
}

/**
 * 実Home排他と単一現在状態を確定してHostのDocker開始へ接続する。
 * @responsibility 実Home排他と単一現在状態を確定してHostのDocker開始へ接続する。
 * @trace ARCH-000008
 * @input plan: 固定計画。managementCapability: 実Host Owner。observeFailure: 任意の受動診断。
 * @returns ready、または同じ回復参照を保持した停止結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect Home排他、Repository内state.jsonと所有Hostの開始遷移だけ。
 * @failure 観測・保存・遷移不明では停止し、取得済み参照を保持する。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。診断は同期発行し完了を待たず、例外・返却Promiseの拒否を捕捉する。
 */
export function beginRuntimeOwnedDockerRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
  observeFailure?: (
    diagnostic: RecoveryStartFailureDiagnostic,
  ) => void | Promise<void>,
) {
  try {
    let stage: RecoveryStartFailureDiagnostic["stage"] = "plan_validation";
    let diagnosticRecoveryId: string | null = null;
    let ready = false;
    try {
      if (!validProductionPlan(plan)) return null;
      const nonce = randomBytes(32).toString("hex");
      const identityJson = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
        plan,
        managementCapability,
        nonce,
        plan.consumer,
      );
      if (!identityJson) return null;
      stage = "provider_home";
      const observation = inspectRuntimeOwnedWindowsProviderHomeCandidate(
        plan.provider,
      );
      const home = observation.providerHome;
      if (
        observation.status !== "candidate" ||
        !home ||
        home.providerHomeIdentityHash !== plan.providerHomeIdentityHash ||
        home.stableLogicalHomeBindingHash !== plan.stableLogicalHomeBindingHash
      )
        return null;
      let recoveryId: string | null = null;
      let capability: object | null = null;
      try {
        stage = "operation_binding";
        const operation =
          verifyOwnedOperationManagementCapability(managementCapability);
        if (operation.operationId !== plan.operationId)
          throw new Error("docker_recovery_operation_binding_invalid");
        stage = "state_conflict";
        const current = readState(operationStateInput(managementCapability), {
          scope: "operation",
        });
        if (
          current.value?.snapshot.operations.some((item) =>
            item.kind === "runtime_repair"
              ? item.phase !== "terminal"
              : item.kind === "docker_task" &&
                JSON.parse(item.identityJson).stableLogicalHomeBindingHash ===
                  plan.stableLogicalHomeBindingHash &&
                item.lease !== "released",
          )
        )
          throw new Error("docker_recovery_runtime_state_conflict");
        stage = "operation_binding";
        recoveryId =
          "docker-task." +
          plan.stableLogicalHomeBindingHash +
          "." +
          nonce +
          "." +
          createHash("sha256").update(identityJson, "utf8").digest("hex");
        if (!recoveryId)
          throw new Error("docker_recovery_operation_binding_invalid");
        diagnosticRecoveryId = recoveryId;
        capability = Object.freeze({});
        const record: DurableRecord = {
          capability,
          managementCapability: managementCapability as object,
          operationId: operation.operationId,
          operationNonce: nonce,
          recoveryId,
          stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
          homeLeaseReleased: false,
          settlementContext: null,
          initializationReady: false,
          initializationIdentityJson: identityJson,
          consumer: plan.consumer,
        };
        durableRecords.set(capability, record);
        stage = "operation_start_save";
        const saved = saveOperationStart(
          operationStartInput(
            managementCapability,
            (result, operationId, reference) =>
              record.dockerCompletion === result &&
              record.operationId === operationId &&
              record.recoveryId === reference
                ? (record.terminalObservation ?? null)
                : null,
          ),
          identityJson,
        );
        record.initializationResult = saved;
        if (saved.startSaved && !saved.completionContext)
          stage = "settlement_binding";
        if (
          saved.status !== "completed" ||
          !saved.snapshotConfirmed ||
          !saved.lockReleased ||
          saved.recoveryId !== recoveryId
        )
          throw new Error(saved.reason);
        stage = "settlement_binding";
        const context = saved.completionContext;
        if (!context)
          throw new Error("docker_recovery_settlement_binding_invalid");
        record.settlementContext = context;
        const host = readOwnedHostOperation(managementCapability).record;
        if (host.operationId !== plan.operationId || host.phase !== "active")
          throw Error("docker_recovery_host_binding_invalid");
        record.initializationReady = true;
        ready = true;
        return Object.freeze({
          status: "ready" as const,
          recoveryId,
          recoveryCapability: capability,
        });
      } catch (error) {
        const record = capability ? durableRecords.get(capability) : null;
        const reason = safeRecoveryReason(
          error,
          "docker_recovery_initialization_failed_closed",
        );
        if (record && capability) {
          record.initializationFailure = reason;
          record.initializationLeaseReleaseConfirmed = false;
        }
        return Object.freeze({
          status: "blocked" as const,
          recoveryId,
          ...(capability ? { recoveryCapability: capability } : {}),
          reason,
          manualRecoveryRequired: true,
        });
      }
    } finally {
      if (!ready) {
        try {
          void Promise.resolve(
            observeFailure?.(
              Object.freeze({ stage, recoveryId: diagnosticRecoveryId }),
            ),
          ).catch(() => {});
        } catch {
          /* 受動診断の失敗で元の開始結果を変更しない。 */
        }
      }
    }
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_begin_failed_closed",
      ),
      recoveryId: null,
      manualRecoveryRequired: true,
    });
  }
}

/**
 * 現在Repositoryと実Hostから最新の開始Identityを組み立てる。
 * @responsibility AppData RuntimeStateを観測せず、検証済み計画・同じ操作Owner・初期Hostを固定本文へ結合する。
 * @trace ARCH-000008
 * @input plan: Runtimeの固定計画、managementCapability: 同じ操作Owner、operationNonce: 新操作世代、consumer: 本番組立てに固定された利用側。
 * @returns 正規Identity本文、または検証不能のnull。
 * @precondition Provider Homeの現在観測・Lease取得は呼出し元の開始Ownerが別途確認する。
 * @postcondition 旧Root結合やCaller supplied Pathを新形式へ持ち込まない。
 * @effect Repositoryと既存Host記録の読取りのみ。保存・Docker要求・Lease取得は行わない。
 * @failure 別操作、不正計画・世代、Root失効、Host観測不能ではnull。
 * @invariant Identityの組立てを保存確定やProvider起動許可と扱わない。
 * @boundary 本番開始OwnerからRepository-local現在状態形式への内部搬送。
 * @security Host Pathは観測値であり、処置許可や公開情報ではない。
 * @concurrency Rootと操作Ownerを組立て後に再確認し、保存直前の検査はWriterが行う。
 */
export function prepareRuntimeOwnedRepositoryDockerOperationIdentity(
  plan: ProductionPlan,
  managementCapability: unknown,
  operationNonce: unknown,
  consumer: unknown,
): string | null {
  try {
    if (
      !validProductionPlan(plan) ||
      typeof consumer !== "string" ||
      !["workbench", "coordinator_cli", "orchestrator"].includes(consumer) ||
      consumer !== plan.consumer ||
      typeof operationNonce !== "string" ||
      !HEX64.test(operationNonce)
    )
      return null;
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    if (!repository || repository.operationId !== plan.operationId) return null;
    const host = readOwnedHostOperation(managementCapability).record;
    if (
      host.operationId !== plan.operationId ||
      host.phase !== "active" ||
      host.purpose === "isolation_probe"
    )
      return null;
    const identity = {
      schema: "crdd-coordinator/operation-identity/v6",
      operationNonce,
      provider: plan.provider,
      consumer,
      operationId: plan.operationId,
      executionSelection: plan.executionSelection,
      taskAttempt: plan.taskAttempt,
      stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
      providerHomeIdentityHash: plan.providerHomeIdentityHash,
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: plan.ownershipLabel,
      operationMode: plan.operationMode,
      workspaceMountMode: plan.workspaceMountMode,
      ...(plan.workspaceProtection
        ? {
            workspaceProtected: true,
            workspaceProtection: plan.workspaceProtection,
          }
        : {}),
      ...(plan.recoveryCorrelationId
        ? { recoveryCorrelationId: plan.recoveryCorrelationId }
        : {}),
    };
    const identityJson = `${JSON.stringify(identity)}\n`;
    return repository.revalidate() ? identityJson : null;
  } catch {
    return null;
  }
}

/**
 * durable 記録を決定する。
 *
 * @responsibility durable 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns durableRecordの計算結果を返す。
 * @precondition 「capability: unknown」がdurableRecordの入力契約を満たす。
 * @postcondition durableRecordの責務を完了した結果だけを返す。
 * @effect N/A: durableRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: durableRecordは独自の失敗分岐を所有しない。
 * @invariant durableRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: durableRecordはProcess内の同一Subsystemで完結する。
 * @security durableRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: durableRecordは共有非同期状態を持たない同期処理である。
 */
function durableRecord(capability: unknown, isRequireInitialized = true) {
  const record =
    capability && typeof capability === "object"
      ? (durableRecords.get(capability) ?? null)
      : null;
  return record &&
    record.capability === capability &&
    (!isRequireInitialized || record.initializationReady)
    ? record
    : null;
}

/**
 * 真正な初期化停止を照合し、返却結果の寿命に元Ownerを結合する。
 * @responsibility 元失敗・回復参照を保持し、公開停止結果を処置Capabilityにしない。
 * @trace ARCH-000008
 * @input capability: 元Owner、recoveryId・management・homeHash・reason: 元停止相関、result: 寿命保持結果またはnull。
 * @returns 元の初期化停止と一致する場合だけtrue。
 * @precondition 固定Identityから既存Ownerを作成済みである。
 * @postcondition 停止結果aliasから通常処置やLease解放を許可しない。
 * @effect 既存Process内WeakMapへの同recordの寿命結合だけ。
 * @failure 偽Owner、別参照・管理Owner・Home・理由、開始成功済みはfalse。
 * @invariant unknownや清掃未確認を成功へ変更しない。
 * @boundary 本番開始OwnerからController停止結果への内部搬送。
 * @security 元Capabilityとのobject一致を処置入口で維持する。
 * @concurrency N/A: 同期照合と寿命保持のみ。
 */
export function bindRuntimeOwnedDockerInitializationFailure(
  capability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  homeHash: unknown,
  reason: unknown,
  result: object | null,
): boolean {
  const record = durableRecord(capability, false);
  if (
    !record ||
    record.initializationReady ||
    !record.initializationFailure ||
    record.initializationFailure !== reason ||
    record.recoveryId !== recoveryId ||
    record.managementCapability !== managementCapability ||
    record.stableLogicalHomeBindingHash !== homeHash
  )
    return false;
  if (result !== null) durableRecords.set(result, record);
  return true;
}

/**
 * Runtime 所有 Docker 回復 Bindingを検証する。
 *
 * @responsibility Runtime 所有 Docker 回復 Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recoveryCapability: unknown、recoveryId: unknown、managementCapability: unknown、stableLogicalHomeBindingHash: unknown
 * @returns verifyRuntimeOwnedDockerRecoveryBindingの計算結果を返す。
 * @precondition 「recoveryCapability: unknown、recoveryId: unknown、managementCapability: unknown、stableLogicalHomeBindingHash: unknown」がverifyRuntimeOwnedDockerRecoveryBindingの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedDockerRecoveryBindingの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedDockerRecoveryBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyRuntimeOwnedDockerRecoveryBindingは独自の失敗分岐を所有しない。
 * @invariant verifyRuntimeOwnedDockerRecoveryBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedDockerRecoveryBindingはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedDockerRecoveryBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedDockerRecoveryBindingは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedDockerRecoveryBinding(
  recoveryCapability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  stableLogicalHomeBindingHash: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    record !== null &&
    typeof recoveryId === "string" &&
    record.recoveryId === recoveryId &&
    record.managementCapability === managementCapability &&
    typeof stableLogicalHomeBindingHash === "string" &&
    record.stableLogicalHomeBindingHash === stableLogicalHomeBindingHash
  );
}

/**
 * Provider要求前の観測限界を同じ現在状態へ保存する。
 * @responsibility 固定Host callbackを同じOwnerの実行評価checkpointへ接続する。
 * @trace ARCH-000008
 * @input recoveryCapability: 同じ実行中操作を識別する元Owner。
 * @returns 保存確定と排他解放を確認した場合だけtrue。
 * @precondition 同じ本番操作は実行中で、終了要約をまだ固定していない。
 * @postcondition 初期評価をunknownへ進め、既知評価と他のlifecycle項目を維持する。
 * @effect 既存state.json Writerの六field checkpointだけ。
 * @failure 別操作、Owner不一致、終端、保存不明はfalse。
 * @invariant Docker CLI開始や成功出力をProvider実開始・送信成立へ昇格しない。
 * @boundary Controllerの同期要求前境界とRepository内の現在状態。
 * @security 新しい実行・回復Authorityを発行しない。
 * @concurrency 既存Writerの短期排他と元版照合を使用する。
 */
export function recordRuntimeOwnedUnstartedAttempt(
  capability: object,
  management: object,
  result: StartResult<"attempt"> & Readonly<{ status: "blocked" }>,
): boolean {
  const record = durableRecord(capability);
  if (
    !record ||
    record.managementCapability !== management ||
    result.recoveryId !== record.recoveryId ||
    record.executorControl !== undefined ||
    result.status !== "blocked" ||
    result.dockerEffectStarted !== false ||
    result.providerRequestStarted !== false ||
    ![
      "docker_process_controller_plan_invalid",
      "docker_process_controller_recovery_unavailable",
      "docker_process_controller_home_lock_initialization_failed",
      "docker_process_controller_home_lock_descriptor_close_unconfirmed",
    ].includes(result.reason)
  )
    return false;
  const current = readState(operationStateInput(management), {
    scope: "operation",
  });
  const operation = current.value?.snapshot.operations.find(
    (item): item is ExecutionOperationRecord =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !operation ||
    operation.phase !== "executing" ||
    operation.outcome !== null ||
    operation.summarySha256 !== null ||
    (operation.resources?.checkpoints.some(
      (resource) => resource.submission !== "none",
    ) ??
      false) ||
    operation.execution.providerStart !== "not_started" ||
    operation.execution.externalSend !== "not_issued" ||
    operation.execution.sharedWrite !== "not_issued"
  )
    return false;
  const saved = saveOperationCheckpoint(
    operationStateInput(management),
    record.recoveryId,
    {
      kind: "lifecycle",
      value: {
        phase: operation.phase,
        lease: operation.lease,
        execution: { ...operation.execution, ownerEffect: "disabled" },
        primaryFailure: {
          purpose: null,
          stage:
            result.reason === "docker_process_controller_plan_invalid"
              ? "plan_validation"
              : "home_lock",
          reason: result.reason,
          exceptionCode: null,
          commandHandleObtained: false,
          responseObserved: false,
          receiptRecorded: false,
        },
        outcome: null,
        summarySha256: null,
      },
    },
  );
  return (
    saved.status === "completed" &&
    saved.snapshotConfirmed &&
    saved.lockReleased
  );
}

/**
 * Provider要求予定を既存の実行記録へ保存する。
 * @responsibility 要求予定と実開始を混同せず、既存Writerだけを使う。
 * @trace ARCH-000008
 */
export function recordRuntimeOwnedDockerProviderSubmission(
  recoveryCapability: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record) return false;
  const current = readState(operationStateInput(record.managementCapability), {
    scope: "operation",
  });
  const operation = current.value?.snapshot.operations.find(
    (item): item is ExecutionOperationRecord =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !operation ||
    operation.phase !== "executing" ||
    operation.summarySha256 !== null ||
    operation.outcome !== null ||
    operation.execution.ownerEffect !== "active"
  )
    return false;
  const saved = saveOperationCheckpoint(
    operationStateInput(record.managementCapability),
    record.recoveryId,
    {
      kind: "lifecycle",
      value: {
        phase: operation.phase,
        lease: operation.lease,
        execution: {
          ...operation.execution,
          providerStart:
            operation.execution.providerStart === "not_started"
              ? "unknown"
              : operation.execution.providerStart,
          externalSend:
            operation.execution.externalSend === "not_issued"
              ? "unknown"
              : operation.execution.externalSend,
          sharedWrite:
            operation.execution.sharedWrite === "not_issued"
              ? "unknown"
              : operation.execution.sharedWrite,
        },
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      },
    },
  );
  return (
    saved.status === "completed" &&
    saved.snapshotConfirmed &&
    saved.lockReleased
  );
}

/**
 * Docker資源の作成通知を現在状態へ保存する。
 * @responsibility 作成前の予定、作成応答、後からの識別を同じ所有者の記録へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 固定資源用途。resourcesValue: 元通知。event: 通知区分。
 * @returns 保存の確定と排他解放を確認した場合だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 別操作・不正用途・不正な通知・保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordDockerResourceEvent(
  recoveryCapability: unknown,
  purpose: unknown,
  resourcesValue: unknown,
  event: "submission" | "receipt" | "identified",
) {
  const record = durableRecord(recoveryCapability);
  if (!record || typeof purpose !== "string" || !CREATE_PURPOSES.has(purpose))
    return false;
  try {
    const resources = snapshotJsonValue(resourcesValue) as Record<
      string,
      unknown
    >;
    const saved = saveOperationCheckpoint(
      operationStateInput(record.managementCapability),
      record.recoveryId,
      {
        kind: "resource",
        value: { ...resources, event, key: purpose },
      },
    );
    return (
      saved.status === "completed" &&
      saved.snapshotConfirmed &&
      saved.lockReleased
    );
  } catch {
    return false;
  }
}

/**
 * 元Controllerの要求前取消だけを未発行として現在状態へ保存する。
 * @responsibility 予定保存後の取消を、応答欠落や過去unknownから区別する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 固定用途。
 * @returns 同じOwnerと用途の専用保存が成立した場合だけtrue。
 * @precondition 本番ControllerがstartCommand前に取消を確認している。
 * @postcondition 元予定を保持し、未発行終端へ進める。
 * @effect 同じRepositoryの資源checkpointのみ。
 * @failure 別Owner・別用途・既要求・保存不明はfalse。
 * @invariant ID欠落や清掃成功から未発行を推定しない。
 * @boundary 固定Host callbackと現在状態Owner。
 * @security 通知から起動・削除Authorityを発行しない。
 * @concurrency 同期callbackの寿命内だけ既存Writerを呼ぶ。
 */
export function recordRuntimeOwnedDockerResourceNotIssued(
  recoveryCapability: unknown,
  purpose: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    !!record &&
    saveRecoveryCheckpoint(
      operationStateInput(record.managementCapability),
      record.recoveryId,
      null,
      { kind: "resource_not_issued", purpose },
    ).status === "completed"
  );
}

/**
 * 元清掃Ownerの五資源観測を現在状態へ保存する。
 * @responsibility 元清掃Ownerの五資源観測を現在状態へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。observations: 元のexact観測。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 用途・名前・ID・根拠欠落または保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerAbsence(
  recoveryCapability: unknown,
  observations: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || record.completedPlan || record.cleanupCheckpoint) return false;
  const saved = saveOperationCheckpoint(
    operationStateInput(record.managementCapability),
    record.recoveryId,
    { kind: "cleanup", value: observations },
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased
  )
    return false;
  const current = readState(operationStateInput(record.managementCapability), {
    scope: "operation",
  });
  if (
    current.status !== "completed" ||
    !current.value ||
    !current.lockReleased ||
    current.value.snapshot.revision !== saved.revision ||
    current.value.payloadSha256 !== saved.payloadSha256
  )
    return false;
  record.cleanupCheckpoint = Object.freeze({
    revision: current.value.snapshot.revision,
    payloadSha256: current.value.payloadSha256,
  });
  return true;
}

/** 実資源回収とHome解放を元Docker操作の終了準備へ保存する。
 * @responsibility exactの操作・資源・保存版を照合し、観測・保存例外は従来のblockedへ閉じる。
 * @trace ARCH-000008
 */
export function completeRuntimeOwnedDockerRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
  plan: ProductionPlan,
) {
  try {
    const record = durableRecord(recoveryCapability);
    if (
      !record ||
      record.managementCapability !== managementCapability ||
      !record.cleanupCheckpoint ||
      !record.homeLeaseReleased ||
      !validProductionPlan(plan) ||
      (record.completedPlan && record.completedPlan !== plan)
    )
      return Object.freeze({ status: "blocked" as const });
    const current = readState(operationStateInput(managementCapability), {
      scope: "operation",
    });
    const operation = current.value?.snapshot.operations.find(
      (r): r is ExecutionOperationRecord =>
        r.kind === "docker_task" && r.recoveryId === record.recoveryId,
    );
    const host = readOwnedHostOperation(managementCapability).record;
    if (
      current.status !== "completed" ||
      !current.lockReleased ||
      !operation ||
      host.operationId !== plan.operationId ||
      host.phase !== "active" ||
      JSON.parse(operation.identityJson).operationId !== plan.operationId ||
      record.operationId !== plan.operationId
    )
      return Object.freeze({ status: "blocked" as const });
    const identity = JSON.parse(operation.identityJson);
    if (
      identity.taskAttempt !== plan.taskAttempt ||
      !isDeepStrictEqual(
        identity.executionSelection,
        plan.executionSelection,
      ) ||
      [
        "provider",
        "consumer",
        "stableLogicalHomeBindingHash",
        "providerHomeIdentityHash",
        "ownershipLabel",
        "operationMode",
      ].some((k) => identity[k] !== plan[k as keyof typeof plan])
    )
      return Object.freeze({ status: "blocked" as const });
    const expected = new Map([
      ["create_subscription_auth_probe", plan.authContainerName],
      ["create_provider", plan.providerContainerName],
      ["create_proxy", plan.proxyContainerName],
      ["create_internal_network", plan.internalNetworkName],
      ["create_egress_network", plan.egressNetworkName],
    ]);
    if (
      !operation.resources ||
      operation.resources.snapshot.resources.length !== expected.size ||
      new Set(operation.resources.snapshot.resources.map((r) => r.key)).size !==
        expected.size ||
      operation.resources.snapshot.resources.some(
        (r) => expected.get(r.key) !== r.identity.name,
      ) ||
      !current.value?.operationStates.some(
        (r) =>
          r.kind === "docker_task" &&
          r.operation === operation &&
          r.resourcesSettled,
      )
    )
      return Object.freeze({ status: "blocked" as const });
    if (record.completedPlan)
      return Object.freeze({
        status: "completed" as const,
        recoveryFinalizationCapability: recoveryCapability as object,
      });
    if (
      current.value.snapshot.revision !== record.cleanupCheckpoint.revision ||
      current.value.payloadSha256 !== record.cleanupCheckpoint.payloadSha256
    )
      return Object.freeze({ status: "blocked" as const });
    const saved = saveOperationCheckpoint(
      operationStateInput(managementCapability),
      record.recoveryId,
      {
        kind: "lifecycle",
        value: {
          phase: "settling",
          lease: "released",
          execution: { ...operation.execution, ownerEffect: "disabled" },
          primaryFailure: operation.primaryFailure,
          outcome: operation.outcome,
          summarySha256: operation.summarySha256,
        },
      },
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return Object.freeze({ ...saved, status: "blocked" as const });
    record.completedPlan = plan;
    return Object.freeze({
      status: "completed" as const,
      recoveryFinalizationCapability: recoveryCapability as object,
    });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

/**
 * 正常回収Ownerが実際に確認したHomeLease解放を照合する。
 *
 * @responsibility 正常経路の実release成功だけを同じ操作へ非Authorityの事実として保持する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability、operationId、recoveryId: 元の回復参照と操作相関。
 * @returns 同じ実解放を保持する場合だけtrue。
 * @precondition 正常回収Ownerが実releaseを成功確認した元Capabilityを使う。
 * @postcondition abandon、偽Capability、別操作と別参照は根拠にならない。
 * @effect N/A: 私有WeakMapの照合だけを行う。
 * @failure 未登録・相関不一致ではfalse。
 * @invariant 後続処理の失敗で既知の実解放を未解放へ戻さない。
 * @boundary 実HomeLease Ownerから同じ操作の終端保存への事実搬送。
 * @security 解放事実から起動・清掃・回復Authorityを復元しない。
 * @concurrency N/A: 同期照合だけを行いLockや外部待機を追加しない。
 */
export function verifyRuntimeOwnedDockerHomeLeaseRelease(
  recoveryCapability: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  if (!recoveryCapability || typeof recoveryCapability !== "object")
    return false;
  const released = durableRecord(recoveryCapability, false);
  return (
    !!released &&
    released.homeLeaseReleased &&
    released.managementCapability === managementCapability &&
    released.operationId === operationId &&
    released.recoveryId === recoveryId
  );
}

/** 同版の操作投影を元試行と照合し、Host清掃の前提を確認する。 @trace ARCH-000008 */
export function canPrepareRuntimeOwnedDockerHostCleanup(
  capability: unknown,
  state:
    | NonNullable<
        ReturnType<typeof readState>["value"]
      >["operationStates"][number]
    | undefined,
): boolean {
  const record = durableRecord(capability);
  return (
    !!record?.completedPlan &&
    record.homeLeaseReleased &&
    state?.kind === "docker_task" &&
    state.operation.recoveryId === record.recoveryId &&
    state.resourcesSettled &&
    state.restartSettled &&
    state.operation.phase === "settling" &&
    state.operation.lease === "released" &&
    state.operation.execution.ownerEffect === "disabled"
  );
}

/**
 * 受領したレビュー結果から同じTaskの限定是正許可を作る。
 * @responsibility 既存の終端相関と初回レビュー条件を照合する。
 * @trace ARCH-000008
 * @input 同じhandoffのCapabilityとExecutorが返したCompletionResult。
 * @returns 既存の一回使用許可又はnull。
 * @precondition Task Ownerが取消・実行完了を確認して一回だけ呼ぶ。
 * @postcondition 別結果、別操作、清掃不明、二回目レビューへ発行しない。
 * @effect Coordinator既存のProcess内許可への登録だけ。
 * @failure 相関又は所見の不一致では許可を作らない。
 * @invariant 所見の内容を実行・採用判断と同一視しない。
 * @boundary Executorの一時結果とCoordinatorの次試行許可。
 * @security 本文をstate・history・公開DTO・ログへ複製しない。
 * @concurrency awaitを挟まない同じTask Ownerの同期処理。
 */
export function registerRuntimeOwnedReviewFindings(
  capability: object,
  result: CompletionResult<"attempt">,
) {
  const record = durableRecord(capability);
  const plan = record?.completedPlan as RecoveryPlan | undefined;
  const terminal = record?.terminalObservation;
  if (
    !record ||
    !plan ||
    record.dockerCompletion !== result ||
    !terminal ||
    terminal.homeLeaseReleased !== true ||
    !terminal.recoveryCompleted ||
    terminal.recoveryId !== record.recoveryId ||
    terminal.operationId !== record.operationId ||
    result.status !== "completed" ||
    !result.cleanupConfirmed ||
    result.cancellationRequested ||
    result.operationId !== record.operationId ||
    record.operationId !== plan.operationId ||
    plan.operationMode !== "isolated_task" ||
    plan.taskRole !== "reviewer" ||
    plan.taskAttempt !== 0 ||
    !result.normalizedResult ||
    !("decision" in result.normalizedResult) ||
    result.normalizedResult.decision !== "changes_requested" ||
    !result.reviewFindings?.length ||
    result.normalizedResult.findingCount !== result.reviewFindings.length
  )
    return null;
  return registerTaskRemediation(
    record.operationId,
    plan.taskAttempt,
    result.reviewFindings,
  );
}

/**
 * Executorの固定callbackから既存操作記録へ終端材料を結合する。
 * @responsibility 結果と観測を既存Ownerだけに保持し、新Mapを作らない。
 * @trace ARCH-000008
 * @input 元回復Capability、結果、閉じた終端観測。
 * @returns N/A: 既存recordの更新のみ。
 * @precondition 固定Host構成の内部callbackである。
 * @postcondition 別操作・別参照・二重差替えを拒否する。
 * @effect Process内の既存操作記録のみ。
 * @failure 不一致は例外。技術清掃結果は変更しない。
 * @invariant 外部の完了申告を受ける入口として公開しない。
 * @boundary Executorの終了とCoordinatorの既存操作Owner。
 * @security 新しい実行Authorityを発行しない。
 * @concurrency 同じ試行の終了時に同期で結合する。
 */
export function recordRuntimeOwnedDockerTerminalObservation(
  capability: object,
  result: object,
  observation: RecordedAttemptObservation,
) {
  const record = durableRecord(capability);
  if (
    !record?.initializationReady ||
    !record.settlementContext ||
    record.operationId !== observation.operationId ||
    record.recoveryId !== observation.recoveryId ||
    (record.dockerCompletion !== undefined &&
      record.dockerCompletion !== result)
  )
    throw Error("executor_terminal_delivery_mismatch");
  if (
    record.dockerCompletion !== undefined ||
    record.terminalObservation !== undefined
  ) {
    if (
      record.dockerCompletion === result &&
      record.terminalObservation === observation
    )
      return;
    throw Error("executor_terminal_delivery_mismatch");
  }
  record.dockerCompletion = result;
  record.terminalObservation = observation;
}

/**
 * 元Host清掃と元Controller結果を保存し、確定した一時Ownerを退役する。
 * @responsibility 終了保存と成功後の退役を一つの完成操作で所有する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元Owner。rawCompletion: 元Host・Controller結果。
 * @returns 保存結果と失敗相。保存・退役を確認した場合だけcompleted。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 現在状態と履歴の保存のみ。
 * @failure 偽結果・別操作・実終了または保存未確認はblocked。失敗Effectを保持する。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用い、失敗後の入力差替えを拒否する。
 */
export function finishRuntimeOwnedDockerRecovery(
  recoveryFinalizationCapability: unknown,
  rawCompletion: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  const completion = snapshotPlainRecord(
    rawCompletion,
    new Set(["hostCleanupOutcome", "dockerCompletion"]),
  );
  if (
    !record ||
    !completion ||
    record.dockerCompletion !== completion.dockerCompletion ||
    !record.terminalObservation ||
    (record.hostCleanupOutcome !== undefined &&
      record.hostCleanupOutcome !== completion.hostCleanupOutcome)
  )
    return Object.freeze({
      status: "blocked" as const,
      stage: "receipt" as const,
    });
  const settled = completeOperation(
    record.settlementContext,
    completion.hostCleanupOutcome,
    completion.dockerCompletion,
  );
  if (!settled.inputAccepted)
    return Object.freeze({ ...settled, stage: "receipt" as const });
  record.hostCleanupOutcome = completion.hostCleanupOutcome;
  if (settled.status !== "completed")
    return Object.freeze({ ...settled, stage: "receipt" as const });
  durableRecords.delete(recoveryFinalizationCapability as object);
  return Object.freeze({
    ...settled,
    status: "completed" as const,
    stage: "finalization" as const,
  });
}

/**
 * 未解決の回復参照を残し、現在の試行とHostの保持だけを終了する。
 * @responsibility TaskとAdviceの失敗終結で、同じ管理参照を使って現在の所有を手放す。
 * @trace ARCH-000008
 * @precondition 呼出し元が元Hostと元の引渡しを保持している。
 * @postcondition 終了を確認した引渡しだけをabandonedにし、回復参照を消さない。
 * @effect 元Executorの保持終了と、未清掃Hostの世代Lock解放を試みる。
 * @failure 終了を確認できない引渡しは保持し、例外は解放を試みた後に伝播する。
 * @boundary 現在の管理参照と回復用に残るEM記録。廃棄・再送・回復確定は行わない。
 */
export async function retainRuntimeOwnedHostOperation(
  target: HostCompletionTarget,
): Promise<void> {
  const { managementCapability } = target;
  try {
    for (const handoff of target.dockerHandoffs) {
      if (handoff.state === "finalized" || handoff.state === "abandoned")
        continue;
      if (
        abandonRuntimeOwnedAttemptRecovery(
          handoff.capability,
          managementCapability,
        ) === true
      )
        handoff.state = "abandoned";
    }
  } finally {
    if (!target.hostCleanupCompleted)
      await abandonOwnedHostOperationGenerationLock(managementCapability);
  }
}

/**
 * 同じHostの全Stage確認・一回清掃・完成保存・成功分退役を閉じる。
 * @responsibility TaskとAdviceに別実装を置かず、元の進捗recordを直接更新する。
 * @trace ARCH-000008
 * @input target: 既存Hostと引渡しの進捗。
 * @returns 停止相と元回復参照。例外値は内部だけに保持する。
 * @precondition Callerが元Operationと実Executorからのhandoffを保持している。
 * @postcondition 清掃事実と各成功分は待機前に反映し、後続失敗で巻き戻さない。
 * @effect 既存Host清掃と同じEMの完成保存だけ。
 * @failure 欠測・対象漏れ・重複・別Host・別結果では清掃前に停止する。
 * @invariant 新Store・Hook群・自動再試行・AI再送を設けない。
 * @boundary 元Host Owner、現在EM、同じ技術完了結果。
 * @security 進捗値や通知の成功をAuthorityとせず、任意Pathを受けない。
 * @concurrency 全Stageの準備後だけ清掃し、成功対象の退役後にI/Oへ返す。
 */
export async function completeRuntimeOwnedHostOperation(
  target: HostCompletionTarget,
) {
  let hostCleanup: "completed" | "protocol_failure_cleanup_confirmed" | null =
    null;
  let recoveryId: string | null = null;
  const stop = (
    stage: "intent" | "handoff" | "cleanup" | "receipt" | "finalization",
    error?: unknown,
  ) =>
    Object.freeze({
      status: "blocked" as const,
      stage,
      recoveryId,
      hostCleanup,
      error,
    });
  try {
    const pending = target.dockerHandoffs.filter(
      (handoff) => handoff.state !== "finalized",
    );
    const pendingIds = new Set(pending.map((handoff) => handoff.recoveryId));
    if (
      pendingIds.size !== pending.length ||
      new Set(pending.map((handoff) => handoff.capability)).size !==
        pending.length
    )
      return stop("intent");
    for (const handoff of pending) {
      recoveryId = handoff.recoveryId;
      const record = durableRecord(handoff.capability);
      if (
        handoff.state !== "finalizable" ||
        handoff.dockerCompletion === undefined
      )
        return stop("handoff");
      if (
        !record?.terminalObservation ||
        record.managementCapability !== target.managementCapability ||
        record.recoveryId !== handoff.recoveryId ||
        record.dockerCompletion !== handoff.dockerCompletion
      )
        return stop("intent");
    }
    if (!target.hostCleanupCompleted) {
      if (!target.ownedOperation) return stop("intent");
      const current =
        pending.length > 0
          ? readState(operationStateInput(target.managementCapability), {
              scope: "operation",
            })
          : null;
      const snapshot = current
        ? current.value?.snapshot
        : readOwnedHostOperation(target.managementCapability).snapshot;
      const host = snapshot?.operations.find(
        (operation) =>
          operation.kind === "host_operation" &&
          operation.recoveryId === target.hostRecoveryId,
      );
      if (
        (current !== null &&
          (current.status !== "completed" || !current.lockReleased)) ||
        host?.kind !== "host_operation" ||
        host.phase !== "active" ||
        getOwnedHostRecoveryId(target.ownedOperation) !== host.recoveryId
      )
        return stop("intent");
      const operations =
        snapshot?.operations.filter(
          (operation) =>
            operation.kind === "docker_task" &&
            JSON.parse(operation.identityJson).operationId === host.operationId,
        ) ?? [];
      if (
        operations.length !== pending.length ||
        operations.some((operation) => !pendingIds.delete(operation.recoveryId))
      )
        return stop("intent");
      const states = new Map(
        current?.value?.operationStates.map((state) => [
          state.operation.recoveryId,
          state,
        ]),
      );
      // 実Hostの現在性確認は試行ごとに繰り返さない。物理清掃側でも再確認する。
      const first = pending[0];
      for (const handoff of pending) {
        recoveryId = handoff.recoveryId;
        const record = durableRecord(handoff.capability);
        if (
          record?.operationId !== host.operationId ||
          !canPrepareRuntimeOwnedDockerHostCleanup(
            handoff.capability,
            states.get(handoff.recoveryId),
          )
        )
          return stop("intent");
      }
      if (first) {
        const last = recoveryId;
        recoveryId = first.recoveryId;
        const fresh = readOwnedHostOperation(target.managementCapability);
        if (
          fresh.record.operationId !== host.operationId ||
          fresh.record.phase !== "active" ||
          fresh.record.recoveryId !== host.recoveryId ||
          fresh.payloadSha256 !== current?.value?.payloadSha256
        )
          return stop("intent");
        recoveryId = last;
      }
      const outcome = cleanupOwnedOperationDirectories(target.ownedOperation);
      hostCleanup = verifyOwnedOperationCleanupOutcome(
        outcome,
        target.ownedOperation,
      );
      if (!hostCleanup) return stop("cleanup");
      for (const handoff of pending) {
        const record = durableRecord(handoff.capability);
        if (record) record.hostCleanupOutcome = outcome;
      }
      target.hostCleanupCompleted = true;
      target.ownedOperation = null;
      target.hostRecoveryId = null;
    } else {
      if (pending.length === 0) return stop("intent");
      const outcome = durableRecord(pending[0]?.capability)?.hostCleanupOutcome;
      hostCleanup = verifyOwnedOperationCleanupOutcome(outcome);
      if (
        !hostCleanup ||
        pending.some(
          (handoff) =>
            durableRecord(handoff.capability)?.hostCleanupOutcome !== outcome,
        )
      )
        return stop("cleanup");
    }
    for (const handoff of pending) {
      recoveryId = handoff.recoveryId;
      const outcome = durableRecord(handoff.capability)?.hostCleanupOutcome;
      const finished = finishRuntimeOwnedDockerRecovery(
        handoff.capability,
        Object.freeze({
          hostCleanupOutcome: outcome,
          dockerCompletion: handoff.dockerCompletion,
        }),
      );
      if (finished.status !== "completed") return stop(finished.stage);
      handoff.state = "finalized";
      await setImmediate();
    }
    return Object.freeze({
      status: "completed" as const,
      stage: "finalization" as const,
      recoveryId: null,
      hostCleanup,
      error: undefined,
    });
  } catch (error) {
    return stop("cleanup", error);
  }
}

/**
 * abandon Runtime 所有 Docker 回復を決定する。
 *
 * @responsibility abandon Runtime 所有 Docker 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryCapability: unknown
 * @returns abandonRuntimeOwnedDockerRecoveryの計算結果を返す。
 * @precondition 「recoveryCapability: unknown」がabandonRuntimeOwnedDockerRecoveryの入力契約を満たす。
 * @postcondition abandonRuntimeOwnedDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: abandonRuntimeOwnedDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: abandonRuntimeOwnedDockerRecoveryは独自の失敗分岐を所有しない。
 * @invariant abandonRuntimeOwnedDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: abandonRuntimeOwnedDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security abandonRuntimeOwnedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: abandonRuntimeOwnedDockerRecoveryは共有非同期状態を持たない同期処理である。
 */
export function abandonRuntimeOwnedDockerRecovery(recoveryCapability: unknown) {
  const record = durableRecord(recoveryCapability, false);
  if (!record) return false;
  return record.homeLeaseReleased;
}

/**
 * Executorが完了した技術的な終了を元Taskの記録へ反映する。
 * @responsibility 実Home解放を再実行せず、結果保存・Host記録・Lifecycle保存だけを行う。
 * @trace ARCH-000008
 * @input 元操作・回復参照、資源観測、Grant借用終了結果とHome実解放結果。
 * @returns 技術的な終了事実と耐久確定を区別した保存結果。
 * @precondition 技術的な解放はExecutorが先に試行している。
 * @postcondition 保存拒否でも受領済みの実解放事実を取り消さない。
 * @effect 既存recordへの観測結合と、Domain／Host記録の保存。
 * @failure 保存拒否ではTaskを成功にせず、exact回復参照を保持する。
 * @invariant Handleのrelease・Docker操作を呼ばない。
 * @boundary Executorの技術生涯とCoordinatorの保存・Task進行。
 */
export function recordRuntimeOwnedAttemptCleanup(
  input: AttemptCleanupInput & Readonly<{ plan: RecoveryPlan }>,
): ResourceCleanupResult {
  const {
    plan,
    recoveryCapability,
    managementCapability,
    recoveryId,
    observations,
    homeLeaseReleased,
  } = input;
  let recoveryCompleted = false;
  let recoveryFinalizationCapability: object | null = null;
  const record = durableRecord(recoveryCapability, false);
  if (
    !record ||
    record.managementCapability !== managementCapability ||
    record.operationId !== plan.operationId ||
    record.recoveryId !== recoveryId
  )
    return Object.freeze({
      homeLeaseReleased,
      recoveryCompleted,
      recoveryFinalizationCapability,
    });
  if (homeLeaseReleased) {
    record.homeLeaseReleased = true;
    if (!record.initializationReady)
      record.initializationLeaseReleaseConfirmed = true;
  }
  try {
    if (
      recordRuntimeOwnedDockerAbsence(recoveryCapability, {
        snapshot: input.resourceSnapshot,
        observations,
      }) !== true
    )
      throw new Error("docker_absence_record_failed");
    if (homeLeaseReleased) {
      const completion = completeRuntimeOwnedDockerRecovery(
        recoveryCapability,
        managementCapability,
        plan,
      );
      if (
        completion.status === "completed" &&
        completion.recoveryFinalizationCapability &&
        typeof completion.recoveryFinalizationCapability === "object"
      ) {
        recoveryCompleted = true;
        recoveryFinalizationCapability =
          completion.recoveryFinalizationCapability;
      }
    }
  } catch {
    recoveryCompleted = false;
    recoveryFinalizationCapability = null;
  }
  return Object.freeze({
    homeLeaseReleased,
    recoveryCompleted,
    recoveryFinalizationCapability,
  });
}

/**
 * Executorの完了結果が返す検査済み所見を参照する。
 * @responsibility 上下位で所見構造を重複定義しない。
 * @trace ARCH-000015
 * @shape CompletionResultのreviewFindings。
 * @invariant 内容検査の成立を型付けだけから推定しない。
 * @boundary 実行Ownerと次試行許可Owner。
 * @security 本文は公開結果や保存診断に複製しない。
 * @compatibility Executorの完了結果型へ追従する。
 */
type ReviewFindings = NonNullable<
  CompletionResult<"attempt">["reviewFindings"]
>;

const reviewRemediations = new WeakMap<
  object,
  Readonly<{
    operationId: string;
    reviewAttempt: 0 | 1;
    findings: ReviewFindings;
  }>
>();

/**
 * 初回レビューの所見を同じTaskの次試行へ結合する。
 * @responsibility 次試行許可の一実体を既存の一回使用Mapに保持する。
 * @trace ARCH-000015
 * @input operationId、reviewAttempt、固定実行Ownerが検査したfindings。
 * @returns 同じMapに登録した参照又はnull。
 * @precondition 呼出し元は元操作と復帰済み試行の相関を確認している。
 * @postcondition 初回レビュー・非空所見以外へ許可を発行しない。
 * @effect Process内の一回使用Mapへの登録。
 * @failure 対象外はnull。自動再発行しない。
 * @invariant 許可の登録だけで次Taskを開始しない。
 * @boundary Coordinatorの次試行許可内部。Root非公開。
 * @security 所見を送信する際の同意・Path・秘密検査を省略しない。
 * @concurrency 登録と参照生成は同じ同期呼出しで完結する。
 */
export function registerTaskRemediation(
  operationId: string,
  reviewAttempt: 0 | 1,
  findings: ReviewFindings,
) {
  if (!operationId || reviewAttempt !== 0 || findings.length === 0) return null;
  const capability = Object.freeze({});
  reviewRemediations.set(
    capability,
    Object.freeze({ operationId, reviewAttempt, findings }),
  );
  return capability;
}

/**
 * 初回レビューの是正所見を同じTaskへ一回だけ渡す。
 * @responsibility コピー・別操作・消費済み参照を拒否する。
 * @trace ARCH-000015
 * @input capability: 元参照、operationId: 次試行の操作。
 * @returns 消費済み所見又はnull。
 * @precondition 呼出し元がexecutor attempt 1の条件を検査する。
 * @postcondition 正常時は返却前に元登録を削除する。
 * @effect Process内の一回使用Mapからの削除。
 * @failure 不一致はnullで元登録を消費しない。
 * @invariant 次試行のAuthority・同意を代行しない。
 * @boundary Task Packet構築内部。Root非公開。
 * @security 未信頼所見の再検査を省略しない。
 * @concurrency 照合と削除は一つの同期処理。
 */
export function consumeTaskRemediation(
  capability: unknown,
  operationId: string,
) {
  if (!capability || typeof capability !== "object") return null;
  const record = reviewRemediations.get(capability);
  if (
    !record ||
    record.operationId !== operationId ||
    record.reviewAttempt !== 0
  )
    return null;
  reviewRemediations.delete(capability);
  return Object.freeze({
    status: "consumed" as const,
    findings: record.findings,
    findingCount: record.findings.length,
    untrustedProviderTextReported: false as const,
  });
}
