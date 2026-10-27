/**
 * 長期実行排他の取得・回復・解放を管理する。
 * @responsibility 実発行Leaseと証拠の寿命を所有し、既存の保存・Kernel排他へ接続する。
 * @trace ARCH-000004、ARCH-000008
 */
import {
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  type LeaseEvidenceEnvelope,
  type LeaseKind,
  hashRuntimeStateValueText as digest,
  hasRuntimeStateKeys as exactKeys,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  isRuntimeStateObject as plainObject,
  validId,
  type ProjectQueueEntry,
} from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";
import { resolveCoordinatorNamedPaths } from "../storage/state.ts";
import { assertCoordinatorArea } from "../storage/state.ts";
import { assertCoordinatorAreaUnchanged } from "../storage/state.ts";
import type { StoreResult } from "../state/result.ts";
import { completed } from "../state/result.ts";
import { blocked } from "../state/result.ts";
import { assertDirectory } from "../storage/state.ts";
import { ensureDirectory } from "../storage/state.ts";
import { envelope } from "../storage/state.ts";
import { withCoordinatorSnapshotOperation } from "../storage/state.ts";
import { coordinatorSnapshotLeaseResourcesAbsent } from "../storage/state.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../state/transaction.ts";

import { randomUUID } from "node:crypto";

import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import type { CoordinatorLease } from "../state/persistence.ts";
import type { CoordinatorLeaseAcquisitionResolution } from "../state/persistence.ts";
import type { CoordinatorLeaseOwnerObservation } from "../state/persistence.ts";

import fs from "node:fs";
import path from "node:path";

/**
 * durable-foundationで使用するActive Leaseの値契約を定義する。
 *
 * @responsibility Active LeaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ActiveLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ActiveLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ActiveLeaseの宣言は外部境界を開かない。
 * @security ActiveLeaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ActiveLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ActiveLease = Readonly<{
  repositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  kind: LeaseKind;
  ownerGeneration: string;
  lock: string;
  recoveryMarker: string;
  acquisitionMarker: string;
  lockOwnershipMarker: string;
  evidenceDirectory: string;
  identity: string;
  snapshotPhysicalIdentity?: string;
}>;

const activeLeases = new WeakMap<CoordinatorLease, ActiveLease>();

/**
 * 同じ実Leaseへ結合した観測値だけを借りる。
 * @responsibility 実行OwnerのMapを公開せず、Queueのfresh観測へ同じ結合を渡す。
 * @trace ARCH-000004
 * @input lease: 実行側で発行済みのLease候補。
 * @returns 同じ実発行記録、又は未登録のundefined。
 * @precondition 現在の生存確認は呼出し側が既存の位置で行う。
 * @postcondition Mapの寿命・登録・削除を変更しない。
 * @effect N/A: 私有Mapの同期読取りだけ。
 * @failure 未発行値ではundefined。
 * @invariant 値の同一性だけで実Leaseを再構成しない。
 * @boundary 実行Lease OwnerとQueueの現在観測。
 * @security Mapや書換え操作は公開しない。
 * @concurrency freshな観測の直前に同じ記録を参照する。
 */
export function borrowCoordinatorActiveLease(lease: CoordinatorLease) {
  return activeLeases.get(lease);
}

/**
 * Lease Is Observedが有効な状態か判定する。
 *
 * @responsibility Lease Is Observedの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000004
 * @input activeLease: ActiveLease
 * @returns activeLeaseIsObservedの計算結果を返す。
 * @precondition 「activeLease: ActiveLease」がactiveLeaseIsObservedの入力契約を満たす。
 * @postcondition activeLeaseIsObservedの責務を完了した結果だけを返す。
 * @effect activeLeaseIsObservedはFilesystemの読取りまたは書込みを実行する。
 * @failure activeLeaseIsObservedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeLeaseIsObservedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security activeLeaseIsObservedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeLeaseIsObservedは共有非同期状態を持たない同期処理である。
 */
export function activeLeaseIsObserved(activeLease: ActiveLease) {
  try {
    assertDirectory(activeLease.lock);
    if (activeLease.snapshotPhysicalIdentity !== undefined) {
      const paths = resolveCoordinatorNamedPaths(activeLease.repositoryRoot);
      if (!paths) return false;
      const boundary = assertCoordinatorArea(
        activeLease.repositoryRoot,
        "tmp",
        paths.temporary,
      );
      for (const directory of [
        activeLease.repositoryRoot,
        boundary.directory,
        path.dirname(activeLease.lock),
      ]) {
        assertDirectory(directory);
        if (fs.realpathSync.native(directory) !== directory) return false;
      }
      const metadata = fs.lstatSync(activeLease.lock);
      assertCoordinatorAreaUnchanged(
        activeLease.repositoryRoot,
        "tmp",
        boundary,
      );
      return (
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) === activeLease.snapshotPhysicalIdentity
      );
    }
    return !fs.existsSync(activeLease.recoveryMarker);
  } catch {
    return false;
  }
}

/**
 * 新版の未終了取得意図から、操作LeaseのOwner参照を取得する。
 * @responsibility 記録の取得とOS上のOwner生死判定を分離する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内起点、binding: 対象Repository結合。
 * @returns 同一Ownerに結合した取得参照、真正な参照不存在、または停止。
 * @precondition 新版v2の現在状態が確定している。
 * @postcondition 記録の読取りだけでOwner死亡や回収成功を表示しない。
 * @effect 短期排他を取得してSnapshotを読む。状態を保存しない。
 * @failure 複数Owner、Queue結合差、未知Schemaと観測不能を拒否する。
 * @invariant 別ProjectのLeaseや採用Leaseを操作Ownerとして返さない。
 * @boundary 現在Snapshotから既存Lease PortのOwner参照へ。
 * @security JSONから実行用opaque LeaseやAuthorityを復元しない。
 * @concurrency 同じ短期Owner内でQueueと取得意図を照合し、解放確認後に返す。
 */
export function inspectCoordinatorSnapshotLeaseAcquisitionOwner(
  workingDirectory: string,
  binding: string,
): StoreResult<
  Readonly<{ acquisition: CoordinatorLeaseAcquisitionResolution | null }>
> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
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
    },
  );
}

/**
 * 統合保存の取得意図と短命な実排他を結合する。
 * @responsibility 記録の確定と物理取得を分け、同Ownerのopaque Leaseだけを返す。
 * @trace ARCH-000004
 * @input workingDirectory、binding、projectId、queueId、kind。
 * @returns 実排他を取得したLease、またはexact取得回復参照付き停止。
 * @precondition v2保存と対象Project／Queueがある。
 * @postcondition 意図と取得証拠の確定後にだけLeaseを返す。
 * @effect 取得意図を保存し、Repository内tmpへ短命な排他Directoryを作成する。
 * @failure 部分取得は意図を保全し、未取得や清掃済みへ丸めない。
 * @invariant 短期保存排他を長期実行や外部待機へ持ち越さない。
 * @boundary 現在状態、実Filesystem排他、Process内opaque Lease。
 * @security JSONからLeaseを復元しない。
 * @concurrency Repository単位／Project単位の既存Lease Identityを維持する。
 */
export function acquireCoordinatorSnapshotLease(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<CoordinatorLease> {
  if (
    ![binding, projectId, queueId].every(validId) ||
    (kind !== "project-operation" && kind !== "canonical-adoption")
  )
    return blocked("orchestrator_lease_identity_invalid");
  const identity = leaseIdentity(binding, projectId, queueId, kind);
  const recoveryId = leaseAcquisitionRecoveryId(
    binding,
    projectId,
    queueId,
    kind,
  );
  const ownerGeneration = randomUUID();
  const intent = {
    projectId,
    queueId,
    kind,
    ownerGeneration,
    ownerProcessId: process.pid,
    recoveryId,
    phase: "acquisition_reserved" as const,
    physicalIdentity: null,
  };
  let intentSaveRequested = false;
  const reserved = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        !validId(projectId) ||
        (kind === "project-operation"
          ? !current.queueEntries.some(
              (item) =>
                item.queueId === queueId && item.projectId === projectId,
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
      if (
        !coordinatorSnapshotLeaseResourcesAbsent(owner.repositoryRoot, identity)
      )
        return blocked("orchestrator_lease_preexisting_resource");
      const metadata = fs.lstatSync(owner.repositoryRoot);
      intentSaveRequested = true;
      return completed("orchestrator_lease_intent_durable", {
        next: { ...current, leaseIntents: [...current.leaseIntents, intent] },
        value: {
          repositoryRoot: owner.repositoryRoot,
          rootIdentity: digest(
            JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
          ),
        },
      });
    },
  );
  if (reserved.status !== "completed")
    return intentSaveRequested && reserved.manualRecoveryRequired
      ? blocked(reserved.reason, true, recoveryId)
      : reserved;
  const { repositoryRoot, rootIdentity } = reserved.value;
  const leasePaths = resolveCoordinatorNamedPaths(repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== repositoryRoot)
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.temporary,
    "orchestrator-leases",
    `${identity}.lock`,
  );
  let physicalIdentity: string;
  try {
    const resolved = resolveCoordinatorNamedPaths(workingDirectory);
    const rootMetadata = fs.lstatSync(repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== repositoryRoot ||
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot ||
      digest(
        JSON.stringify([
          rootMetadata.dev,
          rootMetadata.ino,
          rootMetadata.birthtimeMs,
        ]),
      ) !== rootIdentity
    )
      throw new Error("lease_root_changed");
    const temporary = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        repositoryRoot,
        "tmp",
      ),
      "orchestrator_repository_root_invalid",
    ).directory;
    const boundary = assertCoordinatorArea(repositoryRoot, "tmp", temporary);
    const locks = ensureDirectory(temporary, "orchestrator-leases");
    assertDirectory(locks);
    fs.mkdirSync(lock, { mode: 0o700 });
    assertDirectory(locks);
    assertDirectory(lock);
    const metadata = fs.lstatSync(lock);
    physicalIdentity = digest(
      JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
    );
    assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
  } catch {
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  const acquired = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        !current.leaseIntents.some(
          (item) =>
            encodeRuntimeStateValue(item) === encodeRuntimeStateValue(intent),
        )
      )
        return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
      const metadata = fs.lstatSync(lock);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== physicalIdentity
      )
        return blocked(
          "orchestrator_lease_physical_identity_changed",
          true,
          recoveryId,
        );
      const evidence = envelope("lease-evidence", binding, projectId, 1, 1, {
        kind,
        queueId,
        ownerGeneration,
        ownerProcessId: process.pid,
        disposition: "acquired",
      }) as LeaseEvidenceEnvelope;
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
    },
  );
  if (acquired.status !== "completed")
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  let released = false;
  let lease!: CoordinatorLease;
  lease = Object.freeze({
    kind,
    ownerGeneration,
    /**
     * 同じ実排他を解放して終了を保存する。
     * @responsibility 解放意図、実体照合、不存在確認、終了証拠の順を守る。
     * @trace ARCH-000004
     * @input N/A: opaque Leaseの取得時結合を使う。
     * @returns 解放確定またはexact回復参照付き停止。
     * @precondition 同じ実体を保持するLeaseである。
     * @postcondition 成功時は実排他が不在でintentが終了している。
     * @effect 同じ排他Directoryを解放し保存を更新する。
     * @failure 別実体、観測不能、保存失敗を保全停止する。
     * @invariant 要求発行を解放完了にしない。
     * @boundary opaque Lease、Filesystem、統合保存。
     * @security 別Ownerの実体を処置しない。
     * @concurrency 短期保存Ownerを物理操作の前後で分離する。
     */
    release(): StoreResult<Readonly<{ released: true }>> {
      if (released) return blocked("orchestrator_lease_already_released");
      const active = activeLeases.get(lease);
      if (!active || !activeLeaseIsObserved(active))
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      const pending = withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !current.leaseIntents.some(
              (item) =>
                item.ownerGeneration === ownerGeneration &&
                item.phase === "lock_owned" &&
                item.physicalIdentity === physicalIdentity,
            )
          )
            return blocked(
              "orchestrator_lease_intent_mismatch",
              true,
              recoveryId,
            );
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
        },
      );
      if (pending.status !== "completed") {
        activeLeases.delete(lease);
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      }
      try {
        if (!activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const boundary = assertCoordinatorArea(
          repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        fs.rmdirSync(lock);
        assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
        if (!coordinatorSnapshotLeaseResourcesAbsent(repositoryRoot, identity))
          throw new Error("lease_release_unconfirmed");
      } catch {
        activeLeases.delete(lease);
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      }
      activeLeases.delete(lease);
      const settled = withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !current.leaseIntents.some(
              (item) =>
                item.ownerGeneration === ownerGeneration &&
                item.phase === "release_pending" &&
                item.physicalIdentity === physicalIdentity,
            )
          )
            return blocked(
              "orchestrator_lease_intent_mismatch",
              true,
              recoveryId,
            );
          const evidence = envelope(
            "lease-evidence",
            binding,
            projectId,
            1,
            2,
            {
              kind,
              queueId,
              ownerGeneration,
              ownerProcessId: process.pid,
              disposition: "released",
            },
          ) as LeaseEvidenceEnvelope;
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
        },
      );
      if (settled.status !== "completed")
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      released = true;
      return settled;
    },
  });
  activeLeases.set(lease, {
    repositoryRoot,
    repositoryBindingId: binding,
    projectId,
    queueId,
    kind,
    ownerGeneration,
    lock,
    recoveryMarker: "",
    acquisitionMarker: "",
    lockOwnershipMarker: "",
    evidenceDirectory: "",
    identity,
    snapshotPhysicalIdentity: physicalIdentity,
  });
  return completed("orchestrator_lease_acquired", lease);
}

/**
 * 新版LeaseのOwner喪失を現在観測から終了処置する。
 * @responsibility 過去の取得結果と現在の資源不存在を分けて保存する。
 * @trace ARCH-000004
 * @input Repository起点、binding、Project、Queue、Lease種別、既存Owner観測。
 * @returns 終了後のQueueと回復参照、または同じ参照付き停止。
 * @precondition v2現在状態と対象の取得意図が検証できる。
 * @postcondition 回収確認だけでTask成功や採用成功を表示しない。
 * @effect 回収意図を保存し、同じ空の実排他を解放して終了を保存する。
 * @failure Owner存続、観測不能、対象変更、由来未確定実体では処置しない。
 * @invariant 取得未確定を取得成功へ書き換えない。
 * @boundary Snapshot、Process観測、Repository内の実排他。
 * @security 他Owner、他Root、候補と保護判断へ処置を広げない。
 * @concurrency 外部観測を短期排他の外で行い、対象を再照合する。
 */
export function reconcileCoordinatorSnapshotLeaseOwnerLoss(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  observeOwner: CoordinatorLeaseOwnerObservation,
): StoreResult<
  Readonly<{ queue: ProjectQueueEntry | null; recoveryId: string | null }>
> {
  if (
    ![binding, projectId, queueId].every(validId) ||
    !["project-operation", "canonical-adoption"].includes(kind) ||
    typeof observeOwner !== "function"
  )
    return blocked("orchestrator_lease_recovery_input_invalid");
  const recoveryId = leaseAcquisitionRecoveryId(
    binding,
    projectId,
    queueId,
    kind,
  );
  const identity = leaseIdentity(binding, projectId, queueId, kind);
  const inspected = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
        return blocked("orchestrator_snapshot_schema_invalid");
      const queue =
        kind === "project-operation"
          ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
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
      const metadata = fs.lstatSync(owner.repositoryRoot);
      return completed("orchestrator_lease_recovery_inspected", {
        next: null,
        value: {
          intents,
          queue,
          intakeEpoch: current.intakeEpoch,
          repositoryRoot: owner.repositoryRoot,
          rootIdentity: digest(
            JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
          ),
        },
      });
    },
  );
  if (inspected.status !== "completed")
    return blocked(inspected.reason, true, recoveryId);
  const initial = inspected.value;
  const leasePaths = resolveCoordinatorNamedPaths(initial.repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== initial.repositoryRoot)
    return blocked(
      "orchestrator_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.temporary,
    "orchestrator-leases",
    `${identity}.lock`,
  );
  const first = initial.intents[0];
  if (!first) {
    if (initial.queue?.ownerGeneration) {
      if (!["leased", "running"].includes(initial.queue.state)) {
        const settled = createCoordinatorSnapshotPersistencePorts(
          workingDirectory,
          binding,
          initial.intakeEpoch,
        ).state.settleQueueLeaseRelease(
          queueId,
          initial.queue.generation,
          initial.queue.ownerGeneration,
        );
        return settled.status === "completed"
          ? completed(settled.reason, {
              queue: settled.value,
              recoveryId: null,
            })
          : blocked(settled.reason, true, recoveryId);
      }
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const queue = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
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
            queue.generation !== initial.queue?.generation ||
            queue.ownerGeneration !== initial.queue?.ownerGeneration ||
            !["leased", "running"].includes(queue.state) ||
            !released ||
            current.leaseIntents.some(
              (item) =>
                item.projectId === projectId &&
                item.queueId === queueId &&
                item.kind === kind,
            ) ||
            !coordinatorSnapshotLeaseResourcesAbsent(
              owner.repositoryRoot,
              identity,
            )
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
        },
      );
    }
    try {
      if (
        !coordinatorSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        ) ||
        initial.queue?.ownerGeneration
      )
        return blocked(
          "orchestrator_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      return completed("orchestrator_lease_acquisition_resources_absent", {
        queue: initial.queue,
        recoveryId: null,
      });
    } catch {
      return blocked(
        "orchestrator_lease_recovery_observation_unknown",
        true,
        recoveryId,
      );
    }
  }
  const ownIntents = initial.intents;
  if (
    ownIntents.some(
      (item) =>
        item.ownerGeneration !== first.ownerGeneration ||
        item.ownerProcessId !== first.ownerProcessId ||
        item.recoveryId !== first.recoveryId,
    ) ||
    (initial.queue?.ownerGeneration !== null &&
      initial.queue?.ownerGeneration !== undefined &&
      initial.queue.ownerGeneration !== first.ownerGeneration)
  )
    return blocked(
      "orchestrator_lease_acquisition_owner_mismatch",
      true,
      recoveryId,
    );
  let observation: unknown;
  try {
    observation = observeOwner(
      Object.freeze({
        ownerProcessId: first.ownerProcessId,
        ownerGeneration: first.ownerGeneration,
      }),
    );
  } catch {
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  }
  if (
    !plainObject(observation) ||
    !exactKeys(observation, ["status", "ownerProcessId", "ownerGeneration"]) ||
    observation.ownerProcessId !== first.ownerProcessId ||
    observation.ownerGeneration !== first.ownerGeneration
  )
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  if (observation.status === "alive")
    return blocked("orchestrator_lease_owner_still_active");
  if (observation.status !== "absent")
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  let physicalIdentity =
    ownIntents.find((item) => item.physicalIdentity !== null)
      ?.physicalIdentity ?? null;
  if (physicalIdentity === null) {
    try {
      if (
        !coordinatorSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        )
      ) {
        if (first.phase !== "acquisition_reserved" || ownIntents.length !== 1)
          return blocked(
            "orchestrator_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        const boundary = assertCoordinatorArea(
          initial.repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        assertDirectory(path.dirname(lock));
        assertDirectory(lock);
        const metadata = fs.lstatSync(lock);
        if (fs.readdirSync(lock).length !== 0)
          return blocked(
            "orchestrator_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        physicalIdentity = digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        );
        assertCoordinatorAreaUnchanged(initial.repositoryRoot, "tmp", boundary);
      }
    } catch {
      return blocked(
        "orchestrator_lease_recovery_observation_unknown",
        true,
        recoveryId,
      );
    }
  }
  const pending = {
    ...first,
    phase: "recovery_pending" as const,
    physicalIdentity,
  };
  const reserved = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const metadata = fs.lstatSync(owner.repositoryRoot);
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        owner.repositoryRoot !== initial.repositoryRoot ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== initial.rootIdentity ||
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
      const existing = ownIntents.find(
        (item) => item.phase === "recovery_pending",
      );
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
    },
  );
  if (reserved.status !== "completed")
    return blocked(reserved.reason, true, recoveryId);
  try {
    const resolved = resolveCoordinatorNamedPaths(workingDirectory);
    const rootMetadata = fs.lstatSync(initial.repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== initial.repositoryRoot ||
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync.native(initial.repositoryRoot) !==
        initial.repositoryRoot ||
      digest(
        JSON.stringify([
          rootMetadata.dev,
          rootMetadata.ino,
          rootMetadata.birthtimeMs,
        ]),
      ) !== initial.rootIdentity
    )
      throw new Error("lease_root_changed");
    // 不存在と観測不能を区別し、親にaliasがある場合も処置しない。
    if (
      !coordinatorSnapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
    ) {
      const boundary = assertCoordinatorArea(
        initial.repositoryRoot,
        "tmp",
        leasePaths.temporary,
      );
      assertDirectory(path.dirname(lock));
      assertDirectory(lock);
      const metadata = fs.lstatSync(lock);
      if (
        physicalIdentity === null ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== physicalIdentity ||
        fs.readdirSync(lock).length !== 0
      )
        return blocked(
          "orchestrator_lease_physical_identity_unconfirmed",
          true,
          recoveryId,
        );
      fs.rmdirSync(lock);
      assertCoordinatorAreaUnchanged(initial.repositoryRoot, "tmp", boundary);
    }
    if (
      !coordinatorSnapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
    )
      throw new Error("lease_release_unconfirmed");
  } catch {
    return blocked(
      "orchestrator_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
  const settled = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const metadata = fs.lstatSync(owner.repositoryRoot);
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        owner.repositoryRoot !== initial.repositoryRoot ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== initial.rootIdentity ||
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
        !coordinatorSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
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
      const evidence = envelope("lease-evidence", binding, projectId, 1, 2, {
        kind,
        queueId,
        ownerGeneration: first.ownerGeneration,
        ownerProcessId: first.ownerProcessId,
        disposition: acquired
          ? "recovered_after_owner_loss"
          : "acquisition_unknown_closed",
      }) as LeaseEvidenceEnvelope;
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
    },
  );
  return settled.status === "completed"
    ? settled
    : blocked(settled.reason, true, recoveryId);
}
