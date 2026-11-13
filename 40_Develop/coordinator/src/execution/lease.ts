/**
 * 長期実行排他の取得・回復・解放を管理する。
 * @responsibility 実発行Leaseと証拠の寿命を所有し、既存の保存・共通File排他へ接続する。
 * @trace ARCH-000004、ARCH-000008
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  acquireLease,
  type LeaseKind,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  type ProjectQueueEntry,
  readLease,
  recoverLease,
  releaseLease,
  validId,
} from "../../../execution-model/src/index.ts";
import { acquireLock, type Lock } from "../../../lock/src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  observeRepositoryExecutionDataArea,
  type RepositoryExecutionDataAreaObservation,
  requireReadyRepositoryExecutionDataArea,
  resolveRepositoryExecutionDataPaths,
} from "../configuration/runtime-data.ts";
import { snapshotPlainRecord } from "../input/snapshot.ts";
import type {
  CoordinatorLease,
  CoordinatorLeaseAcquisitionResolution,
  CoordinatorLeaseOwnerObservation,
} from "../state/persistence.ts";
import type { StoreResult } from "../state/result.ts";
import { blocked, completed } from "../state/result.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../state/transaction.ts";
import { verifyRuntimePersistenceRepository } from "./persistence.ts";

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
  physicalLock: Lock;
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
    if (!activeLease.physicalLock.assertLive()) return false;
    if (activeLease.snapshotPhysicalIdentity !== undefined) {
      const paths = resolveNamedPaths(activeLease.repositoryRoot);
      if (!paths) return false;
      const boundary = assertArea(
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
      const physicalIdentity = observePhysicalLeaseFile(activeLease.lock);
      assertAreaUnchanged(activeLease.repositoryRoot, "tmp", boundary);
      return physicalIdentity === activeLease.snapshotPhysicalIdentity;
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
  return readLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    { kind: "acquisition", input: [binding] },
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
 * @effect 取得意図を保存し、Repository内tmpの固定名を共通wx Lockで取得する。
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
  const reserved = acquireLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "intent",
      input: [
        binding,
        projectId,
        queueId,
        kind,
        identity,
        intent,
        {
          resourcesAbsent: (repositoryRoot: string) =>
            snapshotLeaseResourcesAbsent(repositoryRoot, identity),
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
          markIntentSaveRequested: () => {
            intentSaveRequested = true;
          },
        },
      ],
    },
  );
  if (reserved.status !== "completed")
    return intentSaveRequested && reserved.manualRecoveryRequired
      ? blocked(reserved.reason, true, recoveryId)
      : reserved;
  const { repositoryRoot, rootIdentity } = reserved.value;
  const leasePaths = resolveNamedPaths(repositoryRoot);
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
  let physicalLock: Lock | null = null;
  try {
    const resolved = resolveNamedPaths(workingDirectory);
    const rootMetadata = fs.lstatSync(repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== repositoryRoot ||
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot ||
      createHash("sha256")
        .update(
          JSON.stringify([
            rootMetadata.dev,
            rootMetadata.ino,
            rootMetadata.birthtimeMs,
          ]),
          "utf8",
        )
        .digest("hex") !== rootIdentity
    )
      throw new Error("lease_root_changed");
    const temporary = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        repositoryRoot,
        "tmp",
      ),
      "orchestrator_repository_root_invalid",
    ).directory;
    const boundary = assertArea(repositoryRoot, "tmp", temporary);
    const locks = ensureDirectory(temporary, "orchestrator-leases");
    assertDirectory(locks);
    const acquiredLock = acquireLock({
      directory: locks,
      name: path.basename(lock),
      identity,
    });
    if (acquiredLock.status !== "acquired") {
      // 初期化途中・descriptor終了不明も既存Intentと同じ回復IDで保全する。
      return blocked(
        "orchestrator_lease_acquisition_recovery_required",
        true,
        recoveryId,
      );
    }
    physicalLock = acquiredLock.lock;
    assertDirectory(locks);
    physicalIdentity = observePhysicalLeaseFile(lock);
    assertAreaUnchanged(repositoryRoot, "tmp", boundary);
  } catch {
    physicalLock?.release(true);
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  let acquired: ReturnType<typeof acquireLease>;
  try {
    acquired = acquireLease(
      verifyRuntimePersistenceRepository(workingDirectory),
      binding,
      {
        kind: "observed",
        input: [
          binding,
          projectId,
          queueId,
          kind,
          ownerGeneration,
          intent,
          physicalIdentity,
          recoveryId,
          process.pid,
          {
            physicalIdentityMatches: () => {
              return (
                physicalLock?.assertLive() === true &&
                observePhysicalLeaseFile(lock) === physicalIdentity
              );
            },
          },
        ],
      },
    );
  } catch {
    physicalLock.release(true);
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  if (acquired.status !== "completed") {
    physicalLock.release(true);
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
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
     * @effect 元共通Lockのdescriptor・Fileを解放し保存を更新する。
     * @failure 別実体、観測不能、保存失敗を保全停止する。
     * @invariant 要求発行を解放完了にしない。
     * @boundary opaque Lease、Filesystem、統合保存。
     * @security 別Ownerの実体を処置しない。
     * @concurrency 短期保存Ownerを物理操作の前後で分離する。
     */
    release(): StoreResult<Readonly<{ released: true }>> {
      if (released) return blocked("orchestrator_lease_already_released");
      try {
        const active = activeLeases.get(lease);
        if (!active || !activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const pending = releaseLease(
          verifyRuntimePersistenceRepository(workingDirectory),
          binding,
          { kind: "intent", input: [intent, physicalIdentity] },
        );
        if (pending.status !== "completed")
          throw new Error("lease_release_intent_unknown");
        if (!activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const boundary = assertArea(
          repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        if (!physicalLock.release())
          throw new Error("lease_release_unconfirmed");
        assertAreaUnchanged(repositoryRoot, "tmp", boundary);
        if (!snapshotLeaseResourcesAbsent(repositoryRoot, identity))
          throw new Error("lease_release_unconfirmed");
        activeLeases.delete(lease);
        const settled = releaseLease(
          verifyRuntimePersistenceRepository(workingDirectory),
          binding,
          {
            kind: "observed",
            input: [binding, intent, physicalIdentity, process.pid],
          },
        );
        if (settled.status !== "completed")
          throw new Error("lease_release_settlement_unknown");
        released = true;
        return settled;
      } catch {
        // 失敗したLeaseは再利用せず、descriptorを閉じて元Fileと回復参照を保全する。
        activeLeases.delete(lease);
        physicalLock.release(true);
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      }
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
    physicalLock,
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
 * @effect 回収意図を保存し、fresh照合後の短期保存Lock内で元Fileを処置・不存在確認して終了を保存する。
 * @failure Owner存続、観測不能、対象変更、由来未確定実体では処置しない。
 * @invariant 取得未確定を取得成功へ書き換えない。
 * @boundary Snapshot、Process観測、Repository内の実排他。
 * @security 他Owner、他Root、候補と保護判断へ処置を広げない。
 * @concurrency Owner生存観測は短期排他外、物理処置は全fresh照合後の同じ保存Lock内で同期実行する。
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
  const inspected = readLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "owner_loss",
      input: [
        projectId,
        queueId,
        kind,
        {
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
        },
      ],
    },
  );
  if (inspected.status !== "completed")
    return blocked(inspected.reason, true, recoveryId);
  const initial = inspected.value;
  const leasePaths = resolveNamedPaths(initial.repositoryRoot);
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
      return recoverLease(
        verifyRuntimePersistenceRepository(workingDirectory),
        binding,
        {
          kind: "reconcile",
          input: [
            projectId,
            queueId,
            kind,
            initial.queue,
            recoveryId,
            {
              resourcesAbsent: (repositoryRoot: string) =>
                snapshotLeaseResourcesAbsent(repositoryRoot, identity),
            },
          ],
        },
      );
    }
    try {
      if (
        !snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity) ||
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
  const observedOwner = snapshotPlainRecord(
    observation,
    new Set(["status", "ownerProcessId", "ownerGeneration"]),
  );
  if (
    !observedOwner ||
    Object.getPrototypeOf(observation) !== Object.prototype ||
    observedOwner.ownerProcessId !== first.ownerProcessId ||
    observedOwner.ownerGeneration !== first.ownerGeneration
  )
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  if (observedOwner.status === "alive")
    return blocked("orchestrator_lease_owner_still_active");
  if (observedOwner.status !== "absent")
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
      if (!snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)) {
        if (first.phase !== "acquisition_reserved" || ownIntents.length !== 1)
          return blocked(
            "orchestrator_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        const boundary = assertArea(
          initial.repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        assertDirectory(path.dirname(lock));
        physicalIdentity = observePhysicalLeaseFile(lock);
        assertAreaUnchanged(initial.repositoryRoot, "tmp", boundary);
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
  const reserved = recoverLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "intent",
      input: [
        projectId,
        queueId,
        kind,
        initial,
        ownIntents,
        pending,
        recoveryId,
        {
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
        },
      ],
    },
  );
  if (reserved.status !== "completed")
    return blocked(reserved.reason, true, recoveryId);
  let recoveryFailureReason: string | null = null;
  const settled = recoverLease(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    {
      kind: "observed",
      input: [
        binding,
        projectId,
        queueId,
        kind,
        initial,
        ownIntents,
        pending,
        first,
        recoveryId,
        {
          observeRoot: (repositoryRoot: string) => {
            const metadata = fs.lstatSync(repositoryRoot);
            return {
              repositoryRoot: repositoryRoot,
              rootIdentity: createHash("sha256")
                .update(
                  JSON.stringify([
                    metadata.dev,
                    metadata.ino,
                    metadata.birthtimeMs,
                  ]),
                  "utf8",
                )
                .digest("hex"),
            };
          },
          recoverResources: () => {
            try {
              const resolved = resolveNamedPaths(workingDirectory);
              const rootMetadata = fs.lstatSync(initial.repositoryRoot);
              if (
                !resolved ||
                resolved.repositoryRoot !== initial.repositoryRoot ||
                !rootMetadata.isDirectory() ||
                rootMetadata.isSymbolicLink() ||
                fs.realpathSync.native(initial.repositoryRoot) !==
                  initial.repositoryRoot ||
                createHash("sha256")
                  .update(
                    JSON.stringify([
                      rootMetadata.dev,
                      rootMetadata.ino,
                      rootMetadata.birthtimeMs,
                    ]),
                    "utf8",
                  )
                  .digest("hex") !== initial.rootIdentity
              )
                throw new Error("lease_root_changed");
              // 不存在と観測不能を区別し、親にaliasがある場合も処置しない。
              if (
                !snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
              ) {
                const boundary = assertArea(
                  initial.repositoryRoot,
                  "tmp",
                  leasePaths.temporary,
                );
                assertDirectory(path.dirname(lock));
                const observedIdentity = observePhysicalLeaseFile(lock);
                if (
                  physicalIdentity === null ||
                  observedIdentity !== physicalIdentity
                )
                  throw new Error(
                    "orchestrator_lease_physical_identity_unconfirmed",
                  );
                if (observePhysicalLeaseFile(lock) !== observedIdentity)
                  throw new Error(
                    "orchestrator_lease_physical_identity_unconfirmed",
                  );
                fs.unlinkSync(lock);
                assertAreaUnchanged(initial.repositoryRoot, "tmp", boundary);
              }
              if (
                !snapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
              )
                throw new Error("lease_release_unconfirmed");
              return true;
            } catch (error) {
              recoveryFailureReason =
                error instanceof Error &&
                error.message ===
                  "orchestrator_lease_physical_identity_unconfirmed"
                  ? error.message
                  : "orchestrator_lease_recovery_observation_unknown";
              return false;
            }
          },
          resourcesAbsent: (repositoryRoot: string) =>
            snapshotLeaseResourcesAbsent(repositoryRoot, identity),
        },
      ],
    },
  );
  return settled.status === "completed"
    ? settled
    : blocked(recoveryFailureReason ?? settled.reason, true, recoveryId);
}
/**
 * Directoryを表明どおりか検査する。
 *
 * @responsibility Directoryの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns N/A: assertDirectoryは戻り値を返さない。
 * @precondition 「directory: string」がassertDirectoryの入力契約を満たす。
 * @postcondition assertDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect assertDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure assertDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security assertDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assertDirectoryは共有非同期状態を持たない同期処理である。
 */
function assertDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  ) {
    throw new Error("orchestrator_storage_boundary_invalid");
  }
}

/**
 * 固定Lease Fileの実体と元内容を一つの不透明な照合値へ固定する。
 * 通常File・単一Link・2KiB上限と同じdescriptor／Pathを照合し、共通Lockのwireを再解釈しない。
 * 旧Directory・alias・観測不能は拒否する。descriptorは成功・失敗とも閉じる。
 */
function observePhysicalLeaseFile(file: string): string {
  const before = fs.lstatSync(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size > 2048n
  )
    throw new Error("lease_file_invalid");
  const descriptor = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    const same = (s: fs.BigIntStats) =>
      s.isFile() &&
      !s.isSymbolicLink() &&
      s.nlink === 1n &&
      s.dev === before.dev &&
      s.ino === before.ino &&
      s.birthtimeNs === before.birthtimeNs &&
      s.size === before.size;
    if (!same(opened) || opened.size > 2048n)
      throw new Error("lease_file_changed");
    const buffer = Buffer.alloc(2049);
    let length = 0;
    while (length < buffer.length) {
      const read = fs.readSync(
        descriptor,
        buffer,
        length,
        buffer.length - length,
        length,
      );
      if (read === 0) break;
      length += read;
    }
    const content = buffer.subarray(0, length);
    const finished = fs.fstatSync(descriptor, { bigint: true });
    const after = fs.lstatSync(file, { bigint: true });
    if (
      !same(finished) ||
      !same(after) ||
      content.length > 2048 ||
      BigInt(content.length) !== before.size
    )
      throw new Error("lease_file_changed");
    return createHash("sha256")
      .update(
        JSON.stringify([
          before.dev.toString(),
          before.ino.toString(),
          before.birthtimeNs.toString(),
          createHash("sha256")
            .update(content.toString("hex"), "utf8")
            .digest("hex"),
        ]),
        "utf8",
      )
      .digest("hex");
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Directoryが成立する状態を確保する。
 *
 * @responsibility Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000004
 * @input parent: string、name: string
 * @returns ensureDirectoryの計算結果を返す。
 * @precondition 「parent: string、name: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了した結果だけを返す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security ensureDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureDirectory(parent: string, name: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(name) || name === "." || name === "..")
    throw new Error("orchestrator_storage_identity_invalid");
  const target = path.join(parent, name);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      )
    )
      throw error;
  }
  assertDirectory(target);
  if (path.dirname(target) !== parent)
    throw new Error("orchestrator_storage_boundary_invalid");
  return target;
}

/**
 * 検証済みRootから名前付きPathだけを投影する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 公開投影または無効Rootのnull。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */

export function resolveNamedPaths(workingDirectory: string) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryExecutionDataPaths(verified.capability)
    : null;
}

/**
 * 既存の名前付き領域をEffect0で観測する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns readyまたは真正不存在のnot_observed。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
function observeArea(repositoryRoot: string, area: "domain-model" | "tmp") {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  const observation = observeRepositoryExecutionDataArea(
    verified.capability,
    area,
  );
  if (observation.status === "blocked") throw new Error(observation.reason);
  if (
    observation.status === "ready" &&
    observation.repositoryRoot !== repositoryRoot
  )
    throw new Error("orchestrator_repository_root_invalid");
  return observation;
}

/**
 * I/O対象の名前付き領域が現在も成立することを確認する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 確認済みready観測。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertArea(
  repositoryRoot: string,
  area: "domain-model" | "tmp",
  directory: string,
) {
  const observation = observeArea(repositoryRoot, area);
  if (observation.status !== "ready" || observation.directory !== directory)
    throw new Error("orchestrator_storage_boundary_invalid");
  return observation;
}

/**
 * I/O前後の同じ境界観測を照合する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns N/A: 一致確認のみ。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
export function assertAreaUnchanged(
  repositoryRoot: string,
  area: "domain-model" | "tmp",
  initial: Exclude<
    RepositoryExecutionDataAreaObservation,
    { status: "blocked" }
  >,
) {
  const current = observeArea(repositoryRoot, area);
  if (
    initial.status !== current.status ||
    (initial.status === "ready" &&
      (current.status !== "ready" ||
        current.directory !== initial.directory ||
        current.boundaryIdentity !== initial.boundaryIdentity))
  )
    throw new Error("orchestrator_storage_boundary_changed");
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns errorCodeの計算結果を返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
}

/**
 * lease Acquisition Temporary Prefixを決定する。
 *
 * @responsibility lease Acquisition Temporary Prefixの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input identity: string
 * @returns leaseAcquisitionTemporaryPrefixの計算結果を返す。
 * @precondition 「identity: string」がleaseAcquisitionTemporaryPrefixの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryPrefixの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionTemporaryPrefixは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionTemporaryPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryPrefixはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryPrefixは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryPrefix(identity: string) {
  return `.pending-${identity}-acquisition-`;
}

/**
 * lease Acquisition Temporary Filesを決定する。
 *
 * @responsibility lease Acquisition Temporary Filesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string
 * @returns leaseAcquisitionTemporaryFilesの計算結果を返す。
 * @precondition 「directory: string、identity: string」がleaseAcquisitionTemporaryFilesの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryFilesの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryFilesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure leaseAcquisitionTemporaryFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant leaseAcquisitionTemporaryFilesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryFilesはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryFilesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryFilesは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryFiles(directory: string, identity: string) {
  assertDirectory(directory);
  const prefix = leaseAcquisitionTemporaryPrefix(identity);
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix));
  if (names.some((name) => !name.endsWith(".tmp")))
    throw new Error("orchestrator_lease_acquisition_inventory_invalid");
  return Object.freeze(names);
}

/**
 * path Confirmed Absentを決定する。
 *
 * @responsibility path Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns pathConfirmedAbsentの計算結果を返す。
 * @precondition 「candidate: string」がpathConfirmedAbsentの入力契約を満たす。
 * @postcondition pathConfirmedAbsentの責務を完了した結果だけを返す。
 * @effect pathConfirmedAbsentはFilesystemの読取りまたは書込みを実行する。
 * @failure pathConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathConfirmedAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function pathConfirmedAbsent(candidate: string) {
  try {
    fs.lstatSync(candidate);
    return false;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }
}

/**
 * lease Acquisition Footprint Absentを決定する。
 *
 * @responsibility lease Acquisition Footprint Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、paths: readonly string[]
 * @returns leaseAcquisitionFootprintAbsentの計算結果を返す。
 * @precondition 「directory: string、identity: string、paths: readonly string[]」がleaseAcquisitionFootprintAbsentの入力契約を満たす。
 * @postcondition leaseAcquisitionFootprintAbsentの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionFootprintAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionFootprintAbsentは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionFootprintAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionFootprintAbsentはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionFootprintAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionFootprintAbsentは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionFootprintAbsent(
  directory: string,
  identity: string,
  paths: readonly string[],
) {
  return (
    paths.every(pathConfirmedAbsent) &&
    leaseAcquisitionTemporaryFiles(directory, identity).length === 0
  );
}

/**
 * 新版Leaseの実排他を、親の真正不存在も含めて観測する。
 * @responsibility 不存在と不正親・観測不能を区別する。
 * @trace ARCH-000004
 * @input repositoryRoot: 検証済みRoot、identity: 実排他の固定Identity。
 * @returns 実排他と取得途中Fileが真正に不在か。
 * @precondition 呼出し側がRoot実体と対象intentを照合する。
 * @postcondition FileやDirectoryを作成せず観測結果だけを返す。
 * @effect Repository内の正規親と対象のmetadataを読む。
 * @failure alias、不正形状、読取り拒否は例外として呼出し側へ返す。
 * @invariant 親の不存在と観測不能を同一視しない。
 * @boundary Repository Rootからtmp内の短命な実排他へ。
 * @security Root外の実体へ辿らない。
 * @concurrency Rootと最後の既知親を不存在判定前に再確認する。
 */
export function snapshotLeaseResourcesAbsent(
  repositoryRoot: string,
  identity: string,
): boolean {
  assertDirectory(repositoryRoot);
  const boundary = observeArea(repositoryRoot, "tmp");
  if (boundary.status === "not_observed") {
    assertAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  const parent = path.join(boundary.directory, "orchestrator-leases");
  if (pathConfirmedAbsent(parent)) {
    assertAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  assertDirectory(parent);
  const isAbsent = leaseAcquisitionFootprintAbsent(parent, identity, [
    path.join(parent, `${identity}.lock`),
  ]);
  assertDirectory(repositoryRoot);
  assertDirectory(parent);
  assertAreaUnchanged(repositoryRoot, "tmp", boundary);
  return isAbsent;
}
