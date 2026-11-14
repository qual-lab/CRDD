/**
 * 保存状態に関するLeaseの照会・取得・解放・回復を提供する。
 * @responsibility 現在観測と候補を既存の短期保存排他へ接続し、順序・元参照・失敗を保持する。
 * @trace ARCH-000008
 * @boundary 物理Lease操作は上位Owner、保存の排他・CASは共通State処理が所有する。
 */
import {
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  snapshotStateArray,
  validId,
  encodeStateValue,
  snapshotStateRecord,
  createLeaseEvidence,
} from "./operations.ts";
import { types } from "node:util";
import type { Repository } from "../../../version-control/src/index.ts";
import type { StoreResult } from "../storage/lock.ts";
import { blocked } from "../storage/lock.ts";
import type { ProjectQueueEntry } from "../task/types.ts";
import type {
  LeaseAcquisitionRequest,
  LeaseReadRequest,
  LeaseRecoveryRequest,
  LeaseReleaseRequest,
  Snapshot,
  LeaseKind,
} from "./types.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "./types.ts";
import { withSnapshotOperation } from "./crud.ts";

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function readLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReadRequest, { kind: "acquisition" }>,
): StoreResult<
  Extract<
    ReturnType<typeof projectLeaseAcquisitionOwner>,
    { status: "completed" }
  >["value"]["value"]
>;

export function readLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReadRequest, { kind: "owner_loss" }>,
): StoreResult<
  Extract<
    ReturnType<typeof projectLeaseOwnerLossState>,
    { status: "completed" }
  >["value"]["value"]
>;

export function readLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseReadRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseReadRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "acquisition": {
      const tuple = snapshotStateArray(captured.input, 1);
      if (tuple.status !== "ok" || tuple.value.length < 1)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof projectLeaseAcquisitionOwner>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        projectLeaseAcquisitionOwner(current, ...input),
      );
    }
    case "owner_loss": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;
      if (
        !validId(binding) ||
        !validId(input[0]) ||
        !validId(input[1]) ||
        (input[2] !== "project-operation" && input[2] !== "canonical-adoption")
      )
        return blocked("orchestrator_snapshot_input_invalid");
      const recoveryId = leaseAcquisitionRecoveryId(
        binding,
        input[0],
        input[1],
        input[2],
      );

      const result = withSnapshotOperation<
        Extract<
          ReturnType<typeof projectLeaseOwnerLossState>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        projectLeaseOwnerLossState(current, input[0], input[1], input[2], {
          observeRoot: () => input[3].observeRoot(owner.repositoryRoot),
        }),
      );
      return result.status === "completed"
        ? result
        : Object.freeze({
            ...result,
            recoveryId: result.recoveryId ?? recoveryId,
          });
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseRecoveryRequest, { kind: "reconcile" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareReleasedLeaseReconciliation>,
    { status: "completed" }
  >["value"]["value"]
>;

export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseRecoveryRequest, { kind: "intent" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseRecoveryReservation>,
    { status: "completed" }
  >["value"]["value"]
>;

export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseRecoveryRequest, { kind: "observed" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseRecoverySettlement>,
    { status: "completed" }
  >["value"]["value"]
>;

export function recoverLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseRecoveryRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseRecoveryRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "reconcile": {
      const tuple = snapshotStateArray(captured.input, 6);
      if (tuple.status !== "ok" || tuple.value.length < 6)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareReleasedLeaseReconciliation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareReleasedLeaseReconciliation(
          current,
          input[0],
          input[1],
          input[2],
          input[3],
          input[4],
          {
            resourcesAbsent: () =>
              input[5].resourcesAbsent(owner.repositoryRoot),
          },
        ),
      );
    }
    case "intent": {
      const tuple = snapshotStateArray(captured.input, 8);
      if (tuple.status !== "ok" || tuple.value.length < 8)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseRecoveryReservation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareLeaseRecoveryReservation(
          current,
          input[0],
          input[1],
          input[2],
          input[3],
          input[4],
          input[5],
          input[6],
          { observeRoot: () => input[7].observeRoot(owner.repositoryRoot) },
        ),
      );
    }
    case "observed": {
      const tuple = snapshotStateArray(captured.input, 10);
      if (tuple.status !== "ok" || tuple.value.length < 10)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseRecoverySettlement>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) => {
        const prepared = prepareLeaseRecoverySettlement(
          current,
          input[0],
          input[1],
          input[2],
          input[3],
          input[4],
          input[5],
          input[6],
          input[7],
          input[8],
          {
            observeRoot: () => input[9].observeRoot(owner.repositoryRoot),
          },
        );
        if (prepared.status !== "completed") return prepared;
        // Root・Queue・Intent・終了証拠を全照合した後だけ物理処置する。
        // Promise/thenableを成功へ畳まず、同期完了と明示不存在を両方要求する。
        if (
          input[9].recoverResources(owner.repositoryRoot) !== true ||
          input[9].resourcesAbsent(owner.repositoryRoot) !== true
        )
          return blocked(
            "orchestrator_lease_recovery_state_mismatch",
            true,
            input[8],
          );
        return prepared;
      });
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function releaseLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReleaseRequest, { kind: "intent" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseReleaseIntent>,
    { status: "completed" }
  >["value"]["value"]
>;

export function releaseLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseReleaseRequest, { kind: "observed" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseReleaseSettlement>,
    { status: "completed" }
  >["value"]["value"]
>;

export function releaseLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseReleaseRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseReleaseRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "intent": {
      const tuple = snapshotStateArray(captured.input, 2);
      if (tuple.status !== "ok" || tuple.value.length < 2)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseReleaseIntent>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareLeaseReleaseIntent(current, ...input),
      );
    }
    case "observed": {
      const tuple = snapshotStateArray(captured.input, 4);
      if (tuple.status !== "ok" || tuple.value.length < 4)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseReleaseSettlement>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareLeaseReleaseSettlement(current, ...input),
      );
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

/**
 * Leaseの固定処置を同じ保存Ownerで確定する。
 * @responsibility Intent・観測・元版の各必須条件を種別ごとに保持する。
 * @trace ARCH-000008
 * @input 検証済みRepository、結合と種別固定の必須入力。
 * @returns 元の保存・拒否・不明結果。
 * @precondition 物理処置と認可は上位Ownerが所有する。
 * @postcondition 他区画とexact Identityを保持する。
 * @effect 元の短期排他・読取り・保存だけ。
 * @failure 不正種別・競合・観測不能は拒否する。
 * @invariant Callbackの短絡順とLock内のRoot結合を変更しない。
 * @boundary モデル保存と上位の物理処置。
 * @security 任意Snapshot更新を受けない。
 * @concurrency 元のwithSnapshotOperation保持区間を維持する。
 */
export function acquireLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseAcquisitionRequest, { kind: "intent" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseAcquisitionReservation>,
    { status: "completed" }
  >["value"]["value"]
>;

export function acquireLease(
  workingDirectory: Repository,
  binding: string,
  request: Extract<LeaseAcquisitionRequest, { kind: "observed" }>,
): StoreResult<
  Extract<
    ReturnType<typeof prepareLeaseAcquisitionConfirmation>,
    { status: "completed" }
  >["value"]["value"]
>;

export function acquireLease(
  workingDirectory: Repository,
  binding: string,
  request: LeaseAcquisitionRequest,
) {
  const captured = snapshotStateRecord(
    request,
    new Set(["kind", "input"]),
  ) as LeaseAcquisitionRequest | null;
  if (!captured) return blocked("orchestrator_snapshot_input_invalid");
  switch (captured.kind) {
    case "intent": {
      const tuple = snapshotStateArray(captured.input, 5);
      if (tuple.status !== "ok" || tuple.value.length !== 5)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;
      const owner = snapshotStateRecord(
        input[3],
        new Set(["ownerGeneration", "ownerProcessId"]),
      );
      if (
        !validId(binding) ||
        !validId(input[0]) ||
        !validId(input[1]) ||
        (input[2] !== "project-operation" &&
          input[2] !== "canonical-adoption") ||
        !owner ||
        !validId(owner.ownerGeneration) ||
        !Number.isSafeInteger(owner.ownerProcessId) ||
        (owner.ownerProcessId as number) <= 0
      )
        return blocked("orchestrator_snapshot_input_invalid");
      const identity = leaseIdentity(binding, input[0], input[1], input[2]);
      const recoveryId = leaseAcquisitionRecoveryId(
        binding,
        input[0],
        input[1],
        input[2],
      );
      const intent: Snapshot["leaseIntents"][number] = {
        projectId: input[0],
        queueId: input[1],
        kind: input[2],
        ownerGeneration: owner.ownerGeneration,
        ownerProcessId: owner.ownerProcessId as number,
        recoveryId,
        phase: "acquisition_reserved",
        physicalIdentity: null,
      };

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseAcquisitionReservation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current, owner) =>
        prepareLeaseAcquisitionReservation(
          current,
          binding,
          input[0],
          input[1],
          input[2],
          identity,
          intent,
          {
            resourcesAbsent: () =>
              input[4].resourcesAbsent(owner.repositoryRoot, identity),
            observeRoot: () => input[4].observeRoot(owner.repositoryRoot),
            markIntentSaveRequested: () =>
              input[4].markIntentSaveRequested(recoveryId),
          },
        ),
      );
    }
    case "observed": {
      const tuple = snapshotStateArray(captured.input, 10);
      if (tuple.status !== "ok" || tuple.value.length < 10)
        return blocked("orchestrator_snapshot_input_invalid");
      const input = tuple.value as unknown as typeof captured.input;

      return withSnapshotOperation<
        Extract<
          ReturnType<typeof prepareLeaseAcquisitionConfirmation>,
          { status: "completed" }
        >["value"]["value"]
      >(workingDirectory, binding, (current) =>
        prepareLeaseAcquisitionConfirmation(current, ...input),
      );
    }
  }
  return blocked("orchestrator_snapshot_input_invalid");
}

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
    return blockedLeaseCandidate("orchestrator_snapshot_schema_invalid");
  const intents = current.leaseIntents.filter(
    (item) => item.kind === "project-operation",
  );
  const first = intents[0];
  if (!first)
    return completedLeaseCandidate("orchestrator_lease_acquisition_absent", {
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
    return blockedLeaseCandidate(
      "orchestrator_lease_acquisition_owner_mismatch",
      true,
      first.recoveryId,
    );
  return completedLeaseCandidate(
    "orchestrator_lease_acquisition_owner_observed",
    {
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
    },
  );
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
    return blockedLeaseCandidate("orchestrator_lease_binding_invalid");
  if (
    current.leaseIntents.some(
      (item) =>
        leaseIdentity(binding, item.projectId, item.queueId, item.kind) ===
        identity,
    )
  )
    return blockedLeaseCandidate("orchestrator_lease_unavailable");
  if (observations.resourcesAbsent() !== true)
    return blockedLeaseCandidate("orchestrator_lease_preexisting_resource");
  const root = observeLeaseRoot(observations.observeRoot);
  observations.markIntentSaveRequested();
  return completedLeaseCandidate("orchestrator_lease_intent_durable", {
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
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  if (observations.physicalIdentityMatches() !== true)
    return blockedLeaseCandidate(
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
  return completedLeaseCandidate("orchestrator_lease_acquired", {
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
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  return completedLeaseCandidate("orchestrator_lease_release_intent_durable", {
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
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  const evidence = createLeaseEvidence(binding, projectId, 2, {
    kind,
    queueId,
    ownerGeneration,
    ownerProcessId,
    disposition: "released",
  });
  return completedLeaseCandidate("orchestrator_lease_released", {
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
    return blockedLeaseCandidate("orchestrator_snapshot_schema_invalid");
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
    return blockedLeaseCandidate("orchestrator_lease_binding_invalid");
  const intents = current.leaseIntents.filter(
    (item) =>
      item.projectId === projectId &&
      item.queueId === queueId &&
      item.kind === kind,
  );
  const root = observeLeaseRoot(observations.observeRoot);
  return completedLeaseCandidate("orchestrator_lease_recovery_inspected", {
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
    return blockedLeaseCandidate(
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
  return completedLeaseCandidate("orchestrator_released_lease_reconciled", {
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
    return blockedLeaseCandidate(
      "orchestrator_lease_recovery_state_mismatch",
      true,
      recoveryId,
    );
  const existing = ownIntents.find((item) => item.phase === "recovery_pending");
  if (existing && encodeStateValue(existing) !== encodeStateValue(pending))
    return blockedLeaseCandidate(
      "orchestrator_lease_intent_mismatch",
      true,
      recoveryId,
    );
  return completedLeaseCandidate("orchestrator_lease_recovery_intent_durable", {
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
    return blockedLeaseCandidate(
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
    return blockedLeaseCandidate(
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
  return completedLeaseCandidate("orchestrator_lease_owner_loss_reconciled", {
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

/** 旧Storeの成功封筒だけを局所値として再現する。 */
function completedLeaseCandidate<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/** 旧Storeの拒否理由とexact回復参照を保持する。 */
function blockedLeaseCandidate(
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
