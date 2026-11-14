/**
 * 統合実行State・Lease・一回保存相関の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  applyResourceCleanup,
  applyResourceEvent,
  validateResourceBookTransition,
} from "../attempt/operations.ts";
import type {
  ExecutionOperationRecord,
  OperationResources,
  RepairOperationRecord,
} from "../attempt/types.ts";
import {
  areTaskResourcesSettled,
  authenticationClosureEvidence,
  createEnvironmentRepairDisposalCheckpoint,
  decodeEnvironmentRepairDisposalCheckpoint,
  isDockerRestartCheckpointSettled,
  isRepairCheckpointSettled,
  operationNonce,
  parseDockerTaskRecoveryId,
  prepareEnvironmentRepairSessionCheckpoint,
  repairCanComplete,
  repairCanSummarize,
  repairRetentionMatchesCheckpoint,
  validateEnvironmentRepairDisposalTransition,
  validateOperationTransitions,
  validExecutionState,
  validRepairOperation,
  validRepairRetentionReceipt,
} from "../attempt/validation.ts";
import {
  projectDecisionHistory,
  validateDecisionCollections,
  validateDecisionRetirement,
  validateDecisionSnapshotTransition,
} from "../decision/validation.ts";
import {
  copyHistoryBytes,
  historyLineBytes,
  operationSummaryBytes,
  prepareHistoryPublication,
  repairHistoryLineBytes,
  repairSummaryBytes,
  retainHistoryRows,
} from "../history/operations.ts";
import type { HistoryRetentionReferences } from "../history/types.ts";
import { decodeHistoryRows, historyRow } from "../history/validation.ts";
import {
  inspectCompletePlanDefinition,
  inspectExecutionProjectDefinition,
} from "../objective/validation.ts";
import type {
  ProjectQueueEntry,
  ProjectTaskRecord,
  ProjectTaskRecoveryObligation,
  SingleTaskRecord,
} from "../task/types.ts";
import {
  associateTaskOperations,
  validQueueEntry,
  validState,
} from "../task/validation.ts";
import type { ResultRecord } from "../workspace/types.ts";
import { validResultRecord, validWorkspace } from "../workspace/validation.ts";
import type {
  ExecutionStateSnapshot,
  ExecutionStoredManagedProject,
  LeaseEvidenceContent,
  LeaseEvidenceEnvelope,
  LeaseKind,
  ProjectDefinition,
  ProjectExecutionState,
  Snapshot,
  SnapshotObservations,
  StoredTask,
} from "./types.ts";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
  normalizeRepositoryRelativePath,
  validId,
  isStateObject,
  hasStateKeys,
  HASH,
} from "./operations.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "./types.ts";

/**
 * Lease取得Ownerの記録参照を投影する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function projectLeaseAcquisitionOwner(
  current: Snapshot,
  binding: string,
) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
    return blocked("orchestrator_snapshot_schema_invalid");
  const intents = current.leaseIntents.filter(
    (item) => item.kind === "project-operation",
  );
  const first = intents[0];
  if (!first)
    return completed("orchestrator_lease_acquisition_absent", {
      next: null,
      value: { acquisition: null },
    });
  const queue = current.queueEntries.find(
    (item) => item.queueId === first.queueId,
  );
  if (
    !queue ||
    queue.projectId !== first.projectId ||
    (queue.ownerGeneration !== null &&
      queue.ownerGeneration !== first.ownerGeneration) ||
    intents.some(
      (item) =>
        item.projectId !== first.projectId ||
        item.queueId !== first.queueId ||
        item.ownerGeneration !== first.ownerGeneration ||
        item.ownerProcessId !== first.ownerProcessId ||
        item.recoveryId !== first.recoveryId,
    )
  )
    return blocked(
      "orchestrator_lease_acquisition_owner_mismatch",
      true,
      first.recoveryId,
    );
  return completed("orchestrator_lease_acquisition_owner_observed", {
    next: null,
    value: {
      acquisition: Object.freeze({
        repositoryBindingId: binding,
        projectId: first.projectId,
        queueId: first.queueId,
        ownerGeneration: first.ownerGeneration,
        ownerProcessId: first.ownerProcessId,
        recoveryId: first.recoveryId,
      }),
    },
  });
}

/**
 * Lease取得予約の保存候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseAcquisitionReservation(
  current: Snapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  identity: string,
  intent: Snapshot["leaseIntents"][number],
  observations: Readonly<{
    resourcesAbsent: () => boolean;
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
    markIntentSaveRequested: () => void;
  }>,
) {
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !validId(projectId) ||
    (kind === "project-operation"
      ? !current.queueEntries.some(
          (item) => item.queueId === queueId && item.projectId === projectId,
        )
      : queueId !== "canonical")
  )
    return blocked("orchestrator_lease_binding_invalid");
  if (
    current.leaseIntents.some(
      (item) =>
        leaseIdentity(binding, item.projectId, item.queueId, item.kind) ===
        identity,
    )
  )
    return blocked("orchestrator_lease_unavailable");
  if (observations.resourcesAbsent() !== true)
    return blocked("orchestrator_lease_preexisting_resource");
  const root = observeLeaseRoot(observations.observeRoot);
  observations.markIntentSaveRequested();
  return completed("orchestrator_lease_intent_durable", {
    next: { ...current, leaseIntents: [...current.leaseIntents, intent] },
    value: {
      repositoryRoot: root.repositoryRoot,
      rootIdentity: root.rootIdentity,
      identity,
      recoveryId: intent.recoveryId,
      intent,
    },
  });
}

/**
 * 観測済み実Lockに対する取得確定候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseAcquisitionConfirmation(
  current: Snapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  ownerGeneration: string,
  intent: Snapshot["leaseIntents"][number],
  physicalIdentity: string,
  recoveryId: string,
  ownerProcessId: number,
  observations: Readonly<{ physicalIdentityMatches: () => boolean }>,
) {
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) => encodeStateValue(item) === encodeStateValue(intent),
    )
  )
    return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
  if (observations.physicalIdentityMatches() !== true)
    return blocked(
      "orchestrator_lease_physical_identity_changed",
      true,
      recoveryId,
    );
  const evidence = createLeaseEvidence(binding, projectId, 1, {
    kind,
    queueId,
    ownerGeneration,
    ownerProcessId,
    disposition: "acquired",
  });
  return completed("orchestrator_lease_acquired", {
    next: {
      ...current,
      leaseIntents: [
        ...current.leaseIntents,
        { ...intent, phase: "lock_owned" as const, physicalIdentity },
      ],
      leaseEvidence: [...current.leaseEvidence, evidence],
    },
    value: true,
  });
}

/**
 * 同じ取得意図に対する解放意図候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseReleaseIntent(
  current: Snapshot,
  intent: Snapshot["leaseIntents"][number],
  physicalIdentity: string,
) {
  const { ownerGeneration, recoveryId } = intent;
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) =>
        item.ownerGeneration === ownerGeneration &&
        item.phase === "lock_owned" &&
        item.physicalIdentity === physicalIdentity,
    )
  )
    return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
  return completed("orchestrator_lease_release_intent_durable", {
    next: {
      ...current,
      leaseIntents: [
        ...current.leaseIntents,
        {
          ...intent,
          phase: "release_pending" as const,
          physicalIdentity,
        },
      ],
    },
    value: true,
  });
}

/**
 * 実解放後の終了記録候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseReleaseSettlement(
  current: Snapshot,
  binding: string,
  intent: Snapshot["leaseIntents"][number],
  physicalIdentity: string,
  ownerProcessId: number,
) {
  const { ownerGeneration, recoveryId, projectId, queueId, kind } = intent;
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) =>
        item.ownerGeneration === ownerGeneration &&
        item.phase === "release_pending" &&
        item.physicalIdentity === physicalIdentity,
    )
  )
    return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
  const evidence = createLeaseEvidence(binding, projectId, 2, {
    kind,
    queueId,
    ownerGeneration,
    ownerProcessId,
    disposition: "released",
  });
  return completed("orchestrator_lease_released", {
    next: {
      ...current,
      leaseIntents: current.leaseIntents.filter(
        (item) =>
          !(
            item.ownerGeneration === ownerGeneration &&
            item.kind === kind &&
            item.projectId === projectId &&
            item.queueId === queueId
          ),
      ),
      leaseEvidence: [...current.leaseEvidence, evidence],
    },
    value: { released: true as const },
  });
}

/**
 * Owner喪失回復の初回記録を投影する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function projectLeaseOwnerLossState(
  current: Snapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
  }>,
) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA)
    return blocked("orchestrator_snapshot_schema_invalid");
  const queue =
    kind === "project-operation"
      ? (current.queueEntries.find((item) => item.queueId === queueId) ?? null)
      : null;
  if (
    !validId(projectId) ||
    (kind === "project-operation"
      ? queue?.projectId !== projectId
      : queueId !== "canonical")
  )
    return blocked("orchestrator_lease_binding_invalid");
  const intents = current.leaseIntents.filter(
    (item) =>
      item.projectId === projectId &&
      item.queueId === queueId &&
      item.kind === kind,
  );
  const root = observeLeaseRoot(observations.observeRoot);
  return completed("orchestrator_lease_recovery_inspected", {
    next: null,
    value: {
      intents,
      queue,
      intakeEpoch: current.intakeEpoch,
      identity: leaseIdentity(
        current.repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
      recoveryId: leaseAcquisitionRecoveryId(
        current.repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
      repositoryRoot: root.repositoryRoot,
      rootIdentity: root.rootIdentity,
    },
  });
}

/**
 * intent不在の旧Leaseを回復待ち記録へ照合する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareReleasedLeaseReconciliation(
  current: Snapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initialQueue: ProjectQueueEntry | null,
  recoveryId: string,
  observations: Readonly<{ resourcesAbsent: () => boolean }>,
) {
  const queue = current.queueEntries.find((item) => item.queueId === queueId);
  const released = current.leaseEvidence.find(
    (item) =>
      item.projectId === projectId &&
      item.content.queueId === queueId &&
      item.content.kind === kind &&
      item.content.ownerGeneration === queue?.ownerGeneration &&
      item.content.disposition === "released",
  );
  if (
    !queue ||
    queue.generation !== initialQueue?.generation ||
    queue.ownerGeneration !== initialQueue?.ownerGeneration ||
    !["leased", "running"].includes(queue.state) ||
    !released ||
    current.leaseIntents.some(
      (item) =>
        item.projectId === projectId &&
        item.queueId === queueId &&
        item.kind === kind,
    ) ||
    observations.resourcesAbsent() !== true
  )
    return blocked(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const next: ProjectQueueEntry = {
    ...queue,
    generation: queue.generation + 1,
    state: "recovery_required",
    ownerGeneration: null,
    resumeCondition: "owner_loss",
    resultReference: recoveryId,
  };
  return completed("orchestrator_released_lease_reconciled", {
    next: {
      ...current,
      queueEntries: current.queueEntries.map((item) =>
        item.queueId === queueId ? next : item,
      ),
    },
    value: { queue: next, recoveryId: null },
  });
}

/**
 * 元Queueとintent集合に結合した回復意図候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseRecoveryReservation(
  current: Snapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: Snapshot["leaseIntents"],
  pending: Snapshot["leaseIntents"][number],
  recoveryId: string,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
  }>,
) {
  const root = observeLeaseRoot(observations.observeRoot);
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    root.repositoryRoot !== initial.repositoryRoot ||
    root.rootIdentity !== initial.rootIdentity ||
    encodeStateValue(
      current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      ),
    ) !== encodeStateValue(ownIntents) ||
    encodeStateValue(
      kind === "project-operation"
        ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
        : null,
    ) !== encodeStateValue(initial.queue)
  )
    return blocked(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const existing = ownIntents.find((item) => item.phase === "recovery_pending");
  if (existing && encodeStateValue(existing) !== encodeStateValue(pending))
    return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
  return completed("orchestrator_lease_recovery_intent_durable", {
    next: existing
      ? null
      : { ...current, leaseIntents: [...current.leaseIntents, pending] },
    value: true,
  });
}

/**
 * 観測済み回復処置の終了記録候補を生成する。
 * @responsibility fresh元版と閉じた入力を照合し、同対象だけの候補又は固定投影を返す。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ短期Ownerのfresh値、対象値、用途固定の同期観測。
 * @returns 元の結果封筒、exact回復参照と保存候補又は読取り投影。
 * @precondition Coordinatorが実行の発火・元Owner・対象Repositoryを確認している。
 * @postcondition 元版と対象外区画、過去unknownを変更しない。
 * @effect 値操作と用途固定の同期観測だけ。実Lock・Process・保存を操作しない。
 * @failure 元の理由・短絡順を維持し、観測不能と明示不存在を分ける。
 * @invariant completedを実資源終了・回復成立・新しい実行許可にしない。
 * @boundary Coordinatorの現在観測とDomainの保存値。
 * @security 生Owner・Stats・Kernel handle・opaque Leaseを受け取らない。
 * @concurrency 同じ短期Owner内でのみ適用し、CAS・解放は既存Writerが担当する。
 */
export function prepareLeaseRecoverySettlement(
  current: Snapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: Snapshot["leaseIntents"],
  pending: Snapshot["leaseIntents"][number],
  first: Snapshot["leaseIntents"][number],
  recoveryId: string,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
  }>,
) {
  const root = observeLeaseRoot(observations.observeRoot);
  if (
    current.schema !== PROJECT_SNAPSHOT_SCHEMA ||
    root.repositoryRoot !== initial.repositoryRoot ||
    root.rootIdentity !== initial.rootIdentity ||
    encodeStateValue(
      kind === "project-operation"
        ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
        : null,
    ) !== encodeStateValue(initial.queue) ||
    encodeStateValue(
      current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      ),
    ) !==
      encodeStateValue(
        ownIntents.some((item) => item.phase === "recovery_pending")
          ? ownIntents
          : [...ownIntents, pending],
      )
  )
    return blocked(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const acquired = current.leaseEvidence.find(
    (item) =>
      item.projectId === projectId &&
      item.content.queueId === queueId &&
      item.content.kind === kind &&
      item.content.ownerGeneration === first.ownerGeneration &&
      item.content.disposition === "acquired",
  );
  const ended = current.leaseEvidence.find(
    (item) =>
      item.projectId === projectId &&
      item.content.queueId === queueId &&
      item.content.kind === kind &&
      item.content.ownerGeneration === first.ownerGeneration &&
      item.content.disposition !== "acquired",
  );
  if (ended)
    return blocked(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const evidence = createLeaseEvidence(binding, projectId, 2, {
    kind,
    queueId,
    ownerGeneration: first.ownerGeneration,
    ownerProcessId: first.ownerProcessId,
    disposition: acquired
      ? "recovered_after_owner_loss"
      : "acquisition_unknown_closed",
  });
  const queue: ProjectQueueEntry | null =
    initial.queue === null
      ? null
      : Object.freeze({
          ...initial.queue,
          generation: initial.queue.generation + 1,
          ...(initial.queue.ownerGeneration === null
            ? {}
            : {
                state: "recovery_required" as const,
                ownerGeneration: null,
                resumeCondition: "owner_loss" as const,
              }),
          resultReference: recoveryId,
        });
  return completed("orchestrator_lease_owner_loss_reconciled", {
    next: {
      ...current,
      leaseIntents: current.leaseIntents.filter(
        (item) =>
          !(
            item.projectId === projectId &&
            item.queueId === queueId &&
            item.kind === kind &&
            item.ownerGeneration === first.ownerGeneration
          ),
      ),
      leaseEvidence: [...current.leaseEvidence, evidence],
      queueEntries:
        queue === null
          ? current.queueEntries
          : current.queueEntries.map((item) =>
              item.queueId === queueId ? queue : item,
            ),
    },
    value: { queue, recoveryId },
  });
}

/**
 * 用途固定Root観測の同期・閉形式を検査する。
 * @responsibility Promise・thenable・accessor・Proxyを物理不存在や正規Rootへ畳まない。
 * @trace ARCH-000008
 * @input observe: Coordinatorの同期Root投影。
 * @returns 同じ二fieldの観測値。
 * @precondition 元のlstat位置でのみ呼ぶ。
 * @postcondition 無効観測では後続mark・保存候補を発行しない。
 * @effect 同期観測一回。FilesystemはCoordinatorに残す。
 * @failure 無効観測は既存の観測不能例外へ接続する。
 * @invariant 値の形式をRootの現在真正性としない。
 * @boundary このFileの四つのRoot観測箇所だけ。
 * @security getter・then・Proxyを評価しない。
 * @concurrency N/A: 同期処理。
 */
function observeLeaseRoot(
  observe: () => Readonly<{ repositoryRoot: string; rootIdentity: string }>,
) {
  const value = observe();
  if (!value || typeof value !== "object" || types.isProxy(value))
    throw Error("orchestrator_lease_recovery_observation_unknown");
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || "then" in value)
    throw Error("orchestrator_lease_recovery_observation_unknown");
  const properties = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(properties).length !== 2 ||
    !properties.repositoryRoot ||
    !("value" in properties.repositoryRoot) ||
    !properties.rootIdentity ||
    !("value" in properties.rootIdentity) ||
    typeof properties.repositoryRoot.value !== "string" ||
    properties.repositoryRoot.value.length === 0 ||
    typeof properties.rootIdentity.value !== "string" ||
    !/^[a-f0-9]{64}$/.test(properties.rootIdentity.value)
  )
    throw Error("orchestrator_lease_recovery_observation_unknown");
  return value;
}

/**
 * 既存Lease証拠の閉形式・本文Hash・世代を生成する。
 * @responsibility 旧Envelopeのlease-evidence枝だけを同じ値で生成する。
 * @trace ARCH-000004
 * @input binding、Project ID、更新世代、既存Lease証拠本文。
 * @returns 外側だけfreezeした同じ証拠。
 * @precondition N/A: 本文は既存validatorで検査する。
 * @postcondition 本文参照をclone・deep-freezeしない。
 * @effect N/A: 値操作だけ。
 * @failure 不正本文は元の固定例外。
 * @invariant HashをAuthority・実解放の証明にしない。
 * @boundary このFileの取得・解放・回復終了候補だけ。
 * @security 保存又は実操作を公開しない。
 * @concurrency N/A: 同期の局所値操作。
 */
function createLeaseEvidence(
  binding: string,
  projectId: string,
  updatedGeneration: number,
  content: LeaseEvidenceContent,
): LeaseEvidenceEnvelope {
  if (!validLeaseEvidence(content))
    throw new Error("orchestrator_record_content_invalid");
  const serialized = encodeStateValue(content);
  return Object.freeze({
    schema: STORAGE_CONTRACT,
    schemaRevision: 1 as const,
    recordKind: "lease-evidence" as const,
    repositoryBindingId: binding,
    projectId,
    createdGeneration: 1,
    updatedGeneration,
    contentHash: hashStateText(serialized),
    content,
  });
}

/** 旧Storeの成功封筒だけを局所値として再現する。 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/** 旧Storeの拒否理由とexact回復参照を保持する。 */
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
 * 現在状態と固定情報に使用する内容Hashを導出する。
 * @responsibility 宣言したsorted-key UTF-8本文と一つのLFへ結合する。
 * @trace ARCH-000008
 * @input value: plain JSON値。
 * @returns 内容のSHA-256。
 * @precondition 値が固定encodingで表現可能。
 * @postcondition objectの挿入順に依存しない。
 * @effect N/A: メモリ内のHash計算だけ。
 * @failure 不正値はencoderの例外を返す。
 * @invariant 可変SnapshotのHashと固定操作情報のHashを混同しない。
 * @boundary 保存内容の相関。
 * @security HashをAuthorityとして発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function hashExecutionStateContent(value: unknown): string {
  return createHash("sha256")
    .update(`${encodeStateValue(value)}\n`, "utf8")
    .digest("hex");
}

/**
 * 保存Bufferを一意なJSON値として安全に復号する。
 * @responsibility intrinsic Buffer境界、UTF-8、深度と正規encodingを検査する。
 * @trace ARCH-000008
 * @input input: 未信頼のBuffer候補。
 * @returns 不変JSON値と本文Hash、又はnull。意味Schemaは呼出し側が検査する。
 * @precondition N/A: 任意の入力を拒否可能な境界として扱う。
 * @postcondition Proxyや入力側のlength Getterを評価せず一意byte形式だけを受理する。
 * @effect N/A: メモリ内の復号だけ。
 * @failure 不正Buffer、UTF-8、JSON、深度超過、非正規encodingはnull。
 * @invariant Propertyの重複や順序差を黙って正規化しない。
 * @boundary Buffer byte列と意味検証前のJSON値。
 * @security 本文を実資源不存在、所有権または処置許可へ昇格しない。
 * @concurrency N/A: 保存や共有状態更新を行わない。
 */
export function decodeExecutionStateBytes(input: unknown) {
  try {
    if (types.isProxy(input) || !Buffer.isBuffer(input)) return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (!Number.isSafeInteger(length) || length === 0) return null;
    const buffer = Object.getOwnPropertyDescriptor(
      intrinsic,
      "buffer",
    )?.get?.call(input);
    const offset = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteOffset",
    )?.get?.call(input);
    const bytes = Buffer.from(new Uint8Array(buffer, offset, length));
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const parsed = JSON.parse(text, (_key, value) =>
      value && typeof value === "object" ? Object.freeze(value) : value,
    );
    if (`${encodeStateValue(parsed)}\n` !== text) return null;
    return Object.freeze({
      value: parsed as unknown,
      payloadSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch {
    return null;
  }
}

/**
 * 検証済みSnapshotからProjectの現在値だけを投影する。
 * @responsibility 既存のSchema・ID共同検査と不存在のnullを維持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同じ保存Ownerが読み直したSnapshot、projectId: 照会ID。
 * @returns 既存結果封筒の変更候補又は投影、拒否時は元の固定理由。
 * @precondition 同じ短期保存Ownerがfresh SnapshotとRepository結合を検証している。
 * @postcondition 入力と対象外区画を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 不正Schemaを先に拒否し、有効Schemaの不正IDはID不正理由を返す。
 * @invariant 候補のcompletedを耐久保存・認可・実資源終了の証明へ読み替えない。
 * @boundary Coordinator専用メモリ投影と、別Ownerが持つ単一Writer。
 * @security 値はAuthorityではなく、保存Ownerや任意callbackを公開しない。
 * @concurrency 保存CASと現在Owner再確認・解放は既存Writerが行う。
 */

export function projectCurrentState(current: Snapshot, projectId: string) {
  if (current.schema !== PROJECT_SNAPSHOT_SCHEMA || !validId(projectId))
    return Object.freeze({
      status: "blocked" as const,
      reason:
        current.schema !== PROJECT_SNAPSHOT_SCHEMA
          ? "orchestrator_snapshot_schema_invalid"
          : "orchestrator_state_identity_invalid",
      value: null,
      manualRecoveryRequired: false,
      recoveryId: null,
    });
  return Object.freeze({
    status: "completed" as const,
    reason: "orchestrator_state_observed",
    value: {
      next: null,
      value:
        current.projects.find((item) => item.projectId === projectId) ?? null,
    },
  });
}

/**
 * 二組四観測を同じauth unknownへだけ保存する候補を導出する。
 * @responsibility 元結果・他資源・他操作を保持し、専用Writerの固定候補を作る。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、observationsValue、repositoryBinding: 元本文と専用観測。
 * @returns 専用次版、同値本文、または不正入力のnull。
 * @precondition 呼出し側が実観測と生成源の終端を確認している。
 * @postcondition 候補だけでは保存や限定終了を許可しない。
 * @effect N/A: 同期値変換だけ。
 * @failure 欠測・一回観測・観測不明・限定条件差はnull。
 * @invariant 過去request unknown・一次失敗・元結果を保持する。
 * @boundary 専用回収Ownerと物理Writer。
 * @security 通常resource／cleanup候補からこの辺を生成しない。
 * @concurrency 元版Hashは既存previousとCASへ結合する。
 */
export function prepareAuthenticationUnknownClosureSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (
      !current ||
      typeof recoveryId !== "string" ||
      encodeStateValue(observationsValue) !==
        encodeStateValue([
          { round: 1, name: "absent", name_label: "absent" },
          { round: 2, name: "absent", name_label: "absent" },
        ])
    )
      return null;
    const operation = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation) return null;
    const hash = authenticationClosureEvidence(operation);
    if (!hash) return null;
    if (areTaskResourcesSettled(operation))
      return Buffer.from(currentBytes as Buffer);
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : {
              ...operation,
              resources: operation.resources && {
                ...operation.resources,
                checkpoints: operation.resources.checkpoints.map((resource) =>
                  resource.key !== "create_subscription_auth_probe"
                    ? resource
                    : {
                        ...resource,
                        observation: "absent",
                        absenceEvidenceSha256: hash,
                      },
                ),
              },
            },
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一回確定した操作Identityを最新Snapshotの次版へ追加する。
 * @responsibility 初回checkpointと元版Hashを構成し、既存操作・回復・搬送を保持する。
 * @trace ARCH-000008
 * @input currentBytes: 確認済み元本文または初回null、identityJson: 確定基本情報、repositoryBinding: 検証済み結合。
 * @returns 構造と遷移を検査した次版のbyte列、またはnull。
 * @precondition 呼出し元がHome Leaseを保持し、初期Hostと操作Ownerを確認している。
 * @postcondition 同じIdentityを再追加せず、他操作の現在値を変更しない。
 * @effect N/A: メモリ内の候補構築だけ。保存・Host遷移・Docker要求は発行しない。
 * @failure 不正本文、重複Identity、上限または元版不一致はnull。
 * @invariant null元版は初回Authorityを意味せず、Writerで新品領域を別確認する。
 * @boundary 固定Operation情報とRepository現在Snapshot。
 * @security JSONからAuthorityを発行せず、秘密や追加Pathを生成しない。
 * @concurrency 元版Hashを保持し、競合時に盲目的な再試行をしない。
 */
export function prepareStateOperationSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const identitySha256 = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const recoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${identity.operationNonce}.${identitySha256}`;
    const operation: ExecutionOperationRecord = {
      kind: "docker_task",
      dockerRestart: null,
      identityJson,
      identitySha256,
      recoveryId,
      phase: "executing",
      resources: null,
      host: {
        currentToken: identity.initialHostRecoveryId,
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      lease: "held",
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "active",
        workspaceReusable: false,
      },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    if (
      current?.snapshot.operations.some(
        (item) => item.kind === "runtime_repair" && item.phase !== "terminal",
      )
    )
      return null;
    const operations = [...(current?.snapshot.operations ?? []), operation];
    operations.sort((left, right) => {
      const a = JSON.parse(left.identityJson).operationNonce as string;
      const b = JSON.parse(right.identityJson).operationNonce as string;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const next: ExecutionStateSnapshot = {
      ...(current?.snapshot ?? EMPTY_EXECUTION_TASK_SECTIONS),
      schema: EXECUTION_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      projects: current?.snapshot.projects ?? [],
      managedExecutions: current
        ? associateTaskOperations(current.snapshot, operations)
        : [],
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 修復Identityを同じ現在状態へ追加する候補を構成する。
 * @responsibility Task fieldを作らず、既存全操作と参照を保存する。
 * @trace ARCH-000008
 * @input currentBytes: 元版または初回null、identityJson: 修復固定情報、repositoryBinding: 現在結合。
 * @returns 最新v2の次版、またはnull。
 * @precondition 物理Ownerが現在Root・利用者・操作Scopeを別に確認する。
 * @postcondition 同じRepository内の未終了修復は一つだけ。
 * @effect N/A: 候補生成のみ。
 * @failure 旧Schema、Identity不正、衝突、重複修復はnull。
 * @invariant 候補から処置・排他Authorityを生成しない。
 * @boundary 修復の不変情報と現在Snapshot。
 * @security Provider・Home・任意Pathを補完しない。
 * @concurrency 元版Hashへ結合し、保存側で競合照合する。
 */
export function prepareStateRepairSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const hash = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const operation: RepairOperationRecord = {
      kind: "runtime_repair",
      identityJson,
      identitySha256: hash,
      recoveryId: `docker-runtime-repair.${identity.operationNonce}.${hash}`,
      phase: "repairing",
      checkpoint: null,
      disposition: "not_applicable",
      disposal: null,
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    if (!validRepairOperation(operation, repositoryBinding as string))
      return null;
    const operations = [
      ...(current?.snapshot.operations ?? []),
      operation,
    ].sort((a, b) =>
      operationNonce(a) < operationNonce(b)
        ? -1
        : operationNonce(a) > operationNonce(b)
          ? 1
          : 0,
    );
    const next = {
      ...(current?.snapshot ?? EMPTY_EXECUTION_TASK_SECTIONS),
      schema: EXECUTION_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一修復の技術値と上位状態だけを元版へ結合する。
 * @responsibility 他Task／修復・履歴・配送を変更しない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、recoveryId: exact参照、update: 修復可変五field、repositoryBinding: 現在結合。
 * @returns 検査済み次版、またはnull。
 * @precondition 実Writerが観測・保持判断の根拠を確認する。
 * @postcondition Identity・回復ID・対象外全文を保持する。
 * @effect N/A: 値検査と候補生成だけ。
 * @failure 余剰field、別kind、巻戻し・順序違反はnull。
 * @invariant 保存候補は実処置や人間判断の証明ではない。
 * @boundary 技術通知と現在状態の更新。
 * @security 任意SnapshotやTask fieldの更新を受け付けない。
 * @concurrency 元版・revision・Hashを固定する。
 */
export function prepareStateRepairCheckpointSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  update: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!current) return null;
    const value = JSON.parse(encodeStateValue(update));
    if (
      !hasExecutionStateRecordKeys(value, [
        "phase",
        "checkpoint",
        "disposition",
        "primaryFailure",
        "outcome",
      ])
    )
      return null;
    const target = current.snapshot.operations.find(
      (item): item is RepairOperationRecord =>
        item.kind === "runtime_repair" && item.recoveryId === recoveryId,
    );
    if (!target) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === target ? { ...item, ...value } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ未終端修復の新しい補助子取得を次版へ結合する。
 * @responsibility 回収済みの旧呼出しと新呼出しの回収義務を分ける。
 * @trace ARCH-000008
 * @input currentBytes: 元版、recoveryId: exact修復参照、repositoryBinding: 現在結合。
 * @returns cleanupだけpendingへ変えた次版、またはnull。
 * @precondition 実Ownerが同じ主体・Scopeと新Native子の取得を別途確認する。
 * @postcondition 元の一次失敗・確定結果・他操作を変更しない。
 * @effect N/A: 純粋な保存候補生成。
 * @failure 未回収、回収失敗、終端済み、一次失敗あり、別IDはnull。
 * @invariant unknownを新取得で成功へ変えず、通常遷移を緩めない。
 * @boundary 値候補と物理Writer／実Native Session。
 * @security 戻り値は取得・処置・保存の許可ではない。
 * @concurrency 元版HashとRevisionを維持し、Writerで再照合する。
 */
export function prepareStateRepairSessionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!current || typeof recoveryId !== "string") return null;
    const target = current.snapshot.operations.find(
      (item): item is RepairOperationRecord =>
        item.kind === "runtime_repair" && item.recoveryId === recoveryId,
    );
    if (
      target?.phase !== "repairing" ||
      target.primaryFailure !== null ||
      target.outcome !== null
    )
      return null;
    const checkpoint = prepareEnvironmentRepairSessionCheckpoint(
      target.checkpoint,
    );
    if (checkpoint === null) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === target ? { ...item, checkpoint } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransitionValue(
      currentBytes,
      bytes,
      repositoryBinding,
      recoveryId,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 未出版の保持判断待ちへ期限と用途別照合値を一度だけ結合する。
 * @responsibility 期限付き引渡し候補だけを専用保存から導入する。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact参照、receipt: 時刻と三用途、repositoryBinding: 現在結合。
 * @returns 一改訂の完全候補、または拒否のnull。
 * @precondition fresh読取り・明示保持・物理Ownerは呼出し元が確認する。
 * @postcondition 元結果・技術checkpoint・他操作・参照・配送は全文維持する。
 * @effect N/A: 純粋値だけ。物理保存は既存専用Writerが所有する。
 * @failure 既出版・既保持・時刻不正・用途差・非正規元版はnull。
 * @invariant 新しい保持期限を再入場や現在時計から補完しない。
 * @boundary 純粋引渡し候補と既存専用Writer。
 * @security 一般更新の許可集合を拡張しない。
 * @concurrency 元本文と版は物理保存時に別に再確認する。
 */
export function prepareStateRepairRetentionHandoffSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  receipt: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    const target = current?.snapshot.operations.find(
      (operation): operation is RepairOperationRecord =>
        operation.kind === "runtime_repair" &&
        operation.recoveryId === recoveryId,
    );
    const captured = JSON.parse(encodeStateValue(receipt));
    if (
      !current ||
      !target ||
      !Buffer.isBuffer(currentBytes) ||
      !currentBytes.equals(
        Buffer.from(`${encodeStateValue(current.snapshot)}\n`),
      ) ||
      target.summarySha256 !== null ||
      target.history !== null ||
      target.phase !== "awaiting_disposition" ||
      target.disposition !== "pending_human_decision" ||
      target.disposal !== null ||
      target.outcome?.status !== "recovered" ||
      target.primaryFailure !== null ||
      Object.hasOwn(target, "retention") ||
      !validRepairRetentionReceipt(captured) ||
      !target.checkpoint ||
      target.checkpoint.stale !== "retained" ||
      target.checkpoint.engine !== "ready" ||
      target.checkpoint.hostSafety !== "safe" ||
      target.checkpoint.cleanup !== "confirmed" ||
      target.checkpoint.cleanupFailure !== null ||
      !isRepairCheckpointSettled(target.checkpoint) ||
      !repairRetentionMatchesCheckpoint(captured, target.checkpoint)
    )
      return null;
    const bytes = Buffer.from(
      `${encodeStateValue({
        ...current.snapshot,
        revision: current.snapshot.revision + 1,
        previous: {
          revision: current.snapshot.revision,
          payloadSha256: current.payloadSha256,
        },
        operations: current.snapshot.operations.map((operation) =>
          operation.recoveryId === recoveryId
            ? {
                ...operation,
                phase: "settling",
                disposition: "retained_by_human_decision",
                retention: captured,
              }
            : operation,
        ),
      })}\n`,
    );
    return decodeStateSnapshot(bytes, repositoryBinding) ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * 保持引渡し候補を元版から全文再導出する。
 * @responsibility 専用候補へ他操作や余剰更新を混入させない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、recoveryId: exact参照、repositoryBinding: 結合。
 * @returns 元版から同じreceiptを再導出した完全一致だけtrue。
 * @precondition fresh読取り・Owner・物理保存は別の責務。
 * @postcondition 一般Writerからのreceipt導入を許可しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 別ID・余剰変更・非正規本文・既出版はfalse。
 * @invariant trueを実保存・引渡し・削除許可と同一視しない。
 * @boundary 専用純粋候補と既存専用Writer境界。
 * @security 保存JSONから人間承認を復元しない。
 * @concurrency 元版の再観測は物理Writerが所有する。
 */
export function validateStateRepairRetentionHandoffTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): boolean {
  const next = decodeStateSnapshot(nextBytes, repositoryBinding);
  const target = next?.snapshot.operations.find(
    (operation): operation is RepairOperationRecord =>
      operation.kind === "runtime_repair" &&
      operation.recoveryId === recoveryId,
  );
  if (!target?.retention || !Buffer.isBuffer(nextBytes)) return false;
  return (
    prepareStateRepairRetentionHandoffSnapshot(
      currentBytes,
      recoveryId,
      target.retention,
      repositoryBinding,
    )?.equals(nextBytes) === true
  );
}

/**
 * fresh再入場の完全候補を元版から独立に再導出して照合する。
 * @responsibility 専用更新へ他field変更を混入させない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 保存候補、recoveryId: exact参照、repositoryBinding: 結合。
 * @returns 再導出したcanonical bytesと一致する場合だけtrue。
 * @precondition Writerが真正Ownerと現在Native取得を別途確認する。
 * @postcondition 通常Writerの更新許可を拡大しない。
 * @effect N/A: メモリ検査のみ。
 * @failure 不正元版、別ID、余分変更、非canonical候補はfalse。
 * @invariant cleanup以外の操作内容・参照・結果を保全する。
 * @boundary 専用候補と物理保存。
 * @security trueはAuthorityや実Session取得の証明ではない。
 * @concurrency N/A: 排他・元版再観測は保存Owner。
 */
export function validateStateRepairSessionTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): boolean {
  const expected = prepareStateRepairSessionSnapshot(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  return (
    expected !== null &&
    Buffer.isBuffer(nextBytes) &&
    expected.equals(nextBytes)
  );
}

/**
 * 未出版の保持判断待ちから通常回収の判断だけを確定する。
 * @responsibility 元修復結果を変更せず、後続進捗の初期値を同じ操作へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact対象、decidedAt: UTC判断時刻、repositoryBinding: 現在結合。
 * @returns 判断と初期進捗だけを追加した次版、またはnull。
 * @precondition 実Ownerと採用済み回収方針は保存側で確認する。
 * @postcondition 元checkpoint・結果・失敗・他操作・参照・配送を全文保持する。
 * @effect N/A: 純粋な候補生成だけ。
 * @failure 未完了、既保持、既出版、別ID、非正規元版・時刻はnull。
 * @invariant 各用途の削除意図はまだ未保存であり、物理処置を許可しない。
 * @boundary 上位の回収判断と専用Writerへ渡す値候補。
 * @security 通常checkpoint更新からこの判断を偽装できない。
 * @concurrency 元版Hash・改訂を固定し、物理保存は別途CASする。
 */
export function prepareStateRepairDisposalDecisionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  decidedAt: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  if (
    !current ||
    !Buffer.isBuffer(currentBytes) ||
    !currentBytes.equals(
      Buffer.from(`${encodeStateValue(current.snapshot)}\n`),
    ) ||
    typeof recoveryId !== "string" ||
    typeof decidedAt !== "string" ||
    !Number.isFinite(Date.parse(decidedAt)) ||
    new Date(decidedAt).toISOString() !== decidedAt
  )
    return null;
  const targets = current.snapshot.operations.filter(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const target = targets[0];
  if (
    targets.length !== 1 ||
    !target ||
    target.phase !== "awaiting_disposition" ||
    target.disposition !== "pending_human_decision" ||
    target.disposal !== null ||
    target.summarySha256 !== null ||
    target.history !== null ||
    target.outcome?.status !== "recovered" ||
    target.primaryFailure !== null ||
    target.checkpoint?.stale !== "retained" ||
    target.checkpoint.engine !== "ready" ||
    target.checkpoint.hostSafety !== "safe" ||
    target.checkpoint.cleanup !== "confirmed" ||
    target.checkpoint.cleanupFailure !== null ||
    !isRepairCheckpointSettled(target.checkpoint)
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.map((item) =>
      item === target
        ? {
            ...item,
            phase: "settling",
            disposition: "discard",
            disposal: {
              decidedAt,
              checkpoint: createEnvironmentRepairDisposalCheckpoint(),
            },
          }
        : item,
    ),
  };
  const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
  return decodeStateSnapshot(bytes, repositoryBinding) ? bytes : null;
}

/**
 * 同じ回収判断の一用途だけに単調な技術進捗を結合する。
 * @responsibility 元修復・判断時刻・履歴と別用途を変更しない。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact対象、purpose: 固定用途、checkpoint: 次の回収値、repositoryBinding: 結合。
 * @returns 検査済み次版。同値なら改訂しない元版bytes、拒否時null。
 * @precondition 実体・Owner・保存確認と処置順序はDriver／Writerが所有する。
 * @postcondition 要約確定後は同値も拒否し、元結果は全文維持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 判断前、別ID、用途外変更、巻戻し、後続出版済みはnull。
 * @invariant 候補生成や同値返却は保存・不存在・Effect 0の実証ではない。
 * @boundary DIの値検査と既存現在状態。
 * @security 通常更新の許可集合を広げない。
 * @concurrency 元版CASと同値時の無書込み確認は物理Writerへ接続する。
 */
export function prepareStateRepairDisposalProgressSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  purpose: unknown,
  checkpoint: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const captured = decodeEnvironmentRepairDisposalCheckpoint(checkpoint);
  if (
    !current ||
    !captured ||
    !Buffer.isBuffer(currentBytes) ||
    !currentBytes.equals(
      Buffer.from(`${encodeStateValue(current.snapshot)}\n`),
    ) ||
    typeof recoveryId !== "string"
  )
    return null;
  const targets = current.snapshot.operations.filter(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const target = targets[0];
  if (
    targets.length !== 1 ||
    !target ||
    target.phase !== "settling" ||
    target.disposition !== "discard" ||
    !target.disposal ||
    target.summarySha256 !== null ||
    target.history !== null ||
    !validateEnvironmentRepairDisposalTransition(
      target.disposal.checkpoint,
      captured,
      purpose,
    )
  )
    return null;
  if (
    encodeStateValue(target.disposal.checkpoint) === encodeStateValue(captured)
  )
    return Buffer.from(currentBytes);
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.map((item) =>
      item === target
        ? {
            ...item,
            disposal: { ...target.disposal, checkpoint: captured },
          }
        : item,
    ),
  };
  const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
  return decodeStateSnapshot(bytes, repositoryBinding) ? bytes : null;
}

/**
 * 専用回収候補を元版から再導出して全文照合する。
 * @responsibility decisionと一用途progressを通常保存・任意Snapshotから分離する。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、recoveryId: exact参照、purpose: decisionまたは固定用途、repositoryBinding: 結合。
 * @returns 専用候補と正規bytesが完全一致する場合だけtrue。
 * @precondition 物理Owner・CAS・purposeと保存入口の結合はWriterが別に確認する。
 * @postcondition 候補に含まれる時刻以外の新しい判断情報を推測しない。
 * @effect N/A: メモリ内の値再導出だけ。
 * @failure 別対象、別用途、他field差、非正規候補はfalse。
 * @invariant 同値progressは元版bytesだけを許し、改訂を増やさない。
 * @boundary 専用候補と物理Writer／保存再入場。
 * @security trueは処置・実保存の許可ではない。
 * @concurrency 元版・候補の複製と再観測は物理保存側の責務。
 */
export function validateStateRepairDisposalTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  purpose: unknown,
  repositoryBinding: unknown,
): boolean {
  const next = decodeStateSnapshot(nextBytes, repositoryBinding);
  const target = next?.snapshot.operations.find(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!target?.disposal || !Buffer.isBuffer(nextBytes)) return false;
  const expected =
    purpose === "decision"
      ? prepareStateRepairDisposalDecisionSnapshot(
          currentBytes,
          recoveryId,
          target.disposal.decidedAt,
          repositoryBinding,
        )
      : prepareStateRepairDisposalProgressSnapshot(
          currentBytes,
          recoveryId,
          purpose,
          target.disposal.checkpoint,
          repositoryBinding,
        );
  return expected?.equals(nextBytes) === true;
}

/**
 * exact修復の保存途中本文を既存候補から再導出する。
 * @responsibility 出版可能なmetadataと技術再開の許可を分離する。
 * @trace ARCH-000008
 * @input currentBytes: 明示不存在または元版、pendingBytes: 短命候補、recoveryId: exact参照、repositoryBinding: 現在結合。
 * @returns 一意な出版種別と元版・候補の複製、またはnull。
 * @precondition 物理OwnerがRoot・実体・排他・markerを別に確認する。
 * @postcondition 新しい観測・処置・人間判断を生成しない。
 * @effect N/A: メモリ内の再導出だけ。
 * @failure 非canonical・別対象・非対象変更・複数解釈はnull。
 * @invariant 初回は単一の空Repairだけ、既出版同値は改訂不変。
 * @boundary pending metadataと物理Writer。
 * @security 結果はNative・Dockerの実行許可ではない。
 * @concurrency 元版と実体の再照合はWriterが行う。
 */
export function classifyRepairPublication(
  currentBytes: unknown,
  pendingBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
) {
  if (!Buffer.isBuffer(pendingBytes) || typeof recoveryId !== "string")
    return null;
  const next = decodeStateSnapshot(pendingBytes, repositoryBinding);
  const before =
    currentBytes === null
      ? null
      : decodeStateSnapshot(currentBytes, repositoryBinding);
  if (
    !next ||
    (currentBytes !== null && !before) ||
    !pendingBytes.equals(Buffer.from(`${encodeStateValue(next.snapshot)}\n`)) ||
    (before &&
      (!Buffer.isBuffer(currentBytes) ||
        !currentBytes.equals(
          Buffer.from(`${encodeStateValue(before.snapshot)}\n`),
        )))
  )
    return null;
  const targets = next.snapshot.operations.filter(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (targets.length !== 1) return null;
  const target = targets[0];
  if (!target) return null;
  const modes: (
    | "initial_publication"
    | "identity"
    | "checkpoint"
    | "session_begin"
    | "retention_handoff"
    | "disposal_decision"
    | "disposal_primary"
    | "disposal_failed"
    | "disposal_auxiliary"
    | "remove_pending"
  )[] = [];
  if (Buffer.isBuffer(currentBytes) && pendingBytes.equals(currentBytes))
    modes.push("remove_pending");
  else {
    const prior = before?.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (!prior) {
      const expected = prepareStateRepairSnapshot(
        currentBytes,
        target.identityJson,
        repositoryBinding,
      );
      if (
        expected?.equals(pendingBytes) &&
        (before !== null ||
          (next.snapshot.operations.length === 1 &&
            next.snapshot.unresolvedRecoveries.length === 0))
      )
        modes.push(before ? "identity" : "initial_publication");
    } else if (prior.kind === "runtime_repair") {
      const expected = prepareStateRepairCheckpointSnapshot(
        currentBytes,
        recoveryId,
        {
          phase: target.phase,
          checkpoint: target.checkpoint,
          disposition: target.disposition,
          primaryFailure: target.primaryFailure,
          outcome: target.outcome,
        },
        repositoryBinding,
      );
      if (expected?.equals(pendingBytes)) modes.push("checkpoint");
      if (
        validateStateRepairRetentionHandoffTransition(
          currentBytes,
          pendingBytes,
          recoveryId,
          repositoryBinding,
        )
      )
        modes.push("retention_handoff");
      if (
        prepareStateRepairSessionSnapshot(
          currentBytes,
          recoveryId,
          repositoryBinding,
        )?.equals(pendingBytes)
      )
        modes.push("session_begin");
      for (const purpose of [
        "decision",
        "primary",
        "failed",
        "auxiliary",
      ] as const) {
        if (
          validateStateRepairDisposalTransition(
            currentBytes,
            pendingBytes,
            recoveryId,
            purpose,
            repositoryBinding,
          )
        )
          modes.push(`disposal_${purpose}`);
      }
    }
  }
  if (modes.length !== 1 || !modes[0]) return null;
  return Object.freeze({
    mode: modes[0],
    before: Buffer.isBuffer(currentBytes) ? Buffer.from(currentBytes) : null,
    candidate: Buffer.from(pendingBytes),
  });
}

/**
 * 同じ回復参照の指定checkpointだけを次のSnapshotへ接続する。
 *
 * @responsibility 要求前・発行後・作成結果と現在観測の構造的な遷移を保存候補へ搬送する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文。recoveryId: exact参照。resourceValue: 完全評価。repositoryBinding: 検証済み結合。kind: 資源・Host・実行終端の固定種別。
 * @returns 遷移検査済みの次版byte列、またはnull。
 * @precondition 現在観測と要求の発行事実は呼出し側の実行境界で取得する。
 * @postcondition 指定したcheckpoint以外を保持し、一次失敗・確定結果の不許可更新を拒否する。
 * @effect N/A: 純粋な値変換だけ。保存やDocker要求を発行しない。
 * @failure 不正値・別参照・不正遷移・改訂上限をnullで拒否する。
 * @invariant unknownを成功や再発行許可に変換せず、既知の作成Identityを置換しない。
 * @boundary 実行境界の観測値と固定Snapshotの間。
 * @security 保存値から実資源不存在やAuthorityを推定しない。
 * @concurrency 元版相関を保持し、Writerで競合確認と排他を行う。
 */
function prepareStateOperationCheckpoint(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
  kind: "resource" | "host" | "lifecycle" | "restart",
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!current || typeof recoveryId !== "string") return null;
    const resource = JSON.parse(encodeStateValue(resourceValue));
    const operation = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      (kind === "resource" &&
        !validateResourceBookTransition(operation.resources, resource)) ||
      (kind === "lifecycle" &&
        !hasExecutionStateRecordKeys(resource, [
          "phase",
          "lease",
          "execution",
          "primaryFailure",
          "outcome",
          "summarySha256",
        ]))
    )
      return null;
    if (
      kind === "lifecycle" &&
      resource.summarySha256 !== operation.summarySha256
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item.kind !== "docker_task" || item !== operation
          ? item
          : {
              ...item,
              dockerRestart: kind === "restart" ? resource : item.dockerRestart,
              ...(kind === "lifecycle" ? resource : {}),
              host: kind === "host" ? resource : item.host,
              resources: kind !== "resource" ? item.resources : resource,
            },
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一資源の評価だけを次版へ搬送する。
 *
 * @responsibility 固定資源purposeと現在操作のcheckpointを相関する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。resourceValue: 一資源評価。repositoryBinding: 現在結合。
 * @returns 遷移検査済みの次版、またはnull。
 * @precondition 評価は実行Ownerが取得する。
 * @postcondition 他資源とHost・結果は変更しない。
 * @effect N/A: 純粋な値変換だけ。
 * @failure 不正値、別参照・結合と不許可遷移を拒否する。
 * @invariant ID・要求の既知事実を消さない。
 * @boundary 実行評価と保存候補。
 * @security 値変換を資源観測やAuthorityへ昇格しない。
 * @concurrency 元版Hashを保持し、Writerで競合照合する。
 */
export function prepareStateResourceSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    const operation = current?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation) return null;
    const book = applyResourceEvent(operation.resources, resourceValue);
    return book
      ? prepareStateOperationCheckpoint(
          currentBytes,
          recoveryId,
          book,
          repositoryBinding,
          "resource",
        )
      : null;
  } catch {
    return null;
  }
}

/**
 * Hostの処置前記録と観測済み次世代を次版へ搬送する。
 *
 * @responsibility 保存済み遷移意図を経ない世代変更と未確定意図の消去を拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。hostValue: Host現在評価。repositoryBinding: 現在結合。
 * @returns lineageと改訂遷移を検査した次版、またはnull。
 * @precondition Hostの実体、処置と受理結果は既存Host Ownerが確認する。
 * @postcondition 同じ操作のHostだけを更新し、他checkpointを保持する。
 * @effect N/A: 値変換のみ。Host処置や保存は行わない。
 * @failure 別世代、処置前記録欠測、不正本文と不許可遷移はnull。
 * @invariant 処置前意図から完了を推定せず、unknownを成功へ丸めない。
 * @boundary Host Ownerの確定記録とSnapshot候補。
 * @security Host TokenとJSONを処置Authorityとして扱わない。
 * @concurrency 元版相関を保持し、実保存時に再照合を要求する。
 */
export function prepareStateHostSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  hostValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    hostValue,
    repositoryBinding,
    "host",
  );
}

/**
 * 実行・Lease・一次失敗・最終結果の現在評価を次版へ搬送する。
 *
 * @responsibility 実行checkpointの閉じたfield集合を更新し、固定Identity・資源・Hostを保持する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。lifecycleValue: 固定六fieldの現在評価。repositoryBinding: 現在結合。
 * @returns 既知事実保持と改訂遷移を検査した次版、またはnull。
 * @precondition 実行とLeaseの現在事実は各Ownerが取得している。
 * @postcondition 一次失敗・確定結果・要約Hashの上書きと既知Effectの未発行化を拒否する。
 * @effect N/A: 値変換だけ。Provider実行・Lease操作・保存は行わない。
 * @failure 未評価field、不正値、別結合と不許可遷移はnull。
 * @invariant 過去unknownを未発行へ戻さず、後続回収で最初の失敗を消さない。
 * @boundary 実行Ownerの現在評価とSnapshot保存候補。
 * @security 保存結果を資源不存在、Authority失効やLease解放の実証にしない。
 * @concurrency 元版Hashへ結合し、Writerの排他とfresh照合を要求する。
 */
export function prepareStateLifecycleSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  lifecycleValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    lifecycleValue,
    repositoryBinding,
    "lifecycle",
  );
}

/**
 * 同じ操作の単一再起動checkpointを次版へ搬送する。
 * @responsibility 固定要求ID・Scopeと許容組合せを他の操作から分離する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、checkpoint、repositoryBinding: 元版とexact対象。
 * @returns 遷移確認済みの次版、またはnull。
 * @precondition 実行許可・同Owner観測・Host排他は呼出し側が別に確認する。
 * @postcondition Task一次失敗・結果・他操作を変更しない。
 * @effect N/A: 保存候補の値変換だけ。
 * @failure 別要求・不正組合せ・元版不一致はnull。
 * @invariant 一操作一要求。保存値から要求を再発行しない。
 * @boundary 再起動Ownerの観測と現在Snapshot。
 * @security Hash・保存成功を操作Authorityにしない。
 * @concurrency 元版相関と既存Writer排他を要求する。
 */
export function prepareStateRestartSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  checkpoint: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    checkpoint,
    repositoryBinding,
    "restart",
  );
}

/**
 * 五資源の回収観測を同じ改訂版へまとめる。
 *
 * @responsibility 未要求、exact IDの不存在と観測不能を区別して保存候補へ接続する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。observationsValue: 固定五資源の回収結果。repositoryBinding: 現在結合。
 * @returns 全資源の相関と遷移が成立する次版、またはnull。
 * @precondition 呼出し側が現在の回収結果を実行Ownerから取得している。
 * @postcondition 全五資源を一回の改訂で更新し、他操作とHost・実行結果を保持する。
 * @effect N/A: 値変換だけ。資源削除や保存は行わない。
 * @failure 欠測、重複、別名・別ID、未要求の偽装と不正遷移を拒否する。
 * @invariant ID未確定の不存在を通常回収の成立へ昇格しない。
 * @boundary 回収Ownerの観測と現在状態の保存候補。
 * @security 観測のHashは相関用であり、実不存在やAuthorityの証明ではない。
 * @concurrency 全結果を同じ元版へ結合し、物理Writerの競合照合を要求する。
 */
export function prepareStateCleanupSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!current || typeof recoveryId !== "string") return null;
    const payload = JSON.parse(encodeStateValue(observationsValue));
    if (!hasExecutionStateRecordKeys(payload, ["snapshot", "observations"]))
      return null;
    const observations = payload.observations;
    const snapshot = payload.snapshot as OperationResources["snapshot"] | null;
    const operation = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation || !Array.isArray(observations)) return null;
    if (!operation.resources) {
      if (
        snapshot !== null ||
        operation.execution.providerStart !== "not_started" ||
        operation.execution.externalSend !== "not_issued" ||
        operation.execution.sharedWrite !== "not_issued" ||
        observations.length === 0 ||
        new Set(observations.map((item: { key: string }) => item.key)).size !==
          observations.length ||
        observations.some(
          (item: { observation: string }) =>
            !hasExecutionStateRecordKeys(item, ["key", "observation"]) ||
            item.observation !== "not_requested",
        )
      )
        return null;
      return Buffer.from(currentBytes as Buffer);
    }
    if (
      !snapshot ||
      observations.length !== operation.resources.checkpoints.length
    )
      return null;
    const resources = applyResourceCleanup(
      operation.resources,
      snapshot,
      observations,
      { recoveryId, previousPayloadSha256: current.payloadSha256 },
    );
    if (!resources) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation ? { ...item, resources } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ操作の回収義務と結果受理checkpointを次版へ搬送する。
 *
 * @responsibility 他操作を保持し、exact回復参照と結果Identityを現在集合へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。referencesValue: 回復義務。repositoryBinding: 現在結合。
 * @returns 構造・相関・遷移を確認した次版、またはnull。
 * @precondition 義務と耐久受理根拠は各Ownerが取得する。
 * @postcondition 同じ操作の参照だけを更新し、未確定の削除と受理Hashの巻戻しを拒否する。
 * @effect N/A: 純粋な値変換。搬送・受理・削除は発行しない。
 * @failure 不正入力、他操作参照、既知結果変更と不許可除去はnull。
 * @invariant 受理記録の存在を実受理へ読み替えず、未解決義務を期限で消さない。
 * @boundary 終端・Consumer Ownerと現在状態の参照集合。
 * @security 回復参照を新Authorityや外部への開示許可にしない。
 * @concurrency 元版Hashに結合し、Writerの競合確認を要求する。
 */
export function prepareStateReferencesSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  referencesValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const nonce = parseDockerTaskRecoveryId(recoveryId)?.operationNonce;
    const references = JSON.parse(encodeStateValue(referencesValue));
    if (
      !operation ||
      !nonce ||
      !hasExecutionStateRecordKeys(references, ["recovery"])
    )
      return null;
    const recovery = references.recovery;
    if (
      recovery !== null &&
      (recovery.operationNonce !== nonce || recovery.recoveryId !== recoveryId)
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      unresolvedRecoveries: [
        ...current.snapshot.unresolvedRecoveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...(recovery === null ? [] : [recovery]),
      ].sort((a, b) =>
        a.operationNonce < b.operationNonce
          ? -1
          : a.operationNonce > b.operationNonce
            ? 1
            : 0,
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存済み操作から終了要約の候補内容だけを導出する。
 * @responsibility 相関、一次失敗、最終結果と清掃状態を上書きせず要約へ分離する。
 * @trace ARCH-000008
 * @input currentBytes: 正規Snapshot、recoveryId: exact対象、repositoryBinding: 検証済み結合。
 * @returns 正規要約本文、要約Hashと導出元Hash、またはnull。
 * @precondition 対象は実行中でなく最終結果が保存されている。
 * @postcondition 元Snapshotを変更せず、固定・履歴保存の許可を発行しない。
 * @effect N/A: メモリ内の導出だけ。
 * @failure 不正Snapshot、別対象、未確定結果、確定要約との不一致はnull。
 * @invariant 一次失敗と清掃不明を保持し、返却値を要約固定・保存・操作除去の許可にしない。
 * @boundary 現在状態から非Authorityの終了履歴内容。
 * @security 任意要約、任意Path、外部出力や回復権限を受けない。
 * @concurrency 導出元Hashを返し、物理Writerで元版の再照合を要求する。
 */
export function prepareStateHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Readonly<{
  summaryBytes: Buffer;
  summarySha256: string;
  sourcePayloadSha256: string;
}> | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation || operation.phase === "executing" || !operation.outcome)
      return null;
    const summaryBytes = operationSummaryBytes(operation);
    const summarySha256 = createHash("sha256")
      .update(summaryBytes)
      .digest("hex");
    if (
      operation.summarySha256 !== null &&
      operation.summarySha256 !== summarySha256
    )
      return null;
    return Object.freeze({
      summaryBytes,
      summarySha256,
      sourcePayloadSha256: current.payloadSha256,
    });
  } catch {
    return null;
  }
}

/**
 * 検証済み修復の非Authority要約と導出元Hashを返す。
 * @responsibility Task用要約関数へ修復を渡さない。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文、recoveryId: exact修復、repositoryBinding: 現在結合。
 * @returns 要約bytes・Hashと導出元Hash、またはnull。
 * @precondition 物理Owner・実修復は別に確認する。
 * @postcondition 固定済み要約との不一致を拒否する。
 * @effect N/A: メモリ内導出。
 * @failure 未終端・保持未決・別対象・Hash差はnull。
 * @invariant 要約生成は保存や操作除去の許可ではない。
 * @boundary 現在状態から履歴投影。
 * @security 任意要約やPathを入力に持たない。
 * @concurrency 導出元Hashを物理Writerで再照合する。
 */
export function prepareRepairHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
) {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!current || !operation || !repairCanSummarize(operation)) return null;
  const summaryBytes = repairSummaryBytes(operation);
  const summarySha256 = createHash("sha256").update(summaryBytes).digest("hex");
  if (
    operation.summarySha256 !== null &&
    operation.summarySha256 !== summarySha256
  )
    return null;
  return Object.freeze({
    summaryBytes,
    summarySha256,
    sourcePayloadSha256: current.payloadSha256,
  });
}

/**
 * 修復の初回時刻と両Hashを固定する候補を生成する。
 * @responsibility 未確認から確認済みへの専用遷移だけを作る。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、occurredAt、confirmed、repositoryBinding: 固定元版・対象・時刻・確認値・結合。
 * @returns 次版または同じ確認状態の元版、拒否時null。
 * @precondition 実保存読戻しは専用物理Ownerが確認する。
 * @postcondition 技術値・時刻・Hash・他操作を変更しない。
 * @effect N/A: 値候補生成のみ。
 * @failure 初回true、時刻差、巻戻し、未終端はnull。
 * @invariant true候補は実保存の根拠ではない。
 * @boundary 修復終了と単一状態の履歴相関。
 * @security Task配送や架空資源情報を作らない。
 * @concurrency 元版全文は既存Writer内で再確認する。
 */
export function prepareRepairHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const summary = prepareRepairHistorySummary(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  if (
    !current ||
    !operation ||
    !summary ||
    typeof occurredAt !== "string" ||
    !Number.isFinite(Date.parse(occurredAt)) ||
    new Date(occurredAt).toISOString() !== occurredAt ||
    typeof confirmed !== "boolean" ||
    (operation.retention !== undefined &&
      occurredAt !== operation.retention.decidedAt)
  )
    return null;
  if (operation.history) {
    if (
      operation.history.occurredAt !== occurredAt ||
      (operation.history.confirmed && !confirmed)
    )
      return null;
    if (operation.history.confirmed === confirmed)
      return Buffer.from(`${encodeStateValue(current.snapshot)}\n`);
  } else if (confirmed) return null;
  const history = {
    occurredAt,
    lineSha256: createHash("sha256")
      .update(repairHistoryLineBytes(operation, occurredAt))
      .digest("hex"),
    confirmed,
  };
  const candidate = Buffer.from(
    `${encodeStateValue({
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation
          ? { ...item, summarySha256: summary.summarySha256, history }
          : item,
      ),
    })}\n`,
  );
  return validateStateTransition(currentBytes, candidate, repositoryBinding)
    ? candidate
    : null;
}

/**
 * 修復の固定済み相関から同じ履歴行を導出する。
 * @responsibility 再入場でも初回時刻と行Hashを維持する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文、recoveryId: exact修復、repositoryBinding: 結合。
 * @returns 固定したLF付き行、またはnull。
 * @precondition 初回時刻とHashが現在状態へ保存済み。
 * @postcondition confirmedの前後で同じ行を返す。
 * @effect N/A: メモリ内導出。
 * @failure 未固定・別対象・不正相関はnull。
 * @invariant 行の存在・実保存を主張しない。
 * @boundary 現在状態と履歴Writer。
 * @security 任意本文・時刻を受け付けない。
 * @concurrency 物理照合は既存Writerが行う。
 */
export function prepareRepairHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  return operation?.history
    ? repairHistoryLineBytes(operation, operation.history.occurredAt)
    : null;
}

/**
 * 修復の未確認行と保存途中全文から専用出版候補を再導出する。
 * @responsibility 固定時刻・内容と期間整理を同じ元版へ結合する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、historyBytes、pendingBytes、retentionDays、repositoryBinding: 現在状態・対象・履歴・短命候補・日数・結合。
 * @returns 確認次版とcanonical履歴候補、またはnull。
 * @precondition 実体・Owner・設定と読戻しは専用物理Writerが確認する。
 * @postcondition 同じ行の重複追記・時刻変更を行わない。
 * @effect N/A: 独立Bufferの値導出だけ。
 * @failure 不正行、同ID異内容、重複、pending全文差、設定不正はnull。
 * @invariant 確認済み欠測を新たな出版成功へ変換しない。
 * @boundary 修復の固定履歴相関と共通JSONL保存。
 * @security Task管理資格・任意Pathを合成しない。
 * @concurrency 元版・設定・全文の再照合は既存物理Writerが行う。
 */
export function prepareRepairHistoryPublication(
  currentBytes: unknown,
  recoveryId: unknown,
  historyBytes: unknown,
  pendingBytes: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
) {
  const canonical = copyHistoryBytes(historyBytes);
  const pending = pendingBytes === null ? null : copyHistoryBytes(pendingBytes);
  if (!canonical || (pendingBytes !== null && !pending)) return null;
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!current || !operation?.history || operation.history.confirmed)
    return null;
  const line = prepareRepairHistoryLine(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  const snapshotBytes = prepareRepairHistorySnapshot(
    currentBytes,
    recoveryId,
    operation.history.occurredAt,
    true,
    repositoryBinding,
  );
  const rows = decodeHistoryRows(canonical);
  if (!line || !snapshotBytes || !rows) return null;
  const lineRows = decodeHistoryRows(line);
  const references = projectHistoryRetentionReferences(current.snapshot);
  if (lineRows?.length !== 1 || !lineRows[0] || !references) return null;
  const publication = prepareHistoryPublication({
    canonical,
    pending,
    rows,
    line: lineRows[0],
    recoveryId: operation.recoveryId,
    references,
    occurredAt: operation.history.occurredAt,
    retentionDays,
  });
  if (!publication) return null;
  const candidateHistory = publication.historyBytes;
  return Object.freeze({
    snapshotBytes,
    historyBytes: candidateHistory,
    historyChanged: publication.historyChanged,
  });
}

/**
 * 現在終端の履歴出版候補を固定時刻と全文から再導出する。
 * @responsibility Process内の過去試行情報を復元せず、同じ行・保持設定・pendingを照合する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、historyBytes、pendingBytes、retentionDays、repositoryBinding: 現在状態と固定履歴入力。
 * @returns 確認済みSnapshotと履歴全文の候補、またはnull。
 * @precondition 実終端、Root、File実体、排他と現在設定は保存Ownerが別に確認する。
 * @postcondition 固定時刻・行内容を変えず、同じIDの行を再追加しない。
 * @effect N/A: 純粋な候補導出だけ。保存・削除・処置許可の発行なし。
 * @failure 不正履歴、同ID異内容、重複、pending全文差、設定差による再導出不一致はnull。
 * @invariant JSONやHashの一致を実終端やWriter Authorityへ昇格しない。
 * @boundary 現在終端の固定行と通常履歴の保存途中全文。
 * @security 未知本文を相関情報や履歴へ追加しない。
 * @concurrency 元Snapshotと全履歴・設定を実Writer内でも再照合する。
 */
export function prepareRecoveredHistoryPublication(
  currentBytes: unknown,
  recoveryId: unknown,
  historyBytes: unknown,
  pendingBytes: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
) {
  try {
    const canonical = copyHistoryBytes(historyBytes);
    const pending =
      pendingBytes === null ? null : copyHistoryBytes(pendingBytes);
    if (!canonical || (pendingBytes !== null && !pending)) return null;
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    const operation = current?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!current || !operation?.history || operation.history.confirmed)
      return null;
    const line = prepareStateHistoryLine(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    const snapshotBytes = prepareStateHistorySnapshot(
      currentBytes,
      recoveryId,
      operation.history.occurredAt,
      true,
      repositoryBinding,
    );
    const rows = decodeHistoryRows(canonical);
    if (!line || !snapshotBytes || !rows) return null;
    const lineRows = decodeHistoryRows(line);
    const references = projectHistoryRetentionReferences(current.snapshot);
    if (lineRows?.length !== 1 || !lineRows[0] || !references) return null;
    const publication = prepareHistoryPublication({
      canonical,
      pending,
      rows,
      line: lineRows[0],
      recoveryId: operation.recoveryId,
      references,
      occurredAt: operation.history.occurredAt,
      retentionDays,
    });
    if (!publication) return null;
    const candidateHistory = publication.historyBytes;
    return Object.freeze({
      snapshotBytes: Buffer.from(snapshotBytes),
      historyBytes: Buffer.from(candidateHistory),
      historyChanged: publication.historyChanged,
    });
  } catch {
    return null;
  }
}

/**
 * 履歴の初回固定または保存確認の候補を同じ操作へ結合する。
 * @responsibility 最初の時刻と行Hashを固定し、確認状態の巻戻しを拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: 対象、occurredAt: 固定時刻、confirmed: 保存確認候補、repositoryBinding: 現在結合。
 * @returns 改訂相関を含む候補Snapshot、またはnull。
 * @precondition 実終端と保存読戻しの根拠は物理Writerで別途確認する。
 * @postcondition 他操作・資源・参照を変更しない。
 * @effect N/A: メモリ内の候補生成。
 * @failure 未終端評価、時刻不正、初回true、既存内容差はnull。
 * @invariant 候補生成を実終端・保存・除去の許可にしない。
 * @boundary 終端Ownerと単一Snapshotの短命な履歴相関。
 * @security 一般Writerは実保存根拠なしの履歴変更を拒否する。
 * @concurrency 元版Hashへ結合して物理Writerで再照合する。
 */
export function prepareStateHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (
      !current ||
      typeof recoveryId !== "string" ||
      typeof occurredAt !== "string" ||
      typeof confirmed !== "boolean"
    )
      return null;
    const time = Date.parse(occurredAt);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== occurredAt)
      return null;
    const operation = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      operation.phase === "executing" ||
      !operation.outcome?.cleanupConfirmed ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      !areTaskResourcesSettled(operation)
    )
      return null;
    if (!operation.history && confirmed) return null;
    const summary = prepareStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    if (!summary) return null;
    const history = {
      occurredAt,
      lineSha256: createHash("sha256")
        .update(historyLineBytes(operation, occurredAt))
        .digest("hex"),
      confirmed,
    };
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : { ...item, summarySha256: summary.summarySha256, history },
      ),
    };
    const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
    return validateStateTransition(currentBytes, bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 終端・履歴確認・全搬送受理を満たす一操作だけの終了候補を作る。
 * @responsibility 操作と同じ回復・搬送参照を一改訂で取り除く値契約を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、repositoryBinding: 現在結合。
 * @returns 固定対象だけを除去した次Snapshot、またはnull。
 * @precondition 物理Ownerが実終端と固定利用側に必要な耐久受理根拠を別途照合する。
 * @postcondition 他操作・他参照と元版相関を保持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 実行中、清掃・Lease・履歴未確認、搬送未受理または不正入力はnull。
 * @invariant 候補を実終端・受理・除去Authorityへ昇格せず、一般更新の除去拒否を維持する。
 * @boundary 現在操作の閉集合と通常履歴。
 * @security unknown Createや不明Effectを成功へ丸めない。
 * @concurrency 元版と真正根拠の同時照合は物理Writerの責務。
 */
export function prepareStateCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (value): value is ExecutionOperationRecord =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  if (
    !current ||
    !operation ||
    current.snapshot.managedExecutions.some((p) =>
      p.tasks.some(
        (t) =>
          t.settlement.kind === "operations" &&
          t.settlement.recoveryIds.includes(String(recoveryId)),
      ),
    ) ||
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    operation.host.cleanup !== "confirmed" ||
    operation.host.pendingTransitionJson !== null ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.history?.confirmed !== true ||
    !prepareStateHistorySummary(currentBytes, recoveryId, repositoryBinding) ||
    !areTaskResourcesSettled(operation)
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
  return decodeStateSnapshot(bytes, repositoryBinding) ? bytes : null;
}

/**
 * 修復専用の終端条件を満たした対象だけの除去候補を作る。
 * @responsibility 共通終端検査を再利用し、Taskの受領条件で修復を代用しない。
 * @trace ARCH-000008
 * @input currentBytes: 元本文、recoveryId: exact対象、repositoryBinding: 現在結合。
 * @returns 対象だけを除去した次本文、又はnull。
 * @precondition 物理Writerが実処置と履歴出版を別途確認する。
 * @postcondition 他操作と版相関を保全する。
 * @effect N/A: 値候補の生成だけ。
 * @failure 未確定処置、未解決保持、履歴未確認、別対象はnull。
 * @invariant 値の一致から実削除や保存成功を推定しない。
 * @boundary 現在状態の修復variant。
 * @security 保存候補は回復Authorityではない。
 * @concurrency 元版と実排他の照合はWriterが所有する。
 */
export function prepareStateRepairCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (item): item is RepairOperationRecord =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (
    !current ||
    !operation ||
    !repairCanComplete(operation, current.snapshot) ||
    !prepareRepairHistorySummary(currentBytes, recoveryId, repositoryBinding)
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (item) => item.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeStateValue(next)}\n`);
  return decodeStateSnapshot(bytes, repositoryBinding) ? bytes : null;
}

/**
 * 同じRepositoryの現在状態更新で既知事実を保全する。
 * @responsibility exact元本文、固定Identity、確定資源と一次結果の保持を検査する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文または初回のnull、nextBytes: 次本文、repositoryBinding: 現在結合。
 * @returns 許可された内容遷移だけtrue。
 * @precondition 物理Ownerが元Fileの観測と初回Root条件を確認する。
 * @postcondition 不変情報と未終了集合の暗黙除去を拒否する。
 * @effect N/A: メモリ内の比較のみ。
 * @failure 復号・改訂・遷移不一致はfalse。
 * @invariant unknownを既知事実の消去や再実行許可へ用いない。
 * @boundary 保存候補の構造と実処置前の検証。
 * @security trueは資源終端・Authority・保存確定の証明ではない。
 * @concurrency N/A: 排他とfresh観測は物理Writerの責務。
 */
export function validateStateTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  return validateStateTransitionValue(
    currentBytes,
    nextBytes,
    repositoryBinding,
    null,
  );
}

/**
 * 中断した単一資源の作成Receipt保存を完全本文から再導出する。
 * @responsibility exact対象・一資源差分と既出版同本文を区別する。
 * @trace ARCH-000008
 * @input currentBytes、pendingBytes: 正規本文、recoveryId: exact参照、repositoryBinding: 現在Repository結合。
 * @returns publish_pending／remove_pending、または拒否のnull。
 * @precondition 呼出し側が実体、旧Owner失効と排他を別途確認する。
 * @postcondition 他操作・状態・Authorityを変える候補を受理しない。
 * @effect N/A: メモリ内の復号・完全再導出だけ。
 * @failure 不正本文、対象差、資源差分複数、版・前版Hash不整合はnull。
 * @invariant ID受領記録を実資源の現在存在・回収証明へ昇格しない。
 * @boundary 保存候補の意味検査。物理出版と実資源処置は別Owner。
 * @security 保存本文から処置Authorityを生成しない。
 * @concurrency N/A: 物理的な元版一致と排他は保存Ownerが担当する。
 */
export function classifyResourcePublication(
  currentBytes: unknown,
  pendingBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): "publish_pending" | "remove_pending" | null {
  try {
    if (!Buffer.isBuffer(currentBytes) || !Buffer.isBuffer(pendingBytes))
      return null;
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    const pending = decodeStateSnapshot(pendingBytes, repositoryBinding);
    if (
      !current ||
      !pending ||
      !currentBytes.equals(
        Buffer.from(`${encodeStateValue(current.snapshot)}\n`),
      ) ||
      !pendingBytes.equals(
        Buffer.from(`${encodeStateValue(pending.snapshot)}\n`),
      )
    )
      return null;
    const prior = current.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const next = pending.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!prior || !next || prior.identityJson !== next.identityJson)
      return null;
    if (currentBytes.equals(pendingBytes)) return "remove_pending";
    if (!prior.resources || !next.resources) return null;
    const changed = next.resources.checkpoints.filter(
      (resource) =>
        encodeStateValue(resource) !==
        encodeStateValue(
          prior.resources?.checkpoints.find(
            (item) => item.key === resource.key,
          ),
        ),
    );
    const resource = changed[0];
    const previous = prior.resources.checkpoints.find(
      (item) => item.key === resource?.key,
    );
    if (
      changed.length !== 1 ||
      !resource ||
      previous?.submission !== "intent_saved" ||
      resource.submission !== "intent_saved" ||
      resource.receiptSource !== "docker_create_result" ||
      next.resources.snapshot.resources.find(
        (item) => item.key === resource.key,
      )?.identity.dockerId == null
    )
      return null;
    const derived = prepareStateResourceSnapshot(
      currentBytes,
      recoveryId,
      {
        event: "receipt",
        key: resource.key,
        snapshot: next.resources.snapshot,
        cleanup: next.resources.cleanup,
      },
      repositoryBinding,
    );
    return derived?.equals(pendingBytes) ? "publish_pending" : null;
  } catch {
    return null;
  }
}

/**
 * 通常更新と用途限定の修復再入場を共通の全状態検査へ通す。
 * @responsibility 再入場対象だけ専用技術遷移を使い、他の保全条件を維持する。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、repositoryBinding: 結合、repairSessionId: 専用対象またはnull。
 * @returns 全状態と遷移が共同成立する場合だけtrue。
 * @precondition 専用呼出し側が再導出した完全候補を照合する。
 * @postcondition 通常入口ではcleanup巻戻しを許可しない。
 * @effect N/A: メモリ内の値検査だけ。
 * @failure 不正値・別対象・不正遷移はfalse。
 * @invariant Task、他修復、一次失敗と確定結果を保全する。
 * @boundary 保存値の検査。実Native取得や保存とは別。
 * @security trueを実処置Authorityへ昇格しない。
 * @concurrency N/A: 物理排他はWriterが所有。
 */
function validateStateTransitionValue(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
  repairSessionId: string | null,
): boolean {
  try {
    const next = decodeStateSnapshot(nextBytes, repositoryBinding);
    const current =
      currentBytes === null
        ? null
        : decodeStateSnapshot(currentBytes, repositoryBinding);
    if (!next || (currentBytes !== null && !current)) return false;
    if (current) {
      const expectedProjects = associateTaskOperations(
        current.snapshot,
        next.snapshot.operations,
      );
      const businessKeys = [
        "repositoryBindingId",
        "intakeEpoch",
        "intakeBindings",
        "queueEntries",
        "workspaces",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "decisions",
        "blockers",
      ] as const;
      if (
        businessKeys.some(
          (key) =>
            encodeStateValue(current.snapshot[key]) !==
            encodeStateValue(next.snapshot[key]),
        ) ||
        encodeStateValue(expectedProjects) !==
          encodeStateValue(next.snapshot.managedExecutions) ||
        encodeStateValue(current.snapshot.projects) !==
          encodeStateValue(next.snapshot.projects)
      )
        return false;
    } else if (
      next.snapshot.repositoryBindingId !== null ||
      next.snapshot.projects.length !== 0 ||
      next.snapshot.managedExecutions.length !== 0
    )
      return false;
    if (!current) {
      if (next.snapshot.revision !== 1 || next.snapshot.previous !== null)
        return false;
    } else if (
      next.snapshot.revision !== current.snapshot.revision + 1 ||
      next.snapshot.previous?.revision !== current.snapshot.revision ||
      next.snapshot.previous.payloadSha256 !== current.payloadSha256
    )
      return false;
    return validateOperationTransitions(current, next, repairSessionId);
  } catch {
    return false;
  }
}

const EMPTY_EXECUTION_TASK_SECTIONS = {
  repositoryBindingId: null,
  intakeEpoch: null,
  intakeBindings: [],
  projects: [],
  managedExecutions: [],
  queueEntries: [],
  workspaces: [],
  leaseEvidence: [],
  leaseIntents: [],
  results: [],
  historyPending: [],
  decisions: [],
  blockers: [],
} as const;

/**
 * 単一保存の改訂、受領不変性と操作除去の同更新を検査する。
 * @responsibility 部分ACK、旧受領の付替え、参照だけ残る操作除去を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input currentBytes: 現在本文又は初回null、nextBytes: 次本文、repositoryBinding: 物理結合。
 * @returns 共通保存遷移の必要条件が成立する場合だけtrue。
 * @precondition 操作固有の許可、実資源、Task業務遷移は別途既存Ownerが検証する。
 * @postcondition 初回受領世代と固定本文を維持し、除去と参照置換を一候補で照合する。
 * @effect N/A: メモリ内の比較だけ。
 * @failure 改訂不一致、受領差替え、履歴・終端未確認、部分更新はfalse。
 * @invariant 本検査だけで任意の業務・技術更新を許可しない。
 * @boundary 単一Writerの共通CAS候補。Writerへの本番接続は別処置。
 * @security 保存値から実資源不存在やAuthority失効を推定しない。
 * @concurrency 実排他・fresh読取り・保存確定は既存Writerが所有する。
 */
export function validateUnifiedTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  try {
    const next = decodeStateSnapshot(nextBytes, repositoryBinding);
    if (!next) return false;
    if (currentBytes === null)
      return (
        next.snapshot.revision === 1 &&
        next.snapshot.previous === null &&
        next.snapshot.decisions.length === 0 &&
        next.snapshot.blockers.length === 0 &&
        !next.snapshot.managedExecutions.some((p) =>
          p.tasks.some((t) =>
            t.recoveryObligations.some(
              (o) => o.kind === "docker" && o.phase === "settled",
            ),
          ),
        )
      );
    const current = decodeStateSnapshot(currentBytes, repositoryBinding);
    if (
      !current ||
      next.snapshot.revision !== current.snapshot.revision + 1 ||
      next.snapshot.previous?.revision !== current.snapshot.revision ||
      next.snapshot.previous.payloadSha256 !== current.payloadSha256 ||
      (current.snapshot.repositoryBindingId !== null &&
        next.snapshot.repositoryBindingId !==
          current.snapshot.repositoryBindingId)
    )
      return false;
    for (const project of next.snapshot.managedExecutions)
      for (const task of project.tasks) {
        const prior = current.snapshot.managedExecutions
          .find((p) => p.projectId === project.projectId)
          ?.tasks.find((t) => t.taskId === task.taskId);
        for (const obligation of task.recoveryObligations) {
          if (
            obligation.kind !== "docker" ||
            obligation.phase !== "settled" ||
            next.snapshot.operations.some(
              (o) => o.recoveryId === obligation.recoveryId,
            )
          )
            continue;
          if (!prior) return false;
          if (
            prior.recoveryObligations.some(
              (o) =>
                o.kind === "docker" &&
                o.recoveryId === obligation.recoveryId &&
                o.phase === "settled",
            )
          ) {
            if (
              prior.attemptId === task.attemptId &&
              prior.operationId === task.operationId
            )
              continue;
            const beforeTask = current.projects
              .find((p) => p.projectId === project.projectId)
              ?.tasks.find((t) => t.definition.id === task.taskId);
            const retry =
              prior.state === "recovery_required" &&
              task.state === "ready" &&
              task.attemptId === null &&
              task.operationId === null &&
              task.authorityBindingId === null &&
              task.startPhase === "none" &&
              task.candidateId === null &&
              task.retryCount === prior.retryCount + 1 &&
              beforeTask?.cleanupConfirmed === true &&
              !beforeTask.recoveryUnresolved &&
              prior.recoveryObligations.every((o) => o.phase === "settled") &&
              encodeStateValue(prior.recoveryObligations) ===
                encodeStateValue(task.recoveryObligations);
            if (!retry) return false;
            continue;
          }
          if (
            prior.attemptId !== task.attemptId ||
            prior.operationId !== task.operationId
          )
            return false;
          if (
            prior.settlement.kind !== "operations" ||
            !prior.settlement.recoveryIds.includes(obligation.recoveryId)
          )
            return false;
          const terminal = projectTaskSettlement(
            {
              kind: "operations",
              recoveryIds: [obligation.recoveryId],
              resultUnresolved: false,
            },
            current.snapshot,
          );
          const operation = current.snapshot.operations.find(
            (o) => o.recoveryId === obligation.recoveryId,
          );
          if (
            !terminal?.cleanupConfirmed ||
            !operation?.history?.confirmed ||
            current.snapshot.unresolvedRecoveries.some(
              (r) => r.recoveryId === obligation.recoveryId,
            )
          )
            return false;
        }
      }
    const beforeDecisions = { ...current.snapshot, projects: current.projects };
    const afterDecisions = { ...next.snapshot, projects: next.projects };
    if (
      !validateDecisionSnapshotTransition(beforeDecisions, afterDecisions) &&
      !validateDecisionRetirement(beforeDecisions, afterDecisions)
    )
      return false;
    // 新規実行の保存点だけを止める。結果受領・取消・回復・解放の保存は止めない。
    for (const queue of next.snapshot.queueEntries) {
      const previous = current.snapshot.queueEntries.find(
        (item) => item.queueId === queue.queueId,
      );
      // 正式回復の完了記録は開始許可ではない。対象外fieldも元値のままに限る。
      const recoverySettlement =
        previous?.state === "recovery_required" &&
        previous.ownerGeneration === null &&
        previous.resumeCondition === "exact_recovery" &&
        previous.resultReference !== null &&
        encodeStateValue(queue) ===
          encodeStateValue({
            ...previous,
            state: "queued",
            generation: previous.generation + 1,
            resumeCondition: "exact_recovery_settled",
          });
      if (
        previous?.state !== queue.state &&
        ["queued", "leased", "running"].includes(queue.state) &&
        !recoverySettlement &&
        current.snapshot.blockers.some(
          (blocker) =>
            blocker.status === "active" &&
            blocker.target.projectId === queue.projectId &&
            blocker.target.milestoneId === queue.milestoneId,
        )
      )
        return false;
    }
    for (const project of next.projects) {
      const previous = current.projects.find(
        (item) => item.projectId === project.projectId,
      );
      for (const task of project.tasks) {
        if (!["reserved", "handoff_prepared"].includes(task.startPhase))
          continue;
        const old = previous?.tasks.find(
          (item) => item.definition.id === task.definition.id,
        );
        if (
          old?.startPhase === task.startPhase &&
          old.attemptId === task.attemptId &&
          old.operationId === task.operationId
        )
          continue;
        if (
          current.snapshot.blockers.some(
            (blocker) =>
              blocker.status === "active" &&
              blocker.target.projectId === project.projectId &&
              blocker.target.milestoneId === project.milestoneId &&
              (blocker.target.kind === "milestone" ||
                (blocker.target.kind === "objective" &&
                  blocker.target.id === task.definition.objectiveId) ||
                (blocker.target.kind === "task" &&
                  blocker.target.id === task.definition.id)),
          )
        )
          return false;
      }
    }
    return validateSettlementTransition(
      current,
      next,
      currentBytes,
      repositoryBinding,
    );
  } catch {
    return false;
  }
}

/**
 * 復号済みのTask受領と技術操作の同時遷移を照合する。
 * @responsibility 受領本文・固定選定・終端操作とTask投影の相関を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current／next: 検査済み値とTask投影、currentBytes／repositoryBinding: 同じ元本文と保存結合。
 * @returns 既存の区画間遷移条件が全て成立した場合だけtrue。
 * @precondition codec・保存改訂・元HashはStorageが先に照合する。
 * @postcondition 受領を捏造せず、対象外の固定値を保全する。
 * @effect N/A: 復号済み値の同期検査だけ。
 * @failure 不整合・解釈不能ではfalse。
 * @invariant Taskの受領と技術操作の終了を別保存へ分離しない。
 * @boundary 単一Writerの物理CASと区画間の意味判断。
 * @security 既知の値だけで実資源不存在を証明しない。
 * @concurrency 同じfresh元版と候補へ適用する。
 */
function validateSettlementTransition(
  current: NonNullable<ReturnType<typeof decodeStateSnapshot>>,
  next: NonNullable<ReturnType<typeof decodeStateSnapshot>>,
  currentBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  try {
    for (const old of current.snapshot.managedExecutions) {
      const replacement = next.snapshot.managedExecutions.find(
        (project) => project.projectId === old.projectId,
      );
      if (
        replacement &&
        replacement.milestoneId === old.milestoneId &&
        encodeStateValue(replacement.taskExecutionSelections) !==
          encodeStateValue(old.taskExecutionSelections)
      )
        return false;
    }
    for (const operation of current.snapshot.operations) {
      if (
        next.snapshot.operations.some(
          (entry) => entry.recoveryId === operation.recoveryId,
        )
      )
        continue;
      if (operation.kind === "runtime_repair") {
        if (!repairCanComplete(operation, current.snapshot)) return false;
        continue;
      }
      if (
        operation.phase === "executing" ||
        operation.history?.confirmed !== true ||
        !prepareStateHistoryLine(
          currentBytes,
          operation.recoveryId,
          repositoryBinding,
        ) ||
        projectTaskSettlement(
          {
            kind: "operations",
            recoveryIds: [operation.recoveryId],
            resultUnresolved: false,
          },
          current.snapshot,
        )?.cleanupConfirmed !== true ||
        current.snapshot.unresolvedRecoveries.some(
          (recovery) => recovery.recoveryId === operation.recoveryId,
        ) ||
        next.snapshot.unresolvedRecoveries.some(
          (recovery) => recovery.recoveryId === operation.recoveryId,
        )
      )
        return false;
      for (const project of current.snapshot.managedExecutions)
        for (const task of project.tasks) {
          if (
            task.settlement.kind !== "operations" ||
            !task.settlement.recoveryIds.includes(operation.recoveryId)
          )
            continue;
          const replacement = next.snapshot.managedExecutions
            .find((entry) => entry.projectId === project.projectId)
            ?.tasks.find((entry) => entry.taskId === task.taskId);
          if (
            !replacement ||
            replacement.attemptId !== task.attemptId ||
            replacement.operationId !== task.operationId ||
            (replacement.settlement.kind !== "executor_result" &&
              (task.state !== "recovery_required" ||
                replacement.state !== "recovery_required" ||
                replacement.settlement.kind !== "operations" ||
                replacement.settlement.recoveryIds.includes(
                  operation.recoveryId,
                )))
          )
            return false;
          const before = projectTaskSettlement(
            task.settlement,
            current.snapshot,
          );
          const after = projectTaskSettlement(
            replacement.settlement,
            next.snapshot,
          );
          if (
            !before ||
            !after ||
            encodeStateValue(before) !== encodeStateValue(after)
          )
            return false;
        }
    }
    return true;
  } catch {
    return false;
  }
}

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
export function assertSnapshotTransition(
  current: Snapshot | null,
  payload: Snapshot,
  owner: SnapshotObservations,
): void {
  if (
    !current &&
    (payload.decisions.length !== 0 || payload.blockers.length !== 0)
  )
    throw new Error("decision_initial_state_not_empty");
  if (current && !validateDecisionSnapshotTransition(current, payload)) {
    if (!validateDecisionRetirement(current, payload))
      throw new Error("decision_snapshot_transition_invalid");
    for (const record of current.decisions) {
      if (
        !payload.decisions.some(
          (item) => item.decisionId === record.decisionId,
        ) &&
        owner.decisionHistorySettlement(record) !== "recorded"
      )
        throw new Error("decision_history_retirement_unconfirmed");
    }
  }
  if (payload.snapshotRevision !== (current?.snapshotRevision ?? 0) + 1)
    throw new Error("snapshot_revision_conflict");
  for (const intent of payload.leaseIntents) {
    if (intent.phase !== "acquisition_reserved") continue;
    if (
      current?.leaseIntents.some(
        (item) => encodeStateValue(item) === encodeStateValue(intent),
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
        !queueIsClosed(current, queueId, owner) ||
        !row ||
        owner.historySettlement(row) === null
      )
        throw new Error("snapshot_retirement_unconfirmed");
    }
    if (retired.size > 0 !== (payload.intakeEpoch !== current.intakeEpoch))
      throw new Error("snapshot_intake_epoch_transition_invalid");
    for (const collection of ["results", "leaseEvidence"] as const) {
      for (const old of current[collection])
        if (
          !payload[collection].some(
            (item) => encodeStateValue(item) === encodeStateValue(old),
          )
        )
          if (
            collection === "results"
              ? (!current.queueEntries.some(
                  (queue) =>
                    retired.has(queue.queueId) &&
                    queue.queueId === (old as ResultRecord).queueId &&
                    queue.projectId === old.projectId &&
                    queue.milestoneId === (old as ResultRecord).milestoneId,
                ) &&
                  !current.historyPending.some(
                    (row) =>
                      row.id === (old as ResultRecord).identity &&
                      standaloneAdoptionIsClosed(current, row.id, owner) &&
                      owner.historySettlement(row) !== null,
                  )) ||
                currentEvidenceIds.has((old as ResultRecord).identity) ||
                payload.queueEntries.some(
                  (item) =>
                    item.resultReference === (old as ResultRecord).identity,
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
                !rejectedAdoptionEvidenceCanRetire(
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
                            !adoptionWasRejected(record) &&
                            standaloneAdoptionIsClosed(current, row.id, owner),
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
          (item) => encodeStateValue(item) === encodeStateValue(old),
        ) &&
        owner.historySettlement(old) === null
      )
        throw new Error("snapshot_history_transfer_unconfirmed");
    }
    for (const old of current.leaseIntents) {
      if (
        payload.leaseIntents.some(
          (item) => encodeStateValue(item) === encodeStateValue(old),
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
              encodeStateValue(
                old.singleTask?.[key as keyof SingleTaskRecord],
              ) !==
              encodeStateValue(
                next.singleTask?.[key as keyof SingleTaskRecord],
              ),
          ) ||
          (old.singleTask.adviceOperation !== undefined &&
            encodeStateValue(old.singleTask.adviceOperation) !==
              encodeStateValue(next.singleTask.adviceOperation)) ||
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
        encodeStateValue(old.singleTask) !== encodeStateValue(next.singleTask)
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
        (encodeStateValue(next) !== encodeStateValue(old) &&
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
        encodeStateValue(next.taskExecutionSelections) !==
          encodeStateValue(old.taskExecutionSelections)
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
        (encodeStateValue(next) !== encodeStateValue(old) &&
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
export function queueIsClosed(
  current: Snapshot,
  queueId: string,
  owner: SnapshotObservations,
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
      current.blockers.some(
        (item) =>
          item.target.projectId === queue.projectId &&
          item.target.milestoneId === queue.milestoneId &&
          item.status === "active",
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
        !isStateObject(receipt.value) ||
        !isStateObject(candidate.value) ||
        receipt.value.status !== "completed" ||
        receipt.value.cleanupConfirmed !== true ||
        receipt.value.beforeRevision !== candidate.value.baseRevision ||
        !Array.isArray(receipt.value.changedPaths) ||
        !Array.isArray(candidate.value.changedPaths) ||
        encodeStateValue([...receipt.value.changedPaths].sort()) !==
          encodeStateValue([...candidate.value.changedPaths].sort())
      )
        return false;
    }
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
export function adoptionWasRejected(record: ResultRecord): boolean {
  return (
    record.kind === "adoption" &&
    isStateObject(record.value) &&
    hasStateKeys(record.value, [
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
export function rejectedAdoptionEvidenceCanRetire(
  current: Snapshot,
  payload: Snapshot,
  evidence: LeaseEvidenceEnvelope,
  owner: SnapshotObservations,
): boolean {
  if (evidence.content.kind !== "canonical-adoption") return false;
  const record = current.results.find(
    (item) =>
      item.projectId === evidence.projectId &&
      item.identity === evidence.content.ownerGeneration &&
      adoptionWasRejected(item),
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
      standaloneAdoptionIsClosed(current, record.identity, owner) &&
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
export function standaloneAdoptionIsClosed(
  current: Snapshot,
  identity: string,
  owner: SnapshotObservations,
): boolean {
  try {
    if (current.schema !== owner.schema) return false;
    const record = current.results.find(
      (item) => item.identity === identity && item.kind === "adoption",
    );
    const isRejected = record !== undefined && adoptionWasRejected(record);
    if (
      !record ||
      !isStateObject(record.value) ||
      (!isRejected &&
        (!hasStateKeys(record.value, [
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
            !adoptionWasRejected(other),
        )) ||
      current.blockers.some(
        (item) =>
          item.target.projectId === record.projectId &&
          (record.milestoneId === null ||
            item.target.milestoneId === record.milestoneId) &&
          item.status === "active",
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
export function snapshotIntakeMatches(
  current: Snapshot,
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
    !isSha256Hex(intake.requestHash) ||
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
 * 保存済みcheckpointから同じ終了履歴行を導出する。
 * @responsibility 要約・初回時刻とexact行Hashの共通符号化を履歴Writerへ渡す。
 * @trace ARCH-000008
 * @input currentBytes: 現在状態、recoveryId: 対象、repositoryBinding: 検証済み結合。
 * @returns 正規UTF-8行と末尾LF、またはnull。
 * @precondition 対象の要約と初回時刻がcheckpointへ固定済みである。
 * @postcondition 確認状態を行へ含めず、初回と確認済みで同じ本文を返す。
 * @effect N/A: メモリ内の検証と符号化だけ。
 * @failure 未固定、別対象、不正状態や行Hash不一致はnull。
 * @invariant 行の導出を物理保存、終端確認、削除許可にしない。
 * @boundary 現在状態の固定相関と履歴保存の値境界。
 * @security 任意の履歴本文、Path、秘密値を受けない。
 * @concurrency 保存と元版の再照合は物理Writerが所有する。
 */
export function prepareStateHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (value): value is ExecutionOperationRecord =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  if (!operation?.history) return null;
  const bytes = historyLineBytes(operation, operation.history.occurredAt);
  return createHash("sha256").update(bytes).digest("hex") ===
    operation.history.lineSha256
    ? bytes
    : null;
}

/**
 * 対象IDを含む計画定義だけの内容Hashを導出する。
 * @responsibility 判断状態・管理実行値を定義同一性から分離する。
 * @trace ARCH-000004
 * @input project: 検査済みCore Project。
 * @returns 対象と正規化定義へ結合したSHA-256。
 * @precondition 呼出し側がCore定義の値検査を完了している。
 * @postcondition 判断・Ownerの変化だけでは定義Hashを変更しない。
 * @effect N/A: 値のHash計算だけ。
 * @failure 通常データでない値は共通encoderが拒否する。
 * @invariant 対象IDを除いた本文だけのHashへ置換しない。
 * @boundary 同じSnapshot内の定義と管理実行参照。
 * @security Hashを操作許可として使用しない。
 * @concurrency N/A: 共有状態なし。
 */
export function hashExecutionProjectDefinition(
  project: ProjectDefinition,
): string {
  return hashExecutionStateContent({
    projectId: project.projectId,
    milestoneId: project.milestoneId,
    definition: {
      milestoneAcceptanceCriteria: project.milestone.acceptanceCriteria,
      objectives: project.objectives.map((objective) => objective.definition),
      tasks: project.tasks,
    },
  });
}

/**
 * Core定義と管理実行参照を分離した新形式だけを復号する。
 * @responsibility 完全な区画検査・単一定義・管理行の一対一参照と既存の終端相関を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input input: 正規byte列、repositoryBinding: 対象Repository結合。
 * @returns 正本、管理実行のメモリ投影、本文Hash。拒否時null。
 * @precondition N/A: 未信頼byte列を拒否可能。
 * @postcondition Coreのみの対象に架空のOwner・Selection・Taskを生成しない。
 * @effect N/A: 値検査・メモリ投影だけ。
 * @failure 旧Schema、欠測、重複、孤立、定義Hash差、技術相関差はnull。
 * @invariant 管理投影は保存正本ではなく、Task定義はprojectsだけに保存する。
 * @boundary 新Schemaのcodec。保存先切替・Writer確定とは別。
 * @security unknown・元参照を保ち、現在Authorityを復元しない。
 * @concurrency N/A: 同期の値検査。
 */
export function decodeStateSnapshot(
  input: unknown,
  repositoryBinding: unknown,
): Readonly<{
  snapshot: ExecutionStateSnapshot;
  projects: readonly ProjectExecutionState[];
  payloadSha256: string;
}> | null {
  try {
    if (!isSha256Hex(repositoryBinding)) return null;
    const decoded = decodeExecutionStateBytes(input);
    const value = decoded?.value;
    if (
      !decoded ||
      !hasExecutionStateRecordKeys(value, [
        "schema",
        "revision",
        "previous",
        "repositoryBinding",
        "operations",
        "unresolvedRecoveries",
        "repositoryBindingId",
        "intakeEpoch",
        "intakeBindings",
        "projects",
        "managedExecutions",
        "queueEntries",
        "workspaces",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "decisions",
        "blockers",
      ])
    )
      return null;
    const snapshot = value as ExecutionStateSnapshot;
    if (
      snapshot.schema !== "crdd-execution-model/state/v4" ||
      snapshot.repositoryBinding !== repositoryBinding ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 1 ||
      (snapshot.revision === 1
        ? snapshot.previous !== null
        : !hasExecutionStateRecordKeys(snapshot.previous, [
            "revision",
            "payloadSha256",
          ]) ||
          snapshot.previous?.revision !== snapshot.revision - 1 ||
          !isSha256Hex(snapshot.previous?.payloadSha256)) ||
      !validExecutionState(snapshot, repositoryBinding) ||
      !Array.isArray(snapshot.projects) ||
      !Array.isArray(snapshot.managedExecutions)
    )
      return null;
    const definitions: ProjectDefinition[] = [];
    for (const raw of snapshot.projects) {
      const definition = inspectExecutionProjectDefinition(raw);
      if (
        !definition ||
        definitions.some((item) => item.projectId === definition.projectId)
      )
        return null;
      definitions.push(definition);
    }
    if (
      snapshot.repositoryBindingId === null &&
      (definitions.length > 0 || snapshot.managedExecutions.length > 0)
    )
      return null;
    const projects: ExecutionStoredManagedProject[] = [];
    const seen = new Set<string>();
    for (const execution of snapshot.managedExecutions) {
      if (
        !hasExecutionStateRecordKeys(execution, [
          "projectId",
          "milestoneId",
          "definitionHash",
          "taskExecutionSelections",
          "ownerGeneration",
          "maximumConcurrency",
          "tasks",
        ]) ||
        seen.has(execution.projectId) ||
        !Array.isArray(execution.tasks)
      )
        return null;
      const definition = definitions.find(
        (item) =>
          item.projectId === execution.projectId &&
          item.milestoneId === execution.milestoneId,
      );
      if (
        !definition ||
        !inspectCompletePlanDefinition({
          milestoneAcceptanceCriteria: definition.milestone.acceptanceCriteria,
          objectives: definition.objectives.map(
            (objective) => objective.definition,
          ),
          tasks: definition.tasks,
        }) ||
        execution.definitionHash !==
          hashExecutionProjectDefinition(definition) ||
        execution.tasks.length !== definition.tasks.length
      )
        return null;
      const taskIds = new Set<string>();
      const tasks: StoredTask[] = [];
      for (const task of execution.tasks) {
        if (
          !hasExecutionStateRecordKeys(task, [
            "taskId",
            "state",
            "attemptId",
            "operationId",
            "authorityBindingId",
            "startPhase",
            "settlement",
            "recoveryObligations",
            "candidateId",
            "retryCount",
            "supersededBy",
          ]) ||
          taskIds.has(task.taskId)
        )
          return null;
        const taskDefinition = definition.tasks.find(
          (item) => item.id === task.taskId,
        );
        if (!taskDefinition) return null;
        if (definition.tasks[tasks.length]?.id !== task.taskId) return null;
        taskIds.add(task.taskId);
        const { taskId: _taskId, ...record } = task;
        tasks.push(Object.freeze({ ...record, definition: taskDefinition }));
      }
      seen.add(execution.projectId);
      const { contract: _contract, tasks: _definitions, ...core } = definition;
      projects.push(
        Object.freeze({
          ...core,
          contract: "crdd-execution-model/project-state/v3",
          taskExecutionSelections: execution.taskExecutionSelections,
          ownerGeneration: execution.ownerGeneration,
          maximumConcurrency: execution.maximumConcurrency,
          tasks: Object.freeze(tasks),
        }),
      );
    }
    const projection = projectExecutionSnapshotSections(
      snapshot,
      Object.freeze(projects),
      decoded.payloadSha256,
      definitions,
    );
    return projection
      ? Object.freeze({
          snapshot,
          projects: projection.projects,
          payloadSha256: decoded.payloadSha256,
        })
      : null;
  } catch {
    return null;
  }
}

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
export function projectTaskSettlement(
  input: unknown,
  snapshot: Pick<ExecutionStateSnapshot, "operations" | "unresolvedRecoveries">,
): Readonly<{ cleanupConfirmed: boolean; recoveryUnresolved: boolean }> | null {
  try {
    const fact: unknown = JSON.parse(encodeStateValue(input));
    if (!isStateObject(fact) || types.isProxy(fact)) return null;
    if (fact.kind === "pending" || fact.kind === "unissued") {
      if (!hasStateKeys(fact, ["kind"])) return null;
      return Object.freeze({
        cleanupConfirmed: fact.kind === "unissued",
        recoveryUnresolved: false,
      });
    }
    if (fact.kind === "executor_result") {
      if (
        !hasStateKeys(fact, [
          "kind",
          "cleanupConfirmed",
          "recoveryUnresolved",
        ]) ||
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
      !hasStateKeys(fact, ["kind", "recoveryIds", "resultUnresolved"]) ||
      typeof fact.resultUnresolved !== "boolean" ||
      !Array.isArray(fact.recoveryIds) ||
      fact.recoveryIds.length === 0 ||
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
            areTaskResourcesSettled(operation),
        ),
      recoveryUnresolved: fact.resultUnresolved,
    });
  } catch {
    return null;
  }
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
export function validTaskState(
  snapshot: Omit<
    Snapshot,
    "schema" | "schemaRevision" | "repositoryRootHash" | "snapshotRevision"
  >,
  binding: string,
): boolean {
  if (!Array.isArray(snapshot.projects) || !snapshot.projects.every(validState))
    return false;
  return validExecutionTaskReferences(snapshot, binding);
}

/**
 * 定義の存在と受付・判断・Lease等の共通参照を同じSnapshotで検査する。
 * @responsibility CoreのみのProjectも正本の対象集合へ含め、技術状態を補完しない。
 * @trace ARCH-000004、ARCH-000008
 * @input snapshot: 個別モデルの検査後の共通区画、binding: Repository結合。
 * @returns 参照相関をすべて満たす場合true。
 * @precondition 区画は正規JSONの復号結果であり、Project値は呼出し側が検査済み。
 * @postcondition 定義対象の不存在と不正な参照を区別せず成功へ補完しない。
 * @effect N/A: 値検査だけ。
 * @failure 不正・重複・孤立参照はfalse。
 * @invariant Projectの値検査は呼出し側のCore／管理実行Ownerが行う。
 * @boundary 定義と管理実行の共通保存内参照。
 * @security 記録を現在の権限や実資源不存在の証拠にしない。
 * @concurrency N/A: 同期の局所処理。
 */
function validExecutionTaskReferences(
  snapshot: Omit<
    Snapshot,
    | "schema"
    | "schemaRevision"
    | "repositoryRootHash"
    | "snapshotRevision"
    | "projects"
  > &
    Readonly<{ projects: readonly Readonly<{ projectId: string }>[] }>,
  binding: string,
): boolean {
  if (
    !validateDecisionCollections(
      snapshot.decisions,
      snapshot.blockers,
      snapshot.projects.map((project) => project.projectId),
    )
  )
    return false;
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
  if (!(snapshot.queueEntries as unknown[]).every(validQueueEntry))
    return false;
  if (
    !Array.isArray(snapshot.workspaces) ||
    !snapshot.workspaces.every(validWorkspace) ||
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
      !isStateObject(item) ||
      !hasStateKeys(item, ["queueId", "epoch"]) ||
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
      !isStateObject(record) ||
      !hasStateKeys(record, [
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
      record.schema !== STORAGE_CONTRACT ||
      record.schemaRevision !== 1 ||
      record.recordKind !== "lease-evidence" ||
      record.repositoryBindingId !== binding ||
      !validId(record.projectId) ||
      !validLeaseEvidence(record.content) ||
      record.createdGeneration !== 1 ||
      record.updatedGeneration !==
        (record.content.disposition === "acquired" ? 1 : 2) ||
      record.contentHash !== hashStateText(encodeStateValue(record.content)) ||
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
      !isStateObject(item) ||
      !hasStateKeys(item, [
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
      !validResultRecord(item) ||
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
  return true;
}

/**
 * CoordinatorのTaskと技術実行を閉じた保存形式として検証する。
 * @responsibility Task・Queue・Workspaceと固定操作情報、現在資源、未解決回復、受領、履歴の構造・相関を所有する。
 * @trace ARCH-000004、ARCH-000008
 */

export const EXECUTION_STATE_SCHEMA = "crdd-execution-model/state/v4";

export const STORAGE_CONTRACT =
  "crdd-coordinator/orchestrator-durable-foundation/v1" as const;

/**
 * Lease Evidenceが有効か判定する。
 *
 * @responsibility Lease Evidenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validLeaseEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がvalidLeaseEvidenceの入力契約を満たす。
 * @postcondition validLeaseEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validLeaseEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validLeaseEvidenceは独自の失敗分岐を所有しない。
 * @invariant validLeaseEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validLeaseEvidenceはProcess内の同一Subsystemで完結する。
 * @security validLeaseEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validLeaseEvidenceは共有非同期状態を持たない同期処理である。
 */
export function validLeaseEvidence(value: unknown) {
  return (
    isStateObject(value) &&
    hasStateKeys(value, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "disposition",
    ]) &&
    (value.kind === "project-operation" ||
      value.kind === "canonical-adoption") &&
    validId(value.queueId) &&
    validId(value.ownerGeneration) &&
    Number.isSafeInteger(value.ownerProcessId) &&
    Number(value.ownerProcessId) > 0 &&
    (value.disposition === "acquired" ||
      value.disposition === "released" ||
      value.disposition === "recovered_after_owner_loss" ||
      value.disposition === "acquisition_unknown_closed")
  );
}

/**
 * durable-foundationのHashを算出する。
 *
 * @responsibility durable-foundationの入力byte列、Hash algorithm、算出結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns hashStateTextの計算結果を返す。
 * @precondition 「value: string」がhashStateTextの入力契約を満たす。
 * @postcondition hashStateTextの責務を完了した結果だけを返す。
 * @effect N/A: hashStateTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashStateTextは独自の失敗分岐を所有しない。
 * @invariant hashStateTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hashStateTextはProcess内の同一Subsystemで完結する。
 * @security hashStateTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashStateTextは共有非同期状態を持たない同期処理である。
 */
export function hashStateText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * lease Identityを決定する。
 *
 * @responsibility lease Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseIdentityの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseIdentityの入力契約を満たす。
 * @postcondition leaseIdentityの責務を完了した結果だけを返す。
 * @effect N/A: leaseIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseIdentityは独自の失敗分岐を所有しない。
 * @invariant leaseIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseIdentityはProcess内の同一Subsystemで完結する。
 * @security leaseIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseIdentityは共有非同期状態を持たない同期処理である。
 */
export function leaseIdentity(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  return kind === "project-operation"
    ? `${kind}-${repositoryBindingId}`
    : kind === "canonical-adoption"
      ? `${kind}-${repositoryBindingId}-${projectId}`
      : `${kind}-${projectId}-${queueId}`;
}

/**
 * lease Acquisition 回復 Idを決定する。
 *
 * @responsibility lease Acquisition 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseAcquisitionRecoveryIdの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseAcquisitionRecoveryIdの入力契約を満たす。
 * @postcondition leaseAcquisitionRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function leaseAcquisitionRecoveryId(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  const identityInput =
    kind === "project-operation"
      ? `${repositoryBindingId}\0${kind}`
      : kind === "canonical-adoption"
        ? `${repositoryBindingId}\0${projectId}\0${kind}`
        : `${repositoryBindingId}\0${projectId}\0${queueId}\0${kind}`;
  return `lease-acquisition-${hashStateText(identityInput).slice(0, 40)}`;
}

// Queue results may carry an exact opaque candidate or recovery reference.
// These references use the same closed character set as stable IDs, but can
// exceed the 128-character limit of ordinary project-local identifiers.

/**
 * 技術記録を完全な値へ投影し、定義集合との相関を検査する。
 * @responsibility 受領本文・終端導出・exact操作参照を一度だけ実装する。
 * @trace ARCH-000004、ARCH-000008
 * @input snapshot: 共通区画と管理Task値、Repository結合、本文Hash、定義対象集合。
 * @returns 検査済み投影、又はnull。
 * @precondition 正規JSONから得た共通区画と検査済み定義対象を受け取る。
 * @postcondition 同じ受領を別Task・別世代へ流用しない。
 * @effect N/A: 局所の値検査だけ。
 * @failure 欠測・不一致・孤立参照はnull。
 * @invariant Coreだけの対象に偽のTask・Selection・Ownerを作らない。
 * @boundary 正本と管理実行用のメモリ投影。旧形式Readerではない。
 * @security 成功から保存確定・実資源不存在・現在Authorityを推定しない。
 * @concurrency N/A: 同期の局所処理。
 */
function projectExecutionSnapshotSections(
  snapshot: ExecutionStateSnapshot,
  managedProjects: readonly ExecutionStoredManagedProject[],
  payloadSha256: string,
  definitionProjects: readonly Readonly<{ projectId: string }>[],
) {
  const claimedOperations = new Set<string>();
  const projects: ProjectExecutionState[] = [];
  for (const project of managedProjects) {
    if (!Array.isArray(project.tasks)) return null;
    const tasks: ProjectTaskRecord[] = [];
    for (const task of project.tasks) {
      if (
        !hasExecutionStateRecordKeys(task, [
          "definition",
          "state",
          "attemptId",
          "operationId",
          "authorityBindingId",
          "startPhase",
          "settlement",
          "recoveryObligations",
          "candidateId",
          "retryCount",
          "supersededBy",
        ]) ||
        !Array.isArray(task.recoveryObligations)
      )
        return null;
      const settlement = projectTaskSettlement(task.settlement, snapshot);
      if (!settlement) return null;
      const matching = snapshot.operations
        .filter((operation) => {
          if (operation.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(operation.identityJson);
          return (
            (identity.recoveryCorrelationId ?? identity.operationId) ===
            task.operationId
          );
        })
        .map((operation) => operation.recoveryId);
      const referenced =
        task.settlement.kind === "operations"
          ? task.settlement.recoveryIds
          : [];
      if (
        matching.length !== referenced.length ||
        matching.some((id) => !referenced.includes(id)) ||
        referenced.some((id: string) => claimedOperations.has(id))
      )
        return null;
      for (const id of referenced) claimedOperations.add(id);
      const recoveryObligations: ProjectTaskRecoveryObligation[] = [];
      for (const obligation of task.recoveryObligations) {
        if (obligation.kind !== "docker") {
          if (
            !hasExecutionStateRecordKeys(obligation, [
              "kind",
              "recoveryId",
              "phase",
            ])
          )
            return null;
          recoveryObligations.push(obligation);
          continue;
        }
        if (
          !hasExecutionStateRecordKeys(obligation, [
            "kind",
            "recoveryId",
            "phase",
          ])
        )
          return null;
        const observed = projectTaskSettlement(
          {
            kind: "operations",
            recoveryIds: [obligation.recoveryId],
            resultUnresolved: false,
          },
          snapshot,
        );
        if (
          (!observed && obligation.phase !== "settled") ||
          (observed &&
            !observed.cleanupConfirmed &&
            obligation.phase === "settled")
        )
          return null;
        recoveryObligations.push({
          ...obligation,
          phase: observed
            ? observed.cleanupConfirmed
              ? "settled"
              : obligation.phase
            : "settled",
        });
      }
      const {
        settlement: _settlement,
        recoveryObligations: _obligations,
        ...record
      } = task;
      tasks.push(
        Object.freeze({
          ...record,
          ...settlement,
          recoveryObligations,
        }),
      );
    }
    projects.push(Object.freeze({ ...project, tasks: Object.freeze(tasks) }));
  }
  const taskSections = {
    ...snapshot,
    repositoryBindingId: snapshot.repositoryBindingId ?? "",
    intakeEpoch: snapshot.intakeEpoch ?? "",
    projects,
  };
  if (snapshot.repositoryBindingId === null || snapshot.intakeEpoch === null) {
    if (
      snapshot.repositoryBindingId !== null ||
      snapshot.intakeEpoch !== null ||
      [
        "projects",
        "queueEntries",
        "intakeBindings",
        "workspaces",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "decisions",
        "blockers",
      ].some(
        (key) =>
          !Array.isArray(
            (snapshot as unknown as Record<string, unknown>)[key],
          ) ||
          ((snapshot as unknown as Record<string, unknown[]>)[key]?.length ??
            -1) !== 0,
      )
    )
      return null;
  } else if (
    !validId(snapshot.repositoryBindingId) ||
    !validId(snapshot.intakeEpoch) ||
    !projects.every(validState) ||
    !validExecutionTaskReferences(
      { ...taskSections, projects: definitionProjects },
      snapshot.repositoryBindingId,
    )
  )
    return null;
  return Object.freeze({
    snapshot,
    projects: Object.freeze(projects),
    payloadSha256,
  });
}

/**
 * 現在状態の全区画と既存結合を検証する。
 * @responsibility 部分codecを完全保存形式として受理しない。
 * @trace ARCH-000004
 * @input value: JSON値、binding: 期待Repository結合、rootHash: 取得済みRoot結合。
 * @returns 閉じたSnapshotとして有効か。
 * @precondition JSON値だけを渡す。
 * @postcondition 参照、証拠、受付結合、結果と終了要約を検証する。
 * @effect N/A: 値検証のみ。
 * @failure 不正形状・未知区画・孤立参照はfalse。
 * @invariant Owner状態や清掃を推定しない。
 * @boundary JSONから保存契約。
 * @security 既存保護情報を新規発行しない。
 * @concurrency N/A: 同期検証。
 */
export function validSnapshot(
  value: unknown,
  binding: string,
  rootHash: string,
): value is Snapshot {
  try {
    if (
      !isStateObject(value) ||
      !hasStateKeys(value, [
        "schema",
        "schemaRevision",
        "repositoryRootHash",
        "repositoryBindingId",
        "snapshotRevision",
        "intakeEpoch",
        "intakeBindings",
        "projects",
        "queueEntries",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "decisions",
        "blockers",
        "workspaces",
      ]) ||
      value.schema !== PROJECT_SNAPSHOT_SCHEMA ||
      value.schemaRevision !== 7 ||
      value.repositoryBindingId !== binding ||
      value.repositoryRootHash !== rootHash ||
      !validId(binding) ||
      !isSha256Hex(rootHash) ||
      !validId(value.intakeEpoch) ||
      !Number.isSafeInteger(value.snapshotRevision) ||
      Number(value.snapshotRevision) < 1
    )
      return false;
    return validTaskState(value as unknown as Snapshot, binding);
  } catch {
    return false;
  }
}

/**
 * 修復の保存用途を同じ純粋な候補検査へ明示的に接続する。
 * @responsibility 外側・Kernel内で同じ用途別の完全再導出を行う。
 * @trace ARCH-000008
 * @input before、candidate: 元版と候補、recoveryId: exact参照、purpose: 閉じた保存用途、binding: Repository結合。
 * @returns 用途固有の検査が成立する場合だけtrue。
 * @precondition 保存Ownerと物理元版は呼出し側が再確認する。
 * @postcondition 通常更新へ専用変更をfallbackしない。
 * @effect N/A: メモリ検査だけ。
 * @failure 未知用途・不正候補・用途違いはfalse。
 * @invariant 同値進捗の純粋成立を物理保存完了と同一視しない。
 * @boundary 専用保存入口と既存値モデル。
 * @security 用途も保存値も実資源処置を許可しない。
 * @concurrency 元版CASと排他の保証は既存物理Writerが所有する。
 */
export function validateRepairWriteCandidate(
  before: unknown,
  candidate: unknown,
  recoveryId: string,
  purpose: unknown,
  binding: string,
): boolean {
  switch (purpose) {
    case "checkpoint":
      return validateStateTransition(before, candidate, binding);
    case "session_begin":
      return validateStateRepairSessionTransition(
        before,
        candidate,
        recoveryId,
        binding,
      );
    case "retention_handoff":
      return validateStateRepairRetentionHandoffTransition(
        before,
        candidate,
        recoveryId,
        binding,
      );
    case "disposal_decision":
    case "disposal_primary":
    case "disposal_failed":
    case "disposal_auxiliary":
      return validateStateRepairDisposalTransition(
        before,
        candidate,
        recoveryId,
        purpose.slice("disposal_".length),
        binding,
      );
    default:
      return false;
  }
}

/**
 * 新しい認証unknown不存在の生成・変更を一般保存から識別する。
 * @responsibility 保存済み専用値の同値保全と新しい終了辺を区別する。
 * @trace ARCH-000008
 * @input before、after: 復号済み元Snapshotと保存候補。
 * @returns 専用Contextを要する資源差分があればtrue。
 * @precondition 両Snapshotは現在codecで検査済み。
 * @postcondition 操作除去や同値保全を新しい不存在観測に数えない。
 * @effect N/A: 同期値比較だけ。
 * @failure 元操作・元資源欠落は新しい辺として拒否対象にする。
 * @invariant 複合更新でも資源差分の検査を省略しない。
 * @boundary 一般Writerと専用の一回保存Context。
 * @security 保存値・Hashだけから専用保存を許可しない。
 * @concurrency 保存排他の外側と内側で同じ差分を確認する。
 */
export function authenticationUnknownAbsenceChanged(
  before: ExecutionStateSnapshot | null,
  after: ExecutionStateSnapshot,
): boolean {
  return after.operations.some(
    (operation) =>
      operation.kind === "docker_task" &&
      (operation.resources?.checkpoints ?? []).some((resource) => {
        if (
          resource.submission !== "intent_saved" ||
          resource.receiptSource !== null ||
          resource.observation !== "absent"
        )
          return false;
        const previous = before?.operations.find(
          (item) =>
            item.kind === "docker_task" &&
            item.recoveryId === operation.recoveryId,
        );
        const priorResource =
          previous?.kind === "docker_task"
            ? previous.resources?.checkpoints.find(
                (item) => item.key === resource.key,
              )
            : null;
        return (
          !priorResource ||
          encodeStateValue(priorResource) !== encodeStateValue(resource)
        );
      }),
  );
}

/**
 * 保存済み操作が未要求の初期形から許された退役差分だけを持つか判定する。
 * @responsibility 初期再導出・未解決参照・全field一致を実Host観測から分離する。
 * @trace ARCH-000008
 * @input operation: 同じ検証済みSnapshot内のTask操作、snapshot: 同じ現在版。
 * @returns Owner退役・清掃進捗・終了済み再起動以外の差がなければtrue。
 * @effect N/A: メモリ内の再導出と比較だけ。
 * @security trueはHost不存在・清掃許可・実資源未作成の証明ではない。
 * @boundary 保存モデルの初期形。実Host状態とtokenはCoordinatorが観測する。
 */
export function isInitialOperationHost(
  operation: ExecutionOperationRecord,
  snapshot: ExecutionStateSnapshot,
): boolean {
  if (
    !isDockerRestartCheckpointSettled(operation.dockerRestart) ||
    !["not_requested", "pending"].includes(operation.host.cleanup)
  )
    return false;
  const bytes = prepareStateOperationSnapshot(
    null,
    operation.identityJson,
    snapshot.repositoryBinding,
  );
  const initial = bytes
    ? decodeStateSnapshot(bytes, snapshot.repositoryBinding)?.snapshot
        .operations[0]
    : null;
  if (initial?.kind !== "docker_task") return false;
  const nonce = JSON.parse(operation.identityJson).operationNonce;
  if (
    snapshot.unresolvedRecoveries.some(
      (entry) =>
        entry.recoveryId === operation.recoveryId ||
        entry.operationNonce === nonce,
    )
  )
    return false;
  return (
    encodeStateValue(operation) ===
    encodeStateValue({
      ...initial,
      phase: "settling",
      dockerRestart: operation.dockerRestart,
      host: { ...initial.host, cleanup: operation.host.cleanup },
      execution: { ...initial.execution, ownerEffect: "disabled" },
    })
  );
}

/**
 * 検査済みStateの保持参照と必須行の相関を一つの元版から投影する。
 * @responsibility 判断・未搬送・未解決・現在操作の参照をHistoryへ渡す。
 * @trace ARCH-000008
 * @input snapshot: 全体Codec検査済みの同じ現在State。
 * @returns 保持参照と必須Hash、又は判断投影不正のnull。
 * @precondition 呼出側がStateを同じ結合で復号する。
 * @postcondition 行の存在や保存確定は推定しない。
 * @effect N/A: メモリ内投影だけ。
 * @failure 判断イベントの相関不正はnull。
 * @invariant historyを持つ全操作はconfirmedによらず必須行に含める。
 * @boundary Stateの参照整合とHistoryの選別。
 * @security 保存・退役Authorityを生成しない。
 * @concurrency 外部読取りや時点の追加取得をしない。
 */
function projectHistoryRetentionReferences(
  snapshot: ExecutionStateSnapshot,
): HistoryRetentionReferences | null {
  const protectedRecoveries = new Set<string>();
  const requiredRows: HistoryRetentionReferences["requiredRows"][number][] = [];
  for (const decision of snapshot.decisions) {
    const events = projectDecisionHistory(decision);
    if (!events) return null;
    for (const event of events)
      protectedRecoveries.add(`decision-history.${event.eventId}`);
  }
  for (const row of snapshot.historyPending)
    protectedRecoveries.add(`task-history.${row.id}`);
  for (const recovery of snapshot.unresolvedRecoveries)
    protectedRecoveries.add(recovery.recoveryId);
  for (const operation of snapshot.operations) {
    if (!operation.history) continue;
    protectedRecoveries.add(operation.recoveryId);
    requiredRows.push({
      recoveryId: operation.recoveryId,
      lineSha256: operation.history.lineSha256,
      summarySha256: operation.summarySha256,
    });
  }
  return { protectedRecoveries, requiredRows };
}

/**
 * 検査済み終了履歴から保持期間内・保持期限前・未終了参照の行を残す候補を作る。
 * @responsibility 期間整理と保存確認の順序を現在状態へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 現在Snapshot、historyBytes: 履歴本文、now: 固定UTC時刻、retentionDays: 設定日数、repositoryBinding: 現在結合。
 * @returns 元の行順と本文を維持した候補、またはnull。
 * @precondition 更新排他内の元File実体・版・設定を物理Writerが再照合する。
 * @postcondition 未確認行は期限外でも保持し、確認済みの欠落行を再追加しない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 全行検査失敗、設定不正、未確認行欠落または相関不一致はnull。
 * @invariant 件数・容量を理由に削除せず、状態の操作・搬送を変更しない。
 * @boundary 現在状態と通常履歴の保持期間。
 * @security 候補生成は実保存・読戻し・操作除去のAuthorityを発行しない。
 * @concurrency 判定時刻・設定と元本文への結合を保存側が保持する。
 */
export function prepareHistoryRetention(
  currentBytes: unknown,
  historyBytes: unknown,
  now: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeStateSnapshot(currentBytes, repositoryBinding);
  const rows = decodeHistoryRows(historyBytes);
  if (!current || !rows) return null;
  const references = projectHistoryRetentionReferences(current.snapshot);
  return references
    ? retainHistoryRows(rows, references, now, retentionDays)
    : null;
}
