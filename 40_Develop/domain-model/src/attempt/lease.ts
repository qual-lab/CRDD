/**
 * 実行Leaseの保存値と用途固定候補を所有する。
 * @packageDocumentation
 * @responsibility 元intent・Queue・世代・証拠Hashを照合し、必要な現在観測を元の位置で呼ぶ。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 実Lock・opaque Lease・Process生死・回復処置・物理保存を所有しない。
 */
import { types } from "node:util";
import type {
  CoordinatorSnapshot,
  LeaseKind,
  LeaseEvidenceContent,
  LeaseEvidenceEnvelope,
} from "../state/types.ts";
import type { ProjectQueueEntry } from "../task/types.ts";
import {
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
  validId,
  validLeaseEvidence,
  leaseIdentity,
} from "../state/validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import { digest } from "../state/validation.ts";
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
export function projectCoordinatorLeaseAcquisitionOwner(
  current: CoordinatorSnapshot,
  binding: string,
) {
  if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
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
export function prepareCoordinatorLeaseAcquisitionReservation(
  current: CoordinatorSnapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  identity: string,
  intent: CoordinatorSnapshot["leaseIntents"][number],
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
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
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
export function prepareCoordinatorLeaseAcquisitionConfirmation(
  current: CoordinatorSnapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  ownerGeneration: string,
  intent: CoordinatorSnapshot["leaseIntents"][number],
  physicalIdentity: string,
  recoveryId: string,
  ownerProcessId: number,
  observations: Readonly<{ physicalIdentityMatches: () => boolean }>,
) {
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    !current.leaseIntents.some(
      (item) =>
        encodeRuntimeStateValue(item) === encodeRuntimeStateValue(intent),
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
export function prepareCoordinatorLeaseReleaseIntent(
  current: CoordinatorSnapshot,
  intent: CoordinatorSnapshot["leaseIntents"][number],
  physicalIdentity: string,
) {
  const { ownerGeneration, recoveryId } = intent;
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
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
export function prepareCoordinatorLeaseReleaseSettlement(
  current: CoordinatorSnapshot,
  binding: string,
  intent: CoordinatorSnapshot["leaseIntents"][number],
  physicalIdentity: string,
  ownerProcessId: number,
) {
  const { ownerGeneration, recoveryId, projectId, queueId, kind } = intent;
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
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
export function projectCoordinatorLeaseOwnerLossState(
  current: CoordinatorSnapshot,
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
  if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
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
export function prepareCoordinatorReleasedLeaseReconciliation(
  current: CoordinatorSnapshot,
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
export function prepareCoordinatorLeaseRecoveryReservation(
  current: CoordinatorSnapshot,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: CoordinatorSnapshot["leaseIntents"],
  pending: CoordinatorSnapshot["leaseIntents"][number],
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
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    root.repositoryRoot !== initial.repositoryRoot ||
    root.rootIdentity !== initial.rootIdentity ||
    encodeRuntimeStateValue(
      current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      ),
    ) !== encodeRuntimeStateValue(ownIntents) ||
    encodeRuntimeStateValue(
      kind === "project-operation"
        ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
        : null,
    ) !== encodeRuntimeStateValue(initial.queue)
  )
    return blocked(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const existing = ownIntents.find((item) => item.phase === "recovery_pending");
  if (
    existing &&
    encodeRuntimeStateValue(existing) !== encodeRuntimeStateValue(pending)
  )
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
export function prepareCoordinatorLeaseRecoverySettlement(
  current: CoordinatorSnapshot,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  initial: Readonly<{
    repositoryRoot: string;
    rootIdentity: string;
    queue: ProjectQueueEntry | null;
  }>,
  ownIntents: CoordinatorSnapshot["leaseIntents"],
  pending: CoordinatorSnapshot["leaseIntents"][number],
  first: CoordinatorSnapshot["leaseIntents"][number],
  recoveryId: string,
  observations: Readonly<{
    observeRoot: () => Readonly<{
      repositoryRoot: string;
      rootIdentity: string;
    }>;
    resourcesAbsent: () => boolean;
  }>,
) {
  const root = observeLeaseRoot(observations.observeRoot);
  if (
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
    root.repositoryRoot !== initial.repositoryRoot ||
    root.rootIdentity !== initial.rootIdentity ||
    encodeRuntimeStateValue(
      kind === "project-operation"
        ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
        : null,
    ) !== encodeRuntimeStateValue(initial.queue) ||
    encodeRuntimeStateValue(
      current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      ),
    ) !==
      encodeRuntimeStateValue(
        ownIntents.some((item) => item.phase === "recovery_pending")
          ? ownIntents
          : [...ownIntents, pending],
      ) ||
    observations.resourcesAbsent() !== true
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
  const serialized = encodeRuntimeStateValue(content);
  return Object.freeze({
    schema: COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
    schemaRevision: 1 as const,
    recordKind: "lease-evidence" as const,
    repositoryBindingId: binding,
    projectId,
    createdGeneration: 1,
    updatedGeneration,
    contentHash: digest(serialized),
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
