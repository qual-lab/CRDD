/**
 * 読取り助言とWorkspace編集の単発依頼を所有する。
 * @responsibility 同じ保存・Leaseへ受付を結合し、本文はProcess内だけに保つ。
 * @trace ARCH-000004
 * @trace ARCH-000015
 */

import { createHash, randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { getAiModelCatalog } from "../../../ai-adapter/src/index.ts";
import type { AiSelectionChoice } from "../../../domain-model/src/index.ts";
import {
  type ExecutionSelection,
  initializeCoordinatorSnapshot,
  inspectExecutionSelection,
  inspectSingleTaskRecord,
  inspectTaskExecutionSelections,
  normalizeRepositoryRelativePath,
  observeRuntimeOwnedTransientTaskCompletion,
  type ProjectQueueEntry,
  readCoordinatorTaskIntakeState,
  readRepositoryAiSelection,
  type SingleTaskRecord,
  snapshotRuntimeStateArray as snapshotPlainArray,
  snapshotRuntimeStateRecord as snapshotPlainRecord,
  type TaskExecutionSelections,
} from "../../../domain-model/src/index.ts";
import {
  gitRepositoryRevisionAdapter,
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  recoverProviderAdviceHostOperation,
  runRepositoryAdvice,
} from "../execution/advice.ts";
import { readExecutionCancellation } from "../execution/authority.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  runCoordinatorSingleTaskAttempt,
  startRuntimeOwnedCoordinatorTask,
} from "../execution/controller.ts";
import { observeLeaseOwner } from "../execution/kernel-lock.ts";
import {
  acquireCoordinatorSnapshotLease,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
} from "../execution/lease.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import {
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedDockerTaskCurrentCorrelations,
} from "../execution/recovery.ts";

import {
  resolveExecutionSelection,
  resolveTaskExecutionSelections,
} from "../selection/resolve.ts";
import {
  hashExecutionSelection,
  inspectAiSelectionChoice,
} from "../../../domain-model/src/index.ts";
import type { CoordinatorLeaseOwnerObservation } from "../state/persistence.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/validation.ts";
import { resolveCoordinatorWorkspaceTaskTarget } from "../workspace/operations.ts";
import {
  closeUnstartedCoordinatorSingleTask,
  createCoordinatorSnapshotStatePort,
  enqueueCoordinatorSingleTask,
  updateCoordinatorSingleTask,
} from "./queue.ts";

/**
 * 単発操作の非永続入力。
 * @responsibility 明示mode、固定選定、対象と本文を一要求に固定する。
 * @trace ARCH-000004
 * @shape 固定Context参照、作業指示、対象Workspace、送信確認。
 * @invariant 同意を固定選定選択や保存成功から推定しない。
 * @boundary 公開Surfaceから単発Owner。
 * @security Promptは保存しない。
 * @compatibility 旧change_candidate／Bundle入力は受理しない。
 */
export type SingleTaskCommand = Readonly<{
  mode: SingleTaskRecord["mode"];
  workType: string | null;
  choice?: AiSelectionChoice;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
  expectedNetworkPolicyHash: string;
  workspaceId: string | null;
}>;

/**
 * 下位実行から返す用途別結果。
 * @responsibility 助言と編集の結果を混合せずcleanupを独立保持する。
 * @trace ARCH-000004
 * @shape mode、終端、回復参照、四分類又はWorkspace観測。
 * @invariant Task成功から採用・Commitを推定しない。
 * @boundary 同Processの実行Adapter。
 * @security 回答はSnapshotへ保存しない。
 * @compatibility 下位Runtimeの失敗・回復を維持する。
 */
export type SingleTaskOutcome = Readonly<{
  mode: SingleTaskRecord["mode"];
  status: "completed" | "blocked" | "cancelled" | "unknown";
  reason: string | null;
  cleanupConfirmed: boolean;
  recoveryIds: readonly string[];
  advice: Readonly<
    Record<
      "facts" | "sharedAnalysis" | "additionalInferences" | "nextOptions",
      readonly Readonly<{ text: string; references: readonly string[] }>[]
    >
  > | null;
  workspaceResult: CoordinatorWorkspaceResult | null;
}>;

/**
 * 検証済み入力と同じ実行IdentityをAdapterへ渡す。
 * @responsibility 実行先を永続Owner側で確定する。
 * @trace ARCH-000004
 * @shape Task参照、Revision、読戻したWorkspace対象。
 * @invariant 任意絶対Pathを公開入力から受けない。
 * @boundary Coordinatorから下位実行。
 * @security 認可関数や資格を保存しない。
 * @compatibility 既存Single Task Adapterへの最小結合。
 */
export type SingleTaskExecution = Readonly<{
  record: SingleTaskRecord;
  taskExecutionSelections: TaskExecutionSelections | null;
  repositoryRevision: string;
  target: Readonly<{
    workspaceId: string | null;
    ownerRepositoryRoot: string;
    executionTree: string;
    baseCommit: string | null;
    head: string | null;
  }>;
}>;

/**
 * 公開要求をgetter／Proxyなしで固定する。
 * @responsibility 旧Bundle入力と暗黙Context読取りを拒否する。
 * @trace ARCH-000004
 * @input 未信頼要求。
 * @returns 検証済み要求又はnull。
 * @precondition 認可は別途現在値で評価する。
 * @postcondition 配列と本文は独立Snapshot。
 * @effect なし。
 * @failure 不正・不足・過剰は拒否。
 * @invariant 送信確認なしでは実行しない。
 * @boundary Surface入力。
 * @security 本文をlogへ出力しない。
 * @concurrency 同期検査。
 */
export function inspectSingleTaskCommand(
  raw: unknown,
): SingleTaskCommand | null {
  const keys = [
    "mode",
    "workType",
    "prompt",
    "contextReferences",
    "allowedPaths",
    "externalSendConfirmed",
    "expectedNetworkPolicyHash",
    "workspaceId",
  ];
  const r =
    snapshotPlainRecord(raw, new Set([...keys, "choice"])) ??
    snapshotPlainRecord(raw, new Set(keys));
  const refs = snapshotPlainArray<string>(r?.contextReferences, 1);
  const paths = snapshotPlainArray<string>(r?.allowedPaths, 1024);
  if (
    !r ||
    Object.keys(r).length !== 8 + (Object.hasOwn(r, "choice") ? 1 : 0) ||
    typeof r.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(r.mode) ||
    !(
      r.workType === null ||
      (typeof r.workType === "string" &&
        /^[a-z0-9][a-z0-9._-]*$/u.test(r.workType))
    ) ||
    (Object.hasOwn(r, "choice") && !inspectAiSelectionChoice(r.choice)) ||
    typeof r.prompt !== "string" ||
    r.prompt.trim().length === 0 ||
    r.prompt.length > 32000 ||
    r.externalSendConfirmed !== true ||
    typeof r.expectedNetworkPolicyHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(r.expectedNetworkPolicyHash) ||
    refs.status !== "ok" ||
    refs.value.length !== 1 ||
    refs.value[0] !== "PROJECT_CONTEXT.md" ||
    paths.status !== "ok" ||
    paths.value.some(
      (p) => typeof p !== "string" || normalizeRepositoryRelativePath(p) !== p,
    ) ||
    new Set(paths.value).size !== paths.value.length ||
    (r.mode === "read_only_advice"
      ? paths.value.length !== 0
      : paths.value.length === 0) ||
    !(
      r.workspaceId === null ||
      (typeof r.workspaceId === "string" &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(r.workspaceId))
    ) ||
    (r.mode === "read_only_advice" && r.workspaceId !== null)
  )
    return null;
  return Object.freeze({
    ...r,
    contextReferences: refs.value,
    allowedPaths: paths.value,
    ...(Object.hasOwn(r, "choice")
      ? { choice: inspectAiSelectionChoice(r.choice) }
      : {}),
  }) as SingleTaskCommand;
}

/**
 * 単発依頼の開始・観測・取消を同じTaskへ結合する。
 * @responsibility 受付保存前のEffect 0、取消join、非永続本文を所有する。
 * @trace ARCH-000004
 * @input 検証済みRootと現在認可、受付時の選定解決、二つの既存実行Adapter。
 * @returns 開始・観測・取消・終了のProcess内Owner。
 * @precondition Snapshot初期化は別の明示操作で完了している。
 * @postcondition 本文喪失時は再実行せず元IDの欠測を返す。
 * @effect 既存Writer、Lease、注入した実行だけ。
 * @failure 保存・固定選定・認可・観測不能は停止し元IDを維持する。
 * @invariant 新Registry・Lock・保存先・Merge・採用を追加しない。
 * @boundary 公開Surfaceと単発実行。
 * @security 主体を固定し観測・取消時も現在認可する。
 * @concurrency 同時実行は既存Lease、取消・closeは元Promiseをjoinする。
 */
export function createCoordinatorTaskRequests(
  deps: Readonly<{
    root: string;
    binding: string;
    projectId: string;
    principalId: string;
    authorize: () => boolean;
    resolveSelection: (command: SingleTaskCommand) => Readonly<{
      primary: ExecutionSelection;
      taskExecutionSelections: TaskExecutionSelections | null;
    }> | null;
    observeRevision: () => string | null;
    observeLeaseOwner?: CoordinatorLeaseOwnerObservation;
    recover?: (record: SingleTaskRecord) => Promise<
      Readonly<{
        cleanupConfirmed: boolean;
        recoveryIds: readonly string[];
        reason: string;
      }>
    >;
    execute: (
      command: SingleTaskCommand,
      execution: SingleTaskExecution,
      signal: AbortSignal,
      started: () => Promise<void>,
      operationCreated: (
        operation: NonNullable<SingleTaskRecord["adviceOperation"]>,
      ) => Promise<void>,
    ) => Promise<SingleTaskOutcome>;
  }>,
) {
  const requests = new Map<
    string,
    {
      controller: AbortController;
      pending: Promise<void>;
      snapshot: ReturnType<typeof view>;
    }
  >();
  let closing = false;
  const authorized = () => {
    try {
      return deps.authorize() === true;
    } catch {
      return false;
    }
  };
  const ports = (epoch: string) =>
    createCoordinatorSnapshotStatePort(deps.root, deps.binding, epoch);
  const recoverRecord = async (requestId: string) => {
    const current = readCoordinatorTaskIntakeState(
      verifyRuntimePersistenceRepository(deps.root),
      deps.binding,
    );
    const queue =
      current.status === "completed"
        ? current.value?.queueEntries.find(
            (entry) =>
              entry.queueId === requestId &&
              entry.projectId === deps.projectId &&
              entry.singleTask?.principalId === deps.principalId,
          )
        : null;
    if (
      !queue?.singleTask ||
      !deps.recover ||
      !deps.observeLeaseOwner ||
      !current.value
    )
      return view(
        requestId,
        queue?.singleTask ?? null,
        "unknown",
        "orchestrator_task_body_unavailable",
      );
    if (
      queue.singleTask.phase === "settled" &&
      queue.singleTask.cleanupConfirmed &&
      queue.singleTask.recoveryIds.length === 0 &&
      queue.ownerGeneration === null &&
      !current.value.leaseIntents.some((entry) => entry.queueId === requestId)
    )
      return view(
        requestId,
        queue.singleTask,
        "unknown",
        "orchestrator_task_body_unavailable",
      );
    const reconciled = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      deps.root,
      deps.binding,
      deps.projectId,
      requestId,
      "project-operation",
      deps.observeLeaseOwner,
    );
    if (
      reconciled.status !== "completed" ||
      !reconciled.value.queue?.singleTask
    )
      return {
        ...view(
          requestId,
          queue.singleTask,
          "unknown",
          "orchestrator_task_body_unavailable",
        ),
        recoveryIds: [
          ...new Set([
            ...queue.singleTask.recoveryIds,
            ...(reconciled.status !== "completed" && reconciled.recoveryId
              ? [reconciled.recoveryId]
              : []),
          ]),
        ],
        secondaryFailures: [reconciled.reason],
      };
    const observed = reconciled.value.queue;
    if (
      observed.singleTask?.phase === "settled" &&
      observed.singleTask.cleanupConfirmed &&
      observed.singleTask.recoveryIds.length === 0
    )
      return view(
        requestId,
        observed.singleTask,
        "unknown",
        "orchestrator_task_body_unavailable",
      );
    if (observed.singleTask?.phase === "accepted") {
      const closed = closeUnstartedCoordinatorSingleTask(
        deps.root,
        deps.binding,
        requestId,
        observed.generation,
        "orchestrator_task_not_started",
      );
      const result = view(
        requestId,
        closed.status === "completed"
          ? (closed.value.singleTask ?? null)
          : observed.singleTask,
        "unknown",
        "orchestrator_task_body_unavailable",
      );
      return closed.status === "completed"
        ? result
        : {
            ...result,
            recoveryIds: [
              ...new Set([
                ...result.recoveryIds,
                ...(closed.recoveryId ? [closed.recoveryId] : []),
              ]),
            ],
            secondaryFailures: [closed.reason],
          };
    }
    const acquired = acquireCoordinatorSnapshotLease(
      deps.root,
      deps.binding,
      deps.projectId,
      requestId,
      "project-operation",
    );
    if (acquired.status !== "completed")
      return {
        ...view(
          requestId,
          observed.singleTask ?? null,
          "unknown",
          "orchestrator_task_body_unavailable",
        ),
        recoveryIds: [
          ...new Set([
            ...(observed.singleTask?.recoveryIds ?? []),
            ...(acquired.recoveryId ? [acquired.recoveryId] : []),
          ]),
        ],
        secondaryFailures: [acquired.reason],
      };
    const lease = acquired.value;
    let savedQueue = observed;
    let result = view(
      requestId,
      observed.singleTask ?? null,
      "unknown",
      "orchestrator_task_body_unavailable",
    );
    try {
      const record = observed.singleTask;
      if (!record) return result;
      const recovery = await deps.recover(record);
      const next: SingleTaskRecord = {
        ...record,
        phase: "settled",
        status: record.status === "pending" ? "unknown" : record.status,
        reason:
          record.status === "pending"
            ? "orchestrator_task_owner_lost"
            : record.reason,
        cleanupConfirmed: recovery.cleanupConfirmed,
        recoveryIds: recovery.recoveryIds,
      };
      const saved = updateCoordinatorSingleTask(
        deps.root,
        deps.binding,
        requestId,
        observed.generation,
        lease,
        next,
      );
      if (saved.status === "completed") savedQueue = saved.value;
      result = {
        ...view(
          requestId,
          next,
          "unknown",
          "orchestrator_task_body_unavailable",
        ),
        recoveryIds:
          saved.status === "completed"
            ? next.recoveryIds
            : [
                ...new Set([
                  ...record.recoveryIds,
                  ...next.recoveryIds,
                  ...(saved.recoveryId ? [saved.recoveryId] : []),
                ]),
              ],
        secondaryFailures: saved.status === "completed" ? [] : [saved.reason],
      };
    } catch {
      result = {
        ...result,
        secondaryFailures: [
          ...result.secondaryFailures,
          "orchestrator_task_recovery_unconfirmed",
        ],
      };
    } finally {
      const release = lease.release();
      const settled =
        release.status === "completed"
          ? ports(current.value.intakeEpoch).settleQueueLeaseRelease(
              requestId,
              savedQueue.generation,
              lease.ownerGeneration,
            )
          : release;
      if (settled.status !== "completed")
        result = {
          ...result,
          recoveryIds: [
            ...new Set([
              ...result.recoveryIds,
              ...(settled.recoveryId ? [settled.recoveryId] : []),
            ]),
          ],
          secondaryFailures: [
            ...result.secondaryFailures,
            settled.reason,
            "orchestrator_task_lease_release_unconfirmed",
          ],
        };
    }
    return authorized()
      ? result
      : view(requestId, null, "unknown", "orchestrator_task_not_available");
  };
  const recoverSaved = async (requestId: string) => {
    const result = await recoverRecord(requestId);
    const item = requests.get(requestId);
    if (item && authorized()) item.snapshot = result;
    return result;
  };
  return Object.freeze({
    async start(raw: unknown, signal?: AbortSignal) {
      const command = inspectSingleTaskCommand(raw);
      if (!command || closing || signal?.aborted || !authorized())
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "orchestrator_task_request_rejected",
        };
      if (
        [...requests.values()].some((item) =>
          ["accepted", "running"].includes(item.snapshot.status),
        )
      )
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "orchestrator_task_request_active",
        };
      // 現在Sessionの本文は最大100件。実行中の依頼を追出さない。
      for (const [id, item] of requests)
        if (
          requests.size >= 100 &&
          !["accepted", "running"].includes(item.snapshot.status)
        )
          requests.delete(id);
      if (requests.size >= 100)
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "orchestrator_task_session_capacity",
        };
      let current = readCoordinatorTaskIntakeState(
        verifyRuntimePersistenceRepository(deps.root),
        deps.binding,
      );
      if (
        current.status === "completed" &&
        current.value &&
        deps.recover &&
        deps.observeLeaseOwner
      ) {
        for (const queue of current.value.queueEntries) {
          const record = queue.singleTask;
          if (
            queue.projectId !== deps.projectId ||
            record?.principalId !== deps.principalId ||
            (record.phase === "settled" &&
              record.cleanupConfirmed &&
              record.recoveryIds.length === 0 &&
              queue.ownerGeneration === null &&
              !current.value.leaseIntents.some(
                (entry) => entry.queueId === queue.queueId,
              ))
          )
            continue;
          const item = requests.get(queue.queueId);
          if (item) await item.pending;
          const recovered = await recoverSaved(queue.queueId);
          if (!authorized())
            return {
              status: "blocked" as const,
              requestId: null,
              reason: "orchestrator_task_request_rejected",
            };
          if (
            !recovered.cleanupConfirmed ||
            recovered.recoveryIds.length ||
            recovered.secondaryFailures.length
          )
            return {
              status: "blocked" as const,
              requestId: queue.queueId,
              reason: "orchestrator_task_previous_cleanup_unconfirmed",
            };
        }
        current = readCoordinatorTaskIntakeState(
          verifyRuntimePersistenceRepository(deps.root),
          deps.binding,
        );
      }
      const selection = deps.resolveSelection(command);
      const primary = inspectExecutionSelection(selection?.primary);
      const pair = inspectTaskExecutionSelections(
        selection?.taskExecutionSelections,
      );
      const revision = deps.observeRevision();
      if (
        closing ||
        !authorized() ||
        [...requests.values()].some((item) =>
          ["accepted", "running"].includes(item.snapshot.status),
        )
      )
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "orchestrator_task_request_active",
        };
      if (
        current.status !== "completed" ||
        !current.value ||
        !primary ||
        primary.role !==
          (command.mode === "read_only_advice" ? "advice" : "executor") ||
        (command.mode === "workspace_edit" &&
          (!pair ||
            hashExecutionSelection(pair.executor) !==
              hashExecutionSelection(primary))) ||
        !revision
      )
        return {
          status: "blocked" as const,
          requestId: null,
          reason: "orchestrator_task_configuration_unavailable",
        };
      const requestId = `request-${randomUUID()}`;
      const intakeEpoch = current.value.intakeEpoch;
      const record: SingleTaskRecord = {
        principalId: deps.principalId,
        mode: command.mode,
        executionSelection: primary,
        taskId: `task-${randomUUID()}`,
        attemptId: `attempt-${randomUUID()}`,
        operationId: `operation-${randomUUID()}`,
        phase: "accepted",
        status: "pending",
        reason: null,
        cleanupConfirmed: false,
        recoveryIds: [],
      };
      const hash = (value: unknown) =>
        createHash("sha256").update(JSON.stringify(value)).digest("hex");
      let queue: ProjectQueueEntry = {
        queueId: requestId,
        projectId: deps.projectId,
        milestoneId: null,
        requestHash: hash(command),
        originLane: "interactive",
        repositoryRevision: revision,
        scopeHash: hash([
          command.mode,
          command.workspaceId,
          command.allowedPaths,
        ]),
        state: "queued",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
        workspaceId: command.workspaceId,
        singleTask: record,
      };
      const saved = enqueueCoordinatorSingleTask(
        deps.root,
        deps.binding,
        current.value.intakeEpoch,
        queue,
      );
      if (saved.status !== "completed")
        return {
          status: "blocked" as const,
          requestId: null,
          reason: saved.reason,
        };
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) controller.abort();
      const item = {
        controller,
        pending: Promise.resolve(),
        snapshot: view(requestId, record, "accepted", null),
      };
      requests.set(requestId, item);
      item.pending = (async () => {
        // 耐久受付と実行準備を分離する。取消・closeは同じpendingをjoinする。
        // Signal付き待機や早期returnにせず、開始前取消も既存の終端保存へ通す。
        await setImmediate();
        const acquired = acquireCoordinatorSnapshotLease(
          deps.root,
          deps.binding,
          deps.projectId,
          requestId,
          "project-operation",
        );
        if (acquired.status !== "completed") {
          const closed = closeUnstartedCoordinatorSingleTask(
            deps.root,
            deps.binding,
            requestId,
            queue.generation,
            acquired.reason,
          );
          const savedRecord =
            closed.status === "completed"
              ? (closed.value.singleTask ?? record)
              : record;
          item.snapshot = {
            ...view(
              requestId,
              savedRecord,
              closed.status === "completed" ? "blocked" : "unknown",
              acquired.reason,
            ),
            recoveryIds: [
              ...new Set([
                ...savedRecord.recoveryIds,
                ...(acquired.recoveryId ? [acquired.recoveryId] : []),
                ...(closed.status !== "completed" && closed.recoveryId
                  ? [closed.recoveryId]
                  : []),
              ]),
            ],
            secondaryFailures:
              closed.status === "completed" ? [] : [closed.reason],
          };
          return;
        }
        const lease = acquired.value;
        let phase = record;
        let createdOperation: SingleTaskRecord["adviceOperation"];
        let outcomeForFailure: SingleTaskOutcome | null = null;
        const secondaryFailures: string[] = [];
        const storeRecoveryIds = new Set<string>();
        const save = (next: SingleTaskRecord) => {
          const result = updateCoordinatorSingleTask(
            deps.root,
            deps.binding,
            requestId,
            queue.generation,
            lease,
            next,
          );
          if (result.status !== "completed") {
            secondaryFailures.push(result.reason);
            if (result.recoveryId) storeRecoveryIds.add(result.recoveryId);
            return false;
          }
          queue = result.value;
          phase = next;
          return true;
        };
        try {
          if (!save({ ...record, phase: "starting" })) {
            item.snapshot = view(
              requestId,
              record,
              "unknown",
              "orchestrator_task_start_save_unconfirmed",
            );
            return;
          }
          const target = resolveCoordinatorWorkspaceTaskTarget(
            deps.root,
            deps.binding,
            requestId,
          );
          if (
            target.status !== "completed" ||
            !authorized() ||
            controller.signal.aborted
          ) {
            const next = {
              ...phase,
              phase: "settled" as const,
              status: controller.signal.aborted
                ? ("cancelled" as const)
                : ("blocked" as const),
              reason:
                target.status !== "completed"
                  ? target.reason
                  : "orchestrator_task_not_started",
              cleanupConfirmed: true,
            };
            const confirmed = save(next);
            item.snapshot = view(
              requestId,
              next,
              confirmed ? next.status : "unknown",
              target.status !== "completed"
                ? target.reason
                : "orchestrator_task_not_started",
            );
            return;
          }
          item.snapshot = view(requestId, phase, "running", null);
          const rawOutcome = await deps.execute(
            command,
            {
              record,
              taskExecutionSelections: pair,
              repositoryRevision: revision,
              target: target.value,
            },
            controller.signal,
            async () => {
              if (
                !authorized() ||
                controller.signal.aborted ||
                !save({ ...phase, phase: "running" })
              )
                throw Error("task_start_save_unconfirmed");
            },
            async (operation) => {
              if (
                !authorized() ||
                controller.signal.aborted ||
                phase.adviceOperation ||
                phase.phase !== "starting"
              )
                throw Error("task_operation_save_unconfirmed");
              const candidate = inspectSingleTaskRecord({
                ...phase,
                adviceOperation: operation,
              });
              if (!candidate?.adviceOperation)
                throw Error("task_operation_save_unconfirmed");
              createdOperation = candidate.adviceOperation;
              if (!save(candidate))
                throw Error("task_operation_save_unconfirmed");
            },
          );
          const outcome = snapshotSingleTaskOutcome(
            rawOutcome,
            record.executionSelection,
          );
          if (!outcome) throw new Error("orchestrator_task_result_invalid");
          outcomeForFailure = outcome;
          const next = inspectSingleTaskRecord({
            ...phase,
            ...(createdOperation ? { adviceOperation: createdOperation } : {}),
            phase: "settled",
            status: outcome.status,
            reason: outcome.reason,
            cleanupConfirmed: outcome.cleanupConfirmed,
            recoveryIds: outcome.recoveryIds,
          });
          const workspaceResult =
            outcome.workspaceResult === null
              ? null
              : snapshotCoordinatorWorkspaceResult(outcome.workspaceResult);
          if (
            !next ||
            outcome.mode !== command.mode ||
            (command.mode === "read_only_advice" &&
              (outcome.workspaceResult !== null ||
                (outcome.advice === null && outcome.status === "completed"))) ||
            (command.mode === "workspace_edit" &&
              (outcome.advice !== null ||
                (outcome.status === "completed" &&
                  (!workspaceResult ||
                    workspaceResult.workspaceId !== command.workspaceId))))
          )
            throw new Error("orchestrator_task_result_invalid");
          const confirmed = save(next);
          item.snapshot = {
            ...view(
              requestId,
              next,
              confirmed && next.status !== "pending" ? next.status : "unknown",
              confirmed
                ? outcome.reason
                : "orchestrator_task_result_save_unconfirmed",
            ),
            ...(confirmed && outcome.advice ? outcome.advice : {}),
            workspaceResult: confirmed ? workspaceResult : null,
          };
        } catch {
          const unknown = {
            ...phase,
            ...(createdOperation ? { adviceOperation: createdOperation } : {}),
            phase: "settled" as const,
            status: "unknown" as const,
            reason:
              outcomeForFailure?.reason ??
              "orchestrator_task_execution_unconfirmed",
            cleanupConfirmed: outcomeForFailure?.cleanupConfirmed ?? false,
            recoveryIds: outcomeForFailure?.recoveryIds ?? phase.recoveryIds,
          };
          save(unknown);
          item.snapshot = view(requestId, unknown, "unknown", unknown.reason);
        } finally {
          const released = lease.release();
          const settled =
            released.status === "completed" &&
            queue.state !== "running" &&
            ports(intakeEpoch).settleQueueLeaseRelease(
              requestId,
              queue.generation,
              lease.ownerGeneration,
            ).status === "completed";
          if (!settled)
            item.snapshot = {
              ...item.snapshot,
              status: "unknown",
              secondaryFailures: [
                ...item.snapshot.secondaryFailures,
                "orchestrator_task_lease_release_unconfirmed",
              ],
            };
          item.snapshot = {
            ...item.snapshot,
            recoveryIds: [
              ...new Set([...item.snapshot.recoveryIds, ...storeRecoveryIds]),
            ],
            secondaryFailures: [
              ...item.snapshot.secondaryFailures,
              ...secondaryFailures,
            ],
          };
        }
      })().finally(() => signal?.removeEventListener("abort", abort));
      return { status: "accepted" as const, requestId, reason: null };
    },
    async observe(requestId: string) {
      if (!authorized())
        return view(
          requestId,
          null,
          "unknown",
          "orchestrator_task_not_available",
        );
      const item = requests.get(requestId);
      if (item) return item.snapshot;
      const current = readCoordinatorTaskIntakeState(
        verifyRuntimePersistenceRepository(deps.root),
        deps.binding,
      );
      const record =
        current.status === "completed"
          ? current.value?.queueEntries.find(
              (q) =>
                q.queueId === requestId &&
                q.projectId === deps.projectId &&
                q.singleTask?.principalId === deps.principalId,
            )?.singleTask
          : null;
      return view(
        requestId,
        record ?? null,
        "unknown",
        record
          ? "orchestrator_task_body_unavailable"
          : "orchestrator_task_not_available",
      );
    },
    async cancel(requestId: string) {
      if (!authorized())
        return view(
          requestId,
          null,
          "unknown",
          "orchestrator_task_not_available",
        );
      const item = requests.get(requestId);
      if (!item) return recoverSaved(requestId);
      if (["accepted", "running"].includes(item.snapshot.status))
        item.controller.abort();
      await item.pending;
      if (
        authorized() &&
        (item.snapshot.status === "unknown" ||
          !item.snapshot.cleanupConfirmed ||
          item.snapshot.recoveryIds.length ||
          item.snapshot.secondaryFailures.length)
      )
        return recoverSaved(requestId);
      return authorized()
        ? item.snapshot
        : view(requestId, null, "unknown", "orchestrator_task_not_available");
    },
    async wait(requestId: string) {
      const item = requests.get(requestId);
      if (!item || !authorized())
        return view(
          requestId,
          null,
          "unknown",
          "orchestrator_task_not_available",
        );
      await item.pending;
      return authorized()
        ? item.snapshot
        : view(requestId, null, "unknown", "orchestrator_task_not_available");
    },
    async close() {
      closing = true;
      for (const item of requests.values()) item.controller.abort();
      await Promise.all([...requests.values()].map((item) => item.pending));
      requests.clear();
    },
  });
}

/**
 * 本文欠測を空の正常回答と区別する公開初期値。
 * @responsibility 内部Pathや保存Bindingを公開しない。
 * @trace ARCH-000004
 * @input 依頼ID、記録、状態と固定理由。
 * @returns 非Authorityの表示値。
 * @precondition 上位で閲覧認可する。
 * @postcondition 候補採用・変更帰属を主張しない。公開・実行の両状態がcompletedなら成功理由はreasonだけへ残す。
 * @effect なし。
 * @failure 欠測はunknown。
 * @invariant 本文を永続化しない。
 * @boundary 表示投影。
 * @security 生Provider出力を返さない。
 * @concurrency 要求単位の値。
 */
function view(
  requestId: string,
  record: SingleTaskRecord | null,
  status:
    | "accepted"
    | "running"
    | "completed"
    | "blocked"
    | "cancelled"
    | "unknown",
  reason: string | null,
) {
  return {
    requestId,
    mode: record?.mode ?? null,
    executionSelection: record?.executionSelection ?? null,
    status,
    reason,
    taskId: record?.taskId ?? null,
    attemptId: record?.attemptId ?? null,
    operationId: record?.operationId ?? null,
    executionStatus: record?.status ?? null,
    primaryFailure:
      status === "completed" && record?.status === "completed"
        ? null
        : record
          ? record.reason
          : reason,
    cleanupConfirmed: record?.cleanupConfirmed ?? false,
    recoveryIds: record?.recoveryIds ?? [],
    secondaryFailures: [] as readonly string[],
    facts: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    sharedAnalysis: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    additionalInferences: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    nextOptions: [] as readonly Readonly<{
      text: string;
      references: readonly string[];
    }>[],
    candidate: null,
    workspaceResult: null as CoordinatorWorkspaceResult | null,
  };
}

/**
 * 実行結果を公開前に閉じた値へ固定する。
 * @responsibility getterやProvider由来の余剰値を結果投影へ流さない。
 * @trace ARCH-000004
 * @input 下位から受領した結果。
 * @returns 独立した許可fieldだけ、又はnull。
 * @precondition 実行の終了・回収は下位Ownerが報告する。
 * @postcondition 入力の後続変更から表示値を分離する。
 * @effect なし。
 * @failure 不正な本文区分・配列・Workspace結果は拒否する。
 * @invariant 空回答を正常な助言として捏造しない。
 * @boundary 実行Adapterと単発Owner。
 * @security 本文を永続化しない。
 * @concurrency 同期Snapshotだけ。
 */
function snapshotSingleTaskOutcome(
  raw: unknown,
  executionSelection: ExecutionSelection,
): SingleTaskOutcome | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "mode",
      "status",
      "reason",
      "cleanupConfirmed",
      "recoveryIds",
      "advice",
      "workspaceResult",
    ]),
  );
  if (!value) return null;
  const record = inspectSingleTaskRecord({
    principalId: "validation",
    mode: value.mode,
    executionSelection,
    taskId: "validation",
    attemptId: "validation",
    operationId: "validation",
    phase: "settled",
    status: value.status,
    reason: value.reason,
    cleanupConfirmed: value.cleanupConfirmed,
    recoveryIds: value.recoveryIds,
  });
  if (!record || record.status === "pending") return null;
  const workspaceResult =
    value.workspaceResult === null
      ? null
      : snapshotCoordinatorWorkspaceResult(value.workspaceResult);
  if (value.workspaceResult !== null && workspaceResult === null) return null;
  let advice: SingleTaskOutcome["advice"] = null;
  if (value.advice !== null) {
    const groups = snapshotPlainRecord(
      value.advice,
      new Set([
        "facts",
        "sharedAnalysis",
        "additionalInferences",
        "nextOptions",
      ]),
    );
    if (!groups) return null;
    const result: Record<
      string,
      readonly Readonly<{ text: string; references: readonly string[] }>[]
    > = {};
    for (const key of [
      "facts",
      "sharedAnalysis",
      "additionalInferences",
      "nextOptions",
    ]) {
      const items = snapshotPlainArray(groups[key as keyof typeof groups], 100);
      if (items.status !== "ok") return null;
      const rows = [];
      for (const item of items.value) {
        const row = snapshotPlainRecord(item, new Set(["text", "references"]));
        if (
          !row ||
          typeof row.text !== "string" ||
          row.text.length === 0 ||
          row.text.length > 32000
        )
          return null;
        const refs = snapshotPlainArray<string>(row.references, 100);
        if (
          refs.status !== "ok" ||
          refs.value.length === 0 ||
          refs.value.some(
            (ref) =>
              typeof ref !== "string" ||
              ref.length === 0 ||
              ref.length > 512 ||
              /[\r\n\0]/u.test(ref),
          )
        )
          return null;
        rows.push(Object.freeze({ text: row.text, references: refs.value }));
      }
      result[key] = Object.freeze(rows);
    }
    advice = Object.freeze(result) as NonNullable<SingleTaskOutcome["advice"]>;
  }
  return Object.freeze({
    mode: record.mode,
    status: record.status,
    reason: record.reason,
    cleanupConfirmed: record.cleanupConfirmed,
    recoveryIds: record.recoveryIds,
    advice,
    workspaceResult,
  });
}

/**
 * Repositoryと認可済み主体に固定した単発受付を構成する。
 * @responsibility 固定選定の搬送、用途別実行、cleanupの結果搬送。
 * @trace ARCH-000004
 * @input 検証済みRoot、実Project／主体、現在認可と任意の利用側種別。
 * @returns 既存Writerへ接続する開始・観測・取消Owner。
 * @precondition 検証済みRepository内で既存Snapshotを準備できる。
 * @postcondition 編集は借用Workspace、助言は固定Contextだけを使用する。
 * @effect 構築時に既存Snapshotを初期化・確認する。明示開始時だけ外部Providerを利用する。
 * @failure 固定選定相関・Root・認可が変われば外部Effect前に停止。
 * @invariant 自動Commit・Candidate固定・Merge・Promotionを行わない。
 * @boundary 公開Task OwnerとCoordinator技術Runtime。
 * @security Prompt・Context・助言本文は永続化しない。
 * @concurrency 各要求が独立した実行閉包と取消Signalを持つ。
 */
export function openTaskSession(context: TaskSessionContext) {
  const { rootCapability, projectId, principalId, authorize } = context;
  const consumer = context.consumer ?? "workbench";
  const root = resolveVerifiedRepositoryRoot(rootCapability);
  if (root === null) throw new Error("orchestrator_task_root_invalid");
  const initialized = initializeCoordinatorSnapshot(
    verifyRuntimePersistenceRepository(root),
    deriveCoordinatorRepositoryBindingId(root),
  );
  if (initialized.status !== "completed")
    throw new Error("orchestrator_task_state_initialization_blocked");
  return createCoordinatorTaskRequests({
    root,
    binding: deriveCoordinatorRepositoryBindingId(root),
    projectId,
    principalId,
    authorize,
    observeLeaseOwner,
    recover: async (record) => {
      const observed = resolveRuntimeOwnedDockerTaskCurrentCorrelations(
        [record.operationId],
        rootCapability,
        consumer,
      );
      if (observed.status !== "completed")
        return {
          cleanupConfirmed: false,
          recoveryIds: record.recoveryIds,
          reason: observed.reason,
        };
      const unresolved = new Set(record.recoveryIds);
      for (const entry of observed.bindings) {
        const result = await recoverRuntimeOwnedDockerTaskForCurrentConsumer(
          entry.recoveryId,
          rootCapability,
        );
        if (result.status !== "recovered" || !result.taskRecoveryCompleted) {
          unresolved.add(entry.recoveryId);
          return {
            cleanupConfirmed: false,
            recoveryIds: [...unresolved],
            reason: result.reason,
          };
        }
        unresolved.delete(entry.recoveryId);
      }
      for (const recoveryId of unresolved) {
        if (
          recoveryId.startsWith("docker-task.") &&
          observeRuntimeOwnedTransientTaskCompletion(
            rootCapability,
            recoveryId,
            record.operationId,
            consumer,
          ).completionConfirmed
        )
          unresolved.delete(recoveryId);
      }
      const hostId =
        record.adviceOperation?.hostRecoveryId ??
        record.recoveryIds.find((id) => id.startsWith("host."));
      if (hostId) {
        const host = recoverProviderAdviceHostOperation(hostId);
        if (!host.cleanupConfirmed) {
          unresolved.add(hostId);
          return {
            cleanupConfirmed: false,
            recoveryIds: [...unresolved],
            reason: host.reason,
          };
        }
        unresolved.delete(hostId);
      } else if (observed.bindings.length === 0 && record.phase !== "settled") {
        return {
          cleanupConfirmed: false,
          recoveryIds: [...unresolved],
          reason: "orchestrator_task_operation_creation_unconfirmed",
        };
      }
      return {
        cleanupConfirmed: unresolved.size === 0,
        recoveryIds: [...unresolved],
        reason: "orchestrator_task_recovery_observed",
      };
    },
    observeRevision: () =>
      gitRepositoryRevisionAdapter(root)?.revisionIdentity ?? null,
    resolveSelection: (command) => {
      const read = readRepositoryAiSelection(
        rootCapability,
        getAiModelCatalog().catalog,
      );
      if (read.status !== "available") return null;
      const request = {
        workType: command.workType,
        ...(command.choice ? { choice: command.choice } : {}),
      };
      if (command.mode === "read_only_advice") {
        const selected = resolveExecutionSelection(read.snapshot.config, {
          ...request,
          role: "advice",
        });
        return selected.status === "resolved"
          ? { primary: selected.value, taskExecutionSelections: null }
          : null;
      }
      const selected = resolveTaskExecutionSelections(
        read.snapshot.config,
        request,
      );
      return selected.status === "resolved"
        ? {
            primary: selected.value.executor,
            taskExecutionSelections: selected.value,
          }
        : null;
    },
    execute: async (
      command,
      execution,
      signal,
      started,
      operationCreated,
    ): Promise<SingleTaskOutcome> => {
      const selection = execution.record.executionSelection;
      const empty = (reason: string): SingleTaskOutcome => ({
        mode: command.mode,
        status: "blocked",
        reason,
        cleanupConfirmed: true,
        recoveryIds: [],
        advice: null,
        workspaceResult: null,
      });
      if (
        !authorize() ||
        !inspectExecutionSelection(selection) ||
        resolveVerifiedRepositoryRoot(rootCapability) !== root
      )
        return empty("coordinator_task_selection_or_access_invalid");
      if (signal.aborted)
        return {
          ...empty("orchestrator_task_cancelled_before_execution"),
          status: "cancelled",
        };
      if (command.mode === "read_only_advice") {
        const executed = await runRepositoryAdvice(
          rootCapability,
          {
            ...command,
            executionSelection: selection,
            mode: "read_only_advice",
          },
          signal,
          {
            recoveryCorrelationId: execution.record.operationId,
            observeOperation: operationCreated,
            observeStarted: started,
          },
        );
        const { result, cleanupConfirmed } = executed;
        return {
          mode: command.mode,
          status: !cleanupConfirmed
            ? "unknown"
            : result.status === "completed"
              ? "completed"
              : signal.aborted
                ? "cancelled"
                : result.status,
          reason: result.reason,
          cleanupConfirmed,
          recoveryIds: [
            ...new Set(
              [executed.hostRecoveryId, executed.dockerRecoveryId].filter(
                (id): id is string => id !== null,
              ),
            ),
          ],
          advice:
            result.status === "completed"
              ? {
                  facts: result.facts,
                  sharedAnalysis: result.sharedAnalysis,
                  additionalInferences: result.additionalInferences,
                  nextOptions: result.nextOptions,
                }
              : null,
          workspaceResult: null,
        };
      }
      const result = await runCoordinatorSingleTaskAttempt(
        {
          startTask: (request, capability, correlation, observer, target) =>
            startRuntimeOwnedCoordinatorTask(
              request,
              capability,
              correlation,
              observer,
              consumer,
              target,
            ),
          cancelTask: cancelRuntimeOwnedCoordinatorTask,
        },
        {
          attemptId: execution.record.attemptId,
          operationId: execution.record.operationId,
          authorityBindingId: execution.record.taskId,
          repositoryRevision: execution.repositoryRevision,
          repositoryRoot: root,
          cancellationSignal: signal,
          observeStarted: started,
          workspaceId: execution.target.workspaceId,
          ownerRepositoryRoot: root,
          executionTree: execution.target.executionTree,
          workspaceBaseCommit: execution.target.baseCommit,
          workspaceHead: execution.target.head,
          taskRequest: {
            taskExecutionSelections: execution.taskExecutionSelections,
            expectedNetworkPolicyHash: command.expectedNetworkPolicyHash,
            objective: command.prompt,
            acceptanceCriteria: [
              "Edit the selected working tree only. Do not commit, merge, push, stash, reset, clean, or promote changes.",
              "Preserve existing staged and unselected changes. Report unexpected changed paths.",
            ],
            allowedPaths: command.allowedPaths,
            readPaths: ["PROJECT_CONTEXT.md", ...command.allowedPaths],
            workClass: "bounded_implementation",
            planState: "complete",
            risk: "low",
            difficulty: "low",
            decisionImpact: "limited",
            isLocalCandidateOnly: true,
            hasUnresolvedDirection: false,
            requiresCrossContextAlignment: false,
          },
        },
      );
      if (result.candidateId !== null)
        return {
          ...empty("orchestrator_legacy_candidate_result_rejected"),
          status: "unknown",
          cleanupConfirmed: false,
          recoveryIds: result.recoveryIds,
        };
      return {
        mode: command.mode,
        status: result.effectState === "unknown" ? "unknown" : result.status,
        reason: result.reason,
        cleanupConfirmed: result.cleanupConfirmed,
        recoveryIds: result.recoveryIds,
        advice: null,
        workspaceResult: result.workspaceResult ?? null,
      };
    },
  });
}

/**
 * 信頼した公開Surfaceが現在認可を結合するSession入力。
 * @responsibility Root権限・主体・認可再確認を同じ既存Ownerへ渡す。
 * @trace ARCH-000004
 * @shape 検証済みRoot、Project／Principal、現在認可callbackと利用用途。
 * @invariant JSON要求からRoot権限や認可callbackを生成しない。
 * @boundary 正式Package利用側とTask Session。
 * @security authorizeは操作と待機後に既存Ownerが再評価する。
 * @compatibility 新形式専用。旧Profile Storeを受け付けない。
 */
export type TaskSessionContext = Readonly<{
  rootCapability: VerifiedRepositoryRoot;
  projectId: string;
  principalId: string;
  authorize: () => boolean;
  consumer?: "workbench" | "coordinator_cli";
}>;

/**
 * 一つの受付Ownerが提供する開始・観測・取消・終了契約。
 * @responsibility 実装と同じ非永続Session寿命を公開する。
 * @trace ARCH-000004
 * @shape 既存start／observe／cancel／wait／closeの読取り専用操作。
 * @invariant 別Sessionへ要求本文や取消Ownerを複製しない。
 * @boundary Workbenchの複数HTTP要求と同一Task Owner。
 * @security 内部Map・保存Writer・Authorityを公開しない。
 * @compatibility 新しい管理状態を追加せず既存実装から導出する。
 */
export type TaskSession = ReturnType<typeof openTaskSession>;

/**
 * 単発Taskの表示・回収結果。
 * @responsibility 待機結果、一次失敗とSession終了失敗を同じ元参照へ保持する。
 * @trace ARCH-000004
 * @shape 既存の公開Snapshotと、受付前拒否に共通の状態・理由・回収情報。
 * @invariant 終了失敗で元の一次理由やTask参照を消さない。
 * @boundary 正式一回実行とCLI等の結果表示。
 * @security 生出力・内部Root・認証値を含めない。
 * @compatibility 保存Schemaとは別の非永続結果。
 */
export type TaskRunResult = Readonly<
  Omit<
    Partial<Awaited<ReturnType<TaskSession["wait"]>>>,
    "requestId" | "status" | "reason" | "cleanupConfirmed" | "secondaryFailures"
  > & {
    requestId: string | null;
    status:
      | "accepted"
      | "running"
      | "completed"
      | "blocked"
      | "cancelled"
      | "unknown";
    reason: string | null;
    cleanupConfirmed: boolean;
    secondaryFailures: readonly string[];
  }
>;

/**
 * 既存SessionでTaskを一回だけ実行し終了を待つ。
 * @responsibility 開始・待機・finally closeを一つのOwnerで完結させる。
 * @trace ARCH-000004
 * @input context: 信頼したSurfaceの現在認可、command: 未信頼要求、signal: 取消。
 * @returns 元要求参照と一次結果、独立した回収・終了失敗。
 * @precondition 呼出し元は自身のSignal登録・解除を所有する。
 * @postcondition 開いたSessionは拒否・例外・取消でも一回closeして待機する。
 * @effect 既存Task Ownerの受付・保存・実行だけ。
 * @failure 開始前はblocked、開始後不明はunknown。close失敗を副次失敗として保持する。
 * @invariant 自動再送・新しいMap・Lock・回復記録を追加しない。
 * @boundary CLI／Package利用側と既存Task Session。
 * @security 例外本文・秘密値を結果へ転記しない。
 * @concurrency 既存の取消joinとSession closeをawaitする。
 */
export async function runTask(
  context: TaskSessionContext,
  command: unknown,
  signal?: AbortSignal,
): Promise<TaskRunResult> {
  const cancellation = readExecutionCancellation(signal);
  if (cancellation !== false)
    return Object.freeze({
      status: "blocked",
      requestId: null,
      reason:
        cancellation === null
          ? "task_cancellation_invalid"
          : "task_cancelled_before_start",
      cleanupConfirmed: true,
      secondaryFailures: [],
    });
  let session: TaskSession | null = null;
  let startIssued = false;
  let result: TaskRunResult = {
    status: "blocked",
    requestId: null,
    reason: "task_entry_unconfirmed",
    cleanupConfirmed: false,
    secondaryFailures: [],
  };
  try {
    session = openTaskSession(context);
    startIssued = true;
    const started = await session.start(command, signal);
    result = { ...result, ...started };
    if (started.status === "accepted" && started.requestId)
      result = await session.wait(started.requestId);
  } catch {
    result = {
      ...result,
      status: startIssued ? "unknown" : "blocked",
      reason: result.reason ?? "task_entry_unconfirmed",
      cleanupConfirmed: false,
      primaryFailure: result.primaryFailure ?? "task_entry_unconfirmed",
    };
  } finally {
    try {
      await session?.close();
    } catch {
      result = {
        ...result,
        status: "unknown",
        cleanupConfirmed: false,
        secondaryFailures: [
          ...result.secondaryFailures,
          "task_owner_join_unconfirmed",
        ],
      };
    }
  }
  return Object.freeze(result);
}

import { snapshotCoordinatorWorkspaceResult } from "../../../domain-model/src/index.ts";
import type { CoordinatorWorkspaceResult } from "../../../domain-model/src/index.ts";
