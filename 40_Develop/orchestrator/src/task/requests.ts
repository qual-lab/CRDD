/**
 * 読取り助言とWorkspace編集の単発依頼を所有する。
 * @responsibility 同じ保存・Leaseへ受付を結合し、本文はProcess内だけに保つ。
 * @trace ARCH-000004
 * @trace ARCH-000015
 */
import { createHash, randomUUID } from "node:crypto";
import { normalizeRepositoryRelativePath } from "../input/repository-relative-path.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../input/plain-data-snapshot.ts";
import {
  readOrchestratorSnapshot,
  enqueueOrchestratorSingleTask,
  updateOrchestratorSingleTask,
  closeUnstartedOrchestratorSingleTask,
  reconcileOrchestratorSnapshotLeaseOwnerLoss,
  acquireOrchestratorSnapshotLease,
  createOrchestratorSnapshotStatePort,
} from "../storage/current-state.ts";
import {
  inspectSingleTaskRecord,
  type SingleTaskRecord,
} from "./single-task-record.ts";
import type { ProjectQueueEntry } from "../queue/types.ts";
import type { OrchestratorLeaseOwnerObservation } from "../lease/controller.ts";
import { resolveOrchestratorWorkspaceTaskTarget } from "../workspace/operations.ts";
import {
  snapshotCoordinatorWorkspaceResult,
  type CoordinatorWorkspaceResult,
} from "../../../coordinator/src/index.ts";

/**
 * 単発操作の非永続入力。
 * @responsibility 明示mode、Profile、対象と本文を一要求に固定する。
 * @trace ARCH-000004
 * @shape 固定Context参照、作業指示、対象Workspace、送信確認。
 * @invariant 同意をProfile選択や保存成功から推定しない。
 * @boundary 公開Surfaceから単発Owner。
 * @security Promptは保存しない。
 * @compatibility 旧change_candidate／Bundle入力は受理しない。
 */
export type SingleTaskCommand = Readonly<{
  mode: SingleTaskRecord["mode"];
  profileId: string;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
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
 * @boundary Orchestratorから下位実行。
 * @security 認可関数や資格を保存しない。
 * @compatibility 既存Single Task Adapterへの最小結合。
 */
export type SingleTaskExecution = Readonly<{
  record: SingleTaskRecord;
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
  const r = snapshotPlainRecord(
    raw,
    new Set([
      "mode",
      "profileId",
      "prompt",
      "contextReferences",
      "allowedPaths",
      "externalSendConfirmed",
      "workspaceId",
    ]),
  );
  const refs = snapshotPlainArray<string>(r?.contextReferences, 1);
  const paths = snapshotPlainArray<string>(r?.allowedPaths, 1024);
  if (
    !r ||
    Object.keys(r).length !== 7 ||
    typeof r.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(r.mode) ||
    typeof r.profileId !== "string" ||
    !/^PROFILE-[0-9]{6}$/u.test(r.profileId) ||
    typeof r.prompt !== "string" ||
    r.prompt.trim().length === 0 ||
    r.prompt.length > 32000 ||
    r.externalSendConfirmed !== true ||
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
  }) as SingleTaskCommand;
}

/**
 * 単発依頼の開始・観測・取消を同じTaskへ結合する。
 * @responsibility 受付保存前のEffect 0、取消join、非永続本文を所有する。
 * @trace ARCH-000004
 * @input 検証済みRootと現在認可、Profile解決、二つの既存実行Adapter。
 * @returns 開始・観測・取消・終了のProcess内Owner。
 * @precondition Snapshot初期化は別の明示操作で完了している。
 * @postcondition 本文喪失時は再実行せず元IDの欠測を返す。
 * @effect 既存Writer、Lease、注入した実行だけ。
 * @failure 保存・Profile・認可・観測不能は停止し元IDを維持する。
 * @invariant 新Registry・Lock・保存先・Merge・採用を追加しない。
 * @boundary 公開Surfaceと単発実行。
 * @security 主体を固定し観測・取消時も現在認可する。
 * @concurrency 同時実行は既存Lease、取消・closeは元Promiseをjoinする。
 */
export function createOrchestratorTaskRequests(
  deps: Readonly<{
    root: string;
    binding: string;
    projectId: string;
    principalId: string;
    authorize: () => boolean;
    resolveProfile: (
      id: string,
      mode: SingleTaskRecord["mode"],
    ) => Readonly<{ catalogRevision: number }> | null;
    observeRevision: () => string | null;
    observeLeaseOwner?: OrchestratorLeaseOwnerObservation;
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
      started: () => Promise<boolean>,
      operationCreated: (
        operation: NonNullable<SingleTaskRecord["adviceOperation"]>,
      ) => Promise<boolean>,
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
    createOrchestratorSnapshotStatePort(deps.root, deps.binding, epoch);
  const recoverRecord = async (requestId: string) => {
    const current = readOrchestratorSnapshot(deps.root, deps.binding);
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
    const reconciled = reconcileOrchestratorSnapshotLeaseOwnerLoss(
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
      const closed = closeUnstartedOrchestratorSingleTask(
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
    const acquired = acquireOrchestratorSnapshotLease(
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
      const saved = updateOrchestratorSingleTask(
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
    async start(raw: unknown) {
      const command = inspectSingleTaskCommand(raw);
      if (!command || closing || !authorized())
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
      let current = readOrchestratorSnapshot(deps.root, deps.binding);
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
        current = readOrchestratorSnapshot(deps.root, deps.binding);
      }
      const profile = deps.resolveProfile(command.profileId, command.mode);
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
        !profile ||
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
        profileId: command.profileId,
        catalogRevision: profile.catalogRevision,
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
      const saved = enqueueOrchestratorSingleTask(
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
      const item = {
        controller,
        pending: Promise.resolve(),
        snapshot: view(requestId, record, "accepted", null),
      };
      requests.set(requestId, item);
      item.pending = (async () => {
        const acquired = acquireOrchestratorSnapshotLease(
          deps.root,
          deps.binding,
          deps.projectId,
          requestId,
          "project-operation",
        );
        if (acquired.status !== "completed") {
          const closed = closeUnstartedOrchestratorSingleTask(
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
          const result = updateOrchestratorSingleTask(
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
          const target = resolveOrchestratorWorkspaceTaskTarget(
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
            { record, repositoryRevision: revision, target: target.value },
            controller.signal,
            async () =>
              authorized() &&
              !controller.signal.aborted &&
              save({ ...phase, phase: "running" }),
            async (operation) => {
              if (
                !authorized() ||
                controller.signal.aborted ||
                phase.adviceOperation ||
                phase.phase !== "starting"
              )
                return false;
              const candidate = inspectSingleTaskRecord({
                ...phase,
                adviceOperation: operation,
              });
              if (!candidate?.adviceOperation) return false;
              createdOperation = candidate.adviceOperation;
              return save(candidate);
            },
          );
          const outcome = snapshotSingleTaskOutcome(rawOutcome);
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
      })();
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
      const current = readOrchestratorSnapshot(deps.root, deps.binding);
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
 * @postcondition 候補採用・変更帰属を主張しない。
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
    profileId: record?.profileId ?? null,
    status,
    reason,
    taskId: record?.taskId ?? null,
    attemptId: record?.attemptId ?? null,
    operationId: record?.operationId ?? null,
    executionStatus: record?.status ?? null,
    primaryFailure: record ? record.reason : reason,
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
function snapshotSingleTaskOutcome(raw: unknown): SingleTaskOutcome | null {
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
    profileId: "PROFILE-100001",
    catalogRevision: 1,
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
