/**
 * Hostの開始・復帰を現在状態checkpointと同じ実Ownerへ接続する。
 * @responsibility 処置前保存、実Host遷移、清掃・Mount終了根拠の照合と後続保存を所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { verifyRuntimeOwnedDockerCleanupOutcome } from "./isolation-execution.ts";
import {
  beginOwnedDockerSubmissionRecovery,
  borrowOwnedHostRecoverySnapshot,
  completeOwnedDockerSubmissionRecovery,
} from "./operation.ts";
import { parseHostRecoveryToken } from "./host-recovery-record.ts";
import { verifyRuntimeOwnedProviderHomeMountCompletion } from "./provider-home-mount-authorization.ts";
import { borrowRuntimeOwnedCoordinatorStateRepository } from "./repository-binding.ts";
import type { CoordinatorStateTaskOperation } from "../storage/model.ts";
import {
  checkpointRuntimeOwnedCoordinatorCleanup,
  checkpointRuntimeOwnedCoordinatorHost,
  readRuntimeOwnedCoordinatorStateSnapshot,
} from "../storage/settlement-store.ts";

/**
 * Host開始の予定保存・実遷移・結果保存を同じ操作へ接続する。
 *
 * @responsibility Docker要求前にHost開始を現在状態へ確定し、中断後も同じ予定へ再入場する。
 * @trace ARCH-000008
 * @input managementCapability: 同じ実Host Owner、recoveryId: 保存済み操作のexact参照。
 * @returns 保存・排他解放・Host要求と確認を分けた結果と同じ回復参照。
 * @precondition 開始Identityが確定済みで、Home Leaseは開始Ownerが保持している。
 * @postcondition 予定保存後だけHostを遷移させ、実token照合後だけ予定を解消する。
 * @effect 同じRepositoryのstate.jsonと、所有済みHost記録の開始遷移のみ。
 * @failure 別操作、実Host不一致、保存・解放不明、遷移例外は予定と回復参照を保持して停止する。
 * @invariant Host開始確認をDocker受理・Provider開始・回復完了へ昇格しない。
 * @boundary 本番開始Owner、現在状態Writerと同じHost Owner。
 * @security 任意Path・予測token・Caller supplied遷移本文を受け付けない。
 * @concurrency 同期Host遷移の前後を実Ownerで再観測し、各保存は元版照合する。
 */
export function beginRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
) {
  return transitionRuntimeOwnedCoordinatorHostSubmission(
    managementCapability,
    recoveryId,
    false,
  );
}

/**
 * 実Hostの開始または通常復帰を同じ予定保存経路で確定する。
 * @responsibility 処置前保存と実Ownerの前後観測を共通化する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId: 対象。isCompletingSubmission: 内部で固定した遷移方向。
 * @returns 保存と実遷移の確認を分けた結果。
 * @precondition 通常復帰の呼出し側は実清掃とMount結果を照合済み。
 * @postcondition 後継tokenを観測できた場合だけ予定を解消する。
 * @effect 同じ操作のHost記録とstate.jsonのみ。
 * @failure 不一致・保存不明・応答喪失は予定とexact参照を保持する。
 * @invariant 保存tokenからAuthorityを作らず、後継観測時に処置を再発行しない。
 * @boundary 同じHost OwnerとRepository内の状態保存。
 * @security 任意PathとCaller supplied予定を受け付けない。
 * @concurrency 既存Writer排他と同期Host前後観測を用いる。
 */
function transitionRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
  isCompletingSubmission: boolean,
) {
  const currentState = isCompletingSubmission
    ? "docker_submission_started"
    : "host_only";
  const nextState = isCompletingSubmission
    ? "host_only"
    : "docker_submission_started";
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const blocked = {
    status: "blocked" as const,
    reason: "coordinator_host_submission_invalid",
    revision: null as number | null,
    payloadSha256: null as string | null,
    recoveryIds: Object.freeze([] as string[]),
    recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    filesystemEffectIssued: false,
    snapshotConfirmed: false,
    lockReleased: current.lockReleased,
    hostTransitionRequested: false,
    hostTransitionConfirmed: false,
  };
  if (!repository || current.status !== "completed" || !current.value)
    return Object.freeze({
      ...blocked,
      reason: current.status === "blocked" ? current.reason : blocked.reason,
    });
  const operation = current.value.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  if (
    operation?.phase !== "executing" ||
    operation.host.cleanup !== "not_requested" ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return Object.freeze(blocked);
  let saved = blocked;
  let hostTransitionRequested = false;
  try {
    const host = borrowOwnedHostRecoverySnapshot(managementCapability);
    let transition: {
      currentToken: string;
      expectedToken: string;
      currentState: string;
      nextState: string;
    };
    if (operation.host.pendingTransitionJson === null) {
      if (
        host.snapshot.record.state !== currentState ||
        host.snapshot.token !== operation.host.currentToken
      )
        return Object.freeze(blocked);
      const parsed = parseHostRecoveryToken(host.snapshot.token);
      const nextHash = createHash("sha256")
        .update(
          `${JSON.stringify({ ...host.snapshot.record, state: nextState })}\n`,
        )
        .digest("hex");
      const intent = {
        currentToken: host.snapshot.token,
        expectedToken: `host.${parsed.rootName}.${parsed.nonce}.${nextHash}`,
        rootName: parsed.rootName,
        nonce: parsed.nonce,
        currentState,
        nextState,
        recordBefore: host.snapshot.record,
      };
      transition = intent;
      const intentSaved = checkpointRuntimeOwnedCoordinatorHost(
        managementCapability,
        recoveryId,
        {
          ...operation.host,
          pendingTransitionJson: `${JSON.stringify(intent)}\n`,
        },
      );
      if (intentSaved.status !== "completed")
        return Object.freeze({ ...blocked, ...intentSaved });
      saved = { ...blocked, ...intentSaved, status: "blocked" };
    } else {
      transition = JSON.parse(operation.host.pendingTransitionJson);
      if (
        transition.currentState !== currentState ||
        transition.nextState !== nextState
      )
        return Object.freeze(blocked);
    }
    const before = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (before.snapshot.token === transition.currentToken) {
      hostTransitionRequested = true;
      const observed = isCompletingSubmission
        ? completeOwnedDockerSubmissionRecovery(
            managementCapability,
            transition.currentToken,
          )
        : beginOwnedDockerSubmissionRecovery(
            managementCapability,
            repository.operationId,
          );
      if (observed !== transition.expectedToken)
        throw new Error("coordinator_host_submission_unconfirmed");
    } else if (before.snapshot.token !== transition.expectedToken) {
      throw new Error("coordinator_host_submission_unconfirmed");
    }
    const after = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (
      after.snapshot.token !== transition.expectedToken ||
      after.snapshot.record.state !== nextState
    )
      throw new Error("coordinator_host_submission_unconfirmed");
    const confirmed = checkpointRuntimeOwnedCoordinatorHost(
      managementCapability,
      recoveryId,
      {
        currentToken: transition.expectedToken,
        pendingTransitionJson: null,
        cleanup: operation.host.cleanup,
      },
    );
    return Object.freeze({
      ...blocked,
      ...confirmed,
      hostTransitionRequested,
      hostTransitionConfirmed: confirmed.status === "completed",
    });
  } catch {
    return Object.freeze({
      ...saved,
      reason: "coordinator_host_submission_unconfirmed",
      snapshotConfirmed: false,
      filesystemEffectIssued:
        saved.filesystemEffectIssued || hostTransitionRequested,
      hostTransitionRequested,
    });
  }
}

/**
 * 実資源回収とMount完了を照合してHostを通常状態へ戻す。
 * @responsibility 最終Controller結果に依存せず実終了根拠をHost復帰へ接続する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId、plan、recoveryCapability: 元対象。cleanupOutcome、mountCompletion: 各Ownerの元結果。
 * @returns 現在状態保存とHost実遷移の確認結果。
 * @precondition 元Docker清掃とMount終了が同じ本番Ownerから返却されている。
 * @postcondition exact五資源の回収を保存し、Host後継観測後だけ復帰予定を解消する。
 * @effect 同じRepositoryのstate.jsonと所有Host記録だけ。
 * @failure コピー・別対象・欠測・ID不明・保存不明はHost復帰前に拒否する。
 * @invariant Home Lease解放・Host領域清掃・結果受理は別条件として維持する。
 * @boundary 本番清掃・Mount・Hostの各Ownerと同じ操作の保存。
 * @security 任意の成功booleanや保存値を実終了根拠にしない。
 * @concurrency 各保存を既存排他で確定し、Host再入場では元結果を再照合する。
 */
export function completeRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
  plan: Parameters<typeof verifyRuntimeOwnedDockerCleanupOutcome>[1] &
    Readonly<{ consumer: "coordinator_cli" | "orchestrator" | "workbench" }>,
  recoveryCapability: unknown,
  cleanupOutcome: unknown,
  mountCompletion: unknown,
) {
  let cleanupEffectIssued = false;
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const blocked = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_host_completion_invalid",
    recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    snapshotConfirmed: false,
    filesystemEffectIssued: false,
    lockReleased: current.lockReleased,
    hostTransitionRequested: false,
    hostTransitionConfirmed: false,
  });
  try {
    const operation = current.value?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    if (
      current.status !== "completed" ||
      !operation ||
      !repository ||
      operation.phase !== "executing"
    )
      return blocked;
    const identity = JSON.parse(operation.identityJson);
    if (
      !plan ||
      plan.operationId !== repository.operationId ||
      identity.operationId !== plan.operationId ||
      [
        "provider",
        "consumer",
        "grantRef",
        "profileId",
        "stableLogicalHomeBindingHash",
        "providerHomeIdentityHash",
        "providerHomeProtectionHash",
        "localUserBindingHash",
        "ownershipLabel",
        "operationMode",
      ].some(
        (key) =>
          identity[key] !== (plan as unknown as Record<string, unknown>)[key],
      ) ||
      (
        [
          ["auth", "authContainerName"],
          ["provider", "providerContainerName"],
          ["proxy", "proxyContainerName"],
          ["internal", "internalNetworkName"],
          ["egress", "egressNetworkName"],
        ] as const
      ).some(
        ([key, field]) =>
          identity.resources[key] !==
          (plan as unknown as Record<string, unknown>)[field],
      ) ||
      identity.images.provider !== plan.providerImageDigest ||
      identity.images.proxy !== plan.proxyImageDigest
    )
      return blocked;
    const host = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (operation.host.pendingTransitionJson === null) {
      if (
        host.snapshot.record.state !== "docker_submission_started" ||
        host.snapshot.token !== operation.host.currentToken
      )
        return blocked;
    } else {
      const pending = JSON.parse(operation.host.pendingTransitionJson);
      if (
        pending.currentState !== "docker_submission_started" ||
        pending.nextState !== "host_only"
      )
        return blocked;
    }
    const observations = verifyRuntimeOwnedDockerCleanupOutcome(
      cleanupOutcome,
      plan,
      recoveryCapability,
      managementCapability,
    );
    if (
      observations?.length !== 5 ||
      observations.some(
        (item) =>
          item.observation !== "not_requested" && item.observation !== "absent",
      ) ||
      !verifyRuntimeOwnedProviderHomeMountCompletion(
        mountCompletion,
        managementCapability,
        plan.activeMountCapability,
        plan.operationId,
        plan.stableLogicalHomeBindingHash,
      )
    )
      return blocked;
    const cleanup = cleanupOutcome as Readonly<Record<string, unknown>>;
    if (
      cleanup.confirmed !== true ||
      cleanup.processTreeTerminated !== true ||
      cleanup.containersAbsent !== true ||
      cleanup.networksAbsent !== true
    )
      return blocked;
    const saved = checkpointRuntimeOwnedCoordinatorCleanup(
      managementCapability,
      recoveryId,
      observations,
    );
    cleanupEffectIssued = saved.filesystemEffectIssued;
    if (saved.status !== "completed")
      return Object.freeze({ ...blocked, ...saved });
    const transition = transitionRuntimeOwnedCoordinatorHostSubmission(
      managementCapability,
      recoveryId,
      true,
    );
    return Object.freeze({
      ...transition,
      filesystemEffectIssued:
        cleanupEffectIssued || transition.filesystemEffectIssued,
    });
  } catch {
    return Object.freeze({
      ...blocked,
      filesystemEffectIssued: cleanupEffectIssued,
    });
  }
}
