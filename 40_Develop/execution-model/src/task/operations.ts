/**
 * Task・Queueの全State候補生成と同版投影を所有する。
 * @responsibility 局所検査を再実装せず元版・参照・世代の候補を構築する。
 * @trace ARCH-000008
 */
import { hashExecutionProjectDefinition } from "../objective/validation.ts";
import type {
  ExecutionStoredManagedProject,
  ManagedExecution,
  ProjectExecutionState,
  Snapshot,
  StoredTask,
  TaskSettlementFact,
} from "../state/types.ts";
import {
  decodeStateSnapshot,
  projectTaskSettlement,
  snapshotIntakeMatches,
  validateUnifiedTransition,
  validSnapshot,
} from "../state/validation.ts";
import {
  isStateObject,
  validId,
  encodeStateValue,
  hasExecutionStateRecordKeys,
} from "../state/operations.ts";
import { historyRow } from "../history/validation.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "../state/types.ts";
import {
  validState,
  validResultReference,
  validQueueEntry,
  inspectSingleTaskRecord,
} from "./validation.ts";
import type {
  ProjectQueueEntry,
  ProjectQueueState,
  QueueEnqueueInput,
  SingleTaskRecord,
} from "./types.ts";

const QUEUE_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["leased", "waiting_foreground", "cancelled"]),
  leased: Object.freeze([
    "running",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  running: Object.freeze([
    "integration_pending",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  waiting_foreground: Object.freeze(["queued", "cancelled"]),
  integration_pending: Object.freeze([
    "completed",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  replan_required: Object.freeze([
    "queued",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  human_decision_required: Object.freeze([
    "replan_required",
    "recovery_required",
    "cancelled",
  ]),
  recovery_required: Object.freeze([
    "queued",
    "recovery_required",
    "cancelled",
  ]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
} satisfies Record<ProjectQueueState, readonly ProjectQueueState[]>);

/**
 * Taskの確定済み業務更新を単一保存の一改訂へ組み込む。
 * @responsibility 受領本文を一度保持し、同じ更新で配送待ち・終端操作・参照を整理する。
 * @trace ARCH-000004、ARCH-000008
 * @input currentBytes: 元本文、stateValue: 業務更新済み公開State、expectedGeneration: 元業務世代、repositoryBinding: 物理結合、resultFacts: 同じAttemptで新たに得たTask結果の不明事実。
 * @returns 既存区画を保持した次本文、又はnull。
 * @precondition Task Ownerが受付・Lease・業務遷移を既存境界で検証する。
 * @postcondition 投影した公開Stateが指定更新と完全一致する場合だけ候補を返す。
 * @effect N/A: メモリ内の候補生成だけ。保存・回収・Provider要求なし。
 * @failure 世代競合、受領差替え、不足参照、未確認終端、導出状態不一致はnull。
 * @invariant Root未初期化を暗黙初期化せず、旧受領と他Projectを保持する。
 * @boundary Task更新と単一Writerに渡す正規候補。
 * @security 候補生成は実受領・実回収・保存Authorityではない。
 * @concurrency 元本文と実排他は同じWriter Owner内で再照合する。
 */
export function prepareUnifiedTaskSnapshot(
  currentBytes: unknown,
  stateValue: unknown,
  expectedGeneration: unknown,
  repositoryBinding: unknown,
  resultFacts: unknown = [],
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    const state: unknown = JSON.parse(encodeStateValue(stateValue));
    const facts: unknown = JSON.parse(encodeStateValue(resultFacts));
    if (
      !current ||
      current.snapshot.repositoryBindingId === null ||
      !validState(state) ||
      !Number.isSafeInteger(expectedGeneration) ||
      Number(expectedGeneration) < 0 ||
      state.generation !== Number(expectedGeneration) + 1 ||
      (current.snapshot.projects.find((p) => p.projectId === state.projectId)
        ?.generation ?? 0) !== expectedGeneration ||
      !Array.isArray(facts) ||
      !facts.every((f) =>
        hasExecutionStateRecordKeys(f, [
          "taskId",
          "attemptId",
          "operationId",
          "recoveryUnresolved",
        ]),
      )
    )
      return null;
    const states = current.projects.some((p) => p.projectId === state.projectId)
      ? current.projects.map((p) =>
          p.projectId === state.projectId ? state : p,
        )
      : [...current.projects, state];
    const sections = normalizeTaskProjects(
      current,
      states,
      facts.map((f) => ({ ...f, projectId: state.projectId })),
    );
    if (!sections) return null;
    const next = {
      ...current.snapshot,
      ...sections,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    const decoded = decodeStateSnapshot(bytes, repositoryBinding);
    return decoded &&
      validateUnifiedTransition(currentBytes, bytes, repositoryBinding) &&
      encodeStateValue(
        decoded.projects.find((p) => p.projectId === state.projectId),
      ) === encodeStateValue(state)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ更新内のTask結果・受領と操作参照を正規化する。
 * @responsibility 元受領の不変性と同じAttemptへの結果結合を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 検査済み元版、states: 更新後Task投影、facts: 同じAttemptの観測。
 * @returns 単一保存の更新区画、又はnull。
 * @precondition 元版と新しいTask値は既存の値契約を満たす。
 * @postcondition 受領本文を一度だけ保持し、他操作の未解決事実を保全する。
 * @effect N/A: メモリ内の候補生成のみ。
 * @failure 相関・固定受領差替え・状態不正はnull。
 * @invariant 結果や回復参照の欠測を成功へ補完しない。
 * @boundary Task Ownerと共通保存の値境界。
 * @security 候補を保存・受領・cleanupのAuthorityにしない。
 * @concurrency 元版のfresh確認はWriterが行う。
 */
export function normalizeTaskProjects(
  current: NonNullable<ReturnType<typeof decodeStateSnapshot>>,
  states: readonly ProjectExecutionState[],
  facts: unknown,
) {
  if (
    !states.every(validState) ||
    !Array.isArray(facts) ||
    !facts.every(
      (f, i) =>
        hasExecutionStateRecordKeys(f, [
          "projectId",
          "taskId",
          "attemptId",
          "operationId",
          "recoveryUnresolved",
        ]) &&
        typeof f.recoveryUnresolved === "boolean" &&
        !facts
          .slice(0, i)
          .some((p) => p.projectId === f.projectId && p.taskId === f.taskId) &&
        states.some(
          (p) =>
            p.projectId === f.projectId &&
            p.tasks.some(
              (t) =>
                t.definition.id === f.taskId &&
                t.attemptId !== null &&
                t.attemptId === f.attemptId &&
                t.operationId !== null &&
                t.operationId === f.operationId,
            ),
        ),
    )
  )
    return null;
  const completed = new Set<string>();
  for (const priorProject of current.snapshot.managedExecutions) {
    const project = states.find((p) => p.projectId === priorProject.projectId);
    const priorGeneration = current.projects.find(
      (p) => p.projectId === priorProject.projectId,
    )?.generation;
    if (
      !project ||
      priorGeneration === undefined ||
      project.generation !== priorGeneration + 1
    )
      continue;
    for (const prior of priorProject.tasks) {
      if (prior.settlement.kind !== "operations") continue;
      const task = project.tasks.find((t) => t.definition.id === prior.taskId);
      if (
        !task ||
        task.attemptId !== prior.attemptId ||
        task.operationId !== prior.operationId
      )
        return null;
      if (
        task.startPhase !== "settled" ||
        !task.cleanupConfirmed ||
        task.recoveryUnresolved ||
        task.recoveryObligations.some((o) => o.phase !== "settled")
      )
        continue;
      // 未解決参照が残るTaskは、同じ状態を保存してもOperation除去へ進めない。
      if (
        current.snapshot.unresolvedRecoveries.some(
          (recovery) =>
            prior.settlement.kind === "operations" &&
            prior.settlement.recoveryIds.includes(recovery.recoveryId),
        )
      )
        continue;
      for (const id of prior.settlement.recoveryIds) {
        const operation = current.snapshot.operations.find(
          (o) => o.recoveryId === id,
        );
        const identity =
          operation?.kind === "docker_task"
            ? JSON.parse(operation.identityJson)
            : null;
        const terminal = projectTaskSettlement(
          { kind: "operations", recoveryIds: [id], resultUnresolved: false },
          current.snapshot,
        );
        if (
          operation?.kind !== "docker_task" ||
          !identity ||
          (identity.recoveryCorrelationId ?? identity.operationId) !==
            task.operationId ||
          operation.history?.confirmed !== true ||
          !terminal?.cleanupConfirmed ||
          current.snapshot.unresolvedRecoveries.some((r) => r.recoveryId === id)
        )
          return null;
        completed.add(id);
      }
    }
  }
  const operations = current.snapshot.operations.filter(
    (o) => !completed.has(o.recoveryId),
  );
  const projects: ExecutionStoredManagedProject[] = [];
  for (const state of states) {
    const tasks: StoredTask[] = [];
    for (const task of state.tasks) {
      const previous = current.snapshot.managedExecutions
        .find((p) => p.projectId === state.projectId)
        ?.tasks.find(
          (t) =>
            t.taskId === task.definition.id &&
            t.attemptId === task.attemptId &&
            t.operationId === task.operationId,
        )?.settlement;
      const explicit = facts.find(
        (f) =>
          f.projectId === state.projectId && f.taskId === task.definition.id,
      );
      const resultUnresolved =
        explicit?.recoveryUnresolved ??
        (previous?.kind === "operations"
          ? previous.resultUnresolved
          : previous?.kind === "executor_result"
            ? previous.recoveryUnresolved
            : false);
      const matching = operations
        .filter((o) => {
          if (o.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(o.identityJson);
          return (
            (identity.recoveryCorrelationId ?? identity.operationId) ===
            task.operationId
          );
        })
        .map((o) => o.recoveryId);
      const settlement: TaskSettlementFact = matching.length
        ? { kind: "operations", recoveryIds: matching, resultUnresolved }
        : task.startPhase === "none" &&
            !task.cleanupConfirmed &&
            !task.recoveryUnresolved
          ? { kind: "pending" }
          : {
              kind: "executor_result",
              cleanupConfirmed: task.cleanupConfirmed,
              recoveryUnresolved: resultUnresolved,
            };
      const {
        cleanupConfirmed: _cleanup,
        recoveryUnresolved: _unresolved,
        recoveryObligations: _obligations,
        ...record
      } = task;
      const recoveryObligations = task.recoveryObligations;
      tasks.push({
        ...record,
        settlement,
        recoveryObligations,
      });
    }
    projects.push({ ...state, tasks });
  }
  const definitions = projects.map(
    ({
      taskExecutionSelections: _selection,
      ownerGeneration: _owner,
      maximumConcurrency: _maximum,
      tasks,
      contract: _contract,
      ...core
    }) => ({
      ...core,
      contract: "crdd-domain/project-state/v1" as const,
      tasks: tasks.map((task) => task.definition),
    }),
  );
  const managedExecutions: ManagedExecution[] = projects.map((project) => {
    const definition = definitions.find(
      (item) => item.projectId === project.projectId,
    );
    if (!definition) throw new Error("definition");
    return {
      projectId: project.projectId,
      milestoneId: project.milestoneId,
      definitionHash: hashExecutionProjectDefinition(definition),
      taskExecutionSelections: project.taskExecutionSelections,
      ownerGeneration: project.ownerGeneration,
      maximumConcurrency: project.maximumConcurrency,
      tasks: project.tasks.map(({ definition: taskDefinition, ...task }) => ({
        ...task,
        taskId: taskDefinition.id,
      })),
    };
  });
  const retainedDefinitions = current.snapshot.projects.map(
    (project) =>
      definitions.find((item) => item.projectId === project.projectId) ??
      project,
  );
  return {
    projects: [
      ...retainedDefinitions,
      ...definitions.filter(
        (project) =>
          !current.snapshot.projects.some(
            (item) => item.projectId === project.projectId,
          ),
      ),
    ],
    managedExecutions,
    operations,
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (r) => !completed.has(r.recoveryId),
    ),
  };
}

/**
 * 単一保存からTask利用側のメモリViewだけを投影する。
 * @responsibility 保存改訂を一つの値として公開し、旧物理Envelopeを生成しない。
 * @trace ARCH-000004、ARCH-000008
 * @input decoded: 統一codec結果、repositoryRootHash: 呼出し側が確認したRoot Hash。
 * @returns 初期化済みTask View、又はnull。
 * @precondition 物理Rootの実確認は保存Ownerが担当する。
 * @postcondition 技術区画をTask Viewへ複製しない。
 * @effect N/A: 同期投影のみ。
 * @failure 業務初期化前はnull。
 * @invariant このViewを別Fileへ保存しない。
 * @boundary 単一保存と業務操作。
 * @security Viewは保存・実行Authorityではない。
 * @concurrency N/A: 元版と保存CASは呼出し側が照合する。
 */
export function projectTaskSnapshot(
  decoded: NonNullable<ReturnType<typeof decodeStateSnapshot>>,
  repositoryRootHash: string,
): Snapshot | null {
  const s = decoded.snapshot;
  if (s.repositoryBindingId === null || s.intakeEpoch === null) return null;
  return {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 7,
    repositoryRootHash,
    repositoryBindingId: s.repositoryBindingId,
    intakeEpoch: s.intakeEpoch,
    snapshotRevision: s.revision,
    projects: decoded.projects,
    intakeBindings: s.intakeBindings,
    queueEntries: s.queueEntries,
    workspaces: s.workspaces,
    leaseEvidence: s.leaseEvidence,
    leaseIntents: s.leaseIntents,
    results: s.results,
    historyPending: s.historyPending,
    decisions: s.decisions,
    blockers: s.blockers,
  };
}

/**
 * Task・Queue・Workspaceの業務更新を一改訂の保存候補へ接続する。
 * @responsibility 全業務区画と受領・技術参照を同じ本文で確定可能にする。
 * @trace ARCH-000004、ARCH-000008
 * @input currentBytes: 元本文、viewValue: 業務View候補、repositoryBinding: 物理結合、rootHash: 確認済みRoot Hash、facts: 明示結果事実。
 * @returns 正規保存候補、又はnull。
 * @precondition 同Owner内で既存業務遷移・Lease・履歴検査を完了する。
 * @postcondition 技術区画・受領と業務更新の片側だけを保存しない。
 * @effect N/A: 候補作成のみ。
 * @failure 元版・結合・参照・投影不一致はnull。
 * @invariant 旧Snapshotを内包せず単一の改訂と前Hashを使う。
 * @boundary 業務Viewから単一Writer。
 * @security 候補自体は書込み資格ではない。
 * @concurrency 保存Ownerが現在本文とCASを再照合する。
 */
export function prepareUnifiedTaskSections(
  currentBytes: unknown,
  viewValue: unknown,
  repositoryBinding: unknown,
  rootHash: string,
  factsValue: unknown = [],
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    const view: unknown = JSON.parse(encodeStateValue(viewValue));
    const facts: unknown = JSON.parse(encodeStateValue(factsValue));
    if (
      !current ||
      !isStateObject(view) ||
      !validSnapshot(view, String(view.repositoryBindingId), rootHash) ||
      view.snapshotRevision !== current.snapshot.revision + 1
    )
      return null;
    const sections = normalizeTaskProjects(current, view.projects, facts);
    if (!sections) return null;
    const {
      schema: _schema,
      schemaRevision: _schemaRevision,
      snapshotRevision: _revision,
      repositoryRootHash: _rootHash,
      projects: _projects,
      ...taskSections
    } = view;
    const next = {
      ...current.snapshot,
      ...taskSections,
      ...sections,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    const decoded = decodeStateSnapshot(bytes, repositoryBinding);
    return decoded &&
      validateUnifiedTransition(currentBytes, bytes, repositoryBinding) &&
      encodeStateValue(projectTaskSnapshot(decoded, rootHash)) ===
        encodeStateValue(view)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 実行Ownerが要求したQueueのLease解放確定候補を導出する。
 * @responsibility 世代・元Owner・解放証拠・intentを照合し、実資源不存在は元位置の観測だけを使う。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、Queue ID・期待世代・Owner世代、用途固定の同期資源観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と元位置の有限同期観測。物理解放・回復・保存は発行しない。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・生Lockを渡さず、用途限定の同期観測以外を受けない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */

export function prepareQueueLeaseReleaseSettlement(
  current: Snapshot,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
  observations: Readonly<{
    resourcesAbsent: (projectId: string) => boolean;
  }>,
) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
    return blocked("orchestrator_snapshot_schema_invalid");
  const previous = current.queueEntries.find(
    (item) => item.queueId === queueId,
  );
  if (
    !validId(queueId) ||
    !validId(ownerGeneration) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration ||
    previous.ownerGeneration !== ownerGeneration ||
    previous.state === "leased" ||
    previous.state === "running"
  )
    return blocked(
      "orchestrator_queue_release_settlement_state_mismatch",
      true,
    );
  if (observations.resourcesAbsent(previous.projectId) !== true)
    return blocked(
      "orchestrator_queue_release_settlement_resource_present",
      true,
    );
  const evidence = {
    released: current.leaseEvidence.find(
      (item) =>
        item.projectId === previous.projectId &&
        item.content.queueId === queueId &&
        item.content.kind === "project-operation" &&
        item.content.ownerGeneration === ownerGeneration &&
        item.content.disposition === "released",
    ),
    recovered: current.leaseEvidence.find(
      (item) =>
        item.projectId === previous.projectId &&
        item.content.queueId === queueId &&
        item.content.kind === "project-operation" &&
        item.content.ownerGeneration === ownerGeneration &&
        item.content.disposition === "recovered_after_owner_loss",
    ),
  };
  if (
    current.leaseIntents.some(
      (item) => item.ownerGeneration === ownerGeneration,
    )
  )
    return blocked("orchestrator_queue_release_intent_unsettled", true);
  if (!evidence.released || evidence.recovered)
    return blocked("orchestrator_queue_release_evidence_mismatch", true);
  const value = {
    ...previous,
    generation: previous.generation + 1,
    ownerGeneration: null,
  };
  return completed("orchestrator_queue_release_settled", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? value : item,
      ),
    },
    value,
  });
}

/**
 * Coordinatorの閉じた選択判断をfresh Queueへ適用する。
 * @responsibility 対象ID・元世代・重複更新・限定遷移を検査し、優先順位を判断しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、decision: 同Owner内のCoordinator選択判断。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure stale世代・重複・対象外更新・不正な選択差分をorchestrator_queue_selection_invalidで拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */

export function prepareQueueSelection(
  current: Snapshot,
  decision: Readonly<{
    reason:
      | "orchestrator_active_operation_retained"
      | "orchestrator_interactive_queue_selected"
      | "orchestrator_scheduled_queue_selected"
      | "orchestrator_queue_empty";
    selectedQueueId: string | null;
    selectedQueueGeneration: number | null;
    updates: readonly Readonly<{
      queueId: string;
      expectedGeneration: number;
      state: "queued" | "waiting_foreground";
      resumeCondition: string | null;
    }>[];
  }>,
) {
  const invalid = blocked("orchestrator_queue_selection_invalid");
  if (
    ![
      "orchestrator_active_operation_retained",
      "orchestrator_interactive_queue_selected",
      "orchestrator_scheduled_queue_selected",
      "orchestrator_queue_empty",
    ].includes(decision.reason)
  )
    return invalid;
  const selected =
    decision.selectedQueueId === null
      ? null
      : current.queueEntries.find(
          (item) => item.queueId === decision.selectedQueueId,
        );
  if (
    (decision.selectedQueueId === null &&
      decision.selectedQueueGeneration !== null) ||
    (decision.selectedQueueId !== null &&
      (!selected ||
        selected.generation !== decision.selectedQueueGeneration ||
        selected.ownerGeneration !== null))
  )
    return invalid;
  if (
    decision.reason === "orchestrator_active_operation_retained" ||
    decision.reason === "orchestrator_queue_empty"
      ? selected !== null
      : !selected
  )
    return invalid;
  if (
    new Set(decision.updates.map((item) => item.queueId)).size !==
    decision.updates.length
  )
    return invalid;
  const waitingReason =
    decision.reason === "orchestrator_active_operation_retained"
      ? "active_operation_pending"
      : decision.reason === "orchestrator_interactive_queue_selected"
        ? "interactive_queue_pending"
        : null;
  if (
    (waitingReason !== null &&
      decision.updates.some(
        (update) =>
          update.state !== "waiting_foreground" ||
          update.resumeCondition !== waitingReason,
      )) ||
    (decision.reason === "orchestrator_queue_empty" &&
      decision.updates.length !== 0) ||
    (decision.reason === "orchestrator_scheduled_queue_selected" &&
      (decision.updates.length > 1 ||
        decision.updates.some(
          (update) =>
            update.queueId !== decision.selectedQueueId ||
            update.state !== "queued" ||
            update.resumeCondition !== null,
        )))
  )
    return invalid;
  for (const update of decision.updates) {
    const prior = current.queueEntries.find(
      (item) => item.queueId === update.queueId,
    );
    if (
      !prior ||
      prior.generation !== update.expectedGeneration ||
      prior.ownerGeneration !== null ||
      prior.originLane !== "scheduled" ||
      !(
        (prior.state === "queued" &&
          update.state === "waiting_foreground" &&
          ["active_operation_pending", "interactive_queue_pending"].includes(
            update.resumeCondition ?? "",
          )) ||
        (prior.state === "waiting_foreground" &&
          update.state === "queued" &&
          update.resumeCondition === null)
      )
    )
      return invalid;
  }
  const queueEntries = current.queueEntries.map((item) => {
    const update = decision.updates.find(
      (value) => value.queueId === item.queueId,
    );
    return update
      ? {
          ...item,
          state: update.state,
          generation: item.generation + 1,
          resumeCondition: update.resumeCondition,
          resultReference: null,
        }
      : item;
  });
  const value =
    decision.selectedQueueId === null
      ? null
      : (queueEntries.find(
          (item) => item.queueId === decision.selectedQueueId,
        ) ?? null);
  if (
    value &&
    ((decision.reason === "orchestrator_interactive_queue_selected" &&
      value.originLane !== "interactive") ||
      (decision.reason === "orchestrator_scheduled_queue_selected" &&
        value.originLane !== "scheduled") ||
      value.state !== "queued")
  )
    return invalid;
  return completed(decision.reason, {
    next: decision.updates.length ? { ...current, queueEntries } : null,
    value,
  });
}

/**
 * 実行Ownerが要求したQueue更新の固定候補を導出する。
 * @responsibility 既存の局所遷移・元Owner相関と対象外保持を確認し、回復の成立・外部Effect・再実行許可は判断しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象ID・期待世代・固定次値、必要な用途固定観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lease・保存・回復を発行しない。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、必要な有限観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareQueueOperationUpdate(
  current: Snapshot,
  repositoryRoot: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  next: Readonly<{
    state: ProjectQueueState;
    resumeCondition: string | null;
    resultReference: string | null;
    leasePresent: boolean;
    leaseIsNull: boolean;
  }>,
  observations: Readonly<{
    borrowActiveLease: () =>
      | Readonly<{
          kind: string;
          repositoryRoot: string;
          repositoryBindingId: string;
          projectId: string;
          queueId: string;
          ownerGeneration: string;
        }>
      | undefined;
    isActiveLeaseObserved: () => boolean;
  }>,
) {
  const previous = current.queueEntries.find(
    (item) => item.queueId === queueId,
  );
  if (previous?.singleTask)
    return blocked("orchestrator_single_task_owner_required");
  if (
    !validId(queueId) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration
  )
    return blocked("orchestrator_queue_generation_conflict");
  if (next.resumeCondition !== null && !validId(next.resumeCondition))
    return blocked("orchestrator_queue_resume_condition_invalid");
  if (
    next.resultReference !== null &&
    !validResultReference(next.resultReference)
  )
    return blocked("orchestrator_queue_result_reference_invalid");
  if (
    !(
      QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
    ).includes(next.state)
  )
    return blocked("orchestrator_queue_transition_invalid");
  if (
    next.state !== previous.state &&
    ["queued", "leased", "running"].includes(next.state) &&
    current.blockers.some(
      (blocker) =>
        blocker.status === "active" &&
        blocker.target.projectId === previous.projectId &&
        blocker.target.milestoneId === previous.milestoneId,
    )
  )
    return blocked("orchestrator_queue_blocker_active");
  if (
    previous.state === "recovery_required" &&
    next.state === "recovery_required" &&
    !(
      previous.ownerGeneration === null &&
      previous.resumeCondition === "owner_loss" &&
      next.leaseIsNull &&
      next.resumeCondition === "exact_recovery" &&
      next.resultReference !== null
    )
  )
    return blocked("orchestrator_queue_recovery_binding_invalid");
  if (
    previous.state === "recovery_required" &&
    next.state === "queued" &&
    !(
      previous.ownerGeneration === null &&
      previous.resumeCondition === "owner_loss" &&
      previous.resultReference !== null &&
      next.leaseIsNull &&
      next.resumeCondition === null &&
      next.resultReference === null
    )
  )
    return blocked("orchestrator_queue_owner_loss_reset_invalid");
  const activeLease = next.leasePresent
    ? observations.borrowActiveLease()
    : undefined;
  const isRequired =
    previous.ownerGeneration !== null ||
    next.state === "leased" ||
    next.state === "running";
  if (!isRequired && !next.leaseIsNull)
    return blocked("orchestrator_queue_lease_invalid");
  if (
    isRequired &&
    (activeLease?.kind !== "project-operation" ||
      activeLease.repositoryRoot !== repositoryRoot ||
      activeLease.repositoryBindingId !== binding ||
      activeLease.projectId !== previous.projectId ||
      activeLease.queueId !== queueId ||
      observations.isActiveLeaseObserved() !== true)
  )
    return blocked("orchestrator_queue_lease_invalid");
  if (
    isRequired &&
    previous.ownerGeneration !== null &&
    previous.ownerGeneration !== activeLease?.ownerGeneration
  )
    return blocked("orchestrator_queue_owner_mismatch");
  const value: ProjectQueueEntry = {
    ...previous,
    state: next.state,
    generation: previous.generation + 1,
    ownerGeneration: isRequired ? (activeLease?.ownerGeneration ?? null) : null,
    resumeCondition: next.resumeCondition,
    resultReference: next.resultReference,
  };
  if (!validQueueEntry(value))
    return blocked("orchestrator_queue_record_mismatch");
  return completed("orchestrator_queue_state_durable", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? value : item,
      ),
    },
    value,
  });
}

/**
 * 上位が発火したexact回復後Queueの適用候補を導出する。
 * @responsibility 既存の局所遷移・元Owner相関と対象外保持を確認し、回復の成立・外部Effect・再実行許可は判断しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象ID・期待世代・固定次値、必要な用途固定観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lease・保存・回復を発行しない。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、必要な有限観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareQueueRecoverySettlement(
  current: Snapshot,
  queueId: string,
  expectedGeneration: number,
  recoveryId: string,
) {
  const previous = current.queueEntries.find(
    (item) => item.queueId === queueId,
  );
  if (
    !validId(queueId) ||
    !validResultReference(recoveryId) ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 1 ||
    !previous ||
    previous.generation !== expectedGeneration
  )
    return blocked("orchestrator_queue_recovery_generation_conflict");
  if (
    previous.state !== "recovery_required" ||
    previous.ownerGeneration !== null ||
    previous.resumeCondition !== "exact_recovery" ||
    previous.resultReference !== recoveryId
  )
    return blocked("orchestrator_queue_recovery_identity_mismatch");
  const value: ProjectQueueEntry = {
    ...previous,
    state: "queued",
    generation: previous.generation + 1,
    ownerGeneration: null,
    resumeCondition: "exact_recovery_settled",
    resultReference: recoveryId,
  };
  return completed("orchestrator_queue_recovery_settled", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? value : item,
      ),
    },
    value,
  });
}

/**
 * 単発Taskの受付候補を既存Queueへ限定する。
 * @responsibility 元ID・世代・失敗・回復参照と対象外区画を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象・期待世代・固定次値、必要な有限同期観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。保存・実Lease・Provider操作なし。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、用途固定の同期観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareSingleTaskQueueCreation(
  current: Snapshot,
  intakeEpoch: string,
  input: ProjectQueueEntry,
) {
  if (
    !validQueueEntry(input) ||
    !input.singleTask ||
    input.milestoneId !== null ||
    input.singleTask.phase !== "accepted" ||
    input.state !== "queued" ||
    input.generation !== 1 ||
    input.ownerGeneration !== null ||
    input.resultReference !== null ||
    input.resumeCondition !== null
  )
    return blocked("orchestrator_single_task_input_invalid");
  const existing = current.queueEntries.find(
    (entry) => entry.queueId === input.queueId,
  );
  if (existing) {
    const epoch = current.intakeBindings.find(
      (entry) => entry.queueId === input.queueId,
    )?.epoch;
    const keys = [
      "projectId",
      "milestoneId",
      "requestHash",
      "repositoryRevision",
      "scopeHash",
      "workspaceId",
    ] as const;
    const identityKeys = [
      "principalId",
      "mode",
      "executionSelection",
      "taskId",
      "attemptId",
      "operationId",
    ] as const;
    return epoch === intakeEpoch &&
      existing.singleTask &&
      keys.every((key) => existing[key] === input[key]) &&
      identityKeys.every(
        (key) =>
          encodeStateValue(existing.singleTask?.[key]) ===
          encodeStateValue(input.singleTask?.[key]),
      )
      ? completed("orchestrator_single_task_reused", {
          next: null,
          value: existing,
        })
      : blocked("orchestrator_queue_identity_conflict");
  }
  if (current.intakeEpoch !== intakeEpoch)
    return blocked("orchestrator_intake_epoch_retired");
  if (
    input.workspaceId != null &&
    (!current.queueEntries.some(
      (entry) =>
        entry.projectId === input.projectId &&
        entry.workspaceId === input.workspaceId,
    ) ||
      !current.workspaces.some(
        (entry) =>
          entry.workspaceId === input.workspaceId &&
          entry.phase === "ready" &&
          entry.holdUntil === null,
      ))
  )
    return blocked("orchestrator_workspace_not_ready");
  return completed("orchestrator_single_task_durable", {
    next: {
      ...current,
      queueEntries: [...current.queueEntries, input],
      intakeBindings: [
        ...current.intakeBindings,
        { queueId: input.queueId, epoch: intakeEpoch },
      ],
    },
    value: input,
  });
}

/**
 * 単発Taskの開始・終端の固定候補を導出する。
 * @responsibility 元ID・世代・失敗・回復参照と対象外区画を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象・期待世代・固定次値、必要な有限同期観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。保存・実Lease・Provider操作なし。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、用途固定の同期観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareSingleTaskQueueUpdate(
  current: Snapshot,
  repositoryRoot: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  rawRecord: unknown,
  observations: Readonly<{
    borrowActiveLease: () =>
      | Readonly<{
          kind: string;
          repositoryRoot: string;
          repositoryBindingId: string;
          projectId: string;
          queueId: string;
          ownerGeneration: string;
        }>
      | undefined;
    isActiveLeaseObserved: () => boolean;
    now: () => number;
  }>,
) {
  const record = inspectSingleTaskRecord(rawRecord);
  if (!record) return blocked("orchestrator_single_task_record_invalid");
  const previous = current.queueEntries.find(
    (entry) => entry.queueId === queueId,
  );
  const active = observations.borrowActiveLease();
  if (
    !previous?.singleTask ||
    previous.generation !== expectedGeneration ||
    active?.kind !== "project-operation" ||
    active.repositoryRoot !== repositoryRoot ||
    active.repositoryBindingId !== binding ||
    active.projectId !== previous.projectId ||
    active.queueId !== queueId ||
    observations.isActiveLeaseObserved() !== true ||
    (previous.ownerGeneration !== null &&
      previous.ownerGeneration !== active.ownerGeneration)
  )
    return blocked("orchestrator_single_task_owner_mismatch");
  const identityKeys = [
    "principalId",
    "mode",
    "executionSelection",
    "taskId",
    "attemptId",
    "operationId",
  ] as const;
  if (
    identityKeys.some(
      (key) =>
        encodeStateValue(previous.singleTask?.[key]) !==
        encodeStateValue(record[key]),
    )
  )
    return blocked("orchestrator_single_task_identity_conflict");
  if (previous.singleTask.phase === "settled") {
    if (
      previous.singleTask.status !== record.status ||
      previous.singleTask.reason !== record.reason ||
      (previous.singleTask.cleanupConfirmed && !record.cleanupConfirmed) ||
      record.recoveryIds.some(
        (id) => !previous.singleTask?.recoveryIds.includes(id),
      )
    )
      return blocked("orchestrator_single_task_terminal_identity_conflict");
    if (encodeStateValue(previous.singleTask) === encodeStateValue(record))
      return completed("orchestrator_single_task_already_saved", {
        next: null,
        value: previous,
      });
  }
  const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
    accepted: ["starting"],
    starting: ["starting", "running", "settled"],
    running: ["settled"],
    settled: ["settled"],
  };
  if (!phases[previous.singleTask.phase].includes(record.phase))
    return blocked("orchestrator_single_task_transition_invalid");
  const terminal = record.phase === "settled";
  const clean =
    terminal && record.cleanupConfirmed && record.recoveryIds.length === 0;
  const value: ProjectQueueEntry = {
    ...previous,
    singleTask: record,
    generation: previous.generation + 1,
    ownerGeneration: active.ownerGeneration,
    state: !terminal
      ? "running"
      : !clean
        ? "recovery_required"
        : record.status === "cancelled"
          ? "cancelled"
          : "completed",
    resumeCondition: !terminal || clean ? null : "exact_recovery",
    resultReference: clean ? null : previous.resultReference,
  };
  const row = clean
    ? historyRow(
        {
          id: queueId,
          occurredAt: new Date(observations.now()).toISOString(),
          outcome:
            record.status === "completed"
              ? "completed"
              : record.status === "cancelled"
                ? "cancelled"
                : "failed",
          primaryFailure:
            record.status === "completed"
              ? null
              : record.status === "cancelled"
                ? "cancel"
                : "execution",
          cleanup: "confirmed",
        },
        observations.now(),
      )
    : null;
  return completed("orchestrator_single_task_saved", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((entry) =>
        entry.queueId === queueId ? value : entry,
      ),
      historyPending: row
        ? [...current.historyPending.filter((item) => item.id !== queueId), row]
        : current.historyPending,
    },
    value,
  });
}

/**
 * 未開始単発Taskの終了候補を既存の条件へ限定する。
 * @responsibility 元ID・世代・失敗・回復参照と対象外区画を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh元版、対象・期待世代・固定次値、必要な有限同期観測。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect 値操作と用途固定の同期観測だけ。保存・実Lease・Provider操作なし。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・実Lease・任意Snapshot callbackを受けず、用途固定の同期観測だけを消費する。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareUnstartedTaskQueueClosure(
  current: Snapshot,
  queueId: string,
  expectedGeneration: number,
  reason: string,
  observations: Readonly<{ now: () => number }>,
) {
  const previous = current.queueEntries.find(
    (entry) => entry.queueId === queueId,
  );
  if (
    !previous?.singleTask ||
    previous.generation !== expectedGeneration ||
    previous.singleTask.phase !== "accepted" ||
    previous.ownerGeneration !== null ||
    current.leaseIntents.some((intent) => intent.queueId === queueId)
  )
    return blocked("orchestrator_single_task_unstarted_unconfirmed");
  const record = inspectSingleTaskRecord({
    ...previous.singleTask,
    phase: "settled",
    status: "blocked",
    reason,
    cleanupConfirmed: true,
  });
  if (!record) return blocked("orchestrator_single_task_record_invalid");
  const value: ProjectQueueEntry = {
    ...previous,
    singleTask: record,
    generation: previous.generation + 1,
    state: "completed",
    resumeCondition: null,
  };
  const row = historyRow(
    {
      id: queueId,
      occurredAt: new Date(observations.now()).toISOString(),
      outcome: "failed",
      primaryFailure: "execution",
      cleanup: "confirmed",
    },
    observations.now(),
  );
  return completed("orchestrator_single_task_not_started", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((entry) =>
        entry.queueId === queueId ? value : entry,
      ),
      historyPending: row
        ? [...current.historyPending, row]
        : current.historyPending,
    },
    value,
  });
}

/**
 * 計画TaskのQueue追加候補を導出する。
 * @responsibility 同一受付・発行時世代・Workspace結合を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、intakeEpoch: 発行時世代、input: 計画TaskのQueue属性。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function prepareQueueEntryCreation(
  current: Snapshot,
  intakeEpoch: string,
  input: QueueEnqueueInput,
) {
  const existing = current.queueEntries.find(
    (item) => item.queueId === input.queueId,
  );
  if (existing) {
    return snapshotIntakeMatches(current, {
      epoch: intakeEpoch,
      queueId: input.queueId,
      requestHash: input.requestHash,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
    })
      ? completed("orchestrator_queue_request_reused", {
          next: null,
          value: existing,
        })
      : blocked("orchestrator_queue_identity_conflict");
  }
  if (current.intakeEpoch !== intakeEpoch)
    return blocked("orchestrator_intake_epoch_retired");
  const value: ProjectQueueEntry = {
    ...input,
    workspaceId: input.workspaceId ?? null,
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
  };
  if (
    !validQueueEntry(value) ||
    value.singleTask !== undefined ||
    !current.projects.some((item) => item.projectId === value.projectId)
  )
    return blocked("orchestrator_queue_input_invalid");
  if (
    value.workspaceId != null &&
    (!current.queueEntries.some(
      (entry) =>
        entry.projectId === value.projectId &&
        entry.workspaceId === value.workspaceId,
    ) ||
      !current.workspaces.some(
        (entry) =>
          entry.workspaceId === value.workspaceId &&
          entry.phase === "ready" &&
          entry.holdUntil === null,
      ))
  )
    return blocked("orchestrator_workspace_not_ready");
  return completed("orchestrator_queue_entry_durable", {
    next: {
      ...current,
      queueEntries: [...current.queueEntries, value],
      intakeBindings: [
        ...current.intakeBindings,
        { queueId: value.queueId, epoch: intakeEpoch },
      ],
    },
    value,
  });
}

/**
 * 同じSnapshotからQueue一件を照会する。
 * @responsibility 不正ID・不存在・正常投影を既存理由で分ける。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、queueId: 対象ID。
 * @returns 元の結果封筒で固定候補又は投影を返す。
 * @precondition 既存短期Ownerがfresh SnapshotとRepository結合を検証済み。
 * @postcondition 元Snapshotと対象外の区画を変更しない。
 * @effect N/A: 同期の値操作だけ。
 * @failure 元の検査順と固定理由で拒否する。
 * @invariant 候補を保存完了、現在認可、実行順序決定や回復成立にしない。
 * @boundary Coordinatorの検証済み値と既存の単一Writer。
 * @security 保存Owner・任意Snapshot callback・実行Authorityを公開しない。
 * @concurrency 同じ短期Owner内のfresh元版へ適用し、保存CAS・解放は既存Writerが所有する。
 */
export function projectQueueEntry(current: Snapshot, queueId: string) {
  if (!validId(queueId)) return blocked("orchestrator_queue_input_invalid");
  const value = current.queueEntries.find((item) => item.queueId === queueId);
  return value
    ? completed("orchestrator_queue_observed", { next: null, value })
    : blocked("orchestrator_queue_observation_unknown");
}

/**
 * 候補生成の完了形を元の外側freezeだけで構築する。
 * @responsibility 保存完了でない既存三fieldを保持する。
 * @trace ARCH-000004
 * @input reason: 固定理由、value: 局所値。
 * @returns 既存完了封筒。
 * @precondition 局所検査済み。
 * @postcondition nested値はfreeze・cloneしない。
 * @effect N/A: 値構築のみ。
 * @failure N/A: 判定は用途別関数。
 * @invariant 保存・認可成立を表さない。
 * @boundary 非公開constructor。
 * @security Authorityなし。
 * @concurrency N/A: 状態なし。
 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/**
 * 拒否形を元の五fieldと外側freezeで構築する。
 * @responsibility 候補生成の拒否を保存失敗と混同しない。
 * @trace ARCH-000004
 * @input reason: 元の固定理由。
 * @returns 回復参照なしの拒否。
 * @precondition I/O未発行。
 * @postcondition 回復義務を生成しない。
 * @effect N/A: 値構築のみ。
 * @failure N/A: 判定は用途別関数。
 * @invariant 保存Ownerの失敗を覆わない。
 * @boundary 非公開constructor。
 * @security 秘密・Authorityなし。
 * @concurrency N/A: 状態なし。
 */
function blocked(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}
