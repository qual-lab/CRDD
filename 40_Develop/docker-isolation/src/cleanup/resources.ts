/**
 * 元資源集合の観測・単独回収をDIの技術正本へ集約する。
 * @responsibility 探索・実ID通知・照合・削除・不存在・自作config終了を所有する。
 * @trace ARCH-000008
 */
import { types as utilTypes } from "node:util";
import { codexAdviceProviderInitRequired } from "../execution/plan.ts";
import {
  createDockerTaskRecoveryExecutor,
  type DockerResourceRecoveryOperations,
} from "./execute.ts";
import { planDockerRecoveryResourceExpectations } from "./plan.ts";
import type {
  DockerResourceReceipts,
  DockerResourceCleanupObservation,
} from "../execution/execute.ts";
import type {
  DockerResourceExpectationSet,
  ResourceTarget,
  ResourceInspection,
  ResourceCleanupResult,
  ResourceCleanupCallbacks,
} from "./types.ts";

/**
 * 必要な回収通知を同期処理として完了させる。
 * @responsibility 通知先の保存結果を解釈せず、未完了なら次Effectを止める。
 * @trace ARCH-000008
 * @input notice: 登録済み通知。args: 同じ資源の技術事実。
 * @returns 同期voidの完了後だけ戻る。
 * @effect 登録済み通知だけを一回発行する。
 * @failure Promise・不正返却・例外では停止し拒否を消費する。
 * @invariant ACK・待機キュー・再送を追加しない。
 */
function completeRecoveryNotice(
  notice: ((...args: never[]) => unknown) | undefined,
  ...args: unknown[]
): void {
  if (!notice) return;
  const returned: unknown = Reflect.apply(notice, undefined, args);
  if (returned !== undefined) {
    void Promise.resolve(returned).catch(() => {});
    throw Error("docker_task_recovery_checkpoint_unconfirmed");
  }
}

/**
 * 検査済みのAttempt技術投影をDIの五用途へ結合する。
 * @responsibility 回収順序とDocker構成はDIへ委譲し、保存Schemaを解釈しない。
 * @trace ARCH-000008
 * @input target: 元参照・技術投影・五用途Receipt。
 * @returns 固定五用途の不変期待値。
 * @effect N/A: 値変換だけ。
 * @failure 不正な参照・欠測・Proxy・資源不一致は停止する。
 * @invariant IDだけで処置を許可しない。
 */
function resourceExpectations(target: ResourceTarget) {
  if (
    utilTypes.isProxy(target) ||
    target?.kind !== "resource_set" ||
    typeof target.recoveryId !== "string" ||
    target.recoveryId.length === 0 ||
    typeof target.operationId !== "string" ||
    target.operationId.length === 0 ||
    !target.receipts ||
    utilTypes.isProxy(target.receipts) ||
    Object.keys(target.receipts).length !== 5
  )
    throw Error("docker_task_recovery_resource_missing");
  const p = target.projection;
  const entries = planDockerRecoveryResourceExpectations({
    authenticationContainerName: p.authContainerName,
    executionContainerName: p.providerContainerName,
    proxyContainerName: p.proxyContainerName,
    internalNetworkName: p.internalNetworkName,
    egressNetworkName: p.egressNetworkName,
    ownershipLabel: p.ownershipLabel,
    executionImageDigest: p.providerImageDigest,
    proxyImageDigest: p.proxyImageDigest,
    workspaceMounted: p.operationMode === "isolated_task",
    workspaceReadOnly: p.workspaceMountMode === "read_only",
    initRequired: codexAdviceProviderInitRequired(
      p.operationMode,
      p.providerImageDigest,
    ),
    ...(p.workspaceProtected === true
      ? {
          workspaceProtected: true,
          ...(p.workspaceProtection
            ? { workspaceProtection: p.workspaceProtection }
            : {}),
        }
      : {}),
  });
  if (
    !entries ||
    entries.some((entry) => {
      const receipt = target.receipts[entry.purpose];
      return (
        !receipt ||
        utilTypes.isProxy(receipt) ||
        typeof receipt.submitted !== "boolean" ||
        (receipt.dockerId !== null &&
          !/^[a-f0-9]{64}$/u.test(receipt.dockerId)) ||
        (!receipt.submitted && receipt.dockerId !== null)
      );
    })
  )
    throw Error("docker_task_recovery_resource_missing");
  return entries;
}

export function inspectDockerResources(
  target: ResourceTarget,
  purpose?: keyof DockerResourceReceipts,
): ResourceInspection {
  const resources: Array<ResourceInspection["resources"][number]> = [];
  let reason = "docker_task_recovery_resource_unconfirmed";
  let configCleanupConfirmed = true;
  let operations:
    | (DockerResourceRecoveryOperations & { close: () => boolean })
    | null = null;
  let completed = false;
  try {
    const entries = resourceExpectations(target).filter(
      (entry) => purpose === undefined || entry.purpose === purpose,
    );
    if (entries.length === 0)
      throw Error("docker_task_recovery_resource_missing");
    target.signal?.throwIfAborted();
    const requires = entries.some(
      (entry) => target.receipts[entry.purpose].submitted,
    );
    if (requires) {
      if (!target.managementDirectory)
        throw Error("docker_task_recovery_host_borrow_unconfirmed");
      const created = createDockerTaskRecoveryExecutor({
        managementDirectory: target.managementDirectory,
        ...(target.signal ? { signal: target.signal } : {}),
      });
      if (created.status !== "ready" || !created.executor) {
        reason = created.reason;
        configCleanupConfirmed = created.cleanupConfirmed;
        throw Error("recovery_setup_stopped");
      }
      operations = created.executor;
    }
    for (const entry of entries) {
      const receipt = target.receipts[entry.purpose];
      if (
        !receipt ||
        typeof receipt.submitted !== "boolean" ||
        (receipt.dockerId !== null &&
          (typeof receipt.dockerId !== "string" ||
            !/^[a-f0-9]{64}$/u.test(receipt.dockerId))) ||
        (!receipt.submitted && receipt.dockerId !== null)
      )
        throw Error("docker_task_recovery_receipt_invalid");
    }
    for (const entry of entries) {
      const first = entry.expectations[0];
      if (!first) throw Error("docker_task_recovery_resource_missing");
      target.signal?.throwIfAborted();
      const receipt = target.receipts[entry.purpose];
      const checks: Array<"absent" | "unknown"> = [];
      let dockerId = receipt.dockerId;
      let observation: ResourceInspection["resources"][number]["observation"] =
        "not_requested";
      if (receipt.submitted && operations) {
        for (let round = 0; round < 2; round++) {
          target.signal?.throwIfAborted();
          checks.push(
            operations.observeAbsent(
              first.kind,
              first.expectedName,
              first.ownershipLabel,
            ) === true
              ? "absent"
              : "unknown",
          );
          target.signal?.throwIfAborted();
          if (
            purpose === "create_subscription_auth_probe" &&
            checks.at(-1) === "unknown"
          )
            break;
        }
        observation =
          checks.length === 2 && checks.every((value) => value === "absent")
            ? "absent"
            : "unknown";
        if (dockerId !== null) {
          observation = "unknown";
          for (const expected of entry.expectations) {
            target.signal?.throwIfAborted();
            const present = operations.recoverObserved(
              { ...expected, dockerId },
              { allowAlreadyAbsent: false },
            );
            target.signal?.throwIfAborted();
            if (present) {
              observation = "present";
              break;
            }
            if (
              checks.length === 2 &&
              checks.every((value) => value === "absent")
            ) {
              target.signal?.throwIfAborted();
              const absent = operations.recoverObserved(
                { ...expected, dockerId },
                { allowAlreadyAbsent: true },
              );
              target.signal?.throwIfAborted();
              if (absent) {
                observation = "absent";
                break;
              }
            }
          }
        } else if (
          observation !== "absent" &&
          purpose !== "create_subscription_auth_probe"
        ) {
          for (const expected of entry.expectations) {
            target.signal?.throwIfAborted();
            if (dockerId === null)
              dockerId = operations.discoverSubmitted(expected);
            target.signal?.throwIfAborted();
            const present =
              dockerId !== null &&
              operations.recoverObserved(
                { ...expected, dockerId },
                { allowAlreadyAbsent: false },
              );
            target.signal?.throwIfAborted();
            if (present) {
              observation = "present";
              break;
            }
          }
        }
      }
      resources.push(
        Object.freeze({
          purpose: entry.purpose,
          plannedResourceName: first.expectedName,
          dockerId,
          observation,
          absenceObservations: Object.freeze(checks),
        }),
      );
    }
    completed = resources.every((value) => value.observation !== "unknown");
    reason = completed ? "docker_task_recovery_resources_inspected" : reason;
  } catch {
    completed = false;
  } finally {
    if (operations) {
      try {
        configCleanupConfirmed = operations.close() === true;
      } catch {
        configCleanupConfirmed = false;
      }
    }
  }
  return Object.freeze<ResourceInspection>({
    status: completed && configCleanupConfirmed ? "completed" : "blocked",
    operationId: target.operationId,
    recoveryId: target.recoveryId,
    reason: configCleanupConfirmed
      ? reason
      : "docker_task_recovery_config_cleanup_unconfirmed",
    configCleanupConfirmed,
    resources: Object.freeze(resources),
  });
}

/**
 * 通常実行と再入場の同じ期待値・Receiptを一つの回収順序へ接続する。
 * @responsibility 資源の照合・探索通知・削除・不存在・結果集約を一回だけ行う。
 * @trace ARCH-000008
 * @input input: DIが構築した技術期待値と元Receipt。operations: 同じDIの固定実行接続。callbacks: 必要な同期通知。
 * @returns 資源別事実と回収成立。Hostやconfig終了はこの結果へ補完しない。
 * @effect 元資源の固定観測と実ID処置。
 * @failure 取消・通知拒否・未発見・構成差をunknown又はblockedとして保持する。
 * @invariant 上位Owner・保存方式・Taskを知らない。
 */
export async function cleanupResourceSet(
  input: Readonly<{
    expectations: DockerResourceExpectationSet;
    receipts: DockerResourceReceipts;
    signal?: AbortSignal;
    previouslyAbsent?: readonly (keyof DockerResourceReceipts)[];
  }>,
  operations: {
    cleanupObserved: DockerResourceRecoveryOperations["cleanupObserved"];
    discoverSubmitted?: DockerResourceRecoveryOperations["discoverSubmitted"];
  } | null,
  callbacks: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  > = {},
): Promise<
  Omit<
    ResourceCleanupResult,
    "operationId" | "recoveryId" | "configCleanupConfirmed"
  >
> {
  const target = input,
    entries = input.expectations;
  const resources: DockerResourceCleanupObservation[] = [];
  let reason = "docker_task_recovery_execution_unconfirmed",
    completed = false,
    confirmed = false;
  try {
    for (const entry of entries) {
      const receipt = target.receipts[entry.purpose];
      if (
        !receipt ||
        typeof receipt.submitted !== "boolean" ||
        (receipt.dockerId !== null &&
          (typeof receipt.dockerId !== "string" ||
            !/^[a-f0-9]{64}$/u.test(receipt.dockerId))) ||
        (!receipt.submitted && receipt.dockerId !== null)
      )
        throw Error("docker_task_recovery_receipt_invalid");
    }
    for (const entry of entries) {
      const first = entry.expectations[0];
      if (!first) throw Error("docker_task_recovery_resource_missing");
      target.signal?.throwIfAborted();
      const receipt = target.receipts[entry.purpose];
      let dockerId = receipt.dockerId;
      let observation: DockerResourceCleanupObservation["observation"] =
        "not_requested";
      if (receipt.submitted) {
        if (!operations)
          throw Error("docker_task_recovery_executor_unavailable");
        reason = "docker_task_recovery_checkpoint_unconfirmed";
        completeRecoveryNotice(callbacks.onResourceInspecting, entry.purpose);
        reason = "docker_task_recovery_execution_unconfirmed";
        target.signal?.throwIfAborted();
        if (dockerId === null) {
          for (const expected of entry.expectations) {
            target.signal?.throwIfAborted();
            dockerId = operations.discoverSubmitted?.(expected) ?? null;
            target.signal?.throwIfAborted();
            if (dockerId !== null) break;
          }
          if (dockerId !== null) {
            reason = "docker_task_recovery_checkpoint_unconfirmed";
            if (!callbacks.onResourceIdentified)
              throw Error("docker_task_recovery_checkpoint_unconfirmed");
            completeRecoveryNotice(
              callbacks.onResourceIdentified,
              entry.purpose,
              dockerId,
            );
            reason = "docker_task_recovery_execution_unconfirmed";
            target.signal?.throwIfAborted();
          }
        }
        let absent = false;
        if (dockerId)
          for (const expected of entry.expectations) {
            target.signal?.throwIfAborted();
            absent = await operations.cleanupObserved(
              { ...expected, dockerId },
              target.signal,
              target.previouslyAbsent?.includes(entry.purpose) === true,
            );
            target.signal?.throwIfAborted();
            if (absent) break;
          }
        observation = absent ? "absent" : "unknown";
        if (!absent && target.previouslyAbsent?.includes(entry.purpose)) {
          reason = "docker_task_recovery_resource_unconfirmed";
          throw Error("previous_absence_unconfirmed");
        }
      }
      resources.push(
        Object.freeze({
          purpose: entry.purpose,
          plannedResourceName: first.expectedName,
          dockerId,
          observation,
        }),
      );
    }
    resources.sort((left, right) => left.purpose.localeCompare(right.purpose));
    confirmed = resources.every((value) => value.observation !== "unknown");
    reason = "docker_task_recovery_checkpoint_unconfirmed";
    completeRecoveryNotice(
      callbacks.onResourcesClosed,
      Object.freeze(resources),
    );
    target.signal?.throwIfAborted();
    completed = true;
    reason = confirmed
      ? "docker_task_recovery_resources_clean"
      : "docker_task_recovery_resource_unconfirmed";
  } catch {
    completed = false;
  }
  return Object.freeze({
    status: completed && confirmed ? "completed" : "blocked",
    reason,
    dockerCleanupConfirmed: confirmed,
    resources: Object.freeze(resources),
  });
}

/**
 * 再入場の短命configを取得し、共通回収とcloseを終えて元参照を返す。
 * @responsibility 共通資源処置を再実装せず、取得したconfigだけを一回終了する。
 * @trace ARCH-000008
 * @input target: 保存から復元した技術情報。callbacks: 共通回収通知。
 * @returns 資源回収とconfig終了を分離した同一参照の結果。
 * @effect 固定回収接続の取得・共通回収・自作configの終了。
 * @failure setup・通知・close不明はblocked。同じ参照を保持する。
 * @invariant 通常SessionのProcessやconfigを二重回収しない。
 */
export async function cleanupDockerResources(
  target: ResourceTarget,
  callbacks: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  > = {},
): Promise<ResourceCleanupResult> {
  let operations:
    | (DockerResourceRecoveryOperations & { close: () => boolean })
    | null = null;
  let configCleanupConfirmed = true,
    finalNoticeConfirmed = true;
  let outcome: Omit<
    ResourceCleanupResult,
    "operationId" | "recoveryId" | "configCleanupConfirmed"
  > = {
    status: "blocked",
    reason: "docker_task_recovery_execution_unconfirmed",
    dockerCleanupConfirmed: false,
    resources: [],
  };
  try {
    const entries = resourceExpectations(target);
    target.signal?.throwIfAborted();
    if (entries.some((entry) => target.receipts[entry.purpose].submitted)) {
      if (!target.managementDirectory)
        throw Error("docker_task_recovery_host_borrow_unconfirmed");
      const created = createDockerTaskRecoveryExecutor({
        managementDirectory: target.managementDirectory,
        ...(target.signal ? { signal: target.signal } : {}),
      });
      if (created.status !== "ready" || !created.executor) {
        outcome = { ...outcome, reason: created.reason };
        configCleanupConfirmed = created.cleanupConfirmed;
        throw Error("recovery_setup_stopped");
      }
      operations = created.executor;
    }
    outcome = await cleanupResourceSet(
      {
        expectations: entries,
        receipts: target.receipts,
        ...(target.signal ? { signal: target.signal } : {}),
        ...(target.previouslyAbsent
          ? { previouslyAbsent: target.previouslyAbsent }
          : {}),
      },
      operations,
      callbacks,
    );
  } catch {
    // setup失敗の一次理由と元参照を保持する。
  } finally {
    if (operations) {
      try {
        configCleanupConfirmed = operations.close() === true;
      } catch {
        configCleanupConfirmed = false;
      }
    }
  }
  try {
    completeRecoveryNotice(callbacks.onCleanupCompleted, outcome.resources);
  } catch {
    finalNoticeConfirmed = false;
  }
  return Object.freeze({
    ...outcome,
    operationId: target.operationId,
    recoveryId: target.recoveryId,
    configCleanupConfirmed,
    status:
      outcome.status === "completed" &&
      configCleanupConfirmed &&
      finalNoticeConfirmed
        ? "completed"
        : "blocked",
    reason: !configCleanupConfirmed
      ? "docker_task_recovery_config_cleanup_unconfirmed"
      : !finalNoticeConfirmed && outcome.status === "completed"
        ? "docker_task_recovery_checkpoint_unconfirmed"
        : outcome.reason,
  });
}
