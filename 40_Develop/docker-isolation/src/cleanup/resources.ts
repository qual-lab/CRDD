/**
 * 指定されたSnapshotの技術観測を一つの同期Ownerへ集約する。
 * @responsibility 実ID照合・明示探索・不存在・自作config終了だけを所有する。
 * @trace ARCH-000008
 */
import { types } from "node:util";
import { observeDockerRuntimeRepairRetention } from "../docker-desktop/repair-session.ts";
import type { RepairRetentionTargets } from "../docker-desktop/types.ts";
import { captureIsolationCleanupRequest } from "../execution/preparation.ts";
import type { IsolationCleanupRequest } from "../execution/types.ts";
import { inspectContainerResources } from "./container.ts";
import {
  createTrustedDockerRecoveryExecutor,
  type DockerResourceRecoveryOperations,
} from "./execute.ts";
import type {
  ContainerResourceInspection,
  ContainerResourceTarget,
  DirectoryResourceInspectionTarget,
  SnapshotResourceInspection,
  ResourceTarget,
  ResourceInspection,
  ResourceSnapshot,
} from "./types.ts";

/**
 * 元Snapshotを資源種別によって観測する。
 * @responsibility 用途・Operation・保存相関を知らず、明示された探索候補だけを使う。
 * @trace ARCH-000008
 * @input request: 元資源と明示探索候補。options: 取消と不明時の観測打切り条件。
 * @returns 実際に観測できたSnapshotと存在三値、config終了確認。
 * @effect 有界Docker読取りと自作configの取得・終了。
 * @failure 不明・取消・config終了失敗はblocked。未要求はDocker要求0。
 * @invariant 入力の予定構成を観測済みSnapshotとしてコピーしない。削除しない。
 */
export function inspectIsolation(
  request: ResourceTarget<"directory", "inspect">,
): ResourceInspection<"directory">;
export function inspectIsolation(
  request: ResourceTarget<"container">,
): ResourceInspection<"container">;
export function inspectIsolation(
  request: ResourceTarget<"snapshot", "inspect">,
  options?: Readonly<{ signal?: AbortSignal; stopOnUnknownAbsence?: boolean }>,
): ResourceInspection<"snapshot">;
export function inspectIsolation(
  request:
    | IsolationCleanupRequest
    | ContainerResourceTarget
    | DirectoryResourceInspectionTarget,
  options: Readonly<{
    signal?: AbortSignal;
    stopOnUnknownAbsence?: boolean;
  }> = {},
):
  | SnapshotResourceInspection
  | ContainerResourceInspection
  | RepairRetentionTargets
  | null {
  if (
    request &&
    typeof request === "object" &&
    !types.isProxy(request) &&
    Object.getOwnPropertyDescriptor(request, "kind")?.value ===
      "docker_runtime_directory"
  )
    return observeDockerRuntimeRepairRetention(
      (request as DirectoryResourceInspectionTarget).input,
    );
  if (
    request &&
    typeof request === "object" &&
    !types.isProxy(request) &&
    Object.getOwnPropertyDescriptor(request, "kind")?.value === "container"
  )
    return inspectContainerResources(request as ContainerResourceTarget);
  const resourceRequest = request as IsolationCleanupRequest;
  const { signal, stopOnUnknownAbsence = false } = options;
  const resources: Array<SnapshotResourceInspection["resources"][number]> = [];
  const snapshots = new Map<string, ResourceSnapshot["resources"][number]>();
  let reason = "docker_task_recovery_resource_unconfirmed";
  let configCleanupConfirmed = true;
  let operations:
    | (DockerResourceRecoveryOperations & { close: () => boolean })
    | null = null;
  let completed = false;
  try {
    const input = captureIsolationCleanupRequest(resourceRequest);
    signal?.throwIfAborted();
    if (
      input.resources.resources.some(
        (resource) => resource.request !== "not_issued",
      )
    ) {
      const created = createTrustedDockerRecoveryExecutor({
        managementDirectory: input.managementDirectory,
        ...(signal ? { signal } : {}),
      });
      if (created.status !== "ready" || !created.executor) {
        reason = created.reason;
        configCleanupConfirmed = created.cleanupConfirmed;
        throw Error("recovery_setup_stopped");
      }
      operations = created.executor;
    }
    for (const resource of input.resources.resources) {
      signal?.throwIfAborted();
      const identity = resource.identity;
      const checks: Array<"absent" | "unknown"> = [];
      let dockerId = identity.dockerId;
      let observation: SnapshotResourceInspection["resources"][number]["observation"] =
        "not_requested";
      const onObserved = (snapshot: ResourceSnapshot) => {
        for (const item of snapshot.resources) snapshots.set(item.key, item);
      };
      if (resource.request !== "not_issued" && operations) {
        for (let round = 0; round < 2; round++) {
          signal?.throwIfAborted();
          checks.push(
            operations.observeAbsent(
              identity.kind,
              identity.name,
              identity.ownershipLabel,
            ) === true
              ? "absent"
              : "unknown",
          );
          signal?.throwIfAborted();
          if (stopOnUnknownAbsence && checks.at(-1) === "unknown") break;
        }
        observation =
          checks.length === 2 && checks.every((value) => value === "absent")
            ? "absent"
            : "unknown";
        if (dockerId !== null) {
          observation = "unknown";
          signal?.throwIfAborted();
          const present = operations.inspectIdentity(
            { ...identity, dockerId },
            resource.key,
            { allowAlreadyAbsent: false, onObserved },
          );
          signal?.throwIfAborted();
          if (present) observation = "present";
          else if (
            checks.length === 2 &&
            checks.every((value) => value === "absent")
          ) {
            signal?.throwIfAborted();
            const absent = operations.inspectIdentity(
              { ...identity, dockerId },
              resource.key,
              { allowAlreadyAbsent: true },
            );
            signal?.throwIfAborted();
            if (absent) observation = "absent";
          }
        } else if (
          observation !== "absent" &&
          input.unreceiptedAbsence === "observe"
        ) {
          signal?.throwIfAborted();
          dockerId = operations.discoverSubmitted({
            kind: identity.kind,
            expectedName: identity.name,
            ownershipLabel: identity.ownershipLabel,
          });
          signal?.throwIfAborted();
          if (dockerId !== null) {
            const present = operations.inspectIdentity(
              { ...identity, dockerId },
              resource.key,
              { allowAlreadyAbsent: false, onObserved },
            );
            signal?.throwIfAborted();
            observation = present ? "present" : "unknown";
          }
        }
      }
      resources.push(
        Object.freeze({
          key: resource.key,
          plannedResourceName: identity.name,
          dockerId,
          observation,
          absenceObservations: Object.freeze(checks),
        }),
      );
    }
    completed = resources.every(
      (resource) => resource.observation !== "unknown",
    );
    if (completed) reason = "docker_task_recovery_resources_inspected";
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
  return Object.freeze<SnapshotResourceInspection>({
    resourceSnapshot: Object.freeze({
      resources: Object.freeze([...snapshots.values()]),
    }),
    status: completed && configCleanupConfirmed ? "completed" : "blocked",
    reason: configCleanupConfirmed
      ? reason
      : "docker_task_recovery_config_cleanup_unconfirmed",
    configCleanupConfirmed,
    resources: Object.freeze(resources),
  });
}
