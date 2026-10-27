/**
 * state/transition.tsの値契約と判定を所有する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008
 */
import {
  type HistoryRow,
  type CoordinatorSnapshot,
  type LeaseEvidenceEnvelope,
  hasRuntimeStateKeys as exactKeys,
  leaseIdentity,
  isRuntimeStateObject as plainObject,
  type ProjectQueueEntry,
  type SingleTaskRecord,
  type CoordinatorResultRecord,
} from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";

import type { CoordinatorDecisionRecoveryIntent } from "../../../domain-model/src/index.ts";
import { normalizeRepositoryRelativePath } from "../../../domain-model/src/index.ts";

/**
 * 同じ短期保存Ownerで利用する現在観測の契約。
 * @responsibility 保存と状態判断の間で固定値と同期観測だけを受け渡す。
 * @trace ARCH-000004
 * @shape 固定Schema、Process ID、実Lease不存在と履歴確定の同期観測。
 * @invariant 観測不能を不存在にせず、元の判定順で呼ぶ。
 * @boundary Package内部のWriterと区画遷移検査。
 * @security この型や観測値から実行・保存Authorityを発行しない。
 * @compatibility 保存形式・公開Root APIは変更しない。
 */
export type CoordinatorSnapshotObservations = Readonly<{
  schema: string;
  processId: number;
  leaseResourcesAbsent: (identity: string) => boolean;
  historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
}>;

/**
 * 保存候補への遷移で未解決記録と受付結合を保全する。
 * @responsibility 通常保存と中断再入場に同じ遷移制約を適用する。
 * @trace ARCH-000004
 * @input current: 現在値または初期不存在、payload: 検証済み候補。
 * @returns N/A: 違反時に例外を返す。
 * @precondition 双方の構造と結合は検証済み。
 * @postcondition 改訂番号、記録世代と未解決区画の維持を確認済み。
 * @effect 同じ短期Ownerで必要なLease・履歴を同期観測する。保存は行わない。
 * @failure 記録の除去、結合変更または世代飛越を拒否する。
 * @invariant pendingで通常保存の保全制約を迂回しない。
 * @boundary 現在値から候補への保存遷移。
 * @security Hash一致を遷移許可と同一視しない。
 * @concurrency N/A: 排他を所有する呼出し側で実行する。
 */
export function assertCoordinatorSnapshotTransition(
  current: CoordinatorSnapshot | null,
  payload: CoordinatorSnapshot,
  owner: CoordinatorSnapshotObservations,
): void {
  if (payload.snapshotRevision !== (current?.snapshotRevision ?? 0) + 1)
    throw new Error("snapshot_revision_conflict");
  for (const intent of payload.leaseIntents) {
    if (intent.phase !== "acquisition_reserved") continue;
    if (
      current?.leaseIntents.some(
        (item) =>
          encodeRuntimeStateValue(item) === encodeRuntimeStateValue(intent),
      )
    )
      continue;
    const identity = leaseIdentity(
      payload.repositoryBindingId,
      intent.projectId,
      intent.queueId,
      intent.kind,
    );
    if (
      intent.physicalIdentity !== null ||
      intent.ownerProcessId !== owner.processId ||
      payload.leaseIntents.filter(
        (item) =>
          leaseIdentity(
            payload.repositoryBindingId,
            item.projectId,
            item.queueId,
            item.kind,
          ) === identity,
      ).length !== 1 ||
      current?.leaseIntents.some(
        (item) =>
          leaseIdentity(
            payload.repositoryBindingId,
            item.projectId,
            item.queueId,
            item.kind,
          ) === identity,
      ) ||
      !owner.leaseResourcesAbsent(identity)
    )
      throw new Error("snapshot_acquisition_reservation_invalid");
  }
  if (current) {
    if (payload.schema !== current.schema)
      throw new Error("snapshot_schema_transition_invalid");
    const retired = new Set(
      current.queueEntries
        .filter(
          (queue) =>
            !payload.queueEntries.some(
              (item) => item.queueId === queue.queueId,
            ),
        )
        .map((item) => item.queueId),
    );
    const retiredMilestones = new Set(
      current.queueEntries
        .filter(
          (queue) =>
            retired.has(queue.queueId) &&
            !payload.queueEntries.some(
              (item) =>
                item.projectId === queue.projectId &&
                item.milestoneId === queue.milestoneId,
            ),
        )
        .map((queue) =>
          encodeRuntimeStateValue([queue.projectId, queue.milestoneId]),
        ),
    );
    const currentEvidenceIds = new Set(
      [...current.projects, ...payload.projects].flatMap((project) => [
        ...project.milestone.criterionEvidenceIds,
        ...project.objectives.flatMap(
          (objective) => objective.criterionEvidenceIds,
        ),
      ]),
    );
    for (const queueId of retired) {
      const row = current.historyPending.find((item) => item.id === queueId);
      if (
        !coordinatorQueueIsClosed(current, queueId, owner) ||
        !row ||
        owner.historySettlement(row) === null
      )
        throw new Error("snapshot_retirement_unconfirmed");
    }
    if (retired.size > 0 !== (payload.intakeEpoch !== current.intakeEpoch))
      throw new Error("snapshot_intake_epoch_transition_invalid");
    if (current.schema === owner.schema && payload.schema === owner.schema) {
      for (const old of current.acceptanceDecisions) {
        if (
          retiredMilestones.has(
            encodeRuntimeStateValue([
              old.record.projectId,
              old.record.milestoneId,
            ]),
          ) &&
          current.acceptanceDecisions.some(
            (item) =>
              item.recordId === old.recordId &&
              item.generation === 2 &&
              item.record.disposition === "finalized",
          ) &&
          !payload.decisionRecoveries.some(
            (item) => item.value.recordId === old.recordId,
          )
        )
          continue;
        if (
          !payload.acceptanceDecisions.some(
            (item) =>
              encodeRuntimeStateValue(item) === encodeRuntimeStateValue(old),
          )
        )
          throw new Error("snapshot_acceptance_decision_removed");
      }
      for (const old of current.decisionRecoveries) {
        if (
          retired.has(old.value.queueId) &&
          old.value.disposition === "settled" &&
          !payload.decisionRecoveries.some(
            (item) => item.value.recoveryId === old.value.recoveryId,
          )
        )
          continue;
        const next = payload.decisionRecoveries.find(
          (item) => item.value.recoveryId === old.value.recoveryId,
        );
        if (
          !next ||
          (encodeRuntimeStateValue(next) !== encodeRuntimeStateValue(old) &&
            (next.generation !== old.generation + 1 ||
              [
                "recordId",
                "projectId",
                "milestoneId",
                "queueId",
                "expectedGeneration",
              ].some(
                (key) =>
                  next.value[key as keyof CoordinatorDecisionRecoveryIntent] !==
                  old.value[key as keyof CoordinatorDecisionRecoveryIntent],
              )))
        )
          throw new Error("snapshot_decision_recovery_transition_invalid");
      }
    }
    for (const collection of ["results", "leaseEvidence"] as const) {
      for (const old of current[collection])
        if (
          !payload[collection].some(
            (item) =>
              encodeRuntimeStateValue(item) === encodeRuntimeStateValue(old),
          )
        )
          if (
            collection === "results"
              ? (!current.queueEntries.some(
                  (queue) =>
                    retired.has(queue.queueId) &&
                    queue.queueId ===
                      (old as CoordinatorResultRecord).queueId &&
                    queue.projectId === old.projectId &&
                    queue.milestoneId ===
                      (old as CoordinatorResultRecord).milestoneId,
                ) &&
                  !current.historyPending.some(
                    (row) =>
                      row.id === (old as CoordinatorResultRecord).identity &&
                      coordinatorStandaloneAdoptionIsClosed(
                        current,
                        row.id,
                        owner,
                      ) &&
                      owner.historySettlement(row) !== null,
                  )) ||
                currentEvidenceIds.has(
                  (old as CoordinatorResultRecord).identity,
                ) ||
                payload.queueEntries.some(
                  (item) =>
                    item.resultReference ===
                    (old as CoordinatorResultRecord).identity,
                )
              : !current.queueEntries.some(
                  (queue) =>
                    (old as LeaseEvidenceEnvelope).content.kind ===
                      "project-operation" &&
                    retired.has(queue.queueId) &&
                    queue.queueId ===
                      (old as LeaseEvidenceEnvelope).content.queueId &&
                    queue.projectId === old.projectId,
                ) &&
                !coordinatorRejectedAdoptionEvidenceCanRetire(
                  current,
                  payload,
                  old as LeaseEvidenceEnvelope,
                  owner,
                ) &&
                !(
                  (old as LeaseEvidenceEnvelope).content.kind ===
                    "canonical-adoption" &&
                  !payload.queueEntries.some(
                    (queue) => queue.projectId === old.projectId,
                  ) &&
                  !payload.leaseIntents.some(
                    (intent) => intent.projectId === old.projectId,
                  ) &&
                  !payload.results.some(
                    (record) =>
                      record.kind === "adoption" &&
                      record.projectId === old.projectId,
                  ) &&
                  current.historyPending.some(
                    (row) =>
                      (current.queueEntries.some(
                        (queue) =>
                          retired.has(queue.queueId) &&
                          queue.projectId === old.projectId,
                      ) ||
                        current.results.some(
                          (record) =>
                            record.identity === row.id &&
                            record.projectId === old.projectId &&
                            !coordinatorAdoptionWasRejected(record) &&
                            coordinatorStandaloneAdoptionIsClosed(
                              current,
                              row.id,
                              owner,
                            ),
                        )) &&
                      owner.historySettlement(row) !== null,
                  )
                )
          )
            throw new Error("snapshot_retained_obligation_removed");
    }
    for (const old of current.historyPending) {
      if (
        !payload.historyPending.some(
          (item) =>
            encodeRuntimeStateValue(item) === encodeRuntimeStateValue(old),
        ) &&
        owner.historySettlement(old) === null
      )
        throw new Error("snapshot_history_transfer_unconfirmed");
    }
    for (const old of current.leaseIntents) {
      if (
        payload.leaseIntents.some(
          (item) =>
            encodeRuntimeStateValue(item) === encodeRuntimeStateValue(old),
        )
      )
        continue;
      const end = payload.leaseEvidence.find(
        (item) =>
          item.projectId === old.projectId &&
          item.content.queueId === old.queueId &&
          item.content.kind === old.kind &&
          item.content.ownerGeneration === old.ownerGeneration &&
          item.content.ownerProcessId === old.ownerProcessId &&
          item.content.disposition !== "acquired",
      );
      const identity = leaseIdentity(
        payload.repositoryBindingId,
        old.projectId,
        old.queueId,
        old.kind,
      );
      if (end && end.content.disposition !== "released") {
        const recovery = current.leaseIntents.find(
          (item) =>
            item.projectId === old.projectId &&
            item.queueId === old.queueId &&
            item.kind === old.kind &&
            item.ownerGeneration === old.ownerGeneration &&
            item.ownerProcessId === old.ownerProcessId &&
            item.phase === "recovery_pending",
        );
        const owned = current.leaseIntents.find(
          (item) =>
            item.projectId === old.projectId &&
            item.queueId === old.queueId &&
            item.kind === old.kind &&
            item.ownerGeneration === old.ownerGeneration &&
            item.phase === "lock_owned",
        );
        if (
          !recovery ||
          recovery.recoveryId !== old.recoveryId ||
          (end.content.disposition === "acquisition_unknown_closed"
            ? owned !== undefined ||
              (recovery.physicalIdentity !== null &&
                !current.leaseIntents.some(
                  (item) =>
                    item.projectId === old.projectId &&
                    item.queueId === old.queueId &&
                    item.kind === old.kind &&
                    item.ownerGeneration === old.ownerGeneration &&
                    item.phase === "acquisition_reserved",
                ))
            : !owned || recovery.physicalIdentity !== owned.physicalIdentity)
        )
          throw new Error("snapshot_recovery_intent_unconfirmed");
      }
      if (
        current.schema !== owner.schema ||
        !end ||
        !owner.leaseResourcesAbsent(identity)
      )
        throw new Error("snapshot_unsettled_lease_intent_removed");
    }
    for (const old of current.queueEntries) {
      if (retired.has(old.queueId)) continue;
      const next = payload.queueEntries.find(
        (item) => item.queueId === old.queueId,
      );
      if (
        old.singleTask &&
        (!next?.singleTask ||
          [
            "principalId",
            "mode",
            "executionSelection",
            "taskId",
            "attemptId",
            "operationId",
          ].some(
            (key) =>
              encodeRuntimeStateValue(
                old.singleTask?.[key as keyof SingleTaskRecord],
              ) !==
              encodeRuntimeStateValue(
                next.singleTask?.[key as keyof SingleTaskRecord],
              ),
          ) ||
          (old.singleTask.adviceOperation !== undefined &&
            encodeRuntimeStateValue(old.singleTask.adviceOperation) !==
              encodeRuntimeStateValue(next.singleTask.adviceOperation)) ||
          (old.singleTask.phase === "settled" &&
            (old.singleTask.status !== next.singleTask.status ||
              old.singleTask.reason !== next.singleTask.reason ||
              next.singleTask.phase !== "settled" ||
              (old.singleTask.cleanupConfirmed &&
                !next.singleTask.cleanupConfirmed) ||
              next.singleTask.recoveryIds.some(
                (id) => !old.singleTask?.recoveryIds.includes(id),
              ))))
      )
        throw new Error("snapshot_single_task_identity_invalid");
      if (
        old.singleTask &&
        next?.singleTask &&
        encodeRuntimeStateValue(old.singleTask) !==
          encodeRuntimeStateValue(next.singleTask)
      ) {
        const unstartedRejection =
          old.singleTask.phase === "accepted" &&
          next.singleTask.phase === "settled" &&
          next.singleTask.status === "blocked" &&
          next.singleTask.cleanupConfirmed &&
          next.singleTask.recoveryIds.length === 0 &&
          old.ownerGeneration === null &&
          next.ownerGeneration === null &&
          !current.leaseIntents.some(
            (intent) => intent.queueId === old.queueId,
          );
        const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
          accepted: ["starting"],
          starting: ["starting", "running", "settled"],
          running: ["settled"],
          settled: ["settled"],
        };
        if (
          !unstartedRejection &&
          (!phases[old.singleTask.phase].includes(next.singleTask.phase) ||
            !current.leaseIntents.some(
              (intent) =>
                intent.queueId === old.queueId &&
                intent.projectId === old.projectId &&
                intent.kind === "project-operation" &&
                intent.phase === "lock_owned" &&
                intent.ownerProcessId === owner.processId &&
                intent.ownerGeneration === next.ownerGeneration,
            ))
        )
          throw new Error("snapshot_single_task_transition_invalid");
      }
      if (
        !next ||
        [
          "projectId",
          "milestoneId",
          "requestHash",
          "originLane",
          "repositoryRevision",
          "scopeHash",
        ].some(
          (key) =>
            next[key as keyof ProjectQueueEntry] !==
            old[key as keyof ProjectQueueEntry],
        ) ||
        (encodeRuntimeStateValue(next) !== encodeRuntimeStateValue(old) &&
          next.generation !== old.generation + 1) ||
        current.intakeBindings.find((item) => item.queueId === old.queueId)
          ?.epoch !==
          payload.intakeBindings.find((item) => item.queueId === old.queueId)
            ?.epoch
      )
        throw new Error("snapshot_queue_generation_invalid");
    }
    for (const old of current.projects) {
      const next = payload.projects.find(
        (item) => item.projectId === old.projectId,
      );
      if (
        next &&
        next.milestoneId === old.milestoneId &&
        encodeRuntimeStateValue(next.taskExecutionSelections) !==
          encodeRuntimeStateValue(old.taskExecutionSelections)
      )
        throw new Error("snapshot_project_selection_changed");
      if (
        next &&
        next.milestoneId !== old.milestoneId &&
        current.queueEntries.some(
          (queue) =>
            !queue.singleTask &&
            queue.projectId === old.projectId &&
            !retired.has(queue.queueId),
        )
      )
        throw new Error("snapshot_project_milestone_still_referenced");
      if (
        !next ||
        (encodeRuntimeStateValue(next) !== encodeRuntimeStateValue(old) &&
          next.generation !== old.generation + 1)
      )
        throw new Error("snapshot_project_generation_invalid");
    }
  }
}

/**
 * 一件の仕事について終了後の参照と実資源を照合する。
 * @responsibility 状態名だけで終了記録を削除しない。
 * @trace ARCH-000004
 * @input current、Queue ID、取得済み保存Owner。
 * @returns 現在の仕事が閉じている場合だけtrue。
 * @precondition Snapshotは全体検証済み。
 * @postcondition 判断待ち・未解決回復・Lease残存を拒否済み。
 * @effect 所有するLeaseの不存在を読み取る。
 * @failure 観測不能はfalse。
 * @invariant Candidate本体と保護Authorityを削除しない。
 * @boundary 現在状態と実行排他。
 * @security 終了済みを認証・採用許可にしない。
 * @concurrency 同じ短期Ownerで評価する。
 */
export function coordinatorQueueIsClosed(
  current: CoordinatorSnapshot,
  queueId: string,
  owner: CoordinatorSnapshotObservations,
): boolean {
  try {
    if (current.schema !== owner.schema) return false;
    const queue = current.queueEntries.find((item) => item.queueId === queueId);
    if (
      !queue ||
      !["completed", "cancelled"].includes(queue.state) ||
      queue.ownerGeneration !== null
    )
      return false;
    if (queue.singleTask) {
      return (
        queue.singleTask.phase === "settled" &&
        queue.workspaceId == null &&
        queue.singleTask.cleanupConfirmed &&
        queue.singleTask.recoveryIds.length === 0 &&
        !current.leaseIntents.some((item) => item.queueId === queueId) &&
        owner.leaseResourcesAbsent(
          leaseIdentity(
            current.repositoryBindingId,
            queue.projectId,
            queueId,
            "project-operation",
          ),
        )
      );
    }
    const project = current.projects.find(
      (item) => item.projectId === queue.projectId,
    );
    if (
      !project ||
      project.milestoneId !== queue.milestoneId ||
      !["accepted", "cancelled"].includes(project.milestone.state) ||
      project.tasks.some(
        (task) =>
          !["completed", "failed", "cancelled", "superseded"].includes(
            task.state,
          ) ||
          !task.cleanupConfirmed ||
          task.recoveryUnresolved ||
          task.recoveryObligations.some((item) => item.phase !== "settled"),
      )
    )
      return false;
    if (
      current.leaseIntents.some((item) => item.projectId === queue.projectId) ||
      current.decisionRecoveries.some(
        (item) =>
          item.value.queueId === queueId &&
          item.value.disposition !== "settled",
      )
    )
      return false;
    if (project.tasks.some((task) => task.candidateId !== null)) {
      const receipt = current.results.find(
        (item) =>
          item.queueId === queueId &&
          item.kind === "adoption" &&
          item.identity === queue.resultReference,
      );
      const candidate = current.results.find(
        (item) => item.queueId === queueId && item.kind === "integration",
      );
      if (
        !receipt ||
        !candidate ||
        !plainObject(receipt.value) ||
        !plainObject(candidate.value) ||
        receipt.value.status !== "completed" ||
        receipt.value.cleanupConfirmed !== true ||
        receipt.value.beforeRevision !== candidate.value.baseRevision ||
        !Array.isArray(receipt.value.changedPaths) ||
        !Array.isArray(candidate.value.changedPaths) ||
        encodeRuntimeStateValue([...receipt.value.changedPaths].sort()) !==
          encodeRuntimeStateValue([...candidate.value.changedPaths].sort())
      )
        return false;
    }
    const decisions = current.acceptanceDecisions.filter(
      (item) =>
        item.record.projectId === queue.projectId &&
        item.record.milestoneId === queue.milestoneId,
    );
    if (
      decisions.some(
        (item) =>
          !decisions.some(
            (next) =>
              next.recordId === item.recordId &&
              next.generation === 2 &&
              next.record.disposition === "finalized",
          ),
      )
    )
      return false;
    for (const kind of ["project-operation", "canonical-adoption"] as const)
      if (
        !owner.leaseResourcesAbsent(
          leaseIdentity(
            current.repositoryBindingId,
            queue.projectId,
            kind === "project-operation" ? queueId : "canonical",
            kind,
          ),
        )
      )
        return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 採用呼出し前に確定した拒否記録の閉じた値を確認する。
 * @responsibility 拒否を成功Receiptや未知Effectから区別する。
 * @trace ARCH-000004
 * @input 検証済み採用Record。
 * @returns exact Ownerに結合した既知拒否か。
 * @precondition 値はJSONとして検証済みである。
 * @postcondition 固定理由と全fieldが一致した場合だけtrue。
 * @effect N/A: 局所値だけを検査する。
 * @failure 不正値はfalse。
 * @invariant Receipt不存在からEffect 0を推定しない。
 * @boundary 採用Applicationと保存結果。
 * @security Callerの追加fieldを採用しない。
 * @concurrency N/A: 同期純粋処理。
 */
export function coordinatorAdoptionWasRejected(
  record: CoordinatorResultRecord,
): boolean {
  return (
    record.kind === "adoption" &&
    plainObject(record.value) &&
    exactKeys(record.value, [
      "status",
      "reason",
      "ownerGeneration",
      "effectIssued",
      "cleanupConfirmed",
    ]) &&
    record.value.status === "rejected" &&
    record.value.reason ===
      "orchestrator_adoption_revision_or_scope_mismatch" &&
    record.value.ownerGeneration === record.identity &&
    record.value.effectIssued === false &&
    record.value.cleanupConfirmed === true
  );
}

/**
 * 既知拒否の終了証拠をexact Owner単位で整理できるか確認する。
 * @responsibility 拒否結果、終了証拠、履歴確定と除去候補を結合する。
 * @trace ARCH-000004
 * @input 現在値、保存候補、終了証拠と取得済みOwner。
 * @returns 全終了条件が成立した場合だけtrue。
 * @precondition 同Rootの短期排他を保持する。
 * @postcondition 別Owner世代の証拠を除去しない。
 * @effect 実Leaseと履歴確定を読む。
 * @failure 観測不能はfalse。
 * @invariant 未知Effectと解放未確認を整理しない。
 * @boundary 採用終了から履歴と現在保存。
 * @security 履歴は再実行Authorityを持たない。
 * @concurrency 同じ保存Owner内で評価する。
 */
export function coordinatorRejectedAdoptionEvidenceCanRetire(
  current: CoordinatorSnapshot,
  payload: CoordinatorSnapshot,
  evidence: LeaseEvidenceEnvelope,
  owner: CoordinatorSnapshotObservations,
): boolean {
  if (evidence.content.kind !== "canonical-adoption") return false;
  const record = current.results.find(
    (item) =>
      item.projectId === evidence.projectId &&
      item.identity === evidence.content.ownerGeneration &&
      coordinatorAdoptionWasRejected(item),
  );
  const row =
    record &&
    current.historyPending.find((item) => item.id === record.identity);
  return Boolean(
    record &&
      row &&
      row.outcome === "failed" &&
      row.primaryFailure === "execution" &&
      !payload.results.some((item) => item.identity === record.identity) &&
      coordinatorStandaloneAdoptionIsClosed(current, record.identity, owner) &&
      owner.historySettlement(row) !== null,
  );
}

/**
 * 通常Queueを持たない採用結果の終了条件を確認する。
 * @responsibility 実適用Receipt、参照と実Leaseの現在観測から整理可能性を決める。
 * @trace ARCH-000004
 * @input 検証済み保存値、Receipt Identity、取得済みOwner。
 * @returns 全条件が成立した場合だけtrue。
 * @precondition Ownerは同じRepositoryへ結合している。
 * @postcondition 使用中・参照中・未確定結果を退役対象にしない。
 * @effect 所有する実Leaseの不存在を読む。
 * @failure 不正Receiptと観測不能はfalse。
 * @invariant Receiptを再適用Authorityへ変換しない。
 * @boundary 独立候補採用と現在保存の境界。
 * @security Candidate本文や秘密値を履歴へ複製しない。
 * @concurrency 同じ短期Owner内で評価する。
 */
export function coordinatorStandaloneAdoptionIsClosed(
  current: CoordinatorSnapshot,
  identity: string,
  owner: CoordinatorSnapshotObservations,
): boolean {
  try {
    if (current.schema !== owner.schema) return false;
    const record = current.results.find(
      (item) => item.identity === identity && item.kind === "adoption",
    );
    const isRejected =
      record !== undefined && coordinatorAdoptionWasRejected(record);
    if (
      !record ||
      !plainObject(record.value) ||
      (!isRejected &&
        (!exactKeys(record.value, [
          "status",
          "receiptId",
          "beforeRevision",
          "afterRevision",
          "changedPaths",
          "cleanupConfirmed",
        ]) ||
          record.value.status !== "completed" ||
          record.value.receiptId !== identity ||
          record.value.cleanupConfirmed !== true ||
          typeof record.value.beforeRevision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(record.value.beforeRevision) ||
          typeof record.value.afterRevision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(record.value.afterRevision) ||
          !Array.isArray(record.value.changedPaths) ||
          record.value.changedPaths.length === 0 ||
          record.value.changedPaths.some(
            (item) =>
              typeof item !== "string" ||
              normalizeRepositoryRelativePath(item) === null,
          ))) ||
      current.queueEntries.some(
        (queue) => queue.projectId === record.projectId,
      ) ||
      current.leaseIntents.some(
        (intent) => intent.projectId === record.projectId,
      ) ||
      (isRejected &&
        current.results.some(
          (other) =>
            other.projectId === record.projectId &&
            other.kind === "adoption" &&
            !coordinatorAdoptionWasRejected(other),
        )) ||
      current.decisionRecoveries.some(
        (item) =>
          item.value.projectId === record.projectId &&
          item.value.disposition !== "settled",
      ) ||
      current.projects.some(
        (project) =>
          project.milestone.criterionEvidenceIds.includes(identity) ||
          project.objectives.some((objective) =>
            objective.criterionEvidenceIds.includes(identity),
          ),
      )
    )
      return false;
    const evidence = current.leaseEvidence.filter(
      (item) =>
        item.projectId === record.projectId &&
        item.content.kind === "canonical-adoption" &&
        (!isRejected || item.content.ownerGeneration === identity),
    );
    if (
      !evidence.length ||
      evidence.some(
        (item) =>
          !evidence.some(
            (end) =>
              end.content.ownerGeneration === item.content.ownerGeneration &&
              end.content.ownerProcessId === item.content.ownerProcessId &&
              end.content.disposition !== "acquired",
          ),
      )
    )
      return false;
    return owner.leaseResourcesAbsent(
      leaseIdentity(
        current.repositoryBindingId,
        record.projectId,
        "canonical",
        "canonical-adoption",
      ),
    );
  } catch {
    return false;
  }
}
