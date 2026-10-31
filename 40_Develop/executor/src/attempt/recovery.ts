/**
 * 一つのAttemptの技術資源を診断・回収する。
 * @packageDocumentation
 * @responsibility 期待値・DI接続・現在観測・同期通知・短命config終了を所有する。
 * @trace ARCH-000008
 * @boundary 上位が検査した技術投影とDI。保存・Task判断・Host清掃は所有しない。
 */
import { types as utilTypes } from "node:util";
import {
  createDockerTaskRecoveryExecutor,
  planDockerRecoveryResourceExpectations,
  codexAdviceProviderInitRequired,
  type DockerResourceRecoveryOperations,
  type DockerResourceReceipts,
  type DockerResourceCleanupObservation,
} from "../../../docker-isolation/src/index.ts";
import type {
  AttemptRecoveryTarget,
  AttemptResourceInspection,
  AttemptCleanupResult,
  ResourceCleanupCallbacks,
} from "./types.ts";

/**
 * 元Attemptの現在Ownerを同期再確認する。
 * @responsibility 不正な非同期確認を許可へ変換しない。
 * @trace ARCH-000008
 * @input target: 上位で選定済みの対象。
 * @returns 正常時だけ戻る。
 * @effect 上位の現在性Queryだけを呼ぶ。
 * @failure false・例外・Promiseは停止する。
 * @invariant 確認値を次要求へ保存して使い回さない。
 */
function assertOwner(target: AttemptRecoveryTarget): void {
  const current: unknown = target.assertOwner();
  if (current !== true) {
    void Promise.resolve(current).catch(() => {});
    throw Error("docker_task_recovery_owner_unconfirmed");
  }
}

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
function resourceExpectations(target: AttemptRecoveryTarget) {
  if (
    !target ||
    utilTypes.isProxy(target) ||
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

/**
 * 資源診断だけを実行し、同じ技術configを必ず終了する。
 * @responsibility 存在・構成・不存在の観測を返し削除や保存を行わない。
 * @trace ARCH-000008
 * @input target: 上位選定済み対象。purpose: 省略時は全資源、指定時は同用途だけ。
 * @returns 元参照・資源観測・config終了結果。
 * @precondition 上位が対象・権限・排他を確認している。
 * @postcondition 診断を回収許可やTask完了へ昇格しない。
 * @effect DIの固定読取りと自作configの取得・closeだけ。
 * @failure 片方の不存在観測やconfig終了不明はblocked。
 * @invariant cleanupの先行必須操作にはしない。
 * @boundary 上位OwnerとDIの技術読取り。
 * @security raw出力・秘密を返さない。
 * @concurrency 各要求の前後で同じOwnerをfresh確認する。
 */
export function inspectAttemptResources(
  target: AttemptRecoveryTarget,
  purpose?: keyof DockerResourceReceipts,
): AttemptResourceInspection {
  const resources: Array<AttemptResourceInspection["resources"][number]> = [];
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
    assertOwner(target);
    const requires = entries.some(
      (entry) => target.receipts[entry.purpose].submitted,
    );
    if (requires) {
      if (!target.managementDirectory)
        throw Error("docker_task_recovery_host_borrow_unconfirmed");
      const created = createDockerTaskRecoveryExecutor({
        managementDirectory: target.managementDirectory,
        assertOwner: () => {
          assertOwner(target);
          return true;
        },
      });
      if (created.status !== "ready" || !created.executor) {
        reason = created.reason;
        configCleanupConfirmed = created.cleanupConfirmed;
        throw Error("recovery_setup_stopped");
      }
      operations = created.executor;
    }
    for (const entry of entries) {
      const first = entry.expectations[0];
      if (!first) throw Error("docker_task_recovery_resource_missing");
      assertOwner(target);
      const receipt = target.receipts[entry.purpose];
      const checks: Array<"absent" | "unknown"> = [];
      let dockerId = receipt.dockerId;
      let observation: AttemptResourceInspection["resources"][number]["observation"] =
        "not_requested";
      if (receipt.submitted && operations) {
        for (let round = 0; round < 2; round++) {
          assertOwner(target);
          checks.push(
            operations.observeAbsent(
              first.kind,
              first.expectedName,
              first.ownershipLabel,
            ) === true
              ? "absent"
              : "unknown",
          );
          assertOwner(target);
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
            assertOwner(target);
            const present = operations.recoverObserved(
              { ...expected, dockerId },
              { removeAfterVerification: false, allowAlreadyAbsent: false },
            );
            assertOwner(target);
            if (present) {
              observation = "present";
              break;
            }
            if (
              checks.length === 2 &&
              checks.every((value) => value === "absent")
            ) {
              assertOwner(target);
              const absent = operations.recoverObserved(
                { ...expected, dockerId },
                { removeAfterVerification: false, allowAlreadyAbsent: true },
              );
              assertOwner(target);
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
            assertOwner(target);
            if (dockerId === null)
              dockerId = operations.discoverSubmitted(expected);
            assertOwner(target);
            const present =
              dockerId !== null &&
              operations.recoverObserved(
                { ...expected, dockerId },
                { removeAfterVerification: false, allowAlreadyAbsent: false },
              );
            assertOwner(target);
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
  return Object.freeze({
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
 * 一つのAttemptの五資源をfresh照合し、元実IDだけを回収する。
 * @responsibility 発見通知・削除直前確認・資源観測・config closeを一体で所有する。
 * @trace ARCH-000008
 * @input target: 上位選定済み投影。callbacks: 同期完了する共通回収通知。
 * @returns 元参照、資源別結果、技術cleanupとconfig終了。
 * @precondition 上位が必要な保存通知とOwner確認を開始前に結合する。
 * @postcondition 取得済みconfigは通知失敗時もcloseする。
 * @effect DIによる固定探索・照合・exact ID削除・不存在再確認。
 * @failure 通知・Owner・構成・回収・close不明では同IDでblocked。
 * @invariant AI再実行・Host清掃・Lease操作・保存を所有しない。
 * @boundary Coordinatorの技術投影とDIの実体処置。
 * @security ID又は名前だけで削除しない。
 * @concurrency 全要求前後と削除直前に現在Ownerを再確認する。
 */
export function cleanupAttemptResources(
  target: AttemptRecoveryTarget,
  callbacks: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  > = {},
): AttemptCleanupResult {
  const resources: DockerResourceCleanupObservation[] = [];
  let reason = "docker_task_recovery_execution_unconfirmed";
  let configCleanupConfirmed = true;
  let operations:
    | (DockerResourceRecoveryOperations & { close: () => boolean })
    | null = null;
  let confirmed = false;
  let completed = false;
  try {
    const entries = resourceExpectations(target);
    assertOwner(target);
    if (entries.some((entry) => target.receipts[entry.purpose].submitted)) {
      if (!target.managementDirectory)
        throw Error("docker_task_recovery_host_borrow_unconfirmed");
      const created = createDockerTaskRecoveryExecutor({
        managementDirectory: target.managementDirectory,
        assertOwner: () => {
          assertOwner(target);
          return true;
        },
      });
      if (created.status !== "ready" || !created.executor) {
        reason = created.reason;
        configCleanupConfirmed = created.cleanupConfirmed;
        throw Error("recovery_setup_stopped");
      }
      operations = created.executor;
    }
    for (const entry of entries) {
      const first = entry.expectations[0];
      if (!first) throw Error("docker_task_recovery_resource_missing");
      assertOwner(target);
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
        assertOwner(target);
        if (dockerId === null) {
          for (const expected of entry.expectations) {
            assertOwner(target);
            dockerId = operations.discoverSubmitted(expected);
            assertOwner(target);
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
            assertOwner(target);
          }
        }
        let absent = false;
        if (dockerId)
          for (const expected of entry.expectations) {
            assertOwner(target);
            absent = operations.recoverObserved(
              { ...expected, dockerId },
              {
                assertBeforeRemoval: () => {
                  assertOwner(target);
                  return true;
                },
              },
            );
            assertOwner(target);
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
    confirmed = resources.every((value) => value.observation !== "unknown");
    reason = "docker_task_recovery_checkpoint_unconfirmed";
    completeRecoveryNotice(
      callbacks.onResourcesClosed,
      Object.freeze(resources),
    );
    assertOwner(target);
    completed = true;
    reason = confirmed
      ? "docker_task_recovery_resources_clean"
      : "docker_task_recovery_resource_unconfirmed";
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
  try {
    completeRecoveryNotice(
      callbacks.onCleanupCompleted,
      Object.freeze(resources),
    );
  } catch {
    if (completed) reason = "docker_task_recovery_checkpoint_unconfirmed";
    completed = false;
  }
  return Object.freeze({
    status:
      completed && confirmed && configCleanupConfirmed
        ? "completed"
        : "blocked",
    operationId: target.operationId,
    recoveryId: target.recoveryId,
    dockerCleanupConfirmed: confirmed,
    configCleanupConfirmed,
    reason: configCleanupConfirmed
      ? reason
      : "docker_task_recovery_config_cleanup_unconfirmed",
    resources: Object.freeze(resources),
  });
}
