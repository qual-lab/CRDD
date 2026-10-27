/**
 * Task更新の保存候補と受領相関を所有する。
 * @packageDocumentation
 * @responsibility 既存の世代・元結果・exact参照を一つの候補へまとめる。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 純粋な値操作。保存・実行・現在Authorityの発行は行わない。
 */
import type { CoordinatorSnapshot } from "../state/types.ts";
import { COORDINATOR_PROJECT_SNAPSHOT_SCHEMA } from "../state/validation.ts";
import { plainObject } from "../state/validation.ts";
import { validCoordinatorSnapshot } from "../state/validation.ts";
import type {
  CoordinatorState,
  CoordinatorStoredTask,
  CoordinatorTaskSettlementFact,
  CoordinatorUnifiedSnapshot,
  RuntimeManagedExecution,
  RuntimeStoredManagedProject,
} from "../state/types.ts";
import {
  decodeRuntimeDomainSnapshot,
  exactRecordKeys,
  hashRuntimeProjectDefinition,
} from "../state/validation.ts";
import {
  validCoordinatorState,
  decodeProjectResultAcceptance,
} from "./validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import { validateCoordinatorUnifiedTransition } from "../state/transition.ts";

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
export function prepareCoordinatorUnifiedTaskSnapshot(
  currentBytes: unknown,
  stateValue: unknown,
  expectedGeneration: unknown,
  repositoryBinding: unknown,
  resultFacts: unknown = [],
): Buffer | null {
  try {
    const current = decodeRuntimeDomainSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const state: unknown = JSON.parse(encodeRuntimeStateValue(stateValue));
    const facts: unknown = JSON.parse(encodeRuntimeStateValue(resultFacts));
    if (
      !current ||
      current.snapshot.repositoryBindingId === null ||
      !validCoordinatorState(state) ||
      !Number.isSafeInteger(expectedGeneration) ||
      Number(expectedGeneration) < 0 ||
      state.generation !== Number(expectedGeneration) + 1 ||
      (current.snapshot.projects.find((p) => p.projectId === state.projectId)
        ?.generation ?? 0) !== expectedGeneration ||
      !Array.isArray(facts) ||
      !facts.every((f) =>
        exactRecordKeys(f, [
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
    const sections = normalizeCoordinatorTaskProjects(
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
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    const decoded = decodeRuntimeDomainSnapshot(bytes, repositoryBinding);
    return decoded &&
      validateCoordinatorUnifiedTransition(
        currentBytes,
        bytes,
        repositoryBinding,
      ) &&
      encodeRuntimeStateValue(
        decoded.projects.find((p) => p.projectId === state.projectId),
      ) === encodeRuntimeStateValue(state)
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
export function normalizeCoordinatorTaskProjects(
  current: NonNullable<ReturnType<typeof decodeRuntimeDomainSnapshot>>,
  states: readonly CoordinatorState[],
  facts: unknown,
) {
  if (
    !states.every(validCoordinatorState) ||
    !Array.isArray(facts) ||
    !facts.every(
      (f, i) =>
        exactRecordKeys(f, [
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
        if (
          previous &&
          encodeRuntimeStateValue(previous) !== encodeRuntimeStateValue(value)
        )
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
  const projects: RuntimeStoredManagedProject[] = [];
  for (const state of states) {
    const tasks: CoordinatorStoredTask[] = [];
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
      const settlement: CoordinatorTaskSettlementFact = matching.length
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
      const recoveryObligations: CoordinatorStoredTask["recoveryObligations"][number][] =
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
  const managedExecutions: RuntimeManagedExecution[] = projects.map(
    (project) => {
      const definition = definitions.find(
        (item) => item.projectId === project.projectId,
      );
      if (!definition) throw new Error("definition");
      return {
        projectId: project.projectId,
        milestoneId: project.milestoneId,
        definitionHash: hashRuntimeProjectDefinition(definition),
        taskExecutionSelections: project.taskExecutionSelections,
        ownerGeneration: project.ownerGeneration,
        maximumConcurrency: project.maximumConcurrency,
        tasks: project.tasks.map(({ definition: taskDefinition, ...task }) => ({
          ...task,
          taskId: taskDefinition.id,
        })),
      };
    },
  );
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
export function projectCoordinatorTaskSnapshot(
  decoded: NonNullable<ReturnType<typeof decodeRuntimeDomainSnapshot>>,
  repositoryRootHash: string,
): CoordinatorSnapshot | null {
  const s = decoded.snapshot;
  if (s.repositoryBindingId === null || s.intakeEpoch === null) return null;
  return {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
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
    acceptanceDecisions: s.acceptanceDecisions,
    decisionRecoveries: s.decisionRecoveries,
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
export function prepareCoordinatorUnifiedTaskSections(
  currentBytes: unknown,
  viewValue: unknown,
  repositoryBinding: unknown,
  rootHash: string,
  factsValue: unknown = [],
): Buffer | null {
  try {
    const current = decodeRuntimeDomainSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const view: unknown = JSON.parse(encodeRuntimeStateValue(viewValue));
    const facts: unknown = JSON.parse(encodeRuntimeStateValue(factsValue));
    if (
      !current ||
      !plainObject(view) ||
      !validCoordinatorSnapshot(
        view,
        String(view.repositoryBindingId),
        rootHash,
      ) ||
      view.snapshotRevision !== current.snapshot.revision + 1
    )
      return null;
    const sections = normalizeCoordinatorTaskProjects(
      current,
      view.projects,
      facts,
    );
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
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    const decoded = decodeRuntimeDomainSnapshot(bytes, repositoryBinding);
    return decoded &&
      validateCoordinatorUnifiedTransition(
        currentBytes,
        bytes,
        repositoryBinding,
      ) &&
      encodeRuntimeStateValue(
        projectCoordinatorTaskSnapshot(decoded, rootHash),
      ) === encodeRuntimeStateValue(view)
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
export function associateCoordinatorTaskOperations(
  snapshot: CoordinatorUnifiedSnapshot,
  operations: CoordinatorUnifiedSnapshot["operations"],
): CoordinatorUnifiedSnapshot["managedExecutions"] {
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
  previous: CoordinatorState | undefined,
  state: CoordinatorState,
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
