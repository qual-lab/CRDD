/**
 * state/settlement.tsの値契約と判定を所有する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008
 */
import { validQueueEntry } from "../task/validation.ts";
import { COORDINATOR_DURABLE_FOUNDATION_CONTRACT } from "../storage/state.ts";
import { validLeaseEvidence } from "../storage/state.ts";
import type { LeaseEvidenceEnvelope } from "../storage/state.ts";
import { validCoordinatorResultRecord } from "../workspace/record.ts";
import { leaseAcquisitionRecoveryId } from "./validation.ts";
import { leaseIdentity } from "./validation.ts";
import { digest } from "./validation.ts";
import { historyRow } from "../storage/history.ts";
import type { CoordinatorAcceptanceDecisionEnvelope } from "../decision/records.ts";
import { validCoordinatorAcceptanceDecisionEnvelope } from "../decision/records.ts";
import { validCoordinatorDecisionRecoveryIntent } from "../decision/records.ts";
import { validCoordinatorWorkspace } from "../workspace/record.ts";
import type { CoordinatorTaskSettlementFact } from "../storage/state.ts";
import type { CoordinatorStoredTask } from "../storage/state.ts";
import type { CoordinatorUnifiedSnapshot } from "../storage/state.ts";
import type { decodeCoordinatorUnifiedSnapshot } from "../storage/state.ts";
import { exactRecordKeys } from "./validation.ts";
import { validCoordinatorState } from "../task/validation.ts";
import type { CoordinatorState } from "./types.ts";
import { decodeProjectResultAcceptance } from "../task/acceptance.ts";
import type { CoordinatorSnapshot } from "../storage/state.ts";
import { HASH } from "./validation.ts";
import { validId } from "./validation.ts";
import { coordinatorTaskResourcesAreSettled } from "../execution/validation.ts";
import type { CoordinatorStateSnapshot } from "../storage/state.ts";
import { exactKeys } from "./validation.ts";
import { plainObject } from "./validation.ts";
import { encodeCoordinatorStateValue } from "./validation.ts";
import { types } from "node:util";
import { isDockerRestartCheckpointSettled } from "../execution/result.ts";

/**
 * Task固有の元事実と参照した技術記録から状態を投影する。
 * @responsibility cleanupと結果不明を別に導出し、欠落参照を成功へ畳まない。
 * @trace ARCH-000004、ARCH-000008
 * @input input: Task境界の元事実、snapshot: codecで検証済みの技術現在区画。
 * @returns 二つの公開状態、又は元事実・参照が不正な場合のnull。
 * @precondition 呼出し元がTask／Attemptと参照集合の結合を検証する。
 * @postcondition OperationのないExecutorの観測とDockerの資源観測を混同しない。
 * @effect N/A: メモリ内の同期投影だけ。
 * @failure 未知kind、欠落・重複・別種の回復参照はnull。
 * @invariant 参照中Operationを履歴だけへ移した状態を受理しない。
 * @boundary 単一保存codecの内部値と既存Task状態。
 * @security 保存値だけで実資源を観測したとは扱わない。
 * @concurrency N/A: Writer、Lock、外部Readerを呼び出さない。
 */
export function projectCoordinatorTaskSettlement(
  input: unknown,
  snapshot: Pick<
    CoordinatorStateSnapshot,
    "operations" | "unresolvedRecoveries"
  >,
): Readonly<{ cleanupConfirmed: boolean; recoveryUnresolved: boolean }> | null {
  try {
    const fact: unknown = JSON.parse(encodeCoordinatorStateValue(input));
    if (!plainObject(fact) || types.isProxy(fact)) return null;
    if (fact.kind === "pending" || fact.kind === "unissued") {
      if (!exactKeys(fact, ["kind"])) return null;
      return Object.freeze({
        cleanupConfirmed: fact.kind === "unissued",
        recoveryUnresolved: false,
      });
    }
    if (fact.kind === "executor_result") {
      if (
        !exactKeys(fact, ["kind", "cleanupConfirmed", "recoveryUnresolved"]) ||
        typeof fact.cleanupConfirmed !== "boolean" ||
        typeof fact.recoveryUnresolved !== "boolean"
      )
        return null;
      return Object.freeze({
        cleanupConfirmed: fact.cleanupConfirmed,
        recoveryUnresolved: fact.recoveryUnresolved,
      });
    }
    if (
      fact.kind !== "operations" ||
      !exactKeys(fact, ["kind", "recoveryIds", "resultUnresolved"]) ||
      typeof fact.resultUnresolved !== "boolean" ||
      !Array.isArray(fact.recoveryIds) ||
      fact.recoveryIds.length === 0 ||
      fact.recoveryIds.length > 128 ||
      !fact.recoveryIds.every((id) => typeof id === "string") ||
      new Set(fact.recoveryIds).size !== fact.recoveryIds.length
    )
      return null;
    const recoveryIds = fact.recoveryIds as readonly string[];
    const operations = recoveryIds.map((id) =>
      snapshot.operations.find((operation) => operation.recoveryId === id),
    );
    if (operations.some((operation) => operation?.kind !== "docker_task"))
      return null;
    return Object.freeze({
      cleanupConfirmed:
        !fact.resultUnresolved &&
        operations.every(
          (operation) =>
            operation?.kind === "docker_task" &&
            operation.phase !== "executing" &&
            operation.outcome?.cleanupConfirmed === true &&
            operation.host.cleanup === "confirmed" &&
            operation.host.pendingTransitionJson === null &&
            operation.lease === "released" &&
            operation.execution.ownerEffect === "disabled" &&
            (operation.dockerRestart === null ||
              isDockerRestartCheckpointSettled(operation.dockerRestart)) &&
            coordinatorTaskResourcesAreSettled(operation),
        ),
      recoveryUnresolved: fact.resultUnresolved,
    });
  } catch {
    return null;
  }
}

/**
 * 発行時の受付結合を現在の保存値へ照合する。
 * @responsibility 新規受付と退役前の同内容再入場を区別する。
 * @trace ARCH-000004
 * @input current: 保存値、intake: 発行時世代と依頼結合。
 * @returns 受付可能ならtrue。
 * @precondition currentは検証済み。
 * @postcondition 退役済み世代を現在世代へ付け替えない。
 * @effect N/A: 値比較のみ。
 * @failure 異内容、異結合、退役済み世代の再入場はfalse。
 * @invariant 同じProject名だけで再入場を許可しない。
 * @boundary Requestと保存契約。
 * @security 受付世代は実行Authorityではない。
 * @concurrency 同Ownerで保存直前にも使用する。
 */
export function coordinatorSnapshotIntakeMatches(
  current: CoordinatorSnapshot,
  intake: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): boolean {
  if (
    !validId(intake.epoch) ||
    !validId(intake.queueId) ||
    !HASH.test(intake.requestHash) ||
    !validId(intake.projectId) ||
    !validId(intake.milestoneId)
  )
    return false;
  const queue = current.queueEntries.find(
    (item) => item.queueId === intake.queueId,
  );
  if (!queue) return current.intakeEpoch === intake.epoch;
  return (
    current.intakeBindings.some(
      (item) => item.queueId === intake.queueId && item.epoch === intake.epoch,
    ) &&
    queue.requestHash === intake.requestHash &&
    queue.projectId === intake.projectId &&
    queue.milestoneId === intake.milestoneId
  );
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
): CoordinatorUnifiedSnapshot["projects"] {
  return snapshot.projects.map((project) => ({
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

export function normalizeCoordinatorTaskProjects(
  current: NonNullable<ReturnType<typeof decodeCoordinatorUnifiedSnapshot>>,
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
          encodeCoordinatorStateValue(previous) !==
            encodeCoordinatorStateValue(value)
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
  const projects: CoordinatorUnifiedSnapshot["projects"][number][] = [];
  for (const state of states) {
    const tasks: CoordinatorStoredTask[] = [];
    for (const task of state.tasks) {
      const previous = current.snapshot.projects
        .find((p) => p.projectId === state.projectId)
        ?.tasks.find(
          (t) =>
            t.definition.id === task.definition.id &&
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
  return {
    projects,
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
 * Task現在区画を保存改訂と物理Envelopeから独立して検証する。
 * @responsibility Task、Queue、Workspace、Lease、判断、統合結果と履歴参照の相関を所有する。
 * @trace ARCH-000004
 * @input snapshot: 復号済み現在区画、binding: 期待する業務Repository結合。
 * @returns 全区画と相互参照が有効な場合だけtrue。
 * @precondition JSON入力とRoot情報は呼出し側で検証する。
 * @postcondition 旧形式の欠落を補完せず、孤立した参照を拒否する。
 * @effect N/A: 同期の値検査だけ。
 * @failure 不正構造と相関不一致はfalse。
 * @invariant 業務世代、受付世代と保存改訂を混同しない。
 * @boundary 保存EnvelopeとTask現在モデル。
 * @security 記録から実効LeaseやAuthorityを復元しない。
 * @concurrency N/A: 保存・排他取得を行わない。
 */
export function validCoordinatorTaskState(
  snapshot: Omit<
    CoordinatorSnapshot,
    "schema" | "schemaRevision" | "repositoryRootHash" | "snapshotRevision"
  >,
  binding: string,
): boolean {
  for (const key of [
    "intakeBindings",
    "projects",
    "queueEntries",
    "leaseEvidence",
    "leaseIntents",
    "results",
    "historyPending",
  ] as const)
    if (!Array.isArray(snapshot[key])) return false;
  if (
    !(snapshot.projects as unknown[]).every(validCoordinatorState) ||
    !(snapshot.queueEntries as unknown[]).every(validQueueEntry)
  )
    return false;
  if (
    !Array.isArray(snapshot.workspaces) ||
    !snapshot.workspaces.every(validCoordinatorWorkspace) ||
    new Set(snapshot.workspaces.map((item) => item.workspaceId)).size !==
      snapshot.workspaces.length
  )
    return false;
  if (
    snapshot.queueEntries.some(
      (entry) =>
        entry.workspaceId != null &&
        !snapshot.workspaces.some(
          (workspace) => workspace.workspaceId === entry.workspaceId,
        ),
    )
  )
    return false;
  const projects = new Set(snapshot.projects.map((item) => item.projectId));
  const queues = new Map(
    snapshot.queueEntries.map((item) => [item.queueId, item]),
  );
  if (
    projects.size !== snapshot.projects.length ||
    queues.size !== snapshot.queueEntries.length ||
    snapshot.queueEntries.some(
      (item) => !item.singleTask && !projects.has(item.projectId),
    )
  )
    return false;
  const intake = new Set<string>();
  for (const item of snapshot.intakeBindings) {
    if (
      !plainObject(item) ||
      !exactKeys(item, ["queueId", "epoch"]) ||
      !validId(item.epoch) ||
      !queues.has(item.queueId) ||
      intake.has(item.queueId)
    )
      return false;
    intake.add(item.queueId);
  }
  if (intake.size !== queues.size) return false;
  const evidenceGroups = new Map<string, LeaseEvidenceEnvelope[]>();
  for (const record of snapshot.leaseEvidence) {
    if (
      !plainObject(record) ||
      !exactKeys(record, [
        "schema",
        "schemaRevision",
        "recordKind",
        "repositoryBindingId",
        "projectId",
        "createdGeneration",
        "updatedGeneration",
        "contentHash",
        "content",
      ]) ||
      record.schema !== COORDINATOR_DURABLE_FOUNDATION_CONTRACT ||
      record.schemaRevision !== 1 ||
      record.recordKind !== "lease-evidence" ||
      record.repositoryBindingId !== binding ||
      !validId(record.projectId) ||
      !validLeaseEvidence(record.content) ||
      record.createdGeneration !== 1 ||
      record.updatedGeneration !==
        (record.content.disposition === "acquired" ? 1 : 2) ||
      record.contentHash !==
        digest(encodeCoordinatorStateValue(record.content)) ||
      !(record.content.kind === "canonical-adoption"
        ? record.content.queueId === "canonical"
        : queues.get(record.content.queueId)?.projectId === record.projectId)
    )
      return false;
    const key = `${leaseIdentity(binding, record.projectId, record.content.queueId, record.content.kind)}\0${record.content.ownerGeneration}`;
    const groups = evidenceGroups.get(key) ?? [];
    groups.push(record);
    evidenceGroups.set(key, groups);
  }
  for (const groups of evidenceGroups.values()) {
    const acquired = groups.find(
      (item) => item.content.disposition === "acquired",
    );
    if (
      (!acquired &&
        !(
          groups.length === 1 &&
          groups[0]?.content.disposition === "acquisition_unknown_closed"
        )) ||
      groups.length > 2 ||
      new Set(groups.map((item) => item.content.disposition)).size !==
        groups.length ||
      groups.some(
        (item) =>
          item.projectId !== groups[0]?.projectId ||
          item.content.queueId !== groups[0]?.content.queueId ||
          item.content.ownerProcessId !== groups[0]?.content.ownerProcessId ||
          (acquired &&
            item.content.disposition === "acquisition_unknown_closed"),
      )
    )
      return false;
  }
  const intents = new Set<string>();
  const intentOwners = new Map<string, string>();
  for (const item of snapshot.leaseIntents) {
    if (
      !plainObject(item) ||
      !exactKeys(item, [
        "projectId",
        "queueId",
        "kind",
        "ownerGeneration",
        "ownerProcessId",
        "recoveryId",
        "phase",
        "physicalIdentity",
      ]) ||
      !validId(item.projectId) ||
      !(item.kind === "canonical-adoption"
        ? item.queueId === "canonical"
        : queues.get(item.queueId)?.projectId === item.projectId) ||
      (item.kind !== "project-operation" &&
        item.kind !== "canonical-adoption") ||
      !validId(item.ownerGeneration) ||
      !Number.isSafeInteger(item.ownerProcessId) ||
      item.ownerProcessId < 1 ||
      item.recoveryId !==
        leaseAcquisitionRecoveryId(
          binding,
          item.projectId,
          item.queueId,
          item.kind,
        ) ||
      ![
        "acquisition_pending",
        "acquisition_reserved",
        "lock_owned",
        "release_pending",
        "recovery_pending",
      ].includes(item.phase)
    )
      return false;
    if (
      !(
        ((item.phase === "acquisition_pending" ||
          item.phase === "acquisition_reserved" ||
          item.phase === "recovery_pending") &&
          item.physicalIdentity === null) ||
        (item.phase !== "acquisition_pending" &&
          item.phase !== "acquisition_reserved" &&
          typeof item.physicalIdentity === "string" &&
          HASH.test(item.physicalIdentity))
      )
    )
      return false;
    const key = `${leaseIdentity(binding, item.projectId, item.queueId, item.kind)}\0${item.ownerGeneration}\0${item.phase}`;
    const leaseKey = leaseIdentity(
      binding,
      item.projectId,
      item.queueId,
      item.kind,
    );
    const ownerKey = `${item.ownerGeneration}\0${item.ownerProcessId}\0${item.queueId}\0${item.projectId}`;
    const evidence = evidenceGroups.get(`${leaseKey}\0${item.ownerGeneration}`);
    if (
      evidence?.some(
        (record) =>
          record.projectId !== item.projectId ||
          record.content.queueId !== item.queueId ||
          record.content.ownerProcessId !== item.ownerProcessId,
      )
    )
      return false;
    if (intentOwners.has(leaseKey) && intentOwners.get(leaseKey) !== ownerKey)
      return false;
    intentOwners.set(leaseKey, ownerKey);
    if (intents.has(key)) return false;
    intents.add(key);
  }
  const results = new Set<string>();
  for (const item of snapshot.results) {
    if (
      !validCoordinatorResultRecord(item) ||
      item.repositoryBindingId !== binding ||
      (queues.has(item.queueId) &&
        (queues.get(item.queueId)?.projectId !== item.projectId ||
          queues.get(item.queueId)?.milestoneId !== item.milestoneId))
    )
      return false;
    const key = `${item.kind}\0${item.projectId}\0${item.identity}`;
    if (results.has(key)) return false;
    results.add(key);
  }
  const history = new Set<string>();
  for (const item of snapshot.historyPending) {
    historyRow(item, Date.now());
    if (history.has(item.id)) return false;
    history.add(item.id);
  }
  {
    for (const groups of evidenceGroups.values()) {
      const acquired = groups.find(
        (item) => item.content.disposition === "acquired",
      );
      if (
        groups.length === 1 &&
        acquired &&
        !snapshot.leaseIntents.some(
          (item) =>
            item.projectId === acquired.projectId &&
            item.queueId === acquired.content.queueId &&
            item.kind === acquired.content.kind &&
            item.ownerGeneration === acquired.content.ownerGeneration &&
            item.ownerProcessId === acquired.content.ownerProcessId &&
            item.phase === "lock_owned",
        )
      )
        return false;
    }
    if (
      !Array.isArray(snapshot.acceptanceDecisions) ||
      !Array.isArray(snapshot.decisionRecoveries)
    )
      return false;
    const decisions = new Map<
      string,
      CoordinatorAcceptanceDecisionEnvelope[]
    >();
    for (const item of snapshot.acceptanceDecisions) {
      if (
        !plainObject(item) ||
        !exactKeys(item, [
          "contract",
          "repositoryBindingId",
          "recordId",
          "generation",
          "previousHash",
          "record",
        ]) ||
        !validId(item.recordId) ||
        !validCoordinatorAcceptanceDecisionEnvelope(
          item,
          binding,
          item.recordId,
        ) ||
        !plainObject(item.record) ||
        !exactKeys(item.record, [
          "recordId",
          "decisionId",
          "sourceSpecId",
          "projectId",
          "milestoneId",
          "repositoryRevision",
          "expectedGeneration",
          "target",
          "targetId",
          "decision",
          "criterionEvidenceIds",
          "principalId",
          "disposition",
          "newGeneration",
        ]) ||
        !projects.has(item.record.projectId)
      )
        return false;
      const groups = decisions.get(item.recordId) ?? [];
      groups.push(item);
      decisions.set(item.recordId, groups);
    }
    for (const groups of decisions.values()) {
      const first = groups.find((item) => item.generation === 1);
      const second = groups.find((item) => item.generation === 2);
      if (
        !first ||
        groups.length > 2 ||
        new Set(groups.map((item) => item.generation)).size !== groups.length ||
        (second &&
          second.previousHash !== digest(encodeCoordinatorStateValue(first)))
      )
        return false;
    }
    const recoveries = new Set<string>();
    for (const item of snapshot.decisionRecoveries) {
      if (
        !plainObject(item) ||
        !exactKeys(item, ["generation", "value"]) ||
        !Number.isSafeInteger(item.generation) ||
        Number(item.generation) < 1 ||
        !validCoordinatorDecisionRecoveryIntent(item.value) ||
        !plainObject(item.value) ||
        !exactKeys(item.value, [
          "recoveryId",
          "recordId",
          "projectId",
          "milestoneId",
          "queueId",
          "applicationId",
          "expectedGeneration",
          "newGeneration",
          "observedDisposition",
          "unknownBoundary",
          "disposition",
        ]) ||
        queues.get(item.value.queueId)?.projectId !== item.value.projectId ||
        queues.get(item.value.queueId)?.milestoneId !==
          item.value.milestoneId ||
        recoveries.has(item.value.recoveryId)
      )
        return false;
      recoveries.add(item.value.recoveryId);
    }
  }
  return true;
}
