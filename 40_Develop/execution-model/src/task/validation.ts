/**
 * Task・Queue・単独実行状態の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import type {
  ExecutionStoredManagedProject,
  ManagedExecution,
  ProjectExecutionState,
  Snapshot,
  StoredTask,
  TaskSettlementFact,
  UnifiedSnapshot,
} from "../state/types.ts";
import {
  decodeStateSnapshot,
  encodeStateValue,
  HASH,
  hasExecutionStateRecordKeys,
  hashExecutionProjectDefinition,
  hasStateKeys,
  historyRow,
  isPrincipalId,
  isStateObject,
  nullableCandidateId,
  nullableId,
  nullableRecoveryId,
  nullableResultReference,
  PROJECT_SNAPSHOT_SCHEMA,
  REVISION,
  singleTaskQueueIsConsistent,
  snapshotIntakeMatches,
  snapshotStateArray,
  snapshotStateRecord,
  stringArray,
  validateUnifiedTransition,
  validId,
  validResultReference,
  validSnapshot,
} from "../state/validation.ts";
import type {
  ExecutionSelection,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectResultAcceptance,
  ProjectTaskRecoveryObligation,
  QueueEnqueueInput,
  SingleTaskRecord,
  TaskExecutionSelections,
} from "./types.ts";

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
  const receipts = new Map(
    current.snapshot.resultReceipts.map((r) => [r.recoveryId, r]),
  );
  const newlyAccepted = new Set<string>();
  for (const state of states)
    for (const task of state.tasks) {
      for (const value of [
        ...task.resultAcceptances,
        ...task.recoveryObligations.flatMap((o) =>
          o.acknowledgement ? [o.acknowledgement] : [],
        ),
      ]) {
        const receipt = decodeProjectResultAcceptance(value);
        if (!receipt) return null;
        const previous = receipts.get(receipt.recoveryId);
        if (previous && encodeStateValue(previous) !== encodeStateValue(value))
          return null;
        if (!previous) {
          receipts.set(receipt.recoveryId, value);
          newlyAccepted.add(receipt.recoveryId);
        }
      }
    }
  const operations = current.snapshot.operations.filter(
    (o) => !newlyAccepted.has(o.recoveryId),
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
            identity.consumer === "orchestrator" &&
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
        resultAcceptances: _receipts,
        recoveryObligations: _obligations,
        ...record
      } = task;
      const recoveryObligations: StoredTask["recoveryObligations"][number][] =
        [];
      for (const o of task.recoveryObligations) {
        if (o.kind === "docker")
          recoveryObligations.push({
            kind: "docker",
            recoveryId: o.recoveryId,
          });
        else {
          if (o.phase === "acknowledged") return null;
          recoveryObligations.push({
            kind: o.kind,
            recoveryId: o.recoveryId,
            phase: o.phase,
          });
        }
      }
      tasks.push({
        ...record,
        settlement,
        recoveryObligations,
        resultAcceptanceIds: task.resultAcceptances.map((r) => r.recoveryId),
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
    resultReceipts: [...receipts.values()].filter((r) =>
      states.some((p) => p.projectId === r.projectId),
    ),
    pendingDeliveries: current.snapshot.pendingDeliveries.filter(
      (d) => !newlyAccepted.has(d.recoveryId),
    ),
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (r) =>
        !newlyAccepted.has(r.recoveryId) ||
        r.obligations.some((o) => o !== "result_delivery"),
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
    schemaRevision: 6,
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
 * Taskの公開値から保存する元事実・参照だけを組み立てる。
 * @responsibility 全Projectの受領を一度保持し、Operationと配送待ちを同じ候補から除く。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 検証済み元版、states: 業務候補、facts: 発生元が明示した同Attemptの結果不明。
 * @returns 保存区画、又は不正入力のnull。
 * @precondition 呼出し側が業務遷移・現在Ownerを照合する。
 * @postcondition 投影値をTask固有の元事実へ書き戻さない。
 * @effect N/A: 同期の値変換のみ。
 * @failure 孤立・重複・別Scopeの事実と受領差替えは拒否する。
 * @invariant 受領Hash・Docker義務phaseを複製しない。
 * @boundary Task公開値と単一保存値。
 * @security 値の成立は実資源・受領Authorityを証明しない。
 * @concurrency N/A: 保存排他は呼出し側が所有する。
 */
export function associateTaskOperations(
  snapshot: UnifiedSnapshot,
  operations: UnifiedSnapshot["operations"],
): UnifiedSnapshot["managedExecutions"] {
  return snapshot.managedExecutions.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      const recoveryIds = operations
        .filter((operation) => {
          if (operation.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(operation.identityJson);
          return (
            identity.consumer === "orchestrator" &&
            (identity.recoveryCorrelationId ?? identity.operationId) ===
              task.operationId
          );
        })
        .map((operation) => operation.recoveryId);
      if (recoveryIds.length === 0) return task;
      return {
        ...task,
        settlement: {
          kind: "operations" as const,
          recoveryIds,
          resultUnresolved:
            task.settlement.kind === "operations"
              ? task.settlement.resultUnresolved
              : task.settlement.kind === "executor_result" &&
                task.settlement.recoveryUnresolved,
        },
      };
    }),
  }));
}

/**
 * Task結果受領集合の遷移が固定本文・初回世代と競合するか判定する。
 * @responsibility 同一Attemptの受領不変と明示再計画の限定的な置換条件を所有する。
 * @trace ARCH-000004、ARCH-000008
 * @input previous: Lock内で読み直した元Project、state: 保存候補。
 * @returns 受領差が保存を拒否すべき場合だけtrue。
 * @precondition 両状態は構造検査済み。Writerが元世代と受付結合を別途照合する。
 * @postcondition 入力を変更せず、受領の欠測を補完しない。
 * @effect N/A: 同期値判定だけ。
 * @failure 初回受領の世代差・固定本文変更は競合。
 * @invariant 判定を実資源回収・保存成功へ読み替えない。
 * @boundary Taskの受領意味と統合保存Writer。
 * @security 保存・実行Authorityを発行しない。
 * @concurrency Writerは同じ短期Lock内のfresh元版に対して呼ぶ。
 */
export function hasProjectTaskResultAcceptanceConflict(
  previous: ProjectExecutionState | undefined,
  state: ProjectExecutionState,
): boolean {
  return state.tasks.some((task) => {
    if (!previous) return task.resultAcceptances.length !== 0;
    const prior = previous?.tasks.find(
      (item) => item.definition.id === task.definition.id,
    );
    const isSameAttempt =
      prior?.attemptId === task.attemptId &&
      prior?.operationId === task.operationId;
    if (
      prior?.state === "failed" &&
      prior.supersededBy === null &&
      task.state === "superseded" &&
      task.resultAcceptances.length === 0 &&
      task.supersededBy !== null &&
      !previous.tasks.some(
        (item) => item.definition.id === task.supersededBy,
      ) &&
      state.tasks.some(
        (item) =>
          item.definition.id === task.supersededBy &&
          item.definition.objectiveId === prior.definition.objectiveId &&
          item.attemptId === null &&
          item.operationId === null &&
          item.resultAcceptances.length === 0 &&
          (item.state === "ready" || item.state === "waiting_dependency"),
      )
    )
      return false;
    if (!isSameAttempt || !prior?.resultAcceptances.length)
      return task.resultAcceptances.some(
        (item) => item.settlementGeneration !== state.generation,
      );
    return (
      prior.resultAcceptances.length !== task.resultAcceptances.length ||
      prior.resultAcceptances.some((item) => {
        const next = task.resultAcceptances.find(
          (value) => value.recoveryId === item.recoveryId,
        );
        return (
          !next ||
          Object.entries(item).some(
            ([key, value]) => next[key as keyof typeof next] !== value,
          )
        );
      })
    );
  });
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
  record: SingleTaskRecord,
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

/**
 * 発行時の受付結合を同じSnapshotへ照合する。
 * @responsibility 新規受付又は同じ要求だけを受理候補にする。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、intake: 発行時の五項目。
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
export function inspectQueueIntake(
  current: Snapshot,
  intake: Parameters<typeof snapshotIntakeMatches>[1],
) {
  return snapshotIntakeMatches(current, intake)
    ? completed("orchestrator_intake_verified", {
        next: null,
        value: true as const,
      })
    : blocked("orchestrator_intake_epoch_retired");
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
    const epoch = current.intakeBindings.find(
      (item) => item.queueId === input.queueId,
    )?.epoch;
    return epoch === intakeEpoch &&
      existing.requestHash === input.requestHash &&
      existing.projectId === input.projectId &&
      existing.milestoneId === input.milestoneId
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
 * 新しい結果受理本文の閉じた形式を検査する。
 * @responsibility 欠落・追加項目・旧形式と不正な識別子、Hash、世代を拒否する。
 * @trace ARCH-000004
 * @input value: 未検証の受理本文。
 * @returns 検査済み固定本文、またはnull。
 * @precondition N/A: 任意の入力を拒否可能な境界として扱う。
 * @postcondition 初回受理世代や入力の値を補完・更新しない。
 * @effect N/A: 局所値の検査だけ。
 * @failure 不正本文、getter、Proxy、欠落、旧項目、空値はnull。
 * @invariant 形式成立を保存・受理・cleanup成立へ昇格しない。
 * @boundary 上位の保存本文とその利用側。
 * @security 外部Authorityを発行せず入力の関数を呼ばない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function decodeProjectResultAcceptance(
  value: unknown,
): ProjectResultAcceptance | null {
  const acceptance = snapshotStateRecord(
    value,
    new Set([
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "repositoryBinding",
      "resultId",
      "consumer",
    ]),
  );
  if (
    !acceptance ||
    [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
    ].some(
      (key) =>
        typeof acceptance[key] !== "string" ||
        acceptance[key].length === 0 ||
        acceptance[key].length > 1024,
    ) ||
    !Number.isSafeInteger(acceptance.settlementGeneration) ||
    Number(acceptance.settlementGeneration) < 1 ||
    acceptance.consumer !== "orchestrator" ||
    [acceptance.repositoryBinding, acceptance.resultId].some(
      (item) => typeof item !== "string" || !/^[a-f0-9]{64}$/u.test(item),
    )
  )
    return null;
  return Object.freeze(acceptance) as ProjectResultAcceptance;
}

/**
 * Coordinator 状態が有効か判定する。
 *
 * @responsibility Coordinator 状態の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectExecutionStateを返す。
 * @precondition 「value: unknown」がvalidStateの入力契約を満たす。
 * @postcondition validStateの責務を完了した結果だけを返す。
 * @effect N/A: validStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validStateは独自の失敗分岐を所有しない。
 * @invariant validStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validStateはProcess内の同一Subsystemで完結する。
 * @security validStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validStateは共有非同期状態を持たない同期処理である。
 */
export function validState(value: unknown): value is ProjectExecutionState {
  if (
    !isStateObject(value) ||
    !hasStateKeys(value, [
      "contract",
      "taskExecutionSelections",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "ownerGeneration",
      "decisionApplicationId",
      "maximumConcurrency",
      "milestone",
      "objectives",
      "tasks",
    ]) ||
    value.contract !== "crdd-coordinator/project-state/v2" ||
    !inspectTaskExecutionSelections(value.taskExecutionSelections) ||
    !validId(value.projectId) ||
    !validId(value.milestoneId) ||
    typeof value.repositoryRevision !== "string" ||
    !REVISION.test(value.repositoryRevision) ||
    !Number.isSafeInteger(value.generation) ||
    Number(value.generation) < 1 ||
    !validId(value.ownerGeneration) ||
    !nullableId(value.decisionApplicationId) ||
    !Number.isSafeInteger(value.maximumConcurrency) ||
    Number(value.maximumConcurrency) < 1 ||
    Number(value.maximumConcurrency) > 5 ||
    !isStateObject(value.milestone) ||
    !hasStateKeys(value.milestone, [
      "id",
      "acceptanceCriteria",
      "state",
      "criterionEvidenceIds",
    ]) ||
    value.milestone.id !== value.milestoneId ||
    !stringArray(value.milestone.acceptanceCriteria) ||
    !stringArray(value.milestone.criterionEvidenceIds) ||
    !new Set([
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ]).has(String(value.milestone.state)) ||
    !Array.isArray(value.objectives) ||
    value.objectives.length < 1 ||
    !Array.isArray(value.tasks) ||
    value.tasks.length < 1
  )
    return false;

  const objectiveIds = new Set<string>();
  for (const objective of value.objectives) {
    if (
      !isStateObject(objective) ||
      !hasStateKeys(objective, [
        "definition",
        "state",
        "criterionEvidenceIds",
      ]) ||
      !isStateObject(objective.definition) ||
      !hasStateKeys(objective.definition, ["id", "acceptanceCriteria"]) ||
      !validId(objective.definition.id) ||
      objectiveIds.has(objective.definition.id) ||
      !stringArray(objective.definition.acceptanceCriteria) ||
      !stringArray(objective.criterionEvidenceIds) ||
      !new Set([
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "returned",
        "blocked",
        "cancelled",
      ]).has(String(objective.state))
    )
      return false;
    objectiveIds.add(objective.definition.id);
  }

  const taskIds = new Set<string>();
  const dependencies: Array<readonly string[]> = [];
  for (const task of value.tasks) {
    const definition = isStateObject(task) ? task.definition : null;
    const taskDependencies = isStateObject(definition)
      ? definition.dependencies
      : null;
    const allowedPaths = isStateObject(definition)
      ? definition.allowedPaths
      : null;
    const conflictKeys = isStateObject(definition)
      ? definition.conflictKeys
      : null;
    if (
      !isStateObject(task) ||
      !hasStateKeys(task, [
        "definition",
        "state",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "startPhase",
        "cleanupConfirmed",
        "recoveryObligations",
        "resultAcceptances",
        "recoveryUnresolved",
        "candidateId",
        "retryCount",
        "supersededBy",
      ]) ||
      !isStateObject(task.definition) ||
      !hasStateKeys(task.definition, [
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ]) ||
      !validId(task.definition.id) ||
      taskIds.has(task.definition.id) ||
      !validId(task.definition.objectiveId) ||
      !objectiveIds.has(task.definition.objectiveId) ||
      !stringArray(taskDependencies) ||
      !stringArray(allowedPaths) ||
      allowedPaths.length < 1 ||
      !stringArray(conflictKeys) ||
      !new Set([
        "planned",
        "waiting_dependency",
        "ready",
        "starting",
        "running",
        "cleanup_pending",
        "completed",
        "failed",
        "cancelled",
        "recovery_required",
        "superseded",
      ]).has(String(task.state)) ||
      !nullableId(task.attemptId) ||
      !nullableId(task.operationId) ||
      !nullableId(task.authorityBindingId) ||
      !["none", "reserved", "handoff_prepared", "running", "settled"].includes(
        String(task.startPhase),
      ) ||
      typeof task.cleanupConfirmed !== "boolean" ||
      !recoveryObligations(task.recoveryObligations, {
        projectId: String(value.projectId),
        milestoneId: String(value.milestoneId),
        taskId: String(task.definition.id),
        generation: Number(value.generation),
      }) ||
      typeof task.recoveryUnresolved !== "boolean" ||
      (task.state === "recovery_required" &&
        task.recoveryObligations.length === 0 &&
        task.recoveryUnresolved !== true) ||
      (task.state !== "recovery_required" &&
        task.recoveryUnresolved === true) ||
      (task.state === "ready" &&
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        )) ||
      (!["ready", "recovery_required"].includes(String(task.state)) &&
        task.recoveryObligations.length > 0) ||
      !resultAcceptances(task.resultAcceptances, {
        projectId: String(value.projectId),
        milestoneId: String(value.milestoneId),
        generation: Number(value.generation),
        task: task as unknown as ProjectExecutionState["tasks"][number],
      }) ||
      !validTaskLifecycleTuple(
        task as unknown as ProjectExecutionState["tasks"][number],
      ) ||
      !nullableCandidateId(task.candidateId) ||
      !Number.isSafeInteger(task.retryCount) ||
      Number(task.retryCount) < 0 ||
      !nullableId(task.supersededBy)
    )
      return false;
    taskIds.add(task.definition.id);
    dependencies.push(taskDependencies as readonly string[]);
  }
  return dependencies.every((items) => items.every((id) => taskIds.has(id)));
}

/**
 * Queue Entryが有効か判定する。
 *
 * @responsibility Queue Entryの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectQueueEntryを返す。
 * @precondition 「value: unknown」がvalidQueueEntryの入力契約を満たす。
 * @postcondition validQueueEntryの責務を完了した結果だけを返す。
 * @effect N/A: validQueueEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validQueueEntryは独自の失敗分岐を所有しない。
 * @invariant validQueueEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validQueueEntryはProcess内の同一Subsystemで完結する。
 * @security validQueueEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validQueueEntryは共有非同期状態を持たない同期処理である。
 */
export function validQueueEntry(value: unknown): value is ProjectQueueEntry {
  return (
    isStateObject(value) &&
    hasStateKeys(value, [
      "queueId",
      "projectId",
      "milestoneId",
      "requestHash",
      "originLane",
      "repositoryRevision",
      "scopeHash",
      "state",
      "generation",
      "ownerGeneration",
      "resumeCondition",
      "resultReference",
      "workspaceId",
      ...(Object.hasOwn(value, "singleTask") ? ["singleTask"] : []),
    ]) &&
    validId(value.queueId) &&
    validId(value.projectId) &&
    (Object.hasOwn(value, "singleTask")
      ? value.milestoneId === null &&
        inspectSingleTaskRecord(value.singleTask) !== null &&
        singleTaskQueueIsConsistent(
          value as unknown as ProjectQueueEntry,
          value.singleTask as SingleTaskRecord,
        )
      : validId(value.milestoneId)) &&
    typeof value.requestHash === "string" &&
    HASH.test(value.requestHash) &&
    (value.originLane === "interactive" || value.originLane === "scheduled") &&
    typeof value.repositoryRevision === "string" &&
    REVISION.test(value.repositoryRevision) &&
    typeof value.scopeHash === "string" &&
    HASH.test(value.scopeHash) &&
    PROJECT_QUEUE_STATES.has(value.state as ProjectQueueState) &&
    Number.isSafeInteger(value.generation) &&
    Number(value.generation) >= 1 &&
    nullableId(value.ownerGeneration) &&
    nullableId(value.resumeCondition) &&
    nullableResultReference(value.resultReference) &&
    (value.workspaceId === null ||
      (typeof value.workspaceId === "string" &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
          value.workspaceId,
        )))
  );
}

/**
 * 本番利用側に固定された結果受領方式を返す。
 * @responsibility 一時的な返却と後続再開用の耐久ACKを区別する。
 * @trace ARCH-000008
 * @input consumer: 固定組立てが選択した利用側識別子。
 * @returns transient、durable、または未知利用側のnull。
 * @precondition N/A: 未知値も受け取り拒否する。
 * @postcondition Coordinatorの耐久受領を入力指定で降格しない。
 * @effect N/A: 値の同期判定だけで保存や配送を行わない。
 * @failure 未知識別子・非文字列ではnull。
 * @invariant 受領方式は資源回収やCandidate保全の証明ではない。
 * @boundary 本番組立ての利用側と保存モデルの固定契約。
 * @security Objectの変換・getter・Proxyを評価しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function getConsumerCompletionPolicy(
  consumer: unknown,
): "transient" | "durable" | null {
  if (consumer === "orchestrator") return "durable";
  if (consumer === "coordinator_cli" || consumer === "workbench")
    return "transient";
  return null;
}

/**
 * recovery Obligationsを決定する。
 *
 * @responsibility recovery Obligationsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: 未検証の回復義務、scope: 保存状態のProject・節目・Task・世代。
 * @returns value is readonly ProjectTaskRecoveryObligation[]を返す。
 * @precondition 「value: unknown」がrecoveryObligationsの入力契約を満たす。
 * @postcondition recoveryObligationsの責務を完了した結果だけを返す。
 * @effect N/A: recoveryObligationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryObligationsは独自の失敗分岐を所有しない。
 * @invariant recoveryObligationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryObligationsはProcess内の同一Subsystemで完結する。
 * @security recoveryObligationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryObligationsは共有非同期状態を持たない同期処理である。
 */
export function recoveryObligations(
  value: unknown,
  scope: Readonly<{
    projectId: string;
    milestoneId: string;
    taskId: string;
    generation: number;
  }>,
): value is readonly ProjectTaskRecoveryObligation[] {
  if (!Array.isArray(value)) return false;
  const identities = new Set<string>();
  for (const entry of value) {
    const acknowledgement = decodeProjectResultAcceptance(
      entry?.acknowledgement,
    );
    const isValidAcknowledgement =
      acknowledgement !== null &&
      [
        acknowledgement.repositoryBindingId,
        acknowledgement.projectId,
        acknowledgement.milestoneId,
        acknowledgement.taskId,
        acknowledgement.attemptId,
        acknowledgement.operationId,
      ].every(validId) &&
      nullableRecoveryId(acknowledgement.recoveryId) &&
      acknowledgement.recoveryId !== null &&
      acknowledgement.projectId === scope.projectId &&
      acknowledgement.milestoneId === scope.milestoneId &&
      acknowledgement.taskId === scope.taskId &&
      acknowledgement.settlementGeneration <= scope.generation;
    if (
      !isStateObject(entry) ||
      !hasStateKeys(
        entry,
        entry.phase === "acknowledged"
          ? ["kind", "recoveryId", "phase", "acknowledgement"]
          : ["kind", "recoveryId", "phase"],
      ) ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !nullableRecoveryId(entry.recoveryId) ||
      entry.recoveryId === null ||
      !["required", "recovering", "settled", "acknowledged"].includes(
        String(entry.phase),
      ) ||
      (entry.phase === "acknowledged" &&
        (entry.kind !== "docker" ||
          !isValidAcknowledgement ||
          acknowledgement?.recoveryId !== entry.recoveryId))
    )
      return false;
    const identity = `${entry.kind}\0${entry.recoveryId}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}

/**
 * 通常Taskの受領集合と保存世代の相関を検査する。
 * @responsibility 回復義務とは別の固定受領本文をSnapshotの閉集合へ接続する。
 * @trace ARCH-000004
 * @input value: 保存本文、scope: Project・節目・世代と検査済みTask。
 * @returns 全要素の形式・相関・終端条件が成立するか。
 * @precondition Taskの基本項目と回復義務は先行して検査済みである。
 * @postcondition 未記載を空配列へ補完せず、旧Attemptや未来世代を拒否する。
 * @effect N/A: 保存値の検査だけ。
 * @failure 不正本文、重複、非終端受領、未解決義務はfalse。
 * @invariant ACKの有無を資源不存在の証明にしない。
 * @boundary 単一現在Snapshotの保存・読戻し。
 * @security 任意関数を受領本文として実行しない。
 * @concurrency N/A: 同期値検査であり排他は既存保存Ownerが所有する。
 */
export function resultAcceptances(
  value: unknown,
  scope: Readonly<{
    projectId: string;
    milestoneId: string;
    generation: number;
    task: ProjectExecutionState["tasks"][number];
  }>,
): boolean {
  if (!Array.isArray(value)) return false;
  const task = scope.task;
  if (
    value.length > 0 &&
    (!["completed", "failed", "cancelled"].includes(task.state) ||
      task.startPhase !== "settled" ||
      !task.cleanupConfirmed ||
      task.recoveryUnresolved ||
      task.recoveryObligations.some(
        (entry) =>
          entry.phase !==
          (entry.kind === "docker" ? "acknowledged" : "settled"),
      ))
  )
    return false;
  const identities = new Set<string>();
  let repositoryBindingId: string | null = null;
  let repositoryBinding: string | null = null;
  let settlementGeneration: number | null = null;
  for (const valueEntry of value) {
    const entry = decodeProjectResultAcceptance(valueEntry);
    if (
      !entry ||
      ![
        entry.repositoryBindingId,
        entry.projectId,
        entry.milestoneId,
        entry.taskId,
        entry.attemptId,
        entry.operationId,
      ].every(validId) ||
      entry.projectId !== scope.projectId ||
      entry.milestoneId !== scope.milestoneId ||
      entry.taskId !== task.definition.id ||
      entry.attemptId !== task.attemptId ||
      entry.operationId !== task.operationId ||
      entry.settlementGeneration > scope.generation ||
      !nullableRecoveryId(entry.recoveryId) ||
      identities.has(entry.recoveryId) ||
      task.recoveryObligations.some(
        (obligation) => obligation.recoveryId === entry.recoveryId,
      ) ||
      (repositoryBindingId !== null &&
        repositoryBindingId !== entry.repositoryBindingId) ||
      (repositoryBinding !== null &&
        repositoryBinding !== entry.repositoryBinding) ||
      (settlementGeneration !== null &&
        settlementGeneration !== entry.settlementGeneration)
    )
      return false;
    identities.add(entry.recoveryId);
    repositoryBindingId = entry.repositoryBindingId;
    repositoryBinding = entry.repositoryBinding;
    settlementGeneration = entry.settlementGeneration;
  }
  return true;
}

/**
 * Task Lifecycle Tupleが有効か判定する。
 *
 * @responsibility Task Lifecycle Tupleの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input task: ProjectExecutionState["tasks"][number]
 * @returns validTaskLifecycleTupleの計算結果を返す。
 * @precondition 「task: ProjectExecutionState["tasks"][number]」がvalidTaskLifecycleTupleの入力契約を満たす。
 * @postcondition validTaskLifecycleTupleの責務を完了した結果だけを返す。
 * @effect N/A: validTaskLifecycleTupleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTaskLifecycleTupleは独自の失敗分岐を所有しない。
 * @invariant validTaskLifecycleTupleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTaskLifecycleTupleはProcess内の同一Subsystemで完結する。
 * @security validTaskLifecycleTupleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTaskLifecycleTupleは共有非同期状態を持たない同期処理である。
 */
export function validTaskLifecycleTuple(
  task: ProjectExecutionState["tasks"][number],
) {
  const isAttempt = task.attemptId !== null;
  const isOperation = task.operationId !== null;
  const isAuthority = task.authorityBindingId !== null;
  if (["planned", "waiting_dependency", "ready"].includes(task.state))
    return (
      task.startPhase === "none" && !isAttempt && !isOperation && !isAuthority
    );
  if (task.state === "starting" && task.startPhase === "reserved")
    return isAttempt && !isOperation && isAuthority;
  if (task.state === "starting" && task.startPhase === "handoff_prepared")
    return isAttempt && isOperation && isAuthority;
  if (task.state === "running")
    return (
      task.startPhase === "running" && isAttempt && isOperation && isAuthority
    );
  if (
    [
      "cleanup_pending",
      "completed",
      "failed",
      "cancelled",
      "recovery_required",
      "superseded",
    ].includes(task.state)
  )
    return (
      task.startPhase === "settled" && isAttempt && isOperation && isAuthority
    );
  return false;
}

/**
 * 保存する単発記録を閉検査し独立Snapshotにする。
 * @responsibility getter／Proxyと本文混入、終端の相関違反を拒否する。
 * @trace ARCH-000004
 * @input 未検証の記録。
 * @returns 検証済み凍結値、又はnull。
 * @precondition Authorityは呼出し元で検証する。
 * @postcondition 元入力の後続変更から分離する。
 * @effect なし。
 * @failure 不足・過剰・相関不一致はnull。
 * @invariant 不明を成功・回復なしへ丸めない。
 * @boundary Snapshot codec。
 * @security 保存fieldを固定し秘密・本文を許可しない。
 * @concurrency 同期の値検査のみ。
 */
export function inspectSingleTaskRecord(raw: unknown): SingleTaskRecord | null {
  const value =
    snapshotStateRecord(raw, KEYS) ??
    snapshotStateRecord(raw, new Set([...KEYS, "adviceOperation"]));
  if (
    !value ||
    Object.keys(value).length !==
      KEYS.size + (Object.hasOwn(value, "adviceOperation") ? 1 : 0)
  )
    return null;
  const adviceOperation = Object.hasOwn(value, "adviceOperation")
    ? snapshotStateRecord(
        value.adviceOperation,
        new Set(["operationId", "hostRecoveryId"]),
      )
    : null;
  if (
    Object.hasOwn(value, "adviceOperation") &&
    (!adviceOperation ||
      Object.keys(adviceOperation).length !== 2 ||
      typeof adviceOperation.operationId !== "string" ||
      !ID.test(adviceOperation.operationId) ||
      typeof adviceOperation.hostRecoveryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(
        adviceOperation.hostRecoveryId,
      ) ||
      value.mode !== "read_only_advice" ||
      value.phase === "accepted")
  )
    return null;
  if (!isPrincipalId(value.principalId)) return null;
  for (const key of ["taskId", "attemptId", "operationId"])
    if (typeof value[key] !== "string" || !ID.test(value[key])) return null;
  if (
    typeof value.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(value.mode) ||
    !inspectExecutionSelection(value.executionSelection) ||
    inspectExecutionSelection(value.executionSelection)?.role !==
      (value.mode === "read_only_advice" ? "advice" : "executor") ||
    typeof value.phase !== "string" ||
    !["accepted", "starting", "running", "settled"].includes(value.phase) ||
    typeof value.status !== "string" ||
    !["pending", "completed", "blocked", "cancelled", "unknown"].includes(
      value.status,
    ) ||
    typeof value.cleanupConfirmed !== "boolean" ||
    !(
      value.reason === null ||
      (typeof value.reason === "string" &&
        /^[a-z][a-z0-9_]{0,255}$/u.test(value.reason))
    )
  )
    return null;
  const recoveries = snapshotStateArray(
    value.recoveryIds,
    Number.MAX_SAFE_INTEGER,
  );
  if (recoveries.status !== "ok") return null;
  const recoveryIds: string[] = [];
  for (const recoveryId of recoveries.value) {
    if (
      typeof recoveryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(recoveryId)
    )
      return null;
    recoveryIds.push(recoveryId);
  }
  if (new Set(recoveryIds).size !== recoveryIds.length) return null;
  if (value.phase !== "settled") {
    if (
      value.status !== "pending" ||
      value.reason !== null ||
      value.cleanupConfirmed ||
      recoveryIds.length
    )
      return null;
  } else if (
    value.status === "pending" ||
    (["completed", "cancelled"].includes(value.status) &&
      (!value.cleanupConfirmed || recoveryIds.length))
  )
    return null;
  return Object.freeze({
    ...value,
    executionSelection: inspectExecutionSelection(value.executionSelection),
    ...(adviceOperation
      ? { adviceOperation: Object.freeze(adviceOperation) }
      : {}),
    recoveryIds: Object.freeze(recoveryIds),
  }) as SingleTaskRecord;
}

export const PROJECT_QUEUE_STATES = new Set<ProjectQueueState>([
  "queued",
  "leased",
  "running",
  "waiting_foreground",
  "integration_pending",
  "replan_required",
  "human_decision_required",
  "recovery_required",
  "completed",
  "cancelled",
]);

export const KEYS = new Set([
  "principalId",
  "mode",
  "executionSelection",
  "taskId",
  "attemptId",
  "operationId",
  "phase",
  "status",
  "reason",
  "cleanupConfirmed",
  "recoveryIds",
]);

export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * 保存された選定を現在Catalogで解き直さず独立値へ取り出す。
 * @responsibility 選定の十項目と相関だけを閉じて検査する。
 * @trace ARCH-000004
 * @input candidate: 保存済み又は搬送された未信頼選定。
 * @returns 不変な選定値、又はnull。
 * @precondition 新規実行の技術可否は別の技術Catalog検査を通す。
 * @postcondition alias・選定元・当時の内容Identityをそのまま保持する。
 * @effect N/A: 同期的な値検査と独立Objectの構築だけ。
 * @failure 不足・過剰・実行Property・相関不正はnull。
 * @invariant 復元成功は現在の実行許可や利用可能性を意味しない。
 * @boundary 保存選定とTask／Packetの値搬送。
 * @security Proxy・Getterを実行せず、Authorityを生成しない。
 * @concurrency 一度捕捉したdata descriptorの値だけを使用する。
 */
export function inspectExecutionSelection(
  candidate: unknown,
): ExecutionSelection | null {
  try {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      types.isProxy(candidate)
    )
      return null;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const keys = [
      "provider",
      "modelIdentifier",
      "identifierKind",
      "reasoningEffort",
      "purpose",
      "catalogIdentity",
      "configIdentity",
      "role",
      "workType",
      "source",
    ] as const;
    const actual = Reflect.ownKeys(descriptors);
    if (
      actual.length !== keys.length ||
      actual.some(
        (key) =>
          typeof key !== "string" || !keys.some((expected) => expected === key),
      )
    )
      return null;
    const value: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.enumerable !== true ||
        Object.hasOwn(descriptor, "get") ||
        Object.hasOwn(descriptor, "set")
      )
        return null;
      value[key] = descriptor.value;
    }
    if (
      (value.provider !== "codex" && value.provider !== "claude") ||
      typeof value.modelIdentifier !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.modelIdentifier) ||
      (value.identifierKind !== "exact" && value.identifierKind !== "alias") ||
      typeof value.reasoningEffort !== "string" ||
      !["low", "medium", "high", "xhigh", "max"].includes(
        value.reasoningEffort,
      ) ||
      (value.purpose !== "advice" && value.purpose !== "task") ||
      typeof value.catalogIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.catalogIdentity) ||
      typeof value.configIdentity !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.configIdentity) ||
      typeof value.role !== "string" ||
      ![
        "coordinator",
        "executor",
        "independent_reviewer",
        "result_integration",
        "advice",
      ].includes(value.role) ||
      !(
        value.workType === null ||
        (typeof value.workType === "string" &&
          /^[a-z0-9][a-z0-9._-]*$/u.test(value.workType))
      ) ||
      typeof value.source !== "string" ||
      !["explicit", "work_type_override", "role_default"].includes(
        value.source,
      ) ||
      (value.source === "work_type_override" && value.workType === null) ||
      value.purpose !==
        (["executor", "independent_reviewer"].includes(value.role)
          ? "task"
          : "advice")
    )
      return null;
    return Object.freeze({ ...value }) as ExecutionSelection;
  } catch {
    return null;
  }
}

/**
 * 保存済みの役割別選定を現在設定で解き直さず検査する。
 * @responsibility stage間で選定組を混ぜない閉形式codecを所有する。
 * @trace ARCH-000004
 * @input candidate: 未信頼の二役割選定。
 * @returns 独立した不変値、不正時null。
 * @precondition 実行可否と認可は別のOwnerが確認する。
 * @postcondition 元のModel・alias・分類・選定元を維持する。
 * @effect N/A: 局所値検査だけ。
 * @failure 不足・過剰・Proxy・accessor・相関不正はnull。
 * @invariant 現在Catalog・設定Store・I/Oを参照しない。
 * @boundary 保存codecと実行Owner。
 * @security 選定の復元を実行許可にしない。
 * @concurrency 同期処理で元入力へ書き込まない。
 */
export function inspectTaskExecutionSelections(
  candidate: unknown,
): TaskExecutionSelections | null {
  if (!candidate || typeof candidate !== "object" || types.isProxy(candidate))
    return null;
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  if (Reflect.ownKeys(descriptors).length !== 2) return null;
  const values = ["executor", "reviewer"].map((key) => {
    const descriptor = descriptors[key];
    return descriptor && "value" in descriptor && descriptor.enumerable
      ? inspectExecutionSelection(descriptor.value)
      : null;
  });
  const [executor, reviewer] = values;
  if (
    !executor ||
    !reviewer ||
    executor.role !== "executor" ||
    reviewer.role !== "independent_reviewer" ||
    reviewer.source === "explicit" ||
    executor.configIdentity !== reviewer.configIdentity ||
    executor.catalogIdentity !== reviewer.catalogIdentity ||
    executor.workType !== reviewer.workType
  )
    return null;
  return Object.freeze({ executor, reviewer });
}

/**
 * 確定済み実行入力の非Authority Identityを導く。
 * @responsibility Provider・選定元・当時の構成を正規化順序のままHash化する。
 * @trace ARCH-000004
 * @input candidate: 十項目の未信頼な選定候補。
 * @returns 正規SHA-256又は不正時null。
 * @precondition 実行可否・認可は別Ownerが検査する。
 * @postcondition 元値を変更せず当時の値を保持する。
 * @effect N/A: 値検査と局所Hash計算のみ。
 * @failure 型・相関不正はnull。
 * @invariant Hashを実行Authorityにしない。
 * @boundary Task・Packet・保存選定の値相関。
 * @security 設定Storeや現在Catalogへアクセスしない。
 * @concurrency 同期で独立Snapshotだけを使用する。
 */
export function hashExecutionSelection(candidate: unknown): string | null {
  const value = inspectExecutionSelection(candidate);
  return value
    ? createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")
    : null;
}
