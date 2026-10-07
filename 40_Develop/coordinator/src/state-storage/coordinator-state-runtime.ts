/**
 * Coordinatorの最新現在状態をRepositoryへ保存する。
 * @responsibility 既存のRoot観測・排他・bounded読取りを用いた固定二Fileの保存確定を所有する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";
import {
  createCoordinatorRuntimeDataArea,
  observeRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import {
  readStableBoundedFileSnapshot,
  type StableFileIdentity,
  sameStableFileIdentity,
} from "./bounded-file-snapshot.ts";
import { acquireRuntimeOwnedCoordinatorStateKernelLock } from "../host-runtime/candidate-store-kernel-lock.ts";
import {
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  MAX_COORDINATOR_STATE_BYTES,
  validateCoordinatorStateTransition,
} from "./coordinator-state-model.ts";
import { classifyCoordinatorSnapshotReentry } from "../docker-runtime/docker-recovery-state-machine.ts";
import { borrowRuntimeOwnedCoordinatorStateRepository } from "../repository-operation/repository-operation-runtime.ts";

const initializations = new WeakMap<
  object,
  {
    repositoryBinding: string;
    boundaryIdentity: string;
    payloadSha256: string;
    publicationIssued: boolean;
  }
>();

/**
 * 新規Coordinator領域の初回保存を一つの本文へ結合する。
 * @responsibility 領域の排他的作成と同じOwner・本文の初期化証拠を所有する。
 * @trace ARCH-000008
 * @input managementCapability: 現在Owner、candidateBytes: 初回Snapshot本文。
 * @returns 準備結果、Effect情報と排他終了結果。
 * @precondition .crdd親は既存Ownerが正常作成済み。
 * @postcondition 既存の空領域を再利用しない。
 * @effect Runtime Data Ownerを通して新品coordinator領域だけを作成する。
 * @failure 既存領域、不一致、観測不能、解放失敗では停止する。
 * @invariant 失敗後の証拠を別本文へ転用せず、公開後は初回作成に使わない。
 * @boundary 操作Owner、Runtime Dataの領域作成と現在状態Writer。
 * @security 証拠は内部WeakMapだけに保持し、AuthorityやPathを公開しない。
 * @concurrency 同じCoordinator保存用の短期排他を用いる。
 */
export function prepareRuntimeOwnedCoordinatorStateInitialization(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const candidate = repository
    ? decodeCoordinatorStateSnapshot(
        candidateBytes,
        repository.repositoryBinding,
      )
    : null;
  if (
    !repository ||
    !candidate ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !validateCoordinatorStateTransition(
      null,
      candidateBytes,
      repository.repositoryBinding,
    ) ||
    initializations.has(managementCapability) ||
    candidate.snapshot.operations.some(
      (operation) =>
        JSON.parse(operation.identityJson).operationId !==
        repository.operationId,
    ) ||
    [
      ...candidate.snapshot.unresolvedRecoveries,
      ...candidate.snapshot.pendingDeliveries,
    ].some((item) => {
      const operation = candidate.snapshot.operations.find(
        (value) => value.recoveryId === item.recoveryId,
      );
      return (
        !operation ||
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: true,
    });
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock)
    return Object.freeze({
      status: "blocked",
      effectIssued: false,
      lockReleased: false,
    });
  let effectIssued = false;
  let prepared = false;
  try {
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (
      verified.status !== "completed" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("owner");
    const created = createCoordinatorRuntimeDataArea(verified.capability);
    effectIssued = created.effectIssued;
    if (
      created.status !== "created" ||
      !repository.revalidate() ||
      !lock.assertLive()
    )
      throw new Error("created");
    initializations.set(managementCapability, {
      repositoryBinding: repository.repositoryBinding,
      boundaryIdentity: created.observation.boundaryIdentity,
      payloadSha256: candidate.payloadSha256,
      publicationIssued: false,
    });
    prepared = true;
  } catch {
    prepared = false;
  }
  let lockReleased = false;
  try {
    lockReleased = lock.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) initializations.delete(managementCapability);
  return Object.freeze({
    status: prepared && lockReleased ? "prepared" : "blocked",
    effectIssued,
    lockReleased,
  });
}

/**
 * 最新現在状態の保存と同じpendingへの再入場を処置する。
 * @responsibility 保存確定と排他終了を別結果で返し、部分成功を隠さない。
 * @trace ARCH-000008
 * @input managementCapability: 現在操作Owner、candidateBytes: 次Snapshotの正規本文。
 * @returns status、保存確認、排他終了、Effect発行、試行版とHash、exact回復参照。
 * @precondition 操作OwnerとRepository結合を確認済み。
 * @postcondition 失敗・観測不能を成功や不存在にしない。
 * @effect 固定state.lock/pending/stateの作成・置換・短命物回収だけ。
 * @failure 不一致やI/O失敗は例外で上位へ返す。
 * @invariant 本番Producerの全面切替やHost回収成立をこの保存だけから主張しない。
 * @boundary Coordinator現在状態とFilesystem。
 * @security 任意Pathや過去JSONから保存先を選択しない。
 * @concurrency 同じRepositoryの短期排他下で処置する。
 */
export function writeRuntimeOwnedCoordinatorStateSnapshot(
  managementCapability: unknown,
  candidateBytes: unknown,
) {
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const candidate = repository
    ? decodeCoordinatorStateSnapshot(
        candidateBytes,
        repository.repositoryBinding,
      )
    : null;
  const bytes = candidate
    ? Buffer.from(`${encodeCoordinatorStateValue(candidate.snapshot)}\n`)
    : null;
  const attempt = {
    revision: candidate?.snapshot.revision ?? null,
    payloadSha256: candidate?.payloadSha256 ?? null,
    recoveryIds: Object.freeze(
      candidate?.snapshot.operations.map((operation) => operation.recoveryId) ??
        [],
    ),
  };
  if (!repository || !candidate || !bytes)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_input_invalid",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: true,
    });
  const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(
    repository.repositoryBinding,
  );
  if (!lock)
    return Object.freeze({
      ...attempt,
      status: "blocked",
      reason: "coordinator_state_lock_unavailable",
      filesystemEffectIssued: false,
      snapshotConfirmed: false,
      lockReleased: false,
    });
  let filesystemEffectIssued = false;
  let snapshotConfirmed = false;
  let reason = "coordinator_state_storage_unconfirmed";
  try {
    const verified = verifyRepositoryRoot(repository.repositoryRoot);
    if (verified.status !== "completed") throw new Error("root");
    const initial = observeRepositoryRuntimeDataArea(
      verified.capability,
      "coordinator",
    );
    if (
      initial.status !== "ready" ||
      initial.repositoryRoot !== repository.repositoryRoot
    )
      throw new Error("area");
    const directory = initial.directory;
    const fileIdentities = new Map<string, StableFileIdentity>();
    /**
     * 保存I/Oの前後で同じ操作Ownerと領域を再確認する。
     * @responsibility Rootと.crddとcoordinator領域の置換を拒否する。
     * @trace ARCH-000008
     * @input N/A: 閉包のOwnerと固定境界。
     * @returns N/A: 一致しなければ例外。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 現在Rootと領域metadataの読取り。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant LockだけをRoot実体の証明にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const assertBoundary = () => {
      if (!repository.revalidate() || !lock.assertLive())
        throw new Error("owner");
      const fresh = verifyRepositoryRoot(repository.repositoryRoot);
      if (fresh.status !== "completed") throw new Error("root");
      const observed = observeRepositoryRuntimeDataArea(
        fresh.capability,
        "coordinator",
      );
      if (
        observed.status !== "ready" ||
        observed.directory !== directory ||
        observed.boundaryIdentity !== initial.boundaryIdentity
      )
        throw new Error("boundary");
    };
    /**
     * 固定Fileの明示不存在と安定本文を区別する。
     * @responsibility 通常File・nlink1・bounded本文と前後境界を照合する。
     * @trace ARCH-000008
     * @input name: 固定された保存File名。
     * @returns 安定byte列、または明示不存在のnull。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileの読取りだけ。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 観測不能や途中消失を不存在にしない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const read = (name: "state.json" | "state.pending.json" | "state.lock") => {
      assertBoundary();
      const file = path.join(directory, name);
      let metadata: fs.Stats;
      try {
        metadata = fs.lstatSync(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        if (fileIdentities.has(name)) throw new Error("file_disappeared");
        assertBoundary();
        return null;
      }
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
      )
        throw new Error("file");
      const observed = readStableBoundedFileSnapshot(
        file,
        MAX_COORDINATOR_STATE_BYTES,
      );
      const expectedIdentity = fileIdentities.get(name);
      if (
        expectedIdentity &&
        !sameStableFileIdentity(expectedIdentity, observed.identity)
      )
        throw new Error("file_replaced");
      fileIdentities.set(name, observed.identity);
      if (fs.lstatSync(file).nlink !== 1) throw new Error("links");
      assertBoundary();
      return observed.bytes;
    };
    /**
     * 固定の短命Fileを排他的に作成してflushする。
     * @responsibility 既存File非上書きと保存途中の残存保持を所有する。
     * @trace ARCH-000008
     * @input name: pendingまたはlock、content: 確定本文。
     * @returns N/A: 作成とflushを実行する。
     * @precondition 操作OwnerとRepository結合を確認済み。
     * @postcondition 失敗・観測不能を成功や不存在にしない。
     * @effect 固定Fileのwx作成、書込み、fsync、close。
     * @failure 不一致やI/O失敗は例外で上位へ返す。
     * @invariant 失敗後にpendingを自動削除しない。
     * @boundary Coordinator現在状態とFilesystem。
     * @security 任意Pathや過去JSONから保存先を選択しない。
     * @concurrency 同じRepositoryの短期排他下で処置する。
     */
    const create = (
      name: "state.pending.json" | "state.lock",
      content: Buffer,
    ) => {
      assertBoundary();
      filesystemEffectIssued = true;
      const fd = fs.openSync(path.join(directory, name), "wx", 0o600);
      try {
        fs.writeFileSync(fd, content);
        fs.fsyncSync(fd);
        fileIdentities.set(name, fs.fstatSync(fd, { bigint: true }));
      } finally {
        fs.closeSync(fd);
      }
      const saved = read(name);
      if (!saved?.equals(content)) throw new Error("readback");
    };
    assertBoundary();
    const names = fs.readdirSync(directory);
    if (
      names.some(
        (name) =>
          ![
            "state.json",
            "state.pending.json",
            "state.lock",
            "history.jsonl",
          ].includes(name),
      )
    )
      throw new Error("unknown_content");
    const marker = Buffer.from(
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
    );
    const oldMarker = read("state.lock");
    if (oldMarker !== null && !oldMarker.equals(marker))
      throw new Error("marker");
    let currentBytes = read("state.json");
    let current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(
            currentBytes,
            repository.repositoryBinding,
          );
    if (currentBytes !== null && !current) throw new Error("current");
    const pendingBytes = read("state.pending.json");
    if (pendingBytes !== null && !pendingBytes.equals(bytes))
      throw new Error("other_pending");
    const initialRoot =
      currentBytes === null &&
      managementCapability !== null &&
      typeof managementCapability === "object" &&
      initializations.get(managementCapability)?.repositoryBinding ===
        repository.repositoryBinding &&
      initializations.get(managementCapability)?.boundaryIdentity ===
        initial.boundaryIdentity &&
      initializations.get(managementCapability)?.payloadSha256 ===
        candidate.payloadSha256 &&
      initializations.get(managementCapability)?.publicationIssued === false &&
      names.every((name) =>
        ["state.pending.json", "state.lock"].includes(name),
      );
    if (pendingBytes !== null) {
      const pending = decodeCoordinatorStateSnapshot(
        pendingBytes,
        repository.repositoryBinding,
      );
      if (!pending) throw new Error("pending");
      const treatment = classifyCoordinatorSnapshotReentry(
        current
          ? {
              status: "present",
              revision: current.snapshot.revision,
              repositoryBinding: repository.repositoryBinding,
              payloadSha256: current.payloadSha256,
            }
          : { status: "absent" },
        { ...pending.snapshot, payloadSha256: pending.payloadSha256 },
        repository.repositoryBinding,
        initialRoot ? "new" : "existing",
      );
      if (treatment === "blocked") throw new Error("pending_conflict");
      if (
        treatment === "publish_pending" &&
        !validateCoordinatorStateTransition(
          currentBytes,
          pendingBytes,
          repository.repositoryBinding,
        )
      )
        throw new Error("transition");
    } else if (
      !currentBytes?.equals(bytes) &&
      (!validateCoordinatorStateTransition(
        currentBytes,
        bytes,
        repository.repositoryBinding,
      ) ||
        (currentBytes === null && !initialRoot))
    )
      throw new Error("transition");
    // 保存対象を変更する操作だけを現在のOwnerへ結合する。
    const previousOperations = new Map(
      current?.snapshot.operations.map((operation) => [
        operation.recoveryId,
        operation,
      ]) ?? [],
    );
    for (const operation of candidate.snapshot.operations) {
      const previous = previousOperations.get(operation.recoveryId);
      if (
        (!previous ||
          encodeCoordinatorStateValue(previous) !==
            encodeCoordinatorStateValue(operation)) &&
        JSON.parse(operation.identityJson).operationId !==
          repository.operationId
      )
        throw new Error("operation_owner");
    }
    for (const collection of [
      "unresolvedRecoveries",
      "pendingDeliveries",
    ] as const) {
      for (const item of candidate.snapshot[collection]) {
        const previous = current?.snapshot[collection].find(
          (value) =>
            value.operationNonce === item.operationNonce &&
            (collection !== "pendingDeliveries" ||
              ("consumer" in value &&
                "consumer" in item &&
                value.consumer === item.consumer)),
        );
        if (
          !previous ||
          encodeCoordinatorStateValue(previous) !==
            encodeCoordinatorStateValue(item)
        ) {
          const operation = candidate.snapshot.operations.find(
            (value) => value.recoveryId === item.recoveryId,
          );
          if (
            !operation ||
            JSON.parse(operation.identityJson).operationId !==
              repository.operationId
          )
            throw new Error("reference_owner");
        }
      }
    }
    if (oldMarker === null) create("state.lock", marker);
    if (!currentBytes?.equals(bytes)) {
      if (pendingBytes === null) create("state.pending.json", bytes);
      const samePending = read("state.pending.json");
      const sameCurrent = read("state.json");
      if (
        !samePending?.equals(bytes) ||
        (currentBytes === null
          ? sameCurrent !== null
          : !sameCurrent?.equals(currentBytes))
      )
        throw new Error("changed");
      assertBoundary();
      const fd = fs.openSync(path.join(directory, "state.pending.json"), "r+");
      try {
        const expected = fileIdentities.get("state.pending.json");
        if (
          !expected ||
          !sameStableFileIdentity(expected, fs.fstatSync(fd, { bigint: true }))
        )
          throw new Error("pending_replaced");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (!read("state.pending.json")?.equals(bytes))
        throw new Error("pending_changed");
      const target = read("state.json");
      if (
        currentBytes === null ? target !== null : !target?.equals(currentBytes)
      )
        throw new Error("target_changed");
      filesystemEffectIssued = true;
      const publishedIdentity = fileIdentities.get("state.pending.json");
      if (
        managementCapability !== null &&
        typeof managementCapability === "object"
      ) {
        const proof = initializations.get(managementCapability);
        if (proof) proof.publicationIssued = true;
      }
      fs.renameSync(
        path.join(directory, "state.pending.json"),
        path.join(directory, "state.json"),
      );
      fileIdentities.delete("state.json");
      fileIdentities.delete("state.pending.json");
      currentBytes = read("state.json");
      const published = fileIdentities.get("state.json");
      if (
        !publishedIdentity ||
        !published ||
        published.dev !== publishedIdentity.dev ||
        published.ino !== publishedIdentity.ino
      )
        throw new Error("published_replaced");
      current =
        currentBytes === null
          ? null
          : decodeCoordinatorStateSnapshot(
              currentBytes,
              repository.repositoryBinding,
            );
    } else if (pendingBytes !== null) {
      if (
        !read("state.pending.json")?.equals(bytes) ||
        !read("state.json")?.equals(bytes)
      )
        throw new Error("changed");
      assertBoundary();
      filesystemEffectIssued = true;
      fs.unlinkSync(path.join(directory, "state.pending.json"));
      fileIdentities.delete("state.pending.json");
    }
    if (
      !currentBytes?.equals(bytes) ||
      !current ||
      read("state.pending.json") !== null
    )
      throw new Error("final");
    // 排他markerは完了時に回収する。履歴やoperation記録を削除しない。
    if (!read("state.lock")?.equals(marker)) throw new Error("marker");
    assertBoundary();
    filesystemEffectIssued = true;
    fs.unlinkSync(path.join(directory, "state.lock"));
    fileIdentities.delete("state.lock");
    if (read("state.lock") !== null || !read("state.json")?.equals(bytes))
      throw new Error("final");
    snapshotConfirmed = true;
    if (
      managementCapability !== null &&
      typeof managementCapability === "object"
    )
      initializations.delete(managementCapability);
    reason = "coordinator_state_snapshot_confirmed";
  } catch {
    reason = "coordinator_state_storage_unconfirmed";
  }
  let lockReleased = false;
  try {
    lockReleased = lock.release();
  } catch {
    lockReleased = false;
  }
  if (!lockReleased) {
    if (
      managementCapability !== null &&
      typeof managementCapability === "object"
    )
      initializations.delete(managementCapability);
    reason = "coordinator_state_lock_release_unconfirmed";
  }
  return Object.freeze({
    ...attempt,
    status: snapshotConfirmed && lockReleased ? "completed" : "blocked",
    reason,
    filesystemEffectIssued,
    snapshotConfirmed,
    lockReleased,
  });
}
